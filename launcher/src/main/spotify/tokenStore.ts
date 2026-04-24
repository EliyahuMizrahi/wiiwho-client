/**
 * Spotify OAuth token persistence (Phase 4 UI-06 / D-32).
 *
 * Parallel to the Phase 2 auth.bin cache — encrypted via Electron safeStorage,
 * never co-mingled with Microsoft tokens, never read by the renderer (IPC
 * surface only). Writes are atomic (temp file + rename) so a mid-write crash
 * can never produce a partially-written cache file.
 *
 * FAIL-CLOSED POSTURE (Pitfall 7):
 *   If `safeStorage.isEncryptionAvailable()` is false (headless Linux /
 *   pre-ready lifecycle / rare Windows DPAPI failure), BOTH read and write
 *   throw. We never silently fall back to plaintext — the caller (singleton
 *   SpotifyManager) is expected to surface a `SAFE_STORAGE_UNAVAILABLE`
 *   error to the renderer and leave the user "disconnected".
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-05-spotify-main-process-PLAN.md
 *   Task 1 behavior.
 * Patterns mirrored: launcher/src/main/auth/safeStorageCache.ts (encrypt +
 *   atomic write).
 */

import { safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { resolveSpotifyTokenPath } from '../paths'

export interface SpotifyTokens {
  version: 1
  /** Spotify opaque access token (Bearer). Expires in ~3600s. */
  accessToken: string
  /** Spotify long-lived refresh token. May be rotated on refresh. */
  refreshToken: string
  /** ISO-8601 timestamp when `accessToken` expires. */
  expiresAt: string
  /** Scopes granted by Spotify at consent time (may differ from requested). */
  scopes: string[]
  /** Cached from GET /v1/me. Optional because connect() writes this post-token-exchange. */
  displayName?: string
  /**
   * Cached product-tier hint. 'unknown' = not yet fetched;
   * 'no' = free (playback control will 403 PREMIUM_REQUIRED);
   * 'yes' = premium (control works).
   */
  isPremium?: 'yes' | 'no' | 'unknown'
}

/**
 * Read and decrypt the spotify.bin cache. Returns `null` when the file does
 * not exist (first-run / post-disconnect). Throws when safeStorage is
 * unavailable — callers treat that as a hard "cannot sign in" condition.
 */
export async function readSpotifyTokens(): Promise<SpotifyTokens | null> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage unavailable — refusing to read Spotify tokens')
  }
  try {
    const enc = await fs.readFile(resolveSpotifyTokenPath())
    const plain = safeStorage.decryptString(enc)
    return JSON.parse(plain) as SpotifyTokens
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

/**
 * Encrypt and atomically write the spotify.bin cache. Throws when
 * safeStorage is unavailable — we never persist tokens in plaintext.
 */
export async function writeSpotifyTokens(tokens: SpotifyTokens): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage unavailable — refusing to write Spotify tokens')
  }
  const filePath = resolveSpotifyTokenPath()
  const enc = safeStorage.encryptString(JSON.stringify(tokens))
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, enc, { mode: 0o600 })
  await fs.rename(tmp, filePath)
}

/**
 * Delete the spotify.bin cache. Idempotent: ENOENT is treated as success,
 * so disconnect() and first-run both call this safely.
 */
export async function clearSpotifyTokens(): Promise<void> {
  try {
    await fs.unlink(resolveSpotifyTokenPath())
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }
}
