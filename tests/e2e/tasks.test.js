// Klicktests: Aufgaben anlegen, bearbeiten, erledigen, Steigerungen, Umsortieren. Ausführen: npm run test:e2e

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, longPressDrag, texts } from './helpers.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => {
  await browser.close();
  assert.deepEqual(browser.errors, [], 'keine Fehler in der Seite');
});

const editor = (app) => app.page.locator('#dialog');
const save = async (app) => { await app.page.click('#dialog button[type=submit]'); await app.page.waitForTimeout(250); };
const openTask = async (app, title) => {
  await app.page.click(`.task-row:has-text("${title}") .task-title`);
  await app.page.waitForTimeout(200);
};
const newTask = async (app, title) => {
  await app.page.click('button:has-text("+ Neu")');
  await app.page.waitForTimeout(200);
  await app.page.fill('#dialog input[name="title"]', title);
};
const stored = (app, title) => app.store((s, t) => s.tasks().find((x) => x.title === t), title);

describe('Einmalige Aufgabe', () => {
  test('mit Ab, Deadline und Uhrzeit anlegen, dann mit × alles wieder leeren', async () => {
    const app = await browser.open('aufgaben', { data: () => {} });
    const { page } = app;
    await newTask(app, 'Steuer');
    const clear = (name) => page.locator(`#dialog .clearable:has(input[name="${name}"]) .clear-field`);
    assert.equal(await clear('window_end').isVisible(), false, '× nur mit Datum');
    await page.fill('#dialog input[name="window_start"]', '2026-10-20');
    await page.fill('#dialog input[name="window_end"]', '2026-10-31');
    await page.fill('#dialog input[name="deadline_time"]', '18:00');
    await save(app);
    let t = await stored(app, 'Steuer');
    assert.deepEqual([t.window_start, t.window_end, t.deadline_time, t.status], ['2026-10-20', '2026-10-31', '18:00', 'upcoming']);

    await openTask(app, 'Steuer');
    for (const name of ['window_start', 'window_end', 'deadline_time']) await clear(name).click();
    assert.equal(await page.locator('#dialog[open]').count(), 1, 'Dialog bleibt offen');
    await save(app);
    t = await stored(app, 'Steuer');
    assert.deepEqual([t.window_start, t.window_end, t.deadline_time, t.status], [null, null, null, 'open']);
    await app.close();
  });

  test('Titel fehlt → Hinweis, nichts gespeichert', async () => {
    const app = await browser.open('aufgaben', { data: () => {} });
    await newTask(app, '   ');
    await save(app);
    assert.equal(await app.store((s) => s.tasks().length), 0);
    await app.close();
  });

  test('Oberaufgabe abhaken hakt Unteraufgaben mit ab; wieder öffnen über „Erledigt“', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => { const p = s.createTask({ title: 'Umzug' }); s.createTask({ title: 'Kartons', parent_id: p.id }); },
    });
    const { page } = app;
    await page.locator('.task-row:has-text("Umzug") input[type=checkbox]').first().click();
    await page.waitForTimeout(250);
    assert.deepEqual(await app.store((s) => s.tasks().map((t) => t.status)), ['done', 'done']);
    await page.click('.segmented button:has-text("Erledigt")');
    await page.waitForTimeout(200);
    await page.locator('li.history').filter({ has: page.locator('.task-title', { hasText: /^Umzug$/ }) })
      .locator('button[aria-label="Wieder öffnen"]').click();
    await page.waitForTimeout(250);
    assert.deepEqual(await app.store((s) => s.tasks().map((t) => t.status)), ['open', 'open']);
    await app.close();
  });
});

describe('Regelmäßige Aufgabe', () => {
  test('keine Vorschlagsliste, direkt „Alle … Wochen“ mit Wochentagen', async () => {
    const app = await browser.open('aufgaben', { data: () => {} });
    const { page } = app;
    await newTask(app, 'Bad');
    await page.click('#dialog label:has-text("Regelmäßig")');
    assert.equal(await page.locator('#dialog select[aria-label="Wiederholen"]').count(), 0);
    assert.equal(await page.locator('#dialog .repeat-every').isVisible(), true);
    assert.equal(await page.locator('#dialog select[aria-label="Einheit"]').inputValue(), 'weekly');
    assert.equal(await page.locator('#dialog .weekday-picker').count(), 1);
    assert.equal(await page.locator('#dialog .repeat-end').count(), 0, 'kein „Endet“');
    await page.fill('#dialog input[aria-label="Intervall"]', '2');
    await save(app);
    const t = await stored(app, 'Bad');
    assert.deepEqual([t.recurrence, t.repeat.freq, t.repeat.interval, t.repeat.weekdays], ['rhythm', 'weekly', 2, [4]]);
    await app.close();
  });

  test('„ab dem Erledigen“: ohne Wochentag/Monatsdatum; alle 4 Wochen bleibt beim Bearbeiten erhalten', async () => {
    const app = await browser.open('aufgaben', { data: () => {} });
    const { page } = app;
    await newTask(app, 'Friseur');
    await page.click('#dialog label:has-text("Regelmäßig")');
    await page.check('#dialog input[name="repeat_from_done"]');
    assert.equal(await page.locator('#dialog .weekday-picker').count(), 0);
    await page.selectOption('#dialog select[aria-label="Einheit"]', 'monthly');
    assert.equal(await page.locator('#dialog select[aria-label="Monatlich am"]').count(), 0);
    await page.selectOption('#dialog select[aria-label="Einheit"]', 'weekly');
    await page.fill('#dialog input[aria-label="Intervall"]', '4');
    await page.fill('#dialog input[name="buffer"]', '1');
    await save(app);
    const t = await stored(app, 'Friseur');
    assert.deepEqual([t.repeat.freq, t.repeat.interval, t.repeat_from_done, t.buffer], ['weekly', 4, true, 1]);

    await openTask(app, 'Friseur');
    assert.equal(await page.locator('#dialog input[aria-label="Intervall"]').inputValue(), '4');
    assert.equal(await page.locator('#dialog .weekday-picker').count(), 0);
    await page.uncheck('#dialog input[name="repeat_from_done"]');
    assert.equal(await page.locator('#dialog .weekday-picker').count(), 1, 'ohne Häkchen wieder mit Wochentagen');
    await app.close();
  });

  test('regelmäßig → einmalig: keine Reste der Wiederholung', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => s.createTask({ title: 'Gießen', recurrence: 'rhythm', window_start: '2026-10-20', buffer: 1, repeat: { freq: 'weekly', interval: 1 } }),
    });
    await openTask(app, 'Gießen');
    await app.page.click('#dialog label:has-text("Einmalig")');
    await save(app);
    const t = await stored(app, 'Gießen');
    assert.deepEqual([t.recurrence, t.repeat, t.buffer, t.window_start, t.window_end], ['once', null, null, null, null]);
    await app.close();
  });

  test('abhaken springt in den nächsten Durchgang', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => s.createTask({ title: 'Müll', recurrence: 'rhythm', window_start: '2026-10-15', buffer: 0, repeat: { freq: 'weekly', interval: 1 } }),
    });
    await app.page.locator('.task-row:has-text("Müll") input[type=checkbox]').click();
    await app.page.waitForTimeout(250);
    const t = await stored(app, 'Müll');
    assert.deepEqual([t.window_start, t.status], ['2026-10-22', 'upcoming']);
    assert.match(await app.page.locator('#toast').textContent(), /erledigt – wieder fällig ab/);
    await app.close();
  });
});

describe('Steigerungen', () => {
  test('im Editor anlegen; diesmal dran → überall „einkaufen + Pfand wegbringen“; abhaken → wieder normal', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => s.createTask({ title: 'einkaufen', recurrence: 'rhythm', window_start: '2026-10-15', buffer: 0, repeat: { freq: 'weekly', interval: 1 } }),
    });
    const { page } = app;
    await openTask(app, 'einkaufen');
    await page.click('#dialog button:has-text("+ Steigerung")');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#dialog h2').textContent(), 'Neue Steigerung');
    await page.fill('#dialog input[name="title"]', 'Pfand wegbringen');
    await page.fill('#dialog input[name="upgrade_every"]', '3');
    await page.fill('#dialog input[name="upgrade_in"]', '1');
    await save(app);
    assert.equal(await page.locator('#dialog input[name="title"]').inputValue(), 'einkaufen', 'zurück im Aufgaben-Editor');
    assert.deepEqual(await texts(page.locator('#dialog .upgrade-list li')), ['⬆ Pfand wegbringen – jedes 3. Mal · diesmal dran']);
    await save(app);
    assert.equal((await stored(app, 'einkaufen')).title, 'einkaufen', 'Titel der Aufgabe bleibt');
    assert.deepEqual(await texts(page.locator('.task-row .task-title')), ['einkaufen + Pfand wegbringen']);

    await app.go('jetzt');
    await page.locator('.now-item:has-text("Pfand wegbringen") .done-btn').click();
    await page.waitForTimeout(250);
    assert.equal(await app.store((s) => s.shownTitle(s.tasks()[0])), 'einkaufen');
    assert.equal(await app.store((s) => s.shownTitle(s.history()[0].task)), 'einkaufen + Pfand wegbringen');
    await app.close();
  });

  test('Steigerung bearbeiten und löschen', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => {
        const t = s.createTask({ title: 'saugen', recurrence: 'rhythm', window_start: '2026-10-15', buffer: 0, repeat: { freq: 'weekly', interval: 1 } });
        s.createUpgrade({ upgrade_of: t.id, title: 'gründlich', upgrade_every: 4 });
      },
    });
    const { page } = app;
    await openTask(app, 'saugen');
    await page.click('#dialog .upgrade-list button:has-text("gründlich")');
    await page.waitForTimeout(200);
    await page.fill('#dialog input[name="upgrade_every"]', '2');
    await save(app);
    // „dran in“ war 4 – höchstens n, also jetzt 2 = nächstes Mal
    assert.deepEqual(await texts(page.locator('#dialog .upgrade-list li')), ['⬆ gründlich – jedes 2. Mal · nächstes Mal dran']);
    await page.click('#dialog .upgrade-list button:has-text("gründlich")');
    await page.waitForTimeout(200);
    await page.click('#dialog button.danger:has-text("Löschen")');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#dialog .upgrade-list li').count(), 0);
    assert.equal(await app.store((s) => s.tasks().length), 1, 'Aufgabe bleibt');
    await app.close();
  });
});

describe('Umsortieren per langem Drücken', () => {
  test('hoch/runter ändert die Reihenfolge, rechts/links die Ebene; bleibt nach Neuladen', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => { for (const t of ['A', 'B', 'C', 'D']) s.createTask({ title: `Aufgabe ${t}` }); },
    });
    const { page } = app;
    const tree = () => app.store((s) => {
      const walk = (id, d) => s.childrenOf(id).flatMap((t) => [`${'.'.repeat(d)}${t.title.slice(-1)}`, ...walk(t.id, d + 1)]);
      return walk(null, 0).join(' ');
    });
    const row = (t) => page.locator(`.task-row:has-text("Aufgabe ${t}")`).first();
    const h = (await row('A').boundingBox()).height + 8;
    await longPressDrag(app, row('D'), 0, -3.3 * h);
    assert.equal(await tree(), 'D A B C');
    await longPressDrag(app, row('B'), 90, 0);
    assert.equal(await tree(), 'D A .B C');
    await longPressDrag(app, row('B'), -90, 0);
    assert.equal(await tree(), 'D A B C');
    await longPressDrag(app, row('A'), -90, 0);
    assert.equal(await tree(), 'D A B C', 'oberste Ebene nach links: nichts passiert');
    await page.reload();
    await page.waitForTimeout(250);
    assert.deepEqual((await texts(page.locator('ul.tree > li > .task-row .task-title'))).map((t) => t.slice(-1)), ['D', 'A', 'B', 'C']);
    await app.close();
  });
});
