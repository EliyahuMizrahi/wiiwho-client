# Phase 2 — Manual QA: Microsoft Authentication

> Live-endpoint verification procedure. Runs AFTER automated tests pass AND after MCE approval email arrives for Azure AD app `60cbce02-072b-4963-833d-edb6f5badc2a`.

## Prerequisites

- [ ] MCE approval email received (check `docs/azure-app-registration.md` for the approval-received date — blocked until populated)
- [ ] Launcher runs via `pnpm --filter ./launcher dev` on the test machine
- [ ] Owner has access to at least one real Microsoft account that owns Minecraft Java Edition
- [ ] Filesystem tooling available: `grep` or PowerShell `Select-String` for the token-leak audit
- [ ] Owner has admin control of a secondary Microsoft test account WITHOUT an Xbox profile (used for XSTS 2148916233 reproduction)

## Test 1 — Happy-path login (AUTH-01, AUTH-02, AUTH-05)

1. Launch dev build. First screen SHOULD be LoginScreen (wordmark + "Log in with Microsoft" button + `v0.1.0-dev`).
2. Click "Log in with Microsoft".
3. DeviceCodeModal SHOULD appear within 3 seconds showing an 8-char user code, "Copy code" button, "Open in browser" button, "Stop signing in" button, and an `Expires in {mm:ss}` countdown.
4. Click "Open in browser". Verify the system browser opens `https://www.microsoft.com/link` (or equivalent verification_uri from Microsoft).
5. Enter the code, authenticate with the primary MS account, approve the `Wiiwho Client` app.
6. Return to the launcher. Within 10 seconds, the modal SHOULD close and the UI SHOULD transition to the Play-forward layout with the top-right AccountBadge displaying the Minecraft username.
7. Click the AccountBadge. Dropdown SHOULD show full username, full 32-char UUID, and "Log out".

Pass criteria: steps 1-7 complete without errors. The console logs contain no JWT tokens (check via DevTools console; should be clean).

## Test 2 — Cancel mid-flow (D-07)

1. Click "Log in with Microsoft" → modal opens with device code.
2. Click "Stop signing in". Modal SHOULD close within 1 second and return to LoginScreen.
3. Repeat, but press `Escape` instead of clicking. Same outcome.

Pass criteria: no hung polling promise, no second modal appears, console does not print unhandled promise rejections.

## Test 3 — Filesystem token-leak audit (AUTH-04)

After Test 1, with the launcher still running and the user logged in, run:

Windows (PowerShell):
```
Select-String -Path "$env:APPDATA\Wiiwho\*" -Pattern "eyJ|refresh_token|access_token" -Recurse
```

macOS (bash):
```
grep -rE "eyJ|refresh_token|access_token" "$HOME/Library/Application Support/Wiiwho/"
```

Pass criteria: ZERO matches. Any match is an AUTH-04 blocker.

Also run:
```
grep -rE "eyJ|refresh_token|access_token" ~/.config/Wiiwho/logs/  # Linux path if present
```
Pass criteria: zero matches.

## Test 4 — 7-day refresh (AUTH-02 Success Criterion 2)

Time-sensitive; run across two sessions.

Session A (day 0):
1. Complete Test 1 (fresh login).
2. Fully close the launcher (quit — not just window close on macOS).
3. Record date/time.

Session B (day 7):
1. Reopen the launcher.
2. LoadingScreen SHOULD appear briefly, then transition to Play-forward with the same user logged in.
3. At NO point should the LoginScreen or DeviceCodeModal appear.

If day 7 is impractical, use system clock manipulation: set the OS clock forward 7 days between Session A and Session B. Restore the clock afterward.

Pass criteria: silent refresh succeeds without re-prompting.

## Test 5 — XSTS error surfaces (AUTH-03)

Reproducibility notes per code:

- `2148916233` (no Xbox profile): use a fresh MS account that has never accessed xbox.com. Walking through MS sign-in will trigger this.
- `2148916235` (country blocked): requires a VPN + MS account from a blocked country; DEFER to post-v0.1 unless reproducible.
- `2148916236` / `2148916237` (age verification): requires a real-account-state; DEFER unless reproducible.
- `2148916238` (child not in Family): requires a sub-18 MS account; DEFER unless reproducible.

For each reproducible code, attempt login. Expected: ErrorBanner appears under the login button with plain-English message per UI-SPEC §ErrorBanner and a Help link that opens in the system browser.

For non-reproducible codes, verify via the unit test fixtures in `launcher/src/main/auth/__tests__/xstsErrors.test.ts` (must pass).

Pass criteria: every reproducible code shows the correct message; Help button opens the correct URL; unit tests cover the non-reproducible codes.

## Test 6 — Logout + re-login (AUTH-06)

1. Starting logged-in, click AccountBadge → "Log out".
2. UI SHOULD transition to LoginScreen instantly (no confirm dialog, per D-15).
3. Run the Test 3 filesystem audit — there should be NO token files remaining under `auth/` for the logged-out account (the pointer file may still exist with an empty `accounts[]` array and cleared `activeAccountId`).
4. Click "Log in with Microsoft". Complete device-code flow as in Test 1.
5. Relaunch the launcher (full quit + reopen). LoadingScreen → Play-forward with the same account.

Pass criteria: logout wipes tokens; re-login succeeds; silent refresh works on subsequent launch.

## Sign-off

| Test | Date | Result | Notes |
|------|------|--------|-------|
| 1 happy-path | | | |
| 2 cancel | | | |
| 3 token-leak audit | | | |
| 4 7-day refresh | | | |
| 5 XSTS errors | | | |
| 6 logout + re-login | | | |

All 6 tests must pass before the phase is marked complete.
