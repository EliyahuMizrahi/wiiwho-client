// @vitest-environment node
/**
 * Integration test for the spawn pipeline — uses `node` as a stand-in JVM.
 *
 * Strategy: copy the running `node` binary into a temp dir whose path
 * contains 'resources/jre/', so spawn.ts's JRE-03 check accepts it
 * WITHOUT any test-only API pollution on spawn.ts itself. Then drive
 * real end-to-end scenarios:
 *
 *   1. Fixture boot-log → sentinel detection + line streaming (LCH-05, LCH-07).
 *   2. Non-zero exit surfaces via exitCode (no throw — Plan 03-10 crash path).
 *   3. AbortSignal terminates a long-running process (D-13 dev-cancel).
 *   4. System-Java path is rejected (JRE-03 invariant — real-world assertion).
 *
 * No real JVM + no real Minecraft required. This proves the full stdout-line
 * plumbing that Phase 3's orchestrator (Plan 03-10) will rely on.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawnGame } from './spawn'

let tmpRoot: string
let fakeJavaPath: string

beforeAll(async () => {
  tmpRoot = path.join(os.tmpdir(), `wiiwho-e2e-${randomUUID()}`)
  // Deliberately include 'resources/jre/' in the path so spawn.ts's JRE-03
  // invariant passes without needing a test-only bypass hook.
  const fakeJreBinDir = path.join(tmpRoot, 'resources', 'jre', 'testslot', 'bin')
  await fs.mkdir(fakeJreBinDir, { recursive: true })
  const exe = process.platform === 'win32' ? 'node.exe' : 'node'
  fakeJavaPath = path.join(fakeJreBinDir, exe)
  await fs.copyFile(process.execPath, fakeJavaPath)
  if (process.platform !== 'win32') await fs.chmod(fakeJavaPath, 0o755)
})

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

describe('spawn e2e — dummy-java', () => {
  it('streams fixture boot-log lines and detects the "Sound engine started" sentinel; exits 0', async () => {
    const fixturePath = path.join(__dirname, '../monitor/__fixtures__/1.8.9-boot-log.txt')
    const fixture = readFileSync(fixturePath, 'utf8')
    const fixtureLines = fixture.split(/\r?\n/).filter((l) => l.length > 0)

    // Build a node `-e` script that prints the fixture lines and exits cleanly.
    const script = `
      const lines = ${JSON.stringify(fixtureLines)};
      for (const l of lines) console.log(l);
      process.exit(0);
    `
    const captured: Array<{ line: string; stream: 'out' | 'err' }> = []
    const result = await spawnGame({
      javaPath: fakeJavaPath,
      argv: ['-e', script],
      cwd: tmpRoot,
      onLine: (line, stream) => captured.push({ line, stream })
    })

    expect(result.exitCode).toBe(0)
    // Every fixture line should flow through onLine — no buffering, no drops.
    expect(captured.length).toBe(fixtureLines.length)
    // The main-menu sentinel (D-16) must appear exactly once.
    const sentinelHits = captured.filter((c) => /Sound engine started/.test(c.line))
    expect(sentinelHits.length).toBe(1)
    expect(sentinelHits[0].stream).toBe('out')
  })

  it('returns non-zero exitCode without throwing (Plan 03-10 crash detection)', async () => {
    const result = await spawnGame({
      javaPath: fakeJavaPath,
      argv: ['-e', 'process.exit(42)'],
      cwd: tmpRoot,
      onLine: () => {
        /* ignore */
      }
    })
    expect(result.exitCode).toBe(42)
  })

  it('aborts a long-running process via AbortSignal (D-13 dev-cancel)', async () => {
    const ctrl = new AbortController()
    const startedAt = Date.now()
    setTimeout(() => ctrl.abort(), 100)

    const result = await spawnGame({
      javaPath: fakeJavaPath,
      // setInterval with a no-op keeps the event loop alive until aborted.
      argv: ['-e', 'setInterval(()=>{}, 1000)'],
      cwd: tmpRoot,
      abortSignal: ctrl.signal,
      onLine: () => {
        /* ignore */
      }
    })

    const elapsed = Date.now() - startedAt
    expect(elapsed).toBeLessThan(5000)
    // SIGTERM (POSIX) or forced termination (Windows) → non-zero exit.
    expect(result.exitCode).not.toBe(0)
  }, 10_000)

  it('rejects a non-bundled Java path (JRE-03 invariant — real rejection)', async () => {
    await expect(
      spawnGame({
        javaPath: '/usr/bin/java', // no 'resources/jre/' in path
        argv: ['-version'],
        cwd: tmpRoot,
        onLine: () => {
          /* ignore */
        }
      })
    ).rejects.toThrow(/bundled JRE/)
  })
})
