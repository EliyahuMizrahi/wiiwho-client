// @vitest-environment node
/**
 * Spotify IPC handler tests (Plan 04-05 Task 4).
 *
 * Covers:
 *   - spotify:connect/disconnect/status pass through to manager
 *   - spotify:control:play/pause/next/previous pass through
 *   - spotify:set-visibility pass through
 *   - registerSpotifyHandlers wires a status-changed listener that pushes
 *     events to the primary window's webContents
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Handler = (...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()

const sendMock = vi.fn()
const fakeWin = {
  webContents: { send: sendMock }
} as unknown as { webContents: { send: typeof sendMock } }

// EventEmitter-like stub — registers callbacks keyed by event name.
const managerListeners: Record<string, Array<(p: unknown) => void>> = {
  'status-changed': []
}

const managerMock = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  status: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  next: vi.fn(),
  previous: vi.fn(),
  setVisibility: vi.fn(),
  on: vi.fn((event: string, cb: (p: unknown) => void) => {
    ;(managerListeners[event] ??= []).push(cb)
  }),
  restoreFromDisk: vi.fn()
}

const { openExternalMock } = vi.hoisted(() => ({
  openExternalMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('electron', () => ({
  BrowserWindow: class {},
  ipcMain: {
    handle: (channel: string, handler: Handler): void => {
      handlers.set(channel, handler)
    }
  },
  shell: {
    openExternal: openExternalMock
  }
}))

vi.mock('../../spotify/spotifyManager', () => ({
  getSpotifyManager: () => managerMock
}))

import { registerSpotifyHandlers } from '../spotify'

registerSpotifyHandlers(() => fakeWin as never)

describe('Spotify IPC handlers', () => {
  beforeEach(() => {
    managerMock.connect.mockReset()
    managerMock.disconnect.mockReset()
    managerMock.status.mockReset()
    managerMock.play.mockReset()
    managerMock.pause.mockReset()
    managerMock.next.mockReset()
    managerMock.previous.mockReset()
    managerMock.setVisibility.mockReset()
    sendMock.mockReset()
  })

  it('registers all expected channels', () => {
    const registered = [...handlers.keys()].sort()
    expect(registered).toEqual(
      [
        'spotify:connect',
        'spotify:disconnect',
        'spotify:status',
        'spotify:control:play',
        'spotify:control:pause',
        'spotify:control:next',
        'spotify:control:previous',
        'spotify:set-visibility',
        'spotify:open-app'
      ].sort()
    )
  })

  it('spotify:connect delegates to manager.connect and returns its result', async () => {
    managerMock.connect.mockResolvedValue({ ok: true, displayName: 'Owner' })
    const r = await handlers.get('spotify:connect')?.()
    expect(r).toEqual({ ok: true, displayName: 'Owner' })
    expect(managerMock.connect).toHaveBeenCalledTimes(1)
  })

  it('spotify:disconnect delegates to manager.disconnect', async () => {
    managerMock.disconnect.mockResolvedValue({ ok: true })
    const r = await handlers.get('spotify:disconnect')?.()
    expect(r).toEqual({ ok: true })
  })

  it('spotify:status delegates to manager.status (synchronous → wrapped in promise)', async () => {
    managerMock.status.mockReturnValue({
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: null
    })
    const r = (await handlers.get('spotify:status')?.()) as { connected: boolean }
    expect(r.connected).toBe(true)
  })

  it.each([
    ['spotify:control:play', 'play'],
    ['spotify:control:pause', 'pause'],
    ['spotify:control:next', 'next'],
    ['spotify:control:previous', 'previous']
  ])('%s delegates to manager.%s', async (channel, method) => {
    const m = managerMock as unknown as Record<string, ReturnType<typeof vi.fn>>
    m[method].mockResolvedValue({ ok: true })
    const r = await handlers.get(channel)?.()
    expect(r).toEqual({ ok: true })
    expect(m[method]).toHaveBeenCalledTimes(1)
  })

  it('spotify:set-visibility passes "focused" / "backgrounded" through to manager', async () => {
    await handlers.get('spotify:set-visibility')?.(null, 'focused')
    expect(managerMock.setVisibility).toHaveBeenCalledWith('focused')
    await handlers.get('spotify:set-visibility')?.(null, 'backgrounded')
    expect(managerMock.setVisibility).toHaveBeenCalledWith('backgrounded')
  })

  it('spotify:open-app calls shell.openExternal("spotify://")', async () => {
    openExternalMock.mockClear()
    const r = await handlers.get('spotify:open-app')?.()
    expect(openExternalMock).toHaveBeenCalledWith('spotify://')
    expect(r).toEqual({ ok: true })
  })

  it('forwards manager "status-changed" events via webContents.send("spotify:status-changed")', () => {
    // registerSpotifyHandlers was called at module-load time, so the listener
    // is already registered on our mock manager.
    const listener = managerListeners['status-changed'][0]
    expect(typeof listener).toBe('function')
    const payload = {
      connected: true,
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'Song', artists: ['A'], isPlaying: true }
    }
    listener(payload)
    expect(sendMock).toHaveBeenCalledWith('spotify:status-changed', payload)
  })

  it('does not crash when push event fires while primary window is null', () => {
    handlers.clear()
    // Re-register with a getter that returns null — simulates the window being
    // closed mid-session (macOS dock behavior).
    registerSpotifyHandlers(() => null)
    const listener = managerListeners['status-changed'].at(-1)
    expect(() => listener?.({ connected: false })).not.toThrow()
    // No send should have happened on the original fakeWin either.
  })
})
