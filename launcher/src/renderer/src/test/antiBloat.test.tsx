/**
 * @vitest-environment node
 *
 * UI-05 anti-bloat static grep (Plan 04-07 Task 2).
 *
 * Reads every .ts / .tsx file under launcher/src/renderer/src/ and asserts
 * that visible-copy strings don't contain ad/news/social patterns. Excludes:
 *   - test files (**\/__tests__/**, *.test.tsx, test/*.test.*)
 *   - comment-only lines (visible-copy heuristic — match JSX/string text)
 *   - the antiBloat test itself (this file — it names banned patterns on
 *     purpose)
 *
 * Heuristic: word-boundary regexes reduce false positives but not to zero —
 * if this test flags something legitimate, add it to ALLOWLIST below with a
 * comment explaining why. The exclusion checklist doc (docs/DESIGN-SYSTEM.md)
 * is OUTSIDE launcher/src/renderer/src/ so it is never scanned.
 *
 * Why node env (not jsdom): this test touches fs only and needs no DOM.
 * Using node avoids the ~300ms jsdom setup cost and removes any chance of
 * the jsdom auto-shims interfering with fs readdir semantics on Windows.
 *
 * Source: Plan 04-07 §Task 2 <action>3.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const THIS_FILE = path.resolve(__filename)

const EXCLUDE_PATTERNS: RegExp[] = [
  /[\\/]__tests__[\\/]/,
  /\.test\.[jt]sx?$/,
  /[\\/]test[\\/]/,
  /node_modules/
]

// Banned strings — word-boundary matches. These are the things users must
// never see in visible copy. Comments naming them are skipped below.
const BANNED: RegExp[] = [
  /\b(?:advertisement|advertisements)\b/i,
  /\bonline users\b/i,
  /\bfriends online\b/i,
  /\bconcurrent users\b/i,
  /\bnews feed\b/i,
  /\bnews card\b/i,
  /\bbuy now\b/i,
  /\bsubscribe now\b/i,
  /\bpremium offer\b/i,
  /\bdiscord server\b/i,
  /\btwitter feed\b/i
]

// Allowlist: legitimate uses that the banned patterns might match but should
// pass. Currently empty — add with a clear rationale if ever needed.
const ALLOWLIST: Array<{ file: string; line: string; reason: string }> = []

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (EXCLUDE_PATTERNS.some((rx) => rx.test(full))) continue
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('UI-05 anti-bloat grep', () => {
  it('no source file contains banned marketing/social/ad strings', () => {
    const files = walk(ROOT)
    const offenders: Array<{ file: string; line: string; match: string }> = []
    for (const file of files) {
      // Skip this test file itself — it names banned patterns on purpose.
      if (path.resolve(file) === THIS_FILE) continue
      const contents = readFileSync(file, 'utf8')
      const lines = contents.split('\n')
      for (const line of lines) {
        // Visible-copy heuristic — skip comment-only lines. This is not
        // airtight (inline `// buy now` inside a JSX string would still be
        // flagged), but it keeps false positives low for the common case
        // of "documentation comment mentions what's banned".
        const trimmed = line.trim()
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*')
        )
          continue

        for (const rx of BANNED) {
          const m = rx.exec(line)
          if (m) {
            const allowed = ALLOWLIST.some(
              (a) => file.endsWith(a.file) && line.includes(a.line)
            )
            if (!allowed)
              offenders.push({ file, line: line.trim(), match: m[0] })
          }
        }
      }
    }
    if (offenders.length > 0) {
      for (const o of offenders) {
        console.error(`  ${o.file}: "${o.line}" (matched "${o.match}")`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('scans at least 30 source files (guard against exclusion rule drift)', () => {
    const files = walk(ROOT)
    // Current renderer has ~40+ .ts/.tsx source files; 30 is a comfortable
    // floor. If this ever falls below, either the repo shrank (unlikely) or
    // an EXCLUDE_PATTERNS rule is over-matching — investigate.
    expect(files.length).toBeGreaterThan(30)
  })
})
