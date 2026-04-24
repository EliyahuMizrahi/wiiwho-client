/**
 * Plain-JSON settings persistence (v2 schema, auto-migrating from v1).
 *
 * Lives at `<userData>/settings.json` via paths.ts::resolveSettingsFile.
 * NOT encrypted — settings are not sensitive (ramMb, firstRunSeen flag,
 * theme accent/reduceMotion). Atomic temp+rename write matches the Phase 2
 * safeStorageCache pattern minus the encrypt/decrypt hop.
 *
 * Schema v2 adds a `theme` slice:
 *   - accent:        hex color string (default '#16e0ee', validates /^#[0-9a-fA-F]{6}$/)
 *   - reduceMotion:  'system' | 'on' | 'off' (default 'system')
 *
 * Migration path: v1 file on disk → migrateV1ToV2 → v2 in memory. Next
 * writeSettings rewrites the file in v2 shape atomically.
 *
 * Sources:
 *   .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
 *     §Settings Schema + §Persistence (atomic write)
 *   .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-18 (v2 theme slice)
 * Decisions: D-04 (1-4 GB in 512 MB steps, default 2 GB), D-18 (theme slice).
 * Requirements: LAUN-03 (RAM clamped), LAUN-04 (persists across restarts),
 *   UI-01 (accent persists), UI-03 (reduced-motion override persists).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveSettingsFile } from '../paths'

/** Legacy v1 shape — retained internally for migration typing only. */
export interface SettingsV1 {
  version: 1
  ramMb: number
  firstRunSeen: boolean
}

export interface ThemeSlice {
  /** Accent color — hex string matching /^#[0-9a-fA-F]{6}$/. */
  accent: string
  /** Reduced-motion user override. 'system' defers to OS. */
  reduceMotion: 'system' | 'on' | 'off'
}

export interface SettingsV2 {
  version: 2
  /** RAM in MiB — 1024 | 1536 | 2048 | 2560 | 3072 | 3584 | 4096 (D-04). */
  ramMb: number
  /** True after the first successful Play completes; gates one-time hint UI. */
  firstRunSeen: boolean
  /** D-18 theme slice — accent color + reduced-motion preference. */
  theme: ThemeSlice
}

/** Current schema alias — every consumer gets v2 post-migration. */
export type Settings = SettingsV2

export const DEFAULT_ACCENT = '#16e0ee' as const
export const DEFAULT_REDUCE_MOTION: ThemeSlice['reduceMotion'] = 'system'

export const DEFAULTS: SettingsV2 = {
  version: 2,
  ramMb: 2048, // D-04 default
  firstRunSeen: false,
  theme: {
    accent: DEFAULT_ACCENT,
    reduceMotion: DEFAULT_REDUCE_MOTION
  }
}

/**
 * Clamp ramMb to [1024, 4096] in 512 MiB steps (D-04 / LAUN-03).
 *
 * Non-finite input (NaN, Infinity) → DEFAULTS.ramMb. This guards against
 * `clampRam(Number(stringThatDidntParse))` paths from untrusted IPC input.
 */
export function clampRam(r: number): number {
  if (!Number.isFinite(r)) return DEFAULTS.ramMb
  const clamped = Math.max(1024, Math.min(4096, r))
  return Math.round(clamped / 512) * 512
}

/** Per-field accent validator. Invalid → DEFAULT_ACCENT. */
export function validAccent(x: unknown): string {
  return typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x) ? x : DEFAULT_ACCENT
}

/** Per-field reduceMotion validator. Unknown → 'system'. */
export function validReduceMotion(x: unknown): ThemeSlice['reduceMotion'] {
  return x === 'on' || x === 'off' || x === 'system' ? x : DEFAULT_REDUCE_MOTION
}

/**
 * Build a ThemeSlice with per-field fallback, preserving valid siblings.
 * Missing `theme` entirely → full defaults.
 */
function buildTheme(raw: unknown): ThemeSlice {
  if (!raw || typeof raw !== 'object') {
    return { accent: DEFAULT_ACCENT, reduceMotion: DEFAULT_REDUCE_MOTION }
  }
  const t = raw as Record<string, unknown>
  return {
    accent: validAccent(t.accent),
    reduceMotion: validReduceMotion(t.reduceMotion)
  }
}

/** Additive migration: v1 → v2 preserves ramMb + firstRunSeen, adds theme defaults. */
export function migrateV1ToV2(v1: SettingsV1): SettingsV2 {
  return {
    version: 2,
    ramMb: clampRam(v1.ramMb),
    firstRunSeen: !!v1.firstRunSeen,
    theme: { accent: DEFAULT_ACCENT, reduceMotion: DEFAULT_REDUCE_MOTION }
  }
}

/**
 * Migrate raw parsed JSON into a strictly-typed SettingsV2.
 *
 * - Unknown version / non-object / corrupt → DEFAULTS.
 * - version === 1 → migrateV1ToV2 (preserves ramMb + firstRunSeen).
 * - version === 2 → per-field fallback (preserves valid siblings).
 */
function migrate(raw: unknown): SettingsV2 {
  if (typeof raw !== 'object' || raw === null) return DEFAULTS
  const obj = raw as Record<string, unknown>
  switch (obj.version) {
    case 1: {
      const v = obj as Partial<SettingsV1>
      const v1: SettingsV1 = {
        version: 1,
        ramMb: clampRam(typeof v.ramMb === 'number' ? v.ramMb : DEFAULTS.ramMb),
        firstRunSeen:
          typeof v.firstRunSeen === 'boolean' ? v.firstRunSeen : DEFAULTS.firstRunSeen
      }
      return migrateV1ToV2(v1)
    }
    case 2: {
      const v = obj as Partial<SettingsV2>
      return {
        version: 2,
        ramMb: clampRam(typeof v.ramMb === 'number' ? v.ramMb : DEFAULTS.ramMb),
        firstRunSeen:
          typeof v.firstRunSeen === 'boolean' ? v.firstRunSeen : DEFAULTS.firstRunSeen,
        theme: buildTheme(v.theme)
      }
    }
    default:
      return DEFAULTS
  }
}

/**
 * Read the persisted settings from disk.
 *
 * - ENOENT (first run, no file yet) → DEFAULTS.
 * - Corrupt JSON → DEFAULTS (next write overwrites cleanly).
 * - Any other I/O error → rethrown (propagates to the IPC caller).
 *
 * Migration runs in memory; the on-disk file is not proactively rewritten
 * here — the next writeSettings call persists v2 shape. This keeps
 * readSettings idempotent and avoids surprise disk writes from a read.
 */
export async function readSettings(): Promise<SettingsV2> {
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
    return DEFAULTS
  }
}

/**
 * Incoming patch shape — any subset of the v2 writable surface. `version`
 * is NOT accepted (readers always resolve to current schema).
 */
export interface SettingsPatch {
  ramMb?: number
  firstRunSeen?: boolean
  theme?: Partial<ThemeSlice>
}

/**
 * Apply a patch over the current on-disk value and persist atomically.
 *
 * Merge semantics:
 *   - Only typed fields are honored; wrong-type patch fields fall through
 *     to the current value (per-field fallback).
 *   - `theme` is a nested patch — accent + reduceMotion are validated
 *     independently, preserving valid siblings.
 *   - ramMb is re-clamped on every write (belt-and-suspenders vs. IPC layer).
 *
 * Returns the post-write snapshot (re-read from disk) so callers get the
 * actual persisted value (e.g. after clamping / accent fallback).
 */
export async function writeSettings(patch: SettingsPatch | null | undefined): Promise<SettingsV2> {
  const current = await readSettings()
  const p = patch ?? {}

  const nextTheme: ThemeSlice = {
    accent: p.theme && 'accent' in p.theme ? validAccent(p.theme.accent) : current.theme.accent,
    reduceMotion:
      p.theme && 'reduceMotion' in p.theme
        ? validReduceMotion(p.theme.reduceMotion)
        : current.theme.reduceMotion
  }

  const next: SettingsV2 = {
    version: 2,
    ramMb: clampRam(typeof p.ramMb === 'number' ? p.ramMb : current.ramMb),
    firstRunSeen: typeof p.firstRunSeen === 'boolean' ? p.firstRunSeen : current.firstRunSeen,
    theme: nextTheme
  }

  const file = resolveSettingsFile()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8')
  await fs.rename(tmp, file)
  return next
}
