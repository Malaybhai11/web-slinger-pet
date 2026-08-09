/**
 * interactions.ts — the page reacts to the hero (PRD §8.3). All effects are
 * class toggles on real DOM elements; the styles live in hero.css.
 */

import type { Surface } from './surfaces.js';

export class Interactions {
  private standingOn: Surface | null = null;

  /** one-shot effects fired when the hero lands on an element */
  land(s: Surface): void {
    s.el.classList.add('hero-glow');
    window.setTimeout(() => s.el.classList.remove('hero-glow'), 700);
    if (s.type === 'heading') {
      s.el.classList.remove('hero-bounce');
      void (s.el as HTMLElement).offsetWidth; // restart the animation
      s.el.classList.add('hero-bounce');
    }
    if (s.type === 'form') (s.el as HTMLElement).focus?.(); // real DOM focus ring
  }

  /** persistent effects while the hero stands on an element — call every step */
  stand(s: Surface | null): void {
    if (s === this.standingOn) return;
    if (this.standingOn) {
      this.standingOn.el.classList.remove('hero-lift', 'hero-underline');
      if (this.standingOn.type === 'form') (this.standingOn.el as HTMLElement).blur?.();
    }
    this.standingOn = s;
    if (s) {
      if (s.type === 'card') s.el.classList.add('hero-lift');
      if (s.type === 'link') s.el.classList.add('hero-underline');
    }
  }
}
