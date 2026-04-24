---
phase: 04-launcher-ui-polish
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - launcher/package.json
  - launcher/src/renderer/src/assets/fonts/inter/InterVariable.woff2
  - launcher/src/renderer/src/assets/fonts/inter/LICENSE.txt
  - launcher/src/renderer/src/assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2
  - launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt
  - launcher/src/main/spotify/config.ts
  - launcher/src/main/spotify/config.test.ts
  - launcher/src/main/spotify/__fixtures__/README.md
  - launcher/src/renderer/src/test/antiBloat.test.tsx
  - launcher/src/renderer/src/test/motion.test.ts
  - launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts
  - launcher/src/renderer/src/stores/__tests__/spotify.test.ts
  - launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx
  - launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx
  - launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx
  - launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx
  - launcher/src/main/spotify/__tests__/oauth.test.ts
  - launcher/src/main/spotify/__tests__/api.test.ts
  - launcher/src/main/spotify/__tests__/tokenStore.test.ts
  - launcher/src/main/settings/__tests__/store-v2-migration.test.ts
autonomous: false
requirements:
  - UI-01
  - UI-03
  - UI-04
  - UI-05
  - UI-06
  - UI-07
user_setup:
  - service: spotify
    why: "UI-06 Spotify OAuth integration requires an owner-registered Spotify dev app; client ID is non-secret (PKCE public client), but registration is dashboard-only."
    env_vars: []
    dashboard_config:
      - task: "Create Spotify dev app named 'Wiiwho Client' under the owner's Spotify account"
        location: "https://developer.spotify.com/dashboard → Create app"
      - task: "Add Redirect URI: http://127.0.0.1/callback  (NO port, NO wildcard — CORRECTED from CONTEXT D-31 per RESEARCH §Spotify OAuth)"
        location: "Dev dashboard → App settings → Redirect URIs"
      - task: "Copy client ID and paste into launcher/src/main/spotify/config.ts SPOTIFY_CLIENT_ID constant"
        location: "Dev dashboard → App settings → Basic Information"
must_haves:
  truths:
    - "motion@^12.38.0 is installed as a dependency in launcher/package.json"
    - "Inter Variable woff2 + LICENSE.txt and JetBrains Mono Variable woff2 + LICENSE.txt are present under launcher/src/renderer/src/assets/fonts/"
    - "launcher/src/main/spotify/config.ts exists and exports SPOTIFY_CLIENT_ID (non-empty) + SPOTIFY_SCOPES + SPOTIFY_REDIRECT_PATH"
    - "All Wave 0 test-stub files listed in files_modified exist with at least one passing or skip-pending test each (Nyquist scaffolding)"
    - "Spotify dev app exists under owner account with redirect URI http://127.0.0.1/callback (no port)"
  artifacts:
    - path: "launcher/package.json"
      provides: "motion@^12.38.0 dependency"
      contains: "\"motion\":"
    - path: "launcher/src/renderer/src/assets/fonts/inter/InterVariable.woff2"
      provides: "Bundled Inter variable font (SIL OFL 1.1)"
    - path: "launcher/src/renderer/src/assets/fonts/inter/LICENSE.txt"
      provides: "Verbatim Inter SIL OFL 1.1 text"
    - path: "launcher/src/renderer/src/assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2"
      provides: "Bundled JetBrains Mono variable font (Apache 2.0)"
    - path: "launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt"
      provides: "Verbatim JetBrains Mono Apache 2.0 text"
    - path: "launcher/src/main/spotify/config.ts"
      provides: "Spotify non-secret config (client ID + scopes + redirect path)"
      exports: ["SPOTIFY_CLIENT_ID", "SPOTIFY_SCOPES", "SPOTIFY_REDIRECT_PATH", "SPOTIFY_AUTH_URL", "SPOTIFY_TOKEN_URL", "SPOTIFY_API_BASE"]
  key_links:
    - from: "launcher/src/main/spotify/config.ts"
      to: "Spotify dev dashboard registration"
      via: "SPOTIFY_CLIENT_ID constant"
      pattern: "SPOTIFY_CLIENT_ID\\s*="
---

<objective>
Wave 0 infrastructure. Install the motion package, drop self-hosted variable fonts (Inter + JetBrains Mono), register the Spotify dev app (CHECKPOINT — owner does this in the Spotify dashboard), create the `launcher/src/main/spotify/config.ts` constant module, and create all Nyquist test-stub files required by subsequent waves.

This plan does NOT write production logic. It writes the minimum scaffolding so every other Phase 4 plan can run its `<automated>` verify against a file that already exists.

Purpose: Eliminate "MISSING — Wave 0 must create {test_file} first" Nyquist gaps across all downstream plans in one serial hit.

Output: Populated package.json (+1 dep), fonts + licenses on disk, Spotify config constants, 11 test-stub files that run (some with `.skip` / `.todo` entries until the real code lands), Spotify dev app registered with the CORRECT redirect URI `http://127.0.0.1/callback` (NO port, NO wildcard — corrects CONTEXT D-31).
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@.planning/phases/04-launcher-ui-polish/04-VALIDATION.md
@.planning/research/STACK.md
@launcher/package.json
@launcher/src/main/auth/safeStorageCache.ts
@launcher/src/main/auth/redact.ts
@launcher/src/main/paths.ts
@./CLAUDE.md
</context>

<interfaces>
<!-- Pattern to mirror from Phase 2 safeStorageCache -->

From launcher/src/main/auth/safeStorageCache.ts (verified at Phase 2 merge):
```typescript
export type CacheEntry = Record<string, unknown>
export interface PrismarineCache { /* ... */ }
export type CacheDirFn = (ctx: { username: string; cacheName: string }) => PrismarineCache
export function resolveAuthDir(): string
export function safeStorageCacheFactory(baseDir: string): CacheDirFn
```

From launcher/src/main/paths.ts:
```typescript
export function resolveDataRoot(): string
export function resolveSettingsFile(): string
```
(Phase 4 Plan 04-01 adds `resolveSpotifyTokenPath` following the same convention.)

From launcher/src/renderer/src/wiiwho.d.ts (Phase 3 state):
```typescript
export interface WiiWhoAPI { auth, game, settings, logs, __debug }  // 5 keys — Plan 04-06 adds `spotify` as a DELIBERATE 6th key
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Install motion package and drop bundled font assets</name>
  <files>launcher/package.json, launcher/src/renderer/src/assets/fonts/inter/InterVariable.woff2, launcher/src/renderer/src/assets/fonts/inter/LICENSE.txt, launcher/src/renderer/src/assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2, launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt</files>
  <read_first>
    - launcher/package.json (to see existing dependency layout and pnpm-filter scripts)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Typography (bundling strategy verbatim)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack → Package pin (exact semver)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §Deferred Ideas → "No unjustified new deps" posture
  </read_first>
  <action>
    1. Run `cd launcher && pnpm add motion@^12.38.0` from repo root (or `pnpm --filter ./launcher add motion@^12.38.0`).
       Verify `"motion": "^12.38.0"` appears in `launcher/package.json` → `dependencies`.
       Do NOT install `framer-motion` — library was renamed. Do NOT install both.
       Do NOT install `get-port` — RESEARCH §get-port vs native recommends native `net.createServer({port:0})`.

    2. Create directory `launcher/src/renderer/src/assets/fonts/inter/`. Download Inter Variable woff2 from https://github.com/rsms/inter/releases (latest 4.x release, the `InterVariable.woff2` file from the `Inter-4.x-web` zip asset). Save as `InterVariable.woff2`.

    3. Create `launcher/src/renderer/src/assets/fonts/inter/LICENSE.txt` with the verbatim SIL OFL 1.1 text from https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt (include copyright line "Copyright (c) 2016-2025 The Inter Project Authors (https://github.com/rsms/inter)").

    4. Create directory `launcher/src/renderer/src/assets/fonts/jetbrains-mono/`. Download JetBrains Mono Variable woff2 from https://github.com/JetBrains/JetBrainsMono/releases (latest 2.x, the `JetBrainsMono-Variable.woff2` file from `JetBrainsMono-X.X.X.zip → fonts/variable`). Save as `JetBrainsMono-Variable.woff2`.

    5. Create `launcher/src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt` with the verbatim Apache 2.0 text from https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt (note: JBMono file is named OFL.txt in-repo but license is Apache 2.0 per https://github.com/JetBrains/JetBrainsMono/blob/master/LICENSE — include Apache 2.0 text for accuracy).

    6. Verify all four asset files exist and have reasonable sizes (Inter woff2 ~340KB, JBMono woff2 ~120KB). Do NOT commit anything larger than 500KB as a woff2.

    7. Do NOT yet wire @font-face in global.css (Plan 04-01 does that).
  </action>
  <verify>
    <automated>cd launcher && node -e "const p=require('./package.json'); if (!p.dependencies?.motion) process.exit(1); const v=p.dependencies.motion; if (!/^\\^12\\./.test(v)) process.exit(2); const fs=require('fs'); for (const f of ['src/renderer/src/assets/fonts/inter/InterVariable.woff2','src/renderer/src/assets/fonts/inter/LICENSE.txt','src/renderer/src/assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2','src/renderer/src/assets/fonts/jetbrains-mono/LICENSE.txt']) { if (!fs.existsSync(f)) { console.error('missing',f); process.exit(3); } } console.log('OK');"</automated>
  </verify>
  <acceptance_criteria>
    - `grep '"motion"' launcher/package.json` returns a line matching `"motion": "^12.38.0"` (or a newer 12.x).
    - `grep '"framer-motion"' launcher/package.json` returns 0 hits (must not be installed).
    - `grep '"get-port"' launcher/package.json` returns 0 hits.
    - All four asset files exist under `launcher/src/renderer/src/assets/fonts/` with non-zero size.
    - Inter LICENSE.txt contains the literal string `SIL OPEN FONT LICENSE`.
    - JetBrains Mono LICENSE.txt contains the literal string `Apache License`.
  </acceptance_criteria>
  <done>motion dep installed; fonts + licenses on disk; verify command exits 0.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: CHECKPOINT — Owner registers Spotify dev app (required manual external setup)</name>
  <what-to-do>
    This is the only truly manual step in Phase 4. Spotify has no CLI / API to create a dev app — it is dashboard-only.
  </what-to-do>
  <how-to-verify>
    Owner performs:
    1. Visit https://developer.spotify.com/dashboard and sign in with the owner's Spotify account.
    2. Click "Create app". Fill:
       - App name: `Wiiwho Client`
       - App description: `Desktop launcher mini-player for Wiiwho Client (v0.1, personal use).`
       - Website: `https://github.com/EliyahuMizrahi/wiiwho-client`
       - Redirect URI: `http://127.0.0.1/callback` — **EXACT literal string, NO port number, NO wildcard, NO trailing slash.** This is a CORRECTION of CONTEXT D-31 (which said `http://127.0.0.1:*` — Spotify does NOT support wildcard redirect URIs per 2026-04 docs). Details in .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Redirect URI registration.
       - Which API/SDKs are you planning to use? → check "Web API" only.
    3. Accept the Spotify Developer Terms of Service.
    4. Click "Save". After creation, click "Settings" on the app page, copy the Client ID value.
    5. Paste the Client ID verbatim into `launcher/src/main/spotify/config.ts` → `SPOTIFY_CLIENT_ID` constant (Task 3 creates the file).
    6. Verify the dashboard → App settings → Redirect URIs list shows ONLY `http://127.0.0.1/callback` (no other URIs, no port variant, no wildcard).
  </how-to-verify>
  <resume-signal>Type `approved` + paste the copied Spotify Client ID (Claude writes it to config.ts in Task 3). Or type `blocked: <reason>` if the registration fails.</resume-signal>
  <files>N/A (human checkpoint)</files>
  <action>Human checkpoint — see &lt;what-to-do&gt;, &lt;how-to-verify&gt;, and &lt;resume-signal&gt; below. Claude pauses and waits for the owner's explicit resume-signal before proceeding.</action>
  <verify>
    <automated>echo "Manual checkpoint — awaiting owner resume-signal per block below."</automated>
  </verify>
  <done>Owner types the resume-signal per the block below (e.g., "approved").</done>
</task>

<task type="auto">
  <name>Task 3: Create launcher/src/main/spotify/config.ts with verified constants</name>
  <files>launcher/src/main/spotify/config.ts, launcher/src/main/spotify/config.test.ts, launcher/src/main/spotify/__fixtures__/README.md</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Spotify OAuth → §Canonical URLs
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Scopes (D-30 verified)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Redirect URI registration (the CONTEXT D-31 correction)
    - launcher/src/main/auth/AuthManager.ts (for the Phase 2 module-layout convention)
  </read_first>
  <action>
    Create `launcher/src/main/spotify/config.ts` with the EXACT contents below (substitute the client ID the owner provides in Task 2). File header must document the CONTEXT D-31 correction.

    ```ts
    /**
     * Spotify OAuth + Web API non-secret configuration.
     *
     * Client ID is PUBLIC — PKCE public-client flow has no client secret.
     * Paste the value from https://developer.spotify.com/dashboard (owner's account).
     *
     * IMPORTANT — CORRECTION of CONTEXT D-31:
     *   CONTEXT said: Redirect URI "http://127.0.0.1:*" (wildcard).
     *   CORRECT per current Spotify docs (2026-04 RESEARCH §Redirect URI registration):
     *     Dashboard registration MUST be "http://127.0.0.1/callback" (NO port, NO wildcard).
     *     Runtime authorize request passes "http://127.0.0.1:<runtime-port>/callback".
     *     Spotify accepts the runtime port because the loopback IP is registered
     *     (loopback IPs exempt from exact-match; ports are opaque).
     *
     * Sources: RESEARCH.md §Spotify OAuth, §Redirect URI registration, §Scopes
     */

    /** Non-secret PKCE public-client ID. Registered under owner's Spotify account. */
    export const SPOTIFY_CLIENT_ID = '<PASTE_FROM_OWNER_TASK_2>'

    /** OAuth scopes — D-30. Read-only + playback-control (Premium required for control). */
    export const SPOTIFY_SCOPES = [
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-modify-playback-state'
    ] as const

    /** Redirect path component. Port is injected at runtime (see oauth.ts). */
    export const SPOTIFY_REDIRECT_PATH = '/callback'

    /** Authorize endpoint (user-facing OAuth). */
    export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'

    /** Token-exchange + refresh endpoint (server-side POST). */
    export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

    /** Web API base (for /v1/me, /v1/me/player, etc.). */
    export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'
    ```

    Create `launcher/src/main/spotify/config.test.ts` that asserts:
    - `SPOTIFY_CLIENT_ID` is a non-empty string (at least 10 chars, base62 alphanumeric: matches `/^[A-Za-z0-9]{10,64}$/`).
    - `SPOTIFY_SCOPES` contains exactly the three scope strings from D-30.
    - `SPOTIFY_REDIRECT_PATH === '/callback'`.
    - `SPOTIFY_AUTH_URL === 'https://accounts.spotify.com/authorize'`.
    - `SPOTIFY_TOKEN_URL === 'https://accounts.spotify.com/api/token'`.
    - `SPOTIFY_API_BASE === 'https://api.spotify.com/v1'`.
    - Static regex guard: `SPOTIFY_REDIRECT_PATH` does NOT contain `:` (port) nor `*` (wildcard) — catches D-31 regression.

    Create `launcher/src/main/spotify/__fixtures__/README.md` with a single paragraph: "Test fixtures for Spotify OAuth and Web API mock responses. Populated in Plans 04-05 / 04-06."
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/main/spotify/config.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/main/spotify/config.ts` exports all 6 constants named above, with exact string values.
    - `grep "http://127.0.0.1/callback" launcher/src/main/spotify/config.ts` returns 0 hits (redirect URI is NOT hard-coded as a full URL — only the path).
    - `grep "http://127.0.0.1:\\*" launcher/src/main/spotify/` returns 0 hits (wildcard variant must never appear).
    - `SPOTIFY_CLIENT_ID` regex `/^[A-Za-z0-9]{10,64}$/` passes (no placeholder `<PASTE_...>` text remains).
    - `pnpm vitest run src/main/spotify/config.test.ts` exits 0 with all assertions green.
  </acceptance_criteria>
  <done>config.ts populated with real client ID; test green; D-31 correction documented in file header.</done>
</task>

<task type="auto">
  <name>Task 4: Scaffold Nyquist test-stub files (11 files with `.todo` entries)</name>
  <files>launcher/src/renderer/src/test/antiBloat.test.tsx, launcher/src/renderer/src/test/motion.test.ts, launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts, launcher/src/renderer/src/stores/__tests__/spotify.test.ts, launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx, launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx, launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx, launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx, launcher/src/main/spotify/__tests__/oauth.test.ts, launcher/src/main/spotify/__tests__/api.test.ts, launcher/src/main/spotify/__tests__/tokenStore.test.ts, launcher/src/main/settings/__tests__/store-v2-migration.test.ts</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-VALIDATION.md §Wave 0 Requirements (the full list and their target plans)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Validation Architecture → Test Framework (jsdom docblock, afterEach cleanup, pointer-capture stubs)
    - launcher/src/renderer/src/components/__tests__/AccountBadge.test.tsx (existing example of jsdom + userEvent pattern)
    - launcher/src/main/settings/__tests__/settings.test.ts (existing example of main-process Vitest pattern)
  </read_first>
  <action>
    For each of the 12 test files in `<files>`, create a file with:

    1. **Renderer-side tests (files matching `src/renderer/**` or `**/components/__tests__/**` or `**/stores/__tests__/**` or `**/test/*.test.tsx`)** — Start with:
    ```
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, afterEach } from 'vitest'
    import { cleanup } from '@testing-library/react'

    describe('<module name> — Wave 0 scaffold', () => {
      afterEach(cleanup)
      it.todo('Wave N plan will implement real tests here')
    })
    ```

    2. **Main-process tests (files matching `src/main/**`)** — Start with:
    ```
    import { describe, it } from 'vitest'

    describe('<module name> — Wave 0 scaffold', () => {
      it.todo('Wave N plan will implement real tests here')
    })
    ```

    3. For each file, replace `<module name>` with the target module (e.g., "ThemePicker", "Sidebar", "spotify oauth PKCE flow"). Replace `Wave N` with the actual plan that will fill it in:

    | File | Target plan |
    |------|-------------|
    | test/antiBloat.test.tsx | 04-07 (integration + docs) |
    | test/motion.test.ts | 04-01 (token catalog + motion tokens) |
    | stores/__tests__/settings.theme.test.ts | 04-01 (settings v2 migration + setAccent) |
    | stores/__tests__/spotify.test.ts | 04-06 (renderer spotify store) |
    | components/__tests__/ThemePicker.test.tsx | 04-04 (Settings modal Appearance pane) |
    | components/__tests__/Sidebar.test.tsx | 04-02 (sidebar + main area) |
    | components/__tests__/SettingsModal.test.tsx | 04-03 (Settings modal chrome) |
    | components/__tests__/SpotifyMiniPlayer.test.tsx | 04-06 (Spotify UI) |
    | main/spotify/__tests__/oauth.test.ts | 04-05 (main-process Spotify) |
    | main/spotify/__tests__/api.test.ts | 04-05 |
    | main/spotify/__tests__/tokenStore.test.ts | 04-05 |
    | main/settings/__tests__/store-v2-migration.test.ts | 04-01 |

    4. After writing all files, run `pnpm --filter ./launcher run test:run` — it MUST exit 0 (all `it.todo` entries are reported but do not fail the suite).
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/test/antiBloat.test.tsx src/renderer/src/test/motion.test.ts src/renderer/src/stores/__tests__/settings.theme.test.ts src/renderer/src/stores/__tests__/spotify.test.ts src/renderer/src/components/__tests__/ThemePicker.test.tsx src/renderer/src/components/__tests__/Sidebar.test.tsx src/renderer/src/components/__tests__/SettingsModal.test.tsx src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx src/main/spotify/__tests__/oauth.test.ts src/main/spotify/__tests__/api.test.ts src/main/spotify/__tests__/tokenStore.test.ts src/main/settings/__tests__/store-v2-migration.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - All 12 test-stub files exist.
    - Each contains at least one `it.todo(...)` entry.
    - Renderer-side files contain `@vitest-environment jsdom` docblock AND `afterEach(cleanup)`.
    - Running the verify command exits 0 with N `todo` reports.
    - Full suite still passes: `pnpm --filter ./launcher run test:run` exits 0.
  </acceptance_criteria>
  <done>12 test-stub files exist; full suite green (todos counted, not failed); downstream plans have targets for their `<automated>` verify commands.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm --filter ./launcher run test:run` exits 0.
- `grep '"motion"' launcher/package.json` returns exactly one line matching `^12\.`.
- All 4 font files exist; 2 LICENSE.txt files exist; config.ts exists with non-placeholder SPOTIFY_CLIENT_ID.
- `grep -r "127\\.0\\.0\\.1:\\*" launcher/src/` returns 0 hits (no wildcard redirect anywhere).
- 12 test-stub files each contain at least one `it.todo(...)` entry.
</verification>

<success_criteria>
motion installed; fonts + LICENSE.txt present; Spotify dev app registered with correct redirect URI (http://127.0.0.1/callback); config.ts has real client ID; 12 test-stub files exist; full suite green. All downstream Phase 4 plans can now run automated verifies without MISSING gaps.
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-00-infrastructure-SUMMARY.md` documenting:
- motion version installed
- font checksums (sha256 of each woff2)
- Spotify client ID (masked: first 4 + last 4 only)
- list of 12 test stubs created + their target plan
- note: CONTEXT D-31 corrected in config.ts header and dashboard registration
</output>
