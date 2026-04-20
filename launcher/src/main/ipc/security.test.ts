import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

// Mock electron with a BrowserWindow that returns the expected webPreferences
// via the (non-public) getWebPreferences path. Tests primarily verify the
// captured-prefs pathway via setAuditedPrefs(), but the fallback path is also
// exercised so we notice if either branch regresses.
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: {
          getWebPreferences: () => ({
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          })
        }
      }
    ]
  }
}))

import {
  registerSecurityHandlers,
  setAuditedPrefs,
  __resetSecurityForTests,
  auditPrefs
} from './security'

registerSecurityHandlers()

describe('__security:audit (LAUN-06 runtime verification)', () => {
  beforeEach(() => {
    __resetSecurityForTests()
  })

  it('auditPrefs reports allTrue: true when prefs match secure defaults', () => {
    const a = auditPrefs({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    })
    expect(a.contextIsolation).toBe(true)
    expect(a.nodeIntegration).toBe(true) // inverted: true means nodeIntegration IS off
    expect(a.sandbox).toBe(true)
    expect(a.allTrue).toBe(true)
  })

  it('auditPrefs reports allTrue: false when any pref regresses', () => {
    expect(
      auditPrefs({
        contextIsolation: false,
        nodeIntegration: false,
        sandbox: true
      }).allTrue
    ).toBe(false)
    expect(
      auditPrefs({
        contextIsolation: true,
        nodeIntegration: true, // regressed — nodeIntegration is ON
        sandbox: true
      }).allTrue
    ).toBe(false)
    expect(
      auditPrefs({
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }).allTrue
    ).toBe(false)
  })

  it('handler returns allTrue: true when captured prefs match secure defaults', async () => {
    setAuditedPrefs({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    })
    const audit = (await handlers.get('__security:audit')?.()) as {
      contextIsolation: boolean
      nodeIntegration: boolean
      sandbox: boolean
      allTrue: boolean
    }
    expect(audit.contextIsolation).toBe(true)
    expect(audit.nodeIntegration).toBe(true) // inverted
    expect(audit.sandbox).toBe(true)
    expect(audit.allTrue).toBe(true)
  })

  it('handler falls back to BrowserWindow.getWebPreferences when no captured prefs', async () => {
    // __resetSecurityForTests cleared captured prefs in beforeEach.
    const audit = (await handlers.get('__security:audit')?.()) as {
      allTrue: boolean
    }
    expect(audit.allTrue).toBe(true)
  })
})
