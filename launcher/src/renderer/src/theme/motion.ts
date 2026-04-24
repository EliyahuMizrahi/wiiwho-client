/**
 * Motion duration + easing constants.
 *
 * Source of truth: global.css @theme block. This file duplicates numbers
 * because framer-motion (motion/react) takes seconds, not CSS `var()` strings.
 * Keep in sync — comments document the mirrored CSS var.
 */
export const DURATION_FAST = 0.12 as const // mirrors --duration-fast: 120ms
export const DURATION_MED = 0.2 as const // mirrors --duration-med:  200ms
export const DURATION_SLOW = 0.32 as const // mirrors --duration-slow: 320ms

export const EASE_EMPHASIZED = [0.2, 0, 0, 1] as const // mirrors --ease-emphasized
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const // mirrors --ease-standard

export const SPRING_STANDARD = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1
} as const
