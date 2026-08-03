/**
 * QA screenshot harness — loads the page in headless Chromium via Playwright,
 * hovers a button to trigger the web shot, and captures frames.
 *
 *   node qa/shoot.mjs
 *
 * Writes PNGs into qa/out/.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.QA_URL || 'http://localhost:3000';
const OUT = new URL('./out/', import.meta.url).pathname;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/01-idle.png` });

// walk a moment
await page.mouse.move(720, 850);
await page.waitForTimeout(2600);
await page.screenshot({ path: `${OUT}/02-after-idle.png` });

// hover the primary button -> pet should aim & shoot
const btn = page.locator('.btn.primary');
const box = await btn.boundingBox();
if (!box) throw new Error('primary button not found');
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
await page.waitForTimeout(700); // aim phase
await page.screenshot({ path: `${OUT}/03-aim.png` });
await page.waitForTimeout(350); // web extending / impact
await page.screenshot({ path: `${OUT}/04-shoot.png` });

const webbed = await page.evaluate(() =>
  document.querySelector('.btn.primary')?.classList.contains('webbed') ?? false,
);
console.log('webbed class applied:', webbed);

// swing demo: click the "watch it swing" trigger, then move away and capture
const swingBtn = page.locator('.btn.ghost');
const sbox = await swingBtn.boundingBox();
if (!sbox) throw new Error('swing trigger not found');
await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2, { steps: 8 });
await page.mouse.click(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
await page.mouse.move(1300, 300, { steps: 6 }); // clear the hover so it can swing
await page.waitForTimeout(450);
await page.screenshot({ path: `${OUT}/05-swing-a.png` });
await page.waitForTimeout(550);
await page.screenshot({ path: `${OUT}/06-swing-b.png` });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/07-swing-c.png` });

const swingState = await page.evaluate(() => {
  const pet = window.__pet;
  return pet ? 'pet-alive' : 'pet-missing';
});
console.log('swing check:', swingState);

// pet state sanity
const state = await page.evaluate(() => {
  const pet = window.__pet;
  return pet ? 'pet-alive' : 'pet-missing';
});
console.log('pet handle:', state);

if (errors.length) {
  console.log('PAGE ERRORS:');
  for (const e of errors) console.log(' -', e);
  process.exitCode = 1;
} else {
  console.log('no page errors');
}

await browser.close();
console.log('screenshots written to qa/out/');
