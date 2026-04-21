/**
 * Renderer-side settings store (Zustand).
 *
 * Mirrors the main-process SettingsV1 schema via the frozen
 * window.wiiwho.settings IPC surface.
 *
 * Hydrate once from App.tsx on mount (Plan 03-10 wires this); subsequent
 * writes go through setRamMb / setFirstRunSeen and round-trip the persisted
 * shape — the main-process store is the source of truth for clamping
 * (ramMb 1024-4096 step 512), so this store just mirrors what it returns.
 *
 * Source:
 *   - Plan 03-02 (main-process settings store + clamp)
 *   - D-04 (RAM schema: 1-4 GB in 512 MB steps, default 2 GB)
 *   - LAUN-03 (RAM bounds) + LAUN-04 (persistence across restarts)
 *
 * Contract with main (wiiwho.d.ts evolves across 03-02 / 03-09):
 *   get(): returns { version: 1, ramMb: number, firstRunSeen: boolean }
 *   set(patch): returns { ok: boolean, settings?: {version, ramMb, firstRunSeen} }
 *
 * We cast at the IPC boundary because wiiwho.d.ts's stub shape
 * (`Record<string, unknown>`) from Phase 1 is narrower than the shape
 * Plan 03-02 + 03-09 ship. Removing the cast is safe once 03-09 lands.
 */

import { create } from 'zustand'

/** The persisted settings shape — matches main-process SettingsV1 (Plan 03-02). */
export interface SettingsSnapshot {
  version: 1
  ramMb: number
  firstRunSeen: boolean
}

export interface SettingsStoreState extends SettingsSnapshot {
  /**
   * True after initialize() has successfully read from the main process
   * at least once. App.tsx (Plan 03-10) may gate UI on this so the
   * RamSlider doesn't flash the D-04 default before the real value lands.
   */
  hydrated: boolean

  initialize: () => Promise<void>
  setRamMb: (ramMb: number) => Promise<void>
  setFirstRunSeen: (seen: boolean) => Promise<void>
}

/**
 * Defensive parse — the preload's typed shape is `Record<string, unknown>`
 * until Plan 03-09 narrows it. We read the three fields we care about and
 * fall back to current state if any field is missing / wrong type.
 */
function readSnapshot(raw: unknown, fallback: SettingsSnapshot): SettingsSnapshot {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Record<string, unknown>
  const ramMb = typeof r.ramMb === 'number' ? r.ramMb : fallback.ramMb
  const firstRunSeen =
    typeof r.firstRunSeen === 'boolean' ? r.firstRunSeen : fallback.firstRunSeen
  return { version: 1, ramMb, firstRunSeen }
}

/**
 * Defensive parse for the `settings:set` response — {ok, settings?}.
 * Returns null if ok=false so callers can skip the store mutation.
 */
function readSetResponse(
  raw: unknown
): { ok: boolean; snapshot: SettingsSnapshot | null } {
  if (!raw || typeof raw !== 'object') return { ok: false, snapshot: null }
  const r = raw as Record<string, unknown>
  const ok = r.ok === true
  if (!ok) return { ok: false, snapshot: null }
  const settings = r.settings
  if (!settings || typeof settings !== 'object') {
    return { ok: true, snapshot: null }
  }
  const s = settings as Record<string, unknown>
  return {
    ok: true,
    snapshot: {
      version: 1,
      ramMb: typeof s.ramMb === 'number' ? s.ramMb : 2048,
      firstRunSeen: typeof s.firstRunSeen === 'boolean' ? s.firstRunSeen : false
    }
  }
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  version: 1,
  ramMb: 2048, // D-04 default (2 GB)
  firstRunSeen: false,
  hydrated: false,

  initialize: async () => {
    if (get().hydrated) return
    try {
      const raw = await window.wiiwho.settings.get()
      const snap = readSnapshot(raw, {
        version: 1,
        ramMb: get().ramMb,
        firstRunSeen: get().firstRunSeen
      })
      set({
        version: snap.version,
        ramMb: snap.ramMb,
        firstRunSeen: snap.firstRunSeen,
        hydrated: true
      })
    } catch {
      // Leave hydrated:false; caller (App.tsx) may retry.
    }
  },

  setRamMb: async (ramMb) => {
    // Main-process store (Plan 03-02) clamps to 1024-4096 step 512.
    // We send the raw value and mirror whatever main returns — single
    // source of truth for LAUN-03 bounds is main, not renderer.
    const raw = await window.wiiwho.settings.set({ ramMb })
    const res = readSetResponse(raw)
    if (res.ok && res.snapshot) {
      set({
        version: res.snapshot.version,
        ramMb: res.snapshot.ramMb,
        firstRunSeen: res.snapshot.firstRunSeen
      })
    }
  },

  setFirstRunSeen: async (seen) => {
    const raw = await window.wiiwho.settings.set({ firstRunSeen: seen })
    const res = readSetResponse(raw)
    if (res.ok && res.snapshot) {
      set({
        version: res.snapshot.version,
        ramMb: res.snapshot.ramMb,
        firstRunSeen: res.snapshot.firstRunSeen
      })
    }
  }
}))
