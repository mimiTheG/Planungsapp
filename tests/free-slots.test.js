// Freie Zeiten zwischen Terminen (free-slots.js) – für das Einplanen. Ausführen: npm test

// Deutsche Zeit (mit Sommer-/Winterzeit), egal wo die Tests laufen.
process.env.TZ = 'Europe/Berlin';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { busyIntervals, freeSlots, overlaps } from '../js/free-slots.js';
import { formatTime, parseDate } from '../js/dates.js';

const ev = (from, to, extra = {}) => ({ start_at: from, end_at: to, ...extra });
const DAY = parseDate('2099-03-10');
const EARLY = new Date(2000, 0, 1); // „jetzt“ weit vorher → der ganze Tag zählt
const show = (slots) => slots.map((s) => `${formatTime(s.start)}–${formatTime(s.end)}`);

describe('Belegte Zeiten', () => {
  test('überlappende und aneinanderstoßende Termine werden zusammengefasst; ganztägige zählen nicht', () => {
    const events = [
      ev('2099-03-10 09:00', '2099-03-10 10:00'),
      ev('2099-03-10 09:30', '2099-03-10 11:00'),
      ev('2099-03-10 11:00', '2099-03-10 11:30'),
      ev('2099-03-10 14:00', '2099-03-10 15:00'),
      ev('2099-03-10 00:00', '2099-03-10 23:59', { all_day: true }),
    ];
    assert.deepEqual(show(busyIntervals(events, DAY)), ['09:00–11:30', '14:00–15:00']);
  });

  test('Termine über Mitternacht werden auf den Tag zugeschnitten; andere Tage zählen nicht', () => {
    const events = [ev('2099-03-09 22:00', '2099-03-10 07:00'), ev('2099-03-11 08:00', '2099-03-11 09:00')];
    assert.deepEqual(show(busyIntervals(events, DAY)), ['00:00–07:00']);
  });
});

describe('Freie Zeiten', () => {
  test('ohne Termine: der ganze Tag von 6 bis 23 Uhr', () => {
    assert.deepEqual(show(freeSlots([], DAY, 60, { now: EARLY })), ['06:00–23:00']);
  });

  test('Lücken zwischen den Terminen, nur wenn die Dauer hineinpasst', () => {
    const events = [ev('2099-03-10 08:00', '2099-03-10 09:00'), ev('2099-03-10 09:30', '2099-03-10 12:00'), ev('2099-03-10 13:00', '2099-03-10 20:00')];
    assert.deepEqual(show(freeSlots(events, DAY, 60, { now: EARLY })), ['06:00–08:00', '12:00–13:00', '20:00–23:00']);
    assert.deepEqual(show(freeSlots(events, DAY, 30, { now: EARLY })), ['06:00–08:00', '09:00–09:30', '12:00–13:00', '20:00–23:00']);
    assert.deepEqual(show(freeSlots(events, DAY, 180, { now: EARLY })), ['20:00–23:00']);
  });

  test('Termin endet krumm → der Vorschlag beginnt zur nächsten Viertelstunde', () => {
    assert.deepEqual(show(freeSlots([ev('2099-03-10 06:00', '2099-03-10 07:10')], DAY, 60, { now: EARLY })), ['07:15–23:00']);
  });

  test('heute: erst ab jetzt (aufgerundet)', () => {
    const now = parseDate('2099-03-10 14:07');
    assert.deepEqual(show(freeSlots([ev('2099-03-10 16:00', '2099-03-10 17:00')], DAY, 60, { now })), ['14:15–16:00', '17:00–23:00']);
    assert.deepEqual(freeSlots([], DAY, 60, { now: parseDate('2099-03-10 22:30') }), [], 'zu spät für eine Stunde');
  });

  test('vergangener Tag: nichts frei; Tag komplett voll: nichts frei', () => {
    assert.deepEqual(freeSlots([], DAY, 30, { now: parseDate('2099-03-11 08:00') }), []);
    assert.deepEqual(freeSlots([ev('2099-03-10 05:00', '2099-03-10 23:30')], DAY, 15, { now: EARLY }), []);
  });

  test('ganztägige Termine (z. B. Geburtstag) blockieren keine Zeit', () => {
    const events = [ev('2099-03-10 00:00', '2099-03-10 23:59', { all_day: true })];
    assert.deepEqual(show(freeSlots(events, DAY, 60, { now: EARLY })), ['06:00–23:00']);
  });
});

describe('Überschneidung', () => {
  test('angrenzend ist keine Überschneidung', () => {
    const events = [ev('2099-03-10 09:00', '2099-03-10 10:00')];
    assert.equal(overlaps(events, parseDate('2099-03-10 10:00'), 60), false);
    assert.equal(overlaps(events, parseDate('2099-03-10 08:00'), 60), false);
    assert.equal(overlaps(events, parseDate('2099-03-10 09:30'), 15), true);
    assert.equal(overlaps(events, parseDate('2099-03-10 08:30'), 60), true);
  });
});
