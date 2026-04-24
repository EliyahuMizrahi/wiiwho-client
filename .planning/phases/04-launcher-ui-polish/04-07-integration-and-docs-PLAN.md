---
phase: 04-launcher-ui-polish
plan: 07
type: execute
wave: 6
depends_on:
  - 04-02
  - 04-03
  - 04-04
  - 04-05
  - 04-06
files_modified:
  - launcher/src/renderer/src/App.tsx
  - launcher/src/renderer/src/__tests__/App.integration.test.tsx
  - launcher/src/main/index.ts
  - launcher/src/renderer/src/test/antiBloat.test.tsx
  - docs/DESIGN-SYSTEM.md
  - scripts/check-docs.mjs
autonomous: false
requirements:
  - UI-01
  - UI-03
  - UI-04
  - UI-05
  - UI-06
  - UI-07
user_setup:
  - service: manual-smoke
    why: "Final phase UAT — human performs the smoke checklist from 04-VALIDATION.md Manual-Only Verifications before phase is marked complete."
    env_vars: []
    dashboard_config:
      - task: "Sign off each row of the exclusion checklist in docs/DESIGN-SYSTEM.md §Exclusion checklist"
        location: "docs/DESIGN-SYSTEM.md (Reviewer sign-off table)"
must_haves:
  truths:
    - "App.tsx renders <Sidebar /> + main-area router (Play | Cosmetics) + <SettingsModal /> + <AccountBadge /> + <DeviceCodeModal /> + <CrashViewer /> when crashed (all components integrated)"
    - "App.tsx section swap uses AnimatePresence mode='wait' with opacity+y 8px slide, durationMed + EASE_STANDARD"
    - "App.tsx no longer imports SettingsDrawer; no gear icon in top-right (replaced by sidebar bottom gear from Plan 04-02)"
    - "App.tsx useEffect initializes useSettingsStore + useSpotifyStore + useAuthStore + subscribeGame (teardown on unmount)"
    - "main/index.ts registers the Spotify IPC handlers on app.whenReady()"
    - "docs/DESIGN-SYSTEM.md contains all D-36 sections including the literal 'Exclusion checklist' heading with all 18 enumerated items"
    - "The exclusion checklist literal string 'WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content' appears verbatim"
    - "DESIGN-SYSTEM.md §Colors preset table carries a footnote: 'Preset names and hexes reflect RESEARCH-tuned values; D-13 listed Red/Yellow/Gray as illustrative starting points.'"
    - "scripts/check-docs.mjs extended with a DESIGN-SYSTEM section validator"
    - "A repo-wide grep test verifies zero ad/news/friends/concurrent-user markup in launcher/src/renderer outside of the exclusion-checklist doc"
  artifacts:
    - path: "launcher/src/renderer/src/App.tsx"
      provides: "Integrated root: sidebar + main-area router + modal + overlays"
    - path: "launcher/src/renderer/src/__tests__/App.integration.test.tsx"
      provides: "Integration test for the full logged-in tree"
    - path: "docs/DESIGN-SYSTEM.md"
      provides: "Design system documentation per UI-07 + exclusion checklist per UI-05"
      contains: "## Exclusion checklist"
    - path: "launcher/src/renderer/src/test/antiBloat.test.tsx"
      provides: "Repo-wide grep test enforcing UI-05 anti-bloat invariant"
    - path: "scripts/check-docs.mjs"
      provides: "Extended with DESIGN-SYSTEM section validators"
  key_links:
    - from: "launcher/src/renderer/src/App.tsx"
      to: "Sidebar + Play + Cosmetics + SettingsModal + SpotifyMiniPlayer + DeviceCodeModal"
      via: "conditional render based on authState + activeSection"
      pattern: "<Sidebar|<SettingsModal|<Play|<Cosmetics|<DeviceCodeModal"
    - from: "launcher/src/main/index.ts"
      to: "registerSpotifyHandlers"
      via: "app.whenReady() bootstrap"
      pattern: "registerSpotifyHandlers"
    - from: "docs/DESIGN-SYSTEM.md"
      to: "UI-05 exclusion checklist (verified by antiBloat.test.tsx)"
      via: "literal heading + item list"
      pattern: "## Exclusion checklist"
---

<objective>
Final Phase 4 integration wave. Rewrite App.tsx's logged-in branch to compose the Sidebar + main-area router + SettingsModal + AccountBadge + DeviceCodeModal + CrashViewer (Crashed takeover preserved). Register the Spotify IPC handlers in main/index.ts. Create the UI-07 design system documentation (`docs/DESIGN-SYSTEM.md`) with all D-36 sections including the literal UI-05 Exclusion checklist. Extend `scripts/check-docs.mjs` with a validator that enforces the design-system doc structure. Create the repo-wide anti-bloat grep test (UI-05). Final phase commit + human-sign-off smoke checkpoint.

Purpose: Stitch the prior 6 plans into a functioning launcher UI, document it, enforce UI-05 with an automated grep, and hand the phase off to owner smoke-test.

Output: Integrated App.tsx + bootstrap wiring + docs/DESIGN-SYSTEM.md + extended check-docs.mjs + antiBloat.test.tsx + human smoke-verify checkpoint + phase completion commit.
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@.planning/phases/04-launcher-ui-polish/04-VALIDATION.md
@launcher/src/renderer/src/App.tsx
@launcher/src/renderer/src/components/DeviceCodeModal.tsx
@launcher/src/renderer/src/components/LoginScreen.tsx
@launcher/src/main/index.ts
@scripts/check-docs.mjs
@.planning/phases/04-launcher-ui-polish/04-01-tokens-and-settings-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-02-sidebar-and-main-area-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-03-settings-modal-chrome-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-04-theme-picker-appearance-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-05-spotify-main-process-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-06-spotify-renderer-ui-SUMMARY.md
</context>

<interfaces>
From prior plans (all landed before this plan runs):
```typescript
// Plan 04-02
export function Sidebar(): React.JSX.Element
export function Play(): React.JSX.Element
export function Cosmetics(): React.JSX.Element
export const useActiveSectionStore

// Plan 04-03
export function SettingsModal(): React.JSX.Element

// Plan 04-06
export function SpotifyMiniPlayer()  // already slotted into Sidebar
export const useSpotifyStore

// Plan 04-01
export const useSettingsStore  // with theme + modal state + initialize that re-applies accent

// Phase 2/3 retained
export function LoginScreen, LoadingScreen, DeviceCodeModal, CrashViewer, AccountBadge
```

Phase 2 DeviceCodeModal contract (re-verified by executor):
```typescript
// launcher/src/renderer/src/components/DeviceCodeModal.tsx
export function DeviceCodeModal(): React.JSX.Element
// Self-contained: reads useAuthStore.deviceCode; renders nothing when undefined.
// Safe to mount in multiple branches — internally guards against missing payload.
```
Phase 2 rendered DeviceCodeModal inside LoginScreen. Phase 4 ADDITIONALLY mounts it in the logged-in tree so re-auth / token-refresh device-code pushes surface correctly without routing the user back to LoginScreen.

From Plan 04-05:
```typescript
export function registerSpotifyHandlers(getPrimaryWindow: () => BrowserWindow | null): void
```
Registered via main/index.ts alongside existing auth/game/settings/logs handlers.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: App.tsx rewrite — sidebar + main-area router + modal integration; main/index.ts wires Spotify handlers</name>
  <files>launcher/src/renderer/src/App.tsx, launcher/src/renderer/src/__tests__/App.integration.test.tsx, launcher/src/main/index.ts</files>
  <read_first>
    - launcher/src/renderer/src/App.tsx (current shape — keep auth + crash + device-code lifecycle, rewrite logged-in tree)
    - launcher/src/renderer/src/components/DeviceCodeModal.tsx (Phase 2 contract — self-contained, reads useAuthStore.deviceCode, safe to mount anywhere)
    - launcher/src/renderer/src/components/LoginScreen.tsx (currently also renders DeviceCodeModal — Phase 2 behavior preserved; we ADD a second mount to the logged-in tree, not replace)
    - launcher/src/main/index.ts (current bootstrap order — installRedactor + registerAuthHandlers + registerGameHandlers + registerSettingsHandlers + registerLogsHandlers)
    - launcher/src/renderer/src/components/Sidebar.tsx + MainArea/Play.tsx + MainArea/Cosmetics.tsx + SettingsModal.tsx
    - launcher/src/renderer/src/stores/spotify.ts (initialize + teardown lifecycle)
    - launcher/src/renderer/src/theme/motion.ts (DURATION_MED + EASE_STANDARD)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack → §Pattern C (section route fade JSX)
  </read_first>
  <behavior>
    - App.tsx logged-in tree becomes:
      ```
      <div className="h-screen w-screen flex overflow-hidden bg-wiiwho-bg">
        <Sidebar />
        <main className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div key={activeSection} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration: DURATION_MED, ease: EASE_STANDARD }}>
              {activeSection === 'play' ? <Play /> : <Cosmetics />}
            </motion.div>
          </AnimatePresence>
          <div className="absolute top-4 right-4 z-10"><AccountBadge /></div>
        </main>
        <SettingsModal />
        <DeviceCodeModal />
      </div>
      ```
    - **DeviceCodeModal MUST be mounted in the logged-in tree** (belt-and-suspenders): Phase 2's LoginScreen mount covers first-login device-code pushes; the new logged-in-tree mount covers re-auth / token-refresh pushes that fire while the user is on Play/Cosmetics. DeviceCodeModal is self-guarding (renders nothing when useAuthStore.deviceCode is undefined), so double-mounting during state transitions is safe.
    - App.tsx useEffect adds `useSpotifyStore.getState().initialize()` + `useSpotifyStore.getState().teardown()` teardown on unmount
    - Remove: gear icon button in top-right + SettingsDrawer import + settingsOpen local state (that's now in useSettingsStore)
    - CrashViewer branch unchanged (still a full-page takeover)
    - main/index.ts: registerSpotifyHandlers call added after the existing logs handlers. Import: `import { registerSpotifyHandlers } from './ipc/spotify'`
    - App.integration.test.tsx verifies the logged-in tree: Sidebar + Play visible by default, click Cosmetics → Play unmounts + Cosmetics mounts, click Settings gear → Modal appears; DeviceCodeModal mounts (and surfaces the device code when auth store fires a device-code payload); crashed state still renders CrashViewer full-page (regression check)
  </behavior>
  <action>
    1. Create `launcher/src/renderer/src/__tests__/App.integration.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import App from '../App'
    import { useAuthStore } from '../stores/auth'
    import { useGameStore } from '../stores/game'
    import { useSettingsStore } from '../stores/settings'
    import { useSpotifyStore } from '../stores/spotify'
    import { useActiveSectionStore } from '../stores/activeSection'

    Element.prototype.hasPointerCapture = (() => false) as never
    Element.prototype.releasePointerCapture = (() => {}) as never
    Element.prototype.scrollIntoView = (() => {}) as never

    vi.mock('motion/react', () => ({
      motion: new Proxy({}, { get: () => (p: Record<string, unknown>) => {
        const { initial, animate, exit, transition, layoutId, ...rest } = p as Record<string, unknown>
        return React.createElement('div', rest as never)
      } }),
      AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
      useReducedMotion: () => false,
    }))
    import React from 'react'

    beforeEach(() => {
      ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
        auth: {
          status: vi.fn().mockResolvedValue({ loggedIn: true, username: 'Wiiwho', uuid: 'u-1' }),
          login: vi.fn(),
          logout: vi.fn().mockResolvedValue({ ok: true }),
          onDeviceCode: vi.fn().mockReturnValue(() => {}),
        },
        game: {
          status: vi.fn().mockResolvedValue({ state: 'idle' }),
          play: vi.fn(),
          cancel: vi.fn(),
          onStatus: vi.fn().mockReturnValue(() => {}),
          onProgress: vi.fn().mockReturnValue(() => {}),
          onLog: vi.fn().mockReturnValue(() => {}),
          onExited: vi.fn().mockReturnValue(() => {}),
          onCrashed: vi.fn().mockReturnValue(() => {}),
        },
        settings: {
          get: vi.fn().mockResolvedValue({ version: 2, ramMb: 2048, firstRunSeen: true, theme: { accent: '#16e0ee', reduceMotion: 'system' } }),
          set: vi.fn(),
        },
        logs: { readCrash: vi.fn(), openCrashFolder: vi.fn(), listCrashReports: vi.fn() },
        __debug: { securityAudit: vi.fn().mockResolvedValue({ contextIsolation: true, nodeIntegration: false, sandbox: true, allTrue: true }) },
        spotify: {
          connect: vi.fn(),
          disconnect: vi.fn(),
          status: vi.fn().mockResolvedValue({ connected: false }),
          control: { play: vi.fn(), pause: vi.fn(), next: vi.fn(), previous: vi.fn() },
          setVisibility: vi.fn().mockResolvedValue({ ok: true }),
          onStatusChanged: vi.fn().mockReturnValue(() => {}),
        },
      }

      useAuthStore.setState({
        state: 'logged-in',
        username: 'Wiiwho',
        uuid: '12345678-1234-1234-1234-1234567890ab',
        initialized: true,
        initialize: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        deviceCode: undefined,
      } as never)
      useGameStore.setState({ phase: { state: 'idle' }, subscribe: () => () => {}, play: vi.fn(), resetToIdle: vi.fn() } as never)
      useSettingsStore.setState({
        version: 2, ramMb: 2048, firstRunSeen: true,
        theme: { accent: '#16e0ee', reduceMotion: 'system' },
        hydrated: true, modalOpen: false, openPane: 'general',
      } as never)
      useSpotifyStore.setState({ state: 'disconnected', displayName: null, isPremium: 'unknown', currentTrack: null, lastError: null } as never)
      useActiveSectionStore.setState({ section: 'play' } as never)
    })
    afterEach(() => { cleanup(); vi.clearAllMocks() })

    describe('App — logged-in integration', () => {
      it('renders Sidebar (nav with Play + Cosmetics + Settings gear)', () => {
        render(<App />)
        expect(screen.getByRole('navigation', { name: /primary navigation/i })).toBeDefined()
      })

      it('renders Play section as default main area (wordmark "Wiiwho Client" visible)', () => {
        render(<App />)
        expect(screen.getByRole('heading', { level: 1, name: /wiiwho client/i })).toBeDefined()
      })

      it('renders AccountBadge top-right (not a sidebar Account row — E-03)', () => {
        render(<App />)
        expect(screen.getByLabelText(/account menu for wiiwho/i)).toBeDefined()
      })

      it('clicking Cosmetics sidebar row swaps main area to Cosmetics', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.click(screen.getByRole('button', { name: /cosmetics/i }))
        expect(screen.getByRole('heading', { name: 'Cosmetics coming soon' })).toBeDefined()
      })

      it('clicking Settings gear opens SettingsModal (role="dialog" appears)', async () => {
        const user = userEvent.setup()
        render(<App />)
        await user.click(screen.getByRole('button', { name: /open settings/i }))
        expect(screen.getByRole('dialog')).toBeDefined()
      })

      it('App no longer imports SettingsDrawer (source-grep regression)', async () => {
        const fs = await import('node:fs')
        const src = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
        expect(src).not.toMatch(/SettingsDrawer/)
      })

      it('App imports and mounts <DeviceCodeModal /> in the logged-in tree (Phase 2 regression guard)', async () => {
        const fs = await import('node:fs')
        const src = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
        expect(src).toMatch(/import\s*\{\s*DeviceCodeModal\s*\}\s*from\s*['"]\.\/components\/DeviceCodeModal['"]/)
        expect(src).toMatch(/<DeviceCodeModal\s*\/?>/)
      })

      it('DeviceCodeModal surfaces the device code when auth store fires a device-code payload while logged-in', () => {
        // Simulate a re-auth device-code push arriving during logged-in state.
        useAuthStore.setState({
          deviceCode: {
            userCode: 'WIIW-TEST',
            verificationUri: 'https://microsoft.com/link',
            expiresInSec: 900,
          },
        } as never)
        render(<App />)
        // DeviceCodeModal renders the user code when deviceCode payload is present.
        // Exact text assertion matches DeviceCodeModal's current output (Phase 2).
        expect(screen.getByText(/WIIW-TEST/)).toBeDefined()
      })

      it('crashed gamePhase still routes to CrashViewer (Phase 3 D-18 preserved)', () => {
        useGameStore.setState({ phase: { state: 'crashed', sanitizedBody: 'crash body', crashId: 'c-1' }, subscribe: () => () => {}, play: vi.fn(), resetToIdle: vi.fn() } as never)
        render(<App />)
        // CrashViewer is rendered full-page; Sidebar should NOT also render
        expect(screen.queryByRole('navigation', { name: /primary navigation/i })).toBeNull()
      })

      it('App useEffect initializes useSpotifyStore', async () => {
        render(<App />)
        await new Promise((r) => setTimeout(r, 20))
        expect(window.wiiwho.spotify.status).toHaveBeenCalled()
      })
    })
    ```

    2. Rewrite `launcher/src/renderer/src/App.tsx`:

    ```tsx
    /**
     * App root — Phase 4 layout.
     *
     * Logged-in branch:
     *   <Sidebar /> | <main> AnimatePresence(Play | Cosmetics) + <AccountBadge> </main> | <SettingsModal /> | <DeviceCodeModal />
     *
     * Phase 3 SettingsDrawer and the top-right gear icon were removed:
     *   - The gear moved into Sidebar bottom (Plan 04-02).
     *   - The drawer was replaced with a bottom-slide modal (Plan 04-03).
     *
     * DeviceCodeModal is mounted in BOTH LoginScreen (Phase 2, first-login) AND
     * here (Phase 4, covers re-auth / token-refresh pushes that fire while
     * logged-in). The component is self-guarding — it renders nothing when
     * useAuthStore.deviceCode is undefined, so double-mount is safe.
     *
     * Lifecycle:
     *   - initializeAuth (Phase 2)
     *   - initializeSettings (Phase 3 — now also rehydrates theme.accent to :root)
     *   - subscribeGame (Phase 3)
     *   - initializeSpotify (Phase 4 — subscribes to onStatusChanged + window focus/blur for polling cadence)
     */
    import { useEffect, useState } from 'react'
    import { motion, AnimatePresence } from 'motion/react'
    import { useAuthStore } from './stores/auth'
    import { useGameStore } from './stores/game'
    import { useSettingsStore } from './stores/settings'
    import { useSpotifyStore } from './stores/spotify'
    import { useActiveSectionStore } from './stores/activeSection'
    import { LoginScreen } from './components/LoginScreen'
    import { LoadingScreen } from './components/LoadingScreen'
    import { AccountBadge } from './components/AccountBadge'
    import { DeviceCodeModal } from './components/DeviceCodeModal'
    import { Sidebar } from './components/Sidebar'
    import { SettingsModal } from './components/SettingsModal'
    import { Play } from './components/MainArea/Play'
    import { Cosmetics } from './components/MainArea/Cosmetics'
    import { CrashViewer } from './components/CrashViewer'
    import { DURATION_MED, EASE_STANDARD } from './theme/motion'

    console.assert(
      typeof (globalThis as unknown as { process?: unknown }).process === 'undefined',
      'SECURITY: process is defined in renderer — nodeIntegration is NOT off'
    )
    console.assert(
      typeof (globalThis as unknown as { require?: unknown }).require === 'undefined',
      'SECURITY: require is defined in renderer — contextIsolation or sandbox is NOT set'
    )

    const LOADING_MIN_MS = 300
    const LOADING_FALLBACK_MS = 8000

    function App(): React.JSX.Element {
      const authState = useAuthStore((s) => s.state)
      const initializeAuth = useAuthStore((s) => s.initialize)
      const subscribeGame = useGameStore((s) => s.subscribe)
      const gamePhase = useGameStore((s) => s.phase)
      const resetGame = useGameStore((s) => s.resetToIdle)
      const playGame = useGameStore((s) => s.play)
      const initSettings = useSettingsStore((s) => s.initialize)
      const initSpotify = useSpotifyStore((s) => s.initialize)
      const teardownSpotify = useSpotifyStore((s) => s.teardown)
      const activeSection = useActiveSectionStore((s) => s.section)
      const [loadingHeld, setLoadingHeld] = useState(true)

      useEffect(() => {
        void initializeAuth()
        void initSettings()
        void initSpotify()
        const unsubscribeGame = subscribeGame()
        const unsubDeviceCode = window.wiiwho.auth.onDeviceCode((payload) => {
          useAuthStore.getState().setDeviceCode(payload)
        })
        const fallback = setTimeout(() => {
          const current = useAuthStore.getState().state
          if (current === 'loading') {
            useAuthStore.setState({ state: 'logged-out', initialized: true })
          }
        }, LOADING_FALLBACK_MS)
        const minHold = setTimeout(() => setLoadingHeld(false), LOADING_MIN_MS)
        void (async (): Promise<void> => {
          const audit = await window.wiiwho.__debug.securityAudit()
          console.log('Security audit:', audit)
        })()

        return (): void => {
          unsubDeviceCode()
          unsubscribeGame()
          teardownSpotify()
          clearTimeout(fallback)
          clearTimeout(minHold)
        }
      }, [initializeAuth, subscribeGame, initSettings, initSpotify, teardownSpotify])

      if (authState === 'loading' || loadingHeld) return <LoadingScreen />
      if (authState !== 'logged-in') return <LoginScreen />

      if (gamePhase.state === 'crashed') {
        return (
          <CrashViewer
            sanitizedBody={gamePhase.sanitizedBody}
            crashId={gamePhase.crashId}
            onClose={() => resetGame()}
            onPlayAgain={() => { resetGame(); void playGame() }}
            onOpenCrashFolder={(crashId) => { void window.wiiwho.logs.openCrashFolder(crashId ?? undefined) }}
          />
        )
      }

      return (
        <div className="h-screen w-screen flex overflow-hidden" style={{ backgroundColor: 'var(--color-wiiwho-bg)' }}>
          <Sidebar />
          <main className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                className="h-full w-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION_MED, ease: [...EASE_STANDARD] as unknown as [number, number, number, number] }}
              >
                {activeSection === 'play' ? <Play /> : <Cosmetics />}
              </motion.div>
            </AnimatePresence>
            <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
              <AccountBadge />
            </div>
          </main>
          <SettingsModal />
          <DeviceCodeModal />
        </div>
      )
    }

    export default App
    ```

    **NOTE on DeviceCodeModal placement:** Place `<DeviceCodeModal />` immediately after `<SettingsModal />` inside the root `<div>`. Both are top-level overlays; order does not affect z-index (each owns its own portal/fixed positioning), but keeping them adjacent makes the "overlay rack" visually obvious to future readers. Before writing, read the current `launcher/src/renderer/src/components/DeviceCodeModal.tsx` to confirm it takes no required props.

    3. Update `launcher/src/main/index.ts`:
       - Read current bootstrap order; add `registerSpotifyHandlers(getPrimaryWindow)` call after `registerLogsHandlers`.
       - Add import at top: `import { registerSpotifyHandlers } from './ipc/spotify'`.
       - Do NOT disturb the existing `installRedactor()` call at app.whenReady's top — preserve its first-position invariant.

    4. Run tests.
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/__tests__/App.integration.test.tsx && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep "<Sidebar" launcher/src/renderer/src/App.tsx` returns 1 hit.
    - `grep "<SettingsModal" launcher/src/renderer/src/App.tsx` returns 1 hit.
    - `grep "<Play" launcher/src/renderer/src/App.tsx` returns 1 hit.
    - `grep "<Cosmetics" launcher/src/renderer/src/App.tsx` returns 1 hit.
    - `grep "<DeviceCodeModal" launcher/src/renderer/src/App.tsx` returns ≥1 hit (Phase 2 regression guard — device-code flow accessible in logged-in tree for re-auth / token-refresh).
    - `grep "import { DeviceCodeModal } from './components/DeviceCodeModal'" launcher/src/renderer/src/App.tsx` returns 1 hit.
    - `grep "SettingsDrawer" launcher/src/renderer/src/App.tsx` returns 0 hits (fully removed).
    - `grep "SettingsIcon" launcher/src/renderer/src/App.tsx` returns 0 hits (gear moved to sidebar).
    - `grep "AnimatePresence" launcher/src/renderer/src/App.tsx` returns 1 hit.
    - `grep "initSpotify" launcher/src/renderer/src/App.tsx` returns ≥1 hit.
    - `grep "registerSpotifyHandlers" launcher/src/main/index.ts` returns ≥1 hit.
    - App.integration.test.tsx (10 assertions incl. DeviceCodeModal import-grep + runtime device-code surfacing) passes.
    - `pnpm typecheck` exits 0.
    - `pnpm --filter ./launcher run test:run` full suite exits 0.
  </acceptance_criteria>
  <done>App.tsx integrated (incl. DeviceCodeModal in logged-in tree); main bootstrap wires Spotify handlers; full suite green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: docs/DESIGN-SYSTEM.md + extended check-docs.mjs + antiBloat.test.tsx repo-wide grep</name>
  <files>docs/DESIGN-SYSTEM.md, scripts/check-docs.mjs, launcher/src/renderer/src/test/antiBloat.test.tsx</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §DESIGN-SYSTEM.md Outline (skeleton to expand)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-36 (exact sections + "Exclusion checklist" content)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-13 (preset color names — Red/Yellow/Gray illustrative; RESEARCH retuned to Crimson/Amber/Slate for WCAG contrast)
    - scripts/check-docs.mjs (existing Phase 1 policy doc validator — extend with new section checks)
    - launcher/src/renderer/src/test/antiBloat.test.tsx (Wave 0 stub — replace with real grep test)
    - docs/ANTICHEAT-SAFETY.md (Phase 1 style reference for how docs are structured)
  </read_first>
  <behavior>
    - docs/DESIGN-SYSTEM.md has 8 top-level sections:
      1. ## Philosophy
      2. ## Tokens (with subsections: Colors, Typography, Spacing, Motion)
      3. ## Usage examples (Play button, Sidebar with active pill, Settings modal, Spotify mini-player, Theme picker)
      4. ## Iconography (lucide-react ISC)
      5. ## Typography provenance (Inter SIL OFL 1.1 + JetBrains Mono Apache 2.0 with exact source URLs)
      6. ## Hero art provenance (owner-drawn — placeholder gradient stub in v0.1)
      7. ## Exclusion checklist — with the LITERAL string "WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content" plus all 18 bulleted items from RESEARCH
      8. ## Changelog
    - §Colors > Presets table carries a footnote line: "Preset names and hexes reflect RESEARCH-tuned values; D-13 listed Red/Yellow/Gray as illustrative starting points." (one-line documentation of the D-13 → RESEARCH substitution that Plan 04-01's presets.ts already implements — Crimson/Amber/Slate rather than Red/Yellow/Gray, for WCAG 2.1 SC 1.4.11 contrast on `#111111`).
    - Reviewer sign-off table with one row per section
    - check-docs.mjs extended to scan docs/DESIGN-SYSTEM.md for the 8 required headings + the literal exclusion-checklist substring
    - antiBloat.test.tsx reads every .tsx/.ts file under launcher/src/renderer/src/ (excluding node_modules, excluding the exclusion-checklist doc path, excluding test files themselves), scans source text for banned markers, asserts 0 hits. Banned markers: common ad/news/social strings in visible copy (not in comments).
  </behavior>
  <action>
    1. Create `docs/DESIGN-SYSTEM.md` following the skeleton in RESEARCH §DESIGN-SYSTEM.md Outline, expanded with concrete values from this phase:

    ```markdown
    # Wiiwho Design System

    Last updated: 2026-04-24 (Phase 4 — Launcher UI Polish)

    ## 1. Philosophy

    Dark, gamer, anti-bloat. Inspired by Lunar Client, Badlion, and Feather — adopts
    their polish, rejects their marketing layer. One user-picked accent color. Zero
    ads, news, or social surfaces. The launcher's job is to get you into Minecraft
    faster with the HUD you want; it is not an engagement surface.

    ## 2. Tokens

    Source of truth: `launcher/src/renderer/src/global.css` `@theme` block.
    JS-side mirrors live in `launcher/src/renderer/src/theme/{presets.ts,motion.ts}`.

    ### 2.1 Colors

    | Token | Value | Purpose |
    |-------|-------|---------|
    | `--color-wiiwho-bg` | `#111111` | Base background |
    | `--color-wiiwho-surface` | `#1a1a1a` | Raised surfaces (modal, sidebar) |
    | `--color-wiiwho-border` | `#262626` | 1px dividers |
    | `--color-accent` (runtime-mutable) | default `#16e0ee` | Primary CTA, focus rings, active sidebar pill |

    Accent presets (8 total — all WCAG 2.1 SC 1.4.11 Non-text Contrast ≥3:1 vs `#111111`):

    | Preset | Hex | Contrast |
    |--------|-----|----------|
    | Cyan (default — D-13) | `#16e0ee` | 11.1:1 |
    | Mint                  | `#22c55e` | 8.6:1 |
    | Violet                | `#a855f7` | 5.6:1 |
    | Tangerine             | `#f97316` | 7.8:1 |
    | Pink                  | `#ec4899` | 6.2:1 |
    | Crimson               | `#f87171` | 7.4:1 |
    | Amber                 | `#fbbf24` | 11.2:1 |
    | Slate                 | `#cbd5e1` | 11.6:1 |

    > **Note:** Preset names and hexes reflect RESEARCH-tuned values; D-13 listed
    > Red/Yellow/Gray as illustrative starting points. RESEARCH retuned those three
    > slots to Crimson (`#f87171`), Amber (`#fbbf24`), and Slate (`#cbd5e1`) to meet
    > WCAG 2.1 SC 1.4.11 Non-text Contrast ≥3:1 against `--color-wiiwho-bg` (`#111111`).
    > See `launcher/src/renderer/src/theme/presets.ts` for the authoritative tuple.

    ### 2.2 Typography

    - **Inter Variable** (SIL OFL 1.1) — body + UI. Self-hosted woff2 at `launcher/src/renderer/src/assets/fonts/inter/`.
    - **JetBrains Mono Variable** (Apache 2.0) — device codes, UUIDs, build hashes. Self-hosted woff2 at `launcher/src/renderer/src/assets/fonts/jetbrains-mono/`.
    - Both declared with `font-display: swap` (Pitfall 3 — avoids FOIT).
    - Scale: Tailwind default (text-xs 12 / text-sm 14 / text-base 16 / text-xl 20 / text-2xl 24 / text-4xl 36).

    ### 2.3 Spacing

    Tailwind default 4px-base scale. Layout constants:

    | Constant | Value |
    |----------|-------|
    | `--layout-sidebar-width` | 220px |
    | `--layout-window-width`  | 1280px |
    | `--layout-window-height` | 800px  |
    | `--layout-modal-height`  | 560px (70% of viewport) |

    ### 2.4 Motion

    | Token | Value | CSS consumers |
    |-------|-------|---------------|
    | `--duration-fast` | 120ms | Button hover, focus rings |
    | `--duration-med`  | 200ms | Drawer/modal fade, section swap |
    | `--duration-slow` | 320ms | Settings modal slide-up, accent color transitions |
    | `--ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Enter/exit (modal, drawer) |
    | `--ease-standard`   | `cubic-bezier(0.4, 0, 0.2, 1)` | Swaps, stationary transitions |

    Spring (motion-only, CSS can't express): `{ type: 'spring', stiffness: 300, damping: 30, mass: 1 }` — sidebar pill glide, micro-interactions.

    Reduced motion: Settings → Appearance → "Reduce motion" with three states (System / On / Off). Resolution table:

    | User override | OS `prefers-reduced-motion` | Result |
    |---------------|-----------------------------|--------|
    | system | reduce | collapsed to 0ms |
    | system | no-preference | normal |
    | on | any | collapsed to 0ms |
    | off | any | normal |

    ## 3. Usage examples

    - **Play button**: `bg-accent` + `text-wiiwho-bg` + press feedback via `transform: scale(0.98)` on `:active`.
    - **Sidebar with active pill**: 220px fixed column; active row uses `motion.div` with `layoutId="sidebar-nav-pill"` + left accent bar `layoutId="sidebar-nav-bar"`. Spring config above.
    - **Settings modal (bottom-slide)**: Radix Dialog + motion/react with `forceMount` on Portal + Overlay + Content. Portal unconditionally mounted; AnimatePresence INSIDE the Portal; `{open && ...}` guard INSIDE AnimatePresence wraps Overlay + Content. Slide `y: '100%' → 0` over `--duration-slow` with `--ease-emphasized`.
    - **Spotify mini-player**: Pinned at sidebar bottom above Settings gear. 6 visual states (disconnected / connecting / idle / playing / offline / no-premium). Album art crossfades via AnimatePresence keyed by URL.
    - **Theme picker**: 8 preset swatches + custom hex input + EyeDropper button (Chromium 146 native). Live `--color-accent` swap on :root; persists to `settings.json v2`.

    ## 4. Iconography

    - `lucide-react` (ISC license) — already bundled. Play / Shirt / Settings / X / Pipette / ChevronDown / SkipBack / Pause / Play / SkipForward / MoreVertical are the v0.1 icon set.

    ## 5. Typography provenance

    | Font | Version | License | Source | Designer |
    |------|---------|---------|--------|----------|
    | Inter Variable | 4.x | SIL OFL 1.1 | https://github.com/rsms/inter | Rasmus Andersson |
    | JetBrains Mono Variable | 2.x | Apache 2.0 | https://github.com/JetBrains/JetBrainsMono | Philipp Nurullin / JetBrains |

    Bundle location: `launcher/src/renderer/src/assets/fonts/{inter,jetbrains-mono}/`. LICENSE.txt co-located.

    ## 6. Hero art provenance

    v0.1 ships with a CSS gradient stub (linear gradient from `--color-accent` at 10% alpha to `--color-wiiwho-bg`). The owner-drawn bitmap lands on their timeline; provenance (CC0 or original) will be recorded here when the asset arrives.

    ## 7. Exclusion checklist

    This checklist enforces UI-05 as a **first-class deliverable**.

    **WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content.**

    Full enumeration:

    - [ ] Ads
    - [ ] News feeds
    - [ ] Concurrent-user counts
    - [ ] Friends lists
    - [ ] Marketing content
    - [ ] "Online friends" badges
    - [ ] Server ads
    - [ ] Changelog teasers
    - [ ] News cards
    - [ ] Social counts
    - [ ] Engagement metrics
    - [ ] Purchase prompts
    - [ ] Subscription prompts
    - [ ] Referral links
    - [ ] Social share buttons
    - [ ] Discord/Twitter/etc embeds
    - [ ] Rating/review prompts
    - [ ] Beta feature announcements outside Settings/About

    ### Reviewer sign-off

    | Section | Reviewed by | Date | Verdict |
    |---------|-------------|------|---------|
    | Login screen | — | — | — |
    | Play section | — | — | — |
    | Cosmetics "Coming soon" | — | — | — |
    | Sidebar | — | — | — |
    | Settings modal — General | — | — | — |
    | Settings modal — Account | — | — | — |
    | Settings modal — Appearance | — | — | — |
    | Settings modal — Spotify | — | — | — |
    | Settings modal — About | — | — | — |
    | Spotify mini-player (all 6 states) | — | — | — |
    | Crash viewer | — | — | — |
    | Loading screen | — | — | — |

    ## 8. Changelog

    - 2026-04-24 — v0.1 initial design system. 8 accent presets, 3 motion durations, 2 CSS easings + 1 spring, Inter + JetBrains Mono typography, Radix + motion/react component primitives, Spotify mini-player + Theme picker + Settings modal shipped.
    ```

    2. Extend `scripts/check-docs.mjs`. Read its current shape first (Phase 1 pattern — zero-dep Node ESM). Add a section that validates docs/DESIGN-SYSTEM.md:

    ```javascript
    // Extension — Phase 4 UI-07 DESIGN-SYSTEM.md validator
    const DESIGN_SYSTEM_PATH = 'docs/DESIGN-SYSTEM.md'
    const DESIGN_SYSTEM_HEADINGS = [
      /^## 1\. Philosophy$/m,
      /^## 2\. Tokens$/m,
      /^### 2\.1 Colors$/m,
      /^### 2\.2 Typography$/m,
      /^### 2\.3 Spacing$/m,
      /^### 2\.4 Motion$/m,
      /^## 3\. Usage examples$/m,
      /^## 4\. Iconography$/m,
      /^## 5\. Typography provenance$/m,
      /^## 6\. Hero art provenance$/m,
      /^## 7\. Exclusion checklist$/m,
      /^## 8\. Changelog$/m,
    ]
    const EXCLUSION_LITERAL = 'WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content'
    const D13_NOTE_LITERAL = 'D-13 listed Red/Yellow/Gray as illustrative starting points'

    // Read the doc; for each heading regex, assert match; assert literal substrings.
    // Emit clear per-miss error if validation fails; nonzero exit on any miss.
    ```

    Integrate the new check into the existing checkDoc loop. Re-run `node scripts/check-docs.mjs` and verify 0 errors.

    3. Replace Wave 0 stub `launcher/src/renderer/src/test/antiBloat.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     *
     * UI-05 anti-bloat static grep. Reads every .ts / .tsx file under
     * launcher/src/renderer/src/ and asserts that visible-copy strings don't
     * contain ad/news/social patterns. Excludes:
     *   - test files (**_/__tests__/**, *.test.tsx, test/*.test.*)
     *   - comments in .ts/.tsx (we use visible-copy heuristic — match JSX text only)
     *   - the exclusion-checklist doc itself (docs/DESIGN-SYSTEM.md)
     *
     * Heuristic: grep for JSX-content-looking patterns. Word-boundary regexes
     * reduce false positives but not to zero — if this test flags something
     * legitimate, add it to ALLOWLIST below with a comment.
     */
    import { describe, it, expect } from 'vitest'
    import { readFileSync, readdirSync, statSync } from 'node:fs'
    import path from 'node:path'

    const ROOT = path.resolve(__dirname, '..')

    const EXCLUDE_PATTERNS = [
      /__tests__/,
      /\.test\.[jt]sx?$/,
      /\/test\//,
      /node_modules/,
    ]

    // Banned strings — match at word boundaries. These are the things users must never see.
    const BANNED: RegExp[] = [
      /\b(?:advertisement|advertisements)\b/i,
      /\bonline users\b/i,
      /\bfriends online\b/i,
      /\bconcurrent users\b/i,
      /\bnews feed\b/i,
      /\bnews card\b/i,
      /\bbuy now\b/i,
      /\bsubscribe now\b/i,
      /\bpremium offer\b/i,
      /\bdiscord server\b/i,
      /\btwitter feed\b/i,
    ]

    // Allowlist: legitimate uses that the banned patterns might match but should pass.
    // (Currently none — if adding entries, include a clear rationale.)
    const ALLOWLIST: Array<{ file: string; line: string; reason: string }> = []

    function walk(dir: string): string[] {
      const out: string[] = []
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (EXCLUDE_PATTERNS.some(rx => rx.test(full))) continue
        const stat = statSync(full)
        if (stat.isDirectory()) out.push(...walk(full))
        else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
      }
      return out
    }

    describe('UI-05 anti-bloat grep', () => {
      it('no source file contains banned marketing/social/ad strings', () => {
        const files = walk(ROOT)
        const offenders: Array<{ file: string; line: string; match: string }> = []
        for (const file of files) {
          const contents = readFileSync(file, 'utf8')
          const lines = contents.split('\n')
          for (const line of lines) {
            // Skip comment lines — visible-copy heuristic
            const trimmed = line.trim()
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
            for (const rx of BANNED) {
              const m = rx.exec(line)
              if (m) {
                const allowed = ALLOWLIST.some(a => file.endsWith(a.file) && line.includes(a.line))
                if (!allowed) offenders.push({ file, line: line.trim(), match: m[0] })
              }
            }
          }
        }
        if (offenders.length > 0) {
          console.error('Anti-bloat violations found:')
          for (const o of offenders) console.error(`  ${o.file}: "${o.line}" (matched "${o.match}")`)
        }
        expect(offenders).toEqual([])
      })
    })
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/test/antiBloat.test.tsx && node ../scripts/check-docs.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `docs/DESIGN-SYSTEM.md` exists.
    - `grep "## 7. Exclusion checklist" docs/DESIGN-SYSTEM.md` returns 1 hit.
    - `grep "WiiWho does NOT display: ads, news feeds, concurrent-user counts, friends lists, marketing content" docs/DESIGN-SYSTEM.md` returns 1 hit.
    - `grep "D-13 listed Red/Yellow/Gray as illustrative starting points" docs/DESIGN-SYSTEM.md` returns 1 hit (RESEARCH tuning footnote).
    - `grep "## 1. Philosophy" docs/DESIGN-SYSTEM.md` returns 1 hit.
    - `grep "## 8. Changelog" docs/DESIGN-SYSTEM.md` returns 1 hit.
    - `node scripts/check-docs.mjs` exits 0.
    - antiBloat.test.tsx passes with 0 offenders (except items in ALLOWLIST with documented rationale).
  </acceptance_criteria>
  <done>Design system doc shipped (incl. D-13/RESEARCH substitution footnote); check-docs validates it; anti-bloat grep green.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: CHECKPOINT — Owner performs the manual smoke UAT from 04-VALIDATION.md</name>
  <what-built>Integrated Phase 4 launcher UI: sidebar + main-area router + bottom-slide Settings modal + Theme picker (8 presets + custom hex + EyeDropper) + Spotify mini-player (6 states) + motion system + docs/DESIGN-SYSTEM.md + Reduce motion + anti-bloat grep passing.</what-built>
  <how-to-verify>
    Walk through the Manual-Only Verifications table in `.planning/phases/04-launcher-ui-polish/04-VALIDATION.md`. For each row, perform the Test Instructions and record pass/fail:

    1. **Settings modal slide-up visual feel** (UI-03) — Launch `pnpm --filter ./launcher dev`; click Settings gear at sidebar bottom; observe slide-up from bottom over ~320ms. Close via X / ESC / backdrop click (all three). Verify the close animation actually PLAYS (~320ms slide-down) — not an instant unmount (forceMount + nesting regression guard).
    2. **Accent color swap visual feel across all surfaces** (UI-01) — Settings → Appearance → cycle all 8 presets + enter custom hex `#ff00aa`. Verify: Play button bg, focus rings (Tab through), active sidebar pill, modal sub-nav pill ALL use the new accent; body text / headings do NOT.
    3. **Sidebar nav pill glide** (UI-03) — Click Cosmetics → Play → Cosmetics. Pill + left-bar glide smoothly ~200ms.
    4. **EyeDropper picks a color** (UI-01) — Appearance → Custom → eyedropper button → pick a color anywhere on screen. Hex field + accent update.
    5. **Spotify PKCE flow end-to-end** (UI-06) — Click "Connect Spotify" in mini-player (or Spotify pane) → browser opens authorize page → log in → redirect → launcher shows connected display name. Check `%APPDATA%/Wiiwho/spotify.bin` exists (file size >0).
    6. **Spotify mini-player updates on track change** (UI-06) — Start playback in Spotify desktop app on any device → within 5s launcher shows track title + artist + album art. Press Next on phone → album art crossfades to new track within 5s.
    7. **Spotify graceful offline** (UI-06) — Disable network → within ~5s launcher shows "(offline)" label; no error modal. Re-enable → polling resumes.
    8. **403 PREMIUM_REQUIRED** (UI-06) — If owner has a free-tier Spotify account to test with: connect → try play/pause → buttons disabled + tooltip "Spotify Premium required for controls". Track display still works.
    9. **Disconnect from mini-player context menu** (UI-06 D-33) — Click the `...` (MoreVertical) button on the mini-player → "Open Spotify app" + "Disconnect" visible → click Disconnect → slot returns to "Connect Spotify".
    10. **Reduced motion OS setting** (UI-03 D-24) — Enable Windows "Show animations in Windows" = off (or macOS Reduce Motion). Settings = System → all transitions instant. Switch to Off → transitions return.
    11. **UI-05 anti-bloat compliance** — Walk every screen (Login, Play, Cosmetics, Settings all 5 panes, Spotify states, CrashViewer, LoadingScreen). Cross-reference docs/DESIGN-SYSTEM.md §Exclusion checklist. Sign off each row in the Reviewer sign-off table.
    12. **Hero art gradient stub** (UI-04 D-04) — Play section shows gradient from accent (10% alpha) to bg; Play button + wordmark legible.
    13. **Design system doc completeness** (UI-07) — `docs/DESIGN-SYSTEM.md` has all 8 sections; screenshots optional in v0.1 but encouraged.
    14. **macOS smoke** (if Mac available) — Same flow on Mac: fonts render, safeStorage keychain grant, PKCE, all 8 accents.

    For each row, record verdict in `04-VALIDATION.md` or in a new `.planning/phases/04-launcher-ui-polish/04-UAT.md` file. If anything fails, type `blocked: <which test + symptom>` and a `--gaps` plan will be authored.
  </how-to-verify>
  <resume-signal>Type `approved` if all 14 rows pass, or `blocked: <details>` to produce a gap-closure plan.</resume-signal>
  <files>N/A (human checkpoint)</files>
  <action>Human checkpoint — see &lt;what-to-do&gt;, &lt;how-to-verify&gt;, and &lt;resume-signal&gt; below. Claude pauses and waits for the owner's explicit resume-signal before proceeding.</action>
  <verify>
    <automated>echo "Manual checkpoint — awaiting owner resume-signal per block below."</automated>
  </verify>
  <done>Owner types the resume-signal per the block below (e.g., "approved").</done>
</task>

<task type="auto">
  <name>Task 4: Phase commit + STATE.md + ROADMAP.md update</name>
  <files>.planning/STATE.md, .planning/ROADMAP.md</files>
  <read_first>
    - .planning/STATE.md (current status line + progress)
    - .planning/ROADMAP.md (Phase 4 Plans line + checkbox state)
    - .planning/phases/04-launcher-ui-polish/ (SUMMARY.md files from prior plans)
  </read_first>
  <action>
    1. Update `.planning/STATE.md`:
       - `stopped_at: Phase 4 complete`
       - `last_activity: 2026-04-24`
       - Increment `completed_phases` to 3 (Phase 1, 2, 3) — or wherever the counter sits; verify prior phases are accurate first.
       - Add a decision entry for Phase 4: "2026-04-24: Phase 4 Launcher UI Polish complete — 8 accent presets, motion system, Spotify mini-player, Settings modal bottom-slide. Deliberate 6th preload key `spotify` (Pitfall 10). Redirect URI corrected to `http://127.0.0.1/callback` (Pitfall 6 / CONTEXT D-31 correction)."

    2. Update `.planning/ROADMAP.md` Phase 4 entry:
       - Mark `[ ] **Phase 4: Launcher UI Polish**` → `[x] **Phase 4: Launcher UI Polish**` in the top-level checklist.
       - Plans list: mark all 8 plans (04-00 through 04-07) complete with `[x]`.
       - Update the "Plans" count line from "TBD" to "8 plans".

    3. Final git commit:

       ```bash
       node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "feat(04): Launcher UI Polish complete — sidebar + themes + motion + Spotify

Phase 4 implements UI-01/03/04/05/06/07. Highlights:
- 8 accent presets + custom hex + EyeDropper (UI-01)
- Motion system: 3 durations, 2 CSS easings + 1 spring, reduced-motion toggle (UI-03)
- Sidebar-driven main surface with Play + Cosmetics (UI-04)
- Bottom-slide Settings modal with 5 panes (Radix + motion/react forceMount)
- Spotify mini-player (PKCE + loopback + 6 states + 403 PREMIUM_REQUIRED handling) (UI-06)
- docs/DESIGN-SYSTEM.md + UI-05 Exclusion checklist + anti-bloat grep test (UI-05/07)

Deliberate deviations (documented):
- 6th top-level preload key \`spotify\` (Pitfall 10 — D-11 superseded)
- Spotify dashboard redirect URI http://127.0.0.1/callback (Pitfall 6 — CONTEXT D-31 corrected)
- SettingsDrawer.tsx deleted (Phase 3 D-01 → Phase 4 D-08 bottom-slide modal)
- settings.json v1 → v2 migration (theme + reduceMotion slice added)" --files .planning/STATE.md .planning/ROADMAP.md
       ```

    4. Verify `git status` shows a clean tree after the commit.
  </action>
  <verify>
    <automated>node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" frontmatter validate ".planning/phases/04-launcher-ui-polish/04-07-integration-and-docs-PLAN.md" --schema plan</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/STATE.md` shows `Phase 4 complete` and last_activity 2026-04-24.
    - `.planning/ROADMAP.md` Phase 4 row is `[x]`.
    - Final commit mentions UI-01..UI-07 and the two deliberate deviations (Pitfalls 6 + 10).
    - `git status` clean.
  </acceptance_criteria>
  <done>Phase 4 formally complete; STATE + ROADMAP reflect it; commit contains the deviation notes.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm --filter ./launcher run test:run` exits 0 (full suite, including antiBloat).
- `cd launcher && pnpm --filter ./launcher run typecheck` exits 0.
- `node scripts/check-docs.mjs` exits 0 (DESIGN-SYSTEM.md structure valid).
- `docs/DESIGN-SYSTEM.md` contains literal exclusion-checklist string.
- `docs/DESIGN-SYSTEM.md` contains the D-13/RESEARCH substitution footnote.
- `git status` clean after Task 4.
- `grep -i "account" launcher/src/renderer/src/components/Sidebar.tsx` returns 0 hits (E-03 preserved).
- `grep "registerSpotifyHandlers" launcher/src/main/index.ts` returns ≥1 hit.
- `grep "<DeviceCodeModal" launcher/src/renderer/src/App.tsx` returns ≥1 hit (Phase 2 regression guard).
- Manual UAT: 14 rows signed off in 04-VALIDATION.md (Task 3 checkpoint).
</verification>

<success_criteria>
All 6 UI requirements delivered + documented + smoke-verified. UI-01 / UI-03 / UI-04 / UI-05 / UI-06 / UI-07 all pass. docs/DESIGN-SYSTEM.md shipped with exclusion checklist signed off + D-13/RESEARCH substitution footnote. Anti-bloat grep enforced automatically in the test suite. DeviceCodeModal present in logged-in tree (Phase 2 re-auth flow preserved). Phase 4 complete; Phase 5 (Forge Integration) unblocked.
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-07-integration-and-docs-SUMMARY.md` documenting:
- App.tsx final architecture (logged-in tree composition, including DeviceCodeModal mount position)
- main/index.ts bootstrap order (redact → auth → game → settings → logs → spotify)
- docs/DESIGN-SYSTEM.md section list verbatim
- D-13 → RESEARCH preset name/hex substitution record (Red→Crimson, Yellow→Amber, Gray→Slate) with WCAG rationale
- antiBloat.test.tsx allowlist (should be empty)
- UAT sign-off reference (row-by-row verdicts in 04-VALIDATION.md)
- Deliberate deviations summary (Pitfalls 6 + 10) for future maintainers

Also create `.planning/phases/04-launcher-ui-polish/04-PHASE-COMPLETE.md` with the phase-level retrospective:
- What shipped (6 requirements)
- Wave parallelism observed (0 → 1 → 2/3/4 → 5 → 6)
- Total plans: 8 (04-00..04-07)
- Key research corrections landed: D-31 redirect URI, 403 PREMIUM_REQUIRED, motion/react rename
- Open UAT rows if any (feeds Phase 8 regression prep)
</output>
