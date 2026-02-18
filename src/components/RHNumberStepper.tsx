import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RHNumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  presets?: number[];
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}

export function RHNumberStepper({
  label,
  value,
  onChange,
  presets = [2, 5, 10, 20],
  min = 0,
  max = 1000,
  step = 1,
  prefix = '$',
}: RHNumberStepperProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.semantic.textSecondary }]}>
        {label}
      </Text>

      <View style={styles.presetsRow}>
        {presets.map((preset) => (
          <PresetChip
            key={preset}
            value={preset}
            isSelected={value === preset}
            prefix={prefix}
            onPress={() => onChange(preset)}
            theme={theme}
          />
        ))}
      </View>

      <View style={styles.stepperRow}>
        <StepButton
          label="-"
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          theme={theme}
        />
        <View
          style={[
            styles.valueContainer,
            { borderColor: theme.semantic.border },
          ]}
        >
          <Text
            style={[styles.valueText, { color: theme.semantic.textPrimary }]}
          >
            {prefix}{value}
          </Text>
        </View>
        <StepButton
          label="+"
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          theme={theme}
        />
      </View>
    </View>
  );
}

function PresetChip({
  value,
  isSelected,
  prefix,
  onPress,
  theme,
}: {
  value: number;
  isSelected: boolean;
  prefix: string;
  onPress: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.93, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.bouncy);
      }}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected
            ? theme.colors.teal[500]
            : theme.semantic.card,
          borderColor: isSelected
            ? theme.colors.teal[500]
            : theme.semantic.border,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: isSelected ? '#FFFFFF' : theme.semantic.textPrimary,
          },
        ]}
      >
        {prefix}{value}
      </Text>
    </AnimatedPressable>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
  theme,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  theme: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.9, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.bouncy);
      }}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      disabled={disabled}
      style={[
        styles.stepButton,
        {
          backgroundColor: theme.semantic.card,
          borderColor: theme.semantic.border,
          opacity: disabled ? 0.3 : 1,
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          styles.stepButtonText,
          { color: theme.semantic.textPrimary },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  valueContainer: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
