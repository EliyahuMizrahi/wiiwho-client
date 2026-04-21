/**
 * @vitest-environment jsdom
 *
 * Renderer-side settings store — Zustand tests.
 *
 * Covers:
 *   - Initial state defaults (version:1, ramMb:2048, firstRunSeen:false, hydrated:false).
 *   - initialize() calls window.wiiwho.settings.get() and populates the store.
 *   - initialize() is idempotent (second call skips re-fetch).
 *   - initialize() swallows IPC errors and leaves hydrated:false for caller retry.
 *   - setRamMb / setFirstRunSeen round-trip through window.wiiwho.settings.set()
 *     and update the store from the returned settings snapshot.
 *
 * Environment: jsdom (docblock pragma — Phase 2 pattern locked in Plan 02-04).
 * Mock wiiwho IPC surface by grafting onto globalThis.window (jsdom-provided).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

type SettingsSnapshot = {
  version: 1
  ramMb: number
  firstRunSeen: boolean
}

type SettingsAPI = {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

const settingsApi: SettingsAPI = {
  get: vi.fn(),
  set: vi.fn()
}

// jsdom already provides `window`; graft a `wiiwho` namespace onto it so
// the store's window.wiiwho.settings.* calls hit these vi.fn mocks.
;(globalThis as unknown as { window: Window & { wiiwho: unknown } }).window.wiiwho = {
  settings: settingsApi
} as never

import { useSettingsStore } from '../settings'

function resetStore(): void {
  useSettingsStore.setState({
    version: 1,
    ramMb: 2048,
    firstRunSeen: false,
    hydrated: false
  })
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    settingsApi.get.mockReset()
    settingsApi.set.mockReset()
    resetStore()
  })

  it('initial state has D-04 default ramMb=2048 and hydrated=false', () => {
    const s = useSettingsStore.getState()
    expect(s.version).toBe(1)
    expect(s.ramMb).toBe(2048)
    expect(s.firstRunSeen).toBe(false)
    expect(s.hydrated).toBe(false)
  })

  it('initialize() populates from window.wiiwho.settings.get() and sets hydrated=true', async () => {
    const snap: SettingsSnapshot = {
      version: 1,
      ramMb: 3072,
      firstRunSeen: true
    }
    settingsApi.get.mockResolvedValue(snap)
    await useSettingsStore.getState().initialize()
    const s = useSettingsStore.getState()
    expect(s.version).toBe(1)
    expect(s.ramMb).toBe(3072)
    expect(s.firstRunSeen).toBe(true)
    expect(s.hydrated).toBe(true)
  })

  it('initialize() is idempotent — second call does not re-invoke get()', async () => {
    settingsApi.get.mockResolvedValue({
      version: 1,
      ramMb: 2048,
      firstRunSeen: false
    } satisfies SettingsSnapshot)
    await useSettingsStore.getState().initialize()
    await useSettingsStore.getState().initialize()
    await useSettingsStore.getState().initialize()
    expect(settingsApi.get).toHaveBeenCalledTimes(1)
  })

  it('initialize() swallows IPC errors and leaves hydrated=false', async () => {
    settingsApi.get.mockRejectedValue(new Error('ipc exploded'))
    await expect(useSettingsStore.getState().initialize()).resolves.toBeUndefined()
    expect(useSettingsStore.getState().hydrated).toBe(false)
    // Caller (App.tsx in Plan 03-10) can retry.
  })

  it('setRamMb(3072) calls settings.set and updates the store from returned snapshot', async () => {
    const returned: SettingsSnapshot = {
      version: 1,
      ramMb: 3072,
      firstRunSeen: false
    }
    settingsApi.set.mockResolvedValue({ ok: true, settings: returned })
    await useSettingsStore.getState().setRamMb(3072)
    expect(settingsApi.set).toHaveBeenCalledWith({ ramMb: 3072 })
    const s = useSettingsStore.getState()
    expect(s.ramMb).toBe(3072)
  })

  it('setRamMb trusts the main-process response (main clamps; store mirrors)', async () => {
    // Store sends the raw value; main clamps to 4096 per Plan 03-02. Store
    // mirrors whatever main returns — single source of truth for clamp.
    const returned: SettingsSnapshot = {
      version: 1,
      ramMb: 4096,
      firstRunSeen: false
    }
    settingsApi.set.mockResolvedValue({ ok: true, settings: returned })
    await useSettingsStore.getState().setRamMb(99999)
    expect(settingsApi.set).toHaveBeenCalledWith({ ramMb: 99999 })
    expect(useSettingsStore.getState().ramMb).toBe(4096)
  })

  it('setRamMb with {ok:false} response does NOT mutate store (safe-on-reject)', async () => {
    useSettingsStore.setState({ ramMb: 2048 })
    settingsApi.set.mockResolvedValue({ ok: false })
    await useSettingsStore.getState().setRamMb(3072)
    expect(useSettingsStore.getState().ramMb).toBe(2048)
  })

  it('setFirstRunSeen(true) patches firstRunSeen and persists', async () => {
    const returned: SettingsSnapshot = {
      version: 1,
      ramMb: 2048,
      firstRunSeen: true
    }
    settingsApi.set.mockResolvedValue({ ok: true, settings: returned })
    await useSettingsStore.getState().setFirstRunSeen(true)
    expect(settingsApi.set).toHaveBeenCalledWith({ firstRunSeen: true })
    expect(useSettingsStore.getState().firstRunSeen).toBe(true)
  })
})
