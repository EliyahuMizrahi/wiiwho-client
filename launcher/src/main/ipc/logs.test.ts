// @vitest-environment node
/**
 * Plan 03-10 Task 2 — ipc/logs.ts (Logs handlers).
 *
 * Tests the 3 channels that moved out of ipc/settings.ts + the two new
 * channels Plan 03-09 declared in the preload bridge:
 *
 *   logs:read-crash         (moved from ipc/settings stub)
 *   logs:open-crash-folder  (new — wraps shell.showItemInFolder)
 *   logs:list-crashes       (new — delegates to monitor/crashReport)
 *
 * The D-21 / COMP-05 invariant is EXERCISED here with the fixture crash
 * report containing the literal string `ey.fakeTokenBody123` —
 * logs:read-crash must not return that string in `sanitizedBody`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// ---- Hoisted mock bag --------------------------------------------------------

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  shell: {
    showItemInFolder: vi.fn()
  }
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown): void => {
      mocks.handlers.set(channel, handler)
    }
  },
  shell: mocks.shell
}))

vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

// Temp dir for the crash-reports fixture. Plumbed via a `../paths` mock so
// both the production code and the test setup share a single view of where
// the crash files live.
let crashDir: string

vi.mock('../paths', () => ({
  resolveCrashReportsDir: (): string => crashDir
}))

// IMPORTANT: we do NOT mock `../auth/redact` — the fixture test below wants
// the real sanitizeCrashReport to run so the end-to-end token-redaction
// pipeline is actually exercised (D-21 / COMP-05 regression guard).

// monitor/crashReport — mock listCrashReports so newest-first ordering is
// deterministic in tests, but fall through to real readCrashReport (it just
// reads a file from disk, which we control via the temp dir).
const crashReportModule = await import('../monitor/crashReport')

// ---- Import under test ------------------------------------------------------

// Dynamic import after mocks are registered.
async function register(): Promise<void> {
  // Fresh module graph per test — some tests assert on vi.fn() call counts
  // that need to reset even if the handler is re-registered.
  const mod = await import('./logs')
  mod.registerLogsHandlers()
}

// ---- Test setup -------------------------------------------------------------

const FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  'monitor',
  '__fixtures__',
  'fake-crash-report.txt'
)

beforeEach(async () => {
  mocks.handlers.clear()
  mocks.shell.showItemInFolder.mockReset()
  crashDir = path.join(os.tmpdir(), `wiiwho-ipc-logs-${randomUUID()}`)
  await fs.mkdir(crashDir, { recursive: true })
})

afterEach(async () => {
  await fs.rm(crashDir, { recursive: true, force: true }).catch(() => {})
  mocks.handlers.clear()
  vi.resetModules()
})

async function writeFixture(filename: string, body?: string): Promise<void> {
  const raw = body ?? (await fs.readFile(FIXTURE_PATH, 'utf8'))
  await fs.writeFile(path.join(crashDir, filename), raw, 'utf8')
}

// ---- Tests ------------------------------------------------------------------

describe('ipc/logs.ts — logs:* handlers (Plan 03-10)', () => {
  it('Test 1: logs:read-crash with crashId reads that file, sanitizes, returns {sanitizedBody}', async () => {
    await register()
    await writeFixture('crash-2026-04-21_15.04.22-client.txt', 'plain body')

    const r = (await mocks.handlers.get('logs:read-crash')?.(
      {} as unknown,
      { crashId: 'crash-2026-04-21_15.04.22-client.txt' }
    )) as { sanitizedBody: string }

    expect(r.sanitizedBody).toBe('plain body')
  })

  it('Test 2: logs:read-crash without crashId reads the NEWEST crash file', async () => {
    await register()
    // Two files — newest by ISO-ordered filename should be picked.
    await writeFixture('crash-2026-04-20_10.00.00-client.txt', 'older body')
    await writeFixture('crash-2026-04-21_15.04.22-client.txt', 'newer body')

    const r = (await mocks.handlers.get('logs:read-crash')?.(
      {} as unknown,
      undefined
    )) as { sanitizedBody: string }

    expect(r.sanitizedBody).toBe('newer body')
  })

  it('Test 3: logs:read-crash when no crashes exist returns {sanitizedBody: ""} (never throws)', async () => {
    await register()
    // Fresh empty temp dir; no files in it.
    const r = (await mocks.handlers.get('logs:read-crash')?.(
      {} as unknown,
      undefined
    )) as { sanitizedBody: string }

    expect(r.sanitizedBody).toBe('')
  })

  it('Test 4 (COMP-05 regression): fixture crash report with raw token → sanitizedBody strips "ey.fakeTokenBody123"', async () => {
    await register()
    // Copy the real fixture file into the temp dir.
    const fixtureBody = await fs.readFile(FIXTURE_PATH, 'utf8')
    // Sanity-check the fixture actually contains the raw token.
    expect(fixtureBody).toContain('ey.fakeTokenBody123')
    await writeFixture('crash-2026-04-21_15.04.22-client.txt', fixtureBody)

    const r = (await mocks.handlers.get('logs:read-crash')?.(
      {} as unknown,
      { crashId: 'crash-2026-04-21_15.04.22-client.txt' }
    )) as { sanitizedBody: string }

    expect(r.sanitizedBody).not.toContain('ey.fakeTokenBody123')
    // Redacted markers from auth/redact.ts patterns should be present.
    expect(r.sanitizedBody).toMatch(/\[REDACTED\]|<USER>/)
  })

  it('Test 5: logs:open-crash-folder with crashId reveals that file via shell.showItemInFolder', async () => {
    await register()
    await mocks.handlers.get('logs:open-crash-folder')?.(
      {} as unknown,
      { crashId: 'crash-abc-client.txt' }
    )
    expect(mocks.shell.showItemInFolder).toHaveBeenCalledTimes(1)
    const arg = mocks.shell.showItemInFolder.mock.calls[0]?.[0] as string
    expect(arg).toBe(path.join(crashDir, 'crash-abc-client.txt'))
  })

  it('Test 5b: logs:open-crash-folder without crashId opens the folder itself', async () => {
    await register()
    await mocks.handlers.get('logs:open-crash-folder')?.({} as unknown, null)
    expect(mocks.shell.showItemInFolder).toHaveBeenCalledTimes(1)
    const arg = mocks.shell.showItemInFolder.mock.calls[0]?.[0] as string
    expect(arg).toBe(crashDir)
  })

  it('Test 6: logs:list-crashes returns {crashes: [...]} matching listCrashReports output (newest first)', async () => {
    await register()
    await writeFixture('crash-2026-04-20_10.00.00-client.txt', 'a')
    await writeFixture('crash-2026-04-21_15.04.22-client.txt', 'b')

    const r = (await mocks.handlers.get('logs:list-crashes')?.(
      {} as unknown
    )) as { crashes: Array<{ crashId: string }> }

    // Verify the main-side module's real newest-first ordering is preserved.
    const expected = await crashReportModule.listCrashReports(crashDir)
    expect(r.crashes.map((c) => c.crashId)).toEqual(expected)
    // And newest is first.
    expect(r.crashes[0].crashId).toBe('crash-2026-04-21_15.04.22-client.txt')
  })
})
