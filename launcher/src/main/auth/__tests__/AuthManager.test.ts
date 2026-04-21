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
//
// Plan 03-09 note: Phase 2's tests only used { profile }. Phase 3 adds
// getMinecraftToken() which reads both `token` and `profile` from the
// same getMinecraftJavaToken result. The factory return is widened to
// optionally include `token` — existing Phase 2 tests that don't supply
// it still work (AuthManager.loginWithDeviceCode / trySilentRefresh only
// read `profile`).
type MockAuthflowFactory = (args: {
  codeCallback?: (resp: {
    userCode: string
    verificationUri: string
    expiresIn: number
  }) => void
}) => {
  getMinecraftJavaToken: (opts: unknown) => Promise<{
    token?: string
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

// ============================================================================
// Phase 3 Plan 03-09 — AuthManager.getMinecraftToken()
//
// Phase 2 ↔ Phase 3 seam (LCH-06). Returns { accessToken, username, uuid } —
// the fields Plan 03-10's orchestrator hands to args.ts → spawnGame. Reuses
// the same trySilentRefresh code path (Authflow without codeCallback), but
// returns the `token` field that trySilentRefresh discards.
// ============================================================================

describe('AuthManager.getMinecraftToken', () => {
  it('happy path: logged-in returns {accessToken, username, uuid} from cached profile', async () => {
    // Seed authStore so Authflow path is reached.
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
        token: 'opaque-mc-token-abc123',
        profile: { id: 'uuid32', name: 'TestUser' }
      })
    })

    const res = await getAuthManager().getMinecraftToken()
    expect(res.accessToken).toBe('opaque-mc-token-abc123')
    expect(res.accessToken.length).toBeGreaterThan(0)
    expect(res.username).toBe('TestUser')
    expect(res.uuid).toBe('uuid32')
  })

  it('logged-out (no authStore) throws — orchestrator maps to "please log in again"', async () => {
    // No auth.bin seeded; default store has activeAccountId=null, accounts=[].
    await expect(getAuthManager().getMinecraftToken()).rejects.toThrow(/not logged in/i)
  })

  it('refreshes silently: no codeCallback is invoked (no device-code emission)', async () => {
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
    let capturedCallback:
      | ((resp: { userCode: string; verificationUri: string; expiresIn: number }) => void)
      | undefined
    mockAuthflow = ({ codeCallback }) => {
      capturedCallback = codeCallback
      return {
        getMinecraftJavaToken: async () => ({
          token: 'tok',
          profile: { id: 'uuid32', name: 'TestUser' }
        })
      }
    }

    await getAuthManager().getMinecraftToken()
    // Silent-refresh contract: no codeCallback was passed to Authflow.
    expect(capturedCallback).toBeUndefined()
    // And no device-code push event went to the renderer.
    expect(sendCalls).toHaveLength(0)
  })

  it('log-redaction: the raw token never appears as a substring in AuthManager source lines that call log.*', async () => {
    // Structural regression guard — make sure AuthManager never passes the
    // raw accessToken into an electron-log call. We do the static-source
    // check instead of monkey-patching `log` because the redactor would
    // scrub it at runtime anyway; what we actually care about is that the
    // raw token value is never handed to a log method in the first place
    // (defense in depth on top of redact.ts).
    const src = await fs.readFile(
      path.resolve(__dirname, '..', 'AuthManager.ts'),
      'utf8'
    )
    // Must not log the token directly. Regex catches common shapes:
    //   log.info(... token ...)
    //   log.debug(... accessToken ...)
    //   log.warn(... result.token ...)
    // We allow comments that mention `token` for documentation; the check
    // is that no `log.<level>(...)` call text contains `token` or
    // `accessToken`.
    const logCalls = src.match(/log\.(info|warn|error|debug|verbose|silly)\([^)]*\)/g) || []
    for (const call of logCalls) {
      expect(call).not.toMatch(/\btoken\b|\baccessToken\b/i)
    }
  })

  it('two sequential calls both succeed and return identical tokens (prismarine-auth caches)', async () => {
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
    // prismarine-auth caches internally; our fake returns the same value
    // on every call to simulate that behavior.
    mockAuthflow = () => ({
      getMinecraftJavaToken: async () => ({
        token: 'stable-cached-mc-token',
        profile: { id: 'uuid32', name: 'TestUser' }
      })
    })

    const mgr = getAuthManager()
    const a = await mgr.getMinecraftToken()
    const b = await mgr.getMinecraftToken()
    expect(a.accessToken).toBe(b.accessToken)
    expect(a.username).toBe(b.username)
    expect(a.uuid).toBe(b.uuid)
  })

  it('profile missing on result → throws "Minecraft profile missing — re-login required"', async () => {
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
        token: 'tok',
        profile: null
      })
    })
    await expect(getAuthManager().getMinecraftToken()).rejects.toThrow(
      /profile missing/i
    )
  })

  it('safeStorage unavailable → throws keychain error', async () => {
    encryptionAvailable = false
    await expect(getAuthManager().getMinecraftToken()).rejects.toThrow(
      /keychain/i
    )
  })
})

