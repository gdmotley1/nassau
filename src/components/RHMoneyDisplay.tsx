import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { moneyCounterEasing } from '../utils/animations';

type MoneySize = 'small' | 'medium' | 'large';

interface RHMoneyDisplayProps {
  amount: number;
  size?: MoneySize;
  animate?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const sizeMap: Record<MoneySize, { fontSize: number; lineHeight: number }> = {
  small: { fontSize: 17, lineHeight: 22 },
  medium: { fontSize: 22, lineHeight: 28 },
  large: { fontSize: 56, lineHeight: 64 },
};

function formatAmount(val: number): string {
  'worklet';
  const abs = Math.abs(val);
  const formatted = abs.toFixed(2);
  if (val > 0.005) return `+$${formatted}`;
  if (val < -0.005) return `-$${formatted}`;
  return `$${(0).toFixed(2)}`;
}

export function RHMoneyDisplay({
  amount,
  size = 'medium',
  animate = true,
  style,
  textStyle,
}: RHMoneyDisplayProps) {
  const theme = useTheme();
  const [displayText, setDisplayText] = useState(formatAmount(animate ? 0 : amount));
  const animatedAmount = useSharedValue(animate ? 0 : amount);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (animate) {
      // Animate the value and update display text periodically
      animatedAmount.value = withTiming(amount, {
        duration: 1200,
        easing: moneyCounterEasing,
      });

      // Use a JS interval to read the animated value and update display
      const startTime = Date.now();
      const startVal = animatedAmount.value;
      const endVal = amount;
      const duration = 1200;

      const tick = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Approximate the easing
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentVal = startVal + (endVal - startVal) * eased;
        setDisplayText(formatAmount(currentVal));

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        }
      };

      frameRef.current = requestAnimationFrame(tick);

      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      };
    } else {
      animatedAmount.value = amount;
      setDisplayText(formatAmount(amount));
    }
  }, [amount, animate]);

  const getColor = () => {
    if (amount > 0) return theme.semantic.moneyPositive;
    if (amount < 0) return theme.semantic.moneyNegative;
    return theme.semantic.moneyZero;
  };

  const sizeStyle = sizeMap[size];

  return (
    <Animated.View style={[styles.container, style]}>
      <Text
        style={[
          {
            fontSize: sizeStyle.fontSize,
            lineHeight: sizeStyle.lineHeight,
            fontWeight: '700',
            letterSpacing: size === 'large' ? -1.5 : -0.5,
            color: getColor(),
          },
          textStyle,
        ]}
      >
        {displayText}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
