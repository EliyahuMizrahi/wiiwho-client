---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: Release Hardening
status: executing
stopped_at: Phase 4 context gathered
last_updated: "2026-04-24T03:25:13.794Z"
last_activity: 2026-04-21
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 25
  completed_plans: 24
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-20)

**Core value:** A single-click path from "open launcher" to "in a 1.8.9 game that runs faster than Optifine and has the HUD I want" — all without tripping PvP server anticheats.
**Current focus:** Phase 03 — vanilla-launch-jre-bundling-packaging

## Current Position

Phase: 4
Plan: Not started
Status: Ready to execute
Last activity: 2026-04-21

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: —

*Updated after each plan completion*
| Phase 01 P00 | 2 | 2 tasks | 6 files |
| Phase 01 P03 | 12 min | 2 tasks | 27 files |
| Phase 01-foundations P01 | 30min | 2 tasks | 16 files |
| Phase 01-foundations P04 | 2 min | 2 tasks | 2 files |
| Phase 01-foundations P02 | 45 min | 2 tasks | 4 files |
| Phase 02-microsoft-authentication P01 | 5min | 2 tasks | 4 files |
| Phase 02 P02 | 5min | 2 tasks | 4 files |
| Phase 02-microsoft-authentication P00 | 8min | 2 tasks | 6 files |
| Phase 02-microsoft-authentication P03 | 6min | 2 tasks | 6 files |
| Phase 02-microsoft-authentication P04 | 7min | 3 tasks | 8 files |
| Phase 02-microsoft-authentication P05 | 8min | 3 tasks | 10 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P01 | 5m | 2 tasks | 4 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P00 | 6 min | 3 tasks | 9 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P05-spawn-e2e | 12min | 2 tasks | 3 files |
| Phase 03 P02 | 10min | 2 tasks | 5 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P06 | 12min | 2 tasks | 4 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P08 | 15min | 3 tasks | 6 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P04 | 8 | 2 tasks | 4 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P03 | 10 min | 3 tasks | 7 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P07 | 11min | 3 tasks | 6 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P09 | ~3m | 2 tasks | 4 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P10 | 17min | 3 tasks | 10 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P11 | 23min | 3 tasks | 8 files |
| Phase 03-vanilla-launch-jre-bundling-packaging P12 | 5min (CHECKPOINT) | 0 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Roadmap compressed to 7 phases (standard granularity) from research's suggested 11
- 2026-04-23: Phase 4 "Launcher UI Polish" inserted between vanilla-launch and Forge-integration; Forge+HUDs → 5, Cosmetics → 6, Performance → 7, Release Hardening → 8. Total phase count now 8.
- Phase 1: Azure AD app registration is an external dependency — submit at Phase 1 start (1-7 day Microsoft review queue); Phase 2 is blocked without it
- Phase 1: Mod scaffold and launcher skeleton can be built in parallel — independent toolchains
- Phase 5: Anticheat review is ongoing across every feature phase, not a single phase; HUD framework must exist before individual HUDs
- Phase 7: Performance benchmark methodology MUST be committed before any optimization work — no "beats Optifine" claim without reproducible numbers
- [Phase 01]: Policy docs reproduced verbatim from 01-RESEARCH.md §Three Policy Doc Templates — no deviations from the research templates (they were designed specifically to satisfy the greppable check-docs.mjs contracts)
- [Phase 01]: scripts/check-docs.mjs is zero-dep Node 22 ESM — runnable with just 'node scripts/check-docs.mjs' before any pnpm install, so Wave 0 docs-check is the single repo-wide invariant every later plan can rely on without bootstrapping
- [Phase 01-foundations]: 2026-04-20 — MODID collision check: CurseForge and Modrinth both clean. Approved MODID wiiwho. Display name Wiiwho (only first W capitalized — user preference applied project-wide).
- [Phase 01-foundations]: 2026-04-20 — Launcher runtime verification (LAUN-01, LAUN-02, LAUN-06): owner ran pnpm --filter ./launcher dev on Windows; all 6 checks passed. Window ~1000x650 non-resizable, title 'Wiiwho Client', dark bg; cyan Play button logs stub payload on click; window.wiiwho.__debug.securityAudit() returned allTrue: true; typeof window.process and typeof window.require both 'undefined'; Object.keys(window.wiiwho) === ['auth','game','settings','logs','__debug']. Display name corrected from WiiWho → Wiiwho project-wide per owner preference.
- [Phase 01-foundations]: Runtime security verification pattern established: setAuditedPrefs() captures the exact webPreferences object passed to BrowserWindow, then __security:audit IPC returns the captured runtime state. Config-vs-runtime drift is observable (not assumed). Pattern reusable for future 'prove config matches runtime' checks.
- [Phase 01-foundations]: Named-Channel IPC surface locked at v0.1 scope: 5 top-level preload keys (auth, game, settings, logs, __debug), 13 channels total. Phase 2 fills auth.* handler bodies; Phase 3 fills game.*/settings.*/logs.*. Neither adds channels. Pitfall 5 (dead Play button) enforced by dependency absence — banned libs grep-checked out of launcher/package.json.
- [Phase 01-foundations]: 2026-04-20 — Display name locked as 'Wiiwho' (only first W capitalized) — applied project-wide via ModidTest.displayNameIsWiiwho assertion; MODID lowercase 'wiiwho' and package club.wiiwho unchanged
- [Phase 01-foundations]: 2026-04-20 — Azure AD app registered (Plan 01-04 Task 1). Application (client) ID: `60cbce02-072b-4963-833d-edb6f5badc2a`. Tenant ID displayed in portal: `91755ebc-8602-4281-970c-7be9bdfc35d7` (recorded as-displayed; Phase 2 uses `/consumers` authority string regardless per D-15). Audience: Personal Microsoft accounts only (consumers). Redirect URI: `https://login.microsoftonline.com/common/oauth2/nativeclient`. Public client flows: enabled. API permissions: User.Read (default — `XboxLive.signin` requested at runtime via OAuth scope, NOT in portal). Owner contact: `eliyahu6666@outlook.com`. Associated website: `https://github.com/EliyahuMizrahi/wiiwho-client`. MCE form submitted: 2026-04-20 via https://aka.ms/mce-reviewappid (MCE review form submitted). Microsoft review queue expected: 1-7 days (2026-04-21 to 2026-04-27). Client ID is non-secret per D-18 (public client / device code flow — no client secret exists). Phase 2 auth flow blocks on MCE approval email.
- [Phase 01-foundations]: 2026-04-20 — Azure AD app 'Wiiwho Client' registered (Plan 01-04). Client ID 60cbce02-072b-4963-833d-edb6f5badc2a (non-secret per D-18), tenant consumers (D-15). MCE form submitted 2026-04-20; review queue running (expected 2026-04-21 to 2026-04-27). Phase 2 auth execute blocks on approval email. docs/azure-app-registration.md is the maintainer reference.
- [Phase 01-foundations]: 2026-04-20 — Plan 01-02 Task 2 verified end-to-end on Windows. `./gradlew runClient` logs in via DevAuth browser OAuth (redirect to 127.0.0.1:3000, NOT device-code flow), launches Minecraft 1.8.9 with real MS username "Wiiwho", `[Wiiwho] Mixin hello - Minecraft.startGame hooked` fires (em-dash mojibake'd to CP1252 byte 0x97 in log — line presence is what matters), 4 mods load (mcp, FML, Forge, wiiwho). BONUS: connected to geo.minemen.club NA Practice lobby (runs Vanicheat/custom anticheat) and chatted publicly as Wiiwho (`Wiiwho: yo`, `Wiiwho: wsg gang`) without being kicked — `@Inject HEAD Minecraft.startGame` hook validated anticheat-safe on a real PvP server. DevAuth token cache persisted at `%USERPROFILE%\.devauth\microsoft_accounts.json`. Full MS OAuth chain (oauth→xbl→xsts→session) proven viable for Phase 2 MSAL implementation.
- [Phase 02-microsoft-authentication]: Plan 02-01: Rule 1 regex fix — broadened refresh_token/access_token patterns to match JSON-quoted form (research regex missed "refresh_token":"val" shape). Also ordered MC_ACCESS_PATTERN before JWT_PATTERN so nested accessToken JWT bodies redact to the cleaner "accessToken": "[REDACTED]" envelope.
- [Phase 02-microsoft-authentication]: Plan 02-01: AuthManager / future auth IPC handlers must call installRedactor() once at app.whenReady() before any log.* calls. Enforced as a convention; redactor is idempotent so multiple calls are safe.
- [Phase 02]: Plan 02-02: Option B chosen for token storage — non-secret auth.bin pointer + prismarine-auth encrypted per-cache-name files under userData/auth/<username>/*.bin. AUTH-04 structurally enforced (safeStorage fail-closed; pointer regex-rejects /token|secret|refresh/i keys at write boundary). 24 tests pass.
- [Phase 02-microsoft-authentication]: Plan 02-00: shadcn components manually inlined from new-york-v4 registry JSON (pnpm workspace hoist-pattern diff breaks npx shadcn add CLI); vitest 4 environmentMatchGlobs wrapped in 'as any' cast (runtime-works/types-removed gap)
- [Phase 02-microsoft-authentication]: Plan 02-03: AuthManager singleton wires the full MS auth lifecycle (device-code login, silent refresh, logout, AbortController-race cancel). Cancel branch returns the locked __CANCELLED__ sentinel AuthErrorView and does NOT route through mapAuthError — frozen IPC contract preserved via JSON.stringify(res.error) into the error:string slot for the renderer store to short-circuit on. Verified prismarine-auth 3.1.1 exposes no public cancel surface (grep -i cancel|abort returned zero in both index.d.ts and src/).
- [Phase 02-microsoft-authentication]: Plan 02-03: main/index.ts bootstrap order is load-bearing — installRedactor() runs FIRST inside app.whenReady() before any log call; createWindow is async and awaits getAuthManager().trySilentRefresh() BEFORE mainWindow.loadURL so the renderer's first auth:status sees the resolved state (D-02, Pitfall 7 — avoids login-flicker). registerAuthHandlers takes a getPrimaryWindow callback so macOS window-close-and-reopen cycles always resolve to the live BrowserWindow.
- [Phase 02-microsoft-authentication]: Plan 02-03: Rule 1 fixes — prismarine-auth 3.1.1's index.d.ts types are wrong in two places that our AuthManager straddles: (1) Cache interface demands a reset() method our PrismarineCache doesn't expose (cast to CacheFactory at boundary, keep Plan 02-02's locked surface); (2) codeCallback parameter is declared as snake_case ServerDeviceCodeResponse (live-flow only) but MSAL actually emits camelCase (typed param as unknown + narrow at boundary). Both casts documented inline with verification links.
- [Phase 02-microsoft-authentication]: Plan 02-04: Renderer auth scaffold — Zustand useAuthStore with 5-state machine; cancel-sentinel short-circuit locked on BOTH sides of the IPC wire now (main produces __CANCELLED__, renderer isCancelledSentinel fires BEFORE parseAuthError so sentinel never surfaces as ErrorBanner copy — UI-SPEC line 216 guardrail). LoginScreen/LoadingScreen/ErrorBanner render verbatim UI-SPEC §Copywriting Contract strings. App.tsx state-driven routing with 300ms min-hold + 8s fallback. font-bold fully removed from Phase 2 codebase (migration complete).
- [Phase 02-microsoft-authentication]: Plan 02-04: vitest 4 + RTL 16 renderer-test patterns locked — (1) @vitest-environment jsdom docblock at top of every renderer-side test file (config-level environmentMatchGlobs cast to 'any' was runtime-unreliable in vitest 4); (2) afterEach(cleanup) in every describe block of component tests (vitest 4 + RTL 16 does NOT auto-cleanup; without it 9/11 component tests fail with 'Found multiple elements'). Both patterns are now the established idiom for this launcher and any future renderer-side tests must follow them.
- [Phase 02-microsoft-authentication]: Plan 02-05: DeviceCodeModal + AccountBadge ship all D-06/D-07/D-13/D-14/D-15 UI-SPEC contract; AUTH-01 + AUTH-05 + AUTH-06 complete. Device-code UI is code (text-2xl font-mono tracking-[0.15em] + aria-live) + Copy/Open-in-browser/Stop signing in + countdown + expired retry. AccountBadge is mc-heads.net 32x32 skin head + username (truncate max-w-[120px]) + chevron + dropdown with full UUID + instant Log out (no confirm). Generate new code calls cancelLogin-then-login to bypass Plan 04's concurrent-login guard (auto-fix Rule 1). Radix DropdownMenu+jsdom needs userEvent.setup()+Element.prototype pointer-capture stubs (auto-fix Rule 3). cancelLogin optimistic set is redundant-but-safe with __CANCELLED__ sentinel short-circuit — zero observable divergence, eliminates 100ms modal-flash on cancel.
- [Phase 02-microsoft-authentication]: Plan 02-05: Radix-in-jsdom testing pattern locked — userEvent.setup() + async user.click for any Radix primitive that uses pointer capture (DropdownMenu, Popover, ContextMenu, Select, Tooltip). fireEvent.click remains correct for non-Radix Buttons and for <img onError>. Element.prototype.hasPointerCapture / releasePointerCapture / scrollIntoView stubs via structural cast (as unknown as {...}) at the top of any test file that imports Radix primitives. window.open(url,_blank,noopener) is the correct renderer-side external-url path in Electron 41 with sandbox+contextIsolation — system browser is the default handler, confirmed during manual QA.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-01: paths.ts exports 7 platform-branched resolvers (Data/Settings/Game/CrashReports/Jre/JavaBinary/ModJar); JRE-03 + Pitfall 7 (javaw.exe) enforced by test
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-01: redact.ts adds 6 D-20 patterns + sanitizeCrashReport export — single scrub() pipeline drives both electron-log hook AND crash viewer (D-21)
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Plan 03-00: p-queue resolved to 9.1.2 (plan specified ^8.x; 9.x has semver-compatible add/concurrency/onIdle/onEmpty API for library-download concurrency-ceiling use). Shadcn Sheet/Slider/Tooltip land from new-york-v4 registry verbatim — registry JSONs already use unified radix-ui import convention matching existing dialog.tsx, zero import rewrites. Fixtures co-located under __fixtures__/ adjacent to consuming module (launch/__fixtures__ for manifest, monitor/__fixtures__ for boot log + crash report). Gitignore rules at repo-root .gitignore (not launcher/.gitignore) so JRE/mod resource dirs are blocked regardless of which cwd scripts run from. Wave-1 parallel executor observation: typecheck:node transiently errors from 03-01's RED-phase paths.test.ts until 03-01's GREEN commit lands — out of 03-00 scope per deviation Rule scope boundary.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: spawn.ts: execa 9.x wrapper; JRE-03 invariant enforced inline (belt-and-braces); non-zero exit returned via {exitCode}, not thrown; _JAVA_OPTIONS=undefined to block env heap-override
- [Phase 03]: Settings persistence: plain JSON + atomic temp+rename at <userData>/settings.json. Clamp ramMb to [1024,4096] in 512 MiB steps at BOTH IPC and store layers (defense in depth). Unknown schema version → DEFAULTS; partial-invalid field → per-field fallback preserving valid siblings. wiiwho.d.ts tightened from Record<string,unknown> to SettingsV1 in Plan 03-02 (non-breaking; unblocks Plans 03-07/03-10).
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-06: MAIN_MENU_PATTERN uses loose [.*?/INFO]: prefix per RESEARCH verbatim — matches Sound Library Loader path AND any silent-fallback variants. 30s fallback timer fires onMainMenu({reason:timeout}) so launcher never hangs on undetected boot. Crash watch uses String(filename) not typeof-narrow (TS2339 workaround); missing crashDir resolves null so orchestrator can pair with ring-buffer-tail fallback. readCrashReport returns RAW UTF-8 — single-sanitizer invariant (D-21) enforced at IPC boundary.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Plan 03-08: D-21 invariant enforced by TWO tests — runtime identity (writeText arg === <pre>.textContent) + source-grep regression guard (no scrub/sanitize/redact imports in CrashViewer.tsx). Belt-and-suspenders pairing — either alone could be defeated by a clever future edit.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Plan 03-08: useGameStore keeps IPC unsubs + exitFallbackTimer as module-level state (outside Zustand reactive state) to avoid stale Timeout references on strict-mode double-mount. Local GameAPIExtensions type augment in game.ts (deletable when Plan 03-09's wiiwho.d.ts update lands) lets this plan compile standalone.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Open Q §3 RESOLVED: @xmcl/installer does NOT auto-extract LWJGL natives — natives.ts owns the gap via yauzl (transitive dep)
- [Phase 03-vanilla-launch-jre-bundling-packaging]: args.ts hardcodes VANILLA_MAIN_CLASS / VANILLA_ASSET_INDEX / MSA_USER_TYPE — pins Pitfall 2 + 8 + LCH-06 at type level, not runtime parse
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Phase 5 seam: LaunchInputs.forgeTweaks?: string[] accepted by buildArgv but deliberately ignored in Phase 3 (Test 12 pins inertness)
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Plan 03-03: ensureClientJar hand-rolled over fetch + createHash('sha1'); @xmcl/installer 6.1.2 has no installMinecraftJar helper (plan's referenced name). Keeps 'SHA1 mismatch' error string in our code so Plan 03-10 orchestrator can pattern-match for D-14 retry UX without scraping third-party errors. ensureLibraries races a reject-on-abort Promise against installLibraries because LibraryOptions doesn't type abortSignal. ensureAssets delegates to installAssets with same cast pattern.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Plan 03-03: Natives extraction OWNED BY PLAN 03-04. installLibraries downloads classifier jars (e.g. lwjgl-platform-natives-windows.jar) to libraries/ but does NOT unzip into versions/<id>/natives/. Plan 03-04's natives.ts must iterate ResolvedVersion.libraries where isNative===true, unzip honouring extract.exclude (typically META-INF/), hand directory to args.ts for -Djava.library.path.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Plan 03-03: SC5 regression asserted via synthetic payload with locally-computed SHA1, NOT the real 3870888... client.jar SHA1 — would require shipping 8 MB of Mojang bytes (violates docs/mojang-asset-policy.md). Contract tested: on-disk SHA1 == advertised SHA1 after ensureClientJar, which is preserved regardless of which value stands in for 'advertised'. On SHA1 mismatch the temp file (.jar.tmp) is NEVER renamed to the final path — integration Test D proves no silently-wrong cache survives.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Plan 03-07: useSettingsStore mirrors main-side clamp via readSetResponse defensive parse (boundary-cast survives Phase-1 stub wiiwho.d.ts shape until 03-09 narrows). RamSlider component-scoped TooltipProvider avoids forcing upstream provider. SettingsDrawer fully controlled (open+onOpenChange); all three D-02 gestures flow through onOpenChange. Test-harness gaps: ResizeObserver jsdom stub added to pointer-capture trio (required for Radix Slider under jsdom 25). Shadcn Slider does NOT forward aria-label to Thumb — accessible-name test uses visible <label htmlFor> + root aria-label via [data-slot='slider'] querySelector. Radix Tooltip duplicates content (visible portal + sr-only announcer) — use findAllByText. Escape-dismiss test needs userEvent + dialog.focus (DismissableLayer registers in useEffect; handler only fires when layer is topmost after registration cycle flushes).
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-09 D-11 extension: new IPC surface members (game.onLog/onExited/onCrashed, logs.openCrashFolder/listCrashReports) live UNDER existing top-level keys. Channel count 13→18; 5 top-level keys unchanged.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-09 LCH-06 seam: AuthManager.getMinecraftToken() returns {accessToken, username, uuid}. Reuses silent-refresh Authflow (no codeCallback); throws on logged-out/missing-profile/unavailable-keychain. Raw token never enters log pipeline (static-source guard on top of redact.ts).
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Orchestrator emits 'downloading' BEFORE fetchAndCacheManifest runs so Cancel covers the manifest fetch too (D-13 widened)
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Dropped 'failed' phase emit from main orchestrator — renderer's 6s fallback timer is the single trigger (avoids race)
- [Phase 03-vanilla-launch-jre-bundling-packaging]: Established vi.hoisted() mock-bag pattern for all TypeScript vitest tests with vi.mock() factories
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-11: Open Q §1 RESOLVED — x64 Temurin ships in BOTH mac slots (mac-x64 + mac-arm64). Temurin has no arm64 JRE; 1.8.9 LWJGL natives are x86_64-only; Rosetta 2 handles execution transparently. Saves ~70 MB vs Azul Zulu arm64 + keeps a single SHA256 API surface.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-11: PKG-01 NSIS smoke-build BLOCKED by environmental issue — electron-builder 26.8.1 unconditionally extracts winCodeSign-2.6.0.7z (contains macOS dylib symlinks); Windows without Developer Mode/admin cannot create symlinks. Unblock via Settings → Privacy & Security → For developers → Developer Mode: On. electron-builder.yml config + dist:win script chain verified complete; win-unpacked/ produced correctly with all extraResources.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-11: prefetch-jre.mjs Windows-specific hardening — bsdtar (System32/tar.exe) for .tar.gz (MSYS GNU tar misparses C:\ as rsh host:path); renameSync retry+cpSync fallback for AV/indexer handle-retention EPERM races. Idempotent per-slot population check via <slot>/bin/javaw.exe or <slot>/Contents/Home/bin/java probe.
- [Phase 03-vanilla-launch-jre-bundling-packaging]: 03-12: CHECKPOINT — macOS DMG requires Mac build machine; all prep artifacts authored in Plan 03-11; PKG-02 + JRE-02 remain Pending in REQUIREMENTS.md (correct — verifier flags as human_needed). SUMMARY.md documents exact resume command for a Mac operator.

### Pending Todos

None yet.

### Blockers/Concerns

- **External dependency:** Azure AD app Minecraft API scope approval (Microsoft review queue, 1-7 days). Must start at Phase 1 to unblock Phase 2. Track separately from phase status.
- Phase 03 Plan 11: NSIS installer smoke build requires Windows Developer Mode enabled OR admin shell. electron-builder 26.8.1 unconditionally extracts winCodeSign-2.6.0.7z which contains macOS dylib symlinks. All config + scripts complete and committed; environmental fix alone should unblock.
- Plan 03-12 (PKG-02 + JRE-02): macOS Universal DMG requires running 'pnpm --filter ./launcher run dist:mac' on a macOS 12+ machine. All prep artifacts complete via Plan 03-11. See 03-12-macos-dmg-SUMMARY.md for exact resume command + verification checklist.

## Session Continuity

Last session: 2026-04-24T03:25:13.790Z
Stopped at: Phase 4 context gathered
Resume file: .planning/phases/04-launcher-ui-polish/04-CONTEXT.md
