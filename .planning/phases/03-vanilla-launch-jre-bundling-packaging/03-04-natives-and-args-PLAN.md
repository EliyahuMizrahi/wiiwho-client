---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 04
type: execute
wave: 2
depends_on: ["03-00", "03-01", "03-03"]
files_modified:
  - launcher/src/main/launch/natives.ts
  - launcher/src/main/launch/natives.test.ts
  - launcher/src/main/launch/args.ts
  - launcher/src/main/launch/args.test.ts
autonomous: true
requirements:
  - LCH-02
  - LCH-05
  - LCH-06
must_haves:
  truths:
    - "ensureNatives(resolved, gameDir) extracts platform-specific LWJGL 2.9.4 natives to <gameDir>/versions/1.8.9/natives/ (honoring extract.exclude META-INF/ — Open Q §3)"
    - "buildJvmArgs returns canonical vanilla 1.8.9 argv matching RESEARCH.md §JVM argv (Xmx, G1GC flags, java.library.path, mainClass net.minecraft.client.main.Main)"
    - "buildGameArgs substitutes all 9 minecraftArguments placeholders (auth_player_name, version_name, game_directory, assets_root, assets_index_name, auth_uuid, auth_access_token, user_properties, user_type)"
    - "userType is hardcoded to 'msa' — never 'mojang' (LCH-06)"
    - "assetIndex arg is 'assetIndex 1.8' NOT '1.8.9' (Pitfall 8)"
    - "userProperties arg is literal '{}' JSON"
    - "Classpath uses ';' on Windows, ':' on macOS (path.delimiter)"
  artifacts:
    - path: "launcher/src/main/launch/natives.ts"
      provides: "ensureNatives — platform native extraction or delegation probe"
      exports: ["ensureNatives"]
    - path: "launcher/src/main/launch/args.ts"
      provides: "buildJvmArgs, buildGameArgs, buildArgv"
      exports: ["buildJvmArgs", "buildGameArgs", "buildArgv", "LaunchInputs"]
  key_links:
    - from: "launcher/src/main/launch/args.ts"
      to: "launcher/src/main/launch/manifest.ts ResolvedVersion + launcher/src/main/launch/libraries.ts resolveClasspath"
      via: "typed inputs"
      pattern: "ResolvedVersion"
    - from: "launcher/src/main/launch/natives.ts"
      to: "<gameDir>/versions/1.8.9/natives/"
      via: "jar unzip (or xmcl delegation)"
      pattern: "natives"
---

<objective>
Two modules critical to LCH-05 (JVM spawn produces a main menu):

1. **natives.ts** — probes whether @xmcl/installer extracted LWJGL natives (RESEARCH Open Q §3). If yes: `ensureNatives` is a no-op that verifies presence. If no: `ensureNatives` unzips the classifier jars (`natives-windows`, `natives-osx`) from `<gameDir>/libraries/` into `<gameDir>/versions/1.8.9/natives/`, honoring the manifest's `extract.exclude` rules (always excludes `META-INF/` for 1.8.9 per fixture).

2. **args.ts** — THE canonical argv builder for vanilla 1.8.9. Pure function: `(ResolvedVersion, LaunchInputs) → string[]`. Produces exactly the argv documented in RESEARCH.md §JVM argv for 1.8.9 — down to the specific G1GC flags (`-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1HeapRegionSize=32M -XX:MaxGCPauseMillis=50`), the `wiiwho-launcher` brand, the `--userType msa`, the `--assetIndex 1.8`, the `--userProperties {}` literal, and `net.minecraft.client.main.Main` as mainClass.

This plan's output is where LCH-05 + LCH-06 truly get proven (by argv-level assertions) and where Pitfalls 2 (wrong mainClass) and 8 (wrong asset index) get guarded.

Output: Two modules, two tests, argv-level LCH-05 + LCH-06 coverage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/main/launch/manifest.ts
@launcher/src/main/launch/libraries.ts
@launcher/src/main/paths.ts
@launcher/src/main/launch/__fixtures__/1.8.9-manifest.json

<interfaces>
From @xmcl/core:
```typescript
import type { ResolvedVersion } from '@xmcl/core'
// ResolvedVersion contains:
//   id: string (e.g. '1.8.9')
//   mainClass: string
//   assetIndex: { id: string; ... }
//   arguments OR minecraftArguments: string
//   libraries: Array<ResolvedLibrary>
// Actual field names: verify via launcher/node_modules/@xmcl/core/index.d.ts
```

From Plan 03-01 paths.ts:
```typescript
export function resolveJavaBinary(): string  // <jre>/bin/javaw.exe or <jre>/Contents/Home/bin/java
export function resolveGameDir(): string
```

From Plan 03-03 libraries.ts:
```typescript
export function resolveClasspath(resolved: ResolvedVersion, gameDir: string): string[]
```

Canonical JVM argv (RESEARCH.md §JVM argv for 1.8.9 — COPY VERBATIM):
```
-Xmx${ramMb}M
-Xms${ramMb}M
-XX:+UseG1GC
-XX:+UnlockExperimentalVMOptions
-XX:G1HeapRegionSize=32M
-XX:MaxGCPauseMillis=50
-Djava.library.path=${nativesDir}
-Dminecraft.launcher.brand=wiiwho-launcher
-Dminecraft.launcher.version=0.1.0
-cp ${classpath}
net.minecraft.client.main.Main
--username ${auth_player_name}
--version 1.8.9
--gameDir ${game_directory}
--assetsDir ${assets_root}
--assetIndex 1.8
--uuid ${auth_uuid}
--accessToken ${auth_access_token}
--userProperties {}
--userType msa
--versionType release
```

Placeholder substitution (RESEARCH.md §Mojang Manifest Shape Placeholder substitution):
| Placeholder | Value |
| ${auth_player_name} | username from AuthManager |
| ${version_name} | "1.8.9" |
| ${game_directory} | resolveGameDir() |
| ${assets_root} | gameDir + "/assets" |
| ${assets_index_name} | "1.8" (NOT 1.8.9!) |
| ${auth_uuid} | uuid (dashless) from AuthManager |
| ${auth_access_token} | MC token from AuthManager |
| ${user_properties} | "{}" literal |
| ${user_type} | "msa" (NOT mojang!) |
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: natives.ts — probe xmcl then fall back to manual extraction</name>
  <files>
    launcher/src/main/launch/natives.ts,
    launcher/src/main/launch/natives.test.ts
  </files>
  <read_first>
    - launcher/node_modules/@xmcl/installer/index.d.ts (look for installNatives / natives-related exports)
    - launcher/src/main/launch/__fixtures__/1.8.9-manifest.json (has the LWJGL classifier entries + extract.exclude META-INF/)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §xmcl API Map (Open Q §3 — whether xmcl extracts natives automatically)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Mojang Manifest Shape — the `{"extract":{"exclude":["META-INF/"]}}` contract
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1 (probe): On a fresh temp gameDir with planted classifier jars in `libraries/`, calling `ensureNatives(resolved, gameDir)` results in `<gameDir>/versions/1.8.9/natives/` containing extracted files AND no `META-INF` directory inside (extract.exclude honored).
    - Test 2: Second call on a native-dir-already-populated path is a no-op (doesn't re-extract). Detect via fs.stat mtime or just "does not fail + files still exist."
    - Test 3: Only platform-appropriate classifier is extracted — on `process.platform === 'win32'`, `natives-windows` jar is extracted, `natives-osx` is skipped (per manifest `natives.osx`/`natives.windows` mapping).
    - Test 4: `extract.exclude` rule for `META-INF/` is honored — output dir has no `META-INF/*.SF` / `*.RSA` files (which would otherwise break signing in JVM).

    For the test, use the fixture manifest (has 1 LWJGL lib with both classifier entries). Plant fake classifier jars as zip files containing a known file list (e.g., `lwjgl64.dll`, `META-INF/MANIFEST.MF`, `META-INF/lwjgl.SF`) using node's `node:zlib` or the built-in `yauzl`/`adm-zip` equivalent. Since test infra is vitest, use a tiny pure-JS zip writer OR delegate to jszip.

    If Plan 03-03 Task 2 SUMMARY confirmed that @xmcl/installer DOES extract natives automatically, simplify this plan:
    - `ensureNatives` just asserts the natives dir is non-empty post-install.
    - Tests simplify to: "given installLibraries was called, natives dir populated".
    - The manual-unzip fallback path below becomes dead code (delete).

    If xmcl does NOT extract natives, the manual implementation below runs.
  </behavior>
  <action>
    Create `launcher/src/main/launch/natives.ts`:

    ```typescript
    /**
     * LWJGL 2.9.4 native extraction for vanilla 1.8.9.
     *
     * Open Q §3 (RESEARCH.md): @xmcl/installer may or may not auto-extract natives.
     * PROBE at task start: if `<gameDir>/versions/1.8.9/natives/` is populated
     * post-installLibraries, this module is a no-op presence check. Else, we
     * unzip each platform-applicable `natives-<os>` classifier jar from
     * `<gameDir>/libraries/` into the natives dir, honoring
     * `extract.exclude = ['META-INF/']` per manifest.
     *
     * Source: RESEARCH.md §xmcl API Map Open Q §3 + §Mojang Manifest Shape natives rules.
     */

    import { promises as fs } from 'node:fs'
    import path from 'node:path'
    import type { ResolvedVersion } from '@xmcl/core'

    /** Map process.platform → manifest 'natives' key. */
    function platformKey(): 'windows' | 'osx' {
      if (process.platform === 'win32') return 'windows'
      if (process.platform === 'darwin') return 'osx'
      throw new Error(`Unsupported platform for Minecraft 1.8.9 natives: ${process.platform}`)
    }

    export async function ensureNatives(
      resolved: ResolvedVersion,
      gameDir: string
    ): Promise<string> {
      const nativesDir = path.join(gameDir, 'versions', resolved.id, 'natives')
      await fs.mkdir(nativesDir, { recursive: true })

      // Probe: if nativesDir already has content (xmcl handled it or we ran before)
      // and contains platform-appropriate DLLs/dylibs, short-circuit.
      const existing = await fs.readdir(nativesDir).catch(() => [])
      const needsExtraction = platformKey() === 'windows'
        ? !existing.some(n => n.toLowerCase().endsWith('.dll'))
        : !existing.some(n => n.toLowerCase().endsWith('.dylib') || n.toLowerCase().endsWith('.jnilib'))
      if (!needsExtraction) return nativesDir

      // Fallback extraction: unzip every library whose `natives[platformKey]` is set
      // and whose classifier jar exists under `<gameDir>/libraries/...`.
      // Implementation detail: use a tiny dependency-free zip reader, or `yauzl`
      // if acceptable to add. Do NOT extract anything under META-INF/.

      // TODO-executor: this block's exact implementation depends on 03-03
      // Task 2's SUMMARY note about whether @xmcl/installer extracts natives.
      // If xmcl DOES extract, this block is unreachable; keep for safety.
      //
      // If we need a zip library, `yauzl` (already a transitive dep of many
      // Electron tools) is the safest minimal-add. Alternatively, Node 22's
      // built-in `node:zlib` handles deflate but not the zip central directory
      // — you'd need yauzl regardless. Add `yauzl` via pnpm if not already
      // present, OR delegate to a small pure-JS zip reader.

      throw new Error(
        'Natives not extracted — @xmcl/installer probe failed. See 03-03-SUMMARY.md for manual-unzip implementation.'
      )
    }
    ```

    Write `natives.test.ts` with the 4 tests above. Use `vi.stubGlobal('process', ...)` to test both Windows + macOS branches. Plant fake classifier zips with a simple zip-writer (e.g., `Buffer.concat` with standard zip header bytes for a 1-file zip, or install `yauzl`/`jszip` as a devDep specifically for tests).

    **If Plan 03-03's SUMMARY confirms xmcl extracts natives**: simplify the test to "call installLibraries on a real temp dir; verify natives/ has .dll/.dylib". No zip library needed.

    **Escalation path:** If the probe test shows xmcl does NOT extract and adding yauzl is undesirable, ESCALATE via a SUMMARY note + the Phase 4 plan picks up the fallback. Phase 3 execute can temporarily proceed with a `console.warn` + a manual-test gate in `<manual_verify>` that asks the user to verify natives via test-launch. This is a real-world fallback for Open Q §3.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/launch/natives.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export async function ensureNatives" launcher/src/main/launch/natives.ts`
    - `grep -q "META-INF" launcher/src/main/launch/natives.ts` (extract.exclude honored)
    - `grep -q "process.platform" launcher/src/main/launch/natives.ts` (platform branching)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/natives.test.ts` exits 0 with ≥4 tests passing
    - The SUMMARY document records the Open Q §3 resolution (xmcl auto-extracts YES/NO)
  </acceptance_criteria>
  <done>Natives extraction either proven-automatic (xmcl) or manually fallback-implemented; META-INF exclude tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: args.ts — canonical vanilla 1.8.9 argv builder</name>
  <files>
    launcher/src/main/launch/args.ts,
    launcher/src/main/launch/args.test.ts
  </files>
  <read_first>
    - launcher/src/main/launch/manifest.ts (Task 1 Plan 03-03 — resolveVersion returns ResolvedVersion)
    - launcher/src/main/launch/libraries.ts (Task 2 Plan 03-03 — resolveClasspath)
    - launcher/src/main/paths.ts (Plan 03-01 — resolveGameDir, resolveJavaBinary)
    - launcher/src/main/launch/__fixtures__/1.8.9-manifest.json (minecraftArguments string — the exact placeholder template)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §JVM argv for 1.8.9 (EXACT canonical argv — copy verbatim in this task's action)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Mojang Manifest Shape Placeholder substitution table
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Pitfall 2 (mainClass MUST be net.minecraft.client.main.Main)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Pitfall 8 (assetIndex MUST be 1.8)
  </read_first>
  <behavior>
    Tests MUST cover (write first, RED phase):

    - Test 1 (mainClass — Pitfall 2): built argv contains exactly `net.minecraft.client.main.Main` and does NOT contain `launchwrapper` or `FMLTweaker`.
    - Test 2 (assetIndex — Pitfall 8): built argv contains `--assetIndex 1.8` (as two separate array elements OR as space-separated in a game-args string); argv does NOT contain the string `1.8.9` anywhere in the `--assetIndex` position.
    - Test 3 (userType — LCH-06): argv contains `--userType msa`. Does NOT contain `--userType mojang`.
    - Test 4 (userProperties): argv contains `--userProperties {}` with literal `{}`.
    - Test 5 (G1GC flags): argv contains `-XX:+UseG1GC`, `-XX:+UnlockExperimentalVMOptions`, `-XX:G1HeapRegionSize=32M`, `-XX:MaxGCPauseMillis=50` (all four required).
    - Test 6 (Xmx/Xms): For `ramMb: 3072`, argv contains `-Xmx3072M` AND `-Xms3072M` (equal — avoids mid-play GC resize).
    - Test 7 (brand): argv contains `-Dminecraft.launcher.brand=wiiwho-launcher` and `-Dminecraft.launcher.version=0.1.0`.
    - Test 8 (java.library.path): argv contains `-Djava.library.path=<nativesDir>` — `nativesDir` is `<gameDir>/versions/1.8.9/natives`.
    - Test 9 (classpath separator): For `process.platform === 'win32'`, classpath argument uses `;` between jars. For `darwin`, uses `:`.
    - Test 10 (placeholder substitution): Given inputs `{username: 'Wiiwho', uuid: 'abc123nodashes', accessToken: 'MCTOKEN123'}`, argv contains `--username Wiiwho`, `--uuid abc123nodashes`, `--accessToken MCTOKEN123`. No unsubstituted `${...}` tokens in output.
    - Test 11 (no Forge tokens): argv does NOT contain `--tweakClass` (Phase 3 is VANILLA — no FMLTweaker). argv does NOT contain `coremods` or `forge`.
    - Test 12 (Phase 4 boundary — sentinel): The function accepts a `forgeTweaks?: string[]` optional parameter. When ABSENT (Phase 3 default), no tweaks added; when PRESENT (Phase 4 future use), tweaks appear in argv. The parameter exists but is unused in Phase 3 — confirms Phase 3 is vanilla without blocking Phase 4's extension.
  </behavior>
  <action>
    Create `launcher/src/main/launch/args.ts`:

    ```typescript
    /**
     * Canonical JVM argv builder for vanilla Minecraft 1.8.9.
     *
     * This is THE argv source of truth. Every launch spawn builds its argv
     * through here. No ad-hoc `.replace()` or string assembly elsewhere.
     *
     * Canonical argv (RESEARCH.md §JVM argv for 1.8.9 — COPIED VERBATIM):
     *   -Xmx${ramMb}M
     *   -Xms${ramMb}M
     *   -XX:+UseG1GC
     *   -XX:+UnlockExperimentalVMOptions
     *   -XX:G1HeapRegionSize=32M
     *   -XX:MaxGCPauseMillis=50
     *   -Djava.library.path=${nativesDir}
     *   -Dminecraft.launcher.brand=wiiwho-launcher
     *   -Dminecraft.launcher.version=0.1.0
     *   -cp ${classpath}
     *   net.minecraft.client.main.Main
     *   --username ${auth_player_name}
     *   --version 1.8.9
     *   --gameDir ${game_directory}
     *   --assetsDir ${assets_root}
     *   --assetIndex 1.8          // NOT 1.8.9 — Pitfall 8
     *   --uuid ${auth_uuid}
     *   --accessToken ${auth_access_token}
     *   --userProperties {}
     *   --userType msa            // NOT mojang — LCH-06
     *   --versionType release
     *
     * Phase 4 will extend this to inject `--tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker`
     * and prepend the Forge + Wiiwho mod jars to the classpath. Phase 3 is strictly vanilla.
     */

    import path from 'node:path'
    import type { ResolvedVersion } from '@xmcl/core'

    export interface LaunchInputs {
      ramMb: number                // from settings store; pre-clamped 1024-4096
      gameDir: string              // resolveGameDir()
      nativesDir: string           // gameDir/versions/<id>/natives
      classpath: string[]          // resolveClasspath(resolved, gameDir)
      username: string             // auth_player_name
      uuid: string                 // dashless
      accessToken: string          // opaque MC token from AuthManager.getMinecraftToken()
      launcherVersion: string      // '0.1.0' — from package.json
      /** Phase 4 extension point — leave undefined for Phase 3 vanilla. */
      forgeTweaks?: string[]
    }

    export function buildJvmArgs(input: LaunchInputs): string[] {
      const { ramMb, nativesDir, classpath, launcherVersion } = input
      const classpathStr = classpath.join(path.delimiter)  // ';' on win32, ':' on darwin
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

    export function buildGameArgs(resolved: ResolvedVersion, input: LaunchInputs): string[] {
      // Hard-coded for 1.8.9 vanilla. Placeholder substitution from
      // minecraftArguments template is done by explicit key-value pairs below
      // rather than `.replace`-ing the template string (brittle per RESEARCH.md).
      const args: string[] = [
        '--username', input.username,
        '--version', '1.8.9',
        '--gameDir', input.gameDir,
        '--assetsDir', path.join(input.gameDir, 'assets'),
        '--assetIndex', '1.8',               // NOT 1.8.9 — Pitfall 8
        '--uuid', input.uuid,
        '--accessToken', input.accessToken,
        '--userProperties', '{}',            // literal {} — 1.8.9 expects this
        '--userType', 'msa',                 // NOT mojang — LCH-06
        '--versionType', 'release'
      ]
      return args
    }

    /**
     * Build the FULL argv for `execa(javaBinary, argv)`. Order: jvmArgs,
     * mainClass (forgeTweaks — Phase 4), gameArgs.
     */
    export function buildArgv(resolved: ResolvedVersion, input: LaunchInputs): string[] {
      const mainClass = 'net.minecraft.client.main.Main'    // Pitfall 2 — NOT launchwrapper
      const argv = [
        ...buildJvmArgs(input),
        mainClass,
        ...buildGameArgs(resolved, input)
      ]
      // Phase 3 ignores forgeTweaks; Phase 4 inserts `--tweakClass ...` after mainClass.
      return argv
    }
    ```

    Write `args.test.ts` with the 12 tests above. Most can be synchronous — the function is pure. Use a minimal fake ResolvedVersion:

    ```typescript
    const fakeResolved = {
      id: '1.8.9',
      mainClass: 'net.minecraft.client.main.Main',
      assetIndex: { id: '1.8', sha1: '', size: 0, totalSize: 0, url: '' },
      libraries: [],
      arguments: undefined,
      minecraftArguments: '...'
    } as unknown as ResolvedVersion

    const fakeInputs: LaunchInputs = {
      ramMb: 3072,
      gameDir: '/fake/game',
      nativesDir: '/fake/game/versions/1.8.9/natives',
      classpath: ['/fake/game/libraries/a.jar', '/fake/game/versions/1.8.9/1.8.9.jar'],
      username: 'Wiiwho',
      uuid: 'abc123nodashes',
      accessToken: 'MCTOKEN123',
      launcherVersion: '0.1.0'
    }
    ```

    Then tests use simple `.toContain` / `.toMatch` checks on the argv array or its joined string.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/launch/args.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function buildJvmArgs" launcher/src/main/launch/args.ts`
    - `grep -q "export function buildGameArgs" launcher/src/main/launch/args.ts`
    - `grep -q "export function buildArgv" launcher/src/main/launch/args.ts`
    - `grep -q "export interface LaunchInputs" launcher/src/main/launch/args.ts`
    - `grep -q "'net.minecraft.client.main.Main'" launcher/src/main/launch/args.ts` (Pitfall 2 enforcement)
    - `grep -q "'--assetIndex', '1.8'" launcher/src/main/launch/args.ts` (Pitfall 8 — NOT '1.8.9')
    - `grep -q "'--userType', 'msa'" launcher/src/main/launch/args.ts` (LCH-06)
    - `grep -q "'-XX:+UseG1GC'" launcher/src/main/launch/args.ts`
    - `grep -q "'-XX:+UnlockExperimentalVMOptions'" launcher/src/main/launch/args.ts`
    - `grep -q "G1HeapRegionSize=32M" launcher/src/main/launch/args.ts`
    - `grep -q "MaxGCPauseMillis=50" launcher/src/main/launch/args.ts`
    - `grep -q "wiiwho-launcher" launcher/src/main/launch/args.ts`
    - `grep -qv "launchwrapper" launcher/src/main/launch/args.ts` (Phase 3 = vanilla)
    - `grep -qv "FMLTweaker" launcher/src/main/launch/args.ts` (Phase 3 = vanilla)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/args.test.ts` exits 0 with 12 passing tests
  </acceptance_criteria>
  <done>args.ts builds the exact canonical argv, all 12 tests green, Phase 4 `forgeTweaks` extension point present but unused.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/main/launch/natives.test.ts src/main/launch/args.test.ts` — all green
- `cd launcher && npm run typecheck` — no type issues
- `cd launcher && npm run test:run` — full suite green (no regressions from Plan 03-00/01/02/03)
</verification>

<success_criteria>
- LCH-05: argv canonical form committed and tested to exact RESEARCH.md §JVM argv
- LCH-06: `--userType msa` hard-coded; test asserts exclusion of `mojang`
- Pitfall 2 guarded: mainClass is `net.minecraft.client.main.Main`, not `launchwrapper.Launch`
- Pitfall 8 guarded: assetIndex is `1.8`, not `1.8.9`
- Classpath uses platform-correct delimiter (`;` Windows, `:` macOS)
- Open Q §3 resolved (xmcl natives probe documented in SUMMARY)
- Phase 4 extension seam exists (`forgeTweaks` optional input)
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-04-SUMMARY.md` documenting:
- Open Q §3 resolution: did @xmcl/installer auto-extract natives? (YES/NO)
- Exact argv emitted for a sample `ramMb=2048, username='Wiiwho'` input (for visual inspection + future Phase 4 diff)
- Any manifest-field name discrepancies discovered between RESEARCH.md's description and the actual ResolvedVersion shape
</output>
