---
phase: 04-launcher-ui-polish
plan: 04
subsystem: theme-picker-appearance
tags: [theme-picker, appearance-pane, eyedropper, reduce-motion, accent-presets, settings-modal]

requires:
  - phase: 04-launcher-ui-polish
    plan: 01
    provides: ACCENT_PRESETS 8-tuple + DEFAULT_ACCENT_HEX + useSettingsStore.{setAccent, setReduceMotion, theme.{accent,reduceMotion}}
  - phase: 04-launcher-ui-polish
    plan: 03
    provides: SettingsModal `data-testid="appearance-pane-stub"` anchor point (openPane === 'appearance' slot)
provides:
  - launcher/src/renderer/src/components/ThemePicker.tsx — 8 preset swatches (cyan → slate, D-13 order, WCAG-tuned per Plan 04-01 RESEARCH substitution) + custom hex input with /^#[0-9a-fA-F]{6}$/ validation + EyeDropper button feature-probed via `typeof window.EyeDropper !== 'undefined'` (D-14 fallback)
  - launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx — pane combining <ThemePicker /> + "Reduce motion" <select> (System/On/Off, D-24) wired to useSettingsStore.setReduceMotion; root data-testid="appearance-pane"
  - SettingsModal.tsx — imports AppearancePane; the `openPane === 'appearance'` branch now renders <AppearancePane /> (stub <div> replaced with a single-line edit per Plan 04-03's deliberate anchor-point convention)
affects: [04-07]

tech-stack:
  added: []
  patterns:
    - "EyeDropper feature-probe: `typeof window.EyeDropper !== 'undefined'` → render pipette button only when the Chromium EyeDropper API is available. Chromium 146 (Electron 41) = yes; jsdom = no. Rejection (user ESC during pick) silenced since it is the only documented failure mode and represents a clean cancel, not an error."
    - "Custom hex input two-track state: local `hexInput` string tracks what the user typed (even if invalid, so the input reflects their keystrokes); `setAccent` is called only when the regex matches. Prevents a flash of invalid colour while the user is mid-type, and prevents half-typed junk from being persisted to settings.json."
    - "Stub-swap convention (from Plan 04-03 Known Stubs): the `<div data-testid='appearance-pane-stub'>` was a deliberate one-line anchor point. Plan 04-04 replaces that single JSX expression with `<AppearancePane />` — zero surrounding-code churn. SettingsModal.test.tsx's stub-asserting assertion was rewritten to assert the new `appearance-pane` testid rendered by the AppearancePane root."

key-files:
  created:
    - launcher/src/renderer/src/components/ThemePicker.tsx
    - launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx
    - launcher/src/renderer/src/components/SettingsPanes/__tests__/AppearancePane.test.tsx
  modified:
    - launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx (Wave-0 stub body replaced with 10 real assertions)
    - launcher/src/renderer/src/components/SettingsModal.tsx (import AppearancePane + swap stub `<div>` for `<AppearancePane />`)
    - launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx (one testid assertion updated: `appearance-pane-stub` → `appearance-pane`)

key-decisions:
  - "Used `aria-pressed` rather than `aria-selected` or a Radix ToggleGroup for the active-preset indicator. ToggleGroup would work but adds a dependency surface (pointer-capture jsdom stubs, Radix-specific keyboard semantics) the flat grid of buttons doesn't need. `aria-pressed` is the semantically correct ARIA state for a toggle-style button and is directly observable from tests without jest-dom matchers."
  - "Custom hex input does NOT call setAccent when invalid. An alternative would be to still call it and rely on the store's own `isValidHex` no-op guard (the store already rejects invalid input). Preferring the component-side regex check because (a) it makes the component's contract observable from its tests without stubbing the store's internal guard, and (b) it matches the plan's explicit behavior spec — typing invalid does NOT trigger an IPC round-trip (store's guard would prevent persistence but the IPC call itself would still fire)."
  - "EyeDropper rejection silenced entirely. The API spec only defines a single rejection path (user pressing ESC during pick), and we do not want to surface an error banner when the user intentionally cancels. If Chromium ever adds new rejection reasons (e.g. permission denied, or a user-gesture timeout), we may want to revisit — but for v0.1 silent-cancel matches the plan's behavior and the UX of every other native OS colour picker."
  - "SettingsModal.test.tsx updated to assert `appearance-pane` (AppearancePane's own root testid) rather than adding a compatibility `data-testid='appearance-pane-stub'` to AppearancePane's root. Cleaner naming — `-stub` is a historical artifact of the Plan 04-03 anchor point; once the real pane lands, the `stub` suffix is misleading. Same convention the other panes use (general-pane, account-pane, about-pane — no -stub suffix on any of them)."
  - "EyeDropper test uses `await new Promise(r => setTimeout(r, 10))` to let the resolved/rejected promise chain settle before asserting on setAccent. Alternative would be `vi.waitFor(...)` but a 10ms tick is sufficient in practice and avoids the extra dependency on Vitest's wait-for retries for what is really a microtask drain."

patterns-established:
  - "EyeDropper feature-probe + silent-cancel pattern: reusable for any other Chromium-bleeding-edge API we adopt (Screen Capture, File System Access, etc.) — probe via `typeof window.X !== 'undefined'`, render UI conditionally, silence user-cancel rejections."
  - "Component-side regex validation on free-text inputs: pattern established for any future hex/IP/URL inputs — the component enforces the contract before hitting the store, making the test suite independent of the store's own validators."
  - "Stub-swap convention (from Plan 04-03) verified end-to-end: Plan 04-06 (Spotify pane) can follow the same pattern — replace `<div data-testid='spotify-pane-stub'>` with `<SpotifyPane />`, update SettingsModal.test.tsx's single assertion, done."

requirements-completed: [UI-01, UI-03, UI-07]

duration: ~4 min
completed: 2026-04-24
---

# Phase 4 Plan 04: ThemePicker + Appearance Pane Summary

**UI-01 user-facing theme switching complete — 8 preset swatches + custom hex input with /^#[0-9a-fA-F]{6}$/ validation + EyeDropper button (D-14, feature-probed via `typeof window.EyeDropper`) combined with a reduce-motion <select> (D-24, System/On/Off) inside an AppearancePane that replaces the Plan 04-03 `appearance-pane-stub` anchor point with a single-line SettingsModal edit.**

## Performance

- **Duration:** ~4 min total
- **Started:** 2026-04-24T06:20:41Z (after Plan 04-03 final commit `515f459`)
- **Tasks:** 2 (both auto, TDD RED → GREEN)
- **Files created:** 3 (ThemePicker.tsx, AppearancePane.tsx, AppearancePane.test.tsx)
- **Files modified:** 3 (ThemePicker.test.tsx Wave-0 stub replacement, SettingsModal.tsx stub swap, SettingsModal.test.tsx testid update)
- **Test deltas:** baseline 455 passed / 7 todo → 470 passed / 6 todo (+15 real assertions net; 1 Wave-0 todo consumed by ThemePicker.test.tsx stub replacement)

## Accomplishments

### 8 preset hex values in ACCENT_PRESETS order

Verbatim from `theme/presets.ts` (Plan 04-01 RESEARCH-tuned per WCAG 2.1 SC 1.4.11 non-text contrast ≥3:1 against `--color-wiiwho-bg` `#111111`):

| Index | id        | Name      | Hex       | RESEARCH substitution note |
| ----- | --------- | --------- | --------- | -------------------------- |
| 0     | cyan      | Cyan      | `#16e0ee` | default — D-13 lock |
| 1     | mint      | Mint      | `#22c55e` | — |
| 2     | violet    | Violet    | `#a855f7` | — |
| 3     | tangerine | Tangerine | `#f97316` | — |
| 4     | pink      | Pink      | `#ec4899` | — |
| 5     | crimson   | Crimson   | `#f87171` | RESEARCH-tuned (D-13 listed "Red" as illustrative) |
| 6     | amber     | Amber     | `#fbbf24` | RESEARCH-tuned (D-13 listed "Yellow" as illustrative) |
| 7     | slate     | Slate     | `#cbd5e1` | RESEARCH-tuned (D-13 listed "Gray" as illustrative) |

ThemePicker renders them in this exact tuple order via `ACCENT_PRESETS.map(p => ...)` — the D-10 left-to-right visual order is baked into the source tuple, not the component.

### EyeDropper feature-probe + fallback behavior

Pattern: `const supportsEyeDropper = typeof window.EyeDropper !== 'undefined'`.

| Environment     | `window.EyeDropper` defined? | Pipette button rendered? | Behavior on click |
| --------------- | ---------------------------- | ------------------------ | ----------------- |
| Electron 41 (Chromium 146) | yes                          | yes                      | `new window.EyeDropper().open()` → resolved hex → `setAccent(hex)` + `setHexInput(hex)` |
| Chromium <95 / Firefox / Safari | no                           | no                       | (N/A — button hidden) |
| jsdom test env  | no                           | no                       | (N/A — button hidden) |
| Electron 41 + user presses ESC during pick | yes                          | yes                      | Dropper promise rejects → caught silently → no setAccent call → no error UI |

**Silent-cancel rationale:** The EyeDropper API spec documents a single rejection reason — user aborted the pick (typically by pressing ESC). Surfacing this as an error would be hostile UX: the user intentionally cancelled, so the right response is to go back to the previous state without comment. If Chromium later adds new rejection reasons, we revisit.

### Reduce motion resolution table (user × OS)

Plan 04-01's `useMotionConfig` hook already does the resolution; AppearancePane exposes the user-override dimension via the `<select>`. The full truth table is therefore:

| User override | OS `prefers-reduced-motion` | → reduced? | Durations         | Spring            |
| ------------- | --------------------------- | ---------- | ----------------- | ----------------- |
| 'system'      | off                         | false      | 0.12 / 0.20 / 0.32 | SPRING_STANDARD  |
| 'system'      | on                          | true       | 0 / 0 / 0          | { duration: 0 }  |
| 'on'          | off                         | true       | 0 / 0 / 0          | { duration: 0 }  |
| 'on'          | on                          | true       | 0 / 0 / 0          | { duration: 0 }  |
| 'off'         | off                         | false      | 0.12 / 0.20 / 0.32 | SPRING_STANDARD  |
| 'off'         | on                          | false      | 0.12 / 0.20 / 0.32 | SPRING_STANDARD  |

User override always wins over OS. 'System' defers to OS. UI-03 compliance: user can forcibly disable motion regardless of OS setting.

AppearancePane's `<option>` labels surface this intent in plain English:

- `System (follow OS)`
- `On (always reduce)`
- `Off (always animate)`

Plus a helper `<p>` below the select: *"Collapses transitions to 0ms when reduced — respects OS accessibility setting when 'System' is selected."*

### SettingsModal appearance stub → AppearancePane swap

**Before (Plan 04-03 anchor point):**
```tsx
{openPane === 'appearance' && (
  <div data-testid="appearance-pane-stub" className="text-neutral-500">
    Appearance (Plan 04-04)
  </div>
)}
```

**After (Plan 04-04 this plan):**
```tsx
{openPane === 'appearance' && <AppearancePane />}
```

Plus a single `import { AppearancePane } from './SettingsPanes/AppearancePane'` addition.

SettingsModal.test.tsx's one assertion that used to check `getByTestId('appearance-pane-stub')` now checks `getByTestId('appearance-pane')` (AppearancePane's own root testid). Clean naming — no `-stub` suffix on a non-stub pane.

### ThemePicker test coverage (10 assertions, all green)

1. Renders 8 preset swatches in exact D-13 / RESEARCH-tuned tuple order
2. Clicking Mint swatch → `setAccent('#22c55e')`
3. Clicking Violet swatch → `setAccent('#a855f7')`
4. Active-state indicator: accent matches preset → `aria-pressed="true"`; others → `aria-pressed="false"`
5. Valid hex input (`#ff00aa`) → `setAccent('#ff00aa')`
6. Invalid input (`not-a-hex`) → `setAccent` NOT called
7. EyeDropper button hidden when `window.EyeDropper === undefined`
8. EyeDropper button visible when `window.EyeDropper` defined
9. Clicking EyeDropper + resolved hex → `setAccent` called with that hex
10. EyeDropper rejection (simulated user ESC) → `setAccent` NOT called

### AppearancePane test coverage (5 assertions, all green)

1. Renders `<h2>Appearance</h2>`
2. ThemePicker mounted → 8 `[data-accent-preset]` elements reachable
3. Reduce motion `<select>` has exactly 3 options: `system`, `on`, `off` (sorted equality)
4. Selecting 'On' → `setReduceMotion('on')`
5. Root `data-testid="appearance-pane"` present

## Task Commits

Each task committed atomically with `--no-verify` (Wave 3b parallel-mode convention):

1. **Task 1: ThemePicker component (8 presets + hex input + EyeDropper)** — `bbd06d3` (feat)
2. **Task 2: AppearancePane + swap SettingsModal stub** — `807cb42` (feat)

## Files Created/Modified

See frontmatter `key-files` for the authoritative list.

## Decisions Made

See frontmatter `key-decisions` for the full list. Summary:

- **`aria-pressed` over `aria-selected` / Radix ToggleGroup:** simpler semantics for a toggle-style swatch grid; avoids extra Radix test plumbing (pointer-capture stubs etc.).
- **Component-side regex validation on hex input:** the component enforces its own contract; the store's `isValidHex` guard remains a defense-in-depth belt-and-suspenders.
- **EyeDropper rejection silenced:** the only documented rejection path is user-cancel; surfacing it as an error is hostile UX.
- **`appearance-pane` testid (no `-stub` suffix) on AppearancePane's root:** matches the `general-pane` / `account-pane` / `about-pane` convention; the `-stub` suffix was a Plan 04-03 artifact that is now obsolete.
- **10ms setTimeout drain in EyeDropper tests:** sufficient to flush the microtask queue; cleaner than adding a `vi.waitFor` dependency for a deterministic single-promise chain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `toHaveAttribute` matcher not registered**

- **Found during:** Task 1 (running ThemePicker.test.tsx GREEN phase)
- **Issue:** The plan-provided test snippet used `expect(...).toHaveAttribute('aria-pressed', 'true')`, which requires `@testing-library/jest-dom` matchers to be registered. This project does NOT wire jest-dom (no setup file extends Vitest's matchers); `toHaveAttribute` is therefore unknown at runtime.
- **Fix:** Rewrote the two `toHaveAttribute` assertions as raw `getAttribute` checks: `expect(el.getAttribute('aria-pressed')).toBe('true')`. Semantically equivalent, zero new dependencies.
- **Files modified:** `launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx`
- **Plan acceptance criterion impact:** none — the criterion asserted the `aria-pressed` state is observable from the test; the fix preserves that contract.
- **Rationale:** Adding jest-dom would be a Rule-4 architectural change (new cross-cutting test dependency affecting every test file's setup). The raw-getAttribute workaround is a one-line blocking fix with zero knock-on effects.

### Plan acceptance-criterion drift (NOT fixed — explanatory-comment retention)

**1. `appearance-pane-stub` still appears once in `AppearancePane.tsx` as a docblock comment**

- **Plan said:** (by implication) `grep "appearance-pane-stub" launcher/src/renderer/src/` returns 0 hits after the swap.
- **Reality:** 1 hit remains, in AppearancePane.tsx's file-header JSDoc explaining *what* was replaced: *"Replaces the data-testid=\"appearance-pane-stub\" anchor point from Plan 04-03 SettingsModal — the switch-case now renders <AppearancePane />."*
- **Why not fixed:** The plan's strict acceptance criterion (line 499) is specifically `grep "appearance-pane-stub" launcher/src/renderer/src/components/SettingsModal.tsx returns 0 hits` — which IS satisfied (0 hits in SettingsModal.tsx). The remaining hit in AppearancePane.tsx is inside a JSDoc comment explaining the plan lineage for future readers. Retaining it is valuable documentation.
- **Impact:** none — it's not an active testid, never matches against a live DOM node, and future grep-based integrity checks can be scoped to exclude docblocks if strict zero-hits-anywhere is desired.

## Issues Encountered

1 auto-fixed blocking issue (jest-dom matcher absence — see above). No other issues. No architectural Rule-4 decisions needed.

## Next Plan Readiness

**Plan 04-06 (Spotify renderer UI)** — unblocked AND pattern-validated:
- SettingsModal renders `<div data-testid="spotify-pane-stub">` when `openPane==='spotify'` — Plan 04-06 follows the exact same swap pattern this plan used: import `<SpotifyPane />`, replace the stub `<div>` with `<SpotifyPane />`, update SettingsModal.test.tsx's single stub-asserting assertion. Single-commit edit.
- `--color-accent` runtime-mutable via the AppearancePane flow is now proven end-to-end — Spotify pane's "Now playing" accent-dependent UI will pick up the live colour automatically.

**Plan 04-07 (integration + docs)** — unblocked:
- DESIGN-SYSTEM.md §Colors table now has 8 real contrast-verified hexes to document (source of truth: `theme/presets.ts` JSDoc header + this SUMMARY's preset table).
- docs/SETTINGS.md §Reduce motion now has a real user × OS resolution table to mirror (source of truth: Plan 04-01 SUMMARY table + this SUMMARY's reduce-motion section).

## Self-Check: PASSED

**Files (verified present + non-empty):**
- [x] `launcher/src/renderer/src/components/ThemePicker.tsx` — `ThemePicker` exported; ACCENT_PRESETS+setAccent+EyeDropper grep = 15 hits; `/^#[0-9a-fA-F]{6}$/` regex present
- [x] `launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx` — Wave-0 stub body replaced; 10 real assertions green
- [x] `launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx` — `AppearancePane` exported; `ThemePicker` + `setReduceMotion` grep = 5 hits; data-testid="appearance-pane" root
- [x] `launcher/src/renderer/src/components/SettingsPanes/__tests__/AppearancePane.test.tsx` — 5 assertions green
- [x] `launcher/src/renderer/src/components/SettingsModal.tsx` — `AppearancePane` import + render in `openPane === 'appearance'` branch; `appearance-pane-stub` = 0 hits

**Commits (verified in git log):**
- [x] `bbd06d3` — feat(04-04): ThemePicker component (8 presets + hex input + EyeDropper)
- [x] `807cb42` — feat(04-04): AppearancePane + swap SettingsModal stub

**Test suite:** full launcher suite after both commits: **470 passed + 6 todo + 0 failed** across 51 test files + 6 skipped (+15 assertions vs Plan 04-03 baseline; -1 todo from ThemePicker Wave-0 stub replacement).

**Typecheck:** `pnpm typecheck` (both `typecheck:node` and `typecheck:web` projects) exits 0.

---
*Phase: 04-launcher-ui-polish*
*Completed: 2026-04-24*
