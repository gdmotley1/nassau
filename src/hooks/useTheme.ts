import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { colors, getSemanticColors, typography, spacing, radii, shadows } from '../theme';
import type { SemanticColors, ColorScheme } from '../theme';

export interface Theme {
  scheme: ColorScheme;
  colors: typeof colors;
  semantic: SemanticColors;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: typeof shadows;
  isDark: boolean;
}

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const scheme: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light';

  return useMemo(
    () => ({
      scheme,
      colors,
      semantic: getSemanticColors(scheme),
      typography,
      spacing,
      radii,
      shadows,
      isDark: scheme === 'dark',
    }),
    [scheme]
  );
}
