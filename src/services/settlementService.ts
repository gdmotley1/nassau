import { Linking } from 'react-native';
import { supabase } from './supabase';
import type { SettlementRow, NassauSettlement, GamePlayerRow, SettlementMethod } from '../types';

/**
 * Batch insert settlement rows from calculated Nassau settlements.
 */
export async function createSettlements(
  gameId: string,
  settlements: NassauSettlement[],
  players: GamePlayerRow[],
): Promise<{ error?: string }> {
  const inserts = settlements.map((s) => {
    const fromPlayer = players.find((p) => p.id === s.fromPlayerId);
    const toPlayer = players.find((p) => p.id === s.toPlayerId);

    return {
      game_id: gameId,
      from_user_id: fromPlayer?.user_id ?? null,
      to_user_id: toPlayer?.user_id ?? null,
      from_player_id: s.fromPlayerId,
      to_player_id: s.toPlayerId,
      amount: s.amount,
      status: 'pending' as const,
      settlement_method: null,
      settled_at: null,
    };
  });

  if (inserts.length === 0) return {};

  const { error } = await supabase
    .from('settlements')
    .insert(inserts as any);

  return error ? { error: error.message } : {};
}

/**
 * Mark a settlement as paid with the given method.
 */
export async function markSettlementPaid(
  settlementId: string,
  method: SettlementMethod,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('settlements')
    .update({
      status: 'settled',
      settlement_method: method,
      settled_at: new Date().toISOString(),
    } as any)
    .eq('id', settlementId);

  return error ? { error: error.message } : {};
}

/**
 * Fetch all settlements for a game.
 */
export async function fetchSettlements(
  gameId: string,
): Promise<{ data: SettlementRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('game_id', gameId);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as SettlementRow[] };
}

// ─── Deep Links ───────────────────────────────────────────────

/**
 * Build a Venmo deep link for payment.
 * Venmo URL scheme: venmo://paycharge?txn=pay&recipients=USERNAME&amount=AMOUNT&note=NOTE
 */
export function buildVenmoDeepLink(
  username: string,
  amount: number,
  note: string,
): string {
  const encodedNote = encodeURIComponent(note);
  return `venmo://paycharge?txn=pay&recipients=${username}&amount=${amount.toFixed(2)}&note=${encodedNote}`;
}

/**
 * Open Venmo to pay a specific person.
 */
export async function openVenmoPayment(
  username: string,
  amount: number,
  note: string,
): Promise<boolean> {
  const url = buildVenmoDeepLink(username, amount, note);
  const canOpen = await Linking.canOpenURL(url);

  if (canOpen) {
    await Linking.openURL(url);
    return true;
  }

  // Fallback: open Venmo in browser
  const webUrl = `https://venmo.com/${username}`;
  await Linking.openURL(webUrl);
  return false;
}
