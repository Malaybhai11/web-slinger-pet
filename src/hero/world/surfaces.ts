/**
 * surfaces.ts — the ground system (PRD §5). Scans the DOM and builds a map
 * of real, standable surfaces in PAGE coordinates.
 *
 * THE GOLDEN RULE: the hero never stands on empty space. Every ground
 * contact is a real DOM element from this map.
 */

export type SurfaceType =
  | 'button' | 'heading' | 'link' | 'image' | 'card'
  | 'nav' | 'form' | 'text' | 'media';

export interface Surface {
  el: Element;
  type: SurfaceType;
  /** PAGE rect for normal elements, VIEWPORT rect for position:fixed */
  left: number;
  top: number;
  right: number;
  bottom: number;
  fixed: boolean;
  solidity: number;    // 0..1 — how solid (PRD §5.4)
  restitution: number; // buttons bounce a little (PRD §5.3)
}

const MIN_W = 20; // thinner than this is a divider, not a floor (PRD §13)
const MIN_H = 4;  // 8×4 minimum standable area (PRD §5.5)

const TAG_TYPES: Record<string, SurfaceType> = {
  BUTTON: 'button',
  A: 'link',
  IMG: 'image',
  VIDEO: 'media',
  NAV: 'nav',
  HEADER: 'nav',
  FOOTER: 'nav',
  H1: 'heading', H2: 'heading', H3: 'heading',
  H4: 'heading', H5: 'heading', H6: 'heading',
  INPUT: 'form', SELECT: 'form', TEXTAREA: 'form', LABEL: 'form',
  P: 'text', LI: 'text', BLOCKQUOTE: 'text', PRE: 'text',
};

const SOLIDITY: Record<SurfaceType, number> = {
  button: 0.9, heading: 1, link: 0.9, image: 1, card: 0.9,
  nav: 1, form: 0.8, text: 0.8, media: 1,
};

/** page-space accessors (fixed elements ride the viewport) */
export function topPage(s: Surface): number { return s.fixed ? s.top + window.scrollY : s.top; }
export function bottomPage(s: Surface): number { return s.fixed ? s.bottom + window.scrollY : s.bottom; }
export function leftPage(s: Surface): number { return s.fixed ? s.left + window.scrollX : s.left; }
export function rightPage(s: Surface): number { return s.fixed ? s.right + window.scrollX : s.right; }
export function centerXPage(s: Surface): number { return (leftPage(s) + rightPage(s)) / 2; }

export class SurfaceMap {
  surfaces: Surface[] = [];

  rebuild(): void {
    const out: Surface[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sx = window.scrollX;
    const sy = window.scrollY;

    const all = document.body.querySelectorAll('*');
    for (const el of Array.from(all)) {
      if (el.id === 'hero-canvas') continue;                 // never stand on ourselves
      if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue; // skip svg internals
      if (el.getAttribute('tabindex') === '-1') continue;    // PRD §12 focus trap rule

      const r = el.getBoundingClientRect();
      if (r.width < MIN_W || r.height < MIN_H) continue;     // too small to stand on

      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (parseFloat(cs.opacity) <= 0.1) continue;           // transparent → fall through
      if (cs.pointerEvents === 'none') continue;             // PRD §5.5

      const type = classify(el, cs);
      if (!type) continue;

      const fixed = cs.position === 'fixed';

      // occlusion: if another element covers this one's top-center, it's not a
      // standable surface right now (z-stacking, PRD §13). Viewport-only check.
      const inView = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      if (inView && !fixed) {
        const px = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
        const py = Math.min(Math.max(r.top + 2, 1), vh - 1);
        const hit = document.elementFromPoint(px, py);
        if (hit && hit !== el && !el.contains(hit)) continue;
      }

      out.push({
        el,
        type,
        fixed,
        left: fixed ? r.left : r.left + sx,
        top: fixed ? r.top : r.top + sy,
        right: fixed ? r.right : r.right + sx,
        bottom: fixed ? r.bottom : r.bottom + sy,
        solidity: SOLIDITY[type],
        restitution: type === 'button' ? 0.1 : 0,
      });
    }
    this.surfaces = out;
  }

  /** standing query — surface whose TOP edge is at feetY and which covers x */
  groundAt(x: number, feetY: number, up = 8, down = 12): Surface | null {
    let best: Surface | null = null;
    let bestTop = Infinity;
    for (const s of this.surfaces) {
      const t = topPage(s);
      if (t < feetY - up || t > feetY + down) continue;
      if (x < leftPage(s) + 1 || x > rightPage(s) - 1) continue;
      if (t < bestTop) { bestTop = t; best = s; }
    }
    return best;
  }

  /** swept landing — did the feet cross any surface top between two steps? */
  sweepLand(x: number, prevFeet: number, newFeet: number): Surface | null {
    let best: Surface | null = null;
    let bestTop = Infinity;
    for (const s of this.surfaces) {
      const t = topPage(s);
      if (t < prevFeet - 1 || t > newFeet + 1) continue;
      if (x < leftPage(s) || x > rightPage(s)) continue;
      if (t < bestTop) { bestTop = t; best = s; }
    }
    return best;
  }

  /** a surface's vertical face beside the hero (wall for clinging) */
  wallAhead(x: number, dir: 1 | -1, feetY: number, height: number): Surface | null {
    const head = feetY - height;
    const probe = x + dir * 3;
    for (const s of this.surfaces) {
      const t = topPage(s);
      const b = bottomPage(s);
      if (b < head + 8 || t > feetY - 8) continue;
      const l = leftPage(s);
      const r = rightPage(s);
      if (dir === 1 && Math.abs(l - probe) <= 4) return s;
      if (dir === -1 && Math.abs(r - probe) <= 4) return s;
    }
    return null;
  }

  /** nearest surface top at or below y — for shadows and spawn logic */
  nearestBelow(x: number, y: number): Surface | null {
    let best: Surface | null = null;
    let bestTop = Infinity;
    for (const s of this.surfaces) {
      const t = topPage(s);
      if (t < y - 2) continue;
      if (x < leftPage(s) || x > rightPage(s)) continue;
      if (t < bestTop) { bestTop = t; best = s; }
    }
    return best;
  }

  firstOfType(type: SurfaceType): Surface | null {
    let best: Surface | null = null;
    for (const s of this.surfaces) {
      if (s.type !== type) continue;
      if (!best || topPage(s) < topPage(best)) best = s;
    }
    return best;
  }
}

function classify(el: Element, cs: CSSStyleDeclaration): SurfaceType | null {
  const tag = el.tagName;
  const t = TAG_TYPES[tag];
  if (t) return t;
  // generic containers are solid only if they LOOK solid — border or
  // background with real area (PRD §5.3: empty divs are NOT ground)
  if (/^(DIV|SECTION|ARTICLE|MAIN|ASIDE|FORM|FIELDSET|FIGURE)$/.test(tag)) {
    const bg = cs.backgroundColor;
    const hasBg = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
    if (hasBg || hasBorder) return 'card';
  }
  return null;
}
