# Phase 2: Microsoft Authentication - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers **the authenticated user** inside the launcher:

1. A logged-out user clicks "Log in with Microsoft," completes the device-code flow against live Microsoft endpoints, and lands back in the launcher with their Minecraft username + UUID displayed
2. The refresh token is encrypted via Electron `safeStorage` and persisted to `%APPDATA%/Wiiwho/auth.bin` (or macOS equivalent) — no token-looking strings anywhere else on disk
3. On every subsequent launcher open, a silent refresh reproduces the logged-in state without re-prompting (7-day refresh test passes)
4. The 5 critical XSTS error codes (2148916233, -5, -6, -7, -8) each surface a plain-English message — no raw codes shown to the user
5. "Log out" clears the token and returns to the login screen; re-login works

Phase 2 does NOT: download Minecraft (Phase 3), spawn the JVM (Phase 3), wire the RAM slider (Phase 3), load Forge (Phase 4), render cosmetics (Phase 5), or do any in-game work.

Requirements in scope: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06.

**External gate:** Microsoft MCE (Minecraft API permission) approval email for the registered Azure AD app (`60cbce02-072b-4963-833d-edb6f5badc2a`). Submitted 2026-04-20; expected 2026-04-21 → 2026-04-27. Without this, the final `/authentication/login_with_xbox` step returns an error and Phase 2 cannot execute end-to-end on real Microsoft accounts. Phase 2 planning can proceed in parallel with the MCE queue.

</domain>

<decisions>
## Implementation Decisions

### Login screen & session lifecycle

- **D-01: Login is a full-screen takeover when logged out.** The Phase 1 "Play-forward" layout only appears once the user is authenticated. Logged-out state = Wiiwho logo + "Log in with Microsoft" button + `v0.1.0-dev` text. No Play button is visible. Matches Lunar's first-run flow.
- **D-02: On launcher open, silently refresh if a token exists.** Main process calls `prismarine-auth.getMinecraftJavaToken()` before the renderer mounts its first screen. During the call, the renderer shows a brief loading state (Wiiwho logo + spinner). On success → Play-forward. On failure → login screen.
- **D-03: Silent refresh failure is quiet.** If the refresh fails for any reason (expired, revoked, network, MS 5xx), clear the stale token and fall through to the login screen with no error banner. We don't distinguish auth-error vs network-error on this path — just reset and let the user try again explicitly. (Errors during an explicit user-initiated login attempt DO surface — see D-08.)
- **D-04: Login screen content is minimal.** Only three elements: Wiiwho logo, "Log in with Microsoft" button, and a small `v0.1.0-dev` version string below. No tooltips, no anticheat badge, no legal text. Any legalese / settings / about lives in Phase 3's Settings screen.
- **D-05: Login button is cyan-accented, not MS-brand-compliant.** Same `#16e0ee` background + neutral-950 text as the Phase 1 Play button. Label: `Log in with Microsoft`. Keeps visual consistency with Wiiwho's identity over conforming to Microsoft's branding guidelines.

### Device-code flow UX

- **D-06: Device-code modal stays open on expiry, shows "Code expired — Generate new code" state.** When `prismarine-auth`'s polling detects the device code expired (~15 min default), the modal content replaces the code block with an inline message and a "Generate new code" button. User clicks → modal returns to "waiting for Microsoft" state with a freshly-issued code. Explicit, not auto-retry.
- **D-07: Device-code modal has an explicit Cancel button and honors ESC.** Clicking Cancel or pressing ESC stops polling, closes the modal, and returns to the login screen. No server-side cleanup needed — abandoned device codes expire naturally on Microsoft's side.

### Error surfacing

- **D-08: Auth errors from user-initiated login attempts surface as an inline banner on the login screen, under the login button.** Red/warning-colored, persistent (no auto-dismiss), dismissible via an ×, cleared on next login click. Preferred over modal (heavy) and toast (missable).
- **D-09: Error banner actions = primary "Try again" + secondary "Help" link.** "Try again" re-runs the device-code flow. "Help" opens a browser to an error-specific doc — see D-10 for mapping. No "Copy details" in v0.1 (we're small-group; owner debugs directly).
- **D-10: XSTS + related error → plain English + Help link mapping.** This set is load-bearing for AUTH-03 and Success Criterion 3:
  - `2148916233` (no Xbox Live profile on this MS account) → "This Microsoft account doesn't have an Xbox profile yet. Create one at xbox.com and try again." Help → `https://www.xbox.com/en-US/live`
  - `2148916235` (Xbox Live blocked in user's country) → "Xbox Live isn't available in your country, so your Microsoft account can't sign in to Minecraft." Help → `https://www.xbox.com/en-US/legal/country-availability`
  - `2148916236` / `2148916237` (adult verification required, notably KR) → "Your Xbox account needs age verification before it can use Minecraft." Help → `https://account.xbox.com/en-US/Profile?activetab=main:mainTab2`
  - `2148916238` (child account not in a Microsoft Family) → "This account is under 18 and needs to be added to a Microsoft Family group by an adult." Help → `https://account.microsoft.com/family/`
  - "Account has no Minecraft Java Edition" (distinct from XSTS — prismarine-auth returns this from the `/authentication/login_with_xbox` step when the entitlements check fails) → "This Microsoft account doesn't own Minecraft Java Edition." Help → `https://www.minecraft.net/en-us/store/minecraft-deluxe-collection-pc` (or equivalent purchase page — researcher picks best link)
  - Unrecognized XSTS code → generic "Microsoft sign-in failed (code <N>). Try again, or click Help for more info." Help → `https://support.xbox.com/`
- **D-11: The "MS account exists but doesn't own Minecraft" case reuses the inline-banner pattern.** Same visual treatment as XSTS errors; only the message + Help link differ. A dedicated full-screen "buy Minecraft" flow was considered and deferred — inline is consistent and lighter.
- **D-12: Network errors reuse the inline-banner pattern.** Message: "Can't reach Microsoft — check your internet connection." Retry button (manual). No auto-retry. **Token is NOT cleared on network error** — only auth-level failures clear the token.

### Logged-in state UI

- **D-13: Account badge lives top-right corner.** Circular skin-head + username, clickable to open a small dropdown menu with: username (full), UUID (first 8 chars, hover-for-full tooltip), and a "Log out" item. Matches Lunar / Badlion / Feather convention. Does not compete with the hero Play button.
- **D-14: Fetch skin head from a third-party avatar service.** Researcher evaluates candidates (minotar.net, crafatar.com, mc-heads.net, or Mojang's own session server) and picks based on reliability + caching story. Whichever is picked, the fetched head PNG is cached locally by UUID so it renders instantly on subsequent launches without waiting on the network. Accept the third-party fingerprint (the skin head does NOT leak any identifying info the server doesn't already have — the UUID is public).
- **D-15: Logout is instant from the avatar dropdown — no confirm dialog.** Clicking "Log out" clears the account's refresh token from safeStorage, resets renderer state, drops to login screen. Cheap to reverse (just log in again).

### Storage schema

- **D-16: Refresh-token blob is multi-account-ready from day one, even though v0.1 stores exactly one account.** File at `%APPDATA%/Wiiwho/auth.bin` (macOS: `~/Library/Application Support/Wiiwho/auth.bin`). Contents are a safeStorage-encrypted JSON document:
  ```json
  {
    "version": 1,
    "activeAccountId": "<mc-uuid>",
    "accounts": [
      {
        "id": "<mc-uuid>",
        "username": "<mc-username-cached>",
        "refreshTokenEnc": "<base64-of-safeStorage-encrypted-refresh-token>",
        "lastUsed": "<iso-8601>"
      }
    ]
  }
  ```
  v0.1 enforces `accounts.length === 1`. Migration story for v0.3 account switcher: none required — just relax the enforcement.
- **D-17: Nothing related to auth lives outside `auth.bin`.** No tokens in `settings.json`, no tokens in log files, no tokens in crash reports. The renderer's Zustand auth store holds only the post-login public fields (`loggedIn`, `username`, `uuid`) — never the refresh token. The main process is the only component that ever touches the token in cleartext, and only inside memory during the device-code and refresh flows.

### Claude's Discretion

The following were explicitly skipped or deferred during discussion — Claude / researcher / planner have latitude:

- **Device-code modal visual design.** Recommended shape: large centered user-code in monospace, a Copy-to-clipboard button, an "Open in browser" button that launches the `verification_uri` via Electron `shell.openExternal`, a countdown timer showing remaining time until expiry, and a Cancel button (per D-07). User skipped discussing this area; Claude picks specifics during UI design.
- **Avatar service endpoint.** Researcher picks between minotar.net / crafatar.com / mc-heads.net / Mojang session server. Decision criteria: uptime history, CORS behavior in Electron renderer, caching headers, historical outages.
- **Skin-head cache schema.** Where to store + invalidate. Suggested: `%APPDATA%/Wiiwho/skin-cache/<uuid>.png` + TTL (skins can change). Planner decides.
- **Silent-refresh spinner loading state.** Exact animation, duration of minimum visible time (avoid flash), fallback timeout before dropping to login screen.
- **Background token refresh cadence while Play-forward is showing.** Options: refresh proactively (e.g., every 30 min) so Play click never waits; refresh lazily on Play click; or only refresh on launcher open. Planner decides.
- **Main-process auth state machine internals.** Phase 2 freezes the IPC surface (inherited from Phase 1) — what happens inside `launcher/src/main/auth/` is implementation detail.
- **Whether to verify game ownership via `/minecraft/profile` (confirming the MC profile exists) or via entitlements.** prismarine-auth's default path is enough; researcher confirms.

### Folded Todos

None — no pending backlog todos matched Phase 2 scope at discuss-phase time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context

- `.planning/PROJECT.md` — vision, locked stack (MSAL Node + prismarine-auth), constraints, non-goals (no cracked accounts, MS auth only)
- `.planning/REQUIREMENTS.md` §Authentication — the 6 AUTH-* requirements in scope
- `.planning/ROADMAP.md` §Phase 2 — goal, success criteria, dependency on Phase 1 + MCE approval

### Prior phase context (carry forward)

- `.planning/phases/01-foundations/01-CONTEXT.md` §Azure AD App — D-14 through D-18 lock the tenant (`consumers`), client ID (`60cbce02-072b-4963-833d-edb6f5badc2a`), redirect URI (`https://login.microsoftonline.com/common/oauth2/nativeclient`), non-secret treatment of client ID, and the MCE submission fact
- `docs/azure-app-registration.md` — canonical record of the registered Azure app + status of the MCE approval queue. Phase 2 execution blocks on the approval email (check status here first)

### Research (from .planning/research/)

- `.planning/research/STACK.md` §Auth — pin on `@azure/msal-node` 4.x + `prismarine-auth` 3.1.1, electron-log 5.x, reasoning for MSAL Node over msal-browser (Electron incompatibility)
- `.planning/research/ARCHITECTURE.md` — main/renderer process split, where the auth state machine lives (main only), IPC boundary conventions
- `.planning/research/PITFALLS.md` — especially the auth pitfalls (device-code flow vs authorization-code flow confusion, MSAL Browser trap, token-in-plaintext JSON trap)

### Existing code (Phase 1 scaffold)

- `launcher/src/preload/index.ts` — **frozen** IPC surface for `wiiwho.auth.*`. Phase 2 may NOT add new top-level keys or new channels. Only the four existing channels are in play: `auth:status`, `auth:login`, `auth:logout`, `auth:device-code` (event). Per Phase 1 D-11.
- `launcher/src/renderer/src/wiiwho.d.ts` — single source of truth for the IPC types. Phase 2 implementations must match `WiiWhoAPI.auth` as-typed here (any type changes require renderer+preload+main coordination).
- `launcher/src/main/ipc/auth.ts` — current stub handlers. Phase 2 replaces handler bodies in place.
- `launcher/src/main/ipc/auth.test.ts` — existing vitest scaffold — follow the pattern.
- `launcher/src/main/ipc/security.ts` — runtime-audit pattern (`setAuditedPrefs` + `__security:audit`). Reusable template if any auth-state-inspection debug hook is needed (probably not for v0.1).
- `launcher/src/renderer/src/App.tsx` — currently renders Play button unconditionally. Phase 2 adds a route/conditional between `<LoginScreen />`, `<LoadingScreen />` (silent refresh state), and the existing Play-forward layout.
- `launcher/src/renderer/src/components/ui/button.tsx` — shadcn Button already installed; reuse for login button.
- `launcher/package.json` — `zustand` 5.x, `radix-ui` 1.4.3 (for Dialog/DropdownMenu shadcn components), `tailwindcss` 4.x already present.

### External specs

- prismarine-auth README + source — https://github.com/PrismarineJS/prismarine-auth — the library driving the full MS → XBL → XSTS → Minecraft chain, including `getMinecraftJavaToken()`, device-code event emission, and refresh-token persistence hooks
- prismarine-auth device-code example — `examples/device-code.js` in the repo — canonical usage pattern, including the code + URI event
- Microsoft Learn, Device Code Flow — https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code — canonical description of what Azure expects
- @azure/msal-node device-code docs — https://learn.microsoft.com/en-us/javascript/api/@azure/msal-node/publicclientapplication — used under the hood by prismarine-auth; relevant if we ever need to drop a layer
- wiki.vg, Microsoft Authentication Scheme — https://wiki.vg/Microsoft_Authentication_Scheme — the sequence of HTTP calls (MS → XBL → XSTS → Minecraft), XSTS error codes explained
- Minecraft Wiki, Microsoft authentication — https://minecraft.wiki/w/Microsoft_authentication — cross-reference
- Electron safeStorage API — https://www.electronjs.org/docs/latest/api/safe-storage — platform differences (Keychain on macOS, DPAPI on Windows, libsecret on Linux), `isEncryptionAvailable()` contract
- Electron shell.openExternal — https://www.electronjs.org/docs/latest/api/shell — for the "Open in browser" button on the device-code modal
- Electron security guidelines — https://www.electronjs.org/docs/latest/tutorial/security — carry-forward from Phase 1; Phase 2 must not regress the posture

### Third-party avatar service candidates (researcher picks one)

- minotar.net — e.g. `https://minotar.net/avatar/<uuid>/64.png`
- crafatar.com — e.g. `https://crafatar.com/avatars/<uuid>?size=64`
- mc-heads.net — e.g. `https://mc-heads.net/avatar/<uuid>/64`
- Mojang session server (source of truth, no head render) — `https://sessionserver.mojang.com/session/minecraft/profile/<uuid>`

### Anticheat (carry from Phase 1, even for an out-of-game phase)

- `docs/ANTICHEAT-SAFETY.md` — no Phase 2 rows expected (no in-game code), but confirm before merge that nothing in Phase 2 touches the game jar classpath

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **IPC plumbing** (`launcher/src/preload/index.ts`) — `contextBridge.exposeInMainWorld('wiiwho', { auth: {...} })`. Auth surface is named-channels-only with `auth:status`, `auth:login`, `auth:logout` as `ipcRenderer.invoke` channels and `auth:device-code` as a push channel via `ipcRenderer.on`. Phase 2 fills these; it does not expand them.
- **Stub handlers** (`launcher/src/main/ipc/auth.ts`) — `registerAuthHandlers()` already wired into `app.whenReady` in `launcher/src/main/index.ts`. Phase 2 replaces the three handler bodies and adds an emit path for `auth:device-code`.
- **shadcn Button** (`launcher/src/renderer/src/components/ui/button.tsx`) — use for login button, logout item, "Try again" / "Help" actions.
- **Tailwind + cyan accent** — Phase 1 App.tsx uses `bg-[#16e0ee]` / `hover:bg-[#14c9d6]` / `text-neutral-950` for the Play button. Login button inherits this.
- **Zustand 5.x installed** (`launcher/package.json`) — use for the renderer-side auth store; Phase 2 is the first consumer.
- **radix-ui (unified) + shadcn/ui** — Dialog and DropdownMenu components for the device-code modal + avatar dropdown will be added via shadcn CLI during planning/execute.
- **vitest** — existing `.test.ts` siblings in `launcher/src/main/ipc/` establish the pattern; Phase 2 auth handlers get matching tests.

### Established patterns

- **IPC boundary** — renderer → main via `invoke` for request/response; main → renderer via named event channels (`auth:device-code`, `game:status-changed`, etc.). Never expose `ipcRenderer` or `process` to the renderer.
- **Security invariant** — `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` are runtime-verified on every launch via `__security:audit`. Phase 2 must not regress these; prismarine-auth runs entirely in the main process.
- **Single source of truth for IPC types** — `launcher/src/renderer/src/wiiwho.d.ts` declares `WiiWhoAPI`; main + preload must match. Any type drift requires touching all three.
- **Test pattern** — `<module>.ts` + `<module>.test.ts` colocated; vitest. Phase 2 inherits.
- **No dev dependency on node-gyp / native modules** (Phase 1 banned `keytar` / native compile chains by absence — we use `safeStorage` only, which is built into Electron).

### Integration points

- **`launcher/src/main/ipc/auth.ts`** — replace 3 stub bodies; add one event emitter for `auth:device-code`. Export type-safe wrappers so the store + modal render cleanly from the renderer side.
- **`launcher/src/main/auth/` (new directory)** — wire prismarine-auth, the safeStorage blob I/O, and the XSTS error mapper here. Main-process only.
- **`launcher/src/renderer/src/stores/auth.ts` (new file)** — Zustand store: `{ state: 'loading' | 'logged-out' | 'logging-in' | 'logged-in' | 'error', username?, uuid?, deviceCode?, error? }`.
- **`launcher/src/renderer/src/components/` (new)** — `LoginScreen.tsx`, `DeviceCodeModal.tsx`, `ErrorBanner.tsx`, `AccountBadge.tsx`, `LoadingScreen.tsx`. Shadcn Dialog and DropdownMenu will be added.
- **`launcher/src/renderer/src/App.tsx`** — add a top-level switch on auth-store state to render Login/Loading/Play screens; overlay the DeviceCodeModal when `state === 'logging-in'`.
- **Settings persistence path** — `%APPDATA%/Wiiwho/auth.bin` (Windows) / `~/Library/Application Support/Wiiwho/auth.bin` (macOS). Path helper lives in main process; Phase 3's settings code follows the same directory convention.

</code_context>

<specifics>
## Specific Ideas

- **Cyan-branded login button** — owner explicitly rejected a Microsoft-compliant white button. Login button matches the Phase 1 Play button aesthetic.
- **Top-right avatar dropdown** (Lunar / Badlion pattern) — not a bottom strip, not a top banner. Circular skin head + click-to-dropdown.
- **Device-code modal stays open on expiry** with an inline "Code expired — Generate new code" state; NOT silent auto-retry. Owner wants the user to see that expiry happened once before the code refreshes.
- **Multi-account schema today** even with single-account constraint in v0.1. The `accounts` array shape is load-bearing for the v0.3 account switcher without a migration.
- **Skin head fetched from a 3rd party** is explicitly acceptable. The UUID is public, and the UX win of "your skin head in the corner" is worth the extra network call. Local cache mandatory.
- **No logout confirm dialog** — logging out is cheap to reverse; no need for an "Are you sure?"
- **Silent refresh failure = quiet drop to login** — no "your session expired" banner on launcher open. That banner is only for explicit-attempt failures.
- **Help links target error-specific destinations** (xbox.com signup, MS Family, country availability doc, purchase page) — not a single generic "error help" URL.
- **`v0.1.0-dev` version text on login screen only** — keep the login screen's three-element composition (logo + button + version) tight.

</specifics>

<deferred>
## Deferred Ideas

Ideas that came up during discussion or are logical spillovers — captured so they're not lost.

### Deferred to v0.2+

- **Account switcher UI** (v0.3) — multi-account storage is in place but no UI to swap active account. Needs visual design + IPC expansion at that time.
- **Adding additional accounts without logging out of the active one** (v0.3) — UX for stacking accounts.
- **3D skin preview / full-body render in the account dropdown** (v0.2+) — just a head for v0.1.
- **Xbox gamertag display** separately from Minecraft username (v0.2+) — they're usually the same; only matters if they diverge.
- **"Copy error details" button on error banners** — small-group distribution means owner debugs directly; v0.1 doesn't need a crash-report pipeline. Revisit when there's a public release.
- **Persistent error log viewer** (would live alongside Phase 3 crash viewer) — deferred to Phase 3 / Phase 7.
- **Auto-retry on transient network failures** — considered; rejected for v0.1 (manual retry is fine for a foreground app). Revisit if user feedback says otherwise.
- **EULA / terms acknowledgement on login screen** — deferred to Phase 3 Settings screen.
- **"Why Microsoft?" explainer tooltip** — nice-to-have; not shipping in v0.1.
- **Anticheat-safe badge on login screen** — truthfulness burden as features evolve; revisit once HUDs ship in Phase 4.
- **Distinguishing auth-error vs network-error during silent-refresh-on-launch** — considered; rejected for v0.1 (quiet drop is simpler and correct for 90% of cases). Revisit if telemetry ever lands.
- **Background proactive token refresh cadence** — held under Claude's Discretion; planner picks an implementation.

### Out-of-scope reminders (non-negotiable)

- **Cracked-account support** — explicit project non-goal. Phase 2 only touches Microsoft OAuth.
- **Mojang Yggdrasil auth** — dead protocol, out of scope.
- **Authorization-code flow** — device-code flow only (D-16 from Phase 1). Do not be tempted to swap during planning just because MSAL Node supports both.
- **MSAL Browser** — explicitly banned by research (incompatible with Electron). Main-process MSAL Node only.

### Reviewed Todos (not folded)

None — no backlog todos existed at discuss-phase time.

### Scope-creep redirects

None — discussion stayed within Phase 2's auth-only boundary.

</deferred>

---

*Phase: 02-microsoft-authentication*
*Context gathered: 2026-04-21*
