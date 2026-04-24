/**
 * @vitest-environment jsdom
 *
 * Plan 04-06 Task 1 — useSpotifyStore state machine + IPC wiring.
 *
 * Covers:
 *   - 5 UI states (disconnected / connecting / connected-idle / connected-playing / offline)
 *   - connect / disconnect / play / pause / next / previous actions via window.wiiwho.spotify
 *   - isPremium flipping on premiumRequired responses
 *   - initialize() — subscribes + wires focus/blur → setVisibility (D-34)
 *   - teardown() — unsubscribes + removes window listeners
 *   - status-changed push with offline=true → state='offline'
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useSpotifyStore } from '../spotify'

interface SpotifyIpcMock {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  status: ReturnType<typeof vi.fn>
  control: {
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    next: ReturnType<typeof vi.fn>
    previous: ReturnType<typeof vi.fn>
  }
  setVisibility: ReturnType<typeof vi.fn>
  onStatusChanged: ReturnType<typeof vi.fn>
}

let spotifyIpcMock: SpotifyIpcMock

beforeEach(() => {
  // Tear down any focus/blur listeners left over from a prior test's
  // initialize() call — without this, a lingering listener can call the
  // NEW mock's setVisibility and break the teardown-isolation test.
  try {
    useSpotifyStore.getState().teardown()
  } catch {
    // store may not have teardown in a pathologically early run — ignore
  }

  spotifyIpcMock = {
    connect: vi.fn(),
    disconnect: vi.fn().mockResolvedValue({ ok: true }),
    status: vi.fn(),
    control: {
      play: vi.fn(),
      pause: vi.fn(),
      next: vi.fn(),
      previous: vi.fn()
    },
    setVisibility: vi.fn().mockResolvedValue({ ok: true }),
    onStatusChanged: vi.fn().mockReturnValue(() => {})
  }
  ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
    auth: {},
    game: {},
    logs: {},
    settings: {},
    __debug: {},
    spotify: spotifyIpcMock
  }
  // Reset store (keeping actions intact)
  useSpotifyStore.setState({
    state: 'disconnected',
    isPremium: 'unknown',
    currentTrack: null,
    displayName: null,
    lastError: null,
    _unsubStatus: null,
    _onFocus: null,
    _onBlur: null
  } as never)
  vi.clearAllMocks()
})
afterEach(() => {
  // Defensive teardown — ensures no focus/blur listeners bleed into the next test.
  try {
    useSpotifyStore.getState().teardown()
  } catch {
    // noop
  }
  cleanup()
})

describe('useSpotifyStore — initial state', () => {
  it('default state is "disconnected" + isPremium="unknown"', () => {
    expect(useSpotifyStore.getState().state).toBe('disconnected')
    expect(useSpotifyStore.getState().isPremium).toBe('unknown')
    expect(useSpotifyStore.getState().currentTrack).toBeNull()
    expect(useSpotifyStore.getState().displayName).toBeNull()
  })
})

describe('useSpotifyStore — connect flow', () => {
  it('connect() transitions disconnected → connecting → connected-idle on success (no track)', async () => {
    spotifyIpcMock.connect.mockResolvedValue({ ok: true, displayName: 'Owner' })
    spotifyIpcMock.status.mockResolvedValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: null
    })
    const p = useSpotifyStore.getState().connect()
    expect(useSpotifyStore.getState().state).toBe('connecting')
    await p
    expect(useSpotifyStore.getState().state).toBe('connected-idle')
    expect(useSpotifyStore.getState().displayName).toBe('Owner')
    expect(useSpotifyStore.getState().isPremium).toBe('yes')
  })

  it('connect() transitions to connected-playing when currentTrack isPlaying', async () => {
    spotifyIpcMock.connect.mockResolvedValue({ ok: true, displayName: 'Owner' })
    spotifyIpcMock.status.mockResolvedValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }
    })
    await useSpotifyStore.getState().connect()
    expect(useSpotifyStore.getState().state).toBe('connected-playing')
    expect(useSpotifyStore.getState().currentTrack?.id).toBe('t1')
  })

  it('connect() failure → state=disconnected + lastError set', async () => {
    spotifyIpcMock.connect.mockResolvedValue({ ok: false, error: 'CSRF mismatch' })
    await useSpotifyStore.getState().connect()
    expect(useSpotifyStore.getState().state).toBe('disconnected')
    expect(useSpotifyStore.getState().lastError).toMatch(/CSRF/)
  })
})

describe('useSpotifyStore — disconnect flow', () => {
  it('disconnect() clears track + displayName + isPremium=unknown', async () => {
    useSpotifyStore.setState({
      state: 'connected-playing',
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }
    } as never)
    spotifyIpcMock.disconnect.mockResolvedValue({ ok: true })
    await useSpotifyStore.getState().disconnect()
    expect(useSpotifyStore.getState().state).toBe('disconnected')
    expect(useSpotifyStore.getState().currentTrack).toBeNull()
    expect(useSpotifyStore.getState().displayName).toBeNull()
    expect(useSpotifyStore.getState().isPremium).toBe('unknown')
  })
})

describe('useSpotifyStore — control actions + premiumRequired', () => {
  beforeEach(() => {
    useSpotifyStore.setState({
      state: 'connected-playing',
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }
    } as never)
  })

  it('play() calls window.wiiwho.spotify.control.play', async () => {
    spotifyIpcMock.control.play.mockResolvedValue({ ok: true })
    spotifyIpcMock.status.mockResolvedValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }
    })
    await useSpotifyStore.getState().play()
    expect(spotifyIpcMock.control.play).toHaveBeenCalledTimes(1)
  })

  it('play() returning premiumRequired sets isPremium="no"', async () => {
    spotifyIpcMock.control.play.mockResolvedValue({ ok: false, premiumRequired: true })
    await useSpotifyStore.getState().play()
    expect(useSpotifyStore.getState().isPremium).toBe('no')
  })

  it('next() calls window.wiiwho.spotify.control.next', async () => {
    spotifyIpcMock.control.next.mockResolvedValue({ ok: true })
    spotifyIpcMock.status.mockResolvedValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't2', name: 'Next', artists: ['A'], isPlaying: true }
    })
    await useSpotifyStore.getState().next()
    expect(spotifyIpcMock.control.next).toHaveBeenCalledTimes(1)
  })

  it('previous() calls window.wiiwho.spotify.control.previous', async () => {
    spotifyIpcMock.control.previous.mockResolvedValue({ ok: true })
    spotifyIpcMock.status.mockResolvedValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't0', name: 'Prev', artists: ['A'], isPlaying: true }
    })
    await useSpotifyStore.getState().previous()
    expect(spotifyIpcMock.control.previous).toHaveBeenCalledTimes(1)
  })

  it('premium-required for any control short-circuits subsequent controls', async () => {
    spotifyIpcMock.control.play.mockResolvedValue({ ok: false, premiumRequired: true })
    await useSpotifyStore.getState().play()
    spotifyIpcMock.control.pause.mockClear()
    await useSpotifyStore.getState().pause()
    expect(spotifyIpcMock.control.pause).not.toHaveBeenCalled()
  })
})

describe('useSpotifyStore — initialize + visibility wiring (D-34)', () => {
  it('initialize() subscribes to onStatusChanged', async () => {
    spotifyIpcMock.status.mockResolvedValue({ connected: false })
    await useSpotifyStore.getState().initialize()
    expect(spotifyIpcMock.onStatusChanged).toHaveBeenCalledTimes(1)
  })

  it('window focus event calls setVisibility("focused")', async () => {
    spotifyIpcMock.status.mockResolvedValue({ connected: false })
    await useSpotifyStore.getState().initialize()
    window.dispatchEvent(new Event('focus'))
    expect(spotifyIpcMock.setVisibility).toHaveBeenCalledWith('focused')
  })

  it('window blur event calls setVisibility("backgrounded")', async () => {
    spotifyIpcMock.status.mockResolvedValue({ connected: false })
    await useSpotifyStore.getState().initialize()
    window.dispatchEvent(new Event('blur'))
    expect(spotifyIpcMock.setVisibility).toHaveBeenCalledWith('backgrounded')
  })

  it('teardown() unsubscribes status + removes listeners', async () => {
    const unsub = vi.fn()
    spotifyIpcMock.onStatusChanged.mockReturnValue(unsub)
    spotifyIpcMock.status.mockResolvedValue({ connected: false })
    await useSpotifyStore.getState().initialize()
    useSpotifyStore.getState().teardown()
    expect(unsub).toHaveBeenCalled()
    // After teardown, new focus events should NOT call setVisibility again
    spotifyIpcMock.setVisibility.mockClear()
    window.dispatchEvent(new Event('focus'))
    expect(spotifyIpcMock.setVisibility).not.toHaveBeenCalled()
  })

  it('status-changed push with offline=true transitions to "offline" state', async () => {
    spotifyIpcMock.status.mockResolvedValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }
    })
    let cb: (s: unknown) => void = () => {}
    spotifyIpcMock.onStatusChanged.mockImplementation((fn: (s: unknown) => void) => {
      cb = fn
      return () => {}
    })
    await useSpotifyStore.getState().initialize()
    cb({
      connected: true,
      displayName: 'Owner',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: false },
      offline: true
    })
    expect(useSpotifyStore.getState().state).toBe('offline')
  })

  it('status-changed push with premiumRequired flag flips isPremium="no"', async () => {
    spotifyIpcMock.status.mockResolvedValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: null
    })
    let cb: (s: unknown) => void = () => {}
    spotifyIpcMock.onStatusChanged.mockImplementation((fn: (s: unknown) => void) => {
      cb = fn
      return () => {}
    })
    await useSpotifyStore.getState().initialize()
    cb({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: null,
      premiumRequired: true
    })
    expect(useSpotifyStore.getState().isPremium).toBe('no')
  })
})
