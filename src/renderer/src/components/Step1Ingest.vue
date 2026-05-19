<script setup lang="ts">
import { ref } from 'vue'
import { UploadCloud, Loader2, Sparkles } from 'lucide-vue-next'

const emit = defineEmits(['analyze'])
const prdText = ref('')
const isAnalyzing = ref(false)

const handleAnalyze = () => {
  if (!prdText.value.trim()) return

  isAnalyzing.value = true

  // TODO: 这里替换为调用 Electron/后端 AI 服务的真实 API
  setTimeout(() => {
    isAnalyzing.value = false
    // 模拟后端返回的数据结构
    const mockAiResponse = {
      originalText: prdText.value,
      risk: { score: 8.5, priority: 'High' },
      coverageItems: [
        { id: 'COV-001', field: 'user_age', type: 'int', valid: '18-65', invalid: '<18, >65' },
        {
          id: 'COV-002',
          field: 'transaction_amt',
          type: 'float',
          valid: '0.01-10000.00',
          invalid: '<=0, >10000'
        }
      ],
      strategies: [
        { id: 'ST-001', coverageId: 'COV-001', method: 'BVA', points: ['17', '18', '65', '66'] }
      ]
    }
    emit('analyze', mockAiResponse)
  }, 2000) // 模拟 2 秒延迟
}
</script>

<template>
  <div class="h-full w-full max-w-4xl mx-auto p-8 flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold text-zinc-100">Ingest Requirements</h1>
      <p class="text-zinc-500 text-sm">Paste your PRD, User Story, or acceptance criteria below.</p>
    </div>

    <!-- Textarea -->
    <div class="flex-1 flex flex-col min-h-[300px]">
      <textarea
        v-model="prdText"
        class="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-300 font-sans text-sm resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
        placeholder="Example: As a user, I want to transfer money. The transaction amount must be greater than $0 and up to $10,000. Users under 18 cannot perform transfers..."
      ></textarea>
    </div>

    <!-- Dropzone -->
    <div
      class="h-32 border-2 border-dashed border-zinc-800 rounded-lg bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900 transition-colors cursor-pointer group"
    >
      <UploadCloud class="w-6 h-6 mb-2 group-hover:text-blue-400 transition-colors" />
      <span class="text-sm">Drag & drop files here</span>
      <span class="text-xs text-zinc-600 mt-1">Supports .txt, .csv, .md</span>
    </div>

    <!-- CTA -->
    <div class="flex justify-end pt-4">
      <button
        class="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 transition-all"
        :disabled="isAnalyzing || !prdText.trim()"
        @click="handleAnalyze"
      >
        <Loader2 v-if="isAnalyzing" class="w-4 h-4 animate-spin" />
        <Sparkles v-else class="w-4 h-4" />
        {{ isAnalyzing ? 'Analyzing with AI...' : 'Analyze Requirements' }}
      </button>
    </div>
  </div>
</template>
