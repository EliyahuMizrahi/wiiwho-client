---
phase: 1
slug: foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Launcher | Mod |
|----------|----------|-----|
| **Framework** | Vitest 2.x (ships with `@quick-start/electron` template) | JUnit 5 via Gradle `useJUnitPlatform()` |
| **Config file** | `launcher/vitest.config.ts` (Wave 0 verifies / adds) | `client-mod/build.gradle.kts` `test { useJUnitPlatform() }` block |
| **Quick run command** | `pnpm --filter launcher test --run` | `./gradlew :client-mod:test --rerun-tasks` |
| **Full suite command** | `pnpm test` | `./gradlew check` |
| **Estimated runtime** | ~5 seconds (Phase 1 has <10 unit tests) | ~30 seconds cold, ~5s warm |

**Docs check:** `node scripts/check-docs.mjs` — asserts the three policy docs exist with required headings.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter launcher test --run` AND `./gradlew :client-mod:test` (whichever side the task touches — both if the task is cross-cutting)
- **After every plan wave:** Run `pnpm test` AND `./gradlew check` AND `node scripts/check-docs.mjs`
- **Before `/gsd:verify-work`:** Full suite must be green; four manual success-criteria checks performed and logged in STATE.md
- **Max feedback latency:** 30 seconds (mod `./gradlew test` cold is the slowest automated feedback)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-00-01 | 00-wave-0 | 0 | (infra) | smoke | `pnpm --filter launcher test --run` returns 0 | ❌ W0 | ⬜ pending |
| 1-00-02 | 00-wave-0 | 0 | (infra) | smoke | `./gradlew :client-mod:test` returns 0 with no tests defined | ❌ W0 | ⬜ pending |
| 1-00-03 | 00-wave-0 | 0 | COMP-04 | smoke | `node scripts/check-docs.mjs` returns 0 | ❌ W0 | ⬜ pending |
| 1-XX-MOD-01 | client-mod scaffold plan | 1 | MOD-01 | smoke | `./gradlew --dry-run build` from `client-mod/` | ❌ W0 | ⬜ pending |
| 1-XX-MOD-02 | client-mod runClient plan | 2 | MOD-02 | manual (interactive) | `./gradlew runClient -Ddevauth.enabled=1` — human observes MS login + 1.8.9 title screen | — | ⬜ pending |
| 1-XX-MOD-03 | client-mod MODID plan | 1 | MOD-03 | unit | `./gradlew :client-mod:test --tests club.wiiwho.ModidTest` | ❌ W0 | ⬜ pending |
| 1-XX-MOD-04 | client-mod Mixin plan | 2 | MOD-04 | integration (manual capture of runClient stdout) | grep for `[WiiWho] Mixin hello` in runClient stdout | — | ⬜ pending |
| 1-XX-LAUN-01 | launcher scaffold plan | 1 | LAUN-01 | manual (visual) | `pnpm --filter launcher dev` — Electron window opens | — | ⬜ pending |
| 1-XX-LAUN-02 | launcher UI plan | 1 | LAUN-02 | manual (visual) | Same dev session — visible "Play" button rendered | — | ⬜ pending |
| 1-XX-LAUN-06 | launcher security plan | 1 | LAUN-06 | unit | `pnpm --filter launcher test -- security-audit` asserts `allTrue: true` from `__security:audit` IPC | ❌ W0 | ⬜ pending |
| 1-XX-AZURE | azure-ad plan | 1 | (success criterion 2) | manual (external) | Azure Portal screenshot + aka.ms/mce-reviewappid submission timestamp logged in STATE.md | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs marked `1-XX-*` will be resolved to concrete `{phase}-{plan}-{task}` IDs by the planner.*

---

## Wave 0 Requirements

- [ ] `launcher/vitest.config.ts` — verify it ships from the `@quick-start/electron` scaffold; if missing add a minimal config
- [ ] `launcher/src/main/ipc/security.test.ts` — covers LAUN-06 runtime verification via mocked `__security:audit` IPC handler
- [ ] `launcher/src/main/ipc/auth.test.ts`, `game.test.ts`, `settings.test.ts` — one-liner tests per IPC channel group asserting stub return payloads
- [ ] `client-mod/src/test/java/club/wiiwho/ModidTest.java` — asserts `WiiWho.MODID.equals("wiiwho")` (covers MOD-03)
- [ ] `client-mod/build.gradle.kts` `test { useJUnitPlatform() }` block — confirm present; add if missing
- [ ] `scripts/check-docs.mjs` — asserts `docs/ANTICHEAT-SAFETY.md` contains "Feature Review Log", `docs/mojang-asset-policy.md` contains "downloads at runtime", `docs/cape-provenance.md` contains "original art" (covers COMP-04)
- [ ] `package.json` top-level `scripts.test` wires `pnpm --filter launcher test --run` and `node scripts/check-docs.mjs` so `pnpm test` runs the full launcher+docs suite
- [ ] `.github/workflows/ci.yml` placeholder — optional for Phase 1; include a minimal 3-job skeleton (launcher tests, mod tests, docs check) so Phase 2+ doesn't re-litigate CI setup

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `./gradlew runClient` launches dev 1.8.9 with mod + DevAuth MS login | MOD-02 | DevAuth initiates a real Microsoft OAuth redirect — cannot automate interactive consent in Phase 1 | Run on Windows. When DevAuth opens the MS login URL in browser, complete login with owner's MS account. Verify 1.8.9 title screen opens with Forge mod list showing "wiiwho" |
| Trivial Mixin fires during `runClient` | MOD-04 | Requires a live Minecraft session | Same runClient session. Check launcher/terminal stdout for `[WiiWho] Mixin hello` line originating from the Mixin's injected code |
| `pnpm dev` opens an Electron window | LAUN-01 | Visual check — no automated harness for window-open in Phase 1 (Playwright deferred to Phase 3) | Run `pnpm --filter launcher dev`. Verify a 1000×650 non-resizable window opens within 5s |
| "Play" button visible and styled | LAUN-02 | Visual check — Playwright deferred | Same dev session. Confirm a Play button is rendered in the window |
| Azure AD app registration submitted | (success criterion 2) | External (Microsoft portal) | Owner walks Azure portal steps per research §Azure AD walkthrough. Log app (client) ID, tenant `/consumers`, MCE form submission timestamp in STATE.md |
| MODID `wiiwho` available on CurseForge | MOD-03 | CurseForge blocks automated fetch (403) | Owner manually opens `https://www.curseforge.com/minecraft/search?search=wiiwho` in a browser and confirms no colliding mod; result logged in STATE.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (manual-only tasks grouped at end of Wave 2)
- [ ] Wave 0 covers all MISSING references (vitest config, security test, ModidTest, check-docs.mjs)
- [ ] No watch-mode flags (Vitest invoked with `--run`, Gradle with `--rerun-tasks`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
