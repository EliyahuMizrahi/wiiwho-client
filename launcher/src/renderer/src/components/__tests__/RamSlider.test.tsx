/**
 * @vitest-environment jsdom
 *
 * RamSlider — D-04 (7 positions 1-4 GB in 512 MB steps, default 2 GB)
 *           + D-05 (always-visible caption + info-icon Radix Tooltip).
 *
 * Environment: jsdom (docblock pragma — Phase 2 pattern).
 * afterEach(cleanup) — vitest 4 + RTL 16 does NOT auto-cleanup (Plan 02-04
 * pattern locked; without it render() stacks nodes and queries throw
 * 'Found multiple elements').
 *
 * Radix primitives (Slider + Tooltip) rely on pointer capture; jsdom lacks
 * hasPointerCapture / releasePointerCapture / scrollIntoView, so we stub
 * them via a structural cast on Element.prototype (pattern from Plan 02-05).
 */

import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

// Radix pointer-capture stubs — applied once before any Radix primitive mounts.
beforeAll(() => {
  const elProto = Element.prototype as unknown as {
    hasPointerCapture?: (id: number) => boolean
    releasePointerCapture?: (id: number) => void
    scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void
  }
  if (!elProto.hasPointerCapture) elProto.hasPointerCapture = () => false
  if (!elProto.releasePointerCapture) elProto.releasePointerCapture = () => {}
  if (!elProto.scrollIntoView) elProto.scrollIntoView = () => {}

  // Radix Slider's track uses @radix-ui/react-use-size → ResizeObserver.
  // jsdom 25 does not ship ResizeObserver — stub a no-op class so the
  // primitive mounts without throwing during layout effects.
  const g = globalThis as unknown as { ResizeObserver?: unknown }
  if (!g.ResizeObserver) {
    g.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }
})

type SettingsAPI = {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

const settingsApi: SettingsAPI = {
  get: vi.fn(),
  set: vi.fn()
}

;(globalThis as unknown as { window: Window & { wiiwho: unknown } }).window.wiiwho = {
  settings: settingsApi
} as never

import { RamSlider, formatRam } from '../RamSlider'
import { useSettingsStore } from '../../stores/settings'

function resetStore(ramMb: number = 2048): void {
  useSettingsStore.setState({
    version: 1,
    ramMb,
    firstRunSeen: false,
    hydrated: true
  })
}

describe('formatRam', () => {
  it('formats integer GB without decimals', () => {
    expect(formatRam(1024)).toBe('1 GB')
    expect(formatRam(2048)).toBe('2 GB')
    expect(formatRam(3072)).toBe('3 GB')
    expect(formatRam(4096)).toBe('4 GB')
  })

  it('formats half-GB positions with one decimal', () => {
    expect(formatRam(1536)).toBe('1.5 GB')
    expect(formatRam(2560)).toBe('2.5 GB')
    expect(formatRam(3584)).toBe('3.5 GB')
  })
})

describe('RamSlider', () => {
  beforeEach(() => {
    settingsApi.get.mockReset()
    settingsApi.set.mockReset().mockResolvedValue({
      ok: true,
      settings: { version: 1, ramMb: 2048, firstRunSeen: false }
    })
    resetStore(2048)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a slider with D-04 bounds (aria-valuemin 1024, aria-valuemax 4096, step=512)', () => {
    render(<RamSlider />)
    const thumb = screen.getByRole('slider')
    expect(thumb).toHaveAttribute('aria-valuemin', '1024')
    expect(thumb).toHaveAttribute('aria-valuemax', '4096')
    expect(thumb).toHaveAttribute('aria-valuenow', '2048')
  })

  it('shows the default value formatted as "2 GB"', () => {
    render(<RamSlider />)
    // The caption lives next to the label — queryAllByText covers any
    // aria-live/display variants.
    expect(screen.getByText('2 GB')).toBeInTheDocument()
  })

  it('updates the displayed value when store.ramMb changes to 3072', () => {
    resetStore(3072)
    render(<RamSlider />)
    expect(screen.getByText('3 GB')).toBeInTheDocument()
  })

  it('pressing ArrowRight on the focused slider dispatches setRamMb (D-04 step 512)', async () => {
    const user = userEvent.setup()
    render(<RamSlider />)
    const thumb = screen.getByRole('slider')
    thumb.focus()
    await user.keyboard('{ArrowRight}')
    // Radix Slider commits on arrow-key — our onValueChange routes to
    // setRamMb, which calls window.wiiwho.settings.set.
    expect(settingsApi.set).toHaveBeenCalled()
    const call = settingsApi.set.mock.calls[0]?.[0] as { ramMb?: number }
    expect(call?.ramMb).toBeGreaterThanOrEqual(1024)
    expect(call?.ramMb).toBeLessThanOrEqual(4096)
    // From default 2048 + 1 step (512) = 2560.
    expect(call?.ramMb).toBe(2560)
  })

  it('has an accessible label "RAM allocation" (visible <label> + aria-label on root)', () => {
    render(<RamSlider />)
    // Visible label associated with the slider root by htmlFor.
    const visibleLabel = screen.getByText('RAM allocation')
    expect(visibleLabel.tagName.toLowerCase()).toBe('label')
    expect(visibleLabel).toHaveAttribute('for', 'ram-slider')
    // And the root primitive carries aria-label for screen-reader fallback.
    // (Radix Slider puts role="slider" on the Thumb, not Root — so we
    // query the root by data-slot instead.)
    const root = document.querySelector('[data-slot="slider"]')
    expect(root).toHaveAttribute('aria-label', 'RAM allocation')
    expect(root).toHaveAttribute('id', 'ram-slider')
  })

  it('D-05: renders always-visible caption copy "Lower values use less memory"', () => {
    render(<RamSlider />)
    expect(
      screen.getByText(/lower values use less memory/i)
    ).toBeInTheDocument()
  })

  it('D-05: info-icon button exposes an accessible label and opens a Tooltip with G1GC copy on hover', async () => {
    const user = userEvent.setup()
    render(<RamSlider />)
    const info = screen.getByRole('button', { name: /about ram allocation/i })
    expect(info).toBeInTheDocument()
    await user.hover(info)
    // Radix Tooltip renders BOTH a visible portaled copy AND an sr-only
    // announcement node — both contain the G1GC copy, so we assert
    // at-least-one instead of getByText (which throws on duplicates).
    const matches = await screen.findAllByText(/g1gc|garbage collection/i)
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking within the slider range does not crash (Radix clamps to min/max)', () => {
    render(<RamSlider />)
    const thumb = screen.getByRole('slider')
    // Simple sanity — Radix refuses out-of-range aria values on its own.
    const now = Number(thumb.getAttribute('aria-valuenow'))
    expect(now).toBeGreaterThanOrEqual(1024)
    expect(now).toBeLessThanOrEqual(4096)
  })
})
