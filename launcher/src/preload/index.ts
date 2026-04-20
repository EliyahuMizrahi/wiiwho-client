import { contextBridge, ipcRenderer } from 'electron'

type Unsubscribe = () => void

/**
 * The ENTIRE attack surface the renderer sees lives here.
 * Phase 2 and Phase 3 may change handler BODIES in src/main/ipc/*.ts,
 * but MUST NOT add new keys to this object or new channels to the preload bridge.
 *
 * Named channels only — never expose ipcRenderer directly (LAUN-06).
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
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: unknown) => ipcRenderer.invoke('settings:set', patch)
  },
  logs: {
    readCrash: (opts?: { crashId?: string }) =>
      ipcRenderer.invoke('logs:read-crash', opts ?? {})
  },
  __debug: {
    securityAudit: () => ipcRenderer.invoke('__security:audit')
  }
})
