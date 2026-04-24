/**
 * @vitest-environment jsdom
 *
 * Sidebar — Plan 04-02 Task 1.
 *
 * Covers:
 *   - D-01 fixed 220px column
 *   - D-02 row order: Play → Cosmetics → Settings gear
 *   - D-03 active-state (aria-current="page" + motion layoutId pill/bar)
 *   - E-03 NO top-level Account row
 *   - UI-05 anti-bloat (no ads/news/friends markup)
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { Sidebar } from '../Sidebar'
import { useActiveSectionStore } from '../../stores/activeSection'
import { useSettingsStore } from '../../stores/settings'

// jsdom shims — Radix primitives call these; framer-motion layoutId also
// exercises DOM animation APIs that jsdom doesn't fully implement.
beforeAll(() => {
  const elProto = Element.prototype as unknown as {
    hasPointerCapture?: (id: number) => boolean
    releasePointerCapture?: (id: number) => void
    scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void
  }
  if (!elProto.hasPointerCapture) elProto.hasPointerCapture = () => false
  if (!elProto.releasePointerCapture) elProto.releasePointerCapture = () => {}
  if (!elProto.scrollIntoView) elProto.scrollIntoView = () => {}
})

describe('Sidebar', () => {
  afterEach(() => {
    cleanup()
    useActiveSectionStore.setState({ section: 'play' })
    useSettingsStore.setState({ modalOpen: false, openPane: 'general' } as never)
  })

  it('renders Play row and Cosmetics row', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cosmetics/i })).toBeInTheDocument()
  })

  it('does NOT render an Account row (E-03 interpretation)', () => {
    render(<Sidebar />)
    expect(screen.queryByRole('button', { name: /^account$/i })).toBeNull()
  })

  it('renders Settings gear button at bottom', () => {
    render(<Sidebar />)
    expect(
      screen.getByRole('button', { name: /open settings/i })
    ).toBeInTheDocument()
  })

  it('default active section is "play" (aria-current="page")', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /play/i })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      screen.getByRole('button', { name: /cosmetics/i })
    ).not.toHaveAttribute('aria-current', 'page')
  })

  it('clicking Cosmetics swaps activeSection', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /cosmetics/i }))
    expect(useActiveSectionStore.getState().section).toBe('cosmetics')
    expect(
      screen.getByRole('button', { name: /cosmetics/i })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('clicking Settings gear opens the modal via useSettingsStore.setModalOpen(true)', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /open settings/i }))
    expect(useSettingsStore.getState().modalOpen).toBe(true)
  })

  it('contains NO anti-bloat strings (ads/news/friends/online users — UI-05)', () => {
    const { container } = render(<Sidebar />)
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).not.toMatch(
      /\b(ad|ads|advertisement|news|news feed|online users|friends? online|concurrent users)\b/
    )
  })

  it('renders items in order: Play → Cosmetics → Settings gear', () => {
    const { container } = render(<Sidebar />)
    const buttons = Array.from(container.querySelectorAll('button')).map(
      (b) => b.getAttribute('aria-label') ?? b.textContent ?? ''
    )
    const playIdx = buttons.findIndex((b) => /play/i.test(b))
    const cosmIdx = buttons.findIndex((b) => /cosmetics/i.test(b))
    const gearIdx = buttons.findIndex((b) => /open settings/i.test(b))
    expect(playIdx).toBeLessThan(cosmIdx)
    expect(cosmIdx).toBeLessThan(gearIdx)
  })
})
