/**
 * Spotify IPC handler bodies (Plan 04-05 Task 4).
 *
 * Thin pass-through to the SpotifyManager singleton. The registration is
 * NOT auto-invoked at module-load — Plan 04-07 wires `registerSpotifyHandlers`
 * into main/index.ts alongside the existing auth/game/settings/logs handlers.
 *
 * Channel surface (matches launcher/src/preload/index.ts spotify block):
 *   spotify:connect            → manager.connect()
 *   spotify:disconnect         → manager.disconnect()
 *   spotify:status             → manager.status()
 *   spotify:control:play       → manager.play()
 *   spotify:control:pause      → manager.pause()
 *   spotify:control:next       → manager.next()
 *   spotify:control:previous   → manager.previous()
 *   spotify:set-visibility     → manager.setVisibility(arg)
 *
 * Push events:
 *   spotify:status-changed     ← forwarded from manager 'status-changed' event
 */

import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { getSpotifyManager } from '../spotify/spotifyManager'

export function registerSpotifyHandlers(
  getPrimaryWindow: () => BrowserWindow | null
): void {
  const manager = getSpotifyManager()

  ipcMain.handle('spotify:connect', async () => manager.connect())
  ipcMain.handle('spotify:disconnect', async () => manager.disconnect())
  ipcMain.handle('spotify:status', async () => manager.status())
  ipcMain.handle('spotify:control:play', async () => manager.play())
  ipcMain.handle('spotify:control:pause', async () => manager.pause())
  ipcMain.handle('spotify:control:next', async () => manager.next())
  ipcMain.handle('spotify:control:previous', async () => manager.previous())
  ipcMain.handle(
    'spotify:set-visibility',
    async (_event, v: 'focused' | 'backgrounded') => {
      manager.setVisibility(v)
      return { ok: true }
    }
  )

  // Forward manager status-changed events to the renderer. Null window is
  // a normal transient state (mac dock close/reopen) — swallow quietly.
  manager.on('status-changed', (payload) => {
    try {
      const win = getPrimaryWindow()
      if (!win) return
      win.webContents.send('spotify:status-changed', payload)
    } catch (e) {
      log.warn('[spotify-ipc] forwarding status-changed failed', e)
    }
  })
}
