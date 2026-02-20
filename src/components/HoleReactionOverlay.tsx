import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useUIStore } from '../stores/uiStore';
import type { ReactionType } from '../stores/uiStore';
import { useTheme } from '../hooks/useTheme';
import { springs, shakeSequence } from '../utils/animations';
import { getRandomMessage, getReactionLabel } from '../utils/reactionMessages';
import {
  hapticBirdie,
  hapticEagle,
  hapticBogey,
  hapticDoubleBogey,
  hapticLight,
} from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AUTO_DISMISS_MS: Record<ReactionType, number> = {
  eagle_or_better: 3500,
  birdie: 2500,
  par: 2000,
  bogey: 2000,
  double_plus: 2500,
};

function getGradientColors(type: ReactionType, theme: any): [string, string] {
  switch (type) {
    case 'eagle_or_better':
      return [theme.colors.teal[500] + 'CC', theme.colors.teal[500] + '66'];
    case 'birdie':
      return [theme.colors.green[500] + 'AA', theme.colors.green[500] + '55'];
    case 'par':
      return [theme.colors.gray[500] + '66', theme.colors.gray[500] + '33'];
    case 'bogey':
      return [theme.colors.red[500] + '99', theme.colors.red[500] + '44'];
    case 'double_plus':
      return [theme.colors.red[500] + 'CC', theme.colors.red[500] + '66'];
  }
}

function getLabelSize(type: ReactionType): number {
  switch (type) {
    case 'eagle_or_better': return 52;
    default: return 42;
  }
}

export function HoleReactionOverlay() {
  const reaction = useUIStore((s) => s.holeReaction);
  const dismissReaction = useUIStore((s) => s.dismissHoleReaction);
  const theme = useTheme();
  const confettiRef = useRef<ConfettiCannon>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = React.useState('');

  const overlayOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.3);
  const contentTranslateY = useSharedValue(60);
  const shakeX = useSharedValue(0);
  const glowScale = useSharedValue(0);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!reaction) {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      contentScale.value = withTiming(0.3, { duration: 200 });
      return;
    }

    setMessage(getRandomMessage(reaction.type, reaction.playerName, reaction.opponentNames, reaction.gameMode));

    // Animate in
    overlayOpacity.value = withTiming(1, { duration: 200 });
    contentScale.value = withSpring(1, springs.dramatic);
    contentTranslateY.value = withSpring(0, springs.responsive);
    shakeX.value = 0;
    glowScale.value = 0;

    // Type-specific effects
    switch (reaction.type) {
      case 'eagle_or_better':
        setTimeout(() => confettiRef.current?.start(), 200);
        glowScale.value = withSpring(1.5, springs.slow);
        hapticEagle();
        break;
      case 'birdie':
        glowScale.value = withSpring(1.2, springs.gentle);
        hapticBirdie();
        break;
      case 'par':
        glowScale.value = withSpring(1.1, springs.gentle);
        hapticLight();
        break;
      case 'bogey':
        shakeX.value = shakeSequence();
        hapticBogey();
        break;
      case 'double_plus':
        shakeX.value = shakeSequence();
        hapticDoubleBogey();
        break;
    }

    // Auto-dismiss
    timerRef.current = setTimeout(() => {
      dismissReaction();
    }, AUTO_DISMISS_MS[reaction.type]);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [reaction]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: contentScale.value },
      { translateY: contentTranslateY.value },
      { translateX: shakeX.value },
    ],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowScale.value > 0 ? 0.3 : 0,
  }));

  if (!reaction) return null;

  const label = getReactionLabel(reaction.score, reaction.par);
  const gradientColors = getGradientColors(reaction.type, theme);
  const labelSize = getLabelSize(reaction.type);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={dismissReaction}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          overlayAnimatedStyle,
        ]}
      >
        {/* Dark base layer — completely hides scorecard */}
        <View style={[StyleSheet.absoluteFill, styles.darkBase]} />

        {/* Gradient color wash on top */}
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        {/* Glow ring for birdie/eagle/par */}
        {(reaction.type === 'eagle_or_better' || reaction.type === 'birdie' || reaction.type === 'par') && (
          <Animated.View
            style={[
              styles.glowRing,
              {
                backgroundColor:
                  reaction.type === 'eagle_or_better'
                    ? theme.colors.teal[500]
                    : reaction.type === 'birdie'
                    ? theme.colors.green[500]
                    : theme.colors.gray[500],
              },
              glowAnimatedStyle,
            ]}
          />
        )}

        {/* Content */}
        <Animated.View style={[styles.content, contentAnimatedStyle]}>
          {/* Reaction label */}
          <Text
            style={[
              styles.reactionLabel,
              { color: '#FFFFFF', fontSize: labelSize },
            ]}
          >
            {label}
          </Text>

          {/* Hole info */}
          <Text style={styles.holeInfo}>
            Hole {reaction.hole} | {reaction.score} on Par {reaction.par}
          </Text>

          {/* Fun message */}
          <Text style={styles.message}>
            {message}
          </Text>

          {/* Player name */}
          <Text style={styles.playerName}>
            {reaction.playerName}
          </Text>
        </Animated.View>

        {/* Confetti for eagles */}
        {reaction.type === 'eagle_or_better' && (
          <ConfettiCannon
            ref={confettiRef}
            count={80}
            origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
            fadeOut
            colors={['#00D4AA', '#00C805', '#FFFFFF', '#33DDBB', '#66EEDD']}
            autoStart={false}
            explosionSpeed={400}
            fallSpeed={2500}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkBase: {
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  reactionLabel: {
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  holeInfo: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  message: {
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.85)',
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.5)',
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    alignSelf: 'center',
    top: '35%',
  },
});
