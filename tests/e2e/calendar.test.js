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

describe('Erledigte Aufgaben durchgestrichen', () => {
  test('in „Jetzt“ abhaken → im Kalender am selben Tag durchgestrichen (Monat und Tag), nächster Durchgang offen', async () => {
    const app = await browser.open('jetzt', {
      data: (s) => {
        s.createTask({ title: 'Bad', recurrence: 'rhythm', window_start: '2026-10-15', buffer: 0, repeat: { freq: 'weekly', interval: 1 } });
        s.createTask({ title: 'Steuer', window_end: '2026-10-20' });
      },
    });
    const { page } = app;
    for (const title of ['Bad', 'Steuer']) {
      await page.locator(`.now-item:has-text("${title}") .done-btn`).click();
      await page.waitForTimeout(250);
    }
    await app.go('kalender');
    assert.deepEqual(await texts(monthCell(app, 15).locator('.chip.done')), ['Bad', 'Steuer']);
    assert.equal(await monthCell(app, 15).locator('.chip.done').first().evaluate((n) => getComputedStyle(n).textDecorationLine), 'line-through');
    assert.deepEqual(await texts(monthCell(app, 22).locator('.chip.recurring:not(.done)')), ['Bad'], 'nächste Woche wieder offen');
    assert.equal(await monthCell(app, 20).locator('.chip.deadline').count(), 0, 'keine rote Deadline mehr');
    await openDay(app, 15);
    assert.deepEqual(await texts(page.locator('.allday-cell .chip.done')), ['Bad', 'Steuer']);
    await app.close();
  });

  test('eingeplante Aufgabe erledigt → der Termin ist durchgestrichen und hat ein ✓', async () => {
    const app = await browser.open('kalender', {
      data: (s) => {
        const t = s.createTask({ title: 'Fenster putzen' });
        s.createEvent({ title: '', task_id: t.id, start_at: '2026-10-15T09:00', end_at: '2026-10-15T10:00' });
        s.completeTask(t.id);
      },
    });
    assert.deepEqual(await texts(monthCell(app, 15).locator('.chip.done')), ['✓ Fenster putzen']);
    await openDay(app, 15, 8);
    assert.equal(await app.page.locator('.block.done:has-text("Fenster putzen")').count(), 1);
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
    await page.locator('#dialog .dt-date').first().click();
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

describe('Aufgaben einplanen (im echten Kalender)', () => {
  const planned = (app) => app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2026, 11, 31))
    .filter((e) => e.task_id || e.routine_id).map((e) => `${e.start_at}–${e.end_at.slice(11)}`));
  // In der Tages-/Wochenansicht auf eine Uhrzeit tippen (Spalte des Tages, Stunde als Dezimalzahl).
  const tapTime = async (app, day, hour) => {
    await app.page.locator('.week-scroll').evaluate((n, top) => { n.scrollTop = top; }, Math.max(0, hour - 1) * HOUR_PX);
    await app.page.waitForTimeout(50);
    await app.page.locator(`.day-col[data-day="${day}"]`).click({ position: { x: 20, y: hour * HOUR_PX + 2 } });
    await app.page.waitForTimeout(250);
  };

  test('📅 in der Aufgabenliste → Kalender (heute) mit Hinweis; Uhrzeit antippen → Termin-Editor; speichern → zurück', async () => {
    const app = await browser.open('aufgaben', {
      data: (s) => {
        s.createTask({ title: 'Präsentation', duration_min: 90 });
        s.createEvent({ title: 'Arzt', start_at: '2026-10-15T14:00', end_at: '2026-10-15T15:00' });
      },
    });
    const { page } = app;
    await page.click('.task-row:has-text("Präsentation") button[aria-label="Im Kalender einplanen"]');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => location.hash), '#kalender');
    assert.match(await page.locator('.plan-banner').textContent(), /„Präsentation“ einplanen.*90 Min/);
    assert.equal(await page.locator('.day-col').getAttribute('data-day'), '2026-10-15', 'heute in der Tagesansicht');
    assert.equal(await page.locator('.block:has-text("Arzt")').count(), 1, 'vorhandene Termine sichtbar');
    assert.equal(await page.locator('.fab').count(), 0);
    await tapTime(app, '2026-10-15', 15.5);
    assert.equal(await page.locator('#dialog h2').textContent(), 'Aufgabe einplanen');
    assert.equal(await page.locator('#dialog .planned-task strong').textContent(), 'Präsentation');
    assert.deepEqual(await page.locator('#dialog .dt-time').evaluateAll((l) => l.map((n) => n.value)), ['15:30', '17:00'], 'Viertelstunde, Dauer der Aufgabe');
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    assert.deepEqual(await planned(app), ['2026-10-15 15:30–17:00']);
    assert.equal(await page.evaluate(() => location.hash), '#aufgaben', 'zurück, woher man kam');
    assert.match(await page.locator('#toast').textContent(), /„Präsentation“ eingeplant: .*15:30/);
    await app.close();
  });

  test('im Einplanen-Modus blättern: Monat → Tag antippen → Uhrzeit; im Editor Uhrzeit ändern', async () => {
    const app = await browser.open('aufgaben', { data: (s) => s.createTask({ title: 'Präsentation', duration_min: 90 }) });
    const { page } = app;
    await page.click('.task-row:has-text("Präsentation") button[aria-label="Im Kalender einplanen"]');
    await page.waitForTimeout(250);
    await page.click('.segmented.modes button:has-text("Monat")');
    await page.waitForTimeout(200);
    assert.match(await page.locator('.plan-banner').textContent(), /Tag antippen/);
    await monthCell(app, 20).click();
    await page.waitForTimeout(200);
    await tapTime(app, '2026-10-20', 9);
    await page.fill('#dialog .dt-time >> nth=0', '10:15');
    await page.locator('#dialog .dt-time').first().dispatchEvent('change');
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    assert.deepEqual(await planned(app), ['2026-10-20 10:15–11:45'], 'Ende wandert mit');
    await app.close();
  });

  test('Abbrechen bzw. Editor schließen: nichts eingeplant; Abbrechen führt zurück', async () => {
    const app = await browser.open('aufgaben', { data: (s) => s.createTask({ title: 'Präsentation' }) });
    const { page } = app;
    await page.click('.task-row:has-text("Präsentation") button[aria-label="Im Kalender einplanen"]');
    await page.waitForTimeout(250);
    await tapTime(app, '2026-10-15', 16);
    await page.click('#dialog button[aria-label="Schließen"]');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.plan-banner').count(), 1, 'weiter im Einplanen-Modus');
    await page.click('.plan-banner button:has-text("Abbrechen")');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => location.hash), '#aufgaben');
    assert.deepEqual(await planned(app), []);
    await app.go('kalender');
    assert.equal(await page.locator('.plan-banner').count(), 0);
    await app.close();
  });

  test('Routine einplanen: Termin-Editor mit der Routine, Dauer aus den Schritten', async () => {
    const app = await browser.open('routinen', {
      data: (s) => {
        const r = s.createTask({ title: 'Morgen', kind: 'routine', default_time: '07:00' });
        s.createTask({ title: 'Zähne', parent_id: r.id, duration_min: 20 });
      },
    });
    const { page } = app;
    await page.click('.routine:has-text("Morgen") button:has-text("Einplanen")');
    await page.waitForTimeout(250);
    await page.locator('.cal-head button[aria-label="Vor"]').click();
    await page.waitForTimeout(200);
    await tapTime(app, '2026-10-16', 7);
    assert.equal(await page.locator('#dialog h2').textContent(), 'Routine einplanen');
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    assert.deepEqual(await planned(app), ['2026-10-16 07:00–07:20']);
    assert.equal(await page.evaluate(() => location.hash), '#routinen');
    await app.close();
  });

  test('eingeplante Aufgabe im Termin abhaken → ✓ im Kalender', async () => {
    const app = await browser.open('kalender', {
      data: (s) => {
        const t = s.createTask({ title: 'Präsentation' });
        s.createEvent({ task_id: t.id, start_at: '2026-10-16T10:00', end_at: '2026-10-16T11:00' });
      },
    });
    const { page } = app;
    await openDay(app, 16, 9);
    await page.locator('.block:has-text("Präsentation")').click();
    await page.waitForTimeout(200);
    await page.click('#dialog .planned-task button:has-text("Erledigt")');
    await page.waitForTimeout(250);
    assert.equal(await app.store((s) => s.tasks()[0].status), 'done');
    assert.match(await page.locator('.block').first().innerText(), /✓ Präsentation/);
    await app.close();
  });
});

describe('Datum und Uhrzeit getrennt', () => {
  test('Uhrzeit antippen ändert nur die Uhrzeit (Ende wandert mit); Datum öffnet nur den Kalender', async () => {
    const app = await browser.open('kalender', {
      data: (s) => s.createEvent({ title: 'Zahnarzt', start_at: '2026-10-15T15:00', end_at: '2026-10-15T16:00' }),
    });
    const { page } = app;
    await openDay(app, 15, 14);
    await page.locator('.block:has-text("Zahnarzt")').click();
    await page.waitForTimeout(200);
    await page.fill('#dialog .dt-time >> nth=0', '17:30');
    await page.locator('#dialog .dt-time').first().dispatchEvent('change');
    assert.equal(await page.locator('#dialog .dt-panel:not([hidden])').count(), 0, 'kein Kalender bei der Uhrzeit');
    assert.deepEqual(await page.locator('#dialog .dt-time').evaluateAll((l) => l.map((n) => n.value)), ['17:30', '18:30']);
    await page.locator('#dialog .dt-date').first().click();
    await page.waitForTimeout(100);
    const panel = page.locator('#dialog .dt-panel:not([hidden])');
    assert.equal(await panel.count(), 1);
    assert.equal(await panel.locator('input[type=time]').count(), 0, 'nur der Kalender, keine Uhrzeit');
    await panel.locator('.dt-day.selected + .dt-day').click();
    assert.equal(await page.locator('#dialog .dt-panel:not([hidden])').count(), 0, 'nach der Wahl zu');
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    assert.deepEqual(await app.store((s) => s.eventsBetween(new Date(2026, 9, 1), new Date(2026, 10, 1)).map((e) => `${e.start_at}–${e.end_at}`)),
      ['2026-10-16 17:30–2026-10-16 18:30']);
    await app.close();
  });
});

describe('Urlaub', () => {
  test('unter „Themen“ eintragen → ganztägig von–bis; Aufgabe „ab dem Erledigen“ rückt um die Urlaubstage', async () => {
    const app = await browser.open('mehr', {
      data: (s) => {
        const t = s.createTask({ title: 'Friseur', recurrence: 'rhythm', window_start: '2026-10-10', buffer: 0, repeat_from_done: true, repeat: { freq: 'weekly', interval: 4 } });
        s.completeTask(t.id, new Date('2026-10-10T10:00'));
        s.createTask({ title: 'Müll', recurrence: 'rhythm', window_start: '2026-10-16', buffer: 0, repeat: { freq: 'weekly', interval: 1 } });
      },
    });
    const { page } = app;
    const windows = () => app.store((s) => s.tasks().map((t) => `${t.title} ${t.window_start}`));
    assert.deepEqual(await windows(), ['Friseur 2026-11-07', 'Müll 2026-10-16']);
    await page.click('button:has-text("+ Urlaub eintragen")');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#dialog h2').textContent(), 'Urlaub eintragen');
    assert.equal(await page.locator('#dialog label.check:has-text("Ganztägig")').isVisible(), false);
    assert.equal(await page.locator('#dialog .dt-time').first().isVisible(), false, 'ohne Uhrzeit');
    assert.deepEqual(await texts(page.locator('#dialog .field-label:text-matches("^(Von|Bis)$")')), ['Von', 'Bis']);
    await page.click('#dialog button[type=submit]');
    await page.waitForTimeout(250);
    assert.match(await page.locator('.vacation-list li').textContent(), /Urlaub.*Do\., 15\.10\. – Mi\., 21\.10\. · 7 Tage/);
    assert.deepEqual(await windows(), ['Friseur 2026-11-14', 'Müll 2026-10-16'], 'Friseur 7 Tage später, Müll bleibt');

    await page.click('.vacation-list button:has-text("Urlaub")');
    await page.waitForTimeout(200);
    await page.click('#dialog button.danger:has-text("Löschen")');
    await page.waitForTimeout(250);
    assert.deepEqual(await windows(), ['Friseur 2026-11-07', 'Müll 2026-10-16'], 'Urlaub gelöscht → wieder wie vorher');
    await app.close();
  });
});

describe('Rückgängig (Termine)', () => {
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
