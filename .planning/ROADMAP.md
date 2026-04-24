# Roadmap: WiiWho Client

## Overview

Eight phases from "two greenfield toolchains" to "v0.1 shipped to a small group." Phase 1 validates the two highest-risk unknowns in parallel — the Forge 1.8.9 build system and the Electron security scaffold — while the Azure AD app registration (1-7 day Microsoft review queue) starts as an external dependency on day one. Phases 2-3 build the launcher end-to-end against a real Microsoft account and a real 1.8.9 game window. Phase 4 transforms the functional launcher into a polished, themeable, animated experience with Spotify integration — no ads or social bloat. Phase 5 integrates Forge, establishes the HUD framework, and proves all three v0.1 HUDs are anticheat-safe on live servers. Phase 6 proves the cosmetics rendering path with a placeholder cape. Phase 7 is the only differentiator — beats-Optifine performance, gated behind a committed benchmark methodology. Phase 8 is the non-negotiable release gate.

## External Dependency

**Azure AD app registration with Minecraft API scope** — Microsoft review queue is 1-7 days. **Submit at Phase 1 start, not Phase 2 start.** Phase 2 is blocked without it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundations** - Legal/anticheat/brand policy baseline, Forge+Mixin mod scaffold, Electron launcher skeleton with locked-down IPC; Azure AD app submitted
- [ ] **Phase 2: Microsoft Authentication** - Full MS → XBL → XSTS → Minecraft token chain with OS-keychain storage and translated error codes
- [ ] **Phase 3: Vanilla Launch, JRE Bundling & Packaging** - Download/verify 1.8.9, spawn bundled Java 8 JVM, reach main menu with real MS account; RAM slider, crash viewer, Windows+macOS installers
- [ ] **Phase 4: Launcher UI Polish** - Themeable color schemes, smooth animations, redesigned main surface, Spotify launcher integration; no ads, no news, no social counters
- [ ] **Phase 5: Forge Integration, HUD Framework & HUDs** - Forge + our mod injected on launch; HudModule framework; FPS/Keystrokes/CPS HUDs shipped anticheat-safe on Hypixel + BlocksMC
- [ ] **Phase 6: Cosmetics Pipeline (Placeholder Cape)** - End-to-end cosmetic rendering proven with one baked-in cape keyed to our UUID
- [ ] **Phase 7: Performance (Beats Optifine)** - Committed benchmark methodology, baseline measurement vs Optifine+Patcher, optimization passes hitting p95/p99 targets
- [ ] **Phase 8: v0.1 Release Hardening** - Full looks-done-but-isn't verification gate; clean-machine install on Windows + macOS; small-group distribution

## Phase Details

### Phase 1: Foundations
**Goal**: Lock in the three project-ending policy baselines, validate both toolchains end-to-end in parallel, and submit the Azure AD app so Microsoft's review queue runs in the background.
**Depends on**: Nothing (first phase)
**Requirements**: COMP-04, MOD-01, MOD-02, MOD-03, MOD-04, LAUN-01, LAUN-02, LAUN-06
**Success Criteria** (what must be TRUE):
  1. ANTICHEAT-SAFETY.md exists with a review-signoff template; docs/mojang-asset-policy.md documents "launcher downloads at runtime, no redistribution"; placeholder cape art provenance is documented (original or CC0)
  2. Azure AD app is registered with Minecraft API scope and has been submitted for Microsoft review (queue running; unblocks Phase 2)
  3. `./gradlew runClient` launches a dev Minecraft 1.8.9 with the WiiWho Forge mod loaded, DevAuth-authenticated with a real Microsoft account, and a trivial Mixin applied — verified on Windows; MODID is generic and collision-checked against CurseForge/Modrinth
  4. Running `pnpm dev` in the launcher opens an Electron window with a visible "Play" button, `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` all confirmed at runtime, and the preload bridge exposes only named auth/game/settings IPC channels
**Plans**: 5 plans
  - [x] 01-00-PLAN.md — Wave 0 infrastructure: policy doc skeletons (ANTICHEAT-SAFETY, mojang-asset-policy, cape-provenance) + docs-check script (COMP-04)
  - [x] 01-01-PLAN.md — client-mod scaffold from nea89o template, MODID collision check, ModidTest (MOD-01, MOD-03)
  - [x] 01-02-PLAN.md — Trivial Mixin + `./gradlew runClient` DevAuth verification on Windows (MOD-02, MOD-04)
  - [x] 01-03-PLAN.md — Electron launcher scaffold, Tailwind v4 + shadcn, runtime-verified security, full IPC surface stubs (LAUN-01, LAUN-02, LAUN-06)
  - [x] 01-04-PLAN.md — Azure AD app registration + Minecraft API form submission (phase success criterion 2)

### Phase 2: Microsoft Authentication
**Goal**: User can log in with a real Microsoft account from inside the launcher, see their Minecraft username + UUID, persist securely, and log out cleanly — against live Microsoft endpoints.
**Depends on**: Phase 1 (launcher skeleton + Azure AD app approved)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. User clicks "Log in," sees a device code + "open browser" button, completes Microsoft sign-in, and lands back in the launcher with their Minecraft username and UUID displayed
  2. Refresh token is stored in the OS keychain via Electron `safeStorage` (verified: no token-looking strings anywhere in `%APPDATA%/WiiWho` or `~/Library/Application Support/WiiWho` filesystem contents); 7-day refresh test succeeds without re-prompting
  3. Common XSTS error codes (`2148916233`, `2148916235`, `2148916236`, `2148916237`, `2148916238`) each surface a plain-English message, not a raw code
  4. User can click "Log out" and return to the login screen; re-login works
**Plans**: 7 plans
  - [x] 02-00-PLAN.md — Install deps (@azure/msal-node, prismarine-auth, electron-log), add shadcn Dialog+DropdownMenu, vitest config for dual main/renderer envs, MANUAL-QA-auth.md skeleton (infrastructure)
  - [x] 02-01-PLAN.md — xstsErrors.ts code-based XSTS error mapper + redact.ts electron-log hook for JWT/token scrubbing (AUTH-03 foundation)
  - [x] 02-02-PLAN.md — safeStorageCache.ts prismarine-auth cache factory (encrypt+atomic-write) + authStore.ts non-secret D-16 pointer file (AUTH-04)
  - [x] 02-03-PLAN.md — AuthManager orchestrator (login/cancel/silent-refresh/logout) + IPC handler bodies + main bootstrap (redactor install, silent refresh gate) (AUTH-01, AUTH-02, AUTH-05, AUTH-06)
  - [x] 02-04-PLAN.md — Zustand auth store + LoginScreen + LoadingScreen + ErrorBanner + App.tsx state-switch + font-bold→font-semibold migration (AUTH-01, AUTH-03, AUTH-05)
  - [x] 02-05-PLAN.md — DeviceCodeModal + AccountBadge + useSkinHead hook + onDeviceCode subscription wiring (AUTH-01, AUTH-05, AUTH-06)
  - [ ] 02-06-PLAN.md — Live-endpoint manual QA checkpoint: 6-test walkthrough + MCE approval gate + sign-off commit (all 6 AUTH reqs)
**UI hint**: yes

### Phase 3: Vanilla Launch, JRE Bundling & Packaging
**Goal**: Launcher downloads/verifies vanilla 1.8.9 from Mojang, spawns the bundled Java 8 JVM, reaches the Minecraft main menu logged in with the user's real MS account, and ships as a distributable installer on Windows + macOS. All launcher-side UX (RAM slider, crash viewer, launch log stream) in place.
**Depends on**: Phase 2 (real MC access token available)
**Requirements**: LCH-01, LCH-02, LCH-03, LCH-05, LCH-06, LCH-07, JRE-01, JRE-02, JRE-03, PKG-01, PKG-02, LAUN-03, LAUN-04, LAUN-05, COMP-05
**Success Criteria** (what must be TRUE):
  1. User clicks "Play" and within ~60s (first run, full download) or ~10s (subsequent runs, cached) reaches the Minecraft 1.8.9 main menu logged in with their real Microsoft account — no offline-mode fallback, no system Java required
  2. Launcher surfaces a RAM slider (default 2GB, cap 4GB, G1GC args, tooltip explaining GC pause tradeoff); the setting persists across launcher restarts
  3. When the game process exits non-zero, the launcher displays the crash report inside the launcher UI with access tokens, JWTs, and Windows usernames redacted — verified by triggering a crash containing a known fake token and confirming the token is stripped before display *and* before copy-to-clipboard
  4. Running `electron-builder` on Windows produces an NSIS installer; running on macOS produces a DMG/ZIP — both bundle the Eclipse Temurin 8 JRE and the initial WiiWho mod jar; the bundled JRE (not any system Java) is the one that spawns
  5. All downloaded 1.8.9 libraries and the vanilla client jar are SHA1-verified against the Mojang `client.json` manifest; corrupting a cached jar and relaunching causes re-download, not a silent launch with broken files
**Plans**: 13 plans
  - [x] 03-00-phase-infrastructure-PLAN.md — Install @xmcl/core + @xmcl/installer + execa + p-queue; add shadcn Sheet/Slider/Tooltip; create fixtures; gitignore resources/
  - [x] 03-01-paths-and-redaction-PLAN.md — paths.ts (JRE-03 resolver) + redact.ts D-20 extension with sanitizeCrashReport export (COMP-05)
  - [x] 03-02-settings-store-PLAN.md — settings/store.ts schema v1 + ipc/settings.ts backed by store (LAUN-03, LAUN-04)
  - [x] 03-03-manifest-libraries-assets-PLAN.md — launch/{manifest,libraries,assets}.ts @xmcl/installer wrappers (LCH-01, LCH-02, LCH-03, SC5)
  - [x] 03-04-natives-and-args-PLAN.md — launch/natives.ts + launch/args.ts canonical vanilla 1.8.9 argv (LCH-05, LCH-06, Pitfalls 2+8)
  - [x] 03-05-spawn-e2e-PLAN.md — launch/spawn.ts execa wrapper + e2e dummy-java integration (LCH-05, LCH-07, JRE-03)
  - [x] 03-06-log-parser-crash-watch-PLAN.md — monitor/logParser + crashReport (LCH-05, LCH-07, LAUN-05, D-16, D-17)
  - [x] 03-07-renderer-settings-PLAN.md — stores/settings + RamSlider + SettingsDrawer (LAUN-03, LAUN-04, D-01, D-02, D-04, D-05, D-07)
  - [x] 03-08-renderer-game-and-crash-PLAN.md — stores/game + PlayButton + CrashViewer (LCH-05, LCH-07, LAUN-05, COMP-05 D-21)
  - [x] 03-09-preload-auth-surface-PLAN.md — preload bridge extension (game.onLog/onExited/onCrashed + logs.openCrashFolder/listCrashReports) + AuthManager.getMinecraftToken (LCH-06)
  - [x] 03-10-orchestrator-logs-app-PLAN.md — ipc/game orchestrator + ipc/logs + App.tsx wiring (LCH-01/02/03/05/06/07, LAUN-05, COMP-05)
  - [x] 03-11-windows-packaging-PLAN.md — electron-builder.yml + prefetch-jre + build-mod + Windows NSIS smoke (JRE-01, JRE-03, PKG-01)
  - [x] 03-12-macos-dmg-PLAN.md — macOS Universal DMG smoke (autonomous: false — requires Mac access) (JRE-02, PKG-02)
**UI hint**: yes

### Phase 4: Launcher UI Polish
**Goal**: Transform the functional v0.1 launcher (login → play → settings drawer) into a polished, themeable, animated experience that feels better than Lunar Client — minus the social/marketing bloat. User can pick their accent color (not locked to blue), every interaction has smooth motion, and Spotify is integrated as a launcher-side mini-player. No ads, no news feed, no concurrent-user counter, no friends list.
**Depends on**: Phase 3 (a functional launcher UI exists to polish)
**Requirements**: UI-01, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. User picks an accent color from at least 3 presets or enters a custom hex; choice applies across the launcher (buttons, focus rings, highlights) and persists across restarts.
  2. All view transitions, modal open/close, button hovers, and loading states use consistent motion (documented timing curves + durations); no janky or instant state-swap remains for primary interactions.
  3. Main launcher surface uses sidebar navigation with sections at minimum: Play, Settings, Account, Cosmetics (placeholder allowed). Primary CTA is Play. No ads, news feeds, online-user counts, friends list, or marketing content anywhere in the UI — verified against a written exclusion checklist.
  4. User can connect a Spotify account via OAuth (Spotify Web API); when connected, launcher displays an embedded mini-player showing current song, album art, and play/pause/skip controls. Disconnection or offline state degrades gracefully (no crash, no error modal spam).
  5. Design system is documented in code (design tokens for color, spacing, typography, motion) and in `docs/DESIGN-SYSTEM.md` with rationale and usage examples. If Figma MCP is configured, asset/icon provenance is documented in the same file.
**Plans**: 8 plans
  - [x] 04-00-infrastructure-PLAN.md — Wave 0: install motion@^12.38.0, bundle Inter + JetBrains Mono fonts, register Spotify dev app (redirect http://127.0.0.1/callback — CORRECTS D-31), create spotify/config.ts + 12 test stubs (all UI reqs — scaffolding)
  - [ ] 04-01-tokens-and-settings-PLAN.md — Wave 1: global.css @theme full token catalog (8 accent presets, 3 durations, 2 CSS easings, layout, typography) + settings.json v1→v2 migration (theme slice) + useMotionConfig hook + runtime setAccent helper (UI-01, UI-03, UI-07)
  - [ ] 04-02-sidebar-and-main-area-PLAN.md — Wave 2: Sidebar (220px, motion layoutId pill glide) + MainArea/Play (gradient stub + PlayButton + wordmark + version) + MainArea/Cosmetics (Coming soon) + AccountBadge dropdown extension (Account settings deep-link) + delete SettingsDrawer.tsx (UI-03, UI-04, UI-05)
  - [ ] 04-03-settings-modal-chrome-PLAN.md — Wave 3: SettingsModal bottom-slide (Radix Dialog + motion forceMount per Pitfall 4) + SettingsSubSidebar (layoutId subnav pill) + GeneralPane (RamSlider migrated) + AccountPane + AboutPane (UI-03, UI-04, UI-05)
  - [ ] 04-04-theme-picker-appearance-PLAN.md — Wave 3: ThemePicker (8 presets + hex input + EyeDropper feature-probe) + AppearancePane (ThemePicker + Reduce motion select, System/On/Off) + slot into SettingsModal (UI-01, UI-03, UI-07)
  - [ ] 04-05-spotify-main-process-PLAN.md — Wave 4: spotify/{config,tokenStore,oauth,api,spotifyManager}.ts + ipc/spotify.ts + safeStorage-encrypted spotify.bin + redact.ts Bearer-token extension + preload 6th-key deliberate deviation (Pitfall 10) + wiiwho.d.ts spotify surface — includes 401 refresh-once / 429 Retry-After / 403 PREMIUM_REQUIRED handling (UI-06)
  - [ ] 04-06-spotify-renderer-ui-PLAN.md — Wave 5: useSpotifyStore (5-state machine + premiumRequired flag) + SpotifyMiniPlayer (6 visual states incl. Connect CTA / Connecting / Idle / Playing / Offline / No-Premium + album-art crossfade + context menu) + SpotifyPane + slot into Sidebar + SettingsModal (UI-06)
  - [ ] 04-07-integration-and-docs-PLAN.md — Wave 6: App.tsx rewrite (sidebar + main-area router + modal + AnimatePresence route swap) + main/index.ts wires Spotify handlers + docs/DESIGN-SYSTEM.md (all D-36 sections + UI-05 Exclusion checklist verbatim) + scripts/check-docs.mjs extension + antiBloat.test.tsx repo-wide grep + human smoke UAT checkpoint (all UI reqs — final gate)
**UI hint**: yes

### Phase 5: Forge Integration, HUD Framework & HUDs
**Goal**: Forge 1.8.9 is installed by the launcher; our mod jar is injected from the packaged installer; the HudModule framework supports FPS, Keystrokes, and CPS HUDs in-game; every feature is verified anticheat-safe on live Hypixel + BlocksMC with a throwaway MS account. Optional stretch: Spotify in-game HUD (record + keybinds) if Phase 4's launcher Spotify flow is solid.
**Depends on**: Phase 3 (vanilla launch works end-to-end); Phase 4 not a hard dependency (parallel-safe)
**Requirements**: LCH-04, MOD-05, MOD-06, HUD-01, HUD-02, HUD-03, HUD-04, COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. After clicking Play, the Minecraft log shows our mod loaded via Forge + Mixin (FMLTweaker + MixinTweaker both registered); `./gradlew build` produces the releasable mod jar that the launcher injects into `mods/`
  2. User toggles FPS counter, Keystrokes (WASD + mouse), and CPS (left + right) HUDs on/off via a config UI; each HUD is draggable on screen and both toggle state and position persist across sessions via a `configVersion`-tagged JSON schema
  3. ANTICHEAT-SAFETY.md lists all v0.1 features with an explicit pass/fail verdict against Hypixel's allowed-modifications policy; all three HUDs pass the review
  4. A throwaway Microsoft account plays ≥2 hours on Hypixel Bedwars/Skywars/lobbies with all three HUDs enabled and receives no flag, kick, or Watchdog warning; the same alt plays ≥1 hour on BlocksMC with identical result
  5. Our mod coexists with Patcher + Optifine co-installed — launcher spawns cleanly, all Mixins apply, no silent `@Redirect` no-ops, no `MixinApplyError`
**Plans**: TBD
**UI hint**: yes

### Phase 6: Cosmetics Pipeline (Placeholder Cape)
**Goal**: Prove the cosmetics rendering pipeline end-to-end with one baked-in placeholder cape keyed to the user's Minecraft UUID — the art is a placeholder; the pipeline is real and ready for v0.3 backend integration.
**Depends on**: Phase 5 (mod loads, Mixin framework active)
**Requirements**: COSM-01, COSM-02
**Success Criteria** (what must be TRUE):
  1. One placeholder cape (original art or documented CC0, provenance recorded in `docs/asset-provenance.md`) is bundled inside the WiiWho mod jar as a client-side resource
  2. On a real Hypixel server (not just dev preview), when the logged-in user has the cosmetic enabled, the placeholder cape renders on their player model via our Mixin into `LayerCape` — verified by a second account watching the first
  3. The cosmetic pipeline exposes a `loadForUUID()` stub suitable for future backend integration — no backend call in v0.1, but the architecture is in place

**Plans**: TBD

### Phase 7: Performance (Beats Optifine)
**Goal**: Deliver the only v0.1 differentiator — measurably beat Optifine (and ideally Optifine+Patcher) on a published, reproducible benchmark. Methodology committed BEFORE any optimization.
**Depends on**: Phase 6 (full mod stack, HUDs + cosmetics, in place so we measure against a realistic baseline)
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. `benchmarks/reference-scene.md` is committed to the repo BEFORE the first optimization PR: documents reference world seed + spawn coords + render distance + sunrise lock + windowed/fullscreen + Vsync state + 60s warmup + 120s sample window + machine profile template
  2. Baseline frametime measurements (mean FPS, p50, p95, p99) exist for vanilla 1.8.9, Optifine 1.8.9, and Optifine+Patcher on the reference scene — three separate machines, variance documented
  3. With the WiiWho mod loaded, the benchmark shows WiiWho equalling or exceeding Optifine on both mean FPS and p99 frametime on all three reference machines; no p99 regression vs baseline; no crash or silent Mixin-skip when Patcher + Optifine are co-installed

**Plans**: TBD

### Phase 8: v0.1 Release Hardening
**Goal**: Verify every critical and moderate pitfall before distribution. This is a gate, not polish.
**Depends on**: Phase 7
**Requirements**: PKG-03
**Success Criteria** (what must be TRUE):
  1. Clean-machine install test passes on both Windows (no Java, no Node, no prior Minecraft) and macOS (no Java, no Node, right-click-Open workaround documented with screenshots) — user logs in with MS, launches 1.8.9, reaches main menu
  2. Full "looks-done-but-isn't" checklist signed off: 7-day MS token refresh, XSTS error translations, Patcher + Optifine coexistence, 2hr Hypixel alt test re-run, BlocksMC alt re-run, crash sanitization smoke test, filesystem check for token leaks, vanilla jar SHA1 verified, log rotation bounded over 1000 simulated launches, config v0.1→hypothetical v0.2 migration dry-run passes
  3. v0.1 installer distributed to the small-group target audience; no installation-blocking bug reports in the first week
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations | 0/5 | Not started | - |
| 2. Microsoft Authentication | 0/7 | Not started | - |
| 3. Vanilla Launch, JRE Bundling & Packaging | 0/TBD | Not started | - |
| 4. Launcher UI Polish | 0/8 | Not started | - |
| 5. Forge Integration, HUD Framework & HUDs | 0/TBD | Not started | - |
| 6. Cosmetics Pipeline (Placeholder Cape) | 0/TBD | Not started | - |
| 7. Performance (Beats Optifine) | 0/TBD | Not started | - |
| 8. v0.1 Release Hardening | 0/TBD | Not started | - |
