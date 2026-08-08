/**
 * effects.ts — lightweight particle system, shadow, and screen shake.
 */

/* ── Particles ────────────────────────────────────────────── */

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string; alpha: number;
  alive: boolean;
}

const POOL: Particle[] = [];
const MAX_PARTICLES = 200;

function alloc(): Particle | null {
  for (const p of POOL) if (!p.alive) return p;
  if (POOL.length >= MAX_PARTICLES) return null;
  const p: Particle = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', alpha: 1, alive: false };
  POOL.push(p);
  return p;
}

export interface EmitOpts {
  x: number; y: number;
  vx?: number; vy?: number;
  vxRange?: number; vyRange?: number;
  life?: number; lifeRange?: number;
  size?: number; sizeRange?: number;
  color?: string;
  alpha?: number;
}

export function emit(n: number, base: EmitOpts): void {
  for (let i = 0; i < n; i++) {
    const p = alloc();
    if (!p) break;
    p.x = base.x;
    p.y = base.y;
    p.vx = (base.vx ?? 0) + (base.vxRange ?? 0) * (Math.random() * 2 - 1);
    p.vy = (base.vy ?? 0) + (base.vyRange ?? 0) * (Math.random() * 2 - 1);
    p.life = (base.life ?? 500) + (base.lifeRange ?? 0) * (Math.random() * 2 - 1);
    p.maxLife = p.life;
    p.size = (base.size ?? 2) + (base.sizeRange ?? 0) * (Math.random() * 2 - 1);
    p.color = base.color ?? '#F2F6FF';
    p.alpha = base.alpha ?? 1;
    p.alive = true;
  }
}

export function updateParticles(dt: number): void {
  for (const p of POOL) {
    if (!p.alive) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.0003 * dt; // subtle gravity
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    const t = p.life / p.maxLife;
    p.alpha = t * (p.alpha > 0 ? 1 : 0);
    p.size *= (0.998 + 0.002 * t); // shrink slowly
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D): void {
  for (const p of POOL) {
    if (!p.alive || p.alpha < 0.01) continue;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    const s = Math.max(1, Math.round(p.size));
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
  ctx.globalAlpha = 1;
}

/* ── Screen Shake ─────────────────────────────────────────── */

let shakeX = 0, shakeY = 0, shakeIntensity = 0, shakeDecay = 0.88;

export function triggerShake(intensity: number, decay = 0.88): void {
  shakeIntensity = intensity;
  shakeDecay = decay;
}

export function applyShake(ctx: CanvasRenderingContext2D, dt: number): void {
  if (shakeIntensity > 0.1) {
    shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeIntensity *= Math.pow(shakeDecay, dt / 16);
    ctx.translate(Math.round(shakeX), Math.round(shakeY));
  } else {
    shakeIntensity = 0;
  }
}

/* ── Shadow ───────────────────────────────────────────────── */

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, petY: number,
  scaleX: number,
): void {
  const height = Math.max(0, groundY - petY);
  const maxH = 200;
  const alpha = Math.max(0.04, 0.2 - (height / maxH) * 0.16);
  const w = 18 * scaleX * (1 + height / maxH * 0.3);
  const h = 4 * (1 - height / maxH * 0.5);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(groundY), w, Math.max(2, h), 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ── Web Line Glow ────────────────────────────────────────── */

export function drawWebLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  progress: number,
): void {
  const ex = x0 + (x1 - x0) * progress;
  const ey = y0 + (y1 - y0) * progress;
  const mx = (x0 + ex) / 2;
  const my = (y0 + ey) / 2 + 5; // increased sag

  // glow pass (wide, faint)
  ctx.strokeStyle = 'rgba(242,246,255,0.12)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // core pass (crisp)
  ctx.strokeStyle = '#F2F6FF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();
}
