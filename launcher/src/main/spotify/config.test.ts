/**
 * Plan 04-00 Task 3 — Spotify config module tests.
 *
 * Pins the non-secret Spotify config surface for all downstream Phase 4 plans:
 *   - Client ID exists and matches Spotify's documented 32-char base62 shape
 *     (also permissive enough to survive any future Spotify client-ID length
 *     change, up to 64 chars).
 *   - Scopes are the D-30 trio verbatim.
 *   - Redirect ports are a non-empty readonly list of positive integers.
 *   - buildRedirectUri returns the exact shape Spotify's 2025-11-27-migrated
 *     dashboard requires: http://127.0.0.1:<PORT>/callback (explicit port).
 *   - Static guard: SPOTIFY_REDIRECT_PATH must NOT contain ':' or '*' — catches
 *     a regression toward CONTEXT D-31's wildcard shape or an inline port.
 *   - Every dashboard-registered port must produce a valid loopback URI.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_SCOPES,
  SPOTIFY_REDIRECT_PORTS,
  SPOTIFY_REDIRECT_PATH,
  SPOTIFY_AUTH_URL,
  SPOTIFY_TOKEN_URL,
  SPOTIFY_API_BASE,
  buildRedirectUri
} from './config'

describe('spotify/config — Wave 0 constants', () => {
  it('SPOTIFY_CLIENT_ID is a non-empty base62 string 10-64 chars long', () => {
    expect(typeof SPOTIFY_CLIENT_ID).toBe('string')
    expect(SPOTIFY_CLIENT_ID.length).toBeGreaterThanOrEqual(10)
    expect(SPOTIFY_CLIENT_ID).toMatch(/^[A-Za-z0-9]{10,64}$/)
    // Placeholder guard — catches accidental commit of the original template.
    expect(SPOTIFY_CLIENT_ID).not.toMatch(/^<.*>$/)
    expect(SPOTIFY_CLIENT_ID).not.toContain('PASTE')
  })

  it('SPOTIFY_SCOPES is exactly the three D-30 scopes', () => {
    expect(SPOTIFY_SCOPES).toEqual([
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-modify-playback-state'
    ])
  })

  it('SPOTIFY_REDIRECT_PATH is exactly "/callback" with no port or wildcard', () => {
    expect(SPOTIFY_REDIRECT_PATH).toBe('/callback')
    expect(SPOTIFY_REDIRECT_PATH).not.toContain(':')
    expect(SPOTIFY_REDIRECT_PATH).not.toContain('*')
  })

  it('SPOTIFY_REDIRECT_PORTS is a non-empty readonly array of positive integers', () => {
    expect(Array.isArray(SPOTIFY_REDIRECT_PORTS)).toBe(true)
    expect(SPOTIFY_REDIRECT_PORTS.length).toBeGreaterThan(0)
    for (const port of SPOTIFY_REDIRECT_PORTS) {
      expect(Number.isInteger(port)).toBe(true)
      expect(port).toBeGreaterThan(0)
      expect(port).toBeLessThan(65536)
    }
  })

  it('SPOTIFY_REDIRECT_PORTS contains the dashboard-registered ports', () => {
    // These MUST match what the owner registered in the Spotify dashboard.
    // Editing this list without editing the dashboard breaks OAuth.
    expect(SPOTIFY_REDIRECT_PORTS).toContain(53682)
    expect(SPOTIFY_REDIRECT_PORTS).toContain(53681)
    expect(SPOTIFY_REDIRECT_PORTS).toContain(53683)
  })

  it('buildRedirectUri(53682) returns http://127.0.0.1:53682/callback exactly', () => {
    expect(buildRedirectUri(53682)).toBe('http://127.0.0.1:53682/callback')
  })

  it('buildRedirectUri produces a valid loopback URI for every registered port', () => {
    for (const port of SPOTIFY_REDIRECT_PORTS) {
      const uri = buildRedirectUri(port)
      expect(uri).toBe(`http://127.0.0.1:${port}/callback`)
      // Parse with URL to assert it's actually a valid URL.
      const parsed = new URL(uri)
      expect(parsed.protocol).toBe('http:')
      expect(parsed.hostname).toBe('127.0.0.1')
      expect(parsed.port).toBe(String(port))
      expect(parsed.pathname).toBe('/callback')
    }
  })

  it('buildRedirectUri never produces http://localhost (rejected by Spotify post-2025-11-27)', () => {
    for (const port of SPOTIFY_REDIRECT_PORTS) {
      expect(buildRedirectUri(port)).not.toContain('localhost')
    }
  })

  it('SPOTIFY_AUTH_URL is the documented authorize endpoint', () => {
    expect(SPOTIFY_AUTH_URL).toBe('https://accounts.spotify.com/authorize')
  })

  it('SPOTIFY_TOKEN_URL is the documented token endpoint', () => {
    expect(SPOTIFY_TOKEN_URL).toBe('https://accounts.spotify.com/api/token')
  })

  it('SPOTIFY_API_BASE is the documented Web API base', () => {
    expect(SPOTIFY_API_BASE).toBe('https://api.spotify.com/v1')
  })
})
