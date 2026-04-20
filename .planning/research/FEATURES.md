# Feature Research — WiiWho Client

**Domain:** Custom Minecraft 1.8.9 client (Lunar/Badlion-class) — launcher + QoL mod bundle for PvP players
**Researched:** 2026-04-20
**Confidence:** HIGH for in-scope feature taxonomy and anticheat posture; MEDIUM for precise per-feature detection behavior (anticheat rules change without public changelogs).

---

## Competitor Landscape (summary)

| Client | Stack | Positioning | Notable |
|--------|-------|-------------|---------|
| **Lunar Client** | Electron launcher + closed-source injected mod (Forge-derived) | Mass-market PvP + cosmetics | 65+ built-in mods, paid cosmetics shop, Mumble proximity chat, server mappings, blocks 3rd-party Forge mods |
| **Badlion Client (BLC)** | Electron launcher + in-house mod loader | Competitive PvP, optifine-compat focus | 100+ mods, cosmetics incl. emotes/wings, mod profiles, Friends system, free tier |
| **SkyClient** | Forge 1.8.9 mod collection + installer | Hypixel SkyBlock players | Curated 1.8.9 mod bundle; **sunset Feb 2026** when Hypixel dropped 1.8 SkyBlock |
| **Patcher (Sk1er)** | Open-source Forge 1.8.9 mod | Perf + QoL standalone | Sk1er LLC; HUD caching, FOV modifier, bug fixes — golden reference for anticheat-safe 1.8.9 work |
| **Feather Client** | Forge-based launcher + mod bundle | Lunar alternative, smaller footprint | Built-in voice chat, ~40 mods; mixed reputation for perf |
| **CCMI / Essential** | Forge/Fabric companion mod | Social + cosmetics add-on | Friends, party, shared cosmetics across versions |

**Sources:** [Lunar Features](https://www.lunarclient.com/features), [Badlion Mods](https://www.badlion.net/wiki/badlion-client-mods), [SkyClient](https://skyclient.co/), [Patcher](https://sk1er.club/mods/patcher), [Feather](https://feathermc.com/)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Users opening a "Lunar alternative" assume these exist. Missing them = product feels unfinished or not worth switching from Lunar/Badlion.

| Feature | Why Expected | Complexity | Anticheat Posture (Hypixel / BlocksMC) | Clients Offering | Notes |
|---------|--------------|------------|----------------------------------------|------------------|-------|
| **Microsoft OAuth login (persisted)** | Mojang auth is dead; users expect log-in-once | MEDIUM | N/A (pre-game) | All | MSAL device code flow; store refresh token in OS keychain |
| **One-click launch flow** | Core selling point of a "client" vs raw jar | MEDIUM | N/A | All | Download vanilla jar → verify → inject mod → spawn JVM |
| **Bundled Java runtime** | Zero-friction install; Lunar/Badlion both bundle | LOW-MEDIUM | N/A | Lunar, Badlion, Feather | ~60-100MB install; package Temurin/Zulu Java 8 |
| **RAM allocation slider** | Every launcher has it; users know to bump RAM for MC | LOW | N/A | All | Just `-Xmx`/`-Xms` JVM arg |
| **FPS counter HUD** | Literal baseline. First thing PvP players install. | LOW | Safe everywhere | All | Render-only; anticheat has no signal |
| **Keystrokes HUD (WASD + mouse)** | Streaming/PvP staple; used by nearly every competitive player | LOW | Safe everywhere | All | Hooks keyboard/mouse input, renders overlay; no packet impact |
| **CPS counter** | Clicks-per-second — core PvP telemetry | LOW | Safe everywhere | All | Count `MouseEvent` frames; render overlay |
| **Crash log viewer / crash recovery** | Forge 1.8.9 crashes often; users need readable diagnostics | MEDIUM | N/A | Lunar, Badlion, Patcher (CrashPatch) | Surface stack trace + "relaunch" button |
| **FPS optimization (general)** | Entire reason to pick a client over vanilla — users expect 1.5-2x vanilla FPS | HIGH | Safe if render-only | All | See STACK.md/ARCHITECTURE.md for approach; Optifine compat is the bar |
| **Fullbright / gamma boost** | Vanilla dark-cave QoL; Optifine provides it, users moved to clients for it | LOW | Safe everywhere (NOT xray) | Lunar, Badlion, Patcher | Clamp min brightness; must NOT reveal hidden blocks (that's xray — banned) |
| **Zoom (scroll-adjustable)** | Optifine trained everyone to expect a zoom keybind | LOW | **Explicitly allowed on Hypixel** | Lunar, Badlion, Optifine, Feather | Modify `Minecraft.getMinecraft().gameSettings.fovSetting` while key held |
| **Scoreboard customization (hide numbers, reposition, recolor)** | Hypixel/BLC scoreboards are information-dense; players want control | LOW | Safe — purely cosmetic | Lunar, Badlion, Patcher | Intercept `GuiIngame.renderScoreboard`; render custom |
| **Custom crosshair** | Major personalization + tiny PvP aim help | LOW | Safe — cosmetic overlay | Lunar, Badlion, Feather | Render over vanilla crosshair; color/shape/size |
| **Chat customization (readable chat, copy chat, chat search)** | Vanilla 1.8.9 chat is awful | LOW | Safe | Lunar, Badlion, SkyClient (BetterChat) | Hook chat rendering; add scroll/copy |
| **Toggle sprint / toggle sneak** | Carpal-tunnel QoL; been standard since 1.7 | LOW | **Allowed on Hypixel** | All | Intercept key state; not a macro per Hypixel rules |
| **FOV changer (beyond vanilla 30-110 cap)** | PvP players want 110-120+ FOV for awareness | LOW | Safe | Lunar, Badlion, Patcher | Extend slider; Patcher already does this |
| **Cosmetics pipeline (at least capes)** | Lunar's entire monetization; users associate "client" with "custom cape" | MEDIUM | Safe (Lunar/Badlion ship them on Hypixel) | Lunar, Badlion, CCMI, Feather | **v0.1 already includes placeholder cape** |
| **Mac support** | ~15-20% of target audience is on Mac (especially YouTubers/streamers) | MEDIUM | N/A | Lunar, Badlion, Feather | electron-builder handles it; Java 8 on Apple Silicon needs x86 JRE + Rosetta OR Zulu arm64 |

### Differentiators (Competitive Advantage)

Where clients actually compete. WiiWho should pick 1-2 here for v0.1/v0.2 to stand out.

| Feature | Value Proposition | Complexity | Anticheat Posture | Clients Offering | Notes |
|---------|-------------------|------------|-------------------|------------------|-------|
| **Measurably-beats-Optifine performance** | Headline-grade claim; hard to fake if honest benchmarks published | VERY HIGH | Safe (rendering-only) | Lunar claims it; Patcher + Optifine stack is the real reference | **Already a v0.1 goal.** Reference scene + hardware profile required for "beats X" to mean anything. |
| **Open-source / auditable client** | Most competitors are closed (Lunar, Badlion, Feather). Patcher is open. Auditability = trust = anticheat-servers more willing to tolerate | LOW (it's a decision, not code) | N/A | Patcher, PolyPatcher, Essential | Licensing decision is deferred in PROJECT.md; this is the lever |
| **Honest free tier (no dark patterns)** | Lunar pushes cosmetics hard; Badlion has ads + Plus tier. "Everything free including cosmetics" is a marketing wedge | LOW-MEDIUM | N/A | None perfectly; Patcher is free but no cosmetics | Aligns with personal/small-group scope |
| **Mod profiles / per-server HUD config** | Badlion has this; Lunar doesn't cleanly. Different HUD layouts for Bedwars vs SkyWars vs SkyBlock | MEDIUM | Safe | Badlion | Store config set keyed to server IP |
| **Built-in proximity voice chat** | Lunar requires external Mumble; Feather has SVC built-in but shaky. Integrated voice in 1.8.9 for small-group play is a real wedge for WiiWho's small-group use case | HIGH | Safe if opt-in and non-packet-modifying of Minecraft protocol | Feather (built-in), Lunar (Mumble link) | Matches PROJECT.md "personal + small-group" framing. But high complexity — likely v0.3+ |
| **Friends / party system (client-side)** | Badlion, Essential, Lunar all have some form. Enables "show online friends across servers" | HIGH | Safe | Lunar (limited), Badlion, Essential | Requires backend service; PROJECT.md defers backend. v0.3+ |
| **Discord Rich Presence integration** | Shows "playing on Hypixel Bedwars" to Discord friends. Cheap polish. | LOW | Safe (read-only, outbound) | Lunar, Badlion, Essential | `DiscordRPC` JNA bindings; 1-2 days |
| **Replay mod / clip recorder** | Content creators value this; Replay Mod for 1.8.9 exists but isn't integrated into clients | HIGH | Safe | None integrated (Replay Mod standalone) | Huge differentiator for streamers; v0.4+ |
| **Auto-screenshot uploader** | Badlion has Screenshot Uploader. QoL for content creators. | MEDIUM | Safe | Badlion | Needs image host backend. v0.2+ if backend stood up |
| **Faster launch time than Lunar** | Lunar's launcher is notoriously slow to cold-start (Electron + update checks + cosmetics sync). If WiiWho cold-starts in <3s it's a genuine pitch. | MEDIUM | N/A | Patcher (no launcher); everyone else is slow | Skip background sync in v0.1; lazy-load everything |

### Confirmed in v0.1 (from locked PROJECT.md scope)

Per `.planning/PROJECT.md`, these are already in scope for v0.1 and are referenced above under the appropriate category.

- [x] Electron + TS + React launcher (table stakes)
- [x] Microsoft OAuth with persisted account (table stakes)
- [x] One-click launch flow with vanilla jar download/verify + mod injection (table stakes)
- [x] Bundled Java 8 JRE — Windows + macOS (table stakes)
- [x] RAM allocation slider (table stakes)
- [x] Crash log viewer (table stakes)
- [x] Forge 1.8.9 mod scaffold with Mixin
- [x] FPS counter HUD (table stakes)
- [x] Keystrokes HUD (table stakes)
- [x] CPS counter HUD (table stakes)
- [x] FPS optimization (beats Optifine on reference benchmark) (differentiator)
- [x] Placeholder cape cosmetic (proves pipeline — table stakes for "feels like a real client")
- [x] Windows + macOS packaging via electron-builder (table stakes)
- [x] Anticheat-safe on Hypixel + BlocksMC (hard constraint)

### Candidates for v0.2+ (Deferred but Tracked)

High-signal additions. Ordered by rough value-per-complexity for a Lunar-alternative targeting PvP players.

| Feature | Rationale | Complexity | Anticheat | Priority Hint |
|---------|-----------|------------|-----------|---------------|
| **Armor HUD** | Listed in PROJECT.md deferred. Table stakes for PvP. | LOW | Safe | P1 for v0.2 |
| **Potion Effects HUD** | Table stakes for PvP (pots matter in SkyWars, duels, UHC). | LOW | Safe | P1 for v0.2 |
| **Coordinates overlay** | Table stakes for SkyBlock/survival. | LOW | Safe (client-side display only) | P1 for v0.2 |
| **Custom scoreboard (full)** | Listed above as table stakes; full Hypixel-aware version deferrable | MEDIUM | Safe | P1 for v0.2 |
| **Zoom mod (Optifine-style)** | Explicitly allowed on Hypixel; trivial to implement | LOW | Safe | P1 for v0.2 |
| **Toggle sprint / sneak** | Trivial, QoL-critical | LOW | Safe | P1 for v0.2 |
| **Custom crosshair** | Small code, high personalization | LOW | Safe | P1 for v0.2 |
| **Fullbright (gamma clamp, NOT xray)** | Users expect it; trivial | LOW | Safe | P1 for v0.2 |
| **FOV slider extension (110-120+)** | Patcher-style, trivial | LOW | Safe | P1 for v0.2 |
| **Motion blur toggle** | Visual polish; Lunar/Badlion offer it | LOW | Safe | P2 for v0.2 |
| **1.7 animations for 1.8 (Old Animations)** | Many 1.8 PvPers prefer 1.7 block-hit animation; emblematic Lunar/Badlion mod | MEDIUM | Safe (client rendering only) | P2 for v0.2 |
| **Discord Rich Presence** | Cheap polish; differentiator on free tier | LOW | Safe | P2 for v0.2 |
| **Chat improvements (search, copy, scroll)** | QoL; Patcher/BetterChat reference | LOW | Safe | P2 for v0.2 |
| **AutoGG** | Community-loved; technically "use at own risk" on Hypixel but universally tolerated | LOW | USE-AT-OWN-RISK on Hypixel (never actually enforced) | P2 for v0.2 — but label clearly as "optional" |
| **Mod profiles / per-server HUD config** | Differentiator; Badlion-style | MEDIUM | Safe | P2 for v0.3 |
| **Block outline customization** | Polish | LOW | Safe | P3 |
| **Real cosmetics catalogue (multiple capes, hats, wings)** | Monetization path if project ever goes public; deferred in PROJECT.md pending backend decision | HIGH (needs backend + artist assets) | Safe (Lunar/Badlion do it) | P2 for v0.3 |
| **Cosmetics backend service** | Prereq for multi-cosmetic catalogue + per-user ownership | HIGH | N/A | P2 for v0.3 |
| **Server browser / server list integration** | Deferred in PROJECT.md; Lunar-style "Lunar Network" or Minecraft Best Servers partnership | HIGH | Safe | P3 for v0.3+ |
| **Server mappings (partner-configured scoreboards, minigame detection)** | Lunar's Server Mappings pattern — servers opt-in to richer integration | HIGH | Safe | P3 for v0.3+ |
| **Auto-updater + code signing** | Deferred in PROJECT.md; needed if WiiWho ever goes beyond small-group | MEDIUM | N/A | P3 when distribution scales |
| **Linux packaging** | Explicitly deferred in PROJECT.md | LOW (electron-builder) | N/A | P3 on request |
| **Replay Mod integration** | Content-creator differentiator | HIGH | Safe | P3 for v0.4 |
| **Screenshot uploader** | Badlion feature; content creator QoL | MEDIUM (needs image host) | Safe | P3 |
| **Proximity voice chat (Mumble link or SVC)** | Lunar has Mumble link; Feather built-in. Fits WiiWho small-group use case but very high complexity | HIGH | Safe | P3 for v0.3+ |
| **LevelHead (shows player level/stats above head on Hypixel)** | Hypixel-specific; Badlion/Sk1er have it | MEDIUM | Safe on Hypixel (uses public API, not packet intercept) | P3 |
| **Better tab list (FPS/ping columns)** | Power-user polish | LOW | Safe | P3 |
| **Screen-recorder / clip hotkey** | Streamer QoL; distinct from Replay Mod | MEDIUM | Safe | P3 |

### Anti-Features (Do NOT Build)

Features that **look** reasonable but are either actively anticheat-hostile, ethically bad, or misaligned with the project's identity. PROJECT.md already non-goals several; this table is the full research-backed list with rationale and the safer alternative.

| Anti-Feature | Why Players Request It | Why It's Banned / Bad | Safer Alternative / Action |
|--------------|------------------------|-----------------------|----------------------------|
| **Minimap (any kind)** | Users see Badlion/Feather ship them and assume they're fine | **Explicitly blacklisted on Hypixel.** Hypixel removed minimaps from the allowed list entirely. Entity-showing minimaps are instant-ban; non-entity minimaps also banned. Watchdog won't detect it server-side but Hypixel admins can manually ban, and minimaps load external rendering that streamers leak on camera → reports | **Do not ship a minimap, ever.** Coordinates HUD is allowed and covers most "where am I" use cases. |
| **Reach Display (mod that shows distance to hit target)** | "It's just a display of public info" | Hypixel: "use at your own risk" = technically disallowed. It reveals invisible-player positions → effective ESP. Badlion lists it but warns. Lunar does NOT include it. | **Do not ship.** It's a trust-destroying feature if WiiWho ever pitches to Hypixel as a partner. |
| **Hitboxes overlay / entity ESP-style rendering** | "Vanilla F3+B shows them" | Rendering through walls, custom colors, or extending to invisible entities = ESP = ban. Even vanilla-style hitboxes are considered unfair in PvP contexts. Badlion ships "Hitboxes" mod but is explicit about it being advantage-providing | **Do not ship.** If debug info is needed, respect vanilla F3+B exactly, no extensions. |
| **Reach modification (extend hit distance)** | "Lag compensation" | Instant Watchdog ban. Modifies combat packets. Non-negotiable. | **Never.** Not even a toggle. |
| **Kill Aura / auto-aim / aim assist / triggerbot** | PvP advantage | Instant ban, defines "cheat client". Hypixel blacklists all aim-assist. | **Never.** |
| **Velocity modification / AntiKnockback** | "Lag comp" | Modifies incoming velocity packets. Watchdog ban. | **Never.** |
| **Auto-click / burst-click macros** | "Carpal tunnel QoL" | Hypixel explicitly bans auto-clickers and anything that automates clicks. Even randomized ones. | Don't build. CPS counter (read-only) is fine. |
| **Auto-sprint as a macro** | QoL | Hypixel explicitly bans auto-sprint. Note: **toggle-sprint is allowed** (player presses a key once, client holds W state), but **auto-sprint** (client decides when to sprint) is not. | Ship toggle-sprint only. Never predictive. |
| **Scaffolding / tower / auto-bridging** | Bedwars QoL | Instant ban, same category as killaura | **Never.** |
| **Xray / cave detection / ore highlighter** | "Caving is tedious" | Ban-on-sight on any PvP/Survival server | **Never.** Fullbright is NOT xray — fullbright clamps gamma but does not reveal hidden blocks. |
| **Chest / player ESP** | "Knowing is half the battle" | Blacklisted | **Never.** |
| **Nametag through walls** | "Find my teammate" | Counts as ESP | **Never.** Use the vanilla glowing effect pathway server-side if server supports it. |
| **Packet modification of any kind** | "Fix lag" | Automatic ban. This is the anticheat's entire detection surface. | **Never.** All WiiWho features must be render-only, input-side, or read-only against game state. |
| **Auto-tip / auto-GG as default-on** | Community nicety | **AutoGG is technically "use at own risk" on Hypixel** — universally tolerated in practice, but Hypixel has never officially blessed it. AutoTip same. | Offer as **opt-in, off-by-default** with a clear warning. Don't ship enabled. |
| **Auto-text / chat macros beyond AutoGG** | Bind "/lobby" to F1 | Hypixel: "technically disallowed" — rare enforcement unless spam. Still a risk for the project's "anticheat-safe" promise. | Skip for v0.1. Revisit as opt-in power-user feature in v0.3+ if user demand is real. |
| **NickHider (hide own name from screenshots)** | Streamer "protect my identity" | Gray area — Hypixel allows some nickhiders (e.g., certain SkyClient ones) but they modify rendered nametag on own client only. Low risk but not zero. | Defer past v0.2. Not core to WiiWho identity. |
| **Keystrokes count for "clicks" visual that flashes on hit** | "Satisfaction" | Rendering counter on hit is fine; rendering it such that it leaks whether you hit an invisible player is ESP | Build plain Keystrokes only. Don't "flash on successful hit" — let vanilla sound be the signal. |
| **Cracked account support / offline mode** | "Not everyone pays for MC" | PROJECT.md non-goal; also bad for anticheat-server relationships and Microsoft TOS | **Never.** MSAL only. |
| **Bundling Optifine** | Users request it since Optifine + client would be "best of both" | Optifine's license forbids redistribution; Lunar/Badlion use their own perf paths. Bundling triggers takedowns. | Users can install Optifine themselves if they know how; WiiWho ships its own perf work. Do NOT bundle. |
| **Closed-source mod that hides its patches** | "Easier" | Hypixel/BlocksMC have been increasingly suspicious of closed clients (Lunar gets a pass because of scale + partnerships). A new closed client with obfuscated patches looks like a ghost client. | Keep WiiWho auditable (open-source or at minimum reproducible Forge mod). This aligns with the "open-source differentiator" lever. |
| **Auto-updater that hot-patches the JAR in-place** | Convenience | Hypixel flags clients that mutate themselves at runtime. Anti-cheat screen-share detection watches for this. | If auto-updates happen, they happen in the launcher, before game launch. Never during a game session. |

**Sources for anti-features:**
- [Hypixel Allowed Modifications](https://support.hypixel.net/hc/en-us/articles/6472550754962-Hypixel-Allowed-Modifications)
- [Hypixel Watchdog Cheat Detection](https://hypixel.fandom.com/wiki/Watchdog_Cheat_Detection)
- [Guide - Detecting Common Disallowed Modifications](https://hypixel.net/threads/guide-detecting-common-disallowed-modifications.4120232/)
- [Is Reach Display Mod allowed](https://hypixel.net/threads/is-the-reach-display-mod-allowed.1235022/)
- [Is minimap banned](https://hypixel.net/threads/is-the-minimap-mod-banned.1686623/)
- [Zoom mod allowed](https://hypixel.net/threads/is-this-mod-allowed-in-the-hypixel-server.3237464/)
- [Auto-GG / Auto-text status](https://hypixel.net/threads/how-is-auto-gg-allowed.3730751/)

---

## Feature Dependencies

```
Microsoft OAuth (launcher)
    └──required by──> One-click launch flow
                          └──required by──> Crash log viewer (to know what game we launched)
                          └──required by──> Cosmetics pipeline (need account UUID to key cosmetics)
                                                └──required by──> Placeholder cape (v0.1)
                                                └──required by──> Real cosmetics catalogue (v0.3+)
                                                                      └──required by──> Cosmetics backend

Forge 1.8.9 mod scaffold
    └──required by──> FPS counter HUD
    └──required by──> Keystrokes HUD
    └──required by──> CPS counter HUD
    └──required by──> FPS optimization work
    └──required by──> Placeholder cape (rendering side)
    └──required by──> Every future HUD / cosmetic

Bundled Java 8 JRE
    └──required by──> One-click launch flow (without it, user needs their own Java)

RAM slider
    └──required by──> (nothing; standalone QoL)

HUD rendering framework (from FPS/Keystrokes/CPS)
    └──enhances──> All future HUDs (Armor, Potion, Coordinates, etc. in v0.2)
    └──enhances──> Mod profiles (v0.3)

Cosmetics render hook (from placeholder cape)
    └──enhances──> All future cosmetics (real capes, hats, wings, emotes)

Mod injection pipeline (launcher → Forge mod)
    └──required by──> Every in-game feature
    └──enhances──> Auto-updater (v0.3+) — same injection but fetched from remote

Anticheat-safety posture
    └──conflicts──with──> Minimap, Reach Display, Hitboxes, any packet-modifying feature
    └──conflicts──with──> AutoText, auto-clickers, any automation
```

### Dependency Notes

- **Cosmetics backend is a real gate.** PROJECT.md flags this as an open question. Without a backend, cosmetics are baked into client binary → no per-user entitlements → no monetization path. Decision point before v0.3.
- **HUD rendering framework is built in v0.1** via the FPS/Keystrokes/CPS work. Every v0.2 HUD feature (Armor, Potion, Coordinates) rides on this framework; doing v0.1 HUDs sloppily taxes v0.2.
- **Anticheat posture conflicts with minimap/reach/etc.** are not negotiable — they're the project's identity. Document them in PITFALLS.md so they don't creep back in.
- **Mod profiles (Badlion-style) require HUD config persistence** which in turn requires a stable HUD rendering framework. Good v0.3 candidate once v0.2 HUDs are in.

---

## MVP Definition

### Launch With (v0.1) — already locked in PROJECT.md

Cross-referenced against the table-stakes table above. Every v0.1 item is table-stakes; none are differentiators except the perf claim.

- [x] Electron + TS + React launcher — table stakes; PROJECT.md locked
- [x] Microsoft OAuth persisted login — table stakes; PROJECT.md locked
- [x] One-click launch (download vanilla + inject Forge mod) — table stakes; PROJECT.md locked
- [x] Bundled Java 8 JRE (Windows + macOS) — table stakes; PROJECT.md locked
- [x] RAM allocation slider — table stakes; PROJECT.md locked
- [x] Crash log viewer — table stakes; PROJECT.md locked
- [x] Forge 1.8.9 mod scaffold (MCP + Mixin) — foundation
- [x] FPS counter HUD — table stakes; PROJECT.md locked
- [x] Keystrokes HUD — table stakes; PROJECT.md locked
- [x] CPS counter HUD — table stakes; PROJECT.md locked
- [x] FPS performance (beats Optifine on ref benchmark) — **the** differentiator; PROJECT.md locked
- [x] Placeholder cape (proves cosmetics pipeline) — table stakes for "client feel"; PROJECT.md locked
- [x] Windows + macOS packaging — table stakes; PROJECT.md locked
- [x] Anticheat-safe on Hypixel + BlocksMC — hard constraint; PROJECT.md locked

**Research validates that the locked v0.1 scope is genuinely minimal for a "Lunar-alternative"-shaped product.** It's all table stakes. The only differentiator is the perf claim, which is also the highest-complexity item — appropriate for a flagship v0.1 bet.

### Add After v0.1 Validation (v0.2)

Target: "someone can use this as a daily driver for 1.8.9 PvP without missing Lunar/Badlion." All P1-labeled v0.2+ candidates above.

- [ ] Armor HUD — table-stakes PvP HUD
- [ ] Potion Effects HUD — table-stakes PvP HUD
- [ ] Coordinates overlay — table stakes for non-PvP game modes
- [ ] Zoom mod (scroll-adjustable) — explicitly allowed, trivial complexity
- [ ] Toggle sprint / toggle sneak — explicitly allowed, trivial
- [ ] Custom crosshair — high personalization per unit of code
- [ ] Fullbright (gamma clamp) — clearly-scoped, must NOT become xray
- [ ] FOV slider extension — Patcher-style
- [ ] Custom scoreboard (hide numbers, reposition) — hooks already built

### v0.3 Candidates

Target: "WiiWho starts feeling unique compared to Lunar/Badlion."

- [ ] Discord Rich Presence
- [ ] Mod profiles / per-server HUD config
- [ ] Motion blur + 1.7 animations (visual-polish pack)
- [ ] Chat improvements (search, copy, scroll)
- [ ] Better tab list
- [ ] AutoGG (opt-in, off-by-default, labelled USE-AT-OWN-RISK)
- [ ] Cosmetics backend decision + real catalogue work begins

### Future Consideration (v0.4+)

- [ ] Server browser / server list integration — high complexity, low v0.1-v0.3 value since small-group users know their servers
- [ ] Server mappings (Lunar-style partner integration) — only meaningful at scale
- [ ] Replay Mod integration — streamer differentiator, late-stage
- [ ] Screenshot uploader — needs image host
- [ ] Proximity voice chat — only meaningful after friends/party exists
- [ ] Friends / party system — needs backend
- [ ] Linux packaging — on user request
- [ ] Multi-version support (1.12, 1.20+) — PROJECT.md current non-goal; revisit only if 1.8.9 ecosystem truly dies

---

## Feature Prioritization Matrix

Scope limited to feature-level v0.1 scope + top v0.2 candidates, since v0.3+ is too speculative to score precisely.

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| MS OAuth login | HIGH | MEDIUM | P1 (v0.1) | Gate for everything |
| One-click launch | HIGH | MEDIUM | P1 (v0.1) | Defining feature |
| Bundled Java 8 | HIGH | LOW | P1 (v0.1) | Removes #1 user-install friction point |
| RAM slider | MEDIUM | LOW | P1 (v0.1) | Table stakes, cheap |
| Crash log viewer | HIGH | MEDIUM | P1 (v0.1) | Forge 1.8.9 crashes are frequent |
| FPS counter HUD | HIGH | LOW | P1 (v0.1) | Baseline expectation |
| Keystrokes HUD | HIGH | LOW | P1 (v0.1) | Streaming/PvP baseline |
| CPS counter HUD | HIGH | LOW | P1 (v0.1) | PvP baseline |
| Beats-Optifine perf | HIGH | VERY HIGH | P1 (v0.1) | The differentiator; owns most of the v0.1 timeline |
| Placeholder cape | MEDIUM | MEDIUM | P1 (v0.1) | Validates cosmetics pipeline end-to-end |
| Anticheat safety audit | HIGH | MEDIUM | P1 (v0.1) | Hard constraint; affects every in-game decision |
| Mac packaging | MEDIUM | MEDIUM | P1 (v0.1) | Widens small-group reach |
| Armor HUD | HIGH | LOW | P1 (v0.2) | Table stakes for PvP |
| Potion HUD | HIGH | LOW | P1 (v0.2) | Table stakes for PvP |
| Coordinates | HIGH | LOW | P1 (v0.2) | Table stakes for non-PvP modes |
| Zoom mod | HIGH | LOW | P1 (v0.2) | Explicitly allowed; trivial |
| Toggle sprint/sneak | HIGH | LOW | P1 (v0.2) | Explicitly allowed; trivial |
| Custom crosshair | MEDIUM | LOW | P1 (v0.2) | High personalization |
| Fullbright (gamma) | MEDIUM | LOW | P1 (v0.2) | Allowed; must NOT become xray |
| FOV slider extension | MEDIUM | LOW | P1 (v0.2) | Trivial |
| Custom scoreboard | MEDIUM | MEDIUM | P1 (v0.2) | Hook work reusable later |
| Discord RPC | LOW-MEDIUM | LOW | P2 (v0.3) | Cheap polish, free-tier marketing |
| Mod profiles | MEDIUM | MEDIUM | P2 (v0.3) | Badlion-parity feature |
| AutoGG (opt-in) | MEDIUM | LOW | P2 (v0.3) | Community-loved but label risk clearly |
| Real cosmetics catalogue | HIGH (if monetizing) | HIGH | P2 (v0.3) | Backend decision gate |
| Server browser | MEDIUM | HIGH | P3 (v0.4+) | Small-group users don't need it |
| Replay Mod | MEDIUM (streamers) | HIGH | P3 (v0.4+) | Differentiator for content creators |
| Proximity voice | MEDIUM | HIGH | P3 (v0.4+) | Fits small-group framing but expensive |
| Linux packaging | LOW | LOW | P3 | On request |
| **Minimap** | HIGH (user demand) | MEDIUM | **NEVER** | Banned on Hypixel — anti-feature |
| **Reach Display** | MEDIUM (user demand) | LOW | **NEVER** | "Use at own risk" = not anticheat-safe |
| **Hitboxes overlay** | MEDIUM (user demand) | LOW | **NEVER** | Counts as ESP |

---

## Competitor Feature Analysis

| Feature | Lunar Client | Badlion Client | Patcher | Feather | WiiWho v0.1 plan |
|---------|--------------|----------------|---------|---------|-------------------|
| Launcher stack | Electron 25+ | Electron | None (Forge mod) | Electron | Electron + TS + React (Lunar-aligned) |
| MS OAuth | Yes | Yes | N/A | Yes | Yes |
| Bundled Java | Yes | Yes | N/A | Yes | Yes |
| FPS counter | Built-in | Built-in | No (Optifine territory) | Built-in | Yes (v0.1) |
| Keystrokes | Built-in | Built-in | No | Built-in | Yes (v0.1) |
| CPS counter | Built-in | Built-in | No | Built-in | Yes (v0.1) |
| Armor HUD | Built-in | Built-in | No | Built-in | v0.2 |
| Potion HUD | Built-in | Built-in | No | Built-in | v0.2 |
| Coordinates | Built-in | Built-in | No | Built-in | v0.2 |
| **Minimap** | Built-in (but flagged by Hypixel) | Built-in | No | Built-in | **Never** |
| **Reach Display** | No | Built-in ("use at own risk") | No | Mixed | **Never** |
| **Hitboxes mod** | No | Built-in | No | No | **Never** |
| Custom crosshair | Built-in | Built-in | No | Built-in | v0.2 |
| Custom scoreboard | Built-in | Built-in | Partial | Built-in | v0.2 |
| Zoom | Via Optifine compat | Built-in | Partial (FOV) | Built-in | v0.2 |
| Fullbright | Built-in | Built-in | No | Built-in | v0.2 |
| Toggle sprint/sneak | Built-in | Built-in | No | Built-in | v0.2 |
| FOV slider extension | Yes | Yes | Yes | Yes | v0.2 |
| 1.7 animations | Yes | Yes | No | Yes | v0.3 |
| Motion blur | Yes | Yes | No | Yes | v0.3 |
| AutoGG | Yes | Yes (module) | No | Yes | v0.3 (opt-in) |
| Cosmetics (capes) | Paid shop | Paid shop (Plus tier) | No | Paid shop | Placeholder v0.1 → real catalogue v0.3 |
| Cosmetics (hats/wings/emotes) | Paid shop | Paid shop | No | Paid shop | v0.3+ |
| Voice chat | Mumble link | No | No | Built-in (SVC) | v0.4+ (if at all) |
| Friends/party | Limited | Yes | No | Yes | v0.4+ (requires backend) |
| Discord RPC | Yes | Yes | No | Yes | v0.3 |
| Replay Mod | Available | Available | No | Available | v0.4+ |
| Server browser | Partnership (Best Servers) | Server list | No | No | v0.4+ |
| Mod profiles | Partial | Yes | No | Partial | v0.3 |
| Screenshot uploader | No | Yes | No | No | v0.3+ (needs backend) |
| Crash recovery | Yes | Yes | CrashPatch | Yes | v0.1 |
| Auto-updater | Yes (signed) | Yes (signed) | Manual | Yes | v0.3+ (when going public) |
| Open source | No | No | **Yes** | No | **Decision deferred — leverage as differentiator** |
| Free (no paid tier) | No (cosmetics paid) | No (Plus tier) | **Yes** | Partial | Yes — aligns with project identity |
| Blocks 3rd-party mods | Yes (anti-cheat stance) | No | N/A | No | TBD — likely allow Forge coexistence, but disable conflicting ones |

---

## Key Takeaways for Roadmap

1. **v0.1 is correctly scoped — it's all table stakes + one differentiator (perf).** No scope-cut recommended.
2. **v0.2 should be the "Armor/Potion/Coordinates + quick-win HUD/QoL" release.** Everything P1-labelled v0.2+ above is low-complexity and explicitly allowed on Hypixel. This is ~10-12 small features on an HUD framework that already exists after v0.1.
3. **v0.3 is where WiiWho has to pick differentiators.** Suggested wedge: free + open-source + honest (no dark patterns) + Discord RPC + mod profiles. Cosmetics-backend decision happens here.
4. **Anti-features are hardened in research.** Minimap, Reach Display, Hitboxes, any packet mod, any automation — permanent "never" list. Document these in PITFALLS.md so future "we could just add…" suggestions are blocked by default.
5. **Cosmetics backend is the biggest deferred open question.** v0.1 placeholder cape proves the rendering pipeline, but real monetization + catalogue = backend. Flag for v0.3 decision.
6. **"Beats Optifine" is load-bearing for v0.1.** It's the only differentiator in v0.1; without it, WiiWho is "another Lunar clone with fewer features". STACK.md and ARCHITECTURE.md must commit to a specific perf approach (backport Sodium-style / Mixin hotspots / reimplement Patcher-style) — don't let this stay deferred past the first research phase.

---

## Sources

**Competitor feature catalogues:**
- [Lunar Client — Features](https://www.lunarclient.com/features)
- [Lunar Client — PvP mods article](https://www.lunarclient.com/news/lunar-client-mods-for-the-best-pvp-experience)
- [BisectHosting — What Mods Come With Lunar Client](https://www.bisecthosting.com/blog/lunar-client-mods-list)
- [Badlion Client — Mods wiki](https://www.badlion.net/wiki/badlion-client-mods)
- [Badlion Client — 100+ mods page](https://www.badlion.net/free-minecraft-mods)
- [SkyClient](https://skyclient.co/) (sunset Feb 2026 per their notice)
- [Patcher mod — Sk1er](https://sk1er.club/mods/patcher)
- [Patcher GitHub](https://github.com/Sk1erLLC/Patcher)
- [PolyPatcher (Modrinth)](https://modrinth.com/mod/patcher)
- [Feather Client](https://feathermc.com/)
- [Feather NamuWiki entry](https://en.namu.wiki/w/Feather%20Client)

**Anticheat / allowed modifications:**
- [Hypixel Allowed Modifications](https://support.hypixel.net/hc/en-us/articles/6472550754962-Hypixel-Allowed-Modifications)
- [Hypixel Watchdog Cheat Detection (Fandom)](https://hypixel.fandom.com/wiki/Watchdog_Cheat_Detection)
- [Hypixel Watchdog support article](https://support.hypixel.net/hc/en-us/articles/360019613300-About-the-Hypixel-Watchdog-System)
- [Hypixel — Detecting Common Disallowed Modifications (guide)](https://hypixel.net/threads/guide-detecting-common-disallowed-modifications.4120232/)
- [Hypixel — Reach Display allowed thread](https://hypixel.net/threads/is-the-reach-display-mod-allowed.1235022/)
- [Hypixel — Minimap banned thread](https://hypixel.net/threads/is-the-minimap-mod-banned.1686623/)
- [Hypixel — Zoom mod allowed thread](https://hypixel.net/threads/is-this-mod-allowed-in-the-hypixel-server.3237464/)
- [Hypixel — AutoGG / AutoText rules discussion](https://hypixel.net/threads/how-is-auto-gg-allowed.3730751/)
- [Hypixel Modifications (Fandom)](https://hypixel.fandom.com/wiki/Modifications)

**Voice / cosmetics / misc:**
- [Lunar Mumble Link setup](https://www.lunarclient.com/news/how-to-setup-mumble-link-on-lunar-client)
- [SVC for Lunar Client](https://modrinth.com/modpack/svc-for-lunar-client)
- [Lunar Client Store — cosmetics](https://store.lunarclient.com/)
- [Lunar Client Server Mappings](https://www.lunarclient.com/news/what-is-lunar-clients-server-mappings)

**Cross-reference:**
- [Badlion Client 2.0 Roadmap thread](https://www.badlion.net/forum/thread/207779) — context for what's current in competitor pipeline

---

*Feature research for: custom Minecraft 1.8.9 Lunar-class client*
*Researched: 2026-04-20*
