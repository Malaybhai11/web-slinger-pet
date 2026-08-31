/**
 * needs.ts — the drives the director scores actions against.
 *
 * Four values in 0..1. They exist so behaviour has a *reason* rather than being
 * a shuffled playlist: he swings because he has energy to burn, sits because he
 * doesn't, and stops repeating himself because boredom rises every time he
 * picks the same action twice.
 */

export class Needs {
  /** capacity for big moves — spent by swinging and running, restored at rest */
  energy = 0.8;
  /** rises while doing the same thing; falls when something new happens */
  boredom = 0.2;
  /** rises when the page changes or the cursor moves; spent by investigating */
  curiosity = 0.3;
  /** rises when the user interacts; makes him seek the cursor and talk */
  sociability = 0.2;

  private lastAction = '';
  private repeats = 0;

  step(dt: number, opts: { resting: boolean; exerting: boolean }): void {
    const { resting, exerting } = opts;

    if (exerting) this.energy -= dt * 0.09;
    else if (resting) this.energy += dt * 0.14;
    else this.energy += dt * 0.03;

    this.boredom += dt * (resting ? 0.055 : 0.02);
    this.curiosity -= dt * 0.015;
    this.sociability -= dt * 0.02;

    this.clamp();
  }

  /** The page changed under him, or something moved. */
  notice(amount = 0.25): void {
    this.curiosity = Math.min(1, this.curiosity + amount);
    this.boredom = Math.max(0, this.boredom - amount * 0.5);
  }

  /** The user did something directly — clicked, typed, scrolled hard. */
  socialise(amount = 0.3): void {
    this.sociability = Math.min(1, this.sociability + amount);
    this.boredom = Math.max(0, this.boredom - amount * 0.4);
  }

  /**
   * Record what was chosen. Repeating an action drives boredom up sharply,
   * which is what stops him ping-ponging between the same two buttons.
   */
  record(action: string): void {
    if (action === this.lastAction) {
      this.repeats++;
      this.boredom = Math.min(1, this.boredom + 0.18 * this.repeats);
    } else {
      this.repeats = 0;
      this.boredom = Math.max(0, this.boredom - 0.35);
      this.lastAction = action;
    }
    this.clamp();
  }

  /** How many times in a row the current action has been chosen. */
  get repeatCount(): number {
    return this.repeats;
  }

  private clamp(): void {
    this.energy = Math.max(0, Math.min(1, this.energy));
    this.boredom = Math.max(0, Math.min(1, this.boredom));
    this.curiosity = Math.max(0, Math.min(1, this.curiosity));
    this.sociability = Math.max(0, Math.min(1, this.sociability));
  }

  snapshot(): Record<string, number> {
    return {
      energy: +this.energy.toFixed(2),
      boredom: +this.boredom.toFixed(2),
      curiosity: +this.curiosity.toFixed(2),
      sociability: +this.sociability.toFixed(2),
    };
  }
}
