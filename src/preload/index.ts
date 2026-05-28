import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  ping: (): Promise<void> => ipcRenderer.invoke('ping'),
  requestLlm: (userPrompt: string, systemPrompt?: string, returnJson?: boolean): Promise<string> =>
    ipcRenderer.invoke('request-llm', userPrompt, systemPrompt, returnJson),
  saveFile: (content: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('save-file', content, defaultName),
  modelStates: (requirementText: string): Promise<unknown> =>
    ipcRenderer.invoke('model-states', requirementText),
  readConfig: (): Promise<{
    llm: { apiKey: string; model: string; baseURL: string; reasoningEffort: string }
  } | null> => ipcRenderer.invoke('read-config'),
  writeConfig: (data: {
    apiKey: string
    model: string
    baseURL: string
    reasoningEffort: string
  }): Promise<void> => ipcRenderer.invoke('write-config', data),
  reloadConfig: (): Promise<void> => ipcRenderer.invoke('reload-config')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
