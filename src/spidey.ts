/**
 * spidey.ts — the pet's brain. A tiny state machine that idles, walks,
 * shoots webs at [data-web-target] elements, swings from the ceiling,
 * and generally acts playful.
 */

import { drawSprite, SPRITE_W, SPRITE_H, type PoseName } from './sprite.js';
import { Rope } from './rope.js';

const SCALE = 3;
const GRAVITY = 0.55;

type State = 'idle' | 'walk' | 'aim' | 'shoot' | 'leap' | 'swing' | 'hang' | 'wave';

interface WebShot {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number; // 0..1 progress of the line extending
  hold: number;
}

interface TargetInfo {
  el: Element;
  cx: number;
  cy: number;
  hoverT: number; // ms the cursor has lingered
}

export class WebSlingerPet {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: State = 'idle';
  private stateT = 0;

  // position = feet anchor on ground, or swing hand when hanging
  private x = 120;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private facing: 1 | -1 = 1;

  private mouseX = -999;
  private mouseY = -999;

  private rope: Rope | null = null;
  private shot: WebShot | null = null;
  private blinkT = 0;
  private nextBlink = 2400;
  private squash = 1;

  private walkDir: 1 | -1 = 1;
  private idleUntil = 0;
  private boredAt = 0;

  private lastTs = 0;
  private destroyed = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'web-slinger-canvas';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.resize();
    this.y = this.groundY();
    this.x = Math.max(60, window.innerWidth * 0.22);
    this.boredAt = performance.now() + 6000;

    window.addEventListener('resize', this.resize);
    window.addEventListener('mousemove', this.onMove);
    requestAnimationFrame(this.tick);
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('mousemove', this.onMove);
    this.canvas.remove();
  }

  private resize = (): void => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
    if (this.isGrounded()) this.y = this.groundY();
  };

  private onMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };

  private groundY(): number {
    return window.innerHeight - 14;
  }

  private isGrounded(): boolean {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'aim' || this.state === 'shoot' || this.state === 'wave';
  }

  /** find interactive elements the pet cares about */
  private targets(): TargetInfo[] {
    const out: TargetInfo[] = [];
    document.querySelectorAll('[data-web-target]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const inCursor =
        this.mouseX >= r.left - 12 &&
        this.mouseX <= r.right + 12 &&
        this.mouseY >= r.top - 12 &&
        this.mouseY <= r.bottom + 12;
      out.push({ el, cx, cy, hoverT: inCursor ? 1 : 0 });
    });
    return out;
  }

  private handX(): number {
    return this.x + this.facing * 14;
  }
  private handY(): number {
    return this.y - SPRITE_H * SCALE * 0.55;
  }

  private tick = (ts: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(50, ts - (this.lastTs || ts));
    this.lastTs = ts;
    this.stateT += dt;

    this.update(dt, ts);
    this.render(ts);

    requestAnimationFrame(this.tick);
  };

  // ------------------------------------------------ state machine
  private update(dt: number, ts: number): void {
    const t = this.targets();
    const hovered = t.find((i) => i.hoverT > 0);

    switch (this.state) {
      case 'idle': {
        this.squash += (1 - this.squash) * 0.2;
        if (hovered) {
          this.enterAim(hovered, ts);
        } else if (ts > this.boredAt) {
          this.swing();
        } else if (ts > this.idleUntil) {
          this.walkDir = Math.random() < 0.5 ? -1 : 1;
          this.facing = this.walkDir;
          this.state = 'walk';
          this.stateT = 0;
        }
        break;
      }
      case 'walk': {
        this.x += this.walkDir * 0.09 * dt;
        const margin = 40;
        if (this.x < margin) { this.x = margin; this.walkDir = 1; }
        if (this.x > window.innerWidth - margin) { this.x = window.innerWidth - margin; this.walkDir = -1; }
        this.facing = this.walkDir;
        if (hovered) {
          this.enterAim(hovered, ts);
        } else if (this.stateT > 2600) {
          this.state = 'idle';
          this.stateT = 0;
          this.idleUntil = ts + 1200 + Math.random() * 2600;
        }
        break;
      }
      case 'aim': {
        if (!hovered) {
          this.state = 'idle';
          this.stateT = 0;
          this.idleUntil = ts + 800;
          break;
        }
        // face the target
        this.facing = hovered.cx >= this.x ? 1 : -1;
        if (this.stateT > 420) {
          this.fireWeb(hovered, ts);
        }
        break;
      }
      case 'shoot': {
        if (this.shot) {
          this.shot.t = Math.min(1, this.shot.t + dt / 130);
          if (this.shot.t >= 1) {
            this.shot.hold -= dt;
            if (this.shot.hold <= 0) {
              (this as any).shotTarget?.classList?.remove('webbed');
              this.shot = null;
              this.state = 'idle';
              this.stateT = 0;
              this.idleUntil = ts + 500;
              this.boredAt = ts + 8000;
            }
          }
        } else {
          this.state = 'idle';
        }
        break;
      }
      case 'leap': {
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;
        if (this.y >= this.groundY() && this.vy > 0) {
          this.y = this.groundY();
          this.squash = 0.55; // landing squash
          this.state = 'idle';
          this.stateT = 0;
          this.idleUntil = ts + 600;
        }
        break;
      }
      case 'swing': {
        if (!this.rope) { this.state = 'idle'; break; }
        this.rope.step(GRAVITY * 0.9, 0.996, 5);
        const end = this.rope.end();
        this.x = end.x;
        this.y = end.y;
        const vel = this.rope.endVel();
        this.facing = vel.x >= 0 ? 1 : -1;
        if (this.stateT > 2400 || (Math.abs(vel.x) < 0.4 && this.stateT > 1200)) {
          // let go!
          this.vx = vel.x * 1.6;
          this.vy = vel.y - 2;
          this.rope = null;
          this.state = 'leap';
          this.stateT = 0;
          this.boredAt = ts + 14000;
        }
        break;
      }
      case 'hang':
      case 'wave': {
        if (this.stateT > 1400) {
          this.state = 'idle';
          this.stateT = 0;
          this.idleUntil = ts + 1000;
        }
        break;
      }
    }

    // blink bookkeeping
    if (ts > this.nextBlink) {
      this.blinkT = 140;
      this.nextBlink = ts + 1800 + Math.random() * 3200;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
  }

  private enterAim(target: TargetInfo, ts: number): void {
    this.state = 'aim';
    this.stateT = 0;
    this.facing = target.cx >= this.x ? 1 : -1;
  }

  private fireWeb(target: TargetInfo, ts: number): void {
    this.shot = {
      x0: this.handX(),
      y0: this.handY(),
      x1: target.cx,
      y1: target.cy,
      t: 0,
      hold: 900,
    };
    (this as any).shotTarget = target.el;
    target.el.classList.add('webbed');
    this.state = 'shoot';
    this.stateT = 0;
  }

  /** public: pages and demo buttons can trigger the show on demand */
  swing(): void {
    if (this.state === 'swing' || this.state === 'leap') return;
    // clean up any active web shot first
    if (this.shot) {
      (this as any).shotTarget?.classList?.remove('webbed');
      this.shot = null;
    }
    // anchor on the "ceiling" ahead of the pet
    const ax = Math.min(window.innerWidth - 60, Math.max(60, this.x + this.facing * 160));
    const len = Math.max(120, this.y - 30);
    const segs = 14;
    this.rope = new Rope(ax, 4, segs, len / segs);
    // position the rope end at the pet and kick it sideways
    const e = this.rope.end();
    const dx = this.x - e.x;
    const dy = this.y - e.y;
    for (const p of this.rope.points) { p.x += dx; p.y += dy; p.px += dx; p.py += dy; }
    this.rope.kick(this.facing * 6.5, -1);
    this.state = 'swing';
    this.stateT = 0;
  }

  // ------------------------------------------------ rendering
  private render(ts: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const blink = this.blinkT > 0;
    const eyeDX: -1 | 0 | 1 =
      this.mouseX < -100 ? 0 : this.mouseX < this.x - 10 ? -1 : this.mouseX > this.x + 10 ? 1 : 0;

    // active web shot line
    if (this.shot) {
      const ex = this.shot.x0 + (this.shot.x1 - this.shot.x0) * this.shot.t;
      const ey = this.shot.y0 + (this.shot.y1 - this.shot.y0) * this.shot.t;
      ctx.strokeStyle = '#F2F6FF';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.shot.x0, this.shot.y0);
      // slight sag for charm
      const mx = (this.shot.x0 + ex) / 2;
      const my = (this.shot.y0 + ey) / 2 + 3;
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      // impact splat
      if (this.shot.t >= 1) {
        this.drawSplat(this.shot.x1, this.shot.y1);
      }
    }

    // swing rope
    if (this.rope) this.rope.draw(ctx);

    // pick pose
    let pose: PoseName = 'CROUCH';
    let rotation = 0;
    let grip = false;
    let drawY = this.y;
    switch (this.state) {
      case 'walk': pose = Math.floor(ts / 180) % 2 === 0 ? 'CROUCH' : 'FALL'; break;
      case 'aim': case 'shoot': pose = 'SHOOT'; break;
      case 'leap': pose = 'FALL'; break;
      case 'swing': {
        pose = 'SWING';
        grip = true;
        if (this.rope) {
          const p0 = this.rope.points[0];
          const e = this.rope.end();
          rotation = Math.atan2(e.x - p0.x, -(e.y - p0.y)) * -0.55;
        }
        drawY = this.y;
        break;
      }
      case 'wave': pose = 'WAVE'; break;
      default: pose = 'CROUCH';
    }

    drawSprite(ctx, pose, Math.round(this.x), Math.round(drawY), SCALE, {
      flip: this.facing === -1,
      blink,
      eyeDX,
      rotation,
      grip,
      squashY: this.state === 'idle' || this.state === 'walk' ? this.squash : 1,
    });
  }

  private drawSplat(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#F2F6FF';
    // little radial web splat
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const r = 7;
      const dx = Math.round(Math.cos(a) * r);
      const dy = Math.round(Math.sin(a) * r);
      ctx.fillRect(x + dx - 1, y + dy - 1, 2, 2);
    }
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
}
