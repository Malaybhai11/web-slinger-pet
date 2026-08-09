/**
 * effects.ts — maps hero events to sounds (PRD §10). Thin layer so physics
 * code never touches audio primitives directly.
 */

import type { Sounds } from './sounds.js';

export class Sfx {
  private stepAlt = false;

  constructor(private sounds: Sounds) {}

  shoot(): void { this.sounds.thwip(); }
  miss(): void { this.sounds.whiff(); }
  land(impact: number): void { this.sounds.thud(impact); }
  jump(): void { this.sounds.boing(); }
  step(): void {
    this.stepAlt = !this.stepAlt;
    this.sounds.step(this.stepAlt);
  }
  bounce(): void { this.sounds.pop(); }
}
