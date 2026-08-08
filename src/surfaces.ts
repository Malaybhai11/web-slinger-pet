/**
 * surfaces.ts — World-coordinate surface detection system.
 *
 * KEY DESIGN: All surface positions are stored in WORLD SPACE (document coords).
 * Convert to screen: screenY = worldY - window.scrollY
 *
 * Spider-Man attaches to a surface via (el, offsetX) so that when the DOM
 * element moves (scroll / resize / layout), his position is recomputed from
 * the element's live getBoundingClientRect().
 */

export type SurfaceType = 'button' | 'link' | 'card' | 'text' | 'container' | 'edge' | 'custom';

export interface Surface {
  id: string;
  el: HTMLElement | null;   // null = page edge
  // World-space rect (updated on every updateRects() call)
  worldX: number;           // left edge in document coords
  worldY: number;           // top  edge in document coords
  width:  number;
  height: number;
  type: SurfaceType;
  priority: number;         // 1 = best, higher = worse
  canStand:  boolean;
  canCrawl:  boolean;
  canCling:  boolean;
  isHome:    boolean;
  isConnected(): boolean;   // false when el removed from DOM
}

// ── Selector priority ──────────────────────────────────────────
const SELECTOR_GROUPS: Array<{ selector: string; type: SurfaceType; priority: number }> = [
  { selector: 'button, [data-spidey-spawn], [data-spidey-surface]', type: 'button',    priority: 1 },
  { selector: 'a[href]',                                             type: 'link',      priority: 2 },
  { selector: '.action-card',                                        type: 'button',    priority: 1 },
  { selector: '.btn',                                                type: 'button',    priority: 1 },
  { selector: '.card, article',                                      type: 'card',      priority: 3 },
  { selector: 'h1, h2, h3',                                         type: 'text',      priority: 5 },
  { selector: 'nav, header, footer',                                 type: 'container', priority: 4 },
  { selector: '[data-web-target]',                                   type: 'custom',    priority: 2 },
];

const MIN_W = 36;
const MIN_H = 10;

// ─────────────────────────────────────────────────────────────────────────────

function makeEdge(id: string, opts: Partial<Surface>): Surface {
  return {
    id,
    el: null,
    worldX: 0, worldY: 0, width: 0, height: 0,
    type: 'edge', priority: 8,
    canStand: false, canCrawl: true, canCling: true,
    isHome: false,
    isConnected: () => true,
    ...opts,
  } as Surface;
}

// ─────────────────────────────────────────────────────────────────────────────

export class SurfaceManager {
  private surfaces: Surface[] = [];
  private resizeObs: ResizeObserver | null = null;
  private mutObs: MutationObserver | null = null;
  private pendingScan = false;

  constructor() {
    this.scan();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.scheduleScan, { passive: true });

    // Observe DOM mutations so new elements are picked up automatically
    this.mutObs = new MutationObserver(() => this.scheduleScan());
    this.mutObs.observe(document.body, { childList: true, subtree: true });

    // ResizeObserver for layout shifts
    if ('ResizeObserver' in window) {
      this.resizeObs = new ResizeObserver(() => this.updateRects());
      this.resizeObs.observe(document.documentElement);
    }
  }

  // ── Scan ──────────────────────────────────────────────────────

  scan(): void {
    this.surfaces = [];
    const seen = new Set<HTMLElement>();

    // DOM elements
    let idx = 0;
    for (const group of SELECTOR_GROUPS) {
      document.querySelectorAll(group.selector).forEach((rawEl) => {
        const el = rawEl as HTMLElement;
        if (seen.has(el)) return;
        if (el.id === 'web-slinger-canvas') return;

        const r = el.getBoundingClientRect();
        if (r.width < MIN_W || r.height < MIN_H) return;

        seen.add(el);

        const worldY = r.top + window.scrollY;
        const worldX = r.left;

        const s: Surface = {
          id: `dom-${idx++}`,
          el,
          worldX,
          worldY,
          width:  r.width,
          height: r.height,
          type:   group.type,
          priority: group.priority,
          canStand: true,
          canCrawl: true,
          canCling: false,
          isHome: el.hasAttribute('data-spidey-spawn'),
          isConnected() { return el.isConnected; },
        };
        this.surfaces.push(s);
      });
    }

    // Page edge pseudo-surfaces
    const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const vw   = window.innerWidth;

    this.surfaces.push(
      makeEdge('edge-floor', {
        worldX: 0, worldY: docH - 4,
        width: vw, height: 4,
        canStand: true, canCrawl: true, canCling: false,
      }),
      makeEdge('edge-left', {
        worldX: -30, worldY: 0,
        width: 30, height: docH,
        canCling: true, canStand: false, canCrawl: true,
      }),
      makeEdge('edge-right', {
        worldX: vw, worldY: 0,
        width: 30, height: docH,
        canCling: true, canStand: false, canCrawl: true,
      }),
    );
  }

  private scheduleScan = (): void => {
    if (this.pendingScan) return;
    this.pendingScan = true;
    requestAnimationFrame(() => {
      this.pendingScan = false;
      this.scan();
    });
  };

  // ── Live rect update (cheap, call every frame or on scroll) ──

  updateRects(): void {
    const scrollY = window.scrollY;
    const vw      = window.innerWidth;
    const docH    = Math.max(document.documentElement.scrollHeight, window.innerHeight);

    for (const s of this.surfaces) {
      if (!s.el) {
        // edge pseudo-surfaces
        if (s.id === 'edge-floor')  { s.worldY = docH - 4; s.width = vw; }
        if (s.id === 'edge-right')  { s.worldX = vw; s.height = docH; }
        if (s.id === 'edge-left')   { s.height = docH; }
        continue;
      }
      if (!s.el.isConnected) continue; // will be pruned on next scan
      const r = s.el.getBoundingClientRect();
      s.worldX = r.left;
      s.worldY = r.top + scrollY;
      s.width  = r.width;
      s.height = r.height;
    }
  }

  private onScroll = (): void => {
    this.updateRects();
  };

  // ── World ↔ Screen helpers ────────────────────────────────────

  /** Convert world Y to screen (viewport) Y */
  static toScreen(worldY: number): number {
    return worldY - window.scrollY;
  }

  /** Convert screen Y to world Y */
  static toWorld(screenY: number): number {
    return screenY + window.scrollY;
  }

  // ── Surface position helpers ──────────────────────────────────

  /** World-space point where Spider-Man's feet rest on this surface's top */
  landingWorldY(s: Surface): number {
    return s.worldY;
  }

  /** Screen-space Y where Spider-Man should be drawn when on this surface */
  landingScreenY(s: Surface): number {
    return s.worldY - window.scrollY;
  }

  /** X center of the surface in world (= screen) space */
  centerX(s: Surface): number {
    return s.worldX + s.width / 2;
  }

  // ── Spawn ─────────────────────────────────────────────────────

  findSpawnSurface(): Surface | null {
    // Explicit spawn marker first
    const home = this.surfaces.find(s => s.isHome && s.el);
    if (home) return home;
    // First visible-ish large button
    return this.surfaces.find(
      s => s.el && s.type === 'button' && s.width > 80 &&
           s.worldY > window.scrollY - 50 &&
           s.worldY < window.scrollY + window.innerHeight + 50,
    ) ?? null;
  }

  getHomeSurface(): Surface | null {
    return this.surfaces.find(s => s.isHome) ?? null;
  }

  getSurfaceFromElement(el: HTMLElement): Surface | null {
    return this.surfaces.find(s => s.el === el) ?? null;
  }

  // ── Collision in world space ──────────────────────────────────

  /**
   * Find a surface that worldX/worldY is falling into (downward vy).
   * Returns the surface if Spider-Man is passing through its top edge.
   */
  findFloorBelow(worldX: number, worldY: number, vy: number): Surface | null {
    if (vy <= 0) return null;
    let best: Surface | null = null;
    let bestDist = Infinity;
    for (const s of this.surfaces) {
      if (!s.canStand) continue;
      if (!s.isConnected()) continue;
      const tolerance = Math.max(20, vy * 1.5);
      if (
        worldX >= s.worldX - 8 &&
        worldX <= s.worldX + s.width + 8 &&
        worldY >= s.worldY - tolerance &&
        worldY <= s.worldY + s.height * 0.5
      ) {
        const d = Math.abs(worldY - s.worldY);
        if (d < bestDist) { bestDist = d; best = s; }
      }
    }
    return best;
  }

  /**
   * Find a surface within grab distance of worldX/worldY.
   * Used for "save grab" when falling near a wall/button.
   */
  findNearby(worldX: number, worldY: number, radius: number): Surface | null {
    let best: Surface | null = null;
    let bestScore = Infinity;
    for (const s of this.surfaces) {
      if (!s.isConnected()) continue;
      if (!s.el) continue;  // skip pseudo-edges for grab
      // closest point on surface rect to the character
      const cx = Math.max(s.worldX, Math.min(s.worldX + s.width,  worldX));
      const cy = Math.max(s.worldY, Math.min(s.worldY + s.height, worldY));
      const dist = Math.hypot(worldX - cx, worldY - cy);
      if (dist <= radius && dist < bestScore) {
        bestScore = dist;
        best = s;
      }
    }
    return best;
  }

  /**
   * Find the best surface to land on after a swing toward (worldX, worldY).
   * Scores by distance + surface priority + size.
   */
  findBestLanding(worldX: number, worldY: number): Surface | null {
    let best: Surface | null = null;
    let bestScore = Infinity;
    for (const s of this.surfaces) {
      if (!s.canStand || !s.isConnected()) continue;
      const cx   = s.worldX + s.width / 2;
      const dist = Math.hypot(worldX - cx, worldY - s.worldY);
      const score = dist + s.priority * 30 - Math.min(s.width, 200) * 0.2;
      if (score < bestScore) { bestScore = score; best = s; }
    }
    return best;
  }

  getAll(): Surface[] { return this.surfaces; }

  /** Prune disconnected element surfaces */
  prune(): void {
    this.surfaces = this.surfaces.filter(s => s.isConnected());
  }

  destroy(): void {
    window.removeEventListener('scroll',  this.onScroll);
    window.removeEventListener('resize',  this.scheduleScan);
    this.mutObs?.disconnect();
    this.resizeObs?.disconnect();
  }
}
