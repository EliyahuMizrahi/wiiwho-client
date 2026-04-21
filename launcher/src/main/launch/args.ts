/**
 * Canonical JVM argv builder for vanilla Minecraft 1.8.9.
 *
 * THIS IS THE ARGV SOURCE OF TRUTH. Every launch spawn (Plan 03-05) builds
 * its argv through here. No ad-hoc `.replace()` or inline string assembly
 * elsewhere — if an invariant drifts, it drifts in exactly one place and
 * the tests in args.test.ts catch it.
 *
 * Canonical argv (RESEARCH.md §JVM argv for 1.8.9 — COPIED VERBATIM):
 *
 *   -Xmx${ramMb}M
 *   -Xms${ramMb}M
 *   -XX:+UseG1GC
 *   -XX:+UnlockExperimentalVMOptions
 *   -XX:G1HeapRegionSize=32M
 *   -XX:MaxGCPauseMillis=50
 *   -Djava.library.path=${nativesDir}
 *   -Dminecraft.launcher.brand=wiiwho-launcher
 *   -Dminecraft.launcher.version=${launcherVersion}
 *   -cp ${classpath}
 *   net.minecraft.client.main.Main
 *   --username ${auth_player_name}
 *   --version 1.8.9
 *   --gameDir ${game_directory}
 *   --assetsDir ${assets_root}
 *   --assetIndex 1.8                    // NOT 1.8.9 — Pitfall 8
 *   --uuid ${auth_uuid}
 *   --accessToken ${auth_access_token}
 *   --userProperties {}                 // literal — 1.8.9 expects this
 *   --userType msa                      // NOT mojang — LCH-06
 *   --versionType release
 *
 * Hardcoding vs. templating:
 *   We DO NOT consume `resolved.minecraftArguments` template text directly.
 *   Instead, we hardcode the 1.8.9 game-arg shape. Rationale (RESEARCH.md):
 *     - The template is a single space-delimited string with 9 placeholder
 *       tokens; naive `.replace()` has tripped launchers when a value
 *       happens to contain a `$` char.
 *     - Every vanilla-1.8.9 launcher on the internet produces the IDENTICAL
 *       argv. Hardcoding pins it against Pitfalls 2 + 8 at the type level
 *       rather than runtime text manipulation.
 *     - Phase 4 (Forge) will extend by calling buildArgv + prepending
 *       `--tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker`
 *       via the `forgeTweaks` optional input. The vanilla core stays put.
 *
 * Phase 4 boundary:
 *   The LaunchInputs interface EXPOSES a `forgeTweaks?: string[]` slot.
 *   Phase 3 leaves it undefined and buildArgv DELIBERATELY IGNORES it —
 *   the presence of the type hook (not the code path) is the Phase 4
 *   seam. Phase 4's task is to wire `forgeTweaks` into the argv between
 *   mainClass and the game args.
 */

import path from 'node:path'
import type { ResolvedVersion } from '@xmcl/core'

/** Vanilla-1.8.9 main class. Pitfall 2: NEVER launchwrapper.Launch (Forge uses that). */
export const VANILLA_MAIN_CLASS = 'net.minecraft.client.main.Main' as const

/** Asset-index slot value. Pitfall 8: 1.8.9's asset index ID is `1.8` — NOT `1.8.9`. */
export const VANILLA_ASSET_INDEX = '1.8' as const

/** User-type slot value. LCH-06: Microsoft accounts always emit `msa` — never `mojang` (legacy). */
export const MSA_USER_TYPE = 'msa' as const

/** Version type (release/snapshot). 1.8.9 is a released version. */
export const VANILLA_VERSION_TYPE = 'release' as const

export interface LaunchInputs {
  /** Allocated heap size in MiB. Pre-clamped by settings store to 1024..4096. */
  ramMb: number
  /** Absolute path to the game dir (<userData>/game — see paths.ts). */
  gameDir: string
  /** Absolute path to the natives dir (<gameDir>/versions/<id>/natives — see natives.ts). */
  nativesDir: string
  /** Ordered list of jar paths; joined with `path.delimiter` for -cp. */
  classpath: string[]
  /** Player name from AuthManager (Gamertag / Xbox handle). */
  username: string
  /** Dashless UUID from AuthManager.getMinecraftToken(). */
  uuid: string
  /** Opaque Minecraft access token (JWT) from prismarine-auth. */
  accessToken: string
  /** Launcher version string; propagated to -Dminecraft.launcher.version. */
  launcherVersion: string
  /**
   * Phase 4 extension seam. Left undefined in Phase 3; Phase 4 will pass
   * `['--tweakClass', 'net.minecraftforge.fml.common.launcher.FMLTweaker']`
   * here and buildArgv will splice them after mainClass. Phase 3 buildArgv
   * deliberately IGNORES this input — the type hook is the seam.
   */
  forgeTweaks?: string[]
}

/**
 * Build the JVM-side argv fragment (everything before mainClass).
 *   - heap sizing (Xmx === Xms per RESEARCH.md §JVM argv for 1.8.9)
 *   - G1GC tuning block (4 flags)
 *   - system properties (java.library.path, launcher brand + version)
 *   - classpath (joined with platform delimiter — ';' win32, ':' darwin)
 */
export function buildJvmArgs(input: LaunchInputs): string[] {
  const { ramMb, nativesDir, classpath, launcherVersion } = input
  // path.delimiter is ';' on win32 and ':' on darwin/linux — exactly the
  // JVM's expected classpath separator. Do NOT hardcode ':' or ';' here;
  // that would silently break the other platform.
  const classpathStr = classpath.join(path.delimiter)
  return [
    `-Xmx${ramMb}M`,
    `-Xms${ramMb}M`,
    '-XX:+UseG1GC',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:G1HeapRegionSize=32M',
    '-XX:MaxGCPauseMillis=50',
    `-Djava.library.path=${nativesDir}`,
    '-Dminecraft.launcher.brand=wiiwho-launcher',
    `-Dminecraft.launcher.version=${launcherVersion}`,
    '-cp',
    classpathStr
  ]
}

/**
 * Build the game-side argv fragment (everything AFTER mainClass).
 *
 * All 9 `minecraftArguments` placeholders get substituted explicitly
 * (no regex). `--assetsDir` is derived from gameDir (not a separate input)
 * so callers can't accidentally point it somewhere else.
 *
 * @param _resolved  ResolvedVersion is accepted for shape-compatibility
 *                   with Phase 4 callers but not currently read — the
 *                   1.8.9 game-arg shape is invariant across any parsed
 *                   ResolvedVersion for this version (Mojang's manifest
 *                   has never shipped a different minecraftArguments
 *                   template for 1.8.9). Keeping the parameter in the
 *                   signature future-proofs Phase 4 without breaking
 *                   Plan 03-05's callsite.
 */
export function buildGameArgs(
  _resolved: ResolvedVersion,
  input: LaunchInputs
): string[] {
  const assetsDir = path.join(input.gameDir, 'assets')
  return [
    '--username',
    input.username,
    '--version',
    '1.8.9',
    '--gameDir',
    input.gameDir,
    '--assetsDir',
    assetsDir,
    '--assetIndex',
    VANILLA_ASSET_INDEX, // Pitfall 8 — NOT '1.8.9'
    '--uuid',
    input.uuid,
    '--accessToken',
    input.accessToken,
    '--userProperties',
    '{}', // literal '{}' — 1.8.9's expected value
    '--userType',
    MSA_USER_TYPE, // LCH-06 — NOT 'mojang'
    '--versionType',
    VANILLA_VERSION_TYPE
  ]
}

/**
 * Build the COMPLETE argv passed to `execa(javaBinary, argv)`.
 *
 * Order (RESEARCH.md §JVM argv for 1.8.9):
 *   1. JVM args (heap, GC, -D, -cp)
 *   2. mainClass (`net.minecraft.client.main.Main` — Pitfall 2)
 *   3. (Phase 4) forge tweaks — CURRENTLY IGNORED in Phase 3 even if supplied
 *   4. Game args
 *
 * Phase 3 behavior: `input.forgeTweaks` is read from the type but not
 * injected into the argv. This is deliberate — Phase 3 tests pin the
 * vanilla shape so Phase 4 can't accidentally regress the non-Forge
 * path by forgetting to branch on its tweaks input.
 */
export function buildArgv(
  resolved: ResolvedVersion,
  input: LaunchInputs
): string[] {
  // Phase 3: vanilla only. mainClass is hardcoded to the constant rather
  // than read from resolved.mainClass — the constant is the invariant we
  // want to pin; a corrupted manifest with `"mainClass": "launchwrapper.Launch"`
  // must NOT flip us into Forge mode in Phase 3.
  return [...buildJvmArgs(input), VANILLA_MAIN_CLASS, ...buildGameArgs(resolved, input)]
}
