/**
 * Mojang version manifest + per-version client.json fetch & SHA1-verify.
 *
 * First-run flow (called from Plan 03-10's orchestrator on every Play click):
 *   1. fetch(version_manifest_v2.json) -> find the <versionId> entry -> its
 *      URL + catalogue SHA1 (the authoritative hash for the per-version body).
 *   2. If <gameDir>/versions/<versionId>/<versionId>.json already exists with
 *      a SHA1 that matches the catalogue, reuse it. (LCH-03 cache-hit.)
 *      Else: fetch(per-version JSON) -> SHA1-verify against the catalogue ->
 *      atomic-write via temp+rename.
 *   3. Return { path, sha1, manifest }.
 *
 * Invariants:
 *   - LCH-01: the per-version body is SHA1-verified against version_manifest_v2
 *     every time before it's handed to @xmcl/core. A mismatched body is never
 *     written to the cache path.
 *   - SC5: a corrupted cache (on-disk SHA1 != catalogue SHA1) triggers a
 *     re-download and replacement, never a silent launch against bad bytes.
 *   - docs/mojang-asset-policy.md: every byte comes from Mojang URLs at
 *     runtime; nothing is embedded in the installer.
 *   - Pitfall 1 (EULA): this module never persists the manifest anywhere
 *     outside <gameDir>, which is the user's AppData/Application Support tree.
 *
 * xmcl API note (Task 1 read of installed types):
 *   @xmcl/core 2.15.1 exports `Version.parse(minecraftLocation, versionId)`
 *   which returns Promise<ResolvedVersion>. It REQUIRES
 *   versions/<id>/<id>.json to already exist on disk — which is why this
 *   module writes the file before resolveVersion() is called.
 */

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Version, type ResolvedVersion } from '@xmcl/core'

/**
 * Mojang's current (piston-meta) catalogue URL. The older
 * launchermeta.mojang.com/mc/game/version_manifest.json host still resolves
 * but piston-meta is the canonical v2 endpoint per
 * .planning/phases/03/03-RESEARCH.md §Mojang Manifest Shape.
 */
export const VERSION_MANIFEST_URL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

export interface VersionManifestEntry {
  id: string
  type: string
  url: string
  time: string
  releaseTime: string
  sha1: string
}

export interface VersionManifestList {
  latest: { release: string; snapshot: string }
  versions: VersionManifestEntry[]
}

export interface ManifestFetchResult {
  /** Absolute path to the cached per-version JSON on disk. */
  path: string
  /** Verified SHA1 of the per-version JSON (catalogue-advertised). */
  sha1: string
  /** Parsed per-version JSON (raw shape — downstream callers use resolveVersion). */
  manifest: unknown
}

function sha1Buf(buf: Buffer | string): string {
  const data = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
  return createHash('sha1').update(data).digest('hex')
}

async function fileSha1(p: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(p)
    return sha1Buf(buf)
  } catch {
    return null
  }
}

/**
 * Fetch + cache the per-version manifest for the given Minecraft version.
 *
 * @param versionId Mojang version id (e.g. '1.8.9').
 * @param gameDir The Wiiwho game directory root (from paths.ts resolveGameDir).
 * @param fetchImpl Injected fetch — defaults to global fetch; tests pass a mock.
 * @param signal Optional AbortSignal propagated to every outgoing fetch so that
 *   D-13 "Cancel during Downloading" can tear the pipeline down cleanly.
 */
export async function fetchAndCacheManifest(
  versionId: string,
  gameDir: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<ManifestFetchResult> {
  // 1. Catalogue (version_manifest_v2) — always fetched; gives us the
  //    authoritative SHA1 for the per-version body.
  const resp = await fetchImpl(VERSION_MANIFEST_URL, { signal })
  if (!resp.ok) {
    throw new Error(
      `version_manifest_v2 fetch failed: ${resp.status} ${resp.statusText}`
    )
  }
  const manifestList = (await resp.json()) as VersionManifestList
  const entry = manifestList.versions.find((v) => v.id === versionId)
  if (!entry) {
    throw new Error(`Unknown Minecraft version: ${versionId}`)
  }

  // 2. Resolve cache target and compare on-disk SHA1.
  const targetDir = path.join(gameDir, 'versions', versionId)
  const targetFile = path.join(targetDir, `${versionId}.json`)
  const cachedSha1 = await fileSha1(targetFile)
  if (cachedSha1 === entry.sha1) {
    // Warm cache (LCH-03). Read and return without re-fetching.
    const cachedBytes = await fs.readFile(targetFile, 'utf8')
    return {
      path: targetFile,
      sha1: entry.sha1,
      manifest: JSON.parse(cachedBytes) as unknown
    }
  }

  // 3. Fetch the per-version JSON, verify its SHA1 against the catalogue,
  //    write atomically (temp + rename). LCH-01 + SC5 enforced here.
  const perVersionResp = await fetchImpl(entry.url, { signal })
  if (!perVersionResp.ok) {
    throw new Error(
      `per-version manifest fetch failed: ${perVersionResp.status} ${perVersionResp.statusText}`
    )
  }
  const body = Buffer.from(await perVersionResp.arrayBuffer())
  const gotSha1 = sha1Buf(body)
  if (gotSha1 !== entry.sha1) {
    throw new Error(
      `per-version manifest SHA1 mismatch: expected ${entry.sha1} got ${gotSha1}`
    )
  }
  await fs.mkdir(targetDir, { recursive: true })
  const tmp = `${targetFile}.tmp`
  await fs.writeFile(tmp, body)
  await fs.rename(tmp, targetFile)

  return {
    path: targetFile,
    sha1: entry.sha1,
    manifest: JSON.parse(body.toString('utf8')) as unknown
  }
}

/**
 * Thin wrapper over @xmcl/core's Version.parse. Requires the per-version JSON
 * to already exist on disk at <gameDir>/versions/<versionId>/<versionId>.json
 * (satisfied by fetchAndCacheManifest).
 *
 * Returns a ResolvedVersion which flattens inheritance chains and carries the
 * full library/asset/jvm-arg pipeline the downstream launch steps need.
 */
export async function resolveVersion(
  gameDir: string,
  versionId: string
): Promise<ResolvedVersion> {
  return Version.parse(gameDir, versionId)
}
