---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 07
type: execute
wave: 2
depends_on: ["03-00"]
files_modified:
  - launcher/src/renderer/src/stores/settings.ts
  - launcher/src/renderer/src/stores/__tests__/settings.test.ts
  - launcher/src/renderer/src/components/RamSlider.tsx
  - launcher/src/renderer/src/components/__tests__/RamSlider.test.tsx
  - launcher/src/renderer/src/components/SettingsDrawer.tsx
  - launcher/src/renderer/src/components/__tests__/SettingsDrawer.test.tsx
autonomous: true
requirements:
  - LAUN-03
  - LAUN-04
must_haves:
  truths:
    - "useSettingsStore loads via window.wiiwho.settings.get() on hydrate and persists via window.wiiwho.settings.set() on change"
    - "RamSlider renders 7 positions (1,1.5,2,2.5,3,3.5,4 GB) with default 2 GB per D-04"
    - "RamSlider caption always visible (D-05 always-visible helper) + info-icon Tooltip for the longer explanation"
    - "SettingsDrawer closes on X button + ESC + click-outside (D-02 all three gestures)"
    - "Settings drawer opens from a gear icon on Home (App wiring comes in Plan 03-10)"
    - "Drawer contains RamSlider + 'Logs' entry + 'Crashes' entry + version footer (D-07 — hidden chrome)"
  artifacts:
    - path: "launcher/src/renderer/src/stores/settings.ts"
      provides: "useSettingsStore — Zustand, hydrate/set/reset, mirrors main-process SettingsV1"
      exports: ["useSettingsStore"]
    - path: "launcher/src/renderer/src/components/RamSlider.tsx"
      provides: "Radix Slider 1024-4096 step 512 + always-visible caption + info-icon Tooltip (D-04 + D-05)"
    - path: "launcher/src/renderer/src/components/SettingsDrawer.tsx"
      provides: "Radix Sheet with RamSlider + Logs/Crashes/About sections + X/ESC/click-outside dismiss (D-01+D-02)"
  key_links:
    - from: "launcher/src/renderer/src/stores/settings.ts"
      to: "window.wiiwho.settings.{get,set}"
      via: "frozen IPC surface"
      pattern: "window.wiiwho.settings"
    - from: "launcher/src/renderer/src/components/RamSlider.tsx"
      to: "useSettingsStore + ui/slider + ui/tooltip"
      via: "Zustand hooks + shadcn primitives"
      pattern: "useSettingsStore"
---

<objective>
Ship the renderer-side settings: a Zustand `useSettingsStore` that hydrates from `window.wiiwho.settings.get()` and persists via `window.wiiwho.settings.set()`; a `RamSlider` component with the seven D-04 positions (1, 1.5, 2, 2.5, 3, 3.5, 4 GB) + D-05 always-visible caption + info-icon Tooltip; and a `SettingsDrawer` (Radix Sheet) that houses the slider + navigation entries for Logs/Crashes + version footer — satisfying D-01 (slide-in right drawer), D-02 (X + ESC + click-outside dismissal), D-07 (Logs/Crashes hidden under Settings).

Plan 03-10 wires the gear-icon trigger in App.tsx — this plan delivers the drawer body ready to be mounted.

Output: 3 components + 3 tests (under `__tests__/` dirs matching Phase 2 convention). All tests green via vitest jsdom env.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/renderer/src/wiiwho.d.ts
@launcher/src/renderer/src/stores/auth.ts
@launcher/src/renderer/src/components/ui/sheet.tsx
@launcher/src/renderer/src/components/ui/slider.tsx
@launcher/src/renderer/src/components/ui/tooltip.tsx
@launcher/src/renderer/src/components/ErrorBanner.tsx
@launcher/src/renderer/src/components/__tests__
@launcher/src/renderer/src/stores/__tests__

<interfaces>
From launcher/src/renderer/src/wiiwho.d.ts (updated by Plan 03-02):
```typescript
settings: {
  get: () => Promise<{ version: 1; ramMb: number; firstRunSeen: boolean }>
  set: (patch: Partial<{ ramMb: number; firstRunSeen: boolean }>) => Promise<{
    ok: boolean
    settings: { version: 1; ramMb: number; firstRunSeen: boolean }
  }>
}
```

From launcher/src/renderer/src/stores/auth.ts (Zustand pattern to mirror):
- `create<AuthStoreState>((set, get) => ({...}))`
- Actions as methods on the store
- Hydrate via `initialize()` action called from App.tsx useEffect

Phase 2 test idioms locked (from 02-05 SUMMARY + vitest 4 + RTL 16):
- `@vitest-environment jsdom` docblock at top of every renderer-side test file
- `afterEach(cleanup)` in every component test describe block
- For Radix primitives using pointer capture: `userEvent.setup()` + Element.prototype pointer-capture stubs via structural cast

Pointer-capture stub (required for Radix Slider + Sheet + Tooltip in jsdom):
```typescript
beforeAll(() => {
  Object.assign(Element.prototype as unknown as {
    hasPointerCapture: () => boolean
    releasePointerCapture: () => void
    scrollIntoView: () => void
  }, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
    scrollIntoView: () => {}
  })
})
```

From .planning/phases/02-microsoft-authentication/02-UI-SPEC.md — UI style to carry:
- Dark neutral-900 surface
- Cyan #16e0ee for interactive accents
- font-normal (never font-bold — Phase 2 migration)
- Tailwind v4 tokens via shadcn new-york-v4
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useSettingsStore — Zustand mirror of main-process settings</name>
  <files>
    launcher/src/renderer/src/stores/settings.ts,
    launcher/src/renderer/src/stores/__tests__/settings.test.ts
  </files>
  <read_first>
    - launcher/src/renderer/src/stores/auth.ts (Zustand pattern to mirror)
    - launcher/src/renderer/src/wiiwho.d.ts (settings IPC contract)
    - launcher/src/renderer/src/stores/__tests__ (existing test structure — where auth.test.ts lives)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: Initial state — `{version: 1, ramMb: 2048, firstRunSeen: false, hydrated: false}` before hydrate runs.
    - Test 2: `initialize()` calls `window.wiiwho.settings.get()` and populates store with the returned shape; sets `hydrated: true`.
    - Test 3: `initialize()` idempotent — second call skips re-fetch.
    - Test 4: `setRamMb(3072)` calls `window.wiiwho.settings.set({ramMb: 3072})` and updates store with returned `settings`.
    - Test 5: `setRamMb` rejects an out-of-range value defensively (stores still normalizes at IPC + store layer; renderer component is primary guard but store acts as second-layer).
    - Test 6: `setFirstRunSeen(true)` patches firstRunSeen + persists.
    - Test 7: Fetch failure in `initialize()` keeps `hydrated: false` but doesn't throw (defensive — Plan 03-10 App.tsx can retry).

    Mock `window.wiiwho.settings` via `Object.defineProperty(window, 'wiiwho', {value: {...stubs}})` in `beforeEach`.
  </behavior>
  <action>
    Create `launcher/src/renderer/src/stores/settings.ts`:

    ```typescript
    /**
     * Renderer-side settings store (Zustand).
     *
     * Mirrors the main-process SettingsV1 schema via the frozen
     * window.wiiwho.settings IPC surface.
     *
     * Hydrate once from App.tsx on mount; subsequent writes go through
     * setRamMb / setFirstRunSeen and round-trip the persisted shape.
     *
     * Source: Plan 03-02 (main-process settings), D-04 (RAM schema), LAUN-03 + LAUN-04
     */

    import { create } from 'zustand'

    export interface SettingsState {
      version: 1
      ramMb: number
      firstRunSeen: boolean
      hydrated: boolean

      initialize: () => Promise<void>
      setRamMb: (ramMb: number) => Promise<void>
      setFirstRunSeen: (seen: boolean) => Promise<void>
    }

    export const useSettingsStore = create<SettingsState>((set, get) => ({
      version: 1,
      ramMb: 2048,
      firstRunSeen: false,
      hydrated: false,

      initialize: async () => {
        if (get().hydrated) return
        try {
          const s = await window.wiiwho.settings.get()
          set({
            version: s.version,
            ramMb: s.ramMb,
            firstRunSeen: s.firstRunSeen,
            hydrated: true
          })
        } catch {
          // Leave hydrated: false; caller may retry.
        }
      },

      setRamMb: async (ramMb) => {
        const res = await window.wiiwho.settings.set({ ramMb })
        if (res.ok) {
          set({
            ramMb: res.settings.ramMb,
            firstRunSeen: res.settings.firstRunSeen,
            version: res.settings.version
          })
        }
      },

      setFirstRunSeen: async (seen) => {
        const res = await window.wiiwho.settings.set({ firstRunSeen: seen })
        if (res.ok) {
          set({
            ramMb: res.settings.ramMb,
            firstRunSeen: res.settings.firstRunSeen,
            version: res.settings.version
          })
        }
      }
    }))
    ```

    Write `launcher/src/renderer/src/stores/__tests__/settings.test.ts` with `@vitest-environment jsdom`. Mock `window.wiiwho.settings` per-test.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/renderer/src/stores/__tests__/settings.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export const useSettingsStore" launcher/src/renderer/src/stores/settings.ts`
    - `grep -q "window.wiiwho.settings.get" launcher/src/renderer/src/stores/settings.ts`
    - `grep -q "window.wiiwho.settings.set" launcher/src/renderer/src/stores/settings.ts`
    - `grep -q "ramMb: 2048" launcher/src/renderer/src/stores/settings.ts` (D-04 default)
    - `grep -q "hydrated" launcher/src/renderer/src/stores/settings.ts`
    - `cd launcher &amp;&amp; npx vitest run src/renderer/src/stores/__tests__/settings.test.ts` exits 0 with ≥7 tests passing
  </acceptance_criteria>
  <done>Zustand store hydrates via IPC, writes round-trip, tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RamSlider component — 7 positions + caption + info tooltip</name>
  <files>
    launcher/src/renderer/src/components/RamSlider.tsx,
    launcher/src/renderer/src/components/__tests__/RamSlider.test.tsx
  </files>
  <read_first>
    - launcher/src/renderer/src/components/ui/slider.tsx (shadcn Slider primitive)
    - launcher/src/renderer/src/components/ui/tooltip.tsx (shadcn Tooltip primitive)
    - launcher/src/renderer/src/components/ui/button.tsx (cyan accent idiom)
    - launcher/src/renderer/src/stores/settings.ts (Task 1 — source of ramMb)
    - launcher/src/renderer/src/components/__tests__ (Phase 2 test idiom: `@vitest-environment jsdom`, afterEach cleanup, Radix pointer-capture stubs)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-04 (range + steps + default), D-05 (caption + info icon)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: Renders a slider with `min={1024}`, `max={4096}`, `step={512}`, `value={useSettingsStore.ramMb}`. Default render shows `2048` displayed as `2 GB`.
    - Test 2: Moving the slider to position 6 (3584 MB) dispatches `setRamMb(3584)` on the store. Use `userEvent.setup()` + Slider's arrow-key nav (press Right 3 times from default → 2 GB + 3×512 = 3.5 GB).
    - Test 3: Display label formats halves: `1 GB`, `1.5 GB`, `2 GB`, `2.5 GB`, `3 GB`, `3.5 GB`, `4 GB` — test `formatRam(1536)` === `'1.5 GB'`.
    - Test 4 (D-05 — always-visible caption): The text `'Lower values use less memory. Higher values reduce GC pauses.'` (or similar one-liner from the task action) is rendered directly below the slider in a `<p>` element — no hover required.
    - Test 5 (D-05 — info icon + Tooltip): An Info/Help icon is present; hovering it (`await user.hover(iconEl)`) opens a Radix Tooltip whose content contains `'G1GC'` or `'garbage collection'`. Tooltip trigger uses pointer-capture — pointer-capture stubs required at top of test.
    - Test 6 (accessibility): Slider has an `aria-label` or associated `<label>` with text `'RAM allocation'`.
    - Test 7 (bounds): Clicking the track at a theoretical out-of-range x doesn't crash — Radix's min/max clamp applies.

    Start test file with:
    ```typescript
    // @vitest-environment jsdom
    import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest'
    import { cleanup, render, screen } from '@testing-library/react'
    import userEvent from '@testing-library/user-event'

    beforeAll(() => {
      Object.assign(Element.prototype as unknown as Record<string, unknown>, {
        hasPointerCapture: () => false,
        releasePointerCapture: () => {},
        scrollIntoView: () => {}
      })
    })
    afterEach(() => cleanup())
    ```
  </behavior>
  <action>
    Create `launcher/src/renderer/src/components/RamSlider.tsx`:

    ```tsx
    /**
     * RAM allocation slider.
     *
     * D-04: 1-4 GB in 512 MB steps, default 2 GB (7 positions).
     * D-05: Always-visible helper caption + info-icon Tooltip for G1GC detail.
     *
     * Source of value: useSettingsStore.ramMb (Zustand, hydrated from main).
     */

    import { Info } from 'lucide-react'
    import { Slider } from '@/components/ui/slider'
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
    import { useSettingsStore } from '../stores/settings'

    export function formatRam(mb: number): string {
      const gb = mb / 1024
      return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`
    }

    const MIN_MB = 1024
    const MAX_MB = 4096
    const STEP_MB = 512

    export function RamSlider(): React.JSX.Element {
      const ramMb = useSettingsStore((s) => s.ramMb)
      const setRamMb = useSettingsStore((s) => s.setRamMb)

      return (
        <TooltipProvider>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="ram-slider"
                className="text-sm font-normal text-neutral-200"
              >
                RAM allocation
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-neutral-400 tabular-nums">
                  {formatRam(ramMb)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About RAM allocation"
                      className="text-neutral-500 hover:text-neutral-300"
                    >
                      <Info className="size-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-normal">
                      Minecraft 1.8.9 runs fine on 2 GB. Higher values reduce GC
                      pauses but require more system memory. This launcher uses
                      G1GC (garbage collection) to keep pauses short — the RAM
                      knob mainly controls headroom for mod + chunk data.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Slider
              id="ram-slider"
              aria-label="RAM allocation"
              min={MIN_MB}
              max={MAX_MB}
              step={STEP_MB}
              value={[ramMb]}
              onValueChange={(values) => {
                const next = values[0] ?? ramMb
                void setRamMb(next)
              }}
            />

            <p className="text-xs font-normal text-neutral-500">
              Lower values use less memory. Higher values reduce GC pauses.
            </p>
          </div>
        </TooltipProvider>
      )
    }
    ```

    Write `RamSlider.test.tsx` with the 7 tests above. Use `@vitest-environment jsdom` + pointer-capture stubs.

    Note: Radix Tooltip requires `TooltipProvider` — either wrap each test render in `<TooltipProvider>` or wrap once inside the component as above (the component provides its own provider — cleaner).
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/RamSlider.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function RamSlider" launcher/src/renderer/src/components/RamSlider.tsx`
    - `grep -q "export function formatRam" launcher/src/renderer/src/components/RamSlider.tsx`
    - `grep -q "min={MIN_MB}\\|min={1024}" launcher/src/renderer/src/components/RamSlider.tsx` (D-04)
    - `grep -q "max={MAX_MB}\\|max={4096}" launcher/src/renderer/src/components/RamSlider.tsx` (D-04)
    - `grep -q "step={STEP_MB}\\|step={512}" launcher/src/renderer/src/components/RamSlider.tsx` (D-04)
    - `grep -q "Tooltip" launcher/src/renderer/src/components/RamSlider.tsx` (D-05 info icon)
    - `grep -q "Lower values use less memory" launcher/src/renderer/src/components/RamSlider.tsx` (D-05 always-visible caption)
    - `grep -q "G1GC\\|garbage collection" launcher/src/renderer/src/components/RamSlider.tsx` (D-05 tooltip content)
    - `cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/RamSlider.test.tsx` exits 0 with ≥7 tests passing
  </acceptance_criteria>
  <done>RamSlider renders 7 positions + always-visible caption + info-icon Tooltip containing G1GC copy, wired to useSettingsStore; 7 tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: SettingsDrawer component — Radix Sheet with three dismissal gestures</name>
  <files>
    launcher/src/renderer/src/components/SettingsDrawer.tsx,
    launcher/src/renderer/src/components/__tests__/SettingsDrawer.test.tsx
  </files>
  <read_first>
    - launcher/src/renderer/src/components/ui/sheet.tsx (shadcn Sheet — the Radix Dialog wrapper)
    - launcher/src/renderer/src/components/RamSlider.tsx (Task 2 — embedded in the drawer)
    - launcher/src/renderer/src/components/AccountBadge.tsx (existing Radix pattern for hover/dropdown)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-01 (slide-in right), D-02 (X + ESC + click-outside), D-07 (Logs/Crashes inside drawer)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: Renders a Sheet (closed by default when `open={false}`). Opens when `open={true}` passed.
    - Test 2 (D-02 — X button dismiss): Click the X/close button → `onOpenChange(false)` invoked.
    - Test 3 (D-02 — ESC dismiss): Press Escape key while sheet is open → `onOpenChange(false)` invoked.
    - Test 4 (D-02 — click-outside dismiss): Click the overlay backdrop → `onOpenChange(false)` invoked (Radix Sheet's default).
    - Test 5 (D-07 — content): Drawer body contains RamSlider (grep for aria-label "RAM allocation"), a "Logs" navigation entry/button, a "Crashes" navigation entry/button, and a version footer showing `v0.1.0-dev`.
    - Test 6 (accessibility): Sheet has a role="dialog" (Radix Sheet = Radix Dialog), aria-labelledby points at a visible heading "Settings".
    - Test 7: Passing `onOpenLogs` + `onOpenCrashes` callbacks wires the nav entries — clicking "Logs" calls `onOpenLogs`.

    Use `@vitest-environment jsdom` + pointer-capture stubs (Radix Dialog/Sheet uses pointer capture).
  </behavior>
  <action>
    Create `launcher/src/renderer/src/components/SettingsDrawer.tsx`:

    ```tsx
    /**
     * SettingsDrawer — Radix Sheet (right slide-in).
     *
     * D-01: slide from right, Play-forward screen visible underneath.
     * D-02: X button + ESC + click-outside all close the drawer (Radix defaults).
     * D-07: Logs + Crashes entries live HERE (no chrome on Home).
     *
     * App.tsx (Plan 03-10) wires the gear trigger + the Logs/Crashes route-outs.
     */

    import { Settings, FileText, ShieldAlert } from 'lucide-react'
    import {
      Sheet,
      SheetContent,
      SheetHeader,
      SheetTitle,
      SheetDescription
    } from '@/components/ui/sheet'
    import { Button } from '@/components/ui/button'
    import { RamSlider } from './RamSlider'

    interface Props {
      open: boolean
      onOpenChange: (open: boolean) => void
      onOpenLogs?: () => void
      onOpenCrashes?: () => void
      appVersion?: string
    }

    export function SettingsDrawer({
      open,
      onOpenChange,
      onOpenLogs,
      onOpenCrashes,
      appVersion = 'v0.1.0-dev'
    }: Props): React.JSX.Element {
      return (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="right"
            className="w-[380px] bg-neutral-900 border-l border-neutral-800"
          >
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-neutral-100 font-semibold">
                <Settings className="size-4" aria-hidden="true" />
                Settings
              </SheetTitle>
              <SheetDescription className="text-xs font-normal text-neutral-500">
                Tune the launcher. Close with X, ESC, or click outside.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 py-4">
              <section aria-labelledby="ram-section">
                <h3
                  id="ram-section"
                  className="text-xs font-normal uppercase tracking-wide text-neutral-500 mb-2"
                >
                  Memory
                </h3>
                <RamSlider />
              </section>

              <section aria-labelledby="diag-section">
                <h3
                  id="diag-section"
                  className="text-xs font-normal uppercase tracking-wide text-neutral-500 mb-2"
                >
                  Diagnostics
                </h3>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    className="justify-start font-normal text-neutral-300 hover:text-neutral-100"
                    onClick={() => onOpenLogs?.()}
                  >
                    <FileText className="size-4 mr-2" aria-hidden="true" />
                    Logs
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start font-normal text-neutral-300 hover:text-neutral-100"
                    onClick={() => onOpenCrashes?.()}
                  >
                    <ShieldAlert className="size-4 mr-2" aria-hidden="true" />
                    Crashes
                  </Button>
                </div>
              </section>
            </div>

            <footer className="absolute bottom-4 left-6 right-6 pt-4 border-t border-neutral-800 text-xs font-normal text-neutral-600">
              <div>Wiiwho Client</div>
              <div className="tabular-nums">{appVersion}</div>
            </footer>
          </SheetContent>
        </Sheet>
      )
    }
    ```

    Write `SettingsDrawer.test.tsx`. Use `@vitest-environment jsdom` + pointer-capture stubs. Use `userEvent.setup()` for Radix interactions.

    Test 7 for "Logs" click wiring needs `await user.click(screen.getByRole('button', { name: /logs/i }))` then assert `onOpenLogs` was called.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/SettingsDrawer.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function SettingsDrawer" launcher/src/renderer/src/components/SettingsDrawer.tsx`
    - `grep -q "RamSlider" launcher/src/renderer/src/components/SettingsDrawer.tsx`
    - `grep -q 'side="right"' launcher/src/renderer/src/components/SettingsDrawer.tsx` (D-01 slide direction)
    - `grep -q "onOpenLogs" launcher/src/renderer/src/components/SettingsDrawer.tsx` (D-07 logs entry)
    - `grep -q "onOpenCrashes" launcher/src/renderer/src/components/SettingsDrawer.tsx` (D-07 crashes entry)
    - `grep -q "v0.1.0-dev\\|appVersion" launcher/src/renderer/src/components/SettingsDrawer.tsx` (version footer)
    - `cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/SettingsDrawer.test.tsx` exits 0 with ≥7 tests passing
  </acceptance_criteria>
  <done>SettingsDrawer component renders all D-01/D-02/D-07 surface elements; dismissal gestures tested; nav-entry callbacks wired.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/renderer/src/stores/__tests__/settings.test.ts src/renderer/src/components/__tests__/RamSlider.test.tsx src/renderer/src/components/__tests__/SettingsDrawer.test.tsx` — all green
- `cd launcher && npm run typecheck` — no renderer type issues
- `cd launcher && npm run test:run` — full suite green
</verification>

<success_criteria>
- LAUN-03: RAM slider bounds 1024-4096 step 512 enforced by Slider props (test covers)
- LAUN-04: persistence proven via round-trip through useSettingsStore → IPC → store (Plan 03-02 main + this plan renderer)
- D-01, D-02, D-04, D-05, D-07 all honored in component output (tests cover)
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-07-SUMMARY.md` documenting:
- Exact lucide-react icon names used (for Plan 03-08 CrashViewer + 03-10 App.tsx visual consistency)
- Any shadcn Sheet idiosyncrasies (e.g., SheetContent width needed inline style override)
- Radix pointer-capture stub pattern confirmed working for Slider + Sheet + Tooltip all in one component
</output>
