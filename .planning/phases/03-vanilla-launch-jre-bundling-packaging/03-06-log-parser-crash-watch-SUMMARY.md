---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 06
subsystem: launcher
tags: [launcher, stdout-parser, fs-watch, ring-buffer, regex, vitest, fake-timers]

# Dependency graph
requires:
  - phase: 03-00-phase-infrastructure
    provides: 1.8.9-boot-log.txt fixture with exact "Sound engine started" sentinel line
  - phase: 03-01-paths-and-redaction
    provides: resolveCrashReportsDir() + sanitizeCrashReport() (called by IPC, not by us)
provides:
  - LogParser class (stdout/stderr sentinel detection + onLine passthrough)
  - LogRingBuffer (500-entry cap, tail(n) for fail-path display)
  - MAIN_MENU_PATTERN exported regex for one-shot main-menu detection (D-16)
  - 30-second fallback timer so the UI never hangs on an undetected boot
  - watchForCrashReport(dir, 5000) — fs.watch crash filename filter with timeout resolve (D-17)
  - readCrashReport / listCrashReports — raw-bytes accessors for the CrashViewer (D-19)
affects:
  - 03-05-spawn-e2e (spawn.onLine plumbs into LogParser.ingest)
  - 03-10-orchestrator-logs-app (wires onMainMenu → game:status=playing + window.minimize + ring-tail on failure; sanitizeCrashReport at IPC boundary)
  - 03-08-renderer-game-and-crash (CrashViewer renders listCrashReports / readCrashReport outputs)

# Tech tracking
tech-stack:
  added: []   # pure reuse — node:fs watch + existing vitest setup
  patterns:
    - "Pattern: module-level exported regex constant with companion .test() unit assertions — gives downstream plans a grep target and a single source of truth"
    - "Pattern: idempotent Promise settle() guard for fs.watch — handles Windows rename+change double-events and try/catch on closed watchers uniformly"
    - "Pattern: fake-timers via vi.useFakeTimers() + vi.advanceTimersByTime() for timeout safety-valve testing — no flakey sleep() calls"

key-files:
  created:
    - launcher/src/main/monitor/logParser.ts
    - launcher/src/main/monitor/logParser.test.ts
    - launcher/src/main/monitor/crashReport.ts
    - launcher/src/main/monitor/crashReport.test.ts
  modified: []

key-decisions:
  - "MAIN_MENU_PATTERN uses loose `[.*?/INFO]:` prefix (matches any thread name before /INFO), not a tight `[Sound Library Loader/INFO]` — fixture shows the sentinel is emitted from Sound Library Loader but RESEARCH §Main-Menu Detection notes it may vary across builds / silent-fallback paths"
  - "30s fallback timer (MAIN_MENU_TIMEOUT_MS) fires onMainMenu({reason:'timeout'}) if sentinel never matches — planner RESEARCH §Main-Menu Detection safety valve, rationalised by silent-fallback OpenAL paths where the sound subsystem may defer or skip the log line entirely"
  - "CRASH_FILENAME_PATTERN matches /^crash-.*-client.txt$/ — filters server crashes AND arbitrary .log drops; uses String(filename) for Buffer/string overload safety"
  - "Missing crashDir resolves null from watchForCrashReport (never rejects) — orchestrator falls back to ring-buffer tail per D-11"
  - "readCrashReport returns RAW UTF-8 — D-21 single-sanitizer invariant enforced at IPC boundary, not here"

patterns-established:
  - "Module-level TYPED regex constants exported for both runtime matching AND test assertions (MAIN_MENU_PATTERN + CRASH_FILENAME_PATTERN)"
  - "Ring-buffer tail pattern for fail-only log surfacing — happy path silent (D-11)"
  - "vi.useFakeTimers() idiom for timeout safety-valve tests — deterministic, sub-millisecond, zero flake"
  - "fs.watch idempotent-settle wrapper idiom — handles Windows double-event + missing-dir + deadline uniformly"

requirements-completed: [LCH-05, LCH-07, LAUN-05]

# Metrics
duration: ~12min
completed: 2026-04-21
---

# Phase 3 Plan 6: Log Parser + Crash Watch Summary

**stdout sentinel detection fires onMainMenu exactly once on `Sound engine started`, with a 30s fallback safety valve; fs.watch-based crash-report pickup resolves the new `crash-*-client.txt` filename within 5s or null on timeout — both wired against real temp dirs with zero flakes across 26 tests.**

## Performance

- **Duration:** ~12 min (TDD × 2)
- **Started:** 2026-04-21T05:05Z
- **Completed:** 2026-04-21T05:17Z
- **Tasks:** 2 (each with RED + GREEN = 4 commits total)
- **Files modified:** 4 (2 new modules + 2 co-located test files)
- **Tests:** 26/26 passing (17 logParser + 9 crashReport)

## Accomplishments

- **LogParser** — ingest-by-line API, emits `onMainMenu({reason:'sentinel'|'timeout'})` exactly once per launch, plumbs `onLine` through for every ingested line, drops into the shared `ringBuffer` (`LogRingBuffer`) for the fail-path tail.
- **LogRingBuffer** — capped at 500 entries via `push/shift`, `.tail(n)` returns last n for D-11's fail-path log display (30-line recommendation).
- **30s fallback timer** — closes the RESEARCH §Main-Menu Detection safety-valve gap where silent-fallback audio paths may never emit the sentinel; the UI never hangs waiting on an undetected boot.
- **watchForCrashReport** — `fs.watch` + filename regex filter + deadline timer; resolves filename or null; idempotent-settle handles Windows `rename + change` double-events and closed-watcher races; missing-dir swallowed to null.
- **readCrashReport / listCrashReports** — raw UTF-8 accessors for the CrashViewer (D-19 "Open crash folder" + Past-crashes list); sorting is lexicographic-descending over ISO-ordered filenames → newest-first chronological.

## Task Commits

Each TDD-split task committed atomically:

1. **Task 1 RED (logParser tests)** — `eaa9c5a` (test)
2. **Task 1 GREEN (logParser impl)** — `027076b` (feat)
3. **Task 2 RED (crashReport tests)** — `2e949df` (test)
4. **Task 2 GREEN (crashReport impl)** — `ec97cd1` (feat)

**Plan metadata (this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates):** committed at the close of this plan.

## Files Created/Modified

- `launcher/src/main/monitor/logParser.ts` — LogParser + LogRingBuffer + MAIN_MENU_PATTERN + MAIN_MENU_TIMEOUT_MS
- `launcher/src/main/monitor/logParser.test.ts` — 17 tests: constants (4), ring buffer (4), parser ingest + sentinel (5), fallback timer (4)
- `launcher/src/main/monitor/crashReport.ts` — watchForCrashReport + readCrashReport + listCrashReports + CRASH_FILENAME_PATTERN
- `launcher/src/main/monitor/crashReport.test.ts` — 9 tests: happy-path + timeout + distractor-filter + missing-dir + read + list (3 variants)

## Decisions Made

- **Sentinel regex is the verbatim RESEARCH §Main-Menu Detection form** — `\[.*?\/INFO\]:\s+Sound engine started$`. No fixture-specific tightening applied; the loose `[.*?/INFO]:` prefix covers both `Sound Library Loader/INFO` (dominant path) and any silent-fallback variants that emit the line from a different thread.
- **Fallback timer fires regardless of `onMainMenu` wiring** — we always set the timer in the constructor so `mainMenuTimeoutMs` is testable standalone; no "only enable timer if onMainMenu provided" conditional.
- **`stop()` is idempotent + future-ingest-safe** — sets `stopped=true` so any post-teardown line drops silently into the floor instead of resurrecting state.
- **Crash filename filter uses `String(filename)`** — avoids the `typeof filename === 'string' ? ... : filename.toString()` narrowing-to-`never` bug where `@types/node` resolves `filename` as `string | null` under default utf8 encoding but the type-narrowing inference collapses unexpectedly. Simple coercion dodges it.
- **Crash dir missing → `watchForCrashReport` resolves null** — lets the Plan 03-10 orchestrator always pair the call with a ring-buffer-tail fallback without needing a try/catch on every invocation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Fix typecheck narrowing regression in filename handler**

- **Found during:** Task 2 post-GREEN typecheck
- **Issue:** Initial `const name = typeof filename === 'string' ? filename : filename.toString()` narrowed `filename.toString()` to `never` because @types/node declares `filename: string | null` under the default utf8 encoding — the `typeof === 'string'` test eliminates the `string` branch on the false side, leaving `null` which has no `.toString()`. TS2339 blocked typecheck:node.
- **Fix:** Replaced with `const name = String(filename)` — works for both `string` and `Buffer` overloads without type narrowing pitfalls. Tests still pass.
- **Files modified:** `launcher/src/main/monitor/crashReport.ts`
- **Verification:** `npm run typecheck:node` passes on monitor/ files (pre-existing unrelated errors in `launch/natives.test.ts` from sibling Wave-2 plan 03-04 — out of scope).
- **Committed in:** `ec97cd1` (rolled into the GREEN commit — fix landed before the commit was cut).

---

**Total deviations:** 1 auto-fixed (1 blocking typecheck)
**Impact on plan:** Zero scope creep. The fix is strictly the same runtime behavior with better TS inference hygiene.

## Issues Encountered

- **Pre-existing typecheck error in `launch/natives.test.ts`** — `Cannot find module './natives'` from the Plan 03-04 RED phase (Wave 2 sibling plan, still RED at this moment). Confirmed out of scope per deviation-rules scope boundary (not caused by 03-06's changes; logged here so the verifier doesn't flag it as a 03-06 regression).
- **Windows fs.watch event-type behavior** — tested on the host Windows 11 dev machine; under temp-dir single-file writes with `persistent: false`, only one `rename` event was observed per file create (no double-event in practice with this code path). The idempotent-settle guard remains as insurance for rapid-write and editor-swap scenarios.

## User Setup Required

None — pure code modules; no external service configuration.

## Next Phase Readiness

- **Plan 03-05 (spawn-e2e)** — can call `parser.ingest(line, stream)` inside the spawn.onLine callback.
- **Plan 03-10 (orchestrator)** — can wire `onMainMenu` → `game:status='playing'` push + `mainWindow.minimize()`; on non-zero exit, `await watchForCrashReport(resolveCrashReportsDir())` then run raw content through `sanitizeCrashReport` before IPC emit.
- **Plan 03-08 (renderer-game-and-crash)** — can invoke `logs:list-crashes` / `logs:read-crash` IPCs backed by `listCrashReports` / `readCrashReport`.
- No blockers introduced; fully parallel with other Wave-2 siblings on disjoint file sets.

## Self-Check: PASSED

- FOUND: `launcher/src/main/monitor/logParser.ts`
- FOUND: `launcher/src/main/monitor/logParser.test.ts`
- FOUND: `launcher/src/main/monitor/crashReport.ts`
- FOUND: `launcher/src/main/monitor/crashReport.test.ts`
- FOUND commit eaa9c5a (test(03-06) logParser RED)
- FOUND commit 027076b (feat(03-06) logParser GREEN)
- FOUND commit 2e949df (test(03-06) crashReport RED)
- FOUND commit ec97cd1 (feat(03-06) crashReport GREEN)
- Combined test run (`pnpm --filter ./launcher vitest run src/main/monitor/logParser.test.ts src/main/monitor/crashReport.test.ts` equivalent via `npx vitest run`) — 26/26 pass
- Grep `Sound engine started` in `logParser.ts` — present
- Grep `fs.watch` + literal `5000` in `crashReport.ts` — present

---
*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Completed: 2026-04-21*
