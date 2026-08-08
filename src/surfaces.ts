/**
 * surfaces.ts — Intelligent DOM surface detection & scoring engine.
 *
 * All surface positions are stored in WORLD SPACE (document coordinates).
 * Supports explicit HTML attributes: data-spidey-surface="platform|wall|ceiling|button|card|no-spidey"
 * Features ResizeObserver, MutationObserver, and IntersectionObserver caching.
 */

export type SurfaceType = 'button' | 'link' | 'card' | 'platform' | 'wall' | 'ceiling' | 'container' | 'edge' | 'custom';

export interface SurfaceNormal {
  x: number; // -1, 0, 1
  y: number; // -1, 0, 1
}

export interface Surface {
  id: string;
  el: HTMLElement | null;   // null = viewport edge pseudo-surface
  worldX: number;           // left edge in document coords
  worldY: number;           // top  edge in document coords
  width:  number;
  height: number;
  type: SurfaceType;
  priority: number;         // 1 = highest, higher = lower priority
  canStand: boolean;
  canSit:   boolean;
  canCrawl: boolean;
  canCling: boolean;
  canHang:  boolean;
  isHome:   boolean;
  normal:   SurfaceNormal;
  isConnected(): boolean;   // false when element is removed from DOM
}

const SELECTOR_GROUPS: Array<{ selector: string; type: SurfaceType; priority: number }> = [
  { selector: '[data-spidey-surface="button"], [data-spidey-spawn]', type: 'button',    priority: 1 },
  { selector: '[data-spidey-surface="platform"]',                   type: 'platform',  priority: 1 },
  { selector: '[data-spidey-surface="wall"]',                       type: 'wall',      priority: 2 },
  { selector: '[data-spidey-surface="ceiling"]',                    type: 'ceiling',   priority: 2 },
  { selector: 'button, .btn, .action-card',                        type: 'button',    priority: 1 },
  { selector: 'a[href]',                                            type: 'link',      priority: 2 },
  { selector: '.card, article',                                     type: 'card',      priority: 3 },
  { selector: 'h1, h2, h3',                                        type: 'container', priority: 5 },
  { selector: 'nav, header, footer',                                type: 'container', priority: 4 },
  { selector: '[data-web-target]',                                  type: 'custom',    priority: 2 },
];

const MIN_W = 36;
const MIN_H = 10;

function makeEdge(id: string, opts: Partial<Surface>): Surface {
  return {
    id,
    el: null,
    worldX: 0, worldY: 0, width: 0, height: 0,
    type: 'edge', priority: 8,
    canStand: false, canSit: false, canCrawl: true, canCling: true, canHang: false,
    isHome: false,
    normal: { x: 0, y: -1 },
    isConnected: () => true,
    ...opts,
  } as Surface;
}

export class SurfaceManager {
  private surfaces: Surface[] = [];
  private mutObs: MutationObserver | null = null;
  private resizeObs: ResizeObserver | null = null;
  private intObs: IntersectionObserver | null = null;
  private pendingScan = false;
  private visibleElements = new Set<HTMLElement>();

  constructor() {
    this.scan();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.scheduleScan, { passive: true });

    // MutationObserver — detect DOM additions & removals
    this.mutObs = new MutationObserver(() => this.scheduleScan());
    this.mutObs.observe(document.body, { childList: true, subtree: true });

    // ResizeObserver — detect layout shifts & size changes
    if ('ResizeObserver' in window) {
      this.resizeObs = new ResizeObserver(() => this.updateRects());
      this.resizeObs.observe(document.documentElement);
    }

    // IntersectionObserver — track visible elements efficiently
    if ('IntersectionObserver' in window) {
      this.intObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) this.visibleElements.add(e.target as HTMLElement);
            else this.visibleElements.delete(e.target as HTMLElement);
          });
        },
        { threshold: 0.1 },
      );
    }
  }

  /** Full DOM re-scan */
  scan(): void {
    this.surfaces = [];
    const seen = new Set<HTMLElement>();

    let idx = 0;
    for (const group of SELECTOR_GROUPS) {
      document.querySelectorAll(group.selector).forEach((rawEl) => {
        const el = rawEl as HTMLElement;
        if (seen.has(el)) return;
        if (el.id === 'web-slinger-canvas') return;

        // Skip explicit no-spidey elements
        if (el.getAttribute('data-spidey-surface') === 'no-spidey') return;

        // Skip ignored inline elements
        const tag = el.tagName.toLowerCase();
        if (tag === 'span' || tag === 'i' || tag === 'svg' || tag === 'path' || tag === 'script') return;

        const r = el.getBoundingClientRect();
        if (r.width < MIN_W || r.height < MIN_H) return;

        seen.add(el);
        this.intObs?.observe(el);

        const worldY = r.top + window.scrollY;
        const worldX = r.left;
        const attr   = el.getAttribute('data-spidey-surface');

        const isWall    = attr === 'wall';
        const isCeiling = attr === 'ceiling';

        let normal: SurfaceNormal = { x: 0, y: -1 };
        if (isWall) normal = { x: r.left < window.innerWidth / 2 ? 1 : -1, y: 0 };
        if (isCeiling) normal = { x: 0, y: 1 };

        const s: Surface = {
          id: `dom-${idx++}`,
          el,
          worldX,
          worldY,
          width:  r.width,
          height: r.height,
          type:   attr === 'platform' ? 'platform' : group.type,
          priority: group.priority,
          canStand: !isWall && !isCeiling,
          canSit:   !isWall && !isCeiling,
          canCrawl: true,
          canCling: isWall,
          canHang:  isCeiling,
          isHome:   el.hasAttribute('data-spidey-spawn'),
          normal,
          isConnected() { return el.isConnected; },
        };
        this.surfaces.push(s);
      });
    }

    // Pseudo page-edge surfaces
    const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const vw   = window.innerWidth;

    this.surfaces.push(
      makeEdge('edge-floor', {
        worldX: 0, worldY: docH - 4,
        width: vw, height: 4,
        canStand: true, canSit: true, canCrawl: true,
        normal: { x: 0, y: -1 },
      }),
      makeEdge('edge-left', {
        worldX: -30, worldY: 0,
        width: 30, height: docH,
        canCling: true, canCrawl: true,
        normal: { x: 1, y: 0 },
      }),
      makeEdge('edge-right', {
        worldX: vw, worldY: 0,
        width: 30, height: docH,
        canCling: true, canCrawl: true,
        normal: { x: -1, y: 0 },
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

  /** Fast rect update — refreshes element getBoundingClientRect() */
  updateRects(): void {
    const scrollY = window.scrollY;
    const vw      = window.innerWidth;
    const docH    = Math.max(document.documentElement.scrollHeight, window.innerHeight);

    for (const s of this.surfaces) {
      if (!s.el) {
        if (s.id === 'edge-floor') { s.worldY = docH - 4; s.width = vw; }
        if (s.id === 'edge-right') { s.worldX = vw; s.height = docH; }
        if (s.id === 'edge-left')  { s.height = docH; }
        continue;
      }
      if (!s.el.isConnected) continue;
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

  findSpawnSurface(): Surface | null {
    const home = this.surfaces.find(s => s.isHome && s.el);
    if (home) return home;
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

  centerX(s: Surface): number {
    return s.worldX + s.width / 2;
  }

  /**
   * Continuous floor collision detector in world space.
   */
  findFloorBelow(worldX: number, nextWorldY: number, vy: number): Surface | null {
    if (vy <= 0) return null;
    let best: Surface | null = null;
    let bestDist = Infinity;
    for (const s of this.surfaces) {
      if (!s.canStand || !s.isConnected()) continue;
      const tolerance = Math.max(24, vy * 1.6);
      if (
        worldX >= s.worldX - 10 &&
        worldX <= s.worldX + s.width + 10 &&
        nextWorldY >= s.worldY - tolerance &&
        nextWorldY <= s.worldY + s.height * 0.6
      ) {
        const d = Math.abs(nextWorldY - s.worldY);
        if (d < bestDist) { bestDist = d; best = s; }
      }
    }
    return best;
  }

  findNearby(worldX: number, worldY: number, radius: number): Surface | null {
    let best: Surface | null = null;
    let bestScore = Infinity;
    for (const s of this.surfaces) {
      if (!s.isConnected() || !s.el) continue;
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
   * Intelligent surface scoring engine:
   * Score = Distance + Priority * 30 + VisibilityBonus - SizeBonus
   */
  findBestLanding(worldX: number, worldY: number): Surface | null {
    let best: Surface | null = null;
    let bestScore = Infinity;
    for (const s of this.surfaces) {
      if (!s.canStand || !s.isConnected()) continue;
      const cx   = s.worldX + s.width / 2;
      const dist = Math.hypot(worldX - cx, worldY - s.worldY);
      const isVisible = s.el ? this.visibleElements.has(s.el) : true;
      const visBonus  = isVisible ? 0 : 80;
      const sizeBonus = Math.min(s.width, 220) * 0.25;

      const score = dist + s.priority * 35 + visBonus - sizeBonus;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  getAll(): Surface[] { return this.surfaces; }

  prune(): void {
    this.surfaces = this.surfaces.filter(s => s.isConnected());
  }

  destroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.scheduleScan);
    this.mutObs?.disconnect();
    this.resizeObs?.disconnect();
    this.intObs?.disconnect();
  }
}
