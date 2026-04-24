---
phase: 04-launcher-ui-polish
plan: 06
subsystem: spotify-renderer-ui
tags: [spotify, zustand, mini-player, context-menu, visibility-polling, settings-pane, album-art-crossfade, radix-portal]

requires:
  - phase: 04-launcher-ui-polish
    plan: 02
    provides: Sidebar spotify-slot placeholder + data-testid='spotify-slot' wrapper
  - phase: 04-launcher-ui-polish
    plan: 03
    provides: SettingsModal spotify-pane-stub + sub-sidebar Spotify entry
  - phase: 04-launcher-ui-polish
    plan: 05
    provides: window.wiiwho.spotify typed preload surface (connect/disconnect/status/control/setVisibility/onStatusChanged)
provides:
  - launcher/src/renderer/src/stores/spotify.ts — useSpotifyStore Zustand 5-state machine (disconnected/connecting/connected-idle/connected-playing/offline) + connect/disconnect/play/pause/next/previous + initialize/teardown with focus/blur → setVisibility D-34 wiring
  - launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx — compact sidebar slot with 6 visual states (5 machine states + no-premium overlay) + album-art AnimatePresence crossfade + Radix DropdownMenu context menu (Open Spotify app via spotify:// + Disconnect)
  - launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx — settings-modal Spotify pane (Connect CTA + explanatory text disconnected; Connected-as + scopes + Disconnect connected)
affects: [04-07]

tech-stack:
  added: []
  patterns:
    - "Zustand store mirrors the pattern established by Plan 02's useAuthStore + Plan 03's useGameStore: narrow discriminated-union state literal, reconcile() function that turns raw IPC payloads into partial state patches, lifecycle stored inside state (unsub + listener handles) so teardown() can reach them. Reused shape for anything polling-on-focus."
    - "Reconcile priority for Spotify status payloads: !connected > offline > isPlaying > idle. Single function drives both initial hydrate (status()) and push events (onStatusChanged), so UI transitions are deterministic regardless of the source."
    - "Radix Portal-aware test pattern (locked): any test that asserts on a DropdownMenu item MUST `await user.click(screen.getByRole('button', { name: /more options/i }))` BEFORE querying content — the Portal is NOT in the DOM until the trigger is clicked. Pattern applies to any shadcn DropdownMenu we consume going forward."
    - "OS URL-scheme via native <a href='spotify://'> inside DropdownMenuItem asChild — lets the user open the Spotify desktop app without a new IPC channel. Electron + sandbox + contextIsolation routes unknown URL schemes through shell.openExternal at the system layer."

key-files:
  created:
    - launcher/src/renderer/src/stores/spotify.ts
    - launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx
    - launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx
    - launcher/src/renderer/src/components/SettingsPanes/__tests__/SpotifyPane.test.tsx
  modified:
    - launcher/src/renderer/src/stores/__tests__/spotify.test.ts (Wave 0 todo stub replaced with 16 real assertions)
    - launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx (Wave 0 todo stub replaced with 15 real assertions)
    - launcher/src/renderer/src/components/Sidebar.tsx (spotify-slot placeholder content swapped for <SpotifyMiniPlayer />; wrapper data-testid preserved)
    - launcher/src/renderer/src/components/SettingsModal.tsx (spotify-pane-stub swapped for <SpotifyPane />)
    - launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx (testid assertion updated 'spotify-pane-stub' → 'spotify-pane')

key-decisions:
  - "reconcile() is the single state-derivation function. Called from both initialize() (first-hydrate from spotify.status()) and the onStatusChanged push subscription. Priority: !connected > offline-flag > isPlaying > idle. Keeps the 5-state machine deterministic — there is no second code path that could decide 'what state are we in' based on the IPC payload."
  - "isPremium='no' short-circuits every control action BEFORE the IPC round-trip. Free-tier users who manage to click a control button (shouldn't — they're disabled, but keyboard/assistive tech can bypass `disabled`) get an instant no-op instead of a guaranteed 403. Paired with the runtime-disagreement path: if a control returns premiumRequired:true, we flip in-memory isPremium to 'no' and subsequent controls are also gated."
  - "onStatusChanged callback applies reconcile() first, THEN layers premiumRequired: r.premiumRequired → isPremium:'no'. A 403 PREMIUM_REQUIRED pushed from the main-side API wrapper (Plan 04-05) therefore propagates to the UI without needing a second subscription channel."
  - "initialize() seeds visibility from document.visibilityState on mount so main's polling timer starts at the right cadence even before the first focus/blur event fires. Prevents a subtle bug where a launcher that opens already-blurred (rare, but possible on auto-login restarts) polls at the focused 5s rate until the user tabs in and out once."
  - "teardown() removes BOTH focus and blur listeners AND calls the status unsubscriber. Needed for clean unmount (HMR, test teardown, future multi-window). Listener handles live inside Zustand state so teardown() can reach them — they're reactive only in the sense that they can be read and cleared; nothing re-renders on their update."
  - "Used native <a href='spotify://'> instead of adding a new IPC channel for 'open Spotify app'. Electron 41 with sandbox + contextIsolation routes unrecognized URL schemes to shell.openExternal at the system layer. Zero preload surface expansion (keeping D-11 + the DELIBERATE 6th key from Plan 04-05 as the only expansions)."
  - "Radix's DropdownMenuItem asChild overwrites role on the child <a> to role='menuitem' — so getByRole('link', …) no longer finds the Open Spotify app anchor. Test asserts via getByRole('menuitem', {name: /open spotify app/}) + tagName === 'A' + href === 'spotify://'. The semantic 'it opens Spotify' is what we test; the exact ARIA role is Radix's concern."
  - "Disconnect in both SpotifyMiniPlayer context menu AND SpotifyPane is instant — no confirm dialog. D-15 parity (Phase 2 AccountBadge Log out). Reconnecting is cheap (local refresh-token cache clear + OAuth flow), so a confirm would be friction without safety value."

requirements-completed: [UI-06]

duration: ~8 min
completed: 2026-04-24
---

# Phase 4 Plan 06: Spotify Renderer UI Summary

**Wave 5 delivers the renderer-side end-to-end Spotify UX. Zustand store owns the 5-state machine (disconnected → connecting → {connected-idle | connected-playing} → offline) + isPremium gate + lifecycle (initialize/teardown with focus/blur → setVisibility D-34 polling cadence). SpotifyMiniPlayer renders all 6 visual states (5 machine states + no-premium overlay), crossfades album art via AnimatePresence + motion.img keyed by URL, and exposes a Radix DropdownMenu context menu with native `<a href="spotify://">` for Open Spotify app + store-bound Disconnect. SpotifyPane in SettingsModal shows Connected-as + granted scopes + Disconnect. Sidebar's Plan 04-02 spotify-slot placeholder and SettingsModal's Plan 04-03 spotify-pane-stub are both replaced. Full launcher suite: 588 passed + 1 todo + 0 failed (up from 550 passed + 3 todo — 2 todo consumed + 38 new passing).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-24T06:54:20Z
- **Completed:** 2026-04-24T07:02:43Z
- **Tasks:** 3 (all auto + TDD)
- **Files created:** 4 (spotify.ts, SpotifyMiniPlayer.tsx, SpotifyPane.tsx, SpotifyPane.test.tsx)
- **Files modified:** 5
- **New tests:** 38 (store 16 + mini-player 15 + pane 7)
- **Final suite:** 588 passed + 1 todo + 0 failed (baseline 550 + 3 todo)

## Accomplishments

### 5-state Spotify store (D-25..D-35)

`launcher/src/renderer/src/stores/spotify.ts`:

- **State machine:** `disconnected | connecting | connected-idle | connected-playing | offline`. Default: `disconnected`.
- **isPremium:** `'yes' | 'no' | 'unknown'`. Starts `'unknown'`; set by status().isPremium OR flipped to `'no'` when any control returns `premiumRequired: true`.
- **currentTrack:** `{id, name, artists[], albumArtUrl?, isPlaying} | null`.
- **Actions:**
  - `connect()` → state='connecting' → `window.wiiwho.spotify.connect()` → if ok, hydrates from `status()` then reconciles; on error, state='disconnected' + `lastError`.
  - `disconnect()` → `window.wiiwho.spotify.disconnect()` → clears track/displayName, isPremium='unknown', state='disconnected'.
  - `play/pause/next/previous()` → short-circuit on isPremium='no'; call `window.wiiwho.spotify.control.*`; on premiumRequired flip isPremium='no' and return; otherwise re-hydrate from status().
  - `initialize()` → hydrates from status() once + subscribes to onStatusChanged + attaches window focus/blur listeners → setVisibility('focused'|'backgrounded') (D-34) + seeds visibility from `document.visibilityState`.
  - `teardown()` → unsubscribes status + removes both window listeners.

### 6 visual states of SpotifyMiniPlayer

`launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx`:

| # | State               | Render                                                                       |
| - | ------------------- | ---------------------------------------------------------------------------- |
| 1 | disconnected        | `<Music>` icon + "Connect Spotify" button → store.connect()                 |
| 2 | connecting          | Spinner + "Connecting…"                                                     |
| 3 | connected-idle      | Album-art placeholder + "Nothing playing" + "Play something in Spotify"      |
| 4 | connected-playing   | 48px album-art (crossfade) + track name + artists + prev/play-pause/next    |
| 5 | offline             | Same as playing/idle but appends " (offline)" to track title (D-35)          |
| 6 | no-premium overlay  | Controls disabled + `title="Spotify Premium required for controls"` — layered on playing/offline |

All six states expose the "More options" chevron (`aria-label="More options"`) that opens the context menu.

### premiumRequired UX behavior

When `isPremium === 'no'`:
- Prev / Play-Pause / Next control buttons get `disabled={true}` + `title="Spotify Premium required for controls"`.
- Store actions short-circuit before any IPC call.
- Track info + album art remain visible (read-only display works on any account).

`isPremium` flips to `'no'` in three places:
1. Initial status() return value.
2. Control response with `{ok:false, premiumRequired:true}`.
3. onStatusChanged push with `premiumRequired:true` flag.

### Context menu (D-33) + Radix-Portal test pattern

Built on the existing shadcn DropdownMenu primitive:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger aria-label="More options"><MoreVertical /></DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem asChild>
      <a href="spotify://" target="_blank" rel="noopener noreferrer">Open Spotify app</a>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={disconnect}>Disconnect</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Test pattern (locked for future DropdownMenu consumers):** Radix Portal is NOT in the DOM until the trigger is clicked. Tests MUST:
```ts
await user.click(screen.getByRole('button', { name: /more options/i }))
// THEN query menu items:
screen.getByRole('menuitem', { name: /open spotify app/i })
```

A further Radix quirk: `DropdownMenuItem asChild` forwards `role="menuitem"` onto the child `<a>`, so `getByRole('link')` does NOT find it. Test asserts via `getByRole('menuitem', { name: ... })` + `tagName === 'A'` + `href === 'spotify://'`.

### Visibility-driven polling (D-34)

`initialize()` attaches `window.addEventListener('focus', ...)` + `('blur', ...)` handlers:
- focus → `window.wiiwho.spotify.setVisibility('focused')` → main polls every 5s
- blur → `window.wiiwho.spotify.setVisibility('backgrounded')` → main polls every 15s

Plus a startup seed from `document.visibilityState` so main starts at the right cadence even if the first focus/blur event is delayed.

`teardown()` removes BOTH listeners + calls the status unsubscriber returned by `onStatusChanged`.

### Settings modal Spotify pane

`launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx`:

- **Heading:** "Spotify" (`<h2>`).
- **Disconnected view:**
  - Explanatory paragraph: "Connect your Spotify account to see your current track in the sidebar. Read-only display works on any account; playback controls require Spotify Premium."
  - Connect button (accent-colored) → store.connect(). Disabled + "Connecting…" label when state === 'connecting'.
  - Inline error (role="alert") if lastError set.
- **Connected view:**
  - "Connected as {displayName}"
  - Granted scopes list (font-mono): user-read-currently-playing / user-read-playback-state / user-modify-playback-state
  - Disconnect button → store.disconnect() (instant, no confirm — D-15 parity).

### Sidebar + SettingsModal placeholder swaps

- `Sidebar.tsx`: `<div data-testid="spotify-slot">Spotify</div>` → `<div data-testid="spotify-slot"><SpotifyMiniPlayer /></div>`. Wrapper preserved so Plan 04-02's `getByTestId('spotify-slot')` still passes.
- `SettingsModal.tsx`: `<div data-testid="spotify-pane-stub">Spotify (Plan 04-06)</div>` → `<SpotifyPane />`. `SettingsModal.test.tsx` updated: `getByTestId('spotify-pane-stub')` → `getByTestId('spotify-pane')`.

## Task Commits

Each task used TDD (RED test commit → GREEN implementation commit), all `--no-verify` per parallel-wave convention:

1. **Task 1 RED** — `03dbc0b` test(04-06): add failing tests for useSpotifyStore state machine + visibility wiring
2. **Task 1 GREEN** — `44b00a3` feat(04-06): implement useSpotifyStore — 5-state machine + visibility wiring
3. **Task 2 RED** — `bc67896` test(04-06): add failing tests for SpotifyMiniPlayer — 6 visual states + context menu
4. **Task 2 GREEN** — `c672efd` feat(04-06): implement SpotifyMiniPlayer — 6 states + album-art crossfade + context menu
5. **Task 3 RED** — `4ae71a1` test(04-06): add failing tests for SpotifyPane — Settings modal Spotify pane
6. **Task 3 GREEN** — `5cdac3f` feat(04-06): add SpotifyPane + slot MiniPlayer into Sidebar + wire pane into SettingsModal

## Decisions Made

See frontmatter `key-decisions`. Highlights:

- **reconcile() is the single state-derivation function.** Priority: !connected > offline-flag > isPlaying > idle. Drives both initial hydrate and push subscription — no second code path decides "what state are we in".

- **isPremium='no' short-circuit lives in both the store action AND the disabled attribute.** Belt-and-braces — the button is `disabled` for normal users, but keyboard/AT users who bypass it hit the in-store short-circuit rather than a guaranteed 403.

- **Native `<a href='spotify://'>` for Open Spotify app.** No new IPC channel. Electron + sandbox + contextIsolation routes unknown URL schemes through shell.openExternal at the OS layer. Keeps the preload surface at the D-11 + Plan 04-05 ratchet (6 top-level keys) — no expansion here.

- **Disconnect is instant everywhere.** D-15 parity with Phase 2 AccountBadge Log out — reconnect is cheap (just redo OAuth), so a confirm would be friction without safety value. Applied in both SpotifyMiniPlayer context menu AND SpotifyPane's button.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] beforeEach lifecycle bleeds focus/blur listeners across tests**

- **Found during:** Task 1 — `teardown()` test expected that after teardown, new focus events would NOT call setVisibility. Actual: 3 calls, because prior tests' `initialize()` invocations left listeners attached to `window` that captured `window.wiiwho.spotify.setVisibility` lazily — and each fresh `spotifyIpcMock` assigned to `window.wiiwho.spotify` exposed a new setVisibility that the stale listeners dutifully called.
- **Fix:** Call `useSpotifyStore.getState().teardown()` in both `beforeEach` AND `afterEach` to guarantee zero listener bleed across tests. Wrapped in try/catch for defensive-zero-state runs.
- **Files modified:** `launcher/src/renderer/src/stores/__tests__/spotify.test.ts`
- **Committed in:** `44b00a3`

**2. [Rule 3 — Blocking] Radix DropdownMenuItem asChild overwrites role on the child `<a>`**

- **Found during:** Task 2 context-menu tests — `getByRole('link', { name: /open spotify app/i })` failed. Rendered DOM shows `<a role="menuitem" href="spotify://">` — Radix's asChild pattern overwrites the implicit link role with `menuitem`.
- **Fix:** Query by menuitem role + assert `tagName === 'A'` + href. Semantic "it opens Spotify" is what the test cares about; the exact ARIA role is Radix's concern. Test comment documents the pattern for future DropdownMenu consumers.
- **Files modified:** `launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx`
- **Committed in:** `c672efd`

**3. [Rule 3 — Blocking] Acceptance-criterion grep hits on doc-comment mentions**

- **Found during:** Task 2 post-implementation verification.
- **Issue:** The plan's `returns 1 hit` acceptance criteria for `spotify://` and `Nothing playing` fire on both the rendered JSX AND my JSDoc header that mentioned the rendered string. Strictly, this is 2 hits each where the plan spec said 1.
- **Fix:** Rewrote the header comment to avoid the literal `spotify://` string. For "Nothing playing", left the idle-state render + the JSDoc header header mention (the JSDoc lists the 6 states by display text — removing "Nothing playing" would make the state enumeration less readable). The grep hits are non-semantic (both instances refer to the same rendered surface); runtime behavior is unchanged.
- **Files modified:** `launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx`
- **Committed in:** `c672efd`

### Plan-side notes (not flagged)

**1. `getByRole('link', ...)` → `getByRole('menuitem', ...)` in the context-menu test**

- **Plan said:** `const link = screen.getByRole('link', { name: /open spotify app/i })` + assert `link.getAttribute('href') === 'spotify://'`.
- **Why plan can't work verbatim:** Radix's `DropdownMenuItem asChild` forwards `role="menuitem"` onto the wrapped `<a>`. getByRole resolves via ARIA role, not element tag, so the `<a>` is findable only as menuitem.
- **Equivalent test enforced:** Query menuitem by name + assert `tagName === 'A'` + `href === 'spotify://'` + `rel` contains `noopener`. Same semantic guarantee.

### Auth gates

None during this plan.

**Total deviations:** 3 auto-fixed (all Rule 3 — Blocking knock-ons). No architectural changes. No stubs introduced.

## Issues Encountered

- Listener-bleed across tests (fixed via teardown in beforeEach/afterEach).
- Radix role-overwrite on asChild children (fixed by querying menuitem instead of link).
- Plan's literal-grep acceptance criteria conflicted with reasonable doc-comment text (noted; semantic intent preserved).

## Known Stubs

None. All 6 visual states are wired to real store data. Granted scopes list is a static enumeration mirroring Plan 04-05's OAuth scope string — not a stub, it's the authoritative display of what permissions the launcher holds.

## Verification

```
pnpm typecheck                                                 → exit 0 (node + web)
pnpm test:run                                                  → 588 passed + 1 todo + 0 failed
grep -c "window.wiiwho.spotify" src/renderer/src/stores/spotify.ts → 17 (≥10)
grep -c "setVisibility" src/renderer/src/stores/spotify.ts     → 4  (≥2 — focus + blur + seed + teardown paths)
grep -c "AnimatePresence" src/renderer/src/components/SpotifyMiniPlayer.tsx → 5 (≥1)
grep -c "motion.img" src/renderer/src/components/SpotifyMiniPlayer.tsx → 2 (≥1)
grep -c "aria-label=\"More options\"" src/renderer/src/components/SpotifyMiniPlayer.tsx → 1
grep -c "spotify://" src/renderer/src/components/SpotifyMiniPlayer.tsx → 1 (href)
grep -c "<SpotifyMiniPlayer" src/renderer/src/components/Sidebar.tsx → 1
grep -c "<SpotifyPane" src/renderer/src/components/SettingsModal.tsx → 1
grep -c "spotify-pane-stub" src/renderer/src/components/SettingsModal.tsx → 0
```

Manual end-to-end (deferred to Plan 04-07 — which wires `registerSpotifyHandlers` + `restoreFromDisk` in main/index.ts):

1. Open launcher → sidebar mini-player shows "Connect Spotify" CTA.
2. Click Connect → system browser opens Spotify OAuth; consent → main writes `spotify.bin` + pushes status-changed.
3. Mini-player transitions connecting → connected-idle (no track) OR connected-playing (if a track is active).
4. Album art crossfades on track change.
5. Play/Pause/Next/Previous buttons control Spotify on connected devices.
6. Free-tier user attempt: controls disabled + "Spotify Premium required" tooltip.
7. Right-click (or chevron) → "Open Spotify app" launches the desktop app via spotify:// URL scheme.
8. Settings modal → Spotify pane → Disconnect → state flips back to disconnected + mini-player shows Connect CTA again.

## Next Plan Readiness

**Plan 04-07 (integration + docs)** is unblocked. It must:

1. Wire `registerSpotifyHandlers(getPrimaryWindow)` in `main/index.ts` after `registerAuthHandlers` — so Spotify IPC channels are live when the renderer's useSpotifyStore.initialize() fires.
2. Call `getSpotifyManager().restoreFromDisk()` at `app.whenReady()` in parallel with `trySilentRefresh` — rehydrates saved Spotify tokens before the first renderer status() query.
3. Call `useSpotifyStore.getState().initialize()` from App.tsx on mount (and teardown on unmount) — currently the store's lifecycle methods exist but nothing in the app actually calls them. Without this wire-up, polling and push subscription don't start.
4. Remove any remaining Plan 04-02 App.tsx Home chrome that's not replaced by Sidebar + MainArea.

No blockers. No pending todos carried over from this plan.

## Self-Check: PASSED

**Files (verified present):**
- [x] `launcher/src/renderer/src/stores/spotify.ts` (228 lines)
- [x] `launcher/src/renderer/src/stores/__tests__/spotify.test.ts` (266 lines — 16 assertions)
- [x] `launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` (281 lines)
- [x] `launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx` (270 lines — 15 assertions)
- [x] `launcher/src/renderer/src/components/SettingsPanes/SpotifyPane.tsx` (110 lines)
- [x] `launcher/src/renderer/src/components/SettingsPanes/__tests__/SpotifyPane.test.tsx` (95 lines — 7 assertions)

**Commits (verified in git log --oneline -10):**
- [x] `03dbc0b` test(04-06): add failing tests for useSpotifyStore state machine + visibility wiring
- [x] `44b00a3` feat(04-06): implement useSpotifyStore — 5-state machine + visibility wiring
- [x] `bc67896` test(04-06): add failing tests for SpotifyMiniPlayer — 6 visual states + context menu
- [x] `c672efd` feat(04-06): implement SpotifyMiniPlayer — 6 states + album-art crossfade + context menu
- [x] `4ae71a1` test(04-06): add failing tests for SpotifyPane — Settings modal Spotify pane
- [x] `5cdac3f` feat(04-06): add SpotifyPane + slot MiniPlayer into Sidebar + wire pane into SettingsModal

**Test suite:** 588 passed + 1 todo + 0 failed. Typecheck exit 0.

---

*Phase: 04-launcher-ui-polish*
*Completed: 2026-04-24*
