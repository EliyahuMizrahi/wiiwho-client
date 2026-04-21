---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 09
type: execute
wave: 3
depends_on: ["03-01", "03-02", "03-06"]
files_modified:
  - launcher/src/preload/index.ts
  - launcher/src/renderer/src/wiiwho.d.ts
  - launcher/src/main/auth/AuthManager.ts
  - launcher/src/main/auth/AuthManager.test.ts
autonomous: true
requirements:
  - LCH-05
  - LCH-06
  - LCH-07
  - LAUN-05
  - COMP-05
must_haves:
  truths:
    - "Preload bridge exposes three NEW subscriptions on the EXISTING `game` top-level key: game.onLog, game.onExited, game.onCrashed (D-11 IPC-surface extension — no new top-level keys)"
    - "Preload bridge exposes one NEW invoke under existing `logs` key: logs.openCrashFolder(crashId?) — no new top-level key"
    - "Preload bridge exposes one NEW invoke under existing `logs` key: logs.listCrashReports() — no new top-level key"
    - "wiiwho.d.ts WiiWhoAPI types reflect the new subscriptions/invokes exactly"
    - "AuthManager exposes getMinecraftToken() returning { accessToken, username, uuid } — the surface Plan 03-10 orchestrator calls right before JVM spawn (LCH-06)"
    - "getMinecraftToken() never logs the raw token (electron-log redactor coverage asserted)"
  artifacts:
    - path: "launcher/src/preload/index.ts"
      provides: "game.onLog + game.onExited + game.onCrashed + logs.openCrashFolder + logs.listCrashReports on existing top-level keys"
    - path: "launcher/src/renderer/src/wiiwho.d.ts"
      provides: "WiiWhoAPI extended with matching types"
    - path: "launcher/src/main/auth/AuthManager.ts"
      provides: "getMinecraftToken() — fresh MC access token + username + uuid for the JVM spawn path"
      exports: ["AuthManager", "getAuthManager", "MinecraftToken"]
  key_links:
    - from: "launcher/src/preload/index.ts"
      to: "main process IPC channels game:log, game:exited, game:crashed, logs:open-crash-folder, logs:list-crashes"
      via: "ipcRenderer.on / ipcRenderer.invoke"
      pattern: "ipcRenderer"
    - from: "launcher/src/main/auth/AuthManager.ts"
      to: "prismarine-auth Authflow.getMinecraftJavaToken"
      via: "refreshed MSAL token"
      pattern: "getMinecraftJavaToken"
---

<objective>
Extend three surfaces so Plan 03-10 can build the orchestrator without any more plumbing changes:

1. **Preload bridge (`launcher/src/preload/index.ts`)** — add 3 subscriptions to the EXISTING `game` top-level key (`onLog`, `onExited`, `onCrashed`) and 2 invokes to the EXISTING `logs` top-level key (`openCrashFolder`, `listCrashReports`). **No new top-level keys** — D-11 frozen-surface invariant preserved per RESEARCH Open Q §2 recommendation.

2. **wiiwho.d.ts** — widen `WiiWhoAPI.game` and `WiiWhoAPI.logs` with the corresponding types. Renderer consumers (Plan 03-08) already code against these; this plan makes them real.

3. **AuthManager** — add `getMinecraftToken()` that returns `{ accessToken, username, uuid }` — calling `Authflow.getMinecraftJavaToken({fetchProfile: true})` on the cached profile. This is the Phase 3 ↔ Phase 2 seam: Plan 03-10's game:play handler calls this method to get the opaque MC token right before spawn (LCH-06).

Output: 3 files modified, 1 test file updated/created. After this plan, all the IPC + auth seams are solid for Plan 03-10's orchestrator.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundations/01-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/preload/index.ts
@launcher/src/renderer/src/wiiwho.d.ts
@launcher/src/main/auth/AuthManager.ts

<interfaces>
**Phase 1 D-11 (frozen IPC surface):**
- 5 top-level preload keys: `auth`, `game`, `settings`, `logs`, `__debug`
- 13 channels total.
- Phase 3 fills handler bodies AND may add new subscriptions / invokes UNDER existing top-level keys WITHOUT adding keys. (RESEARCH Open Q §2 autonomous recommendation.)

**What THIS plan adds (still honoring D-11):**

Under `game` (existing top-level key — no new key):
- `onLog(cb)` → subscribes to new channel `game:log`
- `onExited(cb)` → subscribes to new channel `game:exited`
- `onCrashed(cb)` → subscribes to new channel `game:crashed`

Under `logs` (existing top-level key — no new key):
- `openCrashFolder(crashId?)` → new invoke channel `logs:open-crash-folder`
- `listCrashReports()` → new invoke channel `logs:list-crashes`

Existing `logs.readCrash` stays; Plan 03-10 fills its body.

From launcher/src/main/auth/AuthManager.ts (Phase 2 exports):
```typescript
// class AuthManager
//   .loginWithDeviceCode(win) → LoginResult
//   .cancelDeviceCode()
//   .trySilentRefresh()
//   .logout()
//   .getStatus() → { loggedIn, username?, uuid? }
//
// NOT present yet — this plan adds:
//   .getMinecraftToken() → Promise<MinecraftToken>
//     where MinecraftToken = { accessToken: string; username: string; uuid: string }
```

The new method calls `Authflow(...).getMinecraftJavaToken({fetchProfile: true})` — same pattern as `trySilentRefresh` but returns the `token` + `profile` fields rather than discarding them.

From prismarine-auth types (launcher/node_modules/prismarine-auth/index.d.ts):
- `getMinecraftJavaToken({fetchProfile: true})` returns `{ token: string; entitlements: ...; profile: { id: string; name: string } | null }`

Note: the CURRENT AuthManager.loginWithDeviceCode ignores the `token` field and only preserves `profile`. This plan's getMinecraftToken needs the token.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend preload bridge + wiiwho.d.ts types (no new top-level keys)</name>
  <files>
    launcher/src/preload/index.ts,
    launcher/src/renderer/src/wiiwho.d.ts
  </files>
  <read_first>
    - launcher/src/preload/index.ts (current frozen surface — identify WHERE to add the new entries under `game` and `logs`)
    - launcher/src/renderer/src/wiiwho.d.ts (current types — update in lockstep)
    - .planning/phases/01-foundations/01-CONTEXT.md (D-11 IPC frozen surface — confirm the "no new top-level keys" rule)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md Open Q §2 (autonomous recommendation — extend existing keys, no new keys)
  </read_first>
  <action>
    **Edit `launcher/src/preload/index.ts`** — keep the existing 5 top-level keys and their existing members; ADD three more listeners to `game` and two more invokes to `logs`:

    ```typescript
    import { contextBridge, ipcRenderer } from 'electron'

    type Unsubscribe = () => void

    contextBridge.exposeInMainWorld('wiiwho', {
      auth: {
        status: () => ipcRenderer.invoke('auth:status'),
        login: () => ipcRenderer.invoke('auth:login'),
        logout: () => ipcRenderer.invoke('auth:logout'),
        onDeviceCode: (cb: (p: unknown) => void): Unsubscribe => {
          const h = (_: unknown, p: unknown): void => cb(p)
          ipcRenderer.on('auth:device-code', h)
          return () => ipcRenderer.off('auth:device-code', h)
        }
      },
      game: {
        play: () => ipcRenderer.invoke('game:play'),
        cancel: () => ipcRenderer.invoke('game:cancel'),
        status: () => ipcRenderer.invoke('game:status'),
        onStatus: (cb: (s: unknown) => void): Unsubscribe => {
          const h = (_: unknown, s: unknown): void => cb(s)
          ipcRenderer.on('game:status-changed', h)
          return () => ipcRenderer.off('game:status-changed', h)
        },
        onProgress: (cb: (p: unknown) => void): Unsubscribe => {
          const h = (_: unknown, p: unknown): void => cb(p)
          ipcRenderer.on('game:progress', h)
          return () => ipcRenderer.off('game:progress', h)
        },
        // NEW — Phase 3, under existing `game` key (honors D-11):
        onLog: (cb: (entry: unknown) => void): Unsubscribe => {
          const h = (_: unknown, entry: unknown): void => cb(entry)
          ipcRenderer.on('game:log', h)
          return () => ipcRenderer.off('game:log', h)
        },
        onExited: (cb: (ev: unknown) => void): Unsubscribe => {
          const h = (_: unknown, ev: unknown): void => cb(ev)
          ipcRenderer.on('game:exited', h)
          return () => ipcRenderer.off('game:exited', h)
        },
        onCrashed: (cb: (ev: unknown) => void): Unsubscribe => {
          const h = (_: unknown, ev: unknown): void => cb(ev)
          ipcRenderer.on('game:crashed', h)
          return () => ipcRenderer.off('game:crashed', h)
        }
      },
      settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        set: (patch: unknown) => ipcRenderer.invoke('settings:set', patch)
      },
      logs: {
        readCrash: (opts?: { crashId?: string }) =>
          ipcRenderer.invoke('logs:read-crash', opts ?? {}),
        // NEW — Phase 3, under existing `logs` key (honors D-11):
        openCrashFolder: (crashId?: string) =>
          ipcRenderer.invoke('logs:open-crash-folder', { crashId: crashId ?? null }),
        listCrashReports: () =>
          ipcRenderer.invoke('logs:list-crashes')
      },
      __debug: {
        securityAudit: () => ipcRenderer.invoke('__security:audit')
      }
    })
    ```

    **Edit `launcher/src/renderer/src/wiiwho.d.ts`** — widen the types for the new surface:

    ```typescript
    export interface WiiWhoAPI {
      auth: {
        status: () => Promise<{ loggedIn: boolean; username?: string; uuid?: string }>
        login: () => Promise<{ ok: boolean; username?: string; error?: string }>
        logout: () => Promise<{ ok: boolean }>
        onDeviceCode: (
          cb: (p: { userCode: string; verificationUri: string; expiresInSec: number }) => void
        ) => () => void
      }
      game: {
        play: () => Promise<{ ok: boolean; stub?: boolean; reason?: string; error?: string }>
        cancel: () => Promise<{ ok: boolean }>
        status: () => Promise<{
          state: 'idle' | 'downloading' | 'verifying' | 'starting' | 'playing' | 'failed' | 'crashed' | 'launching'
        }>
        onStatus: (cb: (s: { state: string }) => void) => () => void
        onProgress: (
          cb: (p: { bytesDone: number; bytesTotal: number; currentFile: string }) => void
        ) => () => void
        // NEW:
        onLog: (cb: (entry: { line: string; stream: 'out' | 'err' }) => void) => () => void
        onExited: (cb: (ev: { exitCode: number | null }) => void) => () => void
        onCrashed: (
          cb: (ev: { sanitizedBody: string; crashId: string | null }) => void
        ) => () => void
      }
      settings: {
        get: () => Promise<{ version: 1; ramMb: number; firstRunSeen: boolean }>
        set: (patch: Partial<{ ramMb: number; firstRunSeen: boolean }>) => Promise<{
          ok: boolean
          settings: { version: 1; ramMb: number; firstRunSeen: boolean }
        }>
      }
      logs: {
        readCrash: (opts?: { crashId?: string }) => Promise<{ sanitizedBody: string }>
        // NEW:
        openCrashFolder: (crashId?: string) => Promise<{ ok: boolean }>
        listCrashReports: () => Promise<{ crashes: Array<{ crashId: string; timestamp?: string }> }>
      }
      __debug: {
        securityAudit: () => Promise<{
          contextIsolation: boolean
          nodeIntegration: boolean
          sandbox: boolean
          allTrue: boolean
        }>
      }
    }
    ```

    Confirm: `grep -c "contextBridge.exposeInMainWorld" launcher/src/preload/index.ts` returns exactly 1 (single bridge call). Confirm the 5 top-level keys list is unchanged: `auth, game, settings, logs, __debug` — no additions.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "onLog:" launcher/src/preload/index.ts` (new subscription)
    - `grep -q "onExited:" launcher/src/preload/index.ts`
    - `grep -q "onCrashed:" launcher/src/preload/index.ts`
    - `grep -q "openCrashFolder:" launcher/src/preload/index.ts`
    - `grep -q "listCrashReports:" launcher/src/preload/index.ts`
    - `grep -q "'game:log'" launcher/src/preload/index.ts`
    - `grep -q "'game:exited'" launcher/src/preload/index.ts`
    - `grep -q "'game:crashed'" launcher/src/preload/index.ts`
    - `grep -q "'logs:open-crash-folder'" launcher/src/preload/index.ts`
    - `grep -q "'logs:list-crashes'" launcher/src/preload/index.ts`
    - Top-level keys count: `grep -oE "^[[:space:]]+(auth|game|settings|logs|__debug):" launcher/src/preload/index.ts | wc -l` returns exactly 5 (D-11 preserved)
    - `grep -q "onLog:" launcher/src/renderer/src/wiiwho.d.ts` (types widened)
    - `grep -q "onExited:" launcher/src/renderer/src/wiiwho.d.ts`
    - `grep -q "onCrashed:" launcher/src/renderer/src/wiiwho.d.ts`
    - `grep -q "openCrashFolder:" launcher/src/renderer/src/wiiwho.d.ts`
    - `grep -q "listCrashReports:" launcher/src/renderer/src/wiiwho.d.ts`
    - `cd launcher &amp;&amp; npm run typecheck` exits 0 (all existing code still typechecks against the widened types)
  </acceptance_criteria>
  <done>Preload bridge extended under existing keys; wiiwho.d.ts types mirror; typecheck passes; D-11 honored.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: AuthManager.getMinecraftToken() — Phase 2 ↔ Phase 3 seam</name>
  <files>
    launcher/src/main/auth/AuthManager.ts,
    launcher/src/main/auth/AuthManager.test.ts
  </files>
  <read_first>
    - launcher/src/main/auth/AuthManager.ts (Phase 2 complete implementation — understand trySilentRefresh pattern and its safeStorage/cache path to reuse)
    - launcher/node_modules/prismarine-auth/index.d.ts (getMinecraftJavaToken return shape — token + entitlements + profile)
    - launcher/src/main/auth/redact.ts (installRedactor covers logs — confirm getMinecraftToken doesn't log the raw token)
    - launcher/src/main/auth/safeStorageCache.ts (the encrypted cache the method reads from)
    - .planning/phases/02-microsoft-authentication/02-CONTEXT.md (AuthManager surface)
    - launcher/src/main/auth/AuthManager.test.ts (if exists — Phase 2 tests for the class; extend)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: `getMinecraftToken()` when logged-in returns `{accessToken, username, uuid}` matching the cached profile. `accessToken` is a string of length > 0.
    - Test 2: `getMinecraftToken()` when logged-out (no cache) throws or returns null — Plan 03-10's orchestrator maps this to "please log in again".
    - Test 3: `getMinecraftToken()` refreshes silently (calls `Authflow.getMinecraftJavaToken` internally with no codeCallback — silent-refresh path).
    - Test 4 (log-redaction regression): Force a call through `log.info` with the result — assert the log output doesn't contain the raw token (installRedactor's `scrub()` catches `"accessToken":"..."` and `access_token:...` shapes).
    - Test 5: Two sequential calls to getMinecraftToken() both succeed and return identical tokens (prismarine-auth caches the MC token for 24h; verifies no unnecessary network call).

    Mock `prismarine-auth` at the module level with a stub `Authflow` class whose `getMinecraftJavaToken` returns a fake `{token, profile}`.
  </behavior>
  <action>
    **Edit `launcher/src/main/auth/AuthManager.ts`** — ADD a new public method `getMinecraftToken()`. Do NOT alter existing methods.

    ```typescript
    // Add near the other public methods in class AuthManager:

    export interface MinecraftToken {
      accessToken: string
      username: string
      uuid: string
    }

    export class AuthManager {
      // ... existing members ...

      /**
       * Phase 3 entrypoint — returns a fresh MC access token for the JVM spawn.
       *
       * Called by ipc/game.ts right before building the argv. prismarine-auth
       * caches the MC token (24h TTL) so repeated calls within a session do
       * not hit Microsoft.
       *
       * Throws if no active account (logged out). Plan 03-10 maps the throw
       * to a user-facing "please log in again" path.
       *
       * SECURITY: the returned accessToken is the opaque ~280-char MC bearer.
       * This method NEVER logs it (electron-log's installRedactor scrubs
       * "accessToken":"..." shapes, but we don't log it in the first place).
       */
      async getMinecraftToken(): Promise<MinecraftToken> {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('OS keychain unavailable — please restart the launcher.')
        }

        const store = await readAuthStore()
        if (!store.activeAccountId || store.accounts.length === 0) {
          throw new Error('Not logged in.')
        }

        const flow = new Authflow(
          PRIMARY_USERNAME,
          safeStorageCacheFactory(resolveAuthDir()) as unknown as CacheFactory,
          { flow: 'msal', authTitle: AZURE_CLIENT_ID as never }
          // no codeCallback — must never trigger device-code prompt in this path
        )

        const result = (await flow.getMinecraftJavaToken({ fetchProfile: true })) as {
          token: string
          profile: { id: string; name: string } | null
        }

        if (!result.profile) {
          throw new Error('Minecraft profile missing — re-login required.')
        }

        // DO NOT log `result.token` here. The redactor WOULD scrub it, but
        // keeping sensitive values out of log paths entirely is the stronger
        // guarantee.
        this.status = {
          loggedIn: true,
          username: result.profile.name,
          uuid: result.profile.id
        }

        return {
          accessToken: result.token,
          username: result.profile.name,
          uuid: result.profile.id
        }
      }
    }
    ```

    **Add or extend `launcher/src/main/auth/AuthManager.test.ts`** with the 5 tests. Module-level mock of `prismarine-auth`:

    ```typescript
    const mockGetToken = vi.fn(async () => ({
      token: 'opaque-mc-token-abc123',
      profile: { id: 'uuid123', name: 'Wiiwho' }
    }))

    vi.mock('prismarine-auth', () => ({
      Authflow: class FakeAuthflow {
        constructor(_: string, _cache: unknown, _opts: unknown) {}
        async getMinecraftJavaToken(opts: { fetchProfile?: boolean }) {
          return mockGetToken()
        }
      }
    }))
    ```

    Confirm the Phase 2 tests still pass (since they also mock prismarine-auth — extend whatever current mock is in place).
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/main/auth/AuthManager.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async getMinecraftToken" launcher/src/main/auth/AuthManager.ts`
    - `grep -q "interface MinecraftToken" launcher/src/main/auth/AuthManager.ts`
    - `grep -q "accessToken:" launcher/src/main/auth/AuthManager.ts` (part of MinecraftToken interface)
    - `grep -q "getMinecraftJavaToken" launcher/src/main/auth/AuthManager.ts` (call to prismarine-auth)
    - `grep -qv "log.info.*result.token\\|log.debug.*result.token\\|log.*token.accessToken\\|log.*accessToken" launcher/src/main/auth/AuthManager.ts` — no log statements including the raw token
    - `grep -q "export interface MinecraftToken" launcher/src/main/auth/AuthManager.ts || grep -q "export type MinecraftToken" launcher/src/main/auth/AuthManager.ts`
    - Phase 2 existing method signatures preserved: `grep -q "async loginWithDeviceCode" launcher/src/main/auth/AuthManager.ts` + `grep -q "async trySilentRefresh" launcher/src/main/auth/AuthManager.ts` + `grep -q "async logout" launcher/src/main/auth/AuthManager.ts`
    - `cd launcher &amp;&amp; npx vitest run src/main/auth/AuthManager.test.ts` exits 0 with all existing + ≥5 new tests passing
  </acceptance_criteria>
  <done>AuthManager exposes getMinecraftToken() — Phase 2 methods untouched; 5 new tests pass; no raw-token logging.</done>
</task>

</tasks>

<verification>
- `cd launcher && npm run typecheck && npx vitest run src/main/auth/AuthManager.test.ts` — all green
- `cd launcher && npm run test:run` — full suite green
- D-11 IPC frozen-surface invariant: top-level preload keys count is 5 (grep-verified)
- LCH-06 seam in place: Plan 03-10 now has a single function to call (`getAuthManager().getMinecraftToken()`)
</verification>

<success_criteria>
- D-11 preserved: no new top-level preload keys; only new invokes/subscriptions under `game` and `logs`
- LCH-06: AuthManager.getMinecraftToken() delivers the opaque MC token Plan 03-10 needs
- COMP-05 reinforced: the token is never logged from AuthManager.ts
- wiiwho.d.ts types flow end-to-end (renderer already used these in Plan 03-08; now they exist)
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-09-SUMMARY.md` documenting:
- Final channel count (13 + 5 new = 18) — confirm whether Phase 1 D-11's "13 channels total" was a snapshot or a cap (if cap, escalate to owner)
- Any prismarine-auth 3.1.1 type surface quirks (Plan 02-03 already noted two — check if getMinecraftJavaToken has a third for the fetchProfile:true branch)
- How AuthManager.test.ts's existing mocks were extended (so future plans can read one coherent test file)
</output>
