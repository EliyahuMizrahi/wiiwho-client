/**
 * @vitest-environment jsdom
 *
 * Plan 04-03 Task 2 — GeneralPane tests.
 *
 * Covers:
 *   - Section heading "General"
 *   - RamSlider mounts (accessible slider)
 *   - "Open crash-reports folder" button → window.wiiwho.logs.openCrashFolder()
 *   - No anti-bloat strings (UI-05)
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Radix Slider + Tooltip primitives need pointer-capture + ResizeObserver
// stubs under jsdom (same pattern as Phase 3 RamSlider.test.tsx).
;(Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture =
  () => false
;(Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture =
  () => {}
;(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

import { GeneralPane } from '../GeneralPane'
import { useSettingsStore } from '../../../stores/settings'

const openCrashFolderMock = vi.fn().mockResolvedValue({ ok: true })
const listCrashReportsMock = vi.fn().mockResolvedValue({ crashes: [] })
const settingsGetMock = vi.fn().mockResolvedValue({
  version: 2,
  ramMb: 2048,
  firstRunSeen: true,
  theme: { accent: '#16e0ee', reduceMotion: 'system' }
})
const settingsSetMock = vi.fn().mockResolvedValue({
  ok: true,
  settings: {
    version: 2,
    ramMb: 2048,
    firstRunSeen: true,
    theme: { accent: '#16e0ee', reduceMotion: 'system' }
  }
})

beforeEach(() => {
  ;(globalThis as unknown as { window: { wiiwho: unknown } }).window.wiiwho = {
    auth: {},
    game: {},
    logs: {
      openCrashFolder: openCrashFolderMock,
      listCrashReports: listCrashReportsMock
    },
    settings: { get: settingsGetMock, set: settingsSetMock },
    __debug: {}
  }
  useSettingsStore.setState({
    version: 2,
    ramMb: 2048,
    firstRunSeen: true,
    theme: { accent: '#16e0ee', reduceMotion: 'system' },
    hydrated: true,
    modalOpen: true,
    openPane: 'general'
  } as never)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('GeneralPane', () => {
  it('renders section heading "General"', () => {
    render(<GeneralPane />)
    expect(screen.getByRole('heading', { name: 'General' })).toBeDefined()
  })

  it('mounts RamSlider (visible slider with accessible name)', () => {
    render(<GeneralPane />)
    expect(screen.getByRole('slider')).toBeDefined()
  })

  it('has "Open crash-reports folder" button that calls window.wiiwho.logs.openCrashFolder()', async () => {
    const user = userEvent.setup()
    render(<GeneralPane />)
    await user.click(screen.getByRole('button', { name: /open crash-reports folder/i }))
    expect(openCrashFolderMock).toHaveBeenCalledTimes(1)
  })

  it('contains NO anti-bloat strings', () => {
    const { container } = render(<GeneralPane />)
    const text = container.textContent?.toLowerCase() ?? ''
    expect(text).not.toMatch(
      /\b(ad|ads|news feed|friends? online|concurrent users|buy|subscribe)\b/
    )
  })
})
