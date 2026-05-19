<script setup lang="ts">
import { reactive } from 'vue'
import { ShieldAlert, Plus, X, Check } from 'lucide-vue-next'

// ---- 类型定义 ----

interface RiskAssessment {
  score: number
  priority: 'Low' | 'Medium' | 'High'
}

interface CoverageItem {
  id: string
  name: string
  valid_range: string
  expected_action: string
}

interface TestStrategy {
  id: string
  target_item_id: string
  method: string
  proposed_test_points: string[]
  _tagInput: string
}

interface ReviewData {
  requirement_id: string
  original_text: string
  risk_assessment: RiskAssessment
  coverage_items: CoverageItem[]
  test_strategies: TestStrategy[]
}

/** 提交输出的 TestStrategy，不含内部 _tagInput */
interface TestStrategyOutput {
  id: string
  target_item_id: string
  method: string
  proposed_test_points: string[]
}

interface ReviewDataOutput {
  requirement_id: string
  original_text: string
  risk_assessment: RiskAssessment
  coverage_items: CoverageItem[]
  test_strategies: TestStrategyOutput[]
}

// ---- Props & Emits ----

const emit = defineEmits<{
  confirm: [data: ReviewDataOutput]
}>()

const { initialData } = defineProps<{ initialData: ReviewData | null }>()

// ---- 状态初始化 ----

function initStrategies(raw: TestStrategy[]): TestStrategy[] {
  return raw.map((s) => ({ ...s, _tagInput: '' }))
}

const state = reactive<ReviewData>({
  requirement_id: initialData?.requirement_id || 'R-Unknown',
  original_text: initialData?.original_text || '',
  risk_assessment: initialData?.risk_assessment || { score: 0, priority: 'Low' },
  coverage_items: initialData?.coverage_items ? [...initialData.coverage_items] : [],
  test_strategies: initialData?.test_strategies
    ? initStrategies([...initialData.test_strategies])
    : []
})

// ---- ID 自增 ----

const _maxExistingId = (): number => {
  const ids = [...(initialData?.coverage_items || []), ...(initialData?.test_strategies || [])].map(
    (it) => parseInt((it.id || '').split('_').pop() || '0', 10)
  )
  return ids.length ? Math.max(...ids) : 0
}

let _idCounter = _maxExistingId()
const generateId = (prefix: string): string => `${prefix}_${String(++_idCounter).padStart(3, '0')}`

// ---- Coverage Items ----

const addCoverageItem = (): void => {
  state.coverage_items.push({
    id: generateId('C'),
    name: '',
    valid_range: '',
    expected_action: ''
  })
}

// ---- Test Strategies ----

const addStrategy = (): void => {
  state.test_strategies.push({
    id: generateId('S'),
    target_item_id: state.coverage_items[0]?.id || '',
    method: 'Equivalence Partitioning (EP)',
    proposed_test_points: [],
    _tagInput: ''
  })
}

const handleTagKeydown = (strategy: TestStrategy): void => {
  const value = strategy._tagInput.trim()
  if (value && !strategy.proposed_test_points.includes(value)) {
    strategy.proposed_test_points.push(value)
    strategy._tagInput = ''
  }
}

const removeTag = (strategy: TestStrategy, point: string): void => {
  strategy.proposed_test_points = strategy.proposed_test_points.filter((p) => p !== point)
}

// ---- 提交 ----

const submitFinalState = (): void => {
  // 提交前剥离 _tagInput 内部字段
  const output: ReviewDataOutput = {
    requirement_id: state.requirement_id,
    original_text: state.original_text,
    risk_assessment: { ...state.risk_assessment },
    coverage_items: [...state.coverage_items],
    test_strategies: state.test_strategies.map((s) => ({
      id: s.id,
      target_item_id: s.target_item_id,
      method: s.method,
      proposed_test_points: [...s.proposed_test_points]
    }))
  }
  emit('confirm', JSON.parse(JSON.stringify(output)))
}
</script>

<template>
  <div class="h-full flex flex-row overflow-hidden">
    <!-- 左侧分栏 (只读区) -->
    <div class="w-1/3 min-w-[350px] border-r border-zinc-800 bg-zinc-950/80 flex flex-col">
      <!-- 风险看板 -->
      <div class="p-5 border-b border-zinc-800 bg-zinc-900/30">
        <div class="flex items-center gap-2 mb-4">
          <ShieldAlert class="w-4 h-4 text-zinc-400" />
          <h2 class="text-sm font-medium text-zinc-300">Risk Assessment</h2>
          <span class="ml-auto text-xs font-mono text-zinc-500">{{ state.requirement_id }}</span>
        </div>

        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-zinc-500">AI Risk Score</span>
          <span class="text-xs font-mono text-zinc-300"
            >{{ state.risk_assessment.score }} / 10</span
          >
        </div>
        <div class="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-4">
          <div
            class="h-full"
            :class="
              state.risk_assessment.score >= 8
                ? 'bg-red-500'
                : state.risk_assessment.score >= 5
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            "
            :style="{ width: `${(state.risk_assessment.score / 10) * 100}%` }"
          ></div>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-xs text-zinc-500">Priority Level</span>
          <span
            class="px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider"
            :class="{
              'bg-red-500/10 text-red-400 border border-red-500/20':
                state.risk_assessment.priority === 'High',
              'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20':
                state.risk_assessment.priority === 'Medium',
              'bg-green-500/10 text-green-400 border border-green-500/20':
                state.risk_assessment.priority === 'Low'
            }"
          >
            {{ state.risk_assessment.priority }}
          </span>
        </div>
      </div>

      <!-- 原始需求展示 -->
      <div class="p-5 flex-1 overflow-y-auto">
        <h2 class="text-sm font-medium text-zinc-300 mb-3">Original Requirement</h2>
        <div
          class="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans bg-zinc-900/50 p-4 rounded-md border border-zinc-800/50"
        >
          {{ state.original_text }}
        </div>
      </div>
    </div>

    <!-- 右侧分栏 (编辑区) -->
    <div class="w-2/3 flex flex-col bg-zinc-950">
      <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
        <!-- 表格 1: Coverage Items -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-zinc-200">Coverage Items</h2>
            <button
              class="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              @click="addCoverageItem"
            >
              <Plus class="w-3 h-3" /> Add Item
            </button>
          </div>

          <div class="border border-zinc-800 rounded-md overflow-hidden bg-zinc-900/20">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <thead
                class="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider"
              >
                <tr>
                  <th class="px-4 py-3 font-medium w-24">Item ID</th>
                  <th class="px-4 py-3 font-medium">Field Name</th>
                  <th class="px-4 py-3 font-medium">Valid Range</th>
                  <th class="px-4 py-3 font-medium">Expected Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/50 text-zinc-300 font-mono text-xs">
                <tr
                  v-for="item in state.coverage_items"
                  :key="item.id"
                  class="hover:bg-zinc-800/20 transition-colors"
                >
                  <td class="px-4 py-2 text-zinc-500">{{ item.id }}</td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.name"
                      class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none transition-all"
                    />
                  </td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.valid_range"
                      class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none"
                    />
                  </td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.expected_action"
                      class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 表格 2: Test Strategies -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-zinc-200">Test Strategies</h2>
            <button
              class="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              @click="addStrategy"
            >
              <Plus class="w-3 h-3" /> Add Strategy
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <div
              v-for="strategy in state.test_strategies"
              :key="strategy.id"
              class="border border-zinc-800 rounded-md p-4 bg-zinc-900/20 hover:border-zinc-700 transition-colors"
            >
              <div class="flex flex-wrap md:flex-nowrap gap-4 items-start">
                <div class="w-32 shrink-0">
                  <label class="block text-xs text-zinc-500 mb-1">Target Item ID</label>
                  <select
                    v-model="strategy.target_item_id"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-blue-400 outline-none focus:border-blue-500"
                  >
                    <option
                      v-for="cov in state.coverage_items"
                      :key="cov.id"
                      :value="cov.id"
                      class="bg-zinc-800"
                    >
                      {{ cov.id }}
                    </option>
                  </select>
                </div>

                <div class="w-48 shrink-0">
                  <label class="block text-xs text-zinc-500 mb-1">Method</label>
                  <select
                    v-model="strategy.method"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500"
                  >
                    <option value="Equivalence Partitioning (EP)" class="bg-zinc-800">
                      Equivalence Partitioning (EP)
                    </option>
                    <option value="Boundary Value Analysis (BVA)" class="bg-zinc-800">
                      Boundary Value Analysis (BVA)
                    </option>
                    <option value="Decision Table" class="bg-zinc-800">Decision Table</option>
                  </select>
                </div>

                <!-- Tag Input (绑定到 proposed_test_points) -->
                <div class="flex-1 min-w-[200px]">
                  <label class="block text-xs text-zinc-500 mb-1"
                    >Proposed Test Points (Press Enter)</label
                  >
                  <div
                    class="min-h-[30px] w-full bg-zinc-950 border border-zinc-800 focus-within:border-blue-500 rounded px-2 py-1 flex flex-wrap gap-1.5 items-center transition-colors"
                  >
                    <span
                      v-for="point in strategy.proposed_test_points"
                      :key="point"
                      class="bg-blue-900/40 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded text-xs font-mono flex items-center gap-1"
                    >
                      {{ point }}
                      <button
                        class="hover:text-red-400 transition-colors"
                        @click="removeTag(strategy, point)"
                      >
                        <X class="w-3 h-3" />
                      </button>
                    </span>
                    <input
                      v-model="strategy._tagInput"
                      class="flex-1 min-w-[60px] bg-transparent outline-none text-xs font-mono text-zinc-300 placeholder:text-zinc-700"
                      placeholder="Add point..."
                      @keydown.enter.prevent="handleTagKeydown(strategy)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 底部动作条 -->
      <div
        class="h-16 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end px-6 shrink-0"
      >
        <button
          class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
          @click="submitFinalState"
        >
          <Check class="w-4 h-4" />
          Confirm & Generate Test Cases
        </button>
      </div>
    </div>
  </div>
</template>
