import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { useFriendStore } from '../../stores/friendStore';
import {
  RHButton,
  RHCard,
  RHInput,
  RHPlayerCard,
  RHStepIndicator,
  RHNumberStepper,
  EmptyState,
} from '../../components';
import { hapticLight, hapticMedium, hapticSuccess } from '../../utils/haptics';
import { formatHandicap } from '../../utils/format';
import { springs } from '../../utils/animations';
import { searchCourses, getCourseWithHoles, saveOrUpdateCourse, linkGameToCourse } from '../../services/courseService';
import type { NewGameStackScreenProps } from '../../navigation/types';
import type { NassauSettings, FriendWithProfile, CourseRow } from '../../types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const STEP_LABELS = ['Game Type', 'Players', 'Stakes', 'Rules', 'Confirm'];
const DEFAULT_PARS_18 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
const DEFAULT_PARS_9 = [4, 4, 4, 4, 4, 4, 4, 4, 4];

export function CreateGameScreen({ navigation }: NewGameStackScreenProps<'CreateGame'>) {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const createGame = useGameStore((s) => s.createGame);
  const { friends, isLoading: friendsLoading, fetchFriends } = useFriendStore();

  const [step, setStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Step 1: Game type (only Nassau for now)
  const [gameType] = useState<'nassau'>('nassau');

  // Step 2: Players (friend-based)
  const [selectedFriends, setSelectedFriends] = useState<FriendWithProfile[]>([]);

  useEffect(() => {
    fetchFriends();
  }, []);

  const availableFriends = friends.filter(
    (f) => !selectedFriends.some((sf) => sf.userId === f.userId),
  );

  const selectFriend = (friend: FriendWithProfile) => {
    if (selectedFriends.length >= 3) return; // Max 4 total (1 creator + 3 friends)
    hapticMedium();
    setSelectedFriends([...selectedFriends, friend]);
  };

  const deselectFriend = (userId: string) => {
    hapticLight();
    setSelectedFriends(selectedFriends.filter((f) => f.userId !== userId));
  };

  // Step 3: Stakes
  const [numHoles, setNumHoles] = useState<9 | 18>(18);
  const [frontBet, setFrontBet] = useState(5);
  const [backBet, setBackBet] = useState(5);
  const [overallBet, setOverallBet] = useState(5);
  const [courseName, setCourseName] = useState('');
  const [holePars, setHolePars] = useState<number[]>([...DEFAULT_PARS_18]);
  const [courseSuggestions, setCourseSuggestions] = useState<CourseRow[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseSearchTimer, setCourseSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleCourseNameChange = (text: string) => {
    setCourseName(text);
    setSelectedCourseId(null); // Clear selection when typing

    // Debounced search
    if (courseSearchTimer) clearTimeout(courseSearchTimer);
    if (text.trim().length >= 2) {
      const timer = setTimeout(async () => {
        const result = await searchCourses(text.trim());
        if (result.data) setCourseSuggestions(result.data);
      }, 300);
      setCourseSearchTimer(timer);
    } else {
      setCourseSuggestions([]);
    }
  };

  const handleSelectCourse = async (course: CourseRow) => {
    hapticMedium();
    setCourseName(course.name);
    setSelectedCourseId(course.id);
    setCourseSuggestions([]);

    // Load hole pars from the saved course
    const result = await getCourseWithHoles(course.id);
    if (result.data && result.data.holes.length > 0) {
      const savedPars = result.data.holes
        .sort((a, b) => a.hole_number - b.hole_number)
        .map((h) => h.par);

      // Match to current numHoles selection
      if (numHoles === 9) {
        setHolePars(savedPars.slice(0, 9));
      } else if (savedPars.length >= 18) {
        setHolePars(savedPars.slice(0, 18));
      } else {
        // Course has fewer holes than expected — pad with 4s
        const padded = [...savedPars, ...Array(numHoles - savedPars.length).fill(4)];
        setHolePars(padded.slice(0, numHoles));
      }
    }
  };

  const handleNumHolesChange = (holes: 9 | 18) => {
    hapticMedium();
    setNumHoles(holes);
    if (holes === 9) {
      setBackBet(0);
      setOverallBet(0);
      setHolePars((prev) => prev.slice(0, 9));
    } else {
      setBackBet(frontBet);
      setOverallBet(frontBet);
      setHolePars((prev) => prev.length < 18
        ? [...prev, ...Array(18 - prev.length).fill(4)]
        : prev,
      );
    }
  };

  // Step 4: Rules
  const [autoPress, setAutoPress] = useState(true);
  const [pressLimit, setPressLimit] = useState(0); // 0 = unlimited
  const [handicapMode, setHandicapMode] = useState<'none' | 'full' | 'partial'>('full');

  const totalPlayers = 1 + selectedFriends.length;

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0: return true; // Game type selected
      case 1: return selectedFriends.length >= 1; // Need at least 1 friend (2 total)
      case 2: return frontBet > 0 || (numHoles === 18 && (backBet > 0 || overallBet > 0));
      case 3: return true; // Rules always valid
      case 4: return true; // Confirm
      default: return false;
    }
  }, [step, selectedFriends.length, frontBet, backBet, overallBet, numHoles]);

  const cyclePar = (holeIndex: number) => {
    hapticLight();
    const newPars = [...holePars];
    const current = newPars[holeIndex];
    newPars[holeIndex] = current === 5 ? 3 : current + 1;
    setHolePars(newPars);
  };

  const handleCreate = async () => {
    if (!user) return;
    setIsCreating(true);

    const settings: NassauSettings = {
      num_holes: numHoles,
      auto_press: autoPress,
      press_limit: pressLimit,
      handicap_mode: handicapMode,
      front_bet: frontBet,
      back_bet: numHoles === 9 ? 0 : backBet,
      overall_bet: numHoles === 9 ? 0 : overallBet,
      hole_pars: holePars,
    };

    const playerInputs = [
      // Creator is always player 1
      {
        user_id: user.id,
        guest_name: null,
        handicap_used: user.handicap ?? 0,
        position: 1,
      },
      // Selected friends
      ...selectedFriends.map((friend, i) => ({
        user_id: friend.userId,
        guest_name: null,
        handicap_used: friend.handicap ?? 0,
        position: i + 2,
      })),
    ];

    const result = await createGame(user.id, courseName || 'Unknown Course', settings, playerInputs);

    setIsCreating(false);

    if (result.error) {
      Alert.alert('Error', result.error);
      return;
    }

    hapticSuccess();

    // Auto-save course data for future games (fire-and-forget)
    if (courseName.trim() && courseName.trim() !== 'Unknown Course' && result.gameId) {
      saveOrUpdateCourse(courseName.trim(), holePars, user.id).then((courseResult) => {
        if (courseResult.courseId && result.gameId) {
          linkGameToCourse(result.gameId, courseResult.courseId);
        }
      });
    }

    // Reset form so returning to this tab shows a fresh screen
    setStep(0);
    setSelectedFriends([]);
    setNumHoles(18);
    setFrontBet(5);
    setBackBet(5);
    setOverallBet(5);
    setCourseName('');
    setHolePars([...DEFAULT_PARS_18]);
    setCourseSuggestions([]);
    setSelectedCourseId(null);
    setAutoPress(true);
    setPressLimit(0);
    setHandicapMode('full');

    if (result.gameId) {
      navigation.navigate('GameLobby', { gameId: result.gameId });
    }
  };

  const totalPot = (() => {
    const numPairs = (totalPlayers * (totalPlayers - 1)) / 2;
    if (numHoles === 9) return numPairs * frontBet;
    return numPairs * (frontBet + backBet + overallBet);
  })();

  // ─── Step Renderers ─────────────────────────────────────────

  const renderStep0 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.semantic.textPrimary }]}>
        Choose Game Type
      </Text>

      <GameTypeCard
        title="Nassau"
        description="The classic. Play 9 or 18 holes with match play bets."
        isSelected={gameType === 'nassau'}
        onPress={() => hapticLight()}
        theme={theme}
      />

      {['Skins', 'Wolf', 'Match Play'].map((type) => (
        <GameTypeCard
          key={type}
          title={type}
          description="Coming soon"
          isSelected={false}
          onPress={() => {}}
          disabled
          theme={theme}
        />
      ))}
    </Animated.View>
  );

  const renderStep1 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.semantic.textPrimary }]}>
        Select Players
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.semantic.textSecondary }]}>
        {totalPlayers} of 4 players (min 2)
      </Text>

      {/* Creator (always shown, non-removable) */}
      <RHPlayerCard
        name={user?.name ?? 'You'}
        handicap={user?.handicap}
        isCreator
      />

      {/* Selected friends */}
      {selectedFriends.map((friend) => (
        <RHPlayerCard
          key={friend.userId}
          name={friend.name}
          handicap={friend.handicap}
          onRemove={() => deselectFriend(friend.userId)}
        />
      ))}

      {/* Available friends to select */}
      {selectedFriends.length < 3 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
            SELECT FROM FRIENDS
          </Text>

          {friendsLoading ? (
            <View style={styles.friendsLoading}>
              <ActivityIndicator size="small" color={theme.colors.teal[500]} />
            </View>
          ) : availableFriends.length > 0 ? (
            availableFriends.map((friend) => (
              <RHPlayerCard
                key={friend.userId}
                name={friend.name}
                handicap={friend.handicap}
                onPress={() => selectFriend(friend)}
              />
            ))
          ) : friends.length === 0 ? (
            <EmptyState
              title="No Friends Yet"
              description="Add friends from your profile to start a game."
              actionTitle="Add Friends"
              onAction={() => {
                navigation.navigate('FriendsList' as any);
              }}
            />
          ) : (
            <Text style={[styles.allSelected, { color: theme.semantic.textSecondary }]}>
              All friends selected
            </Text>
          )}
        </>
      )}
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.semantic.textPrimary }]}>
        Set Stakes
      </Text>

      <View>
        <RHInput
          placeholder="Course name (optional)"
          value={courseName}
          onChangeText={handleCourseNameChange}
        />
        {courseSuggestions.length > 0 && !selectedCourseId && (
          <View style={[styles.courseDropdown, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}>
            {courseSuggestions.map((course) => (
              <Pressable
                key={course.id}
                onPress={() => handleSelectCourse(course)}
                style={[styles.courseDropdownItem, { borderBottomColor: theme.semantic.border }]}
              >
                <Text style={[styles.courseDropdownName, { color: theme.semantic.textPrimary }]}>
                  {course.name}
                </Text>
                <Text style={[styles.courseDropdownMeta, { color: theme.colors.teal[500] }]}>
                  {course.num_holes} holes · Pars saved
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {selectedCourseId && (
          <Text style={[styles.courseLinked, { color: theme.colors.teal[500] }]}>
            Pars loaded from saved course
          </Text>
        )}
      </View>

      {/* 9/18 Hole Toggle */}
      <View style={[styles.holeToggleContainer, { backgroundColor: theme.semantic.card, borderColor: theme.semantic.border }]}>
        <Pressable
          onPress={() => handleNumHolesChange(9)}
          style={[
            styles.holeToggleOption,
            numHoles === 9 && { backgroundColor: theme.colors.teal[500] },
          ]}
        >
          <Text style={[
            styles.holeToggleText,
            { color: numHoles === 9 ? '#FFFFFF' : theme.semantic.textSecondary },
          ]}>
            9 Holes
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleNumHolesChange(18)}
          style={[
            styles.holeToggleOption,
            numHoles === 18 && { backgroundColor: theme.colors.teal[500] },
          ]}
        >
          <Text style={[
            styles.holeToggleText,
            { color: numHoles === 18 ? '#FFFFFF' : theme.semantic.textSecondary },
          ]}>
            18 Holes
          </Text>
        </Pressable>
      </View>

      <View style={styles.stakesSection}>
        <RHNumberStepper
          label={numHoles === 9 ? 'Bet per Match' : 'Front 9'}
          value={frontBet}
          onChange={setFrontBet}
          presets={[2, 5, 10, 20]}
        />
        <View style={{ opacity: numHoles === 9 ? 0.3 : 1 }} pointerEvents={numHoles === 9 ? 'none' : 'auto'}>
          <RHNumberStepper
            label="Back 9"
            value={backBet}
            onChange={setBackBet}
            presets={[2, 5, 10, 20]}
          />
        </View>
        <View style={{ opacity: numHoles === 9 ? 0.3 : 1 }} pointerEvents={numHoles === 9 ? 'none' : 'auto'}>
          <RHNumberStepper
            label="Overall 18"
            value={overallBet}
            onChange={setOverallBet}
            presets={[2, 5, 10, 20]}
          />
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
        HOLE PARS (TAP TO CHANGE)
      </Text>
      <View style={styles.parsGrid}>
        {holePars.map((par, i) => (
          <ParCell
            key={i}
            holeNumber={i + 1}
            par={par}
            onPress={() => cyclePar(i)}
            theme={theme}
          />
        ))}
      </View>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.semantic.textPrimary }]}>
        Game Rules
      </Text>

      <View style={styles.ruleRow}>
        <View>
          <Text style={[styles.ruleLabel, { color: theme.semantic.textPrimary }]}>
            Auto-Press
          </Text>
          <Text style={[styles.ruleDesc, { color: theme.semantic.textSecondary }]}>
            Suggest press when 2+ down
          </Text>
        </View>
        <ToggleButton
          isOn={autoPress}
          onToggle={() => { hapticLight(); setAutoPress(!autoPress); }}
          theme={theme}
        />
      </View>

      {autoPress && (
        <View style={styles.ruleRow}>
          <View>
            <Text style={[styles.ruleLabel, { color: theme.semantic.textPrimary }]}>
              Press Limit
            </Text>
            <Text style={[styles.ruleDesc, { color: theme.semantic.textSecondary }]}>
              Max presses per bet (0 = unlimited)
            </Text>
          </View>
          <View style={styles.limitRow}>
            {[0, 1, 2, 3].map((val) => (
              <Pressable
                key={val}
                onPress={() => { hapticLight(); setPressLimit(val); }}
                style={[
                  styles.limitChip,
                  {
                    backgroundColor: pressLimit === val
                      ? theme.colors.teal[500]
                      : theme.semantic.card,
                    borderColor: pressLimit === val
                      ? theme.colors.teal[500]
                      : theme.semantic.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: pressLimit === val ? '#FFF' : theme.semantic.textPrimary,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  {val === 0 ? 'No limit' : `${val}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.ruleRow}>
        <View>
          <Text style={[styles.ruleLabel, { color: theme.semantic.textPrimary }]}>
            Handicap Mode
          </Text>
          <Text style={[styles.ruleDesc, { color: theme.semantic.textSecondary }]}>
            How strokes are allocated
          </Text>
        </View>
      </View>
      <View style={styles.segmentRow}>
        {(['none', 'full', 'partial'] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => { hapticLight(); setHandicapMode(mode); }}
            style={[
              styles.segment,
              {
                backgroundColor: handicapMode === mode
                  ? theme.colors.teal[500]
                  : theme.semantic.card,
                borderColor: handicapMode === mode
                  ? theme.colors.teal[500]
                  : theme.semantic.border,
              },
            ]}
          >
            <Text
              style={{
                color: handicapMode === mode ? '#FFF' : theme.semantic.textPrimary,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {mode === 'none' ? 'Scratch' : mode === 'full' ? 'Full (100%)' : 'Partial (80%)'}
            </Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  const renderStep4 = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.semantic.textPrimary }]}>
        Confirm Game
      </Text>

      <RHCard>
        <View style={styles.confirmSection}>
          <Text style={[styles.confirmLabel, { color: theme.semantic.textSecondary }]}>
            GAME TYPE
          </Text>
          <Text style={[styles.confirmValue, { color: theme.semantic.textPrimary }]}>
            Nassau
          </Text>
        </View>

        <View style={styles.confirmSection}>
          <Text style={[styles.confirmLabel, { color: theme.semantic.textSecondary }]}>
            PLAYERS
          </Text>
          <Text style={[styles.confirmValue, { color: theme.semantic.textPrimary }]}>
            {user?.name} (HCP: {formatHandicap(user?.handicap ?? null)})
          </Text>
          {selectedFriends.map((friend) => (
            <Text
              key={friend.userId}
              style={[styles.confirmValue, { color: theme.semantic.textPrimary }]}
            >
              {friend.name} (HCP: {formatHandicap(friend.handicap)})
            </Text>
          ))}
        </View>

        <View style={styles.confirmSection}>
          <Text style={[styles.confirmLabel, { color: theme.semantic.textSecondary }]}>
            STAKES ({numHoles} HOLES)
          </Text>
          <Text style={[styles.confirmValue, { color: theme.semantic.textPrimary }]}>
            {numHoles === 9
              ? `$${frontBet} per match`
              : `Front: $${frontBet} / Back: $${backBet} / Overall: $${overallBet}`}
          </Text>
        </View>

        <View style={styles.confirmSection}>
          <Text style={[styles.confirmLabel, { color: theme.semantic.textSecondary }]}>
            TOTAL POT
          </Text>
          <Text
            style={[
              styles.totalPot,
              { color: theme.colors.teal[500] },
            ]}
          >
            ${totalPot}
          </Text>
        </View>

        <View style={styles.confirmSection}>
          <Text style={[styles.confirmLabel, { color: theme.semantic.textSecondary }]}>
            RULES
          </Text>
          <Text style={[styles.confirmValue, { color: theme.semantic.textPrimary }]}>
            Handicap: {handicapMode === 'none' ? 'Scratch' : handicapMode === 'full' ? 'Full' : 'Partial (80%)'}
          </Text>
          <Text style={[styles.confirmValue, { color: theme.semantic.textPrimary }]}>
            Auto-press: {autoPress ? `On${pressLimit > 0 ? ` (max ${pressLimit})` : ''}` : 'Off'}
          </Text>
        </View>

        {courseName ? (
          <View style={styles.confirmSection}>
            <Text style={[styles.confirmLabel, { color: theme.semantic.textSecondary }]}>
              COURSE
            </Text>
            <Text style={[styles.confirmValue, { color: theme.semantic.textPrimary }]}>
              {courseName}
            </Text>
          </View>
        ) : null}
      </RHCard>
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          {step > 0 ? (
            <Pressable
              onPress={() => { hapticLight(); setStep(step - 1); }}
              style={styles.backButton}
            >
              <Text style={[styles.backText, { color: theme.colors.teal[500] }]}>
                Back
              </Text>
            </Pressable>
          ) : (
            <View style={styles.backButton} />
          )}

          <RHStepIndicator
            currentStep={step}
            totalSteps={5}
            labels={STEP_LABELS}
          />

          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.semantic.border }]}>
          {step < 4 ? (
            <RHButton
              title="Continue"
              onPress={() => { hapticLight(); setStep(step + 1); }}
              disabled={!canGoNext()}
            />
          ) : (
            <RHButton
              title="Create Game"
              onPress={handleCreate}
              loading={isCreating}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function GameTypeCard({
  title,
  description,
  isSelected,
  onPress,
  disabled = false,
  theme,
}: {
  title: string;
  description: string;
  isSelected: boolean;
  onPress: () => void;
  disabled?: boolean;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { if (!disabled) scale.value = withSpring(0.97, springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, springs.bouncy); }}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.gameTypeCard,
        {
          backgroundColor: theme.semantic.card,
          borderColor: isSelected ? theme.colors.teal[500] : theme.semantic.border,
          borderWidth: isSelected ? 2 : 0.5,
          opacity: disabled ? 0.4 : 1,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.gameTypeTitle, { color: theme.semantic.textPrimary }]}>
        {title}
      </Text>
      <Text style={[styles.gameTypeDesc, { color: theme.semantic.textSecondary }]}>
        {description}
      </Text>
    </AnimatedPressable>
  );
}

function ParCell({
  holeNumber,
  par,
  onPress,
  theme,
}: {
  holeNumber: number;
  par: number;
  onPress: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.9, springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, springs.bouncy); }}
      onPress={onPress}
      style={[
        styles.parCell,
        {
          backgroundColor: theme.semantic.card,
          borderColor: theme.semantic.border,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.parHoleNum, { color: theme.semantic.textSecondary }]}>
        {holeNumber}
      </Text>
      <Text style={[styles.parValue, { color: theme.semantic.textPrimary }]}>
        {par}
      </Text>
    </AnimatedPressable>
  );
}

function ToggleButton({
  isOn,
  onToggle,
  theme,
}: {
  isOn: boolean;
  onToggle: () => void;
  theme: any;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.toggle,
        {
          backgroundColor: isOn ? theme.colors.teal[500] : theme.semantic.border,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.toggleThumb,
          {
            transform: [{ translateX: isOn ? 20 : 0 }],
          },
        ]}
      />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: { width: 60 },
  backText: { fontSize: 16, fontWeight: '600' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepContent: { gap: 16 },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 15,
    marginTop: -8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 0.5,
  },

  // Game type cards
  gameTypeCard: {
    borderRadius: 12,
    padding: 16,
  },
  gameTypeTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  gameTypeDesc: {
    fontSize: 14,
  },

  // Players (friend-based selection)
  friendsLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  allSelected: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Course autocomplete
  courseDropdown: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: -8,
    overflow: 'hidden',
  },
  courseDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  courseDropdownName: {
    fontSize: 15,
    fontWeight: '600',
  },
  courseDropdownMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  courseLinked: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },

  // Hole toggle
  holeToggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  holeToggleOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeToggleText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Stakes
  stakesSection: { gap: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  parsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  parCell: {
    width: 38,
    height: 48,
    borderRadius: 6,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  parHoleNum: { fontSize: 10, fontWeight: '500' },
  parValue: { fontSize: 16, fontWeight: '700' },

  // Rules
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  ruleLabel: { fontSize: 16, fontWeight: '600' },
  ruleDesc: { fontSize: 13, marginTop: 2 },
  limitRow: { flexDirection: 'row', gap: 6 },
  limitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },

  // Toggle
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },

  // Confirm
  confirmSection: {
    marginBottom: 14,
  },
  confirmLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  confirmValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  totalPot: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
});
