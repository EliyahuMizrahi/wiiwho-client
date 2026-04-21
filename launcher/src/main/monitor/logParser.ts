/**
 * stdout/stderr line consumer. Two responsibilities:
 *   1. Detect the main-menu sentinel (D-16) via MAIN_MENU_PATTERN.
 *   2. Retain the last 500 lines in a ring buffer for the fail-path
 *      log tail (D-11 — shown only when a launch fails; last 30).
 *
 * Fallback safety valve: if the sentinel hasn't fired within
 * MAIN_MENU_TIMEOUT_MS after construction, fire onMainMenu anyway so
 * the launcher never hangs on an undetected boot (RESEARCH.md §Main-Menu
 * Detection — fallback safety valve). The UI can treat this as "assume
 * playing".
 *
 * Plan 03-05's spawn.ts calls `ingest(line, stream)` for every line emitted
 * from the JVM stdout/stderr. Plan 03-10's orchestrator wires `onMainMenu`
 * to the `game:status = 'playing'` transition + window.minimize() (D-12),
 * and `ringBuffer.tail(30)` is shown only on failure per D-11.
 *
 * Source: RESEARCH.md §Main-Menu Detection + §Launch Log Retention;
 * Decisions D-11 (fail-path tail, 30 lines), D-16 (stdout pattern match).
 */

/** Primary sentinel from RESEARCH.md §Main-Menu Detection — fires in BOTH
 *  OpenAL-OK and silent-mode fallback paths. Verbatim regex from the plan. */
export const MAIN_MENU_PATTERN = /\[.*?\/INFO\]:\s+Sound engine started$/

/** Fallback timeout (ms) — if sentinel never fires, assume main menu reached
 *  anyway. 30s is long enough for a cold first-run boot on modest hardware
 *  but short enough that a silent-fallback JVM doesn't hang the launcher
 *  forever. */
export const MAIN_MENU_TIMEOUT_MS = 30_000

/** Ring buffer retention cap — D-11 shows last 30 lines on failure; 500 is
 *  headroom for operator review without unbounded memory growth. */
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

  /** Last n entries. If fewer than n, returns all. */
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
  /** Override default MAIN_MENU_TIMEOUT_MS for tests / special cases. */
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

  /** Called for each stdout/stderr line from the JVM. Records the line in
   *  the ring buffer, emits onLine, and fires onMainMenu the first time
   *  MAIN_MENU_PATTERN matches. After `stop()` or after the main-menu fire,
   *  continues recording lines but never re-fires onMainMenu. */
  ingest(line: string, stream: 'out' | 'err'): void {
    if (this.stopped) return
    const entry: LogEntry = { line, stream }
    this.ringBuffer.push(entry)
    this.opts.onLine?.(entry)
    if (!this.fired && MAIN_MENU_PATTERN.test(line)) this.fire('sentinel')
  }

  /** Tear down: cancel fallback timer, ignore further ingests. Safe to call
   *  multiple times. */
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
