/**
 * renderer.ts — the render pipeline (PRD §9). One full-viewport canvas with
 * pointer-events:none sits above the page; each frame draws, in order:
 * shadow → web line → aim dots → particles → hero sprite.
 * Coordinates convert page → viewport with viewportY = pageY - scrollY.
 */

import { drawFrame } from '../animation/sprite.js';
import type { Animator } from '../animation/animator.js';
import type { Particles } from '../animation/particles.js';
import { drawWebLine, drawMiss, drawAim } from './web-line.js';
import { drawShadow } from './shadow.js';
import type { Hero } from '../character/state.js';
import type { WebShooter } from '../character/web-shoot.js';
import { topPage, type SurfaceMap } from '../world/surfaces.js';

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  shadowEnabled = true;
  shakeX = 0;
  shakeY = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hero-canvas';
    this.canvas.setAttribute('aria-hidden', 'true'); // invisible to screen readers (PRD §12)
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.height = '100dvh'; // mobile browser chrome (PRD §11)
    this.ctx.imageSmoothingEnabled = false;
  };

  render(
    hero: Hero,
    shooter: WebShooter,
    animator: Animator,
    particles: Particles,
    map: SurfaceMap,
    timeMs: number,
  ): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const sy = window.scrollY;

    // ground shadow on the real surface below
    const below = hero.ground ?? map.nearestBelow(hero.x, hero.y);
    if (below) {
      drawShadow(ctx, hero.x + this.shakeX, topPage(below), hero.y, sy, this.shadowEnabled);
    }

    // active web while swinging
    if (hero.pendulum) {
      const p = hero.pendulum;
      drawWebLine(ctx, p.ax + this.shakeX, p.ay, hero.x + this.shakeX, hero.y - hero.height, sy, timeMs);
    }

    // missed-shot whiff
    if (shooter.miss) drawMiss(ctx, shooter.miss, sy);

    // aim dots while grounded with a cursor present
    if (!hero.pendulum && hero.grounded && shooter.hasAim) {
      drawAim(ctx, hero.x + hero.facing * 10, hero.y - hero.height * 0.8, shooter.aimX, shooter.aimY, sy);
    }

    particles.draw(ctx, sy);

    // body rotates to follow the arc tangent (PRD §3.2), pivoting at the hands
    const rotation = hero.pendulum ? (hero.pendulum.angle - Math.PI / 2) * 0.8 : 0;
    drawFrame(ctx, animator.frame(), hero.x + this.shakeX, hero.y - sy + this.shakeY, {
      flip: hero.facing < 0,
      rotation,
      pivotY: hero.pendulum ? -hero.height + 4 : 0,
    });
  }
}
