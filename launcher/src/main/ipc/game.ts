/**
 * Launch orchestrator — the single integration point for Phase 3's launch loop.
 *
 * game:play click → read settings → get MC token → manifest → libraries →
 * assets → natives → build argv → spawn JVM → log-parse → sentinel-triggered
 * window.minimize() (D-12) → exit watch → crash watch → sanitize → push.
 *
 * Invariants guarded here (cross-check with 03-10-PLAN.md success criteria):
 *   - D-09: state transitions flow through setStatus(downloading → verifying
 *     → starting → playing → idle) — single state machine.
 *   - D-12: on LogParser.onMainMenu, we call `mainWindow.minimize()`.
 *   - D-13: `game:cancel` fires AbortController.abort(); fetches + spawn honor
 *     the signal. Cancel during `starting`/`playing` is ignored by downstream
 *     modules but the guard in `game:cancel` is unconditional (one-way signal).
 *   - D-17: non-zero JVM exit → watchForCrashReport(5s). If it resolves a
 *     filename → read raw body → sanitizeCrashReport(body) → push game:crashed.
 *     Null → push game:exited only (renderer falls back to ring-buffer tail).
 *   - D-21 / COMP-05: the crash body reaching the renderer is ALWAYS
 *     sanitizeCrashReport(rawBody) — never the raw. A unit test in game.test.ts
 *     locks this as a regression guard.
 *   - Already-running guard: `game:play` invoked while `currentPhase !== 'idle'`
 *     returns `{ok:false, reason:'already-running'}` without re-orchestrating.
 *
 * The orchestrator does NOT own crash-viewer IPC (logs:read-crash +
 * logs:open-crash-folder + logs:list-crashes) — that is Task 2 (ipc/logs.ts).
 */

import { ipcMain, type BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { readSettings } from '../settings/store'
import { getAuthManager } from '../auth/AuthManager'
import { sanitizeCrashReport } from '../auth/redact'
import { fetchAndCacheManifest, resolveVersion } from '../launch/manifest'
import { ensureClientJar, ensureLibraries, resolveClasspath } from '../launch/libraries'
import { ensureAssets } from '../launch/assets'
import { ensureNatives } from '../launch/natives'
import { buildArgv } from '../launch/args'
import { spawnGame } from '../launch/spawn'
import { LogParser } from '../monitor/logParser'
import { watchForCrashReport, readCrashReport } from '../monitor/crashReport'
import { resolveJavaBinary, resolveGameDir, resolveCrashReportsDir } from '../paths'

/**
 * Phase label we track internally. Matches the game:status-changed payload
 * states plus 'idle' as the resting state. The renderer store (stores/game.ts)
 * maps 'starting'/'launching' onto the same UI label — we emit 'starting' here.
 */
type Phase = 'idle' | 'downloading' | 'verifying' | 'starting' | 'playing'

type GetWin = () => BrowserWindow | null

// ---- Module-level state ------------------------------------------------------
//
// Only one launch is allowed in flight at a time. A module-level phase +
// AbortController is sufficient for v0.1 (single-window launcher); a future
// multi-window topology would need per-window state instead.

let currentPhase: Phase = 'idle'
let currentAbort: AbortController | null = null

function send(getWin: GetWin, channel: string, payload: unknown): void {
  const win = getWin()
  if (!win) return
  // Electron's webContents may be destroyed mid-await on window close; guard
  // defensively so a final push never throws once the user has exited the app.
  try {
    if (typeof (win as { isDestroyed?: () => boolean }).isDestroyed === 'function') {
      if ((win as { isDestroyed: () => boolean }).isDestroyed()) return
    }
    win.webContents.send(channel, payload)
  } catch (err) {
    log.warn('[game] webContents.send failed', err)
  }
}

function setStatus(getWin: GetWin, state: Phase): void {
  currentPhase = state
  send(getWin, 'game:status-changed', { state })
}

/**
 * Whether a JVM exit code represents a clean / expected stop that should NOT
 * trigger the crash viewer (D-17). Code 0 = user quit cleanly; 130 = SIGINT;
 * 143 = SIGTERM. Any other non-zero code is treated as a crash candidate.
 */
function isCleanExit(code: number | null): boolean {
  return code === 0 || code === 130 || code === 143
}

export function registerGameHandlers(getWin: GetWin): void {
  ipcMain.handle('game:play', async () => {
    // Already-running guard — D-09 single state machine. A second Play click
    // while the pipeline is in flight is a UI glitch, not a new launch.
    if (currentPhase !== 'idle') {
      return { ok: false, reason: 'already-running' as const }
    }

    const abort = new AbortController()
    currentAbort = abort

    // Track whether we advanced past the initial setup (settings + token). If
    // setStatus has fired at least once we must drive the phase back to 'idle'
    // at the end so the renderer's morphing Play button returns to 'Play'.
    let statusEmitted = false

    try {
      // 1. Read settings (RAM for heap sizing).
      const settings = await readSettings()

      // 2. Fresh MC token from AuthManager (LCH-06). This throws if the user
      //    is logged out or safeStorage is unavailable; Rule 4-style
      //    architectural fix would be to surface a login prompt, but in the
      //    orchestrator we simply fail fast and the renderer's error path
      //    shows a failed banner.
      const mc = await getAuthManager().getMinecraftToken()

      // 3. Downloading phase: manifest + libraries + assets (+ client.jar).
      setStatus(getWin, 'downloading')
      statusEmitted = true
      const gameDir = resolveGameDir()
      const progress = (p: {
        bytesDone: number
        bytesTotal: number
        currentFile: string
      }): void => {
        send(getWin, 'game:progress', p)
      }

      await fetchAndCacheManifest('1.8.9', gameDir, fetch, abort.signal)
      const resolved = await resolveVersion(gameDir, '1.8.9')
      await ensureClientJar(resolved, gameDir, progress, abort.signal)
      await ensureLibraries(resolved, gameDir, progress, abort.signal)
      await ensureAssets(resolved, gameDir, progress, abort.signal)

      // 4. Verifying phase — xmcl has already SHA1-verified each download, so
      //    this is a brief UI flip rather than a separate pass. The phase
      //    exists so the morphing Play button can render "Verifying…" per D-09.
      setStatus(getWin, 'verifying')
      const nativesDir = await ensureNatives(resolved, gameDir)

      // 5. Starting phase — build argv + spawn. Cancel window closes (D-13).
      setStatus(getWin, 'starting')
      const javaPath = resolveJavaBinary()
      const classpath = resolveClasspath(resolved, gameDir)
      const argv = buildArgv(resolved, {
        ramMb: settings.ramMb,
        gameDir,
        nativesDir,
        classpath,
        username: mc.username,
        uuid: mc.uuid,
        accessToken: mc.accessToken,
        launcherVersion: '0.1.0'
      })

      // 6. LogParser — line consumer + main-menu sentinel. On sentinel we
      //    flip to 'playing' and minimize the launcher (D-12).
      const parser = new LogParser({
        onLine: (entry) => send(getWin, 'game:log', entry),
        onMainMenu: () => {
          setStatus(getWin, 'playing')
          const w = getWin()
          if (w) {
            const maybe = w as unknown as { isDestroyed?: () => boolean }
            const destroyed = typeof maybe.isDestroyed === 'function' ? maybe.isDestroyed() : false
            if (!destroyed) w.minimize()
          }
        }
      })

      // 7. Spawn.
      const { exitCode } = await spawnGame({
        javaPath,
        argv,
        cwd: gameDir,
        abortSignal: abort.signal,
        onLine: (line, stream) => parser.ingest(line, stream)
      })
      parser.stop()
      send(getWin, 'game:exited', { exitCode })

      // 8. Crash watch (D-17). Only on unclean exit — clean quits are silent
      //    per Mojang's crash-reports/ contract.
      if (!isCleanExit(exitCode)) {
        const crashDir = resolveCrashReportsDir()
        const filename = await watchForCrashReport(crashDir, 5000)
        if (filename) {
          const raw = await readCrashReport(crashDir, filename)
          // D-21 / COMP-05: the push payload body is ALWAYS the sanitized
          // output — never the raw bytes. CrashViewer.tsx has a regression
          // guard that forbids importing redact from the renderer, so this
          // is literally the only sanitization point in the crash path.
          const sanitizedBody = sanitizeCrashReport(raw)
          send(getWin, 'game:crashed', {
            sanitizedBody,
            crashId: filename
          })
        }
      }

      setStatus(getWin, 'idle')
      return { ok: true as const }
    } catch (err) {
      // Includes: abort errors (D-13 cancel), auth errors (log out / keychain),
      // download errors, spawn errors. The renderer maps this to a failed
      // banner (PlayButton's fail UI) via the log-tail fallback — we don't
      // need to emit a separate 'failed' state push because the exit fallback
      // timer in stores/game.ts drives that transition from the onExited push.
      log.warn('[game] play failed:', err)
      if (statusEmitted) {
        setStatus(getWin, 'idle')
      } else {
        // No phase flip occurred yet — still emit an idle transition so the
        // renderer's morphing button resets if it had staged an optimistic
        // 'downloading' transition (stores/game.ts does this for snappiness).
        setStatus(getWin, 'idle')
      }
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err)
      }
    } finally {
      if (currentAbort === abort) {
        currentAbort = null
      }
    }
  })

  ipcMain.handle('game:cancel', async () => {
    // One-way signal: downstream xmcl + spawn will honor / ignore based on
    // their own cancel windows (D-13: only downloading + verifying are
    // meaningfully cancellable; starting + playing treat this as a no-op).
    currentAbort?.abort()
    return { ok: true as const }
  })

  ipcMain.handle('game:status', async () => {
    return { state: currentPhase }
  })
}

// Exposed for tests only — do not import from production code.
export const __test__ = {
  resetForTests: (): void => {
    currentPhase = 'idle'
    currentAbort = null
  }
}
