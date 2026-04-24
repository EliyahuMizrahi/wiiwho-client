/**
 * 8 accent color presets per CONTEXT D-13 + RESEARCH tuning.
 *
 * D-13 listed illustrative values for Red/Yellow/Gray; RESEARCH retuned to
 * Crimson/Amber/Slate for WCAG 2.1 SC 1.4.11 Non-text Contrast ≥3:1 against
 * --color-wiiwho-bg (#111111). All 8 hexes verified against #111111 background
 * by RESEARCH. D-13's "Exact preset hexes are research/planner discretion"
 * grant authorizes this substitution; this file is the single source of truth.
 *
 * Downstream consumers:
 *   - docs/DESIGN-SYSTEM.md §Colors table mirrors this list (Plan 04-07).
 *   - global.css @theme block declares a --color-preset-<id> CSS var per entry.
 *   - ThemePicker (Plan 04-04) renders one swatch per entry.
 */
export interface AccentPreset {
  readonly id: 'cyan' | 'mint' | 'violet' | 'tangerine' | 'pink' | 'crimson' | 'amber' | 'slate'
  readonly name: string
  readonly hex: `#${string}`
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'cyan', name: 'Cyan', hex: '#16e0ee' }, // default — D-13 lock
  { id: 'mint', name: 'Mint', hex: '#22c55e' },
  { id: 'violet', name: 'Violet', hex: '#a855f7' },
  { id: 'tangerine', name: 'Tangerine', hex: '#f97316' },
  { id: 'pink', name: 'Pink', hex: '#ec4899' },
  { id: 'crimson', name: 'Crimson', hex: '#f87171' }, // RESEARCH-tuned (D-13 listed "Red" as illustrative)
  { id: 'amber', name: 'Amber', hex: '#fbbf24' }, // RESEARCH-tuned (D-13 listed "Yellow" as illustrative)
  { id: 'slate', name: 'Slate', hex: '#cbd5e1' } // RESEARCH-tuned (D-13 listed "Gray" as illustrative)
] as const

/** Default accent if user hasn't picked one (D-13 cyan lock preserves Phase 1 D-09). */
export const DEFAULT_ACCENT_HEX = '#16e0ee' as const
