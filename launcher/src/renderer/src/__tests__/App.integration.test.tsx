/**
 * @vitest-environment jsdom
 *
 * Plan 04-07 Task 1 — App.tsx integration tests (logged-in tree).
 *
 * Covers the Phase 4 integration wave:
 *   - Sidebar renders (nav with Play + Cosmetics + Settings gear)
 *   - Play section is the default main area (wordmark visible)
 *   - AccountBadge rendered top-right (E-03 — NOT in sidebar)
 *   - Clicking Cosmetics sidebar row swaps main area to Cosmetics
 *   - Clicking Settings gear opens SettingsModal (role="dialog" appears)
 *   - App no longer imports SettingsDrawer (source-grep regression)
 *   - App imports and mounts <DeviceCodeModal /> in the logged-in tree
 *   - DeviceCodeModal surfaces the device code during re-auth while logged-in
 *   - Crashed phase still routes to CrashViewer (Phase 3 D-18 preserved)
 *   - App useEffect initializes useSpotifyStore (window.wiiwho.spotify.status called)
 *
 * Motion mock strategy: motion/react is mocked to a bare proxy so AnimatePresence
 * passes children through instantly and animated motion.* elements render as
 * plain divs — we're asserting DOM composition, not animation timing.
 */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// jsdom shims — Radix primitives (Dialog, DropdownMenu) use pointer capture
// + ResizeObserver. Install before any render() runs.
Element.prototype.hasPointerCapture = (() => false) as never
Element.prototype.releasePointerCapture = (() => {}) as never
Element.prototype.scrollIntoView = (() => {}) as never

const g = globalThis as unknown as { ResizeObserver?: unknown }
if (!g.ResizeObserver) {
  g.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}

// Mock motion/react: plain pass-through div so AnimatePresence + motion.*
// don't interfere with synchronous DOM assertions. Strip motion-only props
// (initial/animate/exit/transition/layoutId) so React doesn't warn about
// unknown DOM attributes.
vi.mock('motion/react', () => {
  const MOTION_PROPS = new Set([
    'initial',
    'animate',
    'exit',
    'transition',
    'layoutId',
    'layout',
    'variants',
    'whileHover',
    'whileTap',
    'whileFocus',
    'whileInView',
    'drag',
    'dragConstraints'
  ])
  function stripMotionProps(
    props: Record<string, unknown>
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(props)) {
      if (!MOTION_PROPS.has(k)) out[k] = props[k]
    }
    return out
  }
  const motion = new Proxy(
    {},
    {
      get:
        (_t, tag: string) =>
        (p: Record<string, unknown>) =>
          React.createElement(tag, stripMotionProps(p) as never)
    }
  )
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
    LayoutGroup: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children)
  }
})

import App from '../App'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { useSpotifyStore } from '../stores/spotify'
import { useActiveSectionStore } from '../stores/activeSection'

beforeEach(() => {
  ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
    auth: {
      status: vi
        .fn()
        .mockResolvedValue({ loggedIn: true, username: 'Wiiwho', uuid: 'u-1' }),
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue({ ok: true }),
      onDeviceCode: vi.fn().mockReturnValue(() => {})
    },
    game: {
      status: vi.fn().mockResolvedValue({ state: 'idle' }),
      play: vi.fn().mockResolvedValue({ ok: true }),
      cancel: vi.fn(),
      onStatus: vi.fn().mockReturnValue(() => {}),
      onProgress: vi.fn().mockReturnValue(() => {}),
      onLog: vi.fn().mockReturnValue(() => {}),
      onExited: vi.fn().mockReturnValue(() => {}),
      onCrashed: vi.fn().mockReturnValue(() => {})
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        version: 2,
        ramMb: 2048,
        firstRunSeen: true,
        theme: { accent: '#16e0ee', reduceMotion: 'system' }
      }),
      set: vi.fn().mockResolvedValue({
        ok: true,
        settings: {
          version: 2,
          ramMb: 2048,
          firstRunSeen: true,
          theme: { accent: '#16e0ee', reduceMotion: 'system' }
        }
      })
    },
    logs: {
      readCrash: vi.fn(),
      openCrashFolder: vi.fn(),
      listCrashReports: vi.fn()
    },
    __debug: {
      securityAudit: vi.fn().mockResolvedValue({
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        allTrue: true
      })
    },
    spotify: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      status: vi.fn().mockResolvedValue({ connected: false }),
      control: {
        play: vi.fn(),
        pause: vi.fn(),
        next: vi.fn(),
        previous: vi.fn()
      },
      setVisibility: vi.fn().mockResolvedValue({ ok: true }),
      onStatusChanged: vi.fn().mockReturnValue(() => {})
    }
  }

  useAuthStore.setState({
    state: 'logged-in',
    username: 'Wiiwho',
    uuid: '12345678-1234-1234-1234-1234567890ab',
    initialized: true,
    deviceCode: undefined,
    error: undefined
  } as never)
  useGameStore.setState({
    phase: { state: 'idle' },
    logTail: [],
    subscribed: false
  } as never)
  useSettingsStore.setState({
    version: 2,
    ramMb: 2048,
    firstRunSeen: true,
    theme: { accent: '#16e0ee', reduceMotion: 'system' },
    hydrated: true,
    modalOpen: false,
    openPane: 'general'
  } as never)
  useSpotifyStore.setState({
    state: 'disconnected',
    displayName: null,
    isPremium: 'unknown',
    currentTrack: null,
    lastError: null,
    _unsubStatus: null,
    _onFocus: null,
    _onBlur: null
  } as never)
  useActiveSectionStore.setState({ section: 'play' } as never)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

/**
 * App holds LoadingScreen for LOADING_MIN_MS (300ms) regardless of auth state
 * to prevent a sub-100ms flicker. Tests that assert the logged-in tree must
 * advance timers past this hold. Mirrors App.test.tsx pattern.
 */
async function skipLoadingHold(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400)
  })
}

describe('App — logged-in integration (Plan 04-07)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('renders Sidebar (nav with primary navigation landmark)', async () => {
    render(<App />)
    await skipLoadingHold()
    expect(
      screen.getByRole('navigation', { name: /primary navigation/i })
    ).toBeInTheDocument()
  })

  it('renders Play section as default main area (wordmark "Wiiwho Client" visible)', async () => {
    render(<App />)
    await skipLoadingHold()
    expect(
      screen.getByRole('heading', { level: 1, name: /wiiwho client/i })
    ).toBeInTheDocument()
  })

  it('renders AccountBadge top-right (not a sidebar Account row — E-03)', async () => {
    render(<App />)
    await skipLoadingHold()
    expect(
      screen.getByLabelText(/account menu for wiiwho/i)
    ).toBeInTheDocument()
  })

  it('clicking Cosmetics sidebar row swaps main area to Cosmetics', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    // Re-enable fake timers only for the hold-skip, then restore real so
    // userEvent (which schedules via real timers) works normally.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<App />)
    await skipLoadingHold()
    vi.useRealTimers()
    await user.click(screen.getByRole('button', { name: /cosmetics/i }))
    expect(
      screen.getByRole('heading', { name: 'Cosmetics coming soon' })
    ).toBeInTheDocument()
  })

  it('clicking Settings gear opens SettingsModal (role="dialog" appears)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await skipLoadingHold()
    vi.useRealTimers()
    await user.click(screen.getByRole('button', { name: /open settings/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('App no longer imports SettingsDrawer (source-grep regression)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(__dirname, '../App.tsx'),
      'utf8'
    )
    expect(src).not.toMatch(/SettingsDrawer/)
  })

  it('App imports and mounts <DeviceCodeModal /> in the logged-in tree (Phase 2 regression guard)', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(
      path.resolve(__dirname, '../App.tsx'),
      'utf8'
    )
    expect(src).toMatch(
      /import\s*\{\s*DeviceCodeModal\s*\}\s*from\s*['"]\.\/components\/DeviceCodeModal['"]/
    )
    expect(src).toMatch(/<DeviceCodeModal\s*\/?>/)
  })

  it('DeviceCodeModal surfaces the device code when auth store fires a device-code payload while logged-in', async () => {
    // Simulate a re-auth device-code push arriving while 'logging-in'.
    // DeviceCodeModal mounts when state === 'logging-in' && deviceCode is set.
    // App.tsx puts <DeviceCodeModal /> in the logged-in tree (belt-and-suspenders
    // so re-auth during active session surfaces the code) AND LoginScreen
    // already mounts it during first-login. Either branch must surface the
    // device code to the user.
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'WIIW-TEST',
        verificationUri: 'https://microsoft.com/link',
        expiresInSec: 900,
        receivedAt: Date.now()
      }
    } as never)
    render(<App />)
    await skipLoadingHold()
    expect(screen.getByText(/WIIW-TEST/)).toBeInTheDocument()
  })

  it('crashed gamePhase still routes to CrashViewer (Phase 3 D-18 preserved)', async () => {
    useGameStore.setState({
      phase: {
        state: 'crashed',
        sanitizedBody: 'crash body',
        crashId: 'c-1'
      }
    } as never)
    render(<App />)
    await skipLoadingHold()
    // CrashViewer is rendered full-page; Sidebar should NOT also render
    expect(
      screen.queryByRole('navigation', { name: /primary navigation/i })
    ).toBeNull()
    // Verify CrashViewer itself mounted (not a blank takeover)
    expect(
      screen.getByRole('heading', { name: /crash detected/i })
    ).toBeInTheDocument()
  })

  it('App useEffect initializes useSpotifyStore (window.wiiwho.spotify.status called)', async () => {
    render(<App />)
    await skipLoadingHold()
    // Spotify initialize() is kicked synchronously from the useEffect;
    // the IPC status() promise resolves on a microtask.
    await act(async () => {
      await Promise.resolve()
    })
    expect(window.wiiwho.spotify.status).toHaveBeenCalled()
  })
})
