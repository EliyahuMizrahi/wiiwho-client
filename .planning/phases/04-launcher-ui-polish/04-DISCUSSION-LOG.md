# Phase 4: Launcher UI Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 04-launcher-ui-polish
**Areas discussed:** Sidebar nav + migration, Theme + design tokens, Motion system, Spotify mini-player UX

---

## Gray-area selection

| Area | Selected |
|------|----------|
| Sidebar nav + migration | ✓ |
| Theme + design tokens | ✓ |
| Motion system | ✓ |
| Spotify mini-player UX | ✓ |

---

## Sidebar nav + migration

### Q1: Sidebar form factor

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed icon + label (220px) | Always expanded, pinned left. Icon + label per section. Lunar/Badlion style. Simpler to implement. | ✓ |
| Collapsible rail (64 ↔ 220px) | User can toggle. Remembers state across restarts. Discord/Spotify style. | |
| Icon-only rail (64px) | Maximally compact, icon-only with tooltip. Tidal-style. | |

### Q2: Play-section main-area content

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (Phase 3 vibe) | Centered Play button + wordmark + version only. | |
| Play + version card | Small card with MC version + last-launched timestamp. | |
| Play + art/atmosphere | Large background art (cape/monogram/atmosphere) + Play front-and-center + version footer. | ✓ |

### Q3: Account badge placement after sidebar migration

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom of sidebar only | Skin head + username anchored to sidebar bottom with dropdown. | |
| Top-right only (keep Phase 2) | Phase 2 D-13 unchanged; account badge stays top-right. | ✓ |
| Both — sidebar bottom + top-right | Redundant but signals presence everywhere (Badlion style). | |

### Q4: Fate of the Settings slide-in drawer

| Option | Description | Selected |
|--------|-------------|----------|
| Retire drawer — Settings = sidebar section only | Delete SettingsDrawer; sidebar Settings navigates to a full main-area view. | |
| Keep drawer AND add Settings section | Dual access paths. | |
| Convert drawer to a 'quick settings' popover | Drop full drawer, replace with small popover for most-used toggles. | ✓ |

**Notes:** User later changed this via Q7 (Lunar-style bottom-slide modal).

### Q5 (follow-up): Source of the Play-section background art

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-drawn hero image | Owner produces bitmap; Phase 4 stubs CSS gradient until asset lands. | ✓ |
| CSS-only gradient + logo watermark | No bitmap asset at all. | |
| CSS gradient now, swap to art later | Ship gradient, deferred idea for hero art v1. | |

### Q6 (follow-up): Fate of the gear icon now that Settings is a sidebar section

| Option | Description | Selected |
|--------|-------------|----------|
| Remove gear icon | Settings is sidebar-only; top-right shows just AccountBadge. | ✓ |
| Keep gear — opens quick-settings popover | Gear keeps the popover concept. | |
| Move gear into sidebar header/footer | Hybrid placement. | |

### Q7 (follow-up): Cosmetics sidebar section content in v0.1

| Option | Description | Selected |
|--------|-------------|----------|
| 'Coming soon' empty state | Polished empty state with illustration + 1-line subtext. | ✓ |
| Cape preview + toggle stub | Shows placeholder cape art + disabled toggle. | |
| Hide from sidebar entirely | Breaks UI-04 literal reading. | |

### Q8 (follow-up): Active/hover visual treatment for sidebar nav items

| Option | Description | Selected |
|--------|-------------|----------|
| Accent-color pill + left bar | Tinted pill bg + 2-3px left accent bar. | ✓ |
| Left accent bar only | Just a 3px left bar; no bg pill. Minimal Lunar. | |
| Bg pill only (no bar) | Tinted pill only. Discord/Spotify. | |

### Q9 (reconciliation): Popover trigger with gear icon removed

| Option | Description | Selected |
|--------|-------------|----------|
| Drop the popover — sidebar Settings is the only path | Cleanest; deletes SettingsDrawer. | |
| Popover triggered from sidebar Settings row | Right-click / long-press opens popover. | |
| Popover triggered from the Account dropdown | Co-locates affordances top-right. | |
| Other (user freeform) | **"Just like in Lunar Client, in the sidebar there is a settings gear icon that when clicked on makes a modal pop with the modal sliding in from the bottom and when closed it slides down and fades out."** | ✓ |

**Notes:** Superseded Q4 and Q6 answers. Canonical outcome: **Settings is a gear pinned at the sidebar bottom (separated from Play/Cosmetics); click opens a bottom-slide-up modal; close slides down + fades out.** SettingsDrawer.tsx is deleted; bottom-slide modal (new `SettingsModal.tsx`) replaces it.

### Q10 (follow-up): Settings gear position in sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned at sidebar bottom, separated | Play/Cosmetics top + divider + Settings gear anchored at bottom. | ✓ |
| In the main nav list (alongside Play/Cosmetics/Account) | Just another row. | |
| Pinned at sidebar bottom, with Account | Bottom cluster of gear + Account badge. | |

### Q11 (follow-up): Bottom-slide Settings modal height

| Option | Description | Selected |
|--------|-------------|----------|
| Full-height (covers viewport except sidebar) | Max real estate. Lunar-exact. | |
| Partial-height (~70% viewport) | Dimmed strip above hints at dismiss-by-backdrop-click. | ✓ |
| Content-sized (grows to fit) | Modal height adapts to content. | |

### Q12 (follow-up): 'Account' as a sidebar nav section

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — keep Account section in sidebar | Main area for Account shows richer view. | |
| No — collapse Account into top-right dropdown only | Drops Account from sidebar. Risks failing UI-04 literal reading. | |
| Yes, but hide until v0.2 | Deviate from UI-04 explicitly. | |
| Other (user freeform) | **"It should still stay in the top right as a collapsible list thing but in the collapsible list thing there should be an Account settings button that takes them into the Settings modal Account section; there should also be a sign-out option."** | ✓ |

**Notes:** Account remains top-right (Phase 2 D-13 preserved); dropdown adds "Account settings" (deep-links to Settings modal → Account tab) and "Sign out." Account is not a top-level sidebar row. UI-04 interpreted as satisfied by Account living inside the Settings modal's internal nav.

### Q13 (follow-up): Settings modal internal navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Left sub-sidebar inside the modal | Vertical list (General, Account, Appearance, Spotify, About) on the left; right panel switches. | ✓ |
| Top tab bar inside the modal | Horizontal tabs. | |
| Single long scrollable page with section headers | macOS System Settings style. | |

---

## Theme + design tokens

### Q14: Accent preset count + palette

| Option | Description | Selected |
|--------|-------------|----------|
| 3 presets: cyan, green, purple | Tight. Cyan default. | |
| 5 presets: cyan, green, purple, orange, pink | Wider variety. Lunar-ish. | |
| 8 presets: full rainbow + greyscale | Cyan/green/purple/orange/pink/red/yellow/gray. | ✓ |

### Q15: Custom hex input UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hex input + live preview | Simplest. | |
| Hex input + live preview + contrast warning | WCAG-aware. | |
| Hex input + eyedropper + preview | EyeDropper API + live preview. | ✓ |

### Q16: Light mode visual treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Off-white with elevated cards | Warm Mac System Settings feel. | |
| Pure white, flat | Figma/Linear style. | |
| Off-white with strong separators (no shadows) | Minimalist. | |
| Other (user freeform) | **"I don't want a light mode at all."** | ✓ |

**Notes:** Triggered UI-02 drop via Q17.

### Q17: UI-02 (light mode) fate

| Option | Description | Selected |
|--------|-------------|----------|
| Drop UI-02 entirely — dark-only is v0.1 truth | Edit REQUIREMENTS.md + ROADMAP.md SC1. | ✓ |
| Defer UI-02 to v0.2+ | Move to v2 Requirements. | |
| Keep UI-02, ship a minimal light mode anyway | Not recommended. | |

**Notes:** Triggered requirement edits E-01 (drop UI-02 from REQUIREMENTS.md) and E-02 (remove dark/light toggle reference from ROADMAP.md Phase 4 SC1).

### Q18: Design token architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind v4 @theme CSS vars (single source) | Everything in global.css @theme; runtime accent swap via :root style. | ✓ |
| @theme for statics + tokens.ts for JS-side values | Split colors (CSS) from motion values (JS). | |
| Separate tokens.css file + @theme import | Separate file for reusability. | |

### Q19 (follow-up): Accent application surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Primary button + focus rings + active nav + progress | Targeted application. | ✓ |
| Above + links + headings + skin-head outline | More vivid. | |
| Above + subtle tinted backgrounds | Fully themed; risks overwhelming with bright presets. | |

### Q20 (follow-up): Typography — system sans vs bundled font

| Option | Description | Selected |
|--------|-------------|----------|
| Keep system sans (SF Pro / Segoe UI) | Phase 1 D-12 default. | |
| Bundle Inter (modern, neutral) | Self-host Inter. | |
| Bundle a gaming display font + Inter for body | Two-font system. | |
| Other (user freeform) | **"Can we use whatever Lunar Client or Badlion Client uses?"** | ✓ |

**Notes:** Captured as research task in CONTEXT.md D-19 — researcher identifies Lunar/Badlion fonts and picks a free alternative (e.g., Inter, Manrope, Satoshi) if the originals are commercial-licensed.

---

## Motion system

### Q21: Motion framework

| Option | Description | Selected |
|--------|-------------|----------|
| CSS-only (transitions + keyframes + @starting-style) | No added dep. | |
| framer-motion (motion.dev) | ~50KB; orchestrated sequences, gestures. | |
| Hybrid: CSS for primitives, framer-motion for complex flows | CSS for hover/focus; framer-motion for modal/routes. | ✓ |

### Q22: Duration tokens

| Option | Description | Selected |
|--------|-------------|----------|
| 3 tokens: fast/med/slow = 120ms / 200ms / 320ms | Linear-style, snappy. | ✓ |
| 4 tokens: instant/fast/med/slow = 80ms / 150ms / 250ms / 400ms | Apple HIG-style. | |
| 2 tokens: fast/slow = 150ms / 300ms | Maximum simplicity. | |

### Q23: Easing curves

| Option | Description | Selected |
|--------|-------------|----------|
| 2 curves: emphasized + standard | Material-ish minimal. | |
| 3 curves: emphasized + standard + spring | Adds spring for playful micro-interactions. | ✓ |
| Single curve: ease-out | Homogenous but defensible. | |

### Q24: Phase 4 motion scope

| Option | Description | Selected |
|--------|-------------|----------|
| Core set | Settings modal slide, sidebar nav active, button hover, fade on section swap, progress bar, device-code modal fade. | ✓ |
| Core + shared-element accent morph on theme change | Adds animated accent color transition. | |
| Core + page-transition choreography + skin-head idle animation | Adds richer transitions + idle breathing. | |

### Q25 (follow-up): Reduced-motion handling

| Option | Description | Selected |
|--------|-------------|----------|
| Respect the OS setting | Standard a11y. | |
| Add an in-app override setting + respect OS default | Settings modal toggle with System/On/Off. | ✓ |
| Ignore the preference — motion is always on | Not recommended (WCAG 2.1). | |

---

## Spotify mini-player UX

### Q26: Mini-player location when connected

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned at bottom of sidebar | Compact block above Settings gear. | ✓ |
| Bottom bar spanning full launcher width | Dedicated 72px bar. | |
| Dedicated sidebar section with full-main-area player | Music section with full player. | |

### Q27: What shows when Spotify is NOT connected

| Option | Description | Selected |
|--------|-------------|----------|
| Compact 'Connect Spotify' CTA in the mini-player slot | Always-discoverable. | ✓ |
| Hidden entirely when disconnected | Less noise but less discoverable. | |
| Hidden by default; user opts in via Settings | Two-step gating. | |

### Q28: Spotify controls

| Option | Description | Selected |
|--------|-------------|----------|
| Play/pause + skip next + skip previous + current track label | UI-06 literal minimum. | ✓ |
| Above + volume slider + track progress bar | More functional. | |
| Above + shuffle/repeat toggles | Full player. | |

### Q29: OAuth mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| PKCE + loopback redirect (127.0.0.1:<port>) | Modern desktop standard. | ✓ |
| PKCE + custom protocol handler (wiiwho://spotify-callback) | Requires setAsDefaultProtocolClient. | |
| Device authorization grant (like MS device code flow) | User types code at spotify.com/pair. | |

### Q30 (follow-up): Spotify app registration + token storage

| Option | Description | Selected |
|--------|-------------|----------|
| Owner registers a Spotify dev app; client ID in source; tokens in safeStorage (spotify.bin) | Standard desktop PKCE pattern. | ✓ |
| Per-user client ID — user registers their own app | High friction. | |
| WiiWho-hosted OAuth proxy | Out of v0.1 scope (no backend). | |

### Q31 (follow-up): Idle state (Spotify open, nothing playing)

| Option | Description | Selected |
|--------|-------------|----------|
| 'Nothing playing' placeholder | Icon + text + disabled play button. | ✓ |
| Last-played track with disabled controls | Shows previous track as paused. | |
| Collapsed to just icon + 'Open Spotify' | Saves vertical space. | |

### Q32 (follow-up): 'Disconnect Spotify' location

| Option | Description | Selected |
|--------|-------------|----------|
| Settings modal → Spotify section only | Single canonical location. | |
| Right-click / dropdown on the mini-player + Settings section | Dual access. | ✓ |
| Mini-player has a visible tiny icon (e.g., unplug) | Discoverable but risks accidental disconnects. | |

---

## Claude's Discretion

Areas where Claude / researcher / planner have latitude (full list in CONTEXT.md `<decisions>` § Claude's Discretion):

- Exact hex values for the 7 non-cyan accent presets
- Lunar Client / Badlion Client font identification (research task)
- Hero art delivery timeline
- Cosmetics "Coming soon" illustration (stylized SVG fallback until owner draws a cape)
- Settings modal width vs sidebar clickability
- Sidebar nav pill glide animation details (framer-motion `layoutId` config)
- Section route swap direction (fade, slight slide, both)
- Spotify polling cadence (recommend 5s focused / 15s backgrounded)
- Spotify `get-port` vs native `net.createServer({port:0})` for loopback redirect
- Eyedropper fallback on unsupported platforms (should be a non-issue in Electron 41)
- Custom-hex validation micro-UX (silent invalid vs red border)
- framer-motion version pinning
- DESIGN-SYSTEM.md screenshot sourcing
- AccountBadge dropdown visual ordering
- Sidebar divider styling
- Spotify mini-player context-menu trigger (right-click vs visible chevron)
- Framer-motion prefers-reduced-motion integration (hook vs global config)
- Radix Dialog vs custom modal for bottom-slide Settings
- Accent persistence across dev-mode HMR
- Spotify album-art caching
- Motion on Cosmetics empty state (default static)

## Deferred Ideas

See CONTEXT.md `<deferred>` section for the full list. Highlights:

- Light mode (UI-02 dropped)
- Contrast warning on custom hex
- Sidebar collapsible rail
- Account as standalone sidebar row or main-area surface
- Spotify volume / progress / shuffle / repeat / seek / playlist
- Spotify Web Playback SDK (embedded playback)
- Alternative music services (Apple Music, YouTube Music, SoundCloud)
- Figma MCP integration
- Hero art bitmap delivery
- Shared-element accent-morph animation
- Page-transition choreography + skin-head idle animation
- Drag-to-reorder sidebar sections
- In-app font-size / high-contrast presets
- Keyboard shortcut system
- Multi-window support
- Electron menu bar customization
- Spotify exponential backoff tuning
