---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 03
type: execute
wave: 2
depends_on: ["03-00", "03-01"]
files_modified:
  - launcher/src/main/launch/manifest.ts
  - launcher/src/main/launch/manifest.test.ts
  - launcher/src/main/launch/libraries.ts
  - launcher/src/main/launch/libraries.test.ts
  - launcher/src/main/launch/libraries.integration.test.ts
  - launcher/src/main/launch/assets.ts
  - launcher/src/main/launch/assets.test.ts
autonomous: true
requirements:
  - LCH-01
  - LCH-02
  - LCH-03
must_haves:
  truths:
    - "fetchAndCacheManifest('1.8.9') produces `<game-dir>/versions/1.8.9/1.8.9.json` with SHA1 verified against version_manifest_v2.json"
    - "ensureClientJar(resolved) downloads client.jar iff missing OR SHA1 mismatch; SHA1-valid cache is a no-op (LCH-03)"
    - "ensureLibraries(resolved) resolves OS rules, downloads + SHA1-verifies every applicable library, reuses cache (LCH-02)"
    - "ensureAssets(resolved) fetches asset-index JSON + hashed objects at <game-dir>/assets/{indexes,objects}/ (LCH-02)"
    - "Corrupting a cached jar and re-running triggers re-download, not silent broken launch (ROADMAP SC5)"
    - "Progress callbacks emit {bytesDone, bytesTotal, currentFile} matching wiiwho.d.ts game.onProgress contract"
  artifacts:
    - path: "launcher/src/main/launch/manifest.ts"
      provides: "fetchAndCacheManifest, resolveVersion"
      exports: ["fetchAndCacheManifest", "resolveVersion"]
    - path: "launcher/src/main/launch/libraries.ts"
      provides: "ensureClientJar, ensureLibraries, resolveClasspath"
      exports: ["ensureClientJar", "ensureLibraries", "resolveClasspath"]
    - path: "launcher/src/main/launch/assets.ts"
      provides: "ensureAssets"
      exports: ["ensureAssets"]
  key_links:
    - from: "launcher/src/main/launch/manifest.ts"
      to: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json + @xmcl/core Version.parse"
      via: "native fetch + @xmcl/core"
      pattern: "piston-meta.mojang.com"
    - from: "launcher/src/main/launch/libraries.ts"
      to: "@xmcl/installer installMinecraftJar + installLibraries"
      via: "diagnose-first SHA1 skip"
      pattern: "@xmcl/installer"
    - from: "launcher/src/main/launch/assets.ts"
      to: "@xmcl/installer installAssets"
      via: "hash-prefix/hash CDN layout"
      pattern: "installAssets"
---

<objective>
Three thin wrappers around `@xmcl/installer` + `@xmcl/core` that: (1) fetch + SHA1-verify Mojang's version_manifest_v2.json and the resolved 1.8.9.json manifest; (2) download + SHA1-verify client.jar + 37 libraries into `<game-dir>/{versions,libraries}/`; (3) download + SHA1-verify the `1.8` asset index + ~110 MB of objects into `<game-dir>/assets/`. Each step skips work when cached files already match their advertised SHA1 (LCH-03), and re-downloads on mismatch (SC5).

Every wrapper exposes a `(progress: (ev: {bytesDone, bytesTotal, currentFile}) => void, signal?: AbortSignal) => Promise<...>` shape so Plan 03-10's orchestrator can push progress events to the renderer via the frozen `game:progress` channel.

Output: Three pipeline modules + three tests (unit + integration). `@xmcl/installer` does the heavy lifting; we own the orchestration + progress plumbing + test coverage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/main/paths.ts
@launcher/src/main/launch/__fixtures__/1.8.9-manifest.json
@docs/mojang-asset-policy.md

<interfaces>
From launcher/src/main/paths.ts (Plan 03-01):
```typescript
export function resolveGameDir(): string   // <userData>/game
```

From @xmcl/core (Voxelum/minecraft-launcher-core-node):
```typescript
import { Version } from '@xmcl/core'
// Version.parse(minecraftLocation, versionId): Promise<ResolvedVersion>
// Returns flattened inheritance; requires versions/<id>/<id>.json to EXIST first.
```

From @xmcl/installer:
```typescript
import {
  installMinecraftJar,        // downloads + verifies client.jar for a ResolvedVersion
  installLibraries,           // resolves OS rules + downloads + verifies every applicable library
  installAssets,              // downloads asset-index JSON + object CDN payload
  installDependencies         // = installMinecraftJar + installLibraries + installAssets (+ natives handling per Open Q §3)
} from '@xmcl/installer'
```

Exact API signatures must be verified during execute (RESEARCH.md §xmcl API Map lists the entry points; the options object names may vary slightly between 5.x and 6.x). Task 1's action says: **read the installed package's types first** — `launcher/node_modules/@xmcl/installer/index.d.ts` — and use THE SIGNATURE PRESENT. Do not guess.

Frozen IPC contract from launcher/src/renderer/src/wiiwho.d.ts:
```typescript
onProgress: (cb: (p: { bytesDone: number; bytesTotal: number; currentFile: string }) => void) => () => void
```

Progress callbacks in this plan MUST produce matching shape.

Mojang URLs (from RESEARCH.md §Mojang Manifest Shape, verified 2026-04-21):
- Version manifest: `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
- 1.8.9 client.json: URL from version_manifest → `piston-meta.mojang.com/v1/packages/d546f1707a3f2b7d034eece5ea2e311eda875787/1.8.9.json`
- 1.8.9 client.jar SHA1: `3870888a6c3d349d3771a3e9d16c9bf5e076b908`
- 1.8.9 asset index: `"1.8"` (NOT "1.8.9" — Pitfall 8)
- Asset index URL: `https://launchermeta.mojang.com/v1/packages/f6ad102bcaa53b1a58358f16e376d548d44933ec/1.8.json`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: manifest.ts — fetch, SHA1-verify, cache the 1.8.9 client.json</name>
  <files>
    launcher/src/main/launch/manifest.ts,
    launcher/src/main/launch/manifest.test.ts
  </files>
  <read_first>
    - launcher/node_modules/@xmcl/core/index.d.ts (confirm `Version.parse(location, id)` signature; the docs mention it but installed types are authoritative)
    - launcher/node_modules/@xmcl/installer/index.d.ts (for any shared types like ResolvedVersion)
    - launcher/src/main/launch/__fixtures__/1.8.9-manifest.json (fixture for the unit test)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Mojang Manifest Shape — the exact SHA1s to hardcode in tests
    - docs/mojang-asset-policy.md — all URLs at fetch time, nothing embedded install-time (Pitfall 1)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: `fetchAndCacheManifest('1.8.9')` on empty cache makes exactly ONE fetch to `piston-meta.mojang.com/mc/game/version_manifest_v2.json`, resolves the 1.8.9 entry, fetches the per-version manifest, writes `<game-dir>/versions/1.8.9/1.8.9.json`, returns `{ path: ..., sha1: 'd546f1707a3f...', manifest: {...} }`.
    - Test 2: `fetchAndCacheManifest('1.8.9')` on warm cache (the per-version JSON already on disk with correct SHA1) does NOT re-fetch the per-version JSON (still hits version_manifest_v2 to know the current SHA1 — acceptable; but the per-version file stays as-is).
    - Test 3: Corrupted cache (existing `1.8.9.json` with mismatched SHA1) → re-fetched + overwritten (SC5).
    - Test 4: `resolveVersion(gameDir, '1.8.9')` returns the ResolvedVersion from `@xmcl/core` — asserts mainClass is `net.minecraft.client.main.Main`, assetIndex.id is `1.8`, libraries array non-empty.
    - Test 5: Network error during version_manifest fetch propagates as a typed error (Plan 03-10 maps this to the D-14 "can't reach Mojang" UX).

    Mock `global.fetch` with a sequence of responses:
    ```typescript
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('version_manifest_v2')) {
        return new Response(JSON.stringify({ versions: [{id:'1.8.9', url:'https://piston-meta.mojang.com/v1/packages/d546f.../1.8.9.json', sha1:'d546f1707a3f2b7d034eece5ea2e311eda875787', type:'release'}] }))
      }
      if (url.includes('1.8.9.json')) {
        return new Response(readFileSync('./__fixtures__/1.8.9-manifest.json', 'utf8'))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', mockFetch)
    ```
    Use a temp dir for the game-dir so tests don't pollute disk. Clean up in afterEach.
  </behavior>
  <action>
    Create `launcher/src/main/launch/manifest.ts`. Follow this structure (adapt API signatures to whatever `@xmcl/core` / `@xmcl/installer` actually exports — READ THEIR TYPES FIRST):

    ```typescript
    /**
     * Mojang version manifest + 1.8.9 client.json fetch & SHA1-verify.
     *
     * First-run flow:
     *   1. fetch(version_manifest_v2.json) → find 1.8.9 entry → its URL + SHA1
     *   2. If <gameDir>/versions/1.8.9/1.8.9.json exists with matching SHA1 → reuse
     *      Else: fetch(per-version JSON) → SHA1-verify → write atomic
     *   3. Return { path, sha1, manifest }
     *
     * ROADMAP SC5 / LCH-03: corrupt cache → re-download, never silent-launch.
     * Pitfall 1 / docs/mojang-asset-policy.md: nothing Mojang-owned ships in installer — everything fetched at runtime.
     */

    import { createHash } from 'node:crypto'
    import { promises as fs } from 'node:fs'
    import path from 'node:path'
    import { Version, type ResolvedVersion } from '@xmcl/core'

    const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

    async function sha1(buf: Buffer | string): Promise<string> {
      const data = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
      return createHash('sha1').update(data).digest('hex')
    }

    async function fileSha1(p: string): Promise<string | null> {
      try {
        const buf = await fs.readFile(p)
        return await sha1(buf)
      } catch { return null }
    }

    export interface ManifestFetchResult {
      path: string         // absolute path to 1.8.9.json on disk
      sha1: string         // verified sha1
      manifest: unknown    // parsed manifest JSON
    }

    export async function fetchAndCacheManifest(
      versionId: string,
      gameDir: string,
      fetchImpl: typeof fetch = fetch,
      signal?: AbortSignal
    ): Promise<ManifestFetchResult> {
      // 1. Fetch version_manifest_v2.
      const resp = await fetchImpl(VERSION_MANIFEST_URL, { signal })
      if (!resp.ok) throw new Error(`version_manifest_v2 fetch failed: ${resp.status}`)
      const manifestList = await resp.json() as { versions: Array<{ id: string; url: string; sha1: string }> }
      const entry = manifestList.versions.find(v => v.id === versionId)
      if (!entry) throw new Error(`Unknown Minecraft version: ${versionId}`)

      // 2. Resolve cached per-version JSON.
      const targetDir = path.join(gameDir, 'versions', versionId)
      const targetFile = path.join(targetDir, `${versionId}.json`)
      const cachedSha1 = await fileSha1(targetFile)
      if (cachedSha1 === entry.sha1) {
        // Warm cache; no re-fetch needed.
        const manifest = JSON.parse(await fs.readFile(targetFile, 'utf8'))
        return { path: targetFile, sha1: entry.sha1, manifest }
      }

      // 3. Fetch + verify + write.
      const perVersionResp = await fetchImpl(entry.url, { signal })
      if (!perVersionResp.ok) throw new Error(`per-version manifest fetch failed: ${perVersionResp.status}`)
      const body = Buffer.from(await perVersionResp.arrayBuffer())
      const gotSha1 = await sha1(body)
      if (gotSha1 !== entry.sha1) {
        throw new Error(`per-version manifest SHA1 mismatch: expected ${entry.sha1} got ${gotSha1}`)
      }
      await fs.mkdir(targetDir, { recursive: true })
      const tmp = `${targetFile}.tmp`
      await fs.writeFile(tmp, body)
      await fs.rename(tmp, targetFile)
      return { path: targetFile, sha1: entry.sha1, manifest: JSON.parse(body.toString('utf8')) }
    }

    /** Thin wrapper over @xmcl/core Version.parse — requires the manifest on disk. */
    export async function resolveVersion(gameDir: string, versionId: string): Promise<ResolvedVersion> {
      return Version.parse(gameDir, versionId)
    }
    ```

    Write `manifest.test.ts` with the 5 tests above. Use `@vitest-environment node`, mock `global.fetch` per-test, use `os.tmpdir()` + `randomUUID()` for the gameDir.

    IMPORTANT: If `@xmcl/core`'s actual API differs (e.g., `Version.parse` takes different args in the installed version), ADAPT the wrapper while keeping the exported shape stable. Commit message notes the actual signature used.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/launch/manifest.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export async function fetchAndCacheManifest" launcher/src/main/launch/manifest.ts`
    - `grep -q "export async function resolveVersion" launcher/src/main/launch/manifest.ts`
    - `grep -q "piston-meta.mojang.com/mc/game/version_manifest_v2.json" launcher/src/main/launch/manifest.ts`
    - `grep -q "import.*@xmcl/core" launcher/src/main/launch/manifest.ts`
    - `grep -q "createHash.*sha1" launcher/src/main/launch/manifest.ts` (SHA1 enforcement)
    - `grep -q "SHA1 mismatch" launcher/src/main/launch/manifest.ts` (SC5 / LCH-01 enforcement)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/manifest.test.ts` exits 0 with 5 passing tests
  </acceptance_criteria>
  <done>Manifest fetch+SHA1 flow works, resolve wrapper returns `net.minecraft.client.main.Main` mainClass, all 5 tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: libraries.ts — client.jar + 37 libraries with diagnose-first cache</name>
  <files>
    launcher/src/main/launch/libraries.ts,
    launcher/src/main/launch/libraries.test.ts,
    launcher/src/main/launch/libraries.integration.test.ts
  </files>
  <read_first>
    - launcher/node_modules/@xmcl/installer/index.d.ts (confirm installMinecraftJar / installLibraries signatures)
    - launcher/src/main/launch/manifest.ts (Task 1 — ResolvedVersion shape)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §xmcl API Map (which library does what)
    - launcher/src/main/launch/__fixtures__/1.8.9-manifest.json (the bad-sha1 library fixture for SC5 integration test)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1 (unit): `ensureClientJar` calls `installMinecraftJar` from @xmcl/installer exactly once; emits progress events with currentFile === 'client.jar' (or the manifest-defined URL's last segment).
    - Test 2 (unit): `ensureLibraries` delegates to `installLibraries`; forwards progress events; respects abort signal.
    - Test 3 (unit): `resolveClasspath(resolved)` returns an array of absolute paths in the order of resolved.libraries + client.jar (classpath order matters — RESEARCH.md §JVM argv notes client.jar is appended AFTER libraries for vanilla 1.8.9; for Phase 3 vanilla this is what we do).
    - Test 4 (integration): Plant a valid client.jar + lib file with correct SHA1 → call `ensureClientJar` + `ensureLibraries` → assert NO network call (mock fetch → throw if called; `installMinecraftJar` should see the cached file via its diagnose-first path and skip). This proves LCH-03 cache-hit.
    - Test 5 (integration, SC5 regression): Plant a client.jar with WRONG content → call `ensureClientJar` → assert fetch was called + cached file now matches advertised SHA1. This proves SC5 (corrupt cache → re-download).
    - Test 6 (integration, SC5 regression for libraries): Use the fixture's `fixture.bad:bad-sha1:1.0` library (with 0000... SHA1). Trying to `ensureLibraries` against this fixture manifest should fail with a specific diagnosable error (fetch 404 or SHA1 mismatch). The goal is asserting the error bubbles — Plan 03-10 maps it to retry/surface.

    Separate the integration test into `libraries.integration.test.ts` so it can be run with `--env node` and a real temp dir.
  </behavior>
  <action>
    Create `launcher/src/main/launch/libraries.ts`:

    ```typescript
    /**
     * Vanilla client.jar + library download pipeline.
     *
     * Wraps @xmcl/installer's diagnose-first installers. Adds:
     *   - progress callbacks matching wiiwho.d.ts game.onProgress shape
     *   - AbortSignal propagation for D-13 Cancel during Downloading
     *   - resolveClasspath helper used by Plan 03-04's args builder
     *
     * Cache behavior (LCH-03 + SC5):
     *   - installMinecraftJar/installLibraries skip files whose SHA1 already matches.
     *   - Corrupted cache → re-download (diagnose-first detects mismatch).
     */

    import { installMinecraftJar, installLibraries } from '@xmcl/installer'
    import type { ResolvedVersion } from '@xmcl/core'
    import path from 'node:path'

    export interface ProgressEvent {
      bytesDone: number
      bytesTotal: number
      currentFile: string
    }
    export type ProgressFn = (ev: ProgressEvent) => void

    export async function ensureClientJar(
      resolved: ResolvedVersion,
      gameDir: string,
      progress?: ProgressFn,
      signal?: AbortSignal
    ): Promise<void> {
      // Adapt signature based on installed @xmcl/installer types — the options
      // bag name may differ between versions. The function MUST respect the
      // game directory already embedded in `resolved` (Version.parse stores it).
      await installMinecraftJar(resolved, {
        // Pass-through options; add `signal` if accepted, or wrap in a Promise.race.
        // See launcher/node_modules/@xmcl/installer/index.d.ts for exact keys.
      } as Parameters<typeof installMinecraftJar>[1])

      // xmcl 5.x accepts a task/progress callback — if so, wire it. Otherwise,
      // progress reporting is best-effort: we emit a single end-of-op event.
      if (progress) progress({ bytesDone: 1, bytesTotal: 1, currentFile: 'client.jar' })
    }

    export async function ensureLibraries(
      resolved: ResolvedVersion,
      gameDir: string,
      progress?: ProgressFn,
      signal?: AbortSignal
    ): Promise<void> {
      await installLibraries(resolved)
      if (progress) progress({ bytesDone: 1, bytesTotal: 1, currentFile: 'libraries' })
    }

    /** Ordered classpath for vanilla 1.8.9 launch. */
    export function resolveClasspath(resolved: ResolvedVersion, gameDir: string): string[] {
      // Libraries first (excluding native-only classifier entries), then client.jar.
      // @xmcl/core ResolvedVersion.libraries is already OS-filtered.
      const libJars = resolved.libraries
        .filter(l => !!l.download?.path)      // exclude natives-only entries that have no main artifact
        .map(l => path.join(gameDir, 'libraries', l.download!.path))
      const clientJar = path.join(gameDir, 'versions', resolved.id, `${resolved.id}.jar`)
      return [...libJars, clientJar]
    }
    ```

    **VERIFY during execute:** the exact @xmcl/installer API shape. The commit must include a note documenting which options were passed. If `installMinecraftJar` returns a Task object instead (xmcl 4.x pattern), the wrapper needs `.execute()` / `.start()` calls — check the types. DO NOT guess.

    Write `libraries.test.ts` with unit Tests 1-3 (mock `@xmcl/installer` via `vi.mock`). Write `libraries.integration.test.ts` with Tests 4-6 using a real temp dir, real fs.

    For the integration tests: use a mocked `global.fetch` as the network stub for xmcl's internal HTTP calls — but first verify whether @xmcl/installer uses `node-fetch`, `undici`, or the built-in `fetch`. If it uses something other than `global.fetch`, adjust: `vi.spyOn(require('http'), 'get')` or mock at the module level. Document which mock surface works.

    Integration test for SC5 regression — fixture plant pattern:
    ```typescript
    const gameDir = path.join(os.tmpdir(), randomUUID())
    await fs.mkdir(path.join(gameDir, 'versions', '1.8.9'), { recursive: true })
    // Plant a client.jar with WRONG content
    await fs.writeFile(path.join(gameDir, 'versions', '1.8.9', '1.8.9.jar'), Buffer.from('corrupted'))
    await ensureClientJar(resolved, gameDir)
    const finalBytes = await fs.readFile(path.join(gameDir, 'versions', '1.8.9', '1.8.9.jar'))
    const finalSha1 = createHash('sha1').update(finalBytes).digest('hex')
    expect(finalSha1).toBe('3870888a6c3d349d3771a3e9d16c9bf5e076b908') // Mojang's published sha1
    ```

    If the SC5 integration test requires actual network, mark it with `describe.skipIf(!process.env.CI_NETWORK)` OR mock @xmcl/installer entirely so the re-download is simulated. Prefer the mock path for deterministic CI; document in the summary.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/launch/libraries.test.ts src/main/launch/libraries.integration.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export async function ensureClientJar" launcher/src/main/launch/libraries.ts`
    - `grep -q "export async function ensureLibraries" launcher/src/main/launch/libraries.ts`
    - `grep -q "export function resolveClasspath" launcher/src/main/launch/libraries.ts`
    - `grep -q "installMinecraftJar" launcher/src/main/launch/libraries.ts`
    - `grep -q "installLibraries" launcher/src/main/launch/libraries.ts`
    - `grep -q "ProgressEvent" launcher/src/main/launch/libraries.ts` (progress shape matches wiiwho.d.ts)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/libraries.test.ts` exits 0 (≥3 unit tests)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/libraries.integration.test.ts` exits 0 (≥3 integration tests, including SC5 regression)
  </acceptance_criteria>
  <done>Libraries pipeline wired, classpath resolver implemented, LCH-03 cache-hit + SC5 re-download both asserted in tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: assets.ts — asset index + objects pipeline</name>
  <files>
    launcher/src/main/launch/assets.ts,
    launcher/src/main/launch/assets.test.ts
  </files>
  <read_first>
    - launcher/node_modules/@xmcl/installer/index.d.ts (installAssets signature)
    - launcher/src/main/launch/manifest.ts (Task 1 — ResolvedVersion shape)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Mojang Manifest Shape — asset index layout (`1.8` NOT `1.8.9` — Pitfall 8)
    - docs/mojang-asset-policy.md
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: `ensureAssets(resolved, gameDir)` calls `installAssets` from @xmcl/installer with the resolved version.
    - Test 2: Progress events emitted during the call match the `ProgressEvent` shape from libraries.ts.
    - Test 3: Asset index (`1.8.json`) lands at `<gameDir>/assets/indexes/1.8.json` after successful run (fixture asset index).
    - Test 4: Asset objects land at `<gameDir>/assets/objects/<xx>/<hash>` per Mojang's CDN layout (use a 2-entry fixture with trivial known SHA1s).
    - Test 5: Cache hit on valid index → no re-download (LCH-03).

    Use the same mocking strategy as libraries.test.ts. For Tests 3-4, use a real temp dir + a mocked asset manifest with 2 fake objects; assert the directory layout after the call. The `installAssets` function may need to be mocked in a way that simulates writing those files.
  </behavior>
  <action>
    Create `launcher/src/main/launch/assets.ts`:

    ```typescript
    /**
     * Asset index + object pipeline — vanilla 1.8.9 needs ~110 MB of assets.
     *
     * Wraps @xmcl/installer installAssets. Asset index ID is `"1.8"` per 1.8.9's
     * assetIndex.id — NOT "1.8.9" (Pitfall 8 — the asset-index is versioned
     * separately from the MC version).
     *
     * Cache behavior: diagnose-first via installAssets (SHA1 per object).
     */

    import { installAssets } from '@xmcl/installer'
    import type { ResolvedVersion } from '@xmcl/core'
    import type { ProgressFn } from './libraries'

    export async function ensureAssets(
      resolved: ResolvedVersion,
      gameDir: string,
      progress?: ProgressFn,
      signal?: AbortSignal
    ): Promise<void> {
      await installAssets(resolved /* options — see @xmcl/installer types */)
      if (progress) {
        progress({ bytesDone: 1, bytesTotal: 1, currentFile: `assets/${resolved.assetIndex?.id ?? '1.8'}` })
      }
    }
    ```

    Write `assets.test.ts` with the 5 tests above. Mock `@xmcl/installer` so `installAssets` writes the index to the expected location for assertion purposes.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/launch/assets.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export async function ensureAssets" launcher/src/main/launch/assets.ts`
    - `grep -q "installAssets" launcher/src/main/launch/assets.ts`
    - `grep -q "import.*ProgressFn" launcher/src/main/launch/assets.ts` (progress shape shared from libraries.ts)
    - `cd launcher &amp;&amp; npx vitest run src/main/launch/assets.test.ts` exits 0 with ≥5 tests passing
  </acceptance_criteria>
  <done>Assets pipeline wired to xmcl, layout asserted, cache hit covered.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/main/launch/manifest.test.ts src/main/launch/libraries.test.ts src/main/launch/libraries.integration.test.ts src/main/launch/assets.test.ts` — all green
- `cd launcher && npm run typecheck` — no type issues with xmcl imports
- No Mojang bytes committed to repo (`docs/mojang-asset-policy.md` invariant): `git ls-files launcher/resources/mc/` returns empty (dir shouldn't exist)
</verification>

<success_criteria>
- LCH-01 enforced: manifest.ts verifies 1.8.9.json SHA1 against version_manifest_v2 before caching
- LCH-02 enforced: libraries.ts + assets.ts download + SHA1-verify every library + asset via xmcl
- LCH-03 enforced: second call is a cache-hit no-op (test covers)
- SC5 enforced: corrupt cache → re-download (integration test covers)
- Progress callbacks shaped to match frozen `game:progress` contract (wiiwho.d.ts)
- docs/mojang-asset-policy.md invariant maintained — every byte comes from Mojang URL at fetch time, not embedded in installer
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-03-SUMMARY.md` documenting:
- Exact @xmcl/installer API signatures used (since docs were ambiguous about Task/Promise shape)
- Whether natives are extracted by installLibraries / installDependencies, or if Plan 03-04 needs a custom natives.ts (Open Q §3 resolution)
- Which mock surface was used for HTTP in tests (undici, fetch, http module)
- Any edge cases in classpath ordering observed
</output>
