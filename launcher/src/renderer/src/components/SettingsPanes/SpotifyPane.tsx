/**
 * Settings modal — Spotify pane (D-10 + D-33).
 *
 * Disconnected view: Connect CTA + explanatory text (read-only for Free users;
 *   playback controls require Spotify Premium — 403 PREMIUM_REQUIRED surface).
 * Connected view: display name + granted scopes + Disconnect button.
 *
 * Disconnect is instant — no confirm dialog (D-15 parity with Phase 2 auth).
 * The AccountBadge dropdown logout shipped the same contract; reconnecting
 * is cheap (Spotify's refresh-token cache is local, OAuth flow is a browser
 * round-trip), so a confirm would be friction without safety value.
 *
 * Scopes list mirrors the main-process Spotify scopes used in Plan 04-05 —
 * read-and-write playback over a connected player.
 */
import type React from 'react'
import { useSpotifyStore } from '../../stores/spotify'

/**
 * Granted OAuth scopes displayed on the connected pane (matches Plan 04-05's
 * scope string sent to Spotify's /authorize endpoint). Shown so the user can
 * see exactly what permissions the launcher holds on their account.
 */
const DISPLAYED_SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state'
] as const

export function SpotifyPane(): React.JSX.Element {
  const state = useSpotifyStore((s) => s.state)
  const displayName = useSpotifyStore((s) => s.displayName)
  const lastError = useSpotifyStore((s) => s.lastError)
  const connect = useSpotifyStore((s) => s.connect)
  const disconnect = useSpotifyStore((s) => s.disconnect)

  const isConnected = state !== 'disconnected' && state !== 'connecting'
  const isConnecting = state === 'connecting'

  return (
    <div data-testid="spotify-pane" className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-neutral-200">Spotify</h2>

      {!isConnected && (
        <>
          <p className="text-sm text-neutral-400 max-w-xl">
            Connect your Spotify account to see your current track in the sidebar.
            Read-only display works on any account; playback controls require Spotify
            Premium.
          </p>
          {lastError ? (
            <p className="text-xs text-red-400" role="alert">
              {lastError}
            </p>
          ) : null}
          <div>
            <button
              type="button"
              onClick={() => void connect()}
              disabled={isConnecting}
              className="px-4 py-2 text-sm rounded font-semibold disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-wiiwho-bg, #111111)',
                outlineColor: 'var(--color-accent)'
              }}
            >
              {isConnecting ? 'Connecting…' : 'Connect Spotify'}
            </button>
          </div>
        </>
      )}

      {isConnected && (
        <>
          <section className="flex flex-col gap-1">
            <div className="text-sm text-neutral-500">Connected as</div>
            <div className="text-lg font-semibold text-neutral-200">
              {displayName ?? '—'}
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <div className="text-sm text-neutral-500">Granted scopes</div>
            <ul
              className="list-disc list-inside text-sm text-neutral-300"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {DISPLAYED_SCOPES.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <div>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="px-4 py-2 text-sm rounded bg-neutral-800 text-neutral-200 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2"
              style={{ outlineColor: 'var(--color-accent)' }}
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  )
}
