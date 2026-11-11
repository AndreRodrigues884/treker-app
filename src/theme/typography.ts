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
  // Screen titles.
  title: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  // Section titles and card names.
  heading: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 18,
    lineHeight: 24,
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
