/**
 * palette.ts — full Spider-Man color palette with shading levels.
 */

export interface SuitColors {
  base: string;
  shadow: string;
  dark: string;
  highlight: string;
}

export interface ShadowTrailColors {
  light: string;
  dark: string;
}

export interface SpiderPalette {
  red: SuitColors;
  blue: SuitColors;
  shadowTrail: ShadowTrailColors;
  black: string;
  blackSoft: string;
  outline: string;
  white: string;
  eyeShadow: string;
  webLine: string;
  skin: string;
}

/** Default Spider-Man palette matching user pixel art */
export const SPIDER_PALETTE: SpiderPalette = {
  red: {
    base: '#E52521',
    shadow: '#9E1212',
    dark: '#680000',
    highlight: '#FF4D4D',
  },
  blue: {
    base: '#1B1E2B',
    shadow: '#12141F',
    dark: '#0A0C14',
    highlight: '#2B3547',
  },
  shadowTrail: {
    light: '#5A7C9F',
    dark: '#3C5673',
  },
  black: '#101117',
  blackSoft: '#1A1C26',
  outline: '#0A0A10',
  white: '#FFFFFF',
  eyeShadow: '#D8E0F0',
  webLine: '#FFFFFF',
  skin: '#E8C8A0',
};

/**
 * Pre-computed CSS color strings for fast fillStyle assignment.
 */
export const CSS = {
  red: SPIDER_PALETTE.red.base,
  redShadow: SPIDER_PALETTE.red.shadow,
  redDark: SPIDER_PALETTE.red.dark,
  redHighlight: SPIDER_PALETTE.red.highlight,
  blue: SPIDER_PALETTE.blue.base,
  blueShadow: SPIDER_PALETTE.blue.shadow,
  blueDark: SPIDER_PALETTE.blue.dark,
  blueHighlight: SPIDER_PALETTE.blue.highlight,
  trailLight: SPIDER_PALETTE.shadowTrail.light,
  trailDark: SPIDER_PALETTE.shadowTrail.dark,
  black: SPIDER_PALETTE.black,
  blackSoft: SPIDER_PALETTE.blackSoft,
  outline: SPIDER_PALETTE.outline,
  white: SPIDER_PALETTE.white,
  eyeShadow: SPIDER_PALETTE.eyeShadow,
  webLine: SPIDER_PALETTE.webLine,
  skin: SPIDER_PALETTE.skin,
} as const;
