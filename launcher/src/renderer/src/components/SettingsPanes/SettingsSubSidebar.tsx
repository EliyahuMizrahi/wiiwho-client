/**
 * Settings modal left sub-sidebar — D-10.
 *
 * 180px wide. Pane order: General, Account, Appearance, About.
 * Active pane uses motion layoutId "settings-subnav-pill" for glide animation
 * matching the main sidebar's pattern (RESEARCH §Sub-sidebar + pane routing).
 *
 * Rolled by hand (not Radix Tabs) because we want the same layoutId idiom as
 * the primary Sidebar — Radix Tabs doesn't expose the internal layout engine.
 */
import type React from 'react'
import { motion } from 'motion/react'
import { useSettingsStore } from '../../stores/settings'
import { SPRING_STANDARD } from '../../theme/motion'

export const SETTINGS_PANES = ['general', 'account', 'appearance', 'about'] as const
export type SettingsPane = (typeof SETTINGS_PANES)[number]

const LABELS: Record<SettingsPane, string> = {
  general: 'General',
  account: 'Account',
  appearance: 'Appearance',
  about: 'About'
}

export function SettingsSubSidebar(): React.JSX.Element {
  const openPane = useSettingsStore((s) => s.openPane)
  const setOpenPane = useSettingsStore((s) => s.setOpenPane)

  return (
    <nav
      aria-label="Settings sections"
      className="w-[180px] h-full shrink-0 border-r border-wiiwho-border p-2 flex flex-col gap-1"
    >
      {SETTINGS_PANES.map((id) => {
        const isActive = openPane === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => setOpenPane(id)}
            aria-current={isActive ? 'page' : undefined}
            className="relative px-3 py-2 text-left text-sm rounded hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isActive && (
              <motion.div
                layoutId="settings-subnav-pill"
                className="absolute inset-0 rounded"
                style={{
                  backgroundColor:
                    'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                }}
                transition={SPRING_STANDARD}
              />
            )}
            <span
              className="relative z-10"
              style={{ color: isActive ? 'var(--color-accent)' : undefined }}
            >
              {LABELS[id]}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
