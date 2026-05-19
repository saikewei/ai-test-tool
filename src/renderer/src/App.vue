<script setup lang="ts">
import { ref } from 'vue'
import { Terminal, CheckCircle2, FileText, ChevronRight } from 'lucide-vue-next'
import Step1Ingest from './components/Step1Ingest.vue'
import Step2Review from './components/Step2Review.vue'
import type { Requirement } from './types'

// 全局步骤状态
const currentStep = ref(1)

const steps = [
  { id: 1, name: 'Ingest', icon: FileText },
  { id: 2, name: 'Review & Edit', icon: Terminal },
  { id: 3, name: 'Generate', icon: CheckCircle2 }
]

// 从 Step 1 传递到 Step 2 的需求数组
const requirementsList = ref<Requirement[]>([])

// 步骤一完成回调
const handleAnalysisComplete = (data: Requirement[]): void => {
  requirementsList.value = data
  currentStep.value = 2
}

// 步骤二完成回调
const handleReviewComplete = (finalData: Requirement[]): void => {
  console.log('Final reviewed requirements:', finalData)
  // TODO: 调用后端生成测试用例的 API
  currentStep.value = 3
}
</script>

<template>
  <div class="flex flex-col h-screen w-full">
    <!-- Navbar (Global) -->
    <header class="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 shrink-0">
      <div class="flex items-center gap-2 text-zinc-300 font-medium">
        <Terminal class="w-5 h-5 text-blue-500" />
        <span>AI Copilot <span class="text-zinc-600 font-normal">for Testing</span></span>
      </div>
      <div class="ml-auto text-xs text-zinc-500 font-mono">v1.0.0-beta</div>
    </header>

    <!-- Global Stepper -->
    <div
      class="h-14 border-b border-zinc-900 bg-zinc-950/50 flex items-center justify-center px-6 shrink-0"
    >
      <div class="flex items-center gap-4">
        <template v-for="(step, index) in steps" :key="step.id">
          <div
            class="flex items-center gap-2"
            :class="currentStep >= step.id ? 'text-blue-400' : 'text-zinc-600'"
          >
            <component :is="step.icon" class="w-4 h-4" />
            <span class="text-sm font-medium tracking-wide">{{ step.name }}</span>
          </div>
          <ChevronRight v-if="index < steps.length - 1" class="w-4 h-4 text-zinc-700" />
        </template>
      </div>
    </div>

    <!-- Main Workspace (Dynamic View) -->
    <main class="flex-1 overflow-hidden relative">
      <Step1Ingest v-if="currentStep === 1" @analyze="handleAnalysisComplete" />
      <Step2Review
        v-if="currentStep === 2"
        :requirements="requirementsList"
        @confirm="handleReviewComplete"
      />

      <!-- Placeholder for Step 3 -->
      <div v-if="currentStep === 3" class="h-full flex items-center justify-center text-zinc-500">
        <div class="text-center">
          <CheckCircle2 class="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 class="text-xl text-zinc-300">Test Cases Generated</h2>
          <p class="mt-2 text-sm">Export to your TMS or CI/CD pipeline.</p>
        </div>
      </div>
    </main>
  </div>
</template>
