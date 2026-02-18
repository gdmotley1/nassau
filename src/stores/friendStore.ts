import { create } from 'zustand';
import {
  fetchFriends as fetchFriendsService,
  addFriendByCode as addFriendByCodeService,
  removeFriend as removeFriendService,
} from '../services/friendService';
import type { FriendWithProfile } from '../types';
import { useAuthStore } from './authStore';

interface FriendState {
  friends: FriendWithProfile[];
  isLoading: boolean;

  fetchFriends: () => Promise<void>;
  addFriend: (code: string) => Promise<{ friendName?: string; error?: string }>;
  removeFriend: (friendUserId: string) => Promise<{ error?: string }>;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  isLoading: false,

  fetchFriends: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ isLoading: true });
    const result = await fetchFriendsService(user.id);
    set({
      friends: result.data,
      isLoading: false,
    });
  },

  addFriend: async (code) => {
    const result = await addFriendByCodeService(code);
    if (result.error) return { error: result.error };

    // Refresh the friends list
    await get().fetchFriends();
    return { friendName: result.friendName };
  },

  removeFriend: async (friendUserId) => {
    const result = await removeFriendService(friendUserId);
    if (result.error) return { error: result.error };

    // Optimistically remove from local state
    set((state) => ({
      friends: state.friends.filter((f) => f.userId !== friendUserId),
    }));
    return {};
  },
}));
