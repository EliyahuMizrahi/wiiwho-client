/**
 * SpotifyMiniPlayer — sidebar spotify slot (D-25..D-35).
 *
 * Renders ONE of 6 visual states based on useSpotifyStore.state + isPremium:
 *   1. disconnected       — "Connect Spotify" button
 *   2. connecting         — spinner + "Connecting…"
 *   3. connected-idle     — "Nothing playing" (D-27)
 *   4. connected-playing  — 48px album art + track title + artists + prev/play-pause/next
 *   5. offline            — connected-playing layout + "(offline)" suffix (D-35)
 *   6. no-premium overlay — controls disabled + title="Spotify Premium required for controls";
 *                           layered on top of connected-playing / connected-idle (still read-only)
 *
 * Context menu (D-33): right-click OR "More options" chevron opens a Radix
 * DropdownMenu with:
 *   - Open Spotify app — native anchor with the spotify app URL scheme inside
 *     DropdownMenuItem asChild (OS handles the protocol)
 *   - Disconnect       — DropdownMenuItem → store.disconnect()
 *
 * Album-art crossfade: AnimatePresence + motion.img keyed by albumArtUrl.
 * Duration comes from useMotionConfig() so reduced-motion instantly settles.
 *
 * Source:
 *   - .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-25..§D-35
 *   - .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack → Pattern D
 */
import type React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Play as PlayIcon,
  Pause as PauseIcon,
  SkipForward,
  SkipBack,
  MoreVertical,
  Music
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from './ui/dropdown-menu'
import { useSpotifyStore } from '../stores/spotify'
import { useMotionConfig } from '../hooks/useMotionConfig'

const PREMIUM_TOOLTIP = 'Spotify Premium required for controls'

export function SpotifyMiniPlayer(): React.JSX.Element {
  const state = useSpotifyStore((s) => s.state)
  const isPremium = useSpotifyStore((s) => s.isPremium)
  const currentTrack = useSpotifyStore((s) => s.currentTrack)
  const connect = useSpotifyStore((s) => s.connect)
  const disconnect = useSpotifyStore((s) => s.disconnect)
  const play = useSpotifyStore((s) => s.play)
  const pause = useSpotifyStore((s) => s.pause)
  const next = useSpotifyStore((s) => s.next)
  const previous = useSpotifyStore((s) => s.previous)
  const { durationMed } = useMotionConfig()

  // --- State 1: disconnected -----------------------------------------------
  if (state === 'disconnected') {
    return (
      <div
        data-testid="spotify-mini-disconnected"
        className="h-20 px-3 flex items-center gap-2"
      >
        <Music
          className="size-5 text-neutral-500 shrink-0"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => void connect()}
          className="text-sm text-neutral-300 hover:text-neutral-100 underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2"
          style={{ outlineColor: 'var(--color-accent)' }}
        >
          Connect Spotify
        </button>
      </div>
    )
  }

  // --- State 2: connecting -------------------------------------------------
  if (state === 'connecting') {
    return (
      <div
        data-testid="spotify-mini-connecting"
        className="h-20 px-3 flex items-center gap-2"
      >
        <div
          aria-hidden="true"
          className="size-4 rounded-full border-2 border-neutral-700 border-t-transparent animate-spin"
          style={{ borderTopColor: 'var(--color-accent)' }}
        />
        <span className="text-sm text-neutral-400">Connecting…</span>
      </div>
    )
  }

  // --- State 3: connected-idle --------------------------------------------
  if (state === 'connected-idle') {
    return (
      <div
        data-testid="spotify-mini-idle"
        className="h-20 px-3 flex items-center gap-2 group"
      >
        <div
          aria-hidden="true"
          className="size-12 rounded bg-neutral-800 shrink-0 flex items-center justify-center"
        >
          <Music className="size-5 text-neutral-600" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-neutral-400">Nothing playing</div>
          <div className="text-xs text-neutral-600 truncate">Play something in Spotify</div>
        </div>
        <ContextMenuTrigger onDisconnect={() => void disconnect()} />
      </div>
    )
  }

  // --- State 4/5/6: connected-playing, offline, no-premium overlay --------
  if (
    (state === 'connected-playing' || state === 'offline') &&
    currentTrack
  ) {
    const offline = state === 'offline'
    const premiumBlocked = isPremium === 'no'
    const isPlaying = currentTrack.isPlaying
    // play/pause toggle: when track.isPlaying flip to pause; else play.
    const onTogglePlayPause = isPlaying ? () => void pause() : () => void play()
    const playPauseLabel = isPlaying ? 'Pause' : 'Play'
    const PlayPauseIcon = isPlaying ? PauseIcon : PlayIcon

    return (
      <div
        data-testid={offline ? 'spotify-mini-offline' : 'spotify-mini-playing'}
        className="h-20 px-2 flex items-center gap-2"
        // Right-click opens the DropdownMenu via its trigger — we proxy that
        // onto the same context-menu component below.
      >
        {/* Album art — crossfade on URL change via AnimatePresence + key */}
        <div
          aria-hidden="true"
          className="size-12 rounded bg-neutral-800 shrink-0 relative overflow-hidden"
        >
          <AnimatePresence mode="popLayout">
            {currentTrack.albumArtUrl ? (
              <motion.img
                key={currentTrack.albumArtUrl}
                src={currentTrack.albumArtUrl}
                alt=""
                width={48}
                height={48}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durationMed }}
                className="absolute inset-0 size-12 object-cover"
              />
            ) : null}
          </AnimatePresence>
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs text-neutral-200 truncate">
            {currentTrack.name}
            {offline ? ' (offline)' : ''}
          </div>
          <div className="text-xs text-neutral-500 truncate">
            {currentTrack.artists.join(', ')}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <ControlButton
            onClick={() => void previous()}
            disabled={premiumBlocked}
            title={premiumBlocked ? PREMIUM_TOOLTIP : 'Previous'}
            ariaLabel="Previous"
            Icon={SkipBack}
          />
          <ControlButton
            onClick={onTogglePlayPause}
            disabled={premiumBlocked}
            title={premiumBlocked ? PREMIUM_TOOLTIP : playPauseLabel}
            ariaLabel={playPauseLabel}
            Icon={PlayPauseIcon}
          />
          <ControlButton
            onClick={() => void next()}
            disabled={premiumBlocked}
            title={premiumBlocked ? PREMIUM_TOOLTIP : 'Next'}
            ariaLabel="Next"
            Icon={SkipForward}
          />
          <ContextMenuTrigger onDisconnect={() => void disconnect()} />
        </div>
      </div>
    )
  }

  // Fallback — connected-playing/offline without a currentTrack is logically
  // idle. Render a minimal idle shell so we never produce null (the sidebar
  // height must stay stable). Reconcile() normally prevents this; kept as a
  // belt-and-suspenders guard for unexpected payloads.
  return (
    <div
      data-testid="spotify-mini-idle-fallback"
      className="h-20 px-3 flex items-center gap-2"
    >
      <div
        aria-hidden="true"
        className="size-12 rounded bg-neutral-800 shrink-0 flex items-center justify-center"
      >
        <Music className="size-5 text-neutral-600" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-neutral-500">—</div>
      </div>
      <ContextMenuTrigger onDisconnect={() => void disconnect()} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ControlButton — small transport button used for prev/play-pause/next.
// ---------------------------------------------------------------------------
interface ControlButtonProps {
  onClick: () => void
  disabled: boolean
  title: string
  ariaLabel: string
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
}

function ControlButton(props: ControlButtonProps): React.JSX.Element {
  const { onClick, disabled, title, ariaLabel, Icon } = props
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
      style={{ outlineColor: 'var(--color-accent)' }}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// ContextMenuTrigger — "More options" chevron → Radix DropdownMenu.
// NOTE: Radix DropdownMenu content lives in a Portal; it is NOT in the DOM
// until the trigger is clicked. Tests that assert on menu items MUST click
// the trigger first (see SpotifyMiniPlayer.test.tsx context-menu describe).
// ---------------------------------------------------------------------------
interface ContextMenuTriggerProps {
  onDisconnect: () => void
}

function ContextMenuTrigger(props: ContextMenuTriggerProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More options"
        className="p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2"
        style={{ outlineColor: 'var(--color-accent)' }}
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800">
        <DropdownMenuItem
          onClick={() => {
            // Going through the preload bridge → shell.openExternal avoids
            // Electron's default window.open handler spawning a blank
            // BrowserWindow alongside the Spotify app.
            void window.wiiwho.spotify.openApp()
          }}
          className="cursor-pointer"
        >
          Open Spotify app
        </DropdownMenuItem>
        <DropdownMenuItem onClick={props.onDisconnect} className="cursor-pointer">
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
