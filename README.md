# TestWise

基于 AI 的软件测试辅助工具。输入 PRD、User Story 或验收条件，自动进行需求风险分析、生成覆盖项（Coverage Items）和测试策略（BVA、EP 等），在可编辑的 Master-Detail 界面中审核后生成测试套件。支持测试预言合成、基于覆盖效率的套件优化，以及白盒状态转换测试（ISO 29119-4）与交互式状态图。

技术栈：Electron + Vue 3 + TypeScript + Tailwind CSS v4 + OpenAI SDK。

## 环境配置

### 前置要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 配置 LLM

在项目根目录创建 `config.yaml`（也可通过界面右上角齿轮图标设置）：

```yaml
llm:
  apiKey: 'sk-your-api-key'
  model: 'deepseek-v4-flash'
  baseURL: 'https://api.deepseek.com'
  reasoningEffort: 'high'
  thinkingEnabled: true
```

| 字段 | 说明 |
|------|------|
| `apiKey` | LLM 服务的 API Key |
| `model` | 模型名称，例如 `deepseek-v4-flash`、`gpt-4o` |
| `baseURL` | API 端点地址，支持任意 OpenAI 兼容服务 |
| `reasoningEffort` | 推理强度：`high` / `max` |
| `thinkingEnabled` | 思考模式开关：`true` / `false`。关闭后不再传入 `reasoning_effort` |

> 配置文件在应用启动时加载，运行中可通过设置面板修改并即时重载。

## 运行

### 开发模式

```bash
npm run dev
```

启动 Electron 窗口，支持热更新（HMR）。

### 运行测试

```bash
npm test
```

### 构建

```bash
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

## 项目结构

```
src/
├── main/                             # Electron 主进程
│   ├── index.ts                      # 窗口管理、IPC 处理、应用生命周期
│   ├── config.ts                     # YAML 配置加载/重载/保存/变更监听
│   ├── llm.ts                        # OpenAI SDK 封装
│   ├── stateModel.ts                 # 白盒状态模型提取 + 状态转换测试用例生成
│   └── __test__/                     # 单元测试 + mock + fixtures
├── preload/                          # 预加载脚本
│   ├── index.ts                      # contextBridge 暴露 API 给渲染进程
│   └── index.d.ts                    # Window.api 类型声明
└── renderer/                         # 渲染进程（Vue 3）
    └── src/
        ├── App.vue                   # 根组件 — 步骤导航、全局布局、标题栏
        ├── types.ts                  # 共享类型 + LLM 响应校验
        ├── main.ts                   # Vue 应用入口
        ├── assets/main.css           # Tailwind + 全局样式
        └── components/
            ├── Step1Ingest.vue       # 步骤 1：需求导入（文本/文件上传 + AI 分析）
            ├── Step2Review.vue       # 步骤 2：Master-Detail 审核（风险看板 + 覆盖项/策略编辑）
            ├── Step3Generate.vue     # 步骤 3：双 Tab — 测试用例生成 + 状态建模
            ├── Step4StateModel.vue   # 状态图查看器（缩放/拖拽）+ 测试用例列表
            └── SettingsDialog.vue    # LLM 连接设置弹窗
```

## 使用流程

1. **步骤 1 — Ingest**：粘贴需求文本或上传 `.txt` / `.csv` / `.md` 文件，点击 "Analyze Requirements" 调用 AI 解析
2. **步骤 2 — Review & Edit**：左侧需求列表支持按优先级筛选，右侧逐条审核风险评分、覆盖项和测试策略，可增删改
3. **步骤 3 — Generate**：两个 Tab —
   - **Test Cases**：生成功能测试套件；在展开的用例中填入具体测试数据后合成预期结果；按风险和覆盖效率优化排序/最小化套件
   - **State Modeling**：从需求中提取状态机，渲染可缩放/拖拽的交互式状态图，生成 ISO 29119-4 状态转换测试用例
