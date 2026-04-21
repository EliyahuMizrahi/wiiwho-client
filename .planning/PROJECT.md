# WiiWho Client

## What This Is

A custom Minecraft 1.8.9 client inspired by Lunar Client — a desktop launcher + Forge mod bundle that lets a player log in with their Microsoft account, launches an optimized 1.8.9 game, and ships with QoL mods (FPS counter, keystrokes, CPS counter) and hooks for cosmetics. Built primarily for personal and small-group use, with the long-term shape of a real Lunar-style client if the foundation holds up.

## Core Value

A single-click path from "open launcher" to "in a 1.8.9 game that runs faster than Optifine and has the HUD I want" — all without tripping PvP server anticheats.

## Requirements

### Validated

- [x] Electron + TypeScript + React launcher app — validated in Phase 1 (foundations) + Phase 2 (auth) + Phase 3 (launch/packaging)
- [x] Microsoft OAuth login (MSAL device code flow) with persisted account — validated in Phase 2
- [x] Bundled Java 8 JRE (no user-side install required) for Windows — validated in Phase 3; macOS pending PKG-02 human verification (requires Mac build machine)
- [x] RAM allocation control in launcher (JVM heap slider) — validated in Phase 3 (LAUN-03, LAUN-04)
- [x] Crash log viewer — validated in Phase 3 (LAUN-05, COMP-05); redaction pipeline pinned via D-21 single-sanitizer invariant
- [x] Vanilla-side of one-click launch — validated in Phase 3 (launcher downloads/verifies vanilla 1.8.9 jar, spawns bundled JVM, reaches main menu sentinel). Forge injection deferred to Phase 4.
- [x] Windows packaging via electron-builder (NSIS) — configuration validated in Phase 3 (PKG-01); final `.exe` pending Windows Developer Mode toggle (environmental, not code)

### Active

- [ ] One-click launch flow — full path with Forge mod injected (vanilla-side done Phase 3; Forge injection is Phase 4)
- [ ] macOS packaging via electron-builder (DMG) — config complete in Phase 3; awaiting Mac build machine
- [ ] Forge 1.8.9 mod as the in-game module (MCP mappings, Mixin for patches Forge events can't cover)
- [ ] FPS counter HUD mod — togglable, anticheat-safe
- [ ] Keystrokes HUD mod — live WASD/mouse overlay, anticheat-safe
- [ ] CPS counter HUD mod — clicks-per-second, anticheat-safe
- [ ] FPS performance work — measurably faster than Optifine on a reference 1.8.9 benchmark (approach and benchmark target to be decided by research)
- [ ] Placeholder cape cosmetic — one baked-in cape rendered via our cosmetics pipeline, proving the rendering path end-to-end
- [ ] Windows + macOS packaging via electron-builder
- [ ] All in-game features verified anticheat-safe on major 1.8.9 PvP servers (Hypixel, BlocksMC)

### Out of Scope

- Linux packaging — deferred; not a v0.1 platform
- Armor HUD / Potion HUD / Coordinates overlay — deferred to v0.2; starting with three HUDs to keep v0.1 tight
- Real cosmetics catalogue (multiple capes, hats, emotes) — v0.1 only proves the pipeline with a placeholder cape
- Cosmetics backend/API service — deferred; v0.1 cosmetics are client-side only
- Server list / server browser integration — deferred to a later milestone
- Minimap — deferred to v0.2+
- Auto-updater / signed installers / crash uploader — deferred because v0.1 is personal + small-group use
- Minecraft versions other than 1.8.9 — explicit non-goal for the whole project right now (1.8.9 is the PvP standard)
- Cheats, ghost clients, reach/aim mods — explicit non-goal, would break anticheat safety and project intent
- Cracked-account support — explicit non-goal, Microsoft auth only (Mojang auth is dead)
- Monetization of any Mojang-derived assets — explicit non-goal, EULA boundary
- Licensing decision — deferred until we get closer to any form of public release

## Context

- **Reference inspiration**: Lunar Client. Confirmed that Lunar's launcher is an Electron app (`Lunar Client.exe` is Electron 25+), which validates our launcher stack choice. In-game FPS is independent of launcher perf because the game runs in its own JVM process.
- **Why 1.8.9 only**: 1.8.9 is the PvP standard. Forge is the de facto mod standard for 1.8.9 — almost all 1.8.9 mods, mappings, and tutorials target Forge + MCP. Picking 1.8.9 locks us into a mature, stable modding toolchain.
- **Why Electron over Tauri**: Same stack as Lunar, most launcher tutorials and recipes target Electron, and launcher UI perf is irrelevant to in-game FPS.
- **Why Forge over Fabric for 1.8.9**: Fabric for 1.8.9 exists but is a niche fork; Forge is where the mapping quality, reference mods, and community knowledge live for this version.
- **Why Mixin**: Some patches (rendering hotspots, performance internals) aren't reachable through Forge's event bus. Mixin gives us targeted bytecode manipulation.
- **Anticheat reality**: 1.8.9 PvP is dominated by Hypixel and BlocksMC, both with strict anticheats. Every in-game feature must be rendering/HUD-only or read-only against game state — no packet modification, no client-side physics changes beyond rendering, no input automation.
- **Performance reality**: "Beat Optifine" is ambitious but measurable. Optifine 1.8.9 is still the reference; Patcher and Sk1er's work on 1.8.9 provide known-good techniques. Options include: backporting Sodium/Iris-style rendering, targeted Mixin hotspot patches, or reimplementing Patcher/Optifine-style fixes from scratch. Research will inform the path.
- **User profile**: Primary user is the project owner (PvP player on Windows). Small-group adoption possible ("share with friends"). Long-term aspiration is Lunar-alternative territory, but v0.1 does not need public-release infrastructure.
- **Existing repo state**: Greenfield. Only this document and CLAUDE.md exist. No code committed.

## Constraints

- **Tech stack — Launcher**: Electron + TypeScript + React, packaged with electron-builder — Lunar-aligned, mature tooling, launcher perf doesn't matter.
- **Tech stack — Game client**: Forge 1.8.9 mod, Java 8, Gradle + ForgeGradle + MCP mappings, Mixin for bytecode patches — only realistic path for 1.8.9 modding.
- **Target Minecraft version**: 1.8.9 only — project-wide lock; PvP standard and mod ecosystem is mature here.
- **Auth**: Microsoft OAuth (MSAL, device code flow) — Mojang auth is dead; cracked is out of scope.
- **Platforms (v0.1)**: Windows + macOS — owner is on Windows; Mac broadens small-group reach; Linux deferred.
- **Anticheat safety**: All in-game features must be safe on Hypixel and BlocksMC — non-negotiable; affects every rendering/HUD decision.
- **Performance target**: Measurably faster than Optifine 1.8.9 on a reference benchmark to be chosen by research — reference scene + system profile must be documented so "fast" is falsifiable.
- **Distribution model (v0.1)**: Personal + small-group use — no signed installers, no auto-update, no crash uploader required.
- **Legal**: No redistribution of Minecraft assets — launcher downloads official jars from Mojang. No monetization of Mojang-derived assets.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Minecraft 1.8.9 only | PvP standard; mature Forge/MCP ecosystem; 1.8.9 mod knowledge is well-documented | — Pending |
| Electron + TS + React launcher | Same stack as Lunar; launcher perf irrelevant to in-game FPS; mature tooling | — Pending |
| Forge + MCP (not Fabric) | Forge is the de facto 1.8.9 standard; Fabric 1.8.9 is a niche fork | — Pending |
| Mixin for bytecode patches | Needed for hotspots Forge events can't reach; standard in the 1.8.9 perf-mod world | — Pending |
| Microsoft auth (MSAL device code) only | Mojang auth dead; cracked is out of scope for this project | — Pending |
| Bundled Java 8 JRE | Zero-friction user install; matches Lunar behavior; accepts ~60-100MB install size | — Pending |
| v0.1 scope = launcher + QoL mods + perf beat-Optifine + placeholder cape | Keep it ambitious; owner accepts timeline stretches past "weekend" | — Pending |
| Windows + macOS only for v0.1 | Windows is dev machine; Mac broadens small-group reach; Linux deferred to avoid packaging tax | — Pending |
| Anticheat-safe as hard constraint | 1.8.9 PvP means Hypixel/BlocksMC; unsafe features would immediately invalidate the project | — Pending |
| Personal + small-group distribution for v0.1 | Cuts out signing, auto-update, crash uploader, support infra | — Pending |
| Perf approach (backport vs. mixin-targeted vs. patcher-style) deferred to research | Too many variables to decide in advance; research will compare FPS-per-hour-of-dev | — Pending |
| Licensing decision deferred | Not blocking v0.1; decide before any form of public release | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 after Phase 3 (vanilla launch + JRE bundling + packaging) completion. Windows launcher now downloads/verifies vanilla 1.8.9, spawns bundled Temurin 8 JRE, and reaches main-menu sentinel; NSIS config + mac Universal DMG config ready; PKG-02 awaits Mac machine. 354/354 tests green.*

**Phase 1 (foundations) shipped 2026-04-21.** Forge 1.8.9 mod scaffold (`client-mod/`) compiles and launches Minecraft 1.8.9 via DevAuth with a trivial Mixin hook confirmed firing on `Minecraft.startGame`. Electron launcher scaffold (`launcher/`) opens a hardened window (contextIsolation/sandbox/no-nodeIntegration runtime-audited) with a dead-button Play and the full v0.1 IPC surface stubbed. Azure AD app registered (`60cbce02-…`) and MCE review form submitted — approval expected by 2026-04-27. End-to-end anticheat safety validated by connecting to minemen.club (Vanicheat) as real MS user without kicks. Phase 2 (Microsoft authentication) is unblocked to plan; only external gate is the async MCE approval email.
