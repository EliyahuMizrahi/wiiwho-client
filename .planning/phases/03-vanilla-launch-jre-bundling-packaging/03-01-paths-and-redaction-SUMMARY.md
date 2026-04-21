---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 01
subsystem: main/launcher
tags:
  - paths
  - redaction
  - sanitizer
  - JRE-03
  - D-20
  - D-21
  - COMP-05
dependency_graph:
  requires:
    - launcher/src/main/auth/safeStorageCache.ts
    - launcher/src/main/auth/redact.ts (Phase 2 baseline)
    - electron (app API)
    - "@electron-toolkit/utils (is.dev)"
  provides:
    - launcher/src/main/paths.ts
    - launcher/src/main/paths.test.ts
    - launcher/src/main/auth/redact.ts (extended)
    - launcher/src/main/auth/__tests__/redact.test.ts (extended)
  affects:
    - "Every downstream Phase 3 plan that needs a platform path (03-02 settings, 03-03 manifest/libs, 03-04 natives/args, 03-05 spawn, 03-06 log-parser/crash-watch, 03-10 IPC, 03-11 Windows packaging, 03-12 macOS DMG)"
    - "Plan 03-08 CrashViewer (imports sanitizeCrashReport via IPC surface)"
    - "Plan 03-10 logs:read-crash handler (calls sanitizeCrashReport on the file body before returning it)"
tech_stack:
  added: []
  patterns:
    - "Platform-branched path resolvers via process.platform + process.arch inspection"
    - "dev vs packaged path discrimination via @electron-toolkit/utils is.dev"
    - "Dynamic-import vitest pattern for per-test platform stubbing (Object.defineProperty + vi.resetModules)"
    - "Single-source sanitizer: one scrub() function powers both the electron-log hook AND the crash-viewer sanitizer (D-21)"
    - "3-capture-group Windows path regex preserves source separator style in replacement"
key_files:
  created:
    - launcher/src/main/paths.ts
    - launcher/src/main/paths.test.ts
  modified:
    - launcher/src/main/auth/redact.ts
    - launcher/src/main/auth/__tests__/redact.test.ts
decisions:
  - "Inline fixture string in redact.test.ts (rather than reading __fixtures__/fake-crash-report.txt) — keeps the test parallel-safe and self-contained; Plan 03-00 creates the on-disk fixture separately for consumers that need file I/O"
  - "3-group Windows path regex + '$1Users$2<USER>' replacement — fixes the RESEARCH.md draft's '$1Users$1<USER>' which would have doubled the drive-letter separator instead of preserving the second separator"
  - "scrub() application order locked: MC_TOKEN_CLI → MC_ACCESS → JWT → refresh/access_token → Windows path → macOS path → %USERNAME% → \\$USER → \\$HOME. Longest/most-specific first to prevent inner matches being eaten."
  - "\\b word-boundary on \\$USER and \\$HOME regexes — prevents false-positive rewrites of \\$USERNAME → <USER>NAME or \\$HOMEPAGE → <HOME>PAGE"
metrics:
  duration: "~5 min"
  tasks_completed: 2
  files_touched: 4
  tests_added: 20 # 11 in paths.test.ts + 9 in redact.test.ts
  tests_total_suite: 161
  completed: "2026-04-21"
---

# Phase 3 Plan 01: Paths and Redaction Summary

Single source of truth for every platform-specific path the launcher needs (`launcher/src/main/paths.ts`) plus D-20 extension of the redactor (`launcher/src/main/auth/redact.ts`) with a new `sanitizeCrashReport` export that shares ONE `scrub()` pipeline between electron-log and the future crash viewer.

## One-liner

Seven platform-branched path resolvers + six new D-20 redaction patterns backing a single-source `sanitizeCrashReport` that powers both logs and crash viewer (D-21).

## Tasks

### Task 1: paths.ts with 7 platform-branched resolvers

TDD completed. RED commit `d8c16a6`, GREEN commit `d2ce338`.

Resolvers exported:

| Function | Returns | Notes |
|----------|---------|-------|
| `resolveDataRoot()` | `app.getPath('userData')` | Matches Phase 2 safeStorageCache convention |
| `resolveSettingsFile()` | `<DataRoot>/settings.json` | Plain JSON (not safeStorage — D-24 non-sensitive) |
| `resolveGameDir()` | `<DataRoot>/game` | D-24 layout |
| `resolveCrashReportsDir()` | `<GameDir>/crash-reports` | D-17 — Mojang crash dump location |
| `resolveJreDir()` | `<resources>/jre/{win\|mac}-{x64\|arm64}` | dev: `app.getAppPath()/resources/...`, packaged: `process.resourcesPath/...` |
| `resolveJavaBinary()` | `<JreDir>/bin/javaw.exe` \| `<JreDir>/Contents/Home/bin/java` | Win uses `javaw.exe` (Pitfall 7 — no phantom console), throws on linux |
| `resolveModJar()` | `<resources>/mod/wiiwho-0.1.0.jar` | Same dev/packaged branching |

JRE-03 invariant tested: `resolveJavaBinary()` path always contains `resources/jre/` substring — a grep-style assertion guarantees we never accidentally return a system PATH java.

### Task 2: redact.ts D-20 extension + sanitizeCrashReport

TDD completed. RED commit `f885bd5`, GREEN commit `2a024d2`.

**Exact regex patterns as committed** (referenced by Plan 03-08's CrashViewer test and Plan 03-10's IPC handler — this is the canonical listing):

```typescript
// Phase 2 patterns (preserved unchanged):
const JWT_PATTERN             = /eyJ[A-Za-z0-9_.-]{20,}/g
const REFRESH_TOKEN_PATTERN   = /refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const ACCESS_TOKEN_PATTERN    = /access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const MC_ACCESS_PATTERN       = /"accessToken":\s*"[^"]+"/g

// Phase 3 D-20 additions:
const MC_TOKEN_CLI_PATTERN    = /--accessToken\s+[A-Za-z0-9._-]+/g
const WINDOWS_USER_PATH_PATTERN = /([A-Z]:[\\/])Users([\\/])([^\\/\s"'`]+)/g
const MACOS_USER_PATH_PATTERN = /\/Users\/([^/\s"'`]+)/g
const WINDOWS_ENV_USERNAME_PATTERN = /%USERNAME%/g
const UNIX_ENV_USER_PATTERN   = /\$USER\b/g
const UNIX_ENV_HOME_PATTERN   = /\$HOME\b/g
```

**`scrub()` application order** (locked — downstream must not re-order):

1. `MC_TOKEN_CLI_PATTERN` → `'--accessToken [REDACTED]'`
2. `MC_ACCESS_PATTERN` → `'"accessToken": "[REDACTED]"'`
3. `JWT_PATTERN` → `'eyJ[REDACTED]'`
4. `REFRESH_TOKEN_PATTERN` → `'refresh_token: [REDACTED]'`
5. `ACCESS_TOKEN_PATTERN` → `'access_token: [REDACTED]'`
6. `WINDOWS_USER_PATH_PATTERN` → `'$1Users$2<USER>'` (3 groups: drive+sep, sep, name)
7. `MACOS_USER_PATH_PATTERN` → `'/Users/<USER>'`
8. `WINDOWS_ENV_USERNAME_PATTERN` → `'<USER>'`
9. `UNIX_ENV_USER_PATTERN` → `'<USER>'`
10. `UNIX_ENV_HOME_PATTERN` → `'<HOME>'`

**New export:**

```typescript
export function sanitizeCrashReport(raw: string): string {
  return scrub(raw)
}
```

Plan 03-10's `logs:read-crash` IPC handler and Plan 03-08's CrashViewer component both flow crash bodies through this function. Same string reaches both the `<pre>` render surface and `clipboard.writeText` — D-21 is enforced by code topology, not discipline.

**`__test__` export extended** to include all 10 pattern constants (Phase 2's 4 + Phase 3's 6) so downstream tests can assert pattern membership without importing private module state.

## Key Decisions

### Fixed a draft bug in RESEARCH.md's Windows regex

RESEARCH.md §Redaction Patterns (line 543) drafts the replacement as `'$1Users$1<USER>'` (double-use of `$1`) with a 2-group regex. That would have produced `C:\Users\C:\<USER>\...` — clearly wrong. PLAN.md §Task 2 Action already documents the 3-group fix (`'$1Users$2<USER>'` with groups for drive+sep, sep, name); I implemented the 3-group version. Noted here so future consumers don't regress to the draft shape.

### Inline fixture vs on-disk fixture

Plan states tests should read `launcher/src/main/monitor/__fixtures__/fake-crash-report.txt`. That file is owned by Plan 03-00 (running in parallel), so to make my test timing-safe I defined `FAKE_CRASH_REPORT` inline in `redact.test.ts` with content matching 03-00's spec byte-for-byte on the D-20 target strings. Tests pass green whether or not 03-00 has already landed the on-disk fixture. Plan 03-08 CrashViewer can still read the on-disk fixture for its own tests once 03-00 is merged.

### Word-boundary guards on `$USER` and `$HOME`

Naive `/\$USER/g` would also replace the first five chars of `$USERNAME` → `<USER>NAME`, which is both wrong (we have `%USERNAME%` pattern for that) and breaks crash reports that legitimately log PATH-like env strings. The word-boundary `\b` on both `UNIX_ENV_USER_PATTERN` and `UNIX_ENV_HOME_PATTERN` keeps them correct. Test `redacts $USER (word-bounded — does not eat $USERNAME)` pins this.

### 3-capture-group Windows path regex

The PLAN mandates preserving the source's separator style so downstream tools still recognize the path shape. `([A-Z]:[\\/])Users([\\/])([^\\/\s"'`]+)` captures drive+sep, sep, name — the replacement `$1Users$2<USER>` keeps exactly what the source had. Input `C:\Users\Alice\foo` → `C:\Users\<USER>\foo`; input `C:/Users/Alice/foo` → `C:/Users/<USER>/foo`. Both verified by dedicated tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Platform-separator mismatch in `resolveJavaBinary returns Contents/Home/bin/java on darwin` test**
- **Found during:** Task 1 GREEN phase, running on Windows
- **Issue:** Test asserted `expect(p).toMatch(/\/java$/)` on the raw Node `path.join` output. On Windows, `path.join` uses `\\` so the regex never matched even when the logical path was correct (checked by the separate `.replace(/\\/g, '/').toContain('Contents/Home/bin/java')` assertion directly above it).
- **Fix:** Normalize to forward-slashes at the top of the test (`const p = resolveJavaBinary().replace(/\\/g, '/')`) so all subsequent assertions operate on the normalized form. All other tests in the file already did this.
- **Files modified:** launcher/src/main/paths.test.ts (test-only; production code unchanged)
- **Commit:** d2ce338 (rolled into the GREEN commit since the test-bug was the only blocker)

**2. [Rule 1 — Bug] RESEARCH.md §Redaction Patterns draft Windows regex**
- **Found during:** Task 2 GREEN phase design review
- **Issue:** RESEARCH.md drafted `WINDOWS_USER_PATH_PATTERN = /([A-Z]:[\\/])Users[\\/]([^\\/\s"'`]+)/g` with replacement `'$1Users$1<USER>'` — re-uses `$1` where `$2` was intended, which would have produced a malformed output.
- **Fix:** Added a 3rd capture group (second separator) and used `'$1Users$2<USER>'` as the replacement, matching the PLAN.md's explicit correction. RESEARCH.md was not edited (it's a research artifact); the PLAN was already correct. Documented in this summary so consumers of RESEARCH.md know not to copy the draft regex verbatim.

### Auth gates

None.

## Self-Check: PASSED

- File exists: `launcher/src/main/paths.ts` — FOUND
- File exists: `launcher/src/main/paths.test.ts` — FOUND
- File exists: `launcher/src/main/auth/redact.ts` — FOUND (extended)
- File exists: `launcher/src/main/auth/__tests__/redact.test.ts` — FOUND (extended)
- Commit `d8c16a6` (test RED paths) — FOUND
- Commit `d2ce338` (feat paths + test fix) — FOUND
- Commit `f885bd5` (test RED redact D-20) — FOUND
- Commit `2a024d2` (feat redact extend) — FOUND
- `pnpm --filter ./launcher vitest run src/main/paths.test.ts` — 11/11 passed
- `pnpm --filter ./launcher vitest run src/main/auth/__tests__/redact.test.ts` — 25/25 passed
- Full suite — 161/161 passed across 17 files
- `npm run typecheck` — exits 0
- All 20 acceptance-criteria grep checks — FOUND

## Known Stubs

None. Both modules are feature-complete for Phase 3's downstream needs; Plan 03-10 will import `sanitizeCrashReport` directly, Plans 03-02 through 03-12 will import path resolvers as needed.

## Output for Downstream Plans

### What Plan 03-02 consumes
- `resolveSettingsFile()` — settings.json location for the Zustand-backed settings store.

### What Plans 03-03, 03-04, 03-05 consume
- `resolveGameDir()` — Mojang manifest expects this as JVM `--gameDir`.
- `resolveJavaBinary()` — path to the bundled JRE binary for `execa` spawn.
- `resolveJreDir()` — base for assembling library/asset paths relative to the JRE.
- `resolveModJar()` — Phase 4 uses this; Phase 3 does not classpath-inject.

### What Plan 03-06 consumes
- `resolveCrashReportsDir()` — location the log-parser / crash-watcher polls after non-zero JVM exit.

### What Plan 03-08 + 03-10 consume
- `sanitizeCrashReport(raw)` — D-21 single-source. 03-10 calls it in the `logs:read-crash` IPC handler; the returned `{ sanitizedBody }` is what 03-08's CrashViewer renders AND what the Copy button passes to `clipboard.writeText`.

### What Plans 03-11, 03-12 consume
- `resolveJreDir()` slot names (`win-x64`, `mac-x64`, `mac-arm64`) as `electron-builder.yml` `extraResources` target subdirectories.

## References

- Plan: `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-01-paths-and-redaction-PLAN.md`
- Research: `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md` §Redaction Patterns, §Resource-Path Resolution
- Phase context: `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md` D-17, D-20, D-21, D-24, D-25
- Upstream Phase 2 baseline: `.planning/phases/02-microsoft-authentication/02-RESEARCH.md` §Pitfall 6
