/**
 * villain.ts — a rare, fully procedural boss encounter.
 *
 * There is no bought art for an antagonist, and none is needed: he is a
 * blocky pixel silhouette drawn with filled rects — dark, faceless, glowing
 * eyes, sized to sit next to the real sprite (~90px tall) without competing
 * with it for detail. He creeps in from the side the hero isn't facing, the
 * hero turns and throws a short combo (the real bought fight-stance clip,
 * re-triggered on each beat), and it ends in a screen-flash KO with a popped
 * "KO!" callout.
 *
 * Rare and autonomous by default (a long random wait between encounters), and
 * summonable on demand with the 'V' key (wired in index.ts) — the on-demand
 * path is what makes this the kind of thing someone screen-records and posts.
 */

import type { Hero, HeroState } from '../character/state.js';
import type { Trigger, QuipContext } from '../ai/quips.js';
import { drawText, measure } from './font.js';

export interface VillainHost {
  hero: Hero;
  perform(state: HeroState, opts?: { force?: boolean }): void;
  say(trigger: Trigger, ctx?: QuipContext, chance?: number): void;
  shake(impact: number): void;
  flash(peak: number): void;
  spark(x: number, y: number): void;
  punchSfx(): void;
  koSfx(): void;
}

type Phase = 'hidden' | 'creeping' | 'confront' | 'fighting' | 'ko';

/** Punches thrown before he goes down. */
const HITS_TO_KO = 4;
/** Seconds between punches. */
const HIT_EVERY = 0.45;

export class Villain {
  private phase: Phase = 'hidden';
  private x = 0;
  private y = 0;
  /** direction from the hero to him — also the facing the hero adopts */
  private side: 1 | -1 = 1;
  private t = 0;
  private hits = 0;
  private spawnTimer = 90 + Math.random() * 70;
  private hitFlash = 0;
  private bob = 0;
  private koVX = 0;
  private koRot = 0;
  private koOpacity = 1;

  constructor(private host: VillainHost) {}

  get active(): boolean {
    return this.phase !== 'hidden';
  }

  /** Summon him right now, skipping the wait. Used by the 'V' hotkey and QA. */
  forceTrigger(): boolean {
    if (this.active || !this.host.hero.grounded || this.host.hero.performing) return false;
    this.begin();
    return true;
  }

  /** `eligible` gates only whether a *new* encounter may start this tick. */
  step(dt: number, eligible: boolean): void {
    if (this.phase === 'hidden') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && eligible) this.begin();
      return;
    }
    this.t += dt;
    this.bob = Math.sin(this.t * 8) * 3;
    switch (this.phase) {
      case 'creeping': this.stepCreeping(dt); break;
      case 'confront': this.stepConfront(); break;
      case 'fighting': this.stepFighting(dt); break;
      case 'ko': this.stepKo(dt); break;
    }
  }

  private begin(): void {
    const hero = this.host.hero;
    // spawn on the side he isn't already facing — a proper sneak-up
    this.side = (-hero.facing) as 1 | -1;
    this.x = hero.x + this.side * 240;
    this.y = hero.y;
    this.t = 0;
    this.hits = 0;
    this.hitFlash = 0;
    this.koOpacity = 1;
    this.phase = 'creeping';
    hero.facing = this.side;
    this.host.perform('alerting', { force: true });
    this.host.say('villain-spot', {}, 1);
  }

  private stepCreeping(dt: number): void {
    const hero = this.host.hero;
    const targetX = hero.x + this.side * 68;
    const dx = targetX - this.x;
    const step = 100 * dt;
    this.y = hero.y;
    if (Math.abs(dx) <= step || this.t > 3.2) {
      this.x = targetX;
      this.phase = 'confront';
      this.t = 0;
      return;
    }
    this.x += Math.sign(dx) * step;
  }

  private stepConfront(): void {
    if (this.t < 0.25) return;
    this.host.perform('boxing', { force: true });
    this.host.say('villain-taunt', {}, 0.9);
    this.phase = 'fighting';
    this.t = 0;
    this.hits = 0;
  }

  private stepFighting(dt: number): void {
    const beat = Math.floor(this.t / HIT_EVERY);
    if (beat > this.hits && this.hits < HITS_TO_KO) {
      this.hits = beat;
      // re-triggering a looping clip with restart:true snaps it back to
      // frame 0 — a real visual "beat" synced to each punch, from art that
      // was never meant to be a punch-connect frame
      this.host.perform('boxing', { force: true });
      this.hitFlash = 1;
      this.x += this.side * 5; // knocked further from the hero each hit
      this.host.shake(140);
      this.host.spark(this.x, this.y - 34);
      this.host.punchSfx();
      if (this.hits === 2) this.host.say('villain-taunt', {}, 0.6);
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);

    if (this.hits >= HITS_TO_KO) {
      this.phase = 'ko';
      this.t = 0;
      this.koVX = this.side * 240;
      this.koRot = 0;
      this.koOpacity = 1;
      this.host.shake(900);
      this.host.flash(0.9);
      this.host.koSfx();
      this.host.perform('taunting', { force: true });
      this.host.say('villain-ko', {}, 1);
    }
  }

  private stepKo(dt: number): void {
    this.x += this.koVX * dt;
    this.koVX *= Math.pow(0.85, dt * 60);
    this.koRot += dt * 16 * this.side;
    if (this.t > 0.5) this.koOpacity = Math.max(0, 1 - (this.t - 0.5) / 0.6);
    if (this.t > 1.3) {
      this.phase = 'hidden';
      this.spawnTimer = 100 + Math.random() * 80;
      this.hits = 0;
    }
  }

  /** QA / debug hook. */
  debugPhase(): string {
    return this.phase;
  }

  draw(ctx: CanvasRenderingContext2D, scrollY: number, shakeX: number, shakeY: number): void {
    if (this.phase === 'hidden') return;

    const koHop = this.phase === 'ko' ? Math.max(0, 0.4 - this.t) * 70 : 0;
    const vx = Math.round(this.x + shakeX);
    const vy = Math.round(this.y - scrollY + shakeY - this.bob - koHop);

    ctx.save();
    ctx.translate(vx, vy);
    if (this.phase === 'ko') ctx.rotate(this.koRot);
    ctx.globalAlpha = this.phase === 'ko' ? this.koOpacity : 1;

    this.drawBody(ctx, '#181220');
    if (this.hitFlash > 0.02) {
      this.drawBody(ctx, `rgba(255,255,255,${Math.min(0.85, this.hitFlash)})`);
    }

    // eyes — the only feature he has; a shadow with a grudge
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(-7, -64, 4, 4);
    ctx.fillRect(3, -64, 4, 4);

    ctx.restore();

    if (this.phase === 'ko' && this.t < 1.1) {
      const k = Math.min(1, this.t / 0.18);
      const scale = 0.5 + 0.9 * k - 0.2 * k * k; // pop in with a little overshoot
      const alpha = this.t > 0.7 ? Math.max(0, 1 - (this.t - 0.7) / 0.4) : 1;
      const text = 'KO!';
      const w = measure(text) * 3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(vx, vy - 92);
      ctx.scale(scale, scale);
      drawText(ctx, text, -w / 2, -12, 3, '#ffe14d');
      ctx.restore();
    }
  }

  /** Feet at local (0,0), growing upward — matches the hero's own anchor convention. */
  private drawBody(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(-12, -22, 10, 22); // left leg
    ctx.fillRect(2, -22, 10, 22);   // right leg
    ctx.fillRect(-15, -52, 30, 30); // torso
    ctx.fillRect(-24, -50, 9, 26);  // left arm
    ctx.fillRect(15, -50, 9, 26);   // right arm
    ctx.fillRect(-10, -70, 20, 18); // head
  }
}
