#!/usr/bin/env node
/**
 * pixellab.mjs — buys character animations from the PixelLab API and banks the
 * frames in assets/pixellab/ so the sprite build never needs the API again.
 *
 * Spend safety, in order of importance:
 *   • dry run is the default; nothing is bought without --commit
 *   • every job is checked against a hard budget cap before it is submitted
 *   • `directions` is ALWAYS sent explicitly — template mode otherwise defaults
 *     to all 8 directions, which is 8 generations instead of 1
 *   • anything already on disk (per ledger.json) is skipped, so re-runs cost 0
 *
 * The token is read from PIXELLAB_TOKEN and is never written to disk or logged.
 *
 *   node tools/pixellab.mjs                 # dry run: show the ledger + cost
 *   node tools/pixellab.mjs --commit        # actually buy
 *   node tools/pixellab.mjs --wave 2 --commit
 *   node tools/pixellab.mjs --pull-existing --commit   # free: rotations + owned anims
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { encodePNG } from './png.mjs';

const API = 'https://api.pixellab.ai/v2';
const CHARACTER_ID = 'a157ad66-8f09-4a87-986f-7bffb7df4c8f';
const OUT = 'assets/pixellab';
const LEDGER = path.join(OUT, 'ledger.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);

const COMMIT = has('--commit');
const WAVE = Number(val('--wave', '1'));
const MAX_GEN = Number(val('--max-gen', '17'));

/**
 * The shopping list. Each row is exactly 1 generation.
 *
 * `as` is our internal state name; `template` is PixelLab's id; `dir` is the
 * single direction we buy (the engine mirrors east→west and south-east→
 * south-west, so we never pay for a mirror).
 *
 * Templates are filtered by the character's body template — this character is
 * `mannequin`, whose catalogue has no hang/climb/sit/sleep/wave. The useful
 * repurposes: `throw-object` is the web-shot thwip, `pull-heavy-object` is the
 * best available web-line hang, `crouching` is the landing, `running-slide` is
 * a skid-stop at the edge of a button, and `falling-back-death` is the
 * faceplant after a bad fall.
 */
const WAVES = {
  // wave 1 — everything the pet needs to function at all
  1: [
    { as: 'idle',       template: 'breathing-idle',             dir: 'south-east' },
    { as: 'idle-front', template: 'breathing-idle',             dir: 'south'      },
    { as: 'walk',       template: 'walking-8-frames',           dir: 'south-east' },
    { as: 'run',        template: 'running-8-frames',           dir: 'south-east' },
    { as: 'jump',       template: 'jumping-1',                  dir: 'south-east' },
    { as: 'land',       template: 'crouching',                  dir: 'south-east' },
    { as: 'thwip',      template: 'throw-object',               dir: 'south-east' },
    { as: 'thwip-side', template: 'throw-object',               dir: 'east'       },
    { as: 'hang',       template: 'pull-heavy-object',          dir: 'east'       },
    { as: 'faceplant',  template: 'falling-back-death',         dir: 'south-east' },
    { as: 'recover',    template: 'getting-up',                 dir: 'south-east' },
    { as: 'skid',       template: 'running-slide',              dir: 'south-east' },
    { as: 'alert',      template: 'fight-stance-idle-8-frames', dir: 'south-east' },
    { as: 'flip',       template: 'backflip',                   dir: 'south-east' },
  ],
  // wave 2 — personality, bought after wave 1 is reviewed on the contact sheet
  2: [
    { as: 'press',      template: 'pushing',                    dir: 'south'      },
    { as: 'bored',      template: 'sad-walk',                   dir: 'south-east' },
    { as: 'creep',      template: 'scary-walk',                 dir: 'south-east' },
    { as: 'crawl',      template: 'crouched-walking',           dir: 'south-east' },
    { as: 'grab',       template: 'picking-up',                 dir: 'south'      },
    { as: 'taunt',      template: 'high-kick',                  dir: 'south'      },
    { as: 'ouch',       template: 'taking-punch',               dir: 'south'      },
    { as: 'leap',       template: 'running-jump',               dir: 'south-east' },
  ],
  // wave 3 — closing the idle-personality gap. The `mannequin` catalogue has no
  // sit, sleep, yawn or stretch, so these are the closest reads available:
  // pulling with both arms passes for a stretch, and a profile idle gives him
  // something to do while perched looking off the edge of a heading.
  3: [
    { as: 'stretch',    template: 'pull-heavy-object',          dir: 'south'      },
    { as: 'sip',        template: 'drinking',                   dir: 'south'      },
    { as: 'idle-side',  template: 'breathing-idle',             dir: 'east'       },
  ],
};

const token = process.env.PIXELLAB_TOKEN;
if (!token) {
  console.error('PIXELLAB_TOKEN is not set. Export it for this command only:\n' +
                '  PIXELLAB_TOKEN=... node tools/pixellab.mjs --commit');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${token}` };
const jsonHeaders = { ...auth, 'Content-Type': 'application/json' };

async function api(pathname, init = {}, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + pathname, init);
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      if (r.ok) return body;
      // 4xx is a real answer, not a blip — don't burn retries on it
      if (r.status >= 400 && r.status < 500) {
        const err = new Error(`${r.status} ${pathname}: ${text.slice(0, 300)}`);
        err.status = r.status;
        throw err;
      }
      last = new Error(`${r.status} ${pathname}: ${text.slice(0, 200)}`);
    } catch (e) {
      if (e.status) throw e;
      last = e;
    }
    await sleep(1000 * 2 ** i);
  }
  throw last;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function balance() {
  const b = await api('/balance', { headers: auth });
  return b?.subscription?.generations ?? 0;
}

async function loadLedger() {
  if (!existsSync(LEDGER)) return { spent: 0, entries: [] };
  return JSON.parse(await readFile(LEDGER, 'utf8'));
}

async function saveLedger(l) {
  await mkdir(OUT, { recursive: true });
  await writeFile(LEDGER, JSON.stringify(l, null, 2) + '\n');
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}: ${url.slice(0, 90)}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

/** Poll a background job to completion. Template jobs land in ~30-120s. */
async function waitForJob(id, label) {
  const deadline = Date.now() + 8 * 60_000;
  let delay = 3000;
  while (Date.now() < deadline) {
    await sleep(delay);
    delay = Math.min(delay * 1.25, 12_000);
    const j = await api(`/background-jobs/${id}`, { headers: auth });
    if (j.status === 'completed') return j;
    if (j.status === 'failed' || j.status === 'error') {
      throw new Error(`job ${label} failed: ${JSON.stringify(j).slice(0, 300)}`);
    }
    process.stdout.write('.');
  }
  throw new Error(`job ${label} timed out`);
}

/**
 * Pull the 8 rotations and every animation already owned. Costs nothing.
 *
 * These land under `owned/` rather than beside the purchased clips: the account
 * already has an animation literally called `walk`, and a purchase named `walk`
 * would otherwise overwrite half its frames and leave a spliced cycle.
 */
async function pullExisting(ledger) {
  const c = await api(`/characters/${CHARACTER_ID}`, { headers: auth });
  // anything we bought is already banked under its own clip name; pulling it
  // again would duplicate every purchase into owned/ as a bogus alternate
  const bought = new Set((ledger?.entries || []).map((e) => e.template));
  let n = 0;
  let skipped = 0;
  for (const [dir, url] of Object.entries(c.rotation_urls || {})) {
    await download(url, path.join(OUT, 'rotations', `${dir}.png`));
    n++;
  }
  for (const a of c.animations || []) {
    const slug = a.animation_type.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
    if (bought.has(a.animation_type) || bought.has(slug)) { skipped++; continue; }
    for (const d of a.directions || []) {
      for (let i = 0; i < d.frames.length; i++) {
        await download(d.frames[i], path.join(OUT, 'owned', slug, d.direction, `${String(i).padStart(3, '0')}.png`));
        n++;
      }
    }
  }
  console.log(`pulled ${n} existing frames into ${OUT}/owned (0 generations)` +
              (skipped ? `, skipped ${skipped} already purchased` : ''));
}

/** Submit one job. Returns its background job id without waiting. */
async function submit(job) {
  const res = await api('/animate-character', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      character_id: CHARACTER_ID,
      mode: 'template',
      template_animation_id: job.template,
      animation_name: job.as,
      directions: [job.dir],       // NEVER omit: empty means all 8 directions
    }),
  });
  const ids = res.background_job_ids || [];
  if (ids.length !== 1) throw new Error(`expected 1 job, got ${ids.length}`);
  return ids[0];
}

/**
 * Frames arrive as inline `rgba_bytes` base64, not URLs. Prefer
 * `quantized_images` — the palette-reduced version (~45 colours vs ~144), which
 * is the one that actually reads as pixel art — and fall back to the persisted
 * storage URLs.
 */
function framesOf(done) {
  const r = done.last_response || {};
  const inline = r.quantized_images?.length ? r.quantized_images : r.images;
  if (inline?.length) {
    return inline.map((im) => ({
      kind: 'rgba',
      width: im.width,
      height: im.height,
      data: Buffer.from(im.base64, 'base64'),
    }));
  }
  const urls = r.storage_urls?.frames || [];
  return urls.map((u) => ({ kind: 'url', url: u }));
}

async function writeFrame(frame, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  if (frame.kind === 'url') return download(frame.url, dest);
  await writeFile(dest, encodePNG(frame.width, frame.height, frame.data));
}

/** Collect a job that has already been paid for and save its frames. */
async function collect(job, ledger) {
  const label = `${job.as} (${job.template}/${job.dir})`;
  const done = await waitForJob(job.jobId, label);
  const frames = framesOf(done);
  if (!frames.length) {
    throw new Error(`no frames for ${label}: ${JSON.stringify(done.last_response).slice(0, 260)}`);
  }
  for (let i = 0; i < frames.length; i++) {
    await writeFrame(frames[i], path.join(OUT, job.as, job.dir, `${String(i).padStart(3, '0')}.png`));
  }
  if (!ledger.entries.some((e) => e.job_id === job.jobId)) {
    ledger.entries.push({
      as: job.as, template: job.template, direction: job.dir,
      frames: frames.length, job_id: job.jobId, cost: 1, at: new Date().toISOString(),
    });
    ledger.spent += 1;
    await saveLedger(ledger);
  }
  return frames.length;
}

// ---------------------------------------------------------------- main

const ledger = await loadLedger();
const done = new Set(ledger.entries.map((e) => `${e.as}:${e.direction}`));

if (has('--pull-existing')) {
  if (!COMMIT) { console.log('dry run — would pull rotations + owned animations (0 generations)'); process.exit(0); }
  await pullExisting(ledger);
  process.exit(0);
}

const LIMIT = Number(val('--limit', '0'));
let wanted = (WAVES[WAVE] || []).filter((j) => !done.has(`${j.as}:${j.dir}`));
const skipped = (WAVES[WAVE] || []).length - wanted.length;
if (LIMIT > 0) wanted = wanted.slice(0, LIMIT);
const have = await balance();

console.log(`\nwave ${WAVE}: ${wanted.length} to buy, ${skipped} already banked`);
console.log(`balance: ${have} generations   cost: ${wanted.length}   cap: ${MAX_GEN}\n`);
for (const j of wanted) console.log(`  ${j.as.padEnd(12)} ${j.template.padEnd(18)} ${j.dir}`);

if (wanted.length > MAX_GEN) {
  console.error(`\nrefusing: ${wanted.length} exceeds --max-gen ${MAX_GEN}`);
  process.exit(1);
}
if (wanted.length > have) {
  console.error(`\nrefusing: ${wanted.length} exceeds balance ${have}`);
  process.exit(1);
}
if (!COMMIT) {
  console.log('\ndry run — nothing bought. re-run with --commit');
  process.exit(0);
}

/**
 * Submitting all 14 at once trips PixelLab's free-tier throttle — the jobs come
 * back "failed: 429 ... temporarily limit free tier" (uncharged). So run a small
 * number in flight and retry a throttled job, which is free.
 */
const THROTTLED = /429|high demand|free tier|rate limit/i;
const CONCURRENCY = 2;

async function run(job, ledger) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      job.jobId = await submit(job);
      return await collect(job, ledger);
    } catch (e) {
      const msg = String(e.message || e);
      if (!THROTTLED.test(msg) || attempt === 4) throw e;
      const wait = 20_000 * attempt;
      console.log(`    ${job.as}: throttled, retrying in ${wait / 1000}s (attempt ${attempt}/3)`);
      await sleep(wait);
    }
  }
}

console.log('\nbuying (throttle-aware, 2 in flight):');
const failed = [];
const queue = [...wanted];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const j = queue.shift();
    try {
      const n = await run(j, ledger);
      console.log(`  ok   ${j.as.padEnd(12)} ${n} frames`);
    } catch (e) {
      console.log(`  FAIL ${j.as.padEnd(12)} ${String(e.message).slice(0, 170)}`);
      failed.push(j.as);
    }
  }
}));

const left = await balance();
console.log(`\nspent ${have - left} generations. ${left} remaining.`);
if (failed.length) console.log(`failed: ${failed.join(', ')}`);
