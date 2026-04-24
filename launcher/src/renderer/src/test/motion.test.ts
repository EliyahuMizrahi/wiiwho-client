/**
 * @vitest-environment jsdom
 *
 * Plan 04-01 Task 1 — token catalog + theme mirror tests.
 *
 * Verifies:
 *   - global.css @theme carries the full Phase 4 token catalog (8 preset
 *     swatches, 3 motion durations, 2 CSS easings, layout sizes, typography).
 *   - @font-face loaders for Inter + JetBrains Mono are declared with
 *     font-display: swap.
 *   - theme/presets.ts exposes 8 presets with cyan default and valid hex values.
 *   - theme/motion.ts mirrors the CSS duration/easing numbers in JS-usable shape
 *     (seconds for framer-motion).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ACCENT_PRESETS, DEFAULT_ACCENT_HEX } from '../theme/presets'
import {
  DURATION_FAST,
  DURATION_MED,
  DURATION_SLOW,
  EASE_EMPHASIZED,
  EASE_STANDARD,
  SPRING_STANDARD
} from '../theme/motion'

describe('global.css @theme token catalog', () => {
  afterEach(cleanup)
  const css = readFileSync(resolve(__dirname, '../global.css'), 'utf8')

  it('contains --duration-fast: 120ms', () => {
    expect(css).toMatch(/--duration-fast:\s*120ms/)
  })
  it('contains --duration-med: 200ms', () => {
    expect(css).toMatch(/--duration-med:\s*200ms/)
  })
  it('contains --duration-slow: 320ms', () => {
    expect(css).toMatch(/--duration-slow:\s*320ms/)
  })
  it('contains --ease-emphasized cubic-bezier(0.2, 0, 0, 1)', () => {
    expect(css).toMatch(/--ease-emphasized:\s*cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/)
  })
  it('contains --ease-standard cubic-bezier(0.4, 0, 0.2, 1)', () => {
    expect(css).toMatch(/--ease-standard:\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/)
  })
  it('declares --color-accent: #16e0ee in @theme', () => {
    expect(css).toMatch(/@theme[\s\S]*--color-accent:\s*#16e0ee/)
  })
  it('redeclares --color-accent on :root for runtime override', () => {
    expect(css).toMatch(/:root[\s\S]*--color-accent:\s*#16e0ee/)
  })
  it('declares all 8 preset swatches', () => {
    for (const { id, hex } of ACCENT_PRESETS) {
      expect(css).toMatch(new RegExp(`--color-preset-${id}:\\s*${hex}`))
    }
  })
  it('declares @font-face for Inter with font-display: swap', () => {
    expect(css).toMatch(
      /@font-face\s*\{[^}]*font-family:\s*'Inter'[^}]*font-display:\s*swap/
    )
  })
  it('declares @font-face for JetBrains Mono with font-display: swap', () => {
    expect(css).toMatch(
      /@font-face\s*\{[^}]*font-family:\s*'JetBrains Mono'[^}]*font-display:\s*swap/
    )
  })
  it('@theme does NOT use var() inside (Pitfall 11)', () => {
    const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? ''
    expect(themeBlock).not.toMatch(/var\(/)
  })
})

describe('theme/presets.ts', () => {
  afterEach(cleanup)
  it('has 8 presets', () => expect(ACCENT_PRESETS.length).toBe(8))
  it('first is cyan (default)', () => expect(ACCENT_PRESETS[0].id).toBe('cyan'))
  it('all hex values valid 6-digit', () => {
    for (const p of ACCENT_PRESETS) expect(p.hex).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('DEFAULT_ACCENT_HEX === "#16e0ee"', () =>
    expect(DEFAULT_ACCENT_HEX).toBe('#16e0ee'))
  it('documents D-13 → RESEARCH substitution in a leading JSDoc comment', () => {
    const src = readFileSync(resolve(__dirname, '../theme/presets.ts'), 'utf8')
    expect(src).toMatch(/D-13 listed illustrative values/i)
    expect(src).toMatch(/RESEARCH retuned to[\s*]+Crimson\/Amber\/Slate/i)
    expect(src).toMatch(/WCAG 2\.1 SC 1\.4\.11/)
  })
})

describe('theme/motion.ts', () => {
  afterEach(cleanup)
  it('DURATION_FAST === 0.12', () => expect(DURATION_FAST).toBe(0.12))
  it('DURATION_MED === 0.20', () => expect(DURATION_MED).toBe(0.2))
  it('DURATION_SLOW === 0.32', () => expect(DURATION_SLOW).toBe(0.32))
  it('EASE_EMPHASIZED === [0.2, 0, 0, 1]', () =>
    expect([...EASE_EMPHASIZED]).toEqual([0.2, 0, 0, 1]))
  it('EASE_STANDARD === [0.4, 0, 0.2, 1]', () =>
    expect([...EASE_STANDARD]).toEqual([0.4, 0, 0.2, 1]))
  it('SPRING_STANDARD is a spring with stiffness 300, damping 30, mass 1', () => {
    expect(SPRING_STANDARD.type).toBe('spring')
    expect(SPRING_STANDARD.stiffness).toBe(300)
    expect(SPRING_STANDARD.damping).toBe(30)
    expect(SPRING_STANDARD.mass).toBe(1)
  })
})
