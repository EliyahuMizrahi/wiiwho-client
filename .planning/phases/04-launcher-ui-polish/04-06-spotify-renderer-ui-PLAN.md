---
phase: 04-launcher-ui-polish
plan: 06
type: execute
wave: 5
depends_on:
  - 04-02
  - 04-03
  - 04-05
files_modified:
  - launcher/src/renderer/src/stores/spotify.ts
  - launcher/src/renderer/src/stores/__tests__/spotify.test.ts
  - launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx
  - launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx
  - launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx
  - launcher/src/renderer/src/components/SettingsPanes/__tests__/SpotifyPane.test.tsx
  - launcher/src/renderer/src/components/Sidebar.tsx
  - launcher/src/renderer/src/components/SettingsModal.tsx
autonomous: true
requirements:
  - UI-06
must_haves:
  truths:
    - "useSpotifyStore has 5 UI states: disconnected, connecting, connected-playing, connected-idle, offline"
    - "Store handles premiumRequired flag — surfaces isPremium: 'yes' | 'no' | 'unknown'"
    - "SpotifyMiniPlayer renders 6 visual states: Connect CTA, Connecting, Playing (track info + controls), Idle (Nothing playing), Offline (last-known + (offline) badge), No-Premium (track visible + controls disabled with tooltip)"
    - "Mini-player control buttons call window.wiiwho.spotify.control.* via store actions"
    - "Context menu (right-click or chevron) offers 'Open Spotify app' + 'Disconnect'"
    - "Album art crossfades on track change via AnimatePresence"
    - "Sidebar spotify-slot is replaced by <SpotifyMiniPlayer /> (was placeholder in Plan 04-02)"
    - "Settings modal Spotify pane shows connected-account name + Disconnect button + connected scopes"
    - "Visibility events (focus / blur on window) call setVisibility('focused'|'backgrounded')"
  artifacts:
    - path: "launcher/src/renderer/src/stores/spotify.ts"
      provides: "Zustand store with connect/disconnect/control actions + status subscription"
      exports: ["useSpotifyStore", "SpotifyState"]
    - path: "launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx"
      provides: "Compact 72-80px sidebar slot with all 6 states"
      exports: ["SpotifyMiniPlayer"]
    - path: "launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx"
      provides: "Settings modal Spotify pane — displays connected state + disconnect"
      exports: ["SpotifyPane"]
  key_links:
    - from: "launcher/src/renderer/src/stores/spotify.ts"
      to: "window.wiiwho.spotify.* IPC surface"
      via: "connect/disconnect/control calls + onStatusChanged subscription"
      pattern: "window\\.wiiwho\\.spotify"
    - from: "launcher/src/renderer/src/components/Sidebar.tsx"
      to: "SpotifyMiniPlayer in the spotify-slot"
      via: "direct render replacing placeholder"
      pattern: "<SpotifyMiniPlayer"
    - from: "launcher/src/renderer/src/components/SettingsModal.tsx"
      to: "SpotifyPane on openPane === 'spotify'"
      via: "direct render replacing stub"
      pattern: "<SpotifyPane"
---

<objective>
Build the Phase 4 renderer-side Spotify UI: Zustand store managing connection/track/premium state + SpotifyMiniPlayer with all 6 visual states (Connect CTA / Connecting / Playing / Idle / Offline / No-Premium) + context menu (Open Spotify app + Disconnect) + album-art crossfade via AnimatePresence + Settings modal Spotify pane. Slot SpotifyMiniPlayer into the Sidebar (replacing Plan 04-02's placeholder) and wire SpotifyPane into SettingsModal (replacing Plan 04-03's stub). Wire window focus/blur to setVisibility for polling cadence (D-34: 5s focused / 15s backgrounded).

Purpose: Complete UI-06 end-to-end. After this plan, a user with the owner's Spotify client ID can click Connect → OAuth → see their current track live in the mini-player + control playback.

Output: spotify store + mini-player + settings pane + sidebar/modal integration + tests for all 6 states + premiumRequired path.
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@launcher/src/renderer/src/stores/auth.ts
@launcher/src/renderer/src/stores/game.ts
@launcher/src/renderer/src/components/Sidebar.tsx
@launcher/src/renderer/src/components/SettingsModal.tsx
@launcher/src/renderer/src/wiiwho.d.ts
@.planning/phases/04-launcher-ui-polish/04-02-sidebar-and-main-area-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-03-settings-modal-chrome-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-05-spotify-main-process-SUMMARY.md
</context>

<interfaces>
<!-- Extracted — what this plan consumes -->

From launcher/src/renderer/src/wiiwho.d.ts (Plan 04-05 extension):
```typescript
spotify: {
  connect: () => Promise<{ ok: boolean; displayName?: string; error?: string }>
  disconnect: () => Promise<{ ok: boolean }>
  status: () => Promise<{ connected, displayName?, isPremium?, currentTrack? }>
  control: { play, pause, next, previous } — each returns { ok, premiumRequired? }
  setVisibility: (v: 'focused' | 'backgrounded') => Promise<{ ok: boolean }>
  onStatusChanged: (cb) => Unsubscribe
}
```

From Plan 04-02 Sidebar:
```typescript
// spotify-slot is currently a div with data-testid="spotify-slot"
// Replace content with <SpotifyMiniPlayer />
```

From Plan 04-03 SettingsModal:
```typescript
// {openPane === 'spotify' && <div data-testid="spotify-pane-stub">...</div>}
// Replace with <SpotifyPane />
```

From motion/react + Plan 04-01:
```typescript
import { motion, AnimatePresence } from 'motion/react'
import { useMotionConfig } from '../hooks/useMotionConfig'
```

From Phase 2/3 Zustand pattern — useAuthStore shape as reference.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useSpotifyStore — state machine + connect/disconnect/control + visibility wiring</name>
  <files>launcher/src/renderer/src/stores/spotify.ts, launcher/src/renderer/src/stores/__tests__/spotify.test.ts</files>
  <read_first>
    - launcher/src/renderer/src/stores/auth.ts (5-state discriminated union pattern — copy shape)
    - launcher/src/renderer/src/stores/game.ts (subscription lifecycle pattern)
    - launcher/src/renderer/src/wiiwho.d.ts (post-Plan-04-05 typed spotify surface)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-25..§D-35 (UI state spec + polling)
  </read_first>
  <behavior>
    - State shape: `state: 'disconnected' | 'connecting' | 'connected-playing' | 'connected-idle' | 'offline'`
    - `isPremium: 'yes' | 'no' | 'unknown'`
    - `currentTrack: { id, name, artists[], albumArtUrl?, isPlaying } | null`
    - `displayName: string | null`
    - `lastError: string | null`
    - Actions:
      - connect(): sets state='connecting' → calls spotify.connect → on ok: refreshes status + starts subscription → state='connected-idle' or 'connected-playing'; on error → state='disconnected' + lastError
      - disconnect(): calls spotify.disconnect → state='disconnected', clears track/displayName/isPremium='unknown'
      - play() / pause() / next() / previous() → calls control; if result.premiumRequired → sets isPremium='no'; else refreshes status
      - initialize(): reads current status on App mount → state from ipc; subscribes to onStatusChanged; sets up visibility listeners (focus/blur on window) to call setVisibility
      - teardown(): unsubscribes + removes visibility listeners
    - On status-changed event (from main): reconciles state / track / isPremium / offline flag
    - Tests cover: all 5 states reachable; premiumRequired flips isPremium; disconnect clears; visibility listener wires focus/blur
  </behavior>
  <action>
    1. Replace Wave 0 stub `launcher/src/renderer/src/stores/__tests__/spotify.test.ts` with real tests:

    ```typescript
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
    import { cleanup } from '@testing-library/react'
    import { useSpotifyStore } from '../spotify'

    const spotifyIpcMock = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      status: vi.fn(),
      control: { play: vi.fn(), pause: vi.fn(), next: vi.fn(), previous: vi.fn() },
      setVisibility: vi.fn().mockResolvedValue({ ok: true }),
      onStatusChanged: vi.fn().mockReturnValue(() => {}),
    }

    beforeEach(() => {
      ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
        auth: {}, game: {}, logs: {}, settings: {}, __debug: {}, spotify: spotifyIpcMock,
      }
      useSpotifyStore.setState({
        state: 'disconnected',
        isPremium: 'unknown',
        currentTrack: null,
        displayName: null,
        lastError: null,
      } as never)
      vi.clearAllMocks()
    })
    afterEach(cleanup)

    describe('useSpotifyStore — connect flow', () => {
      it('default state is "disconnected" + isPremium="unknown"', () => {
        expect(useSpotifyStore.getState().state).toBe('disconnected')
        expect(useSpotifyStore.getState().isPremium).toBe('unknown')
      })

      it('connect() transitions disconnected → connecting → connected-idle on success (no track)', async () => {
        spotifyIpcMock.connect.mockResolvedValue({ ok: true, displayName: 'Owner' })
        spotifyIpcMock.status.mockResolvedValue({ connected: true, displayName: 'Owner', isPremium: 'yes', currentTrack: null })
        const p = useSpotifyStore.getState().connect()
        expect(useSpotifyStore.getState().state).toBe('connecting')
        await p
        expect(useSpotifyStore.getState().state).toBe('connected-idle')
        expect(useSpotifyStore.getState().displayName).toBe('Owner')
        expect(useSpotifyStore.getState().isPremium).toBe('yes')
      })

      it('connect() transitions to connected-playing when currentTrack present', async () => {
        spotifyIpcMock.connect.mockResolvedValue({ ok: true, displayName: 'Owner' })
        spotifyIpcMock.status.mockResolvedValue({ connected: true, displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true } })
        await useSpotifyStore.getState().connect()
        expect(useSpotifyStore.getState().state).toBe('connected-playing')
        expect(useSpotifyStore.getState().currentTrack?.id).toBe('t1')
      })

      it('connect() failure → state=disconnected + lastError set', async () => {
        spotifyIpcMock.connect.mockResolvedValue({ ok: false, error: 'CSRF mismatch' })
        await useSpotifyStore.getState().connect()
        expect(useSpotifyStore.getState().state).toBe('disconnected')
        expect(useSpotifyStore.getState().lastError).toMatch(/CSRF/)
      })
    })

    describe('useSpotifyStore — disconnect flow', () => {
      it('disconnect() clears track + displayName + isPremium=unknown', async () => {
        useSpotifyStore.setState({ state: 'connected-playing', displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true } } as never)
        spotifyIpcMock.disconnect.mockResolvedValue({ ok: true })
        await useSpotifyStore.getState().disconnect()
        expect(useSpotifyStore.getState().state).toBe('disconnected')
        expect(useSpotifyStore.getState().currentTrack).toBeNull()
        expect(useSpotifyStore.getState().displayName).toBeNull()
        expect(useSpotifyStore.getState().isPremium).toBe('unknown')
      })
    })

    describe('useSpotifyStore — control actions + premiumRequired', () => {
      beforeEach(() => {
        useSpotifyStore.setState({ state: 'connected-playing', displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true } } as never)
      })

      it('play() calls window.wiiwho.spotify.control.play', async () => {
        spotifyIpcMock.control.play.mockResolvedValue({ ok: true })
        spotifyIpcMock.status.mockResolvedValue({ connected: true, displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true } })
        await useSpotifyStore.getState().play()
        expect(spotifyIpcMock.control.play).toHaveBeenCalledTimes(1)
      })

      it('play() returning premiumRequired sets isPremium="no"', async () => {
        spotifyIpcMock.control.play.mockResolvedValue({ ok: false, premiumRequired: true })
        await useSpotifyStore.getState().play()
        expect(useSpotifyStore.getState().isPremium).toBe('no')
      })

      it('next() calls window.wiiwho.spotify.control.next', async () => {
        spotifyIpcMock.control.next.mockResolvedValue({ ok: true })
        spotifyIpcMock.status.mockResolvedValue({ connected: true, displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't2', name: 'Next', artists: ['A'], isPlaying: true } })
        await useSpotifyStore.getState().next()
        expect(spotifyIpcMock.control.next).toHaveBeenCalledTimes(1)
      })

      it('premium-required for any control short-circuits subsequent controls (returns early)', async () => {
        spotifyIpcMock.control.play.mockResolvedValue({ ok: false, premiumRequired: true })
        await useSpotifyStore.getState().play()
        spotifyIpcMock.control.pause.mockClear()
        await useSpotifyStore.getState().pause()
        expect(spotifyIpcMock.control.pause).not.toHaveBeenCalled()  // short-circuited
      })
    })

    describe('useSpotifyStore — initialize + visibility wiring', () => {
      it('initialize() subscribes to onStatusChanged', async () => {
        spotifyIpcMock.status.mockResolvedValue({ connected: false })
        await useSpotifyStore.getState().initialize()
        expect(spotifyIpcMock.onStatusChanged).toHaveBeenCalledTimes(1)
      })

      it('window focus event calls setVisibility("focused")', async () => {
        spotifyIpcMock.status.mockResolvedValue({ connected: false })
        await useSpotifyStore.getState().initialize()
        window.dispatchEvent(new Event('focus'))
        expect(spotifyIpcMock.setVisibility).toHaveBeenCalledWith('focused')
      })

      it('window blur event calls setVisibility("backgrounded")', async () => {
        spotifyIpcMock.status.mockResolvedValue({ connected: false })
        await useSpotifyStore.getState().initialize()
        window.dispatchEvent(new Event('blur'))
        expect(spotifyIpcMock.setVisibility).toHaveBeenCalledWith('backgrounded')
      })

      it('teardown() unsubscribes and removes listeners', async () => {
        const unsub = vi.fn()
        spotifyIpcMock.onStatusChanged.mockReturnValue(unsub)
        spotifyIpcMock.status.mockResolvedValue({ connected: false })
        await useSpotifyStore.getState().initialize()
        useSpotifyStore.getState().teardown()
        expect(unsub).toHaveBeenCalled()
      })

      it('status-changed push with offline=true transitions to "offline" state', async () => {
        spotifyIpcMock.status.mockResolvedValue({ connected: true, displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true } })
        let cb: (s: unknown) => void = () => {}
        spotifyIpcMock.onStatusChanged.mockImplementation((fn: (s: unknown) => void) => { cb = fn; return () => {} })
        await useSpotifyStore.getState().initialize()
        // simulate an offline push from main
        cb({ connected: true, displayName: 'Owner', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: false }, offline: true })
        expect(useSpotifyStore.getState().state).toBe('offline')
      })
    })
    ```

    2. Create `launcher/src/renderer/src/stores/spotify.ts`:

    ```typescript
    /**
     * Spotify connection + track state (renderer-side).
     *
     * Main process owns tokens (Plan 04-05); this store mirrors non-secret fields:
     * connection state, display name, current track, premium status, last error.
     *
     * Polling cadence (D-34):
     *   - focused:      5s (main owns timer)
     *   - backgrounded: 15s
     * We notify main via setVisibility on window focus/blur.
     *
     * State machine (D-25..D-35):
     *   disconnected        — Connect CTA in sidebar
     *   connecting          — loading spinner; OAuth in flight
     *   connected-idle      — connected but no track playing (D-27)
     *   connected-playing   — track + controls
     *   offline             — last-known track + '(offline)' badge (D-35)
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
      // lifecycle handles
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

    interface RawStatus {
      connected: boolean
      displayName?: string
      isPremium?: 'yes' | 'no' | 'unknown'
      currentTrack?: SpotifyTrack | null
      offline?: boolean
      premiumRequired?: boolean
    }

    function reconcile(raw: RawStatus): Partial<SpotifyState> {
      if (!raw.connected) {
        return { state: 'disconnected', displayName: null, currentTrack: null, isPremium: 'unknown' }
      }
      if (raw.offline) {
        return { state: 'offline', displayName: raw.displayName ?? null, currentTrack: raw.currentTrack ?? null, isPremium: raw.isPremium ?? 'unknown' }
      }
      const hasTrack = raw.currentTrack && raw.currentTrack.isPlaying
      return {
        state: hasTrack ? 'connected-playing' : 'connected-idle',
        displayName: raw.displayName ?? null,
        currentTrack: raw.currentTrack ?? null,
        isPremium: raw.isPremium ?? 'unknown',
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
        // Initial status
        const status = (await window.wiiwho.spotify.status()) as RawStatus
        set(reconcile(status))

        // Subscribe to push events from main
        const unsub = window.wiiwho.spotify.onStatusChanged((raw) => {
          const r = raw as RawStatus
          set(reconcile(r))
          if (r.premiumRequired) set({ isPremium: 'no' })
        })

        // Visibility wiring — D-34 polling cadence
        const onFocus = (): void => { void window.wiiwho.spotify.setVisibility('focused') }
        const onBlur = (): void => { void window.wiiwho.spotify.setVisibility('backgrounded') }
        window.addEventListener('focus', onFocus)
        window.addEventListener('blur', onBlur)

        set({ _unsubStatus: unsub, _onFocus: onFocus, _onBlur: onBlur })
      },

      teardown: () => {
        const { _unsubStatus, _onFocus, _onBlur } = get()
        _unsubStatus?.()
        if (_onFocus) window.removeEventListener('focus', _onFocus)
        if (_onBlur) window.removeEventListener('blur', _onBlur)
        set({ _unsubStatus: null, _onFocus: null, _onBlur: null })
      },

      connect: async () => {
        set({ state: 'connecting', lastError: null })
        const res = await window.wiiwho.spotify.connect()
        if (!res.ok) {
          set({ state: 'disconnected', lastError: res.error ?? 'Unknown error' })
          return
        }
        const status = (await window.wiiwho.spotify.status()) as RawStatus
        set(reconcile(status))
      },

      disconnect: async () => {
        await window.wiiwho.spotify.disconnect()
        set({ state: 'disconnected', displayName: null, currentTrack: null, isPremium: 'unknown', lastError: null })
      },

      play: async () => {
        if (get().isPremium === 'no') return
        const r = await window.wiiwho.spotify.control.play()
        if (r.premiumRequired) { set({ isPremium: 'no' }); return }
        const status = (await window.wiiwho.spotify.status()) as RawStatus
        set(reconcile(status))
      },

      pause: async () => {
        if (get().isPremium === 'no') return
        const r = await window.wiiwho.spotify.control.pause()
        if (r.premiumRequired) { set({ isPremium: 'no' }); return }
        const status = (await window.wiiwho.spotify.status()) as RawStatus
        set(reconcile(status))
      },

      next: async () => {
        if (get().isPremium === 'no') return
        const r = await window.wiiwho.spotify.control.next()
        if (r.premiumRequired) { set({ isPremium: 'no' }); return }
        const status = (await window.wiiwho.spotify.status()) as RawStatus
        set(reconcile(status))
      },

      previous: async () => {
        if (get().isPremium === 'no') return
        const r = await window.wiiwho.spotify.control.previous()
        if (r.premiumRequired) { set({ isPremium: 'no' }); return }
        const status = (await window.wiiwho.spotify.status()) as RawStatus
        set(reconcile(status))
      },
    }))
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/stores/__tests__/spotify.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/stores/spotify.ts` exports `useSpotifyStore`, `SpotifyState`, `SpotifyUIState`, `SpotifyTrack`.
    - `grep "window.wiiwho.spotify" launcher/src/renderer/src/stores/spotify.ts` returns ≥10 hits (all action + subscription paths).
    - `grep "'connecting'" launcher/src/renderer/src/stores/spotify.ts` returns ≥1 hit.
    - `grep "'connected-playing'" launcher/src/renderer/src/stores/spotify.ts` returns ≥1 hit.
    - `grep "'offline'" launcher/src/renderer/src/stores/spotify.ts` returns ≥1 hit.
    - `grep "setVisibility" launcher/src/renderer/src/stores/spotify.ts` returns ≥2 hits (focus + blur).
    - All 14 store tests pass.
  </acceptance_criteria>
  <done>Spotify store delivers 5-state machine + controls + isPremium flag + visibility wiring; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SpotifyMiniPlayer — 6 visual states + album-art crossfade + context menu</name>
  <files>launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx, launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-25, §D-26, §D-27, §D-28, §D-33, §D-35 (mini-player states + controls + context menu)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack → §Pattern D (album art crossfade via AnimatePresence key=albumArtUrl)
    - launcher/src/renderer/src/stores/spotify.ts (state + actions)
    - launcher/src/renderer/src/components/ui/ (any existing context-menu or dropdown-menu primitives to reuse)
  </read_first>
  <behavior>
    - Compact block (~72-80px tall, fills sidebar width). Visual states:
      1. **disconnected** — Spotify logo + text-button "Connect Spotify". Click calls store.connect().
      2. **connecting** — Spinner + "Connecting…" text.
      3. **connected-idle** — Small album-art placeholder + "Nothing playing" label + disabled play button. D-27.
      4. **connected-playing** — 48px album art + track title + artists + play/pause toggle (based on isPlaying) + prev/next buttons. D-28 controls only (no volume/seek/shuffle).
      5. **offline** — same as playing/idle but with "(offline)" suffix next to track title. D-35.
      6. **no-premium (overlay)** — control buttons disabled + title attr / aria-disabled with tooltip text "Spotify Premium required for controls" — read-only mini-player still shows track. Layered on top of connected-playing/idle.
    - Album art is an <img> wrapped in AnimatePresence keyed by src; crossfade on change
    - Controls: play/pause icon switches based on isPlaying; click calls store.play()/pause()
    - Right-click (onContextMenu) OR a small chevron button opens a menu with "Open Spotify app" (calls window.wiiwho — or shell URL via main? simpler: main can expose openSpotifyApp; for v0.1 we use a dev-mode noop OR shell.openExternal via a new IPC channel — UNLESS existing logs.openCrashFolder pattern has a general "openExternal" — it doesn't. Simplest: add a spotify:open-app channel in a small extension, OR call `window.open('spotify://', '_blank')` which in Electron can trigger OS-level spotify URL handler via shell.openExternal behavior — window.open in renderer with electron's new-window handler normally routes to openExternal. For v0.1 we do: `<a href="spotify://">Open Spotify app</a>` which the OS's URL scheme handler takes — Electron with sandbox+contextIsolation permits native URL schemes via the system.
    
    Decision: use simple `<a href="spotify://" target="_blank" rel="noopener noreferrer">` for "Open Spotify app" — no new IPC needed.
    - Tests cover all 6 states + album-art key change + context menu rendering
  </behavior>
  <action>
    1. Replace Wave 0 test stub `launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx` with real tests. Mock motion/react to render plain divs, mock wiiwho.spotify.

    2. Create `launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` rendering one of the 6 states based on store.state + isPremium.

    Key JSX patterns:

    ```tsx
    // disconnected
    return (
      <div data-testid="spotify-mini-disconnected" className="h-20 px-3 flex items-center gap-2">
        <SpotifyLogoIcon />
        <button onClick={() => void connect()} className="text-sm underline">Connect Spotify</button>
      </div>
    )

    // connected-playing (most complex):
    return (
      <div data-testid="spotify-mini-playing" className="h-20 px-2 flex items-center gap-2">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={currentTrack.albumArtUrl ?? 'placeholder'}
            src={currentTrack.albumArtUrl}
            alt=""
            width={48}
            height={48}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="size-12 rounded bg-neutral-800"
          />
        </AnimatePresence>
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate">{currentTrack.name}{offline ? ' (offline)' : ''}</div>
          <div className="text-xs text-neutral-500 truncate">{currentTrack.artists.join(', ')}</div>
        </div>
        <div className="flex items-center gap-0.5">
          <ControlButton onClick={prev} disabled={isPremium==='no'} title={isPremium==='no' ? 'Spotify Premium required for controls' : 'Previous'} aria-label="Previous" icon={<SkipBack />} />
          <ControlButton onClick={currentTrack.isPlaying ? pause : play} disabled={isPremium==='no'} title={...} aria-label={currentTrack.isPlaying ? 'Pause' : 'Play'} icon={currentTrack.isPlaying ? <PauseIcon/> : <PlayIcon/>} />
          <ControlButton onClick={next} disabled={isPremium==='no'} title={...} aria-label="Next" icon={<SkipForward />} />
        </div>
        {/* Context menu — right-click or chevron */}
        <ContextMenu items={[{ label: 'Open Spotify app', href: 'spotify://' }, { label: 'Disconnect', onClick: disconnect }]} />
      </div>
    )
    ```

    Tests (replace Wave 0 stub):

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { SpotifyMiniPlayer } from '../SpotifyMiniPlayer'
    import { useSpotifyStore } from '../../stores/spotify'

    Element.prototype.hasPointerCapture = (() => false) as never
    Element.prototype.releasePointerCapture = (() => {}) as never
    Element.prototype.scrollIntoView = (() => {}) as never

    // Mock motion/react to passthrough.
    vi.mock('motion/react', () => ({
      motion: new Proxy({}, { get: () => (p: Record<string, unknown>) => {
        const { initial, animate, exit, transition, layoutId, ...rest } = p as Record<string, unknown>
        return React.createElement('div', rest as never)
      } }),
      AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    }))
    import React from 'react'

    const connectMock = vi.fn().mockResolvedValue(undefined)
    const disconnectMock = vi.fn().mockResolvedValue(undefined)
    const playMock = vi.fn().mockResolvedValue(undefined)
    const pauseMock = vi.fn().mockResolvedValue(undefined)
    const nextMock = vi.fn().mockResolvedValue(undefined)
    const previousMock = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      useSpotifyStore.setState({
        state: 'disconnected',
        displayName: null,
        isPremium: 'unknown',
        currentTrack: null,
        lastError: null,
        connect: connectMock,
        disconnect: disconnectMock,
        play: playMock, pause: pauseMock, next: nextMock, previous: previousMock,
      } as never)
    })
    afterEach(() => { cleanup(); vi.clearAllMocks() })

    describe('SpotifyMiniPlayer — state: disconnected', () => {
      it('renders "Connect Spotify" button', () => {
        render(<SpotifyMiniPlayer />)
        expect(screen.getByRole('button', { name: /connect spotify/i })).toBeDefined()
      })

      it('clicking Connect calls store.connect()', async () => {
        const user = userEvent.setup()
        render(<SpotifyMiniPlayer />)
        await user.click(screen.getByRole('button', { name: /connect spotify/i }))
        expect(connectMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('SpotifyMiniPlayer — state: connecting', () => {
      it('renders "Connecting..." text', () => {
        useSpotifyStore.setState({ state: 'connecting' } as never)
        render(<SpotifyMiniPlayer />)
        expect(screen.getByText(/connecting/i)).toBeDefined()
      })
    })

    describe('SpotifyMiniPlayer — state: connected-idle', () => {
      it('renders "Nothing playing" (D-27)', () => {
        useSpotifyStore.setState({ state: 'connected-idle', displayName: 'Owner', isPremium: 'yes' } as never)
        render(<SpotifyMiniPlayer />)
        expect(screen.getByText(/nothing playing/i)).toBeDefined()
      })
    })

    describe('SpotifyMiniPlayer — state: connected-playing', () => {
      beforeEach(() => {
        useSpotifyStore.setState({
          state: 'connected-playing',
          displayName: 'Owner',
          isPremium: 'yes',
          currentTrack: { id: 't1', name: 'Song Title', artists: ['Artist A', 'Artist B'], albumArtUrl: 'https://a.com/art.jpg', isPlaying: true },
        } as never)
      })

      it('renders track name and artist', () => {
        render(<SpotifyMiniPlayer />)
        expect(screen.getByText('Song Title')).toBeDefined()
        expect(screen.getByText(/Artist A, Artist B/)).toBeDefined()
      })

      it('renders album art img with the track URL', () => {
        const { container } = render(<SpotifyMiniPlayer />)
        expect((container.querySelector('img') as HTMLImageElement | null)?.src).toMatch(/a\.com\/art\.jpg$/)
      })

      it('renders play/pause/prev/next buttons enabled when isPremium="yes"', () => {
        render(<SpotifyMiniPlayer />)
        expect(screen.getByRole('button', { name: /pause/i })).not.toBeDisabled()
        expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
        expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled()
      })

      it('clicking Pause calls store.pause()', async () => {
        const user = userEvent.setup()
        render(<SpotifyMiniPlayer />)
        await user.click(screen.getByRole('button', { name: /pause/i }))
        expect(pauseMock).toHaveBeenCalledTimes(1)
      })

      it('clicking Next calls store.next()', async () => {
        const user = userEvent.setup()
        render(<SpotifyMiniPlayer />)
        await user.click(screen.getByRole('button', { name: /next/i }))
        expect(nextMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('SpotifyMiniPlayer — state: offline', () => {
      it('shows "(offline)" suffix next to track title (D-35)', () => {
        useSpotifyStore.setState({
          state: 'offline',
          displayName: 'Owner',
          isPremium: 'yes',
          currentTrack: { id: 't1', name: 'Song Title', artists: ['A'], isPlaying: false },
        } as never)
        render(<SpotifyMiniPlayer />)
        expect(screen.getByText(/Song Title.*\(offline\)/i)).toBeDefined()
      })
    })

    describe('SpotifyMiniPlayer — no-premium overlay (UI-06 RESEARCH-added)', () => {
      it('controls disabled + tooltip "Spotify Premium required" when isPremium="no"', () => {
        useSpotifyStore.setState({
          state: 'connected-playing',
          displayName: 'Owner',
          isPremium: 'no',
          currentTrack: { id: 't1', name: 'Song', artists: ['A'], isPlaying: false },
        } as never)
        render(<SpotifyMiniPlayer />)
        expect(screen.getByRole('button', { name: /play/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /play/i }).getAttribute('title')).toMatch(/premium required/i)
        // Track display still visible — read-only works on Free
        expect(screen.getByText('Song')).toBeDefined()
      })
    })

    describe('SpotifyMiniPlayer — context menu (D-33)', () => {
      it('renders "Open Spotify app" link with href spotify://', () => {
        useSpotifyStore.setState({ state: 'connected-playing', displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true } } as never)
        render(<SpotifyMiniPlayer />)
        // Trigger context menu (chevron button or hover-reveal)
        const user = userEvent.setup()
        // click the chevron trigger
        // ... depending on implementation, may require user.click(screen.getByRole('button', { name: /more options|menu/i }))
        const link = screen.getByRole('link', { name: /open spotify app/i })
        expect(link.getAttribute('href')).toBe('spotify://')
        expect(link.getAttribute('rel')).toContain('noopener')
      })

      it('renders "Disconnect" menu item that calls store.disconnect()', async () => {
        useSpotifyStore.setState({ state: 'connected-playing', displayName: 'Owner', isPremium: 'yes', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true } } as never)
        const user = userEvent.setup()
        render(<SpotifyMiniPlayer />)
        await user.click(screen.getByRole('button', { name: /disconnect/i }))
        expect(disconnectMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('SpotifyMiniPlayer — anti-bloat (UI-05)', () => {
      it('contains NO ads/news/friends/buy/subscribe strings in any state', () => {
        for (const stateSetup of [
          { state: 'disconnected', currentTrack: null, isPremium: 'unknown' },
          { state: 'connected-playing', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }, isPremium: 'yes' },
          { state: 'offline', currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: false }, isPremium: 'yes' },
        ] as const) {
          useSpotifyStore.setState(stateSetup as never)
          const { container, unmount } = render(<SpotifyMiniPlayer />)
          const text = container.textContent?.toLowerCase() ?? ''
          expect(text).not.toMatch(/\b(ad|ads|advertisement|news|friends? online|buy now|subscribe|premium offer)\b/)
          unmount()
        }
      })
    })
    ```

    3. Implement SpotifyMiniPlayer.tsx. Keep it focused — each state is its own render branch to keep the test assertions surgical. Use lucide-react icons (`Play`, `Pause`, `SkipForward`, `SkipBack`, `MoreVertical` for context-menu trigger).

    For the context menu, use the shadcn DropdownMenu already installed (Phase 2 DropdownMenu is imported from `@/components/ui/dropdown-menu`) — simpler than rolling a ContextMenu primitive. "Disconnect" is a button, "Open Spotify app" is a native `<a>` inside the menu item:

    ```tsx
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="More options" ...><MoreVertical /></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <a href="spotify://" target="_blank" rel="noopener noreferrer">Open Spotify app</a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void disconnect()}>Disconnect</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` exports `SpotifyMiniPlayer`.
    - `grep "AnimatePresence" launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` returns ≥1 hit.
    - `grep "motion.img" launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` returns ≥1 hit.
    - `grep "spotify://" launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` returns 1 hit.
    - `grep "Premium required" launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` returns ≥1 hit.
    - `grep "Nothing playing" launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` returns 1 hit.
    - `grep "(offline)" launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` returns ≥1 hit.
    - All 15 test assertions pass across the 7 describes.
  </acceptance_criteria>
  <done>SpotifyMiniPlayer renders all 6 states + crossfade + context menu; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: SpotifyPane (Settings modal) + slot MiniPlayer into Sidebar + replace SpotifyPane stub</name>
  <files>launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx, launcher/src/renderer/src/components/SettingsPanes/__tests__/SpotifyPane.test.tsx, launcher/src/renderer/src/components/Sidebar.tsx, launcher/src/renderer/src/components/SettingsModal.tsx</files>
  <read_first>
    - launcher/src/renderer/src/components/Sidebar.tsx (currently has `<div data-testid="spotify-slot">Spotify</div>` placeholder)
    - launcher/src/renderer/src/components/SettingsModal.tsx (currently renders `<div data-testid="spotify-pane-stub">...</div>`)
    - launcher/src/renderer/src/stores/spotify.ts (state + actions — Task 1)
    - launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx (existing tests — must continue to pass after slot change)
  </read_first>
  <behavior>
    - SpotifyPane renders:
      - Heading "Spotify"
      - When disconnected: Connect button (large, accent-colored) + explanatory text "Connect your Spotify account to see your current track in the sidebar. Read-only for Free users; playback controls require Spotify Premium."
      - When connected: display name + connected scopes list + Disconnect button (no confirm dialog per Phase 2 D-15 parity)
    - Sidebar: replace `<div data-testid="spotify-slot" ...>Spotify</div>` with `<div data-testid="spotify-slot"><SpotifyMiniPlayer /></div>` — keep the data-testid wrapper so Plan 04-02 Sidebar tests still pass
    - SettingsModal: replace `<div data-testid="spotify-pane-stub">...</div>` with `<SpotifyPane />`
    - Update Sidebar test IF it asserted specific text "Spotify" in the slot (Plan 04-02 test asserts `getByTestId('spotify-slot')` is defined — that still works)
  </behavior>
  <action>
    1. Create `launcher/src/renderer/src/components/SettingsPanes/__tests__/SpotifyPane.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { SpotifyPane } from '../SpotifyPane'
    import { useSpotifyStore } from '../../../stores/spotify'

    const connectMock = vi.fn().mockResolvedValue(undefined)
    const disconnectMock = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      useSpotifyStore.setState({
        state: 'disconnected',
        displayName: null,
        isPremium: 'unknown',
        currentTrack: null,
        lastError: null,
        connect: connectMock,
        disconnect: disconnectMock,
      } as never)
      vi.clearAllMocks()
    })
    afterEach(cleanup)

    describe('SpotifyPane', () => {
      it('renders heading "Spotify"', () => {
        render(<SpotifyPane />)
        expect(screen.getByRole('heading', { name: 'Spotify' })).toBeDefined()
      })

      it('disconnected state shows Connect button and explanatory text', () => {
        render(<SpotifyPane />)
        expect(screen.getByRole('button', { name: /connect spotify/i })).toBeDefined()
        expect(screen.getByText(/read-only.*premium/i)).toBeDefined()
      })

      it('clicking Connect calls store.connect()', async () => {
        const user = userEvent.setup()
        render(<SpotifyPane />)
        await user.click(screen.getByRole('button', { name: /connect spotify/i }))
        expect(connectMock).toHaveBeenCalledTimes(1)
      })

      it('connected state shows display name + Disconnect button', () => {
        useSpotifyStore.setState({ state: 'connected-idle', displayName: 'Owner', isPremium: 'yes' } as never)
        render(<SpotifyPane />)
        expect(screen.getByText('Owner')).toBeDefined()
        expect(screen.getByRole('button', { name: /disconnect/i })).toBeDefined()
      })

      it('clicking Disconnect calls store.disconnect() (no confirm dialog)', async () => {
        useSpotifyStore.setState({ state: 'connected-idle', displayName: 'Owner', isPremium: 'yes' } as never)
        const user = userEvent.setup()
        render(<SpotifyPane />)
        await user.click(screen.getByRole('button', { name: /disconnect/i }))
        expect(disconnectMock).toHaveBeenCalledTimes(1)
      })

      it('connected state lists granted scopes', () => {
        useSpotifyStore.setState({ state: 'connected-idle', displayName: 'Owner', isPremium: 'yes' } as never)
        render(<SpotifyPane />)
        expect(screen.getByText(/user-read-currently-playing/i)).toBeDefined()
      })

      it('has data-testid="spotify-pane"', () => {
        render(<SpotifyPane />)
        expect(screen.getByTestId('spotify-pane')).toBeDefined()
      })
    })
    ```

    2. Create `launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx`:

    ```tsx
    /**
     * Settings modal → Spotify pane — D-10 + D-33.
     *
     * Connected view: display name + connected scopes + Disconnect.
     * Disconnected view: Connect button + explanatory text (UI-06 + 403 PREMIUM_REQUIRED note).
     *
     * No confirm dialog on Disconnect (Phase 2 D-15 parity).
     */
    import type React from 'react'
    import { useSpotifyStore } from '../../stores/spotify'

    const DISPLAYED_SCOPES = [
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-modify-playback-state',
    ] as const

    export function SpotifyPane(): React.JSX.Element {
      const state = useSpotifyStore((s) => s.state)
      const displayName = useSpotifyStore((s) => s.displayName)
      const connect = useSpotifyStore((s) => s.connect)
      const disconnect = useSpotifyStore((s) => s.disconnect)

      const isConnected = state !== 'disconnected' && state !== 'connecting'

      return (
        <div data-testid="spotify-pane" className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-neutral-200">Spotify</h2>

          {!isConnected && (
            <>
              <p className="text-sm text-neutral-400 max-w-xl">
                Connect your Spotify account to see your current track in the sidebar.
                Read-only display works on any account; playback controls require Spotify Premium.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={state === 'connecting'}
                  className="px-4 py-2 text-sm rounded font-semibold"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-wiiwho-bg)' }}
                >
                  {state === 'connecting' ? 'Connecting…' : 'Connect Spotify'}
                </button>
              </div>
            </>
          )}

          {isConnected && (
            <>
              <section className="flex flex-col gap-1">
                <div className="text-sm text-neutral-500">Connected as</div>
                <div className="text-lg font-semibold text-neutral-200">{displayName ?? '—'}</div>
              </section>
              <section className="flex flex-col gap-2">
                <div className="text-sm text-neutral-500">Granted scopes</div>
                <ul className="list-disc list-inside text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                  {DISPLAYED_SCOPES.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </section>
              <div>
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Disconnect
                </button>
              </div>
            </>
          )}
        </div>
      )
    }
    ```

    3. Update `launcher/src/renderer/src/components/Sidebar.tsx`:
       - Add import: `import { SpotifyMiniPlayer } from './SpotifyMiniPlayer'`
       - Replace:
         ```
         <div data-testid="spotify-slot" className="h-20 px-3 flex items-center text-xs text-neutral-500">Spotify</div>
         ```
         With:
         ```
         <div data-testid="spotify-slot"><SpotifyMiniPlayer /></div>
         ```
       - Re-run Sidebar tests; Plan 04-02's `getByTestId('spotify-slot')` still passes because we preserved the wrapper div.

    4. Update `launcher/src/renderer/src/components/SettingsModal.tsx`:
       - Add import: `import { SpotifyPane } from './SettingsPanes/SpotifyPane'`
       - Replace:
         ```
         {openPane === 'spotify'    && <div data-testid="spotify-pane-stub" className="text-neutral-500">Spotify (Plan 04-06)</div>}
         ```
         With:
         ```
         {openPane === 'spotify'    && <SpotifyPane />}
         ```
       - Update SettingsModal.test.tsx `getByTestId('spotify-pane-stub')` case → `getByTestId('spotify-pane')`.
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/SettingsPanes/__tests__/SpotifyPane.test.tsx src/renderer/src/components/__tests__/Sidebar.test.tsx src/renderer/src/components/__tests__/SettingsModal.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx` exports `SpotifyPane`.
    - `grep "<SpotifyMiniPlayer" launcher/src/renderer/src/components/Sidebar.tsx` returns 1 hit.
    - `grep "<SpotifyPane" launcher/src/renderer/src/components/SettingsModal.tsx` returns 1 hit.
    - `grep "spotify-pane-stub" launcher/src/renderer/src/components/SettingsModal.tsx` returns 0 hits.
    - All SpotifyPane tests (7) pass.
    - Sidebar tests (unchanged — the slot wrapper still has data-testid) still pass.
    - SettingsModal tests pass (with the updated spotify-pane testid).
  </acceptance_criteria>
  <done>MiniPlayer slotted into Sidebar; SpotifyPane slotted into Modal; tests green.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm --filter ./launcher run test:run` full suite exits 0.
- `pnpm --filter ./launcher run typecheck` exits 0.
- `grep "<SpotifyMiniPlayer" launcher/src/renderer/src/components/Sidebar.tsx` returns 1 hit.
- `grep "<SpotifyPane" launcher/src/renderer/src/components/SettingsModal.tsx` returns 1 hit.
- Manually in dev: click Settings gear → Spotify tab → see Connect button; click Connect → browser opens auth; after completing auth, sidebar mini-player shows Connect transitions to current track or Nothing playing.
</verification>

<success_criteria>
UI-06 end-to-end delivered. All 6 mini-player states exposed (disconnected / connecting / idle / playing / offline / no-premium). Controls disabled with tooltip on free-tier accounts. Context menu offers Open Spotify app + Disconnect. Settings pane mirrors disconnect/reconnect flow. Visibility-driven polling cadence wired (focus/blur → setVisibility).
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-06-spotify-renderer-ui-SUMMARY.md` documenting:
- 6 mini-player states + which data drives each
- premiumRequired UX behavior (disabled controls + tooltip)
- Context menu item semantics (spotify:// URL vs disconnect)
- Visibility wiring (focus/blur)
- Any UI deviations from RESEARCH
</output>
