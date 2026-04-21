#!/usr/bin/env node
/**
 * Prefetch Temurin 8 JRE tarballs for all platform slots.
 *
 * - Downloads tarballs from Adoptium public CDN
 * - SHA256-verifies every download against the sibling `.sha256.txt`
 * - Extracts via platform-appropriate tools (tar for .tar.gz, PowerShell Expand-Archive for .zip)
 * - Flattens the top-level `jdk8u482-b08-jre/` into `launcher/resources/jre/<slot>/`
 * - Idempotent: skips slots whose expected binary already exists on disk
 *
 * Zero-dep by design (Node 22 builtins only). No `npm install` required on CI.
 *
 * Open Q §1 resolution (2026-04-21): Temurin 8 has NO macOS arm64 JRE. Rather than
 * pull Azul Zulu (different vendor, different integrity API), we ship x64 Temurin
 * for BOTH mac slots and let Rosetta 2 handle Apple Silicon. 1.8.9 LWJGL natives
 * are x86_64-only anyway, so the JVM runs x86_64 regardless of host arch.
 * ~70 MB smaller installer; same runtime behavior.
 *
 * Sources:
 *   https://github.com/adoptium/temurin8-binaries/releases (verified live 2026-04-21)
 */

import {
  mkdirSync,
  existsSync,
  createWriteStream,
  createReadStream,
  rmSync,
  readdirSync,
  renameSync,
  statSync
} from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import process from 'node:process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const LAUNCHER_DIR = resolve(__dirname, '..')
const JRE_ROOT = join(LAUNCHER_DIR, 'resources', 'jre')
const CACHE_DIR = join(LAUNCHER_DIR, 'resources', '.jre-cache')

const TEMURIN_VERSION = 'jdk8u482-b08'
const TEMURIN_EXTRACTED_TOP = 'jdk8u482-b08-jre'

/**
 * JRE source descriptors.
 *
 * Note: `mac-arm64` intentionally points at the x64 Temurin tarball per Open Q §1.
 * The extraction still produces `jdk8u482-b08-jre/` → `mac-arm64/` which paths.ts
 * will select on arm64 hosts. Rosetta 2 handles execution.
 */
const SOURCES = [
  {
    slot: 'win-x64',
    url: `https://github.com/adoptium/temurin8-binaries/releases/download/${TEMURIN_VERSION}/OpenJDK8U-jre_x64_windows_hotspot_8u482b08.zip`,
    sha256Url: `https://github.com/adoptium/temurin8-binaries/releases/download/${TEMURIN_VERSION}/OpenJDK8U-jre_x64_windows_hotspot_8u482b08.zip.sha256.txt`,
    archive: 'OpenJDK8U-jre_x64_windows_hotspot_8u482b08.zip',
    kind: 'zip',
    // populated slot check → <slot>/bin/javaw.exe
    doneMarker: ['bin', 'javaw.exe']
  },
  {
    slot: 'mac-x64',
    url: `https://github.com/adoptium/temurin8-binaries/releases/download/${TEMURIN_VERSION}/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz`,
    sha256Url: `https://github.com/adoptium/temurin8-binaries/releases/download/${TEMURIN_VERSION}/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz.sha256.txt`,
    archive: 'OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz',
    kind: 'tar.gz',
    // populated slot check → <slot>/Contents/Home/bin/java
    doneMarker: ['Contents', 'Home', 'bin', 'java']
  },
  {
    // Open Q §1: x64 Temurin bundled into the mac-arm64 slot. Rosetta 2 handles it.
    slot: 'mac-arm64',
    url: `https://github.com/adoptium/temurin8-binaries/releases/download/${TEMURIN_VERSION}/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz`,
    sha256Url: `https://github.com/adoptium/temurin8-binaries/releases/download/${TEMURIN_VERSION}/OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz.sha256.txt`,
    archive: 'OpenJDK8U-jre_x64_mac_hotspot_8u482b08.tar.gz',
    kind: 'tar.gz',
    doneMarker: ['Contents', 'Home', 'bin', 'java']
  }
]

function log(...args) {
  console.log('[prefetch-jre]', ...args)
}

function err(...args) {
  console.error('[prefetch-jre]', ...args)
}

async function downloadToFile(url, outPath) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`GET ${url} failed: HTTP ${res.status}`)
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath))
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`GET ${url} failed: HTTP ${res.status}`)
  }
  return res.text()
}

function sha256File(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const s = createReadStream(path)
    s.on('data', (chunk) => hash.update(chunk))
    s.on('end', () => resolvePromise(hash.digest('hex')))
    s.on('error', reject)
  })
}

function parseSha256Text(text) {
  // Adoptium sha256 text files look like: "<hex>  <filename>\n"
  const m = text.trim().split(/\s+/)[0]
  if (!/^[0-9a-fA-F]{64}$/.test(m)) {
    throw new Error(`Malformed SHA256 line: ${text.slice(0, 200)}`)
  }
  return m.toLowerCase()
}

function runCmd(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`)
  }
}

function extractTarGz(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true })
  // `tar` is available on Windows 10+, macOS, and Linux.
  runCmd('tar', ['-xzf', archivePath, '-C', destDir])
}

function extractZip(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    // PowerShell Expand-Archive is the canonical Windows unzip.
    // -Force overwrites if temp dir already has stale contents.
    runCmd('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${destDir}' -Force`
    ])
  } else {
    // unzip on mac/linux (we're unlikely to ever extract the win-x64 zip on non-Windows,
    // but it's a one-liner to support).
    runCmd('unzip', ['-q', '-o', archivePath, '-d', destDir])
  }
}

function flattenExtraction(tempDir, finalDir, expectedInnerName) {
  // Expected layout: <tempDir>/<expectedInnerName>/<real contents>
  const innerPath = join(tempDir, expectedInnerName)
  if (!existsSync(innerPath)) {
    // Fall back to auto-detect — take first dir entry.
    const entries = readdirSync(tempDir)
    if (entries.length !== 1) {
      throw new Error(
        `Expected exactly one top-level dir in ${tempDir}, found ${entries.length}: ${entries.join(', ')}`
      )
    }
    const alt = join(tempDir, entries[0])
    if (!statSync(alt).isDirectory()) {
      throw new Error(`Expected a directory at ${alt}`)
    }
    moveDir(alt, finalDir)
    return
  }
  moveDir(innerPath, finalDir)
}

function moveDir(src, dest) {
  // Ensure dest parent exists; remove any stale final dir.
  mkdirSync(dirname(dest), { recursive: true })
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true })
  }
  renameSync(src, dest)
}

function isPopulated(slotDir, marker) {
  const probe = join(slotDir, ...marker)
  return existsSync(probe)
}

async function processSlot(source) {
  const slotDir = join(JRE_ROOT, source.slot)
  if (isPopulated(slotDir, source.doneMarker)) {
    log(`SKIP ${source.slot}: already populated (${source.doneMarker.join('/')} exists)`)
    return { slot: source.slot, status: 'skipped' }
  }

  mkdirSync(CACHE_DIR, { recursive: true })
  const archivePath = join(CACHE_DIR, source.archive)

  // Fetch SHA256 first so we can validate a possibly-cached archive.
  log(`${source.slot}: fetching SHA256 from ${source.sha256Url}`)
  const shaText = await fetchText(source.sha256Url)
  const expectedSha = parseSha256Text(shaText)

  let needDownload = true
  if (existsSync(archivePath)) {
    log(`${source.slot}: archive cached, verifying SHA256...`)
    const actual = await sha256File(archivePath)
    if (actual === expectedSha) {
      log(`${source.slot}: cached archive SHA256 OK`)
      needDownload = false
    } else {
      log(`${source.slot}: cached SHA mismatch (expected ${expectedSha}, got ${actual}); re-downloading`)
      rmSync(archivePath, { force: true })
    }
  }

  if (needDownload) {
    log(`${source.slot}: downloading ${source.url}`)
    const tmp = `${archivePath}.part`
    await downloadToFile(source.url, tmp)
    const actual = await sha256File(tmp)
    if (actual !== expectedSha) {
      rmSync(tmp, { force: true })
      throw new Error(
        `SHA256 mismatch for ${source.slot}: expected ${expectedSha}, got ${actual}`
      )
    }
    renameSync(tmp, archivePath)
    log(`${source.slot}: downloaded + SHA256 verified`)
  }

  // Extract into a temp dir so we can cleanly flatten the `jdk8u482-b08-jre/` shell.
  const tempExtract = join(CACHE_DIR, `extract-${source.slot}`)
  if (existsSync(tempExtract)) {
    rmSync(tempExtract, { recursive: true, force: true })
  }
  mkdirSync(tempExtract, { recursive: true })

  if (source.kind === 'tar.gz') {
    extractTarGz(archivePath, tempExtract)
  } else if (source.kind === 'zip') {
    extractZip(archivePath, tempExtract)
  } else {
    throw new Error(`Unknown archive kind: ${source.kind}`)
  }

  flattenExtraction(tempExtract, slotDir, TEMURIN_EXTRACTED_TOP)
  rmSync(tempExtract, { recursive: true, force: true })

  if (!isPopulated(slotDir, source.doneMarker)) {
    throw new Error(
      `${source.slot}: post-extract check failed — marker ${source.doneMarker.join('/')} missing under ${slotDir}`
    )
  }
  log(`${source.slot}: OK → ${slotDir}`)
  return { slot: source.slot, status: 'extracted' }
}

async function main() {
  log(`root: ${JRE_ROOT}`)
  mkdirSync(JRE_ROOT, { recursive: true })

  const results = []
  for (const src of SOURCES) {
    try {
      results.push(await processSlot(src))
    } catch (e) {
      err(`FAIL ${src.slot}: ${e.message}`)
      process.exit(1)
    }
  }

  log('summary:')
  for (const r of results) {
    log(`  ${r.slot}: ${r.status}`)
  }
  log('done.')
}

main().catch((e) => {
  err(e?.stack || e?.message || String(e))
  process.exit(1)
})
