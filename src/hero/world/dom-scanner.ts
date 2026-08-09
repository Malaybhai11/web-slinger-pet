/**
 * dom-scanner.ts — keeps the surface map in sync with a living page
 * (PRD §8.1, §8.2): MutationObserver (debounced 200ms), IntersectionObserver
 * for viewport discovery, resize, plus a 1s safety interval.
 */

import type { SurfaceMap } from './surfaces.js';

export class DomScanner {
  private mo: MutationObserver | null = null;
  private io: IntersectionObserver | null = null;
  private interval = 0;
  private debounce = 0;
  private onResize = (): void => this.schedule();

  constructor(
    private map: SurfaceMap,
    private onStructureChange: () => void,
  ) {}

  start(): void {
    // DOM mutations → rebuild (debounced 200ms, PRD §8.2)
    this.mo = new MutationObserver(() => this.schedule());
    this.mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    // elements entering the viewport become landing options (PRD §8.4)
    this.io = new IntersectionObserver(() => this.schedule(), { threshold: 0 });
    document
      .querySelectorAll('section, nav, header, footer, form')
      .forEach((el) => this.io!.observe(el));

    window.addEventListener('resize', this.onResize);
    this.interval = window.setInterval(() => {
      this.map.rebuild();
      this.onStructureChange();
    }, 1000);
  }

  private schedule(): void {
    window.clearTimeout(this.debounce);
    this.debounce = window.setTimeout(() => {
      this.map.rebuild();
      this.onStructureChange();
    }, 200);
  }

  stop(): void {
    this.mo?.disconnect();
    this.io?.disconnect();
    window.removeEventListener('resize', this.onResize);
    window.clearInterval(this.interval);
    window.clearTimeout(this.debounce);
  }
}
