/**
 * Reduced-motion resolver. Combines OS prefers-reduced-motion (via motion/react
 * useReducedMotion hook) with the user override in settings.theme.reduceMotion.
 *
 * Resolution table:
 *   user='on'     → reduced = true
 *   user='off'    → reduced = false
 *   user='system' → reduced = OS prefers-reduced-motion value
 *
 * When reduced=true, all returned durations collapse to 0 and the spring
 * flattens to `{ duration: 0 }` — pass any of these as-is to framer-motion
 * <motion.*> `transition` props and UI will instantly settle with no
 * animation, matching UI-03 / WCAG 2.3.3.
 *
 * Source: .planning/phases/04-launcher-ui-polish/04-RESEARCH.md §Motion Stack
 *   → Pattern E.
 */
import { useReducedMotion } from 'motion/react'
import { useSettingsStore } from '../stores/settings'
import {
  DURATION_FAST,
  DURATION_MED,
  DURATION_SLOW,
  SPRING_STANDARD
} from '../theme/motion'

export interface MotionConfig {
  reduced: boolean
  durationFast: number
  durationMed: number
  durationSlow: number
  spring: typeof SPRING_STANDARD | { duration: number }
}

export function useMotionConfig(): MotionConfig {
  const systemReduce = useReducedMotion() ?? false
  const userOverride = useSettingsStore((s) => s.theme.reduceMotion)
  const reduced =
    userOverride === 'on' ? true : userOverride === 'off' ? false : systemReduce
  return {
    reduced,
    durationFast: reduced ? 0 : DURATION_FAST,
    durationMed: reduced ? 0 : DURATION_MED,
    durationSlow: reduced ? 0 : DURATION_SLOW,
    spring: reduced ? { duration: 0 } : SPRING_STANDARD
  }
}
