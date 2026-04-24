---
phase: 04-launcher-ui-polish
plan: 01
type: execute
wave: 1
depends_on:
  - 04-00
files_modified:
  - launcher/src/renderer/src/global.css
  - launcher/src/renderer/src/theme/presets.ts
  - launcher/src/renderer/src/theme/motion.ts
  - launcher/src/renderer/src/hooks/useMotionConfig.ts
  - launcher/src/renderer/src/hooks/useMotionConfig.test.ts
  - launcher/src/renderer/src/stores/settings.ts
  - launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts
  - launcher/src/renderer/src/test/motion.test.ts
  - launcher/src/main/settings/store.ts
  - launcher/src/main/settings/__tests__/store-v2-migration.test.ts
  - launcher/src/renderer/src/wiiwho.d.ts
  - launcher/src/main/ipc/settings.ts
autonomous: true
requirements:
  - UI-01
  - UI-03
  - UI-07
must_haves:
  truths:
    - "launcher/src/renderer/src/global.css @theme block exports all required tokens (8 accent presets, 3 durations, 2 CSS easings, layout sizes, typography)"
    - "Runtime accent mutation via setAccent(hex) writes to :root and persists via IPC"
    - "settings.json v1 → v2 migration preserves ramMb/firstRunSeen and adds theme: {accent: '#16e0ee', reduceMotion: 'system'} defaults"
    - "useMotionConfig() returns 0 durations when user override = 'on' OR when user = 'system' AND OS prefers-reduced-motion"
    - "@font-face loaders for Inter + JetBrains Mono are declared with font-display: swap"
    - "presets.ts carries a leading comment noting D-13 → RESEARCH preset name/hex substitution (Red/Yellow/Gray illustrative → Crimson/Amber/Slate tuned for WCAG 2.1 SC 1.4.11 ≥3:1)"
  artifacts:
    - path: "launcher/src/renderer/src/global.css"
      provides: "Full token catalog in @theme + @font-face for Inter + JBMono"
      contains: "--duration-fast: 120ms"
    - path: "launcher/src/renderer/src/theme/presets.ts"
      provides: "ACCENT_PRESETS typed tuple"
      exports: ["ACCENT_PRESETS", "AccentPreset"]
    - path: "launcher/src/renderer/src/theme/motion.ts"
      provides: "Motion duration + easing constants mirroring CSS vars"
      exports: ["DURATION_FAST", "DURATION_MED", "DURATION_SLOW", "EASE_EMPHASIZED", "EASE_STANDARD", "SPRING_STANDARD"]
    - path: "launcher/src/renderer/src/hooks/useMotionConfig.ts"
      provides: "Reduced-motion resolver combining OS + user override"
      exports: ["useMotionConfig"]
    - path: "launcher/src/renderer/src/stores/settings.ts"
      provides: "Settings store extended with theme.accent + theme.reduceMotion + setAccent + setReduceMotion"
    - path: "launcher/src/main/settings/store.ts"
      provides: "Schema v1→v2 migration preserving fields, adding theme defaults"
  key_links:
    - from: "launcher/src/renderer/src/stores/settings.ts"
      to: "window.wiiwho.settings.set"
      via: "setAccent persists theme.accent"
      pattern: "window\\.wiiwho\\.settings\\.set.*theme"
    - from: "launcher/src/main/settings/store.ts"
      to: "userData/settings.json v2 schema"
      via: "migrateV1ToV2 function"
      pattern: "version:\\s*2"
---

<objective>
Build the Phase 4 token foundation: expand `global.css` `@theme` with the full token catalog (8 accent presets, 3 motion durations, 2 CSS easings, layout sizes, typography vars); wire @font-face for the Wave 0 fonts with `font-display: swap`; add a runtime `setAccent(hex)` path on the renderer settings store; bump the main-process settings schema from v1 to v2 with the `theme: {accent, reduceMotion}` slice per D-18; export the `useMotionConfig()` reduced-motion resolver; and create the renderer-side `theme/presets.ts` + `theme/motion.ts` single-source mirrors per RESEARCH §Tailwind v4 Theme Architecture.

This plan does NOT touch layout components (Sidebar, SettingsModal). Those consume these tokens in Waves 2-4.

Purpose: Every downstream Phase 4 component consumes tokens from `global.css` @theme and hooks from `useMotionConfig`. This plan is their single source of truth.

Output: `global.css` with full token catalog; `settings.json` schema v2 with additive migration; `useMotionConfig()` hook returning real + reduced timings; renderer settings store exposing `setAccent(hex)` and `setReduceMotion(mode)`.
</objective>

<execution_context>
@C:\Users\Eliyahu\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\Eliyahu\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/04-launcher-ui-polish/04-CONTEXT.md
@.planning/phases/04-launcher-ui-polish/04-RESEARCH.md
@launcher/src/renderer/src/global.css
@launcher/src/renderer/src/stores/settings.ts
@launcher/src/main/settings/store.ts
@launcher/src/main/ipc/settings.ts
@launcher/src/renderer/src/wiiwho.d.ts
@.planning/phases/04-launcher-ui-polish/04-00-infrastructure-SUMMARY.md
</context>

<interfaces>
<!-- Extracted from Phase 3 settings stack (what Phase 4 extends) -->

From launcher/src/main/settings/store.ts (Phase 3 Plan 03-02):
```typescript
export interface SettingsV1 {
  version: 1
  ramMb: number       // clamped 1024-4096 step 512
  firstRunSeen: boolean
}
export function readSettings(): SettingsV1
export function writeSettings(patch: Partial<Omit<SettingsV1,'version'>>): SettingsV1
```

From launcher/src/renderer/src/stores/settings.ts (Phase 3 Plan 03-07):
```typescript
export interface SettingsSnapshot { version: 1; ramMb: number; firstRunSeen: boolean }
export interface SettingsStoreState extends SettingsSnapshot { hydrated: boolean; initialize, setRamMb, setFirstRunSeen }
```

From launcher/src/renderer/src/wiiwho.d.ts (Phase 3 state):
```typescript
settings: {
  get: () => Promise<{ version: 1; ramMb: number; firstRunSeen: boolean }>
  set: (patch: Partial<{ ramMb: number; firstRunSeen: boolean }>) => Promise<{ ok: boolean; settings: { version: 1; ramMb: number; firstRunSeen: boolean } }>
}
```

This plan bumps `version: 1` → `version: 2` and adds `theme: { accent: string; reduceMotion: 'system'|'on'|'off' }` to all three surfaces.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Expand global.css @theme + @font-face; create theme/presets.ts + theme/motion.ts</name>
  <files>launcher/src/renderer/src/global.css, launcher/src/renderer/src/theme/presets.ts, launcher/src/renderer/src/theme/motion.ts, launcher/src/renderer/src/test/motion.test.ts</files>
  <read_first>
    - launcher/src/renderer/src/global.css (current shape — only 2 accent/bg vars)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Tailwind v4 Theme Architecture → §Single-source token catalog (verbatim CSS block to write)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Tailwind v4 Theme Architecture → §@theme pitfall (literal values ONLY in @theme)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Accent Color Palette → §Final 8 presets (verbatim table of hex values)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-13 (illustrative preset name list — Red/Yellow/Gray replaced by RESEARCH's Crimson/Amber/Slate for WCAG contrast)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Typography → §Bundling strategy (verbatim @font-face block)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack → §Duration / easing CSS variables
  </read_first>
  <behavior>
    - global.css @theme block contains all these literal values (copy verbatim):
      --color-wiiwho-bg: #111111
      --color-wiiwho-surface: #1a1a1a
      --color-wiiwho-border: #262626
      --color-accent: #16e0ee
      --color-preset-cyan: #16e0ee
      --color-preset-mint: #22c55e
      --color-preset-violet: #a855f7
      --color-preset-tangerine: #f97316
      --color-preset-pink: #ec4899
      --color-preset-crimson: #f87171
      --color-preset-amber: #fbbf24
      --color-preset-slate: #cbd5e1
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
      --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace
      --duration-fast: 120ms
      --duration-med: 200ms
      --duration-slow: 320ms
      --ease-emphasized: cubic-bezier(0.2, 0, 0, 1)
      --ease-standard: cubic-bezier(0.4, 0, 0.2, 1)
      --layout-sidebar-width: 220px
      --layout-window-width: 1280px
      --layout-window-height: 800px
      --layout-modal-height: 560px
    - :root redeclares --color-accent: #16e0ee (mutable surface for runtime setProperty)
    - @font-face for Inter points at ./assets/fonts/inter/InterVariable.woff2 with font-display: swap
    - @font-face for JetBrains Mono points at ./assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2 with font-display: swap
    - The old `--color-wiiwho-accent: #16e0ee` token is REMOVED (replaced by `--color-accent`) — legacy consumers fixed in Plan 04-07 integration
    - body font-family resolves to `var(--font-sans)` (replacing the literal -apple-system list currently on body)
    - theme/presets.ts exports ACCENT_PRESETS as a readonly tuple of 8 objects with id/name/hex matching RESEARCH §Final 8 presets exactly (Cyan first as default). File carries a leading JSDoc block documenting the D-13 → RESEARCH substitution (Red/Yellow/Gray illustrative starting points retuned to Crimson/Amber/Slate for WCAG contrast on `#111111`).
    - theme/motion.ts exports the 6 constants in RESEARCH §Duration / easing CSS variables, JS-side duplication block
    - test/motion.test.ts (Wave 0 stub) gets real assertions: @theme contains all required tokens (static parse of global.css), ACCENT_PRESETS has length 8, first entry is cyan, each entry has /^#[0-9a-f]{6}$/i hex, DURATION_FAST === 0.12 exactly
  </behavior>
  <action>
    1. Rewrite `launcher/src/renderer/src/global.css` to exactly match RESEARCH §Single-source token catalog. The final file:

    ```css
    @import 'tailwindcss';

    @theme {
      /* --- COLORS --- */
      --color-wiiwho-bg:      #111111;
      --color-wiiwho-surface: #1a1a1a;
      --color-wiiwho-border:  #262626;

      /* Default accent — mutable at runtime via :root override */
      --color-accent: #16e0ee;

      /* 8 preset swatches (static — ThemePicker references by slot) */
      --color-preset-cyan:      #16e0ee;
      --color-preset-mint:      #22c55e;
      --color-preset-violet:    #a855f7;
      --color-preset-tangerine: #f97316;
      --color-preset-pink:      #ec4899;
      --color-preset-crimson:   #f87171;
      --color-preset-amber:     #fbbf24;
      --color-preset-slate:     #cbd5e1;

      /* --- TYPOGRAPHY --- */
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace;

      /* --- MOTION (D-21 durations, D-22 CSS-expressible easings) --- */
      --duration-fast: 120ms;
      --duration-med:  200ms;
      --duration-slow: 320ms;
      --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
      --ease-standard:   cubic-bezier(0.4, 0, 0.2, 1);
      /* --ease-spring lives in theme/motion.ts (CSS can't express springs) */

      /* --- SIZING --- */
      --layout-sidebar-width: 220px;
      --layout-window-width:  1280px;
      --layout-window-height: 800px;
      --layout-modal-height:  560px;
    }

    :root {
      /* Runtime-mutable surface (kept in sync with @theme default).
         setAccent(hex) writes here via document.documentElement.style.setProperty. */
      --color-accent: #16e0ee;
    }

    @font-face {
      font-family: 'Inter';
      src: url('./assets/fonts/inter/InterVariable.woff2') format('woff2-variations');
      font-weight: 100 900;
      font-display: swap;
    }
    @font-face {
      font-family: 'JetBrains Mono';
      src: url('./assets/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2') format('woff2-variations');
      font-weight: 100 800;
      font-display: swap;
    }

    html,
    body,
    #root {
      height: 100%;
      margin: 0;
      background-color: var(--color-wiiwho-bg);
      color: #e5e5e5;
      font-family: var(--font-sans);
    }
    ```

    2. Create `launcher/src/renderer/src/theme/presets.ts`:

    ```ts
    /**
     * 8 accent color presets per CONTEXT D-13 + RESEARCH tuning.
     *
     * D-13 listed illustrative values for Red/Yellow/Gray; RESEARCH retuned to
     * Crimson/Amber/Slate for WCAG 2.1 SC 1.4.11 Non-text Contrast ≥3:1 against
     * --color-wiiwho-bg (#111111). All 8 hexes verified against #111111 background
     * by RESEARCH. D-13's "Exact preset hexes are research/planner discretion"
     * grant authorizes this substitution; this file is the single source of truth.
     *
     * Downstream consumers:
     *   - docs/DESIGN-SYSTEM.md §Colors table mirrors this list (Plan 04-07).
     *   - global.css @theme block declares a --color-preset-<id> CSS var per entry.
     *   - ThemePicker (Plan 04-04) renders one swatch per entry.
     */
    export interface AccentPreset {
      readonly id: 'cyan' | 'mint' | 'violet' | 'tangerine' | 'pink' | 'crimson' | 'amber' | 'slate'
      readonly name: string
      readonly hex: `#${string}`
    }

    export const ACCENT_PRESETS: readonly AccentPreset[] = [
      { id: 'cyan',      name: 'Cyan',      hex: '#16e0ee' },  // default — D-13 lock
      { id: 'mint',      name: 'Mint',      hex: '#22c55e' },
      { id: 'violet',    name: 'Violet',    hex: '#a855f7' },
      { id: 'tangerine', name: 'Tangerine', hex: '#f97316' },
      { id: 'pink',      name: 'Pink',      hex: '#ec4899' },
      { id: 'crimson',   name: 'Crimson',   hex: '#f87171' },  // RESEARCH-tuned (D-13 listed "Red" as illustrative)
      { id: 'amber',     name: 'Amber',     hex: '#fbbf24' },  // RESEARCH-tuned (D-13 listed "Yellow" as illustrative)
      { id: 'slate',     name: 'Slate',     hex: '#cbd5e1' },  // RESEARCH-tuned (D-13 listed "Gray" as illustrative)
    ] as const

    /** Default accent if user hasn't picked one (D-13 cyan lock preserves Phase 1 D-09). */
    export const DEFAULT_ACCENT_HEX = '#16e0ee' as const
    ```

    3. Create `launcher/src/renderer/src/theme/motion.ts`:

    ```ts
    /**
     * Motion duration + easing constants.
     *
     * Source of truth: global.css @theme block. This file duplicates numbers
     * because framer-motion (motion/react) takes seconds, not CSS `var()` strings.
     * Keep in sync — comments document the mirrored CSS var.
     */
    export const DURATION_FAST = 0.12 as const  // mirrors --duration-fast: 120ms
    export const DURATION_MED  = 0.20 as const  // mirrors --duration-med:  200ms
    export const DURATION_SLOW = 0.32 as const  // mirrors --duration-slow: 320ms

    export const EASE_EMPHASIZED = [0.2, 0, 0,   1] as const  // mirrors --ease-emphasized
    export const EASE_STANDARD   = [0.4, 0, 0.2, 1] as const  // mirrors --ease-standard

    export const SPRING_STANDARD = {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 1,
    } as const
    ```

    4. Replace the contents of `launcher/src/renderer/src/test/motion.test.ts` (from the Wave 0 `it.todo` stub) with real assertions:

    ```ts
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach } from 'vitest'
    import { cleanup } from '@testing-library/react'
    import { readFileSync } from 'node:fs'
    import { resolve } from 'node:path'
    import { ACCENT_PRESETS, DEFAULT_ACCENT_HEX } from '../theme/presets'
    import { DURATION_FAST, DURATION_MED, DURATION_SLOW, EASE_EMPHASIZED, EASE_STANDARD, SPRING_STANDARD } from '../theme/motion'

    describe('global.css @theme token catalog', () => {
      afterEach(cleanup)
      const css = readFileSync(resolve(__dirname, '../global.css'), 'utf8')

      it('contains --duration-fast: 120ms', () => { expect(css).toMatch(/--duration-fast:\s*120ms/) })
      it('contains --duration-med: 200ms',  () => { expect(css).toMatch(/--duration-med:\s*200ms/)  })
      it('contains --duration-slow: 320ms', () => { expect(css).toMatch(/--duration-slow:\s*320ms/) })
      it('contains --ease-emphasized cubic-bezier(0.2, 0, 0, 1)', () => { expect(css).toMatch(/--ease-emphasized:\s*cubic-bezier\(0\.2,\s*0,\s*0,\s*1\)/) })
      it('contains --ease-standard cubic-bezier(0.4, 0, 0.2, 1)',  () => { expect(css).toMatch(/--ease-standard:\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/) })
      it('declares --color-accent: #16e0ee in @theme',    () => { expect(css).toMatch(/@theme[\s\S]*--color-accent:\s*#16e0ee/) })
      it('redeclares --color-accent on :root for runtime override', () => { expect(css).toMatch(/:root[\s\S]*--color-accent:\s*#16e0ee/) })
      it('declares all 8 preset swatches', () => {
        for (const { id, hex } of ACCENT_PRESETS) {
          expect(css).toMatch(new RegExp(`--color-preset-${id}:\\s*${hex}`))
        }
      })
      it('declares @font-face for Inter with font-display: swap', () => {
        expect(css).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Inter'[^}]*font-display:\s*swap/)
      })
      it('declares @font-face for JetBrains Mono with font-display: swap', () => {
        expect(css).toMatch(/@font-face\s*\{[^}]*font-family:\s*'JetBrains Mono'[^}]*font-display:\s*swap/)
      })
      it('@theme does NOT use var() inside (Pitfall 11)', () => {
        const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\}/)?.[1] ?? ''
        expect(themeBlock).not.toMatch(/var\(/)
      })
    })

    describe('theme/presets.ts', () => {
      afterEach(cleanup)
      it('has 8 presets',            () => expect(ACCENT_PRESETS.length).toBe(8))
      it('first is cyan (default)',  () => expect(ACCENT_PRESETS[0].id).toBe('cyan'))
      it('all hex values valid 6-digit',() => {
        for (const p of ACCENT_PRESETS) expect(p.hex).toMatch(/^#[0-9a-f]{6}$/i)
      })
      it('DEFAULT_ACCENT_HEX === "#16e0ee"', () => expect(DEFAULT_ACCENT_HEX).toBe('#16e0ee'))
      it('documents D-13 → RESEARCH substitution in a leading JSDoc comment', () => {
        const src = readFileSync(resolve(__dirname, '../theme/presets.ts'), 'utf8')
        expect(src).toMatch(/D-13 listed illustrative values/i)
        expect(src).toMatch(/RESEARCH retuned to\s+Crimson\/Amber\/Slate/i)
        expect(src).toMatch(/WCAG 2\.1 SC 1\.4\.11/)
      })
    })

    describe('theme/motion.ts', () => {
      afterEach(cleanup)
      it('DURATION_FAST === 0.12', () => expect(DURATION_FAST).toBe(0.12))
      it('DURATION_MED === 0.20',  () => expect(DURATION_MED).toBe(0.2))
      it('DURATION_SLOW === 0.32', () => expect(DURATION_SLOW).toBe(0.32))
      it('EASE_EMPHASIZED === [0.2, 0, 0, 1]',  () => expect([...EASE_EMPHASIZED]).toEqual([0.2, 0, 0, 1]))
      it('EASE_STANDARD === [0.4, 0, 0.2, 1]',  () => expect([...EASE_STANDARD]).toEqual([0.4, 0, 0.2, 1]))
      it('SPRING_STANDARD is a spring with stiffness 300, damping 30, mass 1', () => {
        expect(SPRING_STANDARD.type).toBe('spring')
        expect(SPRING_STANDARD.stiffness).toBe(300)
        expect(SPRING_STANDARD.damping).toBe(30)
        expect(SPRING_STANDARD.mass).toBe(1)
      })
    })
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/test/motion.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep "@theme {" launcher/src/renderer/src/global.css` returns exactly 1 hit.
    - `grep "var(" launcher/src/renderer/src/global.css` inside the @theme block returns 0 hits (Pitfall 11 negative check: extract @theme content and grep — the tests cover this).
    - `grep "\\-\\-color-preset-cyan: #16e0ee" launcher/src/renderer/src/global.css` returns 1 hit.
    - `grep "\\-\\-duration-fast: 120ms" launcher/src/renderer/src/global.css` returns 1 hit.
    - `grep "font-display: swap" launcher/src/renderer/src/global.css` returns 2 hits (Inter + JBMono).
    - `grep "\\-\\-color-wiiwho-accent" launcher/src/renderer/src/` returns 0 hits (old token fully removed — Plan 04-07 has legacy cleanup).
    - `launcher/src/renderer/src/theme/presets.ts` exports `ACCENT_PRESETS` with 8 entries, first id === 'cyan', hex === '#16e0ee'.
    - `grep "D-13 listed illustrative values" launcher/src/renderer/src/theme/presets.ts` returns 1 hit (D-13 → RESEARCH substitution documented).
    - `grep "WCAG 2.1 SC 1.4.11" launcher/src/renderer/src/theme/presets.ts` returns 1 hit (contrast rationale documented).
    - `launcher/src/renderer/src/theme/motion.ts` exports `DURATION_FAST === 0.12`, `DURATION_MED === 0.20`, `DURATION_SLOW === 0.32`.
    - `pnpm vitest run src/renderer/src/test/motion.test.ts` exits 0 with all assertions green (including the new presets.ts JSDoc grep test).
  </acceptance_criteria>
  <done>global.css rewritten with full token catalog; theme/presets.ts (with D-13/RESEARCH substitution comment) + theme/motion.ts created; motion.test.ts green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Settings v1→v2 migration (main process) + IPC surface update</name>
  <files>launcher/src/main/settings/store.ts, launcher/src/main/settings/__tests__/store-v2-migration.test.ts, launcher/src/main/ipc/settings.ts, launcher/src/renderer/src/wiiwho.d.ts</files>
  <read_first>
    - launcher/src/main/settings/store.ts (Phase 3 Plan 03-02 shape — atomic write + clamp pattern)
    - launcher/src/main/ipc/settings.ts (Phase 3 IPC handler bodies)
    - launcher/src/renderer/src/wiiwho.d.ts (current settings.get/set return types)
    - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-18 (exact v2 schema)
    - launcher/src/main/settings/settings.test.ts (existing test patterns to mirror)
  </read_first>
  <behavior>
    - `SettingsV2` interface declares: `version: 2`, `ramMb: number`, `firstRunSeen: boolean`, `theme: { accent: string; reduceMotion: 'system' | 'on' | 'off' }`
    - `migrateV1ToV2(v1)` returns `{ version: 2, ramMb, firstRunSeen, theme: { accent: '#16e0ee', reduceMotion: 'system' } }` — additive only, preserves ramMb + firstRunSeen
    - `readSettings()` detects version and migrates transparently: returns SettingsV2 always
    - On first read of a v1 file, migration runs + file is rewritten atomically to v2
    - Missing `theme` field on a v2 file → re-applies defaults (per-field fallback, preserves valid siblings)
    - Invalid `theme.accent` (not `/^#[0-9a-fA-F]{6}$/`) → falls back to '#16e0ee' (per-field, preserves valid siblings)
    - Invalid `theme.reduceMotion` (not 'system'|'on'|'off') → falls back to 'system'
    - `writeSettings({ theme: { accent: '#ff0000' } })` clamps accent to /^#[0-9a-fA-F]{6}$/ or rejects with ok:false
    - wiiwho.d.ts `settings.get()` / `settings.set()` return types bump to v2 shape
  </behavior>
  <action>
    1. Read `launcher/src/main/settings/store.ts` carefully. Identify the existing `SettingsV1` interface and the `readSettings` / `writeSettings` functions.

    2. Write `launcher/src/main/settings/__tests__/store-v2-migration.test.ts` (replacing Wave 0 stub) with:

    ```ts
    import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
    import { promises as fs } from 'node:fs'
    import path from 'node:path'
    import os from 'node:os'

    // Mock electron's app.getPath to a tmpdir so tests don't touch real userData.
    vi.mock('electron', () => ({
      app: {
        getPath: (key: string) => (key === 'userData' ? path.join(os.tmpdir(), 'wiiwho-v2-test-' + Math.random()) : ''),
      },
    }))

    describe('Settings v1 → v2 migration', () => {
      let tmpDir: string
      beforeEach(async () => {
        tmpDir = path.join(os.tmpdir(), 'wiiwho-v2-test-' + Math.random())
        await fs.mkdir(tmpDir, { recursive: true })
      })
      afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
      })

      it('migrates v1 {version:1, ramMb, firstRunSeen} → v2 adding theme defaults', async () => {
        // Write synthetic v1 file at the mocked userData path; import store.ts fresh.
        const { readSettings } = await import('../store')
        // ... write a v1 file, call readSettings(), assert version===2, ramMb/firstRunSeen preserved, theme defaults added.
        // Implementation detail: test uses the actual tmpDir via vi.mock electron app.getPath.
      })

      it('defaults theme.accent === "#16e0ee" and theme.reduceMotion === "system" on fresh install', async () => {
        const { readSettings } = await import('../store')
        const s = readSettings()
        expect(s.version).toBe(2)
        expect(s.theme.accent).toBe('#16e0ee')
        expect(s.theme.reduceMotion).toBe('system')
      })

      it('rejects invalid theme.accent hex (not /^#[0-9a-fA-F]{6}$/) and falls back to #16e0ee', async () => {
        const { writeSettings } = await import('../store')
        const result = writeSettings({ theme: { accent: 'not-a-hex' } })
        // writeSettings returns the snapshot after write; accent should fall back OR return ok:false — assert whichever
        expect(result.theme.accent).toBe('#16e0ee')
      })

      it('accepts valid theme.accent hex and round-trips', async () => {
        const { writeSettings, readSettings } = await import('../store')
        writeSettings({ theme: { accent: '#ec4899' } })
        expect(readSettings().theme.accent).toBe('#ec4899')
      })

      it('preserves ramMb from v1 file during migration', async () => {
        // Write a v1 file with ramMb: 3072, call readSettings, assert ramMb stays 3072.
        // Full test body writes { version:1, ramMb:3072, firstRunSeen:true } to the mocked path.
      })

      it('preserves firstRunSeen from v1 during migration', async () => { /* similar */ })

      it('clamps ramMb writes via v2 the same as v1 (1024-4096 step 512)', async () => {
        const { writeSettings } = await import('../store')
        expect(writeSettings({ ramMb: 500 }).ramMb).toBe(1024)
        expect(writeSettings({ ramMb: 9999 }).ramMb).toBe(4096)
      })

      it('accepts all three reduceMotion values', async () => {
        const { writeSettings } = await import('../store')
        expect(writeSettings({ theme: { reduceMotion: 'on' } }).theme.reduceMotion).toBe('on')
        expect(writeSettings({ theme: { reduceMotion: 'off' } }).theme.reduceMotion).toBe('off')
        expect(writeSettings({ theme: { reduceMotion: 'system' } }).theme.reduceMotion).toBe('system')
      })

      it('rejects unknown reduceMotion and falls back to "system"', async () => {
        const { writeSettings } = await import('../store')
        expect(writeSettings({ theme: { reduceMotion: 'bogus' as never } }).theme.reduceMotion).toBe('system')
      })
    })
    ```

    3. Extend `launcher/src/main/settings/store.ts`:
       - Keep legacy SettingsV1 interface internal for migration typing.
       - Add `SettingsV2` interface with `{ version: 2, ramMb: number, firstRunSeen: boolean, theme: { accent: string; reduceMotion: 'system' | 'on' | 'off' } }`.
       - Add `const DEFAULTS_V2: SettingsV2 = { version: 2, ramMb: 2048, firstRunSeen: false, theme: { accent: '#16e0ee', reduceMotion: 'system' } }`.
       - Add `function migrateV1ToV2(v1: SettingsV1): SettingsV2` — preserves ramMb + firstRunSeen, adds theme defaults.
       - Rewrite `readSettings()` to: parse JSON → check version === 1 ? migrate + atomic-rewrite : check v2 field-by-field with per-field fallback.
       - Add hex validator `function validAccent(x: unknown): string { return (typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x)) ? x : '#16e0ee' }`.
       - Add reduceMotion validator `function validReduceMotion(x: unknown): 'system'|'on'|'off' { return (x === 'on' || x === 'off' || x === 'system') ? x : 'system' }`.
       - Extend `writeSettings(patch: Partial<...>)` to accept `theme: Partial<{accent, reduceMotion}>` and validate per-field.
       - Update the exported return types.

    4. Update `launcher/src/main/ipc/settings.ts` — handler bodies do not need changes (they already pass the patch through), but update the type annotations from SettingsV1 → SettingsV2 so the IPC surface reflects v2 shape.

    5. Update `launcher/src/renderer/src/wiiwho.d.ts` settings block:

    ```typescript
    settings: {
      get: () => Promise<{
        version: 2
        ramMb: number
        firstRunSeen: boolean
        theme: { accent: string; reduceMotion: 'system' | 'on' | 'off' }
      }>
      set: (
        patch: Partial<{
          ramMb: number
          firstRunSeen: boolean
          theme: Partial<{ accent: string; reduceMotion: 'system' | 'on' | 'off' }>
        }>
      ) => Promise<{
        ok: boolean
        settings: {
          version: 2
          ramMb: number
          firstRunSeen: boolean
          theme: { accent: string; reduceMotion: 'system' | 'on' | 'off' }
        }
      }>
    }
    ```

    6. Run full main-process suite + typecheck. Fix any downstream consumers that depended on SettingsV1 (the renderer store is updated in Task 3; nothing else consumes the v1 shape directly).
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/main/settings/__tests__/store-v2-migration.test.ts && pnpm vitest run src/main/settings/settings.test.ts && pnpm typecheck:node</automated>
  </verify>
  <acceptance_criteria>
    - `grep "version: 2" launcher/src/main/settings/store.ts` returns ≥2 hits (interface + DEFAULTS_V2).
    - `grep "migrateV1ToV2" launcher/src/main/settings/store.ts` returns ≥1 hit.
    - `grep "version: 2" launcher/src/renderer/src/wiiwho.d.ts` returns ≥2 hits (get + set return types).
    - All migration tests pass (9 test cases from the describe block above).
    - `pnpm typecheck:node` exits 0.
    - Existing `settings.test.ts` tests still pass (v1 → v2 read path is transparent; ramMb clamping preserved).
    - Fresh userData dir: `readSettings()` produces a v2 file with `theme.accent === '#16e0ee'` and `theme.reduceMotion === 'system'`.
  </acceptance_criteria>
  <done>settings store at v2; migration test green; wiiwho.d.ts v2 types; typecheck green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Renderer settings store — theme slice + setAccent + useMotionConfig hook</name>
  <files>launcher/src/renderer/src/stores/settings.ts, launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts, launcher/src/renderer/src/hooks/useMotionConfig.ts, launcher/src/renderer/src/hooks/useMotionConfig.test.ts</files>
  <read_first>
    - launcher/src/renderer/src/stores/settings.ts (Phase 3 Zustand shape — defensive parse, hydration pattern)
    - launcher/src/renderer/src/hooks/useSkinHead.ts (existing hook for pattern reference)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack → §Pattern E (reduced motion, exact hook shape)
    - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Tailwind v4 Theme Architecture → §Runtime --color-accent swap (setAccent shape)
    - launcher/src/renderer/src/theme/presets.ts (DEFAULT_ACCENT_HEX — Task 1)
    - launcher/src/renderer/src/theme/motion.ts (DURATION_* constants — Task 1)
  </read_first>
  <behavior>
    - useSettingsStore exposes new state: `theme: { accent: string; reduceMotion: 'system'|'on'|'off' }` with defaults cyan + system
    - Store action `setAccent(hex: string): Promise<void>` validates hex via /^#[0-9a-fA-F]{6}$/, mutates `document.documentElement.style.setProperty('--color-accent', hex)`, calls `window.wiiwho.settings.set({ theme: { accent: hex } })`, updates local state from response
    - On invalid hex, setAccent is a no-op (returns immediately, does NOT mutate :root, does NOT call IPC)
    - Store action `setReduceMotion(mode: 'system'|'on'|'off'): Promise<void>` persists via IPC and updates local state
    - Action `openSettingsModal(defaultPane?: SettingsPane): void` — sets modalOpen=true + optional openPane (no IPC call)
    - Action `setModalOpen(open: boolean): void` — explicit open/close control
    - Action `setOpenPane(pane: SettingsPane): void` — single action that sets openPane AND modalOpen=true atomically (Pitfall 8 fix — no two-step race)
    - On App mount, initialize() re-applies the persisted accent via setProperty (Pitfall 1 HMR fix)
    - useMotionConfig() hook: reads systemReduce via `useReducedMotion()` from motion/react, reads userOverride from store.theme.reduceMotion; returns { reduced, durationFast, durationMed, durationSlow, spring } where reduced durations collapse to 0
  </behavior>
  <action>
    1. Replace test stub `launcher/src/renderer/src/stores/__tests__/settings.theme.test.ts` with real tests:

    ```ts
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
    import { cleanup } from '@testing-library/react'
    import { useSettingsStore } from '../settings'

    // Mock the IPC bridge
    const settingsGetMock = vi.fn()
    const settingsSetMock = vi.fn()
    beforeEach(() => {
      settingsGetMock.mockReset()
      settingsSetMock.mockReset()
      ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
        settings: { get: settingsGetMock, set: settingsSetMock },
        auth: {}, game: {}, logs: {}, __debug: {}
      }
      // Reset store
      useSettingsStore.setState({
        version: 2, ramMb: 2048, firstRunSeen: false,
        theme: { accent: '#16e0ee', reduceMotion: 'system' },
        hydrated: false, modalOpen: false, openPane: 'general'
      } as never)
    })
    afterEach(cleanup)

    describe('settings store theme slice', () => {
      it('default theme.accent === "#16e0ee"', () => {
        expect(useSettingsStore.getState().theme.accent).toBe('#16e0ee')
      })

      it('setAccent with valid hex mutates :root --color-accent and calls IPC', async () => {
        settingsSetMock.mockResolvedValue({ ok: true, settings: { version: 2, ramMb: 2048, firstRunSeen: false, theme: { accent: '#ec4899', reduceMotion: 'system' } } })
        await useSettingsStore.getState().setAccent('#ec4899')
        expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#ec4899')
        expect(settingsSetMock).toHaveBeenCalledWith({ theme: { accent: '#ec4899' } })
        expect(useSettingsStore.getState().theme.accent).toBe('#ec4899')
      })

      it('setAccent with invalid hex is a no-op (no IPC call, no :root mutation)', async () => {
        document.documentElement.style.setProperty('--color-accent', '#16e0ee')
        await useSettingsStore.getState().setAccent('not-a-hex')
        expect(settingsSetMock).not.toHaveBeenCalled()
        expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#16e0ee')
      })

      it('setReduceMotion persists and updates state', async () => {
        settingsSetMock.mockResolvedValue({ ok: true, settings: { version: 2, ramMb: 2048, firstRunSeen: false, theme: { accent: '#16e0ee', reduceMotion: 'on' } } })
        await useSettingsStore.getState().setReduceMotion('on')
        expect(settingsSetMock).toHaveBeenCalledWith({ theme: { reduceMotion: 'on' } })
        expect(useSettingsStore.getState().theme.reduceMotion).toBe('on')
      })

      it('setOpenPane opens modal + sets pane in a single action (Pitfall 8)', () => {
        useSettingsStore.getState().setOpenPane('account')
        expect(useSettingsStore.getState().modalOpen).toBe(true)
        expect(useSettingsStore.getState().openPane).toBe('account')
      })

      it('initialize re-applies persisted accent to :root (Pitfall 1 HMR fix)', async () => {
        settingsGetMock.mockResolvedValue({ version: 2, ramMb: 2048, firstRunSeen: false, theme: { accent: '#a855f7', reduceMotion: 'system' } })
        await useSettingsStore.getState().initialize()
        expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#a855f7')
      })

      it('initialize is idempotent (hydrated guard)', async () => {
        settingsGetMock.mockResolvedValue({ version: 2, ramMb: 2048, firstRunSeen: false, theme: { accent: '#16e0ee', reduceMotion: 'system' } })
        await useSettingsStore.getState().initialize()
        await useSettingsStore.getState().initialize()
        expect(settingsGetMock).toHaveBeenCalledTimes(1)
      })
    })
    ```

    2. Rewrite `launcher/src/renderer/src/stores/settings.ts` to v2 shape. Keep `hydrated`, `ramMb`, `firstRunSeen`, `setRamMb`, `setFirstRunSeen`, `initialize` intact. Add:
       - SettingsPane type: `'general' | 'account' | 'appearance' | 'spotify' | 'about'`
       - state fields: `theme: { accent: string; reduceMotion: 'system'|'on'|'off' }`, `modalOpen: boolean`, `openPane: SettingsPane`
       - action `setAccent(hex)` — validates, mutates :root, calls IPC
       - action `setReduceMotion(mode)` — calls IPC, updates state
       - action `setModalOpen(open)` — pure state
       - action `setOpenPane(pane)` — sets openPane AND modalOpen=true (atomic per Pitfall 8)
       - modify `initialize()` to read theme.accent and call `document.documentElement.style.setProperty('--color-accent', snap.theme.accent)` after hydration

    3. Create `launcher/src/renderer/src/hooks/useMotionConfig.ts`:

    ```ts
    /**
     * Reduced-motion resolver. Combines OS prefers-reduced-motion (via motion/react
     * useReducedMotion hook) with user override in settings.theme.reduceMotion.
     *
     * Resolution:
     *   user='on'     → reduced = true
     *   user='off'    → reduced = false
     *   user='system' → reduced = OS prefers-reduced-motion value
     *
     * Source: RESEARCH §Motion Stack → Pattern E.
     */
    import { useReducedMotion } from 'motion/react'
    import { useSettingsStore } from '../stores/settings'
    import { DURATION_FAST, DURATION_MED, DURATION_SLOW, SPRING_STANDARD } from '../theme/motion'

    export interface MotionConfig {
      reduced: boolean
      durationFast: number
      durationMed:  number
      durationSlow: number
      spring: typeof SPRING_STANDARD | { duration: number }
    }

    export function useMotionConfig(): MotionConfig {
      const systemReduce = useReducedMotion() ?? false
      const userOverride = useSettingsStore((s) => s.theme.reduceMotion)
      const reduced =
        userOverride === 'on'  ? true  :
        userOverride === 'off' ? false :
                                 systemReduce
      return {
        reduced,
        durationFast: reduced ? 0 : DURATION_FAST,
        durationMed:  reduced ? 0 : DURATION_MED,
        durationSlow: reduced ? 0 : DURATION_SLOW,
        spring: reduced ? { duration: 0 } : SPRING_STANDARD,
      }
    }
    ```

    4. Create `launcher/src/renderer/src/hooks/useMotionConfig.test.ts`:

    ```ts
    /**
     * @vitest-environment jsdom
     */
    import { describe, it, expect, afterEach, vi } from 'vitest'
    import { cleanup, renderHook, act } from '@testing-library/react'
    import { useMotionConfig } from './useMotionConfig'
    import { useSettingsStore } from '../stores/settings'

    // Mock motion/react's useReducedMotion — controls OS side.
    let mockSystemReduce = false
    vi.mock('motion/react', () => ({
      useReducedMotion: () => mockSystemReduce,
    }))

    describe('useMotionConfig', () => {
      afterEach(() => {
        cleanup()
        mockSystemReduce = false
        useSettingsStore.setState({ theme: { accent: '#16e0ee', reduceMotion: 'system' } } as never)
      })

      it('user=system + OS reduce=off → reduced=false, durations normal', () => {
        mockSystemReduce = false
        act(() => useSettingsStore.setState({ theme: { accent: '#16e0ee', reduceMotion: 'system' } } as never))
        const { result } = renderHook(() => useMotionConfig())
        expect(result.current.reduced).toBe(false)
        expect(result.current.durationFast).toBe(0.12)
        expect(result.current.durationMed).toBe(0.2)
        expect(result.current.durationSlow).toBe(0.32)
      })

      it('user=system + OS reduce=on → reduced=true, durations=0', () => {
        mockSystemReduce = true
        act(() => useSettingsStore.setState({ theme: { accent: '#16e0ee', reduceMotion: 'system' } } as never))
        const { result } = renderHook(() => useMotionConfig())
        expect(result.current.reduced).toBe(true)
        expect(result.current.durationFast).toBe(0)
        expect(result.current.durationMed).toBe(0)
        expect(result.current.durationSlow).toBe(0)
      })

      it('user=on + OS reduce=off → reduced=true (user override wins)', () => {
        mockSystemReduce = false
        act(() => useSettingsStore.setState({ theme: { accent: '#16e0ee', reduceMotion: 'on' } } as never))
        const { result } = renderHook(() => useMotionConfig())
        expect(result.current.reduced).toBe(true)
        expect(result.current.durationMed).toBe(0)
      })

      it('user=off + OS reduce=on → reduced=false (user override wins)', () => {
        mockSystemReduce = true
        act(() => useSettingsStore.setState({ theme: { accent: '#16e0ee', reduceMotion: 'off' } } as never))
        const { result } = renderHook(() => useMotionConfig())
        expect(result.current.reduced).toBe(false)
        expect(result.current.durationMed).toBe(0.2)
      })

      it('reduced=true returns { duration: 0 } for spring (not the spring config)', () => {
        mockSystemReduce = true
        act(() => useSettingsStore.setState({ theme: { accent: '#16e0ee', reduceMotion: 'system' } } as never))
        const { result } = renderHook(() => useMotionConfig())
        expect(result.current.spring).toEqual({ duration: 0 })
      })

      it('reduced=false returns SPRING_STANDARD { stiffness: 300, damping: 30, mass: 1 }', () => {
        mockSystemReduce = false
        act(() => useSettingsStore.setState({ theme: { accent: '#16e0ee', reduceMotion: 'off' } } as never))
        const { result } = renderHook(() => useMotionConfig())
        expect(result.current.spring).toMatchObject({ type: 'spring', stiffness: 300, damping: 30, mass: 1 })
      })
    })
    ```
  </action>
  <verify>
    <automated>cd launcher && pnpm vitest run src/renderer/src/stores/__tests__/settings.theme.test.ts src/renderer/src/hooks/useMotionConfig.test.ts && pnpm typecheck:web</automated>
  </verify>
  <acceptance_criteria>
    - `grep "setAccent" launcher/src/renderer/src/stores/settings.ts` returns ≥1 hit.
    - `grep "setReduceMotion" launcher/src/renderer/src/stores/settings.ts` returns ≥1 hit.
    - `grep "setOpenPane" launcher/src/renderer/src/stores/settings.ts` returns ≥1 hit.
    - `grep "modalOpen" launcher/src/renderer/src/stores/settings.ts` returns ≥1 hit.
    - `launcher/src/renderer/src/hooks/useMotionConfig.ts` exists; exports `useMotionConfig` and `MotionConfig` type.
    - All 6 useMotionConfig tests pass.
    - All 7 settings.theme tests pass.
    - `pnpm typecheck:web` exits 0.
    - `grep "document.documentElement.style.setProperty" launcher/src/renderer/src/stores/settings.ts` returns ≥2 hits (setAccent + initialize rehydrate).
  </acceptance_criteria>
  <done>Renderer store extended with theme slice + actions; useMotionConfig hook produces correct reduced/normal durations; typecheck green.</done>
</task>

</tasks>

<verification>
- `cd launcher && pnpm vitest run src/renderer/src/test/motion.test.ts src/main/settings/__tests__/store-v2-migration.test.ts src/renderer/src/stores/__tests__/settings.theme.test.ts src/renderer/src/hooks/useMotionConfig.test.ts` exits 0.
- `pnpm --filter ./launcher run typecheck` exits 0.
- `pnpm --filter ./launcher run test:run` (full suite) exits 0.
- Running the app fresh produces a `userData/settings.json` with `version: 2` and `theme: { accent: "#16e0ee", reduceMotion: "system" }`.
</verification>

<success_criteria>
UI-01 foundation: accent persistence + runtime :root mutation verified. UI-03 foundation: duration/easing tokens in global.css + useMotionConfig resolver with correct OS/user-override precedence. UI-07 foundation: token catalog single-source-of-truth established (global.css @theme authoritative, theme/presets.ts + theme/motion.ts mirror for JS consumers). D-13 → RESEARCH preset substitution documented in presets.ts header (forwarded to Plan 04-07's DESIGN-SYSTEM.md §Colors footnote).
</success_criteria>

<output>
After completion, create `.planning/phases/04-launcher-ui-polish/04-01-tokens-and-settings-SUMMARY.md` documenting:
- Tokens added to @theme (list + values)
- Settings schema v1→v2 migration behavior
- useMotionConfig resolution table (user × OS → reduced)
- presets.ts D-13 → RESEARCH substitution note (for forward-reference by DESIGN-SYSTEM.md)
- Any deviations from RESEARCH values
</output>
