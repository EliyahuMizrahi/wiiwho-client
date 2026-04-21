/**
 * Renderer-side auth store (Zustand).
 *
 * Holds the auth state machine for the UI:
 *   loading -> logged-out | logged-in
 *   logged-out -> logging-in -> logged-in | error | logged-out (on cancel sentinel)
 *   error -> logged-out (dismiss) | logging-in (retry)
 *   logged-in -> logged-out (logout)
 *
 * Cancel protocol (UI-SPEC line 216 / Plan 03):
 *   The main-process AuthManager returns a special AuthErrorView on cancel:
 *   `{code: null, message: '__CANCELLED__', helpUrl: null}`. After JSON-
 *   stringification through the frozen IPC surface it arrives here as
 *   `res.error === '{"code":null,"message":"__CANCELLED__","helpUrl":null}'`.
 *   The login action MUST detect this sentinel BEFORE calling parseAuthError
 *   and short-circuit to `'logged-out'` without setting the error field —
 *   delivering "no banner, silent return to LoginScreen". Surfacing the
 *   sentinel through parseAuthError would render a banner showing the raw
 *   string `__CANCELLED__` to the user, which is a double-bug (UI-SPEC
 *   forbids the banner + leaks an internal protocol string).
 *
 * Calls into the FROZEN IPC surface window.wiiwho.auth.{status,login,logout}.
 * NEVER holds a refresh token — per D-17 the renderer only sees
 * {loggedIn, username?, uuid?}.
 *
 * Source: .planning/phases/02-microsoft-authentication/02-CONTEXT.md D-02/D-03/D-08/D-15
 */

import { create } from 'zustand'

/**
 * Cancel sentinel — MUST match the main-process AuthManager's
 * CANCELLED_SENTINEL (see 02-03-PLAN.md §Cancellation interface).
 * If this literal ever diverges from main, cancel flow breaks.
 */
const CANCELLED_SENTINEL = '__CANCELLED__'

export type AuthState =
  | 'loading'
  | 'logged-out'
  | 'logging-in'
  | 'logged-in'
  | 'error'

export interface AuthErrorViewClient {
  code: number | null
  message: string
  helpUrl: string | null
}

export interface AuthStoreState {
  state: AuthState
  username?: string
  uuid?: string
  error?: AuthErrorViewClient
  initialized: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  dismissError: () => void
  initialize: () => Promise<void>
}

/**
 * Returns true iff `raw` is the JSON-serialized __CANCELLED__ sentinel
 * emitted by the main-process cancel branch. Safe on malformed input.
 */
function isCancelledSentinel(raw: string | undefined): boolean {
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as unknown
    return (
      !!parsed &&
      typeof parsed === 'object' &&
      'message' in parsed &&
      (parsed as { message: unknown }).message === CANCELLED_SENTINEL
    )
  } catch {
    return false
  }
}

function parseAuthError(
  raw: string | undefined
): AuthErrorViewClient | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      'message' in parsed &&
      typeof (parsed as { message: unknown }).message === 'string'
    ) {
      const p = parsed as {
        code?: number | null
        message: string
        helpUrl?: string | null
      }
      return {
        code: typeof p.code === 'number' ? p.code : null,
        message: p.message,
        helpUrl: p.helpUrl ?? null
      }
    }
  } catch {
    // fall through
  }
  return { code: null, message: raw, helpUrl: null }
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  state: 'loading',
  initialized: false,

  initialize: async () => {
    if (get().initialized) return
    set({ initialized: true })
    try {
      const s = await window.wiiwho.auth.status()
      if (s.loggedIn) {
        set({
          state: 'logged-in',
          username: s.username,
          uuid: s.uuid,
          error: undefined
        })
      } else {
        set({
          state: 'logged-out',
          username: undefined,
          uuid: undefined,
          error: undefined
        })
      }
    } catch {
      set({
        state: 'logged-out',
        username: undefined,
        uuid: undefined,
        error: undefined
      })
    }
  },

  login: async () => {
    if (get().state === 'logging-in') return
    set({ state: 'logging-in', error: undefined })
    const res = await window.wiiwho.auth.login()
    if (res.ok && res.username) {
      // Fetch fresh status to pick up uuid (login() only returns username)
      const s = await window.wiiwho.auth.status()
      set({
        state: 'logged-in',
        username: s.username ?? res.username,
        uuid: s.uuid,
        error: undefined
      })
      return
    }

    // --- Failure path ---
    // UI-SPEC line 216: cancel is "no banner — silent return to LoginScreen".
    // Detect the __CANCELLED__ sentinel BEFORE parseAuthError so it never
    // reaches the UI as a rendered error message. This short-circuit must
    // stay ahead of the generic error branch; do not move it below.
    if (isCancelledSentinel(res.error)) {
      set({
        state: 'logged-out',
        username: undefined,
        uuid: undefined,
        error: undefined
      })
      return
    }

    // Any other failure → surface as an ErrorBanner-driving error state.
    set({
      state: 'error',
      error: parseAuthError(res.error),
      username: undefined,
      uuid: undefined
    })
  },

  logout: async () => {
    await window.wiiwho.auth.logout()
    set({
      state: 'logged-out',
      username: undefined,
      uuid: undefined,
      error: undefined
    })
  },

  dismissError: () => {
    if (get().state === 'error') {
      set({ state: 'logged-out', error: undefined })
    }
  }
}))
