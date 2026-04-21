/**
 * DeviceCodeModal (D-06, D-07 — UI-SPEC §DeviceCodeModal).
 *
 * Two visible states:
 *   - Active: waiting for Microsoft (shows code + Copy + Open in browser +
 *     countdown + Stop signing in)
 *   - Expired: timer hit 0 ("The code expired before you finished signing in."
 *     + Generate new code + Stop signing in)
 *
 * Cancellation (ESC or Stop signing in) calls auth store cancelLogin() which
 * hits the frozen auth:logout channel — Plan 03's handler aborts the pending
 * login AND clears state. The still-pending login() promise then resolves
 * with the __CANCELLED__ sentinel; Plan 04's short-circuit sets the SAME
 * terminal state (state='logged-out', error=undefined, deviceCode=undefined).
 * No ErrorBanner ever renders (UI-SPEC line 216 guardrail).
 *
 * Copywriting: verbatim from UI-SPEC §Copywriting Contract. Strings like
 * "Sign in with Microsoft", "Stop signing in", and "Generate new code" are
 * grep-checked in acceptance criteria — do not edit without UI-SPEC bump.
 *
 * Source: .planning/phases/02-microsoft-authentication/02-UI-SPEC.md
 */

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '../stores/auth'

/** Format ms → "mm:ss", clamped to non-negative. */
function formatMMSS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** "ABCD1234" → "ABCD 1234" for screen-reader friendly aria-label. */
function spaceEvery4(s: string): string {
  return s.replace(/(.{4})/g, '$1 ').trim()
}

export function DeviceCodeModal(): React.JSX.Element | null {
  const deviceCode = useAuthStore((s) => s.deviceCode)
  const state = useAuthStore((s) => s.state)
  const login = useAuthStore((s) => s.login)
  const cancelLogin = useAuthStore((s) => s.cancelLogin)

  const [copied, setCopied] = useState(false)
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    deviceCode
      ? deviceCode.expiresInSec * 1000 - (Date.now() - deviceCode.receivedAt)
      : 0
  )
  const codeBlockRef = useRef<HTMLDivElement | null>(null)

  // Countdown tick — recomputes every 500ms from the deviceCode anchor.
  useEffect(() => {
    if (!deviceCode) return
    setRemainingMs(
      deviceCode.expiresInSec * 1000 - (Date.now() - deviceCode.receivedAt)
    )
    const id = setInterval(() => {
      setRemainingMs(
        deviceCode.expiresInSec * 1000 - (Date.now() - deviceCode.receivedAt)
      )
    }, 500)
    return () => clearInterval(id)
  }, [deviceCode])

  // Focus the code block on open for screen-reader announcement (aria-live
  // fires whether or not focus is here; focus moves the visible tab ring).
  useEffect(() => {
    if (deviceCode && codeBlockRef.current) {
      codeBlockRef.current.focus()
    }
  }, [deviceCode])

  const open = state === 'logging-in' && !!deviceCode

  const handleCopy = async (): Promise<void> => {
    if (!deviceCode) return
    try {
      await navigator.clipboard.writeText(deviceCode.userCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission denied — silent fail; user can type the code instead.
    }
  }

  const handleOpenBrowser = (): void => {
    if (!deviceCode) return
    // Electron with sandbox + contextIsolation: window.open to http(s) spawns
    // the system browser by default (Electron's default new-window handler).
    // shell.openExternal is main-only and the preload IPC surface is frozen,
    // so window.open is the only renderer-side path. Acceptable for v0.1.
    window.open(deviceCode.verificationUri, '_blank', 'noopener')
  }

  const handleCancel = (): void => {
    void cancelLogin()
  }

  /**
   * "Generate new code" (expired state): cancel the expired in-flight login
   * first, THEN kick off a fresh login. Why cancel first? The auth store's
   * login() has a concurrent-login guard (`if (state === 'logging-in') return`
   * from Plan 04) — when the modal is in expired state the store is still in
   * 'logging-in', so a naked login() call would be a no-op. Cancel lands the
   * store on 'logged-out' (via cancelLogin's optimistic set, which the
   * __CANCELLED__ sentinel short-circuit will redundantly confirm), clearing
   * the guard for the subsequent login() call.
   *
   * This is a Rule-1 fix-at-execute-time correction to the plan action (plan
   * snippet showed `onClick={() => void login()}` which would hit the guard);
   * documented here and in the SUMMARY.
   */
  const handleGenerateNew = async (): Promise<void> => {
    await cancelLogin()
    await login()
  }

  const expired = remainingMs <= 0

  if (!deviceCode) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleCancel()
      }}
    >
      <DialogContent
        className="sm:max-w-[480px] bg-neutral-900 border-neutral-800"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-neutral-100">
            Sign in with Microsoft
          </DialogTitle>
          <DialogDescription className="text-sm font-normal text-neutral-400">
            {expired
              ? 'The code expired before you finished signing in.'
              : "Enter this code on Microsoft's sign-in page to finish logging in."}
          </DialogDescription>
        </DialogHeader>

        {!expired ? (
          <>
            <div className="flex flex-col items-center gap-2 py-2">
              <span className="text-xs font-normal text-neutral-500">
                Your code
              </span>
              <div
                ref={codeBlockRef}
                tabIndex={-1}
                aria-live="polite"
                aria-label={`Your sign-in code: ${spaceEvery4(deviceCode.userCode)}`}
                className="text-2xl font-semibold font-mono tracking-[0.15em] text-neutral-100 select-all outline-none"
              >
                {deviceCode.userCode}
              </div>
            </div>

            <div className="flex gap-2 justify-center py-2">
              <Button
                size="sm"
                onClick={() => void handleCopy()}
                className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-sm font-normal"
              >
                {copied ? (
                  <>
                    <Check className="size-4 mr-2" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4 mr-2" aria-hidden="true" />
                    Copy code
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenBrowser}
                className="text-sm font-normal"
              >
                <ExternalLink className="size-4 mr-2" aria-hidden="true" />
                Open in browser
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-normal text-neutral-500">
                Expires in {formatMMSS(remainingMs)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                className="text-sm font-normal"
              >
                Stop signing in
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-2 pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              className="text-sm font-normal"
            >
              Stop signing in
            </Button>
            <Button
              size="sm"
              onClick={() => void handleGenerateNew()}
              className="bg-[#16e0ee] hover:bg-[#14c9d6] text-neutral-950 text-sm font-normal"
            >
              Generate new code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
