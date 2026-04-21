import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  BrowserWindow: class {},
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

const authManagerMock = {
  getStatus: vi.fn(),
  loginWithDeviceCode: vi.fn(),
  logout: vi.fn(),
  cancelDeviceCode: vi.fn()
}

vi.mock('../auth/AuthManager', () => ({
  getAuthManager: () => authManagerMock
}))

import { registerAuthHandlers } from './auth'

const fakeWin = {} as never
registerAuthHandlers(() => fakeWin)

describe('auth IPC handlers (Phase 2)', () => {
  beforeEach(() => {
    authManagerMock.getStatus.mockReset()
    authManagerMock.loginWithDeviceCode.mockReset()
    authManagerMock.logout.mockReset()
    authManagerMock.cancelDeviceCode.mockReset()
  })

  it('auth:status → {loggedIn: false} when logged out', async () => {
    authManagerMock.getStatus.mockReturnValue({ loggedIn: false })
    const r = await handlers.get('auth:status')?.()
    expect(r).toEqual({ loggedIn: false })
  })

  it('auth:status → {loggedIn, username, uuid} when logged in', async () => {
    authManagerMock.getStatus.mockReturnValue({
      loggedIn: true,
      username: 'Alice',
      uuid: 'uuid32'
    })
    const r = await handlers.get('auth:status')?.()
    expect(r).toEqual({ loggedIn: true, username: 'Alice', uuid: 'uuid32' })
  })

  it('auth:login success → {ok: true, username}', async () => {
    authManagerMock.loginWithDeviceCode.mockResolvedValue({
      ok: true,
      username: 'Alice',
      uuid: 'uuid32'
    })
    const r = (await handlers.get('auth:login')?.()) as {
      ok: boolean
      username?: string
    }
    expect(r.ok).toBe(true)
    expect(r.username).toBe('Alice')
    expect(authManagerMock.loginWithDeviceCode).toHaveBeenCalledWith(fakeWin)
  })

  it('auth:login failure → {ok: false, error: JSON string}', async () => {
    authManagerMock.loginWithDeviceCode.mockResolvedValue({
      ok: false,
      error: {
        code: 2148916233,
        message: 'no Xbox profile',
        helpUrl: 'https://www.xbox.com/en-US/live'
      }
    })
    const r = (await handlers.get('auth:login')?.()) as {
      ok: boolean
      error?: string
    }
    expect(r.ok).toBe(false)
    const parsed = JSON.parse(r.error as string)
    expect(parsed.code).toBe(2148916233)
    expect(parsed.helpUrl).toBe('https://www.xbox.com/en-US/live')
  })

  it('auth:login cancelled → {ok: false, error: JSON string carrying __CANCELLED__}', async () => {
    authManagerMock.loginWithDeviceCode.mockResolvedValue({
      ok: false,
      error: { code: null, message: '__CANCELLED__', helpUrl: null }
    })
    const r = (await handlers.get('auth:login')?.()) as {
      ok: boolean
      error?: string
    }
    expect(r.ok).toBe(false)
    const parsed = JSON.parse(r.error as string)
    expect(parsed.message).toBe('__CANCELLED__')
    expect(parsed.code).toBeNull()
    expect(parsed.helpUrl).toBeNull()
  })

  it('auth:logout → cancels pending + logs out', async () => {
    authManagerMock.cancelDeviceCode.mockResolvedValue(undefined)
    authManagerMock.logout.mockResolvedValue({ ok: true })
    const r = await handlers.get('auth:logout')?.()
    expect(r).toEqual({ ok: true })
    expect(authManagerMock.cancelDeviceCode).toHaveBeenCalled()
    expect(authManagerMock.logout).toHaveBeenCalled()
  })

  it('auth:login returns error when no primary window', async () => {
    // Simulate: rebuild with a null-returning getter
    handlers.clear()
    registerAuthHandlers(() => null)
    const r = (await handlers.get('auth:login')?.()) as {
      ok: boolean
      error?: string
    }
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/window/i)
  })
})
