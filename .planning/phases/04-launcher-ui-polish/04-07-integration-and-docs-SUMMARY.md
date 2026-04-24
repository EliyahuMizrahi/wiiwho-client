---
phase: 04-launcher-ui-polish
plan: 07
subsystem: ui
tags: [electron, react, motion, design-system, docs, integration]

requires:
  - phase: 04-launcher-ui-polish
    provides: Sidebar, SettingsModal, Appearance pane, theme tokens, activeSection store
provides:
  - App.tsx logged-in branch composed of Sidebar + main-area router + SettingsModal + AccountBadge + DeviceCodeModal
  - docs/DESIGN-SYSTEM.md with all D-36 sections (except Spotify, which was retired)
  - scripts/check-docs.mjs design-system validator (27 assertions)
  - launcher/src/renderer/src/test/antiBloat.test.tsx repo-wide grep test (UI-05)
affects: [phase-05-forge-integration]

tech-stack:
  added: []
  patterns:
    - App.tsx uses activeSection store + AnimatePresence route swap (no router dep)
    - DESIGN-SYSTEM.md structure ratcheted by scripts/check-docs.mjs

key-files:
  created:
    - docs/DESIGN-SYSTEM.md
    - launcher/src/renderer/src/__tests__/App.integration.test.tsx
  modified:
    - launcher/src/renderer/src/App.tsx
    - launcher/src/main/index.ts
    - launcher/src/renderer/src/test/antiBloat.test.tsx
    - scripts/check-docs.mjs

key-decisions:
  - "Ship App.tsx integration without Spotify wiring after owner descoped UI-06 during smoke UAT (2026-04-24)"
  - "Retain historical Spotify plans (04-05, 04-06) and their SUMMARYs as archival record; source fully deleted but plan text preserves context for future resurrection"
  - "check-docs.mjs keeps 27 assertions post-removal — Spotify-specific doc headings never had check-docs assertions, so validator count unchanged"

patterns-established:
  - "Scope reduction via /gsd:execute-phase smoke-test checkpoint: owner can abort a previously-integrated feature mid-UAT; orchestrator amends SUMMARY files + REQUIREMENTS.md + ROADMAP.md instead of spawning a --gaps plan"

requirements-completed: [UI-01, UI-03, UI-04, UI-05, UI-07]  # UI-06 dropped 2026-04-24

duration: ~35min (plus smoke-UAT + scope-reduction remediation)
completed: 2026-04-24
---

# Plan 04-07: Integration + Docs Summary

**App.tsx rewrite composing the Phase 4 shell + design-system doc + check-docs validator, minus the retired Spotify integration.**

## Performance

- **Duration:** ~35 min integration + docs; ~60 min smoke-UAT + scope reduction
- **Completed:** 2026-04-24
- **Tasks:** 2 of 4 original (Task 3 smoke-UAT invalidated by scope reduction; Task 4 subsumed by this SUMMARY + planning updates)
- **Files modified:** 6 source + 4 planning

## Accomplishments

- App.tsx's logged-in branch now composes Sidebar + MainArea (Play / Cosmetics) + SettingsModal + AccountBadge + DeviceCodeModal with the Crashed takeover branch preserved verbatim
- docs/DESIGN-SYSTEM.md ships with all D-36 sections (Philosophy, Tokens, Typography, Motion, Layout, Components, Exclusion checklist with Reviewer sign-off, Changelog)
- scripts/check-docs.mjs extended with DESIGN-SYSTEM structural validator (27 total assertions across 4 docs)
- antiBloat.test.tsx is a repo-wide grep test enforcing UI-05 exclusions at the renderer tree level
- 600 tests passing after integration; 470 after Spotify removal

## Task Commits

Integration + docs (retained):
1. **Task 1 RED:** failing App.tsx integration tests — `df9a882`
2. **Task 1 GREEN:** App.tsx rewrite + main/index.ts IPC wiring — `000e86c`
3. **Task 2 RED:** check-docs + antiBloat stubs failing — `8c85e81`
4. **Task 2 GREEN:** docs/DESIGN-SYSTEM.md — `81564bd`

Smoke-UAT remediation (before scope reduction):
5. Spotify port-reservation fix — `f775f61`
6. Start polling on connect + route Open-Spotify via shell — `863776b`

Scope reduction (Spotify retirement):
7. **refactor(04): remove Spotify integration from launcher** — `8ff0272`
8. **docs(04): drop Spotify references from DESIGN-SYSTEM** — `1d69342`

## Files Created/Modified

- `launcher/src/renderer/src/App.tsx` — Sidebar + MainArea router + SettingsModal + AccountBadge + DeviceCodeModal composition; Crashed takeover preserved
- `launcher/src/renderer/src/__tests__/App.integration.test.tsx` — integration tests for logged-in tree
- `launcher/src/main/index.ts` — (Spotify handler registration removed during scope reduction)
- `docs/DESIGN-SYSTEM.md` — UI-07 design system, D-36 sections, UI-05 Exclusion checklist
- `scripts/check-docs.mjs` — structural validator for DESIGN-SYSTEM.md
- `launcher/src/renderer/src/test/antiBloat.test.tsx` — repo-wide grep test (UI-05)

## Decisions Made

- **Scope reduction over gap closure:** When Spotify surfaced three bugs during final smoke UAT (Windows port-reservation EACCES, polling never armed on connect, Electron window.open handler spawning blank BrowserWindow), the owner chose to drop UI-06 from v0.1 rather than close gaps. Rationale: Spotify is tangential for a Minecraft launcher, and the cost/value ratio of continued debugging did not justify the feature at this milestone.
- **Full source removal, not feature flag:** Keeping dead Spotify code behind a flag would leak attack surface (preload bridge key, IPC handlers, safeStorage usage) and muddy the D-11 preload invariant. A clean removal with git history as the recovery path is lower-risk.
- **Preload D-11 re-established:** `window.wiiwho` is back to its original 5 top-level keys (auth, game, settings, logs, __debug). The "DELIBERATE 6th key" deviation comment was removed from the preload bridge header.
- **UI-06 classification:** Dropped (not deferred) — the requirement is marked with `[~]` and strikethrough in REQUIREMENTS.md with a dated note. Revival in a future milestone would require re-opening the requirement and re-registering a Spotify dev app.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spotify Redirect URI rules changed post-2025-11-27 migration**
- **Found during:** Task 3 smoke UAT
- **Issue:** Plan (D-31) and Plan 04-00 correction both specified `http://127.0.0.1/callback` with no port; Spotify's 2025-11-27 OAuth migration rejected bare loopback without explicit port.
- **Fix:** Registered three explicit-port URIs (initially 53681-53683; then 35891-35893 after Windows Hyper-V EACCES); widened `bindWithFallback` to catch EACCES + EADDRNOTAVAIL.
- **Committed in:** `f775f61` (pre-removal)
- **Post-scope-reduction:** Source deleted; only historical record remains in this SUMMARY.

**2. [Rule 1 - Bug] SpotifyManager.connect() never armed poll timer**
- **Found during:** Task 3 smoke UAT
- **Issue:** Tokens persisted and `status-changed` fired, but `currentTrack` stayed null forever — poll timer wasn't started until user triggered setVisibility.
- **Fix:** `connect()` + `restoreFromDisk()` now call `void this.pollOnce()` + `this.startPolling()` after tokens land.
- **Committed in:** `863776b` (pre-removal)
- **Post-scope-reduction:** Source deleted; only historical record remains.

**3. [Rule 1 - Bug] "Open Spotify app" menu spawned blank Electron BrowserWindow**
- **Found during:** Task 3 smoke UAT
- **Issue:** `<a href="spotify://" target="_blank">` triggered Electron's default `window.open` handler, which spawned a blank BrowserWindow alongside the OS-level `spotify://` handler.
- **Fix:** Replaced anchor with onClick that calls `window.wiiwho.spotify.openApp()` → new `spotify:open-app` IPC → `shell.openExternal('spotify://')`.
- **Committed in:** `863776b` (pre-removal)
- **Post-scope-reduction:** Source deleted.

**4. [Rule 4 - Architectural] Full Spotify removal**
- **Found during:** Task 3 smoke UAT (post-bug-fixes)
- **Issue:** After bug fixes, owner decided the feature is out of scope for v0.1 regardless of correctness.
- **Fix:** Deleted 19 source files, edited 19 shared files to strip Spotify references, amended REQUIREMENTS.md + ROADMAP.md + this SUMMARY. Preload bridge back to D-11 5-key invariant.
- **Committed in:** `8ff0272` + `1d69342`

---

**Total deviations:** 4 (3 bug fixes subsumed by scope reduction; 1 Rule-4 architectural scope reduction)
**Impact on plan:** Significant scope reduction. Phase 4 now ships 5 of 6 original requirements. Remaining 5 requirements (UI-01, UI-03, UI-04, UI-05, UI-07) ship fully and cleanly.

## Issues Encountered

- **Windows Hyper-V reserved port block** (`netsh interface ipv4 show excludedportrange tcp`) covers the 53613-53712 range on the owner's dev box; the plan's chosen 53681-53683 fell inside it. Fixed by picking 35891-35893 before the ultimate retirement.
- **Spotify's 2025-11-27 OAuth migration** invalidated three generations of plan assumptions (wildcard → bare 127.0.0.1 → runtime-chosen port). Each correction required re-registering redirect URIs in the dashboard.
- **Electron's default window.open** behavior is a known footgun for URL scheme links in renderer code. A `setWindowOpenHandler` in main could defensively catch this class of bug for future phases.

## User Setup Required

None post-scope-reduction. (The owner's previously-registered Spotify dev app can be left in place or deleted from the dashboard — no code dependency either way.)

## Next Phase Readiness

- Phase 4 ships clean with themes, motion, Sidebar, Settings modal, DESIGN-SYSTEM.md.
- Phase 5 (Forge Integration) unblocked. Its prior "optional stretch: Spotify in-game HUD" note is moot; ROADMAP updated.
- Memory note updated: Phase 4 scope no longer mentions Spotify.

---
*Phase: 04-launcher-ui-polish*
*Completed: 2026-04-24*
