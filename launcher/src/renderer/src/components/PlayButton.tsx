/**
 * Morphing cyan Play button (D-09) + cancel link (D-13) + fail-path UI (D-11, D-14).
 *
 * Reads `useGameStore.phase` and renders one of three shapes:
 *
 *   idle | downloading | verifying | starting | playing
 *     → Big cyan button; label morphs in place.
 *     → Cancel link ONLY during downloading + verifying (D-13 cancel window).
 *
 *   failed
 *     → Inline error banner (ErrorBanner-palette red) + scrollable log-tail <pre>
 *       + Retry button that re-invokes play() (D-14).
 *
 *   crashed
 *     → Returns null — CrashViewer takes over the entire screen as a full-page
 *       takeover (D-18), so PlayButton yields its slot.
 *
 * D-21 note: PlayButton does not touch the clipboard or the crash body. That
 * flow lives in CrashViewer, fed by the same sanitized string the store holds.
 */

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGameStore } from '../stores/game'

export function PlayButton(): React.JSX.Element | null {
  const phase = useGameStore((s) => s.phase)
  const play = useGameStore((s) => s.play)
  const cancel = useGameStore((s) => s.cancel)

  // D-18: the full-screen CrashViewer owns the 'crashed' state.
  if (phase.state === 'crashed') return null

  // D-11 + D-14: fail-path UI.
  if (phase.state === 'failed') {
    return (
      <div className="flex flex-col gap-3 w-[640px] max-w-full">
        <div
          role="alert"
          className="bg-neutral-900 border border-red-900/50 rounded-md p-4"
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              className="text-red-500 size-5 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1 text-sm font-normal text-neutral-300">
              {phase.message}
            </div>
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

  // D-09 morph sequence.
  let label: string
  let disabled = true
  let showCancel = false
  switch (phase.state) {
    case 'idle':
      label = 'Play'
      disabled = false
      break
    case 'downloading':
      // Ellipsis (U+2026) for compactness; matches the D-09 copy in CONTEXT.md.
      label = `Downloading… ${phase.percent}%`
      showCancel = true
      break
    case 'verifying':
      label = 'Verifying…'
      showCancel = true
      break
    case 'starting':
      // D-13: cancel window closes once we reach 'starting' — JVM may already
      // be spawning; the partial-launch risk is too high to offer cancel here.
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
