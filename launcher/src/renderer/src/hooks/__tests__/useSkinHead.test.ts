/**
 * @vitest-environment jsdom
 *
 * useSkinHead — mc-heads.net URL + placeholder fallback hook.
 *
 * Contract (UI-SPEC §Skin avatar, D-14):
 *   - src = `https://mc-heads.net/avatar/{uuid}/32` when uuid is provided
 *   - isPlaceholder = true when uuid is missing OR a previous fetch failed for this uuid
 *   - initial = username[0].toUpperCase() | '?' (empty/undefined)
 *   - markFetchFailed(): per-uuid failure memo (session-scoped; no disk cache in v0.1)
 *
 * Environment: jsdom (docblock pragma above — vitest 4 pattern locked in Plan 02-04).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSkinHead, __test__ } from '../useSkinHead'

beforeEach(() => {
  __test__.resetFailed()
})

describe('useSkinHead', () => {
  it('returns mc-heads.net URL when uuid provided', () => {
    const { result } = renderHook(() => useSkinHead('abc123', 'Alice'))
    expect(result.current.src).toBe('https://mc-heads.net/avatar/abc123/32')
    expect(result.current.isPlaceholder).toBe(false)
    expect(result.current.initial).toBe('A')
  })

  it('returns placeholder when uuid is undefined', () => {
    const { result } = renderHook(() => useSkinHead(undefined, 'Alice'))
    expect(result.current.src).toBeNull()
    expect(result.current.isPlaceholder).toBe(true)
    expect(result.current.initial).toBe('A')
  })

  it('initial is "?" when username is undefined', () => {
    const { result } = renderHook(() => useSkinHead(undefined, undefined))
    expect(result.current.initial).toBe('?')
  })

  it('initial is "?" when username is empty string', () => {
    const { result } = renderHook(() => useSkinHead('abc', ''))
    expect(result.current.initial).toBe('?')
  })

  it('uppercases lowercase first char', () => {
    const { result } = renderHook(() => useSkinHead('abc', 'alice'))
    expect(result.current.initial).toBe('A')
  })

  it('markFetchFailed → isPlaceholder becomes true for same uuid', () => {
    const { result, rerender } = renderHook(
      ({ uuid, name }: { uuid: string; name: string }) =>
        useSkinHead(uuid, name),
      { initialProps: { uuid: 'abc', name: 'Alice' } }
    )
    expect(result.current.isPlaceholder).toBe(false)
    act(() => {
      result.current.markFetchFailed()
    })
    rerender({ uuid: 'abc', name: 'Alice' })
    expect(result.current.isPlaceholder).toBe(true)
    expect(result.current.src).toBeNull()
  })

  it('markFetchFailed is scoped per uuid', () => {
    const { result, rerender } = renderHook(
      ({ uuid, name }: { uuid: string; name: string }) =>
        useSkinHead(uuid, name),
      { initialProps: { uuid: 'abc', name: 'Alice' } }
    )
    act(() => {
      result.current.markFetchFailed()
    })
    rerender({ uuid: 'xyz', name: 'Bob' })
    // different uuid — fresh, not marked failed
    expect(result.current.isPlaceholder).toBe(false)
    expect(result.current.src).toBe('https://mc-heads.net/avatar/xyz/32')
  })
})
