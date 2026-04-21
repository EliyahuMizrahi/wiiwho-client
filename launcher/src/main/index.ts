import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAuthHandlers } from './ipc/auth'
import { registerGameHandlers } from './ipc/game'
import { registerSettingsHandlers } from './ipc/settings'
import { registerSecurityHandlers, setAuditedPrefs } from './ipc/security'
import { installRedactor } from './auth/redact'
import { getAuthManager } from './auth/AuthManager'

let mainWindowRef: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  const webPreferences = {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  } as const

  // Capture the exact webPreferences we pass to BrowserWindow; this is the
  // source of truth the __security:audit IPC handler reports against.
  setAuditedPrefs(webPreferences)

  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    title: 'Wiiwho Client',
    webPreferences
  })

  mainWindowRef = mainWindow

  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) mainWindowRef = null
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // D-02 / Pitfall 7: resolve silent refresh BEFORE the renderer mounts,
  // so the renderer's first auth:status call returns the resolved state
  // without a login→play-forward flicker.
  try {
    await getAuthManager().trySilentRefresh()
  } catch {
    // trySilentRefresh never throws in practice (D-03), but belt-and-suspenders.
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Install log redactor FIRST so nothing downstream can leak tokens into logs.
  installRedactor()

  electronApp.setAppUserModelId('club.wiiwho.launcher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAuthHandlers(() => mainWindowRef)
  registerGameHandlers()
  registerSettingsHandlers()
  registerSecurityHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
