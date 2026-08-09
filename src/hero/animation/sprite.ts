/**
 * sprite.ts — the sprite atlas is BUILT AT BOOT by replaying the rig
 * (rig-data.ts) onto an offscreen canvas (procedural.ts). The character is
 * 100% math: no image assets, no network fetches, no WebGL/WebGPU — pure
 * Canvas 2D on the CPU. 24fps animation metadata, 60fps interpolation.
 */

import { RIG_FRAMES, RIG_ANIMS, RIG_CELL, RIG_FPS } from './rig-data.js';
import { buildProceduralAtlas } from './procedural.js';

let atlas: HTMLCanvasElement | null = null;

export function loadAtlas(): Promise<void> {
  atlas = buildProceduralAtlas();
  return Promise.resolve();
}

export function getAnims(): Record<string, string[]> {
  return RIG_ANIMS;
}
export function getAnimFps(): number {
  return RIG_FPS;
}
export function getSpriteMode(): 'procedural' {
  return 'procedural';
}

export interface FrameOptions {
  flip?: boolean;
  rotation?: number; // radians
  pivotY?: number;   // rotation pivot relative to the feet anchor (≤ 0)
}

/** draw a rig frame with its feet anchored at (x, yBottom); the 128px cells
    render into the same 64×64 CSS box the physics expect */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  yBottom: number,
  opts: FrameOptions = {},
): void {
  const f = RIG_FRAMES[name];
  if (!f || !atlas) return;
  const pivotY = opts.pivotY ?? 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(yBottom));
  ctx.translate(0, pivotY);
  if (opts.rotation) ctx.rotate(opts.rotation);
  ctx.translate(0, -pivotY);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(atlas, f.x, f.y, RIG_CELL, RIG_CELL, -32, -64, 64, 64);
  ctx.restore();
}
