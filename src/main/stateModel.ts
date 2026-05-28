import { requestLlm } from './llm'

// ── 类型定义 ────────────────────────────────────────────────

export interface State {
  id: string
  name: string
  description: string
}

export interface Transition {
  from_state: string
  to_state: string
  event: string
  guard: string
  action: string
}

export interface StateModel {
  title: string
  initial_state: string
  final_states: string[]
  states: State[]
  transitions: Transition[]
}

export interface TestStep {
  step_id: number
  action: string
  expected_result: string
}

export interface StateTestCase {
  case_id: string
  title: string
  priority: 'High' | 'Medium' | 'Low'
  criterion: string
  path: string[]
  risk_assessment: { score: number; reason: string }
  preconditions: string
  test_type: string
  steps: TestStep[]
}

export interface StateModelResult {
  model: StateModel
  dotSource: string
  testCases: StateTestCase[]
  coverage: {
    totalStates: number
    totalTransitions: number
    allStatesCases: number
    allTransitionsCases: number
  }
}

// ── LLM Prompt ──────────────────────────────────────────────

const EXTRACT_PROMPT = `You are a software testing expert specializing in State Transition Testing (ISO 29119-4).

Analyze the requirement text and extract the most representative state machine. Return ONLY valid JSON with no markdown or extra text.

Output format:
{
  "title": "State machine name",
  "initial_state": "S1",
  "final_states": ["S4"],
  "states": [
    { "id": "S1", "name": "State Name", "description": "What this state means" }
  ],
  "transitions": [
    { "from_state": "S1", "to_state": "S2", "event": "Trigger event", "guard": "Pre-condition or empty string", "action": "Side effect or empty string" }
  ]
}

Rules:
- State IDs: S1, S2, S3...
- 4-8 states covering the main flow and key exception branches
- Language matching: if input is Chinese, use Chinese for names/descriptions/events
`

// ── 主流程 ──────────────────────────────────────────────────

export async function buildStateModel(requirementText: string): Promise<StateModelResult> {
  // 1. LLM 提取状态机
  const raw = await requestLlm(
    `Requirement text:\n${requirementText}`,
    EXTRACT_PROMPT,
    true
  )

  let model: StateModel
  try {
    model = JSON.parse(raw) as StateModel
  } catch {
    throw new Error('LLM returned invalid JSON for state model')
  }

  // 2. 生成 DOT 源码（供前端 viz.js 渲染）
  const dotSource = buildDotSource(model)

  // 3. 生成测试用例
  const testCases = generateTestCases(model)

  return {
    model,
    dotSource,
    testCases,
    coverage: {
      totalStates: model.states.length,
      totalTransitions: model.transitions.length,
      allStatesCases: testCases.filter((t) => t.criterion === 'All-States').length,
      allTransitionsCases: testCases.filter((t) => t.criterion === 'All-Transitions').length
    }
  }
}

// ── DOT 生成 ────────────────────────────────────────────────

function buildDotSource(model: StateModel): string {
  const lines: string[] = []
  lines.push(`digraph "${model.title}" {`)
  lines.push('  rankdir=LR;')
  lines.push('  bgcolor="#09090b";')
  lines.push('  node [fontname="Arial" fontsize=12];')
  lines.push('  edge [fontname="Arial" fontsize=10];')

  // 隐式起始点
  lines.push('  __start__ [shape=point width=0.2 style=filled fillcolor="#22c55e"];')
  lines.push(`  __start__ -> ${model.initial_state} [style=dashed color="#22c55e"];`)

  for (const s of model.states) {
    const isInitial = s.id === model.initial_state
    const isFinal = model.final_states.includes(s.id)
    const shape = isFinal ? 'doublecircle' : 'rectangle'
    const fillcolor = isInitial ? '#166534' : isFinal ? '#7f1d1d' : '#18181b'
    const fontcolor = '#e4e4e7'
    const color = isInitial ? '#22c55e' : isFinal ? '#ef4444' : '#52525b'
    const label = `${s.name}\\n(${s.id})`
    lines.push(
      `  ${s.id} [label="${label}" shape=${shape} style="filled,rounded" fillcolor="${fillcolor}" fontcolor="${fontcolor}" color="${color}"];`
    )
  }

  for (const t of model.transitions) {
    let label = t.event
    if (t.guard) label += `\\n[${t.guard}]`
    lines.push(
      `  ${t.from_state} -> ${t.to_state} [label="${label}" color="#3b82f6" fontcolor="#a1a1aa"];`
    )
  }

  lines.push('}')
  return lines.join('\n')
}

// ── 图算法：BFS 最短路径 ─────────────────────────────────────

function shortestPath(
  model: StateModel,
  from: string,
  to: string
): string[] | null {
  const adj = new Map<string, string[]>()
  for (const s of model.states) adj.set(s.id, [])
  for (const t of model.transitions) {
    adj.get(t.from_state)?.push(t.to_state)
  }

  const queue: string[][] = [[from]]
  const visited = new Set<string>([from])

  while (queue.length > 0) {
    const path = queue.shift()!
    const node = path[path.length - 1]
    if (node === to) return path
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([...path, neighbor])
      }
    }
  }
  return null
}

// ── 测试用例生成 ─────────────────────────────────────────────

function stateName(model: StateModel, id: string): string {
  return model.states.find((s) => s.id === id)?.name ?? id
}

function transitionLabel(model: StateModel, from: string, to: string): string {
  const t = model.transitions.find((t) => t.from_state === from && t.to_state === to)
  if (!t) return ''
  let label = t.event
  if (t.guard) label += ` [${t.guard}]`
  return label
}

function buildTestCase(
  model: StateModel,
  seqId: string,
  criterion: string,
  path: string[]
): StateTestCase {
  const steps: TestStep[] = []

  steps.push({
    step_id: 1,
    action: `确认系统处于初始状态：${stateName(model, path[0])}`,
    expected_result: `当前状态为【${stateName(model, path[0])}】`
  })

  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i]
    const v = path[i + 1]
    const t = model.transitions.find((t) => t.from_state === u && t.to_state === v)
    const event = t?.event ?? '触发事件'
    const guard = t?.guard ?? ''
    const action = t?.action ?? ''

    let actionText = `执行：${event}`
    if (guard) actionText += `（前置条件：${guard}）`

    let expectedText = `系统从【${stateName(model, u)}】转换到【${stateName(model, v)}】`
    if (action) expectedText += `，执行动作：${action}`

    steps.push({
      step_id: i + 2,
      action: actionText,
      expected_result: expectedText
    })
  }

  const pathNames = path.map((id) => stateName(model, id)).join(' → ')
  const coveredTransitions = path
    .slice(0, -1)
    .map((id, i) => transitionLabel(model, id, path[i + 1]))
    .join(', ')

  return {
    case_id: seqId,
    title: `[${criterion}] ${pathNames}`,
    priority: 'High',
    criterion,
    path,
    risk_assessment: {
      score: criterion === 'All-Transitions' ? 9 : 7,
      reason: `状态转换测试（${criterion}）覆盖转换：${coveredTransitions}`
    },
    preconditions: `系统处于初始状态【${stateName(model, path[0])}】，测试环境就绪`,
    test_type: 'White-Box / State Transition (ISO 29119-4)',
    steps
  }
}

function generateTestCases(model: StateModel): StateTestCase[] {
  const cases: StateTestCase[] = []

  // All-States：确保每个状态至少被访问一次
  const visitedStates = new Set<string>()
  let asCounter = 1

  for (const target of model.states) {
    if (visitedStates.has(target.id)) continue
    const path = shortestPath(model, model.initial_state, target.id)
    if (!path) continue
    path.forEach((id) => visitedStates.add(id))
    cases.push(buildTestCase(model, `ST_AS_${String(asCounter).padStart(3, '0')}`, 'All-States', path))
    asCounter++
  }

  // All-Transitions：确保每条转换至少被执行一次
  const coveredEdges = new Set<string>()
  let atCounter = 1

  for (const t of model.transitions) {
    const edgeKey = `${t.from_state}->${t.to_state}`
    if (coveredEdges.has(edgeKey)) continue

    const pathToFrom = shortestPath(model, model.initial_state, t.from_state)
    if (!pathToFrom) continue

    const fullPath = [...pathToFrom, t.to_state]
    for (let i = 0; i < fullPath.length - 1; i++) {
      coveredEdges.add(`${fullPath[i]}->${fullPath[i + 1]}`)
    }

    cases.push(buildTestCase(model, `ST_AT_${String(atCounter).padStart(3, '0')}`, 'All-Transitions', fullPath))
    atCounter++
  }

  return cases
}
