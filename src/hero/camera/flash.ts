/**
 * flash.ts — a full-viewport white flash for the villain KO beat. Same shape
 * as camera shake: trigger sets a peak, it eases back to 0 over a handful of
 * frames. Kept separate from CameraShake because a flash is a draw-order
 * overlay (drawn last, above everything) rather than a position offset.
 */

export class Flash {
  enabled = true;
  private amount = 0;

  trigger(peak = 1): void {
    if (!this.enabled) return;
    this.amount = Math.max(this.amount, Math.min(1, peak));
  }

  step(dt: number): number {
    if (this.amount <= 0.01) { this.amount = 0; return 0; }
    this.amount *= Math.pow(0.85, dt * 60);
    return this.amount;
  }
}
