import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { RHButton, RHCard, AceInsightCard } from '../../components';
import { hapticSuccess } from '../../utils/haptics';
import { formatPlayerName } from '../../utils/format';
import { useAcePaywall } from '../../hooks/useAcePaywall';
import { AcePremiumGate } from '../../components/AcePremiumGate';
import { getHeadToHeadRecord, getCourseScouting } from '../../services/aceService';
import type { HomeStackScreenProps } from '../../navigation/types';
import type { NassauSettings, SkinsSettings, MatchPlaySettings, WolfSettings, HeadToHeadRecord, CourseScouting } from '../../types';

export function GameLobbyScreen({ route, navigation }: HomeStackScreenProps<'GameLobby'>) {
  const { gameId } = route.params;
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const {
    activeGameData,
    isLoading,
    loadActiveGame,
    startActiveGame,
    cancelActiveGame,
  } = useGameStore();

  const { isPremium, openPaywall } = useAcePaywall();
  const [matchups, setMatchups] = useState<HeadToHeadRecord[]>([]);
  const [scouting, setScouting] = useState<CourseScouting | null>(null);

  useEffect(() => {
    loadActiveGame(gameId);
  }, [gameId]);

  // Fetch matchup data for Ace insights (premium only)
  useEffect(() => {
    if (!user?.id || !activeGameData || !isPremium) return;
    const opponents = activeGameData.players.filter((p) => p.user_id && p.user_id !== user.id);
    if (opponents.length === 0) return;

    Promise.all(
      opponents.map((opp) => getHeadToHeadRecord(user.id, opp.user_id!)),
    ).then((results) => {
      const valid = results.filter((r) => r.data && r.data.gamesPlayed > 0).map((r) => r.data!);
      setMatchups(valid);
    });
  }, [user?.id, activeGameData?.players.length, isPremium]);

  // Fetch course scouting data (premium only)
  useEffect(() => {
    if (!user?.id || !activeGameData?.game?.course_name || !isPremium) return;
    getCourseScouting(user.id, activeGameData.game.course_name).then((result) => {
      if (result.data) setScouting(result.data);
    });
  }, [user?.id, activeGameData?.game?.course_name, isPremium]);

  const game = activeGameData?.game;
  const players = activeGameData?.players ?? [];
  const rawSettings = game?.settings as (Record<string, any>) | undefined;
  const gameType = rawSettings?.type ?? 'nassau';
  const nassauSettings = gameType === 'nassau' ? rawSettings as (NassauSettings & { type: string }) : undefined;
  const skinsSettings = gameType === 'skins' ? rawSettings as (SkinsSettings & { type: string }) : undefined;
  const matchPlaySettings = gameType === 'match_play' ? rawSettings as (MatchPlaySettings & { type: string }) : undefined;
  const wolfSettings = gameType === 'wolf' ? rawSettings as (WolfSettings & { type: string }) : undefined;
  const isCreator = game?.created_by === user?.id;

  const handleStart = async () => {
    const result = await startActiveGame();
    if (result.error) {
      Alert.alert('Error', result.error);
      return;
    }
    hapticSuccess();
    navigation.replace('Scorecard', { gameId });
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Game',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Keep Game', style: 'cancel' },
        {
          text: 'Cancel Game',
          style: 'destructive',
          onPress: async () => {
            await cancelActiveGame();
            navigation.goBack();
          },
        },
      ],
    );
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

  const totalPot = game.total_pot;
  const numPairs = (players.length * (players.length - 1)) / 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
            Game Lobby
          </Text>
          {game.course_name && (
            <Text style={[styles.course, { color: theme.semantic.textSecondary }]}>
              {game.course_name}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <RHCard>
            <View style={styles.potRow}>
              <Text style={[styles.potLabel, { color: theme.semantic.textSecondary }]}>
                TOTAL POT
              </Text>
              <Text style={[styles.potAmount, { color: theme.colors.teal[500] }]}>
                ${totalPot}
              </Text>
            </View>

            {nassauSettings && (
              <View style={styles.betsRow}>
                <BetChip label="Front" amount={nassauSettings.front_bet} theme={theme} />
                <BetChip label="Back" amount={nassauSettings.back_bet} theme={theme} />
                <BetChip label="Overall" amount={nassauSettings.overall_bet} theme={theme} />
              </View>
            )}
            {skinsSettings && (
              <View style={styles.betsRow}>
                <BetChip label="Per Skin" amount={skinsSettings.skin_value} theme={theme} />
                <BetChip label="Holes" amount={skinsSettings.num_holes} theme={theme} />
              </View>
            )}
            {matchPlaySettings && (
              <View style={styles.betsRow}>
                <BetChip label="Match Bet" amount={matchPlaySettings.total_bet} theme={theme} />
                <BetChip label="Holes" amount={matchPlaySettings.num_holes} theme={theme} />
              </View>
            )}
            {wolfSettings && (
              <View style={styles.betsRow}>
                <BetChip label="Per Point" amount={wolfSettings.point_value} theme={theme} />
                <BetChip label="Holes" amount={wolfSettings.num_holes} theme={theme} />
              </View>
            )}

            <Text style={[styles.matchesNote, { color: theme.semantic.textSecondary }]}>
              {gameType === 'skins'
                ? `${players.length} player${players.length !== 1 ? 's' : ''} · ${rawSettings?.num_holes ?? 18} holes`
                : gameType === 'wolf'
                  ? `4-player rotating wolf · ${rawSettings?.num_holes ?? 18} holes`
                  : gameType === 'match_play'
                    ? matchPlaySettings?.match_type === 'teams'
                      ? '2v2 Best Ball · Team Match'
                      : `${numPairs} ${numPairs === 1 ? 'match' : 'matches'} (round-robin)`
                    : `${numPairs} ${numPairs === 1 ? 'match' : 'matches'} (round-robin)`}
            </Text>
          </RHCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
            PLAYERS
          </Text>

          {players.map((player) => (
            <View
              key={player.id}
              style={[styles.playerRow, { borderBottomColor: theme.semantic.border }]}
            >
              <View style={styles.playerInfo}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: theme.colors.teal[500] + '20' },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: theme.colors.teal[500] }]}>
                    {(player.guest_name ?? 'P').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.playerName, { color: theme.semantic.textPrimary }]}>
                    {formatPlayerName(player)}
                    {player.user_id === user?.id ? ' (you)' : ''}
                  </Text>
                  <Text style={[styles.playerHcp, { color: theme.semantic.textSecondary }]}>
                    HCP: {player.handicap_used ?? player.guest_handicap ?? 0}
                  </Text>
                </View>
              </View>
              <Text style={[styles.position, { color: theme.semantic.textSecondary }]}>
                #{player.position}
              </Text>
            </View>
          ))}
        </Animated.View>

        {rawSettings && (
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
              RULES
            </Text>
            <RHCard>
              <View style={styles.ruleItem}>
                <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                  Handicap
                </Text>
                <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                  {rawSettings.handicap_mode === 'none'
                    ? 'Scratch'
                    : rawSettings.handicap_mode === 'full'
                    ? 'Full (100%)'
                    : 'Partial (80%)'}
                </Text>
              </View>
              {nassauSettings && (
                <View style={styles.ruleItem}>
                  <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                    Auto-Press
                  </Text>
                  <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                    {nassauSettings.auto_press
                      ? `On${nassauSettings.press_limit > 0 ? ` (max ${nassauSettings.press_limit})` : ''}`
                      : 'Off'}
                  </Text>
                </View>
              )}
              {skinsSettings && (
                <>
                  <View style={styles.ruleItem}>
                    <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                      Carryover
                    </Text>
                    <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                      {skinsSettings.allow_carryovers ? 'On' : 'Off'}
                    </Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                      Split Final Ties
                    </Text>
                    <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                      {skinsSettings.split_final_ties ? 'On' : 'Off'}
                    </Text>
                  </View>
                </>
              )}
              {matchPlaySettings && (
                <>
                  <View style={styles.ruleItem}>
                    <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                      Format
                    </Text>
                    <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                      {matchPlaySettings.match_type === 'teams' ? 'Teams (2v2 Best Ball)' : 'Singles (Round-Robin)'}
                    </Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                      Close-Out
                    </Text>
                    <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                      When lead exceeds holes remaining
                    </Text>
                  </View>
                </>
              )}
              {wolfSettings && (
                <>
                  <View style={styles.ruleItem}>
                    <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                      Blind Wolf
                    </Text>
                    <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                      {wolfSettings.blind_wolf ? 'On (3x points)' : 'Off'}
                    </Text>
                  </View>
                  <View style={styles.ruleItem}>
                    <Text style={[styles.ruleLabel, { color: theme.semantic.textSecondary }]}>
                      Points
                    </Text>
                    <Text style={[styles.ruleValue, { color: theme.semantic.textPrimary }]}>
                      Partner 1x / Solo 2x / Blind 3x
                    </Text>
                  </View>
                </>
              )}
            </RHCard>
          </Animated.View>
        )}

        {/* Ace Course Scouting */}
        {game.course_name && (
          <Animated.View entering={FadeInDown.duration(400).delay(350)}>
            <AcePremiumGate
              onUpgrade={openPaywall}
              teaserText="See your hole-by-hole stats at this course"
            >
              {scouting && scouting.roundsPlayed > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
                    COURSE SCOUTING
                  </Text>
                  <AceInsightCard
                    variant="insight"
                    headline={`Your ${scouting.courseName} Report`}
                    body={
                      scouting.dangerHoles.length > 0
                        ? `You've played here ${scouting.roundsPlayed} time${scouting.roundsPlayed !== 1 ? 's' : ''}. Watch out for hole${scouting.dangerHoles.length > 1 ? 's' : ''} ${scouting.dangerHoles.join(', ')}.`
                        : `You've played here ${scouting.roundsPlayed} time${scouting.roundsPlayed !== 1 ? 's' : ''}. Solid play across the board.`
                    }
                    stat={scouting.averageScore.toFixed(0)}
                    statLabel="avg score"
                    supportingFacts={[
                      `Par 3: ${scouting.par3Avg.toFixed(1)}  Par 4: ${scouting.par4Avg.toFixed(1)}  Par 5: ${scouting.par5Avg.toFixed(1)}`,
                      `Front: ${scouting.frontVsBack.front}  Back: ${scouting.frontVsBack.back}`,
                      ...(scouting.opportunityHoles.length > 0
                        ? [`Best holes: ${scouting.opportunityHoles.join(', ')}`]
                        : []),
                    ]}
                  />

                  {/* Hole-by-hole grid */}
                  <View style={[scoutStyles.grid, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}>
                    <View style={scoutStyles.gridHeader}>
                      <Text style={[scoutStyles.gridHeaderText, scoutStyles.holeCol, { color: theme.semantic.textSecondary }]}>Hole</Text>
                      <Text style={[scoutStyles.gridHeaderText, scoutStyles.parCol, { color: theme.semantic.textSecondary }]}>Par</Text>
                      <Text style={[scoutStyles.gridHeaderText, scoutStyles.avgCol, { color: theme.semantic.textSecondary }]}>Avg</Text>
                    </View>
                    {scouting.holeBreakdown.map((hole) => (
                      <View
                        key={hole.holeNumber}
                        style={[
                          scoutStyles.gridRow,
                          { borderTopColor: theme.semantic.border },
                        ]}
                      >
                        <Text style={[scoutStyles.gridCell, scoutStyles.holeCol, { color: theme.semantic.textPrimary }]}>
                          {hole.holeNumber}
                        </Text>
                        <Text style={[scoutStyles.gridCell, scoutStyles.parCol, { color: theme.semantic.textSecondary }]}>
                          {hole.par}
                        </Text>
                        <Text
                          style={[
                            scoutStyles.gridCell,
                            scoutStyles.avgCol,
                            {
                              color: hole.differential < -0.1
                                ? theme.colors.green[500]
                                : hole.differential > 0.1
                                ? theme.colors.red[500]
                                : theme.semantic.textPrimary,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {hole.avgStrokes.toFixed(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </AcePremiumGate>
          </Animated.View>
        )}

        {/* Ace Matchup Insights */}
        {players.filter((p) => p.user_id && p.user_id !== user?.id).length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(400)}>
            <AcePremiumGate
              onUpgrade={openPaywall}
              teaserText="View your head-to-head record against every opponent"
            >
              {matchups.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
                    ACE INSIGHTS
                  </Text>
                  {matchups.map((record) => {
                    const isPositive = record.totalNet >= 0;
                    const body = record.gamesPlayed >= 3
                      ? `You have a ${isPositive ? 'winning' : 'losing'} record against ${record.opponentName}. ${
                          isPositive
                            ? 'Keep the pressure on.'
                            : 'Play smart — avoid early presses.'
                        }`
                      : `Limited history with ${record.opponentName}. Play your game and let the data build.`;

                    const facts: string[] = [];
                    if (record.totalNet !== 0) {
                      facts.push(`${record.totalNet >= 0 ? '+' : ''}$${Math.abs(record.totalNet).toFixed(0)} lifetime net`);
                    }
                    if (record.gamesPlayed >= 2) {
                      facts.push(`$${Math.abs(record.averageMargin).toFixed(0)} avg per game`);
                    }

                    return (
                      <View key={record.opponentUserId} style={{ marginBottom: 12 }}>
                        <AceInsightCard
                          variant="matchup"
                          headline={`vs ${record.opponentName}`}
                          body={body}
                          stat={`${record.wins}-${record.losses}`}
                          statLabel="record"
                          supportingFacts={facts}
                        />
                      </View>
                    );
                  })}
                </>
              )}
            </AcePremiumGate>
          </Animated.View>
        )}
      </ScrollView>

      {isCreator && (
        <View style={[styles.footer, { borderTopColor: theme.semantic.border }]}>
          <RHButton title="Start Round" onPress={handleStart} />
          <RHButton
            title="Cancel Game"
            variant="ghost"
            onPress={handleCancel}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function BetChip({ label, amount, theme }: { label: string; amount: number; theme: any }) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: theme.semantic.surface }]}>
      <Text style={[chipStyles.label, { color: theme.semantic.textSecondary }]}>
        {label}
      </Text>
      <Text style={[chipStyles.amount, { color: theme.semantic.textPrimary }]}>
        ${amount}
      </Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  amount: { fontSize: 17, fontWeight: '700', marginTop: 2 },
});

const scoutStyles = StyleSheet.create({
  grid: {
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
    marginTop: 12,
  },
  gridHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gridHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  gridCell: {
    fontSize: 14,
  },
  holeCol: { width: 50 },
  parCol: { width: 50, textAlign: 'center' },
  avgCol: { flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  course: { fontSize: 15, marginTop: 4 },
  potRow: { alignItems: 'center', marginBottom: 16 },
  potLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  potAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5 },
  betsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  matchesNote: { fontSize: 13, textAlign: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700' },
  playerName: { fontSize: 16, fontWeight: '600' },
  playerHcp: { fontSize: 13 },
  position: { fontSize: 14, fontWeight: '600' },
  ruleItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  ruleLabel: { fontSize: 14 },
  ruleValue: { fontSize: 14, fontWeight: '600' },
  footer: { padding: 16, gap: 8, borderTopWidth: 0.5 },
});
