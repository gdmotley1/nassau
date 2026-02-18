import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = {
  mega: {
    fontSize: 56,
    fontWeight: '700' as TextStyle['fontWeight'],
    fontFamily,
    letterSpacing: -1.5,
    lineHeight: 64,
  },
  h1: {
    fontSize: 32,
    fontWeight: '700' as TextStyle['fontWeight'],
    fontFamily,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as TextStyle['fontWeight'],
    fontFamily,
    lineHeight: 28,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600' as TextStyle['fontWeight'],
    fontFamily,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    fontFamily,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as TextStyle['fontWeight'],
    fontFamily,
    lineHeight: 18,
  },
  micro: {
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    fontFamily,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },
} as const;

export type TypographyKey = keyof typeof typography;
