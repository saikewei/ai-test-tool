import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import { app } from 'electron'

export interface LlmConfig {
  apiKey: string
  model: string
  baseURL: string
  reasoningEffort: 'high' | 'max'
}

export interface AppConfig {
  llm: LlmConfig
}

export type ConfigChangeListener = (newConfig: AppConfig) => void

let _config: AppConfig | null = null
let _configPath: string | null = null
const _listeners = new Set<ConfigChangeListener>()

function notify(newConfig: AppConfig): void {
  for (const fn of _listeners) {
    try {
      fn(newConfig)
    } catch (e) {
      console.error('Config listener error:', e)
    }
  }
}

export async function loadConfig(customPath?: string): Promise<AppConfig> {
  _configPath = customPath || path.join(app.getAppPath(), 'config.yaml')
  const raw = await fs.readFile(_configPath, 'utf8')
  const newConfig = yaml.load(raw) as AppConfig
  const changed = !_config || JSON.stringify(newConfig) !== JSON.stringify(_config)
  _config = newConfig
  if (changed) notify(_config)
  console.log('config loaded:', _configPath)
  return _config
}

export async function reloadConfig(): Promise<AppConfig> {
  if (!_configPath) {
    return loadConfig()
  }
  return loadConfig(_configPath)
}

export async function getConfig(): Promise<AppConfig> {
  if (!_config) {
    return loadConfig()
  }
  return _config
}

export function getConfigSync(): AppConfig {
  if (!_config) {
    throw new Error('Config not loaded. Call loadConfig() first.')
  }
  return _config
}

export function onConfigChange(listener: ConfigChangeListener): () => void {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  _configPath = _configPath || path.join(app.getAppPath(), 'config.yaml')
  const dir = path.dirname(_configPath)
  await fs.mkdir(dir, { recursive: true })
  const yamlStr = yaml.dump(config)
  await fs.writeFile(_configPath, yamlStr, 'utf8')
  _config = config
  notify(_config)
  console.log('config saved:', _configPath)
}
