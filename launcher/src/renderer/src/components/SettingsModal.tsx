/**
 * Settings modal — bottom-slide over the main area.
 *
 * D-08: opens by sliding up from the bottom; closes by sliding down + fade.
 * D-09: height 560px, width = viewport minus sidebar (left-[220px] right-0).
 * Three dismissal gestures (D-08): X button + ESC + backdrop click.
 *
 * Architecture (RESEARCH §Radix Dialog Bottom-Slide — CANONICAL + checker-verified):
 *   - Controlled Radix Dialog.Root (modalOpen state from useSettingsStore).
 *   - Portal is ALWAYS mounted — forceMount, no {open && ...} guard around it.
 *     (Guarding Portal unmounts the subtree BEFORE framer-motion can run exit;
 *      forceMount then becomes a runtime no-op even though grep still finds it.)
 *   - AnimatePresence lives INSIDE the Portal.
 *   - {open && (...)} guard lives INSIDE AnimatePresence and wraps only
 *     Overlay + Content — this lets AnimatePresence observe the children
 *     toggle and run enter/exit animations.
 *   - Portal + Overlay + Content all use `forceMount` (Pitfall 4) so Radix
 *     doesn't unmount before framer-motion runs exit.
 *   - Slide uses y: '100%' → 0 → '100%' collapsed to y: 0 when motion is reduced.
 */
import type React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../stores/settings'
import { useMotionConfig } from '../hooks/useMotionConfig'
import { EASE_EMPHASIZED } from '../theme/motion'
import { SettingsSubSidebar } from './SettingsPanes/SettingsSubSidebar'
import { GeneralPane } from './SettingsPanes/GeneralPane'
import { AccountPane } from './SettingsPanes/AccountPane'
import { AppearancePane } from './SettingsPanes/AppearancePane'
import { AboutPane } from './SettingsPanes/AboutPane'

export function SettingsModal(): React.JSX.Element {
  const open = useSettingsStore((s) => s.modalOpen)
  const setOpen = useSettingsStore((s) => s.setModalOpen)
  const openPane = useSettingsStore((s) => s.openPane)
  const { durationSlow, durationMed, reduced } = useMotionConfig()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 bg-black/60 z-40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: durationMed, ease: [0.4, 0, 0.2, 1] }}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  className="fixed bottom-0 left-[220px] right-0 z-50 h-[560px] bg-wiiwho-surface border-t border-wiiwho-border rounded-t-lg shadow-2xl flex overflow-hidden"
                  initial={{ opacity: 0, y: reduced ? 0 : '100%' }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : '100%' }}
                  transition={{
                    duration: durationSlow,
                    ease: [...EASE_EMPHASIZED] as unknown as [
                      number,
                      number,
                      number,
                      number
                    ]
                  }}
                >
                  <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>

                  <SettingsSubSidebar />

                  <div className="flex-1 p-6 overflow-y-auto relative">
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        aria-label="Close settings"
                        className="absolute top-3 right-3 text-neutral-500 hover:text-neutral-200 p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <X className="size-5" aria-hidden="true" />
                      </button>
                    </DialogPrimitive.Close>

                    {openPane === 'general' && <GeneralPane />}
                    {openPane === 'account' && <AccountPane />}
                    {openPane === 'appearance' && <AppearancePane />}
                    {openPane === 'spotify' && (
                      <div data-testid="spotify-pane-stub" className="text-neutral-500">
                        Spotify (Plan 04-06)
                      </div>
                    )}
                    {openPane === 'about' && <AboutPane />}
                  </div>
                </motion.div>
              </DialogPrimitive.Content>
            </>
          )}
        </AnimatePresence>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
