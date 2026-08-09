/**
 * rope.ts — verlet-integrated web rope for pendulum swings.
 * Enhanced with gradient rendering, wind, and variable stiffness.
 */

export interface RopePoint {
  x: number;
  y: number;
  px: number;
  py: number;
}

export class Rope {
  points: RopePoint[] = [];
  segLen: number;

  constructor(x: number, y: number, segs: number, segLen: number) {
    this.segLen = segLen;
    for (let i = 0; i < segs; i++) {
      this.points.push({ x, y: y + i * segLen, px: x, py: y + i * segLen });
    }
  }

  pin(x: number, y: number): void {
    const p = this.points[0];
    p.x = x; p.y = y;
    p.px = x; p.py = y;
  }

  /** kick the loose end with a velocity */
  kick(vx: number, vy: number): void {
    const e = this.points[this.points.length - 1];
    e.px = e.x - vx;
    e.py = e.y - vy;
  }

  step(gravity: number, damping = 0.995, iterations = 4, wind = 0): void {
    // verlet integration (skip the pinned head)
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + wind;
      p.y += vy + gravity;
    }
    // distance constraints
    for (let k = 0; k < iterations; k++) {
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const diff = (dist - this.segLen) / dist;
        const offX = dx * 0.5 * diff;
        const offY = dy * 0.5 * diff;
        if (i === 0) {
          b.x -= offX * 2;
          b.y -= offY * 2;
        } else {
          a.x += offX;
          a.y += offY;
          b.x -= offX;
          b.y -= offY;
        }
      }
    }
  }

  end(): { x: number; y: number } {
    const e = this.points[this.points.length - 1];
    return { x: e.x, y: e.y };
  }

  endVel(): { x: number; y: number } {
    const e = this.points[this.points.length - 1];
    return { x: e.x - e.px, y: e.y - e.py };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const pts = this.points;
    const n = pts.length;

    // gradient: brighter near anchor, dimmer near pet
    for (let i = 0; i < n - 1; i++) {
      const t = i / (n - 1);
      const alpha = 0.3 + 0.7 * (1 - t);
      ctx.strokeStyle = `rgba(242,246,255,${alpha})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }

    // tiny nodes at segment joints for texture
    ctx.fillStyle = 'rgba(242,246,255,0.5)';
    for (let i = 1; i < n - 1; i++) {
      ctx.fillRect(Math.round(pts[i].x) - 1, Math.round(pts[i].y) - 1, 2, 2);
    }
    ctx.restore();
  }
}
