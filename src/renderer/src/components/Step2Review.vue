<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { ShieldAlert, Plus, X, Check, AlertTriangle } from 'lucide-vue-next'
import type { Requirement, TestStrategy } from '../types'

// ---- Step2Review 内部类型（在共享类型基础上扩展 _tagInput） ----

interface TestStrategyWithTag extends TestStrategy {
  _tagInput: string
}

interface RequirementWithTag extends Omit<Requirement, 'test_strategies'> {
  test_strategies: TestStrategyWithTag[]
}

interface RequirementOutput {
  requirement_id: string
  original_text: string
  risk_assessment: Requirement['risk_assessment']
  coverage_items: Requirement['coverage_items']
  test_strategies: TestStrategy[]
}

type PriorityFilter = 'All' | 'High' | 'Medium' | 'Low'

// ---- Props & Emits ----

const emit = defineEmits<{
  confirm: [data: RequirementOutput[]]
}>()

const props = defineProps<{ requirements: Requirement[] }>()

// ---- 初始化：为每个 strategy 补充 _tagInput ----

function initStrategies(strategies: TestStrategy[]): TestStrategyWithTag[] {
  return strategies.map((s) => ({ ...s, _tagInput: '' }))
}

const requirements = reactive<RequirementWithTag[]>(
  props.requirements.map((r) => ({
    ...r,
    coverage_items: [...r.coverage_items],
    test_strategies: initStrategies([...r.test_strategies])
  }))
)

// ---- ID 自增（跨所有需求） ----

const _allIds = (): number[] =>
  requirements.flatMap((r) => [
    ...r.coverage_items.map((c) => parseInt((c.id || '').split('_').pop() || '0', 10)),
    ...r.test_strategies.map((s) => parseInt((s.id || '').split('_').pop() || '0', 10))
  ])

let _idCounter = Math.max(0, ..._allIds())
const generateId = (prefix: string): string => `${prefix}_${String(++_idCounter).padStart(3, '0')}`

// ---- 选中状态 & 筛选 ----

const selectedId = ref(requirements[0]?.requirement_id || '')
const priorityFilter = ref<PriorityFilter>('All')

const filteredRequirements = computed(() => {
  if (priorityFilter.value === 'All') return requirements
  return requirements.filter((r) => r.risk_assessment.priority === priorityFilter.value)
})

const selectedReq = computed(() => requirements.find((r) => r.requirement_id === selectedId.value)!)

// ---- 确保选中项有效 ----

function selectReq(id: string): void {
  selectedId.value = id
}

// ---- Coverage Items ----

const addCoverageItem = (): void => {
  if (!selectedReq.value) return
  selectedReq.value.coverage_items.push({
    id: generateId('C'),
    name: '',
    valid_range: '',
    expected_action: ''
  })
}

// ---- Test Strategies ----

const addStrategy = (): void => {
  if (!selectedReq.value) return
  selectedReq.value.test_strategies.push({
    id: generateId('S'),
    target_item_id: selectedReq.value.coverage_items[0]?.id || '',
    method: 'Equivalence Partitioning (EP)',
    proposed_test_points: [],
    _tagInput: ''
  })
}

const handleTagKeydown = (strategy: TestStrategyWithTag): void => {
  const value = strategy._tagInput.trim()
  if (value && !strategy.proposed_test_points.includes(value)) {
    strategy.proposed_test_points.push(value)
    strategy._tagInput = ''
  }
}

const removeTag = (strategy: TestStrategyWithTag, point: string): void => {
  strategy.proposed_test_points = strategy.proposed_test_points.filter((p) => p !== point)
}

// ---- 提交 ----

const submitFinalState = (): void => {
  const output: RequirementOutput[] = requirements.map((r) => ({
    requirement_id: r.requirement_id,
    original_text: r.original_text,
    risk_assessment: { ...r.risk_assessment },
    coverage_items: [...r.coverage_items],
    test_strategies: r.test_strategies.map((s) => ({
      id: s.id,
      target_item_id: s.target_item_id,
      method: s.method,
      proposed_test_points: [...s.proposed_test_points]
    }))
  }))
  emit('confirm', JSON.parse(JSON.stringify(output)))
}

// ---- Badge 样式 ----

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
  <div class="h-full flex flex-row overflow-hidden">
    <!-- ====== 左侧侧边栏：Master List ====== -->
    <div class="w-[320px] shrink-0 border-r border-zinc-800 bg-zinc-950/80 flex flex-col">
      <!-- 筛选栏 -->
      <div class="p-4 border-b border-zinc-800">
        <label class="block text-xs text-zinc-500 mb-1.5">Filter by Priority</label>
        <select
          v-model="priorityFilter"
          class="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="All" class="bg-zinc-800">All Priorities</option>
          <option value="High" class="bg-zinc-800">High</option>
          <option value="Medium" class="bg-zinc-800">Medium</option>
          <option value="Low" class="bg-zinc-800">Low</option>
        </select>
      </div>

      <!-- 需求列表 -->
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="req in filteredRequirements"
          :key="req.requirement_id"
          class="px-4 py-3 border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          :class="
            selectedId === req.requirement_id
              ? 'bg-zinc-800/50 border-l-2 border-l-blue-500'
              : 'border-l-2 border-l-transparent'
          "
          @click="selectReq(req.requirement_id)"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-mono font-medium text-zinc-200">{{
              req.requirement_id
            }}</span>
            <span
              class="px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider"
              :class="priorityBadgeClass(req.risk_assessment.priority)"
            >
              {{ req.risk_assessment.priority }}
            </span>
          </div>
          <p class="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
            {{ req.original_text }}
          </p>
        </div>

        <div v-if="filteredRequirements.length === 0" class="p-4 text-center text-xs text-zinc-600">
          No requirements match the filter.
        </div>
      </div>
    </div>

    <!-- ====== 右侧主工作区：Detail View ====== -->
    <div class="flex-1 flex flex-col bg-zinc-950 min-w-0">
      <template v-if="selectedReq">
        <!-- 风险详情面板 -->
        <div class="p-5 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
          <div class="flex items-center gap-2 mb-3">
            <AlertTriangle class="w-4 h-4 text-zinc-400" />
            <h2 class="text-sm font-medium text-zinc-300">
              Risk Analysis — {{ selectedReq.requirement_id }}
            </h2>
            <span
              class="ml-auto px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider"
              :class="priorityBadgeClass(selectedReq.risk_assessment.priority)"
            >
              {{ selectedReq.risk_assessment.priority }} Priority
            </span>
          </div>

          <!-- 需求描述 -->
          <div
            class="text-sm text-zinc-400 leading-relaxed mb-4 bg-zinc-900/50 p-3 rounded-md border border-zinc-800/50"
          >
            {{ selectedReq.original_text }}
          </div>

          <!-- 风险评分 & 理由 -->
          <div class="flex items-start gap-6">
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs text-zinc-500">Risk Score</span>
                <span class="text-xs font-mono text-zinc-300"
                  >{{ selectedReq.risk_assessment.score }} / 100</span
                >
              </div>
              <div class="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  class="h-full transition-all"
                  :class="
                    selectedReq.risk_assessment.score >= 70
                      ? 'bg-red-500'
                      : selectedReq.risk_assessment.score >= 40
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  "
                  :style="{ width: `${Math.min(selectedReq.risk_assessment.score, 100)}%` }"
                ></div>
              </div>
            </div>
          </div>
          <p class="mt-3 text-xs text-zinc-500 leading-relaxed">
            <span class="text-zinc-400 font-medium">Rationale: </span>
            {{ selectedReq.risk_assessment.reason }}
          </p>
        </div>

        <!-- 可编辑表格区域 -->
        <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          <!-- Coverage Items 表格 -->
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

            <div
              class="border border-zinc-800 rounded-md overflow-hidden overflow-x-auto bg-zinc-900/20"
            >
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
                    v-for="item in selectedReq.coverage_items"
                    :key="item.id"
                    class="hover:bg-zinc-800/20 transition-colors"
                  >
                    <td class="px-4 py-2 text-zinc-500">{{ item.id }}</td>
                    <td class="px-4 py-2">
                      <input
                        v-model="item.name"
                        spellcheck="false"
                        class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none transition-all"
                      />
                    </td>
                    <td class="px-4 py-2">
                      <input
                        v-model="item.valid_range"
                        spellcheck="false"
                        class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none"
                      />
                    </td>
                    <td class="px-4 py-2">
                      <input
                        v-model="item.expected_action"
                        spellcheck="false"
                        class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Test Strategies 卡片 -->
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
                v-for="strategy in selectedReq.test_strategies"
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
                        v-for="cov in selectedReq.coverage_items"
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

                  <!-- Tag Input -->
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
                        spellcheck="false"
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
          class="h-16 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 shrink-0"
        >
          <span class="text-xs text-zinc-500">
            {{ requirements.length }} requirement(s) in review
          </span>
          <button
            class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
            @click="submitFinalState"
          >
            <Check class="w-4 h-4" />
            Confirm & Generate Test Cases
          </button>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else class="flex-1 flex items-center justify-center text-zinc-600">
        <div class="text-center">
          <ShieldAlert class="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p class="text-sm">No requirement selected.</p>
        </div>
      </div>
    </div>
  </div>
</template>
