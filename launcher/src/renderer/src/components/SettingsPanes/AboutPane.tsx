/**
 * Settings modal → About pane.
 *
 * Contents (D-10): app name, version, build hash, license placeholder,
 * ANTICHEAT-SAFETY.md link.
 */
import type React from 'react'

const BUILD_HASH =
  (import.meta as unknown as { env?: { VITE_BUILD_HASH?: string } }).env?.VITE_BUILD_HASH ??
  'dev'
const ANTICHEAT_DOC_URL =
  'https://github.com/EliyahuMizrahi/wiiwho-client/blob/master/docs/ANTICHEAT-SAFETY.md'

export function AboutPane(): React.JSX.Element {
  return (
    <div data-testid="about-pane" className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-neutral-200">About</h2>

      <section className="flex flex-col gap-1">
        <div className="text-lg font-semibold">Wiiwho Client</div>
        <div
          className="text-sm text-neutral-500"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          v0.1.0-dev
        </div>
        <div
          className="text-xs text-neutral-600"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Build: {BUILD_HASH}
        </div>
      </section>

      <section className="flex flex-col gap-1 text-sm">
        <div>License: TBD (pre-v0.1 release)</div>
        <div>
          <a
            href={ANTICHEAT_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--color-accent)' }}
          >
            ANTICHEAT-SAFETY.md
          </a>
        </div>
      </section>
    </div>
  )
}
