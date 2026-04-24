/**
 * @vitest-environment jsdom
 *
 * Plan 04-06 Task 3 — SpotifyPane (Settings modal) tests.
 *
 * Covers:
 *   - Heading "Spotify"
 *   - Disconnected → Connect button + explanatory text
 *   - Connect CTA calls store.connect()
 *   - Connected → displayName + Disconnect button + granted scopes list
 *   - Disconnect is instant (no confirm dialog — D-15 parity)
 *   - data-testid="spotify-pane"
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpotifyPane } from '../SpotifyPane'
import { useSpotifyStore } from '../../../stores/spotify'

const connectMock = vi.fn().mockResolvedValue(undefined)
const disconnectMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  useSpotifyStore.setState({
    state: 'disconnected',
    displayName: null,
    isPremium: 'unknown',
    currentTrack: null,
    lastError: null,
    connect: connectMock,
    disconnect: disconnectMock
  } as never)
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('SpotifyPane', () => {
  it('renders heading "Spotify"', () => {
    render(<SpotifyPane />)
    expect(screen.getByRole('heading', { name: 'Spotify' })).toBeDefined()
  })

  it('disconnected state shows Connect button + explanatory text about Premium', () => {
    render(<SpotifyPane />)
    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeDefined()
    // Matches "...require Spotify Premium" copy.
    expect(screen.getByText(/premium/i)).toBeDefined()
  })

  it('clicking Connect calls store.connect()', async () => {
    const user = userEvent.setup()
    render(<SpotifyPane />)
    await user.click(screen.getByRole('button', { name: /connect spotify/i }))
    expect(connectMock).toHaveBeenCalledTimes(1)
  })

  it('connected state shows displayName + Disconnect button', () => {
    useSpotifyStore.setState({
      state: 'connected-idle',
      displayName: 'Owner',
      isPremium: 'yes'
    } as never)
    render(<SpotifyPane />)
    expect(screen.getByText('Owner')).toBeDefined()
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeDefined()
  })

  it('clicking Disconnect calls store.disconnect() — no confirm dialog (D-15 parity)', async () => {
    useSpotifyStore.setState({
      state: 'connected-idle',
      displayName: 'Owner',
      isPremium: 'yes'
    } as never)
    const user = userEvent.setup()
    render(<SpotifyPane />)
    await user.click(screen.getByRole('button', { name: /disconnect/i }))
    expect(disconnectMock).toHaveBeenCalledTimes(1)
  })

  it('connected state lists granted scopes', () => {
    useSpotifyStore.setState({
      state: 'connected-idle',
      displayName: 'Owner',
      isPremium: 'yes'
    } as never)
    render(<SpotifyPane />)
    expect(screen.getByText(/user-read-currently-playing/i)).toBeDefined()
    expect(screen.getByText(/user-modify-playback-state/i)).toBeDefined()
  })

  it('has data-testid="spotify-pane"', () => {
    render(<SpotifyPane />)
    expect(screen.getByTestId('spotify-pane')).toBeDefined()
  })
})
