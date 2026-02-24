import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';

interface SwipeAction {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
  onPress: () => void;
}

interface SwipeableGameCardProps {
  children: React.ReactNode;
  actions: SwipeAction[];
  enabled?: boolean;
  closeSignal?: number;
  onOpen?: () => void;
}

const ACTION_WIDTH = 72;
const OPEN_THRESHOLD = 80;

export function SwipeableGameCard({
  children,
  actions,
  enabled = true,
  closeSignal,
  onOpen,
}: SwipeableGameCardProps) {
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const contextX = useSharedValue(0);

  const TOTAL_WIDTH = actions.length * ACTION_WIDTH;

  // Close when another card opens
  useEffect(() => {
    if (closeSignal !== undefined && closeSignal > 0) {
      if (isOpen.value) {
        translateX.value = withSpring(0, springs.snappy);
        isOpen.value = false;
      }
    }
  }, [closeSignal]);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      contextX.value = translateX.value;
    })
    .onUpdate((e) => {
      const next = contextX.value + e.translationX;
      // Clamp: can't swipe right past 0, rubber-band past full open
      translateX.value = Math.min(0, Math.max(next, -TOTAL_WIDTH - 20));
    })
    .onEnd((e) => {
      if (isOpen.value) {
        // Already open: close if swiped right enough
        if (e.translationX > OPEN_THRESHOLD / 2) {
          translateX.value = withSpring(0, springs.snappy);
          isOpen.value = false;
        } else {
          translateX.value = withSpring(-TOTAL_WIDTH, springs.responsive);
        }
      } else {
        // Closed: open if swiped left enough
        if (e.translationX < -OPEN_THRESHOLD) {
          translateX.value = withSpring(-TOTAL_WIDTH, springs.responsive);
          isOpen.value = true;
          if (onOpen) runOnJS(onOpen)();
        } else {
          translateX.value = withSpring(0, springs.snappy);
        }
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const actionsOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, TOTAL_WIDTH * 0.4, TOTAL_WIDTH],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    ),
  }));

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.wrapper}>
      {/* Background actions */}
      <Animated.View style={[styles.actionsRow, actionsOpacity]}>
        {actions.map((action, i) => (
          <Pressable
            key={i}
            onPress={() => {
              hapticLight();
              translateX.value = withSpring(0, springs.snappy);
              isOpen.value = false;
              action.onPress();
            }}
            style={styles.actionSlot}
          >
            <View style={[styles.actionCircle, { backgroundColor: action.color }]}>
              <Feather name={action.icon} size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {/* Sliding card content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionsRow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  actionSlot: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 4,
    color: '#8E8E93',
  },
});
