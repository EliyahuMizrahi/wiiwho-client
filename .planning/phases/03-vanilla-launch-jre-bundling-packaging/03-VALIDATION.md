---
phase: 3
slug: vanilla-launch-jre-bundling-packaging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from RESEARCH.md §Validation Architecture; planner fills Per-Task Verification Map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4 (dual env: jsdom for renderer, node for main/preload) |
| **Config file** | `launcher/vitest.config.ts` (exists — Phase 2 idiom, `environmentMatchGlobs`-based) |
| **Quick run command** | `pnpm --filter ./launcher test:run` |
| **Full suite command** | `pnpm --filter ./launcher test:run && pnpm --filter ./launcher typecheck && pnpm --filter ./launcher lint` |
| **Phase gate command** | Full suite + `pnpm --filter ./launcher run build:unpack` + manual PKG-01/PKG-02 smoke + manual LCH-05/LCH-06 real-launch |
| **Estimated runtime** | ~30 seconds (quick) / ~90 seconds (full) |

Test file convention: co-located `*.test.ts` / `*.test.tsx` sibling per module; `@vitest-environment jsdom` docblock for renderer tests; `afterEach(cleanup)` inside every renderer describe.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter ./launcher test:run`
- **After every plan wave:** Run full suite + `pnpm --filter ./launcher typecheck` + `pnpm --filter ./launcher lint` + `pnpm --filter ./launcher run build`
- **Before `/gsd:verify-work`:** Full suite green + `pnpm --filter ./launcher run build:unpack` green + manual PKG/LCH smoke tests
- **Max feedback latency:** 30 seconds for task-level; 90 seconds for wave-level

---

## Per-Task Verification Map

> Planner fills this table during PLAN.md creation. Each PLAN task must appear with its REQ-ID, test type, automated command, and Wave 0 status. Seed entries below come from RESEARCH.md §Validation Architecture and map each requirement to at least one test command.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | LCH-01 (manifest SHA1 + cache) | unit | `pnpm vitest run src/main/launch/manifest.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-01 (corrupted cache re-downloads — SC5) | integration | `pnpm vitest run src/main/launch/libraries.integration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-02 (library + asset pipeline) | integration | `pnpm vitest run src/main/launch/assets.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-03 (SHA1-valid cache is no-op) | unit | `pnpm vitest run src/main/launch/libraries.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-05 (JVM argv canonical vanilla 1.8.9) | unit | `pnpm vitest run src/main/launch/args.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-05 (sentinel detection → minimize) | integration | `pnpm vitest run src/main/monitor/logParser.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-05 (E2E dummy-java spawn → exited cleanly) | integration | `pnpm vitest run src/main/launch/e2e.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-06 (`--userType msa` + real MC token flow) | unit | `pnpm vitest run src/main/launch/args.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LCH-07 (stdout lines → `game:log` + last 30 retained) | unit | `pnpm vitest run src/main/monitor/logParser.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | JRE-01 (resolveJavaBinary win) | unit | `pnpm vitest run src/main/paths.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | JRE-02 (resolveJavaBinary darwin) | unit | `pnpm vitest run src/main/paths.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | JRE-03 (spawn asserts bundled JRE path) | unit | `pnpm vitest run src/main/launch/spawn.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PKG-01 (NSIS installer contains JRE + mod jar) | packaging smoke | `7z l launcher/dist/Wiiwho\ Client\ Setup.exe` + assert paths | — | ⬜ pending |
| TBD | TBD | TBD | PKG-02 (Universal DMG contains both JRE slots + mod jar) | packaging smoke | Mount DMG; `ls Wiiwho.app/Contents/Resources/{jre,mod}/` | — | ⬜ pending |
| TBD | TBD | TBD | LAUN-03 (RAM slider bounds + clamp) | unit (renderer) | `pnpm vitest run src/renderer/src/components/RamSlider.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LAUN-04 (settings persist round-trip) | unit | `pnpm vitest run src/main/settings/store.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LAUN-05 (crash-reports watch → viewer ready) | unit | `pnpm vitest run src/main/monitor/crashReport.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LAUN-05 (non-zero exit + crash-report → redacted render) | integration | `pnpm vitest run src/main/launch/crash.integration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | COMP-05 (scrub strips MC token + Win/mac username + `%USERNAME%` + `$USER`) | unit | `pnpm vitest run src/main/auth/redact.test.ts` | ✅ exists (extend) | ⬜ pending |
| TBD | TBD | TBD | COMP-05 (same sanitized string → display AND clipboard — D-21) | unit (renderer) | `pnpm vitest run src/renderer/src/components/CrashViewer.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New modules + sibling tests the planner MUST stub before downstream waves:

- [ ] `launcher/src/main/paths.ts` + `paths.test.ts`
- [ ] `launcher/src/main/launch/manifest.ts` + `manifest.test.ts`
- [ ] `launcher/src/main/launch/libraries.ts` + `libraries.test.ts` + `libraries.integration.test.ts`
- [ ] `launcher/src/main/launch/assets.ts` + `assets.test.ts`
- [ ] `launcher/src/main/launch/natives.ts` + `natives.test.ts`
- [ ] `launcher/src/main/launch/args.ts` + `args.test.ts`
- [ ] `launcher/src/main/launch/spawn.ts` + `spawn.test.ts`
- [ ] `launcher/src/main/launch/e2e.test.ts` (integration)
- [ ] `launcher/src/main/launch/crash.integration.test.ts` (integration)
- [ ] `launcher/src/main/monitor/logParser.ts` + `logParser.test.ts`
- [ ] `launcher/src/main/monitor/crashReport.ts` + `crashReport.test.ts`
- [ ] `launcher/src/main/settings/store.ts` + `store.test.ts`
- [ ] `launcher/src/main/ipc/logs.ts` + `logs.test.ts`
- [ ] `launcher/src/renderer/src/stores/game.ts` + `game.test.ts`
- [ ] `launcher/src/renderer/src/stores/settings.ts` + `settings.test.ts`
- [ ] `launcher/src/renderer/src/components/SettingsDrawer.tsx` + `SettingsDrawer.test.tsx`
- [ ] `launcher/src/renderer/src/components/RamSlider.tsx` + `RamSlider.test.tsx`
- [ ] `launcher/src/renderer/src/components/CrashViewer.tsx` + `CrashViewer.test.tsx`
- [ ] `launcher/src/renderer/src/components/PlayButton.tsx` + `PlayButton.test.tsx`
- [ ] `launcher/scripts/prefetch-jre.mjs` (shell utility; CI-verified via `pnpm run prefetch-jre`)
- [ ] `launcher/scripts/build-mod.sh` (shell utility)
- [ ] `launcher/electron-builder.yml` (full rewrite; validated by `pnpm run build:unpack`)
- [ ] Fixture: `launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` (trimmed live client.json + known-bad SHA1)
- [ ] Fixture: `launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt`
- [ ] Fixture: `launcher/src/main/monitor/__fixtures__/fake-crash-report.txt` (contains fake MC token + `C:\Users\Alice\…`)

Framework installed (vitest 4 + jsdom + @testing-library/react) — no framework-install task needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reach real Minecraft 1.8.9 main menu logged in with real MS account | LCH-05, LCH-06 | Requires MCE approval + real network + live game window | `pnpm --filter ./launcher run dev` → sign in → click Play → visually confirm main menu + account name in top-right of MC client |
| NSIS installer contains bundled JRE + mod jar | PKG-01 | Artifact inspection after `electron-builder` Windows build | After `pnpm run build:win`: `7z l launcher/dist/Wiiwho\ Client\ Setup.exe` → assert presence of `$PLUGINSDIR\app-64.7z` entries for `resources/jre/win-x64/bin/javaw.exe` and `resources/mod/wiiwho-0.1.0.jar` |
| Universal DMG bundles both JRE slots + mod jar | PKG-02 | Requires macOS build machine + DMG mount | After `pnpm run build:mac`: mount DMG → `ls "/Volumes/Wiiwho/Wiiwho.app/Contents/Resources/jre/"` shows `mac-arm64/` and `mac-x64/`; `ls "/Volumes/Wiiwho/Wiiwho.app/Contents/Resources/mod/"` shows `wiiwho-0.1.0.jar` |
| Cold-cache first-run download completes in ≤60 s on a reference machine | ROADMAP SC1 | Requires real network; timing |  Wipe `%APPDATA%/Wiiwho/game/`; click Play; wall-clock until main menu reached. Repeat cached to confirm ≤10 s |
| Crash viewer triggers with redacted real MC token | COMP-05, LAUN-05 | Requires real game crash or deliberate crash (force-kill JVM mid-chunk-load) | Seed `<game-dir>/crash-reports/` with a file containing a known fake token + username path. Launch via dev; verify viewer renders WITHOUT the token + username, and clipboard-copy also omits them |

---

## Validation Sign-Off

- [ ] All PLAN tasks populated in the Per-Task Verification Map above (planner fills)
- [ ] Every task has `<automated>` verify command OR is explicitly Wave 0 / manual-only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ W0 references listed above
- [ ] No `--watch` / `--ui` flags in verify commands (all one-shot)
- [ ] Feedback latency < 30 s per task
- [ ] `nyquist_compliant: true` set in frontmatter once checker passes
- [ ] `wave_0_complete: true` set in frontmatter once Wave 0 merged

**Approval:** pending
