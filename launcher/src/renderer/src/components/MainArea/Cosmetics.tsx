/**
 * Cosmetics main-area section — D-05 "polished Coming soon empty state."
 *
 * Content (verbatim from D-05):
 *   - Stylized cape SVG (simple trapezoidal outline — lucide-react has no
 *     cape icon, and the owner's bitmap pipeline is Phase 6)
 *   - Headline: "Cosmetics coming soon"
 *   - Subtext:  "Placeholder cape arriving in v0.2."
 *
 * Deliberately renders ZERO interactive elements:
 *   - No button (no "Notify me", no "Browse capes")
 *   - No input / link / select
 *   - No toggle or stub action
 * This is an honest empty state — Phase 6 ships the real placeholder cape
 * pipeline and the Cosmetics pane replaces this file wholesale.
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-05
 */
import type React from 'react'

export function Cosmetics(): React.JSX.Element {
  return (
    <section className="h-full w-full flex flex-col items-center justify-center gap-4 p-8">
      {/* Custom cape SVG — simple trapezoidal outline. Owner may replace
          with a bitmap once the cosmetics pipeline lands. */}
      <svg
        width="96"
        height="120"
        viewBox="0 0 96 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-neutral-600"
      >
        <path d="M24 8 h48 l16 48 l-12 56 h-56 l-12 -56 z" />
        <path d="M48 8 v104" opacity="0.3" />
      </svg>
      <h2 className="text-2xl font-semibold text-neutral-200">
        Cosmetics coming soon
      </h2>
      <p className="text-sm text-neutral-500">
        Placeholder cape arriving in v0.2.
      </p>
    </section>
  )
}
