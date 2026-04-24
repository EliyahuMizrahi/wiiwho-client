/**
 * Settings modal → Account pane.
 *
 * Plan 04-03 Task 1 ships a minimal shell with a testid marker; Task 3
 * fleshes out the content (username + UUID + skin head + Sign out).
 */
import type React from 'react'

export function AccountPane(): React.JSX.Element {
  return (
    <div data-testid="account-pane" className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-neutral-200">Account</h2>
    </div>
  )
}
