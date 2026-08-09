/**
 * sprite.ts — sprite atlas loader + frame renderer (PRD §3.1).
 *
 * Dual-mode:
 *  1. ART — the real hand-drawn frames extracted from the reference sheets,
 *     served from /assets/hero-sheet.png (128px cells, 24fps metadata)
 *  2. PIXEL — the embedded base64 pixel atlas (64px cells), used whenever the
 *     art PNG isn't available (e.g. a fresh git clone before `npm run sprites`)
 *
 * Pure Canvas 2D — no WebGL, no WebGPU. Runs on any CPU.
 */

import {
  ATLAS_B64,
  FRAMES as PIX_FRAMES,
  ANIMS as PIX_ANIMS,
  CELL as PIX_CELL,
  ANIM_FPS as PIX_FPS,
} from './sprite-data.js';
import {
  ART_URL,
  ART_FRAMES,
  ART_ANIMS,
  ART_CELL,
  ART_FPS,
} from './sprite-data-art.js';

type FrameMap = Record<string, { x: number; y: number }>;

let atlas: HTMLImageElement | null = null;
let frames: FrameMap = PIX_FRAMES;
let anims: Record<string, string[]> = PIX_ANIMS;
let cell = PIX_CELL;
let animFps = PIX_FPS;
let mode: 'art' | 'pixel' = 'pixel';

export function loadAtlas(): Promise<void> {
  return new Promise((resolve) => {
    const art = new Image();
    art.onload = () => {
      atlas = art;
      frames = ART_FRAMES;
      anims = ART_ANIMS;
      cell = ART_CELL;
      animFps = ART_FPS; // 24fps — smooth, per spec
      mode = 'art';
      resolve();
    };
    art.onerror = () => {
      const fb = new Image();
      fb.onload = () => {
        atlas = fb;
        resolve();
      };
      fb.onerror = () => resolve(); // headless-safe: renderer just skips frames
      fb.src = 'data:image/png;base64,' + ATLAS_B64;
    };
    art.src = ART_URL;
  });
}

export function getAnims(): Record<string, string[]> {
  return anims;
}
export function getAnimFps(): number {
  return animFps;
}
export function getSpriteMode(): 'art' | 'pixel' {
  return mode;
}

export interface FrameOptions {
  flip?: boolean;
  rotation?: number; // radians
  pivotY?: number;   // rotation pivot relative to the feet anchor (≤ 0)
}

/** draw a frame with its feet anchored at (x, yBottom); both atlas cell sizes
    render into the same 64×64 CSS box, so physics and hitboxes never change */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  yBottom: number,
  opts: FrameOptions = {},
): void {
  const f = frames[name];
  if (!f || !atlas) return;
  const pivotY = opts.pivotY ?? 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(yBottom));
  ctx.translate(0, pivotY);
  if (opts.rotation) ctx.rotate(opts.rotation);
  ctx.translate(0, -pivotY);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true; // real art wants smooth sampling (still CPU-side)
  ctx.drawImage(atlas, f.x, f.y, cell, cell, -32, -64, 64, 64);
  ctx.restore();
}
