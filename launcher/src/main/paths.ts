/**
 * Single source of truth for every platform-specific path the launcher needs.
 *
 * All downstream code (@launch/**, @monitor/**, @settings/**, ipc/**) MUST import
 * from this module rather than recomputing paths. If a new path is needed,
 * add a resolver HERE, don't inline `path.join(app.getPath('userData'), ...)`
 * elsewhere.
 *
 * Source: .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
 *   §Resource-Path Resolution (dev vs packaged).
 * Decisions: D-24 (game-dir layout), D-25 (JRE extraResources subdirs),
 *   D-17 (crash-reports dir under game dir).
 * Invariants: JRE-03 (Java binary always bundled, never system PATH),
 *   Pitfall 7 (javaw.exe on Windows — java.exe spawns a phantom console window).
 */

import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'node:path'

/**
 * Data root — matches Phase 2's safeStorageCache.resolveAuthDir() convention.
 *   Windows: %APPDATA%/Wiiwho/
 *   macOS:   ~/Library/Application Support/Wiiwho/
 */
export function resolveDataRoot(): string {
  return app.getPath('userData')
}

/** Settings file — plain JSON (NOT safeStorage — not sensitive). */
export function resolveSettingsFile(): string {
  return path.join(resolveDataRoot(), 'settings.json')
}

/** Game data dir (D-24). Sibling to auth.bin; never crosses over. */
export function resolveGameDir(): string {
  return path.join(resolveDataRoot(), 'game')
}

/** Crash-reports dir (D-17). Mojang writes here on JVM crash. */
export function resolveCrashReportsDir(): string {
  return path.join(resolveGameDir(), 'crash-reports')
}

/** JRE subdir matching the running process. D-25 paths. */
export function resolveJreDir(): string {
  const archSlot = process.arch === 'arm64' ? 'arm64' : 'x64'
  const platformSlot =
    process.platform === 'darwin'
      ? 'mac'
      : process.platform === 'win32'
        ? 'win'
        : process.platform // linux etc — unsupported below
  const subdir = `${platformSlot}-${archSlot}` // e.g. 'win-x64', 'mac-arm64', 'mac-x64'

  if (is.dev) {
    return path.join(app.getAppPath(), 'resources', 'jre', subdir)
  }
  return path.join(process.resourcesPath, 'jre', subdir)
}

/**
 * Bundled Java binary. JRE-03 invariant: must NEVER return a system PATH java.
 *
 * Windows: javaw.exe (NOT java.exe — Pitfall 7: phantom console window).
 * macOS:   Contents/Home/bin/java (standard JDK bundle layout).
 */
export function resolveJavaBinary(): string {
  const jre = resolveJreDir()
  if (process.platform === 'win32') {
    return path.join(jre, 'bin', 'javaw.exe')
  }
  if (process.platform === 'darwin') {
    return path.join(jre, 'Contents', 'Home', 'bin', 'java')
  }
  throw new Error(`Unsupported platform: ${process.platform}`) // linux deferred
}

/** Bundled Wiiwho mod jar location. Phase 3 does not classpath-inject (Phase 4 does). */
export function resolveModJar(): string {
  const base = is.dev
    ? path.join(app.getAppPath(), 'resources', 'mod')
    : path.join(process.resourcesPath, 'mod')
  return path.join(base, 'wiiwho-0.1.0.jar')
}

/**
 * Spotify OAuth token file (Phase 4 UI-06 / D-32).
 *
 * Encrypted via Electron safeStorage; sibling to the Phase 2 `auth.bin`.
 * Deliberately lives UNDER the same data root as other user data — the
 * launcher uninstall/reset story wipes the whole folder in one go.
 *
 * Consumed by launcher/src/main/spotify/tokenStore.ts exclusively — the
 * renderer must never read this file (IPC surface only).
 */
export function resolveSpotifyTokenPath(): string {
  return path.join(resolveDataRoot(), 'spotify.bin')
}
