/**
 * bubble.ts — the speech bubble, drawn on the hero canvas.
 *
 * Never DOM. The bubble must not be able to reflow, restyle or scroll the host
 * page, and it must stay behind `pointer-events: none` like everything else the
 * hero draws.
 *
 * It pops in, holds, and fades out; the tail points down at his head, and the
 * whole box is clamped into the viewport so a quip on the far right edge of the
 * page is still readable.
 */

import { drawText, measure, wrap, GLYPH_H, GLYPH_W, TRACKING } from './font.js';

const SCALE = 2;              // font pixel size
const PAD_X = 5 * SCALE;
const PAD_Y = 4 * SCALE;
const LINE_GAP = 3 * SCALE;
const MAX_CHARS = 22;
const TAIL = 5 * SCALE;

const POP = 0.12;             // seconds to scale in
const FADE = 0.35;            // seconds to fade out

const INK = '#12101a';
const FILL = '#f7f5ff';
const SHADOW = 'rgba(0,0,0,0.35)';

export class Bubble {
  private lines: string[] = [];
  private t = 0;
  private hold = 0;
  private active = false;

  /** Show `text` for `seconds` (excluding the pop and fade). */
  say(text: string, seconds = 2.2): void {
    this.lines = wrap(text, MAX_CHARS).slice(0, 3);
    this.hold = seconds;
    this.t = 0;
    this.active = this.lines.length > 0;
  }

  clear(): void {
    this.active = false;
    this.lines = [];
  }

  get visible(): boolean {
    return this.active;
  }

  step(dt: number): void {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= POP + this.hold + FADE) this.clear();
  }

  /** Current opacity and scale from the pop/hold/fade envelope. */
  private envelope(): { alpha: number; scale: number } {
    if (this.t < POP) {
      const k = this.t / POP;
      // slight overshoot so it lands with a bounce instead of easing in flatly
      return { alpha: k, scale: 0.6 + 0.5 * k - 0.1 * k * k };
    }
    const afterHold = this.t - POP - this.hold;
    if (afterHold <= 0) return { alpha: 1, scale: 1 };
    return { alpha: Math.max(0, 1 - afterHold / FADE), scale: 1 };
  }

  /**
   * Draw with the tail tip at (tipX, tipY) in viewport pixels — pass the point
   * just above the hero's head.
   */
  draw(ctx: CanvasRenderingContext2D, tipX: number, tipY: number): void {
    if (!this.active || !this.lines.length) return;

    const lineH = GLYPH_H * SCALE;
    const textW = Math.max(...this.lines.map((l) => measure(l))) * SCALE;
    const w = textW + PAD_X * 2;
    const h = this.lines.length * lineH + (this.lines.length - 1) * LINE_GAP + PAD_Y * 2;

    const { alpha, scale } = this.envelope();
    if (alpha <= 0) return;

    // clamp horizontally into the viewport, but keep the tail on his head
    const half = w / 2;
    const minX = 6 + half;
    const maxX = window.innerWidth - 6 - half;
    const cx = Math.max(minX, Math.min(maxX, tipX));
    const top = tipY - TAIL - h;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(tipX), Math.round(tipY));
    ctx.scale(scale, scale);
    ctx.translate(-Math.round(tipX), -Math.round(tipY));

    const x = Math.round(cx - half);
    const y = Math.round(top);

    // drop shadow, then a hard 2px border drawn as rects — no strokes, so the
    // edges stay on exact pixel boundaries at any dpr
    ctx.fillStyle = SHADOW;
    ctx.fillRect(x + SCALE, y + SCALE, w, h);

    ctx.fillStyle = INK;
    ctx.fillRect(x - SCALE, y - SCALE, w + SCALE * 2, h + SCALE * 2);
    ctx.fillStyle = FILL;
    ctx.fillRect(x, y, w, h);

    // tail: a small triangle stepped in pixel rows so it stays crisp
    const tx = Math.round(tipX);
    const steps = TAIL / SCALE;
    for (let i = 0; i < steps; i++) {
      const rowY = y + h + i * SCALE;
      const halfW = Math.max(SCALE, (steps - i) * SCALE);
      ctx.fillStyle = INK;
      ctx.fillRect(tx - halfW - SCALE, rowY, halfW * 2 + SCALE * 2, SCALE);
      ctx.fillStyle = FILL;
      ctx.fillRect(tx - halfW, rowY, halfW * 2, SCALE);
    }
    // cap the tail tip with ink
    ctx.fillStyle = INK;
    ctx.fillRect(tx - SCALE, y + h + TAIL, SCALE * 2, SCALE);

    this.lines.forEach((line, i) => {
      const lw = measure(line) * SCALE;
      drawText(
        ctx,
        line,
        Math.round(cx - lw / 2),
        Math.round(y + PAD_Y + i * (lineH + LINE_GAP)),
        SCALE,
        INK,
      );
    });

    ctx.restore();
  }
}

export { GLYPH_W, TRACKING };
