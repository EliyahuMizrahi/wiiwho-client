/**
 * SettingsDrawer — Radix Sheet (right slide-in).
 *
 * D-01: slide from right, Play-forward screen visible underneath.
 * D-02: X button + ESC + click-outside all close the drawer (Radix defaults
 *       via the shadcn Sheet wrapper — onOpenChange fires for all three).
 * D-07: Logs + Crashes entries live HERE (no persistent chrome on Home);
 *       version footer also lives here. Plan 03-10 wires the gear trigger
 *       + the onOpenLogs / onOpenCrashes callbacks into App.tsx.
 *
 * The drawer is fully controlled — open + onOpenChange flow from the parent
 * so App.tsx owns the open/closed state alongside its existing state-driven
 * routing. The parent is also responsible for mounting the trigger (gear
 * icon on Home) — this component is only the drawer body.
 */

import type { JSX } from 'react'
import { Settings, FileText, ShieldAlert } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { RamSlider } from './RamSlider'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenLogs?: () => void
  onOpenCrashes?: () => void
  /** Rendered verbatim in the footer. Defaults to v0.1 dev tag. */
  appVersion?: string
}

export function SettingsDrawer({
  open,
  onOpenChange,
  onOpenLogs,
  onOpenCrashes,
  appVersion = 'v0.1.0-dev'
}: Props): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[380px] bg-neutral-900 border-l border-neutral-800 text-neutral-100"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-neutral-100">
            <Settings className="size-4" aria-hidden="true" />
            Settings
          </SheetTitle>
          <SheetDescription className="text-xs font-normal text-neutral-500">
            Tune the launcher. Close with X, ESC, or click outside.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 py-2">
          <section aria-labelledby="settings-section-memory">
            <h3
              id="settings-section-memory"
              className="text-xs font-normal uppercase tracking-wide text-neutral-500 mb-3"
            >
              Memory
            </h3>
            <RamSlider />
          </section>

          <section aria-labelledby="settings-section-diagnostics">
            <h3
              id="settings-section-diagnostics"
              className="text-xs font-normal uppercase tracking-wide text-neutral-500 mb-2"
            >
              Diagnostics
            </h3>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className="justify-start font-normal text-neutral-300 hover:text-neutral-50"
                onClick={() => onOpenLogs?.()}
              >
                <FileText className="size-4 mr-2" aria-hidden="true" />
                Logs
              </Button>
              <Button
                variant="ghost"
                className="justify-start font-normal text-neutral-300 hover:text-neutral-50"
                onClick={() => onOpenCrashes?.()}
              >
                <ShieldAlert className="size-4 mr-2" aria-hidden="true" />
                Crashes
              </Button>
            </div>
          </section>
        </div>

        <footer className="mt-auto px-4 pb-4 pt-3 border-t border-neutral-800 text-xs font-normal text-neutral-600">
          <div>Wiiwho Client</div>
          <div className="tabular-nums">{appVersion}</div>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
