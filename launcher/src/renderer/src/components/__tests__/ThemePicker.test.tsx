/**
 * @vitest-environment jsdom
 *
 * Plan 04-04 Task 1 — ThemePicker tests.
 *
 * Covers:
 *   - 8 preset swatches in D-13 / RESEARCH-tuned order (cyan → slate)
 *   - setAccent wiring on swatch click (Mint / Violet)
 *   - Active-preset indicator via aria-pressed
 *   - Custom hex input: valid (/^#[0-9a-fA-F]{6}$/) calls setAccent; invalid no-op
 *   - EyeDropper (D-14): feature-probe — button hidden when window.EyeDropper undefined,
 *     shown when defined; ESC (reject) does NOT call setAccent.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemePicker } from '../ThemePicker'
import { useSettingsStore } from '../../stores/settings'

const setAccentMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  useSettingsStore.setState({
    version: 2,
    ramMb: 2048,
    firstRunSeen: true,
    theme: { accent: '#16e0ee', reduceMotion: 'system' },
    hydrated: true,
    modalOpen: true,
    openPane: 'appearance',
    setAccent: setAccentMock
  } as never)
  // Remove EyeDropper stub between tests
  delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ThemePicker', () => {
  it('renders 8 preset swatches in order: Cyan, Mint, Violet, Tangerine, Pink, Crimson, Amber, Slate', () => {
    render(<ThemePicker />)
    const swatches = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('data-accent-preset'))
    const ids = swatches.map((b) => b.getAttribute('data-accent-preset'))
    expect(ids).toEqual([
      'cyan',
      'mint',
      'violet',
      'tangerine',
      'pink',
      'crimson',
      'amber',
      'slate'
    ])
  })

  it('clicking Mint swatch calls setAccent("#22c55e")', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)
    await user.click(screen.getByLabelText('Set accent to Mint'))
    expect(setAccentMock).toHaveBeenCalledWith('#22c55e')
  })

  it('clicking Violet swatch calls setAccent("#a855f7")', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)
    await user.click(screen.getByLabelText('Set accent to Violet'))
    expect(setAccentMock).toHaveBeenCalledWith('#a855f7')
  })

  it('active preset has aria-pressed="true"; others aria-pressed="false"', () => {
    useSettingsStore.setState({
      theme: { accent: '#a855f7', reduceMotion: 'system' }
    } as never)
    render(<ThemePicker />)
    // jest-dom matchers are not wired in this project — use raw getAttribute.
    expect(
      screen.getByLabelText('Set accent to Violet').getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      screen.getByLabelText('Set accent to Cyan').getAttribute('aria-pressed')
    ).toBe('false')
  })

  it('typing valid hex "#ff00aa" calls setAccent("#ff00aa")', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)
    const input = screen.getByPlaceholderText('#16e0ee') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '#ff00aa')
    expect(setAccentMock).toHaveBeenCalledWith('#ff00aa')
  })

  it('typing invalid string "not-a-hex" does NOT call setAccent', async () => {
    const user = userEvent.setup()
    render(<ThemePicker />)
    const input = screen.getByPlaceholderText('#16e0ee') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'not-a-hex')
    expect(setAccentMock).not.toHaveBeenCalled()
  })

  it('EyeDropper button is NOT rendered when window.EyeDropper is undefined', () => {
    delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
    render(<ThemePicker />)
    expect(
      screen.queryByRole('button', { name: /pick color from screen/i })
    ).toBeNull()
  })

  it('EyeDropper button IS rendered when window.EyeDropper is defined', () => {
    ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class {
      open(): Promise<{ sRGBHex: string }> {
        return Promise.resolve({ sRGBHex: '#abcdef' })
      }
    }
    render(<ThemePicker />)
    expect(
      screen.getByRole('button', { name: /pick color from screen/i })
    ).toBeDefined()
  })

  it('clicking EyeDropper button opens the API and calls setAccent on the picked hex', async () => {
    const user = userEvent.setup()
    ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class {
      open(): Promise<{ sRGBHex: string }> {
        return Promise.resolve({ sRGBHex: '#abcdef' })
      }
    }
    render(<ThemePicker />)
    await user.click(screen.getByRole('button', { name: /pick color from screen/i }))
    // Let the resolved promise settle.
    await new Promise((r) => setTimeout(r, 10))
    expect(setAccentMock).toHaveBeenCalledWith('#abcdef')
  })

  it('EyeDropper ESC (reject) does NOT call setAccent', async () => {
    const user = userEvent.setup()
    ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class {
      open(): Promise<{ sRGBHex: string }> {
        return Promise.reject(new Error('user cancelled'))
      }
    }
    render(<ThemePicker />)
    await user.click(screen.getByRole('button', { name: /pick color from screen/i }))
    await new Promise((r) => setTimeout(r, 10))
    expect(setAccentMock).not.toHaveBeenCalled()
  })
})
