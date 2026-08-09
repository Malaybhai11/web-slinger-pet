/**
 * forces.ts — physics constants (PRD §4.2). All physics run at a fixed
 * 1/60s timestep; positions integrate with semi-implicit Euler.
 */

export const FIXED_DT = 1 / 60; // fixed timestep, seconds (PRD §4.1)

export const GRAVITY = 980;          // px/s²
export const MAX_FALL = 1200;        // px/s terminal velocity
export const WALK_SPEED = 200;       // px/s
export const RUN_SPEED = 400;        // px/s
export const JUMP_IMPULSE = -550;    // px/s upward
export const AIR_CONTROL = 0.3;      // fraction of ground accel available in air
export const DRAG_AIR = 0.99;        // velocity multiplier per 60fps frame
export const DRAG_GROUND = 0.85;     // per 60fps frame
export const FRICTION_GROUND = 0.92; // sliding friction when not inputting
export const WALL_STICK_FRICTION = 0.1;
export const SWING_TENSION = 1800;   // spring constant for pendulum radius
export const SWING_DAMPING = 0.995;  // energy loss per frame on swing
export const SWING_MAX = 400;        // px — web can't stretch beyond this
export const SWING_MIN = 80;         // px — web can't compress below this

/** acceleration used to reach target ground speed responsively */
export const GROUND_ACCEL = 2600;    // px/s²
