---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 02
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - launcher/src/main/settings/store.ts
  - launcher/src/main/settings/store.test.ts
  - launcher/src/main/ipc/settings.ts
  - launcher/src/main/ipc/settings.test.ts
autonomous: true
requirements:
  - LAUN-03
  - LAUN-04
must_haves:
  truths:
    - "Settings persist across process restarts (writeSettings → process restart → readSettings round-trips the same value — LAUN-04)"
    - "ramMb is clamped to 1024-4096 in 512 MB steps on every write (no 16 GB on a 4 GB machine — Pitfall 10)"
    - "Unknown schema version falls back to safe defaults (forward-compat)"
    - "settings.json lives at `<userData>/settings.json` via atomic temp+rename (no half-written files on crash)"
  artifacts:
    - path: "launcher/src/main/settings/store.ts"
      provides: "readSettings, writeSettings, DEFAULTS, migrate, clampRam"
      exports: ["readSettings", "writeSettings", "DEFAULTS", "SettingsV1"]
    - path: "launcher/src/main/settings/store.test.ts"
      provides: "Round-trip + clamp + migrate + ENOENT-returns-defaults tests"
    - path: "launcher/src/main/ipc/settings.ts"
      provides: "settings:get + settings:set handler bodies backed by the store (replaces Phase 1 in-memory stub)"
  key_links:
    - from: "launcher/src/main/settings/store.ts"
      to: "launcher/src/main/paths.ts"
      via: "resolveSettingsFile() import"
      pattern: "resolveSettingsFile"
    - from: "launcher/src/main/ipc/settings.ts"
      to: "launcher/src/main/settings/store.ts"
      via: "readSettings + writeSettings imports"
      pattern: "from '.*settings/store'"
---

<objective>
Ship the v1 settings schema (`{ version: 1, ramMb: 2048, firstRunSeen: false }`) backed by a single plain-JSON file at `<userData>/settings.json`. Atomic writes via temp+rename. Clamp ramMb to 1024-4096 in 512 MB steps on every write. Replace the Phase 1 in-memory stub in `ipc/settings.ts` with real reads/writes through the store. This is the only plan that can complete LAUN-04 (persistence across restarts) end-to-end.

Purpose: LAUN-03 + LAUN-04. Plan 03-07 (RamSlider) reads this store via `window.wiiwho.settings.get()`. Plan 03-10 (game orchestrator) reads `ramMb` here right before JVM spawn.

Output: `launcher/src/main/settings/store.ts` + test + updated `ipc/settings.ts` + extended ipc test. All tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/main/paths.ts
@launcher/src/main/auth/safeStorageCache.ts
@launcher/src/main/ipc/settings.ts
@launcher/src/main/ipc/settings.test.ts

<interfaces>
From launcher/src/main/paths.ts (Plan 03-01):
```typescript
export function resolveSettingsFile(): string   // <userData>/settings.json
```

From launcher/src/main/auth/safeStorageCache.ts (Phase 2 — atomic-write pattern to mirror, unencrypted):
```typescript
// Existing atomic-write idiom (lines 59-68):
const tmp = `${filePath}.tmp`
await fs.writeFile(tmp, enc, { mode: 0o600 })
await fs.rename(tmp, filePath)
```

Phase 3 settings file is NOT encrypted (plain JSON, non-sensitive) — same temp+rename pattern but without `safeStorage.encryptString`.

From launcher/src/main/ipc/settings.ts (Phase 1 stub — to be replaced):
```typescript
let inMemorySettings: Record<string, unknown> = {}
export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async () => ({ ...inMemorySettings }))
  ipcMain.handle('settings:set', async (_event, patch: Record<string, unknown>) => {
    inMemorySettings = { ...inMemorySettings, ...(patch ?? {}) }
    return { ok: true }
  })
  ipcMain.handle('logs:read-crash', async () => ({ sanitizedBody: '' }))   // ← leave untouched; Plan 03-10 replaces
}
export function __resetSettingsForTests(): void { inMemorySettings = {} }
```

Plan 03-02 REPLACES the settings:get/settings:set handler bodies ONLY. Do NOT touch the logs:read-crash handler (Plan 03-10 owns that).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create settings/store.ts with schema v1, clamp, and atomic write</name>
  <files>
    launcher/src/main/settings/store.ts,
    launcher/src/main/settings/store.test.ts
  </files>
  <read_first>
    - launcher/src/main/auth/safeStorageCache.ts (atomic-write pattern to mirror)
    - launcher/src/main/paths.ts (resolveSettingsFile — imported here)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Settings Schema — copy the interface and migrate function verbatim
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: `readSettings()` on missing file returns DEFAULTS `{version:1, ramMb:2048, firstRunSeen:false}` (D-04)
    - Test 2: `readSettings()` on corrupted/non-JSON file returns DEFAULTS (graceful fallback)
    - Test 3: Round-trip: `writeSettings({version:1, ramMb:3072, firstRunSeen:true})` → new process / fresh module / clear cache → `readSettings()` returns `{version:1, ramMb:3072, firstRunSeen:true}` (LAUN-04 CORE ASSERTION)
    - Test 4: clampRam(512) === 1024 (below-min → clamped up)
    - Test 5: clampRam(5000) === 4096 (above-max → clamped down)
    - Test 6: clampRam(2300) === 2304... wait — 2300/512 = 4.49 → round → 4 → 2048 (stepped). Actually: 2300 → Math.round(2300/512)=4 → 4*512=2048. Good test case; assert 2300→2048.
    - Test 7: clampRam(2500) === 2560 (rounds UP: 2500/512=4.88 → 5 → 2560)
    - Test 8: Unknown version `{version: 99}` migrate returns DEFAULTS
    - Test 9: Partial valid object `{version: 1, ramMb: 'not a number'}` migrates to DEFAULTS.ramMb (the one field) while preserving other valid fields
    - Test 10: `writeSettings` uses atomic temp+rename (verify by mocking `fs.promises` and asserting `writeFile` is called on `<path>.tmp` and `rename(<path>.tmp, <path>)` follows)

    Tests mock `electron.app.getPath` + set up a real temp dir with `os.tmpdir() + randomUUID()` so round-trip actually exercises disk I/O for test 3. Clean up the temp dir in `afterEach`.
  </behavior>
  <action>
    **Create `launcher/src/main/settings/store.ts`** — content copied verbatim from RESEARCH.md §Settings Schema + §Persistence (atomic write):

    ```typescript
    /**
     * Plain-JSON settings persistence (v1 schema).
     *
     * Lives at `<userData>/settings.json` (via paths.ts::resolveSettingsFile).
     * NOT encrypted — settings are not sensitive (ramMb, firstRunSeen flag).
     * Atomic temp+rename matches Phase 2 safeStorageCache write pattern.
     *
     * Source: .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Settings Schema
     * Decisions: D-04 (1-4 GB in 512 MB steps, default 2 GB), LAUN-03 + LAUN-04
     */

    import { promises as fs } from 'node:fs'
    import path from 'node:path'
    import { resolveSettingsFile } from '../paths'

    export interface SettingsV1 {
      version: 1
      ramMb: number           // 1024 | 1536 | 2048 | 2560 | 3072 | 3584 | 4096 (D-04)
      firstRunSeen: boolean   // true after first Play completes; gates one-time hint
    }

    export const DEFAULTS: SettingsV1 = {
      version: 1,
      ramMb: 2048,           // D-04 default
      firstRunSeen: false
    }

    /** Clamp ramMb to [1024, 4096] in 512 MB steps (D-04). */
    export function clampRam(r: number): number {
      if (!Number.isFinite(r)) return DEFAULTS.ramMb
      const clamped = Math.max(1024, Math.min(4096, r))
      return Math.round(clamped / 512) * 512
    }

    function migrate(raw: unknown): SettingsV1 {
      if (typeof raw !== 'object' || raw === null) return DEFAULTS
      const obj = raw as Record<string, unknown>
      switch (obj.version) {
        case 1: {
          const v = obj as Partial<SettingsV1>
          return {
            version: 1,
            ramMb: clampRam(typeof v.ramMb === 'number' ? v.ramMb : DEFAULTS.ramMb),
            firstRunSeen: typeof v.firstRunSeen === 'boolean' ? v.firstRunSeen : DEFAULTS.firstRunSeen
          }
        }
        default:
          // Unknown/absent version → reset to defaults (acceptable for v0.1)
          return DEFAULTS
      }
    }

    export async function readSettings(): Promise<SettingsV1> {
      const file = resolveSettingsFile()
      try {
        const raw = await fs.readFile(file, 'utf8')
        try {
          return migrate(JSON.parse(raw))
        } catch {
          // Corrupt JSON → defaults; the next write overwrites cleanly.
          return DEFAULTS
        }
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULTS
        throw err
      }
    }

    export async function writeSettings(v: SettingsV1): Promise<void> {
      const file = resolveSettingsFile()
      // Re-clamp on write — belt-and-suspenders against a client passing a raw number.
      const safe: SettingsV1 = {
        version: 1,
        ramMb: clampRam(v.ramMb),
        firstRunSeen: !!v.firstRunSeen
      }
      await fs.mkdir(path.dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      await fs.writeFile(tmp, JSON.stringify(safe, null, 2))
      await fs.rename(tmp, file)
    }
    ```

    **Create `launcher/src/main/settings/store.test.ts`** with all 10 tests above. Use `@vitest-environment node`. Mock `../paths` to return a unique temp path per test:

    ```typescript
    // @vitest-environment node
    import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
    import { promises as fs } from 'node:fs'
    import os from 'node:os'
    import path from 'node:path'
    import { randomUUID } from 'node:crypto'

    let tempFile: string

    beforeEach(() => {
      tempFile = path.join(os.tmpdir(), `wiiwho-settings-test-${randomUUID()}`, 'settings.json')
      vi.doMock('../paths', () => ({
        resolveSettingsFile: () => tempFile
      }))
    })

    afterEach(async () => {
      await fs.rm(path.dirname(tempFile), { recursive: true, force: true })
      vi.doUnmock('../paths')
      vi.resetModules()
    })

    it('readSettings on missing file returns DEFAULTS', async () => {
      const { readSettings, DEFAULTS } = await import('./store')
      const s = await readSettings()
      expect(s).toEqual(DEFAULTS)
    })

    it('round-trips write→read (LAUN-04)', async () => {
      const { readSettings, writeSettings } = await import('./store')
      await writeSettings({ version: 1, ramMb: 3072, firstRunSeen: true })
      const s = await readSettings()
      expect(s).toEqual({ version: 1, ramMb: 3072, firstRunSeen: true })
    })

    // ... 8 more tests
    ```

    Confirm `pnpm vitest run src/main/settings/store.test.ts` exits 0 with 10 passing tests.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/settings/store.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export async function readSettings" launcher/src/main/settings/store.ts`
    - `grep -q "export async function writeSettings" launcher/src/main/settings/store.ts`
    - `grep -q "export function clampRam" launcher/src/main/settings/store.ts`
    - `grep -q "export const DEFAULTS" launcher/src/main/settings/store.ts`
    - `grep -q "ramMb: 2048" launcher/src/main/settings/store.ts` (D-04 default)
    - `grep -q "Math.round(clamped / 512)" launcher/src/main/settings/store.ts` (512 MB stepping)
    - `grep -q "fs.rename" launcher/src/main/settings/store.ts` (atomic write)
    - `grep -q "resolveSettingsFile" launcher/src/main/settings/store.ts` (uses Plan 03-01 path)
    - `cd launcher &amp;&amp; npx vitest run src/main/settings/store.test.ts` exits 0 with ≥10 tests passing
  </acceptance_criteria>
  <done>Settings store typed, clamped, atomically written, round-trip-tested. Plan 03-07 and Plan 03-10 have what they need.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace ipc/settings.ts Phase 1 stub with store-backed handlers</name>
  <files>
    launcher/src/main/ipc/settings.ts,
    launcher/src/main/ipc/settings.test.ts
  </files>
  <read_first>
    - launcher/src/main/ipc/settings.ts (Phase 1 stub — understand current handler shape before replacing)
    - launcher/src/main/ipc/settings.test.ts (Phase 1 tests — they assert the in-memory shape; we'll rewrite them for the store-backed shape)
    - launcher/src/main/settings/store.ts (Task 1 — readSettings/writeSettings imports)
    - launcher/src/preload/index.ts (frozen IPC surface — `settings.get()` / `settings.set(patch)` — the preload shape MUST remain unchanged)
    - launcher/src/renderer/src/wiiwho.d.ts (the type contract the renderer relies on — return value of get/set)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: `settings:get` returns the full SettingsV1 object (shape `{version, ramMb, firstRunSeen}`) — no Record<string,unknown>
    - Test 2: `settings:get` on missing file returns DEFAULTS (covered by store; this confirms the IPC handler propagates)
    - Test 3: `settings:set({ramMb: 3072})` merges the patch into the persisted settings, clamps ramMb, writes, returns `{ok:true, settings: {...}}`
    - Test 4: `settings:set({ramMb: 99999})` clamps to 4096 before persisting (belt-and-suspenders — also checked at store layer)
    - Test 5: `settings:set({firstRunSeen: true})` preserves ramMb from existing settings (merge semantics, not replace)
    - Test 6: `settings:set({ramMb: 'not a number'})` rejects/ignores and persists DEFAULTS.ramMb (defensive)
    - Test 7: **`logs:read-crash` handler is NOT modified** — grep confirms the Phase 1 stub line still exists in the file (that handler is Plan 03-10's territory; this plan must not touch it)

    Use `vi.mock('electron', ...)` for `ipcMain.handle` capture (as Phase 2 settings.test.ts does). Each test:
    1. Captures the ipcMain.handle callback via the mock
    2. Invokes the callback with a fake IpcMainInvokeEvent + patch
    3. Asserts the return value shape
    4. Asserts the side-effect via a store-level read (writeSettings actually wrote)
  </behavior>
  <action>
    **Replace the bodies of `settings:get` and `settings:set` in `launcher/src/main/ipc/settings.ts` with store-backed implementations.** Keep `registerSettingsHandlers` and the `logs:read-crash` stub handler EXACTLY as they are (that's Plan 03-10's territory).

    New `launcher/src/main/ipc/settings.ts`:

    ```typescript
    /**
     * Phase 3 settings handlers — backed by settings/store.ts (plain JSON,
     * atomic write, D-04 schema).
     *
     * Preload surface is UNCHANGED from Phase 1:
     *   settings.get() → Promise<SettingsV1>
     *   settings.set(patch) → Promise<{ok: boolean, settings: SettingsV1}>
     *
     * logs:read-crash remains a stub here — Plan 03-10 replaces it with the
     * sanitizeCrashReport-backed implementation.
     */

    import { ipcMain } from 'electron'
    import { readSettings, writeSettings, type SettingsV1 } from '../settings/store'

    export function registerSettingsHandlers(): void {
      ipcMain.handle('settings:get', async () => {
        return await readSettings()
      })

      ipcMain.handle(
        'settings:set',
        async (_event, patch: Partial<SettingsV1>) => {
          const current = await readSettings()
          const merged: SettingsV1 = {
            version: 1,
            ramMb: typeof patch?.ramMb === 'number' ? patch.ramMb : current.ramMb,
            firstRunSeen:
              typeof patch?.firstRunSeen === 'boolean'
                ? patch.firstRunSeen
                : current.firstRunSeen
          }
          // writeSettings re-clamps ramMb; belt-and-suspenders.
          await writeSettings(merged)
          const fresh = await readSettings()
          return { ok: true, settings: fresh }
        }
      )

      // Phase 1 stub — leave untouched. Plan 03-10 replaces this body.
      ipcMain.handle('logs:read-crash', async () => {
        console.log('[wiiwho] logs:read-crash (stub)')
        return { sanitizedBody: '' }
      })
    }

    /** Test-only helper — no longer backing in-memory state; deprecated no-op. */
    export function __resetSettingsForTests(): void {
      // Tests now mock `../settings/store`; this helper kept for API compat with
      // Phase 1 test files that may still call it. Safe to remove once Phase 2
      // tests stop importing it.
    }
    ```

    **Update `launcher/src/main/ipc/settings.test.ts`** — rewrite the existing tests around the new store-backed shape. Use `vi.mock('../settings/store', ...)` to inject a stub `readSettings`/`writeSettings` and assert the IPC handler calls them with the right arguments. Keep `vi.mock('electron', ...)` pattern from existing test for capturing `ipcMain.handle`.

    Also ADD Test 7 that greps the file to verify the `logs:read-crash` stub line still exists:

    ```typescript
    import { readFileSync } from 'node:fs'
    import path from 'node:path'
    it('does not remove the logs:read-crash stub (Plan 03-10 owns that)', () => {
      const src = readFileSync(path.join(__dirname, 'settings.ts'), 'utf8')
      expect(src).toMatch(/logs:read-crash/)
    })
    ```

    Update `launcher/src/renderer/src/wiiwho.d.ts` (the renderer's type surface):

    ```typescript
    settings: {
      get: () => Promise<{ version: 1; ramMb: number; firstRunSeen: boolean }>
      set: (patch: Partial<{ ramMb: number; firstRunSeen: boolean }>) => Promise<{
        ok: boolean
        settings: { version: 1; ramMb: number; firstRunSeen: boolean }
      }>
    }
    ```

    Replaces the previous `Record<string, unknown>` shapes. No new top-level keys, no new channels — just tightening the types for the existing `settings.get` / `settings.set` calls.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/ipc/settings.test.ts &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "readSettings" launcher/src/main/ipc/settings.ts`
    - `grep -q "writeSettings" launcher/src/main/ipc/settings.ts`
    - `grep -q "logs:read-crash" launcher/src/main/ipc/settings.ts` (Plan 03-10's stub UNTOUCHED)
    - `grep -q "inMemorySettings" launcher/src/main/ipc/settings.ts` returns NOTHING (Phase 1 state removed)
    - `grep -q "settings:get" launcher/src/main/ipc/settings.ts` and `grep -q "settings:set" launcher/src/main/ipc/settings.ts` both succeed (handler channels unchanged)
    - `grep -q "ramMb: number" launcher/src/renderer/src/wiiwho.d.ts` succeeds (wiiwho.d.ts tightened)
    - `cd launcher &amp;&amp; npx vitest run src/main/ipc/settings.test.ts` exits 0 with ≥7 tests passing
    - `cd launcher &amp;&amp; npm run typecheck` exits 0 (renderer wiiwho.d.ts change doesn't break Phase 2 code)
  </acceptance_criteria>
  <done>settings:get/set backed by store; logs:read-crash stub preserved; wiiwho.d.ts types narrowed; test suite green.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/main/settings src/main/ipc/settings.test.ts` all pass
- `cd launcher && npm run typecheck && npm run test:run` — full suite still green
- LAUN-04 core assertion proven: round-trip test in store.test.ts
- Phase 1 IPC frozen surface preserved (grep confirms no new top-level keys)
</verification>

<success_criteria>
- LAUN-03 enforced: RAM clamped to 1024-4096 in 512 MB steps (test coverage)
- LAUN-04 proven: writeSettings → readSettings round-trips across process boundaries (fresh-module test)
- IPC handlers replaced without touching logs:read-crash (Plan 03-10 isolation preserved)
- Preload surface unchanged (D-11 frozen IPC)
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-02-SUMMARY.md` documenting:
- Exact schema v1 shape committed
- Clamp behavior on all 7 canonical positions (1024/1536/2048/2560/3072/3584/4096)
- Any edge case in the migrate function worth noting for future v2 schema planning
</output>
