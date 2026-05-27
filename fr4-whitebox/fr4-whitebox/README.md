# FR4.0 White-Box Test Modeling

AutoTestDesign 工具的 **FR4.0 白盒测试建模**模块，基于 ISO 29119-4 状态转换测试（State Transition Testing）。

## 功能

- 从需求文本（User Story / 用例描述 / PRD）中自动提取状态机
- 可视化渲染状态转换图（支持高亮测试路径）
- 按 **All-States** 和 **All-Transitions** 覆盖准则生成最优测试序列
- 导出与组员A工具（TestSuite）格式完全兼容的 JSON

## 环境要求

- Python >= 3.10
- Graphviz（系统级依赖）

### 安装 Graphviz

```bash
# macOS
brew install graphviz

# Ubuntu / Debian
sudo apt-get install graphviz

# Windows
# 下载安装包：https://graphviz.org/download/
```

### 安装 Python 依赖

```bash
pip install -r requirements.txt
```

## 配置

支持任意 OpenAI 兼容的 LLM 服务，推荐使用 DeepSeek（与组员A工具保持一致）：

在界面侧边栏填写：
- **API Key**：你的 DeepSeek/OpenAI API Key
- **Base URL**：`https://api.deepseek.com`（DeepSeek）或 `https://api.openai.com`
- **Model**：`deepseek-chat` 或 `gpt-4o`

也可通过环境变量预设：
```bash
export DEEPSEEK_API_KEY=sk-your-api-key
```

## 运行

```bash
streamlit run app.py
```

浏览器自动打开 `http://localhost:8501`

## 使用流程

1. **配置 LLM**：在左侧侧边栏填写 API Key 和模型信息
2. **选择覆盖准则**：All-States / All-Transitions / 两者都生成
3. **输入需求文本**：粘贴包含状态流转的需求片段，或点击「载入示例」
4. **点击「分析需求 · 生成状态机」**：LLM 自动提取状态和转换
5. **查看结果**：
   - 🗺️ 状态转换图：可高亮任意测试路径
   - 📋 状态 & 转换列表：查看所有状态和转换的详细信息
   - 🧪 测试序列：查看每条测试用例的步骤和期望结果
   - 📤 导出 JSON：下载与组员A工具兼容的测试套件文件

## 与组员A工具的关系

| 模块 | 负责人 | 功能 |
|------|--------|------|
| FR1.0/1.1 | 组员A | 需求导入与结构化解析 |
| FR2.0 | 组员A | 风险分析与优先级评分 |
| FR3.0 | 组员A | 黑盒测试设计（EP/BVA/决策表） |
| FR6.0 | 组员A | 测试用例导出（JSON/CSV） |
| **FR4.0** | **组员B** | **白盒测试建模（状态转换图 + 测试序列）** |

**数据格式兼容**：本模块导出的 JSON 与组员A工具的 `TestSuite` 类型完全兼容，可直接在组员A的工具中展示或导入 TMS。

## 项目结构

```
fr4-whitebox/
├── app.py              # Streamlit 界面
├── state_model.py      # 核心逻辑（状态提取、建图、测试序列生成）
├── requirements.txt    # Python 依赖
└── README.md           # 本文档
```

## 技术原理

### 状态提取
调用 LLM（DeepSeek/GPT-4o），通过专门设计的 System Prompt 从需求文本中识别：
- **状态（States）**：系统在某时刻的稳定条件
- **转换（Transitions）**：触发事件、前置条件（Guard）、执行动作（Action）

### 图算法
使用 `networkx` 有向图：
- **All-States**：对每个未访问状态，用 `shortest_path` 求从初始状态出发的最短路径
- **All-Transitions**：对每条未覆盖的边，求经过该边的最短完整路径

### 可视化
使用 `graphviz` 渲染，深色主题（与组员A工具风格一致），支持高亮任意测试路径。
