// @vitest-environment node
/**
 * Canonical argv builder tests.
 *
 * Pins every vanilla-1.8.9 JVM-argv invariant documented in RESEARCH.md
 * §JVM argv for 1.8.9:
 *   - mainClass = `net.minecraft.client.main.Main`   (Pitfall 2)
 *   - --assetIndex = `1.8`  (NOT `1.8.9` — Pitfall 8)
 *   - --userType = `msa`    (NOT `mojang` — LCH-06)
 *   - --userProperties = literal `{}`
 *   - G1GC flag block (UseG1GC + UnlockExperimentalVMOptions + G1HeapRegionSize=32M + MaxGCPauseMillis=50)
 *   - Xmx === Xms (no mid-play heap resize)
 *   - brand = `wiiwho-launcher` + launcher.version from input
 *   - java.library.path = <nativesDir>
 *   - classpath uses platform `path.delimiter` (`;` win32, `:` darwin)
 *   - Full placeholder substitution (username, uuid, accessToken) — no `${...}` leak
 *   - NO Forge tokens (launchwrapper, FMLTweaker, --tweakClass) — Phase 3 is vanilla
 *   - Phase 4 extension point `forgeTweaks?: string[]` accepted but unused in Phase 3
 */

import { describe, expect, it } from 'vitest'
import path from 'node:path'
import type { ResolvedVersion } from '@xmcl/core'

import {
  buildArgv,
  buildGameArgs,
  buildJvmArgs,
  type LaunchInputs
} from './args'

const fakeResolved = {
  id: '1.8.9',
  mainClass: 'net.minecraft.client.main.Main',
  assetIndex: { id: '1.8', sha1: '', size: 0, totalSize: 0, url: '' },
  libraries: [],
  arguments: { game: [], jvm: [] },
  minecraftArguments:
    '--username ${auth_player_name} --version ${version_name} --gameDir ${game_directory} --assetsDir ${assets_root} --assetIndex ${assets_index_name} --uuid ${auth_uuid} --accessToken ${auth_access_token} --userProperties ${user_properties} --userType ${user_type}'
} as unknown as ResolvedVersion

function baseInputs(overrides: Partial<LaunchInputs> = {}): LaunchInputs {
  return {
    ramMb: 3072,
    gameDir: '/fake/game',
    nativesDir: '/fake/game/versions/1.8.9/natives',
    classpath: [
      '/fake/game/libraries/org/lwjgl/lwjgl-2.9.4/lwjgl-2.9.4.jar',
      '/fake/game/libraries/com/paulscode/codecjorbis-20101023.jar',
      '/fake/game/versions/1.8.9/1.8.9.jar'
    ],
    username: 'Wiiwho',
    uuid: 'abc123nodashes',
    accessToken: 'MCTOKEN123',
    launcherVersion: '0.1.0',
    ...overrides
  }
}

// Note: we originally stubbed `process.platform` to exercise both
// path-delimiter branches, but Node's `path` module caches `path.delimiter`
// at startup — stubbing process.platform does not retroactively re-derive
// the delimiter. Test 9 was rewritten to assert the CODE uses `path.delimiter`
// (source-level check) + to sanity-check the current host's delimiter.

describe('args.ts — buildArgv canonical vanilla 1.8.9', () => {
  it('Test 1 (mainClass — Pitfall 2): contains net.minecraft.client.main.Main and no launchwrapper/FMLTweaker', () => {
    const argv = buildArgv(fakeResolved, baseInputs())
    expect(argv).toContain('net.minecraft.client.main.Main')
    // Phase 3 is vanilla — Forge entry points must NOT appear
    expect(argv.join(' ')).not.toMatch(/launchwrapper/i)
    expect(argv.join(' ')).not.toMatch(/FMLTweaker/i)
    expect(argv).not.toContain('--tweakClass')
  })

  it('Test 2 (assetIndex — Pitfall 8): contains --assetIndex 1.8 as separate elements, never 1.8.9 at that slot', () => {
    const argv = buildArgv(fakeResolved, baseInputs())
    const idx = argv.indexOf('--assetIndex')
    expect(idx).toBeGreaterThan(-1)
    expect(argv[idx + 1]).toBe('1.8')
    // Pin against Pitfall 8: never 1.8.9 in that slot
    expect(argv[idx + 1]).not.toBe('1.8.9')
  })

  it('Test 3 (userType — LCH-06): contains --userType msa, never mojang', () => {
    const argv = buildArgv(fakeResolved, baseInputs())
    const idx = argv.indexOf('--userType')
    expect(idx).toBeGreaterThan(-1)
    expect(argv[idx + 1]).toBe('msa')
    expect(argv).not.toContain('mojang')
  })

  it('Test 4 (userProperties): argv contains --userProperties with literal {}', () => {
    const argv = buildArgv(fakeResolved, baseInputs())
    const idx = argv.indexOf('--userProperties')
    expect(idx).toBeGreaterThan(-1)
    expect(argv[idx + 1]).toBe('{}')
  })

  it('Test 5 (G1GC flags): argv contains all four G1 tuning flags from RESEARCH.md', () => {
    const argv = buildArgv(fakeResolved, baseInputs())
    expect(argv).toContain('-XX:+UseG1GC')
    expect(argv).toContain('-XX:+UnlockExperimentalVMOptions')
    expect(argv).toContain('-XX:G1HeapRegionSize=32M')
    expect(argv).toContain('-XX:MaxGCPauseMillis=50')
  })

  it('Test 6 (Xmx / Xms): for ramMb=3072 argv contains -Xmx3072M AND -Xms3072M (identical — no mid-play resize)', () => {
    const argv = buildArgv(fakeResolved, baseInputs({ ramMb: 3072 }))
    expect(argv).toContain('-Xmx3072M')
    expect(argv).toContain('-Xms3072M')
  })

  it('Test 7 (brand): argv contains wiiwho-launcher brand + launcher.version from input', () => {
    const argv = buildArgv(fakeResolved, baseInputs({ launcherVersion: '0.1.0' }))
    expect(argv).toContain('-Dminecraft.launcher.brand=wiiwho-launcher')
    expect(argv).toContain('-Dminecraft.launcher.version=0.1.0')
  })

  it('Test 8 (java.library.path): argv contains -Djava.library.path=<nativesDir>', () => {
    const nativesDir = '/fake/game/versions/1.8.9/natives'
    const argv = buildArgv(fakeResolved, baseInputs({ nativesDir }))
    expect(argv).toContain(`-Djava.library.path=${nativesDir}`)
  })

  /**
   * Classpath separator invariant is runtime-coupled to `path.delimiter`.
   * We can't meaningfully flip it via `Object.defineProperty(process, 'platform', ...)`
   * — Node's `path` module was already resolved at startup to the real OS
   * flavor. So we test the CODE invariant: the classpath string is
   * `classpath.join(path.delimiter)` for WHATEVER `path.delimiter` is on
   * the running host. Plan 03-05 on the correct target OS gets the correct
   * separator because the code reads from `path.delimiter` at invocation
   * time — not a hardcoded char.
   */
  it('Test 9 (classpath separator): uses path.delimiter for the running platform (; on win32, : on darwin)', () => {
    const argv = buildArgv(fakeResolved, baseInputs())
    const cpIdx = argv.indexOf('-cp')
    expect(cpIdx).toBeGreaterThan(-1)
    const cpValue = argv[cpIdx + 1]
    const inputs = baseInputs()
    // The classpath must equal `classpath.join(path.delimiter)` exactly.
    expect(cpValue).toBe(inputs.classpath.join(path.delimiter))
    // And therefore contains path.delimiter.
    expect(cpValue.includes(path.delimiter)).toBe(true)

    // Platform-sanity for the CURRENT host:
    if (process.platform === 'win32') {
      expect(path.delimiter).toBe(';')
      expect(cpValue.includes(';')).toBe(true)
    } else if (process.platform === 'darwin') {
      expect(path.delimiter).toBe(':')
      expect(cpValue.includes(':')).toBe(true)
    }
  })

  it('Test 9-source (classpath code uses path.delimiter): args.ts source contains path.delimiter, not hardcoded : or ;', async () => {
    // Source-level assertion — the INVARIANT that must hold across
    // platforms is that args.ts reads path.delimiter at runtime. A
    // hardcoded ';' or ':' in the build expression would be a bug.
    const fs = await import('node:fs')
    const src = fs.readFileSync(
      path.join(__dirname, 'args.ts'),
      'utf8'
    )
    expect(src).toContain('path.delimiter')
    // Negative: no hardcoded "';'" or "':'" in join calls.
    expect(src).not.toMatch(/classpath\.join\(['"];['"]\)/)
    expect(src).not.toMatch(/classpath\.join\(['"]:['"]\)/)
  })

  it('Test 10 (placeholder substitution): explicit values flow through, no ${...} leak', () => {
    const argv = buildArgv(
      fakeResolved,
      baseInputs({
        username: 'Wiiwho',
        uuid: 'abc123nodashes',
        accessToken: 'MCTOKEN123'
      })
    )

    const joined = argv.join(' ')
    expect(joined).not.toMatch(/\$\{[^}]+\}/) // no unsubstituted templates

    const uIdx = argv.indexOf('--username')
    expect(argv[uIdx + 1]).toBe('Wiiwho')
    const uuIdx = argv.indexOf('--uuid')
    expect(argv[uuIdx + 1]).toBe('abc123nodashes')
    const atIdx = argv.indexOf('--accessToken')
    expect(argv[atIdx + 1]).toBe('MCTOKEN123')

    // --version 1.8.9 is hardcoded — NOT a placeholder anymore
    const vIdx = argv.indexOf('--version')
    expect(argv[vIdx + 1]).toBe('1.8.9')

    // assetsDir derived from gameDir — ends in /assets (normalized)
    const adIdx = argv.indexOf('--assetsDir')
    const assetsDir = argv[adIdx + 1].replace(/\\/g, '/')
    expect(assetsDir.endsWith('/assets')).toBe(true)
  })

  it('Test 11 (no Forge tokens): argv does not contain coremods / forge / --tweakClass', () => {
    const argv = buildArgv(fakeResolved, baseInputs())
    const joined = argv.join(' ')
    expect(joined).not.toMatch(/coremods/i)
    expect(joined).not.toMatch(/FMLTweaker/i)
    expect(argv).not.toContain('--tweakClass')
    expect(joined).not.toMatch(/launchwrapper/i)
  })

  it('Test 12 (Phase 4 extension seam): forgeTweaks?: string[] parameter exists — Phase 3 omits it without regression', () => {
    // Phase 3 call shape — no forgeTweaks key, exact vanilla argv.
    const argv = buildArgv(fakeResolved, baseInputs())
    // The parameter is OPTIONAL — compile-level assertion via the type import.
    // Runtime assertion: Phase 3 argv + an explicit forgeTweaks: [] are identical
    // (empty array === no tweaks added).
    const argvEmptyTweaks = buildArgv(
      fakeResolved,
      baseInputs({ forgeTweaks: [] })
    )
    expect(argvEmptyTweaks).toEqual(argv)

    // Pinning the type shape: this line must compile. If Phase 4 removes
    // the extension point, this line breaks.
    const _phase4Stub: LaunchInputs = baseInputs({
      forgeTweaks: ['net.minecraftforge.fml.common.launcher.FMLTweaker']
    })
    // Phase 3 argv must NOT reflect the Phase 4 tweaks even if provided —
    // the extension point is recognized in the type but Phase 3's buildArgv
    // ignores it. (Phase 4 will wire it in.)
    const argvIgnoredTweaks = buildArgv(fakeResolved, _phase4Stub)
    expect(argvIgnoredTweaks).not.toContain('--tweakClass')
    expect(argvIgnoredTweaks.join(' ')).not.toMatch(/FMLTweaker/i)
  })

  it('buildJvmArgs returns only the jvm-side flags (no mainClass, no game args)', () => {
    const jvm = buildJvmArgs(baseInputs())
    expect(jvm).not.toContain('net.minecraft.client.main.Main')
    expect(jvm).not.toContain('--username')
    // Ends with -cp <classpath>
    expect(jvm[jvm.length - 2]).toBe('-cp')
  })

  it('buildGameArgs returns only the game-side args (no jvm flags, no mainClass)', () => {
    const game = buildGameArgs(fakeResolved, baseInputs())
    expect(game).not.toContain('-Xmx3072M')
    expect(game).not.toContain('-XX:+UseG1GC')
    expect(game).not.toContain('net.minecraft.client.main.Main')
    expect(game[0]).toBe('--username')
  })
})
