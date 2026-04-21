/**
 * @vitest-environment jsdom
 *
 * LoginScreen component tests — verifies UI-SPEC §Copywriting Contract
 * verbatim copy, store integration, and ErrorBanner conditional render.
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

import { LoginScreen } from '../LoginScreen'
import { useAuthStore } from '../../stores/auth'

function resetStore(): void {
  useAuthStore.setState({
    state: 'logged-out',
    initialized: true,
    username: undefined,
    uuid: undefined,
    error: undefined
  })
}

describe('LoginScreen', () => {
  beforeEach(() => {
    authApi.login.mockReset()
    authApi.status.mockReset()
    resetStore()
  })

  // vitest 4 does not auto-cleanup DOM between tests in RTL 16; explicit call
  // prevents "Found multiple elements" errors when a component is rendered in
  // back-to-back tests.
  afterEach(() => {
    cleanup()
  })

  it('renders "Wiiwho Client" wordmark as a font-semibold heading', () => {
    render(<LoginScreen />)
    const heading = screen.getByRole('heading', { name: 'Wiiwho Client' })
    expect(heading).toBeInTheDocument()
    expect(heading.className).toMatch(/font-semibold/)
    expect(heading.className).toMatch(/text-4xl/)
    expect(heading.className).not.toMatch(/font-bold/)
  })

  it('renders "Log in with Microsoft" button', () => {
    render(<LoginScreen />)
    expect(
      screen.getByRole('button', { name: /Log in with Microsoft/i })
    ).toBeInTheDocument()
  })

  it('renders v0.1.0-dev version text', () => {
    render(<LoginScreen />)
    expect(screen.getByText('v0.1.0-dev')).toBeInTheDocument()
  })

  it('clicking login button calls window.wiiwho.auth.login', async () => {
    authApi.login.mockResolvedValue({ ok: true, username: 'Alice' })
    authApi.status.mockResolvedValue({
      loggedIn: true,
      username: 'Alice',
      uuid: 'u'
    })
    render(<LoginScreen />)
    fireEvent.click(
      screen.getByRole('button', { name: /Log in with Microsoft/i })
    )
    await vi.waitFor(() => {
      expect(authApi.login).toHaveBeenCalledTimes(1)
    })
  })

  it('disables button while state=logging-in', () => {
    useAuthStore.setState({ state: 'logging-in' })
    render(<LoginScreen />)
    expect(
      screen.getByRole('button', { name: /Log in with Microsoft/i })
    ).toBeDisabled()
  })

  it('shows ErrorBanner with the error message when state=error', () => {
    useAuthStore.setState({
      state: 'error',
      error: {
        code: 2148916233,
        message:
          "This Microsoft account doesn't have an Xbox profile yet. Create one at xbox.com and try again.",
        helpUrl: 'https://www.xbox.com/en-US/live'
      }
    })
    render(<LoginScreen />)
    expect(
      screen.getByText(/doesn't have an Xbox profile yet/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
