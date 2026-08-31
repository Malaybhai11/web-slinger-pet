/**
 * pose.ts — the reactive layer on top of the baked frames.
 *
 * Bought animation frames are fixed, but a pet reads as alive when the art
 * responds to what the physics is actually doing. Rather than a full cutout rig
 * (the source sprite is 28px wide — cutting 4px limbs out of it looks worse
 * than not doing it), this applies whole-body transforms that a pixel artist
 * would hand-draw as squash-and-stretch:
 *
 *   • compress on impact, in proportion to how hard he hit
 *   • stretch along the direction of travel while airborne and fast
 *   • tilt the body to the tangent of the swing arc
 *
 * Volume is conserved — squashing vertically widens horizontally by the same
 * factor — which is the rule that makes it read as weight rather than a glitch.
 */

export interface Pose {
  squashX: number;
  squashY: number;
  rotation: number;
  pivotY: number;
}

export const NEUTRAL: Pose = { squashX: 1, squashY: 1, rotation: 0, pivotY: 0 };

/** How long the landing compression takes to spring back, in seconds. */
const LAND_RECOVER = 0.22;
/**
 * Kept deliberately subtle. The `land` clip is already a baked crouch-impact
 * pose — this squash stacks on top of that art, not in place of it, so a value
 * tuned for a bare rectangle (a third of the body width) reads as a glitch on
 * top of real character art. A hard fall skips this entirely and cuts straight
 * to the `faceplanting` clip instead, which carries the whole read on its own.
 */
const MAX_SQUASH = 0.12;
const MAX_STRETCH = 0.08;

export class PoseModulator {
  /** 0..1, set on impact and decaying */
  private impact = 0;
  private impactT = 0;

  /** Call on every landing with the vertical speed at contact. */
  land(impactSpeed: number): void {
    this.impact = Math.min(1, Math.abs(impactSpeed) / 900);
    this.impactT = LAND_RECOVER;
  }

  /** Call on takeoff for a brief anticipation stretch. */
  jump(): void {
    this.impact = -Math.min(1, 0.7);
    this.impactT = LAND_RECOVER * 0.6;
  }

  step(dt: number): void {
    if (this.impactT > 0) {
      this.impactT = Math.max(0, this.impactT - dt);
      if (this.impactT === 0) this.impact = 0;
    }
  }

  /**
   * Build the pose for this frame.
   * `vy` is vertical speed, `airborne` gates the speed stretch, `swingAngle`
   * is the pendulum angle in radians when swinging.
   */
  compute(opts: {
    vy: number;
    airborne: boolean;
    swingAngle: number | null;
    heightPx: number;
  }): Pose {
    const { vy, airborne, swingAngle, heightPx } = opts;
    let sx = 1;
    let sy = 1;

    // impact envelope: eases back out rather than snapping
    if (this.impactT > 0) {
      const k = this.impactT / LAND_RECOVER;         // 1 -> 0
      const eased = k * k;                            // fast release, soft tail
      const amount = this.impact * eased;
      if (amount > 0) {
        sy = 1 - MAX_SQUASH * amount;                 // landing: shorter, wider
      } else {
        sy = 1 + MAX_STRETCH * -amount;               // takeoff: taller, thinner
      }
      sx = 1 / sy;                                    // conserve volume
    }

    // airborne speed stretch, on top of the impact envelope
    if (airborne) {
      const s = Math.min(1, Math.abs(vy) / 1000);
      const stretch = 1 + MAX_STRETCH * s * 0.6;
      sy *= stretch;
      sx /= stretch;
    }

    // the swing rotates the whole body about the hands, not the feet
    const rotation = swingAngle === null ? 0 : (swingAngle - Math.PI / 2) * 0.8;
    const pivotY = swingAngle === null ? 0 : -heightPx + 4;

    return { squashX: sx, squashY: sy, rotation, pivotY };
  }
}
