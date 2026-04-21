# Phase 3: Vanilla Launch, JRE Bundling & Packaging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 03-vanilla-launch-jre-bundling-packaging
**Areas discussed:** Home/Settings layout, Launch flow UX, Crash viewer + redaction, Packaging + game data dir

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Home/Settings layout | Where Play, RAM slider, crash/log entry points, settings live on Play-forward screen | ✓ |
| Launch flow UX | Download progress, log tail, cancellation, failure surfacing, handoff to game | ✓ |
| Crash viewer + redaction | LAUN-05 + COMP-05 UI and sanitizer scope | ✓ |
| Packaging + game data dir | Mac arch, Win installer format, game data path, JRE bundling | ✓ |

**User's choice:** All four selected.

---

## Home / Settings Layout

### Q1 — Where does the Settings surface live?

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-in right drawer | Gear icon top-right opens a Radix Sheet with RAM/game-dir/about; Play-forward stays visible underneath. Lunar-ish. (Recommended) | ✓ |
| Full-screen Settings page | Gear navigates to a dedicated /settings route; Back returns. Badlion-ish. More room, heavier transition. | |
| Inline bottom strip | Settings controls live directly on Home as a collapsible bottom strip. Fastest path; busier Home. | |

**User's choice:** Slide-in right drawer.
**Notes:** Matches Lunar pattern; keeps Home-screen minimal.

### Q2 — Where does the RAM slider appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings only | RAM lives inside the Settings drawer with G1GC tooltip; Home stays minimal. (Recommended) | ✓ |
| Home + Settings | Compact RAM readout on Home + detailed slider in Settings. | |
| Home only | Full slider on Home, no Settings-based duplicate. | |

**User's choice:** Settings only.

### Q3 — How are launch logs / past-crash reports surfaced when idle?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings-adjacent link | 'Logs' + 'Crash reports' items inside the Settings drawer; hidden from Home. (Recommended) | ✓ |
| Bottom-strip buttons | Small 'Logs' / 'Crashes' buttons persistently docked on Home. | |
| Only on demand | No entry points; log appears only during launch, crash viewer only on crash. | |

**User's choice:** Settings-adjacent link.

### Q4 — What else on the idle Home screen?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — nothing else | Just Play + account + version + gear. (Recommended) | ✓ |
| Status strip | Bottom strip 'Ready • 1.8.9 • 2 GB' — passive status. | |
| Changelog tease | 'What's new in v0.1.0-dev' card/link. | |

**User's choice:** Minimal — nothing else.

### Q5 — RAM slider range and steps?

| Option | Description | Selected |
|--------|-------------|----------|
| 1–4 GB, 512 MB steps | 7 positions. Default 2 GB. (Recommended) | ✓ |
| 1–4 GB, 1 GB steps | Only 1/2/3/4 GB. Coarser. | |
| 512 MB – 4 GB, 256 MB steps | 15 positions. Overkill for v0.1. | |

**User's choice:** 1–4 GB, 512 MB steps.

### Q6 — Game-dir override in Settings?

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden in v0.1 | Default path hardcoded; no UI to change it. (Recommended) | ✓ |
| Read-only display | Show path + 'Open in Explorer' button, no change. | |
| Fully editable | Input + folder picker + warning. Needs migration logic. | |

**User's choice:** Hidden in v0.1.

### Q7 — How does the Settings drawer dismiss?

| Option | Description | Selected |
|--------|-------------|----------|
| X + ESC + click-outside | Any of three gestures closes it. (Recommended) | ✓ |
| X + ESC only | Click-outside ignored; prevents accidental close. | |

**User's choice:** X + ESC + click-outside.

### Q8 — G1GC tooltip delivery?

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible helper text | One-line caption under slider. (Recommended) | |
| Info icon → Radix Tooltip on hover | Small (i) icon with hover reveal. | |
| Both | Short caption always visible + info icon for longer explanation. | ✓ |

**User's choice:** Both.

---

## Launch Flow UX

### Q1 — On Play click, how does Home transition?

| Option | Description | Selected |
|--------|-------------|----------|
| Play button becomes status | Cyan button stays in place; label morphs 'Downloading 42%…' → 'Starting Minecraft…' → 'Playing' (disabled). (Recommended) | ✓ |
| In-place progress panel | Play button hides; progress panel with phase + bar + Cancel takes its spot. | |
| Full-screen takeover | Dedicated launching view replaces Home entirely. | |

**User's choice:** Play button becomes status.

### Q2 — How detailed is the download progress view?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase + percent only | 'Downloading libraries… 42%' / 'Verifying…' etc. One label + one bar. (Recommended) | ✓ |
| Phase + MB downloaded | Adds 'X MB / Y MB' under the bar. | |
| Per-file live list | Scrolling list of recent files. Dev-feel, noisier. | |

**User's choice:** Phase + percent only.

### Q3 — Launch log tail visibility?

| Option | Description | Selected |
|--------|-------------|----------|
| Only on failure | No log tail on happy path; surfaces only on launch failure. (Recommended) | ✓ |
| Collapsible 'Show log' panel | Toggle reveals scrolling tail. Off by default. | |
| Always-visible mini-tail | Small 3-5 line rolling tail always visible under progress bar. | |

**User's choice:** Only on failure.

### Q4 — When MC main menu opens, what does launcher do?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimize to taskbar | Launcher minimizes; stays running to watch process. (Recommended) | ✓ |
| Close to tray/dock icon | Launcher hides entirely; tray icon remains. | |
| Stay open + visible | Launcher stays as-is. | |
| Quit entirely | Launcher quits; breaks LAUN-05 crash viewer. | |

**User's choice:** Minimize to taskbar.

### Q5 — Can user cancel a launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel during download, not after | Cancel link during Downloading/Verifying only; disappears at 'Starting Minecraft…'. (Recommended) | ✓ |
| Cancel at any time | Remains until main menu; kills JVM if needed. | |
| No cancel — fire and forget | Simpler; worst UX on slow networks. | |

**User's choice:** Cancel during download, not after.

### Q6 — On network failure during download?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-retry 3x then surface | Each failing file gets 3 retries with backoff, then Retry button. (Recommended) | ✓ |
| Immediate fail, manual retry | First failure surfaces immediately. | |
| Infinite auto-retry | Keeps retrying until success or user cancels. | |

**User's choice:** Auto-retry 3x then surface.

### Q7 — Cached-launch path — show download-style phases?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip to 'Starting Minecraft…' | No Downloading/Verifying labels when cache valid. (Recommended) | ✓ |
| Show 'Verifying…' briefly | Cache validation phase labeled even when it passes. | |

**User's choice:** Skip to 'Starting Minecraft…'.

### Q8 — How does launcher know 'main menu reached'?

| Option | Description | Selected |
|--------|-------------|----------|
| Log-line pattern match | Parse stdout for known 1.8.9 line; fires once → minimize. Deterministic. (Recommended) | ✓ |
| Timer-based | After N seconds of JVM-alive without exit. | |
| JVM-alive heartbeat | As soon as JVM confirmed alive and emits stdout. | |

**User's choice:** Log-line pattern match.

---

## Crash Viewer + Redaction

### Q1 — What triggers the crash viewer?

| Option | Description | Selected |
|--------|-------------|----------|
| Non-zero exit + crash-report file | JVM exits != 0 AND file appears in game/crash-reports/. (Recommended) | ✓ |
| Any non-zero exit | Every non-zero exit; uses captured stdout+stderr even without crash-report file. | |
| Exit-during-launch only | Only if JVM dies before main-menu pattern fires. | |

**User's choice:** Non-zero exit + crash-report file.

### Q2 — How does the crash viewer appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Launcher restores + takeover view | Launcher un-minimizes; Home replaced by full 'Crash detected' view. (Recommended) | ✓ |
| OS notification + inline banner | Native notification + banner on Home. | |
| Modal over Home | Radix Dialog on top of Home screen. | |

**User's choice:** Launcher restores + takeover view.

### Q3 — What actions does the crash viewer offer?

| Option | Description | Selected |
|--------|-------------|----------|
| Copy + Open folder + Close + Play again | Four buttons covering the small-group debug loop. (Recommended) | ✓ |
| Copy + Close only | Minimal two-button set. | |
| Copy + Open folder + Close + Play + Report bug | Adds GitHub issue integration. | |

**User's choice:** Copy + Open folder + Close + Play again.

### Q4 — Redaction scope?

| Option | Description | Selected |
|--------|-------------|----------|
| JWTs + MC token + OS username | Reuse Phase 2 redact.ts; extend for MC access token + Windows/macOS username paths. (Recommended) | ✓ |
| Above + UUID + IP + hostnames | More defensive; may over-redact useful context. | |
| Above + file paths with Wiiwho/ | Also normalize Wiiwho/ absolute paths. | |

**User's choice:** JWTs + MC token + OS username.

---

## Packaging + Game Data Dir

### Q1 — macOS build targets?

| Option | Description | Selected |
|--------|-------------|----------|
| arm64 + x64 (Universal DMG) | Single Universal installer with both JREs bundled. (Recommended) | ✓ |
| arm64 only | ~70 MB smaller; no Intel Mac support. | |
| Separate arm64 + x64 DMGs | Two downloads; 'which one do I pick' friction. | |
| x64 only + Rosetta | Rosetta risks on anticheat-sensitive code; Lunar moved away. | |

**User's choice:** arm64 + x64 (Universal DMG).

### Q2 — Windows installer format?

| Option | Description | Selected |
|--------|-------------|----------|
| NSIS installer only | Single 'Wiiwho Client Setup.exe'; writes to %LOCALAPPDATA%/Programs/Wiiwho/. (Recommended) | ✓ |
| Portable ZIP only | Extract-and-run, no install, no registry. | |
| Both NSIS + portable ZIP | Ship both; doubles CI artifact count. | |

**User's choice:** NSIS installer only.

### Q3 — Game data directory layout?

| Option | Description | Selected |
|--------|-------------|----------|
| %APPDATA%/Wiiwho/game/… | Nested under Wiiwho root beside auth.bin. (Recommended) | ✓ |
| %APPDATA%/Wiiwho/minecraft/… | Named 'minecraft' instead. Familiar; slight confusion with vanilla .minecraft. | |
| Separate root ~/.wiiwho/ or %APPDATA%/.wiiwho-game/ | Like Lunar's ~/.lunarclient; doubles backup/wipe surface. | |

**User's choice:** %APPDATA%/Wiiwho/game/…

### Q4 — JRE bundling?

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled in installer (extraResources) | Offline install works; installer larger. (Recommended per JRE-01/02 + SC4) | ✓ |
| Downloaded on first launch | Smaller installer; fails offline; violates SC4. | |

**User's choice:** Bundled in installer (extraResources).

---

## Claude's Discretion

Items held under Claude's latitude for research/planning:

- SHA1-mismatch recovery UX details (transition animation + status label wording)
- First-run welcome dialog (likely none; planner may propose a pinned hint)
- Installer display name wording (`Wiiwho Client Setup.exe` vs `Wiiwho Setup.exe`)
- Exact stdout pattern for main-menu detection (researcher picks from 1.8.9 startup log)
- Progress bar aesthetic (determinate vs indeterminate segments, smoothing)
- Settings drawer width + animation duration
- Windows uninstaller behavior re: `%APPDATA%/Wiiwho/` retention
- Temurin 8 JRE source (Adoptium CDN at build time vs vendored binaries)
- Launcher log retention policy (electron-log defaults)
- p-queue download concurrency (stay at 8)
- `@xmcl/core` vs `@xmcl/installer` feature split
- Crash viewer color scheme (reuse ErrorBanner red + neutral body)
- Reconnect-on-launcher-reopen-while-game-running (likely no in v0.1)
- Mac unsigned-installer right-click-Open workaround doc location

---

## Deferred Ideas

Captured for future phases — not forgotten.

- Game-directory override UI (deferred past v0.1)
- Per-file download list view (dev-mode; future if asked)
- Always-visible launch log tail (revisit if users ask)
- `Report bug` button + GitHub issue prefill (public-release era)
- Over-redaction (UUID / IP / hostname)
- Changelog tease / news card / server teaser on Home
- Status strip on Home
- Portable Windows ZIP
- Cancel-during-JVM-spawn phase
- First-run welcome dialog
- Reconnect-on-reopen-while-game-alive
- Separate arm64 / x64 macOS installers

Out-of-scope for v0.1 per REQUIREMENTS.md:
- Auto-updater, signed installers, macOS notarization
- Crash uploader / telemetry
- Linux packaging
- Server browser
- Multi-instance / profiles

---
