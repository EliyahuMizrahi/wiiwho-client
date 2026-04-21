# Phase 2: Microsoft Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 02-microsoft-authentication
**Areas discussed:** Login & session lifecycle, Error surfacing (XSTS + network), Logged-in state + logout + storage schema

Areas NOT discussed (reserved for Claude's Discretion): Device code display UX.

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Login screen & session lifecycle | Login placement, silent refresh behavior, first-run UX | ✓ |
| Device code display UX | Modal vs inline, copy button, auto-open browser, timer, cancel path | |
| Error surfacing (XSTS + network) | Banner vs modal vs toast, action design, message mapping | ✓ |
| Logged-in state + logout + storage schema | Account UI, logout flow, storage schema shape | ✓ |

**User's choice:** Login & session lifecycle; Error surfacing; Logged-in state + logout + storage

---

## Login screen & session lifecycle

### Q1: Login screen's relationship to the Play button

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen login takeover (Recommended) | Logged-out: entire window is login card. Logged-in: reveal Play-forward + account badge corner. Matches Lunar. | ✓ |
| Play-forward with disabled Play | Same layout always, Play shows "Log in to play". Less modal, more discoverable. | |
| Modal over Play screen | Keep Play-forward even when logged out; popup modal on login click. Preserves hero aesthetic. | |

**User's choice:** Full-screen login takeover
**Notes:** None

### Q2: Launcher-open behavior when refresh token exists

| Option | Description | Selected |
|--------|-------------|----------|
| Silent refresh, loading spinner (Recommended) | Try getMinecraftJavaToken silently; spinner during; on success reveal Play, on failure drop to login. | ✓ |
| Show last username, one-click re-login | Cache username; "Welcome back, <name>" with Continue button. One extra click. | |
| Always show Log In screen | No silent refresh; user clicks every time. Simplest, but adds friction. | |

**User's choice:** Silent refresh, loading spinner
**Notes:** None

### Q3: Silent refresh failure on launcher open

| Option | Description | Selected |
|--------|-------------|----------|
| Drop to login screen silently (Recommended) | No error; clear stale token; user sees normal login. Quietest UX. | ✓ |
| Inline banner then login screen | Dismissible "Session expired" banner. Useful signal once; alarming if frequent. | |
| Distinguish network vs auth | Network → retry banner; auth → silent drop. More correct, more branches. | |

**User's choice:** Drop to login screen silently
**Notes:** None

### Q4: Login screen content

| Option | Description | Selected |
|--------|-------------|----------|
| Just logo + button + version (Recommended) | Logo + "Log in with Microsoft" button + "v0.1.0-dev". Matches Lunar/Badlion sparseness. | ✓ |
| Add a 'Why Microsoft?' tooltip link | Explains Mojang auth EOL to first-timers. | |
| Add an anticheat-safe badge/line | "Safe on Hypixel, BlocksMC, Minemen, etc." Reassures PvP audience. | |
| Just logo + button, no version | Absolute minimum. Version in Settings. | |

**User's choice:** Just logo + button + version
**Notes:** None

### Q5: Login button style

| Option | Description | Selected |
|--------|-------------|----------|
| Cyan accent (Wiiwho brand) (Recommended) | Same cyan #16e0ee as Phase 1 Play button. | ✓ |
| Microsoft brand-compliant button | White + MS logo + "Sign in with Microsoft". More recognizable, off-brand vs launcher. | |
| Dark button with Microsoft logo on left | Dark neutral-800 + MS logo. Compromise. | |

**User's choice:** Cyan accent (Wiiwho brand)
**Notes:** None

### Q6: Device-code expiry behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-close modal, return to login screen (Recommended) | Silent close on expiry; user clicks Log in again for fresh code. | |
| Show 'Code expired, try again' message in modal | Modal stays open, content swaps to "Code expired" + "Generate new code" button. | ✓ |
| Auto-retry with new code, user unaware | Silently request + swap. Most magical; masks real failures. | |

**User's choice:** Show "Code expired, try again" message in modal
**Notes:** User wants the expiry to be visible to the user once before the code is refreshed — not silently auto-retried.

### Q7: Cancel during device-code wait

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel button in modal (Recommended) | Cancel button + ESC key. Stops polling, closes modal, returns to login. | ✓ |
| No cancel — wait for expiry | Non-dismissable until success/error/expiry. Simpler state machine. | |
| Cancel via window close only | Close launcher is the only escape. Rare. | |

**User's choice:** Cancel button in modal
**Notes:** None

---

## Error surfacing (XSTS + network)

### Q1: Where does an auth error surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on login screen, under the button (Recommended) | Red banner under login button; persistent; dismissible. | ✓ |
| Modal dialog over login screen | Blocks UI until dismissed. Heavy. | |
| Toast notification | Top-right, auto-dismiss ~8s. Missable. | |

**User's choice:** Inline on login screen, under the button
**Notes:** None

### Q2: What actions appear on an auth error?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry + Help link (Recommended) | "Try again" + Help link to error-specific doc (xbox.com signup, MS Family, etc). | ✓ |
| Retry only | Just "Try again". User figures out the fix. | |
| Retry + Copy details | Retry + "Copy error details" for bug reports to owner. | |
| Retry + Help + Copy details | All three. UI gets busy. | |

**User's choice:** Retry + Help link
**Notes:** None

### Q3: MS account doesn't own Minecraft

| Option | Description | Selected |
|--------|-------------|----------|
| Same error pattern, distinct message (Recommended) | Inline banner with "doesn't own Minecraft Java Edition" + Help link to purchase page. | ✓ |
| Dedicated screen with purchase CTA | Full-screen "You need Minecraft Java Edition" + big Buy button. Separates account vs product issues. | |
| Same error pattern, no purchase link | Inline banner + Retry only. Minimum effort. | |

**User's choice:** Same error pattern, distinct message
**Notes:** None

### Q4: Network failures

| Option | Description | Selected |
|--------|-------------|----------|
| Same inline banner, distinct message + Retry (Recommended) | Inline "Can't reach Microsoft" + Retry. Token NOT cleared. Reuses UI pattern. | ✓ |
| Distinct network-problem banner with auto-retry | Yellow + spinner; auto-retries every 5s + Cancel. Harder on transient hiccups. | |
| Same banner, no auto-retry | Identical red banner; manual retry. Simplest. | |

**User's choice:** Same inline banner, distinct message + Retry
**Notes:** None

---

## Logged-in state + logout + storage schema

### Q1: Where does the logged-in user badge live?

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right corner avatar + dropdown (Recommended) | Small circular skin-head + dropdown with username, UUID, Log out. Matches Lunar/Badlion/Feather. | ✓ |
| Bottom-left account strip | Permanent strip bottom-left: head + username + Logout. No dropdown. More screen real estate. | |
| Top banner above Play | Horizontal strip at top. Eats premium hero space. | |

**User's choice:** Top-right corner avatar + dropdown
**Notes:** None

### Q2: What data appears in the logged-in badge?

| Option | Description | Selected |
|--------|-------------|----------|
| Skin head + username (Recommended) | Skin head from minotar.net/etc + username next to it. UUID in dropdown. | ✓ |
| Generic avatar + username | Wiiwho monogram + username. No third-party call. Less friendly. | |
| Username only | Text only. Minimum effort. Boring. | |
| Skin head + username + short UUID visible | Shows UUID always. Overkill for v0.1. | |

**User's choice:** Skin head + username
**Notes:** None

### Q3: Logout location + confirm

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar dropdown, no confirm (Recommended) | Dropdown item; instant clear + drop to login. Cheap to reverse. | ✓ |
| Avatar dropdown, with confirm dialog | "Log out? You'll need to sign in again." Safer for fat fingers. | |
| In Settings screen (Phase 3) + avatar dropdown | Mirrored in both places. Some duplication. | |

**User's choice:** Avatar dropdown, no confirm
**Notes:** None

### Q4: Storage schema shape

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-account array, one active now (Recommended) | `{ version, activeAccountId, accounts: [{ id, refreshToken, username, lastUsed }] }`. v0.1 enforces length 1. v0.3 zero-migration. | ✓ |
| Single-account flat schema (YAGNI) | `{ version, refreshToken, username, uuid }`. Cleaner for v0.1. v0.3 writes a migration. | |
| Just the refresh token (no metadata) | Only the encrypted token; re-fetch username/UUID every launch. Zero staleness. | |

**User's choice:** Multi-account array, one active now
**Notes:** None

---

## Claude's Discretion

- **Device code display UX** — user opted not to discuss this area. Claude will design a modal with: large centered user-code (monospace), Copy-to-clipboard button, "Open in browser" button (Electron `shell.openExternal` on the `verification_uri`), countdown timer until expiry, Cancel button.
- **Avatar service endpoint choice** — researcher picks (minotar.net / crafatar.com / mc-heads.net / Mojang session server).
- **Skin-head local cache path + invalidation policy** — planner decides.
- **Silent-refresh-on-launch minimum spinner duration / fallback timeout** — planner decides.
- **Background token refresh cadence on the Play-forward screen** — planner decides (proactive vs on-demand).
- **Main-process auth state machine internals** — implementation detail beneath the frozen IPC surface.
- **Game-ownership verification path** (profile fetch vs entitlements) — researcher confirms.

## Deferred Ideas

See `02-CONTEXT.md` `<deferred>` section — all captured there.
