/**
 * Plain-JSON settings persistence (v1 schema).
 *
 * Lives at `<userData>/settings.json` via paths.ts::resolveSettingsFile.
 * NOT encrypted — settings are not sensitive (ramMb, firstRunSeen flag).
 * Atomic temp+rename matches the Phase 2 safeStorageCache write pattern,
 * minus the safeStorage encrypt/decrypt hop.
 *
 * Sources:
 *   .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
 *   §Settings Schema + §Persistence (atomic write).
 * Decisions: D-04 (1-4 GB in 512 MB steps, default 2 GB).
 * Requirements: LAUN-03 (RAM clamped), LAUN-04 (persists across restarts).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveSettingsFile } from '../paths'

export interface SettingsV1 {
  version: 1
  /** RAM in MiB — 1024 | 1536 | 2048 | 2560 | 3072 | 3584 | 4096 (D-04). */
  ramMb: number
  /** True after the first successful Play completes; gates one-time hint UI. */
  firstRunSeen: boolean
}

export const DEFAULTS: SettingsV1 = {
  version: 1,
  ramMb: 2048, // D-04 default
  firstRunSeen: false
}

/**
 * Clamp ramMb to [1024, 4096] in 512 MiB steps (D-04 / LAUN-03).
 *
 * Non-finite input (NaN, Infinity) → DEFAULTS.ramMb. This guards against
 * `clampRam(Number(stringThatDidntParse))` paths from untrusted IPC input.
 */
export function clampRam(r: number): number {
  if (!Number.isFinite(r)) return DEFAULTS.ramMb
  const bounded = Math.max(1024, Math.min(4096, r))
  return Math.round(bounded / 512) * 512
}

/**
 * Migrate raw parsed JSON into a strictly-typed SettingsV1.
 *
 * Unknown version or non-object input → DEFAULTS. Partial-invalid fields
 * (e.g. ramMb === 'hello') fall back to DEFAULTS for that field while
 * preserving every other valid field in the record.
 */
function migrate(raw: unknown): SettingsV1 {
  if (typeof raw !== 'object' || raw === null) return DEFAULTS
  const obj = raw as Record<string, unknown>
  switch (obj.version) {
    case 1: {
      const v = obj as Partial<SettingsV1>
      return {
        version: 1,
        ramMb: clampRam(typeof v.ramMb === 'number' ? v.ramMb : DEFAULTS.ramMb),
        firstRunSeen:
          typeof v.firstRunSeen === 'boolean'
            ? v.firstRunSeen
            : DEFAULTS.firstRunSeen
      }
    }
    default:
      // Unknown / absent version → reset to defaults. Acceptable for v0.1
      // since the schema has one data field (ramMb) with a safe fallback.
      // If we ever ship v2, extend this switch instead of expanding the
      // default branch.
      return DEFAULTS
  }
}

/**
 * Read the persisted settings from disk.
 *
 * - ENOENT (first run, no file yet) → DEFAULTS.
 * - Corrupt JSON → DEFAULTS (next write overwrites cleanly).
 * - Any other I/O error → rethrown (propagates to the IPC caller).
 */
export async function readSettings(): Promise<SettingsV1> {
  const file = resolveSettingsFile()
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULTS
    throw err
  }
  try {
    return migrate(JSON.parse(raw))
  } catch {
    // Corrupt JSON — recover gracefully; the next write will replace the file.
    return DEFAULTS
  }
}

/**
 * Persist the settings atomically.
 *
 * Strategy: write to `<file>.tmp`, then rename over the final path. This
 * guarantees readers never observe a half-written settings.json after a
 * crash or power loss (POSIX + Windows both treat `rename` as atomic on
 * the same volume).
 *
 * Re-clamps ramMb on every write as a belt-and-suspenders measure against
 * a caller that bypassed `clampRam` — the IPC layer also clamps, but the
 * store is the last line of defense.
 */
export async function writeSettings(v: SettingsV1): Promise<void> {
  const file = resolveSettingsFile()
  const safe: SettingsV1 = {
    version: 1,
    ramMb: clampRam(v.ramMb),
    firstRunSeen: !!v.firstRunSeen
  }
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(safe, null, 2), 'utf8')
  await fs.rename(tmp, file)
}
