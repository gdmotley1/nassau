import Constants from 'expo-constants';
import { supabase } from './supabase';

const IS_EXPO_GO = Constants.appOwnership === 'expo';
const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
export const ENTITLEMENT_ID = 'Nassau Pro';

// Toggle this to test premium UI in Expo Go (where native RC SDK is unavailable)
export const DEV_PREMIUM_OVERRIDE = false;

// Lazy-load the SDK so Expo Go doesn't crash on import
let Purchases: typeof import('react-native-purchases').default | null = null;

async function getSDK() {
  if (IS_EXPO_GO) return null;
  if (!Purchases) {
    const mod = await import('react-native-purchases');
    Purchases = mod.default;
  }
  return Purchases;
}

/** Configure RevenueCat SDK. Call once on app start. */
export async function configureRevenueCat(): Promise<void> {
  const sdk = await getSDK();
  if (!sdk) return;

  if (__DEV__) {
    const { LOG_LEVEL } = await import('react-native-purchases');
    sdk.setLogLevel(LOG_LEVEL.DEBUG);
  }

  sdk.configure({ apiKey: RC_API_KEY });
}

/** Identify the current user to RevenueCat (call after login). */
export async function identifyUser(userId: string): Promise<{ error?: string }> {
  const sdk = await getSDK();
  if (!sdk) return {};

  try {
    await sdk.logIn(userId);
    return {};
  } catch (e: any) {
    return { error: e.message ?? 'Failed to identify user' };
  }
}

/** Log out from RevenueCat (call on sign out). */
export async function logOutRevenueCat(): Promise<void> {
  const sdk = await getSDK();
  if (!sdk) return;

  try {
    await sdk.logOut();
  } catch {
    // Ignore -- user may not have been identified
  }
}

/** Check if customer info has active entitlement. */
export function checkEntitlement(customerInfo: any | null): boolean {
  if (IS_EXPO_GO) return DEV_PREMIUM_OVERRIDE;
  if (!customerInfo) return false;
  return customerInfo.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
}

/** Fetch current customer info. */
export async function getCustomerInfo(): Promise<{
  data?: any;
  error?: string;
}> {
  if (IS_EXPO_GO) return { data: null };

  const sdk = await getSDK();
  if (!sdk) return { data: null };

  try {
    const info = await sdk.getCustomerInfo();
    return { data: info };
  } catch (e: any) {
    return { error: e.message ?? 'Failed to fetch customer info' };
  }
}

/** Fetch available offerings (products/prices). */
export async function getOfferings(): Promise<{
  data?: any;
  error?: string;
}> {
  if (IS_EXPO_GO) return { data: null };

  const sdk = await getSDK();
  if (!sdk) return { data: null };

  try {
    const offerings = await sdk.getOfferings();
    return { data: offerings };
  } catch (e: any) {
    return { error: e.message ?? 'Failed to fetch offerings' };
  }
}

/** Purchase a package. Returns updated customer info. */
export async function purchasePackage(pkg: any): Promise<{
  data?: any;
  error?: string;
}> {
  if (IS_EXPO_GO) return { error: 'Purchases not available in Expo Go' };

  const sdk = await getSDK();
  if (!sdk) return { error: 'SDK not available' };

  try {
    const { customerInfo } = await sdk.purchasePackage(pkg);
    return { data: customerInfo };
  } catch (e: any) {
    if (e.userCancelled) return { error: 'cancelled' };
    return { error: e.message ?? 'Purchase failed' };
  }
}

/** Restore purchases. Returns updated customer info. */
export async function restorePurchases(): Promise<{
  data?: any;
  error?: string;
}> {
  if (IS_EXPO_GO) return { data: null };

  const sdk = await getSDK();
  if (!sdk) return { data: null };

  try {
    const info = await sdk.restorePurchases();
    return { data: info };
  } catch (e: any) {
    return { error: e.message ?? 'Restore failed' };
  }
}

/** Present RevenueCat pre-built paywall if user lacks entitlement. Returns result. */
export async function presentPaywall(): Promise<{
  result?: string;
  error?: string;
}> {
  if (IS_EXPO_GO) return { error: 'Paywalls not available in Expo Go' };

  try {
    const RCUI = (await import('react-native-purchases-ui')).default;
    const result = await RCUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
      displayCloseButton: true,
    });
    return { result: String(result) };
  } catch (e: any) {
    return { error: e.message ?? 'Failed to present paywall' };
  }
}

/** Present RevenueCat Customer Center for subscription management. */
export async function presentCustomerCenter(): Promise<{ error?: string }> {
  if (IS_EXPO_GO) return { error: 'Customer Center not available in Expo Go' };

  try {
    const RCUI = (await import('react-native-purchases-ui')).default;
    await RCUI.presentCustomerCenter();
    return {};
  } catch (e: any) {
    return { error: e.message ?? 'Failed to open Customer Center' };
  }
}

/** Sync subscription status to Supabase users table. */
export async function syncSubscriptionToSupabase(
  userId: string,
  isPremium: boolean,
  subscriptionId: string | null,
): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({
        subscription_status: isPremium ? 'premium' : 'free',
        subscription_id: subscriptionId,
      } as any)
      .eq('id', userId);
  } catch {
    // Fire-and-forget -- RevenueCat is the source of truth
  }
}

/** Register a listener for customer info changes. Returns unsubscribe function. */
export function onCustomerInfoUpdated(
  callback: (info: any) => void,
): () => void {
  if (IS_EXPO_GO) return () => {};

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RC = require('react-native-purchases').default;
    const listener = RC.addCustomerInfoUpdateListener(callback);
    return () => listener.remove();
  } catch {
    return () => {};
  }
}
