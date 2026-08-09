/**
 * animator.ts — state → frame mapping and timing (PRD §3.1).
 * Animation advances at ~11fps (deliberate retro feel); positions are
 * interpolated by the physics/render loop at 60fps.
 */

import { ANIMS, ANIM_FPS } from './sprite-data.js';
import type { HeroState } from '../character/state.js';

const NON_LOOP = new Set(['jump', 'land', 'crouch', 'cling']);

const STATE_ANIM: Record<HeroState, string> = {
  idle: 'idle',
  walking: 'walk',
  running: 'walk',
  jumping: 'jump',
  falling: 'fall',
  swinging: 'swing',
  landing: 'land',
  clinging: 'cling',
  crouching: 'crouch',
};

export class Animator {
  private anim = 'idle';
  private idx = 0;
  private t = 0;
  private speed = 1;

  setState(s: HeroState): void {
    const a = STATE_ANIM[s];
    this.speed = s === 'running' ? 1.7 : 1;
    if (a !== this.anim) {
      this.anim = a;
      this.idx = 0;
      this.t = 0;
    }
  }

  update(dtMs: number): void {
    this.t += dtMs * this.speed;
    const frameMs = 1000 / ANIM_FPS;
    const seq = ANIMS[this.anim];
    if (!seq) return;
    while (this.t >= frameMs) {
      this.t -= frameMs;
      if (this.idx < seq.length - 1) this.idx++;
      else if (!NON_LOOP.has(this.anim)) this.idx = 0;
    }
  }

  frame(): string {
    const seq = ANIMS[this.anim];
    return seq[Math.min(this.idx, seq.length - 1)];
  }
}
