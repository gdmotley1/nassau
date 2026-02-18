import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({
  message,
  type = 'info',
  visible,
  onDismiss,
  duration = 3000,
}: ToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, springs.responsive);
      opacity.value = withSpring(1, springs.responsive);

      // Auto dismiss
      const timeout = setTimeout(() => {
        dismiss();
      }, duration);
      return () => clearTimeout(timeout);
    } else {
      dismiss();
    }
  }, [visible]);

  const dismiss = () => {
    translateY.value = withSpring(100, springs.snappy);
    opacity.value = withDelay(
      100,
      withSpring(0, springs.snappy, (finished) => {
        if (finished) {
          runOnJS(onDismiss)();
        }
      })
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return theme.colors.green[500];
      case 'error':
        return theme.colors.red[500];
      default:
        return theme.colors.teal[500];
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? theme.colors.dark.elevated
            : theme.colors.gray[900],
          borderLeftColor: getBorderColor(),
          bottom: insets.bottom + 70, // Above tab bar
        },
        animatedStyle,
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    zIndex: 9999,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});
