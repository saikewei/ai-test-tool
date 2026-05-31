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
  GitBranch
} from 'lucide-vue-next'
import { type Requirement, type GeneratedTestSuite, validateTestSuite } from '../types'
import Step4StateModel from './Step4StateModel.vue'

const props = defineProps<{ requirements: Requirement[] }>()

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
      <h1 class="text-2xl font-semibold text-zinc-100">Generate</h1>
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

    <!-- Tab: State Modeling -->
    <Step4StateModel v-show="activeTab === 'stateModel'" :requirements="requirements" />
  </div>
</template>
