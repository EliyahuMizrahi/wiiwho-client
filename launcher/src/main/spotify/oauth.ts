/**
 * Spotify PKCE Authorization Code flow + one-shot loopback callback server.
 *
 * REDIRECT URI CORRECTION CHAIN (Pitfall 6):
 *   CONTEXT D-31 (original plan) said: "http://127.0.0.1" + wildcard-port — WRONG.
 *   Plan 04-00 Task 2 correction said: bare "http://127.0.0.1/callback" — ALSO WRONG.
 *   Actual 2026-04 Spotify rule (post 2025-11-27 OAuth migration):
 *     Redirect URIs MUST be exact-match and MUST include an explicit port
 *     pre-registered in the dashboard. The owner has registered THREE ports
 *     (primary + 2 fallbacks) in launcher/src/main/spotify/config.ts.
 *
 *   This module:
 *     1. Tries SPOTIFY_REDIRECT_PORTS in order (EADDRINUSE → next);
 *     2. Uses buildRedirectUri(port) for the /authorize `redirect_uri` param;
 *     3. Re-uses the SAME URI at /api/token (Spotify validates consistency);
 *     4. Rejects with Error "PORTS_BUSY" if all three ports are occupied.
 *
 * PKCE mechanics:
 *   - code_verifier = base64url(randomBytes(64))  → 86 chars, URL-safe charset
 *   - code_challenge = base64url(sha256(verifier))
 *   - challenge_method = S256
 *   - state param = randomBytes(16) base64url, validated on callback (CSRF)
 *
 * Sources:
 *   - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Spotify OAuth + §PKCE
 *   - .planning/phases/04-launcher-ui-polish/04-00-infrastructure-SUMMARY.md
 *     §Deviations / redirect URI correction
 *   - https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomBytes, createHash } from 'node:crypto'
import { shell } from 'electron'
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_AUTH_URL,
  SPOTIFY_TOKEN_URL,
  SPOTIFY_SCOPES,
  SPOTIFY_REDIRECT_PATH,
  SPOTIFY_REDIRECT_PORTS,
  buildRedirectUri
} from './config'

// -----------------------------------------------------------------------------
// PKCE pair
// -----------------------------------------------------------------------------

export interface PkcePair {
  codeVerifier: string
  codeChallenge: string
}

export function generatePkcePair(): PkcePair {
  // 64 random bytes → 86 base64url chars. Comfortably inside the 43–128 PKCE
  // spec window and within Spotify's own implementation's accepted range.
  const codeVerifier = randomBytes(64).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

// -----------------------------------------------------------------------------
// One-shot loopback callback server
// -----------------------------------------------------------------------------

export interface OneShotServer {
  /** Port we actually bound to — one of SPOTIFY_REDIRECT_PORTS. */
  port: number
  /** Resolves on GET /callback with { code, state }; rejects on error param or timeout. */
  awaitCallback: () => Promise<{ code: string; state: string }>
  /** Force-close the underlying HTTP server. */
  close: () => void
}

/**
 * Attempt to bind a fresh HTTP server on one of SPOTIFY_REDIRECT_PORTS, in
 * order. On EADDRINUSE for a given port, fall through to the next. If all
 * three are occupied, reject with a `PORTS_BUSY` error — the IPC handler
 * surfaces this to the renderer as a user-friendly "Port conflict" CTA.
 */
async function bindWithFallback(): Promise<{ server: Server; port: number }> {
  for (const port of SPOTIFY_REDIRECT_PORTS) {
    const server = createServer()
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException): void => {
          server.off('listening', onListening)
          reject(err)
        }
        const onListening = (): void => {
          server.off('error', onError)
          resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, '127.0.0.1')
      })
      // Bound successfully.
      const bound = (server.address() as AddressInfo).port
      return { server, port: bound }
    } catch (e: unknown) {
      // Close the half-dead server and try the next port.
      server.close()
      const err = e as NodeJS.ErrnoException
      if (err.code === 'EADDRINUSE') continue
      // Unexpected bind error — don't keep trying, surface it.
      throw err
    }
  }
  throw new Error(
    `PORTS_BUSY: all Spotify OAuth redirect ports (${SPOTIFY_REDIRECT_PORTS.join(', ')}) are in use`
  )
}

export async function startOneShotCallbackServer(): Promise<OneShotServer> {
  const { server, port } = await bindWithFallback()

  // Attach the request handler EAGERLY (before startPKCEFlow awaits openExternal),
  // so an inbound callback that arrives before the caller calls awaitCallback()
  // is still captured. The handler settles a single pre-created promise and
  // awaitCallback() just returns that promise.
  let settled = false
  let resolveCb: (v: { code: string; state: string }) => void = () => {}
  let rejectCb: (e: Error) => void = () => {}
  const settledPromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
    resolveCb = resolve
    rejectCb = reject
  })
  // Swallow the rejection-if-nobody-awaits path quietly — awaitCallback
  // installs the real consumer, but attaching a no-op .catch keeps Node
  // from flagging synchronous rejects on the request handler as unhandled.
  settledPromise.catch(() => {})

  const timeout = setTimeout(
    () => {
      if (settled) return
      settled = true
      server.closeAllConnections?.()
      server.close()
      rejectCb(new Error('Spotify OAuth callback timed out after 5 minutes'))
    },
    5 * 60 * 1000
  )

  server.on('request', (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
    if (url.pathname !== SPOTIFY_REDIRECT_PATH) {
      res.writeHead(404).end()
      return
    }
    if (settled) {
      res.writeHead(410).end()
      return
    }
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Tell the browser (and Node) not to keep this connection alive —
    // otherwise server.close() waits for idle-keepalive to drain and the
    // port lingers into the next test / next OAuth attempt.
    res.setHeader('Connection', 'close')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wiiwho - Spotify Connected</title>` +
        `<style>body{font-family:system-ui,sans-serif;background:#111;color:#e5e5e5;display:grid;` +
        `place-items:center;height:100vh;margin:0}h1{color:#16e0ee;margin:0 0 .5em}p{opacity:.7;margin:0}</style>` +
        `</head><body><div><h1>Connected</h1><p>You can close this window and return to Wiiwho.</p></div></body></html>`
    )

    settled = true
    clearTimeout(timeout)
    // Prevent lingering keep-alive sockets from holding the port open.
    server.closeAllConnections?.()
    server.close()

    if (error) {
      rejectCb(new Error(`Spotify OAuth error: ${error}`))
      return
    }
    if (!code || !state) {
      rejectCb(new Error('Missing code or state in callback'))
      return
    }
    resolveCb({ code, state })
  })

  const awaitCallback = (): Promise<{ code: string; state: string }> => settledPromise

  return {
    port,
    awaitCallback,
    close: (): void => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
      }
      server.closeAllConnections?.()
      server.close()
    }
  }
}

// -----------------------------------------------------------------------------
// buildAuthorizeUrl
// -----------------------------------------------------------------------------

export interface AuthorizeUrlArgs {
  clientId: string
  redirectUri: string
  codeChallenge: string
  scopes: readonly string[]
  state: string
}

export function buildAuthorizeUrl(args: AuthorizeUrlArgs): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    response_type: 'code',
    redirect_uri: args.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: args.codeChallenge,
    scope: [...args.scopes].join(' '),
    state: args.state
  })
  return `${SPOTIFY_AUTH_URL}?${params}`
}

// -----------------------------------------------------------------------------
// Token exchange + refresh
// -----------------------------------------------------------------------------

export interface TokensOut {
  accessToken: string
  refreshToken: string
  /** Seconds until `accessToken` expires (typically 3600). */
  expiresIn: number
  /** Space-separated scopes Spotify granted (may be a subset of requested). */
  scope?: string
}

export async function exchangeCodeForTokens(args: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<TokensOut> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: args.codeVerifier
  })
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed: ${res.status}`)
  }
  const j = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope?: string
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresIn: j.expires_in,
    scope: j.scope
  }
}

export async function refreshAccessToken(currentRefreshToken: string): Promise<TokensOut> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
    client_id: SPOTIFY_CLIENT_ID
  })
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) {
    throw new Error(`Spotify refresh failed: ${res.status}`)
  }
  const j = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  }
  return {
    accessToken: j.access_token,
    // Spotify MAY rotate the refresh_token; if not, keep the caller's old one.
    refreshToken: j.refresh_token ?? currentRefreshToken,
    expiresIn: j.expires_in,
    scope: j.scope
  }
}

// -----------------------------------------------------------------------------
// Full PKCE flow orchestration
// -----------------------------------------------------------------------------

export interface PkceFlowResult extends TokensOut {
  scopes: string[]
}

/**
 * Orchestrates the full PKCE Authorization Code flow end-to-end:
 *   1. Bind a one-shot loopback server on one of SPOTIFY_REDIRECT_PORTS
 *   2. Generate a PKCE verifier/challenge pair + a CSRF state nonce
 *   3. Open the system browser to accounts.spotify.com/authorize
 *   4. Wait for the browser to redirect back to /callback
 *   5. Validate returned state matches (CSRF defense) — throws on mismatch
 *   6. POST to /api/token with the authorization_code + verifier
 *   7. Return the parsed tokens
 *
 * Caller (SpotifyManager) persists the result via writeSpotifyTokens().
 */
export async function startPKCEFlow(): Promise<PkceFlowResult> {
  const server = await startOneShotCallbackServer()
  const redirectUri = buildRedirectUri(server.port)
  const { codeVerifier, codeChallenge } = generatePkcePair()
  const state = randomBytes(16).toString('base64url')
  const authUrl = buildAuthorizeUrl({
    clientId: SPOTIFY_CLIENT_ID,
    redirectUri,
    codeChallenge,
    scopes: SPOTIFY_SCOPES,
    state
  })
  await shell.openExternal(authUrl)
  const { code, state: returnedState } = await server.awaitCallback()
  if (returnedState !== state) {
    throw new Error('Spotify OAuth state mismatch — CSRF defense triggered')
  }
  const tokens = await exchangeCodeForTokens({ code, codeVerifier, redirectUri })
  const scopes = (tokens.scope ?? SPOTIFY_SCOPES.join(' ')).split(' ').filter(Boolean)
  return { ...tokens, scopes }
}
