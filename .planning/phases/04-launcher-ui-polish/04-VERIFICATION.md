---
phase: 04-launcher-ui-polish
verified: 2026-04-24T05:40:00Z
status: passed
score: 5/5 must-haves verified (amended scope — UI-06 intentionally dropped 2026-04-24, not counted as gap)
scope_note: |
  Phase 4 was amended mid-UAT on 2026-04-24: UI-06 (Spotify mini-player) was dropped
  from v0.1 after being implemented, integrated, and smoke-tested. Source fully deleted
  in commits 8ff0272 (launcher src) + 1d69342 (DESIGN-SYSTEM doc). Historical plans
  04-05 and 04-06 retained as archival artifacts. This verification runs against the
  amended 5-requirement scope: UI-01, UI-03, UI-04, UI-05, UI-07.
requirements_accounted:
  - id: UI-01
    status: SATISFIED
    source_plans: ["04-00", "04-01", "04-04"]
  - id: UI-03
    status: SATISFIED
    source_plans: ["04-00", "04-01", "04-02", "04-03", "04-04"]
  - id: UI-04
    status: SATISFIED
    source_plans: ["04-02", "04-03"]
  - id: UI-05
    status: SATISFIED
    source_plans: ["04-02", "04-03", "04-07"]
  - id: UI-06
    status: INTENTIONALLY_DROPPED
    source_plans: ["04-00", "04-05", "04-06", "04-07"]
    note: |
      Implemented and integrated during Phase 4 execution; dropped from v0.1 during
      final smoke UAT by owner decision. Source fully removed in commits 8ff0272 +
      1d69342. Preload bridge restored to 5-key D-11 invariant. This is NOT a gap —
      it is a documented scope reduction reflected in REQUIREMENTS.md ([~]) and
      ROADMAP.md.
  - id: UI-07
    status: SATISFIED
    source_plans: ["04-01", "04-07"]
human_verification:
  - test: "Owner UAT sign-off on Reviewer table rows in docs/DESIGN-SYSTEM.md §Exclusion checklist"
    expected: "Each row in the reviewer sign-off table (Login screen, Play section, Cosmetics, Sidebar, Settings modal panes, Crash viewer, Loading screen) signed off with date + verdict"
    why_human: "Visual compliance check — a human must walk each screen and verify absence of ads/news/social content. Currently all rows show — (not yet reviewed)."
  - test: "Smoke test the motion system feel (UI-03) — Settings modal slide-up ~320ms, sidebar pill glide ~200ms, button hovers 120ms"
    expected: "Animations feel smooth and consistent; no janky snap or excessive delay; reduced-motion toggle instantly collapses all transitions"
    why_human: "Perceptual quality — code asserts durations exist, but only human eyes can tell if it feels right"
  - test: "Accent color swap affects all intended surfaces (UI-01) — cycle 8 presets + custom hex"
    expected: "Play button bg, focus rings (Tab through), active sidebar pill, modal sub-nav pill ALL use the new accent; body text / headings do NOT; setting persists across restart"
    why_human: "Cross-surface visual correctness can't be fully verified via unit tests"
---

# Phase 4: Launcher UI Polish — Verification Report

**Phase Goal:** Transform the functional v0.1 launcher into a polished, themeable, animated experience with sidebar navigation, settings modal, and documented design system — minus the social/marketing bloat.

**Verified:** 2026-04-24
**Status:** passed (amended 5-requirement scope)
**Re-verification:** No — initial verification
**Scope amendment:** UI-06 (Spotify) was dropped from v0.1 on 2026-04-24 mid-UAT. Verified against the amended 5-requirement scope.

## Goal Achievement

### Observable Truths (against amended Success Criteria)

| #   | Truth (from ROADMAP.md SC)                                                                                                                                                                           | Status     | Evidence                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | User picks an accent color from ≥3 presets or enters custom hex; choice applies across launcher and persists across restarts                                                                         | ✓ VERIFIED | `ThemePicker.tsx` renders 8 presets + hex input + EyeDropper; `settings.ts` store has `setAccent` wired to `window.wiiwho.settings.set`; v2 schema persists |
| 2   | View transitions, modal open/close, button hovers, and loading states use consistent motion (documented timing + durations); no janky or instant state-swap for primary interactions                  | ✓ VERIFIED | `global.css` exports duration-fast/med/slow + ease-emphasized/standard tokens; `motion.ts` mirrors; `useMotionConfig` resolves OS + user override; `SettingsModal` uses forceMount + AnimatePresence; `Sidebar` uses layoutId pill glide |
| 3   | Main launcher surface uses sidebar navigation (Play, Settings, Account, Cosmetics); primary CTA is Play; no ads/news/friends/concurrent-user counts/marketing content — verified against exclusion checklist | ✓ VERIFIED | `Sidebar.tsx` renders 220px column with Play/Cosmetics rows + Settings gear at bottom; `Play.tsx` is primary CTA; `AccountBadge` deep-links via dropdown; `antiBloat.test.tsx` enforces absence of banned strings |
| 4   | ~~Spotify OAuth → mini-player → graceful offline~~ **(DROPPED 2026-04-24)**                                                                                                                          | N/A        | Intentionally out of scope — NOT a gap. Source fully removed; see scope amendment note above.                                                              |
| 5   | Design system documented in code (tokens) + `docs/DESIGN-SYSTEM.md` with rationale and usage examples                                                                                                | ✓ VERIFIED | `DESIGN-SYSTEM.md` 204 lines with all 8 D-36 sections; `theme/presets.ts` + `theme/motion.ts` mirror CSS tokens; `scripts/check-docs.mjs` validates 27 assertions, exits 0 |

**Score:** 4/4 in-scope truths verified (SC 4 is formally dropped, not counted as gap).

### Required Artifacts

| Artifact                                                                 | Expected                                  | Status     | Details                                                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `launcher/src/renderer/src/App.tsx`                                      | Integrated shell; no Spotify init         | ✓ VERIFIED | 190 lines; imports Sidebar, MainArea/Play, MainArea/Cosmetics, SettingsModal, DeviceCodeModal, AccountBadge, CrashViewer; no Spotify reference |
| `launcher/src/renderer/src/components/Sidebar.tsx`                       | 220px column + Play/Cosmetics + gear      | ✓ VERIFIED | 121 lines; renders nav with layoutId pill glide; Settings gear at bottom calls setModalOpen(true)                      |
| `launcher/src/renderer/src/components/MainArea/Play.tsx`                 | Primary CTA section                       | ✓ VERIFIED | Gradient stub using `--color-accent` + `<PlayButton />` + wordmark + version                                          |
| `launcher/src/renderer/src/components/MainArea/Cosmetics.tsx`            | "Coming soon" empty state                 | ✓ VERIFIED | Renders cape SVG + "Cosmetics coming soon" headline + subtext; ZERO interactive elements                               |
| `launcher/src/renderer/src/components/SettingsModal.tsx`                 | Bottom-slide modal, 4 panes (no Spotify)  | ✓ VERIFIED | Radix Dialog + motion/react forceMount; General/Account/Appearance/About panes — Spotify pane removed                 |
| `launcher/src/renderer/src/components/ThemePicker.tsx`                   | 8 presets + hex + EyeDropper              | ✓ VERIFIED | 122 lines; iterates ACCENT_PRESETS; feature-probes `window.EyeDropper`; calls `setAccent`                              |
| `launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx`  | ThemePicker + reduce-motion select        | ✓ VERIFIED | Renders ThemePicker + 3-option select (system/on/off) wired to `setReduceMotion`                                       |
| `launcher/src/renderer/src/theme/motion.ts`                              | Duration + easing + spring constants      | ✓ VERIFIED | Exports DURATION_FAST/MED/SLOW, EASE_EMPHASIZED/STANDARD, SPRING_STANDARD; comments document CSS mirror                |
| `launcher/src/renderer/src/theme/presets.ts`                             | 8 typed accent preset tuple               | ✓ VERIFIED | Exports ACCENT_PRESETS + AccentPreset + DEFAULT_ACCENT_HEX; D-13→RESEARCH substitution documented                     |
| `launcher/src/renderer/src/hooks/useMotionConfig.ts`                     | OS + user override resolver               | ✓ VERIFIED | Combines useReducedMotion + store override; returns 0-duration config when reduced                                    |
| `launcher/src/renderer/src/global.css`                                   | CSS tokens for motion + color             | ✓ VERIFIED | Exports --color-accent (line 10 + 44), --duration-fast/med/slow, --ease-emphasized/standard (lines 27-31)              |
| `launcher/src/renderer/src/stores/settings.ts`                           | Zustand store with theme slice + setAccent | ✓ VERIFIED | 246 lines; v2 schema with theme.accent + theme.reduceMotion; setAccent writes `:root` CSS var + IPC persists           |
| `launcher/src/main/settings/store.ts`                                    | v1→v2 migration                           | ✓ VERIFIED | SettingsV2 interface with ThemeSlice; DEFAULTS includes theme; clampRam preserved                                      |
| `launcher/src/renderer/src/components/AccountBadge.tsx`                  | Deep-link to Settings → Account pane      | ✓ VERIFIED | Line 92: `onClick={() => setOpenPane('account')}` — atomic open pane + modal                                           |
| `launcher/src/renderer/src/test/antiBloat.test.tsx`                      | Repo-wide grep enforcing UI-05            | ✓ VERIFIED | 128 lines; walks launcher/src/renderer/src; scans 11 banned patterns; ALLOWLIST empty; asserts ≥30 files scanned       |
| `docs/DESIGN-SYSTEM.md`                                                  | UI-07 design system doc with D-36 sections | ✓ VERIFIED | 204 lines; 8 top-level sections (Philosophy, Tokens, Usage examples, Iconography, Typography provenance, Hero art provenance, Exclusion checklist, Changelog); no Spotify section |
| `scripts/check-docs.mjs`                                                 | DESIGN-SYSTEM validator (27 assertions)   | ✓ VERIFIED | Runs green: `OK: 4 docs pass 27 content assertions`                                                                    |
| `launcher/src/preload/index.ts`                                          | 5-key D-11 invariant (no spotify key)     | ✓ VERIFIED | 73 lines; exposes auth/game/settings/logs/__debug only; no 6th `spotify` key                                           |
| `launcher/src/main/index.ts`                                             | Bootstrap without Spotify handlers        | ✓ VERIFIED | 92 lines; registers auth/game/settings/logs/security handlers only; no registerSpotifyHandlers                         |
| `launcher/src/main/spotify/`                                             | Should NOT exist (scope reduction)        | ✓ VERIFIED | Directory confirmed absent via `ls` → "No such file or directory"                                                      |

### Key Link Verification

| From                                       | To                                               | Via                                          | Status    | Details                                                                                            |
| ------------------------------------------ | ------------------------------------------------ | -------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| `App.tsx`                                  | `Sidebar + SettingsModal + Play + Cosmetics + DeviceCodeModal` | Conditional render based on authState + activeSection | ✓ WIRED | Lines 156-185: all 5 components rendered in logged-in tree; `AnimatePresence mode="wait"` swaps Play/Cosmetics |
| `App.tsx`                                  | `useMotionConfig` via `DURATION_MED + EASE_STANDARD` | Imported from theme/motion.ts                | ✓ WIRED   | Line 48 import; line 167-174 used in motion.div transition prop                                    |
| `Sidebar.tsx`                              | `useActiveSectionStore`                          | setSection call on row click                 | ✓ WIRED   | Line 61: `onClick={() => setSection(item.id)}`; active section drives pill glide                   |
| `Sidebar.tsx`                              | `useSettingsStore.setModalOpen`                  | Settings gear click                          | ✓ WIRED   | Line 110: `onClick={() => setModalOpen(true)}`                                                      |
| `ThemePicker.tsx`                          | `useSettingsStore.setAccent`                     | preset click + valid hex input + EyeDropper  | ✓ WIRED   | Lines 42-43, 52-53, 75: setAccent called from all three paths                                      |
| `AppearancePane.tsx`                       | `useSettingsStore.setReduceMotion`               | select onChange                              | ✓ WIRED   | Line 40-42: select onChange calls setReduceMotion                                                  |
| `AccountBadge.tsx`                         | `useSettingsStore.setOpenPane`                   | "Account settings" dropdown item             | ✓ WIRED   | Line 92: onClick={() => setOpenPane('account')}                                                    |
| `settings.ts` (store)                      | `window.wiiwho.settings.set` (IPC)               | setAccent persists theme.accent              | ✓ WIRED   | Line 217: `window.wiiwho.settings.set({ theme: { accent: hex } })` + response parsed               |
| `main/settings/store.ts`                   | settings.json v2 on disk                         | SettingsV2 interface + DEFAULTS              | ✓ WIRED   | Line 43-51: SettingsV2 shape exported; v1→v2 migration documented                                  |
| `SettingsModal.tsx`                        | `AppearancePane` (and others)                    | openPane switch in JSX                       | ✓ WIRED   | Lines 86-89: conditional render for general/account/appearance/about                               |
| `docs/DESIGN-SYSTEM.md`                    | UI-05 exclusion checklist literal                | H2 heading + literal string                  | ✓ WIRED   | Line 154 heading `## 7. Exclusion checklist`; line 158 literal sentinel string                     |

### Data-Flow Trace (Level 4)

| Artifact                            | Data Variable              | Source                                           | Produces Real Data | Status     |
| ----------------------------------- | -------------------------- | ------------------------------------------------ | ------------------ | ---------- |
| `ThemePicker.tsx`                   | `accent`                   | `useSettingsStore((s) => s.theme.accent)`        | Yes — user click/hex/eyedropper → setAccent → IPC → disk | ✓ FLOWING |
| `AppearancePane.tsx`                | `reduceMotion`             | `useSettingsStore((s) => s.theme.reduceMotion)`  | Yes — select onChange → setReduceMotion → IPC → disk | ✓ FLOWING |
| `Sidebar.tsx`                       | `active`                   | `useActiveSectionStore((s) => s.section)`        | Yes — user click → setSection → store update → re-render | ✓ FLOWING |
| `SettingsModal.tsx`                 | `open`, `openPane`         | `useSettingsStore((s) => s.modalOpen/openPane)`  | Yes — gear click / AccountBadge deep-link → setModalOpen/setOpenPane → re-render | ✓ FLOWING |
| `App.tsx`                           | `activeSection`            | `useActiveSectionStore((s) => s.section)`        | Yes — drives AnimatePresence key for Play/Cosmetics swap | ✓ FLOWING |
| `Play.tsx`                          | N/A (static gradient stub) | CSS var `--color-accent` via inline style        | Yes — tracks live accent via color-mix() | ✓ FLOWING |
| `Cosmetics.tsx`                     | N/A (deliberately static)  | N/A                                              | N/A — intentional empty state | ✓ VERIFIED (by design) |

### Behavioral Spot-Checks

| Behavior                                              | Command                                            | Result                                                  | Status |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- | ------ |
| DESIGN-SYSTEM structure validates                     | `node scripts/check-docs.mjs`                      | `OK: 4 docs pass 27 content assertions` (exit 0)        | ✓ PASS |
| Launcher typecheck passes (node + web TS configs)     | `cd launcher && pnpm typecheck`                    | Exit 0, no errors                                       | ✓ PASS |
| Launcher test suite passes (incl. antiBloat grep)     | `cd launcher && pnpm test:run`                     | 53 test files, **470 passing**, 0 failing, 5.25s        | ✓ PASS |
| Spotify fully purged from launcher/src                 | `grep -rE "spotify" launcher/src/` (case-insensitive) | No matches found                                        | ✓ PASS |
| Preload D-11 invariant (5 keys)                        | Read launcher/src/preload/index.ts                 | Only auth/game/settings/logs/__debug exposed            | ✓ PASS |
| Scope-reduction commit trail exists                    | `git log --oneline -n 30`                          | `8ff0272` + `1d69342` + `863776b` + `d6e6000` all present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans                       | Description                                                                                  | Status                 | Evidence                                                                                                |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| UI-01       | 04-00, 04-01, 04-04                | Accent color presets + custom hex + persist                                                  | ✓ SATISFIED            | ThemePicker + presets.ts (8 entries) + settings v2 theme.accent + setAccent IPC wired                   |
| UI-03       | 04-00, 04-01, 04-02, 04-03, 04-04 | Consistent motion with documented timing                                                     | ✓ SATISFIED            | global.css tokens + motion.ts mirrors + useMotionConfig + SettingsModal forceMount + Sidebar pill glide |
| UI-04       | 04-02, 04-03                       | Sidebar nav with Play/Settings/Account/Cosmetics; Play primary CTA                           | ✓ SATISFIED            | Sidebar 220px with Play/Cosmetics + Settings gear; Play.tsx as primary CTA; AccountBadge deep-link      |
| UI-05       | 04-02, 04-03, 04-07                | No ads/news/concurrent-user/friends/marketing; verified against exclusion checklist          | ✓ SATISFIED            | antiBloat.test.tsx repo-wide grep + DESIGN-SYSTEM §Exclusion checklist + Cosmetics zero-interactive     |
| UI-06       | 04-00, 04-05, 04-06, 04-07        | ~~Spotify OAuth + mini-player~~                                                               | **INTENTIONALLY DROPPED** | REQUIREMENTS.md marks with `[~]`; source fully deleted in commits 8ff0272+1d69342; preload D-11 restored to 5 keys. Not a gap. |
| UI-07       | 04-01, 04-07                       | Design system documented in code + docs                                                      | ✓ SATISFIED            | docs/DESIGN-SYSTEM.md 204 lines with all 8 D-36 sections; theme/*.ts mirrors CSS; check-docs passes    |

**Orphaned requirement check:** None found. REQUIREMENTS.md Phase 4 requirement list matches the plan frontmatter `requirements:` fields union (UI-01, UI-03, UI-04, UI-05, UI-06, UI-07). UI-02 was dropped pre-phase (2026-04-23 per REQUIREMENTS.md footer) and is correctly absent.

### Anti-Patterns Found

None. Comprehensive scan results:

- No `TODO | FIXME | HACK | XXX | PLACEHOLDER` in Phase 4 source files beyond documentation references
- No empty render stubs in Phase 4 components (`Cosmetics.tsx` is a deliberate empty state — documented)
- No hardcoded empty data flowing to UI (all Zustand stores hydrate from real IPC or render from user input)
- No ad/news/social markup (verified by `antiBloat.test.tsx` passing)
- No Spotify residue (verified by case-insensitive grep returning no matches)

### Human Verification Required

The following items need owner attention but do not block "passed" status for the amended scope:

1. **Reviewer sign-off on docs/DESIGN-SYSTEM.md §Exclusion checklist table**

   Test: Walk each screen (Login, Play, Cosmetics, Sidebar, Settings/General/Account/Appearance/About, Crash viewer, Loading screen). For each, confirm absence of ads/news/social/marketing content per the exclusion enumeration.

   Expected: Each row in the Reviewer sign-off table filled in with date + name + verdict (currently all show `—`).

   Why human: Visual compliance — the anti-bloat grep catches string patterns, but perceptual marketing/engagement cues (hero art choice, copy tone, layout density) require human judgment.

2. **Motion feel sanity check (UI-03)**

   Test: `pnpm --filter ./launcher dev`; click Settings gear (expect ~320ms slide-up); close via X / ESC / backdrop (expect ~320ms slide-down); click Play↔Cosmetics rows (expect ~200ms section swap + sidebar pill glide).

   Expected: No janky snap, no instant state swap, smooth perceived motion; toggling Settings → Appearance → Reduce motion = On collapses all transitions to instant.

   Why human: Perceptual quality of motion can't be unit-tested beyond duration assertions.

3. **Accent color live-swap (UI-01)**

   Test: Settings → Appearance → cycle all 8 presets; enter `#ff00aa` custom hex; press Tab through UI to reveal focus rings.

   Expected: Play button bg, focus rings, active sidebar pill, active sub-nav pill ALL switch to new accent; body text / headings do NOT; setting persists across launcher restart.

   Why human: Cross-surface visual verification of theme mutation requires running the launcher.

### Gaps Summary

**No gaps blocking the amended Phase 4 goal.**

The single dropped requirement (UI-06 Spotify) was implemented, integrated, smoke-tested, and then deliberately retired by the owner mid-UAT on 2026-04-24. The removal is:

- Documented in `REQUIREMENTS.md` (marked `[~]` with dated note)
- Documented in `ROADMAP.md` (Phase 4 goal amended; SC4 struck through; UI-06 removed from requirement list)
- Documented in `04-07-integration-and-docs-SUMMARY.md` (Deviations → Full Spotify removal)
- Reflected in source: no Spotify files exist in `launcher/src`, preload bridge restored to 5-key D-11 invariant, `check-docs.mjs` 27 assertions all pass, 470/470 tests pass

This is categorized as **INTENTIONALLY_DROPPED**, not **BLOCKED** or **MISSING**. Per the user's explicit instruction ("do NOT flag them as gaps — they shipped code that was then retired"), no gap-closure plan is warranted.

All 5 in-scope requirements (UI-01, UI-03, UI-04, UI-05, UI-07) verify cleanly against amended Phase 4 scope. The phase is ready to hand off to Phase 5 (Forge Integration).

---

*Verified: 2026-04-24T05:40:00Z*
*Verifier: Claude (gsd-verifier, Opus 4.7 1M)*
