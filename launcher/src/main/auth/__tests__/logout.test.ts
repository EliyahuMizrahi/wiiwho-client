import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tmpUserData: string
let encryptionAvailable = true

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

vi.mock('prismarine-auth', () => ({ Authflow: class {} }))

import { getAuthManager, __test__ } from '../AuthManager'

beforeEach(async () => {
  tmpUserData = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiwho-logout-'))
  encryptionAvailable = true
  __test__.resetSingleton()
})

afterEach(async () => {
  try {
    await fs.rm(tmpUserData, { recursive: true, force: true })
  } catch {
    // ignore
  }
})

describe('AuthManager.logout — AUTH-06', () => {
  it('removes cache files under auth/primary/ and clears activeAccountId', async () => {
    // Seed: write some "cached" files as if prismarine-auth had persisted them.
    const primaryDir = path.join(tmpUserData, 'auth', 'primary')
    await fs.mkdir(primaryDir, { recursive: true })
    await fs.writeFile(
      path.join(primaryDir, 'msa.bin'),
      Buffer.from('ENC::fake-msa')
    )
    await fs.writeFile(
      path.join(primaryDir, 'xbl.bin'),
      Buffer.from('ENC::fake-xbl')
    )
    await fs.writeFile(
      path.join(primaryDir, 'mca.bin'),
      Buffer.from('ENC::fake-mca')
    )
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

    const res = await getAuthManager().logout()
    expect(res).toEqual({ ok: true })

    // Cache dir for primary gone
    await expect(fs.stat(primaryDir)).rejects.toThrow()

    // Pointer no longer has the account
    const after = JSON.parse(
      await fs.readFile(path.join(tmpUserData, 'auth.bin'), 'utf8')
    )
    expect(after.activeAccountId).toBeNull()
    expect(after.accounts).toEqual([])

    // Status cleared
    expect(getAuthManager().getStatus()).toEqual({ loggedIn: false })
  })

  it('logout with nothing logged in resolves {ok: true}', async () => {
    const res = await getAuthManager().logout()
    expect(res).toEqual({ ok: true })
  })
})
