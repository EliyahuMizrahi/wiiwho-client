---
phase: 03-vanilla-launch-jre-bundling-packaging
verified: 2026-04-21T10:27:53Z
status: human_needed
score: 5/5 automated must-haves verified; 4 human-verification items outstanding
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "End-to-end Play-to-main-menu (SC1)"
    expected: "Click Play from Windows launcher with a real Microsoft account; after ~60s first-run (or ~10s cached) the Minecraft 1.8.9 main menu is visible, user is logged in with their real MSA gamertag, launcher window has minimized on the Sound-engine-started sentinel, and only the bundled Temurin JRE was spawned (no system Java). Uninstall any system Java first to prove JRE-03 at runtime."
    why_human: "Requires a real MS account + live Mojang/XBL/XSTS handshake + actual JVM launch + visual confirmation of main-menu arrival. Launcher-side plumbing is fully unit + e2e-tested against a fake JVM (e2e.test.ts with node-as-java), but the real Minecraft jar + LWJGL natives + OpenAL driver can only be proven working by firing the game."
  - test: "SC3 real-token redaction (crash viewer)"
    expected: "Force a JVM crash (e.g. edit argv to point at a bad natives path), or inject a real access_token-looking string into a crash-report fixture. In both the on-screen <pre> block AND the output of Copy report → paste into a scratch file: any `eyJ...` JWT body, `access_token: ...`, `refresh_token: ...`, `--accessToken <value>`, `%USERNAME%`, `C:\\Users\\<name>`, `/Users/<name>` tokens are replaced with [REDACTED] / <USER>. Both strings must match byte-for-byte (D-21)."
    why_human: "Unit tests (redact.test.ts, CrashViewer.test.tsx) pin the redaction pipeline with synthetic fixtures including a D-21 regression-grep guard — but no automated test can feed a real MS-issued token end-to-end through a real crash. COMP-05 is a privacy guarantee; owner should eyeball once before v0.1."
  - test: "PKG-02 — macOS DMG build on a Mac (blocked: no Mac tonight)"
    expected: "On a macOS 12+ machine with Node 22 + JDK 17 installed: `pnpm install && pnpm --filter ./launcher run dist:mac` produces `launcher/dist/Wiiwho.dmg`. Mount the DMG, right-click-Open Wiiwho.app, Gatekeeper prompt dismisses, Play button works, bundled Java under Contents/Resources/jre/mac-arm64 (or mac-x64) is what runs. All prep artifacts (electron-builder.yml mac target, prefetch-jre mac slots, README-macOS.txt, docs/install-macos.md) are already in place per Plan 03-11 + 03-12."
    why_human: "Cross-platform build — cannot be run from Windows. Plan 03-12 explicitly marked CHECKPOINT. JRE-02 + PKG-02 remain 'Pending' in REQUIREMENTS.md until this runs."
  - test: "PKG-01 — Windows NSIS installer binary (blocked: Developer Mode toggle)"
    expected: "After enabling Windows Developer Mode (Settings → Privacy & Security → For developers → Developer Mode: On) OR running `pnpm --filter ./launcher run dist:win` from an elevated admin shell, the exact same commit `94da6e2` produces `launcher/dist/Wiiwho Client Setup.exe`. Install it, launch Wiiwho from Start Menu, Play to main menu."
    why_human: "electron-builder 26.x NSIS step extracts winCodeSign-2.6.0.7z which contains macOS symlinks — symlink creation on Windows needs Developer Mode or admin. Environmental, not a code gap; win-unpacked/ is fully populated (Wiiwho.exe + bundled JRE + mod.jar verified on disk). REQUIREMENTS.md already flags PKG-01 Complete based on the unpacked bundle + config."
---

# Phase 3: Vanilla Launch, JRE Bundling, Packaging Verification Report

**Phase Goal:** Launcher downloads/verifies vanilla 1.8.9 from Mojang, spawns the bundled Java 8 JVM, reaches the Minecraft main menu logged in with the user's real MS account, and ships as a distributable installer on Windows + macOS. All launcher-side UX (RAM slider, crash viewer, launch log stream) in place.

**Verified:** 2026-04-21T10:27:53Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| #   | Success Criterion                                                                                                     | Status       | Evidence                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | Click Play → main menu logged in with real MSA; bundled JRE only (no system Java)                                     | ? HUMAN      | All code-level artifacts wired + tested: manifest.ts / libraries.ts / assets.ts / natives.ts / args.ts / spawn.ts / logParser.ts (Sound-engine sentinel) / ipc/game.ts orchestrator chain present; e2e.test.ts drives the full pipeline with node-as-java. Actual reach-main-menu requires live MSA + Minecraft launch. |
| SC2 | RAM slider 1-4 GB, default 2 GB, G1GC args, tooltip, persists across restarts                                         | ✓ VERIFIED   | store.ts clamp 1024-4096 step 512 default 2048; args.ts hardcodes -XX:+UseG1GC + 3 companion flags; RamSlider.tsx renders Radix Tooltip + caption; store.test.ts Test 3 round-trips write→read across fresh module import (LAUN-04 pinned).              |
| SC3 | Non-zero JVM exit → crash report with tokens+JWTs+usernames redacted BEFORE display AND clipboard                     | ✓ VERIFIED   | redact.ts exports sanitizeCrashReport (D-21 single-source scrub with 10 patterns); ipc/game.ts line 193 calls sanitizeCrashReport before game:crashed push; CrashViewer.test.tsx D-21 invariant asserts display==clipboard + regression-grep forbids importing redact into renderer.                            |
| SC4 | electron-builder produces NSIS (Windows) + DMG/ZIP (macOS); both bundle Temurin 8 JRE + WiiWho mod jar                | ? HUMAN      | electron-builder.yml has complete NSIS + Universal DMG targets with extraResources for jre/win-x64, jre/mac-arm64, jre/mac-x64, mod; prefetch-jre.mjs Temurin-8u482 ready for all 3 slots; Windows win-unpacked/ fully populated. NSIS final .exe blocked on Dev-Mode toggle (environmental); DMG blocked on no Mac machine. |
| SC5 | All libraries + client jar SHA1-verified; corrupting cache triggers re-download, never silent-launch with bad files   | ✓ VERIFIED   | libraries.integration.test.ts Test C plants corrupted bytes → asserts fetch is called AND final SHA1 matches advertised. Test D asserts SHA1 mismatch from network throws + no file left on disk. manifest.ts SHA1-verifies per-version JSON against catalogue.                                                  |

**Automated score:** 3/5 fully VERIFIED via code + tests; 2/5 correctly routed to human_needed because they demand environmental access this session cannot provide (real MSA end-to-end / a Mac / Dev-Mode toggle). No code gaps.

---

### Required Artifacts (Level 1-3)

| Artifact                                                                  | Expected                                        | Exists | Substantive | Wired | Status     |
| ------------------------------------------------------------------------- | ----------------------------------------------- | ------ | ----------- | ----- | ---------- |
| `launcher/src/main/paths.ts`                                              | resolveJavaBinary / resolveModJar / game dirs   | ✓      | ✓ 86 lines   | ✓     | ✓ VERIFIED |
| `launcher/src/main/launch/manifest.ts`                                    | SHA1-verified per-version JSON fetch            | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/main/launch/libraries.ts`                                   | ensureClientJar + ensureLibraries + classpath   | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/main/launch/assets.ts`                                      | installAssets wrapper (asset index `1.8`)       | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/main/launch/natives.ts`                                     | LWJGL native extraction into nativesDir         | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/main/launch/args.ts`                                        | buildArgv with 1.8.9 canonical shape            | ✓      | ✓ 192 lines  | ✓     | ✓ VERIFIED |
| `launcher/src/main/launch/spawn.ts`                                       | execa wrapper + JRE-03 bundled-path assertion    | ✓      | ✓ 123 lines  | ✓     | ✓ VERIFIED |
| `launcher/src/main/monitor/logParser.ts`                                  | MAIN_MENU_PATTERN sentinel + ring buffer        | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/main/monitor/crashReport.ts`                                | watchForCrashReport + readCrashReport           | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/main/auth/redact.ts`                                        | sanitizeCrashReport + D-21 single scrub         | ✓      | ✓ 136 lines  | ✓     | ✓ VERIFIED |
| `launcher/src/main/settings/store.ts`                                     | clampRam + read/write atomic temp+rename        | ✓      | ✓ 124 lines  | ✓     | ✓ VERIFIED |
| `launcher/src/main/ipc/game.ts`                                           | orchestrator chain + D-21 sanitize before push  | ✓      | ✓ 248 lines  | ✓     | ✓ VERIFIED |
| `launcher/src/main/ipc/logs.ts`                                           | logs:read-crash + logs:open-crash-folder        | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/renderer/src/components/RamSlider.tsx`                      | 1024-4096 step 512 + Radix tooltip              | ✓      | ✓ 106 lines  | ✓     | ✓ VERIFIED |
| `launcher/src/renderer/src/components/SettingsDrawer.tsx`                 | Sheet (right) + embedded RamSlider              | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/renderer/src/components/CrashViewer.tsx`                    | D-18 full-page + D-19 four buttons + D-21 sink  | ✓      | ✓ 135 lines  | ✓     | ✓ VERIFIED |
| `launcher/src/renderer/src/stores/settings.ts`                            | Zustand store hydrating from IPC                | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/src/renderer/src/App.tsx`                                       | state-driven routing + CrashViewer takeover     | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/electron-builder.yml`                                           | NSIS x64 + Universal DMG + extraResources       | ✓      | ✓ 94 lines   | ✓     | ✓ VERIFIED |
| `launcher/scripts/prefetch-jre.mjs`                                       | Temurin 8u482 zero-dep downloader + SHA256      | ✓      | ✓ 240 lines  | ✓     | ✓ VERIFIED |
| `launcher/scripts/build-mod.sh`                                           | gradlew build + stage to resources/mod          | ✓      | ✓            | ✓     | ✓ VERIFIED |
| `launcher/resources/mod/wiiwho-0.1.0.jar`                                 | client-mod jar (1008 KB) produced               | ✓      | ✓            | n/a   | ✓ VERIFIED |
| `launcher/resources/jre/{win-x64,mac-x64,mac-arm64}/`                     | Temurin 8u482 JRE slots populated               | ✓      | ✓            | n/a   | ✓ VERIFIED |
| `launcher/dist/win-unpacked/Wiiwho.exe`                                   | Windows electron runtime bundled                | ✓      | ✓ 210 MB     | n/a   | ✓ VERIFIED |
| `launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe`          | bundled Temurin JRE in packaged path            | ✓      | ✓            | n/a   | ✓ VERIFIED |
| `launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar`               | bundled mod jar in packaged path                | ✓      | ✓            | n/a   | ✓ VERIFIED |
| `launcher/dist/Wiiwho Client Setup.exe`                                   | Final NSIS installer                            | ✗      | -           | -     | ⚠️ HUMAN (Dev-Mode env blocker) |
| `launcher/dist/Wiiwho.dmg`                                                | macOS DMG                                       | ✗      | -           | -     | ⚠️ HUMAN (no Mac tonight) |
| `build/README-macOS.txt` + `launcher/build/README-macOS.txt`              | Gatekeeper walkthrough shipped in DMG           | ✓      | ✓            | n/a   | ✓ VERIFIED |
| `docs/install-macos.md`                                                   | Public macOS install guide w/ Rosetta 2 note    | ✓      | ✓            | n/a   | ✓ VERIFIED |

---

### Key Link Verification

| From                           | To                              | Via                                                        | Status     |
| ------------------------------ | ------------------------------- | ---------------------------------------------------------- | ---------- |
| ipc/game.ts orchestrator        | sanitizeCrashReport              | `sanitizeCrashReport(raw)` at line 193 before game:crashed | ✓ WIRED    |
| CrashViewer.tsx (renderer)      | navigator.clipboard.writeText    | Uses SAME `sanitizedBody` prop as <pre>{body}</pre>         | ✓ WIRED (D-21 invariant) |
| spawn.ts                       | resolveJavaBinary (JRE-03)       | `isBundledJre()` regex asserts `/resources/jre/` in path   | ✓ WIRED    |
| electron-builder.yml win target | resources/jre/win-x64 + mod      | extraResources → win-unpacked/resources/jre/win-x64/       | ✓ WIRED (verified on disk) |
| electron-builder.yml mac target | resources/jre/mac-{x64,arm64}    | extraResources (both slots) + universal DMG                 | ✓ CONFIG-WIRED (Mac build pending) |
| logParser.ts sentinel           | ipc/game.ts onMainMenu → minimize | setStatus('playing') + mainWindow.minimize() in game.ts     | ✓ WIRED    |
| renderer/stores/settings.ts     | main settings:get / settings:set | `window.wiiwho.settings.get/set` round-trip                 | ✓ WIRED    |
| ensureClientJar SHA1 check      | advertised `downloads.client.sha1` | createHash('sha1') compared to ResolvedVersion value       | ✓ WIRED (SC5 integration test pins) |
| manifest.ts cached JSON         | version_manifest_v2 catalogue SHA1 | Atomic temp+rename, SHA1-verified before replacing cache   | ✓ WIRED    |

---

### Data-Flow Trace (Level 4)

| Artifact                 | Data Variable                  | Source                                              | Produces Real Data | Status     |
| ------------------------ | ------------------------------ | --------------------------------------------------- | ------------------ | ---------- |
| RamSlider.tsx            | `ramMb`                        | useSettingsStore → wiiwho.settings.get (main store) | ✓ (round-trip pinned by store.test.ts Test 3) | ✓ FLOWING |
| CrashViewer.tsx          | `sanitizedBody`                | App.tsx from useGameStore.lastCrash populated by `game:crashed` push (ipc/game.ts line 193: sanitizeCrashReport(raw)) | ✓ (redact.test.ts pins full pipeline; game.test.ts Test 7 asserts sanitize-before-push; CrashViewer.test.tsx D-21 invariant) | ✓ FLOWING |
| PlayButton / App.tsx     | `phase.state`                  | useGameStore subscribed to game:status-changed (downloading→verifying→starting→playing→idle) | ✓ (game.test.ts Test 2 asserts full phase sequence) | ✓ FLOWING |
| SettingsDrawer.tsx       | RamSlider passthrough           | Same store, embedded component                      | ✓                   | ✓ FLOWING |

No HOLLOW props identified. No static-return stubs found at any data boundary. orchestrator wires settings.ramMb → args.ramMb → JVM `-Xmx${ramMb}M` end-to-end (game.ts lines 108, 146).

---

### Behavioral Spot-Checks

| Behavior                                          | Command                                | Result                              | Status |
| ------------------------------------------------- | -------------------------------------- | ----------------------------------- | ------ |
| Launcher test suite passes                        | `pnpm run test:run`                    | `Test Files 36 passed (36)` / `Tests 354 passed (354)` / 5.17s | ✓ PASS |
| TypeScript typecheck clean (node + web)           | `pnpm run typecheck`                   | node OK + web OK, no output errors  | ✓ PASS |
| No Mojang assets bundled in installer             | `find launcher/dist/win-unpacked/resources/ -iname "*mojang*" -o -iname "*minecraft*"` | empty (no matches)                                             | ✓ PASS |
| Windows unpacked bundle layout                    | `ls launcher/dist/win-unpacked/resources/`  | `app.asar`, `app.asar.unpacked`, `jre`, `mod` present | ✓ PASS |
| Bundled Java binary present (JRE-01)              | `ls launcher/dist/win-unpacked/resources/jre/win-x64/bin/javaw.exe` | `javaw.exe` (305 KB stub) — JRE subtree intact | ✓ PASS |
| Mod jar present at packaged path                  | `ls launcher/dist/win-unpacked/resources/mod/wiiwho-0.1.0.jar` | jar present (1008 KB) | ✓ PASS |
| Settings round-trip (LAUN-04)                     | `store.test.ts Test 3: round-trips write→read across fresh module import` | passes as part of 354/354 | ✓ PASS |
| Corrupt-cache re-download (SC5)                   | `libraries.integration.test.ts Test C` | passes as part of 354/354 | ✓ PASS |
| SHA1 mismatch never silently persisted            | `libraries.integration.test.ts Test D` | passes; temp file unlinked on mismatch | ✓ PASS |
| Real reach-main-menu with real MSA                 | _(requires live MC launch — deferred to human)_ | -                                   | ? SKIP → human_verification #1 |
| Real-token redaction sanity                       | _(requires live crash with real token — deferred to human)_ | -                                   | ? SKIP → human_verification #2 |
| NSIS installer binary                             | `pnpm run dist:win` (in admin shell OR Dev-Mode On) | _(not produced this session: environmental)_ | ? SKIP → human_verification #4 |
| macOS DMG binary                                  | `pnpm run dist:mac` (requires macOS 12+) | _(no Mac machine)_                    | ? SKIP → human_verification #3 |

---

### Requirements Coverage

| Requirement | Source Plan(s)         | Description                                                                                     | Status              | Evidence                                                                                                     |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| LCH-01      | 03-03                  | Download + SHA1-verify vanilla 1.8.9 client jar from manifest                                    | ✓ SATISFIED         | manifest.ts fetchAndCacheManifest + libraries.ts ensureClientJar; libraries.integration.test.ts Tests B/C/D  |
| LCH-02      | 03-03                  | Libraries + asset index SHA1-verified                                                             | ✓ SATISFIED         | libraries.ts delegates to @xmcl/installer installLibraries (diagnose-first SHA1); assets.ts installAssets    |
| LCH-03      | 03-03                  | Cache-hit reuse — no redundant downloads                                                          | ✓ SATISFIED         | libraries.integration.test.ts Test A (planted jar + matching SHA1 → fetch NOT called)                        |
| LCH-05      | 03-04, 03-05           | Bundled JVM + correct classpath + heap + tokens + game args → main menu opens                     | ✓ CODE-SATISFIED    | args.ts canonical argv + spawn.ts execa + paths.ts resolveJavaBinary; e2e.test.ts streams boot-log + sentinel. Full live run = human #1. |
| LCH-06      | 03-04, 03-05, 03-10    | Main menu reached logged in with real MS account (no offline mode)                                | ✓ CODE-SATISFIED    | args.ts --userType msa constant + ipc/game.ts calls AuthManager.getMinecraftToken(); full E2E = human #1     |
| LCH-07      | 03-06, 03-08, 03-10    | stdout/stderr captured and displayed in launcher UI                                                | ✓ SATISFIED         | logParser.onLine → game:log IPC → CrashViewer/logs UI; game.test.ts Test 4 pins log event relay               |
| JRE-01      | 03-11                  | Windows installer bundles Temurin 8 JRE                                                            | ✓ SATISFIED         | win-unpacked/resources/jre/win-x64/bin/javaw.exe confirmed on disk; electron-builder.yml extraResources wired |
| JRE-02      | 03-12                  | macOS installer bundles Temurin 8 JRE                                                              | ? NEEDS HUMAN       | Config + prep artifacts all in place (electron-builder.yml mac extraResources, mac-arm64 + mac-x64 slots populated). Build requires Mac. REQUIREMENTS.md: Pending. |
| JRE-03      | 03-01, 03-05           | Launcher spawns bundled JRE, never system Java                                                     | ✓ SATISFIED         | spawn.ts isBundledJre() regex asserts `/resources/jre/`; paths.ts resolveJavaBinary() only returns bundled path; paths.test.ts + e2e.test.ts pin invariant |
| PKG-01      | 03-11                  | electron-builder produces distributable Windows installer bundling launcher + JRE + mod            | ? NEEDS HUMAN       | Full electron-builder.yml NSIS config complete; win-unpacked/ correct; final .exe blocked on Windows Developer Mode toggle (environmental — documented). REQUIREMENTS.md: Complete (based on unpacked bundle correctness). |
| PKG-02      | 03-12                  | electron-builder produces distributable macOS app bundle                                           | ? NEEDS HUMAN       | All Mac prep artifacts authored in 03-11 (universal DMG target, extraResources, README-macOS.txt, docs/install-macos.md). Build requires Mac. REQUIREMENTS.md: Pending. |
| LAUN-03     | 03-02, 03-07           | RAM slider with bounds                                                                             | ✓ SATISFIED         | store.ts clampRam(1024, 4096, step 512); RamSlider.tsx min/max/step; store.test.ts clamp tests              |
| LAUN-04     | 03-02                  | RAM setting persists across launcher restarts                                                       | ✓ SATISFIED         | store.ts atomic temp+rename; store.test.ts Test 3 round-trips write→read across fresh module import         |
| LAUN-05     | 03-06, 03-08, 03-10    | Crash viewer in launcher UI                                                                         | ✓ SATISFIED         | CrashViewer.tsx full-page D-18 + 4 buttons D-19; ipc/game.ts wires game:crashed; App.tsx routes on phase=crashed |
| COMP-05     | 03-01, 03-10           | Tokens + usernames redacted in crash logs                                                            | ✓ SATISFIED         | redact.ts 10-pattern scrub + sanitizeCrashReport; ipc/game.ts line 193 sanitize-before-push; CrashViewer.test.tsx D-21 regression grep; full live fixture = human #2 |

**No ORPHANED requirements** — every REQ-ID declared in phase plan frontmatter is cross-referenced in REQUIREMENTS.md's Phase 3 list and vice-versa.

---

### Anti-Patterns Found

| File | Line | Pattern                   | Severity | Impact |
| ---- | ---- | ------------------------- | -------- | ------ |
| —    | —    | No TODO/FIXME/XXX/HACK/PLACEHOLDER matches in launcher/src | ℹ️ Info   | Clean |
| —    | —    | No `return null` stub placeholders in production code      | ℹ️ Info   | Clean |
| —    | —    | No hardcoded empty props flowing to user-visible output    | ℹ️ Info   | Clean |
| —    | —    | No raw child_process.exec (Pitfall 4); only execa streaming | ℹ️ Info   | Correct pattern |

Pre-existing lint errors in 3 renderer test files (ErrorBanner, RamSlider, SettingsDrawer — `explicit-function-return-type`) documented in `deferred-items.md`; out of scope for Phase 3 execution and do not block behavior or tests.

---

### Project-Instructions Compliance (CLAUDE.md)

| Guideline                                       | Status      | Evidence                                                                        |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| No Mojang asset redistribution                  | ✓ SATISFIED | `find launcher/dist/win-unpacked/resources/ -iname "*mojang*" -o -iname "*minecraft*"` empty; manifest/libraries/assets fetch from Mojang URLs at runtime only |
| Microsoft OAuth only (no cracked accounts)      | ✓ SATISFIED | args.ts `--userType msa` constant; ipc/game.ts calls AuthManager.getMinecraftToken() which flows through prismarine-auth XBL→XSTS→Minecraft |
| Target Minecraft 1.8.9 only                      | ✓ SATISFIED | manifest.ts and args.ts hardcode '1.8.9' + VANILLA_ASSET_INDEX `1.8` (Pitfall 8) |
| Tech stack locked (Electron + TypeScript + React + Forge 1.8.9 + Java 8) | ✓ SATISFIED | package.json: Electron 39.x, TS 5.9, React 19, @xmcl/core+installer, execa, MSAL, prismarine-auth; Temurin 8u482 prefetched |
| Anticheat safety note                            | ℹ️ N/A for Phase 3 | Phase 3 ships vanilla launch chain only — no in-game HUD/render patches yet. Phase 4+ will require the review. |
| bundle size / JRE source                         | ✓ SATISFIED | Eclipse Temurin 8u482 (JRE-only build) per STACK; x64 shipped in both mac slots per Open Q §1 resolution |

---

### Human Verification Required

(Full details in the frontmatter `human_verification` block.)

1. **End-to-end Play-to-main-menu with real MSA (SC1, LCH-05, LCH-06)** — only a live MS account + live game launch can close this loop.
2. **Real-token redaction sanity (SC3, COMP-05)** — eyeball a real crash containing a real token; paste + grep for the token body in the clipboard capture.
3. **PKG-02 macOS DMG** — `pnpm run dist:mac` on a Mac (12+). Requires hardware this session doesn't have.
4. **PKG-01 NSIS installer** — toggle Windows Developer Mode OR run dist:win as admin; same commit `94da6e2` produces `Wiiwho Client Setup.exe`.

---

### Gaps Summary

**No code gaps.** All 12 autonomous plans (03-00 through 03-11) delivered substantive, wired, data-flowing artifacts; plan 03-12 is a deliberate CHECKPOINT deferring macOS DMG production to a Mac machine. The remaining open items are all external-access blockers:

- **Windows NSIS final binary:** environmental (Developer Mode toggle / admin shell).
- **macOS DMG:** hardware (no Mac tonight).
- **SC1 live reach-main-menu:** requires a real MSA + a real Minecraft launch.
- **SC3 live token redaction:** requires a real issued MS token in a real crash report.

REQUIREMENTS.md's own status is already honest about this: PKG-01 + JRE-01 + COMP-05 + the 11 non-macOS reqs = Complete; PKG-02 + JRE-02 = Pending.

The Windows path is 100% code-complete and unpacked-bundle-verified; the macOS path is 100% config + prep-complete and awaits a single `pnpm run dist:mac` on a Mac.

**Overall:** Phase 3 goal is code-achieved; goal completion beyond the code requires human verification on access-gated environments. Status: `human_needed`.

---

_Verified: 2026-04-21T10:27:53Z_
_Verifier: Claude (gsd-verifier)_
