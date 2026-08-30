/**
 * index.ts — entry point: boots the DOM-aware web-slinging hero (PRD §14).
 * Composes engine + physics + world + input + camera + animation + audio.
 */

import { Engine } from './engine.js';
import { Hero, type InputState, type HeroState } from './character/state.js';
import { stepGround, stepAir, stepCling, type MoveEvents } from './character/movement.js';
import { WebShooter, type ShootEvents } from './character/web-shoot.js';
import { castWeb, type WebAnchor } from './physics/raycast.js';
import { sweepLanding } from './physics/collision.js';
import {
  SurfaceMap,
  topPage,
  centerXPage,
  type Surface,
} from './world/surfaces.js';
import { DomScanner } from './world/dom-scanner.js';
import { Interactions } from './world/interactions.js';
import { Keyboard } from './input/keyboard.js';
import { Mouse } from './input/mouse.js';
import { Touch } from './input/touch.js';
import { CameraFollow } from './camera/follow.js';
import { CameraShake } from './camera/shake.js';
import { Animator } from './animation/animator.js';
import { Particles } from './animation/particles.js';
import { loadAtlas, getSpriteMode } from './animation/sprite.js';
import { clipFor } from './animation/clips.js';
import { dirFromFacing, type Dir8 } from './animation/direction.js';
import { PoseModulator, NEUTRAL, type Pose } from './animation/pose.js';
import { Renderer } from './render/renderer.js';
import { Bubble } from './render/bubble.js';
import { Director } from './ai/director.js';
import { Needs } from './ai/needs.js';
import { Quipper, labelOf, landTrigger, type Trigger, type QuipContext } from './ai/quips.js';
import { Sounds } from './audio/sounds.js';
import { Sfx } from './audio/effects.js';

/** Performances whose clip loops, so they need a duration rather than an end. */
const LOOPING_PERFORMANCE: ReadonlySet<HeroState> = new Set<HeroState>(['sitting', 'alerting']);

class HeroSystem implements MoveEvents, ShootEvents {
  private hero = new Hero();
  private map = new SurfaceMap();
  private shooter = new WebShooter();
  private keyboard = new Keyboard();
  private mouse = new Mouse();
  private touch = new Touch();
  private follow = new CameraFollow();
  private shake = new CameraShake();
  private animator = new Animator();
  private particles = new Particles();
  private renderer = new Renderer();
  private sounds = new Sounds();
  private sfx = new Sfx(this.sounds);
  private interactions = new Interactions();
  private scanner = new DomScanner(this.map, () => this.onStructureChange());
  private bubble = new Bubble();
  private needs = new Needs();
  private quipper = new Quipper();
  private poser = new PoseModulator();
  private director = new Director({
    hero: this.hero,
    map: this.map,
    needs: this.needs,
    cursor: () => (this.mouse.present ? { x: this.mouse.x, y: this.mouse.y } : null),
    say: (t, ctx, chance) => this.say(t, ctx, chance),
    perform: (s) => this.perform(s),
    shootAt: (x, y) => this.shooter.shoot(this.hero, x, y, this),
    releaseWeb: () => this.shooter.release(this.hero, this),
  });
  private engine = new Engine(
    (dt) => this.step(dt),
    (t, alpha) => this.render(t, alpha),
  );

  private lastRenderT = 0;
  private frameMs = 16.7;
  private slowFor = 0;
  private degraded = false;

  /** previous physics position, for render interpolation */
  private prevX = 0;
  private prevY = 0;
  /** the performance state currently playing, if any */
  private performing = false;
  private scrollWatch = 0;
  private lastScrollY = 0;
  /** QA only: pin the hero in one state so a pose can be photographed */
  private frozen: HeroState | null = null;
  /** seconds left on the current performance before it is cut short */
  private performT = 0;

  start(): void {
    this.map.rebuild();
    this.spawn();
    const unlock = (): void => {
      this.sounds.unlock();
      this.needs.socialise(0.2);
    };
    this.keyboard.attach(unlock);
    this.mouse.attach((x, y) => this.onClick(x, y), unlock);
    this.touch.attach((x, y) => this.onTap(x, y), unlock);
    window.addEventListener('load', () => this.map.rebuild());
    this.lastScrollY = window.scrollY;
    this.scanner.start();
    this.engine.start();
    // he notices you the moment he arrives
    window.setTimeout(() => this.say('greet', {}, 1), 900);
  }

  // ------------------------------------------------ physics step (fixed dt)
  private step(dt: number): void {
    const hero = this.hero;
    hero.stateT += dt;
    this.prevX = hero.x;
    this.prevY = hero.y;

    const kb = this.keyboard.input;
    const tc = this.touch.input;
    const manual = kb.left || kb.right || kb.crouch || tc.left || tc.right || tc.crouch;
    if (manual) this.director.userTookOver();

    this.director.step(dt);
    this.poser.step(dt);
    this.quipper.step(dt);
    this.bubble.step(dt);
    this.watchScroll(dt);

    const ai = this.director.input;
    const auto = this.director.autonomous;
    const input: InputState = {
      left: kb.left || tc.left || (auto && ai.left),
      right: kb.right || tc.right || (auto && ai.right),
      crouch: kb.crouch || tc.crouch || (auto && ai.crouch),
      run: kb.run || tc.run || (auto && ai.run),
    };
    if (this.keyboard.takeJump()) { hero.jumpQueued = true; this.director.userTookOver(); }
    if (auto && this.director.takeJump()) hero.jumpQueued = true;

    // QA freeze: hold the pinned state and skip the state machine entirely
    if (this.frozen) {
      hero.state = this.frozen;
      hero.vx = 0;
      this.afterStep(dt);
      return;
    }

    // A performance holds him still until its clip finishes — or until it times
    // out. Some performances resolve to a *looping* clip (perching uses the
    // profile idle, watching uses the fight stance), and those never report
    // finished, so without the timer he would sit there forever.
    if (hero.performing) {
      hero.vx = 0;
      this.performT -= dt;
      if (this.animator.finished() || this.performT <= 0) this.endPerformance();
      this.afterStep(dt);
      return;
    }

    switch (hero.state) {
      case 'idle':
      case 'walking':
      case 'running':
      case 'crouching':
      case 'landing':
        stepGround(hero, input, this.map, dt, this);
        break;
      case 'jumping':
      case 'falling':
        stepAir(hero, input, this.map, dt, this);
        break;
      case 'clinging':
        stepCling(hero, input, this.map, dt, this);
        break;
      case 'swinging': {
        const p = hero.pendulum;
        if (!p) {
          hero.transition('falling');
          break;
        }
        const prevFeet = hero.y;
        const r = p.step(dt, input);
        hero.x = r.x;
        hero.y = r.y + hero.height; // pendulum drives the hand; feet ride below
        hero.vx = r.vx;
        hero.vy = r.vy;
        // touching ground while swinging → land (PRD §6.1)
        if (r.vy > 0) {
          const surf = sweepLanding(this.map, hero.x, prevFeet, hero.y);
          if (surf) {
            hero.pendulum = null;
            hero.y = topPage(surf);
            hero.vy = 0;
            hero.ground = surf;
            hero.transition('landing');
            this.onLand(surf, r.vy);
          }
        }
        break;
      }
    }

    hero.jumpQueued = false;
    this.afterStep(dt);
  }

  /** Shared tail of the physics step, run whether or not he's performing. */
  private afterStep(dt: number): void {
    const hero = this.hero;
    this.shooter.step(dt);
    this.particles.step(dt);
    this.interactions.stand(hero.grounded ? hero.ground : null);
    this.follow.step(hero);

    const sh = this.shake.step(dt);
    this.renderer.shakeX = sh.x;
    this.renderer.shakeY = sh.y;

    // aim hint follows the cursor
    this.shooter.aimX = this.mouse.x;
    this.shooter.aimY = this.mouse.y;
    this.shooter.hasAim = this.mouse.present;
  }

  /** Big scroll jumps are the user doing something; he reacts to them. */
  private watchScroll(dt: number): void {
    this.scrollWatch = Math.max(0, this.scrollWatch - dt);
    const dy = Math.abs(window.scrollY - this.lastScrollY);
    this.lastScrollY = window.scrollY;
    if (dy > 40 && this.scrollWatch === 0) {
      this.needs.socialise(0.15);
      if (dy > 140) {
        this.say('fast-scroll', {}, 0.35);
        this.scrollWatch = 3;
      }
    }
  }

  // ------------------------------------------------ render (per rAF)
  private render(timeMs: number, alpha: number): void {
    const dtMs = this.lastRenderT ? timeMs - this.lastRenderT : 16.7;
    this.lastRenderT = timeMs;

    // fps watchdog → graceful degradation
    this.frameMs = this.frameMs * 0.95 + dtMs * 0.05;
    if (this.frameMs > 33 && !this.degraded) {
      this.slowFor += dtMs;
      if (this.slowFor > 2000) this.degrade();
    } else {
      this.slowFor = 0;
    }

    const hero = this.hero;
    const choice = clipFor(hero.state);
    this.animator.play(choice.clip, this.facingDir(choice.profile));
    // gait speed tracks how fast he is actually moving, so the feet don't skate
    this.animator.setSpeed(
      hero.state === 'walking' || hero.state === 'running'
        ? Math.max(0.6, Math.min(2, Math.abs(hero.vx) / 190))
        : 1,
    );
    this.animator.update(dtMs);

    const pose: Pose = this.poser.compute({
      vy: hero.vy,
      airborne: hero.state === 'jumping' || hero.state === 'falling',
      swingAngle: hero.pendulum ? hero.pendulum.angle : null,
      heightPx: hero.height,
    });

    // interpolate between the last two physics positions
    const drawX = this.prevX + (hero.x - this.prevX) * alpha;
    const drawY = this.prevY + (hero.y - this.prevY) * alpha;

    this.renderer.render(
      hero, this.shooter, this.animator, this.particles, this.map, timeMs,
      { pose, bubble: this.bubble, drawX, drawY },
    );
  }

  /** Which of the 8 directions to draw, given where he faces and what he's doing. */
  private facingDir(profile: boolean): Dir8 {
    // he turns to face you while he's talking — the front view is the best art
    // in the set and it makes the bubble feel addressed to the reader
    if (this.bubble.visible && this.hero.grounded && !this.hero.performing) return 'south';
    return dirFromFacing(this.hero.facing, profile);
  }

  // ------------------------------------------------ performances
  private perform(state: HeroState): void {
    if (this.hero.performing || !this.hero.grounded) return;
    this.hero.vx = 0;
    this.hero.transition(state);
    this.performing = true;
    const choice = clipFor(state);
    this.animator.play(choice.clip, this.facingDir(choice.profile), { restart: true });
    // looping fallbacks (perch, watch) need a hold time; one-shots end sooner
    // than this on their own and the timer never bites
    this.performT = LOOPING_PERFORMANCE.has(state) ? 2.5 + Math.random() * 2.5 : 4;
  }

  private endPerformance(): void {
    if (!this.performing) return;
    this.performing = false;
    this.hero.transition('idle');
  }

  private say(trigger: Trigger, ctx: QuipContext = {}, chance = 1): void {
    const line = this.quipper.pick(trigger, ctx, chance);
    if (line) this.bubble.say(line);
  }

  private degrade(): void {
    this.degraded = true;
    this.particles.enabled = false;
    this.renderer.shadowEnabled = false;
    this.shake.enabled = false;
  }

  // ------------------------------------------------ pointer actions
  private onClick(x: number, y: number): void {
    this.director.userTookOver();
    this.needs.socialise(0.35);
    // a click landing close to him gets a reaction rather than a web
    if (Math.hypot(x - this.hero.x, y - this.hero.y) < 70) {
      this.say('clicked-near', {}, 0.5);
    }
    this.shooter.shoot(this.hero, x, y, this);
  }

  private onTap(x: number, y: number): void {
    // center tap: web whatever was tapped; nothing there → jump (PRD §6.2)
    const wasSwinging = !!this.hero.pendulum;
    this.shooter.shoot(this.hero, x, y, this);
    if (!wasSwinging && !this.hero.pendulum && this.hero.grounded) {
      this.hero.jumpQueued = true;
    }
  }

  // ------------------------------------------------ MoveEvents
  onLand(surf: Surface, impact: number): void {
    this.particles.spawnDust(this.hero.x, this.hero.y, impact);
    this.sfx.land(impact);
    this.shake.trigger(impact);
    this.interactions.land(surf);
    this.poser.land(impact);
    this.needs.notice(0.15);

    // a hard landing knocks him flat; an ordinary one just gets a remark
    if (impact > 780) {
      this.say('big-fall', {}, 0.8);
      window.setTimeout(() => this.perform('faceplanting'), 60);
    } else {
      const label = labelOf(surf.el);
      this.say(landTrigger(surf.el.tagName), { label, tag: surf.el.tagName }, 0.45);
    }
  }

  onJump(): void {
    this.sfx.jump();
    this.poser.jump();
  }

  onBounce(surf: Surface): void {
    this.sfx.bounce();
    this.particles.spawnSparkle(this.hero.x, this.hero.y - 6);
    this.interactions.land(surf);
  }

  onStep(): void {
    this.sfx.step();
  }

  onFellOffWorld(): void {
    this.respawn();
  }

  // ------------------------------------------------ ShootEvents
  onAttach(anchor: WebAnchor): void {
    this.sfx.shoot();
    this.particles.spawnSparkle(anchor.ax, anchor.ay);
    anchor.el.classList.add('hero-glow');
    window.setTimeout(() => anchor.el.classList.remove('hero-glow'), 700);
  }

  onMiss(): void {
    this.sfx.miss();
    this.say('miss', {}, 0.5);
  }

  onRelease(): void {
    // velocity inheritance is the juice — no extra sound
  }

  // ------------------------------------------------ lifecycle
  private onStructureChange(): void {
    // our ground element vanished from the DOM → we fall (PRD §8.2)
    const g = this.hero.ground;
    if (g && !document.contains(g.el)) {
      this.hero.ground = null;
      if (this.hero.grounded) this.hero.transition('falling');
    }
  }

  private spawn(): void {
    // the hero title is the perfect first rooftop: visible, central, iconic
    let target = this.map.firstOfType('heading') ?? this.map.firstOfType('nav');
    if (!target) {
      // PRD §13 — no visible elements: inject a little lobby platform
      const div = document.createElement('div');
      div.style.cssText =
        'position:fixed;left:24px;bottom:24px;width:180px;height:12px;background:#e63a3e;z-index:9998;';
      document.body.appendChild(div);
      this.map.rebuild();
      target = this.map.firstOfType('card') ?? this.map.surfaces[0] ?? null;
    }
    if (target) {
      this.hero.x = centerXPage(target);
      this.hero.y = topPage(target);
      this.hero.ground = target;
    } else {
      this.hero.x = 100;
      this.hero.y = window.innerHeight - 40;
    }
  }

  private respawn(): void {
    const target =
      this.map.firstOfType('heading') ?? this.map.firstOfType('nav') ?? this.map.surfaces[0];
    if (target) {
      this.hero.x = centerXPage(target);
      this.hero.y = topPage(target);
      this.hero.ground = target;
    } else {
      this.hero.x = 100;
      this.hero.y = window.innerHeight - 40;
      this.hero.ground = null;
    }
    this.hero.vx = 0;
    this.hero.vy = 0;
    this.hero.pendulum = null;
    this.hero.transition('landing');
    this.particles.spawnSparkle(this.hero.x, this.hero.y - 30);
  }

  /** QA hook: would a web shot at (x, y) attach? Pure check, no side effects. */
  testCast(x: number, y: number): boolean {
    return castWeb(this.hero.x, this.hero.y - this.hero.height, x, y) !== null;
  }

  debug(): Record<string, unknown> {
    const hero = this.hero;
    const cur = this.animator.current();
    return {
      state: hero.state,
      clip: cur.clip,
      dir: cur.dir,
      frame: this.animator.frame(),
      x: Math.round(hero.x),
      y: Math.round(hero.y),
      ground: hero.ground ? hero.ground.el.tagName : null,
      surfaces: this.map.surfaces.length,
      fps: Math.round(1000 / this.frameMs),
      degraded: this.degraded,
      sprites: getSpriteMode(),
      ...this.director.debug(),
    };
  }

  /**
   * QA hook: pin a state so a screenshot can be taken of any pose.
   *
   * This also freezes the state machine. Without that, `stepGround` resolves
   * `walking` back to `idle` on the very next physics step (there is no input
   * held), so the forced pose would never actually be drawn.
   */
  force(state: HeroState | null): void {
    this.director.userTookOver();
    this.frozen = state;
    if (!state) return;
    this.hero.transition(state);
    const choice = clipFor(state);
    this.animator.play(choice.clip, this.facingDir(choice.profile), { restart: true });
  }

  /** QA hook: make him talk on demand. */
  talk(text: string): void {
    this.bubble.say(text, 2.5);
  }
}

async function boot(): Promise<void> {
  // PRD §12 — respect reduced motion: the hero stays home
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ((window as unknown as { __hero?: unknown }).__hero) return;
  await loadAtlas();
  // the camera drives window.scrollTo every frame; CSS smooth-scroll would fight it
  document.documentElement.style.scrollBehavior = 'auto';
  const system = new HeroSystem();
  (window as unknown as { __hero: unknown }).__hero = {
    debug: () => system.debug(),
    testCast: (x: number, y: number) => system.testCast(x, y),
    force: (s: string | null) => system.force(s as HeroState | null),
    talk: (t: string) => system.talk(t),
  };
  system.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot());
} else {
  void boot();
}
