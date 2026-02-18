import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SlideInUp } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useGameStore } from '../../stores';
import { RHCard } from '../../components/RHCard';
import { EmptyState } from '../../components/EmptyState';
import { GameCardSkeleton } from '../../components/SkeletonLoader';
import {
  formatGameType,
  formatDateShort,
  formatMoneyShort,
} from '../../utils/format';
import { hapticLight } from '../../utils/haptics';
import { supabase } from '../../services/supabase';
import type { HistoryStackScreenProps } from '../../navigation/types';
import type { SettlementRow } from '../../types';

type FilterOption = 'week' | 'month' | 'all';

export function HistoryScreen({ navigation }: HistoryStackScreenProps<'HistoryList'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const fetchGameHistory = useGameStore((s) => s.fetchGameHistory);

  const [filter, setFilter] = useState<FilterOption>('month');
  const [games, setGames] = useState<any[]>([]);
  const [gameNets, setGameNets] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    if (!user?.id) return;
    const data = await fetchGameHistory(user.id, filter);
    setGames(data);

    // Fetch settlements for these games to compute net amounts
    const gameIds = data.map((g: any) => g.id);
    if (gameIds.length > 0) {
      const { data: settlements } = await supabase
        .from('settlements')
        .select('*')
        .in('game_id', gameIds);

      const nets: Record<string, number> = {};
      (settlements ?? []).forEach((s: SettlementRow) => {
        const current = nets[s.game_id] ?? 0;
        if (s.to_user_id === user.id) nets[s.game_id] = current + s.amount;
        else if (s.from_user_id === user.id) nets[s.game_id] = current - s.amount;
      });
      setGameNets(nets);
    }

    setLoading(false);
  }, [user?.id, filter]);

  useEffect(() => {
    setLoading(true);
    loadGames();
  }, [loadGames]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGames();
    setRefreshing(false);
  };

  const filters: { key: FilterOption; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.semantic.surface }]}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.teal[500]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
        History
      </Text>

      {/* Filter tabs */}
      <View
        style={[
          styles.filterRow,
          { backgroundColor: theme.semantic.inputBackground },
        ]}
      >
        {filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => {
              hapticLight();
              setFilter(f.key);
            }}
            style={[
              styles.filterTab,
              filter === f.key && {
                backgroundColor: theme.colors.teal[500],
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color:
                    filter === f.key
                      ? '#FFFFFF'
                      : theme.semantic.textSecondary,
                },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Games list */}
      <View style={styles.list}>
        {loading ? (
          <>
            <GameCardSkeleton />
            <GameCardSkeleton />
            <GameCardSkeleton />
          </>
        ) : games.length === 0 ? (
          <EmptyState
            title="No game history"
            description="Your completed games will appear here."
          />
        ) : (
          games.map((game, index) => (
            <Animated.View
              key={game.id}
              entering={SlideInUp.delay(index * 60)
                .springify()
                .damping(18)
                .stiffness(120)}
            >
              <RHCard
                onPress={() => {
                  hapticLight();
                  navigation.navigate('GameDetail', { gameId: game.id });
                }}
                style={styles.gameCard}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text
                      style={[
                        styles.gameDate,
                        { color: theme.semantic.textSecondary },
                      ]}
                    >
                      {formatDateShort(game.completed_at ?? game.created_at)}
                    </Text>
                    <Text
                      style={[
                        styles.gameType,
                        { color: theme.semantic.textPrimary },
                      ]}
                    >
                      {formatGameType(game.game_type)}
                    </Text>
                    <Text
                      style={[
                        styles.gamePlayers,
                        { color: theme.semantic.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      You + {game.game_players.length - 1} others
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.gameNet,
                      {
                        color:
                          (gameNets[game.id] ?? 0) >= 0
                            ? theme.colors.green[500]
                            : theme.colors.red[500],
                      },
                    ]}
                  >
                    {formatMoneyShort(gameNets[game.id] ?? 0)}
                  </Text>
                </View>
              </RHCard>
            </Animated.View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 3,
    marginBottom: 20,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
  },
  gameCard: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
  },
  gameDate: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  gameType: {
    fontSize: 17,
    fontWeight: '600',
  },
  gamePlayers: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 4,
  },
  gameNet: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
