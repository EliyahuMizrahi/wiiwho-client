---
phase: 04-launcher-ui-polish
plan: 02
type: execute
wave: 2
depends_on:
  - 04-01
files_modified:
  - launcher/src/renderer/src/components/Sidebar.tsx
  - launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx
  - launcher/src/renderer/src/components/MainArea/Play.tsx
  - launcher/src/renderer/src/components/MainArea/Cosmetics.tsx
  - launcher/src/renderer/src/components/MainArea/__tests__/Play.test.tsx
  - launcher/src/renderer/src/components/MainArea/__tests__/Cosmetics.test.tsx
  - launcher/src/renderer/src/components/AccountBadge.tsx
  - launcher/src/renderer/src/components/__tests__/AccountBadge.test.tsx
  - launcher/src/renderer/src/stores/activeSection.ts
  - launcher/src/renderer/src/stores/__tests__/activeSection.test.ts
  - launcher/src/renderer/src/components/SettingsDrawer.tsx
autonomous: true
requirements:
  - UI-03
  - UI-04
  - UI-05
must_haves:
  truths:
    - "Sidebar renders fixed 220px column with Play (default active) + Cosmetics rows, thin divider, Spotify slot (placeholder), Settings gear at bottom"
    - "Sidebar does NOT render Account as a top-level row (per E-03 interpretation)"
    - "Clicking Play/Cosmetics swaps activeSection in the store; main area re-renders"
    - "Active sidebar item shows accent-color pill + 3px left accent bar (D-03)"
    - "Play main area renders hero CSS-gradient stub + centered <h1>Wiiwho Client</h1> + <PlayButton/> + v0.1.0-dev footer (D-04)"
    - "Cosmetics main area renders centered stylized cape SVG + headline 'Cosmetics coming soon' + subtext 'Placeholder cape arriving in v0.2.' (D-05)"
    - "AccountBadge dropdown is extended with 'Account settings' item that calls setOpenPane('account') (D-06, D-11)"
    - "SettingsDrawer.tsx is deleted; no imports reference it"
  artifacts:
    - path: "launcher/src/renderer/src/components/Sidebar.tsx"
      provides: "Sidebar nav component with active-state animation (motion layoutId)"
      exports: ["Sidebar"]
    - path: "launcher/src/renderer/src/components/MainArea/Play.tsx"
      provides: "Play section — gradient stub + PlayButton + wordmark + version"
      exports: ["Play"]
    - path: "launcher/src/renderer/src/components/MainArea/Cosmetics.tsx"
      provides: "Cosmetics 'Coming soon' empty state"
      exports: ["Cosmetics"]
    - path: "launcher/src/renderer/src/stores/activeSection.ts"
      provides: "Zustand store holding activeSection: 'play' | 'cosmetics'"
      exports: ["useActiveSectionStore", "ActiveSection"]
  key_links:
    - from: "launcher/src/renderer/src/components/Sidebar.tsx"
      to: "activeSection store"
      via: "onClick handlers call setActiveSection"
      pattern: "setActiveSection\\("
    - from: "launcher/src/renderer/src/components/AccountBadge.tsx"
      to: "useSettingsStore.setOpenPane"
      via: "Account settings menu item"
      pattern: "setOpenPane\\('account'\\)"
---

<objective>
Build the Phase 4 main-surface layout: the new 220px left Sidebar, the Play and Cosmetics main-area components, and the extended AccountBadge dropdown with deep-link into the Settings modal's Account pane. Delete the Phase 3 SettingsDrawer. Establish the `activeSection` store so Plan 04-07 can wire App.tsx to the new layout.

This plan does NOT render the Settings modal itself (Plan 04-03) or the Spotify mini-player (Plan 04-06). The Sidebar renders placeholder slots for both that later plans replace with real components.

Purpose: Deliver the sidebar-driven navigation (UI-04) + the two main-area surfaces (Play + Cosmetics) so the user's mental model is immediately correct once Plans 04-03 + 04-06 slot in.

Output: `Sidebar`, `Play`, `Cosmetics` components + `activeSection` store + extended `AccountBadge` + deleted `SettingsDrawer`. Tests cover: sidebar rows in order, no Account row present, active-state switching, anti-bloat grep (no "friends" / "news" / "ads" markup).
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@launcher/src/renderer/src/components/PlayButton.tsx
@launcher/src/renderer/src/components/AccountBadge.tsx
@launcher/src/renderer/src/components/SettingsDrawer.tsx
@.planning/phases/04-launcher-ui-polish/04-01-tokens-and-settings-SUMMARY.md
</context>

<interfaces>
<!-- Extracted — what Sidebar + MainArea consume -->

From launcher/src/renderer/src/theme/presets.ts (Plan 04-01):
```typescript
export const ACCENT_PRESETS: readonly AccentPreset[]
```

From launcher/src/renderer/src/theme/motion.ts (Plan 04-01):
```typescript
export const SPRING_STANDARD: { type: 'spring'; stiffness: 300; damping: 30; mass: 1 }
```

From launcher/src/renderer/src/hooks/useMotionConfig.ts (Plan 04-01):
```typescript
export function useMotionConfig(): { reduced: boolean; durationFast: number; durationMed: number; durationSlow: number; spring: ... }
```

From launcher/src/renderer/src/stores/settings.ts (Plan 04-01):
```typescript
// new actions available:
setOpenPane: (pane: 'general' | 'account' | 'appearance' | 'spotify' | 'about') => void
setModalOpen: (open: boolean) => void
```

From launcher/src/renderer/src/components/PlayButton.tsx (Phase 3, reusable):
```typescript
export function PlayButton(): React.JSX.Element
```

From launcher/src/renderer/src/components/AccountBadge.tsx (Phase 2, extending):
```typescript
export function AccountBadge(): React.JSX.Element | null
```

From motion (Plan 04-00):
```typescript
import { motion } from 'motion/react'   // NOT 'motion' — Pitfall 5
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: activeSection Zustand store + Sidebar component (with layoutId pill glide)</name>
  <files>launcher/src/renderer/src/stores/activeSection.ts, launcher/src/renderer/src/stores/__tests__/activeSection.test.ts, launcher/src/renderer/src/components/Sidebar.tsx, launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-01, §D-02, §D-03 (sidebar layout + row order + active-state)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack → §Pattern A (exact motion.div + layoutId JSX for the pill glide)
    - launcher/src/renderer/src/stores/auth.ts (existing Zustand store shape to mirror)
    - launcher/src/renderer/src/components/AccountBadge.tsx (existing lucide-react + Tailwind class pattern)
    - .planning/phases/04-launcher-ui-polish/04-VALIDATION.md §Manual-Only Verifications (sidebar pill glide visual)
  </read_first>
  <behavior>
    - activeSection store: `{ section: 'play' | 'cosmetics', setSection(s): void }` — default 'play'
    - Sidebar renders exactly these elements in this order, top-to-bottom:
        1. Header (optional: small "Wiiwho" wordmark at top — planner may add or skip)
        2. Nav list: Play row (icon: lucide Play), Cosmetics row (icon: lucide Shirt)
        3. Thin divider border-t border-wiiwho-border
        4. Spotify slot placeholder: div with data-testid="spotify-slot" containing text "Spotify" (real component wires in Plan 04-06)
        5. Settings gear button at bottom: lucide Settings icon, aria-label="Open settings", onClick calls setModalOpen(true)
    - Active row visual: absolute-positioned motion.div with layoutId="sidebar-nav-pill" (bg-accent/10 rounded-md) + layoutId="sidebar-nav-bar" (w-[3px] bg-accent left edge). Spring transition.
    - NO Account row as a top-level (E-03 enforced by test).
    - Sidebar root element has className "w-[220px] h-full shrink-0 flex flex-col border-r border-wiiwho-border bg-wiiwho-surface"
  </behavior>
  <action>
    1. Replace `launcher/src/renderer/src/stores/__tests__/activeSection.test.ts` (doesn't exist yet — create it):

    ```ts
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach } from 'vitest'
    import { cleanup } from '@testing-library/react'
    import { useActiveSectionStore } from '../activeSection'

    describe('activeSection store', () => {
      afterEach(cleanup)

      it('default section is "play"', () => {
        expect(useActiveSectionStore.getState().section).toBe('play')
      })

      it('setSection swaps to cosmetics and back', () => {
        useActiveSectionStore.getState().setSection('cosmetics')
        expect(useActiveSectionStore.getState().section).toBe('cosmetics')
        useActiveSectionStore.getState().setSection('play')
        expect(useActiveSectionStore.getState().section).toBe('play')
      })
    })
    ```

    2. Create `launcher/src/renderer/src/stores/activeSection.ts`:

    ```ts
    /**
     * Which section the main area is showing. D-02: Play default + Cosmetics.
     * Settings is a modal, not a section — the gear at sidebar bottom toggles it
     * via useSettingsStore.setModalOpen(). Account is reachable only from the
     * top-right AccountBadge dropdown and the Settings modal's Account pane (E-03).
     */
    import { create } from 'zustand'

    export type ActiveSection = 'play' | 'cosmetics'

    export interface ActiveSectionStore {
      section: ActiveSection
      setSection: (s: ActiveSection) => void
    }

    export const useActiveSectionStore = create<ActiveSectionStore>((set) => ({
      section: 'play',
      setSection: (section) => set({ section }),
    }))
    ```

    3. Replace `launcher/src/renderer/src/components/__tests__/Sidebar.test.tsx` (Wave 0 stub) with real tests:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { Sidebar } from '../Sidebar'
    import { useActiveSectionStore } from '../../stores/activeSection'
    import { useSettingsStore } from '../../stores/settings'

    // jsdom stubs for Radix pointer-capture (pattern from Phase 2/3)
    Element.prototype.hasPointerCapture = (() => false) as never
    Element.prototype.releasePointerCapture = (() => {}) as never
    Element.prototype.scrollIntoView = (() => {}) as never

    describe('Sidebar', () => {
      afterEach(() => {
        cleanup()
        useActiveSectionStore.setState({ section: 'play' })
      })

      it('renders Play row and Cosmetics row', () => {
        render(<Sidebar />)
        expect(screen.getByRole('button', { name: /play/i })).toBeDefined()
        expect(screen.getByRole('button', { name: /cosmetics/i })).toBeDefined()
      })

      it('does NOT render an Account row (E-03 interpretation)', () => {
        render(<Sidebar />)
        expect(screen.queryByRole('button', { name: /^account$/i })).toBeNull()
      })

      it('renders Settings gear button at bottom', () => {
        render(<Sidebar />)
        expect(screen.getByRole('button', { name: /open settings/i })).toBeDefined()
      })

      it('renders Spotify slot placeholder (data-testid="spotify-slot")', () => {
        render(<Sidebar />)
        expect(screen.getByTestId('spotify-slot')).toBeDefined()
      })

      it('default active section is "play" (aria-current="page")', () => {
        render(<Sidebar />)
        expect(screen.getByRole('button', { name: /play/i })).toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('button', { name: /cosmetics/i })).not.toHaveAttribute('aria-current', 'page')
      })

      it('clicking Cosmetics swaps activeSection', async () => {
        const user = userEvent.setup()
        render(<Sidebar />)
        await user.click(screen.getByRole('button', { name: /cosmetics/i }))
        expect(useActiveSectionStore.getState().section).toBe('cosmetics')
        expect(screen.getByRole('button', { name: /cosmetics/i })).toHaveAttribute('aria-current', 'page')
      })

      it('clicking Settings gear opens the modal via useSettingsStore.setModalOpen(true)', async () => {
        const user = userEvent.setup()
        render(<Sidebar />)
        await user.click(screen.getByRole('button', { name: /open settings/i }))
        expect(useSettingsStore.getState().modalOpen).toBe(true)
      })

      it('contains NO anti-bloat strings (ads/news/friends/online users — UI-05)', () => {
        const { container } = render(<Sidebar />)
        const text = container.textContent?.toLowerCase() ?? ''
        expect(text).not.toMatch(/\b(ad|ads|advertisement|news|news feed|online users|friends? online|concurrent users)\b/)
      })

      it('renders items in order: Play → Cosmetics → divider → Spotify slot → Settings gear', () => {
        const { container } = render(<Sidebar />)
        const buttons = Array.from(container.querySelectorAll('button')).map(b => b.getAttribute('aria-label') ?? b.textContent ?? '')
        const playIdx = buttons.findIndex(b => /play/i.test(b))
        const cosmIdx = buttons.findIndex(b => /cosmetics/i.test(b))
        const gearIdx = buttons.findIndex(b => /open settings/i.test(b))
        expect(playIdx).toBeLessThan(cosmIdx)
        expect(cosmIdx).toBeLessThan(gearIdx)
      })
    })
    ```

    4. Create `launcher/src/renderer/src/components/Sidebar.tsx`:

    ```tsx
    /**
     * Sidebar — Phase 4 D-01 fixed 220px icon + label column.
     *
     * Row order (D-02): Play → Cosmetics → divider → Spotify slot (Plan 04-06) → Settings gear.
     * Active visual (D-03): accent-color pill + 3px left accent bar via motion layoutId glide.
     * NO Account row (E-03) — Account lives in AccountBadge dropdown + Settings modal Account pane.
     *
     * Motion: the pill + bar use motion layoutId ("sidebar-nav-pill" + "sidebar-nav-bar")
     * so they glide between active rows via framer-motion's layout animation (RESEARCH §Pattern A).
     * Spring config: stiffness 300, damping 30, mass 1.
     */
    import type React from 'react'
    import { motion } from 'motion/react'
    import { Play, Shirt, Settings as SettingsIcon } from 'lucide-react'
    import { useActiveSectionStore, type ActiveSection } from '../stores/activeSection'
    import { useSettingsStore } from '../stores/settings'
    import { SPRING_STANDARD } from '../theme/motion'

    interface NavItem { id: ActiveSection; label: string; Icon: typeof Play }
    const NAV_ITEMS: readonly NavItem[] = [
      { id: 'play',      label: 'Play',      Icon: Play  },
      { id: 'cosmetics', label: 'Cosmetics', Icon: Shirt },
    ] as const

    export function Sidebar(): React.JSX.Element {
      const active = useActiveSectionStore((s) => s.section)
      const setSection = useActiveSectionStore((s) => s.setSection)
      const setModalOpen = useSettingsStore((s) => s.setModalOpen)

      return (
        <nav
          aria-label="Primary navigation"
          className="w-[220px] h-full shrink-0 flex flex-col border-r border-wiiwho-border bg-wiiwho-surface"
        >
          {/* Top section — main nav rows */}
          <ul className="flex-1 flex flex-col gap-1 p-2 pt-4">
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.id
              return (
                <li key={item.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className="relative flex items-center gap-3 w-full px-4 py-3 text-left text-sm rounded-md hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {isActive && (
                      <>
                        <motion.div
                          layoutId="sidebar-nav-pill"
                          className="absolute inset-0 bg-accent/10 rounded-md"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
                          transition={SPRING_STANDARD}
                        />
                        <motion.div
                          layoutId="sidebar-nav-bar"
                          className="absolute left-0 top-0 bottom-0 w-[3px]"
                          style={{ backgroundColor: 'var(--color-accent)' }}
                          transition={SPRING_STANDARD}
                        />
                      </>
                    )}
                    <item.Icon
                      className="size-5 relative z-10"
                      style={{ color: isActive ? 'var(--color-accent)' : undefined }}
                      aria-hidden="true"
                    />
                    <span
                      className="relative z-10"
                      style={{ color: isActive ? 'var(--color-accent)' : undefined }}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Divider */}
          <div className="border-t border-wiiwho-border" />

          {/* Spotify mini-player slot — real component wires in Plan 04-06.
              Placeholder keeps layout height stable. */}
          <div
            data-testid="spotify-slot"
            className="h-20 px-3 flex items-center text-xs text-neutral-500"
          >
            Spotify
          </div>

          {/* Settings gear — bottom pinned */}
          <div className="p-2 border-t border-wiiwho-border">
            <button
              type="button"
              aria-label="Open settings"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <SettingsIcon className="size-5" aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>
        </nav>
      )
    }
    ```

    5. Verify tests pass.
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/stores/__tests__/activeSection.test.ts src/renderer/src/components/__tests__/Sidebar.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/stores/activeSection.ts` exports `useActiveSectionStore` and `ActiveSection` type.
    - `launcher/src/renderer/src/components/Sidebar.tsx` exports `Sidebar`.
    - `grep "layoutId=\"sidebar-nav-pill\"" launcher/src/renderer/src/components/Sidebar.tsx` returns 1 hit.
    - `grep "layoutId=\"sidebar-nav-bar\"" launcher/src/renderer/src/components/Sidebar.tsx` returns 1 hit.
    - `grep "from 'motion/react'" launcher/src/renderer/src/components/Sidebar.tsx` returns 1 hit (NOT `from 'motion'` — Pitfall 5).
    - `grep -i "account" launcher/src/renderer/src/components/Sidebar.tsx` returns 0 hits (no top-level Account row — E-03).
    - Sidebar tests: all 9 assertions pass.
    - Anti-bloat grep test inside Sidebar test passes (no ads/news/friends markup).
  </acceptance_criteria>
  <done>Sidebar renders with active-state pill glide; activeSection store wired; no Account row; Settings gear opens modal.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: MainArea/Play.tsx (gradient stub + PlayButton + wordmark) + MainArea/Cosmetics.tsx (Coming soon)</name>
  <files>launcher/src/renderer/src/components/MainArea/Play.tsx, launcher/src/renderer/src/components/MainArea/Cosmetics.tsx, launcher/src/renderer/src/components/MainArea/__tests__/Play.test.tsx, launcher/src/renderer/src/components/MainArea/__tests__/Cosmetics.test.tsx</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-04 (Play main area — hero + PlayButton + version)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-05 (Cosmetics empty state — exact headline/subtext wording)
    - launcher/src/renderer/src/components/PlayButton.tsx (interface — no props; reads useGameStore)
    - launcher/src/renderer/src/App.tsx (current centered layout to reproduce inside Play)
  </read_first>
  <behavior>
    - Play component:
      - Root div "h-full w-full relative overflow-hidden" with inline style backgroundImage 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, var(--color-wiiwho-bg) 100%)'
      - Centered column: <h1 className="text-4xl font-semibold" style={{ color: 'var(--color-accent)' }}>Wiiwho Client</h1>, <PlayButton />, spacer
      - Bottom-right: <span className="absolute bottom-4 right-4 text-xs text-neutral-500 font-mono">v0.1.0-dev</span>
    - Cosmetics component:
      - Root div "h-full w-full flex flex-col items-center justify-center gap-4"
      - Stylized cape SVG (simple path — trapezoidal outline) width=96 height=120, stroke currentColor, fill none, text-neutral-600
      - <h2 className="text-2xl font-semibold text-neutral-200">Cosmetics coming soon</h2>
      - <p className="text-sm text-neutral-500">Placeholder cape arriving in v0.2.</p>
      - NO interactive elements (no button, no form, no link)
    - Tests:
      - Play: renders wordmark "Wiiwho Client", renders PlayButton (via game store mock), version footer present, NO anti-bloat strings
      - Cosmetics: renders exact headline "Cosmetics coming soon" and subtext "Placeholder cape arriving in v0.2.", NO buttons/inputs/links (assert via querySelector), NO anti-bloat strings
  </behavior>
  <action>
    1. Create `launcher/src/renderer/src/components/MainArea/__tests__/Play.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import { Play } from '../Play'

    // Minimal wiiwho mock so PlayButton can render without IPC
    beforeEach(() => {
      ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
        auth: {}, game: { status: vi.fn().mockResolvedValue({ state: 'idle' }) },
        settings: {}, logs: {}, __debug: {}
      }
    })

    describe('Play main area', () => {
      afterEach(cleanup)

      it('renders wordmark "Wiiwho Client"', () => {
        render(<Play />)
        expect(screen.getByRole('heading', { level: 1, name: /wiiwho client/i })).toBeDefined()
      })

      it('renders version footer "v0.1.0-dev"', () => {
        render(<Play />)
        expect(screen.getByText('v0.1.0-dev')).toBeDefined()
      })

      it('uses CSS gradient referencing --color-accent (D-04)', () => {
        const { container } = render(<Play />)
        const root = container.firstChild as HTMLElement
        const bg = root.style.backgroundImage
        expect(bg).toMatch(/linear-gradient/)
        expect(bg).toMatch(/var\(--color-accent\)|color-mix/)
      })

      it('contains NO anti-bloat strings (UI-05)', () => {
        const { container } = render(<Play />)
        const text = container.textContent?.toLowerCase() ?? ''
        expect(text).not.toMatch(/\b(ad|ads|news|friends? online|concurrent users|online now)\b/)
      })
    })
    ```

    2. Create `launcher/src/renderer/src/components/MainArea/Play.tsx`:

    ```tsx
    /**
     * Play main-area section — D-04.
     *
     * Hero art: owner-drawn bitmap is delivered on the owner's timeline.
     * Phase 4 ships with a CSS-gradient stub (--color-accent at 10% alpha fading
     * to --color-wiiwho-bg) so the layout is never blocked on asset delivery.
     * When the bitmap lands, swap the backgroundImage for a url() reference.
     *
     * Centered column: wordmark + PlayButton. Version in bottom-right.
     */
    import type React from 'react'
    import { PlayButton } from '../PlayButton'

    export function Play(): React.JSX.Element {
      return (
        <section
          className="h-full w-full relative overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, var(--color-wiiwho-bg) 100%)',
          }}
        >
          <div className="h-full w-full flex flex-col items-center justify-center">
            <h1
              className="text-4xl font-semibold mb-8"
              style={{ color: 'var(--color-accent)' }}
            >
              Wiiwho Client
            </h1>
            <PlayButton />
          </div>
          <span
            className="absolute bottom-4 right-4 text-xs text-neutral-500"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            v0.1.0-dev
          </span>
        </section>
      )
    }
    ```

    3. Create `launcher/src/renderer/src/components/MainArea/__tests__/Cosmetics.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import { Cosmetics } from '../Cosmetics'

    describe('Cosmetics main area', () => {
      afterEach(cleanup)

      it('renders headline "Cosmetics coming soon" (D-05 verbatim)', () => {
        render(<Cosmetics />)
        expect(screen.getByRole('heading', { name: 'Cosmetics coming soon' })).toBeDefined()
      })

      it('renders subtext "Placeholder cape arriving in v0.2." (D-05 verbatim)', () => {
        render(<Cosmetics />)
        expect(screen.getByText('Placeholder cape arriving in v0.2.')).toBeDefined()
      })

      it('renders a cape SVG (visual placeholder)', () => {
        const { container } = render(<Cosmetics />)
        expect(container.querySelector('svg')).not.toBeNull()
      })

      it('has NO interactive elements — D-05 "no interactive, no toggle stub"', () => {
        const { container } = render(<Cosmetics />)
        expect(container.querySelectorAll('button').length).toBe(0)
        expect(container.querySelectorAll('input').length).toBe(0)
        expect(container.querySelectorAll('a').length).toBe(0)
        expect(container.querySelectorAll('select').length).toBe(0)
      })

      it('contains NO anti-bloat strings (UI-05)', () => {
        const { container } = render(<Cosmetics />)
        const text = container.textContent?.toLowerCase() ?? ''
        expect(text).not.toMatch(/\b(ad|ads|news|friends? online|buy|subscribe|premium offer)\b/)
      })
    })
    ```

    4. Create `launcher/src/renderer/src/components/MainArea/Cosmetics.tsx`:

    ```tsx
    /**
     * Cosmetics main-area section — D-05 "polished Coming soon empty state."
     *
     * Content (verbatim D-05):
     *   - Headline: "Cosmetics coming soon"
     *   - Subtext: "Placeholder cape arriving in v0.2."
     *   - Stylized cape SVG (no bitmap yet — custom path; lucide-react has no cape icon)
     *
     * NO interactive elements. NO toggle stubs. NO feature previews.
     * Phase 6 ships the real placeholder cape pipeline.
     */
    import type React from 'react'

    export function Cosmetics(): React.JSX.Element {
      return (
        <section className="h-full w-full flex flex-col items-center justify-center gap-4 p-8">
          {/* Custom cape SVG — simple trapezoidal outline. Owner may replace. */}
          <svg
            width="96"
            height="120"
            viewBox="0 0 96 120"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-neutral-600"
          >
            <path d="M24 8 h48 l16 48 l-12 56 h-56 l-12 -56 z" />
            <path d="M48 8 v104" opacity="0.3" />
          </svg>
          <h2 className="text-2xl font-semibold text-neutral-200">
            Cosmetics coming soon
          </h2>
          <p className="text-sm text-neutral-500">
            Placeholder cape arriving in v0.2.
          </p>
        </section>
      )
    }
    ```

    5. Ensure Play + Cosmetics tests pass.
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/MainArea/__tests__/Play.test.tsx src/renderer/src/components/MainArea/__tests__/Cosmetics.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/MainArea/Play.tsx` exports `Play`.
    - `launcher/src/renderer/src/components/MainArea/Cosmetics.tsx` exports `Cosmetics`.
    - `grep "Wiiwho Client" launcher/src/renderer/src/components/MainArea/Play.tsx` returns 1 hit.
    - `grep "v0.1.0-dev" launcher/src/renderer/src/components/MainArea/Play.tsx` returns 1 hit.
    - `grep "Cosmetics coming soon" launcher/src/renderer/src/components/MainArea/Cosmetics.tsx` returns 1 hit.
    - `grep "Placeholder cape arriving in v0.2." launcher/src/renderer/src/components/MainArea/Cosmetics.tsx` returns 1 hit.
    - `grep "var(--color-accent)" launcher/src/renderer/src/components/MainArea/Play.tsx` returns ≥2 hits (gradient + wordmark).
    - Play test (4 assertions) + Cosmetics test (5 assertions) all pass.
  </acceptance_criteria>
  <done>MainArea components ship with verbatim D-04/D-05 content + anti-bloat negative checks.</done>
</task>

<task type="auto">
  <name>Task 3: Extend AccountBadge dropdown with "Account settings" deep-link + delete SettingsDrawer.tsx</name>
  <files>launcher/src/renderer/src/components/AccountBadge.tsx, launcher/src/renderer/src/components/__tests__/AccountBadge.test.tsx, launcher/src/renderer/src/components/SettingsDrawer.tsx</files>
  <read_first>
    - launcher/src/renderer/src/components/AccountBadge.tsx (current dropdown items: Username/UUID label + Log out)
    - launcher/src/renderer/src/components/__tests__/AccountBadge.test.tsx (existing tests — extend, don't break)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-06 (dropdown items + order + "Account settings" deep-link)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-07 (SettingsDrawer.tsx deleted, gear icon from top-right removed)
    - launcher/src/renderer/src/components/SettingsDrawer.tsx (what's being deleted — confirm no export re-used elsewhere)
    - launcher/src/renderer/src/App.tsx (gear icon removal — happens in Plan 04-07; this plan only deletes SettingsDrawer.tsx file)
  </read_first>
  <action>
    1. Verify no file other than `App.tsx` imports SettingsDrawer: `grep -r "SettingsDrawer" launcher/src/` — should show only `App.tsx` (Plan 04-07 will remove that import) and `SettingsDrawer.tsx` self-references. If anything else imports it, STOP and escalate.

    2. Delete `launcher/src/renderer/src/components/SettingsDrawer.tsx`. Leave `launcher/src/renderer/src/components/ui/sheet.tsx` intact (shadcn primitive stays — potentially useful for future flows).

    3. Extend `launcher/src/renderer/src/components/AccountBadge.tsx` — add "Account settings" item BEFORE "Log out", wired to `useSettingsStore.setOpenPane('account')`:

    ```tsx
    // add import at top:
    import { useSettingsStore } from '../stores/settings'

    // inside component:
    const setOpenPane = useSettingsStore((s) => s.setOpenPane)

    // inside DropdownMenuContent, BEFORE the existing DropdownMenuItem "Log out":
    <DropdownMenuItem
      onClick={() => setOpenPane('account')}
      className="text-sm font-normal cursor-pointer"
    >
      Account settings
    </DropdownMenuItem>
    <DropdownMenuSeparator className="bg-neutral-800" />
    ```

    The final menu order (D-06): Label (username + full UUID) → Separator → Account settings → Separator → Log out.

    4. Extend `launcher/src/renderer/src/components/__tests__/AccountBadge.test.tsx` (existing tests stay green; ADD two new test cases):

    ```tsx
    it('renders "Account settings" menu item in the dropdown', async () => {
      const user = userEvent.setup()
      // ... existing auth-store + skin setup ...
      render(<AccountBadge />)
      await user.click(screen.getByRole('button', { name: /account menu/i }))
      expect(await screen.findByRole('menuitem', { name: /account settings/i })).toBeDefined()
    })

    it('clicking "Account settings" calls useSettingsStore.setOpenPane("account")', async () => {
      const user = userEvent.setup()
      // ... existing setup ...
      render(<AccountBadge />)
      await user.click(screen.getByRole('button', { name: /account menu/i }))
      await user.click(await screen.findByRole('menuitem', { name: /account settings/i }))
      expect(useSettingsStore.getState().openPane).toBe('account')
      expect(useSettingsStore.getState().modalOpen).toBe(true)  // Pitfall 8 — single action
    })
    ```

    Read the existing test file, preserve all existing tests, only ADD these two cases and any necessary imports (`useSettingsStore`).
  </action>
  <verify>
    <automated>cd launcher && test ! -f src/renderer/src/components/SettingsDrawer.tsx && pnpm vitest run src/renderer/src/components/__tests__/AccountBadge.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/SettingsDrawer.tsx` DOES NOT exist after this task.
    - `grep -r "SettingsDrawer" launcher/src/renderer/src/` returns ≤1 hit (only the dangling import in App.tsx — Plan 04-07 removes).
    - `grep "Account settings" launcher/src/renderer/src/components/AccountBadge.tsx` returns 1 hit.
    - `grep "setOpenPane('account')" launcher/src/renderer/src/components/AccountBadge.tsx` returns 1 hit.
    - AccountBadge tests (original cases + 2 new) all pass.
  </acceptance_criteria>
  <done>SettingsDrawer.tsx deleted; AccountBadge has "Account settings" deep-link; tests green.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm --filter ./launcher run test:run` full suite exits 0.
- `pnpm --filter ./launcher run typecheck` exits 0.
- `grep -r "SettingsDrawer" launcher/src/renderer/src/components/` returns 0 hits (file deleted, no cross-refs in components dir).
- `grep "from 'motion'" launcher/src/renderer/src/components/Sidebar.tsx` returns 0 hits (must be `motion/react` — Pitfall 5).
- Sidebar renders Play + Cosmetics + Spotify-slot + Settings gear in that DOM order.
- AccountBadge dropdown has 4 items: Username/UUID label, Account settings, Log out (with separators).
</verification>

<success_criteria>
Sidebar + MainArea + extended AccountBadge shipped. UI-04 delivered in-code (sidebar + Play + Cosmetics). UI-05 grep tests enforce zero ads/news/friends markup in the new components. UI-03 foundation: sidebar active-pill uses motion layoutId for smooth glide. The App.tsx wiring in Plan 04-07 can now slot these pieces directly.
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-02-sidebar-and-main-area-SUMMARY.md` documenting:
- Sidebar DOM order + accessibility attributes
- activeSection store shape
- Cosmetics empty-state verbatim text (for UI-05 sign-off)
- AccountBadge dropdown order after extension
- SettingsDrawer.tsx deletion + any imports that need cleanup in App.tsx
</output>
