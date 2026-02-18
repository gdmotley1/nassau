import * as Haptics from 'expo-haptics';

/**
 * Light haptic - for button taps, toggles, tab switches
 */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Medium haptic - for score entry, payment marks, game creation
 */
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Heavy haptic - for major actions
 */
export function hapticHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/**
 * Success haptic - for wins, completions, subscriptions
 */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Error haptic - for losses, invalid input, errors
 */
export function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Warning haptic - for destructive confirms, unusual scores
 */
export function hapticWarning() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/**
 * Win celebration - triple light tap
 */
export async function hapticWinCelebration() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await new Promise((r) => setTimeout(r, 80));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await new Promise((r) => setTimeout(r, 80));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Birdie - double success tap
 */
export async function hapticBirdie() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  await new Promise((r) => setTimeout(r, 100));
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Eagle - triple tap with heavy impact
 */
export async function hapticEagle() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  await new Promise((r) => setTimeout(r, 80));
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  await new Promise((r) => setTimeout(r, 80));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/**
 * Bogey - warning notification
 */
export function hapticBogey() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/**
 * Double bogey+ - double error notification
 */
export async function hapticDoubleBogey() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  await new Promise((r) => setTimeout(r, 100));
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
