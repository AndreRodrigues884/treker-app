export const sizes = {
  // Minimum touch target (Apple HIG 44 pt; Android recommends 48 dp).
  minTouch: 44,
  control: 48,
  chip: 36,
  // Floating action button (Material guidance: 56 dp).
  fab: 56,
  progressBar: 8,
  border: 1,
  // Max content width so screens don't stretch on tablets.
  maxContentWidth: 560,
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

// Lucide icons are stroke-based; one stroke width keeps them consistent.
export const iconStrokeWidth = 2;

export const opacity = {
  pressed: 0.8,
  disabled: 0.4,
} as const;
