---
phase: 04-launcher-ui-polish
plan: 05
subsystem: spotify-main-process
tags: [spotify, oauth, pkce, safestorage, ipc, preload, premium-required]

requires:
  - phase: 04-launcher-ui-polish
    plan: 00
    provides: SPOTIFY_CLIENT_ID + SPOTIFY_REDIRECT_PORTS + buildRedirectUri + Nyquist test stubs
provides:
  - launcher/src/main/paths.ts exports resolveSpotifyTokenPath() (userData/spotify.bin)
  - launcher/src/main/spotify/tokenStore.ts — safeStorage-encrypted read/write/clear (fail-closed)
  - launcher/src/main/spotify/oauth.ts — generatePkcePair + startOneShotCallbackServer (port fallback) + buildAuthorizeUrl + exchangeCodeForTokens + refreshAccessToken + startPKCEFlow
  - launcher/src/main/spotify/api.ts — spotifyFetch wrapper with 401 refresh / 429 Retry-After / 403 PREMIUM_REQUIRED handling + Track / SpotifyUser endpoints
  - launcher/src/main/spotify/spotifyManager.ts — lazy singleton orchestrator (connect/disconnect/status/play/pause/next/previous/setVisibility/pollOnce/restoreFromDisk/'status-changed' event)
  - launcher/src/main/ipc/spotify.ts — registerSpotifyHandlers(getPrimaryWindow) with 8 invocation channels + status-changed push
  - launcher/src/preload/index.ts — DELIBERATE 6th top-level key `spotify` (Pitfall 10)
  - launcher/src/renderer/src/wiiwho.d.ts — typed spotify surface mirroring preload
  - launcher/src/main/auth/redact.ts — SPOTIFY_BEARER_PATTERN slotted before JWT
affects: [04-06, 04-07]

tech-stack:
  added: []
  patterns:
    - "OAuth loopback callback with in-order port fallback + PORTS_BUSY surface (future providers can reuse)"
    - "Singleton orchestrator + EventEmitter + IPC passthrough (mirrors Phase 2 AuthManager pattern for a second credential store)"
    - "Preload DELIBERATE 6-key surface ratcheted up from D-11's 5 — future 7th key requires same deliberate process"

key-files:
  created:
    - launcher/src/main/spotify/tokenStore.ts
    - launcher/src/main/spotify/oauth.ts
    - launcher/src/main/spotify/api.ts
    - launcher/src/main/spotify/spotifyManager.ts
    - launcher/src/main/ipc/spotify.ts
    - launcher/src/main/ipc/__tests__/spotify.test.ts
    - launcher/src/main/spotify/__tests__/spotifyManager.test.ts
    - launcher/src/preload/__tests__/index.test.ts
  modified:
    - launcher/src/main/paths.ts (added resolveSpotifyTokenPath)
    - launcher/src/main/paths.test.ts (added spotify-token-path case)
    - launcher/src/main/auth/redact.ts (added SPOTIFY_BEARER_PATTERN + reordered scrub pipeline)
    - launcher/src/main/auth/__tests__/redact.test.ts (added 5 Spotify cases)
    - launcher/src/main/spotify/__tests__/tokenStore.test.ts (Wave 0 stub → real tests)
    - launcher/src/main/spotify/__tests__/oauth.test.ts (Wave 0 stub → real tests)
    - launcher/src/main/spotify/__tests__/api.test.ts (Wave 0 stub → real tests)
    - launcher/src/preload/index.ts (added spotify block + DELIBERATE DEVIATION header)
    - launcher/src/renderer/src/wiiwho.d.ts (added spotify typed surface)

key-decisions:
  - "Port-fallback bindWithFallback() iterates SPOTIFY_REDIRECT_PORTS and surfaces PORTS_BUSY when all three are occupied — no runtime-random ports because Spotify's /authorize requires exact-match against pre-registered dashboard URIs. Plan 04-06 renderer can treat PORTS_BUSY as a user-facing 'Try again' CTA."
  - "Request handler attached to the loopback server EAGERLY (before awaitCallback awaits) — otherwise a callback that races in before startPKCEFlow reaches `await awaitCallback()` would be dropped. The pre-awaited promise is .catch-safed to avoid Node unhandled-rejection warnings on the synchronous-reject paths."
  - "Response `Connection: close` header + server.closeAllConnections() after the single callback — prevents keep-alive sockets from holding the loopback port open into the next OAuth attempt. Critical for retry scenarios."
  - "SpotifyManager.play() short-circuits before the API round-trip when cached isPremium === 'no' — saves latency and a guaranteed 403. The API disagreement path (user upgraded Spotify post-connect OR connect-time /v1/me lied) is handled via the 403 PREMIUM_REQUIRED flag flipping in-memory isPremium back to 'no' and emitting status-changed."
  - "observeTrack de-duplicates status-changed emits by (trackId, isPlaying) — identical polls do not trigger renderer re-renders. Test locks this invariant."
  - "IPC handler attaches 'status-changed' listener at registerSpotifyHandlers() time — the listener resolves `getPrimaryWindow()` LAZILY on each emit so macOS window close/reopen cycles don't leak references."
  - "Preload 6th key is the ONLY deliberate expansion of D-11 in Phase 4. File header documents why `spotify` cannot cleanly nest under any existing key. Regression test ratchets the expected key-count to 6."

requirements-completed: [UI-06]

duration: ~20 min
completed: 2026-04-24
---

# Phase 4 Plan 05: Spotify Main-Process Integration Summary

**Wave 4 delivers the full main-process Spotify plumbing UI-06 needs — PKCE OAuth with loopback callback server + in-order port fallback over 3 pre-registered ports + safeStorage-encrypted token persistence + Web API wrapper with authoritative 401/429/403 PREMIUM_REQUIRED handling + singleton SpotifyManager orchestrator + IPC handler module + DELIBERATE 6th top-level preload key `spotify`. No CONTEXT-level architectural changes. 80 new tests; 550 total green.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-24T06:29:20Z
- **Completed:** 2026-04-24T06:49:09Z
- **Tasks:** 4 (all auto + TDD)
- **Files created:** 8
- **Files modified:** 9
- **New tests:** 80 (oauth 18, api 18, spotifyManager 13, ipc 11, preload 7, tokenStore 7, redact +5, paths +1)
- **Final suite:** 550 passed + 3 todo + 0 failed (baseline 470 + 6 todo)

## Accomplishments

### PKCE OAuth with 3-port fallback

`launcher/src/main/spotify/oauth.ts` implements the full PKCE Authorization Code flow end-to-end:

- **`generatePkcePair()`**: 64 random bytes → base64url verifier (86 chars) → SHA-256 → base64url challenge (no padding).
- **`startOneShotCallbackServer()`**: Iterates `SPOTIFY_REDIRECT_PORTS` (Plan 04-00 correction — `[53682, 53681, 53683]`). On `EADDRINUSE`, falls through to next port. If all three are occupied, rejects with `PORTS_BUSY: ...` error — Plan 04-06 renderer surfaces this as "Port conflict — try again".
- Request handler attached EAGERLY at server construction time, not lazily inside `awaitCallback` — prevents a dropped callback if the browser redirect races `await awaitCallback()`.
- `Connection: close` + `closeAllConnections()` after the single callback — port is free immediately for the next attempt.
- **`buildAuthorizeUrl()`**: `client_id` + `response_type=code` + `redirect_uri` (matches dashboard-registered port) + `code_challenge_method=S256` + `code_challenge` + space-joined `scope` + `state` (16-byte base64url CSRF nonce).
- **`exchangeCodeForTokens()`**: Form-encoded POST to `/api/token`; same `redirect_uri` from the authorize step (Spotify validates consistency).
- **`refreshAccessToken()`**: Preserves caller's old refresh token when Spotify doesn't rotate one in the response.
- **`startPKCEFlow()`**: Full orchestration with state CSRF validation.

### Token storage — safeStorage-encrypted, fail-closed

`launcher/src/main/spotify/tokenStore.ts` mirrors the Phase 2 `auth.bin` pattern:

- File: `userData/spotify.bin` (new `resolveSpotifyTokenPath()` in `paths.ts`).
- Atomic temp + rename write (no partial-write window on crash).
- `readSpotifyTokens()` returns `null` on `ENOENT` (first-run / post-disconnect).
- `clearSpotifyTokens()` is idempotent (`ENOENT` = success).
- Fail-closed: if `safeStorage.isEncryptionAvailable()` returns `false`, both read and write **throw** with `"safeStorage unavailable — refusing to [read|write] Spotify tokens"`. No silent plaintext fallback.

### Web API wrapper — three response-code handlers

`launcher/src/main/spotify/api.ts`:

- **401 Unauthorized** → single refresh-and-retry via caller-provided `onRefresh`. Second 401 throws `AuthExpiredError`.
- **429 Too Many Requests** → reads `Retry-After` seconds header; waits; retries exactly once. No exponential backoff.
- **403 with `reason: "PREMIUM_REQUIRED"`** → returns `{ status: 403, premiumRequired: true }`. Does NOT retry (same request would produce the same 403).
- **403 with any other reason** → throws with the API's message.
- Control endpoints (`play`/`pause`/`next`/`previous`) surface the `premiumRequired` flag upward to the SpotifyManager.
- Read endpoints (`getCurrentlyPlaying`, `getPlaybackState`) handle 204 "idle" states as `null`.

### Spotify Bearer redaction

`launcher/src/main/auth/redact.ts` extended with `SPOTIFY_BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_-]{30,}/g`, slotted in the scrub pipeline **before** `JWT_PATTERN` so the replacement reads `Bearer [REDACTED]` instead of `Bearer eyJ[REDACTED]`. Length bound ≥ 30 keeps false positives off prose.

### SpotifyManager singleton

`launcher/src/main/spotify/spotifyManager.ts` mirrors Phase 2's `AuthManager` pattern:

- `connect()` → `startPKCEFlow` → `getCurrentUser` → `writeSpotifyTokens`; `product === 'premium'` sets `isPremium='yes'`, else `'no'`.
- `disconnect()` → `stopPolling` + `clearSpotifyTokens` + reset in-memory state + emit `{ connected: false }`.
- `play/pause/next/previous` short-circuit when `isPremium === 'no'`; on 403 `premiumRequired` from an ostensibly-premium user, downgrade cached `isPremium` to `'no'`, persist, and emit a status event.
- `setVisibility('focused'|'backgrounded')` flips polling cadence between `POLL_MS_FOCUSED = 5000` and `POLL_MS_BACKGROUNDED = 15000`. D-34 compliant.
- `pollOnce()` observes the currently-playing track; emits `'status-changed'` only when `(trackId, isPlaying)` differs from the prior poll (no redundant events).
- `AuthExpiredError` on poll → `clearSpotifyTokens` + emit disconnected.
- `restoreFromDisk()` rehydrates tokens at launch (silent on `ENOENT`).

### IPC handlers — not auto-registered

`launcher/src/main/ipc/spotify.ts` exports `registerSpotifyHandlers(getPrimaryWindow)`. **Not** called at module-load — Plan 04-07 wires it into `main/index.ts`. Registers 8 invocation channels:

```
spotify:connect
spotify:disconnect
spotify:status
spotify:control:play
spotify:control:pause
spotify:control:next
spotify:control:previous
spotify:set-visibility
```

Push events emitted via `primaryWindow.webContents.send('spotify:status-changed', payload)` on manager's `'status-changed'` event. `getPrimaryWindow()` resolved lazily on each emit so macOS window close/reopen cycles are resilient.

### Preload — DELIBERATE 6th top-level key

`launcher/src/preload/index.ts` header now explicitly documents:

> **DELIBERATE DEVIATION from Phase 1 D-11 (Pitfall 10, Phase 4 UI-06):**
> Phase 4 adds `spotify` as a 6th top-level key. This is the ONLY intended extension of the D-11 surface in v0.1…

The test `launcher/src/preload/__tests__/index.test.ts` ratchets the expected key count:

```ts
expect(keys).toEqual(['__debug', 'auth', 'game', 'logs', 'settings', 'spotify'])
```

Adding a 7th key would require the same deliberate process — file header, test update, SUMMARY deviation.

## Task Commits

Each task used TDD (RED test commit → GREEN implementation commit), all committed with `--no-verify` per the parallel-wave convention:

1. **Task 1 RED** — `9f76ff7` test(04-05): add failing tests for Spotify token store + redactor extension
2. **Task 1 GREEN** — `a57b3ff` feat(04-05): add Spotify safeStorage token store + redactor Bearer pattern
3. **Task 2 RED** — `e0dfc22` test(04-05): add failing tests for Spotify PKCE OAuth + loopback callback
4. **Task 2 GREEN** — `03373a2` feat(04-05): implement Spotify PKCE OAuth + loopback callback with port fallback
5. **Task 3 RED** — `14ab7c8` test(04-05): add failing tests for Spotify Web API wrapper
6. **Task 3 GREEN** — `d570ea4` feat(04-05): implement Spotify Web API wrapper with 401/429/403 handling
7. **Task 4 RED** — `945001d` test(04-05): add failing tests for SpotifyManager + IPC + preload 6th key
8. **Task 4 GREEN** — `9a10660` feat(04-05): SpotifyManager singleton + IPC + preload DELIBERATE 6th key

Task 4's GREEN commit message contains the literal required text:

> Adds deliberate 6th top-level preload key `spotify` — deviation from Phase 1 D-11 (frozen 5 keys). Pitfall 10 documented.

Plus a cleanup commit:

9. **Cleanup** — `ec93688` chore(04-05): escape wildcard-URL pattern in config/oauth deviation comments — keeps `grep -r "127\.0\.0\.1:\*" launcher/src/` at 0 matches while preserving the documentation trail.

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **Port-fallback with PORTS_BUSY surface.** Spotify's post-2025-11-27 OAuth migration banned wildcard redirect URIs and requires exact-match with pre-registered ports. We honor that with in-order binding against the 3 dashboard-registered ports, failing with a stable `PORTS_BUSY` error that the renderer can recognize.

- **Eagerly attached request handler + pre-awaited settled promise.** Without this, a fast-responding browser callback could race ahead of `await server.awaitCallback()` and be dropped. Plan's illustrative code had this bug; fixed here with a single settled-once promise pattern.

- **`Connection: close` header + `closeAllConnections()` in the callback handler.** HTTP keepalive holds loopback ports, blocking immediate retry. Without this the test suite's sequential OAuth tests fail intermittently from port lingering (observed during TDD).

- **Short-circuit `isPremium === 'no'` before API round-trip.** Free-tier users hitting play/pause/next/previous get an instant `{ premiumRequired: true }` response; no pointless 403 round-trip. Paired with the runtime-disagreement path: if connect-time `/v1/me` said premium but `play()` returns 403 PREMIUM_REQUIRED, we downgrade in-memory and emit status-changed so Plan 04-06's UI can flip the badge.

- **Preload 6th key is ratcheted.** The DELIBERATE DEVIATION header + the updated test locks the expected count at 6. This is the *only* planned expansion of D-11 in v0.1 — a 7th key requires the same process.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's illustrative `awaitCallback` pattern had a race**

- **Found during:** Task 2 test execution
- **Issue:** The plan's illustrative oauth.ts code attached `server.on('request', ...)` inside `awaitCallback()`. This means a callback that arrives BEFORE the caller `await`s `awaitCallback()` is silently dropped. The plan's own `startPKCEFlow` orchestration (`await shell.openExternal(authUrl); const {...} = await server.awaitCallback()`) is exactly this race: the mocked `openExternal` in tests fires the callback synchronously, so by the time `server.awaitCallback()` is called, the browser has already hit `/callback` and the handler was never attached.
- **Fix:** Request handler attached eagerly at `startOneShotCallbackServer()` construction time. A single settled-once promise is set up at the same time; `awaitCallback()` simply returns that promise. Added `.catch(() => {})` placeholder so synchronous rejections don't trigger Node unhandled-rejection warnings on paths where the caller's `await` happens on the next tick.
- **Files modified:** `launcher/src/main/spotify/oauth.ts` + `launcher/src/main/spotify/__tests__/oauth.test.ts`
- **Test coverage:** The full startPKCEFlow happy-path + state-mismatch tests exercise this race deliberately.
- **Committed in:** `03373a2`

**2. [Rule 1 - Bug] Plan's oauth test mocked `fetch` globally, breaking loopback-server access from within the openExternal mock**

- **Found during:** Task 2 startPKCEFlow integration tests
- **Issue:** The test stubs global `fetch` to intercept the `/api/token` call, then uses the same `fetch` inside the `shell.openExternal` mock to trigger the loopback callback. The mock fetch always returned the token JSON, never actually hitting `127.0.0.1:<port>/callback`. Result: the loopback server never saw the callback, `awaitCallback` never resolved, test timed out.
- **Fix:** Capture the `realFetch = globalThis.fetch` at describe scope. Replace the global `fetch` with a function that routes `http://127.0.0.1:` URLs to `realFetch` and returns the canned `/api/token` response for everything else. Call `realFetch` directly inside the `openExternal` mock.
- **Files modified:** `launcher/src/main/spotify/__tests__/oauth.test.ts`
- **Committed in:** `03373a2`

**3. [Rule 3 - Blocking] `server.close()` non-blocking + HTTP keepalive holds loopback port between sequential tests**

- **Found during:** Task 2 — tests 5-6 of the callback-server suite passed but test 7 timed out because port 57821 was still bound by the previous test's server due to keep-alive sockets.
- **Fix:** Added `res.setHeader('Connection', 'close')` before `res.writeHead(200)`, plus `server.closeAllConnections?.()` before `server.close()`. This forces any lingering keep-alive sockets closed synchronously so the next test/OAuth attempt sees the port as free.
- **Files modified:** `launcher/src/main/spotify/oauth.ts`
- **Committed in:** `03373a2`

**4. [Rule 3 - Blocking] Plan's `on(event, listener)` overload signature produced TS2394**

- **Found during:** Task 4 typecheck
- **Issue:** The event-emitter pattern I initially used had an overload declaration that TypeScript's strict mode flagged as incompatible with the implementation signature.
- **Fix:** Collapsed to a single-signature method `on(event: 'status-changed', listener: StatusListener): () => void` with an internal cast to the bucket's stored shape.
- **Files modified:** `launcher/src/main/spotify/spotifyManager.ts`
- **Committed in:** `9a10660`

**5. [Rule 3 - Blocking] JSDoc `*/` inside comment terminated the block prematurely**

- **Found during:** Task 4 preload test compile
- **Issue:** The JSDoc string `control.*/setVisibility/onStatusChanged` contained the literal characters `*/` which the TypeScript parser read as end-of-block-comment, causing a syntax error three lines later.
- **Fix:** Reworded the comment to `control.play|pause|next|previous, setVisibility, onStatusChanged`.
- **Files modified:** `launcher/src/preload/__tests__/index.test.ts`
- **Committed in:** `9a10660`

**6. [Rule 3 - Blocking] Comment-text `127.0.0.1:*` matched the plan's zero-hit grep assertion**

- **Found during:** Post-Task-4 verification
- **Issue:** Plan's acceptance criterion: `grep -r "127\.0\.0\.1:\*" launcher/src/` returns 0 hits. My deviation-explanation comments in `config.ts` and `oauth.ts` deliberately referenced the original wrong shape `http://127.0.0.1:*` to tell future readers what NOT to do — but this produced 2 hits in the literal grep.
- **Fix:** Rewrote comment text as `127.0.0.1 + wildcard-port` — same intent, zero regex collisions.
- **Files modified:** `launcher/src/main/spotify/config.ts`, `launcher/src/main/spotify/oauth.ts`
- **Committed in:** `ec93688`

### Auth gates

None during this plan — end-to-end OAuth requires runtime-user browser interaction and is deferred to Plan 04-06 + 04-07 manual QA.

**Total deviations:** 6 auto-fixed (all Rule 1/3). No architectural changes. All deviations are implementation-level corrections to plan's illustrative code or test hygiene.

## Issues Encountered

- Multiple TDD RED-phase iterations needed for the oauth callback server due to port-lifecycle subtleties (TIME_WAIT, keep-alive sockets, handler-attachment race). All resolved with Rule-3 auto-fixes.

## User Setup Required

**None for this plan.** Plan 04-00 already completed the Spotify dashboard registration (3 ports + client ID). No new secrets, no env vars, no keychain prompts.

## Verification

```
pnpm --filter ./launcher run test:run  →  550 passed + 3 todo + 0 failed
pnpm --filter ./launcher run typecheck →  exit 0 (node + web both clean)
grep -r "127\.0\.0\.1:\*" launcher/src →  0 matches
grep "DELIBERATE DEVIATION from Phase 1 D-11" launcher/src/preload/index.ts → 1 hit
grep "PREMIUM_REQUIRED" launcher/src/main/spotify/api.ts → 6 hits
grep "Bearer \[REDACTED\]" launcher/src/main/auth/redact.ts → 2 hits
grep "randomBytes(64).toString('base64url')" launcher/src/main/spotify/oauth.ts → 1 hit
```

Manual end-to-end (deferred to Plan 04-06 + 04-07): start launcher in dev mode, call `window.wiiwho.spotify.connect()` from DevTools → system browser opens the Spotify consent page with the runtime port embedded in `redirect_uri` → consent → launcher receives tokens and writes `spotify.bin`.

## Next Phase Readiness

**Plan 04-06** (renderer Spotify UI) can consume:

- `window.wiiwho.spotify.connect()` / `.disconnect()` / `.status()`
- `window.wiiwho.spotify.control.{play,pause,next,previous}()`
- `window.wiiwho.spotify.setVisibility('focused' | 'backgrounded')`
- `window.wiiwho.spotify.onStatusChanged(callback)` subscription

The full typed shape lives in `launcher/src/renderer/src/wiiwho.d.ts`. SpotifyManager's 5s/15s polling cadence is already hooked up — renderer just needs to call `setVisibility` from an app-focus effect.

**Plan 04-07** (integration) needs to:
1. Call `registerSpotifyHandlers(getPrimaryWindow)` in `main/index.ts` after `registerAuthHandlers`.
2. Call `getSpotifyManager().restoreFromDisk()` at `app.whenReady()` (parallel to the `trySilentRefresh` flow) so saved tokens are live before the first renderer `spotify:status` query.

No blockers. No pending todos.

## Self-Check: PASSED

**Files (verified present + non-zero):**

- [x] `launcher/src/main/spotify/tokenStore.ts` (85 lines)
- [x] `launcher/src/main/spotify/oauth.ts` (291 lines — includes port-fallback logic + eager handler + connection-close)
- [x] `launcher/src/main/spotify/api.ts` (216 lines — includes 401/429/403 PREMIUM_REQUIRED)
- [x] `launcher/src/main/spotify/spotifyManager.ts` (285 lines — singleton + EventEmitter + poll)
- [x] `launcher/src/main/ipc/spotify.ts` (50 lines — 8 channels + status-changed forward)
- [x] `launcher/src/main/ipc/__tests__/spotify.test.ts` (147 lines — 11 tests)
- [x] `launcher/src/main/spotify/__tests__/spotifyManager.test.ts` (262 lines — 13 tests)
- [x] `launcher/src/preload/__tests__/index.test.ts` (92 lines — 7 tests)

**Commits (verified in `git log --oneline -15`):**

- [x] `9f76ff7` test(04-05): add failing tests for Spotify token store + redactor extension
- [x] `a57b3ff` feat(04-05): add Spotify safeStorage token store + redactor Bearer pattern
- [x] `e0dfc22` test(04-05): add failing tests for Spotify PKCE OAuth + loopback callback
- [x] `03373a2` feat(04-05): implement Spotify PKCE OAuth + loopback callback with port fallback
- [x] `14ab7c8` test(04-05): add failing tests for Spotify Web API wrapper
- [x] `d570ea4` feat(04-05): implement Spotify Web API wrapper with 401/429/403 handling
- [x] `945001d` test(04-05): add failing tests for SpotifyManager + IPC + preload 6th key
- [x] `9a10660` feat(04-05): SpotifyManager singleton + IPC + preload DELIBERATE 6th key
- [x] `ec93688` chore(04-05): escape wildcard-URL pattern in config/oauth deviation comments

**Test suite:** Full launcher suite post-plan: **550 passed + 3 todo + 0 failed** (60 test files, 3 todo remaining are non-blocking Plan 04-06/04-07 targets).

---

*Phase: 04-launcher-ui-polish*
*Completed: 2026-04-24*
