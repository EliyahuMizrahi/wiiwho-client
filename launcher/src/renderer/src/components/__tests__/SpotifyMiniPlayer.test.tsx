/**
 * @vitest-environment jsdom
 *
 * Plan 04-06 Task 2 — SpotifyMiniPlayer 6 visual states + context menu.
 *
 * Visual states covered:
 *   1. disconnected      — Connect CTA
 *   2. connecting        — "Connecting…"
 *   3. connected-idle    — "Nothing playing" (D-27)
 *   4. connected-playing — track/artist/art + controls
 *   5. offline           — "(offline)" badge (D-35)
 *   6. no-premium        — controls disabled + "Premium required" tooltip
 *
 * Plus:
 *   - album-art img renders from currentTrack.albumArtUrl
 *   - context menu trigger → "Open Spotify app" link + "Disconnect" item
 *   - Radix DropdownMenu Portal is NOT mounted until trigger click (test order pinned)
 *   - anti-bloat (UI-05) across all states
 */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// jsdom stubs — Radix DropdownMenu + framer-motion both need these.
beforeAll(() => {
  const elProto = Element.prototype as unknown as {
    hasPointerCapture?: (id: number) => boolean
    releasePointerCapture?: (id: number) => void
    scrollIntoView?: (arg?: boolean | ScrollIntoViewOptions) => void
  }
  if (!elProto.hasPointerCapture) elProto.hasPointerCapture = () => false
  if (!elProto.releasePointerCapture) elProto.releasePointerCapture = () => {}
  if (!elProto.scrollIntoView) elProto.scrollIntoView = () => {}
})

// Mock motion/react — passthrough renders, stripped animation props.
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_, key) => {
          const Comp = key as string
          return ({
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            layoutId: _layoutId,
            ...rest
          }: Record<string, unknown>) =>
            React.createElement(Comp, { ...(rest as object) } as never)
        }
      }
    ),
    useReducedMotion: () => false
  }
})

import { SpotifyMiniPlayer } from '../SpotifyMiniPlayer'
import { useSpotifyStore } from '../../stores/spotify'

const connectMock = vi.fn().mockResolvedValue(undefined)
const disconnectMock = vi.fn().mockResolvedValue(undefined)
const playMock = vi.fn().mockResolvedValue(undefined)
const pauseMock = vi.fn().mockResolvedValue(undefined)
const nextMock = vi.fn().mockResolvedValue(undefined)
const previousMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  useSpotifyStore.setState({
    state: 'disconnected',
    displayName: null,
    isPremium: 'unknown',
    currentTrack: null,
    lastError: null,
    connect: connectMock,
    disconnect: disconnectMock,
    play: playMock,
    pause: pauseMock,
    next: nextMock,
    previous: previousMock
  } as never)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SpotifyMiniPlayer — state: disconnected', () => {
  it('renders "Connect Spotify" button', () => {
    render(<SpotifyMiniPlayer />)
    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeDefined()
  })

  it('clicking Connect calls store.connect()', async () => {
    const user = userEvent.setup()
    render(<SpotifyMiniPlayer />)
    await user.click(screen.getByRole('button', { name: /connect spotify/i }))
    expect(connectMock).toHaveBeenCalledTimes(1)
  })
})

describe('SpotifyMiniPlayer — state: connecting', () => {
  it('renders "Connecting…" text', () => {
    useSpotifyStore.setState({ state: 'connecting' } as never)
    render(<SpotifyMiniPlayer />)
    expect(screen.getByText(/connecting/i)).toBeDefined()
  })
})

describe('SpotifyMiniPlayer — state: connected-idle (D-27)', () => {
  it('renders "Nothing playing"', () => {
    useSpotifyStore.setState({
      state: 'connected-idle',
      displayName: 'Owner',
      isPremium: 'yes'
    } as never)
    render(<SpotifyMiniPlayer />)
    expect(screen.getByText(/nothing playing/i)).toBeDefined()
  })
})

describe('SpotifyMiniPlayer — state: connected-playing', () => {
  beforeEach(() => {
    useSpotifyStore.setState({
      state: 'connected-playing',
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: {
        id: 't1',
        name: 'Song Title',
        artists: ['Artist A', 'Artist B'],
        albumArtUrl: 'https://a.com/art.jpg',
        isPlaying: true
      }
    } as never)
  })

  it('renders track name and artists', () => {
    render(<SpotifyMiniPlayer />)
    expect(screen.getByText(/Song Title/)).toBeDefined()
    expect(screen.getByText(/Artist A, Artist B/)).toBeDefined()
  })

  it('renders album art img with the track URL', () => {
    const { container } = render(<SpotifyMiniPlayer />)
    const img = container.querySelector('img') as HTMLImageElement | null
    expect(img?.src).toMatch(/a\.com\/art\.jpg$/)
  })

  it('renders play/pause + prev + next buttons enabled when isPremium="yes"', () => {
    render(<SpotifyMiniPlayer />)
    expect((screen.getByRole('button', { name: /pause/i }) as HTMLButtonElement).disabled).toBe(
      false
    )
    expect((screen.getByRole('button', { name: /next/i }) as HTMLButtonElement).disabled).toBe(
      false
    )
    expect(
      (screen.getByRole('button', { name: /previous/i }) as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('clicking Pause calls store.pause()', async () => {
    const user = userEvent.setup()
    render(<SpotifyMiniPlayer />)
    await user.click(screen.getByRole('button', { name: /pause/i }))
    expect(pauseMock).toHaveBeenCalledTimes(1)
  })

  it('clicking Next calls store.next()', async () => {
    const user = userEvent.setup()
    render(<SpotifyMiniPlayer />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(nextMock).toHaveBeenCalledTimes(1)
  })

  it('clicking Previous calls store.previous()', async () => {
    const user = userEvent.setup()
    render(<SpotifyMiniPlayer />)
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(previousMock).toHaveBeenCalledTimes(1)
  })
})

describe('SpotifyMiniPlayer — state: offline (D-35)', () => {
  it('shows "(offline)" suffix next to track title', () => {
    useSpotifyStore.setState({
      state: 'offline',
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'Song Title', artists: ['A'], isPlaying: false }
    } as never)
    const { container } = render(<SpotifyMiniPlayer />)
    expect(container.textContent ?? '').toMatch(/\(offline\)/i)
  })
})

describe('SpotifyMiniPlayer — no-premium overlay', () => {
  it('controls disabled + tooltip "Spotify Premium required" when isPremium="no"', () => {
    useSpotifyStore.setState({
      state: 'connected-playing',
      displayName: 'Owner',
      isPremium: 'no',
      currentTrack: { id: 't1', name: 'Song', artists: ['A'], isPlaying: false }
    } as never)
    render(<SpotifyMiniPlayer />)
    const playBtn = screen.getByRole('button', { name: /play/i }) as HTMLButtonElement
    expect(playBtn.disabled).toBe(true)
    expect(playBtn.getAttribute('title')).toMatch(/premium required/i)
    // Track display still visible — read-only works on Free.
    expect(screen.getByText('Song')).toBeDefined()
  })
})

describe('SpotifyMiniPlayer — context menu (D-33)', () => {
  it('renders "Open Spotify app" link with href spotify:// AFTER trigger click (Radix Portal)', async () => {
    useSpotifyStore.setState({
      state: 'connected-playing',
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }
    } as never)
    const user = userEvent.setup()
    render(<SpotifyMiniPlayer />)
    // Radix DropdownMenu content lives in a Portal — NOT in DOM until trigger click.
    await user.click(screen.getByRole('button', { name: /more options/i }))
    const link = screen.getByRole('link', { name: /open spotify app/i })
    expect(link.getAttribute('href')).toBe('spotify://')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('renders "Disconnect" menu item that calls store.disconnect() AFTER trigger click', async () => {
    useSpotifyStore.setState({
      state: 'connected-playing',
      displayName: 'Owner',
      isPremium: 'yes',
      currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true }
    } as never)
    const user = userEvent.setup()
    render(<SpotifyMiniPlayer />)
    await user.click(screen.getByRole('button', { name: /more options/i }))
    await user.click(screen.getByRole('menuitem', { name: /disconnect/i }))
    expect(disconnectMock).toHaveBeenCalledTimes(1)
  })
})

describe('SpotifyMiniPlayer — anti-bloat (UI-05)', () => {
  it('contains NO ads/news/friends/buy/subscribe strings in any state', () => {
    for (const stateSetup of [
      { state: 'disconnected', currentTrack: null, isPremium: 'unknown' },
      {
        state: 'connected-playing',
        currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: true },
        isPremium: 'yes'
      },
      {
        state: 'offline',
        currentTrack: { id: 't1', name: 'S', artists: ['A'], isPlaying: false },
        isPremium: 'yes'
      }
    ] as const) {
      useSpotifyStore.setState(stateSetup as never)
      const { container, unmount } = render(<SpotifyMiniPlayer />)
      const text = container.textContent?.toLowerCase() ?? ''
      expect(text).not.toMatch(
        /\b(ad|ads|advertisement|news|friends? online|buy now|subscribe|premium offer)\b/
      )
      unmount()
    }
  })
})
