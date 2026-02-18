import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useGameStore } from '../../stores';
import { RHMoneyDisplay } from '../../components/RHMoneyDisplay';
import { RHCard } from '../../components/RHCard';
import { AceInsightCard } from '../../components/AceInsightCard';
import { EmptyState } from '../../components/EmptyState';
import { GolfBackground } from '../../components/backgrounds';
import {
  DashboardHeroSkeleton,
  GameCardSkeleton,
} from '../../components/SkeletonLoader';
import {
  formatGameType,
  formatDateShort,
  formatMoneyShort,
  formatRecord,
  formatMoney,
} from '../../utils/format';
import { hapticLight } from '../../utils/haptics';
import { springs } from '../../utils/animations';
import { useAcePaywall } from '../../hooks/useAcePaywall';
import { AcePremiumGate } from '../../components/AcePremiumGate';
import { getScoringTrends, getAllMatchupRecords } from '../../services/aceService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';
import type { ScoringTrends, HeadToHeadRecord } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList & Record<string, any>, 'Dashboard'>;
};

/** Get a time-based greeting */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Get first name from full name */
function getFirstName(name: string): string {
  return name.split(' ')[0];
}

export function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { activeGames, recentGames, recentGameNets, monthlyNet, wins, losses, isLoading, fetchDashboardData } =
    useGameStore();

  const { isPremium, openPaywall } = useAcePaywall();
  const [refreshing, setRefreshing] = useState(false);
  const [scoringTrends, setScoringTrends] = useState<ScoringTrends | null>(null);
  const [topRival, setTopRival] = useState<HeadToHeadRecord | null>(null);
  const [aceDismissed, setAceDismissed] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData(user.id);
      // Fetch Ace analytics only for premium users
      if (isPremium) {
        getScoringTrends(user.id).then((res) => {
          if (res.data) setScoringTrends(res.data);
        });
        getAllMatchupRecords(user.id).then((res) => {
          if (res.data && res.data.length > 0) {
            const sorted = [...res.data].sort((a, b) => b.gamesPlayed - a.gamesPlayed);
            setTopRival(sorted[0]);
          }
        });
      }
    }
  }, [user?.id, isPremium]);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    setAceDismissed(false);
    await fetchDashboardData(user.id);
    if (isPremium) {
      getScoringTrends(user.id).then((res) => {
        if (res.data) setScoringTrends(res.data);
      });
      getAllMatchupRecords(user.id).then((res) => {
        if (res.data && res.data.length > 0) {
          const sorted = [...res.data].sort((a, b) => b.gamesPlayed - a.gamesPlayed);
          setTopRival(sorted[0]);
        }
      });
    }
    setRefreshing(false);
  }, [user?.id, isPremium]);

  const totalGames = wins + losses;
  const firstName = user?.name ? getFirstName(user.name) : '';

  // Form indicator badge
  const formBadge = scoringTrends?.formIndicator;
  const formColor = formBadge === 'hot'
    ? theme.colors.green[500]
    : formBadge === 'cold'
      ? theme.colors.red[500]
      : theme.semantic.textSecondary;
  const formLabel = formBadge === 'hot'
    ? 'HOT'
    : formBadge === 'cold'
      ? 'COLD'
      : 'STEADY';

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.semantic.surface }]}>
      <GolfBackground variant="undulation" intensity="subtle" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
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
        {/* ─── Header: Greeting + Form Badge ─── */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.header}
        >
          <View>
            <Text style={[styles.greeting, { color: theme.semantic.textSecondary }]}>
              {getGreeting()}
            </Text>
            <Text style={[styles.userName, { color: theme.semantic.textPrimary }]}>
              {firstName}
            </Text>
          </View>
          {isPremium && scoringTrends && totalGames >= 3 && (
            <View style={[styles.formBadge, { backgroundColor: formColor + '18' }]}>
              <View style={[styles.formDot, { backgroundColor: formColor }]} />
              <Text style={[styles.formText, { color: formColor }]}>
                {formLabel}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* ─── Hero: Monthly P/L ─── */}
        {isLoading && !refreshing ? (
          <DashboardHeroSkeleton />
        ) : (
          <Animated.View
            entering={FadeInDown.duration(500).delay(100)}
            style={styles.hero}
          >
            <LinearGradient
              colors={[theme.colors.teal[500] + '08', 'transparent']}
              style={styles.heroGradient}
            />
            <Text
              style={[styles.heroLabel, { color: theme.semantic.textSecondary }]}
            >
              This Month
            </Text>
            <RHMoneyDisplay amount={monthlyNet} size="large" animate />
            {totalGames > 0 && (
              <Text
                style={[styles.heroStats, { color: theme.semantic.textSecondary }]}
              >
                {formatRecord(wins, losses)}  ·  {totalGames} games
              </Text>
            )}
          </Animated.View>
        )}

        {/* ─── Quick Stats Row ─── */}
        {isPremium && totalGames > 0 && scoringTrends && (
          <Animated.View
            entering={FadeInDown.duration(500).delay(200)}
            style={styles.quickStatsRow}
          >
            <QuickStat
              label="Avg Score"
              value={scoringTrends.last5AvgScore > 0 ? scoringTrends.last5AvgScore.toFixed(0) : '--'}
              sublabel="Last 5"
              theme={theme}
            />
            <View style={[styles.quickStatDivider, { backgroundColor: theme.semantic.border }]} />
            <QuickStat
              label="Win Rate"
              value={totalGames > 0 ? `${((wins / totalGames) * 100).toFixed(0)}%` : '--'}
              sublabel={`${wins}W ${losses}L`}
              theme={theme}
              color={wins >= losses ? theme.colors.green[500] : theme.colors.red[500]}
            />
            <View style={[styles.quickStatDivider, { backgroundColor: theme.semantic.border }]} />
            <QuickStat
              label="Trend"
              value={scoringTrends.recentTrend > 0
                ? `${scoringTrends.recentTrend.toFixed(1)}`
                : scoringTrends.recentTrend < 0
                  ? `${scoringTrends.recentTrend.toFixed(1)}`
                  : '--'}
              sublabel={scoringTrends.recentTrend > 0 ? 'Improving' : scoringTrends.recentTrend < 0 ? 'Declining' : 'Steady'}
              theme={theme}
              color={scoringTrends.recentTrend > 0
                ? theme.colors.green[500]
                : scoringTrends.recentTrend < 0
                  ? theme.colors.red[500]
                  : theme.semantic.textSecondary}
            />
          </Animated.View>
        )}

        {/* ─── Active Games ─── */}
        {activeGames.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(500).delay(300)}
            style={styles.section}
          >
            <Text
              style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
            >
              Active Now
            </Text>
            {activeGames.map((game) => (
              <ActiveGameCard
                key={game.id}
                game={game}
                theme={theme}
                onPress={() => {
                  hapticLight();
                  if (game.status === 'in_progress') {
                    navigation.navigate('Scorecard', { gameId: game.id });
                  } else {
                    navigation.navigate('GameLobby', { gameId: game.id });
                  }
                }}
              />
            ))}
          </Animated.View>
        )}

        {/* ─── Ace Rival Insight ─── */}
        {topRival && topRival.gamesPlayed >= 2 && !aceDismissed && (
          <Animated.View
            entering={FadeInDown.duration(500).delay(400)}
            style={styles.section}
          >
            <AcePremiumGate
              onUpgrade={openPaywall}
              teaserText="See head-to-head records and rival insights"
            >
              <AceInsightCard
                variant="matchup"
                headline={`vs ${topRival.opponentName}`}
                body={
                  topRival.totalNet > 0
                    ? `You're up ${formatMoney(topRival.totalNet)} against ${topRival.opponentName} over ${topRival.gamesPlayed} games.`
                    : topRival.totalNet < 0
                      ? `${topRival.opponentName} has the edge — you're ${formatMoney(topRival.totalNet)} overall across ${topRival.gamesPlayed} games.`
                      : `You and ${topRival.opponentName} are dead even after ${topRival.gamesPlayed} games.`
                }
                stat={`${topRival.wins}-${topRival.losses}`}
                statLabel="record"
                supportingFacts={[
                  `Net: ${formatMoney(topRival.totalNet)}`,
                  `Avg margin: ${formatMoney(topRival.averageMargin)}/game`,
                ]}
                onDismiss={() => setAceDismissed(true)}
              />
            </AcePremiumGate>
          </Animated.View>
        )}

        {/* ─── Recent Games ─── */}
        {isLoading && !refreshing ? (
          <View style={styles.section}>
            <GameCardSkeleton />
            <GameCardSkeleton />
            <GameCardSkeleton />
          </View>
        ) : recentGames.length > 0 ? (
          <Animated.View
            entering={FadeInDown.duration(500).delay(activeGames.length > 0 ? 500 : 300)}
            style={styles.section}
          >
            <Text
              style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
            >
              Recent
            </Text>
            {recentGames.map((game) => (
              <RecentGameCard
                key={game.id}
                game={game}
                net={recentGameNets[game.id] ?? 0}
                theme={theme}
                onPress={() => {
                  hapticLight();
                  navigation.navigate('GameDetail', { gameId: game.id });
                }}
              />
            ))}

            <Pressable
              onPress={() => {
                hapticLight();
                navigation.navigate('HistoryTab');
              }}
              style={styles.seeAllButton}
            >
              <Text
                style={[styles.seeAllText, { color: theme.colors.teal[500] }]}
              >
                See All History {'\u203A'}
              </Text>
            </Pressable>
          </Animated.View>
        ) : (
          !isLoading && (
            <Animated.View entering={FadeInDown.duration(500).delay(200)}>
              <EmptyState
                title="No games yet"
                description="Create your first game to start tracking bets with friends."
                actionTitle="Create Game"
                onAction={() => navigation.navigate('NewGameTab')}
              />
            </Animated.View>
          )
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

/** Quick stat pill in the horizontal row */
function QuickStat({
  label,
  value,
  sublabel,
  theme,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  theme: any;
  color?: string;
}) {
  return (
    <View style={styles.quickStatItem}>
      <Text style={[styles.quickStatValue, { color: color ?? theme.semantic.textPrimary }]}>
        {value}
      </Text>
      <Text style={[styles.quickStatLabel, { color: theme.semantic.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.quickStatSublabel, { color: theme.semantic.textSecondary }]}>
        {sublabel}
      </Text>
    </View>
  );
}

/** Enhanced active game card with live indicator */
function ActiveGameCard({
  game,
  theme,
  onPress,
}: {
  game: any;
  theme: any;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.bouncy);
      }}
      onPress={onPress}
      style={animatedStyle}
    >
      <RHCard style={styles.activeGameCard}>
        <View style={styles.activeGameHeader}>
          <View style={styles.activeGameLeft}>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: theme.colors.green[500] }]} />
              <Text style={[styles.liveLabel, { color: theme.colors.green[500] }]}>
                LIVE
              </Text>
            </View>
            <Text style={[styles.activeGameType, { color: theme.semantic.textPrimary }]}>
              {formatGameType(game.game_type)}
            </Text>
          </View>
          <View style={styles.activeGameRight}>
            <Text style={[styles.activeGamePot, { color: theme.semantic.textPrimary }]}>
              ${game.total_pot}
            </Text>
            <Text style={[styles.activeGamePotLabel, { color: theme.semantic.textSecondary }]}>
              total pot
            </Text>
          </View>
        </View>
        <Text
          style={[styles.activeGamePlayers, { color: theme.semantic.textSecondary }]}
          numberOfLines={1}
        >
          {game.game_players
            .map((gp: any) => gp.users?.name ?? gp.guest_name ?? 'Player')
            .join(' · ')}
        </Text>
        <View style={[styles.continueBar, { backgroundColor: theme.colors.teal[500] + '12' }]}>
          <Text style={[styles.continueText, { color: theme.colors.teal[500] }]}>
            Continue Playing {'\u203A'}
          </Text>
        </View>
      </RHCard>
    </AnimatedPressable>
  );
}

/** Redesigned recent game card */
function RecentGameCard({
  game,
  net,
  theme,
  onPress,
}: {
  game: any;
  net: number;
  theme: any;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const netColor = net > 0
    ? theme.colors.green[500]
    : net < 0
      ? theme.colors.red[500]
      : theme.semantic.textSecondary;

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.bouncy);
      }}
      onPress={onPress}
      style={animatedStyle}
    >
      <RHCard style={styles.recentCard}>
        <View style={styles.recentCardRow}>
          <View style={styles.recentCardLeft}>
            <Text style={[styles.recentCardDate, { color: theme.semantic.textSecondary }]}>
              {formatDateShort(game.completed_at ?? game.created_at)}
            </Text>
            <Text style={[styles.recentCardType, { color: theme.semantic.textPrimary }]}>
              {formatGameType(game.game_type)}
            </Text>
            <Text style={[styles.recentCardPlayers, { color: theme.semantic.textSecondary }]} numberOfLines={1}>
              {game.game_players.length} players
            </Text>
          </View>
          <View style={styles.recentCardRight}>
            <Text style={[styles.recentCardNet, { color: netColor }]}>
              {formatMoneyShort(net)}
            </Text>
            <View
              style={[
                styles.resultBadge,
                { backgroundColor: netColor + '18' },
              ]}
            >
              <Text style={[styles.resultBadgeText, { color: netColor }]}>
                {net > 0 ? 'W' : net < 0 ? 'L' : 'P'}
              </Text>
            </View>
          </View>
        </View>
      </RHCard>
    </AnimatedPressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  formBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    marginTop: 8,
  },
  formDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  formText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    position: 'relative',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroStats: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },

  // Quick Stats
  quickStatsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  quickStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  quickStatSublabel: {
    fontSize: 10,
    fontWeight: '400',
    marginTop: 1,
  },
  quickStatDivider: {
    width: 1,
    marginVertical: 10,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Active game card
  activeGameCard: {
    marginBottom: 12,
  },
  activeGameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activeGameLeft: {
    flex: 1,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  activeGameType: {
    fontSize: 18,
    fontWeight: '700',
  },
  activeGameRight: {
    alignItems: 'flex-end',
  },
  activeGamePot: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  activeGamePotLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  activeGamePlayers: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 10,
  },
  continueBar: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Recent game card
  recentCard: {
    marginBottom: 10,
  },
  recentCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentCardLeft: {
    flex: 1,
  },
  recentCardDate: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  recentCardType: {
    fontSize: 16,
    fontWeight: '600',
  },
  recentCardPlayers: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  recentCardRight: {
    alignItems: 'flex-end',
  },
  recentCardNet: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // See all
  seeAllButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  seeAllText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
