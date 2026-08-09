/**
 * web-line.ts — web rendering (PRD §4.3): 2px semi-transparent white over a
 * 1px blue edge glow, with catenary sag and a slight wind oscillation.
 */

import { SWING_MAX } from '../physics/forces.js';
import type { MissShot } from '../character/web-shoot.js';

export function drawWebLine(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  hx: number,
  hy: number,
  scrollY: number,
  timeMs: number,
): void {
  const ayv = ay - scrollY;
  const hyv = hy - scrollY;
  const r = Math.hypot(hx - ax, hyv - ayv);
  // sag grows with slack + a breeze (PRD §4.3)
  const sag = r * 0.08 * Math.min(1, r / SWING_MAX) + Math.sin(timeMs / 160) * 1.5;
  const mx = (ax + hx) / 2;
  const my = (ayv + hyv) / 2 + sag;

  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(47, 95, 179, 0.5)'; // blue edge glow
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax, ayv);
  ctx.quadraticCurveTo(mx, my, hx, hyv);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(242, 246, 255, 0.92)'; // 2px white core
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax, ayv);
  ctx.quadraticCurveTo(mx, my, hx, hyv);
  ctx.stroke();

  // anchor splat where the web sticks
  ctx.fillStyle = 'rgba(242, 246, 255, 0.9)';
  ctx.fillRect(ax - 2, ayv - 2, 4, 4);
}

/** missed shot: line fires out and retracts in 0.3s (PRD §4.4) */
export function drawMiss(ctx: CanvasRenderingContext2D, miss: MissShot, scrollY: number): void {
  const ph = miss.t < 0.5 ? miss.t * 2 : (1 - miss.t) * 2;
  const ex = miss.x0 + (miss.x1 - miss.x0) * ph;
  const ey = miss.y0 + (miss.y1 - miss.y0) * ph;
  ctx.strokeStyle = 'rgba(242, 246, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(miss.x0, miss.y0 - scrollY);
  ctx.lineTo(ex, ey - scrollY);
  ctx.stroke();
}

/** aim hint: dotted trajectory, 0.3 opacity (PRD §4.4) */
export function drawAim(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  tx: number,
  ty: number,
  scrollY: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#F2F6FF';
  const dx = tx - hx;
  const dy = ty - hy;
  const dist = Math.hypot(dx, dy);
  const dots = Math.min(12, Math.floor(dist / 18));
  for (let i = 1; i <= dots; i++) {
    const t = i / (dots + 1);
    ctx.fillRect(hx + dx * t - 1.5, hy + dy * t - scrollY - 1.5, 3, 3);
  }
  ctx.restore();
}
