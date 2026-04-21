/**
 * LoginScreen (D-01, D-04, D-05).
 *
 * Three elements exactly — wordmark, login button, version text.
 * No tooltips, no anticheat badge, no legal text (deferred to Phase 3 Settings).
 *
 * Copy + styling: .planning/phases/02-microsoft-authentication/02-UI-SPEC.md §Copywriting Contract
 */

import { Button } from '@/components/ui/button'
import { useAuthStore } from '../stores/auth'
import { ErrorBanner } from './ErrorBanner'

export function LoginScreen(): React.JSX.Element {
  const state = useAuthStore((s) => s.state)
  const login = useAuthStore((s) => s.login)
  const error = useAuthStore((s) => s.error)

  const isLoggingIn = state === 'logging-in'

  return (
    <div className="h-screen w-screen bg-[#111111] flex flex-col items-center justify-center">
      <h1 className="text-4xl font-semibold text-[#16e0ee] mb-8">
        Wiiwho Client
      </h1>

      <Button
        size="lg"
        className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-xl px-12 py-6"
        onClick={() => void login()}
        disabled={isLoggingIn}
        aria-label="Log in with Microsoft"
      >
        Log in with Microsoft
      </Button>

      {state === 'error' && error ? (
        <div className="w-[360px] mt-4">
          <ErrorBanner error={error} />
        </div>
      ) : null}

      <p className="text-xs font-normal text-neutral-500 mt-8">v0.1.0-dev</p>
    </div>
  )
}
