import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { useFriendStore } from '../../stores/friendStore';
import { useUIStore } from '../../stores/uiStore';
import { RHButton, RHBetStatusCard, RHScoreCell, RHPressIndicator, RHPlayerCard, AceInsightCard } from '../../components';
import { HoleReactionOverlay } from '../../components/HoleReactionOverlay';
import { hapticMedium, hapticSuccess, hapticLight, hapticWarning } from '../../utils/haptics';
import { formatPlayerName, formatPlayerFirstName, formatHandicap } from '../../utils/format';
import { getReactionType } from '../../utils/reactionMessages';
import { springs } from '../../utils/animations';
import { useAcePaywall } from '../../hooks/useAcePaywall';
import { AcePremiumGate } from '../../components/AcePremiumGate';
import { getPressAnalytics } from '../../services/aceService';
import type { HomeStackScreenProps } from '../../navigation/types';
import type { NassauSettings, SkinsSettings, MatchPlaySettings, WolfSettings, NassauLiveStatus, SkinsLiveStatus, MatchPlayLiveStatus, WolfLiveStatus, GameLiveStatus, GamePlayerRow, ScoreRow, FriendWithProfile, PressAnalytics } from '../../types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ScorecardScreen({ route, navigation }: HomeStackScreenProps<'Scorecard'>) {
  const { gameId } = route.params;
  const theme = useTheme();
  const {
    activeGameData,
    gameStatus,
    isLoading,
    loadActiveGame,
    enterScore,
    completeActiveGame,
    calculateAndCreateSettlements,
    initiatePress,
    subscribeToActiveGame,
    addLatePlayer,
    submitWolfChoice,
  } = useGameStore();

  const user = useAuthStore((s) => s.user);
  const { friends, fetchFriends } = useFriendStore();
  const showToast = useUIStore((s) => s.showToast);
  const showHoleReaction = useUIStore((s) => s.showHoleReaction);
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<GamePlayerRow | null>(null);
  const [selectedHole, setSelectedHole] = useState(1);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [addPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [addingPlayerId, setAddingPlayerId] = useState<string | null>(null);
  const { isPremium, openPaywall } = useAcePaywall();
  const [pressAnalytics, setPressAnalytics] = useState<PressAnalytics | null>(null);
  const [aceDismissed, setAceDismissed] = useState(false);
  const [wolfChoiceModalVisible, setWolfChoiceModalVisible] = useState(false);

  useEffect(() => {
    if (!activeGameData || activeGameData.game.id !== gameId) {
      loadActiveGame(gameId);
    } else {
      subscribeToActiveGame();
    }
  }, [gameId]);

  // Fetch press analytics once for Ace insights (premium only)
  useEffect(() => {
    if (user?.id && isPremium) {
      getPressAnalytics(user.id).then((result) => {
        if (result.data) setPressAnalytics(result.data);
      });
    }
  }, [user?.id]);

  const game = activeGameData?.game;
  const players = activeGameData?.players ?? [];
  const scores = activeGameData?.scores ?? [];
  const rawSettings = game?.settings as (Record<string, any>) | undefined;
  const gameType = (rawSettings?.type as string) ?? 'nassau';
  const settings = rawSettings as (NassauSettings & { type: string }) | undefined;
  const skinsSettings = rawSettings as (SkinsSettings & { type: string }) | undefined;
  const matchPlaySettings = rawSettings as (MatchPlaySettings & { type: string }) | undefined;
  const wolfSettings = rawSettings as (WolfSettings & { type: string }) | undefined;
  const numHoles = (rawSettings?.num_holes ?? 18) as number;
  const holePars = (rawSettings?.hole_pars as number[] | undefined) ?? Array(numHoles).fill(4);

  const currentHole = gameStatus?.currentHole ?? 0;
  const nassauStatus = gameStatus?.type === 'nassau' ? gameStatus : null;
  const skinsStatus = gameStatus?.type === 'skins' ? gameStatus : null;
  const matchPlayStatus = gameStatus?.type === 'match_play' ? gameStatus : null;
  const wolfStatus = gameStatus?.type === 'wolf' ? gameStatus : null;

  // Match play: all matches complete means round is over (close-out possible)
  const matchPlayRoundComplete = matchPlayStatus?.isRoundComplete ?? false;
  const wolfRoundComplete = wolfStatus?.isRoundComplete ?? false;
  const allHolesScored = gameType === 'match_play'
    ? matchPlayRoundComplete
    : gameType === 'wolf'
      ? wolfRoundComplete
      : players.length > 0 && scores.length >= players.length * numHoles;

  // Wolf: auto-show wolf choice modal when it's the current user's turn to choose
  const myPlayer = players.find((p) => p.user_id === user?.id);
  const isMyWolfTurn = wolfStatus?.needsWolfChoice && wolfStatus?.currentWolfId === myPlayer?.id;

  // Wolf: auto-show choice modal when it's my turn
  useEffect(() => {
    if (isMyWolfTurn && !wolfChoiceModalVisible) {
      setWolfChoiceModalVisible(true);
    }
  }, [isMyWolfTurn]);

  // Late join: creator only, in_progress, <4 players, no hole 2 scores
  const isCreator = user?.id === game?.created_by;
  const hasHole2Scores = scores.some((s) => s.hole_number >= 2);
  const canAddPlayer =
    isCreator &&
    game?.status === 'in_progress' &&
    players.length < 4 &&
    !hasHole2Scores;

  // Friends who are not already in the game
  const eligibleFriends = friends.filter(
    (f) => !players.some((p) => p.user_id === f.userId),
  );

  const handleOpenAddPlayer = () => {
    fetchFriends();
    setAddPlayerModalVisible(true);
  };

  const handleAddPlayer = (friend: FriendWithProfile) => {
    Alert.alert(
      'Add Player',
      `Add ${friend.name} (${formatHandicap(friend.handicap)}) to this game?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            setAddingPlayerId(friend.userId);
            const result = await addLatePlayer(friend.userId, friend.handicap ?? 0);
            setAddingPlayerId(null);
            if (result.error) {
              showToast(result.error, 'error');
            } else {
              hapticSuccess();
              showToast(`${friend.name} added to the game!`, 'success');
              setAddPlayerModalVisible(false);
            }
          },
        },
      ],
    );
  };

  // Determine the earliest hole that isn't complete for ALL players (used to block future holes)
  const getFirstIncompleteHole = (): number => {
    for (let h = 1; h <= numHoles; h++) {
      const allPlayersScored = players.every((p) =>
        scores.some((s) => s.player_id === p.id && s.hole_number === h),
      );
      if (!allPlayersScored) return h;
    }
    return numHoles + 1; // All holes complete
  };
  const firstIncompleteHole = getFirstIncompleteHole();

  const getScore = (playerId: string, hole: number) => {
    const s = scores.find(
      (sc) => sc.player_id === playerId && sc.hole_number === hole,
    );
    return s?.strokes ?? null;
  };

  const openScoreEntry = (player: GamePlayerRow, hole: number) => {
    // Block scoring future holes if previous holes are incomplete
    if (hole > firstIncompleteHole) {
      showToast(`Complete hole ${firstIncompleteHole} first`, 'info');
      hapticLight();
      return;
    }
    // Block back 9 in 9-hole games
    if (numHoles === 9 && hole > 9) return;
    setSelectedPlayer(player);
    setSelectedHole(hole);
    setScoreModalVisible(true);
  };

  const handleEnterScore = async (strokes: number) => {
    if (!selectedPlayer) return;
    hapticMedium();
    setScoreModalVisible(false);
    const result = await enterScore(selectedPlayer.id, selectedHole, strokes);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      const par = holePars[selectedHole - 1];
      const reactionType = getReactionType(strokes, par);
      // Collect opponent first names (everyone except the player who scored)
      const opponentNames = players
        .filter((p) => p.id !== selectedPlayer.id)
        .map((p) => formatPlayerFirstName(p));
      showHoleReaction({
        type: reactionType,
        gameMode: gameType as 'nassau' | 'skins' | 'match_play' | 'wolf',
        playerName: formatPlayerFirstName(selectedPlayer),
        opponentNames,
        hole: selectedHole,
        score: strokes,
        par,
      });
    }
  };

  const handleEndRound = async () => {
    Alert.alert('End Round', 'Finalize scores and calculate settlements?', [
      { text: 'Keep Playing', style: 'cancel' },
      {
        text: 'End Round',
        onPress: async () => {
          const completeResult = await completeActiveGame();
          if (completeResult.error) {
            Alert.alert('Error', completeResult.error);
            return;
          }
          await calculateAndCreateSettlements();
          hapticSuccess();
          navigation.replace('Settlement', { gameId });
        },
      },
    ]);
  };

  const handleEndEarly = () => {
    if (currentHole === 0) {
      Alert.alert('No Scores', 'Enter at least one hole before ending the round.');
      return;
    }

    hapticWarning();
    Alert.alert(
      'End Early',
      `End after hole ${currentHole} of ${numHoles}?\n\nBets will settle based on current standings.`,
      [
        { text: 'Keep Playing', style: 'cancel' },
        {
          text: 'End Early',
          style: 'destructive',
          onPress: async () => {
            const completeResult = await completeActiveGame();
            if (completeResult.error) {
              Alert.alert('Error', completeResult.error);
              return;
            }
            await calculateAndCreateSettlements();
            hapticSuccess();
            navigation.replace('Settlement', { gameId });
          },
        },
      ],
    );
  };

  const handleWolfChoice = async (choiceType: 'solo' | 'partner', partnerId: string | null) => {
    if (!wolfStatus?.currentWolfId) return;
    const nextHole = wolfStatus.currentHole + 1;
    hapticMedium();
    setWolfChoiceModalVisible(false);
    const result = await submitWolfChoice(nextHole, wolfStatus.currentWolfId, choiceType, partnerId);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      const choiceLabel = choiceType === 'solo' ? 'Lone Wolf' : 'Picked a partner';
      showToast(choiceLabel, 'success');
      hapticSuccess();
    }
  };

  const dismissPress = useCallback(
    (parentBetId: string, betType: string) => {
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.add(`${parentBetId}_${betType}`);
        return next;
      });
    },
    [],
  );

  const handlePress = useCallback(
    (parentBetId: string, betType: string, playerAId: string, playerBId: string) => {
      const region = betType.includes('front') ? 'Front 9'
        : betType.includes('back') ? 'Back 9'
        : 'Overall';

      const amount = betType.includes('front') ? (settings?.front_bet ?? 0)
        : betType.includes('back') ? (settings?.back_bet ?? 0)
        : (settings?.overall_bet ?? 0);

      Alert.alert(
        'Confirm Press',
        `Start a $${amount} press on ${region}?\n\nThis doubles your bet for the remaining holes.`,
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => dismissPress(parentBetId, betType),
          },
          {
            text: 'Press',
            onPress: async () => {
              hapticMedium();
              const result = await initiatePress(parentBetId, betType, playerAId, playerBId);
              if (result.error) {
                showToast(result.error, 'error');
              } else {
                showToast(`${region} press activated!`, 'success');
                hapticSuccess();
                dismissPress(parentBetId, betType);
              }
            },
          },
        ],
      );
    },
    [initiatePress, settings, showToast, dismissPress],
  );

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
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.semantic.border }]}>
        <View style={styles.flex}>
          <Text style={[styles.headerTitle, { color: theme.semantic.textPrimary }]}>
            Scorecard
          </Text>
          <Text style={[styles.headerSub, { color: theme.semantic.textSecondary }]}>
            Hole {Math.min(currentHole + 1, numHoles)} of {numHoles}
            {game.course_name ? `  ·  ${game.course_name}` : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {canAddPlayer && (
            <Pressable onPress={handleOpenAddPlayer} hitSlop={12}>
              <Text style={[styles.addPlayerText, { color: theme.colors.teal[500] }]}>
                Add Player
              </Text>
            </Pressable>
          )}
          {!allHolesScored && currentHole > 0 && (
            <Pressable onPress={handleEndEarly} hitSlop={12}>
              <Text style={[styles.endEarlyText, { color: theme.colors.red[400] }]}>
                End Early
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Scrollable content area: ticker + bet banner + press bar + score grid */}
      <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
        {/* Hole Ticker — Nassau only */}
        {nassauStatus && currentHole > 0 && (
          <HoleTicker
            players={players}
            scores={scores}
            holePars={holePars}
            nassauStatus={nassauStatus}
            settings={settings}
            theme={theme}
          />
        )}

        {/* Skins Status Banner */}
        {skinsStatus && currentHole > 0 && (
          <SkinsStatusBanner
            skinsStatus={skinsStatus}
            players={players}
            scores={scores}
            holePars={holePars}
            numHoles={numHoles}
            skinValue={skinsSettings?.skin_value ?? 5}
            theme={theme}
          />
        )}

        {/* Match Play Status Banner */}
        {matchPlayStatus && currentHole > 0 && (
          <MatchPlayStatusBanner
            matchPlayStatus={matchPlayStatus}
            players={players}
            scores={scores}
            holePars={holePars}
            numHoles={numHoles}
            totalBet={matchPlaySettings?.total_bet ?? 10}
            theme={theme}
          />
        )}

        {/* Wolf Status Banner */}
        {wolfStatus && (
          <WolfStatusBanner
            wolfStatus={wolfStatus}
            players={players}
            scores={scores}
            holePars={holePars}
            numHoles={numHoles}
            pointValue={wolfSettings?.point_value ?? 1}
            isMyWolfTurn={!!isMyWolfTurn}
            onChoose={() => setWolfChoiceModalVisible(true)}
            theme={theme}
          />
        )}

        {/* Bet Status Banner — Nassau only */}
        {nassauStatus && nassauStatus.matches.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.betBanner}
          >
            {nassauStatus.matches.map((match, mi) => {
              const pA = players.find((p) => p.id === match.playerAId);
              const pB = players.find((p) => p.id === match.playerBId);
              const leaderNameFront = match.frontNine.leaderId
                ? formatPlayerName(
                    players.find((p) => p.id === match.frontNine.leaderId) ?? { guest_name: '?' },
                  )
                : null;
              const leaderNameBack = match.backNine.leaderId
                ? formatPlayerName(
                    players.find((p) => p.id === match.backNine.leaderId) ?? { guest_name: '?' },
                  )
                : null;
              const leaderNameOverall = match.overall.leaderId
                ? formatPlayerName(
                    players.find((p) => p.id === match.overall.leaderId) ?? { guest_name: '?' },
                  )
                : null;

              return (
                <View key={mi} style={styles.matchBetGroup}>
                  {players.length > 2 && (
                    <Text style={[styles.matchLabel, { color: theme.semantic.textSecondary }]}>
                      {formatPlayerName(pA ?? { guest_name: 'A' })} vs{' '}
                      {formatPlayerName(pB ?? { guest_name: 'B' })}
                    </Text>
                  )}
                  <View style={styles.betCardsRow}>
                    <RHBetStatusCard
                      label={numHoles === 9 ? 'Match' : 'Front 9'}
                      amount={settings?.front_bet ?? 0}
                      leaderName={leaderNameFront}
                      margin={match.frontNine.margin}
                      holesPlayed={match.frontNine.holesPlayed}
                      totalHoles={9}
                      pressCount={match.presses.filter((p) => p.betType.includes('front')).length}
                      isComplete={match.frontNine.isComplete}
                    />
                    {numHoles === 18 && (
                      <>
                        <RHBetStatusCard
                          label="Back 9"
                          amount={settings?.back_bet ?? 0}
                          leaderName={leaderNameBack}
                          margin={match.backNine.margin}
                          holesPlayed={match.backNine.holesPlayed}
                          totalHoles={9}
                          pressCount={match.presses.filter((p) => p.betType.includes('back')).length}
                          isComplete={match.backNine.isComplete}
                        />
                        <RHBetStatusCard
                          label="Overall"
                          amount={settings?.overall_bet ?? 0}
                          leaderName={leaderNameOverall}
                          margin={match.overall.margin}
                          holesPlayed={match.overall.holesPlayed}
                          totalHoles={18}
                          pressCount={match.presses.filter((p) => p.betType.includes('overall')).length}
                          isComplete={match.overall.isComplete}
                        />
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Press suggestions — Nassau only, Ace insight first, then action buttons */}
        {nassauStatus && (() => {
          const activePresses = nassauStatus.suggestedPresses.filter(
            (sp) => !pressedKeys.has(`${sp.parentBetId}_${sp.betType}`),
          );
          if (activePresses.length === 0) return null;

          // Build Ace insight data (shown BEFORE the press buttons)
          let aceCard: React.ReactNode = null;
          if (!aceDismissed && pressAnalytics && pressAnalytics.totalPresses >= 2) {
            const sp = activePresses[0];
            const margin = sp.reason;
            const region = sp.betType.includes('front') ? 'front'
              : sp.betType.includes('back') ? 'back' : 'overall';
            const regionData = pressAnalytics.winRateByRegion.find((r) => r.region === region);
            const winRate = regionData?.winRate ?? pressAnalytics.winRate;

            const facts: string[] = [];
            if (pressAnalytics.totalPresses >= 3) {
              facts.push(`${pressAnalytics.pressesWon}W-${pressAnalytics.pressesLost}L on presses overall`);
            }
            if (pressAnalytics.netFromPresses !== 0) {
              const net = pressAnalytics.netFromPresses;
              facts.push(`${net >= 0 ? '+' : ''}$${Math.abs(net).toFixed(0)} net from presses`);
            }

            const shouldPress = winRate >= 45;
            const headline = shouldPress ? 'Press here' : 'Risky press';
            const regionLabel = region === 'front' ? 'front 9'
              : region === 'back' ? 'back 9' : 'overall';
            const body = shouldPress
              ? `You're ${margin}. Your ${regionLabel} press win rate is strong — the numbers favor pressing.`
              : `You're ${margin}. Your press win rate in this region is below 45% — proceed with caution.`;

            aceCard = (
              <View style={{ marginHorizontal: 12, marginBottom: 8 }}>
                <AcePremiumGate onUpgrade={openPaywall} teaserText="Should you press? See your win rate data">
                  <AceInsightCard
                    variant="press"
                    headline={headline}
                    body={body}
                    stat={`${winRate.toFixed(0)}%`}
                    statLabel="win rate"
                    supportingFacts={facts}
                    onDismiss={() => setAceDismissed(true)}
                  />
                </AcePremiumGate>
              </View>
            );
          }

          return (
            <>
              {/* Ace Press Advisor — shows BEFORE the press buttons so you get insight first */}
              {aceCard}

              {/* Press action buttons */}
              <Animated.View
                entering={FadeInDown.springify().damping(15)}
                style={[styles.pressBar, { backgroundColor: theme.semantic.card, borderColor: theme.colors.teal[500] + '20' }]}
              >
                <View style={styles.pressBarHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={[styles.pressBarDot, { backgroundColor: theme.colors.teal[500] }]} />
                    <Text style={[styles.pressBarTitle, { color: theme.colors.teal[500] }]}>
                      PRESS AVAILABLE
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      activePresses.forEach((sp) => dismissPress(sp.parentBetId, sp.betType));
                    }}
                    hitSlop={12}
                  >
                    <Text style={[styles.pressBarDismiss, { color: theme.semantic.textSecondary }]}>
                      Dismiss
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.pressCardsColumn}>
                  {activePresses.map((sp, i) => (
                    <RHPressIndicator
                      key={i}
                      onPress={() =>
                        handlePress(sp.parentBetId, sp.betType, sp.matchPlayerAId, sp.matchPlayerBId)
                      }
                      reason={sp.reason}
                    />
                  ))}
                </View>
              </Animated.View>
            </>
          );
        })()}

        {/* Score Grid */}
        <View style={styles.scoreGridArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header row: hole numbers */}
              <View style={styles.gridRow}>
                <View style={[styles.nameCell, { borderColor: theme.semantic.border }]}>
                  <Text style={[styles.nameCellText, { color: theme.semantic.textSecondary }]}>
                    Hole
                  </Text>
                </View>
                {Array.from({ length: numHoles }, (_, i) => i + 1).map((hole) => {
                  const isLocked = hole > firstIncompleteHole;
                  return (
                  <React.Fragment key={hole}>
                    {hole === 10 && numHoles === 18 && (
                      <View style={[styles.nineDivider, { backgroundColor: theme.colors.teal[500] + '30', borderColor: theme.semantic.border }]} />
                    )}
                    <View
                      style={[
                        styles.holeHeaderCell,
                        {
                          backgroundColor:
                            hole === currentHole + 1
                              ? theme.colors.teal[500] + '15'
                              : 'transparent',
                          borderColor: theme.semantic.border,
                          opacity: isLocked ? 0.35 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.holeNum,
                          { color: hole === currentHole + 1 ? theme.colors.teal[500] : theme.semantic.textSecondary },
                        ]}
                      >
                        {hole}
                      </Text>
                      <Text style={[styles.parNum, { color: theme.semantic.textSecondary }]}>
                        P{holePars[hole - 1] ?? 4}
                      </Text>
                    </View>
                  </React.Fragment>
                  );
                })}
                <View style={[styles.totalCell, { borderColor: theme.semantic.border }]}>
                  <Text style={[styles.totalLabel, { color: theme.semantic.textSecondary }]}>
                    TOT
                  </Text>
                </View>
              </View>

              {/* Player rows */}
              {players.map((player) => {
                let total = 0;
                const playerScores = Array.from({ length: numHoles }, (_, i) => {
                  const s = getScore(player.id, i + 1);
                  if (s !== null) total += s;
                  return s;
                });

                return (
                  <View key={player.id} style={styles.gridRow}>
                    <View style={[styles.nameCell, { borderColor: theme.semantic.border }]}>
                      <Text
                        style={[styles.playerNameText, { color: theme.semantic.textPrimary }]}
                        numberOfLines={1}
                      >
                        {formatPlayerName(player)}
                      </Text>
                    </View>
                    {playerScores.map((strokes, i) => {
                      const holeNum = i + 1;
                      const isLocked = holeNum > firstIncompleteHole;
                      return (
                      <React.Fragment key={i}>
                        {i === 9 && numHoles === 18 && (
                          <View style={[styles.nineDivider, { backgroundColor: theme.colors.teal[500] + '30', borderColor: theme.semantic.border }]} />
                        )}
                        <View style={[styles.scoreCellWrapper, isLocked && { opacity: 0.35 }]}>
                          <RHScoreCell
                            strokes={strokes}
                            par={holePars[i] ?? 4}
                            isCurrentHole={holeNum === currentHole + 1 && !isLocked}
                            onPress={() => openScoreEntry(player, holeNum)}
                            size="small"
                          />
                        </View>
                      </React.Fragment>
                      );
                    })}
                    <View style={[styles.totalCell, { borderColor: theme.semantic.border }]}>
                      <Text
                        style={[
                          styles.totalValue,
                          { color: theme.semantic.textPrimary },
                        ]}
                      >
                        {total > 0 ? total : '-'}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Bet Tracker Strip — Nassau */}
              {nassauStatus && nassauStatus.matches.length > 0 && (
                <BetTrackerStrip
                  nassauStatus={nassauStatus}
                  players={players}
                  currentUserId={user?.id ?? null}
                  numHoles={numHoles}
                  theme={theme}
                />
              )}

              {/* Skins Tracker Strip */}
              {skinsStatus && (
                <SkinsTrackerStrip
                  skinsStatus={skinsStatus}
                  players={players}
                  numHoles={numHoles}
                  skinValue={skinsSettings?.skin_value ?? 5}
                  theme={theme}
                />
              )}

              {/* Match Play Tracker Strip */}
              {matchPlayStatus && (
                <MatchPlayTrackerStrip
                  matchPlayStatus={matchPlayStatus}
                  players={players}
                  currentUserId={user?.id ?? null}
                  numHoles={numHoles}
                  theme={theme}
                />
              )}

              {/* Wolf Tracker Strip */}
              {wolfStatus && (
                <WolfTrackerStrip
                  wolfStatus={wolfStatus}
                  players={players}
                  currentUserId={user?.id ?? null}
                  numHoles={numHoles}
                  theme={theme}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: theme.semantic.border }]}>
        {allHolesScored ? (
          <RHButton title="End Round" onPress={handleEndRound} />
        ) : (
          <Text style={[styles.footerHint, { color: theme.semantic.textSecondary }]}>
            Tap a cell to enter a score
          </Text>
        )}
      </View>

      {/* Score Entry Modal */}
      <Modal
        visible={scoreModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScoreModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setScoreModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.semantic.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.semantic.textPrimary }]}>
              Hole {selectedHole} · {formatPlayerName(selectedPlayer ?? { guest_name: 'Player' })}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.semantic.textSecondary }]}>
              Par {holePars[selectedHole - 1]}
            </Text>

            {/* Hole context row */}
            {selectedPlayer && (
              <View style={styles.holeContextRow}>
                <Text style={[styles.holeContextText, { color: theme.semantic.textSecondary }]}>
                  {selectedHole > 1 ? `H${selectedHole - 1}: ${getScore(selectedPlayer.id, selectedHole - 1) ?? '-'}` : ''}
                </Text>
                <Text style={[styles.holeContextCurrent, { color: theme.colors.teal[500] }]}>
                  H{selectedHole}: {getScore(selectedPlayer.id, selectedHole) ?? '—'}
                </Text>
                <Text style={[styles.holeContextText, { color: theme.semantic.textSecondary }]}>
                  {selectedHole < numHoles ? `H${selectedHole + 1}: ${getScore(selectedPlayer.id, selectedHole + 1) ?? '-'}` : ''}
                </Text>
              </View>
            )}

            <View style={styles.scoreGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                <ScoreButton
                  key={num}
                  value={num}
                  par={holePars[selectedHole - 1]}
                  onPress={() => handleEnterScore(num)}
                  theme={theme}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Player Modal */}
      <Modal
        visible={addPlayerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddPlayerModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddPlayerModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.semantic.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.semantic.textPrimary }]}>
              Add Player
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.semantic.textSecondary }]}>
              Select a friend to join this game
            </Text>

            {eligibleFriends.length === 0 ? (
              <View style={styles.emptyFriendsContainer}>
                <Text style={[styles.emptyFriendsText, { color: theme.semantic.textSecondary }]}>
                  No eligible friends to add
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.friendsList} showsVerticalScrollIndicator={false}>
                {eligibleFriends.map((friend) => (
                  <Pressable
                    key={friend.userId}
                    onPress={() => handleAddPlayer(friend)}
                    disabled={addingPlayerId === friend.userId}
                    style={styles.friendItem}
                  >
                    <RHPlayerCard
                      name={friend.name}
                      handicap={friend.handicap}
                    />
                    {addingPlayerId === friend.userId && (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.teal[500]}
                        style={styles.addingSpinner}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <RHButton
              title="Cancel"
              variant="ghost"
              onPress={() => setAddPlayerModalVisible(false)}
              style={styles.cancelButton}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Wolf Choice Modal */}
      <Modal
        visible={wolfChoiceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWolfChoiceModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setWolfChoiceModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.semantic.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.semantic.textPrimary }]}>
              You Are the Wolf
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.semantic.textSecondary }]}>
              Hole {(wolfStatus?.currentHole ?? 0) + 1} — Choose your play
            </Text>

            {/* Partner options */}
            <Text style={[wolfModalStyles.sectionLabel, { color: theme.semantic.textSecondary }]}>
              PICK A PARTNER (1x)
            </Text>
            {(wolfStatus?.availablePartners ?? []).map((partnerId) => {
              const partner = players.find((p) => p.id === partnerId);
              if (!partner) return null;
              return (
                <Pressable
                  key={partnerId}
                  onPress={() => handleWolfChoice('partner', partnerId)}
                  style={[wolfModalStyles.partnerButton, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}
                >
                  <Text style={[wolfModalStyles.partnerName, { color: theme.semantic.textPrimary }]}>
                    {formatPlayerName(partner)}
                  </Text>
                  <Text style={[wolfModalStyles.partnerHcp, { color: theme.semantic.textSecondary }]}>
                    HCP {formatHandicap(partner.handicap_used)}
                  </Text>
                </Pressable>
              );
            })}

            {/* Solo option */}
            <Text style={[wolfModalStyles.sectionLabel, { color: theme.semantic.textSecondary, marginTop: 16 }]}>
              GO SOLO
            </Text>
            <Pressable
              onPress={() => handleWolfChoice('solo', null)}
              style={[wolfModalStyles.soloButton, { backgroundColor: theme.colors.teal[500] + '15', borderColor: theme.colors.teal[500] }]}
            >
              <Text style={[wolfModalStyles.soloText, { color: theme.colors.teal[500] }]}>
                {wolfSettings?.blind_wolf ? 'Blind Wolf (3x points)' : 'Lone Wolf (2x points)'}
              </Text>
            </Pressable>

            <RHButton
              title="Cancel"
              variant="ghost"
              onPress={() => setWolfChoiceModalVisible(false)}
              style={styles.cancelButton}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Hole Reaction Overlay */}
      <HoleReactionOverlay />
    </SafeAreaView>
  );
}

function ScoreButton({
  value,
  par,
  onPress,
  theme,
}: {
  value: number;
  par: number;
  onPress: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const diff = value - par;
  let bg = theme.semantic.card;
  let color = theme.semantic.textPrimary;
  const isPar = diff === 0;

  if (diff <= -2) { bg = theme.colors.teal[500] + '20'; color = theme.colors.teal[500]; }
  else if (diff === -1) { bg = theme.colors.green[500] + '15'; color = theme.colors.green[500]; }
  else if (diff === 1) { bg = theme.colors.red[500] + '10'; color = theme.colors.red[400]; }
  else if (diff >= 2) { bg = theme.colors.red[500] + '20'; color = theme.colors.red[500]; }

  const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.9, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSequence(
          withSpring(1.1, springs.bouncy),
          withSpring(1, springs.bouncy),
        );
      }}
      onPress={onPress}
      style={[
        styles.scoreButton,
        {
          backgroundColor: bg,
          borderColor: isPar ? theme.colors.teal[500] : theme.semantic.border,
          borderWidth: isPar ? 2 : 0.5,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.scoreButtonText, { color }]}>{value}</Text>
      <Text style={[styles.scoreButtonLabel, { color: theme.semantic.textSecondary }]}>
        {diffLabel}
      </Text>
    </AnimatedPressable>
  );
}

// ─── Hole Ticker Banner ─────────────────────────────────────────

function HoleTicker({
  players,
  scores,
  holePars,
  nassauStatus,
  settings,
  theme,
}: {
  players: GamePlayerRow[];
  scores: ScoreRow[];
  holePars: number[];
  nassauStatus: NassauLiveStatus;
  settings: NassauSettings | undefined;
  theme: any;
}) {
  const numHoles = settings?.num_holes ?? 18;
  const lastHole = nassauStatus.currentHole;
  const lastPar = holePars[lastHole - 1] ?? 4;
  const nextHole = lastHole + 1;
  const nextPar = holePars[lastHole] ?? 4;
  const holesRemaining = numHoles - lastHole;
  const isRoundDone = lastHole >= numHoles;

  // Last hole scores per player
  const lastHoleScores = players.map((p) => {
    const sc = scores.find((s) => s.player_id === p.id && s.hole_number === lastHole);
    return { player: p, strokes: sc?.strokes ?? null };
  });

  // Match data — for 9-hole games, use frontNine (overall is empty)
  const match = nassauStatus.matches[0];
  const matchRegion = numHoles === 9 ? match?.frontNine : match?.overall;
  const lastHoleResult = matchRegion?.holeResults.find((hr) => hr.holeNumber === lastHole);
  const winnerId = lastHoleResult?.winnerId ?? null;
  const winnerPlayer = winnerId ? players.find((p) => p.id === winnerId) : null;

  // Match status (use frontNine for 9-hole, overall for 18-hole)
  const overallLeader = matchRegion?.leaderId
    ? players.find((p) => p.id === matchRegion.leaderId)
    : null;
  const overallMargin = matchRegion?.margin ?? 0;

  // Total at stake
  const baseBet = numHoles === 9
    ? (settings?.front_bet ?? 0)
    : (settings?.front_bet ?? 0) + (settings?.back_bet ?? 0) + (settings?.overall_bet ?? 0);
  const pressCount = match?.presses?.length ?? 0;
  const totalAtStake = baseBet * (1 + pressCount);

  function getScoreColor(strokes: number | null, par: number) {
    if (strokes === null) return theme.semantic.textSecondary;
    const diff = strokes - par;
    if (diff <= -2) return theme.colors.teal[500];
    if (diff === -1) return theme.colors.green[500];
    if (diff === 0) return theme.semantic.textSecondary;
    if (diff === 1) return theme.colors.red[400];
    return theme.colors.red[500];
  }

  function getScoreLabel(strokes: number | null, par: number): string {
    if (strokes === null) return '';
    const diff = strokes - par;
    if (diff <= -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return `+${diff}`;
  }

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(120)}
      key={`ticker-${lastHole}`}
      style={[tickerStyles.container, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}
    >
      {/* ─── Last Hole Summary ─── */}
      <View style={tickerStyles.section}>
        <View style={tickerStyles.headerRow}>
          <Text style={[tickerStyles.label, { color: theme.semantic.textSecondary }]}>
            HOLE {lastHole}
          </Text>
          <Text style={[tickerStyles.parLabel, { color: theme.semantic.textSecondary }]}>
            PAR {lastPar}
          </Text>
        </View>

        <View style={tickerStyles.scoresRow}>
          {lastHoleScores.map((ps) => {
            const color = getScoreColor(ps.strokes, lastPar);
            return (
              <View key={ps.player.id} style={tickerStyles.playerScore}>
                <Text style={[tickerStyles.playerName, { color: theme.semantic.textPrimary }]} numberOfLines={1}>
                  {formatPlayerFirstName(ps.player)}
                </Text>
                <View style={[tickerStyles.scorePill, { backgroundColor: color + '18' }]}>
                  <Text style={[tickerStyles.scoreNum, { color }]}>
                    {ps.strokes ?? '-'}
                  </Text>
                </View>
                <Text style={[tickerStyles.scoreLabel, { color }]}>
                  {getScoreLabel(ps.strokes, lastPar)}
                </Text>
              </View>
            );
          })}
        </View>

        {winnerPlayer ? (
          <Text style={[tickerStyles.winnerText, { color: theme.colors.green[500] }]}>
            {formatPlayerFirstName(winnerPlayer)} wins hole
          </Text>
        ) : lastHoleResult ? (
          <Text style={[tickerStyles.winnerText, { color: theme.semantic.textSecondary }]}>
            Halved
          </Text>
        ) : null}
      </View>

      {/* ─── Up Next ─── */}
      {!isRoundDone && (
        <>
          <View style={[tickerStyles.divider, { backgroundColor: theme.semantic.border }]} />

          <View style={tickerStyles.section}>
            <View style={tickerStyles.headerRow}>
              <Text style={[tickerStyles.label, { color: theme.colors.teal[500] }]}>
                UP NEXT
              </Text>
              <Text style={[tickerStyles.nextHoleInfo, { color: theme.semantic.textPrimary }]}>
                Hole {nextHole}  ·  Par {nextPar}
              </Text>
            </View>

            {match && (
              <Text style={[tickerStyles.matchStatus, { color: theme.semantic.textPrimary }]}>
                {overallLeader
                  ? `${formatPlayerFirstName(overallLeader)} ${overallMargin} UP`
                  : 'ALL SQUARE'}
                <Text style={{ color: theme.semantic.textSecondary }}>
                  {'  ·  '}{holesRemaining} {holesRemaining === 1 ? 'hole' : 'holes'} to play
                </Text>
              </Text>
            )}

            <Text style={[tickerStyles.moneyLine, { color: theme.colors.teal[500] }]}>
              ${totalAtStake} at stake
            </Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}

const tickerStyles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  parLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  playerScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  scorePill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: {
    fontSize: 15,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  winnerText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  nextHoleInfo: {
    fontSize: 13,
    fontWeight: '600',
  },
  matchStatus: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  moneyLine: {
    fontSize: 13,
    fontWeight: '700',
  },
});

/** Compact bet tracker strip — sits below score grid, scrolls horizontally with it */
function BetTrackerStrip({
  nassauStatus,
  players,
  currentUserId,
  numHoles,
  theme,
}: {
  nassauStatus: NassauLiveStatus;
  players: GamePlayerRow[];
  currentUserId: string | null;
  numHoles: number;
  theme: any;
}) {
  const myPlayerId = players.find((p) => p.user_id === currentUserId)?.id ?? null;

  const getRegionPill = (
    region: { leaderId: string | null; margin: number; isComplete: boolean; holesPlayed: number },
    label: string,
  ) => {
    const isAllSquare = region.leaderId === null;
    const isMyLead = region.leaderId === myPlayerId;
    const leader = players.find((p) => p.id === region.leaderId);
    const leaderInitial = leader ? formatPlayerFirstName(leader).charAt(0) : '';

    const bgColor = isAllSquare
      ? theme.semantic.border + '40'
      : isMyLead
      ? theme.colors.green[500] + '18'
      : theme.colors.red[500] + '18';

    const textColor = isAllSquare
      ? theme.semantic.textSecondary
      : isMyLead
      ? theme.colors.green[500]
      : theme.colors.red[500];

    const statusText = isAllSquare
      ? 'AS'
      : isMyLead
      ? `+${region.margin}`
      : `-${region.margin}`;

    return (
      <View key={label} style={[betStripStyles.regionPill, { backgroundColor: bgColor }]}>
        <Text style={[betStripStyles.regionLabel, { color: theme.semantic.textSecondary }]}>
          {label}
        </Text>
        <Text style={[betStripStyles.regionStatus, { color: textColor }]}>
          {isAllSquare ? statusText : `${leaderInitial} ${statusText}`}
        </Text>
        {region.isComplete && (
          <Text style={[betStripStyles.finalTag, { color: theme.semantic.textSecondary }]}>F</Text>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[betStripStyles.container, { borderTopColor: theme.semantic.border }]}
    >
      {nassauStatus.matches.map((match, i) => {
        const opponent = match.playerAId === myPlayerId
          ? players.find((p) => p.id === match.playerBId)
          : players.find((p) => p.id === match.playerAId);
        const opponentName = opponent ? formatPlayerFirstName(opponent) : 'Opp';

        const regions =
          numHoles === 9
            ? [{ region: match.frontNine, label: 'MATCH' }]
            : [
                { region: match.frontNine, label: 'F9' },
                { region: match.backNine, label: 'B9' },
                { region: match.overall, label: 'OVR' },
              ];

        return (
          <View key={i} style={betStripStyles.matchRow}>
            <View style={[betStripStyles.matchLabel, { borderRightColor: theme.semantic.border }]}>
              <Text
                style={[betStripStyles.matchLabelText, { color: theme.semantic.textSecondary }]}
                numberOfLines={1}
              >
                vs {opponentName}
              </Text>
            </View>
            <View style={betStripStyles.pillsRow}>
              {regions.map(({ region, label }) => getRegionPill(region, label))}
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
}

const betStripStyles = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
    paddingVertical: 6,
    marginTop: 2,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
  },
  matchLabel: {
    width: 72,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: 0.5,
  },
  matchLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  regionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  regionLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  regionStatus: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  finalTag: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ─── Skins Status Banner (rich ticker) ───────────────────────────

function SkinsStatusBanner({
  skinsStatus,
  players,
  scores,
  holePars,
  numHoles,
  skinValue,
  theme,
}: {
  skinsStatus: SkinsLiveStatus;
  players: GamePlayerRow[];
  scores: ScoreRow[];
  holePars: number[];
  numHoles: number;
  skinValue: number;
  theme: any;
}) {
  const lastHole = skinsStatus.currentHole;
  const lastPar = holePars[lastHole - 1] ?? 4;
  const nextHole = lastHole + 1;
  const nextPar = holePars[lastHole] ?? 4;
  const isRoundDone = lastHole >= numHoles;

  // Last hole scores per player
  const lastHoleScores = players.map((p) => {
    const sc = scores.find((s) => s.player_id === p.id && s.hole_number === lastHole);
    return { player: p, strokes: sc?.strokes ?? null };
  });

  // Last hole skin result
  const lastHoleResult = skinsStatus.holeResults.find((r) => r.holeNumber === lastHole);
  const skinWinner = lastHoleResult?.winnerId ? players.find((p) => p.id === lastHoleResult.winnerId) : null;
  const skinWorth = lastHoleResult?.skinsValue ?? 1;

  // Total pot remaining
  const totalSkins = skinsStatus.skinsPerPlayer.reduce((a, b) => a + b.skinsWon, 0);
  const skinsRemaining = skinsStatus.totalSkinsAvailable - totalSkins;
  const potRemaining = (skinsRemaining + skinsStatus.currentCarryover) * skinValue;

  function getScoreColor(strokes: number | null, par: number) {
    if (strokes === null) return theme.semantic.textSecondary;
    const diff = strokes - par;
    if (diff <= -2) return theme.colors.teal[500];
    if (diff === -1) return theme.colors.green[500];
    if (diff === 0) return theme.semantic.textSecondary;
    if (diff === 1) return theme.colors.red[400];
    return theme.colors.red[500];
  }

  function getScoreLabel(strokes: number | null, par: number): string {
    if (strokes === null) return '';
    const diff = strokes - par;
    if (diff <= -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return `+${diff}`;
  }

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(120)}
      key={`skins-ticker-${lastHole}`}
      style={[tickerStyles.container, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}
    >
      {/* ─── Last Hole Summary ─── */}
      <View style={tickerStyles.section}>
        <View style={tickerStyles.headerRow}>
          <Text style={[tickerStyles.label, { color: theme.semantic.textSecondary }]}>
            HOLE {lastHole}
          </Text>
          <Text style={[tickerStyles.parLabel, { color: theme.semantic.textSecondary }]}>
            PAR {lastPar}
          </Text>
        </View>

        <View style={tickerStyles.scoresRow}>
          {lastHoleScores.map((ps) => {
            const color = getScoreColor(ps.strokes, lastPar);
            return (
              <View key={ps.player.id} style={tickerStyles.playerScore}>
                <Text style={[tickerStyles.playerName, { color: theme.semantic.textPrimary }]} numberOfLines={1}>
                  {formatPlayerFirstName(ps.player)}
                </Text>
                <View style={[tickerStyles.scorePill, { backgroundColor: color + '18' }]}>
                  <Text style={[tickerStyles.scoreNum, { color }]}>
                    {ps.strokes ?? '-'}
                  </Text>
                </View>
                <Text style={[tickerStyles.scoreLabel, { color }]}>
                  {getScoreLabel(ps.strokes, lastPar)}
                </Text>
              </View>
            );
          })}
        </View>

        {skinWinner ? (
          <Text style={[tickerStyles.winnerText, { color: theme.colors.green[500] }]}>
            {formatPlayerFirstName(skinWinner)} wins skin{skinWorth > 1 ? ` (${skinWorth}x — $${skinWorth * skinValue})` : ` ($${skinValue})`}
          </Text>
        ) : lastHoleResult?.isTied ? (
          <Text style={[tickerStyles.winnerText, { color: theme.colors.teal[500] }]}>
            Tied — carryover to next hole
          </Text>
        ) : null}
      </View>

      {/* ─── Up Next / Standings ─── */}
      {!isRoundDone && (
        <>
          <View style={[tickerStyles.divider, { backgroundColor: theme.semantic.border }]} />

          <View style={tickerStyles.section}>
            <View style={tickerStyles.headerRow}>
              <Text style={[tickerStyles.label, { color: theme.colors.teal[500] }]}>
                UP NEXT
              </Text>
              <Text style={[tickerStyles.nextHoleInfo, { color: theme.semantic.textPrimary }]}>
                Hole {nextHole}  ·  Par {nextPar}
              </Text>
            </View>

            {skinsStatus.currentCarryover > 0 && (
              <Text style={[tickerStyles.matchStatus, { color: theme.semantic.textPrimary }]}>
                {skinsStatus.currentCarryover + 1} skins on the line
                <Text style={{ color: theme.semantic.textSecondary }}>
                  {'  ·  '}${(skinsStatus.currentCarryover + 1) * skinValue}
                </Text>
              </Text>
            )}

            <Text style={[tickerStyles.moneyLine, { color: theme.colors.teal[500] }]}>
              ${potRemaining} still in play
            </Text>
          </View>
        </>
      )}

      {/* ─── Skin Standings ─── */}
      <View style={[tickerStyles.divider, { backgroundColor: theme.semantic.border }]} />
      <View style={[tickerStyles.section, { paddingVertical: 10 }]}>
        <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
          {players.map((p) => {
            const entry = skinsStatus.skinsPerPlayer.find((sp) => sp.playerId === p.id);
            const count = entry?.skinsWon ?? 0;
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.semantic.textPrimary }} numberOfLines={1}>
                  {formatPlayerFirstName(p)}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: count > 0 ? theme.colors.green[500] : theme.semantic.textSecondary }}>
                  {count}
                </Text>
                {count > 0 && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.green[500] }}>
                    ${count * skinValue}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Skins Tracker Strip ──────────────────────────────────────────

function SkinsTrackerStrip({
  skinsStatus,
  players,
  numHoles,
  skinValue,
  theme,
}: {
  skinsStatus: SkinsLiveStatus;
  players: GamePlayerRow[];
  numHoles: number;
  skinValue: number;
  theme: any;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[skinsStripStyles.container, { borderTopColor: theme.semantic.border }]}
    >
      <View style={skinsStripStyles.headerRow}>
        <View style={[skinsStripStyles.labelCell, { borderRightColor: theme.semantic.border }]}>
          <Text style={[skinsStripStyles.labelText, { color: theme.semantic.textSecondary }]}>
            Skin
          </Text>
        </View>
        {Array.from({ length: numHoles }, (_, i) => i + 1).map((hole) => {
          const result = skinsStatus.holeResults.find((r) => r.holeNumber === hole);
          const winnerId = result?.winnerId ?? null;
          const isTied = result?.isTied ?? false;
          const winner = winnerId ? players.find((p) => p.id === winnerId) : null;

          let cellBg = 'transparent';
          let cellText = '';
          let cellColor = theme.semantic.textSecondary;

          if (!result) {
            cellText = '';
          } else if (winner) {
            cellText = formatPlayerFirstName(winner).charAt(0);
            cellBg = theme.colors.green[500] + '18';
            cellColor = theme.colors.green[500];
          } else if (isTied) {
            cellText = 'C';
            cellBg = theme.colors.teal[500] + '12';
            cellColor = theme.colors.teal[500];
          }

          const skinsWorth = result?.skinsValue ?? 1;

          return (
            <React.Fragment key={hole}>
              {hole === 10 && numHoles === 18 && (
                <View style={[styles.nineDivider, { backgroundColor: theme.colors.teal[500] + '30', borderColor: theme.semantic.border }]} />
              )}
              <View style={[skinsStripStyles.cell, { backgroundColor: cellBg }]}>
                <Text style={[skinsStripStyles.cellInitial, { color: cellColor }]}>
                  {cellText}
                </Text>
                {skinsWorth > 1 && (
                  <Text style={[skinsStripStyles.cellWorth, { color: cellColor }]}>
                    {skinsWorth}x
                  </Text>
                )}
              </View>
            </React.Fragment>
          );
        })}
        <View style={[skinsStripStyles.totalCell, { borderLeftColor: theme.semantic.border }]}>
          <Text style={[skinsStripStyles.totalText, { color: theme.semantic.textSecondary }]}>
            ${skinValue}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const skinsStripStyles = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
    paddingVertical: 4,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  labelCell: {
    width: 72,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: 0.5,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cell: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInitial: {
    fontSize: 11,
    fontWeight: '800',
  },
  cellWorth: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -2,
  },
  totalCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
  },
  totalText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

// ─── Match Play Status Banner (rich ticker) ─────────────────────

function MatchPlayStatusBanner({
  matchPlayStatus,
  players,
  scores,
  holePars,
  numHoles,
  totalBet,
  theme,
}: {
  matchPlayStatus: MatchPlayLiveStatus;
  players: GamePlayerRow[];
  scores: ScoreRow[];
  holePars: number[];
  numHoles: number;
  totalBet: number;
  theme: any;
}) {
  const lastHole = matchPlayStatus.currentHole;
  const lastPar = holePars[lastHole - 1] ?? 4;
  const nextHole = lastHole + 1;
  const nextPar = holePars[lastHole] ?? 4;
  const isRoundDone = matchPlayStatus.isRoundComplete;

  // Last hole scores per player
  const lastHoleScores = players.map((p) => {
    const sc = scores.find((s) => s.player_id === p.id && s.hole_number === lastHole);
    return { player: p, strokes: sc?.strokes ?? null };
  });

  // First match for primary status display
  const primaryMatch = matchPlayStatus.matches[0];

  function getScoreColor(strokes: number | null, par: number) {
    if (strokes === null) return theme.semantic.textSecondary;
    const diff = strokes - par;
    if (diff <= -2) return theme.colors.teal[500];
    if (diff === -1) return theme.colors.green[500];
    if (diff === 0) return theme.semantic.textSecondary;
    if (diff === 1) return theme.colors.red[400];
    return theme.colors.red[500];
  }

  function getScoreLabel(strokes: number | null, par: number): string {
    if (strokes === null) return '';
    const diff = strokes - par;
    if (diff <= -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return `+${diff}`;
  }

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(120)}
      key={`mp-ticker-${lastHole}`}
      style={[tickerStyles.container, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}
    >
      {/* ─── Last Hole Summary ─── */}
      <View style={tickerStyles.section}>
        <View style={tickerStyles.headerRow}>
          <Text style={[tickerStyles.label, { color: theme.semantic.textSecondary }]}>
            HOLE {lastHole}
          </Text>
          <Text style={[tickerStyles.parLabel, { color: theme.semantic.textSecondary }]}>
            PAR {lastPar}
          </Text>
        </View>

        <View style={tickerStyles.scoresRow}>
          {lastHoleScores.map((ps) => {
            const color = getScoreColor(ps.strokes, lastPar);
            return (
              <View key={ps.player.id} style={tickerStyles.playerScore}>
                <Text style={[tickerStyles.playerName, { color: theme.semantic.textPrimary }]} numberOfLines={1}>
                  {formatPlayerFirstName(ps.player)}
                </Text>
                <View style={[tickerStyles.scorePill, { backgroundColor: color + '18' }]}>
                  <Text style={[tickerStyles.scoreNum, { color }]}>
                    {ps.strokes ?? '-'}
                  </Text>
                </View>
                <Text style={[tickerStyles.scoreLabel, { color }]}>
                  {getScoreLabel(ps.strokes, lastPar)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Last hole result for each match */}
        {matchPlayStatus.matches.map((match, i) => {
          const lastResult = match.holeResults.find((r) => r.holeNumber === lastHole);
          const winner = lastResult?.winnerId ? players.find((p) => p.id === lastResult.winnerId) : null;
          return (
            <View key={i}>
              {matchPlayStatus.matches.length > 1 && (
                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.semantic.textSecondary, marginTop: 4 }}>
                  {formatPlayerFirstName(players.find((p) => p.id === match.playerAId) ?? ({ guest_name: 'A' } as any))} vs{' '}
                  {formatPlayerFirstName(players.find((p) => p.id === match.playerBId) ?? ({ guest_name: 'B' } as any))}
                </Text>
              )}
              {winner ? (
                <Text style={[tickerStyles.winnerText, { color: theme.colors.green[500] }]}>
                  {formatPlayerFirstName(winner)} wins hole
                </Text>
              ) : lastResult ? (
                <Text style={[tickerStyles.winnerText, { color: theme.semantic.textSecondary }]}>
                  Halved
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* ─── Up Next / Match Status ─── */}
      {!isRoundDone && (
        <>
          <View style={[tickerStyles.divider, { backgroundColor: theme.semantic.border }]} />

          <View style={tickerStyles.section}>
            <View style={tickerStyles.headerRow}>
              <Text style={[tickerStyles.label, { color: theme.colors.teal[500] }]}>
                UP NEXT
              </Text>
              <Text style={[tickerStyles.nextHoleInfo, { color: theme.semantic.textPrimary }]}>
                Hole {nextHole}  ·  Par {nextPar}
              </Text>
            </View>

            {matchPlayStatus.matches.map((match, i) => {
              const leader = match.leaderId ? players.find((p) => p.id === match.leaderId) : null;

              let statusColor = theme.semantic.textPrimary;
              if (match.isDormie) statusColor = theme.colors.red[500];

              return (
                <View key={i} style={{ marginBottom: matchPlayStatus.matches.length > 1 ? 4 : 0 }}>
                  <Text style={[tickerStyles.matchStatus, { color: statusColor }]}>
                    {match.statusText}
                    <Text style={{ color: theme.semantic.textSecondary }}>
                      {'  ·  '}{match.holesRemaining} {match.holesRemaining === 1 ? 'hole' : 'holes'} to play
                    </Text>
                  </Text>
                  {match.isDormie && !match.isComplete && (
                    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, backgroundColor: theme.colors.red[500] + '18' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, color: theme.colors.red[500] }}>
                        DORMIE
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            <Text style={[tickerStyles.moneyLine, { color: theme.colors.teal[500] }]}>
              ${totalBet * matchPlayStatus.matches.length} at stake
            </Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}

// ─── Match Play Tracker Strip ──────────────────────────────────────

function MatchPlayTrackerStrip({
  matchPlayStatus,
  players,
  currentUserId,
  numHoles,
  theme,
}: {
  matchPlayStatus: MatchPlayLiveStatus;
  players: GamePlayerRow[];
  currentUserId: string | null;
  numHoles: number;
  theme: any;
}) {
  const myPlayerId = players.find((p) => p.user_id === currentUserId)?.id ?? null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[mpStripStyles.container, { borderTopColor: theme.semantic.border }]}
    >
      {matchPlayStatus.matches.map((match, mi) => {
        const opponent = match.playerAId === myPlayerId
          ? players.find((p) => p.id === match.playerBId)
          : players.find((p) => p.id === match.playerAId);
        const opponentName = opponent ? formatPlayerFirstName(opponent) : 'Opp';

        return (
          <View key={mi} style={mpStripStyles.matchRow}>
            <View style={[mpStripStyles.matchLabel, { borderRightColor: theme.semantic.border }]}>
              <Text
                style={[mpStripStyles.matchLabelText, { color: theme.semantic.textSecondary }]}
                numberOfLines={1}
              >
                vs {opponentName}
              </Text>
            </View>
            <View style={mpStripStyles.cellsRow}>
              {Array.from({ length: numHoles }, (_, i) => i + 1).map((hole) => {
                const result = match.holeResults.find((r) => r.holeNumber === hole);
                let cellText = '';
                let cellColor = theme.semantic.textSecondary;
                let cellBg = 'transparent';

                if (result) {
                  if (result.winnerId === myPlayerId) {
                    cellText = 'W';
                    cellColor = theme.colors.green[500];
                    cellBg = theme.colors.green[500] + '18';
                  } else if (result.winnerId === null) {
                    cellText = '-';
                    cellColor = theme.semantic.textSecondary;
                    cellBg = theme.semantic.border + '30';
                  } else {
                    cellText = 'L';
                    cellColor = theme.colors.red[500];
                    cellBg = theme.colors.red[500] + '18';
                  }
                }

                return (
                  <React.Fragment key={hole}>
                    {hole === 10 && numHoles === 18 && (
                      <View style={[styles.nineDivider, { backgroundColor: theme.colors.teal[500] + '30', borderColor: theme.semantic.border }]} />
                    )}
                    <View style={[mpStripStyles.cell, { backgroundColor: cellBg }]}>
                      <Text style={[mpStripStyles.cellText, { color: cellColor }]}>
                        {cellText}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
              <View style={[mpStripStyles.totalCell, { borderLeftColor: theme.semantic.border }]}>
                <Text style={[mpStripStyles.totalText, { color: match.leaderId === myPlayerId ? theme.colors.green[500] : match.leaderId ? theme.colors.red[500] : theme.semantic.textSecondary }]}>
                  {match.leaderId === null ? 'AS' : match.leaderId === myPlayerId ? `+${match.margin}` : `-${match.margin}`}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
}

const mpStripStyles = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
    paddingVertical: 4,
    marginTop: 2,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  matchLabel: {
    width: 72,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: 0.5,
  },
  matchLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cellsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 11,
    fontWeight: '800',
  },
  totalCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
  },
  totalText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

// ─── Wolf Status Banner (rich ticker) ────────────────────────────

function WolfStatusBanner({
  wolfStatus,
  players,
  scores,
  holePars,
  numHoles,
  pointValue,
  isMyWolfTurn,
  onChoose,
  theme,
}: {
  wolfStatus: WolfLiveStatus;
  players: GamePlayerRow[];
  scores: ScoreRow[];
  holePars: number[];
  numHoles: number;
  pointValue: number;
  isMyWolfTurn: boolean;
  onChoose: () => void;
  theme: any;
}) {
  const lastHole = wolfStatus.currentHole;
  const lastPar = holePars[lastHole - 1] ?? 4;
  const nextHole = lastHole + 1;
  const nextPar = holePars[lastHole] ?? 4;
  const isRoundDone = wolfStatus.isRoundComplete;
  const wolfPlayer = players.find((p) => p.id === wolfStatus.currentWolfId);

  // Last hole scores per player
  const lastHoleScores = players.map((p) => {
    const sc = scores.find((s) => s.player_id === p.id && s.hole_number === lastHole);
    return { player: p, strokes: sc?.strokes ?? null };
  });

  // Last hole wolf result
  const lastHoleResult = wolfStatus.holeResults.find((r) => r.holeNumber === lastHole);
  const lastWolf = lastHoleResult ? players.find((p) => p.id === lastHoleResult.wolfPlayerId) : null;

  // Sort by points descending for leaderboard
  const sorted = [...wolfStatus.pointTotals].sort((a, b) => b.totalPoints - a.totalPoints);

  // Estimate total points in play
  const holesRemaining = numHoles - lastHole;

  function getScoreColor(strokes: number | null, par: number) {
    if (strokes === null) return theme.semantic.textSecondary;
    const diff = strokes - par;
    if (diff <= -2) return theme.colors.teal[500];
    if (diff === -1) return theme.colors.green[500];
    if (diff === 0) return theme.semantic.textSecondary;
    if (diff === 1) return theme.colors.red[400];
    return theme.colors.red[500];
  }

  function getScoreLabel(strokes: number | null, par: number): string {
    if (strokes === null) return '';
    const diff = strokes - par;
    if (diff <= -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return `+${diff}`;
  }

  const choiceLabel = lastHoleResult?.choiceType === 'blind' ? 'Blind Wolf'
    : lastHoleResult?.choiceType === 'solo' ? 'Lone Wolf'
    : lastHoleResult?.partnerId ? `w/ ${formatPlayerFirstName(players.find((p) => p.id === lastHoleResult.partnerId) ?? ({ guest_name: '?' } as any))}`
    : '';

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(120)}
      key={`wolf-ticker-${lastHole}`}
      style={[tickerStyles.container, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}
    >
      {/* ─── Last Hole Summary ─── */}
      {lastHole > 0 && (
        <View style={tickerStyles.section}>
          <View style={tickerStyles.headerRow}>
            <Text style={[tickerStyles.label, { color: theme.semantic.textSecondary }]}>
              HOLE {lastHole}
            </Text>
            <Text style={[tickerStyles.parLabel, { color: theme.semantic.textSecondary }]}>
              PAR {lastPar}
            </Text>
          </View>

          <View style={tickerStyles.scoresRow}>
            {lastHoleScores.map((ps) => {
              const color = getScoreColor(ps.strokes, lastPar);
              return (
                <View key={ps.player.id} style={tickerStyles.playerScore}>
                  <Text style={[tickerStyles.playerName, { color: theme.semantic.textPrimary }]} numberOfLines={1}>
                    {formatPlayerFirstName(ps.player)}
                  </Text>
                  <View style={[tickerStyles.scorePill, { backgroundColor: color + '18' }]}>
                    <Text style={[tickerStyles.scoreNum, { color }]}>
                      {ps.strokes ?? '-'}
                    </Text>
                  </View>
                  <Text style={[tickerStyles.scoreLabel, { color }]}>
                    {getScoreLabel(ps.strokes, lastPar)}
                  </Text>
                </View>
              );
            })}
          </View>

          {lastWolf && lastHoleResult && (
            <Text style={[tickerStyles.winnerText, {
              color: lastHoleResult.winningTeam === 'wolf' ? theme.colors.green[500]
                : lastHoleResult.winningTeam === 'field' ? theme.colors.red[400]
                : theme.semantic.textSecondary,
            }]}>
              {formatPlayerFirstName(lastWolf)} ({choiceLabel}) —{' '}
              {lastHoleResult.winningTeam === 'wolf' ? 'Wolf wins'
                : lastHoleResult.winningTeam === 'field' ? 'Pack wins'
                : 'Push'}
              {lastHoleResult.multiplier > 1 ? ` (${lastHoleResult.multiplier}x)` : ''}
            </Text>
          )}
        </View>
      )}

      {/* ─── Up Next / Wolf Indicator ─── */}
      {!isRoundDone && (
        <>
          {lastHole > 0 && <View style={[tickerStyles.divider, { backgroundColor: theme.semantic.border }]} />}

          <View style={tickerStyles.section}>
            <View style={tickerStyles.headerRow}>
              <Text style={[tickerStyles.label, { color: theme.colors.teal[500] }]}>
                {lastHole > 0 ? 'UP NEXT' : 'WOLF'}
              </Text>
              <Text style={[tickerStyles.nextHoleInfo, { color: theme.semantic.textPrimary }]}>
                Hole {nextHole}  ·  Par {nextPar}
              </Text>
            </View>

            {wolfPlayer && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[tickerStyles.matchStatus, { color: theme.semantic.textPrimary }]}>
                  {formatPlayerFirstName(wolfPlayer)} is Wolf
                  <Text style={{ color: theme.semantic.textSecondary }}>
                    {'  ·  '}{holesRemaining} {holesRemaining === 1 ? 'hole' : 'holes'} to play
                  </Text>
                </Text>
                {isMyWolfTurn && (
                  <Pressable
                    onPress={onChoose}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.teal[500] }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Choose</Text>
                  </Pressable>
                )}
              </View>
            )}

            <Text style={[tickerStyles.moneyLine, { color: theme.colors.teal[500] }]}>
              ${pointValue} per point
            </Text>
          </View>
        </>
      )}

      {/* ─── Point Standings ─── */}
      <View style={[tickerStyles.divider, { backgroundColor: theme.semantic.border }]} />
      <View style={[tickerStyles.section, { paddingVertical: 10 }]}>
        <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
          {sorted.map((pt) => {
            const p = players.find((pl) => pl.id === pt.playerId);
            const isPositive = pt.totalPoints > 0;
            const isNeg = pt.totalPoints < 0;
            return (
              <View key={pt.playerId} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.semantic.textPrimary }} numberOfLines={1}>
                  {formatPlayerFirstName(p ?? ({ guest_name: '?' } as any))}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: isPositive ? theme.colors.green[500] : isNeg ? theme.colors.red[500] : theme.semantic.textSecondary }}>
                  {pt.totalPoints > 0 ? `+${pt.totalPoints}` : pt.totalPoints}
                </Text>
                {pt.totalPoints !== 0 && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isPositive ? theme.colors.green[500] : theme.colors.red[500] }}>
                    {isPositive ? '+' : '-'}${Math.abs(pt.totalPoints * pointValue)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Wolf Tracker Strip ──────────────────────────────────────────

function WolfTrackerStrip({
  wolfStatus,
  players,
  currentUserId,
  numHoles,
  theme,
}: {
  wolfStatus: WolfLiveStatus;
  players: GamePlayerRow[];
  currentUserId: string | null;
  numHoles: number;
  theme: any;
}) {
  const myPlayerId = players.find((p) => p.user_id === currentUserId)?.id ?? null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[wolfStripStyles.container, { borderTopColor: theme.semantic.border }]}
    >
      {/* Wolf indicator row — shows who was wolf and their choice */}
      <View style={wolfStripStyles.trackerRow}>
        <View style={[wolfStripStyles.labelCell, { borderRightColor: theme.semantic.border }]}>
          <Text style={[wolfStripStyles.labelText, { color: theme.semantic.textSecondary }]}>
            Wolf
          </Text>
        </View>
        {Array.from({ length: numHoles }, (_, i) => i + 1).map((hole) => {
          const result = wolfStatus.holeResults.find((r) => r.holeNumber === hole);
          let cellText = '';
          let cellColor = theme.semantic.textSecondary;
          let cellBg = 'transparent';

          if (result) {
            const wolf = players.find((p) => p.id === result.wolfPlayerId);
            cellText = wolf ? formatPlayerFirstName(wolf).charAt(0) : '?';

            if (result.choiceType === 'blind') {
              cellBg = theme.colors.teal[500] + '20';
              cellColor = theme.colors.teal[500];
            } else if (result.choiceType === 'solo') {
              cellBg = theme.colors.red[500] + '12';
              cellColor = theme.colors.red[400];
            } else {
              cellBg = theme.semantic.border + '30';
            }
          }

          return (
            <React.Fragment key={hole}>
              {hole === 10 && numHoles === 18 && (
                <View style={[styles.nineDivider, { backgroundColor: theme.colors.teal[500] + '30', borderColor: theme.semantic.border }]} />
              )}
              <View style={[wolfStripStyles.cell, { backgroundColor: cellBg }]}>
                <Text style={[wolfStripStyles.cellText, { color: cellColor }]}>
                  {cellText}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
        <View style={[wolfStripStyles.totalCell, { borderLeftColor: theme.semantic.border }]}>
          <Text style={[wolfStripStyles.totalText, { color: theme.semantic.textSecondary }]}>
            PTS
          </Text>
        </View>
      </View>

      {/* My points row */}
      <View style={wolfStripStyles.trackerRow}>
        <View style={[wolfStripStyles.labelCell, { borderRightColor: theme.semantic.border }]}>
          <Text style={[wolfStripStyles.labelText, { color: theme.semantic.textSecondary }]}>
            You
          </Text>
        </View>
        {Array.from({ length: numHoles }, (_, i) => i + 1).map((hole) => {
          const result = wolfStatus.holeResults.find((r) => r.holeNumber === hole);
          let cellText = '';
          let cellColor = theme.semantic.textSecondary;
          let cellBg = 'transparent';

          if (result && myPlayerId) {
            const myPts = result.pointsPerPlayer.find((pp) => pp.playerId === myPlayerId);
            const pts = myPts?.points ?? 0;
            if (pts > 0) {
              cellText = `+${pts}`;
              cellColor = theme.colors.green[500];
              cellBg = theme.colors.green[500] + '18';
            } else if (pts < 0) {
              cellText = `${pts}`;
              cellColor = theme.colors.red[500];
              cellBg = theme.colors.red[500] + '18';
            } else {
              cellText = '0';
              cellBg = theme.semantic.border + '20';
            }
          }

          return (
            <React.Fragment key={hole}>
              {hole === 10 && numHoles === 18 && (
                <View style={[styles.nineDivider, { backgroundColor: theme.colors.teal[500] + '30', borderColor: theme.semantic.border }]} />
              )}
              <View style={[wolfStripStyles.cell, { backgroundColor: cellBg }]}>
                <Text style={[wolfStripStyles.cellText, { color: cellColor }]}>
                  {cellText}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
        <View style={[wolfStripStyles.totalCell, { borderLeftColor: theme.semantic.border }]}>
          {(() => {
            const myTotal = wolfStatus.pointTotals.find((pt) => pt.playerId === myPlayerId);
            const total = myTotal?.totalPoints ?? 0;
            return (
              <Text style={[wolfStripStyles.totalText, {
                color: total > 0 ? theme.colors.green[500] : total < 0 ? theme.colors.red[500] : theme.semantic.textSecondary,
              }]}>
                {total > 0 ? `+${total}` : total}
              </Text>
            );
          })()}
        </View>
      </View>
    </Animated.View>
  );
}

const wolfStripStyles = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
    paddingVertical: 4,
    marginTop: 2,
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  labelCell: {
    width: 72,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: 0.5,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cell: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 10,
    fontWeight: '800',
  },
  totalCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
  },
  totalText: {
    fontSize: 11,
    fontWeight: '800',
  },
});

// ─── Wolf Choice Modal Styles ──────────────────────────────────

const wolfModalStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  partnerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 0.5,
    marginBottom: 8,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  partnerHcp: {
    fontSize: 13,
    fontWeight: '500',
  },
  soloButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  soloText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scoreGridArea: { paddingBottom: 8 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  addPlayerText: { fontSize: 13, fontWeight: '600' },
  endEarlyText: { fontSize: 13, fontWeight: '600' },

  // Bet banner
  betBanner: { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  matchBetGroup: { gap: 6 },
  matchLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  betCardsRow: { flexDirection: 'row', gap: 8 },

  // Press bar
  pressBar: { paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16, marginHorizontal: 12, marginVertical: 8, borderWidth: 1 },
  pressBarHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  pressBarDot: { width: 6, height: 6, borderRadius: 3 },
  pressBarTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
  pressBarDismiss: { fontSize: 13, fontWeight: '600' },
  pressCardsColumn: { gap: 10 },

  // Score grid
  gridRow: { flexDirection: 'row' },
  nameCell: {
    width: 72,
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: 'center',
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  nameCellText: { fontSize: 10, fontWeight: '600' },
  playerNameText: { fontSize: 12, fontWeight: '600' },
  holeHeaderCell: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  holeNum: { fontSize: 11, fontWeight: '700' },
  parNum: { fontSize: 9 },
  scoreCellWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nineDivider: {
    width: 3,
    borderBottomWidth: 0.5,
  },
  totalCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderLeftWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  totalLabel: { fontSize: 10, fontWeight: '700' },
  totalValue: { fontSize: 14, fontWeight: '800' },

  // Footer
  footer: { padding: 16, borderTopWidth: 0.5, alignItems: 'center' },
  footerHint: { fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalSubtitle: { fontSize: 15, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  holeContextRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  holeContextText: { fontSize: 13, fontWeight: '500' },
  holeContextCurrent: { fontSize: 14, fontWeight: '700' },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  scoreButton: {
    width: 68,
    height: 68,
    borderRadius: 14,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreButtonText: { fontSize: 22, fontWeight: '700' },
  scoreButtonLabel: { fontSize: 10, fontWeight: '500', marginTop: -2 },

  // Add Player modal
  emptyFriendsContainer: { paddingVertical: 32, alignItems: 'center' },
  emptyFriendsText: { fontSize: 15 },
  friendsList: { maxHeight: 300, marginTop: 12 },
  friendItem: { position: 'relative', marginBottom: 8 },
  addingSpinner: { position: 'absolute', right: 16, top: '50%', marginTop: -10 },
  cancelButton: { marginTop: 12 },
});
