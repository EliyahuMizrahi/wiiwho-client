/**
 * Sidebar — Phase 4 D-01 fixed 220px icon + label column.
 *
 * Row order (D-02), top-to-bottom:
 *   1. Play          (lucide Play icon)
 *   2. Cosmetics     (lucide Shirt icon)
 *   3. Thin divider
 *   4. Spotify slot  (placeholder — Plan 04-06 replaces with real mini-player)
 *   5. Settings gear (lucide Settings; opens modal via setModalOpen(true))
 *
 * Active-state visual (D-03): two motion.div elements with shared layoutIds
 * ("sidebar-nav-pill" + "sidebar-nav-bar") glide between the active rows.
 * framer-motion's layout animation takes care of the interpolation — the
 * pill is the accent-at-10% background, the bar is the 3px accent left edge.
 * Spring config comes from theme/motion.ts (stiffness 300, damping 30, mass 1).
 *
 * No user-identity row is rendered here (E-03). User identity lives in:
 *   - The top-right AccountBadge dropdown (extended by Plan 04-02 Task 3)
 *   - The Settings modal's identity pane (Plan 04-03 + 04-04 wiring)
 *
 * Motion import convention: always from 'motion/react' (Pitfall 5 —
 * 'motion' alone is the deprecated framer-motion legacy entrypoint).
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-01/02/03/E-03
 *         + 04-RESEARCH.md §Motion Stack → §Pattern A (layoutId pill glide).
 */
import type React from 'react'
import { motion } from 'motion/react'
import { Play, Shirt, Settings as SettingsIcon } from 'lucide-react'
import { useActiveSectionStore, type ActiveSection } from '../stores/activeSection'
import { useSettingsStore } from '../stores/settings'
import { SPRING_STANDARD } from '../theme/motion'

interface NavItem {
  id: ActiveSection
  label: string
  Icon: typeof Play
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'play', label: 'Play', Icon: Play },
  { id: 'cosmetics', label: 'Cosmetics', Icon: Shirt }
] as const

export function Sidebar(): React.JSX.Element {
  const active = useActiveSectionStore((s) => s.section)
  const setSection = useActiveSectionStore((s) => s.setSection)
  const setModalOpen = useSettingsStore((s) => s.setModalOpen)

  return (
    <nav
      aria-label="Primary navigation"
      className="w-[220px] h-full shrink-0 flex flex-col border-r border-wiiwho-border bg-wiiwho-surface"
    >
      {/* Top section — main nav rows */}
      <ul className="flex-1 flex flex-col gap-1 p-2 pt-4">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id
          return (
            <li key={item.id} className="relative">
              <button
                type="button"
                onClick={() => setSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex items-center gap-3 w-full px-4 py-3 text-left text-sm rounded-md hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  // Focus-ring uses the runtime accent.
                  outlineColor: 'var(--color-accent)'
                }}
              >
                {isActive && (
                  <>
                    <motion.div
                      layoutId="sidebar-nav-pill"
                      className="absolute inset-0 rounded-md"
                      style={{
                        backgroundColor:
                          'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                      }}
                      transition={SPRING_STANDARD}
                    />
                    <motion.div
                      layoutId="sidebar-nav-bar"
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                      transition={SPRING_STANDARD}
                    />
                  </>
                )}
                <item.Icon
                  className="size-5 relative z-10"
                  style={{ color: isActive ? 'var(--color-accent)' : undefined }}
                  aria-hidden="true"
                />
                <span
                  className="relative z-10"
                  style={{ color: isActive ? 'var(--color-accent)' : undefined }}
                >
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Divider */}
      <div className="border-t border-wiiwho-border" />

      {/* Spotify mini-player slot — real component wires in Plan 04-06.
          Placeholder keeps layout height stable and provides a stable
          data-testid for Plan 04-06's integration test. */}
      <div
        data-testid="spotify-slot"
        className="h-20 px-3 flex items-center text-xs text-neutral-500"
      >
        Spotify
      </div>

      {/* Settings gear — bottom pinned */}
      <div className="p-2 border-t border-wiiwho-border">
        <button
          type="button"
          aria-label="Open settings"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2"
          style={{ outlineColor: 'var(--color-accent)' }}
        >
          <SettingsIcon className="size-5" aria-hidden="true" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  )
}
