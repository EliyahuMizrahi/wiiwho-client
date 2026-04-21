/**
 * Auth IPC handler bodies (Phase 2 implementation).
 *
 * CHANNELS ARE FROZEN (from Phase 1 D-11). This file replaces stub bodies only;
 * it does NOT add channels or rename them. Channel names are lockstep with
 * `launcher/src/preload/index.ts` and `launcher/src/renderer/src/wiiwho.d.ts`.
 *
 * Wiring:
 *   - auth:status  → AuthManager.getStatus()
 *   - auth:login   → AuthManager.loginWithDeviceCode(primaryWindow)
 *                    On failure, AuthErrorView (including the __CANCELLED__
 *                    sentinel from the cancel branch) is JSON-stringified into
 *                    the frozen contract's `error?: string` field. The renderer
 *                    store deserializes and routes the sentinel to silent logout.
 *   - auth:logout  → AuthManager.logout() + AuthManager.cancelDeviceCode()
 *     (logout must also abort any in-flight login per D-15 / D-07 spirit)
 */

import { BrowserWindow, ipcMain } from 'electron'
import { getAuthManager } from '../auth/AuthManager'

export function registerAuthHandlers(
  getPrimaryWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('auth:status', async () => {
    const s = getAuthManager().getStatus()
    return s.loggedIn
      ? { loggedIn: true, username: s.username, uuid: s.uuid }
      : { loggedIn: false }
  })

  ipcMain.handle('auth:login', async () => {
    const win = getPrimaryWindow()
    if (!win) {
      return { ok: false, error: 'No active window — cannot sign in.' }
    }
    const res = await getAuthManager().loginWithDeviceCode(win)
    if (res.ok) {
      return { ok: true, username: res.username }
    }
    // Serialize AuthErrorView into the frozen-contract `error: string`.
    // This includes the __CANCELLED__ sentinel on the cancel branch —
    // the renderer store (Plan 04) parses it and short-circuits to
    // 'logged-out' without rendering a banner (UI-SPEC line 216).
    return {
      ok: false,
      error: JSON.stringify(res.error)
    }
  })

  ipcMain.handle('auth:logout', async () => {
    await getAuthManager().cancelDeviceCode()
    const res = await getAuthManager().logout()
    return res
  })
}
