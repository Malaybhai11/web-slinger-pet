/**
 * particles.ts — land dust and web sparkles (PRD §9.1). Capped and cheap;
 * disabled automatically on low-end devices (PRD §12).
 */

interface Particle {
  x: number;
  y: number; // page coords
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grav: number;
}

const MAX_PARTICLES = 60;

export class Particles {
  enabled = true;
  private list: Particle[] = [];

  spawnDust(x: number, y: number, impact: number): void {
    if (!this.enabled) return;
    const n = Math.min(12, 4 + Math.floor(impact / 150));
    for (let i = 0; i < n; i++) {
      this.push({
        x: x + (Math.random() - 0.5) * 22,
        y: y - 2,
        vx: (Math.random() - 0.5) * 150,
        vy: -Math.random() * 130 - 30,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 1.5,
        color: 'rgba(190,190,190,0.85)',
        grav: 700,
      });
    }
  }

  spawnSparkle(x: number, y: number): void {
    if (!this.enabled) return;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const sp = 60 + Math.random() * 80;
      this.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.15,
        size: 1.5 + Math.random(),
        color: i % 2 === 0 ? 'rgba(242,246,255,0.95)' : 'rgba(47,95,179,0.9)',
        grav: 0,
      });
    }
  }

  private push(p: Particle): void {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    this.list.push(p);
  }

  step(dt: number): void {
    for (const p of this.list) {
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
    }
    this.list = this.list.filter((p) => p.life < p.maxLife);
  }

  draw(ctx: CanvasRenderingContext2D, scrollY: number): void {
    if (this.list.length === 0) return;
    for (const p of this.list) {
      ctx.globalAlpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - scrollY - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
