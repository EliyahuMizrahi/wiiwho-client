/**
 * Phase 3 settings handlers — backed by settings/store.ts (plain JSON,
 * atomic write, D-04 schema).
 *
 * Preload surface is UNCHANGED from Phase 1:
 *   settings.get() → Promise<SettingsV1>
 *   settings.set(patch) → Promise<{ ok: boolean, settings: SettingsV1 }>
 *
 * logs:read-crash remains a stub here — Plan 03-10 replaces its body with
 * the sanitizeCrashReport-backed implementation. DO NOT TOUCH that handler
 * in this plan.
 *
 * Sources:
 *   .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-02-settings-store-PLAN.md
 * Requirements: LAUN-03 (RAM clamp), LAUN-04 (persists across restarts).
 */

import { ipcMain } from 'electron'
import { readSettings, writeSettings, type SettingsV1 } from '../settings/store'

/**
 * Merge semantics for `settings:set`:
 *   - Only `ramMb` (number) and `firstRunSeen` (boolean) fields on the patch
 *     are honored. Non-matching types fall through to the current value.
 *   - null/undefined patch → no-op merge (returns current settings).
 *   - The store re-clamps ramMb on every write; this layer clamps via
 *     writeSettings indirectly.
 */
function mergePatch(
  current: SettingsV1,
  patch: Partial<SettingsV1> | null | undefined
): SettingsV1 {
  const p = patch ?? {}
  return {
    version: 1,
    ramMb: typeof p.ramMb === 'number' ? p.ramMb : current.ramMb,
    firstRunSeen:
      typeof p.firstRunSeen === 'boolean' ? p.firstRunSeen : current.firstRunSeen
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async () => {
    return await readSettings()
  })

  ipcMain.handle(
    'settings:set',
    async (_event, patch: Partial<SettingsV1> | null | undefined) => {
      const current = await readSettings()
      const merged = mergePatch(current, patch)
      await writeSettings(merged) // writeSettings re-clamps ramMb.
      const fresh = await readSettings()
      return { ok: true, settings: fresh }
    }
  )

  // Phase 1 stub — leave untouched. Plan 03-10 replaces this body with the
  // sanitizeCrashReport-backed implementation.
  ipcMain.handle('logs:read-crash', async () => {
    console.log('[wiiwho] logs:read-crash (stub)')
    return { sanitizedBody: '' }
  })
}

/**
 * Test-only helper — deprecated no-op since state is now file-backed.
 *
 * Retained for API compatibility with Phase 1 test files that may still
 * import it. The new tests (Phase 3) mock `../paths::resolveSettingsFile`
 * to a per-test temp file, so there is no in-memory state to reset.
 */
export function __resetSettingsForTests(): void {
  // intentionally empty
}
