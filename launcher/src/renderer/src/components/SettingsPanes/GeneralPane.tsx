/**
 * Settings modal → General pane.
 *
 * Plan 04-03 Task 1 ships a minimal shell with a testid marker; Task 2
 * fleshes out the content (RAM slider migration + crash-reports shortcuts).
 */
import type React from 'react'

export function GeneralPane(): React.JSX.Element {
  return (
    <div data-testid="general-pane" className="flex flex-col gap-8">
      <h2 className="text-xl font-semibold text-neutral-200">General</h2>
    </div>
  )
}
