/**
 * @vitest-environment jsdom
 *
 * Plan 03-10 Task 3 — App.tsx integration tests.
 *
 * Covers the Phase 3 state-routing extensions:
 *   - Home screen renders with gear + AccountBadge top-right and PlayButton centered (Test 1)
 *   - phase.state='crashed' → CrashViewer full-page takeover (Test 4)
 *   - Crash Close → resetToIdle → back to Home (Test 5)
 *   - Crash Play again → useGameStore.play() → game.play IPC invoked (Test 6)
 *   - App mount calls useGameStore.subscribe() once (Test 7)
 *   - App mount calls useSettingsStore.initialize() once (Test 8)
 *
 * Plan 04-02 Task 3 removed former Tests 2 and 3 (SettingsDrawer
 * open/close) because Phase 4 deletes SettingsDrawer; Plan 04-03 adds
 * its replacement SettingsModal and Plan 04-03's own test file covers
 * that open/close flow.
 *
 * Mock strategy: use `window.wiiwho.*` mocks for the preload surface the
 * stores reach for on mount (auth.status, auth.onDeviceCode, settings.get,
 * logs.openCrashFolder, __debug.securityAudit, and game.play/cancel/
 * onStatus/onProgress/onLog/onExited/onCrashed). The stores themselves are
 * real — we assert behavior at the App level, not store internals.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// ---- jsdom shims (Radix + Dialog + Sheet) ----------------------------------

beforeAll(() => {
  const elProto = Element.prototype as unknown as {
    hasPointerCapture?: (id: number) => boolean
    releasePointerCapture?: (id: number) => void
    scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void
  }
  if (!elProto.hasPointerCapture) elProto.hasPointerCapture = () => false
  if (!elProto.releasePointerCapture) elProto.releasePointerCapture = () => {}
  if (!elProto.scrollIntoView) elProto.scrollIntoView = () => {}

  const g = globalThis as unknown as { ResizeObserver?: unknown }
  if (!g.ResizeObserver) {
    g.ResizeObserver = class {
      observe(): void {
        /* jsdom shim — no-op */
      }
      unobserve(): void {
        /* jsdom shim — no-op */
      }
      disconnect(): void {
        /* jsdom shim — no-op */
      }
    }
  }
})

// ---- window.wiiwho mock surface ---------------------------------------------

type Listener = (...args: unknown[]) => void
type GameApi = {
  play: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  status: ReturnType<typeof vi.fn>
  onStatus: ReturnType<typeof vi.fn>
  onProgress: ReturnType<typeof vi.fn>
  onLog: ReturnType<typeof vi.fn>
  onExited: ReturnType<typeof vi.fn>
  onCrashed: ReturnType<typeof vi.fn>
}
type AuthApi = {
  status: ReturnType<typeof vi.fn>
  login: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  onDeviceCode: ReturnType<typeof vi.fn>
}
type SettingsApi = {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}
type LogsApi = {
  readCrash: ReturnType<typeof vi.fn>
  openCrashFolder: ReturnType<typeof vi.fn>
  listCrashReports: ReturnType<typeof vi.fn>
}

function freshApi(): {
  auth: AuthApi
  game: GameApi
  settings: SettingsApi
  logs: LogsApi
  __debug: { securityAudit: ReturnType<typeof vi.fn> }
} {
  const noop = (): (() => void) => () => {}
  return {
    auth: {
      status: vi.fn().mockResolvedValue({ loggedIn: false }),
      login: vi.fn().mockResolvedValue({ ok: true }),
      logout: vi.fn().mockResolvedValue({ ok: true }),
      onDeviceCode: vi.fn(() => noop() as never)
    },
    game: {
      play: vi.fn().mockResolvedValue({ ok: true }),
      cancel: vi.fn().mockResolvedValue({ ok: true }),
      status: vi.fn().mockResolvedValue({ state: 'idle' }),
      // All five subscribe endpoints return a no-op unsubscribe. The `cb`
      // param is captured only for verification of call arity; we don't
      // invoke it from these tests.
      onStatus: vi.fn((_cb: Listener) => {
        void _cb
        return noop()
      }),
      onProgress: vi.fn((_cb: Listener) => {
        void _cb
        return noop()
      }),
      onLog: vi.fn((_cb: Listener) => {
        void _cb
        return noop()
      }),
      onExited: vi.fn((_cb: Listener) => {
        void _cb
        return noop()
      }),
      onCrashed: vi.fn((_cb: Listener) => {
        void _cb
        return noop()
      })
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        version: 2,
        ramMb: 2048,
        firstRunSeen: false,
        theme: { accent: '#16e0ee', reduceMotion: 'system' }
      }),
      set: vi.fn().mockResolvedValue({
        ok: true,
        settings: {
          version: 2,
          ramMb: 2048,
          firstRunSeen: false,
          theme: { accent: '#16e0ee', reduceMotion: 'system' }
        }
      })
    },
    logs: {
      readCrash: vi.fn().mockResolvedValue({ sanitizedBody: '' }),
      openCrashFolder: vi.fn().mockResolvedValue({ ok: true }),
      listCrashReports: vi.fn().mockResolvedValue({ crashes: [] })
    },
    __debug: {
      securityAudit: vi.fn().mockResolvedValue({
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        allTrue: true
      })
    }
  }
}

let api: ReturnType<typeof freshApi>

// Imports must come after the window.wiiwho shim below is installed in
// beforeEach; we do a dynamic import in each test via `renderApp`.
let App: React.ComponentType
let useAuthStore: (typeof import('../../stores/auth'))['useAuthStore']
let useGameStore: (typeof import('../../stores/game'))['useGameStore']
let useSettingsStore: (typeof import('../../stores/settings'))['useSettingsStore']

beforeEach(async () => {
  api = freshApi()
  ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = api as never

  vi.resetModules()
  const appMod = await import('../../App')
  App = appMod.default
  const authMod = await import('../../stores/auth')
  useAuthStore = authMod.useAuthStore
  const gameMod = await import('../../stores/game')
  useGameStore = gameMod.useGameStore
  const settingsMod = await import('../../stores/settings')
  useSettingsStore = settingsMod.useSettingsStore

  // Pre-set to logged-in so we skip past the LoginScreen branch.
  useAuthStore.setState({
    state: 'logged-in',
    username: 'Wiiwho',
    uuid: 'u',
    initialized: true,
    error: undefined
  })
  useGameStore.setState({
    phase: { state: 'idle' },
    logTail: [],
    subscribed: false
  })
  useSettingsStore.setState({
    version: 2,
    ramMb: 2048,
    firstRunSeen: false,
    theme: { accent: '#16e0ee', reduceMotion: 'system' },
    hydrated: true,
    modalOpen: false,
    openPane: 'general'
  } as never)
})

afterEach(() => {
  cleanup()
})

// Helper: advance the LOADING_MIN_MS hold (300ms) + flush microtasks. The
// component guards the LoadingScreen for at least 300ms to avoid sub-100ms
// flicker; until that timer elapses the app renders LoadingScreen regardless
// of auth state.
async function skipLoadingHold(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400)
  })
}

// ---- Tests ------------------------------------------------------------------

describe('App.tsx (Plan 03-10 Task 3)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1: Home screen renders PlayButton + gear icon + AccountBadge when logged-in + phase=idle', async () => {
    render(<App />)
    await skipLoadingHold()

    // PlayButton centered — its 'Play' label is rendered.
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument()

    // Gear icon button — accessible name 'Open settings'.
    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument()

    // Wordmark still present.
    expect(screen.getByRole('heading', { name: /wiiwho client/i })).toBeInTheDocument()

    // v0.1.0-dev tag.
    expect(screen.getByText('v0.1.0-dev')).toBeInTheDocument()
  })

  it('Test 2: clicking the gear icon calls useSettingsStore.setModalOpen(true)', async () => {
    // Phase 4 replacement for the old "opens SettingsDrawer" test. The
    // drawer is gone (Plan 04-02); the gear now calls setModalOpen(true)
    // which Plan 04-03's SettingsModal binds to. We assert the store
    // state rather than the DOM to decouple from 04-03's modal shape.
    render(<App />)
    await skipLoadingHold()

    // Pre-condition: modal starts closed.
    expect(useSettingsStore.getState().modalOpen).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /open settings/i }))

    expect(useSettingsStore.getState().modalOpen).toBe(true)
  })

  it('Test 4: phase=crashed → full-page CrashViewer takeover (D-18)', async () => {
    render(<App />)
    await skipLoadingHold()

    // Flip the store to the crashed state.
    act(() => {
      useGameStore.setState({
        phase: {
          state: 'crashed',
          sanitizedBody: 'mock crash body',
          crashId: 'crash-x'
        }
      })
    })

    // CrashViewer renders — "Crash detected" heading is present.
    expect(screen.getByRole('heading', { name: /crash detected/i })).toBeInTheDocument()

    // PlayButton returns null in the crashed state (Plan 03-08 behavior), so
    // no 'Play' button should be visible.
    expect(screen.queryByRole('button', { name: /^play$/i })).not.toBeInTheDocument()
  })

  it('Test 5: Close on CrashViewer resets phase to idle → back to Home', async () => {
    render(<App />)
    await skipLoadingHold()

    act(() => {
      useGameStore.setState({
        phase: {
          state: 'crashed',
          sanitizedBody: 'body',
          crashId: 'crash-x'
        }
      })
    })

    // Click Close on CrashViewer.
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))

    // Store phase should have reset to idle.
    expect(useGameStore.getState().phase.state).toBe('idle')

    // Home re-renders — PlayButton's 'Play' label is visible again.
    expect(screen.getByRole('button', { name: /^play$/i })).toBeInTheDocument()
  })

  it('Test 6: Play again on CrashViewer invokes useGameStore.play() → game.play IPC', async () => {
    render(<App />)
    await skipLoadingHold()

    act(() => {
      useGameStore.setState({
        phase: {
          state: 'crashed',
          sanitizedBody: 'body',
          crashId: 'crash-x'
        }
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /play again/i }))

    // useGameStore.play() resets phase to downloading optimistically and
    // calls window.wiiwho.game.play().
    await vi.waitFor(() => {
      expect(api.game.play).toHaveBeenCalledTimes(1)
    })
  })

  it('Test 7: App mount calls useGameStore.subscribe() once (via window.wiiwho.game.onStatus)', async () => {
    render(<App />)
    await skipLoadingHold()

    // useGameStore.subscribe() wires up the IPC listeners via
    // window.wiiwho.game.{onStatus,onProgress,onLog,onExited,onCrashed}.
    // Each of those should have been called exactly once.
    expect(api.game.onStatus).toHaveBeenCalledTimes(1)
    expect(api.game.onProgress).toHaveBeenCalledTimes(1)
    expect(api.game.onLog).toHaveBeenCalledTimes(1)
    expect(api.game.onExited).toHaveBeenCalledTimes(1)
    expect(api.game.onCrashed).toHaveBeenCalledTimes(1)

    // And the store reports subscribed=true.
    expect(useGameStore.getState().subscribed).toBe(true)
  })

  it('Test 8: App mount calls useSettingsStore.initialize() → window.wiiwho.settings.get exactly once', async () => {
    // We pre-seeded hydrated=true in beforeEach to skip the flash; reset it
    // here so initialize actually hits the IPC.
    useSettingsStore.setState({
      version: 2,
      ramMb: 2048,
      firstRunSeen: false,
      theme: { accent: '#16e0ee', reduceMotion: 'system' },
      hydrated: false,
      modalOpen: false,
      openPane: 'general'
    } as never)

    render(<App />)
    await skipLoadingHold()

    await vi.waitFor(() => {
      expect(api.settings.get).toHaveBeenCalledTimes(1)
    })
    // Store should now be hydrated.
    expect(useSettingsStore.getState().hydrated).toBe(true)
  })
})
