---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 05
type: execute
wave: 2
depends_on: ["03-00", "03-01", "03-04"]
files_modified:
  - launcher/src/main/launch/spawn.ts
  - launcher/src/main/launch/spawn.test.ts
  - launcher/src/main/launch/e2e.test.ts
autonomous: true
requirements:
  - LCH-05
  - LCH-07
  - JRE-03
must_haves:
  truths:
    - "spawnGame invokes execa (NOT child_process.exec — Pitfall 4) with streaming stdio"
    - "spawnGame asserts javaPath begins with `resources/jre/` — refuses system PATH Java (JRE-03)"
    - "AbortSignal passed to spawnGame cancels the JVM (execa cancelSignal) — supports D-13 dev-mode cancel"
    - "stdout + stderr are line-split and reported via onLine callback — no 200 KB truncation"
    - "exit code is returned or thrown through ExecaError (not swallowed)"
    - "E2E test: dummy java-equivalent prints `Sound engine started` + exits 0 → onLine fires ≥ N times, exitCode === 0"
  artifacts:
    - path: "launcher/src/main/launch/spawn.ts"
      provides: "spawnGame — the ONE entry into execa for the JVM"
      exports: ["spawnGame", "SpawnOpts", "SpawnResult"]
    - path: "launcher/src/main/launch/spawn.test.ts"
      provides: "Unit tests with execa mocked (stream simulation, abort, JRE-path assertion)"
    - path: "launcher/src/main/launch/e2e.test.ts"
      provides: "Integration test using `node -e 'console.log(...); process.exit(0)'` as a stand-in JVM"
  key_links:
    - from: "launcher/src/main/launch/spawn.ts"
      to: "execa 9.x"
      via: "spawn + cancelSignal + stdio pipe"
      pattern: "import.*from 'execa'"
    - from: "launcher/src/main/launch/spawn.ts"
      to: "launcher/src/main/paths.ts resolveJavaBinary"
      via: "JRE-path invariant check"
      pattern: "resources/jre"
---

<objective>
Wrap execa 9.x into a single `spawnGame(opts) → Promise<{ exitCode }>`. It's the ONLY place in the codebase where a JVM is spawned — Plan 03-10's orchestrator goes through this. The wrapper:

1. Uses `execa` (never `child_process.exec` — Pitfall 4).
2. Streams stdout/stderr and fires `onLine(line, stream)` per line (no buffering; no 200 KB truncation).
3. Accepts an `AbortSignal` that cancels the JVM via execa's `cancelSignal` option.
4. Asserts `javaPath` starts with the bundled-JRE path (JRE-03 — the launcher NEVER spawns a system Java).
5. Returns `{ exitCode }` for clean exits; for spawn errors, rethrows via ExecaError.

Plus a dummy-java E2E integration test that proves the full spawn → log-line → exit pipeline end-to-end using `node -e "..."` as a surrogate JVM (no real Minecraft needed).

Output: spawn.ts + unit tests + E2E test. Foundation for Plan 03-10's orchestrator.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/main/paths.ts
@launcher/src/main/launch/args.ts

<interfaces>
From execa 9.x (verify in launcher/node_modules/execa/index.d.ts):
```typescript
// execa(file, args, options) returns a Subprocess (a Promise-like with stdout/stderr streams)
// Key options for this plan:
//   cwd: string
//   stdio: ['ignore', 'pipe', 'pipe']
//   cancelSignal: AbortSignal
//   all: boolean                    // false → stdout+stderr separate
//   env: Record<string, string | undefined>
```

From RESEARCH.md §JVM Spawn (code block):
```typescript
const sub = execa(opts.javaPath, opts.argv, {
  cwd: opts.cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
  cancelSignal: opts.abortSignal,
  all: false,
  env: { ...process.env, _JAVA_OPTIONS: undefined }  // avoid env override of heap
})
const split = (stream: 'out' | 'err') => (chunk: Buffer) =>
  chunk.toString('utf8').split(/\r?\n/).forEach(line => line && opts.onLine(line, stream))
sub.stdout?.on('data', split('out'))
sub.stderr?.on('data', split('err'))
const r = await sub
return { exitCode: r.exitCode ?? 0 }
```

Exact keys per execa 9.x — verify `cancelSignal` is the correct option name (vs `signal`). RESEARCH.md §Standard Stack notes "cancelSignal verified current" for execa 9.x.

From Plan 03-01 paths.ts:
```typescript
export function resolveJavaBinary(): string  // returns path containing 'resources/jre/'
```

JRE-03 assertion: `spawn.ts` must assert `opts.javaPath.includes('resources/jre')` OR `opts.javaPath.includes('resources' + path.sep + 'jre')` — reject if not. This prevents accidental system-Java usage (e.g., if paths.ts is bypassed in dev).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: spawn.ts — execa wrapper with JRE-path assertion + line-split streaming</name>
  <files>
    launcher/src/main/launch/spawn.ts,
    launcher/src/main/launch/spawn.test.ts
  </files>
  <read_first>
    - launcher/node_modules/execa/index.d.ts (verify `cancelSignal` option name, `ExecaError` export, `Subprocess` shape)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §JVM Spawn (code block to copy verbatim)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Common Pitfalls 4 (no child_process.exec)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Common Pitfalls 7 (javaw.exe on Windows)
    - launcher/src/main/paths.ts (resolveJavaBinary — the path we assert against)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1 (JRE-03 invariant): `spawnGame({javaPath: '/usr/bin/java', argv: []})` throws synchronously with message containing "must be bundled JRE" or similar. Accepts `/any/path/resources/jre/.../bin/java` without throwing.
    - Test 2 (execa call): Mock `execa` via `vi.mock('execa', ...)` and assert `spawnGame` calls it with exact args: `(javaPath, argv, { cwd, stdio: ['ignore','pipe','pipe'], cancelSignal: signal, all: false, env: {..., _JAVA_OPTIONS: undefined } })`.
    - Test 3 (line streaming): Feed a fake stdout stream emitting two chunks `Buffer.from('line1\nline2\n')`, `Buffer.from('line3\n')`. Assert `onLine` called with `('line1','out')`, `('line2','out')`, `('line3','out')` in order. NOT ('line1\nline2\n').
    - Test 4 (stream tag — stderr): stderr chunks tagged `'err'`, not `'out'`.
    - Test 5 (blank-line filter): Empty lines (trailing `\n` splits) are NOT reported via onLine.
    - Test 6 (exit code): Execa resolves with `{exitCode: 0}` → `spawnGame` resolves `{exitCode: 0}`.
    - Test 7 (exit code non-zero): Execa rejects with `ExecaError {exitCode: 1}` → `spawnGame` resolves `{exitCode: 1}` (caught; NOT rethrown). This is how D-17 Plan 03-10 detects crashes.
    - Test 8 (abort): Passing an `AbortSignal` that's already aborted causes execa to reject and `spawnGame` returns `{exitCode: null}` or `{exitCode: -1}` (confirm actual execa behavior in installed version).
    - Test 9 (stream missing): If `sub.stdout` is null (degenerate — shouldn't happen with `stdio: pipe`), spawnGame still returns the exit code and doesn't throw.

    Use `vi.mock('execa', () => ({ execa: vi.fn(), ExecaError: class ExecaError extends Error {exitCode = -1} }))` and construct a fake `sub` object with `.stdout.on`, `.stderr.on`, and Promise-resolution behavior.
  </behavior>
  <action>
    Create `launcher/src/main/launch/spawn.ts`:

    ```typescript
    /**
     * JVM spawn via execa 9.x — the ONE entry point to the game process.
     *
     * Pitfall 4: child_process.exec truncates stdout at ~200 KB → crash logs
     * get lost. execa streams; never uses exec.
     *
     * JRE-03 invariant: refuses to spawn a non-bundled Java. Every call site
     * MUST pass a javaPath that includes 'resources/jre/' — i.e., came from
     * paths.ts::resolveJavaBinary().
     *
     * Cancel: AbortSignal wired to execa's `cancelSignal` option.
     *
     * Source: RESEARCH.md §JVM Spawn (code block) + §Common Pitfalls 4.
     */

    import { execa, ExecaError, type Subprocess } from 'execa'
    import path from 'node:path'

    export interface SpawnOpts {
      javaPath: string                // absolute — MUST contain 'resources/jre/'
      argv: string[]                  // full argv from buildArgv(): jvmArgs + mainClass + gameArgs
      cwd: string                     // resolveGameDir() — Mojang expects game-dir as cwd
      abortSignal?: AbortSignal
      onLine?: (line: string, stream: 'out' | 'err') => void
    }

    export interface SpawnResult {
      exitCode: number | null
    }

    /** Cross-platform contains-check for the bundled JRE marker. */
    function isBundledJre(javaPath: string): boolean {
      // Accept forward slash (dev / macOS) and backslash (Windows packaged).
      const normalized = javaPath.replace(/\\/g, '/')
      return /\/resources\/jre\//.test(normalized)
    }

    export async function spawnGame(opts: SpawnOpts): Promise<SpawnResult> {
      if (!isBundledJre(opts.javaPath)) {
        throw new Error(
          `JRE-03: javaPath must be bundled JRE (contain 'resources/jre/'). Got: ${opts.javaPath}`
        )
      }

      let sub: Subprocess<Record<string, never>>
      try {
        sub = execa(opts.javaPath, opts.argv, {
          cwd: opts.cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
          cancelSignal: opts.abortSignal,
          all: false,
          env: {
            ...process.env,
            // Avoid env-override of heap (PITFALLS §Pitfall 5 — no user-controlled JVM args).
            _JAVA_OPTIONS: undefined
          }
        }) as Subprocess<Record<string, never>>
      } catch (err) {
        // Spawn failed synchronously (e.g., ENOENT on javaPath). Treat as crash.
        throw err
      }

      if (opts.onLine) {
        const split = (stream: 'out' | 'err') => (chunk: Buffer): void => {
          const text = chunk.toString('utf8')
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
        // Non-zero exit, signal-killed, or aborted — ExecaError carries exitCode.
        if (err instanceof ExecaError) {
          return { exitCode: err.exitCode ?? -1 }
        }
        throw err
      }
    }
    ```

    Write `spawn.test.ts` with the 9 tests listed in `<behavior>`.

    **Mock pattern for execa 9 (ESM):**

    ```typescript
    import { EventEmitter } from 'node:events'

    // Helper to build a fake Subprocess
    function makeFake(): {
      sub: Promise<{ exitCode: number }> & { stdout: EventEmitter; stderr: EventEmitter }
      resolveWith: (code: number) => void
      rejectWith: (err: Error & { exitCode?: number }) => void
    } {
      const stdout = new EventEmitter()
      const stderr = new EventEmitter()
      let resolveFn!: (v: { exitCode: number }) => void
      let rejectFn!: (err: Error) => void
      const p = new Promise<{ exitCode: number }>((res, rej) => { resolveFn = res; rejectFn = rej })
      const wrapped = Object.assign(p, { stdout, stderr })
      return {
        sub: wrapped as unknown as Promise<{ exitCode: number }> & { stdout: EventEmitter; stderr: EventEmitter },
        resolveWith: (code) => resolveFn({ exitCode: code }),
        rejectWith: (err) => rejectFn(err)
      }
    }

    vi.mock('execa', () => ({
      execa: vi.fn(),
      ExecaError: class ExecaError extends Error { exitCode: number | null = -1 }
    }))
    ```

    Validate execa mock signatures match the installed package. ExecaError constructor shape differs slightly across execa versions — read the installed `index.d.ts` and mirror.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/launch/spawn.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export async function spawnGame" launcher/src/main/launch/spawn.ts`
    - `grep -q "import.*from 'execa'" launcher/src/main/launch/spawn.ts`
    - `grep -q "resources/jre" launcher/src/main/launch/spawn.ts` (JRE-03 invariant)
    - `grep -q "must be bundled JRE" launcher/src/main/launch/spawn.ts`
    - `grep -q "cancelSignal" launcher/src/main/launch/spawn.ts`
    - `grep -q "_JAVA_OPTIONS: undefined" launcher/src/main/launch/spawn.ts` (env override guard)
    - `grep -q "split(/\\\\r\\?\\\\n/)" launcher/src/main/launch/spawn.ts || grep -q 'split(/\\r\\?\\n/)' launcher/src/main/launch/spawn.ts` (line splitting — cross-platform)
    - `grep -qv "child_process" launcher/src/main/launch/spawn.ts` (Pitfall 4 — never imports child_process)
    - `grep -qv "exec(" launcher/src/main/launch/spawn.ts` (no stray exec call)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/spawn.test.ts` exits 0 with ≥9 tests passing
  </acceptance_criteria>
  <done>spawn.ts wraps execa with JRE-path invariant, line-split streaming, cancel wiring, exit-code resolution — all 9 tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: e2e.test.ts — dummy-java integration test</name>
  <files>
    launcher/src/main/launch/e2e.test.ts
  </files>
  <read_first>
    - launcher/src/main/launch/spawn.ts (Task 1 — the function under test)
    - launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt (for the sentinel string content)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Main-Menu Detection (exact sentinel to print)
  </read_first>
  <behavior>
    Tests MUST cover (integration test — real process spawn):
    - Test 1: `spawnGame` spawning `node` as a stand-in "JVM" with `-e` running a script that prints the Mojang boot-log fixture and exits 0 → `onLine` called at least 13 times (one per line in fixture minus blanks) → `exitCode === 0`.
    - Test 2: The sentinel line `[Sound Library Loader/INFO]: Sound engine started` appears in the captured lines exactly once.
    - Test 3: Non-zero exit: `node -e "process.exit(1)"` → `spawnGame` returns `{exitCode: 1}` without throwing.
    - Test 4: Abort signal mid-run: spawn a long-running `node -e "setTimeout(()=>{}, 10000)"`, abort after 100 ms, assert spawnGame resolves within 1 second with `exitCode !== 0`.

    **JRE-03 complication:** spawn.ts enforces `resources/jre/` in the javaPath. For this integration test, we need to bypass that check OR fake the path. Options:
    1. Add a test-only hook to spawn.ts: `spawnGame({javaPath: '...', __testSkipJreCheck: true})` — CLEAN but pollutes prod API.
    2. Symlink `node` into a temp dir containing `.../resources/jre/bin/` then pass that path — PURE test-side, no prod API pollution. **PREFER option 2.**

    Using option 2:
    ```typescript
    beforeAll(async () => {
      const nodePath = process.execPath
      const fakeJreBinDir = path.join(os.tmpdir(), 'wiiwho-test-jre', 'resources', 'jre', 'bin')
      await fs.mkdir(fakeJreBinDir, { recursive: true })
      fakeJavaPath = path.join(fakeJreBinDir, process.platform === 'win32' ? 'node.exe' : 'node')
      await fs.copyFile(nodePath, fakeJavaPath)
      // On Unix, ensure executable bit
      if (process.platform !== 'win32') await fs.chmod(fakeJavaPath, 0o755)
    })
    ```

    This gives us a real binary at a path containing `resources/jre/` so the JRE-03 check passes and we can assert the full pipeline.
  </behavior>
  <action>
    Create `launcher/src/main/launch/e2e.test.ts`:

    ```typescript
    // @vitest-environment node
    /**
     * Integration test for the spawn pipeline using `node` as a stand-in JVM.
     *
     * Prep: copy `node` binary into a temp dir that contains 'resources/jre/'
     * in the path, so spawn.ts's JRE-03 check passes without test-only hooks.
     *
     * Covers LCH-05 (spawn → log-line plumbing → exit) and LCH-07 (stdout
     * line-emission) end-to-end WITHOUT requiring a real JVM or real Minecraft.
     */

    import { describe, it, expect, beforeAll, afterAll } from 'vitest'
    import { promises as fs } from 'node:fs'
    import { readFileSync } from 'node:fs'
    import os from 'node:os'
    import path from 'node:path'
    import { randomUUID } from 'node:crypto'
    import { spawnGame } from './spawn'

    let tmpRoot: string
    let fakeJavaPath: string

    beforeAll(async () => {
      tmpRoot = path.join(os.tmpdir(), `wiiwho-e2e-${randomUUID()}`)
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
      it('emits all fixture boot-log lines and exits 0', async () => {
        const fixture = readFileSync(
          path.join(__dirname, '../monitor/__fixtures__/1.8.9-boot-log.txt'),
          'utf8'
        )
        const script = `
          const lines = ${JSON.stringify(fixture.split(/\r?\n/).filter(l => l))};
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
        expect(captured.length).toBeGreaterThan(10)
        const sentinelHits = captured.filter(c => /Sound engine started/.test(c.line))
        expect(sentinelHits.length).toBe(1)
      })

      it('non-zero exit code is returned (not thrown) — Plan 03-10 crash detection', async () => {
        const result = await spawnGame({
          javaPath: fakeJavaPath,
          argv: ['-e', 'process.exit(42)'],
          cwd: tmpRoot,
          onLine: () => {}
        })
        expect(result.exitCode).toBe(42)
      })

      it('abort signal terminates a long-running process', async () => {
        const ctrl = new AbortController()
        const startedAt = Date.now()
        setTimeout(() => ctrl.abort(), 100)
        const result = await spawnGame({
          javaPath: fakeJavaPath,
          argv: ['-e', 'setTimeout(()=>{}, 10000)'],
          cwd: tmpRoot,
          abortSignal: ctrl.signal,
          onLine: () => {}
        })
        expect(Date.now() - startedAt).toBeLessThan(2000)
        expect(result.exitCode).not.toBe(0)
      })

      it('rejects system java path (JRE-03 invariant)', async () => {
        await expect(
          spawnGame({
            javaPath: '/usr/bin/java', // no 'resources/jre/' in path
            argv: ['-version'],
            cwd: tmpRoot,
            onLine: () => {}
          })
        ).rejects.toThrow(/bundled JRE/)
      })
    })
    ```

    On Windows, ensure the `node.exe` copy works. On macOS, verify the chmod. If Windows AV flags the copied node.exe, document in SUMMARY and consider a `--no-check` env flag path.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/launch/e2e.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `launcher/src/main/launch/e2e.test.ts`
    - `grep -q "spawnGame" launcher/src/main/launch/e2e.test.ts`
    - `grep -q "Sound engine started" launcher/src/main/launch/e2e.test.ts` (sentinel check)
    - `grep -q "process.exit(42)" launcher/src/main/launch/e2e.test.ts || grep -q "exitCode.*42" launcher/src/main/launch/e2e.test.ts` (non-zero exit test)
    - `grep -q "AbortController" launcher/src/main/launch/e2e.test.ts` (abort test)
    - `grep -q "bundled JRE\\|JRE-03" launcher/src/main/launch/e2e.test.ts` (JRE-03 assertion test)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/e2e.test.ts` exits 0 with 4 tests passing on the executor's OS
  </acceptance_criteria>
  <done>E2E integration test passes on the executor's OS; sentinel detection plumbing proven end-to-end without needing a real JVM.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/main/launch/spawn.test.ts src/main/launch/e2e.test.ts` — all green
- `cd launcher && npm run typecheck` — no type regressions
- `cd launcher && npm run test:run` — full suite green
- JRE-03 invariant enforced by code + test: spawn.ts rejects any javaPath lacking `resources/jre/`
</verification>

<success_criteria>
- LCH-05: spawn → exit pipeline proven (E2E test)
- LCH-07: stdout line-emission proven (E2E test asserts ≥10 lines captured)
- JRE-03: bundled-JRE-only invariant tested both statically (unit) and dynamically (E2E)
- Pitfall 4 guarded: no `child_process.exec` import, execa does the streaming
- AbortSignal wired: D-13 dev cancel path testable
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-05-SUMMARY.md` documenting:
- Exact execa 9.x option names verified (cancelSignal vs signal, Subprocess shape)
- Whether the E2E node-copy approach worked on Windows without AV interference
- Any platform quirks (Windows path escaping, macOS signing on the copied node binary)
</output>
