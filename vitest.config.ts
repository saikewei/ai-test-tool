import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/main/__test__/**/*.test.ts'],
    environment: 'node'
  },
  resolve: {
    alias: {
      electron: path.resolve(__dirname, 'src/main/__test__/mocks/electron.ts')
    }
  }
})
