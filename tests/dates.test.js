// Datumshelfer (dates.js): Lesen/Schreiben, Rechnen mit Tagen, lesbare Zeitspannen. Ausführen: npm test

// Deutsche Zeit (mit Sommer-/Winterzeit), egal wo die Tests laufen.
process.env.TZ = 'Europe/Berlin';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, daysBetween, formatDuration, hoursText, isoDate, isoDateTime, parseDate, spanText, stamp, startOfDay, startOfWeek,
} from '../js/dates.js';

describe('Datum lesen und schreiben', () => {
  test('parseDate liest Tag, Tag mit Uhrzeit (Leerzeichen oder T) als lokale Zeit', () => {
    const d = parseDate('2026-03-07');
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 2, 7, 0, 0]);
    const t = parseDate('2026-03-07 08:05');
    assert.deepEqual([t.getHours(), t.getMinutes()], [8, 5]);
    assert.equal(+parseDate('2026-03-07T08:05'), +t);
  });

  test('isoDate, isoDateTime und stamp mit führenden Nullen', () => {
    const d = new Date(2026, 0, 5, 7, 3);
    assert.equal(isoDate(d), '2026-01-05');
    assert.equal(isoDateTime(d), '2026-01-05T07:03');
    assert.equal(stamp(d), '2026-01-05 07:03');
  });

  test('hin und zurück bleibt gleich', () => {
    for (const value of ['2024-02-29 23:59', '2026-12-31 00:00', '2027-01-01 12:30']) {
      assert.equal(stamp(parseDate(value)), value);
    }
  });
});

describe('Rechnen mit Tagen', () => {
  test('addDays über Monats-, Jahres- und Schaltjahresgrenzen', () => {
    assert.equal(isoDate(addDays(parseDate('2026-01-31'), 1)), '2026-02-01');
    assert.equal(isoDate(addDays(parseDate('2026-12-31'), 1)), '2027-01-01');
    assert.equal(isoDate(addDays(parseDate('2024-02-28'), 1)), '2024-02-29');
    assert.equal(isoDate(addDays(parseDate('2025-02-28'), 1)), '2025-03-01');
    assert.equal(isoDate(addDays(parseDate('2026-03-01'), -1)), '2026-02-28');
  });

  test('addDays verändert das Original nicht', () => {
    const d = parseDate('2026-05-10');
    addDays(d, 5);
    assert.equal(isoDate(d), '2026-05-10');
  });

  test('addDays behält die Uhrzeit, auch über die Zeitumstellung', () => {
    // Ende März und Ende Oktober wird in Deutschland umgestellt – die Uhrzeit bleibt trotzdem gleich.
    for (const start of ['2026-03-28 09:15', '2026-10-24 09:15']) {
      assert.equal(stamp(addDays(parseDate(start), 2)).slice(11), '09:15');
    }
  });

  test('daysBetween zählt Kalendertage (Uhrzeit egal, auch über die Zeitumstellung)', () => {
    assert.equal(daysBetween(parseDate('2026-03-28 23:00'), parseDate('2026-03-30 00:30')), 2);
    assert.equal(daysBetween(parseDate('2026-10-24 01:00'), parseDate('2026-10-26 23:00')), 2);
    assert.equal(daysBetween(parseDate('2026-05-10'), parseDate('2026-05-10 23:59')), 0);
    assert.equal(daysBetween(parseDate('2026-05-10'), parseDate('2026-05-03')), -7);
  });

  test('startOfDay und startOfWeek (Woche beginnt am Montag)', () => {
    assert.equal(stamp(startOfDay(parseDate('2026-05-10 17:45'))), '2026-05-10 00:00');
    assert.equal(isoDate(startOfWeek(parseDate('2026-10-26'))), '2026-10-26', 'Montag bleibt Montag');
    assert.equal(isoDate(startOfWeek(parseDate('2026-10-29'))), '2026-10-26', 'Donnerstag → Montag davor');
    assert.equal(isoDate(startOfWeek(parseDate('2026-11-01'))), '2026-10-26', 'Sonntag gehört zur Woche davor');
  });
});

describe('Lesbare Dauer und Zeitspannen', () => {
  test('formatDuration', () => {
    assert.equal(formatDuration(5), '5 min');
    assert.equal(formatDuration(45), '45 min');
    assert.equal(formatDuration(60), '1 h');
    assert.equal(formatDuration(90), '1 h 30 min');
    assert.equal(formatDuration(125), '2 h 5 min');
  });

  test('spanText: Grenzen zwischen Tagen, Wochen, Monaten und Jahren', () => {
    assert.equal(spanText(0), '0 Tage');
    assert.equal(spanText(1), '1 Tag');
    assert.equal(spanText(13), '13 Tage');
    assert.equal(spanText(14), '2 Wochen');
    assert.equal(spanText(55), '8 Wochen');
    assert.equal(spanText(56), '2 Monate');
    assert.equal(spanText(364), '12 Monate');
    assert.equal(spanText(365), '1 Jahr');
    assert.equal(spanText(800), '2 Jahre');
    assert.equal(spanText(-3), '0 Tage', 'negativ zählt als 0');
  });

  test('spanText mit Dativ („seit 3 Tagen“)', () => {
    assert.equal(spanText(3, { dative: true }), '3 Tagen');
    assert.equal(spanText(1, { dative: true }), '1 Tag');
    assert.equal(spanText(21, { dative: true }), '3 Wochen');
    assert.equal(spanText(90, { dative: true }), '3 Monaten');
    assert.equal(spanText(1000, { dative: true }), '3 Jahren');
  });

  test('hoursText: Minuten unter einer Stunde, sonst gerundete Stunden, Vorzeichen egal', () => {
    assert.equal(hoursText(0), '1 Min.');
    assert.equal(hoursText(20 * 60000), '20 Min.');
    assert.equal(hoursText(59 * 60000), '59 Min.');
    assert.equal(hoursText(60 * 60000), '1 Std.');
    assert.equal(hoursText(150 * 60000), '3 Std.');
    assert.equal(hoursText(-20 * 60000), '20 Min.');
  });
});
