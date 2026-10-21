// Tests für Fälligkeitslogik und Datenhaltung. Ausführen: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as schedule from '../js/schedule.js';
import * as store from '../js/store.js';
import { loadSamples } from '../js/samples.js';
import * as repeating from '../js/repeat.js';
import { stamp } from '../js/dates.js';

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

test('Wiederholung: wöchentlich an mehreren Tagen, alle 2 Wochen, Ende nach Anzahl und Datum', () => {
  const ev = { start_at: '2026-10-20 18:00', end_at: '2026-10-20 19:00' }; // Dienstag
  const days = (repeat, to = new Date(2026, 11, 31)) =>
    repeating.occurrences({ ...ev, repeat }, new Date(2026, 9, 1), to).map((o) => o.occurrence);
  assert.deepEqual(days({ freq: 'weekly', interval: 1, weekdays: [2, 4], count: 4 }), ['2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29']);
  assert.deepEqual(days({ freq: 'weekly', interval: 2, until: '2026-11-17' }), ['2026-10-20', '2026-11-03', '2026-11-17']);
  assert.deepEqual(days({ freq: 'daily', interval: 3, count: 3 }), ['2026-10-20', '2026-10-23', '2026-10-26']);
  assert.deepEqual(days({ freq: 'monthly', monthly: 'weekday', nth: 3, count: 3 }), ['2026-10-20', '2026-11-17', '2026-12-15']);
  assert.deepEqual(days({ freq: 'monthly', monthly: 'weekday', nth: -1, count: 2 }, new Date(2027, 1, 1)), ['2026-10-27', '2026-11-24']);
  assert.equal(repeating.repeatText({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }, ev.start_at), 'Wöchentlich am Mo–Fr');
  const keys = repeating.presets(ev.start_at).map((p) => p.label);
  assert.ok(keys.includes('Wöchentlich am Dienstag') && keys.includes('Monatlich am dritten Dienstag'));
});

test('Store: Serien – nur dieser, dieser und folgende, alle Termine', () => {
  store.load(memory());
  const range = [new Date(2026, 9, 1), new Date(2026, 11, 31)];
  const titles = () => store.eventsBetween(...range).map((e) => `${e.start_at.slice(5)} ${e.title}`);
  const yoga = store.createEvent({
    title: 'Yoga', start_at: '2026-10-20T18:00', end_at: '2026-10-20T19:00', repeat: { freq: 'weekly', interval: 1, count: 4 },
  });
  assert.equal(store.eventsBetween(...range).length, 4);

  // Nur dieser: 27.10. auf 19 Uhr verschieben
  store.updateEvent(yoga.id, { title: 'Yoga', start_at: '2026-10-27T19:00', end_at: '2026-10-27T20:00' }, { scope: 'this', occurrence: '2026-10-27' });
  assert.deepEqual(titles(), ['10-20 18:00 Yoga', '10-27 19:00 Yoga', '11-03 18:00 Yoga', '11-10 18:00 Yoga']);

  // Dieser und alle folgenden: ab 03.11. heißt es "Pilates"
  store.updateEvent(yoga.id, {
    title: 'Pilates', start_at: '2026-11-03T18:00', end_at: '2026-11-03T19:00', repeat: { freq: 'weekly', interval: 1, count: 4 },
  }, { scope: 'following', occurrence: '2026-11-03' });
  assert.deepEqual(titles(), ['10-20 18:00 Yoga', '10-27 19:00 Yoga', '11-03 18:00 Pilates', '11-10 18:00 Pilates']);

  // Alle: Uhrzeit der ersten Serie um eine Stunde verschieben
  store.updateEvent(yoga.id, {
    title: 'Yoga', start_at: '2026-10-20T17:00', end_at: '2026-10-20T18:00', repeat: { freq: 'weekly', interval: 1 },
  }, { scope: 'all', occurrence: '2026-10-20' });
  assert.equal(titles()[0], '10-20 17:00 Yoga');

  // Löschen: nur dieser Termin
  store.deleteEvent(yoga.id, { scope: 'this', occurrence: '2026-10-20' });
  assert.ok(!titles().includes('10-20 17:00 Yoga'));
  assert.throws(() => store.createEvent({ title: 'x', start_at: '2026-10-20T10:00', end_at: '2026-10-20T11:00', repeat: { freq: 'daily', until: '2026-10-01' } }), /Ende der Wiederholung/);
});

test('Store: Reihenfolge von Unteraufgaben ändern, neue kommen ans Ende', () => {
  store.load(memory());
  const parent = store.createTask({ title: 'Umzug' });
  const [a, b, c] = ['A', 'B', 'C'].map((title) => store.createTask({ title, parent_id: parent.id }).id);
  store.reorderChildren(parent.id, [c, a, b]);
  assert.deepEqual(store.childrenOf(parent.id).map((t) => t.title), ['C', 'A', 'B']);
  store.createTask({ title: 'D', parent_id: parent.id });
  store.reorderChildren(parent.id, [a, c]); // nur sichtbare genannt – Rest bleibt dahinter
  assert.deepEqual(store.childrenOf(parent.id).map((t) => t.title), ['A', 'C', 'B', 'D']);
});

test('Store: neues Thema einer Routine gilt für alle Schritte', () => {
  store.load(memory());
  const sport = store.createTopic({ name: 'Sport' });
  const arbeit = store.createTopic({ name: 'Arbeit' });
  const routine = store.createTask({ title: 'Morgen', kind: 'routine', topic_id: sport.id });
  const step = store.createTask({ title: 'Dehnen', parent_id: routine.id, topic_id: sport.id });
  const sub = store.createTask({ title: 'Beine', parent_id: step.id });
  const other = store.createTask({ title: 'Einkaufen', topic_id: sport.id });
  store.updateTask(routine.id, { title: 'Morgen', kind: 'routine', topic_id: arbeit.id });
  assert.equal(store.taskById(step.id).topic_id, arbeit.id);
  assert.equal(store.taskById(sub.id).topic_id, arbeit.id);
  assert.equal(store.taskById(other.id).topic_id, sport.id);
});

test('Store: Routine im Kalender einplanen (Titel/Thema von der Routine, Löschen der Routine lässt Termin stehen)', () => {
  store.load(memory());
  const topic = store.createTopic({ name: 'Sport' });
  const routine = store.createTask({ title: 'Sportroutine', kind: 'routine', topic_id: topic.id });
  const ev = store.createEvent({ routine_id: routine.id, start_at: '2026-10-21T07:00', end_at: '2026-10-21T07:45' });
  assert.equal(ev.title, 'Sportroutine');
  assert.equal(ev.topic_id, topic.id);
  assert.throws(() => store.createEvent({ routine_id: 9999, start_at: '2026-10-21T07:00', end_at: '2026-10-21T07:45' }), /Routine nicht gefunden/);
  store.deleteTask(routine.id);
  assert.equal(store.eventById(ev.id).routine_id, null);
});

test('Store: Routinen werden um 4:30 des Folgetages zurückgesetzt', () => {
  store.load(memory());
  const routine = store.createTask({ title: 'Abendroutine', kind: 'routine' });
  const step = store.createTask({ title: 'Lesen', parent_id: routine.id });
  store.rollExpired(new Date(2026, 9, 20, 21, 0)); // merkt sich den Tag
  store.completeTask(step.id, new Date(2026, 9, 20, 22, 0));
  store.rollExpired(new Date(2026, 9, 21, 4, 29)); // noch derselbe App-Tag
  assert.ok(store.taskById(step.id).done_at);
  store.rollExpired(new Date(2026, 9, 21, 4, 30));
  assert.equal(store.taskById(step.id).done_at, null);
  assert.equal(stamp(store.dayStart(new Date(2026, 9, 21, 3, 0))), '2026-10-20 04:30');
});

test('Store: Standardstartzeit nur für Routinen, Dauer über eine Stunde', () => {
  store.load(memory());
  const routine = store.createTask({ title: 'Abendroutine', kind: 'routine', default_time: '21:30', duration_min: 90 });
  assert.equal(routine.default_time, '21:30');
  assert.equal(routine.duration_min, 90);
  const step = store.createTask({ title: 'Lesen', parent_id: routine.id, default_time: '22:00' });
  assert.equal(step.default_time, null);
  const todo = store.createTask({ title: 'Einkaufen', default_time: '10:00' });
  assert.equal(todo.default_time, null);
  assert.throws(() => store.createTask({ title: 'x', kind: 'routine', default_time: '9 Uhr' }), /Standardstartzeit/);
});

test('Store: Oberaufgabe abhaken erledigt alle Unteraufgaben; Wiederöffnen nimmt sie mit', () => {
  store.load(memory());
  const parent = store.createTask({ title: 'Umzug' });
  const sub = store.createTask({ title: 'Kisten', parent_id: parent.id });
  const subsub = store.createTask({ title: 'Kisten kaufen', parent_id: sub.id });
  const earlier = store.createTask({ title: 'Wohnung suchen', parent_id: parent.id });
  store.completeTask(earlier.id, new Date(2026, 9, 19, 10, 0));
  store.completeTask(parent.id, new Date(2026, 9, 20, 10, 0));
  for (const t of [parent, sub, subsub, earlier]) assert.ok(store.taskById(t.id).done_at);
  assert.equal(store.taskById(earlier.id).done_at, '2026-10-19 10:00');
  store.reopenTask(parent.id);
  assert.equal(store.taskById(sub.id).done_at, null);
  assert.equal(store.taskById(subsub.id).done_at, null);
  assert.ok(store.taskById(earlier.id).done_at, 'schon vorher Erledigtes bleibt erledigt');
});

test('Store: laufende Routine starten, abschließen und abbrechen', () => {
  store.load(memory());
  const routine = store.createTask({ title: 'Morgenroutine', kind: 'routine' });
  const step = store.createTask({ title: 'Zähne', parent_id: routine.id });
  assert.equal(store.activeRoutine(), null);
  store.startRoutine(routine.id, new Date(2026, 9, 20, 7, 0));
  assert.equal(store.activeRoutine().routine.id, routine.id);
  assert.equal(store.activeRoutine().startedAt, '2026-10-20 07:00');
  store.completeTask(step.id);
  store.cancelRoutine(routine.id);
  assert.equal(store.activeRoutine(), null);
  assert.equal(store.taskById(step.id).done_at, null);
  store.startRoutine(routine.id);
  store.completeTask(routine.id);
  assert.equal(store.activeRoutine(), null);
});

test('Store: Ebene ändern – einrücken unter den Vorgänger, ausrücken hinter die Oberaufgabe', () => {
  store.load(memory());
  const parent = store.createTask({ title: 'Umzug' });
  const a = store.createTask({ title: 'Kisten', parent_id: parent.id });
  const b = store.createTask({ title: 'Kisten kaufen', parent_id: parent.id });
  const c = store.createTask({ title: 'Packen', parent_id: parent.id });
  assert.throws(() => store.indentTask(a.id), /Darüber/);
  store.indentTask(b.id);
  assert.equal(store.taskById(b.id).parent_id, a.id);
  assert.deepEqual(store.childrenOf(parent.id).map((t) => t.title), ['Kisten', 'Packen']);
  store.outdentTask(b.id);
  assert.deepEqual(store.childrenOf(parent.id).map((t) => t.title), ['Kisten', 'Kisten kaufen', 'Packen']);
  store.outdentTask(c.id);
  assert.equal(store.taskById(c.id).parent_id, null);
  const routine = store.createTask({ title: 'Morgenroutine', kind: 'routine' });
  const step = store.createTask({ title: 'Zähne', parent_id: routine.id });
  assert.throws(() => store.outdentTask(step.id), /Routine/);
});

test('Store: ganztägige Termine – nur Datum, ohne Bereiche davor/danach', () => {
  store.load(memory());
  const ev = store.createEvent({
    title: 'Urlaub', all_day: true, start_at: '2026-10-22T09:00', end_at: '2026-10-24T10:00',
    before_type: 'free', before_minutes: 30,
  });
  assert.equal(ev.all_day, true);
  assert.equal(ev.start_at, '2026-10-22 00:00');
  assert.equal(ev.end_at, '2026-10-24 23:59');
  assert.equal(ev.before_type, 'none');
  const timed = store.createEvent({ title: 'Arzt', start_at: '2026-10-22T09:00', end_at: '2026-10-22T10:00' });
  assert.equal(timed.all_day, false);
});

test('Store: Geburtstage – ganztägig, jedes Jahr, optional mit Geburtsjahr', () => {
  store.load(memory());
  const ev = store.createEvent({
    title: 'Anna', is_birthday: true, start_at: '2026-03-05T14:00', end_at: '2026-03-07T10:00', birth_year: '1990',
    repeat: { freq: 'weekly', interval: 2 },
  });
  assert.equal(ev.all_day, true);
  assert.equal(ev.start_at, '2026-03-05 00:00');
  assert.equal(ev.end_at, '2026-03-05 23:59');
  assert.equal(ev.repeat.freq, 'yearly');
  assert.equal(ev.birth_year, 1990);
  const next = store.eventsBetween(new Date(2028, 2, 1), new Date(2028, 2, 31)).filter((e) => e.title === 'Anna');
  assert.deepEqual(next.map((e) => e.start_at), ['2028-03-05 00:00']);
  assert.throws(() => store.createEvent({ title: 'X', is_birthday: true, start_at: '2026-03-05T00:00', end_at: '2026-03-05T00:00', birth_year: '2030' }), /Geburtsjahr/);
});
