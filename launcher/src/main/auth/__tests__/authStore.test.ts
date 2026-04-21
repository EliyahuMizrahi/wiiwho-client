import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tmpUserData: string

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key === 'userData') return tmpUserData
      throw new Error('unexpected getPath key: ' + key)
    }
  }
}))

// Import AFTER vi.mock is registered
import {
  readAuthStore,
  writeAuthStore,
  clearActiveAccount,
  resolveAuthStorePath,
  AuthStoreV1
} from '../authStore'

beforeEach(async () => {
  tmpUserData = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiwho-store-'))
})

afterEach(async () => {
  try {
    await fs.rm(tmpUserData, { recursive: true, force: true })
  } catch {
    // ignore
  }
})

describe('readAuthStore', () => {
  it('returns default when file does not exist', async () => {
    const s = await readAuthStore()
    expect(s).toEqual({ version: 1, activeAccountId: null, accounts: [] })
  })

  it('throws on corrupt JSON', async () => {
    await fs.writeFile(resolveAuthStorePath(), 'not json {{{')
    await expect(readAuthStore()).rejects.toThrow()
  })
})

describe('writeAuthStore + round-trip', () => {
  it('writes JSON (not encrypted) and round-trips exactly', async () => {
    const store: AuthStoreV1 = {
      version: 1,
      activeAccountId: 'abc123',
      accounts: [
        { id: 'abc123', username: 'Alice', lastUsed: '2026-04-21T00:00:00Z' }
      ]
    }
    await writeAuthStore(store)
    const raw = await fs.readFile(resolveAuthStorePath(), 'utf8')
    expect(raw).toContain('"version":1')
    expect(raw).toContain('Alice')
    const round = await readAuthStore()
    expect(round).toEqual(store)
  })

  it('uses temp-file + rename (no stray .tmp)', async () => {
    await writeAuthStore({
      version: 1,
      activeAccountId: null,
      accounts: []
    })
    const tmpPath = resolveAuthStorePath() + '.tmp'
    await expect(fs.stat(tmpPath)).rejects.toThrow()
  })

  it('rejects version !== 1', async () => {
    await expect(
      writeAuthStore({
        version: 2 as 1,
        activeAccountId: null,
        accounts: []
      })
    ).rejects.toThrow(/unsupported version/)
  })

  it('rejects accounts.length > 1 (v0.1 D-16)', async () => {
    await expect(
      writeAuthStore({
        version: 1,
        activeAccountId: null,
        accounts: [
          { id: 'a', username: 'A', lastUsed: 't' },
          { id: 'b', username: 'B', lastUsed: 't' }
        ]
      })
    ).rejects.toThrow(/at most 1 account/)
  })

  it('rejects account missing id', async () => {
    await expect(
      writeAuthStore({
        version: 1,
        activeAccountId: null,
        accounts: [
          // @ts-expect-error intentional malformed shape
          { username: 'A', lastUsed: 't' }
        ]
      })
    ).rejects.toThrow(/account.id/)
  })

  it('rejects account with token-related key (D-17)', async () => {
    await expect(
      writeAuthStore({
        version: 1,
        activeAccountId: null,
        accounts: [
          // @ts-expect-error intentional malformed shape — token leak attempt
          { id: 'a', username: 'A', lastUsed: 't', refreshToken: 'LEAK' }
        ]
      })
    ).rejects.toThrow(/token-related key/i)
  })

  it('rejects activeAccountId that is not in accounts[]', async () => {
    await expect(
      writeAuthStore({
        version: 1,
        activeAccountId: 'ghost',
        accounts: []
      })
    ).rejects.toThrow(/not present in accounts/)
  })
})

describe('clearActiveAccount', () => {
  it('removes active account entry and nulls activeAccountId', async () => {
    await writeAuthStore({
      version: 1,
      activeAccountId: 'abc123',
      accounts: [
        { id: 'abc123', username: 'Alice', lastUsed: '2026-04-21T00:00:00Z' }
      ]
    })
    await clearActiveAccount()
    const after = await readAuthStore()
    expect(after.activeAccountId).toBeNull()
    expect(after.accounts).toEqual([])
  })

  it('no-op when no active account', async () => {
    await writeAuthStore({
      version: 1,
      activeAccountId: null,
      accounts: []
    })
    await expect(clearActiveAccount()).resolves.toBeUndefined()
  })
})

describe('resolveAuthStorePath', () => {
  it('points to auth.bin in userData', () => {
    expect(resolveAuthStorePath()).toBe(path.join(tmpUserData, 'auth.bin'))
  })
})
