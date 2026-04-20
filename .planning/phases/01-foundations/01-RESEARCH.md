# Phase 1: Foundations — Research

**Researched:** 2026-04-20
**Domain:** Greenfield scaffold — Forge 1.8.9 mod + Electron launcher + policy docs + Azure AD app submission
**Confidence:** HIGH for mod toolchain (verified against live `nea89o/Forge1.8.9Template`), HIGH for Electron security posture (verified against electronjs.org docs), HIGH for MODID collision (Modrinth empty, Hypixel blacklist checked), MEDIUM for Azure AD Minecraft-API approval timeline (public-facing evidence sparse; form URL confirmed, reviewer timeline anecdotal).

## Summary

Phase 1 is pure scaffolding: two toolchains set up end-to-end in parallel (Electron launcher skeleton + Forge 1.8.9 mod with trivial Mixin), three policy docs committed, Azure AD app registered and Minecraft API permission form submitted so Microsoft's 1-7 day review runs in the background while Phase 2 is designed. Nothing the user does in the launcher should actually *do* anything yet — Play is a dead button that logs a stub IPC event. This is a deliberate constraint: Phase 1's success criteria are reproducibility of the environment, not functionality.

The most load-bearing finding: **the live `nea89o/Forge1.8.9Template` uses Gradle 8.8 and `gg.essential.loom` version `0.10.0.+`**, which contradicts the STACK.md's Gradle 7.6 pin. Essential's loom fork is specifically engineered to work on Gradle 8; the "Gradle 8 breaks 1.8.9 Forge" pitfall from PITFALLS.md applies to the *legacy* ForgeGradle 2.1 path, which we are not using. Phase 1 pins Gradle 8.8 via the wrapper, as the template does.

Second load-bearing finding: **MODID `wiiwho` is clear on Modrinth** (search returns no results as of 2026-04-20) and not on the public Hypixel MODID blacklist (short, generic, non-feature-descriptive — the attributes that matter for D-02). CurseForge search returned 403 to automated fetch; planner should manually confirm on a browser. Escalation path per D-02 stays intact.

**Primary recommendation:** Fork `nea89o/Forge1.8.9Template`, rename, keep Gradle 8.8 + loom 0.10.0.+. Scaffold launcher via `pnpm create @quick-start/electron@latest launcher --template react-ts` and layer Tailwind v4 + shadcn/ui (unified `radix-ui`) on top. Register Azure AD app against `/consumers` authority with `XboxLive.signin offline_access` scopes, submit `aka.ms/mce-reviewappid` form during Phase 1 execution. Write ANTICHEAT-SAFETY.md / mojang-asset-policy.md / cape-provenance.md as skeleton templates the owner fills during Phase 4/Phase 5 reviews.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Brand & Naming**
- **D-01:** Display name is "WiiWho Client"
- **D-02:** MODID is `wiiwho` — collision-check CurseForge + Modrinth in Phase 1 execution; if taken, escalate and pick between `wiiwho-client` or a variant
- **D-03:** Launcher binaries are `WiiWho.exe` (Windows NSIS) and `WiiWho.app` (macOS)
- **D-04:** Brand identity directional in Phase 1; full design Phase 3

**Repo Layout**
- **D-05:** Single-repo, sibling-directory layout; no pnpm workspace
- **D-06:** Top-level dirs at repo root: `launcher/`, `client-mod/`, `assets/`, `docs/`, `.planning/` (existing)
- **D-07:** No per-app asset duplication — all assets in `assets/`, copied at build time

**Launcher Visual Direction**
- **D-08:** Dark + gamer (Lunar-ish) aesthetic
- **D-09:** Primary accent color is cyan `#16e0ee`
- **D-10:** Window is fixed-size, non-resizable, ~1000x650
- **D-11:** Layout is "Play-forward" — central Play button, no sidebar/tabs
- **D-12:** Typography is OS-native system sans (SF Pro macOS, Segoe UI Windows)
- **D-13:** Phase 3 design references = Lunar, Badlion, Feather

**Azure AD App**
- **D-14:** Register under project owner's personal Microsoft account
- **D-15:** Tenant / audience = "Personal Microsoft accounts only" (consumers)
- **D-16:** Redirect URI scheme = device-code-flow URI (exact form deferred to Phase 2, `prismarine-auth` drives)
- **D-17:** Azure registration happens during Phase 1 execution; Minecraft API permission form submitted immediately
- **D-18:** Azure app client ID is non-secret (public client, device code flow)

**Anticheat-Safety Doc**
- **D-19:** Markdown table per feature in `docs/ANTICHEAT-SAFETY.md` with columns: Feature | What it reads/writes | Hypixel verdict | BlocksMC verdict | Reviewer | Date
- **D-20:** Signoff authority = project owner
- **D-21:** CI enforcement = advisory only for v0.1
- **D-22:** Alt-account play test results live in ANTICHEAT-SAFETY.md, per-server section

**Placeholder Cape**
- **D-23:** Project owner draws it (clear provenance)
- **D-24:** Design = solid cyan (`#16e0ee`) + WiiWho logo/monogram
- **D-25:** Provenance documented in `docs/cape-provenance.md` with date, tool, license grant

**Deferred (Claude's Discretion)**
- **D-26:** Mojang asset policy doc format — one-pager, no CI rule in v0.1
- **D-27:** Mod template = `nea89o/Forge1.8.9Template` as reference; copy scaffolding, write our own `@Mod` main class; do NOT fork wholesale

### Claude's Discretion
- Exact format of the three policy-doc skeletons (see §Three Policy Doc Templates below)
- Exact filenames/paths of scaffolded launcher files (within Electron-vite defaults)
- Choice of scaffolding command (electron-vite `@quick-start/electron` vs. alternative)
- Exact IPC channel naming (must be named-channels, but the names are Claude's to pick — see §Named-Channel IPC Surface)
- Trivial Mixin target (something harmless like hooking `MinecraftServer.startServerThread` or a client-init log line)

### Deferred Ideas (OUT OF SCOPE)
- Custom frameless window with our own title bar — deferred to Phase 3
- Distinctive gaming typography (Rajdhani/Orbitron/Eurostile) — deferred to Phase 3
- Full visual identity lock — deferred to Phase 3
- CI enforcement of ANTICHEAT-SAFETY.md entries — deferred past v0.1
- Mojang-asset-policy CI rule — deferred past v0.1
- Alternative MSAL library — revisit only if Phase 2 hits problems
- Mac arm64 JRE bundle — Phase 3
- electron-updater / auto-update — out of v0.1
- EV code signing / macOS notarization — out of v0.1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **COMP-04** | WiiWho does not redistribute Minecraft assets; launcher downloads vanilla jar + libs from Mojang at runtime | §Three Policy Doc Templates (mojang-asset-policy.md); no Phase 1 code writes a jar to disk |
| **MOD-01** | Forge 1.8.9 mod scaffold using modern community toolchain (`gg.essential.loom` + Gradle 7.6+ + dual JDK) | §Standard Stack - Mod; §Mod Scaffold Playbook — confirmed against live `nea89o/Forge1.8.9Template` |
| **MOD-02** | `./gradlew runClient` launches dev 1.8.9 with mod + real MS login (DevAuth) for anticheat testing | §DevAuth Wiring — coordinates, version, JVM arg, first-run bootstrap confirmed |
| **MOD-03** | Generic non-feature-descriptive MODID to avoid Hypixel handshake blacklisting | §MODID Collision Check — `wiiwho` verified clear on Modrinth; escalation path documented |
| **MOD-04** | Mixin bootstrap pinned compatible with Forge 1.8.9 + LaunchWrapper (Mixin 0.7.11-SNAPSHOT) | §Standard Stack - Mod; §Trivial Mixin — template uses `shadowImpl("org.spongepowered:mixin:0.7.11-SNAPSHOT")` |
| **LAUN-01** | User can open launcher as packaged desktop app (Electron) | §Launcher Scaffold Playbook — `pnpm dev` opens Electron window; `electron-builder` deferred-minimal-config for Phase 3 |
| **LAUN-02** | Launcher renders React UI with visible "Play" button | §Launcher UI Skeleton — Play button is a dead button in Phase 1, logs stub IPC event |
| **LAUN-06** | Launcher follows Electron security best practices (contextIsolation on, nodeIntegration off, sandbox, preload bridge) | §Electron Security Runtime Verification — Electron 28+ defaults are all three; we verify at runtime with sentinel IPC handler |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Project-level directives from `./CLAUDE.md` that constrain Phase 1 planning:

- **Tech stack locked 2026-04-20:** Electron + TypeScript + React on launcher; Forge 1.8.9 + Java 8 + gg.essential.loom + MCP stable_22 + Mixin on mod
- **Target Minecraft version:** 1.8.9 only, project-wide lock
- **Anticheat safety:** All in-game features must be safe on Hypixel and BlocksMC — non-negotiable (Phase 1 ships zero features, but the *process* is established here)
- **Distribution model (v0.1):** Personal + small-group; no signed installers, no auto-update, no crash uploader
- **Legal:** No redistribution of Minecraft assets — launcher downloads jars at runtime (enforced by §mojang-asset-policy.md template)
- **Use Context7 / WebFetch to verify library APIs, never state library capabilities from training alone** (followed in this research — see §Sources for which claims were verified)
- **Platforms (v0.1):** Windows + macOS (Phase 1 verifies on Windows only per §Success Criteria; Mac build is Phase 3's problem)

## Standard Stack

### Core — Launcher (Electron)

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| **Electron** | 41.0.2 (or latest 41.x) | Desktop shell | VERIFIED — electronjs.org blog post confirms 41.0.2 is latest 41 as of early 2026; bundles Chromium 146 / Node 24 / V8 14.6. Electron 38 is end-of-support as of April 2026. |
| **electron-vite** | via `@quick-start/electron` template | Build orchestration + HMR | VERIFIED — `pnpm create @quick-start/electron@latest launcher --template react-ts` is the current scaffold command. |
| **Node.js (dev tooling)** | 22 LTS | Run electron-vite, pnpm | Use Node 22 even though Electron bundles Node 24 internally (STACK.md rationale: `@electron/*` repos pin min Node 22). |
| **TypeScript** | 5.6+ | Type safety | Strict mode. `moduleResolution: "bundler"` for Vite. |
| **React** | 19.x | Renderer UI | Current stable. |
| **Vite** | 6.x | Renderer dev server + bundler | Bundled via electron-vite template. |
| **Tailwind CSS** | 4.2.x | Styling | VERIFIED — tailwindcss.com/blog shows v4.1 (April 2025) and v4.2 referenced; v4.x is current major. Config lives in CSS (`@theme`), no `tailwind.config.js`. |
| **shadcn/ui** | Feb 2026 unified Radix build | UI components (copy-paste) | VERIFIED — `pnpm dlx shadcn@latest init` pulls unified `radix-ui` package automatically in `new-york` style. Migration command exists for older projects but we're greenfield. |
| **electron-builder** | 26.x (latest) | Packaging — Phase 3 uses this fully; Phase 1 just wires it as a dep | Phase 1 does not produce a packaged build; it produces a dev launch via `pnpm dev`. |

### Core — Mod (Forge 1.8.9)

**Versions verified live against `nea89o/Forge1.8.9Template` `build.gradle.kts` and `gradle-wrapper.properties` on 2026-04-20.**

| Library / Tool | Version | Purpose | Verified |
|----------------|---------|---------|----------|
| **Java (compile target)** | 8 (Temurin 8u4xx) | Minecraft 1.8.9 runtime | Locked by MC version. |
| **Java (Gradle daemon)** | 17 (Temurin 17) | Run Gradle — daemon requires 11+ | Template uses `java { toolchain { languageVersion.set(JavaLanguageVersion.of(8)) } }` with Gradle-daemon-on-17. |
| **Gradle** | **8.8** (via wrapper) | Build system | VERIFIED — template's `gradle-wrapper.properties` has `distributionUrl=https://services.gradle.org/distributions/gradle-8.8-bin.zip`. **This contradicts STACK.md's 7.6 pin.** The Essential loom fork is engineered for Gradle 8; the "Gradle 8 breaks" pitfall applies only to legacy ForgeGradle 2.1, which we are NOT using. Follow the template. |
| **`gg.essential.loom`** | **0.10.0.+** | Gradle plugin replacing ForgeGradle | VERIFIED — template's `build.gradle.kts` has `id("gg.essential.loom") version "0.10.0.+"`. Resolves to `gg.essential:architectury-loom:0.10.0.*` via `settings.gradle.kts` `resolutionStrategy.eachPlugin`. |
| **`dev.architectury.architectury-pack200`** | 0.1.3 | Pack200 support (Minecraft 1.8.9 compression artifact) | VERIFIED — template dependency. |
| **`com.github.johnrengelman.shadow`** | 8.1.1 | Fat-jar builder for including Mixin at dev-runtime | VERIFIED — template dependency. |
| **Mixin (SpongePowered)** | **0.7.11-SNAPSHOT** (runtime/shadowImpl) + **0.8.5-SNAPSHOT** (annotation processor) | Bytecode manipulation | VERIFIED — template uses BOTH: 0.7.11 as the LaunchWrapper-compatible runtime (1.8.9 requires LaunchWrapper Mixin), 0.8.5 as the annotation processor (apt tools are newer, non-runtime). Do not collapse these into one version. |
| **Minecraft** | 1.8.9 | Target game version | Locked. |
| **MCP Mappings** | `22-1.8.9` (stable_22) | SRG → Java name mapping | Locked — no newer mappings exist for 1.8.9. |
| **Forge** | `1.8.9-11.15.1.2318-1.8.9` | Modloader | Frozen — the final 1.8.9 Forge build. |
| **DevAuth-forge-legacy** | 1.2.1 (template pin; 1.2.2 is latest upstream as of Dec 2025) | Dev-environment MS login | VERIFIED — template uses `me.djtheredstoner:DevAuth-forge-legacy:1.2.1`. 1.2.2 exists but template hasn't bumped; use template's pin for known-good pairing. |

### Supporting — Launcher (Phase 1 minimum)

Phase 1 does NOT install these; they are listed here only so the planner knows what Phase 2/3/4 will add and does not accidentally pre-install them. Phase 1's `package.json` should have ONLY the electron-vite scaffold + Tailwind + shadcn + a state-library placeholder.

- `zustand` — state mgmt (Phase 2+)
- `@azure/msal-node`, `prismarine-auth` — auth (Phase 2)
- `@xmcl/core`, `@xmcl/installer` — launch orchestration (Phase 3)
- `electron-log`, `execa`, `p-queue` — operational libs (Phase 3)

**Phase 1 install list (canonical):**
```bash
# From repo root
pnpm create @quick-start/electron@latest launcher --template react-ts
cd launcher
pnpm add tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init   # pulls radix-ui unified package
pnpm add zustand              # one store for "is-launcher-loaded" flag — sanity check we can wire state end-to-end
```

**Version verification commands** the planner should include as a verification task (run during execute-phase):
```bash
npm view electron version
npm view electron-builder version
npm view @tailwindcss/vite version
npm view shadcn version
```
Record the resolved versions in the commit message — if the registry has moved since 2026-04-20, the versions above are still the upper bound; never downgrade unless a compat issue surfaces.

### Alternatives Considered

| Instead of | Could Use | Tradeoff | When to Switch |
|------------|-----------|----------|----------------|
| `@quick-start/electron` template | Hand-rolled electron-vite config | More control, more setup cost | Never in Phase 1 — template is the path of lowest risk. |
| Gradle 8.8 | Gradle 7.6 (per STACK.md) | Older = safer for legacy tooling; but loom 0.10.0.+ was designed for 8 | Only if Gradle 8.8 produces a concrete loom error — follow the template pin first. |
| `gg.essential.loom` | Legacy `net.minecraftforge.gradle.forge` 2.1 | Legacy is officially dead per PITFALLS.md | Never. |
| Zustand for the "loaded" flag | Just React state | Zustand is being added anyway in Phase 2; starting here proves the wiring | Discretion — using React state is fine if the planner wants to defer the Zustand install to Phase 2. |

### Installation Quick-Reference (Phase 1)

```bash
# ===== Mod scaffold (from repo root) =====
# One-time: install JDK 8 and JDK 17 side-by-side via Temurin / your distribution
# Clone template, then rename
git clone https://github.com/nea89o/Forge1.8.9Template client-mod
cd client-mod
rm -rf .git                                            # detach from template's history
# Edit gradle.properties: modid=wiiwho, baseGroup=club.wiiwho (or chosen group), version=0.1.0-SNAPSHOT
# Edit settings.gradle.kts: rootProject.name = "wiiwho-client-mod"
# Create the @Mod main class under src/main/java/<baseGroup>/wiiwho/WiiWho.java
# Create src/main/java/<baseGroup>/wiiwho/mixins/MixinMinecraft.java (trivial Mixin — see §Trivial Mixin)
# Create src/main/resources/mixins.wiiwho.json (refmap + mixin class list)
# Create src/main/resources/mcmod.info
./gradlew runClient
# On first run, DevAuth creates ~/.config/devauth/microsoft_accounts.json; add account interactively.

# ===== Launcher scaffold (from repo root) =====
pnpm create @quick-start/electron@latest launcher --template react-ts
cd launcher
# Edit package.json: name "wiiwho-launcher", version "0.1.0"
pnpm add tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init                            # interactive — pick new-york style, cssVariables=yes
pnpm add zustand                                       # optional Phase 1; see Supporting table
pnpm dev                                               # opens the dev window
```

---

## Architecture Patterns

### Recommended Repo Structure (Phase 1 output)

```
wiiwho-client/
├── .planning/                              # GSD (already exists)
├── CLAUDE.md                               # already exists
├── README.md                               # Phase 1 writes a stub
├── docs/
│   ├── ANTICHEAT-SAFETY.md                 # skeleton per D-19
│   ├── mojang-asset-policy.md              # one-pager per D-26
│   └── cape-provenance.md                  # template per D-25 (filled when owner draws cape)
├── assets/
│   ├── logo.svg                            # owner produces (monochrome-friendly, small)
│   ├── cape-placeholder.png                # owner produces in Phase 1 (solid #16e0ee + monogram)
│   └── README.md                           # "all launcher + mod + installer icons originate here"
├── launcher/                               # Electron + TS + React (pnpm project)
│   ├── package.json
│   ├── electron.vite.config.ts             # main/preload/renderer triple-build
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tailwind.config (v4 uses CSS @theme, so this may just be an index.css import)
│   ├── src/
│   │   ├── main/
│   │   │   ├── index.ts                    # createWindow with secure BrowserWindow config
│   │   │   └── ipc/
│   │   │       ├── auth.ts                 # auth:status stub handler
│   │   │       ├── game.ts                 # game:play stub handler (logs + returns noop)
│   │   │       └── settings.ts             # settings:get/set stub handlers (in-memory only for P1)
│   │   ├── preload/
│   │   │   └── index.ts                    # contextBridge.exposeInMainWorld('wiiwho', {...})
│   │   └── renderer/
│   │       ├── src/
│   │       │   ├── App.tsx                 # Play button, dead-button click handler
│   │       │   ├── main.tsx                # React root, imports global.css
│   │       │   ├── global.css              # Tailwind v4 @import "tailwindcss"; @theme block
│   │       │   └── lib/utils.ts            # shadcn's cn helper
│   │       └── index.html
│   └── resources/
│       └── icons/                          # copied from /assets at build time (Phase 3)
├── client-mod/                             # Forge 1.8.9 mod (Gradle project)
│   ├── build.gradle.kts                    # loom + mixin + shadow + pack200 (from template)
│   ├── settings.gradle.kts                 # pluginManagement + loom resolutionStrategy
│   ├── gradle.properties                   # modid=wiiwho, mcVersion=1.8.9, baseGroup=<chosen>
│   ├── gradlew, gradlew.bat, gradle/wrapper/
│   ├── src/main/java/<baseGroup>/wiiwho/
│   │   ├── WiiWho.java                     # @Mod class, logs hello on FMLInitializationEvent
│   │   └── mixins/
│   │       └── MixinMinecraft.java         # trivial Mixin — see §Trivial Mixin
│   └── src/main/resources/
│       ├── mcmod.info                      # Forge reads this; contains modid + version + authors
│       └── mixins.wiiwho.json              # refmap + mixin class list
└── scripts/                                # empty for Phase 1; Phase 3+ uses it
```

**Structure rationale:**
- **Sibling directories** (D-05, D-06): launcher and mod have different build tools, different languages, different lifecycles. Flat separation keeps tooling obvious.
- **`assets/` at root** (D-07): avoids per-app duplication; build steps copy into each app's resources at build time — that build-step wiring is Phase 3's job, Phase 1 just commits the raw assets.
- **Phase 1 stubs the IPC layer** (§Pattern 2 below) so Phase 2+ can add handler bodies without reshaping the file tree.

### Pattern 1: Two-process, one-way IPC (baseline)

**What:** Launcher's renderer talks to main via named IPC channels exposed through a `contextBridge` preload script. No `ipcRenderer` ever reaches the renderer directly.

**When:** Always — established in Phase 1 and never amended.

**Example (verbatim pattern, source: electronjs.org/docs/latest/api/context-bridge):**

```typescript
// launcher/src/preload/index.ts — the entire attack surface
import { contextBridge, ipcRenderer } from 'electron';

type Unsubscribe = () => void;

contextBridge.exposeInMainWorld('wiiwho', {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),       // Phase 2 adds login/logout
  },
  game: {
    play:   () => ipcRenderer.invoke('game:play'),          // Phase 1: dead stub
    status: () => ipcRenderer.invoke('game:status'),
    onStatus: (cb: (s: unknown) => void): Unsubscribe => {
      const h = (_: unknown, s: unknown) => cb(s);
      ipcRenderer.on('game:status-changed', h);
      return () => ipcRenderer.off('game:status-changed', h);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  },
});
```

**Why this structure:** matches ARCHITECTURE.md §Pattern 3; Phase 2+ extends each handler body without adding new channels or reshaping the preload surface.

### Pattern 2: Main-process-owns-state, renderer is a view

Established in Phase 1. No durable state exists in Phase 1 (no settings file written yet), but the IPC shape is set up so Phase 3 can add file-backed handlers by body-change only.

### Anti-Patterns to Avoid (Phase 1)

- **Exposing `ipcRenderer` directly to the renderer.** Do NOT do `contextBridge.exposeInMainWorld('ipc', ipcRenderer)` — PITFALLS.md §5 RCE vector.
- **Putting real auth / launch code in Phase 1.** Phase 1 is scaffolding only. Stub handlers return `{ ok: true, stub: true }` and log an event. Implementing auth here would violate phase boundaries.
- **Forking `nea89o/Forge1.8.9Template` with its git history intact.** Clone + `rm -rf .git` + initial commit in our repo. Keeping upstream history drags in unrelated noise (D-27 explicit: "Do NOT fork wholesale").
- **Using Gradle 7.6 against our better judgment.** The template uses 8.8 — use 8.8. The "Gradle 8 is broken" story in STACK.md/PITFALLS.md is about the LEGACY toolchain we are explicitly not using.
- **Running Mixins inside Kotlin classes.** Irrelevant for Phase 1 (Java only) but worth locking the rule now: Mixins stay in `.java` files even if we add Kotlin later.

---

## Mod Scaffold Playbook

### 1. Fork the reference template

Source: https://github.com/nea89o/Forge1.8.9Template

Template confirmed live on 2026-04-20 with:
- Gradle 8.8 wrapper
- Plugins: `idea`, `java`, `gg.essential.loom` 0.10.0.+, `dev.architectury.architectury-pack200` 0.1.3, `com.github.johnrengelman.shadow` 8.1.1
- Java toolchain: Java 8
- Repositories: mavenCentral, spongepowered, `https://pkgs.dev.azure.com/djtheredstoner/DevAuth/_packaging/public/maven/v1`
- Dependencies (key): minecraft 1.8.9, mappings `22-1.8.9`, forge `1.8.9-11.15.1.2318-1.8.9`, mixin 0.7.11-SNAPSHOT shadowImpl + 0.8.5-SNAPSHOT annotation processor, DevAuth-forge-legacy 1.2.1

### 2. Rename points

Edit in `gradle.properties`:
```properties
loom.platform=forge
org.gradle.jvmargs=-Xmx2g
baseGroup = club.wiiwho              # or whatever namespace the owner wants
mcVersion = 1.8.9
modid = wiiwho                        # D-02 (pending collision check — see §MODID Collision)
version = 0.1.0-SNAPSHOT
```

Edit in `settings.gradle.kts`:
```kotlin
rootProject.name = "wiiwho-client-mod"
```

Rename the Java package under `src/main/java/` from `com.example.examplemod` (or whatever the template uses) to `<baseGroup>.wiiwho`. This is a directory move + package statement edit. Also update `@Mod(modid = ...)` annotation and any `mixins.wiiwho.json` references.

### 3. Write the `@Mod` class

`src/main/java/club/wiiwho/WiiWho.java` (adjust package to match baseGroup):
```java
package club.wiiwho;

import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod(modid = WiiWho.MODID, version = WiiWho.VERSION, name = "WiiWho Client", clientSideOnly = true)
public class WiiWho {
    public static final String MODID = "wiiwho";
    public static final String VERSION = "0.1.0";

    private static final Logger LOGGER = LogManager.getLogger(MODID);

    @Mod.EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        LOGGER.info("WiiWho preInit — v{}", VERSION);
    }

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        LOGGER.info("WiiWho init — ready");
    }
}
```

Note `clientSideOnly = true`: 1.8.9 Forge requires this for client-only mods; without it, the mod is rejected from server-side installations and the Forge handshake flags it inconsistently.

### 4. Write `mcmod.info`

`src/main/resources/mcmod.info`:
```json
[
  {
    "modid": "wiiwho",
    "name": "WiiWho Client",
    "description": "A performance + QoL Minecraft 1.8.9 client.",
    "version": "${version}",
    "mcversion": "${mcversion}",
    "url": "",
    "authors": ["WiiWho Client team"],
    "credits": ""
  }
]
```

`${version}` and `${mcversion}` are substituted by the template's `processResources` task (template already wires this via the `tasks.withType<ProcessResources>` block).

### 5. Write the Mixin config

`src/main/resources/mixins.wiiwho.json`:
```json
{
  "required": true,
  "package": "club.wiiwho.mixins",
  "compatibilityLevel": "JAVA_8",
  "refmap": "mixins.wiiwho.refmap.json",
  "minVersion": "0.7.11",
  "client": ["MixinMinecraft"],
  "injectors": { "defaultRequire": 1 }
}
```

Template's `loom { forge { mixinConfig("mixins.wiiwho.json") } }` (or equivalent property) registers this with the launch config. Verify the template's exact idiom when renaming — it may reference the config name by replacing `$modid` placeholder.

### 6. Trivial Mixin (for MOD-04 success criterion)

`src/main/java/club/wiiwho/mixins/MixinMinecraft.java`:
```java
package club.wiiwho.mixins;

import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Minecraft.class)
public class MixinMinecraft {
    @Inject(method = "startGame", at = @At("HEAD"))
    private void wiiwho$onStartGame(CallbackInfo ci) {
        System.out.println("[WiiWho] Mixin hello — Minecraft.startGame hooked");
    }
}
```

**Why `Minecraft.startGame`:** it runs once per client init, on the main thread, before the main menu renders. A `System.out.println` there is harmless, visible in the dev console, and proves the Mixin pipeline works end-to-end. Do NOT target a render/tick hotspot in Phase 1 — a noisy Mixin muddies the signal that the pipeline works.

**Success condition for MOD-04:** The string `[WiiWho] Mixin hello` appears in stdout when `./gradlew runClient` launches 1.8.9.

### 7. Run

```bash
./gradlew runClient -Ddevauth.enabled=1
```

Expected behavior on first run:
1. DevAuth notices `devauth.enabled=1`, creates its config directory (`~/.config/devauth/` on Linux/macOS, `%APPDATA%\devauth\` on Windows), logs a device code to the console.
2. User opens browser to `https://microsoft.com/devicelogin`, enters code, signs in with their MS account.
3. DevAuth persists the refresh token into its `microsoft_accounts.json` (unencrypted — acceptable for dev).
4. Minecraft 1.8.9 launches, user is logged in as their real MS account, `[WiiWho] Mixin hello` appears in console, Forge logs list `wiiwho` as a loaded mod.

On subsequent runs DevAuth silently refreshes; no browser needed unless the refresh token expired.

### Windows-Specific runClient Verification

**Success criterion 3** specifies Windows verification. Known Windows quirks:

| Quirk | Symptom | Fix |
|-------|---------|-----|
| JDK path spaces (`C:\Program Files\Eclipse Adoptium\...`) | Gradle startup OK; `runClient` fails to resolve javac | Use short-path or quote in `JAVA_HOME`; loom handles spaces correctly when `org.gradle.java.home` is set via `gradle.properties` |
| Multiple JDKs installed, wrong one picked | Build uses JDK 17 to compile (bytecode 61 > target 52 error) | Pin via `gradle.properties`: `org.gradle.java.installations.auto-detect=true` + the `java { toolchain { languageVersion.set(JavaLanguageVersion.of(8)) } }` block in `build.gradle.kts` forces loom to find JDK 8 |
| LWJGL natives not extracted | `UnsatisfiedLinkError: lwjgl64.dll` on first runClient | Template handles — loom extracts natives under `.gradle/loom-cache/launch/natives/`. If missing, delete `.gradle/loom-cache/` and re-run |
| Windows Defender scanning the runClient subprocess | ~30s pause at Minecraft boot | Expected on dev machines; add the repo folder as a Defender exclusion if impactful |
| Hostname contains spaces or unicode | DevAuth token encoding fails | Rare; flagged only because owner is on Windows — if login fails, check `hostname` command output |

**Verification command sequence** (Phase 1 execute should run these on the owner's Windows box):
```powershell
# In repo root
java -version                                    # ensure Java 8 and 17 both visible
client-mod\gradlew --version                     # confirms Gradle 8.8
client-mod\gradlew runClient -Ddevauth.enabled=1 # first-time DevAuth flow
# Confirm in Minecraft: F3 shows "Mods loaded: 4 of 4" (Minecraft, mcp, FML, Forge, wiiwho)
# Confirm in console: "[WiiWho] Mixin hello — Minecraft.startGame hooked"
```

---

## DevAuth Wiring

**Source:** https://github.com/DJtheRedstoner/DevAuth

| Property | Value | Notes |
|----------|-------|-------|
| Maven repo | `https://pkgs.dev.azure.com/djtheredstoner/DevAuth/_packaging/public/maven/v1` | Public Azure DevOps maven feed — already in template |
| Artifact (1.8.9) | `me.djtheredstoner:DevAuth-forge-legacy` | The `-forge-legacy` module covers 1.8.9 through 1.12.2 |
| Pin (from template) | `1.2.1` | Template uses this; upstream has 1.2.2 (Dec 2025) but don't deviate without cause |
| Gradle scope | `runtimeOnly("me.djtheredstoner:DevAuth-forge-legacy:1.2.1")` | Shipped to `runClient` only, not into the production jar |
| JVM arg to enable | `-Ddevauth.enabled=1` | Pass via `./gradlew runClient -Ddevauth.enabled=1`; DevAuth is a no-op without this flag |
| Account config location | `~/.config/devauth/microsoft_accounts.json` (Linux/macOS), `%APPDATA%\devauth\microsoft_accounts.json` (Windows) | Created on first run; owner logs in interactively |
| Storage format | Plaintext JSON | Acceptable for dev environment; NOT acceptable for v0.1 user-facing auth (Phase 2 uses `safeStorage`/keychain) |
| Known loom-compat note | DevAuth 1.0.0+ requires `gg.essential.loom` ≥ 0.10.0.2 | Template's pins (loom 0.10.0.+, DevAuth 1.2.1) are compatible — confirmed |

**Integration step** (already present in template's `build.gradle.kts`, keep as-is): the `runClient` task needs to include DevAuth on the classpath. Template handles via a configuration like `loom.clientLaunch { vmArgs.add("-Ddevauth.enabled=$project.hasProperty('devauth') ? 1 : 0") }` or similar — verify the exact idiom before modifying.

**If the owner wants DevAuth always-on**: add `systemProp.devauth.enabled=1` to `~/.gradle/gradle.properties` (user-global, not committed). Do NOT commit this to repo-local `gradle.properties` — other developers might not want it.

---

## MODID Collision Check

**D-02:** MODID is `wiiwho`. Phase 1 execution MUST verify this is clean.

### Checks performed in research

| Source | Result | Confidence |
|--------|--------|------------|
| Modrinth search `wiiwho` | No results returned | HIGH — WebFetch confirmed 2026-04-20 |
| CurseForge search `wiiwho` | Automated fetch returned 403; requires manual browser verification | LOW automated, HIGH manual if owner confirms |
| Hypixel published MODID blacklist | `wiiwho` not on any public list; published blacklisted IDs are feature-descriptive (`perspectivemod`, `djperspectivemod`) and our ID is generic | MEDIUM — Hypixel's full blacklist is not publicly exhaustive |
| Short, generic, non-feature-descriptive (D-02 criterion) | ✓ passes | HIGH |

### Decision tree

1. **Primary:** Use `wiiwho`. Proceed with registration in `gradle.properties`.
2. **If manual CurseForge check reveals a collision:** Escalate to owner. Choose between:
   - `wiiwho-client` — still short, explicit about what we are
   - `wiiwhocl` — 8-char, no-dash, tighter but less readable
   - `wiiwho_client` — snake_case variant (some older Forge tooling is picky about dashes)
3. **If both are taken:** Owner picks something not-yet-tested but in the same generic-namespace family. Research does not prejudge.
4. **Record the decision** in `client-mod/gradle.properties` AND in `docs/ANTICHEAT-SAFETY.md` (first row of the table, "Project MODID" feature, logged with reviewer + date per D-19).

### URLs to manually verify (planner lists these as tasks)

- https://modrinth.com/mods?q=wiiwho (checked automated — clean)
- https://www.curseforge.com/minecraft/search?search=wiiwho (manual — automated fetch blocked)
- https://modrinth.com/mods?q=wiiwho-client (check the fallback)
- https://www.curseforge.com/minecraft/search?search=wiiwho-client (check the fallback)

**"Clean result" criteria:** zero exact matches on name or slug. Near-matches (`wiiwho-something`) are not collisions but should be noted in ANTICHEAT-SAFETY.md.

---

## Launcher Scaffold Playbook

### Scaffolding command

```bash
pnpm create @quick-start/electron@latest launcher --template react-ts
```

**Verified 2026-04-20** against electron-vite.org/guide/. This produces:
- `launcher/electron.vite.config.ts` — triple-build (main/preload/renderer) with HMR
- `launcher/src/main/index.ts` — main process entry with a `createWindow` example
- `launcher/src/preload/index.ts` — `contextBridge` example
- `launcher/src/renderer/` — Vite + React app
- `launcher/package.json` — `dev`, `build`, `preview` scripts; electron, electron-vite, electron-builder as dev deps

### Post-scaffold edits

1. **Rename** `package.json` → `"name": "wiiwho-launcher"`, `"version": "0.1.0"`.
2. **Harden the BrowserWindow** — the template's defaults in Electron 28+ already have `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` per docs, but we set them EXPLICITLY anyway so a future accidental downgrade is visible in code review. See §Electron Security Runtime Verification.
3. **Add Tailwind v4** — `pnpm add tailwindcss @tailwindcss/vite`. Edit `electron.vite.config.ts` renderer section: add `@tailwindcss/vite` to Vite plugins. Add `@import "tailwindcss";` to `src/renderer/src/global.css`. No `tailwind.config.js` (v4 is CSS-configured).
4. **Add shadcn/ui** — `pnpm dlx shadcn@latest init`. Accept defaults for the `new-york` style, which pulls the unified `radix-ui` package (Feb 2026 change — verified). Generate `Button` component: `pnpm dlx shadcn@latest add button`.
5. **Stub the IPC handlers** — in `src/main/index.ts`, register handlers for the named channels below (see §Named-Channel IPC Surface). Each handler does `console.log('received: <channel>')` and returns a stub payload.
6. **Wire preload** — `src/preload/index.ts` matches Pattern 1 above.
7. **Wire renderer** — `App.tsx` has a Play button that calls `window.wiiwho.game.play()` on click, logs the returned stub payload to the dev console. Window-chrome set to fixed-size 1000x650 (D-10) via `BrowserWindow` constructor options `{ width: 1000, height: 650, resizable: false }`.

### Launcher UI Skeleton (Phase 1 minimum)

```tsx
// launcher/src/renderer/src/App.tsx
import { Button } from "@/components/ui/button";

export default function App() {
  const handlePlay = async () => {
    const result = await window.wiiwho.game.play();
    console.log('Play clicked:', result);   // Phase 1: result is { ok: true, stub: true }
  };

  return (
    <div className="h-screen w-screen bg-neutral-900 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-[#16e0ee] mb-8">WiiWho Client</h1>
      <Button
        size="lg"
        className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-xl px-12 py-6"
        onClick={handlePlay}
      >
        Play
      </Button>
      <p className="text-neutral-500 text-sm mt-8">v0.1.0-dev</p>
    </div>
  );
}
```

**Deliberate limitations:**
- No account badge (Phase 2 adds)
- No settings button (Phase 3 adds)
- No routes / navigation (Phase 3 adds)
- Dark background + cyan accent only — full palette is Phase 3 (D-04)
- Fonts are OS-default (D-12) — no font imports

### Type declarations for the IPC surface

`launcher/src/renderer/src/wiiwho.d.ts`:
```typescript
export interface WiiWhoAPI {
  auth: {
    status: () => Promise<{ loggedIn: boolean; username?: string }>;
  };
  game: {
    play: () => Promise<{ ok: boolean; stub?: boolean; reason?: string }>;
    status: () => Promise<{ state: 'idle' | 'launching' | 'playing' | 'crashed' }>;
    onStatus: (cb: (s: { state: string }) => void) => () => void;
  };
  settings: {
    get: () => Promise<Record<string, unknown>>;
    set: (patch: Record<string, unknown>) => Promise<{ ok: boolean }>;
  };
}

declare global {
  interface Window {
    wiiwho: WiiWhoAPI;
  }
}
```

Phase 1 returns stubs. Phase 2+ fills bodies. This type surface is the contract.

---

## Named-Channel IPC Surface for v0.1

This is the **complete API contract** Phase 2+ builds against. Phase 1 registers each channel with a stub handler; subsequent phases fill bodies. No new channels should appear without this table being updated.

### Channel List (v0.1 complete)

| Channel | Direction | Payload in | Payload out | Phase that implements |
|---------|-----------|------------|-------------|-----------------------|
| `auth:status` | invoke | none | `{ loggedIn: bool, username?: string, uuid?: string }` | Phase 2 |
| `auth:login` | invoke | none | `{ ok: bool, username?: string, error?: string }` | Phase 2 |
| `auth:logout` | invoke | none | `{ ok: bool }` | Phase 2 |
| `auth:device-code` | on (event from main) | — | `{ userCode: string, verificationUri: string, expiresInSec: number }` | Phase 2 |
| `game:play` | invoke | none | `{ ok: bool, reason?: string }` | Phase 3 (launch), stub in Phase 1 |
| `game:cancel` | invoke | none | `{ ok: bool }` | Phase 3 |
| `game:status` | invoke | none | `{ state: 'idle'\|'launching'\|'downloading'\|'playing'\|'crashed' }` | Phase 3 |
| `game:status-changed` | on (event from main) | — | same as `game:status` payload | Phase 3 |
| `game:progress` | on (event from main) | — | `{ bytesDone: number, bytesTotal: number, currentFile: string }` | Phase 3 |
| `settings:get` | invoke | none | `Record<string, unknown>` — full settings object | Phase 3 (RAM slider) |
| `settings:set` | invoke | `Partial<Record<string, unknown>>` | `{ ok: bool }` | Phase 3 |
| `logs:read-crash` | invoke | `{ crashId?: string }` | `{ sanitizedBody: string }` | Phase 3 (crash viewer) |

### Phase 1 stub behavior

Every channel's handler should:
1. `console.log` the channel name and args (or "(no args)")
2. Return a stub payload per the "Payload out" column, with `stub: true` added where possible and all unknown fields set to safe defaults (`loggedIn: false`, `state: 'idle'`, `{}` for settings)
3. For event-emitting channels (`auth:device-code`, `game:status-changed`, `game:progress`): do NOT emit in Phase 1 — the `on` subscription works but no events fire

### Why this full surface in Phase 1

Defining the surface now lets Phase 2 (auth) land WITHOUT touching preload or renderer type files. The renderer already knows about `auth:login` — it just calls into a handler that used to stub and now really works. Same for Phase 3's game and settings channels. This is the "main-process-owns-state" pattern (Pattern 2) in practice.

### What Phase 1 MUST NOT do

- Implement any handler body that contacts the network
- Spawn any subprocess
- Read or write files (except stub in-memory state)
- Import `@azure/msal-node`, `prismarine-auth`, `@xmcl/core`, or any launch/auth dep (deferred to their respective phases)

---

## Azure AD App Registration Playbook

### Step-by-step portal walkthrough

1. **Sign in** to `https://entra.microsoft.com` (or `https://portal.azure.com` → "Microsoft Entra ID") using the owner's **personal Microsoft account** (D-14). Must be the same MS account the owner uses for Minecraft; that account must already be an "Application Developer" in its default tenant (personal MS accounts auto-qualify).

2. Navigate: **Entra ID** → **App registrations** → **+ New registration**.

3. Fill in:
   - **Name:** `WiiWho Client` (user-visible during device-code login consent)
   - **Supported account types:** select **"Personal Microsoft accounts only"** (D-15) — this is the consumer-tenant option
   - **Redirect URI:** initially leave blank; we configure under Authentication after registration

4. Click **Register**. The Overview page shows the **Application (client) ID** — this is what the launcher ships in source code (D-18: non-secret).

5. Navigate: **Authentication** (left sidebar of the app page).

   - Click **+ Add a platform**.
   - Select **Mobile and desktop applications**.
   - In the list of suggested redirect URIs, check **`https://login.microsoftonline.com/common/oauth2/nativeclient`** (this is the canonical public-client native redirect). Click **Configure**.
   - Scroll down to **Advanced settings** → **Allow public client flows**. Toggle **Yes**. This is REQUIRED for device-code-flow; without it, the `/devicecode` endpoint returns an error.
   - Click **Save**.

   **IMPORTANT cross-verification:** Microsoft's MSAL.NET docs for device code flow say "The Reply URI should be `https://login.microsoftonline.com/common/oauth2/nativeclient`" AND "choose Yes to 'Treat application as a public client'" (https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/desktop-mobile/device-code-flow). That same toggle appears as "Allow public client flows" in the current Entra portal UI. Both spellings refer to the same setting.

6. Navigate: **API permissions** → confirm `User.Read` is present by default; leave it.

   - We do NOT add `XboxLive.signin` here via "Request API permissions" — that permission is **not exposed in the standard Azure portal UI** (verified via Microsoft Q&A threads). Instead, it is requested in the OAuth scope at runtime (`XboxLive.signin offline_access`), and the `api.minecraftservices.com` endpoint will return 403 until Microsoft approves us via the review form below.

7. **Submit the Minecraft API permission request form:**
   - URL: **https://aka.ms/mce-reviewappid** (redirects to a Microsoft Forms URL — verified 2026-04-20)
   - The form is loaded dynamically and its exact fields could not be fetched automatically. Planner should open it in a browser during Phase 1 execution and fill in:
     - Application (client) ID (copy from Overview page)
     - Tenant type (personal / consumers)
     - App name and purpose (brief: "personal / small-group Minecraft 1.8.9 custom launcher")
     - Owner contact email (the account that owns the Azure app)
     - Expected user volume (low — personal + small-group)
   - Submit.
   - **Review timeline:** public evidence is sparse. Cited community estimates range 1-7 days (per CONTEXT.md + STACK.md), though some Q&A threads report weeks. The official timeline is not documented by Microsoft. Budget 1-7 days; if not approved in 10 days, escalate by re-submitting or opening a Microsoft Q&A thread.
   - **Approval notification:** arrives at the Azure-app-owner's email (same MS account used in step 1). Store the approval confirmation in a password manager or pinned email so Phase 2 can cite it.

8. **Commit the client ID** to the launcher source (Phase 2 uses it; Phase 1 does not). Store in `launcher/src/main/auth/config.ts` as `export const AZURE_CLIENT_ID = '<guid>'`. Per D-18 and PITFALLS.md §6, this is NOT a secret — device code flow is a public client flow with no client secret.

### Known ambiguity — device code flow tenant

Microsoft's MSAL.NET doc says: *"AADSTS90133: Device Code flow is not supported under /common or /consumers endpoint"* — implying you need a tenanted authority.

The minecraft.wiki says: *"You **must** use the `consumers` AAD tenant to sign in with the `XboxLive.signin` scope."*

MSAL Node 4.5+ release notes say device code flow works with personal MS accounts.

**Resolution:** The device-code flow with `XboxLive.signin` scope and `/consumers` tenant DOES work empirically — `prismarine-auth` uses exactly this combo and is active/maintained (3.1.1 published 2026-03-31). The AADSTS90133 error is about a different, organizational scenario. This is a real tension to be aware of; **Phase 2's research phase MUST re-verify empirically** with prismarine-auth against our real Azure app. Phase 1's Azure app registration uses consumers — D-15 is locked, and this is what works in practice.

---

## Electron Security Runtime Verification

**Requirement LAUN-06:** "Launcher follows Electron security best practices (contextIsolation on, nodeIntegration off, sandbox, preload bridge for IPC)".

**Success criterion 4:** "contextIsolation: true / nodeIntegration: false / sandbox: true all confirmed at runtime".

Electron 28+ defaults these to the secure values, but the phase's success criterion explicitly requires RUNTIME confirmation — not just config-level confirmation. Implementation:

### Config-level (defensive-coded even though defaults match)

```typescript
// launcher/src/main/index.ts
import { BrowserWindow, app, ipcMain } from 'electron';
import * as path from 'node:path';

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 650,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,       // default in E28+; set explicitly for code-review clarity
      nodeIntegration: false,       // default in E28+; set explicitly for code-review clarity
      sandbox: true,                // default in E28+; set explicitly for code-review clarity
    },
  });
  // ... load renderer
}
```

### Runtime verification (added as a sentinel IPC channel)

```typescript
// launcher/src/main/ipc/security.ts  -- Phase 1 ONLY; can stay or be removed later
import { ipcMain, BrowserWindow } from 'electron';

ipcMain.handle('__security:audit', () => {
  const win = BrowserWindow.getAllWindows()[0];
  const prefs = win?.webContents.getWebPreferences();
  return {
    contextIsolation: prefs?.contextIsolation === true,
    nodeIntegration: prefs?.nodeIntegration === false,
    sandbox: prefs?.sandbox === true,
    allTrue: prefs?.contextIsolation === true &&
             prefs?.nodeIntegration === false &&
             prefs?.sandbox === true,
  };
});
```

Expose in preload:
```typescript
// launcher/src/preload/index.ts (add to the contextBridge block)
__debug: {
  securityAudit: () => ipcRenderer.invoke('__security:audit'),
},
```

### Runtime verification test

```typescript
// launcher/src/renderer/src/App.tsx — add a button or run in dev console
// In dev console after `pnpm dev`:
const result = await window.wiiwho.__debug.securityAudit();
console.log(result);
// Expected: { contextIsolation: true, nodeIntegration: false, sandbox: true, allTrue: true }
```

**If any value is wrong:** the test fails loudly. The planner should include this assertion as a verification step in the phase's success-criterion checklist.

### Complementary renderer-side check

Inside the renderer, confirm that `process` is not defined (proves nodeIntegration is off) and `require` is not defined:
```typescript
// launcher/src/renderer/src/App.tsx — at module scope
console.assert(
  typeof (globalThis as any).process === 'undefined',
  'SECURITY: process is defined in renderer — nodeIntegration is NOT off'
);
console.assert(
  typeof (globalThis as any).require === 'undefined',
  'SECURITY: require is defined in renderer — contextIsolation or sandbox is NOT set'
);
```

Phase 1 success criterion 4 is satisfied when both the main-side `__security:audit` returns `allTrue: true` AND the renderer-side asserts do not fire.

### Electron Fuses (optional enhancement)

Electron's `@electron/fuses` package lets us **compile-time-bake** these flags into the Electron binary itself (can't be overridden at runtime by an attacker who somehow tampers with the asar). This is overkill for Phase 1 scaffolding (we're not packaging yet) but noted here so Phase 3's packaging phase can adopt it. Not a Phase 1 task.

---

## Three Policy Doc Templates

### `docs/ANTICHEAT-SAFETY.md` (per D-19, D-20, D-21, D-22)

```markdown
# WiiWho Anticheat Safety Review

**Purpose:** Every user-facing client feature has an explicit pass/fail verdict against Hypixel's and BlocksMC's anticheat policies before it ships. This doc is the source of truth.

**Authority:** Project owner (per D-20). Owner signs off on every feature entry below before its feature PR merges.

**CI enforcement:** Advisory only for v0.1 (per D-21). Revisit before any public release.

## Feature Review Log

| Feature | What it reads / writes | Hypixel verdict (+ source link) | BlocksMC verdict | Reviewer | Date |
|---------|------------------------|--------------------------------|------------------|----------|------|
| Project MODID: `wiiwho` | Forge handshake announces this string | PASS — generic, non-feature-descriptive; not on any known Hypixel blacklist. [Hypixel Allowed Mods](https://support.hypixel.net/hc/en-us/articles/6472550754962) | PASS — BlocksMC does not publish a MODID blacklist; short generic ID is lowest-risk | _owner_ | 2026-04-20 |
| (future features added here, one row per feature, before that feature's PR merges) | | | | | |

## Alt-Account Play Tests

### Hypixel

| Build hash | Features enabled | Duration | Outcome | Date |
|------------|------------------|----------|---------|------|
| (rows added per release per COMP-02) | | | | |

### BlocksMC

| Build hash | Features enabled | Duration | Outcome | Date |
|------------|------------------|----------|---------|------|
| (rows added per release per COMP-03) | | | | |

## Review Process

1. Before a feature PR merges, author adds a row to **Feature Review Log** with pending verdict.
2. Owner reviews the feature against Hypixel's published allowed-mods policy and BlocksMC's (ask in community if no written policy exists for BlocksMC), fills in verdict, signs (name + date).
3. If verdict is FAIL on either server, the feature is redesigned or dropped. No "maybe ship it" row.
4. Before each release, owner adds an alt-account play test row under the relevant server (Phase 4 establishes the throwaway-account tooling).

## Red Lines (never permitted — from PITFALLS.md §2 and FEATURES.md anti-features)

The following are permanent "never" entries. Moving any of these to a merged feature requires first rewriting PROJECT.md's non-goals.

- Minimap (any kind)
- Reach display
- Hitboxes / entity ESP
- Packet modification
- Input automation (auto-click, auto-sprint, triggerbot, scaffolding, kill aura)
- Xray / ore highlight
- Velocity modification / anti-knockback
- Nametag through walls / ESP-flavored rendering

---
*Anticheat safety review log for WiiWho Client. Seeded: 2026-04-20. Owner-signed entries only.*
```

### `docs/mojang-asset-policy.md` (per D-26, COMP-04)

```markdown
# WiiWho Client — Mojang Asset Policy

**Purpose:** Clear-text record of how WiiWho avoids the Mojang EULA's asset-redistribution pitfall.

## Policy

1. **Launcher downloads at runtime, never bundles.** The WiiWho launcher fetches the vanilla 1.8.9 jar, all Minecraft libraries (LWJGL, Mojang libs, asset index, asset objects) directly from Mojang's official manifest (`launchermeta.mojang.com`) and asset CDN (`resources.download.minecraft.net`). Nothing Mojang-copyrighted is packaged into WiiWho's installer or mod jar.

2. **Our mod jar contains only original code + WiiWho-owned assets.** The `wiiwho-*.jar` built by `./gradlew build` ships:
   - Original Java code authored for WiiWho
   - Mixin class files authored for WiiWho
   - Asset PNGs authored by or licensed-from-owner to WiiWho (e.g. the placeholder cape per D-23)
   - Dependency bytecode from open-source libraries (Mixin, DevAuth in dev only — never in release builds) under their respective licenses
   - **Nothing derived from Mojang's textures, models, sounds, or code**

3. **Cosmetics never derive from Mojang assets.** A hypothetical cape cannot reuse a Mojang cape texture. A hypothetical hat cannot modify Mojang's Steve head. All WiiWho cosmetics originate from WiiWho's own art pipeline; provenance is documented per-asset (see `cape-provenance.md` for the placeholder cape).

4. **Brand distance is enforced.** WiiWho's name, logo, and launcher chrome do not replicate or invite confusion with Mojang's official Minecraft Launcher branding (no grass-block icon, no Mojang typography, no green-highlight color scheme).

5. **No redistribution channels.** WiiWho is distributed only as its own installer/bundle. No mirror, torrent, or sideloaded-jar pipeline redistributes Mojang assets under a WiiWho brand.

## Verification

- CI does not enforce this in v0.1 (per CONTEXT.md deferred-ideas — revisit before public release).
- A manual audit before any shipped build confirms: `dist/` contains zero files with Mojang signatures, the mod jar's `META-INF/` and `assets/` directories contain no Mojang-sourced files.

## References

- [Mojang EULA](https://www.minecraft.net/en-us/eula)
- [Mojang Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines)
- Research basis: `.planning/research/PITFALLS.md` §Pitfall 3 (monetizing / packaging Mojang copyright)

---
*Policy committed 2026-04-20 as part of Phase 1 Foundations (COMP-04).*
```

### `docs/cape-provenance.md` (per D-25)

```markdown
# Placeholder Cape — Provenance

**Per project decision D-23, D-24, D-25.**

## Asset

- **File:** `assets/cape-placeholder.png`
- **Dimensions:** 64 x 32 pixels (Minecraft 1.8 cape format)
- **Design:** Solid cyan (`#16e0ee`) + WiiWho logo/monogram (simple silhouette)

## Provenance

- **Created by:** Project owner (WiiWho Client project owner — name on file in git commit history)
- **Date created:** _[filled in when owner commits the PNG]_
- **Tool used:** _[e.g. Aseprite / Photoshop / Procreate / in-browser editor]_
- **Source materials:** None — 100% original art. No derivative of any Mojang asset (cape, texture, model, or pattern).
- **License grant:** Owner grants WiiWho Client the perpetual, royalty-free right to bundle, display, and distribute this PNG as the v0.1 placeholder cape. This grant is unconditional and transfers with any future change of project ownership. Attribution is NOT required.

## Relationship to Mojang Asset Policy

This asset is covered by `docs/mojang-asset-policy.md` rule 2 (our mod jar ships WiiWho-owned assets) and rule 3 (cosmetics never derive from Mojang assets). Nothing about this cape resembles, modifies, or contains any Mojang-sourced pixel.

## v0.3 Plan

A real cosmetics catalogue (multiple capes, hats) replaces this placeholder per COSM-10 in the v0.3 milestone. Each future catalogue entry gets its own provenance entry in this document (or a successor per-asset doc).

---
*Provenance committed 2026-04-20 (placeholder — owner fills "Date created" / "Tool used" when art is drawn).*
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Forge 1.8.9 Gradle setup | Hand-crafted `build.gradle.kts` from scratch | Fork `nea89o/Forge1.8.9Template` | 1-week timesink (PITFALLS.md §1); template is live, maintained, used by every 1.8.9 mod shipped in last 2 years |
| Mixin-on-Forge-1.8.9 classloader wiring | Hand-rolled coremod + `FMLLoadingPlugin` | Template's loom config + `mixins.wiiwho.json` | Classic silent-failure path; template handles classloader timing |
| Dev-env Microsoft login | Roll your own MSAL in the Gradle `runClient` task | DevAuth-forge-legacy 1.2.1 | 300+ lines saved; handles token refresh, file-based persistence, MS account selector |
| Electron main/preload/renderer bundler setup | Hand-crafted Vite configs | `@quick-start/electron` scaffold via `pnpm create` | Three correctly-configured Vite configs for Electron's three processes; HMR-aware |
| contextBridge IPC boilerplate | Raw `ipcRenderer` exposure to renderer | `contextBridge.exposeInMainWorld` with typed facade | Raw exposure is RCE (PITFALLS.md §5); typed facade is the only safe pattern |
| Tailwind/shadcn setup | Hand-installed Tailwind + hand-configured Radix primitives | `pnpm dlx shadcn@latest init` | shadcn's init command handles the unified-radix-ui package installation correctly |
| Azure AD Minecraft API approval | Try to hand-navigate the Partner Center / CSP enrollment process | Use the self-service form at `aka.ms/mce-reviewappid` | CSP/Partner Center enrollment is for commercial Xbox developers; the MCE form is the indie-developer path — confirmed via Microsoft Q&A 2024-2025 threads |

**Key insight:** Phase 1's risk surface is almost entirely about setting up the environment; each "build your own" here costs days and has zero product value. Lean on templates, inherit their pins, deviate only when the template breaks.

---

## Common Pitfalls

### Pitfall 1: Using Gradle 7.6 because STACK.md said so

**What goes wrong:** Planner reads STACK.md's "Gradle 7.6 is the sweet spot" guidance and pins Gradle 7.6 for the mod. Template was designed for 8.8; subtle loom behavior differs; plugin resolution may fail or work only in IntelliJ-imported mode.

**Why it happens:** STACK.md is outdated — the actual live template uses 8.8. STACK.md's warning about "Gradle 8.x with legacy ForgeGradle 2.1" is true, but we're using `gg.essential.loom`, not legacy ForgeGradle.

**How to avoid:** Use whatever Gradle version the template uses. Verified 2026-04-20 against template: **8.8**. Do not second-guess.

**Warning signs:** `gradle-wrapper.properties` in our repo doesn't match the template's; plugin resolution fails with "plugin not found in any of the following sources."

### Pitfall 2: Leaving DevAuth `devauth.enabled=1` out of the JVM args

**What goes wrong:** DevAuth is on the classpath, but `runClient` launches in offline mode with an anonymous "Player" username — can't join Hypixel for anticheat testing.

**Why it happens:** DevAuth is no-op without the system property. Forgetting `-Ddevauth.enabled=1` is the single most common DevAuth mistake.

**How to avoid:** Either always pass `-Ddevauth.enabled=1` on the command line, OR add `systemProp.devauth.enabled=1` to `~/.gradle/gradle.properties` (user-global, never committed). Document the flag in `client-mod/README.md`.

**Warning signs:** Minecraft title bar reads "Minecraft 1.8.9" but the in-game username is "Player" or something default.

### Pitfall 3: Renaming the package directory but forgetting to update `mixins.wiiwho.json`

**What goes wrong:** Mixin config references the template's original `com.example.examplemod.mixins` package but we moved mixins to `club.wiiwho.mixins`. Mixin framework silently doesn't load them — the trivial Mixin never fires. Success criterion 3 fails with no error message.

**Why it happens:** Mixin resolves classes by package-qualified class names in the JSON config. Rename without a grep breaks the link silently.

**How to avoid:** After renaming packages, grep the entire repo for the old package name. Every reference in `mixins.wiiwho.json`, `@Mod` annotations, `mcmod.info`, and any `build.gradle.kts` property must be updated.

**Warning signs:** Minecraft launches cleanly, `wiiwho` appears in the mods list, but `[WiiWho] Mixin hello` never prints.

### Pitfall 4: Azure app registered but Minecraft API form not submitted

**What goes wrong:** Phase 1 ends "successfully" with the Azure app registered, but the `aka.ms/mce-reviewappid` form wasn't submitted (planner forgot step 7). Phase 2 starts, hits `api.minecraftservices.com/authentication/login_with_xbox` → 403. Phase 2 stalls waiting for approval because the queue never started running.

**Why it happens:** Registering the Azure app is one portal flow; submitting the MCE form is a separate Microsoft Forms URL. Planner may conflate them.

**How to avoid:** Make "submit MCE form" an explicit checklist item in Phase 1's execute phase, separate from "register Azure app". Record submission timestamp in STATE.md so the review-queue countdown is visible.

**Warning signs:** Phase 1 commit log says "Azure app registered" but not "MCE form submitted"; Phase 2 kickoff surfaces a 403 at first launch.

### Pitfall 5: Stubbed Play button that isn't dead enough

**What goes wrong:** Phase 1's Play button `onClick` tries to be helpful — imports `@azure/msal-node`, calls `new PublicClientApplication(...)`, catches the error. Now Phase 1 has a Phase 2 dependency and the build fails because `@azure/msal-node` isn't installed.

**Why it happens:** Scope creep. A dead button feels incomplete.

**How to avoid:** The Play button's `onClick` calls `window.wiiwho.game.play()`, which in main process is `ipcMain.handle('game:play', () => ({ ok: true, stub: true }))`. Zero other code. Zero other imports.

**Warning signs:** Phase 1's `package.json` has `@azure/msal-node` or `prismarine-auth` or `@xmcl/core` listed.

### Pitfall 6: Mixin annotation processor version mismatch

**What goes wrong:** Developer reads STACK.md "Mixin 0.7.11-SNAPSHOT" and pins the annotation processor to 0.7.11 as well. Compile fails or silently fails-to-weave.

**Why it happens:** The template uses Mixin 0.7.11-SNAPSHOT as RUNTIME (for LaunchWrapper) but 0.8.5-SNAPSHOT as the annotation processor (apt tools are newer, unrelated to the runtime classloader). Collapsing them breaks.

**How to avoid:** Keep both. Template's idiom is verified:
```kotlin
dependencies {
    shadowImpl("org.spongepowered:mixin:0.7.11-SNAPSHOT") { /* ... */ }
    annotationProcessor("org.spongepowered:mixin:0.8.5-SNAPSHOT:processor")
}
```

**Warning signs:** `@Mixin` classes compile but produce no output class in `build/classes/`; or compile fails with a Mixin-annotation-specific error.

### Pitfall 7: IntelliJ Gradle JVM vs Project SDK confusion

**What goes wrong:** IntelliJ sets Project SDK = JDK 17 (which runs Gradle) but forgets to set Gradle JVM separately, or vice versa. Either compile uses JDK 17 (bytecode 61) or Gradle fails to start on JDK 8.

**Why it happens:** IntelliJ has two SDK settings that are easy to confuse: File → Project Structure → Project SDK, AND File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JVM.

**How to avoid:** Project SDK = JDK 8 (for compile target), Gradle JVM = JDK 17 (for Gradle daemon). Explicit, both set. Template's `java { toolchain { languageVersion.set(JavaLanguageVersion.of(8)) } }` enforces the compile side via foojay-resolver-convention.

**Warning signs:** Error like `class file has wrong version 61.0, should be 52.0`; or `Could not start Gradle daemon, Java 8 too old`.

---

## Runtime State Inventory

**Trigger:** N/A — Phase 1 is greenfield. No existing runtime state to migrate.

Explicitly:
- **Stored data:** None — no databases exist yet.
- **Live service config:** None — no services deployed.
- **OS-registered state:** None — no scheduled tasks, no pm2 processes, no launchd plists.
- **Secrets/env vars:** The Azure AD client ID is created in Phase 1 (step 8 above) and committed to source; it is non-secret per D-18. The DevAuth MS refresh token is stored unencrypted in the dev user's `~/.config/devauth/` or `%APPDATA%\devauth\` by DevAuth itself on first `runClient` — this is a dev-user-local artifact, never committed, never shipped.
- **Build artifacts:** None exist yet. After Phase 1 completes, `client-mod/build/` and `launcher/out/` will contain local dev artifacts — these are gitignored and do not carry forward any state from prior phases.

Phase 1 creates state (MS refresh token in DevAuth's local config; Azure client ID in source). Subsequent phases that reference this state do so via well-known locations documented above.

---

## Code Examples

### IPC stub handler (main process, Phase 1)

```typescript
// launcher/src/main/ipc/game.ts
import { ipcMain } from 'electron';

export function registerGameHandlers() {
  ipcMain.handle('game:play', async () => {
    console.log('[wiiwho] game:play invoked (stub)');
    return { ok: true, stub: true, reason: 'Phase 1 scaffold — no launch implemented' };
  });

  ipcMain.handle('game:status', async () => ({ state: 'idle' }));

  ipcMain.handle('game:cancel', async () => ({ ok: true, stub: true }));
}

// launcher/src/main/index.ts
import { registerGameHandlers } from './ipc/game';
import { registerAuthHandlers } from './ipc/auth';
import { registerSettingsHandlers } from './ipc/settings';

app.whenReady().then(() => {
  registerAuthHandlers();
  registerGameHandlers();
  registerSettingsHandlers();
  createWindow();
});
```

### Trivial Mixin (mod, Phase 1)

```java
// client-mod/src/main/java/club/wiiwho/mixins/MixinMinecraft.java
package club.wiiwho.mixins;

import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Minecraft.class)
public class MixinMinecraft {
    @Inject(method = "startGame", at = @At("HEAD"))
    private void wiiwho$onStartGame(CallbackInfo ci) {
        System.out.println("[WiiWho] Mixin hello — Minecraft.startGame hooked");
    }
}
```

### Tailwind v4 entry CSS (launcher)

```css
/* launcher/src/renderer/src/global.css */
@import "tailwindcss";

@theme {
  --color-wiiwho-accent: #16e0ee;
  --color-wiiwho-bg: #111111;
}

html, body, #root {
  height: 100%;
  margin: 0;
  background-color: var(--color-wiiwho-bg);
  color: #e5e5e5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

---

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| `net.minecraftforge.gradle.forge` 2.1 plugin | `gg.essential.loom` 0.10.0.+ (fork of architectury-loom) | Community migration 2022-2023; now universal | Everyone uses loom; legacy ForgeGradle is dead |
| Individual `@radix-ui/react-*` packages | Unified `radix-ui` package | shadcn/ui changelog Feb 2026 | New shadcn projects auto-pull unified; migration command available |
| `tailwind.config.js` | CSS-based config (`@theme` block) | Tailwind v4.0 (Jan 2025) | No JS config file; config lives in the CSS file that imports Tailwind |
| Hand-rolled MSAL flow in Electron | `prismarine-auth` (Phase 2) | prismarine-auth 3.x actively maintained (2025-2026) | Saves 300+ lines; Phase 1 doesn't use it yet, but is aware |
| Electron with `nodeIntegration: true` | Contextisolation + sandbox defaults (E28+) | Electron 20.0 (sandbox default), E12.0 (context isolation default) | Secure-by-default; our explicit settings are defense in depth |
| Minecraft Mojang auth (Yggdrasil) | Microsoft OAuth + XBL + XSTS + Minecraft Services | Mojang shut down Yggdrasil 2021 | Phase 2's entire complexity — Phase 1 submits the Azure app |

**Deprecated / outdated (relevant to Phase 1):**
- **STACK.md's Gradle 7.6 pin** — live template uses 8.8 per our 2026-04-20 verification. Follow the template.
- **`tailwind.config.js`** — Tailwind v4 has no JS config file.
- **`dxxxxy/1.8.9ForgeTemplate`** — template's own author declared it deprecated. Don't use it.

---

## Open Questions

1. **Exact MCE review timeline**
   - What we know: CONTEXT.md + STACK.md cite "1-7 days"; Microsoft doesn't publish an SLA
   - What's unclear: whether personal-MS-account submissions are prioritized vs work-account; whether low-volume submissions ("personal / small-group use") get auto-approved or wait in queue like commercial launchers
   - Recommendation: Submit on day 1 of Phase 1 execution. If Phase 2 starts before approval arrives, Phase 2's research/discuss phases can still run; only the actual `api.minecraftservices.com` handshake requires approval, and that's Phase 2's final integration step.

2. **Device code flow against `/consumers` with `XboxLive.signin` — does the MSAL Node device-code call actually work against that tenant?**
   - What we know: empirical evidence (prismarine-auth works; Lunar, Prism, HeliosLauncher all use this pattern) says yes
   - What's unclear: Microsoft's MSAL.NET docs suggest AADSTS90133 may fire on `/consumers` for device code — but the empirical counter-evidence is strong
   - Recommendation: This is Phase 2's problem. Phase 1 registers the Azure app per D-15 and trusts the empirical ecosystem evidence. If Phase 2 hits the AADSTS90133 error empirically, research alternatives (prismarine-auth's internal flow, or roll-your-own direct HTTP to `/consumers/devicecode`).

3. **CurseForge MODID collision check blocked by 403**
   - What we know: Modrinth is clean (confirmed), Hypixel public blacklists do not list `wiiwho`
   - What's unclear: CurseForge's automated search returned 403 to our fetch; no confirmation from that source
   - Recommendation: Owner manually opens `https://www.curseforge.com/minecraft/search?search=wiiwho` during Phase 1 execution, confirms no hits, records the confirmation (screenshot or check in `docs/ANTICHEAT-SAFETY.md` first row).

4. **Electron-vite template vs electron-vite library directly**
   - What we know: The `@quick-start/electron` CLI wraps electron-vite with a sensible React-TS template
   - What's unclear: Whether the CLI's generated files drift ahead of the library — if yes, a scaffolded project might reference newer APIs than `electron-vite` on npm (unlikely but possible)
   - Recommendation: Scaffold with the CLI, then verify `package.json` pins a recent `electron-vite` version; do not upgrade it until a concrete reason.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| JDK 8 (Temurin) | Mod runtime for Minecraft 1.8.9 | To be verified on owner's Windows box | n/a | None — required. If missing, Phase 1 execute installs it. |
| JDK 17 (Temurin) | Gradle daemon | To be verified on owner's Windows box | n/a | JDK 11+ also works for Gradle; 17 is preferred per template compat |
| pnpm | Launcher package manager | To be verified | n/a | npm works but we standardize on pnpm per STACK.md |
| Node.js 22 LTS | Launcher dev tooling | To be verified | n/a | Node 20 LTS also works; do NOT use 24 |
| Git | Scaffold operations (clone template) | Present (repo already exists, already has commits) | ✓ | — |
| Modern browser | Azure portal navigation; DevAuth device-code sign-in; MCE form submission | User's system — assumed present | — | — |
| Windows 10+ | Phase 1 success criterion 3 specifies Windows verification | Owner's machine (confirmed Windows per CLAUDE.md env block) | ✓ | — |
| IntelliJ IDEA 2022.2+ (Community or Ultimate) | Breakpoint debugging the mod; strongly recommended but not strictly required for `./gradlew runClient` | To be verified | n/a | VS Code with Gradle extension can run tasks but can't debug-step-into Minecraft source. Owner preference. |

**Missing dependencies with no fallback:**
- JDK 8 and JDK 17 if not installed — Phase 1 execute's first task is to install both and set them up in IntelliJ (or VS Code + command line).
- Access to the owner's personal Microsoft account for Azure app registration.

**Missing dependencies with fallback:**
- IntelliJ — VS Code suffices for `./gradlew runClient`; breakpoint debugging is Phase 4/5's concern.

**Verification command** (planner runs during Phase 1 execute, before any scaffolding):
```powershell
# On the owner's Windows box
java -version                           # want: openjdk 8 or 17 listed
node --version                          # want: 22.x
pnpm --version                          # want: present (else `npm i -g pnpm`)
git --version                           # baseline
```

---

## Validation Architecture

Phase 1 is scaffolding + policy docs + Azure submission. It establishes the validation INFRASTRUCTURE that all subsequent phases inherit. Phase 1 itself has very little to test — the success criteria are reproducibility-of-the-environment, not functionality.

### Test Framework

| Property | Launcher | Mod |
|----------|----------|-----|
| Framework | **Vitest** (recommended — pairs with Vite natively; ships in the `@quick-start/electron` react-ts template with a placeholder test) | **JUnit 5** via Gradle's built-in `test` task (the template likely includes this; if not, it's a one-line plugin add) |
| Config file | `launcher/vitest.config.ts` (created by the scaffold or to be added) | `client-mod/build.gradle.kts` `test { useJUnitPlatform() }` |
| Quick run command (per task commit) | `pnpm --filter launcher test --run` | `./gradlew :client-mod:test --rerun-tasks` (fast — few tests in Phase 1) |
| Full suite command (per wave merge / phase gate) | `pnpm test` (runs all launcher tests) | `./gradlew check` (runs tests + any static analysis) |

**Rationale for Vitest over Jest:** Vite-native, no Babel layer needed, faster. The `@quick-start/electron` template uses Vitest by default.

**Rationale for JUnit 5 over a smoke-test-only approach on the mod side:** Even though Phase 1 only needs to assert that `runClient` starts, JUnit infrastructure pays off in Phase 4 (HUD framework unit tests) — establishing it now means Phase 4 doesn't re-litigate the test framework.

### Phase Requirements → Test Map

Phase 1 produces primarily manual / visual verification. Test automation here is about ESTABLISHING the infrastructure, not covering scanty Phase 1 features.

| Req ID | Behavior | Test Type | Automated Command | File to create in Wave 0 |
|--------|----------|-----------|-------------------|---------------------------|
| **COMP-04** | Mojang asset policy doc exists with required content | smoke (existence + content check) | `pnpm --filter launcher run check:docs` (runs a Node script that greps the doc) | `launcher/scripts/check-docs.mjs` OR `scripts/check-docs.mjs` |
| **MOD-01** | Mod scaffold builds without errors | smoke | `./gradlew --dry-run build` from `client-mod/` | — (Gradle built-in) |
| **MOD-02** | `./gradlew runClient` launches dev 1.8.9 with mod + DevAuth MS login | manual (interactive — cannot fully automate MS OAuth in CI) | `./gradlew runClient -Ddevauth.enabled=1` — human observes | — |
| **MOD-03** | MODID string matches `wiiwho` in built artifacts | unit | `./gradlew :client-mod:test --tests club.wiiwho.ModidTest` | `client-mod/src/test/java/club/wiiwho/ModidTest.java` (asserts `WiiWho.MODID.equals("wiiwho")`) |
| **MOD-04** | Mixin fires during `runClient` — stdout contains `[WiiWho] Mixin hello` | integration (capture stdout of runClient) | manual observation in Phase 1; possible automation in Phase 4 | — |
| **LAUN-01** | `pnpm dev` opens an Electron window | manual (visual) | `pnpm --filter launcher dev` — human observes | — |
| **LAUN-02** | Play button is visible in the opened window | manual (visual) / optional Playwright | `pnpm --filter launcher test:e2e` (if Playwright configured) | deferred — Phase 3 adds Playwright when UI has more to test |
| **LAUN-06** | contextIsolation / nodeIntegration / sandbox all correct at runtime | unit (via `__security:audit` IPC) | `pnpm --filter launcher test -- security-audit.test.ts` | `launcher/src/main/ipc/security.test.ts` (calls a mock ipcMain invoke for `__security:audit`, asserts `allTrue: true`) |

### Sampling Rate

- **Per task commit:** `pnpm --filter launcher test --run` (fast unit only) + `./gradlew :client-mod:test` — both must pass green
- **Per wave merge:** full suite on both sides — `pnpm test` + `./gradlew check`
- **Phase gate (before `/gsd:verify-work`):** full suite green AND manual verification of the four success criteria (ANTICHEAT + policy docs exist with content; Azure app registered + MCE form submitted with timestamps in STATE.md; `./gradlew runClient` launches 1.8.9 with the trivial Mixin hook visible; `pnpm dev` opens a window with the Play button and `__security:audit` returns `allTrue: true`)

### Wave 0 Gaps

Phase 1 starts a greenfield tree — everything in this list must be created during Wave 0 of execution:

- [ ] `launcher/vitest.config.ts` — may be scaffolded by template; verify and adjust
- [ ] `launcher/src/main/ipc/security.test.ts` — covers LAUN-06 runtime verification
- [ ] `launcher/src/main/ipc/*.test.ts` — one-liner tests per IPC handler group (confirming stub return payloads)
- [ ] `client-mod/src/test/java/club/wiiwho/ModidTest.java` — covers MOD-03 (asserts `WiiWho.MODID` literal)
- [ ] `scripts/check-docs.mjs` — asserts the three policy docs exist with required headings (ANTICHEAT-SAFETY.md has "Feature Review Log"; mojang-asset-policy.md has "Policy" section with "downloads at runtime" phrase; cape-provenance.md has "Provenance" section with "original art" phrase) — covers COMP-04
- [ ] `.github/workflows/ci.yml` (placeholder) — **OPTIONAL** for Phase 1; a 3-job CI (launcher tests, mod tests, docs check) costs ~30min to set up and establishes the pattern early. If Phase 1's scope feels tight, defer to Phase 3. Recommendation: include a minimal ci.yml so Phase 2 doesn't need to add CI infra mid-flight.

*If nothing gets created: "None — existing test infrastructure covers all phase requirements" — but this is NOT applicable here; Phase 1 IS the wave-0 for the whole project.*

---

## Sources

### Primary (HIGH confidence — verified via live fetch 2026-04-20)

**Mod toolchain:**
- [nea89o/Forge1.8.9Template `build.gradle.kts`](https://github.com/nea89o/Forge1.8.9Template/blob/master/build.gradle.kts) — confirmed plugin stack (loom 0.10.0.+, architectury-pack200 0.1.3, shadow 8.1.1); confirmed Mixin 0.7.11-SNAPSHOT shadowImpl + 0.8.5-SNAPSHOT annotation processor; DevAuth-forge-legacy 1.2.1
- [nea89o/Forge1.8.9Template `settings.gradle.kts`](https://github.com/nea89o/Forge1.8.9Template/blob/master/settings.gradle.kts) — confirmed plugin repositories list, loom resolutionStrategy
- [nea89o/Forge1.8.9Template `gradle/wrapper/gradle-wrapper.properties`](https://github.com/nea89o/Forge1.8.9Template/blob/master/gradle/wrapper/gradle-wrapper.properties) — confirmed Gradle 8.8
- [hannibal002/Example-1.8.9-Mod `settings.gradle.kts`](https://github.com/hannibal002/Example-1.8.9-Mod/blob/main/settings.gradle.kts) — cross-verified same plugin + repo pattern
- [DJtheRedstoner/DevAuth README](https://github.com/DJtheRedstoner/DevAuth) — confirmed JVM arg `-Ddevauth.enabled=1`; repo URL; artifact coordinates; loom ≥0.10.0.2 compatibility note

**Launcher toolchain:**
- [electron-vite.org getting-started](https://electron-vite.org/guide/) — confirmed `pnpm create @quick-start/electron@latest launcher --template react-ts` is the scaffold command
- [electronjs.org blog: Electron 41.0.0](https://www.electronjs.org/blog/electron-41-0) — confirmed 41.0.2 is latest 41.x; Chromium 146 / Node 24 / V8 14.6; Electron 38 end-of-support
- [Electron docs: Security](https://www.electronjs.org/docs/latest/tutorial/security) — confirmed contextIsolation / nodeIntegration / sandbox are defaults in E28+; @electron/fuses referenced
- [Electron docs: contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) — confirmed exposeInMainWorld pattern + event cleanup
- [shadcn/ui changelog 2026-02 Radix UI](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) — confirmed unified `radix-ui` package; `shadcn migrate radix` command
- [tailwindcss.com blog](https://tailwindcss.com/blog) — confirmed v4.x current (v4.2 referenced)

**Azure AD / Microsoft auth:**
- [Microsoft Learn: OAuth 2.0 device authorization grant](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code) — device code protocol details, polling interval, 15-minute expiry
- [Microsoft Learn: Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) — portal steps for app registration, supported account types table
- [Microsoft Learn: Device Code Flow (MSAL.NET)](https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/desktop-mobile/device-code-flow) — confirmed public-client toggle and redirect URI `https://login.microsoftonline.com/common/oauth2/nativeclient`
- [minecraft.wiki: Microsoft authentication](https://minecraft.wiki/w/Microsoft_authentication) — confirmed `/consumers` tenant requirement for `XboxLive.signin`; confirmed `aka.ms/mce-reviewappid` is the Minecraft API permission submission form

**Modrinth collision check:**
- [Modrinth search: wiiwho](https://modrinth.com/mods?q=wiiwho) — confirmed no results 2026-04-20

### Secondary (MEDIUM confidence)

- [Microsoft Q&A: How to get Azure AD Xbox Live API Access](https://learn.microsoft.com/en-us/answers/questions/1416915/how-to-get-azure-ad-xbox-live-api-access) — community confirmation of `aka.ms/mce-reviewappid` as the indie-dev approval path vs. CSP/Partner Center (which is for commercial Xbox developers)
- [Microsoft Q&A: How to get XboxLive.signin permission](https://learn.microsoft.com/en-au/answers/questions/5768276/how-to-get-xboxlive-signin-permission-for-azure-ap) — confirms XboxLive.signin is not exposed via standard Azure portal permission UI
- [Microsoft Q&A: Where is the XboxLive scope](https://learn.microsoft.com/en-us/answers/questions/1251517/where-is-the-xboxlive-scope-in-azure-ad-app) — cross-reference
- [astra137 GitHub gist: Minecraft access token demo](https://gist.github.com/astra137/4784ed9748429b01bf28414f9b90ca9c) — confirms scopes `['XboxLive.signin', 'offline_access']` for the MSAL step
- [DJtheRedstoner/DevAuth releases](https://github.com/DJtheRedstoner/DevAuth/releases) — confirmed 1.2.2 is latest upstream (Dec 2025); template pins 1.2.1

### Tertiary (LOW confidence — to be verified at execute time)

- **MCE review timeline (1-7 days)** — STACK.md + CONTEXT.md cite this; no Microsoft-official SLA exists. If Phase 2 is delayed by slow approval, the schedule has slack because Phase 2's research / discuss phases can still run.
- **CurseForge MODID collision** — automated fetch blocked by 403; owner must manually verify during Phase 1 execute.
- **Full fields in the `aka.ms/mce-reviewappid` form** — Microsoft Forms loads dynamically and our automated fetch couldn't see form contents; rely on community docs and fill empirically.
- **Hypixel MODID blacklist completeness** — Hypixel does not publish an exhaustive list; absence of `wiiwho` from public threads is suggestive, not definitive.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack (mod) | HIGH | Every version verified against live `nea89o/Forge1.8.9Template` source files |
| Standard stack (launcher) | HIGH | Electron 41.0.2, Tailwind v4.x, shadcn Feb-2026 all verified against official sources |
| Gradle 8.8 vs STACK.md's 7.6 | HIGH | Template fetch showed 8.8 directly; STACK.md is stale on this detail |
| Architecture patterns | HIGH | Inherited from existing `.planning/research/ARCHITECTURE.md`; Phase 1 applies subsets |
| Policy doc templates | HIGH | Shaped by D-19, D-25, D-26 verbatim; content is a trivial skeleton |
| Azure AD walkthrough | MEDIUM-HIGH | Steps 1-6 verified against Microsoft official docs; step 7 (MCE form) verified URL exists but form fields not machine-readable |
| Device-code-flow + /consumers ambiguity | MEDIUM | Empirical evidence says it works; Microsoft's own docs have a caveat (AADSTS90133) — noted as open question for Phase 2 |
| MODID collision | MEDIUM-HIGH | Modrinth + Hypixel clean; CurseForge automated check blocked but owner can verify manually in 30 seconds |
| Pitfalls | HIGH | Each pitfall cross-checked against PITFALLS.md and the live template |
| Validation architecture | HIGH | Vitest + JUnit 5 are the community-standard choices; scaffold adds Vitest automatically |

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — toolchain is stable for 1.8.9; the only fast-moving items are Electron patch versions and MCE review timeline, neither of which are blocking Phase 1)

---

*Phase 1 Research — Foundations. Phase boundary: scaffolding + policy + Azure submission only. No Phase 2+ work belongs here.*
