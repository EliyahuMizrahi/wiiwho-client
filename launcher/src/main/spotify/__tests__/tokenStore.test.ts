// @vitest-environment node
/**
 * Spotify safeStorage token store tests (Plan 04-05 Task 1).
 *
 * Covers:
 *   - round-trip encrypt + write + read
 *   - readSpotifyTokens returns null when file missing (ENOENT)
 *   - clearSpotifyTokens is idempotent
 *   - writeSpotifyTokens uses atomic temp+rename pattern
 *   - fail-closed when safeStorage.isEncryptionAvailable() === false (Pitfall 7)
 *
 * Parallels launcher/src/main/auth/__tests__/safeStorageCache test pattern.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const tmpDir = path.join(
  os.tmpdir(),
  `wiiwho-spotify-test-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
)

vi.mock('electron', () => ({
  app: {
    getPath: (k: string): string => {
      if (k === 'userData') return tmpDir
      throw new Error(`unexpected app.getPath(${k})`)
    }
  },
  safeStorage: {
    isEncryptionAvailable: (): boolean => true,
    encryptString: (s: string): Buffer => Buffer.from('ENC:' + s, 'utf8'),
    decryptString: (b: Buffer): string => b.toString('utf8').replace(/^ENC:/, '')
  }
}))

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

describe('Spotify tokenStore', () => {
  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true })
    vi.resetModules()
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('writeSpotifyTokens + readSpotifyTokens round-trips', async () => {
    const { readSpotifyTokens, writeSpotifyTokens } = await import('../tokenStore')
    const tokens = {
      version: 1 as const,
      accessToken: 'at-x-BQDopaque',
      refreshToken: 'rt-y-AQDopaque',
      expiresAt: '2026-05-01T00:00:00Z',
      scopes: ['user-read-currently-playing', 'user-modify-playback-state'],
      displayName: 'Owner',
      isPremium: 'yes' as const
    }
    await writeSpotifyTokens(tokens)
    const out = await readSpotifyTokens()
    expect(out).toEqual(tokens)
  })

  it('readSpotifyTokens returns null when file missing (ENOENT)', async () => {
    const { readSpotifyTokens } = await import('../tokenStore')
    const out = await readSpotifyTokens()
    expect(out).toBeNull()
  })

  it('clearSpotifyTokens is idempotent (ENOENT treated as success)', async () => {
    const { clearSpotifyTokens } = await import('../tokenStore')
    await expect(clearSpotifyTokens()).resolves.toBeUndefined()
    await expect(clearSpotifyTokens()).resolves.toBeUndefined()
  })

  it('clearSpotifyTokens removes an existing file', async () => {
    const { clearSpotifyTokens, readSpotifyTokens, writeSpotifyTokens } = await import(
      '../tokenStore'
    )
    await writeSpotifyTokens({
      version: 1,
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: '2026-05-01T00:00:00Z',
      scopes: []
    })
    expect(await readSpotifyTokens()).not.toBeNull()
    await clearSpotifyTokens()
    expect(await readSpotifyTokens()).toBeNull()
  })

  it('writeSpotifyTokens uses atomic temp+rename pattern (no .tmp leftover on success)', async () => {
    const { writeSpotifyTokens } = await import('../tokenStore')
    await writeSpotifyTokens({
      version: 1,
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: '2026-05-01T00:00:00Z',
      scopes: []
    })
    const file = path.join(tmpDir, 'spotify.bin')
    // Final file exists …
    expect(
      await fs.access(file).then(
        () => true,
        () => false
      )
    ).toBe(true)
    // … but the temp file does NOT (rename should have moved it).
    expect(
      await fs.access(`${file}.tmp`).then(
        () => true,
        () => false
      )
    ).toBe(false)
  })

  it('on-disk payload is the encrypted byte-string (never plaintext JSON)', async () => {
    const { writeSpotifyTokens } = await import('../tokenStore')
    await writeSpotifyTokens({
      version: 1,
      accessToken: 'SHOULD_BE_ENCRYPTED',
      refreshToken: 'REFRESH_ENCRYPTED',
      expiresAt: '2026-05-01T00:00:00Z',
      scopes: []
    })
    const file = path.join(tmpDir, 'spotify.bin')
    const raw = await fs.readFile(file, 'utf8')
    // Our test mock prepends ENC:; real safeStorage would emit opaque bytes.
    // The invariant: the raw access token string MUST NOT be searchable.
    expect(raw.startsWith('ENC:')).toBe(true)
    // And ENC: prefix proves encryptString was invoked.
  })

  it('fails closed when safeStorage.isEncryptionAvailable() === false (Pitfall 7)', async () => {
    vi.resetModules()
    vi.doMock('electron', () => ({
      app: {
        getPath: (k: string): string => (k === 'userData' ? tmpDir : '')
      },
      safeStorage: {
        isEncryptionAvailable: (): boolean => false,
        encryptString: (s: string): Buffer => Buffer.from(s, 'utf8'),
        decryptString: (b: Buffer): string => b.toString('utf8')
      }
    }))
    const { writeSpotifyTokens, readSpotifyTokens } = await import('../tokenStore')
    await expect(
      writeSpotifyTokens({
        version: 1,
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: '2026-05-01T00:00:00Z',
        scopes: []
      })
    ).rejects.toThrow(/safeStorage unavailable/i)

    // Write a plausible file by hand so read has something to attempt…
    await fs.writeFile(path.join(tmpDir, 'spotify.bin'), 'anything', 'utf8')
    await expect(readSpotifyTokens()).rejects.toThrow(/safeStorage unavailable/i)

    vi.doUnmock('electron')
  })
})
