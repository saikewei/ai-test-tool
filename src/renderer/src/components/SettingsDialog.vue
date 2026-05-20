<script setup lang="ts">
import { ref, reactive } from 'vue'
import { X, Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-vue-next'

const emit = defineEmits<{ close: [] }>()

const isLoading = ref(true)
const isSaving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const form = reactive({
  apiKey: '',
  model: '',
  baseURL: '',
  reasoningEffort: 'high' as string
})

// 打开时读取当前配置
async function load(): Promise<void> {
  isLoading.value = true
  try {
    const config = await window.api.readConfig()
    if (config) {
      form.apiKey = config.llm.apiKey || ''
      form.model = config.llm.model || ''
      form.baseURL = config.llm.baseURL || ''
      form.reasoningEffort = config.llm.reasoningEffort || 'high'
    }
  } catch {
    // config 不存在时表单留空
  } finally {
    isLoading.value = false
  }
}

load()

async function handleSave(): Promise<void> {
  isSaving.value = true
  message.value = null
  try {
    await window.api.writeConfig({
      apiKey: form.apiKey,
      model: form.model,
      baseURL: form.baseURL,
      reasoningEffort: form.reasoningEffort
    })
    await window.api.reloadConfig()
    message.value = { type: 'success', text: 'Settings saved and reloaded.' }
  } catch (err) {
    message.value = {
      type: 'error',
      text: `Failed: ${err instanceof Error ? err.message : String(err)}`
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 class="text-sm font-semibold text-zinc-200">Settings</h2>
          <button class="text-zinc-500 hover:text-zinc-300 transition-colors" @click="emit('close')">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center py-16">
          <RefreshCw class="w-5 h-5 text-zinc-500 animate-spin" />
        </div>

        <!-- Form -->
        <div v-else class="px-5 py-4 space-y-4">
          <!-- apiKey -->
          <div>
            <label class="block text-xs text-zinc-500 mb-1">API Key</label>
            <input
              v-model="form.apiKey"
              type="password"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-300 font-mono outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-700"
              placeholder="sk-..."
            />
          </div>

          <!-- baseURL -->
          <div>
            <label class="block text-xs text-zinc-500 mb-1">Base URL</label>
            <input
              v-model="form.baseURL"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-300 font-mono outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-700"
              placeholder="https://api.deepseek.com"
            />
          </div>

          <!-- model -->
          <div>
            <label class="block text-xs text-zinc-500 mb-1">Model</label>
            <input
              v-model="form.model"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-300 font-mono outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-700"
              placeholder="deepseek-v4-flash"
            />
          </div>

          <!-- reasoningEffort -->
          <div>
            <label class="block text-xs text-zinc-500 mb-1">Reasoning Effort</label>
            <select
              v-model="form.reasoningEffort"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="high" class="bg-zinc-800">high</option>
              <option value="max" class="bg-zinc-800">max</option>
            </select>
          </div>

          <!-- Message -->
          <div
            v-if="message"
            class="flex items-center gap-2 rounded-md px-3 py-2 text-xs"
            :class="
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            "
          >
            <component :is="message.type === 'success' ? CheckCircle2 : AlertCircle" class="w-3.5 h-3.5 shrink-0" />
            {{ message.text }}
          </div>
        </div>

        <!-- Footer -->
        <div v-if="!isLoading" class="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-800">
          <button
            class="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
            :disabled="isSaving"
            @click="handleSave"
          >
            <Save class="w-3.5 h-3.5" />
            {{ isSaving ? 'Saving...' : 'Save & Reload' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
