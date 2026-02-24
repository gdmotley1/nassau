import React, { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface SkeletonLoaderProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width,
  height,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const theme = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.7, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: theme.isDark
            ? theme.colors.dark.card
            : theme.colors.gray[100],
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Skeleton matching a game card layout */
export function GameCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <SkeletonLoader width="40%" height={14} />
      <View style={skeletonStyles.spacer} />
      <SkeletonLoader width="70%" height={18} />
      <View style={skeletonStyles.spacer} />
      <SkeletonLoader width="50%" height={14} />
    </View>
  );
}

/** Skeleton for dashboard hero (legacy) */
export function DashboardHeroSkeleton() {
  return (
    <View style={skeletonStyles.hero}>
      <SkeletonLoader width={120} height={14} borderRadius={4} />
      <View style={skeletonStyles.spacerLg} />
      <SkeletonLoader width={180} height={56} borderRadius={8} />
      <View style={skeletonStyles.spacer} />
      <SkeletonLoader width={160} height={14} borderRadius={4} />
    </View>
  );
}

/** Skeleton for new dashboard welcome layout (status line + quick actions + month card) */
export function DashboardWelcomeSkeleton() {
  return (
    <View style={skeletonStyles.welcome}>
      {/* Status line */}
      <View style={skeletonStyles.welcomeStatus}>
        <SkeletonLoader width="55%" height={16} borderRadius={4} />
      </View>

      {/* Quick action chips */}
      <View style={skeletonStyles.welcomeChips}>
        <SkeletonLoader width="30%" height={56} borderRadius={12} />
        <SkeletonLoader width="30%" height={56} borderRadius={12} />
        <SkeletonLoader width="30%" height={56} borderRadius={12} />
      </View>

      {/* Month summary card */}
      <View style={skeletonStyles.welcomeCard}>
        <SkeletonLoader width="100%" height={100} borderRadius={12} />
      </View>
    </View>
  );
}

/** Skeleton for profile stats dashboard */
export function ProfileStatsSkeleton() {
  return (
    <View style={skeletonStyles.profileStats}>
      {/* Hero P/L number */}
      <View style={skeletonStyles.hero}>
        <SkeletonLoader width={200} height={56} borderRadius={8} />
        <View style={skeletonStyles.spacer} />
        <SkeletonLoader width={140} height={14} borderRadius={4} />
      </View>

      {/* Chart placeholder */}
      <View style={skeletonStyles.chartSkeleton}>
        <SkeletonLoader width="100%" height={200} borderRadius={12} />
      </View>

      {/* Stats grid (2x2) */}
      <View style={skeletonStyles.statsGrid}>
        <View style={skeletonStyles.statsGridItem}>
          <SkeletonLoader width="100%" height={72} borderRadius={12} />
        </View>
        <View style={skeletonStyles.statsGridItem}>
          <SkeletonLoader width="100%" height={72} borderRadius={12} />
        </View>
        <View style={skeletonStyles.statsGridItem}>
          <SkeletonLoader width="100%" height={72} borderRadius={12} />
        </View>
        <View style={skeletonStyles.statsGridItem}>
          <SkeletonLoader width="100%" height={72} borderRadius={12} />
        </View>
      </View>

      {/* Game type breakdown card */}
      <View style={skeletonStyles.sectionSkeleton}>
        <SkeletonLoader width={120} height={14} borderRadius={4} />
        <View style={skeletonStyles.spacer} />
        <SkeletonLoader width="100%" height={120} borderRadius={12} />
      </View>

      {/* Insights card */}
      <View style={skeletonStyles.sectionSkeleton}>
        <SkeletonLoader width={100} height={14} borderRadius={4} />
        <View style={skeletonStyles.spacer} />
        <SkeletonLoader width="100%" height={100} borderRadius={12} />
      </View>

      {/* Recent games */}
      <View style={skeletonStyles.sectionSkeleton}>
        <SkeletonLoader width={110} height={14} borderRadius={4} />
        <View style={skeletonStyles.spacer} />
        <SkeletonLoader width="100%" height={56} borderRadius={12} />
        <View style={skeletonStyles.spacer} />
        <SkeletonLoader width="100%" height={56} borderRadius={12} />
        <View style={skeletonStyles.spacer} />
        <SkeletonLoader width="100%" height={56} borderRadius={12} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 12,
  },
  spacer: {
    height: 8,
  },
  spacerLg: {
    height: 16,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  profileStats: {
    paddingHorizontal: 20,
  },
  chartSkeleton: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statsGridItem: {
    width: '48%',
  },
  sectionSkeleton: {
    marginBottom: 20,
  },
  welcome: {
    paddingHorizontal: 20,
  },
  welcomeStatus: {
    marginTop: 8,
    marginBottom: 20,
  },
  welcomeChips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  welcomeCard: {
    marginBottom: 8,
  },
});
