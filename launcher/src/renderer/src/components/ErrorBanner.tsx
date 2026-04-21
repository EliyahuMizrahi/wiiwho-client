/**
 * ErrorBanner (D-08, D-09, D-10).
 *
 * Inline under the login button. Persists until the user clicks ×,
 * clicks Try again, or clicks Log in with Microsoft again.
 *
 * Copy: verbatim from .planning/phases/02-microsoft-authentication/02-UI-SPEC.md §ErrorBanner
 * When helpUrl is null (network error per D-12), the Help link is suppressed entirely.
 *
 * NOTE: This banner NEVER renders on the cancel path — the auth store's
 * login action short-circuits __CANCELLED__ to 'logged-out' with no error,
 * so state !== 'error' and the LoginScreen guard prevents this component
 * from mounting on cancel (UI-SPEC line 216).
 */

import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore, type AuthErrorViewClient } from '../stores/auth'

interface Props {
  error: AuthErrorViewClient
}

export function ErrorBanner({ error }: Props): React.JSX.Element {
  const login = useAuthStore((s) => s.login)
  const dismissError = useAuthStore((s) => s.dismissError)

  return (
    <div
      role="alert"
      className="bg-neutral-900 border border-red-900/50 rounded-md p-4 transition-all duration-150 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="text-red-500 size-5 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 text-sm font-normal text-neutral-300">
          {error.message}
        </div>
        <button
          type="button"
          onClick={() => dismissError()}
          aria-label="Dismiss error"
          className="text-neutral-500 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16e0ee] rounded"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <Button
          size="sm"
          onClick={() => void login()}
          className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-sm font-normal"
        >
          Try again
        </Button>

        {error.helpUrl ? (
          <a
            href={error.helpUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-normal text-neutral-400 hover:text-neutral-200 hover:underline"
          >
            Help →
          </a>
        ) : null}
      </div>
    </div>
  )
}
