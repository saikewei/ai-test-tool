<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Loader2,
  Sparkles,
  FileDown,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  FolderTree,
  GitBranch,
  Wand,
  ArrowUpDown,
  X,
  Check,
  ArrowLeft
} from 'lucide-vue-next'
import { type Requirement, type GeneratedTestSuite, validateTestSuite } from '../types'
import Step4StateModel from './Step4StateModel.vue'

const props = defineProps<{ requirements: Requirement[] }>()
const emit = defineEmits<{ back: [] }>()

const activeTab = ref<'cases' | 'stateModel'>('cases')

const isGenerating = ref(false)
const errorMessage = ref('')
const testSuite = ref<GeneratedTestSuite | null>(null)
const expandedCases = ref<Record<string, boolean>>({})

// ---- 系统提示词 ----

const SYSTEM_PROMPT = `
You are an expert QA Automation Architect. Your task is to generate a comprehensive test suite in strict JSON format based on the reviewed requirements provided by the user.

### Instructions:
1. Analyze the input requirements (including their risk_assessment, coverage_items, and test_strategies).
2. Generate a test suite with a meaningful suite_name and description.
3. For each requirement, create test cases covering its coverage items. Each test case MUST reference the risk_assessment score and reason from the source requirement.
4. Generate test steps that are concrete, actionable, and verifiable. Each step must have a clear expected_result.
5. Use the test_strategies (method + proposed_test_points) to guide test case design. For example, if a strategy uses BVA with points [38.99, 39.00, 39.01], create boundary test cases using those exact values.
6. Prioritize test cases: High for critical boundary/error paths, Medium for validation logic, Low for edge cases.
7. Language Matching: Output language must match the input language.
8. Your response MUST be valid JSON only. No markdown, no comments.

### ID Generation Rules:
- case_id: "TC-" prefix + 3-digit zero-padded number starting from 001.
- step_id: sequential integer starting from 1 within each test case.

### JSON Schema & Example:
{
  "test_suite": {
    "suite_name": "Delivery Fee Calculation Tests",
    "description": "Tests focusing on the free delivery thresholds (R4.1)",
    "test_cases": [
      {
        "case_id": "TC-001",
        "title": "Validate delivery fee is applied when total is $38.99",
        "priority": "High",
        "risk_assessment": {
          "score": 85,
          "reason": "涉及核心费用免除逻辑，边界易错"
        },
        "preconditions": "User is logged in and cart is empty.",
        "test_type": "Boundary Value Analysis",
        "steps": [
          {
            "step_id": 1,
            "action": "Add items to cart totaling $38.99",
            "expected_result": "Cart subtotal is updated to $38.99 and delivery fee shows $5.00"
          },
          {
            "step_id": 2,
            "action": "Proceed to checkout page",
            "expected_result": "Final payment amount includes the $5.00 delivery fee"
          }
        ]
      }
    ]
  }
}
`

// ---- 调用 LLM 生成测试用例 ----

const handleGenerate = async (): Promise<void> => {
  isGenerating.value = true
  errorMessage.value = ''
  testSuite.value = null
  expandedCases.value = {}

  try {
    const userPrompt =
      'Based on the following reviewed requirements, generate a test suite in the required JSON format:\n\n' +
      JSON.stringify(props.requirements, null, 2)

    const response = await window.api.requestLlm(userPrompt, SYSTEM_PROMPT)

    let parsed: unknown
    try {
      parsed = JSON.parse(response)
    } catch {
      errorMessage.value = 'AI returned invalid JSON. Please try again.'
      return
    }

    const result = validateTestSuite(parsed)
    if (!result.valid) {
      errorMessage.value = `Validation failed: ${result.error}`
      console.error('Validation error:', result.error, 'Raw:', response)
      return
    }

    testSuite.value = parsed as GeneratedTestSuite
  } catch (err) {
    errorMessage.value = `Request failed: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    isGenerating.value = false
  }
}

// ---- 导出 ----

const handleExport = async (): Promise<void> => {
  if (!testSuite.value) return
  const json = JSON.stringify(testSuite.value, null, 2)
  const name = testSuite.value.test_suite.suite_name.replace(/\s+/g, '_') + '.json'
  await window.api.saveFile(json, name)
}

// ---- Oracle Generation ----

const oracleLoading = ref<Record<string, boolean>>({})
const testDataInputs = ref<Record<string, string>>({})
const oracleResults = ref<Record<string, string>>({})

const ORACLE_PROMPT = `
You are an expert QA tester. Your task is to synthesize the expected result for a specific test case, given concrete test input data provided by the user.

You will receive:
1. The original requirement context
2. A test case (title, preconditions, test_type, steps with actions)
3. Specific test data values (e.g. input field values) provided by the user

Based on the requirement logic and the given test inputs, determine what the correct/expected outcome should be. Consider edge cases, business rules, and validation logic from the requirements. Output a clear, verifiable expected result.

Output ONLY a plain text expected result description. No JSON, no markdown.
`

async function generateOracle(caseId: string): Promise<void> {
  if (!testSuite.value) return
  const tc = testSuite.value.test_suite.test_cases.find((c) => c.case_id === caseId)
  if (!tc) return
  const testData = testDataInputs.value[caseId]?.trim()
  if (!testData) return

  oracleLoading.value = { ...oracleLoading.value, [caseId]: true }
  oracleResults.value = { ...oracleResults.value, [caseId]: '' }
  try {
    const context = props.requirements
      .map((r) => `[${r.requirement_id}] ${r.original_text}`)
      .join('\n')
    const userPrompt = [
      '### Requirement Context',
      context,
      '',
      '### Test Case',
      `Title: ${tc.title}`,
      `Preconditions: ${tc.preconditions}`,
      `Type: ${tc.test_type}`,
      '',
      '### Steps',
      ...tc.steps.map((s) => `${s.step_id}. ${s.action}`),
      '',
      '### Test Data (user-provided)',
      testData,
      '',
      'Based on the above, what is the expected result?'
    ].join('\n')

    const response = await window.api.requestLlm(userPrompt, ORACLE_PROMPT, false)
    oracleResults.value = { ...oracleResults.value, [caseId]: response.trim() }
  } catch (err) {
    console.error('Oracle generation failed:', err)
    oracleResults.value = {
      ...oracleResults.value,
      [caseId]: 'Generation failed. Please try again.'
    }
  } finally {
    oracleLoading.value = { ...oracleLoading.value, [caseId]: false }
  }
}

// ---- Suite Optimization ----

const isOptimizing = ref(false)
const showOptimizeModal = ref(false)
const optimizeResult = ref<GeneratedTestSuite | null>(null)

const OPTIMIZE_PROMPT = `
You are a test architect optimizing a test suite for maximum coverage efficiency. You receive:
- The original requirements (with coverage_items and test_strategies per requirement)
- The generated test suite to optimize

Your task:

1. **Coverage Mapping**: For each test case, identify which coverage item(s) and test strategy it targets.

2. **Risk Prioritization**: Reorder test cases by risk (High > Medium > Low, then risk score descending within each tier).

3. **Redundancy Detection**: Flag test cases that cover the SAME coverage item with substantially similar inputs and expected outcomes. Mark duplicates with "redundant": true and "redundant_reason" explaining which coverage point is duplicated and by which other case_id.

4. **Coverage Gap Check**: If any coverage item from the requirements has NO test case targeting it, note this in the suite description field.

5. **Merge Suggestions**: If two or more test cases could be combined into one more efficient case (covering multiple coverage points in a single flow), mark the secondary ones as redundant and suggest the merged case_id.

Output ONLY valid JSON with the same structure as input (test_suite with suite_name, description, test_cases). All original test cases MUST be present (just reordered + marked). No markdown.
`

async function handleOptimize(): Promise<void> {
  if (!testSuite.value) return
  isOptimizing.value = true
  showOptimizeModal.value = true
  optimizeResult.value = null

  try {
    const requirementsJson = JSON.stringify(props.requirements, null, 2)
    const suiteJson = JSON.stringify(testSuite.value, null, 2)
    const userPrompt = `Requirements:\n${requirementsJson}\n\nTest Suite to optimize:\n${suiteJson}`
    const response = await window.api.requestLlm(userPrompt, OPTIMIZE_PROMPT, false)

    let parsed: unknown
    try {
      parsed = JSON.parse(response)
    } catch {
      console.error('Optimize: invalid JSON')
      return
    }

    const result = validateTestSuite(parsed)
    if (result.valid) {
      optimizeResult.value = parsed as GeneratedTestSuite
    }
  } catch (err) {
    console.error('Optimization failed:', err)
  } finally {
    isOptimizing.value = false
  }
}

function applyOptimization(): void {
  if (!optimizeResult.value) return
  // 过滤掉标记为 redundant 的用例
  const filtered = optimizeResult.value.test_suite.test_cases.filter((tc) => !tc.redundant)
  testSuite.value = {
    test_suite: {
      ...optimizeResult.value.test_suite,
      test_cases: filtered
    }
  }
  showOptimizeModal.value = false
  optimizeResult.value = null
}

function cancelOptimization(): void {
  showOptimizeModal.value = false
  optimizeResult.value = null
}

async function exportOptimized(): Promise<void> {
  if (!optimizeResult.value) return
  const json = JSON.stringify(optimizeResult.value, null, 2)
  await window.api.saveFile(json, 'optimized_suite.json')
}

// ---- 折叠 ----

const toggleCase = (caseId: string): void => {
  expandedCases.value = {
    ...expandedCases.value,
    [caseId]: !expandedCases.value[caseId]
  }
}

// ---- 统计 ----

const priorityCounts = computed(() => {
  if (!testSuite.value) return { High: 0, Medium: 0, Low: 0 }
  const counts = { High: 0, Medium: 0, Low: 0 }
  for (const tc of testSuite.value.test_suite.test_cases) {
    if (tc.priority in counts) counts[tc.priority as keyof typeof counts]++
  }
  return counts
})

const totalCases = computed(() => testSuite.value?.test_suite.test_cases.length ?? 0)

// ---- Badge ----

const priorityBadgeClass = (p: string): string => {
  switch (p) {
    case 'High':
      return 'bg-red-500/10 text-red-400 border border-red-500/20'
    case 'Medium':
      return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
    case 'Low':
      return 'bg-green-500/10 text-green-400 border border-green-500/20'
    default:
      return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
  }
}
</script>

<template>
  <div class="h-full w-full max-w-5xl mx-auto p-8 flex flex-col gap-4 min-h-0">
    <!-- 标题 + Tab 栏 -->
    <div class="flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <button
          class="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Back to Review"
          @click="emit('back')"
        >
          <ArrowLeft class="w-4 h-4" />
          Back
        </button>
        <h1 class="text-2xl font-semibold text-zinc-100">Generate</h1>
      </div>
      <div class="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
        <button
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="
            activeTab === 'cases'
              ? 'bg-zinc-700 text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-300'
          "
          @click="activeTab = 'cases'"
        >
          <FolderTree class="w-4 h-4" />
          Test Cases
        </button>
        <button
          class="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          :class="
            activeTab === 'stateModel'
              ? 'bg-zinc-700 text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-300'
          "
          @click="activeTab = 'stateModel'"
        >
          <GitBranch class="w-4 h-4" />
          State Modeling
        </button>
      </div>
    </div>

    <!-- Tab: Test Cases -->
    <template v-if="activeTab === 'cases'">
      <!-- 初始状态 -->
      <div
        v-if="!testSuite && !isGenerating && requirements.length > 0"
        class="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-600"
      >
        <FolderTree class="w-12 h-12 opacity-30" />
        <div class="text-center">
          <p class="text-sm font-medium text-zinc-400">Test cases not yet generated</p>
          <p class="text-xs text-zinc-600 mt-1 mb-4">
            Generate functional test cases from {{ requirements.length }} reviewed requirements
          </p>
          <button
            class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 mx-auto transition-all shadow-lg shadow-blue-900/20"
            @click="handleGenerate"
          >
            <Sparkles class="w-4 h-4" />
            Generate Test Cases
          </button>
        </div>
      </div>

      <!-- Loading Dialog -->
      <Teleport to="body">
        <div
          v-if="isGenerating"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div
            class="bg-zinc-900 border border-zinc-800 rounded-xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl"
          >
            <Loader2 class="w-8 h-8 text-blue-400 animate-spin" />
            <div class="text-center">
              <p class="text-sm font-medium text-zinc-200">Generating Test Cases</p>
              <p class="text-xs text-zinc-500 mt-1">
                AI is creating test cases from your requirements...
              </p>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Error -->
      <div
        v-if="errorMessage"
        class="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-sm text-red-400 shrink-0"
      >
        <AlertCircle class="w-4 h-4 shrink-0" />
        {{ errorMessage }}
      </div>

      <!-- 结果展示 -->
      <template v-if="testSuite">
        <!-- Suite 概览 + 操作 -->
        <div
          class="flex items-center justify-between shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg px-5 py-3"
        >
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-zinc-100 truncate">
              {{ testSuite.test_suite.suite_name }}
            </h2>

            <div class="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <span>{{ totalCases }} cases</span>
              <span class="flex items-center gap-1"
                ><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span
                >{{ priorityCounts.High }}</span
              >
              <span class="flex items-center gap-1"
                ><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span
                >{{ priorityCounts.Medium }}</span
              >
              <span class="flex items-center gap-1"
                ><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span
                >{{ priorityCounts.Low }}</span
              >
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              class="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-md transition-colors"
              @click="handleGenerate"
            >
              <RotateCcw class="w-3.5 h-3.5" />
              Regenerate
            </button>
            <button
              class="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-3 py-1.5 rounded-md transition-colors"
              @click="handleOptimize"
            >
              <ArrowUpDown class="w-3.5 h-3.5" />
              Optimize
            </button>
            <button
              class="flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-md transition-colors"
              @click="handleExport"
            >
              <FileDown class="w-3.5 h-3.5" />
              Export JSON
            </button>
          </div>
        </div>

        <!-- 用例列表 (可滚动) -->
        <div class="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 pr-0.5">
          <div
            v-for="tc in testSuite.test_suite.test_cases"
            :key="tc.case_id"
            class="border border-zinc-800 rounded-md bg-zinc-900/20 overflow-hidden shrink-0"
          >
            <!-- 用例头部 -->
            <div
              class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/30 transition-colors"
              @click="toggleCase(tc.case_id)"
            >
              <component
                :is="expandedCases[tc.case_id] ? ChevronDown : ChevronRight"
                class="w-3.5 h-3.5 text-zinc-500 shrink-0"
              />
              <span class="text-xs font-mono text-zinc-500 shrink-0">{{ tc.case_id }}</span>
              <span class="text-xs font-medium text-zinc-200 flex-1 truncate">{{ tc.title }}</span>
              <span class="text-[10px] text-zinc-600 shrink-0 hidden sm:block">{{
                tc.test_type
              }}</span>
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0"
                :class="priorityBadgeClass(tc.priority)"
              >
                {{ tc.priority }}
              </span>
            </div>

            <!-- 用例详情 -->
            <div
              v-if="expandedCases[tc.case_id]"
              class="border-t border-zinc-800 px-3 py-2.5 space-y-3"
            >
              <!-- 风险 + 前置条件 -->
              <div class="flex items-start gap-4 text-xs">
                <div class="flex-1">
                  <span class="text-zinc-500">Preconditions</span>
                  <p class="text-zinc-400 mt-0.5 leading-relaxed">{{ tc.preconditions }}</p>
                </div>
                <div class="w-40 shrink-0">
                  <span class="text-zinc-500">Risk</span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <div class="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        class="h-full"
                        :class="
                          tc.risk_assessment.score >= 70
                            ? 'bg-red-500'
                            : tc.risk_assessment.score >= 40
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        "
                        :style="{ width: `${Math.min(tc.risk_assessment.score, 100)}%` }"
                      ></div>
                    </div>
                    <span class="font-mono text-zinc-300 w-10 text-right">{{
                      tc.risk_assessment.score
                    }}</span>
                  </div>
                  <p class="text-zinc-500 mt-0.5 text-[11px]">{{ tc.risk_assessment.reason }}</p>
                </div>
              </div>

              <!-- 步骤表格 -->
              <table
                class="w-full text-left text-xs border border-zinc-800 rounded overflow-hidden"
              >
                <thead class="bg-zinc-900 text-zinc-500">
                  <tr>
                    <th class="px-2.5 py-1.5 font-medium w-10">#</th>
                    <th class="px-2.5 py-1.5 font-medium">Action</th>
                    <th class="px-2.5 py-1.5 font-medium">Expected Result</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/50 text-zinc-400">
                  <tr
                    v-for="step in tc.steps"
                    :key="step.step_id"
                    class="hover:bg-zinc-800/20 transition-colors"
                  >
                    <td class="px-2.5 py-1.5 text-zinc-500 font-mono align-top">
                      {{ step.step_id }}
                    </td>
                    <td class="px-2.5 py-1.5 whitespace-pre-wrap">{{ step.action }}</td>
                    <td class="px-2.5 py-1.5 whitespace-pre-wrap">{{ step.expected_result }}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Test Oracle -->
              <div class="border-t border-zinc-800/50 pt-3 space-y-2">
                <div class="flex items-center gap-1.5">
                  <Wand class="w-3.5 h-3.5 text-purple-400" />
                  <span class="text-xs font-medium text-zinc-400">Test Oracle</span>
                  <span class="text-[10px] text-zinc-600"
                    >— provide test data, get expected result</span
                  >
                </div>
                <textarea
                  v-model="testDataInputs[tc.case_id]"
                  class="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-300 font-mono resize-none outline-none focus:border-purple-500/50 transition-colors placeholder:text-zinc-700"
                  rows="3"
                  placeholder='Provide specific test data, e.g.:&#10;{ "username": "admin", "password": "P@ss123!", "age": 17 }'
                ></textarea>
                <div class="flex justify-between items-center">
                  <button
                    class="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                    :disabled="
                      oracleLoading[tc.case_id] || !(testDataInputs[tc.case_id] || '').trim()
                    "
                    @click.stop="generateOracle(tc.case_id)"
                  >
                    <Loader2 v-if="oracleLoading[tc.case_id]" class="w-3 h-3 animate-spin" />
                    <Wand v-else class="w-3 h-3" />
                    {{
                      oracleLoading[tc.case_id] ? 'Synthesizing...' : 'Synthesize Expected Result'
                    }}
                  </button>
                </div>
                <div
                  v-if="oracleResults[tc.case_id]"
                  class="bg-purple-500/5 border border-purple-500/20 rounded-md px-3 py-2 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap"
                >
                  {{ oracleResults[tc.case_id] }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div
        v-if="!testSuite && !isGenerating && requirements.length === 0"
        class="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-600"
      >
        <FolderTree class="w-12 h-12 opacity-30" />
        <p class="text-sm font-medium text-zinc-400">No requirements to generate test cases from</p>
      </div>
    </template>

    <!-- Optimize Modal -->
    <Teleport to="body">
      <div
        v-if="showOptimizeModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 rounded-xl w-[560px] max-h-[85vh] flex flex-col shadow-2xl"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0"
          >
            <div>
              <h3 class="text-sm font-semibold text-zinc-200">Suite Optimization</h3>
              <p class="text-xs text-zinc-500 mt-0.5">
                Risk-prioritized reorder & redundancy analysis
              </p>
            </div>
            <button
              class="text-zinc-500 hover:text-zinc-300 transition-colors"
              @click="cancelOptimization"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Loading -->
          <div v-if="isOptimizing" class="flex items-center justify-center py-16">
            <Loader2 class="w-5 h-5 text-amber-400 animate-spin" />
            <span class="ml-2 text-sm text-zinc-400">Analyzing suite...</span>
          </div>

          <!-- Results -->
          <div
            v-else-if="optimizeResult"
            class="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-xs"
          >
            <!-- Before/After -->
            <div class="flex items-center gap-4 bg-zinc-800/50 rounded-lg px-4 py-3">
              <div>
                <span class="text-zinc-500">Original</span>
                <span class="font-mono text-zinc-200 ml-2"
                  >{{ testSuite!.test_suite.test_cases.length }} cases</span
                >
              </div>
              <span class="text-zinc-600">→</span>
              <div>
                <span class="text-zinc-500">Optimized</span>
                <span class="font-mono text-amber-400 ml-2"
                  >{{
                    optimizeResult.test_suite.test_cases.filter((tc) => !tc.redundant).length
                  }}
                  cases</span
                >
                <span class="text-zinc-500 text-[10px] ml-1"
                  >({{ optimizeResult.test_suite.test_cases.length }} total)</span
                >
              </div>
              <div class="ml-auto">
                <span
                  v-if="optimizeResult.test_suite.test_cases.some((tc) => tc.redundant)"
                  class="text-green-400 text-xs"
                >
                  {{ optimizeResult.test_suite.test_cases.filter((tc) => tc.redundant).length }}
                  redundant marked
                </span>
                <span v-else class="text-zinc-500 text-xs">reordered only</span>
              </div>
            </div>

            <!-- Optimized List -->
            <div class="flex flex-col gap-1.5">
              <div
                v-for="(tc, idx) in optimizeResult.test_suite.test_cases"
                :key="tc.case_id"
                class="flex items-center gap-2 bg-zinc-800/30 rounded-md px-3 py-2"
              >
                <span class="text-zinc-600 font-mono w-6 text-right">{{ idx + 1 }}</span>
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0"
                  :class="priorityBadgeClass(tc.priority)"
                >
                  {{ tc.priority }}
                </span>
                <span class="text-xs text-zinc-300 truncate flex-1">{{ tc.title }}</span>
                <span class="text-zinc-500 font-mono text-[11px]"
                  >Risk {{ tc.risk_assessment.score }}</span
                >
                <span
                  v-if="tc.redundant"
                  class="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20"
                  :title="tc.redundant_reason"
                  >Redundant</span
                >
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-800 shrink-0"
          >
            <button
              class="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
              @click="cancelOptimization"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 text-xs text-white bg-amber-600 hover:bg-amber-500 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
              :disabled="!optimizeResult"
              @click="applyOptimization"
            >
              <Check class="w-3.5 h-3.5" />
              Apply Optimization
            </button>
            <button
              v-if="optimizeResult"
              class="px-4 py-2 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-md flex items-center gap-1.5 transition-colors"
              @click="exportOptimized"
            >
              <FileDown class="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Tab: State Modeling -->
    <Step4StateModel v-show="activeTab === 'stateModel'" :requirements="requirements" />
  </div>
</template>
