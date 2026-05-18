<script setup lang="ts">
import { ref } from 'vue'

// 测试 Vue 的响应式状态
const count = ref(0)
const increment = (): void => {
  count.value++
  window.api.ping()
}
</script>

<template>
  <div
    class="h-screen w-full flex items-center justify-center bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-cyan-500/30"
  >
    <div
      class="max-w-md w-full p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl shadow-black/50 flex flex-col items-center text-center"
    >
      <div
        class="size-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/20"
      >
        <svg class="size-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>

      <h1 class="text-3xl font-bold tracking-tight mb-2">
        Tailwind
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500"
          >v4</span
        >
        Ready
      </h1>

      <p class="text-zinc-400 text-sm mb-8 leading-relaxed">
        你的 Electron + Vue 3 + TypeScript 环境已经成功接入了下一代 Tailwind
        CSS。享受极致的编译速度和零配置开发体验吧！
      </p>

      <button
        class="w-full py-3 px-4 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer"
        @click="increment"
      >
        <span>点击测试 Vue 状态响应：</span>
        <span class="bg-zinc-300 px-2 py-0.5 rounded-md font-mono text-sm text-zinc-800">
          {{ count }}
        </span>
      </button>
    </div>
  </div>
</template>

<style>
/* 在 Tailwind v4 中，通常不需要写自定义 CSS，但如果你需要全局覆盖，可以写在这里 */
</style>
