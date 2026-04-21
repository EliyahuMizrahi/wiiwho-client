---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 08
subsystem: renderer/game-lifecycle
tags: [renderer, zustand, launch-flow, crash-viewer, d-09, d-11, d-13, d-18, d-19, d-21]
requires:
  - 03-00  # Wave-0 infrastructure (shadcn Button, vitest jsdom config)
  - 03-01  # sanitizeCrashReport export (main side — sourced via IPC, not imported here)
provides:
  - useGameStore              # phase machine + IPC subscriptions (renderer)
  - PlayButton                # D-09 morph + D-11 fail UI + D-13 cancel + D-14 retry
  - CrashViewer               # D-18 takeover + D-19 four buttons + D-21 invariant
affects:
  - launcher/src/renderer/src/App.tsx  # will mount CrashViewer on phase.state === 'crashed' (Plan 03-10)
  - window.wiiwho.game.*               # consumes onLog/onExited/onCrashed added by Plan 03-09
tech-stack:
  added: []
  patterns:
    - "Zustand discriminated-union phase machine (mirrors Phase 2 useAuthStore idiom)"
    - "Local type augmentation for IPC methods Plan 03-09 will canonicalize in wiiwho.d.ts"
    - "D-21 single-string invariant: prop drives both <pre> textContent AND clipboard write"
    - "Regression-guard test pattern (readFileSync + negative regex) for architectural invariants"
key-files:
  created:
    - launcher/src/renderer/src/stores/game.ts
    - launcher/src/renderer/src/stores/__tests__/game.test.ts
    - launcher/src/renderer/src/components/PlayButton.tsx
    - launcher/src/renderer/src/components/__tests__/PlayButton.test.tsx
    - launcher/src/renderer/src/components/CrashViewer.tsx
    - launcher/src/renderer/src/components/__tests__/CrashViewer.test.tsx
  modified: []
decisions:
  - "useGameStore keeps unsubs + exitFallbackTimer as MODULE-level state (outside Zustand reactive state) to avoid stale Timeout references on strict-mode double-mount."
  - "Local GameAPIExtensions type augment inside game.ts instead of editing wiiwho.d.ts — Plan 03-09 owns that file; once 03-09 lands, the augment can be deleted in one hunk."
  - "6-second onCrashed fallback window (CRASH_FALLBACK_MS) gives the main-side crash-reports/ watcher — which uses a 5s deadline per RESEARCH §Crash watcher — a 1s margin."
  - "PlayButton yields to CrashViewer by returning null when phase.state === 'crashed' — App.tsx (Plan 03-10) will render CrashViewer as the takeover. PlayButton does NOT attempt to hide-but-stay-mounted; explicit null unmount is cleaner."
  - "D-21 enforced by TWO independent tests: (1) runtime identity assertion — writeText arg === <pre>.textContent — AND (2) source-file grep regression guard forbidding scrub/sanitize/redact imports in CrashViewer.tsx. Either alone could be defeated by a clever future edit; together they form a belt-and-suspenders pairing."
metrics:
  duration: "~15 min"
  completed: "2026-04-21"
  tasks: 3
  files: 6
  tests_added: 28
  tests_green: 28
---

# Phase 3 Plan 08: Renderer Game Lifecycle & Crash Viewer Summary

Renderer-side launch-phase state machine (Zustand) plus the two UI surfaces it drives: the morphing Play button (D-09 happy path + D-11 fail UI) and the full-page CrashViewer (D-18 takeover + D-19 actions + D-21 display-equals-clipboard invariant). All 28 tests passing; zero deviations from the written plan.

## What shipped

| Artifact | Purpose | Tests |
| --- | --- | --- |
| `useGameStore` | Discriminated-union phase machine subscribing to the frozen `window.wiiwho.game` IPC surface; cap-30 log tail; 6-second crash-fallback timer (D-17 inverse). | 11 |
| `PlayButton` | Morphing cyan button: `Play` → `Downloading… %` → `Verifying…` → `Starting Minecraft…` → `Playing` (D-09). Cancel link only during downloading/verifying (D-13). Fail-path renders ErrorBanner-palette alert + 30-line `<pre>` log tail + Retry button (D-11, D-14). Returns `null` on `crashed` to yield the screen to CrashViewer (D-18). | 8 |
| `CrashViewer` | Fixed-position full-page takeover with "Crash detected" header + scrollable sanitized-body `<pre>` + four action buttons: `Copy report`, `Open crash folder`, `Close`, `Play again` (D-19). Clipboard write uses the same string prop that renders in the `<pre>` — the D-21 invariant. Callback-based (Close/Play again/Open crash folder) so App.tsx owns the transitions. | 9 |

## D-21 implementation notes (the single most important thing in this plan)

The invariant — "redacted crash report body shown on screen IS the same string copied to clipboard" — is enforced two independent ways:

**1. Runtime identity assertion** (`CrashViewer.test.tsx` "D-21 invariant"):

```ts
expect(writeText).toHaveBeenCalledWith(body)
const displayed = screen.getByRole('region', { name: /crash report/i }).textContent
expect(writeText.mock.calls[0]![0]).toBe(displayed)
```

The second assertion is the real proof — not just "both paths matched the prop" but "both paths produced the IDENTICAL string at runtime". A future refactor that html-escaped the display but passed the raw prop to the clipboard (or vice versa) would fail this test.

**Clipboard mock approach:** `Object.assign(navigator, { clipboard: { writeText } })` — not `defineProperty`. `Object.assign` mutates the target object in-place which jsdom accepts; `defineProperty` would require `{ configurable: true }` and a getter/setter for the navigator.clipboard slot. The simpler mutation is sufficient because vitest does not preserve navigator across test files.

**2. Regression-guard grep** (same test file, "D-21 regression guard"):

```ts
const src = readFileSync(resolve(__dirname, '..', 'CrashViewer.tsx'), 'utf8')
expect(src).not.toMatch(/from\s+['"][^'"]*redact['"]/)
expect(src).not.toMatch(/\bscrub\b/)
expect(src).not.toMatch(/\bsanitize(CrashReport)?\b/)
expect(src).not.toContain('eyJ')
```

This catches a class of future bugs the runtime test can't: someone imports `sanitizeCrashReport` from `../../main/auth/redact`, applies it in the render path, and accidentally defeats the single-source invariant. The grep fails at CI before the subtle divergence ships.

**Confirmed: CrashViewer.tsx has zero imports from `redact.ts`** — the only string-processing in the component is the pass-through into `<pre>{sanitizedBody}</pre>` and `navigator.clipboard.writeText(sanitizedBody)`. Both paths receive the identical prop.

## Phase-transition edge cases found

- **`onExited(non-zero)` race with `onCrashed`**: The 6-second fallback timer must be cancelled when `onCrashed` arrives, otherwise a late timer fire would overwrite `crashed` back to `failed`. The store explicitly handles this (`if (exitFallbackTimer) clearTimeout(...)` at the top of the onCrashed callback), and Test 7 (`onExited(1) + onCrashed within the 6s window cancels the fail fallback`) asserts this — advancing 10s of fake time after the `onCrashed` push and verifying the phase is still `crashed`.
- **`onStatus('downloading')` arriving after `play()` optimistic set**: The optimistic `play()` sets `{state:'downloading', percent:0, currentFile:''}`. When the authoritative `onStatus('downloading')` fires a tick later, the `onStatus` handler guards with `if (current.state !== 'downloading')` to avoid clobbering a populated `percent`/`currentFile` that `onProgress` may have already supplied.
- **Clean-kill signal exit codes**: `onExited({exitCode: 0 | 130 | 143})` all collapse to `idle` (D-17 silent quit). 130 = POSIX SIGINT, 143 = POSIX SIGTERM — the cancel IPC path resolves to one of these. Windows cancellation uses the same exit-code convention via Node's `subprocess.kill('SIGTERM')` abstraction.

## Tests (28 total, all green)

```
cd launcher && npx vitest run \
  src/renderer/src/stores/__tests__/game.test.ts \
  src/renderer/src/components/__tests__/PlayButton.test.tsx \
  src/renderer/src/components/__tests__/CrashViewer.test.tsx
# → 3 files / 28 tests passed
```

- game.test.ts — 11 tests
- PlayButton.test.tsx — 8 tests
- CrashViewer.test.tsx — 9 tests (one test discovered a subtle helper bug: `??` coalesces `null` to the default, so the "null crashId" test needed an explicit `'crashId' in overrides` check — not a production bug, but documenting for future test-authors.)

## Commits

- `158a4b0` test(03-08): add failing useGameStore tests (RED)
- `54c6bc6` feat(03-08): implement useGameStore phase machine (GREEN)
- `4ce94ec` test(03-08): add failing PlayButton tests (RED)
- `6d5200c` feat(03-08): implement morphing PlayButton (GREEN)
- `0edb292` test(03-08): add failing CrashViewer tests (RED)
- `2f36d48` feat(03-08): implement CrashViewer full-page takeover (GREEN)

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes needed; no CLAUDE.md-driven adjustments. TypeScript types compile for all three new files; the only launcher-level test failure (`src/main/launch/args.test.ts`) is a parallel Wave 2 sibling agent's in-flight RED-phase work, entirely outside this plan's file set (deferred per scope-boundary rule).

## Requirements covered

- **LCH-05** (launcher tracks JVM lifecycle): useGameStore phase machine ✓
- **LCH-07** (log tail surfaces on failure, hidden on happy path): D-11 fail UI in PlayButton ✓
- **LAUN-05** (crash viewer takes over): D-18 CrashViewer full-page takeover ✓
- **COMP-05** (tokens + usernames redacted from crash display AND clipboard): D-21 invariant — display ≡ clipboard contents ✓

## Downstream dependencies (Wave 3+)

- **Plan 03-09** canonicalizes `onLog`/`onExited`/`onCrashed` in `wiiwho.d.ts`. On merge, the local `GameAPIExtensions` interface in `game.ts` can be deleted — the `as typeof window.wiiwho.game & GameAPIExtensions` cast in `subscribe()` will also go away.
- **Plan 03-10** (orchestrator): wires `App.tsx` to render `<CrashViewer />` when `phase.state === 'crashed'`, and passes `onOpenCrashFolder` down to `window.wiiwho.logs.openCrashFolder(crashId)` (logs IPC channel Plan 03-10 fills).

## Self-Check: PASSED

- [x] `launcher/src/renderer/src/stores/game.ts` exists
- [x] `launcher/src/renderer/src/stores/__tests__/game.test.ts` exists
- [x] `launcher/src/renderer/src/components/PlayButton.tsx` exists
- [x] `launcher/src/renderer/src/components/__tests__/PlayButton.test.tsx` exists
- [x] `launcher/src/renderer/src/components/CrashViewer.tsx` exists
- [x] `launcher/src/renderer/src/components/__tests__/CrashViewer.test.tsx` exists
- [x] Commit `158a4b0` present in git log
- [x] Commit `54c6bc6` present in git log
- [x] Commit `4ce94ec` present in git log
- [x] Commit `6d5200c` present in git log
- [x] Commit `0edb292` present in git log
- [x] Commit `2f36d48` present in git log
- [x] All 28 tests green in combined vitest run
- [x] D-21 regression guard returns 0 matches (no scrub/sanitize/eyJ/redact imports in CrashViewer.tsx)
