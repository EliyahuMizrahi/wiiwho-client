/**
 * Crash-report watcher + reader.
 *
 * D-17: on JVM non-zero exit, watch <gameDir>/crash-reports/ for a new
 * crash-<timestamp>-client.txt file within deadlineMs (default 5 000 ms).
 * Resolve the filename (success) or null (timeout). Clean exits (code 0)
 * skip this watcher entirely — per Mojang's contract, crash-reports/ is
 * only written on JVM crash, not on normal quit.
 *
 * Non-matching events (server crashes, .log files, sub-dirs, files without
 * the -client.txt suffix) are ignored. This is how we distinguish a
 * player crash from a server-side dedicated-server crash report dropping
 * into the same folder (rare in v0.1 but the filter is free).
 *
 * Plan 03-10's IPC handler is responsible for running the redactor
 * (sanitizeCrashReport from auth/redact.ts) over the bytes before they
 * reach the UI or clipboard — this module returns the RAW file contents.
 * Single-sanitizer invariant per D-21.
 *
 * Windows note: fs.watch on Windows sometimes fires two events per file
 * create (a `rename` + a follow-up `change`). The Promise resolution is
 * idempotent via the `settled` guard; closing the watcher is guarded too.
 *
 * Source: RESEARCH.md §Crash Detection Contract; Decisions D-17 (5s
 * window), D-19 ("Open crash folder" + listCrashReports).
 */

import { watch } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/** Match the `-client.txt` suffix so server-side crash dumps are ignored. */
const CRASH_FILENAME_PATTERN = /^crash-.*-client\.txt$/

/**
 * Watch a crash-reports directory for a new client-side crash file.
 *
 * Resolves with the filename (not a full path) when one appears, or null
 * when deadlineMs elapses. Never rejects — a missing directory resolves
 * null so the orchestrator can fall back to the ring-buffer tail.
 */
export function watchForCrashReport(
  crashDir: string,
  deadlineMs = 5000
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
    let watcher: ReturnType<typeof watch> | null = null
    let timer: NodeJS.Timeout | null = null

    const settle = (value: string | null): void => {
      if (settled) return
      settled = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      try {
        watcher?.close()
      } catch {
        /* already closed */
      }
      resolve(value)
    }

    try {
      watcher = watch(crashDir, { persistent: false }, (_eventType, filename) => {
        // Windows fires 'change' on rapid writes; Linux/macOS fire 'rename'.
        // Accept both — the filename check below is the real filter.
        if (!filename) return
        // node:fs typings expose `filename` as `string | null` at runtime when
        // encoding is the default 'utf8'; cast-narrow to handle the Buffer
        // overload without a typeof-narrowing edge case.
        const name = String(filename)
        if (!CRASH_FILENAME_PATTERN.test(name)) return
        settle(name)
      })
    } catch {
      // crashDir may not exist yet — settle null; orchestrator falls back
      // to the in-memory ring-buffer tail (D-11) for the failure display.
      settle(null)
      return
    }

    timer = setTimeout(() => settle(null), deadlineMs)
  })
}

/**
 * Read a crash-report file's raw UTF-8 contents. Sanitization happens at
 * the IPC boundary (Plan 03-10) via sanitizeCrashReport — never here. This
 * preserves the single-sanitizer invariant (D-21) so both display and
 * clipboard paths share one redaction pipeline.
 */
export async function readCrashReport(
  crashDir: string,
  filename: string
): Promise<string> {
  return await fs.readFile(path.join(crashDir, filename), 'utf8')
}

/**
 * Newest-first listing of client-side crash files in a crash-reports dir.
 * Filenames are ISO-ordered (`crash-YYYY-MM-DD_HH.mm.ss-client.txt`), so a
 * lexicographic descending sort is equivalent to chronological
 * newest-first. Returns [] when the directory does not exist.
 */
export async function listCrashReports(crashDir: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(crashDir)
  } catch {
    return []
  }
  return entries
    .filter((f) => CRASH_FILENAME_PATTERN.test(f))
    .sort((a, b) => b.localeCompare(a))
}
