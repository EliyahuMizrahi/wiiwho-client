/**
 * The Wiiwho preload bridge contract.
 *
 * Phase 2 fills the `auth.*` handler bodies; Phase 3 fills `game.*`, `settings.*`,
 * and `logs.*`.
 *
 * D-11 (Phase 1): 5 top-level keys — auth, game, settings, logs, __debug.
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
      error?: string
    }>
    cancel: () => Promise<{ ok: boolean }>
    status: () => Promise<{
      state:
        | 'idle'
        | 'launching'
        | 'downloading'
        | 'verifying'
        | 'starting'
        | 'playing'
        | 'failed'
        | 'crashed'
    }>
    onStatus: (cb: (s: { state: string }) => void) => () => void
    onProgress: (
      cb: (p: {
        bytesDone: number
        bytesTotal: number
        currentFile: string
      }) => void
    ) => () => void
    // Phase 3 (Plan 03-09) extensions — under existing `game` key:
    onLog: (cb: (entry: { line: string; stream: 'out' | 'err' }) => void) => () => void
    onExited: (cb: (ev: { exitCode: number | null }) => void) => () => void
    onCrashed: (
      cb: (ev: { sanitizedBody: string; crashId: string | null }) => void
    ) => () => void
  }
  settings: {
    get: () => Promise<{
      version: 2
      ramMb: number
      firstRunSeen: boolean
      theme: { accent: string; reduceMotion: 'system' | 'on' | 'off' }
    }>
    set: (
      patch: Partial<{
        ramMb: number
        firstRunSeen: boolean
        theme: Partial<{ accent: string; reduceMotion: 'system' | 'on' | 'off' }>
      }>
    ) => Promise<{
      ok: boolean
      settings: {
        version: 2
        ramMb: number
        firstRunSeen: boolean
        theme: { accent: string; reduceMotion: 'system' | 'on' | 'off' }
      }
    }>
  }
  logs: {
    readCrash: (opts?: {
      crashId?: string
    }) => Promise<{ sanitizedBody: string }>
    // Phase 3 (Plan 03-09) extensions — under existing `logs` key:
    openCrashFolder: (crashId?: string) => Promise<{ ok: boolean }>
    listCrashReports: () => Promise<{
      crashes: Array<{ crashId: string; timestamp?: string }>
    }>
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
