---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - launcher/src/main/paths.ts
  - launcher/src/main/paths.test.ts
  - launcher/src/main/auth/redact.ts
  - launcher/src/main/auth/redact.test.ts
autonomous: true
requirements:
  - JRE-01
  - JRE-02
  - JRE-03
  - COMP-05
  - LCH-05
must_haves:
  truths:
    - "resolveJavaBinary() returns the bundled Temurin/Zulu path and NEVER a system Java"
    - "Platform paths (game dir, settings, crash reports, mod jar, JRE) derive from ONE file — no ad-hoc path joins elsewhere"
    - "sanitizeCrashReport(raw) strips MC token CLI form, Windows username, macOS username, %USERNAME%, $USER, $HOME — same function that powers the electron-log hook (D-21)"
    - "The Phase 2 scrub remains idempotent — applying it twice produces identical output"
  artifacts:
    - path: "launcher/src/main/paths.ts"
      provides: "Single source of truth for resolveDataRoot, resolveGameDir, resolveSettingsFile, resolveCrashReportsDir, resolveJreDir, resolveJavaBinary, resolveModJar"
      exports: ["resolveDataRoot", "resolveGameDir", "resolveSettingsFile", "resolveCrashReportsDir", "resolveJreDir", "resolveJavaBinary", "resolveModJar"]
    - path: "launcher/src/main/paths.test.ts"
      provides: "Platform-branched tests covering win32 javaw.exe, darwin/Contents/Home/bin/java, arch detection"
    - path: "launcher/src/main/auth/redact.ts"
      provides: "sanitizeCrashReport export + 6 additional redaction patterns (MC_TOKEN_CLI, Windows path, macOS path, %USERNAME%, $USER, $HOME)"
      exports: ["installRedactor", "sanitizeCrashReport", "__test__"]
    - path: "launcher/src/main/auth/redact.test.ts"
      provides: "Test assertions against fake-crash-report.txt fixture; each redaction pattern has its own assertion"
  key_links:
    - from: "launcher/src/main/paths.ts"
      to: "app.getAppPath() / process.resourcesPath / process.platform / process.arch"
      via: "Electron + Node platform APIs"
      pattern: "process\\.platform"
    - from: "launcher/src/main/auth/redact.ts"
      to: "electron-log hook + sanitizeCrashReport export"
      via: "shared scrub() function"
      pattern: "function scrub"
---

<objective>
Create `paths.ts` — the single source of truth for every platform-specific path the launcher needs (data dir, game dir, settings file, crash-reports dir, JRE dir, Java binary, mod jar). Extend `redact.ts` with the 6 new patterns from D-20 (MC access token CLI form, Windows/macOS user-path, `%USERNAME%`, `$USER`, `$HOME`) AND export `sanitizeCrashReport(raw)` — the SAME function electron-log hooks through — so Plan 03-10's CrashViewer IPC path and Plan 03-11's electron-log hook both use one code path (D-21).

Purpose: Zero path-joining anywhere else in the Phase 3 codebase. Zero divergence between the display-side and clipboard-side redaction. Every downstream plan imports from these two modules.

Output: Two modules + two test files, co-located under `launcher/src/main/`. All tests pass via `pnpm vitest run src/main/paths.test.ts src/main/auth/redact.test.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/main/auth/redact.ts
@launcher/src/main/auth/safeStorageCache.ts
@launcher/src/main/monitor/__fixtures__/fake-crash-report.txt

<interfaces>
<!-- Current redact.ts exports (Phase 2 locked pattern list — DO NOT remove) -->

From launcher/src/main/auth/redact.ts:
```typescript
// Patterns (Phase 2):
const JWT_PATTERN = /eyJ[A-Za-z0-9_.-]{20,}/g
const REFRESH_TOKEN_PATTERN = /refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const ACCESS_TOKEN_PATTERN = /access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]+["']?/g
const MC_ACCESS_PATTERN = /"accessToken":\s*"[^"]+"/g

function scrub(s: string): string { ... }    // internal helper

export function installRedactor(): void { ... }   // electron-log hook, idempotent via `installed` flag
export const __test__ = { scrub, JWT_PATTERN, REFRESH_TOKEN_PATTERN, ACCESS_TOKEN_PATTERN, MC_ACCESS_PATTERN }
```

Phase 2 invariants that MUST be preserved:
- `installRedactor()` idempotent (the `installed` module-level boolean).
- Existing test `launcher/src/main/auth/redact.test.ts` continues to pass.
- `scrub()` remains the ONE function; the electron-log hook calls scrub; so does the new `sanitizeCrashReport` export.

<!-- safeStorageCache.ts already uses app.getPath('userData') under 'auth' subdir; paths.ts must NOT break that. -->

From launcher/src/main/auth/safeStorageCache.ts:
```typescript
export function resolveAuthDir(): string {
  return path.join(app.getPath('userData'), 'auth')
}
```

This means `resolveDataRoot()` in paths.ts MUST equal `app.getPath('userData')` so `resolveAuthDir()` from Phase 2 remains correct.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create paths.ts with platform-branched resolvers</name>
  <files>
    launcher/src/main/paths.ts,
    launcher/src/main/paths.test.ts
  </files>
  <read_first>
    - launcher/src/main/auth/safeStorageCache.ts (resolveAuthDir uses app.getPath('userData'); paths.ts must not contradict)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Resource-Path Resolution (dev vs packaged) — exact code the executor should use
    - launcher/src/main/index.ts (main bootstrap — confirm app.whenReady pattern; resolvers must only run after app ready)
  </read_first>
  <behavior>
    Tests MUST cover (write first, RED phase):
    - Test 1: `resolveJavaBinary()` returns `.../bin/javaw.exe` on win32 (NOT `java.exe` — Pitfall 7: prevent phantom console window)
    - Test 2: `resolveJavaBinary()` returns `.../Contents/Home/bin/java` on darwin
    - Test 3: `resolveJavaBinary()` throws on linux / unsupported platforms
    - Test 4: `resolveJreDir()` produces subdir `win-x64` / `mac-x64` / `mac-arm64` matching process.platform + process.arch
    - Test 5: `resolveGameDir()` === `<resolveDataRoot>/game` (D-24)
    - Test 6: `resolveSettingsFile()` === `<resolveDataRoot>/settings.json`
    - Test 7: `resolveCrashReportsDir()` === `<resolveGameDir>/crash-reports` (D-17)
    - Test 8: `resolveModJar()` ends with `/mod/wiiwho-0.1.0.jar` (joins with `resources/mod` in dev vs `process.resourcesPath/mod` in packaged)
    - Test 9: `resolveJavaBinary()` return path begins with `resources/jre/` (JRE-03: bundled JRE, never system PATH)

    Mock electron's `app` and `process.platform`/`process.arch`:
    - Use `vi.mock('electron', ...)` to fake `app.getAppPath()` + `app.getPath('userData')`.
    - Use `vi.stubGlobal('process', {...process, platform: 'win32', arch: 'x64'})` (vitest 4 global stub) or `Object.defineProperty(process, 'platform', {value: 'win32'})` via a saved/restored setup — pick whichever is cleaner; vitest 4's `vi.stubGlobal` approach is preferred.
    - Use `vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))` for dev tests; override to `{is: {dev: false}}` via `vi.mocked(...).mockReturnValue` for packaged tests. Alternatively, `vi.doMock` inside each test.
  </behavior>
  <action>
    **Copy this file verbatim into `launcher/src/main/paths.ts`** (sourced from RESEARCH.md §Resource-Path Resolution):

    ```typescript
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
     * Decisions: D-24 (game-dir layout), D-25 (JRE extraResources subdirs).
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
    ```

    **Write `launcher/src/main/paths.test.ts`** with the 9 tests listed in `<behavior>` above. Use `@vitest-environment node` docblock (these are main-process tests). Each test mocks electron's `app`, `@electron-toolkit/utils`'s `is`, and `process.platform`/`process.arch` via `vi.stubGlobal` or `Object.defineProperty`. Example skeleton for one test:

    ```typescript
    // @vitest-environment node
    import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

    vi.mock('electron', () => ({
      app: {
        getAppPath: () => '/fake/app',
        getPath: (key: string) => {
          if (key === 'userData') return '/fake/userData/Wiiwho'
          throw new Error(`unexpected app.getPath(${key})`)
        }
      }
    }))

    vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))

    describe('paths.ts', () => {
      const originalPlatform = process.platform
      const originalArch = process.arch
      const originalResourcesPath = process.resourcesPath

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
        Object.defineProperty(process, 'arch', { value: originalArch, configurable: true })
        Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true })
        vi.resetModules()
      })

      it('resolveJavaBinary returns javaw.exe on win32 (NOT java.exe — Pitfall 7)', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
        Object.defineProperty(process, 'arch', { value: 'x64', configurable: true })
        const { resolveJavaBinary } = await import('./paths')
        const p = resolveJavaBinary()
        expect(p).toMatch(/javaw\.exe$/)
        expect(p).not.toMatch(/[\\/]java\.exe$/)
        expect(p).toContain('jre')
        expect(p).toContain('win-x64')
      })

      // ... 8 more tests analogous
    })
    ```

    Pay attention: **Do not import `./paths` at top-level** of the test file — use dynamic `await import('./paths')` inside each test so per-test mocks apply cleanly. The `vi.resetModules()` in `afterEach` ensures fresh state.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/paths.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function resolveJavaBinary" launcher/src/main/paths.ts`
    - `grep -q "export function resolveJreDir" launcher/src/main/paths.ts`
    - `grep -q "export function resolveGameDir" launcher/src/main/paths.ts`
    - `grep -q "export function resolveSettingsFile" launcher/src/main/paths.ts`
    - `grep -q "export function resolveCrashReportsDir" launcher/src/main/paths.ts`
    - `grep -q "export function resolveModJar" launcher/src/main/paths.ts`
    - `grep -q "javaw.exe" launcher/src/main/paths.ts` (Windows-specific — Pitfall 7)
    - `grep -q "Contents/Home/bin/java" launcher/src/main/paths.ts` (macOS-specific)
    - `grep -q "Unsupported platform" launcher/src/main/paths.ts` (linux throw path)
    - `cd launcher &amp;&amp; npx vitest run src/main/paths.test.ts` exits 0 with all 9 tests passing
  </acceptance_criteria>
  <done>paths.ts exports 7 resolvers, JRE-03 invariant tested (returned path begins with `resources/jre/`), all 9 tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend redact.ts with D-20 patterns and export sanitizeCrashReport</name>
  <files>
    launcher/src/main/auth/redact.ts,
    launcher/src/main/auth/redact.test.ts
  </files>
  <read_first>
    - launcher/src/main/auth/redact.ts (Phase 2 current implementation — preserve installRedactor idempotency)
    - launcher/src/main/auth/redact.test.ts (Phase 2 tests — must still pass after extension)
    - launcher/src/main/monitor/__fixtures__/fake-crash-report.txt (Plan 03-00 created — fixture this test reads)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Redaction Patterns (D-20 extension) — the EXACT regexes to add
  </read_first>
  <behavior>
    Tests MUST cover (write or extend):
    - Test 1 (extend existing): `scrub('--accessToken ey.fakeTokenBody123.secretsig')` returns `'--accessToken [REDACTED]'`
    - Test 2: Windows path `'C:\\Users\\Alice\\foo'` → `'C:\\Users\\<USER>\\foo'` (preserves backslash, replaces username)
    - Test 3: Windows path forward-slash variant `'C:/Users/Alice/foo'` → `'C:/Users/<USER>/foo'`
    - Test 4: macOS path `'/Users/bob/Library/foo'` → `'/Users/<USER>/Library/foo'`
    - Test 5: `'%USERNAME%'` → `'<USER>'`
    - Test 6: `'$USER'` → `'<USER>'` (but NOT `'$USERNAME'` etc — word-boundary check with `\b`)
    - Test 7: `'$HOME'` → `'<HOME>'`
    - Test 8: **End-to-end fixture test** — `sanitizeCrashReport(readFileSync('./__fixtures__/fake-crash-report.txt', 'utf8'))` — assert output does NOT contain `'ey.fakeTokenBody123'`, `'Alice'`, `'bob'`, `'%USERNAME%'`, `'$USER'`, `'$HOME'` (the raw strings), AND DOES contain `'[REDACTED]'` and `'<USER>'`. This is THE smoke test for COMP-05 (D-21).
    - Test 9: **Idempotency** — `scrub(scrub(x)) === scrub(x)` for the fixture crash report (applying twice is a no-op — Phase 2 invariant).
    - Test 10: **Phase 2 regression guard** — the existing JWT test still passes unchanged.

    Fixture-driven test template:

    ```typescript
    // @vitest-environment node
    import { readFileSync } from 'node:fs'
    import path from 'node:path'
    import { sanitizeCrashReport } from './redact'

    it('sanitizes the fake-crash-report.txt fixture — strips all D-20 targets', () => {
      const fixture = readFileSync(
        path.join(__dirname, '../monitor/__fixtures__/fake-crash-report.txt'),
        'utf8'
      )
      const out = sanitizeCrashReport(fixture)
      // Targets removed:
      expect(out).not.toContain('ey.fakeTokenBody123')
      expect(out).not.toContain('Alice')
      expect(out).not.toContain('bob')
      expect(out).not.toMatch(/%USERNAME%/)
      expect(out).not.toMatch(/\$USER\b/)
      expect(out).not.toMatch(/\$HOME\b/)
      // Replacements present:
      expect(out).toContain('[REDACTED]')
      expect(out).toContain('<USER>')
    })
    ```
  </behavior>
  <action>
    **Modify `launcher/src/main/auth/redact.ts`** — ADD the 6 patterns and the `sanitizeCrashReport` export, without removing ANY of the Phase 2 patterns (`JWT_PATTERN`, `REFRESH_TOKEN_PATTERN`, `ACCESS_TOKEN_PATTERN`, `MC_ACCESS_PATTERN`) or breaking `installRedactor()`'s idempotency.

    Add these regex constants (copied verbatim from RESEARCH.md §Redaction Patterns):

    ```typescript
    // Phase 3 D-20 extensions:

    // 1. Raw MC access token shape from prismarine-auth's getMinecraftJavaToken().
    //    Contextual match — the --accessToken CLI flag form; NEVER try to match
    //    the raw token body alone (false positives on hashes, build IDs).
    const MC_TOKEN_CLI_PATTERN = /--accessToken\s+[A-Za-z0-9._-]+/g

    // 2. Windows user path: C:\Users\<name>\...  (backslash OR forward slash)
    //    Negative char class to avoid greedy matches that eat the rest of a line.
    const WINDOWS_USER_PATH_PATTERN = /([A-Z]:[\\/])Users([\\/])([^\\/\s"'`]+)/g

    // 3. macOS user path: /Users/<name>/...
    const MACOS_USER_PATH_PATTERN = /\/Users\/([^\/\s"'`]+)/g

    // 4. Unexpanded env references (appear in logged launch commands).
    const WINDOWS_ENV_USERNAME_PATTERN = /%USERNAME%/g
    const UNIX_ENV_USER_PATTERN = /\$USER\b/g
    const UNIX_ENV_HOME_PATTERN = /\$HOME\b/g
    ```

    Then update `scrub()` to apply the 4 Phase 2 patterns FIRST (longest/most-specific), followed by the new 6 in the exact order from RESEARCH.md §Redaction Patterns "Application order":

    ```typescript
    function scrub(s: string): string {
      return s
        .replace(MC_TOKEN_CLI_PATTERN, '--accessToken [REDACTED]')   // NEW Phase 3
        .replace(MC_ACCESS_PATTERN, '"accessToken": "[REDACTED]"')   // existing
        .replace(JWT_PATTERN, 'eyJ[REDACTED]')                        // existing
        .replace(REFRESH_TOKEN_PATTERN, 'refresh_token: [REDACTED]')  // existing
        .replace(ACCESS_TOKEN_PATTERN, 'access_token: [REDACTED]')    // existing
        .replace(WINDOWS_USER_PATH_PATTERN, '$1Users$2<USER>')        // NEW Phase 3 (preserves slash kind)
        .replace(MACOS_USER_PATH_PATTERN, '/Users/<USER>')            // NEW Phase 3
        .replace(WINDOWS_ENV_USERNAME_PATTERN, '<USER>')              // NEW Phase 3
        .replace(UNIX_ENV_USER_PATTERN, '<USER>')                     // NEW Phase 3
        .replace(UNIX_ENV_HOME_PATTERN, '<HOME>')                     // NEW Phase 3
    }
    ```

    Note the Windows path replacement `'$1Users$2<USER>'` — `$1` captures the drive-letter + first separator (`C:\` or `C:/`); `$2` captures the SECOND separator between `Users` and the username. Both need to be preserved in the replacement so downstream tooling still recognises the path shape.

    Add the new export below `installRedactor`:

    ```typescript
    /**
     * Sanitizes a crash report body. SAME `scrub()` implementation the
     * electron-log hook uses — D-21 single-sanitizer invariant.
     *
     * Called by Plan 03-10's logs:read-crash IPC handler. The returned string
     * is what the renderer both DISPLAYS and COPIES to the clipboard —
     * enforcing D-21 via a single source of truth.
     */
    export function sanitizeCrashReport(raw: string): string {
      return scrub(raw)
    }
    ```

    Extend `__test__` to include the 6 new patterns so tests can assert them directly:

    ```typescript
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
    ```

    **Extend `launcher/src/main/auth/redact.test.ts`**: keep all existing Phase 2 tests; add the 10 tests listed in `<behavior>` above. Keep the `@vitest-environment node` docblock if present; add one if not. Do NOT delete any existing test.

    CRITICAL: running `npm run test:run` after the change must show at least 10 NEW passing tests in `redact.test.ts` (phase 2 count is ~4-6 tests); total in this file should be ~14-16. No Phase 2 test should have been deleted or altered.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/auth/redact.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function sanitizeCrashReport" launcher/src/main/auth/redact.ts`
    - `grep -q "MC_TOKEN_CLI_PATTERN" launcher/src/main/auth/redact.ts`
    - `grep -q "WINDOWS_USER_PATH_PATTERN" launcher/src/main/auth/redact.ts`
    - `grep -q "MACOS_USER_PATH_PATTERN" launcher/src/main/auth/redact.ts`
    - `grep -q "WINDOWS_ENV_USERNAME_PATTERN" launcher/src/main/auth/redact.ts`
    - `grep -q "UNIX_ENV_USER_PATTERN" launcher/src/main/auth/redact.ts`
    - `grep -q "UNIX_ENV_HOME_PATTERN" launcher/src/main/auth/redact.ts`
    - `grep -q "installRedactor" launcher/src/main/auth/redact.ts` (Phase 2 export preserved)
    - `grep -q "let installed = false" launcher/src/main/auth/redact.ts` (idempotency flag preserved)
    - `grep -q "JWT_PATTERN" launcher/src/main/auth/redact.ts` (Phase 2 pattern preserved)
    - `cd launcher &amp;&amp; npx vitest run src/main/auth/redact.test.ts` exits 0
    - All Phase 2 test assertions still present in redact.test.ts (grep the existing test names first, verify they still exist after edit)
  </acceptance_criteria>
  <done>6 new redaction patterns added; sanitizeCrashReport exported; Phase 2 tests + 10 new tests all pass; fixture end-to-end test asserts Alice, bob, ey.fakeTokenBody123, %USERNAME%, $USER, $HOME are all gone from output.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/main/paths.test.ts src/main/auth/redact.test.ts` — both files green
- `cd launcher && npm run typecheck` — no type regressions
- `cd launcher && npm run test:run` — full suite still green (no Phase 2 regressions)
- Fixture round-trip: `sanitizeCrashReport(fakeCrashReport)` strips every D-20 target (asserted by fixture test)
</verification>

<success_criteria>
- paths.ts exports 7 resolvers covering every path downstream code needs
- JRE-03 enforced by test: `resolveJavaBinary()` path contains `resources/jre/` and `javaw.exe` on Windows / `Contents/Home/bin/java` on macOS
- 6 new D-20 redaction patterns in redact.ts, scrub() applies them in the documented order
- `sanitizeCrashReport` export available for Plan 03-10's IPC handler (D-21 single-sanitizer)
- Phase 2 `installRedactor()` idempotency preserved; existing tests unchanged
- COMP-05 fixture round-trip green
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-01-SUMMARY.md` documenting:
- Exact regex patterns as committed (so Plan 03-08's CrashViewer test can reference them)
- Which `scrub()` order was used (documented in the file's comments)
- Any edge cases the test suite found (e.g., nested `$USER` inside a larger word boundary)
- Any Phase 2 test names preserved vs refactored
</output>
