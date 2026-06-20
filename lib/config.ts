/**
 * 配置加载器 —— 从 config.yaml 读取，不做任何默认值。
 * 字段缺失时直接报错，告诉你缺了什么。
 */
import { readFileSync } from "fs";
import { resolve } from "path";
// @ts-expect-error js-yaml 无类型声明
import yaml from "js-yaml";

// === 类型定义 ===

export type VisionProvider = "qwen" | "doubao" | "custom";
export type ImageGenProvider = "qwen" | "doubao" | "minimax" | "custom" | "none";

/** 视觉模型推理参数（可选的 per-provider 微调项） */
export interface VisionParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  /** 强制 JSON 输出：json_object | none（不传）*/
  response_format?: "json_object" | "none";
  /**
   * MiniMax M3 专属 — 推理链模式：
   * - "disabled"：关闭推理，不输出 <think>（低延迟，省 token）
   * - "adaptive"：开启推理，模型自行决定是否输出 <think>（M3 默认）
   */
  thinking?: "disabled" | "adaptive";
  /**
   * MiniMax M3 专属 — 推理内容分离：
   * true = 推理内容放到 reasoning_content 字段，content 保持干净（无 <think> 标签）
   * 不传 = 推理内容嵌入 content（以 <think>...</think> 包裹）
   */
  reasoning_split?: boolean;
  /** 客户端安全网：正则剥离 <think>...</think>（其他推理模型的兜底）*/
  strip_thinking?: boolean;
}

export interface ProviderConfig {
  base_url: string;
  api_key: string;
  model: string;
  /** 可选推理参数，不配则使用代码默认值 */
  params?: VisionParams;
}

export interface VisionConfig {
  provider: VisionProvider;
  qwen: ProviderConfig;
  doubao: ProviderConfig;
  custom: ProviderConfig;
}

export interface ImageGenConfig {
  provider: ImageGenProvider;
  qwen: ProviderConfig;
  doubao: ProviderConfig;
  minimax: ProviderConfig;
  custom: ProviderConfig;
}

export interface ImageSearchConfig {
  openserp_url: string;
  /** 可选：nginx 反代 key，不配则不带 key（兼容本地直连 OpenSERP） */
  openserp_key?: string;
}

export interface TestConfig {
  max_gen_images: number;
}

export interface PromptConfig {
  image_gen: string;
  image_gen_batch: string;
  vision_system: string;
}

export type GenMode = "individual" | "batch";

export interface AppConfig {
  vision: VisionConfig;
  image_gen: ImageGenConfig;
  image_search: ImageSearchConfig;
  test: TestConfig;
  prompts: PromptConfig;
}

// === 加载 ===

export function loadConfig(): AppConfig {
  const configPath = resolve(process.cwd(), "config.yaml");
  const raw = readFileSync(configPath, "utf-8");
  const data = yaml.load(raw) as any;

  return {
    vision: {
      provider: requireField(data, "vision.provider") as VisionProvider,
      qwen: readProvider(data, "vision.qwen"),
      doubao: readProvider(data, "vision.doubao"),
      custom: readProvider(data, "vision.custom"),
    },
    image_gen: {
      provider: requireField(data, "image_gen.provider") as ImageGenProvider,
      qwen: readProvider(data, "image_gen.qwen"),
      doubao: readProvider(data, "image_gen.doubao"),
      minimax: readProvider(data, "image_gen.minimax"),
      custom: readProvider(data, "image_gen.custom"),
    },
    image_search: {
      openserp_url: data?.image_search?.openserp_url || "",
      openserp_key: data?.image_search?.openserp_key || "",
    },
    test: {
      max_gen_images: data?.test?.max_gen_images ?? Infinity,
    },
    prompts: {
      vision_system: data?.prompts?.vision_system || "你是一个菜单翻译助手，识别图片中的所有文字并翻译成中文，输出JSON格式的结构化数据。",
      image_gen: data?.prompts?.image_gen || "A hyper-realistic food photo of: $dish_info. Professional food photography.",
      image_gen_batch: data?.prompts?.image_gen_batch || "Professional food photography flat lay featuring multiple dishes: $dish_list. Restaurant quality, top-down composition.",
    },
  } as AppConfig;
}

function readProvider(data: any, prefix: string): ProviderConfig {
  const raw = data;
  for (const part of prefix.split(".")) {
    if (raw == null) break;
  }
  const node = getNested(data, prefix);
  return {
    base_url: requireField(data, `${prefix}.base_url`),
    api_key: requireField(data, `${prefix}.api_key`),
    model: requireField(data, `${prefix}.model`),
    params: node?.params ? readParams(node.params) : undefined,
  };
}

function readParams(raw: any): VisionParams {
  const p: VisionParams = {};
  if (raw.temperature !== undefined) p.temperature = Number(raw.temperature);
  if (raw.top_p !== undefined) p.top_p = Number(raw.top_p);
  if (raw.max_tokens !== undefined) p.max_tokens = Number(raw.max_tokens);
  if (raw.response_format && raw.response_format !== "none") p.response_format = raw.response_format;
  if (raw.thinking === "disabled" || raw.thinking === "adaptive") p.thinking = raw.thinking;
  if (raw.reasoning_split === true) p.reasoning_split = true;
  if (raw.strip_thinking === true) p.strip_thinking = true;
  return p;
}

function getNested(data: any, path: string): any {
  let val: any = data;
  for (const part of path.split(".")) {
    if (val == null) return undefined;
    val = val[part];
  }
  return val;
}

function requireField(data: any, path: string): string {
  const parts = path.split(".");
  let val: any = data;
  for (const part of parts) {
    if (val == null) break;
    val = val[part];
  }
  if (!val || typeof val !== "string" || val.trim() === "") {
    throw new Error(`config.yaml 缺少必填项: ${path}`);
  }
  return val;
}
