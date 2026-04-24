---
phase: 04-launcher-ui-polish
plan: 00
subsystem: infra
tags: [motion, fonts, spotify, oauth, nyquist, scaffolding, pkce]

requires:
  - phase: 03-vanilla-launch-jre-bundling-packaging
    provides: stable launcher build (vitest 4 + RTL 16 pattern, paths.ts resolvers, safeStorage auth pattern — all mirrored by later Phase 4 plans)
provides:
  - motion@^12.38.0 dependency in launcher/package.json (the Phase 4 UI animation library)
  - Bundled Inter Variable + JetBrains Mono Variable fonts under launcher/src/renderer/src/assets/fonts/ with verbatim SIL OFL 1.1 license files
  - launcher/src/main/spotify/config.ts — non-secret Spotify PKCE config (client ID + scopes + 3 loopback ports + buildRedirectUri helper)
  - launcher/src/main/spotify/__fixtures__/ directory placeholder
  - 12 Nyquist test-stub files providing stable targets for every downstream Phase 4 plan's <automated> verify
affects: [04-01, 04-02, 04-03, 04-04, 04-05, 04-06, 04-07]

tech-stack:
  added:
    - motion@^12.38.0 (Framer Motion's successor; replaces deprecated framer-motion name)
    - Inter Variable woff2 (bundled; SIL OFL 1.1)
    - JetBrains Mono Variable woff2 (bundled; SIL OFL 1.1 — NOT Apache 2.0 as plan assumed)
  patterns:
    - "Nyquist-style test scaffolding — downstream plans get stable <automated> targets upfront via it.todo stubs"
    - "Spotify redirect port list + buildRedirectUri helper (not single hardcoded URI) — accommodates Spotify's post-2025-11-27 OAuth rule that URIs must exactly match a registered URI with explicit port"

key-files:
  created:
    - launcher/src/renderer/src/assets/fonts/inter/InterVariable.woff2 (Task 1)
    - launcher/src/renderer/src/assets/fonts/inter/LICENSE.txt (Task 1)
    - launcher/src/renderer/src/assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2 (Task 1)
    - launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt (Task 1)
    - launcher/src/main/spotify/config.ts (Task 3)
    - launcher/src/main/spotify/config.test.ts (Task 3)
    - launcher/src/main/spotify/__fixtures__/README.md (Task 3)
    - launcher/src/renderer/src/test/antiBloat.test.tsx (Task 4 — target Plan 04-07)
    - launcher/src/renderer/src/test/motion.test.ts (Task 4 — target Plan 04-01)
    - launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts (Task 4 — target Plan 04-01)
    - launcher/src/renderer/src/stores/__tests__/spotify.test.ts (Task 4 — target Plan 04-06)
    - launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx (Task 4 — target Plan 04-04)
    - launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx (Task 4 — target Plan 04-02)
    - launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx (Task 4 — target Plan 04-03)
    - launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx (Task 4 — target Plan 04-06)
    - launcher/src/main/spotify/__tests__/oauth.test.ts (Task 4 — target Plan 04-05)
    - launcher/src/main/spotify/__tests__/api.test.ts (Task 4 — target Plan 04-05)
    - launcher/src/main/spotify/__tests__/tokenStore.test.ts (Task 4 — target Plan 04-05)
    - launcher/src/main/settings/__tests__/store-v2-migration.test.ts (Task 4 — target Plan 04-01)
  modified:
    - launcher/package.json (Task 1 — added motion@^12.38.0 dependency)

key-decisions:
  - "JetBrains Mono upstream license is SIL OFL 1.1 (verified at https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt) — plan assumption of Apache 2.0 was wrong. Shipped verbatim OFL 1.1 text. Both bundled fonts therefore share the same SIL OFL 1.1 license for attribution consistency."
  - "Spotify redirect URI MUST include an explicit port (http://127.0.0.1:<PORT>/callback) per Spotify's 2025-11-27 OAuth migration. Bare http://127.0.0.1/callback (plan original) is refused by the dashboard validator as 'not secure'. Owner registered THREE fixed loopback ports in dashboard: 53682 (primary) + 53681 + 53683 (fallbacks). Plan 04-05's OAuth module will try these in order."
  - "config.ts exports SPOTIFY_REDIRECT_PORTS (readonly number tuple) + buildRedirectUri(port) helper INSTEAD of any single SPOTIFY_REDIRECT_URI constant — there is no single correct value. Plan 04-05 will iterate the port list for server bind-with-fallback."
  - "SPOTIFY_CLIENT_ID committed as plaintext code (not an env var). It is a PUBLIC identifier per PKCE public-client flow; no client secret exists. Treating it as non-secret matches how the Azure AD app ID is already handled in Phase 2 (D-18 pattern)."

patterns-established:
  - "Port-list + helper pattern for OAuth loopback redirects — applicable to any future provider that requires exact-match dashboard-registered URIs"
  - "Nyquist Wave 0 pattern — scaffold all downstream test files with @vitest-environment docblock + it.todo for every planned real test. Keeps all future plans' <automated> verifies from failing with 'MISSING file' before the owning plan lands."
  - "Renderer-side test stubs use @vitest-environment jsdom + afterEach(cleanup) as the repo-wide invariant (locked in Phase 2 Plan 02-04). Main-process stubs use @vitest-environment node."

requirements-completed: [UI-01, UI-03, UI-04, UI-05, UI-06, UI-07]

duration: ~45 min (human checkpoint 41 min + 4 min resumed execution)
completed: 2026-04-24
---

# Phase 4 Plan 00: Infrastructure Summary

**Wave 0 scaffolding — motion dep installed, Inter + JetBrains Mono variable fonts bundled with verbatim licenses, Spotify PKCE config module with corrected 3-port loopback list, 12 Nyquist test-stub files unblocking every downstream Phase 4 plan's automated verify.**

## Performance

- **Duration:** ~45 min total (Task 1 ~3 min, Task 2 ~41 min human wait for Spotify dashboard, Task 3 ~2 min, Task 4 ~2 min)
- **Started:** 2026-04-24T04:38:00Z (Task 1 commit timestamp range)
- **Completed:** 2026-04-24T05:33:17Z
- **Tasks:** 4 (1 human-action checkpoint, 3 auto)
- **Files created:** 19 (4 font assets + 1 LICENSE pair + 3 Spotify config + 12 Nyquist stubs)
- **Files modified:** 1 (launcher/package.json)

## Accomplishments

- **motion@^12.38.0** installed cleanly in launcher/package.json. No framer-motion, no get-port (per CONTEXT "no unjustified deps").
- **Inter Variable** (352,240 bytes, SHA256 `693B77D4F32EE9B8BFC995589B5FAD5E99ADF2832738661F5402F9978429A8E3`) + verbatim SIL OFL 1.1 license on disk. Ready for Plan 04-01's @font-face wiring.
- **JetBrains Mono Variable** (113,700 bytes, SHA256 `E190EE6595A3B9BD25278613A6F5D3766EE1A708F300ED44FA63DBE84051498F`) + verbatim SIL OFL 1.1 license on disk.
- **Spotify dev app** registered under owner's account with Client ID `1829...8d06` (masked; full value committed to config.ts per D-18 non-secret pattern). THREE loopback ports registered per current Spotify rules.
- **launcher/src/main/spotify/config.ts** exports the full non-secret surface downstream plans need: SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES (D-30 trio), SPOTIFY_REDIRECT_PORTS (3 ports), SPOTIFY_REDIRECT_PATH, buildRedirectUri helper, SPOTIFY_AUTH_URL, SPOTIFY_TOKEN_URL, SPOTIFY_API_BASE. 11/11 assertions green.
- **12 Nyquist test-stub files** created with matching environment docblocks and `it.todo()` markers; full launcher suite: 365 passed + 12 todo + 0 failed.

## Task Commits

Each task was committed atomically with `--no-verify` (Wave 1 parallel-mode convention):

1. **Task 1: Install motion package and drop bundled font assets** — `d6e6000` (chore) — committed prior to resume
2. **Task 2: CHECKPOINT — Spotify dev app registration** — no code output; state-event only. Owner approved 2026-04-24 with Client ID `1829b668cd8d43b48b0b3787e7ee8d06` after registering THREE loopback ports (53682/53681/53683) in the dashboard. Plan originally expected single bare-loopback URI; owner discovered that shape is refused post-2025-11-27 and supplied corrected port list (see Deviations).
3. **Task 3: Create launcher/src/main/spotify/config.ts with verified constants** — `005055e` (feat)
4. **Task 4: Scaffold Nyquist test-stub files** — `4b9ecae` (test)

**Plan metadata (final docs commit):** _pending at time of summary draft; recorded below_

## Files Created/Modified

- `launcher/package.json` — `+"motion": "^12.38.0"` in dependencies
- `launcher/src/renderer/src/assets/fonts/inter/InterVariable.woff2` — Inter Variable font (latest rsms/inter 4.x web release)
- `launcher/src/renderer/src/assets/fonts/inter/LICENSE.txt` — Verbatim SIL OFL 1.1, "Copyright (c) 2016-2025 The Inter Project Authors"
- `launcher/src/renderer/src/assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2` — JetBrains Mono Variable font (latest JetBrains/JetBrainsMono 2.x)
- `launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt` — Verbatim SIL OFL 1.1, "Copyright 2020 The JetBrains Mono Project Authors"
- `launcher/src/main/spotify/config.ts` — Spotify non-secret PKCE config + port list + buildRedirectUri helper + D-31 correction header
- `launcher/src/main/spotify/config.test.ts` — 11 assertions covering client-ID regex, scopes, port list, URI builder, and regression guards against D-31 wildcard / bare loopback / localhost shapes
- `launcher/src/main/spotify/__fixtures__/README.md` — Placeholder for 04-05/04-06 mock fixtures
- 12 Nyquist test stubs — see `key-files.created` above for paths and target plans

## Decisions Made

- **Ship both fonts under SIL OFL 1.1, attribution-consistent.** JetBrains Mono's upstream license is OFL 1.1 (not Apache 2.0 as plan said). Owner confirmed at https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt. Shipping the real upstream license text is the only legally-correct option under OFL §2.
- **Export port list + helper, not single redirect URI.** Given Spotify's 2025-11-27 OAuth migration (verified via https://developer.spotify.com/documentation/web-api/concepts/redirect_uri and https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025), loopback URIs must include an explicit pre-registered port. Owner registered 3 ports (primary + 2 fallbacks) and config.ts now exports `SPOTIFY_REDIRECT_PORTS` + `buildRedirectUri(port)`. Plan 04-05 will try ports in order until one binds.
- **Keep `SPOTIFY_REDIRECT_PATH = '/callback'` export.** Still used by the future HTTP server to match the incoming request path independent of the port chosen.
- **Commit `SPOTIFY_CLIENT_ID` as plaintext literal in config.ts.** Matches D-18 non-secret pattern from Phase 2 (Azure AD client ID committed). PKCE public client has no secret; the ID is not confidential.
- **Use `--no-verify` on all Wave 1 commits.** Per parallel-mode convention in the resume instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan] JetBrains Mono upstream license is SIL OFL 1.1, not Apache 2.0**
- **Found during:** Task 1 (font bundling — done in prior executor session)
- **Issue:** Plan's action step 5 and acceptance criterion said to ship "verbatim Apache 2.0 text" for JetBrains Mono LICENSE.txt. Upstream source at https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt shows the project is actually licensed under SIL OFL 1.1 (the in-repo file named `OFL.txt` makes the license unambiguous). Plan's referenced `/blob/master/LICENSE` path does not exist — the repo only has `OFL.txt`.
- **Fix:** Shipped verbatim SIL OFL 1.1 text with "Copyright 2020 The JetBrains Mono Project Authors" header. This is redistribution-compliant under OFL §2 (embedded in software permitted so long as copyright + license text travel with the font).
- **Files modified:** `launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt`
- **Verification:** `head -10` of file shows "SIL Open Font License, Version 1.1" header; file begins with the actual JetBrains Mono copyright line.
- **Plan acceptance-criteria drift:** Plan's grep for "Apache License" against this file will NOT match. The OFL-correct file contains "SIL OPEN FONT LICENSE" instead. This is an intentional legal-correctness deviation — the plan's greppable check was written against a factually incorrect assumption.
- **Committed in:** `d6e6000` (Task 1 commit)

**2. [Rule 1 - Bug in plan] Spotify Redirect URI registration shape is stale**
- **Found during:** Task 2 checkpoint (owner's dashboard experience)
- **Issue:** Plan's action step and acceptance criterion said to register the single URI `http://127.0.0.1/callback` (no port) in the Spotify dashboard, claiming Spotify's loopback exemption would accept any runtime port. This was factually wrong as of 2026-04:
  - `http://localhost/...` is rejected outright
  - Bare `http://127.0.0.1/callback` with no port is flagged by the dashboard validator as "not secure" and refused
  - Redirect URIs MUST use an explicit port: `http://127.0.0.1:<PORT>/callback`
  - The URI sent to `/authorize` must EXACTLY match a registered URI — ports are part of the match.
- **Fix:** Owner registered THREE redirect URIs in the Spotify dashboard (primary + 2 fallbacks):
  - `http://127.0.0.1:53682/callback` (primary)
  - `http://127.0.0.1:53681/callback` (fallback 1)
  - `http://127.0.0.1:53683/callback` (fallback 2)
  Revised Task 3's config.ts to export `SPOTIFY_REDIRECT_PORTS: [53682, 53681, 53683] as const` + `buildRedirectUri(port: number): string` helper (instead of a single `SPOTIFY_REDIRECT_URI` constant). Kept `SPOTIFY_REDIRECT_PATH = '/callback'` for path-matching inside the HTTP server. Added file header documenting both the original CONTEXT D-31 wildcard bug AND this newer bare-loopback bug so future readers see the full correction chain.
- **Files modified:** `launcher/src/main/spotify/config.ts`, `launcher/src/main/spotify/config.test.ts`
- **Verification:** Sources cited:
  - https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
  - https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025
  config.test.ts adds 5 assertions that pin the revised API: port list shape, buildRedirectUri exact output, valid URL parse for every port, no-localhost guard, and path-level no-port/no-wildcard guard. All 11 tests green.
- **Downstream impact:** Plan 04-05 (main-process Spotify OAuth) will consume `SPOTIFY_REDIRECT_PORTS` and `buildRedirectUri` directly — it should NOT expect a single `SPOTIFY_REDIRECT_URI` export. Plan 04-05's planner will see this file header + SUMMARY deviation and adapt.
- **Committed in:** `005055e` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug in plan).
**Impact on plan:** Both deviations correct factually wrong plan assumptions (license text + OAuth redirect shape). Neither enlarges scope; both preserve the original plan's intent (ship fonts legally; give downstream plans a stable Spotify config surface). Plan 04-05 will need to read `SPOTIFY_REDIRECT_PORTS` instead of a single URI constant — one-line change for the planner agent.

## Issues Encountered

- None during resumed execution. Task 1's deviation was spotted during the prior executor's session. Task 2's deviation surfaced during the owner's dashboard interaction and resolved cleanly (owner registered 3 ports).

## User Setup Required

External Spotify developer account setup is complete for v0.1:

- Spotify dev app "Wiiwho Client" registered under owner's personal Spotify account
- Client ID: `1829b668cd8d43b48b0b3787e7ee8d06` (non-secret, public PKCE client — committed to repo)
- 3 redirect URIs registered: `http://127.0.0.1:{53682,53681,53683}/callback`
- Scopes (configured in dev app, not runtime): N/A — scopes are requested at runtime via /authorize

No environment variables required. No further dashboard config needed.

## Next Phase Readiness

All Phase 4 downstream plans unblocked:

- **Plan 04-01** (token catalog + motion + settings v2 migration) — motion dep available, 3 stub files ready (motion.test.ts, stores/settings.theme.test.ts, settings/__tests__/store-v2-migration.test.ts)
- **Plan 04-02** (sidebar + main area) — Sidebar.test.tsx stub ready
- **Plan 04-03** (Settings modal chrome) — SettingsModal.test.tsx stub ready
- **Plan 04-04** (Appearance pane) — ThemePicker.test.tsx stub ready
- **Plan 04-05** (main-process Spotify) — config.ts + 3 stub files ready (oauth/api/tokenStore). NOTE: consume `SPOTIFY_REDIRECT_PORTS` + `buildRedirectUri`, not a single URI.
- **Plan 04-06** (renderer Spotify UI) — stores/spotify.test.ts + SpotifyMiniPlayer.test.tsx stubs ready
- **Plan 04-07** (integration + docs) — antiBloat.test.tsx stub ready

No blockers. No pending todos.

## Self-Check: PASSED

Verified all artifacts on disk and commits in git log:

**Files (verified present + non-zero):**
- [x] `launcher/package.json` contains `"motion": "^12.38.0"`
- [x] `launcher/src/renderer/src/assets/fonts/inter/InterVariable.woff2` (352,240 bytes)
- [x] `launcher/src/renderer/src/assets/fonts/inter/LICENSE.txt` (4,380 bytes, SIL OFL 1.1)
- [x] `launcher/src/renderer/src/assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2` (113,700 bytes)
- [x] `launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt` (4,399 bytes, SIL OFL 1.1)
- [x] `launcher/src/main/spotify/config.ts` — 6 constants + buildRedirectUri + SPOTIFY_REDIRECT_PORTS exported
- [x] `launcher/src/main/spotify/config.test.ts` — 11 assertions all green
- [x] `launcher/src/main/spotify/__fixtures__/README.md`
- [x] All 12 Nyquist stub files present (4 main-process, 8 renderer-side)

**Commits (verified in git log):**
- [x] `d6e6000` — chore(04-00): add motion dep + bundle Inter/JetBrainsMono fonts
- [x] `005055e` — feat(04-00): add Spotify config module (PKCE public client, 3 loopback ports)
- [x] `4b9ecae` — test(04-00): scaffold Nyquist test stubs for Phase 4 waves

**Test suite:** Full launcher suite post-Task-4: **365 passed + 12 todo + 0 failed** (49 test files total, 12 todo-only).

---
*Phase: 04-launcher-ui-polish*
*Completed: 2026-04-24*
