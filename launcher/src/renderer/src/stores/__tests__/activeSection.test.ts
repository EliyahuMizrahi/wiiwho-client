/**
 * @vitest-environment jsdom
 *
 * activeSection store — Plan 04-02 Task 1.
 *
 * Drives the main-area section switch (Play ↔ Cosmetics). Settings is a
 * modal (not a section) and Account lives only in the AccountBadge
 * dropdown + Settings modal Account pane (E-03) — neither belongs here.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { useActiveSectionStore } from '../activeSection'

describe('activeSection store', () => {
  afterEach(() => {
    cleanup()
    // Reset between tests so one test's mutation doesn't leak to the next.
    useActiveSectionStore.setState({ section: 'play' })
  })

  it('default section is "play"', () => {
    expect(useActiveSectionStore.getState().section).toBe('play')
  })

  it('setSection swaps to cosmetics and back', () => {
    useActiveSectionStore.getState().setSection('cosmetics')
    expect(useActiveSectionStore.getState().section).toBe('cosmetics')
    useActiveSectionStore.getState().setSection('play')
    expect(useActiveSectionStore.getState().section).toBe('play')
  })
})
