import { supabase } from './supabase';
import type {
  GameRow,
  GamePlayerRow,
  GameBetRow,
  ScoreRow,
  SettlementRow,
  NassauSettings,
  SkinsSettings,
  MatchPlaySettings,
  WolfSettings,
  FullGameData,
} from '../types';

// ─── Types ────────────────────────────────────────────────────

export interface CreatePlayerInput {
  user_id?: string | null;
  guest_name?: string | null;
  guest_handicap?: number | null;
  handicap_used?: number | null;
  position: number;
}

// ─── Create Game ──────────────────────────────────────────────

export async function createNassauGame(
  creatorId: string,
  courseName: string,
  settings: NassauSettings,
  players: CreatePlayerInput[],
): Promise<{ gameId: string; error?: string }> {
  // 1. Insert the game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      created_by: creatorId,
      game_type: 'nassau',
      status: 'created',
      total_pot: 0, // Will be calculated
      settings: { type: 'nassau', ...settings } as any,
      course_name: courseName,
      started_at: null,
      completed_at: null,
    })
    .select()
    .single();

  if (gameError || !game) {
    return { gameId: '', error: gameError?.message ?? 'Failed to create game' };
  }

  const gameId = (game as any).id as string;

  // 2. Insert game_players
  const playerInserts = players.map((p) => ({
    game_id: gameId,
    user_id: p.user_id ?? null,
    guest_name: p.guest_name ?? null,
    guest_handicap: p.guest_handicap ?? null,
    handicap_used: p.handicap_used ?? p.guest_handicap ?? null,
    position: p.position,
    paid_status: 'unpaid' as const,
  }));

  // Insert players first (without .select() to avoid SELECT RLS chicken-and-egg)
  const { error: playersError } = await supabase
    .from('game_players')
    .insert(playerInserts as any);

  if (playersError) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: playersError?.message ?? 'Failed to add players' };
  }

  // Now fetch the inserted players (SELECT RLS works because they're now participants)
  const { data: insertedPlayers, error: fetchPlayersError } = await supabase
    .from('game_players')
    .select()
    .eq('game_id', gameId)
    .order('position');

  if (fetchPlayersError || !insertedPlayers) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: fetchPlayersError?.message ?? 'Failed to fetch players' };
  }

  const typedPlayers = insertedPlayers as unknown as GamePlayerRow[];

  // 3. Create initial bets for every player pair (round-robin)
  const is9Hole = (settings.num_holes ?? 18) === 9;
  const betInserts: any[] = [];
  for (let i = 0; i < typedPlayers.length; i++) {
    for (let j = i + 1; j < typedPlayers.length; j++) {
      const pA = typedPlayers[i];
      const pB = typedPlayers[j];

      betInserts.push({
        game_id: gameId,
        bet_type: 'front_9',
        amount: settings.front_bet,
        winner_id: null,
        settled: false,
        parent_bet_id: null,
        player_a_id: pA.id,
        player_b_id: pB.id,
      });

      if (!is9Hole) {
        betInserts.push(
          {
            game_id: gameId,
            bet_type: 'back_9',
            amount: settings.back_bet,
            winner_id: null,
            settled: false,
            parent_bet_id: null,
            player_a_id: pA.id,
            player_b_id: pB.id,
          },
          {
            game_id: gameId,
            bet_type: 'overall_18',
            amount: settings.overall_bet,
            winner_id: null,
            settled: false,
            parent_bet_id: null,
            player_a_id: pA.id,
            player_b_id: pB.id,
          },
        );
      }
    }
  }

  if (betInserts.length > 0) {
    const { error: betsError } = await supabase
      .from('game_bets')
      .insert(betInserts);

    if (betsError) {
      return { gameId, error: `Game created but bets failed: ${betsError.message}` };
    }
  }

  // 4. Calculate total pot
  const numPairs = (typedPlayers.length * (typedPlayers.length - 1)) / 2;
  const totalPot = is9Hole
    ? numPairs * settings.front_bet
    : numPairs * (settings.front_bet + settings.back_bet + settings.overall_bet);

  await supabase
    .from('games')
    .update({ total_pot: totalPot } as any)
    .eq('id', gameId);

  return { gameId };
}

// ─── Create Skins Game ───────────────────────────────────────

export async function createSkinsGame(
  creatorId: string,
  courseName: string,
  settings: SkinsSettings,
  players: CreatePlayerInput[],
): Promise<{ gameId: string; error?: string }> {
  // 1. Insert the game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      created_by: creatorId,
      game_type: 'skins',
      status: 'created',
      total_pot: 0,
      settings: { type: 'skins', ...settings } as any,
      course_name: courseName,
      started_at: null,
      completed_at: null,
    })
    .select()
    .single();

  if (gameError || !game) {
    return { gameId: '', error: gameError?.message ?? 'Failed to create game' };
  }

  const gameId = (game as any).id as string;

  // 2. Insert game_players
  const playerInserts = players.map((p) => ({
    game_id: gameId,
    user_id: p.user_id ?? null,
    guest_name: p.guest_name ?? null,
    guest_handicap: p.guest_handicap ?? null,
    handicap_used: p.handicap_used ?? p.guest_handicap ?? null,
    position: p.position,
    paid_status: 'unpaid' as const,
  }));

  const { error: playersError } = await supabase
    .from('game_players')
    .insert(playerInserts as any);

  if (playersError) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: playersError?.message ?? 'Failed to add players' };
  }

  // Fetch inserted players
  const { data: insertedPlayers, error: fetchPlayersError } = await supabase
    .from('game_players')
    .select()
    .eq('game_id', gameId)
    .order('position');

  if (fetchPlayersError || !insertedPlayers) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: fetchPlayersError?.message ?? 'Failed to fetch players' };
  }

  const typedPlayers = insertedPlayers as unknown as GamePlayerRow[];

  // 3. Create one skins_pool bet per player (tracks participation, not pairwise)
  const betInserts = typedPlayers.map((p) => ({
    game_id: gameId,
    bet_type: 'skins_pool',
    amount: settings.skin_value,
    winner_id: null,
    settled: false,
    parent_bet_id: null,
    player_a_id: p.id,
    player_b_id: null,
  }));

  if (betInserts.length > 0) {
    const { error: betsError } = await supabase
      .from('game_bets')
      .insert(betInserts as any);

    if (betsError) {
      return { gameId, error: `Game created but bets failed: ${betsError.message}` };
    }
  }

  // 4. Calculate total pot: skin_value × num_holes
  const numHoles = settings.num_holes ?? 18;
  const totalPot = settings.skin_value * numHoles;

  await supabase
    .from('games')
    .update({ total_pot: totalPot } as any)
    .eq('id', gameId);

  return { gameId };
}

// ─── Create Match Play Game ──────────────────────────────────

export async function createMatchPlayGame(
  creatorId: string,
  courseName: string,
  settings: MatchPlaySettings,
  players: CreatePlayerInput[],
): Promise<{ gameId: string; error?: string }> {
  // 1. Insert the game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      created_by: creatorId,
      game_type: 'match_play',
      status: 'created',
      total_pot: 0,
      settings: { type: 'match_play', ...settings } as any,
      course_name: courseName,
      started_at: null,
      completed_at: null,
    })
    .select()
    .single();

  if (gameError || !game) {
    return { gameId: '', error: gameError?.message ?? 'Failed to create game' };
  }

  const gameId = (game as any).id as string;

  // 2. Insert game_players
  const playerInserts = players.map((p) => ({
    game_id: gameId,
    user_id: p.user_id ?? null,
    guest_name: p.guest_name ?? null,
    guest_handicap: p.guest_handicap ?? null,
    handicap_used: p.handicap_used ?? p.guest_handicap ?? null,
    position: p.position,
    paid_status: 'unpaid' as const,
  }));

  const { error: playersError } = await supabase
    .from('game_players')
    .insert(playerInserts as any);

  if (playersError) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: playersError?.message ?? 'Failed to add players' };
  }

  // Fetch inserted players
  const { data: insertedPlayers, error: fetchPlayersError } = await supabase
    .from('game_players')
    .select()
    .eq('game_id', gameId)
    .order('position');

  if (fetchPlayersError || !insertedPlayers) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: fetchPlayersError?.message ?? 'Failed to fetch players' };
  }

  const typedPlayers = insertedPlayers as unknown as GamePlayerRow[];

  // 3. Create bets
  const betInserts: any[] = [];

  if (settings.match_type === 'teams') {
    // Teams: one bet for the team match
    // Use first player of each team as player_a / player_b
    const teamAFirst = typedPlayers[0];
    const teamBFirst = typedPlayers.length >= 3 ? typedPlayers[2] : typedPlayers[1];

    betInserts.push({
      game_id: gameId,
      bet_type: 'match_play',
      amount: settings.total_bet,
      winner_id: null,
      settled: false,
      parent_bet_id: null,
      player_a_id: teamAFirst.id,
      player_b_id: teamBFirst.id,
    });
  } else {
    // Singles: one bet per player pair (round-robin)
    for (let i = 0; i < typedPlayers.length; i++) {
      for (let j = i + 1; j < typedPlayers.length; j++) {
        betInserts.push({
          game_id: gameId,
          bet_type: 'match_play',
          amount: settings.total_bet,
          winner_id: null,
          settled: false,
          parent_bet_id: null,
          player_a_id: typedPlayers[i].id,
          player_b_id: typedPlayers[j].id,
        });
      }
    }
  }

  if (betInserts.length > 0) {
    const { error: betsError } = await supabase
      .from('game_bets')
      .insert(betInserts);

    if (betsError) {
      return { gameId, error: `Game created but bets failed: ${betsError.message}` };
    }
  }

  // 4. Calculate total pot
  const numMatches = betInserts.length;
  const totalPot = numMatches * settings.total_bet;

  await supabase
    .from('games')
    .update({ total_pot: totalPot } as any)
    .eq('id', gameId);

  // 5. Store team assignments in settings (with resolved player IDs)
  if (settings.match_type === 'teams' && typedPlayers.length === 4) {
    const updatedSettings = {
      type: 'match_play',
      ...settings,
      team_a: [typedPlayers[0].id, typedPlayers[1].id],
      team_b: [typedPlayers[2].id, typedPlayers[3].id],
    };

    await supabase
      .from('games')
      .update({ settings: updatedSettings } as any)
      .eq('id', gameId);
  }

  return { gameId };
}

// ─── Create Wolf Game ──────────────────────────────────────────

export async function createWolfGame(
  creatorId: string,
  courseName: string,
  settings: WolfSettings,
  players: CreatePlayerInput[],
): Promise<{ gameId: string; error?: string }> {
  // Wolf requires exactly 4 players
  if (players.length !== 4) {
    return { gameId: '', error: 'Wolf requires exactly 4 players' };
  }

  // 1. Insert the game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      created_by: creatorId,
      game_type: 'wolf',
      status: 'created',
      total_pot: 0,
      settings: { type: 'wolf', ...settings } as any,
      course_name: courseName,
      started_at: null,
      completed_at: null,
    })
    .select()
    .single();

  if (gameError || !game) {
    return { gameId: '', error: gameError?.message ?? 'Failed to create game' };
  }

  const gameId = (game as any).id as string;

  // 2. Insert game_players
  const playerInserts = players.map((p) => ({
    game_id: gameId,
    user_id: p.user_id ?? null,
    guest_name: p.guest_name ?? null,
    guest_handicap: p.guest_handicap ?? null,
    handicap_used: p.handicap_used ?? p.guest_handicap ?? null,
    position: p.position,
    paid_status: 'unpaid' as const,
  }));

  const { error: playersError } = await supabase
    .from('game_players')
    .insert(playerInserts as any);

  if (playersError) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: playersError?.message ?? 'Failed to add players' };
  }

  // Fetch inserted players
  const { data: insertedPlayers, error: fetchPlayersError } = await supabase
    .from('game_players')
    .select()
    .eq('game_id', gameId)
    .order('position');

  if (fetchPlayersError || !insertedPlayers) {
    await supabase.from('games').delete().eq('id', gameId);
    return { gameId: '', error: fetchPlayersError?.message ?? 'Failed to fetch players' };
  }

  const typedPlayers = insertedPlayers as unknown as GamePlayerRow[];

  // 3. Wolf is points-based — no initial bets needed
  // (Points are tracked via wolf_choices + scores, settlements are pairwise)

  // 4. Store wolf_order with resolved player IDs
  const wolfOrder = typedPlayers.map((p) => p.id);
  const updatedSettings = {
    type: 'wolf',
    ...settings,
    wolf_order: wolfOrder,
  };

  // Estimate total pot: point_value × estimated max points per player × pairs
  // This is approximate — actual depends on game outcome
  const numHoles = settings.num_holes ?? 18;
  const estimatedTotalPot = settings.point_value * numHoles * 2;

  await supabase
    .from('games')
    .update({ settings: updatedSettings, total_pot: estimatedTotalPot } as any)
    .eq('id', gameId);

  return { gameId };
}

// ─── Load Game ────────────────────────────────────────────────

export async function loadGame(gameId: string): Promise<{ data?: FullGameData; error?: string }> {
  const [gameRes, playersRes, betsRes, scoresRes, settlementsRes] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('game_players').select('*, users(name, venmo_username)').eq('game_id', gameId).order('position'),
    supabase.from('game_bets').select('*').eq('game_id', gameId),
    supabase.from('scores').select('*').eq('game_id', gameId).order('hole_number'),
    supabase.from('settlements').select('*').eq('game_id', gameId),
  ]);

  if (gameRes.error) return { error: gameRes.error.message };

  return {
    data: {
      game: gameRes.data as unknown as GameRow,
      players: (playersRes.data ?? []) as unknown as GamePlayerRow[],
      bets: (betsRes.data ?? []) as unknown as GameBetRow[],
      scores: (scoresRes.data ?? []) as unknown as ScoreRow[],
      settlements: (settlementsRes.data ?? []) as unknown as SettlementRow[],
    },
  };
}

// ─── Game Status Transitions ──────────────────────────────────

export async function startGame(gameId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('games')
    .update({ status: 'in_progress', started_at: new Date().toISOString() } as any)
    .eq('id', gameId);

  return error ? { error: error.message } : {};
}

export async function completeGame(gameId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('games')
    .update({ status: 'completed', completed_at: new Date().toISOString() } as any)
    .eq('id', gameId);

  return error ? { error: error.message } : {};
}

export async function cancelGame(gameId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('games')
    .update({ status: 'cancelled' } as any)
    .eq('id', gameId);

  return error ? { error: error.message } : {};
}

// ─── Create Press Bet ─────────────────────────────────────────

export async function createPressBet(
  gameId: string,
  parentBetId: string,
  betType: string,
  amount: number,
  playerAId: string,
  playerBId: string,
  pressInitiatedHole?: number,
  marginAtPress?: number,
): Promise<{ betId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('game_bets')
    .insert({
      game_id: gameId,
      bet_type: betType,
      amount,
      winner_id: null,
      settled: false,
      parent_bet_id: parentBetId,
      player_a_id: playerAId,
      player_b_id: playerBId,
      press_initiated_hole: pressInitiatedHole ?? null,
      margin_at_press: marginAtPress ?? null,
    } as any)
    .select()
    .single();

  if (error) return { error: error.message };
  return { betId: (data as any)?.id };
}

// ─── Add Late Player (Mid-Game Join) ─────────────────────────

export async function addLatePlayer(
  gameId: string,
  userId: string,
  handicapUsed: number,
  existingPlayerIds: string[],
  settings: NassauSettings,
): Promise<{ gamePlayerId?: string; error?: string }> {
  const position = existingPlayerIds.length + 1;

  // 1. Insert the new game_player (no .select() to avoid SELECT RLS chicken-and-egg)
  const { error: playerError } = await supabase
    .from('game_players')
    .insert({
      game_id: gameId,
      user_id: userId,
      guest_name: null,
      guest_handicap: null,
      handicap_used: handicapUsed,
      position,
      paid_status: 'unpaid' as const,
    } as any);

  if (playerError) {
    return { error: playerError?.message ?? 'Failed to add player' };
  }

  // Fetch the newly inserted player
  const { data: newPlayer, error: fetchError } = await supabase
    .from('game_players')
    .select()
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !newPlayer) {
    return { error: fetchError?.message ?? 'Failed to fetch new player' };
  }

  const newPlayerId = (newPlayer as any).id as string;
  const is9Hole = (settings.num_holes ?? 18) === 9;

  // 2. Create bets for the new player vs every existing player
  const betInserts: any[] = [];
  for (const existingId of existingPlayerIds) {
    betInserts.push({
      game_id: gameId,
      bet_type: 'front_9',
      amount: settings.front_bet,
      winner_id: null,
      settled: false,
      parent_bet_id: null,
      player_a_id: existingId,
      player_b_id: newPlayerId,
    });

    if (!is9Hole) {
      betInserts.push(
        {
          game_id: gameId,
          bet_type: 'back_9',
          amount: settings.back_bet,
          winner_id: null,
          settled: false,
          parent_bet_id: null,
          player_a_id: existingId,
          player_b_id: newPlayerId,
        },
        {
          game_id: gameId,
          bet_type: 'overall_18',
          amount: settings.overall_bet,
          winner_id: null,
          settled: false,
          parent_bet_id: null,
          player_a_id: existingId,
          player_b_id: newPlayerId,
        },
      );
    }
  }

  if (betInserts.length > 0) {
    const { error: betsError } = await supabase
      .from('game_bets')
      .insert(betInserts);

    if (betsError) {
      return { gamePlayerId: newPlayerId, error: `Player added but bets failed: ${betsError.message}` };
    }
  }

  // 3. Recalculate total pot
  const totalPlayers = existingPlayerIds.length + 1;
  const numPairs = (totalPlayers * (totalPlayers - 1)) / 2;
  const totalPot = is9Hole
    ? numPairs * settings.front_bet
    : numPairs * (settings.front_bet + settings.back_bet + settings.overall_bet);

  await supabase
    .from('games')
    .update({ total_pot: totalPot } as any)
    .eq('id', gameId);

  return { gamePlayerId: newPlayerId };
}

// ─── Fetch User's Games ───────────────────────────────────────

export async function fetchUserGames(
  userId: string,
  status?: string,
): Promise<{ data: GameRow[]; error?: string }> {
  // Get game IDs where this user is a player (includes games they were invited to)
  const { data: playerRows, error: playerError } = await supabase
    .from('game_players')
    .select('game_id')
    .eq('user_id', userId);

  if (playerError) return { data: [], error: playerError.message };

  const gameIds = (playerRows ?? []).map((r: any) => r.game_id as string);
  if (gameIds.length === 0) return { data: [] };

  let query = supabase
    .from('games')
    .select('*')
    .in('id', gameIds)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as unknown as GameRow[] };
}
