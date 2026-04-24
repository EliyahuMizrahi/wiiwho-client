/**
 * Spotify Web API client wrappers.
 *
 * Core behaviors (from Plan 04-05 + RESEARCH):
 *   - 401 Unauthorized → single refresh-and-retry via caller-provided `onRefresh`.
 *     Second 401 throws `AuthExpiredError` — caller should clear tokens and
 *     surface "disconnected" to the renderer.
 *   - 429 Too Many Requests → honor `Retry-After` seconds header; wait; retry
 *     exactly once. No exponential backoff. No second retry.
 *   - 403 Forbidden with body `{ error: { reason: "PREMIUM_REQUIRED" } }` →
 *     return `{ status: 403, premiumRequired: true }`. Caller sets
 *     `isPremium=false` on the SpotifyManager singleton and surfaces a
 *     "Premium required" badge via IPC (Plan 04-06). This is a *non-retry*
 *     path — retrying produces identical results.
 *   - 403 with any other reason → throw with the API's message.
 *
 * These handlers sit BELOW the Authorization header layer — Bearer tokens
 * are added per-request and swapped on refresh.
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Rate limits,
 *   §403 PREMIUM_REQUIRED handling.
 */

import { SPOTIFY_API_BASE } from './config'
import type { TokensOut } from './oauth'

/** Thrown when the Spotify API returns 401 AFTER a refresh attempt. */
export class AuthExpiredError extends Error {
  constructor() {
    super('Spotify auth expired after refresh attempt')
    this.name = 'AuthExpiredError'
  }
}

/** Result of a spotifyFetch call — a slim Response-like surface. */
export interface SpotifyResponse<T = unknown> {
  status: number
  json: () => Promise<T>
  /** True iff the server returned 403 with reason PREMIUM_REQUIRED. */
  premiumRequired: boolean
}

/** Extra options beyond standard RequestInit. */
export interface SpotifyFetchInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  /** Called on 401 to mint a new access token. Caller persists the refreshed tokens. */
  onRefresh?: () => Promise<TokensOut>
}

export async function spotifyFetch<T = unknown>(
  accessToken: string,
  url: string,
  init: SpotifyFetchInit = {}
): Promise<SpotifyResponse<T>> {
  const { onRefresh, headers: initHeaders, ...rest } = init
  const doFetch = (token: string): Promise<Response> =>
    fetch(url, {
      ...rest,
      headers: {
        ...initHeaders,
        Authorization: `Bearer ${token}`
      }
    })

  let res = await doFetch(accessToken)

  // 401 handling — refresh once, retry once.
  if (res.status === 401 && onRefresh) {
    const fresh = await onRefresh()
    res = await doFetch(fresh.accessToken)
    if (res.status === 401) {
      throw new AuthExpiredError()
    }
  }

  // 429 handling — Retry-After authoritative; single retry.
  if (res.status === 429) {
    const retryAfterRaw = res.headers.get('Retry-After') ?? '30'
    const retryAfter = parseInt(retryAfterRaw, 10)
    const waitMs = Math.max(0, Number.isFinite(retryAfter) ? retryAfter * 1000 : 30_000)
    await new Promise((r) => setTimeout(r, waitMs))
    res = await doFetch(accessToken)
  }

  // 403 handling — detect PREMIUM_REQUIRED and surface a flag; everything else throws.
  if (res.status === 403) {
    let body: { error?: { reason?: string; message?: string } } | null = null
    try {
      body = (await res.clone().json()) as { error?: { reason?: string; message?: string } }
    } catch {
      // Body not JSON — leave body as null; fall through to throw.
    }
    if (body?.error?.reason === 'PREMIUM_REQUIRED') {
      return {
        status: 403,
        json: () => Promise.resolve((body ?? {}) as T),
        premiumRequired: true
      }
    }
    throw new Error(`Spotify 403: ${body?.error?.message ?? 'forbidden'}`)
  }

  return {
    status: res.status,
    json: (): Promise<T> => res.json() as Promise<T>,
    premiumRequired: false
  }
}

// -----------------------------------------------------------------------------
// Read endpoints
// -----------------------------------------------------------------------------

export interface Track {
  id: string
  name: string
  artists: string[]
  albumArtUrl?: string
  isPlaying: boolean
}

interface CurrentlyPlayingResponse {
  item: {
    id: string
    name: string
    artists: { name: string }[]
    album: { images: { url: string }[] }
  } | null
  is_playing: boolean
}

export async function getCurrentlyPlaying(
  accessToken: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<Track | null> {
  const res = await spotifyFetch<CurrentlyPlayingResponse>(
    accessToken,
    `${SPOTIFY_API_BASE}/me/player/currently-playing`,
    { onRefresh }
  )
  // 204 = idle (no active playback context).
  if (res.status === 204) return null
  if (res.status !== 200) return null
  const body = await res.json()
  if (!body.item) return null
  return {
    id: body.item.id,
    name: body.item.name,
    artists: body.item.artists.map((a) => a.name),
    albumArtUrl: body.item.album.images[0]?.url,
    isPlaying: body.is_playing
  }
}

export async function getPlaybackState(
  accessToken: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<{ isPlaying: boolean } | null> {
  const res = await spotifyFetch<{ is_playing: boolean }>(
    accessToken,
    `${SPOTIFY_API_BASE}/me/player`,
    { onRefresh }
  )
  if (res.status === 204) return null
  if (res.status !== 200) return null
  const body = await res.json()
  return { isPlaying: body.is_playing }
}

// -----------------------------------------------------------------------------
// Control endpoints (all require Premium — 403 PREMIUM_REQUIRED on free tier)
// -----------------------------------------------------------------------------

async function controlCall(
  method: 'PUT' | 'POST',
  accessToken: string,
  endpoint: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<{ premiumRequired: boolean }> {
  const res = await spotifyFetch(accessToken, `${SPOTIFY_API_BASE}${endpoint}`, {
    method,
    onRefresh
  })
  return { premiumRequired: res.premiumRequired }
}

export const play = (
  t: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<{ premiumRequired: boolean }> => controlCall('PUT', t, '/me/player/play', onRefresh)

export const pause = (
  t: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<{ premiumRequired: boolean }> => controlCall('PUT', t, '/me/player/pause', onRefresh)

export const next = (
  t: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<{ premiumRequired: boolean }> => controlCall('POST', t, '/me/player/next', onRefresh)

export const previous = (
  t: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<{ premiumRequired: boolean }> =>
  controlCall('POST', t, '/me/player/previous', onRefresh)

// -----------------------------------------------------------------------------
// User profile
// -----------------------------------------------------------------------------

export interface SpotifyUser {
  id: string
  displayName: string
  /** 'premium' | 'free' | 'open' — Spotify's tier classification. */
  product: 'premium' | 'free' | 'open' | string
}

export async function getCurrentUser(
  accessToken: string,
  onRefresh?: () => Promise<TokensOut>
): Promise<SpotifyUser> {
  const res = await spotifyFetch<{ id: string; display_name: string; product: string }>(
    accessToken,
    `${SPOTIFY_API_BASE}/me`,
    { onRefresh }
  )
  const body = await res.json()
  return {
    id: body.id,
    displayName: body.display_name,
    product: body.product as SpotifyUser['product']
  }
}
