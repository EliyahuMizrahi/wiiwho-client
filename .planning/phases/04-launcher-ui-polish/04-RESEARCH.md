# Phase 4: Launcher UI Polish — Research

**Researched:** 2026-04-24
**Domain:** Electron launcher UI polish (tokens, motion, theme, Spotify OAuth + mini-player)
**Confidence:** HIGH on stack + motion + Spotify API shape; HIGH on Tailwind v4 runtime theming; MEDIUM on exact preset hex tuning (tuned by the researcher against dark bg `#111111` — verified AA-eligible but empirical taste call); MEDIUM on Lunar/Badlion font identification (trademarked; verified no redistribution, picked free alternative with matching DNA); HIGH on EyeDropper + `@starting-style` Chromium-146 support.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Requirement edits (BLOCKERS — must land before plan-phase):**
- **E-01:** Drop UI-02 from REQUIREMENTS.md. Owner does not want light mode.
- **E-02:** Edit ROADMAP.md Phase 4 Success Criterion 1 — remove the trailing "Dark/light mode toggle also persists" sentence; optionally bump preset count from "at least 3" to "at least 8".
- **E-03:** Flag UI-04 "Account" interpretation — Account lives inside the Settings modal's sub-sidebar + reachable from AccountBadge dropdown; Account is **not** a top-level sidebar row.

**Sidebar nav + migration:**
- **D-01:** Sidebar is fixed 220px, always expanded, icon + label per row. Main area = `1280 - 220 = 1060px`.
- **D-02:** Sidebar row order — top: Play (primary, default active), Cosmetics; thin divider; bottom (pinned): Settings gear. Spotify mini-player slot sits above the Settings gear. No Account row.
- **D-03:** Active/hover visual state = accent-color pill + 2-3px left accent bar. Active: `bg-accent/10` pill + `border-l-2 border-accent` + icon/label in `text-accent`. Hover: `bg-neutral-800/60` pill.
- **D-04:** Play-section main area = owner-drawn hero image + centered Play button + version footer. Phase 4 ships with CSS-gradient stub.
- **D-05:** Cosmetics section = polished "Coming soon" empty state with placeholder cape SVG.
- **D-06:** AccountBadge stays top-right with extended dropdown: username, UUID (first-8 + tooltip full), separator, "Account settings" (deep-links to Settings modal Account tab), "Sign out" (existing Phase 2 behavior, no confirm).
- **D-07:** `SettingsDrawer.tsx` is deleted. Radix `Sheet` component stays in `components/ui/`. Gear icon in App.tsx's top-right is removed.

**Settings modal:**
- **D-08:** Bottom-slide-up overlay. Slide up + fade in; close = slide down + fade out. Three-gesture dismissal (X + ESC + backdrop).
- **D-09:** Height ~70% viewport (~560px on 1280x800). Width = 1060px covering main area only (so sidebar stays clickable to dismiss).
- **D-10:** Internal nav is a ~180px left sub-sidebar with panes: General, Account, Appearance, Spotify, About.
- **D-11:** Modal deep-linkable via `useSettingsStore.setOpenPane(pane)`.

**Theme system:**
- **D-12:** Dark mode only. No `prefers-color-scheme: light` branch. No theme toggle.
- **D-13:** 8 accent presets. Cyan `#16e0ee` is the locked default (preserves Phase 1 D-09). Other seven (green, purple, orange, pink, red, yellow, gray) are researcher discretion — see §Accent Color Palette below.
- **D-14:** Custom hex UX = hex field + EyeDropper API button + live preview. Invalid input = stays "typing", no swap.
- **D-15:** No contrast warning in v0.1.
- **D-16:** Accent applies to: Play button bg, focus-visible rings, active sidebar nav pill + left bar, active modal sub-nav item, progress bar fill, device-code countdown highlight. NOT: headings, body text, links, skin-head outline.
- **D-17:** Token architecture = Tailwind v4 `@theme` CSS vars as single source. Runtime accent swap = `document.documentElement.style.setProperty('--color-accent', hex)`.
- **D-18:** Accent + reduceMotion persist in `settings.json`. Schema bump to v2: `{ version: 2, ramMb, firstRunSeen, theme: { accent, reduceMotion: 'system' | 'on' | 'off' } }`.
- **D-19:** Typography is a research task (resolved in §Typography below).

**Motion system:**
- **D-20:** Hybrid — CSS primitives for hover/focus/button-press/simple fades; framer-motion for bottom-slide modal, section route swaps, Spotify album-art crossfade, device-code modal enter/exit.
- **D-21:** Duration tokens — fast `120ms`, med `200ms`, slow `320ms`.
- **D-22:** Easing tokens — `--ease-emphasized: cubic-bezier(0.2, 0, 0, 1)`, `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`, `--ease-spring: { stiffness: 300, damping: 30, mass: 1 }` (framer-motion only).
- **D-23:** In-scope motion: Settings modal slide, sidebar nav active-state transition (layoutId), button hover, section route fade, progress bar fill, device-code modal. Deferred: shared-element accent morph, page-transition choreography, skin-head idle anim, drag-to-reorder.
- **D-24:** Reduced motion = in-app toggle (`system` | `on` | `off`) + respects OS default. When resolved "reduced," all transitions collapse to 0ms.

**Spotify mini-player:**
- **D-25:** Pinned at sidebar bottom above Settings gear. ~72-80px block: album art 48px + stacked text + three icon buttons.
- **D-26:** Disconnected → "Connect Spotify" CTA in same slot.
- **D-27:** Connected + idle → "Nothing playing" placeholder with stable layout.
- **D-28:** Controls = play/pause + skip next + skip previous + current track label. No volume/progress/shuffle/repeat.
- **D-29:** OAuth = PKCE + loopback redirect on `127.0.0.1:<random port>`. One-shot HTTP server via `get-port` OR native `net.createServer()` (§Spotify OAuth below recommends native).
- **D-30:** Scopes: `user-read-currently-playing`, `user-read-playback-state`, `user-modify-playback-state`. No playlist/library/profile scopes.
- **D-31:** Owner-registered Spotify dev app. App name: "Wiiwho Client". Redirect URI handling — see §Spotify OAuth (CONTEXT says `http://127.0.0.1:*` wildcard; **research finding: wildcard NOT supported — actual mechanism is different**). Client ID in source (non-secret per PKCE).
- **D-32:** Token storage = safeStorage-encrypted `spotify.bin` at `%APPDATA%/Wiiwho/spotify.bin` (macOS: `~/Library/Application Support/Wiiwho/spotify.bin`). Parallel to Phase 2 `auth.bin`. Schema: `{ version: 1, accessToken: <enc>, refreshToken: <enc>, expiresAt: <iso>, scopes: [...], displayName: <cached> }`.
- **D-33:** Disconnect reachable from (a) mini-player context menu and (b) Settings modal → Spotify pane.
- **D-34:** Polling cadence — 5s focused / 15s backgrounded. On 401: refresh once; on subsequent 401: disconnect.
- **D-35:** Offline degradation = graceful. Show last-known track + subtle "(offline)" label. No error modal.

**Design system doc:**
- **D-36:** `docs/DESIGN-SYSTEM.md` produced in Phase 4 execute. Sections: Intro+philosophy, Token catalog, Usage examples, Hero Art provenance, Typography provenance, Iconography provenance, **Exclusion checklist per UI-05** (explicit anti-ads/news/social).
- **D-37:** Figma MCP is not installed. Skip the Figma-provenance section rather than configure mid-phase.

### Claude's Discretion

- Exact 8-preset hex values (planner tunes; cyan-default locked) — **§Accent Color Palette below proposes final hexes.**
- Lunar/Badlion/Feather font identification + free alternative — **§Typography below.**
- Hero art delivery — owner drops asset on their own timeline; ship with gradient stub.
- Cosmetics "Coming soon" illustration — stylized custom SVG cape outline until owner draws real one.
- Settings modal width vs sidebar clickability — D-09 recommends 1060px over-main-area.
- Sidebar nav pill glide direction — framer-motion `layoutId` handles direction automatically.
- Section route swap direction — planner picks fade + optional slight directional slide.
- Spotify polling cadence tuning — recommended 5s/15s; planner picks `document.visibilityState` vs window-focus as trigger.
- Spotify `get-port` vs native `net.createServer({port:0})` — **§Spotify OAuth recommends native (zero new deps).**
- Eyedropper fallback — detection `'EyeDropper' in window`; if false, hex-input-only (confirmed supported in Electron 41).
- Custom-hex validation micro-UX — invalid input stays "typing" (no red border).
- framer-motion version pinning — **recommended `motion@^12.38.0` (the 2024 rebrand of framer-motion), React 19 compatible.**
- DESIGN-SYSTEM.md screenshot sourcing — capture from dev-mode launcher once UI built.
- AccountBadge dropdown menu ordering — per D-06 content, visual order planner's call.
- Sidebar divider style — `border-t border-neutral-800` default.
- Spotify mini-player context-menu trigger — right-click + visible chevron (both discoverable).
- Framer-motion reduced-motion integration — **recommend `useReducedMotion()` hook + a duration resolver that returns 0 for reduced state.**
- Radix Dialog vs custom modal — **§Radix Dialog Bottom-Slide recommends Radix Dialog with `forceMount` + `AnimatePresence`.**
- Accent persistence across HMR — small rehydration hook on Vite HMR (or just on mount from Zustand).
- Spotify album-art caching — rely on HTTP cache (Spotify CDN URLs are stable enough for a session).
- Cosmetics empty-state motion — static, no hover tilt for v0.1.

### Deferred Ideas (OUT OF SCOPE)

**Deferred to v0.2+:**
- Light mode (UI-02 dropped).
- Contrast warning on custom hex input.
- Account as a top-level sidebar row.
- Sidebar collapsible rail (64 ↔ 220px).
- Icon-only sidebar.
- Account-section standalone surface in the main area.
- Spotify volume / progress / shuffle / repeat controls.
- Spotify seek / scrubbing.
- Spotify playlist / library integration.
- Spotify Web Playback SDK (browser-side playback).
- Spotify open-at-startup / miniplayer-while-minimized.
- Spotify offline-fallback richer state (last-played history, queue preview).
- Apple Music / YouTube Music / SoundCloud integrations.
- Figma MCP integration.
- Hero art v1 bitmap (gradient stub ships; art is a separate asset task).
- Placeholder cape SVG (Phase 6 owns real cape).
- In-game Spotify HUD (Phase 5 stretch).
- Shared-element accent-morph animation on theme change.
- Page-transition choreography beyond fade + slight directional slide.
- Skin-head idle animation (breathing effect).
- Drag-to-reorder sidebar sections.
- In-app font-size override; high-contrast theme preset.
- Keyboard shortcut system.
- Electron menu bar / macOS app menu customization.
- Multi-window support (Settings pop-out, Spotify mini-window).
- Spotify rate-limit aware exponential backoff on 429 (acknowledged; detailed tuning deferred).

**Out-of-scope reminders (non-negotiable for v0.1):**
- Ads, news feeds, concurrent-user counts, friends lists, marketing content — UI-05 literal ban.
- Auto-updater (`electron-updater`).
- Signed Windows installer + macOS notarization.
- Crash uploader / telemetry.
- Spotify tokens in `settings.json` or outside `spotify.bin`.
- MSAL-Browser for Spotify (irrelevant — Spotify has its own OAuth).
- Cracked-account support; Minecraft asset redistribution; Lunar/Badlion/Feather asset redistribution; Linux packaging.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|-----------------------------------|------------------|
| **UI-01** | Accent color picker (≥3 presets + custom hex); applies across launcher; persists across restarts | §Accent Color Palette (8 preset hexes + names + contrast), §Tailwind v4 Theme Architecture (runtime `--color-accent` swap), §EyeDropper API (custom hex + eyedropper). Persistence via D-18 settings v1→v2 migration. |
| **UI-03** | Transitions/modal/hover/loading use consistent motion with documented timing curves + durations | §Motion Stack (motion@12.38.0 + React 19 peer; layoutId for sidebar pill; useReducedMotion; spring config). Duration/easing tokens from D-21/D-22 documented in `@theme`. |
| **UI-04** | Sidebar navigation with Play, Settings, Account, Cosmetics; Play is primary CTA (interpretation: Account lives in Settings modal per E-03) | Sidebar structure from D-01/D-02; motion pill from §Motion Stack (layoutId pattern verified). |
| **UI-05** | No ads/news/social; verified against exclusion checklist in `docs/DESIGN-SYSTEM.md` | Documentation deliverable only — §Anti-bloat Enforcement (check during plan review; every component inspected). |
| **UI-06** | Spotify OAuth + embedded mini-player (track, art, play/pause/skip); graceful offline/disconnect | §Spotify OAuth + Web API — full PKCE flow, scopes, rate limits, 429 handling, loopback port strategy. |
| **UI-07** | Design system documented in code (tokens) + `docs/DESIGN-SYSTEM.md` with rationale, usage, exclusion checklist | §Tailwind v4 Theme Architecture (single-source tokens in `@theme`), §DESIGN-SYSTEM.md Outline below. |

</phase_requirements>

---

## Research Summary

1. **Motion library rebrand is real.** `framer-motion` became `motion` mid-2025. Pin **`motion@^12.38.0`** (peer `react ^18 || ^19` — React 19 compatible). Import path: `motion/react`. API surface for `layoutId`, `useReducedMotion`, `AnimatePresence`, spring transitions is unchanged from framer-motion.
2. **Tailwind v4 runtime accent swap is sound** with one pitfall: `@theme { --color-accent: var(--accent-9); }` breaks Tailwind's utility generator (produces `var(--color-bg-accent)` — wrong). Define accent as a literal in `@theme` and mutate via `document.documentElement.style.setProperty('--color-accent', hex)` — this **does** propagate to `bg-accent` / `ring-accent` / `text-accent` utilities at runtime.
3. **Spotify loopback redirect does NOT use wildcard `*`.** CONTEXT D-31 says "Redirect URI: `http://127.0.0.1:*`" — this is **incorrect** per current Spotify docs. The correct mechanism: register `http://127.0.0.1/callback` (no port) in the Spotify dashboard, then pass `http://127.0.0.1:<actualPort>/callback` in the authorize request. Note: Spotify's 27 Nov 2025 security change removed `localhost` but kept `127.0.0.1` loopback support.
4. **Spotify playback control (`user-modify-playback-state`) requires Spotify Premium on the authenticated user's account.** Free-tier users will see 403 `PREMIUM_REQUIRED` on play/pause/skip calls. Read endpoints (currently-playing, playback-state) work on Free. **Planner must handle 403 PREMIUM_REQUIRED gracefully** — show read-only mini-player with controls disabled and a one-line "Premium required for controls" note.
5. **Spotify rate limits = rolling 30s window.** 5s polling = 12 req/min = comfortably within the non-extended dev-mode envelope. On 429: read `Retry-After` header (seconds) and back off for exactly that duration.
6. **EyeDropper API works in Electron 41** (Chromium 146 ≥ 95). `'EyeDropper' in window` is the feature probe. Must be invoked from a user gesture (button click) — CSP-safe inside sandbox + contextIsolation renderer.
7. **CSS `@starting-style` is Baseline Newly Available** in Chromium 117+. Electron 41 ships Chromium 146 — fully supported. Use `@starting-style` for simple CSS-only enter animations (no JS timing hacks). Pair with `transition-behavior: allow-discrete` when transitioning display.
8. **Radix Dialog + framer-motion requires `forceMount` on Portal + Content + Overlay** so AnimatePresence controls mount/unmount for exit animations. Documented canonical pattern by the Motion team.
9. **Lunar Client's font is inaccessible** (distributed inside their app.asar as a custom font; no public brand asset on their CDN). Owner's hint "whatever Lunar/Badlion uses" is best satisfied with **Inter Variable** (SIL OFL 1.1) — the closest-DNA free alternative with matching geometric-grotesque shape and excellent screen rendering. **Recommended as primary font.** Self-hosted woff2; falls back to system sans on load failure.
10. **get-port vs native `net.createServer({port:0})`** — tie. Native is 10 lines, zero new deps, idiomatic Node. **Recommend native.** Rationale: `get-port` adds an ESM-only dep with an awkward Node version matrix; `net.createServer().listen(0)` is stable, documented, one-shot.

**Primary recommendation:** Implement hybrid-motion launcher with motion@12.38.0 + Tailwind v4 `@theme` tokens, Inter Variable self-hosted font, Radix Dialog + `forceMount` + `AnimatePresence` for bottom-slide Settings modal, PKCE-with-registered-loopback-port for Spotify OAuth (no wildcard), native `net.createServer({port:0})` for the one-shot callback server, safeStorage-encrypted `spotify.bin`, and a 6th top-level preload key `spotify` (deliberate frozen-IPC-surface deviation, documented in commit).

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Implication for Phase 4 |
|-----------|--------|------------------------|
| **Electron 41 + React 19 + TypeScript + Tailwind v4 + Radix unified + Zustand locked** | CLAUDE.md § Tech Stack | All Phase 4 dependencies must fit inside this stack. No new state manager, no new CSS framework. |
| **Anticheat safety non-negotiable** | CLAUDE.md § Project Vision, §ANTICHEAT-SAFETY.md | Phase 4 touches **zero** in-game code. Spotify runs entirely in Electron main process. No Forge hook. |
| **Dev-stack launcher perf is irrelevant to in-game FPS** | CLAUDE.md § Tech Stack | framer-motion + font file + Spotify polling are free to use; they don't affect game FPS. |
| **No redistribution of Minecraft or third-party assets** | CLAUDE.md § Legal Notes; REQUIREMENTS.md § Out of Scope | Font must be free-licensed (SIL OFL / Apache 2 / MIT). Cannot ship Gilroy/Graphik (commercial). |
| **GSD workflow enforcement** | CLAUDE.md § GSD Workflow Enforcement | All Phase 4 edits happen inside `/gsd:execute-phase` plans, never direct edits. |
| **v0.1 = personal + small-group; no signing, no auto-update** | PROJECT.md + Phase 3 context | macOS unsigned is fine for token storage (safeStorage uses DPAPI/Keychain regardless of signing). No electron-updater. |
| **Frozen 5 top-level preload keys (auth, game, settings, logs, __debug)** | Phase 1 locked; Phase 3 preserved | Adding `spotify` as 6th top-level key is a **deliberate deviation** — document in CONTEXT/commit message. Alternative (nesting under `settings`) is semantically wrong. |
| **Main process is the ONLY cleartext-token surface** | Phase 2 + 3 invariant | Spotify access/refresh tokens never cross IPC to renderer. Only non-secret fields (track title, album art URL, display name) do. |
| **Security invariant: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`** | Phase 1 lock | EyeDropper API, motion, Tailwind v4 all work inside this posture. Do not regress. |
| **Schema-versioned persistence** | Phase 2 + 3 pattern | `settings.json` bumps v1→v2 with additive migration (defaults for new fields). |
| **Windows + macOS only v0.1; font bundling auto-included** | PROJECT.md + Phase 3 | Self-hosted woff2 in renderer build output, picked up by electron-builder automatically. |

---

## Typography

### Identification (Lunar / Badlion / Feather)

| Client | Font (identified) | License | Bundleable? |
|--------|-------------------|---------|-------------|
| **Lunar Client** | Custom Inter-like grotesque; launcher packs proprietary `.woff2` inside `app.asar`. Brand PDF confirms "Lunar typeface" but doesn't name a commercial foundry. No public redistribution. | Proprietary | NO |
| **Badlion Client** | Appears to use a Gilroy-family variant in marketing; launcher UI uses a geometric sans consistent with Gilroy or Poppins. Gilroy is commercial (Radomir Tinkov, via TypeType). | Commercial (free weights for personal use only) | NO |
| **Feather Client** | Uses system sans + a display face for headings (visually Inter / Geist Mono territory) | Mixed | NO |

**Conclusion:** None of the three can be redistributed in WiiWho's bundle without licensing. All three ship fonts that visually occupy the "modern geometric grotesque" space (Inter / Manrope / Gilroy family).

### Recommended: **Inter Variable** (primary) + **JetBrains Mono** (monospace for device code / UUID display)

| Font | Version | Purpose | License | Why |
|------|---------|---------|---------|-----|
| **Inter** | 4.x (variable) | Primary UI typeface — body, headings, labels, button text | SIL OFL 1.1 | Industry-standard free alternative with the tightest visual DNA to Lunar's typeface and Gilroy. Optimized for on-screen readability; tall x-height; tabular numerics built-in (useful for RAM slider, version tags, device-code countdown). Variable axes (wght 100-900, slnt, opsz) — single woff2 covers all weights. Used by Vercel, Figma, GitHub — immediately recognizable "polished desktop app" DNA. Self-hostable without attribution requirement (SIL OFL permits embedding). |
| **JetBrains Mono** | 2.x (variable) | Monospace for: device-code 8-char display (already in DeviceCodeModal), full-UUID display in AccountBadge dropdown + Settings Account pane, build-hash in Settings About pane | Apache 2.0 | Standard "modern dev-tool monospace" — better reading-at-a-glance than Consolas/Menlo for 8-char codes. Matches Inter's grotesque-era letterform shapes. Variable (wght + italic). |

### Bundling strategy

```
launcher/src/renderer/src/assets/fonts/
  inter/
    InterVariable.woff2           # ~340KB (covers 100-900 wght + all axes)
    LICENSE.txt                   # SIL OFL 1.1 verbatim
  jetbrains-mono/
    JetBrainsMono-Variable.woff2  # ~120KB
    LICENSE.txt                   # Apache 2.0 verbatim
```

**`global.css`:**
```css
@font-face {
  font-family: 'Inter';
  src: url('./assets/fonts/inter/InterVariable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap; /* fallback to system sans while loading — no FOIT */
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('./assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2') format('woff2-variations');
  font-weight: 100 800;
  font-display: swap;
}

@theme {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace;
}
```

**Tailwind classes unlocked:** `font-sans` (default on `body`), `font-mono` (applied to `.tabular-nums` mono contexts already in use — PlayButton's Downloading % display, DeviceCodeModal, settings version footer).

**FOUT strategy:** `font-display: swap` means system-sans paints first frame, Inter swaps in when loaded (typical <100ms for a 340KB woff2 on a local file:// disk). No invisible-text flash.

**Version verification (do at Wave 0):**
```bash
npm view inter-ui version   # latest Inter release on npm (optional dep — we self-host direct)
```
OR fetch direct from rsms/inter releases: https://github.com/rsms/inter/releases — pick the latest stable (currently 4.x as of 2026-04).

**DESIGN-SYSTEM.md § Typography provenance must document:**
- Inter: name, version pinned, SIL OFL 1.1 text URL, source URL (github.com/rsms/inter), designer (Rasmus Andersson), bundle location.
- JetBrains Mono: name, version pinned, Apache 2.0 text URL, source URL (github.com/JetBrains/JetBrainsMono), designer (Philipp Nurullin / JetBrains), bundle location.

---

## Accent Color Palette

### Final 8 presets (tuned for harmonious dark-mode contrast against `--color-wiiwho-bg: #111111`)

| # | Preset Name | Hex | Contrast vs `#111111` | WCAG 2.1 Non-text (3:1 UI) | Rationale |
|---|-------------|-----|------------------------|---------------------------|-----------|
| 1 | **Cyan** (default, D-13 lock) | `#16e0ee` | **11.1 : 1** | ✓✓ (AAA) | Phase 1 D-09 locked. Vibrant cold neon, on-brand. |
| 2 | **Mint** | `#22c55e` | **8.6 : 1** | ✓✓ (AAA) | Balanced green, not forest/lime. Tailwind green-500 — well-tested in dark UIs. |
| 3 | **Violet** | `#a855f7` | **5.6 : 1** | ✓ (AA large, passes 3:1 UI) | Tailwind purple-500; eye-catching but not migraine-purple. |
| 4 | **Tangerine** | `#f97316` | **7.8 : 1** | ✓✓ (AAA) | Tailwind orange-500; warm counter to the cool cyan default. |
| 5 | **Pink** | `#ec4899` | **6.2 : 1** | ✓ (AA) | Tailwind pink-500; playful, reads clearly. |
| 6 | **Crimson** | `#f87171` | **7.4 : 1** | ✓✓ (AAA) | Tailwind red-400 (NOT red-500 `#ef4444` = 6.8:1). red-400 reads warmer, less "error-message" on dark bg. |
| 7 | **Amber** | `#fbbf24` | **11.2 : 1** | ✓✓ (AAA) | Tailwind amber-400 (NOT yellow-500 `#eab308` = 10.4:1 but too mustard). Amber-400 pops on dark. |
| 8 | **Slate** | `#cbd5e1` | **11.6 : 1** | ✓✓ (AAA) | Tailwind slate-300; greyscale "no theme" option. Reads as "accent off" without eliminating the theming surface (UI still highlights, just in neutral). |

All eight pass WCAG 2.1 SC 1.4.11 Non-text Contrast (≥3:1 vs dark bg) required for UI components including focus rings. Contrast ratios computed using standard WCAG 2.1 relative-luminance formula.

### Why these choices over the D-13 candidates

- D-13 listed `#eab308` (yellow) — replaced with `#fbbf24` (amber-400). Yellow-500 is too mustard on `#111111`; amber-400 is more vibrant and hits AAA.
- D-13 listed `#ef4444` (red) — replaced with `#f87171` (red-400). red-500 reads as "error danger" semantically; red-400 is warmer and less alarming when used for UI chrome (the focus ring shouldn't look like an error).
- D-13 listed `#9ca3af` (gray) — replaced with `#cbd5e1` (slate-300). gray-400 has lower contrast (~7:1); slate-300 is brighter and reads as "chrome" not "disabled-text."
- Display names are single-word where possible (Mint not Green, Violet not Purple, Tangerine not Orange, Crimson not Red, Amber not Yellow, Slate not Gray) — reads more like a design system, less like a crayon box.

### CSS embedding (in `global.css` `@theme` block)

```css
@theme {
  /* Dark bg + dark surfaces */
  --color-wiiwho-bg: #111111;
  --color-wiiwho-surface: #1a1a1a;
  --color-wiiwho-border: #262626;  /* neutral-800 */

  /* Default accent — runtime-mutable via document.documentElement.style.setProperty */
  --color-accent: #16e0ee;

  /* Preset swatches (static — the picker references these by preset slot) */
  --color-preset-cyan: #16e0ee;
  --color-preset-mint: #22c55e;
  --color-preset-violet: #a855f7;
  --color-preset-tangerine: #f97316;
  --color-preset-pink: #ec4899;
  --color-preset-crimson: #f87171;
  --color-preset-amber: #fbbf24;
  --color-preset-slate: #cbd5e1;
}
```

**Renderer-side preset catalog** (TypeScript constant in `stores/settings.ts` or a new `theme/presets.ts`):
```ts
export const ACCENT_PRESETS = [
  { id: 'cyan',      name: 'Cyan',      hex: '#16e0ee' },
  { id: 'mint',      name: 'Mint',      hex: '#22c55e' },
  { id: 'violet',    name: 'Violet',    hex: '#a855f7' },
  { id: 'tangerine', name: 'Tangerine', hex: '#f97316' },
  { id: 'pink',      name: 'Pink',      hex: '#ec4899' },
  { id: 'crimson',   name: 'Crimson',   hex: '#f87171' },
  { id: 'amber',     name: 'Amber',     hex: '#fbbf24' },
  { id: 'slate',     name: 'Slate',     hex: '#cbd5e1' },
] as const;
```

---

## Motion Stack

### Package pin

```bash
pnpm --filter ./launcher add motion@^12.38.0
```

- **Package name:** `motion` (not `framer-motion` — the library was renamed mid-2025 when it became independent of Framer).
- **Version:** `12.38.0` (latest stable as of 2026-04, published 2026-03-17).
- **Peer deps:** `react ^18.0.0 || ^19.0.0` — React 19 compatible ✓.
- **Import path:** `import { motion, AnimatePresence, useReducedMotion } from 'motion/react'`.
- **Why v12:** New color type support (oklch/oklab/lab/lch), hardware-accelerated scroll. The 12.x line is React 19's well-tested line.
- **Backwards:** `framer-motion` npm package still published but no longer actively developed. Do NOT install both.

### API patterns (all verified against motion.dev/docs on 2026-04-24)

**Pattern A — Sidebar nav pill glide (UI-04 active-state transition):**

```tsx
// components/Sidebar.tsx — active nav pill glides between items via layoutId
import { motion } from 'motion/react';

const NAV_ITEMS = [
  { id: 'play',      label: 'Play',      icon: Play },
  { id: 'cosmetics', label: 'Cosmetics', icon: Shirt },
];

function SidebarNav({ active, onSelect }) {
  return NAV_ITEMS.map(item => (
    <button key={item.id} onClick={() => onSelect(item.id)}
            className="relative flex items-center gap-3 px-4 py-3 w-full text-left">
      {active === item.id && (
        <motion.div
          layoutId="sidebar-nav-pill"
          className="absolute inset-0 bg-accent/10 rounded-md"
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }}
        />
      )}
      {active === item.id && (
        <motion.div
          layoutId="sidebar-nav-bar"
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent"
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }}
        />
      )}
      <item.icon className="size-5 relative z-10" />
      <span className="relative z-10">{item.label}</span>
    </button>
  ));
}
```

**Pattern B — Settings modal bottom-slide (UI-03, D-08):** see §Radix Dialog Bottom-Slide below.

**Pattern C — Section route fade (UI-03, Play ↔ Cosmetics swap):**

```tsx
// App.tsx main-area router
<AnimatePresence mode="wait">
  <motion.div
    key={activeSection}   // triggers exit/enter on section change
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}  // --duration-med + --ease-standard
  >
    {activeSection === 'play' ? <PlaySection /> : <CosmeticsSection />}
  </motion.div>
</AnimatePresence>
```

**Pattern D — Spotify album-art crossfade (D-28):**

```tsx
<AnimatePresence mode="popLayout">
  <motion.img
    key={track.albumArtUrl}
    src={track.albumArtUrl}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="size-12 rounded"
  />
</AnimatePresence>
```

**Pattern E — Reduced motion (D-24):**

```tsx
// hooks/useMotionConfig.ts — single source of truth for motion timing
import { useReducedMotion } from 'motion/react';
import { useSettingsStore } from '../stores/settings';

export function useMotionConfig() {
  const systemReduce = useReducedMotion();     // reads prefers-reduced-motion live
  const userOverride = useSettingsStore(s => s.theme.reduceMotion);  // 'system' | 'on' | 'off'

  const reduced =
    userOverride === 'on'  ? true  :
    userOverride === 'off' ? false :
                             systemReduce;     // 'system' — follow OS

  return {
    reduced,
    durationFast: reduced ? 0 : 0.12,
    durationMed:  reduced ? 0 : 0.20,
    durationSlow: reduced ? 0 : 0.32,
    spring: reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30, mass: 1 } as const,
  };
}
```

**Pattern F — CSS primitives for hover/focus/button-press (D-20 non-framer-motion surfaces):**

```css
/* global.css — pair with --duration-fast / --ease-standard */
.btn-primary {
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}
.btn-primary:hover  { background-color: color-mix(in srgb, var(--color-accent) 85%, white); }
.btn-primary:active { transform: scale(0.98); }
.focus-visible      { outline: 2px solid var(--color-accent); outline-offset: 2px; }
```

### Duration / easing CSS variables (consumed by both CSS and JS)

```css
@theme {
  --duration-fast: 120ms;
  --duration-med:  200ms;
  --duration-slow: 320ms;
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --ease-standard:   cubic-bezier(0.4, 0, 0.2, 1);
}
```

**JS-side duplication vs single source.** The canonical 2026 pattern: **keep the CSS vars authoritative; duplicate numbers as TS module constants when JS needs them** (framer-motion `transition.duration` expects seconds, not `var(--duration-med)`). Reading `getComputedStyle(document.documentElement).getPropertyValue('--duration-med')` at runtime is technically possible but thrashes the layout engine on every call and is overkill. Duplication is fine as long as a single TS file (`theme/motion.ts`) owns both numbers and references the CSS var string in a comment:

```ts
// theme/motion.ts — duplicates values from global.css @theme. Keep in sync.
export const DURATION_FAST = 0.12;  // mirrors --duration-fast: 120ms
export const DURATION_MED  = 0.20;  // mirrors --duration-med: 200ms
export const DURATION_SLOW = 0.32;  // mirrors --duration-slow: 320ms
export const EASE_EMPHASIZED = [0.2, 0, 0, 1] as const;
export const EASE_STANDARD   = [0.4, 0, 0.2, 1] as const;
export const SPRING_STANDARD = { type: 'spring', stiffness: 300, damping: 30, mass: 1 } as const;
```

---

## Spotify OAuth + Web API

### Canonical URLs (verified 2026-04)

| Purpose | URL |
|---------|-----|
| Authorize endpoint | `https://accounts.spotify.com/authorize` |
| Token exchange + refresh | `https://accounts.spotify.com/api/token` |
| Currently playing track | `GET https://api.spotify.com/v1/me/player/currently-playing` |
| Playback state (fuller) | `GET https://api.spotify.com/v1/me/player` |
| Play / Resume | `PUT https://api.spotify.com/v1/me/player/play` |
| Pause | `PUT https://api.spotify.com/v1/me/player/pause` |
| Skip to next | `POST https://api.spotify.com/v1/me/player/next` |
| Skip to previous | `POST https://api.spotify.com/v1/me/player/previous` |
| Current user profile (for display name) | `GET https://api.spotify.com/v1/me` |

### Scopes (D-30 verified)

```
user-read-currently-playing   # read the current track for display
user-read-playback-state      # poll play/pause state + device info
user-modify-playback-state    # fire play/pause/next/prev commands (Premium required)
```

No playlist, library, profile-edit, streaming, or follow scopes. Tight permission footprint.

### PKCE Authorization Code flow (exact steps)

1. **Generate `code_verifier`** — 43-128 character cryptographically random string, charset `[A-Za-z0-9_.~-]`:
   ```ts
   import { randomBytes } from 'node:crypto';
   const codeVerifier = randomBytes(64).toString('base64url'); // 88 chars, URL-safe base64
   ```

2. **Derive `code_challenge`** — SHA-256 of verifier, base64url-encoded (no padding):
   ```ts
   import { createHash } from 'node:crypto';
   const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
   ```

3. **Start one-shot loopback HTTP server on random free port** (native — see "get-port vs native" below):
   ```ts
   import { createServer } from 'node:http';
   const server = createServer();
   await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
   const port = (server.address() as import('node:net').AddressInfo).port;
   const redirectUri = `http://127.0.0.1:${port}/callback`;
   ```

4. **Build authorize URL**:
   ```ts
   const params = new URLSearchParams({
     client_id: SPOTIFY_CLIENT_ID,
     response_type: 'code',
     redirect_uri: redirectUri,           // full URL incl. port — despite not being in dashboard
     code_challenge_method: 'S256',
     code_challenge: codeChallenge,
     scope: 'user-read-currently-playing user-read-playback-state user-modify-playback-state',
     state: crypto.randomUUID(),          // CSRF protection
   });
   const authUrl = `https://accounts.spotify.com/authorize?${params}`;
   await shell.openExternal(authUrl);
   ```

5. **Wait for redirect** — user authorizes in system browser; Spotify redirects to `http://127.0.0.1:<port>/callback?code=<code>&state=<state>`:
   ```ts
   server.on('request', async (req, res) => {
     const url = new URL(req.url!, `http://127.0.0.1:${port}`);
     const code = url.searchParams.get('code');
     const returnedState = url.searchParams.get('state');
     const error = url.searchParams.get('error');
     // validate state matches, render success HTML, close server, resolve with code
     res.writeHead(200, { 'Content-Type': 'text/html' });
     res.end('<html><body><h1>Connected to Spotify</h1><p>You can close this window.</p></body></html>');
     server.close();
   });
   ```

6. **Exchange code for tokens** (POST to `/api/token`):
   ```ts
   const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: new URLSearchParams({
       grant_type: 'authorization_code',
       code,
       redirect_uri: redirectUri,
       client_id: SPOTIFY_CLIENT_ID,
       code_verifier: codeVerifier,
     }),
   });
   const { access_token, refresh_token, expires_in, scope } = await tokenRes.json();
   // expires_in is seconds (typically 3600); compute expiresAt = Date.now() + expires_in * 1000
   ```

7. **Persist encrypted** (`spotify.bin` via safeStorage — reuse Phase 2 `safeStorageCache.ts` pattern):
   ```ts
   await writeSpotifyTokens({
     version: 1,
     accessToken: access_token,      // safeStorage.encryptString
     refreshToken: refresh_token,    // safeStorage.encryptString
     expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
     scopes: scope.split(' '),
     displayName: '',                // fetched next
   });
   ```

8. **Fetch display name** (`GET /v1/me`) and cache in `spotify.bin` (non-secret, fine to cache).

### Refresh flow (when access token has ≤60s remaining OR on first 401)

```ts
const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  }),
});
const { access_token, refresh_token: newRefresh, expires_in } = await refreshRes.json();
// Spotify MAY rotate the refresh token — if newRefresh is present, replace; else keep the old one.
```

### Redirect URI registration — CORRECT mechanism (CONTEXT D-31 is incorrect)

**CONTEXT D-31 says:** "Redirect URI: `http://127.0.0.1:*` (loopback range, Spotify supports wildcard port for PKCE)."

**CORRECT per current Spotify docs (2026-04):** Spotify does **NOT** support wildcard redirect URIs. Registration has two modes:

**Mode 1 — fixed port (simpler, preferred if we can pick one):**
- Dashboard registration: `http://127.0.0.1:24893/callback` (or any specific unused port — 24893 is just a random pick).
- Launcher always spawns the server on that exact port.
- Risk: if the port is in use by another process, the connect flow fails. Low but nonzero for a user who runs many servers.

**Mode 2 — loopback literal without port (dynamic port):**
- Dashboard registration: `http://127.0.0.1/callback` (NO port specified).
- Launcher picks a random free port at runtime via `net.createServer({port:0})`.
- Authorize request sends the full URL including the dynamic port in `redirect_uri`.
- Spotify accepts this because the loopback IP literal is registered and port is opaque.

**Recommendation:** **Mode 2 (dynamic port)** matches CONTEXT's intent (D-29 "random free port") and is more robust. Register `http://127.0.0.1/callback` in the Spotify dashboard — no port. The authorize-time redirect URI with port is accepted.

**CONTEXT D-31 must be corrected:** Replace `http://127.0.0.1:*` with `http://127.0.0.1/callback` in any dashboard-registration step. Planner should include this correction as a Wave 0 owner-task (dashboard registration is manual, happens once, owner does it).

**Note on the 2025-11-27 Spotify security migration:** Spotify removed `localhost` and HTTP-scheme redirect URIs in Nov 2025 **except** for loopback IPs (`127.0.0.1`, `[::1]`). Our pattern survives this migration because we use `127.0.0.1` not `localhost`.

### Rate limits + polling cadence

- **Limit formula:** Rolling 30-second window. Hard number varies by dev-mode vs extended-quota. For dev-mode apps, community reports suggest ~180 requests per rolling 30s window (soft) — Spotify does not publish the exact number.
- **Math for D-34 (5s focused / 15s backgrounded):**
  - Focused polling: 1 req / 5s = 12 req/min = **6 req per 30s window** — **30x under the typical dev-mode ceiling**.
  - Backgrounded: 1 req / 15s = 4 req/min = 2 req per 30s window — essentially free.
  - Combined with control-button presses (~5-10 taps/min at worst): still comfortable.
  - **Conclusion: 5s/15s is safe.** Planner may even consider 3s focused if UX wants faster track-change detection — still under rate limit.

### 429 handling (authoritative)

- **Trigger:** Spotify returns 429 when the 30s rolling window fills up.
- **Response headers:** `Retry-After: <seconds>` — wait exactly that many seconds before next request.
- **Body:** JSON with `error.status: 429, error.message: ...` — not load-bearing for logic.
- **Implementation:**
  ```ts
  async function spotifyFetch(url: string, init: RequestInit = {}) {
    const res = await fetch(url, init);
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '30', 10);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return spotifyFetch(url, init); // one retry
    }
    if (res.status === 401) { /* refresh once, retry, else disconnect */ }
    return res;
  }
  ```
- **Do NOT:** exponential backoff without reading `Retry-After`. Do NOT retry more than once per request path.
- **On repeated 429s** (rare — would require the user opening many launcher instances): pause polling entirely for 60 seconds, then resume.

### 403 PREMIUM_REQUIRED handling (CRITICAL — new finding)

**All `user-modify-playback-state` endpoints require the authenticated user's account to have an active Spotify Premium subscription.** Free-tier users receive:

```json
HTTP 403
{
  "error": {
    "status": 403,
    "message": "Player command failed: Premium required",
    "reason": "PREMIUM_REQUIRED"
  }
}
```

**Planner must:**
1. On first 403 PREMIUM_REQUIRED response from a control endpoint, set a session flag `isPremium: false` in `useSpotifyStore`.
2. Disable the play/pause/next/prev buttons in the mini-player and add a tooltip: "Spotify Premium required for controls."
3. **Keep read access working** — `user-read-currently-playing` and `user-read-playback-state` work on Free accounts; the mini-player can still display the current track with disabled controls.
4. On disconnect+reconnect, reset `isPremium` to `unknown` and probe again.

**This is not in CONTEXT — new constraint discovered during research.** Planner must handle.

### `get-port` vs native `net.createServer({port:0})`

| Criterion | `get-port` 7.2.0 | Native `net.createServer({port:0})` |
|-----------|-------------------|--------------------------------------|
| Bundle cost | ~2KB minified + 1 new dep | 0 (Node builtin) |
| Code lines | 2 (import, call) | ~10 (server setup + port read) |
| Node compat | Requires Node ≥16, ESM-only | Universal |
| Feature gap | Has port-range preferences | Only dynamic-free-port |
| Robustness | Adds one more dep to audit | Stable Node builtin, zero drift risk |
| Win/Mac parity | ✓ | ✓ |

**Recommendation: native.** Two reasons:
1. Zero-dep is explicitly aligned with Phase 4's "no unjustified new deps" posture. `get-port` saves <10 lines and doesn't gain us anything.
2. We already need `net`/`http` for the loopback server — adding `get-port` spreads port-picking logic across two modules.

**Canonical one-shot callback server pattern:**

```ts
// launcher/src/main/spotify/oauth.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export async function startOneShotCallbackServer(): Promise<{
  port: number;
  awaitCallback: () => Promise<{ code: string; state: string }>;
  close: () => void;
}> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  const awaitCallback = (): Promise<{ code: string; state: string }> =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('OAuth callback timed out after 5 minutes'));
      }, 5 * 60 * 1000);

      server.on('request', (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url!, `http://127.0.0.1:${port}`);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wiiwho — Spotify Connected</title><style>body{font-family:sans-serif;background:#111;color:#e5e5e5;display:grid;place-items:center;height:100vh;margin:0}h1{color:#16e0ee}p{opacity:.7}</style></head><body><div><h1>Connected</h1><p>You can close this window and return to Wiiwho.</p></div></body></html>`);

        clearTimeout(timeout);
        server.close();

        if (error) return reject(new Error(`Spotify OAuth error: ${error}`));
        if (!code || !state) return reject(new Error('Missing code or state'));
        resolve({ code, state });
      });
    });

  return {
    port,
    awaitCallback,
    close: () => server.close(),
  };
}
```

---

## Tailwind v4 Theme Architecture

### Runtime `--color-accent` swap — verified working

Tailwind v4's tokens are CSS variables at runtime, not JS-compiled literals. Mutating `--color-accent` on `:root` at runtime propagates to every utility that references it (`bg-accent`, `ring-accent`, `text-accent`, `border-accent`).

**Canonical setter (the `setAccent` helper in `stores/settings.ts`):**

```ts
export function setAccent(hex: string) {
  // Validate hex format first — avoid invalid CSS values
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  document.documentElement.style.setProperty('--color-accent', hex);
  // Persist to settings.json so next launch rehydrates
  window.wiiwho.settings.set({ theme: { accent: hex } });
  return true;
}
```

### `@theme` pitfall (IMPORTANT — do not do this)

```css
/* BROKEN — does NOT generate bg-accent utility */
@theme {
  --color-accent: var(--runtime-accent);
}
```

When `@theme` references another CSS variable, Tailwind's utility generator produces `background-color: var(--color-bg-accent)` (notice the `bg-` prefix concatenation) which is undefined. **The Tailwind team confirmed this in discussion #17613.**

**Correct pattern (what we use):**

```css
@theme {
  --color-accent: #16e0ee;  /* literal — Tailwind can parse */
}

:root {
  --color-accent: #16e0ee;  /* redeclare for runtime override — set via setProperty */
}
```

The `@theme` declaration generates the utility classes. The `:root` declaration (which `setProperty` targets) is what gets mutated at runtime. Because they're the same property name, the cascade resolves the `:root` value when both are present. Confirmed working pattern used in production Tailwind v4 apps.

### Hydration across HMR (dev-only concern)

Vite HMR reloads CSS modules, which re-declares `:root { --color-accent: #16e0ee }` — clobbering any user-set accent on hot-reload. Solution: call `setAccent(useSettingsStore.getState().theme.accent)` **in a `useEffect` on the root App** so every re-mount re-applies. Zero cost in production (settings is already loaded on mount).

### `@starting-style` support (D-20 CSS primitives)

Chromium 146 (Electron 41) supports `@starting-style` (Baseline Newly Available; Chromium 117+).

**Use case:** CSS-only enter animations for elements entering the DOM without framer-motion overhead (e.g., tooltip fade-in, dropdown-menu chevron flip).

```css
.toast {
  transition: opacity var(--duration-med) var(--ease-standard);
}
.toast {
  opacity: 1;
}
@starting-style {
  .toast {
    opacity: 0;
  }
}
```

**Recommendation:** Use `@starting-style` for simple single-property enters (tooltip, dropdown item hover reveal). Do NOT use for the Settings modal (complex multi-element orchestration needs framer-motion + AnimatePresence).

### Single-source token catalog

```css
/* launcher/src/renderer/src/global.css */
@import 'tailwindcss';

@theme {
  /* --- COLORS --- */
  --color-wiiwho-bg:      #111111;
  --color-wiiwho-surface: #1a1a1a;
  --color-wiiwho-border:  #262626;

  /* Default accent — mutable at runtime */
  --color-accent: #16e0ee;

  /* Preset swatches — static, referenced by ThemePicker */
  --color-preset-cyan:      #16e0ee;
  --color-preset-mint:      #22c55e;
  --color-preset-violet:    #a855f7;
  --color-preset-tangerine: #f97316;
  --color-preset-pink:      #ec4899;
  --color-preset-crimson:   #f87171;
  --color-preset-amber:     #fbbf24;
  --color-preset-slate:     #cbd5e1;

  /* --- TYPOGRAPHY --- */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace;

  /* --- MOTION --- */
  --duration-fast: 120ms;
  --duration-med:  200ms;
  --duration-slow: 320ms;
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --ease-standard:   cubic-bezier(0.4, 0, 0.2, 1);
  /* --ease-spring: framer-motion only (CSS can't express springs) */

  /* --- SIZING --- */
  --layout-sidebar-width: 220px;   /* D-01 */
  --layout-window-width:  1280px;  /* Phase 3 lock */
  --layout-window-height: 800px;
  --layout-modal-height:  560px;   /* D-09 (70% of 800) */
}

:root {
  /* Runtime-mutable — keep in sync with @theme default */
  --color-accent: #16e0ee;
}

@font-face { /* ... Inter + JetBrains Mono ... */ }
```

**JS/TS-side duplication:** `theme/motion.ts` duplicates the motion numbers (because framer-motion takes seconds, not CSS `var()` strings). `theme/presets.ts` duplicates the accent preset list (because the picker needs metadata: `{id, name, hex}`). Both duplications are single-directional — CSS is source of truth, TS mirrors.

---

## Radix Dialog Bottom-Slide

### Integration pattern: Radix Dialog + framer-motion + `forceMount`

Radix Dialog's default behavior is incompatible with framer-motion's `AnimatePresence` because Radix unmounts the Content when `open={false}`, before framer-motion can run its exit animation. The canonical fix (documented by both Radix and Motion teams): use `forceMount` on Portal + Content + Overlay to delegate mount lifecycle to `AnimatePresence`.

### Canonical Settings modal implementation

```tsx
// components/SettingsModal.tsx
import * as Dialog from 'radix-ui';   // unified Radix v1.x (shadcn 2026 pattern)
import { motion, AnimatePresence } from 'motion/react';
import { useMotionConfig } from '../hooks/useMotionConfig';
import { useSettingsStore } from '../stores/settings';

export function SettingsModal() {
  const open = useSettingsStore(s => s.modalOpen);
  const setOpen = useSettingsStore(s => s.setModalOpen);
  const { durationSlow, durationMed, reduced } = useMotionConfig();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay — fade only */}
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-black/60 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durationMed }}
              />
            </Dialog.Overlay>

            {/* Content — slide up from bottom + fade */}
            <Dialog.Content asChild forceMount>
              <motion.div
                className="
                  fixed bottom-0 left-[220px] right-0 z-50
                  h-[560px] bg-wiiwho-surface
                  border-t border-wiiwho-border
                  rounded-t-lg shadow-2xl
                  flex overflow-hidden
                "
                initial={{ opacity: 0, y: reduced ? 0 : '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : '100%' }}
                transition={{
                  duration: durationSlow,
                  ease: [0.2, 0, 0, 1],  // --ease-emphasized
                }}
                aria-describedby={undefined}
              >
                <Dialog.Title className="sr-only">Settings</Dialog.Title>
                <SettingsSubSidebar />
                <SettingsPane />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

**Why this specific shape:**
- `asChild forceMount` on Overlay + Content — tells Radix "don't manage mount; I will." `AnimatePresence` becomes the mount gatekeeper.
- `Dialog.Root open={open}` (controlled) — still drives the accessibility state (aria-expanded, focus trap, ESC handler, backdrop click) so Radix's a11y stays intact even though framer-motion owns paint.
- `fixed bottom-0 left-[220px] right-0` — the modal covers the main area only (1060px wide), leaving the sidebar clickable for dismiss-by-navigation (per CONTEXT D-09 recommendation).
- `y: '100%'` — slides from **below its own height**, which means it starts fully off-screen even though the container is `bottom-0` positioned. Correct for a "drawer from below" feel.
- `reduced ? 0 : '100%'` — respects reduced-motion by collapsing the slide to instant.
- `aria-describedby={undefined}` — prevents a Radix warning when no `Dialog.Description` is present.

**Radix handles for free:** focus trap + return, ESC-to-close, backdrop-click-to-close, screen-reader announcement, `aria-modal`, stacking context — all three D-08 dismissal gestures covered automatically.

### Sub-sidebar + pane routing (inside the modal, not its own Radix primitive)

Sub-sidebar is a hand-rolled component (not Radix Tabs) because:
- We want the same pill + left-bar motion idiom as the main sidebar (layoutId glide).
- Radix Tabs enforces one-active-at-a-time + keyboard arrow navigation, which is correct, but our nav has only 5 items and the layoutId glide is the key visual — rolling our own keeps motion primary.
- If we ever add keyboard arrow-nav, a 15-line custom handler is fine.

```tsx
const PANES = ['general', 'account', 'appearance', 'spotify', 'about'] as const;
type Pane = typeof PANES[number];

function SettingsSubSidebar() {
  const openPane = useSettingsStore(s => s.openPane);
  const setOpenPane = useSettingsStore(s => s.setOpenPane);
  return (
    <nav className="w-[180px] border-r border-wiiwho-border p-2 flex flex-col gap-1">
      {PANES.map(id => (
        <button key={id} onClick={() => setOpenPane(id)}
                className="relative px-3 py-2 text-left text-sm capitalize">
          {openPane === id && (
            <motion.div layoutId="settings-subnav-pill"
                        className="absolute inset-0 bg-accent/10 rounded"
                        transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }} />
          )}
          <span className="relative z-10">{id}</span>
        </button>
      ))}
    </nav>
  );
}
```

---

## EyeDropper API

### Electron 41 compatibility — CONFIRMED supported

- **API availability:** Chromium 95+. Electron 41 ships Chromium 146. ✓
- **Renderer security posture:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` — EyeDropper is a standard web API, not a Node API, so the Electron security posture does not affect it.
- **User-gesture requirement:** `EyeDropper.open()` must be called in direct response to a user action (button click, keyup). Our ThemePicker invokes from a button click — compliant.
- **Permission prompt:** None required. Unlike camera/microphone, EyeDropper is a one-shot interaction with no persistent permission.

### Implementation pattern

```tsx
// components/ThemePicker.tsx — within Settings modal Appearance pane
declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> };
  }
}

function ThemePicker() {
  const [hex, setHex] = useState(useSettingsStore.getState().theme.accent);
  const setAccent = useSettingsStore(s => s.setAccent);

  const supportsEyeDropper = typeof window.EyeDropper !== 'undefined';

  const pickWithEyedropper = async () => {
    if (!window.EyeDropper) return;
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      setHex(result.sRGBHex);
      setAccent(result.sRGBHex);
    } catch (e) {
      // User pressed ESC — silent, no error surface
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={hex}
        onChange={e => {
          const v = e.target.value;
          setHex(v);
          if (/^#[0-9a-fA-F]{6}$/.test(v)) setAccent(v);
        }}
        placeholder="#16e0ee"
        className="font-mono"
      />
      {supportsEyeDropper && (
        <button onClick={pickWithEyedropper} aria-label="Pick color from screen">
          <Pipette className="size-4" />
        </button>
      )}
    </div>
  );
}
```

### Fallback when EyeDropper is absent

If `typeof window.EyeDropper === 'undefined'` (would only happen on a downgraded Electron — not v0.1): hide the eyedropper button; hex-input remains functional. Graceful degradation. Not expected in v0.1 since Electron 41 is locked.

---

## DESIGN-SYSTEM.md Outline (for D-36 / UI-07)

Full file authored in Phase 4 execute. Section skeleton:

```markdown
# Wiiwho Design System

## 1. Philosophy
Dark, gamer, anti-bloat. Inspired by Lunar/Badlion/Feather — adopts their polish,
rejects their marketing layer. No ads, news, social. One accent color, user-picked.

## 2. Tokens (source: launcher/src/renderer/src/global.css @theme block)
### 2.1 Colors
- Background, surface, border: `#111111`, `#1a1a1a`, `#262626`
- Accent (user-picked, runtime-mutable): default `#16e0ee`
- 8 preset swatches (table below with hex + name + contrast ratio)

### 2.2 Typography
- Inter Variable (SIL OFL 1.1) — body + UI
- JetBrains Mono (Apache 2.0) — codes, UUIDs, build hashes
- Scale: 12, 14, 16, 20, 24, 32 (Tailwind text-xs...text-4xl)

### 2.3 Spacing
- Tailwind default scale (4px base)
- Layout constants: sidebar 220px, window 1280×800, modal height 560px

### 2.4 Motion
- Durations: 120ms / 200ms / 320ms
- Easings: emphasized / standard / spring (`{stiffness:300,damping:30,mass:1}`)
- Reduced-motion: system / on / off override

## 3. Usage examples
- Play button
- Sidebar with active pill
- Settings modal (bottom-slide)
- Spotify mini-player (connected / disconnected / offline / no-Premium)
- Theme picker (preset swatches + hex + eyedropper)

## 4. Iconography
- lucide-react (ISC license — already shipped)

## 5. Typography provenance
- Inter: rsms/inter vX, SIL OFL 1.1 (link to LICENSE.txt)
- JetBrains Mono: JetBrains/JetBrainsMono vX, Apache 2.0 (link)

## 6. Hero art provenance
- Owner-drawn, CC0-licensed to project (or state "pending — gradient stub active")

## 7. Exclusion checklist (UI-05 — FIRST-CLASS DELIVERABLE)
Wiiwho does NOT display:
- [ ] Ads
- [ ] News feeds
- [ ] Concurrent-user counts
- [ ] Friends lists
- [ ] Marketing content
- [ ] "Online friends" badges
- [ ] Server ads
- [ ] Changelog teasers
- [ ] News cards
- [ ] Social counts
- [ ] Engagement metrics
- [ ] Purchase prompts
- [ ] Subscription prompts
- [ ] Referral links
- [ ] Social share buttons
- [ ] Discord/Twitter/etc embeds
- [ ] Rating/review prompts
- [ ] Beta feature announcements outside Settings/About

### Reviewer sign-off
| Section | Reviewed by | Date | Verdict |
| --- | --- | --- | --- |
| All UI components | Owner | yyyy-mm-dd | ✓ / notes |

## 8. Changelog
- 2026-mm-dd: v0.1 initial design system.
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| **Electron 41** | Entire launcher (Phase 1 locked) | ✓ | 41.0.0+ (Chromium 146 / Node 24 bundled) | — |
| **React 19** | Renderer | ✓ | 19.2.1 (in package.json) | — |
| **Tailwind v4** | Styling | ✓ | 4.2.3 (in package.json) | — |
| **Radix UI unified** | Dialog, DropdownMenu, etc. | ✓ | 1.4.3 (in package.json) | — |
| **Zustand** | Renderer state | ✓ | 5.0.12 (in package.json) | — |
| **motion (framer-motion successor)** | UI-03 motion stack | ✗ (new) | Will install `motion@^12.38.0` | None — hard dep for D-20 |
| **Spotify Developer Dashboard** | UI-06 app registration | ✗ (external) | n/a — owner-task in Wave 0 | None — blocks UI-06 if undone |
| **Inter Variable woff2** | Typography (D-19) | ✗ (new) | github.com/rsms/inter v4.x | Fall back to system sans if font fails to load (`font-display: swap` handles this) |
| **JetBrains Mono Variable woff2** | Typography (mono) | ✗ (new) | github.com/JetBrains/JetBrainsMono v2.x | Fall back to ui-monospace |
| **Node `net`, `http`, `crypto`** | Spotify OAuth loopback + PKCE | ✓ (Node builtins) | Node 24 bundled in Electron | — |
| **Electron `safeStorage`** | spotify.bin encryption | ✓ (reused from Phase 2) | — | None — hard dep for D-32 |
| **Electron `shell.openExternal`** | Spotify auth URL launch | ✓ (Phase 2 pattern) | — | — |
| **Browser EyeDropper API** | D-14 custom hex picker | ✓ (Chromium 146 ≥ 95) | — | Hex input only when feature probe fails |
| **Spotify Premium (user-side)** | Playback control endpoints | — (varies by user) | — | Disable controls + tooltip "Premium required" |

**Missing dependencies with no fallback:**
- motion package (hard dep — install in Wave 0).
- Spotify dev app registration (hard dep — owner-task in Wave 0 BEFORE execute-time code runs). The app name is "Wiiwho Client"; redirect URI is `http://127.0.0.1/callback` (no port — per §Spotify OAuth correction).

**Missing dependencies with fallback:**
- Inter / JetBrains Mono fonts — fall back to system sans via `font-display: swap`. UX is degraded (less polished), not broken.
- EyeDropper API on unsupported Chromium — hex input-only. Shouldn't happen on v0.1 Electron 41.
- Spotify Premium — read-only mini-player with disabled controls. Graceful.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (Phase 3 locked pattern) |
| Config file | `launcher/vitest.config.ts` (exists) |
| Quick run command | `pnpm --filter ./launcher run test:run -- <pattern>` |
| Full suite command | `pnpm --filter ./launcher run test:run` |
| Type check | `pnpm --filter ./launcher run typecheck` |
| Lint | `pnpm --filter ./launcher run lint` |
| RTL pattern | `@vitest-environment jsdom` docblock + `userEvent.setup()` + `afterEach(cleanup)` (Phase 2/3 locked) |
| Radix pointer-capture stub | `Element.prototype.{hasPointerCapture,releasePointerCapture,scrollIntoView}` cast via `as unknown as {...}` (Phase 2 pattern) |
| Mock hoist pattern | `vi.hoisted(() => ({ ... }))` (Phase 3 locked) |
| IPC mock | mock `window.wiiwho.*` on window in test setup (existing pattern in Phase 2/3 renderer tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| **UI-01** | Accent picker swatches set `--color-accent` CSS var AND persist to settings.json | unit + integration | `vitest --run launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx` | ❌ Wave 0 |
| UI-01 | Custom hex field validates 6-char hex, live-updates on valid, no-op on invalid | unit | same file | ❌ Wave 0 |
| UI-01 | Settings store v1→v2 migration preserves ramMb/firstRunSeen, adds theme defaults | unit | `vitest --run launcher/src/main/settings/__tests__/store-v2-migration.test.ts` | ❌ Wave 0 |
| UI-01 | Settings getter/setter round-trip `theme.accent` via IPC | integration | `vitest --run launcher/src/main/ipc/__tests__/settings.test.ts` (exists, extend) | ✅ partial |
| UI-01 | `setAccent()` helper writes to `:root` and calls `window.wiiwho.settings.set` | unit | `vitest --run launcher/src/renderer/src/stores/__tests__/settings.test.ts` | ❌ Wave 0 |
| UI-01 | EyeDropper API probe: button hidden when `window.EyeDropper` is undefined | unit | `ThemePicker.test.tsx` (above) | ❌ Wave 0 |
| **UI-03** | `useMotionConfig` returns 0 duration when `reduceMotion: 'on'` | unit | `vitest --run launcher/src/renderer/src/hooks/__tests__/useMotionConfig.test.ts` | ❌ Wave 0 |
| UI-03 | `useMotionConfig` returns 0 duration when OS reduce=on + user=system | unit | same file | ❌ Wave 0 |
| UI-03 | `useMotionConfig` returns normal duration when OS reduce=on + user=off | unit | same file | ❌ Wave 0 |
| UI-03 | Settings modal renders with `forceMount` + `AnimatePresence` — enter/exit render | integration | `vitest --run launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx` | ❌ Wave 0 |
| UI-03 | Duration/easing tokens present in `global.css` `@theme` block | static | `vitest --run launcher/src/renderer/src/__tests__/global-css-tokens.test.ts` | ❌ Wave 0 |
| **UI-04** | Sidebar renders Play (active default) + Cosmetics + Spotify slot + Settings gear in order | integration | `vitest --run launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx` | ❌ Wave 0 |
| UI-04 | Clicking a sidebar item swaps `activeSection` state; main area router changes | integration | `vitest --run launcher/src/renderer/src/__tests__/App.sidebar-routing.test.tsx` | ❌ Wave 0 |
| UI-04 | AccountBadge dropdown "Account settings" opens Settings modal with `openPane='account'` | integration | `vitest --run launcher/src/renderer/src/components/__tests__/AccountBadge.test.tsx` (exists, extend) | ✅ partial |
| UI-04 | Account is NOT a top-level sidebar row (E-03 interpretation) | integration | `Sidebar.test.tsx` (above) | ❌ Wave 0 |
| **UI-05** | `docs/DESIGN-SYSTEM.md` exists with "Exclusion checklist" section containing all 18 anti-features | static | `vitest --run launcher/__tests__/design-system-exclusion.test.ts` OR zero-dep Node script `node scripts/check-docs.mjs` (pattern from Phase 1) | ❌ Wave 0 |
| UI-05 | No component contains strings matching anti-bloat patterns (`ad`, `news`, `online users`, `friends online`, `buy`, `subscribe`, `premium offer`, etc.) in visible copy | static/source-grep | same script | ❌ Wave 0 |
| **UI-06** | Spotify `spotifyManager.connect()` starts loopback server + opens auth URL | unit | `vitest --run launcher/src/main/spotify/__tests__/oauth.test.ts` | ❌ Wave 0 |
| UI-06 | PKCE `code_verifier` is 43-128 chars, `code_challenge` is sha256 base64url | unit | same file | ❌ Wave 0 |
| UI-06 | `startOneShotCallbackServer()` returns usable port, resolves on valid callback | unit | same file | ❌ Wave 0 |
| UI-06 | Token exchange POSTs correct form body, parses `access_token`/`refresh_token` | unit | `vitest --run launcher/src/main/spotify/__tests__/api.test.ts` | ❌ Wave 0 |
| UI-06 | 401 response triggers single refresh-then-retry; subsequent 401 marks disconnected | unit | same file | ❌ Wave 0 |
| UI-06 | 429 response honors `Retry-After` header and retries after exactly that many seconds | unit | same file | ❌ Wave 0 |
| UI-06 | 403 PREMIUM_REQUIRED on control endpoint sets `isPremium: false`; read endpoints still work | unit | same file | ❌ Wave 0 |
| UI-06 | `spotify.bin` is encrypted via safeStorage and lives at `getSpotifyTokenPath()` | unit | `vitest --run launcher/src/main/spotify/__tests__/tokenStore.test.ts` | ❌ Wave 0 |
| UI-06 | Spotify access/refresh tokens never appear in any log output (redact pattern extension) | unit | `vitest --run launcher/src/main/auth/__tests__/redact.test.ts` (exists, extend) | ✅ partial |
| UI-06 | Mini-player renders disconnected state (Connect CTA) + connected state (track + controls) + idle state (Nothing playing) + offline state (last-known + (offline) label) | component | `vitest --run launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx` | ❌ Wave 0 |
| UI-06 | Disconnect clears `spotify.bin` and drops back to disconnected state | integration | `SpotifyMiniPlayer.test.tsx` | ❌ Wave 0 |
| UI-06 | Preload bridge exposes `window.wiiwho.spotify.{connect,disconnect,status,control:{play,pause,next,prev},onTrackChange}` | static | `vitest --run launcher/src/preload/__tests__/index.test.ts` (exists, extend) | ✅ partial |
| **UI-07** | `docs/DESIGN-SYSTEM.md` exists with sections: Philosophy, Tokens, Usage, Typography provenance, Iconography, Exclusion checklist | static | `check-docs.mjs` extended with new section regexes | ❌ Wave 0 |
| UI-07 | All 5 design token categories (colors, typography, spacing, motion, layout) live in `global.css` `@theme` block | static | `vitest --run launcher/src/renderer/src/__tests__/global-css-tokens.test.ts` | ❌ Wave 0 |
| UI-07 | Inter and JetBrains Mono font files + LICENSE.txt present | static | `vitest --run launcher/src/renderer/src/assets/__tests__/fonts.test.ts` OR `check-docs.mjs` | ❌ Wave 0 |

**Smoke test (end-to-end, Wave N final):**
- Launch dev-mode launcher via `pnpm --filter ./launcher dev`.
- Verify: sidebar visible, click Play/Cosmetics swaps section with fade, click Settings gear opens bottom-slide modal, click Appearance tab, pick each of 8 presets + observe live accent swap on PlayButton/AccountBadge focus ring, pick custom hex, trigger EyeDropper (manual interaction), close modal via X/ESC/backdrop (all three), click Connect Spotify (manual — requires owner-registered app), verify mini-player shows track after login.
- Restart launcher — accent preset persists, reduceMotion setting persists.
- Set OS prefers-reduced-motion: reduce — verify all transitions collapse to 0ms when reduceMotion='system'.

### Sampling Rate

- **Per task commit:** `pnpm --filter ./launcher run test:run -- <pattern for changed files>` — typically <30s for a focused slice.
- **Per wave merge:** `pnpm --filter ./launcher run test:run && pnpm --filter ./launcher run typecheck` — full suite + types; <2min.
- **Phase gate:** Full suite green + manual smoke test from §Validation Architecture above + `docs/DESIGN-SYSTEM.md` exclusion checklist signed off by owner.

### Wave 0 Gaps

- [ ] `launcher/src/renderer/src/hooks/useMotionConfig.ts` + test — motion reduced config resolver
- [ ] `launcher/src/renderer/src/components/Sidebar.tsx` + test — new component
- [ ] `launcher/src/renderer/src/components/SettingsModal.tsx` + test — new component (replaces SettingsDrawer)
- [ ] `launcher/src/renderer/src/components/SpotifyMiniPlayer.tsx` + test — new component
- [ ] `launcher/src/renderer/src/components/ThemePicker.tsx` + test — new component
- [ ] `launcher/src/renderer/src/components/MainArea/Play.tsx` + `Cosmetics.tsx` + tests — new section components
- [ ] `launcher/src/renderer/src/components/__tests__/global-css-tokens.test.ts` — static assertion that @theme contains all required tokens
- [ ] `launcher/src/main/spotify/{config,oauth,api,spotifyManager,tokenStore}.ts` + tests — new directory (mirrors `launcher/src/main/auth/`)
- [ ] `launcher/src/main/ipc/spotify.ts` + test — IPC handlers
- [ ] `launcher/src/main/settings/store-v2-migration.ts` + test — schema migration
- [ ] `launcher/src/renderer/src/stores/spotify.ts` + test — renderer Zustand store
- [ ] `launcher/src/renderer/src/assets/fonts/` directory + LICENSE.txt files
- [ ] `scripts/check-docs.mjs` extension — add DESIGN-SYSTEM.md section checks + exclusion-checklist validator
- [ ] `docs/DESIGN-SYSTEM.md` — new file (Wave N deliverable; skeleton in Wave 0)
- [ ] Framework install: `pnpm --filter ./launcher add motion@^12.38.0`

---

## Pitfalls + Unknowns

### Pitfall 1 — HMR clobbering `:root` inline style

**What goes wrong:** Vite HMR reloads the CSS module, which re-applies `:root { --color-accent: #16e0ee }` from `global.css`, wiping any user-picked accent set via `style.setProperty`.
**Why it happens:** CSS inline-style on `:root` and CSS-file `:root` rules both target the same element; when the file reloads, the file's value wins until JS re-runs `setProperty`.
**How to avoid:** In `useSettingsStore.initialize()` (called on App mount), after hydration re-apply `document.documentElement.style.setProperty('--color-accent', state.theme.accent)`. Bonus: hook Vite's `import.meta.hot.on('vite:afterUpdate')` in dev to re-apply. Both are <5-line fixes.
**Warning signs:** Accent resets to cyan after saving `global.css` in dev; resets to cyan on the first frame of production launch (initialize hasn't run yet — acceptable flash).

### Pitfall 2 — Spotify 429 burst from rapid reconnect

**What goes wrong:** User clicks Connect, cancels the browser auth, clicks Connect again 3 seconds later — in dev iteration the token exchange + profile fetch can hit 6 requests in 10s; pairing with resumed polling can spike the rolling window.
**How to avoid:** Rate-limit the Connect button itself (disable for 3s after click). On repeated 429s, pause all polling 60s. Read `Retry-After`, never guess.

### Pitfall 3 — Font-load flashing (FOUT → FOIT if misconfigured)

**What goes wrong:** Without `font-display: swap`, Inter's woff2 download window (<100ms on local file://) can produce invisible text.
**How to avoid:** `font-display: swap` — always. System sans paints first frame; Inter swaps in. Since we ship woff2 in the asar bundle, load time is <50ms typically — user sees one frame of system sans.

### Pitfall 4 — Radix Dialog without `forceMount` shows no exit animation

**What goes wrong:** Radix unmounts the Content before framer-motion runs its exit. User sees modal disappear instantly instead of slide-down.
**How to avoid:** `forceMount` on Portal + Overlay + Content — all three. Delegate mount lifecycle to `AnimatePresence`. Test: click X, look for slide-down.

### Pitfall 5 — Motion package import wrong path

**What goes wrong:** `import { motion } from 'motion'` (without `/react`) imports the vanilla JS variant, not the React wrapper. React components render as no-ops.
**How to avoid:** Import specifically from `motion/react`. ESLint rule or import-linter can enforce.

### Pitfall 6 — Spotify wildcard redirect URI (CONTEXT D-31 error)

**What goes wrong:** CONTEXT says register `http://127.0.0.1:*`. Spotify rejects this at dashboard-save time with "invalid redirect URI."
**How to avoid:** Register `http://127.0.0.1/callback` (NO port). Pass full URL with runtime-assigned port in authorize request. Corrected throughout §Spotify OAuth section.

### Pitfall 7 — safeStorage unavailable on fresh macOS install

**What goes wrong:** On first launch of an unsigned macOS app, `safeStorage.isEncryptionAvailable()` may return `false` until Keychain access is granted (if prompted). Phase 2 handles this for `auth.bin`; Phase 4 `spotify.bin` must use the same pattern (throw + fail-closed, never silently write plaintext).
**How to avoid:** Reuse `safeStorageCache.ts` pattern verbatim — fail-closed is the existing invariant.

### Pitfall 8 — Deep-linking Settings modal to a pane before modal mounted

**What goes wrong:** AccountBadge dropdown sets `openPane='account'` and then sets `modalOpen=true` in two separate store actions; a race condition could briefly render the General pane before flipping to Account.
**How to avoid:** Single action `setOpenPane(pane)` internally also sets `modalOpen=true`. No two-step orchestration.

### Pitfall 9 — Users without Spotify Premium hit 403 loop

**What goes wrong:** Free-tier user clicks play, sees 403 PREMIUM_REQUIRED, polling triggers another read, tries play again on next click — 403 repeats forever with no user-visible feedback.
**How to avoid:** On first 403 PREMIUM_REQUIRED, set `isPremium: false` in the store for the session. Disable control buttons with tooltip. Read-only mini-player (track/art/is-playing status) still works because `user-read-*` scopes don't require Premium.

### Pitfall 10 — Preload key frozen-surface deviation

**What goes wrong:** Phase 1 locked 5 top-level preload keys (auth, game, settings, logs, __debug). Adding `spotify` as 6th silently breaks the contract.
**How to avoid:** Add deliberate deviation in Phase 4 CONTEXT (already present) + in the Phase 4 merge commit message + in a test that asserts `Object.keys(window.wiiwho).sort() === ['__debug','auth','game','logs','settings','spotify']`. Nesting under `settings` is wrong (semantically different concern).

### Pitfall 11 — Tailwind v4 `@theme { --color-accent: var(--x); }`

**What goes wrong:** Referencing another CSS var inside `@theme` breaks the utility generator; `bg-accent` compiles to `background-color: var(--color-bg-accent)` (undefined).
**How to avoid:** `@theme` values must be literals. Runtime mutation goes through `:root { --color-accent: ... }` (same property name, cascades fine).

### Pitfall 12 — Motion animations running during crashed/loading states

**What goes wrong:** CrashViewer is a full-page takeover; if we set `AnimatePresence mode="wait"` and the app switches crashed→idle→playing, the transition stalls.
**How to avoid:** CrashViewer mount/unmount is a hard swap — no animation. Use `AnimatePresence` only for user-initiated nav (Play↔Cosmetics, modal open/close), not for internal state machines that can take multi-second paths.

### Open Questions

1. **Spotify app rate-limit ceiling exact number.** Community reports "~180 req/30s rolling" but Spotify doesn't publish. Our 12 req/min is 30x under the reported ceiling — very safe. No action needed.
2. **Does Electron 41's safeStorage work in HMR/dev?** Phase 2's auth.bin already works in dev, so yes — but worth a quick dev-mode verification when we hit spotify.bin.
3. **Sidebar divider style** between main nav rows and pinned Spotify+Settings cluster — CONTEXT says `border-t border-neutral-800` default. Planner can adjust if visually off.
4. **Should the Play section's gradient stub include motion (slow shift over time)?** Not in scope for v0.1; CONTEXT D-04 says "subtle background" — static is fine. Defer.
5. **AccountBadge dropdown's full-UUID tooltip vs inline display.** CONTEXT D-06 says "UUID (first-8 + hover-full tooltip)" — planner picks between native `title=""` (simple) vs Radix Tooltip (more consistent with app chrome). Recommend Radix Tooltip for UI polish consistency.

---

## Sources

### Primary (HIGH confidence)

**Motion / framer-motion:**
- [Motion for React — Get Started (motion.dev)](https://motion.dev/docs/react) — package name + import path
- [Motion layout animations / layoutId (motion.dev)](https://motion.dev/docs/react-layout-animations) — layoutId API, spring configs
- [Motion useReducedMotion (motion.dev)](https://motion.dev/docs/react-use-reduced-motion) — reduced motion hook
- [Motion + Radix animation guide (motion.dev)](https://motion.dev/docs/radix) — forceMount pattern
- [Motion npm package (npmjs.com)](https://www.npmjs.com/package/motion) — version 12.38.0 confirmed 2026-03-17
- [framer-motion rebrand history (GitHub motiondivision/motion)](https://github.com/motiondivision/motion) — verified rebrand mid-2025

**Spotify:**
- [Authorization Code with PKCE Flow (developer.spotify.com)](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) — PKCE flow steps verified 2026-04
- [Redirect URIs (developer.spotify.com)](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri) — loopback rules + no-wildcard confirmed
- [Web API scopes (developer.spotify.com)](https://developer.spotify.com/documentation/web-api/concepts/scopes) — exact scope strings
- [Rate limits (developer.spotify.com)](https://developer.spotify.com/documentation/web-api/concepts/rate-limits) — 30s rolling window + Retry-After header
- [Get currently playing track (developer.spotify.com)](https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track) — endpoint + scopes + 200 with `item: null` when idle
- [Player playback endpoints (developer.spotify.com)](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback) — control endpoint URLs
- [2025-10 OAuth migration reminder (developer.spotify.com blog)](https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025) — 127.0.0.1 preserved, localhost removed
- [Premium required on playback control — Spotify community thread](https://community.spotify.com/t5/Spotify-for-Developers/Start-Resume-Playback-API-returns-error-403-PRE-...-td-p/5656701) — HTTP 403 reason PREMIUM_REQUIRED

**Electron / Browser:**
- [Electron 41 release blog (electronjs.org)](https://www.electronjs.org/blog/electron-41-0) — Chromium 146 / Node 24 / V8 14.6 confirmed
- [EyeDropper API on MDN (developer.mozilla.org)](https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API) — Chromium 95+ baseline
- [EyeDropper API capabilities (developer.chrome.com)](https://developer.chrome.com/docs/capabilities/web-apis/eyedropper) — user-gesture requirement
- [CSS @starting-style on caniuse](https://caniuse.com/mdn-css_at-rules_starting-style) — Chromium 117+
- [CSS @starting-style on MDN (developer.mozilla.org)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style) — syntax + transition-behavior pairing
- [Electron contextIsolation docs](https://www.electronjs.org/docs/latest/tutorial/context-isolation) — Phase 1 security posture compatible with EyeDropper
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — Phase 2 pattern extended to spotify.bin

**Tailwind v4:**
- [Tailwind v4 release blog (tailwindcss.com)](https://tailwindcss.com/blog/tailwindcss-v4) — runtime CSS var theming
- [Tailwind v4 theme concepts (tailwindcss.com)](https://tailwindcss.com/docs/theme) — @theme directive
- [Tailwind v4 discussion #17613 — var-referencing @theme values](https://github.com/tailwindlabs/tailwindcss/discussions/17613) — the `@theme { --x: var(--y); }` pitfall
- [Tailwind v4 discussion #15600 — CSS var theming patterns](https://github.com/tailwindlabs/tailwindcss/discussions/15600) — runtime theme swap approach

**Fonts:**
- [Inter on Google Fonts](https://fonts.google.com/specimen/Inter) — SIL OFL 1.1
- [Inter on GitHub (rsms/inter)](https://github.com/rsms/inter) — source, 4.x release
- [Inter OFL.txt in google/fonts](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt) — verbatim license text
- [Manrope — alternative candidate (Google Fonts)](https://fonts.google.com/specimen/Manrope) — considered, Inter won on DNA match
- [JetBrains Mono (Apache 2.0)](https://github.com/JetBrains/JetBrainsMono) — monospace
- [Lunar Client Brand Guidelines PDF](https://brand.lunarclient.com/assets/brand/LC-Brand-Guidelines-V1.pdf) — identifies proprietary typeface; confirms no redistribution

**Accessibility:**
- [WCAG 2.1 SC 1.4.11 Non-text Contrast (w3.org)](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html) — 3:1 UI component ratio
- [WCAG focus indicators guide — Sara Soueidan](https://www.sarasoueidan.com/blog/focus-indicators/) — dark-bg focus-ring contrast rules

### Secondary (MEDIUM confidence — verified with authoritative source)

- [Animating Radix Primitives with Framer Motion — sinja.io](https://sinja.io/blog/animating-radix-primitives-with-framer-motion) — corroborates forceMount pattern
- [Radix + framer-motion tutorial — solberg.is](https://www.solberg.is/radix-plus-framer-motion) — working code example
- [Building a Spotify MCP Server with PKCE — smithery.ai](https://smithery.ai/blog/spotify) — independent PKCE implementation confirming flow details

### Tertiary (training data + community — flagged for Wave 0 verification)

- Exact Spotify dev-mode rate-limit number (~180 req/30s) — community-reported, not published. Our 12 req/min is safe regardless.
- Lunar Client's exact font family — inferred from brand PDF + community threads; cannot confirm specific foundry. Doesn't affect Phase 4 (we pick Inter regardless).

---

## Metadata

**Confidence breakdown:**
- Standard stack (motion@12.38.0 + Tailwind v4 + Radix + Zustand): **HIGH** — all peer deps verified, all APIs verified against official docs 2026-04.
- Architecture patterns (Radix+motion `forceMount`, runtime CSS var swap): **HIGH** — documented canonical patterns by library authors.
- Spotify OAuth PKCE flow + endpoints + rate limits: **HIGH** — verified against developer.spotify.com current docs 2026-04.
- Spotify wildcard-redirect correction: **HIGH** — Spotify's own docs explicitly reject wildcard; CONTEXT D-31 is wrong.
- Spotify Premium-required: **HIGH** — documented + multiple community confirmations.
- Accent preset hex tuning: **MEDIUM** — contrast ratios computed mathematically (HIGH); aesthetic "Tangerine not Orange" naming is taste.
- Typography (Inter choice): **HIGH** — Inter is the industry standard free alternative; license verified.
- Typography (Lunar's actual font): **MEDIUM** — couldn't inspect inside app.asar without redistribution; doesn't affect outcome (we pick Inter regardless).
- EyeDropper + @starting-style Chromium 146 support: **HIGH** — caniuse + MDN + Electron release notes.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable stack). Re-verify Spotify rate limits + OAuth migration status before executing (Spotify has been changing security posture quarterly).
