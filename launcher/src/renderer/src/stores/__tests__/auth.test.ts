/**
 * @vitest-environment jsdom
 *
 * Renderer-side auth store — Zustand state machine tests.
 *
 * Covers:
 *   - initial state, initialize() happy paths (both logged-in and logged-out)
 *   - initialize() idempotency (does not re-invoke status() on repeat calls)
 *   - login happy path, login error path (with parsed AuthErrorView), login with
 *     malformed JSON error string, concurrent login guard, retry-after-error
 *   - logout clears username/uuid
 *   - dismissError clears error + resets state to logged-out
 *   - __CANCELLED__ sentinel short-circuit (UI-SPEC line 216 guardrail)
 *
 * Environment: jsdom (set via docblock pragma above — vitest 4 honours this
 * even if the config-level environmentMatchGlobs shape drifts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

type AuthAPI = {
  status: ReturnType<typeof vi.fn>
  login: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  onDeviceCode: ReturnType<typeof vi.fn>
}

const authApi: AuthAPI = {
  status: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  onDeviceCode: vi.fn(() => () => {})
}

// Test harness shim — jsdom already provides `window`, we only graft our
// `wiiwho` namespace onto it so the store's calls through window.wiiwho.auth.*
// hit these vi.fn mocks.
;(globalThis as unknown as { window: { wiiwho: { auth: AuthAPI } } }).window.wiiwho = {
  auth: authApi
} as never

import { useAuthStore } from '../auth'

function resetStore(): void {
  useAuthStore.setState({
    state: 'loading',
    initialized: false,
    username: undefined,
    uuid: undefined,
    error: undefined
  })
}

describe('useAuthStore', () => {
  beforeEach(() => {
    authApi.status.mockReset()
    authApi.login.mockReset()
    authApi.logout.mockReset()
    resetStore()
  })

  it('initial state is "loading"', () => {
    expect(useAuthStore.getState().state).toBe('loading')
  })

  it('initialize -> logged-out when status says not logged in', async () => {
    authApi.status.mockResolvedValue({ loggedIn: false })
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().state).toBe('logged-out')
  })

  it('initialize -> logged-in with username+uuid', async () => {
    authApi.status.mockResolvedValue({
      loggedIn: true,
      username: 'Alice',
      uuid: 'uuid32'
    })
    await useAuthStore.getState().initialize()
    const s = useAuthStore.getState()
    expect(s.state).toBe('logged-in')
    expect(s.username).toBe('Alice')
    expect(s.uuid).toBe('uuid32')
  })

  it('initialize is idempotent - second call does not re-invoke status()', async () => {
    authApi.status.mockResolvedValue({ loggedIn: false })
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().initialize()
    expect(authApi.status).toHaveBeenCalledTimes(1)
  })

  it('login happy path transitions logging-in -> logged-in', async () => {
    authApi.status
      .mockResolvedValueOnce({ loggedIn: false })
      .mockResolvedValueOnce({ loggedIn: true, username: 'Alice', uuid: 'uuid32' })
    authApi.login.mockResolvedValue({ ok: true, username: 'Alice' })

    await useAuthStore.getState().initialize()
    await useAuthStore.getState().login()
    const s = useAuthStore.getState()
    expect(s.state).toBe('logged-in')
    expect(s.username).toBe('Alice')
    expect(s.uuid).toBe('uuid32')
  })

  it('login error -> error state with parsed AuthErrorView', async () => {
    authApi.status.mockResolvedValue({ loggedIn: false })
    authApi.login.mockResolvedValue({
      ok: false,
      error: JSON.stringify({
        code: 2148916233,
        message: 'no Xbox',
        helpUrl: 'https://www.xbox.com/en-US/live'
      })
    })
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().login()
    const s = useAuthStore.getState()
    expect(s.state).toBe('error')
    expect(s.error).toEqual({
      code: 2148916233,
      message: 'no Xbox',
      helpUrl: 'https://www.xbox.com/en-US/live'
    })
  })

  it('login error with malformed JSON falls back to raw message', async () => {
    authApi.status.mockResolvedValue({ loggedIn: false })
    authApi.login.mockResolvedValue({ ok: false, error: 'not-json-blob' })
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().login()
    const s = useAuthStore.getState()
    expect(s.state).toBe('error')
    expect(s.error).toEqual({
      code: null,
      message: 'not-json-blob',
      helpUrl: null
    })
  })

  it('dismissError from error state -> logged-out, error cleared', async () => {
    authApi.status.mockResolvedValue({ loggedIn: false })
    authApi.login.mockResolvedValue({
      ok: false,
      error: JSON.stringify({ message: 'x' })
    })
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().login()
    useAuthStore.getState().dismissError()
    const s = useAuthStore.getState()
    expect(s.state).toBe('logged-out')
    expect(s.error).toBeUndefined()
  })

  it('retry after error -> logging-in -> logged-in', async () => {
    authApi.status
      .mockResolvedValueOnce({ loggedIn: false })
      .mockResolvedValueOnce({ loggedIn: true, username: 'Alice', uuid: 'uuid32' })
    authApi.login
      .mockResolvedValueOnce({
        ok: false,
        error: JSON.stringify({ message: 'fail' })
      })
      .mockResolvedValueOnce({ ok: true, username: 'Alice' })
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().login()
    expect(useAuthStore.getState().state).toBe('error')
    await useAuthStore.getState().login()
    expect(useAuthStore.getState().state).toBe('logged-in')
  })

  it('logout from logged-in -> logged-out, username/uuid cleared', async () => {
    authApi.status.mockResolvedValue({
      loggedIn: true,
      username: 'Alice',
      uuid: 'uuid32'
    })
    authApi.logout.mockResolvedValue({ ok: true })
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.state).toBe('logged-out')
    expect(s.username).toBeUndefined()
    expect(s.uuid).toBeUndefined()
  })

  it('concurrent login calls: second is a no-op while first is pending', async () => {
    authApi.status.mockResolvedValue({ loggedIn: false })
    let resolveFirst: (v: { ok: boolean; username?: string }) => void = () => {}
    authApi.login.mockReturnValueOnce(
      new Promise((r) => {
        resolveFirst = r
      })
    )
    await useAuthStore.getState().initialize()
    const p1 = useAuthStore.getState().login()
    // While p1 is in flight (state 'logging-in'), fire a second login():
    const p2 = useAuthStore.getState().login()
    expect(authApi.login).toHaveBeenCalledTimes(1)
    authApi.status.mockResolvedValueOnce({
      loggedIn: true,
      username: 'Alice',
      uuid: 'u'
    })
    resolveFirst({ ok: true, username: 'Alice' })
    await Promise.all([p1, p2])
  })

  it('auth.cancelled transitions to logged-out (UI-SPEC line 216 - no banner, silent return)', async () => {
    authApi.status.mockResolvedValue({ loggedIn: false })
    // Plan 03 cancel branch returns the __CANCELLED__ sentinel AuthErrorView.
    // IPC handler JSON-stringifies it, so the renderer sees this exact payload.
    authApi.login.mockResolvedValue({
      ok: false,
      error: JSON.stringify({
        code: null,
        message: '__CANCELLED__',
        helpUrl: null
      })
    })
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().login()

    const s = useAuthStore.getState()
    // Silent return: state is logged-out, NOT error
    expect(s.state).toBe('logged-out')
    // Critical: error is undefined - if it were set, ErrorBanner would render
    // a banner saying "__CANCELLED__" to the user. This assertion is the
    // guardrail that enforces UI-SPEC line 216.
    expect(s.error).toBeUndefined()
    expect(s.username).toBeUndefined()
    expect(s.uuid).toBeUndefined()
  })

  describe('deviceCode + cancelLogin', () => {
    it('setDeviceCode populates with receivedAt', () => {
      const before = Date.now()
      useAuthStore.getState().setDeviceCode({
        userCode: 'ABCD-1234',
        verificationUri: 'https://microsoft.com/link',
        expiresInSec: 900
      })
      const dc = useAuthStore.getState().deviceCode!
      expect(dc.userCode).toBe('ABCD-1234')
      expect(dc.verificationUri).toBe('https://microsoft.com/link')
      expect(dc.expiresInSec).toBe(900)
      expect(dc.receivedAt).toBeGreaterThanOrEqual(before)
    })

    it('clearDeviceCode removes the field', () => {
      useAuthStore.getState().setDeviceCode({
        userCode: 'A',
        verificationUri: 'u',
        expiresInSec: 1
      })
      useAuthStore.getState().clearDeviceCode()
      expect(useAuthStore.getState().deviceCode).toBeUndefined()
    })

    it('login success clears deviceCode', async () => {
      authApi.status
        .mockResolvedValueOnce({ loggedIn: false })
        .mockResolvedValueOnce({ loggedIn: true, username: 'A', uuid: 'u' })
      authApi.login.mockResolvedValue({ ok: true, username: 'A' })
      await useAuthStore.getState().initialize()
      useAuthStore.getState().setDeviceCode({
        userCode: 'X',
        verificationUri: 'u',
        expiresInSec: 1
      })
      await useAuthStore.getState().login()
      expect(useAuthStore.getState().deviceCode).toBeUndefined()
    })

    it('login error clears deviceCode', async () => {
      authApi.status.mockResolvedValue({ loggedIn: false })
      authApi.login.mockResolvedValue({
        ok: false,
        error: JSON.stringify({ message: 'x' })
      })
      await useAuthStore.getState().initialize()
      useAuthStore.getState().setDeviceCode({
        userCode: 'X',
        verificationUri: 'u',
        expiresInSec: 1
      })
      await useAuthStore.getState().login()
      expect(useAuthStore.getState().deviceCode).toBeUndefined()
    })

    it('cancelLogin calls logout + resets store + clears deviceCode', async () => {
      authApi.logout.mockResolvedValue({ ok: true })
      useAuthStore.setState({
        state: 'logging-in',
        deviceCode: {
          userCode: 'X',
          verificationUri: 'u',
          expiresInSec: 1,
          receivedAt: 1
        }
      })
      await useAuthStore.getState().cancelLogin()
      expect(authApi.logout).toHaveBeenCalled()
      const s = useAuthStore.getState()
      expect(s.state).toBe('logged-out')
      expect(s.deviceCode).toBeUndefined()
    })
  })
})
