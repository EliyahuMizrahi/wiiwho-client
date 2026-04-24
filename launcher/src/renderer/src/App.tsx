/**
 * App root — Phase 3 state-driven routing.
 *
 * Branch structure (no react-router — auth state + game phase drive the tree):
 *
 *   state === 'loading' || loadingHeld   → LoadingScreen
 *   state !== 'logged-in'                → LoginScreen (logged-out, logging-in, error)
 *   state === 'logged-in' &&
 *     gamePhase.state === 'crashed'      → CrashViewer (full-page takeover — D-18)
 *     otherwise                          → Home (Play-forward)
 *
 * Home overlays (always mounted beneath Home, above nothing):
 *   - Gear icon (top-right) → opens Settings modal via setModalOpen(true).
 *     Plan 04-02 deleted the Phase 3 SettingsDrawer; Plan 04-03 adds the
 *     replacement SettingsModal and Plan 04-07 relocates the gear into
 *     the Sidebar and deletes this temporary top-right trigger.
 *
 * On mount we:
 *   - initializeAuth() (Phase 2)
 *   - initializeSettings() (Plan 03-07)
 *   - subscribeGame() — binds window.wiiwho.game.{onStatus,onProgress,
 *     onLog,onExited,onCrashed} so push events flow into the store
 *   - subscribe to auth:device-code for DeviceCodeModal
 *   - run __debug.securityAudit() as a smoke check (Phase 1)
 *
 * On unmount (app close), we release every subscription so renderer teardown
 * is clean.
 *
 * Decision refs:
 *   D-01 Settings = slide-in drawer from the right
 *   D-08 Home chrome strictly minimal (wordmark + Play + version + gear + badge)
 *   D-18 Crash viewer is a full-page takeover
 */

import { useEffect, useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useAuthStore } from './stores/auth'
import { useGameStore } from './stores/game'
import { useSettingsStore } from './stores/settings'
import { LoginScreen } from './components/LoginScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { AccountBadge } from './components/AccountBadge'
import { PlayButton } from './components/PlayButton'
import { CrashViewer } from './components/CrashViewer'

// Renderer-side security assertions — fire on page load. If the launcher's
// BrowserWindow ever regresses on contextIsolation/nodeIntegration/sandbox,
// one of these will fail loudly in the console.
console.assert(
  typeof (globalThis as unknown as { process?: unknown }).process === 'undefined',
  'SECURITY: process is defined in renderer — nodeIntegration is NOT off'
)
console.assert(
  typeof (globalThis as unknown as { require?: unknown }).require === 'undefined',
  'SECURITY: require is defined in renderer — contextIsolation or sandbox is NOT set'
)

/** UI-SPEC: minimum visible duration for LoadingScreen to avoid sub-100ms flash. */
const LOADING_MIN_MS = 300
/** UI-SPEC / Pitfall 7: fallback timeout — if silent refresh never settles, drop to login. */
const LOADING_FALLBACK_MS = 8000

function App(): React.JSX.Element {
  const authState = useAuthStore((s) => s.state)
  const initializeAuth = useAuthStore((s) => s.initialize)
  const subscribeGame = useGameStore((s) => s.subscribe)
  const gamePhase = useGameStore((s) => s.phase)
  const resetGame = useGameStore((s) => s.resetToIdle)
  const playGame = useGameStore((s) => s.play)
  const initSettings = useSettingsStore((s) => s.initialize)
  const setModalOpen = useSettingsStore((s) => s.setModalOpen)
  const [loadingHeld, setLoadingHeld] = useState(true)

  useEffect(() => {
    void initializeAuth()
    void initSettings()
    const unsubscribeGame = subscribeGame()

    // Subscribe to auth:device-code push events (frozen IPC channel, Plan 03).
    // The preload bridge's onDeviceCode returns an unsubscribe function that
    // lives for the lifetime of this effect. DeviceCodeModal reads the
    // payload off useAuthStore.deviceCode and mounts on state='logging-in'.
    const unsubDeviceCode = window.wiiwho.auth.onDeviceCode((payload) => {
      useAuthStore.getState().setDeviceCode(payload)
    })

    const fallback = setTimeout(() => {
      // If still loading after LOADING_FALLBACK_MS, force logged-out per UI-SPEC D-03.
      const current = useAuthStore.getState().state
      if (current === 'loading') {
        useAuthStore.setState({ state: 'logged-out', initialized: true })
      }
    }, LOADING_FALLBACK_MS)

    const minHold = setTimeout(() => setLoadingHeld(false), LOADING_MIN_MS)

    void (async (): Promise<void> => {
      const audit = await window.wiiwho.__debug.securityAudit()
      console.log('Security audit:', audit)
    })()

    return (): void => {
      unsubDeviceCode()
      unsubscribeGame()
      clearTimeout(fallback)
      clearTimeout(minHold)
    }
  }, [initializeAuth, subscribeGame, initSettings])

  // LoadingScreen held until both (a) store resolves out of 'loading'
  //  AND (b) minimum visible duration has elapsed — prevents a <100ms flash.
  if (authState === 'loading' || loadingHeld) {
    return <LoadingScreen />
  }

  // logged-out, logging-in, error all render LoginScreen. State-dependent
  // internals (disabled button, ErrorBanner visibility) are driven by the
  // store inside LoginScreen itself.
  if (authState !== 'logged-in') {
    return <LoginScreen />
  }

  // D-18: crashed state takes over the whole screen, suppressing normal
  // Home chrome. PlayButton already returns null on 'crashed' (Plan 03-08)
  // so keeping <Home /> visible behind would double-render; we branch here
  // instead so the CrashViewer owns the viewport.
  if (gamePhase.state === 'crashed') {
    return (
      <CrashViewer
        sanitizedBody={gamePhase.sanitizedBody}
        crashId={gamePhase.crashId}
        onClose={() => resetGame()}
        onPlayAgain={() => {
          resetGame()
          void playGame()
        }}
        onOpenCrashFolder={(crashId) => {
          void window.wiiwho.logs.openCrashFolder(crashId ?? undefined)
        }}
      />
    )
  }

  return (
    <div className="relative h-screen w-screen bg-neutral-900">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <button
          type="button"
          aria-label="Open settings"
          onClick={() => setModalOpen(true)}
          className="text-neutral-400 hover:text-neutral-200 p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16e0ee]"
        >
          <SettingsIcon className="size-5" aria-hidden="true" />
        </button>
        <AccountBadge />
      </div>

      <div className="h-full w-full flex flex-col items-center justify-center">
        <h1 className="text-4xl font-semibold text-[#16e0ee] mb-8">Wiiwho Client</h1>
        <PlayButton />
        <p className="text-xs font-normal text-neutral-500 mt-8">v0.1.0-dev</p>
      </div>
      {/*
        The Phase 3 SettingsDrawer was removed in Plan 04-02 Task 3.
        Plan 04-03 mounts <SettingsModal /> here (Radix Dialog centered),
        bound to useSettingsStore.modalOpen + openPane. Plan 04-07 also
        replaces this entire Home chrome with a Sidebar + MainArea layout,
        at which point the gear button above migrates into the Sidebar.
      */}
    </div>
  )
}

export default App
