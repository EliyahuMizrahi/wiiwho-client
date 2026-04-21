---
phase: 01-foundations
plan: 04
subsystem: infra
tags: [azure-ad, msal, oauth, device-code, microsoft-auth, minecraft-api, external-dependency]

# Dependency graph
requires: []
provides:
  - "Azure AD application 'Wiiwho Client' registered under owner's personal Microsoft account"
  - "Application (client) ID `60cbce02-072b-4963-833d-edb6f5badc2a` recorded in STATE.md (non-secret per D-18)"
  - "Tenant ID `91755ebc-8602-4281-970c-7be9bdfc35d7` recorded as-displayed (Phase 2 uses `/consumers` authority string regardless per D-15)"
  - "Microsoft Minecraft-API (MCE) review form submitted 2026-04-20 — 1-7 day review queue running in background of Phase 1 and Phase 2"
  - "docs/azure-app-registration.md maintainer reference doc with full portal config, tenant rationale, MCE pitfall notes, Phase 2 config snippet, and re-submission playbook"
affects:
  - "Phase 2 (auth): consumes AZURE_CLIENT_ID constant from this registration; execute cannot complete without MCE approval email"
  - "Phase 7 (release hardening): re-verifies 7-day refresh token flow which depends on this app still being approved"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "External dependencies with multi-day SLAs are started at phase START, not phase END — so the queue runs in parallel with implementation work"
    - "Public-client OAuth IDs (GUID + tenant GUID) are recorded in repo docs, not in password managers — they're not secrets"

key-files:
  created:
    - "docs/azure-app-registration.md"
  modified:
    - ".planning/STATE.md"

key-decisions:
  - "Azure AD app 'Wiiwho Client' registered as Personal Microsoft accounts only (consumers) per D-15 — only valid config for a Minecraft launcher"
  - "Application (client) ID 60cbce02-072b-4963-833d-edb6f5badc2a committed to repo per D-18 (public-client / device-code flow has no client secret)"
  - "Redirect URI locked to https://login.microsoftonline.com/common/oauth2/nativeclient (canonical public-client native redirect; prismarine-auth expects this)"
  - "XboxLive.signin permission NOT added in Azure portal — it is not exposed in the standard API-permissions UI and is requested via OAuth scope at runtime (verified via Microsoft Q&A)"
  - "MCE form submitted 2026-04-20 with owner contact eliyahu6666@outlook.com and associated GitHub URL https://github.com/EliyahuMizrahi/wiiwho-client — review window 2026-04-21 to 2026-04-27"

patterns-established:
  - "External-dependency-first pattern: when a phase task has a 1-7 day third-party SLA, it runs BEFORE dependent implementation so the queue ticks in parallel"
  - "Public client ID is non-secret: GUIDs for public-client OAuth apps live in repo docs, not in password managers; safe in logs, bug reports, and source"

requirements-completed: []

# Metrics
duration: 2 min
completed: 2026-04-21
---

# Phase 1 Plan 04: Azure AD App Registration + MCE Form Submission Summary

**Azure AD app `Wiiwho Client` (client ID `60cbce02-072b-4963-833d-edb6f5badc2a`) registered under owner's personal Microsoft account on the consumers tenant; Minecraft API permission form submitted 2026-04-20, starting the 1-7 day Microsoft review queue that Phase 2 depends on.**

## Performance

- **Duration:** 2 min (executor work only; owner's interactive Azure portal walkthrough was the external human-action checkpoint)
- **Started:** 2026-04-21T00:38:13Z (continuation agent after human-action checkpoint clearance)
- **Completed:** 2026-04-21T00:40:08Z
- **Tasks:** 2 (1 external human-action checkpoint + 1 doc write)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **Azure AD app registered** (Task 1 — human-action, completed by owner): `Wiiwho Client` with Application (client) ID `60cbce02-072b-4963-833d-edb6f5badc2a` on the consumers (Personal Microsoft accounts only) tenant. Redirect URI `https://login.microsoftonline.com/common/oauth2/nativeclient` configured. Public client flows enabled. API permissions limited to the default `User.Read` (XboxLive.signin is requested via OAuth scope at runtime, not added in portal).
- **MCE form submitted** (Task 1 — human-action, completed by owner): Microsoft Minecraft-API permission review form at https://aka.ms/mce-reviewappid submitted 2026-04-20 with owner contact `eliyahu6666@outlook.com` and associated website `https://github.com/EliyahuMizrahi/wiiwho-client`. Confirmation screen "Thank you for contacting Mojang Studios" received. Microsoft review queue is now running — approval email expected 2026-04-21 → 2026-04-27.
- **Client ID + timestamp recorded in STATE.md** (Task 1 aftermath): Decision entry added under Accumulated Context → Decisions with the full GUID, tenant ID, redirect URI, submission date, and expected approval window. Grep-verified that STATE.md contains both `Application (client) ID` and `MCE form submitted`.
- **Maintainer doc written at `docs/azure-app-registration.md`** (Task 2): Full portal configuration reference, "why these specific values" decision map, MCE review queue playbook (slow-approval + rejection paths), Phase 2 config snippet showing how `AZURE_CLIENT_ID` is consumed, pitfall notes for future maintainers ("GUIDs are not secrets"; "do not add XboxLive.signin in portal"), and a status table tracking MCE approval as **Pending**.
- **Phase 1 success criterion 2 satisfied**: "Azure AD app is registered with Minecraft API scope and has been submitted for Microsoft review (queue running; unblocks Phase 2)."

## Task Commits

1. **Task 1: Owner registers Azure AD app + submits MCE form** — completed interactively by owner during human-action checkpoint (no commit — output was the GUID + timestamp returned in the resume signal, which this continuation agent then recorded to STATE.md)
2. **Task 2: Write docs/azure-app-registration.md** — committed together with Task 1's STATE.md decision log in `388137b` (docs)

**Atomic commit:** `388137b` — `docs(01-04): record Azure AD app registration and MCE submission` — covers both Task 1's STATE.md decision record and Task 2's maintainer doc, per the plan's commit schema.

## Files Created/Modified

- `docs/azure-app-registration.md` (**created**) — maintainer reference: app identity table, status tracking table, portal config, MCE review queue playbook, pitfall notes, Phase 2 integration snippet, references to D-14 through D-18
- `.planning/STATE.md` (**modified**) — appended Azure AD registration decision entry under Accumulated Context → Decisions with GUID, tenant ID, redirect URI, submission date, expected approval window, and Phase 2 blocker status

## Decisions Made

- **Tenant ID recorded as-displayed, not re-derived.** The Azure portal showed `91755ebc-8602-4281-970c-7be9bdfc35d7` at registration time; this was recorded verbatim rather than replaced with the canonical consumers-tenant GUID (`9188040d-6c67-4c5b-b112-36a304b66dad`). Phase 2 uses the literal string `/consumers` as the authority path anyway (per D-15), so the numeric GUID is audit metadata, not a runtime config value. Documented in the doc's "Tenant ID in config" note so Phase 2 doesn't try to substitute it.
- **Followed D-14/D-15/D-16/D-17/D-18 verbatim** — no deviations from the Context decisions. The only judgment call was the tenant-ID-as-displayed recording above.
- **Display name written as `Wiiwho Client`** (only first W capitalized) throughout the doc, per the display-name correction locked during Plan 01-03 (STATE.md). MODID remains lowercase `wiiwho`.
- **MCE form submission details captured:** associated website = public GitHub repo URL (`https://github.com/EliyahuMizrahi/wiiwho-client`), contact email = owner's personal MS account email (`eliyahu6666@outlook.com`). These were chosen because the MCE reviewer uses the associated website to sanity-check the app — a public repo with commit history is the cleanest signal available.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] STATE.md grep-contract compliance**
- **Found during:** Post-Task-1 grep verification of must_haves.artifacts contract
- **Issue:** Initial STATE.md entry used phrasing `MCE review form submitted`, but the plan's `must_haves.artifacts[0].contains` contract specifies the literal string `MCE form submitted`. The grep-based acceptance criterion (`grep .planning/STATE.md for "MCE form submitted"`) would have returned 0 matches, silently failing the plan's verification.
- **Fix:** Updated the STATE.md entry to use `MCE form submitted: 2026-04-20 via https://aka.ms/mce-reviewappid (MCE review form submitted)` — preserves both phrasings; the contracted literal matches, and the descriptive phrasing is retained as a parenthetical.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `grep -c "MCE form submitted" .planning/STATE.md` returns 1. `grep -c "Application (client) ID" .planning/STATE.md` returns 1. Both plan-frontmatter contract patterns satisfied.
- **Committed in:** `388137b` (as part of the atomic Task 1 + Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — contract-literal compliance)
**Impact on plan:** The fix was essential for the plan's automated verification to pass. The must_haves frontmatter explicitly lists `MCE form submitted` as the required literal; my first draft used the looser phrasing. No scope creep — just contract alignment.

## Issues Encountered

None. Task 1 was an external human-action checkpoint that the owner completed successfully (Azure portal walkthrough + MCE Forms submission, both confirmed by screenshots of the confirmation screens per the resume signal). Task 2 was a straightforward doc write with grep-verified content.

The one notable observation — captured as a deviation above rather than an issue — is the grep-contract literal mismatch on first write. The fix was immediate and the plan's success criteria are now fully satisfied.

## Portal UI differences encountered vs RESEARCH.md walkthrough

None observed. The owner's interactive walk through the Entra ID → App registrations UI produced the expected sub-step outcomes (registration, Authentication pane with "Mobile and desktop applications" platform, "Allow public client flows" under Advanced settings, API permissions showing `User.Read` only). The MCE Forms URL (`https://aka.ms/mce-reviewappid`) resolved correctly and accepted the submission with the expected confirmation screen. No Microsoft UI renames or field reorderings to flag for future re-registrations.

## User Setup Required

None - the external service configuration (Azure portal + MCE form) was completed as part of this plan. The ONLY outstanding external dependency is Microsoft's review of the MCE submission, which is an asynchronous inbox-watching activity — no additional user configuration needed.

## Next Phase Readiness

**Phase 1 status:** 4 of 5 plans complete (00, 01, 03, 04). Plan 01-02 (trivial Mixin + `./gradlew runClient` DevAuth verification on Windows) remains open as the only unfinished Phase 1 work.

**Phase 1 success criterion 2 satisfied** — Azure AD app registered, MCE form submitted, review queue running. This is the plan's explicit goal.

**External dependency tracking:**
- **MCE approval — Pending**. Expected 2026-04-21 to 2026-04-27 at `eliyahu6666@outlook.com`. Phase 2 can start its research/planning/discuss work immediately; Phase 2's execute cannot complete end-to-end without this approval. STATE.md's Blockers/Concerns section already tracks this.

**For Phase 2 planning:**
- `docs/azure-app-registration.md` is the one-stop reference — it contains the client ID constant, the authority string, the scopes, and the full config snippet Phase 2's `launcher/src/main/auth/config.ts` should emit.
- No need to re-research the Azure config during Phase 2; everything is documented.

**Open:**
- **Approval-received date** — to be filled in later (either by Phase 2's executor when the approval email arrives, or by the owner directly when they see it). This doc's Status table has a **Pending** row that should be updated with the real date when the email lands.

## Known Stubs

None. All values in `docs/azure-app-registration.md` are real (actual GUID, actual tenant ID, actual email, actual timestamp). No placeholder data flows to any UI or downstream consumer. Phase 2's `AZURE_CLIENT_ID` constant will be a real working ID as soon as Phase 2 is implemented and MCE approval arrives.

## Self-Check: PASSED

- [x] `docs/azure-app-registration.md` exists on disk
- [x] Contains `Application (client) ID` (3 matches)
- [x] Contains `consumers` (8 matches)
- [x] Contains `aka.ms/mce-reviewappid` (3 matches)
- [x] Contains GUID pattern `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` (9 matches)
- [x] Contains references to D-14 through D-18 (10 matches)
- [x] `.planning/STATE.md` contains `MCE form submitted` (1 match — contract-literal)
- [x] `.planning/STATE.md` contains `Application (client) ID` (1 match — contract-literal)
- [x] Task commit `388137b` exists in git log

---
*Phase: 01-foundations*
*Completed: 2026-04-21*
