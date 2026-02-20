/**
 * Wolf Scoring Calculator
 *
 * Pure logic — no React, no Supabase. Takes game data in, returns
 * wolf status and settlement amounts out.
 *
 * Wolf = 4-player rotating format. Each hole:
 *   1. Wolf picks a partner (or goes solo/blind) BEFORE seeing tee shots.
 *   2. Wolf team (wolf + partner) vs Field (other 2 players).
 *   3. Best ball per side determines winner.
 *   4. Points awarded: 1x (partner), 2x (solo wolf), 3x (blind wolf).
 *
 * Settlement: pairwise point differential * point_value.
 *
 * Handicap: "off the low" — same approach as Skins.
 * Wolf rotation: 1-2-3-4 repeat. Holes 17-18: last place is wolf.
 */

import type {
  WolfSettings,
  GamePlayerRow,
  ScoreRow,
  WolfChoiceRow,
  WolfHoleResult,
  WolfLiveStatus,
  WolfSettlement,
  SettlementBreakdownItem,
} from '../types/database';
import { allocateStrokesToHoles, DEFAULT_STROKE_INDEX } from './handicap';
import type { HandicapMode } from './handicap';

// ─── Input ───────────────────────────────────────────────────

export interface WolfCalculatorInput {
  settings: WolfSettings;
  players: GamePlayerRow[];
  scores: ScoreRow[];
  wolfChoices: WolfChoiceRow[];
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
 * Calculate "off the low" handicap strokes for wolf (same as skins).
 * Returns Map per player: playerId → Map<holeNumber, strokesOnHole>.
 */
function calculateWolfStrokes(
  players: GamePlayerRow[],
  handicapMode: HandicapMode,
  strokeIndex?: number[],
): Map<string, Map<number, number>> {
  const result = new Map<string, Map<number, number>>();

  if (handicapMode === 'none') {
    for (const p of players) {
      result.set(p.id, new Map());
    }
    return result;
  }

  const handicaps = players.map((p) => getPlayerHandicap(p));
  const lowestHandicap = Math.min(...handicaps);
  const multiplier = handicapMode === 'full' ? 1.0 : 0.8;
  const idx = strokeIndex ?? DEFAULT_STROKE_INDEX;

  for (const player of players) {
    const hcp = getPlayerHandicap(player);
    const diff = hcp - lowestHandicap;
    const strokesReceived = Math.round(diff * multiplier);
    result.set(player.id, allocateStrokesToHoles(strokesReceived, idx));
  }

  return result;
}

/**
 * Get the wolf player ID for a given hole.
 * Standard rotation: wolf_order cycles 1-2-3-4.
 * Holes 17 & 18: last place in points is the wolf (or fall back to rotation).
 */
function getWolfForHole(
  holeNumber: number,
  wolfOrder: string[],
  pointTotals: Map<string, number>,
): string {
  // Holes 17-18: last place player is wolf
  if (holeNumber >= 17 && wolfOrder.length === 4) {
    let minPoints = Infinity;
    let lastPlaceId = wolfOrder[0];
    for (const pid of wolfOrder) {
      const pts = pointTotals.get(pid) ?? 0;
      if (pts < minPoints) {
        minPoints = pts;
        lastPlaceId = pid;
      }
    }
    return lastPlaceId;
  }

  // Standard rotation
  const idx = (holeNumber - 1) % wolfOrder.length;
  return wolfOrder[idx];
}

// ─── Main Calculator ─────────────────────────────────────────

export function calculateWolfStatus(
  input: WolfCalculatorInput,
): WolfLiveStatus {
  const { settings, players, scores, wolfChoices } = input;
  const numHoles = settings.num_holes ?? 18;
  const handicapMode = settings.handicap_mode as HandicapMode;
  const wolfOrder = settings.wolf_order ?? players.map((p) => p.id);
  const strokeMaps = calculateWolfStrokes(
    players,
    handicapMode,
    settings.hole_handicap_ratings,
  );

  const holeResults: WolfHoleResult[] = [];
  const pointTotals = new Map<string, number>();
  for (const p of players) {
    pointTotals.set(p.id, 0);
  }

  let currentWolfId: string | null = null;
  let needsWolfChoice = false;
  let availablePartners: string[] = [];

  for (let hole = 1; hole <= numHoles; hole++) {
    // Determine wolf for this hole
    const wolfId = getWolfForHole(hole, wolfOrder, pointTotals);

    // Check if we have a wolf choice for this hole
    const choice = wolfChoices.find(
      (c) => c.hole_number === hole && c.wolf_player_id === wolfId,
    );

    // Check if all players have scores for this hole
    const holeScores: { playerId: string; netScore: number }[] = [];
    let allScored = true;

    for (const player of players) {
      const score = getScore(scores, player.id, hole);
      if (!score) {
        allScored = false;
        break;
      }
      const strokes = strokeMaps.get(player.id)?.get(hole) ?? 0;
      const netScore = score.strokes - strokes;
      holeScores.push({ playerId: player.id, netScore });
    }

    // If no wolf choice yet for this hole, flag it
    if (!choice) {
      currentWolfId = wolfId;
      needsWolfChoice = true;
      availablePartners = players
        .filter((p) => p.id !== wolfId)
        .map((p) => p.id);
      // Don't process further holes — wolf must choose first
      break;
    }

    // Wolf has chosen — if scores aren't complete yet, stop here
    if (!allScored) {
      currentWolfId = wolfId;
      needsWolfChoice = false;
      availablePartners = [];
      break;
    }

    // ── Score the hole ──
    const choiceType = choice.choice_type === 'solo'
      ? (choice.partner_id === null ? 'solo' : 'partner')
      : choice.choice_type;

    // Determine if this is a blind wolf
    // Blind wolf = solo choice made before any tee shots (we mark it as 'solo' with no partner)
    // We treat all solo choices as either solo (2x) or blind (3x)
    // For simplicity: if settings.blind_wolf is enabled and choice_type is 'solo',
    // we check if partner_id is null — true solo = blind if blindWolf feature is on
    const isBlind = settings.blind_wolf && choice.choice_type === 'solo' && choice.partner_id === null;
    const isSolo = choice.choice_type === 'solo' && !isBlind;

    const multiplier = isBlind ? 3 : isSolo ? 2 : 1;

    const wolfTeamIds = choice.partner_id
      ? [wolfId, choice.partner_id]
      : [wolfId];
    const fieldIds = players
      .filter((p) => !wolfTeamIds.includes(p.id))
      .map((p) => p.id);

    // Best ball for wolf team
    const wolfTeamScores = holeScores.filter((s) => wolfTeamIds.includes(s.playerId));
    const wolfBestBall = Math.min(...wolfTeamScores.map((s) => s.netScore));

    // Best ball for field
    const fieldScores = holeScores.filter((s) => fieldIds.includes(s.playerId));
    const fieldBestBall = Math.min(...fieldScores.map((s) => s.netScore));

    // Determine winner
    let winningTeam: 'wolf' | 'field' | 'tie';
    if (wolfBestBall < fieldBestBall) {
      winningTeam = 'wolf';
    } else if (fieldBestBall < wolfBestBall) {
      winningTeam = 'field';
    } else {
      winningTeam = 'tie';
    }

    // Calculate points for each player
    const pointsPerPlayer: { playerId: string; points: number }[] = [];

    if (winningTeam === 'wolf') {
      // Wolf team wins: each wolf team member gets +multiplier from each field member
      for (const pid of wolfTeamIds) {
        pointsPerPlayer.push({ playerId: pid, points: multiplier * fieldIds.length });
      }
      for (const pid of fieldIds) {
        pointsPerPlayer.push({ playerId: pid, points: -multiplier * wolfTeamIds.length });
      }
    } else if (winningTeam === 'field') {
      // Field wins: each field member gets +multiplier from each wolf team member
      for (const pid of wolfTeamIds) {
        pointsPerPlayer.push({ playerId: pid, points: -multiplier * fieldIds.length });
      }
      for (const pid of fieldIds) {
        pointsPerPlayer.push({ playerId: pid, points: multiplier * wolfTeamIds.length });
      }
    } else {
      // Tie: no points
      for (const p of players) {
        pointsPerPlayer.push({ playerId: p.id, points: 0 });
      }
    }

    // Update running totals
    for (const pp of pointsPerPlayer) {
      pointTotals.set(pp.playerId, (pointTotals.get(pp.playerId) ?? 0) + pp.points);
    }

    const actualChoiceType: 'solo' | 'partner' | 'blind' = isBlind
      ? 'blind'
      : choice.partner_id
      ? 'partner'
      : 'solo';

    holeResults.push({
      holeNumber: hole,
      wolfPlayerId: wolfId,
      choiceType: actualChoiceType,
      partnerId: choice.partner_id,
      winningTeam,
      pointsPerPlayer,
      multiplier,
    });

    // Update current wolf for next iteration
    currentWolfId = wolfId;
    needsWolfChoice = false;
    availablePartners = [];
  }

  // Build final status
  const currentHole = holeResults.length > 0
    ? holeResults[holeResults.length - 1].holeNumber
    : 0;

  const isRoundComplete = holeResults.length === numHoles;

  // If we didn't break early, figure out the next wolf
  if (!needsWolfChoice && !isRoundComplete) {
    const nextHole = currentHole + 1;
    if (nextHole <= numHoles) {
      currentWolfId = getWolfForHole(nextHole, wolfOrder, pointTotals);
      // Check if choice exists for next hole
      const nextChoice = wolfChoices.find(
        (c) => c.hole_number === nextHole && c.wolf_player_id === currentWolfId,
      );
      if (!nextChoice) {
        needsWolfChoice = true;
        availablePartners = players
          .filter((p) => p.id !== currentWolfId)
          .map((p) => p.id);
      }
    }
  }

  const pointTotalsArr = players.map((p) => ({
    playerId: p.id,
    totalPoints: pointTotals.get(p.id) ?? 0,
  }));

  return {
    holeResults,
    pointTotals: pointTotalsArr,
    currentWolfId,
    wolfRotation: wolfOrder,
    currentHole,
    isRoundComplete,
    needsWolfChoice,
    availablePartners,
  };
}

// ─── Settlement Calculator ───────────────────────────────────

/**
 * Calculate pairwise settlements for a completed wolf game.
 *
 * For each pair (A, B):
 *   pointDiff = A's total - B's total
 *   amount = |pointDiff| * point_value
 *   loser pays winner
 */
export function calculateWolfSettlements(
  input: WolfCalculatorInput,
): WolfSettlement[] {
  const status = calculateWolfStatus(input);
  const { settings, players } = input;
  const settlements: WolfSettlement[] = [];

  // Build points lookup
  const pointsMap = new Map<string, number>();
  for (const pt of status.pointTotals) {
    pointsMap.set(pt.playerId, pt.totalPoints);
  }

  // Generate pairwise settlements
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const playerA = players[i];
      const playerB = players[j];
      const aPoints = pointsMap.get(playerA.id) ?? 0;
      const bPoints = pointsMap.get(playerB.id) ?? 0;
      const pointDiff = aPoints - bPoints;

      if (pointDiff === 0) continue;

      const amount = Math.abs(pointDiff) * settings.point_value;
      const breakdown: SettlementBreakdownItem[] = [];

      if (pointDiff > 0) {
        // A won more — B owes A
        breakdown.push({
          label: `Wolf points: ${aPoints} vs ${bPoints}`,
          amount: -amount,
        });
        settlements.push({
          fromPlayerId: playerB.id,
          toPlayerId: playerA.id,
          amount,
          breakdown,
        });
      } else {
        // B won more — A owes B
        breakdown.push({
          label: `Wolf points: ${aPoints} vs ${bPoints}`,
          amount,
        });
        settlements.push({
          fromPlayerId: playerA.id,
          toPlayerId: playerB.id,
          amount,
          breakdown,
        });
      }
    }
  }

  return settlements;
}
