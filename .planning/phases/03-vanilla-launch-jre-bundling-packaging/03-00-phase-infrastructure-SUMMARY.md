---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 00
subsystem: infra
tags: [electron, shadcn, radix-ui, xmcl, execa, p-queue, minecraft-manifest, fixtures, gitignore]

# Dependency graph
requires:
  - phase: 02-microsoft-authentication
    provides: "shadcn manual-inline pattern, radix-ui unified package, vitest + RTL patterns"
  - phase: 01-foundations
    provides: "launcher/ scaffold, package.json, pnpm workspace, tsconfig split (node + web)"
provides:
  - "@xmcl/core + @xmcl/installer + execa + p-queue as launcher dependencies"
  - "shadcn Sheet (Radix Dialog wrapper — side-panel drawer) in components/ui/sheet.tsx"
  - "shadcn Slider (Radix Slider wrapper — RAM slider primitive) in components/ui/slider.tsx"
  - "shadcn Tooltip + TooltipProvider (Radix Tooltip — G1GC info hover) in components/ui/tooltip.tsx"
  - "1.8.9 client.json fixture with bad-SHA1 library for SC5 re-download tests"
  - "1.8.9 boot log fixture containing Sound engine started sentinel (exactly once)"
  - "Fake crash report fixture with all 6 D-20 redaction targets inline"
  - ".gitignore entries blocking launcher/resources/jre/ and launcher/resources/mod/ from ever committing"
affects: [03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-11, 03-12]

# Tech tracking
tech-stack:
  added:
    - "@xmcl/core ^2.15.1"
    - "@xmcl/installer ^6.1.2"
    - "execa ^9.6.1"
    - "p-queue ^9.1.2"
  patterns:
    - "Wave-0 infrastructure plan: four new deps + three UI primitives + three fixtures land atomically before any behavior plans, so Wave 2 plans are 100% about behavior"
    - "Shadcn manual-inline from new-york-v4 registry JSON (Phase 2 02-00 idiom) — pnpm workspace hoist-pattern breaks shadcn@latest add CLI"
    - "Co-located __fixtures__/ directory adjacent to the module that consumes them (launch/__fixtures__ for manifest tests, monitor/__fixtures__ for log-parser + crash-viewer tests)"
    - "Gitignore resource subdirs at the repo-root .gitignore (not launcher/.gitignore) so the rule is visible to every tree walker + any future script in launcher/scripts/"

key-files:
  created:
    - "launcher/src/renderer/src/components/ui/sheet.tsx"
    - "launcher/src/renderer/src/components/ui/slider.tsx"
    - "launcher/src/renderer/src/components/ui/tooltip.tsx"
    - "launcher/src/main/launch/__fixtures__/1.8.9-manifest.json"
    - "launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt"
    - "launcher/src/main/monitor/__fixtures__/fake-crash-report.txt"
  modified:
    - "launcher/package.json"
    - "pnpm-lock.yaml"
    - ".gitignore"

key-decisions:
  - "p-queue resolved to 9.1.2 — plan specified ^8.x but current stable is 9.x; semver-compatible API (add/concurrency/onIdle/onEmpty unchanged 8→9)"
  - "Shadcn primitives use the unified radix-ui import convention verbatim from the registry JSON — zero import-path rewrites needed because the registry itself already ships `import { Dialog as SheetPrimitive } from \"radix-ui\"` and matches existing dialog.tsx/dropdown-menu.tsx idiom"
  - "Gitignore rules added at repo-root .gitignore (not launcher/.gitignore) because (a) the repo-root file is the canonical rules file and (b) the existing launcher/.gitignore is node_modules/dist-only and we don't want the two competing"
  - "Fixture bad-SHA1 library uses name fixture.bad:bad-sha1:1.0 + all-zero SHA1 — explicit _comment field flags its test purpose so no future code mistakes it for a real Mojang library"

patterns-established:
  - "Wave-1 parallel-execution: this plan (03-00) and 03-01 committed concurrently to master on disjoint files. Both commits interleave cleanly in git log"
  - "All three shadcn primitive files follow the same structure: \"use client\" directive + React.ComponentProps generic typing + cn() className merge + Radix Primitive re-export with data-slot labels"
  - "Fixture JSON uses top-level _comment field to annotate test-purpose fields (bad-SHA1 library) — not parsed by any consumer, purely for human maintainers"

requirements-completed:
  - LCH-01
  - LCH-02
  - LCH-03
  - LCH-05
  - LCH-07
  - LAUN-03
  - LAUN-05
  - COMP-05

# Metrics
duration: 6 min
completed: 2026-04-21
---

# Phase 3 Plan 00: Phase Infrastructure Summary

**Four Phase 3 runtime deps (@xmcl/core 2.15.1, @xmcl/installer 6.1.2, execa 9.6.1, p-queue 9.1.2) + three shadcn primitives (Sheet/Slider/Tooltip using unified radix-ui) + three test fixtures (1.8.9 client.json with bad-SHA1 library, boot log with Sound-engine-started sentinel, crash report with all 6 D-20 redaction targets) + two gitignore entries blocking launcher/resources/jre/ and launcher/resources/mod/.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-21T08:53:21Z
- **Completed:** 2026-04-21T08:59:26Z
- **Tasks:** 3
- **Files modified:** 9 (3 created UI primitives, 3 created fixtures, 1 modified .gitignore, 1 modified package.json, 1 modified pnpm-lock.yaml)

## Accomplishments
- Installed four new launcher dependencies with versions verified against npm registry BEFORE install (not trusting plan's expected versions when they differ from current stable).
- Added the three shadcn primitives that every downstream Wave 2 plan (03-07 SettingsDrawer, 03-08 CrashViewer) imports — so those plans never have to stop to fetch registry JSONs.
- Laid down all three Phase 3 test fixtures up-front: 1.8.9 client.json (verified `mainClass` = `net.minecraft.client.main.Main`, NOT `LaunchWrapper`; verified client.jar SHA1 `3870888a...`); boot log with `Sound engine started` appearing exactly once (grep -c confirms); crash report with all six D-20 redaction targets (accessToken JWT, Windows + macOS user paths, Windows + Unix env vars).
- Gitignored the two runtime-fetched resource subdirs so ~140MB of JRE tarball extracts can never accidentally commit — and confirmed the `launcher/resources/icon.png` asset is still tracked (directory-specific ignores don't sweep it).

## Task Commits

Each task was committed atomically with `--no-verify` (Wave-1 parallel execution; orchestrator validates hooks once after all agents):

1. **Task 1: Install Phase 3 runtime dependencies** — `d0af139` (chore)
2. **Task 2: Add shadcn Sheet, Slider, Tooltip primitives** — `b218189` (feat)
3. **Task 3: Create fixtures and gitignore resource dirs** — `5d01dab` (chore)

## Files Created/Modified

**Created**
- `launcher/src/renderer/src/components/ui/sheet.tsx` — Radix Dialog-based drawer primitive (8 exports: Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription). Side-aware: `side="right"` is the Phase 3 D-01 Settings drawer target.
- `launcher/src/renderer/src/components/ui/slider.tsx` — Radix Slider wrapper with dynamic thumb count (RAM slider in Plan 03-07 passes a single value; composite API supports future multi-thumb ranges).
- `launcher/src/renderer/src/components/ui/tooltip.tsx` — Radix Tooltip + TooltipProvider + TooltipTrigger + TooltipContent + Arrow. App root must wrap in TooltipProvider (registered pattern for Plan 03-07 G1GC info hover per D-05).
- `launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` — 2.5KB trimmed client.json. Includes: vanilla mainClass, real 1.8.9 client.jar SHA1 `3870888a...`, real 1.8 asset index, jre-legacy javaVersion, 3 libraries (one with natives classifiers + extract rules, one plain artifact, one with deliberate all-zero SHA1 flagged via `_comment` as SC5 re-download test fodder).
- `launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt` — 874 bytes. 13 log lines mirroring a real 1.8.9 boot (FML tweak class, LWJGL version, OpenAL init, Sound engine started, shutdown). `grep -c "Sound engine started"` returns exactly 1 — the sentinel fires ONCE, as required by Plan 03-06 main-menu detection.
- `launcher/src/main/monitor/__fixtures__/fake-crash-report.txt` — 975 bytes. Contains a plausible NullPointerException stack from `Minecraft.runTick` PLUS a System Details block with all six D-20 targets inline: `--accessToken ey.fakeTokenBody123.secretsig`, `C:\Users\Alice\...`, `/Users/bob/...`, `%USERNAME%`, `$USER`, `$HOME`.

**Modified**
- `launcher/package.json` — 4 deps added to `dependencies`. Alphabetized and semver-caret-pinned per existing convention.
- `pnpm-lock.yaml` — regenerated. Phase 2 dep tree undisturbed; only the 4 new packages + their transitive closure touched.
- `.gitignore` — appended 2 entries (with comment headers documenting WHY each dir is ignored + which plan owns populating it).

## Decisions Made
- **p-queue 9.1.2 installed over plan-specified ^8.x** — the `expected-version` in the plan was documented as "approximate, verify first"; current stable is 9.x with a semver-compatible API surface for our use (`add()`, `concurrency` constructor option, `onIdle()`, `onEmpty()` all identical 8→9). Plan 03-03/03-04 won't notice.
- **Shadcn registry imports landed verbatim** — the registry JSONs ALREADY import from the unified `radix-ui` package (not `@radix-ui/react-*`), matching the existing dialog.tsx / dropdown-menu.tsx convention. No import-path rewrites needed. Grep for `@radix-ui/react-` in `launcher/src/renderer/src/components/ui/` returns zero matches.
- **Gitignore applied at repo-root** — the `launcher/.gitignore` is a minimal node_modules/dist-only overlay and wasn't the right home for repo-level build-artifact rules; the repo-root `.gitignore` already contains the `.planning/scripts/` + `.env` rules that match this scope.
- **Fixture library uses `_comment` prefix** — Mojang's real client.json never has a `_comment` key, so any manifest-parser that encounters this fixture in tests can safely ignore the comment; a future human reader immediately sees the intent without git blame.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm install required before `pnpm add` to realign modules directory**
- **Found during:** Task 1 (Install Phase 3 runtime dependencies)
- **Issue:** Initial `pnpm add @xmcl/core @xmcl/installer execa p-queue` aborted with `ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF` — the local `node_modules` was created with a different hoist-pattern than the current `.npmrc` specifies. This blocked the install outright.
- **Fix:** Ran `pnpm install --config.confirm-modules-purge=false` first to rebuild `node_modules` under the correct hoist-pattern, then re-ran `pnpm add` for the 4 target deps. No version drift in any existing Phase 1/2 dependency.
- **Files modified:** `launcher/package.json`, `pnpm-lock.yaml` (no source code touched)
- **Verification:** Fresh `node_modules` successfully realized; all 4 new packages resolved + postinstall `electron-builder install-app-deps` succeeded.
- **Committed in:** `d0af139` (documented in the commit body)

**2. [Rule 1 - Bug] p-queue version drift relative to plan expected value**
- **Found during:** Task 1 pre-install version verification (`npm view p-queue version`)
- **Issue:** Plan specified `^8.x`; current stable is 9.1.2. Installing 8.x would have been semver-downgrade relative to the npm registry's current-stable pointer.
- **Fix:** Installed 9.1.2. API used by Plan 03-03/03-04 (concurrency ceiling for parallel library downloads) is unchanged 8→9. Documented in commit body.
- **Files modified:** `launcher/package.json`
- **Verification:** `pnpm install` clean; renderer typecheck passes; no downstream plan references a removed-in-9.x API.
- **Committed in:** `d0af139`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug).
**Impact on plan:** Both auto-fixes necessary for successful install. Neither widened scope nor touched behavior — purely infrastructure. Plan goals met exactly as written.

## Issues Encountered

### Cross-wave parallel execution observation (NOT a blocker, documented for orchestrator)

Plan 03-00 runs in Wave 1 alongside Plan 03-01. The parallel agent 03-01 creates `launcher/src/main/paths.ts` + `launcher/src/main/paths.test.ts`. When Task 1 verified `npm run typecheck`, the node-side typecheck (`typecheck:node`) reports 11 errors from `paths.test.ts` importing `./paths` — these errors belong to 03-01's RED phase (TDD failing tests before its GREEN commit). By the end of this plan's execution, 03-01 had shipped both commits (`d2ce338 feat(03-01): add paths.ts`, `f885bd5 test(03-01)`, `2a024d2 feat(03-01): extend redact.ts`), so typecheck:web (renderer-only) passes clean at plan-completion time.

Scope-boundary compliance: I did NOT fix `paths.test.ts` errors since they originate from a different plan's files. Renderer typecheck (`npm run typecheck:web`) — the relevant surface for my Task 2 UI primitives — passes exit 0 cleanly. The 139 pre-existing Phase 1+2 tests continue to pass; 03-01's paths.test.ts will pass after 03-01 completes its GREEN commit.

## Authentication Gates

None — this plan is pure infrastructure: dep install, file creation, gitignore rule. No external service interaction.

## Known Stubs

None — every file in this plan is either a runtime dep (complete package), a fully-functional UI primitive (imported by zero callers yet but complete on its own), or a hand-authored data fixture (nothing to wire).

## User Setup Required

None — no external service configuration, no credentials, no env vars.

## Next Phase Readiness

**Ready for Wave 2 (Plans 03-02 through 03-12):**
- Plans 03-03 / 03-04 can import `@xmcl/core` + `@xmcl/installer` immediately — no version negotiation.
- Plan 03-05 can import `execa` for JVM spawn — cancelSignal support confirmed present.
- Plan 03-03 can import `p-queue` for parallel library downloads — 8-concurrency ceiling unchanged.
- Plan 03-07 (SettingsDrawer + RamSlider) can import `Sheet`, `Slider`, `Tooltip` from `@/components/ui/*` with zero prep.
- Plan 03-03 + 03-04 tests can `import manifest from "./__fixtures__/1.8.9-manifest.json"` with the bad-SHA1 library already in place for SC5 assertions.
- Plan 03-06 (log parser + crash watch) can load both monitor fixtures via `readFileSync` and assert against verbatim content.
- Plan 03-11 + 03-12 (packaging) can write to `launcher/resources/jre/` and `launcher/resources/mod/` knowing git will ignore the bytes.

No blockers. No concerns.

## Self-Check: PASSED

All claimed artifacts verified on disk:
- `[ -f launcher/package.json ]` → FOUND with `"@xmcl/core"`, `"@xmcl/installer"`, `"execa"`, `"p-queue"` entries
- `[ -f launcher/src/renderer/src/components/ui/sheet.tsx ]` → FOUND (8 exports; radix-ui unified import)
- `[ -f launcher/src/renderer/src/components/ui/slider.tsx ]` → FOUND (Slider export; radix-ui unified import)
- `[ -f launcher/src/renderer/src/components/ui/tooltip.tsx ]` → FOUND (4 exports; radix-ui unified import)
- `[ -f launcher/src/main/launch/__fixtures__/1.8.9-manifest.json ]` → FOUND (contains vanilla mainClass, real client SHA1, bad-SHA1 fixture library)
- `[ -f launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt ]` → FOUND (`grep -c "Sound engine started"` = 1)
- `[ -f launcher/src/main/monitor/__fixtures__/fake-crash-report.txt ]` → FOUND (all 6 D-20 targets present)
- `.gitignore` contains `launcher/resources/jre/` and `launcher/resources/mod/` → CONFIRMED
- `git ls-files launcher/resources/icon.png` → CONFIRMED still tracked

Commits verified in log:
- `d0af139 chore(03-00): install Phase 3 runtime deps` → FOUND
- `b218189 feat(03-00): add shadcn Sheet, Slider, Tooltip primitives` → FOUND
- `5d01dab chore(03-00): add 1.8.9 fixtures + gitignore JRE/mod resource dirs` → FOUND

---

*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Completed: 2026-04-21*
