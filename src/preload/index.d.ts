import { ElectronAPI } from '@electron-toolkit/preload'

interface LlmConfigData {
  apiKey: string
  model: string
  baseURL: string
  reasoningEffort: string
}

interface AppConfigData {
  llm: LlmConfigData
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => Promise<void>
      requestLlm: (
        userPrompt: string,
        systemPrompt?: string,
        returnJson?: boolean
      ) => Promise<string>
      saveFile: (content: string, defaultName: string) => Promise<boolean>
      readConfig: () => Promise<AppConfigData | null>
      writeConfig: (data: LlmConfigData) => Promise<void>
      reloadConfig: () => Promise<void>
    }
  }
}
