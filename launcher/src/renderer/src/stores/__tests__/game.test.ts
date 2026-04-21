/**
 * @vitest-environment jsdom
 *
 * useGameStore — Zustand phase-machine tests.
 *
 * Covers:
 *   - Initial state
 *   - subscribe() wires all five IPC listeners + returns an unsubscribe fn
 *   - onStatus + onProgress interaction (downloading → percent)
 *   - onLog pushes into logTail, capped at 30 entries
 *   - onExited(0) → idle (silent clean-quit per D-17)
 *   - onExited(non-zero) + onCrashed → crashed (D-18 takeover path)
 *   - onExited(non-zero) without onCrashed within 6s → failed (D-11 log-tail path)
 *   - play() optimistically transitions to downloading
 *   - cancel() only fires during downloading/verifying (D-13 cancel window)
 *
 * Environment: jsdom via docblock pragma (matches auth.test.ts idiom).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Capture the callbacks registered via window.wiiwho.game.on* ---
type StatusCb = (s: { state: string }) => void
type ProgressCb = (p: { bytesDone: number; bytesTotal: number; currentFile: string }) => void
type LogCb = (entry: { line: string; stream: 'out' | 'err' }) => void
type ExitedCb = (ev: { exitCode: number | null }) => void
type CrashedCb = (ev: { sanitizedBody: string; crashId: string | null }) => void

interface Listeners {
  status: StatusCb | null
  progress: ProgressCb | null
  log: LogCb | null
  exited: ExitedCb | null
  crashed: CrashedCb | null
}

const listeners: Listeners = {
  status: null,
  progress: null,
  log: null,
  exited: null,
  crashed: null
}

const unStatus = vi.fn()
const unProgress = vi.fn()
const unLog = vi.fn()
const unExited = vi.fn()
const unCrashed = vi.fn()

const gameApi = {
  play: vi.fn(),
  cancel: vi.fn(),
  status: vi.fn(),
  onStatus: vi.fn((cb: StatusCb) => {
    listeners.status = cb
    return unStatus
  }),
  onProgress: vi.fn((cb: ProgressCb) => {
    listeners.progress = cb
    return unProgress
  }),
  onLog: vi.fn((cb: LogCb) => {
    listeners.log = cb
    return unLog
  }),
  onExited: vi.fn((cb: ExitedCb) => {
    listeners.exited = cb
    return unExited
  }),
  onCrashed: vi.fn((cb: CrashedCb) => {
    listeners.crashed = cb
    return unCrashed
  })
}

;(globalThis as unknown as { window: { wiiwho: { game: typeof gameApi } } }).window.wiiwho = {
  game: gameApi
} as never

import { useGameStore } from '../game'

function resetStore(): void {
  useGameStore.setState({
    phase: { state: 'idle' },
    logTail: [],
    subscribed: false
  })
}

function resetListeners(): void {
  listeners.status = null
  listeners.progress = null
  listeners.log = null
  listeners.exited = null
  listeners.crashed = null
}

describe('useGameStore', () => {
  beforeEach(() => {
    vi.useRealTimers()
    gameApi.play.mockReset().mockResolvedValue({ ok: true })
    gameApi.cancel.mockReset().mockResolvedValue({ ok: true })
    gameApi.status.mockReset()
    gameApi.onStatus.mockClear()
    gameApi.onProgress.mockClear()
    gameApi.onLog.mockClear()
    gameApi.onExited.mockClear()
    gameApi.onCrashed.mockClear()
    unStatus.mockReset()
    unProgress.mockReset()
    unLog.mockReset()
    unExited.mockReset()
    unCrashed.mockReset()
    resetListeners()
    // Force a fresh unsubscribe cycle so module-level `unsubs` doesn't carry
    // listeners across tests.
    if (useGameStore.getState().subscribed) {
      useGameStore.getState().unsubscribe()
    }
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initial state is idle with empty logTail and no subscription', () => {
    const s = useGameStore.getState()
    expect(s.phase).toEqual({ state: 'idle' })
    expect(s.logTail).toEqual([])
    expect(s.subscribed).toBe(false)
  })

  it('subscribe() wires all five IPC listeners and returns an unsubscribe fn', () => {
    const unsub = useGameStore.getState().subscribe()
    expect(gameApi.onStatus).toHaveBeenCalledTimes(1)
    expect(gameApi.onProgress).toHaveBeenCalledTimes(1)
    expect(gameApi.onLog).toHaveBeenCalledTimes(1)
    expect(gameApi.onExited).toHaveBeenCalledTimes(1)
    expect(gameApi.onCrashed).toHaveBeenCalledTimes(1)
    expect(typeof unsub).toBe('function')
    expect(useGameStore.getState().subscribed).toBe(true)

    // Second subscribe() is a no-op (idempotent).
    useGameStore.getState().subscribe()
    expect(gameApi.onStatus).toHaveBeenCalledTimes(1)

    unsub()
    expect(unStatus).toHaveBeenCalled()
    expect(unProgress).toHaveBeenCalled()
    expect(unLog).toHaveBeenCalled()
    expect(unExited).toHaveBeenCalled()
    expect(unCrashed).toHaveBeenCalled()
    expect(useGameStore.getState().subscribed).toBe(false)
  })

  it('onStatus(downloading) + onProgress(50/100) → phase.state=downloading, percent=50', () => {
    useGameStore.getState().subscribe()
    listeners.status?.({ state: 'downloading' })
    listeners.progress?.({
      bytesDone: 50,
      bytesTotal: 100,
      currentFile: 'client.jar'
    })
    const phase = useGameStore.getState().phase
    expect(phase.state).toBe('downloading')
    if (phase.state === 'downloading') {
      expect(phase.percent).toBe(50)
      expect(phase.currentFile).toBe('client.jar')
    }
  })

  it('onLog pushes entries into logTail, capped at 30', () => {
    useGameStore.getState().subscribe()
    for (let i = 0; i < 50; i++) {
      listeners.log?.({ line: `line ${i}`, stream: 'out' })
    }
    const tail = useGameStore.getState().logTail
    expect(tail.length).toBe(30)
    // The cap drops OLDEST entries — newest (line 49) is last, oldest retained is line 20.
    expect(tail[0]!.line).toBe('line 20')
    expect(tail[29]!.line).toBe('line 49')
  })

  it('onExited(0) transitions to idle (silent clean-quit — D-17)', () => {
    useGameStore.getState().subscribe()
    listeners.status?.({ state: 'playing' })
    listeners.exited?.({ exitCode: 0 })
    expect(useGameStore.getState().phase).toEqual({ state: 'idle' })
  })

  it('onExited(1) followed by onCrashed transitions to crashed (D-18)', () => {
    useGameStore.getState().subscribe()
    listeners.status?.({ state: 'playing' })
    listeners.exited?.({ exitCode: 1 })
    // Before onCrashed fires, we're still in playing (the 6s timer is armed but
    // has not yet committed to 'failed').
    expect(useGameStore.getState().phase.state).toBe('playing')

    listeners.crashed?.({
      sanitizedBody: 'stack trace',
      crashId: 'crash-2026-04-21_15.04.22-client'
    })
    const phase = useGameStore.getState().phase
    expect(phase.state).toBe('crashed')
    if (phase.state === 'crashed') {
      expect(phase.sanitizedBody).toBe('stack trace')
      expect(phase.crashId).toBe('crash-2026-04-21_15.04.22-client')
    }
  })

  it('onExited(1) WITHOUT onCrashed within 6s transitions to failed (D-11)', () => {
    vi.useFakeTimers()
    useGameStore.getState().subscribe()
    listeners.status?.({ state: 'playing' })
    // Seed 2 log lines so the fallback has something to show.
    listeners.log?.({ line: 'pre-crash warning', stream: 'err' })
    listeners.log?.({ line: 'JVM said something', stream: 'out' })
    listeners.exited?.({ exitCode: 1 })

    // Advance just before the 6s boundary — still NOT failed.
    vi.advanceTimersByTime(5999)
    expect(useGameStore.getState().phase.state).toBe('playing')

    // Cross the boundary — now failed.
    vi.advanceTimersByTime(1)
    const phase = useGameStore.getState().phase
    expect(phase.state).toBe('failed')
    if (phase.state === 'failed') {
      expect(phase.message).toMatch(/exit/i)
      expect(phase.logTail.length).toBe(2)
      expect(phase.logTail[0]!.line).toBe('pre-crash warning')
    }
  })

  it('onExited(1) + onCrashed within the 6s window cancels the fail fallback', () => {
    vi.useFakeTimers()
    useGameStore.getState().subscribe()
    listeners.exited?.({ exitCode: 1 })
    vi.advanceTimersByTime(3000)
    listeners.crashed?.({ sanitizedBody: 'body', crashId: null })
    vi.advanceTimersByTime(10000)
    // Still crashed — the fallback timer must have been cancelled.
    expect(useGameStore.getState().phase.state).toBe('crashed')
  })

  it('play() calls window.wiiwho.game.play() and optimistically transitions to downloading', async () => {
    await useGameStore.getState().play()
    expect(gameApi.play).toHaveBeenCalledTimes(1)
    const phase = useGameStore.getState().phase
    expect(phase.state).toBe('downloading')
    if (phase.state === 'downloading') {
      expect(phase.percent).toBe(0)
    }
  })

  it('cancel() fires only during downloading/verifying (D-13 cancel window)', async () => {
    // During downloading — fires.
    useGameStore.setState({ phase: { state: 'downloading', percent: 10, currentFile: 'a' } })
    await useGameStore.getState().cancel()
    expect(gameApi.cancel).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState().phase).toEqual({ state: 'idle' })

    // During verifying — fires.
    useGameStore.setState({ phase: { state: 'verifying' } })
    await useGameStore.getState().cancel()
    expect(gameApi.cancel).toHaveBeenCalledTimes(2)

    // During starting — NO-OP (cancel window closed).
    useGameStore.setState({ phase: { state: 'starting' } })
    await useGameStore.getState().cancel()
    expect(gameApi.cancel).toHaveBeenCalledTimes(2)

    // During playing — NO-OP.
    useGameStore.setState({ phase: { state: 'playing' } })
    await useGameStore.getState().cancel()
    expect(gameApi.cancel).toHaveBeenCalledTimes(2)

    // From idle — NO-OP.
    useGameStore.setState({ phase: { state: 'idle' } })
    await useGameStore.getState().cancel()
    expect(gameApi.cancel).toHaveBeenCalledTimes(2)
  })

  it('onStatus carries the full morph sequence idle → downloading → verifying → starting → playing → idle', () => {
    useGameStore.getState().subscribe()
    listeners.status?.({ state: 'downloading' })
    expect(useGameStore.getState().phase.state).toBe('downloading')
    listeners.status?.({ state: 'verifying' })
    expect(useGameStore.getState().phase.state).toBe('verifying')
    listeners.status?.({ state: 'starting' })
    expect(useGameStore.getState().phase.state).toBe('starting')
    listeners.status?.({ state: 'playing' })
    expect(useGameStore.getState().phase.state).toBe('playing')
    listeners.status?.({ state: 'idle' })
    expect(useGameStore.getState().phase.state).toBe('idle')
  })
})
