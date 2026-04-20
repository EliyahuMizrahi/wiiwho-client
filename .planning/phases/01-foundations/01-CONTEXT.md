# Phase 1: Foundations - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the **project-wide baselines** that every subsequent phase depends on:

1. Three legal/policy docs committed (ANTICHEAT-SAFETY.md, docs/mojang-asset-policy.md, placeholder cape provenance note)
2. Forge 1.8.9 mod scaffold that runs `./gradlew runClient` end-to-end with a real MS login (via DevAuth) + a trivial Mixin applied, verified on Windows
3. Electron launcher skeleton (`pnpm dev`) that opens a fixed-size window with a Play button, security hardened (contextIsolation / sandbox / no nodeIntegration)
4. Azure AD app registered with Minecraft API permission request submitted to Microsoft (1-7 day queue running)
5. Repo scaffolded with the agreed top-level layout

Phase 1 does NOT: implement auth (Phase 2), download Minecraft (Phase 3), load Forge at runtime from the launcher (Phase 4), render anything cosmetic in-game (Phase 5), or do performance work (Phase 6).

Requirements in scope: COMP-04, MOD-01, MOD-02, MOD-03, MOD-04, LAUN-01, LAUN-02, LAUN-06.

</domain>

<decisions>
## Implementation Decisions

### Brand & Naming

- **D-01: Display name is "WiiWho Client".** Appears in launcher title bar, Play screen, installer publisher string, README.
- **D-02: MODID is `wiiwho`** — generic, 7 chars, not feature-descriptive, avoids Hypixel MODID handshake blacklist. Collision-check against CurseForge + Modrinth in Phase 1 execution; if taken, escalate and pick between `wiiwho-client` or a variant.
- **D-03: Launcher binaries are `WiiWho.exe` (Windows NSIS) and `WiiWho.app` (macOS).** Tight, matches Lunar convention, no spaces in paths. Installer display name can still be "WiiWho Client".
- **D-04: Brand identity is captured now at a directional level, full design locked in Phase 3** — see Launcher Visual Direction below.

### Repo Layout

- **D-05: Single-repo, sibling-directory layout.** No pnpm workspace (no shared JS code to hoist), no separate repos (coordination tax not worth it at this scale).
- **D-06: Top-level directories at repo root:**
  - `launcher/` — Electron + TS + React app (pnpm project)
  - `client-mod/` — Forge 1.8.9 mod (Gradle project)
  - `assets/` — shared assets (logos, cape PNGs, icons). Both launcher and mod pull from here.
  - `docs/` — policy docs (anticheat-safety, mojang-asset-policy, cape-provenance)
  - `.planning/` — GSD directory, already present
- **D-07: No per-app asset duplication.** Launcher splash + mod in-game logo + installer icon all come from `assets/`. Build steps copy into each app's resources at build time.

### Launcher Visual Direction (directional — full design in Phase 3)

- **D-08: Vibe is "dark + gamer (Lunar-ish)".** Dark background, PvP-crowd aesthetic, neon-leaning accents.
- **D-09: Primary accent color is cyan `#16e0ee`** — explicitly requested. Phase 3 builds the full palette around this.
- **D-10: Window is fixed-size, non-resizable, approximately 1000x650.** Matches Lunar/Badlion pattern — launcher is a focused pre-launch screen, not a multitasking desktop app.
- **D-11: Layout is "Play-forward".** Big central Play button + small account badge top-right + side or bottom strip for settings/logs access. No sidebar nav, no top tabs.
- **D-12: Typography is OS-native system sans** (SF Pro on macOS, Segoe UI on Windows). Zero bundled-font cost. Phase 3 may revisit if a custom font is worth it — explicitly open.
- **D-13: Phase 3 design reference brief = study Lunar Client, Badlion Client, and Feather Client; pick what works.** Do not clone; take inspiration.

### Azure AD App

- **D-14: Register under the project owner's personal Microsoft account** (simplest, matches the personal/small-group distribution model).
- **D-15: Tenant / audience = "Personal Microsoft accounts only" (consumers).** This is the only valid config for a Minecraft launcher — MC accounts are personal.
- **D-16: Redirect URI scheme = device-code-flow URI.** Exact scheme (which is NOT an http://localhost redirect) deferred to Phase 2 research — `prismarine-auth` handles this internally, so whatever `prismarine-auth` expects is what we configure. Phase 2 researcher confirms.
- **D-17: Azure app registration happens during Phase 1 execution.** Claude walks the owner through the Azure portal steps; the owner clicks through. The Minecraft API permission request is submitted immediately so the 1-7 day review queue is running during Phase 1 and 2 implementation — Phase 2 cannot complete without approval.
- **D-18: The Azure app's client ID is treated as non-secret** (MSAL device code flow with public client — no client secret, client ID in source is normal).

### Anticheat-Safety Doc

- **D-19: Format is a markdown table per feature** in `docs/ANTICHEAT-SAFETY.md`. Columns: Feature | What it reads/writes | Hypixel verdict (pass/fail + source link) | BlocksMC verdict | Reviewer | Date.
- **D-20: Signoff authority = project owner.** Owner reviews and approves every feature entry before the feature PR merges.
- **D-21: CI enforcement = advisory only for v0.1.** No automated check blocks merges; the doc is the process. Revisit before public release.
- **D-22: Alt-account play test results live in ANTICHEAT-SAFETY.md** as a dedicated section per server (Hypixel, BlocksMC), with duration, features-on, build hash, outcome. Co-located with per-feature verdicts for one-stop audit.

### Placeholder Cape

- **D-23: Project owner draws the placeholder cape.** Clear provenance (owner-created → owner-licensed to project).
- **D-24: Design = solid cyan (`#16e0ee`) + WiiWho logo/monogram.** Matches launcher accent. Simple silhouette. Real cosmetics catalogue in v0.3.
- **D-25: Provenance is documented in `docs/cape-provenance.md`** with date created, tool used, license grant text. Follows the Mojang asset policy (original art, owner grants to project — no derivative of any Mojang asset).

### Deferred (Claude's Discretion for Downstream Phases)

- **D-26: Mojang asset policy doc format** — kept simple: a one-pager in `docs/mojang-asset-policy.md` that says "launcher downloads vanilla jars + libraries + assets from Mojang's manifest at runtime, caches them in the user's data directory, never redistributes them; WiiWho's own mod jar contains only original code + cosmetic PNGs WiiWho owns." No CI rule in v0.1.
- **D-27: Mod template starting point** — use `nea89o/Forge1.8.9Template` as the reference (research's first recommendation). Copy the `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, and `mcmod.info` scaffolding; write our own `@Mod` main class. Do NOT fork wholesale (drag-in of history is unnecessary).

### Folded Todos

None — project was just initialized, no backlog todos exist yet.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level Context

- `.planning/PROJECT.md` — project vision, locked stack, constraints, non-goals
- `.planning/REQUIREMENTS.md` §v1 Requirements — the 45 v1 requirements, especially COMP-* for anticheat/legal and the 8 assigned to Phase 1
- `.planning/ROADMAP.md` §Phase 1 — phase goal, success criteria, requirement mapping

### Research (all four are load-bearing for Phase 1)

- `.planning/research/STACK.md` — stack recommendations, especially §Mod toolchain (gg.essential.loom + Gradle 7.6 + Mixin 0.7.11 + dual JDK) and §Launcher stack (Electron 41, React 19, Vite, Tailwind v4, Zustand, pnpm)
- `.planning/research/ARCHITECTURE.md` — component boundaries (launcher ↔ JVM), file layout for Win/Mac, launch lifecycle (Phase 1 implements the scaffolding, not the full pipeline)
- `.planning/research/PITFALLS.md` — especially the Forge toolchain pitfalls (Gradle/ForgeGradle version traps, Mixin 0.7 vs 0.8 incompatibility, MODID blacklist) and Electron security pitfalls (contextIsolation, sandbox, IPC attack surface)
- `.planning/research/FEATURES.md` — only to confirm the v0.1 feature set maps to the "table stakes, anticheat-safe" category

### External (from research — download/read during planning)

- nea89o/Forge1.8.9Template — https://github.com/nea89o/Forge1.8.9Template (mod scaffold reference)
- hannibal002/Example-1.8.9-Mod `settings.gradle.kts` — https://github.com/hannibal002/Example-1.8.9-Mod/blob/main/settings.gradle.kts (gg.essential.loom current pin)
- EssentialGG/essential-gradle-toolkit — https://github.com/EssentialGG/essential-gradle-toolkit (toolkit we'll plug in)
- DJtheRedstoner/DevAuth — https://github.com/DJtheRedstoner/DevAuth (dev-environment MS login for `./gradlew runClient`)
- Microsoft Learn: [Register an application in Azure AD](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) — Phase 1 walks through this
- Microsoft Learn: [Device Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code) — confirms Azure config for device-code clients
- wiki.vg: [Microsoft Authentication Scheme](https://wiki.vg/Microsoft_Authentication_Scheme) — cross-ref for the Minecraft API permission request
- Electron Security: https://www.electronjs.org/docs/latest/tutorial/security — Phase 1 launcher security posture comes from here
- Electron Context Isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation — setup reference
- Hypixel Support: [Allowed Mods](https://support.hypixel.net/hc/en-us/articles/4402774434194) — grounds the ANTICHEAT-SAFETY.md verdicts
- About Hypixel Watchdog: https://support.hypixel.net/hc/en-us/articles/360019613300 — behavioral-detection context

### Brand Assets (to be produced IN Phase 1 by owner)

- `assets/logo.svg` — WiiWho logo (small, monochrome-friendly — used for exe/app icon, mod splash, placeholder cape)
- `assets/cape-placeholder.png` — the placeholder cape per D-23/D-24

</canonical_refs>

<code_context>
## Existing Code Insights

Repo is **greenfield**. Current contents: `CLAUDE.md`, `.planning/` (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json, research/). Git initialized, no source code, no package files.

### Reusable Assets

None — nothing to reuse.

### Established Patterns

None — Phase 1 IS the "establish patterns" phase for this project.

### Integration Points

- **Repo root** — Phase 1 adds `launcher/`, `client-mod/`, `assets/`, `docs/` as siblings to `.planning/` and `CLAUDE.md`.
- **`launcher/package.json`** — pnpm scripts (`dev`, `build`, `dist`). Phase 1 just needs `dev`; `build`/`dist` wired minimally, actual packaging work is Phase 3.
- **`client-mod/build.gradle.kts`** — Gradle entry point. Phase 1 ensures `./gradlew runClient` works; `./gradlew build` can be stubbed, real jar releasing is Phase 4.
- **`docs/ANTICHEAT-SAFETY.md`** — the permanent per-feature review log. Every future feature phase adds a row.

</code_context>

<specifics>
## Specific Ideas

- **Accent color is `#16e0ee`** — user provided the exact hex. This is the locked primary accent for Phase 3's full palette design.
- **Launcher window size is fixed ~1000x650** — matches Lunar, user confirmed.
- **Phase 3 design references:** Lunar Client, Badlion Client, Feather Client (user said "Study all three"). Do not clone; cherry-pick what works.
- **Cape design:** solid cyan (`#16e0ee`) + WiiWho monogram. User will draw it.
- **MODID collision check** must happen against https://modrinth.com/mods?q=wiiwho and https://www.curseforge.com/minecraft/search?search=wiiwho before the MODID lands in `build.gradle.kts`. If taken, escalate before proceeding.
- **Owner drafts ANTICHEAT-SAFETY.md**; Claude can template it but owner signs each entry.

</specifics>

<deferred>
## Deferred Ideas

Ideas that came up but belong in other phases — captured so nothing is lost.

### Captured for later phases

- **Custom frameless window with our own title bar** (Discord-style) — considered, deferred. System frame is the Phase 1 choice; Phase 3 can revisit if it's worth the platform-quirks tax.
- **Distinctive gaming typography** (Rajdhani, Orbitron, Eurostile) — considered, deferred to Phase 3 when visual identity is locked. Phase 1 is system sans.
- **Full visual identity lock** (palette, logo, full typography) — deferred to Phase 3. Phase 1 only commits accent + vibe direction.
- **CI enforcement of ANTICHEAT-SAFETY.md entries** — deferred. V0.1 is advisory-only. Revisit before any public release.
- **Mojang-asset-policy CI rule** (e.g. lint that our mod jar contains no Mojang assets) — deferred. V0.1 is a simple policy doc.
- **Alternative MSAL library** if `prismarine-auth` falls short — accepted for v0.1, revisit only if Phase 2 hits problems.
- **Mac arm64 JRE bundle** vs x64-only-via-Rosetta — decision deferred to Phase 3 packaging (PKG-02 context).
- **electron-updater / auto-update** — explicitly out of v0.1 scope (REQUIREMENTS.md Out of Scope). Revisit before first public release.
- **EV code signing + macOS notarization** — out of v0.1 scope, deferred to "public release" milestone.

### Reviewed Todos (not folded)

None — no backlog todos existed at project init.

### Scope-creep redirects (none)

No gray area surfaced a new capability during discussion. Scope stayed inside Phase 1's boundary.

</deferred>

---

*Phase: 01-foundations*
*Context gathered: 2026-04-20*
