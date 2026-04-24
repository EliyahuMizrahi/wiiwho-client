/**
 * Play main-area section — D-04.
 *
 * Layout:
 *   - Full-size <section> with an inline CSS linear-gradient background:
 *     `linear-gradient(135deg, color-mix(var(--color-accent) 10%) → --color-wiiwho-bg)`
 *     This is a stub — the owner's hero bitmap will replace the backgroundImage
 *     value with a `url('./assets/hero.png')` form when delivered. Using
 *     color-mix + var() means the stub tracks the user's selected accent for
 *     free via :root's --color-accent override.
 *   - Centered column: <h1> wordmark (accent color) + <PlayButton />
 *   - Bottom-right: "v0.1.0-dev" version tag in monospace
 *
 * No hard-coded colour pixels — all colour references route through theme
 * tokens so Plan 04-04's theme picker retints this view instantly.
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-04
 */
import type React from 'react'
import { PlayButton } from '../PlayButton'

export function Play(): React.JSX.Element {
  return (
    <section
      className="h-full w-full relative overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, var(--color-wiiwho-bg) 100%)'
      }}
    >
      <div className="h-full w-full flex flex-col items-center justify-center">
        <h1
          className="text-4xl font-semibold mb-8"
          style={{ color: 'var(--color-accent)' }}
        >
          Wiiwho Client
        </h1>
        <PlayButton />
      </div>
      <span
        className="absolute bottom-4 right-4 text-xs text-neutral-500"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        v0.1.0-dev
      </span>
    </section>
  )
}
