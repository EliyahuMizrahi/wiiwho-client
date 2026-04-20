# WiiWho Client — Mojang Asset Policy

**Purpose:** Clear-text record of how WiiWho avoids the Mojang EULA's asset-redistribution pitfall. This document satisfies requirement **COMP-04** — WiiWho does not redistribute any Minecraft asset; the launcher downloads the vanilla jar and libraries directly from Mojang at runtime.

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
- Requirement mapping: **COMP-04** (see `.planning/REQUIREMENTS.md`)

---
*Policy committed 2026-04-20 as part of Phase 1 Foundations (COMP-04).*
