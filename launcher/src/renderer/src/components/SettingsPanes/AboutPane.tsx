/**
 * Settings modal → About pane.
 *
 * Plan 04-03 Task 1 ships a minimal shell with a testid marker; Task 2
 * fleshes out the content (version + build hash + license + doc link).
 */
import type React from 'react'

export function AboutPane(): React.JSX.Element {
  return (
    <div data-testid="about-pane" className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-neutral-200">About</h2>
    </div>
  )
}
