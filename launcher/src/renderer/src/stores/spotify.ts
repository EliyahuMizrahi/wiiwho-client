/**
 * Spotify connection + track state (renderer-side).
 *
 * Main process owns tokens (Plan 04-05); this store mirrors non-secret fields:
 * connection state, display name, current track, premium status, last error.
 *
 * State machine (D-25..D-35):
 *   disconnected        — Connect CTA in sidebar
 *   connecting          — loading spinner; OAuth in flight
 *   connected-idle      — connected but no track playing (D-27)
 *   connected-playing   — track + controls
 *   offline             — last-known track + '(offline)' badge (D-35)
 *
 * Polling cadence (D-34) is owned by main; renderer signals via setVisibility:
 *   - focused:      5s
 *   - backgrounded: 15s
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-25..§D-35
 *         + 04-06-spotify-renderer-ui-PLAN.md
 */
import { create } from 'zustand'

export type SpotifyUIState =
  | 'disconnected'
  | 'connecting'
  | 'connected-idle'
  | 'connected-playing'
  | 'offline'

export interface SpotifyTrack {
  id: string
  name: string
  artists: string[]
  albumArtUrl?: string
  isPlaying: boolean
}

export interface SpotifyState {
  state: SpotifyUIState
  displayName: string | null
  isPremium: 'yes' | 'no' | 'unknown'
  currentTrack: SpotifyTrack | null
  lastError: string | null
  // lifecycle handles — kept in state so teardown can reach them
  _unsubStatus: (() => void) | null
  _onFocus: (() => void) | null
  _onBlur: (() => void) | null
  // actions
  initialize: () => Promise<void>
  teardown: () => void
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
}

/**
 * Raw status payload shape — matches window.wiiwho.spotify.status() response
 * and the onStatusChanged subscription callback. The runtime IPC boundary
 * isn't truly typed (the preload forwards JSON), so every field is treated
 * defensively below.
 */
interface RawStatus {
  connected: boolean
  displayName?: string
  isPremium?: 'yes' | 'no' | 'unknown'
  currentTrack?: SpotifyTrack | null
  offline?: boolean
  premiumRequired?: boolean
}

/**
 * Turn a RawStatus payload into a partial store patch.
 *
 * Priority order:
 *   1. !connected → 'disconnected' (clear everything)
 *   2. offline flag → 'offline' (preserve last-known track + displayName)
 *   3. currentTrack present AND isPlaying → 'connected-playing'
 *   4. otherwise → 'connected-idle'
 */
function reconcile(raw: RawStatus): Partial<SpotifyState> {
  if (!raw.connected) {
    return {
      state: 'disconnected',
      displayName: null,
      currentTrack: null,
      isPremium: 'unknown'
    }
  }
  if (raw.offline) {
    return {
      state: 'offline',
      displayName: raw.displayName ?? null,
      currentTrack: raw.currentTrack ?? null,
      isPremium: raw.isPremium ?? 'unknown'
    }
  }
  const hasPlayingTrack = !!(raw.currentTrack && raw.currentTrack.isPlaying)
  return {
    state: hasPlayingTrack ? 'connected-playing' : 'connected-idle',
    displayName: raw.displayName ?? null,
    currentTrack: raw.currentTrack ?? null,
    isPremium: raw.isPremium ?? 'unknown'
  }
}

export const useSpotifyStore = create<SpotifyState>((set, get) => ({
  state: 'disconnected',
  displayName: null,
  isPremium: 'unknown',
  currentTrack: null,
  lastError: null,
  _unsubStatus: null,
  _onFocus: null,
  _onBlur: null,

  initialize: async () => {
    // Initial status — hydrate from main on first mount.
    try {
      const status = (await window.wiiwho.spotify.status()) as RawStatus
      set(reconcile(status))
    } catch {
      // Leave state at 'disconnected'; main may not be ready yet.
    }

    // Subscribe to push events from main.
    const unsub = window.wiiwho.spotify.onStatusChanged((raw) => {
      const r = raw as RawStatus
      set(reconcile(r))
      if (r.premiumRequired) set({ isPremium: 'no' })
    })

    // Visibility wiring — D-34 polling cadence (5s focused / 15s backgrounded).
    const onFocus = (): void => {
      void window.wiiwho.spotify.setVisibility('focused')
    }
    const onBlur = (): void => {
      void window.wiiwho.spotify.setVisibility('backgrounded')
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    // Seed visibility from current document.visibilityState so main's timer
    // starts at the right cadence even before the first focus/blur event.
    if (typeof document !== 'undefined' && document.visibilityState) {
      const seed = document.visibilityState === 'visible' ? 'focused' : 'backgrounded'
      void window.wiiwho.spotify.setVisibility(seed)
    }

    set({ _unsubStatus: unsub, _onFocus: onFocus, _onBlur: onBlur })
  },

  teardown: () => {
    const { _unsubStatus, _onFocus, _onBlur } = get()
    try {
      _unsubStatus?.()
    } catch {
      // ignore unsubscribe failures — best-effort cleanup
    }
    if (_onFocus) window.removeEventListener('focus', _onFocus)
    if (_onBlur) window.removeEventListener('blur', _onBlur)
    set({ _unsubStatus: null, _onFocus: null, _onBlur: null })
  },

  connect: async () => {
    set({ state: 'connecting', lastError: null })
    try {
      const res = await window.wiiwho.spotify.connect()
      if (!res.ok) {
        set({ state: 'disconnected', lastError: res.error ?? 'Unknown error' })
        return
      }
      const status = (await window.wiiwho.spotify.status()) as RawStatus
      set(reconcile(status))
    } catch (err) {
      set({
        state: 'disconnected',
        lastError: err instanceof Error ? err.message : String(err)
      })
    }
  },

  disconnect: async () => {
    try {
      await window.wiiwho.spotify.disconnect()
    } catch {
      // Main-side disconnect is idempotent; surface UI as disconnected regardless.
    }
    set({
      state: 'disconnected',
      displayName: null,
      currentTrack: null,
      isPremium: 'unknown',
      lastError: null
    })
  },

  play: async () => {
    if (get().isPremium === 'no') return
    const r = await window.wiiwho.spotify.control.play()
    if (r.premiumRequired) {
      set({ isPremium: 'no' })
      return
    }
    const status = (await window.wiiwho.spotify.status()) as RawStatus
    set(reconcile(status))
  },

  pause: async () => {
    if (get().isPremium === 'no') return
    const r = await window.wiiwho.spotify.control.pause()
    if (r.premiumRequired) {
      set({ isPremium: 'no' })
      return
    }
    const status = (await window.wiiwho.spotify.status()) as RawStatus
    set(reconcile(status))
  },

  next: async () => {
    if (get().isPremium === 'no') return
    const r = await window.wiiwho.spotify.control.next()
    if (r.premiumRequired) {
      set({ isPremium: 'no' })
      return
    }
    const status = (await window.wiiwho.spotify.status()) as RawStatus
    set(reconcile(status))
  },

  previous: async () => {
    if (get().isPremium === 'no') return
    const r = await window.wiiwho.spotify.control.previous()
    if (r.premiumRequired) {
      set({ isPremium: 'no' })
      return
    }
    const status = (await window.wiiwho.spotify.status()) as RawStatus
    set(reconcile(status))
  }
}))
