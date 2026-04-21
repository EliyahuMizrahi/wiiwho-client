---
phase: 2
slug: microsoft-authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (from Phase 1) |
| **Config file** | launcher/vitest.config.ts |
| **Quick run command** | `pnpm --filter launcher test:unit` |
| **Full suite command** | `pnpm --filter launcher test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter launcher test:unit`
- **After every plan wave:** Run `pnpm --filter launcher test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Populated by gsd-planner during plan creation. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test fixtures for MSAL device code response (mock `deviceCodeCallback` payload)
- [ ] Test fixtures for XSTS error responses (all 5 error codes: 2148916233, 2148916235, 2148916236, 2148916237, 2148916238)
- [ ] Test fixture for Minecraft profile response (`getMinecraftJavaToken({ fetchProfile: true })` success + 404 cases)
- [ ] Integration test harness for safeStorage encrypt/decrypt round-trip (may require electron-mocha or jest-electron)
- [ ] IPC contract type definitions (shared between main + renderer)

*Populated by gsd-planner based on RESEARCH.md recommendations.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Microsoft login end-to-end | AUTH-01 | Requires real MS account + Azure AD MCE approval; live endpoint | 1. Launch dev build. 2. Click "Log in." 3. Copy device code, open verification URL. 4. Complete MS auth. 5. Verify Minecraft username + UUID display. |
| 7-day refresh token persistence | AUTH-04 | Clock-based; can't mock real time reliably | 1. Log in. 2. Close launcher. 3. Wait 7 days (or system-clock manipulation). 4. Reopen launcher. 5. Verify silent refresh, no re-prompt. |
| Keychain plaintext audit | AUTH-04 | Requires filesystem scan of real encrypted blob | 1. Log in. 2. Scan `%APPDATA%/WiiWho` (Win) and `~/Library/Application Support/WiiWho` (mac) with `strings` / grep for token-looking patterns (JWT shape, `eyJ`). 3. Must find zero matches. |
| Live XSTS error surfaces | AUTH-05 | Each code requires a real account state (no Xbox, country ban, child account, etc.) | For each code 2148916233/235/236/237/238: use a test account in that state (or Microsoft test-account tooling) and confirm plain-English message appears. Code 233 (no Xbox) reproducible on any fresh MS account that has never touched Xbox Live. |
| Log-out → re-login | AUTH-06 | Requires full round-trip against live endpoint | 1. Log in. 2. Click "Log out." 3. Verify login screen. 4. Log in again with same account. 5. Verify success. |
| Cancel mid-flow | D-07 (ESC / Stop signing in) | Requires real polling loop to cancel against | 1. Click "Log in." 2. See device code. 3. Click "Stop signing in" (or press ESC). 4. Verify return to login screen. 5. Verify no hung promise or leaked polling. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
