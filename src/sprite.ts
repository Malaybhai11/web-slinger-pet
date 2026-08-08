/**
 * sprite.ts — High-performance image-based sprite renderer for Spider-Man.
 * Loads the user's custom sprite sheet (spidey-spritesheet.png), automatically
 * chroma-keys the background to 100% transparent, and renders centered frames.
 */

import { POSES, type FramePose } from './sprite-poses.js';

export const SPRITE_W = 60;
export const SPRITE_H = 100;
export const DISPLAY_SCALE = 0.72; // Scale factor for ~82px pet height

export type PoseName = keyof typeof POSES;

export interface DrawOptions {
  flip?: boolean;
  blink?: boolean;
  eyeDX?: number;
  eyeDY?: number;
  rotation?: number;
  grip?: boolean;
  squashY?: number;
  outline?: boolean;
}

type Ctx = CanvasRenderingContext2D;

let spriteCanvas: HTMLCanvasElement | null = null;
let spriteLoaded = false;

// ── Background Chroma-Key Pre-Processing ────────────────────────────────────

function initSpriteSheet(): void {
  const img = new Image();
  img.src = '/spidey-spritesheet.png';
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    const offscreen = document.createElement('canvas');
    offscreen.width  = img.width;
    offscreen.height = img.height;
    const octx = offscreen.getContext('2d')!;

    octx.drawImage(img, 0, 0);

    // Chroma-key out grey background (RGB ~180, 180, 180)
    const imgData = octx.getImageData(0, 0, img.width, img.height);
    const d = imgData.data;

    // Sample background color at (5, 5)
    const bgR = d[(5 * img.width + 5) * 4 + 0];
    const bgG = d[(5 * img.width + 5) * 4 + 1];
    const bgB = d[(5 * img.width + 5) * 4 + 2];

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      if (diff < 40) {
        d[i + 3] = 0; // Make background transparent
      }
    }

    octx.putImageData(imgData, 0, 0);
    spriteCanvas = offscreen;
    spriteLoaded = true;
  };
}

// Start loading immediately
if (typeof window !== 'undefined') {
  initSpriteSheet();
}

// ── Hand Position Lookup ───────────────────────────────────────────────────

export function getHandPosition(
  pose: PoseName,
  x: number,
  y: number,
  scale: number = DISPLAY_SCALE,
  flip: boolean = false
): { x: number; y: number } {
  const p = POSES[pose] || POSES.IDLE;
  const s = scale;
  const hx = p.handX * s;
  const hy = p.handY * s;
  const localX = flip ? -hx : hx;
  return {
    x: x + localX,
    y: y + hy,
  };
}

// ── Sprite Rendering ───────────────────────────────────────────────────────

export function drawSprite(
  ctx: Ctx,
  poseName: PoseName,
  x: number,
  y: number,
  scale: number = DISPLAY_SCALE,
  opts: DrawOptions = {}
): void {
  const p = POSES[poseName] || POSES.IDLE;
  if (!p) return;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  if (opts.rotation) ctx.rotate(opts.rotation);
  if (opts.squashY !== undefined && opts.squashY !== 1) {
    ctx.scale(1 / Math.sqrt(opts.squashY), opts.squashY);
  }
  if (opts.flip) ctx.scale(-1, 1);

  const drawW = p.w * scale;
  const drawH = p.h * scale;

  // Origin offset based on frame anchors
  const originX = -drawW * p.anchorX;
  const originY = -drawH * p.anchorY;

  if (spriteLoaded && spriteCanvas) {
    ctx.drawImage(
      spriteCanvas,
      p.x, p.y, p.w, p.h,
      originX, originY, drawW, drawH
    );
  } else {
    // Fallback red rectangle placeholder while image loads
    ctx.fillStyle = '#E52521';
    ctx.fillRect(originX, originY, drawW, drawH);
  }

  ctx.restore();
}
