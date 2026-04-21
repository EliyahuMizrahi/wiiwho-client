/**
 * Renderer-side game lifecycle store (Zustand).
 *
 * Mirrors main-process launch phase (Plan 03-10 orchestrator). Updates
 * flow in via frozen IPC subscriptions — no polling.
 *
 * Phase machine (D-09 + D-11 + D-13 + D-17 + D-18):
 *   idle
 *     → downloading(%)  → verifying → starting → playing
 *     → crashed         (non-zero exit + onCrashed push from main)
 *     → failed          (non-zero exit with NO crash file within 6s — D-11)
 *   playing | failed | crashed → idle (via "Play again" / "Close" / next play())
 *
 * D-21 note (relevant to CrashViewer, not this store):
 *   `sanitizedBody` arrives from the main process already scrubbed via
 *   `sanitizeCrashReport` (launcher/src/main/auth/redact.ts). This store
 *   does NOT re-sanitize — it forwards the string as-is to the UI.
 *
 * IPC contract note:
 *   This store consumes window.wiiwho.game.{onLog,onExited,onCrashed} which
 *   Plan 03-09 adds to the preload bridge + `wiiwho.d.ts` canonical types.
 *   At Plan 03-08 execution time those subscription methods are expected to
 *   be present on the runtime surface. We augment the compile-time type
 *   locally (see GameAPIExtensions below) so this file type-checks stand-
 *   alone; Plan 03-09's wiiwho.d.ts update will supersede the local augment
 *   without source changes here.
 *
 * Source: 03-08-renderer-game-and-crash-PLAN.md + 03-CONTEXT.md D-09/D-11/D-13/D-17/D-18
 */

import { create } from 'zustand'

// ---- Types -------------------------------------------------------------------

export interface LogEntry {
  line: string
  stream: 'out' | 'err'
}

export type GamePhase =
  | { state: 'idle' }
  | { state: 'downloading'; percent: number; currentFile: string }
  | { state: 'verifying' }
  | { state: 'starting' }
  | { state: 'playing' }
  | { state: 'failed'; message: string; logTail: LogEntry[] }
  | { state: 'crashed'; sanitizedBody: string; crashId: string | null }

export interface GameStoreState {
  phase: GamePhase
  logTail: LogEntry[]
  subscribed: boolean

  subscribe: () => () => void
  unsubscribe: () => void
  play: () => Promise<void>
  cancel: () => Promise<void>
  resetToIdle: () => void
}

/**
 * Local type augmentation for subscription methods Plan 03-09 will canonicalize
 * in wiiwho.d.ts. Kept narrow so diff-to-canonical-types is trivial once 03-09
 * lands — delete this interface, no other change needed.
 */
interface GameAPIExtensions {
  onLog: (cb: (entry: LogEntry) => void) => () => void
  onExited: (cb: (ev: { exitCode: number | null }) => void) => () => void
  onCrashed: (
    cb: (ev: { sanitizedBody: string; crashId: string | null }) => void
  ) => () => void
}

// ---- Constants ---------------------------------------------------------------

/** D-11: last N log lines surfaced on the fail path. */
const LOG_TAIL_CAPACITY = 30

/**
 * D-17: wait this long after a non-zero exit for an `onCrashed` push before
 * falling back to the log-tail "failed" state. The RESEARCH.md §Crash watcher
 * section suggests 5s; we use 6s to give the crash-reports/ watcher a small
 * margin over its own 5s deadline.
 */
const CRASH_FALLBACK_MS = 6000

// ---- Module-level state (shared across store instance) ----------------------
//
// Zustand's `create` runs once per import; we keep the IPC unsubscribe
// callbacks and the fallback timer outside the reactive state so re-renders
// never touch them. (Putting a Timeout handle into state would add a stale-
// reference footgun on strict-mode double-mount.)

let unsubs: Array<() => void> = []
let exitFallbackTimer: ReturnType<typeof setTimeout> | null = null

// ---- Store -------------------------------------------------------------------

export const useGameStore = create<GameStoreState>((set, get) => ({
  phase: { state: 'idle' },
  logTail: [],
  subscribed: false,

  subscribe: () => {
    if (get().subscribed) return get().unsubscribe
    const g = window.wiiwho.game as typeof window.wiiwho.game & GameAPIExtensions

    const uStatus = g.onStatus((s) => {
      const next = s.state
      // Map main-process status strings to phase transitions. Progress details
      // (percent/currentFile) flow in via onProgress; onStatus is responsible
      // for the phase label only.
      if (next === 'downloading') {
        const current = get().phase
        if (current.state !== 'downloading') {
          set({ phase: { state: 'downloading', percent: 0, currentFile: '' } })
        }
      } else if (next === 'verifying') {
        set({ phase: { state: 'verifying' } })
      } else if (next === 'starting' || next === 'launching') {
        // Main may emit either label for this phase depending on the exact
        // lifecycle hook; treat both as the same UI state (D-09 → "Starting Minecraft…").
        set({ phase: { state: 'starting' } })
      } else if (next === 'playing') {
        set({ phase: { state: 'playing' } })
      } else if (next === 'idle') {
        set({ phase: { state: 'idle' } })
      }
      // Unknown states are silently ignored — forward-compat for any main-side
      // label churn.
    })

    const uProgress = g.onProgress((p) => {
      const current = get().phase
      if (current.state !== 'downloading') return
      const percent =
        p.bytesTotal > 0 ? Math.round((p.bytesDone / p.bytesTotal) * 100) : 0
      set({
        phase: {
          state: 'downloading',
          percent,
          currentFile: p.currentFile
        }
      })
    })

    const uLog = g.onLog((entry) => {
      const tail = get().logTail
      const next =
        tail.length >= LOG_TAIL_CAPACITY
          ? [...tail.slice(tail.length - LOG_TAIL_CAPACITY + 1), entry]
          : [...tail, entry]
      set({ logTail: next })
    })

    const uExited = g.onExited((ev) => {
      // D-17: zero or "clean-kill signal" exits are silent — user either quit
      // the game normally (exit 0) or the launcher cancelled the JVM (130 =
      // SIGINT, 143 = SIGTERM on POSIX; Windows cancel path also resolves to
      // one of these after the cancel IPC fires).
      if (ev.exitCode === 0 || ev.exitCode === 130 || ev.exitCode === 143) {
        if (exitFallbackTimer) {
          clearTimeout(exitFallbackTimer)
          exitFallbackTimer = null
        }
        set({ phase: { state: 'idle' } })
        return
      }

      // Non-zero exit: arm the fallback timer. If onCrashed fires within the
      // window, `uCrashed` below cancels this timer and commits to 'crashed'.
      // If not, we land on 'failed' with the recent log tail (D-11 fail UI).
      if (exitFallbackTimer) clearTimeout(exitFallbackTimer)
      exitFallbackTimer = setTimeout(() => {
        exitFallbackTimer = null
        const current = get().phase
        if (current.state === 'crashed') return // race guard
        const message = `JVM exited with code ${ev.exitCode ?? 'null'}. No crash report was written.`
        set({
          phase: {
            state: 'failed',
            message,
            logTail: get().logTail.slice(-LOG_TAIL_CAPACITY)
          }
        })
      }, CRASH_FALLBACK_MS)
    })

    const uCrashed = g.onCrashed((ev) => {
      if (exitFallbackTimer) {
        clearTimeout(exitFallbackTimer)
        exitFallbackTimer = null
      }
      set({
        phase: {
          state: 'crashed',
          sanitizedBody: ev.sanitizedBody,
          crashId: ev.crashId
        }
      })
    })

    unsubs = [uStatus, uProgress, uLog, uExited, uCrashed]
    set({ subscribed: true })
    return get().unsubscribe
  },

  unsubscribe: () => {
    for (const u of unsubs) {
      try {
        u()
      } catch {
        // Individual listener unsubscribes must not block tearing down the rest.
      }
    }
    unsubs = []
    if (exitFallbackTimer) {
      clearTimeout(exitFallbackTimer)
      exitFallbackTimer = null
    }
    set({ subscribed: false })
  },

  play: async () => {
    // Optimistic transition so the button morphs immediately; the main-side
    // status push will overwrite this with the authoritative phase within
    // a couple of ticks.
    set({
      phase: { state: 'downloading', percent: 0, currentFile: '' },
      logTail: []
    })
    await window.wiiwho.game.play()
  },

  cancel: async () => {
    const current = get().phase.state
    // D-13: cancel window closes once status reads 'Starting Minecraft…'.
    if (current !== 'downloading' && current !== 'verifying') return
    await window.wiiwho.game.cancel()
    set({ phase: { state: 'idle' } })
  },

  resetToIdle: () => {
    set({ phase: { state: 'idle' }, logTail: [] })
  }
}))
