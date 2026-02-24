import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { RHButton } from './RHButton';

interface RHErrorStateProps {
  title?: string;
  description?: string;
  onRetry: () => void;
  retryLabel?: string;
}

export function RHErrorState({
  title = 'Something went wrong',
  description = 'Check your connection and try again.',
  onRetry,
  retryLabel = 'Try Again',
}: RHErrorStateProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={styles.container}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.red[500] + '15' },
        ]}
      >
        <Feather name="alert-circle" size={28} color={theme.colors.red[500]} />
      </View>
      <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
        {title}
      </Text>
      <Text
        style={[styles.description, { color: theme.semantic.textSecondary }]}
      >
        {description}
      </Text>
      <View style={styles.buttonWrapper}>
        <RHButton
          title={retryLabel}
          onPress={onRetry}
          fullWidth={false}
          style={{ paddingHorizontal: 32 }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonWrapper: {
    marginTop: 24,
  },
});
