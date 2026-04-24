/**
 * @vitest-environment jsdom
 *
 * Plan 04-03 Task 3 — AccountPane tests.
 *
 * Covers:
 *   - Heading "Account"
 *   - username display
 *   - FULL UUID display (break-all, not truncated)
 *   - Sign out button wired to useAuthStore.logout (D-15: no confirm)
 *   - data-testid="account-pane"
 *   - "Not signed in" fallback when username/uuid missing
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountPane } from '../AccountPane'
import { useAuthStore } from '../../../stores/auth'

const logoutMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  useAuthStore.setState({
    state: 'logged-in',
    username: 'Wiiwho',
    uuid: '12345678-1234-1234-1234-1234567890ab',
    logout: logoutMock
  } as never)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AccountPane', () => {
  it('renders heading "Account"', () => {
    render(<AccountPane />)
    expect(screen.getByRole('heading', { name: 'Account' })).toBeDefined()
  })

  it('displays username', () => {
    render(<AccountPane />)
    expect(screen.getByText('Wiiwho')).toBeDefined()
  })

  it('displays full UUID (not truncated)', () => {
    render(<AccountPane />)
    expect(screen.getByText('12345678-1234-1234-1234-1234567890ab')).toBeDefined()
  })

  it('has "Sign out" button wired to useAuthStore.logout (no confirm — D-15)', async () => {
    const user = userEvent.setup()
    render(<AccountPane />)
    await user.click(screen.getByRole('button', { name: /sign out/i }))
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it('has data-testid="account-pane"', () => {
    render(<AccountPane />)
    expect(screen.getByTestId('account-pane')).toBeDefined()
  })

  it('renders "Not signed in" when username/uuid are missing', () => {
    useAuthStore.setState({ username: undefined, uuid: undefined } as never)
    render(<AccountPane />)
    expect(screen.getByText(/not signed in/i)).toBeDefined()
  })
})
