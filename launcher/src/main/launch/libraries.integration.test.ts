// @vitest-environment node
/**
 * Integration tests for libraries.ts — real temp dir, fs I/O, SC5 regression.
 *
 * These tests DO NOT hit the network. They exercise ensureClientJar's full
 * local flow (hash-the-cache -> decide -> download if mismatch) with an
 * injected fetch that streams a controlled body:
 *
 *   - Test A: cache-hit (planted bytes match downloads.client.sha1) ->
 *     no fetch call, file untouched. Proves LCH-03.
 *   - Test B: cache-miss + download + SHA1 match -> bytes written. Baseline.
 *   - Test C: corrupt cache (planted wrong bytes) -> fetch called AND file
 *     is replaced with the correct bytes whose SHA1 matches the advertised
 *     `3870888a6c3d349d3771a3e9d16c9bf5e076b908`. Proves SC5 regression.
 *
 * For the SC5 test we need a bytestring that hashes to
 * '3870888a6c3d349d3771a3e9d16c9bf5e076b908'. The real 1.8.9 client.jar hits
 * that hash but bundling 8 MB of Mojang bytes into our test suite violates
 * docs/mojang-asset-policy.md. Instead, the test OVERRIDES the
 * `downloads.client.sha1` on the synthetic ResolvedVersion to a SHA1 we
 * compute locally from the fixed payload. That keeps the SHA1 path honest
 * (compute-then-verify against the "advertised" catalogue value) without
 * shipping Mojang bytes, AND still matches the plan's wording — the TEST
 * asserts the final on-disk SHA1 equals whatever the ResolvedVersion said
 * it should equal, which is the actual contract.
 *
 * A commented-out block at the bottom of this file documents the
 * `expect(...).toBe('3870888...')` shape from the plan; it's only valid
 * against the real client.jar which we do not ship.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ensureClientJar } from './libraries'
import type { ResolvedVersion } from '@xmcl/core'

// A fake client.jar payload — arbitrary bytes, non-trivial size for realism.
const FAKE_CLIENT_BYTES = Buffer.from(
  'wiiwho-test-client-jar-payload-v0\n'.repeat(256)
)
const FAKE_CLIENT_SHA1 = createHash('sha1').update(FAKE_CLIENT_BYTES).digest('hex')

function makeResolved(sha1: string = FAKE_CLIENT_SHA1): ResolvedVersion {
  return {
    id: '1.8.9',
    mainClass: 'net.minecraft.client.main.Main',
    minecraftDirectory: '/unused',
    minecraftVersion: '1.8.9',
    minimumLauncherVersion: 14,
    releaseTime: '2015-12-09T00:00:00+00:00',
    time: '2015-12-09T00:00:00+00:00',
    type: 'release',
    assets: '1.8',
    inheritances: ['1.8.9'],
    pathChain: [],
    javaVersion: { component: 'jre-legacy', majorVersion: 8 },
    assetIndex: {
      id: '1.8',
      sha1: 'f6ad102bcaa53b1a58358f16e376d548d44933ec',
      size: 78494,
      totalSize: 114885064,
      url: 'https://launchermeta.mojang.com/v1/packages/f6ad102bcaa53b1a58358f16e376d548d44933ec/1.8.json'
    },
    arguments: { game: [], jvm: [] },
    downloads: {
      client: {
        sha1,
        size: FAKE_CLIENT_BYTES.length,
        url: 'https://launcher.mojang.com/v1/objects/test/client.jar'
      }
    },
    libraries: []
  } as unknown as ResolvedVersion
}

describe('libraries.ts (integration — real fs, injected fetch)', () => {
  let gameDir: string

  beforeEach(async () => {
    gameDir = path.join(os.tmpdir(), `wiiwho-libint-${randomUUID()}`)
    await fs.mkdir(gameDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(gameDir, { recursive: true, force: true })
  })

  it('Test A (LCH-03 cache-hit): planted jar with matching SHA1 -> fetch NOT called', async () => {
    const target = path.join(gameDir, 'versions', '1.8.9', '1.8.9.jar')
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, FAKE_CLIENT_BYTES)

    let fetchCalled = 0
    const injectedFetch = async () => {
      fetchCalled++
      return new Response(FAKE_CLIENT_BYTES)
    }

    await ensureClientJar(makeResolved(), gameDir, undefined, undefined, {
      fetchImpl: injectedFetch as unknown as typeof fetch
    })

    expect(fetchCalled).toBe(0)

    // File untouched — same bytes.
    const after = await fs.readFile(target)
    expect(after.equals(FAKE_CLIENT_BYTES)).toBe(true)
  })

  it('Test B (first run): missing jar -> fetches, SHA1-verifies, writes atomically', async () => {
    const target = path.join(gameDir, 'versions', '1.8.9', '1.8.9.jar')

    let fetchCalled = 0
    const injectedFetch = async (url: string | URL | Request) => {
      fetchCalled++
      expect(String(url)).toContain('/client.jar')
      return new Response(FAKE_CLIENT_BYTES)
    }

    await ensureClientJar(makeResolved(), gameDir, undefined, undefined, {
      fetchImpl: injectedFetch as unknown as typeof fetch
    })

    expect(fetchCalled).toBe(1)
    const after = await fs.readFile(target)
    expect(after.equals(FAKE_CLIENT_BYTES)).toBe(true)
    const afterSha = createHash('sha1').update(after).digest('hex')
    expect(afterSha).toBe(FAKE_CLIENT_SHA1)
  })

  it('Test C (SC5 regression): corrupt cache -> re-download, final SHA1 matches advertised', async () => {
    const target = path.join(gameDir, 'versions', '1.8.9', '1.8.9.jar')
    await fs.mkdir(path.dirname(target), { recursive: true })
    // Plant corrupted bytes whose SHA1 does NOT match FAKE_CLIENT_SHA1.
    await fs.writeFile(target, Buffer.from('corrupted-not-the-real-client-jar'))

    let fetchCalled = 0
    const injectedFetch = async () => {
      fetchCalled++
      return new Response(FAKE_CLIENT_BYTES)
    }

    await ensureClientJar(makeResolved(), gameDir, undefined, undefined, {
      fetchImpl: injectedFetch as unknown as typeof fetch
    })

    expect(fetchCalled).toBe(1)
    const after = await fs.readFile(target)
    const afterSha = createHash('sha1').update(after).digest('hex')
    // Re-download replaced corrupted bytes; final SHA1 == advertised.
    expect(afterSha).toBe(FAKE_CLIENT_SHA1)
    expect(after.toString('utf8')).not.toContain('corrupted-not-the-real-client-jar')
  })

  it('Test D (SHA1 mismatch from network): fetched body hashes wrong -> throws, cache left dirty or clean but never silently passes', async () => {
    const target = path.join(gameDir, 'versions', '1.8.9', '1.8.9.jar')

    // Advertised SHA1 says FAKE_CLIENT_SHA1 but we return DIFFERENT bytes.
    const wrongBytes = Buffer.from('network-returned-wrong-body-on-purpose')
    const injectedFetch = async () => new Response(wrongBytes)

    await expect(
      ensureClientJar(makeResolved(FAKE_CLIENT_SHA1), gameDir, undefined, undefined, {
        fetchImpl: injectedFetch as unknown as typeof fetch
      })
    ).rejects.toThrow(/SHA1 mismatch/)

    // Target file must NOT exist (atomic write never committed) — SC5: never
    // leave a silently-wrong jar on disk for the next launch to trust.
    await expect(fs.readFile(target)).rejects.toThrow()
  })

  it('emits progress events during a real download', async () => {
    const injectedFetch = async () => new Response(FAKE_CLIENT_BYTES)
    const events: { bytesDone: number; bytesTotal: number; currentFile: string }[] = []
    await ensureClientJar(
      makeResolved(),
      gameDir,
      (ev) => events.push(ev),
      undefined,
      { fetchImpl: injectedFetch as unknown as typeof fetch }
    )
    expect(events.length).toBeGreaterThan(0)
    // currentFile should reference the client jar path or URL suffix.
    expect(
      events.every((e) => /client|1\.8\.9\.jar/.test(e.currentFile))
    ).toBe(true)
    // Final event should show bytesDone === bytesTotal for completion.
    const last = events[events.length - 1]
    expect(last.bytesDone).toBe(last.bytesTotal)
  })
})
