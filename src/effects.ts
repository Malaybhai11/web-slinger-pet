/**
 * effects.ts — Lightweight particle system, shadow, screen shake,
 * web glow lines, and SPIDEY_DEBUG diagnostic HUD overlay.
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
const MAX_PARTICLES = 150;

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
    p.life = (base.life ?? 400) + (base.lifeRange ?? 0) * (Math.random() * 2 - 1);
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
    p.vy += 0.0003 * dt;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    const t = p.life / p.maxLife;
    p.alpha = t;
    p.size *= (0.998 + 0.002 * t);
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  for (const p of POOL) {
    if (!p.alive || p.alpha < 0.01) continue;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    const s = Math.max(1, Math.round(p.size));
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
  ctx.restore();
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
  ctx.save();
  const height = Math.max(0, groundY - petY);
  const maxH = 200;
  const alpha = Math.max(0.04, 0.2 - (height / maxH) * 0.16);
  const w = 18 * scaleX * (1 + height / maxH * 0.3);
  const h = 4 * (1 - height / maxH * 0.5);
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(Math.round(x), Math.round(groundY), w, Math.max(2, h), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ── Web Line Glow ────────────────────────────────────────── */

export function drawWebLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  progress: number,
): void {
  ctx.save();
  const ex = x0 + (x1 - x0) * progress;
  const ey = y0 + (y1 - y0) * progress;
  const mx = (x0 + ex) / 2;
  const my = (y0 + ey) / 2 + 5;

  ctx.strokeStyle = 'rgba(242,246,255,0.12)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  ctx.strokeStyle = '#F2F6FF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();
  ctx.restore();
}

/* ── SPIDEY_DEBUG HUD Overlay ──────────────────────────────── */

export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  info: {
    state: string;
    authority: string;
    screenX: number;
    screenY: number;
    vx: number;
    vy: number;
    surfaces: Array<{ worldX: number; worldY: number; width: number; height: number; type: string }>;
    targetX?: number;
    targetY?: number;
    fps: number;
  },
): void {
  ctx.save();
  const scrollY = window.scrollY;

  // 1. Draw Surface Bounds & Types
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  for (const s of info.surfaces) {
    const sy = s.worldY - scrollY;
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.6)';
    ctx.strokeRect(s.worldX, sy, s.width, s.height);
    ctx.fillStyle = 'rgba(0, 230, 118, 0.8)';
    ctx.fillText(`${s.type}`, s.worldX + 2, sy + 10);
  }

  // 2. Character Collider & Velocity Vector
  ctx.strokeStyle = 'rgba(255, 45, 85, 0.9)';
  ctx.strokeRect(info.screenX - 16, info.screenY - 50, 32, 50);

  // Velocity arrow
  ctx.strokeStyle = '#FFCC00';
  ctx.beginPath();
  ctx.moveTo(info.screenX, info.screenY - 25);
  ctx.lineTo(info.screenX + info.vx * 5, info.screenY - 25 + info.vy * 5);
  ctx.stroke();

  // Target line
  if (info.targetX !== undefined && info.targetY !== undefined) {
    const targetSy = info.targetY - scrollY;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(info.screenX, info.screenY - 25);
    ctx.lineTo(info.targetX, targetSy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(info.targetX - 3, targetSy - 3, 6, 6);
  }

  // 3. Top-Left HUD Badge
  ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
  ctx.fillRect(12, 12, 210, 85);
  ctx.strokeStyle = 'rgba(229, 37, 33, 0.8)';
  ctx.strokeRect(12, 12, 210, 85);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '11px monospace';
  ctx.fillText(`STATE:     ${info.state}`, 20, 30);
  ctx.fillText(`AUTHORITY: ${info.authority}`, 20, 46);
  ctx.fillText(`VELOCITY:  (${info.vx.toFixed(1)}, ${info.vy.toFixed(1)})`, 20, 62);
  ctx.fillText(`FPS:       ${info.fps}`, 20, 78);

  ctx.restore();
}
