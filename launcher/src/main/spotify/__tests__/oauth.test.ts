// @vitest-environment node
/**
 * Spotify PKCE OAuth + one-shot loopback callback server tests (Plan 04-05
 * Task 2).
 *
 * The port-fallback variant: unlike the plan's original illustrative test
 * (bind to port 0), this suite honors the Plan 04-00 deviation — we bind
 * in-order to SPOTIFY_REDIRECT_PORTS and surface PORTS_BUSY when all three
 * are occupied. Dashboard registrations are fixed to those three ports,
 * so runtime-random ports would never match `redirect_uri` at /token.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createServer as createRealServer } from 'node:http'
import type { Server } from 'node:http'

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
  app: { getPath: (): string => '' }
}))

// Mock config with deterministic values — we pin three real but deliberately-odd
// ports so we can occupy them in tests without colliding with the dashboard-
// registered production ports (53682/53681/53683).
vi.mock('../config', () => ({
  SPOTIFY_CLIENT_ID: 'test-client-id-AAAAAAAA',
  SPOTIFY_AUTH_URL: 'https://accounts.spotify.com/authorize',
  SPOTIFY_TOKEN_URL: 'https://accounts.spotify.com/api/token',
  SPOTIFY_API_BASE: 'https://api.spotify.com/v1',
  SPOTIFY_SCOPES: [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state'
  ],
  SPOTIFY_REDIRECT_PATH: '/callback',
  SPOTIFY_REDIRECT_PORTS: [57821, 57822, 57823],
  buildRedirectUri: (port: number): string => `http://127.0.0.1:${port}/callback`
}))

// -------- PKCE generator -----------------------------------------------------

describe('generatePkcePair', () => {
  it('code_verifier is 43–128 chars, base64url charset (no padding)', async () => {
    const { generatePkcePair } = await import('../oauth')
    const { codeVerifier } = generatePkcePair()
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(codeVerifier.length).toBeLessThanOrEqual(128)
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(codeVerifier).not.toMatch(/=/)
  })

  it('code_challenge is sha256 of verifier, base64url, no padding', async () => {
    const { generatePkcePair } = await import('../oauth')
    const { codeVerifier, codeChallenge } = generatePkcePair()
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(codeChallenge).not.toMatch(/=/)
    const { createHash } = await import('node:crypto')
    const expected = createHash('sha256').update(codeVerifier).digest('base64url')
    expect(codeChallenge).toBe(expected)
  })

  it('each call produces a fresh verifier (entropy check)', async () => {
    const { generatePkcePair } = await import('../oauth')
    const a = generatePkcePair()
    const b = generatePkcePair()
    expect(a.codeVerifier).not.toBe(b.codeVerifier)
  })
})

// -------- One-shot callback server ------------------------------------------

describe('startOneShotCallbackServer (port fallback)', () => {
  const occupied: Server[] = []

  afterEach(async () => {
    for (const s of occupied.splice(0)) {
      await new Promise<void>((r) => s.close(() => r()))
    }
  })

  it('binds to the first port in SPOTIFY_REDIRECT_PORTS when free', async () => {
    const { startOneShotCallbackServer } = await import('../oauth')
    const server = await startOneShotCallbackServer()
    expect(server.port).toBe(57821)
    server.close()
  })

  it('falls back to port 2 when port 1 is occupied (EADDRINUSE)', async () => {
    // Occupy 57821.
    const blocker = createRealServer()
    await new Promise<void>((r) => blocker.listen(57821, '127.0.0.1', r))
    occupied.push(blocker)

    const { startOneShotCallbackServer } = await import('../oauth')
    const server = await startOneShotCallbackServer()
    expect(server.port).toBe(57822)
    server.close()
  })

  it('falls back to port 3 when ports 1 and 2 are occupied', async () => {
    const b1 = createRealServer()
    const b2 = createRealServer()
    await new Promise<void>((r) => b1.listen(57821, '127.0.0.1', r))
    await new Promise<void>((r) => b2.listen(57822, '127.0.0.1', r))
    occupied.push(b1, b2)

    const { startOneShotCallbackServer } = await import('../oauth')
    const server = await startOneShotCallbackServer()
    expect(server.port).toBe(57823)
    server.close()
  })

  it('throws PORTS_BUSY when all three ports are occupied', async () => {
    const b1 = createRealServer()
    const b2 = createRealServer()
    const b3 = createRealServer()
    await new Promise<void>((r) => b1.listen(57821, '127.0.0.1', r))
    await new Promise<void>((r) => b2.listen(57822, '127.0.0.1', r))
    await new Promise<void>((r) => b3.listen(57823, '127.0.0.1', r))
    occupied.push(b1, b2, b3)

    const { startOneShotCallbackServer } = await import('../oauth')
    await expect(startOneShotCallbackServer()).rejects.toThrow(/PORTS_BUSY/)
  })

  it('resolves awaitCallback on GET /callback?code=X&state=Y', async () => {
    const { startOneShotCallbackServer } = await import('../oauth')
    const server = await startOneShotCallbackServer()
    const pending = server.awaitCallback()
    await fetch(`http://127.0.0.1:${server.port}/callback?code=ABC&state=XYZ`)
    const { code, state } = await pending
    expect(code).toBe('ABC')
    expect(state).toBe('XYZ')
  })

  it('rejects awaitCallback when error query param is present', async () => {
    const { startOneShotCallbackServer } = await import('../oauth')
    const server = await startOneShotCallbackServer()
    const pending = server.awaitCallback()
    await fetch(`http://127.0.0.1:${server.port}/callback?error=access_denied`)
    await expect(pending).rejects.toThrow(/access_denied/)
  })

  it('returns HTTP 200 with HTML body to the browser', async () => {
    const { startOneShotCallbackServer } = await import('../oauth')
    const server = await startOneShotCallbackServer()
    const pending = server.awaitCallback()
    const res = await fetch(`http://127.0.0.1:${server.port}/callback?code=A&state=B`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/Connected/i)
    await pending
  })
})

// -------- buildAuthorizeUrl -------------------------------------------------

describe('buildAuthorizeUrl', () => {
  it('includes client_id, response_type=code, S256 challenge, scope, state, and exact redirect_uri (with port)', async () => {
    const { buildAuthorizeUrl } = await import('../oauth')
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'id',
        redirectUri: 'http://127.0.0.1:57821/callback',
        codeChallenge: 'xyz',
        scopes: ['user-read-currently-playing'],
        state: 'abc'
      })
    )
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize')
    expect(url.searchParams.get('client_id')).toBe('id')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe('xyz')
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:57821/callback')
    expect(url.searchParams.get('scope')).toBe('user-read-currently-playing')
    expect(url.searchParams.get('state')).toBe('abc')
  })
})

// -------- exchangeCodeForTokens / refreshAccessToken ------------------------

describe('exchangeCodeForTokens', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs form body with grant_type=authorization_code + code + verifier + redirect_uri + client_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'AT',
          refresh_token: 'RT',
          expires_in: 3600,
          scope: 'user-read-currently-playing'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const { exchangeCodeForTokens } = await import('../oauth')
    const out = await exchangeCodeForTokens({
      code: 'C',
      codeVerifier: 'V',
      redirectUri: 'http://127.0.0.1:57821/callback'
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://accounts.spotify.com/api/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded'
        })
      })
    )
    const init = fetchMock.mock.calls[0][1] as { body: URLSearchParams }
    const body = init.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('C')
    expect(body.get('redirect_uri')).toBe('http://127.0.0.1:57821/callback')
    expect(body.get('client_id')).toBe('test-client-id-AAAAAAAA')
    expect(body.get('code_verifier')).toBe('V')
    expect(out.accessToken).toBe('AT')
    expect(out.refreshToken).toBe('RT')
    expect(out.expiresIn).toBe(3600)
  })

  it('throws on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }))
    )
    const { exchangeCodeForTokens } = await import('../oauth')
    await expect(
      exchangeCodeForTokens({
        code: 'C',
        codeVerifier: 'V',
        redirectUri: 'http://127.0.0.1:57821/callback'
      })
    ).rejects.toThrow(/token exchange failed.*400/i)
  })
})

describe('refreshAccessToken', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs grant_type=refresh_token + current refresh + client_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'AT2',
          expires_in: 3600,
          scope: 'user-read-currently-playing'
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const { refreshAccessToken } = await import('../oauth')
    const out = await refreshAccessToken('OLD_RT')
    expect(out.accessToken).toBe('AT2')
    // Spotify MAY or MAY NOT rotate refresh token; absence → keep old.
    expect(out.refreshToken).toBe('OLD_RT')
    const init = fetchMock.mock.calls[0][1] as { body: URLSearchParams }
    const body = init.body as URLSearchParams
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('OLD_RT')
  })

  it('uses the rotated refresh_token if Spotify returns one', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ access_token: 'AT3', refresh_token: 'NEW_RT', expires_in: 3600 }),
            { status: 200 }
          )
        )
    )
    const { refreshAccessToken } = await import('../oauth')
    const out = await refreshAccessToken('OLD_RT')
    expect(out.refreshToken).toBe('NEW_RT')
  })

  it('throws on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }))
    )
    const { refreshAccessToken } = await import('../oauth')
    await expect(refreshAccessToken('RT')).rejects.toThrow(/refresh failed.*400/i)
  })
})

// -------- End-to-end PKCE flow orchestration (state CSRF validation) --------

describe('startPKCEFlow', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens external browser, awaits callback, validates state, exchanges code for tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'FLOW_AT',
            refresh_token: 'FLOW_RT',
            expires_in: 3600,
            scope: 'user-read-currently-playing user-read-playback-state user-modify-playback-state'
          }),
          { status: 200 }
        )
      )
    )
    const electron = (await import('electron')) as unknown as {
      shell: { openExternal: ReturnType<typeof vi.fn> }
    }
    // Intercept openExternal — instead of opening a browser, immediately GET
    // the callback URL back into our own loopback server.
    electron.shell.openExternal.mockImplementation(async (authUrl: string) => {
      const u = new URL(authUrl)
      const redirectUri = u.searchParams.get('redirect_uri')!
      const state = u.searchParams.get('state')!
      await fetch(`${redirectUri}?code=FAKE_CODE&state=${encodeURIComponent(state)}`)
    })

    const { startPKCEFlow } = await import('../oauth')
    const result = await startPKCEFlow()
    expect(result.accessToken).toBe('FLOW_AT')
    expect(result.refreshToken).toBe('FLOW_RT')
    expect(result.scopes).toContain('user-read-currently-playing')
  })

  it('throws on state mismatch (CSRF defense)', async () => {
    const electron = (await import('electron')) as unknown as {
      shell: { openExternal: ReturnType<typeof vi.fn> }
    }
    electron.shell.openExternal.mockImplementation(async (authUrl: string) => {
      const u = new URL(authUrl)
      const redirectUri = u.searchParams.get('redirect_uri')!
      // WRONG state deliberately.
      await fetch(`${redirectUri}?code=C&state=WRONG_STATE_VALUE`)
    })

    const { startPKCEFlow } = await import('../oauth')
    await expect(startPKCEFlow()).rejects.toThrow(/state mismatch/i)
  })
})
