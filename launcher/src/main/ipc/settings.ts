/**
 * Phase 3/4 settings handlers — backed by settings/store.ts (plain JSON,
 * atomic write, D-04 + D-18 schema).
 *
 * Preload surface (D-11 frozen top-level keys — Phase 4 bumps v1 → v2):
 *   settings.get() → Promise<SettingsV2>
 *   settings.set(patch) → Promise<{ ok: boolean, settings: SettingsV2 }>
 *
 * logs:read-crash USED to live here as a Phase 1 stub. Plan 03-10 moved
 * the real handler into ipc/logs.ts (sanitizeCrashReport-backed). The
 * settings module owns `settings:*` exclusively.
 *
 * Sources:
 *   .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-02-settings-store-PLAN.md
 *   .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-10-orchestrator-logs-app-PLAN.md
 *   .planning/phases/04-launcher-ui-polish/04-01-tokens-and-settings-PLAN.md
 * Requirements: LAUN-03 (RAM clamp), LAUN-04 (persists across restarts),
 *   UI-01 (accent persists), UI-03 (reduced-motion override persists).
 */

import { ipcMain } from 'electron'
import { readSettings, writeSettings, type SettingsPatch } from '../settings/store'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async () => {
    return await readSettings()
  })

  ipcMain.handle(
    'settings:set',
    async (_event, patch: SettingsPatch | null | undefined) => {
      // writeSettings re-reads current, merges patch with per-field
      // validation (clamp ramMb, validate accent hex, validate reduceMotion),
      // persists atomically, and returns the fresh snapshot.
      const fresh = await writeSettings(patch ?? {})
      return { ok: true, settings: fresh }
    }
  )

  // NOTE: logs:read-crash used to be registered here as a Phase 1 stub.
  // Plan 03-10 moved the real handler into ipc/logs.ts. Do NOT re-add a
  // handler here — duplicate ipcMain.handle calls for the same channel
  // throw at registration time.
}

/**
 * Test-only helper — deprecated no-op since state is now file-backed.
 *
 * Retained for API compatibility with Phase 1 test files that may still
 * import it. The new tests (Phase 3/4) mock `../paths::resolveSettingsFile`
 * to a per-test temp file, so there is no in-memory state to reset.
 */
export function __resetSettingsForTests(): void {
  // intentionally empty
}
