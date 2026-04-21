import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Reversible "encryption" — prepends a marker so we can assert bytes are NOT raw JSON.
// Tracks calls for behavioral assertions.
const encCalls: string[] = []
const decCalls: Buffer[] = []
let encryptionAvailable = true

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key === 'userData') return path.join(os.tmpdir(), 'wiiwho-test-userdata')
      throw new Error('unexpected getPath key: ' + key)
    }
  },
  safeStorage: {
    isEncryptionAvailable: () => encryptionAvailable,
    encryptString: (s: string) => {
      encCalls.push(s)
      return Buffer.from('ENC::' + s, 'utf8')
    },
    decryptString: (b: Buffer) => {
      decCalls.push(b)
      const str = b.toString('utf8')
      if (!str.startsWith('ENC::')) throw new Error('not ENC framed')
      return str.slice(5)
    }
  }
}))

import { safeStorageCacheFactory, resolveAuthDir } from '../safeStorageCache'

let tmpBase: string

beforeEach(async () => {
  encCalls.length = 0
  decCalls.length = 0
  encryptionAvailable = true
  tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiwho-sscache-'))
})

afterEach(async () => {
  try {
    await fs.rm(tmpBase, { recursive: true, force: true })
  } catch {
    // ignore cleanup failures
  }
})

describe('safeStorageCacheFactory', () => {
  it('factory returns function; invocation returns PrismarineCache shape', () => {
    const factory = safeStorageCacheFactory(tmpBase)
    const cache = factory({ username: 'primary', cacheName: 'msa' })
    expect(typeof cache.getCached).toBe('function')
    expect(typeof cache.setCached).toBe('function')
    expect(typeof cache.setCachedPartial).toBe('function')
  })

  it('first getCached with no file returns {}', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    expect(await cache.getCached()).toEqual({})
  })

  it('setCached writes a file at <baseDir>/<username>/<cacheName>.bin', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await cache.setCached({ foo: 'bar' })
    const expectedPath = path.join(tmpBase, 'primary', 'msa.bin')
    const stat = await fs.stat(expectedPath)
    expect(stat.isFile()).toBe(true)
  })

  it('on-disk bytes do NOT contain the literal value string (encryption round-trip)', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await cache.setCached({ refresh_token: 'SECRET-VALUE-XYZ' })
    const diskBytes = await fs.readFile(path.join(tmpBase, 'primary', 'msa.bin'))
    // bytes should be our ENC::-framed mock output, not raw JSON
    expect(diskBytes.toString('utf8').startsWith('ENC::')).toBe(true)
    expect(encCalls).toHaveLength(1)
    expect(encCalls[0]).toContain('SECRET-VALUE-XYZ')
  })

  it('setCached + getCached round-trip returns identical object', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await cache.setCached({ a: 1, nested: { b: 'two' } })
    const freshCache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    const read = await freshCache.getCached()
    expect(read).toEqual({ a: 1, nested: { b: 'two' } })
  })

  it('setCachedPartial merges with existing', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await cache.setCached({ a: 1 })
    await cache.setCachedPartial({ b: 2 })
    expect(await cache.getCached()).toEqual({ a: 1, b: 2 })
  })

  it('writes via temp-file + rename (no stray .tmp left)', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await cache.setCached({ foo: 'bar' })
    const tmpPath = path.join(tmpBase, 'primary', 'msa.bin.tmp')
    await expect(fs.stat(tmpPath)).rejects.toThrow() // .tmp must not remain
    const finalPath = path.join(tmpBase, 'primary', 'msa.bin')
    await expect(fs.stat(finalPath)).resolves.toBeTruthy()
  })

  it('getCached throws when safeStorage unavailable', async () => {
    encryptionAvailable = false
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await expect(cache.getCached()).rejects.toThrow(/safeStorage unavailable/)
  })

  it('setCached throws when safeStorage unavailable', async () => {
    encryptionAvailable = false
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await expect(cache.setCached({ x: 1 })).rejects.toThrow(
      /safeStorage unavailable/
    )
  })

  it('ENOENT on getCached → returns {} not thrown', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'neverwritten',
      cacheName: 'msa'
    })
    await expect(cache.getCached()).resolves.toEqual({})
  })

  it('in-memory memoization — second getCached does not re-read', async () => {
    const cache = safeStorageCacheFactory(tmpBase)({
      username: 'primary',
      cacheName: 'msa'
    })
    await cache.setCached({ foo: 'bar' })
    decCalls.length = 0 // reset after the initial read-then-write
    await cache.getCached()
    await cache.getCached()
    await cache.getCached()
    // memo is set after first setCached, so subsequent getCached() calls
    // should NOT call decryptString at all
    expect(decCalls).toHaveLength(0)
  })
})

describe('resolveAuthDir', () => {
  it('joins userData path with "auth"', () => {
    const dir = resolveAuthDir()
    expect(dir).toBe(path.join(os.tmpdir(), 'wiiwho-test-userdata', 'auth'))
  })
})
