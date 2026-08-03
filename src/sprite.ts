/**
 * sprite.ts — procedural pixel-art for our tiny original web-slinger hero.
 * The whole character is drawn from hand-authored 16x14 pixel grids — no image assets.
 */

export const SPRITE_W = 16;
export const SPRITE_H = 14;

export type PoseName = 'CROUCH' | 'SHOOT' | 'WAVE' | 'FALL' | 'SWING';

const PALETTE: Record<string, string> = {
  o: '#150E1F', // outline
  r: '#E63A3E', // suit red
  d: '#A91F2E', // dark red
  b: '#2F5FB3', // suit blue
  n: '#1F3E7A', // dark blue
  w: '#F2F6FF', // eye white / web
  p: '#F4F0E6', // glove white-ish
  s: '#D4262C', // boots
};

const CROUCH = [
  '......oooo......',
  '.....orrrro.....',
  '....orrrrrro....',
  '...orwwrrwwro...',
  '...orwwwrwwwro..',
  '....orrrrrro....',
  '....ordrrdro....',
  '.....orrrro.....',
  '...d.orrrro.d...',
  '..pp..orrro..pp.',
  '..bboobbboobbb..',
  '.bb..obbbbo..bb.',
  '.b...ob..bo...b.',
  'ss...ss..ss...ss',
];

const SHOOT = [
  '......oooo......',
  '.....orrrro.....',
  '....orrrrrro....',
  '...orwwrrwwro...',
  '...orwwwrwwwro..',
  '....orrrrrro....',
  '....ordrrdro....',
  '.....orrrro.....',
  '...dorrrrrrrrppo',
  '..pp..orrro.....',
  '..bboobbboobbb..',
  '.bb..obbbbo..bb.',
  '.b...ob..bo...b.',
  'ss...ss..ss...ss',
];

const WAVE = [
  '..........ppo...',
  '......ooooo.....',
  '.....orrrro.....',
  '....orrrrrro....',
  '...orwwrrwwro...',
  '...orwwwrwwwro..',
  '....orrrrrro....',
  '....ordrrdro....',
  '.....orrrro.....',
  '..pp..orrro.....',
  '...oobbbbo......',
  '...obbbbbbo.....',
  '...ob.b.bo......',
  '...ss...ss......',
];

const FALL = [
  '......oooo......',
  '.....orrrro.....',
  '....orrrrrro....',
  '...orwwrrwwro...',
  '...orwwwrwwwro..',
  '....orrrrrro....',
  '.pp.ordrrdro.pp.',
  'ppp..orrrro..ppp',
  '.....orrrro.....',
  '....oobbboo.....',
  '....obbbbbb.....',
  '.....b..b.......',
  '....ss...ss.....',
  '................',
];

const SWING = [
  '.........ppo....',
  '........opo.....',
  '......oooo......',
  '.....orrrro.....',
  '....orrrrrro....',
  '...orwwrrwwro...',
  '...orwwwrwwwro..',
  '....orrrrrro....',
  '....ordrrdro....',
  '...dorrrro.d....',
  '..pp.orrrro.....',
  '...oobbboo......',
  '..oobbbbo.......',
  '..ss..ss........',
];

const POSES: Record<PoseName, string[]> = { CROUCH, SHOOT, WAVE, FALL, SWING };

/** eye pixel cells (white cells that can blink / hold pupils), per pose */
const EYES: Partial<Record<PoseName, Array<[number, number]>>> = {
  CROUCH: [[5, 3], [6, 3], [9, 3], [10, 3], [5, 4], [6, 4], [7, 4], [9, 4], [10, 4], [11, 4]],
  SHOOT: [[5, 3], [6, 3], [9, 3], [10, 3], [5, 4], [6, 4], [7, 4], [9, 4], [10, 4], [11, 4]],
  WAVE: [[5, 4], [6, 4], [9, 4], [10, 4], [5, 5], [6, 5], [7, 5], [9, 5], [10, 5], [11, 5]],
  FALL: [[5, 3], [6, 3], [9, 3], [10, 3], [5, 4], [6, 4], [7, 4], [9, 4], [10, 4], [11, 4]],
  SWING: [[5, 5], [6, 5], [9, 5], [10, 5], [5, 6], [6, 6], [7, 6], [9, 6], [10, 6], [11, 6]],
};

/** pupil anchor cells (center of each eye) per pose: [leftEye, rightEye] */
const PUPILS: Partial<Record<PoseName, Array<[number, number]>>> = {
  CROUCH: [[6, 4], [10, 4]],
  SHOOT: [[6, 4], [10, 4]],
  WAVE: [[6, 5], [10, 5]],
  FALL: [[6, 4], [10, 4]],
  SWING: [[6, 6], [10, 6]],
};

export interface DrawOptions {
  flip?: boolean;
  blink?: boolean;
  eyeDX?: -1 | 0 | 1;
  rotation?: number; // radians, around anchor
  grip?: boolean; // anchor at top (hanging hand) instead of feet
  squashY?: number; // 1 = normal, <1 squashed vertically
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  pose: PoseName,
  x: number,
  y: number,
  scale: number,
  opts: DrawOptions = {},
): void {
  const grid = POSES[pose];
  const eyeSet = new Set((EYES[pose] ?? []).map(([cx, cy]) => cy * SPRITE_W + cx));
  const pupils = PUPILS[pose] ?? [];
  const eyeDX = opts.eyeDX ?? 0;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (opts.rotation) ctx.rotate(opts.rotation);
  if (opts.squashY !== undefined && opts.squashY !== 1) ctx.scale(1 / Math.sqrt(opts.squashY), opts.squashY);
  if (opts.flip) ctx.scale(-1, 1);

  const originX = -8 * scale;
  const originY = opts.grip ? 0 : -SPRITE_H * scale;

  for (let gy = 0; gy < grid.length; gy++) {
    const row = grid[gy];
    for (let gx = 0; gx < row.length; gx++) {
      const ch = row[gx];
      if (ch === '.') continue;
      const isEye = eyeSet.has(gy * SPRITE_W + gx);
      let color = PALETTE[ch];
      if (isEye && opts.blink) color = PALETTE.o; // closed eyes
      ctx.fillStyle = color;
      ctx.fillRect(originX + gx * scale, originY + gy * scale, scale, scale);
    }
  }

  // pupils — the little guy watches your cursor
  if (!opts.blink) {
    ctx.fillStyle = PALETTE.o;
    for (const [px, py] of pupils) {
      ctx.fillRect(originX + (px + eyeDX) * scale, originY + py * scale, scale, scale);
    }
  }

  ctx.restore();
}
