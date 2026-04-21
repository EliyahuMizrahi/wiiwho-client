import { contextBridge, ipcRenderer } from 'electron'

type Unsubscribe = () => void

/**
 * The ENTIRE attack surface the renderer sees lives here.
 * Phase 2 and Phase 3 may change handler BODIES in src/main/ipc/*.ts,
 * but MUST NOT add new keys to this object or new channels to the preload bridge.
 *
 * Named channels only — never expose ipcRenderer directly (LAUN-06).
 *
 * D-11 (frozen IPC surface): The 5 top-level keys — auth, game, settings, logs,
 * __debug — are locked. Phase 3 Plan 03-09 adds NEW subscriptions/invokes UNDER
 * those existing keys (per RESEARCH Open Q §2 autonomous recommendation): no new
 * top-level keys introduced.
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
  }
})
