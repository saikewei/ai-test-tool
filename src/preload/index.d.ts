import { ElectronAPI } from '@electron-toolkit/preload'

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
    }
  }
}
