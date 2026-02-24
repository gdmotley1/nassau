import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useGameStore, useUIStore } from '../../stores';
import { RHCard } from '../../components/RHCard';
import { RHButton } from '../../components/RHButton';
import { AceInsightCard } from '../../components/AceInsightCard';
import { EmptyState } from '../../components/EmptyState';
import { RHErrorState } from '../../components/RHErrorState';
import { SwipeableGameCard } from '../../components/SwipeableGameCard';
import { GolfBackground } from '../../components/backgrounds';
import {
  DashboardWelcomeSkeleton,
  GameCardSkeleton,
} from '../../components/SkeletonLoader';
import {
  formatGameType,
  formatDateShort,
  formatMoneyShort,
  formatMoney,
} from '../../utils/format';
import { hapticLight } from '../../utils/haptics';
import { springs } from '../../utils/animations';
import { useAcePaywall } from '../../hooks/useAcePaywall';
import { AcePremiumGate } from '../../components/AcePremiumGate';
import { getScoringTrends, getAllMatchupRecords } from '../../services/aceService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';
import type { ScoringTrends, HeadToHeadRecord, ScoreRow, NassauSettings } from '../../types';

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

/** Get contextual status message based on current state */
function getStatusMessage(
  activeGames: any[],
  totalGames: number,
): { text: string; isTeal: boolean } {
  const inProgressGames = activeGames.filter((g) => g.status === 'in_progress');
  const lobbyGames = activeGames.filter((g) => g.status === 'created');

  if (inProgressGames.length > 0) {
    return {
      text: inProgressGames.length === 1
        ? 'You have a game in progress'
        : `You have ${inProgressGames.length} games in progress`,
      isTeal: true,
    };
  }
  if (lobbyGames.length > 0) {
    return { text: 'Your game is ready to go', isTeal: true };
  }
  if (totalGames > 0) {
    return { text: 'Ready for the next round?', isTeal: false };
  }
  return { text: 'Welcome to Nassau', isTeal: false };
}

export function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { activeGames, activeGameScores, recentGames, recentGameNets, monthlyNet, wins, losses, isLoading, dashboardError, fetchDashboardData } =
    useGameStore();
  const showToast = useUIStore((s) => s.showToast);

  const { isPremium, openPaywall } = useAcePaywall();
  const [refreshing, setRefreshing] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);
  const [scoringTrends, setScoringTrends] = useState<ScoringTrends | null>(null);
  const [topRival, setTopRival] = useState<HeadToHeadRecord | null>(null);
  const [aceDismissed, setAceDismissed] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData(user.id);
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
  const hasActiveGames = activeGames.length > 0;
  const statusMessage = getStatusMessage(activeGames, totalGames);

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

        {/* ─── Status Line + CTA ─── */}
        {isLoading && !refreshing ? (
          <DashboardWelcomeSkeleton />
        ) : (
          <Animated.View
            entering={FadeInDown.duration(500).delay(100)}
            style={styles.statusSection}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: statusMessage.isTeal
                    ? theme.colors.teal[500]
                    : theme.semantic.textSecondary,
                },
              ]}
            >
              {statusMessage.text}
            </Text>
            {!hasActiveGames && (
              <View style={styles.ctaContainer}>
                <RHButton
                  title="Start a Game"
                  variant="primary"
                  onPress={() => {
                    hapticLight();
                    navigation.navigate('NewGameTab' as any);
                  }}
                />
              </View>
            )}
          </Animated.View>
        )}

        {/* ─── Error State ─── */}
        {dashboardError && !isLoading && activeGames.length === 0 && recentGames.length === 0 && (
          <RHErrorState
            title="Couldn't load your games"
            description={dashboardError}
            onRetry={() => {
              if (user?.id) fetchDashboardData(user.id);
            }}
          />
        )}

        {/* ─── Active Games (promoted to top) ─── */}
        {activeGames.length > 0 && (
          <Animated.View
            entering={FadeInDown.duration(500).delay(150)}
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
                scores={activeGameScores[game.id] ?? []}
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

        {/* ─── Quick Actions ─── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(250)}
          style={styles.quickActionsRow}
        >
          <QuickActionChip
            icon="plus-circle"
            label="New Game"
            onPress={() => {
              hapticLight();
              navigation.navigate('NewGameTab' as any);
            }}
            theme={theme}
          />
          <QuickActionChip
            icon="users"
            label="Friends"
            onPress={() => {
              hapticLight();
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate('ProfileTab', { screen: 'FriendsList' });
              }
            }}
            theme={theme}
          />
          <QuickActionChip
            icon="clock"
            label="History"
            onPress={() => {
              hapticLight();
              navigation.navigate('HistoryTab' as any);
            }}
            theme={theme}
          />
        </Animated.View>

        {/* ─── This Month Summary ─── */}
        {totalGames > 0 && (
          <Animated.View
            entering={FadeInDown.duration(500).delay(350)}
            style={styles.section}
          >
            <MonthSummaryCard
              monthlyNet={monthlyNet}
              wins={wins}
              losses={losses}
              totalGames={totalGames}
              theme={theme}
              onPress={() => {
                hapticLight();
                const parent = navigation.getParent();
                if (parent) {
                  parent.navigate('ProfileTab', { screen: 'ProfileMain' });
                }
              }}
            />
          </Animated.View>
        )}

        {/* ─── Ace Rival Insight ─── */}
        {topRival && topRival.gamesPlayed >= 2 && !aceDismissed && (
          <Animated.View
            entering={FadeInDown.duration(500).delay(450)}
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
            entering={FadeInDown.duration(500).delay(hasActiveGames ? 550 : 400)}
            style={styles.section}
          >
            <Text
              style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
            >
              Recent
            </Text>
            {recentGames.map((game) => (
              <SwipeableGameCard
                key={game.id}
                closeSignal={closeSignal}
                onOpen={() => setCloseSignal((s) => s + 1)}
                actions={[
                  {
                    icon: 'eye',
                    label: 'View',
                    color: theme.colors.teal[500],
                    onPress: () => {
                      hapticLight();
                      navigation.navigate('GameDetail', { gameId: game.id });
                    },
                  },
                  {
                    icon: 'share',
                    label: 'Share',
                    color: theme.colors.gray[500],
                    onPress: () => {
                      hapticLight();
                      showToast('Sharing coming soon', 'info');
                    },
                  },
                ]}
              >
                <RecentGameCard
                  game={game}
                  net={recentGameNets[game.id] ?? 0}
                  theme={theme}
                  onPress={() => {
                    hapticLight();
                    navigation.navigate('GameDetail', { gameId: game.id });
                  }}
                />
              </SwipeableGameCard>
            ))}

            <Pressable
              onPress={() => {
                hapticLight();
                navigation.navigate('HistoryTab' as any);
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
                title="Your golf journey starts here"
                description="Create your first game and start tracking bets with friends."
                actionTitle="Create Game"
                onAction={() => navigation.navigate('NewGameTab' as any)}
              />
            </Animated.View>
          )
        )}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

/** Quick action chip for the horizontal action row */
function QuickActionChip({
  icon,
  label,
  onPress,
  theme,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shadowStyle = theme.isDark
    ? { borderWidth: 1, borderColor: theme.semantic.border }
    : theme.shadows.sm;

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.95, springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, springs.bouncy); }}
      onPress={onPress}
      style={[
        chipStyles.chip,
        { backgroundColor: theme.semantic.card },
        shadowStyle,
        animatedStyle,
      ]}
    >
      <Feather name={icon} size={20} color={theme.colors.teal[500]} />
      <Text style={[chipStyles.label, { color: theme.semantic.textPrimary }]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** This Month summary card — compact P/L + record + games */
function MonthSummaryCard({
  monthlyNet,
  wins: w,
  losses: l,
  totalGames,
  theme,
  onPress,
}: {
  monthlyNet: number;
  wins: number;
  losses: number;
  totalGames: number;
  theme: any;
  onPress: () => void;
}) {
  const netColor = monthlyNet > 0
    ? theme.colors.green[500]
    : monthlyNet < 0
      ? theme.colors.red[500]
      : theme.semantic.textSecondary;

  return (
    <RHCard onPress={onPress}>
      <Text style={[monthStyles.cardLabel, { color: theme.semantic.textSecondary }]}>
        THIS MONTH
      </Text>
      <View style={monthStyles.row}>
        {/* Net P/L */}
        <View style={monthStyles.statColumn}>
          <Text style={[monthStyles.statValue, { color: netColor }]}>
            {formatMoneyShort(monthlyNet)}
          </Text>
          <Text style={[monthStyles.statLabel, { color: theme.semantic.textSecondary }]}>
            Net
          </Text>
        </View>

        <View style={[monthStyles.divider, { backgroundColor: theme.semantic.border }]} />

        {/* Record */}
        <View style={monthStyles.statColumn}>
          <Text style={[monthStyles.statValue, { color: theme.semantic.textPrimary }]}>
            {w}-{l}
          </Text>
          <Text style={[monthStyles.statLabel, { color: theme.semantic.textSecondary }]}>
            Record
          </Text>
        </View>

        <View style={[monthStyles.divider, { backgroundColor: theme.semantic.border }]} />

        {/* Games */}
        <View style={monthStyles.statColumn}>
          <Text style={[monthStyles.statValue, { color: theme.semantic.textPrimary }]}>
            {totalGames}
          </Text>
          <Text style={[monthStyles.statLabel, { color: theme.semantic.textSecondary }]}>
            Games
          </Text>
        </View>
      </View>

      {/* See details hint */}
      <View style={monthStyles.detailsRow}>
        <Text style={[monthStyles.detailsText, { color: theme.colors.teal[500] }]}>
          See full stats {'\u203A'}
        </Text>
      </View>
    </RHCard>
  );
}

/** Tiny score cell for dashboard mini-scorecard */
function MiniScoreCell({ strokes, par, theme }: { strokes: number | null; par: number; theme: any }) {
  const diff = strokes !== null ? strokes - par : 0;
  const color = strokes === null
    ? theme.semantic.textSecondary
    : diff <= -2 ? theme.colors.teal[500]
    : diff === -1 ? theme.colors.green[500]
    : diff === 0 ? theme.semantic.textPrimary
    : diff === 1 ? theme.colors.red[400]
    : theme.colors.red[500];

  const bg = strokes === null
    ? 'transparent'
    : diff <= -2 ? theme.colors.teal[500] + '20'
    : diff === -1 ? theme.colors.green[500] + '15'
    : diff >= 2 ? theme.colors.red[500] + '15'
    : 'transparent';

  return (
    <View style={[miniStyles.cell, { backgroundColor: bg }]}>
      <Text style={[miniStyles.text, { color }]}>
        {strokes ?? '-'}
      </Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  cell: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});

/** Enhanced active game card with live indicator + mini-scorecard */
function ActiveGameCard({
  game,
  scores,
  theme,
  onPress,
}: {
  game: any;
  scores: ScoreRow[];
  theme: any;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const players = game.game_players ?? [];
  const settings = game.settings as (NassauSettings & { type: string }) | undefined;
  const numHoles = settings?.num_holes ?? 18;
  const holePars = settings?.hole_pars ?? Array(numHoles).fill(4);

  // Compute current hole and last 3 scored holes
  const maxHole = scores.length > 0 ? Math.max(...scores.map((s: ScoreRow) => s.hole_number)) : 0;
  const currentHoleDisplay = Math.min(maxHole + 1, numHoles);

  // Find last 3 holes where all players have scores
  const completedHoles: number[] = [];
  for (let h = maxHole; h >= 1 && completedHoles.length < 3; h--) {
    const allScored = players.every((p: any) =>
      scores.some((s: ScoreRow) => s.player_id === p.id && s.hole_number === h),
    );
    if (allScored) completedHoles.push(h);
  }
  completedHoles.reverse();

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

        {/* Hole indicator */}
        {maxHole > 0 && (
          <Text style={[styles.holeIndicatorText, { color: theme.colors.teal[500] }]}>
            Hole {currentHoleDisplay} of {numHoles}
          </Text>
        )}

        {/* Mini scorecard: last 3 holes */}
        {completedHoles.length > 0 && (
          <View style={styles.miniScorecard}>
            <View style={styles.miniRow}>
              <View style={styles.miniNameCell} />
              {completedHoles.map((h) => (
                <View key={h} style={styles.miniHoleCell}>
                  <Text style={[styles.miniHoleNum, { color: theme.semantic.textSecondary }]}>
                    {h}
                  </Text>
                </View>
              ))}
            </View>
            {players.map((p: any) => (
              <View key={p.id} style={styles.miniRow}>
                <View style={styles.miniNameCell}>
                  <Text
                    style={[styles.miniName, { color: theme.semantic.textSecondary }]}
                    numberOfLines={1}
                  >
                    {(p.users?.name ?? p.guest_name ?? 'Player').split(' ')[0]}
                  </Text>
                </View>
                {completedHoles.map((h) => {
                  const score = scores.find(
                    (s: ScoreRow) => s.player_id === p.id && s.hole_number === h,
                  );
                  const strokes = score?.strokes ?? null;
                  const par = holePars[h - 1] ?? 4;
                  return (
                    <View key={h} style={styles.miniScoreWrapper}>
                      <MiniScoreCell strokes={strokes} par={par} theme={theme} />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* Player names (only if no mini scorecard) */}
        {completedHoles.length === 0 && (
          <Text
            style={[styles.activeGamePlayers, { color: theme.semantic.textSecondary }]}
            numberOfLines={1}
          >
            {players
              .map((gp: any) => gp.users?.name ?? gp.guest_name ?? 'Player')
              .join(' \u00B7 ')}
          </Text>
        )}

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

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

const monthStyles = StyleSheet.create({
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 32,
  },
  detailsRow: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  detailsText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

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

  // Status section
  statusSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  ctaContainer: {
    marginTop: 16,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
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

  // Mini-scorecard on active game card
  holeIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 6,
    marginBottom: 4,
  },
  miniScorecard: {
    marginTop: 4,
    marginBottom: 8,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
  },
  miniNameCell: {
    width: 52,
    paddingRight: 4,
  },
  miniName: {
    fontSize: 11,
    fontWeight: '500',
  },
  miniHoleCell: {
    width: 28,
    alignItems: 'center',
  },
  miniHoleNum: {
    fontSize: 9,
    fontWeight: '600',
  },
  miniScoreWrapper: {
    width: 28,
    alignItems: 'center',
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
