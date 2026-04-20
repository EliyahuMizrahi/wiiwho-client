import { describe, it, expect, vi } from 'vitest'

// Mock `electron` BEFORE importing the SUT so the handlers register against
// our in-memory map, not a real ipcMain.
const handlers = new Map<string, (...args: unknown[]) => unknown>()
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

import { registerAuthHandlers } from './auth'

registerAuthHandlers()

describe('auth IPC stubs (Phase 1)', () => {
  it('auth:status returns { loggedIn: false }', async () => {
    const r = await handlers.get('auth:status')?.()
    expect(r).toEqual({ loggedIn: false })
  })

  it('auth:login returns a stub error with Phase 1 note', async () => {
    const r = (await handlers.get('auth:login')?.()) as {
      ok: boolean
      error?: string
    }
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Phase 1 scaffold/)
  })

  it('auth:logout returns { ok: true }', async () => {
    const r = await handlers.get('auth:logout')?.()
    expect(r).toEqual({ ok: true })
  })
})
