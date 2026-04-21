// @vitest-environment node
/**
 * Tests for LWJGL 2.9.4 native-extraction (Open Q §3 resolution).
 *
 * @xmcl/installer does NOT auto-extract natives — verified by grepping
 * node_modules/@xmcl/installer/dist/*.d.ts for `installNatives` (0 matches).
 * Therefore natives.ts unzips the applicable `natives-<os>` classifier jar
 * from `<gameDir>/libraries/...` into `<gameDir>/versions/1.8.9/natives/`,
 * honoring the manifest's `extract.exclude` rule (always `['META-INF/']`
 * for 1.8.9 per fixture).
 *
 * Tests cover:
 *   1. Successful extraction on Windows (dll + no META-INF)
 *   2. Idempotent second call (no redundant re-extract)
 *   3. Platform branch picks natives-windows on win32, natives-osx on darwin
 *   4. extract.exclude honors META-INF/ exclusion (no SF/RSA files)
 *
 * Zip fixtures are built in-test with a tiny pure-JS stored (no-compression)
 * zip writer — dependency-free; fits in ~50 LoC below.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'

import type { ResolvedVersion } from '@xmcl/core'

// ---------- test helpers: tiny stored + deflate zip writer ----------

interface ZipEntry {
  name: string // forward-slash separator
  data: Buffer
}

/**
 * Writes a valid zip file at `outPath` containing the given entries.
 * Uses deflate compression (method=8) so yauzl exercises its decompress
 * path (matching real LWJGL classifier jars). Entries with `data.length === 0`
 * are written as stored (method=0), matching directory-marker conventions.
 */
function writeMinimalZip(outPath: string, entries: ZipEntry[]): void {
  const chunks: Buffer[] = []
  const centralRecords: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const crc = crc32(entry.data)
    const isStored = entry.data.length === 0
    const compressed = isStored ? entry.data : deflateRawSync(entry.data)
    const compressedSize = compressed.length
    const uncompressedSize = entry.data.length
    const method = isStored ? 0 : 8

    // Local file header (signature 0x04034b50)
    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4) // version
    localHeader.writeUInt16LE(0, 6) // flags
    localHeader.writeUInt16LE(method, 8)
    localHeader.writeUInt16LE(0, 10) // mod time
    localHeader.writeUInt16LE(0, 12) // mod date
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressedSize, 18)
    localHeader.writeUInt32LE(uncompressedSize, 22)
    localHeader.writeUInt16LE(nameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28) // extra field length

    chunks.push(localHeader, nameBuf, compressed)

    // Central directory file header (signature 0x02014b50)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // version made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0, 8) // flags
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(0, 12) // mod time
    central.writeUInt16LE(0, 14) // mod date
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressedSize, 20)
    central.writeUInt32LE(uncompressedSize, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30) // extra length
    central.writeUInt16LE(0, 32) // comment length
    central.writeUInt16LE(0, 34) // disk #
    central.writeUInt16LE(0, 36) // internal attrs
    central.writeUInt32LE(0, 38) // external attrs
    central.writeUInt32LE(offset, 42)
    centralRecords.push(central, nameBuf)

    offset += localHeader.length + nameBuf.length + compressed.length
  }

  const centralDirOffset = offset
  let centralDirSize = 0
  for (const r of centralRecords) centralDirSize += r.length

  // End of central directory (signature 0x06054b50)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4) // disk #
  eocd.writeUInt16LE(0, 6) // start disk
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralDirSize, 12)
  eocd.writeUInt32LE(centralDirOffset, 16)
  eocd.writeUInt16LE(0, 20) // comment length

  writeFileSync(outPath, Buffer.concat([...chunks, ...centralRecords, eocd]))
}

// CRC-32 — IEEE polynomial 0xEDB88320 (ZIP standard).
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// ---------- fixture resolved version ----------

/**
 * Minimal ResolvedVersion fixture matching the shape of @xmcl/core's parsed
 * output for our 1.8.9 manifest — we only use fields natives.ts reads.
 * The `ResolvedLibrary` shape is preserved via `isNative: true` + a
 * synthetic download.path pointing at the classifier jar we'll plant.
 */
function buildFixture(libDir: string): {
  resolved: ResolvedVersion
  windowsJarPath: string
  osxJarPath: string
} {
  const windowsJarRelPath = 'org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209-natives-windows.jar'
  const osxJarRelPath = 'org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209-natives-osx.jar'
  const windowsJarPath = path.join(libDir, windowsJarRelPath)
  const osxJarPath = path.join(libDir, osxJarRelPath)

  const resolved = {
    id: '1.8.9',
    libraries: [
      {
        name: 'org.lwjgl.lwjgl:lwjgl-platform:2.9.4-nightly-20150209',
        isNative: true,
        download: {
          path: windowsJarRelPath,
          sha1: 'ignored-in-tests',
          size: 0,
          url: ''
        },
        extractExclude: ['META-INF/'],
        // process.platform branch key (win32 → 'windows', darwin → 'osx')
        // We store the whole classifier lookup under a non-standard `natives`
        // map so natives.ts can dispatch on it. Real @xmcl/core's
        // ResolvedLibrary.isNative is true AND it has a single `download` for
        // the platform-matched classifier. We also stash a "siblings" map
        // so the test can swap what lives under libraries/ at extraction
        // time.
        _classifierJars: {
          windows: windowsJarRelPath,
          osx: osxJarRelPath
        }
      } as unknown,
      // Non-native plain library — must be skipped by natives.ts
      {
        name: 'com.paulscode:codecjorbis:20101023',
        isNative: false,
        download: {
          path: 'com/paulscode/codecjorbis/20101023/codecjorbis-20101023.jar',
          sha1: 'ignored',
          size: 0,
          url: ''
        }
      } as unknown
    ]
  } as unknown as ResolvedVersion

  return { resolved, windowsJarPath, osxJarPath }
}

// ---------- test harness ----------

const originalPlatform = process.platform

function setPlatform(p: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: p, configurable: true })
}

describe('natives.ts — ensureNatives', () => {
  let tmp: string
  let gameDir: string
  let libDir: string

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'wiiwho-natives-'))
    gameDir = path.join(tmp, 'game')
    libDir = path.join(gameDir, 'libraries')
    mkdirSync(libDir, { recursive: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('Test 1: extracts natives-windows classifier on win32 (dll present, no META-INF)', async () => {
    setPlatform('win32')
    const { resolved, windowsJarPath } = buildFixture(libDir)
    mkdirSync(path.dirname(windowsJarPath), { recursive: true })
    writeMinimalZip(windowsJarPath, [
      { name: 'lwjgl64.dll', data: Buffer.from('fake-dll-bytes') },
      { name: 'OpenAL64.dll', data: Buffer.from('fake-openal-bytes') },
      { name: 'META-INF/MANIFEST.MF', data: Buffer.from('Manifest-Version: 1.0\n') },
      { name: 'META-INF/LWJGL.SF', data: Buffer.from('fake-signature') }
    ])

    const { ensureNatives } = await import('./natives')
    const nativesDir = await ensureNatives(resolved, gameDir)

    expect(nativesDir.replace(/\\/g, '/')).toContain('game/versions/1.8.9/natives')
    expect(existsSync(path.join(nativesDir, 'lwjgl64.dll'))).toBe(true)
    expect(existsSync(path.join(nativesDir, 'OpenAL64.dll'))).toBe(true)
    // META-INF excluded
    expect(existsSync(path.join(nativesDir, 'META-INF'))).toBe(false)
    expect(existsSync(path.join(nativesDir, 'META-INF', 'LWJGL.SF'))).toBe(false)
  })

  it('Test 2: second call is idempotent — does not re-extract when dll already present', async () => {
    setPlatform('win32')
    const { resolved, windowsJarPath } = buildFixture(libDir)
    mkdirSync(path.dirname(windowsJarPath), { recursive: true })
    writeMinimalZip(windowsJarPath, [
      { name: 'lwjgl64.dll', data: Buffer.from('fake-dll-bytes') }
    ])

    const { ensureNatives } = await import('./natives')
    const nativesDir = await ensureNatives(resolved, gameDir)
    const dllPath = path.join(nativesDir, 'lwjgl64.dll')
    expect(existsSync(dllPath)).toBe(true)

    // Tamper the dll with a sentinel byte so we can detect unwanted re-extraction.
    writeFileSync(dllPath, Buffer.from('TAMPERED'))

    // Second call: natives dir is populated → should be a no-op.
    const nativesDir2 = await ensureNatives(resolved, gameDir)
    expect(nativesDir2).toBe(nativesDir)
    // Sentinel byte preserved → re-extraction did NOT run.
    const stat = readdirSync(nativesDir)
    expect(stat).toContain('lwjgl64.dll')
    const after = require('node:fs').readFileSync(dllPath, 'utf8')
    expect(after).toBe('TAMPERED')
  })

  it('Test 3: on darwin, extracts natives-osx classifier and skips natives-windows', async () => {
    setPlatform('darwin')
    const { resolved, windowsJarPath, osxJarPath } = buildFixture(libDir)

    // Plant BOTH classifier jars. natives.ts must only open the osx one.
    mkdirSync(path.dirname(windowsJarPath), { recursive: true })
    writeMinimalZip(windowsJarPath, [
      { name: 'lwjgl64.dll', data: Buffer.from('should-not-extract-on-mac') }
    ])
    mkdirSync(path.dirname(osxJarPath), { recursive: true })
    writeMinimalZip(osxJarPath, [
      { name: 'liblwjgl.dylib', data: Buffer.from('fake-dylib-bytes') },
      { name: 'libopenal.dylib', data: Buffer.from('fake-openal-dylib') },
      { name: 'META-INF/MANIFEST.MF', data: Buffer.from('Manifest-Version: 1.0\n') }
    ])

    const { ensureNatives } = await import('./natives')
    const nativesDir = await ensureNatives(resolved, gameDir)

    expect(existsSync(path.join(nativesDir, 'liblwjgl.dylib'))).toBe(true)
    expect(existsSync(path.join(nativesDir, 'libopenal.dylib'))).toBe(true)
    // MUST NOT have the Windows dll
    expect(existsSync(path.join(nativesDir, 'lwjgl64.dll'))).toBe(false)
    // META-INF excluded
    expect(existsSync(path.join(nativesDir, 'META-INF'))).toBe(false)
  })

  it('Test 4: honors extractExclude (META-INF/) — no .SF or .RSA files in natives dir', async () => {
    setPlatform('win32')
    const { resolved, windowsJarPath } = buildFixture(libDir)
    mkdirSync(path.dirname(windowsJarPath), { recursive: true })
    // Plant a jar that has META-INF signature files AT NESTED depth to catch
    // naive implementations that only filter top-level META-INF/ entries.
    writeMinimalZip(windowsJarPath, [
      { name: 'lwjgl64.dll', data: Buffer.from('fake-dll') },
      { name: 'META-INF/MANIFEST.MF', data: Buffer.from('Manifest-Version: 1.0\n') },
      { name: 'META-INF/LWJGL.SF', data: Buffer.from('fake-sig') },
      { name: 'META-INF/LWJGL.RSA', data: Buffer.from('fake-rsa') },
      { name: 'META-INF/nested/deep.RSA', data: Buffer.from('fake-deep') }
    ])

    const { ensureNatives } = await import('./natives')
    const nativesDir = await ensureNatives(resolved, gameDir)

    // Any file whose path starts with META-INF/ (cross-platform, forward-slash
    // or back-slash) must NOT exist in the natives dir.
    const walk = (dir: string, acc: string[] = []): string[] => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, name.name)
        if (name.isDirectory()) walk(full, acc)
        else acc.push(full)
      }
      return acc
    }
    const allFiles = walk(nativesDir).map((p) => p.replace(/\\/g, '/'))
    expect(allFiles.some((f) => f.includes('/META-INF/'))).toBe(false)
    expect(allFiles.some((f) => f.endsWith('.SF'))).toBe(false)
    expect(allFiles.some((f) => f.endsWith('.RSA'))).toBe(false)

    // Happy-path assertion: the .dll still made it through.
    expect(existsSync(path.join(nativesDir, 'lwjgl64.dll'))).toBe(true)
  })
})

// Dummy guard so the `createHash` import always resolves — placeholder for
// future SHA1-based idempotency checks if we ever want to verify the source
// jar hasn't changed between extraction calls.
void createHash
