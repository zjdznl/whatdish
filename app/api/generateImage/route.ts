/**
 * POST /api/generateImage
 * 单道菜 AI 生图接口 — 供前端后台并发生图池调用。
 *
 * Body: { name_orig, name_zh, description_zh, context? }
 * Response: { image_base64: string } | { error: string }
 */
import { generateDishImage } from "@/lib/image-gen";

export async function POST(request: Request) {
  const { name_orig, name_zh, description_zh, context } = await request.json();

  if (!name_orig && !name_zh) {
    return Response.json({ error: "Missing dish name" }, { status: 400 });
  }

  const dishName = name_orig || name_zh;
  const genPrompt = [dishName, description_zh, context].filter(Boolean).join(", ").trim();

  console.log(`[啥菜/gen] Generating: ${genPrompt.slice(0, 100)}...`);

  try {
    const b64 = await generateDishImage(genPrompt);
    if (b64) {
      return Response.json({ image_base64: b64 });
    }
    return Response.json({ error: "Image generation returned empty" }, { status: 500 });
  } catch (e: any) {
    console.error("[啥菜/gen] Failed:", e.message);
    return Response.json({ error: e.message || "Generation failed" }, { status: 500 });
  }
}

export const maxDuration = 300;
