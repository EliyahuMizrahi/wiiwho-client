/**
 * @vitest-environment jsdom
 *
 * Plan 04-01 Task 3 — renderer settings store theme slice + modal state.
 *
 * Verifies:
 *   - Default theme.accent === '#16e0ee', theme.reduceMotion === 'system'.
 *   - setAccent with valid hex mutates :root --color-accent AND calls IPC.
 *   - setAccent with invalid hex is a no-op (no IPC, no :root mutation).
 *   - setReduceMotion persists and updates state.
 *   - setOpenPane opens the modal + sets the pane atomically (Pitfall 8).
 *   - initialize() re-applies the persisted accent to :root (Pitfall 1 HMR fix).
 *   - initialize() is idempotent across repeat calls.
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useSettingsStore } from '../settings'

const settingsGetMock = vi.fn()
const settingsSetMock = vi.fn()

beforeEach(() => {
  settingsGetMock.mockReset()
  settingsSetMock.mockReset()
  ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
    settings: { get: settingsGetMock, set: settingsSetMock },
    auth: {},
    game: {},
    logs: {},
    __debug: {}
  }
  // Reset store to fresh v2 defaults.
  useSettingsStore.setState({
    version: 2,
    ramMb: 2048,
    firstRunSeen: false,
    theme: { accent: '#16e0ee', reduceMotion: 'system' },
    hydrated: false,
    modalOpen: false,
    openPane: 'general'
  } as never)
  // Clear any stale :root CSS var from previous tests.
  document.documentElement.style.removeProperty('--color-accent')
})

afterEach(cleanup)

describe('settings store theme slice', () => {
  it('default theme.accent === "#16e0ee"', () => {
    expect(useSettingsStore.getState().theme.accent).toBe('#16e0ee')
  })

  it('default theme.reduceMotion === "system"', () => {
    expect(useSettingsStore.getState().theme.reduceMotion).toBe('system')
  })

  it('setAccent with valid hex mutates :root --color-accent and calls IPC', async () => {
    settingsSetMock.mockResolvedValue({
      ok: true,
      settings: {
        version: 2,
        ramMb: 2048,
        firstRunSeen: false,
        theme: { accent: '#ec4899', reduceMotion: 'system' }
      }
    })
    await useSettingsStore.getState().setAccent('#ec4899')
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe(
      '#ec4899'
    )
    expect(settingsSetMock).toHaveBeenCalledWith({ theme: { accent: '#ec4899' } })
    expect(useSettingsStore.getState().theme.accent).toBe('#ec4899')
  })

  it('setAccent with invalid hex is a no-op (no IPC call, no :root mutation)', async () => {
    document.documentElement.style.setProperty('--color-accent', '#16e0ee')
    await useSettingsStore.getState().setAccent('not-a-hex')
    expect(settingsSetMock).not.toHaveBeenCalled()
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe(
      '#16e0ee'
    )
  })

  it('setReduceMotion persists and updates state', async () => {
    settingsSetMock.mockResolvedValue({
      ok: true,
      settings: {
        version: 2,
        ramMb: 2048,
        firstRunSeen: false,
        theme: { accent: '#16e0ee', reduceMotion: 'on' }
      }
    })
    await useSettingsStore.getState().setReduceMotion('on')
    expect(settingsSetMock).toHaveBeenCalledWith({ theme: { reduceMotion: 'on' } })
    expect(useSettingsStore.getState().theme.reduceMotion).toBe('on')
  })

  it('setOpenPane opens modal + sets pane in a single action (Pitfall 8)', () => {
    useSettingsStore.getState().setOpenPane('account')
    expect(useSettingsStore.getState().modalOpen).toBe(true)
    expect(useSettingsStore.getState().openPane).toBe('account')
  })

  it('setModalOpen(false) closes modal without changing pane', () => {
    useSettingsStore.getState().setOpenPane('account')
    useSettingsStore.getState().setModalOpen(false)
    expect(useSettingsStore.getState().modalOpen).toBe(false)
    expect(useSettingsStore.getState().openPane).toBe('account')
  })

  it('initialize re-applies persisted accent to :root (Pitfall 1 HMR fix)', async () => {
    settingsGetMock.mockResolvedValue({
      version: 2,
      ramMb: 2048,
      firstRunSeen: false,
      theme: { accent: '#a855f7', reduceMotion: 'system' }
    })
    await useSettingsStore.getState().initialize()
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe(
      '#a855f7'
    )
    expect(useSettingsStore.getState().theme.accent).toBe('#a855f7')
  })

  it('initialize is idempotent (hydrated guard)', async () => {
    settingsGetMock.mockResolvedValue({
      version: 2,
      ramMb: 2048,
      firstRunSeen: false,
      theme: { accent: '#16e0ee', reduceMotion: 'system' }
    })
    await useSettingsStore.getState().initialize()
    await useSettingsStore.getState().initialize()
    expect(settingsGetMock).toHaveBeenCalledTimes(1)
  })
})
