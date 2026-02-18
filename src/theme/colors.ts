export const colors = {
  // Core palette
  green: {
    500: '#00C805',
    400: '#34D639',
    100: '#E6FAE7',
    900: '#006B03',
  },
  red: {
    500: '#FF5000',
    400: '#FF7340',
    100: '#FFF0EB',
    900: '#8B2B00',
  },
  teal: {
    500: '#00D4AA',
    400: '#33DDBB',
    100: '#E6FBF6',
    700: '#009977',
  },

  // Light mode neutrals
  white: '#FFFFFF',
  gray: {
    50: '#F9F9F9',
    100: '#F2F2F7',
    300: '#D1D1D6',
    500: '#8E8E93',
    700: '#48484A',
    900: '#1C1C1E',
  },

  // Dark mode neutrals
  dark: {
    bg: '#000000',
    card: '#1C1C1E',
    elevated: '#2C2C2E',
    border: '#38383A',
    text: '#FFFFFF',
  },
} as const;

export type ColorScheme = 'light' | 'dark';

export const getSemanticColors = (scheme: ColorScheme) => ({
  surface: scheme === 'light' ? colors.white : colors.dark.bg,
  card: scheme === 'light' ? colors.gray[50] : colors.dark.card,
  elevated: scheme === 'light' ? colors.white : colors.dark.elevated,
  textPrimary: scheme === 'light' ? colors.gray[900] : colors.dark.text,
  textSecondary: colors.gray[500],
  border: scheme === 'light' ? colors.gray[100] : colors.dark.border,
  moneyPositive: colors.green[500],
  moneyNegative: colors.red[500],
  moneyZero: colors.gray[500],
  accent: colors.teal[500],
  accentPressed: colors.teal[400],
  inputBackground: scheme === 'light' ? colors.gray[100] : colors.dark.card,
});

export type SemanticColors = ReturnType<typeof getSemanticColors>;
