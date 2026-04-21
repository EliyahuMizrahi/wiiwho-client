---
phase: 02-microsoft-authentication
plan: 02
subsystem: auth
tags: [electron, safeStorage, prismarine-auth, persistence, encryption, tdd, vitest]

requires:
  - phase: 01-foundations
    provides: Electron app skeleton, userData path, vitest scaffold, main-process IPC layout
  - phase: 02-microsoft-authentication/02-00
    provides: prismarine-auth/msal-node/electron-log deps + dual vitest env
provides:
  - safeStorageCacheFactory (prismarine-auth cacheDir function, encrypts every write via safeStorage, atomic rename)
  - resolveAuthDir helper (userData/auth directory for prismarine caches)
  - AuthStoreV1 schema + readAuthStore/writeAuthStore/clearActiveAccount (non-secret pointer file)
  - resolveAuthStorePath helper (userData/auth.bin)
  - Structural AUTH-04 guarantee — refresh tokens physically cannot land on disk as JSON/base64
  - D-17 structural guard — auth.bin pointer rejects any token/secret/refresh-named keys at write boundary
affects:
  - 02-03 (AuthManager): wires safeStorageCacheFactory into Authflow cacheDir; drives authStore pointer on silent-refresh + logout
  - 02-04 (device-code UI): no direct touch, but login completion writes authStore
  - 02-05 (renderer state sync): reads authStore on main-process boot
  - 02-06 (final QA): grep-for-tokens assertions depend on this layer

tech-stack:
  added: []  # pure domain code; deps were introduced by 02-00
  patterns:
    - "Custom prismarine-auth cache factory injecting OS-native encryption (safeStorage ↔ DPAPI/Keychain/libsecret)"
    - "Atomic file I/O via temp-file + fs.rename (crash-safe writes)"
    - "Schema-validated non-secret pointer file separate from encrypted token caches (Option B)"
    - "Regex-based guard at write boundary to reject token-related keys by name (D-17)"
    - "vi.mock('electron') pattern with stateful mock for safeStorage round-trip + availability gating"

key-files:
  created:
    - launcher/src/main/auth/safeStorageCache.ts
    - launcher/src/main/auth/__tests__/safeStorageCache.test.ts
    - launcher/src/main/auth/authStore.ts
    - launcher/src/main/auth/__tests__/authStore.test.ts
  modified: []

key-decisions:
  - "Implemented Option B (separate non-secret pointer + prismarine per-cache-name encrypted files) rather than Option A (merged single-file schema). Rationale: prismarine-auth's internal cache key layout (msa/xbl/mca) is not a stable public API; Option B is robust to upstream changes and satisfies D-16 (pointer schema) + D-17 (no plaintext tokens anywhere) with less code and fewer fragile assumptions."
  - "safeStorage guard is fail-closed: when isEncryptionAvailable() === false, both read and write throw with 'safeStorage unavailable' rather than silently falling back to plaintext. Caller decides recovery strategy; no accidental plaintext path exists."
  - "authStore validates token-related keys by regex (/token|secret|refresh/i) at the write boundary. This is a structural enforcement of D-17: even if a future caller mutates the AuthStoreV1 shape, the pointer file can never physically hold token material."
  - "Atomic writes use temp-file + fs.rename on both files (safeStorageCache and authStore). Crashes mid-write either leave the old file intact or produce a complete new one — never a truncated/corrupt file. mode 0o600 on the temp file restricts readability to the owning user."
  - "In-memory memoization in safeStorageCache: first getCached hits disk; subsequent calls return the memoized object. Invalidated on setCached/setCachedPartial. prismarine-auth calls getCached many times per auth flow; memoization avoids re-decrypting the refresh token on every getToken call."

patterns-established:
  - "Pattern: prismarine-auth cacheDir factory returning {getCached,setCached,setCachedPartial} with safeStorage wrap — direct implementation of RESEARCH.md §Pattern 1"
  - "Pattern: non-secret pointer file with schema validation at every write — reusable template for any settings/state persistence that must not carry secrets"
  - "Pattern: vi.mock('electron') stateful mock with ENC:: framing — lets tests assert 'the bytes on disk are NOT the plaintext' without depending on real safeStorage"

requirements-completed: [AUTH-04]

duration: 5min
completed: 2026-04-21
---

# Phase 02 Plan 02: Token Storage Layer Summary

**Encrypted prismarine-auth cache factory (safeStorage-backed, atomic, fail-closed) + non-secret auth.bin pointer with D-17 structural guard — AUTH-04 ("refresh token never plaintext JSON") is now physically impossible to violate on disk.**

## Performance

- **Duration:** ~5 min (all TDD, no deviations)
- **Started:** 2026-04-21T03:31:22Z
- **Completed:** 2026-04-21T03:36:00Z
- **Tasks:** 2 (both TDD RED→GREEN, no REFACTOR step needed)
- **Files created:** 4 (2 implementation + 2 tests)
- **Test count:** 24 (12 per file), all green

## Accomplishments

- `safeStorageCacheFactory(baseDir): CacheDirFn` — prismarine-auth compatible factory; every `setCached` / `setCachedPartial` call encrypts via `safeStorage.encryptString` and writes atomically. Factory instantiates one cache object per `(username, cacheName)` pair exactly as prismarine-auth expects.
- `authStore.ts` — pointer file layer with full CRUD (`readAuthStore`, `writeAuthStore`, `clearActiveAccount`) and schema validation. Single-account invariant (D-16 v0.1) enforced at the write boundary.
- Option B confirmed implemented: encrypted per-cache-name files under `<userData>/auth/<username>/*.bin` + separate non-secret `<userData>/auth.bin` pointer. No plaintext token material possible on disk under any codepath.
- D-17 regex guard (`/token|secret|refresh/i`) rejects ANY account-object key that looks like token material, at the pointer write boundary. Even mutating the `AuthStoreV1` type cannot smuggle a token into the pointer file.
- Memoization in safeStorageCache avoids repeated disk reads + decrypts during a single auth flow (prismarine-auth calls `getCached` many times per Authflow invocation).

## Task Commits

Each task was committed atomically (parallel executor, --no-verify):

1. **Task 1 RED: safeStorageCache tests** — `dc3b7e6` (test)
2. **Task 1 GREEN: safeStorageCache implementation** — `24ac26f` (feat)
3. **Task 2 RED: authStore tests** — `d715ff8` (test)
4. **Task 2 GREEN: authStore implementation** — `f5d4ba7` (feat)

**Plan metadata:** will be committed by the final metadata commit step.

_All four commits passed TDD discipline — tests demonstrably failed before implementation; implementations made them pass first try with no reshaping of the test file._

## Files Created/Modified

**Created:**

- `launcher/src/main/auth/safeStorageCache.ts` — prismarine-auth cache factory. Exports `safeStorageCacheFactory`, `resolveAuthDir`, `PrismarineCache`, `CacheDirFn`, `CacheEntry`. 86 lines.
- `launcher/src/main/auth/__tests__/safeStorageCache.test.ts` — 12 tests: factory shape, empty read, file write location, bytes-don't-contain-plaintext assertion, round-trip, partial merge, atomic rename, safeStorage-unavailable read/write errors, ENOENT handling, memoization call-count, `resolveAuthDir` path shape.
- `launcher/src/main/auth/authStore.ts` — Non-secret pointer module. Exports `readAuthStore`, `writeAuthStore`, `clearActiveAccount`, `resolveAuthStorePath`, `AuthStoreV1`. 119 lines.
- `launcher/src/main/auth/__tests__/authStore.test.ts` — 12 tests: default-when-missing, corrupt-JSON, round-trip, atomic rename, version validation, length>1 rejection, missing-field rejection, D-17 token-key rejection, orphan activeAccountId rejection, clearActiveAccount mutation, clear when no-active no-op, `resolveAuthStorePath` shape.

**Not modified:** No existing Phase 1 files touched. The frozen IPC surface (`launcher/src/main/ipc/auth.ts`) is untouched — plan 02-03 will fill its handler bodies and wire these modules.

## Decisions Made

All five key decisions are listed in the frontmatter `key-decisions` field. Highlights:

- **Option B chosen (confirmed per plan's `<output>` directive):** separate pointer file + prismarine's own encrypted per-(username,cacheName) files. Simpler to maintain; avoids depending on prismarine-auth's internal cache keying; cleaner satisfaction of D-17 semantics.
- **Fail-closed safeStorage guard** — no silent fallback to plaintext under any condition.
- **D-17 regex-based structural guard** — token-related keys rejected by name at the write boundary, not just by TypeScript type.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the action blocks verbatim, both test files hit all planned behaviors on first green, no auto-fixes needed.

## Issues Encountered

**Parallel executor coordination:** While executing, parallel plan 02-00 was adding `@testing-library/*` + `jsdom` to devDependencies and rewriting `vitest.config.ts` to introduce `environmentMatchGlobs` dual-env config. This caused two transient observations, both out-of-scope for plan 02-02 and logged to `.planning/phases/02-microsoft-authentication/deferred-items.md`:

1. `pnpm run typecheck` in the launcher fails on `vitest.config.ts` line 13 — `environmentMatchGlobs` doesn't exist in vitest 4.x's `InlineConfig` type. Runtime works correctly (all 24 tests across both files pass in isolation). This is 02-00's responsibility.
2. `src/main/auth/__tests__/redact.test.ts` (from parallel plan 02-01, `installRedactor` electron-log hook) had 7 failing tests during our execution window. That is plan 02-01's scope.

Our two test files — `safeStorageCache.test.ts` and `authStore.test.ts` — passed cleanly in isolation at every gate (RED for each task, then GREEN after implementation, then final verification). Our own typecheck of the new modules is clean; only the shared `vitest.config.ts` (out-of-scope file) fails.

## Next Phase Readiness

- **Plan 02-03 (AuthManager)** can immediately `import { safeStorageCacheFactory, resolveAuthDir } from './safeStorageCache'` and pass the factory as the `cacheDir` arg to `new Authflow(username, safeStorageCacheFactory(resolveAuthDir()), options, codeCallback)`.
- **Plan 02-03 (logout path)** can call `clearActiveAccount()` from `authStore.ts` to wipe the pointer entry, then delete the `<userData>/auth/<username>/*.bin` directory to remove the encrypted caches.
- **Plan 02-03 (silent-refresh)** reads the pointer via `readAuthStore()` at main-process boot; if `activeAccountId !== null`, constructs the Authflow with that username and calls `getMinecraftJavaToken()` which triggers prismarine's internal refresh using the safeStorage-backed cache.

## Verification Evidence

| Check | Result |
|-------|--------|
| `safeStorageCache.test.ts` — 12 tests passing | Confirmed (run at 23:32:36Z, 23:34:44Z) |
| `authStore.test.ts` — 12 tests passing | Confirmed (run at 23:34:00Z, 23:34:50Z) |
| `safeStorageCache.ts` contains `safeStorage.encryptString` / `decryptString` / `isEncryptionAvailable` | 10 safeStorage references (required ≥3) |
| `authStore.ts` does NOT import `safeStorage` | 0 matches (required 0) |
| Both files use `fs.rename` for atomic writes | Confirmed both |
| `authStore.ts` contains `/token\|secret\|refresh/i` | Confirmed line 101 |
| `authStore.ts` contains "at most 1 account" | Confirmed |
| Tests count: `safeStorageCache.test.ts` has 12 `it(` calls (≥11 required) | Confirmed |
| Tests count: `authStore.test.ts` has 12 `it(` calls (≥10 required) | Confirmed |
| Task 1 TDD discipline: RED before GREEN | Confirmed — `dc3b7e6` RED commit preceded `24ac26f` GREEN commit; RED test output showed "Cannot find module '../safeStorageCache'" |
| Task 2 TDD discipline: RED before GREEN | Confirmed — `d715ff8` RED commit preceded `f5d4ba7` GREEN commit; RED test output showed "Cannot find module '../authStore'" |

---

## Self-Check: PASSED

All file and commit claims verified:
- `launcher/src/main/auth/safeStorageCache.ts` — FOUND
- `launcher/src/main/auth/authStore.ts` — FOUND
- `launcher/src/main/auth/__tests__/safeStorageCache.test.ts` — FOUND
- `launcher/src/main/auth/__tests__/authStore.test.ts` — FOUND
- Commit `dc3b7e6` (test 02-02 safeStorageCache RED) — FOUND
- Commit `24ac26f` (feat 02-02 safeStorageCache GREEN) — FOUND
- Commit `d715ff8` (test 02-02 authStore RED) — FOUND
- Commit `f5d4ba7` (feat 02-02 authStore GREEN) — FOUND

*Phase: 02-microsoft-authentication*
*Plan: 02*
*Completed: 2026-04-21*
