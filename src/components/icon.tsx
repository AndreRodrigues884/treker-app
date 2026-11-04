import type { LucideIcon } from 'lucide-react-native';

import { colors, iconSizes, iconStrokeWidth, type ColorToken } from '@/theme';

export type { LucideIcon };

export type IconProps = {
  icon: LucideIcon;
  size?: keyof typeof iconSizes;
  color?: ColorToken;
};

// The only way to render icons: Lucide stroke icons with one stroke width. Decorative by
// default; the surrounding control carries the accessible label.
export function Icon({ icon: Glyph, size = 'md', color = 'text' }: IconProps) {
  return (
    <Glyph
      size={iconSizes[size]}
      color={colors[color]}
      strokeWidth={iconStrokeWidth}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
