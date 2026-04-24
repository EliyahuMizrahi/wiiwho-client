---
phase: 04-launcher-ui-polish
plan: 01
subsystem: tokens-and-settings
tags: [tokens, theme, typography, motion, settings-schema, migration, zustand, hooks]

requires:
  - phase: 04-launcher-ui-polish
    plan: 00
    provides: motion@^12.38.0 dependency + bundled Inter/JetBrainsMono woff2 fonts + Nyquist test stubs for motion.test.ts, settings.theme.test.ts, store-v2-migration.test.ts
provides:
  - launcher/src/renderer/src/global.css — full Phase 4 @theme token catalog (bg/surface/border, 8 accent presets, typography vars, 3 motion durations, 2 CSS easings, 4 layout sizes) + :root runtime-mutable --color-accent override + @font-face loaders for Inter + JetBrains Mono with font-display: swap
  - launcher/src/renderer/src/theme/presets.ts — ACCENT_PRESETS readonly 8-tuple (cyan default + 7 others) + DEFAULT_ACCENT_HEX, with header JSDoc documenting D-13 illustrative → RESEARCH WCAG-tuned Crimson/Amber/Slate substitution
  - launcher/src/renderer/src/theme/motion.ts — JS mirror of CSS motion vars (DURATION_* in seconds for framer-motion + EASE_* tuples + SPRING_STANDARD)
  - launcher/src/main/settings/store.ts — SettingsV2 schema with {accent, reduceMotion} theme slice; migrateV1ToV2 preserves ramMb+firstRunSeen; validAccent (/^#[0-9a-fA-F]{6}$/) + validReduceMotion enforce per-field fallback; writeSettings(patch) returns the fresh post-write snapshot
  - launcher/src/main/ipc/settings.ts — simplified handler that delegates merge+validate to writeSettings
  - launcher/src/renderer/src/wiiwho.d.ts — settings.{get,set} preload types bumped to v2 shape with theme slice
  - launcher/src/renderer/src/stores/settings.ts — v2 Zustand store with theme slice + modal state (modalOpen + openPane); new actions setAccent / setReduceMotion / setModalOpen / setOpenPane (atomic — Pitfall 8); initialize() re-applies persisted accent to :root (Pitfall 1 HMR fix)
  - launcher/src/renderer/src/hooks/useMotionConfig.ts — reduced-motion resolver combining motion/react useReducedMotion (OS) + store.theme.reduceMotion (user override); returns {reduced, durationFast/Med/Slow, spring}
affects: [04-02, 04-03, 04-04, 04-06, 04-07]

tech-stack:
  added:
    - theme/ directory under src/renderer/src (new JS mirror layer for tokens)
    - hooks/useMotionConfig hook using motion/react's useReducedMotion
  patterns:
    - "Runtime :root CSS var swap for accent — setProperty('--color-accent', hex) before awaiting IPC (instant UI feedback; persisted authority wins next launch)"
    - "Per-field validator pattern in settings store (validAccent / validReduceMotion) — preserves valid siblings when one field is invalid; mirrors Phase 3 Plan 03-02's clampRam pattern"
    - "Atomic pane+modal open (setOpenPane) — single Zustand set call avoids two-step render race (Pitfall 8)"
    - "Full-object writeSettings → patch-based writeSettings(Partial) — main store owns merge+validate, IPC handler collapses to one call, renderer sends narrow patches"

key-files:
  created:
    - launcher/src/renderer/src/theme/presets.ts
    - launcher/src/renderer/src/theme/motion.ts
    - launcher/src/renderer/src/hooks/useMotionConfig.ts
    - launcher/src/renderer/src/hooks/useMotionConfig.test.ts
  modified:
    - launcher/src/renderer/src/global.css (rewritten: +8 presets, +3 durations, +2 easings, +4 layout sizes, +typography vars, +@font-face Inter & JBMono, +:root runtime override; removed --color-wiiwho-accent in favour of --color-accent)
    - launcher/src/renderer/src/test/motion.test.ts (Wave-0 stub body replaced with 22 assertions)
    - launcher/src/main/settings/store.ts (v1 → v2 migration, theme slice, patch-based writeSettings)
    - launcher/src/main/settings/store.test.ts (v1 assertions updated to v2 shape + Partial writeSettings signature)
    - launcher/src/main/settings/__tests__/store-v2-migration.test.ts (Wave-0 stub body replaced with 10 assertions)
    - launcher/src/main/ipc/settings.ts (handler collapses to a single writeSettings call)
    - launcher/src/main/ipc/settings.test.ts (v1 assertions updated to v2 shape)
    - launcher/src/renderer/src/wiiwho.d.ts (settings surface bumped to v2)
    - launcher/src/renderer/src/stores/settings.ts (v2 shape + theme slice + modal state + 4 new actions)
    - launcher/src/renderer/src/stores/__tests__/settings.test.ts (v1 assertions updated to v2 shape)
    - launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts (Wave-0 stub body replaced with 9 assertions)
    - launcher/src/renderer/src/components/__tests__/App.test.tsx (useSettingsStore.setState seed → v2)
    - launcher/src/renderer/src/components/__tests__/RamSlider.test.tsx (seed → v2)
    - launcher/src/renderer/src/components/__tests__/SettingsDrawer.test.tsx (seed → v2)

key-decisions:
  - "RESEARCH retuned D-13 illustrative Red/Yellow/Gray to WCAG-contrast-verified Crimson/Amber/Slate (#f87171 / #fbbf24 / #cbd5e1) against the #111111 dark background. Documented in presets.ts header JSDoc so Plan 04-07's DESIGN-SYSTEM.md §Colors table can forward-reference the rationale."
  - "writeSettings signature changed from full-object (SettingsV1) to Partial<SettingsPatch>. Main store owns the merge; IPC handler collapses to one call; renderer sends narrow patches (`{theme:{accent:'#ec4899'}}`). Cleaner 3-layer story, and the renderer can express `theme.accent` without having to know current ramMb/firstRunSeen."
  - "--color-wiiwho-accent token REMOVED from global.css (replaced by --color-accent with :root override for runtime mutation). Button.tsx still references the old token — intentional: plan defers legacy-consumer cleanup to Plan 04-07's integration pass. Runtime effect: Button's accent styling is temporarily a no-op (neutral-950 text on undefined background) until 04-07 lands; no test regressions since no test asserts button colour pixels."
  - "Accent is applied to :root BEFORE awaiting IPC in setAccent (and NOT reverted on IPC failure). UI-01 prioritises instant visual feedback; the worst failure mode is a locally-applied colour that doesn't persist across launches, which is recoverable and preferable to a jarring delay on every click."
  - "Settings migration is read-time + in-memory only. The on-disk v1 file is NOT proactively rewritten during readSettings — the next writeSettings call persists v2 shape atomically. Keeps readSettings idempotent (no surprise disk writes from a read)."

patterns-established:
  - "Token single-source-of-truth layer: global.css @theme is authoritative; theme/*.ts files are JS mirrors with inline comments naming the mirrored CSS var. New tokens land in @theme first, then mirror if JS needs the number."
  - "Nyquist stub replacement pattern: Wave-0 stubs with @vitest-environment docblock + it.todo → Wave-1 executor edits the stub in-place (same file path, same environment) and populates real assertions. Keeps the downstream plan's <automated> verify target stable across waves."

requirements-completed: [UI-01, UI-03, UI-07]

duration: ~12 min
completed: 2026-04-24
---

# Phase 4 Plan 01: Tokens & Settings Summary

**Full Phase 4 token catalog + settings schema v1 → v2 migration with theme slice + useMotionConfig reduced-motion resolver — every downstream Phase 4 component now has a single-source-of-truth @theme to consume and a typed settings.theme.{accent,reduceMotion} surface to bind to.**

## Performance

- **Duration:** ~12 min total
- **Started:** 2026-04-24T05:38:00Z (after 04-00 final commit `14dc26e`)
- **Tasks:** 3 (all auto, TDD RED→GREEN flow)
- **Files created:** 4 (theme/presets.ts, theme/motion.ts, hooks/useMotionConfig.ts, hooks/useMotionConfig.test.ts)
- **Files modified:** 13 (global.css, settings store + tests + IPC, wiiwho.d.ts, renderer settings store + tests, 3 downstream component test seeds)
- **Test deltas:** baseline 365 → 412 (+47 new assertions across 4 test files; 9 todo remaining for Plans 04-02..04-07)

## Accomplishments

### Tokens added to @theme (verbatim values from global.css)

| Category   | Token                    | Value                             |
| ---------- | ------------------------ | --------------------------------- |
| Colour     | --color-wiiwho-bg        | #111111                           |
| Colour     | --color-wiiwho-surface   | #1a1a1a                           |
| Colour     | --color-wiiwho-border    | #262626                           |
| Colour     | --color-accent           | #16e0ee (mutable via :root)       |
| Preset     | --color-preset-cyan      | #16e0ee                           |
| Preset     | --color-preset-mint      | #22c55e                           |
| Preset     | --color-preset-violet    | #a855f7                           |
| Preset     | --color-preset-tangerine | #f97316                           |
| Preset     | --color-preset-pink      | #ec4899                           |
| Preset     | --color-preset-crimson   | #f87171                           |
| Preset     | --color-preset-amber     | #fbbf24                           |
| Preset     | --color-preset-slate     | #cbd5e1                           |
| Typography | --font-sans              | 'Inter', -apple-system, ...       |
| Typography | --font-mono              | 'JetBrains Mono', ui-monospace... |
| Motion     | --duration-fast          | 120ms                             |
| Motion     | --duration-med           | 200ms                             |
| Motion     | --duration-slow          | 320ms                             |
| Motion     | --ease-emphasized        | cubic-bezier(0.2, 0, 0, 1)        |
| Motion     | --ease-standard          | cubic-bezier(0.4, 0, 0.2, 1)      |
| Layout     | --layout-sidebar-width   | 220px                             |
| Layout     | --layout-window-width    | 1280px                            |
| Layout     | --layout-window-height   | 800px                             |
| Layout     | --layout-modal-height    | 560px                             |

`@font-face` loaders declared for Inter (`InterVariable.woff2`, weights 100-900) and JetBrains Mono (`JetBrainsMono-Variable.woff2`, weights 100-800), both with `font-display: swap`.

### Settings v1 → v2 migration

- v1 shape on disk: `{ version: 1, ramMb, firstRunSeen }`
- v2 shape in memory: `{ version: 2, ramMb, firstRunSeen, theme: { accent: '#16e0ee', reduceMotion: 'system' } }`
- `migrateV1ToV2(v1)` preserves ramMb (re-clamped) + firstRunSeen; adds theme defaults.
- `readSettings()` auto-migrates in memory without rewriting the on-disk file — next `writeSettings` persists v2 atomically.
- Per-field fallback on corruption: invalid accent → `#16e0ee`, invalid reduceMotion → `'system'`, invalid ramMb → `DEFAULTS.ramMb`; valid siblings preserved.

### useMotionConfig resolution table

| user override | OS prefers-reduced-motion | → reduced | durations          | spring                    |
| ------------- | ------------------------- | --------- | ------------------ | ------------------------- |
| 'system'      | off                       | false     | 0.12 / 0.20 / 0.32 | SPRING_STANDARD           |
| 'system'      | on                        | true      | 0 / 0 / 0          | { duration: 0 }           |
| 'on'          | off                       | true      | 0 / 0 / 0          | { duration: 0 }           |
| 'on'          | on                        | true      | 0 / 0 / 0          | { duration: 0 }           |
| 'off'         | off                       | false     | 0.12 / 0.20 / 0.32 | SPRING_STANDARD           |
| 'off'         | on                        | false     | 0.12 / 0.20 / 0.32 | SPRING_STANDARD           |

User override always wins over OS; 'system' defers to OS. This matches UI-03 (user can forcibly disable motion regardless of OS setting).

### presets.ts D-13 → RESEARCH substitution note

Plan CONTEXT §D-13 listed illustrative preset values including **Red / Yellow / Gray**. RESEARCH retuned these to **Crimson (#f87171) / Amber (#fbbf24) / Slate (#cbd5e1)** for WCAG 2.1 SC 1.4.11 Non-text Contrast ≥3:1 against the `#111111` dark background. All 8 hexes were contrast-verified by RESEARCH.

D-13's closing clause — "Exact preset hexes are research/planner discretion" — authorises this substitution. `theme/presets.ts` carries a leading JSDoc comment documenting the substitution so Plan 04-07's `docs/DESIGN-SYSTEM.md §Colors` footnote can forward-reference it.

## Task Commits

Each task committed atomically with `--no-verify` (Wave 1 parallel-mode convention):

1. **Task 1: Expand global.css + theme/presets.ts + theme/motion.ts** — `19a264f` (feat)
2. **Task 2: Settings schema v1 → v2 migration + IPC surface** — `48e8cff` (feat)
3. **Task 3: Renderer store theme slice + useMotionConfig hook** — `479b3d9` (feat)

## Files Created/Modified

See frontmatter `key-files` for the full authoritative list.

## Decisions Made

See frontmatter `key-decisions` for the full list. Summary:

- **D-13 preset substitution:** illustrative Red/Yellow/Gray → WCAG-verified Crimson/Amber/Slate, documented inline so 04-07 can forward-reference.
- **writeSettings signature:** full-object → `Partial<SettingsPatch>`. Main owns merge+validate; IPC collapses to one call; renderer sends narrow patches.
- **`--color-wiiwho-accent` removed from global.css** but still referenced in `button.tsx` — legacy-consumer cleanup deferred to Plan 04-07 per plan text. Button accent styling is a temporary no-op.
- **setAccent applies :root before awaiting IPC** — instant UI feedback; persisted authority wins on next launch.
- **Read-time in-memory migration** — readSettings does NOT proactively rewrite v1 on-disk files; next writeSettings persists v2 atomically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regex `\s+` does not match across ` * ` JSDoc line continuation**

- **Found during:** Task 1 (running motion.test.ts)
- **Issue:** The plan-provided test regex `/RESEARCH retuned to\s+Crimson\/Amber\/Slate/i` expects the substitution rationale to appear with whitespace between "to" and "Crimson". In the written presets.ts JSDoc, the phrase spans two lines via `" * "` continuation markers, so `\s+` fails to match the `*` characters in between.
- **Fix:** Broadened the regex to `[\s*]+` (whitespace OR asterisk) — semantically equivalent assertion that tolerates JSDoc continuation.
- **Files modified:** `launcher/src/renderer/src/test/motion.test.ts`
- **Plan acceptance criterion impact:** none (the criterion asserted the two tokens are present, which they are — just with JSDoc line wrapping).

**2. [Rule 3 - Blocking] Legacy v1 tests broke on schema bump**

- **Found during:** Task 2 (running the existing settings store/IPC test suites after v2 migration)
- **Issue:** `store.test.ts` (Plan 03-02 baseline) and `ipc/settings.test.ts` (same) asserted `{ version: 1, ramMb, firstRunSeen }` shape from `readSettings()` / `settings.set` response. Post-v2 migration they received `{ version: 2, ..., theme: {...} }` and failed equality checks.
- **Fix:** Updated the affected assertions to the v2 shape. Removed now-invalid `version: 1` field from `writeSettings` calls that passed full objects (because `writeSettings` now takes `Partial<SettingsPatch>` and `version` isn't a valid patch field).
- **Files modified:** `launcher/src/main/settings/store.test.ts`, `launcher/src/main/ipc/settings.test.ts`
- **Rationale:** This is the direct knock-on effect of the plan's required v1→v2 schema bump. Leaving the legacy assertions in place would leave the suite red; auto-updating them preserves the invariant (clamping + round-trip + defaults) while reflecting the new shape.

**3. [Rule 3 - Blocking] Renderer setState seeds broke on v2 store shape**

- **Found during:** Task 3 (running full test suite after the renderer store migration)
- **Issue:** Four renderer test files (`stores/settings.test.ts`, `components/__tests__/{App,RamSlider,SettingsDrawer}.test.tsx`) called `useSettingsStore.setState({ version: 1, ramMb, firstRunSeen, hydrated })`. The new store shape requires `{ version: 2, ..., theme: {...}, modalOpen, openPane }`.
- **Fix:** Updated every `resetStore` / `useSettingsStore.setState` call to include the v2 theme slice and modal state. Used `as never` casts where `setState` partial-typing interacts with the broadened shape.
- **Files modified:** `launcher/src/renderer/src/stores/__tests__/settings.test.ts`, `components/__tests__/App.test.tsx`, `components/__tests__/RamSlider.test.tsx`, `components/__tests__/SettingsDrawer.test.tsx`
- **Rationale:** Same knock-on effect as #2 — direct consequence of the required store schema bump.

**4. [Rule 2 - Auto-add] Documented `setModalOpen(false) closes modal without changing pane`**

- **Found during:** Task 3 (writing settings.theme.test.ts)
- **Issue:** Plan specified the `setModalOpen` action but did not assert its correctness. Given it's a separate action from `setOpenPane`, it is possible to regress into a shape that re-couples modalOpen to pane changes.
- **Fix:** Added one extra test case to `settings.theme.test.ts` pinning that `setModalOpen(false)` closes the modal WITHOUT touching `openPane`. Brings total theme-slice tests to 9 instead of the plan's 7.
- **Files modified:** `launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts`
- **Rationale:** Safeguards a contract that downstream plans (especially 04-03) will rely on — modal close should not fire a pane-change render.

### Plan acceptance-criterion drift (NOT fixed — intentional deferral per plan)

**1. `--color-wiiwho-accent` still present in `button.tsx`**

- **Plan said:** `grep "--color-wiiwho-accent" launcher/src/renderer/src/` should return 0 hits.
- **Reality:** 3 hits remain in `button.tsx` (focus ring + default variant + link variant).
- **Why not fixed here:** The plan explicitly states earlier in the `<behavior>` block: _"The old `--color-wiiwho-accent: #16e0ee` token is REMOVED (replaced by `--color-accent`) — legacy consumers fixed in Plan 04-07 integration"_. That's a direct deferral: the acceptance criterion is aspirational for post-04-07 state, not a Task-1 gate. Button.tsx's accent styling is a temporary runtime no-op (undefined background colour, neutral-950 text) which no test currently asserts.
- **Impact:** Plan 04-07's integration pass must grep for `--color-wiiwho-accent` and replace with `--color-accent` across `button.tsx` (and any other remaining consumers). This is already in 04-07's scope (per plan 04-01 behaviour statement).

## Issues Encountered

None beyond the three auto-fixed issues above, all of which are direct consequences of the plan's required schema migration and one test-regex escaping quirk.

## Next Plan Readiness

**Plan 04-02 (Sidebar + main area)** — unblocked:
- `@theme` now carries `--layout-sidebar-width`, `--layout-window-{width,height}`, `--color-wiiwho-{surface,border}` for layout
- `useMotionConfig` available for animation wiring
- `ACCENT_PRESETS` + `DEFAULT_ACCENT_HEX` available from theme/presets
- Sidebar test stub (04-00 Nyquist) still compiles as `it.todo`

**Plan 04-03 (Settings modal chrome)** — unblocked:
- `useSettingsStore.setOpenPane` / `setModalOpen` / `openPane` / `modalOpen` available
- All 5 `SettingsPane` values exported (`'general' | 'account' | 'appearance' | 'spotify' | 'about'`)
- `useMotionConfig.spring` for modal enter/exit

**Plan 04-04 (Appearance pane)** — unblocked:
- `ACCENT_PRESETS` 8-entry tuple ready for swatch rendering
- `setAccent(hex)` + `setReduceMotion(mode)` store actions ready
- Per-preset CSS var `--color-preset-{id}` available for swatch backgrounds without JS

**Plan 04-06 (Spotify renderer)** — partially unblocked (settings.theme not load-bearing)

**Plan 04-07 (Integration + docs)** — has a known TODO: strip `--color-wiiwho-accent` from `button.tsx` (legacy cleanup documented above).

## Self-Check: PASSED

**Files (verified present + non-empty):**
- [x] `launcher/src/renderer/src/theme/presets.ts` (ACCENT_PRESETS 8-tuple + DEFAULT_ACCENT_HEX)
- [x] `launcher/src/renderer/src/theme/motion.ts` (6 exports: DURATION_*, EASE_*, SPRING_STANDARD)
- [x] `launcher/src/renderer/src/hooks/useMotionConfig.ts` (default export `useMotionConfig`)
- [x] `launcher/src/renderer/src/hooks/useMotionConfig.test.ts` (6 tests green)
- [x] `launcher/src/renderer/src/global.css` rewritten (all 23 @theme tokens + :root + 2 @font-face)
- [x] `launcher/src/main/settings/store.ts` v2 shape (SettingsV2 + migrateV1ToV2 + validAccent + validReduceMotion)
- [x] `launcher/src/renderer/src/stores/settings.ts` v2 shape (setAccent + setReduceMotion + setModalOpen + setOpenPane)

**Commits (verified in git log):**
- [x] `19a264f` — feat(04-01): expand @theme token catalog + theme/{presets,motion}.ts mirrors
- [x] `48e8cff` — feat(04-01): migrate settings schema v1 → v2 with theme slice
- [x] `479b3d9` — feat(04-01): renderer settings theme slice + useMotionConfig hook

**Test suite:** full launcher suite post-Task-3: **412 passed + 9 todo + 0 failed** (50 test files, +47 assertions vs the 04-00 baseline of 365 passed).

**Typecheck:** `pnpm typecheck` (both node and web projects) exits 0.

---
*Phase: 04-launcher-ui-polish*
*Completed: 2026-04-24*
