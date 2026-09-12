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
import { JUMP_IMPULSE } from './physics/forces.js';
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
import { Flash } from './camera/flash.js';
import { Animator } from './animation/animator.js';
import { Particles } from './animation/particles.js';
import { loadAtlas, getSpriteMode } from './animation/sprite.js';
import { clipFor, pickClip } from './animation/clips.js';
import { dirFromFacing, type Dir8 } from './animation/direction.js';
import { PoseModulator, NEUTRAL, type Pose } from './animation/pose.js';
import { Renderer } from './render/renderer.js';
import { Bubble } from './render/bubble.js';
import { Villain } from './render/villain.js';
import { Director } from './ai/director.js';
import { Needs } from './ai/needs.js';
import { Quipper, labelOf, landTrigger, type Trigger, type QuipContext } from './ai/quips.js';
import { Sounds } from './audio/sounds.js';
import { Sfx } from './audio/effects.js';

/**
 * How long each performance holds, in seconds, as a backstop.
 *
 * A one-shot clip normally ends itself — `animator.finished()` fires when it
 * reaches its last frame — but several states resolve to a *looping* clip
 * (perching and sitting-on-a-button both use the idle-side loop; shadow-boxing
 * reuses the looping fight-stance) and a loop never reports finished. Rather
 * than track which specific clip each state happens to resolve to today (and
 * re-track it every time a fallback chain in clips.ts changes), every
 * performance gets a duration cap: a one-shot almost always ends well before
 * its cap via `finished()`, and a loop rides the cap out.
 */
const PERFORM_MAX: Partial<Record<HeroState, number>> = {
  sitting: 4,
  alerting: 3.5,
  boxing: 3.5,
  mimicking: 1.2,   // thwip is a ~0.5s gesture; this only backstops a fallback
  faceplanting: 4,
};
const PERFORM_DEFAULT = 4;

/**
 * How long after attaching a web he plays the cast/pull motion before
 * settling into the hang loop. Without this the swing state snapped straight
 * to the idle hang pose the instant the web attached — no read of actually
 * throwing and catching the line, just a teleport into a loop.
 */
const SWING_CAST_WINDOW = 0.22;
/**
 * Tap jump mid-swing to hop off with a boost, instead of only being able to
 * let go via a second click. A real swing-off, not just an early release —
 * this is the mechanic every web-swinging game has and this one didn't.
 */
const SWING_HOP_BOOST = JUMP_IMPULSE * 0.6;

class HeroSystem implements MoveEvents, ShootEvents {
  private hero = new Hero();
  private map = new SurfaceMap();
  private shooter = new WebShooter();
  private keyboard = new Keyboard();
  private mouse = new Mouse();
  private touch = new Touch();
  private follow = new CameraFollow();
  private shake = new CameraShake();
  private flashFx = new Flash();
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
  private villain = new Villain({
    hero: this.hero,
    perform: (s, o) => this.perform(s, o),
    say: (t, ctx, chance) => this.say(t, ctx, chance),
    shake: (i) => this.shake.trigger(i),
    flash: (p) => this.flashFx.trigger(p),
    spark: (x, y) => this.particles.spawnSparkle(x, y),
    punchSfx: () => this.sfx.punch(),
    koSfx: () => this.sfx.ko(),
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
  /** symbiote rage mode: a timed palette-swap, provoked by clicking on him repeatedly */
  private symbiote = false;
  private symbioteT = 0;
  private clickTimes: number[] = [];

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
    // a secret-ish summon: press V to make him fight something right now,
    // rather than waiting on the rare autonomous trigger
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyV' && !e.repeat) {
        unlock();
        this.villain.forceTrigger();
      }
    });
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
    this.villain.step(dt, this.director.autonomous && hero.grounded && !hero.performing);
    this.director.setEncounterHold(this.villain.active);
    this.poser.step(dt);
    this.quipper.step(dt);
    this.bubble.step(dt);
    this.watchScroll(dt);
    this.stepSymbiote(dt);

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
        // tap jump mid-swing: a deliberate hop off with a boost, not just
        // a release. Inherits the swing's current tangential velocity so it
        // reads as leaving the arc, not a stop-and-jump.
        if (hero.jumpQueued) {
          const v = p.velocity();
          hero.vx = v.vx;
          hero.vy = Math.min(v.vy, 0) + SWING_HOP_BOOST;
          hero.pendulum = null;
          hero.transition('jumping');
          this.onJump();
          break;
        }
        const prevFeet = hero.y;
        const r = p.step(dt, input);
        hero.x = r.x;
        hero.y = r.y + hero.height; // pendulum drives the hand; feet ride below
        hero.vx = r.vx;
        hero.vy = r.vy;
        // face the direction he's actually swinging, not whichever way he
        // happened to be facing when he cast the web. A small deadzone
        // around the arc's momentary vx≈0 crossing (the bottom of the swing)
        // keeps him from flickering direction right as he passes through it.
        if (Math.abs(r.vx) > 24) hero.facing = r.vx > 0 ? 1 : -1;
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
    this.renderer.flash = this.flashFx.step(dt);

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

  /**
   * Symbiote rage mode: a timed palette-swap (see sprite.ts's recolor), not
   * new art or a new state. While it runs he's simply kept charged — energy
   * nudged up each tick — so the existing director scoring naturally favours
   * the energetic goals (box, swing, patrol) on its own; nothing here reaches
   * into director.ts to force a specific behaviour.
   */
  private stepSymbiote(dt: number): void {
    if (!this.symbiote) return;
    this.needs.energy = Math.min(1, this.needs.energy + dt * 0.05);
    this.symbioteT -= dt;
    if (this.symbioteT <= 0) {
      this.symbiote = false;
      this.quipper.reset();
      this.say('symbiote-off', {}, 1);
    }
  }

  private triggerSymbiote(): void {
    this.symbiote = true;
    this.symbioteT = 11 + Math.random() * 3;
    this.needs.energy = Math.min(1, this.needs.energy + 0.5);
    this.needs.boredom = 0;
    this.sfx.surge();
    this.shake.trigger(260);
    this.quipper.reset();
    this.say('symbiote-on', {}, 1);
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
    // the first instant of a swing plays the cast/pull motion rather than
    // snapping straight into the hang loop — see SWING_CAST_WINDOW
    const choice = hero.state === 'swinging' && hero.stateT < SWING_CAST_WINDOW
      ? { clip: pickClip('thwip-side', 'thwip', 'hang'), profile: true }
      : clipFor(hero.state);
    this.animator.play(choice.clip, this.facingDir(choice.profile));
    // gait speed tracks how fast he is actually moving, so the feet don't skate
    this.animator.setSpeed(
      hero.state === 'walking' || hero.state === 'running'
        ? Math.max(0.6, Math.min(2, Math.abs(hero.vx) / 190))
        : hero.state === 'swinging' && hero.pendulum
          ? Math.max(0.7, Math.min(1.8, Math.abs(hero.pendulum.angVel) / 1.8))
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
      { pose, bubble: this.bubble, drawX, drawY, symbiote: this.symbiote, villain: this.villain },
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
  /**
   * `force` bypasses the "already performing" guard only — the villain
   * encounter chains several performances back to back (guard pose per
   * punch beat, then the victory taunt) and each call still needs to reset
   * the clip and the expiry timer. Grounding is never bypassed.
   */
  private perform(state: HeroState, opts: { force?: boolean } = {}): void {
    if (!this.hero.grounded) return;
    if (this.hero.performing && !opts.force) return;
    this.hero.vx = 0;
    this.hero.transition(state);
    this.performing = true;
    const choice = clipFor(state);
    this.animator.play(choice.clip, this.facingDir(choice.profile), { restart: true });
    // looping fallbacks (perch, watch) need a hold time; one-shots end sooner
    // than this on their own and the timer never bites
    this.performT = (PERFORM_MAX[state] ?? PERFORM_DEFAULT) + Math.random() * 0.6;
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
    const dist = Math.hypot(x - this.hero.x, y - this.hero.y);
    // a click landing close to him gets a reaction rather than a web
    if (dist < 70) this.say('clicked-near', {}, 0.5);
    // five clicks on him within 2.5s — provoke the symbiote rage mode
    if (dist < 90 && !this.symbiote) {
      const now = performance.now();
      this.clickTimes = [...this.clickTimes, now].filter((t) => now - t < 2500);
      if (this.clickTimes.length >= 5) {
        this.clickTimes = [];
        this.triggerSymbiote();
      }
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
    this.needs.notice(0.15);

    // A hard landing cuts straight to the faceplant art, in this same physics
    // step. It used to schedule perform('faceplanting') on a setTimeout 60ms
    // later — a real-time timer racing the fixed-step physics loop — so the
    // `landing` clip would flash on screen for a couple of frames and then
    // get yanked out from under itself. Calling perform() synchronously here
    // means the very next rendered frame is already the faceplant, with no
    // intermediate flash to cut through.
    if (impact > 780) {
      this.say('big-fall', {}, 0.8);
      this.perform('faceplanting');
    } else {
      // ordinary landings keep the squash — the faceplant's own art carries
      // the hard-fall read on its own and doesn't need it stacked on top
      this.poser.land(impact);
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
      villain: this.villain.debugPhase(),
      symbiote: this.symbiote,
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

  /** QA hook: switch autonomy off so manual-control tests are deterministic. */
  setAuto(on: boolean): void {
    this.director.setEnabled(on);
  }

  /** QA hook: put him back on the spawn surface, at rest. */
  reset(): void {
    this.frozen = null;
    this.performing = false;
    this.bubble.clear();
    this.respawn();
    this.hero.transition('idle');
  }

  /** QA hook: make him talk on demand. */
  talk(text: string): void {
    this.bubble.say(text, 2.5);
  }

  /** QA hook: summon the villain encounter right now, same as pressing V. */
  spawnVillain(): boolean {
    return this.villain.forceTrigger();
  }

  /** QA hook: trigger symbiote rage mode right now, same as the click-streak. */
  spawnSymbiote(): void {
    if (!this.symbiote) this.triggerSymbiote();
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
    setAuto: (on: boolean) => system.setAuto(on),
    reset: () => system.reset(),
    talk: (t: string) => system.talk(t),
    spawnVillain: () => system.spawnVillain(),
    spawnSymbiote: () => system.spawnSymbiote(),
  };
  system.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot());
} else {
  void boot();
}
