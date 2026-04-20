# Phase 1: Foundations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 01-foundations
**Areas discussed:** Brand & naming, Repo layout, Launcher visual direction, Azure AD specifics, Anticheat-safety doc, Cape provenance

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Brand & naming | Display name, MODID, binaries, brand direction | ✓ |
| Repo layout | Single vs multi repo, top-level layout, asset sharing | ✓ |
| Launcher visual direction | Vibe, accent, window size, layout, typography, reference | ✓ |
| Azure AD specifics | MS account, tenant, redirect URI, registration timing | ✓ |

**User's choice:** All four areas.

---

## Brand & Naming

### Display Name

| Option | Description | Selected |
|--------|-------------|----------|
| WiiWho Client | As in CLAUDE.md. No obvious collision with Lunar/Badlion/Feather. | ✓ |
| WiiWho | One word, cleaner in title bar. | |
| Something else | Rename now. | |

**User's choice:** WiiWho Client

### MODID

| Option | Description | Selected |
|--------|-------------|----------|
| wiiwho | Matches project name, 7 chars, generic, easy to collision-check. | ✓ |
| wiiwhoclient | More specific, safer against single-word collisions. | |
| ww | Very short, higher collision risk. | |

**User's choice:** wiiwho

### Launcher Binary Name

| Option | Description | Selected |
|--------|-------------|----------|
| WiiWho.exe / WiiWho.app | Clean, tighter than Lunar's convention. | ✓ |
| WiiWho Client.exe / WiiWho Client.app | Matches full display name, spaces less clean in paths. | |
| wiiwho-launcher.exe | Tools-flavored. | |

**User's choice:** WiiWho.exe / WiiWho.app

### Brand Identity Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 3 | Let Phase 3 own full identity. | |
| Loose direction now | Capture vibe, defer execution. | ✓ |
| Full identity now | Lock colors/logo/typography today. | |

**User's choice:** Loose direction now

### Vibe (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Dark + gamer (Lunar-ish) | Dark bg, neon-ish accent, PvP aesthetic. | ✓ |
| Dark + minimal | Restrained, pro-tool (Linear/Raycast). | |
| Glassy/frosted | Translucency, blur, gradients. | |
| Light/clean | Light bg, atypical for gaming. | |

**User's choice:** Dark + gamer (Lunar-ish)

### Accent

| Option | Description | Selected |
|--------|-------------|----------|
| Leave open for Phase 3 | Designer picks. | |
| Neon green/cyan | Classic PvP-client vibe. | |
| Purple/violet | Differentiates from Lunar/Badlion. | |
| Orange/amber | Warm, unusual. | |

**User's choice (free text via Other):** "I like neon cyan or like a light blue color like this color #16e0ee"
**Notes:** User provided exact hex — locked as primary accent.

---

## Repo Layout

### Repo Model

| Option | Description | Selected |
|--------|-------------|----------|
| Single repo, sibling dirs | launcher/ + client-mod/ in one repo. | ✓ |
| pnpm workspace monorepo | Workspace config at root. | |
| Two separate repos | Independent GitHub repos. | |

**User's choice:** Single repo, sibling dirs

### Top-Level Layout

| Option | Description | Selected |
|--------|-------------|----------|
| launcher/ + client-mod/ + docs/ + assets/ | Matches CLAUDE.md sketch. | ✓ |
| apps/launcher/ + apps/mod/ | Modern monorepo convention. | |
| Launcher at root, mod/ subdir | Asymmetric. | |

**User's choice:** launcher/ + client-mod/ + docs/ + assets/

### Assets Sharing

| Option | Description | Selected |
|--------|-------------|----------|
| Shared assets/ | One dir, both apps pull from it. | ✓ |
| Per-app assets | Duplicates logo files. | |

**User's choice:** Shared assets/

---

## Launcher Visual Direction

### Window

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed small (~1000x650) | Non-resizable, focused pre-launch screen (Lunar pattern). | ✓ |
| Resizable with min | Flexible, more UI work. | |
| Custom frame | Frameless, own title bar (Discord-style). | |

**User's choice:** Fixed small

### Layout Bones

| Option | Description | Selected |
|--------|-------------|----------|
| Play-forward | Big central Play, account top-right, side/bottom for settings. | ✓ |
| Sidebar nav | Left sidebar, main pane switches. | |
| Tab bar top | Top tabs for Home/Settings/Logs. | |

**User's choice:** Play-forward

### Typography

| Option | Description | Selected |
|--------|-------------|----------|
| System sans | OS-native (SF Pro / Segoe UI). | ✓ |
| Inter or similar | Bundled modern sans, consistent cross-OS. | |
| Distinctive gaming font | Rajdhani/Orbitron/Eurostile. | |

**User's choice:** System sans

### Reference Launcher(s)

| Option | Description | Selected |
|--------|-------------|----------|
| Lunar Client | Industry standard. | |
| Badlion | Feature-dense. | |
| Feather | Cleaner/more modern. | |
| Study all three | Review all, pick what works. | ✓ |

**User's choice:** Study all three

---

## Azure AD Specifics

### Registering MS Account

| Option | Description | Selected |
|--------|-------------|----------|
| Personal MS account | Simplest, fits personal/small-group distribution. | ✓ |
| Dedicated WiiWho MS account | Better isolation, portable. | |
| Work/school account | Org-tied, wrong fit. | |

**User's choice:** Personal MS account

### Tenant / Audience

| Option | Description | Selected |
|--------|-------------|----------|
| Personal MS accounts only (consumers) | Correct for Minecraft launcher. | ✓ |
| Multi-tenant + personal | Overbroad. | |
| Single tenant | Wrong — users aren't in your tenant. | |

**User's choice:** Personal MS accounts only

### Redirect URI

| Option | Description | Selected |
|--------|-------------|----------|
| Device code redirect | prismarine-auth handles this. | |
| localhost redirect | Wrong — this is auth code flow. | |
| Let research decide | Defer to Phase 2 researcher to confirm exact Azure config. | ✓ |

**User's choice:** Let research decide (deferred to Phase 2)

### Timing of Registration

| Option | Description | Selected |
|--------|-------------|----------|
| During Phase 1 execution | Claude walks owner through portal, queue starts now. | ✓ |
| Owner does it manually before Phase 2 | Owner handles portal, supplies client ID. | |
| Defer to Phase 2 | Risks 1-7 day wait at Phase 2 start. | |

**User's choice:** During Phase 1 execution

---

## Additional Gray Areas (second round)

### Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Anticheat-safety doc | Format, signoff, CI enforcement, alt-test location | ✓ |
| Cape provenance | Source, design | ✓ |
| Mojang asset policy doc | Format, CI rule | |
| Mod template starting point | Fork vs copy vs scratch | |

**User's choice:** Anticheat-safety doc + Cape provenance

---

## Anticheat-Safety Doc

### Format

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown table per feature | Grep-able, auditable, CI-parseable if needed later. | ✓ |
| One-paragraph per feature | More nuance, harder to audit. | |
| Checklist/template | Distributed, less central. | |

**User's choice:** Markdown table per feature

### Signoff

| Option | Description | Selected |
|--------|-------------|----------|
| Project owner | Owner is final signoff. | ✓ |
| Owner + one other reviewer | Adds friction. | |
| Claude drafts, owner signs | Same outcome with explicit drafting step. | |

**User's choice:** Project owner

### CI Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Advisory only for v0.1 | Doc is the process, no CI gate. | ✓ |
| Lint: every feature has an entry | CI checks entries exist. | |
| Defer to later milestone | No enforcement plan yet. | |

**User's choice:** Advisory only for v0.1

### Alt-Account Play Test Location

| Option | Description | Selected |
|--------|-------------|----------|
| Section in ANTICHEAT-SAFETY.md | Co-located with per-feature verdicts. | ✓ |
| Separate RELEASE-TESTING.md | Broader doc, will grow. | |
| Commit message only | Less traceable. | |

**User's choice:** Section in ANTICHEAT-SAFETY.md

---

## Cape Provenance

### Source

| Option | Description | Selected |
|--------|-------------|----------|
| Owner draws it | Clear provenance. | ✓ |
| Commission a friend | Needs paper trail. | |
| CC0 cape pack | License trail matters. | |
| Claude generates a spec | Claude writes, owner produces PNG. | |

**User's choice:** Owner draws it

### Design

| Option | Description | Selected |
|--------|-------------|----------|
| Solid cyan + WiiWho logo | Matches launcher accent. | ✓ |
| Cyan gradient | More visual interest. | |
| Just solid cyan | Absolute minimum. | |
| Let me sketch it | Defer design. | |

**User's choice:** Solid cyan + WiiWho logo

---

## Claude's Discretion

- **Mojang asset policy doc format** — defaulted to a one-pager (not asked). User can still revise.
- **Mod template starting point** — defaulted to `nea89o/Forge1.8.9Template` per research recommendation.
- **Exact Azure AD redirect URI configuration** — deferred to Phase 2 research per user choice.

## Deferred Ideas

See CONTEXT.md §deferred section.

## User Concern Raised Mid-Discussion

After all areas covered, user paused to ask: **"i just want to reall quick COMPLETELY ensure that hypixel and servers will alow this because i do NOT want my account banend or anything like that"**

Addressed in-conversation with:
- v0.1 feature set (FPS counter, Keystrokes, CPS) is explicitly in Hypixel's allowed-mods category
- All three are read-only render overlays; no packet interaction
- MODID `wiiwho` is generic (no blacklist risk)
- Anti-features (reach display, hitbox, minimap, combat automation) are never-build-ever
- ANTICHEAT-SAFETY.md review gate blocks unsafe features before merge
- Alt-account 2hr Hypixel + 1hr BlocksMC test required before real account touches live servers (COMP-02/03)
- Phase 4 also runs the alt-test (first in-game features), not just at Phase 7

User accepted and selected "Yes, create context".
