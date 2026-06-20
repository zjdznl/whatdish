/**
 * 视觉模型配置 —— 从 config.yaml 读取。
 */

import { loadConfig, type VisionProvider, type ProviderConfig } from "./config";

export type { VisionProvider, ProviderConfig };

export function getVisionConfig(): ProviderConfig & { provider: VisionProvider } {
  const config = loadConfig();
  const { provider, qwen, doubao, custom } = config.vision;

  switch (provider) {
    case "qwen":   return { provider, ...qwen };
    case "doubao": return { provider, ...doubao };
    case "custom": return { provider, ...custom };
    default:
      throw new Error(`config.yaml: 不支持的 vision.provider: ${provider}`);
  }
}
