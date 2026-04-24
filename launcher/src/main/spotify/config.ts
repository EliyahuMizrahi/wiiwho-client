/**
 * Spotify OAuth + Web API non-secret configuration.
 *
 * Client ID is PUBLIC — PKCE public-client flow has no client secret.
 * Registered under the owner's Spotify account at https://developer.spotify.com/dashboard.
 *
 * IMPORTANT — two CORRECTIONS relative to the original plan / CONTEXT D-31:
 *
 * 1. CONTEXT D-31 said: Redirect URI "http://127.0.0.1:*" (wildcard). That was
 *    already wrong before Spotify's 2025-11-27 OAuth migration (no wildcards).
 *
 * 2. Plan 04-00 then corrected to a single bare "http://127.0.0.1/callback"
 *    (no port), under the assumption that Spotify's loopback exemption would
 *    accept any runtime port. That is ALSO wrong as of 2026-04 (verified):
 *      - http://localhost/... is rejected outright.
 *      - Bare http://127.0.0.1/callback with no port is flagged by the
 *        dashboard validator as "not secure" and refused.
 *      - Redirect URIs MUST use an explicit port:
 *            http://127.0.0.1:<PORT>/callback
 *      - The URI sent to /authorize must EXACTLY match a registered URI — so
 *        ports must be pre-registered, not runtime-chosen.
 *
 *    The owner has therefore registered THREE fixed loopback ports in the
 *    Spotify dashboard (primary + 2 fallbacks). Plan 04-05's OAuth module
 *    will try SPOTIFY_REDIRECT_PORTS in order until one binds, then pass the
 *    matching buildRedirectUri(port) to /authorize.
 *
 * Sources (verified 2026-04):
 *   - https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
 *   - https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025
 *   - RESEARCH.md §Spotify OAuth, §Redirect URI registration, §Scopes (D-30)
 */

/** Non-secret PKCE public-client ID. Registered under owner's Spotify account. */
export const SPOTIFY_CLIENT_ID = '1829b668cd8d43b48b0b3787e7ee8d06'

/** OAuth scopes — D-30. Read-only + playback-control (Premium required for control). */
export const SPOTIFY_SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state'
] as const

/**
 * Loopback ports registered in the Spotify dev dashboard (primary + fallbacks).
 * Each port N has a corresponding registered redirect URI of the form
 * `http://127.0.0.1:${N}/callback`. Plan 04-05 will try these in order.
 *
 * Adding/removing ports here REQUIRES a matching dashboard edit — the
 * /authorize redirect_uri must exactly match a registered URI.
 */
export const SPOTIFY_REDIRECT_PORTS = [53682, 53681, 53683] as const

/** Redirect path component. Port is selected from SPOTIFY_REDIRECT_PORTS at runtime. */
export const SPOTIFY_REDIRECT_PATH = '/callback'

/**
 * Build the full redirect URI for a given loopback port. The produced string
 * MUST exactly match one of the dashboard-registered URIs — callers should
 * only pass ports from SPOTIFY_REDIRECT_PORTS.
 */
export function buildRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}/callback`
}

/** Authorize endpoint (user-facing OAuth). */
export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'

/** Token-exchange + refresh endpoint (server-side POST). */
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

/** Web API base (for /v1/me, /v1/me/player, etc.). */
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'
