import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

interface FloatingLinksProps {
  opacity?: number;
}

// ─── Element Configs (positions as ratios of viewport) ─────────

interface ElementConfig {
  x: number; // ratio 0-1
  y: number; // ratio 0-1
  scale: number;
  rotation: number;
}

// Far layer: distance arcs + crosshair dots
const FAR_ARCS: ElementConfig[] = [
  { x: 0.15, y: 0.20, scale: 1.0, rotation: -12 },
  { x: 0.70, y: 0.55, scale: 0.8, rotation: 20 },
  { x: 0.35, y: 0.80, scale: 0.6, rotation: -5 },
];

const FAR_CROSSHAIRS: ElementConfig[] = [
  { x: 0.85, y: 0.15, scale: 0.7, rotation: 0 },
  { x: 0.10, y: 0.50, scale: 0.5, rotation: 45 },
  { x: 0.55, y: 0.85, scale: 0.6, rotation: 0 },
  { x: 0.90, y: 0.70, scale: 0.4, rotation: 0 },
  { x: 0.40, y: 0.35, scale: 0.5, rotation: 0 },
];

// Mid layer: golf balls + tee markers
const MID_BALLS: ElementConfig[] = [
  { x: 0.25, y: 0.30, scale: 1.0, rotation: 0 },
  { x: 0.75, y: 0.15, scale: 0.7, rotation: 30 },
  { x: 0.50, y: 0.65, scale: 0.85, rotation: -15 },
  { x: 0.12, y: 0.78, scale: 0.6, rotation: 45 },
];

const MID_TEES: ElementConfig[] = [
  { x: 0.60, y: 0.40, scale: 0.9, rotation: 0 },
  { x: 0.20, y: 0.60, scale: 0.7, rotation: 10 },
  { x: 0.85, y: 0.45, scale: 0.6, rotation: -8 },
];

// Near layer: flag pins
const NEAR_FLAGS: ElementConfig[] = [
  { x: 0.30, y: 0.18, scale: 1.0, rotation: 0 },
  { x: 0.70, y: 0.35, scale: 0.8, rotation: 0 },
  { x: 0.50, y: 0.72, scale: 0.9, rotation: 0 },
  { x: 0.15, y: 0.90, scale: 0.6, rotation: 0 },
];

// ─── SVG Element Renderers ─────────────────────────────────────

function renderFlagPin(
  cfg: ElementConfig,
  idx: number,
  cx: number,
  cy: number,
  strokeColor: string,
  baseOpacity: number,
) {
  const s = cfg.scale;
  const poleHeight = 44 * s;
  const flagW = 16 * s;
  const flagH = 11 * s;
  return (
    <G key={`flag-${idx}`} opacity={baseOpacity} transform={`translate(${cx}, ${cy}) rotate(${cfg.rotation})`}>
      {/* Pole */}
      <Line x1={0} y1={0} x2={0} y2={-poleHeight} stroke={strokeColor} strokeWidth={1.0 * s} />
      {/* Pennant */}
      <Path
        d={`M 0 ${-poleHeight} L ${flagW} ${-poleHeight + flagH * 0.4} L 0 ${-poleHeight + flagH} Z`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={0.8 * s}
      />
      {/* Ground dot */}
      <Circle cx={0} cy={2} r={2.5 * s} fill="none" stroke={strokeColor} strokeWidth={0.7 * s} />
    </G>
  );
}

function renderGolfBall(
  cfg: ElementConfig,
  idx: number,
  cx: number,
  cy: number,
  strokeColor: string,
  baseOpacity: number,
) {
  const r = 10 * cfg.scale;
  return (
    <G key={`ball-${idx}`} opacity={baseOpacity} transform={`translate(${cx}, ${cy}) rotate(${cfg.rotation})`}>
      <Circle cx={0} cy={0} r={r} fill="none" stroke={strokeColor} strokeWidth={0.8 * cfg.scale} />
      {/* Dimple arc */}
      <Path
        d={`M ${-r * 0.5} ${-r * 0.3} Q ${0} ${-r * 0.7} ${r * 0.5} ${-r * 0.3}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={0.5 * cfg.scale}
      />
    </G>
  );
}

function renderTeeMarker(
  cfg: ElementConfig,
  idx: number,
  cx: number,
  cy: number,
  strokeColor: string,
  baseOpacity: number,
) {
  const s = cfg.scale;
  return (
    <G key={`tee-${idx}`} opacity={baseOpacity * 0.9} transform={`translate(${cx}, ${cy}) rotate(${cfg.rotation})`}>
      {/* Horizontal top */}
      <Line x1={-8 * s} y1={0} x2={8 * s} y2={0} stroke={strokeColor} strokeWidth={0.8 * s} />
      {/* Vertical stem */}
      <Line x1={0} y1={0} x2={0} y2={12 * s} stroke={strokeColor} strokeWidth={0.8 * s} />
    </G>
  );
}

function renderDistanceArc(
  cfg: ElementConfig,
  idx: number,
  cx: number,
  cy: number,
  strokeColor: string,
  baseOpacity: number,
) {
  const s = cfg.scale;
  const arcRadius = 90 * s;
  return (
    <G key={`arc-${idx}`} opacity={baseOpacity * 0.7} transform={`translate(${cx}, ${cy}) rotate(${cfg.rotation})`}>
      <Path
        d={`M ${-arcRadius} 0 Q ${-arcRadius * 0.5} ${-arcRadius * 0.4} 0 ${-arcRadius * 0.15} Q ${arcRadius * 0.5} ${arcRadius * 0.1} ${arcRadius} 0`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={0.7 * s}
        strokeDasharray={`${6 * s} ${8 * s}`}
      />
    </G>
  );
}

function renderCrosshair(
  cfg: ElementConfig,
  idx: number,
  cx: number,
  cy: number,
  strokeColor: string,
  baseOpacity: number,
) {
  const s = cfg.scale;
  const arm = 7 * s;
  return (
    <G key={`cross-${idx}`} opacity={baseOpacity * 0.8} transform={`translate(${cx}, ${cy}) rotate(${cfg.rotation})`}>
      <Line x1={-arm} y1={0} x2={arm} y2={0} stroke={strokeColor} strokeWidth={0.6 * s} />
      <Line x1={0} y1={-arm} x2={0} y2={arm} stroke={strokeColor} strokeWidth={0.6 * s} />
      <Circle cx={0} cy={0} r={2.5 * s} fill="none" stroke={strokeColor} strokeWidth={0.5 * s} />
    </G>
  );
}

// ─── Component ─────────────────────────────────────────────────

export function FloatingLinks({ opacity = 1 }: FloatingLinksProps) {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const isDark = theme.semantic.surface === theme.colors.dark?.bg;

  const strokeColor = isDark ? theme.colors.teal[500] : theme.colors.gray[300];
  const baseOpacity = isDark ? 0.12 : 0.08;

  // ─── Shared values for 3 parallax layers ───
  const farTranslateX = useSharedValue(0);
  const farTranslateY = useSharedValue(0);
  const midTranslateX = useSharedValue(0);
  const midTranslateY = useSharedValue(0);
  const nearTranslateX = useSharedValue(0);
  const nearTranslateY = useSharedValue(0);
  const nearBob = useSharedValue(0);

  React.useEffect(() => {
    // Far layer: slow diagonal drift
    farTranslateX.value = withRepeat(
      withTiming(width * 0.04, { duration: 45000, easing: Easing.linear }),
      -1,
      true,
    );
    farTranslateY.value = withRepeat(
      withTiming(height * 0.02, { duration: 38000, easing: Easing.linear }),
      -1,
      true,
    );

    // Mid layer: gentle upward drift
    midTranslateX.value = withRepeat(
      withTiming(-width * 0.03, { duration: 30000, easing: Easing.linear }),
      -1,
      true,
    );
    midTranslateY.value = withRepeat(
      withTiming(-height * 0.025, { duration: 35000, easing: Easing.linear }),
      -1,
      true,
    );

    // Near layer: drift left + gentle bob
    nearTranslateX.value = withRepeat(
      withTiming(-width * 0.05, { duration: 20000, easing: Easing.linear }),
      -1,
      true,
    );
    nearTranslateY.value = withRepeat(
      withTiming(height * 0.015, { duration: 25000, easing: Easing.linear }),
      -1,
      true,
    );
    nearBob.value = withRepeat(
      withTiming(6, { duration: 8000, easing: Easing.linear }),
      -1,
      true,
    );
  }, [width, height]);

  const farStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: farTranslateX.value },
      { translateY: farTranslateY.value },
    ],
  }));

  const midStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: midTranslateX.value },
      { translateY: midTranslateY.value },
    ],
  }));

  const nearStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: nearTranslateX.value },
      { translateY: nearTranslateY.value + nearBob.value },
    ],
  }));

  // ─── Compute absolute positions from ratios ───
  const elements = useMemo(() => ({
    farArcs: FAR_ARCS.map(c => ({ ...c, cx: c.x * width, cy: c.y * height })),
    farCrosshairs: FAR_CROSSHAIRS.map(c => ({ ...c, cx: c.x * width, cy: c.y * height })),
    midBalls: MID_BALLS.map(c => ({ ...c, cx: c.x * width, cy: c.y * height })),
    midTees: MID_TEES.map(c => ({ ...c, cx: c.x * width, cy: c.y * height })),
    nearFlags: NEAR_FLAGS.map(c => ({ ...c, cx: c.x * width, cy: c.y * height })),
  }), [width, height]);

  return (
    <>
      {/* Far layer — distance arcs + crosshairs */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }, farStyle]} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {elements.farArcs.map((el, i) =>
            renderDistanceArc(el, i, el.cx, el.cy, strokeColor, baseOpacity),
          )}
          {elements.farCrosshairs.map((el, i) =>
            renderCrosshair(el, i, el.cx, el.cy, strokeColor, baseOpacity),
          )}
        </Svg>
      </Animated.View>

      {/* Mid layer — golf balls + tee markers */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }, midStyle]} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {elements.midBalls.map((el, i) =>
            renderGolfBall(el, i, el.cx, el.cy, strokeColor, baseOpacity),
          )}
          {elements.midTees.map((el, i) =>
            renderTeeMarker(el, i, el.cx, el.cy, strokeColor, baseOpacity),
          )}
        </Svg>
      </Animated.View>

      {/* Near layer — flag pins */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }, nearStyle]} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {elements.nearFlags.map((el, i) =>
            renderFlagPin(el, i, el.cx, el.cy, strokeColor, baseOpacity),
          )}
        </Svg>
      </Animated.View>
    </>
  );
}
