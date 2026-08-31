/**
 * renderer.ts — one full-viewport canvas above the page, drawing in order:
 * shadow → web line → aim dots → particles → hero → speech bubble.
 *
 * Page coordinates convert to viewport with `viewportY = pageY - scrollY`.
 *
 * Position is interpolated between fixed physics steps. The engine steps at a
 * fixed 60Hz but a display may refresh at 120Hz or land between steps; drawing
 * the raw last-step position is what makes otherwise-correct motion look like
 * it is stuttering.
 */

import { drawFrame, setPixelRatio } from '../animation/sprite.js';
import type { Animator } from '../animation/animator.js';
import type { Particles } from '../animation/particles.js';
import type { Pose } from '../animation/pose.js';
import { NEUTRAL } from '../animation/pose.js';
import { drawWebLine, drawMiss, drawAim } from './web-line.js';
import { drawShadow } from './shadow.js';
import type { Bubble } from './bubble.js';
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
    this.canvas.setAttribute('aria-hidden', 'true'); // invisible to screen readers
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
    this.canvas.style.height = '100dvh'; // mobile browser chrome
    this.ctx.imageSmoothingEnabled = false;
    setPixelRatio(this.dpr);
  };

  render(
    hero: Hero,
    shooter: WebShooter,
    animator: Animator,
    particles: Particles,
    map: SurfaceMap,
    timeMs: number,
    opts: { pose?: Pose; bubble?: Bubble; drawX?: number; drawY?: number } = {},
  ): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.imageSmoothingEnabled = false;
    const sy = window.scrollY;

    // interpolated draw position, falling back to the physics position
    const hx = (opts.drawX ?? hero.x) + this.shakeX;
    const hy = (opts.drawY ?? hero.y);

    // ground shadow on the real surface below
    const below = hero.ground ?? map.nearestBelow(hero.x, hero.y);
    if (below) {
      drawShadow(ctx, hx, topPage(below), hy, sy, this.shadowEnabled);
    }

    // active web while swinging
    if (hero.pendulum) {
      const p = hero.pendulum;
      drawWebLine(ctx, p.ax + this.shakeX, p.ay, hx, hy - hero.height, sy, timeMs);
    }

    // missed-shot whiff
    if (shooter.miss) drawMiss(ctx, shooter.miss, sy);

    // aim dots while grounded with a cursor present
    if (!hero.pendulum && hero.grounded && shooter.hasAim) {
      drawAim(ctx, hx + hero.facing * 10, hy - hero.height * 0.8, shooter.aimX, shooter.aimY, sy);
    }

    particles.draw(ctx, sy);

    const pose = opts.pose ?? NEUTRAL;
    drawFrame(ctx, animator.frame(), hx, hy - sy + this.shakeY, {
      flip: animator.flip(),
      rotation: pose.rotation,
      pivotY: pose.pivotY,
      squashX: pose.squashX,
      squashY: pose.squashY,
    });

    // the bubble sits above his head and is the last thing drawn
    opts.bubble?.draw(ctx, hx, hy - sy - hero.height - 34);
  }
}
