# Project Research Summary

**Project:** WiiWho Client
**Domain:** Custom Minecraft 1.8.9 client -- desktop launcher + Forge mod (Lunar-class)
**Researched:** 2026-04-20
**Confidence:** HIGH

## Executive Summary

WiiWho Client is a two-component product: an Electron desktop launcher that handles authentication, downloads, and JVM orchestration, and a Forge 1.8.9 mod that delivers in-game QoL features and performance improvements. These two components run as entirely separate processes -- the launcher spawns the JVM, pipes its stdout/stderr for monitoring, and exits the relationship there. This separation is foundational: launcher tech choices have zero FPS impact, Electron memory footprint never competes with the Java heap, and crashes are isolated. Every major commercial client (Lunar, Badlion, Feather) uses this same two-process model, and the research confirms it is the correct architecture.

The recommended approach is to adopt proven, well-maintained tools at every layer rather than fighting legacy tooling. On the launcher side this means a current Electron 41 + Vite + React 19 + TypeScript stack, identical to what Lunar uses with strong 2026 documentation. On the game-client side, the critical insight is that the original ForgeGradle 2.1 build system is abandoned and broken on all modern tooling -- the correct path is the gg.essential.loom + Gradle 7.6 + Mixin 0.7.11-SNAPSHOT stack used by every serious 1.8.9 mod shipped in the last three years (SkyHanni, Skytils, Essential). Starting from nea89o/Forge1.8.9Template saves a week of build-system archaeology and gets directly to feature work.

The dominant risks are: (1) anticheat safety -- a single Watchdog ban on the owner account is project-ending; (2) Microsoft auth complexity -- the four-step MS->XBL->XSTS->Minecraft token chain has multiple failure modes and must be handled robustly from day one; (3) the beats-Optifine performance claim -- the only v0.1 differentiator, requires a defined reproducible benchmark methodology before writing a single optimization or the claim evaporates publicly. All three are preventable with explicit process gates in the phase structure.

## Key Findings

### Recommended Stack

The launcher is a fully modern stack with no legacy constraints: **Electron 41** (current stable, Windows 10+ / macOS 12+), **Vite 6 + electron-vite** for bundling, **React 19 + TypeScript 5.6+** for the renderer, **Tailwind v4 + shadcn/ui** for styling, **Zustand 5** for state, **@azure/msal-node 4.x** (main process only, never msal-browser) + **prismarine-auth 3.1.1** for the full MS->Minecraft auth chain, **@xmcl/core + @xmcl/installer** for manifest + download orchestration, and **electron-builder 26.8.2** for packaging with bundled **Eclipse Temurin 8 JRE**.

The game-client toolchain is deliberately frozen but uses the community-maintained modern path: **gg.essential.loom 1.6.x** on **Gradle 7.6.x** with **Java 17 running Gradle** but **Java 8 compile target**. Mixin is locked to **0.7.11-SNAPSHOT** paired with **MixinGradle 0.6-SNAPSHOT** -- Mixin 0.8+ targets ModLauncher, not LaunchWrapper, and silently fails on 1.8.9. Forge version is the final 1.8.9 build: **11.15.1.2318-1.8.9**. MCP mappings are frozen at **stable_22**.

**Core technologies:**
- **Electron 41 + electron-vite**: Desktop shell with main/renderer/preload split -- current stable, same as Lunar
- **@azure/msal-node + prismarine-auth**: Full MS OAuth + XBL + XSTS + Minecraft token chain -- MSAL handles step 1, prismarine-auth wraps the bespoke downstream exchange
- **@xmcl/core + @xmcl/installer**: Mojang manifest parsing, SHA1-verified library downloads, classpath assembly -- saves months of reimplementing format
- **gg.essential.loom + Gradle 7.6**: Modern build system for 1.8.9 Forge -- replaces broken ForgeGradle 2.1; used by every serious 1.8.9 mod in 2026
- **Mixin 0.7.11-SNAPSHOT + MixinGradle 0.6-SNAPSHOT**: Bytecode manipulation locked to LaunchWrapper-compatible version -- 0.8+ is a silent wrong choice
- **Eclipse Temurin 8 JRE**: Bundled Java 8 runtime via extraResources -- eliminates the number one user install friction point
- **execa 9.x**: Typed subprocess spawning with streaming stdout/stderr -- required for crash log capture; never use child_process.exec (buffers, truncates)
- **p-queue 8.x**: Download concurrency throttling -- Mojang CDN penalizes >10 concurrent connections

### Expected Features

The locked v0.1 scope is validated by research as genuinely minimal for a Lunar-alternative-shaped product. Every v0.1 item is table stakes; the only differentiator is the performance claim.

**Must have (table stakes -- v0.1):**
- Microsoft OAuth login with persisted account (device code flow, OS-keychain token storage)
- One-click launch: download + verify vanilla jar, inject Forge mod, spawn JVM
- Bundled Java 8 JRE -- removes the number one user install friction point
- RAM allocation slider (JVM heap control)
- Crash log viewer -- Forge 1.8.9 crashes frequently; users need diagnostics
- FPS counter, Keystrokes HUD, CPS counter -- the baseline PvP HUD trio
- Placeholder cape -- proves the cosmetics rendering pipeline end-to-end
- Windows + macOS packaging

**Should have (differentiator -- v0.1):**
- FPS performance measurably faster than Optifine on a reference benchmark -- the only v0.1 differentiator

**Should have (competitive -- v0.2):**
- Armor HUD, Potion Effects HUD, Coordinates overlay (table-stakes PvP HUDs deferred to keep v0.1 tight)
- Zoom mod, Toggle sprint/sneak, Custom crosshair, Fullbright (gamma clamp), FOV slider extension
- Custom scoreboard (hide numbers, reposition)

**Defer (v0.3+):**
- Discord Rich Presence, Mod profiles, 1.7 animations, Motion blur, AutoGG (opt-in, use-at-own-risk label)
- Cosmetics backend decision + real catalogue
- Chat improvements, Better tab list

**Defer (v0.4+):**
- Friends/party system, Proximity voice chat, Replay Mod, Screenshot uploader, Server browser

**Never build (anti-features):**
- Minimap -- explicitly banned on Hypixel regardless of implementation
- Reach display, Hitboxes overlay -- anticheat-hostile
- Any packet modification, auto-click, auto-sprint, velocity modification -- instant ban vectors
- Cracked account support, Optifine bundling (license violation), Mojang texture-derived cosmetics

### Architecture Approach

WiiWho is two independent processes connected by a one-way channel. The launcher (Electron) spawns the game (Java 8 JVM) via child_process.spawn with a precisely constructed argument list, then monitors stdout/stderr line-by-line for state events. All durable state lives in the Electron main process; the React renderer is a pure view communicating through a narrow contextBridge IPC surface. The mod uses a feature-module pattern -- each HUD is a self-contained class with its own config slice and event subscriptions, managed by a central ModuleManager. This is the Patcher/Lunar/Feather pattern and makes v0.2 HUD additions a new folder rather than a diff across five files.

**Major components:**
1. **Launcher -- Main process** (Node.js): auth chain, manifest/library/asset downloads, JVM spawn, stdout parser, crash-report watcher, settings persistence
2. **Launcher -- Renderer process** (React + Zustand): login screen, play button, download progress, crash viewer -- pure view, no direct state ownership
3. **Launcher -- Preload bridge** (contextBridge): narrow typed API exposing only auth.*, game.*, settings.* -- the entire attack surface
4. **Bundled JRE** (Temurin 8): shipped via electron-builder extraResources; never assumed present on user system
5. **Forge + LaunchWrapper**: bootstraps mod environment; --tweakClass list adds FMLTweaker and MixinTweaker
6. **Mod -- HudModule system**: base class + ModuleManager pattern; FPS/Keystrokes/CPS in v0.1, extensible to all v0.2+ HUDs
7. **Mod -- Mixin package**: bytecode patches for perf hotspots and cape rendering; minimal (Forge events first, Mixin as last resort)
8. **On-disk state**: Mojang-standard game/ directory layout shared between processes via file format contracts -- no shared code

### Critical Pitfalls

1. **Legacy ForgeGradle 2.1 toolchain** -- Do not use it. IntelliJ 2022.2+ dropped Gradle <4.5, Forge removed its 1.8.9 pre-built jars, Gradle 8 breaks with configuration-not-found errors. Start from nea89o/Forge1.8.9Template (gg.essential.loom + Gradle 7.6) and never upgrade the Gradle wrapper during a milestone.

2. **Anticheat-unsafe features shipped without review** -- Any feature touching packets, reading other players state, or automating input can trigger a permanent Watchdog IP ban. Establish a mandatory anticheat sign-off checklist (ANTICHEAT-SAFETY.md) before the first in-game feature ships. Minimap, reach display, hitboxes, packet mods, auto-sprint, auto-click are permanent never-list items.

3. **Microsoft auth token chain mishandled** -- The chain is MS OAuth -> XBL -> XSTS -> Minecraft Services (four steps; MSAL only handles step 1). Refresh tokens must be in the OS keychain via safeStorage, never plaintext JSON. XSTS error codes must be translated to user-facing messages. Register your own Azure AD app -- never copy another launcher client ID (Microsoft will revoke it and break every user simultaneously).

4. **Mixin version or conflict issues** -- Mixin 0.8+ silently fails on 1.8.9 (LaunchWrapper does not support it). Multiple mods using @Redirect on the same method produces silent no-ops. Prefer @Inject over @Redirect. Test with Patcher + Optifine co-installed before every release. @Overwrite must not appear in the codebase.

5. **Beats-Optifine claim without reproducible benchmark** -- Without a committed reference scene, frametime percentile reporting (p50/p95/p99 -- not average FPS), and 3-machine reproduction, the claim evaporates publicly and damages trust more than no claim at all.

## Implications for Roadmap

Based on research, suggested phase structure (11 phases following the critical path from ARCHITECTURE.md):

---

### Phase 0: Legal + Policy Baseline
**Rationale:** Three project-ending risks (Mojang EULA, Hypixel anticheat, Electron security model) require explicit decisions before any code is written. Cheap as documentation; catastrophic to retrofit.
**Delivers:** ANTICHEAT-SAFETY.md template with review checklist; documented Mojang asset policy (no redistribution, original art only); Azure AD app registered with Minecraft API scope (submit immediately -- queue takes up to a week); placeholder cape art provenance documented (original or CC0)
**Avoids:** Pitfalls 2 (anticheat), 3 (legal/EULA), 5 (RCE via JVM args), 8 (crash report PII)
**Research flag:** Standard -- decisions are clear from research; no deeper research needed

### Phase 1: Mod Scaffold (Forge 1.8.9 + Mixin bootstrap)
**Rationale:** The 1.8.9 Forge toolchain is the highest-risk unknown in the project. Validating it on both platforms before any launcher work de-risks the single most schedule-threatening build-system trap.
**Delivers:** Working dev environment from nea89o/Forge1.8.9Template; dual JDK setup (Gradle on 17, compile target 8); first Mixin compiles and applies; MODID collision-checked against CurseForge/Modrinth; MCP stable_22 pinned; DevAuth wired for real-server testing
**Stack elements:** gg.essential.loom 1.6.x (confirm version from live template), Gradle 7.6.x, Mixin 0.7.11-SNAPSHOT, MixinGradle 0.6-SNAPSHOT, Forge 11.15.1.2318-1.8.9, IntelliJ IDEA
**Avoids:** Pitfalls 1 (ForgeGradle toolchain), 4 (Mixin bootstrap), 12 (MODID collision), 13 (MCP mapping drift)
**Research flag:** Standard -- use the template verbatim; do not deviate from the known-good Gradle 7.6 + loom path

### Phase 2: Launcher Skeleton (Electron + IPC scaffolding)
**Rationale:** Security posture must be locked in from day one. Retrofitting contextIsolation and sandbox onto an existing Electron app is painful; wiring it correctly at scaffold time costs nothing.
**Delivers:** electron-vite scaffold with TypeScript strict mode; contextBridge preload with named auth/game/settings APIs; BrowserWindow with nodeIntegration: false, contextIsolation: true, sandbox: true; empty React renderer with routing (Login / Home / Settings / Crash); electron-log wired; paths.ts abstracting OS-specific data directories
**Stack elements:** Electron 41, electron-vite, React 19, TypeScript 5.6, Vite 6, Zustand 5, Tailwind v4, shadcn/ui, electron-log 5.x
**Avoids:** Pitfall 5 (Electron IPC RCE), Pitfall 16 (ABI mismatch -- prefer safeStorage over keytar)
**Research flag:** Standard -- electron-vite templates are authoritative; Electron security checklist is official

### Phase 3: Microsoft Auth Flow
**Rationale:** Auth is the gate for every real game launch. Validating the four-step chain against real Microsoft endpoints before it is depended on by downstream phases surfaces known failure modes early. Azure AD app registration (started in Phase 0) must be approved before this phase begins.
**Delivers:** Device code flow with msal-node; full XBL -> XSTS -> Minecraft exchange via prismarine-auth; token in OS keychain (safeStorage); every XSTS error code translated to user-facing message; 7-day refresh tested; invalid_grant gracefully re-prompts device code
**Stack elements:** @azure/msal-node 4.x, prismarine-auth 3.1.1, Electron safeStorage API
**Avoids:** Pitfall 6 (token handling), Pitfall 5 (no auth in renderer), Pitfall 8 (token leak -- redact at logger level)
**Research flag:** Needs attention -- validate every XSTS error code against a real sandbox account; the Minecraft API permission queue can take a week so start Azure registration at Phase 0, not Phase 3.

### Phase 4: Download + Launch Vanilla 1.8.9
**Rationale:** Getting vanilla 1.8.9 launching from the bundled JRE proves the entire classpath + JVM arg construction pipeline before Forge and the mod complicate it. Can be tested with offline username first, then wired to auth.
**Delivers:** version_manifest_v2.json fetch and 1.8.9 client.json cache; SHA1-verified library + vanilla jar download with p-queue concurrency 8; natives extraction; JVM arg construction from minecraftArguments template; execa-based JVM spawn with stdout/stderr streaming; game-process state machine; crash-report watcher with PII sanitization before display
**Stack elements:** @xmcl/core, @xmcl/installer, execa 9.x, p-queue 8.x
**Avoids:** Pitfalls 8 (PII), 5 (no raw string args from UI), 17 (log rotation), 20 (launcher-mod protocol version byte)
**Research flag:** Standard -- Mojang manifest format is official and frozen for 1.8.9; @xmcl is well-documented

### Phase 5: JRE Bundling + electron-builder Packaging
**Rationale:** Packaging with the bundled JRE validates the complete install story on a clean machine. Do it before the mod is complex so the first packaged test is simple.
**Delivers:** Windows NSIS installer and macOS DMG/ZIP; Temurin 8 JRE in extraResources/jre/<platform>/; getResourcePath() helper abstracting dev vs packaged paths; multi-install test confirming no version-orphan disk leak; macOS first-launch guide for right-click-Open workaround (unsigned v0.1)
**Stack elements:** electron-builder 26.8.2, Eclipse Temurin 8 JRE (use pre-signed Temurin binaries to avoid Gatekeeper rejecting bundled JVM)
**Avoids:** Pitfall 9 (Gatekeeper -- document workaround; pre-signed JRE binaries), Pitfall 18 (installer cleanup)
**Research flag:** Standard -- electron-builder extraResources is documented; Gatekeeper limitation is known and accepted for v0.1

### Phase 6: Forge Integration + Mod Loader
**Rationale:** Bridges the launcher (downloads/verifies files) with the mod (depends on Forge). Proves the full stack end-to-end: launcher downloads Forge, JVM boots with FMLTweaker + MixinTweaker, our mod loads.
**Delivers:** Forge installer extraction (headless, no GUI); Forge libraries merged into game directory; tweakClass args for FMLTweaker + MixinTweaker; our mod JAR shipped via extraResources/mods/ and copied to game/mods/ on first run; mcmod.info metadata; confirmed mod-loaded log line
**Avoids:** Pitfall 20 (version byte in mod JAR manifest for launcher-mod version check)
**Research flag:** Standard -- Forge 1.8.9 installer mechanics are well-documented in Prism Launcher source

### Phase 7: HUD Framework + FPS/Keystrokes/CPS HUDs
**Rationale:** The HUD framework (HudModule base + ModuleManager + config singleton) is the foundation for every current and future in-game overlay. Building it correctly in v0.1 means v0.2 HUDs are each a new folder, not a refactor. All three v0.1 HUDs share the same LOW-complexity rendering pattern.
**Delivers:** HudModule abstract base; ModuleManager registry; WiiWhoConfig JSON-backed singleton with configVersion field; HudConfig per-HUD position + toggle; FPS counter, Keystrokes, CPS counter HUDs; all three verified anticheat-safe on throwaway Hypixel account over 2+ hours of play
**Avoids:** Pitfalls 2 (anticheat -- first in-game gate), 10 (configVersion in schema from day one)
**Research flag:** Standard -- HUD pattern is open source in Patcher; Forge RenderGameOverlayEvent is stable

### Phase 8: Cosmetics Pipeline + Placeholder Cape
**Rationale:** The placeholder cape proves the cosmetics rendering pipeline end-to-end (Mixin into LayerCape, texture loader, account UUID keying) before any backend or real catalogue work. The art is a placeholder; the architecture is real.
**Delivers:** CapeManager + CapeRenderer; Mixin into LayerCape to inject our texture; placeholder cape texture (original art or CC0, provenance documented); cape renders on our account UUID in a real server; loadForUUID() stub for future backend call
**Avoids:** Pitfall 19 (cosmetic asset rights), Pitfall 2 (Mixin rendering -- confirm no anticheat signal)
**Research flag:** Standard -- LayerCape Mixin pattern is used by every 1.8.9 cosmetics mod

### Phase 9: Performance Work (Beats Optifine)
**Rationale:** This is the only v0.1 differentiator and the highest-complexity item. It must come after the full stack is stable so performance is measured against a realistic baseline with HUDs and cosmetics in place, not a stripped dev build. Benchmark methodology must be committed before the first optimization PR.
**Delivers:** benchmarks/reference-scene.md committed before any optimization PR; frametime sampling (p50/p95/p99 -- not average FPS); baseline measurement with vanilla + Optifine + Patcher; WiiWho optimization passes; 3-machine reproduction confirming p95 improvement; no p99 regression; no Optifine coexistence regressions
**Avoids:** Pitfall 7 (unreproducible benchmark), Pitfall 14 (Optifine compatibility), Pitfall 15 (fullscreen vs windowed), all performance traps in PITFALLS.md
**Research flag:** Needs a dedicated /gsd:research-phase before planning. Specific render-pipeline hotspots require profiling on the reference scene before optimization decisions. Patcher source is the primary reference. Sodium backport feasibility for 1.8.9 LWJGL2 needs a spike before committing to that approach.

### Phase 10: Launcher Polish + Settings UI
**Rationale:** All functional pieces exist; this phase completes the launcher UX to match the one-click promise and addresses moderate pitfalls deferred during functional work.
**Delivers:** RAM slider (capped 4GB, default 2GB, G1GC args, tooltip explaining GC pauses); Settings screen (game directory override, theme, auto-close-on-launch); download progress bar (throttled 10Hz from p-queue events); log rotation (30 days / 100MB cap); configVersion migration tested with hypothetical v0.2 schema
**Avoids:** Pitfalls 11 (JVM heap over-allocation), 10 (config drift), 17 (log growth), UX pitfalls from PITFALLS.md
**Research flag:** Standard -- all well-understood UX patterns

### Phase 11: v0.1 Hardening + Release Prep
**Rationale:** Pre-release gates. Every item in PITFALLS.md Looks-Done-But-Isn't checklist must be verified. This is not optional polish -- the anticheat test, PII sanitization, and token storage checks are project-ending if missed.
**Delivers:** Full verification checklist: 7-day token refresh, XSTS error translations, clean-machine install on Windows + macOS, Patcher + Optifine coexistence (no crash, no silent Mixin-skip), anticheat play test (2hr Hypixel Bedwars + Skywars on throwaway account), crash sanitization smoke test, token storage filesystem check, jar integrity, log rotation stress test, ANTICHEAT-SAFETY.md signed off for all v0.1 features; v0.1 distributed to small group
**Avoids:** Every critical and moderate pitfall -- this phase is the gate
**Research flag:** Standard -- it is a verification phase, not a build phase

---

### Phase Ordering Rationale

- **Phase 0 before any code:** Three project-ending risks require policy decisions before implementation choices. Cheap as documentation; catastrophic to retrofit later.
- **Phase 1 (mod scaffold) before launcher work:** The 1.8.9 Forge toolchain is the highest-risk unknown. Validating it first unblocks all mod work and surfaces environment issues before they block a deadline.
- **Phases 2-5 (launcher) and Phases 1/6-8 (mod) are logically parallel** after their respective predecessors. A single developer runs them sequentially but they have no shared code dependencies, making them independently plannable.
- **Phase 9 (performance) last among feature phases:** Perf measurement requires the full HUD + cosmetics stack in place to represent real-world conditions, not a stripped dev build.
- **Phase 11 (hardening) as a true gate:** The PITFALLS.md verification checklist is non-negotiable. Do not combine with Phase 10 or skip because this is personal use.

### Research Flags

**Phases needing /gsd:research-phase during planning:**
- **Phase 9 (Performance work):** Specific render-pipeline hotspots must be profiled before optimization decisions. Sodium backport feasibility for LWJGL2 needs a spike. Do not plan Phase 9 without a dedicated research pass.
- **Phase 3 (Microsoft auth) -- partial:** Allocate explicit time to validate Azure AD app registration process and Minecraft API permission queue. Register the Azure app at Phase 0 start, not Phase 3 start.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Mod scaffold):** Start from nea89o/Forge1.8.9Template verbatim. Confirm loom plugin version from live template at scaffold time.
- **Phase 2 (Launcher skeleton):** electron-vite templates are authoritative; Electron security checklist is official.
- **Phase 4 (Download + launch):** Mojang manifest format is official and frozen; @xmcl is well-documented.
- **Phases 6-8 (Forge + HUD + cosmetics):** All have open-source reference implementations (Patcher for HUDs, 1.8.9 cosmetics mods for LayerCape Mixin).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Launcher stack verified against official 2026 sources. Game toolchain verified via live open-source 1.8.9 mods. Specific loom minor version should be confirmed from live template at Phase 1. |
| Features | HIGH | Feature taxonomy verified against Lunar, Badlion, Patcher. Anticheat allowances verified against official Hypixel support pages. MEDIUM for edge cases in future Hypixel policy revisions. |
| Architecture | HIGH | Component boundaries, launch lifecycle, and data flows from official Electron docs, Mojang manifest format, and Prism Launcher (open source). Lunar internal IPC is inferred from community observation, not source. |
| Pitfalls | HIGH | Critical pitfalls backed by official sources (Mojang EULA, Hypixel support, Electron security docs, Microsoft Learn). Perf trap specifics are MEDIUM -- derived from Patcher source and community gists. |

**Overall confidence:** HIGH

### Gaps to Address

- **Specific loom plugin version:** Confirm gg.essential.loom minor version against nea89o/Forge1.8.9Template settings.gradle.kts at Phase 1 execution. Do not trust the version number in STACK.md -- read the live template.
- **Performance optimization approach:** The specific render-pipeline targets for beats-Optifine require profiling on the reference scene. The decision between Mixin hotspot patches, chunk rebuild threading, and Sodium-style batching must wait for Phase 9 dedicated research pass.
- **Cosmetics backend decision (v0.3 gate):** Decide before v0.3 planning: self-hosted backend, Essential cosmetics service, or client-only forever. This gates all v0.3 cosmetics and catalogue work.
- **Licensing decision:** PROJECT.md defers this to pre-public-release. The open-source differentiator identified in FEATURES.md (auditable mod = anticheat trust = server partnerships) argues for deciding early. GPL-3.0 for the mod / private for the launcher is the most common approach in this ecosystem.
- **Azure AD app registration timing:** Submit the registration immediately -- the Minecraft API permission scope requires Microsoft review that historically takes 1-7 days. Do not wait until Phase 3.

## Sources

### Primary (HIGH confidence)
- Electron 41 release notes + endoflife.date/electron -- current stable, supported platforms confirmed
- electron-builder 26.8.2 npm -- published 2026-03-04
- Microsoft Learn: MSAL authentication flows, device code grant
- Minecraft Wiki: Microsoft authentication, version_manifest.json, client.json, .minecraft directory, launch arguments
- wiki.vg: Microsoft Authentication Scheme, Launching the game, Game files -- XSTS error codes, argument templates
- Electron docs: Process model, Context isolation, contextBridge, Security best practices, safeStorage API
- electron-builder docs: Application contents, Common configuration -- extraResources for JRE
- Hypixel support: Allowed Modifications, About Watchdog -- anticheat policy source of truth
- Mojang EULA + Usage Guidelines -- redistribution and monetization rules
- Sk1erLLC/Patcher (GitHub) -- open-source 1.8.9 Forge performance mod; primary reference implementation
- hannibal002/SkyHanni + Example-1.8.9-Mod, nea89o/Forge1.8.9Template -- live loom-based 1.8.9 build systems
- EssentialGG/essential-gradle-toolkit -- loom plugin source
- PrismarineJS/prismarine-auth 3.1.1 -- published 2026-03-31, actively maintained
- Adoptium Temurin releases -- JRE 8 availability confirmed for Windows x64, macOS x64, macOS aarch64
- PrismLauncher (GitHub) -- open-source reference launcher for launch mechanics

### Secondary (MEDIUM confidence)
- Hypixel forum threads on Gradle 8 + ForgeGradle 2.x breaks -- community evidence for toolchain pitfalls
- Hypixel forum threads on allowed mods (freelook, minimap, reach display) -- behavioral anticheat policy
- manuthebyte/template-forge-mixin-1.8.9 -- Mixin 0.7.x + MixinGradle 0.6 version confirmation
- Community gists on performance mods for 1.8.9 -- optimization technique landscape

### Tertiary (LOW confidence -- verify at execution)
- gg.essential.loom 1.6.x exact minor version -- confirm at Phase 1 from live template
- Temurin 8 JRE bundle sizes (~50-70MB) -- confirm at Phase 5 from actual downloads
- @xmcl/installer feature coverage -- verify against source during Phase 4

---
*Research completed: 2026-04-20*
*Ready for roadmap: yes*
