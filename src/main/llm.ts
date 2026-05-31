import OpenAI from 'openai'
import { getConfig, onConfigChange } from './config'
import type { AppConfig } from './config'

const SYSTEM_PROMPT = '你是一个软件测试专家，协助我分析和测试软件。'

let openai: OpenAI | null = null
let model: string | null = null
let reasoningEffort: 'high' | 'max' | null = null
let thinkingEnabled = true

function buildClient(config: AppConfig): void {
  openai = new OpenAI({
    apiKey: config.llm.apiKey,
    baseURL: config.llm.baseURL
  })
  model = config.llm.model
  reasoningEffort = config.llm.reasoningEffort
  thinkingEnabled = config.llm.thinkingEnabled ?? true
}

onConfigChange((newConfig) => {
  buildClient(newConfig)
})

async function ensureClient(): Promise<void> {
  if (!openai) {
    await getConfig()
    if (!openai) {
      const { getConfigSync } = await import('./config')
      buildClient(getConfigSync())
    }
  }
}

async function requestLlm(
  userPrompt: string,
  systemPrompt: string = SYSTEM_PROMPT,
  returnJson: boolean = true
): Promise<string> {
  await ensureClient()

  // @ts-expect-error reasoning_effort('max') + thinking not fully in upstream types
  const completion = await openai!.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: model as string,
    thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
    ...(thinkingEnabled ? { reasoning_effort: reasoningEffort } : {}),
    response_format: returnJson ? { type: 'json_object' as const } : undefined,
    stream: false
  })

  return completion.choices[0].message.content || ''
}

export { requestLlm }
