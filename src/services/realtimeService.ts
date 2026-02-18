import { supabase } from './supabase';
import type { ScoreRow, GameBetRow, SettlementRow, GamePlayerRow } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface GameRealtimeCallbacks {
  onScoreChange?: (score: ScoreRow) => void;
  onBetChange?: (bet: GameBetRow) => void;
  onSettlementChange?: (settlement: SettlementRow) => void;
  onPlayerChange?: (player: GamePlayerRow) => void;
}

/**
 * Subscribe to real-time changes for a game.
 * Listens on scores, game_bets, and settlements tables filtered by game_id.
 */
export function subscribeToGame(
  gameId: string,
  callbacks: GameRealtimeCallbacks,
): RealtimeChannel {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'scores',
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        if (callbacks.onScoreChange && payload.new) {
          callbacks.onScoreChange(payload.new as unknown as ScoreRow);
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_bets',
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        if (callbacks.onBetChange && payload.new) {
          callbacks.onBetChange(payload.new as unknown as GameBetRow);
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'settlements',
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        if (callbacks.onSettlementChange && payload.new) {
          callbacks.onSettlementChange(payload.new as unknown as SettlementRow);
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_players',
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        if (callbacks.onPlayerChange && payload.new) {
          callbacks.onPlayerChange(payload.new as unknown as GamePlayerRow);
        }
      },
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from a real-time channel.
 */
export async function unsubscribeFromGame(
  channel: RealtimeChannel,
): Promise<void> {
  await supabase.removeChannel(channel);
}
