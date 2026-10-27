// Fälligkeitslogik (schedule.js): Status, Fenster, Puffer, Zeitraum, verpasste Durchgänge. Ausführen: npm test

// Deutsche Zeit (mit Sommer-/Winterzeit), egal wo die Tests laufen.
process.env.TZ = 'Europe/Berlin';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as schedule from '../js/schedule.js';
import { isoDate, parseDate } from '../js/dates.js';

const at = (s) => parseDate(s);
const once = (extra = {}) => ({ recurrence: 'once', kind: 'todo', on_missed: 'remind', window_start: null, window_end: null, ...extra });
const weekly = (extra = {}) => ({
  recurrence: 'rhythm', kind: 'todo', on_missed: 'remind', buffer: 0,
  repeat: { freq: 'weekly', interval: 1, weekdays: [1] }, repeat_start: '2026-10-26', ...extra,
});
const win = (pair) => pair.join(' – ');

describe('Status', () => {
  test('ohne Datum offen, erledigt, Routine', () => {
    assert.equal(schedule.status(once()), 'open');
    assert.equal(schedule.status(once({ done_at: '2026-10-01 10:00' })), 'done');
    assert.equal(schedule.status(once({ kind: 'routine' })), 'routine');
  });

  test('vor dem Beginn demnächst, im Zeitraum fällig, danach überfällig bzw. verfallen', () => {
    const t = once({ window_start: '2026-10-10', window_end: '2026-10-12' });
    assert.equal(schedule.status(t, at('2026-10-09 23:59')), 'upcoming');
    assert.equal(schedule.status(t, at('2026-10-10 00:00')), 'due');
    assert.equal(schedule.status(t, at('2026-10-12 23:59')), 'due', 'der letzte Tag zählt ganz');
    assert.equal(schedule.status(t, at('2026-10-13 00:00')), 'overdue');
    assert.equal(schedule.status({ ...t, on_missed: 'expire' }, at('2026-10-13 00:00')), 'expired');
  });

  test('nur Deadline (ohne „Ab“) ist sofort fällig', () => {
    assert.equal(schedule.status(once({ window_end: '2026-10-12' }), at('2026-01-01')), 'due');
  });

  test('nur „Ab“ (ohne Deadline) wird fällig und bleibt fällig', () => {
    const t = once({ window_start: '2026-10-10' });
    assert.equal(schedule.status(t, at('2026-10-09')), 'upcoming');
    assert.equal(schedule.status(t, at('2030-01-01')), 'due');
  });

  test('Deadline mit Uhrzeit: bis zur Uhrzeit fällig, ab dann überfällig', () => {
    const t = once({ window_end: '2026-10-12', deadline_time: '14:30' });
    assert.equal(schedule.status(t, at('2026-10-12 14:29')), 'due');
    assert.equal(schedule.status(t, at('2026-10-12 14:30')), 'overdue');
  });

  test('closesAt: Ende des letzten Tages bzw. die Uhrzeit, ohne Deadline nichts', () => {
    assert.equal(schedule.closesAt(once()), null);
    assert.equal(+schedule.closesAt(once({ window_end: '2026-10-12' })), +at('2026-10-13 00:00'));
    assert.equal(+schedule.closesAt(once({ window_end: '2026-10-12', deadline_time: '06:00' })), +at('2026-10-12 06:00'));
  });
});

describe('Fenster regelmäßiger Aufgaben', () => {
  test('rhythmWindow: Puffer in beide Richtungen', () => {
    assert.equal(win(schedule.rhythmWindow(at('2026-10-15'), 0).map(isoDate)), '2026-10-15 – 2026-10-15');
    assert.equal(win(schedule.rhythmWindow(at('2026-10-15'), 2).map(isoDate)), '2026-10-13 – 2026-10-17');
    assert.equal(win(schedule.rhythmWindow(at('2026-10-15'), -3).map(isoDate)), '2026-10-15 – 2026-10-15', 'negativ = 0');
  });

  test('erstes Fenster: „Erstes Mal am“ ist selbst der erste Termintag (auch wenn kein Montag)', () => {
    assert.equal(win(schedule.initialWindow(weekly({ buffer: 1 }), '2026-10-28')), '2026-10-27 – 2026-10-29');
    assert.equal(win(schedule.initialWindow(weekly(), '2026-10-26')), '2026-10-26 – 2026-10-26');
  });

  test('feste Tage: pünktlich, früh oder spät erledigt → immer der nächste Montag nach dem Fenster', () => {
    const t = weekly({ window_start: '2026-10-26', window_end: '2026-10-26' });
    assert.equal(win(schedule.windowAfterDone(t, at('2026-10-26 12:00'))), '2026-11-02 – 2026-11-02', 'pünktlich');
    assert.equal(win(schedule.windowAfterDone(t, at('2026-10-24 12:00'))), '2026-11-02 – 2026-11-02', 'vorher erledigt');
    assert.equal(win(schedule.windowAfterDone(t, at('2026-11-04 12:00'))), '2026-11-09 – 2026-11-09', 'zu spät: nächster nach heute');
  });

  test('ab dem Erledigen: Abstand zählt ab dem Tag des Erledigens', () => {
    const t = weekly({ repeat: { freq: 'weekly', interval: 2, weekdays: [1] }, repeat_from_done: true, buffer: 1,
      window_start: '2026-10-25', window_end: '2026-10-27' });
    assert.equal(win(schedule.windowAfterDone(t, at('2026-10-29 12:00'))), '2026-11-11 – 2026-11-13', 'Do + 2 Wochen = Do');
  });

  test('ab dem Erledigen monatlich: gleicher Tag im übernächsten Monat', () => {
    const t = weekly({ repeat: { freq: 'monthly', interval: 2, monthly: 'day' }, repeat_from_done: true,
      window_start: '2026-10-05', window_end: '2026-10-05' });
    assert.equal(win(schedule.windowAfterDone(t, at('2026-10-07 09:00'))), '2026-12-07 – 2026-12-07');
  });

  test('alte Form „alle n Tage“: n Tage nach dem Erledigen', () => {
    const t = { recurrence: 'rhythm', rhythm_days: 10, buffer: 0, window_start: '2026-10-01', window_end: '2026-10-01' };
    assert.equal(win(schedule.windowAfterDone(t, at('2026-10-03 08:00'))), '2026-10-13 – 2026-10-13');
  });

  test('einmalige Aufgabe hat kein nächstes Fenster', () => {
    assert.deepEqual(schedule.windowAfterDone(once({ window_end: '2026-10-01' }), at('2026-10-01')), [null, null]);
  });
});

describe('Fester Zeitraum im Jahr', () => {
  test('aktueller Zeitraum, nächster Zeitraum, über den Jahreswechsel', () => {
    const w = (s, e, from) => win(schedule.periodWindow(s, e, at(from)).map(isoDate));
    assert.equal(w('03-01', '09-30', '2026-05-01'), '2026-03-01 – 2026-09-30');
    assert.equal(w('03-01', '09-30', '2026-10-01'), '2027-03-01 – 2027-09-30');
    assert.equal(w('03-01', '09-30', '2026-01-15'), '2026-03-01 – 2026-09-30');
    assert.equal(w('11-01', '02-28', '2027-01-10'), '2026-11-01 – 2027-02-28', 'Winter über Silvester');
    assert.equal(w('11-01', '02-28', '2027-03-01'), '2027-11-01 – 2028-02-28');
  });

  test('29. Februar: im Nicht-Schaltjahr der 28.', () => {
    const w = (from) => win(schedule.periodWindow('02-01', '02-29', at(from)).map(isoDate));
    assert.equal(w('2027-02-10'), '2027-02-01 – 2027-02-28');
    assert.equal(w('2028-02-10'), '2028-02-01 – 2028-02-29');
  });

  test('im Zeitraum erledigt → nächstes Jahr', () => {
    const t = { recurrence: 'period', period_start: '03-01', period_end: '09-30', window_start: '2026-03-01', window_end: '2026-09-30' };
    assert.equal(win(schedule.windowAfterDone(t, at('2026-06-01'))), '2027-03-01 – 2027-09-30');
  });
});

describe('Verpasste Durchgänge', () => {
  test('feste Tage: springt auf den ersten noch offenen Durchgang', () => {
    const t = weekly({ window_start: '2026-10-05', window_end: '2026-10-05', on_missed: 'expire', repeat_start: '2026-10-05' });
    assert.equal(win(schedule.windowAfterMissed(t, at('2026-10-21 12:00'))), '2026-10-26 – 2026-10-26');
  });

  test('mit Puffer: ein Fenster, das heute noch offen ist, zählt', () => {
    const t = weekly({ window_start: '2026-10-04', window_end: '2026-10-06', buffer: 1, on_missed: 'expire', repeat_start: '2026-10-05' });
    assert.equal(win(schedule.windowAfterMissed(t, at('2026-10-13 08:00'))), '2026-10-11 – 2026-10-13');
  });

  test('alte Form und Zeitraum', () => {
    const legacy = { recurrence: 'rhythm', rhythm_days: 7, buffer: 0, window_start: '2026-10-01', window_end: '2026-10-01' };
    assert.equal(win(schedule.windowAfterMissed(legacy, at('2026-10-20 12:00'))), '2026-10-22 – 2026-10-22');
    const period = { recurrence: 'period', period_start: '03-01', period_end: '09-30', window_start: '2025-03-01', window_end: '2025-09-30' };
    assert.equal(win(schedule.windowAfterMissed(period, at('2026-10-20'))), '2027-03-01 – 2027-09-30');
  });
});

describe('Künftige Deadlines (Kalender)', () => {
  test('bis zum letzten Tag, ohne doppelte Einträge', () => {
    const t = weekly({ window_start: '2026-10-26', window_end: '2026-10-26', has_deadline: true });
    assert.deepEqual(schedule.upcomingDeadlines(t, '2026-11-16'), ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    assert.deepEqual(schedule.upcomingDeadlines(t, '2026-10-26'), ['2026-10-26']);
  });

  test('einmalig: nur die eine Deadline; ohne Deadline nichts', () => {
    assert.deepEqual(schedule.upcomingDeadlines(once({ window_end: '2026-10-12' }), '2027-01-01'), ['2026-10-12']);
    assert.deepEqual(schedule.upcomingDeadlines(once(), '2027-01-01'), []);
  });
});

describe('Nächster Termintag einer Regel', () => {
  test('nextRepeatDay: am oder nach einem Tag', () => {
    const r = { freq: 'weekly', interval: 2, weekdays: [1] };
    assert.equal(isoDate(schedule.nextRepeatDay(r, '2026-10-26', at('2026-10-26'))), '2026-10-26');
    assert.equal(isoDate(schedule.nextRepeatDay(r, '2026-10-26', at('2026-10-27'))), '2026-11-09');
  });

  test('nextRhythmStart: mindestens einen Tag später', () => {
    assert.equal(isoDate(schedule.nextRhythmStart(at('2026-10-26 18:00'), 3)), '2026-10-29');
    assert.equal(isoDate(schedule.nextRhythmStart(at('2026-10-26'), 0)), '2026-10-27');
  });
});
