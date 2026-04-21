/**
 * @vitest-environment jsdom
 *
 * ErrorBanner tests — verifies UI-SPEC §ErrorBanner contract:
 *   - role=alert
 *   - Try again button → store.login
 *   - Help link: target=_blank rel=noreferrer, suppressed when helpUrl is null
 *   - Dismiss (×) with aria-label → dismissError
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const authApi = {
  status: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  onDeviceCode: vi.fn(() => () => {})
}

;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
  auth: authApi
} as never

import { ErrorBanner } from '../ErrorBanner'
import { useAuthStore } from '../../stores/auth'

describe('ErrorBanner', () => {
  beforeEach(() => {
    authApi.login.mockReset()
    authApi.status.mockReset()
    useAuthStore.setState({
      state: 'error',
      initialized: true,
      username: undefined,
      uuid: undefined,
      error: undefined
    })
  })

  // vitest 4 does not auto-cleanup DOM between tests in RTL 16; explicit call
  // prevents duplicate-element errors across back-to-back renders.
  afterEach(() => {
    cleanup()
  })

  it('renders with role=alert and the error message', () => {
    render(
      <ErrorBanner
        error={{
          code: 2148916238,
          message: 'Family group msg',
          helpUrl: 'https://example.com'
        }}
      />
    )
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('Family group msg')).toBeInTheDocument()
  })

  it('Try again button triggers store.login', async () => {
    authApi.login.mockResolvedValue({
      ok: false,
      error: JSON.stringify({ message: 'retry-fail' })
    })
    render(
      <ErrorBanner
        error={{ code: 1, message: 'any', helpUrl: 'https://x' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await vi.waitFor(() => expect(authApi.login).toHaveBeenCalledTimes(1))
  })

  it('Help link renders with target=_blank and rel=noreferrer when helpUrl set', () => {
    render(
      <ErrorBanner
        error={{
          code: null,
          message: 'm',
          helpUrl: 'https://www.xbox.com/en-US/live'
        }}
      />
    )
    const help = screen.getByRole('link', { name: /help/i })
    expect(help).toHaveAttribute('target', '_blank')
    expect(help).toHaveAttribute('rel', 'noreferrer')
    expect(help).toHaveAttribute('href', 'https://www.xbox.com/en-US/live')
  })

  it('Help link is NOT rendered when helpUrl is null (network error)', () => {
    render(
      <ErrorBanner
        error={{
          code: null,
          message: "Can't reach Microsoft",
          helpUrl: null
        }}
      />
    )
    expect(screen.queryByRole('link', { name: /help/i })).not.toBeInTheDocument()
  })

  it('Dismiss (×) button has aria-label and calls dismissError', () => {
    useAuthStore.setState({
      state: 'error',
      error: { code: null, message: 'x', helpUrl: null }
    })
    render(
      <ErrorBanner error={{ code: null, message: 'x', helpUrl: null }} />
    )
    const btn = screen.getByRole('button', { name: /dismiss error/i })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(useAuthStore.getState().state).toBe('logged-out')
  })
})
