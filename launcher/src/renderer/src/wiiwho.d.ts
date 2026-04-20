/**
 * The WiiWho preload bridge contract.
 *
 * Phase 2 fills the `auth.*` handler bodies; Phase 3 fills `game.*`, `settings.*`,
 * and `logs.*`. Neither phase adds new top-level keys or new channels.
 *
 * This file is the single source of truth for the renderer↔main IPC surface.
 */
export interface WiiWhoAPI {
  auth: {
    status: () => Promise<{
      loggedIn: boolean
      username?: string
      uuid?: string
    }>
    login: () => Promise<{
      ok: boolean
      username?: string
      error?: string
    }>
    logout: () => Promise<{ ok: boolean }>
    onDeviceCode: (
      cb: (p: {
        userCode: string
        verificationUri: string
        expiresInSec: number
      }) => void
    ) => () => void
  }
  game: {
    play: () => Promise<{
      ok: boolean
      stub?: boolean
      reason?: string
    }>
    cancel: () => Promise<{ ok: boolean }>
    status: () => Promise<{
      state: 'idle' | 'launching' | 'downloading' | 'playing' | 'crashed'
    }>
    onStatus: (cb: (s: { state: string }) => void) => () => void
    onProgress: (
      cb: (p: {
        bytesDone: number
        bytesTotal: number
        currentFile: string
      }) => void
    ) => () => void
  }
  settings: {
    get: () => Promise<Record<string, unknown>>
    set: (patch: Record<string, unknown>) => Promise<{ ok: boolean }>
  }
  logs: {
    readCrash: (opts?: {
      crashId?: string
    }) => Promise<{ sanitizedBody: string }>
  }
  __debug: {
    securityAudit: () => Promise<{
      contextIsolation: boolean
      nodeIntegration: boolean
      sandbox: boolean
      allTrue: boolean
    }>
  }
}

declare global {
  interface Window {
    wiiwho: WiiWhoAPI
  }
}

export {}
