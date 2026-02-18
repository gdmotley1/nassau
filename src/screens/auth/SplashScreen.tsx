import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores';
import { springs } from '../../utils/animations';

export function SplashScreen() {
  const theme = useTheme();
  const initialize = useAuthStore((s) => s.initialize);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    // Animate logo in
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withSpring(1, springs.bouncy);

    // Animate tagline
    taglineOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));

    // Initialize auth
    initialize();
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: theme.semantic.surface }]}
    >
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Text style={[styles.logo, { color: theme.colors.teal[500] }]}>
          Nassau
        </Text>
      </Animated.View>
      <Animated.Text
        style={[
          styles.tagline,
          { color: theme.semantic.textSecondary },
          taglineStyle,
        ]}
      >
        Track golf bets with friends
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 12,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
  },
});
