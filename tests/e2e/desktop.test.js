// Klicktests am PC (Fenster 1440 × 900, Maus und Tastatur statt Touch). Ausführen: npm run test:e2e
// (feste Uhrzeit: Do., 15.10.2026, 12:00)

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, texts } from './helpers.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => {
  await browser.close();
  assert.deepEqual(browser.errors, [], 'keine Fehler in der Seite');
});

const HOUR_PX = 44;
const view = (app) => app.page.evaluate(() => location.hash.slice(1));
const key = async (app, k) => { await app.page.keyboard.press(k); await app.page.waitForTimeout(250); };

// Mit der Maus ziehen – ohne langes Drücken.
async function mouseDrag(app, locator, dx, dy) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(10, box.height / 2);
  await app.page.mouse.move(x, y);
  await app.page.mouse.down();
  await app.page.mouse.move(x + dx, y + dy, { steps: 12 });
  await app.page.mouse.up();
  await app.page.waitForTimeout(350);
}

describe('Layout am PC', () => {
  test('Navigation als Seitenleiste links; auf dem Handy unten', async () => {
    const pc = await browser.open('kalender', { desktop: true, data: () => {} });
    const nav = await pc.page.locator('.tabs').boundingBox();
    assert.deepEqual([nav.x, nav.y, nav.height], [0, 0, 900]);
    assert.ok(nav.width > 150 && nav.width < 300);
    assert.equal(await pc.page.locator('.tabs .brand').isVisible(), true);
    assert.equal(await pc.page.locator('#shortcut-hint').isVisible(), true);
    const main = await pc.page.locator('#view').boundingBox();
    assert.ok(main.x >= nav.width, 'Inhalt rechts neben der Leiste');
    await pc.close();

    const phone = await browser.open('kalender', { data: () => {} });
    const bottom = await phone.page.locator('.tabs').boundingBox();
    assert.ok(bottom.y > 700, 'auf dem Handy unten');
    assert.equal(await phone.page.locator('.tabs .brand').isVisible(), false);
    assert.equal(await phone.page.locator('#shortcut-hint').isVisible(), false);
    await phone.close();
  });

  test('„Jetzt“ in zwei Spalten: Aufgaben links, Wunschliste und Demnächst rechts', async () => {
    const app = await browser.open('jetzt', {
      desktop: true,
      data: (s) => { s.createTask({ title: 'Steuer', window_end: '2026-10-20' }); s.createWish({ title: 'Museum' }); },
    });
    const left = await app.page.locator('section.card.today').boundingBox();
    const right = await app.page.locator('section.card.wishes').boundingBox();
    assert.ok(right.x > left.x + left.width, 'Wunschliste rechts daneben');
    assert.ok(Math.abs(right.y - left.y) < 200, 'auf gleicher Höhe');
    await app.close();
  });

  test('Routinen als Kacheln nebeneinander', async () => {
    const app = await browser.open('routinen', {
      desktop: true,
      data: (s) => { for (const t of ['Morgen', 'Abend', 'Sport']) s.createTask({ title: t, kind: 'routine' }); },
    });
    const boxes = await Promise.all([0, 1].map((i) => app.page.locator('.card.routine').nth(i).boundingBox()));
    assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 2, 'in einer Reihe');
    await app.close();
  });
});

describe('Tastenkürzel', () => {
  test('1–5 wechseln den Bereich, ? zeigt die Übersicht, Esc schließt', async () => {
    const app = await browser.open('kalender', { desktop: true, data: () => {} });
    for (const [k, v] of [['2', 'jetzt'], ['3', 'aufgaben'], ['4', 'routinen'], ['5', 'mehr'], ['1', 'kalender']]) {
      await key(app, k);
      assert.equal(await view(app), v);
    }
    await key(app, '?');
    assert.equal(await app.page.locator('#dialog h2').textContent(), 'Tastenkürzel');
    await key(app, 'Escape');
    assert.equal(await app.page.locator('#dialog[open]').count(), 0);
    await app.page.click('#shortcut-hint');
    assert.equal(await app.page.locator('#dialog h2').textContent(), 'Tastenkürzel');
    await app.close();
  });

  test('N legt neu an – je nach Bereich Termin, Aufgabe oder Routine', async () => {
    const app = await browser.open('kalender', { desktop: true, data: () => {} });
    const titleAfterN = async (v) => {
      await app.go(v);
      await key(app, 'n');
      const title = await app.page.locator('#dialog h2').textContent();
      await key(app, 'Escape');
      return title;
    };
    assert.equal(await titleAfterN('kalender'), 'Neuer Termin');
    assert.equal(await titleAfterN('aufgaben'), 'Neue Aufgabe');
    assert.equal(await titleAfterN('routinen'), 'Neue Routine');
    await app.close();
  });

  test('Tippen in ein Feld löst keine Kürzel aus; im offenen Dialog auch nicht', async () => {
    const app = await browser.open('aufgaben', { desktop: true, data: () => {} });
    await key(app, 'n');
    await app.page.locator('#dialog input[name="title"]').click();
    await app.page.keyboard.type('Termin 2 nachfragen');
    assert.equal(await view(app), 'aufgaben');
    assert.equal(await app.page.locator('#dialog input[name="title"]').inputValue(), 'Termin 2 nachfragen');
    await app.close();
  });

  test('Kalender: ← → blättern, T springt zu heute', async () => {
    const app = await browser.open('kalender', { desktop: true, data: () => {} });
    const title = () => app.page.locator('.cal-title').textContent();
    assert.match(await title(), /Oktober 2026/);
    await key(app, 'ArrowRight');
    assert.match(await title(), /November 2026/);
    await key(app, 'ArrowLeft');
    await key(app, 'ArrowLeft');
    assert.match(await title(), /September 2026/);
    await key(app, 't');
    assert.match(await title(), /Oktober 2026/);
    await app.close();
  });
});

describe('Mit der Maus ziehen (ohne langes Drücken)', () => {
  test('Termin in der Woche eine Stunde später und einen Tag weiter ziehen', async () => {
    const app = await browser.open('kalender', {
      desktop: true,
      data: (s) => s.createEvent({ title: 'Zahnarzt', start_at: '2026-10-14T10:00', end_at: '2026-10-14T11:00' }),
    });
    await app.page.click('.segmented.modes button:has-text("Woche")');
    await app.page.waitForTimeout(250);
    await app.page.locator('.week-scroll').evaluate((n, top) => { n.scrollTop = top; }, 8 * HOUR_PX);
    const block = app.page.locator('.block:has-text("Zahnarzt")');
    const colWidth = (await app.page.locator('.day-col').first().boundingBox()).width;
    await mouseDrag(app, block, colWidth, HOUR_PX);
    const ev = await app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2026, 9, 31)).find((e) => e.title === 'Zahnarzt'));
    assert.deepEqual([ev.start_at, ev.end_at], ['2026-10-15 11:00', '2026-10-15 12:00']);
    assert.equal(await app.page.locator('#dialog[open]').count(), 0, 'Loslassen öffnet nicht den Editor');
    await app.close();
  });

  test('Klick ohne Ziehen öffnet den Termin', async () => {
    const app = await browser.open('kalender', {
      desktop: true,
      data: (s) => s.createEvent({ title: 'Zahnarzt', start_at: '2026-10-15T10:00', end_at: '2026-10-15T11:00' }),
    });
    await app.page.click('.segmented.modes button:has-text("Tag")');
    await app.page.waitForTimeout(250);
    await app.page.locator('.week-scroll').evaluate((n, top) => { n.scrollTop = top; }, 8 * HOUR_PX);
    await app.page.locator('.block:has-text("Zahnarzt")').click();
    await app.page.waitForTimeout(250);
    assert.equal(await app.page.locator('#dialog input[name="title"]').inputValue(), 'Zahnarzt');
    await app.close();
  });

  test('Aufgaben umsortieren und einrücken', async () => {
    const app = await browser.open('aufgaben', {
      desktop: true,
      data: (s) => { for (const t of ['A', 'B', 'C']) s.createTask({ title: `Aufgabe ${t}` }); },
    });
    const row = (t) => app.page.locator(`.task-row:has-text("Aufgabe ${t}")`).first();
    const h = (await row('A').boundingBox()).height + 8;
    await mouseDrag(app, row('C'), 0, -2.3 * h);
    const order = () => app.store((s) => {
      const walk = (id, d) => s.childrenOf(id).flatMap((t) => [`${'.'.repeat(d)}${t.title.slice(-1)}`, ...walk(t.id, d + 1)]);
      return walk(null, 0).join(' ');
    });
    assert.equal(await order(), 'C A B');
    await mouseDrag(app, row('B'), 90, 0);
    assert.equal(await order(), 'C A .B');
    assert.equal(await app.page.locator('#dialog[open]').count(), 0, 'Loslassen öffnet nicht den Editor');
    await row('C').locator('.task-title').click();
    await app.page.waitForTimeout(200);
    assert.equal(await app.page.locator('#dialog input[name="title"]').inputValue(), 'Aufgabe C', 'normaler Klick öffnet weiterhin');
    await app.close();
  });
});
