/**
 * @vitest-environment jsdom
 *
 * PlayButton — D-09 morph sequence, D-11 fail UI, D-13 cancel window, D-14 retry.
 *
 * Tests drive the store directly via `useGameStore.setState({phase: ...})` to
 * force each phase without needing IPC orchestration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock window.wiiwho.game so the store's play()/cancel() calls don't throw
// when PlayButton wires them on mount.
const gameApi = {
  play: vi.fn().mockResolvedValue({ ok: true }),
  cancel: vi.fn().mockResolvedValue({ ok: true }),
  status: vi.fn(),
  onStatus: vi.fn(() => () => {}),
  onProgress: vi.fn(() => () => {}),
  onLog: vi.fn(() => () => {}),
  onExited: vi.fn(() => () => {}),
  onCrashed: vi.fn(() => () => {})
}

;(globalThis as unknown as { window: { wiiwho: { game: typeof gameApi } } }).window.wiiwho = {
  game: gameApi
} as never

import { PlayButton } from '../PlayButton'
import { useGameStore, type LogEntry } from '../../stores/game'

function resetStore(): void {
  useGameStore.setState({
    phase: { state: 'idle' },
    logTail: [],
    subscribed: false
  })
}

describe('PlayButton', () => {
  beforeEach(() => {
    gameApi.play.mockReset().mockResolvedValue({ ok: true })
    gameApi.cancel.mockReset().mockResolvedValue({ ok: true })
    resetStore()
  })

  afterEach(() => {
    cleanup()
  })

  it('idle: renders "Play" and clicking invokes play()', async () => {
    render(<PlayButton />)
    const btn = screen.getByRole('button', { name: /^play$/i })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    await vi.waitFor(() => expect(gameApi.play).toHaveBeenCalledTimes(1))
  })

  it('downloading: renders "Downloading… 42%", button disabled, Cancel link present', () => {
    useGameStore.setState({
      phase: { state: 'downloading', percent: 42, currentFile: 'client.jar' }
    })
    render(<PlayButton />)
    expect(screen.getByRole('button', { name: /downloading.*42%/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
  })

  it('verifying: renders "Verifying…" and Cancel link still present (D-13)', () => {
    useGameStore.setState({ phase: { state: 'verifying' } })
    render(<PlayButton />)
    expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
  })

  it('starting: renders "Starting Minecraft…" and Cancel is GONE (D-13 cancel window closed)', () => {
    useGameStore.setState({ phase: { state: 'starting' } })
    render(<PlayButton />)
    expect(
      screen.getByRole('button', { name: /starting minecraft/i })
    ).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
  })

  it('playing: renders "Playing", button disabled, no Cancel', () => {
    useGameStore.setState({ phase: { state: 'playing' } })
    render(<PlayButton />)
    expect(screen.getByRole('button', { name: /^playing$/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
  })

  it('cancel click during downloading invokes cancel()', async () => {
    useGameStore.setState({
      phase: { state: 'downloading', percent: 30, currentFile: 'foo' }
    })
    render(<PlayButton />)
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    await vi.waitFor(() => expect(gameApi.cancel).toHaveBeenCalledTimes(1))
  })

  it('failed: renders error banner + log tail <pre> + Retry button (D-11 + D-14)', async () => {
    const logTail: LogEntry[] = [
      { line: 'first log line', stream: 'out' },
      { line: 'second log line', stream: 'err' },
      { line: 'third log line', stream: 'out' }
    ]
    useGameStore.setState({
      phase: {
        state: 'failed',
        message: 'JVM exited with code 1. No crash report was written.',
        logTail
      },
      logTail
    })
    render(<PlayButton />)

    // Error banner surfaces the message.
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText(/jvm exited with code 1/i)
    ).toBeInTheDocument()

    // Log tail renders the lines in a <pre>.
    const pre = screen.getByLabelText(/last 30 log lines/i)
    expect(pre.tagName.toLowerCase()).toBe('pre')
    expect(pre.textContent).toContain('first log line')
    expect(pre.textContent).toContain('second log line')
    expect(pre.textContent).toContain('third log line')

    // Retry button calls play().
    const retry = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retry)
    await vi.waitFor(() => expect(gameApi.play).toHaveBeenCalledTimes(1))
  })

  it('crashed: component yields to CrashViewer (renders null) — D-18', () => {
    useGameStore.setState({
      phase: { state: 'crashed', sanitizedBody: 'x', crashId: null }
    })
    const { container } = render(<PlayButton />)
    expect(container.firstChild).toBeNull()
  })
})
