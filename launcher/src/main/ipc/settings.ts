import { ipcMain } from 'electron'

/**
 * Phase 1 stubs for the settings:* IPC surface and logs:read-crash.
 * In-memory storage only — Phase 3 replaces with a file-backed store
 * under `app.getPath('userData')`.
 */
let inMemorySettings: Record<string, unknown> = {}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async () => {
    console.log('[wiiwho] settings:get (stub)')
    return { ...inMemorySettings }
  })

  ipcMain.handle(
    'settings:set',
    async (_event, patch: Record<string, unknown>) => {
      console.log('[wiiwho] settings:set (stub)', patch)
      inMemorySettings = { ...inMemorySettings, ...(patch ?? {}) }
      return { ok: true }
    }
  )

  ipcMain.handle('logs:read-crash', async () => {
    console.log('[wiiwho] logs:read-crash (stub)')
    return { sanitizedBody: '' }
  })
}

/** Test-only helper — resets in-memory settings between tests. */
export function __resetSettingsForTests(): void {
  inMemorySettings = {}
}
