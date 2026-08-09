/**
 * pendulum.ts — constrained pendulum for web swings (PRD §4.3).
 *
 * State: radius (constrained to [SWING_MIN, SWING_MAX]),
 * angle = atan2(dy, dx) from the anchor, angular velocity projected
 * from the hero's linear velocity at attach time.
 */

import {
  GRAVITY,
  SWING_DAMPING,
  SWING_MAX,
  SWING_MIN,
} from './forces.js';

export interface SwingInput {
  left: boolean;
  right: boolean;
}

export class Pendulum {
  ax = 0;
  ay = 0;
  radius = 0;
  restLen = 0;
  angle = 0;
  angVel = 0;

  attach(ax: number, ay: number, x: number, y: number, vx: number, vy: number): void {
    this.ax = ax;
    this.ay = ay;
    const dx = x - ax;
    const dy = y - ay;
    this.radius = Math.min(SWING_MAX, Math.max(SWING_MIN, Math.hypot(dx, dy)));
    this.restLen = this.radius;
    this.angle = Math.atan2(dy, dx);
    // project the linear velocity onto the tangent → angular velocity
    const tx = -Math.sin(this.angle);
    const ty = Math.cos(this.angle);
    this.angVel = (vx * tx + vy * ty) / this.radius;
  }

  /**
   * Advance the pendulum one fixed step. Positions the HAND point;
   * the caller derives feet from it.
   */
  step(dt: number, input: SwingInput): { x: number; y: number; vx: number; vy: number } {
    // 1. project gravity onto the tangent → angular acceleration.
    //    angle is measured from +x; straight down = +90°, so a = g·cos(angle)/r.
    const angAccel = (GRAVITY * Math.cos(this.angle)) / this.radius;
    this.angVel += angAccel * dt;

    // 2. player pumps the swing with left/right
    const pump = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (pump !== 0) this.angVel += pump * 1.9 * dt;

    // 3. damping (energy loss per frame, framerate-normalized)
    this.angVel *= Math.pow(SWING_DAMPING, dt * 60);

    // 4. no input → web retracts, pulling the hero toward the anchor (PRD §4.4)
    if (pump === 0) {
      this.restLen = Math.max(SWING_MIN, this.restLen - 30 * dt);
    }
    // radius spring toward restLen (swing tension), hard-clamped
    const stretch = this.radius - this.restLen;
    this.radius -= stretch * Math.min(1, 0.02 * dt * 60);
    this.radius = Math.min(SWING_MAX, Math.max(SWING_MIN, this.radius));

    // 5. integrate angle, derive position on the arc
    this.angle += this.angVel * dt;
    const x = this.ax + this.radius * Math.cos(this.angle);
    const y = this.ay + this.radius * Math.sin(this.angle);
    return { x, y, vx: this.velocity().vx, vy: this.velocity().vy };
  }

  /** linear velocity of the bob (hand point) along the tangent */
  velocity(): { vx: number; vy: number } {
    return {
      vx: -this.radius * Math.sin(this.angle) * this.angVel,
      vy: this.radius * Math.cos(this.angle) * this.angVel,
    };
  }
}
