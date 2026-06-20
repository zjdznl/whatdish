/**
 * 图片生成 —— AI 生图兜底。
 * 所有配置从 config.yaml 读取，无默认值。
 */
import { loadConfig, type ImageGenProvider, type ProviderConfig } from "./config";

export function getMaxImageCount(): number {
  return loadConfig().test.max_gen_images ?? Infinity;
}

/** 判断是否为 Qwen-Image 系列模型（返回 OSS URL 而非 base64） */
function isQwenImageModel(model: string): boolean {
  return model.startsWith("qwen-image");
}

/**
 * 批量生图：将所有菜品信息拼接为一次 API 调用，生成一张全景菜单图。
 * 适用场景：用户选择"全景生图"模式，省费用、速度快。
 * @param dishListText 所有菜品的汇总文本（菜品名+描述）
 * @returns base64 图片数据，失败返回 null
 */
export async function generateBatchImage(dishListText: string): Promise<string | null> {
  const config = loadConfig().image_gen;

  if (config.provider === "none") {
    console.log("[image-gen] provider=none，跳过批量生图");
    return null;
  }

  const p: ProviderConfig = config[config.provider];
  if (!p.api_key || !p.model) {
    console.log(`[image-gen] ${config.provider} 配置不完整，跳过批量生图`);
    return null;
  }

  const template = loadConfig().prompts.image_gen_batch;
  const fullPrompt = template.replace("$dish_list", dishListText);

  console.log(`[image-gen] Batch generating with ${config.provider}/${p.model}...`);
  console.log(`[image-gen] Batch prompt (${fullPrompt.length} chars): ${fullPrompt.slice(0, 200)}...`);

  const body = buildRequestBody(config.provider, p.model, fullPrompt);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {
    const res = await fetch(p.base_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.api_key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[image-gen] Batch API ${res.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    return await extractBase64(config.provider, p.model, data);
  } catch (e: any) {
    console.error("[image-gen] Batch failed:", e.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateDishImage(prompt: string): Promise<string | null> {
  const config = loadConfig().image_gen;

  if (config.provider === "none") {
    console.log("[image-gen] provider=none，跳过生图");
    return null;
  }

  const p: ProviderConfig = config[config.provider];
  if (!p.api_key || !p.model) {
    console.log(`[image-gen] ${config.provider} 配置不完整，跳过生图`);
    return null;
  }

  console.log(`[image-gen] Generating with ${config.provider}/${p.model}...`);

  const body = buildRequestBody(config.provider, p.model, prompt);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {
    const res = await fetch(p.base_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.api_key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[image-gen] API ${res.status} (${p.model}): ${errText.slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    return await extractBase64(config.provider, p.model, data);
  } catch (e: any) {
    console.error("[image-gen] Failed:", e.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildRequestBody(
  provider: ImageGenProvider,
  model: string,
  prompt: string
): object {
  const template = loadConfig().prompts.image_gen;
  const text = template.replace("$dish_info", prompt);

  switch (provider) {
    case "qwen": {
      const size = isQwenImageModel(model) ? "1024*1024" : "2K";
      return {
        model,
        input: {
          messages: [{ role: "user", content: [{ text }] }],
        },
        parameters: { n: 1, size, watermark: false },
      };
    }
    case "minimax":
      return {
        model,
        prompt: text,
        aspect_ratio: "1:1",
        response_format: "base64",
      };
    default:
      return {
        model,
        prompt: text,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      };
  }
}

async function extractBase64(
  provider: ImageGenProvider,
  model: string,
  data: any
): Promise<string | null> {
  switch (provider) {
    case "qwen":
      return await extractQwenImage(model, data);
    case "minimax":
      return data?.data?.image_base64?.[0] || null;
    default:
      return data?.data?.[0]?.b64_json || null;
  }
}

async function extractQwenImage(
  model: string,
  data: any
): Promise<string | null> {
  const contents = data?.output?.choices?.[0]?.message?.content || [];
  for (const item of contents) {
    if (item.image) {
      if (isQwenImageModel(model)) {
        return await downloadImageToBase64(item.image);
      }
      return item.image;
    }
  }
  return null;
}

async function downloadImageToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch {
    return null;
  }
}
