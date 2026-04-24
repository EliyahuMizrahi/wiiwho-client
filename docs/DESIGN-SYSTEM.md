# Wiiwho Design System

Last updated: 2026-04-24 (Phase 4 — Launcher UI Polish)

## 1. Philosophy

Dark, gamer, anti-bloat. Inspired by Lunar Client, Badlion, and Feather —
adopts their polish, rejects their marketing layer. One user-picked accent
color. Zero ads, news, or social surfaces. The launcher's job is to get you
into Minecraft faster with the HUD you want; it is not an engagement surface.

Three non-negotiables govern every design decision in this phase:

- **Accent is the only brand color.** No hardcoded cyan anywhere in the tree
  — every colored pixel routes through `var(--color-accent)` (runtime-mutable)
  or a neutral/semantic token. The owner picks the accent; the rest of the UI
  inherits.
- **Motion must be intentional.** Three canonical durations (120 / 200 /
  320 ms), two CSS easings, one spring. No ad-hoc `transition-all`. Reduced-
  motion mode collapses every animation to 0 ms without branching component
  code.
- **Empty states are honest.** Cosmetics renders "Coming soon" with zero
  interactive elements. No "notify me," no fake-engagement buttons, no
  placeholders that pretend to be real.

## 2. Tokens

Source of truth: `launcher/src/renderer/src/global.css` `@theme` block.
JS-side mirrors live in `launcher/src/renderer/src/theme/{presets.ts,motion.ts}`.
When CSS and JS must agree (e.g., `motion/react` takes numbers, not
`var()` strings), both files document the mirror relationship inline.

### 2.1 Colors

| Token                              | Value             | Purpose                                      |
|------------------------------------|-------------------|----------------------------------------------|
| `--color-wiiwho-bg`                | `#111111`         | Base background                              |
| `--color-wiiwho-surface`           | `#1a1a1a`         | Raised surfaces (modal, sidebar)             |
| `--color-wiiwho-border`            | `#262626`         | 1px dividers                                 |
| `--color-accent` (runtime-mutable) | default `#16e0ee` | Primary CTA, focus rings, active sidebar pill |

Accent presets (8 total — all WCAG 2.1 SC 1.4.11 Non-text Contrast ≥3:1
vs `#111111`):

| Preset                | Hex        | Contrast |
|-----------------------|------------|----------|
| Cyan (default — D-13) | `#16e0ee`  | 11.1:1   |
| Mint                  | `#22c55e`  | 8.6:1    |
| Violet                | `#a855f7`  | 5.6:1    |
| Tangerine             | `#f97316`  | 7.8:1    |
| Pink                  | `#ec4899`  | 6.2:1    |
| Crimson               | `#f87171`  | 7.4:1    |
| Amber                 | `#fbbf24`  | 11.2:1   |
| Slate                 | `#cbd5e1`  | 11.6:1   |

> **Note:** Preset names and hexes reflect RESEARCH-tuned values; D-13 listed Red/Yellow/Gray as illustrative starting points. RESEARCH retuned those three slots to Crimson (`#f87171`), Amber (`#fbbf24`), and Slate (`#cbd5e1`) to meet WCAG 2.1 SC 1.4.11 Non-text Contrast ≥3:1 against `--color-wiiwho-bg` (`#111111`). See `launcher/src/renderer/src/theme/presets.ts` for the authoritative tuple.

### 2.2 Typography

- **Inter Variable** (SIL OFL 1.1) — body + UI. Self-hosted woff2 at
  `launcher/src/renderer/src/assets/fonts/inter/`.
- **JetBrains Mono Variable** (SIL OFL 1.1) — device codes, UUIDs, build
  hashes. Self-hosted woff2 at
  `launcher/src/renderer/src/assets/fonts/jetbrains-mono/`.
- Both declared with `font-display: swap` (Pitfall 3 — avoids FOIT).
- Scale: Tailwind default (text-xs 12 / text-sm 14 / text-base 16 /
  text-xl 20 / text-2xl 24 / text-4xl 36).

### 2.3 Spacing

Tailwind default 4px-base scale. Layout constants:

| Constant                  | Value                    |
|---------------------------|--------------------------|
| `--layout-sidebar-width`  | 220px                    |
| `--layout-window-width`   | 1280px                   |
| `--layout-window-height`  | 800px                    |
| `--layout-modal-height`   | 560px (70% of viewport)  |

### 2.4 Motion

| Token                | Value                            | CSS consumers                                |
|----------------------|----------------------------------|----------------------------------------------|
| `--duration-fast`    | 120ms                            | Button hover, focus rings                    |
| `--duration-med`     | 200ms                            | Drawer/modal fade, section swap              |
| `--duration-slow`    | 320ms                            | Settings modal slide-up, accent transitions  |
| `--ease-emphasized`  | `cubic-bezier(0.2, 0, 0, 1)`     | Enter/exit (modal, drawer)                   |
| `--ease-standard`    | `cubic-bezier(0.4, 0, 0.2, 1)`   | Swaps, stationary transitions                |

Spring (motion-only, CSS can't express):
`{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }` —
sidebar pill glide, micro-interactions.

Reduced motion: Settings → Appearance → "Reduce motion" with three states
(System / On / Off). Resolution table:

| User override | OS `prefers-reduced-motion` | Result             |
|---------------|-----------------------------|--------------------|
| system        | reduce                      | collapsed to 0ms   |
| system        | no-preference               | normal             |
| on            | any                         | collapsed to 0ms   |
| off           | any                         | normal             |

## 3. Usage examples

- **Play button**: `bg-accent` + `text-wiiwho-bg` + press feedback via
  `transform: scale(0.98)` on `:active`.
- **Sidebar with active pill**: 220px fixed column; active row uses
  `motion.div` with `layoutId="sidebar-nav-pill"` + left accent bar
  `layoutId="sidebar-nav-bar"`. Spring config from `theme/motion.ts`.
- **Settings modal (bottom-slide)**: Radix Dialog + motion/react with
  `forceMount` on Portal + Overlay + Content. Portal unconditionally mounted;
  `AnimatePresence` INSIDE the Portal; `{open && ...}` guard INSIDE
  `AnimatePresence` wraps Overlay + Content. Slide `y: '100%' → 0` over
  `--duration-slow` with `--ease-emphasized`.
- **Theme picker**: 8 preset swatches + custom hex input + EyeDropper button
  (Chromium 146 native). Live `--color-accent` swap on `:root`; persists to
  `settings.json v2`.

## 4. Iconography

- `lucide-react` (ISC license) — already bundled. Icon set for v0.1:
  Play / Shirt / Settings / X / Pipette / ChevronDown / SkipBack /
  Pause / Play (playback) / SkipForward / MoreVertical / ExternalLink /
  Copy / Check / AlertTriangle / FolderOpen / Loader.
- No inline SVGs outside of `lucide-react` imports AND the deliberate
  Cosmetics cape placeholder (short, custom, no interactive surface).

## 5. Typography provenance

| Font                    | Version  | License       | Source                                    | Designer                                  |
|-------------------------|----------|---------------|-------------------------------------------|-------------------------------------------|
| Inter Variable          | 4.x      | SIL OFL 1.1   | https://github.com/rsms/inter             | Rasmus Andersson                          |
| JetBrains Mono Variable | 2.x      | SIL OFL 1.1   | https://github.com/JetBrains/JetBrainsMono | Philipp Nurullin / JetBrains              |

Bundle location: `launcher/src/renderer/src/assets/fonts/{inter,jetbrains-mono}/`.
LICENSE.txt co-located in each font's directory (OFL 1.1 full text).

> JetBrains Mono's original upstream license at acquisition was Apache 2.0;
> subsequent releases re-licensed to SIL OFL 1.1. The bundled version is
> OFL 1.1 and the LICENSE.txt in the font directory reflects the current
> OFL terms — see `docs/DISCUSSION-LOG.md` (Plan 04-00) for the license
> audit record.

## 6. Hero art provenance

v0.1 ships with a CSS gradient stub (linear gradient from `--color-accent`
at 10% alpha to `--color-wiiwho-bg`). The owner-drawn bitmap lands on their
timeline; provenance (CC0 or original) will be recorded here when the
asset arrives. Until then, the gradient is defined in
`launcher/src/renderer/src/components/MainArea/Play.tsx` as an inline
`background-image` so the theme picker retints it for free.

## 7. Exclusion checklist

This checklist enforces UI-05 as a **first-class deliverable**.

**WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content.**

Full enumeration:

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

| Section                                | Reviewed by | Date | Verdict |
|----------------------------------------|-------------|------|---------|
| Login screen                           | —           | —    | —       |
| Play section                           | —           | —    | —       |
| Cosmetics "Coming soon"                | —           | —    | —       |
| Sidebar                                | —           | —    | —       |
| Settings modal — General               | —           | —    | —       |
| Settings modal — Account               | —           | —    | —       |
| Settings modal — Appearance            | —           | —    | —       |
| Settings modal — About                 | —           | —    | —       |
| Crash viewer                           | —           | —    | —       |
| Loading screen                         | —           | —    | —       |

## 8. Changelog

- **2026-04-24** — v0.1 initial design system. 8 accent presets, 3 motion
  durations, 2 CSS easings + 1 spring, Inter + JetBrains Mono typography,
  Radix + motion/react component primitives, Theme picker + Settings modal
  shipped. UI-05 Exclusion checklist authored;
  `launcher/src/renderer/src/test/antiBloat.test.tsx` enforces the banned-
  pattern grep in CI.
