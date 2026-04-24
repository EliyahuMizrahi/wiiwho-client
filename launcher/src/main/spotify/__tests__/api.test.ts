// @vitest-environment node
/**
 * Spotify Web API client tests (Plan 04-05 Task 3).
 *
 * Covers:
 *   - spotifyFetch happy path + Bearer header
 *   - 401 → single refresh + retry (second 401 → AuthExpiredError)
 *   - 429 → read Retry-After, wait, retry once
 *   - 403 with reason='PREMIUM_REQUIRED' → { premiumRequired: true }, no retry
 *   - 403 other reasons → throw
 *   - getCurrentlyPlaying: track / 204 / null-item shapes
 *   - play/pause/next/previous surface premiumRequired flag
 *   - getCurrentUser displayName + product
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

// ---------------- spotifyFetch --------------------------------------------

describe('spotifyFetch', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('200 OK passes through with parsed body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    )
    const { spotifyFetch } = await import('../api')
    const res = await spotifyFetch('AT', 'https://api.spotify.com/v1/me')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: number }
    expect(body.ok).toBe(1)
  })

  it('Authorization header uses Bearer <token>', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyFetch } = await import('../api')
    await spotifyFetch('ABC', 'https://api.spotify.com/v1/me')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ABC')
  })

  it('401 triggers refresh + retry; second call uses the NEW token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const onRefresh = vi
      .fn()
      .mockResolvedValue({ accessToken: 'NEW', refreshToken: 'RT', expiresIn: 3600 })
    const { spotifyFetch } = await import('../api')
    const res = await spotifyFetch('OLD', 'https://api.spotify.com/v1/me', { onRefresh })
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondInit = fetchMock.mock.calls[1][1] as RequestInit
    expect((secondInit.headers as Record<string, string>).Authorization).toBe('Bearer NEW')
  })

  it('second consecutive 401 throws AuthExpiredError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const onRefresh = vi
      .fn()
      .mockResolvedValue({ accessToken: 'NEW', refreshToken: 'RT', expiresIn: 3600 })
    const { spotifyFetch, AuthExpiredError } = await import('../api')
    await expect(
      spotifyFetch('OLD', 'https://api.spotify.com/v1/me', { onRefresh })
    ).rejects.toBeInstanceOf(AuthExpiredError)
  })

  it('401 without onRefresh falls through with the 401 status (no retry)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyFetch } = await import('../api')
    const res = await spotifyFetch('AT', 'https://api.spotify.com/v1/me')
    expect(res.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('429 reads Retry-After and retries exactly once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'Retry-After': '1' } })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyFetch } = await import('../api')
    const start = Date.now()
    const res = await spotifyFetch('AT', 'https://api.spotify.com/v1/me')
    const elapsed = Date.now() - start
    expect(res.status).toBe(200)
    expect(elapsed).toBeGreaterThanOrEqual(900) // allow 100 ms scheduler slack
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 10000)

  it('403 with PREMIUM_REQUIRED body sets premiumRequired flag; does NOT retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            status: 403,
            message: 'Player command failed: Premium required',
            reason: 'PREMIUM_REQUIRED'
          }
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyFetch } = await import('../api')
    const res = await spotifyFetch('AT', 'https://api.spotify.com/v1/me/player/play')
    expect(res.premiumRequired).toBe(true)
    expect(res.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('403 without PREMIUM_REQUIRED (other reason) throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { status: 403, message: 'Some other error', reason: 'SOMETHING_ELSE' }
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const { spotifyFetch } = await import('../api')
    await expect(
      spotifyFetch('AT', 'https://api.spotify.com/v1/me/player/play')
    ).rejects.toThrow(/403/)
  })
})

// ---------------- getCurrentlyPlaying -------------------------------------

describe('getCurrentlyPlaying', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('200 with item returns the normalized track', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            item: {
              id: 't1',
              name: 'Song',
              artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
              album: { images: [{ url: 'https://a.com/x.jpg' }] }
            },
            is_playing: true
          }),
          { status: 200 }
        )
      )
    )
    const { getCurrentlyPlaying } = await import('../api')
    const t = await getCurrentlyPlaying('AT')
    expect(t?.id).toBe('t1')
    expect(t?.name).toBe('Song')
    expect(t?.artists).toEqual(['Artist A', 'Artist B'])
    expect(t?.albumArtUrl).toBe('https://a.com/x.jpg')
    expect(t?.isPlaying).toBe(true)
  })

  it('204 No Content returns null (idle state)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const { getCurrentlyPlaying } = await import('../api')
    const t = await getCurrentlyPlaying('AT')
    expect(t).toBeNull()
  })

  it('200 with item=null returns null', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ item: null, is_playing: false }), { status: 200 })
        )
    )
    const { getCurrentlyPlaying } = await import('../api')
    const t = await getCurrentlyPlaying('AT')
    expect(t).toBeNull()
  })
})

// ---------------- play/pause/next/previous + PREMIUM_REQUIRED -------------

describe('play/pause/next/previous surface premiumRequired on 403 PREMIUM_REQUIRED', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['play', 'PUT', '/v1/me/player/play'],
    ['pause', 'PUT', '/v1/me/player/pause'],
    ['next', 'POST', '/v1/me/player/next'],
    ['previous', 'POST', '/v1/me/player/previous']
  ])('%s returns { premiumRequired: true } on 403 PREMIUM_REQUIRED', async (fnName) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { status: 403, message: 'x', reason: 'PREMIUM_REQUIRED' } }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const api = (await import('../api')) as unknown as Record<
      string,
      (t: string) => Promise<{ premiumRequired: boolean }>
    >
    const out = await api[fnName]('AT')
    expect(out.premiumRequired).toBe(true)
  })

  it('play returns { premiumRequired: false } on 204 success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const { play } = await import('../api')
    const out = await play('AT')
    expect(out.premiumRequired).toBe(false)
  })
})

// ---------------- getCurrentUser -----------------------------------------

describe('getCurrentUser', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns displayName, id, and product (free|premium)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ display_name: 'Owner', product: 'premium', id: 'spid' }),
            { status: 200 }
          )
        )
    )
    const { getCurrentUser } = await import('../api')
    const u = await getCurrentUser('AT')
    expect(u.displayName).toBe('Owner')
    expect(u.product).toBe('premium')
    expect(u.id).toBe('spid')
  })

  it('handles product === "free"', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ display_name: 'Free User', product: 'free', id: 'fid' }), {
            status: 200
          })
        )
    )
    const { getCurrentUser } = await import('../api')
    const u = await getCurrentUser('AT')
    expect(u.product).toBe('free')
  })
})
