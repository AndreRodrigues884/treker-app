// Renders the app icons, splash image and favicon in assets/images from the logo,
// assets/brand/treker-logo.svg (the source of truth). Run after changing the logo:
//   npm run brand:icons
const fs = require('node:fs');
const path = require('node:path');

const { Resvg } = require('@resvg/resvg-js');

const root = path.join(__dirname, '..');

const source = fs.readFileSync(path.join(root, 'assets/brand/treker-logo.svg'), 'utf8');
const out = (name) => path.join(root, 'assets/images', name);

const defs = source.match(/<defs>[\s\S]*<\/defs>/)[0];
const halo = source.match(/<ellipse[^>]*\/>/)[0];
const chevron = source.match(/<path[^>]*\/>/)[0];
const open =
  '<svg viewBox="0 0 400 400" width="400" height="400" fill="none" xmlns="http://www.w3.org/2000/svg">';
const square = '<rect x="0" y="0" width="400" height="400" fill="url(#bg)"/>';

const variants = {
  // Full logo with its rounded corners (splash, favicon).
  rounded: source,
  // Full-bleed square: iOS and Android round the corners themselves.
  square: `${open}${defs}${square}${halo}${chevron}</svg>`,
  // Android adaptive icon layers: the dark background, and the chevron on transparency (it already
  // sits inside the 66% safe zone the launcher never crops).
  background: `${open}${defs}${square}</svg>`,
  foreground: `${open}${defs}${halo}${chevron}</svg>`,
  // Android 13 themed icons: one flat colour, the launcher tints it.
  monochrome: `${open}<path d="M 108 292 L 200 108 L 292 292" stroke="#FFFFFF" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
};

const renders = [
  ['icon.png', 'square', 1024],
  ['android-icon-background.png', 'background', 512],
  ['android-icon-foreground.png', 'foreground', 512],
  ['android-icon-monochrome.png', 'monochrome', 432],
  ['splash-icon.png', 'rounded', 600],
  ['favicon.png', 'rounded', 48],
];

for (const [file, variant, size] of renders) {
  const png = new Resvg(variants[variant], { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
  fs.writeFileSync(out(file), png);
  console.log(`${file} ${size}x${size} (${variant})`);
}
