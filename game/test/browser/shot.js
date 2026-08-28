// ============================================================
// Browser visual test: boots the real game in headless Chromium
// (SwiftShader WebGL), drives it with keyboard, captures
// screenshots + console/page errors + WebGL health.
// NOTE: software rendering is slow, so the sim can lag real
// time — all waits POLL game state instead of fixed sleeps.
// Run: node test/browser/shot.js  (dev server on :8080)
// ============================================================
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';

const GAME_URL = process.env.GAME_URL || 'http://127.0.0.1:8080';
const SHOTS = fileURLToPath(new NodeURL('../../shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });

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
const waitFor = (fn, what, timeout = 60000) =>
  page.waitForFunction(fn, { timeout, polling: 200 }).then(() => console.log('ok:', what));

await page.goto(GAME_URL, { waitUntil: 'networkidle0', timeout: 90000 });
await wait(2000);

// 1. menu
const menuVisible = await page.$eval('#scr-menu', (el) => el.classList.contains('on'));
console.log('menu visible:', menuVisible);
await shot('01-menu.png');

// 2. start match
await page.click('#m-play');
await waitFor(() => window.game?.match && ['lobby', 'active'].includes(window.game.match.state), 'match started');
await wait(800);
await shot('02-lobby.png');
await waitFor(() => window.game?.match?.state === 'active', 'round 1 active');
const state1 = await page.evaluate(() => ({
  state: window.game?.match?.state,
  webgl: (() => { try { const c = document.createElement('canvas'); return !!c.getContext('webgl2') || !!c.getContext('webgl'); } catch (e) { return false; } })(),
  entities: window.game?.match?.entities?.().length,
}));
console.log('after start:', JSON.stringify(state1));
await shot('03-round-active.png');

// 3. move + fire (poll ammo)
await page.keyboard.down('w');
await wait(700);
await page.keyboard.down('f');
await waitFor(() => (window.game?.weapons?.ammoState?.mag ?? 30) < 25, 'AK fired (>4 shots)');
await page.keyboard.up('f');
await page.keyboard.up('w');
console.log('ammo after firing:', await page.evaluate(() => window.game?.weapons?.ammoState?.mag));
await shot('04-firing.png');

// 4. ADS
await page.keyboard.down('e');
await waitFor(() => (window.game?.camera?.fov ?? 72) < 55, 'ADS fov engaged');
console.log('fov during ADS:', await page.evaluate(() => window.game?.camera?.fov?.toFixed?.(1)));
await shot('05-ads.png');
await page.keyboard.up('e');
await waitFor(() => (window.game?.camera?.fov ?? 50) > 66, 'fov returned to hip');

// 5. jump + slide
await page.keyboard.down('w');
await wait(600);
await page.keyboard.down(' ');
await waitFor(() => window.game?.player?.airborne === true, 'airborne');
await waitFor(() => window.game?.player?.grounded === true, 'landed');
await page.keyboard.down('c'); // crouch/slide while moving
await wait(250);
await shot('06-slide.png');
await page.keyboard.up('c');
await wait(1000);

// 6. swap weapon
await page.keyboard.down('q'); await page.keyboard.up('q');
await waitFor(() => window.game?.weapons?.current === 'pistol', 'swapped to pistol');
await shot('07-pistol.png');

// 7. pause
await page.keyboard.down('p'); await page.keyboard.up('p');
await waitFor(() => window.game?.paused === true, 'paused');
await shot('08-pause.png');
await page.keyboard.down('p'); await page.keyboard.up('p');
await waitFor(() => window.game?.paused === false, 'resumed');

// 8. quit to menu
await page.keyboard.down('p'); await page.keyboard.up('p');
await waitFor(() => window.game?.paused === true, 'paused 2');
await page.click('#p-quit');
await waitFor(() => document.getElementById('scr-menu')?.classList.contains('on'), 'back to menu');
await shot('09-menu-again.png');

// 9. settings tabs (re-query each time — tabs are re-rendered)
await page.click('#m-settings');
await waitFor(() => document.getElementById('scr-settings')?.classList.contains('on'), 'settings open');
await shot('10-settings-controls.png');
const tabCount = await page.$$eval('#set-tabs .tab', (ts) => ts.length);
for (let i = 2; i <= tabCount; i++) {
  await page.click(`#set-tabs .tab:nth-child(${i})`);
  await wait(300);
  const label = await page.$eval(`#set-tabs .tab:nth-child(${i})`, (el) => el.textContent);
  await shot(`11-settings-${label.toLowerCase().replace(/\s+/g, '-')}.png`);
}
await page.click('#set-back');
await waitFor(() => document.getElementById('scr-menu')?.classList.contains('on'), 'menu after settings');

// 10. HUD editor
await page.click('#m-hudedit');
await wait(600);
await shot('12-hud-editor.png');
await page.click('.tbtn[data-btn="fire"]'); // select a control → toolbar shows
await wait(300);
await shot('12b-hud-editor-selected.png');
await page.click('#he-done');
await wait(300);

// 11. new match + combat screenshot
await page.click('#m-play');
await waitFor(() => window.game?.match?.state === 'active', 'new match active');
await wait(8000);
await shot('13-combat.png');

console.log('\n--- errors ---');
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.filter((e) => !e.includes('favicon')).length ? 1 : 0);
