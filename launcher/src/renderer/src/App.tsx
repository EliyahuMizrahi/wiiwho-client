/**
 * App root — Phase 4 layout (Plan 04-07).
 *
 * Logged-in branch:
 *   <Sidebar /> | <main> AnimatePresence(Play | Cosmetics) + <AccountBadge> </main>
 *   | <SettingsModal /> | <DeviceCodeModal />
 *
 * Phase 3's right-edge drawer and the top-right gear icon were removed:
 *   - The gear moved into Sidebar bottom (Plan 04-02).
 *   - The drawer was replaced with a bottom-slide modal (Plan 04-03).
 *
 * DeviceCodeModal is mounted in BOTH LoginScreen (Phase 2, first-login) AND
 * here (Phase 4, covers re-auth / token-refresh pushes that fire while the
 * user is on Play/Cosmetics). The component is self-guarding — it renders
 * nothing when useAuthStore.deviceCode is undefined, so double-mount is safe.
 *
 * Lifecycle (useEffect on mount):
 *   - initializeAuth()       — Phase 2
 *   - initializeSettings()   — Phase 3 / 04-01 (also re-applies theme.accent to :root)
 *   - subscribeGame()        — Phase 3 (onStatus/onProgress/onLog/onExited/onCrashed)
 *   - onDeviceCode subscription — Phase 2 (pushes payload into auth store)
 *   - securityAudit()        — Phase 1 (one-shot diagnostic log)
 *
 * On unmount: release every subscription, clear timers.
 *
 * Decision refs:
 *   D-01 Sidebar-driven main surface
 *   D-08 Bottom-slide Settings modal (replaces D-01 Phase-3 drawer)
 *   D-18 Crash viewer is a full-page takeover
 *   E-03 Account reachable only via AccountBadge dropdown + Settings Account pane
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuthStore } from './stores/auth'
import { useGameStore } from './stores/game'
import { useSettingsStore } from './stores/settings'
import { useActiveSectionStore } from './stores/activeSection'
import { LoginScreen } from './components/LoginScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { AccountBadge } from './components/AccountBadge'
import { DeviceCodeModal } from './components/DeviceCodeModal'
import { Sidebar } from './components/Sidebar'
import { SettingsModal } from './components/SettingsModal'
import { Play } from './components/MainArea/Play'
import { Cosmetics } from './components/MainArea/Cosmetics'
import { CrashViewer } from './components/CrashViewer'
import { DURATION_MED, EASE_STANDARD } from './theme/motion'

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
  const activeSection = useActiveSectionStore((s) => s.section)
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
  // internals (disabled button, ErrorBanner visibility, DeviceCodeModal mount)
  // are driven by the store inside LoginScreen itself.
  if (authState !== 'logged-in') {
    return <LoginScreen />
  }

  // D-18: crashed state takes over the whole screen, suppressing the normal
  // Phase-4 chrome (Sidebar, MainArea, modals). PlayButton already returns
  // null on 'crashed' so we don't need Home visible beneath.
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

  // Logged-in, not crashed — render the Phase-4 integrated shell.
  //
  // Overlay rack (bottom of the tree): SettingsModal + DeviceCodeModal.
  // Order does not affect z-index (each owns its own Portal / fixed
  // positioning); adjacency makes the overlay rack visually obvious.
  return (
    <div
      className="h-screen w-screen flex overflow-hidden"
      style={{ backgroundColor: 'var(--color-wiiwho-bg)' }}
    >
      <Sidebar />
      <main className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            className="h-full w-full"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              duration: DURATION_MED,
              ease: [...EASE_STANDARD] as unknown as [
                number,
                number,
                number,
                number
              ]
            }}
          >
            {activeSection === 'play' ? <Play /> : <Cosmetics />}
          </motion.div>
        </AnimatePresence>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
          <AccountBadge />
        </div>
      </main>
      <SettingsModal />
      <DeviceCodeModal />
    </div>
  )
}

export default App
