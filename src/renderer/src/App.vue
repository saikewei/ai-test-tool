<script setup lang="ts">
import { ref } from 'vue'
import { Terminal, CheckCircle2, FileText, ChevronRight, House, Settings } from 'lucide-vue-next'
import Step1Ingest from './components/Step1Ingest.vue'
import Step2Review from './components/Step2Review.vue'
import Step3Generate from './components/Step3Generate.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import type { Requirement } from './types'

const isMac = navigator.platform.toLowerCase().includes('mac')
const showSettings = ref(false)

const currentStep = ref(1)

const steps = [
  { id: 1, name: 'Ingest', icon: FileText },
  { id: 2, name: 'Review & Edit', icon: Terminal },
  { id: 3, name: 'Generate', icon: CheckCircle2 }
]

const requirementsList = ref<Requirement[]>([])
const reviewedRequirements = ref<Requirement[]>([])

const handleAnalysisComplete = (data: Requirement[]): void => {
  requirementsList.value = data
  currentStep.value = 2
}

const handleReviewComplete = (finalData: Requirement[]): void => {
  reviewedRequirements.value = finalData
  currentStep.value = 3
}

const resetAll = (): void => {
  currentStep.value = 1
  requirementsList.value = []
  reviewedRequirements.value = []
}
</script>

<template>
  <div class="flex flex-col h-screen w-full">
    <!-- Navbar (Global) — draggable title bar -->
    <header
      class="h-9 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 shrink-0"
      :class="isMac ? 'pl-[90px]' : 'pr-[140px]'"
      style="-webkit-app-region: drag"
    >
      <div
        class="flex items-center gap-2 text-zinc-300 font-medium"
        style="-webkit-app-region: no-drag"
      >
        <Terminal class="w-5 h-5 text-blue-500" />
        <span>AI Copilot <span class="text-zinc-600 font-normal">for Testing</span></span>
      </div>
      <div class="ml-auto flex items-center gap-3" style="-webkit-app-region: no-drag">
        <button
          class="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Settings"
          @click="showSettings = true"
        >
          <Settings class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="currentStep > 1"
          class="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Back to start"
          @click="resetAll"
        >
          <House class="w-3.5 h-3.5" />
          Home
        </button>
        <span class="text-xs text-zinc-500 font-mono">v1.0.0-beta</span>
      </div>
    </header>

    <!-- Global Stepper -->
    <div
      class="h-14 border-b border-zinc-900 bg-zinc-950/50 flex items-center justify-center px-6 shrink-0"
      style="-webkit-app-region: drag"
    >
      <div class="flex items-center gap-4" style="-webkit-app-region: no-drag">
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
      <Step3Generate v-if="currentStep === 3" :requirements="reviewedRequirements" />
    </main>

    <SettingsDialog v-if="showSettings" @close="showSettings = false" />
  </div>
</template>
