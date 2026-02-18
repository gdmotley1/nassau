/**
 * USGA Handicap Stroke Allocation for Nassau Match Play
 *
 * In match play, the higher-handicap player receives strokes on
 * the hardest-rated holes. The number of strokes equals the
 * difference in handicaps (or a percentage in partial mode).
 *
 * Each hole has a "stroke index" (1-18) where 1 = hardest hole.
 * If a player gets 6 strokes, they get one extra stroke on the
 * 6 holes with the lowest stroke index numbers.
 */

// Standard USGA stroke index ordering (most common US allocation)
// Odd numbers on front 9, even numbers on back 9
// Front: holes 1-9 get stroke indexes 1,3,5,7,9,11,13,15,17
// Back: holes 10-18 get stroke indexes 2,4,6,8,10,12,14,16,18
export const DEFAULT_STROKE_INDEX: number[] = [
  // Hole:  1   2   3   4   5   6   7   8   9
             7,  3, 11,  1, 13,  5, 15,  9, 17,
  // Hole: 10  11  12  13  14  15  16  17  18
             8,  4, 12,  2, 14,  6, 16, 10, 18,
];

export type HandicapMode = 'none' | 'full' | 'partial';

/**
 * Calculate how many strokes a player receives based on handicap
 * difference and handicap mode.
 *
 * @param playerHandicap - This player's handicap
 * @param opponentHandicap - Opponent's handicap
 * @param mode - 'none' (0 strokes), 'full' (100% diff), 'partial' (80% diff)
 * @returns Number of strokes this player receives (0 if they're the lower handicap)
 */
export function calculateStrokesReceived(
  playerHandicap: number,
  opponentHandicap: number,
  mode: HandicapMode,
): number {
  if (mode === 'none') return 0;

  const diff = playerHandicap - opponentHandicap;
  if (diff <= 0) return 0; // Lower handicap gets no strokes

  const multiplier = mode === 'full' ? 1.0 : 0.8;
  return Math.round(diff * multiplier);
}

/**
 * Allocate strokes to specific holes for a player.
 *
 * Returns a Map where key = hole number (1-18), value = strokes received on that hole.
 * Most holes will be 0 or 1 stroke. If strokes > 18, some holes get 2.
 *
 * @param strokesReceived - Total strokes this player gets
 * @param strokeIndex - Per-hole stroke index ratings (1-18). Defaults to standard USGA.
 * @returns Map<holeNumber, strokesOnThatHole>
 */
export function allocateStrokesToHoles(
  strokesReceived: number,
  strokeIndex: number[] = DEFAULT_STROKE_INDEX,
): Map<number, number> {
  const allocation = new Map<number, number>();

  // Initialize all holes to 0
  for (let hole = 1; hole <= 18; hole++) {
    allocation.set(hole, 0);
  }

  if (strokesReceived <= 0) return allocation;

  // Build sorted list of (holeNumber, strokeIndex) by stroke index ascending
  // Lower stroke index = harder hole = gets strokes first
  const holesRanked = strokeIndex
    .map((si, i) => ({ hole: i + 1, strokeIndex: si }))
    .sort((a, b) => a.strokeIndex - b.strokeIndex);

  let remaining = strokesReceived;

  // Distribute strokes round-robin through hardest holes first
  // First pass: 1 stroke per hole (up to 18)
  // Second pass: 2 strokes per hole (for handicaps > 18), etc.
  while (remaining > 0) {
    for (const { hole } of holesRanked) {
      if (remaining <= 0) break;
      allocation.set(hole, (allocation.get(hole) ?? 0) + 1);
      remaining--;
    }
  }

  return allocation;
}

/**
 * Calculate net score for a hole given gross strokes and handicap strokes received.
 */
export function calculateNetScore(
  grossStrokes: number,
  handicapStrokesOnHole: number,
): number {
  return grossStrokes - handicapStrokesOnHole;
}

/**
 * For a match between two players, calculate the per-hole stroke allocations.
 * The higher-handicap player gets strokes; the lower-handicap player gets 0.
 *
 * @returns Object with strokesA (Map for player A) and strokesB (Map for player B)
 */
export function calculateMatchStrokes(
  handicapA: number,
  handicapB: number,
  mode: HandicapMode,
  strokeIndex: number[] = DEFAULT_STROKE_INDEX,
): { strokesA: Map<number, number>; strokesB: Map<number, number> } {
  const aReceives = calculateStrokesReceived(handicapA, handicapB, mode);
  const bReceives = calculateStrokesReceived(handicapB, handicapA, mode);

  return {
    strokesA: allocateStrokesToHoles(aReceives, strokeIndex),
    strokesB: allocateStrokesToHoles(bReceives, strokeIndex),
  };
}
