import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
const exe = await chromium.executablePath();
const browser = await puppeteer.launch({
  headless: true, executablePath: exe,
  args: [...chromium.args, '--allow-file-access-from-files', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 854, height: 480 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });
await page.goto('file:///home/user/pixel-auth/game/index.html', { waitUntil: 'load', timeout: 60000 });
await new Promise(r => setTimeout(r, 5000));
const st = await page.evaluate(() => ({
  booted: window.__ironlineBooted,
  hasGame: !!window.game,
  menu: document.getElementById('scr-menu')?.className,
  booterr: document.getElementById('booterr')?.textContent || null,
  webgl: (() => { try { return !!(document.createElement('canvas').getContext('webgl2')); } catch (e) { return false; } })(),
}));
console.log('FILE:// STATE:', JSON.stringify(st, null, 1));
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await page.screenshot({ path: 'shots/file-file-protocol.png' });
await browser.close();
