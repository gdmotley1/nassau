import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useSubscriptionStore } from '../stores';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AcePremiumGateProps {
  children: React.ReactNode;
  onUpgrade: () => void;
  teaserText?: string;
}

export function AcePremiumGate({
  children,
  onUpgrade,
  teaserText,
}: AcePremiumGateProps) {
  const isPremium = useSubscriptionStore((s) => s.isPremium);

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <AceTeaser
      onUpgrade={onUpgrade}
      teaserText={teaserText ?? 'Get AI-powered betting insights'}
    />
  );
}

function AceTeaser({
  onUpgrade,
  teaserText,
}: {
  onUpgrade: () => void;
  teaserText: string;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.springify().damping(18).stiffness(120)}>
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.97, springs.snappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, springs.bouncy);
        }}
        onPress={() => {
          hapticLight();
          onUpgrade();
        }}
        style={[
          styles.teaserCard,
          {
            backgroundColor: theme.semantic.card,
            borderColor: theme.colors.teal[500] + '30',
          },
          animatedStyle,
        ]}
      >
        <View style={styles.teaserHeader}>
          <View
            style={[
              styles.aceBadge,
              { backgroundColor: theme.colors.teal[500] + '18' },
            ]}
          >
            <Text
              style={[styles.aceBadgeText, { color: theme.colors.teal[500] }]}
            >
              NASSAU PRO
            </Text>
          </View>
          <Feather name="lock" size={14} color={theme.colors.teal[500]} />
        </View>
        <Text
          style={[styles.teaserText, { color: theme.semantic.textPrimary }]}
        >
          {teaserText}
        </Text>
        <View
          style={[
            styles.upgradePill,
            { backgroundColor: theme.colors.teal[500] + '12' },
          ]}
        >
          <Text
            style={[styles.upgradeText, { color: theme.colors.teal[500] }]}
          >
            Unlock with Nassau Pro
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  teaserCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  teaserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  teaserText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  upgradePill: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
