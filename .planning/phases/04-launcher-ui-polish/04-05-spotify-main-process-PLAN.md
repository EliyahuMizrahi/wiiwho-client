---
phase: 04-launcher-ui-polish
plan: 05
type: execute
wave: 4
depends_on:
  - 04-00
files_modified:
  - launcher/src/main/paths.ts
  - launcher/src/main/paths.test.ts
  - launcher/src/main/spotify/tokenStore.ts
  - launcher/src/main/spotify/__tests__/tokenStore.test.ts
  - launcher/src/main/spotify/oauth.ts
  - launcher/src/main/spotify/__tests__/oauth.test.ts
  - launcher/src/main/spotify/api.ts
  - launcher/src/main/spotify/__tests__/api.test.ts
  - launcher/src/main/spotify/spotifyManager.ts
  - launcher/src/main/spotify/__tests__/spotifyManager.test.ts
  - launcher/src/main/ipc/spotify.ts
  - launcher/src/main/ipc/__tests__/spotify.test.ts
  - launcher/src/main/auth/redact.ts
  - launcher/src/main/auth/__tests__/redact.test.ts
  - launcher/src/preload/index.ts
  - launcher/src/preload/__tests__/index.test.ts
  - launcher/src/renderer/src/wiiwho.d.ts
autonomous: true
requirements:
  - UI-06
must_haves:
  truths:
    - "launcher/src/main/spotify/tokenStore.ts writes spotify.bin to userData/spotify.bin encrypted via safeStorage (parallel to Phase 2 auth.bin)"
    - "launcher/src/main/spotify/oauth.ts implements PKCE: code_verifier via randomBytes(64).toString('base64url'); code_challenge via sha256 base64url"
    - "oauth.ts startOneShotCallbackServer() opens net.createServer on port 0, returns runtime port + awaitCallback Promise"
    - "Authorize URL uses http://127.0.0.1:<runtimePort>/callback as redirect_uri (matches dashboard-registered http://127.0.0.1/callback by loopback-literal-port-opaque rule)"
    - "api.ts spotifyFetch on 401 refreshes once and retries; second 401 marks disconnected; on 429 honors Retry-After and retries exactly once"
    - "api.ts on HTTP 403 with reason 'PREMIUM_REQUIRED' from /player/play, /pause, /next, /previous sets isPremium=false in return and does NOT retry (UI-06 new RESEARCH finding)"
    - "redact.ts extended with Spotify access + refresh token patterns; scrubbed in any log output"
    - "preload/index.ts exposes window.wiiwho.spotify as a DELIBERATE 6th top-level key (Pitfall 10); commit message notes deviation from Phase 1 D-11"
    - "preload key-count test updated from 5 → 6 keys expecting ['__debug','auth','game','logs','settings','spotify'].sort() exactly"
  artifacts:
    - path: "launcher/src/main/paths.ts"
      provides: "resolveSpotifyTokenPath() — userData/spotify.bin"
      exports: ["resolveSpotifyTokenPath"]
    - path: "launcher/src/main/spotify/tokenStore.ts"
      provides: "safeStorage-encrypted spotify.bin read/write"
      exports: ["readSpotifyTokens", "writeSpotifyTokens", "clearSpotifyTokens", "SpotifyTokens"]
    - path: "launcher/src/main/spotify/oauth.ts"
      provides: "PKCE code_verifier/challenge + one-shot loopback server + token exchange + refresh"
      exports: ["startPKCEFlow", "refreshAccessToken", "startOneShotCallbackServer"]
    - path: "launcher/src/main/spotify/api.ts"
      provides: "spotifyFetch wrapper (401 refresh, 429 Retry-After, 403 PREMIUM_REQUIRED) + control + currently-playing"
      exports: ["spotifyFetch", "getCurrentlyPlaying", "getPlaybackState", "play", "pause", "next", "previous", "getCurrentUser"]
    - path: "launcher/src/main/spotify/spotifyManager.ts"
      provides: "Singleton orchestrator — connect, disconnect, status, control, background track polling"
      exports: ["getSpotifyManager", "SpotifyManager"]
    - path: "launcher/src/main/ipc/spotify.ts"
      provides: "IPC handlers for spotify:connect/disconnect/status/control/track-changed event emit"
      exports: ["registerSpotifyHandlers"]
  key_links:
    - from: "launcher/src/main/spotify/spotifyManager.ts"
      to: "spotify.bin via tokenStore"
      via: "readSpotifyTokens/writeSpotifyTokens"
      pattern: "readSpotifyTokens|writeSpotifyTokens"
    - from: "launcher/src/main/ipc/spotify.ts"
      to: "preload spotify surface"
      via: "ipcMain.handle channels"
      pattern: "ipcMain\\.handle\\('spotify:"
    - from: "launcher/src/preload/index.ts"
      to: "window.wiiwho.spotify (DELIBERATE 6th key)"
      via: "contextBridge.exposeInMainWorld"
      pattern: "spotify:\\s*\\{"
---

<objective>
Build the full main-process Spotify integration: PKCE OAuth with loopback redirect + one-shot callback server + token exchange / refresh + safeStorage-encrypted token file (parallel to Phase 2 auth.bin) + Web API fetch wrapper with the three response-code handlers (401 → refresh once, 429 → Retry-After, 403 PREMIUM_REQUIRED → non-retry + isPremium flag) + singleton SpotifyManager orchestrator + IPC handler module + preload bridge extension with the DELIBERATE 6th top-level key `spotify`.

CRITICAL CORRECTIONS explicitly documented in this plan:
- **Spotify redirect URI (CONTEXT D-31 is WRONG):** Dashboard must register `http://127.0.0.1/callback` (NO port). Runtime authorize request uses `http://127.0.0.1:<runtime-port>/callback`. Loopback IP + port-opaque rule. Pitfall 6.
- **Preload 6th key deviation (Pitfall 10):** Phase 1 D-11 locked 5 top-level keys. Phase 4 adds `spotify` as a deliberate 6th key. Commit message must note deviation. Key-count test updated from 5 → 6 keys.
- **HTTP 403 PREMIUM_REQUIRED handling (RESEARCH-added, NOT in CONTEXT):** Free-tier Spotify users cannot use playback-control endpoints. api.ts must detect this and surface `isPremium: false` rather than retrying.

Purpose: Deliver all the main-process plumbing UI-06 needs. Renderer Spotify store + mini-player (Plan 04-06) consumes the IPC surface this plan exposes.

Output: 7 new files + 3 extended files (paths.ts, redact.ts, preload index.ts, wiiwho.d.ts) with full automated test coverage.
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@launcher/src/main/auth/safeStorageCache.ts
@launcher/src/main/auth/redact.ts
@launcher/src/main/paths.ts
@launcher/src/main/auth/AuthManager.ts
@launcher/src/preload/index.ts
@launcher/src/renderer/src/wiiwho.d.ts
@launcher/src/main/spotify/config.ts
@.planning/phases/04-launcher-ui-polish/04-00-infrastructure-SUMMARY.md
</context>

<interfaces>
<!-- Patterns this plan follows -->

From launcher/src/main/auth/safeStorageCache.ts (Phase 2 pattern to replicate):
```typescript
// Encrypted atomic write + read via safeStorage.encryptString/decryptString
// fail-closed if safeStorage.isEncryptionAvailable() returns false
// temp file + rename atomic write
```

From launcher/src/main/paths.ts (Phase 3 pattern):
```typescript
export function resolveDataRoot(): string  // app.getPath('userData')
export function resolveSettingsFile(): string  // resolveDataRoot() + settings.json
// ADD: export function resolveSpotifyTokenPath(): string  // resolveDataRoot() + spotify.bin
```

From launcher/src/main/auth/AuthManager.ts (Phase 2 singleton orchestrator pattern):
```typescript
// Singleton wrapper around authflow + error mapping + IPC push events
// Exported as getAuthManager() lazy-init
// Phase 4 SpotifyManager mirrors this shape (connect/disconnect/status/onTrackChanged)
```

From launcher/src/main/spotify/config.ts (Plan 04-00):
```typescript
export const SPOTIFY_CLIENT_ID: string
export const SPOTIFY_SCOPES: readonly [...]
export const SPOTIFY_REDIRECT_PATH = '/callback'
export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'
```

Node builtins used:
- `node:http` createServer, IncomingMessage, ServerResponse
- `node:net` AddressInfo
- `node:crypto` randomBytes, createHash

Electron APIs used:
- electron.safeStorage (encryptString/decryptString/isEncryptionAvailable)
- electron.shell.openExternal (launch system browser)
- electron.ipcMain.handle + webContents.send (IPC)
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: paths.resolveSpotifyTokenPath + tokenStore.ts (safeStorage-encrypted spotify.bin) + redact.ts extension for Spotify tokens</name>
  <files>launcher/src/main/paths.ts, launcher/src/main/paths.test.ts, launcher/src/main/spotify/tokenStore.ts, launcher/src/main/spotify/__tests__/tokenStore.test.ts, launcher/src/main/auth/redact.ts, launcher/src/main/auth/__tests__/redact.test.ts</files>
  <read_first>
    - launcher/src/main/paths.ts (existing path resolvers — match convention)
    - launcher/src/main/paths.test.ts (test patterns)
    - launcher/src/main/auth/safeStorageCache.ts (encrypt+atomic-write pattern to replicate)
    - launcher/src/main/auth/redact.ts (scrub pipeline to extend — ordering matters)
    - launcher/src/main/auth/__tests__/redact.test.ts (existing patterns — add Spotify token cases)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-32 (spotify.bin schema)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Spotify OAuth → §Refresh flow (token shape)
  </read_first>
  <behavior>
    - paths.resolveSpotifyTokenPath(): path.join(app.getPath('userData'), 'spotify.bin')
    - tokenStore.SpotifyTokens interface: `{ version: 1; accessToken: string; refreshToken: string; expiresAt: string (ISO); scopes: string[]; displayName?: string; isPremium?: 'yes'|'no'|'unknown' }`
    - writeSpotifyTokens(tokens): safeStorage.encryptString(JSON.stringify(tokens)) → atomic temp+rename
    - readSpotifyTokens(): safeStorage.decryptString on existing file; returns null if file missing; throws if safeStorage unavailable (fail-closed like Phase 2 Pitfall 7)
    - clearSpotifyTokens(): unlink spotify.bin (idempotent — ENOENT = success)
    - redact.ts: add SPOTIFY_ACCESS pattern (matches Bearer header form: `Bearer [A-Za-z0-9_-]{30,}`) + SPOTIFY_FIELD pattern (matches JSON `"access_token":"..."` / `"refresh_token":"..."` — already covered by existing ACCESS_TOKEN_PATTERN + REFRESH_TOKEN_PATTERN, VERIFY)
    - After scrub, no Spotify access or refresh token text should remain in output
  </behavior>
  <action>
    1. **paths.ts** — add the resolver:

    ```typescript
    /** Spotify OAuth token file (D-32). Encrypted via safeStorage; sibling to auth.bin. */
    export function resolveSpotifyTokenPath(): string {
      return path.join(resolveDataRoot(), 'spotify.bin')
    }
    ```

    Extend `launcher/src/main/paths.test.ts` with:
    ```typescript
    it('resolveSpotifyTokenPath returns userData/spotify.bin', () => {
      const result = resolveSpotifyTokenPath()
      expect(result).toMatch(/spotify\.bin$/)
      expect(result).not.toMatch(/auth\.bin$/)
    })
    ```

    2. **tokenStore.ts** — new file. Follow safeStorageCache.ts encryption pattern:

    ```typescript
    /**
     * Spotify OAuth token persistence (D-32).
     *
     * Parallel to Phase 2 auth.bin — encrypted via Electron safeStorage, never mixed
     * with Microsoft tokens. Renderer never reads this file directly; only the main
     * process's Spotify module accesses it.
     *
     * Fail-closed posture (Pitfall 7): if safeStorage.isEncryptionAvailable() is false,
     * reads/writes throw. Never silently persist plaintext.
     */
    import { safeStorage } from 'electron'
    import { promises as fs } from 'node:fs'
    import { resolveSpotifyTokenPath } from '../paths'

    export interface SpotifyTokens {
      version: 1
      accessToken: string
      refreshToken: string
      expiresAt: string        // ISO 8601
      scopes: string[]
      displayName?: string     // cached from /v1/me
      isPremium?: 'yes' | 'no' | 'unknown'
    }

    export async function readSpotifyTokens(): Promise<SpotifyTokens | null> {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage unavailable — refusing to read Spotify tokens')
      }
      try {
        const enc = await fs.readFile(resolveSpotifyTokenPath())
        const plain = safeStorage.decryptString(enc)
        return JSON.parse(plain) as SpotifyTokens
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw e
      }
    }

    export async function writeSpotifyTokens(tokens: SpotifyTokens): Promise<void> {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('safeStorage unavailable — refusing to write Spotify tokens')
      }
      const filePath = resolveSpotifyTokenPath()
      const enc = safeStorage.encryptString(JSON.stringify(tokens))
      const tmp = `${filePath}.tmp`
      await fs.writeFile(tmp, enc, { mode: 0o600 })
      await fs.rename(tmp, filePath)
    }

    export async function clearSpotifyTokens(): Promise<void> {
      try {
        await fs.unlink(resolveSpotifyTokenPath())
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }
    }
    ```

    3. **tokenStore test** — replace Wave 0 stub:

    ```typescript
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
    import { promises as fs } from 'node:fs'
    import path from 'node:path'
    import os from 'node:os'

    const tmpDir = path.join(os.tmpdir(), `wiiwho-spotify-test-${Math.random()}`)

    vi.mock('electron', () => ({
      app: { getPath: (k: string) => (k === 'userData' ? tmpDir : '') },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (s: string) => Buffer.from('ENC:' + s, 'utf8'),
        decryptString: (b: Buffer) => b.toString('utf8').replace(/^ENC:/, ''),
      },
    }))

    describe('Spotify tokenStore', () => {
      beforeEach(async () => { await fs.mkdir(tmpDir, { recursive: true }) })
      afterEach(async () => { await fs.rm(tmpDir, { recursive: true, force: true }) })

      it('writeSpotifyTokens + readSpotifyTokens round-trips', async () => {
        const { readSpotifyTokens, writeSpotifyTokens } = await import('../tokenStore')
        const tokens = { version: 1 as const, accessToken: 'at-x', refreshToken: 'rt-y', expiresAt: '2026-05-01T00:00:00Z', scopes: ['user-read-currently-playing'], displayName: 'User', isPremium: 'yes' as const }
        await writeSpotifyTokens(tokens)
        const out = await readSpotifyTokens()
        expect(out).toEqual(tokens)
      })

      it('readSpotifyTokens returns null when file missing', async () => {
        const { readSpotifyTokens } = await import('../tokenStore')
        const out = await readSpotifyTokens()
        expect(out).toBeNull()
      })

      it('clearSpotifyTokens is idempotent (ENOENT is success)', async () => {
        const { clearSpotifyTokens } = await import('../tokenStore')
        await expect(clearSpotifyTokens()).resolves.toBeUndefined()
        await expect(clearSpotifyTokens()).resolves.toBeUndefined()
      })

      it('writeSpotifyTokens uses atomic temp+rename pattern', async () => {
        const { writeSpotifyTokens } = await import('../tokenStore')
        await writeSpotifyTokens({ version: 1, accessToken: 'at', refreshToken: 'rt', expiresAt: '2026-05-01', scopes: [] })
        const file = path.join(tmpDir, 'spotify.bin')
        expect(await fs.access(file).then(() => true, () => false)).toBe(true)
        expect(await fs.access(`${file}.tmp`).then(() => true, () => false)).toBe(false)
      })

      it('fails closed when safeStorage unavailable', async () => {
        vi.doMock('electron', () => ({
          app: { getPath: (k: string) => (k === 'userData' ? tmpDir : '') },
          safeStorage: { isEncryptionAvailable: () => false },
        }))
        vi.resetModules()
        const { writeSpotifyTokens, readSpotifyTokens } = await import('../tokenStore')
        await expect(writeSpotifyTokens({ version: 1, accessToken: 'a', refreshToken: 'r', expiresAt: '2026', scopes: [] })).rejects.toThrow(/safeStorage unavailable/)
        // Reset for other tests
        vi.doUnmock('electron')
      })
    })
    ```

    4. **redact.ts extension** — add Spotify patterns. Read existing file carefully; add new constants; update scrub() order.

    The existing `REFRESH_TOKEN_PATTERN` and `ACCESS_TOKEN_PATTERN` already cover `"access_token":"..."` / `"refresh_token":"..."` JSON shapes — verify via test, don't duplicate. Add:

    ```typescript
    // Spotify Bearer access token — appears in Authorization headers
    const SPOTIFY_BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_-]{30,}/g
    ```

    Update scrub() to apply SPOTIFY_BEARER_PATTERN after MC_TOKEN_CLI and MC_ACCESS but before JWT (to prevent JWT from eating Bearer bodies):

    ```typescript
    function scrub(s: string): string {
      return s
        .replace(MC_TOKEN_CLI_PATTERN, '--accessToken [REDACTED]')
        .replace(MC_ACCESS_PATTERN, '"accessToken": "[REDACTED]"')
        .replace(SPOTIFY_BEARER_PATTERN, 'Bearer [REDACTED]')
        .replace(JWT_PATTERN, 'eyJ[REDACTED]')
        .replace(REFRESH_TOKEN_PATTERN, 'refresh_token: [REDACTED]')
        .replace(ACCESS_TOKEN_PATTERN, 'access_token: [REDACTED]')
        .replace(WINDOWS_USER_PATH_PATTERN, '$1Users$2<USER>')
        .replace(MACOS_USER_PATH_PATTERN, '/Users/<USER>')
        .replace(WINDOWS_ENV_USERNAME_PATTERN, '<USER>')
        .replace(UNIX_ENV_USER_PATTERN, '<USER>')
        .replace(UNIX_ENV_HOME_PATTERN, '<HOME>')
    }
    ```

    Also add SPOTIFY_BEARER_PATTERN to the `__test__` export.

    5. **redact test** — extend `launcher/src/main/auth/__tests__/redact.test.ts` with new cases (do NOT delete existing):

    ```typescript
    describe('Spotify token redaction (Phase 4 UI-06)', () => {
      it('scrubs Bearer access token from Authorization header', () => {
        const { __test__ } = await import('../redact')
        const input = 'GET /v1/me Authorization: Bearer BQD1234567890abcdef1234567890abcdef1234567890ABCD'
        const out = __test__.scrub(input)
        expect(out).not.toMatch(/BQD1234567890abcdef/)
        expect(out).toMatch(/Bearer \[REDACTED\]/)
      })

      it('scrubs Spotify access_token JSON field', () => {
        const { __test__ } = await import('../redact')
        const input = '{"access_token":"BQD1234567890abcdefABCD","token_type":"Bearer"}'
        const out = __test__.scrub(input)
        expect(out).not.toMatch(/BQD1234567890abcdef/)
      })

      it('scrubs Spotify refresh_token JSON field', () => {
        const { __test__ } = await import('../redact')
        const input = '{"refresh_token":"AQD1234567890abcdefABCD"}'
        const out = __test__.scrub(input)
        expect(out).not.toMatch(/AQD1234567890abcdef/)
      })
    })
    ```

    Make the existing test file's outer `describe` use async functions where needed (adjust as necessary to the existing vitest harness).
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/main/paths.test.ts src/main/spotify/__tests__/tokenStore.test.ts src/main/auth/__tests__/redact.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep "resolveSpotifyTokenPath" launcher/src/main/paths.ts` returns 1 hit.
    - `launcher/src/main/spotify/tokenStore.ts` exports `readSpotifyTokens`, `writeSpotifyTokens`, `clearSpotifyTokens`, `SpotifyTokens`.
    - `grep "SPOTIFY_BEARER_PATTERN" launcher/src/main/auth/redact.ts` returns ≥1 hit.
    - `grep "Bearer \\[REDACTED\\]" launcher/src/main/auth/redact.ts` returns 1 hit.
    - All 5 tokenStore tests pass.
    - All 3 new redact tests pass (existing Phase 2/3 tests still green).
    - paths.test.ts for resolveSpotifyTokenPath passes.
  </acceptance_criteria>
  <done>spotify.bin write/read works; Spotify tokens never leak to logs; path resolver in place.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: oauth.ts — PKCE code_verifier/challenge + one-shot callback server + token exchange + refresh</name>
  <files>launcher/src/main/spotify/oauth.ts, launcher/src/main/spotify/__tests__/oauth.test.ts</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Spotify OAuth → §PKCE Authorization Code flow (exact 8-step sequence)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Redirect URI registration (the CONTEXT D-31 correction — loopback-literal-port-opaque)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §get-port vs native → §Canonical one-shot callback server pattern (verbatim code)
    - launcher/src/main/spotify/config.ts (SPOTIFY_CLIENT_ID + SPOTIFY_AUTH_URL + SPOTIFY_TOKEN_URL + SPOTIFY_SCOPES + SPOTIFY_REDIRECT_PATH)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Refresh flow
  </read_first>
  <behavior>
    - generatePkcePair(): returns { codeVerifier: string, codeChallenge: string } — 64 random bytes base64url; sha256 hash base64url (no padding)
    - startOneShotCallbackServer(): creates net.createServer on port 0, binds to 127.0.0.1; returns { port, awaitCallback, close }. awaitCallback resolves with { code, state } on GET /callback; 5-minute timeout; closes server after resolve/reject
    - buildAuthorizeUrl({ clientId, redirectUri, codeChallenge, scopes, state }): returns the full URL
    - exchangeCodeForTokens({ code, codeVerifier, redirectUri }): POST /api/token with grant_type=authorization_code; returns parsed tokens
    - refreshAccessToken(currentRefreshToken): POST /api/token with grant_type=refresh_token; returns parsed tokens; if response includes new refresh_token, return it; else keep old one
    - startPKCEFlow(): orchestrates the above — starts server, generates verifier, opens system browser via shell.openExternal, awaits callback, validates state matches, exchanges code for tokens, returns tokens; throws on state mismatch or error param
  </behavior>
  <action>
    1. Replace Wave 0 stub `launcher/src/main/spotify/__tests__/oauth.test.ts` with real tests. Mock `electron.shell.openExternal` + `node:http.createServer` + `fetch`:

    ```typescript
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

    vi.mock('electron', () => ({
      shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
      app: { getPath: () => '' },
    }))
    vi.mock('../config', () => ({
      SPOTIFY_CLIENT_ID: 'test-client-id-AAAAAAAA',
      SPOTIFY_AUTH_URL: 'https://accounts.spotify.com/authorize',
      SPOTIFY_TOKEN_URL: 'https://accounts.spotify.com/api/token',
      SPOTIFY_API_BASE: 'https://api.spotify.com/v1',
      SPOTIFY_SCOPES: ['user-read-currently-playing', 'user-read-playback-state', 'user-modify-playback-state'],
      SPOTIFY_REDIRECT_PATH: '/callback',
    }))

    describe('generatePkcePair', () => {
      it('code_verifier is 43-128 chars, base64url charset', async () => {
        const { generatePkcePair } = await import('../oauth')
        const { codeVerifier } = generatePkcePair()
        expect(codeVerifier.length).toBeGreaterThanOrEqual(43)
        expect(codeVerifier.length).toBeLessThanOrEqual(128)
        expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)
      })

      it('code_challenge is sha256 of verifier, base64url, no padding', async () => {
        const { generatePkcePair } = await import('../oauth')
        const { codeVerifier, codeChallenge } = generatePkcePair()
        expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(codeChallenge).not.toMatch(/=/)  // no padding
        // Recompute and verify
        const { createHash } = await import('node:crypto')
        const expected = createHash('sha256').update(codeVerifier).digest('base64url')
        expect(codeChallenge).toBe(expected)
      })

      it('each call produces a new verifier (entropy check)', async () => {
        const { generatePkcePair } = await import('../oauth')
        const a = generatePkcePair()
        const b = generatePkcePair()
        expect(a.codeVerifier).not.toBe(b.codeVerifier)
      })
    })

    describe('startOneShotCallbackServer', () => {
      it('listens on a dynamic port on 127.0.0.1', async () => {
        const { startOneShotCallbackServer } = await import('../oauth')
        const server = await startOneShotCallbackServer()
        expect(server.port).toBeGreaterThan(0)
        expect(server.port).toBeLessThan(65536)
        server.close()
      })

      it('resolves awaitCallback on GET /callback?code=X&state=Y', async () => {
        const { startOneShotCallbackServer } = await import('../oauth')
        const server = await startOneShotCallbackServer()
        const pending = server.awaitCallback()
        // Simulate the browser hitting the loopback URL
        await fetch(`http://127.0.0.1:${server.port}/callback?code=ABC&state=XYZ`)
        const { code, state } = await pending
        expect(code).toBe('ABC')
        expect(state).toBe('XYZ')
      })

      it('rejects awaitCallback when error param present', async () => {
        const { startOneShotCallbackServer } = await import('../oauth')
        const server = await startOneShotCallbackServer()
        const pending = server.awaitCallback()
        await fetch(`http://127.0.0.1:${server.port}/callback?error=access_denied`)
        await expect(pending).rejects.toThrow(/access_denied/)
      })

      it('returns HTTP 200 with HTML body to the browser', async () => {
        const { startOneShotCallbackServer } = await import('../oauth')
        const server = await startOneShotCallbackServer()
        const pending = server.awaitCallback()
        const res = await fetch(`http://127.0.0.1:${server.port}/callback?code=A&state=B`)
        expect(res.status).toBe(200)
        const html = await res.text()
        expect(html).toMatch(/Connected/i)
        await pending
      })
    })

    describe('buildAuthorizeUrl', () => {
      it('includes client_id, response_type=code, S256 challenge, scope, state, and redirect_uri with port', async () => {
        const { buildAuthorizeUrl } = await import('../oauth')
        const url = new URL(buildAuthorizeUrl({
          clientId: 'id',
          redirectUri: 'http://127.0.0.1:54321/callback',
          codeChallenge: 'xyz',
          scopes: ['user-read-currently-playing'],
          state: 'abc',
        }))
        expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize')
        expect(url.searchParams.get('client_id')).toBe('id')
        expect(url.searchParams.get('response_type')).toBe('code')
        expect(url.searchParams.get('code_challenge_method')).toBe('S256')
        expect(url.searchParams.get('code_challenge')).toBe('xyz')
        expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:54321/callback')
        expect(url.searchParams.get('scope')).toBe('user-read-currently-playing')
        expect(url.searchParams.get('state')).toBe('abc')
      })
    })

    describe('exchangeCodeForTokens', () => {
      it('POSTs form body with grant_type=authorization_code + code + verifier + redirect_uri + client_id', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'user-read-currently-playing' }), { status: 200, headers: { 'content-type': 'application/json' } }))
        vi.stubGlobal('fetch', fetchMock)
        const { exchangeCodeForTokens } = await import('../oauth')
        const out = await exchangeCodeForTokens({ code: 'C', codeVerifier: 'V', redirectUri: 'http://127.0.0.1:1111/callback' })
        expect(fetchMock).toHaveBeenCalledWith('https://accounts.spotify.com/api/token', expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        }))
        expect(out.accessToken).toBe('AT')
        expect(out.refreshToken).toBe('RT')
        expect(out.expiresIn).toBe(3600)
        vi.unstubAllGlobals()
      })
    })

    describe('refreshAccessToken', () => {
      it('POSTs grant_type=refresh_token + current refresh + client_id', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'AT2', expires_in: 3600, scope: 'user-read-currently-playing' }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { refreshAccessToken } = await import('../oauth')
        const out = await refreshAccessToken('OLD_RT')
        expect(out.accessToken).toBe('AT2')
        // Spotify MAY or MAY NOT rotate refresh token; absence → keep old
        expect(out.refreshToken).toBe('OLD_RT')
        vi.unstubAllGlobals()
      })

      it('uses the rotated refresh_token if Spotify returns one', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'AT3', refresh_token: 'NEW_RT', expires_in: 3600 }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { refreshAccessToken } = await import('../oauth')
        const out = await refreshAccessToken('OLD_RT')
        expect(out.refreshToken).toBe('NEW_RT')
        vi.unstubAllGlobals()
      })
    })
    ```

    2. Create `launcher/src/main/spotify/oauth.ts` following RESEARCH §PKCE + §Canonical one-shot callback server pattern verbatim:

    ```typescript
    /**
     * Spotify PKCE Authorization Code flow + one-shot loopback callback server.
     *
     * REDIRECT URI CORRECTION (Pitfall 6 / CONTEXT D-31 is WRONG):
     *   Dashboard registration = 'http://127.0.0.1/callback' (NO port, NO wildcard).
     *   Runtime authorize = 'http://127.0.0.1:<runtime-port>/callback'.
     *   Spotify accepts because loopback IP is registered + ports are opaque on loopback.
     *
     * Source: .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Spotify OAuth
     */
    import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
    import type { AddressInfo } from 'node:net'
    import { randomBytes, createHash } from 'node:crypto'
    import { shell } from 'electron'
    import {
      SPOTIFY_CLIENT_ID,
      SPOTIFY_AUTH_URL,
      SPOTIFY_TOKEN_URL,
      SPOTIFY_SCOPES,
      SPOTIFY_REDIRECT_PATH,
    } from './config'

    export interface PkcePair {
      codeVerifier: string
      codeChallenge: string
    }

    export function generatePkcePair(): PkcePair {
      const codeVerifier = randomBytes(64).toString('base64url')  // 88 chars, URL-safe base64
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
      return { codeVerifier, codeChallenge }
    }

    export interface OneShotServer {
      port: number
      awaitCallback: () => Promise<{ code: string; state: string }>
      close: () => void
    }

    export async function startOneShotCallbackServer(): Promise<OneShotServer> {
      const server = createServer()
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as AddressInfo).port

      const awaitCallback = (): Promise<{ code: string; state: string }> =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            server.close()
            reject(new Error('Spotify OAuth callback timed out after 5 minutes'))
          }, 5 * 60 * 1000)

          server.on('request', (req: IncomingMessage, res: ServerResponse) => {
            const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
            if (url.pathname !== SPOTIFY_REDIRECT_PATH) {
              res.writeHead(404).end()
              return
            }
            const code = url.searchParams.get('code')
            const state = url.searchParams.get('state')
            const error = url.searchParams.get('error')

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(
              `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wiiwho — Spotify Connected</title><style>body{font-family:sans-serif;background:#111;color:#e5e5e5;display:grid;place-items:center;height:100vh;margin:0}h1{color:#16e0ee}p{opacity:.7}</style></head><body><div><h1>Connected</h1><p>You can close this window and return to Wiiwho.</p></div></body></html>`
            )

            clearTimeout(timeout)
            server.close()

            if (error) { reject(new Error(`Spotify OAuth error: ${error}`)); return }
            if (!code || !state) { reject(new Error('Missing code or state in callback')); return }
            resolve({ code, state })
          })
        })

      return { port, awaitCallback, close: () => server.close() }
    }

    export interface AuthorizeUrlArgs {
      clientId: string
      redirectUri: string
      codeChallenge: string
      scopes: readonly string[]
      state: string
    }

    export function buildAuthorizeUrl(args: AuthorizeUrlArgs): string {
      const params = new URLSearchParams({
        client_id: args.clientId,
        response_type: 'code',
        redirect_uri: args.redirectUri,
        code_challenge_method: 'S256',
        code_challenge: args.codeChallenge,
        scope: [...args.scopes].join(' '),
        state: args.state,
      })
      return `${SPOTIFY_AUTH_URL}?${params}`
    }

    export interface TokensOut {
      accessToken: string
      refreshToken: string
      expiresIn: number   // seconds
      scope?: string
    }

    export async function exchangeCodeForTokens(args: {
      code: string
      codeVerifier: string
      redirectUri: string
    }): Promise<TokensOut> {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: args.code,
        redirect_uri: args.redirectUri,
        client_id: SPOTIFY_CLIENT_ID,
        code_verifier: args.codeVerifier,
      })
      const res = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`)
      const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number; scope?: string }
      return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in, scope: j.scope }
    }

    export async function refreshAccessToken(currentRefreshToken: string): Promise<TokensOut> {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefreshToken,
        client_id: SPOTIFY_CLIENT_ID,
      })
      const res = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!res.ok) throw new Error(`Spotify refresh failed: ${res.status}`)
      const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string }
      return {
        accessToken: j.access_token,
        refreshToken: j.refresh_token ?? currentRefreshToken,  // Spotify may rotate; if not, keep old
        expiresIn: j.expires_in,
        scope: j.scope,
      }
    }

    export interface PkceFlowResult extends TokensOut {
      scopes: string[]
    }

    export async function startPKCEFlow(): Promise<PkceFlowResult> {
      const server = await startOneShotCallbackServer()
      const redirectUri = `http://127.0.0.1:${server.port}${SPOTIFY_REDIRECT_PATH}`
      const { codeVerifier, codeChallenge } = generatePkcePair()
      const state = randomBytes(16).toString('base64url')
      const authUrl = buildAuthorizeUrl({
        clientId: SPOTIFY_CLIENT_ID,
        redirectUri,
        codeChallenge,
        scopes: SPOTIFY_SCOPES,
        state,
      })
      await shell.openExternal(authUrl)
      const { code, state: returnedState } = await server.awaitCallback()
      if (returnedState !== state) throw new Error('Spotify OAuth state mismatch — CSRF defense triggered')
      const tokens = await exchangeCodeForTokens({ code, codeVerifier, redirectUri })
      return { ...tokens, scopes: (tokens.scope ?? SPOTIFY_SCOPES.join(' ')).split(' ') }
    }
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/main/spotify/__tests__/oauth.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep "randomBytes(64).toString('base64url')" launcher/src/main/spotify/oauth.ts` returns 1 hit.
    - `grep "createHash('sha256').update(codeVerifier).digest('base64url')" launcher/src/main/spotify/oauth.ts` returns 1 hit.
    - `grep "127.0.0.1" launcher/src/main/spotify/oauth.ts` returns ≥2 hits.
    - `grep "127\\.0\\.0\\.1:\\*" launcher/src/main/spotify/oauth.ts` returns 0 hits (no wildcard).
    - `grep "SPOTIFY_REDIRECT_PATH" launcher/src/main/spotify/oauth.ts` returns ≥2 hits.
    - `grep "shell.openExternal" launcher/src/main/spotify/oauth.ts` returns 1 hit.
    - Exports present: `generatePkcePair`, `startOneShotCallbackServer`, `buildAuthorizeUrl`, `exchangeCodeForTokens`, `refreshAccessToken`, `startPKCEFlow`.
    - All 13 oauth tests pass.
    - File header contains the D-31 correction note (Pitfall 6).
  </acceptance_criteria>
  <done>PKCE + loopback server + token exchange + refresh all working; state CSRF validated; redirect URI correct.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: api.ts — spotifyFetch with 401/429/403 PREMIUM_REQUIRED handling + playback + currently-playing endpoints</name>
  <files>launcher/src/main/spotify/api.ts, launcher/src/main/spotify/__tests__/api.test.ts</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Spotify OAuth → §Rate limits + §429 handling (authoritative)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §403 PREMIUM_REQUIRED handling (CRITICAL — new finding)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Canonical URLs (endpoint paths)
    - launcher/src/main/spotify/oauth.ts (refreshAccessToken — called on 401)
  </read_first>
  <behavior>
    - spotifyFetch(accessToken, url, init): GET/PUT/POST with Authorization: Bearer. Returns Response-like + custom flags.
    - On HTTP 401: tries refresh ONCE (via caller-provided onRefresh callback) and retries; second 401 → throws AuthExpiredError
    - On HTTP 429: reads Retry-After header, waits that many seconds, retries exactly ONCE; second 429 → returns without further retry (let caller pause)
    - On HTTP 403 with body `{"error":{"reason":"PREMIUM_REQUIRED"}}`: returns special `{ premiumRequired: true }` flag — do NOT retry, do NOT refresh
    - On network error: rejects with NetworkError
    - getCurrentlyPlaying(accessToken): GET /v1/me/player/currently-playing; returns the track object OR null (idle state returns HTTP 200 with item: null, OR HTTP 204 No Content)
    - getPlaybackState(accessToken): GET /v1/me/player
    - play / pause / next / previous: PUT /v1/me/player/play etc.; all are control endpoints — susceptible to 403 PREMIUM_REQUIRED
    - getCurrentUser(accessToken): GET /v1/me → returns { displayName, product (free/premium) }
  </behavior>
  <action>
    1. Replace Wave 0 api.ts stub with real tests (drawing from RESEARCH §429 handling + §403 PREMIUM_REQUIRED):

    ```typescript
    import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

    vi.mock('../oauth', () => ({
      refreshAccessToken: vi.fn(),
    }))

    describe('spotifyFetch', () => {
      afterEach(() => vi.unstubAllGlobals())

      it('200 OK passes through with parsed body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 })))
        const { spotifyFetch } = await import('../api')
        const res = await spotifyFetch('AT', 'https://api.spotify.com/v1/me')
        expect(res.status).toBe(200)
      })

      it('401 triggers refresh + retry; second call uses the new token', async () => {
        const fetchMock = vi.fn()
          .mockResolvedValueOnce(new Response('', { status: 401 }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u' }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const onRefresh = vi.fn().mockResolvedValue({ accessToken: 'NEW', refreshToken: 'RT', expiresIn: 3600 })
        const { spotifyFetch } = await import('../api')
        const res = await spotifyFetch('OLD', 'https://api.spotify.com/v1/me', { onRefresh })
        expect(onRefresh).toHaveBeenCalledTimes(1)
        expect(res.status).toBe(200)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        // Second call should have used NEW token
        const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit
        const authHeader = (secondCallInit.headers as Record<string, string>).Authorization
        expect(authHeader).toBe('Bearer NEW')
      })

      it('second consecutive 401 throws AuthExpiredError', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
        vi.stubGlobal('fetch', fetchMock)
        const onRefresh = vi.fn().mockResolvedValue({ accessToken: 'NEW', refreshToken: 'RT', expiresIn: 3600 })
        const { spotifyFetch } = await import('../api')
        await expect(spotifyFetch('OLD', 'https://api.spotify.com/v1/me', { onRefresh })).rejects.toThrow(/auth expired/i)
      })

      it('429 reads Retry-After and retries exactly once', async () => {
        const fetchMock = vi.fn()
          .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '1' } }))
          .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { spotifyFetch } = await import('../api')
        const start = Date.now()
        const res = await spotifyFetch('AT', 'https://api.spotify.com/v1/me')
        const elapsed = Date.now() - start
        expect(res.status).toBe(200)
        expect(elapsed).toBeGreaterThanOrEqual(1000)
      }, 10000)

      it('403 with PREMIUM_REQUIRED body sets premiumRequired flag, does NOT retry', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { status: 403, message: 'Player command failed', reason: 'PREMIUM_REQUIRED' } }), { status: 403 }))
        vi.stubGlobal('fetch', fetchMock)
        const { spotifyFetch } = await import('../api')
        const res = await spotifyFetch('AT', 'https://api.spotify.com/v1/me/player/play')
        expect(res.premiumRequired).toBe(true)
        expect(fetchMock).toHaveBeenCalledTimes(1)  // no retry
      })

      it('403 without PREMIUM_REQUIRED (other error) throws', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { status: 403, message: 'Other', reason: 'SOME_OTHER' } }), { status: 403 }))
        vi.stubGlobal('fetch', fetchMock)
        const { spotifyFetch } = await import('../api')
        await expect(spotifyFetch('AT', 'https://api.spotify.com/v1/me/player/play')).rejects.toThrow(/403/)
      })

      it('Authorization header uses Bearer token', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { spotifyFetch } = await import('../api')
        await spotifyFetch('ABC', 'https://api.spotify.com/v1/me')
        const init = fetchMock.mock.calls[0][1] as RequestInit
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ABC')
      })
    })

    describe('getCurrentlyPlaying', () => {
      afterEach(() => vi.unstubAllGlobals())

      it('200 with item returns the track', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ item: { id: 't1', name: 'Song', artists: [{ name: 'Artist' }], album: { images: [{ url: 'https://a.com/x.jpg' }] } }, is_playing: true }), { status: 200 })))
        const { getCurrentlyPlaying } = await import('../api')
        const t = await getCurrentlyPlaying('AT')
        expect(t?.id).toBe('t1')
        expect(t?.name).toBe('Song')
        expect(t?.artists[0]).toBe('Artist')
        expect(t?.albumArtUrl).toMatch(/\.jpg$/)
      })

      it('204 No Content returns null (idle state)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
        const { getCurrentlyPlaying } = await import('../api')
        const t = await getCurrentlyPlaying('AT')
        expect(t).toBeNull()
      })

      it('200 with item: null returns null', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ item: null, is_playing: false }), { status: 200 })))
        const { getCurrentlyPlaying } = await import('../api')
        const t = await getCurrentlyPlaying('AT')
        expect(t).toBeNull()
      })
    })

    describe('play/pause/next/previous return premiumRequired on 403 PREMIUM_REQUIRED', () => {
      afterEach(() => vi.unstubAllGlobals())

      it.each([['play', 'PUT', '/v1/me/player/play'], ['pause', 'PUT', '/v1/me/player/pause'], ['next', 'POST', '/v1/me/player/next'], ['previous', 'POST', '/v1/me/player/previous']])(
        '%s surfaces premiumRequired flag',
        async (fnName) => {
          vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { reason: 'PREMIUM_REQUIRED' } }), { status: 403 })))
          const api = await import('../api')
          const fn = (api as unknown as Record<string, (t: string) => Promise<{ premiumRequired: boolean }>>)[fnName]
          const out = await fn('AT')
          expect(out.premiumRequired).toBe(true)
        }
      )
    })

    describe('getCurrentUser', () => {
      afterEach(() => vi.unstubAllGlobals())

      it('returns displayName and product (free/premium)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ display_name: 'Owner', product: 'premium', id: 'abc' }), { status: 200 })))
        const { getCurrentUser } = await import('../api')
        const u = await getCurrentUser('AT')
        expect(u.displayName).toBe('Owner')
        expect(u.product).toBe('premium')
      })
    })
    ```

    2. Create `launcher/src/main/spotify/api.ts`:

    ```typescript
    /**
     * Spotify Web API client wrappers.
     *
     * Key behaviors:
     *   - 401 → single refresh + retry; second 401 throws AuthExpiredError
     *   - 429 → read Retry-After, wait, retry exactly once (RESEARCH §429 handling)
     *   - 403 with reason PREMIUM_REQUIRED → return { premiumRequired: true } flag
     *     (RESEARCH §403 PREMIUM_REQUIRED handling — NOT in CONTEXT, research-added)
     *     Do NOT retry; do NOT refresh. Caller sets isPremium=false in spotify store.
     *
     * No exponential backoff. Retry-After is authoritative.
     */
    import { SPOTIFY_API_BASE } from './config'
    import type { TokensOut } from './oauth'

    export class AuthExpiredError extends Error {
      constructor() { super('Spotify auth expired after refresh attempt') }
    }

    export interface SpotifyResponse<T = unknown> {
      status: number
      json: () => Promise<T>
      premiumRequired?: boolean
    }

    export interface SpotifyFetchInit extends RequestInit {
      onRefresh?: () => Promise<TokensOut>
    }

    export async function spotifyFetch<T = unknown>(accessToken: string, url: string, init: SpotifyFetchInit = {}): Promise<SpotifyResponse<T>> {
      const { onRefresh, ...rest } = init
      const headers: Record<string, string> = {
        ...(rest.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${accessToken}`,
      }
      const doFetch = (token: string): Promise<Response> => fetch(url, { ...rest, headers: { ...headers, Authorization: `Bearer ${token}` } })

      let res = await doFetch(accessToken)

      if (res.status === 401 && onRefresh) {
        const fresh = await onRefresh()
        res = await doFetch(fresh.accessToken)
        if (res.status === 401) throw new AuthExpiredError()
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '30', 10)
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        res = await doFetch(accessToken)
      }

      if (res.status === 403) {
        let body: unknown = null
        try { body = await res.clone().json() } catch { /* body not JSON */ }
        const reason = (body as { error?: { reason?: string } } | null)?.error?.reason
        if (reason === 'PREMIUM_REQUIRED') {
          return { status: 403, json: () => Promise.resolve(body as T), premiumRequired: true }
        }
        throw new Error(`Spotify 403: ${(body as { error?: { message?: string } } | null)?.error?.message ?? 'forbidden'}`)
      }

      return {
        status: res.status,
        json: () => res.json() as Promise<T>,
        premiumRequired: false,
      }
    }

    export interface Track {
      id: string
      name: string
      artists: string[]
      albumArtUrl?: string
      isPlaying: boolean
    }

    interface CurrentlyPlayingResponse {
      item: { id: string; name: string; artists: { name: string }[]; album: { images: { url: string }[] } } | null
      is_playing: boolean
    }

    export async function getCurrentlyPlaying(accessToken: string, onRefresh?: () => Promise<TokensOut>): Promise<Track | null> {
      const res = await spotifyFetch<CurrentlyPlayingResponse>(accessToken, `${SPOTIFY_API_BASE}/me/player/currently-playing`, { onRefresh })
      if (res.status === 204) return null  // idle
      if (res.status !== 200) return null
      const body = await res.json()
      if (!body.item) return null
      return {
        id: body.item.id,
        name: body.item.name,
        artists: body.item.artists.map((a) => a.name),
        albumArtUrl: body.item.album.images[0]?.url,
        isPlaying: body.is_playing,
      }
    }

    export async function getPlaybackState(accessToken: string, onRefresh?: () => Promise<TokensOut>): Promise<{ isPlaying: boolean } | null> {
      const res = await spotifyFetch<{ is_playing: boolean }>(accessToken, `${SPOTIFY_API_BASE}/me/player`, { onRefresh })
      if (res.status === 204) return null
      const body = await res.json()
      return { isPlaying: body.is_playing }
    }

    async function controlCall(method: 'PUT' | 'POST', accessToken: string, path: string, onRefresh?: () => Promise<TokensOut>): Promise<{ premiumRequired: boolean }> {
      const res = await spotifyFetch(accessToken, `${SPOTIFY_API_BASE}${path}`, { method, onRefresh })
      return { premiumRequired: res.premiumRequired ?? false }
    }

    export const play     = (t: string, onRefresh?: () => Promise<TokensOut>): Promise<{ premiumRequired: boolean }> => controlCall('PUT',  t, '/me/player/play',     onRefresh)
    export const pause    = (t: string, onRefresh?: () => Promise<TokensOut>): Promise<{ premiumRequired: boolean }> => controlCall('PUT',  t, '/me/player/pause',    onRefresh)
    export const next     = (t: string, onRefresh?: () => Promise<TokensOut>): Promise<{ premiumRequired: boolean }> => controlCall('POST', t, '/me/player/next',     onRefresh)
    export const previous = (t: string, onRefresh?: () => Promise<TokensOut>): Promise<{ premiumRequired: boolean }> => controlCall('POST', t, '/me/player/previous', onRefresh)

    export interface SpotifyUser {
      id: string
      displayName: string
      product: 'free' | 'premium' | 'open' | string
    }

    export async function getCurrentUser(accessToken: string, onRefresh?: () => Promise<TokensOut>): Promise<SpotifyUser> {
      const res = await spotifyFetch<{ id: string; display_name: string; product: string }>(accessToken, `${SPOTIFY_API_BASE}/me`, { onRefresh })
      const body = await res.json()
      return { id: body.id, displayName: body.display_name, product: body.product as SpotifyUser['product'] }
    }
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/main/spotify/__tests__/api.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep "PREMIUM_REQUIRED" launcher/src/main/spotify/api.ts` returns ≥1 hit.
    - `grep "premiumRequired: true" launcher/src/main/spotify/api.ts` returns ≥1 hit.
    - `grep "Retry-After" launcher/src/main/spotify/api.ts` returns 1 hit.
    - `grep "Bearer" launcher/src/main/spotify/api.ts` returns ≥1 hit.
    - Exports present: `spotifyFetch`, `getCurrentlyPlaying`, `getPlaybackState`, `play`, `pause`, `next`, `previous`, `getCurrentUser`, `AuthExpiredError`, `Track`.
    - All api tests pass (spotifyFetch 7, getCurrentlyPlaying 3, control×4, getCurrentUser 1).
  </acceptance_criteria>
  <done>spotifyFetch + endpoints all correctly handle 401/429/403 PREMIUM_REQUIRED; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: spotifyManager singleton + IPC handlers + preload 6th-key extension + wiiwho.d.ts update</name>
  <files>launcher/src/main/spotify/spotifyManager.ts, launcher/src/main/spotify/__tests__/spotifyManager.test.ts, launcher/src/main/ipc/spotify.ts, launcher/src/main/ipc/__tests__/spotify.test.ts, launcher/src/preload/index.ts, launcher/src/preload/__tests__/index.test.ts, launcher/src/renderer/src/wiiwho.d.ts</files>
  <read_first>
    - launcher/src/main/auth/AuthManager.ts (singleton pattern + push events)
    - launcher/src/main/ipc/auth.ts (IPC handler conventions for getPrimaryWindow + channel naming)
    - launcher/src/preload/index.ts (the 5-key frozen surface + Pitfall 10 deviation note)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-25..§D-35 (Spotify UI states + polling cadence + disconnect gestures)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Rate limits + polling cadence (5s focused / 15s backgrounded)
  </read_first>
  <behavior>
    - spotifyManager is a lazy-init singleton exporting getSpotifyManager()
    - Methods: connect() → runs startPKCEFlow, fetches /v1/me (cache displayName + product), writes spotify.bin, returns { ok: true, displayName } or { ok: false, error }
    - disconnect() → stops polling, clears spotify.bin, emits status-change event
    - status() → returns { connected: boolean, displayName?: string, isPremium?: 'yes'|'no'|'unknown', currentTrack?: Track | null }
    - play() / pause() / next() / previous() → calls api.* with refresh callback; on premiumRequired → sets isPremium='no' in memory + emits status update
    - Background polling: startPolling(intervalMs) / stopPolling() — private; manager calls start on successful connect; renderer sends focused/backgrounded visibility changes via IPC to adjust interval (5s / 15s per D-34)
    - On track change (different track ID vs last poll) → emits 'spotify:track-changed' event to renderer with Track shape
    - On first 403 PREMIUM_REQUIRED from a control → sets isPremium='no' + emits status change
    - On read-endpoint 401 → refresh once; on 401 after refresh → clear tokens + emit disconnected
    - IPC handlers: spotify:connect, spotify:disconnect, spotify:status, spotify:control:play, :pause, :next, :previous, spotify:setVisibility (focused/backgrounded)
    - Push events: spotify:status-changed (connected / track-changed / premium-required)
    - Preload: adds `spotify: { connect, disconnect, status, control: { play, pause, next, previous }, setVisibility, onStatusChanged }` — DELIBERATE 6th top-level key; file header comment documents deviation from Phase 1 D-11
    - wiiwho.d.ts: WiiWhoAPI extended with `spotify` key typed surface
  </behavior>
  <action>
    This task is large; break internally into A/B/C/D sub-steps.

    **A. spotifyManager.ts + test.** Singleton orchestrator following AuthManager.ts pattern. Exports `getSpotifyManager()`. Holds in-memory `{ tokens: SpotifyTokens | null, lastTrackId: string | null, pollInterval: Timeout | null, visibility: 'focused'|'backgrounded' }`. Uses tokenStore for persistence, oauth for PKCE, api for fetches. Emits events via a simple EventEmitter or a callback registered by IPC module. Write tests mocking oauth.startPKCEFlow, api.getCurrentlyPlaying, tokenStore read/write.

    Tests must cover:
    - connect() happy path → tokens persisted + displayName + isPremium='yes' when product==='premium' (or 'no' when 'free')
    - connect() on PKCE error → returns { ok: false, error }
    - disconnect() → clearSpotifyTokens called + polling stopped
    - status() after connect returns connected=true + displayName
    - play() when isPremium='no' already set → short-circuits with { ok: false, reason: 'premium-required' } WITHOUT fetching
    - play() when isPremium='yes' → calls api.play(); if response.premiumRequired → sets isPremium='no' + emits event
    - setVisibility('focused') → polling interval becomes 5000ms
    - setVisibility('backgrounded') → polling interval becomes 15000ms
    - track change detection → emits 'status-changed' with new currentTrack
    - 401 on poll that survives refresh → clears tokens, emits disconnected

    **B. ipc/spotify.ts + test.** Register handlers that wrap spotifyManager calls. Match existing Phase 2/3 IPC conventions (getPrimaryWindow pattern). Push events via `primaryWindow.webContents.send('spotify:status-changed', payload)`.

    Tests mock spotifyManager; verify ipcMain.handle called with correct channel names; verify webContents.send called for push events.

    **C. preload/index.ts + test.** Add the 6th top-level key with **deliberate deviation note** in header comment:

    ```typescript
    /**
     * DELIBERATE DEVIATION from Phase 1 D-11 (frozen at 5 top-level keys).
     * Phase 4 UI-06 adds `spotify` as the 6th top-level key.
     * Semantically distinct from auth/game/settings/logs/__debug — cannot nest cleanly.
     * Pitfall 10: this is documented in Phase 4 CONTEXT + RESEARCH + commit message.
     * Key-count test updated from 5 → 6.
     */
    ```

    Add the bridge block:
    ```typescript
    spotify: {
      connect: () => ipcRenderer.invoke('spotify:connect'),
      disconnect: () => ipcRenderer.invoke('spotify:disconnect'),
      status: () => ipcRenderer.invoke('spotify:status'),
      control: {
        play: () => ipcRenderer.invoke('spotify:control:play'),
        pause: () => ipcRenderer.invoke('spotify:control:pause'),
        next: () => ipcRenderer.invoke('spotify:control:next'),
        previous: () => ipcRenderer.invoke('spotify:control:previous'),
      },
      setVisibility: (v: 'focused' | 'backgrounded') => ipcRenderer.invoke('spotify:set-visibility', v),
      onStatusChanged: (cb: (s: unknown) => void): Unsubscribe => {
        const h = (_: unknown, s: unknown): void => cb(s)
        ipcRenderer.on('spotify:status-changed', h)
        return () => ipcRenderer.off('spotify:status-changed', h)
      }
    }
    ```

    Update preload test — if a key-count test exists in the codebase, find it and bump 5→6. The expected sorted keys array must be `['__debug', 'auth', 'game', 'logs', 'settings', 'spotify']`. The owner has verified at Phase 1-foundations runtime: `Object.keys(window.wiiwho) === ['auth','game','settings','logs','__debug']`. Phase 4 bumps expected state to the 6-key sorted list.

    Also add a fresh preload test file or case:
    ```typescript
    it('exposes exactly 6 top-level keys (Phase 4 adds spotify; Pitfall 10)', () => {
      // ... import fixture or integration test pattern ...
      expect(Object.keys(exposed).sort()).toEqual(['__debug','auth','game','logs','settings','spotify'])
    })
    ```

    **D. wiiwho.d.ts** — extend the interface:

    ```typescript
    export interface WiiWhoAPI {
      auth: { /* existing */ }
      game: { /* existing */ }
      settings: { /* existing — v2 per Plan 04-01 */ }
      logs: { /* existing */ }
      __debug: { /* existing */ }
      // Phase 4 UI-06 — DELIBERATE 6th top-level key (Pitfall 10):
      spotify: {
        connect: () => Promise<{ ok: boolean; displayName?: string; error?: string }>
        disconnect: () => Promise<{ ok: boolean }>
        status: () => Promise<{
          connected: boolean
          displayName?: string
          isPremium?: 'yes' | 'no' | 'unknown'
          currentTrack?: {
            id: string
            name: string
            artists: string[]
            albumArtUrl?: string
            isPlaying: boolean
          } | null
        }>
        control: {
          play: () => Promise<{ ok: boolean; premiumRequired?: boolean }>
          pause: () => Promise<{ ok: boolean; premiumRequired?: boolean }>
          next: () => Promise<{ ok: boolean; premiumRequired?: boolean }>
          previous: () => Promise<{ ok: boolean; premiumRequired?: boolean }>
        }
        setVisibility: (v: 'focused' | 'backgrounded') => Promise<{ ok: boolean }>
        onStatusChanged: (cb: (s: {
          connected: boolean
          displayName?: string
          isPremium?: 'yes' | 'no' | 'unknown'
          currentTrack?: ReturnType<WiiWhoAPI['spotify']['status']> extends Promise<{ currentTrack?: infer T }> ? T : never
          premiumRequired?: boolean
        }) => void) => () => void
      }
    }
    ```
    (Simplify the onStatusChanged type if the conditional inference is unwieldy; a concrete inline type is acceptable.)

    5. Register handlers in `launcher/src/main/index.ts` after existing auth/game/settings/logs handlers are registered. Don't add the registration call in this plan unless it's trivial — Plan 04-07 owns App bootstrap wiring. Export `registerSpotifyHandlers(getPrimaryWindow)` so the App bootstrap can call it. If `launcher/src/main/index.ts` is not explicitly in files_modified, DO NOT modify it here — Plan 04-07 covers integration.

    6. Implementation plan for each file. Spell out the full tests + code (this task's action is long; break into sub-action files if needed). Write the simpler files first: tokenStore (done in Task 1), then oauth (Task 2 done), then api (Task 3 done), then spotifyManager + IPC + preload + wiiwho.d.ts (this task).
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/main/spotify/__tests__/spotifyManager.test.ts src/main/ipc/__tests__/spotify.test.ts src/preload/__tests__/index.test.ts && pnpm typecheck:node && pnpm typecheck:web</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/main/spotify/spotifyManager.ts` exports `getSpotifyManager`, `SpotifyManager` (at least as a type).
    - `launcher/src/main/ipc/spotify.ts` exports `registerSpotifyHandlers`; registers channels `spotify:connect`, `spotify:disconnect`, `spotify:status`, `spotify:control:play`, `spotify:control:pause`, `spotify:control:next`, `spotify:control:previous`, `spotify:set-visibility`.
    - `grep "spotify:" launcher/src/preload/index.ts` returns ≥5 hits (proving the spotify block added).
    - `grep "spotify:" launcher/src/renderer/src/wiiwho.d.ts` returns 0 hits (wiiwho.d.ts declares types, not channel strings — ignore) AND `grep "spotify" launcher/src/renderer/src/wiiwho.d.ts` returns ≥1 hit for the typed block.
    - Preload header comment contains literal string "DELIBERATE DEVIATION from Phase 1 D-11" (Pitfall 10).
    - Preload test verifies sorted keys === `['__debug', 'auth', 'game', 'logs', 'settings', 'spotify']`.
    - All spotifyManager, ipc/spotify, and preload tests pass.
    - `pnpm typecheck:node` exits 0.
    - `pnpm typecheck:web` exits 0.
  </acceptance_criteria>
  <done>SpotifyManager singleton + IPC handlers + preload 6th key + wiiwho.d.ts typed surface all delivered; Plan 04-06 can now consume these APIs from the renderer.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm --filter ./launcher run test:run` full suite exits 0.
- `pnpm --filter ./launcher run typecheck` exits 0.
- `grep -r "127\\.0\\.0\\.1:\\*" launcher/src/` returns 0 hits (no wildcard redirect anywhere).
- `grep "DELIBERATE DEVIATION from Phase 1 D-11" launcher/src/preload/index.ts` returns 1 hit (Pitfall 10 commit-message equivalent in-file).
- `grep "PREMIUM_REQUIRED" launcher/src/main/spotify/api.ts` returns ≥1 hit.
- `grep "Bearer \\[REDACTED\\]" launcher/src/main/auth/redact.ts` returns 1 hit.
- Manually: start launcher in dev, call `window.wiiwho.spotify.connect()` from DevTools → system browser opens the correct Spotify authorize URL with the runtime port in redirect_uri.
</verification>

<success_criteria>
UI-06 main-process plumbing complete: PKCE OAuth + loopback server + token exchange + refresh + safeStorage-encrypted persistence + full Web API wrapper with 401/429/403 PREMIUM_REQUIRED handling + singleton manager + IPC handlers + preload 6th-key exposure + wiiwho.d.ts typed surface. CONTEXT D-31 correction codified. Pitfall 10 deviation documented. Plan 04-06 (renderer Spotify UI) has everything it needs.

The commit for this plan MUST include in the commit message the literal text: "Adds deliberate 6th top-level preload key `spotify` — deviation from Phase 1 D-11 (frozen 5 keys). Pitfall 10 documented. Spotify redirect URI corrected to http://127.0.0.1/callback (no port) per Pitfall 6."
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-05-spotify-main-process-SUMMARY.md` documenting:
- PKCE flow end-to-end (code_verifier entropy, challenge method S256)
- Redirect URI correction (D-31) explicit note
- Preload 6th-key deviation (D-11 supersession)
- 403 PREMIUM_REQUIRED behavior
- 429 Retry-After honor pattern
- Event names emitted + IPC channels registered
- Any edge cases discovered during TDD
</output>
