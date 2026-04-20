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
