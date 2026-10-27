// „Was mache ich jetzt?“ (sections.js): welche Aufgabe in welchem Bereich steht und in welcher Reihenfolge.
// Ausführen: npm test

// Deutsche Zeit (mit Sommer-/Winterzeit), egal wo die Tests laufen.
process.env.TZ = 'Europe/Berlin';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import { daysLeft, isOverdue, nowSections, priority } from '../js/sections.js';

const memory = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
const fresh = () => store.load(memory());
const NOW = new Date(2099, 0, 10, 12, 0); // Sa., 10.01.2099, 12:00
const sections = () => {
  const s = nowSections(NOW);
  return Object.fromEntries(Object.entries(s).map(([k, list]) => [k, list.map((t) => t.title)]));
};
const task = (title, extra = {}) => store.createTask({ title, ...extra });
const wd = (w, d) => ({ importance: w, urgency: d });

describe('Priorität und Hilfen', () => {
  test('Priorität = Wichtigkeit × Dringlichkeit (sachlich oder emotional)', () => {
    const t = { importance: 4, urgency: 2, importance_emo: 5, urgency_emo: 5 };
    assert.equal(priority(t), 8);
    assert.equal(priority(t, 'emotional'), 25);
  });

  test('überfällig: „täglich erinnern“ vorbei, oder einmalig und verfallen', () => {
    assert.equal(isOverdue({ status: 'overdue', recurrence: 'rhythm' }), true);
    assert.equal(isOverdue({ status: 'expired', recurrence: 'once' }), true);
    assert.equal(isOverdue({ status: 'expired', recurrence: 'rhythm' }), false);
    assert.equal(isOverdue({ status: 'due', recurrence: 'once' }), false);
  });

  test('verbleibende Tage bis zum letzten Tag (nie negativ)', () => {
    assert.equal(daysLeft({ window_end: '2099-01-10' }, NOW), 0);
    assert.equal(daysLeft({ window_end: '2099-01-13' }, NOW), 3);
    assert.equal(daysLeft({ window_end: '2099-01-01' }, NOW), 0);
  });
});

describe('Welche Aufgabe in welchem Bereich', () => {
  test('überfällig, heute fällig, weitere, demnächst – und Erledigtes nirgends', () => {
    fresh();
    task('Ü', { window_end: '2099-01-08' });
    task('H', { window_end: '2099-01-12' });
    task('W');
    task('D', { window_start: '2099-01-15', window_end: '2099-01-20' });
    const done = task('E', { window_end: '2099-01-12' });
    store.completeTask(done.id, NOW);
    assert.deepEqual(sections(), { items: ['Ü', 'H', 'W'], overdue: ['Ü'], today: ['H'], rest: ['W'], upcoming: ['D'] });
  });

  test('ohne Deadline aber mit „Ab“ in der Vergangenheit: bei „Weitere“', () => {
    fresh();
    task('ab gestern', { window_start: '2099-01-09' });
    assert.deepEqual(sections().rest, ['ab gestern']);
    assert.deepEqual(sections().today, []);
  });

  test('regelmäßig ohne Deadline-Häkchen, aber im Fenster: heute fällig', () => {
    fresh();
    task('Bad', { recurrence: 'rhythm', window_start: '2099-01-10', buffer: 1, repeat: { freq: 'weekly', interval: 1 } });
    assert.deepEqual(sections().today, ['Bad']);
  });

  test('Routinen und ihre Schritte erscheinen nicht; Aufgaben mehrtägiger Routinen schon', () => {
    fresh();
    const r = task('Morgen', { kind: 'routine' });
    task('Zähne', { parent_id: r.id, window_end: '2099-01-10' });
    const m = task('Haushalt', { kind: 'routine', routine_type: 'multi' });
    task('Müll', { parent_id: m.id, recurrence: 'rhythm', window_start: '2099-01-10', buffer: 0, repeat: { freq: 'weekly', interval: 1 } });
    task('Fenster', { parent_id: m.id, recurrence: 'rhythm', window_start: '2099-01-20', buffer: 0, repeat: { freq: 'monthly', interval: 1 } });
    const s = sections();
    assert.deepEqual([s.today, s.upcoming, s.rest, s.overdue], [['Müll'], ['Fenster'], [], []]);
  });

  test('Unteraufgaben: einzeln unter Überfällig/Heute fällig, außer ihre Oberaufgabe steht schon da', () => {
    fresh();
    const p = task('Umzug');
    task('Kartons', { parent_id: p.id, window_end: '2099-01-10' });
    const q = task('Projekt', { window_end: '2099-01-11' });
    task('Teil', { parent_id: q.id, window_end: '2099-01-10' });
    const o = task('Alt', { window_end: '2099-01-05' });
    task('Alt-Teil', { parent_id: o.id, window_end: '2099-01-11' });
    const s = sections();
    assert.deepEqual(s.today.sort(), ['Kartons', 'Projekt']);
    assert.deepEqual(s.overdue, ['Alt']);
    assert.deepEqual(s.rest, ['Umzug'], 'Oberaufgabe ohne Datum steht bei Weitere');
  });

  test('Unteraufgaben ohne Datum stehen nicht einzeln bei „Weitere“', () => {
    fresh();
    const p = task('Umzug');
    task('Kartons', { parent_id: p.id });
    assert.deepEqual(sections().rest, ['Umzug']);
  });

  test('„verfällt“: einmalige Aufgabe bleibt überfällig, regelmäßige rückt weiter', () => {
    fresh();
    task('einmal', { window_end: '2099-01-05', on_missed: 'expire' });
    // freitags; der 2. und der 9. sind verpasst → nächster Durchgang Fr., 16.01.
    task('Müll', { recurrence: 'rhythm', window_start: '2099-01-02', buffer: 0, on_missed: 'expire', repeat: { freq: 'weekly', interval: 1 } });
    const s = sections();
    assert.deepEqual(s.overdue, ['einmal']);
    assert.deepEqual(s.upcoming, ['Müll']);
    assert.equal(store.tasks(NOW).find((t) => t.title === 'Müll').window_start, '2099-01-16');
  });

  test('Demnächst: früheste zuerst, höchstens 8', () => {
    fresh();
    for (let i = 20; i >= 11; i--) task(`ab ${i}.`, { window_start: `2099-01-${i}` });
    assert.deepEqual(sections().upcoming, ['ab 11.', 'ab 12.', 'ab 13.', 'ab 14.', 'ab 15.', 'ab 16.', 'ab 17.', 'ab 18.']);
  });
});

describe('Reihenfolge in den Bereichen', () => {
  test('Überfällig: nach W×D, bei Gleichstand am längsten überfällig zuerst', () => {
    fresh();
    task('lange, W1D1', { window_end: '2099-01-01', ...wd(1, 1) });
    task('kurz, W5D5', { window_end: '2099-01-09', ...wd(5, 5) });
    task('mittel, W3D3', { window_end: '2099-01-05', ...wd(3, 3) });
    task('älter, W2D2', { window_end: '2099-01-02', ...wd(2, 2) });
    task('neuer, W2D2', { window_end: '2099-01-08', ...wd(2, 2) });
    assert.deepEqual(sections().overdue, ['kurz, W5D5', 'mittel, W3D3', 'älter, W2D2', 'neuer, W2D2', 'lange, W1D1']);
  });

  test('Überfällig mit Uhrzeit heute: zählt nach der Uhrzeit', () => {
    fresh();
    task('9 Uhr', { window_end: '2099-01-10', deadline_time: '09:00' });
    task('8 Uhr', { window_end: '2099-01-10', deadline_time: '08:00' });
    assert.deepEqual(sections().overdue, ['8 Uhr', '9 Uhr']);
  });

  test('Heute fällig: nach W×D, bei Gleichstand weniger Zeit zuerst', () => {
    fresh();
    task('heute, W2D2', { window_end: '2099-01-10', ...wd(2, 2) });
    task('5 Tage, W5D4', { window_end: '2099-01-15', ...wd(5, 4) });
    task('2 Tage, W2D2', { window_end: '2099-01-12', ...wd(2, 2) });
    task('1 Tag, W4D1', { window_end: '2099-01-11', ...wd(4, 1) });
    assert.deepEqual(sections().today, ['5 Tage, W5D4', 'heute, W2D2', '1 Tag, W4D1', '2 Tage, W2D2']);
  });

  test('Weitere: nach W×D (höchste zuerst)', () => {
    fresh();
    task('niedrig', wd(1, 2));
    task('hoch', wd(5, 5));
    task('mittel', wd(3, 3));
    assert.deepEqual(sections().rest, ['hoch', 'mittel', 'niedrig']);
  });

  test('Emotionale Werte zählen für die Reihenfolge nicht', () => {
    fresh();
    task('sachlich hoch', { ...wd(5, 5), importance_emo: 1, urgency_emo: 1 });
    task('emotional hoch', { ...wd(1, 1), importance_emo: 5, urgency_emo: 5 });
    assert.deepEqual(sections().rest, ['sachlich hoch', 'emotional hoch']);
  });
});
