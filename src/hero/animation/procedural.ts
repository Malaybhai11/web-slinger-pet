/**
 * procedural.ts — replays the rig (rig-data.ts) onto an offscreen canvas,
 * building the full sprite atlas at boot. The hero is drawn entirely by math:
 * capsule limbs + mask + wedge eyes with outline passes — identical output to
 * scripts/generate-sprites.py's PNGs. Zero image assets, zero WebGPU, all CPU.
 */

import { RIG, RIG_FRAMES, RIG_CELL, RIG_COLS, type Prim } from './rig-data.js';

const INK = '#0d0a12';

export function buildProceduralAtlas(): HTMLCanvasElement {
  const total = Object.keys(RIG_FRAMES).length;
  const rows = Math.ceil(total / RIG_COLS);
  const cv = document.createElement('canvas');
  cv.width = RIG_COLS * RIG_CELL;
  cv.height = rows * RIG_CELL;
  const ctx = cv.getContext('2d')!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [name, prims] of Object.entries(RIG)) {
    const f = RIG_FRAMES[name];
    if (!f) continue;
    ctx.save();
    ctx.translate(f.x, f.y);
    // outline pass first, then fills (matches the Python renderer exactly)
    for (const p of prims) {
      if (p.t === 'cap') drawCap(ctx, p, p.w + 2.5, INK);
      else if (p.t === 'c') drawDot(ctx, p, p.r + 1.8, INK);
    }
    for (const p of prims) {
      if (p.t === 'cap') drawCap(ctx, p, p.w, p.c);
      else if (p.t === 'c') drawDot(ctx, p, p.r, p.c);
      else drawPoly(ctx, p);
    }
    ctx.restore();
  }
  return cv;
}

type CapPrim = Extract<Prim, { t: 'cap' }>;
type CirclePrim = Extract<Prim, { t: 'c' }>;
type PolyPrim = Extract<Prim, { t: 'p' }>;

function drawCap(ctx: CanvasRenderingContext2D, p: CapPrim, w: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(p.x1, p.y1);
  ctx.lineTo(p.x2, p.y2);
  ctx.stroke();
  ctx.fillStyle = color;
  const r = w / 2;
  ctx.beginPath();
  ctx.arc(p.x1, p.y1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x2, p.y2, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawDot(ctx: CanvasRenderingContext2D, p: CirclePrim, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPoly(ctx: CanvasRenderingContext2D, p: PolyPrim): void {
  ctx.fillStyle = p.c;
  ctx.beginPath();
  ctx.moveTo(p.pts[0][0], p.pts[0][1]);
  for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i][0], p.pts[i][1]);
  ctx.closePath();
  ctx.fill();
}
