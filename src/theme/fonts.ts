import {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from '@expo-google-fonts/geist-mono';

// Passed to expo-font's useFonts in the root layout. Keys are the fontFamily names.
export const fontAssets = {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
};

// Static font files: each weight is its own family, so never rely on fontWeight.
export const fontFamilies = {
  // Secondary details next to a title, e.g. "3 exercises".
  light: 'Geist_300Light',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semiBold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  monoRegular: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
  monoSemiBold: 'GeistMono_600SemiBold',
} as const satisfies Record<string, keyof typeof fontAssets>;
