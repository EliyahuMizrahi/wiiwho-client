// @vitest-environment node
/**
 * Tests for manifest.ts — the Mojang version_manifest_v2 + 1.8.9 client.json
 * fetcher/cacher.
 *
 * Invariants under test (LCH-01, SC5):
 *   - First-run fetches version_manifest_v2 AND the per-version JSON,
 *     SHA1-verifies the per-version body against the catalogue, and writes it
 *     to <gameDir>/versions/1.8.9/1.8.9.json atomically.
 *   - Warm cache (correct SHA1 on disk) does NOT re-fetch the per-version JSON.
 *   - Corrupted cache (mismatched SHA1 on disk) triggers a re-download and the
 *     file is replaced with the correct bytes (SC5 / LCH-03 re-download path).
 *   - resolveVersion() hands off to @xmcl/core Version.parse and returns the
 *     expected vanilla 1.8.9 shape (mainClass, assetIndex.id === '1.8',
 *     libraries array non-empty).
 *   - Network errors on the version_manifest fetch surface as typed Errors the
 *     orchestrator (Plan 03-10) maps to the D-14 "can't reach Mojang" UX.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  fetchAndCacheManifest,
  resolveVersion,
  VERSION_MANIFEST_URL
} from './manifest'

// Canonical SHA1s from .planning/phases/03/03-RESEARCH.md §Mojang Manifest Shape.
const MANIFEST_SHA1 = 'd546f1707a3f2b7d034eece5ea2e311eda875787'
const PER_VERSION_URL = `https://piston-meta.mojang.com/v1/packages/${MANIFEST_SHA1}/1.8.9.json`

const FIXTURE_PATH = path.join(__dirname, '__fixtures__', '1.8.9-manifest.json')

// Build a synthetic per-version body whose SHA1 matches MANIFEST_SHA1 — the
// real manifest's bytes hash to MANIFEST_SHA1 by definition, but our trimmed
// fixture does NOT. So for the verification tests we compute the actual fixture
// SHA1 and use *that* as the "catalogue" SHA1 in the mocked version_manifest
// response. This keeps the cryptographic check honest without embedding 60 KB
// of real Mojang JSON.
function fixtureSha1(): string {
  const buf = readFileSync(FIXTURE_PATH)
  return createHash('sha1').update(buf).digest('hex')
}

function buildVersionManifestBody(fixtureActualSha1: string): string {
  return JSON.stringify({
    latest: { release: '1.8.9', snapshot: '1.8.9' },
    versions: [
      {
        id: '1.8.9',
        type: 'release',
        url: PER_VERSION_URL,
        time: '2015-12-09T00:00:00+00:00',
        releaseTime: '2015-12-09T00:00:00+00:00',
        sha1: fixtureActualSha1
      }
    ]
  })
}

describe('manifest.ts', () => {
  let gameDir: string
  const fixtureBytes = readFileSync(FIXTURE_PATH)
  const fixtureBodyStr = fixtureBytes.toString('utf8')
  const FIXTURE_SHA1 = fixtureSha1()

  beforeEach(async () => {
    gameDir = path.join(os.tmpdir(), `wiiwho-test-${randomUUID()}`)
    await fs.mkdir(gameDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(gameDir, { recursive: true, force: true })
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('exports the version_manifest_v2 URL constant (piston-meta.mojang.com)', () => {
    expect(VERSION_MANIFEST_URL).toBe(
      'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
    )
  })

  it('fetchAndCacheManifest — first run: fetches catalogue + per-version, SHA1-verifies, writes to disk', async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('version_manifest_v2')) {
        return new Response(buildVersionManifestBody(FIXTURE_SHA1))
      }
      if (u.endsWith('/1.8.9.json')) {
        return new Response(fixtureBodyStr)
      }
      throw new Error(`unexpected fetch: ${u}`)
    })

    const result = await fetchAndCacheManifest('1.8.9', gameDir, mockFetch as unknown as typeof fetch)

    expect(result.sha1).toBe(FIXTURE_SHA1)
    expect(result.path).toMatch(/versions[\\/]1\.8\.9[\\/]1\.8\.9\.json$/)

    // Manifest shape sanity — main class + asset index id.
    const manifest = result.manifest as { mainClass: string; assetIndex: { id: string } }
    expect(manifest.mainClass).toBe('net.minecraft.client.main.Main')
    expect(manifest.assetIndex.id).toBe('1.8')

    // Disk file bytes match the fixture bytes, byte-for-byte.
    const diskBytes = await fs.readFile(result.path)
    expect(diskBytes.equals(fixtureBytes)).toBe(true)

    // Exactly two fetches (catalogue + per-version).
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('fetchAndCacheManifest — warm cache: does NOT re-download the per-version JSON', async () => {
    // Plant the correct per-version JSON at the target path first.
    const target = path.join(gameDir, 'versions', '1.8.9', '1.8.9.json')
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, fixtureBytes)

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('version_manifest_v2')) {
        return new Response(buildVersionManifestBody(FIXTURE_SHA1))
      }
      if (u.endsWith('/1.8.9.json')) {
        throw new Error('per-version fetch should NOT happen on warm cache')
      }
      throw new Error(`unexpected fetch: ${u}`)
    })

    const result = await fetchAndCacheManifest('1.8.9', gameDir, mockFetch as unknown as typeof fetch)

    expect(result.sha1).toBe(FIXTURE_SHA1)
    // Exactly ONE fetch — catalogue only.
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('fetchAndCacheManifest — corrupted cache: re-downloads and replaces the bad file (SC5)', async () => {
    const target = path.join(gameDir, 'versions', '1.8.9', '1.8.9.json')
    await fs.mkdir(path.dirname(target), { recursive: true })
    // Plant a DIFFERENT body whose SHA1 does NOT match the catalogue SHA1.
    await fs.writeFile(target, Buffer.from('corrupted-bytes-not-the-real-manifest'))

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('version_manifest_v2')) {
        return new Response(buildVersionManifestBody(FIXTURE_SHA1))
      }
      if (u.endsWith('/1.8.9.json')) {
        return new Response(fixtureBodyStr)
      }
      throw new Error(`unexpected fetch: ${u}`)
    })

    const result = await fetchAndCacheManifest('1.8.9', gameDir, mockFetch as unknown as typeof fetch)

    expect(result.sha1).toBe(FIXTURE_SHA1)
    // Re-downloaded — 2 fetches.
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // On-disk bytes are now the correct fixture bytes, NOT the corrupted input.
    const diskBytes = await fs.readFile(result.path)
    expect(diskBytes.equals(fixtureBytes)).toBe(true)
    expect(diskBytes.toString('utf8')).not.toContain('corrupted-bytes-not-the-real-manifest')
  })

  it('fetchAndCacheManifest — rejects unknown Minecraft version ids with a typed error', async () => {
    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ latest: { release: '1.8.9', snapshot: '1.8.9' }, versions: [] })
      )
    )
    await expect(
      fetchAndCacheManifest('9.9.9', gameDir, mockFetch as unknown as typeof fetch)
    ).rejects.toThrow(/Unknown Minecraft version: 9\.9\.9/)
  })

  it('fetchAndCacheManifest — per-version SHA1 mismatch throws (LCH-01 enforcement)', async () => {
    // Catalogue says SHA1 = '0000...' but per-version body is the real fixture
    // (which hashes to FIXTURE_SHA1) — so validation must fail.
    const bogusSha1 = '0000000000000000000000000000000000000000'
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('version_manifest_v2')) {
        return new Response(buildVersionManifestBody(bogusSha1))
      }
      if (u.endsWith('/1.8.9.json')) {
        return new Response(fixtureBodyStr)
      }
      throw new Error(`unexpected fetch: ${u}`)
    })

    await expect(
      fetchAndCacheManifest('1.8.9', gameDir, mockFetch as unknown as typeof fetch)
    ).rejects.toThrow(/SHA1 mismatch/)
  })

  it('fetchAndCacheManifest — version_manifest fetch failure surfaces as a typed error', async () => {
    const mockFetch = vi.fn(async () =>
      new Response('service unavailable', { status: 503, statusText: 'Service Unavailable' })
    )

    await expect(
      fetchAndCacheManifest('1.8.9', gameDir, mockFetch as unknown as typeof fetch)
    ).rejects.toThrow(/version_manifest_v2 fetch failed/)
  })

  it('fetchAndCacheManifest — propagates AbortSignal to the underlying fetch', async () => {
    const seenSignals: (AbortSignal | undefined)[] = []
    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seenSignals.push(init?.signal ?? undefined)
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('version_manifest_v2')) {
        return new Response(buildVersionManifestBody(FIXTURE_SHA1))
      }
      if (u.endsWith('/1.8.9.json')) {
        return new Response(fixtureBodyStr)
      }
      throw new Error(`unexpected fetch: ${u}`)
    })

    const controller = new AbortController()
    await fetchAndCacheManifest(
      '1.8.9',
      gameDir,
      mockFetch as unknown as typeof fetch,
      controller.signal
    )
    // Both fetches should have received the signal.
    expect(seenSignals.every((s) => s === controller.signal)).toBe(true)
  })

  it('resolveVersion returns the vanilla 1.8.9 ResolvedVersion with expected mainClass/assetIndex', async () => {
    // Plant the fixture manifest so @xmcl/core can read it.
    const target = path.join(gameDir, 'versions', '1.8.9', '1.8.9.json')
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, fixtureBytes)

    const resolved = await resolveVersion(gameDir, '1.8.9')
    expect(resolved.id).toBe('1.8.9')
    expect(resolved.mainClass).toBe('net.minecraft.client.main.Main')
    // assetIndex.id is `1.8` not `1.8.9` — Pitfall 8 guard.
    expect(resolved.assetIndex?.id).toBe('1.8')
    // Libraries array non-empty (fixture has 3 entries — lwjgl-platform,
    // codecjorbis, and the intentionally-bad SC5 fixture).
    expect(resolved.libraries.length).toBeGreaterThan(0)
  })
})
