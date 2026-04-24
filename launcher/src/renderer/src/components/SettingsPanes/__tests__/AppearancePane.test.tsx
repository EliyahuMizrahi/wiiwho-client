/**
 * @vitest-environment jsdom
 *
 * Plan 04-04 Task 2 — AppearancePane tests.
 *
 * Covers:
 *   - Pane heading "Appearance"
 *   - ThemePicker mounted (8 swatches reachable)
 *   - Reduce-motion <select> with System / On / Off options
 *   - setReduceMotion wired on select change
 *   - data-testid="appearance-pane" root hook (replaces Plan 04-03 stub testid)
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppearancePane } from '../AppearancePane'
import { useSettingsStore } from '../../../stores/settings'

// Defensive jsdom stubs — harmless here but keep consistency with other pane tests.
;(Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture =
  () => false
;(Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture =
  () => {}
;(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {}

const setAccentMock = vi.fn().mockResolvedValue(undefined)
const setReduceMotionMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  useSettingsStore.setState({
    theme: { accent: '#16e0ee', reduceMotion: 'system' },
    setAccent: setAccentMock,
    setReduceMotion: setReduceMotionMock
  } as never)
  delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AppearancePane', () => {
  it('renders heading "Appearance"', () => {
    render(<AppearancePane />)
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeDefined()
  })

  it('renders ThemePicker (8 swatches reachable)', () => {
    const { container } = render(<AppearancePane />)
    const swatches = container.querySelectorAll('[data-accent-preset]')
    expect(swatches.length).toBe(8)
  })

  it('renders "Reduce motion" <select> with 3 options (system, on, off)', () => {
    render(<AppearancePane />)
    const select = screen.getByLabelText(/reduce motion/i) as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.value)
    expect(options.sort()).toEqual(['off', 'on', 'system'])
  })

  it('selecting "On" calls setReduceMotion("on")', async () => {
    const user = userEvent.setup()
    render(<AppearancePane />)
    const select = screen.getByLabelText(/reduce motion/i) as HTMLSelectElement
    await user.selectOptions(select, 'on')
    expect(setReduceMotionMock).toHaveBeenCalledWith('on')
  })

  it('has data-testid="appearance-pane"', () => {
    render(<AppearancePane />)
    expect(screen.getByTestId('appearance-pane')).toBeDefined()
  })
})
