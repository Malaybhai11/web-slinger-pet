/**
 * spidey.ts — Full 2D Web Physics Engine & State Machine for Spider-Man.
 *
 * POSITIONAL AUTHORITY MODES
 * --------------------------
 * 1. ON_SURFACE : DOM surface geometry is authoritative.
 *                 Spider-Man's feet lock to surface.worldY, worldX = surface.worldX + width * offset.
 *                 Moves automatically with scroll, layout shifts, and element movement.
 * 2. AIRBORNE   : Physics Engine is authoritative (Euler integration + gravity + drag + swept AABB).
 * 3. SWINGING   : Verlet Rope pendulum constraint is authoritative. Preserves tangent velocity on release.
 * 4. CLINGING   : Wall surface is authoritative with surface normals.
 */

import { drawSprite, getHandPosition, DISPLAY_SCALE, type PoseName } from './sprite.js';
import { Rope } from './rope.js';
import { AnimationPlayer } from './animations.js';
import { SurfaceManager, type Surface } from './surfaces.js';
import {
  PhysicsEngine,
  PhysicsBody,
  PHYS_CONFIG,
  COLLIDERS,
  type AuthorityMode,
} from './physics.js';
import {
  emit, updateParticles, drawParticles,
  triggerShake, applyShake,
  drawShadow, drawWebLine, drawDebugOverlay,
} from './effects.js';

const SCALE = DISPLAY_SCALE;

export type SpideyState =
  | 'SITTING'
  | 'STANDING'
  | 'CROUCHING'
  | 'WALKING'
  | 'CRAWLING'
  | 'CLINGING'
  | 'CEILING'
  | 'HANGING'
  | 'WEB_SHOOT'
  | 'SWINGING'
  | 'RELEASING'
  | 'BACKFLIP'
  | 'JUMPING'
  | 'AIRBORNE'
  | 'FALLING'
  | 'LANDING'
  | 'HARD_LANDING'
  | 'DIZZY'
  | 'RECOVERING'
  | 'WAVING'
  | 'STRETCHING';

export class WebSlingerPet {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Single physics loop safety
  private animFrameId: number | null = null;
  private destroyed = false;

  // Core Physics Body
  private body: PhysicsBody = {
    worldX: 400,
    worldY: 400,
    prevWorldX: 400,
    prevWorldY: 400,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVelocity: 0,
    grounded: false,
    supported: false,
    currentSurface: null,
    surfaceOffsetX: 0.5,
    authority: 'AIRBORNE',
  };

  private physics = new PhysicsEngine();
  private surfaces = new SurfaceManager();
  private anim = new AnimationPlayer();

  private state: SpideyState = 'FALLING';
  private stateT = 0; // ms in current state
  private facing: 1 | -1 = 1;

  // Swing / Traversal
  private rope: Rope | null = null;
  private anchorWorldX = 0;
  private anchorWorldY = 0;
  private swingTargetSurface: Surface | null = null;
  private swingTargetWorldX = 0;
  private swingTargetWorldY = 0;

  // Fall tracking for dizzy
  private fallStartWorldY = 0;
  private fallDist = 0;

  // Visuals
  private squash = 1;
  private dizzyAngle = 0;
  private mouseX = -999;
  private mouseY = -999;

  // Timers & FPS
  private lastTs = 0;
  private lastInteractTs = -3000;
  private nextIdleDecisionTs = 0;
  private fps = 60;
  private frameCount = 0;
  private fpsTimer = 0;

  constructor() {
    // Prevent duplicate pet instances
    if ((window as any).__petInstance) {
      (window as any).__petInstance.destroy();
    }
    (window as any).__petInstance = this;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'web-slinger-canvas';
    this.canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('pointermove', this.onMouseMove as EventListener, { passive: true });

    // Initial spawn after DOM layout is ready
    requestAnimationFrame(() => {
      this.surfaces.scan();
      this.initSpawn();
      this.startLoop();
    });
  }

  // ── Single Loop Launcher ──────────────────────────────────────────────────

  private startLoop(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.lastTs = performance.now();
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  // ── Spawn ──────────────────────────────────────────────────────────────────

  private initSpawn(): void {
    const spawn = this.surfaces.findSpawnSurface();
    if (spawn) {
      this.landOnSurface(spawn, 0.5);
      this.enterState('SITTING');
    } else {
      this.body.worldX = window.innerWidth * 0.5;
      this.body.worldY = window.scrollY + 80;
      this.enterState('FALLING');
    }
  }

  // ── User Click Traversal API ───────────────────────────────────────────────

  reactToInteraction(el: HTMLElement): void {
    const now = performance.now();
    if (now - this.lastInteractTs < 1800) return;
    this.lastInteractTs = now;

    this.surfaces.updateRects();
    const target = this.surfaces.getSurfaceFromElement(el);
    if (!target) return;

    if (target === this.body.currentSurface) {
      this.anim.play('sitFidget');
      return;
    }

    this.swingTargetSurface = target;
    this.swingTargetWorldX  = this.surfaces.centerX(target);
    this.swingTargetWorldY  = target.worldY;
    this.facing = this.swingTargetWorldX >= this.body.worldX ? 1 : -1;

    if (this.body.authority === 'ON_SURFACE') {
      this.enterState('BACKFLIP');
    } else if (this.state === 'SWINGING') {
      // Redirect mid-swing safely
      this.swingTargetSurface = target;
      this.swingTargetWorldX  = this.surfaces.centerX(target);
      this.swingTargetWorldY  = target.worldY;
    }
  }

  performAction(action: string): void {
    const sx = this.screenX();
    const sy = this.screenY();

    switch (action) {
      case 'swing':
        this.swingRandom();
        break;
      case 'backflip':
        this.detachSurface();
        this.body.vy = PHYS_CONFIG.backflipImpulseY;
        this.body.vx = this.facing * 3;
        this.enterState('BACKFLIP');
        emit(8, { x: sx, y: sy, vxRange: 0.2, vyRange: 0.2, color: '#E52521', life: 400 });
        break;
      case 'webZip':
        this.detachSurface();
        this.body.vy = -5;
        this.body.vx = this.facing * 7;
        this.enterState('AIRBORNE');
        this.anim.play('webZip');
        break;
      case 'attack':
        this.detachSurface();
        this.body.vx = this.facing * 4;
        this.enterState('AIRBORNE');
        this.anim.play('attack');
        emit(10, { x: sx, y: sy, vxRange: 0.2, vyRange: 0.1, color: '#E52521', life: 300 });
        triggerShake(3);
        break;
      case 'roll':
        this.detachSurface();
        this.body.vx = this.facing * 5;
        this.enterState('AIRBORNE');
        this.anim.play('roll');
        break;
      case 'dizzy':
        this.detachSurface();
        this.enterState('DIZZY');
        break;
      case 'victory':
        if (this.body.authority === 'ON_SURFACE') {
          this.enterState('WAVING');
        }
        break;
    }
  }

  private swingRandom(): void {
    const ax = Math.min(window.innerWidth - 60, Math.max(60, this.body.worldX + this.facing * 200));
    const ay = Math.max(0, this.body.worldY - 120);
    this.swingTargetWorldX  = ax;
    this.swingTargetWorldY  = ay;
    this.swingTargetSurface = null;
    this.lastInteractTs = -3000;
    if (this.body.authority === 'ON_SURFACE') this.enterState('BACKFLIP');
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('pointermove', this.onMouseMove as EventListener);
    this.surfaces.destroy();
    this.canvas.remove();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private screenX(): number { return this.body.worldX; }
  private screenY(): number { return this.body.worldY - window.scrollY; }

  private detachSurface(): void {
    this.body.currentSurface = null;
    this.body.supported      = false;
    this.body.grounded       = false;
    this.body.authority      = 'AIRBORNE';
  }

  private landOnSurface(s: Surface, offsetX: number): void {
    this.body.currentSurface  = s;
    this.body.surfaceOffsetX  = Math.max(0.05, Math.min(0.95, offsetX));
    this.body.worldX          = s.worldX + s.width * this.body.surfaceOffsetX;
    this.body.worldY          = s.worldY;
    this.body.supported       = true;
    this.body.grounded        = true;
    this.body.authority       = 'ON_SURFACE';
  }

  // ── State Transitions ──────────────────────────────────────────────────────

  private enterState(nextState: SpideyState): void {
    this.state  = nextState;
    this.stateT = 0;

    switch (nextState) {
      case 'SITTING':
        this.body.authority = 'ON_SURFACE';
        this.anim.play('sit');
        this.squash = 1;
        this.nextIdleDecisionTs = performance.now() + 6000 + Math.random() * 5000;
        break;

      case 'CRAWLING':
        this.body.authority = 'ON_SURFACE';
        this.anim.play(this.facing > 0 ? 'crawlRight' : 'crawlLeft');
        break;

      case 'BACKFLIP':
        this.detachSurface();
        this.anim.play('backflip');
        this.body.vy = PHYS_CONFIG.backflipImpulseY;
        const dx = this.swingTargetWorldX - this.body.worldX;
        this.body.vx = (dx >= 0 ? 1 : -1) * Math.min(5, Math.max(1.5, Math.abs(dx) * 0.007));
        this.fallStartWorldY = this.body.worldY;
        triggerShake(2);
        break;

      case 'SWINGING':
        this.body.authority = 'SWINGING';
        this.anim.play('swing');
        this.initRope();
        break;

      case 'RELEASING':
        this.body.authority = 'AIRBORNE';
        if (this.rope) {
          const vel = this.rope.endVel();
          this.body.vx = vel.x;
          this.body.vy = vel.y;
        }
        this.rope = null;
        this.anim.play('fall');
        break;

      case 'FALLING':
        this.detachSurface();
        this.anim.play('fall');
        this.fallStartWorldY = this.body.worldY;
        break;

      case 'LANDING':
      case 'HARD_LANDING':
        const hard = nextState === 'HARD_LANDING';
        this.squash = hard ? 0.35 : 0.60;
        this.anim.play('land');
        const sx = this.screenX();
        const sy = this.screenY();
        if (hard) {
          triggerShake(7, 0.85);
          emit(18, { x: sx, y: sy, vx: 0, vy: -0.05, vxRange: 0.3, vyRange: 0.2, life: 600, color: '#FFFFFF' });
        } else {
          triggerShake(3, 0.88);
          emit(8,  { x: sx, y: sy, vx: 0, vy: -0.04, vxRange: 0.2, vyRange: 0.1, life: 350, color: '#FFFFFF' });
        }
        break;

      case 'DIZZY':
        this.body.authority = 'AIRBORNE';
        this.body.vx = this.body.vy = 0;
        this.anim.play('dizzy');
        triggerShake(6, 0.82);
        break;

      case 'RECOVERING':
        this.anim.play('idle');
        break;

      case 'CLINGING':
        this.body.authority = 'CLINGING';
        this.anim.play('cling');
        break;

      case 'WAVING':
        this.anim.play('wave');
        break;

      case 'STRETCHING':
        this.anim.play('stretch');
        break;
    }
  }

  private initRope(): void {
    const midX = (this.body.worldX + this.swingTargetWorldX) / 2 + (Math.random() - 0.5) * 50;
    const topY = Math.min(this.body.worldY, this.swingTargetWorldY);
    this.anchorWorldX = midX;
    this.anchorWorldY = Math.max(window.scrollY + 20, topY - 140 - Math.random() * 60);

    const segs   = 12;
    const dist   = Math.hypot(this.body.worldX - this.anchorWorldX, this.body.worldY - this.anchorWorldY);
    const segLen = Math.max(10, dist / segs);

    const anchorSy = this.anchorWorldY - window.scrollY;
    this.rope = new Rope(this.anchorWorldX, anchorSy, segs, segLen);

    const e  = this.rope.end();
    const oX = this.screenX() - e.x;
    const oY = this.screenY() - e.y;
    for (const p of this.rope.points) { p.x += oX; p.y += oY; p.px += oX; p.py += oY; }

    this.rope.kick(this.body.vx, this.body.vy);
    emit(10, { x: this.screenX(), y: this.screenY() - 16, vxRange: 0.1, vyRange: 0.1, life: 260, color: '#FFFFFF' });
  }

  // ── Main Frame Tick ────────────────────────────────────────────────────────

  private tick = (ts: number): void => {
    if (this.destroyed) return;

    const dtMs  = Math.min(50, ts - (this.lastTs || ts));
    this.lastTs = ts;
    this.stateT += dtMs;

    // FPS calculation for debug overlay
    this.frameCount++;
    this.fpsTimer += dtMs;
    if (this.fpsTimer >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // 1. Run Fixed-Timestep Physics Accumulator Loop
    const { alpha } = this.physics.update(this.body, dtMs, this.surfaces, (dtSec) => {
      this.physicsStep(dtSec);
    });

    // 2. High-Level State & Visual Logic
    this.updateStateLogic(dtMs, ts);

    // 3. Render
    this.render(alpha);

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  // ── Fixed Timestep Physics Step ────────────────────────────────────────────

  private physicsStep(dtSec: number): void {
    this.surfaces.updateRects();

    if (this.body.authority === 'ON_SURFACE') {
      const ok = this.physics.updateSurfacePosition(this.body);
      if (!ok) this.enterState('FALLING');
    } else if (this.body.authority === 'AIRBORNE') {
      const hitFloor = this.physics.integrateAirborne(this.body, this.surfaces);
      if (hitFloor) {
        this.fallDist = this.body.worldY - this.fallStartWorldY;
        if (this.fallDist > PHYS_CONFIG.dizzyThreshold) {
          this.enterState('HARD_LANDING');
        } else {
          this.enterState('LANDING');
        }
      }
    }
  }

  // ── High Level State Logic ─────────────────────────────────────────────────

  private updateStateLogic(dtMs: number, ts: number): void {
    switch (this.state) {
      case 'SITTING':
        this.squash = 1 + Math.sin(ts * 0.0017) * 0.012;
        if (ts > this.nextIdleDecisionTs) this.decideIdleAction(ts);
        break;

      case 'CRAWLING':
        if (this.body.authority === 'ON_SURFACE' && this.body.currentSurface) {
          const s = this.body.currentSurface;
          this.body.surfaceOffsetX += (this.facing * 0.06 * dtMs) / s.width;
          if (this.body.surfaceOffsetX <= 0.05 || this.body.surfaceOffsetX >= 0.95) {
            this.enterState('SITTING');
          }
        }
        break;

      case 'BACKFLIP':
        if (this.body.vy >= 0 || this.stateT > 480) {
          this.enterState('SWINGING');
        }
        break;

      case 'SWINGING':
        if (!this.rope) { this.enterState('FALLING'); break; }
        const anchorSy = this.anchorWorldY - window.scrollY;
        this.rope.pin(this.anchorWorldX, anchorSy);
        this.rope.step(PHYS_CONFIG.gravity * 0.9, 0.996, 5, 0);

        const end = this.rope.end();
        this.body.worldX = end.x;
        this.body.worldY = end.y + window.scrollY;

        const dist = Math.hypot(this.swingTargetWorldX - this.body.worldX, this.swingTargetWorldY - this.body.worldY);
        if (dist < 28 || this.stateT > 3200) {
          if (this.swingTargetSurface) {
            this.landOnSurface(this.swingTargetSurface, 0.5);
            this.enterState('LANDING');
          } else {
            this.enterState('RELEASING');
          }
        }
        break;

      case 'LANDING':
      case 'HARD_LANDING':
        this.squash = Math.min(1, this.squash + dtMs * 0.004);
        if (this.stateT > 380) {
          if (this.fallDist > PHYS_CONFIG.dizzyThreshold) {
            this.enterState('DIZZY');
          } else {
            this.enterState('SITTING');
          }
        }
        break;

      case 'DIZZY':
        this.dizzyAngle = ts * 0.003;
        if (this.stateT > 1600) this.enterState('RECOVERING');
        break;

      case 'RECOVERING':
        if (this.stateT > 800) {
          const nearest = this.surfaces.findNearby(this.body.worldX, this.body.worldY, 250);
          if (nearest) {
            this.landOnSurface(nearest, 0.5);
            this.enterState('SITTING');
          } else {
            this.enterState('FALLING');
          }
        }
        break;

      case 'WAVING':
      case 'STRETCHING':
        if (this.stateT > 1500) this.enterState('SITTING');
        break;
    }

    if (this.body.authority === 'ON_SURFACE' && this.mouseX > 0) {
      this.facing = this.mouseX >= this.screenX() ? 1 : -1;
    }
  }

  private decideIdleAction(ts: number): void {
    const roll = Math.random();
    if (roll < 0.35) {
      this.facing = Math.random() < 0.5 ? 1 : -1;
      this.enterState('CRAWLING');
    } else if (roll < 0.55) {
      this.enterState('WAVING');
    } else if (roll < 0.70) {
      this.enterState('STRETCHING');
    } else {
      this.anim.play('lookUp');
      this.nextIdleDecisionTs = ts + 9000;
    }
  }

  // ── Render Frame ───────────────────────────────────────────────────────────

  private render(alpha: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    applyShake(ctx, 16.6);

    const sx = this.screenX();
    const sy = this.screenY();

    // 1. Shadow
    if (this.body.authority !== 'SWINGING') {
      const floor = this.surfaces.findFloorBelow(this.body.worldX, this.body.worldY + 1, 1);
      const shadowY = floor ? floor.worldY - window.scrollY : window.innerHeight;
      drawShadow(ctx, sx, shadowY, sy, SCALE);
    }

    // 2. Rope
    if (this.rope) this.rope.draw(ctx);

    // 3. Dizzy Stars
    if (this.state === 'DIZZY') {
      const n = 4, r = 20, t = performance.now() * 0.002;
      ctx.fillStyle = '#FFD700';
      for (let i = 0; i < n; i++) {
        const a = t + (Math.PI * 2 * i) / n;
        const x = sx + Math.cos(a) * r;
        const y = sy - 22 + Math.sin(a) * (r * 0.4);
        ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      }
    }

    // 4. Sprite Drawing
    const pose = this.anim.update(16.6);

    let rot = 0;
    if (this.state === 'BACKFLIP') {
      rot = (this.stateT / 480) * Math.PI * 2;
    } else if (this.state === 'SWINGING' && this.rope) {
      const p0 = this.rope.points[0];
      const e  = this.rope.end();
      rot = Math.atan2(e.x - p0.x, -(e.y - p0.y)) * -0.45;
    } else if (this.state === 'DIZZY') {
      rot = Math.sin(this.dizzyAngle) * 0.18;
    }

    drawSprite(ctx, pose, Math.round(sx), Math.round(sy), SCALE, {
      flip:     this.facing === -1,
      rotation: rot,
      squashY:  this.squash,
    });

    updateParticles(16.6);
    drawParticles(ctx);

    // 5. SPIDEY_DEBUG Overlay
    if ((window as any).SPIDEY_DEBUG) {
      drawDebugOverlay(ctx, {
        state:     this.state,
        authority: this.body.authority,
        screenX:   sx,
        screenY:   sy,
        vx:        this.body.vx,
        vy:        this.body.vy,
        surfaces:  this.surfaces.getAll(),
        targetX:   this.swingTargetWorldX,
        targetY:   this.swingTargetWorldY,
        fps:       this.fps,
      });
    }
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────

  private onResize = (): void => {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
    this.surfaces.scan();
  };

  private resize(): void {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };
}
