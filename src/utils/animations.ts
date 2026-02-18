import {
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  type WithSpringConfig,
} from 'react-native-reanimated';

// Spring configurations matching our design system
export const springs = {
  snappy: {
    damping: 15,
    stiffness: 150,
    mass: 0.5,
  } satisfies WithSpringConfig,

  responsive: {
    damping: 18,
    stiffness: 120,
    mass: 0.8,
  } satisfies WithSpringConfig,

  bouncy: {
    damping: 10,
    stiffness: 100,
    mass: 0.6,
  } satisfies WithSpringConfig,

  gentle: {
    damping: 20,
    stiffness: 80,
    mass: 1.0,
  } satisfies WithSpringConfig,

  slow: {
    damping: 25,
    stiffness: 60,
    mass: 1.2,
  } satisfies WithSpringConfig,

  dramatic: {
    damping: 8,
    stiffness: 200,
    mass: 0.5,
  } satisfies WithSpringConfig,
};

/**
 * Press animation: scale down on touch, bounce back on release.
 * Use this for every tappable element.
 */
export function pressScale(pressed: boolean) {
  'worklet';
  return withSpring(pressed ? 0.97 : 1, springs.snappy);
}

/**
 * Score entry bounce: number enters with overshoot
 */
export function scoreBounce() {
  'worklet';
  return withSequence(
    withSpring(1.2, springs.bouncy),
    withSpring(1.0, springs.bouncy)
  );
}

/**
 * Stagger delay for list items entering
 */
export function staggerDelay(index: number, baseDelay: number = 60) {
  return Math.min(index * baseDelay, 300); // Cap at 5 items
}

/**
 * Fade in with slide up (for list items)
 */
export function fadeInUp(delay: number = 0) {
  return {
    opacity: withDelay(delay, withTiming(1, { duration: 300 })),
    translateY: withDelay(delay, withSpring(0, springs.responsive)),
  };
}

/**
 * Shake sequence for bogey/double bogey reactions
 */
export function shakeSequence() {
  'worklet';
  return withSequence(
    withTiming(-10, { duration: 50 }),
    withTiming(10, { duration: 50 }),
    withTiming(-6, { duration: 40 }),
    withTiming(6, { duration: 40 }),
    withTiming(-3, { duration: 30 }),
    withTiming(0, { duration: 30 }),
  );
}

/**
 * Pulse loop for attention-grabbing elements
 */
export function pulseLoop() {
  'worklet';
  return withRepeat(
    withSequence(
      withSpring(1.06, springs.gentle),
      withSpring(1.0, springs.gentle),
    ),
    -1,
    true,
  );
}

/**
 * Money counter easing (fast start, slow end)
 */
export const moneyCounterEasing = Easing.out(Easing.cubic);
