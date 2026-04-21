import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from './stores/auth'
import { LoginScreen } from './components/LoginScreen'
import { LoadingScreen } from './components/LoadingScreen'

// Renderer-side security assertions — fire on page load. If the launcher's
// BrowserWindow ever regresses on contextIsolation/nodeIntegration/sandbox,
// one of these will fail loudly in the console.
console.assert(
  typeof (globalThis as unknown as { process?: unknown }).process ===
    'undefined',
  'SECURITY: process is defined in renderer — nodeIntegration is NOT off'
)
console.assert(
  typeof (globalThis as unknown as { require?: unknown }).require ===
    'undefined',
  'SECURITY: require is defined in renderer — contextIsolation or sandbox is NOT set'
)

/** UI-SPEC: minimum visible duration for LoadingScreen to avoid sub-100ms flash. */
const LOADING_MIN_MS = 300
/** UI-SPEC / Pitfall 7: fallback timeout — if silent refresh never settles, drop to login. */
const LOADING_FALLBACK_MS = 8000

function App(): React.JSX.Element {
  const state = useAuthStore((s) => s.state)
  const username = useAuthStore((s) => s.username)
  const initialize = useAuthStore((s) => s.initialize)
  const [loadingHeld, setLoadingHeld] = useState(true)

  useEffect(() => {
    void initialize()

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
      clearTimeout(fallback)
      clearTimeout(minHold)
    }
  }, [initialize])

  // LoadingScreen held until both (a) store resolves out of 'loading'
  //  AND (b) minimum visible duration has elapsed — prevents a <100ms flash.
  if (state === 'loading' || loadingHeld) {
    return <LoadingScreen />
  }

  if (state === 'logged-in') {
    return (
      <div className="h-screen w-screen bg-neutral-900 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-semibold text-[#16e0ee] mb-8">
          Wiiwho Client
        </h1>
        <Button
          size="lg"
          className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-xl px-12 py-6"
          onClick={async (): Promise<void> => {
            const result = await window.wiiwho.game.play()
            console.log('Play clicked:', result)
          }}
        >
          Play
        </Button>
        <p className="text-xs font-normal text-neutral-500 mt-8">
          {username ? `${username} · v0.1.0-dev` : 'v0.1.0-dev'}
        </p>
      </div>
    )
  }

  // logged-out, logging-in, error all render LoginScreen. State-dependent
  // internals (disabled button, ErrorBanner visibility) are driven by the
  // store inside LoginScreen itself.
  return <LoginScreen />
}

export default App
