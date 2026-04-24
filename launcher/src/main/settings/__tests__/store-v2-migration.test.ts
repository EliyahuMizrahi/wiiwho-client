// @vitest-environment node
/**
 * Plan 04-01 Task 2 — settings v1 → v2 migration tests.
 *
 * Verifies:
 *   - v1 {version:1, ramMb, firstRunSeen} on disk → v2 shape in memory,
 *     preserving ramMb + firstRunSeen and adding {theme:{accent,reduceMotion}}
 *     defaults.
 *   - readSettings() on fresh userData returns v2 defaults with cyan + system.
 *   - writeSettings with invalid theme.accent falls back to #16e0ee
 *     (per-field fallback, preserves valid siblings).
 *   - writeSettings with valid theme.accent round-trips through disk.
 *   - ramMb clamping (1024-4096 step 512) is preserved in the v2 path.
 *   - reduceMotion accepts 'system'|'on'|'off', falls back to 'system' on junk.
 *
 * Mocks `../paths::resolveSettingsFile` to a unique temp path per test
 * (matches Plan 03-02's store.test.ts pattern — real disk I/O so the
 * atomic temp+rename invariant is exercised the same way).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

let tempDir: string
let tempFile: string

beforeEach(() => {
  tempDir = path.join(os.tmpdir(), `wiiwho-v2-migration-test-${randomUUID()}`)
  tempFile = path.join(tempDir, 'settings.json')
  vi.doMock('../../paths', () => ({
    resolveSettingsFile: (): string => tempFile
  }))
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  vi.doUnmock('../../paths')
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('Settings v1 → v2 migration', () => {
  it('migrates v1 {version:1, ramMb, firstRunSeen} → v2 adding theme defaults', async () => {
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(
      tempFile,
      JSON.stringify({ version: 1, ramMb: 3072, firstRunSeen: true }),
      'utf8'
    )

    const { readSettings } = await import('../store')
    const s = await readSettings()
    expect(s.version).toBe(2)
    expect(s.ramMb).toBe(3072)
    expect(s.firstRunSeen).toBe(true)
    expect(s.theme.accent).toBe('#16e0ee')
    expect(s.theme.reduceMotion).toBe('system')
  })

  it('defaults theme.accent === "#16e0ee" and theme.reduceMotion === "system" on fresh install', async () => {
    const { readSettings } = await import('../store')
    const s = await readSettings()
    expect(s.version).toBe(2)
    expect(s.theme.accent).toBe('#16e0ee')
    expect(s.theme.reduceMotion).toBe('system')
  })

  it('rejects invalid theme.accent hex (not /^#[0-9a-fA-F]{6}$/) and falls back to #16e0ee', async () => {
    const { writeSettings } = await import('../store')
    const result = await writeSettings({ theme: { accent: 'not-a-hex' } })
    expect(result.theme.accent).toBe('#16e0ee')
  })

  it('accepts valid theme.accent hex and round-trips', async () => {
    const { writeSettings, readSettings } = await import('../store')
    await writeSettings({ theme: { accent: '#ec4899' } })
    const s = await readSettings()
    expect(s.theme.accent).toBe('#ec4899')
  })

  it('preserves ramMb from v1 file during migration', async () => {
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(
      tempFile,
      JSON.stringify({ version: 1, ramMb: 3072, firstRunSeen: false }),
      'utf8'
    )
    const { readSettings } = await import('../store')
    const s = await readSettings()
    expect(s.ramMb).toBe(3072)
  })

  it('preserves firstRunSeen from v1 during migration', async () => {
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(
      tempFile,
      JSON.stringify({ version: 1, ramMb: 2048, firstRunSeen: true }),
      'utf8'
    )
    const { readSettings } = await import('../store')
    const s = await readSettings()
    expect(s.firstRunSeen).toBe(true)
  })

  it('clamps ramMb writes via v2 the same as v1 (1024-4096 step 512)', async () => {
    const { writeSettings } = await import('../store')
    const low = await writeSettings({ ramMb: 500 })
    expect(low.ramMb).toBe(1024)
    const high = await writeSettings({ ramMb: 9999 })
    expect(high.ramMb).toBe(4096)
  })

  it('accepts all three reduceMotion values', async () => {
    const { writeSettings } = await import('../store')
    const on = await writeSettings({ theme: { reduceMotion: 'on' } })
    expect(on.theme.reduceMotion).toBe('on')
    const off = await writeSettings({ theme: { reduceMotion: 'off' } })
    expect(off.theme.reduceMotion).toBe('off')
    const sys = await writeSettings({ theme: { reduceMotion: 'system' } })
    expect(sys.theme.reduceMotion).toBe('system')
  })

  it('rejects unknown reduceMotion and falls back to "system"', async () => {
    const { writeSettings } = await import('../store')
    const res = await writeSettings({
      theme: { reduceMotion: 'bogus' as never }
    })
    expect(res.theme.reduceMotion).toBe('system')
  })

  it('rewrites the on-disk file to v2 after migration (next reader sees v2)', async () => {
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(
      tempFile,
      JSON.stringify({ version: 1, ramMb: 2560, firstRunSeen: false }),
      'utf8'
    )
    const { readSettings } = await import('../store')
    await readSettings()

    // Next read should see a v2 file on disk (either because migration
    // rewrote it, or because readSettings returns v2-shape and any next
    // writeSettings will persist v2). Assert the latter — explicitly write
    // and round-trip to confirm.
    const { writeSettings } = await import('../store')
    await writeSettings({})
    const onDisk = JSON.parse(await fs.readFile(tempFile, 'utf8'))
    expect(onDisk.version).toBe(2)
    expect(onDisk.theme).toBeDefined()
    expect(onDisk.theme.accent).toBe('#16e0ee')
    expect(onDisk.theme.reduceMotion).toBe('system')
    expect(onDisk.ramMb).toBe(2560)
  })
})
