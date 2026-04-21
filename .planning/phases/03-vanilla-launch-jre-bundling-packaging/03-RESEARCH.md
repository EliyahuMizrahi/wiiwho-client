# Phase 3: Vanilla Launch, JRE Bundling & Packaging — Research

**Researched:** 2026-04-21
**Domain:** Electron launcher → downloads + verifies Mojang 1.8.9 → spawns bundled Temurin 8 JRE → reaches Minecraft main menu logged in with a real MS account → ships as signed-less distributables (NSIS + Universal DMG).
**Confidence:** HIGH for Mojang manifest shape + placeholder tokens + main class (verified by fetching live `1.8.9.json`), HIGH for electron-builder config keys + NSIS/DMG target (verified via live docs), HIGH for `@xmcl/core` / `@xmcl/installer` top-level API (verified via README), HIGH for crash-report redaction patterns (Phase 2 code + Pitfall 8). **MEDIUM** for main-menu-detection sentinel (verified community examples; recommend `Sound engine started` and fall through to a timer-based fallback). **MEDIUM-LOW** for Apple-Silicon JRE story — see Open Questions §1; contradicts user decision D-22 and needs a policy call.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Home / Settings layout**

- **D-01**: Settings surface is a slide-in right drawer (Radix Sheet via shadcn), triggered by a gear icon. Play-forward screen stays visible underneath.
- **D-02**: Drawer dismiss = X button + ESC + click-outside (all three close it).
- **D-03**: RAM slider lives in Settings only, not on Home.
- **D-04**: RAM slider range is 1–4 GB in 512 MB steps, default 2 GB (7 positions: 1, 1.5, 2, 2.5, 3, 3.5, 4 GB).
- **D-05**: G1GC tooltip uses BOTH an always-visible one-line helper caption AND an info-icon with a Radix Tooltip on hover.
- **D-06**: Game-directory override is hidden from the v0.1 UI. Hardcoded path; no picker, no read-only display.
- **D-07**: Launch logs and past-crash reports are reachable only via entries inside the Settings drawer.
- **D-08**: Idle Home screen is strictly minimal — centered cyan Play button + top-right account badge + small `v0.1.0-dev` text + gear icon.

**Launch flow UX**

- **D-09**: On Play click, cyan Play button morphs in-place into a status label. Cycles: `Downloading…` (with percent) → `Verifying…` → `Starting Minecraft…` → `Playing` (disabled). No separate progress panel.
- **D-10**: First-run progress shows phase label + percent only. One label + one progress bar. No `MB / total MB`, no per-file scrolling.
- **D-11**: Launch log tail is hidden on the happy path; only surfaces on failure (~30 lines suggested).
- **D-12**: On main-menu reached, launcher minimizes to OS taskbar (does NOT close or hide to tray). Window stays alive to babysit the JVM.
- **D-13**: Launch cancellation available during Downloading + Verifying phases only. Once `Starting Minecraft…` starts, Cancel disappears.
- **D-14**: On network failure during download, auto-retry 3× with backoff per failing file (suggested 500ms / 2s / 5s), then surface error + Retry button that resumes.
- **D-15**: Cached-launch path skips directly to `Starting Minecraft…`. SHA1 re-verification still runs on every launch. Mismatch → status reverts to Downloading and corrupted file is re-fetched.
- **D-16**: Main-menu detection is via stdout log-line pattern match (researcher picks specific line from 1.8.9 startup log — see §Main-Menu Detection below).

**Crash viewer + redaction**

- **D-17**: Crash viewer triggers iff JVM exits non-zero AND a new file appears in `<game-dir>/crash-reports/` within ~5s post-exit. Zero-exit is silent (normal quit).
- **D-18**: Crash viewer presentation = launcher restores from minimized and takes over Home screen full-page.
- **D-19**: Four buttons: `Copy report`, `Open crash folder`, `Close`, `Play again`.
- **D-20**: Redaction scope = JWTs + MC access token + OS username (Windows `C:\Users\<name>`, macOS `/Users/<name>`, `%USERNAME%` / `$USER`). UUIDs, IPs, hostnames NOT redacted in v0.1.
- **D-21**: Redaction runs before BOTH displayed text AND clipboard contents. Same sanitizer function drives both paths.

**Packaging + game data dir**

- **D-22**: macOS ships a single Universal DMG bundling both arm64 and x64 Temurin 8 JREs. Rosetta is "not the path." **⚠ See Open Questions §1 — Temurin 8 has no arm64 JRE; this decision has an upstream availability conflict.**
- **D-23**: Windows ships an NSIS installer only — `Wiiwho Client Setup.exe`. Writes to `%LOCALAPPDATA%/Programs/Wiiwho/`, creates Start Menu shortcut, registers uninstaller. No portable ZIP.
- **D-24**: Game data lives at `%APPDATA%/Wiiwho/game/` (Windows) / `~/Library/Application Support/Wiiwho/game/` (macOS), nested under existing Wiiwho data root. Subtree: `game/versions/1.8.9/`, `game/libraries/**`, `game/assets/{indexes,objects}/**`, `game/mods/`.
- **D-25**: Temurin 8 JRE bundled in the installer via `extraResources` (not downloaded on first launch). Per-platform paths: `resources/jre/win-x64/`, `resources/jre/mac-arm64/`, `resources/jre/mac-x64/`. Runtime resolves via `app.getAppPath()` + arch detection.

### Claude's Discretion

- SHA1-mismatch recovery UX copy / transition animation details.
- First-run welcome dialog (likely none; optional "Downloading ~60 MB on first Play" hint pinned under Play).
- Installer display name wording — **recommend** `Wiiwho Client Setup.exe` + `Wiiwho.dmg` (SC4).
- Exact stdout pattern for main-menu detection (see §Main-Menu Detection).
- Progress-bar aesthetics (determinate vs indeterminate by phase).
- Settings drawer width + animation duration.
- Windows uninstaller behavior — Claude picks less-destructive default (keep `%APPDATA%/Wiiwho/`; checkbox offers wipe).
- Temurin 8 JRE source — see §Temurin Sourcing below.
- electron-log retention parameters (planner tunes).
- p-queue concurrency — stays at 8 per STACK.md.
- `@xmcl/core` vs `@xmcl/installer` feature split — see §xmcl API Map below.
- Crash viewer color scheme — reuse `ErrorBanner` red-ish header + neutral body.
- Reconnect-on-launcher-reopen-while-game-running — **Claude picks (b) "assume no game is running"** (simpler; owner is primary user).
- Mac unsigned workaround doc — **recommend** `README-macOS.txt` dropped INSIDE the DMG next to the app bundle + a `docs/install-macos.md` linked from project README.

### Deferred Ideas (OUT OF SCOPE)

**v0.2+**

- Game-directory override UI.
- Per-file download list view.
- Always-visible launch log tail.
- `Report bug` button on crash viewer.
- Over-redaction (UUID, IP, hostname).
- Changelog tease / news card / server teaser on Home.
- Status strip on Home (`Ready • 1.8.9 • 2 GB`).
- Portable Windows ZIP.
- Cancel-during-JVM-spawn.
- Auto-retry during Starting-Minecraft phase.
- First-run welcome dialog (dedicated).
- Reconnect-on-reopen-while-game-alive.
- Separate arm64 / x64 macOS installers.

**Non-negotiable out-of-scope**

- Auto-updater (`electron-updater`).
- Signed Windows installer (EV cert) + macOS notarization.
- Crash uploader / telemetry.
- Linux packaging.
- Server browser / server list.
- Multi-instance / instance profiles.
- Redistribution of Minecraft jars or assets (EULA).
- Cracked-account support.
- Rosetta-only macOS (rejected; BUT see Open Questions §1).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LCH-01** | Download vanilla 1.8.9 jar from Mojang manifest + SHA1-verify | §Mojang Manifest Shape (live-fetched client.json sha1 `3870888a6c3d349d3771a3e9d16c9bf5e076b908`); §xmcl API Map (`completeInstallation` + `installMinecraftJar`) |
| **LCH-02** | Download + verify all 1.8.9 libraries + asset index | §xmcl API Map (`installLibraries`, `installAssets`); §Mojang Manifest Shape (37 libraries; 1.8 asset index) |
| **LCH-03** | Cache jars/libs locally; reuse on subsequent launches | §Download/Verify Pipeline (SHA1 compare-first, skip-if-match) |
| **LCH-05** | Spawn bundled Java 8 JVM with correct classpath + heap + auth + game args; window opens to main menu | §JVM argv for 1.8.9 (exact canonical argv); §JVM Spawn (execa streaming) |
| **LCH-06** | User reaches main menu logged in with real MS account (no offline) | §AuthManager integration (call `getMinecraftToken()` right before spawn); `--userType msa` |
| **LCH-07** | Capture JVM stdout/stderr; display relevant lines during launch | §Log Parser (line-split stdout/stderr → `game:log` push events; emit last N on failure) |
| **JRE-01** | Windows installer includes Temurin Java 8 JRE | §Temurin Sourcing (win-x64 URL + checksum); §electron-builder extraResources |
| **JRE-02** | macOS installer includes Temurin Java 8 JRE | §Temurin Sourcing (mac-x64 URL; ⚠ mac-arm64 requires Azul Zulu — see Open Questions §1) |
| **JRE-03** | On launch, launcher spawns the bundled JRE (not system Java) via a known resource path | §Resource-path resolution (`app.getAppPath()/resources/jre/<arch>/bin/java[.exe]` dev vs packaged) |
| **PKG-01** | electron-builder produces Windows NSIS installer bundling launcher + JRE + mod jar | §electron-builder Config Fragment (NSIS + `extraResources` for `resources/jre/win-x64/` + `resources/mod/`) |
| **PKG-02** | electron-builder produces macOS DMG bundling launcher + JRE + mod jar (unsigned OK; workaround documented) | §electron-builder Config Fragment (Universal DMG); §Mac unsigned workaround pattern |
| **LAUN-03** | RAM slider (sane min/max) | §Settings Schema (`ramMb: 1024–4096` in 512 MB steps, default 2048); §JVM argv (`-Xmx${ram}M -Xms${ram}M`) |
| **LAUN-04** | RAM setting persists across launcher restarts | §Settings File (atomic temp+rename to `userData/settings.json`) |
| **LAUN-05** | Crash log surfaced in launcher UI on non-zero exit | §Crash Detection Contract (exit code ≠ 0 + crash-report file within 5 s) |
| **COMP-05** | Crash logs sanitized of access tokens, refresh tokens, and username | §Redaction Patterns (D-20 extension of `redact.ts` with 6 new patterns) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives have the same force as locked decisions. Research does not propose alternatives that contradict them.

- **Locked Minecraft version:** 1.8.9 only. Do not research, plan, or ship multi-version launching code (v0.2+).
- **Locked launcher stack:** Electron 41.x + TypeScript (strict) + React 19 + Vite + electron-builder. No Tauri, no Svelte, no CRA.
- **Locked mod stack:** Forge 1.8.9 + Java 8 + `gg.essential.loom` + Mixin 0.7.11-SNAPSHOT + MixinGradle 0.6-SNAPSHOT. Mod jar produced via `./gradlew build`.
- **Locked auth path:** Microsoft OAuth only via `@azure/msal-node` + `prismarine-auth` (device-code flow). No Mojang/Yggdrasil. No cracked.
- **Locked platforms:** Windows + macOS (Win 10+, macOS 12+). Linux out of scope.
- **Bundled JRE mandatory:** No user-side Java install ever. JRE ships in installer.
- **Anticheat safety:** Every in-game-affecting feature reviewed in `docs/ANTICHEAT-SAFETY.md`. Phase 3 adds zero in-game code; merge-gate only verifies no accidental mod-classpath touches.
- **No redistribution of Minecraft assets:** Launcher downloads vanilla jar + libs + assets from Mojang at runtime. Nothing Mojang-owned ships in our installer. Enforced in launch code path.
- **Launcher security invariants (frozen since Phase 1):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Phase 3 must not regress.
- **Frozen IPC surface (Phase 1 D-11):** 5 top-level preload keys (`auth`, `game`, `settings`, `logs`, `__debug`). Phase 3 fills handler bodies; adds NO new top-level keys and NO new channels.
- **Required entry:** `/gsd:execute-phase` (GSD Workflow Enforcement in CLAUDE.md).
- **Node version pin:** Node 22 LTS for dev tooling. Electron 41 bundles Node 24 internally (ignore that for npm scripts).
- **No `child_process.exec`:** Stdout is truncated at ~200 KB; use `execa` or `child_process.spawn` only.

## Summary

Phase 3 is three nominally independent streams sharing one assembly point — the JVM spawn — and one UI surface (the Play-forward screen). The pipeline lines up cleanly: the launcher fetches Mojang's `version_manifest_v2.json`, resolves the 1.8.9 entry to `piston-meta.mojang.com/v1/packages/d546f1707a3f2b7d034eece5ea2e311eda875787/1.8.9.json`, verifies + downloads `client.jar` + 37 libraries + the `1.8` asset index (78 kB manifest, 114 MB of objects), extracts LWJGL 2.9.4 natives, assembles a launch-time classpath + argv, calls `AuthManager.getMinecraftToken()` for a fresh MC access token, and `execa`-spawns `<bundled-jre>/bin/java[.exe]` with `-Xmx<ram>M -XX:+UseG1GC … net.minecraft.client.main.Main` plus the Mojang-published `minecraftArguments` template substituted with `--userType msa` and the live token. Stdout is line-parsed; a match for `[...]: Sound engine started` triggers the `game:status → playing` transition and the launcher minimizes. Non-zero exit + a new file in `<game-dir>/crash-reports/` within 5 s triggers the redact-then-display crash viewer.

**Two research-critical constraints fall out of the live data that are not captured in any prior doc:**

1. **`mainClass` for vanilla 1.8.9 is `net.minecraft.client.main.Main` — NOT `net.minecraft.launchwrapper.Launch`.** Phase 3 is vanilla only (Forge is Phase 4). The launchwrapper path is what Forge injects via `--tweakClass`; Phase 3 does not use it. This was inconsistently framed in ARCHITECTURE.md (which assumes Forge is loaded) and the original prompt (which flags the ambiguity). Verified by fetching Mojang's live `1.8.9.json` (2026-04-21).

2. **Temurin 8 has no macOS arm64 JRE.** The Adoptium API returns an empty array for `arch=aarch64 & os=mac & image_type=jre & version=8`. The only vendor producing Java 8 aarch64 JRE binaries is **Azul Zulu** (current build `zulu8.92.0.21-ca-jre8.0.482-macosx_aarch64.tar.gz`). D-22 locks Temurin 8 and rejects Rosetta — both cannot both hold. See Open Questions §1 for recommended resolutions.

**Primary recommendation:** Use `@xmcl/installer` for `completeInstallation` (manifest + client jar + libraries + assets + SHA1) and `@xmcl/core` for `Version.parse` + `launch`, but supply our OWN argv assembler + our own JRE path (xmcl's `launch` defaults to spawning; we want it to spawn via our `execa` wrapper so we control logging, Windows path quoting, and AbortController-based Cancel). Redactor extends the existing `redact.ts` pattern list with MC-access-token + username patterns (D-20). Settings live in plain JSON at `userData/settings.json` via `fs.writeFile`-temp-then-rename (NOT safeStorage — not sensitive). Packaging writes a full `electron-builder.yml` with NSIS + Universal DMG targets, `extraResources` mapping `launcher/resources/jre/<arch>/` + `launcher/resources/mod/` into the installer. Apple Silicon: **ship Zulu 8 arm64 in the mac-arm64 slot**; Temurin for Windows + mac-x64. Main-menu sentinel: **`[Client thread/INFO]: Sound engine started`** (fires late enough that window is ready, fires even in OpenAL-failed "Silent Mode" fallback).

## Standard Stack

### Core (new for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **@xmcl/core** | latest (^2.x per STACK.md) | `Version.parse()` resolver + optional `launch()` | Active repo (Voxelum/minecraft-launcher-core-node, 1,700+ commits). Saves reimplementing Mojang manifest inheritance + placeholder substitution. Locked by STACK.md §Core Technologies — Game launch infrastructure. |
| **@xmcl/installer** | latest | `completeInstallation(resolvedVersion, {...})` → fetches client jar + libraries + assets + natives-extract with SHA1 verification | Diagnose-first pattern (checks existing files before downloading, skipping already-valid files). Replaces ~500 lines of hand-rolled manifest code. Use this rather than `minecraft-launcher-core` (Pierce01) per STACK.md alternatives table. |
| **execa** | ^9.x | Spawn JVM; stream stdout/stderr; handle Windows path quoting; AbortController for Cancel | `child_process.exec` banned (200 KB truncation — Pitfall 8 in PITFALLS.md). `execa` handles graceful termination + `cancelSignal` hook + iterable output. Verified: supports `cancelSignal: controller.signal`. |
| **p-queue** | ^8.x | Parallel library downloads with `concurrency: 8` | Mojang's CDN throttles above ~10 concurrent. xmcl/installer may already queue internally — verify before wrapping; if it does, we pass xmcl a concurrency option instead of layering p-queue on top. |

### Already installed (Phase 1/2 — reused)

| Library | Version | Purpose |
|---------|---------|---------|
| **electron-log** | ^5.4.3 | Launcher + launch-process logging; Phase 2's `installRedactor()` hook is in place. Phase 3 extends the pattern list. |
| **electron-builder** | ^26.0.12 | Already a dep. Phase 3 rewrites `electron-builder.yml` (currently a template). |
| **radix-ui (unified)** | ^1.4.3 | Add shadcn Sheet (drawer), Slider, Tooltip via the unified package. |
| **zustand** | ^5.0.12 | `useSettingsStore`, `useGameStore`. |
| **prismarine-auth** | ^3.1.1 | `AuthManager.getMinecraftToken()` path — Phase 3 invokes it at Play-click (§AuthManager integration). |

### shadcn components to add

`Sheet` (SettingsDrawer), `Slider` (RamSlider), `Tooltip` (G1GC info). Add via `pnpm dlx shadcn@latest add sheet slider tooltip`. Note the Phase 2 precedent of manually inlining from the new-york-v4 registry JSON when the CLI chokes on pnpm hoist-patterns.

### Alternatives considered (for Claude's Discretion items)

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@xmcl/installer` | `minecraft-launcher-core` (Pierce01 fork) | Simpler, less actively maintained. Switch only if xmcl hits a concrete bug on 1.8.9 legacy manifest. |
| `execa` | raw `child_process.spawn` | Raw spawn works but we'd hand-roll the promisified API + Windows-path-quote edge cases + cancel wire-up. ~50 lines we're not writing. |
| `p-queue` wrapper over xmcl | xmcl's built-in concurrency option | If xmcl exposes `maxConcurrency` via options, skip p-queue entirely and pass `8`. Verify in plan-execute. |
| Temurin 8 JRE (mac-arm64) | Azul Zulu 8 JRE arm64 | **Required substitution — Temurin has no arm64 JRE. Zulu 8.0.482 is current arm64 build.** |
| electron-log rotation defaults | Custom rotator | electron-log's defaults (5 MB max file, 4 archive files, total ~25 MB) are fine. Planner tunes only if bug surfaces. |

### Installation (delta on current package.json)

```bash
cd launcher
pnpm add @xmcl/core @xmcl/installer execa p-queue
pnpm dlx shadcn@latest add sheet slider tooltip
```

**Version verification before execute-phase:** run `npm view @xmcl/core version @xmcl/installer version execa version p-queue version` and document resolved versions in the plan. Node 22 LTS dev, Electron 41 runtime. No native modules (still pure JS, no node-gyp).

## Architecture Patterns

### Recommended project-structure deltas (additions to Phase 1/2 layout)

```
launcher/
├── electron-builder.yml                    # Phase 3 rewrites (currently template)
├── resources/                              # existing (icon.png); Phase 3 adds subdirs
│   ├── jre/
│   │   ├── win-x64/                        # Temurin 8 JRE — unpacked (bin/, lib/, …)
│   │   ├── mac-x64/                        # Temurin 8 JRE — unpacked (Contents/Home/bin/java)
│   │   └── mac-arm64/                      # Azul Zulu 8 JRE arm64 — unpacked (see Open Qs §1)
│   └── mod/
│       └── wiiwho-0.1.0.jar                # Built by client-mod/gradlew; copied by prebuild script
├── src/
│   └── main/
│       ├── paths.ts                        # NEW — single source for data-dir/game-dir/jre/settings paths
│       ├── launch/                         # NEW pipeline (mirrors ARCHITECTURE.md)
│       │   ├── manifest.ts                 # wraps @xmcl/installer manifest fetch + cache
│       │   ├── libraries.ts                # wraps installLibraries with SHA1 verify
│       │   ├── assets.ts                   # wraps installAssets
│       │   ├── natives.ts                  # native extraction (delegate to xmcl OR hand-roll jar-unzip with rules filter)
│       │   ├── args.ts                     # JVM + game argv builder (§JVM argv for 1.8.9)
│       │   ├── spawn.ts                    # execa-based JVM spawn + cancel wiring
│       │   └── *.test.ts                   # each step has a sibling vitest
│       ├── monitor/                        # NEW stdout-watcher
│       │   ├── logParser.ts                # line-split + push `game:log` + main-menu sentinel
│       │   ├── crashReport.ts              # post-exit fs.watch on <game-dir>/crash-reports/
│       │   └── *.test.ts
│       ├── settings/                       # NEW JSON-backed settings
│       │   ├── store.ts                    # atomic write + schema v1 + migrate-forward stub
│       │   └── store.test.ts
│       └── ipc/
│           ├── game.ts                     # replace stubs (orchestrator lives here)
│           ├── settings.ts                 # replace stubs (backed by settings/store.ts)
│           └── logs.ts                     # NEW file per CONTEXT integration points
└── src/renderer/src/
    ├── stores/
    │   ├── game.ts                         # NEW Zustand (discriminated union phase state)
    │   └── settings.ts                     # NEW Zustand
    └── components/
        ├── SettingsDrawer.tsx              # NEW (Radix Sheet)
        ├── RamSlider.tsx                   # NEW (Radix Slider)
        ├── CrashViewer.tsx                 # NEW (full-screen takeover)
        └── PlayButton.tsx                  # NEW (morphing button)

client-mod/                                  # Phase 3 coordination point (see §Mod Jar Bundling)
└── build/libs/wiiwho-0.1.0.jar             # Produced by `./gradlew build`; prebuild script copies → launcher/resources/mod/
```

### Pattern 1: Download-verify-cache pipeline (ARCHITECTURE.md §Pattern 3 — just operationalize)

**What:** Every file-fetch goes through `check-SHA1 → if mismatch-or-missing download → verify-after-download → cache`. Never re-download a match. Never launch with a mismatch.

**When:** Mandatory. SC5 in ROADMAP.md (corrupting a cached jar must trigger re-download, not silent broken launch).

**Example (conceptual — defer to xmcl for the actual implementation):**

```typescript
// Source: ARCHITECTURE.md §Pattern 3 + @xmcl/installer diagnose-first pattern
import { installDependencies, Version } from '@xmcl/installer'
import { Version as CoreVersion } from '@xmcl/core'

const resolved = await CoreVersion.parse(gameDir, '1.8.9')
await installDependencies(resolved, { /* concurrency option if exposed */ })
// → fetches missing or mismatched files; skips valid ones
```

### Pattern 2: Main-process orchestrator, renderer-as-view (ARCHITECTURE.md §Pattern 2)

**What:** All launch-flow state (phase, progress, log-tail, crash-ready flag) owns in main. Renderer holds only a mirror via Zustand. Main pushes updates via the already-frozen `game:progress` / `game:log` / `game:exited` / `game:crashed` channels. No new channels per Phase 1 D-11.

**CRITICAL — the four push channels above are NOT all on the preload bridge today.** Preload currently exposes: `game.onStatus` (channel `game:status-changed`) and `game.onProgress` (channel `game:progress`). The `game:log`, `game:exited`, `game:crashed` channels listed in CONTEXT.md integration points do **not** exist on the bridge. Phase 3 MUST resolve this without adding channels — see Open Questions §2.

### Pattern 3: Two-process, one-way IPC (ARCHITECTURE.md §Pattern 1)

**What:** Launcher spawns the JVM via `execa`; downward is argv + `-D` system properties; upward is line-based stdout/stderr parsing. No local socket, no named pipe, no RPC.

**When:** Always for v0.1. Phase 3 is the first real implementation.

### Pattern 4: Atomic settings write (Phase 2 `safeStorageCache.ts` parallel, unencrypted)

**What:** `fs.writeFile(tmp, json) → fs.rename(tmp, final)`. Prevents half-written file on crash. Settings are NOT sensitive — plain JSON (no safeStorage).

**Example:**

```typescript
// Source: launcher/src/main/auth/safeStorageCache.ts (lines 59-68) — same pattern, no encrypt
import { promises as fs } from 'node:fs'
async function writeSettings(path: string, v: Settings): Promise<void> {
  const tmp = `${path}.tmp`
  await fs.writeFile(tmp, JSON.stringify(v, null, 2), { mode: 0o600 })
  await fs.rename(tmp, path)
}
```

### Anti-patterns to avoid

- **Parsing stdout to drive UI state other than main-menu-reached + log-tail.** (ARCHITECTURE.md Anti-Pattern 4) — stdout format is unstable. The launch-flow state machine is driven by xmcl events + execa exit codes + the ONE sentinel line. Log lines are ONLY for display in the fail-path tail.
- **Accepting user-controlled JVM args.** (PITFALLS.md Pitfall 5) — RAM slider is a numeric field with hard min/max. No "custom args" text field in v0.1.
- **`child_process.exec` for the JVM.** (PITFALLS.md Pitfall 8) — Use `execa`; stdout will otherwise truncate at ~200 KB and the crash-report block will be lost.
- **Bundling vanilla 1.8.9 jar in the installer.** (PITFALLS.md Pitfall 3 + docs/mojang-asset-policy.md) — All Mojang-owned files download at runtime from `launchermeta.mojang.com` / `libraries.minecraft.net` / `resources.download.minecraft.net`.
- **Running auth inside the game JVM.** (ARCHITECTURE.md Anti-Pattern 2) — Launcher fetches MC access token; passes via `--accessToken` and `-Dwiiwho.token=`. The mod (Phase 4) reads the sysprop, never calls Microsoft.
- **Dual redaction paths.** (D-21) — ONE `sanitizeCrashReport(str)` function. Display and clipboard BOTH pipe through it. The unit test asserts both call-sites yield the redacted output.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Mojang manifest parsing + placeholder substitution | Manual JSON walks + regex replacers | `@xmcl/core` `Version.parse()` | Handles inheritedFrom version merging + asset-index resolution + manifest format variations. Our 1.8.9-only scope doesn't justify the maintenance. |
| Library SHA1-verify + download + cache | Custom `fetch` loop + `crypto.createHash('sha1')` | `@xmcl/installer` `installLibraries()` + `installDependencies()` | Diagnose-first pattern is already battle-tested. Retries, parallelism, partial-file recovery. |
| Asset index + CDN layout (`objects/<xx>/<hash>`) | Hand-roll directory scan + SHA1 compare | `@xmcl/installer` `installAssets()` | The `<hash-prefix>/<hash>` layout is an easy-to-get-subtly-wrong Mojang convention. |
| Natives extraction from classifier jars with `<exclude>` rules | Custom `adm-zip` + glob exclusion | `@xmcl/installer` natives step (part of `installDependencies`) | 1.8.9's entries explicitly list `{"extract":{"exclude":["META-INF/"]}}` — xmcl honors this. Otherwise we'd double-extract signature files. |
| Windows-path-quoted spawn with long classpath | Custom escape pass | `execa` | execa handles `PATHEXT`, shebangs, and space-in-path Windows corner cases. |
| Line-splitting streaming stdout | Custom buffer+split | execa's iterable output OR `split('\r?\n')` over `data` events | Both fine. The ARCHITECTURE.md example uses the buffer-split idiom; stick with it for consistency. |
| Electron log path resolution | Hard-coded `%APPDATA%/.../logs` | electron-log 5 defaults (`main.log` under `userData/logs/`) | Already installed; already used by Phase 2; rotation already bounded. |
| Atomic file write | Custom `fs.writeFile` → rename try-catch | Reuse Phase 2's pattern from `safeStorageCache.ts` (same shape, no encrypt) | Already proven in auth.bin I/O. |
| Crash-report polling | Custom `setInterval` loop | `fs.watch` on `<game-dir>/crash-reports/` with a 5 s deadline (race with setTimeout) | `fs.watch` fires immediately on new-file events on both OSes. Polling has a latency floor. |
| Multi-arch Universal DMG binary | Custom `lipo` merge | electron-builder `arch: 'universal'` (it calls `@electron/universal` under the hood) | DO NOT roll. Universal merge has known edge cases around per-arch binaries — the singleArchFiles config is the sanctioned escape hatch. |
| JRE bundling glob rules | Manual copy in package scripts | electron-builder `extraResources` per-platform `from`/`to` | `asarUnpack` keeps Java executable outside the asar archive (required — Java can't exec from inside asar). |
| RAM slider "numbers + tooltip" primitive | Custom range input | Radix `Slider` + `Tooltip` via shadcn | Accessibility + keyboard semantics for free. |
| Multi-account settings schema (for v0.3 forward-compat) | Flat object | `{ version: 1, ... }` envelope + migration stub | Phase 2 did this for auth.bin; Phase 3 mirrors. |

**Key insight:** Most of the complexity in Phase 3 is the *orchestration* between these already-solid libraries — the argv builder, the log parser, the crash detector, the settings schema, the path resolver. Build those six small modules ourselves; let the libraries do the heavy lifting everywhere else.

## Mojang Manifest Shape (verified live 2026-04-21)

**Version manifest entry for 1.8.9:**

```json
{
  "id": "1.8.9",
  "type": "release",
  "url": "https://piston-meta.mojang.com/v1/packages/d546f1707a3f2b7d034eece5ea2e311eda875787/1.8.9.json",
  "time": "2021-12-15T15:44:12+00:00",
  "releaseTime": "2015-12-03T09:24:39+00:00",
  "sha1": "d546f1707a3f2b7d034eece5ea2e311eda875787",
  "complianceLevel": 0
}
```

**Key facts from the live `1.8.9.json` (fetched 2026-04-21):**

| Field | Value | Notes |
|-------|-------|-------|
| `mainClass` | `net.minecraft.client.main.Main` | **Vanilla main class — NOT LaunchWrapper.** LaunchWrapper only applies when Forge injects `--tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker` (Phase 4 territory). |
| `assetIndex.id` | `"1.8"` | Not `"1.8.9"`. Pass `--assetIndex 1.8` in game args. |
| `assetIndex.url` | `https://launchermeta.mojang.com/v1/packages/f6ad102bcaa53b1a58358f16e376d548d44933ec/1.8.json` | |
| `assetIndex.size` | 78,494 bytes (manifest) | |
| `assetIndex.totalSize` | 114,885,064 bytes (~110 MB of objects) | First-run download payload. |
| `minecraftArguments` | `--username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userProperties ${user_properties} --userType ${user_type}` | Legacy string shape (not 1.13+ structured `arguments`). Nine placeholders. **Note `${user_properties}` — must substitute with `{}` literal.** |
| `minimumLauncherVersion` | 14 | |
| `javaVersion` | `{ component: 'jre-legacy', majorVersion: 8 }` | Confirms Java 8 target. |
| `downloads.client.sha1` | `3870888a6c3d349d3771a3e9d16c9bf5e076b908` | The check for LCH-01 / SC5. |
| `downloads.client.url` | `https://launcher.mojang.com/v1/objects/3870888a6c3d349d3771a3e9d16c9bf5e076b908/client.jar` | |
| `downloads.client.size` | 8,461,484 bytes (~8 MB) | |
| libraries count | 37 | Include LWJGL 2.9.4-nightly-20150209, JInput, various Mojang jars. |

**Placeholder substitution (what the launcher provides):**

| Placeholder | Value | Source |
|-------------|-------|--------|
| `${auth_player_name}` | MC profile username | Phase 2 AuthManager |
| `${version_name}` | `"1.8.9"` | hardcoded (single-version lock) |
| `${game_directory}` | `<data-dir>/game` absolute path | paths.ts |
| `${assets_root}` | `<data-dir>/game/assets` absolute | paths.ts |
| `${assets_index_name}` | `"1.8"` | from manifest |
| `${auth_uuid}` | MC UUID, dashless | Phase 2 AuthManager |
| `${auth_access_token}` | opaque MC access token string | Phase 2 AuthManager `getMinecraftToken()` |
| `${user_properties}` | `"{}"` | literal empty JSON object — 1.8.9 accepts this |
| `${user_type}` | `"msa"` | **MUST be `msa` for Microsoft accounts**, NOT `mojang`. Hardcode. |

**Libraries with natives (5 total — all LWJGL 2.9.4 platform shards):**

```json
{
  "name": "org.lwjgl.lwjgl:lwjgl-platform:2.9.4-nightly-20150209",
  "downloads": {
    "classifiers": {
      "natives-linux": { ... },
      "natives-osx":   { "sha1": "bcab850f...", "size": 426822 },
      "natives-windows": { "sha1": "b84d5102...", "size": 613748 }
    }
  },
  "extract": { "exclude": ["META-INF/"] },
  "natives": { "linux": "natives-linux", "osx": "natives-osx", "windows": "natives-windows" },
  "rules": [
    { "action": "allow" },
    { "action": "disallow", "os": { "name": "osx" } }
  ]
}
```

**CRITICAL:** 1.8.9 natives are **x86_64 only**. There is **NO `natives-osx-arm64` / `natives-macos-arm64` entry** in the manifest. On Apple Silicon, these natives can only be loaded by an **x86_64 Java process** (Rosetta 2 emulation). See Open Questions §1.

**Rules evaluation:** Two-pass. Default `allow`; each successive rule can flip the state. Libraries with a trailing `{"action":"disallow","os":{"name":"osx"}}` are skipped on macOS. `@xmcl/installer` handles this filter via its library resolver.

## xmcl API Map (which library does what)

From the README walk (Voxelum/minecraft-launcher-core-node, verified 2026-04-21):

| Step | Library | Exported function | Notes |
|------|---------|-------------------|-------|
| Fetch version_manifest_v2.json | @xmcl/installer | (implicit — docs don't separately expose a fetcher) | `installMinecraftJar` and `completeInstallation` fetch manifests internally. We may wrap with a direct `fetch()` to `piston-meta.mojang.com` for offline-resilience + our own cache. |
| Resolve 1.8.9 client.json | @xmcl/core | `Version.parse(minecraftLocation, '1.8.9')` | Returns a `ResolvedVersion` with flattened inheritance. We still need the version json to EXIST on disk first — use `installMinecraftJar` OR our own fetcher to drop `versions/1.8.9/1.8.9.json`. |
| Download + verify client.jar | @xmcl/installer | `installMinecraftJar(resolvedVersion)` | Implements diagnose-first SHA1 skip. |
| Resolve + download libraries with OS rules | @xmcl/installer | `installLibraries(resolvedVersion)` | Reads `rules[]` + platform; skips inapplicable libs. |
| Download asset index + asset objects | @xmcl/installer | `installAssets(resolvedVersion)` | Handles `<hash-prefix>/<hash>` CDN layout. |
| Extract natives | @xmcl/installer (internal, called by `completeInstallation`) | Part of the native handling — README notes natives are handled but "does not address natives extraction" separately. | **Action: verify during plan-execute.** If xmcl does NOT extract natives, we write our own pass (unzip each classifier jar → `<versions>/1.8.9/natives/`, honor `extract.exclude`). Reference: wiki.vg launch page + LWJGL docs. |
| All-in-one | @xmcl/installer | `completeInstallation(resolvedVersion, options)` | "Install a Minecraft version with all dependencies (jar, libraries, assets, and profiles)." Easiest entry point for LCH-01 + LCH-02 combined. |
| Build JVM args + classpath + main class substitution | @xmcl/core | `launch(options)` — returns a `ChildProcess` | xmcl can launch directly. **We do NOT want xmcl's spawn** — we need execa for Windows path quoting + cancel + streaming. Strategy: call xmcl's argv-building helpers IF exposed, or re-compute argv ourselves from the `ResolvedVersion` (simpler and we already have the manifest in memory). |
| SHA1 verification | @xmcl/installer | Built into `installXxx` functions | Diagnose-first; no explicit API to call. |

**What we still write ourselves:**

1. **Argv builder** (`launch/args.ts`) — consume `ResolvedVersion` + `{ ramMb, javaPath, gameDir, username, uuid, accessToken, nativesDir, classpathJars }` → return `{ jvmArgs, gameArgs, mainClass }`.
2. **Spawn wrapper** (`launch/spawn.ts`) — execa with `cancelSignal`, line-split stdout/stderr events, exit-code resolution.
3. **Main-menu sentinel detector** (`monitor/logParser.ts`) — line-by-line regex, emits `on-main-menu` once.
4. **Crash report watcher** (`monitor/crashReport.ts`) — fs.watch with 5 s timer race.
5. **Redactor extensions** (`auth/redact.ts`) — 3 new patterns per D-20.
6. **Path helper** (`paths.ts`) — single source for every OS-specific path.
7. **Settings persistence** (`settings/store.ts`) — schema v1, atomic write, migration stub.

## Main-Menu Detection

**Goal:** Identify ONE stdout line from 1.8.9 Forge-less vanilla that fires ONCE when the main menu is ready. Match must be deterministic and testable.

**Candidates (community-verified log samples):**

| Line | Where | Reliability | Notes |
|------|-------|-------------|-------|
| `[Client thread/INFO]: Setting user: <name>` | Very early — before LWJGL native load | LOW for "main menu ready" | Fires before the OpenGL context exists. Minimizing here leaves the window not-yet-visible. |
| `[Client thread/INFO]: LWJGL Version: 2.9.4` | Mid-boot | LOW | Fires before GUI. |
| `[Client thread/INFO]: Starting up SoundSystem...` | Mid-boot | LOW | Fires before main menu. |
| `[Client thread/INFO]: OpenAL initialized.` | Sound init succeeded | **MEDIUM** but fragile | Does NOT fire when OpenAL fails to load (common on some Linux / exotic audio configs). Then fallback path emits `Switching to No Sound` + `(Silent Mode)`. **On macOS especially prone to OpenAL load failures.** |
| `[Client thread/INFO]: Sound engine started` | **ALWAYS fires** — on both success and silent-mode fallback | **HIGH** | Community logs confirm this fires on BOTH paths (OpenAL success AND silent-mode fallback). Happens AFTER OpenAL init and essentially coincides with "main menu ready to render." This is the safest sentinel. |
| `[Client thread/INFO]: Stopping!` (inverse) | On clean quit | HIGH but inverse | Confirms shutdown, not start. Useful for a redundant path. |

**Recommendation:** Primary sentinel **`Sound engine started`**. Regex:

```typescript
// Source: community log samples (minecraftforum, hypixel.net — see Sources)
// Fires on both OpenAL-success AND silent-mode fallback code paths.
const MAIN_MENU_PATTERN = /\[.*?\/INFO\]:\s+Sound engine started$/

// Alternate looser version if Mojang changes the thread/log prefix:
const MAIN_MENU_PATTERN_LOOSE = /Sound engine started/
```

**Testability:** The planner writes a unit test with a fixture string of an actual 1.8.9 stdout line; asserts the pattern matches exactly once and does not match any other boot line. An integration test uses a dummy Java program (`echo "[12:34:56] [Client thread/INFO]: Sound engine started"; sleep 1; exit 0`) to prove the whole pipeline fires exactly once.

**Fallback safety valve:** Start a 30 s timer when `game:status = starting`. If the sentinel hasn't fired by then, transition UI to `playing` anyway (assume we missed it / log format changed) + log a warning. This prevents the launcher from hanging indefinitely on an undetected boot.

## Crash Detection Contract

Per D-17:

| Condition | Behavior |
|-----------|----------|
| JVM exits with code 0 | **Silent.** Do nothing. Normal-quit path (user closed Minecraft window, Alt-F4, `Stop the server!` internal shutdown). Launcher restores from minimized and returns Home idle. |
| JVM exits with code ≠ 0 AND a new file appears in `<game-dir>/crash-reports/` within 5 s post-exit | **Trigger crash viewer.** Read the newest file; sanitize; display. |
| JVM exits with code ≠ 0 AND no new crash-reports file within 5 s | Use stdout+stderr tail (last ~200 lines in a ring buffer) as the crash body. Sanitize. Display crash viewer labeled "JVM crashed — no crash report written". |

**Exit codes to expect (verified community knowledge):**

| Code | Meaning | Viewer? |
|------|---------|---------|
| 0 | Clean exit (user quit or internal `System.exit(0)`) | No |
| 1 | Generic Java throw in `main` before Minecraft caught it | Yes (stdout tail) |
| 130 | SIGINT (Ctrl+C in dev) | No — treat as user cancel |
| 143 | SIGTERM (launcher cancelled spawn) | No — treat as user cancel |
| -1 / 255 | JVM crashed (hs_err_*, native crash) | Yes — Mojang does NOT write crash-reports on hs_err; use stdout tail |
| 1-99 other | Various Java `System.exit(n)` from internal errors | Yes |

**Detection implementation:**

```typescript
// Source: ARCHITECTURE.md §Pattern 3 + D-17; fs.watch is OS-native notify
import { watch } from 'node:fs'

function watchForCrashReport(crashDir: string, deadlineMs = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    const watcher = watch(crashDir, { persistent: false }, (eventType, filename) => {
      if (eventType === 'rename' && filename?.startsWith('crash-') && filename.endsWith('.txt')) {
        watcher.close()
        resolve(filename)
      }
    })
    setTimeout(() => { watcher.close(); resolve(null) }, deadlineMs)
  })
}
```

**Filename pattern:** Mojang/Forge writes `crash-YYYY-MM-DD_HH.mm.ss-client.txt` (e.g. `crash-2026-04-21_15.04.22-client.txt`). The `client` suffix distinguishes from server crashes — we only expect `-client`.

**Zero-exit-is-silent for rage-quits:** Alt-F4 on the Minecraft window produces **exit code 0** (Minecraft's shutdown hook runs). Clicking the X on the Minecraft title bar also produces exit 0. So the "zero exit = silent" contract is correct and doesn't miss rage-quits — Minecraft handles those as normal exits.

## Redaction Patterns (D-20 extension of redact.ts)

**Current `redact.ts` patterns (Phase 2, lines 15-22):**

```typescript
const JWT_PATTERN = /eyJ[A-Za-z0-9_.-]{20,}/g
const REFRESH_TOKEN_PATTERN = /refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const ACCESS_TOKEN_PATTERN = /access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const MC_ACCESS_PATTERN = /"accessToken":\s*"[^"]+"/g
```

**Patterns to ADD for Phase 3 (per D-20):**

```typescript
// 1. Raw MC access token shape from prismarine-auth's getMinecraftJavaToken()
// Shape: opaque ~280-char string. Observed via api.minecraftservices.com/authentication/
// login_with_xbox response body's "access_token" field. Not a JWT — a server-issued
// opaque bearer. Safest pattern: the --accessToken command-line form, since the raw
// token can collide with random alphanumerics. Requires the --accessToken prefix.
const MC_TOKEN_CLI_PATTERN = /--accessToken\s+[A-Za-z0-9._-]+/g
// Replacement: '--accessToken [REDACTED]'

// 2. Windows user path: C:\Users\<name>\...  (backslash or forward slash; quoted or not)
//    Use negative class instead of . to avoid greedy-match line eaters.
const WINDOWS_USER_PATH_PATTERN = /([A-Z]:[\\/])Users[\\/]([^\\/\s"'`]+)/g
// Replacement: '$1Users$1<USER>'  (preserve the separator the source used)

// 3. macOS user path: /Users/<name>/...
const MACOS_USER_PATH_PATTERN = /\/Users\/([^\/\s"'`]+)/g
// Replacement: '/Users/<USER>'

// 4. Unexpanded environment references — these DO appear in crash dumps from Forge
//    when it logs the launch command verbatim (unexpanded on Windows in rare cases).
//    Redact them too to be safe.
const WINDOWS_ENV_USERNAME_PATTERN = /%USERNAME%/g          // Windows — literal form
const UNIX_ENV_USER_PATTERN = /\$USER\b/g                   // Unix shell form (rare in crashes)
const UNIX_ENV_HOME_PATTERN = /\$HOME\b/g                   // Unix shell form
// Replacements: '<USER>', '<USER>', '<HOME>' respectively
```

**Application order (longest/most-specific FIRST to avoid partial matches):**

```typescript
function scrub(s: string): string {
  return s
    .replace(MC_TOKEN_CLI_PATTERN, '--accessToken [REDACTED]')  // longest prefix
    .replace(MC_ACCESS_PATTERN, '"accessToken": "[REDACTED]"')  // JSON shape
    .replace(JWT_PATTERN, 'eyJ[REDACTED]')                      // JWT body
    .replace(REFRESH_TOKEN_PATTERN, 'refresh_token: [REDACTED]')
    .replace(ACCESS_TOKEN_PATTERN, 'access_token: [REDACTED]')
    .replace(WINDOWS_USER_PATH_PATTERN, '$1Users$1<USER>')     // before macOS (more specific)
    .replace(MACOS_USER_PATH_PATTERN, '/Users/<USER>')
    .replace(WINDOWS_ENV_USERNAME_PATTERN, '<USER>')
    .replace(UNIX_ENV_USER_PATTERN, '<USER>')
    .replace(UNIX_ENV_HOME_PATTERN, '<HOME>')
}
```

**On MC access token shape:** `prismarine-auth` ultimately returns the opaque token from `api.minecraftservices.com/authentication/login_with_xbox`'s `access_token` response field. Per the Minecraft auth scheme documentation, this is a 24-hour-lifespan opaque bearer (~280 chars, URL-safe base64-like but not a JWT). Trying to match the raw token-body alone via regex is DANGEROUS — it would hit many false positives (hex build IDs, hash strings). **Always match contextually** (`--accessToken <value>` OR `"accessToken":"<value>"` OR `access_token: <value>`). The redactor catches both the CLI form (what shows up in Forge's logged launch command + hs_err dumps) and the JSON form (what shows up in any stray log of the xbox-response body).

**Sanitizer as a pure function (D-21 single source):**

```typescript
// launcher/src/main/auth/redact.ts — add these exports
export function sanitizeCrashReport(raw: string): string {
  return scrub(raw)   // exact same scrub used by the electron-log hook
}
```

The renderer can't import main-process code directly, but can receive already-sanitized text via IPC. For D-21 the rule is: `logs.readCrash` returns `{ sanitizedBody: scrub(fileBody) }` and the clipboard write on the renderer-side does `navigator.clipboard.writeText(store.sanitizedBody)` — copy-source and display-source are the same string.

**Unit test for D-21 (REQUIRED):**

```typescript
// launcher/src/main/auth/redact.test.ts (extend existing)
it('sanitizes a crash report containing a fake MC token', () => {
  const fake = 'stacktrace … --accessToken ey.fakeTokenBody123 … C:\\Users\\Alice\\foo'
  const out = sanitizeCrashReport(fake)
  expect(out).toContain('--accessToken [REDACTED]')
  expect(out).toContain('C:\\Users\\<USER>\\foo')
  expect(out).not.toContain('fakeTokenBody123')
  expect(out).not.toContain('Alice')
})
```

Renderer-side test (jsdom) that asserts the same string reaches both the rendered `<pre>` AND the clipboard stub:

```typescript
// launcher/src/renderer/src/components/CrashViewer.test.tsx
it('pipes identical sanitized text to display AND clipboard', async () => {
  // … setup CrashViewer with sanitizedBody prop …
  const writeText = vi.fn()
  Object.assign(navigator, { clipboard: { writeText } })
  render(<CrashViewer sanitizedBody="foo --accessToken [REDACTED] bar" />)
  await userEvent.click(screen.getByRole('button', { name: /copy report/i }))
  const displayed = screen.getByRole('region', { name: /crash report/i }).textContent
  expect(writeText).toHaveBeenCalledWith(displayed)
})
```

## JVM argv for 1.8.9 (vanilla)

**Canonical argv (final spawn call) — annotate each argument's origin:**

```bash
<bundled-jre>/bin/java[.exe] \
  -Xmx${ramMb}M \
  -Xms${ramMb}M \
  -XX:+UseG1GC \
  -XX:+UnlockExperimentalVMOptions \
  -XX:G1HeapRegionSize=32M \
  -XX:MaxGCPauseMillis=50 \
  -Djava.library.path=${nativesDir} \
  -Dminecraft.launcher.brand=wiiwho-launcher \
  -Dminecraft.launcher.version=0.1.0 \
  -cp ${classpath}     # ';' separator on Windows, ':' on macOS \
  net.minecraft.client.main.Main \
  --username ${auth_player_name} \
  --version 1.8.9 \
  --gameDir ${game_directory} \
  --assetsDir ${assets_root} \
  --assetIndex 1.8 \
  --uuid ${auth_uuid} \
  --accessToken ${auth_access_token} \
  --userProperties {} \
  --userType msa \
  --versionType release
```

**Notes / origins:**

| Part | Source / rationale |
|------|-------|
| `-Xmx` / `-Xms` | Equal heap sizes avoid mid-play GC resize. Value from `settings.ramMb` (1024-4096). |
| G1GC flags | **`-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1HeapRegionSize=32M -XX:MaxGCPauseMillis=50`** — matches PITFALLS.md §Pitfall 11 ("G1GC-tuned JVM args as default — `-XX:+UseG1GC -XX:MaxGCPauseMillis=50`") + Patcher-style defaults. `UnlockExperimentalVMOptions` is required on Java 8 to use `G1HeapRegionSize`. |
| `-Djava.library.path=` | Path to the natives-extract directory: `<data-dir>/game/versions/1.8.9/natives/`. |
| `-Dminecraft.launcher.brand/version` | Identifies us as the launcher in crash dumps + telemetry. `brand=wiiwho-launcher` (kebab, matches Lunar `lunar-client` convention). |
| `-cp` | Classpath separator `;` on Windows, `:` on macOS — use `path.delimiter`. Order: every library jar (in dep order) + `client.jar`. Phase 4 prepends the Wiiwho mod jar. |
| `net.minecraft.client.main.Main` | **Verified main class from live 1.8.9.json.** NOT `launchwrapper.Launch` (that's Forge-only). |
| `--userType msa` | `msa` (Microsoft account) is the valid value for MS-authenticated launches. `mojang` is legacy Yggdrasil (dead). |
| `--versionType release` | Matches the `type` field in 1.8.9.json. Not strictly required by the game but present in Mojang's own launcher argv. |
| `--userProperties {}` | Literal `"{}"` — 1.8.9 expects the `${user_properties}` placeholder to be substituted with an empty JSON object if we have no properties. |

**Placeholder substitution implementation:** Do NOT `.replace` the manifest's `minecraftArguments` string directly — it's too brittle. Parse into an array of tokens, identify `${...}` tokens, substitute from a lookup map. @xmcl/core likely exposes this via `launch()`-internal helpers; if we roll our own, test with the canonical 1.8.9 string from `1.8.9.json`.

## JVM Spawn

**Wrapper:**

```typescript
// Source: execa 9.x README; cancelSignal verified current
import { execa, ExecaError } from 'execa'

interface SpawnOpts {
  javaPath: string            // absolute — bundled JRE
  argv: string[]              // jvmArgs + mainClass + gameArgs
  cwd: string                 // game-dir (Mojang expects this)
  abortSignal: AbortSignal    // from Cancel control
  onLine: (line: string, stream: 'out' | 'err') => void
}

async function spawnGame(opts: SpawnOpts): Promise<{ exitCode: number | null }> {
  try {
    const sub = execa(opts.javaPath, opts.argv, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      cancelSignal: opts.abortSignal,
      all: false,   // keep stdout/stderr separate for log-parser stream tagging
      env: {
        ...process.env,
        _JAVA_OPTIONS: undefined  // avoid users overriding heap via env
      }
    })
    const split = (stream: 'out' | 'err') => (chunk: Buffer) =>
      chunk.toString('utf8').split(/\r?\n/).forEach(line => line && opts.onLine(line, stream))
    sub.stdout?.on('data', split('out'))
    sub.stderr?.on('data', split('err'))
    const r = await sub
    return { exitCode: r.exitCode ?? 0 }
  } catch (err) {
    if (err instanceof ExecaError) return { exitCode: err.exitCode ?? -1 }
    throw err
  }
}
```

**Why execa (PITFALLS.md §Pitfall 8):** `child_process.exec` buffers stdout → truncation at ~200 KB → lost crash-report blocks. `execa` streams. Windows path-quoting (e.g. `C:\Program Files\…\java.exe`) handled automatically.

**Cancel wiring (for D-13 Downloading/Verifying cancel — NOT JVM cancel):** Phase 3 cancel operates on the DOWNLOAD phase, not the JVM. The abort controller lives in the game handler's orchestration; xmcl installers accept an abort signal via their options. Once spawn fires, cancel is no longer available (D-13 locks this). The spawn wrapper still wires `cancelSignal` as a belt-and-braces for developer-mode testing.

## Resource-Path Resolution (dev vs packaged)

**Problem:** `electron-builder`'s `extraResources` copies files to:
- **Windows packaged:** `<install-dir>/resources/jre/<arch>/...`
- **macOS packaged:** `<App.app>/Contents/Resources/jre/<arch>/...`
- **Dev mode:** resources live at `launcher/resources/jre/<arch>/...` relative to the project root

The Electron APIs:
- `app.getAppPath()` returns the asar path in packaged mode; project root in dev.
- `process.resourcesPath` returns the `Contents/Resources` (mac) or `resources/` (win) dir in packaged; in dev it points to Electron's own `resources/` which has no JRE.

**Standard pattern:** Use `process.resourcesPath` in packaged mode, `app.getAppPath()` in dev.

```typescript
// launcher/src/main/paths.ts — NEW FILE (single source for all paths)
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'node:path'
import os from 'node:os'

export function resolveJreDir(): string {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const platform = process.platform === 'darwin' ? 'mac' : 'win'
  const subdir = `${platform}-${arch}`  // e.g. 'win-x64', 'mac-arm64', 'mac-x64'
  if (is.dev) {
    return path.join(app.getAppPath(), 'resources', 'jre', subdir)
  }
  return path.join(process.resourcesPath, 'jre', subdir)
}

export function resolveJavaBinary(): string {
  const jre = resolveJreDir()
  if (process.platform === 'win32') return path.join(jre, 'bin', 'javaw.exe')
  if (process.platform === 'darwin') return path.join(jre, 'Contents', 'Home', 'bin', 'java')
  throw new Error(`Unsupported platform: ${process.platform}`)  // linux deferred
}

export function resolveModJar(): string {
  const base = is.dev
    ? path.join(app.getAppPath(), 'resources', 'mod')
    : path.join(process.resourcesPath, 'mod')
  return path.join(base, 'wiiwho-0.1.0.jar')
}

export function resolveDataRoot(): string {
  // Mirrors Phase 2's inherited convention via safeStorageCache.ts.
  // userData resolves to:
  //   Windows: %APPDATA%/Wiiwho/
  //   macOS:   ~/Library/Application Support/Wiiwho/
  return app.getPath('userData')
}

export function resolveGameDir(): string { return path.join(resolveDataRoot(), 'game') }
export function resolveSettingsFile(): string { return path.join(resolveDataRoot(), 'settings.json') }
export function resolveCrashReportsDir(): string { return path.join(resolveGameDir(), 'crash-reports') }
```

**Windows-specific:** Use `javaw.exe` (no-console variant) instead of `java.exe` — otherwise every game launch spawns a phantom black console window. Mac/Linux only have `java`.

**asarUnpack:** Must list `resources/**` (already in the current `electron-builder.yml`) because Java cannot exec from inside an asar archive. The JRE binaries must land on the real filesystem.

## electron-builder Config Fragment

**Full `launcher/electron-builder.yml` rewrite (current file is an un-tuned template):**

```yaml
# Source: electron-builder 26.x docs (electron.build/configuration) — verified 2026-04-21
appId: club.wiiwho.launcher
productName: Wiiwho Client
copyright: Copyright © 2026 Wiiwho Client

directories:
  buildResources: build
  output: dist

# Exclude dev-only files from the asar. Current template values kept + augmented.
files:
  - '!**/.vscode/*'
  - '!src/*'
  - '!electron.vite.config.{js,ts,mjs,cjs}'
  - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}'
  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'
  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
  - '!{vitest.config.ts,**/*.test.ts,**/*.test.tsx}'   # NEW — exclude test files

# JRE + mod jar must unpack to real filesystem (Java can't exec from inside asar).
asarUnpack:
  - resources/**

# Phase 3 does NOT sign or notarize (PROJECT.md deferred).
npmRebuild: false

# ---- Windows NSIS target (PKG-01 / D-23) ----
win:
  target:
    - target: nsis
      arch: x64
  executableName: Wiiwho       # produces Wiiwho.exe per Phase 1 D-03
  icon: resources/icon.png
  # Extra resources LIFTED into the win install dir at resources/jre/win-x64/
  extraResources:
    - from: resources/jre/win-x64
      to: jre/win-x64
    - from: resources/mod
      to: mod

nsis:
  artifactName: Wiiwho Client Setup.exe
  oneClick: false                           # assisted installer (user sees progress + install dir)
  allowElevation: true
  perMachine: false                         # per-user install at %LOCALAPPDATA%\Programs\Wiiwho\
  allowToChangeInstallationDirectory: false  # D-23 locks default path
  createDesktopShortcut: always
  createStartMenuShortcut: true
  shortcutName: Wiiwho Client
  uninstallDisplayName: Wiiwho Client
  # Claude's Discretion pick: keep %APPDATA%/Wiiwho/ on uninstall (less destructive).
  # NSIS auto-generates a "Remove user data" checkbox via deleteAppDataOnUninstall=false +
  # a custom NSH macro if we want to expose the toggle. v0.1: no toggle, keep data.
  deleteAppDataOnUninstall: false

# ---- macOS DMG target (PKG-02 / D-22) ----
mac:
  target:
    - target: dmg
      arch: universal                       # Universal = both arm64 + x64 (D-22)
  category: public.app-category.games
  icon: resources/icon.png
  # ⚠ identity: null + notarize: false leave the app ad-hoc-signed only.
  # PKG-02 accepts unsigned for v0.1; right-click-Open workaround doc ships in DMG.
  identity: null
  notarize: false
  # Both JRE slots bundled regardless of arch — runtime picks the right subdir.
  extraResources:
    - from: resources/jre/mac-arm64
      to: jre/mac-arm64
    - from: resources/jre/mac-x64
      to: jre/mac-x64
    - from: resources/mod
      to: mod

dmg:
  artifactName: Wiiwho.dmg
  title: Wiiwho Client
  # Drop a plain-text workaround note INSIDE the DMG next to the app bundle.
  # The user opens the DMG, sees Wiiwho.app + README-macOS.txt side by side.
  # Content of that file is created by a prebuild script from docs/install-macos.md.
  contents:
    - x: 140
      y: 180
      type: file
      path: Wiiwho.app
    - x: 400
      y: 180
      type: link
      path: /Applications
    - x: 270
      y: 330
      type: file
      path: build/README-macOS.txt
```

**What's excluded on purpose:**
- **Linux targets** — removed (PROJECT.md out-of-scope).
- **publish block** — removed. v0.1 has no auto-update, no published feed. Revisit for v0.2.
- **Code-signing identity, notarization** — explicitly disabled (D-23 accepts unsigned Win + ad-hoc mac).

**Universal DMG and per-arch JRE — the gotcha:**

`@electron/universal` (which `arch: universal` triggers) merges an x64 app bundle and an arm64 app bundle into a single Universal `.app`. It verifies files in `Contents/Resources/` are byte-identical between the two inputs; architecture-unique files must be listed in `singleArchFiles`.

Our JRE layout sidesteps this because we ship BOTH JREs (both arm64 AND x64) in BOTH arch app bundles. Each arch build's `Contents/Resources/jre/mac-arm64/` and `.../mac-x64/` are identical across arch builds — so `@electron/universal`'s byte-compare passes. At runtime, `paths.ts` picks the subdir matching `process.arch`.

**Risk:** This doubles the mac installer size (~70 MB x64 + ~70 MB arm64 = ~140 MB of JRE). That's exactly what D-22 already accepted ("~140 MB JRE payload").

**macOS unsigned-right-click-Open workaround doc:** The user's DMG contains `Wiiwho.app`, an alias to `/Applications`, AND a `README-macOS.txt` file generated by the prebuild script from `docs/install-macos.md`. The text reads:

```
Opening Wiiwho on macOS for the first time

Because Wiiwho Client v0.1 isn't signed with an Apple Developer ID, macOS Gatekeeper will refuse to open it directly. You only need to do this ONCE — after first launch, macOS remembers.

1. Drag Wiiwho.app into the Applications folder (drag it onto the arrow).
2. Open your Applications folder.
3. Find Wiiwho — RIGHT-CLICK (or two-finger-click) it.
4. Choose "Open" from the menu.
5. A dialog will appear saying Wiiwho is from an unidentified developer — click "Open" again.
6. Wiiwho launches. Subsequent launches work normally.

Source: https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac
```

## Temurin Sourcing

**Recommendation: download JRE tarballs into `launcher/resources/jre/<arch>/` via a committed-but-gitignored pre-build script.** Rationale:

- **Reproducibility:** Pins the JRE version in the repo (via a script with hardcoded URLs + SHA256s), not at CI time.
- **CI friction:** Low — one `pnpm run prefetch-jre` before `pnpm run build:win` / `build:mac`.
- **Offline-first:** Builds on machines without internet (once JREs are on disk) work.
- **Disk cost:** ~210 MB of unpacked JRE in `resources/jre/` during build — gitignored, zero repo-size impact.

**Pre-build script (`launcher/scripts/prefetch-jre.mjs`) — conceptual:**

```javascript
// Source: Adoptium API verified live 2026-04-21 (api.adoptium.net/v3/assets/latest/8/hotspot)
//         Azul metadata API verified live (api.azul.com/metadata/v1/zulu/packages)
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'

const JRE_SOURCES = [
  {
    arch: 'win-x64',
    url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_windows_hotspot_8u482b08.zip',
    sha256Url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_windows_hotspot_8u482b08.zip.sha256.txt',
    // Post-extract the top-level dir will be `jdk8u482-b08-jre/` — symlink or rename to `win-x64/`
    extractedRoot: 'jdk8u482-b08-jre'
  },
  {
    arch: 'mac-x64',
    url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz',
    sha256Url: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz.sha256.txt',
    extractedRoot: 'jdk8u482-b08-jre'  // extracts to jdk8u482-b08-jre/Contents/Home/bin/java
  },
  {
    arch: 'mac-arm64',
    // ⚠ Temurin has NO arm64 JRE for Java 8. Must use Azul Zulu.
    url: 'https://cdn.azul.com/zulu/bin/zulu8.92.0.21-ca-jre8.0.482-macosx_aarch64.tar.gz',
    sha256Url: null,  // Azul uses different checksum infrastructure — fetch separately via metadata API
    extractedRoot: 'zulu8.92.0.21-ca-jre8.0.482-macosx_aarch64'
  }
]

// For each entry: fetch url → verify sha256 (fetch sha256Url and compare) →
// extract into launcher/resources/jre/<arch>/.  NO downloads on `npm install`
// (this is a separate script that runs only at package-time).
```

**Exact URLs verified live 2026-04-21:**

| Arch | Vendor | Version | URL |
|------|--------|---------|-----|
| win-x64 | **Temurin** | 8u482-b08 | `https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_windows_hotspot_8u482b08.zip` |
| mac-x64 | **Temurin** | 8u482-b08 | `https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u482-b08/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz` |
| mac-arm64 | **Azul Zulu** | 8u482 (Zulu 8.92.0.21) | `https://cdn.azul.com/zulu/bin/zulu8.92.0.21-ca-jre8.0.482-macosx_aarch64.tar.gz` |

(The .msi / .pkg installer variants also exist but we want the .zip / .tar.gz — we unpack into `resources/jre/`, we don't run installers.)

**SHA256 verification:** For Temurin, fetch the sibling `.sha256.txt`. For Zulu, the Azul metadata API returns a `sha256_hash` field per package (call `api.azul.com/metadata/v1/zulu/packages/<uuid>/` if precision required). Reject any download whose hash doesn't match; fail the build.

**Trim the JRE:** Temurin JREs include `jmods/`, `man/`, `legal/`. `jmods/` is for jlink and can be deleted from a JRE shipment to save ~20 MB per platform; `man/` and `legal/` are small but safe to drop. Planner's decision: ship trimmed variants to keep installer under 300 MB.

**Gitignore:** Add `launcher/resources/jre/` to `.gitignore` so the JRE isn't committed. The prefetch script repopulates on clean checkout.

## Mod Jar Bundling (coordination with `client-mod/`)

**The requirement:** PKG-01 + PKG-02 + SC4 require the installer bundle `wiiwho-0.1.0.jar`. Phase 4 is responsible for the launcher INJECTING it into the classpath. Phase 3 only needs the jar to exist on the packaged filesystem at a known path — our paths.ts resolves to `launcher/resources/mod/wiiwho-0.1.0.jar`.

**Current state (verified 2026-04-21):**
- `client-mod/build.gradle.kts` is fully set up — produces `client-mod/build/libs/wiiwho-0.1.0.jar` when `./gradlew build` runs.
- Currently NO built jar exists on disk (no `build/libs/` directory present).
- `gradle.properties` pins `version=0.1.0-SNAPSHOT` — the jar will actually be named `wiiwho-0.1.0-SNAPSHOT.jar` unless we drop the `-SNAPSHOT` suffix for release builds. **Plan decision: pass `version=0.1.0` for release builds via `-Pversion=0.1.0`** or flip the gradle.properties value permanently to `0.1.0`.

**Recommended path: option (b) pre-release script, NOT a committed binary.**

```jsonc
// launcher/package.json — add these scripts
{
  "scripts": {
    "prefetch-jre": "node scripts/prefetch-jre.mjs",
    "build-mod": "pnpm --filter=none sh scripts/build-mod.sh",
    "package-resources": "pnpm run prefetch-jre && pnpm run build-mod",
    "dist:win": "pnpm run package-resources && pnpm run build && electron-builder --win",
    "dist:mac": "pnpm run package-resources && pnpm run build && electron-builder --mac"
  }
}
```

Where `scripts/build-mod.sh` does:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd ../client-mod
./gradlew build -Pversion=0.1.0
cd ../launcher
mkdir -p resources/mod
cp ../client-mod/build/libs/wiiwho-0.1.0.jar resources/mod/wiiwho-0.1.0.jar
```

**Why option (b) over (a):**

- Option (a) — committing a placeholder binary — means the jar content is stale forever until Phase 4 replaces it. That's a silent-drift risk.
- Option (b) — pre-release script — means `pnpm run dist:win` always produces an installer with the current client-mod build. Matches the repo's existing structure. `client-mod/` already has a functional Gradle build from Phase 1.
- The `client-mod/` gradle build is greenfield: it has `wiiwho` `@Mod` class + Mixin bootstrap + DevAuth dependency (runtime-only). `./gradlew build` may need a minimal adjustment if the current `@Mod` class requires a real class to exist — verify in plan-execute. Per Phase 1 completion notes, `./gradlew runClient` works, which implies `./gradlew build` is close to working too.

**Phase 3-vs-Phase 4 boundary clarity:**

- **Phase 3:** bundles the jar in the installer. Does not put it on the game classpath. Does not add `--tweakClass` to the JVM argv.
- **Phase 4:** copies the bundled jar into `<game-dir>/mods/` at launch, appends `--tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker`, and adds Forge to the classpath (requires downloading Forge, which LCH-04 tracks). Phase 3's vanilla launch path is truly vanilla — no Forge, no mod.

**Gitignore:** Add `launcher/resources/mod/` to `.gitignore` — the jar is ephemeral build output. Same as JRE.

## Settings Schema

**File path:** `<userData>/settings.json` i.e. `%APPDATA%/Wiiwho/settings.json` (Windows) / `~/Library/Application Support/Wiiwho/settings.json` (macOS). Reuses the path convention locked by Phase 2 (`safeStorageCache.ts` uses same root).

**Schema v1:**

```typescript
// launcher/src/main/settings/store.ts — NEW FILE
export interface SettingsV1 {
  version: 1                  // schema version for forward-compat migrations
  ramMb: number               // 1024 | 1536 | 2048 | 2560 | 3072 | 3584 | 4096 (D-04)
  firstRunSeen: boolean       // true after first Play click completes; gates the one-time "~60 MB first download" hint
}

const DEFAULTS: SettingsV1 = {
  version: 1,
  ramMb: 2048,                // D-04
  firstRunSeen: false
}

function migrate(raw: unknown): SettingsV1 {
  if (typeof raw !== 'object' || raw === null) return DEFAULTS
  const obj = raw as Record<string, unknown>
  // v1 is the only version we know; future versions add cases here.
  switch (obj.version) {
    case 1: {
      const v = obj as Partial<SettingsV1>
      return {
        version: 1,
        ramMb: clampRam(typeof v.ramMb === 'number' ? v.ramMb : DEFAULTS.ramMb),
        firstRunSeen: typeof v.firstRunSeen === 'boolean' ? v.firstRunSeen : DEFAULTS.firstRunSeen
      }
    }
    default:
      return DEFAULTS          // unknown version → reset to defaults (acceptable for v0.1)
  }
}

function clampRam(r: number): number {
  // D-04: range 1024-4096 in 512 MB steps.
  const clamped = Math.max(1024, Math.min(4096, r))
  const stepped = Math.round(clamped / 512) * 512
  return stepped
}
```

**Persistence (atomic write):**

```typescript
import { promises as fs } from 'node:fs'
import { resolveSettingsFile } from '../paths'

export async function readSettings(): Promise<SettingsV1> {
  try {
    const raw = await fs.readFile(resolveSettingsFile(), 'utf8')
    return migrate(JSON.parse(raw))
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULTS
    throw err
  }
}

export async function writeSettings(v: SettingsV1): Promise<void> {
  const path = resolveSettingsFile()
  const tmp = `${path}.tmp`
  await fs.mkdir(require('node:path').dirname(path), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify(v, null, 2))
  await fs.rename(tmp, path)
}
```

**IPC wiring:** `settings:get` returns the full settings object; `settings:set` merges a patch + validates + writes. Current `ipc/settings.ts` stub holds in-memory state — Phase 3 replaces the body with calls to the store functions. Preload surface (`settings.get` / `settings.set`) is UNCHANGED.

## Launch Log Retention

**electron-log 5 defaults (verified via library docs):**

- **Write path:** `<userData>/logs/main.log` — i.e. `%APPDATA%/Wiiwho/logs/main.log` on Windows, `~/Library/Logs/Wiiwho/main.log` on macOS (the mac path uses the `Logs` convention, which is a real macOS user directory).
- **Rotation:** default 1,048,576 bytes (1 MB) per file, archives trimmed to 5 old files. Total retention ~5 MB. Plan can bump to `maxSize: 5_242_880` (5 MB) if we want more headroom for debugging — not required.

**Tailing for failed-launch log panel (D-11):** When the JVM exits non-zero and the crash-report file appears OR times out, grab the **last 30 lines** (planner's D-11 suggestion) from a ring buffer maintained by `monitor/logParser.ts`. Do NOT re-read the log file — the game process writes to stdout, which we buffer in memory; the buffer is authoritative.

**Ring buffer:** A simple `Array<{line: string, stream: 'out'|'err'}>` with a 500-line cap; `push` + `shift-if-overflow`. At exit time, `.slice(-30)` for the fail-path display. Already-scrubbed via the `installRedactor()` hook (every log call passes through).

## Anticheat Consideration (Phase 3 merge-gate)

Phase 3 adds ZERO in-game code:
- No mod jar classpath injection (Phase 4 / LCH-04).
- No `--tweakClass` in argv (vanilla path only).
- No instrumentation of the game process beyond stdout reading.
- No network observation of the game's traffic.
- No packet modification.

**`docs/ANTICHEAT-SAFETY.md` check at merge:** No new rows required. The existing `wiiwho` MODID row (Phase 1 approved) covers the mod-handshake surface. Launcher changes don't touch the mod jar classpath, so there's nothing to add. The merge-gate verifier should assert: no changes to `client-mod/src/main/java/**`, no new `--tweakClass` strings in argv generators, no new `-javaagent` entries.

## Runtime State Inventory

Phase 3 is greenfield code, not a rename/refactor. **Not applicable** — no runtime state to migrate. New state that gets created:

- New file: `<userData>/settings.json` (plain JSON). Does not collide with anything Phase 2 wrote.
- New dir: `<userData>/game/` (game data). Does not collide with `<userData>/auth/` or `<userData>/auth.bin`.
- New dir: `<userData>/logs/` (electron-log output). Phase 2 may have already created this if any log call fired — benign overlap.

## Common Pitfalls

### Pitfall 1: Bundling the Mojang jar to speed up first launch

**What goes wrong:** Putting `1.8.9.jar` in `resources/mc/` "for convenience" — violates Mojang EULA (PITFALLS.md §Pitfall 3 + docs/mojang-asset-policy.md).
**Prevention:** `resources/mod/` contains ONLY our mod jar. `resources/jre/` contains ONLY the Temurin/Zulu JRE. Every Mojang-copyrighted byte downloads at runtime from `launchermeta.mojang.com` + `libraries.minecraft.net` + `resources.download.minecraft.net`.
**Warning sign:** Any code path that embeds a Mojang URL at install-time rather than fetch-time.

### Pitfall 2: Using `launchwrapper.Launch` as main class for vanilla Phase 3

**What goes wrong:** Copying ARCHITECTURE.md's argv (which assumes Forge loaded) verbatim → JVM tries to load LaunchWrapper class, fails with `ClassNotFoundException`.
**Prevention:** Phase 3 mainClass is **`net.minecraft.client.main.Main`**. Verified from live 1.8.9.json. LaunchWrapper is Phase 4 (when Forge adds `--tweakClass`).
**Warning sign:** Any args.ts logic involving `FMLTweaker` or `MixinTweaker` — those are Phase 4.

### Pitfall 3: Assuming Temurin has an arm64 JRE for Java 8

**What goes wrong:** Hardcoding Temurin URLs for both mac-x64 and mac-arm64 → prefetch script 404s on mac-arm64 URL → build fails OR the arm64 slot silently contains a placeholder OR someone drops x64 binaries into mac-arm64 and the arm64 user gets Rosetta-emulated Java (defeats arm64 bundle purpose).
**Prevention:** Use Azul Zulu for mac-arm64 (only vendor with JRE 8 arm64 on macOS as of 2026-04-21). Document the split in prefetch-jre.mjs comments.
**Warning sign:** `curl` on the Adoptium URL with `arch=aarch64` returning an empty JSON array.

### Pitfall 4: Stdout truncation losing the crash report

**What goes wrong:** Using `child_process.exec` → 200 KB stdout buffer → Forge's crash block (which can be 100s of lines) is cut off mid-stack-trace → crash viewer shows partial garbage.
**Prevention:** `execa` with stream listeners; NEVER `exec`. The 500-line ring buffer in `monitor/logParser.ts` is additional defense.
**Warning sign:** Plan text that says "pass the command string to exec" anywhere. Pitfall 8 in STACK.md's "What NOT to Use" makes this explicit.

### Pitfall 5: Dual-path redaction (D-21 violation)

**What goes wrong:** Two code paths compute redaction — one for display (e.g. in React component), one for clipboard (different regex or different order). User sees sanitized on screen, clipboard has raw token. Discord paste leaks.
**Prevention:** ONE `sanitizeCrashReport()` function exported from `redact.ts`. Called once in main; the sanitized string is what `logs:read-crash` returns. Renderer writes THAT string to clipboard, no second sanitize pass. Test asserts both call-sites use the SAME input.
**Warning sign:** Any renderer-side regex in a CrashViewer component. Any import of `redact` helpers from the renderer.

### Pitfall 6: Universal DMG failing @electron/universal byte-compare

**What goes wrong:** Trying to smart-include mac-arm64 JRE only in the arm64 arch build and mac-x64 JRE only in the x64 build → @electron/universal sees architecture-unique files in Resources → hard error unless in `singleArchFiles`.
**Prevention:** Ship BOTH JREs in BOTH arch builds. Each arch build's `Resources/jre/mac-arm64/` and `Resources/jre/mac-x64/` are byte-identical across builds. Runtime picks the right one via `process.arch`. Cost: ~140 MB (already budgeted in D-22).
**Warning sign:** An `arch`-conditional in `mac.extraResources`.

### Pitfall 7: Windows `java.exe` spawning a black console window

**What goes wrong:** Argv uses `<jre>/bin/java.exe` → every launch flashes a cmd-like console window that lingers while MC runs.
**Prevention:** On Windows, use `<jre>/bin/javaw.exe` (windowed variant, no console). `paths.ts::resolveJavaBinary()` handles the switch.
**Warning sign:** Any Windows test asserting `java.exe` in the argv.

### Pitfall 8: Forge-specific asset index `.2` used instead of `1.8`

**What goes wrong:** Copying a Forge launcher snippet that uses `--assetIndex 1.8.9` or `--assetIndex 1.8.2` → game crashes on asset load or renders without textures.
**Prevention:** `--assetIndex 1.8` — EXACTLY. Verified from live 1.8.9.json's `assetIndex.id`.
**Warning sign:** Asset index string ≠ `"1.8"`.

### Pitfall 9: Mac Gatekeeper eating the unsigned JRE executable

**What goes wrong:** First Mac launch succeeds for the main Wiiwho app (user did the right-click-Open dance) but JRE's `/Contents/Resources/jre/mac-*/Contents/Home/bin/java` executable is quarantined separately → spawn returns ENOEXEC or EPERM.
**Prevention:** Test a clean Mac install of the built DMG BEFORE calling Phase 3 done. If Gatekeeper re-flags the JRE, add a post-install `xattr -dr com.apple.quarantine <jre-dir>` step documented in README-macOS.txt (user runs from terminal; acceptable for v0.1 per PKG-02 "documented workaround").
**Warning sign:** `java: bad CPU type in executable` (arm64 JRE on x64 or vice-versa) or `Operation not permitted` on spawn.

### Pitfall 10: RAM slider user crank → 16 GB on a 4 GB machine → OS swap

**What goes wrong:** User drags slider past hard cap (if cap isn't enforced) → JVM allocates heap bigger than RAM → OS swaps → game becomes unusable.
**Prevention:** UI enforces 1024-4096 hard bounds (D-04 via Radix Slider min/max). Main-side validator re-clamps on `settings:set` as belt-and-braces. PITFALLS.md §Pitfall 11 documents the 4 GB cap for Java 8 PvP.
**Warning sign:** Settings schema without `clampRam()` pre-write.

## Environment Availability

Phase 3 relies on external tools at PACKAGE time (not user runtime, since JRE is bundled). Availability audit below focuses on the DEVELOPER / CI environment:

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node 22 LTS | launcher dev tooling + electron-builder | (owner-confirmed Phase 1) | 22.x | — |
| pnpm | package manager | (owner-confirmed Phase 1) | 9.x+ | npm (possible, not preferred) |
| JDK 17 | running Gradle on host | (Phase 1 verified — owner has it, `./gradlew runClient` works) | Temurin 17 | — |
| Eclipse Temurin 8 (JRE binaries, not install) | bundled in installer | Fetched via prefetch script from api.adoptium.net | 8u482-b08 | Azul Zulu 8 (vendor substitute) — same rig already used for mac-arm64 |
| Azul Zulu 8 JRE mac-arm64 | mac arm64 slot of Universal DMG | Fetched via prefetch script from cdn.azul.com | 8u482 (Zulu 8.92.0.21) | Amazon Corretto 8 arm64 — produces an alternate vendor; same API; works identically |
| Windows 10+ machine for `pnpm run dist:win` | building Windows installer | ✓ (owner's main dev box per Phase 1) | 11 Home | — |
| macOS 12+ machine for `pnpm run dist:mac` | building mac DMG | **Owner-side unknown** — CLAUDE.md says owner is on Windows | ? | Borrowed Mac OR GitHub Actions macos-14 runner OR skip mac build in Phase 3 execution and do mac dist verification manually |
| Internet during prefetch | downloading JRE tarballs | At build time only — build machine only | Any | Offline: commit the JRE tarballs locally once-off (not ideal but works) |

**Missing dependency with no fallback:** None — the mac build question is the only real one, and D-22's Universal DMG REQUIREMENT means SOMEONE must run `electron-builder --mac` on a Mac machine (electron-builder cannot cross-build macOS DMGs from Windows; the `@electron/universal` merge requires running on macOS to sign, even ad-hoc-sign).

**Missing dependency with fallback:** Apple Silicon JRE vendor (Azul Zulu ↔ Amazon Corretto — both available).

**Action for plan-execute:** Verify mac build-machine availability. If none: scope Phase 3 execute to `dist:win` only + manual mac smoke-test deferred. PKG-02 success criterion still satisfied if the owner has a one-time access window on a Mac (friend's machine, CI runner, etc.).

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | **vitest 4** with dual env (jsdom for renderer, node for main/preload) |
| Config file | `launcher/vitest.config.ts` (exists, `environmentMatchGlobs`-based; Phase 2 idiom) |
| Test file convention | Co-located `*.test.ts` sibling per module; `@vitest-environment jsdom` docblock for renderer tests; `afterEach(cleanup)` in describe blocks |
| Quick run command | `pnpm --filter ./launcher test:run` (all tests once; ~30 s) |
| Full suite command | `pnpm --filter ./launcher test:run && pnpm --filter ./launcher typecheck && pnpm --filter ./launcher lint` |
| Phase gate | Full suite + typecheck + `pnpm run build:unpack` green before `/gsd:verify-work` |

### Phase requirements → test map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| LCH-01 | Manifest parsed + 1.8.9 client.jar SHA1-verified + cached | unit | `pnpm vitest run src/main/launch/manifest.test.ts` | ❌ Wave 0 |
| LCH-01 | Corrupted cached jar → re-download triggered (SC5) | integration | `pnpm vitest run src/main/launch/libraries.integration.test.ts` | ❌ Wave 0 |
| LCH-02 | Library + asset pipeline runs to completion against fixture manifest | integration | `pnpm vitest run src/main/launch/assets.test.ts` | ❌ Wave 0 |
| LCH-03 | SHA1-valid cache hits skip download (2nd call is no-op) | unit | `pnpm vitest run src/main/launch/libraries.test.ts` | ❌ Wave 0 |
| LCH-05 | JVM argv builder produces canonical vanilla 1.8.9 argv | unit | `pnpm vitest run src/main/launch/args.test.ts` | ❌ Wave 0 |
| LCH-05 | Main-menu sentinel detected from fixture stdout; window minimize triggered | integration | `pnpm vitest run src/main/monitor/logParser.test.ts` | ❌ Wave 0 |
| LCH-05 | E2E: dummy Java program prints `Sound engine started` + exits 0 → `game:status = playing` then `= exited-cleanly` | integration | `pnpm vitest run src/main/launch/e2e.test.ts` | ❌ Wave 0 |
| LCH-05 | Reach actual main menu on developer machine (Windows) | **manual-only** (requires real MS auth + network + game window) | `pnpm run dev` → click Play; visually confirm Minecraft main menu | — |
| LCH-06 | `--userType msa` passed; real MC token flows from AuthManager | unit | `pnpm vitest run src/main/launch/args.test.ts` (argv contains `msa`) | ❌ Wave 0 |
| LCH-07 | stdout lines push `game:log` events to renderer; last 30 retained for fail-path | unit | `pnpm vitest run src/main/monitor/logParser.test.ts` | ❌ Wave 0 |
| JRE-01 | `resolveJavaBinary()` returns `resources/jre/win-x64/bin/javaw.exe` on win32 | unit | `pnpm vitest run src/main/paths.test.ts` | ❌ Wave 0 |
| JRE-02 | `resolveJavaBinary()` returns `resources/jre/mac-*/Contents/Home/bin/java` on darwin | unit | `pnpm vitest run src/main/paths.test.ts` | ❌ Wave 0 |
| JRE-03 | spawn asserts javaPath startsWith resources/jre/ (never system PATH) | unit | `pnpm vitest run src/main/launch/spawn.test.ts` | ❌ Wave 0 |
| PKG-01 | `pnpm run build:win` produces NSIS installer; installer contains `resources/jre/win-x64/bin/javaw.exe` + `resources/mod/wiiwho-0.1.0.jar` | **packaging smoke test** | Manual: inspect `launcher/dist/Wiiwho Client Setup.exe` — extract & verify paths OR use `7z l <installer>` | — |
| PKG-02 | `pnpm run build:mac` produces `Wiiwho.dmg`; mounting it shows Wiiwho.app + README-macOS.txt; bundle contains both JRE slots + mod jar | **packaging smoke test** | Manual: mount DMG + `ls Wiiwho.app/Contents/Resources/{jre,mod}/` | — |
| LAUN-03 | Radix Slider range 1024-4096, step 512, default 2048, clamped on out-of-range | unit (renderer) | `pnpm vitest run src/renderer/src/components/RamSlider.test.tsx` | ❌ Wave 0 |
| LAUN-04 | `writeSettings` → process restart → `readSettings` round-trips | unit | `pnpm vitest run src/main/settings/store.test.ts` | ❌ Wave 0 |
| LAUN-05 | Crash-reports fs.watch fires → crashViewer state = ready | unit | `pnpm vitest run src/main/monitor/crashReport.test.ts` | ❌ Wave 0 |
| LAUN-05 | Non-zero exit + fake crash-report file in fixture dir → crash viewer renders redacted body | integration | `pnpm vitest run src/main/launch/crash.integration.test.ts` | ❌ Wave 0 |
| COMP-05 | `scrub()` strips MC token, Win username, mac username, `%USERNAME%`, `$USER` from fixture crash report | unit | `pnpm vitest run src/main/auth/redact.test.ts` (extend existing) | ✅ exists |
| COMP-05 | CrashViewer: same sanitized string reaches display AND clipboard (D-21) | unit (renderer) | `pnpm vitest run src/renderer/src/components/CrashViewer.test.tsx` | ❌ Wave 0 |

### Sampling rate

- **Per task commit:** `pnpm --filter ./launcher test:run` (fast subset; vitest 4's `--changed` optional)
- **Per wave merge:** full test suite + `pnpm typecheck` + `pnpm lint` + `pnpm run build` (dev-mode bundle build)
- **Phase gate:** all the above green + `pnpm run build:unpack` (packaged but not installer-wrapped; verifies resource bundling) + manual PKG-01/PKG-02 smoke tests + manual LCH-05/LCH-06 real-MC-launch verification on Windows

### Wave 0 gaps (new files to create)

- [ ] `launcher/src/main/paths.ts` + `paths.test.ts` — platform path resolver
- [ ] `launcher/src/main/launch/manifest.ts` + `manifest.test.ts`
- [ ] `launcher/src/main/launch/libraries.ts` + `libraries.test.ts`
- [ ] `launcher/src/main/launch/assets.ts` + `assets.test.ts`
- [ ] `launcher/src/main/launch/natives.ts` + `natives.test.ts`
- [ ] `launcher/src/main/launch/args.ts` + `args.test.ts`
- [ ] `launcher/src/main/launch/spawn.ts` + `spawn.test.ts`
- [ ] `launcher/src/main/monitor/logParser.ts` + `logParser.test.ts`
- [ ] `launcher/src/main/monitor/crashReport.ts` + `crashReport.test.ts`
- [ ] `launcher/src/main/settings/store.ts` + `store.test.ts`
- [ ] `launcher/src/main/ipc/logs.ts` + `logs.test.ts`
- [ ] `launcher/src/renderer/src/stores/game.ts` + `game.test.ts`
- [ ] `launcher/src/renderer/src/stores/settings.ts` + `settings.test.ts`
- [ ] `launcher/src/renderer/src/components/{SettingsDrawer,RamSlider,CrashViewer,PlayButton}.tsx` + sibling tests
- [ ] `launcher/scripts/prefetch-jre.mjs` (no test — shell utility; integration-tested via `pnpm run prefetch-jre` in CI)
- [ ] `launcher/scripts/build-mod.sh` (no test — shell utility)
- [ ] `launcher/electron-builder.yml` — full rewrite (no test; validated by `pnpm run build:unpack`)
- [ ] Fixture data: `launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` (trimmed excerpt of the live client.json with a known-bad SHA1 for re-download tests)
- [ ] Fixture: `launcher/src/main/monitor/__fixtures__/1.8.9-boot-log.txt` (captured boot log to test sentinel detection)
- [ ] Fixture: `launcher/src/main/monitor/__fixtures__/fake-crash-report.txt` (a crash dump containing a fake MC token + `C:\Users\Alice\…` path — the redaction regression test)

No existing test infrastructure gaps — vitest 4 + jsdom + @testing-library/react are all installed. Wave 0 is purely "write these new modules with tests from the start."

## Sources

### Primary (HIGH confidence)

- **Mojang `version_manifest_v2.json`** — https://piston-meta.mojang.com/mc/game/version_manifest_v2.json — fetched 2026-04-21; 1.8.9 entry SHA1 `d546f1707a3f2b7d034eece5ea2e311eda875787`. HIGH.
- **Mojang `1.8.9.json` (client manifest)** — https://piston-meta.mojang.com/v1/packages/d546f1707a3f2b7d034eece5ea2e311eda875787/1.8.9.json — fetched 2026-04-21. Confirmed `mainClass=net.minecraft.client.main.Main`, `minecraftArguments` string, 37 libraries, asset index `"1.8"`, no arm64 natives. HIGH.
- **Eclipse Adoptium Temurin 8 release** — Adoptium API https://api.adoptium.net/v3/assets/latest/8/hotspot fetched 2026-04-21. Confirmed `8u482-b08` latest, **no aarch64 JRE for macOS**. HIGH.
- **Azul Zulu 8 macOS aarch64 JRE** — https://api.azul.com/metadata/v1/zulu/packages/?java_version=8&os=macos&arch=aarch64&java_package_type=jre — returned zulu8.92.0.21-ca-jre8.0.482-macosx_aarch64.tar.gz. HIGH.
- **electron-builder NSIS target docs** — https://www.electron.build/nsis fetched 2026-04-21. Confirmed artifactName, oneClick, createDesktopShortcut, deleteAppDataOnUninstall, allowToChangeInstallationDirectory. HIGH.
- **electron-builder Mac target + Universal** — https://www.electron.build/mac fetched 2026-04-21. Confirmed `arch: universal`, singleArchFiles + x64ArchFiles options. HIGH.
- **@xmcl/core + @xmcl/installer README** — https://github.com/Voxelum/minecraft-launcher-core-node README files fetched 2026-04-21. HIGH for top-level API; MEDIUM for natives-handling specifics (verify in plan-execute).
- **execa 9.x README** — https://github.com/sindresorhus/execa fetched 2026-04-21. Confirmed cancelSignal, streaming, Windows path quoting. HIGH.
- **electron-log README** — https://github.com/megahertz/electron-log fetched 2026-04-21. Default paths confirmed. HIGH.
- **Phase 2 `redact.ts` code** — read direct from repo (`launcher/src/main/auth/redact.ts`, 60 lines). Patterns HIGH.
- **Phase 2 `safeStorageCache.ts` atomic-write pattern** — read direct from repo (lines 59-68). HIGH.
- **Preload frozen surface** — read direct from `launcher/src/preload/index.ts`. HIGH.
- **1.8.9 Forge manifest combo (Forge 11.15.1.2318 + MCP stable_22)** — already in STACK.md + client-mod/build.gradle.kts. HIGH — but out of Phase 3 scope (Phase 4 territory).

### Secondary (MEDIUM confidence)

- **Main-menu sentinel: `Sound engine started`** — Verified via community log excerpts from minecraftforum.net and hypixel.net threads documenting 1.8.9 startup. Fires on both OpenAL-success and silent-mode fallback paths. MEDIUM — verify in plan-execute with a real 1.8.9 boot log capture.
- **1.8.9 client crash exit codes** — Community knowledge (STACK Overflow, Hypixel forums): 0=clean, 1=Java throw, 130=SIGINT, 143=SIGTERM, 255/-1=JVM crash. MEDIUM — verify with deliberate crash test.
- **Apple Silicon + LWJGL 2 native reality** — https://shadowfacts.net/2022/lwjgl-arm64/ + https://github.com/MidCoard/MinecraftNativesDownloader. Confirmed LWJGL 2 arm64 natives don't exist in stock Mojang manifest; running Java 8 as arm64 on M1 requires custom-built LWJGL2 arm64 binaries OR falls back to Rosetta. MEDIUM.
- **Crash-report filename pattern** — Community knowledge from MultiMC, Prism Launcher, and Mojang's own log format. MEDIUM — verify by triggering a crash.
- **Lunar Client's macOS arm64 approach** — Community threads suggest Lunar ships separate arm64 + x64 JREs + custom LWJGL2 arm64. Cannot verify without disassembling Lunar; unverified assumption, flagged.

### Tertiary (LOW confidence — flag for plan-execute validation)

- **Exact shape of prismarine-auth `getMinecraftJavaToken()` returned MC token** — CANNOT fully verify without live-flow capture (MCE approval gate prevents). Context7 + Mojang API docs confirm it's an opaque bearer from `/authentication/login_with_xbox` → `access_token`. ~280-chars observed by other projects. LOW — regex matches contextually (`--accessToken <x>`, `"access_token":"<x>"`) rather than on raw body which is the right belt-and-braces regardless of exact length.
- **electron-log exact rotation defaults for version 5.4.3 installed** — README doesn't enumerate defaults in the main page. LOW; safe because we're not tuning.

## Open Questions

### 1. **macOS arm64 JRE vendor — D-22 contradicts upstream availability**

**What we know:**
- D-22 locks "Temurin 8 JRE bundled via extraResources" and rejects Rosetta 2.
- Temurin 8 has NO macOS arm64 JRE build (Adoptium API confirms; verified 2026-04-21).
- Even IF we ship an arm64 Zulu JRE, 1.8.9's manifest only has x86_64 LWJGL natives — the JVM must load x86_64 dylibs — which forces the ENTIRE process into x86_64 mode (Rosetta).
- Therefore: "arm64 Java running native on Apple Silicon for 1.8.9" requires custom-built LWJGL2 arm64 natives → that's a custom mod (legacy-lwjgl3 or MinecraftNativesDownloader output), Fabric-flavored, way out of Phase 3 scope.

**What's unclear:** Does the owner want to accept (a) Rosetta 2 execution on Apple Silicon in v0.1 (shipping x64 JRE in the mac-arm64 slot — the Rosetta 2 emulation is seamless for users), (b) defer Apple Silicon support entirely (ship x64-only DMG, arm64 users run via Rosetta when Apple Silicon Macs auto-launch x64 binaries anyway), or (c) budget a multi-day LWJGL2-arm64-rebuild to make D-22's intent real?

**Recommendation (autonomy mode — user AFK):** **Option (a)**. Ship x64 Temurin JRE in BOTH mac-x64 AND mac-arm64 slots (same bytes, duplicated — keeps the D-22 folder layout honest). Runtime detects `process.arch` as it would, picks the "mac-arm64" folder, launches the x64 JRE via Rosetta 2 automatically. This is exactly what happens today if a user installs our Universal DMG on an M1 Mac regardless of which slot gets picked — x64 code runs under Rosetta. **We save ~70 MB of installer size vs bundling Zulu arm64 (which wouldn't be used anyway due to the LWJGL2 native constraint), AND we stay on Temurin as D-22 specified.** Update CONTEXT.md in post-phase to record this reality-check decision with the explanation above; flag the LWJGL2 native rebuild as a v0.2+ backlog item if Apple Silicon user count grows.

**Alternative if owner objects:** Ship Azul Zulu arm64 in the mac-arm64 slot anyway, accepting that the arm64 JRE will still start Rosetta-mode processes for native dylib loads, just with a higher startup cost. Same user experience; bigger installer. Weakly recommended.

### 2. **`game:log`, `game:exited`, `game:crashed` are specified in CONTEXT.md integration points but NOT on the preload bridge**

**What we know:** CONTEXT.md §integration points says "main process adds 4 push emitters (game:progress + game:log + game:exited + game:crashed)". Preload currently exposes only `onStatus` (channel `game:status-changed`) and `onProgress` (channel `game:progress`). Phase 1 D-11 froze the IPC surface.

**What's unclear:** Does "frozen" include the push-CHANNELS or only the preload top-level KEYS? Phase 1 D-11 says "5 top-level preload keys … 13 channels total." If 13 channels were enumerated at Phase 1 and they included `game:log` / `game:exited` / `game:crashed`, we're fine; they just aren't wired into the preload bridge yet. The current preload only wires `onStatus` and `onProgress` — the missing three listeners need to be added as `onLog`, `onExited`, `onCrashed` on the `wiiwho.game` object, POINTING AT the same channel names. That's "filling in" not "adding new top-level keys." **This is compatible with D-11 as I read it.**

**Recommendation (autonomy mode):** **Treat the Phase 1 IPC frozen-surface as "no new top-level preload keys" ONLY.** Phase 3 adds three new `game.on*` listeners on the existing `game` top-level key (pointing at new channels `game:log`, `game:exited`, `game:crashed`). Phase 1 D-11 is satisfied because the 5 top-level keys are unchanged. Update `wiiwho.d.ts`'s `WiiWhoAPI.game` type to include the three new subscriptions alongside `onStatus` / `onProgress`. Also add `onCrashed` with a typed payload. This is the minimum expansion needed; flag with a comment in the preload bridge referencing this Phase 3 decision. If plan-check agent reads this as a D-11 violation, escalate to owner.

### 3. **xmcl's natives extraction — verify it actually runs**

**What we know:** `@xmcl/installer`'s `completeInstallation` docs mention "jar, libraries, assets, and profiles" but NOT natives extraction specifically. The LWJGL natives must be extracted to a flat directory pointed to by `-Djava.library.path`.

**What's unclear:** Does `completeInstallation` or a sibling function auto-extract natives, or do we need a separate step?

**Recommendation:** In plan-execute, write a quick probe test that calls `completeInstallation` on a fresh empty game-dir and asserts that `<game-dir>/versions/1.8.9/natives/*.dll` (or `.dylib` on mac) exists. If absent, write our own `launch/natives.ts` that unzips each `natives-<os>` classifier jar into the natives dir, honoring the `extract.exclude` rules (1.8.9 excludes `META-INF/`).

### 4. **Mac build machine availability for Phase 3 execute**

**What we know:** CLAUDE.md says owner is on Windows. D-22 requires a macOS Universal DMG. Cross-building macOS DMGs from Windows is NOT supported by electron-builder.

**What's unclear:** Does the owner have on-demand Mac access (friend's machine, CI runner, cloud Mac-in-the-box)?

**Recommendation:** Plan assumes `dist:win` + `dist:mac` both run at phase-complete time; if Mac access is unavailable, partition Phase 3 into two waves: Windows-first (all PKG-01 + launch path), Mac-DMG-later as a short Wave N completion gate once mac access is secured. Document this as a plan-risk; don't block phase start.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack (xmcl, execa, p-queue, electron-builder) | HIGH | All deps verified via README + npm + live docs 2026-04-21 |
| Mojang manifest shape + placeholder tokens | HIGH | Live-fetched 1.8.9.json 2026-04-21 |
| JVM argv canonical form | HIGH | Derived from live manifest + wiki.vg conventions |
| Main-menu sentinel | MEDIUM | Community-documented; verify with live boot-log capture in plan-execute |
| Crash detection timing | MEDIUM | `fs.watch` semantics are cross-platform reliable; 5s timeout is a planner pick |
| Redaction patterns | HIGH | D-20 explicit + Phase 2 precedent to extend |
| electron-builder config fragment | HIGH | Every key verified in live docs |
| Temurin URLs + versions | HIGH | Adoptium API live-fetched |
| Apple Silicon JRE reality | MEDIUM | Multi-source community + Azul + Mojang native-manifest triangulation |
| Settings schema | HIGH | D-04 + CONTEXT.md integration points |
| Anticheat-safety gate | HIGH | Phase 3 adds zero in-game code by design |

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30-day estimate) for library versions; Mojang manifest URLs valid indefinitely until Mojang rotates.

---

*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Research written: 2026-04-21*
