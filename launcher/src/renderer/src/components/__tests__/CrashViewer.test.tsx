/**
 * @vitest-environment jsdom
 *
 * CrashViewer — D-18 full-page takeover, D-19 four buttons, D-21 clipboard invariant.
 *
 * THE critical test: D-21 — display string === clipboard string. The renderer
 * must NOT sanitize (the main process already did via sanitizeCrashReport);
 * a regression-guard test reads the component source and asserts it imports
 * nothing from redact.ts and contains no scrub/sanitize identifiers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { CrashViewer } from '../CrashViewer'

describe('CrashViewer', () => {
  // Clipboard stub — fresh vi.fn() per test so call-count assertions are clean.
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    // navigator.clipboard is read-only on some runtimes; Object.assign mutates
    // the object in place, which jsdom accepts. defineProperty would also work
    // but is unnecessarily heavy here.
    Object.assign(navigator, { clipboard: { writeText } })
  })

  afterEach(() => {
    cleanup()
  })

  function renderViewer(
    overrides: Partial<{
      sanitizedBody: string
      crashId: string | null
      onClose: () => void
      onPlayAgain: () => void
      onOpenCrashFolder: (id: string | null) => void
    }> = {}
  ): {
    onClose: ReturnType<typeof vi.fn>
    onPlayAgain: ReturnType<typeof vi.fn>
    onOpenCrashFolder: ReturnType<typeof vi.fn>
  } {
    const onClose = vi.fn()
    const onPlayAgain = vi.fn()
    const onOpenCrashFolder = vi.fn()
    render(
      <CrashViewer
        sanitizedBody={overrides.sanitizedBody ?? 'stack trace body'}
        // Use explicit 'in' check so a test passing `crashId: null` actually
        // forwards null (?? would coalesce null to the default string).
        crashId={
          'crashId' in overrides
            ? (overrides.crashId as string | null)
            : 'crash-2026-04-21_15.04.22-client'
        }
        onClose={overrides.onClose ?? onClose}
        onPlayAgain={overrides.onPlayAgain ?? onPlayAgain}
        onOpenCrashFolder={overrides.onOpenCrashFolder ?? onOpenCrashFolder}
      />
    )
    return { onClose, onPlayAgain, onOpenCrashFolder }
  }

  it('renders a "Crash detected" heading', () => {
    renderViewer()
    expect(
      screen.getByRole('heading', { name: /crash detected/i })
    ).toBeInTheDocument()
  })

  it('renders <pre> body containing the sanitizedBody prop verbatim', () => {
    renderViewer({
      sanitizedBody: 'some crash\nmultiline\nbody'
    })
    const region = screen.getByRole('region', { name: /crash report/i })
    expect(region.tagName.toLowerCase()).toBe('pre')
    expect(region.textContent).toBe('some crash\nmultiline\nbody')
  })

  it('renders all four D-19 buttons: Copy report + Open crash folder + Close + Play again', () => {
    renderViewer()
    expect(
      screen.getByRole('button', { name: /copy report/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /open crash folder/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /play again/i })
    ).toBeInTheDocument()
  })

  it('D-21 invariant: Copy report writes the EXACT string shown in <pre> to clipboard', async () => {
    const body = 'foo --accessToken [REDACTED] bar\nC:\\Users\\<USER>\\client.jar'
    renderViewer({ sanitizedBody: body })

    fireEvent.click(screen.getByRole('button', { name: /copy report/i }))

    // First: the string handed to the clipboard must be the exact prop value.
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText).toHaveBeenCalledWith(body)

    // Second: the rendered <pre> textContent must be identical to the clipboard
    // argument. This is the invariant — NOT a coincidence of both matching the
    // prop, but a proof that display and clipboard source the SAME string.
    const displayed = screen.getByRole('region', {
      name: /crash report/i
    }).textContent
    expect(writeText.mock.calls[0]![0]).toBe(displayed)
  })

  it('D-21 regression guard: component source imports nothing from redact.ts and has no scrub/sanitize identifier', () => {
    // Reading the component source verifies the architectural invariant that
    // the renderer never re-sanitizes. If a future edit adds an import from
    // ../../main/auth/redact or re-implements a scrub/sanitize path in this
    // file, this test fails at the grep level before the runtime diverges.
    const src = readFileSync(
      resolve(
        __dirname,
        '..',
        'CrashViewer.tsx'
      ),
      'utf8'
    )
    expect(src).not.toMatch(/from\s+['"][^'"]*redact['"]/)
    expect(src).not.toMatch(/\bscrub\b/)
    expect(src).not.toMatch(/\bsanitize(CrashReport)?\b/)
    // No inline JWT regex either — that would indicate a copy-pasted scrubber.
    expect(src).not.toContain('eyJ')
  })

  it('Close click calls onClose', () => {
    const onClose = vi.fn()
    renderViewer({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Play again click calls onPlayAgain', () => {
    const onPlayAgain = vi.fn()
    renderViewer({ onPlayAgain })
    fireEvent.click(screen.getByRole('button', { name: /play again/i }))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })

  it('Open crash folder click calls onOpenCrashFolder with crashId', () => {
    const onOpenCrashFolder = vi.fn()
    renderViewer({
      crashId: 'crash-xyz',
      onOpenCrashFolder
    })
    fireEvent.click(screen.getByRole('button', { name: /open crash folder/i }))
    expect(onOpenCrashFolder).toHaveBeenCalledWith('crash-xyz')
  })

  it('Open crash folder with null crashId forwards null', () => {
    const onOpenCrashFolder = vi.fn()
    renderViewer({ crashId: null, onOpenCrashFolder })
    fireEvent.click(screen.getByRole('button', { name: /open crash folder/i }))
    expect(onOpenCrashFolder).toHaveBeenCalledWith(null)
  })
})
