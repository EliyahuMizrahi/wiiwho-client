import { describe, it, expect, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

import { registerGameHandlers } from './game'

registerGameHandlers()

describe('game IPC stubs (Phase 1)', () => {
  it('game:play returns { ok: true, stub: true, reason: ... }', async () => {
    const r = (await handlers.get('game:play')?.()) as {
      ok: boolean
      stub?: boolean
      reason?: string
    }
    expect(r.ok).toBe(true)
    expect(r.stub).toBe(true)
    expect(r.reason).toMatch(/Phase 1 scaffold/)
  })

  it('game:cancel returns { ok: true, stub: true }', async () => {
    const r = (await handlers.get('game:cancel')?.()) as {
      ok: boolean
      stub?: boolean
    }
    expect(r.ok).toBe(true)
    expect(r.stub).toBe(true)
  })

  it("game:status returns { state: 'idle' }", async () => {
    const r = (await handlers.get('game:status')?.()) as { state: string }
    expect(r.state).toBe('idle')
  })
})
