// Tests für Fälligkeitslogik und Datenhaltung. Ausführen: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as schedule from '../js/schedule.js';
import * as store from '../js/store.js';
import { loadSamples } from '../js/samples.js';

const memory = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
const d = (s) => new Date(`${s}T12:00:00`);

test('Rhythmus 7, Puffer 3: Tag 1 erledigt → Tag 7–9, Tag 3 erledigt → Tag 9–11', () => {
  const task = { recurrence: 'rhythm', rhythm_days: 7, buffer_days: 3 };
  // Tag 1 = 01.10.
  assert.deepEqual(schedule.windowAfterDone(task, d('2026-10-01')), ['2026-10-07', '2026-10-09']);
  assert.deepEqual(schedule.windowAfterDone(task, d('2026-10-03')), ['2026-10-09', '2026-10-11']);
});

test('Täglicher Rhythmus springt auf den nächsten Tag', () => {
  const task = { recurrence: 'rhythm', rhythm_days: 1, buffer_days: 1 };
  assert.deepEqual(schedule.windowAfterDone(task, d('2026-10-01')), ['2026-10-02', '2026-10-02']);
});

test('Fester Zeitraum: aktueller oder nächster Zeitraum, auch über den Jahreswechsel', () => {
  assert.deepEqual(schedule.initialWindow({ recurrence: 'period', period_start: '03-01', period_end: '09-30' }, null, d('2026-05-10')),
    ['2026-03-01', '2026-09-30']);
  assert.deepEqual(schedule.initialWindow({ recurrence: 'period', period_start: '03-01', period_end: '09-30' }, null, d('2026-10-20')),
    ['2027-03-01', '2027-09-30']);
  assert.deepEqual(schedule.initialWindow({ recurrence: 'period', period_start: '11-01', period_end: '02-29' }, null, d('2027-01-15')),
    ['2026-11-01', '2027-02-28']);
});

test('Status mit Deadline-Uhrzeit', () => {
  const task = { recurrence: 'rhythm', kind: 'todo', window_start: '2026-10-20', window_end: '2026-10-20', deadline_time: '06:00', on_missed: 'expire' };
  assert.equal(schedule.status(task, new Date('2026-10-20T05:59:00')), 'due');
  assert.equal(schedule.status(task, new Date('2026-10-20T06:00:00')), 'expired');
  assert.equal(schedule.status({ ...task, on_missed: 'remind' }, new Date('2026-10-21T10:00:00')), 'overdue');
  assert.equal(schedule.status(task, new Date('2026-10-19T10:00:00')), 'upcoming');
});

test('Verfallene Aufgabe rückt ins nächste offene Fenster', () => {
  const task = { recurrence: 'rhythm', rhythm_days: 14, buffer_days: 1, window_start: '2026-10-01', window_end: '2026-10-01' };
  assert.deepEqual(schedule.windowAfterMissed(task, d('2026-10-20')), ['2026-10-29', '2026-10-29']);
});

test('Store: Unteraufgaben, Routine abschließen setzt Schritte zurück, Löschen kaskadiert', () => {
  store.load(memory());
  const routine = store.createTask({ title: 'Morgenroutine kurz', kind: 'routine' });
  const step = store.createTask({ title: 'Zähne', parent_id: routine.id });
  const sub = store.createTask({ title: 'Zahnseide', parent_id: step.id, duration_min: 2 });
  store.createTask({ title: 'Kaffee', parent_id: routine.id, duration_min: 3 });

  assert.equal(store.routineMinutes(routine), 5);
  assert.equal(store.completeTask(sub.id).status, 'done');
  assert.equal(store.completeTask(routine.id).status, 'routine');
  assert.equal(store.taskById(sub.id).status, 'open');

  assert.throws(() => store.updateTask(routine.id, { title: 'x', parent_id: sub.id }), /unter sich selbst/);

  const event = store.createEvent({
    title: 'Arbeit', start_at: '2026-10-21T09:00', end_at: '2026-10-21T17:00',
    before_type: 'routine', before_routine_id: routine.id, before_minutes: 20,
  });
  store.deleteTask(routine.id);
  assert.equal(store.tasks().length, 0);
  assert.equal(store.eventsBetween(new Date(2026, 9, 21), new Date(2026, 9, 21))[0].before_type, 'none');
  assert.equal(event.start_at, '2026-10-21 09:00');
});

test('Store: Sicherung exportieren und wieder einlesen', () => {
  store.load(memory());
  store.createTopic({ name: 'Sport', color: '#16a34a' });
  const backup = store.exportJson();
  store.load(memory());
  assert.equal(store.topics().length, 0);
  store.importJson(backup);
  assert.equal(store.topics()[0].name, 'Sport');
  assert.throws(() => store.importJson('{"foo":1}'), /keine gültige Sicherung/);
});

test('Store: Rhythmus-Fenster, das beim Anlegen schon vorbei ist, rückt ohne Verpasst-Zählung weiter', () => {
  store.load(memory());
  const task = store.createTask({
    title: 'Müll', recurrence: 'rhythm', rhythm_days: 14, buffer_days: 1,
    window_start: '2020-01-01', deadline_time: '06:00', on_missed: 'expire',
  });
  assert.equal(task.missed_count, 0);
  assert.notEqual(task.status, 'expired');
});

test('Store: Routinen haben kein Fälligkeitsfenster, auch nicht ihre Schritte', () => {
  store.load(memory());
  const routine = store.createTask({ title: 'Abendroutine', kind: 'routine', recurrence: 'rhythm', rhythm_days: 1 });
  const step = store.createTask({ title: 'Lesen', parent_id: routine.id, recurrence: 'rhythm', rhythm_days: 2 });
  assert.equal(routine.recurrence, 'once');
  assert.equal(routine.window_start, null);
  assert.equal(store.taskById(step.id).recurrence, 'once');
});

test('Store: Wunschliste ist unabhängig von Aufgaben, am längsten nicht Gemachtes zuerst', () => {
  store.load(memory());
  const a = store.createWish({ title: 'Gitarre spielen' });
  const b = store.createWish({ title: 'Brot backen' });
  store.doneWish(b.id, new Date(2026, 0, 1));
  store.doneWish(a.id, new Date(2026, 5, 1));
  assert.deepEqual(store.wishes().map((w) => w.title), ['Brot backen', 'Gitarre spielen']);
  assert.equal(store.tasks().length, 0);
});

test('Beispieldaten lassen sich anlegen und enthalten alle Bereiche', () => {
  const hadData = store.load(memory());
  assert.equal(hadData, false);
  loadSamples(new Date(2026, 9, 20, 12));
  assert.ok(store.topics().length >= 4);
  assert.ok(store.routines().length >= 3);
  assert.ok(store.wishes().length >= 3);
  const statuses = new Set(store.tasks(new Date(2026, 9, 20, 12)).map((t) => t.status));
  for (const s of ['overdue', 'due', 'upcoming', 'routine']) assert.ok(statuses.has(s), s);
  assert.ok(store.eventsBetween(new Date(2026, 9, 19), new Date(2026, 9, 26)).some((e) => e.is_event));
});

test('Store: Daten der Zwischenversion (1 = sehr wichtig) werden auf 5 = sehr wichtig umgerechnet', () => {
  const old = memory();
  old.setItem('planungsapp.v1', JSON.stringify({
    nextId: 2, topics: [], events: [], wishes: [], log: [],
    tasks: [{ id: 1, parent_id: null, title: 'Alt', kind: 'todo', recurrence: 'once', importance: 1, urgency: 2, importance_emo: 5, urgency_emo: 3 }],
  }));
  store.load(old);
  const task = store.tasks()[0];
  assert.deepEqual([task.importance, task.urgency, task.importance_emo, task.urgency_emo], [5, 4, 1, 3]);
  store.load(old); // nach dem Speichern nicht noch einmal umrechnen
  assert.equal(store.tasks()[0].importance, 5);

  const first = memory(); // erste Version (ohne Wunschliste) hatte schon 5 = sehr wichtig
  first.setItem('planungsapp.v1', JSON.stringify({ nextId: 2, topics: [], events: [], log: [], tasks: [{ id: 1, parent_id: null, title: 'Uralt', kind: 'todo', recurrence: 'once', importance: 5, urgency: 5, importance_emo: 3, urgency_emo: 3 }] }));
  store.load(first);
  assert.equal(store.tasks()[0].importance, 5);
});

test('Store: Verlauf zeigt Erledigtes, Wieder-Öffnen entfernt den Eintrag', () => {
  store.load(memory());
  const routine = store.createTask({ title: 'Morgenroutine', kind: 'routine' });
  const step = store.createTask({ title: 'Kaffee', parent_id: routine.id });
  const todo = store.createTask({ title: 'Einkaufen' });
  const wish = store.createWish({ title: 'Museum' });
  store.completeTask(step.id, new Date(2026, 9, 20, 7, 0));
  store.completeTask(routine.id, new Date(2026, 9, 20, 7, 10));
  store.completeTask(todo.id, new Date(2026, 9, 20, 9, 0));
  store.doneWish(wish.id, new Date(2026, 9, 20, 18, 0));
  assert.deepEqual(store.history().map((e) => (e.task || e.wish).title), ['Museum', 'Einkaufen', 'Morgenroutine']);
  store.reopenTask(todo.id);
  assert.deepEqual(store.history().map((e) => (e.task || e.wish).title), ['Museum', 'Morgenroutine']);
});
