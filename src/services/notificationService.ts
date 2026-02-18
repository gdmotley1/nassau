import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Configure how notifications are displayed when the app is in the foreground.
 * Must be called at module scope (outside component) in App.tsx.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Request notification permissions, get the Expo push token,
 * and store it in Supabase. Safe to call multiple times.
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<{ token?: string; error?: string }> {
  try {
    // Check current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return {};
    }

    // Get the Expo push token (works with Expo Go)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      return { error: 'Missing EAS project ID' };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    // Store token in Supabase
    const { error } = await supabase
      .from('users')
      .update({ push_token: token } as any)
      .eq('id', userId);

    if (error) {
      return { error: error.message };
    }

    return { token };
  } catch (e: any) {
    return { error: e.message ?? 'Failed to register for notifications' };
  }
}

/**
 * Clear the push token from Supabase (called on sign-out).
 */
export async function clearPushToken(userId: string): Promise<void> {
  await supabase
    .from('users')
    .update({ push_token: null } as any)
    .eq('id', userId);
}
