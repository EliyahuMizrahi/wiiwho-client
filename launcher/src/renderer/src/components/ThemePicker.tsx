/**
 * Theme picker — UI-01 + D-14.
 *
 * 8 preset swatches + custom hex input + EyeDropper button (Chromium 146 native).
 *
 *   - Swatches: click to call setAccent(preset.hex). Active preset surfaced via
 *     aria-pressed="true" + ring-2 ring-white/50 ring-offset.
 *   - Hex input: validates /^#[0-9a-fA-F]{6}$/. Valid → setAccent; invalid typing
 *     is kept as a local string (user sees what they typed) but is never sent to
 *     the store, preventing a flash of invalid colour or a junk-persisted accent.
 *   - EyeDropper: feature-probed via `typeof window.EyeDropper !== 'undefined'`.
 *     Rendered only when available (Chromium 146 → Electron 41 = yes; jsdom = no).
 *     Errors are silenced because the only documented rejection path is user
 *     pressing ESC during the picker, which we treat as a clean cancel.
 *
 * D-15: no contrast warning — if a user picks a low-contrast hex, they get what
 * they asked for. UI-01 trades paternalism for honesty.
 */
import type React from 'react'
import { useState } from 'react'
import { Pipette } from 'lucide-react'
import { ACCENT_PRESETS } from '../theme/presets'
import { useSettingsStore } from '../stores/settings'

declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> }
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function ThemePicker(): React.JSX.Element {
  const accent = useSettingsStore((s) => s.theme.accent)
  const setAccent = useSettingsStore((s) => s.setAccent)
  const [hexInput, setHexInput] = useState(accent)

  const supportsEyeDropper = typeof window.EyeDropper !== 'undefined'

  const onHexChange = (v: string): void => {
    setHexInput(v)
    if (HEX_RE.test(v)) {
      void setAccent(v)
    }
  }

  const pickWithEyedropper = async (): Promise<void> => {
    if (typeof window.EyeDropper === 'undefined') return
    try {
      const dropper = new window.EyeDropper()
      const result = await dropper.open()
      setHexInput(result.sRGBHex)
      void setAccent(result.sRGBHex)
    } catch {
      // User pressed ESC — silent (the only documented rejection path).
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-semibold text-neutral-300 mb-2">
          Accent color
        </label>
        <div className="grid grid-cols-8 gap-2">
          {ACCENT_PRESETS.map((p) => {
            const isActive = accent.toLowerCase() === p.hex.toLowerCase()
            return (
              <button
                key={p.id}
                type="button"
                data-accent-preset={p.id}
                aria-label={`Set accent to ${p.name}`}
                aria-pressed={isActive}
                onClick={() => void setAccent(p.hex)}
                title={p.name}
                className={`size-10 rounded transition-shadow focus-visible:outline-none ${
                  isActive
                    ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-wiiwho-surface'
                    : 'hover:ring-2 hover:ring-white/20'
                }`}
                style={{ backgroundColor: p.hex }}
              />
            )
          })}
        </div>
      </div>

      <div>
        <label
          className="block text-sm font-semibold text-neutral-300 mb-2"
          htmlFor="accent-hex"
        >
          Custom hex
        </label>
        <div className="flex gap-2">
          <input
            id="accent-hex"
            type="text"
            value={hexInput}
            onChange={(e) => onHexChange(e.target.value)}
            placeholder="#16e0ee"
            maxLength={7}
            className="flex-1 px-3 py-2 text-sm rounded bg-neutral-900 border border-wiiwho-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          {supportsEyeDropper && (
            <button
              type="button"
              aria-label="Pick color from screen"
              onClick={() => void pickWithEyedropper()}
              className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Pipette className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
