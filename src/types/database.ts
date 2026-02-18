export type SubscriptionStatus = 'free' | 'premium';
export type GameType = 'nassau' | 'skins' | 'wolf' | 'match_play';
export type GameStatus = 'created' | 'in_progress' | 'completed' | 'cancelled';
export type PaidStatus = 'unpaid' | 'paid_venmo' | 'paid_zelle' | 'paid_cash';
export type SettlementStatus = 'pending' | 'settled';
export type SettlementMethod = 'venmo' | 'zelle' | 'cash' | 'other';

// Nassau-specific settings
export interface NassauSettings {
  num_holes: 9 | 18; // 9-hole or 18-hole game
  auto_press: boolean;
  press_limit: number; // 0 = unlimited
  handicap_mode: 'none' | 'full' | 'partial';
  front_bet: number;
  back_bet: number;
  overall_bet: number;
  hole_pars?: number[]; // 9 or 18 element array, defaults to all 4s
  hole_handicap_ratings?: number[]; // 9 or 18 element array, stroke index per hole
}

// Skins-specific settings
export interface SkinsSettings {
  skin_value: number;
  allow_carryovers: boolean;
  split_final_ties: boolean;
}

// Wolf-specific settings
export interface WolfSettings {
  point_value: number;
  blind_wolf: boolean;
  lone_wolf_holes: number[];
}

// Match Play-specific settings
export interface MatchPlaySettings {
  match_type: 'singles' | 'teams';
  total_bet: number;
  handicap_strokes: boolean;
}

export type GameSettings =
  | ({ type: 'nassau' } & NassauSettings)
  | ({ type: 'skins' } & SkinsSettings)
  | ({ type: 'wolf' } & WolfSettings)
  | ({ type: 'match_play' } & MatchPlaySettings);

export interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  venmo_username: string | null;
  handicap: number | null;
  subscription_status: SubscriptionStatus;
  subscription_id: string | null;
  push_token: string | null;
  friend_code: string;
  created_at: string;
  updated_at: string;
}

export interface GameRow {
  id: string;
  created_by: string;
  game_type: GameType;
  status: GameStatus;
  total_pot: number;
  settings: GameSettings;
  course_name: string | null;
  course_id: string | null; // FK to courses table for normalized analytics
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GamePlayerRow {
  id: string;
  game_id: string;
  user_id: string | null; // null for guest players
  guest_name: string | null; // name for guest players
  guest_handicap: number | null; // handicap for guest players
  paid_status: PaidStatus;
  handicap_used: number | null;
  position: number;
  created_at: string;
}

export interface GameBetRow {
  id: string;
  game_id: string;
  bet_type: string;
  amount: number;
  winner_id: string | null;
  settled: boolean;
  parent_bet_id: string | null; // For press bets (links to original)
  player_a_id: string | null; // game_player id for player A in this bet
  player_b_id: string | null; // game_player id for player B in this bet
  press_initiated_hole: number | null; // Hole number when press was initiated (Ace analytics)
  margin_at_press: number | null; // How many holes down when pressed (Ace analytics)
  created_at: string;
}

export interface ScoreRow {
  id: string;
  game_id: string;
  hole_number: number;
  player_id: string; // references game_players.id
  strokes: number;
  net_score: number;
  created_at: string;
  updated_at: string;
}

export interface SettlementRow {
  id: string;
  game_id: string;
  from_user_id: string | null; // null for guest players
  to_user_id: string | null; // null for guest players
  from_player_id: string | null; // game_player id (always set)
  to_player_id: string | null; // game_player id (always set)
  amount: number;
  status: SettlementStatus;
  settlement_method: SettlementMethod | null;
  settled_at: string | null;
  created_at: string;
}

// Wolf choice tracking
export interface WolfChoiceRow {
  id: string;
  game_id: string;
  hole_number: number;
  wolf_player_id: string;
  choice_type: 'solo' | 'partner';
  partner_id: string | null;
  created_at: string;
}

// ============================================
// Nassau Engine Types
// ============================================

export interface NassauMatchStatus {
  playerAId: string; // game_player id
  playerBId: string; // game_player id
  frontNine: BetRegionStatus;
  backNine: BetRegionStatus;
  overall: BetRegionStatus;
  presses: PressStatus[];
}

export interface BetRegionStatus {
  betId: string; // game_bet id
  leaderId: string | null; // game_player id of leader, null if all square
  margin: number; // holes up (always positive, relative to leader)
  holesPlayed: number;
  isComplete: boolean; // match closed out or all holes played
  holeResults: HoleResult[]; // per-hole results in this region
}

export interface HoleResult {
  holeNumber: number;
  winnerId: string | null; // game_player id, null if halved
  playerANet: number;
  playerBNet: number;
}

export interface PressStatus {
  betId: string; // game_bet id
  parentBetId: string;
  betType: string; // 'front_press', 'back_press', 'overall_press'
  startHole: number;
  endHole: number; // 9 for front, 18 for back/overall
  amount: number;
  leaderId: string | null;
  margin: number;
  holesPlayed: number;
  isComplete: boolean;
  initiatedBy: string; // game_player id of who pressed
}

export interface NassauLiveStatus {
  matches: NassauMatchStatus[];
  currentHole: number; // highest hole with any score entered
  isRoundComplete: boolean;
  suggestedPresses: SuggestedPress[];
}

export interface SuggestedPress {
  matchPlayerAId: string;
  matchPlayerBId: string;
  betType: 'front_press' | 'back_press' | 'overall_press';
  startHole: number;
  trailingPlayerId: string; // who should initiate
  parentBetId: string;
  reason: string; // "2 down on front 9"
}

export interface NassauSettlement {
  fromPlayerId: string; // game_player id
  toPlayerId: string; // game_player id
  amount: number;
  breakdown: SettlementBreakdownItem[];
}

export interface SettlementBreakdownItem {
  label: string; // "Front 9", "Back 9 Press (#5)", etc.
  amount: number; // positive = won, negative = lost
}

// ============================================
// Lifetime Stats Types
// ============================================

export interface MonthlyDataPoint {
  month: string;        // "2024-01"
  label: string;        // "Jan '24"
  cumulative: number;   // running total P/L
  monthly: number;      // that month's net
}

export interface GameTypeStats {
  gameType: GameType;
  gamesPlayed: number;
  wins: number;
  losses: number;
  net: number;
}

export interface PerformanceInsight {
  label: string;        // "Biggest Win"
  value: string;        // "$45.00"
  sublabel?: string;    // "vs Mike, Mar 2024"
}

export interface RecentGameSummary {
  gameId: string;
  date: string;
  gameType: GameType;
  courseName: string;
  playerCount: number;
  net: number;
  result: 'win' | 'loss' | 'push';
}

export interface LifetimeStats {
  memberSince: string;
  gamesPlayed: number;
  winRate: number;
  totalNet: number;
  monthlyData: MonthlyDataPoint[];
  gameTypeStats: GameTypeStats[];
  insights: PerformanceInsight[];
  recentGames: RecentGameSummary[];
  bestMonth: { label: string; net: number } | null;
  currentStreak: { type: 'win' | 'loss'; count: number };
}

// ============================================
// Friend System Types
// ============================================

export interface FriendshipRow {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
}

/** Friend with joined user data for display */
export interface FriendWithProfile {
  friendshipId: string;
  userId: string;
  name: string;
  handicap: number | null;
  venmoUsername: string | null;
  friendCode: string;
  createdAt: string;
}

// ============================================
// Ace AI Caddie Types
// ============================================

export interface CourseRow {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  num_holes: number;
  created_by: string | null;
  created_at: string;
}

export interface CourseHoleRow {
  id: string;
  course_id: string;
  hole_number: number;
  par: number;
  handicap_index: number | null;
  yardage: number | null;
  created_at: string;
}

export interface HandicapHistoryRow {
  id: string;
  user_id: string;
  handicap: number;
  source: string; // 'manual' | 'game_update' | 'import' | 'backfill'
  recorded_at: string;
}

export type AceInteractionType =
  | 'press_advice'
  | 'matchup_report'
  | 'post_round'
  | 'course_intel'
  | 'bet_sizing'
  | 'trend_analysis'
  | 'group_dynamics';

export interface AceInteractionRow {
  id: string;
  user_id: string;
  game_id: string | null;
  interaction_type: AceInteractionType;
  context_json: Record<string, any>;
  response_json: Record<string, any>;
  created_at: string;
}

export interface PressSuggestionRow {
  id: string;
  game_id: string;
  bet_id: string | null;
  suggesting_player_id: string;
  hole_number: number;
  region: string; // 'front' | 'back' | 'overall'
  margin_at_suggestion: number;
  accepted: boolean | null; // null = pending, true = accepted, false = declined
  created_at: string;
}

// ─── Ace Analytics Computed Types ──────────────────────────

/** Head-to-head record against a specific opponent */
export interface HeadToHeadRecord {
  opponentUserId: string;
  opponentName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pushes: number;
  totalNet: number;
  frontNineRecord: { wins: number; losses: number; pushes: number };
  backNineRecord: { wins: number; losses: number; pushes: number };
  averageMargin: number;
  lastPlayed: string;
}

/** Course-specific performance */
export interface CoursePerformance {
  courseName: string;
  courseId: string | null;
  roundsPlayed: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalNet: number;
  winRate: number;
  holeAverages: { holeNumber: number; avgStrokes: number; par: number; differential: number }[];
  par3Avg: number;
  par4Avg: number;
  par5Avg: number;
}

/** Press analytics for press advisor */
export interface PressAnalytics {
  totalPresses: number;
  pressesWon: number;
  pressesLost: number;
  pressesPushed: number;
  winRate: number;
  avgMarginAtPress: number;
  winRateByMargin: { margin: number; presses: number; wins: number; winRate: number }[];
  winRateByHole: { hole: number; presses: number; wins: number; winRate: number }[];
  winRateByRegion: { region: string; presses: number; wins: number; winRate: number }[];
  netFromPresses: number;
}

/** Scoring trends for trend analysis */
export interface ScoringTrends {
  last5AvgScore: number;
  last10AvgScore: number;
  seasonAvgScore: number;
  scoringByHoleType: { par: number; avgStrokes: number; avgVsPar: number }[];
  frontNineAvg: number;
  backNineAvg: number;
  handicapHistory: { date: string; handicap: number }[];
  formIndicator: 'hot' | 'cold' | 'steady';
  recentTrend: number; // positive = improving, negative = declining
}

// Composite types for loaded game data
export interface GameWithPlayers extends GameRow {
  players: GamePlayerRow[];
}

export interface FullGameData {
  game: GameRow;
  players: GamePlayerRow[];
  bets: GameBetRow[];
  scores: ScoreRow[];
  settlements: SettlementRow[];
}

// Database schema for Supabase typed client
export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserRow, 'id' | 'created_at'>>;
      };
      games: {
        Row: GameRow;
        Insert: Omit<GameRow, 'id' | 'created_at'>;
        Update: Partial<Omit<GameRow, 'id' | 'created_at'>>;
      };
      game_players: {
        Row: GamePlayerRow;
        Insert: Omit<GamePlayerRow, 'id' | 'created_at'>;
        Update: Partial<Omit<GamePlayerRow, 'id' | 'created_at'>>;
      };
      game_bets: {
        Row: GameBetRow;
        Insert: Omit<GameBetRow, 'id' | 'created_at'>;
        Update: Partial<Omit<GameBetRow, 'id' | 'created_at'>>;
      };
      scores: {
        Row: ScoreRow;
        Insert: Omit<ScoreRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ScoreRow, 'id' | 'created_at'>>;
      };
      settlements: {
        Row: SettlementRow;
        Insert: Omit<SettlementRow, 'id' | 'created_at'>;
        Update: Partial<Omit<SettlementRow, 'id' | 'created_at'>>;
      };
      wolf_choices: {
        Row: WolfChoiceRow;
        Insert: Omit<WolfChoiceRow, 'id' | 'created_at'>;
        Update: Partial<Omit<WolfChoiceRow, 'id' | 'created_at'>>;
      };
      friendships: {
        Row: FriendshipRow;
        Insert: Omit<FriendshipRow, 'id' | 'created_at'>;
        Update: Partial<Omit<FriendshipRow, 'id' | 'created_at'>>;
      };
      courses: {
        Row: CourseRow;
        Insert: Omit<CourseRow, 'id' | 'created_at'>;
        Update: Partial<Omit<CourseRow, 'id' | 'created_at'>>;
      };
      course_holes: {
        Row: CourseHoleRow;
        Insert: Omit<CourseHoleRow, 'id' | 'created_at'>;
        Update: Partial<Omit<CourseHoleRow, 'id' | 'created_at'>>;
      };
      handicap_history: {
        Row: HandicapHistoryRow;
        Insert: Omit<HandicapHistoryRow, 'id' | 'recorded_at'>;
        Update: Partial<Omit<HandicapHistoryRow, 'id' | 'recorded_at'>>;
      };
      ace_interactions: {
        Row: AceInteractionRow;
        Insert: Omit<AceInteractionRow, 'id' | 'created_at'>;
        Update: Partial<Omit<AceInteractionRow, 'id' | 'created_at'>>;
      };
      press_suggestions: {
        Row: PressSuggestionRow;
        Insert: Omit<PressSuggestionRow, 'id' | 'created_at'>;
        Update: Partial<Omit<PressSuggestionRow, 'id' | 'created_at'>>;
      };
    };
  };
}
