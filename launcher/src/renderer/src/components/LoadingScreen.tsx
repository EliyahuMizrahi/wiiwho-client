/**
 * LoadingScreen (D-02 silent-refresh visible state).
 *
 * Minimum visible duration 300ms is handled by the consumer (App.tsx)
 * to prevent sub-100ms flash; this component only renders the state.
 * 8s fallback timeout is also the consumer's job.
 *
 * Copy + styling: .planning/phases/02-microsoft-authentication/02-UI-SPEC.md §LoadingScreen
 */

import { Loader2 } from 'lucide-react'

export function LoadingScreen(): React.JSX.Element {
  return (
    <div className="h-screen w-screen bg-[#111111] flex flex-col items-center justify-center">
      <h1 className="text-4xl font-semibold text-[#16e0ee] mb-8">
        Wiiwho Client
      </h1>

      <Loader2
        className="motion-safe:animate-spin size-6 text-neutral-500 mt-2"
        aria-label="Signing you in"
      />

      <p className="text-xs font-normal text-neutral-500 mt-8">v0.1.0-dev</p>
    </div>
  )
}
