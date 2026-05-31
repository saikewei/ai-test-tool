import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadConfig, getConfigSync, reloadConfig, saveConfig } from './config'
import type { LlmConfig } from './config'
import icon from '../../resources/icon.png?asset'

app.commandLine.appendSwitch('disable-gpu-sandbox')
app.setName('TestWise')

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 750,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    titleBarStyle: 'hidden',
    titleBarOverlay:
      process.platform !== 'darwin'
        ? { color: '#09090b', symbolColor: '#a1a1aa', height: 36 }
        : undefined,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  try {
    await loadConfig()
  } catch {
    console.warn('config.yaml not found or invalid — app will start without LLM config')
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.testwise.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC
  ipcMain.handle('ping', () => console.log('pong'))
  ipcMain.handle(
    'request-llm',
    async (_, userPrompt: string, systemPrompt?: string, returnJson?: boolean) => {
      try {
        const { requestLlm } = await import('./llm')
        return await requestLlm(userPrompt, systemPrompt, returnJson)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('ENOENT') || msg.includes('config')) {
          throw new Error(
            'Config file not found. Please open Settings (gear icon) to configure your LLM connection.'
          )
        }
        if (
          msg.includes('401') ||
          msg.includes('Unauthorized') ||
          msg.includes('Incorrect API key')
        ) {
          throw new Error('Authentication failed. Please check your API Key in Settings.')
        }
        if (
          msg.includes('ECONNREFUSED') ||
          msg.includes('ENOTFOUND') ||
          msg.includes('fetch failed') ||
          msg.includes('getaddrinfo')
        ) {
          throw new Error('Cannot reach the LLM service. Please check your Base URL in Settings.')
        }
        throw err
      }
    }
  )

  ipcMain.handle('save-file', async (_, content: string, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, content, 'utf-8')
    return true
  })
  ipcMain.handle('model-states', async (_, requirementText: string) => {
    const { buildStateModel } = await import('./stateModel')
    return await buildStateModel(requirementText)
  })
  ipcMain.handle('read-config', async () => {
    try {
      return getConfigSync()
    } catch {
      // config.yaml 不存在时返回 null
      const { getConfig } = await import('./config')
      try {
        return await getConfig()
      } catch {
        return null
      }
    }
  })

  ipcMain.handle('write-config', async (_, data: LlmConfig) => {
    await saveConfig({ llm: data })
  })

  ipcMain.handle('reload-config', async () => {
    await reloadConfig()
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
