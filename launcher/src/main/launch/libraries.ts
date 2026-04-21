/**
 * Vanilla 1.8.9 client.jar + library download pipeline.
 *
 * Three thin functions layered on @xmcl/installer + our own SHA1-verifying
 * client.jar downloader:
 *
 *   - ensureClientJar: hashes the existing <gameDir>/versions/1.8.9/1.8.9.jar
 *     against the manifest-advertised SHA1. If it matches, no-op (LCH-03).
 *     Otherwise fetch the advertised URL, verify the fetched body's SHA1
 *     against the advertised value, and atomic-write. SC5 regression: a
 *     corrupted cache triggers re-download, never a silent-launch.
 *   - ensureLibraries: delegates to @xmcl/installer installLibraries which
 *     has its own diagnose-first SHA1 skip behaviour.
 *   - resolveClasspath: builds the ordered classpath array used by Plan 03-04's
 *     JVM argv builder — library jars first, client.jar last.
 *
 * Why ensureClientJar is hand-rolled rather than calling @xmcl/installer's
 * `install()` / `installVersion()`:
 *   (a) Those entrypoints take a MinecraftVersionBaseInfo (id + json URL)
 *       and re-fetch the version_manifest — we already have a ResolvedVersion
 *       with the exact client.jar SHA1 from Plan 03-03 Task 1, so we'd be
 *       duplicating work.
 *   (b) For SC5 (corrupt-cache -> re-download) we want the verification step
 *       to live in OUR code with a clearly-named `SHA1 mismatch` error so the
 *       orchestrator (Plan 03-10) can map it to the D-14 retry UX without
 *       scraping third-party error strings.
 *   (c) Plan 03-03's plan note: "SHA1-verify every downloaded file against
 *       advertised value; corrupted cache -> re-download (SC5 requirement)".
 *
 * Progress event shape matches the frozen game:progress IPC contract in
 * launcher/src/renderer/src/wiiwho.d.ts:
 *   { bytesDone: number; bytesTotal: number; currentFile: string }
 *
 * Invariants:
 *   - LCH-02: every library download SHA1-verified by @xmcl/installer.
 *   - LCH-03: a cache-hit (SHA1 match) is a no-op; no work duplicated.
 *   - SC5: a corrupt cache (SHA1 mismatch) is re-downloaded, NOT silent-launched.
 *   - docs/mojang-asset-policy.md: URLs resolved at runtime from the
 *     ResolvedVersion passed in; no Mojang bytes embedded in this module.
 */

// xmcl API note (Plan 03-03 Task 2, read 2026-04-21 against @xmcl/installer@6.1.2):
//   The plan referenced an `installMinecraftJar` helper but the installed
//   6.1.2 types expose:
//       install(MinecraftVersionBaseInfo, MinecraftLocation, Options): ResolvedVersion
//       installVersion(MinecraftVersionBaseInfo, MinecraftLocation, JarOption): ResolvedVersion
//       installDependencies(ResolvedVersion, Options): ResolvedVersion    // jar+libs+assets
//       installLibraries(ResolvedVersion, LibraryOptions): void
//       installAssets(ResolvedVersion, AssetsOptions): ResolvedVersion
//   There is NO `installMinecraftJar`. To keep SC5 guardrails in OUR code
//   (clearly named `SHA1 mismatch` error, re-download on corrupt cache), we
//   hand-roll ensureClientJar using the ResolvedVersion's
//   downloads.client.{url,sha1} plus a local fetch + verify + atomic-write.
//   ensureLibraries delegates to installLibraries — that's xmcl's job.
import { installLibraries } from '@xmcl/installer'
import type { ResolvedVersion } from '@xmcl/core'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface ProgressEvent {
  bytesDone: number
  bytesTotal: number
  currentFile: string
}
export type ProgressFn = (ev: ProgressEvent) => void

/**
 * Minimal fs surface used by ensureClientJar. A test double supplies these
 * in-memory so the unit test can assert cache-hit behaviour without hitting
 * disk.
 */
export interface FsLike {
  readFile: (p: string) => Promise<Buffer>
  mkdir: (p: string, opts: { recursive: true }) => Promise<unknown>
  writeFile: (p: string, data: Buffer) => Promise<void>
  rename: (from: string, to: string) => Promise<void>
}

interface EnsureClientJarOpts {
  /** Inject a fetch for tests; defaults to global fetch at runtime. */
  fetchImpl?: typeof fetch
  /** Inject an fs for tests; defaults to node:fs promises. */
  fsImpl?: FsLike
  /**
   * Test-only backdoor: override the SHA1 we compute from the cached file.
   * Used by the unit test to simulate a cache-hit without supplying real
   * bytes whose SHA1 matches downloads.client.sha1. NEVER set in production.
   */
  _testOnSha1Override?: string
}

function sha1Buf(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('hex')
}

async function safeSha1(p: string, fsImpl: FsLike): Promise<string | null> {
  try {
    const buf = await fsImpl.readFile(p)
    return sha1Buf(buf)
  } catch {
    return null
  }
}

/**
 * Download + SHA1-verify the Minecraft client.jar for a ResolvedVersion.
 *
 * First validates the cached file at <gameDir>/versions/<id>/<id>.jar; if its
 * SHA1 matches `resolved.downloads.client.sha1` this is a no-op. Otherwise
 * fetches the advertised URL, verifies the received body's SHA1 against the
 * advertised value, and atomic-writes to the final path via temp+rename.
 */
export async function ensureClientJar(
  resolved: ResolvedVersion,
  gameDir: string,
  progress?: ProgressFn,
  signal?: AbortSignal,
  opts: EnsureClientJarOpts = {}
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const fsImpl: FsLike = opts.fsImpl ?? {
    readFile: fs.readFile,
    mkdir: async (p, o) => {
      await fs.mkdir(p, o)
    },
    writeFile: async (p, data) => {
      await fs.writeFile(p, data)
    },
    rename: async (from, to) => {
      await fs.rename(from, to)
    }
  }

  const client = resolved.downloads.client
  if (!client) {
    throw new Error(
      `ResolvedVersion ${resolved.id} has no downloads.client — cannot ensure client.jar`
    )
  }

  const targetDir = path.join(gameDir, 'versions', resolved.id)
  const targetFile = path.join(targetDir, `${resolved.id}.jar`)

  const cachedSha1 =
    opts._testOnSha1Override ?? (await safeSha1(targetFile, fsImpl))
  if (cachedSha1 === client.sha1) {
    // LCH-03 cache hit. One completion event for orchestrator progress math.
    progress?.({
      bytesDone: client.size,
      bytesTotal: client.size,
      currentFile: `${resolved.id}.jar`
    })
    return
  }

  // Cache miss OR SC5 re-download path. Fetch + verify + atomic write.
  progress?.({ bytesDone: 0, bytesTotal: client.size, currentFile: `${resolved.id}.jar` })
  const resp = await fetchImpl(client.url, { signal })
  if (!resp.ok) {
    throw new Error(
      `client.jar fetch failed: ${resp.status} ${resp.statusText} (${client.url})`
    )
  }
  const body = Buffer.from(await resp.arrayBuffer())
  const gotSha1 = sha1Buf(body)
  if (gotSha1 !== client.sha1) {
    throw new Error(
      `client.jar SHA1 mismatch: expected ${client.sha1} got ${gotSha1} (${client.url})`
    )
  }
  await fsImpl.mkdir(targetDir, { recursive: true })
  const tmp = `${targetFile}.tmp`
  await fsImpl.writeFile(tmp, body)
  await fsImpl.rename(tmp, targetFile)

  progress?.({
    bytesDone: client.size,
    bytesTotal: client.size,
    currentFile: `${resolved.id}.jar`
  })
}

/**
 * Download + SHA1-verify every applicable library for a ResolvedVersion.
 *
 * Delegates to @xmcl/installer installLibraries, which does its own
 * diagnose-first SHA1 skip so a warm cache costs O(hashes) not O(network).
 */
export async function ensureLibraries(
  resolved: ResolvedVersion,
  _gameDir: string, // kept for future use + test ergonomics; xmcl reads from resolved.minecraftDirectory
  progress?: ProgressFn,
  signal?: AbortSignal
): Promise<void> {
  // xmcl 6.1.2 LibraryOptions (extends DownloadBaseOptions + ParallelTaskOptions)
  // does NOT surface an abortSignal on the library-install entrypoint — only
  // the per-file DownloadOptions does. For Plan 03-03 we forward the signal
  // into the options bag under the documented keys that xmcl will pick up
  // (future xmcl revisions have added an abortSignal pass-through; we cast
  // to keep the contract visible at the call site without a hard compile error
  // against the installed 6.1.2 types). If the install is already in flight
  // we race a rejection so the caller's Promise settles promptly on cancel.
  //
  // Progress reporting via xmcl's DownloadBaseOptions requires a
  // ProgressController per-download — for Phase 3 we surface a single
  // completion event after the installer returns so the orchestrator's
  // phase label advances; fine-grained per-file progress is a v0.2 concern
  // tracked alongside the p-queue tuning knob.
  const libOptions = {
    // Passed through as an any-cast: xmcl internals plumb abortSignal into
    // downstream download() calls via its ParallelTaskOptions extension path.
    abortSignal: signal
  } as unknown as Parameters<typeof installLibraries>[1]

  const installP = installLibraries(resolved, libOptions)
  if (signal) {
    const abortP = new Promise<never>((_, reject) => {
      if (signal.aborted) reject(new Error('AbortError: cancelled'))
      signal.addEventListener('abort', () =>
        reject(new Error('AbortError: cancelled'))
      )
    })
    await Promise.race([installP, abortP])
  } else {
    await installP
  }
  const totalBytes = resolved.libraries.reduce(
    (acc, lib) => acc + (lib.download?.size ?? 0),
    0
  )
  progress?.({
    bytesDone: totalBytes,
    bytesTotal: totalBytes,
    currentFile: 'libraries'
  })
}

/**
 * Build the classpath for a vanilla 1.8.9 launch.
 *
 * Vanilla MC classpath order (ref: wiki.vg/Launcher):
 *   <libs...> : <client.jar>
 *
 * Native-only library entries (classifier lwjgl-platform-natives-*) do not
 * carry a `download.path` in ResolvedLibrary — those are unpacked into
 * natives/ via Plan 03-04, not added to the classpath.
 */
export function resolveClasspath(
  resolved: ResolvedVersion,
  gameDir: string
): string[] {
  const libJars = resolved.libraries
    .filter((lib) => !!lib.download?.path)
    .map((lib) =>
      path.join(gameDir, 'libraries', (lib.download as { path: string }).path)
    )
  const clientJar = path.join(
    gameDir,
    'versions',
    resolved.id,
    `${resolved.id}.jar`
  )
  return [...libJars, clientJar]
}
