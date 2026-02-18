import { supabase } from './supabase';
import type { FriendWithProfile } from '../types';

// ─── Fetch Friends List ──────────────────────────────────────

export async function fetchFriends(
  userId: string,
): Promise<{ data: FriendWithProfile[]; error?: string }> {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, friend_id, created_at, users!friendships_friend_id_fkey(name, handicap, venmo_username, friend_code)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  const friends: FriendWithProfile[] = (data ?? []).map((row: any) => ({
    friendshipId: row.id,
    userId: row.friend_id,
    name: row.users?.name ?? 'Unknown',
    handicap: row.users?.handicap ?? null,
    venmoUsername: row.users?.venmo_username ?? null,
    friendCode: row.users?.friend_code ?? '',
    createdAt: row.created_at,
  }));

  return { data: friends };
}

// ─── Add Friend by Code ─────────────────────────────────────

export async function addFriendByCode(
  friendCode: string,
): Promise<{ friendId?: string; friendName?: string; error?: string }> {
  const { data, error } = await supabase.rpc('add_friend', {
    target_friend_code: friendCode.toUpperCase(),
  });

  if (error) return { error: error.message };

  const result = data as any;
  if (result?.error) return { error: result.error };

  return { friendId: result?.friend_id, friendName: result?.friend_name };
}

// ─── Remove Friend ──────────────────────────────────────────

export async function removeFriend(
  friendUserId: string,
): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('remove_friend', {
    target_user_id: friendUserId,
  });

  if (error) return { error: error.message };

  const result = data as any;
  if (result?.error) return { error: result.error };

  return {};
}

// ─── Lookup User by Friend Code (for preview) ───────────────

export async function lookupUserByFriendCode(
  code: string,
): Promise<{
  user?: { id: string; name: string; handicap: number | null; friendCode: string };
  error?: string;
}> {
  const { data, error } = await supabase.rpc('lookup_user_by_friend_code', {
    code: code.toUpperCase(),
  });

  if (error) return { error: error.message };

  const rows = data as any[];
  if (!rows || rows.length === 0) return { error: 'No user found with that code' };

  const row = rows[0];
  return {
    user: {
      id: row.id,
      name: row.name,
      handicap: row.handicap,
      friendCode: row.friend_code,
    },
  };
}
