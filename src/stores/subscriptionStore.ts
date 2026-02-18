import { create } from 'zustand';
import {
  configureRevenueCat,
  identifyUser,
  logOutRevenueCat,
  checkEntitlement,
  getCustomerInfo,
  getOfferings,
  purchasePackage as purchasePackageService,
  restorePurchases as restorePurchasesService,
  presentPaywall as presentPaywallService,
  presentCustomerCenter as presentCustomerCenterService,
  syncSubscriptionToSupabase,
  onCustomerInfoUpdated,
  ENTITLEMENT_ID,
} from '../services/subscriptionService';
import { useAuthStore } from './authStore';

interface SubscriptionState {
  isPremium: boolean;
  offerings: any | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  identifyCurrentUser: () => Promise<void>;
  checkPremiumStatus: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: any) => Promise<{ error?: string }>;
  restorePurchases: () => Promise<{ error?: string }>;
  presentPaywall: () => Promise<{ error?: string }>;
  presentCustomerCenter: () => Promise<{ error?: string }>;
  handleLogout: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  isPremium: false,
  offerings: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      await configureRevenueCat();

      const user = useAuthStore.getState().user;
      if (user) {
        await identifyUser(user.id);
        const result = await getCustomerInfo();
        if (result.data) {
          const premium = checkEntitlement(result.data);
          set({ isPremium: premium });
        } else {
          set({ isPremium: checkEntitlement(null) });
        }
      }

      // Listen for real-time entitlement changes
      onCustomerInfoUpdated((info: any) => {
        const premium = checkEntitlement(info);
        set({ isPremium: premium });

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const subId =
            info?.entitlements?.active?.[ENTITLEMENT_ID]?.productIdentifier ?? null;
          syncSubscriptionToSupabase(currentUser.id, premium, subId);
        }
      });

      set({ isInitialized: true });
    } catch {
      set({ isInitialized: true, isPremium: checkEntitlement(null) });
    }
  },

  identifyCurrentUser: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    await identifyUser(user.id);
    await get().checkPremiumStatus();
  },

  checkPremiumStatus: async () => {
    const result = await getCustomerInfo();
    if (result.data) {
      set({ isPremium: checkEntitlement(result.data) });
    } else {
      set({ isPremium: checkEntitlement(null) });
    }
  },

  fetchOfferings: async () => {
    set({ isLoading: true });
    const result = await getOfferings();
    if (result.data) {
      set({ offerings: result.data });
    }
    set({ isLoading: false });
  },

  purchasePackage: async (pkg) => {
    set({ isLoading: true });
    const result = await purchasePackageService(pkg);
    set({ isLoading: false });

    if (result.error) {
      return { error: result.error };
    }

    if (result.data) {
      const premium = checkEntitlement(result.data);
      set({ isPremium: premium });

      const user = useAuthStore.getState().user;
      if (user && premium) {
        const subId =
          result.data.entitlements?.active?.[ENTITLEMENT_ID]?.productIdentifier ?? null;
        syncSubscriptionToSupabase(user.id, true, subId);
        useAuthStore.getState().refreshUser();
      }
    }

    return {};
  },

  restorePurchases: async () => {
    set({ isLoading: true });
    const result = await restorePurchasesService();
    set({ isLoading: false });

    if (result.error) {
      return { error: result.error };
    }

    if (result.data) {
      const premium = checkEntitlement(result.data);
      set({ isPremium: premium });

      const user = useAuthStore.getState().user;
      if (user) {
        const subId =
          result.data.entitlements?.active?.[ENTITLEMENT_ID]?.productIdentifier ?? null;
        syncSubscriptionToSupabase(user.id, premium, subId);
        useAuthStore.getState().refreshUser();
      }
    }

    return {};
  },

  presentPaywall: async () => {
    const result = await presentPaywallService();
    if (result.error) return { error: result.error };
    // After paywall dismisses, refresh premium status
    await get().checkPremiumStatus();
    return {};
  },

  presentCustomerCenter: async () => {
    const result = await presentCustomerCenterService();
    if (result.error) return { error: result.error };
    // After customer center closes, refresh status (user may have cancelled)
    await get().checkPremiumStatus();
    return {};
  },

  handleLogout: async () => {
    await logOutRevenueCat();
    set({ isPremium: false, offerings: null });
  },
}));
