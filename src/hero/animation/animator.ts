/**
 * animator.ts — state → frame mapping and timing (PRD §3.1).
 * The active animation set + fps come from the sprite loader (24fps with the
 * real art, 11fps with the pixel fallback). Positions interpolate at 60fps.
 */

import { getAnims, getAnimFps } from './sprite.js';
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
    const seq = getAnims()[this.anim];
    if (!seq) return;
    this.t += dtMs * this.speed;
    const frameMs = 1000 / getAnimFps();
    while (this.t >= frameMs) {
      this.t -= frameMs;
      if (this.idx < seq.length - 1) this.idx++;
      else if (!NON_LOOP.has(this.anim)) this.idx = 0;
    }
  }

  frame(): string {
    const seq = getAnims()[this.anim];
    if (!seq) return 'idle0';
    return seq[Math.min(this.idx, seq.length - 1)];
  }
}
