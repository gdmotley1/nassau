import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Rect, Circle, Line } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

interface LinksGridProps {
  opacity?: number;
}

export function LinksGrid({ opacity = 1 }: LinksGridProps) {
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const isDark = theme.semantic.surface === theme.colors.dark?.bg;

  const strokeColor = isDark ? theme.colors.teal[500] : theme.colors.gray[300];
  const baseOpacity = isDark ? 0.03 : 0.04;

  return (
    <Svg
      width={width}
      height={height}
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id="linksPattern"
          x="0"
          y="0"
          width="120"
          height="180"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(8)"
        >
          {/* Fairway - thin vertical rectangle */}
          <Rect
            x="45"
            y="20"
            width="30"
            height="120"
            rx="4"
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.5"
            opacity={baseOpacity}
          />
          {/* Green - small circle at top */}
          <Circle
            cx="60"
            cy="15"
            r="10"
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.5"
            opacity={baseOpacity * 1.2}
          />
          {/* Tee box - small rectangle at bottom */}
          <Rect
            x="52"
            y="145"
            width="16"
            height="8"
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.4"
            opacity={baseOpacity * 0.8}
          />
          {/* Hazard boundary - diagonal line */}
          <Line
            x1="10"
            y1="60"
            x2="40"
            y2="100"
            stroke={strokeColor}
            strokeWidth="0.3"
            opacity={baseOpacity * 0.6}
          />
          {/* Secondary rough line */}
          <Line
            x1="80"
            y1="40"
            x2="110"
            y2="90"
            stroke={strokeColor}
            strokeWidth="0.3"
            opacity={baseOpacity * 0.5}
          />
        </Pattern>
      </Defs>
      <Rect width={width} height={height} fill="url(#linksPattern)" />
    </Svg>
  );
}
