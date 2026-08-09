/**
 * follow.ts — lerped camera with a dead zone (PRD §7.1). The "camera" is
 * the page scroll itself: the hero leads, the viewport follows smoothly.
 */

import type { Hero } from '../character/state.js';

export class CameraFollow {
  private deadW = 0.4;  // fraction of viewport width
  private deadH = 0.3;  // fraction of viewport height
  private lerp = 0.08;

  step(hero: Hero): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const cx = hero.x - sx; // hero in viewport space
    const cy = hero.y - sy;

    let tx = sx;
    let ty = sy;
    const dzW = (vw * this.deadW) / 2;
    const dzH = (vh * this.deadH) / 2;

    // dead zone: no scroll while the hero is near center (PRD §7.1)
    if (cx < vw / 2 - dzW) tx = hero.x - (vw / 2 - dzW);
    else if (cx > vw / 2 + dzW) tx = hero.x - (vw / 2 + dzW);
    if (cy < vh / 2 - dzH) ty = hero.y - (vh / 2 - dzH);
    else if (cy > vh / 2 + dzH) ty = hero.y - (vh / 2 + dzH);

    // never scroll past the document (PRD §13)
    const maxX = Math.max(0, document.documentElement.scrollWidth - vw);
    const maxY = Math.max(0, document.documentElement.scrollHeight - vh);
    tx = Math.min(Math.max(tx, 0), maxX);
    ty = Math.min(Math.max(ty, 0), maxY);

    const nx = sx + (tx - sx) * this.lerp;
    const ny = sy + (ty - sy) * this.lerp;
    if (Math.abs(nx - sx) > 0.5 || Math.abs(ny - sy) > 0.5) {
      window.scrollTo(nx, ny);
    }
  }
}
