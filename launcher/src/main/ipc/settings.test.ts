import { describe, it, expect, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))

import { registerSettingsHandlers, __resetSettingsForTests } from './settings'

registerSettingsHandlers()

describe('settings IPC stubs (Phase 1)', () => {
  it('settings:get returns {} initially', async () => {
    __resetSettingsForTests()
    const r = await handlers.get('settings:get')?.()
    expect(r).toEqual({})
  })

  it('settings:set returns { ok: true } and subsequent get returns patched state', async () => {
    __resetSettingsForTests()
    const setResult = (await handlers
      .get('settings:set')
      ?.({} as unknown, { ramMb: 2048 })) as { ok: boolean }
    expect(setResult).toEqual({ ok: true })

    const getResult = (await handlers.get('settings:get')?.()) as Record<
      string,
      unknown
    >
    expect(getResult.ramMb).toBe(2048)
  })

  it('logs:read-crash returns { sanitizedBody: "" }', async () => {
    const r = await handlers.get('logs:read-crash')?.()
    expect(r).toEqual({ sanitizedBody: '' })
  })
})
