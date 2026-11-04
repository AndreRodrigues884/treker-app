import { Text, type TextProps } from 'react-native';

import { colors, maxFontScale, typography, type ColorToken, type TextVariant } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={maxFontScale[variant]}
      style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}
