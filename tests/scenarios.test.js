// Szenario-Tests: typische Abläufe quer durch die App, wie man sie auf dem Handy durchspielt
// (anlegen, ändern, wieder zurückändern, löschen …). Ausführen: npm test

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';
import * as schedule from '../js/schedule.js';

const memory = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
const fresh = () => store.load(memory());

// Termintage einer Serie im Zeitraum als „MM-TT HH:MM“.
const days = (from, to, title) => store.eventsBetween(from, to)
  .filter((e) => e.title === title && e.start_at >= isoDay(from) && e.start_at.slice(0, 10) <= isoDay(to))
  .map((e) => e.start_at.slice(5, 16));
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const occ = (title, day) => store.eventsBetween(new Date(`${day}T00:00`), new Date(`${day}T00:00`))
  .find((e) => e.title.startsWith(title) && e.start_at.startsWith(day));
const weekly = (title = 'Kurs', start = '2026-10-05T18:00', extra = {}) => store.createEvent({
  title, start_at: start, end_at: start.replace('18:00', '19:00'), repeat: { freq: 'weekly', interval: 1, weekdays: [1] }, ...extra,
});
const OCT = [new Date(2026, 9, 1), new Date(2026, 10, 30)];

describe('Wiederkehrende Termine: Wiederholungsregeln', () => {
  test('monatlich am 31. lässt Monate ohne 31. aus', () => {
    fresh();
    store.createEvent({ title: 'Miete', start_at: '2026-01-31T09:00', end_at: '2026-01-31T09:30', repeat: { freq: 'monthly', interval: 1, monthly: 'day' } });
    assert.deepEqual(days(new Date(2026, 0, 1), new Date(2026, 5, 30), 'Miete').map((d) => d.slice(0, 5)), ['01-31', '03-31', '05-31']);
  });

  test('jährlich am 29. Februar nur in Schaltjahren', () => {
    fresh();
    store.createEvent({ title: 'Schalttag', start_at: '2024-02-29T00:00', end_at: '2024-02-29T23:59', all_day: true, repeat: { freq: 'yearly', interval: 1 } });
    const years = store.eventsBetween(new Date(2024, 0, 1), new Date(2032, 11, 31)).filter((e) => e.title === 'Schalttag').map((e) => e.start_at.slice(0, 4));
    assert.deepEqual(years, ['2024', '2028', '2032']);
  });

  test('am letzten Freitag im Monat', () => {
    fresh();
    store.createEvent({ title: 'Stammtisch', start_at: '2026-10-30T19:00', end_at: '2026-10-30T22:00', repeat: { freq: 'monthly', interval: 1, monthly: 'weekday', nth: -1 } });
    assert.deepEqual(days(new Date(2026, 9, 1), new Date(2027, 0, 31), 'Stammtisch').map((d) => d.slice(0, 5)), ['10-30', '11-27', '12-25', '01-29']);
  });

  test('alle 2 Wochen Di und Do', () => {
    fresh();
    store.createEvent({ title: 'Sport', start_at: '2026-10-06T18:00', end_at: '2026-10-06T19:00', repeat: { freq: 'weekly', interval: 2, weekdays: [2, 4] } });
    assert.deepEqual(days(new Date(2026, 9, 1), new Date(2026, 9, 31), 'Sport').map((d) => d.slice(0, 5)), ['10-06', '10-08', '10-20', '10-22']);
  });

  test('endet am Datum (inklusive) und nach n Terminen', () => {
    fresh();
    weekly('A', '2026-10-05T18:00', { repeat: { freq: 'weekly', interval: 1, weekdays: [1], until: '2026-10-19' } });
    weekly('B', '2026-10-05T18:00', { repeat: { freq: 'weekly', interval: 1, weekdays: [1], count: 2 } });
    assert.equal(days(...OCT, 'A').length, 3);
    assert.equal(days(...OCT, 'B').length, 2);
  });

  test('gelöschter Einzeltermin zählt bei „nach n Terminen“ mit (wie Google)', () => {
    fresh();
    const s = weekly('Kurs', '2026-10-05T18:00', { repeat: { freq: 'weekly', interval: 1, weekdays: [1], count: 3 } });
    store.deleteEvent(s.id, { scope: 'this', occurrence: '2026-10-12' });
    assert.deepEqual(days(...OCT, 'Kurs').map((d) => d.slice(0, 5)), ['10-05', '10-19']);
  });
});

describe('Wiederkehrende Termine: ändern und wieder zurückändern', () => {
  const update = (ev, changes, scope) => store.updateEvent(ev.id, { ...ev, ...changes }, { scope, occurrence: ev.occurrence });

  test('endet am … und danach wieder „endet nie“ (alle Termine)', () => {
    fresh();
    weekly();
    update(occ('Kurs', '2026-10-12'), { repeat: { freq: 'weekly', interval: 1, weekdays: [1], until: '2026-10-26' } }, 'all');
    assert.equal(days(...OCT, 'Kurs').length, 4);
    update(occ('Kurs', '2026-10-26'), { repeat: { freq: 'weekly', interval: 1, weekdays: [1] } }, 'all');
    assert.equal(days(...OCT, 'Kurs').length, 9);
  });

  test('endet nach 3 Terminen und danach wieder „endet nie“ (dieser und folgende)', () => {
    fresh();
    weekly();
    update(occ('Kurs', '2026-10-12'), { repeat: { freq: 'weekly', interval: 1, weekdays: [1], count: 3 } }, 'following');
    assert.deepEqual(days(...OCT, 'Kurs').map((d) => d.slice(0, 5)), ['10-05', '10-12', '10-19', '10-26']);
    update(occ('Kurs', '2026-10-26'), { repeat: { freq: 'weekly', interval: 1, weekdays: [1] } }, 'following');
    assert.equal(days(...OCT, 'Kurs').length, 9);
  });

  test('„dieser und folgende“ am ersten Termin = alle', () => {
    fresh();
    weekly();
    update(occ('Kurs', '2026-10-05'), { title: 'Kurs neu' }, 'following');
    assert.equal(days(...OCT, 'Kurs neu').length, 9);
    assert.equal(store.eventsBetween(...OCT).filter((e) => e.title === 'Kurs').length, 0);
  });

  test('Uhrzeit für alle ändern, an einem späteren Termin', () => {
    fresh();
    weekly();
    const o = occ('Kurs', '2026-10-19');
    update(o, { start_at: '2026-10-19 19:00', end_at: '2026-10-19 20:30' }, 'all');
    const all = store.eventsBetween(...OCT).filter((e) => e.title === 'Kurs');
    assert.ok(all.every((e) => e.start_at.endsWith('19:00') && e.end_at.endsWith('20:30')));
    assert.equal(all[0].start_at, '2026-10-05 19:00', 'Serienbeginn bleibt der 5.10.');
  });

  test('Wiederholung ausschalten (alle) lässt einen einzelnen Termin übrig', () => {
    fresh();
    weekly();
    update(occ('Kurs', '2026-10-19'), { repeat: null }, 'all');
    assert.deepEqual(days(...OCT, 'Kurs').map((d) => d.slice(0, 5)), ['10-19']);
  });

  test('Einzeländerung, dann „alle“ an einem anderen Termin: Einzeländerung bleibt erhalten', () => {
    fresh();
    weekly();
    update(occ('Kurs', '2026-10-12'), { title: 'Kurs (Ausfall-Ersatz)', start_at: '2026-10-13 18:00', end_at: '2026-10-13 19:00' }, 'this');
    update(occ('Kurs', '2026-10-19'), { start_at: '2026-10-19 17:00', end_at: '2026-10-19 18:00' }, 'all');
    assert.ok(occ('Kurs (Ausfall', '2026-10-13'), 'Einzeländerung noch da');
    assert.equal(occ('Kurs', '2026-10-26').start_at, '2026-10-26 17:00');
    assert.equal(store.eventsBetween(new Date(2026, 9, 12), new Date(2026, 9, 12)).filter((e) => e.start_at.startsWith('2026-10-12')).length, 0, '12.10. bleibt frei');
  });

  test('einzeln auf Dienstag verschoben, danach „dieser und folgende“: der Dienstag bleibt', () => {
    fresh();
    weekly();
    const moved = update(occ('Kurs', '2026-10-12'), { start_at: '2026-10-13 18:00', end_at: '2026-10-13 19:00' }, 'this');
    const o = occ('Kurs', '2026-10-13');
    assert.equal(o.id, moved.id);
    update(o, { title: 'Kurs B' }, 'following');
    assert.deepEqual(store.eventsBetween(new Date(2026, 9, 5), new Date(2026, 9, 23)).filter((e) => e.start_at <= '2026-10-25')
      .map((e) => `${e.start_at.slice(5, 10)} ${e.title}`), ['10-05 Kurs', '10-13 Kurs B', '10-19 Kurs B']);
  });

  test('Serie löschen (alle) löscht auch einzeln geänderte Termine', () => {
    fresh();
    weekly();
    update(occ('Kurs', '2026-10-12'), { title: 'Kurs extra' }, 'this');
    store.deleteEvent(occ('Kurs', '2026-10-19').id, { scope: 'all', occurrence: '2026-10-19' });
    assert.equal(store.eventsBetween(...OCT).length, 0);
  });

  test('ab einem Termin löschen (folgende) behält frühere Einzeländerungen', () => {
    fresh();
    weekly();
    update(occ('Kurs', '2026-10-12'), { title: 'Kurs früh' }, 'this');
    update(occ('Kurs', '2026-11-02'), { title: 'Kurs spät' }, 'this');
    const o = occ('Kurs', '2026-10-26');
    store.deleteEvent(o.id, { scope: 'following', occurrence: o.occurrence });
    assert.deepEqual(store.eventsBetween(...OCT).map((e) => `${e.start_at.slice(5, 10)} ${e.title}`), ['10-05 Kurs', '10-12 Kurs früh', '10-19 Kurs']);
  });

  test('Zeit für alle ändern verschiebt Ausnahmen mit (gelöschter Termin bleibt gelöscht)', () => {
    fresh();
    const s = weekly();
    store.deleteEvent(s.id, { scope: 'this', occurrence: '2026-10-12' });
    update(occ('Kurs', '2026-10-19'), { start_at: '2026-10-20 18:00', end_at: '2026-10-20 19:00', repeat: { freq: 'weekly', interval: 1, weekdays: [2] } }, 'all');
    assert.deepEqual(days(new Date(2026, 9, 1), new Date(2026, 9, 31), 'Kurs').map((d) => d.slice(0, 5)), ['10-06', '10-20', '10-27']);
  });
});

describe('Ganztägig, Geburtstage, Veranstaltungen', () => {
  test('ganztägig über mehrere Tage, zurück auf Uhrzeit', () => {
    fresh();
    const ev = store.createEvent({ title: 'Urlaub', all_day: true, start_at: '2026-11-02T00:00', end_at: '2026-11-06T00:00' });
    assert.equal(ev.end_at, '2026-11-06 23:59');
    const back = store.updateEvent(ev.id, { ...ev, all_day: false, start_at: '2026-11-02T09:00', end_at: '2026-11-02T10:00' });
    assert.equal(back.all_day, false);
    assert.equal(back.start_at, '2026-11-02 09:00');
  });

  test('Thema von Geburtstag auf anderes Thema: wieder normaler Termin ohne jährliche Wiederholung erzwungen', () => {
    fresh();
    const b = store.createEvent({ title: 'Anna', topic_id: store.birthdayTopic().id, start_at: '2026-03-05T00:00', end_at: '2026-03-05T00:00' });
    assert.equal(b.repeat.freq, 'yearly');
    const normal = store.updateEvent(b.id, { ...b, topic_id: '', repeat: null, all_day: false, start_at: '2026-03-05T10:00', end_at: '2026-03-05T11:00' });
    assert.equal(normal.is_birthday, false);
    assert.equal(normal.repeat, null);
    assert.equal(normal.birth_year, null);
  });

  test('Veranstaltung ⇄ anderes Thema', () => {
    fresh();
    const ev = store.createEvent({ title: 'Konzert', topic_id: store.eventTopic().id, start_at: '2026-11-06T20:00', end_at: '2026-11-06T22:00' });
    assert.equal(ev.is_event, true);
    assert.equal(store.updateEvent(ev.id, { ...ev, topic_id: '' }).is_event, false);
  });
});

describe('Aufgaben: einmalig, Unteraufgaben, Erledigen', () => {
  test('Oberaufgabe abhaken, wieder öffnen, Unteraufgabe einzeln wieder öffnen', () => {
    fresh();
    const p = store.createTask({ title: 'Umzug' });
    const a = store.createTask({ title: 'Kisten', parent_id: p.id });
    store.completeTask(p.id, new Date(2026, 9, 20, 10));
    store.reopenTask(a.id);
    assert.equal(store.taskById(a.id).done_at, null);
    assert.ok(store.taskById(p.id).done_at, 'Oberaufgabe bleibt erledigt');
    store.reopenTask(p.id);
    assert.equal(store.taskById(p.id).done_at, null);
  });

  test('Verlauf: Erledigen und Wiederöffnen hinterlassen keine Leichen', () => {
    fresh();
    const t = store.createTask({ title: 'Brief' });
    store.completeTask(t.id);
    store.reopenTask(t.id);
    store.completeTask(t.id);
    assert.equal(store.history().filter((h) => h.task?.id === t.id).length, 1);
  });

  test('wiederkehrende Aufgabe mit Unteraufgaben: Erledigen setzt Unteraufgaben zurück', () => {
    fresh();
    const t = store.createTask({ title: 'Wohnung putzen', recurrence: 'rhythm', window_start: '2099-01-05', buffer: 1, repeat: { freq: 'weekly', interval: 1 } });
    const sub = store.createTask({ title: 'Bad', parent_id: t.id });
    store.completeTask(sub.id);
    store.completeTask(t.id, new Date(2099, 0, 5, 10));
    assert.equal(store.taskById(sub.id).done_at, null);
    assert.equal(store.taskById(t.id).window_start, '2099-01-11');
  });

  test('von einmalig auf regelmäßig und zurück', () => {
    fresh();
    const t = store.createTask({ title: 'Gießen', window_end: '2099-01-10' });
    const r = store.updateTask(t.id, { ...t, recurrence: 'rhythm', window_start: '2099-01-05', buffer: 0, repeat: { freq: 'daily', interval: 2 } });
    assert.equal(r.window_start, '2099-01-05');
    assert.equal(r.repeat.interval, 2);
    const o = store.updateTask(t.id, { ...r, recurrence: 'once', window_start: '', window_end: '2099-02-01', repeat: null });
    assert.equal(o.repeat, null);
    assert.equal(o.buffer, null);
    assert.equal(o.window_end, '2099-02-01');
    assert.equal(o.window_start, null);
  });

  test('Einmalige Aufgabe ohne Deadline erscheint nicht im Kalender, mit Deadline genau einmal', () => {
    fresh();
    store.createTask({ title: 'Ohne' });
    store.createTask({ title: 'Mit', window_end: '2099-03-03' });
    const list = store.deadlinesBetween(new Date(2099, 0, 1), new Date(2099, 11, 31));
    assert.deepEqual(list.map((t) => `${t.title} ${t.deadline_date}`), ['Mit 2099-03-03']);
  });
});

describe('Regelmäßige Aufgaben: verpasst, verfallen, Puffer', () => {
  const now = new Date(2026, 9, 20, 12);

  test('verfällt: mehrere verpasste Durchgänge werden alle gezählt', () => {
    fresh();
    const t = store.createTask({
      title: 'Müll', recurrence: 'rhythm', window_start: '2099-01-02', buffer: 0, on_missed: 'expire',
      repeat: { freq: 'weekly', interval: 1 },
    });
    // drei Wochen lang die App nicht geöffnet
    store.rollExpired(new Date(2099, 0, 22, 12));
    const after = store.taskById(t.id);
    assert.equal(after.window_start, '2099-01-23');
    assert.equal(after.missed_count, 3, '2.1., 9.1. und 16.1. verpasst');
  });

  test('täglich erinnern: bleibt überfällig, nach dem Erledigen nächster Termintag', () => {
    const t = { recurrence: 'rhythm', repeat: { freq: 'weekly', interval: 1, weekdays: [1] }, repeat_start: '2026-10-05', buffer: 0, on_missed: 'remind', window_start: '2026-10-05', window_end: '2026-10-05' };
    assert.equal(schedule.status(t, now), 'overdue');
    assert.deepEqual(schedule.windowAfterDone(t, now), ['2026-10-26', '2026-10-26']);
  });

  test('früh erledigt (noch nicht fällig): zählt für den kommenden Durchgang', () => {
    const t = { recurrence: 'rhythm', repeat: { freq: 'weekly', interval: 1, weekdays: [5] }, repeat_start: '2026-10-23', buffer: 1, window_start: '2026-10-22', window_end: '2026-10-24' };
    assert.equal(schedule.status(t, now), 'upcoming');
    assert.deepEqual(schedule.windowAfterDone(t, now), ['2026-10-29', '2026-10-31']);
  });

  test('Puffer 0 mit Uhrzeit: bis zur Uhrzeit fällig, danach überfällig', () => {
    const t = { recurrence: 'rhythm', window_start: '2026-10-20', window_end: '2026-10-20', deadline_time: '18:00', on_missed: 'remind' };
    assert.equal(schedule.status(t, new Date(2026, 9, 20, 17, 59)), 'due');
    assert.equal(schedule.status(t, new Date(2026, 9, 20, 18, 0)), 'overdue');
  });

  test('Zeitraum: im Zeitraum erledigt → nächstes Jahr; vor dem Zeitraum erledigt → auch nächstes Jahr', () => {
    const t = { recurrence: 'period', period_start: '03-01', period_end: '05-31', window_start: '2027-03-01', window_end: '2027-05-31' };
    assert.deepEqual(schedule.windowAfterDone(t, new Date(2027, 3, 1)), ['2028-03-01', '2028-05-31']);
    assert.deepEqual(schedule.windowAfterDone(t, new Date(2027, 0, 15)), ['2028-03-01', '2028-05-31']);
  });

  test('Bearbeiten ohne Änderung verschiebt nichts (auch mit Puffer)', () => {
    fresh();
    const t = store.createTask({ title: 'Gießen', recurrence: 'rhythm', window_start: '2099-01-07', buffer: 2, repeat: { freq: 'weekly', interval: 1 } });
    const again = store.updateTask(t.id, { ...t, window_start: '2099-01-07' });
    assert.deepEqual([again.window_start, again.window_end], [t.window_start, t.window_end]);
  });
});

describe('Routinen', () => {
  test('starten, Schritte abhaken, abbrechen, erneut starten', () => {
    fresh();
    const r = store.createTask({ title: 'Morgen', kind: 'routine' });
    const a = store.createTask({ title: 'Zähne', parent_id: r.id });
    store.startRoutine(r.id);
    store.completeTask(a.id);
    store.cancelRoutine(r.id);
    assert.equal(store.activeRoutine(), null);
    assert.equal(store.taskById(a.id).done_at, null);
    store.startRoutine(r.id);
    assert.equal(store.activeRoutine().routine.id, r.id);
  });

  test('Routine löschen: läuft nicht mehr, Termin bleibt ohne Routine', () => {
    fresh();
    const r = store.createTask({ title: 'Abend', kind: 'routine' });
    const ev = store.createEvent({ routine_id: r.id, start_at: '2099-01-01T21:00', end_at: '2099-01-01T21:30' });
    store.startRoutine(r.id);
    store.deleteTask(r.id);
    assert.equal(store.activeRoutine(), null);
    assert.equal(store.eventById(ev.id).routine_id, null);
  });

  test('Schritte einer Routine erscheinen nie als Deadline oder überfällig', () => {
    fresh();
    const r = store.createTask({ title: 'Abend', kind: 'routine' });
    const s = store.createTask({ title: 'Lesen', parent_id: r.id, window_end: '2000-01-01' });
    assert.equal(store.taskById(s.id).window_end, null);
    assert.equal(store.deadlinesBetween(new Date(1999, 0, 1), new Date(2100, 0, 1)).length, 0);
  });
});

describe('Themen, Sicherung, Laden', () => {
  test('Thema löschen: Aufgaben, Termine und Wünsche behalten ihre Daten ohne Thema', () => {
    fresh();
    const t = store.createTopic({ name: 'Sport', color: '#4f8a7b' });
    const task = store.createTask({ title: 'Laufen', topic_id: t.id });
    const ev = store.createEvent({ title: 'Lauftreff', topic_id: t.id, start_at: '2099-01-01T18:00', end_at: '2099-01-01T19:00' });
    const wish = store.createWish({ title: 'Klettern', topic_id: t.id });
    store.deleteTopic(t.id);
    assert.equal(store.taskById(task.id).topic_id, null);
    assert.equal(store.eventById(ev.id).topic_id, null);
    assert.equal(store.wishes().find((w) => w.id === wish.id).topic_id, null);
  });

  test('Sicherung: zweimal einlesen erzeugt keine doppelten festen Themen', () => {
    fresh();
    const backup = store.exportJson();
    store.importJson(backup);
    store.importJson(store.exportJson());
    assert.equal(store.topics().filter((t) => t.birthday).length, 1);
    assert.equal(store.topics().filter((t) => t.events).length, 1);
  });

  test('IDs bleiben nach dem Einlesen eindeutig', () => {
    fresh();
    store.createTask({ title: 'A' });
    const backup = store.exportJson();
    fresh();
    store.importJson(backup);
    const b = store.createTask({ title: 'B' });
    const ids = [...store.tasks().map((t) => t.id), ...store.topics().map((t) => t.id)];
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(b.id > Math.max(...store.topics().map((t) => t.id)));
  });

  test('Neustart: Daten bleiben gespeichert (Laden aus dem Speicher)', () => {
    const mem = memory();
    store.load(mem);
    store.createTask({ title: 'Bleibt' });
    store.load(mem);
    assert.ok(store.tasks().some((t) => t.title === 'Bleibt'));
  });
});
