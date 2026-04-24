// @vitest-environment node
/**
 * Preload bridge surface tests (Plan 04-05 Task 4).
 *
 * Verifies:
 *   - contextBridge receives exactly 6 top-level keys
 *     [__debug, auth, game, logs, settings, spotify]
 *     The 6th key `spotify` is a DELIBERATE deviation from Phase 1 D-11
 *     (Pitfall 10 in Phase 4 CONTEXT).
 *   - spotify namespace exposes expected methods (connect, disconnect, status,
 *     control.play|pause|next|previous, setVisibility, onStatusChanged)
 *   - control is a nested object with play/pause/next/previous methods
 *   - File header contains the Pitfall 10 / D-11 deviation note
 */

import { describe, it, expect, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'

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

describe('Preload bridge top-level shape (Phase 4 UI-06 extends D-11)', () => {
  it('exposes exactly 6 top-level keys (DELIBERATE 6th key: spotify)', () => {
    expect(exposedSurface).not.toBeNull()
    const keys = Object.keys(exposedSurface!).sort()
    expect(keys).toEqual(['__debug', 'auth', 'game', 'logs', 'settings', 'spotify'])
  })

  it('file header contains the DELIBERATE DEVIATION note (Pitfall 10)', async () => {
    const source = await fs.readFile(
      path.join(__dirname, '..', 'index.ts'),
      'utf8'
    )
    expect(source).toContain('DELIBERATE DEVIATION from Phase 1 D-11')
  })
})

describe('Preload bridge — spotify namespace', () => {
  it('spotify block exposes connect/disconnect/status', () => {
    const s = exposedSurface!.spotify as Record<string, unknown>
    expect(typeof s.connect).toBe('function')
    expect(typeof s.disconnect).toBe('function')
    expect(typeof s.status).toBe('function')
  })

  it('spotify.control is a nested object with play/pause/next/previous', () => {
    const s = exposedSurface!.spotify as { control: Record<string, unknown> }
    expect(typeof s.control.play).toBe('function')
    expect(typeof s.control.pause).toBe('function')
    expect(typeof s.control.next).toBe('function')
    expect(typeof s.control.previous).toBe('function')
  })

  it('spotify.setVisibility and onStatusChanged are functions', () => {
    const s = exposedSurface!.spotify as Record<string, unknown>
    expect(typeof s.setVisibility).toBe('function')
    expect(typeof s.onStatusChanged).toBe('function')
  })

  it('spotify.onStatusChanged returns an unsubscribe function', () => {
    const s = exposedSurface!.spotify as {
      onStatusChanged: (cb: (v: unknown) => void) => () => void
    }
    const unsub = s.onStatusChanged(() => {})
    expect(typeof unsub).toBe('function')
  })
})

describe('Preload bridge — Phase 1–3 regressions (5 legacy keys intact)', () => {
  it('auth / game / settings / logs / __debug all still present as objects', () => {
    for (const k of ['auth', 'game', 'settings', 'logs', '__debug']) {
      expect(typeof exposedSurface![k]).toBe('object')
    }
  })
})
