// The Treker logo's own colours, from assets/brand/treker-logo.svg (the source of truth). Only the
// Logo component and the generated app icons use them; screens use the colours in colors.ts.
export const brand = {
  // The rounded square, top-left to bottom-right.
  backgroundStart: '#0D1F45',
  backgroundEnd: '#060C1C',
  // The chevron, bottom-left to top-right.
  chevronStart: '#2563EB',
  chevronMiddle: '#06B6D4',
  chevronEnd: '#A78BFA',
  // The soft halo behind the chevron.
  halo: '#1D4ED8',
} as const;
