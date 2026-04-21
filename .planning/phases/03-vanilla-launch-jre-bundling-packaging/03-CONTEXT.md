# Phase 3: Vanilla Launch, JRE Bundling & Packaging - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers **an authenticated user reaching the vanilla 1.8.9 main menu from a packaged installer** on Windows + macOS:

1. From the post-auth Play-forward screen, clicking Play downloads + SHA1-verifies vanilla 1.8.9 (client jar + libraries + asset index + assets) from the Mojang manifest, spawns the bundled Temurin 8 JVM with the real MC access token from Phase 2, and reaches the Minecraft main menu logged in as the user's real MS account.
2. All launcher-side UX for the launch loop lands: RAM slider (1-4 GB, default 2 GB, with G1GC tooltip), launch-log stream on failure, crash viewer with token/username redaction (display + clipboard), minimize-on-main-menu.
3. `electron-builder` produces the v0.1 distributable installers: Windows NSIS (`Wiiwho Client Setup.exe`) and macOS Universal DMG — both bundling the platform-specific Temurin 8 JRE and the initial Wiiwho mod jar.
4. All 15 Phase 3 requirements covered: LCH-01, LCH-02, LCH-03, LCH-05, LCH-06, LCH-07, JRE-01, JRE-02, JRE-03, PKG-01, PKG-02, LAUN-03, LAUN-04, LAUN-05, COMP-05.

Phase 3 does NOT: install Forge at runtime or inject the mod into the classpath (Phase 4 — LCH-04, MOD-05, MOD-06). The mod jar is **bundled in the installer** per SC4 but Phase 3 launches vanilla 1.8.9 only; Phase 4 wires the injection path. Phase 3 also does not ship any HUD code (Phase 4), cosmetics (Phase 5), performance work (Phase 6), or clean-machine install verification (Phase 7).

**External gates:** None. Phase 2's MCE approval (already submitted) is the precondition for real MS-authenticated launch; Phase 3 execution waits on a valid MC access token from Phase 2's AuthManager, which requires MCE approval to be in.

</domain>

<decisions>
## Implementation Decisions

### Home / Settings layout

- **D-01: Settings surface is a slide-in right drawer** (Radix Sheet via shadcn), triggered by a gear icon. The Play-forward screen stays visible underneath; does not navigate away. Lunar-ish pattern.
- **D-02: Drawer dismiss = X button + ESC + click-outside** (all three gestures close it). Consistent with Radix Sheet defaults and matches the Phase 2 DeviceCodeModal ESC-aware ergonomics.
- **D-03: RAM slider lives in Settings only, not on Home.** The Home screen stays minimal; users open Settings to change allocation. Matches Lunar.
- **D-04: RAM slider range is 1-4 GB in 512 MB steps, default 2 GB.** Seven positions (1, 1.5, 2, 2.5, 3, 3.5, 4 GB). Cap 4 GB per ROADMAP SC2.
- **D-05: G1GC tooltip uses BOTH an always-visible one-line helper caption AND an info-icon with a Radix Tooltip on hover** for the longer explanation. The always-visible caption communicates the tradeoff to casual users; the tooltip holds the detailed text.
- **D-06: Game-directory override is hidden from the v0.1 UI.** The game data path is hardcoded; no picker, no read-only display, no "Open folder" button in v0.1 Settings. Deferred to later.
- **D-07: Launch logs and past-crash reports are reachable only via entries inside the Settings drawer.** No persistent "Logs" / "Crashes" chrome on the Home screen itself. Keeps the Play-forward screen clean.
- **D-08: Idle Home screen is strictly minimal.** Only: centered cyan Play button, account badge top-right, small `v0.1.0-dev` version text (bottom/corner), and a gear icon for Settings. No status strip, no changelog tease, no news card, no server teaser.

### Launch flow UX

- **D-09: On Play click, the cyan Play button morphs in-place into a status label** — it does not disappear, and no separate progress panel appears. Button content cycles through: `Downloading...` with percent → `Verifying...` → `Starting Minecraft...` → `Playing` (disabled). Minimal UI shift; the rest of the Home screen is untouched.
- **D-10: First-run progress shows phase label + percent only.** One label + one progress bar. No `MB / total MB` counter. No per-file scrolling list. Matches Lunar/Badlion's happy-path experience.
- **D-11: Launch log tail is hidden on the happy path; only surfaces on failure.** When a launch fails, the last N log lines (count TBD by planner, suggested ~30) surface alongside the error. Successful launches never show a log tail.
- **D-12: On "main menu reached", the launcher minimizes to the OS taskbar.** It does NOT close or hide to a tray icon; the window object stays alive because the launcher must babysit the JVM process to catch non-zero exits and show the crash viewer. If user re-opens the launcher while the game is alive, they see Home with Play disabled (state = "Playing").
- **D-13: Launch cancellation is available during Downloading and Verifying phases only.** Once the status reads `Starting Minecraft...` (JVM about to spawn or spawned), the cancel link disappears. Cancelling mid-download aborts in-flight fetches, leaves partial files on disk (they'll be overwritten / re-fetched on next Play click).
- **D-14: On network failure during download, auto-retry 3 times with backoff per failing file, then surface the error.** Backoff strategy is planner's discretion (suggested: 500ms / 2s / 5s). Surface message is a user-friendly `Can't reach Mojang — check your connection` + a Retry button that resumes the download (not a restart of already-completed files).
- **D-15: Cached-launch path (~10s, everything already verified) skips directly to `Starting Minecraft...`** The SHA1 re-verification still runs on every launch (SC5 requires this — corrupting a cached jar must cause re-download), but it runs invisibly unless a mismatch occurs. On mismatch, status reverts to `Downloading...` and the corrupted file is re-fetched.
- **D-16: Main-menu detection is via stdout log-line pattern match**, not a timer or JVM-alive heartbeat. The specific 1.8.9 line to match is researcher-picked (candidates: `Setting user: <name>`, `Sound engine started`, `OpenAL initialized`, or the `Stopping!...` inverse). Pattern must be documented in research and asserted by a test. Pattern match fires once → launcher minimizes.

### Crash viewer + redaction

- **D-17: Crash viewer triggers iff JVM exits with non-zero code AND a new file appears in `<game-dir>/crash-reports/`** within a short window (planner picks, suggested 5s post-exit). A zero-exit quit from the user closing Minecraft normally is silent — no viewer. This is the Mojang contract (they write to `crash-reports/` on crash; not on clean quit).
- **D-18: Crash viewer presentation = launcher restores from minimized and takes over the Home screen** with a full-page "Crash detected" view (title + short summary + scrollable redacted report body + actions). Not a modal, not an inline banner. Matches the severity.
- **D-19: Crash viewer actions are four buttons: `Copy report`, `Open crash folder`, `Close`, `Play again`.** Copy places the already-redacted report on the clipboard. Open crash folder reveals the `crash-reports/` directory in Explorer/Finder. Close returns to Home (viewer stays accessible via Settings → Crashes list). Play again re-runs the launch flow.
- **D-20: Redaction scope = JWTs + MC access token + OS username.** Specifically: (a) reuse Phase 2 `redact.ts` patterns for JWTs, `refresh_token`, `access_token` JSON shapes; (b) add a pattern for the raw MC access token value (Phase 2's `getMinecraftJavaToken()` return shape — the opaque string Minecraft sends with `--accessToken`); (c) add patterns for `C:\Users\<name>` (Windows), `/Users/<name>` (macOS), and `%USERNAME%` / `$USER` shell-expanded forms. UUIDs, IP addresses, and machine hostnames are NOT redacted in v0.1 (UUID is public; IPs/hostnames are rarely in 1.8.9 crash dumps; over-redaction hurts debuggability for the owner).
- **D-21: Redaction runs before BOTH the displayed text AND the clipboard contents.** Same sanitizer function drives both paths — not two separate code paths. The unit test must assert a crash report containing a known fake token has that token stripped in the component's rendered DOM AND in the value handed to `navigator.clipboard.writeText` (or Electron's `clipboard.writeText`). This is the literal requirement in SC3.

### Packaging + game data dir

- **D-22: macOS ships a single Universal DMG bundling both arm64 and x64 Temurin 8 JREs.** Larger installer (~140 MB JRE payload) but zero "which one do I download" friction — covers Apple Silicon and Intel Macs in one file. Rosetta is not the path (Lunar moved away from it; latency + anticheat-sensitive interactions).
- **D-23: Windows ships an NSIS installer only** — `Wiiwho Client Setup.exe`. Writes to `%LOCALAPPDATA%/Programs/Wiiwho/`, creates Start Menu shortcut, registers an uninstaller. No portable ZIP in v0.1. Matches Lunar's installer UX and REQUIREMENTS.md LAUN-01 baseline.
- **D-24: Game data lives at `%APPDATA%/Wiiwho/game/` (Windows) / `~/Library/Application Support/Wiiwho/game/` (macOS).** Nested directly under the existing Wiiwho data root established in Phase 2 (sibling to `auth.bin`). Subtree: `game/versions/1.8.9/`, `game/libraries/**`, `game/assets/{indexes,objects}/**`, `game/mods/`. One `Wiiwho/` dir to back up / wipe / reason about; no separate top-level `.wiiwho` or `.wiiwho-game`.
- **D-25: Temurin 8 JRE is bundled in the installer via electron-builder `extraResources`** — not downloaded on first launch. Offline installs work; installer size takes the JRE hit (~70 MB per arch on Windows, ~140 MB total on Universal Mac). This is the literal requirement in PKG-01/PKG-02 + Phase 3 SC4 ("both bundle the Eclipse Temurin 8 JRE"). Per-platform resource paths: `resources/jre/win-x64/`, `resources/jre/mac-arm64/`, `resources/jre/mac-x64/` inside the electron-builder output; runtime resolves via `app.getAppPath()` + arch detection.

### Claude's Discretion

The following were either explicitly deferred by the owner or never raised during discussion — researcher and planner have latitude:

- **SHA1-mismatch recovery UX details.** The contract is locked (corrupt cache → re-download, never silent-launch). Exact transition animation + status label wording when verification fails mid-sequence is Claude's call.
- **First-run welcome dialog.** Nothing decided. Probably no dedicated dialog for v0.1 (owner picked "Minimal — nothing else" for Home chrome); researcher may propose a one-time "Downloading ~60 MB on first Play" hint pinned under the Play button.
- **Installer display name wording.** Binary is `Wiiwho.exe` / `Wiiwho.app` per Phase 1 D-03, updated per project-wide `Wiiwho` capitalization. Installer title — `Wiiwho Client Setup` vs `Wiiwho Setup` — planner picks (recommend `Wiiwho Client Setup.exe` for Windows NSIS + `Wiiwho.dmg` for macOS).
- **Exact stdout pattern for main-menu detection.** Researcher picks from 1.8.9 startup log; must be deterministic and documented.
- **Progress bar aesthetic details** — determinate vs indeterminate segments (probably determinate during Downloading with known totals; indeterminate during Verifying for brief moments), speed-smoothing, phase-transition animation.
- **Settings drawer width + animation duration.** Default Radix Sheet is fine; Claude tunes if it feels wrong.
- **Uninstaller behavior on Windows.** NSIS auto-generates one; decision = does it wipe `%APPDATA%/Wiiwho/` (auth + settings + game data) by default, with a checkbox to keep, or keep by default with a checkbox to wipe? Claude picks the less-destructive default (keep, with checkbox offered).
- **Temurin 8 JRE source** — download from Adoptium CDN at `electron-builder` build time, or vendor pre-downloaded tarballs into `launcher/resources/jre/` in the repo. Researcher/planner picks based on reproducibility and CI friction.
- **Launcher log retention** — where electron-log writes, rotation size, max files. Defaults are fine; planner tunes.
- **p-queue download concurrency** — stay at 8 per STACK.md recommendation unless a concrete reason surfaces.
- **`@xmcl/core` vs `@xmcl/installer` feature split** — researcher maps which library does what (manifest fetch, library resolution, asset index, natives extraction, classpath build, JVM arg construction) and which parts we still write ourselves.
- **Crash viewer color scheme** — reuse `ErrorBanner` red-ish badge for the "Crash detected" header + neutral scrollable body. Planner tunes.
- **Reconnect-on-launcher-reopen-while-game-running** — if user closes the launcher window while MC is alive (launcher was just minimized, they quit it via OS), re-opening the launcher in that window should either (a) detect the running JVM via a lockfile and show "Playing" state, or (b) assume no game is running (simpler). Claude picks; recommend (b) for v0.1 since owner is the primary user.
- **Mac unsigned-installer right-click-Open workaround doc.** PKG-02 accepts unsigned + documented workaround. Documented where — inline in the DMG background, a `README-macOS.txt` inside the DMG, or a docs/ link? Planner picks.

### Folded Todos

None — no pending backlog todos matched Phase 3 scope at discuss-phase time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context

- `.planning/PROJECT.md` — vision, locked stack (Electron + Temurin 8 + electron-builder), constraints (Windows + macOS v0.1; no auto-update; no signing), non-goals (no redistribution of Minecraft assets)
- `.planning/REQUIREMENTS.md` §Launcher, §Launch Flow, §JRE Bundling, §Packaging — the 15 Phase 3 requirements: LCH-01, LCH-02, LCH-03, LCH-05, LCH-06, LCH-07, JRE-01, JRE-02, JRE-03, PKG-01, PKG-02, LAUN-03, LAUN-04, LAUN-05, COMP-05
- `.planning/ROADMAP.md` §Phase 3 — goal, 5 success criteria (click-to-main-menu timing, RAM slider persist, crash viewer redaction, installers bundling JRE + mod jar, SHA1 verification)

### Prior phase context (carry forward — do not re-decide)

- `.planning/phases/01-foundations/01-CONTEXT.md` — D-03 (binary names `Wiiwho.exe` / `Wiiwho.app`, project-wide `Wiiwho` capitalization), D-05/D-06/D-07 (repo layout + shared `assets/`), D-08/D-09 (dark + cyan `#16e0ee`), D-10/D-11/D-12 (1000x650 fixed, Play-forward layout, OS-native sans), D-25 (Mojang asset policy: launcher downloads at runtime, never redistributes)
- `.planning/phases/02-microsoft-authentication/02-CONTEXT.md` — D-13 (account badge top-right, dropdown convention), D-16/D-17 (data-dir root `%APPDATA%/Wiiwho/` / `~/Library/Application Support/Wiiwho/`, nothing sensitive outside `auth.bin`), Claude's Discretion on background token refresh (Phase 3 Play-click must handle a stale-token refresh-or-fail path)
- `docs/mojang-asset-policy.md` — runtime-download-only policy; Phase 3 launch code enforces this literally (nothing from Mojang ships in our installer)
- `docs/ANTICHEAT-SAFETY.md` — Phase 3 does not add in-game code; confirm at merge that nothing in Phase 3 touches the mod jar classpath

### Research (from .planning/research/)

- `.planning/research/STACK.md` §Core Technologies — Game launch infrastructure — `@xmcl/core` + `@xmcl/installer` (manifest parsing, library download with SHA1, classpath assembly, JVM arg construction), Eclipse Temurin 8 JRE sourcing
- `.planning/research/STACK.md` §Supporting Libraries — Launcher — `electron-log` 5.x (already installed, extend for launch-process logging), `execa` 9.x (JVM spawn with streaming stdout/stderr), native `fetch` vs `got`, `p-queue` 8.x (download concurrency 8), `electron-builder` 26.x (NSIS + DMG + `extraResources`)
- `.planning/research/STACK.md` §What NOT to Use — `child_process.exec` is banned (~200 KB stdout buffer truncation loses crash logs); `execa` or `child_process.spawn` with streaming only
- `.planning/research/ARCHITECTURE.md` §System Overview + §Component Responsibilities + §Recommended Project Structure — two-process model (launcher ↔ JVM), launcher/src/main/launch/ pipeline (`manifest → libraries → assets → natives → args → spawn`), `resources/jre/<platform>/` packaging layout
- `.planning/research/ARCHITECTURE.md` §Pattern 1: Two-process, one-way IPC — JVM receives `-D` system props and command-line args downward; launcher reads stdout/stderr upward. No socket, no named pipe, no RPC in v0.1.
- `.planning/research/PITFALLS.md` §Pitfall 3 — Mojang EULA redistribution ban; Phase 3 enforces (every download comes from Mojang's manifest URL at runtime, never bundled in our installer). Relevant to code review of manifest-fetch code.
- `.planning/research/PITFALLS.md` — launcher-process pitfalls (stdout truncation, Windows path quoting when spawning JVM — execa handles; Windows admin-rights install paths; macOS Gatekeeper on unsigned DMG)

### Existing launcher code (Phase 1 + 2 scaffold)

- `launcher/src/main/index.ts` — app bootstrap; Phase 2's `installRedactor()` + `getAuthManager().trySilentRefresh()` pattern already in place. Phase 3 adds launch-flow initialization here.
- `launcher/src/main/ipc/game.ts` — **stub handlers** for `game:play`, `game:cancel`, `game:status`, and the `game:progress` / `game:log` / `game:exited` / `game:crashed` push events. Phase 3 fills handler bodies. IPC surface is frozen per Phase 1 D-11 — do NOT add new top-level keys or channels.
- `launcher/src/main/ipc/settings.ts` — **stub handlers** for `settings:get` / `settings:set`. Phase 3 fills handler bodies + backs them with a JSON file at `%APPDATA%/Wiiwho/settings.json` (plain JSON, NOT safeStorage — settings are not sensitive).
- `launcher/src/main/auth/AuthManager.ts` — Phase 3 calls `AuthManager.getMinecraftToken()` (or equivalent) to obtain the fresh MC access token right before JVM spawn. Planner maps the exact AuthManager method from Phase 2 code.
- `launcher/src/main/auth/redact.ts` — **extend in Phase 3** for the MC access token pattern + Windows/macOS username patterns per D-20. Keep idempotency + the single `installRedactor()` entrypoint Phase 2 established.
- `launcher/src/main/auth/safeStorageCache.ts` — reference pattern for atomic-write file I/O under `userData`. The new `settings.json` file uses a non-encrypted parallel (plain `fs.writeFile` to temp + rename), NOT this encrypted pattern.
- `launcher/src/main/ipc/security.ts` — `setAuditedPrefs` / `__security:audit` pattern; Phase 3 inherits, does not add to it.
- `launcher/src/renderer/src/wiiwho.d.ts` — IPC type surface; Phase 3 fills `WiiWhoAPI.game`, `WiiWhoAPI.settings`, and `WiiWhoAPI.logs` as already typed. Any type drift requires main + preload + renderer coordination.
- `launcher/src/renderer/src/App.tsx` — existing state-driven routing (Phase 2: Login/Loading/Playforward). Phase 3 extends the Playforward branch with: drawer overlay, crash-viewer takeover state.
- `launcher/src/renderer/src/stores/` — Phase 2 established `useAuthStore` (Zustand). Phase 3 adds `useSettingsStore` (RAM setting + first-run hint state) and `useGameStore` (current launch phase + progress + logs-for-failure + crash-report-ready flag).
- `launcher/src/renderer/src/components/` — reuse button.tsx, ErrorBanner.tsx, existing cyan-styled primitives. Add: `SettingsDrawer.tsx`, `RamSlider.tsx`, `CrashViewer.tsx`, `PlayButton.tsx` (the Play-button-that-morphs).
- `launcher/package.json` — already installed: `@azure/msal-node`, `prismarine-auth`, `electron-log`, `radix-ui` (unified), `zustand`, `tailwind`, `vitest`, `electron-builder`. Phase 3 adds: `@xmcl/core`, `@xmcl/installer`, `execa`, `p-queue`. shadcn components to add: Sheet (drawer), Slider, Tooltip.

### External specs + docs (planner / researcher reads directly)

- Mojang `version_manifest_v2.json` — https://piston-meta.mojang.com/mc/game/version_manifest_v2.json — source of 1.8.9 client.json URL + SHA1
- Minecraft launcher file format (client.json schema, asset index schema) — https://minecraft.wiki/w/Client.json
- wiki.vg Game Launch — https://wiki.vg/Launcher (classpath + args format for 1.8.9)
- `@xmcl/core` + `@xmcl/installer` docs — https://voxelum.github.io/minecraft-launcher-core-node/ (manifest, library, asset, natives, launch-arg APIs)
- `@xmcl/core` source — https://github.com/Voxelum/minecraft-launcher-core-node
- Eclipse Temurin 8 JRE download — https://adoptium.net/temurin/releases/?version=8 (per-arch: windows-x64-jre, mac-x64-jre, mac-aarch64-jre)
- `electron-builder` config — https://www.electron.build/configuration/configuration
- `electron-builder` `extraResources` / `extraFiles` — https://www.electron.build/generated/platformspecificbuildoptions
- `electron-builder` NSIS target — https://www.electron.build/configuration/nsis
- `electron-builder` DMG target — https://www.electron.build/configuration/dmg
- `electron-builder` macOS Universal build — https://www.electron.build/configuration/mac (`target: { target: 'dmg', arch: 'universal' }`)
- Electron `app.getPath` / `app.getAppPath` — https://www.electronjs.org/docs/latest/api/app
- Electron `shell.showItemInFolder` — https://www.electronjs.org/docs/latest/api/shell (for "Open crash folder")
- Electron `clipboard.writeText` — https://www.electronjs.org/docs/latest/api/clipboard (the sink that must receive pre-redacted text per D-21)
- `execa` README — https://github.com/sindresorhus/execa (streaming + Windows path quoting + abort signal for the Cancel in Downloading phase)
- `p-queue` README — https://github.com/sindresorhus/p-queue (concurrency for parallel library downloads)
- macOS right-click-Open workaround for unsigned apps — https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac (referenced by the DMG docs)

### Anticheat (carry from Phase 1, even for an out-of-game phase)

- `docs/ANTICHEAT-SAFETY.md` — no Phase 3 rows expected (no in-game feature code); confirm at merge that nothing in Phase 3 touches the mod jar's classpath or loaded classes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **IPC plumbing** (`launcher/src/preload/index.ts`) — `contextBridge.exposeInMainWorld('wiiwho', { auth, game, settings, logs, __debug })` already exposes the Phase 3 surface. `game.play()`, `game.cancel()`, `game.status()` + `game:progress` / `game:log` / `game:exited` / `game:crashed` subscriptions, and `settings.get()` / `settings.set()` all wired — Phase 3 fills the main-process handler bodies only.
- **Redactor** (`launcher/src/main/auth/redact.ts`) — single source of truth for log scrubbing; Phase 3 extends the pattern list per D-20 and adds the crash-viewer sanitizer as a same-module export so the clipboard path uses the identical function (D-21).
- **shadcn Button** (`launcher/src/renderer/src/components/ui/button.tsx`) — reuse for the morphing Play button + Copy/Open folder/Close/Play again + Retry + Cancel link.
- **Cyan accent + Tailwind tokens** — Phase 1's `bg-[#16e0ee]` / `hover:bg-[#14c9d6]` / `text-neutral-950` button idiom reused for the Play-button-that-morphs; ErrorBanner red-ish carries to the crash-viewer header.
- **Zustand pattern** — Phase 2's `useAuthStore` with a discriminated-union state (`loading | logged-out | logging-in | logged-in | error`) is the template for `useGameStore` (`idle | downloading | verifying | starting | playing | failed | crashed`).
- **Radix primitives (unified)** — already installed; Phase 3 adds `Sheet` (drawer), `Slider` (RAM), `Tooltip` (G1GC info). Re-use the Phase 2 Radix-in-jsdom test pattern (structural pointer-capture stubs + `userEvent.setup()`).
- **vitest dual-env** — Phase 2 locked `@vitest-environment jsdom` docblock per renderer test + `afterEach(cleanup)` per describe block; Phase 3 renderer tests follow the same pattern.
- **electron-log hook + safeStorage** — Phase 2's `installRedactor()` idempotent bootstrap stays; Phase 3 does not install a second log pipeline. Settings I/O uses plain JSON (not safeStorage) — path helpers from `paths.ts` (to be added) build on `app.getPath('userData')`.

### Established patterns

- **One-way IPC** — main → renderer for push events (`game:progress`, `game:log`, `game:exited`, `game:crashed` echoing the Phase 2 `auth:device-code` push pattern). Renderer never exposes internal state back to main except via `invoke` handlers.
- **Security invariant** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, runtime-audited via `__security:audit`. Phase 3 must not regress; JVM spawn runs in the main process only, never touched from the renderer.
- **Single source of truth for IPC types** — `wiiwho.d.ts`. Type changes require all three (main + preload + renderer) touching.
- **Co-located vitest `.test.ts`** — every new module gets a sibling test file (e.g., `launch/manifest.ts` → `launch/manifest.test.ts`).
- **No native modules / node-gyp** — Phase 1/2 banned `keytar` etc. by absence. Phase 3 sticks to pure-JS deps (`@xmcl/core`, `execa`, `p-queue` are all pure JS) + Electron-built-in `safeStorage`.
- **Frozen IPC surface** — 5 top-level preload keys (auth, game, settings, logs, __debug). Phase 3 does NOT add new keys or channels; it fills stubs in place.

### Integration points

- **`launcher/src/main/launch/` (new directory)** — mirror the research ARCHITECTURE.md pipeline: `manifest.ts`, `libraries.ts`, `assets.ts`, `natives.ts`, `args.ts`, `spawn.ts`. Each step independently testable against a fake data dir.
- **`launcher/src/main/monitor/` (new directory)** — `logParser.ts` (line-based stdout/stderr parser emitting `game:log` + the main-menu-reached pattern-match event), `crashReport.ts` (polls or watches `<game-dir>/crash-reports/` after non-zero exit per D-17).
- **`launcher/src/main/settings/` (new directory or single file)** — JSON-backed settings persistence with schema version. Plain `fs.writeFile` to `%APPDATA%/Wiiwho/settings.json` via atomic temp-rename.
- **`launcher/src/main/paths.ts` (new file)** — single source for all platform paths: data-dir root (inherits from Phase 2's userData convention), game-dir (`<data-dir>/game`), jre path (`app.getAppPath()/resources/jre/<platform-arch>/bin/java[.exe]`), settings path, crash-reports path. Phase 2's auth.bin path helper already encoded this; extract or re-use.
- **`launcher/src/main/ipc/game.ts`** — fill the 3 `invoke` handler bodies (`game:play`, `game:cancel`, `game:status`) + add 4 push emitters. Play handler orchestrates: read RAM from settings → call AuthManager.getMinecraftToken() → launch pipeline → spawn JVM → wire stdout listener.
- **`launcher/src/main/ipc/settings.ts`** — fill `settings:get` / `settings:set` bodies. Schema: `{ version: 1, ramMb: number, firstRunSeen: boolean }`. Planner validates schema on read + migrates `version: 1` additions forward.
- **`launcher/src/main/ipc/logs.ts` (new file, per existing IPC convention)** — fill the `logs:*` stubs for listing past crash reports + reading the active log tail. Path-filtered to `<game-dir>/crash-reports/` and electron-log's own log path; never arbitrary file reads.
- **`launcher/src/renderer/src/stores/game.ts` + `stores/settings.ts` (new)** — Zustand, mirroring Phase 2's `stores/auth.ts` pattern. Discriminated-union phase state for `useGameStore`.
- **`launcher/src/renderer/src/components/SettingsDrawer.tsx` (new)** — Radix Sheet wrapping a settings body (RamSlider + "Logs" + "Crashes" + "About") + Version footer. Opens from a gear icon added to Home.
- **`launcher/src/renderer/src/components/RamSlider.tsx` (new)** — Radix Slider, 1024-4096 MB in 512 MB steps, always-visible caption + info-icon Tooltip per D-05.
- **`launcher/src/renderer/src/components/CrashViewer.tsx` (new)** — full-screen takeover, subscribes to `game:crashed`. Renders redacted report in a `<pre>` + four action buttons. Clipboard write pipes through the identical sanitizer function imported from main-side OR a renderer-side mirror fed the already-redacted text.
- **`launcher/src/renderer/src/components/PlayButton.tsx` (new)** — the button-that-morphs; reads `useGameStore` state + subscribes to `game:progress` for the percent display.
- **`launcher/src/renderer/src/App.tsx`** — add a branch for `state === 'crashed'` to render `CrashViewer`; render `SettingsDrawer` as an overlay that sits on top of any non-crashed state.
- **`launcher/electron-builder.yml` or `package.json "build"`** — Phase 3 writes the full packaging config: NSIS target for win, Universal DMG for mac, `extraResources` for `resources/jre/<platform-arch>/` + `resources/mod/wiiwho-*.jar`.
- **`launcher/resources/` (new)** — `jre/win-x64/`, `jre/mac-arm64/`, `jre/mac-x64/`, `mod/wiiwho-0.1.0.jar` (built by `client-mod/` and copied in by a prebuild script). Gitignored; populated by a repo-level build script at release time.
- **`client-mod/build.gradle.kts`** — Phase 3 may need a `./gradlew build` that produces the releasable jar that the installer bundles (currently Phase 4 per REQUIREMENTS MOD-05, but SC4 requires the jar in the v0.1 installer). Coordinate: Phase 3 planner may need a minimal `./gradlew build` wiring so the mod jar exists to be bundled, even if Phase 4 is the one that makes the launcher inject it. Confirm during research.

</code_context>

<specifics>
## Specific Ideas

- **Settings = slide-in drawer from the right.** Lunar/Badlion-ish pattern — gear icon + Radix Sheet. Owner explicitly rejected a dedicated /settings page and an inline bottom strip.
- **Home chrome stays strictly minimal.** No status strip, no news card, no changelog tease. Play-forward means the Play button is the only thing competing for attention.
- **Play button morphs in place on click.** Owner explicitly rejected a full-screen takeover and a separate progress panel. The cyan button stays where it is and its label + fill cycle through the launch phases.
- **Happy path is silent.** No log tail visible during a successful launch. Log tail only appears when a launch fails — "don't show me stuff I don't need."
- **Crash viewer is a takeover, not a banner or modal.** Launcher un-minimizes + replaces the Home screen entirely. Owner wanted crashes to get attention proportional to their severity.
- **Clipboard copy of a crash report uses the same sanitizer as the display.** Not two redaction paths; one function drives both. This is a testability decision as much as a correctness one — SC3 explicitly calls out "before display *and* before copy-to-clipboard."
- **macOS Universal DMG (one file, both arches).** Owner picked the widest-reach option; Intel-Mac small-group members are in scope for v0.1.
- **Game data nested under `Wiiwho/`, not a separate `.wiiwho-game/` root.** Single directory to back up, wipe, or reason about — same philosophy that drove Phase 2's decision to keep auth.bin at the Wiiwho data root.
- **Mojang download contract is enforced by this phase's code.** Nothing Mojang-owned ships in our installer (per `docs/mojang-asset-policy.md`); every library/asset/jar comes from the runtime manifest fetch.
- **JRE bundled in installer, not downloaded on first run.** SC4 literally requires this; any ambition to slim the installer must fight SC4 first.

</specifics>

<deferred>
## Deferred Ideas

Ideas that came up during discussion or are logical spillovers — captured so nothing is lost.

### Deferred to v0.2+

- **Game-directory override UI** — users who want a non-default location (e.g. external SSD) must wait past v0.1. Add when someone actually asks.
- **Per-file download list view** — Lunar-dev-mode-style scrolling fetched-file list — rejected for v0.1 in favor of phase + percent.
- **Always-visible launch log tail** — rejected for v0.1 happy path; log tail only appears on failure. Revisit if users ask.
- **`Report bug` button on the crash viewer** — deferred; small-group distribution means owner debugs directly. Revisit on public release (needs GitHub issue template + prefill).
- **Over-redaction (UUID, IP, hostname) in crash dumps** — rejected for v0.1; UUID is public, IPs/hostnames rarely appear. Revisit if crash reports ever get shared externally.
- **Changelog tease / news card / server teaser on Home** — rejected for v0.1 (minimal Home). Probably a v0.3+ "Discovery" concept if we ever add it.
- **Status strip on Home** (`Ready • 1.8.9 • 2 GB`) — rejected; owner wanted minimal.
- **Portable Windows ZIP** — rejected for v0.1 alongside NSIS; revisit only if an actual user refuses installers.
- **Cancel-during-JVM-spawn** — rejected; once "Starting Minecraft…" begins, there is no cancel. Too narrow a window to be useful; risk of partial-launch state.
- **Auto-retry during Starting-Minecraft phase** — not a feature; retries only apply to download. A JVM-spawn failure is surfaced immediately.
- **First-run welcome dialog** — held under Claude's Discretion; owner preferred no dedicated dialog, so likely a small pinned hint under Play on fresh install.
- **Reconnect-on-reopen-while-game-alive** — held under Claude's Discretion; v0.1 likely does NOT re-detect a running JVM across launcher restarts.
- **Separate arm64 / x64 macOS installers** — rejected in favor of a single Universal DMG.

### Out-of-scope reminders (non-negotiable for v0.1)

- **Auto-updater (`electron-updater`)** — explicitly out of v0.1 per REQUIREMENTS.md Out of Scope.
- **Signed Windows installer (EV cert) + macOS notarization** — explicitly out of v0.1.
- **Crash uploader / telemetry** — explicitly out of v0.1; crash reports stay local.
- **Linux packaging** — explicitly out of v0.1 (Windows + macOS only).
- **Server browser / server list** — deferred to v0.4+.
- **Multi-instance / instance profiles** — explicitly out of v0.1.
- **Redistribution of Minecraft jars or assets** — project-wide non-goal (EULA). Phase 3 enforces this in launch code.
- **Cracked-account support** — project-wide non-goal.
- **Rosetta-only macOS** — rejected; Universal DMG bundles native arm64 + x64 JREs.

### Reviewed Todos (not folded)

None — no backlog todos existed at discuss-phase time.

### Scope-creep redirects

None — discussion stayed within Phase 3's boundary (launch loop + JRE + installers + RAM + crash viewer). Forge integration was consistently parked for Phase 4.

</deferred>

---

*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Context gathered: 2026-04-21*
