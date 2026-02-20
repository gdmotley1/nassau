import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useTheme } from '../../hooks/useTheme';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { RHButton, RHMoneyDisplay, RHSettlementCard, AceInsightCard } from '../../components';
import { openVenmoPayment } from '../../services/settlementService';
import { getPostRoundAnalysis, getPressReplay, type PostRoundAnalysis } from '../../services/aceService';
import { hapticWinCelebration, hapticError } from '../../utils/haptics';
import { formatPlayerName, formatMoney } from '../../utils/format';
import { useAcePaywall } from '../../hooks/useAcePaywall';
import { AcePremiumGate } from '../../components/AcePremiumGate';
import { getPlayerNetAmount, calculateNassauSettlements } from '../../engine/nassauCalculator';
import { calculateSkinsSettlements } from '../../engine/skinsCalculator';
import { calculateMatchPlaySettlements } from '../../engine/matchPlayCalculator';
import { calculateWolfSettlements } from '../../engine/wolfCalculator';
import type { HomeStackScreenProps } from '../../navigation/types';
import type { NassauSettings, SkinsSettings, MatchPlaySettings, WolfSettings, SettlementMethod, PressReplay, SkinsSettlement } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function SettlementScreen({ route, navigation }: HomeStackScreenProps<'Settlement'>) {
  const { gameId } = route.params;
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const {
    activeGameData,
    isLoading,
    loadActiveGame,
    markPaid,
    wolfChoices,
  } = useGameStore();
  const showToast = useUIStore((s) => s.showToast);
  const { isPremium, openPaywall } = useAcePaywall();
  const confettiRef = useRef<ConfettiCannon>(null);
  const [postRound, setPostRound] = useState<PostRoundAnalysis | null>(null);
  const [pressReplay, setPressReplay] = useState<PressReplay | null>(null);
  const [justPaidIds, setJustPaidIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeGameData || activeGameData.game.id !== gameId) {
      loadActiveGame(gameId);
    }
  }, [gameId]);

  // Fetch post-round analysis and press replay from Ace (premium only)
  useEffect(() => {
    if (user?.id && gameId && isPremium) {
      getPostRoundAnalysis(user.id, gameId).then((result) => {
        if (result.data) setPostRound(result.data);
      });
      getPressReplay(user.id, gameId).then((result) => {
        if (result.data) setPressReplay(result.data);
      });
    }
  }, [user?.id, gameId, isPremium]);

  const game = activeGameData?.game;
  const players = activeGameData?.players ?? [];
  const dbSettlements = activeGameData?.settlements ?? [];
  const rawSettings = game?.settings as (Record<string, any>) | undefined;
  const gameType = rawSettings?.type ?? 'nassau';
  const nassauSettings = gameType === 'nassau' ? rawSettings as (NassauSettings & { type: string }) : undefined;
  const skinsSettingsVal = gameType === 'skins' ? rawSettings as (SkinsSettings & { type: string }) : undefined;
  const numHolesFromSettings = (rawSettings?.num_holes ?? 18) as number;

  const calculatedSettlements = useMemo(() => {
    if (!activeGameData || !rawSettings) return [];
    if (gameType === 'skins') {
      return calculateSkinsSettlements({
        settings: rawSettings as SkinsSettings,
        players: activeGameData.players,
        scores: activeGameData.scores,
      });
    }
    if (gameType === 'match_play') {
      return calculateMatchPlaySettlements({
        settings: rawSettings as MatchPlaySettings,
        players: activeGameData.players,
        bets: activeGameData.bets,
        scores: activeGameData.scores,
      });
    }
    if (gameType === 'wolf') {
      return calculateWolfSettlements({
        settings: rawSettings as WolfSettings,
        players: activeGameData.players,
        scores: activeGameData.scores,
        wolfChoices,
      });
    }
    return calculateNassauSettlements({
      settings: rawSettings as NassauSettings,
      players: activeGameData.players,
      bets: activeGameData.bets,
      scores: activeGameData.scores,
    });
  }, [activeGameData, rawSettings, gameType, wolfChoices]);

  const myPlayer = players.find((p) => p.user_id === user?.id);
  const myNet = myPlayer
    ? getPlayerNetAmount(myPlayer.id, calculatedSettlements)
    : 0;

  useEffect(() => {
    if (myNet < 0) {
      hapticWinCelebration();
      setTimeout(() => confettiRef.current?.start(), 300);
    } else if (myNet > 0) {
      hapticError();
    }
  }, [myNet]);

  const handleVenmo = async (
    toPlayer: any,
    amount: number,
  ) => {
    const venmoUsername = toPlayer?.users?.venmo_username as string | undefined;

    if (!venmoUsername) {
      showToast(
        toPlayer?.guest_name
          ? 'Guest players don\'t have Venmo linked'
          : 'This player hasn\'t set up their Venmo username',
        'info',
      );
      return;
    }

    const note = `Nassau game - ${game?.course_name ?? 'Golf'}`;
    await openVenmoPayment(venmoUsername, amount, note);
  };

  const handleMarkCash = async (settlementId: string) => {
    const result = await markPaid(settlementId, 'cash');
    if (!result?.error) {
      setJustPaidIds((prev) => new Set(prev).add(settlementId));
    }
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

  const numHoles = numHolesFromSettings;
  const scores = activeGameData?.scores ?? [];
  const holesCompleted = scores.length > 0
    ? Math.max(...scores.map((s) => s.hole_number))
    : 0;
  const isPartialRound = holesCompleted > 0 && holesCompleted < numHoles;

  const isWin = myNet < 0;
  const heroGradientColors: [string, string] = isWin
    ? [theme.colors.green[500] + '12', 'transparent']
    : myNet > 0
    ? [theme.colors.red[500] + '0A', 'transparent']
    : ['transparent', 'transparent'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero: Your net */}
          <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
            <LinearGradient
              colors={heroGradientColors}
              style={styles.heroGradient}
            />
            <Text style={[styles.heroLabel, { color: theme.semantic.textSecondary }]}>
              {myNet <= 0 ? 'YOU WON' : 'YOU OWE'}
            </Text>
            <RHMoneyDisplay
              amount={-myNet}
              size="large"
              animate
            />
            {game.course_name && (
              <Text style={[styles.courseName, { color: theme.semantic.textSecondary }]}>
                {game.course_name}
              </Text>
            )}
            {isPartialRound && (
              <View style={[styles.partialBadge, { backgroundColor: theme.colors.red[500] + '14' }]}>
                <Text style={[styles.partialText, { color: theme.colors.red[400] }]}>
                  Ended after hole {holesCompleted} of {numHoles}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Bet Breakdown */}
          {calculatedSettlements.map((cs, i) => {
            const fromPlayer = players.find((p) => p.id === cs.fromPlayerId);
            const toPlayer = players.find((p) => p.id === cs.toPlayerId);

            return (
              <Animated.View
                key={i}
                entering={FadeInDown.duration(400).delay(200 + i * 100)}
              >
                <Text style={[styles.matchHeader, { color: theme.semantic.textSecondary }]}>
                  {formatPlayerName(fromPlayer ?? { guest_name: '?' })} →{' '}
                  {formatPlayerName(toPlayer ?? { guest_name: '?' })}
                </Text>

                <View style={[styles.breakdownCard, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}>
                  {cs.breakdown.map((item, j) => (
                    <View
                      key={j}
                      style={[
                        styles.breakdownRow,
                        j < cs.breakdown.length - 1 && {
                          borderBottomWidth: 0.5,
                          borderBottomColor: theme.semantic.border,
                        },
                      ]}
                    >
                      <Text style={[styles.breakdownLabel, { color: theme.semantic.textPrimary }]}>
                        {item.label}
                      </Text>
                      <Text
                        style={[
                          styles.breakdownAmount,
                          {
                            color:
                              item.amount === 0
                                ? theme.semantic.textSecondary
                                : item.amount > 0
                                ? theme.colors.red[500]
                                : theme.colors.green[500],
                          },
                        ]}
                      >
                        {item.amount === 0
                          ? 'Push'
                          : item.amount > 0
                          ? `-$${item.amount}`
                          : `+$${Math.abs(item.amount)}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            );
          })}

          {/* Settlement Cards from DB */}
          <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
            PAYMENTS
          </Text>

          {dbSettlements.map((s) => {
            const fromPlayer = players.find((p) => p.id === s.from_player_id);
            const toPlayer = players.find((p) => p.id === s.to_player_id);

            return (
              <Animated.View
                key={s.id}
                entering={FadeInDown.duration(400).delay(400)}
              >
                <RHSettlementCard
                  fromName={formatPlayerName(fromPlayer ?? { guest_name: '?' })}
                  toName={formatPlayerName(toPlayer ?? { guest_name: '?' })}
                  amount={s.amount}
                  isPaid={s.status === 'settled'}
                  animatePaid={justPaidIds.has(s.id)}
                  method={s.settlement_method}
                  onVenmo={() => handleVenmo(toPlayer ?? {}, s.amount)}
                  onCash={() => handleMarkCash(s.id)}
                />
              </Animated.View>
            );
          })}

          {dbSettlements.length === 0 && calculatedSettlements.length === 0 && (
            <Text style={[styles.noSettlements, { color: theme.semantic.textSecondary }]}>
              All square — no payments needed!
            </Text>
          )}

          {/* Ace Post-Round Analysis — Nassau only (press-related) */}
          {gameType === 'nassau' && (
          <Animated.View entering={FadeInDown.duration(400).delay(600)}>
            <AcePremiumGate
              onUpgrade={openPaywall}
              teaserText="See your round breakdown and missed press opportunities"
            >
              {postRound && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
                    ROUND ANALYSIS
                  </Text>
                  <AceInsightCard
                    variant="postRound"
                    headline="Round Recap"
                    body={(() => {
                      const parts: string[] = [];
                      if (postRound.comparisonToAverage > 0) {
                        parts.push(`You scored ${postRound.comparisonToAverage.toFixed(1)} strokes better than your season average.`);
                      } else if (postRound.comparisonToAverage < 0) {
                        parts.push(`You scored ${Math.abs(postRound.comparisonToAverage).toFixed(1)} strokes worse than your season average.`);
                      }
                      if (postRound.bestHole && postRound.bestHole.label !== 'Par') {
                        parts.push(`Best hole: ${postRound.bestHole.label} on hole ${postRound.bestHole.hole}.`);
                      }
                      if (postRound.missedPressOpportunities > 0) {
                        parts.push(`${postRound.missedPressOpportunities} missed press ${postRound.missedPressOpportunities === 1 ? 'opportunity' : 'opportunities'}.`);
                      }
                      return parts.length > 0 ? parts.join(' ') : `You shot ${postRound.totalScore} (${postRound.scoreToPar >= 0 ? '+' : ''}${postRound.scoreToPar}).`;
                    })()}
                    stat={`${postRound.scoreToPar >= 0 ? '+' : ''}${postRound.scoreToPar}`}
                    statLabel="to par"
                    supportingFacts={(() => {
                      const facts: string[] = [];
                      facts.push(`Front: ${postRound.front9Score}  Back: ${postRound.back9Score}`);
                      if (postRound.keyMoments.length > 0) {
                        facts.push(postRound.keyMoments.slice(0, 3).join(', '));
                      }
                      const worstType = postRound.parTypePerformance.reduce((worst, p) =>
                        p.avgVsPar > (worst?.avgVsPar ?? -Infinity) ? p : worst,
                      postRound.parTypePerformance[0]);
                      if (worstType && worstType.avgVsPar > 0.5) {
                        facts.push(`Par ${worstType.par}s are costing you +${worstType.avgVsPar.toFixed(1)} strokes`);
                      }
                      return facts;
                    })()}
                  />
                </>
              )}
            </AcePremiumGate>
          </Animated.View>
          )}

          {/* Ace Press Replay — Nassau only */}
          {gameType === 'nassau' && (
          <Animated.View entering={FadeInDown.duration(400).delay(700)}>
            <AcePremiumGate
              onUpgrade={openPaywall}
              teaserText="Replay every press decision from this round"
            >
              {pressReplay && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
                    PRESS REPLAY
                  </Text>

                  {pressReplay.totalPresses === 0 ? (
                    <Text style={[replayStyles.noPresses, { color: theme.semantic.textSecondary }]}>
                      No presses this round
                    </Text>
                  ) : (
                    <>
                      {/* Summary */}
                      <View style={[replayStyles.summaryRow, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}>
                        <Text style={[replayStyles.summaryText, { color: theme.semantic.textPrimary }]}>
                          {pressReplay.totalPresses} press{pressReplay.totalPresses !== 1 ? 'es' : ''}: {pressReplay.pressesWon}W {pressReplay.pressesLost}L
                        </Text>
                        <Text
                          style={[
                            replayStyles.summaryNet,
                            {
                              color: pressReplay.netFromPresses >= 0
                                ? theme.colors.green[500]
                                : theme.colors.red[500],
                            },
                          ]}
                        >
                          {pressReplay.netFromPresses >= 0 ? '+' : ''}${Math.abs(pressReplay.netFromPresses).toFixed(0)}
                        </Text>
                      </View>

                      {/* Timeline */}
                      <View style={replayStyles.timeline}>
                        {pressReplay.events.map((event, i) => {
                          const nodeColor = event.outcome === 'won'
                            ? theme.colors.green[500]
                            : event.outcome === 'lost'
                            ? theme.colors.red[500]
                            : theme.colors.gray[500];

                          return (
                            <View key={i} style={replayStyles.timelineItem}>
                              {/* Left connector */}
                              <View style={replayStyles.connectorCol}>
                                {i > 0 && (
                                  <View style={[replayStyles.connectorLine, { backgroundColor: theme.colors.teal[500] + '40' }]} />
                                )}
                                <View style={[replayStyles.node, { backgroundColor: nodeColor }]} />
                                {i < pressReplay.events.length - 1 && (
                                  <View style={[replayStyles.connectorLineBottom, { backgroundColor: theme.colors.teal[500] + '40' }]} />
                                )}
                              </View>

                              {/* Right content */}
                              <View style={replayStyles.eventContent}>
                                <Text style={[replayStyles.eventTitle, { color: theme.semantic.textPrimary }]}>
                                  Hole {event.hole} — {event.region}
                                </Text>
                                <Text style={[replayStyles.eventDetail, { color: theme.semantic.textSecondary }]}>
                                  {event.pressedBy} pressed ${event.amount}{event.margin > 0 ? ` (${event.margin} down)` : ''}
                                </Text>
                                <View style={[replayStyles.outcomeBadge, { backgroundColor: nodeColor + '18' }]}>
                                  <Text style={[replayStyles.outcomeText, { color: nodeColor }]}>
                                    {event.outcome === 'won' ? `Won +$${event.netResult}` : event.outcome === 'lost' ? `Lost -$${Math.abs(event.netResult)}` : 'Push'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {/* What If card */}
                  {pressReplay.missedOpportunities > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <AceInsightCard
                        variant="insight"
                        headline="What If?"
                        body={`You declined ${pressReplay.missedOpportunities} press${pressReplay.missedOpportunities !== 1 ? 'es' : ''} this round. If you'd taken them all, your estimated press net would be ${formatMoney(pressReplay.whatIfNet)}.`}
                        stat={formatMoney(pressReplay.whatIfNet)}
                        statLabel="est. net"
                      />
                    </View>
                  )}
                </>
              )}
            </AcePremiumGate>
          </Animated.View>
          )}
        </ScrollView>

      {/* Win confetti */}
      <ConfettiCannon
        ref={confettiRef}
        count={60}
        origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
        fadeOut
        colors={['#00D4AA', '#00C805', '#FFFFFF', '#33DDBB']}
        autoStart={false}
        explosionSpeed={350}
        fallSpeed={3000}
      />

      <View style={[styles.footer, { borderTopColor: theme.semantic.border }]}>
        <RHButton
          title="Done"
          onPress={() => {
            // Navigate to Profile tab and reset this stack
            navigation.getParent()?.navigate('ProfileTab', { screen: 'ProfileMain' });
            // Pop back to root of current stack so it's clean if user returns
            setTimeout(() => navigation.popToTop(), 100);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const replayStyles = StyleSheet.create({
  noPresses: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryNet: {
    fontSize: 17,
    fontWeight: '800',
  },
  timeline: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 60,
  },
  connectorCol: {
    width: 24,
    alignItems: 'center',
  },
  connectorLine: {
    width: 2,
    flex: 1,
  },
  connectorLineBottom: {
    width: 2,
    flex: 1,
  },
  node: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  eventContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventDetail: {
    fontSize: 12,
    marginBottom: 4,
  },
  outcomeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  outcomeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20, position: 'relative' },
  heroGradient: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: 0,
    borderRadius: 16,
  },
  heroLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  courseName: { fontSize: 15, marginTop: 8 },
  partialBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  partialText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  matchHeader: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  breakdownCard: { borderRadius: 12, borderWidth: 0.5, overflow: 'hidden' },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  breakdownLabel: { fontSize: 15, fontWeight: '500' },
  breakdownAmount: { fontSize: 15, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 8 },
  noSettlements: { fontSize: 16, textAlign: 'center', paddingVertical: 20 },
  footer: { padding: 16, borderTopWidth: 0.5 },
});
