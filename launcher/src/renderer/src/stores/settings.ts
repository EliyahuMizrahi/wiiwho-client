/**
 * Renderer-side settings store (Zustand).
 *
 * Mirrors the main-process SettingsV2 schema via the frozen
 * window.wiiwho.settings IPC surface. Phase 4 Plan 04-01 bumps this from
 * v1 (ramMb + firstRunSeen) to v2 by adding:
 *   - theme.accent (hex color, runtime-mutable via :root CSS var)
 *   - theme.reduceMotion ('system'|'on'|'off')
 *   - modalOpen + openPane (UI-local settings-modal state)
 *
 * Hydrate once from App.tsx on mount (initialize); subsequent writes go
 * through setRamMb / setFirstRunSeen / setAccent / setReduceMotion and
 * round-trip the persisted shape — the main-process store clamps (ramMb)
 * and validates (accent hex regex, reduceMotion enum), and the renderer
 * mirrors whatever main returns.
 *
 * Accent runtime flow (UI-01): setAccent writes to
 * document.documentElement.style.setProperty('--color-accent', hex) BEFORE
 * awaiting IPC, so the colour change is instantaneous. If IPC fails, the
 * local state is not updated but the :root var remains at the new colour
 * until the next initialize() — acceptable for v0.1 (colour is cosmetic,
 * not security-sensitive; the persisted authority wins on next launch).
 *
 * Sources:
 *   - Plan 03-02 (main-process settings store + clamp; v1 baseline)
 *   - Plan 04-01 (v2 theme slice, setAccent runtime path, modal state)
 *   - D-04 (RAM schema), D-18 (theme slice), UI-01 (accent persists),
 *     UI-03 (reduced-motion override), D-22 (settings modal chrome state)
 *   - Pitfall 1 (HMR loses :root var → initialize re-applies accent)
 *   - Pitfall 8 (two-step pane-open race → setOpenPane atomic)
 */

import { create } from 'zustand'

/** Panes exposed by the settings modal (Plan 04-03 wiring; referenced here). */
export type SettingsPane = 'general' | 'account' | 'appearance' | 'spotify' | 'about'

/** The persisted settings shape — matches main-process SettingsV2. */
export interface SettingsSnapshot {
  version: 2
  ramMb: number
  firstRunSeen: boolean
  theme: {
    accent: string
    reduceMotion: 'system' | 'on' | 'off'
  }
}

export interface SettingsStoreState extends SettingsSnapshot {
  /**
   * True after initialize() has successfully read from the main process
   * at least once. App.tsx may gate UI on this so the RamSlider doesn't
   * flash the D-04 default before the real value lands.
   */
  hydrated: boolean

  /** Modal visibility (Plan 04-03). Local UI state, not persisted. */
  modalOpen: boolean
  /** Current pane in the settings modal. Local UI state, not persisted. */
  openPane: SettingsPane

  initialize: () => Promise<void>
  setRamMb: (ramMb: number) => Promise<void>
  setFirstRunSeen: (seen: boolean) => Promise<void>

  /** Runtime accent change — writes to :root + persists via IPC. No-op on invalid hex. */
  setAccent: (hex: string) => Promise<void>
  setReduceMotion: (mode: 'system' | 'on' | 'off') => Promise<void>

  setModalOpen: (open: boolean) => void
  /** Atomic pane select + modal open (Pitfall 8 — no two-step race). */
  setOpenPane: (pane: SettingsPane) => void
}

const DEFAULT_ACCENT = '#16e0ee'
const DEFAULT_REDUCE_MOTION: 'system' | 'on' | 'off' = 'system'

function isValidHex(x: unknown): x is string {
  return typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x)
}

/**
 * Defensive parse of the main-process snapshot.
 *
 * The preload's typed shape (wiiwho.d.ts) is now v2, but at runtime the
 * IPC boundary is still untyped — narrow every field with a fallback.
 */
function readSnapshot(raw: unknown, fallback: SettingsSnapshot): SettingsSnapshot {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Record<string, unknown>
  const t = (r.theme && typeof r.theme === 'object' ? r.theme : {}) as Record<
    string,
    unknown
  >
  return {
    version: 2,
    ramMb: typeof r.ramMb === 'number' ? r.ramMb : fallback.ramMb,
    firstRunSeen:
      typeof r.firstRunSeen === 'boolean' ? r.firstRunSeen : fallback.firstRunSeen,
    theme: {
      accent: isValidHex(t.accent) ? t.accent : fallback.theme.accent,
      reduceMotion:
        t.reduceMotion === 'on' || t.reduceMotion === 'off' || t.reduceMotion === 'system'
          ? t.reduceMotion
          : fallback.theme.reduceMotion
    }
  }
}

/**
 * Defensive parse for the `settings:set` response — {ok, settings?}.
 * Returns null snapshot if ok=false so callers can skip the store mutation.
 */
function readSetResponse(raw: unknown): {
  ok: boolean
  snapshot: SettingsSnapshot | null
} {
  if (!raw || typeof raw !== 'object') return { ok: false, snapshot: null }
  const r = raw as Record<string, unknown>
  const ok = r.ok === true
  if (!ok) return { ok: false, snapshot: null }
  const settings = r.settings
  if (!settings || typeof settings !== 'object') {
    return { ok: true, snapshot: null }
  }
  const fallback: SettingsSnapshot = {
    version: 2,
    ramMb: 2048,
    firstRunSeen: false,
    theme: { accent: DEFAULT_ACCENT, reduceMotion: DEFAULT_REDUCE_MOTION }
  }
  return { ok: true, snapshot: readSnapshot(settings, fallback) }
}

/** Write the accent to :root — kept in sync with the @theme default. */
function applyAccentToRoot(hex: string): void {
  // Guard against non-browser test environments that stub document but
  // may not have documentElement.style (unlikely — jsdom provides it).
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.setProperty('--color-accent', hex)
  }
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  version: 2,
  ramMb: 2048, // D-04 default (2 GB)
  firstRunSeen: false,
  theme: {
    accent: DEFAULT_ACCENT,
    reduceMotion: DEFAULT_REDUCE_MOTION
  },
  hydrated: false,
  modalOpen: false,
  openPane: 'general',

  initialize: async () => {
    if (get().hydrated) return
    try {
      const raw = await window.wiiwho.settings.get()
      const snap = readSnapshot(raw, {
        version: 2,
        ramMb: get().ramMb,
        firstRunSeen: get().firstRunSeen,
        theme: { ...get().theme }
      })
      set({
        version: snap.version,
        ramMb: snap.ramMb,
        firstRunSeen: snap.firstRunSeen,
        theme: snap.theme,
        hydrated: true
      })
      // Pitfall 1: HMR/remount drops :root overrides; re-apply the
      // persisted accent so UI is consistent with state after any reload.
      applyAccentToRoot(snap.theme.accent)
    } catch {
      // Leave hydrated:false; caller (App.tsx) may retry.
    }
  },

  setRamMb: async (ramMb) => {
    // Main-process store clamps to 1024-4096 step 512; store mirrors main.
    const raw = await window.wiiwho.settings.set({ ramMb })
    const res = readSetResponse(raw)
    if (res.ok && res.snapshot) {
      set({
        version: res.snapshot.version,
        ramMb: res.snapshot.ramMb,
        firstRunSeen: res.snapshot.firstRunSeen,
        theme: res.snapshot.theme
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
        firstRunSeen: res.snapshot.firstRunSeen,
        theme: res.snapshot.theme
      })
    }
  },

  setAccent: async (hex) => {
    // No-op on invalid hex — do NOT mutate :root, do NOT hit IPC. This
    // prevents junk from the UI (e.g. a half-typed colour input) from
    // rewriting the persisted accent or forcing a flash of invalid colour.
    if (!isValidHex(hex)) return

    // Apply to :root BEFORE awaiting IPC — UI updates instantaneously.
    applyAccentToRoot(hex)

    const raw = await window.wiiwho.settings.set({ theme: { accent: hex } })
    const res = readSetResponse(raw)
    if (res.ok && res.snapshot) {
      set({
        version: res.snapshot.version,
        ramMb: res.snapshot.ramMb,
        firstRunSeen: res.snapshot.firstRunSeen,
        theme: res.snapshot.theme
      })
    }
  },

  setReduceMotion: async (mode) => {
    const raw = await window.wiiwho.settings.set({ theme: { reduceMotion: mode } })
    const res = readSetResponse(raw)
    if (res.ok && res.snapshot) {
      set({
        version: res.snapshot.version,
        ramMb: res.snapshot.ramMb,
        firstRunSeen: res.snapshot.firstRunSeen,
        theme: res.snapshot.theme
      })
    }
  },

  setModalOpen: (open) => set({ modalOpen: open }),

  setOpenPane: (pane) => set({ openPane: pane, modalOpen: true })
}))
