import { create } from 'zustand';
import { supabase } from '../services/supabase';
import {
  loadGame as loadGameService,
  startGame as startGameService,
  completeGame as completeGameService,
  cancelGame as cancelGameService,
  createNassauGame,
  createSkinsGame,
  createMatchPlayGame,
  createWolfGame,
  createPressBet,
  addLatePlayer as addLatePlayerService,
  fetchUserGames,
} from '../services/gameService';
import { upsertScore } from '../services/scoreService';
import {
  createSettlements as createSettlementsService,
  markSettlementPaid as markSettlementPaidService,
} from '../services/settlementService';
import {
  subscribeToGame,
  unsubscribeFromGame,
} from '../services/realtimeService';
import {
  calculateNassauStatus,
  calculateNassauSettlements,
} from '../engine/nassauCalculator';
import {
  calculateSkinsStatus,
  calculateSkinsSettlements,
} from '../engine/skinsCalculator';
import {
  calculateMatchPlayStatus,
  calculateMatchPlaySettlements,
} from '../engine/matchPlayCalculator';
import {
  calculateWolfStatus,
  calculateWolfSettlements,
} from '../engine/wolfCalculator';
import {
  submitWolfChoice as submitWolfChoiceService,
  fetchWolfChoices,
} from '../services/wolfService';
import type {
  GameRow,
  GamePlayerRow,
  GameBetRow,
  GameType,
  ScoreRow,
  SettlementRow,
  WolfChoiceRow,
  NassauSettings,
  SkinsSettings,
  MatchPlaySettings,
  WolfSettings,
  GameSettings,
  GameLiveStatus,
  GameSettlementResult,
  FullGameData,
  LifetimeStats,
  MonthlyDataPoint,
  GameTypeStats,
  PerformanceInsight,
  RecentGameSummary,
} from '../types';
import { formatMoney, formatGameType, formatDateShort } from '../utils/format';
import { useAuthStore } from './authStore';
import type { CreatePlayerInput } from '../services/gameService';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SettlementMethod } from '../types';

// ─── Dashboard Types (existing) ───────────────────────────────

interface GameWithPlayers extends GameRow {
  game_players: (GamePlayerRow & { users: { name: string; venmo_username: string | null } })[];
}

// ─── Store Interface ──────────────────────────────────────────

interface GameState {
  // Dashboard state (existing)
  activeGames: GameWithPlayers[];
  activeGameScores: Record<string, ScoreRow[]>;
  recentGames: GameWithPlayers[];
  recentGameNets: Record<string, number>;
  monthlyNet: number;
  wins: number;
  losses: number;
  isLoading: boolean;

  // Active game state (new)
  activeGameData: FullGameData | null;
  gameStatus: GameLiveStatus | null;
  realtimeChannel: RealtimeChannel | null;
  pressingBetKeys: Set<string>; // Prevents double-tap race on press buttons
  wolfChoices: WolfChoiceRow[]; // Wolf game partner choices

  // Dashboard actions (existing)
  fetchDashboardData: (userId: string) => Promise<void>;
  fetchGameHistory: (userId: string, filter: 'week' | 'month' | 'all') => Promise<GameWithPlayers[]>;
  getPlayerStats: (userId: string) => Promise<{
    gamesPlayed: number;
    winRate: number;
    totalNet: number;
  }>;

  // Game lifecycle actions (new)
  createGame: (
    creatorId: string,
    gameType: GameType,
    courseName: string,
    settings: GameSettings,
    players: CreatePlayerInput[],
  ) => Promise<{ gameId?: string; error?: string }>;
  loadActiveGame: (gameId: string) => Promise<{ error?: string }>;
  startActiveGame: () => Promise<{ error?: string }>;
  completeActiveGame: () => Promise<{ error?: string }>;
  cancelActiveGame: () => Promise<{ error?: string }>;
  clearActiveGame: () => void;

  // Score entry (new)
  enterScore: (
    playerId: string,
    holeNumber: number,
    strokes: number,
  ) => Promise<{ error?: string }>;

  // Press bets (new)
  initiatePress: (
    parentBetId: string,
    betType: string,
    playerAId: string,
    playerBId: string,
  ) => Promise<{ error?: string }>;

  // Wolf choice
  submitWolfChoice: (
    holeNumber: number,
    wolfPlayerId: string,
    choiceType: 'solo' | 'partner',
    partnerId: string | null,
  ) => Promise<{ error?: string }>;

  // Late join
  addLatePlayer: (friendUserId: string, handicapUsed: number) => Promise<{ error?: string }>;

  // Settlements (new)
  calculateAndCreateSettlements: () => Promise<{ settlements?: GameSettlementResult[]; error?: string }>;
  markPaid: (settlementId: string, method: SettlementMethod) => Promise<{ error?: string }>;

  // Lifetime stats
  lifetimeStats: LifetimeStats | null;
  lifetimeStatsLoading: boolean;
  fetchLifetimeStats: (userId: string) => Promise<void>;

  // Real-time (new)
  subscribeToActiveGame: () => void;
  unsubscribeFromActiveGame: () => void;
  recalculateGameStatus: () => void;
}

// ─── Store Implementation ─────────────────────────────────────

export const useGameStore = create<GameState>((set, get) => ({
  // Dashboard state
  activeGames: [],
  activeGameScores: {},
  recentGames: [],
  recentGameNets: {},
  monthlyNet: 0,
  wins: 0,
  losses: 0,
  isLoading: false,

  // Active game state
  activeGameData: null,
  gameStatus: null,
  realtimeChannel: null,
  pressingBetKeys: new Set<string>(),
  wolfChoices: [],

  // Lifetime stats
  lifetimeStats: null,
  lifetimeStatsLoading: false,

  // ─── Dashboard Actions (existing, unchanged) ────────────────

  fetchDashboardData: async (userId) => {
    set({ isLoading: true });
    try {
      const { data: activeGames } = await supabase
        .from('games')
        .select(`
          *,
          game_players (
            *,
            users (name, venmo_username)
          )
        `)
        .in('status', ['created', 'in_progress'])
        .order('created_at', { ascending: false });

      const userActiveGames = (activeGames ?? []).filter((game: any) =>
        game.game_players.some((gp: any) => gp.user_id === userId),
      );

      const { data: recentGames } = await supabase
        .from('games')
        .select(`
          *,
          game_players (
            *,
            users (name, venmo_username)
          )
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);

      const userRecentGames = (recentGames ?? []).filter((game: any) =>
        game.game_players.some((gp: any) => gp.user_id === userId),
      );

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: settlements } = await supabase
        .from('settlements')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .gte('created_at', startOfMonth.toISOString());

      let monthlyNet = 0;
      let wins = 0;
      let losses = 0;
      const recentGameNets: Record<string, number> = {};

      (settlements ?? []).forEach((s: SettlementRow) => {
        if (s.to_user_id === userId) {
          monthlyNet += s.amount;
        } else if (s.from_user_id === userId) {
          monthlyNet -= s.amount;
        }
      });

      // Also fetch all-time settlements for recent games that may be outside this month
      const recentGameIds = userRecentGames.map((g: any) => g.id);
      let allRecentSettlements = settlements ?? [];
      if (recentGameIds.length > 0) {
        const { data: gameSettlements } = await supabase
          .from('settlements')
          .select('*')
          .in('game_id', recentGameIds);
        if (gameSettlements) {
          allRecentSettlements = gameSettlements;
        }
      }

      userRecentGames.forEach((game: any) => {
        const gameSettlements = allRecentSettlements.filter(
          (s: SettlementRow) => s.game_id === game.id,
        );
        const gameNet = gameSettlements.reduce((acc: number, s: SettlementRow) => {
          if (s.to_user_id === userId) return acc + s.amount;
          if (s.from_user_id === userId) return acc - s.amount;
          return acc;
        }, 0);

        recentGameNets[game.id] = gameNet;
        if (gameNet > 0) wins++;
        else if (gameNet < 0) losses++;
      });

      // Fetch scores for in-progress active games (for dashboard mini-scorecard)
      const activeGameScores: Record<string, ScoreRow[]> = {};
      const inProgressGames = userActiveGames.filter((g: any) => g.status === 'in_progress');
      if (inProgressGames.length > 0) {
        const inProgressIds = inProgressGames.map((g: any) => g.id);
        const { data: scoreData } = await supabase
          .from('scores')
          .select('*')
          .in('game_id', inProgressIds)
          .order('hole_number', { ascending: false });
        (scoreData ?? []).forEach((s: any) => {
          if (!activeGameScores[s.game_id]) activeGameScores[s.game_id] = [];
          activeGameScores[s.game_id].push(s as ScoreRow);
        });
      }

      set({
        activeGames: userActiveGames as GameWithPlayers[],
        activeGameScores,
        recentGames: userRecentGames as GameWithPlayers[],
        recentGameNets,
        monthlyNet,
        wins,
        losses,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchGameHistory: async (userId, filter) => {
    let dateFilter = new Date(0);
    const now = new Date();

    if (filter === 'week') {
      dateFilter = new Date(now);
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (filter === 'month') {
      dateFilter = new Date(now);
      dateFilter.setDate(1);
      dateFilter.setHours(0, 0, 0, 0);
    }

    const { data } = await supabase
      .from('games')
      .select(`
        *,
        game_players (
          *,
          users (name, venmo_username)
        )
      `)
      .eq('status', 'completed')
      .gte('completed_at', dateFilter.toISOString())
      .order('completed_at', { ascending: false });

    const userGames = (data ?? []).filter((game: any) =>
      game.game_players.some((gp: any) => gp.user_id === userId),
    );

    return userGames as GameWithPlayers[];
  },

  getPlayerStats: async (userId) => {
    const { data: games } = await supabase
      .from('games')
      .select(`
        *,
        game_players (user_id)
      `)
      .eq('status', 'completed');

    const userGames = (games ?? []).filter((game: any) =>
      game.game_players.some((gp: any) => gp.user_id === userId),
    );

    const { data: settlements } = await supabase
      .from('settlements')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);

    let totalNet = 0;
    let gamesWon = 0;

    const gameNets = new Map<string, number>();
    (settlements ?? []).forEach((s: SettlementRow) => {
      const current = gameNets.get(s.game_id) ?? 0;
      if (s.to_user_id === userId) {
        gameNets.set(s.game_id, current + s.amount);
        totalNet += s.amount;
      } else if (s.from_user_id === userId) {
        gameNets.set(s.game_id, current - s.amount);
        totalNet -= s.amount;
      }
    });

    gameNets.forEach((net) => {
      if (net > 0) gamesWon++;
    });

    const gamesPlayed = userGames.length;
    const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;

    return { gamesPlayed, winRate, totalNet };
  },

  // ─── Lifetime Stats ────────────────────────────────────────

  fetchLifetimeStats: async (userId) => {
    set({ lifetimeStatsLoading: true });

    try {
      // Parallel queries: games + settlements
      const [gamesResult, settlementsResult] = await Promise.all([
        supabase
          .from('games')
          .select(`
            *,
            game_players (
              *,
              users (name)
            )
          `)
          .eq('status', 'completed')
          .order('completed_at', { ascending: true }),
        supabase
          .from('settlements')
          .select('*')
          .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
      ]);

      const allGames = (gamesResult.data ?? []).filter((game: any) =>
        game.game_players.some((gp: any) => gp.user_id === userId),
      );
      const allSettlements = settlementsResult.data ?? [];

      // Get member since from auth store
      const authUser = useAuthStore.getState().user;
      const memberSince = authUser?.created_at ?? new Date().toISOString();

      // Build per-game net map
      const gameNetMap = new Map<string, number>();
      allSettlements.forEach((s: SettlementRow) => {
        const current = gameNetMap.get(s.game_id) ?? 0;
        if (s.to_user_id === userId) {
          gameNetMap.set(s.game_id, current + s.amount);
        } else if (s.from_user_id === userId) {
          gameNetMap.set(s.game_id, current - s.amount);
        }
      });

      // ─ Monthly data points ─
      const monthMap = new Map<string, number>();
      allGames.forEach((game: any) => {
        const dateStr = game.completed_at ?? game.created_at;
        const d = new Date(dateStr);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const gameNet = gameNetMap.get(game.id) ?? 0;
        monthMap.set(key, (monthMap.get(key) ?? 0) + gameNet);
      });

      const sortedMonths = Array.from(monthMap.keys()).sort();
      let cumulative = 0;
      const monthlyData: MonthlyDataPoint[] = sortedMonths.map((month) => {
        const monthly = monthMap.get(month) ?? 0;
        cumulative += monthly;
        const [year, m] = month.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const label = `${monthNames[parseInt(m, 10) - 1]} '${year.slice(2)}`;
        return { month, label, cumulative, monthly };
      });

      // ─ Game type breakdown ─
      const typeMap = new Map<GameType, { played: number; wins: number; losses: number; net: number }>();
      allGames.forEach((game: any) => {
        const gt = game.game_type as GameType;
        const existing = typeMap.get(gt) ?? { played: 0, wins: 0, losses: 0, net: 0 };
        existing.played++;
        const gameNet = gameNetMap.get(game.id) ?? 0;
        existing.net += gameNet;
        if (gameNet > 0) existing.wins++;
        else if (gameNet < 0) existing.losses++;
        typeMap.set(gt, existing);
      });

      const gameTypeStats: GameTypeStats[] = Array.from(typeMap.entries()).map(([gameType, data]) => ({
        gameType,
        gamesPlayed: data.played,
        wins: data.wins,
        losses: data.losses,
        net: data.net,
      }));

      // ─ Totals ─
      let totalNet = 0;
      let gamesWon = 0;
      gameNetMap.forEach((net) => {
        totalNet += net;
        if (net > 0) gamesWon++;
      });
      const gamesPlayed = allGames.length;
      const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;

      // ─ Current streak ─
      const sortedGames = [...allGames].sort((a: any, b: any) => {
        const da = new Date(a.completed_at ?? a.created_at).getTime();
        const db = new Date(b.completed_at ?? b.created_at).getTime();
        return db - da; // newest first
      });

      let streakType: 'win' | 'loss' = 'win';
      let streakCount = 0;
      for (const game of sortedGames) {
        const net = gameNetMap.get((game as any).id) ?? 0;
        if (net === 0) continue; // skip pushes
        const thisType = net > 0 ? 'win' : 'loss';
        if (streakCount === 0) {
          streakType = thisType;
          streakCount = 1;
        } else if (thisType === streakType) {
          streakCount++;
        } else {
          break;
        }
      }

      // ─ Best month ─
      const bestMonth = monthlyData.reduce<{ label: string; net: number } | null>((best, dp) => {
        if (!best || dp.monthly > best.net) return { label: dp.label, net: dp.monthly };
        return best;
      }, null);

      // ─ Performance insights ─
      const insights: PerformanceInsight[] = [];

      // Biggest win
      let biggestWinNet = 0;
      let biggestWinGame: any = null;
      allGames.forEach((game: any) => {
        const net = gameNetMap.get(game.id) ?? 0;
        if (net > biggestWinNet) {
          biggestWinNet = net;
          biggestWinGame = game;
        }
      });
      if (biggestWinGame) {
        insights.push({
          label: 'Biggest Win',
          value: formatMoney(biggestWinNet),
          sublabel: biggestWinGame.course_name ?? formatGameType(biggestWinGame.game_type),
        });
      }

      // Biggest loss
      let biggestLossNet = 0;
      let biggestLossGame: any = null;
      allGames.forEach((game: any) => {
        const net = gameNetMap.get(game.id) ?? 0;
        if (net < biggestLossNet) {
          biggestLossNet = net;
          biggestLossGame = game;
        }
      });
      if (biggestLossGame) {
        insights.push({
          label: 'Biggest Loss',
          value: formatMoney(biggestLossNet),
          sublabel: biggestLossGame.course_name ?? formatGameType(biggestLossGame.game_type),
        });
      }

      // Best month insight
      if (bestMonth && bestMonth.net !== 0) {
        insights.push({
          label: 'Best Month',
          value: formatMoney(bestMonth.net),
          sublabel: bestMonth.label,
        });
      }

      // Best game type
      const bestType = gameTypeStats.reduce<GameTypeStats | null>((best, gs) => {
        if (!best || gs.net > best.net) return gs;
        return best;
      }, null);
      if (bestType && bestType.net !== 0) {
        insights.push({
          label: 'Best Game Type',
          value: formatMoney(bestType.net),
          sublabel: formatGameType(bestType.gameType),
        });
      }

      // ─ Recent games (last 10) ─
      const recentGames: RecentGameSummary[] = sortedGames.slice(0, 10).map((game: any) => {
        const net = gameNetMap.get(game.id) ?? 0;
        return {
          gameId: game.id,
          date: game.completed_at ?? game.created_at,
          gameType: game.game_type as GameType,
          courseName: game.course_name ?? 'Unknown Course',
          playerCount: game.game_players?.length ?? 0,
          net,
          result: net > 0 ? 'win' : net < 0 ? 'loss' : 'push',
        };
      });

      set({
        lifetimeStats: {
          memberSince,
          gamesPlayed,
          winRate,
          totalNet,
          monthlyData,
          gameTypeStats,
          insights,
          recentGames,
          bestMonth,
          currentStreak: { type: streakType, count: streakCount },
        },
        lifetimeStatsLoading: false,
      });
    } catch {
      set({ lifetimeStatsLoading: false });
    }
  },

  // ─── Game Lifecycle ─────────────────────────────────────────

  createGame: async (creatorId, gameType, courseName, settings, players) => {
    let result: { gameId: string; error?: string };

    switch (gameType) {
      case 'skins':
        result = await createSkinsGame(creatorId, courseName, settings as SkinsSettings, players);
        break;
      case 'match_play':
        result = await createMatchPlayGame(creatorId, courseName, settings as MatchPlaySettings, players);
        break;
      case 'wolf':
        result = await createWolfGame(creatorId, courseName, settings as WolfSettings, players);
        break;
      case 'nassau':
      default:
        result = await createNassauGame(creatorId, courseName, settings as NassauSettings, players);
        break;
    }

    if (result.error) return { error: result.error };

    // Load the newly created game
    const loadResult = await get().loadActiveGame(result.gameId);
    if (loadResult.error) return { gameId: result.gameId, error: loadResult.error };

    return { gameId: result.gameId };
  },

  loadActiveGame: async (gameId) => {
    set({ isLoading: true });
    const result = await loadGameService(gameId);

    if (result.error || !result.data) {
      set({ isLoading: false });
      return { error: result.error ?? 'Failed to load game' };
    }

    // Fetch wolf choices if this is a wolf game
    let wolfChoicesData: WolfChoiceRow[] = [];
    if (result.data.game.game_type === 'wolf') {
      const wolfResult = await fetchWolfChoices(gameId);
      wolfChoicesData = wolfResult.data;
    }

    set({ activeGameData: result.data, wolfChoices: wolfChoicesData, isLoading: false });
    get().recalculateGameStatus();

    // Auto-subscribe to real-time if game is in progress
    if (result.data.game.status === 'in_progress') {
      get().subscribeToActiveGame();
    }

    return {};
  },

  startActiveGame: async () => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    const result = await startGameService(activeGameData.game.id);
    if (result.error) return { error: result.error };

    set({
      activeGameData: {
        ...activeGameData,
        game: {
          ...activeGameData.game,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        },
      },
    });

    get().subscribeToActiveGame();
    return {};
  },

  completeActiveGame: async () => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    const result = await completeGameService(activeGameData.game.id);
    if (result.error) return { error: result.error };

    set({
      activeGameData: {
        ...activeGameData,
        game: {
          ...activeGameData.game,
          status: 'completed',
          completed_at: new Date().toISOString(),
        },
      },
    });

    return {};
  },

  cancelActiveGame: async () => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    const result = await cancelGameService(activeGameData.game.id);
    if (result.error) return { error: result.error };

    get().unsubscribeFromActiveGame();
    set({ activeGameData: null, gameStatus: null, wolfChoices: [] });
    return {};
  },

  clearActiveGame: () => {
    get().unsubscribeFromActiveGame();
    set({ activeGameData: null, gameStatus: null, wolfChoices: [] });
  },

  // ─── Wolf Choice ──────────────────────────────────────────────

  submitWolfChoice: async (holeNumber, wolfPlayerId, choiceType, partnerId) => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    const result = await submitWolfChoiceService(
      activeGameData.game.id,
      holeNumber,
      wolfPlayerId,
      choiceType,
      partnerId,
    );

    if (result.error) return { error: result.error };

    // Optimistically add the choice
    if (result.data) {
      const updatedChoices = [...get().wolfChoices, result.data];
      set({ wolfChoices: updatedChoices });
      get().recalculateGameStatus();
    }

    return {};
  },

  // ─── Late Join ──────────────────────────────────────────────

  addLatePlayer: async (friendUserId, handicapUsed) => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    const game = activeGameData.game;
    const players = activeGameData.players;
    const scores = activeGameData.scores;
    const settings = game.settings as NassauSettings & { type: string };

    // Validate: game must be in progress
    if (game.status !== 'in_progress') {
      return { error: 'Game must be in progress to add a player' };
    }

    // Validate: max 4 players
    if (players.length >= 4) {
      return { error: 'Maximum 4 players allowed' };
    }

    // Validate: no hole 2 scores yet (can only add before hole 2 is scored)
    const hasHole2Scores = scores.some((s) => s.hole_number >= 2);
    if (hasHole2Scores) {
      return { error: 'Cannot add players after hole 2 has been scored' };
    }

    // Validate: not already in the game
    const alreadyInGame = players.some((p) => p.user_id === friendUserId);
    if (alreadyInGame) {
      return { error: 'Player is already in this game' };
    }

    const existingPlayerIds = players.map((p) => p.id);

    const result = await addLatePlayerService(
      game.id,
      friendUserId,
      handicapUsed,
      existingPlayerIds,
      settings,
    );

    if (result.error) return { error: result.error };

    // Reload game to get fresh players + bets
    await get().loadActiveGame(game.id);
    return {};
  },

  // ─── Score Entry ────────────────────────────────────────────

  enterScore: async (playerId, holeNumber, strokes) => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    // Net score = gross strokes for now; the engine handles handicap adjustments
    const result = await upsertScore(
      activeGameData.game.id,
      playerId,
      holeNumber,
      strokes,
      strokes, // net_score stored as gross; engine computes adjusted net
    );

    if (result.error) return { error: result.error };

    // Optimistically update local scores
    const existingIdx = activeGameData.scores.findIndex(
      (s) => s.player_id === playerId && s.hole_number === holeNumber,
    );

    const newScore: ScoreRow = {
      id: existingIdx >= 0 ? activeGameData.scores[existingIdx].id : `temp-${Date.now()}`,
      game_id: activeGameData.game.id,
      player_id: playerId,
      hole_number: holeNumber,
      strokes,
      net_score: strokes,
      created_at: existingIdx >= 0 ? activeGameData.scores[existingIdx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updatedScores = [...activeGameData.scores];
    if (existingIdx >= 0) {
      updatedScores[existingIdx] = newScore;
    } else {
      updatedScores.push(newScore);
    }

    set({
      activeGameData: { ...activeGameData, scores: updatedScores },
    });

    get().recalculateGameStatus();
    return {};
  },

  // ─── Press Bets ─────────────────────────────────────────────

  initiatePress: async (parentBetId, betType, playerAId, playerBId) => {
    const { activeGameData, pressingBetKeys } = get();
    if (!activeGameData) return { error: 'No active game' };

    const settings = activeGameData.game.settings as NassauSettings & { type: string };

    // --- VALIDATION 1: Concurrency guard (prevent double-tap race) ---
    const pressKey = `${parentBetId}_${betType}`;
    if (pressingBetKeys.has(pressKey)) {
      return { error: 'Press already in progress' };
    }
    const newPressingKeys = new Set(pressingBetKeys);
    newPressingKeys.add(pressKey);
    set({ pressingBetKeys: newPressingKeys });

    // --- VALIDATION 2: Press limit check ---
    const region = betType.includes('front') ? 'front'
      : betType.includes('back') ? 'back'
      : 'overall';

    const existingPressCount = activeGameData.bets.filter(
      (b) =>
        b.parent_bet_id !== null &&
        b.bet_type.includes(region) &&
        ((b.player_a_id === playerAId && b.player_b_id === playerBId) ||
          (b.player_a_id === playerBId && b.player_b_id === playerAId)),
    ).length;

    if (settings.press_limit > 0 && existingPressCount >= settings.press_limit) {
      // Clear concurrency guard
      const cleared = new Set(get().pressingBetKeys);
      cleared.delete(pressKey);
      set({ pressingBetKeys: cleared });
      return { error: `Press limit reached (${settings.press_limit} per region)` };
    }

    // --- VALIDATION 3: Duplicate prevention ---
    const duplicateExists = activeGameData.bets.some(
      (b) =>
        b.parent_bet_id === parentBetId &&
        b.bet_type === betType &&
        ((b.player_a_id === playerAId && b.player_b_id === playerBId) ||
          (b.player_a_id === playerBId && b.player_b_id === playerAId)),
    );

    if (duplicateExists) {
      const cleared = new Set(get().pressingBetKeys);
      cleared.delete(pressKey);
      set({ pressingBetKeys: cleared });
      return { error: 'Press already active for this bet' };
    }

    // --- Create the press bet ---
    let amount = settings.front_bet;
    if (betType.includes('back')) amount = settings.back_bet;
    if (betType.includes('overall')) amount = settings.overall_bet;

    // --- Capture press context for Ace analytics ---
    const gameStatus = get().gameStatus;
    let pressInitiatedHole: number | undefined;
    let marginAtPress: number | undefined;

    if (gameStatus && gameStatus.type === 'nassau') {
      pressInitiatedHole = gameStatus.currentHole;

      // Find the match and region to get the margin
      const match = gameStatus.matches.find(
        (m) =>
          (m.playerAId === playerAId && m.playerBId === playerBId) ||
          (m.playerAId === playerBId && m.playerBId === playerAId),
      );
      if (match) {
        const regionStatus = betType.includes('front') ? match.frontNine
          : betType.includes('back') ? match.backNine
          : match.overall;
        marginAtPress = regionStatus.margin;
      }
    }

    const result = await createPressBet(
      activeGameData.game.id,
      parentBetId,
      betType,
      amount,
      playerAId,
      playerBId,
      pressInitiatedHole,
      marginAtPress,
    );

    // Clear concurrency guard
    const clearedFinal = new Set(get().pressingBetKeys);
    clearedFinal.delete(pressKey);
    set({ pressingBetKeys: clearedFinal });

    if (result.error) return { error: result.error };

    // Optimistically add the press bet
    if (result.betId) {
      const currentData = get().activeGameData;
      if (currentData) {
        const newBet: GameBetRow = {
          id: result.betId,
          game_id: currentData.game.id,
          bet_type: betType,
          amount,
          winner_id: null,
          settled: false,
          parent_bet_id: parentBetId,
          player_a_id: playerAId,
          player_b_id: playerBId,
          press_initiated_hole: pressInitiatedHole ?? null,
          margin_at_press: marginAtPress ?? null,
          created_at: new Date().toISOString(),
        };

        set({
          activeGameData: {
            ...currentData,
            bets: [...currentData.bets, newBet],
          },
        });

        get().recalculateGameStatus();
      }
    }

    return {};
  },

  // ─── Settlements ────────────────────────────────────────────

  calculateAndCreateSettlements: async () => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    const gameType = activeGameData.game.game_type;
    let settlements: GameSettlementResult[];

    switch (gameType) {
      case 'skins': {
        const skinsSettings = activeGameData.game.settings as SkinsSettings & { type: string };
        settlements = calculateSkinsSettlements({
          settings: skinsSettings,
          players: activeGameData.players,
          scores: activeGameData.scores,
        });
        break;
      }
      case 'match_play': {
        const mpSettings = activeGameData.game.settings as MatchPlaySettings & { type: string };
        settlements = calculateMatchPlaySettlements({
          settings: mpSettings,
          players: activeGameData.players,
          bets: activeGameData.bets,
          scores: activeGameData.scores,
        });
        break;
      }
      case 'wolf': {
        const wolfSettings = activeGameData.game.settings as WolfSettings & { type: string };
        settlements = calculateWolfSettlements({
          settings: wolfSettings,
          players: activeGameData.players,
          scores: activeGameData.scores,
          wolfChoices: get().wolfChoices,
        });
        break;
      }
      case 'nassau':
      default: {
        const nassauSettings = activeGameData.game.settings as NassauSettings & { type: string };
        settlements = calculateNassauSettlements({
          settings: nassauSettings,
          players: activeGameData.players,
          bets: activeGameData.bets,
          scores: activeGameData.scores,
        });
        break;
      }
    }

    if (settlements.length === 0) return { settlements: [] };

    const result = await createSettlementsService(
      activeGameData.game.id,
      settlements,
      activeGameData.players,
    );

    if (result.error) return { error: result.error };

    // Reload game to get settlement rows with IDs
    await get().loadActiveGame(activeGameData.game.id);

    return { settlements };
  },

  markPaid: async (settlementId, method) => {
    const { activeGameData } = get();
    if (!activeGameData) return { error: 'No active game' };

    const result = await markSettlementPaidService(settlementId, method);
    if (result.error) return { error: result.error };

    // Optimistically update local settlement
    const updatedSettlements = activeGameData.settlements.map((s) =>
      s.id === settlementId
        ? { ...s, status: 'settled' as const, settlement_method: method, settled_at: new Date().toISOString() }
        : s,
    );

    set({
      activeGameData: { ...activeGameData, settlements: updatedSettlements },
    });

    return {};
  },

  // ─── Real-time ──────────────────────────────────────────────

  subscribeToActiveGame: () => {
    const { activeGameData, realtimeChannel } = get();
    if (!activeGameData || realtimeChannel) return;

    const channel = subscribeToGame(activeGameData.game.id, {
      onScoreChange: (score) => {
        const current = get().activeGameData;
        if (!current) return;

        const idx = current.scores.findIndex(
          (s) => s.player_id === score.player_id && s.hole_number === score.hole_number,
        );

        const updatedScores = [...current.scores];
        if (idx >= 0) {
          updatedScores[idx] = score;
        } else {
          updatedScores.push(score);
        }

        set({ activeGameData: { ...current, scores: updatedScores } });
        get().recalculateGameStatus();
      },

      onBetChange: (bet) => {
        const current = get().activeGameData;
        if (!current) return;

        const idx = current.bets.findIndex((b) => b.id === bet.id);
        const updatedBets = [...current.bets];
        if (idx >= 0) {
          updatedBets[idx] = bet;
        } else {
          updatedBets.push(bet);
        }

        set({ activeGameData: { ...current, bets: updatedBets } });
        get().recalculateGameStatus();
      },

      onSettlementChange: (settlement) => {
        const current = get().activeGameData;
        if (!current) return;

        const idx = current.settlements.findIndex((s) => s.id === settlement.id);
        const updatedSettlements = [...current.settlements];
        if (idx >= 0) {
          updatedSettlements[idx] = settlement;
        } else {
          updatedSettlements.push(settlement);
        }

        set({ activeGameData: { ...current, settlements: updatedSettlements } });
      },

      onPlayerChange: (_player) => {
        // A new player was added — reload entire game to get fresh players + bets
        const current = get().activeGameData;
        if (current) {
          get().loadActiveGame(current.game.id);
        }
      },

      onWolfChoiceChange: (wolfChoice) => {
        const currentChoices = get().wolfChoices;
        const idx = currentChoices.findIndex((c) => c.id === wolfChoice.id);
        const updated = [...currentChoices];
        if (idx >= 0) {
          updated[idx] = wolfChoice;
        } else {
          updated.push(wolfChoice);
        }
        set({ wolfChoices: updated });
        get().recalculateGameStatus();
      },
    });

    set({ realtimeChannel: channel });
  },

  unsubscribeFromActiveGame: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      unsubscribeFromGame(realtimeChannel);
      set({ realtimeChannel: null });
    }
  },

  // ─── Game Status Recalculation ──────────────────────────────

  recalculateGameStatus: () => {
    const { activeGameData } = get();
    if (!activeGameData) return;

    const gameType = activeGameData.game.game_type;

    switch (gameType) {
      case 'nassau': {
        const nassauSettings = activeGameData.game.settings as NassauSettings & { type: string };
        const status = calculateNassauStatus({
          settings: nassauSettings,
          players: activeGameData.players,
          bets: activeGameData.bets,
          scores: activeGameData.scores,
        });
        set({ gameStatus: { type: 'nassau', ...status } });
        break;
      }
      case 'skins': {
        const skinsSettings = activeGameData.game.settings as SkinsSettings & { type: string };
        const status = calculateSkinsStatus({
          settings: skinsSettings,
          players: activeGameData.players,
          scores: activeGameData.scores,
        });
        set({ gameStatus: { type: 'skins', ...status } });
        break;
      }
      case 'match_play': {
        const mpSettings = activeGameData.game.settings as MatchPlaySettings & { type: string };
        const status = calculateMatchPlayStatus({
          settings: mpSettings,
          players: activeGameData.players,
          bets: activeGameData.bets,
          scores: activeGameData.scores,
        });
        set({ gameStatus: { type: 'match_play', ...status } });
        break;
      }
      case 'wolf': {
        const wolfSettings = activeGameData.game.settings as WolfSettings & { type: string };
        const status = calculateWolfStatus({
          settings: wolfSettings,
          players: activeGameData.players,
          scores: activeGameData.scores,
          wolfChoices: get().wolfChoices,
        });
        set({ gameStatus: { type: 'wolf', ...status } });
        break;
      }
      default:
        set({ gameStatus: null });
        break;
    }
  },
}));
