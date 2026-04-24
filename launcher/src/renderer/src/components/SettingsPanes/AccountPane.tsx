/**
 * Settings modal → Account pane — D-10.
 *
 * Contents: 64px skin-head preview (useSkinHead) + username + full UUID
 * (break-all, no truncation) + Sign out action.
 *
 * Sign out follows Phase 2 D-15 — instant, no confirm dialog. Logout is
 * cheap because silent-refresh-on-next-launch restores the session; a
 * confirm would add friction without safety value. This pane mirrors the
 * AccountBadge dropdown's D-15 behaviour.
 */
import type React from 'react'
import { useAuthStore } from '../../stores/auth'
import { useSkinHead } from '../../hooks/useSkinHead'

export function AccountPane(): React.JSX.Element {
  const username = useAuthStore((s) => s.username)
  const uuid = useAuthStore((s) => s.uuid)
  const logout = useAuthStore((s) => s.logout)
  const skin = useSkinHead(uuid, username)

  if (!username || !uuid) {
    return (
      <div data-testid="account-pane" className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-neutral-200">Account</h2>
        <p className="text-sm text-neutral-500">Not signed in.</p>
      </div>
    )
  }

  return (
    <div data-testid="account-pane" className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-neutral-200">Account</h2>

      <div className="flex items-center gap-4">
        {!skin.isPlaceholder && skin.src ? (
          <img
            src={skin.src}
            alt=""
            width={64}
            height={64}
            className="size-16 rounded-lg bg-neutral-800"
            onError={() => skin.markFetchFailed()}
          />
        ) : (
          <div
            aria-hidden="true"
            className="size-16 rounded-lg bg-neutral-700 flex items-center justify-center text-2xl text-neutral-200"
          >
            {skin.initial}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="text-lg font-semibold text-neutral-200">{username}</div>
          <div
            className="text-sm text-neutral-500 break-all"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {uuid}
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => void logout()}
          className="px-4 py-2 text-sm rounded bg-neutral-800 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
