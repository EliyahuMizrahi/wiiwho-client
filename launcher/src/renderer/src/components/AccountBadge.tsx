/**
 * AccountBadge (D-13, D-14, D-15 — UI-SPEC §AccountBadge).
 *
 * Top-right of Play-forward layout when logged-in.
 *   - 32×32 circular skin head via mc-heads.net (or initial placeholder on error)
 *   - Username (truncated to ~16 chars via CSS max-w-[120px] + truncate)
 *   - ChevronDown caret
 *
 * Click opens a DropdownMenu:
 *   - Label row: username + full UUID (text-xs muted)
 *   - Separator
 *   - Log out action — INSTANT, no confirm (UI-SPEC D-15 — logout is cheap
 *     because silent-refresh-on-next-launch restores the session if the user
 *     hasn't revoked the refresh token; a confirm dialog is friction without
 *     safety value).
 *
 * Source: .planning/phases/02-microsoft-authentication/02-UI-SPEC.md §AccountBadge
 */

import type React from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import { useSkinHead } from '../hooks/useSkinHead'

export function AccountBadge(): React.JSX.Element | null {
  const username = useAuthStore((s) => s.username)
  const uuid = useAuthStore((s) => s.uuid)
  const logout = useAuthStore((s) => s.logout)
  // Plan 04-02 D-06, D-11 — "Account settings" menu item deep-links into
  // the Settings modal's Account pane. setOpenPane is atomic (Pitfall 8):
  // one store update sets openPane='account' AND modalOpen=true.
  const setOpenPane = useSettingsStore((s) => s.setOpenPane)
  const skin = useSkinHead(uuid, username)

  if (!username || !uuid) return null

  // Tooltip-surrogate for the avatar — native title attribute is sufficient
  // for v0.1; a custom Tooltip component is not in scope (UI-SPEC defers).
  const shortUuid = `${uuid.slice(0, 8)}…`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${username}`}
        title={shortUuid}
        className="inline-flex items-center gap-2 rounded-full px-2 py-1 hover:ring-2 hover:ring-[#16e0ee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16e0ee] transition-[box-shadow] duration-150"
      >
        {!skin.isPlaceholder && skin.src ? (
          <img
            src={skin.src}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full bg-neutral-800"
            onError={() => skin.markFetchFailed()}
          />
        ) : (
          <div
            aria-hidden="true"
            className="size-8 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-normal text-neutral-200"
          >
            {skin.initial}
          </div>
        )}
        <span className="text-sm font-normal text-neutral-200 truncate max-w-[120px]">
          {username}
        </span>
        <ChevronDown className="size-4 text-neutral-500" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="bg-neutral-900 border-neutral-800"
      >
        <DropdownMenuLabel className="text-sm font-normal text-neutral-200">
          <div>{username}</div>
          <div className="text-xs font-normal text-neutral-500 break-all">
            {uuid}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-neutral-800" />
        <DropdownMenuItem
          onClick={() => setOpenPane('account')}
          className="text-sm font-normal cursor-pointer"
        >
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-neutral-800" />
        <DropdownMenuItem
          onClick={() => void logout()}
          className="text-sm font-normal cursor-pointer"
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
