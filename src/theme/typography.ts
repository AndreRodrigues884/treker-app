import type { TextStyle } from 'react-native';

import { fontFamilies } from './fonts';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'numeric';

export const typography = {
  display: {
    fontFamily: fontFamilies.bold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  // Times, weights and reps: monospaced with tabular digits so columns line up.
  numeric: {
    fontFamily: fontFamilies.monoMedium,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<TextVariant, TextStyle>;

// Text follows the system font size; only the largest variants are capped so layouts don't break.
export const maxFontScale: Partial<Record<TextVariant, number>> = {
  display: 1.3,
  title: 1.5,
};
