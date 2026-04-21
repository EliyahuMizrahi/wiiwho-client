import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// --- Mutable mock state ---
let tmpUserData: string
let encryptionAvailable = true
const sendCalls: Array<{ channel: string; payload: unknown }> = []
const mockWin = {
  webContents: {
    send: (channel: string, payload: unknown): void => {
      sendCalls.push({ channel, payload })
    }
  }
}

// Mock Authflow. Each test sets mockAuthflow to a factory that returns
// the behavior the test wants.
type MockAuthflowFactory = (args: {
  codeCallback?: (resp: {
    userCode: string
    verificationUri: string
    expiresIn: number
  }) => void
}) => {
  getMinecraftJavaToken: (opts: unknown) => Promise<{
    profile: { id: string; name: string } | null
  }>
}

let mockAuthflow: MockAuthflowFactory = () => ({
  getMinecraftJavaToken: async () => ({
    profile: { id: 'DEFAULT-UUID', name: 'Default' }
  })
})

vi.mock('electron', () => ({
  app: {
    getPath: (k: string): string => {
      if (k === 'userData') return tmpUserData
      throw new Error('unexpected getPath')
    }
  },
  safeStorage: {
    isEncryptionAvailable: (): boolean => encryptionAvailable,
    encryptString: (s: string): Buffer => Buffer.from('ENC::' + s, 'utf8'),
    decryptString: (b: Buffer): string => {
      const str = b.toString('utf8')
      if (!str.startsWith('ENC::')) throw new Error('bad enc')
      return str.slice(5)
    }
  }
}))

vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    hooks: { push: vi.fn() }
  }
}))

vi.mock('prismarine-auth', () => ({
  Authflow: class {
    getMinecraftJavaToken: (opts: unknown) => Promise<{
      profile: { id: string; name: string } | null
    }>
    constructor(
      _username: string,
      _cacheDirFn: unknown,
      _options: unknown,
      codeCallback?: (resp: {
        userCode: string
        verificationUri: string
        expiresIn: number
      }) => void
    ) {
      const impl = mockAuthflow({ codeCallback })
      this.getMinecraftJavaToken = impl.getMinecraftJavaToken
      if (codeCallback) {
        // Fire the default canned code immediately. Tests that need a custom
        // code-callback shape can override mockAuthflow in the test body.
        queueMicrotask(() =>
          codeCallback({
            userCode: 'ABCD-1234',
            verificationUri: 'https://microsoft.com/link',
            expiresIn: 900
          })
        )
      }
    }
  }
}))

import { getAuthManager, __test__ } from '../AuthManager'

beforeEach(async () => {
  tmpUserData = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiwho-am-'))
  encryptionAvailable = true
  sendCalls.length = 0
  __test__.resetSingleton()
  mockAuthflow = () => ({
    getMinecraftJavaToken: async () => ({
      profile: { id: 'uuid32', name: 'TestUser' }
    })
  })
})

afterEach(async () => {
  try {
    await fs.rm(tmpUserData, { recursive: true, force: true })
  } catch {
    // ignore
  }
})

describe('AuthManager.loginWithDeviceCode', () => {
  it('happy path: resolves {ok, username, uuid} and emits auth:device-code once', async () => {
    const mgr = getAuthManager()
    const res = await mgr.loginWithDeviceCode(mockWin as never)
    expect(res).toEqual({ ok: true, username: 'TestUser', uuid: 'uuid32' })
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0].channel).toBe('auth:device-code')
    expect(sendCalls[0].payload).toEqual({
      userCode: 'ABCD-1234',
      verificationUri: 'https://microsoft.com/link',
      expiresInSec: 900
    })
  })

  it('persists activeAccountId + account row in authStore', async () => {
    await getAuthManager().loginWithDeviceCode(mockWin as never)
    const raw = await fs.readFile(path.join(tmpUserData, 'auth.bin'), 'utf8')
    const store = JSON.parse(raw)
    expect(store.activeAccountId).toBe('uuid32')
    expect(store.accounts[0].username).toBe('TestUser')
    expect(raw).not.toMatch(/refreshToken|access_token|eyJ/i)
  })

  it('XSTS 2148916233 → mapped error view; authStore untouched', async () => {
    mockAuthflow = () => ({
      getMinecraftJavaToken: async () => {
        throw new Error('2148916233: no Xbox profile')
      }
    })
    const res = await getAuthManager().loginWithDeviceCode(mockWin as never)
    expect(res.ok).toBe(false)
    expect(res.error?.code).toBe(2148916233)
    expect(res.error?.helpUrl).toBe('https://www.xbox.com/en-US/live')

    // authStore untouched — file should not exist or activeAccountId null
    try {
      const raw = await fs.readFile(path.join(tmpUserData, 'auth.bin'), 'utf8')
      const store = JSON.parse(raw)
      expect(store.activeAccountId).toBeNull()
    } catch (e) {
      expect((e as NodeJS.ErrnoException).code).toBe('ENOENT')
    }
  })

  it('profile null → NO_MC_PROFILE mapped to purchase page', async () => {
    mockAuthflow = () => ({
      getMinecraftJavaToken: async () => ({ profile: null })
    })
    const res = await getAuthManager().loginWithDeviceCode(mockWin as never)
    expect(res.ok).toBe(false)
    expect(res.error?.helpUrl).toMatch(/minecraft\.net/)
  })

  it('network error → null helpUrl, token NOT cleared (D-12)', async () => {
    mockAuthflow = () => ({
      getMinecraftJavaToken: async () => {
        const e = new Error('fetch failed') as NodeJS.ErrnoException
        e.code = 'ENOTFOUND'
        throw e
      }
    })
    const res = await getAuthManager().loginWithDeviceCode(mockWin as never)
    expect(res.ok).toBe(false)
    expect(res.error?.helpUrl).toBeNull()
    expect(res.error?.message).toMatch(/check your internet connection/i)
  })

  it('device-code emitted BEFORE the error', async () => {
    mockAuthflow = () => ({
      getMinecraftJavaToken: async () => {
        throw new Error('2148916233: fail')
      }
    })
    const res = await getAuthManager().loginWithDeviceCode(mockWin as never)
    expect(res.ok).toBe(false)
    // First send call must be the device-code push, even though login failed.
    expect(sendCalls[0]?.channel).toBe('auth:device-code')
  })

  it('safeStorage unavailable → keychain error, no codeCallback', async () => {
    encryptionAvailable = false
    const res = await getAuthManager().loginWithDeviceCode(mockWin as never)
    expect(res.ok).toBe(false)
    expect(res.error?.message).toMatch(/keychain/i)
    expect(sendCalls).toHaveLength(0)
  })
})

describe('AuthManager.cancelDeviceCode', () => {
  it('aborts in-flight login → returns exact __CANCELLED__ sentinel (UI-SPEC line 216)', async () => {
    // Make getMinecraftJavaToken never resolve on its own:
    mockAuthflow = () => ({
      getMinecraftJavaToken: () => new Promise(() => {})
    })
    const mgr = getAuthManager()
    const p = mgr.loginWithDeviceCode(mockWin as never)
    // Let codeCallback fire first
    await new Promise((r) => setTimeout(r, 5))
    await mgr.cancelDeviceCode()
    const res = await p

    // LOCKED contract: cancel returns the exact sentinel AuthErrorView.
    // Renderer store (Plan 04) short-circuits on message === '__CANCELLED__'
    // to deliver "no banner — silent return to LoginScreen" (UI-SPEC line 216).
    expect(res.ok).toBe(false)
    expect(res.error).toBeDefined()
    expect(res.error?.message).toBe('__CANCELLED__')
    expect(res.error?.code).toBeNull()
    expect(res.error?.helpUrl).toBeNull()
    expect(mgr.getStatus()).toEqual({ loggedIn: false })
  })
})

describe('AuthManager.trySilentRefresh', () => {
  it('no stored account → null', async () => {
    const res = await getAuthManager().trySilentRefresh()
    expect(res).toBeNull()
  })

  it('with stored account → returns {username, uuid}, no device-code emitted', async () => {
    // Seed the authStore + cache dir so silent refresh has something to load.
    await fs.mkdir(path.join(tmpUserData, 'auth', 'primary'), {
      recursive: true
    })
    await fs.writeFile(
      path.join(tmpUserData, 'auth.bin'),
      JSON.stringify({
        version: 1,
        activeAccountId: 'uuid32',
        accounts: [
          { id: 'uuid32', username: 'TestUser', lastUsed: '2026-04-21T00:00:00Z' }
        ]
      })
    )
    mockAuthflow = () => ({
      getMinecraftJavaToken: async () => ({
        profile: { id: 'uuid32', name: 'TestUser' }
      })
    })
    const res = await getAuthManager().trySilentRefresh()
    expect(res).toEqual({ username: 'TestUser', uuid: 'uuid32' })
    expect(sendCalls).toHaveLength(0)
  })

  it('failure clears state quietly (D-03)', async () => {
    await fs.writeFile(
      path.join(tmpUserData, 'auth.bin'),
      JSON.stringify({
        version: 1,
        activeAccountId: 'uuid32',
        accounts: [
          { id: 'uuid32', username: 'TestUser', lastUsed: '2026-04-21T00:00:00Z' }
        ]
      })
    )
    mockAuthflow = () => ({
      getMinecraftJavaToken: async () => {
        throw new Error('kaboom')
      }
    })
    const res = await getAuthManager().trySilentRefresh()
    expect(res).toBeNull()
    const after = JSON.parse(
      await fs.readFile(path.join(tmpUserData, 'auth.bin'), 'utf8')
    )
    expect(after.activeAccountId).toBeNull()
  })

  it('safeStorage unavailable → null, no Authflow call', async () => {
    encryptionAvailable = false
    const res = await getAuthManager().trySilentRefresh()
    expect(res).toBeNull()
  })
})

describe('AuthManager.getStatus + singleton', () => {
  it('after login, getStatus returns {loggedIn: true, ...}', async () => {
    const mgr = getAuthManager()
    await mgr.loginWithDeviceCode(mockWin as never)
    expect(mgr.getStatus()).toEqual({
      loggedIn: true,
      username: 'TestUser',
      uuid: 'uuid32'
    })
  })

  it('getAuthManager returns same instance across calls', () => {
    expect(getAuthManager()).toBe(getAuthManager())
  })
})
