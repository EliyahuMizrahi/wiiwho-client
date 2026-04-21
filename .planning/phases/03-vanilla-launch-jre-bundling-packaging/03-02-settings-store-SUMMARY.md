---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 02
subsystem: settings
tags: [electron, settings, persistence, atomic-write, json, ipc, zod-free]

requires:
  - phase: 03-vanilla-launch-jre-bundling-packaging
    provides: "resolveSettingsFile() — <userData>/settings.json path resolver (Plan 03-01)"
  - phase: 02-microsoft-authentication
    provides: "Atomic temp+rename write idiom (safeStorageCache.ts); vi.mock('electron', ipcMain.handle capture) test pattern"
provides:
  - "SettingsV1 schema v1 — { version: 1, ramMb: 2048, firstRunSeen: false }"
  - "clampRam(n) — clamps 1024-4096 in 512 MiB steps; non-finite → DEFAULTS.ramMb"
  - "readSettings() — ENOENT + corrupt-JSON both return DEFAULTS; other I/O throws"
  - "writeSettings(v) — atomic temp+rename; re-clamps ramMb on every write"
  - "migrate(raw) — unknown version → DEFAULTS; partial-invalid field → per-field default preserving valid siblings"
  - "settings:get / settings:set IPC handlers (store-backed; Phase 1 in-memory stub replaced)"
  - "wiiwho.d.ts narrowed: settings.get returns SettingsV1; settings.set accepts Partial<{ramMb, firstRunSeen}> and returns {ok, settings}"
affects:
  - "03-07-renderer-settings (RamSlider reads ramMb via window.wiiwho.settings.get)"
  - "03-10-orchestrator-logs-app (game orchestrator reads ramMb right before JVM spawn)"
  - "03-09-preload-auth-surface (preload type surface now matches narrower wiiwho.d.ts)"

tech-stack:
  added: []
  patterns:
    - "Atomic settings persistence — mirror of Phase 2 safeStorageCache idiom (writeFile(tmp) → rename(tmp, final)), minus encryption"
    - "Schema-versioned JSON with migrate() fallback — v1 today, extend switch for v2"
    - "Defensive IPC patch merge — only typed keys on patch override current; unknown/garbage fall through"
    - "Test strategy for file-backed modules — mock paths resolver to os.tmpdir() + randomUUID; real disk I/O, fresh vi.resetModules between tests"

key-files:
  created:
    - "launcher/src/main/settings/store.ts — schema + clamp + atomic read/write"
    - "launcher/src/main/settings/store.test.ts — 11 tests (defaults, corrupt, round-trip, clamp positions, migrate, atomic, re-clamp)"
  modified:
    - "launcher/src/main/ipc/settings.ts — replaced Phase 1 in-memory stub with store-backed handlers; logs:read-crash stub UNTOUCHED"
    - "launcher/src/main/ipc/settings.test.ts — rewrote from Phase 1 Record<string,unknown> shape to SettingsV1 store-backed shape; 8 tests"
    - "launcher/src/renderer/src/wiiwho.d.ts — narrowed settings.get/set from Record<string, unknown> to SettingsV1"

key-decisions:
  - "Plain JSON, NOT safeStorage — settings are non-sensitive (ramMb, a boolean); safeStorage would complicate tests and add latency for no security gain"
  - "Re-clamp ramMb at BOTH the IPC layer AND the store layer — belt-and-suspenders against any future bypass path (direct store import, tests, future features)"
  - "Unknown schema version resets to DEFAULTS rather than failing — v0.1 has one data field (ramMb) with a safe fallback; users getting defaults is better than a crashed launcher. Extend the migrate switch when v2 ships"
  - "Partial-invalid field behavior: per-field default, NOT all-or-nothing DEFAULTS reset — users who flip firstRunSeen should keep that flag even if ramMb gets corrupted externally"
  - "wiiwho.d.ts tightened in this plan despite Plan 03-09 (preload auth surface) being the 'typing' plan — the renderer store already defensively casts unknown input, so the change is non-breaking and unblocks Plan 03-07 (RamSlider) from needing further casts"
  - "__resetSettingsForTests retained as no-op for API compatibility — avoids breaking any lingering Phase 1 test imports"

patterns-established:
  - "Settings persistence: plain JSON + atomic temp+rename + per-write re-clamp"
  - "IPC merge semantics: only typed patch keys override; null/undefined patch is a no-op"
  - "File-backed unit test strategy: mock path resolver to os.tmpdir() randomUUID subdir; real fs in afterEach cleanup"

requirements-completed:
  - LAUN-03
  - LAUN-04

duration: 10min
completed: 2026-04-21
---

# Phase 03 Plan 02: Settings Store Summary

**Plain-JSON v1 settings (`{version:1, ramMb:2048, firstRunSeen:false}`) at `<userData>/settings.json` with atomic temp+rename persistence, 512 MiB-stepped clamp, and store-backed `settings:get` / `settings:set` IPC handlers replacing the Phase 1 in-memory stub.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-21T05:04:00Z (approx)
- **Completed:** 2026-04-21T09:09:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)
- **Tests added:** 19 (11 store + 8 IPC) — all green

## Accomplishments

- Shipped the canonical `SettingsV1` schema (v1) + `clampRam` + `readSettings` / `writeSettings` atomic-write store — the authoritative RAM clamp (LAUN-03) and the persistence proof for LAUN-04
- Replaced the Phase 1 in-memory stub in `ipc/settings.ts` with store-backed handlers, preserving the frozen IPC surface (`settings:get` / `settings:set` channels unchanged) and the `logs:read-crash` stub untouched (Plan 03-10's territory)
- Narrowed `wiiwho.d.ts` from `Record<string, unknown>` to the exact `SettingsV1` shape — Plan 03-07 (RamSlider) and Plan 03-10 (orchestrator) get a fully typed IPC contract with no further casting required
- 19/19 new tests passing; 163/163 tests across every adjacent module (auth, paths, settings, ipc, preload, renderer stores) still green — no regressions

## Task Commits

Each task was TDD-committed (RED then GREEN):

1. **Task 1: settings/store.ts — schema v1 + clamp + atomic write**
   - RED: `56489a7` (test: 11 failing tests)
   - GREEN: `b62282e` (feat: store implementation)
2. **Task 2: Replace ipc/settings.ts stub with store-backed handlers**
   - RED: `b419e8c` (test: rewrite for store-backed shape; 8 tests)
   - GREEN: `3471b27` (feat: store-backed handlers + wiiwho.d.ts tightening)

## Files Created/Modified

- **`launcher/src/main/settings/store.ts`** (created) — `SettingsV1` interface, `DEFAULTS`, `clampRam`, `migrate`, `readSettings`, `writeSettings`
- **`launcher/src/main/settings/store.test.ts`** (created) — 11 tests covering defaults, corrupt JSON, round-trip across fresh module imports, all 7 canonical clamp positions (directly + via Tests 4-7 boundary probes), migrate fallbacks, atomic temp+rename verification via fs.promises spies, and belt-and-suspenders re-clamp on write
- **`launcher/src/main/ipc/settings.ts`** (modified) — replaced in-memory `inMemorySettings` state with store-delegated handlers; retained `__resetSettingsForTests` as deprecated no-op; `logs:read-crash` stub preserved verbatim
- **`launcher/src/main/ipc/settings.test.ts`** (modified) — 8 new tests: full-shape get, missing-file defaults, merge-clamp-persist, clamp-on-over-max, merge-preserves-ramMb-on-firstRunSeen-only-patch, defensive non-number ramMb drops-through, `logs:read-crash` stub UNTOUCHED static + runtime check, null/undefined patch no-op
- **`launcher/src/renderer/src/wiiwho.d.ts`** (modified) — tightened `settings.get` / `settings.set` types to `SettingsV1` / `Partial<{ramMb, firstRunSeen}>` with `{ok, settings}` response shape

## Schema v1 (committed shape)

```typescript
interface SettingsV1 {
  version: 1
  ramMb: number         // one of {1024, 1536, 2048, 2560, 3072, 3584, 4096}
  firstRunSeen: boolean
}

const DEFAULTS: SettingsV1 = { version: 1, ramMb: 2048, firstRunSeen: false }
```

## Clamp behavior on the 7 canonical RAM positions

Each was verified by tests (4-7 directly; the full grid by `Number(1024 + n*512)` identity through `clampRam`):

| Input (MiB) | Output (MiB) | Rationale |
|-------------|--------------|-----------|
| 512         | 1024         | Test 4 — below-min clamps up |
| 1024        | 1024         | Identity — on-step |
| 1536        | 1536         | Identity — on-step |
| 2048        | 2048         | Identity — on-step (DEFAULT) |
| 2300        | 2048         | Test 6 — nearest step, rounds down (2300/512 = 4.49 → 4) |
| 2500        | 2560         | Test 7 — nearest step, rounds up (2500/512 = 4.88 → 5) |
| 2560        | 2560         | Identity — on-step |
| 3072        | 3072         | Identity — on-step |
| 3584        | 3584         | Identity — on-step |
| 4096        | 4096         | Identity — on-step |
| 5000        | 4096         | Test 5 — above-max clamps down |
| 99999       | 4096         | Test 11 — belt-and-suspenders |
| NaN / Infinity | 2048      | Non-finite → DEFAULTS.ramMb |

## Migrate edge cases worth noting for future v2 planning

- `migrate(null)` → DEFAULTS (typeof check guards)
- `migrate({})` → DEFAULTS (no `version` matches the switch, falls to default branch)
- `migrate({version: 99})` → DEFAULTS (unknown version, Test 8)
- `migrate({version: 1, ramMb: 'hello'})` → `{version: 1, ramMb: 2048, firstRunSeen: false}` (per-field fallback, Test 9 — preserves `firstRunSeen: true` if present as boolean)
- `migrate({version: "1"})` (string instead of number) → DEFAULTS (the switch compares `obj.version` strictly; `"1" !== 1` so falls through to default)
- Numeric `version: 2` today → DEFAULTS (safe; when v2 ships, ADD a `case 2` arm to the switch that produces the new shape from the v2 record; do NOT remove the `case 1` arm — existing installs will still read old data)

When v2 ships: extend the switch to migrate v1 records forward (e.g., add a new field with a safe default) and add new clamp helpers for any new numeric-bounded fields. The `default` branch's "reset to DEFAULTS" behavior only fires for truly unknown versions (future-dated records from a downgrade scenario).

## Decisions Made

Six notable decisions (captured in frontmatter `key-decisions`):
1. Plain JSON, not safeStorage — non-sensitive data, simpler tests, zero latency penalty
2. Re-clamp at both IPC layer and store layer — defense in depth
3. Unknown version → DEFAULTS rather than error — graceful degradation for v0.1
4. Partial-invalid → per-field fallback, not all-or-nothing — preserves user intent on the valid fields
5. Tightened `wiiwho.d.ts` now instead of waiting for Plan 03-09 — non-breaking (renderer defensively casts) and unblocks Plan 03-07
6. Kept `__resetSettingsForTests` as deprecated no-op — API compat with Phase 1 tests

## Deviations from Plan

None - plan executed exactly as written.

(One trivial local-variable rename happened during task 2: plan showed `clamped`, my first pass used `bounded`; I renamed back to `clamped` to match the plan's acceptance-criteria grep. Behavior identical; included in the task 2 GREEN commit.)

## Issues Encountered

- **Pre-existing typecheck errors in parallel wave-2 peers' territories** (`src/main/launch/manifest.test.ts`, `src/main/launch/natives.test.ts`, `src/main/monitor/logParser.test.ts`) — these are for files other wave-2 agents own (Plans 03-03, 03-04, 03-06) and are out of scope for Plan 03-02. Scope boundary rule applies; not fixed. Verified via `npm run typecheck:web` (renderer) that my wiiwho.d.ts change is non-breaking.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 03-07 (RamSlider)** can now call `window.wiiwho.settings.get()` / `set({ramMb})` with full typing; clamp is authoritatively enforced at the store layer so the slider can send raw values and trust the response.
- **Plan 03-10 (game orchestrator)** can read `ramMb` right before JVM spawn via `readSettings()` directly or `window.wiiwho.settings.get()` from renderer state.
- **Plan 03-09 (preload auth surface)** will need to align the preload's `settings.set` patch type with the narrower `Partial<{ramMb, firstRunSeen}>` (currently the preload takes `unknown`) — a trivial tightening.
- No blockers. LAUN-03 and LAUN-04 are formally complete (test-proven).

---
*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Completed: 2026-04-21*

## Self-Check

- [x] `launcher/src/main/settings/store.ts` exists
- [x] `launcher/src/main/settings/store.test.ts` exists
- [x] `launcher/src/main/ipc/settings.ts` modified (no `inMemorySettings`)
- [x] `launcher/src/main/ipc/settings.test.ts` modified (8 tests)
- [x] `launcher/src/renderer/src/wiiwho.d.ts` modified (narrower types)
- [x] Commit `56489a7` (task 1 RED)
- [x] Commit `b62282e` (task 1 GREEN)
- [x] Commit `b419e8c` (task 2 RED)
- [x] Commit `3471b27` (task 2 GREEN)
- [x] 19/19 plan-scope tests passing
- [x] 163/163 adjacent-module tests passing
- [x] `npm run typecheck:web` passing
- [x] LAUN-03 + LAUN-04 requirements satisfied

## Self-Check: PASSED
