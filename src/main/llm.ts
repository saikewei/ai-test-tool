import OpenAI from 'openai'
import { getConfig, onConfigChange } from './config'
import type { AppConfig } from './config'

const SYSTEM_PROMPT = '你是一个软件测试专家，协助我分析和测试软件。'

let openai: OpenAI | null = null
let model: string | null = null
let reasoningEffort: 'high' | 'max' | null = null

function buildClient(config: AppConfig): void {
  openai = new OpenAI({
    apiKey: config.llm.apiKey,
    baseURL: config.llm.baseURL
  })
  model = config.llm.model
  reasoningEffort = config.llm.reasoningEffort
}

onConfigChange((newConfig) => {
  buildClient(newConfig)
})

async function ensureClient(): Promise<void> {
  if (!openai) {
    await getConfig()
    // onConfigChange already fired synchronously during loadConfig,
    // so openai is now set. If not (listener threw?), build explicitly.
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

  const completion = await openai!.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: model as string,
    thinking: { type: 'enabled' },
    // @ts-ignore openai typings are outdated and don't include max reasoningEffort
    reasoning_effort: reasoningEffort,
    response_format: returnJson ? { type: 'json_object' } : undefined,
    stream: false
  })

  return completion.choices[0].message.content || ''
}

export { requestLlm }
