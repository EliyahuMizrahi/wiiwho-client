// @vitest-environment node
/**
 * Tests for assets.ts — the asset-index + objects pipeline.
 *
 * Invariants (LCH-02, Pitfall 8):
 *   - assetIndex.id === '1.8' (NOT '1.8.9'). Pitfall 8 guardrail.
 *   - ensureAssets delegates to @xmcl/installer installAssets.
 *   - Progress events match the frozen game:progress shape.
 *   - AbortSignal is honoured.
 *   - Asset index + objects end up under <gameDir>/assets/{indexes,objects}/.
 *   - Cache-hit (index bytes + objects on disk) is a no-op for the installer.
 *
 * Strategy: mock @xmcl/installer.installAssets wholesale. We side-effect the
 * fake installer to write a minimal index + 2 object files to the expected
 * paths so the layout assertions are observable.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

const mockInstallAssets = vi.fn()
vi.mock('@xmcl/installer', () => ({
  installAssets: (...args: unknown[]) => mockInstallAssets(...args)
}))

import { ensureAssets } from './assets'
import type { ProgressEvent } from './libraries'
import type { ResolvedVersion } from '@xmcl/core'

function makeResolved(gameDir: string, assetsId = '1.8'): ResolvedVersion {
  return {
    id: '1.8.9',
    mainClass: 'net.minecraft.client.main.Main',
    minecraftDirectory: gameDir,
    minecraftVersion: '1.8.9',
    minimumLauncherVersion: 14,
    releaseTime: '2015-12-09T00:00:00+00:00',
    time: '2015-12-09T00:00:00+00:00',
    type: 'release',
    assets: assetsId,
    inheritances: ['1.8.9'],
    pathChain: [],
    javaVersion: { component: 'jre-legacy', majorVersion: 8 },
    assetIndex: {
      id: assetsId,
      sha1: 'f6ad102bcaa53b1a58358f16e376d548d44933ec',
      size: 78494,
      totalSize: 114885064,
      url: `https://launchermeta.mojang.com/v1/packages/f6ad102bcaa53b1a58358f16e376d548d44933ec/${assetsId}.json`
    },
    arguments: { game: [], jvm: [] },
    downloads: {
      client: {
        sha1: '3870888a6c3d349d3771a3e9d16c9bf5e076b908',
        size: 8461484,
        url: 'https://launcher.mojang.com/v1/objects/3870888a6c3d349d3771a3e9d16c9bf5e076b908/client.jar'
      }
    },
    libraries: []
  } as unknown as ResolvedVersion
}

describe('assets.ts', () => {
  let gameDir: string

  beforeEach(async () => {
    gameDir = path.join(os.tmpdir(), `wiiwho-assets-${randomUUID()}`)
    await fs.mkdir(gameDir, { recursive: true })
    mockInstallAssets.mockReset()
  })

  afterEach(async () => {
    await fs.rm(gameDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('delegates to @xmcl/installer installAssets with the resolved version', async () => {
    mockInstallAssets.mockResolvedValue(makeResolved(gameDir))
    const resolved = makeResolved(gameDir)
    await ensureAssets(resolved, gameDir)
    expect(mockInstallAssets).toHaveBeenCalledTimes(1)
    expect(mockInstallAssets).toHaveBeenCalledWith(resolved, expect.any(Object))
  })

  it('emits progress events matching the frozen {bytesDone, bytesTotal, currentFile} shape', async () => {
    mockInstallAssets.mockResolvedValue(makeResolved(gameDir))
    const resolved = makeResolved(gameDir)
    const events: ProgressEvent[] = []
    await ensureAssets(resolved, gameDir, (ev) => events.push(ev))
    expect(events.length).toBeGreaterThan(0)
    for (const ev of events) {
      expect(ev).toMatchObject({
        bytesDone: expect.any(Number),
        bytesTotal: expect.any(Number),
        currentFile: expect.any(String)
      })
    }
    // currentFile mentions the asset index id — `1.8` per Pitfall 8.
    expect(events.some((e) => e.currentFile.includes('1.8'))).toBe(true)
  })

  it('asset index JSON lands at <gameDir>/assets/indexes/<id>.json after a run', async () => {
    // Simulate the installer writing the index to the expected location.
    mockInstallAssets.mockImplementation(async (resolved: ResolvedVersion) => {
      const indexPath = path.join(
        gameDir,
        'assets',
        'indexes',
        `${resolved.assetIndex!.id}.json`
      )
      await fs.mkdir(path.dirname(indexPath), { recursive: true })
      await fs.writeFile(indexPath, '{"objects":{}}')
      return resolved
    })

    await ensureAssets(makeResolved(gameDir), gameDir)

    const indexPath = path.join(gameDir, 'assets', 'indexes', '1.8.json')
    const stat = await fs.stat(indexPath)
    expect(stat.isFile()).toBe(true)
  })

  it('object files land at <gameDir>/assets/objects/<xx>/<hash> per Mojang CDN layout', async () => {
    // Two fake objects with known hashes so the xx/hash path split is testable.
    const objects = [
      {
        hash: 'aabbccdd0000000000000000000000000000eeff',
        body: Buffer.from('object-a')
      },
      {
        hash: '11223344556677889900aabbccddeeff00112233',
        body: Buffer.from('object-b')
      }
    ]

    mockInstallAssets.mockImplementation(async (resolved: ResolvedVersion) => {
      // Write index.
      const indexPath = path.join(
        gameDir,
        'assets',
        'indexes',
        `${resolved.assetIndex!.id}.json`
      )
      await fs.mkdir(path.dirname(indexPath), { recursive: true })
      await fs.writeFile(
        indexPath,
        JSON.stringify({
          objects: objects.reduce(
            (acc, o, i) => ({
              ...acc,
              [`fake-${i}`]: { hash: o.hash, size: o.body.length }
            }),
            {}
          )
        })
      )
      // Write objects per Mojang's <xx>/<hash> layout.
      for (const o of objects) {
        const xx = o.hash.substring(0, 2)
        const objPath = path.join(gameDir, 'assets', 'objects', xx, o.hash)
        await fs.mkdir(path.dirname(objPath), { recursive: true })
        await fs.writeFile(objPath, o.body)
      }
      return resolved
    })

    await ensureAssets(makeResolved(gameDir), gameDir)

    for (const o of objects) {
      const xx = o.hash.substring(0, 2)
      const objPath = path.join(gameDir, 'assets', 'objects', xx, o.hash)
      const readBack = await fs.readFile(objPath)
      expect(readBack.equals(o.body)).toBe(true)
    }
  })

  it('cache hit (index + objects present) still calls installAssets — LCH-03 relies on xmcl diagnose-first skip', async () => {
    // Plant the index + objects first.
    const indexPath = path.join(gameDir, 'assets', 'indexes', '1.8.json')
    await fs.mkdir(path.dirname(indexPath), { recursive: true })
    await fs.writeFile(indexPath, '{"objects":{}}')

    mockInstallAssets.mockResolvedValue(makeResolved(gameDir))

    await ensureAssets(makeResolved(gameDir), gameDir)
    // installAssets IS called — it does its own diagnose-first SHA1 skip, so
    // the wrapper always delegates. The skip-the-network optimisation lives
    // inside xmcl, not in our wrapper. What we guarantee: delegate cleanly
    // + no duplicate work our side.
    expect(mockInstallAssets).toHaveBeenCalledTimes(1)

    // Index is still there, bytes-for-bytes.
    const bytes = await fs.readFile(indexPath, 'utf8')
    expect(bytes).toBe('{"objects":{}}')
  })

  it('forwards AbortSignal into the installer options bag', async () => {
    mockInstallAssets.mockResolvedValue(makeResolved(gameDir))
    const controller = new AbortController()
    await ensureAssets(
      makeResolved(gameDir),
      gameDir,
      undefined,
      controller.signal
    )
    const [, opts] = mockInstallAssets.mock.calls[0] as [unknown, { abortSignal?: AbortSignal }]
    expect(opts.abortSignal).toBe(controller.signal)
  })
})
