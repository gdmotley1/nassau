import { supabase } from './supabase';
import type { ScoreRow } from '../types';

/**
 * Insert or update a score for a player on a hole.
 * Uses upsert with the unique constraint on (game_id, hole_number, player_id).
 */
export async function upsertScore(
  gameId: string,
  playerId: string,
  holeNumber: number,
  strokes: number,
  netScore: number,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('scores')
    .upsert(
      {
        game_id: gameId,
        player_id: playerId,
        hole_number: holeNumber,
        strokes,
        net_score: netScore,
      } as any,
      { onConflict: 'game_id,hole_number,player_id' },
    );

  return error ? { error: error.message } : {};
}

/**
 * Fetch all scores for a game, ordered by hole number.
 */
export async function fetchScores(
  gameId: string,
): Promise<{ data: ScoreRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('game_id', gameId)
    .order('hole_number');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as ScoreRow[] };
}

/**
 * Fetch scores for a specific hole.
 */
export async function fetchHoleScores(
  gameId: string,
  holeNumber: number,
): Promise<{ data: ScoreRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('game_id', gameId)
    .eq('hole_number', holeNumber);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as ScoreRow[] };
}
