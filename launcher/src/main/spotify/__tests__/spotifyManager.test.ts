// @vitest-environment node
/**
 * SpotifyManager singleton tests (Plan 04-05 Task 4).
 *
 * Covers:
 *   - connect() happy path → tokens persisted + product → isPremium
 *   - connect() PKCE failure → { ok: false, error }
 *   - disconnect() → clears tokens
 *   - status() reflects in-memory state
 *   - play() short-circuits when isPremium === 'no'
 *   - play() detects premiumRequired from api and sets isPremium='no'
 *   - setVisibility changes polling cadence
 *   - track change emits status events
 *   - 401 AuthExpiredError clears tokens + emits disconnected event
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks — declared BEFORE imports so vi.mock hoists with these identities.
const oauthMock = {
  startPKCEFlow: vi.fn(),
  refreshAccessToken: vi.fn()
}
const apiMock = {
  AuthExpiredError: class AuthExpiredError extends Error {
    constructor() {
      super('Spotify auth expired after refresh attempt')
      this.name = 'AuthExpiredError'
    }
  },
  getCurrentlyPlaying: vi.fn(),
  getCurrentUser: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  next: vi.fn(),
  previous: vi.fn()
}
const tokenStoreMock = {
  readSpotifyTokens: vi.fn(),
  writeSpotifyTokens: vi.fn(),
  clearSpotifyTokens: vi.fn()
}

vi.mock('../oauth', () => oauthMock)
vi.mock('../api', () => apiMock)
vi.mock('../tokenStore', () => tokenStoreMock)

describe('SpotifyManager', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    // Reset all mocks to fresh defaults.
    oauthMock.startPKCEFlow.mockReset()
    oauthMock.refreshAccessToken.mockReset()
    apiMock.getCurrentlyPlaying.mockReset()
    apiMock.getCurrentUser.mockReset()
    apiMock.play.mockReset()
    apiMock.pause.mockReset()
    apiMock.next.mockReset()
    apiMock.previous.mockReset()
    tokenStoreMock.readSpotifyTokens.mockReset()
    tokenStoreMock.writeSpotifyTokens.mockReset()
    tokenStoreMock.clearSpotifyTokens.mockReset()

    // Reset the singleton between tests so each test gets a clean manager.
    vi.resetModules()
    const mod = await import('../spotifyManager')
    mod.__test__.resetSingleton()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('connect() happy path persists tokens and marks isPremium=yes when product=premium', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scope: 'user-read-currently-playing user-read-playback-state user-modify-playback-state',
      scopes: ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state']
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'sid', displayName: 'Owner', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    const res = await m.connect()
    expect(res.ok).toBe(true)
    expect(res.displayName).toBe('Owner')
    expect(tokenStoreMock.writeSpotifyTokens).toHaveBeenCalledTimes(1)
    const saved = tokenStoreMock.writeSpotifyTokens.mock.calls[0][0]
    expect(saved.accessToken).toBe('AT')
    expect(saved.refreshToken).toBe('RT')
    expect(saved.displayName).toBe('Owner')
    expect(saved.isPremium).toBe('yes')
    expect(m.status().connected).toBe(true)
    expect(m.status().isPremium).toBe('yes')
  })

  it('connect() sets isPremium=no for product=free', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'fid', displayName: 'FreeUser', product: 'free' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    expect(m.status().isPremium).toBe('no')
  })

  it('connect() returns { ok: false, error } when PKCE flow fails', async () => {
    oauthMock.startPKCEFlow.mockRejectedValue(new Error('PORTS_BUSY: all ports in use'))
    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    const res = await m.connect()
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/PORTS_BUSY/)
    expect(tokenStoreMock.writeSpotifyTokens).not.toHaveBeenCalled()
    expect(m.status().connected).toBe(false)
  })

  it('disconnect() clears tokens and resets state', async () => {
    // First, get into a connected state.
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'id', displayName: 'X', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)
    tokenStoreMock.clearSpotifyTokens.mockResolvedValue(undefined)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    expect(m.status().connected).toBe(true)
    const out = await m.disconnect()
    expect(out.ok).toBe(true)
    expect(tokenStoreMock.clearSpotifyTokens).toHaveBeenCalledTimes(1)
    expect(m.status().connected).toBe(false)
    expect(m.status().isPremium).toBeUndefined()
  })

  it('status() returns disconnected baseline before connect', async () => {
    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    const s = m.status()
    expect(s.connected).toBe(false)
    expect(s.currentTrack).toBeUndefined()
    expect(s.displayName).toBeUndefined()
  })

  it('play() short-circuits with premiumRequired when isPremium is already "no"', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'fid', displayName: 'Free', product: 'free' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    const r = await m.play()
    expect(r.ok).toBe(false)
    expect(r.premiumRequired).toBe(true)
    expect(apiMock.play).not.toHaveBeenCalled() // short-circuited BEFORE hitting API
  })

  it('play() on premium user calls api.play and returns ok on success', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'id', displayName: 'X', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)
    apiMock.play.mockResolvedValue({ premiumRequired: false })

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    const r = await m.play()
    expect(r.ok).toBe(true)
    expect(r.premiumRequired).toBe(false)
    expect(apiMock.play).toHaveBeenCalledTimes(1)
  })

  it('play() on premium user that hits 403 PREMIUM_REQUIRED flips isPremium to "no"', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    // User fakes premium at sign-in time but the API disagrees — downgrade and emit status.
    apiMock.getCurrentUser.mockResolvedValue({ id: 'uid', displayName: 'X', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)
    apiMock.play.mockResolvedValue({ premiumRequired: true })

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    expect(m.status().isPremium).toBe('yes')
    const r = await m.play()
    expect(r.ok).toBe(false)
    expect(r.premiumRequired).toBe(true)
    expect(m.status().isPremium).toBe('no')
  })

  it('setVisibility changes polling cadence (5s focused / 15s backgrounded)', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'id', displayName: 'X', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)
    apiMock.getCurrentlyPlaying.mockResolvedValue(null)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    m.setVisibility('focused')
    expect(m.pollIntervalMs()).toBe(5000)
    m.setVisibility('backgrounded')
    expect(m.pollIntervalMs()).toBe(15000)
  })

  it('listeners receive status-changed events on track change', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'id', displayName: 'X', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    const events: unknown[] = []
    m.on('status-changed', (s) => events.push(s))

    // Simulate poll observing a new track.
    apiMock.getCurrentlyPlaying.mockResolvedValueOnce({
      id: 't1',
      name: 'Song',
      artists: ['A'],
      isPlaying: true
    })
    await m.pollOnce()
    expect(events.length).toBeGreaterThan(0)
    const latest = events[events.length - 1] as { currentTrack?: { id: string } | null }
    expect(latest.currentTrack?.id).toBe('t1')
  })

  it('poll returning identical track does NOT emit redundant status events', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'id', displayName: 'X', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    const events: unknown[] = []
    m.on('status-changed', (s) => events.push(s))

    const sameTrack = { id: 't1', name: 'Song', artists: ['A'], isPlaying: true }
    apiMock.getCurrentlyPlaying.mockResolvedValue(sameTrack)
    await m.pollOnce()
    const afterFirst = events.length
    await m.pollOnce()
    // Same track id, same isPlaying → no second event.
    expect(events.length).toBe(afterFirst)
  })

  it('poll that hits AuthExpiredError clears tokens and emits disconnected', async () => {
    oauthMock.startPKCEFlow.mockResolvedValue({
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresIn: 3600,
      scopes: []
    })
    apiMock.getCurrentUser.mockResolvedValue({ id: 'id', displayName: 'X', product: 'premium' })
    tokenStoreMock.writeSpotifyTokens.mockResolvedValue(undefined)
    tokenStoreMock.clearSpotifyTokens.mockResolvedValue(undefined)

    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.connect()
    expect(m.status().connected).toBe(true)

    apiMock.getCurrentlyPlaying.mockRejectedValue(new apiMock.AuthExpiredError())
    const events: unknown[] = []
    m.on('status-changed', (s) => events.push(s))
    await m.pollOnce()
    expect(m.status().connected).toBe(false)
    expect(tokenStoreMock.clearSpotifyTokens).toHaveBeenCalled()
    const lastEvent = events[events.length - 1] as { connected: boolean }
    expect(lastEvent.connected).toBe(false)
  })

  it('restoreFromDisk() rehydrates tokens on launch', async () => {
    tokenStoreMock.readSpotifyTokens.mockResolvedValue({
      version: 1,
      accessToken: 'AT',
      refreshToken: 'RT',
      expiresAt: '2099-01-01T00:00:00Z',
      scopes: [],
      displayName: 'Saved',
      isPremium: 'yes'
    })
    const { getSpotifyManager } = await import('../spotifyManager')
    const m = getSpotifyManager()
    await m.restoreFromDisk()
    const s = m.status()
    expect(s.connected).toBe(true)
    expect(s.displayName).toBe('Saved')
    expect(s.isPremium).toBe('yes')
  })
})
