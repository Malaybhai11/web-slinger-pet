/**
 * font.ts — a 5x7 bitmap font, drawn as filled rects on the hero canvas.
 *
 * The bubble is rendered on the canvas rather than in the DOM so it can never
 * reflow, restyle or otherwise disturb the host page — the whole point of this
 * project is that the hero lives on your page without touching its layout. That
 * rules out DOM text, and loading a webfont for a handful of words would mean
 * shipping an asset for a project that has none. So: glyphs as pixels.
 *
 * Uppercase only. At 5x7 that reads far more cleanly than a squeezed lowercase
 * set, and it lands on the right side of "retro" rather than "broken".
 */

type Glyph = string[];

const G: Record<string, Glyph> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '%': ['##..#', '##.#.', '..#..', '.#...', '#..##', '..###', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** one blank column between glyphs */
export const TRACKING = 1;

const FALLBACK = G['?'];

/** Width in unscaled pixels of `text`. */
export function measure(text: string): number {
  if (!text.length) return 0;
  return text.length * (GLYPH_W + TRACKING) - TRACKING;
}

/**
 * Draw `text` with its top-left at (x, y), each source pixel `scale` px square.
 * Coordinates are expected to already be whole numbers.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const up = text.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = G[ch] ?? FALLBACK;
    for (let row = 0; row < GLYPH_H; row++) {
      const line = g[row];
      let run = 0;
      // batch horizontal runs into one fillRect — a glyph is typically 2-3
      // rects per row instead of 5, which matters when the bubble redraws
      // every frame
      for (let col = 0; col <= GLYPH_W; col++) {
        const on = col < GLYPH_W && line[col] === '#';
        if (on) { run++; continue; }
        if (run) {
          ctx.fillRect(cx + (col - run) * scale, y + row * scale, run * scale, scale);
          run = 0;
        }
      }
    }
    cx += (GLYPH_W + TRACKING) * scale;
  }
}

/** Greedy word wrap to `maxChars` per line. */
export function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (!line.length) { line = w; continue; }
    if (line.length + 1 + w.length <= maxChars) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
