/**
 * Match Play Scoring Calculator
 *
 * Pure logic — no React, no Supabase. Takes game data in, returns
 * match statuses and settlement amounts out.
 *
 * Match Play = hole-by-hole competition. Each hole: lowest net score
 * wins the hole. Tied = halved.
 *
 * Scoring: "X UP with Y to play." Match closes out when margin > holes remaining.
 *
 * Singles: round-robin pairwise matches (like Nassau but one continuous match).
 * Teams: 2v2 best ball — each team's best net score on each hole is compared.
 *
 * Settlement: winner gets total_bet. Halved match = $0.
 */

import type {
  MatchPlaySettings,
  GamePlayerRow,
  GameBetRow,
  ScoreRow,
  HoleResult,
  MatchPlayMatchStatus,
  MatchPlayLiveStatus,
  MatchPlaySettlement,
  SettlementBreakdownItem,
} from '../types/database';
import { calculateMatchStrokes, allocateStrokesToHoles, DEFAULT_STROKE_INDEX } from './handicap';
import type { HandicapMode } from './handicap';

// ─── Input ───────────────────────────────────────────────────

export interface MatchPlayCalculatorInput {
  settings: MatchPlaySettings;
  players: GamePlayerRow[];
  bets: GameBetRow[];
  scores: ScoreRow[];
}

// ─── Helpers ─────────────────────────────────────────────────

function getPlayerHandicap(player: GamePlayerRow): number {
  return player.handicap_used ?? player.guest_handicap ?? 0;
}

function getScore(
  scores: ScoreRow[],
  playerId: string,
  holeNumber: number,
): ScoreRow | null {
  return scores.find(
    (s) => s.player_id === playerId && s.hole_number === holeNumber,
  ) ?? null;
}

/**
 * Generate status text for a match.
 * Examples: "A 2 UP, 5 to play", "All Square, 3 to play", "A wins 3&2", "Halved"
 */
function generateStatusText(
  leaderId: string | null,
  margin: number,
  holesRemaining: number,
  isComplete: boolean,
  playerAId: string,
  playerBId: string,
  players: GamePlayerRow[],
): string {
  const getName = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    if (!p) return '?';
    if (p.guest_name) return p.guest_name.split(' ')[0];
    return (p as any).users?.name?.split(' ')[0] ?? p.user_id?.substring(0, 6) ?? '?';
  };

  if (isComplete) {
    if (leaderId === null || margin === 0) return 'Halved';
    const name = getName(leaderId);
    if (holesRemaining === 0) {
      // Won on last hole — "X wins 1 UP"
      return `${name} wins 1 UP`;
    }
    // Close-out — "X wins 3&2"
    return `${name} wins ${margin}&${holesRemaining}`;
  }

  if (leaderId === null || margin === 0) {
    return `All Square, ${holesRemaining} to play`;
  }

  const name = getName(leaderId);
  return `${name} ${margin} UP, ${holesRemaining} to play`;
}

// ─── Singles Match Calculation ────────────────────────────────

function calculateSinglesMatch(
  playerA: GamePlayerRow,
  playerB: GamePlayerRow,
  scores: ScoreRow[],
  settings: MatchPlaySettings,
): MatchPlayMatchStatus {
  const numHoles = settings.num_holes ?? 18;
  const handicapMode = settings.handicap_mode as HandicapMode;
  const strokeIndex = settings.hole_handicap_ratings ?? DEFAULT_STROKE_INDEX;

  // Calculate pairwise handicap strokes
  const { strokesA, strokesB } = calculateMatchStrokes(
    getPlayerHandicap(playerA),
    getPlayerHandicap(playerB),
    handicapMode,
    strokeIndex,
  );

  const holeResults: HoleResult[] = [];
  let aHolesWon = 0;
  let bHolesWon = 0;
  let matchClosed = false;

  for (let hole = 1; hole <= numHoles; hole++) {
    if (matchClosed) break;

    const scoreA = getScore(scores, playerA.id, hole);
    const scoreB = getScore(scores, playerB.id, hole);

    if (!scoreA || !scoreB) break; // Hole not yet scored

    const netA = scoreA.strokes - (strokesA.get(hole) ?? 0);
    const netB = scoreB.strokes - (strokesB.get(hole) ?? 0);

    let winnerId: string | null = null;
    if (netA < netB) {
      winnerId = playerA.id;
      aHolesWon++;
    } else if (netB < netA) {
      winnerId = playerB.id;
      bHolesWon++;
    }
    // else: halved, no winner

    holeResults.push({
      holeNumber: hole,
      winnerId,
      playerANet: netA,
      playerBNet: netB,
    });

    // Check for close-out: margin > holes remaining
    const holesPlayed = hole;
    const holesRemaining = numHoles - holesPlayed;
    const margin = Math.abs(aHolesWon - bHolesWon);

    if (margin > holesRemaining) {
      matchClosed = true;
    }
  }

  const holesPlayed = holeResults.length;
  const holesRemaining = numHoles - holesPlayed;
  const margin = Math.abs(aHolesWon - bHolesWon);

  let leaderId: string | null = null;
  if (aHolesWon > bHolesWon) leaderId = playerA.id;
  else if (bHolesWon > aHolesWon) leaderId = playerB.id;

  // Match is complete if closed out or all holes played
  const isComplete = matchClosed || holesPlayed === numHoles;

  // Dormie: margin equals holes remaining (if you lose any remaining hole, you lose)
  const isDormie = !matchClosed && margin === holesRemaining && margin > 0 && holesRemaining > 0;

  return {
    playerAId: playerA.id,
    playerBId: playerB.id,
    holeResults,
    leaderId,
    margin,
    holesPlayed,
    holesRemaining: matchClosed ? (numHoles - holesPlayed) : holesRemaining,
    isComplete,
    isDormie,
    statusText: '', // Will be set after we have players array
  };
}

// ─── Teams Match Calculation ─────────────────────────────────

function calculateTeamsMatch(
  teamA: GamePlayerRow[],
  teamB: GamePlayerRow[],
  scores: ScoreRow[],
  settings: MatchPlaySettings,
  players: GamePlayerRow[],
): MatchPlayMatchStatus {
  const numHoles = settings.num_holes ?? 18;
  const handicapMode = settings.handicap_mode as HandicapMode;
  const strokeIndex = settings.hole_handicap_ratings ?? DEFAULT_STROKE_INDEX;

  // For teams best ball, use "off the low" handicap (like skins)
  // Each player gets strokes = their hcp - lowest hcp in the match
  const allPlayers = [...teamA, ...teamB];
  const handicaps = allPlayers.map((p) => getPlayerHandicap(p));
  const lowestHandicap = Math.min(...handicaps);
  const multiplier = handicapMode === 'none' ? 0 : handicapMode === 'full' ? 1.0 : 0.8;

  const strokeMaps = new Map<string, Map<number, number>>();
  for (const player of allPlayers) {
    if (handicapMode === 'none') {
      strokeMaps.set(player.id, new Map());
    } else {
      const hcp = getPlayerHandicap(player);
      const diff = hcp - lowestHandicap;
      const strokesReceived = Math.round(diff * multiplier);
      strokeMaps.set(player.id, allocateStrokesToHoles(strokesReceived, strokeIndex));
    }
  }

  // Use team A's first player ID as "playerA" and team B's first as "playerB"
  // for the match status structure
  const playerAId = teamA[0].id;
  const playerBId = teamB[0].id;

  const holeResults: HoleResult[] = [];
  let aHolesWon = 0;
  let bHolesWon = 0;
  let matchClosed = false;

  for (let hole = 1; hole <= numHoles; hole++) {
    if (matchClosed) break;

    // Best ball for team A
    let bestNetA = Infinity;
    let allScoredA = false;
    for (const p of teamA) {
      const score = getScore(scores, p.id, hole);
      if (score) {
        const net = score.strokes - (strokeMaps.get(p.id)?.get(hole) ?? 0);
        bestNetA = Math.min(bestNetA, net);
        allScoredA = true;
      }
    }

    // Best ball for team B
    let bestNetB = Infinity;
    let allScoredB = false;
    for (const p of teamB) {
      const score = getScore(scores, p.id, hole);
      if (score) {
        const net = score.strokes - (strokeMaps.get(p.id)?.get(hole) ?? 0);
        bestNetB = Math.min(bestNetB, net);
        allScoredB = true;
      }
    }

    if (!allScoredA || !allScoredB) break;

    let winnerId: string | null = null;
    if (bestNetA < bestNetB) {
      winnerId = playerAId; // Team A wins
      aHolesWon++;
    } else if (bestNetB < bestNetA) {
      winnerId = playerBId; // Team B wins
      bHolesWon++;
    }

    holeResults.push({
      holeNumber: hole,
      winnerId,
      playerANet: bestNetA,
      playerBNet: bestNetB,
    });

    const holesRemaining = numHoles - hole;
    const margin = Math.abs(aHolesWon - bHolesWon);
    if (margin > holesRemaining) {
      matchClosed = true;
    }
  }

  const holesPlayed = holeResults.length;
  const holesRemaining = numHoles - holesPlayed;
  const margin = Math.abs(aHolesWon - bHolesWon);

  let leaderId: string | null = null;
  if (aHolesWon > bHolesWon) leaderId = playerAId;
  else if (bHolesWon > aHolesWon) leaderId = playerBId;

  const isComplete = matchClosed || holesPlayed === numHoles;
  const isDormie = !matchClosed && margin === holesRemaining && margin > 0 && holesRemaining > 0;

  return {
    playerAId,
    playerBId,
    holeResults,
    leaderId,
    margin,
    holesPlayed,
    holesRemaining: matchClosed ? (numHoles - holesPlayed) : holesRemaining,
    isComplete,
    isDormie,
    statusText: '', // Set below
  };
}

// ─── Main Calculator ─────────────────────────────────────────

export function calculateMatchPlayStatus(
  input: MatchPlayCalculatorInput,
): MatchPlayLiveStatus {
  const { settings, players, scores } = input;
  const numHoles = settings.num_holes ?? 18;
  const matches: MatchPlayMatchStatus[] = [];

  if (settings.match_type === 'teams' && settings.team_a && settings.team_b) {
    // Teams: one match — team A vs team B
    const teamA = settings.team_a.map((id) => players.find((p) => p.id === id)!).filter(Boolean);
    const teamB = settings.team_b.map((id) => players.find((p) => p.id === id)!).filter(Boolean);

    if (teamA.length > 0 && teamB.length > 0) {
      const match = calculateTeamsMatch(teamA, teamB, scores, settings, players);
      match.statusText = generateStatusText(
        match.leaderId,
        match.margin,
        match.holesRemaining,
        match.isComplete,
        match.playerAId,
        match.playerBId,
        players,
      );
      matches.push(match);
    }
  } else {
    // Singles: round-robin pairwise matches
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const match = calculateSinglesMatch(players[i], players[j], scores, settings);
        match.statusText = generateStatusText(
          match.leaderId,
          match.margin,
          match.holesRemaining,
          match.isComplete,
          match.playerAId,
          match.playerBId,
          players,
        );
        matches.push(match);
      }
    }
  }

  // Current hole = max holes played across all matches
  const currentHole = matches.length > 0
    ? Math.max(...matches.map((m) => m.holesPlayed))
    : 0;

  // Round is complete when all matches are complete
  const isRoundComplete = matches.length > 0 && matches.every((m) => m.isComplete);

  return {
    matches,
    currentHole,
    isRoundComplete,
  };
}

// ─── Settlement Calculator ───────────────────────────────────

/**
 * Calculate settlements for a completed match play game.
 *
 * Singles: for each match, winner gets total_bet from loser. Halved = $0.
 * Teams: winning team splits the pot. Each loser pays total_bet to the
 *        corresponding winner.
 */
export function calculateMatchPlaySettlements(
  input: MatchPlayCalculatorInput,
): MatchPlaySettlement[] {
  const status = calculateMatchPlayStatus(input);
  const { settings, players } = input;
  const settlements: MatchPlaySettlement[] = [];

  if (settings.match_type === 'teams' && settings.team_a && settings.team_b) {
    // Teams: one match, team settlements
    const match = status.matches[0];
    if (!match || !match.isComplete || match.leaderId === null) return settlements;

    const teamAIds = new Set(settings.team_a);
    const winningTeamIds = teamAIds.has(match.leaderId) ? settings.team_a : settings.team_b;
    const losingTeamIds = teamAIds.has(match.leaderId) ? settings.team_b : settings.team_a;

    // Each loser pays each winner (total_bet split evenly)
    // With 2v2: each loser pays total_bet to each winner
    // So net per person = total_bet
    for (const loserId of losingTeamIds) {
      for (const winnerId of winningTeamIds) {
        const amount = settings.total_bet / winningTeamIds.length;
        const margin = match.margin;
        const holesRemaining = match.holesRemaining;

        const breakdown: SettlementBreakdownItem[] = [{
          label: holesRemaining > 0
            ? `Match Play: ${margin}&${holesRemaining}`
            : `Match Play: ${margin} UP`,
          amount,
        }];

        settlements.push({
          fromPlayerId: loserId,
          toPlayerId: winnerId,
          amount,
          breakdown,
        });
      }
    }
  } else {
    // Singles: each match settles independently
    for (const match of status.matches) {
      if (!match.isComplete) continue;
      if (match.leaderId === null || match.margin === 0) continue; // Halved

      const loserId = match.leaderId === match.playerAId
        ? match.playerBId
        : match.playerAId;

      const margin = match.margin;
      const holesRemaining = match.holesRemaining;

      const breakdown: SettlementBreakdownItem[] = [{
        label: holesRemaining > 0
          ? `Match Play: ${margin}&${holesRemaining}`
          : `Match Play: ${margin} UP`,
        amount: settings.total_bet,
      }];

      settlements.push({
        fromPlayerId: loserId,
        toPlayerId: match.leaderId,
        amount: settings.total_bet,
        breakdown,
      });
    }
  }

  return settlements;
}
