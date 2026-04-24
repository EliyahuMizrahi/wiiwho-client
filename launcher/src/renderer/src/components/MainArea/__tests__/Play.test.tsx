/**
 * @vitest-environment jsdom
 *
 * Play main area — Plan 04-02 Task 2 (D-04).
 *
 * Verifies:
 *   - Wordmark "Wiiwho Client" renders as h1
 *   - Version footer "v0.1.0-dev" renders
 *   - Root uses a CSS gradient referencing --color-accent (D-04 stub)
 *   - Zero anti-bloat strings (UI-05)
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Play } from '../Play'

// Minimal wiiwho mock — PlayButton reads useGameStore which indirectly
// touches window.wiiwho on mount. Stub the surface just enough to avoid
// throwing during render.
beforeEach(() => {
  ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
    auth: {
      status: vi.fn().mockResolvedValue({ loggedIn: false }),
      login: vi.fn(),
      logout: vi.fn(),
      onDeviceCode: vi.fn(() => () => {})
    },
    game: {
      play: vi.fn(),
      cancel: vi.fn(),
      status: vi.fn().mockResolvedValue({ state: 'idle' }),
      onStatus: vi.fn(() => () => {}),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onExited: vi.fn(() => () => {}),
      onCrashed: vi.fn(() => () => {})
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        version: 2,
        ramMb: 2048,
        firstRunSeen: false,
        theme: { accent: '#16e0ee', reduceMotion: 'system' }
      }),
      set: vi.fn()
    },
    logs: {
      readCrash: vi.fn(),
      openCrashFolder: vi.fn(),
      listCrashReports: vi.fn()
    },
    __debug: { securityAudit: vi.fn() }
  } as never
})

describe('Play main area', () => {
  afterEach(cleanup)

  it('renders wordmark "Wiiwho Client"', () => {
    render(<Play />)
    expect(
      screen.getByRole('heading', { level: 1, name: /wiiwho client/i })
    ).toBeInTheDocument()
  })

  it('renders version footer "v0.1.0-dev"', () => {
    render(<Play />)
    expect(screen.getByText('v0.1.0-dev')).toBeInTheDocument()
  })

  it('uses CSS gradient referencing --color-accent (D-04)', () => {
    const { container } = render(<Play />)
    const root = container.firstChild as HTMLElement
    const bg = root.style.backgroundImage
    expect(bg).toMatch(/linear-gradient/)
    expect(bg).toMatch(/var\(--color-accent\)|color-mix/)
  })

  it('contains NO anti-bloat strings (UI-05)', () => {
    const { container } = render(<Play />)
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).not.toMatch(
      /\b(ad|ads|news|friends? online|concurrent users|online now)\b/
    )
  })
})
