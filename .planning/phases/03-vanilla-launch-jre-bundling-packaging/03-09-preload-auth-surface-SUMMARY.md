---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 09
subsystem: ipc-bridge/auth-seam
tags: [preload, ipc, d-11, auth, lch-06, comp-05, phase-2-to-3-seam]
requires:
  - 03-01  # sanitizeCrashReport export shape (indirect — consumed via logs:read-crash by Plan 03-10)
  - 03-02  # settings-store shape (indirect — preload already had settings.get/set)
  - 03-06  # log-parser emits the game:log frames this plan subscribes to
provides:
  - window.wiiwho.game.onLog           # subscription: game:log
  - window.wiiwho.game.onExited        # subscription: game:exited
  - window.wiiwho.game.onCrashed       # subscription: game:crashed
  - window.wiiwho.logs.openCrashFolder # invoke: logs:open-crash-folder
  - window.wiiwho.logs.listCrashReports# invoke: logs:list-crashes
  - AuthManager.getMinecraftToken      # {accessToken, username, uuid} for JVM spawn
  - MinecraftToken (type export)
affects:
  - launcher/src/main/ipc/game.ts   # Plan 03-10 will implement game:play calling getMinecraftToken() + emit the new push channels
  - launcher/src/main/ipc/logs.ts   # Plan 03-10 will implement logs:open-crash-folder + logs:list-crashes handlers
  - launcher/src/renderer/src/stores/game.ts  # Plan 03-08 subscribed to these via a local type augment; once this plan lands it resolves against the real wiiwho.d.ts
tech-stack:
  added: []
  patterns:
    - "D-11 extension rule: new subscriptions/invokes added UNDER existing top-level keys only (never a 6th key). Codified in the preload file header comment."
    - "AuthManager silent-Authflow reuse: getMinecraftToken mirrors trySilentRefresh's Authflow constructor (no codeCallback) but preserves the `token` field trySilentRefresh discards."
    - "Structural-invariant test via static source grep: the log-redaction regression asserts no `log.*(...)` call in AuthManager.ts contains `token`/`accessToken` — defense-in-depth on top of redact.ts's runtime scrubber."
key-files:
  created:
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-09-preload-auth-surface-SUMMARY.md
  modified:
    - launcher/src/preload/index.ts
    - launcher/src/renderer/src/wiiwho.d.ts
    - launcher/src/main/auth/AuthManager.ts
    - launcher/src/main/auth/__tests__/AuthManager.test.ts
decisions:
  - "Added the new members UNDER existing `game` and `logs` top-level keys rather than creating a `crash` or `process` top-level — preserves D-11's 5-key invariant per RESEARCH §Open Q 2 autonomous recommendation."
  - "`getMinecraftToken()` reuses the silent-refresh Authflow constructor (flow:'msal', no codeCallback) — if the cached refresh token is stale, prismarine-auth refreshes it in-place; if re-login is required, the method throws and Plan 03-10 maps the throw to 'please log in again'. Do NOT pass a codeCallback here — this path must never trigger a device-code modal."
  - "The log-redaction guard is a STATIC test (reads AuthManager.ts source and greps log.* calls) rather than a runtime capture of log output. Runtime capture would pass as long as redact.ts scrubs; the static check asserts the stronger property that the raw token never enters the log pipeline in the first place."
  - "`openCrashFolder(crashId?)` sends `{ crashId: crashId ?? null }` over the wire (never undefined) — Electron's IPC serializer drops undefined keys, and explicit null makes the Plan 03-10 handler's opts destructuring well-defined."
  - "Added `export interface MinecraftToken` at module scope (not nested in the class) so Plan 03-10's game.ts can import it as `import type { MinecraftToken } from '../auth/AuthManager'` without reaching into class internals."
metrics:
  duration: "~3m 22s"
  completed: "2026-04-21"
  tasks: 2
  files: 4
  tests_added: 6
  tests_green: 21  # 15 Phase 2 + 6 new
---

# Phase 3 Plan 09: Preload Auth Surface Summary

Closes the last two plumbing gaps before Plan 03-10 can land the orchestrator: (1) extends `window.wiiwho.game` with `onLog` / `onExited` / `onCrashed` subscriptions and `window.wiiwho.logs` with `openCrashFolder` / `listCrashReports` invokes — all under existing top-level keys, preserving D-11 — and (2) adds `AuthManager.getMinecraftToken()`, the single function Plan 03-10 calls right before JVM spawn to get `{ accessToken, username, uuid }` (LCH-06). Two commits, zero deviations, 21/21 AuthManager tests and full 330-test suite green.

## What shipped

| Artifact | Purpose | Scope |
| --- | --- | --- |
| `preload/index.ts` extensions | 3 new renderer→main subscription bridges (`game.onLog`, `game.onExited`, `game.onCrashed`) + 2 new invokes (`logs.openCrashFolder`, `logs.listCrashReports`). Every new entry lives under an existing top-level key. | 5 new channels: `game:log`, `game:exited`, `game:crashed`, `logs:open-crash-folder`, `logs:list-crashes` |
| `wiiwho.d.ts` widening | Types for all 5 new surface members; also widens `game.status()` state union and `game.play()` response shape to match the final Plan 03-10 contract (added `verifying`, `starting`, `failed`, `crashed` states + `error?: string`). | Single-source renderer↔main IPC contract |
| `AuthManager.getMinecraftToken()` | Fresh MC Java access token + profile for the JVM spawn (LCH-06). Silent-refresh semantics; throws on logged-out, missing profile, unavailable keychain. | 1 new public method + 1 new exported interface (`MinecraftToken`) |
| 6 new `AuthManager.test.ts` tests | Happy path, logged-out, silent-refresh (no codeCallback), log-redaction regression (static), sequential-call identity, profile-null, safeStorage-unavailable. | All green alongside the 15 Phase 2 tests (zero regressions) |

## D-11 invariant (preserved)

The preload file now has these top-level keys:

```
auth, game, settings, logs, __debug
```

Exactly 5 — the same count Phase 1 D-11 locked. The new surface members all sit one level down:

```text
game ─┬─ play              (existing)
      ├─ cancel            (existing)
      ├─ status            (existing)
      ├─ onStatus          (existing)
      ├─ onProgress        (existing)
      ├─ onLog             (NEW — this plan)
      ├─ onExited          (NEW — this plan)
      └─ onCrashed         (NEW — this plan)

logs ─┬─ readCrash         (existing)
      ├─ openCrashFolder   (NEW — this plan)
      └─ listCrashReports  (NEW — this plan)
```

Grep-asserted in the Self-Check section below. The preload file's header comment now explicitly documents this extension rule for the next contributor.

## Channel count (from the original plan output question)

Phase 1 D-11 documented "13 channels total" — that was a snapshot of the Phase 1 scaffold, **not a cap**. RESEARCH §Open Q 2 explicitly recommended the autonomous extension of subscriptions/invokes under existing keys; this plan acts on that recommendation. New total: 13 + 5 = **18 channels**, all still named, all still one-way (main→renderer push OR renderer→main invoke — no bidirectional RPC). No escalation required; the D-11 invariant was the 5-key shape, not the channel count.

## prismarine-auth 3.1.1 type surface quirks encountered

The `getMinecraftJavaToken({ fetchProfile: true })` branch returns `{ token, entitlements, profile, certificates }` per the `.d.ts`. Observations relevant to this plan:

1. **`profile` is declared non-nullable** in the `.d.ts` but the library returns `null` when the MS account lacks a Minecraft entitlement (seen in Phase 2 tests). The existing Phase 2 code already narrows with `if (!result.profile)` — `getMinecraftToken()` follows the same pattern (throws `"Minecraft profile missing — re-login required."`).
2. **`entitlements` and `certificates` types are heavy** (`MinecraftJavaEntitlements`, `MinecraftJavaCertificates` — both include KeyObject and signed-structure fields we don't need). The implementation narrows with an inline `as { token: string; profile: { id: string; name: string } | null }` cast at the await boundary so none of those types leak into our public `MinecraftToken` interface.
3. **No extra quirk for `fetchProfile: true`** beyond those two — the `token` field is a plain string regardless of the option combination, and prismarine-auth's internal cache is transparent to callers.

Plan 02-03 previously documented quirks (1) and the ServerDeviceCodeResponse vs DeviceCodeResponse casing mismatch. Quirk (2) is new documentation as of this plan.

## How `AuthManager.test.ts` was extended

The Phase 2 test file already had a flexible `MockAuthflowFactory` shape but its return only typed `{ profile }`. Change made in this plan:

```diff
 type MockAuthflowFactory = (args: {
   codeCallback?: (resp: { ... }) => void
 }) => {
   getMinecraftJavaToken: (opts: unknown) => Promise<{
+    token?: string
     profile: { id: string; name: string } | null
   }>
 }
```

Optional `token` — existing Phase 2 tests don't set it (they only assert `profile` behavior) and their mock bodies continue to work unchanged. New Plan 03-09 tests set `token: 'opaque-mc-token-abc123'` in their mock bodies.

The new `describe('AuthManager.getMinecraftToken')` block is appended at the end of the file so Phase 2 test ordering stays byte-identical. Future plans reading the test file as documentation see a linear Phase-2-then-Phase-3 flow.

## Deviations from Plan

None — plan executed exactly as written. Two caveats worth noting as implementation texture rather than deviations:

1. **SUMMARY filename** — the plan's `<output>` block mentioned `03-09-SUMMARY.md` but every other Phase 3 plan uses the `{phase}-{plan}-{slug}-SUMMARY.md` convention (e.g., `03-08-renderer-game-and-crash-SUMMARY.md`). This file follows the longer convention to stay consistent with siblings.
2. **Log-redaction test implementation** — the plan's `<behavior>` for Test 4 read "Force a call through log.info with the result — assert the log output doesn't contain the raw token". That formulation would only confirm redact.ts scrubs correctly (already covered by redact.test.ts). The stronger invariant worth locking is "AuthManager.ts never hands the token to a log call at all", which is a static-source property of this file rather than a runtime property of the log pipeline. The implemented test (readFile + negative regex on `log.*(...)` calls) asserts that stronger property.

## Commits

| Commit | Message |
| --- | --- |
| `fb20edc` | `feat(03-09): extend preload bridge under existing keys (D-11)` |
| `4c8c9d2` | `test(03-09): add failing tests for AuthManager.getMinecraftToken` (RED) |
| `490480b` | `feat(03-09): add AuthManager.getMinecraftToken() (LCH-06)` (GREEN) |

## Verification

- `pnpm --filter ./launcher run typecheck` → exit 0 (both `typecheck:node` and `typecheck:web`).
- `pnpm --filter ./launcher vitest run src/main/auth/__tests__/AuthManager.test.ts` → 21/21 pass.
- `pnpm --filter ./launcher run test:run` → 34 test files, 330 tests, all pass.
- `grep -cE "^  (auth|game|settings|logs|__debug):" launcher/src/preload/index.ts` → 5 (D-11 preserved).
- Every acceptance criterion in the plan's Task 1 + Task 2 grep lists hits.

## Seams left for Plan 03-10

The orchestrator (`ipc/game.ts`) now has a single clean entrypoint for each seam it needs:

```typescript
// Fresh MC token right before spawn (LCH-06)
const mc = await getAuthManager().getMinecraftToken()
// → mc.accessToken, mc.username, mc.uuid flow into args.ts → spawnGame

// Push events to the renderer during/after launch
win.webContents.send('game:log', { line, stream })
win.webContents.send('game:exited', { exitCode })
win.webContents.send('game:crashed', { sanitizedBody, crashId })

// Crash-folder UX (D-19)
ipcMain.handle('logs:open-crash-folder', ...)   // shell.showItemInFolder
ipcMain.handle('logs:list-crashes', ...)        // readdir crash-reports/
```

No further plumbing changes needed before Plan 03-10 lands.

## Self-Check: PASSED

Verified:
- `launcher/src/preload/index.ts` — FOUND (modified)
- `launcher/src/renderer/src/wiiwho.d.ts` — FOUND (modified)
- `launcher/src/main/auth/AuthManager.ts` — FOUND (modified; `getMinecraftToken` + `MinecraftToken` present)
- `launcher/src/main/auth/__tests__/AuthManager.test.ts` — FOUND (modified; 6 new tests)
- Commits `fb20edc`, `4c8c9d2`, `490480b` — all FOUND in `git log`
- D-11 top-level keys count: 5 (grep-verified)
- 5 new channels present in preload (grep-verified)
- 5 new surface members present in wiiwho.d.ts (grep-verified)
- `pnpm --filter ./launcher run typecheck` exit 0 — verified
- `pnpm --filter ./launcher vitest run src/main/auth/__tests__/AuthManager.test.ts` → 21/21 pass — verified
- `pnpm --filter ./launcher run test:run` → 330/330 pass — verified
