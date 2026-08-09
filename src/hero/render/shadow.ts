/**
 * shadow.ts — soft elliptical ground shadow (PRD §9.1). Sits on the real
 * surface below the hero and shrinks/fades with height above it.
 */

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundTopY: number,
  feetY: number,
  scrollY: number,
  enabled: boolean,
): void {
  if (!enabled) return;
  const h = Math.min(Math.max(groundTopY - feetY, 0), 400);
  const k = Math.max(1 - h / 450, 0.12);
  const gy = groundTopY - scrollY;
  if (gy < -20 || gy > window.innerHeight + 20) return;

  ctx.save();
  ctx.globalAlpha = 0.42 * k;
  ctx.fillStyle = '#000000';
  const rx = 17 * k + 4;
  ctx.beginPath();
  ctx.ellipse(x, gy + 3, rx, rx * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
