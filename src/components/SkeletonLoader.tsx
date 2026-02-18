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

/** Skeleton for dashboard hero */
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
});
