/**
 * engine.ts — fixed-timestep loop (PRD §4.1). Real frame time accumulates
 * and physics steps in fixed 1/60s chunks; rendering happens once per rAF.
 */

import { FIXED_DT } from './physics/forces.js';

export class Engine {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  constructor(
    private stepFn: (dt: number) => void,
    private renderFn: (timeMs: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      if (!this.last) this.last = t;
      this.acc += Math.min(100, t - this.last); // clamp tab-switch gaps
      this.last = t;
      const stepMs = FIXED_DT * 1000;
      let steps = 0;
      while (this.acc >= stepMs && steps < 4) {
        this.stepFn(FIXED_DT);
        this.acc -= stepMs;
        steps++;
      }
      if (steps === 4) this.acc = 0; // drop backlog instead of spiraling
      this.renderFn(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
