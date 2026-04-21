/**
 * useSkinHead — mc-heads.net avatar URL + placeholder fallback.
 *
 * Per UI-SPEC §Skin avatar contract (D-14): `https://mc-heads.net/avatar/{uuid}/32`.
 *
 * Disk cache is deferred to v0.2+: the Phase 1 preload IPC surface is frozen
 * (5 top-level keys, 13 channels) and cannot be extended in this phase; a
 * renderer-only in-memory cache by URL is redundant with the browser HTTP
 * cache for identical GETs, so v0.1 simply re-fetches per session.
 *
 * On fetch failure the consumer (the <img onError>) calls markFetchFailed and
 * the hook returns the initial-placeholder for the rest of the session for
 * THAT uuid — so transient 5xx doesn't flap the UI between avatar and initial.
 *
 * Source: .planning/phases/02-microsoft-authentication/02-UI-SPEC.md §Skin avatar / D-14.
 */

import { useEffect, useState } from 'react'

// Module-level per-uuid failure memo — session-scoped (cleared only on full
// page reload / tests via __test__.resetFailed). Not a disk cache; just a
// flag that says "we tried, it failed, show placeholder for this uuid".
const failedUuids = new Set<string>()

export interface SkinHeadView {
  /** mc-heads.net URL, or null when there's no uuid or fetch has failed. */
  src: string | null
  /** true when the consumer should render the initial placeholder. */
  isPlaceholder: boolean
  /** Uppercase first char of username, or '?' when username is missing/empty. */
  initial: string
  /**
   * Invoked by the consumer's `<img onError>` handler. Flags this uuid as
   * failed for the rest of the session so re-renders return the placeholder.
   */
  markFetchFailed: () => void
}

export function useSkinHead(
  uuid: string | undefined,
  username: string | undefined
): SkinHeadView {
  const [failed, setFailed] = useState<boolean>(() =>
    uuid ? failedUuids.has(uuid) : false
  )

  // Sync local `failed` flag with module-level memo whenever uuid changes.
  // On uuid change: if the new uuid was already marked failed (e.g. user
  // logged out + back in), surface placeholder immediately; otherwise reset.
  useEffect(() => {
    if (uuid && failedUuids.has(uuid)) {
      setFailed(true)
    } else {
      setFailed(false)
    }
  }, [uuid])

  const initial = deriveInitial(username)

  const markFetchFailed = (): void => {
    if (uuid) failedUuids.add(uuid)
    setFailed(true)
  }

  if (!uuid || failed) {
    return {
      src: null,
      isPlaceholder: true,
      initial,
      markFetchFailed
    }
  }

  return {
    src: `https://mc-heads.net/avatar/${uuid}/32`,
    isPlaceholder: false,
    initial,
    markFetchFailed
  }
}

function deriveInitial(username: string | undefined): string {
  if (!username || username.length === 0) return '?'
  return username[0]!.toUpperCase()
}

// Exposed for tests — resets the module-level failure memo.
export const __test__ = {
  resetFailed: (): void => {
    failedUuids.clear()
  }
}
