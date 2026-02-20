import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
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
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import type { MonthlyDataPoint } from '../types';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Time Range Filter ──────────────────────────────────────────

export type TimeRange = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

function filterDataByRange(data: MonthlyDataPoint[], range: TimeRange): MonthlyDataPoint[] {
  if (range === 'ALL' || data.length <= 2) return data;

  const now = new Date();
  let cutoff: Date;

  switch (range) {
    case '1M':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case '3M':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '6M':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case 'YTD':
      cutoff = new Date(now.getFullYear(), 0, 1);
      break;
    case '1Y':
      cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    default:
      return data;
  }

  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
  const filtered = data.filter((d) => d.month >= cutoffStr);

  // Need at least 2 points for a chart
  if (filtered.length < 2) return data;
  return filtered;
}

// ─── Props ──────────────────────────────────────────────────────

interface RHLineChartProps {
  data: MonthlyDataPoint[];
  height?: number;
  animated?: boolean;
  /** Called when user scrubs to a point — sends cumulative value */
  onScrub?: (value: number | null, label: string | null) => void;
  /** Show time range selector pills */
  showTimeRange?: boolean;
}

// ─── Layout constants ───────────────────────────────────────────

const PADDING_LEFT = 0;
const PADDING_RIGHT = 0;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 24;
const LABEL_HEIGHT = 16;

// ─── Bezier path builder ────────────────────────────────────────

function buildBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

function approxPathLength(points: { x: number; y: number }[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length * 1.2;
}

// ─── Time Range Pill ────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TimeRangePill({
  label,
  isSelected,
  onPress,
  theme,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.9, springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, springs.bouncy); }}
      onPress={onPress}
      style={[
        pillStyles.pill,
        {
          backgroundColor: isSelected
            ? theme.semantic.textPrimary + '12'
            : 'transparent',
        },
        animatedStyle,
      ]}
    >
      <Text
        style={[
          pillStyles.pillText,
          {
            color: isSelected
              ? theme.semantic.textPrimary
              : theme.semantic.textSecondary,
            fontWeight: isSelected ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

// ─── Main Chart Component ───────────────────────────────────────

export function RHLineChart({
  data,
  height = 200,
  animated = true,
  onScrub,
  showTimeRange = true,
}: RHLineChartProps) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
  const drawProgress = useSharedValue(animated ? 0 : 1);

  // Filter data by selected time range
  const filteredData = useMemo(
    () => filterDataByRange(data, timeRange),
    [data, timeRange],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // Determine line color based on performance within visible range
  const firstValue = filteredData.length > 0 ? filteredData[0].cumulative : 0;
  const lastValue = filteredData.length > 0 ? filteredData[filteredData.length - 1].cumulative : 0;
  const rangeChange = lastValue - firstValue;
  const lineColor = rangeChange >= 0 ? theme.colors.green[500] : theme.colors.red[500];

  // Chart dimensions
  const chartWidth = containerWidth - PADDING_LEFT - PADDING_RIGHT;
  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM - LABEL_HEIGHT;

  // Compute points
  const { points, zeroY } = useMemo(() => {
    if (filteredData.length === 0 || chartWidth <= 0 || chartHeight <= 0) {
      return { points: [], zeroY: 0 };
    }

    const values = filteredData.map((d) => d.cumulative);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);

    // Add 10% padding
    const range = maxV - minV || 1;
    minV -= range * 0.1;
    maxV += range * 0.1;

    const pts = filteredData.map((d, i) => {
      const x = PADDING_LEFT + (i / Math.max(filteredData.length - 1, 1)) * chartWidth;
      const y = PADDING_TOP + ((maxV - d.cumulative) / (maxV - minV)) * chartHeight;
      return { x, y };
    });

    const zy = PADDING_TOP + ((maxV - 0) / (maxV - minV)) * chartHeight;

    return { points: pts, zeroY: zy };
  }, [filteredData, chartWidth, chartHeight]);

  // Build path strings
  const linePath = useMemo(() => buildBezierPath(points), [points]);
  const fillPath = useMemo(() => {
    if (points.length < 2) return '';
    const bottomY = PADDING_TOP + chartHeight;
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }, [linePath, points, chartHeight]);

  // Path length for draw-in
  const pathLength = useMemo(() => approxPathLength(points), [points]);

  // Animate draw-in
  useEffect(() => {
    if (animated && points.length > 1) {
      drawProgress.value = 0;
      drawProgress.value = withTiming(1, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [animated, points.length, timeRange]);

  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - drawProgress.value),
  }));

  // X-axis labels
  const labelInterval = filteredData.length <= 4 ? 1 : filteredData.length <= 8 ? 2 : filteredData.length <= 14 ? 3 : 4;

  // Touch handling — Robinhood-style scrub
  const handleTouch = useCallback(
    (x: number) => {
      if (points.length === 0 || chartWidth <= 0) return;
      const relativeX = x - PADDING_LEFT;
      const index = Math.round((relativeX / chartWidth) * (filteredData.length - 1));
      const clamped = Math.max(0, Math.min(filteredData.length - 1, index));

      if (clamped !== activeIndex) {
        setActiveIndex(clamped);
        hapticLight();
        // Notify parent of scrub value
        onScrub?.(filteredData[clamped].cumulative, filteredData[clamped].label);
      }
    },
    [points, chartWidth, filteredData, activeIndex, onScrub],
  );

  const handleScrubEnd = useCallback(() => {
    setActiveIndex(null);
    onScrub?.(null, null);
  }, [onScrub]);

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    hapticLight();
    setTimeRange(range);
    setActiveIndex(null);
    onScrub?.(null, null);
  }, [onScrub]);

  // Active scrub label — show date at bottom center during scrub
  const scrubLabel = activeIndex !== null ? filteredData[activeIndex]?.label ?? '' : '';

  // Empty state
  if (filteredData.length < 2) {
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
    <View style={styles.container} onLayout={onLayout}>
      {containerWidth > 0 && (
        <Svg width={containerWidth} height={height}>
          <Defs>
            {/* 3-stop gradient — Robinhood-style: strong top → mid → transparent */}
            <SvgLinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lineColor} stopOpacity="0.28" />
              <Stop offset="0.6" stopColor={lineColor} stopOpacity="0.08" />
              <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          {/* Zero line — subtle baseline reference */}
          {zeroY > PADDING_TOP + 4 && zeroY < PADDING_TOP + chartHeight - 4 && (
            <Line
              x1={PADDING_LEFT}
              y1={zeroY}
              x2={PADDING_LEFT + chartWidth}
              y2={zeroY}
              stroke={theme.semantic.border}
              strokeWidth={0.5}
              strokeDasharray="4 4"
              opacity={0.4}
            />
          )}

          {/* Gradient fill area */}
          <Path d={fillPath} fill="url(#fillGrad)" />

          {/* Main line — 2px Robinhood weight */}
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            animatedProps={animatedLineProps}
          />

          {/* Scrub cursor */}
          {activeIndex !== null && points[activeIndex] && (
            <>
              {/* Vertical hairline */}
              <Line
                x1={points[activeIndex].x}
                y1={PADDING_TOP}
                x2={points[activeIndex].x}
                y2={PADDING_TOP + chartHeight}
                stroke={theme.semantic.textSecondary}
                strokeWidth={0.5}
                opacity={0.4}
              />

              {/* Outer halo ring */}
              <Circle
                cx={points[activeIndex].x}
                cy={points[activeIndex].y}
                r={12}
                fill={lineColor}
                opacity={0.15}
              />

              {/* Inner dot with border */}
              <Circle
                cx={points[activeIndex].x}
                cy={points[activeIndex].y}
                r={5}
                fill={lineColor}
                stroke={theme.semantic.surface}
                strokeWidth={2}
              />
            </>
          )}

          {/* X-axis labels — only when NOT scrubbing */}
          {activeIndex === null && filteredData.map((dp, i) => {
            if (i % labelInterval !== 0 && i !== filteredData.length - 1) return null;
            return (
              <SvgText
                key={dp.month}
                x={points[i]?.x ?? 0}
                y={height - 2}
                fill={theme.semantic.textSecondary}
                fontSize={10}
                fontWeight="400"
                textAnchor="middle"
                opacity={0.6}
              >
                {dp.label}
              </SvgText>
            );
          })}

          {/* Scrub date label — replaces x-axis labels during scrub */}
          {activeIndex !== null && (
            <SvgText
              x={containerWidth / 2}
              y={height - 2}
              fill={theme.semantic.textPrimary}
              fontSize={11}
              fontWeight="600"
              textAnchor="middle"
            >
              {scrubLabel}
            </SvgText>
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
            onPressOut={handleScrubEnd}
          />
        </Svg>
      )}

      {/* Time Range Pills — below chart */}
      {showTimeRange && (
        <Animated.View
          entering={FadeIn.duration(400).delay(600)}
          style={pillStyles.row}
        >
          {(['1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as TimeRange[]).map((range) => (
            <TimeRangePill
              key={range}
              label={range}
              isSelected={timeRange === range}
              onPress={() => handleTimeRangeChange(range)}
              theme={theme}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

const pillStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pillText: {
    fontSize: 12,
  },
});
