# Architecture Research

**Domain:** Desktop Minecraft launcher + in-game QoL mod (Lunar-class, 1.8.9 Forge)
**Researched:** 2026-04-20
**Confidence:** HIGH for component boundaries, file layout, and launch lifecycle; MEDIUM for Lunar's exact internal IPC (proprietary); HIGH for Mojang manifest/game args (official wiki + wiki.vg).

## Standard Architecture

A Lunar-class client is **two independent processes that barely talk to each other**. The launcher is a desktop app that orchestrates downloads, login, and process spawning. The game is a normal JVM running Forge + your mod. After launch the launcher is essentially a babysitter — it watches stdout/stderr and waits for the process to exit. Everything interesting inside the game runs in Java and writes to disk.

This separation is a feature, not a bug. It means launcher UI framework choices have zero impact on in-game FPS, Electron's Chromium memory footprint never competes with Minecraft's JVM heap, and a crash in one side cannot take down the other.

### System Overview

```
+-----------------------------------------------------------------+
|  Launcher process (Electron, Node.js + Chromium, TS + React)    |
|                                                                 |
|  +---------------------+       +------------------------+       |
|  |  Renderer process   |  IPC  |   Main process         |       |
|  |  (Chromium, React)  |<----->|   (Node.js)            |       |
|  |                     |       |                        |       |
|  |  - Login screen     |       |  - MSAL auth flow      |       |
|  |  - Settings UI      |       |  - Manifest fetcher    |       |
|  |  - Play button      |       |  - Library downloader  |       |
|  |  - Crash viewer     |       |  - JVM spawner         |       |
|  |  - RAM slider       |       |  - Log parser          |       |
|  +---------------------+       |  - Settings persist    |       |
|         (preload.ts = tiny     +-----------+------------+       |
|          whitelisted bridge)               |                    |
+--------------------------------------------|--------------------+
                                             | spawn()
                                             | + stdin/stdout/stderr pipes
                                             v
+-----------------------------------------------------------------+
|  Game process (bundled Java 8 JRE, separate JVM)                |
|                                                                 |
|  LaunchWrapper (net.minecraft.launchwrapper.Launch)             |
|     |                                                           |
|     +--> MixinTweaker (registers Mixin transformers)            |
|     +--> FMLTweaker   (registers Forge)                         |
|            |                                                    |
|            v                                                    |
|     Forge loads mods/ directory                                 |
|            |                                                    |
|            v                                                    |
|     Your mod (@Mod annotation)                                  |
|       |                                                         |
|       +-- Core (mod lifecycle, config, event bus)               |
|       +-- HUD modules  (FPS, keystrokes, CPS)                   |
|       +-- Mixins       (rendering hotspots, perf patches)       |
|       +-- Cosmetics    (cape renderer, texture loading)         |
|       +-- Auth bridge  (reads token from sysprop, not network)  |
+-----------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------+
|  On-disk state (shared by both processes, single source of      |
|  truth)                                                         |
|                                                                 |
|  - game/versions/1.8.9/1.8.9.jar       (vanilla, launcher       |
|                                         writes, JVM reads)      |
|  - game/libraries/**                   (Mojang libs, both read) |
|  - game/assets/{indexes,objects}/**    (textures/sounds)        |
|  - game/mods/wiiwho-1.8.9.jar          (our Forge mod)          |
|  - config/wiiwho.json                  (HUD toggles, positions) |
|  - logs/latest.log, crash-reports/**   (mod writes, launcher    |
|                                         reads for crash viewer) |
|  - accounts.json (encrypted)           (MSA refresh token)      |
+-----------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Launcher — Main process | Auth, downloads, manifest parsing, JVM spawn, process monitoring, disk I/O, settings persistence | Node.js in Electron, TypeScript, keytar for token storage, got/undici for downloads |
| Launcher — Renderer process | UI only: login screen, instance list, play button, settings panel, log viewer | React + Vite, Zustand or Redux Toolkit for UI state |
| Launcher — Preload script | Tiny whitelisted bridge exposing only named APIs (`auth.login()`, `game.play()`, `settings.save()`) via `contextBridge` | `preload.ts`, `contextBridge.exposeInMainWorld` |
| Bundled JRE | Run the game | Eclipse Adoptium Temurin JRE 8u (x64 for Win + arm64/x64 for Mac), shipped via `extraResources` |
| Forge + LaunchWrapper | Bootstraps the modding environment, loads tweakers, loads mods | Downloaded once by launcher, installed under `versions/1.8.9-forge-...` |
| MixinTweaker | Registers Mixin's ASM transformers before Forge loads | `org.spongepowered.asm.launch.MixinTweaker` via `--tweakClass` or JAR manifest |
| Our mod — Core | Mod entrypoint, config loading, event bus registration, feature toggle lifecycle | `@Mod` class, `FMLPreInitializationEvent` / `FMLInitializationEvent` handlers |
| Our mod — HUD modules | Each HUD (FPS, keystrokes, CPS) is a self-contained feature subscribing to Forge render events | Package per feature, `@SubscribeEvent` on `RenderGameOverlayEvent` |
| Our mod — Mixin package | Bytecode patches for perf hotspots Forge events can't reach | `@Mixin` classes referenced in `mixins.wiiwho.json` |
| Our mod — Cosmetics | Cape/emote rendering hooks | Mixin into `LayerCape` + our texture loader |
| Our mod — Auth bridge | Reads auth token passed in as JVM system property, forwards to cosmetics HTTP client | Reads `-Dwiiwho.token=...` at mod init, no direct MSAL calls |

## Recommended Project Structure

```
wiiwho-client/
|-- launcher/                                 # Electron app (TypeScript + React)
|   |-- src/
|   |   |-- main/                             # Node.js main process
|   |   |   |-- index.ts                      # App entry, createWindow
|   |   |   |-- ipc/                          # ipcMain handlers (one file per channel group)
|   |   |   |   |-- auth.ts                   # auth:login, auth:logout, auth:status
|   |   |   |   |-- game.ts                   # game:play, game:cancel, game:status
|   |   |   |   |-- settings.ts               # settings:get, settings:set
|   |   |   |   +-- logs.ts                   # logs:list, logs:read-crash
|   |   |   |-- auth/                         # Microsoft + Xbox + Minecraft token chain
|   |   |   |   |-- msal.ts                   # device code flow, refresh
|   |   |   |   |-- xbox.ts                   # XBL + XSTS exchange
|   |   |   |   |-- minecraft.ts              # MC access token, profile fetch
|   |   |   |   +-- store.ts                  # encrypted token persistence (keytar)
|   |   |   |-- launch/                       # Download + spawn pipeline
|   |   |   |   |-- manifest.ts               # fetch version_manifest_v2.json
|   |   |   |   |-- libraries.ts              # resolve + download library jars
|   |   |   |   |-- assets.ts                 # resolve + download asset index + objects
|   |   |   |   |-- natives.ts                # extract platform natives from jars
|   |   |   |   |-- forge.ts                  # download/install Forge 1.8.9
|   |   |   |   |-- args.ts                   # build JVM args, game args, classpath
|   |   |   |   +-- spawn.ts                  # child_process.spawn + stdio piping
|   |   |   |-- monitor/                      # Process babysitting
|   |   |   |   |-- logParser.ts              # Line-based stdout/stderr parser, emits events
|   |   |   |   +-- crashReport.ts            # Watch crash-reports/ folder, surface to UI
|   |   |   |-- paths.ts                      # OS-specific paths (Win/Mac), single source
|   |   |   +-- settings.ts                   # Settings file I/O (RAM, game dir override)
|   |   |-- preload/
|   |   |   +-- index.ts                      # contextBridge.exposeInMainWorld('wiiwho', {...})
|   |   +-- renderer/                         # React app
|   |       |-- App.tsx
|   |       |-- routes/
|   |       |   |-- Login.tsx
|   |       |   |-- Home.tsx                  # Play button, account, news
|   |       |   |-- Settings.tsx              # RAM slider, game dir, theme
|   |       |   +-- Crash.tsx                 # Crash report viewer
|   |       |-- components/
|   |       |-- state/                        # Zustand stores, mirrors main process data
|   |       +-- styles/
|   |-- electron-builder.yml                  # Packaging config (extraResources for JRE)
|   |-- resources/
|   |   |-- jre/
|   |   |   |-- win-x64/                      # Bundled JRE for Windows
|   |   |   +-- mac-x64/                      # Bundled JRE for Mac (add mac-arm64 later)
|   |   +-- icons/
|   +-- package.json
|
|-- client-mod/                               # Forge 1.8.9 mod (Java 8)
|   |-- build.gradle                          # ForgeGradle + Mixin plugin
|   |-- gradle.properties                     # MC version, Forge version, mappings
|   |-- src/main/java/com/wiiwho/client/
|   |   |-- WiiWho.java                       # @Mod class, @Instance, event handlers
|   |   |-- core/
|   |   |   |-- ModuleManager.java            # Registers + lifecycles HUD modules
|   |   |   |-- EventRouter.java              # Shared Forge event subscription
|   |   |   +-- AuthBridge.java               # Reads -Dwiiwho.token at startup
|   |   |-- config/
|   |   |   |-- WiiWhoConfig.java             # Singleton, JSON-backed, hot-reloadable
|   |   |   +-- HudConfig.java                # Per-HUD position + toggle state
|   |   |-- hud/
|   |   |   |-- HudModule.java                # Base class: enabled(), render(), name()
|   |   |   |-- fps/FpsHud.java
|   |   |   |-- keystrokes/KeystrokesHud.java
|   |   |   +-- cps/CpsHud.java
|   |   |-- cosmetics/
|   |   |   |-- CapeManager.java
|   |   |   +-- CapeRenderer.java
|   |   |-- perf/                             # Optional: non-Mixin perf features
|   |   |   +-- HudCache.java
|   |   +-- mixin/                            # Mixin classes (referenced by JSON config)
|   |       |-- render/MixinEntityRenderer.java
|   |       |-- render/MixinLayerCape.java
|   |       +-- perf/MixinGuiInGame.java
|   |-- src/main/resources/
|   |   |-- mcmod.info                        # Mod metadata (Forge reads this)
|   |   |-- mixins.wiiwho.json                # Mixin config (refmap, mixin class list)
|   |   +-- assets/wiiwho/textures/           # Baked-in placeholder cape, icons
|   +-- versions/                             # (if Patcher-style multi-version later)
|
|-- assets/                                   # Launcher-only art (not shipped to JVM)
|-- docs/
|   +-- architecture.md                       # Link to this research
|-- scripts/
|   |-- build-mod.sh                          # Gradle wrapper for CI
|   +-- package.sh                            # electron-builder wrapper
+-- .planning/
    +-- research/
```

### Structure Rationale

- **`launcher/` and `client-mod/` are siblings, not nested:** they have different build tools (npm + Gradle), different languages (TS + Java), and different lifecycles. Flat separation keeps tooling obvious.
- **`launcher/src/main/ipc/*.ts` one file per channel group:** IPC sprawl is how Electron apps rot. Grouping handlers by domain (`auth`, `game`, `settings`, `logs`) keeps the preload surface auditable.
- **`launcher/src/main/launch/` is a pipeline of small files:** `manifest -> libraries -> assets -> natives -> args -> spawn`. Each step is testable in isolation with a fake game directory. This is the launcher's most failure-prone code — keep it granular.
- **`launcher/resources/jre/<platform>/`:** `electron-builder`'s `extraResources` copies these to `Contents/Resources/jre/` on macOS and `resources/jre/` on Windows. Using a platform subfolder means one `package.json` config with per-target `from` paths.
- **`client-mod/src/main/java/com/wiiwho/client/hud/<feature>/`:** each HUD is its own package. This is the Sk1er Patcher / Feather pattern — features are self-contained with their own config surface, render logic, and (if needed) Mixins. Adding a new HUD in v0.2 is a new folder, not a diff across five files.
- **`mixin/` package is flat by concern:** Mixin classes live in one package tree referenced by `mixins.wiiwho.json`. Mixing them with feature code breaks Mixin's classloader expectations.

## Architectural Patterns

### Pattern 1: Two-process, one-way IPC

**What:** Launcher spawns the JVM and communicates downward only via launch arguments (JVM args, game args, `-D` system properties). Upward communication from JVM to launcher is line-based stdout/stderr parsing. No local socket, no named pipe, no RPC.

**When to use:** Always for v0.1. Adding a socket is reversible; starting with one is architectural debt.

**Trade-offs:**
- Pro: simple, robust, matches how every Minecraft launcher from vanilla through Prism operates.
- Pro: crash recovery is trivial — if the JVM dies, we read exit code + log tail.
- Con: we can't live-update settings in the running game without a config file watcher on the mod side (acceptable — 1.8.9 features don't need this).

**Example:**
```typescript
// launcher/src/main/launch/spawn.ts
import { spawn } from 'node:child_process';
export function spawnGame(args: LaunchArgs, onLine: (line: string, stream: 'out'|'err') => void) {
  const child = spawn(args.javaPath, args.jvmArgs.concat([args.mainClass], args.gameArgs), {
    cwd: args.gameDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  const split = (stream: 'out'|'err') => (buf: Buffer) =>
    buf.toString('utf8').split(/\r?\n/).forEach(line => line && onLine(line, stream));
  child.stdout.on('data', split('out'));
  child.stderr.on('data', split('err'));
  return child;
}
```

### Pattern 2: Main-process-owns-state, renderer is a view

**What:** All durable state (accounts, settings, download progress, game process handle) lives in the main process. The renderer holds a mirror for display. All writes go `renderer -> preload -> ipcMain.handle -> main state -> broadcast -> renderer update`.

**When to use:** Always, for any Electron app that touches the filesystem, network, or child processes.

**Trade-offs:**
- Pro: security (renderer can be compromised by a malicious web font; it still can't read `accounts.json`).
- Pro: state survives window reload, window close, hot-reload.
- Con: every action requires an IPC round-trip. Fine for launcher-scale interactions (dozens per session, not thousands).

**Example:**
```typescript
// launcher/src/preload/index.ts — the entire attack surface
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('wiiwho', {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    login:  () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },
  game: {
    play:   (opts: PlayOptions) => ipcRenderer.invoke('game:play', opts),
    cancel: () => ipcRenderer.invoke('game:cancel'),
    onStatus: (cb: (s: GameStatus) => void) => {
      const h = (_: unknown, s: GameStatus) => cb(s);
      ipcRenderer.on('game:status', h);
      return () => ipcRenderer.off('game:status', h);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:set', patch),
  },
});
```

### Pattern 3: Download-verify-cache pipeline for game files

**What:** Every file the launcher needs (vanilla jar, libraries, assets) is fetched via: check SHA1 against manifest -> if mismatch or missing, download -> verify after download -> cache on disk permanently. Never re-download a file that already matches the manifest hash. Never launch if hashes don't match.

**When to use:** Mandatory. This is how every Minecraft launcher from vanilla through Prism operates.

**Trade-offs:**
- Pro: first launch pulls ~200-300MB; subsequent launches are instant.
- Pro: corruption is self-healing — delete the bad file, next launch re-fetches.
- Pro: since we target 1.8.9 only, the manifest resolution is one-time cache of the 1.8.9 `client.json`.
- Con: integrity checks add CPU cost, but trivial vs download time.

### Pattern 4: Feature-module pattern inside the mod

**What:** Each in-game feature (FPS HUD, keystrokes, CPS, cape) is an independent "module" with: its own config slice, its own event subscriptions, its own enable/disable lifecycle. A single `ModuleManager` registers all modules at `FMLInitializationEvent`. Features never reach into each other.

**When to use:** This is the Sk1er Patcher / Lunar pattern. Use it from day one — retrofitting is expensive.

**Trade-offs:**
- Pro: adding v0.2 HUDs (armor, potion, coords) is a new file in `hud/<name>/` and one line in `ModuleManager`.
- Pro: features can be toggled at runtime without reload because each owns its event subscriptions.
- Con: slight boilerplate per module. Worth it past 3-4 features.

**Example:**
```java
// client-mod/.../hud/HudModule.java
public abstract class HudModule {
    public abstract String id();
    public abstract boolean enabled();
    public abstract void onRenderOverlay(RenderGameOverlayEvent.Post event);
    public void onEnable() {}
    public void onDisable() {}
}

// client-mod/.../core/ModuleManager.java
public class ModuleManager {
    private final List<HudModule> modules = Arrays.asList(
        new FpsHud(), new KeystrokesHud(), new CpsHud()
    );
    @SubscribeEvent
    public void onRender(RenderGameOverlayEvent.Post e) {
        for (HudModule m : modules) if (m.enabled()) m.onRenderOverlay(e);
    }
}
```

### Pattern 5: Mixin for hotspots, Forge events for everything else

**What:** Default to `@SubscribeEvent` on Forge's event bus. Only reach for Mixin when Forge has no event (inside a render method, inside a tight loop, private fields). Mixins live in their own package and are listed in `mixins.wiiwho.json`.

**When to use:** Always use Forge events first. Mixin is a last resort, not a style choice.

**Trade-offs:**
- Pro: Forge events are stable across Forge updates; Mixins can break when MCP mappings shift.
- Pro: keeping Mixin count low makes crash reports readable.
- Con: some perf work is impossible without Mixin — accept it where needed.

## Data Flow

### Launch flow (top-to-bottom)

```
User clicks Play (renderer)
    |
    v
preload.game.play()
    |
    v ipcRenderer.invoke('game:play')
main/ipc/game.ts
    |
    +--> auth.store.getToken()   ------> returns fresh MC access token
    |       (refreshes via MSAL if expired using cached refresh token)
    |
    +--> launch/manifest.resolve()  ---> reads cached client.json or fetches
    |
    +--> launch/libraries.ensure()  ---> SHA1-verify, download missing
    |
    +--> launch/assets.ensure()     ---> index + objects, same pattern
    |
    +--> launch/natives.extract()   ---> unzip LWJGL natives to versions/1.8.9/natives/
    |
    +--> launch/forge.ensure()      ---> download Forge 1.8.9 installer, extract
    |
    +--> launch/args.build()        ---> classpath string, JVM args, game args
    |       injects:
    |         -Xmx<ram>M from settings
    |         -Dwiiwho.token=<short-lived ticket>      <-- auth bridge
    |         -Dwiiwho.version=<launcher version>
    |         -cp <libs>:<vanilla.jar>:<forge.jar>:<wiiwho-mod.jar>
    |         --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker
    |         --tweakClass org.spongepowered.asm.launch.MixinTweaker
    |         --username <MC profile name>
    |         --uuid <MC profile uuid, dashless>
    |         --accessToken <MC access token>
    |         --userType msa
    |         --version 1.8.9
    |         --assetIndex 1.8
    |         --assetsDir <game>/assets
    |         --gameDir <game>/
    |
    +--> launch/spawn.spawnGame()   ---> child_process.spawn(jre, args)
            |
            v
    monitor/logParser attaches
            |
            v  line-by-line
    Emits events: 'game:loaded', 'game:joined-server', 'game:crashed'
            |
            v  ipcMain.send('game:status', ...)
    renderer updates UI
```

### Key Data Flows

1. **Auth token lifecycle:**
   - Device code flow -> Microsoft access token (launcher, never touches disk plaintext)
   - -> XBL token -> XSTS token -> Minecraft access token
   - Refresh token encrypted with OS credential store (keytar) under `wiiwho/msa-refresh`
   - MC access token passed to game ONCE at launch as `--accessToken` and `-Dwiiwho.token` (for cosmetics HTTP only)
   - 1.8.9 does not refresh in-session — the token lasts 24h, longer than any play session
   - If the user plays past token expiry, the server auth check fails; user sees a disconnect, relaunches, launcher refreshes

2. **Settings / HUD config:**
   - Launcher settings (`RAM`, game directory override, auto-close launcher): `%APPDATA%/wiiwho/config.json`, owned by launcher main process, never touched by the mod
   - Mod settings (HUD toggles, positions, colors): `<gameDir>/config/wiiwho.json`, owned by mod, launcher reads only for a future "edit HUDs from launcher" feature
   - These are separate files because their owners are separate processes — no shared-state bugs

3. **Crash report flow:**
   - Java exception in the game -> Forge writes `<gameDir>/crash-reports/crash-<timestamp>.txt`
   - Launcher watches `<gameDir>/crash-reports/` with `fs.watch` while game is running
   - On JVM exit with non-zero code, launcher reads the most recent crash file and the tail of stdout/stderr buffer
   - Displays both in a "Crash Details" modal
   - stdout/stderr parser also looks for `---- Minecraft Crash Report ----` and captures the block, as a belt-and-braces fallback if file write is interrupted

4. **Download progress:**
   - `launch/libraries.ensure()` emits per-file progress events on an EventEmitter
   - `ipc/game.ts` aggregates into a single `{bytesDone, bytesTotal, currentFile}` struct
   - Broadcasts via `ipcMain.send('game:progress', ...)` throttled to 10Hz
   - Renderer shows download bar

## File Layout on Disk

### Windows

```
%LOCALAPPDATA%\Programs\WiiWho\                        (installer target, read-only after install)
   WiiWho.exe                                          (Electron launcher)
   resources\
      app.asar                                         (packed launcher JS)
      jre\win-x64\bin\javaw.exe                        (bundled Java 8)
   ...

%APPDATA%\WiiWho\                                      (mutable user data, owned by launcher)
   config.json                                         (RAM, game dir override, theme)
   accounts.json                                       (refresh token ciphertext + metadata)
   logs\launcher.log                                   (launcher's own log)
   game\                                               (default game directory)
      versions\
         1.8.9\1.8.9.jar                               (vanilla client)
         1.8.9-forge-11.15.1.2318\                     (Forge jar + profile JSON)
            natives\                                   (extracted LWJGL natives)
      libraries\
         com\mojang\...\*.jar                          (Maven-layout Mojang libs)
         net\minecraftforge\...\*.jar
         org\lwjgl\...\*.jar
         org\spongepowered\mixin\...\*.jar
      assets\
         indexes\1.8.json                              (asset manifest for 1.8.9)
         objects\<xx>\<xxxxxxx...>                     (content-addressed, by SHA1)
         skins\                                        (cached player skins)
      mods\
         wiiwho-1.8.9-<version>.jar                    (our mod)
      config\
         wiiwho.json                                   (HUD settings, written by mod)
      logs\
         latest.log, <timestamp>.log.gz                (Forge log output)
      crash-reports\
         crash-<timestamp>-client.txt                  (Forge/mod crash reports)
      saves\, resourcepacks\, screenshots\             (standard Minecraft dirs)
```

### macOS

```
/Applications/WiiWho.app/                              (installer target)
   Contents/
      MacOS/WiiWho                                     (Electron launcher binary)
      Resources/
         app.asar
         jre/mac-x64/Contents/Home/bin/java            (bundled Java 8)
      Info.plist

~/Library/Application Support/WiiWho/                  (mutable user data)
   config.json
   accounts.json
   logs/launcher.log
   game/                                               (identical layout to Windows)
      versions/1.8.9/...
      libraries/...
      assets/indexes/, assets/objects/
      mods/wiiwho-1.8.9-<version>.jar
      config/wiiwho.json
      logs/, crash-reports/
      saves/, resourcepacks/, screenshots/
```

### Layout rationale

- **Separate `game/` subdirectory under user data:** lets us support a future "use existing `.minecraft`" mode by making `gameDir` a user-configurable setting that points elsewhere. Mirrors Prism/MultiMC's per-instance approach.
- **Standard Mojang layout inside `game/`:** means the vanilla jar, libraries, assets all match Mojang's expected folder shape. Forge and mods Just Work without custom path wiring.
- **Accounts + launcher config kept out of `game/`:** the game folder is mod-visible; the launcher folder is not. Prevents a compromised mod from reading refresh tokens.
- **Platform-specific install paths follow OS conventions:** `%LOCALAPPDATA%\Programs\` on Windows (same as Lunar), `/Applications/` on Mac (Mac convention). `electron-builder` handles both by default.

## Mojang Launcher Manifest: Minimum for 1.8.9

Since we target **only 1.8.9**, we can drastically simplify versus a full-fledged multi-version launcher. Here's the minimum we need:

**One-time resolution (or cached):**
1. Fetch `https://launchermeta.mojang.com/mc/game/version_manifest_v2.json`
2. Find the `1.8.9` entry, read its `url` field (points to that version's `client.json`)
3. Download and cache `client.json` locally — this is the **one file we actually need**

**What we need from `client.json`:**
- `downloads.client.url` + `sha1` + `size` — the vanilla 1.8.9 jar
- `assetIndex.id` ("1.8"), `url`, `sha1` — the asset index JSON
- `libraries[]` — each library's `downloads.artifact` (main jar) and `downloads.classifiers.natives-<os>` (natives) plus any `rules` (we only care about the ones matching `os.name == windows` or `os.name == osx`)
- `minecraftArguments` (string on 1.8.9 — not the structured `arguments` object introduced in later versions) — template with placeholders `${auth_player_name}`, `${version_name}`, `${game_directory}`, `${assets_root}`, `${assets_index_name}`, `${auth_uuid}`, `${auth_access_token}`, `${user_type}`, `${version_type}`
- `mainClass` — for 1.8.9 this is `net.minecraft.launchwrapper.Launch`

**What we DON'T need (simplifications from single-version lock):**
- No version picker UI, no "install latest" logic
- No manifest polling for updates (1.8.9 is frozen)
- No support for the newer structured `arguments` JSON shape (that's 1.13+)
- No handling of `javaVersion` field (1.8.9 predates it — we hardcode Java 8)
- No LWJGL 3 compatibility layer (1.8.9 uses LWJGL 2, natives are straightforward)

**Forge on top of that:**
- Download Forge 1.8.9 installer (`forge-1.8.9-11.15.1.2318-installer.jar` or the latest 1.8.9 Forge build)
- We do NOT run the installer GUI — we either (a) extract the `version.json` + `maven/` contents manually and merge into our game dir, or (b) invoke the installer in headless mode (`--installClient`). Option (a) is more reliable and what MultiMC/Prism do.
- Forge's `version.json` is an overlay: it adds libraries, changes `mainClass` (no — 1.8.9 keeps LaunchWrapper), and adds `--tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker` to the args
- We append `--tweakClass org.spongepowered.asm.launch.MixinTweaker` for our mod's Mixins

**Bottom line:** one `client.json` + one Forge `version.json` + our `mixins.wiiwho.json`, merged into a single argument string and a single classpath. ~200 lines of launch-side code.

## Launch Lifecycle (Numbered Sequence)

From "user clicks Play" to "game window open":

1. **Renderer fires `game.play({ ram: 4096 })`** via preload bridge.
2. **Main process receives `ipcMain.invoke('game:play', opts)`** — locks out further play clicks, sets state to `LAUNCHING`.
3. **Auth check:** read `accounts.json`, decrypt refresh token, call `msal.acquireTokenSilent()`. If expired, run device code flow (prompts user in new window). Result: fresh Microsoft access token.
4. **Xbox token exchange:** POST to `user.auth.xboxlive.com` with MS token, receive XBL token. POST to `xsts.auth.xboxlive.com` with XBL token, receive XSTS token.
5. **Minecraft token:** POST to `api.minecraftservices.com/authentication/login_with_xbox` with XSTS, receive MC access token. GET `api.minecraftservices.com/minecraft/profile` for username + UUID.
6. **Manifest resolution:** load cached `client.json` for 1.8.9 (or fetch if first run).
7. **Library verify:** iterate `libraries[]`, for each: compute expected path from `name` (Maven coords), check disk SHA1 against manifest SHA1. Queue missing/mismatched for download.
8. **Download missing libraries + vanilla jar + asset index + missing assets** in parallel (concurrency cap ~8) with progress events emitted to renderer.
9. **Extract natives:** for each library with a `natives-<os>` classifier, unzip `.dll`/`.dylib`/`.so` files into `versions/1.8.9/natives/`.
10. **Forge verify:** check Forge installation exists at `versions/1.8.9-forge-<ver>/`. If missing, download installer, extract manually, merge libraries.
11. **Our mod verify:** ensure `mods/wiiwho-1.8.9-<launcher-ver>.jar` is present (shipped inside the installer's `resources/mods/`, copied on first run or launcher update).
12. **Build launch command:**
    - `javaPath` = `<launcher-install>/resources/jre/<platform>/bin/java[w]`
    - JVM args: `-Xmx<ram>M -Xms512M -Djava.library.path=<natives-dir> -Dwiiwho.token=<mc-token-ticket> -cp <classpath>`
    - Main class: `net.minecraft.launchwrapper.Launch`
    - Game args: substitute placeholders into `minecraftArguments` template + append `--tweakClass` entries
13. **Spawn JVM** via `child_process.spawn()` with `stdio: ['ignore', 'pipe', 'pipe']` and `cwd: <gameDir>`.
14. **Attach log parser** to stdout/stderr. Parser line rules:
    - `"LaunchWrapper: Loading tweak class"` -> emit `game:bootstrapping`
    - `"[Client thread/INFO]: Setting user:"` -> emit `game:loaded`
    - `"---- Minecraft Crash Report ----"` -> begin capturing crash block
    - process exit event -> if exit code != 0, emit `game:crashed` with captured block or file contents
15. **Launcher state -> `PLAYING`**, optionally minimize/hide launcher window (user setting).
16. **On process exit:**
    - Code 0: `game:exited-cleanly`, restore launcher window
    - Non-zero: `game:crashed`, read most recent `crash-reports/*.txt`, show Crash Details modal

## Scaling Considerations

Launcher-scale app; "scale" means users on different machines, not concurrent sessions.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 users (v0.1 small group) | As described. Manual distribution via signed-or-unsigned `.exe`/`.dmg`. |
| 10-1k users | Add auto-update via `electron-updater` + GitHub Releases feed. Add Sentry for crash telemetry (opt-in). No infra changes. |
| 1k-100k users | Host the Forge jar + our mod jar on a CDN rather than bundling everything into the installer (shrinks installer, allows mod hot-swap without reinstall). Add a simple "news" endpoint (static JSON on CDN). Still no backend auth service — MS handles auth. |
| 100k+ users (Lunar scale) | Cosmetics backend becomes real (user-authored capes, purchase flow). Add a launcher-side anti-tamper check for the mod jar. Consider signing the mod jar and verifying signature at load. Moves out of our v0.1 horizon. |

### Scaling Priorities

1. **First bottleneck: first-launch download time.** Users on slow connections wait 3-5 minutes. Mitigate with parallel downloads (concurrency 8) and a CDN for our mod jar. Vanilla jars/libs/assets already come from Mojang's CDN.
2. **Second bottleneck: startup memory.** Electron launcher idling = ~150MB RAM. Game = user's `-Xmx`. Solution: close launcher after game launch if user enables "close launcher on play" (Lunar's default behavior).
3. **Third bottleneck: Forge mod loading time** (not our code — Forge itself scans the mods folder). Not worth optimizing; users accept 10-20s Forge boot as normal.

## Anti-Patterns

### Anti-Pattern 1: Launcher and mod sharing code

**What people do:** Try to DRY types between the TypeScript launcher and Java mod, e.g. sharing a "HUD config" schema through a generator.

**Why it's wrong:** Different languages, different runtimes, different lifecycles, different owners of the config file. Every "sync" tool becomes a third artifact to maintain and a source of mismatches.

**Do this instead:** Duplicate the schema. If the launcher gets a "HUD editor" UI in v0.3, the launcher reads/writes `config/wiiwho.json` and the mod does too — the file format is the contract, written in prose in `docs/config-format.md`. This is how Prism Launcher manages instance settings the game also reads.

### Anti-Pattern 2: Running auth inside the mod

**What people do:** Add MSAL logic to the mod so it can refresh tokens mid-session for cosmetics API calls.

**Why it's wrong:** Minecraft JVMs on 1.8.9 don't have good HTTP libraries, JCE certificates are Java 8 vintage and frequently fail against modern TLS, and it doubles the auth attack surface (now two processes handle the refresh token).

**Do this instead:** Launcher handles all auth. Passes a short-lived MC access token via `-D` system property and (separately) a dedicated cosmetics session token via the same mechanism. Mod makes simple bearer-token HTTP calls for cosmetics with no refresh logic. If a token expires mid-session, cosmetics stop loading — acceptable.

### Anti-Pattern 3: Expose full `ipcRenderer` to the renderer

**What people do:** `contextBridge.exposeInMainWorld('ipc', ipcRenderer)` for convenience.

**Why it's wrong:** Any XSS or malicious dependency in the renderer can then invoke any IPC handler, including `game:play` with arbitrary JVM args — instant remote code execution on the user's machine.

**Do this instead:** Expose only named high-level functions through `contextBridge`. Validate args in the main-process handler (don't trust the renderer). Never pass raw `ipcRenderer` references to renderer code.

### Anti-Pattern 4: Parsing stdout for state you could read from disk

**What people do:** Parse stdout for HUD config changes, player chat, server join events to show in launcher UI.

**Why it's wrong:** stdout format is unstable (changes with Forge version, log4j config, user log-level settings). Will break randomly.

**Do this instead:** If you need game state in the launcher, write a file from the mod (`<gameDir>/state/launcher-sync.json`) and watch it from the launcher with `chokidar`. File format is a stable contract you control.

### Anti-Pattern 5: One giant mod class with all features

**What people do:** `@Mod` class subscribes to every event, directly renders all HUDs, holds all config.

**Why it's wrong:** Past 3 features this becomes unmaintainable. You can't toggle features independently without if-chains. Adding a feature touches five unrelated methods.

**Do this instead:** `@Mod` class does only: register `ModuleManager`, load config, forward events to modules. Each module is its own class in its own package. Patcher/Lunar/Feather all do this.

### Anti-Pattern 6: Assuming the user has Java installed

**What people do:** Try to detect system Java, fall back to "please install Java" if missing.

**Why it's wrong:** The user expects the same one-click Lunar experience. Java version mismatches (they have 21, you need 8) are the #1 support-ticket driver for every custom launcher that skips bundling.

**Do this instead:** Bundle Adoptium Temurin JRE 8 via `extraResources`. Accepts ~60-100MB install size, removes an entire class of user errors, matches Lunar's approach.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Microsoft identity platform | MSAL node library, device code flow | Requires Azure app registration with `XboxLive.signin` scope. Register once, ship client ID in launcher code (not a secret). |
| Xbox Live (XBL) | POST `user.auth.xboxlive.com/user/authenticate` with MS token | Returns XBL token + user hash (uhs). Not rate-limited in practice. |
| Xbox Secure Token Service (XSTS) | POST `xsts.auth.xboxlive.com/xsts/authorize` with XBL token | Returns XSTS token with 24h lifetime. |
| Minecraft Services | POST `api.minecraftservices.com/authentication/login_with_xbox` | Returns MC access token. GET `/minecraft/profile` for UUID + name. |
| Mojang Launcher Meta | GET `launchermeta.mojang.com/mc/game/version_manifest_v2.json` then per-version `client.json` | Cache aggressively — 1.8.9's manifest is frozen. |
| Mojang Game Files | GET from URLs in `client.json` and asset index | CDN, no auth, SHA1-verifiable. |
| Mojang Resources CDN | GET `resources.download.minecraft.net/<xx>/<hash>` | Content-addressed asset storage. |
| Maven Central / Forge Maven | GET Forge artifacts | Forge jars come from `maven.minecraftforge.net`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Renderer <-> Main (Electron) | `contextBridge` + `ipcRenderer.invoke` / `ipcMain.handle` | Named channels only, validated args, no raw IPC passthrough. |
| Main <-> Game (JVM) | Spawn args + stdout/stderr line parsing | One-way downward via args, one-way upward via log lines. No socket in v0.1. |
| Main process <-> Disk | Direct `fs/promises`, atomic writes for `accounts.json` and `config.json` | Use write-temp-rename pattern to avoid corruption on crash. |
| Mod <-> Disk | Forge's `FMLPreInitializationEvent.getSuggestedConfigurationFile()` for config, standard `System.out` for logs | Let Forge own the logging pipeline; don't reinvent it. |
| Mod <-> Cosmetics backend (future) | HTTPS with bearer token from `-Dwiiwho.token` | Only real network call from inside the game process. Keep it lazy + cached. |

## Suggested Build Order

Architecture dictates phase order because of hard dependencies. Suggested sequence for the roadmap:

1. **Phase: Launcher skeleton (Electron + React + IPC scaffolding)**
   - Depends on: nothing
   - Delivers: main/renderer/preload split, empty shell with "Play" button that alerts
   - Unblocks: everything else

2. **Phase: Microsoft auth flow**
   - Depends on: launcher skeleton
   - Delivers: device code flow, token exchange chain, encrypted token persistence
   - Unblocks: any launch that requires MC auth (i.e. all real launches against real servers)

3. **Phase: Download + launch vanilla 1.8.9**
   - Depends on: launcher skeleton (not auth — can use offline-mode username for local testing first)
   - Delivers: manifest fetch, library verify, natives extraction, vanilla launch
   - This is where you prove the JVM spawn + classpath work end-to-end
   - Can be tested independently of auth phase, then wired to auth

4. **Phase: JRE bundling + electron-builder packaging**
   - Depends on: launch phase (to have something worth packaging)
   - Delivers: installers for Windows and Mac with bundled Java 8
   - Unblocks: giving to test users

5. **Phase: Forge 1.8.9 integration + empty mod**
   - Depends on: vanilla launch works
   - Delivers: Forge installed, minimal `@Mod` class with log message, mod loads in game
   - Unblocks: all feature work

6. **Phase: Mixin bootstrap + first Mixin**
   - Depends on: Forge integration
   - Delivers: `mixins.wiiwho.json`, `MixinTweaker` added to tweakClass list, one trivial Mixin that prints at a render hook
   - Unblocks: perf work and any non-event-based rendering

7. **Phase: HUD framework + first HUD (FPS counter)**
   - Depends on: mod loads
   - Delivers: `HudModule` base, `ModuleManager`, config singleton, FPS counter rendered in-game
   - Unblocks: keystrokes, CPS, all future HUDs in parallel

8. **Phase: Remaining v0.1 HUDs (keystrokes, CPS)** (can be parallel after 7)

9. **Phase: Cosmetics pipeline + placeholder cape**
   - Depends on: mod + Mixin framework (cape renderer usually needs a Mixin)
   - Delivers: proves the entire cosmetics path end-to-end with a baked-in texture

10. **Phase: Crash report viewer + log streaming UI**
    - Depends on: launch phase produces crashes to view
    - Delivers: renderer shows crash-reports on bad exit

11. **Phase: Performance work (beat-Optifine)**
    - Depends on: everything else — you want to measure against a stable baseline
    - Scope to be decided by separate perf research phase

### Critical path

`skeleton -> launch-vanilla -> forge -> mod-skeleton -> HUD-framework`

Everything else branches off these nodes. Auth, packaging, and crash viewer can proceed in parallel to the HUD work once their predecessors land.

## Sources

- [Launching the game - wiki.vg](https://wiki.vg/Launching_the_game) — HIGH, official protocol wiki on the launch sequence and argument substitution
- [Java Edition client command line arguments - Minecraft Wiki](https://minecraft.wiki/w/Java_Edition_client_command_line_arguments) — HIGH, official wiki, exact argument list and 1.8.9-era main class
- [version_manifest.json - Minecraft Wiki](https://minecraft.wiki/w/Version_manifest.json) — HIGH, official manifest format
- [Client.json - Minecraft Wiki](https://minecraft.fandom.com/wiki/Client.json) — HIGH, official per-version manifest format
- [Game files - wiki.vg](https://wiki.vg/Game_files) — HIGH, library and asset download mechanics
- [.minecraft directory - Minecraft Wiki](https://minecraft.wiki/w/.minecraft) — HIGH, standard folder layout
- [Launching the game (merged) - Minecraft Wiki](https://minecraft.wiki/w/Minecraft_Wiki:Projects/wiki.vg_merge/Launching_the_game) — HIGH, detailed launch sequence
- [Microsoft authentication - Minecraft Wiki](https://minecraft.wiki/w/Microsoft_authentication) — HIGH, MS/XBL/XSTS/MC token chain
- [Microsoft Authentication Scheme - wiki.vg](https://wiki.vg/Microsoft_Authentication_Scheme) — HIGH, protocol detail
- [OAuth 2.0 device authorization grant - Microsoft Learn](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code) — HIGH, MSAL device code flow
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — HIGH, main/renderer/preload architecture
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) — HIGH, security boundary
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) — HIGH, safe API exposure
- [Electron Security best practices](https://www.electronjs.org/docs/latest/tutorial/security) — HIGH, IPC security
- [electron-builder Application Contents](https://www.electron.build/contents.html) — HIGH, extraResources/extraFiles for JRE bundling
- [electron-builder Common Configuration](https://www.electron.build/configuration.html) — HIGH, platform-specific build config
- [Tweakers and FMLLoadingPlugins - Legacy Modding Wiki](https://moddev.nea.moe/tweakers/) — MEDIUM, community wiki but accurate on LaunchWrapper/tweakClass
- [MixinBootstrap - CurseForge](https://www.curseforge.com/minecraft/mc-mods/mixinbootstrap) — MEDIUM, Mixin loader for 1.8.9 Forge production environments
- [Sk1erLLC/Patcher - GitHub](https://github.com/Sk1erLLC/Patcher) — HIGH (source-of-truth reference), Forge 1.8.9 mod architecture reference
- [Patcher Mod - Sk1er](https://sk1er.club/mods/patcher) — MEDIUM, feature list and HUD caching technique
- [Prism Launcher](https://github.com/PrismLauncher/PrismLauncher) — HIGH, open-source reference launcher (fork of MultiMC) for launch mechanics
- [MultiMC Directory Structure wiki](https://github.com/MultiMC/Launcher/wiki/Directory-Structure) — HIGH, standard instance layout reference
- [Lunar Client install paths - Hypixel forum](https://hypixel.net/threads/guide-how-to-install-modify-lunar-client-mod-profiles-works-with-new-update.3480413/) — MEDIUM, community-verified Lunar install paths on Win/Mac
- [Forge 1.8.9 @Mod + mcmod.info - Minecraft Forum](https://www.minecraftforum.net/forums/support/java-edition-support/3207771-forge-1-8-9-class_not_found-error) — MEDIUM, community but accurate on Forge 1.8.9 mod structure
- [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process) — HIGH, confirms utilityProcess is Node-only (must use child_process.spawn for Java)

---
*Architecture research for: Lunar-class Minecraft 1.8.9 client (desktop launcher + Forge mod)*
*Researched: 2026-04-20*
