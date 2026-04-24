// @vitest-environment node
/**
 * Plan 03-02 Task 2 + Plan 04-01 Task 2 — ipc/settings.ts (store-backed handlers).
 *
 * Replaces the Phase 1 in-memory stub tests with store-backed assertions:
 *   - settings:get returns a full SettingsV2 (post-Plan 04-01 migration)
 *   - settings:set merges a patch, clamps ramMb via the store, and returns
 *     {ok:true, settings: SettingsV2}
 *   - patch merge semantics: omitted keys preserve current values
 *   - defensive: non-number ramMb ignored, drops back to current/default
 *   - logs:read-crash stub UNTOUCHED (Plan 03-10 owns that handler)
 *
 * Uses the Phase 2 ipcMain capture pattern (Map keyed by channel).
 * Uses a real temp-file `resolveSettingsFile` mock so the tests exercise
 * the same disk round-trip as production.
 */

const V2_DEFAULTS = {
  version: 2,
  ramMb: 2048,
  firstRunSeen: false,
  theme: { accent: '#16e0ee', reduceMotion: 'system' as const }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// ipcMain capture — one Map shared across the suite.
const handlers = new Map<string, (...args: unknown[]) => unknown>()
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown): void => {
      handlers.set(channel, handler)
    }
  }
}))

let tempDir: string
let tempFile: string

beforeEach(() => {
  handlers.clear()
  tempDir = path.join(os.tmpdir(), `wiiwho-ipc-settings-${randomUUID()}`)
  tempFile = path.join(tempDir, 'settings.json')
  vi.doMock('../paths', () => ({
    resolveSettingsFile: (): string => tempFile
  }))
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  handlers.clear()
  vi.doUnmock('../paths')
  vi.resetModules()
  vi.restoreAllMocks()
})

async function register(): Promise<void> {
  const mod = await import('./settings')
  mod.registerSettingsHandlers()
}

describe('ipc/settings.ts — store-backed handlers (Plan 03-02)', () => {
  it('Test 1: settings:get returns a full SettingsV2 shape', async () => {
    await register()
    const r = await handlers.get('settings:get')?.({} as unknown)
    expect(r).toEqual(V2_DEFAULTS)
  })

  it('Test 2: settings:get on missing file returns DEFAULTS', async () => {
    await register()
    const r = await handlers.get('settings:get')?.({} as unknown)
    expect(r).toEqual(V2_DEFAULTS)
    // And assert no file exists on disk (confirm we're actually in defaults mode).
    await expect(fs.stat(tempFile)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('Test 3: settings:set({ramMb: 3072}) merges, clamps, persists, returns {ok:true, settings}', async () => {
    await register()
    const res = (await handlers.get('settings:set')?.({} as unknown, { ramMb: 3072 })) as {
      ok: boolean
      settings: typeof V2_DEFAULTS
    }
    expect(res.ok).toBe(true)
    expect(res.settings).toEqual({ ...V2_DEFAULTS, ramMb: 3072 })

    // Next read reflects the write (store-backed, not in-memory).
    const follow = await handlers.get('settings:get')?.({} as unknown)
    expect(follow).toEqual({ ...V2_DEFAULTS, ramMb: 3072 })
  })

  it('Test 4: settings:set({ramMb: 99999}) clamps to 4096 before persisting', async () => {
    await register()
    const res = (await handlers.get('settings:set')?.({} as unknown, { ramMb: 99999 })) as {
      ok: boolean
      settings: { ramMb: number }
    }
    expect(res.settings.ramMb).toBe(4096)
  })

  it('Test 5: settings:set({firstRunSeen: true}) preserves current ramMb (merge, not replace)', async () => {
    await register()
    // Seed with a non-default ramMb.
    await handlers.get('settings:set')?.({} as unknown, { ramMb: 3584 })

    // Patch ONLY firstRunSeen.
    const res = (await handlers.get('settings:set')?.({} as unknown, { firstRunSeen: true })) as {
      ok: boolean
      settings: typeof V2_DEFAULTS
    }
    expect(res.settings).toEqual({
      ...V2_DEFAULTS,
      ramMb: 3584,
      firstRunSeen: true
    })
  })

  it('Test 6: settings:set({ramMb: "not a number"}) ignores garbage, keeps current ramMb', async () => {
    await register()
    // Fresh state → current ramMb is DEFAULTS.ramMb (2048).
    const res = (await handlers.get('settings:set')?.({} as unknown, {
      ramMb: 'not a number'
    })) as {
      ok: boolean
      settings: { ramMb: number; firstRunSeen: boolean }
    }
    expect(res.ok).toBe(true)
    expect(res.settings.ramMb).toBe(2048) // defaulted, not coerced, not clamped-from-NaN
    expect(res.settings.firstRunSeen).toBe(false)
  })

  it('Test 7: logs:read-crash is NO LONGER registered by settings.ts (Plan 03-10 moved it to ipc/logs.ts)', async () => {
    // Static source check — confirm the stub handler has been deleted from this file.
    const src = readFileSync(path.join(__dirname, 'settings.ts'), 'utf8')
    // No ipcMain.handle call for logs:read-crash should remain in settings.ts.
    expect(src).not.toMatch(/ipcMain\.handle\(\s*['"]logs:read-crash['"]/)

    // Runtime check — after registerSettingsHandlers(), no handler is bound
    // to the 'logs:read-crash' channel (it's owned by ipc/logs.ts now).
    await register()
    expect(handlers.has('logs:read-crash')).toBe(false)
  })

  it('Test 8: settings:set with undefined/null patch is tolerated (defensive)', async () => {
    await register()
    const res1 = (await handlers.get('settings:set')?.({} as unknown, undefined)) as {
      ok: boolean
      settings: typeof V2_DEFAULTS
    }
    expect(res1.ok).toBe(true)
    expect(res1.settings).toEqual(V2_DEFAULTS)

    const res2 = (await handlers.get('settings:set')?.({} as unknown, null)) as {
      ok: boolean
      settings: { ramMb: number }
    }
    expect(res2.ok).toBe(true)
    expect(res2.settings.ramMb).toBe(2048)
  })
})
