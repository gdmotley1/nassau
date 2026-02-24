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
import { colors } from '../theme';
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
      teaserText={teaserText ?? 'Ace has something for you.'}
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
            backgroundColor: theme.isDark ? colors.dark.elevated : theme.semantic.card,
            borderLeftColor: theme.colors.teal[500],
          },
          animatedStyle,
        ]}
      >
        <View style={styles.teaserHeader}>
          <Text
            style={[styles.aceLabel, { color: theme.colors.teal[500] }]}
          >
            ACE
          </Text>
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
            Unlock Ace
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  teaserCard: {
    borderRadius: 14,
    borderWidth: 0,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  teaserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aceLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
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
