/**
 * animator.ts — which frame is on screen right now.
 *
 * Art runs at its own per-clip rate (6fps for a breathing idle, 18fps for a
 * thwip) while the engine keeps stepping physics at 60Hz and the renderer
 * interpolates position between steps. Locking the art to the render rate is
 * what makes sprite animation look like a slideshow of a character instead of a
 * character; holding a pose for two frames is what gives it snap.
 */

import { CLIPS } from './atlas-data.js';
import { resolveDir, type Dir8 } from './direction.js';

export interface Playing {
  clip: string;
  dir: Dir8;
}

export class Animator {
  private clip = 'idle';
  private dir: Dir8 = 'south-east';
  private idx = 0;
  private t = 0;
  private speed = 1;
  private done = false;
  private onDone: (() => void) | null = null;
  /** clip to fall back to when a one-shot finishes */
  private next: string | null = null;

  /**
   * Switch clips. Restarts only when the clip actually changes, so turning
   * around mid-walk doesn't reset the gait to frame 0 and moonwalk.
   */
  play(clip: string, dir: Dir8, opts: { restart?: boolean; then?: string; onDone?: () => void } = {}): void {
    this.dir = dir;
    if (clip === this.clip && !opts.restart) return;
    if (!CLIPS[clip]) return;
    this.clip = clip;
    this.idx = 0;
    this.t = 0;
    this.done = false;
    this.next = opts.then ?? null;
    this.onDone = opts.onDone ?? null;
  }

  /** Playback rate multiplier — running gait scales with actual speed. */
  setSpeed(v: number): void {
    this.speed = Math.max(0.25, Math.min(3, v));
  }

  update(dtMs: number): void {
    const c = CLIPS[this.clip];
    if (!c) return;
    const seq = this.sequence();
    if (seq.length <= 1) return;

    this.t += dtMs * this.speed;
    const per = c.dur;
    while (this.t >= per) {
      this.t -= per;
      if (this.idx < seq.length - 1) {
        this.idx++;
      } else if (c.loop) {
        this.idx = 0;
      } else if (!this.done) {
        this.done = true;
        const cb = this.onDone;
        this.onDone = null;
        const then = this.next;
        this.next = null;
        if (cb) cb();
        if (then) this.play(then, this.dir, { restart: true });
        return;
      }
    }
  }

  private sequence(): string[] {
    const c = CLIPS[this.clip];
    if (!c) return [];
    const { dir } = resolveDir(this.clip, this.dir);
    return c.dirs[dir] ?? Object.values(c.dirs)[0] ?? [];
  }

  /** Atlas key for the current frame. */
  frame(): string {
    const seq = this.sequence();
    if (!seq.length) return '';
    return seq[Math.min(this.idx, seq.length - 1)];
  }

  /** Whether this frame should be drawn mirrored. */
  flip(): boolean {
    return resolveDir(this.clip, this.dir).flip;
  }

  current(): Playing {
    return { clip: this.clip, dir: this.dir };
  }

  /** True once a non-looping clip has reached its last frame. */
  finished(): boolean {
    const c = CLIPS[this.clip];
    return !!c && !c.loop && this.done;
  }

  /** 0..1 through the current clip — used to drive squash/stretch envelopes. */
  progress(): number {
    const seq = this.sequence();
    if (seq.length <= 1) return 1;
    return this.idx / (seq.length - 1);
  }
}
