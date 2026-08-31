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

  const { flip = false, rotation = 0, pivotY = 0, squashX = 1, squashY = 1, alpha = 1 } = opts;
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
    atlas,
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
