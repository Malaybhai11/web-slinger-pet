/**
 * QA screenshot harness — drives the DOM-aware hero in headless Chromium.
 *
 *   node qa/shoot.mjs
 *
 * Verifies: spawn standing on the H1, walking its top edge, jumping,
 * web-swinging from the nav (in range), release → land, out-of-range miss,
 * interaction classes, zero console errors. State polling keeps it
 * deterministic — no fixed-wait races.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.QA_URL || 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname;

await mkdir(OUT, { recursive: true });

// Let Playwright resolve its own browser (PLAYWRIGHT_BROWSERS_PATH); only
// override when CHROMIUM_PATH is set explicitly. The old hard-coded
// /usr/local/bin/chromium does not exist on most machines, including CI.
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const debug = () => page.evaluate(() => window.__hero?.debug() ?? null);
const fails = [];
const check = (name, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) fails.push(name);
};
const waitState = (fn, timeout = 3000) =>
  page
    .waitForFunction(fn, undefined, { timeout, polling: 50 })
    .then(() => true)
    .catch(() => false);

// This suite drives him by keyboard and asserts exact displacements, so the
// director has to be off — left on, he is already patrolling (or mid-jump) by
// the time the first sample is taken and every check races his own goals.
// Autonomy itself is covered by qa/poses.mjs.
//
// The switch is armed *before* the page runs, because he starts moving within
// a second of boot and there is no point disabling him after he has already
// left the title.
await page.addInitScript(() => {
  const arm = () => {
    if (window.__hero?.setAuto) window.__hero.setAuto(false);
    else requestAnimationFrame(arm);
  };
  arm();
});
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // atlas decode + first surface scan
await page.evaluate(() => { window.__hero.setAuto(false); window.__hero.reset(); });
await page.waitForTimeout(300);

// ---- 01 spawn: standing on the hero title ----
const spawn = await debug();
console.log('spawn:', JSON.stringify(spawn));
check('booted', !!spawn);
check('sprite atlas loaded', spawn?.sprites === 'atlas');
check('autonomy disabled for this suite', spawn?.aiEnabled === false);
check('spawns on H1 (real element)', spawn?.ground === 'H1');
check('30+ surfaces mapped', (spawn?.surfaces ?? 0) >= 30);
await page.screenshot({ path: `${OUT}/01-spawn.png` });

// ---- 02 walk along the title's top edge ----
await page.keyboard.down('d');
await page.waitForTimeout(900);
await page.keyboard.up('d');
await page.waitForTimeout(250);
const walk = await debug();
console.log('walk:', JSON.stringify(walk));
check('walked right along the title', walk.x > spawn.x + 60 && walk.ground === 'H1');
await page.screenshot({ path: `${OUT}/02-walk.png` });

// ---- 03 jump, then land back on a real element ----
await page.keyboard.press('Space');
const wentAir = await waitState(
  () => ['jumping', 'falling'].includes(window.__hero?.debug().state),
  1500,
);
await page.waitForTimeout(120);
console.log('mid-jump:', JSON.stringify(await debug()));
check('airborne after Space', wentAir);
await page.screenshot({ path: `${OUT}/03-jump.png` });
const relanded = await waitState(() => {
  const s = window.__hero?.debug();
  return s && s.ground !== null && !['jumping', 'falling'].includes(s.state);
});
console.log('relayed:', JSON.stringify(await debug()));
check('landed back on a real element', relanded);

// ---- 04 swing: moving right, web the nav (in range above) ----
await page.keyboard.down('d');
await page.waitForTimeout(350);
await page.mouse.click(720, 25);
await page.keyboard.up('d');
const swinging = await waitState(() => window.__hero?.debug().state === 'swinging', 2000);
console.log('swing:', JSON.stringify(await debug()));
check('swinging on a web', swinging);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/04-swing-a.png` });
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/05-swing-b.png` });

// ---- 05 release (if still swinging) → land on something real ----
const stillSwinging = await page.evaluate(() => window.__hero?.debug().state === 'swinging');
if (stillSwinging) await page.mouse.click(720, 25);
const groundedAgain = await waitState(() => {
  const s = window.__hero?.debug();
  return s && s.ground !== null && !['jumping', 'falling', 'swinging'].includes(s.state);
}, 4000);
const landed = await debug();
console.log('after release:', JSON.stringify(landed));
check('landed on a real element after swing', groundedAgain);
await page.screenshot({ path: `${OUT}/06-landed.png` });

// ---- 06 miss logic: out-of-range targets don't attach (PRD §4.5) ----
// Deterministic unit check — on this page <main> covers the viewport, so a
// raw click on "empty space" still hits a real element and rightly attaches.
const farMiss = await page.evaluate(() => window.__hero.testCast(720, 2600));
const nearHit = await page.evaluate(() => window.__hero.testCast(720, 25));
console.log('far cast attaches:', farMiss, '| near cast attaches:', nearHit);
check('out-of-range cast is a miss', farMiss === false);
check('in-range cast attaches', nearHit === true);

// settle him for the final frame: release if he's still on a web
const onWeb = await page.evaluate(() => window.__hero?.debug().state === 'swinging');
if (onWeb) await page.mouse.click(720, 25);
await waitState(() => {
  const s = window.__hero?.debug();
  return s && s.ground !== null && !['jumping', 'falling', 'swinging'].includes(s.state);
}, 4000);
await page.screenshot({ path: `${OUT}/07-final.png` });

// ---- 07 the page reacted: title got hero interaction classes on landing ----
const titleCls = await page.evaluate(() => document.getElementById('hero-title')?.className ?? '');
console.log('title classes:', titleCls || '(none)');
check('heading bounce/glow fired on land', /hero-(bounce|glow)/.test(titleCls));

console.log('fps:', (await debug())?.fps);
console.log('scrollY:', Math.round(await page.evaluate(() => window.scrollY)));

if (errors.length) {
  console.log('PAGE ERRORS:');
  for (const e of errors) console.log(' -', e);
}
if (fails.length || errors.length) {
  console.log('QA FAILED:', fails.join(', '));
  process.exitCode = 1;
} else {
  console.log('QA passed — all checks green, no console errors');
}

await browser.close();
console.log('screenshots written to qa/out/');
