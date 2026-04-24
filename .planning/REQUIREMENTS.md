# Requirements: WiiWho Client

**Defined:** 2026-04-20
**Core Value:** A single-click path from "open launcher" to "in a 1.8.9 game that runs faster than Optifine and has the HUD I want" — all without tripping PvP server anticheats.

## v1 Requirements

Requirements for v0.1 release. Each maps to exactly one roadmap phase.

### Launcher

- [x] **LAUN-01**: User can open the WiiWho launcher as a packaged desktop app (Electron)
- [x] **LAUN-02**: Launcher renders a React UI with a visible "Play" button as the primary action
- [x] **LAUN-03**: User can adjust allocated RAM (JVM heap) via a slider before launch, within a sane min/max range
- [x] **LAUN-04**: User's RAM setting persists across launcher restarts
- [x] **LAUN-05**: When a launched game process crashes, the launcher surfaces the crash log in a viewer inside the launcher UI (no hunting through files)
- [x] **LAUN-06**: Launcher follows Electron security best practices (contextIsolation on, nodeIntegration off, sandbox, preload bridge for IPC)

### Launcher UI (Polish)

- [ ] **UI-01**: User can pick a primary accent color (at least 3 presets + custom hex input); selected color is applied across the launcher (buttons, focus rings, highlights, active states) and persists across restarts
- [ ] **UI-03**: View transitions, modal open/close, button hovers, and loading/progress states use consistent animations with documented timing curves and durations (no instant or janky state swaps for primary interactions)
- [ ] **UI-04**: Main launcher surface uses sidebar navigation with sections at minimum: Play, Settings, Account, Cosmetics (placeholder acceptable). Primary CTA is Play.
- [ ] **UI-05**: Launcher does NOT display: ads, news feeds, concurrent-user counts, friends lists, or marketing content. Verified against a written exclusion checklist in `docs/DESIGN-SYSTEM.md`.
- [ ] **UI-06**: User can connect a Spotify account via OAuth (Spotify Web API). When connected, launcher displays an embedded mini-player (current song, album art, play/pause/skip). Disconnection/offline state degrades gracefully (no crash, no error modal spam).
- [ ] **UI-07**: Design system is documented — design tokens (color, spacing, typography, motion) live in code; `docs/DESIGN-SYSTEM.md` captures rationale, usage examples, and (if Figma MCP is configured) asset/icon provenance.

### Authentication

- [x] **AUTH-01**: User can log in with a Microsoft account via MSAL device code flow from inside the launcher
- [x] **AUTH-02**: Launcher completes the full Microsoft → Xbox Live → XSTS → Minecraft access token chain and validates game ownership
- [x] **AUTH-03**: Launcher translates common XSTS/auth error codes into readable messages (e.g. "no Xbox account", "under-18 without parental linkage", "banned from Xbox Live")
- [x] **AUTH-04**: User's refresh token is stored in the OS keychain (Electron safeStorage), never in plaintext JSON
- [x] **AUTH-05**: User's Minecraft username + UUID are displayed in the launcher after login
- [x] **AUTH-06**: User can log out, which clears the stored refresh token and returns to the login screen

### Launch Flow

- [x] **LCH-01**: On first launch, launcher downloads vanilla Minecraft 1.8.9 client jar from the Mojang version manifest and verifies its SHA1 against the manifest
- [x] **LCH-02**: Launcher downloads and verifies all 1.8.9 libraries and the asset index against the Mojang manifest
- [x] **LCH-03**: Downloaded jars and libraries are cached locally and reused on subsequent launches (no redundant downloads)
- [ ] **LCH-04**: Launcher injects the WiiWho Forge mod into the classpath / mods directory before launch
- [x] **LCH-05**: Launcher spawns the bundled Java 8 JVM with the correct classpath, tweakClass chain, user-selected heap size, auth tokens, and game args; Minecraft 1.8.9 window opens to the main menu
- [x] **LCH-06**: User reaches the Minecraft main menu logged in with their real Microsoft account (no offline mode)
- [x] **LCH-07**: Launcher captures the JVM process stdout/stderr and displays relevant lines during launch for troubleshooting

### JRE Bundling

- [x] **JRE-01**: Launcher installer for Windows includes an Eclipse Temurin Java 8 JRE, no user-side Java install required
- [ ] **JRE-02**: Launcher installer for macOS includes an Eclipse Temurin Java 8 JRE, no user-side Java install required
- [x] **JRE-03**: On launch, launcher spawns the bundled JRE (not any system-installed Java) via a known resource path

### Mod Loader (Forge)

- [x] **MOD-01**: Project contains a Forge 1.8.9 mod scaffold using the modern community toolchain (`gg.essential.loom` + Gradle 7.6 + dual JDK17-host/Java8-target)
- [x] **MOD-02**: Running `./gradlew runClient` launches a dev Minecraft 1.8.9 with the WiiWho mod loaded and a real Microsoft login (via DevAuth) for anticheat testing
- [x] **MOD-03**: Mod has a generic, non-feature-descriptive MODID (to avoid Hypixel Forge-handshake blacklisting)
- [x] **MOD-04**: Mod includes a Mixin bootstrap pinned to the version compatible with Forge 1.8.9 + LaunchWrapper (Mixin 0.7.11-SNAPSHOT)
- [ ] **MOD-05**: Mod builds a releaseable jar via `./gradlew build`, which the launcher then injects at launch time
- [ ] **MOD-06**: Mod provides a reusable HUD framework (base class + registration + toggle + render-order handling) that any HUD feature can extend

### HUD Features

- [ ] **HUD-01**: FPS counter HUD displays live frames-per-second on screen, togglable by the user, read-only (no packet interaction)
- [ ] **HUD-02**: Keystrokes HUD displays live WASD + mouse-button state overlay, togglable by the user, read-only
- [ ] **HUD-03**: CPS counter HUD displays clicks-per-second (left and right), togglable by the user, read-only
- [ ] **HUD-04**: Each HUD's position on screen is adjustable by the user and persists across sessions

### Performance

- [ ] **PERF-01**: A documented, reproducible FPS benchmark (reference scene, hardware profile, duration, Vsync/fullscreen settings, both mean and p99 frametime) is committed to the repo before any optimization work begins
- [ ] **PERF-02**: WiiWho's reference benchmark measures both mean FPS and p99 frametime against vanilla 1.8.9 + Optifine 1.8.9 + Optifine with Patcher on the same reference scene
- [ ] **PERF-03**: With the WiiWho mod loaded, the reference benchmark shows WiiWho equalling or exceeding Optifine (and ideally Optifine + Patcher) on both mean FPS and p99 frametime

### Cosmetics

- [ ] **COSM-01**: One placeholder cape is bundled with the WiiWho mod (client-side, not backend-served)
- [ ] **COSM-02**: The placeholder cape renders on the user's player model in-game when enabled, proving the cosmetics rendering pipeline end-to-end

### Packaging

- [x] **PKG-01**: `electron-builder` produces a distributable Windows installer (NSIS or portable) that bundles the launcher, the JRE, and the initial WiiWho mod jar
- [ ] **PKG-02**: `electron-builder` produces a distributable macOS app bundle that bundles the launcher, the JRE, and the initial WiiWho mod jar (unsigned is acceptable for v0.1; right-click-Open workaround documented)
- [ ] **PKG-03**: A clean machine (no Java, no Node, no prior Minecraft install) can run the installer, log in with Microsoft, and launch 1.8.9 successfully — Windows and macOS both verified

### Compliance (Anticheat + Legal)

- [ ] **COMP-01**: Every v0.1 feature is reviewed against Hypixel's published allowed-mods policy and receives an explicit pass/fail verdict before ship; all v0.1 features pass
- [ ] **COMP-02**: Before release, a throwaway Microsoft account plays ≥2 hours on Hypixel with all WiiWho features enabled and is not flagged, banned, or warned by Watchdog
- [ ] **COMP-03**: Before release, the same alt-account test is repeated on BlocksMC (≥1 hour) with no flag/ban/warning
- [x] **COMP-04**: WiiWho does not redistribute any Minecraft asset; launcher downloads the vanilla jar and libraries directly from Mojang at runtime
- [x] **COMP-05**: Crash logs shown in the launcher and any logs written to disk have the user's Microsoft access token, refresh token, and username redacted (no PII leak via crash-sharing)

## v2 Requirements

Deferred to v0.2+. Tracked but not in current roadmap.

### HUD Pack (v0.2 quick-win)

- **HUD-10**: Armor HUD (equipped armor + durability near hotbar)
- **HUD-11**: Potion HUD (active potion effects)
- **HUD-12**: Coordinates/direction overlay (XYZ + cardinal)
- **HUD-13**: Zoom key
- **HUD-14**: Toggle sprint / toggle sneak
- **HUD-15**: Custom crosshair
- **HUD-16**: Fullbright
- **HUD-17**: FOV extension

### Differentiation (v0.3)

- **COSM-10**: Real cosmetics catalogue (multiple capes + hats)
- **COSM-11**: Cosmetics backend service (decision gate — client-side-only-forever vs server-backed)
- **SOCL-01**: Discord Rich Presence
- **LAUN-10**: Mod profiles (different feature bundles per server)
- **LAUN-11**: AutoGG opt-in (default off) with explicit warning

### Infrastructure (v0.4+)

- **SRV-01**: Server browser / favorites list
- **UPD-01**: Auto-updater (electron-updater)
- **CRASH-01**: Crash reporter that can upload (with user consent + PII redaction)
- **SIGN-01**: Signed Windows installer (EV certificate) + notarized macOS bundle
- **PLAT-01**: Linux packaging
- **VER-01**: Multi-version support (1.7.10, modern versions)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Minecraft versions other than 1.8.9 | Project-wide lock — 1.8.9 is the PvP standard; expanding now doubles toolchain complexity |
| Reach display / hitbox display | Hypixel explicit policy ban — would get users banned, regardless of implementation |
| Minimap (any kind) | Hypixel banned minimaps entirely (not just entity-showing ones); project never ships one |
| Freelook | Hypixel policy ban |
| Any client-side physics / input automation | Watchdog-detectable + ethical line |
| Combat mods (auto-click, auto-potion, aim assist) | Cheats — explicit project non-goal |
| Cracked-account support | Non-goal — Microsoft auth only |
| Cosmetics backend / real catalogue (v0.1) | Deferred to v0.3; v0.1 proves pipeline with placeholder |
| Server browser / favorites (v0.1) | Deferred to v0.4+ |
| Auto-update / signed installers (v0.1) | Deferred; v0.1 is personal + small-group use |
| Crash uploader (v0.1) | Deferred; v0.1 shows crash locally only |
| Linux packaging (v0.1) | Not a v0.1 platform — Windows + macOS only |
| Armor HUD / Potion HUD / Coordinates / Minimap / Zoom / Toggle-sprint | Deferred to v0.2 HUD Pack to keep v0.1 tight |
| Public auto-signing / SmartScreen-cleared installer | Deferred; requires EV cert + reputation history |
| Redistribution of Minecraft jars or assets | EULA violation — launcher downloads at runtime |
| Monetization of Mojang-derived assets | EULA violation — only WiiWho-authored content could ever be monetized |
| License decision (MIT/GPL/proprietary) | Deferred until before public release |

## Anti-Features (explicit warnings)

These are not merely deferred — they are never to be built. Moving any of these to Active requires rewriting PROJECT.md's non-goals.

| Anti-feature | Why it's banned |
|--------------|-----------------|
| Reach display | Hypixel policy; banned regardless of how it's implemented |
| Freelook | Hypixel policy |
| Hitbox overlays | Hypixel policy |
| Block/entity ESP | Cheat — Watchdog-detectable, ethical line |
| Any combat automation | Cheat — Watchdog-detectable, ethical line |
| Packet modification | Watchdog-detectable; also risks bans even for "safe" packets |
| Anything that reads NBT to cue combat decisions | Gray-zone; project stays far from the line |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAUN-01 | Phase 1 | Complete |
| LAUN-02 | Phase 1 | Complete |
| LAUN-03 | Phase 3 | Complete |
| LAUN-04 | Phase 3 | Complete |
| LAUN-05 | Phase 3 | Complete |
| LAUN-06 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| LCH-01 | Phase 3 | Complete |
| LCH-02 | Phase 3 | Complete |
| LCH-03 | Phase 3 | Complete |
| LCH-04 | Phase 5 | Pending |
| LCH-05 | Phase 3 | Complete |
| LCH-06 | Phase 3 | Complete |
| LCH-07 | Phase 3 | Complete |
| JRE-01 | Phase 3 | Complete |
| JRE-02 | Phase 3 | Pending |
| JRE-03 | Phase 3 | Complete |
| MOD-01 | Phase 1 | Complete |
| MOD-02 | Phase 1 | Complete |
| MOD-03 | Phase 1 | Complete |
| MOD-04 | Phase 1 | Complete |
| MOD-05 | Phase 5 | Pending |
| MOD-06 | Phase 5 | Pending |
| HUD-01 | Phase 5 | Pending |
| HUD-02 | Phase 5 | Pending |
| HUD-03 | Phase 5 | Pending |
| HUD-04 | Phase 5 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| UI-06 | Phase 4 | Pending |
| UI-07 | Phase 4 | Pending |
| PERF-01 | Phase 7 | Pending |
| PERF-02 | Phase 7 | Pending |
| PERF-03 | Phase 7 | Pending |
| COSM-01 | Phase 6 | Pending |
| COSM-02 | Phase 6 | Pending |
| PKG-01 | Phase 3 | Complete |
| PKG-02 | Phase 3 | Pending |
| PKG-03 | Phase 8 | Pending |
| COMP-01 | Phase 5 | Pending |
| COMP-02 | Phase 5 | Pending |
| COMP-03 | Phase 5 | Pending |
| COMP-04 | Phase 1 | Complete |
| COMP-05 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51 (100%)
- Unmapped: 0

**Per-phase distribution:**
- Phase 1 (Foundations): 8 requirements — COMP-04, MOD-01, MOD-02, MOD-03, MOD-04, LAUN-01, LAUN-02, LAUN-06
- Phase 2 (Microsoft Auth): 6 requirements — AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
- Phase 3 (Vanilla Launch, JRE, Packaging): 15 requirements — LCH-01, LCH-02, LCH-03, LCH-05, LCH-06, LCH-07, JRE-01, JRE-02, JRE-03, PKG-01, PKG-02, LAUN-03, LAUN-04, LAUN-05, COMP-05
- Phase 4 (Launcher UI Polish): 6 requirements — UI-01, UI-03, UI-04, UI-05, UI-06, UI-07
- Phase 5 (Forge Integration, HUD Framework, HUDs): 10 requirements — LCH-04, MOD-05, MOD-06, HUD-01, HUD-02, HUD-03, HUD-04, COMP-01, COMP-02, COMP-03
- Phase 6 (Cosmetics Pipeline): 2 requirements — COSM-01, COSM-02
- Phase 7 (Performance): 3 requirements — PERF-01, PERF-02, PERF-03
- Phase 8 (Release Hardening): 1 requirement — PKG-03

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-23 — dropped UI-02 (dark/light mode toggle) per Phase 4 CONTEXT.md E-01; owner wants dark-only. Total drops to 51 requirements.*
*2026-04-23 — inserted Phase 4 "Launcher UI Polish" (UI-01..07); renumbered Forge/HUDs→5, Cosmetics→6, Performance→7, Release Hardening→8*
