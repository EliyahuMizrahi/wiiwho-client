import { ipcMain } from 'electron'

/**
 * Phase 1 stubs for the auth:* IPC surface.
 * Phase 2 replaces each handler body with the real MSAL device-code + XBL/XSTS chain.
 * The CHANNEL LIST is frozen — Phase 2 may not add new channels.
 */
export function registerAuthHandlers(): void {
  ipcMain.handle('auth:status', async () => {
    console.log('[wiiwho] auth:status (stub)')
    return { loggedIn: false }
  })

  ipcMain.handle('auth:login', async () => {
    console.log('[wiiwho] auth:login (stub — Phase 2 implements)')
    return { ok: false, error: 'Phase 1 scaffold — auth not implemented' }
  })

  ipcMain.handle('auth:logout', async () => {
    console.log('[wiiwho] auth:logout (stub)')
    return { ok: true }
  })
}
