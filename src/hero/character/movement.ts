/**
 * movement.ts — walk / run / jump / crouch / fall / cling (PRD §5.6, §6).
 * Semi-implicit Euler: velocity updates before position (PRD §4.1).
 */

import {
  GRAVITY, MAX_FALL, WALK_SPEED, RUN_SPEED, JUMP_IMPULSE,
  AIR_CONTROL, GROUND_ACCEL, FRICTION_GROUND, DRAG_AIR,
} from '../physics/forces.js';
import { findGround, sweepLanding, wallForCling } from '../physics/collision.js';
import { topPage, leftPage, rightPage, type Surface, type SurfaceMap } from '../world/surfaces.js';
import type { Hero, InputState } from './state.js';

export interface MoveEvents {
  onLand(surf: Surface, impact: number): void;
  onJump(): void;
  onBounce(surf: Surface): void;
  onStep(): void;
  onFellOffWorld(): void;
}

const STEP_SAME = 10;     // seamless same-height tolerance (PRD §5.6a)
const STEP_UP_MAX = 20;   // step-up threshold (PRD §5.6d)
const STEP_DOWN_MAX = 24; // small step-down keeps momentum (PRD §5.6c)
const EDGE_MARGIN = 6;

export function stepGround(hero: Hero, input: InputState, map: SurfaceMap, dt: number, ev: MoveEvents): void {
  // landing recovery: 0.2s squash, then back to idle (PRD §6.1)
  if (hero.state === 'landing' && hero.stateT > 0.2 && !input.left && !input.right) {
    hero.transition('idle');
  }

  // jump off the ground
  if (hero.jumpQueued) {
    hero.jumpQueued = false;
    hero.vy = JUMP_IMPULSE;
    hero.ground = null;
    hero.transition('jumping');
    ev.onJump();
    return;
  }

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (input.crouch && Math.abs(hero.vx) < 40) {
    if (hero.state !== 'crouching') hero.transition('crouching');
    hero.vx *= Math.pow(FRICTION_GROUND, dt * 60);
  } else if (dir !== 0) {
    hero.facing = dir as 1 | -1;
    // landing → walking cancels with momentum preserved (PRD §6.1)
    const want = input.run ? 'running' : 'walking';
    if (hero.state !== want) hero.transition(want);
    const target = (input.run ? RUN_SPEED : WALK_SPEED) * dir;
    const d = target - hero.vx;
    const max = GROUND_ACCEL * dt;
    hero.vx += Math.abs(d) < max ? d : Math.sign(d) * max;
    hero.stepT += dt;
    const interval = input.run ? 0.14 : 0.22;
    if (hero.stepT >= interval) { hero.stepT = 0; ev.onStep(); }
  } else {
    hero.vx *= Math.pow(FRICTION_GROUND, dt * 60);
    if (Math.abs(hero.vx) < 8) hero.vx = 0;
    if (hero.state === 'crouching' && !input.crouch) hero.transition('idle');
    else if (hero.state === 'walking' || hero.state === 'running') hero.transition('idle');
  }

  // ---- horizontal move + platform chaining (PRD §5.6) ----
  const prevX = hero.x;
  hero.x += hero.vx * dt;

  const sup = findGround(map, hero.x, hero.y);
  if (sup) {
    const t = topPage(sup);
    const diff = t - hero.y;
    if (Math.abs(diff) <= STEP_SAME || (diff > 0 && diff <= STEP_DOWN_MAX) || (diff < 0 && -diff <= STEP_UP_MAX)) {
      hero.y = t;          // seamless step / step-down / step-up
      hero.ground = sup;
    } else if (diff < 0) {
      clampToEdge(hero, prevX); // too tall to step up — treat as a wall
    } else {
      hero.y = t;          // deeper drop but still on something — snap
      hero.ground = sup;
    }
  } else {
    clampToEdge(hero, prevX); // §5.6e — no element ahead: stop at the edge
  }

  // the element under us might have been removed from the DOM (PRD §8.2)
  const g = findGround(map, hero.x, hero.y);
  if (!g) {
    hero.ground = null;
    hero.transition('falling');
  } else {
    hero.ground = g;
    hero.y = topPage(g);
  }
}

function clampToEdge(hero: Hero, prevX: number): void {
  const g = hero.ground;
  hero.x = prevX;
  hero.vx = 0;
  if (!g) {
    hero.transition('falling');
    return;
  }
  const l = leftPage(g) + EDGE_MARGIN;
  const r = rightPage(g) - EDGE_MARGIN;
  if (hero.x < l) hero.x = l;
  if (hero.x > r) hero.x = r;
  if (hero.state === 'walking' || hero.state === 'running') hero.transition('idle');
}

export function stepAir(hero: Hero, input: InputState, map: SurfaceMap, dt: number, ev: MoveEvents): void {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    hero.facing = dir as 1 | -1;
    hero.vx += dir * GROUND_ACCEL * AIR_CONTROL * dt;
    if (Math.abs(hero.vx) > RUN_SPEED) hero.vx = Math.sign(hero.vx) * RUN_SPEED;
  }
  hero.vx *= Math.pow(DRAG_AIR, dt * 60);
  hero.vy = Math.min(hero.vy + GRAVITY * dt, MAX_FALL);

  if (hero.state === 'jumping' && hero.vy > 0) hero.transition('falling');

  const prevFeet = hero.y;
  hero.x += hero.vx * dt;
  hero.y += hero.vy * dt;

  // clamp to document bounds (PRD §13)
  const docW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
  if (hero.x < 20) { hero.x = 20; hero.vx = Math.abs(hero.vx) * 0.4; }
  if (hero.x > docW - 20) { hero.x = docW - 20; hero.vx = -Math.abs(hero.vx) * 0.4; }

  // wall cling — hold toward a wall while airborne (PRD §6.1 CLINGING)
  if (dir !== 0 && hero.vy > -120) {
    const wall = wallForCling(map, hero.x, dir as 1 | -1, hero.y, hero.height);
    if (wall) {
      hero.vx = 0;
      hero.vy = 0;
      hero.x = dir === 1 ? leftPage(wall) - 2 : rightPage(wall) + 2;
      hero.transition('clinging');
      return;
    }
  }

  if (hero.vy > 0) {
    const surf = sweepLanding(map, hero.x, prevFeet, hero.y);
    if (surf) {
      hero.y = topPage(surf);
      const impact = hero.vy;
      if (surf.restitution > 0 && impact > 420) {
        hero.vy = -impact * surf.restitution; // buttons bounce (PRD §5.3)
        ev.onBounce(surf);
        return;
      }
      hero.vy = 0;
      hero.ground = surf;
      hero.transition('landing');
      ev.onLand(surf, impact);
    }
  }

  // fell past the bottom of the document — respawn (PRD §13)
  const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
  if (hero.y > docH + 300) ev.onFellOffWorld();
}

export function stepCling(hero: Hero, input: InputState, map: SurfaceMap, dt: number, ev: MoveEvents): void {
  hero.vx = 0;
  hero.vy = 0; // wall stick friction: clings, doesn't slide (PRD §4.2)

  if (hero.jumpQueued) {
    hero.jumpQueued = false;
    hero.vx = -hero.facing * 300;  // push off the wall
    hero.vy = JUMP_IMPULSE * 0.9;
    hero.transition('jumping');
    ev.onJump();
    return;
  }
  if (input.crouch) { // press down to let go
    hero.transition('falling');
    return;
  }
  const wall = wallForCling(map, hero.x + hero.facing * 2, hero.facing, hero.y, hero.height);
  if (!wall) hero.transition('falling');
}
