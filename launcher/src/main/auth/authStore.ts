/**
 * Non-secret auth.bin pointer file.
 *
 * Per RESEARCH.md Option B (§Pattern 1 note): prismarine-auth writes its encrypted
 * per-cache-name files under `<userData>/auth/<username>/*.bin`. This module owns
 * the separate non-secret pointer at `<userData>/auth.bin` carrying only:
 *   { version, activeAccountId, accounts: [{id, username, lastUsed}] }
 *
 * The pointer holds no token material. Any attempt to write a shape containing
 * token-looking keys is rejected at the write boundary.
 *
 * v0.1 enforces `accounts.length <= 1` (D-16). v0.3+ relaxes this for account
 * switcher UX without schema migration.
 */

import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface AuthStoreV1 {
  version: 1
  activeAccountId: string | null
  accounts: Array<{
    id: string
    username: string
    lastUsed: string // ISO-8601
  }>
}

const DEFAULT_STORE: AuthStoreV1 = {
  version: 1,
  activeAccountId: null,
  accounts: []
}

export function resolveAuthStorePath(): string {
  return path.join(app.getPath('userData'), 'auth.bin')
}

export async function readAuthStore(): Promise<AuthStoreV1> {
  const p = resolveAuthStorePath()
  let raw: string
  try {
    raw = await fs.readFile(p, 'utf8')
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_STORE, accounts: [] }
    }
    throw e
  }
  const parsed = JSON.parse(raw) as AuthStoreV1
  validateStore(parsed)
  return parsed
}

export async function writeAuthStore(store: AuthStoreV1): Promise<void> {
  validateStore(store)
  const p = resolveAuthStorePath()
  await fs.mkdir(path.dirname(p), { recursive: true })
  const tmp = `${p}.tmp`
  await fs.writeFile(tmp, JSON.stringify(store), { mode: 0o600 })
  await fs.rename(tmp, p)
}

export async function clearActiveAccount(): Promise<void> {
  const store = await readAuthStore()
  const id = store.activeAccountId
  if (id === null) return
  store.accounts = store.accounts.filter((a) => a.id !== id)
  store.activeAccountId = null
  await writeAuthStore(store)
}

function validateStore(s: AuthStoreV1): void {
  if (s.version !== 1) {
    throw new Error(`auth.bin: unsupported version ${s.version}; expected 1`)
  }
  if (!Array.isArray(s.accounts)) {
    throw new Error('auth.bin: accounts must be an array')
  }
  if (s.accounts.length > 1) {
    // D-16: v0.1 enforces single-account at the write boundary.
    // Relax this in v0.3 when the account switcher ships.
    throw new Error(
      `auth.bin: v0.1 supports at most 1 account; got ${s.accounts.length}`
    )
  }
  for (const a of s.accounts) {
    if (typeof a.id !== 'string' || a.id.length === 0) {
      throw new Error('auth.bin: account.id must be a non-empty string')
    }
    if (typeof a.username !== 'string' || a.username.length === 0) {
      throw new Error('auth.bin: account.username must be a non-empty string')
    }
    if (typeof a.lastUsed !== 'string') {
      throw new Error('auth.bin: account.lastUsed must be an ISO-8601 string')
    }
    // D-17 structural enforcement — reject any account shape carrying token material.
    const extra = Object.keys(a) as Array<string>
    for (const k of extra) {
      if (/token|secret|refresh/i.test(k)) {
        throw new Error(
          `auth.bin: account may not contain token-related key "${k}" (D-17)`
        )
      }
    }
  }
  if (s.activeAccountId !== null) {
    if (typeof s.activeAccountId !== 'string') {
      throw new Error('auth.bin: activeAccountId must be string or null')
    }
    const exists = s.accounts.some((a) => a.id === s.activeAccountId)
    if (!exists) {
      throw new Error(
        `auth.bin: activeAccountId ${s.activeAccountId} not present in accounts[]`
      )
    }
  }
}
