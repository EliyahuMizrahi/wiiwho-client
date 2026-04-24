---
phase: 04
slug: launcher-ui-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (established in Phase 2/3; jsdom environment, Radix pointer-capture stubs, `userEvent.setup()` pattern) |
| **Config file** | `launcher/vite.config.ts` (vitest block) + `launcher/vitest.setup.ts` |
| **Quick run command** | `cd launcher && pnpm vitest run <path>` |
| **Full suite command** | `cd launcher && pnpm vitest run` |
| **Estimated runtime** | ~30-45 seconds (existing suite ~20s; Phase 4 adds motion/theme/spotify tests) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <co-located .test.ts>` (quick — single file)
- **After every plan wave:** Run `pnpm vitest run` (full suite)
- **Before `/gsd:verify-work`:** Full suite green + manual launcher smoke on Windows
- **Max feedback latency:** 45 seconds (full) / 3 seconds (single-file)

---

## Per-Task Verification Map

> Populated by gsd-planner during Step 8. Every task MUST map to either an automated vitest command or a Wave 0 stub, OR a manual verification row below with a stated reason.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD by planner | — | — | UI-01..UI-07 | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts` — stubs for UI-01 (accent persistence, v1→v2 migration)
- [ ] `launcher/src/renderer/src/stores/__tests__/spotify.test.ts` — stubs for UI-06 (connection state machine, polling lifecycle)
- [ ] `launcher/src/main/spotify/__tests__/oauth.test.ts` — stubs for PKCE flow + loopback server teardown + 403 PREMIUM_REQUIRED path
- [ ] `launcher/src/main/spotify/__tests__/api.test.ts` — stubs for 401-refresh-once + 429 backoff + offline-graceful
- [ ] `launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx` — stubs for UI-01 (preset click, hex input validation, EyeDropper fallback)
- [ ] `launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx` — stubs for UI-04 (sidebar renders Play + Cosmetics + Settings + Spotify slot; no Account row, no ads/news/friends markup)
- [ ] `launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx` — stubs for bottom-slide modal + sub-sidebar pane deep-link
- [ ] `launcher/src/renderer/src/components/__tests__/SpotifyMiniPlayer.test.tsx` — stubs for disconnected / connecting / connected / idle / offline / free-tier states
- [ ] `launcher/src/renderer/src/test/motion.test.ts` — stubs for UI-03 (reduced-motion resolver — System / On / Off → 0ms transitions)
- [ ] `launcher/src/renderer/src/test/antiBloat.test.tsx` — grep-style test for UI-05 exclusion checklist (no "friends" / "news" / "ad" / "online users" strings in rendered tree)
- [ ] Add `motion@^12.38.0` to `launcher/package.json` (hard dep per RESEARCH §Motion Stack)
- [ ] Add Inter Variable + JetBrains Mono woff2 fonts to `launcher/src/renderer/src/assets/fonts/` (SIL OFL + Apache 2.0 licensed per RESEARCH §Typography)
- [ ] Register Spotify dev app under owner's account (external, manual, Wave 0 owner-task); paste client ID into `launcher/src/main/spotify/config.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings modal slide-up visual feel | UI-03 | Timing/easing judged by eye; unit tests verify tokens applied, not animation smoothness | Launch dev launcher → click Settings gear → observe slide-up from bottom, ~320ms, emphasized easing. Close via X + ESC + backdrop — all three dismissals animate correctly. |
| Accent color swap visual feel across all surfaces | UI-01 | Cross-surface consistency is perceptual | Launch → Settings → Appearance → cycle all 8 presets + enter custom hex `#ff00aa`. Verify: Play button bg, focus rings (Tab through buttons), active sidebar pill, modal sub-nav pill, progress bar fill all use the new accent. Body text/headings do NOT. |
| Sidebar nav pill glide between Play ↔ Cosmetics | UI-03 | Layout animation `layoutId` smoothness judged by eye | Launch → click Cosmetics → click Play → repeat. Pill + left-bar glide smoothly (~200ms) between rows; no flash or pop. |
| EyeDropper picks a color from screen | UI-01 (D-14) | Native browser API; requires user interaction | Launch → Settings → Appearance → Custom → click eyedropper button → pick a color anywhere on screen → hex field updates + accent applies live. |
| Spotify PKCE flow end-to-end | UI-06 | External OAuth with real Spotify account + browser | Click "Connect Spotify" → system browser opens authorize page → log in → redirect to loopback → launcher shows connected account name. Verify `%APPDATA%/Wiiwho/spotify.bin` exists + is encrypted. |
| Spotify mini-player updates on track change | UI-06 | Requires real Spotify account + active playback on another device/app | Connect → start playback in Spotify desktop → within 5s launcher shows track title + artist + album art. Press next on phone → launcher album-art crossfades to new track within 5s. |
| Spotify mini-player graceful offline | UI-06 | Requires network disruption | Connect → start playback → disable network → within ~5s launcher shows "(offline)" label next to track title; no error modal. Re-enable network → polling resumes. |
| Free-tier 403 PREMIUM_REQUIRED handling | UI-06 (RESEARCH-added) | Requires free-tier Spotify account | Connect a free-tier account → try to click play/pause → buttons disabled with tooltip "Spotify Premium required for playback control". Track display (title/artist/art) still works. |
| Disconnect Spotify from mini-player context menu | UI-06 (D-33) | Requires visual verification of context menu layout | Right-click mini-player → "Open Spotify app" + "Disconnect" visible → click Disconnect → slot returns to "Connect Spotify" CTA. |
| Reduced-motion OS setting respected | UI-03 (D-24) | Requires toggling OS accessibility setting | Enable Windows "Show animations in Windows" = off (or macOS Reduce Motion). Launch → Settings = System → all transitions = instant. Switch override to Off → transitions return. |
| UI-05 anti-bloat compliance (full launcher walkthrough) | UI-05 | Gestalt check — no ad/news/social UI anywhere | Walk every screen (Login, Play, Cosmetics, Settings all 5 panes, Spotify mini-player connected + disconnected, Crash viewer, Loading). Cross-reference docs/DESIGN-SYSTEM.md exclusion checklist. Sign off row-by-row. |
| Hero art gradient stub renders correctly until asset lands | UI-04 (D-04) | Visual placeholder | Play section shows gradient from `--color-accent` 10% alpha to `--color-wiiwho-bg`; Play button + wordmark legible on top. |
| Design system doc completeness | UI-07 | Doc-review, not code-checkable | `docs/DESIGN-SYSTEM.md` has all D-36 sections + screenshots of Play / Settings modal / Spotify mini-player / Theme picker. |
| macOS smoke (if Mac hardware available) | UI-01..UI-07 | Mac-specific rendering (font smoothing, safeStorage keychain prompt, system sans fallback) | Load + verify all 8 presets, Settings modal slide, Spotify PKCE flow. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (populated by planner)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (motion dep, fonts, Spotify dev app, test stubs)
- [ ] No watch-mode flags (all vitest invocations use `run`, not `watch`)
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter after plan-checker passes

**Approval:** pending
