import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

interface CourseUndulationProps {
  variant?: 'augusta' | 'links';
  opacity?: number;
}

function generateContourPath(
  width: number,
  height: number,
  baseY: number,
  amplitude: number,
  frequency: number,
  phase: number,
  segments: number,
): string {
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = width * t;
    const y =
      baseY +
      Math.sin(t * Math.PI * frequency + phase) * amplitude +
      Math.sin(t * Math.PI * frequency * 0.5 + phase * 1.3) * (amplitude * 0.4) +
      Math.sin(t * Math.PI * frequency * 1.7 + phase * 0.7) * (amplitude * 0.2);
    points.push({ x, y });
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.5;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.5;
    d += ` C ${cpx1} ${prev.y} ${cpx2} ${curr.y} ${curr.x} ${curr.y}`;
  }

  d += ` L ${width * 1.5} ${height} L ${-width * 0.5} ${height} Z`;
  return d;
}

const LAYER_CONFIGS = {
  augusta: [
    { baseYRatio: 0.15, amplitude: 40, frequency: 2.2, phase: 0 },
    { baseYRatio: 0.30, amplitude: 55, frequency: 1.8, phase: 1.2 },
    { baseYRatio: 0.48, amplitude: 35, frequency: 2.6, phase: 2.5 },
    { baseYRatio: 0.65, amplitude: 50, frequency: 2.0, phase: 0.8 },
    { baseYRatio: 0.82, amplitude: 30, frequency: 3.0, phase: 3.8 },
  ],
  links: [
    { baseYRatio: 0.12, amplitude: 20, frequency: 4.0, phase: 0 },
    { baseYRatio: 0.28, amplitude: 25, frequency: 3.5, phase: 1.5 },
    { baseYRatio: 0.45, amplitude: 18, frequency: 5.0, phase: 2.8 },
    { baseYRatio: 0.62, amplitude: 22, frequency: 4.2, phase: 0.5 },
    { baseYRatio: 0.80, amplitude: 15, frequency: 5.5, phase: 4.0 },
  ],
};

const LAYER_OPACITIES = [0.03, 0.04, 0.025, 0.035, 0.02];

export function CourseUndulation({ variant = 'augusta', opacity = 1 }: CourseUndulationProps) {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const translateX = useSharedValue(0);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withTiming(-width * 0.15, { duration: 20000, easing: Easing.linear }),
      -1,
      true,
    );
  }, [width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const configs = LAYER_CONFIGS[variant];
  const tealBase = theme.colors.teal[500];

  const paths = useMemo(() => {
    const extendedWidth = width * 1.3;
    return configs.map((cfg) =>
      generateContourPath(
        extendedWidth,
        height,
        height * cfg.baseYRatio,
        cfg.amplitude,
        cfg.frequency,
        cfg.phase,
        24,
      ),
    );
  }, [width, height, variant]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }, animatedStyle]} pointerEvents="none">
      <Svg width={width * 1.3} height={height} style={StyleSheet.absoluteFill}>
        {paths.map((d, i) => (
          <Path
            key={i}
            d={d}
            fill={tealBase}
            opacity={LAYER_OPACITIES[i]}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
