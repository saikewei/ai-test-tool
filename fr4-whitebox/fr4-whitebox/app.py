"""
FR4.0 White-Box Test Modeling — Streamlit UI
运行方式：streamlit run app.py
"""

import json
import os
import streamlit as st
from openai import OpenAI
from state_model import (
    extract_state_model,
    build_graph,
    generate_all_states_sequences,
    generate_all_transitions_sequences,
    render_diagram,
    export_test_suite,
)

# ── 页面配置 ─────────────────────────────────────────────────
st.set_page_config(
    page_title="FR4.0 White-Box Test Modeling",
    page_icon="🔬",
    layout="wide"
)

st.title("🔬 FR4.0 White-Box Test Modeling")
st.caption("状态转换建模 · 测试序列生成 · ISO 29119-4")

# ── 侧边栏：LLM 配置 ─────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ LLM 配置")
    api_key = st.text_input("API Key", type="password",
                             value=os.environ.get("DEEPSEEK_API_KEY", ""))
    base_url = st.text_input("Base URL", value="https://api.deepseek.com")
    model_name = st.text_input("Model", value="deepseek-chat")

    st.divider()
    st.header("📐 覆盖准则")
    criterion = st.radio(
        "选择覆盖准则",
        ["All-States（所有状态覆盖）",
         "All-Transitions（所有转换覆盖）",
         "两者都生成"],
        index=2,
        help="All-States：每个状态至少访问一次；All-Transitions：每条转换至少执行一次"
    )

    st.divider()
    st.markdown("**关于 FR4.0**")
    st.markdown(
        "本模块实现 ISO 29119-4 状态转换测试，"
        "从需求文本自动提取状态机，生成可视化状态图与最优测试序列。"
    )

# ── 主区域 ──────────────────────────────────────────────────
st.subheader("📄 Step 1 — 输入需求文本")

# 示例文本
EXAMPLE_TEXT = """物品认领与交接子系统需求：

物品发布后处于"已发布（Published）"状态。用户可发起认领申请，物品转为"申请中（Claiming）"状态，系统通知发布者。

发布者审核：
- 若通过，物品变为"交接中（Handover）"，系统向双方交换联系方式。
- 若拒绝，物品回滚为"已发布"状态，申请记录保留。

交接阶段：
- 拾主点击"确认交付"，失主点击"收到物品"，双方确认后物品变为"已完成（Finished）"，系统结算赏币。
- 若任一方发起纠纷，物品进入"维权中（Disputing）"状态，系统暂停结算，通知管理员介入。
- 管理员裁决后，根据结果将物品变为"已完成"或回滚为"已发布"。
"""

col1, col2 = st.columns([3, 1])
with col1:
    requirement_text = st.text_area(
        "粘贴需求文本（User Story / 用例描述 / PRD 片段）",
        value="",
        height=220,
        placeholder="粘贴包含状态流转的需求文本..."
    )
with col2:
    st.markdown("<br>" * 3, unsafe_allow_html=True)
    if st.button("📋 载入示例", use_container_width=True):
        st.session_state["example_loaded"] = True
        st.rerun()

if st.session_state.get("example_loaded"):
    requirement_text = EXAMPLE_TEXT
    st.session_state["example_loaded"] = False

# 如果用了示例，显示出来
if not requirement_text and st.session_state.get("last_text"):
    requirement_text = st.session_state["last_text"]

analyze_btn = st.button(
    "🚀 分析需求 · 生成状态机",
    type="primary",
    use_container_width=True,
    disabled=not (requirement_text.strip() and api_key.strip())
)

if not api_key.strip():
    st.info("👈 请在左侧侧边栏填写 API Key 后开始分析")

# ── 分析流程 ────────────────────────────────────────────────
if analyze_btn and requirement_text.strip() and api_key.strip():
    st.session_state["last_text"] = requirement_text

    client = OpenAI(api_key=api_key, base_url=base_url)

    with st.spinner("🤖 LLM 正在提取状态机..."):
        try:
            model = extract_state_model(requirement_text, client, model_name)
            st.session_state["state_model"] = model
        except Exception as e:
            st.error(f"❌ LLM 调用失败：{e}")
            st.stop()

    G = build_graph(model)
    st.session_state["graph"] = G

    # 生成测试序列
    sequences = []
    if "All-States" in criterion or "两者" in criterion:
        sequences += generate_all_states_sequences(model, G)
    if "All-Transitions" in criterion or "两者" in criterion:
        sequences += generate_all_transitions_sequences(model, G)

    st.session_state["sequences"] = sequences
    st.success(f"✅ 提取成功：{len(model.states)} 个状态，{len(model.transitions)} 条转换，生成 {len(sequences)} 条测试序列")

# ── 结果展示 ────────────────────────────────────────────────
if "state_model" in st.session_state:
    model = st.session_state["state_model"]
    G = st.session_state["graph"]
    sequences = st.session_state.get("sequences", [])

    st.divider()

    # 标签页
    tab1, tab2, tab3, tab4 = st.tabs([
        "🗺️ 状态转换图",
        "📋 状态 & 转换列表",
        "🧪 测试序列",
        "📤 导出 JSON"
    ])

    # Tab1：状态图
    with tab1:
        st.subheader(f"🗺️ {model.title}")

        highlight_idx = st.selectbox(
            "高亮显示测试路径（可选）",
            options=["不高亮"] + [f"{s.seq_id} — {s.test_case['title'][:50]}" for s in sequences],
            index=0
        )

        highlight_path = None
        if highlight_idx != "不高亮":
            idx = int(highlight_idx.split("_")[2].split(" ")[0]) - 1
            # 根据 seq_id 找到对应序列
            selected_seq_id = highlight_idx.split(" ")[0]
            for seq in sequences:
                if seq.seq_id == selected_seq_id:
                    highlight_path = seq.path
                    break

        with st.spinner("渲染状态图..."):
            try:
                img_bytes = render_diagram(model, highlight_path)
                st.image(img_bytes, use_container_width=True)
            except Exception as e:
                st.error(f"渲染失败：{e}")

        # 图例
        col1, col2, col3 = st.columns(3)
        col1.markdown("🟢 **初始状态**")
        col2.markdown("🔴 **终止状态**")
        col3.markdown("🟠 **高亮路径**")

    # Tab2：状态 & 转换列表
    with tab2:
        col1, col2 = st.columns(2)
        with col1:
            st.subheader(f"📍 状态列表（{len(model.states)} 个）")
            for s in model.states:
                badge = ""
                if s.id == model.initial_state:
                    badge = " 🟢 初始"
                elif s.id in model.final_states:
                    badge = " 🔴 终止"
                with st.expander(f"**{s.name}** ({s.id}){badge}"):
                    st.write(s.description)

        with col2:
            st.subheader(f"↔️ 转换列表（{len(model.transitions)} 条）")
            for i, t in enumerate(model.transitions):
                from_name = next((s.name for s in model.states if s.id == t.from_state), t.from_state)
                to_name = next((s.name for s in model.states if s.id == t.to_state), t.to_state)
                label = f"`{from_name}` → `{to_name}`：{t.event}"
                with st.expander(label):
                    if t.guard:
                        st.markdown(f"**前置条件：** {t.guard}")
                    if t.action:
                        st.markdown(f"**执行动作：** {t.action}")
                    else:
                        st.caption("无特殊动作")

    # Tab3：测试序列
    with tab3:
        st.subheader(f"🧪 测试序列（{len(sequences)} 条）")

        if not sequences:
            st.info("暂无测试序列，请先在左侧选择覆盖准则后重新分析")
        else:
            # 覆盖统计
            as_count = sum(1 for s in sequences if s.criterion == "All-States")
            at_count = sum(1 for s in sequences if s.criterion == "All-Transitions")

            m1, m2, m3 = st.columns(3)
            m1.metric("All-States 序列", as_count)
            m2.metric("All-Transitions 序列", at_count)
            m3.metric("覆盖转换数", len(set(
                t for seq in sequences for t in seq.transitions_covered
            )))

            st.divider()

            for seq in sequences:
                criterion_badge = "🔵 All-States" if seq.criterion == "All-States" else "🟣 All-Transitions"
                path_names = " → ".join([
                    next((s.name for s in model.states if s.id == p), p)
                    for p in seq.path
                ])
                with st.expander(f"**{seq.seq_id}** {criterion_badge} | {path_names}"):
                    tc = seq.test_case

                    col1, col2 = st.columns(2)
                    col1.markdown(f"**优先级：** {tc['priority']}")
                    col2.markdown(f"**类型：** {tc['test_type']}")
                    st.markdown(f"**前置条件：** {tc['preconditions']}")
                    st.markdown(f"**风险说明：** {tc['risk_assessment']['reason']}")

                    st.markdown("**测试步骤：**")
                    for step in tc["steps"]:
                        st.markdown(
                            f"&nbsp;&nbsp;**步骤 {step['step_id']}**：{step['action']}  \n"
                            f"&nbsp;&nbsp;&nbsp;&nbsp;✔ 期望结果：{step['expected_result']}"
                        )

    # Tab4：导出 JSON
    with tab4:
        st.subheader("📤 导出测试套件 JSON")
        st.caption("格式与组员A的工具（TestSuite）完全兼容，可直接导入测试管理工具")

        export_data = export_test_suite(model, sequences)
        json_str = json.dumps(export_data, ensure_ascii=False, indent=2)

        st.download_button(
            label="⬇️ 下载 test_suite_fr40.json",
            data=json_str.encode("utf-8"),
            file_name="test_suite_fr40.json",
            mime="application/json",
            use_container_width=True,
            type="primary"
        )

        st.code(json_str[:2000] + ("\n... (已截断，完整内容请下载)" if len(json_str) > 2000 else ""),
                language="json")

# ── 底部说明 ─────────────────────────────────────────────────
st.divider()
st.caption(
    "FR4.0 White-Box Test Modeling · ISO 29119-4 State Transition Testing · "
    "AutoTestDesign Tool — 组员B模块"
)
