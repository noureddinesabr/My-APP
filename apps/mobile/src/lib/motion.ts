import { ReduceMotion, type WithSpringConfig } from 'react-native-reanimated';

/**
 * Spring presets (mass–stiffness–damping) used instead of fixed-duration easings.
 * All of them follow the system "Reduce motion" setting (they jump to the end state).
 */
export const Springs = {
  /** Button and card press: quick, barely overshoots. */
  press: { mass: 0.7, stiffness: 200, damping: 18, reduceMotion: ReduceMotion.System },
  /** Sheets and drawers following the finger, then settling. */
  sheet: { mass: 1, stiffness: 180, damping: 20, reduceMotion: ReduceMotion.System },
  /** Toasts and callouts arriving: a small, lively overshoot. */
  pop: { mass: 0.9, stiffness: 170, damping: 15, reduceMotion: ReduceMotion.System },
  /** Headers and docks sliding in and out on scroll. */
  bar: { mass: 0.8, stiffness: 150, damping: 20, reduceMotion: ReduceMotion.System },
} satisfies Record<string, WithSpringConfig>;
