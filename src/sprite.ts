/**
 * sprite.ts — High-performance image-based sprite renderer for Spider-Man.
 * Uses cached offscreen canvas from SpriteSheetLoader and renders deterministic frames.
 */

import { POSES, type FramePose } from './sprite-poses.js';
import { SpriteSheetLoader } from './loader.js';

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

// Pre-init sprite sheet loader
SpriteSheetLoader.getInstance().load().catch((err) => {
  console.error('Failed to pre-load sprite sheet:', err);
});

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
  opts: DrawOptions = {},
  customCanvas?: HTMLCanvasElement | null
): void {
  const spriteCanvas = customCanvas || SpriteSheetLoader.getInstance().getCanvas();
  if (!spriteCanvas) {
    // Canvas is still loading; do not render invalid/empty frame or red placeholder
    return;
  }

  const p: FramePose = POSES[poseName] || POSES.IDLE;
  if (!p) return;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));

  // Subtle eye-tracking offset (shift sprite toward cursor direction)
  const eyeOffsetX = Math.round((opts.eyeDX ?? 0) * 1.5);
  const eyeOffsetY = Math.round((opts.eyeDY ?? 0) * 0.8);
  ctx.translate(eyeOffsetX, eyeOffsetY);

  if (opts.rotation) ctx.rotate(opts.rotation);
  if (opts.squashY !== undefined && opts.squashY !== 1) {
    ctx.scale(1 / Math.sqrt(opts.squashY), opts.squashY);
  }
  if (opts.flip) ctx.scale(-1, 1);

  const drawW = Math.round(p.w * scale);
  const drawH = Math.round(p.h * scale);

  // Origin offset based on frame anchors
  const originX = Math.round(-drawW * p.anchorX);
  const originY = Math.round(-drawH * p.anchorY);

  ctx.drawImage(
    spriteCanvas,
    p.x, p.y, p.w, p.h,
    originX, originY, drawW, drawH
  );

  ctx.restore();
}
