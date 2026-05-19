<script setup lang="ts">
import { ref } from 'vue'
import { UploadCloud, Loader2, Sparkles, AlertCircle } from 'lucide-vue-next'
import { type Requirement, validateRequirements } from '../types'

const emit = defineEmits<{
  analyze: [data: Requirement[]]
}>()

const prdText = ref('')
const isAnalyzing = ref(false)
const errorMessage = ref('')
const SYSTEM_PROMPT = `
You are an expert QA Automation Architect and Software Testing Assistant. Your task is to analyze software requirements provided by the user and extract core testing metadata into a strict, predefined JSON format.

### Instructions:
1. You must parse the input text and generate an array of requirement objects.
2. For each requirement, conduct a Risk Assessment (assign a score 0-100, a Priority of "High", "Medium", or "Low", and provide a brief reason).
3. Extract the Coverage Items (input fields, variables) and define their valid ranges and expected actions.
4. Propose Test Strategies (e.g., Boundary Value Analysis (BVA), Equivalence Partitioning (EP), Decision Tables) targeting specific Coverage Items, and provide concrete proposed test points.
5. Language Matching Directive: You MUST detect the language of the input requirements provided by the user. The values in your JSON output (especially textual fields like "reason") must strictly match the language of the user's input. For example, if the input is in English, output English; if the input is in Chinese, output Chinese.
6. Your response MUST be valid JSON only. Do not include any explanatory text, markdown formatting or comments.
7. ID Generation Rules (CRITICAL — follow these EXACT formats):
   - requirement_id: Use "R{section}.{item}" format (e.g., "R1.1", "R4.2"). Preserve original section numbers from the input if present; otherwise auto-number starting from R1.1.
   - coverage_items[].id: Use "C_" prefix followed by a 3-digit zero-padded sequential number, starting from 001, globally unique across ALL requirements (e.g., first coverage item across all requirements is "C_001", second is "C_002", never reuse).
   - test_strategies[].id: Use "S_" prefix followed by a 3-digit zero-padded sequential number, starting from 001, globally unique across ALL requirements (e.g., "S_001", "S_002").
   - test_strategies[].target_item_id: Must exactly match an existing coverage_items[].id.
   - DO NOT use descriptive IDs like "COV-LOGIN-01" or long UUIDs. Always use the short format shown above.

### JSON Schema & Example:
You must strictly follow the data structure shown in the example below:

[
  {
    "requirement_id": "R4.1",
    "original_text": "Orders with a total item price >= $39 qualify for free delivery. The delivery fee must be waived automatically when the condition is met.",
    "risk_assessment": {
      "score": 85,
      "priority": "High",
      "reason": "Involves core fee waiver logic; boundary calculation errors can easily lead to direct financial loss."
    },
    "coverage_items": [
      {
        "id": "C_001",
        "name": "total_item_price",
        "valid_range": ">= 39.00",
        "expected_action": "delivery_fee = 0"
      }
    ],
    "test_strategies": [
      {
        "id": "S_001",
        "target_item_id": "C_001",
        "method": "Boundary Value Analysis (BVA)",
        "proposed_test_points": [
          "38.99",
          "39.00",
          "39.01"
        ]
      }
    ]
  },
  {
    "requirement_id": "R1.3",
    "original_text": "Coupons are restricted strictly to Drinks or Fruits categories.",
    "risk_assessment": {
      "score": 45,
      "priority": "Medium",
      "reason": "Routine category validation with limited impact."
    },
    "coverage_items": [
      {
        "id": "C_002",
        "name": "category",
        "valid_range": "in ['Drinks', 'Fruits']",
        "expected_action": "coupon_applied = true"
      }
    ],
    "test_strategies": [
      {
        "id": "S_002",
        "target_item_id": "C_002",
        "method": "Equivalence Partitioning (EP)",
        "proposed_test_points": [
          "Drinks",
          "Fruits",
          "Snacks"
        ]
      }
    ]
  }
]
`

const USER_PROMPT = `Please analyze the following software requirements and output the testing metadata in the required JSON array format: \n`

const handleAnalyze = async (): Promise<void> => {
  if (!prdText.value.trim()) return

  isAnalyzing.value = true
  errorMessage.value = ''

  try {
    const analysis = await window.api.requestLlm(USER_PROMPT + prdText.value, SYSTEM_PROMPT)

    let parsed: unknown
    try {
      parsed = JSON.parse(analysis)
    } catch {
      errorMessage.value = 'AI returned invalid JSON. Please try again.'
      return
    }

    const result = validateRequirements(parsed)
    if (!result.valid) {
      errorMessage.value = `AI response validation failed: ${result.error}`
      console.error('Validation error:', result.error, 'Raw response:', analysis)
      return
    }

    emit('analyze', result.data!)
  } catch (err) {
    errorMessage.value = `Request failed: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    isAnalyzing.value = false
  }
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

    <!-- Loading Dialog -->
    <Teleport to="body">
      <div
        v-if="isAnalyzing"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <div
          class="bg-zinc-900 border border-zinc-800 rounded-xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl"
        >
          <Loader2 class="w-8 h-8 text-blue-400 animate-spin" />
          <div class="text-center">
            <p class="text-sm font-medium text-zinc-200">Analyzing Requirements</p>
            <p class="text-xs text-zinc-500 mt-1">AI is parsing and assessing your input...</p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Dropzone -->
    <div
      class="h-32 border-2 border-dashed border-zinc-800 rounded-lg bg-zinc-900/50 flex flex-col items-center justify-center text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900 transition-colors cursor-pointer group"
    >
      <UploadCloud class="w-6 h-6 mb-2 group-hover:text-blue-400 transition-colors" />
      <span class="text-sm">Drag & drop files here</span>
      <span class="text-xs text-zinc-600 mt-1">Supports .txt, .csv, .md</span>
    </div>

    <!-- Error Message -->
    <div
      v-if="errorMessage"
      class="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-sm text-red-400"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      {{ errorMessage }}
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
