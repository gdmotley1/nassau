/**
 * Nassau Scoring Calculator
 *
 * Pure logic — no React, no Supabase. Takes game data in, returns
 * match statuses, press suggestions, and settlement amounts out.
 *
 * Nassau = 3 independent match-play bets per player pair:
 *   - Front 9 (holes 1-9)
 *   - Back 9 (holes 10-18)
 *   - Overall 18
 *
 * Each hole: lowest net score wins the hole. Tie = halved.
 * Bet region leader = whoever has won more holes in that region.
 *
 * Presses: when trailing by 2+ holes, trailing player can start
 * a new side bet for the remaining holes in that region.
 */

import type {
  NassauSettings,
  GamePlayerRow,
  GameBetRow,
  ScoreRow,
  NassauMatchStatus,
  BetRegionStatus,
  HoleResult,
  PressStatus,
  NassauLiveStatus,
  SuggestedPress,
  NassauSettlement,
  SettlementBreakdownItem,
} from '../types/database';
import { calculateMatchStrokes, type HandicapMode } from './handicap';

// ─── Helpers ──────────────────────────────────────────────────

function getPlayerHandicap(player: GamePlayerRow): number {
  return player.handicap_used ?? player.guest_handicap ?? 0;
}

function getPlayerName(player: GamePlayerRow): string {
  return player.guest_name ?? player.user_id ?? 'Unknown';
}

/** Get the score for a specific player on a specific hole, or null if not entered */
function getScore(
  scores: ScoreRow[],
  playerId: string,
  holeNumber: number,
): ScoreRow | null {
  return scores.find(
    (s) => s.player_id === playerId && s.hole_number === holeNumber,
  ) ?? null;
}

/** Determine which holes belong to which region */
function getRegionHoles(region: 'front' | 'back' | 'overall'): number[] {
  switch (region) {
    case 'front':
      return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    case 'back':
      return [10, 11, 12, 13, 14, 15, 16, 17, 18];
    case 'overall':
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  }
}

function getBetRegion(betType: string): 'front' | 'back' | 'overall' {
  if (betType.startsWith('front')) return 'front';
  if (betType.startsWith('back')) return 'back';
  return 'overall';
}

// ─── Bet Region Scoring ───────────────────────────────────────

interface RegionInput {
  betId: string;
  holes: number[];
  playerAId: string;
  playerBId: string;
  scores: ScoreRow[];
  strokesA: Map<number, number>;
  strokesB: Map<number, number>;
  holePars: number[];
}

function scoreBetRegion(input: RegionInput): BetRegionStatus {
  const { betId, holes, playerAId, playerBId, scores, strokesA, strokesB } = input;

  const holeResults: HoleResult[] = [];
  let aWins = 0;
  let bWins = 0;
  let holesPlayed = 0;

  for (const hole of holes) {
    const scoreA = getScore(scores, playerAId, hole);
    const scoreB = getScore(scores, playerBId, hole);

    if (!scoreA || !scoreB) continue; // Hole not yet played by both

    holesPlayed++;

    const netA = scoreA.strokes - (strokesA.get(hole) ?? 0);
    const netB = scoreB.strokes - (strokesB.get(hole) ?? 0);

    let winnerId: string | null = null;
    if (netA < netB) {
      winnerId = playerAId;
      aWins++;
    } else if (netB < netA) {
      winnerId = playerBId;
      bWins++;
    }
    // else: halved, no winner

    holeResults.push({
      holeNumber: hole,
      winnerId,
      playerANet: netA,
      playerBNet: netB,
    });
  }

  const margin = Math.abs(aWins - bWins);
  const holesRemaining = holes.length - holesPlayed;
  const isComplete = holesPlayed === holes.length || margin > holesRemaining;

  let leaderId: string | null = null;
  if (aWins > bWins) leaderId = playerAId;
  else if (bWins > aWins) leaderId = playerBId;

  return {
    betId,
    leaderId,
    margin,
    holesPlayed,
    isComplete,
    holeResults,
  };
}

// ─── Press Scoring ────────────────────────────────────────────

function scorePress(
  press: GameBetRow,
  playerAId: string,
  playerBId: string,
  scores: ScoreRow[],
  strokesA: Map<number, number>,
  strokesB: Map<number, number>,
): PressStatus {
  // Parse press metadata from bet_type: "front_press", "back_press", "overall_press"
  const region = getBetRegion(press.bet_type);
  const regionHoles = getRegionHoles(region);

  // Press starts from a specific hole — derive from scores or default
  // We store the start hole implicitly: the press covers remaining holes
  // from when it was initiated. For simplicity, we look at which holes
  // have scores after the press was created.
  const pressCreatedAt = new Date(press.created_at).getTime();

  // Determine start hole: find the first hole in the region where
  // scores were entered AFTER the press was created, or use the
  // first unscored hole at time of press creation.
  let startHole = regionHoles[0];
  const endHole = regionHoles[regionHoles.length - 1];

  // Find holes that both players have scored
  const scoredHoles = regionHoles.filter((hole) => {
    const sA = getScore(scores, playerAId, hole);
    const sB = getScore(scores, playerBId, hole);
    return sA && sB;
  });

  // Heuristic: the press starts at the first hole in the region
  // that wasn't yet fully scored when the press was created.
  // We approximate by counting how many holes were scored before press creation.
  const holesBeforePress = scoredHoles.filter((hole) => {
    const sA = getScore(scores, playerAId, hole);
    return sA && new Date(sA.created_at).getTime() < pressCreatedAt;
  });
  const startIndex = Math.min(holesBeforePress.length, regionHoles.length - 1);
  startHole = regionHoles[startIndex];

  // Now score only the holes from startHole to endHole
  const pressHoles = regionHoles.filter((h) => h >= startHole);

  let aWins = 0;
  let bWins = 0;
  let holesPlayed = 0;

  for (const hole of pressHoles) {
    const scoreA = getScore(scores, playerAId, hole);
    const scoreB = getScore(scores, playerBId, hole);
    if (!scoreA || !scoreB) continue;

    holesPlayed++;
    const netA = scoreA.strokes - (strokesA.get(hole) ?? 0);
    const netB = scoreB.strokes - (strokesB.get(hole) ?? 0);

    if (netA < netB) aWins++;
    else if (netB < netA) bWins++;
  }

  const margin = Math.abs(aWins - bWins);
  const holesRemaining = pressHoles.length - holesPlayed;
  const isComplete = holesPlayed === pressHoles.length || margin > holesRemaining;

  let leaderId: string | null = null;
  if (aWins > bWins) leaderId = playerAId;
  else if (bWins > aWins) leaderId = playerBId;

  return {
    betId: press.id,
    parentBetId: press.parent_bet_id ?? '',
    betType: press.bet_type,
    startHole,
    endHole,
    amount: press.amount,
    leaderId,
    margin,
    holesPlayed,
    isComplete,
    initiatedBy: '', // Will be determined by caller context
  };
}

// ─── Main Calculator ──────────────────────────────────────────

export interface NassauCalculatorInput {
  settings: NassauSettings;
  players: GamePlayerRow[];
  bets: GameBetRow[];
  scores: ScoreRow[];
}

/**
 * Calculate the full live status for a Nassau game.
 *
 * Handles 2, 3, or 4 players by computing round-robin matches:
 * - 2 players: 1 match
 * - 3 players: 3 matches
 * - 4 players: 6 matches
 */
export function calculateNassauStatus(
  input: NassauCalculatorInput,
): NassauLiveStatus {
  const { settings, players, bets, scores } = input;

  const numHoles = settings.num_holes ?? 18;
  const is9Hole = numHoles === 9;
  const holePars = settings.hole_pars ?? Array(numHoles).fill(4);
  const strokeIndex = settings.hole_handicap_ratings;
  const handicapMode = settings.handicap_mode as HandicapMode;

  // Generate all player pairs for round-robin
  const pairs: [GamePlayerRow, GamePlayerRow][] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      pairs.push([players[i], players[j]]);
    }
  }

  const matches: NassauMatchStatus[] = [];
  const suggestedPresses: SuggestedPress[] = [];

  for (const [playerA, playerB] of pairs) {
    const handicapA = getPlayerHandicap(playerA);
    const handicapB = getPlayerHandicap(playerB);

    const { strokesA, strokesB } = calculateMatchStrokes(
      handicapA,
      handicapB,
      handicapMode,
      strokeIndex,
    );

    // Find the base bets for this pair
    const frontBet = bets.find(
      (b) =>
        b.bet_type === 'front_9' &&
        b.parent_bet_id === null &&
        ((b.player_a_id === playerA.id && b.player_b_id === playerB.id) ||
          (b.player_a_id === playerB.id && b.player_b_id === playerA.id)),
    );
    const backBet = bets.find(
      (b) =>
        b.bet_type === 'back_9' &&
        b.parent_bet_id === null &&
        ((b.player_a_id === playerA.id && b.player_b_id === playerB.id) ||
          (b.player_a_id === playerB.id && b.player_b_id === playerA.id)),
    );
    const overallBet = bets.find(
      (b) =>
        b.bet_type === 'overall_18' &&
        b.parent_bet_id === null &&
        ((b.player_a_id === playerA.id && b.player_b_id === playerB.id) ||
          (b.player_a_id === playerB.id && b.player_b_id === playerA.id)),
    );

    // For 9-hole games, only front_9 bet exists
    if (!frontBet) continue;
    if (!is9Hole && (!backBet || !overallBet)) continue;

    // Score each region
    const frontNine = scoreBetRegion({
      betId: frontBet.id,
      holes: getRegionHoles('front'),
      playerAId: playerA.id,
      playerBId: playerB.id,
      scores,
      strokesA,
      strokesB,
      holePars,
    });

    // Empty region status for 9-hole games
    const emptyRegion: BetRegionStatus = {
      betId: '',
      leaderId: null,
      margin: 0,
      holesPlayed: 0,
      isComplete: true,
      holeResults: [],
    };

    const backNine = is9Hole ? emptyRegion : scoreBetRegion({
      betId: backBet!.id,
      holes: getRegionHoles('back'),
      playerAId: playerA.id,
      playerBId: playerB.id,
      scores,
      strokesA,
      strokesB,
      holePars,
    });

    const overall = is9Hole ? emptyRegion : scoreBetRegion({
      betId: overallBet!.id,
      holes: getRegionHoles('overall'),
      playerAId: playerA.id,
      playerBId: playerB.id,
      scores,
      strokesA,
      strokesB,
      holePars,
    });

    // Score active presses for this pair
    const pairPresses = bets.filter(
      (b) =>
        b.parent_bet_id !== null &&
        ((b.player_a_id === playerA.id && b.player_b_id === playerB.id) ||
          (b.player_a_id === playerB.id && b.player_b_id === playerA.id)),
    );

    const presses: PressStatus[] = pairPresses.map((press) =>
      scorePress(press, playerA.id, playerB.id, scores, strokesA, strokesB),
    );

    matches.push({
      playerAId: playerA.id,
      playerBId: playerB.id,
      frontNine,
      backNine,
      overall,
      presses,
    });

    // Check for auto-press suggestions
    if (settings.auto_press) {
      const pressCount = pairPresses.filter((p) =>
        p.bet_type.includes('front'),
      ).length;
      const pressLimit = settings.press_limit; // 0 = unlimited

      // Front 9: suggest press if trailing by 2+
      if (
        frontNine.margin >= 2 &&
        !frontNine.isComplete &&
        (pressLimit === 0 || pressCount < pressLimit)
      ) {
        const trailingId =
          frontNine.leaderId === playerA.id ? playerB.id : playerA.id;
        suggestedPresses.push({
          matchPlayerAId: playerA.id,
          matchPlayerBId: playerB.id,
          betType: 'front_press',
          startHole: frontNine.holesPlayed + 1,
          trailingPlayerId: trailingId,
          parentBetId: frontBet.id,
          reason: `${frontNine.margin} down on front 9`,
        });
      }

      // Back 9 (skip for 9-hole games)
      if (!is9Hole && backBet) {
        const backPressCount = pairPresses.filter((p) =>
          p.bet_type.includes('back'),
        ).length;
        if (
          backNine.margin >= 2 &&
          !backNine.isComplete &&
          (pressLimit === 0 || backPressCount < pressLimit)
        ) {
          const trailingId =
            backNine.leaderId === playerA.id ? playerB.id : playerA.id;
          suggestedPresses.push({
            matchPlayerAId: playerA.id,
            matchPlayerBId: playerB.id,
            betType: 'back_press',
            startHole: backNine.holesPlayed + 10,
            trailingPlayerId: trailingId,
            parentBetId: backBet.id,
            reason: `${backNine.margin} down on back 9`,
          });
        }
      }

      // Overall (skip for 9-hole games)
      if (!is9Hole && overallBet) {
        const overallPressCount = pairPresses.filter((p) =>
          p.bet_type.includes('overall'),
        ).length;
        if (
          overall.margin >= 2 &&
          !overall.isComplete &&
          (pressLimit === 0 || overallPressCount < pressLimit)
        ) {
          const trailingId =
            overall.leaderId === playerA.id ? playerB.id : playerA.id;
          suggestedPresses.push({
            matchPlayerAId: playerA.id,
            matchPlayerBId: playerB.id,
            betType: 'overall_press',
            startHole: overall.holesPlayed + 1,
            trailingPlayerId: trailingId,
            parentBetId: overallBet.id,
            reason: `${overall.margin} down overall`,
          });
        }
      }
    }
  }

  // Determine current hole (highest hole number with any score)
  const currentHole = scores.length > 0
    ? Math.max(...scores.map((s) => s.hole_number))
    : 0;

  // Round is complete when all matches are complete in all active regions
  const isRoundComplete = matches.length > 0 && matches.every(
    (m) => is9Hole
      ? m.frontNine.isComplete
      : m.frontNine.isComplete && m.backNine.isComplete && m.overall.isComplete,
  );

  return {
    matches,
    currentHole,
    isRoundComplete,
    suggestedPresses,
  };
}

// ─── Settlement Calculator ────────────────────────────────────

/**
 * Calculate final settlements for a completed Nassau game.
 *
 * For each bet (front/back/overall + presses), the loser pays the winner.
 * If a bet is "all square" (tied), no money changes hands.
 *
 * Returns a list of net settlements per player pair.
 */
export function calculateNassauSettlements(
  input: NassauCalculatorInput,
): NassauSettlement[] {
  const status = calculateNassauStatus(input);
  const { settings, bets } = input;
  const is9Hole = (settings.num_holes ?? 18) === 9;
  const settlements: NassauSettlement[] = [];

  for (const match of status.matches) {
    const breakdown: SettlementBreakdownItem[] = [];
    let netAmount = 0; // positive = A owes B, negative = B owes A

    // Front 9 (or only bet for 9-hole games)
    if (match.frontNine.leaderId) {
      const amount = settings.front_bet;
      const label = is9Hole ? 'Match' : 'Front 9';
      if (match.frontNine.leaderId === match.playerAId) {
        netAmount -= amount; // A wins, B owes A
        breakdown.push({ label, amount: -amount });
      } else {
        netAmount += amount; // B wins, A owes B
        breakdown.push({ label, amount });
      }
    } else {
      breakdown.push({ label: is9Hole ? 'Match' : 'Front 9', amount: 0 });
    }

    // Back 9 (skip for 9-hole games)
    if (!is9Hole) {
      if (match.backNine.leaderId) {
        const amount = settings.back_bet;
        if (match.backNine.leaderId === match.playerAId) {
          netAmount -= amount;
          breakdown.push({ label: 'Back 9', amount: -amount });
        } else {
          netAmount += amount;
          breakdown.push({ label: 'Back 9', amount });
        }
      } else {
        breakdown.push({ label: 'Back 9', amount: 0 });
      }

      // Overall 18
      if (match.overall.leaderId) {
        const amount = settings.overall_bet;
        if (match.overall.leaderId === match.playerAId) {
          netAmount -= amount;
          breakdown.push({ label: 'Overall 18', amount: -amount });
        } else {
          netAmount += amount;
          breakdown.push({ label: 'Overall 18', amount });
        }
      } else {
        breakdown.push({ label: 'Overall 18', amount: 0 });
      }
    }

    // Presses
    for (let i = 0; i < match.presses.length; i++) {
      const press = match.presses[i];
      if (press.leaderId) {
        const amount = press.amount;
        const regionLabel = press.betType.includes('front')
          ? 'Front'
          : press.betType.includes('back')
          ? 'Back'
          : 'Overall';
        const label = `${regionLabel} Press #${i + 1}`;

        if (press.leaderId === match.playerAId) {
          netAmount -= amount;
          breakdown.push({ label, amount: -amount });
        } else {
          netAmount += amount;
          breakdown.push({ label, amount });
        }
      }
    }

    // Create settlement record
    if (netAmount !== 0) {
      if (netAmount > 0) {
        // A owes B
        settlements.push({
          fromPlayerId: match.playerAId,
          toPlayerId: match.playerBId,
          amount: netAmount,
          breakdown,
        });
      } else {
        // B owes A
        settlements.push({
          fromPlayerId: match.playerBId,
          toPlayerId: match.playerAId,
          amount: Math.abs(netAmount),
          breakdown: breakdown.map((b) => ({ ...b, amount: -b.amount })),
        });
      }
    }
  }

  return settlements;
}

/**
 * Aggregate settlements for a player across all their matches.
 * Returns total amount owed or earned (positive = they owe, negative = they're owed).
 */
export function getPlayerNetAmount(
  playerId: string,
  settlements: NassauSettlement[],
): number {
  let net = 0;
  for (const s of settlements) {
    if (s.fromPlayerId === playerId) net += s.amount; // They owe
    if (s.toPlayerId === playerId) net -= s.amount; // They're owed
  }
  return net;
}
