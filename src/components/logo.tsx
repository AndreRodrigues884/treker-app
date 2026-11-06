import { useId } from 'react';
import Svg, {
  Defs,
  Ellipse,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { brand } from '@/theme';

export type LogoProps = {
  // Width and height in points.
  size: number;
  // Read by screen readers. Leave it out when the name "Treker" is already written next to it.
  accessibilityLabel?: string;
};

/**
 * The Treker logo: the rising chevron on the dark rounded square. Drawn from the same shapes as
 * assets/brand/treker-logo.svg (the source of truth; the app icons are generated from it), so it
 * stays sharp at any size.
 */
export function Logo({ size, accessibilityLabel }: LogoProps) {
  // Gradient and filter ids are global in an SVG document; unique ones let several logos coexist.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bg = `bg${id}`;
  const chevron = `chevron${id}`;
  const glow = `glow${id}`;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={accessibilityLabel === undefined}
      importantForAccessibility={accessibilityLabel === undefined ? 'no-hide-descendants' : 'yes'}
    >
      <Defs>
        <LinearGradient id={bg} x1="0" y1="0" x2="400" y2="400" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor={brand.backgroundStart} />
          <Stop offset="100%" stopColor={brand.backgroundEnd} />
        </LinearGradient>
        <LinearGradient
          id={chevron}
          x1="108"
          y1="288"
          x2="292"
          y2="108"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor={brand.chevronStart} />
          <Stop offset="50%" stopColor={brand.chevronMiddle} />
          <Stop offset="100%" stopColor={brand.chevronEnd} />
        </LinearGradient>
        <Filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <FeGaussianBlur stdDeviation="14" result="blur" />
          <FeMerge>
            <FeMergeNode in="blur" />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      <Rect x="0" y="0" width="400" height="400" rx="88" fill={`url(#${bg})`} />
      <Rect
        x="1"
        y="1"
        width="398"
        height="398"
        rx="87"
        fill="none"
        stroke={`url(#${chevron})`}
        strokeWidth="1"
        opacity={0.2}
      />
      <Ellipse
        cx="200"
        cy="200"
        rx="130"
        ry="110"
        fill={brand.halo}
        opacity={0.1}
        filter={`url(#${glow})`}
      />
      <Path
        d="M 108 292 L 200 108 L 292 292"
        stroke={`url(#${chevron})`}
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter={`url(#${glow})`}
      />
    </Svg>
  );
}
