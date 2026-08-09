/**
 * shake.ts — impact juice (PRD §7.2). Intensity scales with impact force,
 * decays ×0.9 per frame, lasts ~0.3s. Consumed by the renderer as an offset.
 */

export class CameraShake {
  enabled = true;
  private intensity = 0;
  private time = 0;

  trigger(impact: number): void {
    if (!this.enabled) return;
    this.intensity = Math.min(10, impact * 0.012);
    this.time = 0.3;
  }

  step(dt: number): { x: number; y: number } {
    if (this.time <= 0 || this.intensity < 0.2) return { x: 0, y: 0 };
    this.time -= dt;
    this.intensity *= Math.pow(0.9, dt * 60);
    return {
      x: (Math.random() * 2 - 1) * this.intensity,
      y: (Math.random() * 2 - 1) * this.intensity,
    };
  }
}
