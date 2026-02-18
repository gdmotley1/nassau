import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';
import { hapticMedium } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RHPressIndicatorProps {
  onPress: () => void;
  label?: string;
  reason?: string;
  disabled?: boolean;
}

export function RHPressIndicator({
  onPress,
  label = 'PRESS',
  reason,
  disabled = false,
}: RHPressIndicatorProps) {
  const theme = useTheme();
  const glowPulse = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    if (disabled) {
      glowPulse.value = withTiming(0, { duration: 200 });
    } else {
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [disabled]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + glowPulse.value * 0.25,
    transform: [{ scale: 1 + glowPulse.value * 0.06 }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: disabled
      ? theme.colors.gray[500]
      : interpolateColor(
          glowPulse.value,
          [0, 1],
          [theme.colors.teal[500] + '40', theme.colors.teal[500] + 'BB'],
        ),
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        if (!disabled) buttonScale.value = withSpring(0.95, springs.snappy);
      }}
      onPressOut={() => {
        if (!disabled) buttonScale.value = withSpring(1, springs.bouncy);
      }}
      onPress={() => {
        if (disabled) return;
        hapticMedium();
        onPress();
      }}
      disabled={disabled}
      style={[styles.container, buttonStyle, disabled && { opacity: 0.4 }]}
    >
      {/* Glow backdrop */}
      <Animated.View
        style={[
          styles.glow,
          {
            backgroundColor: disabled
              ? theme.colors.gray[500]
              : theme.colors.teal[500],
          },
          glowStyle,
        ]}
      />
      {/* Main button body */}
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: (disabled ? theme.colors.gray[500] : theme.colors.teal[500]) + '12',
            borderWidth: 1.5,
          },
          borderStyle,
        ]}
      >
        <View style={styles.content}>
          <Text
            style={[
              styles.labelText,
              { color: disabled ? theme.colors.gray[500] : theme.colors.teal[500] },
            ]}
          >
            {label}
          </Text>
          {reason ? (
            <Text
              style={[
                styles.reasonText,
                { color: disabled ? theme.colors.gray[500] : theme.semantic.textSecondary },
              ]}
              numberOfLines={1}
            >
              {reason}
            </Text>
          ) : null}
        </View>
        {/* Arrow indicator */}
        <View
          style={[
            styles.arrowContainer,
            {
              backgroundColor: (disabled ? theme.colors.gray[500] : theme.colors.teal[500]) + '18',
            },
          ]}
        >
          <Text
            style={[
              styles.arrowText,
              { color: disabled ? theme.colors.gray[500] : theme.colors.teal[500] },
            ]}
          >
            {'\u203A'}
          </Text>
        </View>
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 200,
  },
  glow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 14,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  arrowContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: -1,
  },
});
