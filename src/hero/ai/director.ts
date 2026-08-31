/**
 * director.ts — the part that makes him a pet rather than a puppet.
 *
 * The director picks a goal, then drives the *existing* movement code by
 * synthesising the same `InputState` the keyboard produces. Nothing here
 * reimplements walking, jumping or swinging — it just decides where to go, so
 * autonomous movement and player movement are guaranteed to behave identically.
 *
 * Goal choice is utility scoring over the needs model with a softmax pick, plus
 * per-goal cooldowns. That gives behaviour that has reasons behind it and still
 * never settles into a loop.
 *
 * The user always wins: any real input hands control back for a few seconds.
 */

import type { Hero, InputState, HeroState } from '../character/state.js';
import type { Surface, SurfaceMap } from '../world/surfaces.js';
import { topPage, centerXPage, leftPage, rightPage } from '../world/surfaces.js';
import type { Needs } from './needs.js';
import type { Trigger, QuipContext } from './quips.js';

export type GoalId =
  | 'patrol' | 'hop' | 'swing' | 'perch' | 'rest'
  | 'stretch' | 'investigate' | 'watch' | 'flourish' | 'press' | 'sip';

export interface DirectorHost {
  hero: Hero;
  map: SurfaceMap;
  needs: Needs;
  /** page-space cursor, or null when the pointer isn't on the page */
  cursor(): { x: number; y: number } | null;
  say(trigger: Trigger, ctx?: QuipContext, chance?: number): void;
  /** play a one-shot performance state; resolves back to idle on its own */
  perform(state: HeroState): void;
  /** fire a web at a page-space point */
  shootAt(x: number, y: number): void;
  releaseWeb(): void;
}

interface Goal {
  id: GoalId;
  target: Surface | null;
  /** page-space x he is heading for */
  toX: number;
  /** seconds remaining before the goal gives up */
  ttl: number;
  phase: 'travel' | 'act' | 'done';
}

/** How close counts as arrived, in page px. */
const ARRIVE = 14;
/** Minimum seconds between goal changes, so he commits to a decision. */
const MIN_GOAL = 0.5;
/** Seconds of hands-off after any real user input. */
const MANUAL_GRACE = 4;

const COOLDOWNS: Record<GoalId, number> = {
  patrol: 1, hop: 2.5, swing: 6, perch: 8, rest: 12,
  stretch: 14, investigate: 5, watch: 6, flourish: 16, press: 10, sip: 25,
};

export class Director {
  /** what the movement code reads instead of the keyboard */
  readonly input: InputState = { left: false, right: false, crouch: false, run: false };
  jumpQueued = false;

  private goal: Goal | null = null;
  private goalAge = 0;
  private cooldown = new Map<GoalId, number>();
  private manualFor = 0;
  private lastGround: Surface | null = null;
  /** hard off switch — used by QA to make manual-control tests deterministic */
  private enabled = true;

  constructor(private host: DirectorHost) {}

  /** Call whenever the user presses a key, clicks, or drives the hero. */
  userTookOver(): void {
    this.manualFor = MANUAL_GRACE;
    this.clearInput();
    this.goal = null;
  }

  get autonomous(): boolean {
    return this.enabled && this.manualFor <= 0;
  }

  /** Turn autonomy off entirely. He then only moves when the user drives him. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) { this.clearInput(); this.goal = null; this.jumpQueued = false; }
  }

  get currentGoal(): GoalId | null {
    return this.goal?.id ?? null;
  }

  step(dt: number): void {
    const { hero, needs } = this.host;
    if (!this.enabled) { this.clearInput(); return; }

    if (this.manualFor > 0) {
      this.manualFor -= dt;
      if (this.manualFor > 0) return;
    }

    for (const [k, v] of this.cooldown) {
      const n = v - dt;
      if (n <= 0) this.cooldown.delete(k);
      else this.cooldown.set(k, n);
    }

    needs.step(dt, {
      resting: hero.state === 'idle' || hero.state === 'sitting',
      exerting: hero.state === 'running' || hero.state === 'swinging' || hero.state === 'jumping',
    });

    // landing somewhere new is worth noticing, and worth a line
    if (hero.grounded && hero.ground && hero.ground !== this.lastGround) {
      this.lastGround = hero.ground;
      needs.notice(0.2);
    }

    // a performance plays out on its own; don't interrupt it
    if (hero.performing) { this.clearInput(); return; }

    this.goalAge += dt;
    if (!this.goal || this.goal.phase === 'done' || this.goal.ttl <= 0) {
      if (this.goalAge >= MIN_GOAL) this.chooseGoal();
    }
    if (this.goal) {
      this.goal.ttl -= dt;
      this.driveGoal(dt);
    }
  }

  // ---------------------------------------------------------------- choosing

  private chooseGoal(): void {
    const { hero, map, needs } = this.host;
    const options: { id: GoalId; score: number; make: () => Goal | null }[] = [];

    const canMove = hero.grounded;
    const here = hero.ground;
    const cursor = this.host.cursor();

    const add = (id: GoalId, score: number, make: () => Goal | null): void => {
      if (this.cooldown.has(id)) return;
      if (score <= 0) return;
      options.push({ id, score, make });
    };

    if (canMove) {
      // wander the surface he's on
      add('patrol', 0.35 + needs.boredom * 0.5 + needs.energy * 0.2, () =>
        this.makePatrol());

      // hop to a nearby button or heading
      add('hop', 0.4 + needs.energy * 0.6 + needs.curiosity * 0.3, () =>
        this.makeTravel('hop', map.candidates(hero.x, hero.y, 340, {
          types: ['button', 'link', 'heading', 'card', 'nav'],
          exclude: here, minDistance: 40,
        })));

      // web-swing somewhere further away — the showpiece, so it wants energy
      add('swing', (needs.energy - 0.35) * 1.6 + needs.boredom * 0.4, () =>
        this.makeTravel('swing', map.candidates(hero.x, hero.y, 900, {
          types: ['heading', 'nav', 'card', 'image', 'media'],
          exclude: here, minDistance: 180,
        })));

      add('perch', 0.3 + needs.boredom * 0.3 - needs.energy * 0.2, () =>
        this.makeTravel('perch', map.candidates(hero.x, hero.y, 400, {
          types: ['heading', 'nav'], exclude: here,
        })));

      add('press', 0.2 + needs.curiosity * 0.7, () =>
        this.makeTravel('press', map.candidates(hero.x, hero.y, 260, {
          types: ['button'], exclude: null,
        })));

      // stay put and do something expressive
      add('rest', (0.5 - needs.energy) * 1.4, () => this.makeInPlace('rest'));
      add('stretch', 0.2 + needs.boredom * 0.6 - needs.energy * 0.3, () =>
        this.makeInPlace('stretch'));
      add('flourish', (needs.energy - 0.5) * 1.2 + needs.sociability * 0.5, () =>
        this.makeInPlace('flourish'));
      add('sip', needs.boredom * 0.45 - needs.energy * 0.2, () => this.makeInPlace('sip'));

      if (cursor) {
        const d = Math.hypot(cursor.x - hero.x, cursor.y - hero.y);
        add('watch', needs.sociability * 0.9 + (d < 320 ? 0.4 : 0), () =>
          this.makeInPlace('watch'));
      }
    }

    if (!options.length) return;

    // softmax over the scores so the best option usually wins but not always
    const temp = 0.45;
    const weights = options.map((o) => Math.exp(Math.max(0, o.score) / temp));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let chosen = options[options.length - 1];
    for (let i = 0; i < options.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { chosen = options[i]; break; }
    }

    const goal = chosen.make();
    if (!goal) { this.cooldown.set(chosen.id, 1.5); return; }

    this.goal = goal;
    this.goalAge = 0;
    this.cooldown.set(goal.id, COOLDOWNS[goal.id]);
    needs.record(goal.id);
  }

  private makePatrol(): Goal | null {
    const { hero } = this.host;
    const g = hero.ground;
    if (!g) return null;
    const l = leftPage(g) + 10;
    const r = rightPage(g) - 10;
    if (r - l < 24) return null;
    // head for the end he isn't already near
    const toX = hero.x - l < r - hero.x ? r : l;
    return { id: 'patrol', target: g, toX, ttl: 5, phase: 'travel' };
  }

  private makeTravel(id: GoalId, cands: Surface[]): Goal | null {
    if (!cands.length) return null;
    // prefer near targets but keep some spread so he explores
    const pick = cands[Math.floor(Math.random() * Math.min(cands.length, 4))];
    return {
      id,
      target: pick,
      toX: centerXPage(pick),
      ttl: id === 'swing' ? 7 : 6,
      phase: 'travel',
    };
  }

  private makeInPlace(id: GoalId): Goal {
    return { id, target: this.host.hero.ground, toX: this.host.hero.x, ttl: 4, phase: 'act' };
  }

  // ---------------------------------------------------------------- driving

  private driveGoal(dt: number): void {
    const g = this.goal!;
    const { hero, map } = this.host;
    this.clearInput();

    // the target can vanish or scroll away mid-goal
    if (g.target && !map.has(g.target) && g.id !== 'patrol') { g.phase = 'done'; return; }

    if (g.phase === 'act') { this.act(g); return; }

    // ---- travel
    if (!hero.grounded) {
      // airborne: steer toward the target and let physics finish the arc
      if (hero.state === 'swinging') {
        const dx = g.toX - hero.x;
        if (Math.abs(dx) < 60 || g.ttl < 2) this.host.releaseWeb();
        else if (dx > 0) this.input.right = true;
        else this.input.left = true;
      } else {
        const dx = g.toX - hero.x;
        if (dx > 8) this.input.right = true;
        else if (dx < -8) this.input.left = true;
      }
      return;
    }

    const dx = g.toX - hero.x;
    const dist = Math.abs(dx);

    if (dist <= ARRIVE) { g.phase = 'act'; return; }

    const dir: 1 | -1 = dx > 0 ? 1 : -1;
    if (dir > 0) this.input.right = true;
    else this.input.left = true;
    // run when it's a long way, walk when it's a stroll
    this.input.run = dist > 180 && this.host.needs.energy > 0.35;

    const targetTop = g.target ? topPage(g.target) : hero.y;

    if (g.id === 'swing' && g.target) {
      // fire once, from a standstill or a walk, at the target's top edge
      if (!hero.pendulum) {
        this.host.say('swing-start', {}, 0.4);
        this.host.shootAt(centerXPage(g.target), targetTop);
        // if the cast missed, downgrade to hopping there
        if (!hero.pendulum) g.id = 'hop';
      }
      return;
    }

    // jump when the target is above us, or the ground runs out ahead
    const ahead = map.groundAt(hero.x + dir * 22, hero.y);
    const needsLift = targetTop < hero.y - 12;
    if ((!ahead || needsLift) && dist < 170) this.jumpQueued = true;
  }

  private act(g: Goal): void {
    switch (g.id) {
      case 'press':
        this.host.perform('pressing');
        this.host.say('press', { label: g.target ? text(g.target) : '' }, 0.8);
        break;
      case 'perch':
        this.host.perform('sitting');
        this.host.say('perch', { label: g.target ? text(g.target) : '' }, 0.5);
        break;
      case 'rest':
        this.host.perform('sitting');
        break;
      case 'stretch':
        this.host.perform('stretching');
        this.host.say('idle-long', {}, 0.5);
        break;
      case 'flourish':
        this.host.perform('taunting');
        this.host.say('flip', {}, 0.5);
        break;
      case 'sip':
        this.host.perform('sipping');
        this.host.say('idle-long', {}, 0.35);
        break;
      case 'watch':
        this.host.perform('alerting');
        break;
      default:
        // travel goals just stop on arrival
        break;
    }
    g.phase = 'done';
  }

  private clearInput(): void {
    this.input.left = false;
    this.input.right = false;
    this.input.run = false;
    this.input.crouch = false;
  }

  takeJump(): boolean {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }

  debug(): Record<string, unknown> {
    return {
      goal: this.goal?.id ?? null,
      phase: this.goal?.phase ?? null,
      autonomous: this.autonomous,
      aiEnabled: this.enabled,
      ...this.host.needs.snapshot(),
    };
  }
}

const text = (s: Surface): string => (s.el.textContent ?? '').replace(/\s+/g, ' ').trim();
