/**
 * physics.ts — Fixed-timestep physics engine, swept AABB colliders,
 * momentum integration, and surface attachment math for Spider-Man.
 */

import { type Surface, SurfaceManager } from './surfaces.js';

export const PHYS_CONFIG = {
  fixedDtMs:        1000 / 60,   // 16.666ms fixed timestep
  gravity:          0.42,        // px per frame^2
  maxFallSpeed:     16,
  airDrag:          0.994,
  groundFriction:   0.82,
  wallFriction:     0.90,
  jumpImpulseY:     -9.5,
  backflipImpulseY: -8.0,
  dizzyThreshold:   250,         // fall distance (px) triggering dizzy state
  grabRadius:       45,          // px radius for wall/edge grab saves
};

export interface WorldPos {
  x: number; // document X
  y: number; // document Y
}

export interface Velocity {
  x: number;
  y: number;
}

export interface Collider {
  width: number;
  height: number;
  offsetX: number; // relative to character feet center
  offsetY: number; // relative to character feet center
}

export const COLLIDERS: Record<string, Collider> = {
  standing:  { width: 32, height: 75, offsetX: 0, offsetY: -37.5 },
  sitting:   { width: 44, height: 45, offsetX: 0, offsetY: -22.5 },
  crouching: { width: 48, height: 40, offsetX: 0, offsetY: -20.0 },
  airborne:  { width: 36, height: 50, offsetX: 0, offsetY: -25.0 },
  clinging:  { width: 24, height: 60, offsetX: 0, offsetY: -30.0 },
};

export type AuthorityMode = 'ON_SURFACE' | 'AIRBORNE' | 'SWINGING' | 'CLINGING';

export interface PhysicsBody {
  worldX: number;
  worldY: number;
  prevWorldX: number;
  prevWorldY: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  grounded: boolean;
  supported: boolean;
  currentSurface: Surface | null;
  surfaceOffsetX: number; // fraction 0..1 across surface width
  authority: AuthorityMode;
}

export class PhysicsEngine {
  private accumulator = 0;

  /** Run fixed timestep accumulator loop */
  update(
    body: PhysicsBody,
    dtMs: number,
    surfaces: SurfaceManager,
    onStep: (dtSec: number) => void,
  ): { alpha: number } {
    this.accumulator += Math.min(100, dtMs); // cap max lag spike at 100ms

    while (this.accumulator >= PHYS_CONFIG.fixedDtMs) {
      body.prevWorldX = body.worldX;
      body.prevWorldY = body.worldY;
      onStep(PHYS_CONFIG.fixedDtMs / 1000);
      this.accumulator -= PHYS_CONFIG.fixedDtMs;
    }

    const alpha = this.accumulator / PHYS_CONFIG.fixedDtMs;
    return { alpha };
  }

  /**
   * Integrate velocity and position when AIRBORNE (Physics-authoritative).
   * Performs continuous swept AABB floor collision checks.
   */
  integrateAirborne(body: PhysicsBody, surfaces: SurfaceManager): Surface | null {
    body.vy += PHYS_CONFIG.gravity;
    body.vy  = Math.min(body.vy, PHYS_CONFIG.maxFallSpeed);
    body.vx *= PHYS_CONFIG.airDrag;

    const nextX = body.worldX + body.vx;
    const nextY = body.worldY + body.vy;

    // Swept floor collision check
    const floor = surfaces.findFloorBelow(body.worldX, nextY, body.vy);
    if (floor && body.vy > 0) {
      body.worldY    = floor.worldY;
      body.worldX    = nextX;
      body.vy        = 0;
      body.grounded  = true;
      body.supported = true;
      body.currentSurface = floor;
      body.surfaceOffsetX = Math.max(
        0.05,
        Math.min(0.95, (nextX - floor.worldX) / floor.width),
      );
      body.authority = 'ON_SURFACE';
      return floor;
    }

    body.worldX = nextX;
    body.worldY = nextY;
    body.grounded  = false;
    body.supported = false;

    // Screen boundary clamps (world X)
    const vw = window.innerWidth;
    if (body.worldX < 20) { body.worldX = 20; body.vx = Math.abs(body.vx) * 0.5; }
    if (body.worldX > vw - 20) { body.worldX = vw - 20; body.vx = -Math.abs(body.vx) * 0.5; }

    return null;
  }

  /**
   * Update position when ON_SURFACE (DOM Surface-authoritative).
   * Moves Spider-Man with the DOM surface on scroll / layout shifts.
   */
  updateSurfacePosition(body: PhysicsBody): boolean {
    const s = body.currentSurface;
    if (!s || !s.isConnected()) {
      body.currentSurface = null;
      body.supported      = false;
      body.grounded       = false;
      body.authority      = 'AIRBORNE';
      return false; // lost support
    }

    // Follow DOM surface geometry precisely
    body.worldX = s.worldX + s.width * body.surfaceOffsetX;
    body.worldY = s.worldY; // feet at surface top
    body.vx     = 0;
    body.vy     = 0;
    body.supported = true;
    body.grounded  = true;

    return true;
  }
}
