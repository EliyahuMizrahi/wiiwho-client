# WiiWho Client — Shared Assets

Per decision D-07: all launcher icons, mod in-game splash, installer icons, and cosmetic PNGs originate here. Build steps in `launcher/` and `client-mod/` copy the relevant files into each app's resources at build time. NO per-app asset duplication.

## Current assets

- `logo.svg` — WiiWho logo (monochrome-friendly, small; used for exe/app icon, mod splash, placeholder cape monogram). Owner produces during Phase 1.
- `cape-placeholder.png` — 64x32 Minecraft-1.8-format placeholder cape (solid cyan `#16e0ee` + WiiWho monogram per D-24). Owner produces during Phase 1; provenance in `docs/cape-provenance.md`.

Owner-produced; never derivative of Mojang assets. See `docs/mojang-asset-policy.md`.
