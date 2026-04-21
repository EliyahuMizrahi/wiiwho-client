/**
 * Main-process singleton that owns the entire Microsoft auth state machine.
 *
 * Responsibilities:
 *   - Device-code login (AUTH-01, AUTH-02, AUTH-05) via prismarine-auth + MSAL Node
 *   - Cancel support (D-07) for the Stop-signing-in / ESC path
 *   - Silent refresh on startup (D-02) with quiet failure (D-03)
 *   - Logout (D-15, AUTH-06) wiping the active account's cache files + pointer entry
 *
 * Security invariants:
 *   - Token material lives ONLY inside this file's in-memory Authflow instance
 *     and the safeStorage-encrypted cache files (D-17).
 *   - No token bytes ever flow through IPC to the renderer (D-17).
 *   - prismarine-auth is called with flow:'msal' + our registered Azure AD client ID
 *     (never flow:'live' — Pitfall 5).
 *
 * Cancel protocol (D-07 / UI-SPEC line 216):
 *   On the AbortController-aborted branch, loginWithDeviceCode returns an
 *   AuthErrorView whose `message` field is the literal sentinel
 *   `__CANCELLED__`. The cancel branch does NOT go through mapAuthError.
 *   The renderer store (Plan 04) short-circuits on this sentinel and
 *   transitions to 'logged-out' WITHOUT setting error — delivering the
 *   "no banner, silent return" behavior UI-SPEC locks. The sentinel is an
 *   internal protocol string and MUST NEVER reach the UI.
 *
 * Source of truth: .planning/phases/02-microsoft-authentication/02-RESEARCH.md
 *   §Architecture Patterns 2, 3, 6, 7 and §Code Examples 1, 2.
 */

import type { BrowserWindow } from 'electron'
import { safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import log from 'electron-log/main'
import { Authflow, type CacheFactory } from 'prismarine-auth'
import { mapAuthError, type AuthErrorView } from './xstsErrors'
import { safeStorageCacheFactory, resolveAuthDir } from './safeStorageCache'
import { readAuthStore, writeAuthStore, clearActiveAccount } from './authStore'

/** Registered Azure AD app (non-secret per Phase 1 D-18). */
const AZURE_CLIENT_ID = '60cbce02-072b-4963-833d-edb6f5badc2a'

/** Logical username passed to prismarine-auth. v0.1 single-account → 'primary'. */
const PRIMARY_USERNAME = 'primary'

/**
 * Internal protocol string placed in AuthErrorView.message when the user
 * cancels an in-flight device-code login. The renderer store detects this
 * sentinel and transitions to 'logged-out' WITHOUT rendering an ErrorBanner
 * (UI-SPEC line 216: "no banner — silent return to LoginScreen").
 *
 * This string MUST NEVER be shown in UI. If you see it in a banner, the
 * renderer store short-circuit in stores/auth.ts is broken.
 */
const CANCELLED_SENTINEL = '__CANCELLED__'

export interface LoginResult {
  ok: boolean
  username?: string
  uuid?: string
  error?: AuthErrorView
}

export interface Status {
  loggedIn: boolean
  username?: string
  uuid?: string
}

class CancelledError extends Error {
  constructor() {
    super('CANCELLED')
    this.name = 'CancelledError'
  }
}

export class AuthManager {
  private status: Status = { loggedIn: false }
  private pendingAbort: AbortController | null = null

  getStatus(): Status {
    return { ...this.status }
  }

  async loginWithDeviceCode(win: BrowserWindow): Promise<LoginResult> {
    if (!safeStorage.isEncryptionAvailable()) {
      return {
        ok: false,
        error: {
          code: null,
          message: 'OS keychain is unavailable. Please restart the launcher.',
          helpUrl: null
        }
      }
    }

    this.pendingAbort = new AbortController()
    const abort = this.pendingAbort

    // prismarine-auth's `index.d.ts` declares the codeCallback parameter as
    // `ServerDeviceCodeResponse` (snake_case — user_code / verification_uri /
    // expires_in). That type only accurately describes the legacy live-flow
    // branch. On flow:'msal' (what we use per D-16 / Pitfall 5), the
    // callback actually receives MSAL's camelCase DeviceCodeResponse —
    // { userCode, verificationUri, expiresIn, ... } (verified in
    // @azure/msal-node src/client/DeviceCodeClient.ts). Typing the parameter
    // as unknown + narrowing at the boundary avoids an incorrect upstream
    // declaration poisoning our module.
    const codeCallback = (resp: unknown): void => {
      if (abort.signal.aborted) return
      const r = resp as {
        userCode: string
        verificationUri: string
        expiresIn: number
      }
      win.webContents.send('auth:device-code', {
        userCode: r.userCode,
        verificationUri: r.verificationUri,
        expiresInSec: r.expiresIn
      })
    }

    const flow = new Authflow(
      PRIMARY_USERNAME,
      // Cast: prismarine-auth's `Cache` type requires a `reset()` method we
      // don't need (it's only used by the unused forceRefresh path). Our
      // PrismarineCache shape covers every call site prismarine-auth actually
      // hits — getCached / setCached / setCachedPartial. Casting here keeps
      // the narrower public surface of safeStorageCache.ts intact (it was
      // locked by Plan 02-02).
      safeStorageCacheFactory(resolveAuthDir()) as unknown as CacheFactory,
      { flow: 'msal', authTitle: AZURE_CLIENT_ID as never },
      codeCallback as never
    )

    try {
      const loginP = flow.getMinecraftJavaToken({ fetchProfile: true })
      const cancelP = new Promise<never>((_resolve, reject) => {
        abort.signal.addEventListener(
          'abort',
          () => reject(new CancelledError()),
          { once: true }
        )
      })
      const result = (await Promise.race([loginP, cancelP])) as {
        profile: { id: string; name: string } | null
      }

      if (!result.profile) throw new Error('NO_MC_PROFILE')

      const { id, name } = result.profile
      this.status = { loggedIn: true, username: name, uuid: id }

      // Persist pointer (no token in pointer — D-17)
      await writeAuthStore({
        version: 1,
        activeAccountId: id,
        accounts: [{ id, username: name, lastUsed: new Date().toISOString() }]
      })

      return { ok: true, username: name, uuid: id }
    } catch (err) {
      if (err instanceof CancelledError) {
        // UI-SPEC line 216: cancel is "no banner — silent return".
        // We return a sentinel AuthErrorView; the renderer store recognizes
        // message === '__CANCELLED__' and short-circuits to 'logged-out'
        // WITHOUT setting the error field. DO NOT route through mapAuthError.
        log.info('[auth] login cancelled by user')
        return {
          ok: false,
          error: {
            code: null,
            message: CANCELLED_SENTINEL,
            helpUrl: null
          }
        }
      }
      log.warn('[auth] login failed', err)
      return { ok: false, error: mapAuthError(err) }
    } finally {
      this.pendingAbort = null
    }
  }

  async cancelDeviceCode(): Promise<void> {
    this.pendingAbort?.abort()
    this.pendingAbort = null
  }

  async trySilentRefresh(): Promise<{ username: string; uuid: string } | null> {
    try {
      if (!safeStorage.isEncryptionAvailable()) return null
      const store = await readAuthStore()
      if (!store.activeAccountId || store.accounts.length === 0) {
        return null
      }

      const flow = new Authflow(
        PRIMARY_USERNAME,
        // Cast: prismarine-auth's `Cache` type requires a `reset()` method we
      // don't need (it's only used by the unused forceRefresh path). Our
      // PrismarineCache shape covers every call site prismarine-auth actually
      // hits — getCached / setCached / setCachedPartial. Casting here keeps
      // the narrower public surface of safeStorageCache.ts intact (it was
      // locked by Plan 02-02).
      safeStorageCacheFactory(resolveAuthDir()) as unknown as CacheFactory,
        { flow: 'msal', authTitle: AZURE_CLIENT_ID as never }
        // no codeCallback — silent refresh must never trigger device-code prompt
      )

      const { profile } = (await flow.getMinecraftJavaToken({
        fetchProfile: true
      })) as { profile: { id: string; name: string } | null }

      if (!profile) {
        await this.clearAllAuthState()
        return null
      }

      this.status = {
        loggedIn: true,
        username: profile.name,
        uuid: profile.id
      }

      // Refresh lastUsed
      await writeAuthStore({
        version: 1,
        activeAccountId: profile.id,
        accounts: [
          {
            id: profile.id,
            username: profile.name,
            lastUsed: new Date().toISOString()
          }
        ]
      })

      return { username: profile.name, uuid: profile.id }
    } catch (err) {
      // D-03: quiet failure. Clear stale state and fall through.
      log.info('[auth] silent refresh failed quietly', err)
      await this.clearAllAuthState()
      return null
    }
  }

  async logout(): Promise<{ ok: boolean }> {
    await this.clearAllAuthState()
    return { ok: true }
  }

  private async clearAllAuthState(): Promise<void> {
    // Wipe the per-username cache directory (all prismarine-auth encrypted files).
    const userDir = path.join(resolveAuthDir(), PRIMARY_USERNAME)
    try {
      await fs.rm(userDir, { recursive: true, force: true })
    } catch {
      // Nothing to remove — fine.
    }

    try {
      await clearActiveAccount()
    } catch {
      // Pointer may be missing/corrupt — leave it; silent-refresh will rewrite.
    }

    this.status = { loggedIn: false }
  }
}

let instance: AuthManager | null = null
export function getAuthManager(): AuthManager {
  if (!instance) instance = new AuthManager()
  return instance
}

// Exposed for tests only — do not import from production code.
export const __test__ = {
  resetSingleton: (): void => {
    instance = null
  }
}
