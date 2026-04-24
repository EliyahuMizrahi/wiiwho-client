// @vitest-environment node
/**
 * Plan 03-02 Task 1 — settings/store.ts tests.
 *
 * Pins LAUN-03 (RAM clamped to 1024-4096 in 512 MB steps) and LAUN-04
 * (settings persist across reads — round-trip through disk). Atomic
 * temp+rename write is also asserted via an fs.promises spy.
 *
 * Strategy:
 *   - Mock `../paths::resolveSettingsFile` to point at a unique temp path per
 *     test. Real disk I/O — not in-memory fs — so the round-trip actually
 *     hits fs.writeFile + fs.rename like production will.
 *   - Each test dynamically imports ./store AFTER vi.doMock is set up so the
 *     mocked resolveSettingsFile is observed by the module.
 *   - vi.resetModules() in afterEach keeps per-test module graphs isolated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import * as fsMod from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

let tempDir: string
let tempFile: string

beforeEach(() => {
  tempDir = path.join(os.tmpdir(), `wiiwho-settings-test-${randomUUID()}`)
  tempFile = path.join(tempDir, 'settings.json')
  vi.doMock('../paths', () => ({
    resolveSettingsFile: (): string => tempFile
  }))
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  vi.doUnmock('../paths')
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('settings/store.ts — schema + defaults + clamp', () => {
  it('Test 1: readSettings() on missing file returns DEFAULTS (D-04 + D-18)', async () => {
    const { readSettings, DEFAULTS } = await import('./store')
    const s = await readSettings()
    expect(s).toEqual(DEFAULTS)
    // v2 shape per Plan 04-01 — D-18 theme slice added to D-04 baseline.
    expect(s).toEqual({
      version: 2,
      ramMb: 2048,
      firstRunSeen: false,
      theme: { accent: '#16e0ee', reduceMotion: 'system' }
    })
  })

  it('Test 2: readSettings() on corrupted non-JSON file returns DEFAULTS', async () => {
    const { readSettings, DEFAULTS } = await import('./store')
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(tempFile, '{{{ this is not json', 'utf8')
    const s = await readSettings()
    expect(s).toEqual(DEFAULTS)
  })

  it('Test 3: round-trips write→read across fresh module import (LAUN-04)', async () => {
    // Write with module instance A. writeSettings is patch-based post-v2.
    {
      const { writeSettings } = await import('./store')
      await writeSettings({ ramMb: 3072, firstRunSeen: true })
    }
    // Simulate a process restart: drop the module graph, re-import fresh.
    vi.resetModules()
    // Re-mock paths for the fresh module (mocks are cleared by resetModules).
    vi.doMock('../paths', () => ({
      resolveSettingsFile: (): string => tempFile
    }))
    {
      const { readSettings } = await import('./store')
      const s = await readSettings()
      expect(s).toEqual({
        version: 2,
        ramMb: 3072,
        firstRunSeen: true,
        theme: { accent: '#16e0ee', reduceMotion: 'system' }
      })
    }
  })

  it('Test 4: clampRam(512) === 1024 — below-min clamps up', async () => {
    const { clampRam } = await import('./store')
    expect(clampRam(512)).toBe(1024)
  })

  it('Test 5: clampRam(5000) === 4096 — above-max clamps down', async () => {
    const { clampRam } = await import('./store')
    expect(clampRam(5000)).toBe(4096)
  })

  it('Test 6: clampRam(2300) === 2048 — rounds to nearest 512 step', async () => {
    const { clampRam } = await import('./store')
    // 2300 / 512 = 4.49 → Math.round → 4 → 4*512 = 2048
    expect(clampRam(2300)).toBe(2048)
  })

  it('Test 7: clampRam(2500) === 2560 — rounds UP to nearest 512 step', async () => {
    const { clampRam } = await import('./store')
    // 2500 / 512 = 4.88 → Math.round → 5 → 5*512 = 2560
    expect(clampRam(2500)).toBe(2560)
  })

  it('Test 8: migrate unknown version { version: 99 } returns DEFAULTS', async () => {
    const { readSettings, DEFAULTS } = await import('./store')
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(
      tempFile,
      JSON.stringify({ version: 99, ramMb: 2048, foo: 'bar' }),
      'utf8'
    )
    const s = await readSettings()
    expect(s).toEqual(DEFAULTS)
  })

  it('Test 9: partial-invalid { version: 1, ramMb: "not a number" } falls back to DEFAULTS.ramMb and preserves other valid fields', async () => {
    const { readSettings, DEFAULTS } = await import('./store')
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(
      tempFile,
      JSON.stringify({ version: 1, ramMb: 'not a number', firstRunSeen: true }),
      'utf8'
    )
    const s = await readSettings()
    // Readers always resolve to current schema — v2 post-Plan-04-01.
    expect(s.version).toBe(2)
    expect(s.ramMb).toBe(DEFAULTS.ramMb) // 2048 — defaulted
    expect(s.firstRunSeen).toBe(true) // preserved valid field
  })

  it('Test 10: writeSettings uses atomic temp+rename pattern', async () => {
    const writeSpy = vi.spyOn(fsMod.promises, 'writeFile')
    const renameSpy = vi.spyOn(fsMod.promises, 'rename')

    const { writeSettings } = await import('./store')
    await writeSettings({ ramMb: 2048, firstRunSeen: false })

    // First, writeFile should have been called with `<tempFile>.tmp` — NEVER the final path.
    const writeCallTargets = writeSpy.mock.calls.map((c) => String(c[0]))
    expect(writeCallTargets.some((p) => p === `${tempFile}.tmp`)).toBe(true)
    expect(writeCallTargets.every((p) => p !== tempFile)).toBe(true)

    // Then, rename(<tempFile>.tmp, <tempFile>) must follow.
    const renameCalls = renameSpy.mock.calls.map(
      (c) => [String(c[0]), String(c[1])] as const
    )
    expect(
      renameCalls.some(
        ([from, to]) => from === `${tempFile}.tmp` && to === tempFile
      )
    ).toBe(true)
  })

  it('Test 11 (bonus): writeSettings re-clamps ramMb even when caller passes a raw number', async () => {
    const { writeSettings, readSettings } = await import('./store')
    // Caller passes out-of-range/un-stepped value — writeSettings must clamp.
    await writeSettings({ ramMb: 99999, firstRunSeen: false })
    const s = await readSettings()
    expect(s.ramMb).toBe(4096)
  })
})
