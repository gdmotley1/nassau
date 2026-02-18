import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';
import { getInitials, formatHandicap } from '../utils/format';
import type { PaidStatus } from '../types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RHPlayerCardProps {
  name: string;
  handicap?: number | null;
  paidStatus?: PaidStatus;
  showStatus?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  isCreator?: boolean;
}

const paidStatusLabels: Record<PaidStatus, string> = {
  unpaid: 'Unpaid',
  paid_venmo: 'Paid Venmo',
  paid_zelle: 'Paid Zelle',
  paid_cash: 'Paid Cash',
};

export function RHPlayerCard({
  name,
  handicap,
  paidStatus,
  showStatus = false,
  onPress,
  onRemove,
  isCreator = false,
}: RHPlayerCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!onPress) return;
    scale.value = withSpring(0.97, springs.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springs.bouncy);
  };

  const handlePress = () => {
    if (!onPress) return;
    hapticLight();
    onPress();
  };

  const isPaid = paidStatus && paidStatus !== 'unpaid';

  const Wrapper = onPress ? AnimatedPressable : Animated.View;

  return (
    <Wrapper
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        styles.container,
        {
          backgroundColor: theme.semantic.card,
          borderWidth: theme.isDark ? 1 : 0,
          borderColor: theme.semantic.border,
        },
        !theme.isDark && theme.shadows.sm,
        animatedStyle,
      ]}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          { backgroundColor: theme.colors.teal[500] },
        ]}
      >
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: theme.semantic.textPrimary }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.detail, { color: theme.semantic.textSecondary }]}>
          {isCreator ? 'Creator' : handicap !== undefined ? `${formatHandicap(handicap)} hcp` : ''}
        </Text>
      </View>

      {/* Status / Actions */}
      {showStatus && paidStatus && (
        <View style={styles.statusContainer}>
          <Text
            style={[
              styles.statusText,
              {
                color: isPaid
                  ? theme.colors.green[500]
                  : theme.semantic.textSecondary,
              },
            ]}
          >
            {isPaid ? '\u2705' : '\u23F3'} {paidStatusLabels[paidStatus]}
          </Text>
        </View>
      )}

      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={12} style={styles.removeButton}>
          <Text style={[styles.removeText, { color: theme.colors.gray[300] }]}>
            \u2715
          </Text>
        </Pressable>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  detail: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  removeText: {
    fontSize: 18,
    fontWeight: '400',
  },
});
