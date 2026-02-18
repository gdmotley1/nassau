import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { registerForPushNotifications, clearPushToken } from '../services/notificationService';
import { useSubscriptionStore } from './subscriptionStore';
import type { UserRow } from '../types';

interface AuthState {
  user: UserRow | null;
  session: { access_token: string } | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserRow>) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({
          session: { access_token: session.access_token },
          user: userRow ?? null,
          isLoading: false,
          isInitialized: true,
        });

        // Register for push notifications (fire-and-forget)
        if (userRow) {
          registerForPushNotifications(userRow.id).catch(() => {});
        }
      } else {
        set({ isLoading: false, isInitialized: true });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ user: null, session: null });
        } else if (session?.user) {
          const { data: userRow } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          set({
            session: { access_token: session.access_token },
            user: userRow ?? null,
          });

          // Register for push notifications on auth change
          if (userRow) {
            registerForPushNotifications(userRow.id).catch(() => {});
          }
        }
      });
    } catch {
      set({ isLoading: false, isInitialized: true });
    }
  },

  signUp: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        set({ isLoading: false });
        return { error: error.message };
      }

      if (data.user && data.session) {
        // Create user row in our users table
        const { error: insertError } = await supabase.from('users').insert({
          id: data.user.id,
          email,
          name,
          phone: null,
          venmo_username: null,
          handicap: null,
          subscription_status: 'free' as const,
          subscription_id: null,
          push_token: null,
        } as any);

        if (insertError) {
          set({ isLoading: false });
          return { error: insertError.message };
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          user: userRow ?? null,
          session: { access_token: data.session.access_token },
          isLoading: false,
        });

        // Register for push notifications after sign-up
        if (userRow) {
          registerForPushNotifications(userRow.id).catch(() => {});
          useSubscriptionStore.getState().identifyCurrentUser().catch(() => {});
        }

        return {};
      }

      // No session means email confirmation is required
      if (data.user && !data.session) {
        set({ isLoading: false });
        return { error: 'Check your email to confirm your account' };
      }

      set({ isLoading: false });
      return { error: 'Sign up failed. Please try again.' };
    } catch (e: any) {
      set({ isLoading: false });
      return { error: e.message ?? 'Something went wrong' };
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ isLoading: false });
        return { error: error.message };
      }

      if (data.user) {
        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        set({
          user: userRow ?? null,
          session: { access_token: data.session.access_token },
          isLoading: false,
        });

        // Register for push notifications after sign-in
        if (userRow) {
          registerForPushNotifications(userRow.id).catch(() => {});
          useSubscriptionStore.getState().identifyCurrentUser().catch(() => {});
        }
      }

      return {};
    } catch (e: any) {
      set({ isLoading: false });
      return { error: e.message ?? 'Something went wrong' };
    }
  },

  signOut: async () => {
    const { user } = get();
    if (user) {
      await clearPushToken(user.id);
    }
    await useSubscriptionStore.getState().handleLogout();
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: 'Not logged in' };

    try {
      const { error } = await supabase
        .from('users')
        .update(updates as any)
        .eq('id', user.id);

      if (error) return { error: error.message };

      // Log handicap change to handicap_history for Ace analytics
      // (The DB trigger also does this, but logging client-side is a safety net
      //  in case the trigger isn't deployed yet)
      if (
        updates.handicap !== undefined &&
        updates.handicap !== null &&
        updates.handicap !== user.handicap
      ) {
        Promise.resolve(
          supabase
            .from('handicap_history')
            .insert({
              user_id: user.id,
              handicap: updates.handicap,
              source: 'manual',
            } as any),
        ).catch(() => {}); // fire-and-forget
      }

      set({ user: { ...user, ...updates } as UserRow });
      return {};
    } catch (e: any) {
      return { error: e.message ?? 'Something went wrong' };
    }
  },

  resetPassword: async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { error: error.message };
      return {};
    } catch (e: any) {
      return { error: e.message ?? 'Something went wrong' };
    }
  },

  refreshUser: async () => {
    const { user } = get();
    if (!user) return;

    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userRow) {
      set({ user: userRow });
    }
  },
}));
