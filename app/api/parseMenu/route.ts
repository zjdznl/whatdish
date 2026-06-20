/**
 * 啥菜 菜单分析 API
 *
 * POST /api/parseMenu
 * Body: { imageBase64: string }
 * Response: { menu: DishItem[] }
 *
 * 流水线：
 *   1. 多模态模型 OCR + 结构化提取
 *   2. 为每道菜搜索真实图片（OpenSERP，百度+必应）
 *   3. 返回完整结构化结果供前端渲染
 */

import OpenAI from "openai";
import { loadConfig, type GenMode } from "@/lib/config";
import { getVisionConfig } from "@/lib/models";
import { searchDishImages } from "@/lib/image-search";
import { generateDishImage, getMaxImageCount } from "@/lib/image-gen";

export async function POST(request: Request) {
  const { imageBase64, gen_mode } = await request.json();
  const genMode: GenMode = gen_mode === "batch" ? "batch" : "individual";

  if (!imageBase64) {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  const config = getVisionConfig();

  const openai = new OpenAI({
    baseURL: config.base_url,
    apiKey: config.api_key,
  });

  console.log(`[啥菜] Using model: ${config.provider}/${config.model}`);

  // Step 1: 多模态模型 OCR + 结构化
  const params = config.params || {};
  const temperature = params.temperature ?? 0.1;
  const max_tokens = params.max_tokens ?? 4096;

  // 构建 API 请求参数（含 provider 特有参数如 MiniMax thinking）
  const apiParams: Record<string, any> = {
    model: config.model,
    messages: [
      { role: "system", content: loadConfig().prompts.vision_system },
      {
        role: "user",
        content: [
          { type: "text", text: "请分析这张菜单图片，输出结构化 JSON。" },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
    max_tokens,
    temperature,
  };

  if (params.top_p !== undefined) apiParams.top_p = params.top_p;
  if (params.response_format === "json_object") {
    apiParams.response_format = { type: "json_object" };
  }
  if (params.thinking) {
    apiParams.thinking = { type: params.thinking };
  }
  if (params.reasoning_split) {
    apiParams.reasoning_split = true;
  }

  const response = await openai.chat.completions.create(apiParams as any);

  let content = response.choices[0]?.message?.content || "";
  console.log(`[啥菜] LLM response (${content.length} chars):`, content);

  // 客户端安全网：strip_thinking 为 true 时剥离 <think> 标签
  if (params.strip_thinking) {
    const before = content.length;
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    console.log(`[啥菜] Stripped <think> tags: ${before} → ${content.length} chars`);
  }

  // 解析 JSON
  let menuData: any;
  try {
    menuData = parseJSON(content);
  } catch (e) {
    console.error("[啥菜] Failed to parse LLM response:", e);
    return Response.json(
      { error: "Failed to parse menu", raw: content.slice(0, 500) },
      { status: 500 }
    );
  }

  // 菜单检测：如果不是菜单图片，直接返回提示
  if (menuData?.is_menu === false) {
    console.log("[啥菜] Not a menu image, returning early");
    return Response.json(
      { error: "NOT_MENU", message: "这张图片似乎不是餐厅菜单，请上传清晰的菜单照片后再试。" },
      { status: 400 }
    );
  }

  // Step 2: 收集所有菜品
  const allItems: any[] = [];
  const categories = menuData?.categories || [];
  for (const cat of categories) {
    for (const item of cat.items || []) {
      allItems.push({ ...item, category_name: cat.name_zh || cat.name_orig });
    }
  }

  // 如果 LLM 没按 categories 格式输出，尝试兼容旧格式（直接数组）
  if (allItems.length === 0 && Array.isArray(menuData)) {
    for (const item of menuData) {
      allItems.push({ ...item, category_name: "" });
    }
  }

  console.log(`[啥菜] Found ${allItems.length} dishes`);

  // Step 3: 搜真实图片（并行） + AI 生图兜底（串行，避免限流）
  const context = `${menuData?.country || ""} ${menuData?.language || ""} cuisine`;

  // 先并行搜索所有菜品的图片（轻量操作）
  const searchResults = await Promise.all(
    allItems.map((item: any) =>
      searchDishImages(item.name_orig || item.name, context, 3)
    )
  );

  // 构建结果，记录哪些需要 AI 生图
  const itemsWithImages = allItems.map((item: any, idx: number) => {
    const searchResult = searchResults[idx];
    const images = searchResult.images.map((img: any) => ({
      url: img.url,
      thumbnail_url: img.thumbnail_url,
      title: img.title,
    }));
    return {
      ...item,
      images,
      image_search_url: searchResult.searchUrl,
      image_source: searchResult.source,
      _needGen: images.length === 0, // 内部标记
    };
  });

  // 串行生成图片，避免 429 限流。IMAGE_GEN_MAX_COUNT 控制上限
  // 两种模式都逐道生图，差异在前端展示：individual=卡片视图，batch=自动拼成海报
  const maxGen = getMaxImageCount();
  const needGen = itemsWithImages
    .filter((item: any) => item._needGen)
    .slice(0, maxGen);

  if (needGen.length > 0) {
    console.log(`[啥菜] Generating AI images for ${needGen.length}/${itemsWithImages.filter((i: any) => i._needGen).length} dishes (max=${maxGen === Infinity ? 'all' : maxGen}, mode=${genMode})...`);
    for (const item of needGen) {
      const dishName = item.name_orig || item.name;
      const dishDesc = item.description_zh || "";
      const genPrompt = `${dishName}, ${dishDesc}, ${context}`.trim();
      const aiImage = await generateDishImage(genPrompt);
      if (aiImage) {
        item.images.push({
          url: `data:image/png;base64,${aiImage}`,
          thumbnail_url: `data:image/png;base64,${aiImage}`,
          title: `${dishName} (AI 生成)`,
        });
        item.image_source = "ai_generated";
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // 清理内部标记
  for (const item of itemsWithImages) {
    delete (item as any)._needGen;
  }

  return Response.json({
    menu: itemsWithImages,
    meta: {
      restaurant_name: menuData?.restaurant_name || "",
      country: menuData?.country || "",
      language: menuData?.language || "",
      total_items: itemsWithImages.length,
      model_used: `${config.provider}/${config.model}`,
      gen_mode: genMode,
    },
  });
}

function parseJSON(content: string): any {
  let text = content.trim();
  // 去掉 <think>...</think> 推理块（MiniMax M3 等推理模型的输出特征）
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // 去掉 markdown 代码块
  if (text.startsWith("```")) {
    text = text.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(text);
}

export const maxDuration = 120;
