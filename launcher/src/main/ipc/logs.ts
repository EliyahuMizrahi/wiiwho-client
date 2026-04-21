/**
 * logs:* handlers — fills the Phase 1 stub (logs:read-crash) and adds
 * the two new Plan 03-09 channels (logs:open-crash-folder + logs:list-crashes).
 *
 * D-19 delivery: Crash viewer's four actions map here:
 *   - Copy report       → CrashViewer uses its already-sanitized body (D-21)
 *   - Open crash folder → logs:open-crash-folder
 *   - Close             → renderer-only (useGameStore.resetToIdle)
 *   - Play again        → renderer-only (useGameStore.play)
 *
 * D-21 / COMP-05 invariant: the sanitizedBody returned by logs:read-crash
 * is what the renderer DISPLAYS and COPIES to clipboard — CrashViewer.tsx
 * does zero additional sanitization (a regression-guard grep in
 * CrashViewer.test.tsx forbids adding any). One main-side sanitizer
 * (sanitizeCrashReport from auth/redact.ts) drives both paths.
 *
 * Note on module ownership: the logs:read-crash channel USED to live as a
 * stub inside ipc/settings.ts. Plan 03-10 moves it here so the settings
 * module owns `settings:*` exclusively and the logs module owns `logs:*`.
 */

import { ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import log from 'electron-log/main'
import { sanitizeCrashReport } from '../auth/redact'
import { readCrashReport, listCrashReports } from '../monitor/crashReport'
import { resolveCrashReportsDir } from '../paths'

export function registerLogsHandlers(): void {
  ipcMain.handle('logs:read-crash', async (_event, opts?: { crashId?: string }) => {
    const dir = resolveCrashReportsDir()
    let filename: string | null = opts?.crashId ?? null
    if (!filename) {
      const list = await listCrashReports(dir)
      filename = list[0] ?? null
    }
    if (!filename) return { sanitizedBody: '' }
    try {
      const raw = await readCrashReport(dir, filename)
      // D-21: single-sanitizer invariant — this is THE redaction point
      // for the renderer-bound crash body.
      return { sanitizedBody: sanitizeCrashReport(raw) }
    } catch (err) {
      log.warn('[logs] read-crash failed', err)
      return { sanitizedBody: '' }
    }
  })

  ipcMain.handle(
    'logs:open-crash-folder',
    async (_event, opts?: { crashId?: string | null } | null) => {
      const dir = resolveCrashReportsDir()
      try {
        // Ensure the directory exists so Explorer/Finder doesn't error on
        // a fresh install that hasn't crashed yet.
        await fs.mkdir(dir, { recursive: true })
        // If the caller passed a specific crashId, reveal that file inside
        // the directory; otherwise open the directory itself. shell.show-
        // ItemInFolder highlights the target in the parent view on both
        // Windows Explorer and macOS Finder.
        const target = opts?.crashId ? path.join(dir, opts.crashId) : dir
        shell.showItemInFolder(target)
        return { ok: true as const }
      } catch (err) {
        log.warn('[logs] open-crash-folder failed', err)
        return { ok: false as const }
      }
    }
  )

  ipcMain.handle('logs:list-crashes', async () => {
    const dir = resolveCrashReportsDir()
    const crashes = await listCrashReports(dir)
    return { crashes: crashes.map((crashId) => ({ crashId })) }
  })
}
