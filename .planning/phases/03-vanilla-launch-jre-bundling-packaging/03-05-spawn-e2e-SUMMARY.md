---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 05
subsystem: launch
tags: [execa, jvm, spawn, streaming, abortsignal, jre-03, testing]

# Dependency graph
requires:
  - phase: 03-00-phase-infrastructure
    provides: vitest node-environment config, launcher/src/main layout
  - phase: 03-01-paths-and-redaction
    provides: resolveJavaBinary() — paths.ts enforces bundled-JRE output that this module's JRE-03 check re-validates
  - phase: 03-04-natives-and-args
    provides: buildArgv() output fed as the `argv` field into spawnGame (via Plan 03-10 orchestrator)
provides:
  - spawnGame(opts) — the ONE execa entry point for the JVM across the launcher
  - SpawnOpts / SpawnResult types
  - JRE-03 static check (refuses any javaPath outside `resources/jre/`)
  - line-split stdout/stderr streaming with per-line onLine callback
  - AbortSignal → execa cancelSignal wiring
  - End-to-end validation of the spawn → log-line → exit pipeline (via node-as-JVM integration test)
affects: [03-06-log-parser-crash-watch, 03-10-orchestrator-logs-app]

# Tech tracking
tech-stack:
  added: [execa 9.6.1 wrapper usage (package already installed)]
  patterns:
    - "Single-entry execa wrapper: one module owns all JVM invocation to enforce invariants"
    - "JRE-03 path-check invariant: static validation that callers passed a bundled-JRE path"
    - "Streaming stdio (stdout/stderr both 'pipe') with per-line callback — no 200 KB buffering (Pitfall 4)"
    - "_JAVA_OPTIONS=undefined env guard: prevent users from overriding heap args via env"
    - "E2E node-as-JVM pattern: copy process.execPath into a temp 'resources/jre/' dir to exercise real spawn without real Minecraft"

key-files:
  created:
    - launcher/src/main/launch/spawn.ts
    - launcher/src/main/launch/spawn.test.ts
    - launcher/src/main/launch/e2e.test.ts
  modified:
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/deferred-items.md

key-decisions:
  - "JRE-03 enforcement done inline in spawn.ts (not trusting paths.ts alone) — belt-and-braces against any future caller that bypasses paths.ts"
  - "Non-zero exit codes returned via {exitCode} (NOT thrown) — Plan 03-10's orchestrator distinguishes clean-quit (0) vs crash (non-zero) via that value"
  - "Only instanceof ExecaError is caught; anything else rethrows so developer bugs (TypeError, missing modules) are not silently swallowed"
  - "E2E test bypasses JRE-03 via a real temp path containing 'resources/jre/' rather than a test-only spawn.ts hook — keeps production API pollution-free"
  - "Blank lines (trailing \\n splits) are filtered from onLine — matches log-parser expectations downstream (Plan 03-06)"
  - "_JAVA_OPTIONS forced to undefined in env to prevent user-env override of heap sizing"

patterns-established:
  - "launcher/src/main/launch/ modules: one module per pipeline stage (spawn, args, manifest, libraries, natives, assets), co-located .test.ts"
  - "execa mock shape for vitest: fake Subprocess built from Promise + attached EventEmitters; settle helpers resolveWith/rejectWith for test control"
  - "E2E for spawn-like wrappers: copy node binary into a temp path containing the invariant-passing substring, drive real spawn with `-e` scripts"

requirements-completed: [LCH-05, LCH-07, JRE-03]

# Metrics
duration: ~12 min
completed: 2026-04-21
---

# Phase 3 Plan 5: Spawn + E2E Summary

**execa 9.x JVM wrapper with JRE-03 path invariant, line-split stdout/stderr streaming, AbortSignal cancel wiring, and a node-as-JVM E2E integration test that proves the full spawn → log-line → exit pipeline without needing real Minecraft**

## Performance

- **Duration:** ~12 min (parallel Wave 2, agent 5 of 7)
- **Started:** 2026-04-21 (plan received)
- **Completed:** 2026-04-21
- **Tasks:** 2 (both with TDD flow)
- **Files created:** 3
- **Files modified:** 1 (deferred-items tracking)

## Accomplishments

- **spawnGame wrapper** — single execa entry point for the JVM. Enforces JRE-03 invariant (rejects any javaPath outside `resources/jre/`), streams stdout/stderr with per-line tagged callbacks, wires AbortSignal to execa's `cancelSignal` option, normalizes exit codes (0 clean, positive for non-zero, -1 for signal-killed/aborted), and returns via Promise (no throw for expected non-zero exits — Plan 03-10's orchestrator needs the number).
- **14-test unit suite (spawn.test.ts)** — full coverage of invariant enforcement, execa call-signature, line-split streaming (including `\r\n` Windows endings and blank-line filtering), stream tagging, exit-code plumbing (0, non-zero, null-normalized, non-ExecaError rethrow), AbortSignal propagation, and degenerate null-stream defense.
- **4-test E2E integration suite (e2e.test.ts)** — copies `process.execPath` (node) into a temp dir containing `resources/jre/`, drives real spawn with `-e` scripts: verifies boot-log fixture streaming + sentinel detection (`Sound engine started`), non-zero exit returned via exitCode, AbortSignal terminating a long-running process within 5s, and real-world JRE-03 rejection of `/usr/bin/java`.
- **End-to-end sentinel-plumbing proof** — the 13-line Mojang boot-log fixture streams in full through onLine, and the D-16 sentinel (`Sound engine started`) fires exactly once — validating Plan 03-06 log-parser's future input contract.

## Task Commits

1. **Task 1: spawn.ts + spawn.test.ts (execa wrapper, 14 unit tests)** — `aee931c` (feat)
2. **Task 2: e2e.test.ts (node-as-JVM integration, 4 tests)** — `20967a3` (test)

_Note: both tasks were TDD. Task 1 had one test→impl cycle; Task 2's GREEN passed on first run because spawn.ts was already correct from Task 1._

## Files Created/Modified

- `launcher/src/main/launch/spawn.ts` (created) — the execa wrapper. ~110 lines; exports `spawnGame`, `SpawnOpts`, `SpawnResult`.
- `launcher/src/main/launch/spawn.test.ts` (created) — 14 unit tests, execa mocked via `vi.mock`.
- `launcher/src/main/launch/e2e.test.ts` (created) — 4 integration tests; copies node binary into a JRE-03-passing temp path.
- `.planning/phases/03-vanilla-launch-jre-bundling-packaging/deferred-items.md` (modified) — logged out-of-scope failing tests from parallel Wave 2 agents (natives, stores/game, stores/settings — files owned by plans 03-04, 03-07, 03-08).

## Decisions Made

- **JRE-03 enforced inline in spawn.ts.** `paths.ts::resolveJavaBinary()` already produces a bundled-JRE path, but spawn.ts re-validates via `/\/resources\/jre\//` on a slash-normalized string. Belt-and-braces: a future dev-tool or ad-hoc caller can't bypass the invariant by constructing a javaPath by hand. Cost: a few lines + one test; benefit: the invariant is local to the one module that actually spawns.
- **Non-zero exit returns via `{exitCode}`, never throws.** `ExecaError.exitCode` is captured and returned. Plan 03-10 uses `exitCode !== 0` as its crash-viewer trigger; `throw` semantics would force every caller into try/catch and could mask the non-zero case behind a generic error.
- **Non-ExecaError errors rethrow.** If a developer mistake (TypeError, missing module, etc.) reaches spawnGame, swallowing it into `{exitCode: -1}` would hide real bugs. Only `instanceof ExecaError` is caught.
- **E2E test copies `process.execPath` into a temp `resources/jre/testslot/bin/` dir** rather than adding a test-only bypass to spawn.ts. Production API stays pollution-free; the test proves the JRE-03 check interacts correctly with real paths.
- **Blank-line filter** — trailing `\n` in a chunk produces an empty split element; filtering at spawn.ts means Plan 03-06's log parser never has to deal with zero-length lines.
- **`_JAVA_OPTIONS: undefined` in env** — the JVM prepends anything in this env var to every invocation. Explicitly clearing it prevents a user env export from silently overriding our `-Xmx`/`-Xms` and breaking the RAM slider contract (LAUN-03).

## Deviations from Plan

None - plan executed exactly as written.

(The plan anticipated the "real JRE-03 path in test" problem and recommended exactly the temp-dir-with-resources/jre approach that was used.)

## Issues Encountered

- **execa 9.x `cancelSignal` option verified present.** Plan asked to double-check `cancelSignal` vs `signal`. Inspected `launcher/node_modules/execa/types/arguments/options.d.ts:256-282` — confirms `readonly cancelSignal?: Unless<IsSync, AbortSignal>` with full docstring. No naming drift.
- **`ExecaError` class shape verified.** `launcher/node_modules/execa/types/return/final-error.d.ts:38` exports `class ExecaError<OptionsType extends Options = Options> extends CommonError<false, OptionsType>` with `exitCode` and `isCanceled` properties — mock class mirrored that shape.
- **Subprocess generic typing is unwieldy.** `execa()`'s return type is a heavily-generic `Subprocess<Options>` that resists being assigned to a user-facing variable without a long options-type dance. Used `Subprocess<any>` locally (with an eslint-disable one-liner) — the public API of spawnGame is fully typed via `SpawnOpts`/`SpawnResult`, so internal `any` is bounded.
- **Three out-of-scope test failures logged to deferred-items.md** — `natives.test.ts`, `stores/game.test.ts`, `stores/settings.test.ts` fail because their source files haven't been written yet (they're owned by parallel Wave 2 plans 03-04, 03-07, 03-08 running concurrently). Per SCOPE BOUNDARY rules, not auto-fixed.
- **`npm run typecheck` reports 2 errors** — both in `stores/__tests__/*.test.ts` referring to not-yet-written store modules. Same scope boundary: owned by plans 03-07 and 03-08.

## Node-as-JVM E2E Findings

- **Windows `node.exe` copy worked without AV interference** on this run (Windows 11 Home, Defender default). No delay between copyFile and first spawn.
- **`setInterval(()=>{}, 1000)` keeps the event loop alive** reliably across platforms; the original plan suggestion of `setTimeout(()=>{}, 10000)` also works but setInterval is clearer about intent.
- **Abort test elapsed <2s** on local Windows run — SIGTERM equivalent (node.exe forced termination) is fast.
- **execa wraps Windows forced-kill into ExecaError with non-zero exitCode** — the abort test asserts `exitCode !== 0` rather than a specific number, because Windows reports a different exit code than POSIX SIGTERM would.

## Next Phase Readiness

- Plan 03-06 (log parser + crash watch) can consume spawnGame's `onLine` callback directly; the line-split contract is proven.
- Plan 03-10 (orchestrator) can import spawnGame, pass `resolveJavaBinary()` output + `buildArgv()` output + an AbortController for D-13 dev-cancel, and react to `exitCode !== 0` for crash-viewer triggering.
- No external services or environment setup required — pure Node/Electron main-process code.
- JRE-03 invariant holds at two layers (paths.ts + spawn.ts) — any future module adding a JVM-like spawn should route through spawnGame to inherit both checks.

## Self-Check: PASSED

- spawn.ts exists at `launcher/src/main/launch/spawn.ts` — FOUND
- spawn.test.ts exists at `launcher/src/main/launch/spawn.test.ts` — FOUND (14 tests passing)
- e2e.test.ts exists at `launcher/src/main/launch/e2e.test.ts` — FOUND (4 tests passing)
- Commit `aee931c` (Task 1) — FOUND in git log
- Commit `20967a3` (Task 2) — FOUND in git log
- `grep 'import.*execa' spawn.ts` — MATCH ("import { execa, ExecaError, type Subprocess } from 'execa'")
- `grep 'resources/jre' spawn.ts` — MATCH (invariant regex)
- `grep 'must be bundled JRE' spawn.ts` — MATCH (error message)
- `grep 'cancelSignal' spawn.ts` — MATCH
- `grep '_JAVA_OPTIONS: undefined' spawn.ts` — MATCH
- `grep 'split(/\\r?\\n/)' spawn.ts` — MATCH (line-split regex)
- No `child_process` import in spawn.ts — CONFIRMED (grep -E "^import.*child_process|from ['\"]child_process['\"]" returns empty)
- No `exec(` call in spawn.ts — CONFIRMED (grep '\bexec\s*\(' returns empty)
- `npx vitest run src/main/launch/spawn.test.ts src/main/launch/e2e.test.ts` → 2 files, 18 tests passed, exit 0 — CONFIRMED

---
*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Plan: 05-spawn-e2e*
*Completed: 2026-04-21*
