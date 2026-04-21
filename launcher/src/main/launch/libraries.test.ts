// @vitest-environment node
/**
 * Unit tests for libraries.ts — mocked @xmcl/installer, no filesystem work.
 *
 * Covers:
 *   - ensureClientJar: validates cached client.jar SHA1 first; re-downloads
 *     on missing OR mismatch; skips on cache-hit (LCH-03 + SC5).
 *   - ensureLibraries: delegates to @xmcl/installer installLibraries with a
 *     resolved version; forwards an AbortSignal into the options bag.
 *   - resolveClasspath: produces an ordered array where every library jar
 *     precedes client.jar (vanilla 1.8.9 classpath order).
 *   - Progress callbacks emit the frozen {bytesDone, bytesTotal, currentFile}
 *     shape required by wiiwho.d.ts game.onProgress.
 *
 * Integration tests live in libraries.integration.test.ts (they use a real
 * temp dir for the client-jar SHA1 flow).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import path from 'node:path'

// Mock the installer module wholesale — we are NOT testing xmcl here, we're
// testing the wrapper's delegation and progress plumbing.
const mockInstallLibraries = vi.fn()
const mockInstallMinecraft = vi.fn()
vi.mock('@xmcl/installer', () => ({
  installLibraries: (...args: unknown[]) => mockInstallLibraries(...args),
  install: (...args: unknown[]) => mockInstallMinecraft(...args)
}))

import {
  ensureClientJar,
  ensureLibraries,
  resolveClasspath,
  type ProgressEvent
} from './libraries'
import type { ResolvedVersion } from '@xmcl/core'

function makeResolved(overrides: Partial<ResolvedVersion> = {}): ResolvedVersion {
  // Minimal ResolvedVersion fixture with one library + client.jar download.
  return {
    id: '1.8.9',
    mainClass: 'net.minecraft.client.main.Main',
    minecraftDirectory: '/game',
    minecraftVersion: '1.8.9',
    minimumLauncherVersion: 14,
    releaseTime: '2015-12-09T00:00:00+00:00',
    time: '2015-12-09T00:00:00+00:00',
    type: 'release',
    assets: '1.8',
    inheritances: ['1.8.9'],
    pathChain: ['/game/versions/1.8.9/1.8.9.json'],
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
        sha1: '3870888a6c3d349d3771a3e9d16c9bf5e076b908',
        size: 8461484,
        url: 'https://launcher.mojang.com/v1/objects/3870888a6c3d349d3771a3e9d16c9bf5e076b908/client.jar'
      }
    },
    libraries: [
      {
        name: 'com.paulscode:codecjorbis:20101023',
        download: {
          sha1: 'c293f4b13eb2e9cfd6d0a0e339afc96a02cfa2f2',
          size: 99298,
          path: 'com/paulscode/codecjorbis/20101023/codecjorbis-20101023.jar',
          url: 'https://libraries.minecraft.net/com/paulscode/codecjorbis/20101023/codecjorbis-20101023.jar'
        },
        isNative: false,
        groupId: 'com.paulscode',
        artifactId: 'codecjorbis',
        version: '20101023',
        isSnapshot: false,
        type: 'jar',
        classifier: '',
        path: 'com/paulscode/codecjorbis/20101023/codecjorbis-20101023.jar'
        // ResolvedLibrary is a class; for our pure-function wrapper we only
        // read `.download.path`, so a plain object with that shape is OK.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    ],
    ...overrides
  } as ResolvedVersion
}

describe('libraries.ts (unit)', () => {
  beforeEach(() => {
    mockInstallLibraries.mockReset()
    mockInstallMinecraft.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('ensureLibraries', () => {
    it('delegates to @xmcl/installer installLibraries with the resolved version', async () => {
      mockInstallLibraries.mockResolvedValue(undefined)
      const resolved = makeResolved()
      await ensureLibraries(resolved, '/game')
      expect(mockInstallLibraries).toHaveBeenCalledTimes(1)
      expect(mockInstallLibraries).toHaveBeenCalledWith(
        resolved,
        expect.any(Object)
      )
    })

    it('forwards a progress callback that emits the frozen {bytesDone,bytesTotal,currentFile} shape', async () => {
      mockInstallLibraries.mockResolvedValue(undefined)
      const events: ProgressEvent[] = []
      const resolved = makeResolved()
      await ensureLibraries(resolved, '/game', (ev) => events.push(ev))
      expect(events.length).toBeGreaterThan(0)
      for (const ev of events) {
        expect(ev).toMatchObject({
          bytesDone: expect.any(Number),
          bytesTotal: expect.any(Number),
          currentFile: expect.any(String)
        })
      }
    })

    it('propagates AbortSignal into the installer options', async () => {
      mockInstallLibraries.mockResolvedValue(undefined)
      const resolved = makeResolved()
      const controller = new AbortController()
      await ensureLibraries(resolved, '/game', undefined, controller.signal)
      const [, options] = mockInstallLibraries.mock.calls[0] as [unknown, { abortSignal?: AbortSignal }]
      expect(options.abortSignal).toBe(controller.signal)
    })
  })

  describe('resolveClasspath', () => {
    it('returns library jars followed by client.jar — vanilla 1.8.9 ordering', () => {
      const resolved = makeResolved()
      const cp = resolveClasspath(resolved, '/game')
      expect(cp.length).toBe(2) // 1 lib + client.jar
      // Normalize for OS comparison.
      const norm = cp.map((p) => p.replace(/\\/g, '/'))
      expect(norm[0]).toContain('/libraries/com/paulscode/codecjorbis/20101023/codecjorbis-20101023.jar')
      expect(norm[1]).toBe('/game/versions/1.8.9/1.8.9.jar')
    })

    it('appends client.jar LAST (anchor for vanilla 1.8.9 classpath order)', () => {
      const resolved = makeResolved({
        libraries: [
          ...makeResolved().libraries,
          {
            name: 'extra:extra:1.0',
            download: {
              sha1: '0'.repeat(40),
              size: 1,
              path: 'extra/extra/1.0/extra-1.0.jar',
              url: 'https://example.com/extra.jar'
            },
            isNative: false
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        ]
      })
      const cp = resolveClasspath(resolved, '/game')
      expect(cp[cp.length - 1].replace(/\\/g, '/')).toBe(
        '/game/versions/1.8.9/1.8.9.jar'
      )
    })

    it('skips library entries lacking download.path (natives-only classifiers)', () => {
      const resolved = makeResolved({
        libraries: [
          ...makeResolved().libraries,
          {
            name: 'natives:only:1.0',
            // No download.path — a natives-only classifier in the raw manifest
            // that xmcl's resolver left with an empty artifact slot.
            download: undefined,
            isNative: true
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        ]
      })
      const cp = resolveClasspath(resolved, '/game')
      // Only 1 lib jar + client.jar = 2.
      expect(cp.length).toBe(2)
    })

    it('produces an absolute path under <gameDir>/libraries/', () => {
      const resolved = makeResolved()
      const cp = resolveClasspath(resolved, path.resolve('/some/game/dir'))
      expect(path.isAbsolute(cp[0])).toBe(true)
      expect(cp[0].replace(/\\/g, '/')).toContain('/some/game/dir/libraries/')
    })
  })

  describe('ensureClientJar (unit shape)', () => {
    // The real download-and-verify path is covered in the integration test
    // (libraries.integration.test.ts). Here we only assert the API shape.
    it('resolves without error when the cached client.jar already matches SHA1', async () => {
      const resolved = makeResolved()
      // Inject a fake fetch + a fake file reader via dependency injection; see
      // libraries.ts ensureClientJar signature (fetchImpl + fsImpl).
      const fetchImpl = vi.fn()
      const fsImpl = {
        readFile: vi
          .fn()
          // Return bytes whose SHA1 is the known 1.8.9 client jar SHA1.
          // For unit purposes, we just need readFile to succeed AND the
          // sha1 check inside ensureClientJar to match — the module accepts
          // an explicit "planted sha1" injection for test purposes.
          .mockResolvedValue(Buffer.from('does-not-matter-we-inject-sha1')),
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        rename: vi.fn().mockResolvedValue(undefined)
      }
      await expect(
        ensureClientJar(resolved, '/game', undefined, undefined, {
          fetchImpl: fetchImpl as unknown as typeof fetch,
          fsImpl,
          // Test-only backdoor: caller asserts the SHA1 they want for this
          // pretend cached file. Matches `downloads.client.sha1` => cache hit.
          _testOnSha1Override: '3870888a6c3d349d3771a3e9d16c9bf5e076b908'
        })
      ).resolves.toBeUndefined()
      // No network — fetchImpl must not have been invoked on cache-hit.
      expect(fetchImpl).not.toHaveBeenCalled()
    })
  })
})
