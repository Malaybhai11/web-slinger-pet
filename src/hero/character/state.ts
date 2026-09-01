/**
 * state.ts — the hero entity + movement states (PRD §6.1).
 *
 * Position is the FEET point in PAGE coordinates (PRD §5.7):
 *   viewportY = pageY - window.scrollY
 */

import type { Surface } from '../world/surfaces.js';
import type { Pendulum } from '../physics/pendulum.js';
import { CHAR_HEIGHT } from '../animation/atlas-data.js';
import { SCALE } from '../animation/sprite.js';

/**
 * Distance from his feet to his hands, in CSS pixels — where the web leaves
 * from and what the pendulum actually drives.
 *
 * Derived from the art rather than hard-coded: the sprite is CHAR_HEIGHT source
 * pixels tall drawn at SCALE, and his hands sit a little above three-quarters
 * of the way up. The old fixed 50 was measured against a shorter sprite and
 * left the web line attached to the middle of his chest.
 */
export const HAND_HEIGHT = Math.round(CHAR_HEIGHT * SCALE * 0.78);

export type HeroState =
  // locomotion and physics — driven by input or the director
  | 'idle' | 'walking' | 'running'
  | 'jumping' | 'falling' | 'swinging'
  | 'landing' | 'clinging' | 'crouching'
  // performance states — the director plays these when nothing else is urgent.
  // They are grounded and interruptible; none of them move him.
  | 'stretching' | 'sitting' | 'taunting' | 'pressing' | 'sipping'
  | 'mimicking' | 'boxing'
  | 'faceplanting' | 'recovering' | 'skidding' | 'alerting';

/** States that are a one-shot performance rather than a movement mode. */
export const PERFORMANCE: ReadonlySet<HeroState> = new Set<HeroState>([
  'stretching', 'sitting', 'taunting', 'pressing', 'sipping',
  'mimicking', 'boxing',
  'faceplanting', 'recovering', 'skidding', 'alerting',
]);

export interface InputState {
  left: boolean;
  right: boolean;
  crouch: boolean;
  run: boolean;
}

export class Hero {
  x = 0;             // feet, page coords
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  state: HeroState = 'idle';
  stateT = 0;        // seconds in current state
  ground: Surface | null = null;
  pendulum: Pendulum | null = null;
  height = HAND_HEIGHT; // feet → web-hand origin, measured off the sprite
  stepT = 0;         // footstep sound timer
  jumpQueued = false;

  transition(to: HeroState): void {
    if (this.state === to) return;
    this.state = to;
    this.stateT = 0;
  }

  get grounded(): boolean {
    return (
      this.state === 'idle' ||
      this.state === 'walking' ||
      this.state === 'running' ||
      this.state === 'crouching' ||
      this.state === 'landing' ||
      PERFORMANCE.has(this.state)
    );
  }

  /** Performing a one-shot: the director should not start something new yet. */
  get performing(): boolean {
    return PERFORMANCE.has(this.state);
  }
}
