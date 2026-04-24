/**
 * @vitest-environment jsdom
 *
 * Plan 04-03 Task 2 — AboutPane tests.
 *
 * Covers:
 *   - "Wiiwho Client" app name
 *   - Version string v0.1.0
 *   - ANTICHEAT-SAFETY link with rel="noopener"
 *   - License "TBD" declaration
 *   - No anti-bloat strings (UI-05)
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AboutPane } from '../AboutPane'

describe('AboutPane', () => {
  afterEach(cleanup)

  it('renders "Wiiwho Client" app name', () => {
    render(<AboutPane />)
    expect(screen.getByText(/^Wiiwho Client$/)).toBeDefined()
  })

  it('renders version string matching "v0.1.0"', () => {
    render(<AboutPane />)
    const text = (screen.getByTestId('about-pane') as HTMLElement).textContent ?? ''
    expect(text).toMatch(/v0\.1\.0/)
  })

  it('includes a link to ANTICHEAT-SAFETY.md', () => {
    render(<AboutPane />)
    const link = screen.getByRole('link', { name: /ANTICHEAT-SAFETY/i })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toMatch(/ANTICHEAT-SAFETY/)
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('declares license state ("TBD")', () => {
    render(<AboutPane />)
    const text = (screen.getByTestId('about-pane') as HTMLElement).textContent ?? ''
    expect(text.toLowerCase()).toMatch(/license.*tbd/i)
  })

  it('contains NO anti-bloat strings', () => {
    const { container } = render(<AboutPane />)
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).not.toMatch(/\b(ad|ads|news feed|friends? online|concurrent users)\b/)
  })
})
