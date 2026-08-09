/**
 * index.ts — entry point: boots the DOM-aware web-slinging hero (PRD §14).
 * Composes engine + physics + world + input + camera + animation + audio.
 */

import { Engine } from './engine.js';
import { Hero, type InputState } from './character/state.js';
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
import { loadAtlas } from './animation/sprite.js';
import { Renderer } from './render/renderer.js';
import { Sounds } from './audio/sounds.js';
import { Sfx } from './audio/effects.js';

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
  private engine = new Engine(
    (dt) => this.step(dt),
    (t) => this.render(t),
  );

  private lastRenderT = 0;
  private frameMs = 16.7;
  private slowFor = 0;
  private degraded = false;

  start(): void {
    this.map.rebuild();
    this.spawn();
    const unlock = (): void => this.sounds.unlock();
    this.keyboard.attach(unlock);
    this.mouse.attach((x, y) => this.onClick(x, y), unlock);
    this.touch.attach((x, y) => this.onTap(x, y), unlock);
    window.addEventListener('load', () => this.map.rebuild());
    this.scanner.start();
    this.engine.start();
  }

  // ------------------------------------------------ physics step (fixed dt)
  private step(dt: number): void {
    const hero = this.hero;
    hero.stateT += dt;

    const kb = this.keyboard.input;
    const tc = this.touch.input;
    const input: InputState = {
      left: kb.left || tc.left,
      right: kb.right || tc.right,
      crouch: kb.crouch || tc.crouch,
      run: kb.run || tc.run,
    };
    if (this.keyboard.takeJump()) hero.jumpQueued = true;

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

  // ------------------------------------------------ render (per rAF)
  private render(timeMs: number): void {
    const dtMs = this.lastRenderT ? timeMs - this.lastRenderT : 16.7;
    this.lastRenderT = timeMs;

    // fps watchdog → graceful degradation (PRD §12)
    this.frameMs = this.frameMs * 0.95 + dtMs * 0.05;
    if (this.frameMs > 33 && !this.degraded) {
      this.slowFor += dtMs;
      if (this.slowFor > 2000) this.degrade();
    } else {
      this.slowFor = 0;
    }

    this.animator.setState(this.hero.state);
    this.animator.update(dtMs);
    this.renderer.render(this.hero, this.shooter, this.animator, this.particles, this.map, timeMs);
  }

  private degrade(): void {
    this.degraded = true;
    this.particles.enabled = false;
    this.renderer.shadowEnabled = false;
    this.shake.enabled = false;
  }

  // ------------------------------------------------ pointer actions
  private onClick(x: number, y: number): void {
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
  }

  onJump(): void {
    this.sfx.jump();
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
    return {
      state: hero.state,
      x: Math.round(hero.x),
      y: Math.round(hero.y),
      ground: hero.ground ? hero.ground.el.tagName : null,
      surfaces: this.map.surfaces.length,
      fps: Math.round(1000 / this.frameMs),
    };
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
  };
  system.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot());
} else {
  void boot();
}
