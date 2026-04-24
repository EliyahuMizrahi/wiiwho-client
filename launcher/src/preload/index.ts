import { contextBridge, ipcRenderer } from 'electron'

type Unsubscribe = () => void

/**
 * The ENTIRE attack surface the renderer sees lives here.
 * Phase 2 and Phase 3 may change handler BODIES in src/main/ipc/*.ts,
 * but MUST NOT add new keys to this object or new channels to the preload bridge.
 *
 * Named channels only — never expose ipcRenderer directly (LAUN-06).
 *
 * D-11 (frozen IPC surface — Phase 1): The original 5 top-level keys — auth,
 * game, settings, logs, __debug — were locked. Phase 3 Plan 03-09 extended
 * under those existing keys without adding new top-level ones.
 *
 * DELIBERATE DEVIATION from Phase 1 D-11 (Pitfall 10, Phase 4 UI-06):
 *   Phase 4 adds `spotify` as a 6th top-level key. This is the ONLY intended
 *   extension of the D-11 surface in v0.1. Rationale:
 *     - spotify semantics (OAuth + external-service playback control) are
 *       orthogonal to every other namespace — no clean nest exists.
 *     - Nesting under `settings` or `__debug` would mis-group user-facing
 *       music-player state with opaque-config or debug telemetry.
 *     - One deliberate expansion is cheaper than a taxonomy refactor.
 *   The key-count regression test in preload/__tests__/index.test.ts is
 *   updated from 5 → 6 to ratchet this as the new invariant. Adding a 7th
 *   key in future phases requires the same deliberate process.
 */
contextBridge.exposeInMainWorld('wiiwho', {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    onDeviceCode: (cb: (p: unknown) => void): Unsubscribe => {
      const h = (_: unknown, p: unknown): void => cb(p)
      ipcRenderer.on('auth:device-code', h)
      return () => ipcRenderer.off('auth:device-code', h)
    }
  },
  game: {
    play: () => ipcRenderer.invoke('game:play'),
    cancel: () => ipcRenderer.invoke('game:cancel'),
    status: () => ipcRenderer.invoke('game:status'),
    onStatus: (cb: (s: unknown) => void): Unsubscribe => {
      const h = (_: unknown, s: unknown): void => cb(s)
      ipcRenderer.on('game:status-changed', h)
      return () => ipcRenderer.off('game:status-changed', h)
    },
    onProgress: (cb: (p: unknown) => void): Unsubscribe => {
      const h = (_: unknown, p: unknown): void => cb(p)
      ipcRenderer.on('game:progress', h)
      return () => ipcRenderer.off('game:progress', h)
    },
    // Phase 3 (Plan 03-09) extensions — under existing `game` key (D-11 preserved):
    onLog: (cb: (entry: unknown) => void): Unsubscribe => {
      const h = (_: unknown, entry: unknown): void => cb(entry)
      ipcRenderer.on('game:log', h)
      return () => ipcRenderer.off('game:log', h)
    },
    onExited: (cb: (ev: unknown) => void): Unsubscribe => {
      const h = (_: unknown, ev: unknown): void => cb(ev)
      ipcRenderer.on('game:exited', h)
      return () => ipcRenderer.off('game:exited', h)
    },
    onCrashed: (cb: (ev: unknown) => void): Unsubscribe => {
      const h = (_: unknown, ev: unknown): void => cb(ev)
      ipcRenderer.on('game:crashed', h)
      return () => ipcRenderer.off('game:crashed', h)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: unknown) => ipcRenderer.invoke('settings:set', patch)
  },
  logs: {
    readCrash: (opts?: { crashId?: string }) =>
      ipcRenderer.invoke('logs:read-crash', opts ?? {}),
    // Phase 3 (Plan 03-09) extensions — under existing `logs` key (D-11 preserved):
    openCrashFolder: (crashId?: string) =>
      ipcRenderer.invoke('logs:open-crash-folder', { crashId: crashId ?? null }),
    listCrashReports: () => ipcRenderer.invoke('logs:list-crashes')
  },
  __debug: {
    securityAudit: () => ipcRenderer.invoke('__security:audit')
  },
  // Phase 4 UI-06 — DELIBERATE 6th top-level key (Pitfall 10; see header above).
  spotify: {
    connect: () => ipcRenderer.invoke('spotify:connect'),
    disconnect: () => ipcRenderer.invoke('spotify:disconnect'),
    status: () => ipcRenderer.invoke('spotify:status'),
    control: {
      play: () => ipcRenderer.invoke('spotify:control:play'),
      pause: () => ipcRenderer.invoke('spotify:control:pause'),
      next: () => ipcRenderer.invoke('spotify:control:next'),
      previous: () => ipcRenderer.invoke('spotify:control:previous')
    },
    setVisibility: (v: 'focused' | 'backgrounded') =>
      ipcRenderer.invoke('spotify:set-visibility', v),
    onStatusChanged: (cb: (s: unknown) => void): Unsubscribe => {
      const h = (_: unknown, s: unknown): void => cb(s)
      ipcRenderer.on('spotify:status-changed', h)
      return () => ipcRenderer.off('spotify:status-changed', h)
    }
  }
})
