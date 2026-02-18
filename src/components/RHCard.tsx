import React from 'react';
import { StyleSheet, Pressable, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RHCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
}

export function RHCard({
  children,
  onPress,
  style,
  elevated = false,
}: RHCardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!onPress) return;
    scale.value = withSpring(0.97, springs.snappy);
  };

  const handlePressOut = () => {
    if (!onPress) return;
    scale.value = withSpring(1, springs.bouncy);
  };

  const handlePress = () => {
    if (!onPress) return;
    hapticLight();
    onPress();
  };

  const shadowStyle = theme.isDark
    ? { borderWidth: 1, borderColor: theme.semantic.border }
    : elevated
      ? theme.shadows.md
      : theme.shadows.sm;

  const content = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.semantic.card,
        },
        shadowStyle,
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={animatedStyle}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.semantic.card,
            },
            shadowStyle,
            style,
          ]}
        >
          {children}
        </Animated.View>
      </AnimatedPressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
});
