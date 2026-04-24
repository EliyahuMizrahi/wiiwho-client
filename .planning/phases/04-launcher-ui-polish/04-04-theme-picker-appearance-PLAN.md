---
phase: 04-launcher-ui-polish
plan: 04
type: execute
wave: 3
depends_on:
  - 04-01
files_modified:
  - launcher/src/renderer/src/components/ThemePicker.tsx
  - launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx
  - launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx
  - launcher/src/renderer/src/components/SettingsPanes/__tests__/AppearancePane.test.tsx
autonomous: true
requirements:
  - UI-01
  - UI-03
  - UI-07
must_haves:
  truths:
    - "ThemePicker renders 8 preset swatches in order: Cyan, Mint, Violet, Tangerine, Pink, Crimson, Amber, Slate"
    - "Clicking a preset swatch calls useSettingsStore.setAccent(hex) with the correct hex"
    - "Custom hex input validates /^#[0-9a-fA-F]{6}$/; valid input calls setAccent; invalid is no-op"
    - "EyeDropper button is conditionally rendered only when window.EyeDropper is defined (D-14 fallback)"
    - "AppearancePane renders ThemePicker + 'Reduce motion' select with 3 options (System / On / Off)"
    - "Selecting reduce-motion mode calls useSettingsStore.setReduceMotion"
  artifacts:
    - path: "launcher/src/renderer/src/components/ThemePicker.tsx"
      provides: "8 preset swatches + custom hex input + EyeDropper button"
      exports: ["ThemePicker"]
    - path: "launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx"
      provides: "Appearance pane combining ThemePicker + reduceMotion control"
      exports: ["AppearancePane"]
  key_links:
    - from: "launcher/src/renderer/src/components/ThemePicker.tsx"
      to: "useSettingsStore.setAccent"
      via: "preset click + valid hex input"
      pattern: "setAccent\\("
    - from: "launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx"
      to: "useSettingsStore.setReduceMotion"
      via: "select onChange"
      pattern: "setReduceMotion\\("
---

<objective>
Build the Appearance pane: 8-preset ThemePicker + custom hex input + EyeDropper button (D-14) + "Reduce motion" select (D-24). Replaces the `<div data-testid="appearance-pane-stub">` in SettingsModal (Plan 04-03) via the natural JSX — once AppearancePane exists, Plan 04-07 integration task swaps the stub to `<AppearancePane />` (handled in this plan: modify SettingsModal to render AppearancePane when `openPane === 'appearance'`).

Purpose: Deliver UI-01 user-facing theme switching. User picks an accent preset OR a custom hex, the app mutates `--color-accent` live, the setting persists to `settings.json v2`.

Output: ThemePicker component + AppearancePane component + tests covering swatch clicks, hex validation (valid + invalid), EyeDropper feature-probe, reduceMotion select. Updates SettingsModal.tsx to reference AppearancePane.
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@launcher/src/renderer/src/theme/presets.ts
@launcher/src/renderer/src/components/SettingsModal.tsx
@.planning/phases/04-launcher-ui-polish/04-01-tokens-and-settings-SUMMARY.md
@.planning/phases/04-launcher-ui-polish/04-03-settings-modal-chrome-SUMMARY.md
</context>

<interfaces>
From launcher/src/renderer/src/theme/presets.ts (Plan 04-01):
```typescript
export const ACCENT_PRESETS: readonly AccentPreset[]  // 8 entries
export const DEFAULT_ACCENT_HEX = '#16e0ee'
```

From launcher/src/renderer/src/stores/settings.ts (Plan 04-01):
```typescript
setAccent: (hex: string) => Promise<void>     // validates + mutates :root + persists
setReduceMotion: (mode: 'system'|'on'|'off') => Promise<void>
theme: { accent: string; reduceMotion: 'system'|'on'|'off' }
```

Browser API (RESEARCH §EyeDropper API → Electron 41 compatible):
```typescript
declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> }
  }
}
```

From lucide-react (already installed):
```typescript
import { Pipette } from 'lucide-react'
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ThemePicker component (8 swatches + hex input + EyeDropper)</name>
  <files>launcher/src/renderer/src/components/ThemePicker.tsx, launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx</files>
  <read_first>
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §EyeDropper API → §Implementation pattern (verbatim JSX)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-14, §D-15, §D-16 (custom hex UX, no contrast warning, accent scope)
    - launcher/src/renderer/src/theme/presets.ts (ACCENT_PRESETS order + names)
    - launcher/src/renderer/src/stores/settings.ts (setAccent signature)
  </read_first>
  <behavior>
    - ThemePicker renders 8 preset swatches (buttons) in a grid: Cyan, Mint, Violet, Tangerine, Pink, Crimson, Amber, Slate
    - Each swatch is a 40x40 button with its preset color as background, aria-label="Set accent to {name}", data-accent-preset={id}
    - Active preset gets a ring-2 ring-white/30 border indicator
    - Text input below swatches accepts custom hex, placeholder "#16e0ee", font-mono
    - Input validates /^#[0-9a-fA-F]{6}$/: on valid → setAccent(v); on invalid typing → no state change on store (input value mirrors what user typed locally until valid)
    - EyeDropper button rendered only if typeof window.EyeDropper !== 'undefined'; click calls new window.EyeDropper().open(); on success → setHex + setAccent; on reject (user ESC) → silent
    - Tests:
      - Renders 8 swatches in exact order
      - Clicking Mint swatch calls setAccent('#22c55e')
      - Active preset (e.g., openPane=appearance, theme.accent='#a855f7') shows ring on Violet swatch
      - Typing "#ff00aa" in hex input calls setAccent('#ff00aa')
      - Typing "not-a-hex" does NOT call setAccent
      - EyeDropper button absent when window.EyeDropper undefined
      - EyeDropper button present when window.EyeDropper defined
      - Clicking EyeDropper button calls the API + setAccent on resolved hex
  </behavior>
  <action>
    1. Create `launcher/src/renderer/src/components/__tests__/ThemePicker.test.tsx` (replace Wave 0 stub):

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { ThemePicker } from '../ThemePicker'
    import { useSettingsStore } from '../../stores/settings'

    const setAccentMock = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      useSettingsStore.setState({
        version: 2, ramMb: 2048, firstRunSeen: true,
        theme: { accent: '#16e0ee', reduceMotion: 'system' },
        hydrated: true, modalOpen: true, openPane: 'appearance',
        setAccent: setAccentMock,
      } as never)
      // Remove EyeDropper stub between tests
      delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
    })
    afterEach(() => { cleanup(); vi.clearAllMocks() })

    describe('ThemePicker', () => {
      it('renders 8 preset swatches in order: Cyan, Mint, Violet, Tangerine, Pink, Crimson, Amber, Slate', () => {
        render(<ThemePicker />)
        const swatches = screen.getAllByRole('button').filter(b => b.getAttribute('data-accent-preset'))
        const ids = swatches.map(b => b.getAttribute('data-accent-preset'))
        expect(ids).toEqual(['cyan', 'mint', 'violet', 'tangerine', 'pink', 'crimson', 'amber', 'slate'])
      })

      it('clicking Mint swatch calls setAccent("#22c55e")', async () => {
        const user = userEvent.setup()
        render(<ThemePicker />)
        await user.click(screen.getByLabelText('Set accent to Mint'))
        expect(setAccentMock).toHaveBeenCalledWith('#22c55e')
      })

      it('clicking Violet swatch calls setAccent("#a855f7")', async () => {
        const user = userEvent.setup()
        render(<ThemePicker />)
        await user.click(screen.getByLabelText('Set accent to Violet'))
        expect(setAccentMock).toHaveBeenCalledWith('#a855f7')
      })

      it('active preset has ring indicator (aria-pressed="true")', () => {
        useSettingsStore.setState({ theme: { accent: '#a855f7', reduceMotion: 'system' } } as never)
        render(<ThemePicker />)
        expect(screen.getByLabelText('Set accent to Violet')).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByLabelText('Set accent to Cyan')).toHaveAttribute('aria-pressed', 'false')
      })

      it('typing valid hex "#ff00aa" calls setAccent("#ff00aa")', async () => {
        const user = userEvent.setup()
        render(<ThemePicker />)
        const input = screen.getByPlaceholderText('#16e0ee') as HTMLInputElement
        await user.clear(input)
        await user.type(input, '#ff00aa')
        expect(setAccentMock).toHaveBeenCalledWith('#ff00aa')
      })

      it('typing invalid string "not-a-hex" does NOT call setAccent', async () => {
        const user = userEvent.setup()
        render(<ThemePicker />)
        const input = screen.getByPlaceholderText('#16e0ee') as HTMLInputElement
        await user.clear(input)
        await user.type(input, 'not-a-hex')
        expect(setAccentMock).not.toHaveBeenCalled()
      })

      it('EyeDropper button is NOT rendered when window.EyeDropper is undefined', () => {
        delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
        render(<ThemePicker />)
        expect(screen.queryByRole('button', { name: /pick color from screen/i })).toBeNull()
      })

      it('EyeDropper button IS rendered when window.EyeDropper is defined', () => {
        ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class { open() { return Promise.resolve({ sRGBHex: '#abcdef' }) } }
        render(<ThemePicker />)
        expect(screen.getByRole('button', { name: /pick color from screen/i })).toBeDefined()
      })

      it('clicking EyeDropper button opens the API and calls setAccent on the picked hex', async () => {
        const user = userEvent.setup()
        ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class { open() { return Promise.resolve({ sRGBHex: '#abcdef' }) } }
        render(<ThemePicker />)
        await user.click(screen.getByRole('button', { name: /pick color from screen/i }))
        await new Promise(r => setTimeout(r, 10))
        expect(setAccentMock).toHaveBeenCalledWith('#abcdef')
      })

      it('EyeDropper ESC (reject) does NOT call setAccent', async () => {
        const user = userEvent.setup()
        ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class { open() { return Promise.reject(new Error('user cancelled')) } }
        render(<ThemePicker />)
        await user.click(screen.getByRole('button', { name: /pick color from screen/i }))
        await new Promise(r => setTimeout(r, 10))
        expect(setAccentMock).not.toHaveBeenCalled()
      })
    })
    ```

    2. Create `launcher/src/renderer/src/components/ThemePicker.tsx`:

    ```tsx
    /**
     * Theme picker — UI-01 + D-14.
     *
     * 8 preset swatches + custom hex input + EyeDropper button (Chromium 146 native).
     *
     *   - Swatches: click to call setAccent(preset.hex).
     *   - Hex input: validates /^#[0-9a-fA-F]{6}$/; valid → setAccent; invalid → no-op.
     *   - EyeDropper: rendered only if window.EyeDropper is defined (feature probe).
     *     Errors silenced (user pressing ESC during pick is expected).
     *
     * D-15: no contrast warning — if user picks a low-contrast hex, they get what they asked for.
     */
    import type React from 'react'
    import { useState } from 'react'
    import { Pipette } from 'lucide-react'
    import { ACCENT_PRESETS } from '../theme/presets'
    import { useSettingsStore } from '../stores/settings'

    declare global {
      interface Window {
        EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> }
      }
    }

    const HEX_RE = /^#[0-9a-fA-F]{6}$/

    export function ThemePicker(): React.JSX.Element {
      const accent = useSettingsStore((s) => s.theme.accent)
      const setAccent = useSettingsStore((s) => s.setAccent)
      const [hexInput, setHexInput] = useState(accent)

      const supportsEyeDropper = typeof window.EyeDropper !== 'undefined'

      const onHexChange = (v: string): void => {
        setHexInput(v)
        if (HEX_RE.test(v)) {
          void setAccent(v)
        }
      }

      const pickWithEyedropper = async (): Promise<void> => {
        if (typeof window.EyeDropper === 'undefined') return
        try {
          const dropper = new window.EyeDropper()
          const result = await dropper.open()
          setHexInput(result.sRGBHex)
          void setAccent(result.sRGBHex)
        } catch {
          // User pressed ESC — silent.
        }
      }

      return (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Accent color</label>
            <div className="grid grid-cols-8 gap-2">
              {ACCENT_PRESETS.map((p) => {
                const isActive = accent.toLowerCase() === p.hex.toLowerCase()
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-accent-preset={p.id}
                    aria-label={`Set accent to ${p.name}`}
                    aria-pressed={isActive}
                    onClick={() => void setAccent(p.hex)}
                    title={p.name}
                    className={`size-10 rounded transition-shadow focus-visible:outline-none ${isActive ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-wiiwho-surface' : 'hover:ring-2 hover:ring-white/20'}`}
                    style={{ backgroundColor: p.hex }}
                  />
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2" htmlFor="accent-hex">Custom hex</label>
            <div className="flex gap-2">
              <input
                id="accent-hex"
                type="text"
                value={hexInput}
                onChange={(e) => onHexChange(e.target.value)}
                placeholder="#16e0ee"
                maxLength={7}
                className="flex-1 px-3 py-2 text-sm rounded bg-neutral-900 border border-wiiwho-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
              {supportsEyeDropper && (
                <button
                  type="button"
                  aria-label="Pick color from screen"
                  onClick={() => void pickWithEyedropper()}
                  className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Pipette className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/__tests__/ThemePicker.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/ThemePicker.tsx` exports `ThemePicker`.
    - `grep "ACCENT_PRESETS" launcher/src/renderer/src/components/ThemePicker.tsx` returns ≥1 hit.
    - `grep "setAccent" launcher/src/renderer/src/components/ThemePicker.tsx` returns ≥3 hits (swatch click + hex change + eyedropper).
    - `grep "EyeDropper" launcher/src/renderer/src/components/ThemePicker.tsx` returns ≥2 hits (type declaration + feature probe).
    - `grep "/\\^#\\[0-9a-fA-F\\]{6}\\$/" launcher/src/renderer/src/components/ThemePicker.tsx` returns ≥1 hit.
    - All 10 test assertions pass.
  </acceptance_criteria>
  <done>ThemePicker ships with 8 swatches + hex input + EyeDropper feature-probe; test green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: AppearancePane (ThemePicker + Reduce motion) + wire into SettingsModal</name>
  <files>launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx, launcher/src/renderer/src/components/SettingsPanes/__tests__/AppearancePane.test.tsx, launcher/src/renderer/src/components/SettingsModal.tsx</files>
  <read_first>
    - launcher/src/renderer/src/components/SettingsModal.tsx (the 'appearance' stub that needs replacement)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-10, §D-24 (Appearance pane = ThemePicker + Reduce motion)
    - launcher/src/renderer/src/stores/settings.ts (setReduceMotion signature + allowed values 'system'|'on'|'off')
  </read_first>
  <behavior>
    - AppearancePane renders heading "Appearance" + ThemePicker + "Reduce motion" select (System / On / Off)
    - Select reads theme.reduceMotion and calls setReduceMotion on change
    - Tests: renders ThemePicker (8 swatches reachable), renders select with 3 options, selecting 'On' calls setReduceMotion('on')
    - SettingsModal: replace `<div data-testid="appearance-pane-stub">...` with `<AppearancePane />`; preserve data-testid="appearance-pane-stub" on the AppearancePane root OR update the SettingsModal.test.tsx to look for "appearance-pane" instead. Pick the cleaner path (update SettingsModal test to check "appearance-pane" testid rendered by AppearancePane).
  </behavior>
  <action>
    1. Create `launcher/src/renderer/src/components/SettingsPanes/__tests__/AppearancePane.test.tsx`:

    ```tsx
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'
    import { AppearancePane } from '../AppearancePane'
    import { useSettingsStore } from '../../../stores/settings'

    Element.prototype.hasPointerCapture = (() => false) as never
    Element.prototype.releasePointerCapture = (() => {}) as never
    Element.prototype.scrollIntoView = (() => {}) as never

    const setAccentMock = vi.fn().mockResolvedValue(undefined)
    const setReduceMotionMock = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      useSettingsStore.setState({
        theme: { accent: '#16e0ee', reduceMotion: 'system' },
        setAccent: setAccentMock,
        setReduceMotion: setReduceMotionMock,
      } as never)
    })
    afterEach(() => { cleanup(); vi.clearAllMocks() })

    describe('AppearancePane', () => {
      it('renders heading "Appearance"', () => {
        render(<AppearancePane />)
        expect(screen.getByRole('heading', { name: 'Appearance' })).toBeDefined()
      })

      it('renders ThemePicker (8 swatches reachable)', () => {
        const { container } = render(<AppearancePane />)
        const swatches = container.querySelectorAll('[data-accent-preset]')
        expect(swatches.length).toBe(8)
      })

      it('renders "Reduce motion" select with 3 options (System, On, Off)', () => {
        render(<AppearancePane />)
        const select = screen.getByLabelText(/reduce motion/i) as HTMLSelectElement
        const options = Array.from(select.options).map(o => o.value)
        expect(options.sort()).toEqual(['off', 'on', 'system'])
      })

      it('selecting "On" calls setReduceMotion("on")', async () => {
        const user = userEvent.setup()
        render(<AppearancePane />)
        const select = screen.getByLabelText(/reduce motion/i) as HTMLSelectElement
        await user.selectOptions(select, 'on')
        expect(setReduceMotionMock).toHaveBeenCalledWith('on')
      })

      it('has data-testid="appearance-pane"', () => {
        render(<AppearancePane />)
        expect(screen.getByTestId('appearance-pane')).toBeDefined()
      })
    })
    ```

    2. Create `launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx`:

    ```tsx
    /**
     * Settings modal → Appearance pane — D-10 + D-24.
     *
     * Contents:
     *  - ThemePicker: 8 preset swatches + custom hex + EyeDropper.
     *  - Reduce motion: select with System / On / Off (UI-03 reduced-motion toggle).
     */
    import type React from 'react'
    import { ThemePicker } from '../ThemePicker'
    import { useSettingsStore } from '../../stores/settings'

    export function AppearancePane(): React.JSX.Element {
      const reduceMotion = useSettingsStore((s) => s.theme.reduceMotion)
      const setReduceMotion = useSettingsStore((s) => s.setReduceMotion)

      return (
        <div data-testid="appearance-pane" className="flex flex-col gap-8">
          <h2 className="text-xl font-semibold text-neutral-200">Appearance</h2>

          <section>
            <ThemePicker />
          </section>

          <section className="flex flex-col gap-2">
            <label htmlFor="reduce-motion" className="text-sm font-semibold text-neutral-300">
              Reduce motion
            </label>
            <select
              id="reduce-motion"
              value={reduceMotion}
              onChange={(e) => void setReduceMotion(e.target.value as 'system' | 'on' | 'off')}
              className="w-48 px-3 py-2 text-sm rounded bg-neutral-900 border border-wiiwho-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="system">System (follow OS)</option>
              <option value="on">On (always reduce)</option>
              <option value="off">Off (always animate)</option>
            </select>
            <p className="text-xs text-neutral-500">
              Collapses transitions to 0ms when reduced — respects OS accessibility setting when "System" is selected.
            </p>
          </section>
        </div>
      )
    }
    ```

    3. Modify `launcher/src/renderer/src/components/SettingsModal.tsx` — replace the appearance stub with AppearancePane:

    - Add import: `import { AppearancePane } from './SettingsPanes/AppearancePane'`
    - Replace the line:
      ```
      {openPane === 'appearance' && <div data-testid="appearance-pane-stub" className="text-neutral-500">Appearance (Plan 04-04)</div>}
      ```
      With:
      ```
      {openPane === 'appearance' && <AppearancePane />}
      ```
    - The SettingsModal.test.tsx test that currently checks `getByTestId('appearance-pane-stub')` needs updating to `getByTestId('appearance-pane')` to match AppearancePane's root testid. Update that single assertion in SettingsModal.test.tsx.
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/components/SettingsPanes/__tests__/AppearancePane.test.tsx src/renderer/src/components/__tests__/SettingsModal.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx` exports `AppearancePane`.
    - `grep "ThemePicker" launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx` returns ≥1 hit.
    - `grep "setReduceMotion" launcher/src/renderer/src/components/SettingsPanes/AppearancePane.tsx` returns ≥1 hit.
    - `grep "AppearancePane" launcher/src/renderer/src/components/SettingsModal.tsx` returns ≥1 hit.
    - `grep "appearance-pane-stub" launcher/src/renderer/src/components/SettingsModal.tsx` returns 0 hits.
    - AppearancePane test (5 assertions) passes.
    - SettingsModal test still passes after the testid rename.
  </acceptance_criteria>
  <done>AppearancePane replaces the SettingsModal appearance stub; ThemePicker + reduceMotion wired; tests green.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm --filter ./launcher run test:run` exits 0.
- `pnpm --filter ./launcher run typecheck` exits 0.
- Opening SettingsModal + clicking Appearance tab shows 8 preset swatches + hex input + (if supported) EyeDropper button + Reduce motion select.
- Clicking Mint swatch in dev-mode: Play button background updates to green live.
</verification>

<success_criteria>
UI-01 user-facing theme switching complete: 8 presets + custom hex + EyeDropper. UI-03 reduced-motion control exposed in Appearance pane. Settings modal "Appearance" stub replaced with real content. Plan 04-06 slots Spotify pane in the same way.
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-04-theme-picker-appearance-SUMMARY.md` documenting:
- 8 preset hex values in ACCENT_PRESETS order
- EyeDropper feature-probe + fallback behavior
- Reduce motion resolution table (user × OS)
- SettingsModal appearance stub → AppearancePane swap
</output>
