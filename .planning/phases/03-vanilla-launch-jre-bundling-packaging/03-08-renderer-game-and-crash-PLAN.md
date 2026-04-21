---
phase: 03-vanilla-launch-jre-bundling-packaging
plan: 08
type: execute
wave: 2
depends_on: ["03-00"]
files_modified:
  - launcher/src/renderer/src/stores/game.ts
  - launcher/src/renderer/src/stores/__tests__/game.test.ts
  - launcher/src/renderer/src/components/PlayButton.tsx
  - launcher/src/renderer/src/components/__tests__/PlayButton.test.tsx
  - launcher/src/renderer/src/components/CrashViewer.tsx
  - launcher/src/renderer/src/components/__tests__/CrashViewer.test.tsx
autonomous: true
requirements:
  - LCH-05
  - LCH-07
  - LAUN-05
  - COMP-05
must_haves:
  truths:
    - "useGameStore holds a discriminated-union phase state: idle | downloading | verifying | starting | playing | failed | crashed"
    - "PlayButton morphs in place — Play → Downloading… % → Verifying… → Starting Minecraft… → Playing (D-09)"
    - "PlayButton Cancel link visible ONLY during downloading + verifying (D-13)"
    - "CrashViewer renders the full-page takeover with 4 buttons: Copy report + Open crash folder + Close + Play again (D-19)"
    - "CrashViewer displays the sanitizedBody prop VERBATIM (sanitization happens at IPC boundary — D-21); clipboard write uses the IDENTICAL string (Test asserts both paths source the same prop)"
    - "Fail-path: when state=failed, PlayButton shows error + last 30 log lines inline (D-11)"
  artifacts:
    - path: "launcher/src/renderer/src/stores/game.ts"
      provides: "useGameStore with phase machine + subscriptions wired via window.wiiwho.game.{onStatus,onProgress,onLog,onExited,onCrashed}"
      exports: ["useGameStore"]
    - path: "launcher/src/renderer/src/components/PlayButton.tsx"
      provides: "Morphing cyan Play button (D-09) + Cancel link during downloading/verifying (D-13) + inline error on failed"
    - path: "launcher/src/renderer/src/components/CrashViewer.tsx"
      provides: "Full-page takeover (D-18) — header + <pre> body + 4 action buttons (D-19) + clipboard-same-as-display assertion (D-21)"
  key_links:
    - from: "launcher/src/renderer/src/stores/game.ts"
      to: "window.wiiwho.game.{play,cancel,status,onStatus,onProgress,onLog,onExited,onCrashed}"
      via: "Zustand actions + main→renderer subscriptions"
      pattern: "window.wiiwho.game"
    - from: "launcher/src/renderer/src/components/CrashViewer.tsx"
      to: "navigator.clipboard.writeText(sanitizedBody)"
      via: "COPY-REPORT button — source is the SAME prop as the display (D-21)"
      pattern: "clipboard.writeText"
---

<objective>
Renderer-side state + UI for the game lifecycle and crash viewer:

1. **useGameStore** — Zustand, discriminated-union phase machine. Subscribes to `window.wiiwho.game.onStatus/onProgress/onLog/onExited/onCrashed` (Plan 03-09 adds the last three to the preload bridge). Actions: `play()`, `cancel()`.

2. **PlayButton** — The centerpiece of D-09: morphing cyan Play → `Downloading… 42%` → `Verifying…` → `Starting Minecraft…` → `Playing` (disabled). Cancel link visible ONLY during downloading + verifying (D-13). On `failed`, renders error summary + last ~30 log lines (D-11).

3. **CrashViewer** — Full-page takeover (D-18). Subscribes to `useGameStore.crashedReport`. Renders header ("Crash detected"), scrollable `<pre>` body with `sanitizedBody`, four buttons (Copy report + Open crash folder + Close + Play again — D-19). The Copy button writes `sanitizedBody` to clipboard — SAME string shown on screen (D-21). A unit test asserts this string identity.

Output: 3 components + 3 tests. Goal-backward: the crash viewer's D-21 invariant is the single most important thing in this plan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md
@.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md
@launcher/src/renderer/src/wiiwho.d.ts
@launcher/src/renderer/src/stores/auth.ts
@launcher/src/renderer/src/components/ErrorBanner.tsx
@launcher/src/renderer/src/components/AccountBadge.tsx
@launcher/src/renderer/src/components/ui/button.tsx

<interfaces>
Frozen IPC surface (wiiwho.d.ts — Plan 03-09 extends with onLog/onExited/onCrashed but this plan CODES AGAINST those planned types):
```typescript
game: {
  play: () => Promise<{ ok: boolean; stub?: boolean; reason?: string }>
  cancel: () => Promise<{ ok: boolean }>
  status: () => Promise<{ state: 'idle' | 'launching' | 'downloading' | 'playing' | 'crashed' }>
  onStatus: (cb: (s: { state: string }) => void) => () => void
  onProgress: (cb: (p: { bytesDone: number; bytesTotal: number; currentFile: string }) => void) => () => void
  // Plan 03-09 ADDS:
  onLog: (cb: (entry: { line: string; stream: 'out' | 'err' }) => void) => () => void
  onExited: (cb: (ev: { exitCode: number | null }) => void) => () => void
  onCrashed: (cb: (ev: { sanitizedBody: string; crashId: string | null }) => void) => () => void
}
logs: {
  readCrash: (opts?: { crashId?: string }) => Promise<{ sanitizedBody: string }>
  // Plan 03-09 extends but NOT in this plan's consumption surface
}
```

**Plan 03-08 uses these typed surfaces AS IF they already exist.** Plan 03-09 actually adds them. The types flow through wiiwho.d.ts — Plan 03-09 updates that file; this plan imports the types from it and can compile against them as long as Plan 03-09 has already run OR both are parallel in Wave 2 and Plan 03-09 merges first. In practice this plan can be written against a local type extension (see action text) that's then harmonized when 03-09 ships.

Discriminated-union phase states (D-09 + D-11 + D-13):
```typescript
type GamePhase =
  | { state: 'idle' }
  | { state: 'downloading'; percent: number }
  | { state: 'verifying' }
  | { state: 'starting' }
  | { state: 'playing' }
  | { state: 'failed'; message: string; logTail: Array<{line: string; stream: 'out'|'err'}> }
  | { state: 'crashed'; sanitizedBody: string; crashId: string | null }
```

Phase 2 idioms carried forward:
- `@vitest-environment jsdom` docblock per component test
- afterEach cleanup
- `userEvent.setup()` for interactions + pointer-capture stubs
- Cyan `#16e0ee` buttons (ErrorBanner.tsx reference)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: useGameStore — phase machine + IPC subscriptions</name>
  <files>
    launcher/src/renderer/src/stores/game.ts,
    launcher/src/renderer/src/stores/__tests__/game.test.ts
  </files>
  <read_first>
    - launcher/src/renderer/src/stores/auth.ts (Zustand idiom)
    - launcher/src/renderer/src/wiiwho.d.ts (IPC contract — note the onLog/onExited/onCrashed entries Plan 03-09 will add)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-09 (morph sequence), D-11 (fail-path tail), D-13 (cancel window)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: Initial state `{ phase: {state: 'idle'}, progress: null, logTail: [] }`.
    - Test 2: `subscribe()` wires `onStatus`, `onProgress`, `onLog`, `onExited`, `onCrashed`. Returns an unsubscribe function.
    - Test 3: `onStatus({state:'downloading'})` + `onProgress({bytesDone:50,bytesTotal:100,currentFile:'client.jar'})` → store updates `phase.state='downloading'`, `phase.percent === 50`.
    - Test 4: `onLog({line: '...', stream: 'out'})` pushes into `logTail`, capped at 30 entries.
    - Test 5: `onExited({exitCode: 0})` transitions to `idle` (clean quit — silent per D-17).
    - Test 6: `onExited({exitCode: 1})` followed by `onCrashed({sanitizedBody, crashId})` transitions to `{state:'crashed', sanitizedBody, crashId}`.
    - Test 7: `onExited({exitCode: 1})` WITHOUT a following `onCrashed` within 6 seconds transitions to `{state:'failed', message: '…', logTail: [...last 30...]}` (D-11 fail-path; D-17 inverse — no crash file means stdout-tail fallback).
    - Test 8: `play()` action calls `window.wiiwho.game.play()` and transitions to `{state:'downloading', percent:0}` optimistically.
    - Test 9: `cancel()` action calls `window.wiiwho.game.cancel()`; store transitions back to `{state:'idle'}` only after ack.

    Mock window.wiiwho.game via `Object.defineProperty`.
  </behavior>
  <action>
    Create `launcher/src/renderer/src/stores/game.ts`:

    ```typescript
    /**
     * Renderer-side game lifecycle store.
     *
     * Mirrors main-process launch phase (Plan 03-10 orchestrator). Updates
     * via frozen IPC subscriptions — no polling.
     *
     * Phase machine (D-09 + D-13 + D-11):
     *   idle → downloading(%) → verifying → starting → playing
     *   any → failed (non-zero exit, no crash file within 5s)
     *   any → crashed (non-zero exit + crash file present)
     *   playing|failed|crashed → idle (via Play again / Close)
     */

    import { create } from 'zustand'

    export type GamePhase =
      | { state: 'idle' }
      | { state: 'downloading'; percent: number; currentFile: string }
      | { state: 'verifying' }
      | { state: 'starting' }
      | { state: 'playing' }
      | { state: 'failed'; message: string; logTail: LogEntry[] }
      | { state: 'crashed'; sanitizedBody: string; crashId: string | null }

    export interface LogEntry { line: string; stream: 'out' | 'err' }

    const LOG_TAIL_CAPACITY = 30

    export interface GameStoreState {
      phase: GamePhase
      logTail: LogEntry[]
      subscribed: boolean

      subscribe: () => () => void
      unsubscribe: () => void
      play: () => Promise<void>
      cancel: () => Promise<void>
      resetToIdle: () => void
    }

    let unsubs: Array<() => void> = []
    let exitFallbackTimer: NodeJS.Timeout | null = null

    export const useGameStore = create<GameStoreState>((set, get) => ({
      phase: { state: 'idle' },
      logTail: [],
      subscribed: false,

      subscribe: () => {
        if (get().subscribed) return () => {}
        const g = window.wiiwho.game
        const uStatus = g.onStatus((s) => {
          const state = (s as { state: string }).state
          if (state === 'downloading') set({ phase: { state: 'downloading', percent: 0, currentFile: '' } })
          else if (state === 'verifying') set({ phase: { state: 'verifying' } })
          else if (state === 'starting' || state === 'launching') set({ phase: { state: 'starting' } })
          else if (state === 'playing') set({ phase: { state: 'playing' } })
          else if (state === 'idle') set({ phase: { state: 'idle' } })
        })
        const uProg = g.onProgress((p) => {
          const current = get().phase
          if (current.state !== 'downloading') return
          const percent = p.bytesTotal > 0 ? Math.round((p.bytesDone / p.bytesTotal) * 100) : 0
          set({ phase: { ...current, percent, currentFile: p.currentFile } })
        })
        const uLog = g.onLog((entry) => {
          const next = [...get().logTail, entry]
          if (next.length > LOG_TAIL_CAPACITY) next.splice(0, next.length - LOG_TAIL_CAPACITY)
          set({ logTail: next })
        })
        const uExit = g.onExited((ev) => {
          if (ev.exitCode === 0 || ev.exitCode === 130 || ev.exitCode === 143) {
            set({ phase: { state: 'idle' } })
            return
          }
          // Non-zero — wait up to 6s for an onCrashed push; else fall back to logTail tail
          if (exitFallbackTimer) clearTimeout(exitFallbackTimer)
          exitFallbackTimer = setTimeout(() => {
            const current = get().phase
            if (current.state === 'crashed') return
            set({
              phase: {
                state: 'failed',
                message: `JVM exited with code ${ev.exitCode}. No crash report was written.`,
                logTail: get().logTail.slice(-LOG_TAIL_CAPACITY)
              }
            })
          }, 6000)
        })
        const uCrash = g.onCrashed((ev) => {
          if (exitFallbackTimer) {
            clearTimeout(exitFallbackTimer)
            exitFallbackTimer = null
          }
          set({ phase: { state: 'crashed', sanitizedBody: ev.sanitizedBody, crashId: ev.crashId } })
        })
        unsubs = [uStatus, uProg, uLog, uExit, uCrash]
        set({ subscribed: true })
        return get().unsubscribe
      },

      unsubscribe: () => {
        for (const u of unsubs) u()
        unsubs = []
        if (exitFallbackTimer) {
          clearTimeout(exitFallbackTimer)
          exitFallbackTimer = null
        }
        set({ subscribed: false })
      },

      play: async () => {
        set({ phase: { state: 'downloading', percent: 0, currentFile: '' }, logTail: [] })
        await window.wiiwho.game.play()
      },

      cancel: async () => {
        const current = get().phase.state
        if (current !== 'downloading' && current !== 'verifying') return   // D-13 cancel-window
        await window.wiiwho.game.cancel()
        set({ phase: { state: 'idle' } })
      },

      resetToIdle: () => set({ phase: { state: 'idle' }, logTail: [] })
    }))
    ```

    Write `game.test.ts` — mock `window.wiiwho.game` with vi.fn()s for each listener. For the 6s fallback test, use `vi.useFakeTimers()` and `vi.advanceTimersByTime(6000)`.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/renderer/src/stores/__tests__/game.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export const useGameStore" launcher/src/renderer/src/stores/game.ts`
    - `grep -q "export type GamePhase" launcher/src/renderer/src/stores/game.ts`
    - `grep -q "'idle'\\|'downloading'\\|'verifying'\\|'starting'\\|'playing'\\|'failed'\\|'crashed'" launcher/src/renderer/src/stores/game.ts` (all 7 phases present)
    - `grep -q "onCrashed" launcher/src/renderer/src/stores/game.ts`
    - `grep -q "onExited" launcher/src/renderer/src/stores/game.ts`
    - `grep -q "onLog" launcher/src/renderer/src/stores/game.ts`
    - `grep -q "LOG_TAIL_CAPACITY.*30\\|30" launcher/src/renderer/src/stores/game.ts` (D-11 30-line tail)
    - `cd launcher &amp;&amp; npx vitest run src/renderer/src/stores/__tests__/game.test.ts` exits 0 with ≥9 tests passing
  </acceptance_criteria>
  <done>Phase machine + IPC subscriptions + fail-fallback timer all in store, tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: PlayButton component — morphing cyan button + Cancel + fail UI</name>
  <files>
    launcher/src/renderer/src/components/PlayButton.tsx,
    launcher/src/renderer/src/components/__tests__/PlayButton.test.tsx
  </files>
  <read_first>
    - launcher/src/renderer/src/stores/game.ts (Task 1 — phase source)
    - launcher/src/renderer/src/components/ui/button.tsx (cyan accent idiom)
    - launcher/src/renderer/src/components/ErrorBanner.tsx (fail-path styling reference)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-09 (morph sequence), D-11 (log tail on failure), D-13 (cancel window), D-14 (Retry)
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1 (idle): Button text reads `Play`. Clicking calls `useGameStore.play()`.
    - Test 2 (downloading): Phase `{state:'downloading', percent:42}` → button text reads `Downloading… 42%`. Button DISABLED (no click handler effective — `aria-disabled` or `disabled`). Cancel link present below.
    - Test 3 (verifying): Text reads `Verifying…`. Cancel link still present (D-13).
    - Test 4 (starting): Text reads `Starting Minecraft…`. Cancel link NOT present (D-13 — cancel disappears at starting).
    - Test 5 (playing): Text reads `Playing`. Button disabled, no cancel.
    - Test 6 (cancel click): During downloading, clicking Cancel calls `useGameStore.cancel()`.
    - Test 7 (failed): Phase `{state:'failed', message, logTail}` renders:
      - An error banner with `message`
      - A scrollable `<pre>` containing each `logTail` entry
      - A Retry button that calls `play()` again (D-14)
    - Test 8 (crashed): Phase `{state:'crashed', ...}` — the button renders `null` or is hidden (CrashViewer takes over the full screen per D-18; PlayButton yields to it).

    Cyan button style reused from App.tsx: `bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950`.
  </behavior>
  <action>
    Create `launcher/src/renderer/src/components/PlayButton.tsx`:

    ```tsx
    /**
     * Morphing cyan Play button (D-09).
     *
     * States (reading useGameStore.phase):
     *   idle           → "Play" (enabled; click → play())
     *   downloading    → "Downloading… %"  (disabled; Cancel link below)
     *   verifying      → "Verifying…"      (disabled; Cancel link below)
     *   starting       → "Starting Minecraft…"  (disabled; NO cancel — D-13)
     *   playing        → "Playing"         (disabled; NO cancel)
     *   failed         → error banner + log tail + Retry button
     *   crashed        → null (CrashViewer takes over — D-18)
     */

    import { Button } from '@/components/ui/button'
    import { AlertCircle } from 'lucide-react'
    import { useGameStore } from '../stores/game'

    export function PlayButton(): React.JSX.Element | null {
      const phase = useGameStore((s) => s.phase)
      const play = useGameStore((s) => s.play)
      const cancel = useGameStore((s) => s.cancel)

      // D-18: crashed state is CrashViewer's territory
      if (phase.state === 'crashed') return null

      if (phase.state === 'failed') {
        return (
          <div className="flex flex-col gap-3 w-[640px] max-w-full">
            <div role="alert" className="bg-neutral-900 border border-red-900/50 rounded-md p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-500 size-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 text-sm font-normal text-neutral-300">{phase.message}</div>
              </div>
            </div>
            <pre
              aria-label="Last 30 log lines"
              className="text-xs font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-md p-3 max-h-60 overflow-auto whitespace-pre-wrap"
            >
              {phase.logTail.map((e) => e.line).join('\n')}
            </pre>
            <div className="flex justify-center">
              <Button
                onClick={() => void play()}
                className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-lg px-10 py-5 font-normal"
              >
                Retry
              </Button>
            </div>
          </div>
        )
      }

      let label: string
      let disabled = true
      let showCancel = false
      switch (phase.state) {
        case 'idle':
          label = 'Play'
          disabled = false
          break
        case 'downloading':
          label = `Downloading… ${phase.percent}%`
          showCancel = true
          break
        case 'verifying':
          label = 'Verifying…'
          showCancel = true
          break
        case 'starting':
          label = 'Starting Minecraft…'
          break
        case 'playing':
          label = 'Playing'
          break
      }

      return (
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={disabled ? undefined : () => void play()}
            disabled={disabled}
            aria-disabled={disabled}
            className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-xl px-12 py-6 font-normal disabled:opacity-80 disabled:cursor-default"
          >
            {label}
          </Button>
          {showCancel ? (
            <button
              type="button"
              onClick={() => void cancel()}
              className="text-sm font-normal text-neutral-400 hover:text-neutral-200 underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          ) : null}
        </div>
      )
    }
    ```

    Write `PlayButton.test.tsx` with the 8 tests. Use `@vitest-environment jsdom` + afterEach cleanup. For each phase test, stub `useGameStore.getState()` / `useGameStore.setState()` to force the phase before rendering — or better, use `useGameStore.setState({phase: {...}})` directly, then render.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/PlayButton.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function PlayButton" launcher/src/renderer/src/components/PlayButton.tsx`
    - `grep -q "'Downloading…'" launcher/src/renderer/src/components/PlayButton.tsx || grep -q 'Downloading\\\\u2026\\|Downloading\\.\\.\\.' launcher/src/renderer/src/components/PlayButton.tsx`
    - `grep -q "'Verifying…'" launcher/src/renderer/src/components/PlayButton.tsx || grep -q 'Verifying' launcher/src/renderer/src/components/PlayButton.tsx`
    - `grep -q "Starting Minecraft" launcher/src/renderer/src/components/PlayButton.tsx`
    - `grep -q "Playing" launcher/src/renderer/src/components/PlayButton.tsx`
    - `grep -q "Cancel" launcher/src/renderer/src/components/PlayButton.tsx` (D-13 control present)
    - `grep -q "Retry" launcher/src/renderer/src/components/PlayButton.tsx` (D-14 retry)
    - `grep -q "#16e0ee" launcher/src/renderer/src/components/PlayButton.tsx` (cyan brand)
    - `cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/PlayButton.test.tsx` exits 0 with ≥8 tests passing
  </acceptance_criteria>
  <done>PlayButton morphs through all 5 happy states + renders fail UI + retry + cancel window enforced; 8 tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: CrashViewer component — full-page takeover + D-21 clipboard invariant</name>
  <files>
    launcher/src/renderer/src/components/CrashViewer.tsx,
    launcher/src/renderer/src/components/__tests__/CrashViewer.test.tsx
  </files>
  <read_first>
    - launcher/src/renderer/src/stores/game.ts (Task 1 — phase.sanitizedBody comes from here)
    - launcher/src/renderer/src/components/ErrorBanner.tsx (red-ish header palette reference)
    - launcher/src/renderer/src/wiiwho.d.ts (logs.readCrash signature — but Plan 03-09 adds `logs.openCrashFolder`; this plan uses a prop for "Open crash folder" since that shell op lives in main)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-CONTEXT.md D-18 (full-page takeover), D-19 (4 buttons), D-21 (display AND clipboard same string)
    - .planning/phases/03-vanilla-launch-jre-bundling-packaging/03-RESEARCH.md §Redaction Patterns — D-21 renderer-side test pattern
  </read_first>
  <behavior>
    Tests MUST cover:
    - Test 1: Renders a heading "Crash detected" or similar.
    - Test 2: `<pre>` body contains exactly the `sanitizedBody` prop text, verbatim.
    - Test 3 (D-19): All four buttons present: "Copy report", "Open crash folder", "Close", "Play again".
    - Test 4 (D-21 — THE critical test): Given `sanitizedBody="foo --accessToken [REDACTED] bar"`, rendering CrashViewer + clicking "Copy report" → `navigator.clipboard.writeText` called with `"foo --accessToken [REDACTED] bar"` (the IDENTICAL string present in the displayed `<pre>`). Assert the clipboard call text === the displayed `<pre>` textContent. This is the D-21 unit-test contract.
    - Test 5 (D-21 — regression guard): The CrashViewer does NOT import any regex or sanitizer from `redact` — a sanitation-duplication bug guard. Grep the component source: `grep -q "scrub\\|sanitize" launcher/src/renderer/src/components/CrashViewer.tsx` returns empty (no local sanitization — the main process already did it).
    - Test 6: Clicking "Close" calls `onClose` prop.
    - Test 7: Clicking "Play again" calls `onPlayAgain` prop.
    - Test 8: Clicking "Open crash folder" calls `onOpenCrashFolder` prop (Plan 03-10 wires this to `window.wiiwho.logs.openCrashFolder?.(crashId)` — the prop-level API keeps this test trivial).

    Stubs `navigator.clipboard`:
    ```typescript
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })
    ```
  </behavior>
  <action>
    Create `launcher/src/renderer/src/components/CrashViewer.tsx`:

    ```tsx
    /**
     * Full-page crash report takeover (D-18 + D-19 + D-21).
     *
     * Gets mounted by App.tsx when useGameStore.phase.state === 'crashed'.
     *
     * D-21 invariant: `sanitizedBody` comes from the main process already
     * redacted (Plan 03-10's logs:read-crash handler runs sanitizeCrashReport
     * before sending it here). This component does NO sanitization — it's
     * pure display + identity-forward to the clipboard.
     *
     * If a future edit ever imports scrub()/sanitize from redact.ts in this
     * file, the D-21 regression test (grep of this file) fails.
     */

    import { AlertTriangle, Copy, FolderOpen, X, Play } from 'lucide-react'
    import { Button } from '@/components/ui/button'

    interface Props {
      sanitizedBody: string
      crashId: string | null
      onClose: () => void
      onPlayAgain: () => void
      onOpenCrashFolder: (crashId: string | null) => void
    }

    export function CrashViewer({
      sanitizedBody,
      crashId,
      onClose,
      onPlayAgain,
      onOpenCrashFolder
    }: Props): React.JSX.Element {
      const handleCopy = async (): Promise<void> => {
        try {
          await navigator.clipboard.writeText(sanitizedBody)
        } catch {
          // Clipboard API rejected — silently no-op for v0.1.
          // (Plan 03-10 could surface a toast; deferred.)
        }
      }

      return (
        <div className="fixed inset-0 z-50 bg-neutral-950 text-neutral-100 flex flex-col">
          <header className="bg-red-900/20 border-b border-red-900/40 px-8 py-5 flex items-center gap-3">
            <AlertTriangle className="text-red-500 size-6" aria-hidden="true" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Crash detected</h1>
              <p className="text-xs font-normal text-neutral-400">
                Minecraft stopped unexpectedly. Your game data is safe.
                {crashId ? <> Report: <span className="font-mono">{crashId}</span></> : null}
              </p>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-8 py-4">
            <pre
              role="region"
              aria-label="Crash report"
              className="text-xs font-mono text-neutral-300 whitespace-pre-wrap break-words"
            >
              {sanitizedBody}
            </pre>
          </main>

          <footer className="border-t border-neutral-800 bg-neutral-900 px-8 py-4 flex gap-3">
            <Button
              onClick={() => void handleCopy()}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-normal"
            >
              <Copy className="size-4 mr-2" aria-hidden="true" />
              Copy report
            </Button>
            <Button
              onClick={() => onOpenCrashFolder(crashId)}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-normal"
            >
              <FolderOpen className="size-4 mr-2" aria-hidden="true" />
              Open crash folder
            </Button>
            <div className="flex-1" />
            <Button
              onClick={onClose}
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-normal"
            >
              <X className="size-4 mr-2" aria-hidden="true" />
              Close
            </Button>
            <Button
              onClick={onPlayAgain}
              className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 font-normal"
            >
              <Play className="size-4 mr-2" aria-hidden="true" />
              Play again
            </Button>
          </footer>
        </div>
      )
    }
    ```

    Write `CrashViewer.test.tsx` with the 8 tests. The D-21 test asserts `writeText.mock.calls[0][0] === screen.getByRole('region', {name:/crash report/i}).textContent`.

    Regression guard Test 5: open the file with `readFileSync`, assert it does NOT contain `scrub` or `sanitizeCrashReport` or any regex literal — the sanitization MUST happen at the IPC boundary, never in this component.
  </action>
  <verify>
    <automated>cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/CrashViewer.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function CrashViewer" launcher/src/renderer/src/components/CrashViewer.tsx`
    - `grep -q "navigator.clipboard.writeText" launcher/src/renderer/src/components/CrashViewer.tsx` (D-21 clipboard path)
    - `grep -q "sanitizedBody" launcher/src/renderer/src/components/CrashViewer.tsx` (prop name matches)
    - `grep -q "Copy report" launcher/src/renderer/src/components/CrashViewer.tsx` (D-19 button 1)
    - `grep -q "Open crash folder" launcher/src/renderer/src/components/CrashViewer.tsx` (D-19 button 2)
    - `grep -q "Close" launcher/src/renderer/src/components/CrashViewer.tsx` (D-19 button 3)
    - `grep -q "Play again" launcher/src/renderer/src/components/CrashViewer.tsx` (D-19 button 4)
    - **`! grep -q 'scrub\\|sanitize\\|/eyJ' launcher/src/renderer/src/components/CrashViewer.tsx`** (D-21 regression: NO in-renderer sanitization)
    - `cd launcher &amp;&amp; npx vitest run src/renderer/src/components/__tests__/CrashViewer.test.tsx` exits 0 with ≥8 tests passing
  </acceptance_criteria>
  <done>CrashViewer D-21 invariant tested: display ≡ clipboard contents; regression guard grep forbids renderer-side sanitization; 8 tests green.</done>
</task>

</tasks>

<verification>
- `cd launcher && npx vitest run src/renderer/src/stores/__tests__/game.test.ts src/renderer/src/components/__tests__/PlayButton.test.tsx src/renderer/src/components/__tests__/CrashViewer.test.tsx` — all green
- `cd launcher && npm run typecheck` — renderer types reconcile
- `cd launcher && npm run test:run` — full suite green
- D-21 enforced by TWO tests: identity assertion + source-grep guard
</verification>

<success_criteria>
- LCH-05, LCH-07: useGameStore reflects JVM lifecycle + log tail (tests cover)
- LAUN-05: crash viewer takes over on crash (tests cover)
- COMP-05: D-21 invariant — display == clipboard contents — tested
- D-09 morph sequence all 5 states tested
- D-13 cancel window enforced (hidden during starting/playing)
</success_criteria>

<output>
After completion, create `.planning/phases/03-vanilla-launch-jre-bundling-packaging/03-08-SUMMARY.md` documenting:
- Any phase-transition edge cases found (e.g., if `onExited` fires before `onCrashed` but `onCrashed` arrives 100ms later — how the 6s timer handles it)
- D-21 test implementation details (clipboard mock approach — `Object.assign(navigator,…)` vs defineProperty)
- Confirmed CrashViewer has zero imports from `redact.ts`
</output>
