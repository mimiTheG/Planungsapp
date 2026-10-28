// Klicktests: Routinen (eintägig/mehrtägig) und „Was mache ich jetzt?“. Ausführen: npm run test:e2e
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

describe('Mehrtägige Routinen', () => {
  // Testdaten laufen im Browser – sie dürfen nichts aus dieser Datei verwenden.
  const haushalt = (s) => {
    const m = s.createTask({ title: 'Haushalt', kind: 'routine', routine_type: 'multi' });
    const jobs = [['Müll', '2026-10-16'], ['Bett', '2026-10-17'], ['Pflanzen', '2026-10-15'], ['Bad', '2026-10-18'], ['Fenster', '2026-10-30']];
    for (const [title, day] of jobs) {
      s.createTask({ title, parent_id: m.id, recurrence: 'rhythm', window_start: day, buffer: 0, repeat: { freq: 'weekly', interval: 1 } });
    }
  };

  test('ab 5 Aufgaben eingeklappt (3 sichtbar), aufklappen und wieder einklappen', async () => {
    const app = await browser.open('routinen', { data: haushalt });
    const card = app.page.locator('.routine.multi:has-text("Haushalt")');
    assert.equal(await card.locator('.task-title').count(), 3);
    assert.equal((await card.locator('.more-steps').textContent()).trim(), '▾ 2 weitere Aufgaben anzeigen');
    await card.locator('.more-steps').click();
    await app.page.waitForTimeout(200);
    assert.deepEqual(await texts(card.locator('.task-title')), ['Müll', 'Bett', 'Pflanzen', 'Bad', 'Fenster']);
    assert.equal(await card.locator('ul.tree.sortable').count() > 0, true, 'aufgeklappt sortierbar');
    await card.locator('.more-steps').click();
    await app.page.waitForTimeout(200);
    assert.equal(await card.locator('.task-title').count(), 3);
    await app.close();
  });

  test('neue Aufgabe in der Routine ist gleich „Regelmäßig“; abhaken → nächster Durchgang', async () => {
    const app = await browser.open('routinen', { data: (s) => s.createTask({ title: 'Garten', kind: 'routine', routine_type: 'multi' }) });
    const { page } = app;
    const card = page.locator('.routine.multi:has-text("Garten")');
    await card.locator('button:has-text("+ Aufgabe")').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#dialog h2').textContent(), 'Neue Aufgabe');
    assert.equal(await page.isChecked('#dialog input[name="recurrence"][value="rhythm"]'), true);
    await page.fill('#dialog input[name="title"]', 'Rasen mähen');
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    await card.locator('.task-row:has-text("Rasen mähen") input[type=checkbox]').click();
    await page.waitForTimeout(250);
    const t = await app.store((s) => s.tasks().find((x) => x.title === 'Rasen mähen'));
    assert.deepEqual([t.recurrence, t.window_start, t.status], ['rhythm', '2026-10-22', 'upcoming']);
    await app.close();
  });

  test('mehrtägige Routinen lassen sich nicht als Termin einplanen', async () => {
    const app = await browser.open('kalender', {
      data: (s) => {
        s.createTask({ title: 'Haushalt', kind: 'routine', routine_type: 'multi' });
        s.createTask({ title: 'Morgen', kind: 'routine' });
      },
    });
    await app.page.locator('.month-cell:not(.other)').nth(14).click();
    await app.page.waitForTimeout(200);
    await app.page.click('.fab');
    await app.page.waitForTimeout(200);
    await app.page.click('#dialog .segmented.radio label:has-text("Routine")');
    const options = await texts(app.page.locator('#dialog select[name="routine_id"] option'));
    assert.deepEqual(options, ['— Routine wählen —', 'Morgen']);
    await app.close();
  });
});

describe('Eintägige Routine', () => {
  const morgen = (s) => {
    const r = s.createTask({ title: 'Morgen', kind: 'routine' });
    for (const step of ['Zähne', 'Duschen', 'Anziehen']) s.createTask({ title: step, parent_id: r.id });
  };

  test('starten, Schritte abhaken, Leiste zeigt Fortschritt, abbrechen setzt zurück', async () => {
    const app = await browser.open('routinen', { data: morgen });
    const { page } = app;
    await page.click('.routine:has-text("Morgen") button:has-text("Start")');
    await page.waitForTimeout(200);
    await page.locator('#dialog .checklist label:has-text("Zähne") input').check();
    await page.locator('#dialog .checklist label:has-text("Duschen") input').check();
    await page.click('#dialog button:has-text("Später weitermachen")');
    await page.waitForTimeout(250);
    assert.match(await page.locator('#player').textContent(), /Morgen.*2\/3 Schritte/s);
    await page.click('#player .player-cancel');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#player .player-main').count(), 0, 'Leiste weg');
    assert.deepEqual(await app.store((s) => s.tasks().filter((t) => t.parent_id).map((t) => t.status)), ['open', 'open', 'open']);
    await app.close();
  });

  test('abschließen: Routine im Verlauf, Schritte wieder offen', async () => {
    const app = await browser.open('routinen', { data: morgen });
    const { page } = app;
    await page.click('.routine:has-text("Morgen") button:has-text("Start")');
    await page.waitForTimeout(200);
    for (const step of ['Zähne', 'Duschen', 'Anziehen']) await page.locator(`#dialog .checklist label:has-text("${step}") input`).check();
    await page.click('#dialog button:has-text("Routine abschließen")');
    await page.waitForTimeout(250);
    assert.deepEqual(await app.store((s) => s.history().map((h) => h.task.title)), ['Morgen']);
    assert.deepEqual(await app.store((s) => s.tasks().filter((t) => t.parent_id).map((t) => t.status)), ['open', 'open', 'open']);
    await app.close();
  });
});

describe('Was mache ich jetzt?', () => {
  const wd = (w, d) => ({ importance: w, urgency: d });
  const section = (app, cls) => texts(app.page.locator(`section.${cls} .now-item .task-title`));

  test('Bereiche nach W×D sortiert (bei Gleichstand: länger überfällig bzw. weniger Zeit zuerst)', async () => {
    const app = await browser.open('jetzt', {
      data: (s) => {
        const t = (title, extra) => s.createTask({ title, ...extra });
        t('Ü lange W1D1', { window_end: '2026-10-01', importance: 1, urgency: 1 });
        t('Ü kurz W5D5', { window_end: '2026-10-14', importance: 5, urgency: 5 });
        t('Ü alt W2D2', { window_end: '2026-10-05', importance: 2, urgency: 2 });
        t('Ü neu W2D2', { window_end: '2026-10-12', importance: 2, urgency: 2 });
        t('H heute W2D2', { window_end: '2026-10-15', importance: 2, urgency: 2 });
        t('H 5 Tage W5D4', { window_end: '2026-10-20', importance: 5, urgency: 4 });
        t('H 2 Tage W2D2', { window_end: '2026-10-17', importance: 2, urgency: 2 });
        t('W niedrig', { importance: 1, urgency: 2 });
        t('W hoch', { importance: 4, urgency: 4 });
      },
    });
    assert.deepEqual(await section(app, 'alert'), ['Ü kurz W5D5', 'Ü alt W2D2', 'Ü neu W2D2', 'Ü lange W1D1']);
    assert.deepEqual(await section(app, 'today'), ['H 5 Tage W5D4', 'H heute W2D2', 'H 2 Tage W2D2']);
    const rest = await texts(app.page.locator('section.card:has(h3:text("Weitere Aufgaben")) .now-item .task-title'));
    assert.deepEqual(rest, ['W hoch', 'W niedrig']);
    await app.close();
  });

  test('Restzeit und Überfällig-Text', async () => {
    const app = await browser.open('jetzt', {
      data: (s) => {
        s.createTask({ title: 'in 3 Tagen', window_end: '2026-10-18' });
        s.createTask({ title: 'heute 18 Uhr', window_end: '2026-10-15', deadline_time: '18:00' });
        s.createTask({ title: 'seit 2 Wochen', window_end: '2026-09-30' });
      },
    });
    const meta = (title) => app.page.locator(`.now-item:has-text("${title}") .meta`).textContent();
    assert.match(await meta('in 3 Tagen'), /noch 3 Tage/);
    assert.match(await meta('heute 18 Uhr'), /noch 6 Std\./);
    assert.match(await meta('seit 2 Wochen'), /überfällig seit 2 Wochen/);
    await app.close();
  });

  test('Unteraufgaben direkt in „Jetzt“ abhaken', async () => {
    const app = await browser.open('jetzt', {
      data: (s) => { const p = s.createTask({ title: 'Fotobuch' }); s.createTask({ title: 'Fotos sortieren', parent_id: p.id }); },
    });
    await app.page.locator('.now-item:has-text("Fotobuch") .subtasks label:has-text("Fotos sortieren") input').check();
    await app.page.waitForTimeout(250);
    assert.equal(await app.store((s) => s.tasks().find((t) => t.title === 'Fotos sortieren').status), 'done');
    assert.match(await app.page.locator('.now-item:has-text("Fotobuch")').textContent(), /100 %/);
    await app.close();
  });

  test('Zufallsauswahl schlägt etwas vor und lässt es direkt erledigen', async () => {
    const app = await browser.open('jetzt', { data: (s) => s.createTask({ title: 'Einziges' }) });
    await app.page.click('button:has-text("Ich kann mich nicht entscheiden")');
    await app.page.waitForTimeout(200);
    assert.equal(await app.page.locator('#dialog .pick strong').textContent(), 'Einziges');
    await app.page.click('#dialog button:has-text("Erledigt")');
    await app.page.waitForTimeout(250);
    assert.equal(await app.store((s) => s.tasks()[0].status), 'done');
    await app.close();
  });

  test('Wunschliste: anlegen und „Gemacht“', async () => {
    const app = await browser.open('jetzt', { data: () => {} });
    const { page } = app;
    await page.click('section.wishes button:has-text("+ Hinzufügen")');
    await page.waitForTimeout(200);
    await page.fill('#dialog input[name="title"]', 'Museum');
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    await page.locator('section.wishes .now-item:has-text("Museum") button').last().click();
    await page.waitForTimeout(250);
    assert.equal(await app.store((s) => s.wishes()[0].last_done_at), '2026-10-15 12:00');
    await app.close();
  });
});

// Regel: eingeplant (geplante Zeit kommt noch) → nur als Termin bzw. unter „Eingeplant“; verstrichen und nicht
// abgehakt → wieder als Aufgabe, genau einmal.
describe('Eingeplante Aufgaben: als Termin statt als Aufgabe, nie doppelt', () => {
  const titleCount = async (app, title) => (await texts(app.page.locator('main .task-title, main .running-head strong')))
    .filter((t) => t === title).length;

  test('Jetzt: während der geplanten Zeit nur unter „Läuft gerade“, danach wieder unter „Heute fällig“', async () => {
    const data = (s) => {
      const t = s.createTask({ title: 'Bericht', window_end: '2026-10-15' });
      s.createEvent({ task_id: t.id, start_at: '2026-10-15T11:00', end_at: '2026-10-15T13:00' });
    };
    const during = await browser.open('jetzt', { data });
    assert.equal(await titleCount(during, 'Bericht'), 1);
    assert.equal(await during.page.locator('.running-now:has-text("Bericht")').count(), 1);
    assert.equal(await during.page.locator('section.today').count(), 0);
    await during.close();

    const after = await browser.open('jetzt', { data, now: '2026-10-15T14:00:00+02:00' });
    assert.equal(await titleCount(after, 'Bericht'), 1, 'nicht abgehakt → wieder da, genau einmal');
    assert.deepEqual(await texts(after.page.locator('section.today .now-item .task-title')), ['Bericht']);
    await after.close();
  });

  test('Jetzt: am Folgetag eingeplant → nicht unter „Heute fällig“, sondern unter „Eingeplant“ mit „📅 morgen 15:00“', async () => {
    const app = await browser.open('jetzt', {
      data: (s) => {
        const t = s.createTask({ title: 'Steuer', window_end: '2026-10-15' });
        s.createEvent({ task_id: t.id, start_at: '2026-10-16T15:00', end_at: '2026-10-16T16:00' });
      },
    });
    assert.equal(await titleCount(app, 'Steuer'), 1);
    assert.equal(await app.page.locator('section.today').count(), 0);
    assert.deepEqual(await texts(app.page.locator('section.planned .now-item .task-title')), ['Steuer']);
    assert.match(await app.page.locator('section.planned .badge.planned').textContent(), /📅 morgen 15:00/);
    await app.close();
  });

  test('Kalender: am Folgetag eingeplant → nur noch als Termin, nicht mehr als Aufgabe', async () => {
    const app = await browser.open('kalender', {
      data: (s) => {
        const t = s.createTask({ title: 'Bad', recurrence: 'rhythm', window_start: '2026-10-15', buffer: 0, repeat: { freq: 'weekly', interval: 1 } });
        s.createEvent({ task_id: t.id, start_at: '2026-10-16T10:00', end_at: '2026-10-16T11:00' });
      },
    });
    const cell = (d) => app.page.locator('.month-cell:not(.other)').nth(d - 1);
    assert.equal(await app.page.locator('.chip.recurring').count(), 0, 'keine Aufgabe mehr');
    assert.deepEqual(await texts(cell(16).locator('.chip')), ['Bad'], 'am 16. der Termin');
    await app.close();
  });

  test('Kalender: am Folgetag eingeplant, Zeit verstrichen, nicht abgehakt → wieder genau einmal als Aufgabe', async () => {
    const app = await browser.open('kalender', {
      now: '2026-10-16T12:00:00+02:00',
      data: (s) => {
        const t = s.createTask({ title: 'Bad', recurrence: 'rhythm', window_start: '2026-10-15', buffer: 0, on_missed: 'remind', repeat: { freq: 'weekly', interval: 1 } });
        s.createEvent({ task_id: t.id, start_at: '2026-10-16T10:00', end_at: '2026-10-16T11:00' });
      },
    });
    const cell = (d) => app.page.locator('.month-cell:not(.other)').nth(d - 1);
    assert.deepEqual(await texts(app.page.locator('.chip.recurring')), ['Bad'], 'genau einmal als Aufgabe');
    assert.deepEqual(await texts(cell(16).locator('.chip.recurring')), ['Bad'], 'heute (16.)');
    await app.close();
  });

  test('Kalender: eingeplant, Zeit verstrichen, seitdem nochmal fällig → nur 1× als Aufgabe', async () => {
    const app = await browser.open('kalender', {
      data: (s) => {
        const t = s.createTask({ title: 'Müll', recurrence: 'rhythm', window_start: '2026-10-08', buffer: 0, on_missed: 'remind', repeat: { freq: 'weekly', interval: 1 } });
        s.createEvent({ task_id: t.id, start_at: '2026-10-08T07:00', end_at: '2026-10-08T07:15' });
      },
    });
    assert.deepEqual(await texts(app.page.locator('.chip.recurring')), ['Müll'], 'genau einmal');
    assert.deepEqual(await texts(app.page.locator('.month-cell:not(.other)').nth(14).locator('.chip.recurring')), ['Müll'], 'heute');
    await app.close();
  });
});
