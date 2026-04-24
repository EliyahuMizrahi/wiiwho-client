# Phase 4: Launcher UI Polish - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning (blocked on two REQUIREMENTS.md / ROADMAP.md edits — see Decisions > Requirement Edits)

<domain>
## Phase Boundary

Phase 4 transforms the **functional** Phase 3 launcher (login → Play-forward home → Settings drawer → crash viewer) into a **polished, themeable, animated** experience with a Spotify mini-player — while staying firmly anti-Lunar-bloat (no ads, no news, no concurrent-user counts, no friends list).

Phase 4 delivers, in the same single-window 1280x800 launcher:

1. **Sidebar-driven main surface.** A fixed 220px icon+label sidebar replaces Phase 1's Play-forward centered layout. Sidebar sections: **Play** (primary CTA, hero-art main area), **Cosmetics** (placeholder "Coming soon"), and a **Settings gear** anchored at the sidebar bottom. The Account affordance stays top-right (Phase 2 D-13) as a dropdown that also reaches into the Settings modal.
2. **Bottom-slide Settings modal.** Clicking the Settings gear opens a modal that slides up from the bottom of the viewport (~70% height), closes via slide-down + fade. The modal has its own **left sub-sidebar** with panes: General, Account, Appearance, Spotify, About. This replaces Phase 3 D-01's slide-in-from-right drawer (`SettingsDrawer.tsx` is deleted).
3. **Theme system.** 8 accent presets (cyan default = `#16e0ee` per Phase 1 D-09; green, purple, orange, pink, red, yellow, gray) + custom-hex input with eyedropper + live preview. Dark mode only — **UI-02 is dropped** (see Requirement Edits). Design tokens live in Tailwind v4 `@theme` CSS vars as single source; runtime accent swap mutates `--color-accent` on `:root`.
4. **Motion system.** Hybrid: CSS primitives (hover, focus, drawer slide) + framer-motion (Settings modal, section route swaps, Spotify album-art crossfade). Duration tokens: fast 120ms / med 200ms / slow 320ms. Easing tokens: emphasized + standard + spring. Respects OS `prefers-reduced-motion` with an in-app override toggle in Settings → Appearance.
5. **Spotify mini-player.** Compact ~64-80px block pinned at sidebar bottom (above the Settings gear). Shows album art + track title + artist + play/pause/prev/next. When disconnected: same slot shows a "Connect Spotify" CTA. OAuth via **PKCE + loopback redirect** on `127.0.0.1:<random port>`. Owner-registered Spotify dev app; client ID in source (non-secret per PKCE); access + refresh tokens encrypted in `safeStorage` at `%APPDATA%/Wiiwho/spotify.bin` (parallel to Phase 2's `auth.bin`).
6. **Design system doc.** `docs/DESIGN-SYSTEM.md` — rationale, usage examples, token catalog, motion catalog, no-ads/news/social exclusion checklist per UI-05. Figma MCP not installed on this machine; asset provenance section lives in the same doc and is populated as assets are produced.

Phase 4 does **NOT**:
- Touch the Forge mod or any `client-mod/` code (Phase 5).
- Integrate Spotify in-game (Forge mod territory — deferred to Phase 5 stretch per memory `project_phase_04_scope.md`).
- Modify the Phase 2 auth flow, the Phase 3 launch pipeline, or the crash-viewer redaction contract (D-20/D-21 stay exact).
- Add ads, news feeds, concurrent-user counts, friends list, or marketing content anywhere (UI-05 literal ban + exclusion checklist).
- Ship a real cosmetics catalogue (Phase 6 — Cosmetics v0.1 is a placeholder cape).
- Build a backend for Spotify OAuth proxying (no v0.1 backend per PROJECT.md).
- Produce the Play-section hero bitmap art at execute time — owner draws it; Phase 4 ships with a CSS-gradient stub that the asset drops into when it lands.

Requirements in scope: UI-01, UI-03, UI-04 (interpretation-flagged), UI-05, UI-06, UI-07.
Requirements edited out of scope: **UI-02 (dark/light mode toggle)** — owner wants dark-only.

**External gates:** None. Phase 4 is launcher-side only; no Microsoft/Mojang approval required. Spotify dev app registration is a small same-day task the owner does during Phase 4 Wave 0.

</domain>

<decisions>
## Implementation Decisions

### Requirement edits (BLOCKER — land before plan-phase runs)

- **E-01: Drop UI-02 from REQUIREMENTS.md.** Owner does not want a light mode. Remove `UI-02` row from §Launcher UI (Polish). Remove the `UI-02 | Phase 4 | Pending` row from the Traceability table. Update the Phase 4 line in Per-phase distribution from "7 requirements" to "6 requirements — UI-01, UI-03, UI-04, UI-05, UI-06, UI-07." Bump the last-updated footer and note the deviation.
- **E-02: Edit ROADMAP.md Phase 4 Success Criterion 1.** Current text: *"User picks an accent color from at least 3 presets or enters a custom hex; choice applies across the launcher (buttons, focus rings, highlights) and persists across restarts. Dark/light mode toggle also persists."* Remove the trailing `Dark/light mode toggle also persists.` sentence. Optionally bump the preset count in the first sentence from "at least 3" to "at least 8" to match D-08 (or leave "at least 3" since ≥8 satisfies it).
- **E-03: Flag UI-04 "Account" interpretation.** UI-04 lists `Account` as a minimum sidebar section. Phase 4 interprets this as: Account content lives inside the Settings modal's left sub-sidebar (alongside General, Appearance, Spotify, About) and is reachable from (a) the top-right AccountBadge dropdown's "Account settings" entry and (b) the Settings modal's Account tab. Account is **not** a top-level sidebar row. Planner / plan-checker should either accept this interpretation or push back for a second edit to UI-04 ("Account" → "Account surface reachable from sidebar-driven navigation"). Owner-flagged as the preferred reading.

### Sidebar nav + migration

- **D-01: Sidebar is fixed 220px, always expanded, icon + label per row.** No collapse state, no icon-only mode. Pinned to the left edge. Lunar/Badlion pattern. Main area = `width: 1280 - 220 = 1060px`.
- **D-02: Sidebar row order.** Top: **Play** (primary, default active), **Cosmetics**. Thin divider. Bottom (pinned): **Settings gear**. The **Spotify mini-player** slot sits between the main rows and the Settings gear (above the divider). No Account row (see E-03).
- **D-03: Active / hover visual state = accent-color pill + 2-3px left accent bar.** Active item: `bg-accent/10` pill + `border-l-2 border-accent` left bar, icon + label switch to `text-accent`. Hover: `bg-neutral-800/60` pill, no left bar. Respects the active preset (so purple theme has a purple pill/bar, etc.).
- **D-04: Play-section main area = owner-drawn hero image + centered Play button + version footer.** Hero image occupies the main area as a subtle background (not foreground art); Play button and "Wiiwho Client" wordmark sit centered on top; `v0.1.0-dev` in the bottom-right corner. Hero art source: **owner produces the asset**; Phase 4 ships with a CSS-gradient stub (linear gradient from `--color-accent` at 10% alpha to `--color-wiiwho-bg`) that the bitmap drops into when it lands. Provenance recorded in `docs/DESIGN-SYSTEM.md` § Hero Art.
- **D-05: Cosmetics-section main area = polished "Coming soon" empty state.** Contents: centered placeholder cape SVG (when owner has drawn it; fallback = stylized cape outline icon), headline "Cosmetics coming soon", 1-line subtext "Placeholder cape arriving in v0.2." No interactive elements, no toggle stub. Keeps expectations honest; UI-04 "placeholder allowed" literally satisfied.
- **D-06: Account badge stays top-right per Phase 2 D-13, with a new dropdown surface.** Dropdown menu items (in order): username (non-interactive display), UUID (first-8 + hover-full tooltip), separator, **Account settings** (opens Settings modal and deep-links to the Account tab), **Sign out** (existing Phase 2 behavior — clears refresh token, drops to login screen, no confirm dialog per Phase 2 D-15).
- **D-07: `SettingsDrawer.tsx` is deleted** in the Phase 4 migration. The existing Radix `Sheet` component stays in `components/ui/` (still useful for future flows) but the drawer component wrapping it is gone. The gear icon in App.tsx's top-right is removed (per D-06 — only AccountBadge remains top-right).

### Settings modal

- **D-08: Settings modal is a bottom-slide-up overlay.** Trigger: click the Settings gear at the sidebar bottom. Animation: slide up from the bottom edge + fade in. Close: slide down + fade out. Dismissal: X button + ESC + backdrop click (three gestures — consistent with Phase 3 D-02 Sheet contract). Click on any Play/Cosmetics sidebar row while modal is open closes the modal first (no multi-modal state).
- **D-09: Modal height = partial, ~70% of viewport (≈560px on 1280x800).** Leaves ~240px of dimmed main area visible above so the user sees they can dismiss by clicking the backdrop. Modal width = viewport-width minus sidebar = 1060px, centered in the main area (or optionally spans full viewport including over sidebar — planner picks based on Radix Dialog ergonomics; recommend over-main-area so sidebar stays clickable to dismiss).
- **D-10: Modal internal nav is a left sub-sidebar.** Sub-sidebar is ~180px wide, inside the modal's left edge. Panes (top-to-bottom, in order): **General** (RAM slider, game-directory override deferred per Phase 3 D-06, launch-log access, crash-reports access), **Account** (username, full UUID, skin-head preview, "Sign out" action), **Appearance** (accent picker + custom hex + "Reduce motion" toggle), **Spotify** (connect/disconnect + scopes displayed), **About** (version, license placeholder, build hash, anticheat-safety doc link). Right pane switches on sub-sidebar click. Active sub-nav item uses the same pill + left-bar pattern as the main sidebar (D-03) but scaled down.
- **D-11: The Settings modal can be deep-linked to a specific pane via IPC.** AccountBadge dropdown's "Account settings" opens the modal with `defaultPane = 'account'`. Planner exposes a `settings.openPane(pane: SettingsPane)` renderer API that sets Zustand state + triggers the modal open. No new IPC channel; purely renderer-side.

### Theme system (UI-01, UI-07)

- **D-12: Dark mode only. UI-02 is dropped** (see E-01 / E-02). No `prefers-color-scheme: light` branch in CSS. No theme toggle anywhere in the app.
- **D-13: 8 accent color presets. Cyan is the default (preserves Phase 1 D-09).**
  - Cyan `#16e0ee` (default)
  - Green `#22c55e` (candidate; planner may tune)
  - Purple `#a855f7`
  - Orange `#f97316`
  - Pink `#ec4899`
  - Red `#ef4444`
  - Yellow `#eab308`
  - Gray `#9ca3af` (greyscale / "no theme" option)
  Exact preset hexes are research/planner discretion; the 8-slot palette + the cyan-default is locked. Each preset has a display name (e.g., "Cyan", "Emerald", "Violet") shown in the picker.
- **D-14: Custom hex input UX = hex field + eyedropper + live preview.** Text field validates `#` + 6 hex chars; invalid input = field stays in "typing" state, UI doesn't swap. Valid hex = UI swaps accent live (all `var(--color-accent)` bound surfaces update). An eyedropper button opens the `EyeDropper API` (Chromium native in Electron 41) for picking colors from the screen. No separate color-wheel widget — eyedropper covers the advanced use case.
- **D-15: No contrast warning in v0.1.** If the user picks a low-contrast hex (e.g., pure black `#000000` in a dark-mode UI), they get ugly results but no warning. Revisit for v0.2 if anyone complains.
- **D-16: Accent applies to a targeted surface set only.** Primary CTA (Play button bg), focus-visible rings, active sidebar nav pill + left bar (D-03), active modal sub-nav item, progress bar fill, device-code countdown highlight. Accent does **not** apply to: headings, body text, links in settings copy, skin-head outline, tinted backgrounds (beyond the D-03 active-pill 10% alpha). Tight scope = theme feels considered, not overwhelming with vivid presets like red/yellow.
- **D-17: Token architecture = Tailwind v4 `@theme` CSS vars as single source.** All colors, spacing, typography, motion tokens live in `launcher/src/renderer/src/global.css` under `@theme { --color-accent: ...; --color-bg: ...; --duration-fast: 120ms; ... }`. Runtime accent swap = a small vanilla JS helper (`setAccent(hex: string)`) that sets `document.documentElement.style.setProperty('--color-accent', hex)`. Tailwind classes like `bg-accent`, `ring-accent`, `text-accent` reference the var and update live. No separate `tokens.ts` for JS-side consumption — framer-motion durations read `getComputedStyle(document.documentElement).getPropertyValue('--duration-med')` when needed (or duplicated as module constants if that's cleaner; planner picks).
- **D-18: Accent + preset selection persists in `settings.json`** (not in a separate file). Extends the Phase 3 schema: `{ version: 2, ramMb: number, firstRunSeen: boolean, theme: { accent: string, reduceMotion: 'system' | 'on' | 'off' } }`. Schema version bumps to 2; Phase 3's v1 → v2 migration = add defaults (`accent: '#16e0ee'`, `reduceMotion: 'system'`), preserve existing fields.
- **D-19: Typography is a research task.** Owner's preference: "whatever Lunar Client or Badlion Client uses." Researcher identifies Lunar's + Badlion's font choices (likely Gilroy / Graphik / similar); if the exact fonts are commercial-licensed and not distributable in our bundle, researcher picks a **free alternative with matching visual DNA** (e.g., Inter / Manrope / Satoshi for Gilroy-like geometric sans). The selected font family is self-hosted as variable font woff2 in `launcher/src/renderer/src/assets/fonts/`. Provenance (font name, license URL, SIL OFL / Apache 2 / MIT) is documented in `docs/DESIGN-SYSTEM.md` § Typography. Falls back to system sans if the font file fails to load.

### Motion system (UI-03)

- **D-20: Hybrid motion stack.** **CSS primitives** for: hover, focus ring, button press, sidebar nav active transitions, progress bar fill, simple fade-in/out (enter/exit via Tailwind v4's built-in transition utilities + `@starting-style`). **framer-motion** for: bottom-slide Settings modal (slide + fade orchestration), section route swap in the main area (Play ↔ Cosmetics crossfade + slight directional slide), Spotify album-art crossfade when track changes, device-code modal enter/exit.
- **D-21: Duration tokens (3).** `--duration-fast: 120ms` (button hover, focus ring transitions, small state flips), `--duration-med: 200ms` (drawer/modal fade, sidebar nav pill transitions, section swap), `--duration-slow: 320ms` (Settings modal slide-up, accent color smooth-swap — not a hard morph, just a short eased color transition).
- **D-22: Easing tokens (3).** `--ease-emphasized: cubic-bezier(0.2, 0, 0, 1)` (enter/exit, Material-ish fast-out ease-in-soft) — default for modal/drawer open/close. `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` (Material-standard) — default for swaps and stationary state changes. `--ease-spring` = framer-motion spring config `{ stiffness: 300, damping: 30, mass: 1 }` — for button-press feedback, toggle flips, any playful micro-interaction. Spring easing is only usable through framer-motion (CSS can't express springs yet).
- **D-23: Phase 4 motion scope.** Settings modal slide-up/down + fade, sidebar nav active-state transitions (pill + left bar glide between items using framer-motion `layoutId`), button hover states, section route fade (Play ↔ Cosmetics), progress bar determinate fill animation, device-code modal fade in/out. **Deferred to polish:** shared-element accent morph on theme change, page-transition choreography, skin-head idle animation, drag-to-reorder affordances.
- **D-24: Reduced motion = in-app toggle + respect OS default.** Settings modal → Appearance → "Reduce motion" setting with three states: `System` (default, mirrors `prefers-reduced-motion: reduce`), `On` (force-reduce), `Off` (force-animate-always). When resolved state is "reduced," all transitions collapse to 0ms (instant state swaps, no slides, no crossfades — just mount/unmount). Framer-motion config reads the resolved state from `useSettingsStore` and falls back to zero-duration transitions. A CSS media query `@media (prefers-reduced-motion: reduce)` zero-outs CSS-only transitions for the `system` default case.

### Spotify mini-player (UI-06)

- **D-25: Spotify mini-player is pinned at the sidebar bottom, above the Settings gear divider.** Compact ~72-80px tall block. Layout: album art (48px square, left), stacked text column (track title line-1, artist line-2 — both truncate with ellipsis; max width ~110px), play/pause + prev/next control cluster (three small icon buttons, right-aligned). Always visible while launcher is open (whether Play or Cosmetics section is active).
- **D-26: When Spotify is not connected, the same slot shows a compact "Connect Spotify" CTA.** Contents: small Spotify logo + "Connect Spotify" text-button. Click = starts OAuth flow. Keeps the integration discoverable from day one (vs. hiding behind Settings).
- **D-27: When Spotify is connected but nothing is playing (idle), slot shows a "Nothing playing" placeholder.** Album-art square stays but is a neutral placeholder; text reads "Nothing playing"; play button is disabled; prev/next buttons are hidden or disabled. Keeps layout stable (no vertical shift when playback resumes).
- **D-28: Mini-player controls = play/pause + skip next + skip previous + current track label.** No volume slider, no progress bar, no shuffle/repeat toggles. Compact slot can't host them; advanced controls live in Spotify's own app (which is a click away via `shell.openExternal('spotify://')` if we add an "Open Spotify" menu item).
- **D-29: OAuth = PKCE + loopback redirect on `127.0.0.1:<random port>`.** On "Connect Spotify" click, launcher spawns a one-shot HTTP server on a random free port (e.g., `get-port` package or native `net.createServer()`), opens the Spotify authorize URL in the system browser via `shell.openExternal`, catches the redirect, exchanges the code + verifier for an access + refresh token, tears down the server. Standard modern OAuth-for-desktop pattern. No `client_secret` (PKCE only uses `code_verifier`).
- **D-30: Spotify scopes (minimum for UI-06).** `user-read-currently-playing` (read the current track for display), `user-read-playback-state` (poll play/pause state), `user-modify-playback-state` (fire play/pause/next/prev commands). No playlist, library, or user-profile scopes — tight permission footprint.
- **D-31: Spotify dev app registered under owner's Spotify account.** App name: "Wiiwho Client". Redirect URI: `http://127.0.0.1:*` (loopback range, Spotify supports wildcard port for PKCE). Client ID is pasted into source (`launcher/src/main/spotify/config.ts` or similar) and treated as non-secret (PKCE public client). Registration is a Wave 0 task in the execute phase.
- **D-32: Spotify token storage = safeStorage-encrypted file parallel to Phase 2's `auth.bin`.** File at `%APPDATA%/Wiiwho/spotify.bin` (macOS: `~/Library/Application Support/Wiiwho/spotify.bin`). Encrypted JSON: `{ version: 1, accessToken: <enc>, refreshToken: <enc>, expiresAt: <iso>, scopes: [...], displayName: <cached> }`. Never stored in `settings.json`. Renderer never touches tokens; only the main process's Spotify service module does (same pattern as Phase 2 `auth.bin`).
- **D-33: Disconnect Spotify is reachable from two places.** (a) **Mini-player context menu** — right-click the mini-player (or click a small dropdown chevron on its right edge) reveals a menu with "Open Spotify app" + "Disconnect." (b) **Settings modal → Spotify pane** — shows connected-account display name + a "Disconnect" button. Both paths clear `spotify.bin` and drop the mini-player slot back to the "Connect Spotify" CTA.
- **D-34: Polling cadence for current-track updates.** Spotify doesn't offer a websocket for desktop clients; current-track polling is the pattern. Planner / researcher picks an interval — recommended: **5 seconds while launcher is focused, 15 seconds while backgrounded**. On 401 response, refresh the token once; on subsequent 401 after refresh, mark as disconnected and drop to "Connect Spotify" state. Rate-limit awareness: Spotify Web API allows ~180 req/min for most endpoints; 5s polling = 12 req/min. Ample headroom.
- **D-35: Offline / Spotify-service-down degradation = graceful.** If the Web API returns 5xx or network fails, mini-player shows the last-known track (no refresh) with a subtle "(offline)" label next to the track title. No error modal, no red banner. When connectivity returns, polling resumes and display updates. Matches UI-06 "degrades gracefully (no crash, no error modal spam)."

### Design system doc (UI-05, UI-07)

- **D-36: `docs/DESIGN-SYSTEM.md` is produced in Phase 4 execute.** Sections: (1) Intro + philosophy (dark, gamer, anti-bloat), (2) Token catalog (colors, accent presets with hex, spacing scale, typography scale, motion durations + easings), (3) Usage examples (code + screenshots of Play section, Settings modal, Spotify mini-player, theme picker), (4) Hero Art provenance, (5) Typography provenance (font name + license), (6) Iconography provenance (lucide-react already in use; license note), (7) **Exclusion checklist per UI-05** — explicit "WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content, "online friends" badges, server ads, changelog teasers, news cards, social counts, engagement metrics, purchase prompts, subscription prompts." Reviewer sign-off row per section.
- **D-37: Figma MCP is not installed on this machine.** Per memory `project_phase_04_scope.md`: if the owner wants Figma-sourced assets/tokens during execute, the MCP must be configured first. UI-07 says "if Figma MCP is configured, asset/icon provenance is documented in the same file" — so Figma's absence is acceptable; we skip the Figma-provenance section rather than configure the MCP mid-phase. If owner wants the MCP, researcher sets it up in Wave 0 before execute begins.

### Claude's Discretion

The following were either explicitly deferred, raised for research, or not discussed — researcher and planner have latitude:

- **Exact 8-preset hex values** — D-13 locks the 8-slot palette and cyan-default; researcher/planner tunes the other seven for harmonious dark-mode contrast.
- **Lunar Client / Badlion Client font identification** — D-19; researcher inspects public builds, identifies fonts, picks free alternative if needed.
- **Hero art delivery** — D-04 stub gradient is the fallback; owner delivers the bitmap on their own timeline.
- **Cosmetics "Coming soon" illustration** — D-05; until owner draws the cape, use a stylized SVG cape outline (lucide-react has no cape icon; custom SVG is fine) with a "preview asset" comment in the component.
- **Settings modal width vs. sidebar clickability** — D-09 recommends modal covers main-area only (1060px wide) so sidebar stays clickable to dismiss, but Radix Dialog defaults to full-viewport; planner picks based on framer-motion + Radix ergonomics.
- **Sidebar nav pill glide direction** — D-23 uses framer-motion `layoutId`; exact spring config + any directional bias is planner's call.
- **Section route swap direction** — D-23 says "fade + slight directional slide"; planner picks whether slide comes from below, right, or is pure fade.
- **Spotify polling cadence tuning** — D-34 recommends 5s focused / 15s backgrounded; planner picks the actual intervals and whether to switch on `document.visibilityState` vs. window-focus events.
- **Spotify `get-port` vs. native random-free-port** — D-29; planner picks based on dependency tax (adding `get-port` vs. ~10 lines of `net.createServer().listen(0)`).
- **Eyedropper fallback on unsupported platforms** — D-14; EyeDropper API support matrix in Chromium is Chrome 95+; Electron 41 ships Chromium 146 so it's supported. If detection fails, fall back to hex-input-only.
- **Custom-hex validation micro-UX** — D-14; exact "while typing" behavior (show invalid red border vs. silent) is planner's call.
- **framer-motion version pinning** — STACK.md doesn't cover motion libs; planner picks latest stable compatible with React 19.
- **DESIGN-SYSTEM.md screenshot sourcing** — D-36; planner captures screenshots from a dev-mode launcher once the UI is built.
- **AccountBadge dropdown menu ordering** — D-06 gives the content; exact visual order (separator positions, iconography) is planner's call within the Radix DropdownMenu component already in use.
- **Sidebar divider style between main rows and Spotify/Settings pinned cluster** — Phase 3 D-07 style conventions apply; thin `border-t border-neutral-800` line is the default.
- **Spotify mini-player context-menu trigger** — D-33; right-click vs. visible dropdown chevron is planner's call; both discoverable.
- **Framer-motion prefers-reduced-motion integration** — D-24; planner picks between `useReducedMotion()` hook + conditional duration or a global framer-motion config.
- **Radix Dialog vs. custom modal for the bottom-slide Settings** — D-08; Radix Dialog's `data-state` attributes + `@starting-style` CSS work, but the slide-from-bottom direction may need custom animations. Planner picks.
- **Accent persistence across dev-mode hot-reloads** — D-17/D-18; if HMR clobbers `:root` inline style, planner adds a tiny rehydration hook.
- **Spotify album-art caching** — D-28/D-34; Spotify's CDN URLs are stable-ish; planner picks whether to cache to disk or rely on HTTP cache.
- **Scope of "motion" for the Cosmetics empty state** — D-05; default = static; planner can add a subtle SVG hover tilt if desired.

### Folded Todos

None — no pending backlog todos matched Phase 4 scope at discuss-phase time (gsd-tools `todo match-phase 4` returned 0 matches).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context

- `.planning/PROJECT.md` — vision, locked stack (Electron 41 + React 19 + Tailwind v4 + Radix/shadcn + Zustand), constraints (Windows + macOS v0.1; no signing; no auto-update), non-goals (no ads/news/social, no MC asset redistribution), distribution model (personal + small-group)
- `.planning/REQUIREMENTS.md` §Launcher UI (Polish) — UI-01, UI-03, UI-04, UI-05, UI-06, UI-07 (post-E-01 edit removing UI-02; see Decisions > Requirement Edits)
- `.planning/REQUIREMENTS.md` §Out of Scope + §Anti-Features — enforces UI-05's exclusion checklist
- `.planning/ROADMAP.md` §Phase 4 — goal, 5 success criteria (post-E-02 edit removing the dark/light toggle reference)
- `.planning/ROADMAP.md` §Overview — Phase 4 context within the 8-phase plan; Phase 5's stretch note (in-game Spotify) is **not** Phase 4 scope per memory `project_phase_04_scope.md`

### Prior phase context (carry forward — do not re-decide unless E-03 is resolved differently)

- `.planning/phases/01-foundations/01-CONTEXT.md` — D-03 (binary names `Wiiwho.exe` / `Wiiwho.app`, "Wiiwho" capitalization), D-08/D-09 (dark + gamer vibe + cyan `#16e0ee` as default accent — **now default preset per Phase 4 D-13**), D-10 (fixed window size — now 1280x800 per recent commit, replacing original 1000x650), D-11 "Play-forward" (**superseded by Phase 4 D-01 sidebar nav**), D-12 (OS-native system sans — **superseded by Phase 4 D-19 bundled font research**), D-13 (reference set: Lunar, Badlion, Feather)
- `.planning/phases/02-microsoft-authentication/02-CONTEXT.md` — D-13 (AccountBadge top-right — **preserved verbatim in Phase 4 D-06**), D-15 (no logout confirm dialog — preserved), D-16 (multi-account storage schema — unchanged), D-17 (nothing auth-related outside `auth.bin` — preserved; Spotify tokens live in a separate `spotify.bin` per D-32)
- `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md` — D-01 "Settings = slide-in right drawer" (**superseded by Phase 4 D-08 bottom-slide modal**), D-02 (three-gesture dismissal — preserved, extended to the new modal), D-03/D-04/D-05 (RAM slider UX — preserved in Settings modal's General pane), D-06 (game-directory override deferred — unchanged in v0.1), D-07 (logs + crashes reachable via Settings — preserved, now lives in General pane), D-08 (minimal Home chrome — **partly superseded by Phase 4 D-04 sidebar + hero-art section**; "no ads/news/social" spirit preserved), D-12 (launcher minimizes to taskbar on main-menu reached — unchanged), D-17..D-21 (crash viewer + redaction — unchanged; Phase 4 does not touch this pipeline), D-25 (JRE bundled via extraResources — unchanged)

### Research (existing — `.planning/research/`)

- `.planning/research/STACK.md` §Core Technologies — Launcher — Electron 41 + Vite + React 19 + Tailwind v4 + shadcn, confirmed compatible with motion additions
- `.planning/research/STACK.md` §Supporting Libraries — Launcher — Zustand 5.x (extends with theme + Spotify stores), electron-log 5.x (used for Spotify errors), Radix unified (Dialog, DropdownMenu, Tooltip, Slider, Popover — all already installed for Phase 3; add as needed)
- `.planning/research/ARCHITECTURE.md` — single-window, multi-state renderer; new sidebar + sub-sidebar structure fits within the same `src/main` / `src/preload` / `src/renderer` split with no process-boundary changes
- `.planning/research/PITFALLS.md` — no Phase 4 specific pitfalls documented yet; researcher may add Spotify-specific ones (rate limits, token refresh, PKCE details) during phase research

### External specs + docs (researcher + planner read directly)

**Theme / design tokens:**
- Tailwind CSS v4 `@theme` docs — https://tailwindcss.com/docs/v4-beta (current as of 2026; confirm syntax at research time)
- CSS `@starting-style` rule — https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style (enter animations without JS)
- EyeDropper API — https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API (Chromium 95+; Electron 41 ships Chromium 146 = supported)
- WCAG 2.1 SC 2.3.3 Animation from Interactions — https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions (informs D-24 reduced-motion)
- `prefers-reduced-motion` — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

**Motion:**
- Framer Motion (motion.dev) — https://motion.dev/docs (React 19 compatibility, `useReducedMotion`, `layoutId` for sidebar nav pill glide, spring configs)
- Material Design motion curves reference — https://m3.material.io/styles/motion/easing-and-duration (source for D-22 emphasized / standard easings)

**Spotify OAuth + Web API:**
- Spotify Authorization Code with PKCE Flow — https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow (D-29 canonical reference)
- Spotify Web API scopes — https://developer.spotify.com/documentation/web-api/concepts/scopes (D-30 scope picks)
- Spotify Web API Player endpoints — https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track (D-28 current-track fetch)
- Spotify Web API Player control — https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback, /pause-a-users-playback, /skip-users-playback-to-next-track, /skip-users-playback-to-previous-track (D-28 control endpoints)
- Spotify rate limits — https://developer.spotify.com/documentation/web-api/concepts/rate-limits (D-34 polling cadence justification)
- Spotify desktop URL scheme (`spotify://`) — https://developer.spotify.com/documentation/web-api/concepts/redirect_uri (also used for "Open Spotify app" context-menu item per D-33)
- Loopback redirect URI with wildcard port (Spotify) — documented in their PKCE tutorial; `http://127.0.0.1:*` is accepted by their authorization server

**Electron / Platform:**
- Electron `shell.openExternal` — https://www.electronjs.org/docs/latest/api/shell (open Spotify auth URL in system browser)
- Electron `safeStorage` — https://www.electronjs.org/docs/latest/api/safe-storage (already used for Phase 2 auth.bin; Phase 4 reuses pattern for spotify.bin)
- Electron `setAsDefaultProtocolClient` — https://www.electronjs.org/docs/latest/api/app (would be needed if we ever switched from loopback to custom protocol; NOT used in Phase 4)
- Node.js `net.createServer` — for D-29 random-free-port loopback server

**References for hero art + fonts (researcher):**
- Lunar Client downloads page — https://www.lunarclient.com (inspect downloaded installer for font/art provenance — do NOT redistribute; just identify)
- Badlion Client downloads — https://client.badlion.net (same — identify, don't redistribute)
- Feather Client — https://feathermc.com (same)
- Google Fonts + SIL OFL alternatives — https://fonts.google.com (candidates: Inter, Manrope, Satoshi, Rubik, Be Vietnam Pro for Gilroy-like substitutes)

### Existing launcher code (Phase 1-3 scaffolding)

- `launcher/src/renderer/src/App.tsx` — **heavy rewrite target**. Current state-driven tree (loading → login → home/crashed) stays; home branch gets split into sidebar + main-area layout. Gear icon removed (D-07).
- `launcher/src/renderer/src/global.css` — **heavy extension target**. Current `@theme { --color-wiiwho-accent, --color-wiiwho-bg }` expands to the full token catalog per D-17 (8 accent presets, motion durations, easings, typography scale).
- `launcher/src/renderer/src/components/SettingsDrawer.tsx` — **deleted** in Phase 4 (replaced by new `SettingsModal.tsx`).
- `launcher/src/renderer/src/components/PlayButton.tsx` — reusable; moves from centered-home position into the sidebar's Play-section main area. Internal morphing logic (downloading/verifying/starting/playing phases) preserved.
- `launcher/src/renderer/src/components/AccountBadge.tsx` — **extend** to include the new dropdown menu items per D-06 ("Account settings" deep-link to Settings modal, "Sign out" existing).
- `launcher/src/renderer/src/components/RamSlider.tsx` — reusable; moves into the Settings modal's General pane.
- `launcher/src/renderer/src/components/CrashViewer.tsx` — unchanged; still a full-page takeover per Phase 3 D-18.
- `launcher/src/renderer/src/components/DeviceCodeModal.tsx` — unchanged; motion tokens apply uniformly (D-20 fade in/out).
- `launcher/src/renderer/src/components/LoginScreen.tsx` / `LoadingScreen.tsx` / `ErrorBanner.tsx` — unchanged; motion tokens apply.
- `launcher/src/renderer/src/components/ui/*` — shadcn primitives already installed: `button.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `sheet.tsx`, `slider.tsx`, `tooltip.tsx`. Phase 4 may add: `popover.tsx`, `context-menu.tsx`, `tabs.tsx` (for Settings modal sub-nav — optional, sub-sidebar can be hand-rolled).
- `launcher/src/renderer/src/stores/settings.ts` — **extend** for `theme` + `reduceMotion` state (D-18 schema v2 migration).
- `launcher/src/renderer/src/stores/auth.ts`, `stores/game.ts` — unchanged.
- `launcher/src/renderer/src/stores/spotify.ts` — **new Zustand store** for Spotify connection state, current track, polling lifecycle.
- `launcher/src/main/spotify/` — **new directory**: `config.ts` (client ID constant), `oauth.ts` (PKCE + loopback server), `api.ts` (fetch current track + control endpoints), `spotifyManager.ts` (orchestrator, parallel to `auth/AuthManager.ts`).
- `launcher/src/main/ipc/spotify.ts` — **new IPC module**; channels fit under a new top-level `wiiwho.spotify.*` preload key OR — to honor Phase 1 D-11's "5 frozen top-level keys" — extend under an existing key (likely `settings.spotify.*` or a dedicated 6th key with explicit note in CONTEXT.md). Planner picks; **recommend adding a 6th top-level `spotify` key with a deliberate deviation note** since nested under `settings` is semantically wrong.
- `launcher/src/preload/index.ts` — **extend** to expose the Spotify IPC surface (see note above re: frozen-keys deviation).
- `launcher/src/renderer/src/wiiwho.d.ts` — extend `WiiWhoAPI` with `spotify: { connect, disconnect, status, onTrackChange }` or equivalent per planner's IPC-surface choice.
- `launcher/package.json` — **add**: `framer-motion` (latest), possibly `get-port` (or use native `net.createServer({port:0})`). shadcn components to add as needed (`popover`, `context-menu`, `tabs`).
- `docs/DESIGN-SYSTEM.md` — **new file** per D-36 / UI-07.

### Anticheat (carry from Phase 1, even for an out-of-game phase)

- `docs/ANTICHEAT-SAFETY.md` — Phase 4 adds **zero** in-game code; confirm at merge that nothing in Phase 4 touches the mod jar classpath or in-game features. (Spotify runs entirely in the Electron main process; no Forge hook; no possibility of anticheat flag.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **Tailwind v4 `@theme` in `global.css`** — already in use for `--color-wiiwho-accent` and `--color-wiiwho-bg`. Phase 4 extends the same block with the full token catalog. No new files needed for token authoring.
- **Radix primitives (unified) + shadcn/ui** — all Phase 4 modal/dropdown/tab/tooltip needs are covered by already-installed primitives (Dialog, DropdownMenu, Sheet, Slider, Tooltip); missing ones (Popover, ContextMenu, Tabs) drop in via shadcn's unified radix-ui package without new top-level installs.
- **Zustand discriminated-union pattern** — Phase 2's `useAuthStore` and Phase 3's `useGameStore` / `useSettingsStore` establish the state-machine idiom; Phase 4's `useSpotifyStore` inherits (`{ state: 'disconnected' | 'connecting' | 'connected' | 'error', currentTrack?, accessTokenExpiresAt? }`).
- **`useAuthStore.initialize()` + `initializeSettings()`** pattern in `App.tsx` — Phase 4 adds `initializeSpotify()` alongside; follows the same on-mount subscription + teardown lifecycle.
- **safeStorage + atomic-write** (`launcher/src/main/auth/safeStorageCache.ts` from Phase 2) — exact pattern reused for `spotify.bin`. Planner either extracts a shared helper or mirrors the code.
- **electron-log + D-20 redaction** (`launcher/src/main/auth/redact.ts`) — extended with Spotify access/refresh token patterns so no token ever surfaces in logs.
- **cyan accent usage scattered as `bg-[#16e0ee]`** — Phase 4 migration task: replace arbitrary hex values across components with `var(--color-accent)` token references so runtime accent swap works uniformly. This is meaningful editing work across ~10-15 components.
- **Radix-in-jsdom test pattern** (pointer-capture stubs, `userEvent.setup()`, `afterEach(cleanup)`) — Phase 2 + 3 locked this; Phase 4 tests follow.
- **vi.hoisted() mock-bag pattern** — Phase 3 locked this for TypeScript vitest tests; Phase 4 inherits.
- **window size 1280x800 fixed** — recent commit `76a812f` enlarged from 1000x650. Main-area dimensions are `1060 x 800` (minus sidebar); Settings modal is `1060 x 560` centered over the main area.

### Established patterns

- **Frozen IPC surface at 5 top-level keys** (auth, game, settings, logs, __debug) — Phase 4 likely needs a 6th (`spotify`) or must nest awkwardly under an existing key. **Deliberate deviation flag for the planner.** Recommend adding `spotify` as a 6th top-level key with explicit CONTEXT/commit-message note.
- **Main process is the ONLY cleartext-token surface** — Phase 2 + 3 locked this; Phase 4 Spotify follows the same rule (renderer never sees access or refresh tokens in cleartext; only non-secret display fields like track title + album art URL cross the IPC boundary).
- **Security invariant** (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) — Phase 4 must not regress.
- **Co-located `.test.ts`** — every new module gets a sibling test file.
- **Schema-versioned persistence** (Phase 3 settings + Phase 2 auth.bin) — Phase 4 bumps `settings.json` to v2 (per D-18) with additive migration.
- **No new top-level npm deps without plan justification** — Phase 4 adds framer-motion deliberately + possibly get-port; both justified in D-20 / D-29.

### Integration points

- **`launcher/src/renderer/src/App.tsx`** — split the `state === 'logged-in'` branch into: (1) sidebar component on the left, (2) main-area router keyed by active sidebar section, (3) Settings modal overlay (rendered unconditionally, driven by `useSettingsStore.modalOpen`), (4) Spotify mini-player inside the sidebar (rendered in the sidebar component).
- **`launcher/src/renderer/src/components/Sidebar.tsx`** — **new**. Renders the nav list, active-pill animation (framer-motion `layoutId`), Spotify mini-player slot, and Settings gear trigger.
- **`launcher/src/renderer/src/components/SettingsModal.tsx`** — **new**. Radix Dialog + framer-motion for bottom-slide. Left sub-sidebar + right pane. Deep-linkable via `useSettingsStore.setOpenPane(pane)`.
- **`launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx`** — **new**. Compact layout with album art + track label + controls. Handles disconnected / connecting / connected / idle / offline states.
- **`launcher/src/renderer/src/components/ThemePicker.tsx`** — **new**. Lives in the Settings modal's Appearance pane. 8 preset swatches + hex input + eyedropper.
- **`launcher/src/renderer/src/components/MainArea/Play.tsx` + `Cosmetics.tsx`** — **new**. Keyed by sidebar's active section. Play hosts the hero art + centered PlayButton + version text. Cosmetics hosts the "Coming soon" empty state.
- **`launcher/src/renderer/src/stores/settings.ts`** — extend schema per D-18 (`theme: { accent, reduceMotion }`), add `modalOpen` + `openPane` slice, add `setAccent(hex)` action that writes `:root` var AND persists to `settings.json`.
- **`launcher/src/renderer/src/stores/spotify.ts`** — **new**. Connection state, current track, polling interval lifecycle (pause polling on window blur per D-34).
- **`launcher/src/main/spotify/` (new directory)** — OAuth orchestrator, API client, safeStorage-backed token store. Parallels `launcher/src/main/auth/` in structure.
- **`launcher/src/main/ipc/spotify.ts` (new file)** — IPC handlers (`spotify:connect`, `spotify:disconnect`, `spotify:status`, `spotify:control:play-pause`, `spotify:control:next`, `spotify:control:prev`) + push event (`spotify:track-changed`).
- **`launcher/src/preload/index.ts`** — add the `spotify` key (deliberate 6th top-level key; note in the commit) with the IPC shape.
- **`launcher/src/renderer/src/wiiwho.d.ts`** — extend `WiiWhoAPI` with the `spotify` typed surface.
- **`launcher/src/main/auth/redact.ts`** — extend patterns to scrub Spotify access + refresh tokens from any log output.
- **`launcher/src/main/paths.ts`** — add `getSpotifyTokenPath()` per D-32 pattern (mirrors the existing auth.bin path resolver).
- **`launcher/electron-builder.yml`** — no changes needed for Phase 4 (no new extraResources unless we decide to bundle a font woff2 file per D-19 — bundled fonts land in the renderer build output and are included automatically).
- **`docs/DESIGN-SYSTEM.md`** — new file; built in Phase 4 execute per D-36.

</code_context>

<specifics>
## Specific Ideas

- **Lunar-exact Settings modal pattern.** Owner explicitly referenced Lunar Client: sidebar has a gear, clicking the gear opens a modal that slides up from the bottom, closes by sliding down + fading out. Left sub-sidebar inside the modal for sections. Full Settings UI is the modal — the main area does not change sections when Settings opens.
- **Account badge stays top-right** with a richer dropdown — the dropdown links into the Settings modal's Account pane. No top-level Account sidebar row.
- **8-preset accent palette** with cyan as default preserves Phase 1 D-09's identity while breaking the "cyan-locked" constraint per UI-01.
- **Custom hex input paired with the native `EyeDropper` API** (Electron 41 = Chromium 146 = supported) for advanced color picking — no color-wheel widget needed.
- **Dark mode only.** Owner does not want a light mode; UI-02 is dropped with explicit REQUIREMENTS + ROADMAP edits.
- **Hybrid CSS + framer-motion** motion stack — CSS for primitives, framer-motion for orchestrated flows (Settings modal, route swaps, mini-player album-art crossfade).
- **Motion tokens: 3 durations (fast/med/slow = 120/200/320ms), 3 easings (emphasized/standard/spring).** Specific enough to enforce consistency, few enough to remember.
- **Reduced motion has an in-app override** on top of the OS `prefers-reduced-motion` setting — respects accessibility and power users.
- **Spotify mini-player pinned at the sidebar bottom** above the Settings gear. Always visible when launcher is open, regardless of active section.
- **Spotify controls = the bare minimum** per UI-06: play/pause + prev + next + track label. No volume/progress/shuffle — the Spotify desktop app is one click away if the user wants more.
- **PKCE + loopback redirect** for Spotify OAuth — standard modern desktop pattern, no custom protocol handler headaches.
- **Spotify tokens in a separate `spotify.bin`** — mirrors Phase 2's `auth.bin` pattern. Never mixed with MS tokens. Parallel redaction patterns added.
- **Anti-bloat exclusion checklist** is a first-class deliverable in `docs/DESIGN-SYSTEM.md` (D-36) — UI-05 is enforced by a written doc, not just by not-building.
- **Hero Play-section art is owner-drawn**, with a CSS gradient stub so Phase 4 is never blocked on asset delivery.
- **Figma MCP stays unconfigured** per memory — UI-07's Figma branch is skipped (acceptable per its wording).

</specifics>

<deferred>
## Deferred Ideas

Ideas raised in discussion or logical spillovers — captured so nothing is lost.

### Deferred to v0.2+

- **Light mode** (UI-02 dropped from v0.1 per E-01; owner rejected). Revisit if users ask; would need off-white/pure-white variant + card-or-flat choice.
- **Contrast warning on custom hex input** — D-15 defers; add in v0.2 if users produce illegible theme combinations.
- **Account as a top-level sidebar row** — rejected in favor of dropdown + Settings modal pane (D-06, E-03). Revisit if the Settings modal feels overloaded.
- **Sidebar collapsible rail (64 ↔ 220px)** — rejected for fixed 220px in v0.1 (D-01). Revisit if window-size constraints change or if Spotify mini-player needs more room.
- **Icon-only sidebar** — rejected same reason as above.
- **Account-section standalone surface in the main area** — not a sidebar row and not given its own view outside the Settings modal. Revisit if account tooling grows (e.g., skin preview, link-game-account features) in v0.3.
- **Spotify volume / progress / shuffle / repeat controls** — out of v0.1's compact slot (D-28). The full player is the desktop app.
- **Spotify seek / scrubbing** — same.
- **Spotify playlist / library integration** — rejected (would need extra scopes + larger UI).
- **Spotify Web Playback SDK (browser-side playback)** — explicitly NOT used; WiiWho controls the user's existing Spotify session on another device (phone/desktop), never hosts playback itself. Revisit if we ever want embedded playback.
- **Spotify open-at-startup / miniplayer-while-window-minimized** — out of v0.1.
- **Spotify offline-fallback richer state** (last-played history, queue preview) — D-35 keeps offline minimal; revisit if users ask.
- **Apple Music / YouTube Music / SoundCloud integrations** — not scoped; UI-06 names Spotify explicitly.
- **Figma MCP integration** for design tokens / asset provenance — skipped in v0.1 (memory note). Revisit if owner installs Figma MCP before execute.
- **Hero art v1 bitmap** — deferred to a separate asset task; Phase 4 ships with gradient stub. Revisit when owner produces the asset.
- **Placeholder cape SVG** — Phase 6 (Cosmetics Pipeline) owns the real cape; Phase 4 just shows a "Coming soon" state (D-05).
- **In-game Spotify HUD** — Phase 5 stretch per memory `project_phase_04_scope.md`; not Phase 4.
- **Shared-element accent-morph animation on theme change** — D-23 defers; ships with a simple color transition via CSS instead.
- **Page-transition choreography beyond fade + slight directional slide** — D-23 defers.
- **Skin-head idle animation** (breathing effect) — D-23 defers.
- **Drag-to-reorder sidebar sections** — not in scope; sidebar order is fixed (Play > Cosmetics > Settings bottom).
- **Accessibility: in-app font-size override** — not scoped for v0.1. User scales the OS.
- **Accessibility: high-contrast theme preset** — not scoped; dark-mode accent presets cover most needs.
- **Keyboard shortcut system** (sidebar nav, modal open) — not scoped.
- **Electron menu bar / macOS app menu customization** — not scoped for Phase 4 (Phase 8 release hardening may touch).
- **Multi-window support** (Settings pop-out, Spotify mini-window) — not scoped.
- **Spotify rate-limit aware exponential backoff** on 429 — D-34 acknowledges rate limits; proper exponential backoff is planner discretion but detailed tuning deferred to v0.2 if we hit the limit.

### Out-of-scope reminders (non-negotiable for v0.1)

- **Ads, news feeds, concurrent-user counts, friends lists, marketing content** — UI-05 literal ban; exclusion checklist in `docs/DESIGN-SYSTEM.md` (D-36). Zero tolerance.
- **Auto-updater (`electron-updater`)** — explicitly out of v0.1.
- **Signed Windows installer + macOS notarization** — explicitly out of v0.1.
- **Crash uploader / telemetry** — explicitly out of v0.1; crash reports stay local (Phase 3 contract).
- **Spotify tokens in `settings.json` or anywhere outside `spotify.bin`** — out of scope; D-32 enforces separation.
- **MSAL-Browser for Spotify** — irrelevant (Spotify has its own OAuth; MSAL is MS-only).
- **Cracked-account support** — project-wide non-goal.
- **Redistribution of Minecraft assets** — project-wide non-goal; Phase 4 only touches launcher UI.
- **Redistribution of Lunar / Badlion / Feather assets (fonts, art)** — research identifies what they use; we DO NOT copy their assets. We either license what we need or pick free alternatives (D-19).
- **Linux packaging** — explicitly out of v0.1.

### Reviewed Todos (not folded)

None — gsd-tools `todo match-phase 4` returned 0 matches at discuss-phase time.

### Scope-creep redirects

None — discussion stayed within Phase 4's UI-polish boundary. The in-game Spotify HUD was mentioned in passing (memory-recorded as Phase 5 stretch) and was explicitly NOT pulled into Phase 4.

</deferred>

---

*Phase: 04-launcher-ui-polish*
*Context gathered: 2026-04-23*
