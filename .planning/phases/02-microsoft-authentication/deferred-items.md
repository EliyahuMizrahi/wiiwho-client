# Phase 02 — Deferred Items

Out-of-scope discoveries logged during parallel plan execution.

## From plan 02-02 execution (2026-04-21)

- **vitest.config.ts typecheck failure**: `environmentMatchGlobs` does not exist in vitest 4.x `InlineConfig` type. This was introduced by plan 02-00's vitest config scaffold. Not our plan's scope — 02-00's verifier should handle, or a follow-up fix is needed. The runtime still works (vitest accepts the option in 4.x despite the type error); tests execute fine.
- **redact.test.ts failures (7)**: Plan 02-01's `installRedactor` implementation under concurrent development; unrelated to our two files. Leave for 02-01's executor/verifier.
