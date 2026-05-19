import { describe, it, expect, beforeAll } from 'vitest'
import path from 'path'
import fs from 'fs/promises'
import { loadConfig, reloadConfig, getConfigSync, onConfigChange } from '../config'

const fixturePath = path.join(__dirname, 'fixtures', 'config.test.yml')

describe('config module', () => {
  beforeAll(async () => {
    await loadConfig(fixturePath)
  })

  it('should load config from fixture', () => {
    const config = getConfigSync()
    expect(config.llm.apiKey).toBe('test-api-key')
    expect(config.llm.model).toBe('test-model')
    expect(config.llm.baseURL).toBe('https://test.api.example.com')
    expect(config.llm.reasoningEffort).toBe('low')
  })

  it('should reload config without error', async () => {
    const config = await reloadConfig()
    expect(config.llm.apiKey).toBe('test-api-key')
  })

  it('should notify listener on config change', async () => {
    let notified = false
    const unsub = onConfigChange(() => {
      notified = true
    })

    // 写入临时变更内容以触发 change detection
    const original = await fs.readFile(fixturePath, 'utf8')
    await fs.writeFile(fixturePath, original.replace('test-api-key', 'changed-key'), 'utf8')
    try {
      await reloadConfig()
      expect(notified).toBe(true)
      expect(getConfigSync().llm.apiKey).toBe('changed-key')
    } finally {
      // 恢复原内容
      await fs.writeFile(fixturePath, original, 'utf8')
      await reloadConfig()
    }
    unsub()
  })

  it('should not notify after unsubscribe', async () => {
    let count = 0
    const unsub = onConfigChange(() => {
      count++
    })

    const original = await fs.readFile(fixturePath, 'utf8')
    await fs.writeFile(fixturePath, original.replace('test-api-key', 'unsub-key'), 'utf8')
    unsub()
    try {
      await reloadConfig()
      expect(count).toBe(0)
    } finally {
      await fs.writeFile(fixturePath, original, 'utf8')
      await reloadConfig()
    }
  })
})
