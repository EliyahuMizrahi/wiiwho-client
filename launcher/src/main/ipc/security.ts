import { ipcMain, BrowserWindow } from 'electron'

/**
 * LAUN-06 runtime verification.
 *
 * The __security:audit handler reports the LIVE webPreferences of the first
 * BrowserWindow. It reports each field as a single-bit "is this the secure
 * state?" — for `nodeIntegration` this inverts (we want nodeIntegration=OFF,
 * so the handler returns `true` when it is off). `allTrue` is the one-bit
 * go/no-go: if it is false, the launcher's security posture is wrong.
 *
 * Electron does NOT expose `webContents.getWebPreferences()` on its public
 * types (verified against electron 39's electron.d.ts). Instead, main at
 * window-creation time calls `registerSecurityHandlers(prefs)` with the
 * webPreferences it actually passed to BrowserWindow — a single source of
 * truth captured by the creation site.
 *
 * The Vitest test (security.test.ts) invokes this with a mocked BrowserWindow
 * that carries stubbed prefs; at runtime the DevTools console invokes the
 * same channel and should see `allTrue: true` per LAUN-06.
 */
export interface AuditablePrefs {
  contextIsolation?: boolean
  nodeIntegration?: boolean
  sandbox?: boolean
}

export interface SecurityAudit {
  contextIsolation: boolean
  nodeIntegration: boolean
  sandbox: boolean
  allTrue: boolean
}

export function auditPrefs(prefs: AuditablePrefs | undefined): SecurityAudit {
  const contextIsolation = prefs?.contextIsolation === true
  const nodeIntegration = prefs?.nodeIntegration === false // inverted: we want nodeIntegration OFF
  const sandbox = prefs?.sandbox === true
  return {
    contextIsolation,
    nodeIntegration, // "is it safe?" — true means nodeIntegration is OFF as desired
    sandbox,
    allTrue: contextIsolation && nodeIntegration && sandbox
  }
}

// Tests inject webPreferences via a BrowserWindow mock that exposes them under
// a known property. Runtime captures prefs at creation and stores here.
let capturedPrefs: AuditablePrefs | undefined

/**
 * Called from main at window creation time, with the exact object passed to
 * BrowserWindow's `webPreferences` option. This is the single source of truth
 * the audit reports.
 */
export function setAuditedPrefs(prefs: AuditablePrefs): void {
  capturedPrefs = { ...prefs }
}

export function registerSecurityHandlers(): void {
  ipcMain.handle('__security:audit', () => {
    // Prefer captured prefs (the values we set at creation time).
    // Fall back to probing BrowserWindow if the test harness provided a mock
    // with getWebPreferences() — keeps the test interface stable.
    if (capturedPrefs) {
      return auditPrefs(capturedPrefs)
    }
    const win = BrowserWindow.getAllWindows()[0] as
      | (BrowserWindow & {
          webContents: {
            getWebPreferences?: () => AuditablePrefs | undefined
          }
        })
      | undefined
    const prefs = win?.webContents.getWebPreferences?.()
    return auditPrefs(prefs)
  })
}

// Test-only hook: reset captured prefs between tests.
export function __resetSecurityForTests(): void {
  capturedPrefs = undefined
}
