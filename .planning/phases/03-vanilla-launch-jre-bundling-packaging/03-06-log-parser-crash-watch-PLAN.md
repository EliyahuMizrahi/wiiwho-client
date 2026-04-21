---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 06
type: execute
wave: 2
depends_on: ["03-00", "03-01"]
files_modified:
  - launcher/src/main/monitor/logParser.ts
  - launcher/src/main/monitor/logParser.test.ts
  - launcher/src/main/monitor/crashReport.ts
  - launcher/src/main/monitor/crashReport.test.ts
autonomous: true
requirements:
  - LCH-05
  - LCH-07
  - LAUN-05
must_haves:
  truths:
    - "Main-menu sentinel regex /\\[.*?\\/INFO\\]:\\s+Sound engine started$/ fires exactly once on the fixture boot log (D-16)"
    - "A LogRingBuffer retains the last 500 lines and .slice(-30) returns fail-path tail (D-11)"
    - "30-second fallback timer fires if sentinel is never seen — UI transitions to 'playing' anyway (RESEARCH §Main-Menu Detection — fallback safety valve)"
    - "watchForCrashReport fires when a new crash-YYYY-MM-DD_HH.mm.ss-client.txt file appears in <game-dir>/crash-reports/ within deadlineMs"
    - "watchForCrashReport resolves null after deadlineMs elapses with no file (D-17 timeout)"
  artifacts:
    - path: "launcher/src/main/monitor/logParser.ts"
      provides: "LogParser class + MAIN_MENU_PATTERN + LogRingBuffer + 30s fallback timer"
      exports: ["LogParser", "LogRingBuffer", "MAIN_MENU_PATTERN", "MAIN_MENU_TIMEOUT_MS"]
    - path: "launcher/src/main/monitor/crashReport.ts"
      provides: "watchForCrashReport + readCrashReport + listCrashReports"
      exports: ["watchForCrashReport", "readCrashReport", "listCrashReports"]
  key_links:
    - from: "launcher/src/main/monitor/logParser.ts"
      to: "onMainMenu callback + onLine plumbing from Plan 03-05 spawn"
      via: "line-by-line regex match"
      pattern: "MAIN_MENU_PATTERN"
    - from: "launcher/src/main/monitor/crashReport.ts"
      to: "<game-dir>/crash-reports/*.txt + redact.ts sanitizeCrashReport"
      via: "node:fs watch"
      pattern: "fs.watch"
---

<objective>
Two sibling modules under `launcher/src/main/monitor/`:

1. **logParser.ts** — consumes lines from `spawn.ts`'s `onLine(line, stream)`, detects the main-menu sentinel `Sound engine started` (D-16), and maintains a bounded 500-line ring buffer for fail-path tail (D-11 — last 30 shown on failure). Includes a 30-second fallback timer that fires "main menu reached" regardless, so the launcher never hangs on an undetected boot (RESEARCH §Main-Menu Detection fallback safety valve).

2. **crashReport.ts** — on JVM non-zero exit, watches `<game-dir>/crash-reports/` via `fs.watch` for a new `crash-YYYY-MM-DD_HH.mm.ss-client.txt` file within 5 seconds (D-17). If one appears, read + return it (sanitized by Plan 03-10's IPC handler). If timeout elapses, resolve null and Plan 03-10 falls back to the ring-buffer tail.

Output: Two modules + two tests covering sentinel detection, ring buffer, fallback timer, crash watch, crash-file read.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/main/paths.ts
@launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt
@launcher/src/main/monitor/__fixtures__/fake-crash-report.txt

<interfaces>
From Plan 03-05 spawn.ts:
```typescript
onLine?: (line: string, stream: 'out' | 'err') => void
```
LogParser.ingest(line, stream) is called for each line emitted by spawn.

From Plan 03-01 paths.ts:
```typescript
export function resolveCrashReportsDir(): string  // <gameDir>/crash-reports
```

From RESEARCH.md §Main-Menu Detection — verbatim regex:
```typescript
const MAIN_MENU_PATTERN = /\[.*?\/INFO\]:\s+Sound engine started$/
```

From RESEARCH.md §Crash Detection Contract — verbatim code:
```typescript
import { watch } from 'node:fs'
function watchForCrashReport(crashDir: string, deadlineMs = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    const watcher = watch(crashDir, { persistent: false }, (eventType, filename) => {
      if (eventType === 'rename' && filename?.startsWith('crash-') && filename.endsWith('.txt')) {
        watcher.close()
        resolve(filename)
      }
    })
    setTimeout(() => { watcher.close(); resolve(null) }, deadlineMs)
  })
}
```

Filename pattern: `crash-YYYY-MM-DD_HH.mm.ss-client.txt` — match the `-client.txt` suffix to exclude server crashes.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: logParser.ts — sentinel detection + ring buffer + fallback timer</name>
  <files>
    launcher/src/main/monitor/logParser.ts,
    launcher/src/main/monitor/logParser.test.ts
  </files>
  <read_first>
    - launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt (the fixture this plan's tests read verbatim)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Main-Menu Detection (regex + fallback)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-11 (log tail only on failure; 30 lines)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-16 (stdout pattern match for main-menu)
  </read_first>
  <behavior>
    Tests MUST cover (LogParser):
    - Test 1: `new LogParser({onMainMenu, onLine})`. Ingest each line of the fixture boot log. `onMainMenu` called exactly ONCE. `onLine` called for every non-blank line.
    - Test 2: Sentinel fires ONLY on the `Sound engine started` line — NOT on `OpenAL initialized.` (Test against the specific fixture line which precedes the sentinel).
    - Test 3: Ingesting the sentinel line twice calls `onMainMenu` once (de-dup — the sentinel is a one-shot transition per launch).
    - Test 4: `MAIN_MENU_PATTERN` matches the exact fixture line `[Sound Library Loader/INFO]: Sound engine started` — assert via `.test()` direct.
    - Test 5: `MAIN_MENU_PATTERN` does NOT match an arbitrary other line `[Client thread/INFO]: Setting user: Wiiwho`.
    - Test 6: Fallback timer: `new LogParser({onMainMenu, mainMenuTimeoutMs: 100})` — never send a matching line → after 100 ms, `onMainMenu` fires with `{reason: 'timeout'}` (or similar). A real `onMainMenu` call earlier cancels the timer.
    - Test 7: `.disposed()` or `.stop()` stops the timer + ignores further lines (cleanup on tear-down).

    Tests (LogRingBuffer):
    - Test 8: Buffer capped at 500 entries — push 1000, only last 500 retained.
    - Test 9: `.tail(30)` returns the last 30 entries (or all of them if fewer).
    - Test 10: Each entry is `{line: string, stream: 'out'|'err'}`.
  </behavior>
  <action>
    Create `launcher/src/main/monitor/logParser.ts`:

    ```typescript
    /**
     * stdout/stderr line consumer. Two responsibilities:
     *   1. Detect the main-menu sentinel (D-16) via MAIN_MENU_PATTERN.
     *   2. Retain the last 500 lines in a ring buffer for the fail-path
     *      log tail (D-11 — shown only when a launch fails).
     *
     * Fallback safety valve: if the sentinel hasn't fired within
     * MAIN_MENU_TIMEOUT_MS after construction, fire onMainMenu anyway so
     * the launcher never hangs on an undetected boot (RESEARCH.md §Main-Menu
     * Detection Fallback safety valve). The UI can treat this as "assume playing".
     *
     * Source: RESEARCH.md §Main-Menu Detection + §Launch Log Retention
     */

    /** Primary sentinel from RESEARCH.md — fires in both OpenAL-OK and silent-mode paths. */
    export const MAIN_MENU_PATTERN = /\[.*?\/INFO\]:\s+Sound engine started$/

    /** Fallback timeout (ms) — if sentinel never fires, assume main menu reached anyway. */
    export const MAIN_MENU_TIMEOUT_MS = 30_000

    /** Ring buffer retention cap — D-11 shows last 30 on failure; 500 is headroom. */
    const RING_CAPACITY = 500

    export interface LogEntry {
      line: string
      stream: 'out' | 'err'
    }

    export type MainMenuReason = 'sentinel' | 'timeout'

    export class LogRingBuffer {
      private entries: LogEntry[] = []

      push(entry: LogEntry): void {
        this.entries.push(entry)
        if (this.entries.length > RING_CAPACITY) this.entries.shift()
      }

      tail(n: number): LogEntry[] {
        return this.entries.slice(-n)
      }

      clear(): void {
        this.entries.length = 0
      }
    }

    export interface LogParserOpts {
      onMainMenu?: (info: { reason: MainMenuReason }) => void
      onLine?: (entry: LogEntry) => void
      /** Override default MAIN_MENU_TIMEOUT_MS for tests. */
      mainMenuTimeoutMs?: number
    }

    export class LogParser {
      private fired = false
      private stopped = false
      private fallbackTimer: NodeJS.Timeout | null = null
      public readonly ringBuffer = new LogRingBuffer()

      constructor(private opts: LogParserOpts) {
        const ms = opts.mainMenuTimeoutMs ?? MAIN_MENU_TIMEOUT_MS
        this.fallbackTimer = setTimeout(() => {
          if (!this.fired && !this.stopped) this.fire('timeout')
        }, ms)
      }

      ingest(line: string, stream: 'out' | 'err'): void {
        if (this.stopped) return
        const entry: LogEntry = { line, stream }
        this.ringBuffer.push(entry)
        this.opts.onLine?.(entry)
        if (!this.fired && MAIN_MENU_PATTERN.test(line)) this.fire('sentinel')
      }

      stop(): void {
        this.stopped = true
        if (this.fallbackTimer) {
          clearTimeout(this.fallbackTimer)
          this.fallbackTimer = null
        }
      }

      private fire(reason: MainMenuReason): void {
        this.fired = true
        if (this.fallbackTimer) {
          clearTimeout(this.fallbackTimer)
          this.fallbackTimer = null
        }
        this.opts.onMainMenu?.({ reason })
      }
    }
    ```

    Write `logParser.test.ts` with the 10 tests above. Use `@vitest-environment node`. Use `vi.useFakeTimers()` for the fallback-timer test so it's deterministic (no `await sleep`):

    ```typescript
    import { vi } from 'vitest'
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('fires onMainMenu on timeout if sentinel never seen', () => {
      const cb = vi.fn()
      const p = new LogParser({ onMainMenu: cb, mainMenuTimeoutMs: 100 })
      p.ingest('[Client thread/INFO]: Loading textures', 'out')
      vi.advanceTimersByTime(100)
      expect(cb).toHaveBeenCalledWith({ reason: 'timeout' })
    })
    ```
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/monitor/logParser.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export const MAIN_MENU_PATTERN" launcher/src/main/monitor/logParser.ts`
    - `grep -q "Sound engine started" launcher/src/main/monitor/logParser.ts`
    - `grep -q "export class LogParser" launcher/src/main/monitor/logParser.ts`
    - `grep -q "export class LogRingBuffer" launcher/src/main/monitor/logParser.ts`
    - `grep -q "MAIN_MENU_TIMEOUT_MS" launcher/src/main/monitor/logParser.ts`
    - `grep -q "30_000\\|30000" launcher/src/main/monitor/logParser.ts` (30 s fallback)
    - `grep -q "RING_CAPACITY.*500\\|500" launcher/src/main/monitor/logParser.ts` (500-entry ring)
    - `cd launcher &amp;&amp; npx vitest run src/main/monitor/logParser.test.ts` exits 0 with ≥10 tests passing
  </acceptance_criteria>
  <done>LogParser + LogRingBuffer working against fixture; 30s fallback timer covered; sentinel regex exact-match asserted.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: crashReport.ts — fs.watch crash detection + read helpers</name>
  <files>
    launcher/src/main/monitor/crashReport.ts,
    launcher/src/main/monitor/crashReport.test.ts
  </files>
  <read_first>
    - launcher/src/main/paths.ts (resolveCrashReportsDir)
    - launcher/src/main/auth/redact.ts (sanitizeCrashReport — called by Plan 03-10 IPC; this plan returns RAW content, sanitizer lives at IPC boundary)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Crash Detection Contract (code block to copy)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-17 (non-zero exit + new file within 5s)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-19 ("Open crash folder" needs listCrashReports)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1 (watch — happy path): Create a temp `crash-reports/` dir. Call `watchForCrashReport(dir, 1000)`. Synchronously after, write a file `crash-2026-04-21_15.04.22-client.txt` into the dir. The Promise resolves with `'crash-2026-04-21_15.04.22-client.txt'` (the filename) within 1 second.
    - Test 2 (watch — timeout): Call `watchForCrashReport(dir, 100)` with no file creation. The Promise resolves `null` after 100 ms.
    - Test 3 (watch — ignore non-matching files): Write `crash-server-2026-04-21.txt` (has `crash-` + `.txt` but NOT `-client.txt`); AND `server.log`. Neither should trigger resolution. After a following `crash-2026-04-21_15.04.22-client.txt`, THAT one resolves.
    - Test 4 (watch — ignore sub-directory events): If the fs.watch emits events for files inside a sub-directory OR for a non-`-client.txt` file, they are ignored.
    - Test 5 (readCrashReport): `readCrashReport(dir, filename)` returns the file's UTF-8 content unchanged (sanitization happens at IPC boundary, not here — the caller is responsible for calling `sanitizeCrashReport` before UI display).
    - Test 6 (listCrashReports): Given 3 files in the crash-reports dir (2 client crashes + 1 server crash), `listCrashReports(dir)` returns the 2 client crashes sorted newest-first by filename (since filenames are ISO-ordered, lexicographic sort descending works).

    Use `os.tmpdir() + randomUUID()` per-test. Clean up in afterEach. Write files using `fs.writeFile` — `fs.watch` on Linux/macOS fires `rename` events on create/move. Windows fires `change` + `rename` variably; the code needs to handle both event types (RESEARCH code uses 'rename'; verify on Windows during execute).
  </behavior>
  <action>
    Create `launcher/src/main/monitor/crashReport.ts`:

    ```typescript
    /**
     * Crash-report watcher + reader.
     *
     * D-17: on JVM non-zero exit, watch <gameDir>/crash-reports/ for a new
     * crash-<timestamp>-client.txt file within deadlineMs. Resolve the
     * filename (success) or null (timeout).
     *
     * Non-matching events (server crashes, .log files, sub-dirs) are ignored.
     *
     * Source: RESEARCH.md §Crash Detection Contract + D-17 + D-19.
     */

    import { watch } from 'node:fs'
    import { promises as fs } from 'node:fs'
    import path from 'node:path'

    const CRASH_FILENAME_PATTERN = /^crash-.*-client\.txt$/

    export function watchForCrashReport(
      crashDir: string,
      deadlineMs = 5000
    ): Promise<string | null> {
      return new Promise((resolve) => {
        let settled = false
        let watcher: ReturnType<typeof watch> | null = null

        const settle = (value: string | null): void => {
          if (settled) return
          settled = true
          try { watcher?.close() } catch { /* already closed */ }
          clearTimeout(timer)
          resolve(value)
        }

        try {
          watcher = watch(crashDir, { persistent: false }, (eventType, filename) => {
            // Windows fires 'change' on rapid writes; Linux/macOS fire 'rename'.
            // Accept both — the filename check below is the real filter.
            if (!filename) return
            if (!CRASH_FILENAME_PATTERN.test(filename)) return
            settle(filename)
          })
        } catch {
          // crashDir may not exist yet — settle with null; orchestrator falls
          // back to ring-buffer tail.
          settle(null)
          return
        }

        const timer = setTimeout(() => settle(null), deadlineMs)
      })
    }

    export async function readCrashReport(
      crashDir: string,
      filename: string
    ): Promise<string> {
      return await fs.readFile(path.join(crashDir, filename), 'utf8')
    }

    /** Newest-first listing of client crash files in a crash-reports dir. */
    export async function listCrashReports(crashDir: string): Promise<string[]> {
      let entries: string[]
      try {
        entries = await fs.readdir(crashDir)
      } catch {
        return []
      }
      return entries
        .filter(f => CRASH_FILENAME_PATTERN.test(f))
        .sort((a, b) => b.localeCompare(a))   // newest first (ISO-ordered filenames)
    }
    ```

    Write `crashReport.test.ts` with Tests 1-6. Use real temp dirs. The fs.watch tests are inherently timing-sensitive on Windows — if flaky, add a 50 ms `await new Promise(r => setTimeout(r, 50))` after `writeFile` before asserting.

    Pitfall flag for Windows: `fs.watch` on Windows sometimes emits two events per file create (initial `rename` + follow-up `change`). The `settle()` idempotency guard handles it. Document in SUMMARY.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/monitor/crashReport.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function watchForCrashReport" launcher/src/main/monitor/crashReport.ts`
    - `grep -q "export async function readCrashReport" launcher/src/main/monitor/crashReport.ts`
    - `grep -q "export async function listCrashReports" launcher/src/main/monitor/crashReport.ts`
    - `grep -q "-client\\\\.txt" launcher/src/main/monitor/crashReport.ts` (client-suffix match)
    - `grep -q "fs.watch\\|from 'node:fs'" launcher/src/main/monitor/crashReport.ts` (native watch)
    - `grep -q "deadlineMs" launcher/src/main/monitor/crashReport.ts` (D-17 5s)
    - `grep -q "5000" launcher/src/main/monitor/crashReport.ts` (D-17 default)
    - `cd launcher &amp;&amp; npx vitest run src/main/monitor/crashReport.test.ts` exits 0 with ≥6 tests passing
  </acceptance_criteria>
  <done>Crash watch fires on client-crash filename pattern with 5s timeout; readers/listers provide the data the CrashViewer needs.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/main/monitor/logParser.test.ts src/main/monitor/crashReport.test.ts` — all green
- `cd launcher && npm run typecheck` — no type regressions
- `cd launcher && npm run test:run` — full suite green
</verification>

<success_criteria>
- LCH-05: main-menu sentinel detected exactly once on fixture (D-16)
- LCH-07: log-ring buffer retains fail-path tail (D-11 — 30 lines)
- LAUN-05: crash-report watcher fires on matching filename within 5s deadline (D-17)
- 30s fallback timer prevents the launcher from hanging on an undetected boot
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-06-SUMMARY.md` documenting:
- Windows fs.watch event-type behavior (rename vs change) — whether the double-event case was observed
- Any flakiness addressed with settle-post-write delay
- The exact regex that ships (in case the executor tightened it based on fixture idiosyncrasies)
</output>
