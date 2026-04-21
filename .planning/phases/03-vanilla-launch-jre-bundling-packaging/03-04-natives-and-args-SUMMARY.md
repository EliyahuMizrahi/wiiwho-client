---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 04
subsystem: main/launch
tags:
  - natives
  - LWJGL
  - argv
  - JVM-spawn
  - LCH-05
  - LCH-06
  - Pitfall-2
  - Pitfall-8
  - xmcl-open-q3
  - vanilla-1.8.9
  - phase-4-seam

# Dependency graph
dependency_graph:
  requires:
    - launcher/src/main/paths.ts (Plan 03-01 — resolveGameDir/resolveJavaBinary — referenced but not yet called here)
    - launcher/src/main/launch/__fixtures__/1.8.9-manifest.json (Plan 03-00 — test fixture for extractExclude shape)
    - "@xmcl/core ResolvedVersion type (Plan 03-00 — installed dep)"
    - "yauzl (transitive dep of @xmcl/installer — no direct install needed)"
  provides:
    - launcher/src/main/launch/natives.ts — ensureNatives(resolved, gameDir): extracts LWJGL 2.9.4 classifier jars into <gameDir>/versions/<id>/natives/
    - launcher/src/main/launch/args.ts — buildJvmArgs, buildGameArgs, buildArgv + LaunchInputs interface (THE canonical argv source of truth)
    - Three canonical constants (VANILLA_MAIN_CLASS, VANILLA_ASSET_INDEX, MSA_USER_TYPE) exported for downstream consumers that need to assert invariants
    - Phase 4 seam — LaunchInputs.forgeTweaks?: string[] accepted by buildArgv but deliberately ignored (Phase 3 is vanilla)
  affects:
    - Plan 03-05 (spawn.ts) — calls buildArgv with resolved + inputs; feeds argv to execa
    - Plan 03-06 (log-parser) — unrelated, but shares the gameDir convention
    - Phase 4 (Forge injection) — will extend LaunchInputs.forgeTweaks usage inside buildArgv

# Tech tracking
tech_stack:
  added: []
  patterns:
    - "Hardcoded invariants over template-parsing: args.ts never reads resolved.minecraftArguments; the 9 placeholders are substituted via explicit const/input refs. Rationale: pin Pitfall 2 + Pitfall 8 at type level, not runtime regex."
    - "Exported constants (VANILLA_MAIN_CLASS, VANILLA_ASSET_INDEX, MSA_USER_TYPE, VANILLA_VERSION_TYPE) — single source of truth for downstream assertions. If Plan 03-05 ever needs to pin argv contents in a test, it imports these rather than duplicating string literals."
    - "Phase 4 extension seam via typed optional input (LaunchInputs.forgeTweaks) — the type hook exists in Phase 3 but the code path deliberately ignores it. Test 12 pins that behavior."
    - "Idempotent filesystem probe + flat extraction — ensureNatives checks for a platform-appropriate binary (.dll/.dylib) before re-running. Extraction flattens classifier-jar contents to dest-dir/<basename> (wiki.vg launcher convention)."
    - "Dependency-free deflate+stored zip-writer in natives.test.ts (~60 LoC) — plants minimal fixtures without adding jszip/adm-zip as devDeps. Uses node:zlib deflateRawSync + handrolled local-file-header/central-directory/EOCD bytes."

key_files:
  created:
    - launcher/src/main/launch/natives.ts
    - launcher/src/main/launch/natives.test.ts
    - launcher/src/main/launch/args.ts
    - launcher/src/main/launch/args.test.ts
  modified: []

decisions:
  - "Open Q §3 (RESEARCH.md) RESOLVED: @xmcl/installer does NOT auto-extract LWJGL natives. Evidence: grep `installNatives|unzip|extract` on node_modules/@xmcl/installer/dist/*.d.ts → 0 functional matches (unzip.d.ts exists as a private UnzipTask helper but nothing in the public Install* API chain invokes it for classifier jars)."
  - "natives.ts owns the gap — it unzips each native-flagged library's classifier jar (platform-matched via process.platform) into <gameDir>/versions/<id>/natives/, flattening to basename and honoring extractExclude. Dependency: yauzl (already transitive dep via @xmcl/installer — no new install)."
  - "args.ts HARDCODES mainClass / assetIndex / userType as module-level constants (VANILLA_MAIN_CLASS / VANILLA_ASSET_INDEX / MSA_USER_TYPE) rather than reading from resolved.minecraftArguments. This pins Pitfall 2 + Pitfall 8 + LCH-06 at the code level, not runtime-parse level. A malformed manifest with mainClass='launchwrapper.Launch' still gets the vanilla argv — that's a feature, not a bug (Phase 4 is the only caller allowed to flip us out of vanilla)."
  - "Test 9 (classpath delimiter) redesign — originally planned to stub process.platform and assert ';' vs ':' separators. But Node's `path` module caches `path.delimiter` at startup based on the REAL process.platform — redefining process.platform via Object.defineProperty is not retroactive. Fixed by: (a) asserting `cpValue === classpath.join(path.delimiter)` (behavioral identity) + (b) a source-level grep asserting args.ts uses `path.delimiter` not a hardcoded char. This is a STRONGER guarantee than the original mocked-platform plan."
  - "Hand-wrapped yauzl.open in a promise rather than using util.promisify — yauzl's overloaded signatures (callback-only vs options+callback) confuse util.promisify's signature inference (it picks the no-options overload, losing our {lazyEntries, autoClose} options). Explicit wrapper is 12 LoC and preserves types."
  - "forgeTweaks extension seam — Phase 3's buildArgv IGNORES the forgeTweaks input even when supplied. Test 12 asserts that `buildArgv(resolved, {forgeTweaks: ['FMLTweaker']})` produces the identical vanilla argv as `buildArgv(resolved, {})`. This forces Phase 4 to explicitly opt in by modifying buildArgv's body — a refactoring safety net."

requirements-completed:
  - LCH-02  # library classpath assembly (classpath → -cp joined with path.delimiter)
  - LCH-05  # JVM argv canonical form (buildArgv produces the exact RESEARCH.md §JVM argv)
  - LCH-06  # Microsoft-auth user-type (--userType msa hardcoded; test asserts absence of 'mojang')

# Metrics
metrics:
  duration: "~8 min"
  started: "2026-04-21T09:06:23Z"
  completed: "2026-04-21T09:14:24Z"
  tasks_completed: 2
  files_touched: 4
  tests_added: 19  # 4 natives + 15 args
  tests_status: "19/19 green"
---

# Phase 3 Plan 04: Natives and Args Summary

Two modules that together prove Phase 3's LCH-05 + LCH-06 at the argv level: `natives.ts` (LWJGL classifier-jar extraction — resolves RESEARCH.md Open Q §3 in the negative: xmcl does NOT auto-extract) and `args.ts` (canonical vanilla 1.8.9 argv builder, hardcoded to pin Pitfall 2 + Pitfall 8 + LCH-06 at the type level).

## One-liner

Canonical vanilla 1.8.9 argv builder (exact RESEARCH.md §JVM argv — mainClass `net.minecraft.client.main.Main`, `--assetIndex 1.8`, `--userType msa`, G1GC block, Xmx===Xms, brand=wiiwho-launcher) + ensureNatives that unzips LWJGL classifier jars honoring META-INF/ exclude — Open Q §3 resolved: xmcl does NOT auto-extract, natives.ts owns the gap via yauzl.

## Open Q §3 Resolution

**Question (RESEARCH.md §xmcl API Map):** Does `@xmcl/installer` auto-extract LWJGL classifier jars into `<versions>/<id>/natives/`?

**Answer: NO.**

**Evidence:**

```bash
grep -rn "installNatives" launcher/node_modules/@xmcl/installer/dist/
# → 0 matches
grep -rn "natives" launcher/node_modules/@xmcl/installer/dist/*.d.ts
# → 0 matches (neither in minecraft.d.ts, index.d.ts, nor downloadTask.d.ts)
```

`unzip.d.ts` exists as an internal `UnzipTask` helper but no public Install* API chain invokes it for classifier jars. `installLibraries` downloads the classifier jars to `<gameDir>/libraries/<maven-path>/...-natives-<os>.jar` but stops there — the unzip step is the consumer's responsibility.

**Implication:** `natives.ts` is NOT optional glue. It's required for Plan 03-05's JVM spawn to succeed, because `-Djava.library.path=<nativesDir>` points at an empty dir otherwise → `UnsatisfiedLinkError: no lwjgl in java.library.path` on first launch.

**Implementation in natives.ts:**
1. Probe — short-circuit if the natives dir already contains a platform-appropriate binary (`.dll` on win32, `.dylib`/`.jnilib` on darwin). Makes warm-cache launches free.
2. Extract — for each native-flagged library, open its classifier jar via `yauzl` (transitive dep of `@xmcl/installer` — no new install), iterate entries, write each one not matching `extractExclude` (for 1.8.9: always `['META-INF/']`) to `<nativesDir>/<basename>`.
3. Return the natives dir path — consumed by args.ts's `buildJvmArgs` for `-Djava.library.path=`.

Phase 4 behavior: Forge mod-loader can introduce additional native-flagged libraries (e.g., SkyHanni-style deps). The natives.ts algorithm generalizes cleanly: any library with `isNative: true` and `download.path` set gets unzipped.

## Sample argv (ramMb=2048, username='Wiiwho')

Produced by `buildArgv` on a darwin-style unix path input (chose unix so the JSON escapes read cleanly; win32 output is identical modulo `\\` path separators and `;` classpath delimiter):

```json
[
  "-Xmx2048M",
  "-Xms2048M",
  "-XX:+UseG1GC",
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:G1HeapRegionSize=32M",
  "-XX:MaxGCPauseMillis=50",
  "-Djava.library.path=/Users/alice/Library/Application Support/Wiiwho/game/versions/1.8.9/natives",
  "-Dminecraft.launcher.brand=wiiwho-launcher",
  "-Dminecraft.launcher.version=0.1.0",
  "-cp",
  "/Users/alice/Library/Application Support/Wiiwho/game/libraries/a.jar;/Users/alice/Library/Application Support/Wiiwho/game/versions/1.8.9/1.8.9.jar",
  "net.minecraft.client.main.Main",
  "--username",
  "Wiiwho",
  "--version",
  "1.8.9",
  "--gameDir",
  "/Users/alice/Library/Application Support/Wiiwho/game",
  "--assetsDir",
  "/Users/alice/Library/Application Support/Wiiwho/game/assets",
  "--assetIndex",
  "1.8",
  "--uuid",
  "abc123nodashes",
  "--accessToken",
  "REDACTED_MC_TOKEN",
  "--userProperties",
  "{}",
  "--userType",
  "msa",
  "--versionType",
  "release"
]
```

Note: the `-cp` value uses `;` because this Node process ran on Windows (where `path.delimiter === ';'`). On a real macOS launch the same code emits `:` — the code reads `path.delimiter` at runtime, never hardcodes a literal. Verified by Test 9 + Test 9-source assertions.

Pitfalls pinned in this sample:
- `net.minecraft.client.main.Main` — NOT `net.minecraft.launchwrapper.Launch` (Pitfall 2; Forge's entry point)
- `--assetIndex 1.8` — NOT `1.8.9` (Pitfall 8; the manifest's assetIndex.id IS `1.8` for version 1.8.9)
- `--userType msa` — NOT `mojang` (LCH-06; legacy value would fail on `api.minecraftservices.com` verification)
- `--userProperties {}` — literal empty JSON object (1.8.9 fails to start without this slot)
- Xmx === Xms (no mid-play G1 heap resize)
- `-Dminecraft.launcher.brand=wiiwho-launcher` + `launcher.version=0.1.0` (propagated to server logs, useful for anticheat triage)

## Tasks

### Task 1: natives.ts — probe + extract

TDD: RED `f295166` → GREEN `0ee07fe`.

Four tests green:

1. **win32 happy path** — dll + no META-INF in nativesDir after extract
2. **Idempotent second call** — detects platform binary presence, short-circuits; tamper test proves re-extraction did NOT run
3. **Platform branch** — on darwin, natives-osx classifier selected and natives-windows ignored (even when both are planted under libraries/)
4. **extractExclude honors nested META-INF paths** — `META-INF/LWJGL.SF`, `META-INF/LWJGL.RSA`, `META-INF/nested/deep.RSA` all absent from output dir

Zip fixtures were built in-test via a dependency-free deflate+stored zip-writer (~60 LoC). Uses `node:zlib` `deflateRawSync` for compression + handrolled local-file-header / central-directory / end-of-central-directory byte layouts. Produces valid zips that yauzl opens without complaint — no need to install `jszip` / `adm-zip` as devDeps.

### Task 2: args.ts — canonical argv

TDD: RED `b804842` → GREEN `e5947c9`.

15 tests green (14 happy-path + 1 source-level grep):

1. mainClass = `net.minecraft.client.main.Main`, no launchwrapper/FMLTweaker strings in argv (Pitfall 2)
2. `--assetIndex 1.8` — not `1.8.9` (Pitfall 8)
3. `--userType msa` — not `mojang` (LCH-06)
4. `--userProperties {}` — literal
5. G1GC block — 4 flags
6. `-Xmx3072M` === `-Xms3072M` for ramMb=3072
7. `-Dminecraft.launcher.brand=wiiwho-launcher` + `.version=0.1.0`
8. `-Djava.library.path=<nativesDir>`
9. Classpath uses `path.delimiter` for the running platform (behavioral identity assertion: `cp === classpath.join(path.delimiter)`)
9-source. Source-level grep: args.ts contains `path.delimiter` and does NOT contain a hardcoded `classpath.join(';')` or `classpath.join(':')`
10. Placeholder substitution — username/uuid/accessToken flow through; no `${...}` leak; `--version 1.8.9` hardcoded; `--assetsDir` derived from gameDir
11. No Forge tokens — `coremods`, `FMLTweaker`, `--tweakClass`, `launchwrapper` all absent from argv
12. Phase 4 seam — buildArgv with `forgeTweaks: ['FMLTweaker']` produces IDENTICAL argv to no tweaks (Phase 3 ignores the input)
+ split-shape tests: `buildJvmArgs` returns only JVM-side flags (no mainClass, no game args); `buildGameArgs` returns only game-side args (no jvm flags)

## Key Decisions

### Hardcode vanilla constants at module level

The 1.8.9 `minecraftArguments` template is invariant — every vanilla-1.8.9 launcher produces the identical argv. Template-parsing via `.replace()` has tripped launchers historically when a value contains a `$` char; explicit constant substitution is both safer and pins Pitfall 2 + Pitfall 8 at the type level:

```typescript
export const VANILLA_MAIN_CLASS = 'net.minecraft.client.main.Main' as const
export const VANILLA_ASSET_INDEX = '1.8' as const
export const MSA_USER_TYPE = 'msa' as const
export const VANILLA_VERSION_TYPE = 'release' as const
```

A corrupted manifest with `mainClass: 'launchwrapper.Launch'` still gets the vanilla argv — Phase 3 refuses to flip into Forge mode. Phase 4 is the only caller allowed to override (by extending buildArgv's body, not by patching the manifest).

### Test 9 redesign — path.delimiter identity + source-level assertion

Original plan: stub `process.platform` to win32 / darwin and assert `;` / `:` separators. Turns out Node's `path` module caches `path.delimiter` at startup based on the REAL process.platform — `Object.defineProperty(process, 'platform', ...)` is not retroactive. Test would always see the host's delimiter.

Fix: two stronger assertions together:
- **Behavioral identity:** `cpValue === classpath.join(path.delimiter)` — regardless of host, the classpath must be `classpath.join(path.delimiter)`.
- **Source-level guardrail:** `args.ts` source text contains `path.delimiter` and does NOT contain `classpath.join(';')` or `classpath.join(':')`.

This catches every failure mode the original plan worried about (hardcoded separator, wrong separator) while being honest about what the runtime can verify.

### yauzl.open hand-wrapped instead of util.promisify

yauzl's overloaded signatures confuse `util.promisify`'s type inference — it picks the no-options callback overload, losing our `{ lazyEntries, autoClose }` options and causing a TS2554 error. 12-LoC handwritten promise wrapper is trivial and preserves types.

### Phase 4 extension seam: present but ignored

`LaunchInputs.forgeTweaks?: string[]` is declared in Phase 3's type. Phase 3's `buildArgv` deliberately ignores it. Test 12 pins that behavior: `buildArgv(resolved, {forgeTweaks: ['FMLTweaker']})` must produce the IDENTICAL argv to `buildArgv(resolved, {})`.

Why: this forces Phase 4 to EXPLICITLY opt in by modifying `buildArgv`'s body. If Phase 3 already spliced `forgeTweaks` into the argv, Phase 4 could accidentally feed Phase 3's spawn code an `forgeTweaks` array by mistake, silently flipping a vanilla launch into broken-Forge mode. The deliberate ignore is a safety net.

### Dependency-free zip writer in tests

natives.test.ts plants LWJGL-shaped classifier jars to exercise the extractor. Rather than install `jszip` / `adm-zip` as devDeps, I handrolled a ~60-LoC zip-writer that uses `node:zlib.deflateRawSync` for compression and handrolled ZIP byte layouts (local file header + central directory + end-of-central-directory). Output zips open cleanly in yauzl. Saves a dep-install round-trip and keeps the test self-contained.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Test 9 originally planned stubbing process.platform to flip path.delimiter — not possible in Node's `path` module (cached at startup)**
- **Found during:** Task 2 GREEN phase, Test 9b failed on Windows host asserting `path.delimiter === ':'`
- **Issue:** `Object.defineProperty(process, 'platform', {value: 'darwin'})` does not retroactively re-derive `path.delimiter`. The module was loaded at startup with the real platform, so `path.delimiter` is frozen.
- **Fix:** Split Test 9 into (a) behavioral identity `cpValue === classpath.join(path.delimiter)` + (b) source-level grep that args.ts uses `path.delimiter` and not a hardcoded char. Both are portable + stronger than the original stub-based plan.
- **Files modified:** `launcher/src/main/launch/args.test.ts` (test-only; args.ts implementation was already correct)
- **Commit:** `e5947c9` — rolled into GREEN because the fix was to the test, not the production code

**2. [Rule 3 — Blocking] util.promisify couldn't wrap yauzl.open due to signature overload ambiguity**
- **Found during:** Task 1 GREEN phase, TSC error TS2554 "Expected 1 arguments, but got 2"
- **Issue:** `util.promisify(yauzl.open)` resolves the callback-only overload, dropping our `{ lazyEntries, autoClose }` options call-site.
- **Fix:** Hand-wrote a 12-LoC promise wrapper that explicitly takes options + preserves types.
- **Files modified:** `launcher/src/main/launch/natives.ts`
- **Commit:** `0ee07fe` — rolled into GREEN

**3. [Rule 2 — Missing critical functionality] Default `extractExclude` when library omits the field**
- **Found during:** Implementation review of natives.ts
- **Issue:** Plan specified honoring the manifest's `extract.exclude`, but a library flagged `isNative: true` without `extractExclude` would have let META-INF signature files land in `java.library.path` — which can cause JVM `SecurityException` if a trusted jar is discovered alongside the LWJGL natives.
- **Fix:** `getExtractExclude()` defaults to `['META-INF/']` when the library declares `isNative: true` but omits `extractExclude`. Defense-in-depth against malformed manifests.
- **Files modified:** `launcher/src/main/launch/natives.ts` — new helper function
- **Commit:** `0ee07fe` — rolled into GREEN

### Auth gates

None — this plan is pure-function + filesystem. No external service interaction.

## Issues Encountered

### Cross-wave parallel execution observation (NOT a blocker)

Plan 03-04 runs in Wave 2 concurrent with Plans 03-02, 03-03, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10. TSC on `tsconfig.node.json` reports 1 error in `libraries.test.ts` (Plan 03-03's RED-phase file importing `./libraries` which 03-03 has not yet written). That error is owned by Plan 03-03 — will resolve when 03-03 ships its GREEN commit.

Scope-boundary compliance: did NOT fix libraries.test.ts. My files (`natives.ts`, `natives.test.ts`, `args.ts`, `args.test.ts`) are TSC-clean — verified by `grep -E "args\.|natives\."` producing zero lines.

## Self-Check: PASSED

File exists checks:
- `[ -f launcher/src/main/launch/natives.ts ]` — FOUND (~200 LoC)
- `[ -f launcher/src/main/launch/natives.test.ts ]` — FOUND (~340 LoC, 4 tests)
- `[ -f launcher/src/main/launch/args.ts ]` — FOUND (~190 LoC)
- `[ -f launcher/src/main/launch/args.test.ts ]` — FOUND (~250 LoC, 15 tests)

Commits exist in git log:
- `f295166` test(03-04): add failing tests for ensureNatives — FOUND
- `0ee07fe` feat(03-04): implement ensureNatives with META-INF exclude — FOUND
- `b804842` test(03-04): add failing tests for canonical vanilla 1.8.9 argv — FOUND
- `e5947c9` feat(03-04): implement canonical vanilla 1.8.9 argv builder — FOUND

Test verification:
- `npx vitest run src/main/launch/natives.test.ts src/main/launch/args.test.ts` → 19/19 green in ~320ms

Acceptance-criteria grep checks (all satisfied):
- `export function buildJvmArgs` → 1 match
- `export function buildGameArgs` → 1 match
- `export function buildArgv` → 1 match
- `export interface LaunchInputs` → 1 match
- `'net.minecraft.client.main.Main'` in args.ts → 1 match (via VANILLA_MAIN_CLASS constant)
- `'--assetIndex', '1.8'` adjacency in args.ts → 1 match (via VANILLA_ASSET_INDEX)
- `'--userType', 'msa'` adjacency → 1 match (via MSA_USER_TYPE)
- `'-XX:+UseG1GC'` → 1 match
- `'-XX:+UnlockExperimentalVMOptions'` → 1 match
- `G1HeapRegionSize=32M` → 2 matches (docstring + code)
- `MaxGCPauseMillis=50` → 2 matches (docstring + code)
- `wiiwho-launcher` → 2 matches (docstring + code)
- `launchwrapper`, `FMLTweaker` appear ONLY in comments describing what must NOT happen (Pitfall 2 guardrail + Phase 4 roadmap). Runtime argv tests (Test 1, Test 11) verify these strings are absent from the actual argv output.
- `export async function ensureNatives` in natives.ts → 1 match
- `META-INF` in natives.ts → 8 matches (docstring + defaults + filter logic)
- `process.platform` in natives.ts → 8 matches (platform branching)

TSC:
- `npx tsc --noEmit -p tsconfig.node.json --composite false` — our 4 files are clean. 1 unrelated error in `libraries.test.ts` (Plan 03-03's in-flight RED phase — resolved when 03-03 commits GREEN).

## Known Stubs

None. Both modules are production-ready:
- `ensureNatives` is callable from Plan 03-05's spawn orchestrator today.
- `buildArgv` is THE argv source of truth — Plan 03-05 imports it directly.

Phase 4 seam (`LaunchInputs.forgeTweaks`) is not a stub — it's a typed extension point tested to be INERT in Phase 3 (Test 12). Phase 4's job is to wire it in.

## Output for Downstream Plans

### What Plan 03-05 consumes

- `import { ensureNatives } from './natives'` — call after `installLibraries` succeeds, before spawning JVM. Returns nativesDir to feed to `buildArgv`.
- `import { buildArgv, buildJvmArgs, buildGameArgs, type LaunchInputs } from './args'` — assemble the argv from `resolved` (Plan 03-03 output) + auth token (Plan 02 AuthManager) + RAM setting (Plan 03-02 settings store) + paths (Plan 03-01 paths.ts).
- `import { VANILLA_MAIN_CLASS, VANILLA_ASSET_INDEX, MSA_USER_TYPE } from './args'` — if Plan 03-05's tests want to assert invariants without duplicating string literals.

### What Phase 4 will consume

- The existing `LaunchInputs.forgeTweaks?: string[]` seam — Phase 4 extends `buildArgv` to splice `forgeTweaks` between mainClass and game args when defined. Test 12 catches regressions in the vanilla path.
- `ensureNatives` generalizes cleanly to additional native-flagged libraries Forge introduces.

## References

- Plan: `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-04-natives-and-args-PLAN.md`
- Research: `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md` §JVM argv for 1.8.9, §Mojang Manifest Shape, §xmcl API Map Open Q §3, §Pitfall 2, §Pitfall 8
- Context: `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md` D-24 (game dir), D-25 (JRE layout)
- Upstream fixture: `launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` (Plan 03-00)
- Upstream paths: `launcher/src/main/paths.ts` (Plan 03-01)
- Requirements: REQUIREMENTS.md LCH-02, LCH-05, LCH-06

---

*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Completed: 2026-04-21*
