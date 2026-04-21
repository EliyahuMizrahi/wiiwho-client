/**
 * @vitest-environment jsdom
 *
 * AccountBadge — D-13 (avatar + username + chevron), D-14 (mc-heads skin),
 * D-15 (instant Log out; no confirm).
 *
 * Environment + cleanup pattern same as DeviceCodeModal.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

type AuthAPI = {
  status: ReturnType<typeof vi.fn>
  login: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  onDeviceCode: ReturnType<typeof vi.fn>
}

const authApi: AuthAPI = {
  status: vi.fn(),
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue({ ok: true }),
  onDeviceCode: vi.fn(() => () => {})
}

;(globalThis as unknown as { window: Window & { wiiwho: unknown } }).window.wiiwho = {
  auth: authApi
} as never

import { AccountBadge } from '../AccountBadge'
import { useAuthStore } from '../../stores/auth'
import { __test__ as skinTest } from '../../hooks/useSkinHead'

function setLoggedIn(opts: { username?: string; uuid?: string } = {}): void {
  useAuthStore.setState({
    state: 'logged-in',
    initialized: true,
    username: opts.username ?? 'Alice',
    uuid: opts.uuid ?? 'abc123def456ghi789',
    error: undefined,
    deviceCode: undefined
  })
}

describe('AccountBadge', () => {
  beforeEach(() => {
    skinTest.resetFailed()
    authApi.logout.mockReset().mockResolvedValue({ ok: true })
    setLoggedIn()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders username and avatar img with mc-heads URL', () => {
    render(<AccountBadge />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe(
      'https://mc-heads.net/avatar/abc123def456ghi789/32'
    )
  })

  it('trigger button has aria-label "Account menu for {username}"', () => {
    render(<AccountBadge />)
    expect(
      screen.getByRole('button', { name: /account menu for alice/i })
    ).toBeInTheDocument()
  })

  it('click on trigger opens dropdown with username, uuid, and Log out', () => {
    render(<AccountBadge />)
    fireEvent.click(
      screen.getByRole('button', { name: /account menu for alice/i })
    )
    // Radix dropdown portals content — queries still find it
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('abc123def456ghi789')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /log out/i })
    ).toBeInTheDocument()
  })

  it('Log out click calls auth:logout via store', async () => {
    render(<AccountBadge />)
    fireEvent.click(
      screen.getByRole('button', { name: /account menu for alice/i })
    )
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }))
    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalled()
    })
    expect(useAuthStore.getState().state).toBe('logged-out')
  })

  it('onError on avatar img → placeholder initial renders', () => {
    render(<AccountBadge />)
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img as Element)
    // After error, placeholder renders (no img, div with initial)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('long username applies truncate + max-w', () => {
    setLoggedIn({ username: 'ThisIsAReallyLongMinecraftUsername' })
    render(<AccountBadge />)
    const name = screen.getByText('ThisIsAReallyLongMinecraftUsername')
    expect(name.className).toMatch(/truncate/)
    expect(name.className).toMatch(/max-w-\[120px\]/)
  })

  it('returns null when not logged in', () => {
    useAuthStore.setState({
      state: 'logged-out',
      username: undefined,
      uuid: undefined
    })
    const { container } = render(<AccountBadge />)
    expect(container.firstChild).toBeNull()
  })
})
