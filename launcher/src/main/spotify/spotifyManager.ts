/**
 * Singleton orchestrator for all main-process Spotify state (Plan 04-05 Task 4).
 *
 * Mirrors the Phase 2 AuthManager pattern: a lazy-init singleton that owns
 * everything from PKCE connect → tokens-on-disk → /v1/me cache → background
 * polling of `currently-playing` → IPC push events. The IPC handler module
 * (ipc/spotify.ts) is a thin pass-through to this class's methods.
 *
 * STATE MACHINE:
 *   disconnected → connected (connect())
 *   connected → disconnected (disconnect() | AuthExpiredError on poll)
 *
 * POLLING CADENCE (D-34):
 *   'focused'       → 5 000 ms
 *   'backgrounded'  → 15 000 ms
 *
 * PREMIUM CLASSIFICATION:
 *   On connect() we cache `product` from /v1/me:
 *     - 'premium' → isPremium = 'yes'
 *     - 'free' / 'open' / unknown → isPremium = 'no'
 *   Control endpoints (play/pause/next/previous) short-circuit when
 *   isPremium === 'no' — we don't pay the /api round-trip for a known-403.
 *   If the API disagrees (connect said premium but play returned 403
 *   PREMIUM_REQUIRED), we downgrade isPremium to 'no' and emit a status
 *   event so the renderer shows the "Premium required" badge.
 *
 * EVENT SURFACE:
 *   on('status-changed', listener) — fired on:
 *     - track change (id OR isPlaying differs from prior poll)
 *     - isPremium downgrade
 *     - disconnect transitions
 *   IPC forwards these to the renderer via webContents.send.
 */

import log from 'electron-log/main'
import { startPKCEFlow, refreshAccessToken, type TokensOut } from './oauth'
import {
  getCurrentlyPlaying,
  getCurrentUser,
  play as apiPlay,
  pause as apiPause,
  next as apiNext,
  previous as apiPrevious,
  AuthExpiredError,
  type Track
} from './api'
import {
  readSpotifyTokens,
  writeSpotifyTokens,
  clearSpotifyTokens,
  type SpotifyTokens
} from './tokenStore'

export type Visibility = 'focused' | 'backgrounded'
export type IsPremium = 'yes' | 'no' | 'unknown'

export interface SpotifyStatus {
  connected: boolean
  displayName?: string
  isPremium?: IsPremium
  currentTrack?: Track | null
  premiumRequired?: boolean
}

export interface ConnectResult {
  ok: boolean
  displayName?: string
  error?: string
}

type StatusListener = (status: SpotifyStatus) => void

const POLL_MS_FOCUSED = 5_000
const POLL_MS_BACKGROUNDED = 15_000

export class SpotifyManager {
  private tokens: SpotifyTokens | null = null
  private lastTrackId: string | null = null
  private lastIsPlaying: boolean | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private visibility: Visibility = 'focused'
  private listeners = new Map<string, Array<(payload: unknown) => void>>()

  // ---- Event emitter surface ----------------------------------------------

  on(event: 'status-changed', listener: StatusListener): () => void {
    const bucket = this.listeners.get(event) ?? []
    bucket.push(listener as (payload: unknown) => void)
    this.listeners.set(event, bucket)
    return (): void => {
      const current = this.listeners.get(event)
      if (!current) return
      const idx = current.indexOf(listener as (payload: unknown) => void)
      if (idx >= 0) current.splice(idx, 1)
    }
  }

  private emit(event: 'status-changed', payload: SpotifyStatus): void {
    const bucket = this.listeners.get(event)
    if (!bucket) return
    for (const l of bucket) {
      try {
        l(payload)
      } catch (e) {
        log.warn('[spotify] listener threw', e)
      }
    }
  }

  // ---- Helpers -----------------------------------------------------------

  status(): SpotifyStatus {
    if (!this.tokens) return { connected: false }
    return {
      connected: true,
      displayName: this.tokens.displayName,
      isPremium: this.tokens.isPremium ?? 'unknown',
      currentTrack:
        this.lastTrackId != null && this.lastIsPlaying != null
          ? {
              id: this.lastTrackId,
              // The cached fields are a minimal shape — renderer stores the full Track.
              name: '',
              artists: [],
              isPlaying: this.lastIsPlaying
            }
          : null
    }
  }

  pollIntervalMs(): number {
    return this.visibility === 'focused' ? POLL_MS_FOCUSED : POLL_MS_BACKGROUNDED
  }

  // ---- Lifecycle ---------------------------------------------------------

  /**
   * Rehydrate state from disk on app start. Safe to call before connect() —
   * returns silently when no saved tokens exist.
   */
  async restoreFromDisk(): Promise<void> {
    try {
      const saved = await readSpotifyTokens()
      if (saved) {
        this.tokens = saved
        this.emit('status-changed', this.status())
        // Kick off a first poll + arm the interval so the renderer stops
        // showing "Nothing playing" as soon as we know the live state.
        void this.pollOnce()
        this.startPolling()
      }
    } catch (e) {
      log.info('[spotify] restoreFromDisk failed quietly', e)
    }
  }

  async connect(): Promise<ConnectResult> {
    try {
      const res = await startPKCEFlow()
      // Pull /v1/me to get displayName + product for the isPremium gate.
      const me = await getCurrentUser(res.accessToken)
      const isPremium: IsPremium = me.product === 'premium' ? 'yes' : 'no'
      const tokens: SpotifyTokens = {
        version: 1,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        expiresAt: new Date(Date.now() + res.expiresIn * 1000).toISOString(),
        scopes: res.scopes,
        displayName: me.displayName,
        isPremium
      }
      await writeSpotifyTokens(tokens)
      this.tokens = tokens
      this.emit('status-changed', this.status())
      // Arm polling immediately + nudge a first poll so the renderer populates
      // before the next tick of the interval (D-34 cadence).
      void this.pollOnce()
      this.startPolling()
      return { ok: true, displayName: me.displayName }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      log.warn('[spotify] connect failed:', msg)
      return { ok: false, error: msg }
    }
  }

  async disconnect(): Promise<{ ok: boolean }> {
    this.stopPolling()
    this.tokens = null
    this.lastTrackId = null
    this.lastIsPlaying = null
    try {
      await clearSpotifyTokens()
    } catch (e) {
      log.info('[spotify] clearSpotifyTokens failed quietly', e)
    }
    this.emit('status-changed', { connected: false })
    return { ok: true }
  }

  // ---- Playback controls -------------------------------------------------

  async play(): Promise<{ ok: boolean; premiumRequired?: boolean }> {
    return this.control(apiPlay)
  }
  async pause(): Promise<{ ok: boolean; premiumRequired?: boolean }> {
    return this.control(apiPause)
  }
  async next(): Promise<{ ok: boolean; premiumRequired?: boolean }> {
    return this.control(apiNext)
  }
  async previous(): Promise<{ ok: boolean; premiumRequired?: boolean }> {
    return this.control(apiPrevious)
  }

  private async control(
    fn: (
      token: string,
      onRefresh?: () => Promise<TokensOut>
    ) => Promise<{ premiumRequired: boolean }>
  ): Promise<{ ok: boolean; premiumRequired?: boolean }> {
    if (!this.tokens) return { ok: false }
    if (this.tokens.isPremium === 'no') {
      // Short-circuit — spare the round-trip when we already know it'll 403.
      return { ok: false, premiumRequired: true }
    }
    try {
      const out = await fn(this.tokens.accessToken, this.makeRefreshCallback())
      if (out.premiumRequired) {
        // API disagreed with our cached isPremium — downgrade + persist.
        await this.setIsPremium('no')
        return { ok: false, premiumRequired: true }
      }
      return { ok: true, premiumRequired: false }
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        await this.handleAuthExpired()
        return { ok: false }
      }
      log.warn('[spotify] control call failed', e)
      return { ok: false }
    }
  }

  // ---- Visibility + polling ---------------------------------------------

  setVisibility(v: Visibility): void {
    this.visibility = v
    if (this.pollTimer) {
      this.stopPolling()
      this.startPolling()
    }
  }

  startPolling(): void {
    if (!this.tokens) return
    if (this.pollTimer) return
    const tick = async (): Promise<void> => {
      await this.pollOnce()
    }
    this.pollTimer = setInterval(tick, this.pollIntervalMs())
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** Exposed for tests + for the renderer-requested "nudge" path. */
  async pollOnce(): Promise<void> {
    if (!this.tokens) return
    try {
      const track = await getCurrentlyPlaying(this.tokens.accessToken, this.makeRefreshCallback())
      this.observeTrack(track)
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        await this.handleAuthExpired()
        return
      }
      log.info('[spotify] poll error', e)
    }
  }

  private observeTrack(track: Track | null): void {
    const newId = track?.id ?? null
    const newPlaying = track?.isPlaying ?? null
    if (newId === this.lastTrackId && newPlaying === this.lastIsPlaying) return
    this.lastTrackId = newId
    this.lastIsPlaying = newPlaying
    this.emit('status-changed', {
      connected: true,
      displayName: this.tokens?.displayName,
      isPremium: this.tokens?.isPremium ?? 'unknown',
      currentTrack: track
    })
  }

  // ---- Token refresh + auth-expired flow --------------------------------

  private makeRefreshCallback(): (() => Promise<TokensOut>) | undefined {
    if (!this.tokens) return undefined
    return async (): Promise<TokensOut> => {
      if (!this.tokens) throw new AuthExpiredError()
      const fresh = await refreshAccessToken(this.tokens.refreshToken)
      this.tokens = {
        ...this.tokens,
        accessToken: fresh.accessToken,
        refreshToken: fresh.refreshToken,
        expiresAt: new Date(Date.now() + fresh.expiresIn * 1000).toISOString()
      }
      await writeSpotifyTokens(this.tokens)
      return fresh
    }
  }

  private async handleAuthExpired(): Promise<void> {
    this.stopPolling()
    this.tokens = null
    this.lastTrackId = null
    this.lastIsPlaying = null
    try {
      await clearSpotifyTokens()
    } catch (e) {
      log.info('[spotify] auth-expired clear failed quietly', e)
    }
    this.emit('status-changed', { connected: false })
  }

  private async setIsPremium(v: IsPremium): Promise<void> {
    if (!this.tokens) return
    this.tokens = { ...this.tokens, isPremium: v }
    try {
      await writeSpotifyTokens(this.tokens)
    } catch (e) {
      log.info('[spotify] setIsPremium persist failed quietly', e)
    }
    this.emit('status-changed', this.status())
  }
}

// ---- Singleton access --------------------------------------------------

let instance: SpotifyManager | null = null

export function getSpotifyManager(): SpotifyManager {
  if (!instance) instance = new SpotifyManager()
  return instance
}

// Exposed for tests only — DO NOT import from production code.
export const __test__ = {
  resetSingleton: (): void => {
    instance?.stopPolling()
    instance = null
  }
}
