/**
 * sprite.ts — HYBRID sprite system.
 *
 *  • Every state (idle / run / jump / land / swing / fall / cling / crouch)
 *    is drawn by the procedural rig: rig-data.ts is replayed onto an
 *    offscreen canvas at boot (procedural.ts) — zero image fetches.
 *  • WALKING uses real art: the 18 frames in /assets/walk-sheet.png,
 *    extracted from the hand-drawn strip by scripts/extract-walk.py
 *    (`npm run sprites:walk`). If that PNG is missing, the rig's own walk
 *    cycle takes over automatically, so the engine always runs.
 *
 * Pure Canvas 2D on the CPU — no WebGL/WebGPU. 24fps animation metadata,
 * 60fps physics interpolation.
 */

import { RIG_FRAMES, RIG_ANIMS, RIG_CELL, RIG_FPS } from './rig-data.js';
import { buildProceduralAtlas } from './procedural.js';
import {
  WALK_ART_URL,
  WALK_ART_CELL,
  WALK_ART_FRAMES,
  WALK_ART_ANIM,
} from './walk-art-data.js';

let atlas: HTMLCanvasElement | null = null;
let walkArt: HTMLImageElement | null = null;

export function loadAtlas(): Promise<void> {
  atlas = buildProceduralAtlas();
  // the real walk art is optional: resolve either way, never hang the boot
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      walkArt = img;
      resolve();
    };
    img.onerror = () => {
      walkArt = null;
      resolve();
    };
    img.src = WALK_ART_URL;
  });
}

export function getAnims(): Record<string, string[]> {
  // dynamic: the 18 art frames replace the rig's 8 procedural walk frames
  // as soon as the walk sheet is loaded
  if (walkArt) return { ...RIG_ANIMS, walk: WALK_ART_ANIM };
  return RIG_ANIMS;
}
export function getAnimFps(): number {
  return RIG_FPS;
}
export function getSpriteMode(): 'art+rig' | 'procedural' {
  return walkArt ? 'art+rig' : 'procedural';
}

export interface FrameOptions {
  flip?: boolean;
  rotation?: number; // radians
  pivotY?: number;   // rotation pivot relative to the feet anchor (≤ 0)
}

/** draw a frame with its feet anchored at (x, yBottom); the 128px cells
    render into the same 64×64 CSS box the physics expect. Real walk art
    wins over the rig whenever it is loaded. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  yBottom: number,
  opts: FrameOptions = {},
): void {
  const pivotY = opts.pivotY ?? 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(yBottom));
  ctx.translate(0, pivotY);
  if (opts.rotation) ctx.rotate(opts.rotation);
  ctx.translate(0, -pivotY);
  if (opts.flip) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  if (walkArt) {
    const wa = WALK_ART_FRAMES[name];
    if (wa) {
      ctx.drawImage(
        walkArt,
        wa.x, wa.y, WALK_ART_CELL, WALK_ART_CELL,
        -32, -64, 64, 64,
      );
      ctx.restore();
      return;
    }
  }
  const f = RIG_FRAMES[name];
  if (f && atlas) {
    ctx.drawImage(atlas, f.x, f.y, RIG_CELL, RIG_CELL, -32, -64, 64, 64);
  }
  ctx.restore();
}
