---
phase: 01-foundations
plan: 00
subsystem: infra
tags: [docs, policy, node, esm, anticheat, compliance]

# Dependency graph
requires: []
provides:
  - "docs/ANTICHEAT-SAFETY.md — permanent per-feature anticheat verdict log with MODID signoff row"
  - "docs/mojang-asset-policy.md — COMP-04 asset-policy documentation (launcher downloads at runtime, never bundles)"
  - "docs/cape-provenance.md — D-25 provenance template for the placeholder cape"
  - "scripts/check-docs.mjs — Node 22 ESM docs-content assertion (exits 0/1)"
  - "package.json (root) — pnpm@9 package with 'test' script wired to docs-check"
  - "assets/README.md — explains D-07 shared-assets single-source-of-truth"
affects: [01-foundations-mod-scaffold, 01-foundations-launcher-scaffold, 01-foundations-azure-ad, 04-anticheat-review, 06-perf-benchmark]

# Tech tracking
tech-stack:
  added: [node-22-esm, pnpm-9]
  patterns:
    - "Policy docs as greppable contracts — any later plan can run `node scripts/check-docs.mjs` to assert invariants"
    - "Dual-state TDD commits: test/scaffold commit leaves build RED intentionally; docs commit turns it GREEN"
    - "Zero-dep Node ESM scripts for repo-root tooling — no npm install needed to run docs-check"

key-files:
  created:
    - "scripts/check-docs.mjs"
    - "package.json"
    - "assets/README.md"
    - "docs/ANTICHEAT-SAFETY.md"
    - "docs/mojang-asset-policy.md"
    - "docs/cape-provenance.md"
  modified: []

key-decisions:
  - "Docs-check script is pure Node 22 ESM with zero npm deps — runnable before any pnpm install"
  - "Script resolves paths via import.meta.url + path.resolve, so it works regardless of CWD"
  - "Root package.json declares pnpm@9.0.0 (will be re-pinned at scaffold time in 01-01 if launcher template ships a different minor)"
  - "Policy docs reproduced verbatim from 01-RESEARCH.md §Three Policy Doc Templates — no deviations"

patterns-established:
  - "Greppable policy-doc contracts: each required heading/phrase is a contract line in check-docs.mjs's `required` array; adding contract = adding a line"
  - "Repo-root `test` script convention: `pnpm test` runs the whole suite; individual suites invoked by subsystems (launcher/mod) can be added without disturbing the docs-check"
  - "Anticheat review log: every feature PR appends a row to docs/ANTICHEAT-SAFETY.md with owner signoff before merge"

requirements-completed: [COMP-04]

# Metrics
duration: 2m
completed: 2026-04-20
---

# Phase 01 Plan 00: Wave-0 Foundations Summary

**Three policy docs (anticheat review log, Mojang asset policy, cape provenance) plus a zero-dep Node docs-check script wired through `pnpm test` — establishes the greppable contract every later Phase 1 plan relies on.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-20T23:28:41Z
- **Completed:** 2026-04-20T23:30:53Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (all created — greenfield subtree)

## Accomplishments

- `docs/ANTICHEAT-SAFETY.md` seeded with Feature Review Log, first-row MODID `wiiwho` signoff dated 2026-04-20, Alt-Account Play Tests skeleton (Hypixel + BlocksMC sub-sections), and 8 permanent Red Lines
- `docs/mojang-asset-policy.md` seeded with 5 policy rules; rule 1 contains the greppable phrase "downloads at runtime"; COMP-04 referenced inline
- `docs/cape-provenance.md` seeded with Asset / Provenance / License grant / v0.3 sections; references D-23, D-24, D-25 and `#16e0ee`; declares "100% original art"
- `scripts/check-docs.mjs` enforces 12 content assertions across the three docs; exits 0 on all-pass, 1 on any failure with one `FAIL:` line per failure
- Root `package.json` wires `pnpm test` / `npm test` → `node scripts/check-docs.mjs` (verified end-to-end)
- `assets/README.md` explains D-07 single-source-of-truth and documents the two assets the owner will produce (`logo.svg`, `cape-placeholder.png` with accent `#16e0ee`)

## Task Commits

Each task was committed atomically:

1. **Task 1: docs-check script + package.json + assets/README.md** — `12ae4df` (test)
   - Script verified to syntax-check clean and exit 1 with 3 FAIL lines before docs exist (correct TDD RED state)
2. **Task 2: Three policy docs** — `420f0f7` (docs)
   - Script now exits 0: `OK: all 3 docs pass 12 content assertions`

_Note: This was a TDD plan; Task 1 intentionally left the build RED, Task 2 turned it GREEN._

## Files Created/Modified

- `scripts/check-docs.mjs` — zero-dep Node 22 ESM asserting required headings/phrases across three policy docs; prints `FAIL: <file> missing required substring "…"` per failure
- `package.json` — root `"name": "wiiwho-client"`, `"private": true`, `"packageManager": "pnpm@9.0.0"`, `scripts.test` wired to the check
- `assets/README.md` — D-07 explanation plus inventory (`logo.svg`, `cape-placeholder.png` with `#16e0ee` accent, per D-24)
- `docs/ANTICHEAT-SAFETY.md` — 50 lines; verbatim from RESEARCH.md template
- `docs/mojang-asset-policy.md` — 5-rule policy; explicit COMP-04 mapping at top and bottom
- `docs/cape-provenance.md` — provenance skeleton with owner-fill placeholders for "Date created" / "Tool used" when the PNG is drawn

## Greppable Content Assertions (the permanent contracts)

| File | Required substrings |
|------|---------------------|
| `docs/ANTICHEAT-SAFETY.md` | `# WiiWho Anticheat Safety Review`, `## Feature Review Log`, `## Alt-Account Play Tests`, `### Hypixel`, `### BlocksMC`, `## Red Lines` |
| `docs/mojang-asset-policy.md` | `# WiiWho Client — Mojang Asset Policy`, `## Policy`, `downloads at runtime` |
| `docs/cape-provenance.md` | `# Placeholder Cape — Provenance`, `## Provenance`, `original art` |

**Script exit behavior:** `node scripts/check-docs.mjs` — exit 0 when all 12 assertions pass (current state); exit 1 with `FAIL:` lines to stderr on any miss. Verified 2026-04-20: exits 0 with `OK: all 3 docs pass 12 content assertions`.

## Decisions Made

- **Policy docs reproduced verbatim from RESEARCH.md §Three Policy Doc Templates.** No deviations from the templates — they were designed specifically to satisfy the greppable contracts.
- **Script resolves paths via `import.meta.url` + `path.resolve(__dirname, '..', …)`** so `node scripts/check-docs.mjs` works from any CWD (including CI and IDE run-configs that may not cd to repo root).
- **`packageManager: "pnpm@9.0.0"`** — conservative pin; 01-01 (launcher scaffold) will re-pin to whatever `@quick-start/electron` ships with if different.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the action blocks verbatim; docs reproduced from RESEARCH.md templates without modification. Script contract in plan matched script as written.

## Issues Encountered

- **CRLF warnings on git add** (Windows environment) — informational only; git's `core.autocrlf` converts line endings. No action needed; content hashes and doc-check assertions are LF/CRLF-agnostic (we `.includes()` substrings that don't span newlines).

## User Setup Required

None — no external service configuration required for this plan. (Azure AD app registration is a separate Phase 1 plan with its own user-facing checkpoints.)

## Next Phase Readiness

- **Ready for 01-01 (next Phase 1 plan):** `pnpm test` is wired and green; subsequent plans can extend `scripts.test` with `&&` (launcher tests, mod tests) without touching the docs-check.
- **Ready for every future feature PR:** authors append a row to `docs/ANTICHEAT-SAFETY.md` Feature Review Log with owner signoff before merge (process per D-20).
- **Owner fill-in pending (non-blocking for this plan):**
  - `docs/cape-provenance.md` — Date created, Tool used (filled when owner draws `assets/cape-placeholder.png`)
  - `assets/logo.svg`, `assets/cape-placeholder.png` — owner-produced during Phase 1 per D-23/D-24

## Self-Check: PASSED

All 7 claimed files exist on disk:
- `scripts/check-docs.mjs`
- `package.json`
- `assets/README.md`
- `docs/ANTICHEAT-SAFETY.md`
- `docs/mojang-asset-policy.md`
- `docs/cape-provenance.md`
- `.planning/phases/01-foundations/01-00-SUMMARY.md`

Both task commits present in git history:
- `12ae4df` (Task 1 — test/scaffold)
- `420f0f7` (Task 2 — docs)

Final `node scripts/check-docs.mjs` run: exit 0, `OK: all 3 docs pass 12 content assertions`.

---
*Phase: 01-foundations*
*Plan: 00*
*Completed: 2026-04-20*
