/**
 * electron-log hook that redacts token-looking substrings from every log write,
 * AND the single-source sanitizer for crash reports (D-21).
 *
 * Phase 2 established the JWT / refresh_token / access_token / Mojang-accessToken
 * patterns and the idempotent `installRedactor()` entrypoint.
 *
 * Phase 3 extends the pattern list per D-20 with 6 additional matchers
 * (MC --accessToken CLI form, Windows/macOS user paths, %USERNAME%, $USER, $HOME)
 * and exports `sanitizeCrashReport` — THE SAME `scrub()` function the electron-log
 * hook uses. This is the D-21 invariant: one code path drives both display and
 * clipboard so the user can never see a string that isn't also scrubbed on copy
 * and vice versa.
 *
 * Source of truth for patterns:
 *   Phase 2 — .planning/phases/02-microsoft-authentication/02-RESEARCH.md §Pitfall 6
 *   Phase 3 — .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
 *             §Redaction Patterns (D-20 extension)
 * Aligns with COMP-05 (tokens + usernames redacted from crash reports).
 */

import log from 'electron-log/main'

// ---- Phase 2 patterns (preserved verbatim — DO NOT alter) --------------------

const JWT_PATTERN = /eyJ[A-Za-z0-9_.-]{20,}/g
// Matches: refresh_token: val | refresh_token=val | "refresh_token":"val" | "refresh_token": "val"
// Optional surrounding quotes on both the key and value, separator can be : or =.
const REFRESH_TOKEN_PATTERN =
  /refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const ACCESS_TOKEN_PATTERN =
  /access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const MC_ACCESS_PATTERN = /"accessToken":\s*"[^"]+"/g

// ---- Phase 3 D-20 extensions -------------------------------------------------

// 1. Raw MC access token shape from prismarine-auth's getMinecraftJavaToken().
//    Contextual match — the --accessToken CLI flag form; NEVER try to match
//    the raw token body alone (false positives on hashes, build IDs).
const MC_TOKEN_CLI_PATTERN = /--accessToken\s+[A-Za-z0-9._-]+/g

// 2. Windows user path: C:\Users\<name>\... (backslash OR forward slash).
//    Three capture groups so the replacement can preserve the exact separator
//    style the source used — $1 = drive+first-sep, $2 = second-sep, $3 = name.
const WINDOWS_USER_PATH_PATTERN = /([A-Z]:[\\/])Users([\\/])([^\\/\s"'`]+)/g

// 3. macOS user path: /Users/<name>/...
const MACOS_USER_PATH_PATTERN = /\/Users\/([^/\s"'`]+)/g

// 4. Unexpanded env references (appear in logged launch commands).
const WINDOWS_ENV_USERNAME_PATTERN = /%USERNAME%/g
const UNIX_ENV_USER_PATTERN = /\$USER\b/g
const UNIX_ENV_HOME_PATTERN = /\$HOME\b/g

/**
 * Apply all patterns in a fixed order — longest/most-specific FIRST so an
 * inner match never gets eaten by a broader regex that runs first.
 *
 * Order rationale:
 *   1. MC_TOKEN_CLI    — longest specific prefix (`--accessToken ...`)
 *   2. MC_ACCESS       — JSON-shape access token (`"accessToken": "..."`)
 *   3. JWT             — eyJ... bodies (may appear inside either of the above
 *                         contexts, but after those have already been replaced
 *                         with `[REDACTED]`, JWT still safely replaces any
 *                         loose JWTs remaining in the string)
 *   4. REFRESH_TOKEN   — generic refresh_token field
 *   5. ACCESS_TOKEN    — generic access_token field
 *   6. WINDOWS path    — most-specific OS path shape
 *   7. MACOS path
 *   8. %USERNAME%
 *   9. $USER
 *   10. $HOME
 */
function scrub(s: string): string {
  return s
    .replace(MC_TOKEN_CLI_PATTERN, '--accessToken [REDACTED]')
    .replace(MC_ACCESS_PATTERN, '"accessToken": "[REDACTED]"')
    .replace(JWT_PATTERN, 'eyJ[REDACTED]')
    .replace(REFRESH_TOKEN_PATTERN, 'refresh_token: [REDACTED]')
    .replace(ACCESS_TOKEN_PATTERN, 'access_token: [REDACTED]')
    // Windows path — preserve both separators the source used ($1 = drive+sep1, $2 = sep2).
    .replace(WINDOWS_USER_PATH_PATTERN, '$1Users$2<USER>')
    .replace(MACOS_USER_PATH_PATTERN, '/Users/<USER>')
    .replace(WINDOWS_ENV_USERNAME_PATTERN, '<USER>')
    .replace(UNIX_ENV_USER_PATTERN, '<USER>')
    .replace(UNIX_ENV_HOME_PATTERN, '<HOME>')
}

let installed = false

export function installRedactor(): void {
  if (installed) return
  installed = true
  log.hooks.push((message) => {
    for (let i = 0; i < message.data.length; i++) {
      const part = message.data[i]
      if (typeof part === 'string') {
        message.data[i] = scrub(part)
      } else if (part instanceof Error) {
        const scrubbed = new Error(scrub(part.message))
        scrubbed.name = part.name
        scrubbed.stack = part.stack ? scrub(part.stack) : part.stack
        message.data[i] = scrubbed
      }
    }
    return message
  })
}

/**
 * Sanitizes a crash report body. SAME `scrub()` implementation the electron-log
 * hook uses — D-21 single-sanitizer invariant.
 *
 * Called by Plan 03-10's logs:read-crash IPC handler. The returned string is
 * what the renderer both DISPLAYS and COPIES to the clipboard — enforcing D-21
 * via a single source of truth.
 */
export function sanitizeCrashReport(raw: string): string {
  return scrub(raw)
}

// Exposed for tests; do not import from production code.
export const __test__ = {
  scrub,
  JWT_PATTERN,
  REFRESH_TOKEN_PATTERN,
  ACCESS_TOKEN_PATTERN,
  MC_ACCESS_PATTERN,
  MC_TOKEN_CLI_PATTERN,
  WINDOWS_USER_PATH_PATTERN,
  MACOS_USER_PATH_PATTERN,
  WINDOWS_ENV_USERNAME_PATTERN,
  UNIX_ENV_USER_PATTERN,
  UNIX_ENV_HOME_PATTERN
}
