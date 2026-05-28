<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Loader2,
  Sparkles,
  AlertCircle,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Download,
  RotateCcw
} from 'lucide-vue-next'
import type { Requirement } from '../types'
import type { StateModelResult, StateTestCase } from '../../../main/stateModel'

const props = defineProps<{
  requirements: Requirement[]
}>()

const emit = defineEmits<{
  back: []
}>()

// ── 状态 ───────────────────────────────────────────────────
const isLoading = ref(false)
const errorMessage = ref('')
const result = ref<StateModelResult | null>(null)
const svgContent = ref('')
const activeTab = ref<'diagram' | 'cases' | 'export'>('diagram')
const expandedCases = ref<Set<string>>(new Set())
const highlightPath = ref<string[]>([])

// 把需求拼成文本传给 LLM
const requirementText = computed(() =>
  props.requirements
    .map((r) => `[${r.requirement_id}] ${r.original_text}`)
    .join('\n\n')
)

// ── 分析 ───────────────────────────────────────────────────
async function analyze(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  result.value = null
  svgContent.value = ''

  try {
    const res = await window.api.modelStates(requirementText.value)
    result.value = res

    // 用 viz.js 渲染 DOT → SVG
    const { instance } = await import('@viz-js/viz')
    const viz = await instance()
    svgContent.value = viz.renderString(res.dotSource, { format: 'svg' })
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

// ── 高亮路径：重新渲染带颜色的 SVG ─────────────────────────
async function highlightTestPath(tc: StateTestCase | null): Promise<void> {
  if (!result.value) return
  highlightPath.value = tc?.path ?? []

  const { instance } = await import('@viz-js/viz')
  const viz = await instance()

  if (!tc) {
    svgContent.value = viz.renderString(result.value.dotSource, { format: 'svg' })
    return
  }

  // 在 DOT 中为高亮边加颜色
  const highlightEdges = new Set<string>()
  for (let i = 0; i < tc.path.length - 1; i++) {
    highlightEdges.add(`${tc.path[i]}->${tc.path[i + 1]}`)
  }

  const highlightedDot = result.value.dotSource.replace(
    /(\S+)\s*->\s*(\S+)\s*\[([^\]]*)\]/g,
    (match, from, to, attrs) => {
      const key = `${from}->${to}`
      if (highlightEdges.has(key)) {
        return `${from} -> ${to} [${attrs} color="#f97316" penwidth=2.5]`
      }
      return match
    }
  )

  svgContent.value = viz.renderString(highlightedDot, { format: 'svg' })
}

// ── 展开/折叠测试用例 ───────────────────────────────────────
function toggleCase(id: string): void {
  if (expandedCases.value.has(id)) {
    expandedCases.value.delete(id)
  } else {
    expandedCases.value.add(id)
  }
}

// ── 导出 JSON ──────────────────────────────────────────────
async function exportJson(): Promise<void> {
  if (!result.value) return
  const suite = {
    test_suite: {
      suite_name: `[FR4.0] ${result.value.model.title} — 状态转换测试套件`,
      description: `基于 ISO 29119-4 状态转换测试自动生成。共 ${result.value.coverage.totalStates} 个状态，${result.value.coverage.totalTransitions} 条转换，${result.value.testCases.length} 条测试序列。`,
      test_cases: result.value.testCases
    }
  }
  await window.api.saveFile(JSON.stringify(suite, null, 2), 'test_suite_fr40.json')
}

// ── 工具 ───────────────────────────────────────────────────
function criterionColor(c: string): string {
  return c === 'All-States' ? 'text-blue-400 bg-blue-500/10' : 'text-purple-400 bg-purple-500/10'
}
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <!-- 顶部操作栏 -->
    <div class="shrink-0 border-b border-zinc-800 bg-zinc-950/60 px-8 py-4 flex items-center gap-4">
      <div class="flex-1">
        <h1 class="text-xl font-semibold text-zinc-100 flex items-center gap-2">
          <GitBranch class="w-5 h-5 text-blue-400" />
          White-Box State Modeling
        </h1>
        <p class="text-xs text-zinc-500 mt-0.5">
          ISO 29119-4 · State Transition Testing · FR4.0
        </p>
      </div>

      <button
        class="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        @click="emit('back')"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        Back
      </button>

      <button
        class="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-5 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all"
        :disabled="isLoading"
        @click="analyze"
      >
        <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
        <Sparkles v-else class="w-4 h-4" />
        {{ isLoading ? 'Modeling...' : 'Generate State Model' }}
      </button>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="errorMessage"
      class="shrink-0 mx-8 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-sm text-red-400"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      {{ errorMessage }}
    </div>

    <!-- Loading 遮罩 -->
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

    <!-- 空状态 -->
    <div
      v-if="!result && !isLoading"
      class="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-600"
    >
      <GitBranch class="w-12 h-12 opacity-30" />
      <div class="text-center">
        <p class="text-sm font-medium text-zinc-400">State model not yet generated</p>
        <p class="text-xs text-zinc-600 mt-1">
          Click "Generate State Model" to extract states and transitions from your requirements
        </p>
      </div>
    </div>

    <!-- 结果区域 -->
    <div v-if="result" class="flex-1 flex flex-col overflow-hidden">
      <!-- 覆盖度指标 -->
      <div class="shrink-0 px-8 py-3 flex items-center gap-6 border-b border-zinc-900">
        <div class="flex items-center gap-2 text-xs">
          <span class="text-zinc-500">States</span>
          <span class="font-mono font-medium text-zinc-200">{{ result.coverage.totalStates }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-zinc-500">Transitions</span>
          <span class="font-mono font-medium text-zinc-200">{{ result.coverage.totalTransitions }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-blue-400/70">All-States cases</span>
          <span class="font-mono font-medium text-blue-400">{{ result.coverage.allStatesCases }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-purple-400/70">All-Transitions cases</span>
          <span class="font-mono font-medium text-purple-400">{{ result.coverage.allTransitionsCases }}</span>
        </div>
        <div class="ml-auto text-xs text-zinc-600 font-mono">{{ result.model.title }}</div>
      </div>

      <!-- Tabs -->
      <div class="shrink-0 flex border-b border-zinc-800 px-8">
        <button
          v-for="tab in (['diagram', 'cases', 'export'] as const)"
          :key="tab"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize"
          :class="
            activeTab === tab
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          "
          @click="activeTab = tab"
        >
          {{ tab === 'diagram' ? '🗺 Diagram' : tab === 'cases' ? '🧪 Test Cases' : '📤 Export' }}
        </button>
      </div>

      <!-- Tab 内容 -->
      <div class="flex-1 overflow-hidden">

        <!-- Diagram Tab -->
        <div v-if="activeTab === 'diagram'" class="h-full flex gap-0 overflow-hidden">
          <!-- 左侧：状态图 -->
          <div class="flex-1 overflow-auto p-6 flex items-start justify-center" v-html="svgContent"></div>

          <!-- 右侧：高亮路径选择 -->
          <div class="w-64 shrink-0 border-l border-zinc-800 overflow-y-auto p-4 flex flex-col gap-2">
            <p class="text-xs text-zinc-500 font-medium mb-1">Highlight Test Path</p>
            <button
              class="text-left text-xs px-3 py-2 rounded-md transition-colors"
              :class="highlightPath.length === 0 ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:bg-zinc-800'"
              @click="highlightTestPath(null)"
            >
              None
            </button>
            <button
              v-for="tc in result.testCases"
              :key="tc.case_id"
              class="text-left text-xs px-3 py-2 rounded-md transition-colors leading-relaxed"
              :class="
                highlightPath === tc.path
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:bg-zinc-800'
              "
              @click="highlightTestPath(tc)"
            >
              <span
                class="inline-block px-1.5 py-0.5 rounded text-[10px] mr-1"
                :class="criterionColor(tc.criterion)"
              >{{ tc.criterion === 'All-States' ? 'AS' : 'AT' }}</span>
              {{ tc.case_id }}
            </button>
          </div>
        </div>

        <!-- Test Cases Tab -->
        <div v-if="activeTab === 'cases'" class="h-full overflow-y-auto px-8 py-4 flex flex-col gap-2">
          <div
            v-for="tc in result.testCases"
            :key="tc.case_id"
            class="border border-zinc-800 rounded-lg overflow-hidden"
          >
            <!-- 用例头 -->
            <button
              class="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/60 hover:bg-zinc-900 transition-colors text-left"
              @click="toggleCase(tc.case_id)"
            >
              <component
                :is="expandedCases.has(tc.case_id) ? ChevronDown : ChevronRight"
                class="w-4 h-4 text-zinc-500 shrink-0"
              />
              <span
                class="text-xs px-2 py-0.5 rounded font-medium shrink-0"
                :class="criterionColor(tc.criterion)"
              >{{ tc.criterion }}</span>
              <span class="text-xs font-mono text-zinc-500 shrink-0">{{ tc.case_id }}</span>
              <span class="text-sm text-zinc-300 truncate">{{ tc.title }}</span>
              <span class="ml-auto text-xs text-zinc-600 shrink-0">{{ tc.path.length - 1 }} transitions</span>
            </button>

            <!-- 用例详情 -->
            <div v-if="expandedCases.has(tc.case_id)" class="px-4 py-3 border-t border-zinc-800 bg-zinc-950/40 flex flex-col gap-3">
              <div class="flex items-center gap-4 text-xs text-zinc-500">
                <span>Priority: <span class="text-amber-400">{{ tc.priority }}</span></span>
                <span>Type: <span class="text-zinc-300">{{ tc.test_type }}</span></span>
              </div>
              <div class="text-xs text-zinc-500">
                Preconditions: <span class="text-zinc-300">{{ tc.preconditions }}</span>
              </div>
              <div class="text-xs text-zinc-500 leading-relaxed">
                Risk: <span class="text-zinc-300">{{ tc.risk_assessment.reason }}</span>
              </div>

              <!-- Steps -->
              <div class="flex flex-col gap-1.5 mt-1">
                <div
                  v-for="step in tc.steps"
                  :key="step.step_id"
                  class="flex gap-3 text-xs"
                >
                  <span class="shrink-0 w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-mono text-[10px]">
                    {{ step.step_id }}
                  </span>
                  <div class="flex-1 flex flex-col gap-0.5">
                    <span class="text-zinc-300">{{ step.action }}</span>
                    <span class="text-emerald-500/80">✔ {{ step.expected_result }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Export Tab -->
        <div v-if="activeTab === 'export'" class="h-full overflow-y-auto px-8 py-6 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-zinc-200">Export Test Suite JSON</p>
              <p class="text-xs text-zinc-500 mt-0.5">
                Format compatible with the existing TestSuite type — ready to import into TMS
              </p>
            </div>
            <button
              class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              @click="exportJson"
            >
              <Download class="w-4 h-4" />
              Save JSON
            </button>
          </div>

          <pre class="flex-1 text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 overflow-auto leading-relaxed">{{
            JSON.stringify(
              {
                test_suite: {
                  suite_name: `[FR4.0] ${result.model.title}`,
                  description: `${result.coverage.totalStates} states · ${result.coverage.totalTransitions} transitions · ${result.testCases.length} test cases`,
                  test_cases: result.testCases
                }
              },
              null,
              2
            )
          }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
