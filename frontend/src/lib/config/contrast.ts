/** --background in dark mode (globals.css), the surface primary-coloured text sits on. */
const DARK_BACKGROUND: [number, number, number] = [2, 8, 23];
const MIN_CONTRAST = 4.5;

const hexToRgb = (hex: string): [number, number, number] | null => {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null;
};

const luminance = (rgb: [number, number, number]): number => {
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (a: [number, number, number], b: [number, number, number]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const toHex = (rgb: [number, number, number]): string =>
  `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

/**
 * The dark-mode primary comes from site config and may be too dark to read, as with the
 * #615c00 migration default (2.9:1). Mix it towards white until it reaches 4.5:1,
 * keeping the configured colour untouched when it already passes.
 */
export const ensureDarkModeContrast = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  for (let mix = 0; mix <= 1; mix += 0.02) {
    const candidate = rgb.map((value) => value + (255 - value) * mix) as [number, number, number];
    if (contrastRatio(candidate, DARK_BACKGROUND) >= MIN_CONTRAST) {
      return mix === 0 ? hex : toHex(candidate);
    }
  }
  return '#ffffff';
};
