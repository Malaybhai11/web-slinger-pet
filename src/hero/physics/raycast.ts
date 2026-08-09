/**
 * raycast.ts — web targeting (PRD §4.5). On click/tap we ask the DOM itself
 * what's under the cursor: document.elementFromPoint is the native hit test.
 */

import { SWING_MAX } from './forces.js';

export interface WebAnchor {
  ax: number;      // page coords
  ay: number;
  el: Element;
}

/**
 * Cast from the hero toward a target point (page coords). Returns an anchor
 * on the hit element's top-center, or null on a miss / out of range.
 */
export function castWeb(fromX: number, fromY: number, toX: number, toY: number): WebAnchor | null {
  const vpX = toX - window.scrollX;
  const vpY = toY - window.scrollY;
  if (vpX < 0 || vpY < 0 || vpX > window.innerWidth || vpY > window.innerHeight) return null;

  const el = document.elementFromPoint(vpX, vpY);
  if (!el || el.id === 'hero-canvas') return null;

  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;

  // anchor = top-center of the element (PRD §4.4), in page coords
  const ax = r.left + r.width / 2 + window.scrollX;
  const ay = r.top + window.scrollY;

  if (Math.hypot(ax - fromX, ay - fromY) > SWING_MAX) return null; // out of web range
  return { ax, ay, el };
}
