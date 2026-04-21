// @vitest-environment node
/**
 * Unit tests for spawn.ts — the single execa wrapper for JVM spawning.
 *
 * Covers:
 *   - JRE-03 invariant (javaPath must contain 'resources/jre/')
 *   - execa call signature (cwd, stdio, cancelSignal, all=false, env)
 *   - line-split streaming (stdout + stderr, per-line onLine callback)
 *   - stream-tag correctness ('out' vs 'err')
 *   - blank-line filter
 *   - exit-code plumbing (resolves {exitCode} for both success and ExecaError)
 *   - abort signal behaviour (aborted → ExecaError → resolves with exit code)
 *   - degenerate stdout/stderr null stream
 *
 * Note: tests mock execa entirely via vi.mock; no real child process is spawned.
 * The E2E test (e2e.test.ts) exercises the real pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

// --- Mock execa ---------------------------------------------------------

// Custom ExecaError shape matching execa 9.x public API (class extends Error,
// has exitCode + isCanceled properties). spawn.ts uses `instanceof ExecaError`.
class MockExecaError extends Error {
  exitCode: number | null = -1
  isCanceled = false
  constructor(message: string, props: { exitCode?: number | null; isCanceled?: boolean } = {}) {
    super(message)
    this.name = 'ExecaError'
    if (props.exitCode !== undefined) this.exitCode = props.exitCode
    if (props.isCanceled !== undefined) this.isCanceled = props.isCanceled
  }
}

const execaMock = vi.fn()

vi.mock('execa', () => ({
  execa: (...args: unknown[]) => execaMock(...args),
  ExecaError: MockExecaError
}))

// Dynamic import AFTER the mock so spawn.ts binds to the mocked execa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let spawnGame: typeof import('./spawn').spawnGame

beforeEach(async () => {
  execaMock.mockReset()
  vi.resetModules()
  const mod = await import('./spawn')
  spawnGame = mod.spawnGame
})

/**
 * Build a fake Subprocess: a Promise<{exitCode}> with attached stdout/stderr
 * EventEmitters and settle helpers for the test to drive resolution.
 */
function makeFakeSub(): {
  sub: Promise<{ exitCode: number | null }> & {
    stdout: EventEmitter
    stderr: EventEmitter
  }
  resolveWith: (code: number) => void
  rejectWith: (err: Error) => void
} {
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  let resolveFn!: (v: { exitCode: number | null }) => void
  let rejectFn!: (err: Error) => void
  const p = new Promise<{ exitCode: number | null }>((res, rej) => {
    resolveFn = res
    rejectFn = rej
  })
  const wrapped = Object.assign(p, { stdout, stderr }) as Promise<{ exitCode: number | null }> & {
    stdout: EventEmitter
    stderr: EventEmitter
  }
  return {
    sub: wrapped,
    resolveWith: (code) => resolveFn({ exitCode: code }),
    rejectWith: (err) => rejectFn(err)
  }
}

// A path that satisfies the JRE-03 invariant (contains 'resources/jre/').
const BUNDLED_JAVA = '/app/resources/jre/mac-arm64/Contents/Home/bin/java'
const BUNDLED_JAVA_WIN = 'C:\\app\\resources\\jre\\win-x64\\bin\\javaw.exe'

// --- Tests --------------------------------------------------------------

describe('spawnGame — JRE-03 invariant', () => {
  it('throws synchronously when javaPath is outside resources/jre/ (system PATH Java rejected)', async () => {
    await expect(
      spawnGame({ javaPath: '/usr/bin/java', argv: [], cwd: '/tmp' })
    ).rejects.toThrow(/bundled JRE/)
    expect(execaMock).not.toHaveBeenCalled()
  })

  it('accepts a path containing resources/jre/ (forward slash)', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const promise = spawnGame({ javaPath: BUNDLED_JAVA, argv: [], cwd: '/tmp' })
    resolveWith(0)
    await expect(promise).resolves.toEqual({ exitCode: 0 })
  })

  it('accepts a Windows-style path with backslashes (normalized for JRE-03 check)', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const promise = spawnGame({ javaPath: BUNDLED_JAVA_WIN, argv: [], cwd: 'C:\\tmp' })
    resolveWith(0)
    await expect(promise).resolves.toEqual({ exitCode: 0 })
  })
})

describe('spawnGame — execa call signature', () => {
  it('invokes execa with javaPath, argv, and the exact options shape', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const ctrl = new AbortController()
    const promise = spawnGame({
      javaPath: BUNDLED_JAVA,
      argv: ['-Xmx2048M', 'net.minecraft.client.main.Main'],
      cwd: '/game',
      abortSignal: ctrl.signal
    })
    resolveWith(0)
    await promise

    expect(execaMock).toHaveBeenCalledTimes(1)
    const [file, args, opts] = execaMock.mock.calls[0]
    expect(file).toBe(BUNDLED_JAVA)
    expect(args).toEqual(['-Xmx2048M', 'net.minecraft.client.main.Main'])
    expect(opts.cwd).toBe('/game')
    expect(opts.stdio).toEqual(['ignore', 'pipe', 'pipe'])
    expect(opts.cancelSignal).toBe(ctrl.signal)
    expect(opts.all).toBe(false)
    expect(opts.env).toBeDefined()
    // _JAVA_OPTIONS is explicitly set to undefined so a user env var cannot override heap args.
    expect(opts.env._JAVA_OPTIONS).toBeUndefined()
    expect('_JAVA_OPTIONS' in opts.env).toBe(true)
  })
})

describe('spawnGame — line-split streaming', () => {
  it('splits stdout chunks on \\n and calls onLine once per non-empty line tagged "out"', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const lines: Array<[string, 'out' | 'err']> = []
    const promise = spawnGame({
      javaPath: BUNDLED_JAVA,
      argv: [],
      cwd: '/tmp',
      onLine: (line, stream) => lines.push([line, stream])
    })
    sub.stdout.emit('data', Buffer.from('line1\nline2\n'))
    sub.stdout.emit('data', Buffer.from('line3\n'))
    resolveWith(0)
    await promise

    expect(lines).toEqual([
      ['line1', 'out'],
      ['line2', 'out'],
      ['line3', 'out']
    ])
  })

  it('tags stderr chunks with "err"', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const lines: Array<[string, 'out' | 'err']> = []
    const promise = spawnGame({
      javaPath: BUNDLED_JAVA,
      argv: [],
      cwd: '/tmp',
      onLine: (line, stream) => lines.push([line, stream])
    })
    sub.stderr.emit('data', Buffer.from('error line\n'))
    resolveWith(0)
    await promise

    expect(lines).toEqual([['error line', 'err']])
  })

  it('does NOT report blank lines (trailing newline splits)', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const lines: string[] = []
    const promise = spawnGame({
      javaPath: BUNDLED_JAVA,
      argv: [],
      cwd: '/tmp',
      onLine: (line) => lines.push(line)
    })
    // Trailing \n produces an empty trailing element when split — must be filtered.
    sub.stdout.emit('data', Buffer.from('only\n\n'))
    resolveWith(0)
    await promise

    expect(lines).toEqual(['only'])
  })

  it('handles \\r\\n (Windows-style) line endings', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const lines: string[] = []
    const promise = spawnGame({
      javaPath: BUNDLED_JAVA,
      argv: [],
      cwd: '/tmp',
      onLine: (line) => lines.push(line)
    })
    sub.stdout.emit('data', Buffer.from('windows1\r\nwindows2\r\n'))
    resolveWith(0)
    await promise

    expect(lines).toEqual(['windows1', 'windows2'])
  })
})

describe('spawnGame — exit code plumbing', () => {
  it('returns {exitCode: 0} on clean exit', async () => {
    const { sub, resolveWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const promise = spawnGame({ javaPath: BUNDLED_JAVA, argv: [], cwd: '/tmp' })
    resolveWith(0)
    await expect(promise).resolves.toEqual({ exitCode: 0 })
  })

  it('returns {exitCode: 1} on non-zero exit (caught ExecaError, NOT rethrown)', async () => {
    const { sub, rejectWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const promise = spawnGame({ javaPath: BUNDLED_JAVA, argv: [], cwd: '/tmp' })
    rejectWith(new MockExecaError('crashed', { exitCode: 1 }))
    await expect(promise).resolves.toEqual({ exitCode: 1 })
  })

  it('returns {exitCode: -1} when ExecaError has null exitCode (e.g. signal-killed)', async () => {
    const { sub, rejectWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const promise = spawnGame({ javaPath: BUNDLED_JAVA, argv: [], cwd: '/tmp' })
    rejectWith(new MockExecaError('killed', { exitCode: null }))
    await expect(promise).resolves.toEqual({ exitCode: -1 })
  })

  it('rethrows non-ExecaError errors (developer-surface bugs are not swallowed)', async () => {
    const { sub, rejectWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const promise = spawnGame({ javaPath: BUNDLED_JAVA, argv: [], cwd: '/tmp' })
    const bug = new TypeError('developer mistake')
    rejectWith(bug)
    await expect(promise).rejects.toThrow(/developer mistake/)
  })
})

describe('spawnGame — abort signal', () => {
  it('passes the abort signal through as execa.cancelSignal and resolves with exit code when aborted', async () => {
    const { sub, rejectWith } = makeFakeSub()
    execaMock.mockReturnValue(sub)
    const ctrl = new AbortController()
    const promise = spawnGame({
      javaPath: BUNDLED_JAVA,
      argv: [],
      cwd: '/tmp',
      abortSignal: ctrl.signal
    })
    // Simulate execa reacting to abort: rejects with ExecaError.isCanceled=true + null exitCode.
    ctrl.abort()
    rejectWith(new MockExecaError('canceled', { exitCode: null, isCanceled: true }))
    await expect(promise).resolves.toEqual({ exitCode: -1 })
  })
})

describe('spawnGame — degenerate subprocess', () => {
  it('returns exit code without throwing when stdout/stderr are null (defensive)', async () => {
    // Build a sub where stdout/stderr are undefined — shouldn't happen with
    // stdio:'pipe' but spawn.ts uses optional chaining to stay safe.
    let resolveFn!: (v: { exitCode: number | null }) => void
    const p = new Promise<{ exitCode: number | null }>((res) => {
      resolveFn = res
    })
    // Intentionally omit stdout/stderr.
    const degenerate = Object.assign(p, {}) as unknown as Promise<{ exitCode: number | null }> & {
      stdout: EventEmitter | null
      stderr: EventEmitter | null
    }
    execaMock.mockReturnValue(degenerate)
    const promise = spawnGame({
      javaPath: BUNDLED_JAVA,
      argv: [],
      cwd: '/tmp',
      onLine: () => {
        /* should never fire */
      }
    })
    resolveFn({ exitCode: 0 })
    await expect(promise).resolves.toEqual({ exitCode: 0 })
  })
})
