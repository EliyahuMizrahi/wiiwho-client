// @vitest-environment node
/**
 * Preload bridge surface tests.
 *
 * Verifies:
 *   - contextBridge receives exactly 5 top-level keys
 *     [__debug, auth, game, logs, settings] — the frozen D-11 surface.
 */

import { describe, it, expect, vi } from 'vitest'

// Capture the object passed to contextBridge.exposeInMainWorld.
let exposedSurface: Record<string, unknown> | null = null

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: Record<string, unknown>): void => {
      expect(name).toBe('wiiwho')
      exposedSurface = api
    }
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Importing preload/index.ts runs exposeInMainWorld synchronously at module-
// evaluation time, populating exposedSurface.
await import('../index')

describe('Preload bridge top-level shape (D-11 frozen surface)', () => {
  it('exposes exactly 5 top-level keys', () => {
    expect(exposedSurface).not.toBeNull()
    const keys = Object.keys(exposedSurface!).sort()
    expect(keys).toEqual(['__debug', 'auth', 'game', 'logs', 'settings'])
  })
})

describe('Preload bridge — Phase 1–3 regressions (5 legacy keys intact)', () => {
  it('auth / game / settings / logs / __debug all still present as objects', () => {
    for (const k of ['auth', 'game', 'settings', 'logs', '__debug']) {
      expect(typeof exposedSurface![k]).toBe('object')
    }
  })
})
