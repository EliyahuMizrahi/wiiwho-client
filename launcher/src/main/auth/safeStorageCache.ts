/**
 * prismarine-auth custom cache factory backed by Electron safeStorage.
 *
 * prismarine-auth's default FileCache writes plaintext JSON (Pitfall 1) — forbidden
 * by AUTH-04. This factory encrypts every write via safeStorage.encryptString and
 * writes atomically (temp file + rename) to guard against crash-corruption.
 *
 * Prismarine calls the factory once per (username, cacheName) pair and expects
 * an independent cache object per pair; we honor that by keyed file paths.
 *
 * Source of truth: .planning/phases/02-microsoft-authentication/02-RESEARCH.md §Pattern 1
 */

import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export type CacheEntry = Record<string, unknown>

export interface PrismarineCache {
  getCached(): Promise<CacheEntry>
  setCached(value: CacheEntry): Promise<void>
  setCachedPartial(value: CacheEntry): Promise<void>
}

export type CacheDirFn = (ctx: {
  username: string
  cacheName: string
}) => PrismarineCache

/**
 * Resolve the directory under which prismarine-auth's per-(username,cacheName)
 * encrypted cache files live. Caller must ensure app.whenReady() has fired.
 */
export function resolveAuthDir(): string {
  return path.join(app.getPath('userData'), 'auth')
}

export function safeStorageCacheFactory(baseDir: string): CacheDirFn {
  return ({ username, cacheName }): PrismarineCache => {
    const userDir = path.join(baseDir, username)
    const filePath = path.join(userDir, `${cacheName}.bin`)
    let memo: CacheEntry | null = null

    const readFromDisk = async (): Promise<CacheEntry> => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage unavailable — refusing to read tokens')
      }
      try {
        const enc = await fs.readFile(filePath)
        const plain = safeStorage.decryptString(enc)
        return JSON.parse(plain) as CacheEntry
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
        throw e
      }
    }

    const writeToDisk = async (v: CacheEntry): Promise<void> => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage unavailable — refusing to write tokens')
      }
      await fs.mkdir(userDir, { recursive: true })
      const enc = safeStorage.encryptString(JSON.stringify(v))
      const tmp = `${filePath}.tmp`
      await fs.writeFile(tmp, enc, { mode: 0o600 })
      await fs.rename(tmp, filePath)
    }

    return {
      async getCached() {
        if (memo === null) memo = await readFromDisk()
        return memo
      },
      async setCached(value) {
        memo = value
        await writeToDisk(value)
      },
      async setCachedPartial(value) {
        const current = memo ?? (await readFromDisk())
        memo = { ...current, ...value }
        await writeToDisk(memo)
      }
    }
  }
}
