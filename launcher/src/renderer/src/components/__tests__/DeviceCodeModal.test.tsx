/**
 * @vitest-environment jsdom
 *
 * DeviceCodeModal — D-06 (active) + D-07 (cancel/expired) UI-SPEC contract.
 *
 * Environment: jsdom (docblock pragma — vitest 4 pattern locked in Plan 02-04).
 * afterEach(cleanup) — vitest 4 + @testing-library/react 16 does NOT auto-cleanup
 * (Plan 02-04 pattern locked — without it render() calls stack nodes and queries
 * throw 'Found multiple elements').
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

// jsdom provides window — we graft our wiiwho namespace onto it.
;(globalThis as unknown as { window: Window & { wiiwho: unknown } }).window.wiiwho = {
  auth: authApi
} as never

// Stub navigator.clipboard (jsdom does NOT provide it).
const clipboardWriteText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: { writeText: clipboardWriteText },
  configurable: true,
  writable: true
})

// Stub window.open (jsdom provides a no-op that returns null — override with spy).
const windowOpen = vi.fn()
globalThis.window.open = windowOpen as unknown as typeof window.open

import { DeviceCodeModal } from '../DeviceCodeModal'
import { useAuthStore } from '../../stores/auth'

function resetStore(): void {
  useAuthStore.setState({
    state: 'logged-out',
    initialized: true,
    username: undefined,
    uuid: undefined,
    error: undefined,
    deviceCode: undefined
  })
}

describe('DeviceCodeModal', () => {
  beforeEach(() => {
    authApi.logout.mockReset().mockResolvedValue({ ok: true })
    authApi.login
      .mockReset()
      .mockResolvedValue({ ok: false, error: JSON.stringify({ message: 'x' }) })
    authApi.status.mockReset().mockResolvedValue({ loggedIn: false })
    clipboardWriteText.mockReset().mockResolvedValue(undefined)
    windowOpen.mockReset()
    resetStore()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render dialog content when no deviceCode', () => {
    render(<DeviceCodeModal />)
    expect(
      screen.queryByText('Sign in with Microsoft')
    ).not.toBeInTheDocument()
  })

  it('active state renders title, body, code, and all three buttons', () => {
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'ABCD1234',
        verificationUri: 'https://microsoft.com/link',
        expiresInSec: 900,
        receivedAt: Date.now()
      }
    })
    render(<DeviceCodeModal />)
    expect(screen.getByText('Sign in with Microsoft')).toBeInTheDocument()
    expect(
      screen.getByText(/Enter this code on Microsoft's sign-in page/i)
    ).toBeInTheDocument()
    expect(screen.getByText('ABCD1234')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /copy code/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open in browser/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /stop signing in/i })
    ).toBeInTheDocument()
  })

  it('code block has mono + tracking + text-2xl + semibold + aria-live', () => {
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'ABCD1234',
        verificationUri: 'u',
        expiresInSec: 900,
        receivedAt: Date.now()
      }
    })
    render(<DeviceCodeModal />)
    const codeEl = screen.getByText('ABCD1234')
    expect(codeEl.className).toMatch(/font-mono/)
    expect(codeEl.className).toMatch(/tracking-\[0\.15em\]/)
    expect(codeEl.className).toMatch(/text-2xl/)
    expect(codeEl.className).toMatch(/font-semibold/)
    expect(codeEl).toHaveAttribute('aria-live', 'polite')
    expect(codeEl.getAttribute('aria-label')).toMatch(/^Your sign-in code:/)
  })

  it('Copy code invokes clipboard with the code', async () => {
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'ABCD1234',
        verificationUri: 'u',
        expiresInSec: 900,
        receivedAt: Date.now()
      }
    })
    render(<DeviceCodeModal />)
    fireEvent.click(screen.getByRole('button', { name: /copy code/i }))
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith('ABCD1234')
    })
  })

  it('Open in browser opens the verificationUri with _blank', () => {
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'A',
        verificationUri: 'https://microsoft.com/link',
        expiresInSec: 900,
        receivedAt: Date.now()
      }
    })
    render(<DeviceCodeModal />)
    fireEvent.click(screen.getByRole('button', { name: /open in browser/i }))
    expect(windowOpen).toHaveBeenCalledWith(
      'https://microsoft.com/link',
      '_blank',
      'noopener'
    )
  })

  it('Stop signing in calls cancelLogin → state becomes logged-out', async () => {
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'A',
        verificationUri: 'u',
        expiresInSec: 900,
        receivedAt: Date.now()
      }
    })
    render(<DeviceCodeModal />)
    fireEvent.click(screen.getByRole('button', { name: /stop signing in/i }))
    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalled()
    })
    expect(useAuthStore.getState().state).toBe('logged-out')
    expect(useAuthStore.getState().deviceCode).toBeUndefined()
  })

  it('expired state shows "expired" body + Generate new code + Stop signing in', () => {
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'A',
        verificationUri: 'u',
        expiresInSec: 1,
        // 60s ago → well past 1s expiry
        receivedAt: Date.now() - 60_000
      }
    })
    render(<DeviceCodeModal />)
    expect(
      screen.getByText(/code expired before you finished signing in/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /generate new code/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /stop signing in/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /copy code/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /open in browser/i })
    ).not.toBeInTheDocument()
  })

  it('Generate new code fires store.login (after cancel to clear concurrent-login guard)', async () => {
    useAuthStore.setState({
      state: 'logging-in',
      deviceCode: {
        userCode: 'A',
        verificationUri: 'u',
        expiresInSec: 1,
        receivedAt: Date.now() - 60_000
      }
    })
    render(<DeviceCodeModal />)
    fireEvent.click(
      screen.getByRole('button', { name: /generate new code/i })
    )
    // handleGenerateNew is async: cancel (awaits logout) → then login.
    // Use waitFor to let both awaited calls resolve.
    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalled()
    })
  })
})
