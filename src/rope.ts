/**
 * rope.ts — verlet-integrated web rope for pendulum swings.
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
    p.x = x;
    p.y = y;
    p.px = x;
    p.py = y;
  }

  /** kick the loose end with a velocity */
  kick(vx: number, vy: number): void {
    const e = this.points[this.points.length - 1];
    e.px = e.x - vx;
    e.py = e.y - vy;
  }

  step(gravity: number, damping = 0.995, iterations = 4): void {
    // verlet integration (skip the pinned head)
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
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
    ctx.strokeStyle = '#F2F6FF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
  }
}
