/**
 * Full-page crash report takeover (D-18 + D-19 + D-21).
 *
 * Mounted by App.tsx when `useGameStore.phase.state === 'crashed'`. Replaces
 * the Home screen entirely — this is deliberate, matching the severity of a
 * crash (per owner direction in CONTEXT.md D-18: "not a modal, not an inline
 * banner").
 *
 * ---------------------------------------------------------------------
 * D-21 INVARIANT (do not violate):
 *
 *   The `sanitizedBody` prop arrives pre-redacted from the main process
 *   (Plan 03-10's logs:read-crash handler runs the main-side redactor
 *   before pushing the string over IPC).
 *
 *   This component does ZERO redaction. It forwards the prop to BOTH the
 *   <pre> display AND the clipboard write, which is what makes display ==
 *   clipboard a mechanical truth: both paths source the identical string.
 *   A unit test asserts this (see CrashViewer.test.tsx "D-21 invariant").
 *
 *   A regression-guard grep forbids adding redaction imports or regex-
 *   literal redaction logic to this file. If you think you need to redact
 *   here, the fix is in the main-side redactor module, not this component.
 * ---------------------------------------------------------------------
 *
 * D-19 four buttons: Copy report / Open crash folder / Close / Play again.
 * The first two mutate external state (clipboard + shell); the latter two are
 * callbacks so App.tsx owns the transition (Close → useGameStore.resetToIdle,
 * Play again → useGameStore.play).
 */

import { AlertTriangle, Copy, FolderOpen, X, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  /** Crash body — already scrubbed by main-side redact.ts. See D-21 invariant. */
  sanitizedBody: string
  /** `crash-YYYY-MM-DD_HH.mm.ss-client` filename stem; null when source is stdout-tail fallback. */
  crashId: string | null
  /** Dismiss the viewer — App.tsx should reset the game store to idle. */
  onClose: () => void
  /** Kick off a fresh launch — App.tsx should invoke useGameStore.play(). */
  onPlayAgain: () => void
  /** Reveal the crash-reports/ directory in Explorer/Finder. Wired main-side in Plan 03-10. */
  onOpenCrashFolder: (crashId: string | null) => void
}

export function CrashViewer({
  sanitizedBody,
  crashId,
  onClose,
  onPlayAgain,
  onOpenCrashFolder
}: Props): React.JSX.Element {
  // D-21: the clipboard write uses the SAME string the <pre> renders. No
  // transformation, no re-encoding. If the Clipboard API rejects (jsdom or a
  // missing permission in Electron's sandbox), we swallow — the user still
  // sees the body on screen and can select-copy manually. A toast is a v0.2
  // nicety; for v0.1 the display path is the ground truth.
  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(sanitizedBody)
    } catch {
      // Intentional no-op — see comment above.
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="bg-red-900/20 border-b border-red-900/40 px-8 py-5 flex items-center gap-3">
        <AlertTriangle
          className="text-red-500 size-6"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Crash detected</h1>
          <p className="text-xs font-normal text-neutral-400">
            Minecraft stopped unexpectedly. Your game data is safe.
            {crashId ? (
              <>
                {' '}
                Report: <span className="font-mono">{crashId}</span>
              </>
            ) : null}
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
