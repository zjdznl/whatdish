/**
 * 啥菜 菜单分析 API
 *
 * POST /api/parseMenu
 * Body: { imageBase64?: string, images?: string[], gen_mode?: string, skip_gen?: boolean }
 * Response: { menu: DishItem[], meta: {...}, source_images?: string[] }
 *
 * 流水线：
 *   1. 多模态模型 OCR + 结构化提取（支持多图逐张解析后合并去重）
 *   2. 为每道菜搜索真实图片（OpenSERP，百度+必应）
 *   3. skip_gen=false 时 AI 生图兜底（串行），skip_gen=true 时跳过（前端后台并发生成）
 */

import OpenAI from "openai";
import { loadConfig, type GenMode } from "@/lib/config";
import { getVisionConfig } from "@/lib/models";
import { searchDishImages } from "@/lib/image-search";
import { generateDishImage, getMaxImageCount } from "@/lib/image-gen";

export async function POST(request: Request) {
  const body = await request.json();
  const genMode: GenMode = body.gen_mode === "batch" ? "batch" : "individual";
  const skipGen = body.skip_gen === true;

  // 支持单图 imageBase64（兼容旧版）和多图 images[] 两种方式
  const imageList: string[] = body.images || (body.imageBase64 ? [body.imageBase64] : []);

  if (imageList.length === 0) {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  const config = getVisionConfig();
  const openai = new OpenAI({ baseURL: config.base_url, apiKey: config.api_key });
  console.log(`[啥菜] Model: ${config.provider}/${config.model}, images: ${imageList.length}, skip_gen: ${skipGen}`);

  // ============================================================
  // Step 1: 逐张 OCR 解析
  // ============================================================
  const params = config.params || {};
  const temperature = params.temperature ?? 0.1;
  const max_tokens = params.max_tokens ?? 4096;

  interface ImageResult {
    sourceIndex: number;
    menuData: any;
    items: any[];
    restaurant_name: string;
    country: string;
    language: string;
  }

  const imageResults: ImageResult[] = [];

  for (let i = 0; i < imageList.length; i++) {
    const imgBase64 = imageList[i];
    console.log(`[啥菜] OCR image ${i + 1}/${imageList.length}...`);

    const apiParams: Record<string, any> = {
      model: config.model,
      messages: [
        { role: "system", content: loadConfig().prompts.vision_system },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: imageList.length > 1
                ? `请分析第 ${i + 1}/${imageList.length} 张菜单图片，输出结构化 JSON。`
                : "请分析这张菜单图片，输出结构化 JSON。",
            },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imgBase64}` } },
          ],
        },
      ],
      max_tokens,
      temperature,
    };

    if (params.top_p !== undefined) apiParams.top_p = params.top_p;
    if (params.response_format === "json_object") apiParams.response_format = { type: "json_object" };
    if (params.thinking) apiParams.thinking = { type: params.thinking };
    if (params.reasoning_split) apiParams.reasoning_split = true;

    const response = await openai.chat.completions.create(apiParams as any);
    let content = response.choices[0]?.message?.content || "";

    if (params.strip_thinking) content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    let menuData: any;
    try {
      menuData = parseJSON(content);
    } catch (e) {
      console.error(`[啥菜] Failed to parse JSON for image ${i + 1}:`, e);
      continue; // 跳过解析失败的图片，继续处理后续图片
    }

    if (menuData?.is_menu === false) {
      console.log(`[啥菜] Image ${i + 1} is not a menu, skipping`);
      continue;
    }

    // 收集该图的菜品
    const items: any[] = [];
    for (const cat of menuData?.categories || []) {
      for (const item of cat.items || []) {
        items.push({ ...item, category_name: cat.name_zh || cat.name_orig, _source_image: i });
      }
    }
    if (items.length === 0 && Array.isArray(menuData)) {
      for (const item of menuData) items.push({ ...item, category_name: "", _source_image: i });
    }

    imageResults.push({
      sourceIndex: i,
      menuData,
      items,
      restaurant_name: menuData?.restaurant_name || "",
      country: menuData?.country || "",
      language: menuData?.language || "",
    });

    console.log(`[啥菜] Image ${i + 1}: ${items.length} dishes, restaurant: ${menuData?.restaurant_name || "未识别"}`);
  }

  if (imageResults.length === 0) {
    return Response.json(
      { error: "NOT_MENU", message: "这些图片似乎都不是餐厅菜单，请上传清晰的菜单照片后再试。" },
      { status: 400 }
    );
  }

  // ============================================================
  // Step 2: 合并多图结果（去重策略：同名且同分类视为同一道菜）
  // ============================================================
  const mergedItems: any[] = [];
  const seen = new Set<string>();

  for (const result of imageResults) {
    for (const item of result.items) {
      const key = `${item.category_name || ""}::${item.name_orig || item.name || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        mergedItems.push(item);
      } else {
        // 已存在：合并 source_image 信息（一道菜出现在多张图中）
        const existing = mergedItems.find(
          (m) => `${m.category_name || ""}::${m.name_orig || m.name || ""}` === key
        );
        if (existing) {
          const src = existing._source_images || [existing._source_image];
          if (!src.includes(result.sourceIndex)) src.push(result.sourceIndex);
          existing._source_images = src;
        }
      }
    }
  }

  // 统一 _source_image → _source_images（便于前端展示来源标记）
  for (const item of mergedItems) {
    if (!item._source_images) item._source_images = [item._source_image];
    delete item._source_image;
  }

  // 取第一张有效图片的元信息作为主元信息
  const primary = imageResults[0];
  const country = imageResults.find((r) => r.country)?.country || "";
  const language = imageResults.find((r) => r.language)?.language || "";

  console.log(`[啥菜] Total: ${mergedItems.length} dishes from ${imageResults.length} images (merged)`);

  // ============================================================
  // Step 3: 搜真实图片（并行）
  // ============================================================
  const context = `${country} ${language} cuisine`;
  const searchResults = await Promise.all(
    mergedItems.map((item) => searchDishImages(item.name_orig || item.name, context, 3))
  );

  const itemsWithImages = mergedItems.map((item: any, idx: number) => {
    const sr = searchResults[idx];
    const images = (sr.images || []).map((img: any) => ({
      url: img.url,
      thumbnail_url: img.thumbnail_url,
      title: img.title,
    }));
    return {
      ...item,
      images,
      image_search_url: sr.searchUrl,
      image_source: sr.source,
      _needGen: images.length === 0,
    };
  });

  // ============================================================
  // Step 4: AI 生图（skip_gen=true 时跳过）
  // ============================================================
  if (!skipGen) {
    const maxGen = getMaxImageCount();
    const needGen = itemsWithImages
      .filter((item: any) => item._needGen)
      .slice(0, maxGen);

    if (needGen.length > 0) {
      console.log(`[啥菜] Gen: ${needGen.length}/${itemsWithImages.filter((i: any) => i._needGen).length} dishes (max=${maxGen === Infinity ? "all" : maxGen})`);
      for (const item of needGen) {
        const dishName = item.name_orig || item.name;
        const dishDesc = item.description_zh || "";
        const aiImage = await generateDishImage(`${dishName}, ${dishDesc}, ${context}`.trim());
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
  }

  // 清理内部标记
  for (const item of itemsWithImages) {
    delete (item as any)._needGen;
  }

  return Response.json({
    menu: itemsWithImages,
    meta: {
      restaurant_name: primary.restaurant_name || "",
      country,
      language,
      total_items: itemsWithImages.length,
      image_count: imageList.length,
      model_used: `${config.provider}/${config.model}`,
      gen_mode: genMode,
      skip_gen: skipGen,
      max_gen_images: getMaxImageCount(),
    },
  });
}

function parseJSON(content: string): any {
  let text = content.trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(text);
}

export const maxDuration = 120;
