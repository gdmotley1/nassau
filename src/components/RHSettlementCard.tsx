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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RHSettlementCardProps {
  fromName: string;
  toName: string;
  amount: number;
  isPaid: boolean;
  method?: string | null;
  onVenmo?: () => void;
  onCash?: () => void;
}

export function RHSettlementCard({
  fromName,
  toName,
  amount,
  isPaid,
  method,
  onVenmo,
  onCash,
}: RHSettlementCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

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
      ]}
    >
      <View style={styles.amountRow}>
        <Text style={[styles.owes, { color: theme.semantic.textSecondary }]}>
          {fromName} owes {toName}
        </Text>
        <Text
          style={[
            styles.amount,
            {
              color: isPaid ? theme.colors.green[500] : theme.colors.red[500],
            },
          ]}
        >
          ${amount.toFixed(2)}
        </Text>
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
  amount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
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
