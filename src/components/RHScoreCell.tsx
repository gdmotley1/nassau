import React, { useRef, useEffect } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs, scoreBounce } from '../utils/animations';
import { hapticMedium } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RHScoreCellProps {
  strokes: number | null;
  par: number;
  onPress?: () => void;
  isCurrentHole?: boolean;
  size?: 'small' | 'medium' | 'normal';
}

export function RHScoreCell({
  strokes,
  par,
  onPress,
  isCurrentHole = false,
  size = 'normal',
}: RHScoreCellProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const prevStrokes = useRef<number | null>(null);

  useEffect(() => {
    if (prevStrokes.current === null && strokes !== null) {
      scale.value = scoreBounce();
    }
    prevStrokes.current = strokes;
  }, [strokes]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, springs.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSequence(
      withSpring(1.05, springs.bouncy),
      withSpring(1, springs.bouncy),
    );
  };

  const handlePress = () => {
    if (!onPress) return;
    hapticMedium();
    onPress();
  };

  const getScoreColor = (): string => {
    if (strokes === null) return theme.semantic.textSecondary;
    const diff = strokes - par;
    if (diff <= -2) return theme.colors.teal[500]; // Eagle or better
    if (diff === -1) return theme.colors.green[500]; // Birdie
    if (diff === 0) return theme.semantic.textPrimary; // Par
    if (diff === 1) return theme.colors.red[400]; // Bogey
    return theme.colors.red[500]; // Double bogey+
  };

  const getScoreBg = (): string => {
    if (strokes === null) {
      return isCurrentHole
        ? theme.colors.teal[500] + '15'
        : 'transparent';
    }
    const diff = strokes - par;
    if (diff <= -2) return theme.colors.teal[500] + '20';
    if (diff === -1) return theme.colors.green[500] + '15';
    if (diff >= 2) return theme.colors.red[500] + '15';
    return 'transparent';
  };

  const cellSize = size === 'small' ? 32 : size === 'medium' ? 40 : 48;

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={!onPress}
      style={[
        styles.cell,
        {
          width: cellSize,
          height: cellSize,
          backgroundColor: getScoreBg(),
          borderColor: isCurrentHole ? theme.colors.teal[500] : theme.semantic.border,
          borderWidth: isCurrentHole ? 2 : 0.5,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: getScoreColor(),
            fontSize: size === 'small' ? 14 : size === 'medium' ? 16 : 17,
            fontWeight: strokes !== null ? '700' : '400',
          },
        ]}
      >
        {strokes !== null ? strokes : '-'}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    letterSpacing: -0.3,
  },
});
