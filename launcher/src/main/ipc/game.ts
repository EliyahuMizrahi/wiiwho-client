import { ipcMain } from 'electron'

/**
 * Phase 1 stubs for the game:* IPC surface.
 * Phase 3 replaces each handler body with the real launch pipeline
 * (@xmcl/core + @xmcl/installer + execa).
 */
export function registerGameHandlers(): void {
  ipcMain.handle('game:play', async () => {
    console.log('[wiiwho] game:play (stub)')
    return {
      ok: true,
      stub: true,
      reason: 'Phase 1 scaffold — no launch implemented'
    }
  })

  ipcMain.handle('game:cancel', async () => {
    console.log('[wiiwho] game:cancel (stub)')
    return { ok: true, stub: true }
  })

  ipcMain.handle('game:status', async () => {
    console.log('[wiiwho] game:status (stub)')
    return { state: 'idle' as const }
  })
}
