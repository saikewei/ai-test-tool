<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Loader2,
  Sparkles,
  AlertCircle,
  Map,
  FlaskConical,
  FileDown,
  ChevronDown,
  ChevronRight,
  Check
} from 'lucide-vue-next'
import type { Requirement, StateModelResult, StateTestCase } from '../types'

const props = defineProps<{
  requirements: Requirement[]
}>()

// ── 状态 ──
const isLoading = ref(false)
const errorMessage = ref('')
const result = ref<StateModelResult | null>(null)
const svgContent = ref('')
const activeTab = ref<'diagram' | 'cases' | 'export'>('diagram')
const expandedCases = ref<Record<string, boolean>>({})
const highlightPath = ref<string[]>([])

const requirementText = computed(() =>
  props.requirements.map((r) => `[${r.requirement_id}] ${r.original_text}`).join('\n\n')
)

// ── 分析 ──
async function analyze(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  result.value = null
  svgContent.value = ''

  try {
    const res = (await window.api.modelStates(requirementText.value)) as StateModelResult
    result.value = res

    const { instance } = await import('@viz-js/viz')
    const viz = await instance()
    svgContent.value = viz.renderString(res.dotSource, { format: 'svg' })
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

// ── 高亮路径 ──
async function highlightTestPath(tc: StateTestCase | null): Promise<void> {
  if (!result.value) return
  highlightPath.value = tc?.path ?? []

  const { instance } = await import('@viz-js/viz')
  const viz = await instance()

  if (!tc) {
    svgContent.value = viz.renderString(result.value.dotSource, { format: 'svg' })
    return
  }

  const highlightEdges = new Set<string>()
  for (let i = 0; i < tc.path.length - 1; i++) {
    highlightEdges.add(`${tc.path[i]}->${tc.path[i + 1]}`)
  }

  // 逐行处理，安全替换边属性
  const lines = result.value.dotSource.split('\n')
  const newLines = lines.map((line) => {
    const edgeMatch = line.match(/^(\s*)(\w+)\s*->\s*(\w+)(.*)/)
    if (!edgeMatch) return line
    const [, indent, from, to, rest] = edgeMatch
    const key = `${from}->${to}`
    if (!highlightEdges.has(key)) return line

    // 去掉原有的 color / penwidth，追加高亮
    let tail = rest
      .replace(/\bcolor\s*=\s*"[^"]*"/g, '')
      .replace(/\bpenwidth\s*=\s*[\d.]+/g, '')
      .trimEnd()
    // 处理尾部符号
    const trail = tail.match(/[;\]]\s*$/)?.[0] || ''
    tail = tail.slice(0, tail.length - trail.length).trim()
    const inner = tail ? tail.replace(/^\[/, '').replace(/\]$/, '') : ''
    const newTail = `[${inner}${inner ? ' ' : ''}color="#f97316" penwidth=2.5]${trail}`
    return `${indent}${from} -> ${to} ${newTail}`
  })
  const highlightedDot = newLines.join('\n')

  svgContent.value = viz.renderString(highlightedDot, { format: 'svg' })
}

// ── 折叠 ──
function toggleCase(id: string): void {
  expandedCases.value = {
    ...expandedCases.value,
    [id]: !expandedCases.value[id]
  }
}

// ── 导出 ──
async function exportJson(): Promise<void> {
  if (!result.value) return
  const suite = {
    test_suite: {
      suite_name: `[FR4.0] ${result.value.model.title} — State Transition Test Suite`,
      description: `Generated from ${result.value.coverage.totalStates} states, ${result.value.coverage.totalTransitions} transitions, ${result.value.testCases.length} test cases.`,
      test_cases: result.value.testCases
    }
  }
  await window.api.saveFile(JSON.stringify(suite, null, 2), 'test_suite_fr40.json')
}

// ── Badge ──
function criterionBadge(c: string): string {
  return c === 'All-States'
    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
}
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
    <!-- 错误 -->
    <div
      v-if="errorMessage"
      class="shrink-0 mx-4 mb-3 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-sm text-red-400"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      {{ errorMessage }}
    </div>

    <!-- Loading -->
    <Teleport to="body">
      <div
        v-if="isLoading"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 rounded-xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl"
        >
          <Loader2 class="w-8 h-8 text-blue-400 animate-spin" />
          <div class="text-center">
            <p class="text-sm font-medium text-zinc-200">Building State Model</p>
            <p class="text-xs text-zinc-500 mt-1">LLM is extracting states and transitions...</p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 空状态 / 生成按钮 -->
    <div
      v-if="!result && !isLoading"
      class="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-600"
    >
      <Map class="w-12 h-12 opacity-30" />
      <div class="text-center">
        <p class="text-sm font-medium text-zinc-400">State model not yet generated</p>
        <p class="text-xs text-zinc-600 mt-1 mb-4">
          Extract states and transitions from your requirements using LLM
        </p>
        <button
          class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 mx-auto transition-all shadow-lg shadow-blue-900/20"
          @click="analyze"
        >
          <Sparkles class="w-4 h-4" />
          Generate State Model
        </button>
      </div>
    </div>

    <!-- 结果 -->
    <template v-if="result">
      <!-- 指标 -->
      <div class="shrink-0 flex items-center gap-5 px-4 py-2.5 border-b border-zinc-800 text-xs">
        <span class="text-zinc-500"
          >States
          <span class="font-mono font-medium text-zinc-200 ml-1">{{
            result.coverage.totalStates
          }}</span></span
        >
        <span class="text-zinc-500"
          >Transitions
          <span class="font-mono font-medium text-zinc-200 ml-1">{{
            result.coverage.totalTransitions
          }}</span></span
        >
        <span class="text-blue-400/70"
          >All-States
          <span class="font-mono font-medium text-blue-400 ml-1">{{
            result.coverage.allStatesCases
          }}</span></span
        >
        <span class="text-purple-400/70"
          >All-Transitions
          <span class="font-mono font-medium text-purple-400 ml-1">{{
            result.coverage.allTransitionsCases
          }}</span></span
        >
        <button
          class="ml-auto flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          @click="analyze"
        >
          <Sparkles class="w-3.5 h-3.5" />
          Regenerate
        </button>
      </div>

      <!-- Tabs -->
      <div class="shrink-0 flex border-b border-zinc-800 px-4">
        <button
          v-for="tab in ['diagram', 'cases', 'export'] as const"
          :key="tab"
          class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === tab
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          "
          @click="activeTab = tab"
        >
          <Map v-if="tab === 'diagram'" class="w-3.5 h-3.5" />
          <FlaskConical v-if="tab === 'cases'" class="w-3.5 h-3.5" />
          <FileDown v-if="tab === 'export'" class="w-3.5 h-3.5" />
          {{ tab === 'diagram' ? 'Diagram' : tab === 'cases' ? 'Test Cases' : 'Export' }}
        </button>
      </div>

      <!-- Tab 内容 -->
      <div class="flex-1 min-h-0 flex flex-col">
        <!-- Diagram -->
        <div v-if="activeTab === 'diagram'" class="flex-1 min-h-0 flex overflow-hidden">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            class="flex-1 overflow-auto p-4 flex items-start justify-center"
            v-html="svgContent"
          ></div>
          <div
            class="w-64 shrink-0 border-l border-zinc-800 overflow-y-auto p-3 flex flex-col gap-1.5"
          >
            <p class="text-xs text-zinc-500 font-medium mb-1 px-1">Highlight Path</p>
            <button
              class="text-left text-xs px-3 py-1.5 rounded-md transition-colors"
              :class="
                highlightPath.length === 0
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:bg-zinc-800'
              "
              @click="highlightTestPath(null)"
            >
              None
            </button>
            <button
              v-for="tc in result.testCases"
              :key="tc.case_id"
              class="text-left text-xs px-3 py-1.5 rounded-md transition-colors"
              :class="
                highlightPath === tc.path
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:bg-zinc-800'
              "
              @click="highlightTestPath(tc)"
            >
              <span
                class="inline-block px-1.5 py-0.5 rounded text-[10px] mr-1"
                :class="criterionBadge(tc.criterion)"
              >
                {{ tc.criterion === 'All-States' ? 'AS' : 'AT' }}
              </span>
              {{ tc.case_id }}
            </button>
          </div>
        </div>

        <!-- Test Cases -->
        <div v-if="activeTab === 'cases'" class="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <div class="flex flex-col gap-2">
            <div
              v-for="tc in result.testCases"
              :key="tc.case_id"
              class="border border-zinc-800 rounded-lg overflow-hidden shrink-0"
            >
              <button
                class="w-full flex items-center gap-3 px-4 py-2.5 bg-zinc-900/60 hover:bg-zinc-900 transition-colors text-left"
                @click="toggleCase(tc.case_id)"
              >
                <component
                  :is="expandedCases[tc.case_id] ? ChevronDown : ChevronRight"
                  class="w-4 h-4 text-zinc-500 shrink-0"
                />
                <span
                  class="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                  :class="criterionBadge(tc.criterion)"
                >
                  {{ tc.criterion }}
                </span>
                <span class="text-xs font-mono text-zinc-500 shrink-0">{{ tc.case_id }}</span>
                <span class="text-sm text-zinc-300 truncate">{{ tc.title }}</span>
                <span class="ml-auto text-xs text-zinc-600 shrink-0"
                  >{{ tc.path.length - 1 }} steps</span
                >
              </button>

              <div
                v-if="expandedCases[tc.case_id]"
                class="px-4 py-3 border-t border-zinc-800 bg-zinc-950/40 space-y-3"
              >
                <div class="flex items-center gap-4 text-xs text-zinc-500">
                  <span
                    >Priority: <span class="text-amber-400">{{ tc.priority }}</span></span
                  >
                  <span
                    >Type: <span class="text-zinc-300">{{ tc.test_type }}</span></span
                  >
                  <span
                    >Risk:
                    <span class="text-zinc-300">{{ tc.risk_assessment.score }}/100</span></span
                  >
                </div>
                <div class="text-xs text-zinc-500">
                  Preconditions: <span class="text-zinc-300">{{ tc.preconditions }}</span>
                </div>

                <!-- Steps -->
                <div class="flex flex-col gap-1.5">
                  <div v-for="step in tc.steps" :key="step.step_id" class="flex gap-3 text-xs">
                    <span
                      class="shrink-0 w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-mono text-[10px]"
                    >
                      {{ step.step_id }}
                    </span>
                    <div class="flex-1 flex flex-col gap-0.5">
                      <span class="text-zinc-300">{{ step.action }}</span>
                      <span class="text-emerald-500/80 flex items-center gap-1">
                        <Check class="w-3 h-3 shrink-0" /> {{ step.expected_result }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Export -->
        <div
          v-if="activeTab === 'export'"
          class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-zinc-200">Export Test Suite JSON</p>
              <p class="text-xs text-zinc-500 mt-0.5">
                Format compatible with TMS — {{ result.testCases.length }} test cases
              </p>
            </div>
            <button
              class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              @click="exportJson"
            >
              <FileDown class="w-4 h-4" />
              Save JSON
            </button>
          </div>
          <pre
            class="flex-1 text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 overflow-auto leading-relaxed"
            >{{
              JSON.stringify(
                {
                  test_suite: {
                    suite_name: `[FR4.0] ${result.model.title}`,
                    description: `${result.coverage.totalStates} states, ${result.coverage.totalTransitions} transitions, ${result.testCases.length} cases`,
                    test_cases: result.testCases
                  }
                },
                null,
                2
              )
            }}</pre
          >
        </div>
      </div>
    </template>
  </div>
</template>
