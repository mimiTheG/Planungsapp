// Wiederholungsregeln (repeat.js): welche Tage eine Serie hat, Texte und Vorschläge. Ausführen: npm test

// Deutsche Zeit (mit Sommer-/Winterzeit), egal wo die Tests laufen.
process.env.TZ = 'Europe/Berlin';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateDays, countBefore, isLastWeekdayOfMonth, normalize, nthOfMonth, occurrences, onDay, presetKey, presets, repeatText,
} from '../js/repeat.js';
import { isoDate, parseDate } from '../js/dates.js';

// Die ersten n Termintage einer Regel ab einem Starttag als „JJJJ-MM-TT“.
const firstDays = (repeat, start, n) => {
  const result = [];
  for (const day of candidateDays(repeat, parseDate(start))) {
    result.push(isoDate(day));
    if (result.length === n) break;
  }
  return result;
};
// Termintage eines Termins im Zeitraum.
const daysIn = (event, from, to) => occurrences(event, parseDate(from), parseDate(to)).map((o) => o.occurrence);
const ev = (start, repeat, extra = {}) => ({ start_at: `${start} 10:00`, end_at: `${start} 11:00`, repeat, ...extra });

describe('Regeln: täglich, wöchentlich, monatlich, jährlich', () => {
  test('täglich und alle 3 Tage', () => {
    assert.deepEqual(firstDays({ freq: 'daily', interval: 1 }, '2026-01-30', 4), ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
    assert.deepEqual(firstDays({ freq: 'daily', interval: 3 }, '2026-01-30', 3), ['2026-01-30', '2026-02-02', '2026-02-05']);
  });

  test('wöchentlich ohne Wochentage = am Wochentag des Starts', () => {
    assert.deepEqual(firstDays({ freq: 'weekly', interval: 1 }, '2026-10-28', 3), ['2026-10-28', '2026-11-04', '2026-11-11']);
  });

  test('wöchentlich Mo/Mi/Fr, Start am Mittwoch: der Montag davor zählt nicht', () => {
    assert.deepEqual(firstDays({ freq: 'weekly', interval: 1, weekdays: [1, 3, 5] }, '2026-10-28', 4),
      ['2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04']);
  });

  test('wöchentlich mit Sonntag: Sonntag ist das Ende der Woche (Mo–So)', () => {
    assert.deepEqual(firstDays({ freq: 'weekly', interval: 2, weekdays: [0, 1] }, '2026-10-26', 4),
      ['2026-10-26', '2026-11-01', '2026-11-09', '2026-11-15']);
  });

  test('Start passt nicht zur Regel: der Starttag gehört trotzdem dazu', () => {
    assert.deepEqual(firstDays({ freq: 'weekly', interval: 1, weekdays: [1] }, '2026-10-27', 3), ['2026-10-27', '2026-11-02', '2026-11-09']);
  });

  test('monatlich am Tag, alle 3 Monate, über den Jahreswechsel', () => {
    assert.deepEqual(firstDays({ freq: 'monthly', interval: 3, monthly: 'day' }, '2026-11-15', 3), ['2026-11-15', '2027-02-15', '2027-05-15']);
  });

  test('monatlich am 30.: Februar fällt aus', () => {
    assert.deepEqual(firstDays({ freq: 'monthly', interval: 1, monthly: 'day' }, '2026-01-30', 3), ['2026-01-30', '2026-03-30', '2026-04-30']);
  });

  test('monatlich am zweiten Dienstag', () => {
    assert.deepEqual(firstDays({ freq: 'monthly', interval: 1, monthly: 'weekday', nth: 2 }, '2026-10-13', 3),
      ['2026-10-13', '2026-11-10', '2026-12-08']);
  });

  test('monatlich am letzten Montag (auch wenn es mal der 4. ist)', () => {
    assert.deepEqual(firstDays({ freq: 'monthly', interval: 1, monthly: 'weekday', nth: -1 }, '2026-10-26', 3),
      ['2026-10-26', '2026-11-30', '2026-12-28']);
  });

  test('jährlich und alle 2 Jahre', () => {
    assert.deepEqual(firstDays({ freq: 'yearly', interval: 1 }, '2026-07-04', 3), ['2026-07-04', '2027-07-04', '2028-07-04']);
    assert.deepEqual(firstDays({ freq: 'yearly', interval: 2 }, '2026-07-04', 3), ['2026-07-04', '2028-07-04', '2030-07-04']);
  });
});

describe('Termine einer Serie im Zeitraum', () => {
  test('ohne Wiederholung: genau einmal, wenn er den Zeitraum berührt', () => {
    const single = { start_at: '2026-05-10 23:00', end_at: '2026-05-11 01:00', repeat: null };
    assert.equal(daysIn(single, '2026-05-11 00:00', '2026-05-12 00:00').length, 1, 'ragt in den Zeitraum hinein');
    assert.equal(daysIn(single, '2026-05-11 01:00', '2026-05-12 00:00').length, 0, 'endet genau am Beginn');
    assert.equal(daysIn(single, '2026-05-09 00:00', '2026-05-10 23:00').length, 0, 'beginnt genau am Ende');
  });

  test('Ende am Datum ist inklusive, Ende nach Anzahl zählt ab dem ersten Termin', () => {
    assert.deepEqual(daysIn(ev('2026-01-01', { freq: 'daily', interval: 1, until: '2026-01-03' }), '2026-01-01', '2026-02-01'),
      ['2026-01-01', '2026-01-02', '2026-01-03']);
    assert.deepEqual(daysIn(ev('2026-01-01', { freq: 'weekly', interval: 1, count: 2 }), '2026-01-01', '2026-03-01'),
      ['2026-01-01', '2026-01-08']);
  });

  test('gelöschte Einzeltermine (exdates) fehlen', () => {
    assert.deepEqual(daysIn(ev('2026-01-01', { freq: 'daily', interval: 1 }, { exdates: ['2026-01-02'] }), '2026-01-01', '2026-01-04'),
      ['2026-01-01', '2026-01-03']);
  });

  test('Uhrzeit und Dauer gelten für jeden Termin, auch über die Zeitumstellung', () => {
    const list = occurrences(ev('2026-03-27', { freq: 'daily', interval: 1 }), parseDate('2026-03-27'), parseDate('2026-03-31'));
    assert.deepEqual(list.map((o) => [o.start.getHours(), (o.end - o.start) / 60000]), [[10, 60], [10, 60], [10, 60], [10, 60]]);
  });

  test('Zeitraum vor dem Start: keine Termine', () => {
    assert.deepEqual(daysIn(ev('2026-06-01', { freq: 'daily', interval: 1 }), '2026-05-01', '2026-05-31'), []);
  });

  test('countBefore zählt Termine vor einem Tag (gelöschte mitgezählt)', () => {
    const e = ev('2026-01-01', { freq: 'daily', interval: 1 }, { exdates: ['2026-01-02'] });
    assert.equal(countBefore(e, '2026-01-01'), 0);
    assert.equal(countBefore(e, '2026-01-04'), 3);
  });

  test('onDay verschiebt auf einen anderen Tag, Uhrzeit bleibt', () => {
    assert.equal(onDay('2026-01-01 18:30', '2026-02-14'), '2026-02-14 18:30');
  });
});

describe('Wochentag im Monat', () => {
  test('nthOfMonth: 1.–7. = erster … ab dem 29. = letzter', () => {
    assert.equal(nthOfMonth(parseDate('2026-10-01')), 1);
    assert.equal(nthOfMonth(parseDate('2026-10-07')), 1);
    assert.equal(nthOfMonth(parseDate('2026-10-08')), 2);
    assert.equal(nthOfMonth(parseDate('2026-10-28')), 4);
    assert.equal(nthOfMonth(parseDate('2026-10-29')), -1);
  });

  test('isLastWeekdayOfMonth', () => {
    assert.equal(isLastWeekdayOfMonth(parseDate('2026-10-26')), true);
    assert.equal(isLastWeekdayOfMonth(parseDate('2026-10-24')), false);
    assert.equal(isLastWeekdayOfMonth(parseDate('2026-02-22')), true, 'Februar mit 28 Tagen');
  });
});

describe('Texte und Vorschläge', () => {
  test('repeatText für alle Arten', () => {
    const start = '2026-10-13 10:00'; // Dienstag
    assert.equal(repeatText(null, start), 'Wird nicht wiederholt');
    assert.equal(repeatText({ freq: 'daily', interval: 1 }, start), 'Täglich');
    assert.equal(repeatText({ freq: 'daily', interval: 3 }, start), 'Alle 3 Tage');
    assert.equal(repeatText({ freq: 'weekly', interval: 1 }, start), 'Wöchentlich am Dienstag');
    assert.equal(repeatText({ freq: 'weekly', interval: 2, weekdays: [4, 2] }, start), 'Alle 2 Wochen am Di, Do');
    assert.equal(repeatText({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }, start), 'Wöchentlich am Mo–Fr');
    assert.equal(repeatText({ freq: 'weekly', interval: 1, weekdays: [0, 1] }, start), 'Wöchentlich am Mo, So');
    assert.equal(repeatText({ freq: 'monthly', interval: 1, monthly: 'day' }, start), 'Monatlich am 13.');
    assert.equal(repeatText({ freq: 'monthly', interval: 1, monthly: 'weekday', nth: 2 }, start), 'Monatlich am zweiten Dienstag');
    assert.equal(repeatText({ freq: 'monthly', interval: 1, monthly: 'weekday', nth: -1 }, start), 'Monatlich am letzten Dienstag');
    assert.equal(repeatText({ freq: 'yearly', interval: 1 }, start), 'Jährlich am 13. Oktober');
    assert.equal(repeatText({ freq: 'daily', interval: 1, until: '2026-12-31' }, start), 'Täglich, bis 31.12.2026');
    assert.equal(repeatText({ freq: 'daily', interval: 1, count: 5 }, start), 'Täglich, 5-mal');
  });

  test('Vorschläge passen zum Startdatum (letzter Montag im Monat)', () => {
    const list = presets('2026-10-26 10:00');
    assert.deepEqual(list.map((p) => p.key), ['none', 'daily', 'weekly', 'monthly-weekday', 'monthly-day', 'yearly', 'workdays']);
    assert.equal(list.find((p) => p.key === 'weekly').label, 'Wöchentlich am Montag');
    assert.equal(list.find((p) => p.key === 'monthly-weekday').label, 'Monatlich am letzten Montag');
    assert.equal(list.find((p) => p.key === 'monthly-day').label, 'Monatlich am 26.');
  });

  test('presetKey erkennt Vorschläge wieder – sonst „custom“', () => {
    const start = '2026-10-13 10:00';
    assert.equal(presetKey(null, start), 'none');
    assert.equal(presetKey({ freq: 'weekly', interval: 1, weekdays: [2] }, start), 'weekly');
    assert.equal(presetKey({ freq: 'weekly', interval: 1, weekdays: [5, 4, 3, 2, 1] }, start), 'workdays', 'Reihenfolge egal');
    assert.equal(presetKey({ freq: 'weekly', interval: 2, weekdays: [2] }, start), 'custom');
    assert.equal(presetKey({ freq: 'daily', interval: 1, count: 3 }, start), 'custom', 'mit Ende ist es kein Vorschlag');
  });

  test('normalize füllt Standardwerte und entfernt Fremdes', () => {
    assert.deepEqual(normalize({ freq: 'daily' }), { freq: 'daily', interval: 1, weekdays: null, monthly: null, nth: null, until: null, count: null });
    assert.deepEqual(normalize({ freq: 'monthly', interval: 2, weekdays: [1] }).monthly, 'day');
  });
});
