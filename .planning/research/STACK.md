# Stack Research

**Domain:** Custom Minecraft 1.8.9 client (Electron launcher + Forge mod, Lunar-style)
**Researched:** 2026-04-20
**Confidence:** HIGH for the launcher-side (Electron, React, MSAL, electron-builder all verified current). HIGH for the game-side toolchain (ForgeGradle 2.x / Mixin 0.7.x / Java 8 is an exhaustively locked historical stack). MEDIUM for the "which modern fork of the 1.8.9 toolchain" decision — the community-adopted `architectury-loom` via `gg.essential.loom` exists and is what serious 1.8.9 mods (SkyHanni, Skytils, Essential itself) use in 2026, but it is a Essential-owned fork, not vanilla ForgeGradle.

## Executive Recommendation

**Two fundamentally separate toolchains:** the launcher (modern, current versions, no legacy lock-in) and the game mod (frozen in 2016-era tooling with known community-maintained forks).

For the launcher, adopt a **current, boring, Electron 41 + Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + Zustand + MSAL Node** stack. All of these have authoritative 2026 sources and zero legacy constraints.

For the game mod, **do not write your own ForgeGradle 2.1-SNAPSHOT build from scratch** — that path is officially deprecated (IntelliJ dropped Gradle <4.5 support, Forge removed original jars from the repo, ForgeGradle 2.x plugin breaks on Gradle 6+). Instead adopt the **Essential/SkyHanni toolchain**: `gg.essential.loom` (architectury-loom fork) + Mixin `0.7.11-SNAPSHOT` + MixinGradle `0.6-SNAPSHOT` on **Gradle 7.6.x** with Java 17 invoking Java 8 compilation. This is the live, in-use build system for every serious 1.8.9 mod shipped in the last three years.

For the JRE bundle, ship **Eclipse Temurin 8 JRE** (latest 8u4xx release) — Lunar Client uses Azul Zulu, Temurin is the larger-footprint-but-more-broadly-tested choice, and neither will give meaningfully different in-game FPS for 1.8.9.

## Recommended Stack

### Core Technologies — Launcher

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Electron** | 41.2.1 | Desktop shell | Current stable as of 2026-04-16; bundles Chromium 146 / Node 24 / V8 14.6; supports Windows 10+ and macOS Monterey (12.0)+, which matches the v0.1 platform target. Electron follows an 8-week major cadence and supports latest 3 majors (41, 40, 39 in April 2026) — staying on latest avoids falling out of support. |
| **Node.js** | 22 LTS | Build toolchain + Electron main | Electron's npm ecosystem repos moved to Node 22 as min supported in early 2025. Don't use Node 24 as your dev-side Node even though Electron bundles it — stick to 22 LTS for `@electron/*` tooling compatibility. |
| **TypeScript** | 5.6+ | Type safety across main + renderer | Non-negotiable for a production launcher. Use strict mode. `moduleResolution: "bundler"` for Vite. |
| **React** | 19.x | Renderer UI | Current stable; works with Vite React plugin and Tailwind v4. |
| **Vite** | 6.x | Dev server + bundler for renderer | Industry standard for React in 2026. Integrates with `electron-vite` wrapper for Electron-specific main/preload/renderer split. |
| **electron-vite** | latest | Electron build orchestration | Handles the main/preload/renderer triple-build, HMR, TypeScript, source maps. Reference templates (GeorgiMY/Vite-Electron-Template) prove this stack works with React 19 + Tailwind v4 + shadcn/ui as of 2026. |
| **electron-builder** | 26.8.2 | Packaging & distribution | Current as of 2026-03-04. Produces Windows NSIS installers and macOS DMG/ZIP. Supports `extraResources` for bundling the JRE alongside the app. |

### Core Technologies — Game Mod (1.8.9 Forge)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Java** | OpenJDK 8 (Temurin 8u4xx) for compile; OpenJDK 17 for running Gradle | Build + runtime for the mod | Minecraft 1.8.9 requires Java 8 at runtime — non-negotiable. Modern Gradle (7.6+) requires Java 11+ to run the daemon, so the build setup is: Gradle runs on Java 17, compiles bytecode targeting Java 8. This dual-JDK pattern is explicit in the Essential/SkyHanni/nea89o templates. |
| **Gradle** | 7.6.x (via wrapper) | Build system | **7.6 is the sweet spot**: new enough to be supported by current IntelliJ and Essential's fork of architectury-loom, old enough to be compatible with MixinGradle 0.6-SNAPSHOT. Do NOT use 8.x directly — community experience (Hypixel forum, 2024) shows `Configuration with name 'compile' not found` errors on Gradle 8 with the legacy plugin chain. |
| **gg.essential.loom** | 1.6.x (latest) | Gradle plugin (replaces ForgeGradle) | This is a **fork of architectury-loom maintained by the Essential team**. It is what Essential, SkyHanni, Skytils, nea89o/Forge1.8.9Template, and hannibal002/Example-1.8.9-Mod all use as of 2026. It replaces the original `net.minecraftforge.gradle:ForgeGradle:2.1-SNAPSHOT` path entirely and fixes it to work with modern Gradle/IntelliJ. |
| **essential-gradle-toolkit** | latest | Gradle plugin utility layer on top of loom | Provides `gg.essential.defaults`, `gg.essential.defaults.loom`, `gg.essential.multi-version` — opinionated defaults for Minecraft modding including Mixin wiring, mappings, and dev auth. Reduces per-project boilerplate. Not strictly required but everyone in the 1.8.9 world uses it. |
| **Mixin (SpongePowered)** | 0.7.11-SNAPSHOT | Bytecode manipulation framework | **Locked to 0.7.x for 1.8.9.** Mixin 0.8+ targets Minecraft 1.13+ (ModLauncher); 1.8.9 uses LaunchWrapper which only 0.7.x supports. 0.7.11-SNAPSHOT is the canonical version pulled from `https://repo.spongepowered.org/maven` by every 1.8.9 mod. |
| **MixinGradle** | 0.6-SNAPSHOT | Gradle annotation processor plugin for Mixin | Paired with Mixin 0.7.x. Do NOT upgrade to 0.7-SNAPSHOT or later — those target Mixin 0.8+ on ForgeGradle 3.0+. |
| **MCP Mappings** | stable_22 | SRG → Java name mapping | Canonical 1.8.9 mapping. `mappings = "stable_22"` in your loom config. No newer mappings exist for 1.8.9. |
| **Forge** | 11.15.1.2318-1.8.9 | Modloader | The final 1.8.9 Forge build. `minecraft = "1.8.9-11.15.1.2318-1.8.9"`. Frozen. Do not look for a newer 1.8.9 Forge — this is it. |
| **Kotlin** | 1.9.x (optional) | Second-language option inside the mod | If we want Kotlin (SkyHanni does), use **Kotlin for Forge** (Forgelin replacement) + compile-target 1.8. Mixins themselves MUST stay in Java per the SkyHanni template — older Mixin versions and Kotlin don't mix. Recommendation: start Java-only, add Kotlin only if a feature needs it. |

### Core Technologies — Auth

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@azure/msal-node** | latest (4.x) | Microsoft OAuth in Electron main process | **MSAL Node only — not MSAL Browser.** Device Code Flow is only implemented in MSAL Node (confirmed, issue #5312 on AzureAD/microsoft-authentication-library-for-js). MSAL Browser explicitly does not work in Electron per Microsoft's own tutorial docs. Runs entirely in main process; renderer communicates over IPC. |
| **prismarine-auth** | 3.1.1 | Minecraft-specific auth layer (XBL → XSTS → Minecraft) | Published 2026-03-31, actively maintained (34 releases, recent commits). Wraps the Xbox Live + XSTS + `api.minecraftservices.com/authentication/login_with_xbox` handshake that vanilla MSAL doesn't know about. Exposes `getMinecraftJavaToken()`. Saves 300+ lines of hand-rolled token exchange. |

### Core Technologies — Game launch infrastructure

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Eclipse Temurin 8 JRE** | 8u432 or later | Bundled Java runtime for shipped product | Most-tested OpenJDK distribution, sponsored by Microsoft + the JDK foundation. JRE-only builds exist for Java 8 (Temurin dropped JRE builds for 11+, so we get lucky — 1.8.9 uses 8). Available for Windows x64, macOS x64 Intel, macOS aarch64 (Apple Silicon). ~50-70MB per platform. |
| **@xmcl/core + @xmcl/installer** | latest | Launch + install orchestration library | Handles manifest parsing, library downloads with SHA1 verification, classpath assembly, JVM argument construction. Active repo (1,700+ commits on master). Saves months of reimplementing Mojang's launcher manifest format. Alternative: `minecraft-launcher-core` (Pierce01 fork) — simpler but less actively maintained. |

### Supporting Libraries — Launcher

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Zustand** | 5.x | Renderer state management | Default choice. ~1.2KB, no provider, TypeScript-first. Overkill-free for a launcher UI with ~5-10 stores (account, settings, launch state, downloads, logs). Don't use Redux Toolkit here — the boilerplate is wasted when there's no team. |
| **Tailwind CSS** | 4.x | Styling | Paired with shadcn/ui. Tailwind v4 drops `tailwind.config.js` — config lives in CSS. Vite plugin-only setup. |
| **shadcn/ui** | Feb 2026 unified Radix build | UI components (not a library, copy-paste source) | Industry default as of 2026. Uses unified `radix-ui` package post Feb 2026 (not individual `@radix-ui/react-*`). Components are copied into your repo — no runtime library bloat. Visual Builder at ui.shadcn.com/create can scaffold the initial setup. |
| **Radix UI (primitives)** | bundled via shadcn | Accessible primitives beneath shadcn | Don't install separately; comes with shadcn's unified package. |
| **electron-log** | 5.x | Structured logging in Electron main + renderer | Purpose-built for Electron (27M weekly downloads vs. winston 21M). Auto-writes to `app.getPath('logs')`, rotates files, bridges renderer→main console. Critical for diagnosing user crash reports. Use this over `winston` — winston is fine but requires more Electron-specific wiring (must bolt on `electron-winston` adapter to get log paths right). |
| **execa** | 9.x | Spawn Java process with typed args | Cleaner than raw `child_process.spawn`; streams stdout/stderr as events, returns promises, handles Windows path quoting correctly. Do NOT use `node-pty` unless we need PTY semantics (we don't — Minecraft doesn't expect a TTY). |
| **got** or native `fetch` | — | HTTP downloader with resume + progress | Native `fetch` (Node 22+) is enough for most calls. Use `got` if we need resumable downloads for large assets.jar files. |
| **p-queue** | 8.x | Parallel download throttling | Mojang's CDN penalizes >10 concurrent connections. Wrap library downloads in a `p-queue` with `concurrency: 8`. |
| **electron-updater** | bundled with electron-builder | Auto-update | **Deferred to v0.2** per PROJECT.md — v0.1 is personal + small-group, no signing. But wire the dependency now to avoid a rip-out later. |

### Supporting Libraries — Game Mod

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **DevAuth** | original (DJtheRedstoner) for 1.8.9 | Real Microsoft login during `runClient` dev task | Lets you join Hypixel/BlocksMC from the dev environment to test anticheat-safety. DevAuth Neo (2025 rewrite) is Fabric-only; stick with the original DevAuth for 1.8.9 Forge. Enable via `-Ddevauth.enabled=1` JVM arg on the `runClient` task. |
| **UniversalCraft / Elementa** | Essential libs | UI rendering inside Minecraft (HUD overlays) | Essential's UI framework is the de facto 1.8.9 choice for building in-game GUI — Patcher, Skytils, SkyHanni all use it. Saves rolling our own `GuiScreen` subclasses. |
| **OneConfig** | latest | In-game settings UI | Sk1er's config framework, used by PolyPatcher. Alternative to hand-rolling a Forge config screen. Optional for v0.1; can start with Vanilla Forge config. |
| **Kotlin for Forge** | latest for 1.8.9 | Runtime for Kotlin mods | Only if we choose to write parts of the mod in Kotlin. Shipped as a separate Forge mod dependency. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **IntelliJ IDEA (Community or Ultimate)** | Primary IDE for the mod | Required for 1.8.9 Forge dev. Must use IntelliJ 2022.2+ for Gradle 7+ support. VS Code can edit the mod but cannot run/debug it properly. |
| **VS Code / Cursor** | Launcher dev | TypeScript + React + Tailwind tooling is best-in-class here. |
| **pnpm** | Launcher package manager | Recommend over npm: faster, uses content-addressable store, handles Electron's large dep tree more efficiently. |
| **ESLint + Prettier** | Launcher code quality | Standard stack: `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, Prettier for formatting. |
| **Detekt** | Kotlin static analysis (if Kotlin used) | SkyHanni uses detekt 1.23.7. |
| **Architectury-loom IntelliJ plugin** | Loom integration | Install separately from the standard Gradle plugin. Required for breakpoint debugging into Minecraft source. |

## Installation

### Launcher

```bash
# Scaffold
pnpm create electron-vite@latest launcher --template react-ts

cd launcher

# Core
pnpm add react@^19 react-dom@^19
pnpm add @azure/msal-node prismarine-auth
pnpm add @xmcl/core @xmcl/installer
pnpm add zustand
pnpm add electron-log execa p-queue

# Styling
pnpm add tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init

# Dev
pnpm add -D electron@^41 electron-builder@^26
pnpm add -D typescript@^5.6 @types/react@^19 @types/react-dom@^19
pnpm add -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D vite @vitejs/plugin-react electron-vite
```

### Mod

The mod is NOT scaffolded via npm. Fork one of these templates and rename:

- **Primary recommendation:** `github.com/nea89o/Forge1.8.9Template` — architectury-loom based, Mixin-ready, DevAuth pre-wired.
- **Alternative (Kotlin):** `github.com/hannibal002/Example-1.8.9-Mod` — SkyHanni-derived, Kotlin + Java Mixins split.

After forking:
1. Install Temurin JDK 17 (for Gradle) and Temurin JDK 8 (for Minecraft) side-by-side.
2. In IntelliJ: set Project SDK = JDK 1.8, Gradle JVM = JDK 17.
3. Rename `baseGroup`, `group`, `rootProject.name`, and the `com.example` package to match WiiWho.
4. Run `./gradlew setupDecompWorkspace` (loom equivalent) then `./gradlew runClient`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Electron 41 | Tauri 2.x | Never for this project — Lunar uses Electron, every Minecraft launcher reference we have uses Electron, and perf doesn't matter (game runs in its own JVM). Tauri's Rust learning tax is pure cost here. |
| React 19 | Svelte 5, SolidJS | Both have better perf but launcher UI perf is irrelevant. React's ecosystem (shadcn, every Electron tutorial) is the deciding factor. |
| Zustand | Jotai, Redux Toolkit | Jotai if we end up with deeply interdependent atom-like state (cosmetics pipeline could qualify, but not at v0.1). Redux Toolkit only if we grow a team of 3+ with different state conventions. |
| Tailwind v4 + shadcn | CSS Modules, Chakra UI, MUI | Chakra/MUI bring runtime JS bloat + opinionated theming we'd fight against. CSS Modules is fine but slower to ship polished launcher UI. |
| gg.essential.loom + Mixin 0.7.11 | Legacy ForgeGradle 2.1-SNAPSHOT + Gradle 3.1 | **Only if forced by upstream tooling we adopt** (unlikely). Legacy path is officially deprecated: IntelliJ dropped Gradle <4.5, Forge removed its built jars from the repo, and no mod shipped in the last 2 years uses this path. |
| Eclipse Temurin 8 | Azul Zulu 8 | Zulu is what Lunar ships and is equally valid. Zulu has historically smaller downloads. Switch if bundle size becomes a critical constraint (unlikely for a ~60MB JRE). |
| Eclipse Temurin 8 | BellSoft Liberica 8 | Liberica offers JRE builds with OpenJFX bundled — irrelevant for Minecraft (1.8.9 uses LWJGL, not JavaFX). No reason to pick it over Temurin. |
| Eclipse Temurin 8 | GraalVM 8 | GraalVM's perf gains don't materialize for Minecraft 1.8.9 in practice (LWJGL native rendering dominates the hot path). Not worth the compatibility risk. |
| @xmcl/core | minecraft-launcher-core (Pierce01) | Simpler, but less actively maintained. Use @xmcl unless we hit a concrete bug. |
| prismarine-auth | Hand-rolled MSAL Node + XBL/XSTS fetch chain | Only if we need a feature prismarine-auth doesn't expose. Its `getMinecraftJavaToken()` abstracts the full 4-step flow correctly. |
| electron-log | winston + electron-winston adapter | winston if we already have server infra using it and want log format parity. Otherwise electron-log wins. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Gradle 3.x / 4.x directly** | IntelliJ 2022.2+ dropped support for Gradle <4.5. Gradle 3.1 is what dxxxxy/1.8.9ForgeTemplate used and it is officially marked "no longer valid/working" by its own author. | Gradle 7.6.x via wrapper, with loom fork handling the legacy Forge integration. |
| **Gradle 8.x with legacy ForgeGradle 2.1** | Breaks with `Configuration with name 'compile' not found` — Gradle 6+ removed the `compile` configuration that ForgeGradle 2.x depends on. | Gradle 7.6.x OR upgrade to gg.essential.loom (which we're doing). |
| **Net.minecraftforge.gradle ForgeGradle 2.1-SNAPSHOT from Forge's Maven** | Forge removed its original pre-built 1.8.9 jars from the public repo — this classic recipe's `deobfuscation` step silently fails. | `gg.essential.loom` — bundles its own copies of the needed Forge artifacts. |
| **Mixin 0.8+** | Targets ModLauncher (1.13+). On 1.8.9 (LaunchWrapper) it will load but fail to weave injectors correctly. Silent wrongness. | Mixin 0.7.11-SNAPSHOT, no exceptions. |
| **MixinGradle 0.7+** | Pairs with Mixin 0.8+. Same incompatibility story. | MixinGradle 0.6-SNAPSHOT. |
| **@azure/msal-browser for auth** | Microsoft's own docs (Authentication flow support in MSAL) say implicit + Browser flows aren't supported in Electron. Device Code Flow is not implemented in msal-browser (issue #5312). | @azure/msal-node in the main process. |
| **Mojang/Yggdrasil auth** | Shut down. Dead end. | Microsoft OAuth + XBL/XSTS. |
| **Cracked account loaders** | Explicit non-goal per PROJECT.md; also will not authenticate against `api.minecraftservices.com`. | Microsoft accounts only. |
| **Running Mixins inside Kotlin** | Mixin 0.7.x predates Kotlin interop improvements; applying Mixin annotations to Kotlin classes produces weird ASM failures. SkyHanni's template explicitly forbids it. | Keep Mixins as `.java` files in a Java-only package even if the rest of the mod is Kotlin. |
| **Electron 38 or older** | Out of support as of April 2026 (only 39/40/41 are supported). Falling out means no Chromium security patches. | Electron 41 (8-week upgrade cadence — budget for tracking majors). |
| **Node 24 for launcher tooling** | Even though Electron 41 bundles Node 24 internally, the `@electron/*` and `@electron-forge/*` tool repos require Node 22 min as of early 2025. Using 24 for your dev Node creates subtle npm-install mismatches. | Node 22 LTS for dev tooling; Node 24 is what's *inside* Electron at runtime. |
| **Tauri** | Covered above — no Minecraft launcher reference implementation exists in Tauri, and it costs us the Node ecosystem (prismarine-auth, xmcl, electron-log are all Node). | Electron. |
| **JDK 11/17 as the *runtime* for 1.8.9** | Minecraft 1.8.9's LWJGL + LaunchWrapper bindings break on Java 9+ without custom patches (the "Java 9+ compatibility patch" mod). Players expect Java 8. Lunar ships Java 8. | Temurin 8 JRE, bundled. (Java 17 only for running Gradle at build-time.) |
| **`child_process.exec`** for launching Minecraft | Buffers entire stdout, truncates at ~200KB, will lose crash logs. | `execa` or `child_process.spawn` with streaming stdout/stderr capture. |
| **auto-updating Electron without signing** | macOS Gatekeeper + Windows SmartScreen will quarantine unsigned installers; auto-updater can't do staged rollout without code signing. | v0.1: skip auto-update entirely (per PROJECT.md). v0.2+: budget for an Apple Developer ID ($99/yr) and Windows EV cert before touching auto-update. |

## Stack Patterns by Variant

**If we stay Java-only in the mod:**
- Use `nea89o/Forge1.8.9Template` as the base.
- Simpler dep tree: no Kotlin runtime mod, no detekt.
- Recommended starting posture.

**If we add Kotlin to the mod:**
- Use `hannibal002/Example-1.8.9-Mod` as the base.
- Add `Kotlin for Forge` as a runtime dep for end users (they need it installed alongside our mod).
- Keep Mixins in `src/main/java/**/mixins/` — Kotlin everywhere else.
- Use detekt 1.23.7 for static analysis (what SkyHanni uses).

**If FPS optimization work forks into Mixin-heavy territory:**
- Consider vendoring parts of Patcher (open source, github.com/Sk1erLLC/Patcher) instead of re-implementing its hotspot fixes.
- License check required — Patcher is under its own license; confirm before vendoring.

**If we later need a real cosmetics pipeline (deferred to v0.2+):**
- Add Essential's `UniversalCraft` or `Elementa` as a shade-included dependency in the mod.
- Consider `GG.essential` as a full cosmetics backend if we don't want to run our own (but then we're depending on a third party).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Mixin 0.7.11-SNAPSHOT | MixinGradle 0.6-SNAPSHOT | **Locked pair.** Both target LaunchWrapper (1.8.9). |
| Mixin 0.7.11-SNAPSHOT | Java 8 | Required — Mixin 0.7 is pre-Java-9 module system. |
| Forge 11.15.1.2318-1.8.9 | MCP stable_22 mappings | Final combo for 1.8.9. |
| Forge 1.8.9 | Java 8 **only** | Java 9+ breaks without a compatibility patch mod. |
| gg.essential.loom 1.6.x | Gradle 7.6.x | Newer loom may require newer Gradle; stick to known-good pair. |
| Gradle 7.6.x | Java 17 (daemon) + Java 8 (compile target) | Gradle 7 can run on Java 11+; use 17 for IntelliJ compatibility. |
| Electron 41 | Node 22+ (dev tooling) / Node 24 (bundled) | `@electron/*` and `@electron-forge/*` repos require Node 22 min. |
| Electron 41 | macOS 12 Monterey+ / Windows 10+ | Matches our v0.1 platform target. |
| @azure/msal-node 4.x | Node 18+ | Trivially satisfied. |
| prismarine-auth 3.1.1 | Node 18+ | Latest release 2026-03-31. |
| electron-builder 26.8.2 | Electron 22+ | Trivially satisfied. |
| Tailwind v4 | Vite plugin only (no config.js) | Config moves to CSS `@theme`. |
| shadcn/ui (Feb 2026+) | Unified `radix-ui` package | Don't install individual `@radix-ui/react-*` packages; let shadcn pull the unified one. |

## 1.8.9 Toolchain Gotchas (read before writing any build.gradle)

Elevating the most dangerous traps to a standalone section because silent failures in the mod build system will eat days.

1. **"ForgeGradle 2.1-SNAPSHOT" is available on Forge's Maven but will fail** because Forge removed the 1.8.9 pre-built jars from the public repo. The loom fork bundles these. Don't try to use the old recipe.
2. **Gradle 8 errors cryptically.** `Configuration with name 'compile' not found` — this is ForgeGradle 2.x depending on a Gradle feature removed in Gradle 6. Not fixable; you must switch plugins (to loom) to use Gradle 7+.
3. **IntelliJ 2022.2+ dropped Gradle <4.5 support.** If you stick with the legacy plugin chain, you need IntelliJ 2020-era or workarounds. Adopting loom sidesteps this entirely.
4. **Mixin 0.7 vs 0.8 is a silent compatibility break**. 0.8 will load on 1.8.9 (both are JVM bytecode) but injection point resolution changed; injectors will no-op without errors. Lock Mixin to 0.7.11-SNAPSHOT.
5. **Mixins written in Kotlin fail weirdly** on Mixin 0.7.x. Keep mixin source files `.java` even in an otherwise-Kotlin project.
6. **DevAuth needs a system property, not just a dep.** Add `-Ddevauth.enabled=1` to the `runClient` JVM args, or it does nothing.
7. **Dual JDK setup is mandatory.** Gradle runs on JDK 17, compiles to Java 8 bytecode. IntelliJ must be configured with Project SDK = 8 and Gradle JVM = 17 explicitly. Both Temurin; install both.
8. **MCP mappings for 1.8.9 are frozen at stable_22.** No newer mappings. Don't waste time looking for improved names.
9. **LaunchWrapper + 1.8.9 + Java 17 is NOT possible at runtime** without extensive patches (LWJGL 2 incompatible). Shipped product must run on Java 8. Only the *build* uses Java 17.
10. **Forge 11.15.1.2318-1.8.9 is the final 1.8.9 build.** Mojang/Forge will not publish newer 1.8.9 artifacts. Plan accordingly.

## Electron/Launcher Gotchas

1. **Device Code Flow is MSAL-Node only.** Attempting `msal-browser` in Electron main is a dead-end per Microsoft's own documentation.
2. **Xbox Live endpoints require SSL renegotiation** — Node 18+ disables it by default. Either use prismarine-auth (handles it) or set `--security-revert=CVE-2023-46809` Node flag (fragile).
3. **`api.minecraftservices.com` returns 403 if your Azure app doesn't have the Minecraft API permission.** Must request it via the Microsoft developer portal; there's a queue. Budget a week minimum for this.
4. **Launcher UI perf is irrelevant — but Electron's bundle size isn't.** A bare Electron 41 + React app is ~180MB installed. Plus a ~60MB Temurin 8 JRE. Plan for ~250-300MB installer before we add assets.
5. **Code signing is mandatory for distribution** on macOS (Gatekeeper) and painful but skippable on Windows (SmartScreen warning). Per PROJECT.md we skip this for v0.1 — but document the tax.
6. **electron-builder `extraResources` path differs between dev and packaged.** Use `process.resourcesPath` when packaged; different path in dev. Abstract this into a `getResourcePath()` helper on day one.
7. **macOS universal binaries double bundle size.** Better to ship separate x64 and arm64 installers.
8. **Mojang rate limits library downloads.** >10 concurrent connections gets IP-throttled. Use `p-queue({concurrency: 8})`.
9. **Hypixel anticheat does NOT differentiate launcher from client.** Anything client-mod-side must be anticheat-safe; launcher doing weird auth refresh loops won't trip anticheat but will trip Microsoft's fraud detection and lock the account. Test with a burner account first.

## Sources

### Verified via authoritative sources

- **Electron 41.2.1 release** — [Electron 41 release post](https://www.electronjs.org/blog/electron-41-0), [endoflife.date/electron](https://endoflife.date/electron) — confirmed latest stable April 2026, macOS 12+ / Windows 10+ target. HIGH confidence.
- **electron-builder 26.8.2** — [npm electron-builder](https://www.npmjs.com/package/electron-builder) — published 2026-03-04. HIGH confidence.
- **MSAL Node device code flow only** — [Microsoft Learn: Authentication flow support](https://learn.microsoft.com/en-us/entra/identity-platform/msal-authentication-flows), [GitHub issue #5312](https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/5312). HIGH confidence.
- **Minecraft auth flow (XBL → XSTS → api.minecraftservices.com)** — [Minecraft Wiki: Microsoft authentication](https://minecraft.wiki/w/Microsoft_authentication), [wiki.vg: Microsoft Authentication Scheme](https://wiki.vg/Microsoft_Authentication_Scheme). HIGH confidence.
- **prismarine-auth 3.1.1 active** — [GitHub: PrismarineJS/prismarine-auth](https://github.com/PrismarineJS/prismarine-auth) — 34 releases, latest 2026-03-31. HIGH confidence.
- **1.8.9 modern toolchain = gg.essential.loom + Mixin 0.7.11** — [hannibal002/Example-1.8.9-Mod settings.gradle.kts](https://github.com/hannibal002/Example-1.8.9-Mod/blob/main/settings.gradle.kts), [hannibal002/SkyHanni build.gradle.kts](https://github.com/hannibal002/SkyHanni/blob/stable/build.gradle.kts), [EssentialGG/essential-gradle-toolkit](https://github.com/EssentialGG/essential-gradle-toolkit), [nea89o/Forge1.8.9Template](https://github.com/nea89o/Forge1.8.9Template). HIGH confidence — this is the live stack of every major 1.8.9 mod.
- **Gradle 8 + legacy ForgeGradle 2.1 breaks** — [Hypixel forum: Using Gradle 8.2.1 to make a 1.8.9 Forge Mod](https://hypixel.net/threads/using-gradle-8-2-1-to-make-a-1-8-9-forge-mod.5446816/). HIGH confidence.
- **Mixin 0.7.11 + MixinGradle 0.6 for 1.8.9** — [manuthebyte/template-forge-mixin-1.8.9 build.gradle](https://github.com/manuthebyte/template-forge-mixin-1.8.9/blob/main/build.gradle), [Dark's Mixin Introduction](https://darkhax.net/2020/07/mixins). HIGH confidence.
- **Legacy ForgeGradle 2.1 is dead** — [dxxxxy/1.8.9ForgeTemplate README](https://github.com/dxxxxy/1.8.9ForgeTemplate) (self-declared deprecated). HIGH confidence.
- **DevAuth for 1.8.9 Forge** — [DJtheRedstoner/DevAuth](https://github.com/DJtheRedstoner/DevAuth). HIGH confidence.
- **Eclipse Temurin 8 JRE availability** — [Adoptium Temurin](https://adoptium.net/temurin/), [Adoptium releases filter for Java 8](https://adoptium.net/temurin/releases/?version=8). HIGH confidence.
- **Lunar Client uses Zulu JRE** — [Hypixel forum: Getting better FPS stability by using another JRE](https://hypixel.net/threads/getting-better-fps-stablity-by-using-another-jre-with-lunar-client.4518890/). MEDIUM confidence (community source, but consistent across multiple threads).
- **@xmcl launcher core** — [voxelum/minecraft-launcher-core-node](https://voxelum.github.io/minecraft-launcher-core-node/) — 1,700+ commits, active. MEDIUM confidence on feature coverage (feature set partially documented; will verify during execute phase).
- **electron-log vs winston usage stats** — [npm trends comparison](https://npmtrends.com/electron-log-vs-electron-logger-vs-pino-vs-winston). MEDIUM confidence (snapshot data).
- **State management landscape** — [DEV: State Management in 2026](https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge), [Syncfusion: Top 5 React State Management Tools 2026](https://www.syncfusion.com/blogs/post/react-state-management-libraries). MEDIUM confidence.
- **shadcn/ui unified Radix (Feb 2026)** — [shadcn/ui changelog Feb 2026](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui). HIGH confidence.
- **Tailwind v4 + Electron setup** — [Fast-Track Your Desktop Apps: Electron-vite and Tailwind v4](https://iifx.dev/en/articles/457403541/fast-track-your-desktop-apps-a-guide-to-electron-vite-and-tailwind-v4). MEDIUM confidence.
- **Patcher (1.8.9 perf mod reference)** — [Sk1erLLC/Patcher](https://github.com/Sk1erLLC/Patcher). HIGH confidence.

### Unverified / training data only

- Specific loom plugin version numbers (e.g. `gg.essential.loom` 1.6.x) — pin to whatever the current `nea89o/Forge1.8.9Template` uses at scaffold time; **verify via the template's `settings.gradle.kts` at phase-execution time**, do not trust this document's exact minor version.
- Temurin 8 JRE bundle sizes — reported ~50-70MB across platforms is from general knowledge; confirm at bundling time.

---
*Stack research for: Custom Minecraft 1.8.9 client (Lunar-style) — Electron launcher + Forge mod*
*Researched: 2026-04-20*
