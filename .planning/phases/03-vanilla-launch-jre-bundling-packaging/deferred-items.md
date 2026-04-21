# Phase 03 — Deferred Items

## Pre-existing lint errors found during Plan 03-10 execution (2026-04-21)

Plan 03-10 did not modify these files, but `pnpm run lint` surfaces errors in:

- `launcher/src/renderer/src/components/__tests__/ErrorBanner.test.tsx` — `@typescript-eslint/explicit-function-return-type` + `react-hooks/set-state-in-effect`
- `launcher/src/renderer/src/components/__tests__/RamSlider.test.tsx` — `@typescript-eslint/explicit-function-return-type` (×6)
- `launcher/src/renderer/src/components/__tests__/SettingsDrawer.test.tsx` — `@typescript-eslint/explicit-function-return-type` (×2)

These originated in Phase 2 and Plans 03-07 / 03-08. Out of scope for Plan 03-10 (orchestrator + logs IPC + App wiring).

## Notes

- All files TOUCHED by Plan 03-10 pass `eslint --fix` with 0 errors + 0 warnings.
- Plan 03-10 test suite: 354 tests passing; typecheck clean.
