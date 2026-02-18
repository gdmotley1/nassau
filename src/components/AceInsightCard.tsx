/**
 * AceInsightCard — Proactive insight card from Ace AI Caddie
 *
 * Slides in automatically when Ace has something useful to say.
 * No user action required — just appears at the right moment.
 *
 * Variants:
 *   - press:    "Press? You win 62% when 2 down against Mike."
 *   - matchup:  "You're 4-1 against Mike. Edge: back 9."
 *   - postRound: "You left $10 on the table — 2 missed presses."
 *   - insight:   Generic stat-based insight
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type AceVariant = 'press' | 'matchup' | 'postRound' | 'insight';

interface AceInsightCardProps {
  variant: AceVariant;
  headline: string;         // Bold top line: "Press?" or "vs Mike" or "Round Analysis"
  body: string;             // Main insight text
  stat?: string;            // Big number: "62%" or "+$45" or "4-1"
  statLabel?: string;       // Label under stat: "win rate" or "net" or "record"
  supportingFacts?: string[]; // Extra context lines
  onDismiss?: () => void;
  onAction?: () => void;    // Optional CTA (e.g., "Press" button)
  actionLabel?: string;     // CTA button text
}

export function AceInsightCard({
  variant,
  headline,
  body,
  stat,
  statLabel,
  supportingFacts,
  onDismiss,
  onAction,
  actionLabel,
}: AceInsightCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const accentColor = getAccentColor(variant, theme);
  const icon = getIcon(variant);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(120)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: theme.semantic.card,
          borderColor: accentColor + '30',
        },
        animatedStyle,
      ]}
    >
      {/* Header row: Ace badge + headline + dismiss */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.aceBadge, { backgroundColor: accentColor + '18' }]}>
            <Text style={[styles.aceBadgeText, { color: accentColor }]}>
              {icon} ACE
            </Text>
          </View>
          <Text style={[styles.headline, { color: theme.semantic.textPrimary }]}>
            {headline}
          </Text>
        </View>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Text style={[styles.dismiss, { color: theme.semantic.textSecondary }]}>
              ✕
            </Text>
          </Pressable>
        )}
      </View>

      {/* Stat + Body layout */}
      <View style={styles.bodyRow}>
        {stat && (
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: accentColor }]}>
              {stat}
            </Text>
            {statLabel && (
              <Text style={[styles.statLabel, { color: theme.semantic.textSecondary }]}>
                {statLabel}
              </Text>
            )}
          </View>
        )}
        <View style={[styles.bodyBlock, stat ? styles.bodyWithStat : undefined]}>
          <Text style={[styles.bodyText, { color: theme.semantic.textPrimary }]}>
            {body}
          </Text>
        </View>
      </View>

      {/* Supporting facts */}
      {supportingFacts && supportingFacts.length > 0 && (
        <View style={[styles.factsContainer, { borderTopColor: theme.semantic.border }]}>
          {supportingFacts.map((fact, i) => (
            <View key={i} style={styles.factRow}>
              <View style={[styles.factDot, { backgroundColor: accentColor }]} />
              <Text style={[styles.factText, { color: theme.semantic.textSecondary }]}>
                {fact}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action button */}
      {onAction && actionLabel && (
        <AnimatedPressable
          onPressIn={() => {
            scale.value = withSpring(0.97, springs.snappy);
          }}
          onPressOut={() => {
            scale.value = withSpring(1, springs.bouncy);
          }}
          onPress={() => {
            hapticLight();
            onAction();
          }}
          style={[styles.actionButton, { backgroundColor: accentColor }]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </AnimatedPressable>
      )}
    </Animated.View>
  );
}

function getAccentColor(variant: AceVariant, theme: any): string {
  switch (variant) {
    case 'press':
      return theme.colors.teal[500];
    case 'matchup':
      return theme.colors.teal[500];
    case 'postRound':
      return theme.colors.green[500];
    case 'insight':
      return theme.colors.teal[500];
  }
}

function getIcon(variant: AceVariant): string {
  // Using text characters since no emojis in UI
  switch (variant) {
    case 'press':
      return ''; // clean, no icon
    case 'matchup':
      return '';
    case 'postRound':
      return '';
    case 'insight':
      return '';
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
  headline: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  dismiss: {
    fontSize: 16,
    fontWeight: '500',
    padding: 4,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statBlock: {
    alignItems: 'center',
    minWidth: 56,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: -2,
  },
  bodyBlock: {
    flex: 1,
  },
  bodyWithStat: {
    paddingTop: 4,
  },
  bodyText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  factsContainer: {
    borderTopWidth: 0.5,
    paddingTop: 8,
    gap: 4,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  factDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  factText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
