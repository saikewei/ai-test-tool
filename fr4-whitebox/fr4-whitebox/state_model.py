"""
FR4.0 White-Box Test Modeling
状态转换建模 + 测试序列生成
"""

import json
import re
from dataclasses import dataclass, field
from typing import Optional
import networkx as nx
import graphviz
from openai import OpenAI

# ── 数据结构 ────────────────────────────────────────────────

@dataclass
class State:
    id: str
    name: str
    description: str

@dataclass
class Transition:
    from_state: str
    to_state: str
    event: str
    guard: str = ""
    action: str = ""

@dataclass
class StateModel:
    title: str
    states: list[State]
    transitions: list[Transition]
    initial_state: str
    final_states: list[str]

@dataclass
class TestSequence:
    seq_id: str
    criterion: str          # All-States / All-Transitions / All-Paths
    path: list[str]         # state ids
    transitions_covered: list[str]
    test_case: dict         # 与 A 的 TestCase 格式兼容

# ── LLM 提取状态机 ──────────────────────────────────────────

EXTRACT_PROMPT = """你是软件测试专家，擅长状态转换测试（State Transition Testing，ISO 29119-4）。

请分析以下需求文本，提取其中最核心的一个**状态机**（State Machine），并以 JSON 格式返回。

## 需求文本
{requirement_text}

## 输出格式（严格 JSON，不要加 markdown 代码块）
{{
  "title": "状态机名称（如：物品生命周期状态机）",
  "initial_state": "STATE_ID",
  "final_states": ["STATE_ID", ...],
  "states": [
    {{
      "id": "S1",
      "name": "状态名称",
      "description": "该状态的含义"
    }}
  ],
  "transitions": [
    {{
      "from_state": "S1",
      "to_state": "S2",
      "event": "触发事件（用户动作或系统事件）",
      "guard": "前置条件（可为空字符串）",
      "action": "转换时执行的动作（可为空字符串）"
    }}
  ]
}}

## 注意
- states 数量建议 4-8 个，聚焦核心流程
- transitions 要覆盖正常流程和主要异常分支
- id 格式：S1, S2, S3...（states）；event 用简洁中文描述
"""

def extract_state_model(requirement_text: str, client: OpenAI, model: str) -> StateModel:
    """调用 LLM 从需求文本提取状态机"""
    prompt = EXTRACT_PROMPT.format(requirement_text=requirement_text)

    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": "你是软件测试专家，只输出合法JSON，不输出任何其他内容。"},
            {"role": "user", "content": prompt}
        ],
        model=model,
        response_format={"type": "json_object"},
        stream=False
    )

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)

    states = [State(**s) for s in data.get("states", [])]
    transitions = [Transition(**t) for t in data.get("transitions", [])]

    return StateModel(
        title=data.get("title", "状态机"),
        states=states,
        transitions=transitions,
        initial_state=data.get("initial_state", states[0].id if states else ""),
        final_states=data.get("final_states", [])
    )

# ── 构建有向图 ───────────────────────────────────────────────

def build_graph(model: StateModel) -> nx.DiGraph:
    G = nx.DiGraph()
    for s in model.states:
        G.add_node(s.id, name=s.name, description=s.description)
    for t in model.transitions:
        G.add_edge(t.from_state, t.to_state,
                   event=t.event, guard=t.guard, action=t.action)
    return G

# ── 测试序列生成 ─────────────────────────────────────────────

def _state_name(model: StateModel, sid: str) -> str:
    for s in model.states:
        if s.id == sid:
            return s.name
    return sid

def _transition_label(G: nx.DiGraph, u: str, v: str) -> str:
    data = G[u][v]
    label = data.get("event", "")
    if data.get("guard"):
        label += f" [{data['guard']}]"
    return label

def generate_all_states_sequences(model: StateModel, G: nx.DiGraph) -> list[TestSequence]:
    """All-States 覆盖：确保每个状态至少被访问一次"""
    sequences = []
    visited_states = set()
    seq_counter = 1

    # 从初始状态做 DFS，找覆盖所有状态的路径
    all_state_ids = {s.id for s in model.states}

    for target_state in all_state_ids:
        if target_state in visited_states:
            continue
        try:
            path = nx.shortest_path(G, model.initial_state, target_state)
            visited_states.update(path)
            transitions_covered = [
                _transition_label(G, path[i], path[i+1])
                for i in range(len(path) - 1)
            ]
            seq = _build_test_sequence(
                seq_id=f"ST_AS_{seq_counter:03d}",
                criterion="All-States",
                path=path,
                transitions_covered=transitions_covered,
                model=model,
                G=G
            )
            sequences.append(seq)
            seq_counter += 1
        except nx.NetworkXNoPath:
            continue

    return sequences

def generate_all_transitions_sequences(model: StateModel, G: nx.DiGraph) -> list[TestSequence]:
    """All-Transitions 覆盖：确保每条转换至少被执行一次"""
    sequences = []
    covered_edges = set()
    seq_counter = 1

    all_edges = list(G.edges())

    for (u, v) in all_edges:
        if (u, v) in covered_edges:
            continue
        try:
            # 找从初始状态到 u 的路径，再走 u→v
            path_to_u = nx.shortest_path(G, model.initial_state, u)
            full_path = path_to_u + [v]

            # 标记路径上所有边为已覆盖
            for i in range(len(full_path) - 1):
                covered_edges.add((full_path[i], full_path[i+1]))

            transitions_covered = [
                _transition_label(G, full_path[i], full_path[i+1])
                for i in range(len(full_path) - 1)
            ]
            seq = _build_test_sequence(
                seq_id=f"ST_AT_{seq_counter:03d}",
                criterion="All-Transitions",
                path=full_path,
                transitions_covered=transitions_covered,
                model=model,
                G=G
            )
            sequences.append(seq)
            seq_counter += 1
        except nx.NetworkXNoPath:
            continue

    return sequences

def _build_test_sequence(
    seq_id: str,
    criterion: str,
    path: list[str],
    transitions_covered: list[str],
    model: StateModel,
    G: nx.DiGraph
) -> TestSequence:
    """将路径转换为与 A 的 TestCase 格式兼容的测试序列"""

    # 构建 steps
    steps = []
    step_id = 1

    # 第一步：初始状态
    init_name = _state_name(model, path[0])
    steps.append({
        "step_id": step_id,
        "action": f"系统处于初始状态：{init_name}",
        "expected_result": f"确认当前状态为【{init_name}】"
    })
    step_id += 1

    for i in range(len(path) - 1):
        u, v = path[i], path[i+1]
        edge_data = G[u][v]
        event = edge_data.get("event", "触发事件")
        guard = edge_data.get("guard", "")
        action = edge_data.get("action", "")
        from_name = _state_name(model, u)
        to_name = _state_name(model, v)

        action_desc = f"执行事件：{event}"
        if guard:
            action_desc += f"（前置条件：{guard}）"

        expected = f"系统从【{from_name}】转换到【{to_name}】"
        if action:
            expected += f"，并执行：{action}"

        steps.append({
            "step_id": step_id,
            "action": action_desc,
            "expected_result": expected
        })
        step_id += 1

    # 构建与 A 兼容的 TestCase 字典
    path_names = " → ".join([_state_name(model, s) for s in path])
    test_case = {
        "case_id": seq_id,
        "title": f"[{criterion}] {path_names}",
        "priority": "High",
        "risk_assessment": {
            "score": 8,
            "reason": f"状态转换测试（{criterion}覆盖准则），覆盖转换：{', '.join(transitions_covered)}"
        },
        "preconditions": f"系统处于初始状态【{_state_name(model, path[0])}】，测试环境已就绪",
        "test_type": "White-Box / State Transition",
        "steps": steps
    }

    return TestSequence(
        seq_id=seq_id,
        criterion=criterion,
        path=path,
        transitions_covered=transitions_covered,
        test_case=test_case
    )

# ── 渲染状态转换图 ───────────────────────────────────────────

def render_diagram(model: StateModel, highlight_path: list[str] = None) -> bytes:
    """用 graphviz 渲染状态图，返回 PNG bytes"""
    dot = graphviz.Digraph(
        name=model.title,
        format="png",
        graph_attr={"rankdir": "LR", "fontname": "Arial", "bgcolor": "#1e1e2e"},
        node_attr={"fontname": "Arial", "fontsize": "12"},
        edge_attr={"fontname": "Arial", "fontsize": "10"}
    )

    highlight_edges = set()
    if highlight_path:
        for i in range(len(highlight_path) - 1):
            highlight_edges.add((highlight_path[i], highlight_path[i+1]))

    # 隐式起始节点
    dot.node("__start__", shape="point", width="0.2",
             style="filled", fillcolor="#a6e3a1")

    for s in model.states:
        is_initial = s.id == model.initial_state
        is_final = s.id in model.final_states
        is_highlighted = highlight_path and s.id in highlight_path

        shape = "doublecircle" if is_final else "rectangle"
        fillcolor = "#a6e3a1" if is_initial else ("#f38ba8" if is_final else "#313244")
        if is_highlighted:
            fillcolor = "#fab387"
        fontcolor = "#1e1e2e" if is_initial or is_final else "#cdd6f4"

        dot.node(s.id,
                 label=f"{s.name}\n({s.id})",
                 shape=shape,
                 style="filled,rounded",
                 fillcolor=fillcolor,
                 fontcolor=fontcolor,
                 color="#cdd6f4")

    dot.edge("__start__", model.initial_state, style="dashed", color="#a6e3a1")

    for t in model.transitions:
        label = t.event
        if t.guard:
            label += f"\n[{t.guard}]"

        is_highlighted = (t.from_state, t.to_state) in highlight_edges
        color = "#fab387" if is_highlighted else "#89b4fa"
        penwidth = "2.5" if is_highlighted else "1.0"

        dot.edge(t.from_state, t.to_state,
                 label=label,
                 color=color,
                 fontcolor="#cdd6f4",
                 penwidth=penwidth)

    return dot.pipe()

# ── 导出 JSON（与 A 的 TestSuite 格式兼容）─────────────────

def export_test_suite(model: StateModel, sequences: list[TestSequence]) -> dict:
    return {
        "test_suite": {
            "suite_name": f"[FR4.0] {model.title} - 状态转换测试套件",
            "description": (
                f"基于状态转换测试（ISO 29119-4）自动生成。"
                f"共 {len(model.states)} 个状态，{len(model.transitions)} 条转换，"
                f"生成 {len(sequences)} 条测试序列。"
            ),
            "test_cases": [seq.test_case for seq in sequences]
        }
    }
