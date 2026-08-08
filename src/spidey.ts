/**
 * spidey.ts — Physics-aware Spider-Man living inside the webpage.
 *
 * COORDINATE SYSTEM
 * -----------------
 * worldX / worldY  = document coords (don't change on scroll)
 * screenX / screenY = viewport coords used for canvas drawing
 *   screenX = worldX
 *   screenY = worldY - window.scrollY
 *
 * When on a surface:
 *   worldY is derived fresh each frame from element.getBoundingClientRect().top + scrollY
 *   → Spider-Man moves with the element on scroll/resize automatically.
 *
 * PHYSICS CONSTANTS
 */

import { drawSprite, getHandPosition, DISPLAY_SCALE, type PoseName } from './sprite.js';
import { Rope } from './rope.js';
import { AnimationPlayer } from './animations.js';
import { SurfaceManager, type Surface } from './surfaces.js';
import {
  emit, updateParticles, drawParticles,
  triggerShake, applyShake,
  drawShadow, drawWebLine,
} from './effects.js';

const SCALE = DISPLAY_SCALE;

const PHYS = {
  gravity:          0.45,
  airResistance:    0.995,
  groundFriction:   0.80,
  maxFallSpeed:     18,
  jumpVelocity:     -9,
  walkSpeed:        0.09,          // px/ms on surfaces
  crawlSpeed:       0.06,          // px/ms on surfaces
  wallGrabDist:     50,            // px radius for grab saves
  landTolerance:    28,
  snapDist:         8,
  dizzyFallDist:    260,           // fall further than this → dizzy
  interactCooldown: 2000,
};

// ── State type ────────────────────────────────────────────────────────────────
export type State =
  | 'sitting'          // on a surface, idle
  | 'crawling'         // moving along a surface top
  | 'edge_grab'        // hanging from surface edge
  | 'falling'          // free-fall, no support
  | 'landing'          // squash impact
  | 'preparing'        // crouch before launch
  | 'backflipping'     // post-launch arc before web
  | 'swinging'         // Verlet rope pendulum
  | 'dizzy'            // hard-fall recovery
  | 'recovering'       // getting back up
  | 'wall_clinging'    // on a vertical surface
  | 'walking'          // ground walk
  | 'waving'           // personality gesture
  | 'stretching'       // personality stretch
  // Legacy action-deck states
  | 'action_backflip'
  | 'action_webzip'
  | 'action_wallrun'
  | 'action_attack'
  | 'action_roll'
  | 'action_victory';

// ─────────────────────────────────────────────────────────────────────────────

export class WebSlingerPet {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // World coords (document space)
  private worldX = 400;
  private worldY = 400;
  private vx = 0;
  private vy = 0;

  private facing: 1 | -1 = 1;
  private state: State = 'falling';
  private stateT = 0;          // ms in current state

  // Surface attachment
  private surfaces: SurfaceManager;
  private currentSurface: Surface | null = null;
  private surfaceOffsetX = 0.5;  // fraction along surface width
  // surfaceOffsetY is always 0 (standing on top)

  // Swing / web
  private rope: Rope | null = null;
  private anchorWorldX = 0;
  private anchorWorldY = 0;
  private swingTargetSurface: Surface | null = null;
  private swingTargetWorldX  = 0;
  private swingTargetWorldY  = 0;

  // Fall tracking (for dizzy detection)
  private fallStartWorldY = 0;
  private fallDist        = 0;

  // Visual
  private squash     = 1;
  private rotation   = 0;
  private grip       = false;
  private dizzyAngle = 0;

  // Mouse / cursor
  private mouseX = -999;
  private mouseY = -999;       // viewport coords

  // Timing
  private lastTs           = 0;
  private lastInteractTs   = -PHYS.interactCooldown * 2;
  private nextIdleActionTs = 0;
  private nextIdleDecision = 0;

  private destroyed = false;
  private anim = new AnimationPlayer();

  // ── Boot ───────────────────────────────────────────────────────────────────

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'web-slinger-canvas';
    this.canvas.style.cssText = `
      position:fixed;inset:0;z-index:9999;pointer-events:none;
    `;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;

    this.surfaces = new SurfaceManager();

    this.resize();
    window.addEventListener('resize',     this.onResize,    { passive: true });
    window.addEventListener('mousemove',  this.onMouseMove, { passive: true });
    window.addEventListener('pointermove',this.onMouseMove as EventListener, { passive: true });

    // Scroll: surfaces update themselves, so we just update rects
    // (SurfaceManager already binds its own scroll handler)

    // Spawn after first frame so all DOM is settled
    requestAnimationFrame(() => {
      this.surfaces.scan();
      this.initSpawn();
      requestAnimationFrame(this.tick);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * React to user clicking a UI element.
   * Never blocks the click — just triggers Spider-Man's response.
   */
  reactToInteraction(el: HTMLElement): void {
    const now = performance.now();
    if (now - this.lastInteractTs < PHYS.interactCooldown) return;
    this.lastInteractTs = now;

    this.surfaces.updateRects();
    const target = this.surfaces.getSurfaceFromElement(el);
    if (!target) return;
    if (target === this.currentSurface) { this.anim.play('sitFidget'); return; }

    this.swingTargetSurface  = target;
    this.swingTargetWorldX   = this.surfaces.centerX(target);
    this.swingTargetWorldY   = target.worldY;
    this.facing = this.swingTargetWorldX >= this.worldX ? 1 : -1;

    if (this.isGrounded()) {
      this.enterPrepare();
    } else if (this.state === 'swinging') {
      // Redirect mid-swing: keep velocity, change target
      this.swingTargetSurface = target;
      this.swingTargetWorldX  = this.surfaces.centerX(target);
      this.swingTargetWorldY  = target.worldY;
    }
  }

  /** Legacy: action-deck commands */
  performAction(action: string): void {
    const sx = this.screenX();
    const sy = this.screenY();

    switch (action) {
      case 'swing':
        this.swing();
        break;
      case 'backflip':
        this.detachSurface();
        this.state  = 'action_backflip';
        this.stateT = 0;
        this.vy = PHYS.jumpVelocity;
        this.vx = this.facing * 2.5;
        this.anim.play('backflip');
        emit(8, { x: sx, y: sy, vxRange: 0.15, vyRange: 0.2, color: '#E52521', life: 400 });
        break;
      case 'webZip':
        this.detachSurface();
        this.state  = 'action_webzip';
        this.stateT = 0;
        this.vy = -5;
        this.vx = this.facing * 6;
        this.anim.play('webZip');
        break;
      case 'wallRun':
        this.detachSurface();
        this.state  = 'action_wallrun';
        this.stateT = 0;
        this.vx = this.facing * 5;
        this.vy = -2;
        this.anim.play('wallRun');
        break;
      case 'attack':
        this.detachSurface();
        this.state  = 'action_attack';
        this.stateT = 0;
        this.vx = this.facing * 4;
        this.anim.play('attack');
        emit(10, { x: sx, y: sy, vxRange: 0.2, vyRange: 0.1, color: '#E52521', life: 300 });
        triggerShake(3);
        break;
      case 'roll':
        this.detachSurface();
        this.state  = 'action_roll';
        this.stateT = 0;
        this.vx = this.facing * 5;
        this.anim.play('roll');
        break;
      case 'dizzy':
        this.detachSurface();
        this.enterDizzy(200);
        break;
      case 'victory':
        if (this.currentSurface) {
          this.state  = 'action_victory';
          this.stateT = 0;
          this.anim.play('victory');
        }
        break;
    }
  }

  /** Legacy: random swing used by action-deck WEB SWING */
  swing(): void {
    const ax = Math.min(window.innerWidth  - 60,
               Math.max(60, this.worldX + this.facing * 200));
    const ay = Math.max(0, this.worldY - 100);
    this.swingTargetWorldX  = ax;
    this.swingTargetWorldY  = ay;
    this.swingTargetSurface = null;
    this.lastInteractTs = -PHYS.interactCooldown * 2; // bypass cooldown
    if (this.isGrounded()) this.enterPrepare();
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('resize',     this.onResize);
    window.removeEventListener('mousemove',  this.onMouseMove);
    window.removeEventListener('pointermove',this.onMouseMove as EventListener);
    this.surfaces.destroy();
    this.canvas.remove();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Screen-space X (= world X, since canvas is viewport-fixed) */
  private screenX(): number { return this.worldX; }
  /** Screen-space Y (world Y minus scroll offset) */
  private screenY(): number { return this.worldY - window.scrollY; }

  private isGrounded(): boolean {
    return ['sitting', 'crawling', 'walking', 'waving', 'stretching',
            'edge_grab', 'wall_clinging', 'action_victory'].includes(this.state);
  }

  private detachSurface(): void {
    this.currentSurface = null;
    this.grip           = false;
    this.rotation       = 0;
  }

  // ── Spawn ──────────────────────────────────────────────────────────────────

  private initSpawn(): void {
    const spawn = this.surfaces.findSpawnSurface();
    if (spawn) {
      this.landOnSurface(spawn, 0.5, false);
      this.enterSitting();
    } else {
      // Fallback: fall from top-center
      this.worldX = window.innerWidth  * 0.5;
      this.worldY = window.scrollY + 80;
      this.vy     = 0;
      this.enterFalling();
    }
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────

  private tick = (ts: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(50, ts - (this.lastTs || ts));
    this.lastTs = ts;
    this.stateT += dt;

    this.update(dt, ts);
    this.render(dt);

    requestAnimationFrame(this.tick);
  };

  // ── Update dispatch ────────────────────────────────────────────────────────

  private update(dt: number, ts: number): void {
    // Keep surface rects up-to-date every frame (cheap)
    this.surfaces.updateRects();

    // If currently attached to a surface, follow it
    this.followSurface();

    // Prune dead surfaces periodically
    if ((ts | 0) % 180 === 0) this.surfaces.prune();

    switch (this.state) {
      case 'sitting':       this.updateSitting(dt, ts);       break;
      case 'crawling':      this.updateCrawling(dt, ts);      break;
      case 'edge_grab':     this.updateEdgeGrab(dt, ts);      break;
      case 'falling':       this.updateFalling(dt, ts);       break;
      case 'landing':       this.updateLanding(dt, ts);       break;
      case 'preparing':     this.updatePreparing(dt, ts);     break;
      case 'backflipping':  this.updateBackflipping(dt, ts);  break;
      case 'swinging':      this.updateSwinging(dt, ts);      break;
      case 'dizzy':         this.updateDizzy(dt, ts);         break;
      case 'recovering':    this.updateRecovering(dt, ts);    break;
      case 'wall_clinging': this.updateWallClinging(dt, ts);  break;
      case 'walking':       this.updateWalking(dt, ts);       break;
      case 'waving':        this.updateWaving(dt, ts);        break;
      case 'stretching':    this.updateStretching(dt, ts);    break;
      // Legacy actions
      case 'action_backflip':
      case 'action_webzip':
      case 'action_wallrun':
      case 'action_attack':
      case 'action_roll':   this.updateActionArc(dt, ts);     break;
      case 'action_victory':this.updateVictory(dt, ts);       break;
    }

    // Cursor-look: subtle facing update while sitting
    if ((this.state === 'sitting' || this.state === 'crawling') && this.mouseX > 0) {
      this.facing = this.mouseX >= this.screenX() ? 1 : -1;
    }
  }

  // ── Surface following (the core of scroll-correctness) ────────────────────

  private followSurface(): void {
    if (!this.currentSurface) return;

    // Surface removed from DOM → lose support
    if (!this.currentSurface.isConnected()) {
      this.currentSurface = null;
      this.enterFalling();
      return;
    }

    // Recompute world position from live element rect
    const s      = this.currentSurface;
    this.worldX  = s.worldX + s.width  * this.surfaceOffsetX;
    this.worldY  = s.worldY;  // feet at surface top
  }

  // ── State: SITTING ─────────────────────────────────────────────────────────

  private enterSitting(): void {
    this.state   = 'sitting';
    this.stateT  = 0;
    this.vx = this.vy = 0;
    this.squash  = 1;
    this.grip    = false;
    this.rotation= 0;
    this.anim.play('sit');
    this.nextIdleDecision = performance.now() + 7000 + Math.random() * 6000;
  }

  private updateSitting(dt: number, ts: number): void {
    if (!this.currentSurface) { this.enterFalling(); return; }

    // Breathing squash
    this.squash = 1 + Math.sin(ts * 0.0017) * 0.012;

    // Personality
    if (ts > this.nextIdleDecision) this.decideIdleAction(ts);

    // Mouse flinch: cursor suddenly near Spider-Man
    const dx = this.mouseX - this.screenX();
    const dy = this.mouseY - this.screenY();
    const md = Math.hypot(dx, dy);
    if (md < 45 && md > 5 && this.stateT > 1000) {
      this.anim.play('sitFidget');
      this.nextIdleDecision = ts + 4000;
    }
  }

  // ── State: CRAWLING ────────────────────────────────────────────────────────

  private enterCrawl(dir: 1 | -1 = 1): void {
    this.state   = 'crawling';
    this.stateT  = 0;
    this.facing  = dir;
    this.anim.play(dir > 0 ? 'crawlRight' : 'crawlLeft');
    this.nextIdleDecision = performance.now() + 2000 + Math.random() * 1500;
  }

  private updateCrawling(dt: number, ts: number): void {
    if (!this.currentSurface) { this.enterFalling(); return; }

    const s      = this.currentSurface;
    const margin = 12;
    const left   = s.worldX + margin;
    const right  = s.worldX + s.width - margin;

    this.surfaceOffsetX += (this.facing * PHYS.crawlSpeed * dt) / s.width;
    this.surfaceOffsetX  = Math.max(margin / s.width, Math.min(1 - margin / s.width, this.surfaceOffsetX));

    if (this.worldX <= left || this.worldX >= right) {
      this.enterSitting();
    } else if (ts > this.nextIdleDecision) {
      this.enterSitting();
    }
  }

  // ── State: EDGE GRAB ──────────────────────────────────────────────────────

  private enterEdgeGrab(): void {
    this.state   = 'edge_grab';
    this.stateT  = 0;
    this.vx = this.vy = 0;
    this.anim.play('cling');
  }

  private updateEdgeGrab(dt: number, ts: number): void {
    if (!this.currentSurface) { this.enterFalling(); return; }
    this.squash = 1;
    if (this.stateT > 800) this.enterSitting(); // pull up
  }

  // ── State: FALLING ─────────────────────────────────────────────────────────

  private enterFalling(): void {
    if (this.state === 'falling') return; // already falling
    this.currentSurface   = null;
    this.grip             = false;
    this.rotation         = 0;
    this.fallStartWorldY  = this.worldY;
    this.fallDist         = 0;
    this.state            = 'falling';
    this.stateT           = 0;
    this.anim.play('fall');
  }

  private updateFalling(dt: number, ts: number): void {
    this.vy += PHYS.gravity;
    this.vy  = Math.min(this.vy, PHYS.maxFallSpeed);
    this.vx *= PHYS.airResistance;
    this.worldX += this.vx;
    this.worldY += this.vy;

    this.fallDist = this.worldY - this.fallStartWorldY;

    // Clamp to viewport width
    this.worldX = Math.max(20, Math.min(window.innerWidth - 20, this.worldX));

    // Fast fall animation
    if (Math.abs(this.vy) > 10) this.anim.play('fall');

    // Floor hit: page bottom edge
    const docH  = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const floorY= docH - 4;
    if (this.worldY >= floorY) {
      this.worldY = floorY;
      this.enterLanding(null, this.fallDist);
      return;
    }

    // Check surface collision (world coords)
    const hit = this.surfaces.findFloorBelow(this.worldX, this.worldY, this.vy);
    if (hit) {
      this.worldY = hit.worldY;
      this.enterLanding(hit, this.fallDist);
      return;
    }

    // Grab save: nearby surface within grab distance
    if (this.vy > 3 && this.fallDist > 80) {
      const nearby = this.surfaces.findNearby(this.worldX, this.worldY, PHYS.wallGrabDist);
      if (nearby) {
        this.landOnSurface(nearby, 0.5, false);
        this.enterEdgeGrab();
        return;
      }
    }

    // Auto web save: very long fall
    if (this.fallDist > 500 && this.vy > 8 && Math.random() < 0.003) {
      this.enterWebSave();
    }
  }

  // ── State: LANDING ────────────────────────────────────────────────────────

  private enterLanding(surface: Surface | null, fallDist: number): void {
    this.state   = 'landing';
    this.stateT  = 0;
    this.vy      = 0;
    this.vx     *= 0.3;
    this.rope    = null;
    this.grip    = false;
    this.rotation= 0;

    const hard = fallDist > PHYS.dizzyFallDist;
    this.squash = hard ? 0.35 : 0.55;
    this.anim.play('land');

    if (surface) {
      this.landOnSurface(surface, 0.5, true);
    }

    const sx = this.screenX();
    const sy = this.screenY();

    if (hard) {
      triggerShake(6, 0.85);
      emit(20, { x: sx, y: sy, vx: 0, vy: -0.05, vxRange: 0.3, vyRange: 0.2, life: 700, size: 2.5, color: '#FFFFFF' });
      emit(8,  { x: sx, y: sy, vxRange: 0.2, vyRange: 0.1, life: 400, size: 2, color: '#E52521' });
    } else {
      triggerShake(3, 0.88);
      emit(10, { x: sx, y: sy, vx: 0, vy: -0.04, vxRange: 0.2, vyRange: 0.12, life: 400, size: 2, color: '#FFFFFF' });
    }

    // Store fall dist for dizzy decision
    this.fallDist = fallDist;
  }

  private updateLanding(dt: number, ts: number): void {
    this.squash = Math.min(1, this.squash + dt * 0.004);

    if (this.stateT > 400) {
      if (this.fallDist > PHYS.dizzyFallDist) {
        this.enterDizzy(this.fallDist);
      } else {
        this.enterSitting();
      }
    }
  }

  private landOnSurface(s: Surface, offsetX: number, snap: boolean): void {
    this.currentSurface  = s;
    this.surfaceOffsetX  = Math.max(0.05, Math.min(0.95, offsetX));
    if (snap) {
      this.worldX = s.worldX + s.width  * this.surfaceOffsetX;
      this.worldY = s.worldY;
    }
  }

  // ── State: PREPARING ─────────────────────────────────────────────────────

  private enterPrepare(): void {
    this.state   = 'preparing';
    this.stateT  = 0;
    this.anim.play('prepare');
  }

  private updatePreparing(dt: number, ts: number): void {
    if (this.stateT > 200) this.enterBackflip();
  }

  // ── State: BACKFLIPPING ───────────────────────────────────────────────────

  private enterBackflip(): void {
    this.state   = 'backflipping';
    this.stateT  = 0;
    this.detachSurface();
    this.anim.play('backflip');
    this.fallStartWorldY = this.worldY;

    const dx   = this.swingTargetWorldX - this.worldX;
    const dist = Math.abs(dx);
    this.vy    = -8;
    this.vx    = (dx >= 0 ? 1 : -1) * Math.min(5.5, Math.max(1.5, dist * 0.007));
    this.facing= dx >= 0 ? 1 : -1;

    triggerShake(2);
    emit(8, {
      x: this.screenX(), y: this.screenY(),
      vxRange: 0.15, vyRange: 0.2, life: 400, size: 2.5, color: '#E52521',
    });
  }

  private updateBackflipping(dt: number, ts: number): void {
    this.vy += PHYS.gravity;
    this.worldX += this.vx;
    this.worldY += this.vy;
    this.vx *= PHYS.airResistance;

    // At or past apex → deploy web
    if (this.vy >= 0 || this.stateT > 500) {
      this.enterSwing();
    }
  }

  // ── State: SWINGING ──────────────────────────────────────────────────────

  private enterSwing(): void {
    this.state  = 'swinging';
    this.stateT = 0;
    this.grip   = true;
    this.anim.play('swing');

    // Anchor point: above the midpoint of current pos and target
    const midX = (this.worldX + this.swingTargetWorldX) / 2 + (Math.random() - 0.5) * 60;
    const topY  = Math.min(this.worldY, this.swingTargetWorldY);
    this.anchorWorldX = midX;
    this.anchorWorldY = Math.max(window.scrollY + 20, topY - 140 - Math.random() * 60);

    const segs   = 12;
    const dist   = Math.hypot(this.worldX - this.anchorWorldX, this.worldY - this.anchorWorldY);
    const segLen = Math.max(10, dist / segs);

    // Build rope in screen coords (anchor = screen-space position)
    const anchorScreenY = this.anchorWorldY - window.scrollY;
    this.rope = new Rope(this.anchorWorldX, anchorScreenY, segs, segLen);

    // Align rope end to Spider-Man's current screen position
    const e   = this.rope.end();
    const oX  = this.screenX() - e.x;
    const oY  = this.screenY() - e.y;
    for (const p of this.rope.points) { p.x += oX; p.y += oY; p.px += oX; p.py += oY; }

    // Inherit velocity
    this.rope.kick(this.vx, this.vy);

    // Web-shoot particles
    emit(10, {
      x: this.screenX(), y: this.screenY() - 16,
      vx: (this.anchorWorldX - this.worldX) * 0.01,
      vy: (anchorScreenY - this.screenY()) * 0.01,
      life: 280, size: 2, color: '#FFFFFF',
    });
    triggerShake(2);
  }

  private updateSwinging(dt: number, ts: number): void {
    if (!this.rope) { this.enterFalling(); return; }

    // Pin anchor in screen coords (moves with scroll)
    const anchorScreenY = this.anchorWorldY - window.scrollY;
    this.rope.pin(this.anchorWorldX, anchorScreenY);
    this.rope.step(PHYS.gravity * 0.9, 0.996, 5, 0);

    const e = this.rope.end();
    // Convert rope end (screen space) → world space
    this.worldX = e.x;
    this.worldY = e.y + window.scrollY;

    this.facing = this.swingTargetWorldX >= this.worldX ? 1 : -1;

    // Speed particles
    if (Math.random() < 0.25) {
      emit(1, { x: this.screenX(), y: this.screenY() - 8, life: 200, size: 1.5, color: '#E52521', alpha: 0.5 });
    }

    // Close enough to target → land
    const dist = Math.hypot(this.swingTargetWorldX - this.worldX, this.swingTargetWorldY - this.worldY);
    if (dist < PHYS.landTolerance || this.stateT > 3500) {
      if (this.swingTargetSurface) {
        this.worldY = this.swingTargetSurface.worldY;
        this.landOnSurface(this.swingTargetSurface, 0.5, true);
        this.enterLanding(this.swingTargetSurface, 60); // moderate landing
      } else {
        this.enterLanding(null, 50);
      }
    }
  }

  // ── State: DIZZY ─────────────────────────────────────────────────────────

  private enterDizzy(fallDist: number): void {
    this.state      = 'dizzy';
    this.stateT     = 0;
    this.vx = this.vy = 0;
    this.anim.play('dizzy');

    const sx = this.screenX();
    const sy = this.screenY();
    emit(16, {
      x: sx, y: sy - 20,
      vxRange: 0.1, vyRange: 0.05,
      life: 1500, size: 3.5,
      color: '#FFD700',
    });
    triggerShake(fallDist > 400 ? 8 : 5, 0.82);
  }

  private updateDizzy(dt: number, ts: number): void {
    // Wobble in place
    this.worldX += Math.sin(ts * 0.006) * 0.4;
    this.dizzyAngle = ts * 0.003;

    const dizzyDur = 1600;
    if (this.stateT > dizzyDur) this.enterRecovering();
  }

  // ── State: RECOVERING ────────────────────────────────────────────────────

  private enterRecovering(): void {
    this.state   = 'recovering';
    this.stateT  = 0;
    this.anim.play('idle');
  }

  private updateRecovering(dt: number, ts: number): void {
    if (this.stateT > 900) {
      // Look for nearest surface to walk toward
      const nearest = this.surfaces.findNearby(this.worldX, this.worldY, 300);
      if (nearest && nearest.canStand) {
        this.landOnSurface(nearest, 0.5, true);
        this.enterSitting();
      } else {
        this.enterFalling();
      }
    }
  }

  // ── State: WALL CLINGING ─────────────────────────────────────────────────

  private updateWallClinging(dt: number, ts: number): void {
    this.anim.play('cling');
    if (this.stateT > 1200) this.enterFalling();
  }

  // ── State: WALKING (ground) ──────────────────────────────────────────────

  private enterWalking(): void {
    this.state   = 'walking';
    this.stateT  = 0;
    this.facing  = Math.random() < 0.5 ? 1 : -1;
    this.anim.play('walk');
  }

  private updateWalking(dt: number, ts: number): void {
    if (!this.currentSurface) { this.enterFalling(); return; }

    const s      = this.currentSurface;
    const margin = 14;
    const left   = s.worldX + margin;
    const right  = s.worldX + s.width - margin;

    this.surfaceOffsetX += (this.facing * PHYS.walkSpeed * dt) / s.width;
    this.surfaceOffsetX  = Math.max(margin / s.width, Math.min(1 - margin / s.width, this.surfaceOffsetX));

    this.squash = 0.96 + Math.sin(this.stateT * 0.006) * 0.04;

    if (this.worldX <= left || this.worldX >= right || this.stateT > 2200) {
      this.enterSitting();
    }
  }

  // ── State: WAVING / STRETCHING ──────────────────────────────────────────

  private enterWaving(): void {
    this.state   = 'waving';
    this.stateT  = 0;
    this.anim.play('wave');
  }

  private updateWaving(dt: number, ts: number): void {
    if (this.stateT > 1800) this.enterSitting();
  }

  private enterStretching(): void {
    this.state   = 'stretching';
    this.stateT  = 0;
    this.anim.play('stretch');
  }

  private updateStretching(dt: number, ts: number): void {
    if (this.stateT > 1400 || this.anim.isFinished()) this.enterSitting();
  }

  // ── Idle personality ─────────────────────────────────────────────────────

  private decideIdleAction(ts: number): void {
    const roll = Math.random();
    if (roll < 0.30) {
      this.enterCrawl(Math.random() < 0.5 ? 1 : -1);
    } else if (roll < 0.45) {
      this.enterWaving();
    } else if (roll < 0.58) {
      this.enterStretching();
    } else if (roll < 0.70) {
      // Look at home surface
      const home = this.surfaces.getHomeSurface();
      if (home && home !== this.currentSurface) {
        this.swingTargetSurface = home;
        this.swingTargetWorldX  = this.surfaces.centerX(home);
        this.swingTargetWorldY  = home.worldY;
        this.lastInteractTs     = -PHYS.interactCooldown * 2; // bypass cooldown
        this.facing = this.swingTargetWorldX >= this.worldX ? 1 : -1;
        this.enterPrepare();
        return;
      }
      this.nextIdleDecision = ts + 8000;
    } else {
      // Just sit / look
      this.anim.play('lookUp');
      this.nextIdleDecision = ts + 10000 + Math.random() * 5000;
      return;
    }
    this.nextIdleDecision = ts + 8000 + Math.random() * 5000;
  }

  // ── Legacy action states (gravity arc) ────────────────────────────────────

  private updateActionArc(dt: number, ts: number): void {
    this.vy += PHYS.gravity;
    this.vx *= PHYS.airResistance;
    this.worldX += this.vx;
    this.worldY += this.vy;
    this.worldX = Math.max(20, Math.min(window.innerWidth - 20, this.worldX));

    const hit = this.surfaces.findFloorBelow(this.worldX, this.worldY, this.vy);
    if (hit) {
      this.worldY = hit.worldY;
      this.landOnSurface(hit, 0.5, true);
      this.enterLanding(hit, Math.abs(this.vy) * 20);
      return;
    }

    if (this.anim.isFinished() && this.stateT > 600) {
      this.enterFalling();
    }
  }

  // ── Web save ────────────────────────────────────────────────────────────

  private enterWebSave(): void {
    // Find anchor above current position, then swing toward nearest surface
    const nearest = this.surfaces.findBestLanding(this.worldX, this.worldY + 200);
    this.swingTargetWorldX  = nearest ? this.surfaces.centerX(nearest) : window.innerWidth / 2;
    this.swingTargetWorldY  = nearest ? nearest.worldY : this.worldY;
    this.swingTargetSurface = nearest;
    this.enterSwing();
  }

  // ── Victory ─────────────────────────────────────────────────────────────

  private updateVictory(dt: number, ts: number): void {
    if (this.stateT > 1600 || this.anim.isFinished()) this.enterSitting();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render(dt: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    applyShake(ctx, dt);

    const sx = this.screenX();
    const sy = this.screenY();

    // ── Shadow ──
    if (this.state !== 'swinging') {
      // Cast shadow to nearest floor below
      const hit = this.surfaces.findFloorBelow(this.worldX, this.worldY + 1, 1);
      const shadowY = hit ? hit.worldY - window.scrollY : window.innerHeight;
      drawShadow(ctx, sx, shadowY, sy, SCALE);
    }

    // ── Web rope ──
    if (this.rope) this.rope.draw(ctx);

    // ── Dizzy stars ──
    if (this.state === 'dizzy') this.drawDizzyStars(ctx, sx, sy);

    // ── Sprite ──
    const pose = this.anim.update(dt);

    let rot = this.rotation;
    if (this.state === 'backflipping') {
      rot = (this.stateT / 460) * Math.PI * 2;
    } else if (this.state === 'swinging' && this.rope) {
      const p0 = this.rope.points[0];
      const e  = this.rope.end();
      rot      = Math.atan2(e.x - p0.x, -(e.y - p0.y)) * -0.45;
    } else if (this.state === 'dizzy') {
      rot = Math.sin(this.dizzyAngle) * 0.18;
    }

    drawSprite(ctx, pose, Math.round(sx), Math.round(sy), SCALE, {
      flip:    this.facing === -1,
      rotation: rot,
      grip:    this.grip,
      squashY: this.squash,
      outline: false,
    });

    // ── Particles ──
    updateParticles(dt);
    drawParticles(ctx);
  }

  private drawDizzyStars(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    const n = 4;
    const r = 20;
    const t = performance.now() * 0.002;
    ctx.fillStyle = '#FFD700';
    for (let i = 0; i < n; i++) {
      const a = t + (Math.PI * 2 * i) / n;
      const x = sx + Math.cos(a) * r;
      const y = sy - 22 + Math.sin(a) * (r * 0.4);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  // ── Events ────────────────────────────────────────────────────────────────

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
