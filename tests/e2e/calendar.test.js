// Klicktests: Kalender – Ansichten, Ein-/Ausblenden, Termine ziehen, Serien, Geburtstage, Aufgaben einplanen.
// Ausführen: npm run test:e2e   (feste Uhrzeit: Do., 15.10.2026, 12:00)

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, longPressDrag, swipe, texts } from './helpers.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => {
  await browser.close();
  assert.deepEqual(browser.errors, [], 'keine Fehler in der Seite');
});

const HOUR_PX = 44;
const monthCell = (app, day) => app.page.locator('.month-cell:not(.other)').nth(day - 1);
const openDay = async (app, day, hour = 15) => {
  await monthCell(app, day).click();
  await app.page.waitForTimeout(200);
  await app.page.locator('.week-scroll').evaluate((n, top) => { n.scrollTop = top; }, hour * HOUR_PX);
  await app.page.waitForTimeout(50);
};
const chooseScope = async (app, label) => {
  await app.page.waitForTimeout(150);
  await app.page.click(`#dialog .scope-options label:has-text("${label}")`);
  await app.page.click('#dialog button:has-text("OK")');
  await app.page.waitForTimeout(250);
};
const times = (app, title, from = [2026, 9, 1], to = [2026, 10, 30]) => app.store((s, a) => s.eventsBetween(new Date(...a.from), new Date(...a.to))
  .filter((e) => e.title === a.title).map((e) => e.start_at.slice(5, 16)), { title, from, to });
const weeklyCourse = (s) => s.createEvent({
  title: 'Kurs', start_at: '2026-10-05T18:00', end_at: '2026-10-05T19:00', repeat: { freq: 'weekly', interval: 1, weekdays: [1] },
});

describe('Ansichten', () => {
  test('öffnet im Monat; Tag antippen öffnet den Tag; Wischen blättert', async () => {
    const app = await browser.open('kalender', { data: () => {} });
    const { page } = app;
    assert.match(await page.locator('.cal-title').textContent(), /Oktober 2026/);
    await openDay(app, 15);
    assert.match(await page.locator('.cal-title').textContent(), /15\. Okt/);
    await swipe(app, page.locator('.week'), -200);
    assert.match(await page.locator('.cal-title').textContent(), /16\. Okt/, 'nach links wischen → nächster Tag');
    await swipe(app, page.locator('.week'), 200);
    assert.match(await page.locator('.cal-title').textContent(), /15\. Okt/);
    await page.click('.segmented.modes button:has-text("Woche")');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.day-col').count(), 7);
    assert.equal(await page.locator('.day-col.today').count(), 1);
    await app.close();
  });

  test('„+“ in der Tagesansicht schlägt diesen Tag vor', async () => {
    const app = await browser.open('kalender', { data: () => {} });
    await openDay(app, 20);
    await app.page.click('.fab');
    await app.page.waitForTimeout(200);
    await app.page.fill('#dialog input[name="title"]', 'Zahnarzt');
    await app.page.click('#dialog button[type=submit]');
    await app.page.waitForTimeout(250);
    assert.deepEqual(await times(app, 'Zahnarzt'), ['10-20 09:00']);
    await app.close();
  });
});

describe('Aufgaben und Veranstaltungen ein-/ausblenden', () => {
  const data = (s) => {
    s.createTask({ title: 'Steuer', window_end: '2026-10-20' });
    s.createTask({ title: 'Bad', recurrence: 'rhythm', window_start: '2026-10-22', buffer: 2, repeat: { freq: 'weekly', interval: 1 } });
    s.createEvent({ title: 'Konzert', topic_id: s.eventTopic().id, start_at: '2026-10-24T20:00', end_at: '2026-10-24T22:00' });
  };

  test('Monat: Deadline rot, regelmäßige Aufgabe einmal am Termintag, Veranstaltung', async () => {
    const app = await browser.open('kalender', { data });
    const { page } = app;
    assert.deepEqual(await texts(monthCell(app, 20).locator('.chip.deadline')), ['⏰ Steuer']);
    assert.deepEqual(await texts(page.locator('.chip.recurring')), ['Bad'], 'trotz Puffer nur einmal');
    assert.deepEqual(await texts(monthCell(app, 22).locator('.chip.recurring')), ['Bad']);
    assert.deepEqual(await texts(monthCell(app, 24).locator('.chip.is-event')), ['Konzert']);
    await app.close();
  });

  test('Haken „Aufgaben“ blendet Deadlines und regelmäßige Aufgaben aus und bleibt nach dem Neuladen aus', async () => {
    const app = await browser.open('kalender', { data });
    const { page } = app;
    const tasksBox = page.locator('label:has-text("Aufgaben") input');
    await tasksBox.uncheck();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.chip.deadline, .chip.recurring').count(), 0);
    assert.match(await page.locator('label:has-text("Aufgaben")').textContent(), /\(2 aus\)/);
    assert.equal(await page.locator('.chip.is-event').count(), 1, 'Veranstaltungen bleiben');
    await page.reload();
    await page.waitForTimeout(250);
    assert.equal(await tasksBox.isChecked(), false);
    await tasksBox.check();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.chip.deadline, .chip.recurring').count(), 2);
    await app.close();
  });

  test('Haken „Veranstaltungen“ blendet nur Veranstaltungen aus', async () => {
    const app = await browser.open('kalender', { data });
    await app.page.locator('label:has-text("Veranstaltungen") input').uncheck();
    await app.page.waitForTimeout(200);
    assert.equal(await app.page.locator('.chip.is-event').count(), 0);
    assert.equal(await app.page.locator('.chip.deadline, .chip.recurring').count(), 2);
    await app.close();
  });

  test('Deadline mit Uhrzeit: rote Linie zur Uhrzeit in der Tagesansicht', async () => {
    const app = await browser.open('kalender', { data: (s) => s.createTask({ title: 'Abgabe', window_end: '2026-10-20', deadline_time: '14:30' }) });
    await openDay(app, 20, 12);
    const mark = app.page.locator('.deadline-mark');
    assert.equal(await mark.count(), 1);
    assert.equal(await mark.evaluate((n) => n.style.top), `${14.5 * HOUR_PX}px`);
    assert.match(await mark.textContent(), /14:30 Abgabe/);
    await app.close();
  });
});

describe('Termine ziehen und Serien', () => {
  test('Serientermin 1 Std. später ziehen: „Dieser Termin“; nochmal ziehen fragt wieder', async () => {
    const app = await browser.open('kalender', { data: weeklyCourse });
    await openDay(app, 12);
    await longPressDrag(app, app.page.locator('.block:has-text("Kurs")'), 0, HOUR_PX, { steps: 8 });
    await chooseScope(app, 'Dieser Termin');
    assert.deepEqual((await times(app, 'Kurs')).slice(0, 3), ['10-05 18:00', '10-12 19:00', '10-19 18:00']);
    await longPressDrag(app, app.page.locator('.block:has-text("Kurs")'), 0, HOUR_PX, { steps: 8 });
    assert.equal(await app.page.locator('#dialog .scope-options').count(), 1, 'fragt erneut');
    await chooseScope(app, 'Dieser und alle folgenden');
    assert.deepEqual((await times(app, 'Kurs')).slice(0, 3), ['10-05 18:00', '10-12 20:00', '10-19 20:00']);
    await app.close();
  });

  test('Serie im Editor: „Alle Termine“ ändert die Uhrzeit überall', async () => {
    const app = await browser.open('kalender', { data: weeklyCourse });
    await openDay(app, 19);
    await app.page.locator('.block:has-text("Kurs")').click();
    await app.page.waitForTimeout(200);
    await app.page.fill('#dialog input[name="title"]', 'Yoga');
    await app.page.click('#dialog button[type=submit]');
    await chooseScope(app, 'Alle Termine');
    assert.deepEqual((await times(app, 'Yoga')).slice(0, 2), ['10-05 18:00', '10-12 18:00']);
    assert.deepEqual(await times(app, 'Kurs'), []);
    await app.close();
  });

  test('Serientermin löschen: nur dieser', async () => {
    const app = await browser.open('kalender', { data: weeklyCourse });
    await openDay(app, 12);
    await app.page.locator('.block:has-text("Kurs")').click();
    await app.page.waitForTimeout(200);
    await app.page.click('#dialog button.danger');
    await chooseScope(app, 'Dieser Termin');
    assert.deepEqual((await times(app, 'Kurs')).slice(0, 2), ['10-05 18:00', '10-19 18:00']);
    await app.close();
  });

  test('Geburtstag verschieben: keine Rückfrage, gilt für alle Jahre', async () => {
    const app = await browser.open('kalender', {
      data: (s) => s.createEvent({ title: 'Anna', topic_id: s.birthdayTopic().id, start_at: '2026-10-20T00:00', end_at: '2026-10-20T00:00', birth_year: 1990 }),
    });
    const { page } = app;
    await openDay(app, 20);
    assert.match(await page.locator('.allday-row .chip').textContent(), /🎂 Anna \(36\)/);
    await page.locator('.allday-row .chip:has-text("Anna")').click();
    await page.waitForTimeout(200);
    await page.locator('#dialog .dt-display').first().click();
    await page.waitForTimeout(100);
    await page.locator('#dialog .dt-panel:not([hidden]) .dt-day.selected + .dt-day').click();
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#dialog .scope-options').count(), 0);
    const days = await app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2027, 11, 31)).filter((e) => e.is_birthday).map((e) => e.start_at.slice(0, 10)));
    assert.deepEqual(days, ['2026-10-21', '2027-10-21']);
    await app.close();
  });
});

describe('Aufgaben einplanen', () => {
  test('📅 in der Aufgabenliste: Dauer aus der Aufgabe, Termin verweist auf sie, im Termin abhaken', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => s.createTask({ title: 'Präsentation', duration_min: 90 }),
    });
    const { page } = app;
    await page.click('.task-row:has-text("Präsentation") button[aria-label="Im Kalender einplanen"]');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#dialog h2').textContent(), '„Präsentation“ einplanen');
    assert.equal(await page.locator('#pp-minutes').inputValue(), '90');
    await page.click('#dialog button:has-text("📅 Einplanen")');
    await page.waitForTimeout(250);
    const ev = await app.store((s) => s.eventsBetween(new Date(2026, 0, 1), new Date(2027, 0, 1))[0]);
    assert.ok(ev.task_id);
    assert.equal((new Date(ev.end_at.replace(' ', 'T')) - new Date(ev.start_at.replace(' ', 'T'))) / 60000, 90);

    await app.go('kalender');
    await openDay(app, Number(ev.start_at.slice(8, 10)), Math.max(0, Number(ev.start_at.slice(11, 13)) - 1));
    await page.locator('.block:has-text("Präsentation")').click();
    await page.waitForTimeout(200);
    await page.click('#dialog .planned-task button:has-text("Erledigt")');
    await page.waitForTimeout(250);
    assert.equal(await app.store((s) => s.tasks()[0].status), 'done');
    assert.match(await page.locator('.block').first().innerText(), /✓ Präsentation/);
    await app.close();
  });

  // Termine am Fr., 16.10.: 9–12 Büro, 14–15 Arzt, 18:30–19:30 Yoga.
  const busyFriday = (s) => {
    s.createTask({ title: 'Präsentation', duration_min: 90 });
    s.createEvent({ title: 'Büro', start_at: '2026-10-16T09:00', end_at: '2026-10-16T12:00' });
    s.createEvent({ title: 'Arzt', start_at: '2026-10-16T14:00', end_at: '2026-10-16T15:00' });
    s.createEvent({ title: 'Yoga', start_at: '2026-10-16T18:30', end_at: '2026-10-16T19:30' });
  };
  const openPicker = async (app) => {
    await app.page.click('.task-row:has-text("Präsentation") button[aria-label="Im Kalender einplanen"]');
    await app.page.waitForTimeout(250);
  };
  const planned = (app) => app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2026, 11, 31))
    .filter((e) => e.task_id).map((e) => `${e.start_at}–${e.end_at.slice(11)}`));

  test('Einplanen: Monat mit Terminen, vergangene Tage gesperrt, Tag wählen zeigt Termine und freie Zeiten', async () => {
    const app = await browser.open('aufgaben', { data: busyFriday });
    const { page } = app;
    await openPicker(app);
    assert.equal(await page.locator('.pp-day[data-day="2026-10-14"]').isDisabled(), true, 'gestern gesperrt');
    assert.equal(await page.locator('.pp-day.selected').getAttribute('data-day'), '2026-10-15', 'heute vorgewählt');
    assert.equal((await page.locator('.pp-day[data-day="2026-10-16"] .pp-count').textContent()).trim(), '•••', '3 Termine');
    await page.click('.pp-day[data-day="2026-10-16"]');
    await page.waitForTimeout(200);
    assert.deepEqual(await texts(page.locator('.pp-free-buttons .chip-button')), ['06:00–09:00', '12:00–14:00', '15:00–18:30', '19:30–23:00']);
    assert.deepEqual(await texts(page.locator('.pp-busy')), ['09:00 Büro', '14:00 Arzt', '18:30 Yoga']);
    assert.equal(await page.locator('.pp-chosen').textContent(), 'Fr., 16.10., 12:00–13:30', 'erste passende Lücke ab 8 Uhr');
    await page.click('.pp-free-buttons .chip-button:has-text("15:00–18:30")');
    await page.click('#dialog button:has-text("📅 Einplanen")');
    await page.waitForTimeout(250);
    assert.deepEqual(await planned(app), ['2026-10-16 15:00–16:30']);
    assert.equal(await page.locator('#dialog[open]').count(), 0);
    assert.match(await page.locator('#toast').textContent(), /Eingeplant: Fr\., 16\.10\., 15:00/);
    await app.close();
  });

  test('Einplanen: in die Zeitleiste tippen wählt die Uhrzeit (Viertelstunde); Überschneidung wird angezeigt', async () => {
    const app = await browser.open('aufgaben', { data: busyFriday });
    const { page } = app;
    await openPicker(app);
    await page.click('.pp-day[data-day="2026-10-16"]');
    await page.waitForTimeout(200);
    const lane = page.locator('.pp-lane');
    const box = await lane.boundingBox();
    await lane.click({ position: { x: 10, y: (16.5 - 6) * 40 + 2 } }); // 16:30
    assert.equal(await page.locator('.pp-chosen').textContent(), 'Fr., 16.10., 16:30–18:00');
    assert.equal(await page.locator('.pp-warning').count(), 0);
    await lane.click({ position: { x: 10, y: (13.5 - 6) * 40 + 2 } }); // 13:30 → reicht in den Arzttermin
    assert.equal(await page.locator('.pp-chosen').textContent(), 'Fr., 16.10., 13:30–15:00');
    assert.match(await page.locator('.pp-warning').textContent(), /Überschneidet/);
    assert.ok(box.height > 600);
    await app.close();
  });

  test('Einplanen: Dauer ändern verschiebt den Vorschlag; Monat blättern; „Mehr Optionen“ öffnet den Termin-Editor', async () => {
    const app = await browser.open('aufgaben', { data: busyFriday });
    const { page } = app;
    await openPicker(app);
    await page.click('.pp-day[data-day="2026-10-16"]');
    await page.fill('#pp-minutes', '180');
    await page.locator('#pp-minutes').dispatchEvent('change');
    await page.waitForTimeout(200);
    assert.deepEqual(await texts(page.locator('.pp-free-buttons .chip-button')), ['06:00–09:00', '15:00–18:30', '19:30–23:00']);
    await page.click('button[aria-label="Nächster Monat"]');
    assert.match(await page.locator('.pp-month-head strong').textContent(), /November 2026/);
    await page.click('.pp-day[data-day="2026-11-03"]');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.pp-chosen').textContent(), 'Di., 03.11., 08:00–11:00');
    await page.click('#dialog button:has-text("Mehr Optionen")');
    await page.waitForTimeout(250);
    assert.match(await page.locator('#dialog h2').textContent(), /einplanen/i);
    assert.equal(await page.locator('#dialog .planned-task strong').textContent(), 'Präsentation');
    await app.close();
  });

  test('Routine einplanen: Standardstartzeit wird vorgeschlagen, wenn sie frei ist', async () => {
    const app = await browser.open('routinen', {
      data: (s) => {
        const r = s.createTask({ title: 'Morgen', kind: 'routine', default_time: '07:00' });
        s.createTask({ title: 'Zähne', parent_id: r.id, duration_min: 20 });
      },
    });
    const { page } = app;
    await page.click('.routine:has-text("Morgen") button:has-text("Einplanen")');
    await page.waitForTimeout(250);
    await page.click('.pp-day[data-day="2026-10-16"]');
    assert.equal(await page.locator('.pp-chosen').textContent(), 'Fr., 16.10., 07:00–07:20');
    await page.click('#dialog button:has-text("📅 Einplanen")');
    await page.waitForTimeout(250);
    const ev = await app.store((s) => s.eventsBetween(new Date(2026, 9, 16), new Date(2026, 9, 16)).find((e) => e.routine_id));
    assert.equal(ev.start_at, '2026-10-16 07:00');
    await app.close();
  });

  test('Termin löschen → „Rückgängig“', async () => {
    const app = await browser.open('kalender', {
      data: (s) => s.createEvent({ title: 'Zahnarzt', start_at: '2026-10-15T15:00', end_at: '2026-10-15T16:00' }),
    });
    const { page } = app;
    await openDay(app, 15, 12);
    await page.locator('.block:has-text("Zahnarzt")').click();
    await page.waitForTimeout(200);
    await page.click('#dialog button.danger:has-text("Löschen")');
    await page.waitForTimeout(250);
    assert.equal(await app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2026, 10, 1)).length), 0);
    await page.click('#toast button:has-text("Rückgängig")');
    await page.waitForTimeout(250);
    assert.deepEqual(await app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2026, 10, 1)).map((e) => e.title)), ['Zahnarzt']);
    await app.close();
  });
  test('Termin nachträglich zur Aufgabe machen', async () => {
    const app = await browser.open('kalender', {
      data: (s) => s.createEvent({ title: 'Bericht', start_at: '2026-10-20T14:00', end_at: '2026-10-20T15:00' }),
    });
    const { page } = app;
    await openDay(app, 20, 12);
    await page.locator('.block:has-text("Bericht")').click();
    await page.waitForTimeout(200);
    await page.click('#dialog .segmented.radio label:has-text("Aufgabe")');
    await page.waitForTimeout(300);
    const t = await app.store((s) => s.tasks()[0]);
    assert.deepEqual([t.title, t.window_end, t.deadline_time], ['Bericht', '2026-10-20', '14:00']);
    assert.equal(await app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2026, 10, 1)).length), 0);
    await app.close();
  });
});
