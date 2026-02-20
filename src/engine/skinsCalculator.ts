/**
 * Skins Scoring Calculator
 *
 * Pure logic — no React, no Supabase. Takes game data in, returns
 * skins status and settlement amounts out.
 *
 * Skins = per-hole bet where lowest net score wins the "skin."
 * Ties: carryover to next hole (if enabled) or dead.
 * Settlement: pairwise based on skin count difference × skin value.
 *
 * Handicap: "off the low" — each player gets strokes equal to
 * (their handicap - lowest handicap in the group), allocated
 * to the hardest holes via stroke index.
 */

import type {
  SkinsSettings,
  GamePlayerRow,
  ScoreRow,
  SkinsHoleResult,
  SkinsLiveStatus,
  SkinsSettlement,
  SettlementBreakdownItem,
} from '../types/database';
import { allocateStrokesToHoles, DEFAULT_STROKE_INDEX } from './handicap';
import type { HandicapMode } from './handicap';

// ─── Input ───────────────────────────────────────────────────

export interface SkinsCalculatorInput {
  settings: SkinsSettings;
  players: GamePlayerRow[];
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
 * Calculate "off the low" handicap strokes for skins.
 * Each player gets strokes = (their handicap - lowest handicap) * mode multiplier.
 * Returns a Map per player: playerId → Map<holeNumber, strokesOnHole>.
 */
function calculateSkinsStrokes(
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

// ─── Main Calculator ─────────────────────────────────────────

export function calculateSkinsStatus(
  input: SkinsCalculatorInput,
): SkinsLiveStatus {
  const { settings, players, scores } = input;
  const numHoles = settings.num_holes ?? 18;
  const handicapMode = settings.handicap_mode as HandicapMode;
  const strokeMaps = calculateSkinsStrokes(
    players,
    handicapMode,
    settings.hole_handicap_ratings,
  );

  const holeResults: SkinsHoleResult[] = [];
  const skinsCount = new Map<string, number>();
  for (const p of players) {
    skinsCount.set(p.id, 0);
  }

  let currentCarryover = 0;
  let totalSkinsAwarded = 0;

  for (let hole = 1; hole <= numHoles; hole++) {
    // Check if all players have scores for this hole
    const playerNetScores: { playerId: string; netScore: number }[] = [];
    let allScored = true;

    for (const player of players) {
      const score = getScore(scores, player.id, hole);
      if (!score) {
        allScored = false;
        break;
      }
      const strokes = strokeMaps.get(player.id)?.get(hole) ?? 0;
      const netScore = score.strokes - strokes;
      playerNetScores.push({ playerId: player.id, netScore });
    }

    if (!allScored) {
      // Stop processing — remaining holes haven't been played yet
      break;
    }

    // Find lowest net score
    const minNet = Math.min(...playerNetScores.map((p) => p.netScore));
    const winners = playerNetScores.filter((p) => p.netScore === minNet);

    const skinsAtStake = 1 + currentCarryover;

    if (winners.length === 1) {
      // One clear winner — they take all skins
      const winnerId = winners[0].playerId;
      skinsCount.set(winnerId, (skinsCount.get(winnerId) ?? 0) + skinsAtStake);
      totalSkinsAwarded += skinsAtStake;
      currentCarryover = 0;

      holeResults.push({
        holeNumber: hole,
        winnerId,
        skinsValue: skinsAtStake,
        isTied: false,
        playerNetScores,
      });
    } else {
      // Tie — handle carryover
      if (settings.allow_carryovers) {
        currentCarryover += 1;
      }
      // If carryovers off, skin is dead (currentCarryover stays the same)

      holeResults.push({
        holeNumber: hole,
        winnerId: null,
        skinsValue: skinsAtStake,
        isTied: true,
        playerNetScores,
      });
    }
  }

  // Handle final carryover on last hole
  const lastResult = holeResults.length > 0 ? holeResults[holeResults.length - 1] : null;
  if (
    lastResult &&
    lastResult.holeNumber === numHoles &&
    lastResult.isTied &&
    currentCarryover > 0 &&
    settings.split_final_ties
  ) {
    // Split remaining skins among tied players on last hole
    const minNet = Math.min(...lastResult.playerNetScores.map((p) => p.netScore));
    const tiedPlayers = lastResult.playerNetScores.filter((p) => p.netScore === minNet);
    const splitSkins = currentCarryover / tiedPlayers.length;

    for (const tp of tiedPlayers) {
      skinsCount.set(tp.playerId, (skinsCount.get(tp.playerId) ?? 0) + splitSkins);
      totalSkinsAwarded += splitSkins;
    }
    currentCarryover = 0;

    // Update the last hole result to reflect the split
    lastResult.winnerId = null; // still a tie, but skins were split
    lastResult.skinsValue = lastResult.skinsValue; // keeps original value
  }

  // Determine current hole
  const currentHole = holeResults.length > 0
    ? holeResults[holeResults.length - 1].holeNumber
    : 0;

  const isRoundComplete = holeResults.length === numHoles;

  const skinsPerPlayer = players.map((p) => ({
    playerId: p.id,
    skinsWon: skinsCount.get(p.id) ?? 0,
  }));

  return {
    holeResults,
    skinsPerPlayer,
    currentCarryover,
    currentHole,
    isRoundComplete,
    totalSkinsAwarded,
    totalSkinsAvailable: numHoles,
  };
}

// ─── Settlement Calculator ───────────────────────────────────

/**
 * Calculate pairwise settlements for a completed skins game.
 *
 * For each pair (A, B):
 *   net = (A's skins - B's skins) × skin_value
 *   If positive, B owes A. If negative, A owes B.
 */
export function calculateSkinsSettlements(
  input: SkinsCalculatorInput,
): SkinsSettlement[] {
  const status = calculateSkinsStatus(input);
  const { settings, players } = input;
  const settlements: SkinsSettlement[] = [];

  // Build skins lookup
  const skinsMap = new Map<string, number>();
  for (const sp of status.skinsPerPlayer) {
    skinsMap.set(sp.playerId, sp.skinsWon);
  }

  // Generate pairwise settlements
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const playerA = players[i];
      const playerB = players[j];
      const aSkins = skinsMap.get(playerA.id) ?? 0;
      const bSkins = skinsMap.get(playerB.id) ?? 0;
      const skinDiff = aSkins - bSkins;

      if (skinDiff === 0) continue; // No money changes hands

      const amount = Math.abs(skinDiff) * settings.skin_value;
      const breakdown: SettlementBreakdownItem[] = [];

      if (skinDiff > 0) {
        // A won more skins — B owes A
        breakdown.push({
          label: `Skins: ${aSkins} vs ${bSkins}`,
          amount: -amount, // negative = A won
        });
        settlements.push({
          fromPlayerId: playerB.id,
          toPlayerId: playerA.id,
          amount,
          breakdown,
        });
      } else {
        // B won more skins — A owes B
        breakdown.push({
          label: `Skins: ${aSkins} vs ${bSkins}`,
          amount, // positive = A lost
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
