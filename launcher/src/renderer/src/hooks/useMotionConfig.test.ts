/**
 * @vitest-environment jsdom
 *
 * Plan 04-01 Task 3 — useMotionConfig hook tests.
 *
 * Verifies the resolution table:
 *   user='system' + OS reduce=off → reduced=false, durations normal
 *   user='system' + OS reduce=on  → reduced=true,  durations=0
 *   user='on'     + OS reduce=off → reduced=true   (user override wins)
 *   user='off'    + OS reduce=on  → reduced=false  (user override wins)
 *   reduced=true  returns { duration: 0 } for spring (not the spring config)
 *   reduced=false returns SPRING_STANDARD { stiffness: 300, damping: 30, mass: 1 }
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, renderHook, act } from '@testing-library/react'
import { useMotionConfig } from './useMotionConfig'
import { useSettingsStore } from '../stores/settings'

// Mock motion/react's useReducedMotion — controls OS side.
let mockSystemReduce = false
vi.mock('motion/react', () => ({
  useReducedMotion: (): boolean => mockSystemReduce
}))

describe('useMotionConfig', () => {
  afterEach(() => {
    cleanup()
    mockSystemReduce = false
    useSettingsStore.setState({
      theme: { accent: '#16e0ee', reduceMotion: 'system' }
    } as never)
  })

  it('user=system + OS reduce=off → reduced=false, durations normal', () => {
    mockSystemReduce = false
    act(() =>
      useSettingsStore.setState({
        theme: { accent: '#16e0ee', reduceMotion: 'system' }
      } as never)
    )
    const { result } = renderHook(() => useMotionConfig())
    expect(result.current.reduced).toBe(false)
    expect(result.current.durationFast).toBe(0.12)
    expect(result.current.durationMed).toBe(0.2)
    expect(result.current.durationSlow).toBe(0.32)
  })

  it('user=system + OS reduce=on → reduced=true, durations=0', () => {
    mockSystemReduce = true
    act(() =>
      useSettingsStore.setState({
        theme: { accent: '#16e0ee', reduceMotion: 'system' }
      } as never)
    )
    const { result } = renderHook(() => useMotionConfig())
    expect(result.current.reduced).toBe(true)
    expect(result.current.durationFast).toBe(0)
    expect(result.current.durationMed).toBe(0)
    expect(result.current.durationSlow).toBe(0)
  })

  it('user=on + OS reduce=off → reduced=true (user override wins)', () => {
    mockSystemReduce = false
    act(() =>
      useSettingsStore.setState({
        theme: { accent: '#16e0ee', reduceMotion: 'on' }
      } as never)
    )
    const { result } = renderHook(() => useMotionConfig())
    expect(result.current.reduced).toBe(true)
    expect(result.current.durationMed).toBe(0)
  })

  it('user=off + OS reduce=on → reduced=false (user override wins)', () => {
    mockSystemReduce = true
    act(() =>
      useSettingsStore.setState({
        theme: { accent: '#16e0ee', reduceMotion: 'off' }
      } as never)
    )
    const { result } = renderHook(() => useMotionConfig())
    expect(result.current.reduced).toBe(false)
    expect(result.current.durationMed).toBe(0.2)
  })

  it('reduced=true returns { duration: 0 } for spring (not the spring config)', () => {
    mockSystemReduce = true
    act(() =>
      useSettingsStore.setState({
        theme: { accent: '#16e0ee', reduceMotion: 'system' }
      } as never)
    )
    const { result } = renderHook(() => useMotionConfig())
    expect(result.current.spring).toEqual({ duration: 0 })
  })

  it('reduced=false returns SPRING_STANDARD { stiffness: 300, damping: 30, mass: 1 }', () => {
    mockSystemReduce = false
    act(() =>
      useSettingsStore.setState({
        theme: { accent: '#16e0ee', reduceMotion: 'off' }
      } as never)
    )
    const { result } = renderHook(() => useMotionConfig())
    expect(result.current.spring).toMatchObject({
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 1
    })
  })
})
