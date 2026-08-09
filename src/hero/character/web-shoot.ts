/**
 * web-shoot.ts — shoot / attach / retract / release / miss (PRD §4.4).
 */

import { castWeb, type WebAnchor } from '../physics/raycast.js';
import { Pendulum } from '../physics/pendulum.js';
import type { Hero } from './state.js';

export interface ShootEvents {
  onAttach(anchor: WebAnchor): void;
  onMiss(): void;
  onRelease(): void;
}

export interface MissShot {
  x0: number; y0: number; // hand origin
  x1: number; y1: number; // where the web flew (page coords)
  t: number;              // 0..1 — extend then retract over 0.3s
}

export class WebShooter {
  aimX = 0;            // cursor target, page coords
  aimY = 0;
  hasAim = false;
  miss: MissShot | null = null;

  shoot(hero: Hero, x: number, y: number, ev: ShootEvents): void {
    // clicking while swinging releases the web (PRD §4.4)
    if (hero.pendulum) {
      this.release(hero, ev);
      return;
    }
    const anchor = castWeb(hero.x, hero.y - hero.height, x, y);
    if (!anchor) {
      this.miss = {
        x0: hero.x + hero.facing * 10,
        y0: hero.y - hero.height * 0.8,
        x1: x,
        y1: y,
        t: 0,
      };
      ev.onMiss();
      return;
    }
    const p = new Pendulum();
    // the pendulum drives the HAND point; feet ride 50px below
    p.attach(anchor.ax, anchor.ay, hero.x, hero.y - hero.height, hero.vx, hero.vy);
    hero.pendulum = p;
    hero.ground = null;
    hero.vx = 0;
    hero.vy = 0;
    hero.transition('swinging');
    // if he was standing still there's no momentum to inherit —
    // give a gentle leap into the arc so the swing always has life
    if (Math.abs(p.angVel) < 0.3) p.angVel = -hero.facing * 1.4;
    ev.onAttach(anchor);
  }

  release(hero: Hero, ev: ShootEvents): void {
    const p = hero.pendulum;
    if (!p) return;
    const v = p.velocity();       // inherit current velocity → freefall (PRD §4.4)
    hero.vx = v.vx;
    hero.vy = v.vy;
    hero.pendulum = null;
    hero.transition('falling');
    ev.onRelease();
  }

  step(dt: number): void {
    if (this.miss) {
      this.miss.t += dt / 0.3;    // whiff retracts in 0.3s
      if (this.miss.t >= 1) this.miss = null;
    }
  }
}
