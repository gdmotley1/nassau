import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';

interface RHBetStatusCardProps {
  label: string; // "Front 9", "Back 9", "Overall"
  amount: number;
  leaderName: string | null;
  margin: number;
  holesPlayed: number;
  totalHoles: number;
  pressCount?: number;
  isComplete?: boolean;
}

export function RHBetStatusCard({
  label,
  amount,
  leaderName,
  margin,
  holesPlayed,
  totalHoles,
  pressCount = 0,
  isComplete = false,
}: RHBetStatusCardProps) {
  const theme = useTheme();

  const statusText = leaderName
    ? `${leaderName} ${margin} UP`
    : 'ALL SQUARE';

  const statusColor = leaderName
    ? theme.colors.green[500]
    : theme.semantic.textSecondary;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.semantic.card,
          borderColor: theme.semantic.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.semantic.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.amount, { color: theme.semantic.textPrimary }]}>
          ${amount}
        </Text>
      </View>

      <Text style={[styles.status, { color: statusColor }]}>
        {statusText}
      </Text>

      <View style={styles.footer}>
        <View style={styles.progressRow}>
          {Array.from({ length: totalHoles }, (_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    i < holesPlayed
                      ? theme.colors.teal[500]
                      : theme.semantic.border,
                },
              ]}
            />
          ))}
        </View>

        {pressCount > 0 && (
          <View style={styles.pressRow}>
            <View
              style={[
                styles.pressBadge,
                { backgroundColor: theme.colors.teal[500] + '20' },
              ]}
            >
              <Text
                style={[
                  styles.pressText,
                  { color: theme.colors.teal[500] },
                ]}
              >
                {pressCount} {pressCount === 1 ? 'PRESS' : 'PRESSES'}
              </Text>
            </View>
          </View>
        )}

        {isComplete && (
          <Text style={[styles.completeText, { color: theme.semantic.textSecondary }]}>
            FINAL
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    width: 160,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  footer: {
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 2,
  },
  progressDot: {
    width: 12,
    height: 3,
    borderRadius: 1.5,
    flex: 1,
  },
  pressRow: {
    flexDirection: 'row',
  },
  pressBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pressText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  completeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
