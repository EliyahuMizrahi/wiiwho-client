---
phase: 02-microsoft-authentication
plan: 01
subsystem: auth
tags: [xsts, error-mapping, electron-log, jwt-redaction, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-00
    provides: electron-log dependency (installed in launcher/node_modules)
provides:
  - mapAuthError pure function translating XSTS codes + entitlement errors to D-10 UI-SPEC copy
  - installRedactor idempotent electron-log hook scrubbing JWT/refresh_token/access_token/accessToken from every log write
  - AuthErrorView TypeScript interface (code, message, helpUrl) for all downstream auth error rendering
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 03-crash-reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-leaf main-process modules — zero dependency on electron/prismarine-auth runtime at module level"
    - "Error → AuthErrorView mapping as a single switch-based translator (D-10 locked copy table in code)"
    - "electron-log hook pattern: MC_ACCESS_PATTERN first, JWT second, key-value patterns last so nested tokens redact to the most specific shape"
    - "Test strategy: mock electron-log/main via vi.mock + dynamic import + vi.resetModules() to isolate module-level install flag"

key-files:
  created:
    - launcher/src/main/auth/xstsErrors.ts
    - launcher/src/main/auth/redact.ts
    - launcher/src/main/auth/__tests__/xstsErrors.test.ts
    - launcher/src/main/auth/__tests__/redact.test.ts
  modified: []

key-decisions:
  - "Unrolled the 4-element networkCodes.forEach loop into 4 explicit it() calls so greppable it( count (16) satisfies the ≥15 acceptance criterion literally, not just at runtime."
  - "Reordered scrub() to run MC_ACCESS_PATTERN (Mojang accessToken JSON) FIRST, JWT pattern SECOND — otherwise eyJ... tokens inside \"accessToken\":\"eyJ...\" would be stripped to eyJ[REDACTED] before the MC pattern could see them, leaking the key name and quoting shape."
  - "Broadened refresh_token/access_token regex character class from [\"':] to [\"']?\\s*[:=] so JSON-quoted form (\"refresh_token\":\"val\") matches — the verbatim research-sourced regex missed this shape."
  - "Test file uses dynamic import + vi.resetModules() in beforeEach so each installRedactor test observes a fresh module-level installed flag; pure scrub tests use a one-time eager import since scrub is stateless."

patterns-established:
  - "auth/ subtree uses zero-dep pure functions where possible; only the hook itself (redact.ts) takes a dependency on electron-log"
  - "__test__ export object exposes internals (scrub, regex constants) for white-box testing without polluting the public API"
  - "Tests verify BOTH the pure function (scrub direct) AND the integration point (hook behavior on string/Error/primitive inputs)"

requirements-completed: [AUTH-03]

# Metrics
duration: 5min
completed: 2026-04-21
---

# Phase 02 Plan 01: XSTS Error Mapper + Log Redactor Summary

**XSTS/entitlement error → D-10 UI copy mapper (pure function, zero runtime deps) and idempotent electron-log hook that strips JWTs/refresh/access tokens from every log write before disk.**

## Performance

- **Duration:** ~5 min (wall)
- **Started:** 2026-04-21T03:30:57Z
- **Completed:** 2026-04-21T03:35:56Z
- **Tasks:** 2 (both TDD)
- **Files created:** 4 (2 implementation + 2 test)

## Accomplishments

- `mapAuthError(err: unknown)` returns a read-only `AuthErrorView` with verbatim D-10 UI-SPEC strings for all 5 XSTS codes (2148916233/235/236/237/238), NO_MC_PROFILE sentinel, 4 network-error shapes, unrecognized-code fallback, and generic fallback.
- `installRedactor()` registers a single electron-log hook (idempotent) that scrubs JWTs, `refresh_token`, `access_token`, and Mojang `"accessToken"` JSON shape from every string / Error.message / Error.stack before the log writer sees it.
- 30 tests pass (16 for xstsErrors, 14 for redact); full launcher suite still green at 67 tests across 8 files.

## Task Commits

Each task was committed atomically (TDD RED + GREEN per task, parallel executor `--no-verify`):

1. **Task 1 RED — xstsErrors tests** — `a57ce02` (test)
2. **Task 1 GREEN — mapAuthError implementation** — `3221614` (feat)
3. **Task 2 RED — redact tests** — `15aac0e` (test)
4. **Task 2 GREEN — installRedactor + scrub** — `43a3d26` (feat, includes Rule 1 regex fix)

## Files Created/Modified

- `launcher/src/main/auth/xstsErrors.ts` — Pure `mapAuthError` translator. Exports `AuthErrorView` interface and `mapAuthError` function. No electron / prismarine imports.
- `launcher/src/main/auth/redact.ts` — `installRedactor()` electron-log hook + exposed `__test__` object (scrub, regex constants). Only non-builtin import is `electron-log/main`.
- `launcher/src/main/auth/__tests__/xstsErrors.test.ts` — 16 `it()` cases covering every locked copy string, unrecognized-code path, 4 network error codes (each explicit), case-insensitive NO_MC_PROFILE match, and non-Error inputs.
- `launcher/src/main/auth/__tests__/redact.test.ts` — 14 `it()` cases: 7 for pure `scrub` regex branches (including multi-token-in-same-string), 7 for hook behavior (single-registration, idempotency, string / Error.message / Error.stack redaction, non-string/non-Error passthrough, mutation contract).

## Test Counts (per output spec)

| File | `it(` literal count | Runtime test count |
|------|---------------------|--------------------|
| `xstsErrors.test.ts` | 16 | 16 |
| `redact.test.ts` | 14 | 14 |

Both satisfy the plan's acceptance criteria (≥15 and ≥12 respectively).

## Full-suite verification

`pnpm run test:run` (all launcher tests, not just new ones): **67/67 passing across 8 test files** in ~400ms. Includes Phase 1 IPC handler tests + the new xstsErrors + redact tests, plus tests contributed by parallel-wave agents (02-00 shadcn + 02-02 authStore).

## Decisions Made

See frontmatter `key-decisions`. Three load-bearing ones in plain English:

1. **MC_ACCESS_PATTERN before JWT_PATTERN in scrub()** — if JWT ran first on a payload like `{"accessToken":"eyJreal.token.bytes"}`, the result would be `{"accessToken":"eyJ[REDACTED]"}`, which still leaks the JSON shape. Running MC_ACCESS first produces the cleaner `{"accessToken": "[REDACTED]"}` envelope.
2. **Broader `refresh_token` / `access_token` regex** — the research-verbatim regex `/refresh_token["':]\s*["']?[A-Za-z0-9._-]+["']?/g` failed the JSON-quoted test case `"refresh_token":"val"` because it demands the separator be one of `"`, `'`, or `:` — so given `"refresh_token":`, the `["':]` group greedily consumes the `"` and then `[A-Za-z0-9._-]+` cannot consume `:`. Tightened to `/refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g`, which handles all four shapes (bare colon, bare equals, quoted colon, quoted equals).
3. **Loop unrolled for greppable `it(` count** — plan acceptance requires `grep -c "it(" xstsErrors.test.ts ≥ 15`, but a `forEach((code) => it(...))` emits only 1 literal `it(` even though it produces 4 runtime tests. Unrolled the 4 network codes into 4 explicit `it()` blocks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Tightened refresh_token / access_token regex to match JSON-quoted form**
- **Found during:** Task 2 (redact GREEN), failing test `scrub > redacts refresh_token field pattern (JSON-style quoted)`
- **Issue:** The research-verbatim regex `/refresh_token["':]\s*["']?[A-Za-z0-9._-]+["']?/g` did not match `"refresh_token":"abc.def-ghi_123"` — character class `["':]` was consumed by the opening `"`, so the `:` that follows could not be matched by `[A-Za-z0-9._-]+`. Real refresh tokens logged by prismarine-auth / MSAL Node arrive in JSON shape, so this regex would have silently leaked them.
- **Fix:** Rewrote as `/refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g` — separates the optional wrapping quote from the required separator (colon or equals).
- **Files modified:** `launcher/src/main/auth/redact.ts`
- **Verification:** All 14 redact tests pass (7 scrub + 7 hook), including the previously failing JSON-quoted case. Full suite still green.
- **Committed in:** `43a3d26` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** No scope creep. The original regex from research would have failed against the exact JSON shape prismarine-auth returns, which is the whole point of the redactor. Fix is strictly a correctness improvement.

## Issues Encountered

- **Module-level `installed` flag persists across tests**: the first design of `redact.test.ts` cleared `pushedHooks` in `beforeEach` but left `installed = true` from the previous test, so subsequent `installRedactor()` calls were idempotent-noops and `pushedHooks[0]` was undefined. Fixed by using `vi.resetModules()` + dynamic re-import in `beforeEach` to get a fresh `installed` flag per test. Documented in frontmatter patterns-established.
- **Typecheck fails on unrelated safeStorageCache.test.ts**: parallel executor for plan 02-02 committed a RED-phase test (`d715ff8`) that references `../safeStorageCache`; by the end of the run it was also merged (`f5d4ba7 feat(02-02): implement authStore non-secret pointer for auth.bin`), resolving the typecheck dependency. Out of scope for this plan either way.

## Regex Edge Cases Discovered During TDD

Per the plan's output spec, edge cases worth recording:

1. **JSON-quoted refresh_token / access_token shape** — the research regex didn't match `"refresh_token":"val"`. Fixed (see Deviations §1). New regex: `/refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g`.
2. **Pattern ordering matters for nested tokens** — a JWT-shaped `accessToken` value inside `{"accessToken":"eyJreal.token.bytes"}` must be redacted by the MC_ACCESS_PATTERN first (producing `"accessToken": "[REDACTED]"`), otherwise JWT_PATTERN would produce `"accessToken":"eyJ[REDACTED]"` which still reveals the key-value structure. Fixed by moving MC_ACCESS_PATTERN to the top of the replace chain.
3. **Error.stack scrubbing** — added an explicit test case confirming `Error.stack` is scrubbed too (not just `Error.message`). Production code was already correct, but the plan's behavior list didn't call out stack — adding the assertion makes the contract greppable.

## User Setup Required

None - no external service configuration required. Both modules are pure code; no env vars, no tokens, no dashboards.

## Next Phase Readiness

- **Plan 02-02 (authStore)** — unblocked; already completed by parallel agent `f5d4ba7`.
- **Plan 02-03+ (AuthManager, IPC handlers)** — every `main.log` call in the AuthManager must run *after* `installRedactor()` to guarantee token scrubbing. `installRedactor()` should be called once in `launcher/src/main/index.ts` at `app.whenReady()` before `registerAuthHandlers()`. Document this at AuthManager construction time.
- **Plan 02-04 (AuthProgressDialog / ErrorBanner UI)** — renderer consumes `AuthErrorView` shape over IPC. `code`, `message`, `helpUrl` already match the UI-SPEC ErrorBanner props contract.
- **COMP-05 (Phase 3 crash report redaction)** — `installRedactor` is the existing foundation; Phase 3 extends it by routing crash dumps through the same hook.

## Self-Check: PASSED

All 4 files created and committed. All 4 task commits present in git log.

---
*Phase: 02-microsoft-authentication*
*Plan: 01*
*Completed: 2026-04-21*
