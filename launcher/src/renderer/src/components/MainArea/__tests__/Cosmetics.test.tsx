/**
 * @vitest-environment jsdom
 *
 * Cosmetics main area — Plan 04-02 Task 2 (D-05).
 *
 * Verifies:
 *   - Exact headline "Cosmetics coming soon" (verbatim D-05)
 *   - Exact subtext "Placeholder cape arriving in v0.2." (verbatim D-05)
 *   - Cape SVG renders
 *   - NO interactive elements (no button/input/anchor/select) — D-05
 *     "no interactive, no toggle stub"
 *   - Zero anti-bloat strings (UI-05)
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Cosmetics } from '../Cosmetics'

describe('Cosmetics main area', () => {
  afterEach(cleanup)

  it('renders headline "Cosmetics coming soon" (D-05 verbatim)', () => {
    render(<Cosmetics />)
    expect(
      screen.getByRole('heading', { name: 'Cosmetics coming soon' })
    ).toBeInTheDocument()
  })

  it('renders subtext "Placeholder cape arriving in v0.2." (D-05 verbatim)', () => {
    render(<Cosmetics />)
    expect(screen.getByText('Placeholder cape arriving in v0.2.')).toBeInTheDocument()
  })

  it('renders a cape SVG (visual placeholder)', () => {
    const { container } = render(<Cosmetics />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('has NO interactive elements — D-05 "no interactive, no toggle stub"', () => {
    const { container } = render(<Cosmetics />)
    expect(container.querySelectorAll('button').length).toBe(0)
    expect(container.querySelectorAll('input').length).toBe(0)
    expect(container.querySelectorAll('a').length).toBe(0)
    expect(container.querySelectorAll('select').length).toBe(0)
  })

  it('contains NO anti-bloat strings (UI-05)', () => {
    const { container } = render(<Cosmetics />)
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).not.toMatch(
      /\b(ad|ads|news|friends? online|buy|subscribe|premium offer)\b/
    )
  })
})
