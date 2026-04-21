/**
 * JVM spawn via execa 9.x — the ONE entry point to the game process.
 *
 * Pitfall 4 (PITFALLS.md §Pitfall 4 / STACK.md §What NOT to Use):
 *   `child_process.exec` buffers stdout at ~200 KB → Forge crash blocks get
 *   truncated mid-stack-trace → the crash viewer shows partial garbage.
 *   This module uses execa's streaming stdio only; NEVER child_process.exec.
 *
 * JRE-03 invariant (REQUIREMENTS.md):
 *   spawnGame refuses to spawn any java binary whose path does not contain
 *   'resources/jre/'. Every call site MUST pass a javaPath produced by
 *   paths.ts::resolveJavaBinary(). This prevents accidental system-Java
 *   usage — critical because our 1.8.9 launch only supports Temurin 8 /
 *   Zulu 8 and the user's system Java could be anything.
 *
 * Pitfall 7 (Windows): Callers MUST pass `javaw.exe`, not `java.exe`, to avoid
 *   spawning a phantom black console window. paths.ts::resolveJavaBinary()
 *   enforces this; this module trusts the caller.
 *
 * Cancel wiring: AbortSignal → execa's `cancelSignal` option. Used by D-13
 *   developer-mode cancel; Phase 3 production cancel (during Downloading/
 *   Verifying) operates on the xmcl installer, not this wrapper.
 *
 * Shape of this module:
 *   spawnGame({ javaPath, argv, cwd, abortSignal?, onLine? })
 *     → Promise<{ exitCode: number | null }>
 *
 *   - Clean exit (code 0)                → resolves { exitCode: 0 }
 *   - Non-zero exit                      → resolves { exitCode: N }
 *     (caught via ExecaError; Plan 03-10's orchestrator uses this
 *      to trigger the crash viewer when N !== 0)
 *   - Aborted via cancelSignal           → resolves { exitCode: null → -1 }
 *   - Developer-surface bug (non-ExecaError) → rethrown
 *
 * Source: RESEARCH.md §JVM Spawn (verbatim wrapper shape) + §Common Pitfalls 4 + §Common Pitfalls 7.
 */

import { execa, ExecaError, type Subprocess } from 'execa'

export interface SpawnOpts {
  /** Absolute path to the bundled Java binary. MUST contain 'resources/jre/'. */
  javaPath: string
  /** Full argv: jvmArgs + mainClass + gameArgs from buildArgv(). */
  argv: string[]
  /** Working directory for the JVM. Mojang expects the game-dir as cwd. */
  cwd: string
  /** Optional cancel signal; wired to execa's `cancelSignal` option. */
  abortSignal?: AbortSignal
  /** Optional per-line stdout/stderr callback. Lines are split on \\r?\\n. */
  onLine?: (line: string, stream: 'out' | 'err') => void
}

export interface SpawnResult {
  /**
   * Process exit code. `0` = clean; positive = non-zero exit; `-1` = signal-
   * killed or aborted (ExecaError with null exitCode is normalized to -1).
   */
  exitCode: number | null
}

/**
 * Cross-platform bundled-JRE detector. Accepts both POSIX ('/resources/jre/')
 * and Windows ('\\resources\\jre\\') forms by normalizing to forward slashes.
 */
function isBundledJre(javaPath: string): boolean {
  const normalized = javaPath.replace(/\\/g, '/')
  return /\/resources\/jre\//.test(normalized)
}

/**
 * Spawn the JVM. See module doc for full contract.
 */
export async function spawnGame(opts: SpawnOpts): Promise<SpawnResult> {
  if (!isBundledJre(opts.javaPath)) {
    throw new Error(
      `JRE-03: javaPath must be bundled JRE (contain 'resources/jre/'). Got: ${opts.javaPath}`
    )
  }

  // NOTE: typed loosely — execa's generic Subprocess type is tightly bound to
  // the options object shape; we only need `stdout`/`stderr`/await here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub: Subprocess<any> = execa(opts.javaPath, opts.argv, {
    cwd: opts.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    cancelSignal: opts.abortSignal,
    all: false, // keep stdout/stderr separate for per-stream tagging
    env: {
      ...process.env,
      // Prevent env-override of heap args (`_JAVA_OPTIONS` is prepended by the
      // JVM to every invocation). Explicitly set to undefined so no user-side
      // env var can override our `-Xmx` / `-Xms`.
      _JAVA_OPTIONS: undefined
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as Subprocess<any>

  if (opts.onLine) {
    const split =
      (stream: 'out' | 'err') =>
      (chunk: Buffer | string): void => {
        const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
        for (const line of text.split(/\r?\n/)) {
          if (line.length > 0) opts.onLine!(line, stream)
        }
      }
    sub.stdout?.on('data', split('out'))
    sub.stderr?.on('data', split('err'))
  }

  try {
    const r = await sub
    return { exitCode: r.exitCode ?? 0 }
  } catch (err) {
    // Non-zero exit, signal-killed, or aborted → ExecaError carries exitCode.
    // Plan 03-10's orchestrator treats `exitCode !== 0` as the crash trigger.
    if (err instanceof ExecaError) {
      return { exitCode: err.exitCode ?? -1 }
    }
    // Developer bug (type error, missing module, etc.) — surface it.
    throw err
  }
}
