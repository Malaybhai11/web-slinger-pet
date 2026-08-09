/**
 * spidey.ts — Spider-Man Upside-Down Button Hanging Interaction System.
 *
 * STATE MACHINE FLOW
 * ------------------
 * IDLE → TARGETING → WEB_ATTACHING → SWINGING → HANGING → IDLE_HANGING
 *
 * When ANY button/card on the webpage is clicked:
 * 1. Spider-Man detects the clicked button.
 * 2. Moves toward the button in a natural acrobatic arc (no instant teleporting!).
 * 3. Deploys a web line attached exactly to the button's bottom anchor.
 * 4. Swings underneath the button, smoothly rotating to an upside-down orientation (Math.PI).
 * 5. Settles into IDLE_HANGING directly beneath the button, matching the reference image:
 *    - Head pointing downward
 *    - Feet connected to the web line running up to the button
 *    - Continuous subtle pendulum sway & vertical bobbing
 *    - Positional authority locks to the button during scroll/resize.
 */

import { drawSprite, getHandPosition, DISPLAY_SCALE, type PoseName } from './sprite.js';
import { Rope } from './rope.js';
import { AnimationPlayer } from './animations.js';
import { SurfaceManager, type Surface } from './surfaces.js';
import {
  PhysicsEngine,
  PhysicsBody,
  PHYS_CONFIG,
} from './physics.js';
import {
  emit, updateParticles, drawParticles,
  triggerShake, applyShake,
  drawShadow, drawWebLine, drawDebugOverlay,
} from './effects.js';

const SCALE = DISPLAY_SCALE;

export type SpideyState =
  | 'IDLE'
  | 'TARGETING'
  | 'WEB_ATTACHING'
  | 'SWINGING'
  | 'RELEASING'
  | 'HANGING'
  | 'IDLE_HANGING'
  | 'SITTING'
  | 'WALKING'
  | 'CRAWLING'
  | 'BACKFLIP'
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

  private animFrameId: number | null = null;
  private destroyed = false;

  // Physics Body
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

  // Target Button & Web Anchor
  private targetSurface: Surface | null = null;
  private targetAnchorWorldX = 0;
  private targetAnchorWorldY = 0;

  // Web Rope & Hanging Physics
  private rope: Rope | null = null;
  private hangingRopeLen = 90; // px distance below button when hanging
  private currentRotation = 0;

  // Fall tracking
  private fallStartWorldY = 0;
  private fallDist = 0;

  // Visuals & Spider-Sense
  private squash = 1;
  private dizzyAngle = 0;
  private mouseX = -999;
  private mouseY = -999;
  private spiderSenseT = 0;

  // Timers & FPS
  private lastTs = 0;
  private lastInteractTs = -3000;
  private nextIdleDecisionTs = 0;
  private fps = 60;
  private frameCount = 0;
  private fpsTimer = 0;

  constructor() {
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
    window.addEventListener('keydown', this.onKeyDown);

    requestAnimationFrame(() => {
      this.surfaces.scan();
      this.initSpawn();
      this.startLoop();
    });
  }

  private startLoop(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.lastTs = performance.now();
    this.animFrameId = requestAnimationFrame(this.tick);
  }

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

  // ── Keyboard Controls ──────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.triggerSpiderSense();
        this.performAction('backflip');
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.facing = -1;
        if (this.body.authority === 'ON_SURFACE') this.enterState('CRAWLING');
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.facing = 1;
        if (this.body.authority === 'ON_SURFACE') this.enterState('CRAWLING');
        break;
      case 'KeyW':
      case 'ArrowUp':
        this.performAction('webZip');
        break;
      case 'KeyG':
        (window as any).SPIDEY_DEBUG = !(window as any).SPIDEY_DEBUG;
        break;
    }
  };

  triggerSpiderSense(): void {
    this.spiderSenseT = 600;
  }

  // ── Primary Interaction: Click ANY Button ─────────────────────────────────

  reactToInteraction(el: HTMLElement): void {
    // Direct click on Spider-Man himself
    const sx = this.screenX();
    const sy = this.screenY();
    if (Math.abs(this.mouseX - sx) < 40 && Math.abs(this.mouseY - sy) < 60) {
      this.triggerSpiderSense();
      this.performAction('backflip');
      return;
    }

    const now = performance.now();
    if (now - this.lastInteractTs < 1200) return;
    this.lastInteractTs = now;

    this.triggerSpiderSense();
    this.surfaces.updateRects();
    const target = this.surfaces.getSurfaceFromElement(el);
    if (!target) return;

    this.targetSurface = target;
    this.targetAnchorWorldX = this.surfaces.centerX(target);
    this.targetAnchorWorldY = target.worldY + target.height; // Web anchor at bottom of clicked button
    this.facing = this.targetAnchorWorldX >= this.body.worldX ? 1 : -1;

    // Trigger state flow: TARGETING -> WEB_ATTACHING -> SWINGING -> HANGING -> IDLE_HANGING
    this.enterState('TARGETING');
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
        this.body.vx = this.facing * 3.5;
        this.enterState('BACKFLIP');
        emit(8, { x: sx, y: sy, vxRange: 0.2, vyRange: 0.2, color: '#E52521', life: 400 });
        break;
      case 'webZip':
        this.detachSurface();
        this.body.vy = -6;
        this.body.vx = this.facing * 7.5;
        this.enterState('AIRBORNE');
        this.anim.play('webZip');
        emit(10, { x: sx, y: sy, vxRange: 0.2, vyRange: 0.2, color: '#FFFFFF', life: 300 });
        break;
      case 'attack':
        this.detachSurface();
        this.body.vx = this.facing * 4.5;
        this.enterState('AIRBORNE');
        this.anim.play('attack');
        emit(10, { x: sx, y: sy, vxRange: 0.2, vyRange: 0.1, color: '#E52521', life: 300 });
        triggerShake(3);
        break;
      case 'roll':
        this.detachSurface();
        this.body.vx = this.facing * 5.5;
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
    const spawn = this.surfaces.findSpawnSurface();
    if (spawn && spawn.el) {
      this.reactToInteraction(spawn.el);
    } else {
      const ax = Math.min(window.innerWidth - 60, Math.max(60, this.body.worldX + this.facing * 200));
      const ay = Math.max(0, this.body.worldY - 120);
      this.targetAnchorWorldX = ax;
      this.targetAnchorWorldY = ay;
      this.targetSurface = null;
      this.enterState('TARGETING');
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('pointermove', this.onMouseMove as EventListener);
    window.removeEventListener('keydown', this.onKeyDown);
    this.surfaces.destroy();
    this.canvas.remove();
  }

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

    if (s.el) {
      s.el.classList.add('webbed');
      setTimeout(() => s.el?.classList.remove('webbed'), 1200);
    }
  }

  // ── State Machine Transitions ─────────────────────────────────────────────

  private enterState(nextState: SpideyState): void {
    this.state  = nextState;
    this.stateT = 0;

    switch (nextState) {
      case 'IDLE':
      case 'SITTING':
        this.body.authority = 'ON_SURFACE';
        this.anim.play('sit');
        this.squash = 1;
        this.currentRotation = 0;
        this.nextIdleDecisionTs = performance.now() + 6000 + Math.random() * 5000;
        break;

      case 'TARGETING':
        this.detachSurface();
        this.anim.play('prepare'); // Crouch/prepare pose before launch
        break;

      case 'WEB_ATTACHING':
        this.anim.play('webShoot');
        this.body.vy = -6.5;
        const dx = this.targetAnchorWorldX - this.body.worldX;
        this.body.vx = (dx >= 0 ? 1 : -1) * Math.min(5.5, Math.max(1.8, Math.abs(dx) * 0.008));
        this.fallStartWorldY = this.body.worldY;
        emit(10, { x: this.screenX(), y: this.screenY() - 16, vxRange: 0.1, vyRange: 0.1, life: 260, color: '#FFFFFF' });
        break;

      case 'SWINGING':
        this.body.authority = 'SWINGING';
        this.anim.play('swing');
        this.initRope();
        break;

      case 'HANGING':
        this.body.authority = 'ON_SURFACE';
        this.anim.play('hanging');
        this.squash = 0.70; // Squash rebound upon reaching upside-down hanging position
        triggerShake(3, 0.88);
        break;

      case 'IDLE_HANGING':
        this.body.authority = 'ON_SURFACE';
        this.anim.play('idleHanging');
        this.currentRotation = Math.PI; // Inverted upside-down (180 degrees)
        this.squash = 1.0;
        break;

      case 'CRAWLING':
        this.body.authority = 'ON_SURFACE';
        this.anim.play(this.facing > 0 ? 'crawlRight' : 'crawlLeft');
        break;

      case 'BACKFLIP':
        this.detachSurface();
        this.anim.play('backflip');
        this.body.vy = PHYS_CONFIG.backflipImpulseY;
        const bdx = this.targetAnchorWorldX - this.body.worldX;
        this.body.vx = (bdx >= 0 ? 1 : -1) * Math.min(5, Math.max(1.5, Math.abs(bdx) * 0.007));
        this.fallStartWorldY = this.body.worldY;
        triggerShake(2);
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
        this.currentRotation = 0;
        this.fallStartWorldY = this.body.worldY;
        break;

      case 'LANDING':
      case 'HARD_LANDING':
        const hard = nextState === 'HARD_LANDING';
        this.squash = hard ? 0.35 : 0.60;
        this.anim.play('land');
        this.currentRotation = 0;
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

      case 'WAVING':
        this.anim.play('wave');
        break;

      case 'STRETCHING':
        this.anim.play('stretch');
        break;
    }
  }

  private initRope(): void {
    const segs   = 12;
    const anchorSy = this.targetAnchorWorldY - window.scrollY;
    const dist   = Math.hypot(this.body.worldX - this.targetAnchorWorldX, this.body.worldY - anchorSy);
    const segLen = Math.max(8, dist / segs);

    this.rope = new Rope(this.targetAnchorWorldX, anchorSy, segs, segLen);

    const e  = this.rope.end();
    const oX = this.screenX() - e.x;
    const oY = this.screenY() - e.y;
    for (const p of this.rope.points) { p.x += oX; p.y += oY; p.px += oX; p.py += oY; }

    this.rope.kick(this.body.vx, this.body.vy);
  }

  // ── Main Deterministic Frame Tick ──────────────────────────────────────────

  private tick = (ts: number): void => {
    if (this.destroyed) return;

    const dtMs  = Math.min(50, ts - (this.lastTs || ts));
    this.lastTs = ts;
    this.stateT += dtMs;

    if (this.spiderSenseT > 0) this.spiderSenseT -= dtMs;

    this.frameCount++;
    this.fpsTimer += dtMs;
    if (this.fpsTimer >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    const { alpha } = this.physics.update(this.body, dtMs, this.surfaces, (dtSec) => {
      this.physicsStep(dtSec);
    });

    this.updateStateLogic(dtMs, ts);
    this.render(alpha);

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private physicsStep(dtSec: number): void {
    this.surfaces.updateRects();

    // Dynamically update target anchor position if surface moves/scrolls
    if (this.targetSurface && this.targetSurface.isConnected()) {
      const r = this.targetSurface.el ? this.targetSurface.el.getBoundingClientRect() : null;
      if (r) {
        this.targetAnchorWorldX = r.left + r.width / 2;
        this.targetAnchorWorldY = r.top + window.scrollY + r.height;
      }
    }

    if (this.state === 'IDLE_HANGING' || this.state === 'HANGING') {
      // Positional Authority: Locked to button anchor in document space
      const sway = Math.sin(performance.now() * 0.002) * 0.08;
      const bob  = Math.sin(performance.now() * 0.003) * 2.5;

      this.body.worldX = this.targetAnchorWorldX + Math.sin(sway) * 12;
      this.body.worldY = this.targetAnchorWorldY + this.hangingRopeLen + bob;
      this.body.vx     = 0;
      this.body.vy     = 0;
      this.body.supported = true;
      this.body.grounded  = true;
      this.currentRotation = Math.PI + sway; // Upside down rotation with gentle sway
    } else if (this.body.authority === 'ON_SURFACE') {
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

  // ── High-Level State Machine Logic ────────────────────────────────────────

  private updateStateLogic(dtMs: number, ts: number): void {
    switch (this.state) {
      case 'TARGETING':
        if (this.stateT > 180) {
          this.enterState('WEB_ATTACHING');
        }
        break;

      case 'WEB_ATTACHING':
        if (this.stateT > 120) {
          this.enterState('SWINGING');
        }
        break;

      case 'SWINGING':
        if (!this.rope) { this.enterState('FALLING'); break; }

        const anchorSy = this.targetAnchorWorldY - window.scrollY;
        this.rope.pin(this.targetAnchorWorldX, anchorSy);
        this.rope.step(PHYS_CONFIG.gravity * 0.85, 0.994, 5, 0);

        const end = this.rope.end();
        this.body.worldX = end.x;
        this.body.worldY = end.y + window.scrollY;

        // Smooth rotation interpolation toward upside-down (Math.PI)
        const targetRot = Math.PI;
        this.currentRotation += (targetRot - this.currentRotation) * 0.08;

        const dist = Math.hypot(this.targetAnchorWorldX - this.body.worldX, (this.targetAnchorWorldY + this.hangingRopeLen) - this.body.worldY);
        if (dist < 32 || this.stateT > 2800) {
          this.enterState('HANGING');
        }
        break;

      case 'HANGING':
        this.squash = Math.min(1.0, this.squash + dtMs * 0.005);
        if (this.stateT > 300) {
          this.enterState('IDLE_HANGING');
        }
        break;

      case 'IDLE_HANGING':
        // Continuous subtle upside-down hanging idle
        this.squash = 1.0 + Math.sin(ts * 0.002) * 0.015;
        break;

      case 'SITTING':
      case 'IDLE':
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

    if (this.body.authority === 'ON_SURFACE' && this.state !== 'IDLE_HANGING' && this.state !== 'HANGING' && this.mouseX > 0) {
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

    // 1. Shadow (only when grounded on horizontal surface)
    if (this.state === 'SITTING' || this.state === 'CRAWLING' || this.state === 'WALKING' || this.state === 'LANDING') {
      const floor = this.surfaces.findFloorBelow(this.body.worldX, this.body.worldY + 1, 1);
      const shadowY = floor ? floor.worldY - window.scrollY : window.innerHeight;
      drawShadow(ctx, sx, shadowY, sy, SCALE);
    }

    // 2. Web Line to Target Button Anchor
    if (this.state === 'IDLE_HANGING' || this.state === 'HANGING' || this.state === 'SWINGING' || this.state === 'WEB_ATTACHING') {
      const anchorSy = this.targetAnchorWorldY - window.scrollY;

      if (this.rope) {
        this.rope.draw(ctx);
      } else {
        // Draw crisp dynamic web line connecting button anchor -> Spider-Man's feet/attachment point
        const progress = this.state === 'WEB_ATTACHING' ? Math.min(1.0, this.stateT / 120) : 1.0;
        const feetY = this.state === 'IDLE_HANGING' || this.state === 'HANGING' ? sy - 40 : sy - 15;
        drawWebLine(ctx, this.targetAnchorWorldX, anchorSy, sx, feetY, progress);
      }
    }

    // 3. Spider-Sense Electric Spark (⚡)
    if (this.spiderSenseT > 0) {
      ctx.save();
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 16px monospace';
      const sparkAlpha = Math.min(1, this.spiderSenseT / 200);
      ctx.globalAlpha = sparkAlpha;
      ctx.fillText('⚡', sx - 6, sy - 65 + Math.sin(performance.now() * 0.02) * 3);
      ctx.restore();
    }

    // 4. Dizzy Stars
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

    // 5. Sprite Rendering with Rotation
    const pose = this.anim.update(16.6);

    let rot = this.currentRotation;
    if (this.state === 'BACKFLIP') {
      rot = (this.stateT / 480) * Math.PI * 2;
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

    // 6. Diagnostic Debug Overlay (if ?debug=1 or window.SPIDEY_DEBUG = true)
    if ((window as any).SPIDEY_DEBUG) {
      drawDebugOverlay(ctx, {
        state:     this.state,
        authority: this.body.authority,
        screenX:   sx,
        screenY:   sy,
        vx:        this.body.vx,
        vy:        this.body.vy,
        surfaces:  this.surfaces.getAll(),
        targetX:   this.targetAnchorWorldX,
        targetY:   this.targetAnchorWorldY,
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
