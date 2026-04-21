---
phase: 01-foundations
plan: 03
subsystem: launcher
tags: [electron, react, typescript, tailwind, shadcn, ipc, security, vitest]

# Dependency graph
requires:
  - phase: 01-foundations
    provides: Wave 0 policy docs + docs-check script (01-00-SUMMARY)
provides:
  - Electron launcher scaffold at launcher/ with secure BrowserWindow (contextIsolation/nodeIntegration/sandbox all explicit)
  - Complete Named-Channel IPC surface as stubs (auth:*, game:*, settings:*, logs:read-crash, __security:audit) — Phase 2/3 fill handler bodies without adding channels
  - Preload bridge exposing the 5-key wiiwho API (auth/game/settings/logs/__debug) via contextBridge.exposeInMainWorld
  - TypeScript contract (wiiwho.d.ts) locking the renderer↔main IPC shape for Phase 2/3
  - Runtime security verification via __security:audit IPC + Vitest assertion on allTrue: true
  - React UI with dead-button Play wired to window.wiiwho.game.play() — cyan #16e0ee accent on dark #111 background
  - Vitest unit suite (4 files, 13 tests passing) covering all IPC stub groups
  - Tailwind v4 + shadcn/ui (unified radix-ui package post Feb 2026) configured
  - Root pnpm-workspace.yaml + filter scripts enabling `pnpm --filter ./launcher <cmd>` from repo root
affects: [01-01-client-mod, 01-04-azure-ad, 02-microsoft-auth, 03-vanilla-launch]

# Tech tracking
tech-stack:
  added:
    - electron@39.8.8
    - electron-vite@5.0.0
    - electron-builder@26.8.1
    - react@19.2.5
    - react-dom@19.2.5
    - typescript@5.9.3
    - vite@7.3.2
    - vitest@4.1.4
    - tailwindcss@4.2.3
    - "@tailwindcss/vite@4.2.3"
    - radix-ui@1.4.3
    - class-variance-authority@0.7.1
    - clsx@2.1.1
    - tailwind-merge@3.5.0
    - lucide-react@1.8.0
    - tw-animate-css@1.4.0
    - zustand@5.0.12
  patterns:
    - "Named-Channel IPC: every IPC channel is a typed invoke/on pair with stub handlers from day 1; Phase 2/3 only replace handler bodies"
    - "Runtime security verification: BrowserWindow webPreferences are captured via setAuditedPrefs() and queried through __security:audit IPC — config-vs-runtime drift is observable, not assumed"
    - "Preload as sole attack surface: only 5 top-level keys exposed on window.wiiwho (auth, game, settings, logs, __debug); no raw ipcRenderer leaks to renderer"
    - "Dead-button Play: UI is wired to the stub IPC handler and MUST NOT import Phase 2/3 deps (Pitfall 5 enforced by dependency absence, grep-verified)"
    - "Dev:prod parity via electron-vite triple build (main/preload/renderer) — same config serves HMR dev window and production electron-builder bundle"
    - "Display name 'Wiiwho' (only first W capitalized) applied to all user-visible strings; structural identifiers (club.wiiwho.launcher, window.wiiwho, WiiWhoAPI interface) remain lowercase/PascalCase per their convention"

key-files:
  created:
    - launcher/package.json
    - launcher/tsconfig.json
    - launcher/tsconfig.node.json
    - launcher/tsconfig.web.json
    - launcher/electron.vite.config.ts
    - launcher/vitest.config.ts
    - launcher/.gitignore
    - launcher/README.md
    - launcher/components.json
    - launcher/src/main/index.ts
    - launcher/src/main/ipc/auth.ts
    - launcher/src/main/ipc/auth.test.ts
    - launcher/src/main/ipc/game.ts
    - launcher/src/main/ipc/game.test.ts
    - launcher/src/main/ipc/settings.ts
    - launcher/src/main/ipc/settings.test.ts
    - launcher/src/main/ipc/security.ts
    - launcher/src/main/ipc/security.test.ts
    - launcher/src/preload/index.ts
    - launcher/src/preload/index.d.ts
    - launcher/src/renderer/index.html
    - launcher/src/renderer/src/App.tsx
    - launcher/src/renderer/src/main.tsx
    - launcher/src/renderer/src/global.css
    - launcher/src/renderer/src/lib/utils.ts
    - launcher/src/renderer/src/components/ui/button.tsx
    - launcher/src/renderer/src/wiiwho.d.ts
    - pnpm-workspace.yaml
  modified:
    - package.json (root — added launcher filter scripts, preserved Plan 00 docs-check)
    - .planning/STATE.md (recorded runtime verification evidence)
    - .planning/REQUIREMENTS.md (LAUN-01, LAUN-02, LAUN-06 marked Complete)
    - .planning/ROADMAP.md (Phase 1 progress row updated)

key-decisions:
  - "Runtime security verification via __security:audit IPC — 'prove, don't trust' posture. setAuditedPrefs() captures the exact object passed to BrowserWindow so test assertions compare against the true runtime value, not a literal in source."
  - "Preload bridge is the ENTIRE attack surface. Only 5 top-level keys exposed on window.wiiwho. Phase 2/3 extend handler BODIES, never the IPC surface — locked by wiiwho.d.ts TypeScript contract and enforced by grep on channel list."
  - "Dead-button Play enforced by dependency absence. Banned deps (@azure/msal-node, prismarine-auth, @xmcl/core, @xmcl/installer, electron-log, execa, p-queue) are grep-checked out of launcher/package.json — Pitfall 5 is not a code-review convention but a testable invariant."
  - "Display name 'Wiiwho' (only first W capitalized) applied to all user-visible strings across launcher/. Structural identifiers (package path, global object, TypeScript interface) retain their original case to avoid rippling imports and maintain conventional TS/JS identifier style."
  - "pnpm-workspace.yaml packages list [launcher] is a filter mechanism, NOT a shared-deps workspace. Launcher and client-mod are independent toolchains (Node vs Gradle); they only share the workspace filter sugar."

patterns-established:
  - "Runtime security audit pattern: capture the exact webPreferences object passed to BrowserWindow (setAuditedPrefs), expose a debug-only IPC (__security:audit) that returns the captured state, cover with a Vitest assertion on allTrue: true. Pattern reusable for other 'prove config matches runtime' checks."
  - "IPC contract file (wiiwho.d.ts) as single source of truth: one exported interface describes the full renderer↔main API; Window.wiiwho is declared global; all three processes (main handlers, preload exposure, renderer consumer) are structurally checked against it."
  - "Stub-first IPC handlers: every v0.1 channel is registered with a logging stub and a typed placeholder payload from the first scaffold. Enables renderer UI development to proceed in parallel with backend implementation and provides a grep-verifiable anti-scope boundary."

requirements-completed: [LAUN-01, LAUN-02, LAUN-06]

# Metrics
duration: ~12 min (continuation agent only — excludes Task 1 work committed in a48a9b9)
completed: 2026-04-20
---

# Phase 01 Plan 03: Electron Launcher Scaffold Summary

**Electron launcher with Tailwind v4 + shadcn/ui, Named-Channel IPC surface stubs, and runtime-verified security posture (contextIsolation + nodeIntegration-off + sandbox) proven via __security:audit IPC returning allTrue: true.**

## Performance

- **Duration:** ~12 min (continuation agent; Task 1 was committed in a48a9b9 by the prior agent)
- **Completed:** 2026-04-20
- **Tasks:** 2 (Task 1 autonomous scaffold + Task 2 human-verify checkpoint)
- **Files created:** 27
- **Files modified:** 4 (root package.json, STATE.md, REQUIREMENTS.md, ROADMAP.md)

## Accomplishments

- Scaffolded `launcher/` via `pnpm create @quick-start/electron@latest` with the `react-ts` template (Electron 39.8.8 + electron-vite 5.0.0 + React 19.2.5 + TypeScript 5.9.3)
- Wired Tailwind v4.2.3 with `@tailwindcss/vite` plugin (no `tailwind.config.js` — config lives in CSS `@theme`) and shadcn/ui with the unified `radix-ui@1.4.3` package (Feb 2026+ shadcn layout)
- Hardened the BrowserWindow with explicit `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, captured via `setAuditedPrefs()` so the `__security:audit` IPC handler reports against the exact runtime value
- Registered the full Named-Channel IPC surface for v0.1 as stub handlers: `auth:status|login|logout|device-code`, `game:play|cancel|status|status-changed|progress`, `settings:get|set`, `logs:read-crash`, `__security:audit`
- Exposed the attack surface through `contextBridge.exposeInMainWorld('wiiwho', {...})` — 5 top-level keys (auth, game, settings, logs, __debug), no raw ipcRenderer reaches the renderer
- Wrote `wiiwho.d.ts` as the TypeScript contract for Phase 2/3 executors — handler bodies change, the interface doesn't
- Vitest suite: 4 test files, 13 tests passing, including `security.test.ts` asserting `allTrue: true` on a mocked webPreferences shape
- Pitfall 5 enforced by dependency absence: `@azure/msal-node`, `prismarine-auth`, `@xmcl/core`, `@xmcl/installer`, `electron-log`, `execa`, `p-queue` are grep-verified out of `launcher/package.json`
- React UI with cyan (#16e0ee) Play button on dark (#111) background, dead-wired to `window.wiiwho.game.play()` — logs the stub payload on click
- `pnpm-workspace.yaml` at repo root declaring `packages: [launcher]` — enables `pnpm --filter ./launcher <cmd>` without introducing shared-deps coupling
- Owner ran `pnpm --filter ./launcher dev` on Windows and verified all 6 runtime checks passed: window geometry, Play button styling, click-payload log, `securityAudit() → allTrue: true`, renderer-side assertions (`typeof window.process/require === 'undefined'`), and preload key scope (`Object.keys(window.wiiwho) === ['auth','game','settings','logs','__debug']`)
- Display name corrected project-wide: user-visible `WiiWho` → `Wiiwho` (only first W capitalized) across package.json, README, BrowserWindow title, HTML title, App.tsx heading, wiiwho.d.ts JSDoc

## Task Commits

1. **Task 1: Scaffold launcher + Tailwind v4 + shadcn/ui + wire IPC surface + security runtime check** — `a48a9b9` (feat)
2. **Task 2: Runtime human-verify checkpoint** — verified by owner 2026-04-20; evidence recorded in STATE.md (`aa28a43`, docs)
3. **Display-name correction follow-up** — `6a61cc5` (fix): rename WiiWho → Wiiwho in user-visible display text

**Plan metadata:** (this summary + STATE/ROADMAP/REQUIREMENTS updates — recorded in the final metadata commit)

## Files Created/Modified

### Created (launcher scaffold)
- `launcher/package.json` — `wiiwho-launcher` 0.1.0, scripts include `dev`/`build`/`test`/`test:run`, dependencies exclude all Pitfall-5 libs
- `launcher/electron.vite.config.ts` — main/preload/renderer triple-build with `@tailwindcss/vite` plugin and `@/*` alias to `src/renderer/src/*`
- `launcher/vitest.config.ts` — Node environment, `src/**/*.test.ts(x)` include
- `launcher/components.json` — shadcn config (new-york style, cssVariables, neutral base)
- `launcher/src/main/index.ts` — BrowserWindow (1000×650, non-resizable, `title: 'Wiiwho Client'`, locked webPreferences); registers all four IPC handler groups; `setAppUserModelId('club.wiiwho.launcher')`
- `launcher/src/main/ipc/auth.ts` — auth:status/login/logout stubs returning typed payloads
- `launcher/src/main/ipc/game.ts` — game:play/cancel/status stubs (play returns `{ ok: true, stub: true, reason: ... }`)
- `launcher/src/main/ipc/settings.ts` — settings:get/set + logs:read-crash stubs (in-memory settings only)
- `launcher/src/main/ipc/security.ts` — `setAuditedPrefs()` + `__security:audit` handler computing `allTrue`
- `launcher/src/main/ipc/{auth,game,settings,security}.test.ts` — Vitest mocks of `electron`, assertions on stub shapes and `allTrue: true`
- `launcher/src/preload/index.ts` — `contextBridge.exposeInMainWorld('wiiwho', {...})` with all channels + on/off wrappers
- `launcher/src/renderer/index.html` — `<title>Wiiwho Client</title>`, strict CSP
- `launcher/src/renderer/src/App.tsx` — React root with renderer-side `console.assert` security guards, Play handler, securityAudit effect
- `launcher/src/renderer/src/global.css` — Tailwind v4 `@import "tailwindcss"` + `@theme` custom properties
- `launcher/src/renderer/src/wiiwho.d.ts` — `export interface WiiWhoAPI` + `declare global { interface Window { wiiwho: WiiWhoAPI } }`
- `launcher/src/renderer/src/components/ui/button.tsx` — shadcn button copied verbatim
- `launcher/src/renderer/src/lib/utils.ts` — shadcn `cn()` helper
- `launcher/README.md` — Phase 1 scope, verification commands, Phase 2/3 contract pointer
- `pnpm-workspace.yaml` — declares `packages: [launcher]`

### Modified
- `package.json` (root) — added `dev` and `build:launcher` filter scripts; preserved Plan 00's `"test": "node scripts/check-docs.mjs && pnpm --filter ./launcher test:run"`
- `.planning/STATE.md` — recorded 2026-04-20 runtime verification evidence under Decisions
- `.planning/REQUIREMENTS.md` — LAUN-01, LAUN-02, LAUN-06 marked Complete (both checkboxes and traceability table)
- `.planning/ROADMAP.md` — Phase 1 progress row updated

## Decisions Made

1. **Runtime security verification via __security:audit IPC.** The plan could have asserted `{ contextIsolation: true, ... }` in the unit test only. We instead capture the exact object passed to BrowserWindow (`setAuditedPrefs`) and expose it through an IPC endpoint; the test covers the handler's computation of `allTrue`, and the owner can query the live window from DevTools to see the real runtime state. This makes config-vs-runtime drift observable.

2. **Preload is the ENTIRE attack surface.** Only 5 top-level keys on `window.wiiwho`. No `ipcRenderer`, no `ipc`, no Node globals. Phase 2/3 fill handler BODIES but the channel list and preload shape are locked by `wiiwho.d.ts` and grep-verifiable.

3. **Dead-button Play enforced by dependency absence (Pitfall 5).** Rather than trusting code reviewers to notice if someone adds `@azure/msal-node` to `launcher/package.json`, we grep the dependency list at verification time. The absence IS the invariant.

4. **Display name 'Wiiwho' (first W cap only) for user-visible strings.** Applied project-wide. Structural identifiers (`club.wiiwho.launcher` app user model ID, `window.wiiwho` global, `WiiWhoAPI` TypeScript interface) retain their original style — those live in code identifiers where conventional casing (lowercase package paths, PascalCase types) trumps display preferences.

5. **Stub handlers log-and-return-stub from day 1.** Every channel in the v0.1 surface has a handler that `console.log`s entry and returns a typed placeholder payload. This lets the renderer UI integrate against the real IPC mechanism (not fetch mocks or inline constants) from the first commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Display name correction applied project-wide**
- **Found during:** Task 2 (human-verify checkpoint) — owner noted during runtime verification that the display name should be `Wiiwho` (only first W capitalized), not `WiiWho`
- **Issue:** Task 1 scaffold baked `WiiWho Client` into user-visible strings across 6 files: package.json description/author, README header, BrowserWindow title, HTML `<title>`, App.tsx `<h1>`, wiiwho.d.ts JSDoc
- **Fix:** Renamed all user-visible display strings to `Wiiwho`. Left structural identifiers (`club.wiiwho.launcher` app user model ID, `window.wiiwho` global, `WiiWhoAPI` interface name) unchanged — those are code identifiers, not display text, and renaming them would ripple across imports without benefit
- **Files modified:** launcher/package.json, launcher/README.md, launcher/src/main/index.ts, launcher/src/renderer/index.html, launcher/src/renderer/src/App.tsx, launcher/src/renderer/src/wiiwho.d.ts
- **Verification:** `Grep "WiiWho" launcher/` returns only `WiiWhoAPI` (the structural interface). `pnpm --filter ./launcher test` passes 4 files / 13 tests. `pnpm --filter ./launcher build` produces `out/` artifacts cleanly.
- **Committed in:** `6a61cc5` (fix)

---

**Total deviations:** 1 auto-fixed (1 missing critical — correctness of user-facing display)
**Impact on plan:** Cosmetic / naming correctness only. No functional change, no scope creep. The display name correction was recorded in the Phase 01-foundations Decisions log earlier (Plan 01-01 MODID collision check session) and simply needed to be propagated to the launcher's display strings.

## Known Stubs

Intentional stubs per the plan contract — these are Phase 2/3 extension points, not oversights. All are documented in `launcher/README.md` under "What Phase 1 MUST NOT do".

| File | Location | Stub | Resolved by |
|------|----------|------|-------------|
| `launcher/src/main/ipc/auth.ts` | `auth:status` handler | Returns `{ loggedIn: false }` regardless of state | Phase 2 (AUTH-01/02) |
| `launcher/src/main/ipc/auth.ts` | `auth:login` handler | Returns `{ ok: false, error: 'Phase 1 scaffold — auth not implemented' }` | Phase 2 (AUTH-01) |
| `launcher/src/main/ipc/auth.ts` | `auth:logout` handler | Returns `{ ok: true }` without clearing any token store | Phase 2 (AUTH-06) |
| `launcher/src/main/ipc/game.ts` | `game:play` handler | Returns `{ ok: true, stub: true, reason: 'Phase 1 scaffold — no launch implemented' }` | Phase 3 (LCH-05) |
| `launcher/src/main/ipc/game.ts` | `game:cancel` handler | Returns `{ ok: true, stub: true }` without cancelling anything | Phase 3 |
| `launcher/src/main/ipc/game.ts` | `game:status` handler | Always returns `{ state: 'idle' }` | Phase 3 |
| `launcher/src/main/ipc/settings.ts` | `settings:get/set` | In-memory `Record<string, unknown>` only — not file-backed | Phase 3 (LAUN-03/04) |
| `launcher/src/main/ipc/settings.ts` | `logs:read-crash` | Returns `{ sanitizedBody: '' }` | Phase 3 (LAUN-05, COMP-05) |
| n/a (not registered) | `auth:device-code`, `game:status-changed`, `game:progress` | Renderer `on` subscriptions resolve (preload bridge registered), but main process never emits these events in Phase 1 | Phases 2/3 |
| `launcher/src/renderer/src/App.tsx` | Play button handler | Logs the stub payload and does nothing else | Phase 3 (LCH-05) |

These stubs are intentional and are the whole point of this plan: lock the IPC surface so Phase 2 and Phase 3 can implement handler bodies in parallel without fighting over channel names or preload shape. The stubs are grep-identifiable by their `(stub)` console log markers.

## Issues Encountered

None — the plan executed as written. The one deviation (display name correction) was noted during the Task 2 checkpoint and applied cleanly.

## User Setup Required

None — no external service configuration needed for this plan. Azure AD app registration is the subject of Plan 01-04, not this plan.

## Verification Evidence (from Owner's 2026-04-20 runtime session)

**Command run:** `pnpm --filter ./launcher dev` (Windows)

| Check | Requirement | Result |
|-------|-------------|--------|
| Window geometry | LAUN-01 | ~1000×650, non-resizable, title "Wiiwho Client", dark background — PASS |
| Play button styling | LAUN-02 | Cyan `#16e0ee`, visible, centered — PASS |
| Play click payload | LAUN-02 / Pitfall 5 | `Play clicked: {ok: true, stub: true, reason: 'Phase 1 scaffold — no launch implemented'}` — PASS |
| `__debug.securityAudit()` return | LAUN-06 runtime | `{ contextIsolation: true, nodeIntegration: true, sandbox: true, allTrue: true }` — PASS |
| Renderer-side assertions | LAUN-06 defense-in-depth | `typeof window.process === 'undefined'` AND `typeof window.require === 'undefined'` — PASS |
| Preload key scope | Attack-surface lock | `Object.keys(window.wiiwho) === ['auth','game','settings','logs','__debug']` — PASS |

Automated side (re-run after display-name correction):
- `pnpm --filter ./launcher test`: 4 files / 13 tests passed
- `pnpm --filter ./launcher build`: `out/main/index.js` (3.97 kB), `out/preload/index.js` (1.41 kB), `out/renderer/index.html` + assets produced cleanly

## Phase 1 Success Criterion 4

**Status: SATISFIED.** The phase's fourth success criterion — "Running `pnpm dev` in the launcher opens an Electron window with a visible 'Play' button, `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` all confirmed at runtime, and the preload bridge exposes only named auth/game/settings IPC channels" — is met. Window opens, Play button is visible and cyan, security audit returns `allTrue: true`, preload exposes exactly 5 named top-level keys.

## Next Phase Readiness

- **Phase 2 (Microsoft Auth)** can begin as soon as the Azure AD app registration (Plan 01-04) is approved. The launcher's preload bridge, IPC contract (`wiiwho.d.ts`), and `auth.*` stub handlers are in place. Phase 2 implements `auth:status/login/logout` handler bodies and emits `auth:device-code` events — no preload or channel-list changes required.
- **Phase 3 (Vanilla Launch)** inherits `game.*` and `settings.*` stubs. Phase 3 implements handler bodies and emits `game:status-changed` / `game:progress` events.
- **Blockers/concerns:** None. The launcher scaffold is feature-complete for Phase 1 scope. Pitfall 5 (dead button) is enforced by grepping `launcher/package.json` — any future addition of a banned dep would be immediately visible.

## Self-Check: PASSED

**Files verified on disk (8/8):**
- launcher/src/main/index.ts — FOUND
- launcher/src/preload/index.ts — FOUND
- launcher/src/main/ipc/security.ts — FOUND
- launcher/src/main/ipc/security.test.ts — FOUND
- launcher/src/renderer/src/wiiwho.d.ts — FOUND
- launcher/src/renderer/src/App.tsx — FOUND
- pnpm-workspace.yaml — FOUND
- .planning/phases/01-foundations/01-03-SUMMARY.md — FOUND

**Commits verified (3/3):**
- `a48a9b9` feat(01-03): scaffold Electron launcher with Tailwind/shadcn + runtime-verified security
- `6a61cc5` fix(01-03): rename WiiWho → Wiiwho in user-visible display text
- `aa28a43` docs(01-03): record runtime verification evidence for LAUN-01/02/06

---
*Phase: 01-foundations*
*Plan: 03*
*Completed: 2026-04-20*
