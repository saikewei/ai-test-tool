<script setup lang="ts">
import { reactive } from 'vue'
import { Plus, ShieldAlert, Check, X } from 'lucide-vue-next'

const props = defineEmits(['confirm'])
const { initialData } = defineProps<{ initialData: any }>()

// 使用 reactive 包装数据，使其在双向绑定和内联编辑时具有响应性
const state = reactive({
  originalText: initialData?.originalText || '',
  risk: initialData?.risk || { score: 0, priority: 'Low' },
  coverageItems: initialData?.coverageItems ? [...initialData.coverageItems] : [],
  strategies: initialData?.strategies ? [...initialData.strategies] : []
})

// 辅助方法：生成唯一 ID
const generateId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 10000)}`

// 添加 Coverage Item
const addCoverageItem = () => {
  state.coverageItems.push({
    id: generateId('COV'),
    field: '',
    type: 'string',
    valid: '',
    invalid: ''
  })
}

// 添加 Strategy
const addStrategy = () => {
  state.strategies.push({
    id: generateId('ST'),
    coverageId: state.coverageItems[0]?.id || '',
    method: 'EP',
    points: []
  })
}

// Tag Input 处理逻辑
const handleTagKeydown = (event: KeyboardEvent, strategy: any) => {
  const input = event.target as HTMLInputElement
  const value = input.value.trim()
  if (value && !strategy.points.includes(value)) {
    strategy.points.push(value)
    input.value = ''
  }
}

const removeTag = (strategy: any, pointToRemove: string) => {
  strategy.points = strategy.points.filter((p: string) => p !== pointToRemove)
}

// 提交最终数据
const submitFinalState = () => {
  props('confirm', JSON.parse(JSON.stringify(state))) // 深度拷贝消除代理发送
}
</script>

<template>
  <div class="h-full flex flex-row overflow-hidden">
    <!-- 左侧分栏 (只读区): 原始需求与风险看板 -->
    <div class="w-[280px] shrink-0 border-r border-zinc-800 bg-zinc-950/80 flex flex-col">
      <!-- 风险看板 -->
      <div class="p-5 border-b border-zinc-800 bg-zinc-900/30">
        <div class="flex items-center gap-2 mb-4">
          <ShieldAlert class="w-4 h-4 text-zinc-400" />
          <h2 class="text-sm font-medium text-zinc-300">Risk Assessment</h2>
        </div>

        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-zinc-500">AI Risk Score</span>
          <span class="text-xs font-mono text-zinc-300">{{ state.risk.score }} / 10</span>
        </div>
        <!-- Progress Bar -->
        <div class="h-2 w-full bg-zinc-800 rounded-full overflow-hidden mb-4">
          <div
            class="h-full"
            :class="
              state.risk.score >= 8
                ? 'bg-red-500'
                : state.risk.score >= 5
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            "
            :style="{ width: `${(state.risk.score / 10) * 100}%` }"
          ></div>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-xs text-zinc-500">Priority Level</span>
          <!-- Badge -->
          <span
            class="px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider"
            :class="{
              'bg-red-500/10 text-red-400 border border-red-500/20': state.risk.priority === 'High',
              'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20':
                state.risk.priority === 'Medium',
              'bg-green-500/10 text-green-400 border border-green-500/20':
                state.risk.priority === 'Low'
            }"
          >
            {{ state.risk.priority }}
          </span>
        </div>
      </div>

      <!-- 原始需求展示 -->
      <div class="p-5 flex-1 overflow-y-auto">
        <h2 class="text-sm font-medium text-zinc-300 mb-3">Original Requirement</h2>
        <div
          class="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans bg-zinc-900/50 p-4 rounded-md border border-zinc-800/50"
        >
          {{ state.originalText }}
        </div>
      </div>
    </div>

    <!-- 右侧分栏 (编辑区): 覆盖项与策略工作台 -->
    <div class="flex-1 flex flex-col bg-zinc-950 min-w-0">
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

          <div
            class="border border-zinc-800 rounded-md overflow-hidden overflow-x-auto bg-zinc-900/20"
          >
            <table class="w-full text-left text-sm whitespace-nowrap">
              <thead
                class="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider"
              >
                <tr>
                  <th class="px-4 py-3 font-medium">Item ID</th>
                  <th class="px-4 py-3 font-medium">Field Name</th>
                  <th class="px-4 py-3 font-medium">Type</th>
                  <th class="px-4 py-3 font-medium">Valid Range</th>
                  <th class="px-4 py-3 font-medium">Invalid Range</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/50 text-zinc-300 font-mono text-xs">
                <tr
                  v-for="item in state.coverageItems"
                  :key="item.id"
                  class="hover:bg-zinc-800/20 transition-colors group"
                >
                  <td class="px-4 py-2 text-zinc-500">{{ item.id }}</td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.field"
                      class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none transition-all"
                    />
                  </td>
                  <td class="px-4 py-2">
                    <select
                      v-model="item.type"
                      class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-1 py-1 outline-none appearance-none cursor-pointer"
                    >
                      <option value="int" class="bg-zinc-800">int</option>
                      <option value="float" class="bg-zinc-800">float</option>
                      <option value="string" class="bg-zinc-800">string</option>
                    </select>
                  </td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.valid"
                      class="w-full bg-transparent border border-transparent hover:border-zinc-700 focus:border-blue-500 focus:bg-zinc-900 rounded px-2 py-1 outline-none"
                    />
                  </td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.invalid"
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
            <!-- 采用 Card 列表形态展示策略，更适合 Tag Input 的空间需求 -->
            <div
              v-for="strategy in state.strategies"
              :key="strategy.id"
              class="border border-zinc-800 rounded-md p-4 bg-zinc-900/20 hover:border-zinc-700 transition-colors"
            >
              <div class="flex flex-wrap md:flex-nowrap gap-4 items-start">
                <div class="w-32 shrink-0">
                  <label class="block text-xs text-zinc-500 mb-1">Ref Item</label>
                  <select
                    v-model="strategy.coverageId"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs font-mono text-blue-400 outline-none focus:border-blue-500"
                  >
                    <option
                      v-for="cov in state.coverageItems"
                      :key="cov.id"
                      :value="cov.id"
                      class="bg-zinc-800"
                    >
                      {{ cov.id }}
                    </option>
                  </select>
                </div>

                <div class="w-32 shrink-0">
                  <label class="block text-xs text-zinc-500 mb-1">Method</label>
                  <select
                    v-model="strategy.method"
                    class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-blue-500"
                  >
                    <option value="EP" class="bg-zinc-800">Eq. Part (EP)</option>
                    <option value="BVA" class="bg-zinc-800">Boundary (BVA)</option>
                    <option value="Decision Table" class="bg-zinc-800">Decision Tbl</option>
                  </select>
                </div>

                <!-- Tag Input 核心实现 -->
                <div class="flex-1 min-w-[200px]">
                  <label class="block text-xs text-zinc-500 mb-1"
                    >Test Points (Press Enter to add)</label
                  >
                  <div
                    class="min-h-[30px] w-full bg-zinc-950 border border-zinc-800 focus-within:border-blue-500 rounded px-2 py-1 flex flex-wrap gap-1.5 items-center transition-colors"
                  >
                    <span
                      v-for="point in strategy.points"
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
                      class="flex-1 min-w-[60px] bg-transparent outline-none text-xs font-mono text-zinc-300 placeholder:text-zinc-700"
                      placeholder="Add point..."
                      @keydown.enter.prevent="handleTagKeydown($event, strategy)"
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
