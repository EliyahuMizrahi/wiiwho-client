/**
 * activeSection store — which section the main area is showing.
 *
 * D-02: Play is the default; Cosmetics is the only other section at v0.1.
 *
 * Settings is a MODAL (not a section) — the gear at the sidebar bottom toggles
 * it via useSettingsStore.setModalOpen(). Account is reachable only from the
 * top-right AccountBadge dropdown and the Settings modal's Account pane (E-03);
 * it deliberately does NOT appear here as a top-level sidebar row.
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-CONTEXT.md §D-02 (row order)
 *         and §E-03 (Account reachability).
 */
import { create } from 'zustand'

export type ActiveSection = 'play' | 'cosmetics'

export interface ActiveSectionStore {
  section: ActiveSection
  setSection: (s: ActiveSection) => void
}

export const useActiveSectionStore = create<ActiveSectionStore>((set) => ({
  section: 'play',
  setSection: (section) => set({ section })
}))
