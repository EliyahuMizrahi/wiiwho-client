/**
 * RAM allocation slider.
 *
 * D-04: 1024-4096 MB in 512 MB steps, default 2048 MB — 7 positions
 *       (1, 1.5, 2, 2.5, 3, 3.5, 4 GB). Cap 4 GB per ROADMAP SC2.
 * D-05: BOTH an always-visible one-line caption AND an info-icon Radix
 *       Tooltip on hover for the longer G1GC explanation.
 * LAUN-03: bounds enforced by the Slider primitive + mirrored by the
 *          main-process clampRam (single source of truth in main).
 *
 * Source of value: useSettingsStore.ramMb (Zustand, hydrated from main).
 * Source of truth for clamp: main-process (Plan 03-02); the renderer just
 * round-trips whatever main returns.
 *
 * The component provides its own TooltipProvider so it can be dropped into
 * any parent (e.g. the Phase 4 SettingsModal General pane) without
 * demanding tooltip setup upstream.
 */

import type { JSX } from 'react'
import { Info } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useSettingsStore } from '../stores/settings'

const MIN_MB = 1024
const MAX_MB = 4096
const STEP_MB = 512

/**
 * Format an MB value as a GB string with at most one decimal place.
 *   1024  → "1 GB"
 *   1536  → "1.5 GB"
 *   2048  → "2 GB"
 */
export function formatRam(mb: number): string {
  const gb = mb / 1024
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`
}

export function RamSlider(): JSX.Element {
  const ramMb = useSettingsStore((s) => s.ramMb)
  const setRamMb = useSettingsStore((s) => s.setRamMb)

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="ram-slider"
            className="text-sm font-normal text-neutral-200"
          >
            RAM allocation
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-normal text-neutral-400 tabular-nums">
              {formatRam(ramMb)}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="About RAM allocation"
                  className="text-neutral-500 hover:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16e0ee] rounded"
                >
                  <Info className="size-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs font-normal">
                  Minecraft 1.8.9 runs fine on 2 GB. Higher values reduce GC
                  pauses but require more system memory. This launcher uses
                  G1GC (garbage collection) to keep pauses short — the RAM
                  slider mainly controls headroom for mod and chunk data.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Slider
          id="ram-slider"
          aria-label="RAM allocation"
          min={MIN_MB}
          max={MAX_MB}
          step={STEP_MB}
          value={[ramMb]}
          onValueChange={(values) => {
            const next = values[0] ?? ramMb
            if (next === ramMb) return
            void setRamMb(next)
          }}
        />

        <p className="text-xs font-normal text-neutral-500">
          Lower values use less memory. Higher values reduce GC pauses.
        </p>
      </div>
    </TooltipProvider>
  )
}
