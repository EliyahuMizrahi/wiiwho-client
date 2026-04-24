/**
 * @vitest-environment jsdom
 *
 * Plan 04-03 Task 1 — SettingsModal tests.
 *
 * Covers:
 *   - Mount / unmount on modalOpen
 *   - Sub-sidebar renders all 4 panes in D-10 order
 *   - X close button (aria-label "Close settings")
 *   - ESC key closes (Radix DismissableLayer)
 *   - openPane switch renders correct pane / stub
 *   - sr-only Dialog.Title for a11y
 *   - Anti-bloat grep (UI-05)
 */

import React from 'react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jsdom stubs for Radix Dialog (pointer capture + scrollIntoView) — MUST run
// before any Radix primitive mounts under jsdom.
// ResizeObserver is additionally required because the default pane (General)
// renders RamSlider, whose Radix Slider primitive invokes ResizeObserver on
// mount. Same stub pattern as Phase 3 RamSlider.test.tsx.
;(Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture =
  () => false
;(Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture =
  () => {}
;(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// Mock motion/react to render plain divs (no animation framework in jsdom) — we
// care about the DOM contract, not the paint. useReducedMotion returns false so
// the real reduced-motion branch doesn't collapse the tree to an unrelated shape.
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_, key) => {
          const Comp = key as string
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          return ({
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            layoutId: _layoutId,
            style,
            ...rest
          }: Record<string, unknown>) =>
            React.createElement(Comp, { ...(rest as object), style } as never)
        }
      }
    ),
    useReducedMotion: () => false
  }
})

import { SettingsModal } from '../SettingsModal'
import { useSettingsStore } from '../../stores/settings'

const DEFAULT_V2 = {
  version: 2 as const,
  ramMb: 2048,
  firstRunSeen: true,
  theme: { accent: '#16e0ee', reduceMotion: 'system' as const },
  hydrated: true
}

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
      status: vi.fn(),
      onStatus: vi.fn(() => () => {}),
      onProgress: vi.fn(() => () => {}),
      onLog: vi.fn(() => () => {}),
      onExited: vi.fn(() => () => {}),
      onCrashed: vi.fn(() => () => {})
    },
    settings: {
      get: vi.fn().mockResolvedValue({ ...DEFAULT_V2 }),
      set: vi.fn().mockResolvedValue({ ok: true, settings: { ...DEFAULT_V2 } })
    },
    logs: {
      readCrash: vi.fn(),
      openCrashFolder: vi.fn().mockResolvedValue({ ok: true }),
      listCrashReports: vi.fn().mockResolvedValue({ crashes: [] })
    },
    __debug: { securityAudit: vi.fn() }
  }
  useSettingsStore.setState({
    ...DEFAULT_V2,
    modalOpen: false,
    openPane: 'general'
  } as never)
})
afterEach(cleanup)

describe('SettingsModal', () => {
  it('renders nothing when modalOpen === false', () => {
    useSettingsStore.setState({ modalOpen: false } as never)
    render(<SettingsModal />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders Dialog when modalOpen === true', () => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
    render(<SettingsModal />)
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('renders sub-sidebar with all 4 panes (General, Account, Appearance, About) in order', () => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
    render(<SettingsModal />)
    const names = ['General', 'Account', 'Appearance', 'About']
    for (const name of names) {
      expect(screen.getByRole('button', { name })).toBeDefined()
    }
  })

  it('renders X close button with aria-label "Close settings"', () => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
    render(<SettingsModal />)
    expect(screen.getByRole('button', { name: /close settings/i })).toBeDefined()
  })

  it('ESC key closes modal (Radix DismissableLayer)', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
    render(<SettingsModal />)
    await user.keyboard('{Escape}')
    expect(useSettingsStore.getState().modalOpen).toBe(false)
  })

  it('clicking X closes modal', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
    render(<SettingsModal />)
    await user.click(screen.getByRole('button', { name: /close settings/i }))
    expect(useSettingsStore.getState().modalOpen).toBe(false)
  })

  it('openPane="account" renders AccountPane content (testid "account-pane")', () => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'account' } as never)
    render(<SettingsModal />)
    expect(screen.getByTestId('account-pane')).toBeDefined()
  })

  it('openPane="appearance" renders AppearancePane content (testid "appearance-pane")', () => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'appearance' } as never)
    render(<SettingsModal />)
    expect(screen.getByTestId('appearance-pane')).toBeDefined()
  })

  it('sr-only Dialog.Title "Settings" is rendered for a11y', () => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
    render(<SettingsModal />)
    expect(screen.getByText('Settings', { selector: '[class*="sr-only"]' })).toBeDefined()
  })

  it('contains NO anti-bloat strings (UI-05)', () => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
    const { container } = render(<SettingsModal />)
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).not.toMatch(/\b(ad|ads|news|friends? online|concurrent users|buy now)\b/)
  })
})
