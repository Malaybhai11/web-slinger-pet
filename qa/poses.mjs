/**
 * poses.mjs — visual review harness.
 *
 * Forces the hero into every state in turn and takes a tight crop around him,
 * plus a strip of the live autonomous behaviour. This is the thing to look at
 * when judging whether he reads as a character; qa/shoot.mjs judges whether the
 * engine is correct.
 *
 *   node qa/poses.mjs           # writes qa/out/pose-*.png
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.QA_URL || 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname;
const CROP = { w: 260, h: 220 };

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2, // review at 2x so pixel edges are visible
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const debug = () => page.evaluate(() => window.__hero.debug());

/** Crop tightly around the hero's current viewport position. */
async function shotHero(name) {
  const d = await debug();
  const y = d.y - (await page.evaluate(() => window.scrollY));
  const clip = {
    x: Math.max(0, Math.min(1280 - CROP.w, d.x - CROP.w / 2)),
    y: Math.max(0, Math.min(800 - CROP.h, y - CROP.h + 40)),
    width: CROP.w,
    height: CROP.h,
  };
  await page.screenshot({ path: `${OUT}/pose-${name}.png`, clip });
  return d;
}

const STATES = [
  'idle', 'walking', 'running', 'jumping', 'falling', 'landing',
  'crouching', 'swinging', 'clinging', 'stretching', 'sitting',
  'taunting', 'pressing', 'faceplanting', 'recovering', 'skidding', 'alerting',
  'sipping', 'boxing', 'mimicking',
];

console.log('forcing each state:');
for (const s of STATES) {
  await page.evaluate((st) => window.__hero.force(st), s);
  await page.waitForTimeout(200);   // let a couple of animation frames play
  const d = await shotHero(s);
  console.log(`  ${s.padEnd(14)} clip=${String(d.clip).padEnd(12)} dir=${String(d.dir).padEnd(11)} frame=${d.frame}`);
}

// the bubble, at its widest
await page.evaluate(() => window.__hero.talk('nobody is clicking this, chief'));
await page.waitForTimeout(260);
await page.screenshot({
  path: `${OUT}/pose-bubble.png`,
  clip: { x: 300, y: 60, width: 700, height: 300 },
});
console.log('  bubble');

// ---- autonomy: watch him with no input at all ----
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Behaviour sampling and frame timing are measured separately on purpose.
// `page.screenshot()` stalls the compositor for tens of milliseconds, so
// sampling fps while also taking screenshots measures the harness, not the
// hero — an earlier version of this file reported a 48fps "regression" that
// was entirely its own screenshots.
const seenGoals = new Set();
const seenStates = new Set();
const seenGround = new Set();
const seenClips = new Set();

for (let i = 0; i < 90; i++) {
  const d = await debug();
  if (d.goal) seenGoals.add(d.goal);
  seenStates.add(d.state);
  seenClips.add(d.clip);
  if (d.ground) seenGround.add(d.ground);
  if (i % 22 === 0) {
    await page.screenshot({ path: `${OUT}/auto-${String(i).padStart(2, '0')}.png` });
  }
  await page.waitForTimeout(330);
}

console.log('\nautonomous 30s, no input:');
console.log('  goals   :', [...seenGoals].join(', ') || '(none)');
console.log('  states  :', [...seenStates].join(', '));
console.log('  clips   :', [...seenClips].join(', '));
console.log('  surfaces:', [...seenGround].join(', '));

// clean frame-time sample: in-page rAF deltas, nothing else touching the tab
const timing = await page.evaluate(() => new Promise((resolve) => {
  const d = [];
  const start = performance.now();
  let last = start;
  const tick = (t) => {
    d.push(t - last);
    last = t;
    if (t - start < 8000) requestAnimationFrame(tick);
    else {
      d.sort((a, b) => a - b);
      resolve({
        frames: d.length,
        median: +d[Math.floor(d.length * 0.5)].toFixed(2),
        p99: +d[Math.floor(d.length * 0.99)].toFixed(2),
        over33: d.filter((x) => x > 33).length,
        degraded: window.__hero.debug().degraded,
      });
    }
  };
  requestAnimationFrame(tick);
}));
console.log('  timing  :', JSON.stringify(timing));

const fails = [];
if (seenGoals.size < 3) fails.push(`only ${seenGoals.size} distinct goals`);
if (seenStates.size < 4) fails.push(`only ${seenStates.size} distinct states`);
if (seenClips.size < 4) fails.push(`only ${seenClips.size} distinct clips`);
if (timing.p99 > 20) fails.push(`p99 frame time ${timing.p99}ms (>20)`);
if (timing.degraded) fails.push('fps watchdog degraded the renderer');
if (errors.length) fails.push(`${errors.length} console errors`);

for (const e of errors) console.log('  error:', e);
console.log(fails.length ? `\nFAILED: ${fails.join('; ')}` : '\npasses');
process.exitCode = fails.length ? 1 : 0;

await browser.close();
