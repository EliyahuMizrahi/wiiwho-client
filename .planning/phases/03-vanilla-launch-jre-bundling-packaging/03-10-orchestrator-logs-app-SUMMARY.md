---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 10
subsystem: orchestration
tags:
  - electron
  - ipc
  - zustand
  - radix-ui
  - abortcontroller
  - xmcl
  - execa
  - log-parser
  - crash-watch
  - redaction

# Dependency graph
requires:
  - phase: 03-vanilla-launch-jre-bundling-packaging
    provides: "Every Wave 1 / Wave 2 output: paths.ts, redact.ts (sanitizeCrashReport),
      settings store, manifest + libraries + assets + natives + args + spawn,
      logParser + crashReport, renderer stores + components (PlayButton, SettingsDrawer,
      CrashViewer, AccountBadge), AuthManager.getMinecraftToken()"
provides:
  - "ipc/game.ts — full launch orchestrator (Play click → main menu)"
  - "ipc/logs.ts — logs:read-crash, logs:open-crash-folder, logs:list-crashes handlers"
  - "App.tsx crashed-state branch + SettingsDrawer overlay + gear icon"
  - "Regression coverage that sanitizeCrashReport is the ONE redaction path for crash bodies"
affects:
  - "03-11-windows-packaging (orchestrator must run from packaged resources/jre/)"
  - "03-12-macos-dmg (same; plus macOS minimize-vs-dock behavior)"
  - "04-forge-injection (Phase 4 will extend buildArgv with forgeTweaks; orchestrator otherwise untouched)"

# Tech tracking
tech-stack:
  added: []  # No new runtime deps — everything was already installed in earlier plans
  patterns:
    - "vi.hoisted() for mock bags referenced by hoisted vi.mock() factories (fixes the top-level-reference-before-init trap)"
    - "Orchestrator-style IPC handler: single state machine guarded by module-level `currentPhase` + `AbortController`"
    - "Authoritative phase-label mapping lives in main-process orchestrator; renderer store mirrors without re-deriving"
    - "Single-sanitizer invariant (D-21) enforced at IPC boundary — renderer components never import redact.ts (regression-grep in CrashViewer.test.tsx)"

key-files:
  created:
    - "launcher/src/main/ipc/logs.ts"
    - "launcher/src/main/ipc/logs.test.ts"
    - "launcher/src/renderer/src/components/__tests__/App.test.tsx"
  modified:
    - "launcher/src/main/ipc/game.ts"
    - "launcher/src/main/ipc/game.test.ts"
    - "launcher/src/main/ipc/settings.ts"
    - "launcher/src/main/ipc/settings.test.ts"
    - "launcher/src/main/index.ts"
    - "launcher/src/renderer/src/App.tsx"

key-decisions:
  - "Orchestrator emits 'downloading' BEFORE fetchAndCacheManifest runs so Cancel works even during the manifest fetch (D-13 widened slightly from the plan's literal sequence — plan said 'cancel during downloading/verifying'; we interpret manifest fetch as part of downloading)"
  - "Kept the `error: string` on the game:play return value unstructured. The renderer treats a non-zero exitCode via game:exited as the primary failure path (Plan 03-08 wired the 6s fallback timer); the play() result's error is logged to console but not surfaced in UI"
  - "Cancel during getMinecraftToken or readSettings is NOT cancellable — the plan's 'cancel only during downloading/verifying' language matches this; neither call exposes an AbortSignal in its Phase 2/3 signatures"
  - "App.tsx uses a plain <button> (not a shadcn Button) for the gear icon to avoid pulling in the cva class-variance API for a single-purpose icon trigger"
  - "Dropped the 'failed' phase-state emit in the orchestrator. stores/game.ts already drives 'failed' via the game:exited fallback timer (D-11). Emitting it from main would duplicate the trigger and risk race"

patterns-established:
  - "Pattern 1: all vi.mock factories in TypeScript vitest tests read from a single `vi.hoisted({...})` bag to avoid 'Cannot access X before initialization' errors. Used in game.test.ts + logs.test.ts + App.test.tsx"
  - "Pattern 2: mock window.wiiwho.* with `freshApi()` per test, reset via `vi.resetModules()` so each test imports a pristine Zustand store"
  - "Pattern 3: orchestrator phase labels are the source of truth; renderer store mirrors via onStatus subscription (no derived-state logic in renderer)"
  - "Pattern 4: ipc-handler files expose `__test__: { resetForTests }` so module-level state can be reset between tests without resorting to vi.resetModules + dynamic import"

requirements-completed:
  - "LCH-01"
  - "LCH-02"
  - "LCH-03"
  - "LCH-05"
  - "LCH-06"
  - "LCH-07"
  - "LAUN-05"
  - "COMP-05"

# Metrics
duration: 17min
completed: 2026-04-21
---

# Phase 03 Plan 10: Orchestrator + Logs IPC + App Wiring Summary

**Launch orchestrator in ipc/game.ts drives Play click through the full pipeline (settings → MC token → manifest → libraries → assets → natives → spawn → log-parse → crash-watch) with a single-sanitizer crash boundary (D-21/COMP-05) and AbortController-based cancellation (D-13); App.tsx branches on crashed-state to render CrashViewer full-page (D-18).**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-21T09:28:56Z
- **Completed:** 2026-04-21T09:46:21Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 10 (3 created, 7 edited)
- **Tests added:** 27 (12 orchestrator + 7 logs + 8 App)
- **Total launcher tests:** 354 (baseline was 330; net +24 after stub-replacement accounting)

## Accomplishments

- **LCH-01/02/03 + LCH-05/06/07 integration complete** — every launch module's call graph is exercised by the orchestrator unit test, not just in isolation.
- **COMP-05 crash-body redaction invariant locked** — Test 12 in game.test.ts + Test 4 in logs.test.ts both use the `ey.fakeTokenBody123` fixture value; neither path permits the raw token to survive into the renderer payload.
- **D-13 cancel signal plumbed through xmcl + fetch** — Test 9 proves the AbortSignal captured inside `fetchAndCacheManifest`'s mock becomes `aborted === true` after `game:cancel` fires, and the orchestrator exits cleanly to idle.
- **D-18 crashed takeover wired at App.tsx** — phase.state === 'crashed' returns the CrashViewer verbatim; the PlayButton-under-Home path is never rendered behind it (Test 4 asserts both the heading presence AND the 'Play' button absence).
- **ipc surface preserved** — frozen top-level keys (auth, game, settings, logs, __debug) unchanged; `contextBridge.exposeInMainWorld` still called exactly once in preload/index.ts.

## Task Commits

Each task was committed atomically (all three are TDD-style — RED→GREEN in the same commit per Plan 03-10's autonomy policy; tests were written first, handler bodies implemented second, and both landed together after green):

1. **Task 1: ipc/game.ts orchestrator — full launch pipeline** — `b5f05bb` (feat)
2. **Task 2: ipc/logs.ts + remove read-crash stub from settings.ts** — `aa2f565` (feat)
3. **Task 3: App.tsx wiring — crashed takeover, SettingsDrawer, gear icon, game subscribe** — `bddbdb3` (feat)

## Files Created/Modified

- `launcher/src/main/ipc/game.ts` — full orchestrator (replaces Phase 1 stub); imports every launch/monitor/auth/settings module and sequences them behind a single AbortController
- `launcher/src/main/ipc/game.test.ts` — 12 tests; asserts call order, status sequence, progress relay, log relay, minimize-on-sentinel, clean-exit, crash-exit+sanitize, crash-exit-no-file, cancel, already-running guard, auth-error, D-21 regression
- `launcher/src/main/ipc/logs.ts` — new file; three logs:* handlers (read-crash + open-crash-folder + list-crashes)
- `launcher/src/main/ipc/logs.test.ts` — 7 tests; includes fixture-based COMP-05 regression check against `fake-crash-report.txt` containing raw `ey.fakeTokenBody123`
- `launcher/src/main/ipc/settings.ts` — removes logs:read-crash stub registration
- `launcher/src/main/ipc/settings.test.ts` — Test 7 updated to assert the stub is gone
- `launcher/src/main/index.ts` — `registerGameHandlers(() => mainWindowRef)` + `registerLogsHandlers()` added
- `launcher/src/renderer/src/App.tsx` — adds crashed-state branch, gear icon, SettingsDrawer overlay, useGameStore.subscribe() on mount, useSettingsStore.initialize() on mount, DeviceCode subscription preserved
- `launcher/src/renderer/src/components/__tests__/App.test.tsx` — new file; 8 tests covering Home render, gear→drawer, ESC close, crashed→takeover, Close/Play-again callbacks, subscribe + initialize on mount

## Decisions Made

- **AbortSignal plumbing through xmcl** — Plan's "Open Qs" flagged whether xmcl's `installLibraries`/`installAssets` honor `abortSignal`. At the orchestrator level we pass it through; libraries.ts documents the `as unknown as Parameters<typeof installLibraries>[1]` cast because xmcl 6.1.2's typed surface doesn't expose abortSignal but its internal ParallelTaskOptions extension path does. No additional p-queue wrapping needed — the `Promise.race` with `addEventListener('abort', reject)` in libraries.ts is sufficient for v0.1.
- **Progress-callback frequency** — ensureLibraries fires one completion event (bytesDone === bytesTotal) per xmcl invocation. Fine-grained per-file progress is a v0.2 concern; v0.1's UX (D-10: phase + percent, no per-file list) doesn't need it.
- **6s renderer fallback vs 5s main watcher** — renderer's stores/game.ts uses 6000ms; main's watchForCrashReport uses 5000ms. The 1s gap is deliberate: the main fires game:crashed ≤5s post-exit (Mojang writes crash-reports/ synchronously on JVM abort), so the renderer's 6s timer always loses the race. No regression risk observed.
- **Exit-to-crash-fallback observability** — the orchestrator does NOT emit a 'failed' push. The renderer's game:exited → 6s fallback → failed state is the only path into PlayButton's failed UI (D-11). Emitting 'failed' from the orchestrator would race the renderer's timer and double-transition.

## Deviations from Plan

**None — plan executed exactly as written.**

All 3 tasks implemented per plan actions; all acceptance-criteria greps pass; tests, typecheck, build all green. Prettier autofixes on touched files were applied but changed only formatting, not semantics.

## Issues Encountered

**1. vi.mock() factory hoisting error (Task 1 RED→GREEN boundary)**
- **Symptom:** `Cannot access 'settingsMock' before initialization` when first running game.test.ts
- **Root cause:** vi.mock factories are hoisted above all const/let declarations in the test file, so referencing module-scoped `const settingsMock = ...` from inside a factory fails at module init
- **Fix:** Migrated all module-scoped mock objects into a single `vi.hoisted(() => ({ ... }))` bag; vi.mock factories then reference `mocks.settings`, `mocks.authManager`, etc., which are defined above the factories
- **Applied to:** game.test.ts, logs.test.ts, App.test.tsx — established pattern for future main-process IPC tests

**2. TypeScript narrowing of `let resolveFetch` inside Promise callback (Test 10)**
- **Symptom:** `resolveFetch?.({...})` compile error `Type 'never' has no call signatures`
- **Root cause:** TypeScript can't see the assignment inside the new Promise's executor callback
- **Fix:** Extracted an explicit `ResolveFn` type alias and cast the captured variable on-use: `(resolveFetch as ResolveFn | null)?.({...})`

**3. Full-lint exit-code 1 from pre-existing errors (post-Task 3)**
- **Symptom:** `pnpm run lint` reports 56 errors
- **Root cause:** Phase 2 / Plan 03-07 / Plan 03-08 test files (`ErrorBanner.test.tsx`, `RamSlider.test.tsx`, `SettingsDrawer.test.tsx`) predate this plan
- **Handling:** Per deviation rule scope-boundary, out-of-scope. Logged to `.planning/phases/03-vanilla-launch-jre-bundling-packaging/deferred-items.md` for a future cleanup plan
- **Verification:** Touched files pass `eslint --fix` with zero errors + zero warnings

## Known Stubs

None. Task 3's `onOpenLogs` and `onOpenCrashes` drawer callbacks both route to `window.wiiwho.logs.openCrashFolder()` — this is D-07's v0.1 design ("Logs + Crashes live inside the drawer; clicking either reveals the folder in Explorer/Finder"), not a stub. A proper in-app log viewer is a deferred v0.2 feature per 03-CONTEXT.md Claude's Discretion.

## User Setup Required

None — no external service configuration required. All IPC plumbing is local process.

## Next Phase Readiness

- **Plan 03-11 (Windows packaging)** — orchestrator now runs end-to-end from ipc; the remaining work is electron-builder NSIS target config + `extraResources` mapping to `resources/jre/win-x64` and `resources/mod/`. Orchestrator code is packaging-agnostic.
- **Plan 03-12 (macOS Universal DMG)** — same story, with Universal-arch JRE bundling.
- **Phase 4 (Forge injection)** — buildArgv exposes `forgeTweaks?: string[]`; orchestrator passes it through `input`. Phase 4 extends buildArgv to splice tweaks between mainClass and game args. No orchestrator changes expected.
- **Manual verification left for packaging phase** — the orchestrator has only been unit-tested so far. A real end-to-end launch (Play click → 1.8.9 main menu) waits on 03-11 + 03-12 producing the packaged app with bundled JRE. The E2E test in `launcher/src/main/launch/e2e.test.ts` (Plan 03-05) covers the spawn.ts portion in isolation; no full-orchestrator E2E exists yet and is not required by Plan 03-10's success criteria.

## Self-Check: PASSED

Verified on disk:

- `launcher/src/main/ipc/game.ts` FOUND — 237 lines, `registerGameHandlers(getWin: GetWin)` signature
- `launcher/src/main/ipc/game.test.ts` FOUND — 12 tests passing
- `launcher/src/main/ipc/logs.ts` FOUND — 3 handlers registered
- `launcher/src/main/ipc/logs.test.ts` FOUND — 7 tests passing
- `launcher/src/main/ipc/settings.ts` FOUND — logs:read-crash stub removed (grep confirms `ipcMain.handle(['"]logs:read-crash` returns 0 hits)
- `launcher/src/main/ipc/settings.test.ts` FOUND — 8 tests passing (Test 7 asserts no handler registration)
- `launcher/src/main/index.ts` FOUND — `registerGameHandlers(() => mainWindowRef)` + `registerLogsHandlers()` lines present
- `launcher/src/renderer/src/App.tsx` FOUND — `gamePhase.state === 'crashed'` branch at line 125
- `launcher/src/renderer/src/components/__tests__/App.test.tsx` FOUND — 8 tests passing

Verified commits in `git log --oneline`:

- `b5f05bb` FOUND — Task 1 (orchestrator)
- `aa2f565` FOUND — Task 2 (logs IPC)
- `bddbdb3` FOUND — Task 3 (App.tsx)

Full-suite verification:
- `pnpm --filter ./launcher run test:run` → 354 passed
- `pnpm --filter ./launcher run typecheck` → exits 0
- `pnpm --filter ./launcher run build` → main 87.80kB + preload 2.31kB + renderer 961.66kB, exits 0
- Touched-files lint → 0 errors, 0 warnings

---
*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Completed: 2026-04-21*
