/**
 * electron-log hook that redacts token-looking substrings from every log write.
 *
 * The JWT pattern (base64 segments starting `eyJ`), the `refresh_token` / `access_token`
 * field patterns, and Mojang/prismarine-auth's `"accessToken"` JSON shape are all
 * replaced in-place before the message hits disk. This is the single source of truth
 * for token scrubbing — every future Phase 2/Phase 3 log call routes through it.
 *
 * Source of truth for patterns: .planning/phases/02-microsoft-authentication/02-RESEARCH.md
 *   §Pitfall 6, §Example 4. Aligns with COMP-05 (tokens redacted from crash reports).
 */

import log from 'electron-log/main'

const JWT_PATTERN = /eyJ[A-Za-z0-9_.-]{20,}/g
// Matches: refresh_token: val | refresh_token=val | "refresh_token":"val" | "refresh_token": "val"
// Optional surrounding quotes on both the key and value, separator can be : or =.
const REFRESH_TOKEN_PATTERN =
  /refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const ACCESS_TOKEN_PATTERN =
  /access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const MC_ACCESS_PATTERN = /"accessToken":\s*"[^"]+"/g

function scrub(s: string): string {
  return s
    .replace(MC_ACCESS_PATTERN, '"accessToken": "[REDACTED]"')
    .replace(JWT_PATTERN, 'eyJ[REDACTED]')
    .replace(REFRESH_TOKEN_PATTERN, 'refresh_token: [REDACTED]')
    .replace(ACCESS_TOKEN_PATTERN, 'access_token: [REDACTED]')
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

// Exposed for tests; do not import from production code.
export const __test__ = {
  scrub,
  JWT_PATTERN,
  REFRESH_TOKEN_PATTERN,
  ACCESS_TOKEN_PATTERN,
  MC_ACCESS_PATTERN
}
