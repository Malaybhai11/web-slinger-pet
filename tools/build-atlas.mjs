#!/usr/bin/env node
/**
 * build-atlas.mjs — turns the banked PixelLab frames into the one sprite sheet
 * the engine ships, plus a contact sheet for eyeballing the result.
 *
 *   assets/pixellab/<clip>/<dir>/NNN.png     purchased animations
 *   assets/pixellab/owned/<clip>/<dir>/*.png animations the account already had
 *   assets/pixellab/rotations/<dir>.png      the 8 static poses
 *        ->  public/assets/hero-atlas.png + .json
 *            src/hero/animation/atlas-data.ts
 *            public/sprites.html
 *
 * Every frame is re-anchored on the character's feet before packing. The source
 * animations each sit at their own offset inside the 96x96 cell, so without
 * this he visibly bobs and slides between frames of a single cycle.
 *
 *   node tools/build-atlas.mjs
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { decodePNG, encodePNG } from './png.mjs';
import {
  makeImage, blit, normalize, hardenAlpha, despeckle, countColors,
  buildPalette, snapToPalette,
} from './pixel.mjs';

const SRC = 'assets/pixellab';
const CELL = 96;
const ANCHOR_X = CELL / 2;
const ANCHOR_Y = CELL - 8;   // 8px of room below the feet for poses that dip
const COLS = 8;

/**
 * Timing and looping per clip. Pixel art lives or dies on this: a flat 24fps
 * makes everything mush, so cycles run slow and one-shots snap.
 * `hold` repeats a frame index to give a pose weight (anticipation, impact).
 */
const CLIPS = {
  idle:        { fps: 6,  loop: true  },
  'idle-front':{ fps: 6,  loop: true  },
  'idle-side': { fps: 6,  loop: true  },
  alert:       { fps: 8,  loop: true  },
  stretch:     { fps: 8,  loop: false, hold: { 2: 3 } },  // hold the extension
  sip:         { fps: 9,  loop: false, hold: { 3: 2 } },
  walk:        { fps: 12, loop: true  },
  run:         { fps: 15, loop: true  },
  hang:        { fps: 8,  loop: true  },
  jump:        { fps: 12, loop: false },
  land:        { fps: 14, loop: false, hold: { 0: 2 } },
  skid:        { fps: 14, loop: false },
  thwip:       { fps: 18, loop: false, hold: { 1: 2 } },
  'thwip-side':{ fps: 18, loop: false, hold: { 1: 2 } },
  flip:        { fps: 16, loop: false },
  faceplant:   { fps: 12, loop: false, hold: { 0: 2 } },
  recover:     { fps: 10, loop: false },
  press:       { fps: 12, loop: false },
  bored:       { fps: 9,  loop: true  },
  creep:       { fps: 9,  loop: true  },
  crawl:       { fps: 10, loop: true  },
  grab:        { fps: 12, loop: false },
  taunt:       { fps: 14, loop: false },
  ouch:        { fps: 14, loop: false },
  leap:        { fps: 13, loop: false },
  // owned/ sources, kept as alternates
  'walk-front':{ fps: 12, loop: true  },
  'run-front': { fps: 15, loop: true  },
  pose:        { fps: 1,  loop: false },
};

const DIR_ALIAS = { south: 's', 'south-east': 'se', east: 'e', 'north-east': 'ne', north: 'n' };

const isDir = async (p) => existsSync(p) && (await stat(p)).isDirectory();

async function loadFrames(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
  const out = [];
  for (const f of files) out.push(decodePNG(await readFile(path.join(dir, f))));
  return out;
}

/** Collect every (clip, direction) group we have on disk. */
async function collectSources() {
  const groups = [];

  for (const entry of (await readdir(SRC)).sort()) {
    const p = path.join(SRC, entry);
    if (!(await isDir(p))) continue;

    if (entry === 'rotations') {
      for (const f of (await readdir(p)).filter((x) => x.endsWith('.png')).sort()) {
        const dir = f.replace(/\.png$/, '');
        groups.push({ clip: 'pose', dir, frames: [decodePNG(await readFile(path.join(p, f)))] });
      }
      continue;
    }

    if (entry === 'owned') {
      for (const slug of (await readdir(p)).sort()) {
        const sp = path.join(p, slug);
        if (!(await isDir(sp))) continue;
        // the owned walk/run are front-facing alternates; the purchased 3/4
        // versions are the ones the engine actually travels with
        const clip = /run/.test(slug) ? 'run-front' : 'walk-front';
        for (const dir of (await readdir(sp)).sort()) {
          const dp = path.join(sp, dir);
          if (!(await isDir(dp))) continue;
          const frames = await loadFrames(dp);
          if (frames.length) groups.push({ clip, dir, frames, from: `owned/${slug}` });
        }
      }
      continue;
    }

    for (const dir of (await readdir(p)).sort()) {
      const dp = path.join(p, dir);
      if (!(await isDir(dp))) continue;
      const frames = await loadFrames(dp);
      if (frames.length) groups.push({ clip: entry, dir, frames });
    }
  }
  return groups;
}

// ---------------------------------------------------------------- build

if (!existsSync(SRC)) {
  console.error(`no ${SRC} — run: PIXELLAB_TOKEN=... node tools/pixellab.mjs --commit`);
  process.exit(1);
}

const groups = await collectSources();
if (!groups.length) { console.error(`no frames found under ${SRC}`); process.exit(1); }

// One palette for the whole character, weighted toward the canonical rotations
// so the 8 static poses define the suit colours and the animations conform to
// them rather than each other.
const rotationFrames = groups.filter((g) => g.clip === 'pose').flatMap((g) => g.frames);
const allFrames = groups.flatMap((g) => g.frames);
const PALETTE = buildPalette([...rotationFrames, ...rotationFrames, ...allFrames], 48);

// normalise every frame onto the feet anchor
const cells = [];          // { key, img }
const frameTable = {};     // key -> { x, y }
const clipTable = {};      // clip -> { dirs: { dir: [keys] }, dur: [ms], loop }
let speckles = 0;

for (const g of groups) {
  const keys = [];
  const conf = CLIPS[g.clip] || { fps: 12, loop: true };
  g.frames.forEach((raw, i) => {
    hardenAlpha(raw);
    snapToPalette(raw, PALETTE);
    speckles += despeckle(raw);
    const { img, empty } = normalize(raw, CELL, ANCHOR_X, ANCHOR_Y);
    if (empty) return;
    const key = `${g.clip}/${g.dir}/${i}`;
    cells.push({ key, img });
    keys.push(key);
  });
  if (!keys.length) continue;

  // apply holds by repeating frame keys in the sequence
  const seq = [];
  keys.forEach((k, i) => {
    const reps = conf.hold?.[i] ?? 1;
    for (let r = 0; r < reps; r++) seq.push(k);
  });

  clipTable[g.clip] ??= { dirs: {}, dur: Math.round(1000 / conf.fps), loop: conf.loop !== false };
  clipTable[g.clip].dirs[g.dir] = seq;
}

// pack into a grid
const rows = Math.ceil(cells.length / COLS);
const atlas = makeImage(COLS * CELL, rows * CELL);
cells.forEach((c, i) => {
  const x = (i % COLS) * CELL;
  const y = Math.floor(i / COLS) * CELL;
  blit(atlas, c.img, x, y);
  frameTable[c.key] = { x, y };
});

await mkdir('public/assets', { recursive: true });
await writeFile('public/assets/hero-atlas.png', encodePNG(atlas.width, atlas.height, atlas.data));

const meta = {
  cell: CELL,
  anchor: { x: ANCHOR_X, y: ANCHOR_Y },
  atlas: { width: atlas.width, height: atlas.height, cols: COLS, rows },
  frames: frameTable,
  clips: clipTable,
};
await writeFile('public/assets/hero-atlas.json', JSON.stringify(meta, null, 1) + '\n');

// ---------------------------------------------------------------- emit TS

const ts = `/**
 * atlas-data.ts — GENERATED by tools/build-atlas.mjs. Do not edit.
 *
 * Every frame is anchored on the character's feet at (${ANCHOR_X}, ${ANCHOR_Y}) inside a
 * ${CELL}x${CELL} cell, so the engine can draw any clip with one blit and no per-clip
 * offsets. Run \`npm run sprites\` to rebuild.
 */

export const ATLAS_URL = '/assets/hero-atlas.png';
export const CELL = ${CELL};
export const ANCHOR_X = ${ANCHOR_X};
export const ANCHOR_Y = ${ANCHOR_Y};

export interface FrameRect { x: number; y: number }
export interface Clip {
  /** frame keys per source direction; the engine mirrors for the west side */
  dirs: Record<string, string[]>;
  /** milliseconds per frame */
  dur: number;
  loop: boolean;
}

export const FRAMES: Record<string, FrameRect> = ${JSON.stringify(frameTable)};

export const CLIPS: Record<string, Clip> = ${JSON.stringify(clipTable)};

export const CLIP_NAMES = Object.keys(CLIPS);
`;
await mkdir('src/hero/animation', { recursive: true });
await writeFile('src/hero/animation/atlas-data.ts', ts);

// ---------------------------------------------------------------- contact sheet

const clipRows = Object.entries(clipTable).map(([clip, c]) => {
  const dirs = Object.entries(c.dirs).map(([dir, keys]) => {
    const rects = keys.map((k) => frameTable[k]);
    return `    <div class="dir">
      <div class="lbl">${dir} <em>${keys.length}f · ${c.dur}ms${c.loop ? '' : ' · once'}</em></div>
      <div class="play" data-frames='${JSON.stringify(rects)}' data-dur="${c.dur}" data-loop="${c.loop}"></div>
      <div class="strip">${rects.map((r) => `<i style="background-position:-${r.x}px -${r.y}px"></i>`).join('')}</div>
    </div>`;
  }).join('\n');
  return `  <section><h2>${clip}</h2>\n${dirs}\n  </section>`;
}).join('\n');

const html = `<!doctype html>
<meta charset="utf-8"><title>hero sprites — contact sheet</title>
<style>
  :root { --cell: ${CELL}px; color-scheme: dark }
  body { background:#141418; color:#e8e8ef; font:13px ui-monospace,Menlo,monospace; margin:0; padding:24px }
  h1 { font-size:16px; margin:0 0 4px } p.sub { color:#8b8b9a; margin:0 0 24px }
  section { margin-bottom:28px; border-top:1px solid #2a2a34; padding-top:12px }
  h2 { font-size:14px; color:#ff5c66; margin:0 0 10px }
  .dir { display:flex; align-items:flex-start; gap:16px; margin-bottom:10px; flex-wrap:wrap }
  .lbl { width:150px; color:#b9b9c8 } .lbl em { color:#6f6f80; font-style:normal; display:block; font-size:11px }
  .play, .strip i {
    width:var(--cell); height:var(--cell);
    background-image:url('/assets/hero-atlas.png');
    image-rendering:pixelated; transform:scale(2); transform-origin:top left;
  }
  .play { outline:1px solid #2f2f3c }
  .strip { display:flex; gap:calc(var(--cell) + 6px); margin-left:calc(var(--cell) + 8px) }
  .strip i { display:block; outline:1px solid #24242e }
  .row { display:flex; gap:0 }
</style>
<h1>hero sprites — contact sheet</h1>
<p class="sub">${cells.length} frames · ${Object.keys(clipTable).length} clips · atlas ${atlas.width}×${atlas.height} · shown at 2× · despeckled ${speckles}px</p>
${clipRows}
<script>
for (const el of document.querySelectorAll('.play')) {
  const frames = JSON.parse(el.dataset.frames);
  const dur = +el.dataset.dur, loop = el.dataset.loop === 'true';
  let i = 0;
  const tick = () => {
    const f = frames[i];
    el.style.backgroundPosition = \`-\${f.x}px -\${f.y}px\`;
    i++;
    if (i >= frames.length) { if (!loop) { setTimeout(() => { i = 0; tick(); }, 700); return; } i = 0; }
    setTimeout(tick, dur);
  };
  tick();
}
</script>
`;
await writeFile('public/sprites.html', html);

// ---------------------------------------------------------------- report

const colors = countColors(atlas);
console.log(`palette ${PALETTE.length} colours`);
console.log(`\natlas   ${atlas.width}x${atlas.height}  (${COLS}x${rows} cells of ${CELL})`);
console.log(`frames  ${cells.length}`);
console.log(`clips   ${Object.keys(clipTable).length}`);
console.log(`colours ${colors}`);
if (speckles) console.log(`despeckled ${speckles} orphan pixels`);
console.log('\nclips:');
for (const [name, c] of Object.entries(clipTable)) {
  const d = Object.entries(c.dirs).map(([k, v]) => `${k}:${v.length}`).join(' ');
  console.log(`  ${name.padEnd(12)} ${String(c.dur).padStart(3)}ms ${c.loop ? 'loop' : 'once'}  ${d}`);
}
console.log('\nwrote public/assets/hero-atlas.png + .json, src/hero/animation/atlas-data.ts, public/sprites.html');
