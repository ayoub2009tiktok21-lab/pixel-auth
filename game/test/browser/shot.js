// ============================================================
// Browser visual test: boots the real game in headless Chromium
// (SwiftShader WebGL), drives it with keyboard, captures
// screenshots + console/page errors + WebGL health.
// Run: node test/browser/shot.js  (dev server must be on :8080)
// ============================================================
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';

const GAME_URL = process.env.GAME_URL || 'http://127.0.0.1:8080';
const SHOTS = fileURLToPath(new NodeURL('../../shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

// @sparticuz/chromium bundles a headless Chrome build
let chromium;
try { chromium = (await import('@sparticuz/chromium')).default; }
catch (e) { console.error('sparticuz chromium not available:', e.message); process.exit(2); }

const exePath = await chromium.executablePath();
console.log('chromium:', exePath);
const browser = await puppeteer.launch({
  headless: true,
  executablePath: exePath,
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 854, height: 480, isMobile: false, hasTouch: true },
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

const shot = async (name) => {
  await page.screenshot({ path: SHOTS + name });
  console.log('shot:', name);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(GAME_URL, { waitUntil: 'networkidle0', timeout: 60000 });
await wait(2500);

// 1. menu
const menuVisible = await page.$eval('#scr-menu', (el) => el.classList.contains('on'));
console.log('menu visible:', menuVisible);
await shot('01-menu.png');

// 2. start match (click Deploy)
await page.click('#m-play');
await wait(1500);
await shot('02-lobby.png');
await wait(3500); // lobby 2.6s + round start
const state1 = await page.evaluate(() => ({
  state: window.game?.match?.state,
  active: !!window.game?.matchActive,
  fps: Math.round(window.game?.perf?.avg || 0),
  webgl: (() => { try { const c = document.createElement('canvas'); return !!c.getContext('webgl2') || !!c.getContext('webgl'); } catch (e) { return false; } })(),
  entities: window.game?.match?.entities?.().length,
}));
console.log('after start:', JSON.stringify(state1));
await shot('03-round-active.png');

// 3. move forward + fire
await page.keyboard.down('w');
await wait(600);
await page.keyboard.down('f');
await wait(1800);
await page.keyboard.up('f');
await page.keyboard.up('w');
const ammoAfter = await page.evaluate(() => window.game?.weapons?.ammoState?.mag);
console.log('ammo after firing (expect < 30):', ammoAfter);
await shot('04-firing.png');

// 4. ADS
await page.keyboard.down('e');
await wait(1200);
const fovAds = await page.evaluate(() => window.game?.camera?.fov);
await page.keyboard.up('e');
console.log('fov during ADS (expect ~50):', fovAds);
await shot('05-ads.png');

// 5. jump + slide
await page.keyboard.down('w');
await wait(500);
await page.keyboard.down(' ');
await wait(900);
await page.keyboard.up('w');
await page.keyboard.down('c'); // crouch/slide while moving
await wait(300);
await shot('06-slide.png');
await page.keyboard.up('c');
await wait(1200);

// 6. swap weapon + reload
await page.keyboard.down('q'); await page.keyboard.up('q');
await wait(800);
const w2 = await page.evaluate(() => window.game?.weapons?.current);
console.log('weapon after swap:', w2);
await shot('07-pistol.png');

// 7. pause menu
await page.keyboard.down('p'); await page.keyboard.up('p');
await wait(400);
const paused = await page.evaluate(() => window.game?.paused);
console.log('paused:', paused);
await shot('08-pause.png');
await page.keyboard.down('p'); await page.keyboard.up('p');
await wait(400);

// 8. back to menu via quit
await page.keyboard.down('p'); await page.keyboard.up('p');
await wait(300);
await page.click('#p-quit');
await wait(600);
await shot('09-menu-again.png');

// 9. settings screens
await page.click('#m-settings');
await wait(400);
await shot('10-settings-controls.png');
const tabs = await page.$$('#set-tabs .tab');
for (const t of tabs) {
  const label = await t.evaluate((el) => el.textContent);
  await t.click();
  await wait(250);
  await shot(`11-settings-${label.toLowerCase().replace(/\s+/g, '-')}.png`);
}
// back to menu
await page.click('#set-back');
await wait(300);

// 10. HUD editor
await page.click('#m-hudedit');
await wait(500);
await shot('12-hud-editor.png');
await page.click('#he-done');
await wait(300);

// 11. let the match run a while for AI combat visuals, then final shot
await page.click('#m-play');
await wait(5000);
await shot('13-combat.png');

console.log('\n--- errors ---');
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.filter((e) => !e.includes('favicon')).length ? 1 : 0);
