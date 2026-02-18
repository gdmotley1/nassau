import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Line,
  Text as SvgText,
  Circle,
  Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import type { MonthlyDataPoint } from '../types';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface RHLineChartProps {
  data: MonthlyDataPoint[];
  height?: number;
  animated?: boolean;
}

const PADDING_LEFT = 0;
const PADDING_RIGHT = 8;
const PADDING_TOP = 24;
const PADDING_BOTTOM = 32;
const LABEL_HEIGHT = 20;

/**
 * Generate smooth cubic bezier control points for a set of data points.
 * Creates a Catmull-Rom-like spline for smooth curves through all points.
 */
function buildBezierPath(
  points: { x: number; y: number }[],
): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Control points using Catmull-Rom to Bezier conversion
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

/**
 * Approximate total length of an SVG path for stroke-dasharray animation.
 * Uses segment-by-segment distance estimation.
 */
function approxPathLength(points: { x: number; y: number }[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length * 1.2; // Bezier curves are longer than straight lines
}

export function RHLineChart({
  data,
  height = 200,
  animated = true,
}: RHLineChartProps) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const drawProgress = useSharedValue(animated ? 0 : 1);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // Determine line color based on final cumulative value
  const lastValue = data.length > 0 ? data[data.length - 1].cumulative : 0;
  const lineColor = lastValue >= 0 ? theme.colors.green[500] : theme.colors.red[500];

  // Chart dimensions
  const chartWidth = containerWidth - PADDING_LEFT - PADDING_RIGHT;
  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM - LABEL_HEIGHT;

  // Compute points
  const { points, zeroY, minVal, maxVal } = useMemo(() => {
    if (data.length === 0 || chartWidth <= 0 || chartHeight <= 0) {
      return { points: [], zeroY: 0, minVal: 0, maxVal: 0 };
    }

    const values = data.map((d) => d.cumulative);
    let minV = Math.min(...values, 0);
    let maxV = Math.max(...values, 0);

    // Add 10% padding so line doesn't touch edges
    const range = maxV - minV || 1;
    minV -= range * 0.1;
    maxV += range * 0.1;

    const pts = data.map((d, i) => {
      const x = PADDING_LEFT + (i / Math.max(data.length - 1, 1)) * chartWidth;
      const y = PADDING_TOP + ((maxV - d.cumulative) / (maxV - minV)) * chartHeight;
      return { x, y };
    });

    const zy = PADDING_TOP + ((maxV - 0) / (maxV - minV)) * chartHeight;

    return { points: pts, zeroY: zy, minVal: minV, maxVal: maxV };
  }, [data, chartWidth, chartHeight]);

  // Build path strings
  const linePath = useMemo(() => buildBezierPath(points), [points]);
  const fillPath = useMemo(() => {
    if (points.length < 2) return '';
    const bottomY = PADDING_TOP + chartHeight;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [linePath, points, chartHeight]);

  // Path length for draw-in animation
  const pathLength = useMemo(() => approxPathLength(points), [points]);

  // Animate draw-in
  useEffect(() => {
    if (animated && points.length > 1) {
      drawProgress.value = 0;
      drawProgress.value = withTiming(1, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [animated, points.length]);

  // Animated stroke-dashoffset
  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - drawProgress.value),
  }));

  // X-axis labels (show every 2nd or 3rd month depending on count)
  const labelInterval = data.length <= 6 ? 1 : data.length <= 12 ? 2 : 3;

  // Touch handling
  const handleTouch = useCallback(
    (x: number) => {
      if (points.length === 0 || chartWidth <= 0) return;
      // Find nearest point
      const relativeX = x - PADDING_LEFT;
      const index = Math.round((relativeX / chartWidth) * (data.length - 1));
      const clamped = Math.max(0, Math.min(data.length - 1, index));
      setActiveIndex(clamped);
    },
    [points, chartWidth, data.length],
  );

  // Empty state: show flat $0 line
  if (data.length < 2) {
    return (
      <View style={[styles.container, { height }]} onLayout={onLayout}>
        {containerWidth > 0 && (
          <Svg width={containerWidth} height={height}>
            <Line
              x1={PADDING_LEFT}
              y1={height / 2}
              x2={PADDING_LEFT + chartWidth}
              y2={height / 2}
              stroke={theme.semantic.border}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.5}
            />
            <SvgText
              x={containerWidth / 2}
              y={height / 2 - 10}
              fill={theme.semantic.textSecondary}
              fontSize={11}
              fontWeight="500"
              textAnchor="middle"
            >
              $0.00
            </SvgText>
          </Svg>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {containerWidth > 0 && (
        <Svg width={containerWidth} height={height}>
          <Defs>
            <SvgLinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="0.25" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {/* Zero line */}
          {zeroY > PADDING_TOP && zeroY < PADDING_TOP + chartHeight && (
            <Line
              x1={PADDING_LEFT}
              y1={zeroY}
              x2={PADDING_LEFT + chartWidth}
              y2={zeroY}
              stroke={theme.semantic.border}
              strokeWidth={1}
              strokeDasharray="4 4"
              opacity={0.5}
            />
          )}

          {/* Gradient fill */}
          <Path d={fillPath} fill="url(#fillGrad)" opacity={0.8} />

          {/* Main line */}
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            animatedProps={animatedLineProps}
          />

          {/* X-axis labels */}
          {data.map((dp, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return null;
            return (
              <SvgText
                key={dp.month}
                x={points[i]?.x ?? 0}
                y={height - 4}
                fill={theme.semantic.textSecondary}
                fontSize={10}
                fontWeight="400"
                textAnchor="middle"
              >
                {dp.label}
              </SvgText>
            );
          })}

          {/* Active point indicator */}
          {activeIndex !== null && points[activeIndex] && (
            <>
              {/* Vertical line */}
              <Line
                x1={points[activeIndex].x}
                y1={PADDING_TOP}
                x2={points[activeIndex].x}
                y2={PADDING_TOP + chartHeight}
                stroke={theme.semantic.textSecondary}
                strokeWidth={1}
                opacity={0.3}
              />
              {/* Dot */}
              <Circle
                cx={points[activeIndex].x}
                cy={points[activeIndex].y}
                r={5}
                fill={lineColor}
                stroke={theme.semantic.surface}
                strokeWidth={2}
              />
              {/* Tooltip background */}
              <Rect
                x={Math.max(4, Math.min(points[activeIndex].x - 45, containerWidth - 94))}
                y={Math.max(0, points[activeIndex].y - 36)}
                width={90}
                height={24}
                rx={6}
                fill={theme.isDark ? theme.colors.dark.card : theme.colors.gray[100]}
              />
              {/* Tooltip text */}
              <SvgText
                x={Math.max(49, Math.min(points[activeIndex].x, containerWidth - 49))}
                y={Math.max(16, points[activeIndex].y - 18)}
                fill={theme.semantic.textPrimary}
                fontSize={11}
                fontWeight="600"
                textAnchor="middle"
              >
                {data[activeIndex].label}: {data[activeIndex].cumulative >= 0 ? '+' : ''}${Math.abs(data[activeIndex].cumulative).toFixed(2)}
              </SvgText>
            </>
          )}

          {/* Touch overlay */}
          <Rect
            x={0}
            y={0}
            width={containerWidth}
            height={height}
            fill="transparent"
            onPressIn={(e) => handleTouch(e.nativeEvent.locationX)}
            onResponderMove={(e) => handleTouch(e.nativeEvent.locationX)}
            onPressOut={() => setActiveIndex(null)}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyChart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
