import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';

interface RHStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function RHStepIndicator({
  currentStep,
  totalSteps,
  labels,
}: RHStepIndicatorProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <StepDot
            key={i}
            index={i}
            isActive={i === currentStep}
            isCompleted={i < currentStep}
            theme={theme}
          />
        ))}
      </View>
      {labels && labels[currentStep] && (
        <Text
          style={[styles.label, { color: theme.semantic.textSecondary }]}
        >
          {labels[currentStep]}
        </Text>
      )}
    </View>
  );
}

function StepDot({
  index,
  isActive,
  isCompleted,
  theme,
}: {
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  theme: any;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 24 : 8, springs.snappy),
    backgroundColor: isActive || isCompleted
      ? theme.colors.teal[500]
      : theme.semantic.border,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
  },
});
