/**
 * @vitest-environment jsdom
 *
 * Plan 04-03 Task 1 — SettingsSubSidebar tests.
 *
 * Covers:
 *   - SETTINGS_PANES tuple shape + order (D-10)
 *   - 5 buttons with display labels
 *   - aria-current="page" on active pane
 *   - Click routes through useSettingsStore.setOpenPane
 *   - Nav width is 180px per D-10
 */

import React from 'react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Motion mock — layoutId motion.div collapses to a plain div so the tests
// don't depend on framer-motion's layout engine under jsdom.
vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_, key) =>
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          layoutId: _layoutId,
          ...rest
        }: Record<string, unknown>) =>
          React.createElement(key as string, rest as never)
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useReducedMotion: () => false
}))

import { SettingsSubSidebar, SETTINGS_PANES } from '../SettingsSubSidebar'
import { useSettingsStore } from '../../../stores/settings'

describe('SettingsSubSidebar', () => {
  beforeEach(() => {
    useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
  })
  afterEach(cleanup)

  it('SETTINGS_PANES exports 5 panes in order: general, account, appearance, spotify, about', () => {
    expect([...SETTINGS_PANES]).toEqual([
      'general',
      'account',
      'appearance',
      'spotify',
      'about'
    ])
  })

  it('renders 5 buttons with display labels', () => {
    render(<SettingsSubSidebar />)
    for (const label of ['General', 'Account', 'Appearance', 'Spotify', 'About']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined()
    }
  })

  it('active pane button has aria-current="page"', () => {
    useSettingsStore.setState({ openPane: 'appearance' } as never)
    render(<SettingsSubSidebar />)
    expect(screen.getByRole('button', { name: 'Appearance' }).getAttribute('aria-current')).toBe(
      'page'
    )
    expect(screen.getByRole('button', { name: 'General' }).getAttribute('aria-current')).toBeNull()
  })

  it('clicking a pane calls useSettingsStore.setOpenPane', async () => {
    const user = userEvent.setup()
    render(<SettingsSubSidebar />)
    await user.click(screen.getByRole('button', { name: 'About' }))
    expect(useSettingsStore.getState().openPane).toBe('about')
  })

  it('sub-sidebar width is 180px per D-10', () => {
    const { container } = render(<SettingsSubSidebar />)
    const nav = container.querySelector('nav')
    expect(nav?.className ?? '').toMatch(/w-\[180px\]/)
  })
})
