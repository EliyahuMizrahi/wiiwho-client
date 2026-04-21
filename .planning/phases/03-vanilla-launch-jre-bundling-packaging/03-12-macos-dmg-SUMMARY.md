---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 12
subsystem: packaging
tags:
  - electron-builder
  - dmg
  - macos
  - temurin
  - universal
  - checkpoint
  - human-needed

# Dependency graph
requires:
  - phase: 03-vanilla-launch-jre-bundling-packaging
    provides: "Plan 03-11 authored all macOS artifacts this plan consumes: electron-builder.yml mac target (Universal DMG, extraResources for both JRE slots + mod), prefetch-jre.mjs mac-x64 + mac-arm64 slots, build/README-macOS.txt, docs/install-macos.md, launcher/package.json dist:mac script"
provides:
  - "CHECKPOINT marker for phase verifier: Plan 03-12 is prep-complete but build-incomplete"
  - "Exact command + expected artifact layout for a Mac operator to produce launcher/dist/Wiiwho.dmg in a single session"
affects:
  - "Phase 3 completion gate (SC4): 'running electron-builder on macOS produces a DMG/ZIP bundling JRE + mod jar' — correctly flagged human_needed until a Mac machine executes the documented command"
  - "Phase 7 (PKG-03): clean-machine macOS UAT is gated on this DMG existing"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CHECKPOINT plan pattern: plan author intentionally makes the plan non-autonomous (autonomous: false); executor verifies prep is complete and documents the single remaining command for the human operator rather than attempting a cross-platform build"

key-files:
  created:
    - ".planning/phases/03-vanilla-launch-jre-bundling-packaging/03-12-macos-dmg-SUMMARY.md"
  modified: []

key-decisions:
  - "Plan 03-12 deferred, NOT failed — PKG-02 and JRE-02 stay 'Pending' in REQUIREMENTS.md until the user runs `pnpm --filter ./launcher run dist:mac` on a macOS 12+ machine"
  - "All 03-12 prep artifacts verified in place (electron-builder.yml mac block, prefetch-jre mac slots, README-macOS.txt, docs/install-macos.md, package.json dist:mac script) — zero code changes needed in 03-12; this plan is purely 'run the build on Mac and verify'"
  - "Phase 3 is allowed to close with PKG-02 + JRE-02 flagged human_needed by the verifier — all 13 other phase-3 plans complete, entire Windows path complete, and macOS code-path (paths.ts darwin branches + electron-builder.yml mac target) is unit-tested and config-complete"

patterns-established:
  - "Pattern: CHECKPOINT SUMMARY — when a plan requires non-autonomous work (different OS, physical hardware, external service), the executor writes a SUMMARY documenting status=CHECKPOINT, what's-complete, what's-pending, and the exact resume command. Phase verifier treats this as human_needed rather than incomplete."

requirements-completed: []

# Metrics
metrics:
  duration: "~5 min"
  tasks: 0
  files: 1
  completed_date: 2026-04-21

---

# 03-12 macos-dmg — SUMMARY (CHECKPOINT)

## Status: CHECKPOINT — Awaiting Mac build machine

The owner is on Windows (per CLAUDE.md and Phase 3 execution history). `electron-builder --mac` cannot cross-build a Universal DMG from Windows — the `@electron/universal` merge requires macOS-native tooling (`lipo`, even ad-hoc `codesign`). Plan 03-12 is the only plan in Phase 3 that requires non-Windows hardware, and this is **expected and accepted** per the plan's `autonomous: false` frontmatter.

## What's complete (via Plan 03-11)

Every artifact Plan 03-12 would consume is already authored, committed, and verified on disk:

- **`launcher/electron-builder.yml`** — `mac:` block present with:
  - `target: dmg` + `arch: universal` (D-22: single Universal DMG, not separate arm64/x64)
  - `identity: null` + `notarize: false` (D-23: unsigned for v0.1)
  - `extraResources` entries for `resources/jre/mac-arm64` → `jre/mac-arm64`, `resources/jre/mac-x64` → `jre/mac-x64`, `resources/mod` → `mod`
  - `asarUnpack: resources/**` (JRE must live on real filesystem)
  - `dmg.contents` layout: Wiiwho.app at (140,180), /Applications shortcut at (400,180), `build/README-macOS.txt` at (270,330)
- **`launcher/scripts/prefetch-jre.mjs`** — provisions both mac slots (`mac-x64` and `mac-arm64`) from the same x64 Temurin 8u482-b08 tarball (Open Q §1 resolution: x64-in-both-slots; Rosetta 2 handles Apple Silicon, ~70 MB installer savings)
- **`build/README-macOS.txt`** — right-click-Open Gatekeeper walkthrough + Rosetta 2 note, ready for DMG window inclusion
- **`launcher/build/README-macOS.txt`** — same content at the electron-builder `buildResources`-relative path the YAML references
- **`docs/install-macos.md`** — public install guide with Rosetta 2 rationale + `xattr -dr com.apple.quarantine` troubleshooting
- **`launcher/package.json`** — `dist:mac` script present: `npm run package-resources && electron-vite build && electron-builder --mac`

All verified on disk as of this SUMMARY's write time. Zero code/config changes were made in this plan.

## What's pending

On a macOS 12+ (Monterey or later) machine with Node 22 + pnpm + JDK 17 + Internet:

```bash
# 1. Clone + install
git clone <repo-url>
cd wiiwho-client

# 2. Install launcher deps
pnpm install   # or: pnpm --filter ./launcher install

# 3. Provision JRE slots (downloads Temurin tarballs, SHA256-verifies, extracts)
pnpm --filter ./launcher run prefetch-jre

# 4. Build the mod jar (needs JDK 17 at JAVA_HOME for Gradle 7.6)
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
pnpm --filter ./launcher run build-mod

# 5. Build the DMG
pnpm --filter ./launcher run dist:mac
```

### Expected output

- `launcher/dist/Wiiwho.dmg` — Universal DMG, ~280–350 MB (Electron runtime ~200 MB + 2× Temurin JRE ~117 MB each, though both slots hold the same x64 tarball so @electron/universal's byte-compare passes + mod jar ~1 MB)

### Smoke verification (manual, on Mac)

```bash
# Mount
hdiutil attach launcher/dist/Wiiwho.dmg

# DMG window contents should show:
ls "/Volumes/Wiiwho Client/"
# → Wiiwho.app  Applications  README-macOS.txt

# App bundle inspection — both JRE slots present
ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/mac-arm64/Contents/Home/bin/java"
ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/jre/mac-x64/Contents/Home/bin/java"

# Mod jar
ls "/Volumes/Wiiwho Client/Wiiwho.app/Contents/Resources/mod/wiiwho-0.1.0.jar"

# Gatekeeper README present inside the DMG, not just linked
cat "/Volumes/Wiiwho Client/README-macOS.txt" | grep -i "RIGHT-CLICK"

# Unsigned confirmation (acceptable per PKG-02 v0.1 scope)
codesign -dv "/Volumes/Wiiwho Client/Wiiwho.app" 2>&1 | head
# → "code object is not signed at all" OR ad-hoc signature

# Eject
hdiutil detach "/Volumes/Wiiwho Client"
```

### If the Universal merge fails (Pitfall 6 from 03-RESEARCH.md)

`@electron/universal` byte-compares extraResources between arm64 + x64 builds. The config in Plan 03-11 ships **both** mac slots unconditionally in both arch builds — exactly the recommended fix for this pitfall. If it still fails, the likely escalation is adding the JRE slots to `singleArchFiles` in electron-builder.yml.

## Requirements status

| Requirement | Phase | Status | Notes |
|-------------|-------|--------|-------|
| PKG-02 | 3 | **Deferred (awaiting Mac)** | electron-builder.yml + all prep complete; blocked on running `pnpm run dist:mac` on macOS 12+ |
| JRE-02 | 3 | **Deferred (awaiting Mac)** | paths.ts darwin branches unit-tested; proving in a packaged Mac build requires PKG-02 first |

Neither is marked Complete in REQUIREMENTS.md. The verifier will flag both as `human_needed` — the correct outcome.

## Phase 3 gate interpretation

Phase 3's Success Criteria (from 03-CONTEXT.md) include **SC4**: "running `electron-builder` on macOS produces a DMG/ZIP bundling JRE + mod jar." Since the owner is on Windows tonight, SC4 cannot be auto-verified and is correctly flagged `human_needed`.

**All other phase-3 deliverables are complete:**

- 13 of 14 plans have full SUMMARY.md (00 through 11, plus this CHECKPOINT for 12)
- Windows NSIS path fully configured (Plan 03-11 smoke-built `win-unpacked/` successfully; NSIS final installer had its own Windows-specific environmental blocker — Developer Mode — tracked separately in 03-11 SUMMARY and STATE.md blockers)
- All LCH-* + LAUN-* + JRE-01 + JRE-03 + COMP-05 + PKG-01 (config-level) requirements complete
- Vanilla launch pipeline fully wired end-to-end (paths → settings → manifest → libraries → natives → args → spawn → log parser → crash watch → renderer UI → preload IPC → orchestrator)

The phase can legitimately move to verify/close with PKG-02 + JRE-02 carried forward as HUMAN-UAT items — not blocking the phase-gate decision.

## Files Created/Modified

- `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-12-macos-dmg-SUMMARY.md` — this file (CHECKPOINT marker)

No source code or config changes. Plan 03-11 already landed every artifact 03-12 would touch.

## Decisions Made

- **Plan 03-12 is CHECKPOINT, not FAILED, not DEFERRED-indefinitely.** The plan's own `autonomous: false` + `user_setup: mac-build-machine` frontmatter anticipates this exact outcome. SUMMARY exists (so plan counters treat it as processed) but requirements stay Pending (so traceability reflects truth).
- **PKG-02 and JRE-02 remain Pending in REQUIREMENTS.md.** Do NOT mark complete without a Mac operator producing the DMG + verifying the manual checks above. Marking early would falsify the traceability table the phase verifier reads.
- **STATE.md `stopped_at` updated** to reflect the checkpoint state so the phase-completion orchestrator knows the plan processed to its terminal state (awaiting human action), not that it hung mid-execution.

## Deviations from Plan

None — plan explicitly marked `autonomous: false` and the `user_setup` block documented Mac-unavailability as an acceptable path. This SUMMARY captures exactly the flow the plan's `<output>` section describes for the "DEFERRED" branch (Task 1 resume-signal "deferred"), with an added "what's-complete / what's-pending" split so a Mac operator can pick it up cold.

## Issues Encountered

None. This plan was executed as a checkpoint.

## User Setup Required

**A macOS 12+ machine with Node 22 + pnpm + JDK 17.** See the "What's pending" section above for the exact command sequence.

Alternative: GitHub Actions `macos-14` runner (CI pipeline not set up for this project at v0.1). A one-shot manual run from a borrowed or cloud Mac (MacStadium / AWS EC2 mac1.metal) is the simplest path.

## Next Phase Readiness

- Phase 4 (Forge integration, HUD framework, HUDs) does **not** depend on a produced macOS DMG. It depends on `paths.ts resolveModJar()` (complete in Plan 03-01) and the Windows launcher path (complete in Plan 03-11 up to `win-unpacked/`).
- Phase 7 (Release Hardening / PKG-03) **does** depend on this DMG existing — PKG-03's clean-machine macOS UAT requires a DMG to install. This is correctly captured by PKG-03 being a Phase 7 requirement.

No Phase 3 → Phase 4 blocker from the PKG-02 deferral.

## Self-Check: PASSED

Files verified to exist:

- FOUND: launcher/electron-builder.yml (mac: + dmg: blocks present, Universal target confirmed)
- FOUND: launcher/scripts/prefetch-jre.mjs (mac-x64 + mac-arm64 entries in SOURCES confirmed)
- FOUND: build/README-macOS.txt (RIGHT-CLICK text present)
- FOUND: launcher/build/README-macOS.txt
- FOUND: docs/install-macos.md (Rosetta 2 note present)
- FOUND: launcher/package.json (dist:mac script present)
- FOUND: .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-12-macos-dmg-PLAN.md

Not produced (awaiting Mac operator, expected):

- NOT PRODUCED: launcher/dist/Wiiwho.dmg

Commits verified (from Plan 03-11, the prep commits this CHECKPOINT relies on):

- FOUND: 1f34680 (scripts + package.json dist:mac)
- FOUND: 45f4491 (electron-builder.yml mac target + macOS docs)
- FOUND: 94da6e2 (prefetch-jre Windows compat — mac code paths unchanged)
- FOUND: d9ea5f4 (Plan 03-11 SUMMARY)

---

*Phase: 03-vanilla-launch-jre-bundling-packaging*
*Plan: 12*
*Status: CHECKPOINT — Mac build machine required*
*Completed: 2026-04-21 (checkpoint write; actual DMG production deferred)*
