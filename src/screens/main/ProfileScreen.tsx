import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useGameStore, useUIStore, useSubscriptionStore } from '../../stores';
import { RHCard } from '../../components/RHCard';
import { RHMoneyDisplay } from '../../components/RHMoneyDisplay';
import { RHLineChart } from '../../components/RHLineChart';
import { EmptyState } from '../../components/EmptyState';
import { ProfileStatsSkeleton } from '../../components/SkeletonLoader';
import { GolfBackground } from '../../components/backgrounds';
import {
  getInitials,
  formatHandicap,
  formatMemberSince,
  formatTrendText,
  formatGameType,
  formatMoney,
  formatDateShort,
  formatFriendCode,
} from '../../utils/format';
import { hapticLight, hapticWarning, hapticSuccess } from '../../utils/haptics';
import { springs } from '../../utils/animations';
import { registerForPushNotifications } from '../../services/notificationService';
import { getAllMatchupRecords, getGroupLeaderboard } from '../../services/aceService';
import { AcePremiumGate } from '../../components/AcePremiumGate';
import { useAcePaywall } from '../../hooks/useAcePaywall';
import type { ProfileStackScreenProps } from '../../navigation/types';
import type { GameTypeStats, PerformanceInsight, RecentGameSummary, HeadToHeadRecord, GroupLeaderboard } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function ProfileScreen({ navigation }: ProfileStackScreenProps<'ProfileMain'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const lifetimeStats = useGameStore((s) => s.lifetimeStats);
  const lifetimeStatsLoading = useGameStore((s) => s.lifetimeStatsLoading);
  const fetchLifetimeStats = useGameStore((s) => s.fetchLifetimeStats);
  const showToast = useUIStore((s) => s.showToast);
  const { isPremium, openPaywall } = useAcePaywall();
  const [matchupRecords, setMatchupRecords] = useState<HeadToHeadRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboard | null>(null);
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'all' | 'month' | 'year'>('all');

  // Fetch stats on focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchLifetimeStats(user.id);
        // Fetch Ace opponent rankings (premium only)
        if (isPremium) {
          getAllMatchupRecords(user.id).then((result) => {
            if (result.data) {
              const sorted = [...result.data].sort((a, b) => b.totalNet - a.totalNet);
              setMatchupRecords(sorted);
            }
          });
        }
      }
    }, [user?.id, isPremium]),
  );

  // Fetch leaderboard (premium only, reacts to timeframe changes)
  useEffect(() => {
    if (!user?.id || !isPremium) return;
    getGroupLeaderboard(user.id, leaderboardTimeframe).then((result) => {
      if (result.data) setLeaderboard(result.data);
    });
  }, [user?.id, isPremium, leaderboardTimeframe]);

  const handleSignOut = () => {
    hapticWarning();
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  if (!user) return null;

  const stats = lifetimeStats;
  const isNewUser = !stats || stats.gamesPlayed === 0;

  // Current month P/L for trend text
  const currentMonthNet = stats?.monthlyData?.length
    ? stats.monthlyData[stats.monthlyData.length - 1].monthly
    : 0;
  const previousMonthNet = stats?.monthlyData && stats.monthlyData.length > 1
    ? stats.monthlyData[stats.monthlyData.length - 2].cumulative
    : 0;
  const currentCumulative = stats?.monthlyData?.length
    ? stats.monthlyData[stats.monthlyData.length - 1].cumulative
    : 0;

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.semantic.surface }]}>
      <GolfBackground variant="combined" intensity="subtle" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
      <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
        Profile
      </Text>

      {/* ─── Header: Avatar + Info ─── */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.profileSection}>
        <View
          style={[styles.avatar, { backgroundColor: theme.colors.teal[500] }]}
        >
          <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
        </View>
        <Text style={[styles.userName, { color: theme.semantic.textPrimary }]}>
          {user.name}
        </Text>
        {user.handicap !== null && (
          <Text
            style={[styles.userDetail, { color: theme.semantic.textSecondary }]}
          >
            {formatHandicap(user.handicap)} Handicap
          </Text>
        )}
        {user.venmo_username && (
          <Text style={[styles.userDetail, { color: theme.colors.teal[500] }]}>
            {user.venmo_username}
          </Text>
        )}
        {user.friend_code && (
          <Text style={[styles.userDetail, { color: theme.semantic.textSecondary }]}>
            Code: {formatFriendCode(user.friend_code)}
          </Text>
        )}
        <Text
          style={[styles.memberSince, { color: theme.semantic.textSecondary }]}
        >
          {formatMemberSince(user.created_at)}
        </Text>
      </Animated.View>

      {/* ─── Loading State ─── */}
      {lifetimeStatsLoading && !stats && (
        <ProfileStatsSkeleton />
      )}

      {/* ─── Empty State (New User) ─── */}
      {!lifetimeStatsLoading && isNewUser && (
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <EmptyState
            title="No Games Yet"
            description="Play your first game to start tracking your stats and P/L."
            actionTitle="Start a Game"
            onAction={() => {
              const parent = navigation.getParent();
              if (parent) parent.navigate('NewGameTab' as any);
            }}
          />
        </Animated.View>
      )}

      {/* ─── Stats Dashboard ─── */}
      {stats && stats.gamesPlayed > 0 && (
        <>
          {/* Hero P/L */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(100)}
            style={styles.heroSection}
          >
            <Text
              style={[styles.heroLabel, { color: theme.semantic.textSecondary }]}
            >
              Lifetime P/L
            </Text>
            <RHMoneyDisplay
              amount={stats.totalNet}
              size="large"
              animate={true}
            />
            <Text
              style={[
                styles.trendText,
                {
                  color:
                    currentMonthNet > 0
                      ? theme.colors.green[500]
                      : currentMonthNet < 0
                        ? theme.colors.red[500]
                        : theme.semantic.textSecondary,
                },
              ]}
            >
              {formatTrendText(currentCumulative, previousMonthNet)}
            </Text>
          </Animated.View>

          {/* P/L Chart */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(200)}
            style={styles.chartSection}
          >
            <RHCard>
              <RHLineChart
                data={stats.monthlyData}
                height={200}
                animated={true}
              />
            </RHCard>
          </Animated.View>

          {/* Stats Grid (2x2) */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(300)}
            style={styles.statsGrid}
          >
            <MiniStatCard
              label="Games"
              value={String(stats.gamesPlayed)}
              theme={theme}
            />
            <MiniStatCard
              label="Win Rate"
              value={`${stats.winRate.toFixed(0)}%`}
              theme={theme}
            />
            <MiniStatCard
              label="Best Month"
              value={stats.bestMonth ? formatMoney(stats.bestMonth.net) : '--'}
              sublabel={stats.bestMonth?.label}
              theme={theme}
              moneyColor={
                stats.bestMonth && stats.bestMonth.net > 0
                  ? theme.colors.green[500]
                  : stats.bestMonth && stats.bestMonth.net < 0
                    ? theme.colors.red[500]
                    : undefined
              }
            />
            <MiniStatCard
              label="Streak"
              value={
                stats.currentStreak.count > 0
                  ? `${stats.currentStreak.count}${stats.currentStreak.type === 'win' ? 'W' : 'L'}`
                  : '--'
              }
              theme={theme}
              moneyColor={
                stats.currentStreak.type === 'win' && stats.currentStreak.count > 0
                  ? theme.colors.green[500]
                  : stats.currentStreak.type === 'loss' && stats.currentStreak.count > 0
                    ? theme.colors.red[500]
                    : undefined
              }
            />
          </Animated.View>

          {/* Game Type Breakdown */}
          {stats.gameTypeStats.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(500).delay(400)}
              style={styles.section}
            >
              <Text
                style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
              >
                By Game Type
              </Text>
              <RHCard>
                {stats.gameTypeStats.map((gs, i) => (
                  <GameTypeRow
                    key={gs.gameType}
                    stats={gs}
                    maxNet={Math.max(
                      ...stats.gameTypeStats.map((s) => Math.abs(s.net)),
                      1,
                    )}
                    theme={theme}
                    isLast={i === stats.gameTypeStats.length - 1}
                    index={i}
                  />
                ))}
              </RHCard>
            </Animated.View>
          )}

          {/* Performance Insights */}
          {stats.insights.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(500).delay(500)}
              style={styles.section}
            >
              <Text
                style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
              >
                Insights
              </Text>
              <RHCard>
                <View style={styles.insightsGrid}>
                  {stats.insights.map((insight) => (
                    <InsightItem
                      key={insight.label}
                      insight={insight}
                      theme={theme}
                    />
                  ))}
                </View>
              </RHCard>
            </Animated.View>
          )}

          {/* Ace Opponent Rankings */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(550)}
            style={styles.section}
          >
            <AcePremiumGate
              onUpgrade={openPaywall}
              teaserText="See which opponents are most profitable for you"
            >
              {matchupRecords.length > 0 && (
                <>
                  <Text
                    style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
                  >
                    Opponent Rankings
                  </Text>
                  <RHCard>
                    {matchupRecords.map((record, i) => (
                      <OpponentRankRow
                        key={record.opponentUserId}
                        record={record}
                        rank={i + 1}
                        theme={theme}
                        isFirst={i === 0}
                        isLast={i === matchupRecords.length - 1}
                        isWorst={i === matchupRecords.length - 1 && matchupRecords.length > 1}
                      />
                    ))}
                  </RHCard>
                </>
              )}
            </AcePremiumGate>
          </Animated.View>

          {/* Ace Group Leaderboard */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(575)}
            style={styles.section}
          >
            <AcePremiumGate
              onUpgrade={openPaywall}
              teaserText="Track your P/L leaderboard across your golf group"
            >
              {leaderboard && leaderboard.entries.length > 0 && (
                <>
                  <Text
                    style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
                  >
                    Leaderboard
                  </Text>

                  {/* Timeframe toggle */}
                  <View style={aceStyles.timeframeRow}>
                    {(['all', 'year', 'month'] as const).map((tf) => (
                      <TimeframePill
                        key={tf}
                        label={tf === 'all' ? 'All Time' : tf === 'year' ? 'This Year' : 'This Month'}
                        isSelected={leaderboardTimeframe === tf}
                        onPress={() => {
                          hapticLight();
                          setLeaderboardTimeframe(tf);
                        }}
                        theme={theme}
                      />
                    ))}
                  </View>

                  <RHCard>
                    {leaderboard.entries.map((entry, i) => (
                      <LeaderboardRow
                        key={entry.userId}
                        entry={entry}
                        rank={i + 1}
                        theme={theme}
                        isFirst={i === 0}
                        isLast={i === leaderboard.entries.length - 1}
                      />
                    ))}
                    <View style={[aceStyles.totalRow, { borderTopColor: theme.semantic.border }]}>
                      <Text style={[aceStyles.totalLabel, { color: theme.semantic.textSecondary }]}>
                        Your total ({leaderboard.totalGames} games)
                      </Text>
                      <RHMoneyDisplay
                        amount={leaderboard.yourTotalNet}
                        size="small"
                        animate={false}
                      />
                    </View>
                  </RHCard>
                </>
              )}
            </AcePremiumGate>
          </Animated.View>

          {/* Recent Games */}
          {stats.recentGames.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(500).delay(600)}
              style={styles.section}
            >
              <Text
                style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
              >
                Recent Games
              </Text>
              <RHCard style={styles.recentGamesCard}>
                {stats.recentGames.map((game, i) => (
                  <RecentGameRow
                    key={game.gameId}
                    game={game}
                    theme={theme}
                    isLast={i === stats.recentGames.length - 1}
                    onPress={() => {
                      hapticLight();
                      const parent = navigation.getParent();
                      if (parent) {
                        parent.navigate('HomeTab' as any, {
                          screen: 'GameDetail',
                          params: { gameId: game.gameId },
                        });
                      }
                    }}
                  />
                ))}
              </RHCard>
            </Animated.View>
          )}
        </>
      )}

      {/* ─── Account Settings ─── */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: theme.semantic.textPrimary }]}
        >
          Account
        </Text>
        <RHCard style={styles.settingsCard}>
          <SettingsRow
            label="Edit Profile"
            onPress={() => {
              hapticLight();
              navigation.navigate('EditProfile');
            }}
            theme={theme}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.semantic.border }]}
          />
          <SettingsRow
            label="Friends"
            onPress={() => {
              hapticLight();
              navigation.navigate('FriendsList');
            }}
            theme={theme}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.semantic.border }]}
          />
          <SettingsRow
            label={isPremium ? 'Nassau Pro (Active)' : 'Upgrade to Nassau Pro'}
            onPress={async () => {
              hapticLight();
              if (!isPremium) {
                openPaywall();
              } else {
                // Open RevenueCat Customer Center for subscription management
                const result = await useSubscriptionStore.getState().presentCustomerCenter();
                if (result.error) {
                  showToast('Manage your subscription in Settings > Subscriptions.', 'info');
                }
              }
            }}
            theme={theme}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.semantic.border }]}
          />
          <SettingsRow
            label="Payment Settings"
            onPress={() => {
              hapticLight();
              showToast('Coming soon', 'info');
            }}
            theme={theme}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.semantic.border }]}
          />
          <SettingsRow
            label="Notifications"
            onPress={async () => {
              hapticLight();
              const result = await registerForPushNotifications(user.id);
              if (result.error) {
                showToast(result.error, 'error');
              } else if (result.token) {
                hapticSuccess();
                showToast('Notifications enabled', 'success');
              } else {
                showToast('Notification permission denied', 'info');
              }
            }}
            theme={theme}
          />
        </RHCard>
      </View>

      {/* ─── Legal + Logout ─── */}
      <View style={styles.section}>
        <RHCard style={styles.settingsCard}>
          <SettingsRow
            label="Terms of Service"
            onPress={() => hapticLight()}
            theme={theme}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.semantic.border }]}
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => hapticLight()}
            theme={theme}
          />
          <View
            style={[styles.divider, { backgroundColor: theme.semantic.border }]}
          />
          <SettingsRow
            label="Delete Account"
            onPress={() => {
              hapticWarning();
              Alert.alert(
                'Delete Account',
                'This will permanently delete your account and all data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      showToast('Contact support to delete your account', 'info');
                    },
                  },
                ],
              );
            }}
            theme={theme}
            danger
          />
        </RHCard>
      </View>

      <Text style={[styles.versionText, { color: theme.semantic.textSecondary }]}>
        Nassau v1.0.0
      </Text>

      <Pressable onPress={handleSignOut} style={styles.logoutButton}>
        <Text style={[styles.logoutText, { color: theme.colors.red[500] }]}>
          Log Out
        </Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Mini stat card for the 2x2 grid */
function MiniStatCard({
  label,
  value,
  sublabel,
  theme,
  moneyColor,
}: {
  label: string;
  value: string;
  sublabel?: string;
  theme: any;
  moneyColor?: string;
}) {
  return (
    <RHCard style={styles.miniStatCard}>
      <Text
        style={[
          styles.miniStatValue,
          { color: moneyColor ?? theme.semantic.textPrimary },
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.miniStatLabel, { color: theme.semantic.textSecondary }]}>
        {label}
      </Text>
      {sublabel && (
        <Text style={[styles.miniStatSublabel, { color: theme.semantic.textSecondary }]}>
          {sublabel}
        </Text>
      )}
    </RHCard>
  );
}

/** Bar row for game type breakdown — no animation, just clean static bars */
function GameTypeRow({
  stats,
  maxNet,
  theme,
  isLast,
}: {
  stats: GameTypeStats;
  maxNet: number;
  theme: any;
  isLast: boolean;
  index: number;
}) {
  const widthPercent = `${(Math.abs(stats.net) / maxNet) * 100}%`;
  const barColor =
    stats.net >= 0 ? theme.colors.green[500] : theme.colors.red[500];

  return (
    <View
      style={[
        styles.gameTypeRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: theme.semantic.border,
        },
      ]}
    >
      <View style={styles.gameTypeInfo}>
        <Text
          style={[styles.gameTypeName, { color: theme.semantic.textPrimary }]}
        >
          {formatGameType(stats.gameType)}
        </Text>
        <Text
          style={[styles.gameTypeRecord, { color: theme.semantic.textSecondary }]}
        >
          {stats.wins}W - {stats.losses}L
        </Text>
      </View>
      <View style={styles.gameTypeBarContainer}>
        <View
          style={[
            styles.gameTypeBar,
            { backgroundColor: barColor + '30', width: widthPercent as any },
          ]}
        >
          <View
            style={[styles.gameTypeBarFill, { backgroundColor: barColor }]}
          />
        </View>
      </View>
      <Text
        style={[
          styles.gameTypeNet,
          {
            color:
              stats.net >= 0
                ? theme.colors.green[500]
                : theme.colors.red[500],
          },
        ]}
      >
        {formatMoney(stats.net)}
      </Text>
    </View>
  );
}

/** Insight item for the 2x2 insights grid */
function InsightItem({
  insight,
  theme,
}: {
  insight: PerformanceInsight;
  theme: any;
}) {
  const isPositive = insight.value.startsWith('+');
  const isNegative = insight.value.startsWith('-');

  return (
    <View style={styles.insightItem}>
      <Text
        style={[styles.insightLabel, { color: theme.semantic.textSecondary }]}
      >
        {insight.label}
      </Text>
      <Text
        style={[
          styles.insightValue,
          {
            color: isPositive
              ? theme.colors.green[500]
              : isNegative
                ? theme.colors.red[500]
                : theme.semantic.textPrimary,
          },
        ]}
      >
        {insight.value}
      </Text>
      {insight.sublabel && (
        <Text
          style={[styles.insightSublabel, { color: theme.semantic.textSecondary }]}
        >
          {insight.sublabel}
        </Text>
      )}
    </View>
  );
}

/** Recent game row — tappable */
function RecentGameRow({
  game,
  theme,
  isLast,
  onPress,
}: {
  game: RecentGameSummary;
  theme: any;
  isLast: boolean;
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
        scale.value = withSpring(1, springs.snappy);
      }}
      onPress={onPress}
      style={[
        styles.recentGameRow,
        animatedStyle,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: theme.semantic.border,
        },
      ]}
    >
      <View style={styles.recentGameLeft}>
        <Text
          style={[styles.recentGameCourse, { color: theme.semantic.textPrimary }]}
        >
          {game.courseName}
        </Text>
        <Text
          style={[styles.recentGameMeta, { color: theme.semantic.textSecondary }]}
        >
          {formatGameType(game.gameType)} · {formatDateShort(game.date)} ·{' '}
          {game.playerCount} players
        </Text>
      </View>
      <View style={styles.recentGameRight}>
        <Text
          style={[
            styles.recentGameNet,
            {
              color:
                game.net > 0
                  ? theme.colors.green[500]
                  : game.net < 0
                    ? theme.colors.red[500]
                    : theme.semantic.textSecondary,
            },
          ]}
        >
          {formatMoney(game.net)}
        </Text>
        <View
          style={[
            styles.resultBadge,
            {
              backgroundColor:
                game.result === 'win'
                  ? theme.colors.green[500] + '20'
                  : game.result === 'loss'
                    ? theme.colors.red[500] + '20'
                    : theme.semantic.border,
            },
          ]}
        >
          <Text
            style={[
              styles.resultBadgeText,
              {
                color:
                  game.result === 'win'
                    ? theme.colors.green[500]
                    : game.result === 'loss'
                      ? theme.colors.red[500]
                      : theme.semantic.textSecondary,
              },
            ]}
          >
            {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'P'}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

/** Opponent rank row for Ace feature */
function OpponentRankRow({
  record,
  rank,
  theme,
  isFirst,
  isLast,
  isWorst,
}: {
  record: HeadToHeadRecord;
  rank: number;
  theme: any;
  isFirst: boolean;
  isLast: boolean;
  isWorst: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.97, springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, springs.snappy); }}
      style={[
        aceStyles.opponentRow,
        animatedStyle,
        isFirst && { backgroundColor: theme.colors.teal[500] + '08' },
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: theme.semantic.border },
      ]}
    >
      <Text style={[aceStyles.rankNum, { color: theme.semantic.textSecondary }]}>
        {rank}
      </Text>
      <View style={aceStyles.opponentInfo}>
        <Text style={[aceStyles.opponentName, { color: theme.semantic.textPrimary }]}>
          {record.opponentName}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Text style={[aceStyles.opponentRecord, { color: theme.semantic.textSecondary }]}>
            {record.wins}-{record.losses}
          </Text>
          {isFirst && (
            <Text style={[aceStyles.badge, { color: theme.colors.teal[500] }]}>
              Best Matchup
            </Text>
          )}
          {isWorst && (
            <Text style={[aceStyles.badge, { color: theme.colors.red[500] }]}>
              Toughest Rival
            </Text>
          )}
        </View>
      </View>
      <RHMoneyDisplay
        amount={record.totalNet}
        size="small"
        animate={false}
      />
    </AnimatedPressable>
  );
}

/** Timeframe pill for leaderboard toggle */
function TimeframePill({
  label,
  isSelected,
  onPress,
  theme,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.95, springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, springs.bouncy); }}
      onPress={onPress}
      style={[
        aceStyles.pill,
        {
          backgroundColor: isSelected ? theme.colors.teal[500] : theme.semantic.surface,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          aceStyles.pillText,
          { color: isSelected ? '#FFFFFF' : theme.semantic.textSecondary },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** Leaderboard row */
function LeaderboardRow({
  entry,
  rank,
  theme,
  isFirst,
  isLast,
}: {
  entry: { userId: string; name: string; netVsYou: number; gamesPlayed: number };
  rank: number;
  theme: any;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <View
      style={[
        aceStyles.leaderboardRow,
        isFirst && { backgroundColor: theme.colors.teal[500] + '08' },
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: theme.semantic.border },
      ]}
    >
      <Text style={[aceStyles.rankNum, { color: theme.semantic.textSecondary }]}>
        {rank}
      </Text>
      <View style={aceStyles.opponentInfo}>
        <Text style={[aceStyles.opponentName, { color: theme.semantic.textPrimary }]}>
          {entry.name}
        </Text>
        <Text style={[aceStyles.opponentRecord, { color: theme.semantic.textSecondary }]}>
          {entry.gamesPlayed} game{entry.gamesPlayed !== 1 ? 's' : ''}
        </Text>
      </View>
      <RHMoneyDisplay
        amount={entry.netVsYou}
        size="small"
        animate={false}
      />
    </View>
  );
}

/** Settings row with press animation */
function SettingsRow({
  label,
  onPress,
  theme,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  theme: any;
  danger?: boolean;
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
        scale.value = withSpring(1, springs.snappy);
      }}
      onPress={onPress}
      style={[settingsStyles.row, animatedStyle]}
    >
      <Text
        style={[
          settingsStyles.label,
          {
            color: danger
              ? theme.colors.red[500]
              : theme.semantic.textPrimary,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[settingsStyles.arrow, { color: theme.semantic.textSecondary }]}
      >
        {'\u203A'}
      </Text>
    </AnimatedPressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const settingsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
  },
  arrow: {
    fontSize: 20,
    fontWeight: '300',
  },
});

const aceStyles = StyleSheet.create({
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rankNum: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
  },
  opponentInfo: {
    flex: 1,
    marginLeft: 4,
  },
  opponentName: {
    fontSize: 15,
    fontWeight: '600',
  },
  opponentRecord: {
    fontSize: 12,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
  },
  totalLabel: {
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  memberSince: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 6,
  },

  // Hero P/L
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },

  // Chart
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  miniStatCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  miniStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  miniStatSublabel: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },

  // Game type breakdown
  gameTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  gameTypeInfo: {
    width: 80,
  },
  gameTypeName: {
    fontSize: 14,
    fontWeight: '600',
  },
  gameTypeRecord: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  gameTypeBarContainer: {
    flex: 1,
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  gameTypeBar: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
    justifyContent: 'center',
  },
  gameTypeBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  gameTypeNet: {
    fontSize: 14,
    fontWeight: '700',
    width: 70,
    textAlign: 'right',
  },

  // Insights
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  insightItem: {
    width: '50%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  insightSublabel: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },

  // Recent games
  recentGamesCard: {
    paddingVertical: 4,
  },
  recentGameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  recentGameLeft: {
    flex: 1,
    marginRight: 12,
  },
  recentGameCourse: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  recentGameMeta: {
    fontSize: 12,
    fontWeight: '400',
  },
  recentGameRight: {
    alignItems: 'flex-end',
  },
  recentGameNet: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  resultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingsCard: {
    paddingVertical: 2,
  },
  divider: {
    height: 1,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 8,
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
