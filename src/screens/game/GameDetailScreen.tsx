import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { RHCard, RHMoneyDisplay, RHButton } from '../../components';
import { formatPlayerName, formatDateShort } from '../../utils/format';
import { calculateNassauSettlements, getPlayerNetAmount } from '../../engine/nassauCalculator';
import type { HomeStackScreenProps } from '../../navigation/types';
import type { NassauSettings } from '../../types';

export function GameDetailScreen({ route, navigation }: HomeStackScreenProps<'GameDetail'>) {
  const { gameId } = route.params;
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const { activeGameData, isLoading, loadActiveGame } = useGameStore();

  useEffect(() => {
    if (!activeGameData || activeGameData.game.id !== gameId) {
      loadActiveGame(gameId);
    }
  }, [gameId]);

  const game = activeGameData?.game;
  const players = activeGameData?.players ?? [];
  const scores = activeGameData?.scores ?? [];
  const settings = game?.settings as (NassauSettings & { type: string }) | undefined;
  const holePars = settings?.hole_pars ?? Array(18).fill(4);

  const settlements = useMemo(() => {
    if (!activeGameData || !settings) return [];
    return calculateNassauSettlements({
      settings,
      players: activeGameData.players,
      bets: activeGameData.bets,
      scores: activeGameData.scores,
    });
  }, [activeGameData, settings]);

  const myPlayer = players.find((p) => p.user_id === user?.id);
  const myNet = myPlayer ? getPlayerNetAmount(myPlayer.id, settlements) : 0;

  const getScore = (playerId: string, hole: number) => {
    return scores.find((s) => s.player_id === playerId && s.hole_number === hole)?.strokes ?? null;
  };

  if (isLoading || !game) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.teal[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
            Game Results
          </Text>
          <Text style={[styles.subtitle, { color: theme.semantic.textSecondary }]}>
            {game.course_name ?? 'Golf'}{' '}
            {game.completed_at ? `· ${formatDateShort(game.completed_at)}` : ''}
          </Text>
        </Animated.View>

        {/* Your Result */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.heroCard}>
          <RHCard>
            <View style={styles.heroContent}>
              <Text style={[styles.heroLabel, { color: theme.semantic.textSecondary }]}>
                YOUR RESULT
              </Text>
              <RHMoneyDisplay amount={-myNet} size="large" animate={false} />
            </View>
          </RHCard>
        </Animated.View>

        {/* Scorecard (read-only) */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
            SCORECARD
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Hole header */}
              <View style={styles.gridRow}>
                <View style={[styles.nameCell, { borderColor: theme.semantic.border }]}>
                  <Text style={[styles.headerText, { color: theme.semantic.textSecondary }]}>
                    Hole
                  </Text>
                </View>
                {Array.from({ length: 18 }, (_, i) => (
                  <View
                    key={i}
                    style={[styles.holeCell, { borderColor: theme.semantic.border }]}
                  >
                    <Text style={[styles.holeCellText, { color: theme.semantic.textSecondary }]}>
                      {i + 1}
                    </Text>
                  </View>
                ))}
                <View style={[styles.totalCol, { borderColor: theme.semantic.border }]}>
                  <Text style={[styles.headerText, { color: theme.semantic.textSecondary }]}>
                    TOT
                  </Text>
                </View>
              </View>

              {/* Par row */}
              <View style={styles.gridRow}>
                <View style={[styles.nameCell, { borderColor: theme.semantic.border }]}>
                  <Text style={[styles.headerText, { color: theme.semantic.textSecondary }]}>
                    Par
                  </Text>
                </View>
                {holePars.map((par, i) => (
                  <View
                    key={i}
                    style={[styles.holeCell, { borderColor: theme.semantic.border }]}
                  >
                    <Text style={[styles.parText, { color: theme.semantic.textSecondary }]}>
                      {par}
                    </Text>
                  </View>
                ))}
                <View style={[styles.totalCol, { borderColor: theme.semantic.border }]}>
                  <Text style={[styles.parText, { color: theme.semantic.textSecondary }]}>
                    {holePars.reduce((a, b) => a + b, 0)}
                  </Text>
                </View>
              </View>

              {/* Player rows */}
              {players.map((player) => {
                let total = 0;
                return (
                  <View key={player.id} style={styles.gridRow}>
                    <View style={[styles.nameCell, { borderColor: theme.semantic.border }]}>
                      <Text
                        style={[styles.playerText, { color: theme.semantic.textPrimary }]}
                        numberOfLines={1}
                      >
                        {formatPlayerName(player)}
                      </Text>
                    </View>
                    {Array.from({ length: 18 }, (_, i) => {
                      const s = getScore(player.id, i + 1);
                      if (s !== null) total += s;
                      const diff = s !== null ? s - holePars[i] : 0;
                      const color =
                        s === null
                          ? theme.semantic.textSecondary
                          : diff <= -1
                          ? theme.colors.green[500]
                          : diff >= 1
                          ? theme.colors.red[500]
                          : theme.semantic.textPrimary;

                      return (
                        <View
                          key={i}
                          style={[styles.holeCell, { borderColor: theme.semantic.border }]}
                        >
                          <Text style={[styles.scoreText, { color }]}>
                            {s ?? '-'}
                          </Text>
                        </View>
                      );
                    })}
                    <View style={[styles.totalCol, { borderColor: theme.semantic.border }]}>
                      <Text style={[styles.totalText, { color: theme.semantic.textPrimary }]}>
                        {total > 0 ? total : '-'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>

        {/* Settlement Summary */}
        {settlements.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
              SETTLEMENTS
            </Text>
            {settlements.map((s, i) => {
              const from = players.find((p) => p.id === s.fromPlayerId);
              const to = players.find((p) => p.id === s.toPlayerId);
              const dbRecord = (activeGameData?.settlements ?? []).find(
                (ds) => ds.from_player_id === s.fromPlayerId && ds.to_player_id === s.toPlayerId,
              );

              return (
                <View
                  key={i}
                  style={[
                    styles.settlementRow,
                    { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border },
                  ]}
                >
                  <Text style={[styles.settlementText, { color: theme.semantic.textPrimary }]}>
                    {formatPlayerName(from ?? { guest_name: '?' })} owes{' '}
                    {formatPlayerName(to ?? { guest_name: '?' })}
                  </Text>
                  <View style={styles.settlementRight}>
                    <Text style={[styles.settlementAmount, { color: theme.colors.red[500] }]}>
                      ${s.amount.toFixed(2)}
                    </Text>
                    {dbRecord?.status === 'settled' && (
                      <Text style={[styles.paidBadge, { color: theme.colors.green[500] }]}>
                        PAID
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.semantic.border }]}>
        <RHButton title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  heroCard: { marginTop: -4 },
  heroContent: { alignItems: 'center', paddingVertical: 8 },
  heroLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  // Grid
  gridRow: { flexDirection: 'row' },
  nameCell: {
    width: 70,
    paddingHorizontal: 6,
    paddingVertical: 8,
    justifyContent: 'center',
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  headerText: { fontSize: 11, fontWeight: '600' },
  holeCell: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  holeCellText: { fontSize: 11, fontWeight: '600' },
  parText: { fontSize: 11 },
  playerText: { fontSize: 12, fontWeight: '600' },
  scoreText: { fontSize: 13, fontWeight: '700' },
  totalCol: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderLeftWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  totalText: { fontSize: 14, fontWeight: '800' },

  // Settlements
  settlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.5,
    marginTop: 6,
  },
  settlementText: { fontSize: 14, fontWeight: '500', flex: 1 },
  settlementRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settlementAmount: { fontSize: 16, fontWeight: '700' },
  paidBadge: { fontSize: 11, fontWeight: '700' },

  footer: { padding: 16, borderTopWidth: 0.5 },
});
