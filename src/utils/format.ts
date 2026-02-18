/**
 * Format a number as currency: +$45.00, -$20.00, $0.00
 */
export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2);

  if (amount > 0) return `+$${formatted}`;
  if (amount < 0) return `-$${formatted}`;
  return `$${formatted}`;
}

/**
 * Format a number as short currency: +$45, -$20, $0
 * No decimals for whole numbers.
 */
export function formatMoneyShort(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(2);

  if (amount > 0) return `+$${formatted}`;
  if (amount < 0) return `-$${formatted}`;
  return `$${formatted}`;
}

/**
 * Format a date as relative or short: "Today", "Yesterday", "Nov 14"
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a handicap: 12.4, 0.0, etc.
 */
export function formatHandicap(handicap: number | null): string {
  if (handicap === null) return '--';
  return handicap.toFixed(1);
}

/**
 * Get initials from a name: "Mike Johnson" -> "MJ"
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format a game type for display
 */
export function formatGameType(type: string): string {
  const map: Record<string, string> = {
    nassau: 'Nassau',
    skins: 'Skins',
    wolf: 'Wolf',
    match_play: 'Match Play',
  };
  return map[type] ?? type;
}

/**
 * Format win/loss record
 */
export function formatRecord(wins: number, losses: number): string {
  return `W ${wins}  ·  L ${losses}`;
}

/**
 * Get display name for a game_player (handles guests and registered users).
 * Supabase joins `users(name, venmo_username)` onto game_players rows,
 * so the player object may have a `.users` nested object with the user's name.
 */
export function formatPlayerName(
  player: { guest_name?: string | null; user_id?: string | null; users?: { name?: string | null } | null },
  userNames?: Map<string, string>,
): string {
  if (player.guest_name) return player.guest_name;
  // Use the joined users.name from Supabase query
  const joinedName = (player as any)?.users?.name;
  if (joinedName) return joinedName;
  if (player.user_id && userNames?.has(player.user_id)) {
    return userNames.get(player.user_id)!;
  }
  return 'Player';
}

/**
 * Get first name only from a player for shorter displays (reactions, trash talk).
 */
export function formatPlayerFirstName(
  player: { guest_name?: string | null; user_id?: string | null; users?: { name?: string | null } | null },
): string {
  const full = formatPlayerName(player);
  if (full === 'Player') return full;
  return full.split(' ')[0];
}

/**
 * Format bet status: "Mike 2 UP" / "ALL SQUARE"
 */
export function formatBetStatus(margin: number, leaderName: string | null): string {
  if (!leaderName || margin === 0) return 'ALL SQUARE';
  return `${leaderName} ${margin} UP`;
}

/**
 * Format member-since date: "Member since Jan 2024"
 */
export function formatMemberSince(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `Member since ${month} ${year}`;
}

/**
 * Format a friend code for display: "NAS4K7" -> "NAS-4K7"
 */
export function formatFriendCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Format trend text comparing current vs previous month: "+$12.50 this month"
 */
export function formatTrendText(current: number, previous: number): string {
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return 'No change this month';
  const abs = Math.abs(diff).toFixed(2);
  if (diff > 0) return `+$${abs} this month`;
  return `-$${abs} this month`;
}
