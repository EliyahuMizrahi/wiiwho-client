---
phase: 02-microsoft-authentication
plan: 04
subsystem: renderer-auth-ui
tags: [zustand, react, login-screen, loading-screen, error-banner, app-routing, vitest-jsdom, tdd]

# Dependency graph
requires:
  - phase: 02-microsoft-authentication/02-00
    provides: zustand 5.0.12 + lucide-react + shadcn Button + @testing-library/react 16 installed
  - phase: 02-microsoft-authentication/02-03
    provides: frozen auth:* IPC surface + __CANCELLED__ sentinel wire contract
provides:
  - "useAuthStore — Zustand store with loading/logged-out/logging-in/logged-in/error state machine"
  - "parseAuthError + isCancelledSentinel — renderer-side JSON deserialization helpers"
  - "LoginScreen — D-04 composition (wordmark + Log in with Microsoft + version + conditional ErrorBanner)"
  - "LoadingScreen — D-02 silent-refresh visible state (wordmark + Loader2 spinner + version)"
  - "ErrorBanner — D-08/09/10 inline banner (role=alert; Try again + conditional Help; dismiss ×)"
  - "App.tsx state-driven routing with 300ms LoadingScreen minimum-hold + 8s fallback"
  - "@vitest-environment jsdom docblock pattern for renderer-side test files"
affects:
  - 02-05 (DeviceCodeModal + AccountBadge): will consume the same useAuthStore; DeviceCodeModal mounts when state === 'logging-in' and onDeviceCode pushes a code; AccountBadge mounts inside the Play-forward branch of App.tsx
  - 02-06 (final QA): renderer is now the observable surface for AUTH-05 (logged-in username+uuid visible) and AUTH-03 (plain-English error messages from D-10 — wired via ErrorBanner → parseAuthError)

# Tech tracking
tech-stack:
  added: []  # all deps installed in 02-00
  patterns:
    - "@vitest-environment jsdom docblock pragma — vitest 4's environmentMatchGlobs is cast to `as any` (runtime-only) in launcher/vitest.config.ts; the docblock pragma is the officially supported vitest 4 path and is guaranteed to load jsdom regardless of config drift. Locked for all future renderer-side test files."
    - "afterEach(cleanup) in every RTL component test — vitest 4 + @testing-library/react 16 does NOT auto-cleanup DOM between tests; without it, back-to-back render() calls stack nodes in the same jsdom document and queries like getByRole('button') throw 'Found multiple elements'. Pattern locked for all future React component tests in this launcher."
    - "Cancel-sentinel short-circuit rides BEFORE parseAuthError — the renderer store's login action checks isCancelledSentinel(res.error) before calling parseAuthError, mirroring the main-process contract that the sentinel never reaches user-facing copy."
    - "LoadingScreen minimum-hold + fallback-timeout interact independently — setTimeout(LOADING_MIN_MS=300) holds the screen visible even after store resolves (prevents sub-100ms flash); setTimeout(LOADING_FALLBACK_MS=8000) forces state='logged-out' if the store never leaves 'loading'. Both are cleared on unmount."

key-files:
  created:
    - launcher/src/renderer/src/stores/auth.ts
    - launcher/src/renderer/src/stores/__tests__/auth.test.ts
    - launcher/src/renderer/src/components/LoginScreen.tsx
    - launcher/src/renderer/src/components/LoadingScreen.tsx
    - launcher/src/renderer/src/components/ErrorBanner.tsx
    - launcher/src/renderer/src/components/__tests__/LoginScreen.test.tsx
    - launcher/src/renderer/src/components/__tests__/ErrorBanner.test.tsx
  modified:
    - launcher/src/renderer/src/App.tsx

key-decisions:
  - "Renderer CANCELLED sentinel detection lives as a dedicated isCancelledSentinel helper (not inline in the login reducer) so it is greppable, testable, and self-documenting. The helper parses the JSON defensively — malformed JSON returns false, so no cancel-sentinel false-positive can fire on corrupt IPC responses."
  - "parseAuthError fallback for malformed error strings returns {code:null, message:raw, helpUrl:null} instead of throwing or returning undefined. This preserves the state='error' transition even if the main-process serialization is ever broken, so the user sees *some* message in the ErrorBanner rather than a ghost error state."
  - "@vitest-environment jsdom docblock over environmentMatchGlobs — vitest 4 removed environmentMatchGlobs from the typed InlineConfig and the Plan 02-00 scaffold had to cast the config to `any`. First renderer test file (auth.test.ts) discovered at runtime that the cast alone was insufficient — the globs weren't being honored and jsdom was not loading. Docblock pragma is the officially supported path and works on every test file independently of config-level types."
  - "afterEach(cleanup) in every component test — first RTL test run failed 9 of 11 cases with 'Found multiple elements' because vitest 4's RTL-16 integration doesn't auto-cleanup. Explicit cleanup() pattern is now locked for the launcher."
  - "App.tsx holds 300ms LoadingScreen even after store resolves — avoids the 'login screen briefly flashes before play-forward' effect when silent refresh completes in <100ms. Separate from the 8s fallback which fires only if the store never leaves 'loading' (network hang during silent refresh)."
  - "LoginScreen handles all three of 'logged-out' | 'logging-in' | 'error' via internal store selectors — App.tsx does not branch on these. Rationale: the button disabled state and ErrorBanner visibility are render-time conditions on the same screen; splitting them across App.tsx and LoginScreen would make the LoginScreen harder to reason about in isolation."

patterns-established:
  - "vitest 4 + jsdom: docblock pragma `/** @vitest-environment jsdom */` at the top of every renderer-side test file — locks jsdom loading regardless of future vitest config shape changes"
  - "RTL + vitest 4: `afterEach(() => { cleanup() })` in every describe block — prevents duplicate-element query errors across back-to-back render() calls"
  - "Renderer sentinel check mirrors main: `isCancelledSentinel(raw)` parses JSON defensively and matches on `parsed.message === '__CANCELLED__'`; fires BEFORE the generic parseAuthError fallback so the sentinel never reaches UI as an ErrorBanner"

requirements-completed: [AUTH-05]
# AUTH-05: Display signed-in username + UUID in launcher UI — delivered via
# Play-forward branch of App.tsx showing `{username} · v0.1.0-dev`; full AccountBadge
# with UUID + dropdown lands in Plan 02-05.
# Note: AUTH-01 and AUTH-03 are partially covered but not yet fully deliverable —
# AUTH-01 device-code modal lands in 02-05; AUTH-03 plain-English errors are
# plumbed end-to-end but the full visual QA gate is 02-06.

# Metrics
duration: 7min
completed: 2026-04-21
---

# Phase 02 Plan 04: Renderer-side auth scaffold (Store + LoginScreen/LoadingScreen/ErrorBanner + App.tsx switch) Summary

**Renderer now consumes the Phase 02 frozen auth:* IPC surface through a Zustand store, routes between LoginScreen / LoadingScreen / Play-forward based on the auth state machine, and exposes D-04/D-02/D-08-10 visuals verbatim from UI-SPEC. The cancel-sentinel short-circuit (UI-SPEC line 216 guardrail) is locked on both wire-contract sides now — main produces `__CANCELLED__` in AuthErrorView.message, renderer detects and silently returns to `logged-out` without surfacing an ErrorBanner.**

## Performance

- **Duration:** ~7 min (wall)
- **Started:** 2026-04-21T03:54:12Z
- **Completed:** 2026-04-21T04:01:37Z
- **Tasks:** 3 (Tasks 1 and 2 TDD RED→GREEN; Task 3 single-commit direct implementation)
- **Files touched:** 8 (7 created, 1 modified)

## Accomplishments

- **`useAuthStore`** (Zustand 5.0.12): 5-state machine (loading / logged-out / logging-in / logged-in / error). `initialize()` is idempotent (second call is a no-op; `initialized` boolean gate is set before the `await` so concurrent initialize calls don't double-fire status()). `login()` has a concurrent guard (ignores re-entry while state === 'logging-in'). `logout()` clears `username`+`uuid`. `dismissError()` only fires when state === 'error', resets to logged-out with error cleared.
- **`parseAuthError(raw)`** — robust JSON.parse with shape validation: returns the parsed `{code, message, helpUrl}` shape when valid, falls back to `{code: null, message: raw, helpUrl: null}` on malformed input. Never throws. Handles the frozen IPC `error?: string` contract where the main process JSON-stringifies the full AuthErrorView into one wire field.
- **`isCancelledSentinel(raw)`** — dedicated helper that parses defensively and matches on `parsed.message === '__CANCELLED__'`. Fires BEFORE parseAuthError in the login reducer so the sentinel short-circuits to `state: 'logged-out', error: undefined` without ever reaching UI. This is the UI-SPEC line 216 "no banner — silent return to LoginScreen" guardrail.
- **`LoginScreen`** (D-04): verbatim copy from UI-SPEC §Copywriting Contract — `Wiiwho Client` wordmark (text-4xl font-semibold cyan), `Log in with Microsoft` primary CTA (cyan bg + neutral-950 text, Phase-1 Play-button proportions text-xl px-12 py-6), `v0.1.0-dev` version text (text-xs font-normal neutral-500). ErrorBanner mounts conditionally under the button when state === 'error' && error (width 360px, mt-4 gap). Button is disabled while state === 'logging-in'.
- **`LoadingScreen`** (D-02): same wordmark styling, `Loader2` from lucide-react with `motion-safe:animate-spin size-6 text-neutral-500 mt-2`, version text in same position as LoginScreen so the layout stays stable during login → loading → play transitions. aria-label "Signing you in" for screen readers.
- **`ErrorBanner`** (D-08/09/10): `role="alert"` on the container; AlertCircle icon (red-500 size-5) + message body (text-sm font-normal neutral-300) + dismiss × (aria-label "Dismiss error"); Try again button (cyan size-sm) wired to store.login; Help link (`target="_blank" rel="noreferrer"`, hover underline) renders ONLY when `error.helpUrl` is non-null. motion-safe slide-in-from-top-1 enter.
- **`App.tsx`** state-driven routing: mounts → `initialize()` on effect; LoadingScreen holds until both (a) state leaves 'loading' AND (b) 300ms minimum-hold elapses; `state === 'logged-in'` renders Play-forward with `{username} · v0.1.0-dev`; everything else renders LoginScreen (which handles its own state-dependent rendering via selectors). Wordmark migrated `font-bold → font-semibold` per UI-SPEC Rev 1 Dimension 4 migration.
- **`LOADING_MIN_MS = 300`** and **`LOADING_FALLBACK_MS = 8000`** constants hoisted — avoids magic numbers and makes the Pitfall 7 comment load-bearing in both the code and the SUMMARY.

## Task Commits

Atomic, TDD, `--no-verify` per parallel-mode protocol:

1. **Task 1 RED — auth store test** — `434d70b` (test)
2. **Task 1 GREEN — auth store impl + typecheck fix (removed unused @ts-expect-error)** — `0b9036b` (feat)
3. **Task 2 RED — LoginScreen + ErrorBanner tests** — `b4af1f3` (test)
4. **Task 2 GREEN — LoginScreen + LoadingScreen + ErrorBanner + afterEach(cleanup) pattern** — `6cc85fd` (feat)
5. **Task 3 — App.tsx state-driven routing + font-bold→font-semibold migration** — `5aab6fa` (feat)

## LoadingScreen Hold + Fallback — How They Interact

Two `setTimeout` handles live in a single `useEffect` inside App.tsx and they fire independently:

| Timer                   | Duration | Effect                                                            |
| ----------------------- | -------- | ----------------------------------------------------------------- |
| `LOADING_MIN_MS`        | 300ms    | `setLoadingHeld(false)` — releases the minimum-visible gate       |
| `LOADING_FALLBACK_MS`   | 8000ms   | If store.state is still `'loading'`, force `setState({state:'logged-out', initialized:true})` |

Render condition: `state === 'loading' || loadingHeld` → `<LoadingScreen />`.

This means:

- **Silent refresh resolves in 50ms:** store transitions to `'logged-in'`/`'logged-out'` immediately, but `loadingHeld` stays `true` until 300ms → LoadingScreen stays visible for the full 300ms, then switches to the resolved state. No flash.
- **Silent refresh resolves in 500ms:** store transitions at 500ms; by then `loadingHeld` is already `false` (fired at 300ms); switch happens immediately at 500ms.
- **Silent refresh hangs for 8s+:** the fallback fires at 8s, forces `state='logged-out'`, LoadingScreen unmounts, LoginScreen appears. No ErrorBanner per D-03 (silent-refresh failure is quiet).
- **Component unmounts before any timer fires:** both timers are cleared in the effect cleanup; no setState on unmounted component warnings.

Both timers are dependency-free (`useEffect(..., [initialize])` — `initialize` is a stable Zustand selector, effect runs exactly once).

## Cancel-Sentinel End-to-End Confirmation

The `__CANCELLED__` guardrail is now locked on both sides of the wire:

| Layer               | Source                                          | Behavior                                                  |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| Main (Plan 02-03)   | AuthManager cancel branch                       | Builds `{code:null, message:'__CANCELLED__', helpUrl:null}` directly (never routes through mapAuthError) |
| IPC handler         | ipc/auth.ts auth:login                          | `JSON.stringify(res.error)` into the frozen `error?: string` slot |
| Renderer (this plan)| `useAuthStore.login` action                     | `isCancelledSentinel(res.error)` short-circuits to `state: 'logged-out', error: undefined` BEFORE parseAuthError |
| LoginScreen         | `state === 'error' && error` guard              | ErrorBanner never mounts on cancel (state is `'logged-out'`, not `'error'`) |

**Test guardrail:** `useAuthStore > auth.cancelled transitions to logged-out (UI-SPEC line 216 - no banner, silent return)` asserts after login():
- `s.state === 'logged-out'` (NOT `'error'`)
- `s.error === undefined` (if this ever becomes a parsed object, ErrorBanner would render `__CANCELLED__` as user copy)
- `s.username` and `s.uuid` both `undefined`

This test runs on every `pnpm run test:run` and is the last line of defense against the sentinel ever leaking into user-facing copy.

## Font-Bold → Font-Semibold Migration (UI-SPEC Rev 1)

Before this plan: `launcher/src/renderer/src/App.tsx` line 34 shipped `text-4xl font-bold text-[#16e0ee]` for the wordmark. This violated the UI-SPEC Dimension 4 typography cap (exactly 2 weights: font-normal + font-semibold).

After this plan:

```bash
$ grep -rn "font-bold" launcher/src/renderer/src/ | grep -v "\.test\."
(no matches)

$ grep -rn "font-bold" launcher/src/renderer/src/
launcher/src/renderer/src/components/__tests__/LoginScreen.test.tsx:56:    expect(heading.className).not.toMatch(/font-bold/)
```

The only remaining occurrence is a **negative assertion** in the LoginScreen test that actively guards against future regression. All three wordmark sites (LoginScreen, LoadingScreen, Play-forward in App.tsx) now use `text-4xl font-semibold text-[#16e0ee]`.

## React Testing Library Gotchas Encountered

Two real gotchas surfaced during Task 2 GREEN — both are now documented above in `tech-stack.patterns` and commit `6cc85fd`:

1. **vitest 4 + RTL 16 does NOT auto-cleanup between tests.** The first test run showed 9 of 11 tests failing with `TestingLibraryElementError: Found multiple elements with the role "button"`. Adding `afterEach(() => { cleanup() })` to every describe block resolved all of them. The base `@testing-library/jest-dom/vitest` import installs matchers (`toBeInTheDocument()`, etc.) but does NOT wire auto-cleanup.
2. **`environmentMatchGlobs` cast to `as any` in vitest.config.ts is runtime-unreliable in vitest 4.** The first run of auth.test.ts had `environment 0ms` and `typeof window === 'undefined'` — proof jsdom wasn't loading despite the config-level glob. `@vitest-environment jsdom` docblock pragma at the top of each renderer test file is the portable fix and now the established pattern for this codebase.

Neither gotcha required config changes — both fixed at the test-file level, keeping Plan 02-00's vitest.config.ts surface intact.

## Total Test Counts

| File                                                                    | `it(` count | Runtime tests |
| ----------------------------------------------------------------------- | ----------: | ------------: |
| `launcher/src/renderer/src/stores/__tests__/auth.test.ts`               |          12 |            12 |
| `launcher/src/renderer/src/components/__tests__/LoginScreen.test.tsx`   |           6 |             6 |
| `launcher/src/renderer/src/components/__tests__/ErrorBanner.test.tsx`   |           5 |             5 |
| **Plan total**                                                          |      **23** |        **23** |

Full launcher suite: **110 / 110 passed** across 13 test files (up from 99 baseline after Task 1; up from 87 baseline pre-plan).

## Verification Evidence

| Check                                                                                                                      | Expected  | Actual                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------: | ----------------------: |
| `pnpm run test:run` (full suite)                                                                                           |    exit 0 | **110 / 110 green**     |
| `pnpm run typecheck`                                                                                                       |    exit 0 | **pass** (node+web)     |
| `pnpm run build` (electron-vite)                                                                                           |    exit 0 | **pass** — main 17.44 kB, preload 1.41 kB, renderer 673.68 kB |
| `grep -c "font-bold" launcher/src/renderer/src/App.tsx`                                                                    |         0 | **0**                   |
| `grep -c "font-semibold" launcher/src/renderer/src/App.tsx`                                                                |       ≥ 1 | **1**                   |
| `grep -c "LOADING_MIN_MS" launcher/src/renderer/src/App.tsx`                                                               |       ≥ 1 | **2**                   |
| `grep -c "LOADING_FALLBACK_MS" launcher/src/renderer/src/App.tsx`                                                          |       ≥ 1 | **3**                   |
| `grep -c "__CANCELLED__" launcher/src/renderer/src/stores/auth.ts`                                                         |       ≥ 1 | **6**                   |
| `grep -c "window.wiiwho.auth" launcher/src/renderer/src/stores/auth.ts`                                                    |       ≥ 3 | **5** (status × 2, login, logout, + doc ref) |
| `grep -c "role=\"alert\"" launcher/src/renderer/src/components/ErrorBanner.tsx`                                            |         1 | **1**                   |
| `grep -c "target=\"_blank\"" launcher/src/renderer/src/components/ErrorBanner.tsx`                                         |         1 | **1**                   |
| `grep -c "aria-label=\"Dismiss error\"" launcher/src/renderer/src/components/ErrorBanner.tsx`                              |         1 | **1**                   |
| `grep -l "useAuthStore" launcher/src/renderer/src/` lists App.tsx + LoginScreen.tsx + ErrorBanner.tsx                      |        ≥3 | **yes** (plus auth.ts + test files) |
| `grep -rn "ipcRenderer\|from ['\"]electron['\"]" launcher/src/renderer/src/stores/auth.ts`                                 |         0 | **0** (goes through preload bridge only) |
| Sentinel check ordering: `isCancelledSentinel(res.error)` appears BEFORE `parseAuthError(res.error)` in `login` action     |      true | **true** (line 159 vs line 178) |

## Decisions Made

See frontmatter `key-decisions`. Load-bearing summary:

1. **`@vitest-environment jsdom` docblock over config-level globs.** First renderer-side test discovered `environmentMatchGlobs` wasn't being applied reliably in vitest 4 despite the Plan 02-00 `as any` cast. Docblock pragma is officially supported and file-scoped so future refactors can't break it silently.
2. **`afterEach(cleanup)` as a locked pattern for component tests.** vitest 4 + RTL 16 doesn't auto-cleanup and 9/11 component tests failed on first run without it.
3. **Dedicated `isCancelledSentinel` helper (not inline).** Greppable, testable, defensive on malformed JSON. Sits BEFORE parseAuthError in the login reducer so the sentinel can never leak to UI.
4. **`parseAuthError` fallback to `{code:null, message:raw, helpUrl:null}` on malformed JSON.** Preserves the state='error' transition so the user always sees some banner even if main-process serialization is ever broken.
5. **300ms LoadingScreen minimum-hold separate from 8s fallback.** Prevents sub-100ms flash on fast silent refresh; fallback handles the opposite case (silent refresh hangs). Both timers are independent and both are cleared on unmount.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Removed unused `@ts-expect-error` directive in auth.test.ts**
- **Found during:** Task 1 GREEN first `pnpm run typecheck` pass.
- **Issue:** `tsc` failed `TS2578: Unused '@ts-expect-error' directive.` The plan's `<action>` block included `// @ts-expect-error — test harness shim` above `globalThis.window = globalThis.window ?? {}`, but when jsdom loads properly, `globalThis.window` is already defined and no type error actually needs suppressing.
- **Fix:** Replaced the directive + fallback assignment with a plain-comment shim pattern; relies on the `@vitest-environment jsdom` pragma (added as fix #2 below) to guarantee `window` exists.
- **Files modified:** `launcher/src/renderer/src/stores/__tests__/auth.test.ts` (Task 1 GREEN commit `0b9036b`)

**2. [Rule 3 — Blocker] Added `@vitest-environment jsdom` docblock to unblock renderer-side test execution**
- **Found during:** Task 1 GREEN, second test run attempt after removing the `@ts-expect-error` + fallback.
- **Issue:** Test failed with `TypeError: Cannot set properties of undefined (setting 'wiiwho')` — despite `launcher/vitest.config.ts` declaring `environmentMatchGlobs: [['src/renderer/**', 'jsdom'], ...]`, vitest 4 did not load jsdom for the test (`environment 0ms` in runner output vs ~700-1400ms when jsdom is actually loaded). The Plan 02-00 config cast to `any` was runtime-unreliable for vitest 4.
- **Fix:** Added `@vitest-environment jsdom` docblock at the top of `auth.test.ts`. This is the vitest 4 officially supported mechanism and is file-scoped so it can never drift from config-level type casts. Same pragma used in both component test files (LoginScreen.test.tsx and ErrorBanner.test.tsx).
- **Files modified:** all three test files (in commits `0b9036b` and `6cc85fd`)
- **Pattern locked:** all future renderer-side test files must start with the docblock.

**3. [Rule 3 — Blocker] Added `afterEach(() => cleanup())` to LoginScreen + ErrorBanner tests**
- **Found during:** Task 2 GREEN first test run.
- **Issue:** 9 of 11 component tests failed with `TestingLibraryElementError: Found multiple elements with the role "button"` / `Found multiple elements with the text...`. vitest 4 + @testing-library/react 16 does NOT auto-cleanup the jsdom DOM between tests — rendered nodes from the previous test persist when the next test calls `render()`, so queries like `getByRole('button')` match the union of both renders.
- **Fix:** Imported `cleanup` from `@testing-library/react` and added `afterEach(() => { cleanup() })` in every `describe` block of the two component test files.
- **Files modified:** `launcher/src/renderer/src/components/__tests__/LoginScreen.test.tsx` + `ErrorBanner.test.tsx` (Task 2 GREEN commit `6cc85fd`)
- **Pattern locked:** all future React component tests must `afterEach(cleanup)`.

---

**Total deviations:** 3 auto-fixed. All three were Rule-eligible (1 × Rule 1, 2 × Rule 3) and all three are vitest-4-era environment issues that couldn't have been known at plan-writing time. Observable behavior matches the plan exactly — the sentinel contract, the 3 visual screens, the state-driven routing with 300ms min-hold + 8s fallback, and the font-bold → font-semibold migration.

## Issues Encountered

- **First run of auth.test.ts exited with "TypeError: Cannot set properties of undefined"** — diagnosed as jsdom not loading despite environmentMatchGlobs config entry (vitest 4 behavior). Fixed with `@vitest-environment jsdom` docblock.
- **First run of LoginScreen+ErrorBanner tests failed 9/11 on "Found multiple elements"** — diagnosed as vitest 4 + RTL 16 lacking auto-cleanup. Fixed with explicit `afterEach(cleanup)`.
- **IDE `suggestCanonicalClasses` warnings on App.tsx** — the Tailwind extension suggests `text-wiiwho-accent` / `bg-wiiwho-accent` over the hex-literal forms. Left as hex literals because (a) UI-SPEC Dimension 3 §Color uses the hex literal notation in all Phase 2 usage-site examples; (b) Plan 02-04 acceptance criteria explicitly grep for `bg-[#16e0ee]` in LoginScreen; and (c) keeping the style consistent across App.tsx / LoginScreen / LoadingScreen / ErrorBanner avoids a mixed idiom. Warnings are cosmetic (`severity: Warning`) and do not fail typecheck or build.

## Stub / Not-Wired Components

None — every component created in this plan has its data source wired and is rendered for its declared state. DeviceCodeModal and AccountBadge are deferred to Plan 02-05 by design (plan frontmatter `files_modified` does not include them; the plan objective explicitly states "DeviceCodeModal + AccountBadge land in Plan 05").

## Next Phase Readiness

- **Plan 02-05 (DeviceCodeModal + AccountBadge):** Can now subscribe to `useAuthStore.state === 'logging-in'` to mount the DeviceCodeModal, and subscribe to `window.wiiwho.auth.onDeviceCode(cb)` to populate it. AccountBadge slots into the Play-forward branch of App.tsx (where `{username} · v0.1.0-dev` currently lives) and consumes `useAuthStore.username` + `useAuthStore.uuid`.
- **Plan 02-06 (final QA):** LoginScreen, LoadingScreen, and ErrorBanner are now observable for manual QA walking `docs/MANUAL-QA-auth.md`. The D-10 plain-English XSTS error mapping flows end-to-end: AuthManager → mapAuthError → AuthErrorView → JSON.stringify → IPC → parseAuthError → ErrorBanner visible copy.

## Self-Check: PASSED

Files verified on disk:

- FOUND: `launcher/src/renderer/src/stores/auth.ts`
- FOUND: `launcher/src/renderer/src/stores/__tests__/auth.test.ts`
- FOUND: `launcher/src/renderer/src/components/LoginScreen.tsx`
- FOUND: `launcher/src/renderer/src/components/LoadingScreen.tsx`
- FOUND: `launcher/src/renderer/src/components/ErrorBanner.tsx`
- FOUND: `launcher/src/renderer/src/components/__tests__/LoginScreen.test.tsx`
- FOUND: `launcher/src/renderer/src/components/__tests__/ErrorBanner.test.tsx`
- FOUND: `launcher/src/renderer/src/App.tsx` (modified)

Commits verified:

- FOUND: `434d70b` test(02-04) auth store RED
- FOUND: `0b9036b` feat(02-04) auth store GREEN
- FOUND: `b4af1f3` test(02-04) LoginScreen + ErrorBanner RED
- FOUND: `6cc85fd` feat(02-04) LoginScreen + LoadingScreen + ErrorBanner GREEN
- FOUND: `5aab6fa` feat(02-04) App.tsx state-driven routing + font-semibold migration

Full verification suite:

- `pnpm run test:run` → **110 / 110 passed** across 13 test files
- `pnpm run typecheck` → **exit 0** (node + web)
- `pnpm run build` → **exit 0** (main + preload + renderer)

---
*Phase: 02-microsoft-authentication*
*Plan: 04*
*Completed: 2026-04-21*
