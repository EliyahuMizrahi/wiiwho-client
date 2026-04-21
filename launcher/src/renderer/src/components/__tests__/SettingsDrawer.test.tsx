/**
 * @vitest-environment jsdom
 *
 * SettingsDrawer — D-01 (slide-in right drawer) + D-02 (X + ESC +
 * click-outside all close) + D-07 (Logs + Crashes live inside the drawer).
 *
 * Radix Sheet = Radix Dialog under the hood; needs pointer-capture stubs
 * AND ResizeObserver (because it embeds RamSlider which uses @radix-ui/
 * react-use-size).
 */

import { afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

beforeAll(() => {
  const elProto = Element.prototype as unknown as {
    hasPointerCapture?: (id: number) => boolean
    releasePointerCapture?: (id: number) => void
    scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void
  }
  if (!elProto.hasPointerCapture) elProto.hasPointerCapture = () => false
  if (!elProto.releasePointerCapture) elProto.releasePointerCapture = () => {}
  if (!elProto.scrollIntoView) elProto.scrollIntoView = () => {}

  const g = globalThis as unknown as { ResizeObserver?: unknown }
  if (!g.ResizeObserver) {
    g.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }
})

type SettingsAPI = {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
}

const settingsApi: SettingsAPI = {
  get: vi.fn(),
  set: vi.fn()
}

;(globalThis as unknown as { window: Window & { wiiwho: unknown } }).window.wiiwho = {
  settings: settingsApi
} as never

import { SettingsDrawer } from '../SettingsDrawer'
import { useSettingsStore } from '../../stores/settings'

function resetStore(): void {
  useSettingsStore.setState({
    version: 1,
    ramMb: 2048,
    firstRunSeen: false,
    hydrated: true
  })
}

describe('SettingsDrawer', () => {
  beforeEach(() => {
    settingsApi.get.mockReset()
    settingsApi.set.mockReset().mockResolvedValue({
      ok: true,
      settings: { version: 1, ramMb: 2048, firstRunSeen: false }
    })
    resetStore()
  })

  afterEach(() => {
    cleanup()
  })

  it('does NOT render drawer content when open=false', () => {
    render(<SettingsDrawer open={false} onOpenChange={() => {}} />)
    expect(screen.queryByText(/^Settings$/)).not.toBeInTheDocument()
  })

  it('renders drawer content when open=true — role=dialog with accessible name "Settings"', () => {
    render(<SettingsDrawer open={true} onOpenChange={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: /settings/i })
    expect(dialog).toBeInTheDocument()
  })

  it('D-07: drawer contains RamSlider, Logs nav, Crashes nav, and version footer', () => {
    render(<SettingsDrawer open={true} onOpenChange={() => {}} />)
    // RamSlider present (check for its label and caption).
    expect(screen.getByText('RAM allocation')).toBeInTheDocument()
    expect(
      screen.getByText(/lower values use less memory/i)
    ).toBeInTheDocument()
    // Logs + Crashes nav entries.
    expect(
      screen.getByRole('button', { name: /logs/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /crashes/i })
    ).toBeInTheDocument()
    // Version footer (default 'v0.1.0-dev' per plan).
    expect(screen.getByText(/v0\.1\.0-dev/i)).toBeInTheDocument()
  })

  it('D-02: clicking the X close button invokes onOpenChange(false)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<SettingsDrawer open={true} onOpenChange={onOpenChange} />)
    const closeBtn = screen.getByRole('button', { name: /close/i })
    await user.click(closeBtn)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('D-02: pressing Escape invokes onOpenChange(false)', () => {
    const onOpenChange = vi.fn()
    render(<SettingsDrawer open={true} onOpenChange={onOpenChange} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('D-02: clicking the overlay (outside) invokes onOpenChange(false)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<SettingsDrawer open={true} onOpenChange={onOpenChange} />)
    // Radix Dialog overlay has data-slot="sheet-overlay".
    const overlay = document.querySelector('[data-slot="sheet-overlay"]')
    expect(overlay).not.toBeNull()
    // Use pointerDown — Radix dismisses on overlay pointerDown.
    await user.pointer({ target: overlay as Element, keys: '[MouseLeft]' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('D-07: clicking Logs invokes onOpenLogs callback', async () => {
    const user = userEvent.setup()
    const onOpenLogs = vi.fn()
    render(
      <SettingsDrawer
        open={true}
        onOpenChange={() => {}}
        onOpenLogs={onOpenLogs}
      />
    )
    await user.click(screen.getByRole('button', { name: /logs/i }))
    expect(onOpenLogs).toHaveBeenCalledTimes(1)
  })

  it('D-07: clicking Crashes invokes onOpenCrashes callback', async () => {
    const user = userEvent.setup()
    const onOpenCrashes = vi.fn()
    render(
      <SettingsDrawer
        open={true}
        onOpenChange={() => {}}
        onOpenCrashes={onOpenCrashes}
      />
    )
    await user.click(screen.getByRole('button', { name: /crashes/i }))
    expect(onOpenCrashes).toHaveBeenCalledTimes(1)
  })

  it('version footer reflects an optional appVersion prop override', () => {
    render(
      <SettingsDrawer
        open={true}
        onOpenChange={() => {}}
        appVersion="v0.2.3-rc1"
      />
    )
    expect(screen.getByText('v0.2.3-rc1')).toBeInTheDocument()
  })
})
