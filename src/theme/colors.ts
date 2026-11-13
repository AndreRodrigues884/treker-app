// Dark mode only in v1, matching the Treker landing page.
export const colors = {
  bg: '#070D1C',
  surface: '#0D1729',
  card: '#0B1426',
  screen: '#0A1222',
  divider: '#16213A',
  line: '#1F2C47',
  lineStrong: '#24324F',

  text: '#EEF2F8',
  textSoft: '#C9D3E3',
  muted: '#9AA8BF',
  dim: '#7D8BA3',
  onAccent: '#04111F',

  gym: '#22D3EE',
  swim: '#A78BFA',
  record: '#FBBF24',
  positive: '#34D399',
  // Amber, for "medium" effort.
  warning: '#FBBF24',
  // ~7:1 contrast on bg, ~6.5:1 on surface.
  danger: '#F87171',
  // Fill of destructive buttons, with white text on it (~4.8:1).
  dangerSolid: '#DC2626',
  onDanger: '#FFFFFF',

  // Translucent accent fills for selected and soft states.
  gymTint: 'rgba(34, 211, 238, 0.14)',
  swimTint: 'rgba(167, 139, 250, 0.14)',
  recordTint: 'rgba(251, 191, 36, 0.14)',
  positiveTint: 'rgba(52, 211, 153, 0.14)',
  warningTint: 'rgba(251, 191, 36, 0.14)',
  dangerTint: 'rgba(248, 113, 113, 0.14)',

  // Chart colours, so each muscle group and each exercise has its own (Statistics).
  chartOrange: '#F97316',
  chartBlue: '#3B82F6',
  chartGreen: '#10B981',
  chartPurple: '#A855F7',
  chartPink: '#EC4899',
  chartCyan: '#06B6D4',
  chartAmber: '#F59E0B',
  chartRed: '#EF4444',
  chartTeal: '#14B8A6',
  chartLime: '#84CC16',
  chartIndigo: '#6366F1',
  chartRose: '#FB7185',
  // The empty part of a bar.
  track: '#24324F',

  // Dims the screen behind a dialog (bg at 80%).
  scrim: 'rgba(7, 13, 28, 0.8)',
} as const;

export type ColorToken = keyof typeof colors;

// The order chart series take their colours in.
export const chartPalette: ColorToken[] = [
  'chartAmber',
  'chartBlue',
  'chartGreen',
  'chartPink',
  'chartPurple',
  'chartOrange',
  'chartCyan',
  'chartRed',
  'chartTeal',
  'chartLime',
  'chartIndigo',
  'chartRose',
];

export type AccentTone = 'gym' | 'swim' | 'record' | 'positive' | 'warning' | 'danger';

export const accentTints: Record<AccentTone, ColorToken> = {
  gym: 'gymTint',
  swim: 'swimTint',
  record: 'recordTint',
  positive: 'positiveTint',
  warning: 'warningTint',
  danger: 'dangerTint',
};
