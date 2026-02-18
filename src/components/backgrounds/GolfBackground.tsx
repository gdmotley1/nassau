import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { CourseUndulation } from './CourseUndulation';
import { LinksGrid } from './LinksGrid';
import { FloatingLinks } from './FloatingLinks';

interface GolfBackgroundProps {
  variant?: 'undulation' | 'links' | 'combined' | 'floating' | 'premium';
  intensity?: 'subtle' | 'medium';
  style?: ViewStyle;
  children?: React.ReactNode;
}

const INTENSITY_MAP = {
  subtle: { undulation: 0.7, links: 0.8, floating: 0.8 },
  medium: { undulation: 1.0, links: 1.0, floating: 1.0 },
};

export function GolfBackground({
  variant = 'undulation',
  intensity = 'subtle',
  style,
  children,
}: GolfBackgroundProps) {
  const opacities = INTENSITY_MAP[intensity];

  // When no children, render as absolute background layer
  const containerStyle = children
    ? [styles.container, style]
    : [styles.absoluteBackground, style];

  return (
    <View style={containerStyle}>
      {/* Undulation layer */}
      {(variant === 'undulation' || variant === 'combined') && (
        <CourseUndulation
          variant="augusta"
          opacity={variant === 'combined' ? opacities.undulation * 0.7 : opacities.undulation}
        />
      )}
      {variant === 'premium' && (
        <CourseUndulation variant="augusta" opacity={opacities.undulation * 0.5} />
      )}
      {/* Links grid layer */}
      {(variant === 'links' || variant === 'combined') && (
        <LinksGrid
          opacity={variant === 'combined' ? opacities.links * 0.7 : opacities.links}
        />
      )}
      {/* Floating golf elements layer */}
      {(variant === 'floating' || variant === 'premium') && (
        <FloatingLinks
          opacity={variant === 'premium' ? opacities.floating * 0.7 : opacities.floating}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  absoluteBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
