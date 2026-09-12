/**
 * sprite.ts — the sprite sheet and the one function that draws a frame.
 *
 * Every frame lives in `public/assets/hero-atlas.png`, built by
 * `npm run sprites` from real PixelLab art. Frames are pre-anchored on the
 * character's feet inside a fixed cell (see tools/build-atlas.mjs), so drawing
 * any clip in any state is a single blit with no per-clip fudge factors.
 *
 * Two rules keep it looking like pixel art rather than a blurry photo of pixel
 * art, and both were broken in the previous renderer:
 *   1. `imageSmoothingEnabled = false` on every context that touches the atlas
 *   2. destinations snapped to whole *device* pixels, not CSS pixels — on a
 *      dpr-2 screen a half-CSS-pixel offset is a real, visible blurred edge
 */

import { ATLAS_URL, CELL, ANCHOR_X, ANCHOR_Y, FRAMES } from './atlas-data.js';

/** Integer upscale of the source art. 1x is ~47px tall; 2x reads well on a page. */
export const SCALE = 2;

let atlas: HTMLImageElement | null = null;
let failed = false;
let dpr = 1;
let symbioteAtlas: HTMLCanvasElement | null = null;

/**
 * Builds the "symbiote" recolor of the atlas — a runtime palette swap, not new
 * art. The source palette is small and unblended (pixel art, no anti-aliasing:
 * 48 distinct colours across the whole sheet), so a per-pixel classification
 * into red-dominant / blue-dominant / white / black is exact, not a guess.
 * Red (the mask and torso) and blue (the legs) both crush down toward a near-
 * black purple, with per-pixel luminance preserved as brightness — so the
 * shading already baked into the art still reads as shading, just inked out.
 * White (the eyes) and black (the outlines) are left alone; Venom's eyes are
 * white too, so this needs nothing extra to read as a rage-mode costume swap.
 * Computed once, lazily, and cached — every subsequent frame is a plain blit.
 */
function buildSymbioteAtlas(): HTMLCanvasElement | null {
  if (!atlas) return null;
  const w = atlas.naturalWidth || atlas.width;
  const h = atlas.naturalHeight || atlas.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.imageSmoothingEnabled = false;
  c.drawImage(atlas, 0, 0);
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 10) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if ((r > 190 && g > 190 && b > 190) || (r < 40 && g < 40 && b < 40)) continue;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (r >= g && r >= b) {
      d[i] = 10 + lum * 0.22;
      d[i + 1] = 6 + lum * 0.1;
      d[i + 2] = 16 + lum * 0.3;
    } else {
      d[i] = 6 + lum * 0.08;
      d[i + 1] = 6 + lum * 0.08;
      d[i + 2] = 12 + lum * 0.28;
    }
  }
  c.putImageData(img, 0, 0);
  return canvas;
}

/** Lazily built and cached — call freely, the recolor only runs once. */
export function getSymbioteAtlas(): HTMLCanvasElement | HTMLImageElement | null {
  if (!symbioteAtlas) symbioteAtlas = buildSymbioteAtlas();
  return symbioteAtlas ?? atlas;
}

export function setPixelRatio(v: number): void {
  dpr = v;
}

export function loadAtlas(): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { atlas = img; resolve(); };
    img.onerror = () => {
      failed = true;
      // Loud on purpose. There is no procedural fallback any more — a missing
      // atlas means `npm run sprites` was never run, and silently drawing
      // nothing is how the old build shipped a stickman for months.
      console.error(
        `[hero] could not load ${ATLAS_URL}. Run \`npm run sprites\` to build it.`,
      );
      resolve();
    };
    img.src = ATLAS_URL;
  });
}

export function getSpriteMode(): 'atlas' | 'missing' {
  return atlas ? 'atlas' : 'missing';
}

export function isReady(): boolean {
  return atlas !== null;
}

export function hasFrame(key: string): boolean {
  return key in FRAMES;
}

export interface DrawOptions {
  /** mirror horizontally — the whole westward half of the art */
  flip?: boolean;
  /** radians, applied about the pivot */
  rotation?: number;
  /** rotation pivot in CSS px above the feet (negative is up) */
  pivotY?: number;
  /** squash and stretch, 1 = neutral. Scaled about the feet. */
  squashX?: number;
  squashY?: number;
  /** overall opacity */
  alpha?: number;
  /** draw from the recolored (symbiote) atlas instead of the real one */
  symbiote?: boolean;
}

/** Snap a CSS-pixel coordinate to a whole device pixel. */
const snap = (v: number): number => Math.round(v * dpr) / dpr;

/**
 * Draw `key` with the character's feet at (x, yBottom) in CSS pixels.
 * Returns false if the frame or the atlas is missing.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  yBottom: number,
  opts: DrawOptions = {},
): boolean {
  const f = FRAMES[key];
  if (!f || !atlas) return false;

  const { flip = false, rotation = 0, pivotY = 0, squashX = 1, squashY = 1, alpha = 1, symbiote = false } = opts;
  const src = symbiote ? getSymbioteAtlas() : atlas;
  if (!src) return false;
  const size = CELL * SCALE;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (alpha !== 1) ctx.globalAlpha = alpha;

  // land the feet on a whole device pixel before any rotation or scaling
  ctx.translate(snap(x), snap(yBottom));

  if (rotation) {
    ctx.translate(0, pivotY);
    ctx.rotate(rotation);
    ctx.translate(0, -pivotY);
  }
  if (squashX !== 1 || squashY !== 1) ctx.scale(squashX, squashY);
  if (flip) ctx.scale(-1, 1);

  ctx.drawImage(
    src,
    f.x, f.y, CELL, CELL,
    -ANCHOR_X * SCALE, -ANCHOR_Y * SCALE, size, size,
  );
  ctx.restore();
  return true;
}

/** True once we know the atlas will never arrive, so callers can warn once. */
export function loadFailed(): boolean {
  return failed;
}
