/**
 * Settings modal → Appearance pane — D-10 + D-24.
 *
 * Contents:
 *  - ThemePicker: 8 preset swatches + custom hex input + EyeDropper (D-14).
 *  - Reduce motion: <select> with System / On / Off (UI-03 reduced-motion
 *    user override). "System" defers to the OS `prefers-reduced-motion`
 *    media query; "On" forces reduced; "Off" forces animated. Resolved
 *    centrally by `useMotionConfig` (Plan 04-01).
 *
 * Replaces the data-testid="appearance-pane-stub" anchor point from
 * Plan 04-03 SettingsModal — the switch-case now renders <AppearancePane />.
 */
import type React from 'react'
import { ThemePicker } from '../ThemePicker'
import { useSettingsStore } from '../../stores/settings'

export function AppearancePane(): React.JSX.Element {
  const reduceMotion = useSettingsStore((s) => s.theme.reduceMotion)
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion)

  return (
    <div data-testid="appearance-pane" className="flex flex-col gap-8">
      <h2 className="text-xl font-semibold text-neutral-200">Appearance</h2>

      <section>
        <ThemePicker />
      </section>

      <section className="flex flex-col gap-2">
        <label
          htmlFor="reduce-motion"
          className="text-sm font-semibold text-neutral-300"
        >
          Reduce motion
        </label>
        <select
          id="reduce-motion"
          value={reduceMotion}
          onChange={(e) =>
            void setReduceMotion(e.target.value as 'system' | 'on' | 'off')
          }
          className="w-48 px-3 py-2 text-sm rounded bg-neutral-900 border border-wiiwho-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="system">System (follow OS)</option>
          <option value="on">On (always reduce)</option>
          <option value="off">Off (always animate)</option>
        </select>
        <p className="text-xs text-neutral-500">
          Collapses transitions to 0ms when reduced — respects OS accessibility
          setting when &quot;System&quot; is selected.
        </p>
      </section>
    </div>
  )
}
