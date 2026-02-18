/**
 * Ace AI Caddie - Analytics Service
 *
 * Queries game data and computes analytics for the Ace AI engine.
 * All functions return structured data that can be fed to an AI model
 * for natural language insights, or displayed directly in the UI.
 */

import { supabase } from './supabase';
import type {
  GameRow,
  GamePlayerRow,
  GameBetRow,
  ScoreRow,
  SettlementRow,
  NassauSettings,
  HeadToHeadRecord,
  CoursePerformance,
  PressAnalytics,
  ScoringTrends,
  HandicapHistoryRow,
  AceInteractionType,
  CourseScouting,
  PressReplayEvent,
  PressReplay,
  LeaderboardEntry,
  GroupLeaderboard,
} from '../types';

// ─── Head-to-Head Matchup Report ──────────────────────────────

/**
 * Get head-to-head record against a specific opponent.
 * Analyzes all completed games where both players participated.
 */
export async function getHeadToHeadRecord(
  userId: string,
  opponentUserId: string,
): Promise<{ data?: HeadToHeadRecord; error?: string }> {
  try {
    // Find all completed games where BOTH players participated
    const { data: userGames } = await supabase
      .from('game_players')
      .select('game_id')
      .eq('user_id', userId);

    const { data: opponentGames } = await supabase
      .from('game_players')
      .select('game_id')
      .eq('user_id', opponentUserId);

    if (!userGames || !opponentGames) return { error: 'Failed to fetch games' };

    const userGameIds = new Set(userGames.map((g: any) => g.game_id));
    const sharedGameIds = opponentGames
      .map((g: any) => g.game_id)
      .filter((id: string) => userGameIds.has(id));

    if (sharedGameIds.length === 0) {
      return { error: 'No shared games found' };
    }

    // Fetch full data for shared games
    const [gamesRes, betsRes, settlementsRes, opponentUserRes] = await Promise.all([
      supabase.from('games').select('*').in('id', sharedGameIds).eq('status', 'completed'),
      supabase.from('game_bets').select('*').in('game_id', sharedGameIds),
      supabase.from('settlements').select('*').in('game_id', sharedGameIds),
      supabase.from('users').select('name').eq('id', opponentUserId).single(),
    ]);

    const games = (gamesRes.data ?? []) as unknown as GameRow[];
    const bets = (betsRes.data ?? []) as unknown as GameBetRow[];
    const settlements = (settlementsRes.data ?? []) as unknown as SettlementRow[];
    const opponentName = (opponentUserRes.data as any)?.name ?? 'Opponent';

    // Calculate per-game net vs this opponent
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let totalNet = 0;
    let totalMargin = 0;
    let lastPlayed = '';

    // Front/back region tracking
    const frontRecord = { wins: 0, losses: 0, pushes: 0 };
    const backRecord = { wins: 0, losses: 0, pushes: 0 };

    for (const game of games) {
      // Net from settlements for this game
      const gameSettlements = settlements.filter((s) => s.game_id === game.id);
      let gameNet = 0;
      for (const s of gameSettlements) {
        if (s.to_user_id === userId && s.from_user_id === opponentUserId) gameNet += s.amount;
        if (s.from_user_id === userId && s.to_user_id === opponentUserId) gameNet -= s.amount;
      }

      totalNet += gameNet;
      if (gameNet > 0) { wins++; totalMargin += gameNet; }
      else if (gameNet < 0) { losses++; totalMargin += gameNet; }
      else pushes++;

      // Track last played
      const completedAt = game.completed_at ?? game.created_at;
      if (!lastPlayed || completedAt > lastPlayed) lastPlayed = completedAt;

      // Analyze region-level bets (front/back)
      const gameBets = bets.filter((b) => b.game_id === game.id && b.parent_bet_id === null);
      for (const bet of gameBets) {
        if (bet.bet_type === 'front_9' && bet.winner_id) {
          // Need to resolve winner to user_id — for simplicity, track by settlement direction
        }
        if (bet.bet_type === 'back_9' && bet.winner_id) {
          // Similar
        }
      }
    }

    // Simplified region records from bet outcomes
    // For front/back 9, count bet-level wins/losses
    for (const bet of bets) {
      if (bet.parent_bet_id !== null) continue; // skip presses for region record
      if (!bet.winner_id) continue;

      // We need to know if the winner_id corresponds to userId or opponentUserId
      // winner_id is a game_player id, not a user_id. We'd need the game_players mapping.
      // For this aggregation, we'll use settlement data which already has user_ids.
    }

    // Use settlement breakdown approach for region records
    for (const game of games) {
      const gameBets = bets.filter((b) => b.game_id === game.id && b.parent_bet_id === null);
      const gameSettlements = settlements.filter((s) => s.game_id === game.id);

      // Check front 9 bet
      const frontBet = gameBets.find((b) => b.bet_type === 'front_9');
      if (frontBet && frontBet.winner_id) {
        // Determine if user won this bet by checking if user received money for this game
        const userReceived = gameSettlements.some(
          (s) => s.to_user_id === userId && s.from_user_id === opponentUserId,
        );
        const userPaid = gameSettlements.some(
          (s) => s.from_user_id === userId && s.to_user_id === opponentUserId,
        );

        // Simplified: if net is positive for this game, user likely won front too
        // More precise analysis would need game_player id mapping
        // For MVP, we track at game level
      }
    }

    // For now, use game-level wins for region records (will refine with game_player resolution)
    frontRecord.wins = wins;
    frontRecord.losses = losses;
    frontRecord.pushes = pushes;
    backRecord.wins = wins;
    backRecord.losses = losses;
    backRecord.pushes = pushes;

    const gamesPlayed = games.length;
    const averageMargin = gamesPlayed > 0 ? totalNet / gamesPlayed : 0;

    return {
      data: {
        opponentUserId,
        opponentName,
        gamesPlayed,
        wins,
        losses,
        pushes,
        totalNet,
        frontNineRecord: frontRecord,
        backNineRecord: backRecord,
        averageMargin,
        lastPlayed,
      },
    };
  } catch (e: any) {
    return { error: e.message ?? 'Failed to compute matchup' };
  }
}

// ─── All Matchup Records ─────────────────────────────────────

/**
 * Get head-to-head records against ALL opponents.
 */
export async function getAllMatchupRecords(
  userId: string,
): Promise<{ data: HeadToHeadRecord[]; error?: string }> {
  try {
    // Get all games the user has played
    const { data: userPlayerRows } = await supabase
      .from('game_players')
      .select('game_id')
      .eq('user_id', userId);

    if (!userPlayerRows || userPlayerRows.length === 0) return { data: [] };

    const gameIds = userPlayerRows.map((r: any) => r.game_id);

    // Get all players in those games (to find opponents)
    const { data: allPlayersInGames } = await supabase
      .from('game_players')
      .select('game_id, user_id')
      .in('game_id', gameIds)
      .not('user_id', 'is', null)
      .neq('user_id', userId);

    if (!allPlayersInGames) return { data: [] };

    // Unique opponent IDs
    const opponentIds = [...new Set(allPlayersInGames.map((p: any) => p.user_id as string))];

    // Fetch all matchup records in parallel
    const records = await Promise.all(
      opponentIds.map((oppId) => getHeadToHeadRecord(userId, oppId)),
    );

    const validRecords = records
      .filter((r) => r.data)
      .map((r) => r.data!);

    return { data: validRecords };
  } catch (e: any) {
    return { data: [], error: e.message };
  }
}

// ─── Course Performance ──────────────────────────────────────

/**
 * Get performance stats at a specific course or all courses.
 */
export async function getCoursePerformance(
  userId: string,
  courseName?: string,
): Promise<{ data: CoursePerformance[]; error?: string }> {
  try {
    // Get user's completed games
    const { data: userPlayerRows } = await supabase
      .from('game_players')
      .select('game_id, id')
      .eq('user_id', userId);

    if (!userPlayerRows || userPlayerRows.length === 0) return { data: [] };

    const gameIds = userPlayerRows.map((r: any) => r.game_id);
    const playerIdMap = new Map<string, string>(); // game_id -> game_player_id
    userPlayerRows.forEach((r: any) => playerIdMap.set(r.game_id, r.id));

    // Fetch games and scores
    let gamesQuery = supabase
      .from('games')
      .select('*')
      .in('id', gameIds)
      .eq('status', 'completed')
      .not('course_name', 'is', null);

    if (courseName) {
      gamesQuery = gamesQuery.ilike('course_name', courseName);
    }

    const [gamesRes, scoresRes, settlementsRes] = await Promise.all([
      gamesQuery,
      supabase.from('scores').select('*').in('game_id', gameIds),
      supabase.from('settlements').select('*').in('game_id', gameIds),
    ]);

    const games = (gamesRes.data ?? []) as unknown as GameRow[];
    const allScores = (scoresRes.data ?? []) as unknown as ScoreRow[];
    const allSettlements = (settlementsRes.data ?? []) as unknown as SettlementRow[];

    // Group games by course name (case-insensitive)
    const courseMap = new Map<string, GameRow[]>();
    for (const game of games) {
      const name = (game.course_name ?? 'Unknown').toLowerCase().trim();
      if (!courseMap.has(name)) courseMap.set(name, []);
      courseMap.get(name)!.push(game);
    }

    const performances: CoursePerformance[] = [];

    for (const [normalizedName, courseGames] of courseMap) {
      const displayName = courseGames[0].course_name ?? 'Unknown';
      const courseGameIds = courseGames.map((g) => g.id);

      // Scores for this user at this course
      const courseScores: ScoreRow[] = [];
      for (const game of courseGames) {
        const playerId = playerIdMap.get(game.id);
        if (!playerId) continue;
        const playerScores = allScores.filter(
          (s) => s.game_id === game.id && s.player_id === playerId,
        );
        courseScores.push(...playerScores);
      }

      // Per-round totals
      const roundTotals: number[] = [];
      for (const game of courseGames) {
        const playerId = playerIdMap.get(game.id);
        if (!playerId) continue;
        const roundScores = allScores.filter(
          (s) => s.game_id === game.id && s.player_id === playerId,
        );
        if (roundScores.length > 0) {
          const total = roundScores.reduce((sum, s) => sum + s.strokes, 0);
          roundTotals.push(total);
        }
      }

      const roundsPlayed = roundTotals.length;
      if (roundsPlayed === 0) continue;

      const averageScore = roundTotals.reduce((a, b) => a + b, 0) / roundsPlayed;
      const bestScore = Math.min(...roundTotals);
      const worstScore = Math.max(...roundTotals);

      // Net P/L at this course
      let totalNet = 0;
      let gamesWon = 0;
      for (const game of courseGames) {
        const gameSettlements = allSettlements.filter((s) => s.game_id === game.id);
        let gameNet = 0;
        for (const s of gameSettlements) {
          if (s.to_user_id === userId) gameNet += s.amount;
          if (s.from_user_id === userId) gameNet -= s.amount;
        }
        totalNet += gameNet;
        if (gameNet > 0) gamesWon++;
      }

      // Per-hole averages
      const holeMap = new Map<number, { totalStrokes: number; count: number; par: number }>();
      for (const score of courseScores) {
        const existing = holeMap.get(score.hole_number) ?? { totalStrokes: 0, count: 0, par: 4 };
        existing.totalStrokes += score.strokes;
        existing.count++;
        holeMap.set(score.hole_number, existing);
      }

      // Get pars from the most recent game at this course
      const latestGame = courseGames.sort((a, b) =>
        (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at),
      )[0];
      const settings = latestGame.settings as NassauSettings & { type: string };
      const pars = settings.hole_pars ?? Array(18).fill(4);

      // Update hole pars
      for (const [hole, data] of holeMap) {
        data.par = pars[hole - 1] ?? 4;
      }

      const holeAverages = Array.from(holeMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([holeNumber, data]) => ({
          holeNumber,
          avgStrokes: data.count > 0 ? data.totalStrokes / data.count : 0,
          par: data.par,
          differential: data.count > 0 ? (data.totalStrokes / data.count) - data.par : 0,
        }));

      // Par type averages
      let par3Total = 0, par3Count = 0;
      let par4Total = 0, par4Count = 0;
      let par5Total = 0, par5Count = 0;

      for (const score of courseScores) {
        const par = pars[score.hole_number - 1] ?? 4;
        if (par === 3) { par3Total += score.strokes; par3Count++; }
        else if (par === 4) { par4Total += score.strokes; par4Count++; }
        else if (par >= 5) { par5Total += score.strokes; par5Count++; }
      }

      performances.push({
        courseName: displayName,
        courseId: courseGames[0].course_id ?? null,
        roundsPlayed,
        averageScore,
        bestScore,
        worstScore,
        totalNet,
        winRate: roundsPlayed > 0 ? (gamesWon / roundsPlayed) * 100 : 0,
        holeAverages,
        par3Avg: par3Count > 0 ? par3Total / par3Count : 0,
        par4Avg: par4Count > 0 ? par4Total / par4Count : 0,
        par5Avg: par5Count > 0 ? par5Total / par5Count : 0,
      });
    }

    // Sort by rounds played descending
    performances.sort((a, b) => b.roundsPlayed - a.roundsPlayed);

    return { data: performances };
  } catch (e: any) {
    return { data: [], error: e.message };
  }
}

// ─── Press Analytics ─────────────────────────────────────────

/**
 * Analyze press betting patterns and outcomes.
 */
export async function getPressAnalytics(
  userId: string,
): Promise<{ data?: PressAnalytics; error?: string }> {
  try {
    // Get user's game_player IDs across all games
    const { data: userPlayerRows } = await supabase
      .from('game_players')
      .select('id, game_id')
      .eq('user_id', userId);

    if (!userPlayerRows || userPlayerRows.length === 0) {
      return { data: undefined, error: 'No games found' };
    }

    const playerIds = new Set(userPlayerRows.map((r: any) => r.id as string));
    const gameIds = userPlayerRows.map((r: any) => r.game_id);

    // Get all press bets from user's games
    const { data: allBets } = await supabase
      .from('game_bets')
      .select('*')
      .in('game_id', gameIds)
      .not('parent_bet_id', 'is', null);

    if (!allBets) return { data: undefined, error: 'Failed to fetch bets' };

    const pressBets = allBets as unknown as GameBetRow[];

    // Filter to presses involving this user
    const userPresses = pressBets.filter(
      (b) => playerIds.has(b.player_a_id ?? '') || playerIds.has(b.player_b_id ?? ''),
    );

    let pressesWon = 0;
    let pressesLost = 0;
    let pressesPushed = 0;
    let netFromPresses = 0;
    let totalMarginAtPress = 0;
    let marginCount = 0;

    const marginBuckets = new Map<number, { presses: number; wins: number }>();
    const holeBuckets = new Map<number, { presses: number; wins: number }>();
    const regionBuckets = new Map<string, { presses: number; wins: number }>();

    for (const press of userPresses) {
      const isPlayerA = playerIds.has(press.player_a_id ?? '');

      if (!press.winner_id) {
        pressesPushed++;
      } else if (
        (isPlayerA && playerIds.has(press.winner_id)) ||
        (!isPlayerA && playerIds.has(press.winner_id))
      ) {
        pressesWon++;
        netFromPresses += press.amount;
      } else {
        pressesLost++;
        netFromPresses -= press.amount;
      }

      // Margin at press
      if (press.margin_at_press !== null && press.margin_at_press !== undefined) {
        totalMarginAtPress += press.margin_at_press;
        marginCount++;

        const margin = press.margin_at_press;
        const existing = marginBuckets.get(margin) ?? { presses: 0, wins: 0 };
        existing.presses++;
        if (press.winner_id && playerIds.has(press.winner_id)) existing.wins++;
        marginBuckets.set(margin, existing);
      }

      // Hole bucket
      if (press.press_initiated_hole !== null && press.press_initiated_hole !== undefined) {
        const hole = press.press_initiated_hole;
        const existing = holeBuckets.get(hole) ?? { presses: 0, wins: 0 };
        existing.presses++;
        if (press.winner_id && playerIds.has(press.winner_id)) existing.wins++;
        holeBuckets.set(hole, existing);
      }

      // Region bucket
      const region = press.bet_type.includes('front') ? 'front'
        : press.bet_type.includes('back') ? 'back' : 'overall';
      const regionData = regionBuckets.get(region) ?? { presses: 0, wins: 0 };
      regionData.presses++;
      if (press.winner_id && playerIds.has(press.winner_id)) regionData.wins++;
      regionBuckets.set(region, regionData);
    }

    const totalPresses = userPresses.length;

    return {
      data: {
        totalPresses,
        pressesWon,
        pressesLost,
        pressesPushed,
        winRate: totalPresses > 0 ? (pressesWon / totalPresses) * 100 : 0,
        avgMarginAtPress: marginCount > 0 ? totalMarginAtPress / marginCount : 0,
        winRateByMargin: Array.from(marginBuckets.entries())
          .sort(([a], [b]) => a - b)
          .map(([margin, data]) => ({
            margin,
            presses: data.presses,
            wins: data.wins,
            winRate: data.presses > 0 ? (data.wins / data.presses) * 100 : 0,
          })),
        winRateByHole: Array.from(holeBuckets.entries())
          .sort(([a], [b]) => a - b)
          .map(([hole, data]) => ({
            hole,
            presses: data.presses,
            wins: data.wins,
            winRate: data.presses > 0 ? (data.wins / data.presses) * 100 : 0,
          })),
        winRateByRegion: Array.from(regionBuckets.entries()).map(([region, data]) => ({
          region,
          presses: data.presses,
          wins: data.wins,
          winRate: data.presses > 0 ? (data.wins / data.presses) * 100 : 0,
        })),
        netFromPresses,
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Scoring Trends ──────────────────────────────────────────

/**
 * Analyze scoring trends for form indicators and trajectory.
 */
export async function getScoringTrends(
  userId: string,
): Promise<{ data?: ScoringTrends; error?: string }> {
  try {
    const { data: userPlayerRows } = await supabase
      .from('game_players')
      .select('id, game_id')
      .eq('user_id', userId);

    if (!userPlayerRows || userPlayerRows.length === 0) {
      return { error: 'No games found' };
    }

    const playerIdToGame = new Map<string, string>();
    userPlayerRows.forEach((r: any) => playerIdToGame.set(r.id, r.game_id));
    const playerIds = [...playerIdToGame.keys()];
    const gameIds = [...new Set(playerIdToGame.values())];

    // Fetch games, scores, and handicap history in parallel
    const [gamesRes, scoresRes, handicapRes] = await Promise.all([
      supabase.from('games').select('*').in('id', gameIds).eq('status', 'completed').order('completed_at', { ascending: false }),
      supabase.from('scores').select('*').in('player_id', playerIds).order('hole_number'),
      supabase.from('handicap_history').select('*').eq('user_id', userId).order('recorded_at', { ascending: true }),
    ]);

    const games = (gamesRes.data ?? []) as unknown as GameRow[];
    const allScores = (scoresRes.data ?? []) as unknown as ScoreRow[];
    const handicapHistory = (handicapRes.data ?? []) as unknown as HandicapHistoryRow[];

    // Per-round score totals (most recent first)
    const roundScores: { gameId: string; total: number; date: string; pars: number[] }[] = [];
    for (const game of games) {
      const playerId = userPlayerRows.find((r: any) => r.game_id === game.id)?.id;
      if (!playerId) continue;

      const gameScores = allScores.filter((s) => s.game_id === game.id && s.player_id === (playerId as any));
      if (gameScores.length === 0) continue;

      const total = gameScores.reduce((sum, s) => sum + s.strokes, 0);
      const settings = game.settings as NassauSettings & { type: string };
      const pars = settings.hole_pars ?? Array(18).fill(4);

      roundScores.push({
        gameId: game.id,
        total,
        date: game.completed_at ?? game.created_at,
        pars,
      });
    }

    const last5 = roundScores.slice(0, 5);
    const last10 = roundScores.slice(0, 10);
    const all = roundScores;

    const last5AvgScore = last5.length > 0 ? last5.reduce((s, r) => s + r.total, 0) / last5.length : 0;
    const last10AvgScore = last10.length > 0 ? last10.reduce((s, r) => s + r.total, 0) / last10.length : 0;
    const seasonAvgScore = all.length > 0 ? all.reduce((s, r) => s + r.total, 0) / all.length : 0;

    // Front 9 vs Back 9 averages
    let front9Total = 0, front9Count = 0;
    let back9Total = 0, back9Count = 0;

    for (const game of games) {
      const playerId = userPlayerRows.find((r: any) => r.game_id === game.id)?.id;
      if (!playerId) continue;

      const gameScores = allScores.filter((s) => s.game_id === game.id && s.player_id === (playerId as any));
      const front = gameScores.filter((s) => s.hole_number <= 9);
      const back = gameScores.filter((s) => s.hole_number > 9);

      if (front.length === 9) {
        front9Total += front.reduce((s, sc) => s + sc.strokes, 0);
        front9Count++;
      }
      if (back.length === 9) {
        back9Total += back.reduce((s, sc) => s + sc.strokes, 0);
        back9Count++;
      }
    }

    // Par type breakdown
    const parTypeData = new Map<number, { totalStrokes: number; count: number }>();

    for (const game of games) {
      const playerId = userPlayerRows.find((r: any) => r.game_id === game.id)?.id;
      if (!playerId) continue;

      const settings = game.settings as NassauSettings & { type: string };
      const pars = settings.hole_pars ?? Array(18).fill(4);
      const gameScores = allScores.filter((s) => s.game_id === game.id && s.player_id === (playerId as any));

      for (const score of gameScores) {
        const par = pars[score.hole_number - 1] ?? 4;
        const existing = parTypeData.get(par) ?? { totalStrokes: 0, count: 0 };
        existing.totalStrokes += score.strokes;
        existing.count++;
        parTypeData.set(par, existing);
      }
    }

    const scoringByHoleType = Array.from(parTypeData.entries())
      .sort(([a], [b]) => a - b)
      .map(([par, data]) => ({
        par,
        avgStrokes: data.count > 0 ? data.totalStrokes / data.count : 0,
        avgVsPar: data.count > 0 ? (data.totalStrokes / data.count) - par : 0,
      }));

    // Form indicator
    const recentTrend = last5AvgScore > 0 && seasonAvgScore > 0
      ? seasonAvgScore - last5AvgScore  // positive = improving (lower recent scores)
      : 0;

    let formIndicator: 'hot' | 'cold' | 'steady' = 'steady';
    if (recentTrend > 2) formIndicator = 'hot';
    else if (recentTrend < -2) formIndicator = 'cold';

    return {
      data: {
        last5AvgScore,
        last10AvgScore,
        seasonAvgScore,
        scoringByHoleType,
        frontNineAvg: front9Count > 0 ? front9Total / front9Count : 0,
        backNineAvg: back9Count > 0 ? back9Total / back9Count : 0,
        handicapHistory: handicapHistory.map((h) => ({
          date: h.recorded_at,
          handicap: h.handicap,
        })),
        formIndicator,
        recentTrend,
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Press Advisor (Real-Time) ───────────────────────────────

export interface PressAdvice {
  shouldPress: boolean;
  confidence: number; // 0-100
  expectedValue: number; // positive = favorable
  reasoning: string;
  historicalWinRate: number;
  contextFactors: string[];
}

/**
 * Get press advice for a specific match situation.
 * This provides the data for real-time press decisions.
 */
export async function getPressAdvice(
  userId: string,
  opponentUserId: string,
  currentHole: number,
  currentMargin: number, // how many holes down (positive = trailing)
  region: 'front' | 'back' | 'overall',
  betAmount: number,
): Promise<{ data?: PressAdvice; error?: string }> {
  try {
    // Get historical press data
    const pressAnalytics = await getPressAnalytics(userId);
    if (!pressAnalytics.data) {
      // No historical data — default advice
      return {
        data: {
          shouldPress: currentMargin >= 2,
          confidence: 30,
          expectedValue: 0,
          reasoning: 'Not enough historical data for a strong recommendation.',
          historicalWinRate: 0,
          contextFactors: ['Limited press history'],
        },
      };
    }

    const analytics = pressAnalytics.data;

    // Find win rate at this margin
    const marginData = analytics.winRateByMargin.find((m) => m.margin === currentMargin);
    const marginWinRate = marginData?.winRate ?? analytics.winRate;

    // Find win rate at this hole
    const holeData = analytics.winRateByHole.find((h) => h.hole === currentHole);
    const holeWinRate = holeData?.winRate ?? analytics.winRate;

    // Find win rate in this region
    const regionData = analytics.winRateByRegion.find((r) => r.region === region);
    const regionWinRate = regionData?.winRate ?? analytics.winRate;

    // Weighted average of signals
    const overallWinRate = (marginWinRate * 0.4 + holeWinRate * 0.3 + regionWinRate * 0.3);

    // Expected value: (winRate * betAmount) - ((1 - winRate) * betAmount)
    const expectedValue = (overallWinRate / 100) * betAmount - ((1 - overallWinRate / 100) * betAmount);

    // Build context factors
    const contextFactors: string[] = [];
    if (analytics.totalPresses >= 5) {
      contextFactors.push(`Your overall press win rate is ${analytics.winRate.toFixed(0)}%`);
    }
    if (marginData && marginData.presses >= 3) {
      contextFactors.push(`When ${currentMargin} down, you win ${marginWinRate.toFixed(0)}% of presses`);
    }
    if (holeData && holeData.presses >= 3) {
      contextFactors.push(`Presses from hole ${currentHole} have a ${holeWinRate.toFixed(0)}% win rate`);
    }

    // Get matchup data
    const matchup = await getHeadToHeadRecord(userId, opponentUserId);
    if (matchup.data) {
      const record = matchup.data;
      if (record.gamesPlayed >= 3) {
        contextFactors.push(`You're ${record.wins}-${record.losses} against ${record.opponentName}`);
      }
    }

    const shouldPress = expectedValue > 0 || (analytics.totalPresses < 5 && currentMargin >= 2);
    const confidence = analytics.totalPresses >= 10 ? 70
      : analytics.totalPresses >= 5 ? 50 : 30;

    let reasoning = '';
    if (shouldPress) {
      reasoning = `Historical data suggests pressing is favorable here with a ${overallWinRate.toFixed(0)}% projected win rate.`;
    } else {
      reasoning = `Your win rate in similar situations is ${overallWinRate.toFixed(0)}% — the math isn't in your favor.`;
    }

    return {
      data: {
        shouldPress,
        confidence,
        expectedValue,
        reasoning,
        historicalWinRate: overallWinRate,
        contextFactors,
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Post-Round Analysis ─────────────────────────────────────

export interface PostRoundAnalysis {
  totalScore: number;
  scoreToPar: number;
  averageScoreToPar: number;
  bestHole: { hole: number; strokes: number; par: number; label: string };
  worstHole: { hole: number; strokes: number; par: number; label: string };
  parTypePerformance: { par: number; avgStrokes: number; avgVsPar: number; holesPlayed: number }[];
  front9Score: number;
  back9Score: number;
  missedPressOpportunities: number;
  keyMoments: string[];
  comparisonToAverage: number; // positive = better than usual
}

/**
 * Generate a post-round analysis for a completed game.
 */
export async function getPostRoundAnalysis(
  userId: string,
  gameId: string,
): Promise<{ data?: PostRoundAnalysis; error?: string }> {
  try {
    // Get the game and user's player ID
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!game) return { error: 'Game not found' };

    const { data: playerRow } = await supabase
      .from('game_players')
      .select('id')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .single();

    if (!playerRow) return { error: 'Player not found in game' };

    const playerId = (playerRow as any).id;

    // Get scores for this game
    const { data: scores } = await supabase
      .from('scores')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .order('hole_number');

    if (!scores || scores.length === 0) return { error: 'No scores found' };

    const typedScores = scores as unknown as ScoreRow[];
    const settings = (game as any).settings as NassauSettings & { type: string };
    const pars = settings.hole_pars ?? Array(18).fill(4);

    const totalScore = typedScores.reduce((s, sc) => s + sc.strokes, 0);
    const totalPar = typedScores.reduce((s, sc) => s + (pars[sc.hole_number - 1] ?? 4), 0);
    const scoreToPar = totalScore - totalPar;

    // Best and worst holes
    let bestDiff = Infinity;
    let worstDiff = -Infinity;
    let bestHole = typedScores[0];
    let worstHole = typedScores[0];

    for (const score of typedScores) {
      const par = pars[score.hole_number - 1] ?? 4;
      const diff = score.strokes - par;
      if (diff < bestDiff) { bestDiff = diff; bestHole = score; }
      if (diff > worstDiff) { worstDiff = diff; worstHole = score; }
    }

    const scoreLabel = (strokes: number, par: number) => {
      const diff = strokes - par;
      if (diff <= -2) return 'Eagle';
      if (diff === -1) return 'Birdie';
      if (diff === 0) return 'Par';
      if (diff === 1) return 'Bogey';
      if (diff === 2) return 'Double Bogey';
      return `+${diff}`;
    };

    // Par type performance
    const parTypes = new Map<number, { total: number; count: number }>();
    for (const score of typedScores) {
      const par = pars[score.hole_number - 1] ?? 4;
      const existing = parTypes.get(par) ?? { total: 0, count: 0 };
      existing.total += score.strokes;
      existing.count++;
      parTypes.set(par, existing);
    }

    // Front 9 / Back 9
    const front9Scores = typedScores.filter((s) => s.hole_number <= 9);
    const back9Scores = typedScores.filter((s) => s.hole_number > 9);
    const front9Score = front9Scores.reduce((s, sc) => s + sc.strokes, 0);
    const back9Score = back9Scores.reduce((s, sc) => s + sc.strokes, 0);

    // Compare to season average
    const trends = await getScoringTrends(userId);
    const avgScore = trends.data?.seasonAvgScore ?? 0;
    const comparisonToAverage = avgScore > 0 ? avgScore - totalScore : 0;

    // Key moments
    const keyMoments: string[] = [];
    for (const score of typedScores) {
      const par = pars[score.hole_number - 1] ?? 4;
      const diff = score.strokes - par;
      if (diff <= -2) keyMoments.push(`Eagle on hole ${score.hole_number}`);
      else if (diff === -1) keyMoments.push(`Birdie on hole ${score.hole_number}`);
      else if (diff >= 3) keyMoments.push(`+${diff} on hole ${score.hole_number}`);
    }

    // Count missed press opportunities (press suggestions that were declined)
    const { data: suggestions } = await supabase
      .from('press_suggestions')
      .select('*')
      .eq('game_id', gameId)
      .eq('accepted', false);

    const missedPressOpportunities = suggestions?.length ?? 0;

    return {
      data: {
        totalScore,
        scoreToPar,
        averageScoreToPar: avgScore > 0 ? avgScore - totalPar : 0,
        bestHole: {
          hole: bestHole.hole_number,
          strokes: bestHole.strokes,
          par: pars[bestHole.hole_number - 1] ?? 4,
          label: scoreLabel(bestHole.strokes, pars[bestHole.hole_number - 1] ?? 4),
        },
        worstHole: {
          hole: worstHole.hole_number,
          strokes: worstHole.strokes,
          par: pars[worstHole.hole_number - 1] ?? 4,
          label: scoreLabel(worstHole.strokes, pars[worstHole.hole_number - 1] ?? 4),
        },
        parTypePerformance: Array.from(parTypes.entries())
          .sort(([a], [b]) => a - b)
          .map(([par, data]) => ({
            par,
            avgStrokes: data.count > 0 ? data.total / data.count : 0,
            avgVsPar: data.count > 0 ? (data.total / data.count) - par : 0,
            holesPlayed: data.count,
          })),
        front9Score,
        back9Score,
        missedPressOpportunities,
        keyMoments,
        comparisonToAverage,
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Course Scouting Report ──────────────────────────────────

/**
 * Get a detailed course scouting report for pre-round preparation.
 * Shows hole-by-hole performance, danger/opportunity holes, and par type stats.
 */
export async function getCourseScouting(
  userId: string,
  courseName: string,
): Promise<{ data?: CourseScouting; error?: string }> {
  try {
    const { data: userPlayerRows } = await supabase
      .from('game_players')
      .select('game_id, id')
      .eq('user_id', userId);

    if (!userPlayerRows || userPlayerRows.length === 0) return { error: 'No games found' };

    const gameIds = userPlayerRows.map((r: any) => r.game_id);
    const playerIdMap = new Map<string, string>();
    userPlayerRows.forEach((r: any) => playerIdMap.set(r.game_id, r.id));

    // Fetch completed games at this course
    const [gamesRes, scoresRes] = await Promise.all([
      supabase
        .from('games')
        .select('*')
        .in('id', gameIds)
        .eq('status', 'completed')
        .ilike('course_name', courseName),
      supabase
        .from('scores')
        .select('*')
        .in('game_id', gameIds),
    ]);

    const games = (gamesRes.data ?? []) as unknown as GameRow[];
    const allScores = (scoresRes.data ?? []) as unknown as ScoreRow[];

    if (games.length === 0) return { error: 'No rounds at this course' };

    // Collect user's scores at this course
    const courseScores: ScoreRow[] = [];
    const roundTotals: number[] = [];

    for (const game of games) {
      const playerId = playerIdMap.get(game.id);
      if (!playerId) continue;
      const playerScores = allScores.filter(
        (s) => s.game_id === game.id && s.player_id === playerId,
      );
      courseScores.push(...playerScores);
      if (playerScores.length > 0) {
        roundTotals.push(playerScores.reduce((sum, s) => sum + s.strokes, 0));
      }
    }

    if (courseScores.length === 0) return { error: 'No scores found' };

    // Use pars from the most recent game
    const latestGame = games[0];
    const settings = (latestGame as any).settings as NassauSettings & { type: string };
    const pars = settings.hole_pars ?? Array(18).fill(4);

    // Per-hole breakdown
    const holeMap = new Map<number, { total: number; count: number; best: number; worst: number }>();

    for (const score of courseScores) {
      const existing = holeMap.get(score.hole_number) ?? {
        total: 0,
        count: 0,
        best: Infinity,
        worst: -Infinity,
      };
      existing.total += score.strokes;
      existing.count++;
      existing.best = Math.min(existing.best, score.strokes);
      existing.worst = Math.max(existing.worst, score.strokes);
      holeMap.set(score.hole_number, existing);
    }

    const holeBreakdown = Array.from(holeMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([holeNumber, data]) => {
        const par = pars[holeNumber - 1] ?? 4;
        const avgStrokes = data.count > 0 ? data.total / data.count : 0;
        return {
          holeNumber,
          par,
          avgStrokes: Math.round(avgStrokes * 100) / 100,
          differential: Math.round((avgStrokes - par) * 100) / 100,
          bestScore: data.best === Infinity ? 0 : data.best,
          worstScore: data.worst === -Infinity ? 0 : data.worst,
        };
      });

    // Danger holes (top 3 worst vs par)
    const sortedByDanger = [...holeBreakdown]
      .filter((h) => h.differential > 0)
      .sort((a, b) => b.differential - a.differential);
    const dangerHoles = sortedByDanger.slice(0, 3).map((h) => h.holeNumber);

    // Opportunity holes (top 3 best vs par)
    const sortedByOpportunity = [...holeBreakdown]
      .filter((h) => h.differential < 0)
      .sort((a, b) => a.differential - b.differential);
    const opportunityHoles = sortedByOpportunity.slice(0, 3).map((h) => h.holeNumber);

    // Par type averages
    const parTypeMap = new Map<number, { total: number; count: number }>();
    for (const score of courseScores) {
      const par = pars[score.hole_number - 1] ?? 4;
      const existing = parTypeMap.get(par) ?? { total: 0, count: 0 };
      existing.total += score.strokes;
      existing.count++;
      parTypeMap.set(par, existing);
    }

    const par3Data = parTypeMap.get(3);
    const par4Data = parTypeMap.get(4);
    const par5Data = parTypeMap.get(5);

    // Front vs Back
    const frontScores = courseScores.filter((s) => s.hole_number <= 9);
    const backScores = courseScores.filter((s) => s.hole_number > 9);
    const frontAvg = frontScores.length > 0
      ? frontScores.reduce((s, sc) => s + sc.strokes, 0) / frontScores.length * 9
      : 0;
    const backAvg = backScores.length > 0
      ? backScores.reduce((s, sc) => s + sc.strokes, 0) / backScores.length * 9
      : 0;

    return {
      data: {
        courseName: latestGame.course_name ?? courseName,
        roundsPlayed: games.length,
        averageScore: roundTotals.length > 0
          ? roundTotals.reduce((a, b) => a + b, 0) / roundTotals.length
          : 0,
        bestScore: roundTotals.length > 0 ? Math.min(...roundTotals) : 0,
        holeBreakdown,
        dangerHoles,
        opportunityHoles,
        par3Avg: par3Data && par3Data.count > 0 ? par3Data.total / par3Data.count : 0,
        par4Avg: par4Data && par4Data.count > 0 ? par4Data.total / par4Data.count : 0,
        par5Avg: par5Data && par5Data.count > 0 ? par5Data.total / par5Data.count : 0,
        frontVsBack: {
          front: Math.round(frontAvg * 10) / 10,
          back: Math.round(backAvg * 10) / 10,
        },
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Press Replay ────────────────────────────────────────────

/**
 * Get a press replay timeline for a completed game.
 * Shows every press event with outcomes, plus "what if" analysis.
 */
export async function getPressReplay(
  userId: string,
  gameId: string,
): Promise<{ data?: PressReplay; error?: string }> {
  try {
    // Get game and user's player info
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (!game) return { error: 'Game not found' };

    const { data: playerRow } = await supabase
      .from('game_players')
      .select('id')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .single();

    if (!playerRow) return { error: 'Player not found in game' };

    const myPlayerId = (playerRow as any).id as string;

    // Get all players with names
    const { data: gamePlayers } = await supabase
      .from('game_players')
      .select('id, user_id, guest_name')
      .eq('game_id', gameId);

    // Get user names
    const playerUserIds = (gamePlayers ?? [])
      .filter((p: any) => p.user_id)
      .map((p: any) => p.user_id as string);

    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', playerUserIds);

    const nameMap = new Map<string, string>();
    for (const p of (gamePlayers ?? []) as any[]) {
      const userName = (users ?? []).find((u: any) => u.id === p.user_id)?.name;
      nameMap.set(p.id, userName ?? p.guest_name ?? 'Player');
    }

    // Get press bets (bets with a parent)
    const { data: pressBets } = await supabase
      .from('game_bets')
      .select('*')
      .eq('game_id', gameId)
      .not('parent_bet_id', 'is', null);

    const typedPresses = (pressBets ?? []) as unknown as GameBetRow[];

    // Filter to presses involving this user
    const userPresses = typedPresses.filter(
      (b) => b.player_a_id === myPlayerId || b.player_b_id === myPlayerId,
    );

    let pressesWon = 0;
    let pressesLost = 0;
    let netFromPresses = 0;

    const events: PressReplayEvent[] = [];

    for (const press of userPresses) {
      const isPlayerA = press.player_a_id === myPlayerId;
      const pressedByPlayerId = isPlayerA ? press.player_a_id : press.player_b_id;
      const pressedByName = nameMap.get(pressedByPlayerId ?? '') ?? 'Player';

      const region = press.bet_type.includes('front') ? 'Front 9'
        : press.bet_type.includes('back') ? 'Back 9' : 'Overall';

      let outcome: 'won' | 'lost' | 'push';
      let netResult: number;

      if (!press.winner_id) {
        outcome = 'push';
        netResult = 0;
      } else if (press.winner_id === myPlayerId) {
        outcome = 'won';
        netResult = press.amount;
        pressesWon++;
      } else {
        outcome = 'lost';
        netResult = -press.amount;
        pressesLost++;
      }

      netFromPresses += netResult;

      events.push({
        hole: press.press_initiated_hole ?? 0,
        region,
        margin: press.margin_at_press ?? 0,
        amount: press.amount,
        pressedBy: pressedByName,
        outcome,
        netResult,
      });
    }

    // Sort events by hole
    events.sort((a, b) => a.hole - b.hole);

    // Missed press opportunities
    const { data: suggestions } = await supabase
      .from('press_suggestions')
      .select('*')
      .eq('game_id', gameId)
      .eq('accepted', false);

    const missedOpportunities = suggestions?.length ?? 0;

    // What-if calculation
    const avgPressAmount = userPresses.length > 0
      ? userPresses.reduce((s, p) => s + p.amount, 0) / userPresses.length
      : (game as any).settings?.front_bet ?? 5;

    // Get overall press win rate for estimation
    const pressAnalytics = await getPressAnalytics(userId);
    const overallWinRate = pressAnalytics.data?.winRate ?? 50;

    const estimatedGainPerMissed = avgPressAmount * ((overallWinRate / 100) - 0.5) * 2;
    const whatIfNet = netFromPresses + (missedOpportunities * estimatedGainPerMissed);

    return {
      data: {
        gameId,
        courseName: (game as any).course_name ?? '',
        date: (game as any).completed_at ?? (game as any).created_at ?? '',
        totalPresses: userPresses.length,
        pressesWon,
        pressesLost: userPresses.length - pressesWon - (userPresses.length - pressesWon - (userPresses.filter((p) => !p.winner_id).length)),
        netFromPresses,
        events,
        missedOpportunities,
        whatIfNet: Math.round(whatIfNet * 100) / 100,
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Group Leaderboard ──────────────────────────────────────

/**
 * Get P/L leaderboard across the user's friend group.
 * Shows net against each opponent with optional timeframe filtering.
 */
export async function getGroupLeaderboard(
  userId: string,
  timeframe: 'all' | 'month' | 'year' = 'all',
): Promise<{ data?: GroupLeaderboard; error?: string }> {
  try {
    if (timeframe === 'all') {
      // Use existing matchup records for all-time
      const result = await getAllMatchupRecords(userId);
      if (!result.data || result.data.length === 0) {
        return { error: 'No matchup data' };
      }

      const entries: LeaderboardEntry[] = result.data.map((record) => ({
        userId: record.opponentUserId,
        name: record.opponentName,
        netVsYou: -record.totalNet, // flip: positive = they owe you
        gamesPlayed: record.gamesPlayed,
        winRate: record.gamesPlayed > 0
          ? (record.wins / record.gamesPlayed) * 100
          : 0,
        lastPlayed: record.lastPlayed,
      }));

      // Sort by netVsYou descending (best for you first)
      entries.sort((a, b) => b.netVsYou - a.netVsYou);

      return {
        data: {
          timeframe,
          entries,
          yourTotalNet: entries.reduce((sum, e) => sum + e.netVsYou, 0),
          totalGames: entries.reduce((sum, e) => sum + e.gamesPlayed, 0),
        },
      };
    }

    // For month/year: filter settlements by date
    const now = new Date();
    let dateFilter: string;
    if (timeframe === 'month') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else {
      dateFilter = new Date(now.getFullYear(), 0, 1).toISOString();
    }

    // Get user's game_player IDs
    const { data: userPlayerRows } = await supabase
      .from('game_players')
      .select('id, game_id, user_id')
      .eq('user_id', userId);

    if (!userPlayerRows || userPlayerRows.length === 0) return { error: 'No games found' };

    const myPlayerIds = new Set(userPlayerRows.map((r: any) => r.id as string));
    const gameIds = userPlayerRows.map((r: any) => r.game_id);

    // Get settlements in the timeframe
    const { data: settlements } = await supabase
      .from('settlements')
      .select('*')
      .in('game_id', gameIds)
      .gte('created_at', dateFilter);

    if (!settlements || settlements.length === 0) {
      return { data: { timeframe, entries: [], yourTotalNet: 0, totalGames: 0 } };
    }

    const typedSettlements = settlements as unknown as SettlementRow[];

    // Get all game_players to map player IDs to user IDs
    const settlementGameIds = [...new Set(typedSettlements.map((s) => s.game_id))];
    const { data: allPlayersInGames } = await supabase
      .from('game_players')
      .select('id, user_id, game_id')
      .in('game_id', settlementGameIds);

    const playerToUser = new Map<string, string>();
    for (const p of (allPlayersInGames ?? []) as any[]) {
      if (p.user_id) playerToUser.set(p.id, p.user_id);
    }

    // Get user names
    const opponentUserIds = new Set<string>();
    for (const s of typedSettlements) {
      if (!s.from_player_id || !s.to_player_id) continue;
      const fromUser = playerToUser.get(s.from_player_id);
      const toUser = playerToUser.get(s.to_player_id);
      if (fromUser && fromUser !== userId) opponentUserIds.add(fromUser);
      if (toUser && toUser !== userId) opponentUserIds.add(toUser);
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', [...opponentUserIds]);

    const userNameMap = new Map<string, string>();
    for (const u of (users ?? []) as any[]) {
      userNameMap.set(u.id, u.name);
    }

    // Calculate net per opponent
    const opponentNet = new Map<string, { net: number; games: Set<string>; wins: number }>();

    for (const s of typedSettlements) {
      if (!s.from_player_id || !s.to_player_id) continue;
      const fromUser = playerToUser.get(s.from_player_id);
      const toUser = playerToUser.get(s.to_player_id);

      if (myPlayerIds.has(s.from_player_id) && toUser && toUser !== userId) {
        // I owe them
        const existing = opponentNet.get(toUser) ?? { net: 0, games: new Set(), wins: 0 };
        existing.net -= s.amount; // negative = I owe
        existing.games.add(s.game_id);
        opponentNet.set(toUser, existing);
      } else if (myPlayerIds.has(s.to_player_id) && fromUser && fromUser !== userId) {
        // They owe me
        const existing = opponentNet.get(fromUser) ?? { net: 0, games: new Set(), wins: 0 };
        existing.net += s.amount; // positive = they owe me
        existing.games.add(s.game_id);
        existing.wins++;
        opponentNet.set(fromUser, existing);
      }
    }

    const entries: LeaderboardEntry[] = [];
    for (const [oppId, data] of opponentNet) {
      entries.push({
        userId: oppId,
        name: userNameMap.get(oppId) ?? 'Player',
        netVsYou: data.net,
        gamesPlayed: data.games.size,
        winRate: data.games.size > 0 ? (data.wins / data.games.size) * 100 : 0,
        lastPlayed: '',
      });
    }

    entries.sort((a, b) => b.netVsYou - a.netVsYou);

    return {
      data: {
        timeframe,
        entries,
        yourTotalNet: entries.reduce((sum, e) => sum + e.netVsYou, 0),
        totalGames: entries.reduce((sum, e) => sum + e.gamesPlayed, 0),
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Log Ace Interaction ─────────────────────────────────────

/**
 * Log an Ace interaction for learning and analytics.
 */
export async function logAceInteraction(
  userId: string,
  interactionType: AceInteractionType,
  contextJson: Record<string, any>,
  responseJson: Record<string, any>,
  gameId?: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('ace_interactions')
    .insert({
      user_id: userId,
      game_id: gameId ?? null,
      interaction_type: interactionType,
      context_json: contextJson,
      response_json: responseJson,
    } as any);

  return error ? { error: error.message } : {};
}

// ─── Log Press Suggestion ────────────────────────────────────

/**
 * Log a press suggestion shown to the user.
 */
export async function logPressSuggestion(
  gameId: string,
  suggestingPlayerId: string,
  holeNumber: number,
  region: string,
  marginAtSuggestion: number,
): Promise<{ suggestionId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('press_suggestions')
    .insert({
      game_id: gameId,
      suggesting_player_id: suggestingPlayerId,
      hole_number: holeNumber,
      region,
      margin_at_suggestion: marginAtSuggestion,
      accepted: null, // pending
    } as any)
    .select()
    .single();

  if (error) return { error: error.message };
  return { suggestionId: (data as any)?.id };
}

/**
 * Update a press suggestion as accepted or declined.
 */
export async function updatePressSuggestion(
  suggestionId: string,
  accepted: boolean,
  betId?: string,
): Promise<{ error?: string }> {
  const update: any = { accepted };
  if (betId) update.bet_id = betId;

  const { error } = await supabase
    .from('press_suggestions')
    .update(update)
    .eq('id', suggestionId);

  return error ? { error: error.message } : {};
}
