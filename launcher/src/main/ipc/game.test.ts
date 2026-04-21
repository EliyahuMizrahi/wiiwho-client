// @vitest-environment node
/**
 * Plan 03-10 Task 1 — ipc/game.ts orchestrator tests.
 *
 * Replaces the Phase 1 stub-handler tests with full orchestrator
 * assertions. The orchestrator is intentionally heavily-mocked: every
 * downstream `../launch/*`, `../monitor/*`, `../auth/*`, `../settings/*`,
 * and `../paths` module is stubbed so the tests assert the CALL GRAPH
 * and EVENT SEQUENCE rather than re-proving each module's behaviour.
 *
 * Test index (12):
 *   1. game:play runs the full orchestration pipeline in order.
 *   2. status push sequence: downloading → verifying → starting → playing.
 *   3. progress events relayed from ensureLibraries progress callback.
 *   4. game:log events fired from LogParser.onLine.
 *   5. LogParser.onMainMenu fires → mainWindow.minimize() + playing status.
 *   6. clean exit (code 0) → game:exited + status=idle.
 *   7. non-zero exit + crash file → sanitized crash body pushed via game:crashed.
 *   8. non-zero exit + NO crash file → game:exited only; no game:crashed.
 *   9. game:cancel during downloading → AbortController.abort() propagated.
 *  10. game:play while already running → no-op guard.
 *  11. getMinecraftToken() throws → error result + status returns to idle.
 *  12. COMP-05 regression: crash push payload's body has passed through
 *      sanitizeCrashReport (raw token fixture stripped).
 *
 * Mock strategy: all mock objects are created inside `vi.hoisted()` so the
 * `vi.mock(..., () => ({...}))` factory functions — which are themselves
 * hoisted to module top — can reference them without the "Cannot access X
 * before initialization" hoisting error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- Hoisted mocks (see module-level comment above) -------------------------

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()

  interface RecordedLogParserOpts {
    onMainMenu?: (info: { reason: string }) => void
    onLine?: (entry: { line: string; stream: 'out' | 'err' }) => void
  }

  const state: {
    lastLogParser: {
      opts: RecordedLogParserOpts
      ingest: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
    } | null
  } = { lastLogParser: null }

  class FakeLogParser {
    opts: RecordedLogParserOpts
    ingest = vi.fn()
    stop = vi.fn()
    constructor(opts: RecordedLogParserOpts) {
      this.opts = opts
      state.lastLogParser = {
        opts,
        ingest: this.ingest,
        stop: this.stop
      }
    }
  }

  return {
    handlers,
    state,
    FakeLogParser,
    settings: { readSettings: vi.fn() },
    authManager: { getMinecraftToken: vi.fn() },
    redact: { sanitizeCrashReport: vi.fn((s: string) => s) },
    manifest: {
      fetchAndCacheManifest: vi.fn(),
      resolveVersion: vi.fn()
    },
    libraries: {
      ensureClientJar: vi.fn(),
      ensureLibraries: vi.fn(),
      resolveClasspath: vi.fn()
    },
    assets: { ensureAssets: vi.fn() },
    natives: { ensureNatives: vi.fn() },
    args: { buildArgv: vi.fn() },
    spawn: { spawnGame: vi.fn() },
    crashReport: {
      watchForCrashReport: vi.fn(),
      readCrashReport: vi.fn()
    },
    paths: {
      resolveJavaBinary: vi.fn(() => '/fake/resources/jre/win-x64/bin/javaw.exe'),
      resolveGameDir: vi.fn(() => '/fake/gameDir'),
      resolveCrashReportsDir: vi.fn(() => '/fake/gameDir/crash-reports')
    }
  }
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown): void => {
      mocks.handlers.set(channel, handler)
    }
  },
  BrowserWindow: class {}
}))

vi.mock('../settings/store', () => mocks.settings)

vi.mock('../auth/AuthManager', () => ({
  getAuthManager: () => mocks.authManager
}))

vi.mock('../auth/redact', () => mocks.redact)

vi.mock('../launch/manifest', () => mocks.manifest)
vi.mock('../launch/libraries', () => mocks.libraries)
vi.mock('../launch/assets', () => mocks.assets)
vi.mock('../launch/natives', () => mocks.natives)
vi.mock('../launch/args', () => mocks.args)
vi.mock('../launch/spawn', () => mocks.spawn)
vi.mock('../monitor/logParser', () => ({ LogParser: mocks.FakeLogParser }))
vi.mock('../monitor/crashReport', () => mocks.crashReport)
vi.mock('../paths', () => mocks.paths)

vi.mock('electron-log/main', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

// ---- Import under test -------------------------------------------------------

import { registerGameHandlers, __test__ as gameTestHooks } from './game'

// ---- Test helpers ------------------------------------------------------------

let winMock: {
  webContents: { send: ReturnType<typeof vi.fn> }
  minimize: ReturnType<typeof vi.fn>
  isDestroyed: () => boolean
} | null

function freshWindow(): NonNullable<typeof winMock> {
  return {
    webContents: { send: vi.fn() },
    minimize: vi.fn(),
    isDestroyed: () => false
  }
}

function sentEvents(): Array<{ channel: string; payload: unknown }> {
  if (!winMock) return []
  return winMock.webContents.send.mock.calls.map((args) => ({
    channel: args[0] as string,
    payload: args[1]
  }))
}

function eventsFor(channel: string): unknown[] {
  return sentEvents()
    .filter((e) => e.channel === channel)
    .map((e) => e.payload)
}

function installHandlers(): void {
  mocks.handlers.clear()
  winMock = freshWindow()
  mocks.state.lastLogParser = null
  gameTestHooks.resetForTests()
  registerGameHandlers(() => winMock as never)
}

function setHappyPathDefaults(): void {
  mocks.settings.readSettings.mockResolvedValue({
    version: 1,
    ramMb: 2048,
    firstRunSeen: false
  })
  mocks.authManager.getMinecraftToken.mockResolvedValue({
    accessToken: 'mc-token',
    username: 'Wiiwho',
    uuid: 'uuid32'
  })
  mocks.manifest.fetchAndCacheManifest.mockResolvedValue({
    path: '/fake/gameDir/versions/1.8.9/1.8.9.json',
    sha1: 'abc',
    manifest: {}
  })
  mocks.manifest.resolveVersion.mockResolvedValue({
    id: '1.8.9',
    libraries: []
  })
  mocks.libraries.ensureClientJar.mockResolvedValue(undefined)
  mocks.libraries.ensureLibraries.mockResolvedValue(undefined)
  mocks.libraries.resolveClasspath.mockReturnValue(['/fake/lib.jar', '/fake/client.jar'])
  mocks.assets.ensureAssets.mockResolvedValue(undefined)
  mocks.natives.ensureNatives.mockResolvedValue('/fake/gameDir/versions/1.8.9/natives')
  mocks.args.buildArgv.mockReturnValue([
    '-Xmx2048M',
    '-cp',
    '/fake/cp',
    'net.minecraft.client.main.Main'
  ])
  mocks.spawn.spawnGame.mockResolvedValue({ exitCode: 0 })
  mocks.crashReport.watchForCrashReport.mockResolvedValue(null)
  mocks.crashReport.readCrashReport.mockResolvedValue('')
  mocks.redact.sanitizeCrashReport.mockImplementation((s: string) =>
    s.replaceAll('ey.fakeTokenBody123', '[REDACTED]')
  )
}

// ---- Suite -------------------------------------------------------------------

describe('ipc/game.ts orchestrator (Plan 03-10)', () => {
  beforeEach(() => {
    // Reset every module mock.
    mocks.settings.readSettings.mockReset()
    mocks.authManager.getMinecraftToken.mockReset()
    mocks.redact.sanitizeCrashReport.mockReset()
    mocks.manifest.fetchAndCacheManifest.mockReset()
    mocks.manifest.resolveVersion.mockReset()
    mocks.libraries.ensureClientJar.mockReset()
    mocks.libraries.ensureLibraries.mockReset()
    mocks.libraries.resolveClasspath.mockReset()
    mocks.assets.ensureAssets.mockReset()
    mocks.natives.ensureNatives.mockReset()
    mocks.args.buildArgv.mockReset()
    mocks.spawn.spawnGame.mockReset()
    mocks.crashReport.watchForCrashReport.mockReset()
    mocks.crashReport.readCrashReport.mockReset()
    setHappyPathDefaults()
    installHandlers()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: game:play runs the full pipeline in order', async () => {
    const callOrder: string[] = []
    mocks.settings.readSettings.mockImplementation(async () => {
      callOrder.push('readSettings')
      return { version: 1, ramMb: 2048, firstRunSeen: false }
    })
    mocks.authManager.getMinecraftToken.mockImplementation(async () => {
      callOrder.push('getMinecraftToken')
      return { accessToken: 't', username: 'u', uuid: 'i' }
    })
    mocks.manifest.fetchAndCacheManifest.mockImplementation(async () => {
      callOrder.push('fetchAndCacheManifest')
      return { path: 'p', sha1: 's', manifest: {} }
    })
    mocks.manifest.resolveVersion.mockImplementation(async () => {
      callOrder.push('resolveVersion')
      return { id: '1.8.9', libraries: [] }
    })
    mocks.libraries.ensureClientJar.mockImplementation(async () => {
      callOrder.push('ensureClientJar')
    })
    mocks.libraries.ensureLibraries.mockImplementation(async () => {
      callOrder.push('ensureLibraries')
    })
    mocks.assets.ensureAssets.mockImplementation(async () => {
      callOrder.push('ensureAssets')
    })
    mocks.natives.ensureNatives.mockImplementation(async () => {
      callOrder.push('ensureNatives')
      return '/fake/natives'
    })
    mocks.args.buildArgv.mockImplementation(() => {
      callOrder.push('buildArgv')
      return ['-Xmx2048M']
    })
    mocks.spawn.spawnGame.mockImplementation(async () => {
      callOrder.push('spawnGame')
      return { exitCode: 0 }
    })

    await mocks.handlers.get('game:play')?.()

    expect(callOrder).toEqual([
      'readSettings',
      'getMinecraftToken',
      'fetchAndCacheManifest',
      'resolveVersion',
      'ensureClientJar',
      'ensureLibraries',
      'ensureAssets',
      'ensureNatives',
      'buildArgv',
      'spawnGame'
    ])
  })

  it('Test 2: emits game:status-changed in expected sequence downloading → verifying → starting → playing → idle', async () => {
    mocks.spawn.spawnGame.mockImplementation(async () => {
      mocks.state.lastLogParser?.opts.onMainMenu?.({ reason: 'sentinel' })
      return { exitCode: 0 }
    })

    await mocks.handlers.get('game:play')?.()

    const statuses = (eventsFor('game:status-changed') as Array<{ state: string }>).map(
      (s) => s.state
    )
    const expectedOrder = ['downloading', 'verifying', 'starting', 'playing', 'idle']
    // The orchestrator must fire each phase label in order. Non-contiguous
    // substring match tolerates additional same-state pushes (benign).
    let idx = 0
    for (const s of statuses) {
      if (s === expectedOrder[idx]) idx++
    }
    expect(idx).toBe(expectedOrder.length)
  })

  it('Test 3: game:progress events relayed from ensureLibraries progress callback', async () => {
    mocks.libraries.ensureLibraries.mockImplementation(
      async (
        _resolved: unknown,
        _gameDir: unknown,
        progress?: (e: { bytesDone: number; bytesTotal: number; currentFile: string }) => void
      ) => {
        progress?.({ bytesDone: 50, bytesTotal: 100, currentFile: 'lib.jar' })
        progress?.({ bytesDone: 100, bytesTotal: 100, currentFile: 'lib.jar' })
      }
    )

    await mocks.handlers.get('game:play')?.()

    const progressEvents = eventsFor('game:progress') as Array<{
      bytesDone: number
      bytesTotal: number
      currentFile: string
    }>
    const libProgress = progressEvents.filter((p) => p.currentFile === 'lib.jar')
    expect(libProgress.length).toBeGreaterThanOrEqual(2)
    expect(libProgress[0].bytesDone).toBe(50)
    expect(libProgress[1].bytesDone).toBe(100)
  })

  it('Test 4: game:log events fired from LogParser.onLine', async () => {
    mocks.spawn.spawnGame.mockImplementation(async () => {
      mocks.state.lastLogParser?.opts.onLine?.({
        line: 'hello',
        stream: 'out'
      })
      mocks.state.lastLogParser?.opts.onLine?.({
        line: 'err line',
        stream: 'err'
      })
      return { exitCode: 0 }
    })

    await mocks.handlers.get('game:play')?.()

    const logEvents = eventsFor('game:log') as Array<{
      line: string
      stream: string
    }>
    expect(logEvents).toContainEqual({ line: 'hello', stream: 'out' })
    expect(logEvents).toContainEqual({ line: 'err line', stream: 'err' })
  })

  it('Test 5: LogParser.onMainMenu → mainWindow.minimize() + status=playing (D-12)', async () => {
    mocks.spawn.spawnGame.mockImplementation(async () => {
      mocks.state.lastLogParser?.opts.onMainMenu?.({ reason: 'sentinel' })
      return { exitCode: 0 }
    })

    await mocks.handlers.get('game:play')?.()

    expect(winMock!.minimize).toHaveBeenCalledTimes(1)
    const playingEvents = (eventsFor('game:status-changed') as Array<{ state: string }>).filter(
      (e) => e.state === 'playing'
    )
    expect(playingEvents.length).toBeGreaterThanOrEqual(1)
  })

  it('Test 6: spawnGame resolves {exitCode: 0} → game:exited {exitCode:0} + status=idle', async () => {
    mocks.spawn.spawnGame.mockResolvedValue({ exitCode: 0 })

    await mocks.handlers.get('game:play')?.()

    const exited = eventsFor('game:exited') as Array<{
      exitCode: number | null
    }>
    expect(exited).toContainEqual({ exitCode: 0 })
    const statuses = (eventsFor('game:status-changed') as Array<{ state: string }>).map(
      (s) => s.state
    )
    expect(statuses[statuses.length - 1]).toBe('idle')
    expect(eventsFor('game:crashed').length).toBe(0)
  })

  it('Test 7: non-zero exit + crash file → sanitizeCrashReport(body) → game:crashed pushed', async () => {
    mocks.spawn.spawnGame.mockResolvedValue({ exitCode: 1 })
    mocks.crashReport.watchForCrashReport.mockResolvedValue('crash-2026-04-21_15.00.00-client.txt')
    mocks.crashReport.readCrashReport.mockResolvedValue(
      'raw crash body with token ey.fakeTokenBody123 inside'
    )

    await mocks.handlers.get('game:play')?.()

    expect(eventsFor('game:exited')).toContainEqual({ exitCode: 1 })
    expect(mocks.crashReport.watchForCrashReport).toHaveBeenCalled()
    expect(mocks.redact.sanitizeCrashReport).toHaveBeenCalledWith(
      'raw crash body with token ey.fakeTokenBody123 inside'
    )
    const crashed = eventsFor('game:crashed') as Array<{
      sanitizedBody: string
      crashId: string
    }>
    expect(crashed.length).toBe(1)
    expect(crashed[0].crashId).toBe('crash-2026-04-21_15.00.00-client.txt')
    expect(crashed[0].sanitizedBody).not.toContain('ey.fakeTokenBody123')
  })

  it('Test 8: non-zero exit + NO crash file → game:exited but NO game:crashed', async () => {
    mocks.spawn.spawnGame.mockResolvedValue({ exitCode: 1 })
    mocks.crashReport.watchForCrashReport.mockResolvedValue(null)

    await mocks.handlers.get('game:play')?.()

    expect(eventsFor('game:exited')).toContainEqual({ exitCode: 1 })
    expect(eventsFor('game:crashed').length).toBe(0)
    expect(mocks.redact.sanitizeCrashReport).not.toHaveBeenCalled()
  })

  it('Test 9: game:cancel aborts the in-flight AbortController → signal propagated into fetchAndCacheManifest', async () => {
    let capturedSignal: AbortSignal | undefined
    mocks.manifest.fetchAndCacheManifest.mockImplementation(
      async (_v: unknown, _g: unknown, _f: unknown, signal?: AbortSignal) => {
        capturedSignal = signal
        return new Promise((resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('AbortError: cancelled')))
          setTimeout(() => resolve({ path: 'p', sha1: 's', manifest: {} }), 5000)
        })
      }
    )

    const playP = mocks.handlers.get('game:play')?.()
    await new Promise((r) => setImmediate(r))
    await mocks.handlers.get('game:cancel')?.()

    await playP

    expect(capturedSignal).toBeDefined()
    expect(capturedSignal!.aborted).toBe(true)
    const statuses = (eventsFor('game:status-changed') as Array<{ state: string }>).map(
      (s) => s.state
    )
    expect(statuses[statuses.length - 1]).toBe('idle')
  })

  it('Test 10: game:play while already running returns {ok:false, reason:"already-running"}', async () => {
    type ResolveFn = (v: { path: string; sha1: string; manifest: unknown }) => void
    let resolveFetch: ResolveFn | null = null
    mocks.manifest.fetchAndCacheManifest.mockImplementation(
      () =>
        new Promise<{ path: string; sha1: string; manifest: unknown }>((resolve) => {
          resolveFetch = resolve as ResolveFn
        })
    )

    const firstP = mocks.handlers.get('game:play')?.()
    await new Promise((r) => setImmediate(r))

    const secondResult = (await mocks.handlers.get('game:play')?.()) as {
      ok: boolean
      reason?: string
    }
    expect(secondResult.ok).toBe(false)
    expect(secondResult.reason).toBe('already-running')

    expect(mocks.settings.readSettings).toHaveBeenCalledTimes(1)
    ;(resolveFetch as ResolveFn | null)?.({
      path: 'p',
      sha1: 's',
      manifest: {}
    })
    await firstP
  })

  it('Test 11: getMinecraftToken throws → returns error and status returns to idle', async () => {
    mocks.authManager.getMinecraftToken.mockRejectedValue(new Error('Not logged in.'))

    const result = (await mocks.handlers.get('game:play')?.()) as {
      ok: boolean
      error?: string
    }
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Not logged in/i)

    const statuses = (eventsFor('game:status-changed') as Array<{ state: string }>).map(
      (s) => s.state
    )
    expect(statuses[statuses.length - 1]).toBe('idle')
    expect(mocks.manifest.fetchAndCacheManifest).not.toHaveBeenCalled()
  })

  it('Test 12 (COMP-05 regression): game:crashed payload is SANITIZED — no raw token value reaches renderer', async () => {
    mocks.spawn.spawnGame.mockResolvedValue({ exitCode: 1 })
    mocks.crashReport.watchForCrashReport.mockResolvedValue('crash-abc-client.txt')
    const rawCrash = 'Exception in thread\n--accessToken ey.fakeTokenBody123 rest of body'
    mocks.crashReport.readCrashReport.mockResolvedValue(rawCrash)

    await mocks.handlers.get('game:play')?.()

    const crashed = eventsFor('game:crashed') as Array<{
      sanitizedBody: string
    }>
    expect(crashed.length).toBe(1)
    expect(crashed[0].sanitizedBody).not.toContain('ey.fakeTokenBody123')
    expect(mocks.redact.sanitizeCrashReport).toHaveBeenCalledWith(rawCrash)
    expect(mocks.redact.sanitizeCrashReport.mock.results[0].value).toBe(crashed[0].sanitizedBody)
  })
})
