// @vitest-environment node
/**
 * Tests for crashReport.ts.
 *
 * Pin points:
 *   - D-17: fs.watch <gameDir>/crash-reports/ fires iff a new
 *     crash-<timestamp>-client.txt file appears within deadlineMs (5s default).
 *     Resolve null on timeout.
 *   - D-19: listCrashReports / readCrashReport feed the "Open crash folder"
 *     and CrashViewer body.
 *   - Non-matching files (server crashes, .log files, anything without
 *     -client.txt suffix) are ignored.
 *
 * Uses real temp dirs — fs.watch behavior on Windows vs POSIX differs on
 * event types (rename vs change); the filename filter inside the watcher
 * is the real gate.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import {
  watchForCrashReport,
  readCrashReport,
  listCrashReports
} from './crashReport'

let dir: string

beforeEach(async () => {
  dir = path.join(os.tmpdir(), `wiiwho-crash-${randomUUID()}`)
  await fs.mkdir(dir, { recursive: true })
})

afterEach(async () => {
  // Best-effort cleanup — ignore if watcher still had a handle.
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
})

/** Small async delay — some tests need to let the watcher pick up events. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('watchForCrashReport', () => {
  it('resolves with filename when a new crash-*-client.txt file appears (happy path)', async () => {
    const filename = 'crash-2026-04-21_15.04.22-client.txt'
    const watchPromise = watchForCrashReport(dir, 2000)

    // Let the watcher actually attach before writing (fs.watch is async to set up).
    await sleep(50)
    await fs.writeFile(path.join(dir, filename), 'fake crash body', 'utf8')

    const result = await watchPromise
    expect(result).toBe(filename)
  })

  it('resolves null after deadlineMs elapses with no matching file', async () => {
    const start = Date.now()
    const result = await watchForCrashReport(dir, 100)
    const elapsed = Date.now() - start
    expect(result).toBeNull()
    expect(elapsed).toBeGreaterThanOrEqual(90) // allow small scheduler jitter
  })

  it('ignores non-client crash files (server crashes, .log, etc.) and only resolves on -client.txt', async () => {
    const watchPromise = watchForCrashReport(dir, 2000)
    await sleep(50)

    // Write distractors first — these must NOT trigger resolution.
    await fs.writeFile(path.join(dir, 'crash-server-2026-04-21.txt'), 'server', 'utf8')
    await fs.writeFile(path.join(dir, 'server.log'), 'log', 'utf8')
    await fs.writeFile(path.join(dir, 'some-other-file.txt'), 'nope', 'utf8')

    // Give the watcher a chance to see-and-ignore them.
    await sleep(100)

    // Now the real one.
    const real = 'crash-2026-04-21_15.04.22-client.txt'
    await fs.writeFile(path.join(dir, real), 'real crash', 'utf8')

    const result = await watchPromise
    expect(result).toBe(real)
  })

  it('resolves null when the watched directory does not exist (fs.watch throws)', async () => {
    const doesNotExist = path.join(dir, 'nope-child-does-not-exist')
    const result = await watchForCrashReport(doesNotExist, 100)
    expect(result).toBeNull()
  })
})

describe('readCrashReport', () => {
  it('returns the file contents unchanged (sanitization happens at IPC boundary, not here)', async () => {
    const filename = 'crash-2026-04-21_12.00.00-client.txt'
    const body =
      '---- Minecraft Crash Report ----\n// I let you down. Sorry :(\n\njava.lang.NullPointerException: boom\n'
    await fs.writeFile(path.join(dir, filename), body, 'utf8')
    const out = await readCrashReport(dir, filename)
    expect(out).toBe(body)
  })

  it('rejects when the target file is missing', async () => {
    await expect(readCrashReport(dir, 'crash-nope-client.txt')).rejects.toThrow()
  })
})

describe('listCrashReports', () => {
  it('returns ONLY crash-*-client.txt files, sorted newest-first by filename', async () => {
    // Mixed bag.
    await fs.writeFile(
      path.join(dir, 'crash-2026-04-19_10.00.00-client.txt'),
      'old',
      'utf8'
    )
    await fs.writeFile(
      path.join(dir, 'crash-2026-04-21_15.04.22-client.txt'),
      'new',
      'utf8'
    )
    await fs.writeFile(path.join(dir, 'crash-server-2026-04-20.txt'), 'server', 'utf8')
    await fs.writeFile(path.join(dir, 'latest.log'), 'log', 'utf8')

    const list = await listCrashReports(dir)
    expect(list).toEqual([
      'crash-2026-04-21_15.04.22-client.txt',
      'crash-2026-04-19_10.00.00-client.txt'
    ])
  })

  it('returns [] when the directory does not exist (e.g. no crashes yet)', async () => {
    const list = await listCrashReports(path.join(dir, 'no-such-subdir'))
    expect(list).toEqual([])
  })

  it('returns [] when the directory is empty', async () => {
    const list = await listCrashReports(dir)
    expect(list).toEqual([])
  })
})
