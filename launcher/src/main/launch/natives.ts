/**
 * LWJGL 2.9.4 native extraction for vanilla Minecraft 1.8.9.
 *
 * Open Q §3 (RESEARCH.md) — RESOLVED: @xmcl/installer does NOT auto-extract
 * natives. Confirmed by grepping `node_modules/@xmcl/installer/dist/*.d.ts`
 * for `installNatives|unzip|extract` — no dedicated natives-installer
 * function exists (2026-04-21). The LWJGL classifier jars land on disk under
 * `<gameDir>/libraries/...` as part of `installLibraries`, but they are
 * NOT unzipped into `<gameDir>/versions/1.8.9/natives/` — which is where
 * `-Djava.library.path=` points and what `System.loadLibrary` scans for
 * the platform shared objects (dll/dylib).
 *
 * This module bridges that gap:
 *   1. Probe — if `<nativesDir>` already contains a platform-appropriate
 *      binary (.dll on win32, .dylib/.jnilib on darwin), short-circuit as
 *      a no-op. This makes the function idempotent and cheap on warm cache.
 *   2. Extract — open each native-flagged library's classifier jar via
 *      yauzl (transitive dep of @xmcl/installer), iterate entries, and
 *      write every entry whose path does NOT match the library's
 *      `extractExclude` prefixes to `<nativesDir>/<basename>`.
 *      For 1.8.9 the exclude list is always `['META-INF/']` (per fixture
 *      and per Mojang's 1.8.9.json).
 *   3. The resulting dir is the value of `-Djava.library.path` in Plan
 *      03-04 Task 2's JVM argv.
 *
 * Platform mapping (process.platform → manifest `natives.<key>`):
 *   win32  → 'windows'
 *   darwin → 'osx'
 *   linux  → NOT SUPPORTED for v0.1 (Phase 3 target is Windows + macOS only;
 *           1.8.9 linux natives exist in the manifest but we don't ship a
 *           linux installer in v0.1, so this module throws on linux).
 *
 * Sources:
 *   - `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md`
 *     §xmcl API Map Open Q §3, §Mojang Manifest Shape (extract.exclude),
 *     §JVM argv for 1.8.9 (`-Djava.library.path=<nativesDir>`)
 *   - `launcher/src/main/launch/__fixtures__/1.8.9-manifest.json` — `extract.exclude: ['META-INF/']`
 *   - `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md` D-24 (`<gameDir>/libraries/` layout)
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import yauzl from 'yauzl'
import type { ResolvedVersion } from '@xmcl/core'

/**
 * Promise-wrapper around yauzl.open — yauzl's overloaded signatures confuse
 * util.promisify (the callback overload without options gets picked, losing
 * our `{ lazyEntries, autoClose }` options). Hand-wrap to make the options
 * explicit and preserve types.
 */
function openZip(
  jarPath: string,
  options: yauzl.Options
): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(jarPath, options, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error(`yauzl.open returned no zipfile for ${jarPath}`))
        return
      }
      resolve(zipfile)
    })
  })
}

/** Map process.platform → manifest `natives` key. */
function platformKey(): 'windows' | 'osx' {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'osx'
  throw new Error(
    `Unsupported platform for Minecraft 1.8.9 natives: ${process.platform}. Phase 3 ships Windows + macOS only.`
  )
}

/**
 * Does the given filename extension indicate a platform-appropriate native
 * on the CURRENT process.platform? Used by the idempotency probe to avoid
 * re-extracting when a previous ensureNatives call already populated the dir.
 */
function looksLikePlatformNative(filename: string): boolean {
  const lower = filename.toLowerCase()
  if (process.platform === 'win32') return lower.endsWith('.dll')
  if (process.platform === 'darwin')
    return lower.endsWith('.dylib') || lower.endsWith('.jnilib')
  return false
}

/**
 * Does the entry path match any of the library's extractExclude prefixes?
 * Prefix match, honoring trailing '/' convention from the manifest
 * (e.g. `'META-INF/'` excludes `META-INF/MANIFEST.MF` AND `META-INF/nested/deep.RSA`).
 *
 * Paths are normalized to forward-slash separators before comparison (yauzl
 * uses `/` by default but defensive normalization is cheap).
 */
function isExcluded(entryPath: string, excludes: readonly string[]): boolean {
  const normalized = entryPath.replace(/\\/g, '/')
  for (const exclude of excludes) {
    const prefix = exclude.replace(/\\/g, '/')
    if (normalized === prefix) return true
    if (normalized.startsWith(prefix)) return true
  }
  return false
}

/**
 * Resolve the on-disk path of the platform-appropriate classifier jar for a
 * native-flagged library. Two code paths:
 *   A. Real @xmcl/core ResolvedLibrary — `lib.download.path` is the Maven
 *      path relative to `<gameDir>/libraries/` for the classifier that
 *      @xmcl/installer downloaded (it performs platform resolution before
 *      the download step, so only the applicable classifier ships to disk).
 *   B. Test fixture with an inline `_classifierJars` map (see natives.test.ts)
 *      — used only in unit tests to exercise the platform-branch explicitly
 *      by planting both classifier jars and asserting natives.ts picks the
 *      right one. Real launch never hits this branch.
 *
 * Returns null if no classifier jar applies to the current platform.
 */
function resolveClassifierJarPath(
  lib: unknown,
  gameDir: string
): string | null {
  // Branch B (test fixture): `_classifierJars: { windows?: string; osx?: string }`.
  // Test explicitly provides the relative paths for BOTH classifiers so we can
  // prove the platform-branch picks correctly.
  const maybeFixture = lib as { _classifierJars?: { windows?: string; osx?: string } }
  if (maybeFixture._classifierJars) {
    const rel = maybeFixture._classifierJars[platformKey()]
    if (!rel) return null
    return path.join(gameDir, 'libraries', rel)
  }

  // Branch A (real @xmcl/core ResolvedLibrary): `download.path` is the Maven
  // path of the classifier jar chosen by @xmcl/core's platform resolution.
  const maybeResolved = lib as {
    isNative?: boolean
    download?: { path?: string }
  }
  if (!maybeResolved.isNative) return null
  if (!maybeResolved.download?.path) return null
  return path.join(gameDir, 'libraries', maybeResolved.download.path)
}

function getExtractExclude(lib: unknown): string[] {
  const maybe = lib as { extractExclude?: string[] }
  // 1.8.9's manifest consistently sets this to ['META-INF/'] for LWJGL
  // classifier libs. If a library declares `isNative` but omits
  // extractExclude, default to ['META-INF/'] anyway — signed jar internals
  // should never land in java.library.path regardless of manifest shape.
  return maybe.extractExclude && maybe.extractExclude.length > 0
    ? maybe.extractExclude
    : ['META-INF/']
}

/**
 * Unzip one classifier jar into `destDir`, honoring the `excludes` prefix
 * list. Entries ending in `/` (directory markers) are skipped; entries
 * matching any exclude prefix are skipped; everything else is flattened to
 * `destDir/<basename>` so `-Djava.library.path` works.
 *
 * Uses yauzl's lazyEntries + streaming API — zip bomb tolerant and memory-
 * efficient. One readEntry at a time → one outstream at a time.
 */
async function extractJar(
  jarPath: string,
  destDir: string,
  excludes: readonly string[]
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true })
  const zipfile = await openZip(jarPath, { lazyEntries: true, autoClose: true })

  await new Promise<void>((resolve, reject) => {
    zipfile.on('error', reject)
    zipfile.on('end', () => resolve())

    zipfile.on('entry', (entry: yauzl.Entry) => {
      const entryName = entry.fileName.replace(/\\/g, '/')

      // Directory marker — skip (dirs are created on-demand per file).
      if (entryName.endsWith('/')) {
        zipfile.readEntry()
        return
      }

      // Exclude filter (META-INF/, etc.).
      if (isExcluded(entryName, excludes)) {
        zipfile.readEntry()
        return
      }

      zipfile.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) {
          reject(err ?? new Error(`openReadStream returned no stream for ${entryName}`))
          return
        }
        // Flatten into destDir/<basename>. LWJGL classifier jars stash their
        // natives at the archive root (e.g. `lwjgl64.dll`, not nested under
        // a `natives/` dir), so `path.basename` is equivalent to the full
        // entry path after the META-INF/ exclude runs. Using basename
        // defensively matches wiki.vg's documented launcher behavior of
        // flattening classifier-jar contents into java.library.path.
        const outPath = path.join(destDir, path.basename(entryName))
        ;(async () => {
          const out = (await import('node:fs')).createWriteStream(outPath)
          readStream.on('error', reject)
          out.on('error', reject)
          out.on('finish', () => zipfile.readEntry())
          readStream.pipe(out)
        })().catch(reject)
      })
    })

    zipfile.readEntry()
  })
}

/**
 * Ensure platform-appropriate LWJGL natives are extracted into
 * `<gameDir>/versions/<resolved.id>/natives/` and return that path.
 *
 * Idempotent: if the dir already contains a platform-appropriate binary,
 * returns without re-extracting.
 *
 * @param resolved  Parsed @xmcl/core ResolvedVersion (or test fixture).
 * @param gameDir   Absolute path to the game dir (`<userData>/game`).
 * @returns         Absolute path to the natives dir (caller hands this to
 *                  `-Djava.library.path=` in args.ts).
 */
export async function ensureNatives(
  resolved: ResolvedVersion,
  gameDir: string
): Promise<string> {
  const nativesDir = path.join(gameDir, 'versions', resolved.id, 'natives')
  await fs.mkdir(nativesDir, { recursive: true })

  // Idempotency probe: if a platform-appropriate binary already lives here,
  // treat the dir as populated and short-circuit. Cheap readdir + string
  // check — no SHA1 verification (the source jars carry their own SHA1
  // integrity via @xmcl/installer during download).
  const existing = await fs.readdir(nativesDir).catch(() => [] as string[])
  if (existing.some(looksLikePlatformNative)) {
    return nativesDir
  }

  // Extraction pass. Iterate every library the resolved version flagged as
  // native-bearing; for each, resolve its classifier jar for the current
  // platform and unzip into the natives dir.
  const libs = (resolved.libraries ?? []) as unknown[]
  for (const lib of libs) {
    const jarPath = resolveClassifierJarPath(lib, gameDir)
    if (!jarPath) continue
    try {
      await fs.access(jarPath)
    } catch {
      // Classifier jar not on disk — @xmcl/installer decided it didn't
      // apply to this platform, or plan 03-03 hasn't downloaded it yet.
      // Either way this library contributes nothing to our natives dir.
      continue
    }
    const excludes = getExtractExclude(lib)
    await extractJar(jarPath, nativesDir, excludes)
  }

  return nativesDir
}
