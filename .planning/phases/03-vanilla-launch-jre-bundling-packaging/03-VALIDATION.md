---
phase: 3
slug: vanilla-launch-jre-bundling-packaging
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-21
last_updated: 2026-04-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from RESEARCH.md §Validation Architecture; Per-Task Verification Map populated by planner 2026-04-21 (Plans 03-00 through 03-12).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4 (dual env: jsdom for renderer, node for main/preload) |
| **Config file** | `launcher/vitest.config.ts` (Phase 2 idiom — `environmentMatchGlobs` cast) |
| **Quick run command** | `pnpm --filter ./launcher test:run` |
| **Full suite command** | `pnpm --filter ./launcher test:run && pnpm --filter ./launcher typecheck && pnpm --filter ./launcher lint` |
| **Phase gate command** | Full suite + `pnpm --filter ./launcher run build:unpack` + Plan 03-11 Task 3 Windows smoke + Plan 03-12 mac smoke + manual LCH-05/LCH-06 real-launch |
| **Estimated runtime** | ~30 seconds (quick) / ~90 seconds (full) |

Test file convention:
- Co-located `*.test.ts` / `*.test.tsx` sibling per module
- `@vitest-environment jsdom` docblock for renderer tests
- `afterEach(cleanup)` inside every renderer describe block
- Radix-in-jsdom: pointer-capture stubs + `userEvent.setup()` idiom locked Phase 2 Plan 02-05

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter ./launcher test:run`
- **After every plan wave:** Run full suite + `pnpm --filter ./launcher typecheck` + `pnpm --filter ./launcher lint` + `pnpm --filter ./launcher run build`
- **Before `/gsd:verify-work`:** Full suite green + `pnpm --filter ./launcher run build:unpack` green + manual PKG/LCH smoke tests
- **Max feedback latency:** 30 seconds for task-level; 90 seconds for wave-level

---

## Per-Task Verification Map

> Populated 2026-04-21 from Plans 03-00 through 03-12. Each row is one requirement-oriented assertion; a single task may appear multiple times if it satisfies multiple requirement IDs.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-00-T1 | 03-00 | 1 | (infra) | install | `cd launcher && pnpm install && npm run typecheck && npm run test:run` | ❌ W0 | ⬜ pending |
| 03-00-T2 | 03-00 | 1 | (infra) | compile | `cd launcher && npm run typecheck` | ❌ W0 | ⬜ pending |
| 03-00-T3 | 03-00 | 1 | (fixtures) | grep | `grep -q "Sound engine started" launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt && grep -q "ey.fakeTokenBody123" launcher/src/main/monitor/__fixtures__/fake-crash-report.txt` | ❌ W0 | ⬜ pending |
| 03-01-T1 | 03-01 | 1 | JRE-01, JRE-02, JRE-03 | unit | `cd launcher && npx vitest run src/main/paths.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | COMP-05 | unit | `cd launcher && npx vitest run src/main/auth/redact.test.ts` | ✅ exists (extend) | ⬜ pending |
| 03-02-T1 | 03-02 | 2 | LAUN-03, LAUN-04 | unit | `cd launcher && npx vitest run src/main/settings/store.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-T2 | 03-02 | 2 | LAUN-03, LAUN-04 | unit | `cd launcher && npx vitest run src/main/ipc/settings.test.ts` | ✅ exists (rewrite) | ⬜ pending |
| 03-03-T1 | 03-03 | 2 | LCH-01 | unit | `cd launcher && npx vitest run src/main/launch/manifest.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-T2 | 03-03 | 2 | LCH-01, LCH-02, LCH-03 | unit+integration | `cd launcher && npx vitest run src/main/launch/libraries.test.ts src/main/launch/libraries.integration.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-T3 | 03-03 | 2 | LCH-02 | integration | `cd launcher && npx vitest run src/main/launch/assets.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-T1 | 03-04 | 2 | LCH-02 | unit | `cd launcher && npx vitest run src/main/launch/natives.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-T2 | 03-04 | 2 | LCH-05, LCH-06 | unit | `cd launcher && npx vitest run src/main/launch/args.test.ts` | ❌ W0 | ⬜ pending |
| 03-05-T1 | 03-05 | 2 | LCH-05, LCH-07, JRE-03 | unit | `cd launcher && npx vitest run src/main/launch/spawn.test.ts` | ❌ W0 | ⬜ pending |
| 03-05-T2 | 03-05 | 2 | LCH-05, LCH-07 | integration | `cd launcher && npx vitest run src/main/launch/e2e.test.ts` | ❌ W0 | ⬜ pending |
| 03-06-T1 | 03-06 | 2 | LCH-05, LCH-07 | unit | `cd launcher && npx vitest run src/main/monitor/logParser.test.ts` | ❌ W0 | ⬜ pending |
| 03-06-T2 | 03-06 | 2 | LAUN-05 | unit | `cd launcher && npx vitest run src/main/monitor/crashReport.test.ts` | ❌ W0 | ⬜ pending |
| 03-07-T1 | 03-07 | 2 | LAUN-04 | unit (renderer) | `cd launcher && npx vitest run src/renderer/src/stores/__tests__/settings.test.ts` | ❌ W0 | ⬜ pending |
| 03-07-T2 | 03-07 | 2 | LAUN-03 | unit (renderer) | `cd launcher && npx vitest run src/renderer/src/components/__tests__/RamSlider.test.tsx` | ❌ W0 | ⬜ pending |
| 03-07-T3 | 03-07 | 2 | LAUN-03, LAUN-04 | unit (renderer) | `cd launcher && npx vitest run src/renderer/src/components/__tests__/SettingsDrawer.test.tsx` | ❌ W0 | ⬜ pending |
| 03-08-T1 | 03-08 | 2 | LCH-05, LCH-07, LAUN-05 | unit (renderer) | `cd launcher && npx vitest run src/renderer/src/stores/__tests__/game.test.ts` | ❌ W0 | ⬜ pending |
| 03-08-T2 | 03-08 | 2 | LCH-05, LCH-07 | unit (renderer) | `cd launcher && npx vitest run src/renderer/src/components/__tests__/PlayButton.test.tsx` | ❌ W0 | ⬜ pending |
| 03-08-T3 | 03-08 | 2 | COMP-05, LAUN-05 | unit (renderer) | `cd launcher && npx vitest run src/renderer/src/components/__tests__/CrashViewer.test.tsx` | ❌ W0 | ⬜ pending |
| 03-09-T1 | 03-09 | 3 | LCH-05, LCH-07, LAUN-05 | compile + grep | `cd launcher && npm run typecheck && grep -q "onLog:" launcher/src/preload/index.ts && grep -c "^[[:space:]]*(auth\|game\|settings\|logs\|__debug):" launcher/src/preload/index.ts` | ❌ W0 | ⬜ pending |
| 03-09-T2 | 03-09 | 3 | LCH-06 | unit | `cd launcher && npx vitest run src/main/auth/AuthManager.test.ts` | ✅ exists (extend) | ⬜ pending |
| 03-10-T1 | 03-10 | 3 | LCH-01, LCH-02, LCH-03, LCH-05, LCH-06, LCH-07, LAUN-05, COMP-05 | integration | `cd launcher && npx vitest run src/main/ipc/game.test.ts` | ✅ exists (rewrite) | ⬜ pending |
| 03-10-T2 | 03-10 | 3 | COMP-05 | unit | `cd launcher && npx vitest run src/main/ipc/logs.test.ts` | ❌ W0 | ⬜ pending |
| 03-10-T3 | 03-10 | 3 | (integration) | unit (renderer) | `cd launcher && npx vitest run src/renderer/src/components/__tests__/App.test.tsx` | ❌ W0 | ⬜ pending |
| 03-11-T1 | 03-11 | 4 | JRE-01, JRE-03 | syntax + grep | `node --check launcher/scripts/prefetch-jre.mjs && grep -q "jdk8u482-b08" launcher/scripts/prefetch-jre.mjs && grep -q '"prefetch-jre":' launcher/package.json` | ❌ W0 | ⬜ pending |
| 03-11-T2 | 03-11 | 4 | PKG-01, JRE-01 | grep | `grep -q "target: nsis" launcher/electron-builder.yml && grep -q "arch: universal" launcher/electron-builder.yml && grep -q "Wiiwho Client Setup.exe" launcher/electron-builder.yml && grep -q "RIGHT-CLICK" build/README-macOS.txt` | ❌ W0 | ⬜ pending |
| 03-11-T3 | 03-11 | 4 | PKG-01, JRE-01 | packaging smoke | `test -f "launcher/dist/Wiiwho Client Setup.exe" && test -f launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe && test -f launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar` | — | ⬜ pending |
| 03-12-T2 | 03-12 | 4 | PKG-02, JRE-02 | packaging smoke + manual | `test -f launcher/dist/Wiiwho.dmg` + manual hdiutil mount + path checks | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Per-Requirement Coverage Check

| Req ID | Covered by |
|--------|-----------|
| LCH-01 | 03-03-T1, 03-03-T2, 03-10-T1 |
| LCH-02 | 03-03-T2, 03-03-T3, 03-04-T1, 03-10-T1 |
| LCH-03 | 03-03-T2, 03-10-T1 |
| LCH-05 | 03-04-T2, 03-05-T1, 03-05-T2, 03-06-T1, 03-08-T1, 03-08-T2, 03-09-T1, 03-10-T1 + manual real-launch |
| LCH-06 | 03-04-T2, 03-09-T2, 03-10-T1 + manual real-launch |
| LCH-07 | 03-05-T1, 03-05-T2, 03-06-T1, 03-08-T1, 03-08-T2, 03-09-T1, 03-10-T1 |
| JRE-01 | 03-01-T1, 03-11-T1, 03-11-T3 |
| JRE-02 | 03-01-T1, 03-12-T2 |
| JRE-03 | 03-01-T1, 03-05-T1, 03-11-T1 |
| PKG-01 | 03-11-T2, 03-11-T3 |
| PKG-02 | 03-12-T2 |
| LAUN-03 | 03-02-T1, 03-02-T2, 03-07-T2, 03-07-T3 |
| LAUN-04 | 03-02-T1, 03-02-T2, 03-07-T1, 03-07-T3 |
| LAUN-05 | 03-06-T2, 03-08-T1, 03-08-T3, 03-09-T1, 03-10-T1 |
| COMP-05 | 03-01-T2, 03-08-T3, 03-10-T1, 03-10-T2 |

Every Phase 3 requirement appears in ≥1 plan's `requirements` frontmatter AND has at least one automated verify command in the table above.

---

## Wave 0 Requirements

New modules + sibling tests the planner MUST stub before downstream waves. All items created during Plans 03-00 through 03-10's tasks (marked ❌ W0 in the table above):

- [ ] `launcher/src/main/paths.ts` + `paths.test.ts` (Plan 03-01)
- [ ] `launcher/src/main/launch/manifest.ts` + `manifest.test.ts` (Plan 03-03)
- [ ] `launcher/src/main/launch/libraries.ts` + `libraries.test.ts` + `libraries.integration.test.ts` (Plan 03-03)
- [ ] `launcher/src/main/launch/assets.ts` + `assets.test.ts` (Plan 03-03)
- [ ] `launcher/src/main/launch/natives.ts` + `natives.test.ts` (Plan 03-04)
- [ ] `launcher/src/main/launch/args.ts` + `args.test.ts` (Plan 03-04)
- [ ] `launcher/src/main/launch/spawn.ts` + `spawn.test.ts` (Plan 03-05)
- [ ] `launcher/src/main/launch/e2e.test.ts` (Plan 03-05)
- [ ] `launcher/src/main/monitor/logParser.ts` + `logParser.test.ts` (Plan 03-06)
- [ ] `launcher/src/main/monitor/crashReport.ts` + `crashReport.test.ts` (Plan 03-06)
- [ ] `launcher/src/main/settings/store.ts` + `store.test.ts` (Plan 03-02)
- [ ] `launcher/src/main/ipc/logs.ts` + `logs.test.ts` (Plan 03-10)
- [ ] `launcher/src/renderer/src/stores/game.ts` + `__tests__/game.test.ts` (Plan 03-08)
- [ ] `launcher/src/renderer/src/stores/settings.ts` + `__tests__/settings.test.ts` (Plan 03-07)
- [ ] `launcher/src/renderer/src/components/{SettingsDrawer,RamSlider,CrashViewer,PlayButton}.tsx` + tests (Plans 03-07, 03-08)
- [ ] `launcher/src/renderer/src/components/__tests__/App.test.tsx` (Plan 03-10)
- [ ] `launcher/scripts/prefetch-jre.mjs` (Plan 03-11)
- [ ] `launcher/scripts/build-mod.sh` (Plan 03-11)
- [ ] `launcher/electron-builder.yml` (full rewrite; Plan 03-11)
- [ ] `build/README-macOS.txt` + `docs/install-macos.md` (Plan 03-11)
- [ ] Fixtures: `launcher/src/main/launch/__fixtures__/1.8.9-manifest.json`, `launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt`, `launcher/src/main/monitor/__fixtures__/fake-crash-report.txt` (Plan 03-00)

Framework installed (vitest 4 + jsdom + @testing-library/react) — no framework-install task needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reach real Minecraft 1.8.9 main menu logged in with real MS account | LCH-05, LCH-06 | Requires MCE approval + real network + live game window | `pnpm --filter ./launcher run dev` → sign in → click Play → visually confirm main menu + account name in top-right of MC client |
| NSIS installer layout inspection | PKG-01 | Artifact inspection after `electron-builder --win` | Post Plan 03-11 Task 3: `7z l "launcher/dist/Wiiwho Client Setup.exe"` → assert `resources/jre/win-x64/bin/javaw.exe` + `resources/mod/wiiwho-0.1.0.jar` entries present |
| Universal DMG layout inspection | PKG-02 | Requires macOS build machine + DMG mount | Post Plan 03-12: `hdiutil attach launcher/dist/Wiiwho.dmg` → `ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/"` shows `mac-arm64/` and `mac-x64/`; mod jar present |
| Cold-cache first-run download completes in ≤60 s | ROADMAP SC1 | Requires real network; timing | Wipe `%APPDATA%/Wiiwho/game/`; click Play; wall-clock until main menu reached. Repeat cached to confirm ≤10 s |
| Crash viewer triggers with redacted real MC token | COMP-05, LAUN-05 | Requires real game crash (or deliberate force-kill mid-chunk-load) | Seed `<game-dir>/crash-reports/` with a file containing a known fake token + username path. Launch via dev; verify viewer renders WITHOUT the token + username, clipboard-copy also omits them |

---

## Validation Sign-Off

- [x] All PLAN tasks populated in the Per-Task Verification Map above (planner filled 2026-04-21)
- [x] Every task has `<automated>` verify command OR is explicitly Wave 0 / manual-only
- [x] Sampling continuity: every plan's tasks have at least one automated verify; no 3 consecutive non-automated tasks
- [x] Wave 0 covers all ❌ W0 references listed above (itemized list)
- [x] No `--watch` / `--ui` flags in verify commands (all one-shot)
- [x] Feedback latency < 30 s per task (vitest run of individual files is < 5 s typically)
- [x] Every Phase 3 requirement ID appears in ≥1 plan's `requirements` frontmatter (cross-checked table)
- [ ] `wave_0_complete: true` — set after Wave 2 plans merge
- [x] `nyquist_compliant: true` — set in frontmatter

**Approval:** ready for execute
