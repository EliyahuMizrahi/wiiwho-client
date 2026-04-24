---
phase: 04-launcher-ui-polish
plan: 03
type: execute
wave: 3
depends_on:
  - 04-01
  - 04-02
files_modified:
  - launcher/src/renderer/src/components/SettingsModal.tsx
  - launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx
  - launcher/src/renderer/src/components/SettingsPanes/SettingsSubSidebar.tsx
  - launcher/src/renderer/src/components/SettingsPanes/GeneralPane.tsx
  - launcher/src/renderer/src/components/SettingsPanes/AccountPane.tsx
  - launcher/src/renderer/src/components/SettingsPanes/AboutPane.tsx
  - launcher/src/renderer/src/components/SettingsPanes/__tests__/SettingsSubSidebar.test.tsx
  - launcher/src/renderer/src/components/SettingsPanes/__tests__/GeneralPane.test.tsx
  - launcher/src/renderer/src/components/SettingsPanes/__tests__/AccountPane.test.tsx
  - launcher/src/renderer/src/components/SettingsPanes/__tests__/AboutPane.test.tsx
autonomous: true
requirements:
  - UI-03
  - UI-04
  - UI-05
must_haves:
  truths:
    - "Clicking the sidebar Settings gear opens a bottom-slide modal that slides up from the bottom over ~320ms with emphasized easing"
    - "Modal is dismissable via X button, ESC key, and backdrop click (three gestures per D-08)"
    - "Modal uses Radix Dialog + motion/react with forceMount on Portal+Overlay+Content (Pitfall 4)"
    - "Modal has left sub-sidebar with panes in order: General, Account, Appearance, Spotify, About (D-10)"
    - "Sub-sidebar active pill uses layoutId 'settings-subnav-pill' for glide animation"
    - "GeneralPane hosts the RamSlider (migrated from Phase 3 SettingsDrawer) + Open crash-reports folder button"
    - "AccountPane shows username + full UUID + skin head + Sign out action"
    - "AboutPane shows version + license placeholder + build hash + ANTICHEAT-SAFETY.md doc link"
    - "Appearance + Spotify panes have stub placeholders (populated by 04-04 + 04-06 respectively)"
  artifacts:
    - path: "launcher/src/renderer/src/components/SettingsModal.tsx"
      provides: "Bottom-slide Radix Dialog + AnimatePresence shell"
      exports: ["SettingsModal"]
    - path: "launcher/src/renderer/src/components/SettingsPanes/SettingsSubSidebar.tsx"
      provides: "Left sub-sidebar with pane nav + layoutId pill"
      exports: ["SettingsSubSidebar", "SETTINGS_PANES"]
    - path: "launcher/src/renderer/src/components/SettingsPanes/GeneralPane.tsx"
      provides: "General pane with RamSlider + crash-reports shortcut"
      exports: ["GeneralPane"]
    - path: "launcher/src/renderer/src/components/SettingsPanes/AccountPane.tsx"
      provides: "Account pane with profile info + Sign out"
      exports: ["AccountPane"]
    - path: "launcher/src/renderer/src/components/SettingsPanes/AboutPane.tsx"
      provides: "About pane with version + build hash + doc link"
      exports: ["AboutPane"]
  key_links:
    - from: "launcher/src/renderer/src/components/SettingsModal.tsx"
      to: "useSettingsStore.modalOpen + openPane"
      via: "Zustand subscription"
      pattern: "useSettingsStore\\(.*modalOpen"
    - from: "launcher/src/renderer/src/components/SettingsPanes/SettingsSubSidebar.tsx"
      to: "useSettingsStore.setOpenPane"
      via: "onClick handlers"
      pattern: "setOpenPane\\("
---

<objective>
Build the Phase 4 Settings modal chrome: the bottom-slide Radix Dialog shell (with motion/react forceMount + AnimatePresence per RESEARCH §Radix Dialog Bottom-Slide), the left sub-sidebar pane nav with layoutId glide, and three of the five pane contents (General, Account, About). Appearance and Spotify pane contents are placeholder stubs that Plans 04-04 and 04-06 replace.

Purpose: Deliver the bottom-slide modal experience (D-08) plus migrate the RAM slider (Phase 3 SettingsDrawer → Phase 4 General pane) + wire Account/About content so the modal is immediately usable after this plan lands.

Output: SettingsModal + 5 panes (3 real + 2 placeholder) + tests covering open/close gestures, sub-nav click, RamSlider mount, username/UUID display, version footer.
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@launcher/src/renderer/src/components/RamSlider.tsx
@launcher/src/renderer/src/components/ui/dialog.tsx
@launcher/src/renderer/src/components/AccountBadge.tsx
@launcher/src/renderer/src/hooks/useSkinHead.ts
@.planning/phases/04-launcher-ui-polish/04-01-tokens-and-settings-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-02-sidebar-and-main-area-SUMMARY.md
</context>

<interfaces>
<!-- Extracted: what SettingsModal + panes consume -->

From launcher/src/renderer/src/stores/settings.ts (Plan 04-01):
```typescript
type SettingsPane = 'general' | 'account' | 'appearance' | 'spotify' | 'about'
// Store exposes:
modalOpen: boolean
openPane: SettingsPane
setModalOpen: (open: boolean) => void
setOpenPane: (pane: SettingsPane) => void  // also sets modalOpen=true
```

From launcher/src/renderer/src/hooks/useMotionConfig.ts (Plan 04-01):
```typescript
export function useMotionConfig(): { reduced, durationSlow, durationMed, ... }
```

From launcher/src/renderer/src/components/RamSlider.tsx (Phase 3 — reusable):
```typescript
export function RamSlider(): React.JSX.Element
// Reads useSettingsStore.ramMb and calls setRamMb on change.
```

From launcher/src/renderer/src/stores/auth.ts (Phase 2 — reusable):
```typescript
username?: string
uuid?: string
logout: () => Promise<void>
```

From motion/react (Plan 04-00):
```typescript
import { motion, AnimatePresence } from 'motion/react'
```

From radix-ui (already installed):
```typescript
import * as Dialog from '@radix-ui/react-dialog'  // or via shadcn's ui/dialog.tsx
```

RESEARCH §Radix Dialog Bottom-Slide — verbatim pattern: `Dialog.Portal forceMount` (UNCONDITIONAL — no {open &&} wrapper) + `AnimatePresence INSIDE the Portal` + `{open && (...)}` guard INSIDE AnimatePresence wrapping Overlay + Content, both using `asChild forceMount`.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SettingsModal bottom-slide shell + SettingsSubSidebar with layoutId pill</name>
  <files>launcher/src/renderer/src/components/SettingsModal.tsx, launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx, launcher/src/renderer/src/components/SettingsPanes/SettingsSubSidebar.tsx, launcher/src/renderer/src/components/SettingsPanes/__tests__/SettingsSubSidebar.test.tsx</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Radix Dialog Bottom-Slide → §Canonical Settings modal implementation (verbatim JSX)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Sub-sidebar + pane routing (verbatim JSX)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-08, §D-09, §D-10 (modal + sub-sidebar spec)
    - launcher/src/renderer/src/components/ui/dialog.tsx (existing Radix Dialog wiring — see which subcomponents are already exported)
    - launcher/src/renderer/src/components/AccountBadge.tsx (pointer-capture stub pattern for Radix-in-jsdom tests)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Pitfall 4 (forceMount requirement)
  </read_first>
  <behavior>
    - SettingsModal reads `modalOpen` + `openPane` from useSettingsStore
    - Controlled Radix Dialog.Root with open={modalOpen} onOpenChange={setModalOpen}
    - **CANONICAL NESTING (per RESEARCH §Radix Dialog Bottom-Slide):**
      `Dialog.Root` → `Dialog.Portal forceMount` (ALWAYS MOUNTED — no `{open && ...}` wrapper around Portal!) → `AnimatePresence` (INSIDE Portal) → `{open && (<>...)</>}` guard INSIDE AnimatePresence → `Dialog.Overlay asChild forceMount` (motion.div fade) + `Dialog.Content asChild forceMount` (motion.div slide-up + fade).
      This nesting is MANDATORY: wrapping Portal in `{open && ...}` unmounts the subtree before AnimatePresence can run exit animations, making `forceMount` meaningless at runtime even though grep may pass.
    - Overlay: className `fixed inset-0 bg-black/60 z-40`, initial/animate/exit opacity
    - Content: className `fixed bottom-0 left-[220px] right-0 z-50 h-[560px] bg-wiiwho-surface border-t border-wiiwho-border rounded-t-lg shadow-2xl flex overflow-hidden`
    - Slide animation: `y: reduced ? 0 : '100%'` → `y: 0` → `y: reduced ? 0 : '100%'`; transition duration: durationSlow (0.32 or 0), ease: EASE_EMPHASIZED
    - Sets aria-describedby={undefined} on Dialog.Content
    - Renders `<Dialog.Title className="sr-only">Settings</Dialog.Title>` (a11y)
    - Renders `<SettingsSubSidebar />` + active pane switch
    - Has explicit X close button at top-right of Content (aria-label "Close settings")
    - Pane switch: `switch (openPane) { case 'general': <GeneralPane/>; case 'account': <AccountPane/>; case 'appearance': <div data-testid="appearance-pane-stub">Appearance</div> (Plan 04-04 replaces); case 'spotify': <div data-testid="spotify-pane-stub">Spotify</div> (Plan 04-06 replaces); case 'about': <AboutPane/> }`
    - SettingsSubSidebar renders 5 buttons in order (General, Account, Appearance, Spotify, About) with layoutId="settings-subnav-pill" active pill
    - Modal close via ESC / backdrop / X all call setModalOpen(false)
    - Tests verify: mount on open=true, unmount on open=false (after animation), forceMount attributes present, escape closes, backdrop click closes, X button closes, sub-nav click swaps openPane, active pane content renders
  </behavior>
  <action>
    1. Replace `launcher/src/renderer/src/components/__tests__/SettingsModal.test.tsx` stub with real tests (jsdom + pointer-capture stubs pattern from Phase 2/3):

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { SettingsModal } from '../SettingsModal'
    import { useSettingsStore } from '../../stores/settings'

    // jsdom stubs for Radix Dialog (pointer capture + scrollIntoView)
    Element.prototype.hasPointerCapture = (() => false) as never
    Element.prototype.releasePointerCapture = (() => {}) as never
    Element.prototype.scrollIntoView = (() => {}) as never

    // Mock motion/react to render plain divs (no animation framework in jsdom)
    vi.mock('motion/react', async () => {
      const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
      return {
        ...actual,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
        motion: new Proxy({}, {
          get: (_, key) => (props: Record<string, unknown>) => {
            const Comp = key as string
            const { initial, animate, exit, transition, layoutId, ...rest } = props
            return React.createElement(Comp, rest as never)
          }
        }),
        useReducedMotion: () => false,
      }
    })

    import React from 'react'

    beforeEach(() => {
      ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
        auth: {}, game: {}, logs: { openCrashFolder: vi.fn() }, settings: {}, __debug: {}
      }
      useSettingsStore.setState({ modalOpen: false, openPane: 'general' } as never)
    })
    afterEach(cleanup)

    describe('SettingsModal', () => {
      it('renders nothing when modalOpen === false', () => {
        useSettingsStore.setState({ modalOpen: false } as never)
        render(<SettingsModal />)
        expect(screen.queryByRole('dialog')).toBeNull()
      })

      it('renders Dialog when modalOpen === true', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
        render(<SettingsModal />)
        expect(screen.getByRole('dialog')).toBeDefined()
      })

      it('renders sub-sidebar with all 5 panes (General, Account, Appearance, Spotify, About) in order', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
        render(<SettingsModal />)
        const names = ['General', 'Account', 'Appearance', 'Spotify', 'About']
        for (const name of names) {
          expect(screen.getByRole('button', { name })).toBeDefined()
        }
      })

      it('renders X close button with aria-label "Close settings"', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
        render(<SettingsModal />)
        expect(screen.getByRole('button', { name: /close settings/i })).toBeDefined()
      })

      it('ESC key closes modal (Radix DismissableLayer)', async () => {
        const user = userEvent.setup()
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
        render(<SettingsModal />)
        await user.keyboard('{Escape}')
        expect(useSettingsStore.getState().modalOpen).toBe(false)
      })

      it('clicking X closes modal', async () => {
        const user = userEvent.setup()
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
        render(<SettingsModal />)
        await user.click(screen.getByRole('button', { name: /close settings/i }))
        expect(useSettingsStore.getState().modalOpen).toBe(false)
      })

      it('openPane="account" renders AccountPane content (username placeholder)', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'account' } as never)
        render(<SettingsModal />)
        // AccountPane has a testid or heading "Account"
        expect(screen.getByTestId('account-pane')).toBeDefined()
      })

      it('openPane="appearance" renders stub (replaced by Plan 04-04)', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'appearance' } as never)
        render(<SettingsModal />)
        expect(screen.getByTestId('appearance-pane-stub')).toBeDefined()
      })

      it('openPane="spotify" renders stub (replaced by Plan 04-06)', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'spotify' } as never)
        render(<SettingsModal />)
        expect(screen.getByTestId('spotify-pane-stub')).toBeDefined()
      })

      it('sr-only Dialog.Title "Settings" is rendered for a11y', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
        render(<SettingsModal />)
        expect(screen.getByText('Settings', { selector: '[class*="sr-only"]' })).toBeDefined()
      })

      it('contains NO anti-bloat strings (UI-05)', () => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
        const { container } = render(<SettingsModal />)
        const text = container.textContent?.toLowerCase() ?? ''
        expect(text).not.toMatch(/\b(ad|ads|news|friends? online|concurrent users|buy now)\b/)
      })
    })
    ```

    2. Replace `launcher/src/renderer/src/components/SettingsPanes/__tests__/SettingsSubSidebar.test.tsx` stub with real tests:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { SettingsSubSidebar, SETTINGS_PANES } from '../SettingsSubSidebar'
    import { useSettingsStore } from '../../../stores/settings'

    vi.mock('motion/react', async () => ({
      motion: new Proxy({}, { get: () => (p: Record<string, unknown>) => null }),
      AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    }))

    describe('SettingsSubSidebar', () => {
      beforeEach(() => {
        useSettingsStore.setState({ modalOpen: true, openPane: 'general' } as never)
      })
      afterEach(cleanup)

      it('SETTINGS_PANES exports 5 panes in order: general, account, appearance, spotify, about', () => {
        expect([...SETTINGS_PANES]).toEqual(['general', 'account', 'appearance', 'spotify', 'about'])
      })

      it('renders 5 buttons with display labels', () => {
        render(<SettingsSubSidebar />)
        for (const label of ['General', 'Account', 'Appearance', 'Spotify', 'About']) {
          expect(screen.getByRole('button', { name: label })).toBeDefined()
        }
      })

      it('active pane button has aria-current="page"', () => {
        useSettingsStore.setState({ openPane: 'appearance' } as never)
        render(<SettingsSubSidebar />)
        expect(screen.getByRole('button', { name: 'Appearance' })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('button', { name: 'General' })).not.toHaveAttribute('aria-current', 'page')
      })

      it('clicking a pane calls useSettingsStore.setOpenPane', async () => {
        const user = userEvent.setup()
        render(<SettingsSubSidebar />)
        await user.click(screen.getByRole('button', { name: 'About' }))
        expect(useSettingsStore.getState().openPane).toBe('about')
      })

      it('sub-sidebar width is 180px per D-10', () => {
        const { container } = render(<SettingsSubSidebar />)
        const nav = container.querySelector('nav')
        expect(nav?.className ?? '').toMatch(/w-\[180px\]/)
      })
    })
    ```

    3. Create `launcher/src/renderer/src/components/SettingsPanes/SettingsSubSidebar.tsx`:

    ```tsx
    /**
     * Settings modal left sub-sidebar — D-10.
     *
     * 180px wide. Pane order: General, Account, Appearance, Spotify, About.
     * Active pane uses motion layoutId "settings-subnav-pill" for glide animation
     * matching the main sidebar's pattern (RESEARCH §Sub-sidebar + pane routing).
     *
     * Rolled by hand (not Radix Tabs) because we want the same layoutId idiom as
     * the primary Sidebar — Radix Tabs doesn't expose the internal layout engine.
     */
    import type React from 'react'
    import { motion } from 'motion/react'
    import { useSettingsStore } from '../../stores/settings'
    import { SPRING_STANDARD } from '../../theme/motion'

    export const SETTINGS_PANES = ['general', 'account', 'appearance', 'spotify', 'about'] as const
    export type SettingsPane = typeof SETTINGS_PANES[number]

    const LABELS: Record<SettingsPane, string> = {
      general:    'General',
      account:    'Account',
      appearance: 'Appearance',
      spotify:    'Spotify',
      about:      'About',
    }

    export function SettingsSubSidebar(): React.JSX.Element {
      const openPane = useSettingsStore((s) => s.openPane)
      const setOpenPane = useSettingsStore((s) => s.setOpenPane)

      return (
        <nav
          aria-label="Settings sections"
          className="w-[180px] h-full shrink-0 border-r border-wiiwho-border p-2 flex flex-col gap-1"
        >
          {SETTINGS_PANES.map((id) => {
            const isActive = openPane === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setOpenPane(id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative px-3 py-2 text-left text-sm rounded hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {isActive && (
                  <motion.div
                    layoutId="settings-subnav-pill"
                    className="absolute inset-0 rounded"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
                    transition={SPRING_STANDARD}
                  />
                )}
                <span
                  className="relative z-10"
                  style={{ color: isActive ? 'var(--color-accent)' : undefined }}
                >
                  {LABELS[id]}
                </span>
              </button>
            )
          })}
        </nav>
      )
    }
    ```

    4. Create `launcher/src/renderer/src/components/SettingsModal.tsx` — use Radix Dialog PRIMITIVES directly (import from `@radix-ui/react-dialog` or use the unified `radix-ui` package the project already ships). Follow RESEARCH §Canonical Settings modal implementation verbatim.

    **CRITICAL NESTING (per checker-verified canonical pattern):** Portal is ALWAYS mounted (no `{open && ...}` wrapper around Portal). `AnimatePresence` lives INSIDE the Portal. The `{open && (...)}` guard lives INSIDE AnimatePresence and wraps ONLY Overlay + Content. If you wrap Portal in `{open && ...}`, React unmounts the subtree BEFORE AnimatePresence can run exit animations — `forceMount` becomes meaningless at runtime even though a grep for `forceMount` still passes.

    ```tsx
    /**
     * Settings modal — bottom-slide over the main area.
     *
     * D-08: opens by sliding up from the bottom; closes by sliding down + fade.
     * D-09: height 560px, width = viewport minus sidebar (left-[220px] right-0).
     * Three dismissal gestures (D-08): X button + ESC + backdrop click.
     *
     * Architecture (RESEARCH §Radix Dialog Bottom-Slide — CANONICAL):
     *   - Controlled Radix Dialog.Root (modalOpen state from useSettingsStore).
     *   - Portal is ALWAYS mounted — forceMount, no {open && ...} guard around it.
     *     (Guarding Portal unmounts the subtree BEFORE framer-motion can run exit;
     *      forceMount then becomes a runtime no-op even though grep still finds it.)
     *   - AnimatePresence lives INSIDE the Portal.
     *   - {open && (...)} guard lives INSIDE AnimatePresence and wraps only
     *     Overlay + Content — this lets AnimatePresence observe the children
     *     toggle and run enter/exit animations.
     *   - Portal + Overlay + Content all use `forceMount` (Pitfall 4) so Radix
     *     doesn't unmount before framer-motion runs exit.
     *   - Slide uses y: '100%' → 0 → '100%' collapsed to y: 0 when motion is reduced.
     */
    import type React from 'react'
    import * as DialogPrimitive from '@radix-ui/react-dialog'
    import { motion, AnimatePresence } from 'motion/react'
    import { X } from 'lucide-react'
    import { useSettingsStore } from '../stores/settings'
    import { useMotionConfig } from '../hooks/useMotionConfig'
    import { EASE_EMPHASIZED } from '../theme/motion'
    import { SettingsSubSidebar } from './SettingsPanes/SettingsSubSidebar'
    import { GeneralPane } from './SettingsPanes/GeneralPane'
    import { AccountPane } from './SettingsPanes/AccountPane'
    import { AboutPane } from './SettingsPanes/AboutPane'

    export function SettingsModal(): React.JSX.Element {
      const open = useSettingsStore((s) => s.modalOpen)
      const setOpen = useSettingsStore((s) => s.setModalOpen)
      const openPane = useSettingsStore((s) => s.openPane)
      const { durationSlow, durationMed, reduced } = useMotionConfig()

      return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Portal forceMount>
            <AnimatePresence>
              {open && (
                <>
                  <DialogPrimitive.Overlay asChild forceMount>
                    <motion.div
                      className="fixed inset-0 bg-black/60 z-40"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: durationMed, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </DialogPrimitive.Overlay>
                  <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
                    <motion.div
                      className="fixed bottom-0 left-[220px] right-0 z-50 h-[560px] bg-wiiwho-surface border-t border-wiiwho-border rounded-t-lg shadow-2xl flex overflow-hidden"
                      initial={{ opacity: 0, y: reduced ? 0 : '100%' }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduced ? 0 : '100%' }}
                      transition={{ duration: durationSlow, ease: [...EASE_EMPHASIZED] as unknown as [number, number, number, number] }}
                    >
                      <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>

                      <SettingsSubSidebar />

                      <div className="flex-1 p-6 overflow-y-auto relative">
                        <DialogPrimitive.Close asChild>
                          <button
                            type="button"
                            aria-label="Close settings"
                            className="absolute top-3 right-3 text-neutral-500 hover:text-neutral-200 p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <X className="size-5" aria-hidden="true" />
                          </button>
                        </DialogPrimitive.Close>

                        {openPane === 'general'    && <GeneralPane />}
                        {openPane === 'account'    && <AccountPane />}
                        {openPane === 'appearance' && <div data-testid="appearance-pane-stub" className="text-neutral-500">Appearance (Plan 04-04)</div>}
                        {openPane === 'spotify'    && <div data-testid="spotify-pane-stub" className="text-neutral-500">Spotify (Plan 04-06)</div>}
                        {openPane === 'about'      && <AboutPane />}
                      </div>
                    </motion.div>
                  </DialogPrimitive.Content>
                </>
              )}
            </AnimatePresence>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )
    }
    ```

    NOTE: If `@radix-ui/react-dialog` is not directly exposed by the unified `radix-ui` package (4.x uses a different import style), use the shadcn primitives already installed under `components/ui/dialog.tsx` and wrap its exports. Consult `launcher/src/renderer/src/components/ui/dialog.tsx` (Phase 2 shadcn addition) to see which primitive-level components are available (`Dialog.Root`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Close`, `Dialog.Title`). The `forceMount` prop is standard Radix across both import paths. **The nesting above must be preserved regardless of import path.**

    5. Run tests and verify all assertions pass.
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/__tests__/SettingsModal.test.tsx src/renderer/src/components/SettingsPanes/__tests__/SettingsSubSidebar.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep "forceMount" launcher/src/renderer/src/components/SettingsModal.tsx` returns ≥3 hits (Portal + Overlay + Content — Pitfall 4).
    - `grep "DialogPrimitive.Portal forceMount>" launcher/src/renderer/src/components/SettingsModal.tsx` returns ≥1 hit — **and the line IMMEDIATELY before it must NOT contain `{open &&` (Portal is unconditionally mounted; guarding it defeats forceMount at runtime).**
    - In SettingsModal.tsx, the line containing `<AnimatePresence` must appear AFTER the line containing `<DialogPrimitive.Portal` in source order (AnimatePresence lives INSIDE the Portal, not outside it). Verify with: `awk '/<DialogPrimitive.Portal/{p=NR} /<AnimatePresence/{a=NR} END{exit !(p < a)}' launcher/src/renderer/src/components/SettingsModal.tsx` returns 0.
    - In SettingsModal.tsx, the `{open && (` guard must appear AFTER `<AnimatePresence` and BEFORE `<DialogPrimitive.Overlay` in source order (the guard wraps only Overlay + Content, which is how AnimatePresence observes the children toggle). Verify with a similar awk ordering check.
    - `grep "from 'motion/react'" launcher/src/renderer/src/components/SettingsModal.tsx` returns 1 hit.
    - `grep "layoutId=\"settings-subnav-pill\"" launcher/src/renderer/src/components/SettingsPanes/SettingsSubSidebar.tsx` returns 1 hit.
    - `grep "left-\\[220px\\]" launcher/src/renderer/src/components/SettingsModal.tsx` returns 1 hit (D-09 "over main area only").
    - `grep "h-\\[560px\\]" launcher/src/renderer/src/components/SettingsModal.tsx` returns 1 hit (D-09).
    - SettingsModal test (10 assertions) passes.
    - SettingsSubSidebar test (5 assertions) passes.
    - `SETTINGS_PANES` tuple equals `['general', 'account', 'appearance', 'spotify', 'about']` in that order.
  </acceptance_criteria>
  <done>Modal shell + sub-sidebar ship with forceMount pattern + layoutId glide + anti-bloat check.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GeneralPane (RamSlider migration) + AboutPane (version + doc links)</name>
  <files>launcher/src/renderer/src/components/SettingsPanes/GeneralPane.tsx, launcher/src/renderer/src/components/SettingsPanes/__tests__/GeneralPane.test.tsx, launcher/src/renderer/src/components/SettingsPanes/AboutPane.tsx, launcher/src/renderer/src/components/SettingsPanes/__tests__/AboutPane.test.tsx</files>
  <read_first>
    - launcher/src/renderer/src/components/RamSlider.tsx (existing component — no props; internally reads/writes useSettingsStore)
    - launcher/src/renderer/src/components/__tests__/RamSlider.test.tsx (patterns that still apply)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-10 (General pane: RAM + launch-log + crash-reports; About pane: version, license placeholder, build hash, anticheat-safety doc link)
    - launcher/package.json (to confirm version "0.1.0" for About)
  </read_first>
  <behavior>
    - GeneralPane renders:
      - Section heading "General" (text-xl font-semibold)
      - <RamSlider /> (existing component)
      - Subsection heading "Logs & Crashes"
      - "Open crash-reports folder" button → calls `window.wiiwho.logs.openCrashFolder()`
      - "List recent crashes" button → calls `window.wiiwho.logs.listCrashReports()` and logs to console (stub)
    - AboutPane renders:
      - Section heading "About"
      - App name "Wiiwho Client" (text-xl font-semibold)
      - Version "v0.1.0-dev" (mono, text-neutral-500)
      - "Build: {process.env.VITE_BUILD_HASH ?? 'dev'}" — font-mono
      - License line: "License: TBD (pre-v0.1 release)" — per PROJECT.md Open Questions
      - Link "ANTICHEAT-SAFETY.md" → onClick opens external via window.wiiwho.logs.openCrashFolder if we have a 'docs' equivalent, OR just an <a href="https://github.com/EliyahuMizrahi/wiiwho-client/blob/master/docs/ANTICHEAT-SAFETY.md" target="_blank" rel="noopener noreferrer">
  </behavior>
  <action>
    1. Write `launcher/src/renderer/src/components/SettingsPanes/__tests__/GeneralPane.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { GeneralPane } from '../GeneralPane'
    import { useSettingsStore } from '../../../stores/settings'

    Element.prototype.hasPointerCapture = (() => false) as never
    Element.prototype.releasePointerCapture = (() => {}) as never
    Element.prototype.scrollIntoView = (() => {}) as never

    const openCrashFolderMock = vi.fn().mockResolvedValue({ ok: true })
    const listCrashReportsMock = vi.fn().mockResolvedValue({ crashes: [] })
    const settingsGetMock = vi.fn().mockResolvedValue({ version: 2, ramMb: 2048, firstRunSeen: true, theme: { accent: '#16e0ee', reduceMotion: 'system' } })
    const settingsSetMock = vi.fn().mockResolvedValue({ ok: true, settings: { version: 2, ramMb: 2048, firstRunSeen: true, theme: { accent: '#16e0ee', reduceMotion: 'system' } } })

    beforeEach(() => {
      ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
        auth: {}, game: {},
        logs: { openCrashFolder: openCrashFolderMock, listCrashReports: listCrashReportsMock },
        settings: { get: settingsGetMock, set: settingsSetMock },
        __debug: {},
      }
      useSettingsStore.setState({ version: 2, ramMb: 2048, firstRunSeen: true, theme: { accent: '#16e0ee', reduceMotion: 'system' }, hydrated: true, modalOpen: true, openPane: 'general' } as never)
    })
    afterEach(() => { cleanup(); vi.clearAllMocks() })

    describe('GeneralPane', () => {
      it('renders section heading "General"', () => {
        render(<GeneralPane />)
        expect(screen.getByRole('heading', { name: 'General' })).toBeDefined()
      })

      it('mounts RamSlider (visible slider with accessible name)', () => {
        render(<GeneralPane />)
        expect(screen.getByRole('slider')).toBeDefined()
      })

      it('has "Open crash-reports folder" button that calls window.wiiwho.logs.openCrashFolder()', async () => {
        const user = userEvent.setup()
        render(<GeneralPane />)
        await user.click(screen.getByRole('button', { name: /open crash-reports folder/i }))
        expect(openCrashFolderMock).toHaveBeenCalledTimes(1)
      })

      it('contains NO anti-bloat strings', () => {
        const { container } = render(<GeneralPane />)
        const text = container.textContent?.toLowerCase() ?? ''
        expect(text).not.toMatch(/\b(ad|ads|news feed|friends? online|concurrent users|buy|subscribe)\b/)
      })
    })
    ```

    2. Create `launcher/src/renderer/src/components/SettingsPanes/GeneralPane.tsx`:

    ```tsx
    /**
     * Settings modal → General pane.
     *
     * Contents (D-10):
     *  - RAM slider (migrated from Phase 3 SettingsDrawer).
     *  - Open crash-reports folder shortcut.
     *  - List recent crashes (stub — full viewer ships in CrashViewer already).
     */
    import type React from 'react'
    import { RamSlider } from '../RamSlider'

    export function GeneralPane(): React.JSX.Element {
      return (
        <div data-testid="general-pane" className="flex flex-col gap-8">
          <h2 className="text-xl font-semibold text-neutral-200">General</h2>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Memory</h3>
            <RamSlider />
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Logs & Crashes</h3>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { void window.wiiwho.logs.openCrashFolder() }}
                className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Open crash-reports folder
              </button>
              <button
                type="button"
                onClick={() => { void window.wiiwho.logs.listCrashReports().then(r => console.info('Crashes:', r)) }}
                className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                List recent crashes
              </button>
            </div>
          </section>
        </div>
      )
    }
    ```

    3. Write `launcher/src/renderer/src/components/SettingsPanes/__tests__/AboutPane.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import { AboutPane } from '../AboutPane'

    describe('AboutPane', () => {
      afterEach(cleanup)

      it('renders "Wiiwho Client" app name', () => {
        render(<AboutPane />)
        expect(screen.getByText(/^Wiiwho Client$/)).toBeDefined()
      })

      it('renders version string matching "v0.1.0"', () => {
        render(<AboutPane />)
        const text = (screen.getByTestId('about-pane') as HTMLElement).textContent ?? ''
        expect(text).toMatch(/v0\.1\.0/)
      })

      it('includes a link to ANTICHEAT-SAFETY.md', () => {
        render(<AboutPane />)
        const link = screen.getByRole('link', { name: /ANTICHEAT-SAFETY/i })
        expect(link).toBeDefined()
        expect(link.getAttribute('href')).toMatch(/ANTICHEAT-SAFETY/)
        expect(link.getAttribute('rel')).toContain('noopener')
      })

      it('declares license state ("TBD")', () => {
        render(<AboutPane />)
        const text = (screen.getByTestId('about-pane') as HTMLElement).textContent ?? ''
        expect(text.toLowerCase()).toMatch(/license.*tbd/i)
      })

      it('contains NO anti-bloat strings', () => {
        const { container } = render(<AboutPane />)
        const text = container.textContent?.toLowerCase() ?? ''
        expect(text).not.toMatch(/\b(ad|ads|news feed|friends? online|concurrent users)\b/)
      })
    })
    ```

    4. Create `launcher/src/renderer/src/components/SettingsPanes/AboutPane.tsx`:

    ```tsx
    /**
     * Settings modal → About pane.
     *
     * Contents (D-10): app name, version, build hash, license placeholder, ANTICHEAT-SAFETY.md link.
     */
    import type React from 'react'

    const BUILD_HASH = (import.meta as unknown as { env?: { VITE_BUILD_HASH?: string } }).env?.VITE_BUILD_HASH ?? 'dev'
    const ANTICHEAT_DOC_URL = 'https://github.com/EliyahuMizrahi/wiiwho-client/blob/master/docs/ANTICHEAT-SAFETY.md'

    export function AboutPane(): React.JSX.Element {
      return (
        <div data-testid="about-pane" className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-neutral-200">About</h2>

          <section className="flex flex-col gap-1">
            <div className="text-lg font-semibold">Wiiwho Client</div>
            <div className="text-sm text-neutral-500" style={{ fontFamily: 'var(--font-mono)' }}>
              v0.1.0-dev
            </div>
            <div className="text-xs text-neutral-600" style={{ fontFamily: 'var(--font-mono)' }}>
              Build: {BUILD_HASH}
            </div>
          </section>

          <section className="flex flex-col gap-1 text-sm">
            <div>License: TBD (pre-v0.1 release)</div>
            <div>
              <a
                href={ANTICHEAT_DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--color-accent)' }}
              >
                ANTICHEAT-SAFETY.md
              </a>
            </div>
          </section>
        </div>
      )
    }
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/SettingsPanes/__tests__/GeneralPane.test.tsx src/renderer/src/components/SettingsPanes/__tests__/AboutPane.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/SettingsPanes/GeneralPane.tsx` exports `GeneralPane`; renders `<RamSlider />`.
    - `grep "openCrashFolder" launcher/src/renderer/src/components/SettingsPanes/GeneralPane.tsx` returns ≥1 hit.
    - `launcher/src/renderer/src/components/SettingsPanes/AboutPane.tsx` exports `AboutPane`; renders "Wiiwho Client" + version + build hash + ANTICHEAT-SAFETY link.
    - `grep "ANTICHEAT-SAFETY" launcher/src/renderer/src/components/SettingsPanes/AboutPane.tsx` returns 1 hit.
    - `grep "rel=\"noopener" launcher/src/renderer/src/components/SettingsPanes/AboutPane.tsx` returns 1 hit.
    - Both test files pass all assertions.
  </acceptance_criteria>
  <done>GeneralPane migrates RamSlider; AboutPane delivers version/license/doc link; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: AccountPane (username + UUID + skin head + Sign out)</name>
  <files>launcher/src/renderer/src/components/SettingsPanes/AccountPane.tsx, launcher/src/renderer/src/components/SettingsPanes/__tests__/AccountPane.test.tsx</files>
  <read_first>
    - launcher/src/renderer/src/components/AccountBadge.tsx (pattern for useSkinHead + logout wiring)
    - launcher/src/renderer/src/hooks/useSkinHead.ts
    - launcher/src/renderer/src/stores/auth.ts (shape: state, username, uuid, logout)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-10 (Account pane contents)
  </read_first>
  <behavior>
    - AccountPane reads useAuthStore: `username`, `uuid`
    - Renders heading "Account"
    - Shows 64px skin head (useSkinHead hook) with username initial fallback
    - Shows username (text-lg font-semibold)
    - Shows full UUID (font-mono, text-sm, text-neutral-500, break-all)
    - Shows "Sign out" button → calls useAuthStore.logout() (no confirm — D-15 preserves Phase 2)
    - If logged-out (edge case), shows "Not signed in" message
  </behavior>
  <action>
    1. Create test:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { AccountPane } from '../AccountPane'
    import { useAuthStore } from '../../../stores/auth'

    const logoutMock = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      useAuthStore.setState({
        state: 'logged-in',
        username: 'Wiiwho',
        uuid: '12345678-1234-1234-1234-1234567890ab',
        logout: logoutMock,
      } as never)
    })
    afterEach(() => { cleanup(); vi.clearAllMocks() })

    describe('AccountPane', () => {
      it('renders heading "Account"', () => {
        render(<AccountPane />)
        expect(screen.getByRole('heading', { name: 'Account' })).toBeDefined()
      })

      it('displays username', () => {
        render(<AccountPane />)
        expect(screen.getByText('Wiiwho')).toBeDefined()
      })

      it('displays full UUID (not truncated)', () => {
        render(<AccountPane />)
        expect(screen.getByText('12345678-1234-1234-1234-1234567890ab')).toBeDefined()
      })

      it('has "Sign out" button wired to useAuthStore.logout (no confirm — D-15)', async () => {
        const user = userEvent.setup()
        render(<AccountPane />)
        await user.click(screen.getByRole('button', { name: /sign out/i }))
        expect(logoutMock).toHaveBeenCalledTimes(1)
      })

      it('has data-testid="account-pane"', () => {
        render(<AccountPane />)
        expect(screen.getByTestId('account-pane')).toBeDefined()
      })

      it('renders "Not signed in" when username/uuid are missing', () => {
        useAuthStore.setState({ username: undefined, uuid: undefined } as never)
        render(<AccountPane />)
        expect(screen.getByText(/not signed in/i)).toBeDefined()
      })
    })
    ```

    2. Create AccountPane.tsx:

    ```tsx
    /**
     * Settings modal → Account pane — D-10.
     *
     * Contents: skin-head preview (64px) + username + full UUID + Sign out action.
     * Sign out follows Phase 2 D-15 — instant, no confirm dialog.
     */
    import type React from 'react'
    import { useAuthStore } from '../../stores/auth'
    import { useSkinHead } from '../../hooks/useSkinHead'

    export function AccountPane(): React.JSX.Element {
      const username = useAuthStore((s) => s.username)
      const uuid = useAuthStore((s) => s.uuid)
      const logout = useAuthStore((s) => s.logout)
      const skin = useSkinHead(uuid, username)

      if (!username || !uuid) {
        return (
          <div data-testid="account-pane" className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-neutral-200">Account</h2>
            <p className="text-sm text-neutral-500">Not signed in.</p>
          </div>
        )
      }

      return (
        <div data-testid="account-pane" className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-neutral-200">Account</h2>

          <div className="flex items-center gap-4">
            {!skin.isPlaceholder && skin.src ? (
              <img
                src={skin.src}
                alt=""
                width={64}
                height={64}
                className="size-16 rounded-lg bg-neutral-800"
                onError={() => skin.markFetchFailed()}
              />
            ) : (
              <div
                aria-hidden="true"
                className="size-16 rounded-lg bg-neutral-700 flex items-center justify-center text-2xl text-neutral-200"
              >
                {skin.initial}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="text-lg font-semibold text-neutral-200">{username}</div>
              <div
                className="text-sm text-neutral-500 break-all"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {uuid}
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Sign out
            </button>
          </div>
        </div>
      )
    }
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/SettingsPanes/__tests__/AccountPane.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/SettingsPanes/AccountPane.tsx` exports `AccountPane`.
    - `grep "useAuthStore" launcher/src/renderer/src/components/SettingsPanes/AccountPane.tsx` returns ≥1 hit.
    - `grep "logout" launcher/src/renderer/src/components/SettingsPanes/AccountPane.tsx` returns ≥1 hit.
    - Full UUID displayed via `break-all` class (no truncation).
    - All 6 test assertions pass.
  </acceptance_criteria>
  <done>AccountPane delivers D-10 contents; Sign out instant (no confirm); test green.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm --filter ./launcher run test:run` exits 0.
- `pnpm --filter ./launcher run typecheck` exits 0.
- `grep "forceMount" launcher/src/renderer/src/components/SettingsModal.tsx` returns ≥3 hits.
- The SettingsModal.tsx source has Portal UNCONDITIONALLY mounted (no `{open && ...}` wrapper around `<DialogPrimitive.Portal`); AnimatePresence lives INSIDE the Portal; the `{open && (...)}` guard lives INSIDE AnimatePresence wrapping Overlay + Content.
- `grep "layoutId" launcher/src/renderer/src/components/SettingsPanes/SettingsSubSidebar.tsx` returns 1 hit.
- Opening the modal via `useSettingsStore.getState().setModalOpen(true)` in dev-mode renders the bottom slide shell with sub-sidebar + active pane AND, upon close, plays the full 320ms slide-down exit animation (not an instant unmount).
</verification>

<success_criteria>
Settings modal chrome + 3 of 5 panes ship. UI-03 motion stack proven end-to-end on the modal (slide-up + fade + reduced-motion collapse, with EXIT animations actually running — not skipped). UI-04 sidebar → modal dispatch works. UI-05 anti-bloat grep clean across modal + all new panes. Plan 04-04 can slot ThemePicker into the Appearance stub; Plan 04-06 can slot Spotify pane content into the Spotify stub.
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-03-settings-modal-chrome-SUMMARY.md` documenting:
- forceMount verification (Portal + Overlay + Content all present)
- Nesting confirmation: Portal unconditional; AnimatePresence INSIDE Portal; {open &&} guard INSIDE AnimatePresence
- Sub-sidebar pane order + labels
- GeneralPane content summary (includes RamSlider migration note)
- AccountPane D-15 preservation (no confirm dialog)
- Remaining stubs for Plans 04-04 (Appearance) + 04-06 (Spotify)
</output>
</output>
