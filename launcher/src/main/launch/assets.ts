/**
 * Asset index + object pipeline — vanilla 1.8.9 needs ~110 MB of assets.
 *
 * Wraps @xmcl/installer installAssets. Asset index id for Minecraft 1.8.9 is
 * `"1.8"` per the 1.8.9 per-version manifest's `assetIndex.id` — NOT `"1.8.9"`
 * (Pitfall 8 — the asset index is versioned separately from the MC version,
 *  and multiple MC versions can share a single asset index).
 *
 * Directory layout produced by installAssets:
 *   <gameDir>/assets/indexes/<id>.json
 *   <gameDir>/assets/objects/<xx>/<hash>              (xx = first 2 hex chars)
 *
 * Cache behaviour: delegated to xmcl, which does a diagnose-first SHA1 skip
 * per object. A warm cache (all objects on disk + correct SHA1) returns fast
 * without network work. SC5 (corrupt object bytes) triggers re-download via
 * the same diagnose-first mechanism.
 *
 * docs/mojang-asset-policy.md: the URLs are resolved at runtime from the
 * ResolvedVersion's assetIndex.url — no Mojang bytes embedded in this module.
 */

import { installAssets } from '@xmcl/installer'
import type { ResolvedVersion } from '@xmcl/core'
import type { ProgressFn } from './libraries'

/**
 * Ensure the asset index JSON + all object files are present and SHA1-correct
 * under <gameDir>/assets/.
 *
 * Arguments:
 *   resolved  ResolvedVersion with `.assetIndex` populated (from manifest.ts).
 *   gameDir   Kept for parity with libraries.ts; installer reads
 *             resolved.minecraftDirectory internally so the param is currently
 *             only used for progress metadata + future-proofing.
 *   progress  Optional callback matching the frozen
 *             { bytesDone, bytesTotal, currentFile } game:progress contract.
 *   signal    Optional AbortSignal; propagated into the installer's options
 *             bag so D-13 Cancel during Downloading can tear the pipeline down.
 */
export async function ensureAssets(
  resolved: ResolvedVersion,
  _gameDir: string,
  progress?: ProgressFn,
  signal?: AbortSignal
): Promise<void> {
  const assetsId = resolved.assetIndex?.id ?? resolved.assets ?? '1.8'
  const totalBytes = resolved.assetIndex?.totalSize ?? 0

  progress?.({
    bytesDone: 0,
    bytesTotal: totalBytes,
    currentFile: `assets/${assetsId}`
  })

  // xmcl 6.1.2's AssetsOptions (extends DownloadBaseOptions + ParallelTaskOptions)
  // does not type `abortSignal` directly on the bag, but its internals plumb
  // it into per-file DownloadOptions. Cast-and-pass mirrors libraries.ts.
  await installAssets(resolved, {
    abortSignal: signal
  } as unknown as Parameters<typeof installAssets>[1])

  progress?.({
    bytesDone: totalBytes,
    bytesTotal: totalBytes,
    currentFile: `assets/${assetsId}`
  })
}
