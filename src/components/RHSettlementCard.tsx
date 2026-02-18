import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RHSettlementCardProps {
  fromName: string;
  toName: string;
  amount: number;
  isPaid: boolean;
  animatePaid?: boolean;
  method?: string | null;
  onVenmo?: () => void;
  onCash?: () => void;
}

export function RHSettlementCard({
  fromName,
  toName,
  amount,
  isPaid,
  animatePaid,
  method,
  onVenmo,
  onCash,
}: RHSettlementCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const hasAnimated = useRef(false);

  // Payment animation shared values
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const amountTranslateY = useSharedValue(0);
  const amountOpacity = useSharedValue(1);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  useEffect(() => {
    if (animatePaid && isPaid && !hasAnimated.current) {
      hasAnimated.current = true;
      hapticSuccess();

      // Step 1: Card shrinks slightly (satisfying "click" feel)
      cardScale.value = withSpring(0.95, springs.snappy);

      // Step 2: Amount flies up and fades
      amountTranslateY.value = withDelay(
        150,
        withSpring(-30, springs.responsive),
      );
      amountOpacity.value = withDelay(
        150,
        withTiming(0, { duration: 300 }),
      );

      // Step 3: Green checkmark bounces in
      checkScale.value = withDelay(
        350,
        withSequence(
          withSpring(1.3, springs.bouncy),
          withSpring(1.0, springs.bouncy),
        ),
      );
      checkOpacity.value = withDelay(
        350,
        withTiming(1, { duration: 200 }),
      );

      // Step 4: Card returns to normal
      cardScale.value = withDelay(
        400,
        withSpring(1, springs.gentle),
      );

      // Step 5: Mute card slightly
      cardOpacity.value = withDelay(
        500,
        withTiming(0.85, { duration: 300 }),
      );
    }
  }, [animatePaid, isPaid]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const amountAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: amountTranslateY.value }],
    opacity: amountOpacity.value,
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.semantic.card,
          borderColor: isPaid ? theme.colors.green[500] + '40' : theme.semantic.border,
          borderWidth: isPaid ? 1.5 : 0.5,
        },
        animatedStyle,
        cardAnimatedStyle,
      ]}
    >
      <View style={styles.amountRow}>
        <Text style={[styles.owes, { color: theme.semantic.textSecondary }]}>
          {fromName} owes {toName}
        </Text>
        <View style={styles.amountContainer}>
          <Animated.Text
            style={[
              styles.amount,
              {
                color: isPaid ? theme.colors.green[500] : theme.colors.red[500],
              },
              amountAnimatedStyle,
            ]}
          >
            ${amount.toFixed(2)}
          </Animated.Text>
          <Animated.View style={[styles.checkOverlay, checkAnimatedStyle]}>
            <Feather
              name="check-circle"
              size={24}
              color={theme.colors.green[500]}
            />
          </Animated.View>
        </View>
      </View>

      {isPaid ? (
        <View
          style={[
            styles.paidBadge,
            { backgroundColor: theme.colors.green[500] + '15' },
          ]}
        >
          <Text style={[styles.paidText, { color: theme.colors.green[500] }]}>
            PAID via {method?.toUpperCase() ?? 'CASH'}
          </Text>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          {onVenmo && (
            <PayButton
              title="Pay with Venmo"
              color="#3D95CE"
              onPress={() => {
                hapticLight();
                onVenmo();
              }}
            />
          )}
          {onCash && (
            <PayButton
              title="Mark as Cash"
              color={theme.semantic.textSecondary}
              onPress={() => {
                hapticLight();
                onCash();
              }}
            />
          )}
        </View>
      )}
    </Animated.View>
  );
}

function PayButton({
  title,
  color,
  onPress,
}: {
  title: string;
  color: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.bouncy);
      }}
      onPress={onPress}
      style={[
        styles.payButton,
        { borderColor: color },
        animatedStyle,
      ]}
    >
      <Text style={[styles.payButtonText, { color }]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  owes: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  amountContainer: {
    position: 'relative',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  checkOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paidBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  paidText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  payButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
