# 啥菜 WhatDish

> 全球菜单，拍一下就知道。

拍下外文菜单，每道菜自动翻译成中文、匹配真实图片、标注「中国胃适配度」。支持任意语言。

**基于 [picMenu](https://github.com/Nutlope/picmenu) 二次开发**，为中文用户深度优化。

## 与原版的主要区别

| | 原版 picMenu | 啥菜 WhatDish |
|---|---|---|
| **目标用户** | 英文用户 | 中国出境游客 |
| **菜单翻译** | 保持原文 | 翻译成中文 + 中国胃评分 1-5 |
| **视觉模型** | Together AI 专用 | 多云可插拔（通义千问 / 豆包 / MiniMax / 自定义） |
| **图片搜索** | 无 | OpenSERP 百度+必应搜索真实菜品图片 |
| **AI 生图兜底** | Flux Schnell | 通义万相 / 豆包 / MiniMax，搜不到图时自动生成 |
| **配置方式** | .env 分散配置 | `config.yaml` 集中管理，缺啥报啥 |
| **输出格式** | 英文卡片 | 中文卡片 + 口味标签 + 中国胃适配语 |

## 技术栈

- **前端**：Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **视觉理解**：多模态 LLM（Qwen3.7-Plus / 豆包 Seed 2.0 / MiniMax M3 等）
- **图片搜索**：OpenSERP（百度 + 必应聚合）
- **AI 生图**：通义万相 Wan2.7 / 豆包 Seedream / MiniMax Image-01
- **导出**：html2canvas 一键导出 PNG

## 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置模型
cp config.yaml config.yaml  # 已有，直接编辑
# 编辑 vision.provider 和对应 provider 的 api_key / model
# 详见 config.yaml 内注释

# 3. 启动图片搜索（可选，不配则跳过）
docker run -d -p 7000:7000 sergeevgit/openserp

# 4. 启动开发服务器
npm run dev
```

## 配置说明

所有配置集中在 `config.yaml`，视觉理解与图片生成完全解耦，可混搭不同云厂商。

```yaml
vision:
  provider: qwen          # qwen | doubao | custom
  qwen:
    base_url: ...
    api_key: sk-xxx
    model: qwen3.7-plus
    params:               # 可选推理参数
      temperature: 0.1
      response_format: json_object

image_gen:
  provider: minimax       # qwen | doubao | minimax | custom | none
  # ...

image_search:
  openserp_url: http://localhost:7000  # 不配则跳过图片搜索

test:
  max_gen_images: 1       # 测试时限制生图数量，省费用
```

## 致谢

本项目基于 [Nutlope/picMenu](https://github.com/Nutlope/picmenu) 的架构和 UI 设计。原项目是一个出色的菜单可视化工具，我们在此基础上做了中文本地化和多模型适配。

## License

MIT
