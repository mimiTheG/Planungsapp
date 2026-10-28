// Hilfen für die Klicktests im Browser (Playwright, Chromium): kleiner Webserver für die App,
// Handy-Ansicht (360 px, Touch, Deutsch, deutsche Zeit) und eine feste Uhrzeit, damit die Tests
// unabhängig vom heutigen Datum immer gleich laufen.
// Ausführen: npm run test:e2e  (einmalig vorher: npm install && npx playwright install chromium)

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

// Feste „Jetzt“-Zeit der Tests: Do., 15.10.2026, 12:00 (deutsche Zeit).
export const NOW = '2026-10-15T12:00:00+02:00';

function startServer() {
  const server = http.createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path || 'index.html'));
      res.writeHead(200, { 'content-type': TYPES[extname(path || 'index.html')] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Startet Server und Browser. Rückgabe: { open, close }.
//   open(hash, { data }) öffnet eine frische App-Seite. data(s) läuft vorher mit dem Store (z. B. Aufgaben anlegen);
//   ohne data gibt es die Beispieldaten.
export async function launch() {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];

  // supabase: nachgebauter Server (tests/support/fake-supabase.js) – Anfragen an SUPABASE_URL landen dort.
  // desktop: PC-Fenster (1440 × 900, Maus statt Touch) statt Handy.
  async function open(hash = '', { data, now = NOW, supabase, desktop = false } = {}) {
    const device = desktop
      ? { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }
      : { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true };
    const context = await browser.newContext({
      ...device, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block',
    });
    await context.clock.setFixedTime(new Date(now));
    if (supabase) await routeSupabase(context, supabase);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept()); // Rückfragen wie „Wirklich löschen?“ bestätigen
    await page.goto(base);
    await page.waitForSelector('main');
    if (data) {
      await store(page, `(s) => { s.clearAll(); (${data})(s); }`);
    }
    await page.goto(`${base}#${hash}`);
    await page.reload();
    await page.waitForSelector('main');
    await page.waitForTimeout(150);
    return {
      page,
      context,
      cdp: await context.newCDPSession(page),
      store: (fn, arg) => store(page, fn, arg),
      go: async (h) => { await page.goto(`${base}#${h}`); await page.waitForTimeout(200); },
      close: () => context.close(),
    };
  }

  async function close() {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  return { open, close, errors };
}

export const SUPABASE_URL = 'https://test-projekt.supabase.co';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, authorization, content-type, prefer',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

async function routeSupabase(context, server) {
  await context.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const { status, body } = server.handle({
      method: request.method(), url: request.url(), headers: request.headers(), body: request.postData(),
    });
    await route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: body === null ? '' : JSON.stringify(body) });
  });
}

// Funktion mit dem Store der Seite ausführen: store(page, (s, arg) => s.tasks().length).
function store(page, fn, arg) {
  return page.evaluate(async ([src, a]) => {
    const s = await import('/js/store.js');
    // eslint-disable-next-line no-new-func
    return new Function('s', 'a', `return (${src})(s, a)`)(s, a);
  }, [String(fn), arg]);
}

// Lang drücken und ziehen (Touch), wie mit dem Finger.
export async function longPressDrag(app, locator, dx, dy, { steps = 10 } = {}) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(12, box.height / 2);
  const touch = (type, xx, yy) => app.cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: xx, y: yy }],
  });
  await touch('touchStart', x, y);
  await app.page.waitForTimeout(600);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', x + (dx * i) / steps, y + (dy * i) / steps);
    await app.page.waitForTimeout(25);
  }
  await touch('touchEnd');
  await app.page.waitForTimeout(350);
}

// Kurzes Wischen (ohne langes Drücken).
export async function swipe(app, locator, dx) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + 40;
  const touch = (type, xx, yy) => app.cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: xx, y: yy }],
  });
  await touch('touchStart', x, y);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', x + (dx * i) / 8, y);
    await app.page.waitForTimeout(16);
  }
  await touch('touchEnd');
  await app.page.waitForTimeout(400);
}

export const texts = async (locator) => (await locator.allTextContents()).map((t) => t.trim());
