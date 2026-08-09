/**
 * state.ts — the hero entity + movement states (PRD §6.1).
 *
 * Position is the FEET point in PAGE coordinates (PRD §5.7):
 *   viewportY = pageY - window.scrollY
 */

import type { Surface } from '../world/surfaces.js';
import type { Pendulum } from '../physics/pendulum.js';

export type HeroState =
  | 'idle' | 'walking' | 'running'
  | 'jumping' | 'falling' | 'swinging'
  | 'landing' | 'clinging' | 'crouching';

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
  height = 50;       // feet → web-hand origin
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
      this.state === 'landing'
    );
  }
}
