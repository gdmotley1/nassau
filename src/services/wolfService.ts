/**
 * Wolf Game Service
 *
 * Handles wolf choice submissions and fetching wolf choices for a game.
 */

import { supabase } from './supabase';
import type { WolfChoiceRow } from '../types';

/**
 * Submit the wolf's partner choice for a hole.
 *
 * @param gameId - The game ID
 * @param holeNumber - Which hole the choice is for
 * @param wolfPlayerId - The game_player ID of the wolf this hole
 * @param choiceType - 'solo' (lone/blind wolf) or 'partner'
 * @param partnerId - game_player ID of chosen partner (null for solo)
 */
export async function submitWolfChoice(
  gameId: string,
  holeNumber: number,
  wolfPlayerId: string,
  choiceType: 'solo' | 'partner',
  partnerId: string | null,
): Promise<{ data?: WolfChoiceRow; error?: string }> {
  // Check for duplicate
  const { data: existing } = await supabase
    .from('wolf_choices')
    .select('id')
    .eq('game_id', gameId)
    .eq('hole_number', holeNumber)
    .eq('wolf_player_id', wolfPlayerId)
    .maybeSingle();

  if (existing) {
    return { error: 'Wolf choice already made for this hole' };
  }

  const { data, error } = await supabase
    .from('wolf_choices')
    .insert({
      game_id: gameId,
      hole_number: holeNumber,
      wolf_player_id: wolfPlayerId,
      choice_type: choiceType,
      partner_id: partnerId,
    } as any)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: data as unknown as WolfChoiceRow };
}

/**
 * Fetch all wolf choices for a game.
 */
export async function fetchWolfChoices(
  gameId: string,
): Promise<{ data: WolfChoiceRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('wolf_choices')
    .select('*')
    .eq('game_id', gameId)
    .order('hole_number');

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as WolfChoiceRow[] };
}
