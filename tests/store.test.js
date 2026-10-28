// Datenhaltung (store.js): Eingabeprüfung, Themen, Wunschliste, Aufgabenbaum, Termine, Steigerungen, Sicherung.
// Ausführen: npm test

// Deutsche Zeit (mit Sommer-/Winterzeit), egal wo die Tests laufen.
process.env.TZ = 'Europe/Berlin';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/store.js';

const memory = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
const fresh = () => store.load(memory());
const titles = (list) => list.map((t) => t.title);
const kids = (id) => titles(store.childrenOf(id));
const weeklyTask = (extra = {}) => store.createTask({
  title: 'Bad putzen', recurrence: 'rhythm', window_start: '2099-01-05', buffer: 0, repeat: { freq: 'weekly', interval: 1 }, ...extra,
});
const eventAt = (day, extra = {}) => store.createEvent({ title: 'Termin', start_at: `${day}T10:00`, end_at: `${day}T11:00`, ...extra });
// Termine, die die Tage from–to (inklusive) berühren. eventsBetween liefert absichtlich etwas Rand mit
// (ein Tag davor, zwei danach); der Kalender filtert selbst – hier genauso.
const visibleOn = (from, to) => store.eventsBetween(new Date(`${from}T00:00`), new Date(`${to}T00:00`))
  .filter((e) => e.end_at.slice(0, 10) >= from && e.start_at.slice(0, 10) <= to);
const titlesOn = (from, to) => visibleOn(from, to).map((e) => `${e.start_at.slice(5, 10)} ${e.title}`);

describe('Eingabeprüfung Aufgaben', () => {
  test('Titel ist Pflicht, wird getrimmt und ist begrenzt', () => {
    fresh();
    assert.throws(() => store.createTask({ title: '   ' }), /Titel/);
    assert.throws(() => store.createTask({ title: 'x'.repeat(201) }), /zu lang/);
    assert.equal(store.createTask({ title: '  Einkaufen  ' }).title, 'Einkaufen');
  });

  test('Wichtigkeit/Dringlichkeit 1–5, Standard 3', () => {
    fresh();
    assert.throws(() => store.createTask({ title: 'x', importance: 6 }), /zwischen 1 und 5/);
    assert.throws(() => store.createTask({ title: 'x', urgency: 0 }), /zwischen 1 und 5/);
    assert.throws(() => store.createTask({ title: 'x', importance: 2.5 }), /zwischen 1 und 5/);
    const t = store.createTask({ title: 'x' });
    assert.deepEqual([t.importance, t.urgency, t.importance_emo, t.urgency_emo], [3, 3, 3, 3]);
  });

  test('ungültige Auswahlwerte werden abgelehnt', () => {
    fresh();
    assert.throws(() => store.createTask({ title: 'x', recurrence: 'manchmal' }), /Ungültiger Wert/);
    assert.throws(() => store.createTask({ title: 'x', kind: 'idee' }), /Ungültiger Wert/);
    assert.throws(() => store.createTask({ title: 'x', on_missed: 'egal' }), /Ungültiger Wert/);
    assert.throws(() => store.createTask({ title: 'x', kind: 'routine', routine_type: 'woechentlich' }), /Ungültiger Wert/);
  });

  test('Datumsformate werden geprüft; Ende vor Beginn geht nicht', () => {
    fresh();
    assert.throws(() => store.createTask({ title: 'x', window_end: '31.12.2099' }), /ungültiges Format/);
    assert.throws(() => store.createTask({ title: 'x', deadline_time: '25 Uhr' }), /ungültiges Format/);
    assert.throws(() => store.createTask({ title: 'x', window_start: '2099-03-05', window_end: '2099-03-01' }), /vor dem Beginn/);
  });

  test('Zeitraum braucht gültigen Beginn und Ende; 29.02. ist erlaubt, 31.04. nicht', () => {
    fresh();
    assert.throws(() => store.createTask({ title: 'x', recurrence: 'period' }), /Beginn und Ende/);
    assert.throws(() => store.createTask({ title: 'x', recurrence: 'period', period_start: '04-31', period_end: '05-10' }), /kein gültiges Datum/);
    assert.throws(() => store.createTask({ title: 'x', recurrence: 'period', period_start: '13-01', period_end: '05-10' }), /kein gültiges Datum/);
    assert.equal(store.createTask({ title: 'x', recurrence: 'period', period_start: '02-29', period_end: '03-10' }).period_start, '02-29');
  });

  test('regelmäßig in alter Form braucht „alle n Tage“; Puffer 0–365', () => {
    fresh();
    assert.throws(() => store.createTask({ title: 'x', recurrence: 'rhythm' }), /wie oft/);
    assert.throws(() => weeklyTask({ buffer: 400 }), /zwischen 0 und 365/);
  });

  test('Wiederholung: Intervall 1–999, Häufigkeit muss bekannt sein', () => {
    fresh();
    assert.throws(() => weeklyTask({ repeat: { freq: 'weekly', interval: 0 } }), /zwischen 1 und 999/);
    assert.throws(() => weeklyTask({ repeat: { freq: 'stündlich', interval: 1 } }), /Ungültiger Wert/);
  });

  test('regelmäßige Aufgabe: Wiederholung endet nie (Ende wird ignoriert)', () => {
    fresh();
    const t = weeklyTask({ repeat: { freq: 'weekly', interval: 1, until: '2099-02-01', count: 3 } });
    assert.deepEqual([t.repeat.until, t.repeat.count], [null, null]);
  });

  test('Oberaufgabe muss existieren und darf nicht die Aufgabe selbst oder ihr Kind sein', () => {
    fresh();
    assert.throws(() => store.createTask({ title: 'x', parent_id: 999 }), /nicht gefunden/);
    const a = store.createTask({ title: 'A' });
    const b = store.createTask({ title: 'B', parent_id: a.id });
    assert.throws(() => store.updateTask(a.id, { ...a, parent_id: b.id }), /unter sich selbst/);
    assert.throws(() => store.updateTask(a.id, { ...a, parent_id: a.id }), /unter sich selbst/);
  });

  test('Dauer 1–1440 Minuten; Standardstartzeit nur bei eintägigen Routinen', () => {
    fresh();
    assert.throws(() => store.createTask({ title: 'x', duration_min: 2000 }), /Dauer/);
    assert.equal(store.createTask({ title: 'x', default_time: '07:00' }).default_time, null);
    assert.equal(store.createTask({ title: 'R', kind: 'routine', default_time: '07:00' }).default_time, '07:00');
  });

  test('unbekannte Aufgabe: Fehler beim Ändern, Erledigen, Ebene ändern', () => {
    fresh();
    assert.throws(() => store.updateTask(999, { title: 'x' }), /nicht gefunden/);
    assert.throws(() => store.completeTask(999), /nicht gefunden/);
    assert.throws(() => store.indentTask(999), /nicht gefunden/);
    assert.throws(() => store.outdentTask(999), /nicht gefunden/);
    assert.equal(store.taskById(999), null);
  });
});

describe('Themen', () => {
  test('Geburtstag und Veranstaltung gibt es immer; umbenennen geht, löschen nicht', () => {
    fresh();
    const b = store.birthdayTopic();
    const e = store.eventTopic();
    assert.ok(b && e);
    assert.equal(store.isFixedTopic(b), true);
    assert.throws(() => store.deleteTopic(b.id), /gibt es immer/);
    assert.throws(() => store.deleteTopic(e.id), /gibt es immer/);
    store.updateTopic(b.id, { name: 'Geburtstage', color: '#123456' });
    assert.equal(store.birthdayTopic().name, 'Geburtstage');
  });

  test('Name Pflicht, Farbe als #RRGGBB (sonst Standardfarbe), alphabetisch sortiert', () => {
    fresh();
    assert.throws(() => store.createTopic({ name: '' }), /Name/);
    assert.throws(() => store.createTopic({ name: 'X', color: 'rot' }), /ungültiges Format/);
    assert.equal(store.createTopic({ name: 'Zebra' }).color, '#9f1239');
    store.createTopic({ name: 'Arbeit', color: '#00ff00' });
    const names = store.topics().map((t) => t.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'de')));
  });

  test('Farbe eines Themas; ohne Thema grau', () => {
    fresh();
    const t = store.createTopic({ name: 'Sport', color: '#00aa00' });
    assert.equal(store.topicColor(t.id), '#00aa00');
    assert.equal(store.topicColor(null), '#94a3b8');
    assert.equal(store.topicColor(999), '#94a3b8');
  });

  test('unbekanntes Thema ändern → Fehler', () => {
    fresh();
    assert.throws(() => store.updateTopic(999, { name: 'x' }), /nicht gefunden/);
  });
});

describe('Wunschliste', () => {
  test('anlegen, ändern, gemacht, löschen (samt Verlauf)', () => {
    fresh();
    assert.throws(() => store.createWish({ title: '' }), /Titel/);
    const w = store.createWish({ title: 'Museum' });
    assert.equal(w.last_done_at, null);
    store.updateWish(w.id, { title: 'Kunstmuseum' });
    store.doneWish(w.id, new Date(2099, 0, 5, 14, 0));
    assert.equal(store.wishes()[0].last_done_at, '2099-01-05 14:00');
    assert.deepEqual(store.history().map((h) => h.wish?.title), ['Kunstmuseum']);
    store.deleteWish(w.id);
    assert.deepEqual([store.wishes().length, store.history().length], [0, 0]);
    assert.throws(() => store.updateWish(w.id, { title: 'x' }), /nicht gefunden/);
  });

  test('nie Gemachtes zuerst, dann am längsten her; bei Gleichstand alphabetisch', () => {
    fresh();
    const a = store.createWish({ title: 'B-Wunsch' });
    store.createWish({ title: 'A-Wunsch' });
    const c = store.createWish({ title: 'C-Wunsch' });
    store.doneWish(a.id, new Date(2099, 0, 10));
    store.doneWish(c.id, new Date(2099, 0, 5));
    assert.deepEqual(titles(store.wishes()), ['A-Wunsch', 'C-Wunsch', 'B-Wunsch']);
  });
});

describe('Aufgabenbaum', () => {
  test('Einrücken: die erste Aufgabe kann nicht, die zweite wird letzte Unteraufgabe der ersten', () => {
    fresh();
    const a = store.createTask({ title: 'A' });
    const b = store.createTask({ title: 'B' });
    store.createTask({ title: 'A1', parent_id: a.id });
    assert.throws(() => store.indentTask(a.id), /Darüber steht nichts/);
    store.indentTask(b.id);
    assert.deepEqual(kids(a.id), ['A1', 'B']);
  });

  test('Ausrücken: direkt hinter die bisherige Oberaufgabe; oberste Ebene und Routine-Schritte nicht', () => {
    fresh();
    const a = store.createTask({ title: 'A' });
    const a1 = store.createTask({ title: 'A1', parent_id: a.id });
    store.createTask({ title: 'C' });
    store.outdentTask(a1.id);
    assert.deepEqual(titles(store.childrenOf(null)), ['A', 'A1', 'C']);
    assert.throws(() => store.outdentTask(a.id), /obersten Ebene/);
    const r = store.createTask({ title: 'Morgen', kind: 'routine' });
    const s = store.createTask({ title: 'Zähne', parent_id: r.id });
    assert.equal(store.canOutdent(s), false);
    assert.throws(() => store.outdentTask(s.id), /Routine/);
  });

  test('Reihenfolge: genannte zuerst, nicht genannte dahinter; fremde IDs werden ignoriert', () => {
    fresh();
    const p = store.createTask({ title: 'P' });
    const ids = ['a', 'b', 'c', 'd'].map((t) => store.createTask({ title: t, parent_id: p.id }).id);
    const other = store.createTask({ title: 'fremd' });
    store.reorderChildren(p.id, [ids[2], other.id, ids[0]]);
    assert.deepEqual(kids(p.id), ['c', 'a', 'b', 'd']);
    assert.equal(store.taskById(other.id).parent_id, null);
  });

  test('Nachkommen beliebig tief; Löschen nimmt alle mit (auch Verlauf und Steigerungen)', () => {
    fresh();
    const a = weeklyTask({ title: 'A' });
    const b = store.createTask({ title: 'B', parent_id: a.id });
    const c = store.createTask({ title: 'C', parent_id: b.id });
    const u = store.createUpgrade({ upgrade_of: a.id, title: 'gründlich', upgrade_every: 2 });
    store.completeTask(c.id, new Date(2099, 0, 5));
    assert.deepEqual(titles(store.descendantsOf(a.id)), ['B', 'C']);
    store.deleteTask(a.id);
    assert.deepEqual([store.tasks().length, store.history().length, store.upgradeById(u.id)], [0, 0, null]);
  });

  test('Routine-Dauer = Summe der Schritte (eigene Dauer hat Vorrang)', () => {
    fresh();
    const r = store.createTask({ title: 'Morgen', kind: 'routine' });
    store.createTask({ title: 'a', parent_id: r.id, duration_min: 5 });
    const b = store.createTask({ title: 'b', parent_id: r.id });
    store.createTask({ title: 'b1', parent_id: b.id, duration_min: 10 });
    assert.equal(store.routineMinutes(store.taskById(r.id)), 15);
    store.updateTask(r.id, { ...store.taskById(r.id), duration_min: 30 });
    assert.equal(store.routineMinutes(store.taskById(r.id)), 30);
    assert.equal(store.routineMinutes(store.createTask({ title: 'leer', kind: 'routine' })), null);
  });

  test('Routinen: Art, Zugehörigkeit, eintägige Liste', () => {
    fresh();
    const day = store.createTask({ title: 'Morgen', kind: 'routine' });
    const multi = store.createTask({ title: 'Haushalt', kind: 'routine', routine_type: 'multi' });
    const step = store.createTask({ title: 'Zähne', parent_id: day.id });
    const job = store.createTask({ title: 'Bad', parent_id: multi.id });
    const sub = store.createTask({ title: 'Wanne', parent_id: job.id });
    assert.equal(store.routineOf(sub).id, multi.id);
    assert.equal(store.routineOf(store.createTask({ title: 'frei' })), null);
    assert.deepEqual([store.isInRoutine(day), store.isInRoutine(step), store.isInRoutine(job), store.isInRoutine(sub)], [true, true, false, false]);
    assert.deepEqual(titles(store.routines()).sort(), ['Haushalt', 'Morgen']);
    assert.deepEqual(titles(store.dayRoutines()), ['Morgen']);
  });

  test('Unterroutine (Routine in Routine) hat keine eigene Art', () => {
    fresh();
    const r = store.createTask({ title: 'Morgen', kind: 'routine' });
    const inner = store.createTask({ title: 'Bad', kind: 'routine', parent_id: r.id, routine_type: 'multi', default_time: '07:00' });
    assert.deepEqual([inner.routine_type, inner.default_time], [null, null]);
  });
});

describe('Erledigen und Wiederöffnen', () => {
  test('einmalig erledigen setzt done_at; nochmal wiederöffnen ist harmlos', () => {
    fresh();
    const t = store.createTask({ title: 'Brief' });
    store.completeTask(t.id, new Date(2099, 0, 5, 9, 0));
    assert.equal(store.taskById(t.id).status, 'done');
    store.reopenTask(t.id);
    store.reopenTask(t.id);
    assert.equal(store.taskById(t.id).status, 'open');
    assert.equal(store.history().length, 0);
  });

  test('Unteraufgabe, die schon vorher erledigt war, bleibt beim Wiederöffnen der Oberaufgabe erledigt', () => {
    fresh();
    const p = store.createTask({ title: 'P' });
    const early = store.createTask({ title: 'früh', parent_id: p.id });
    const late = store.createTask({ title: 'spät', parent_id: p.id });
    store.completeTask(early.id, new Date(2099, 0, 1, 9, 0));
    store.completeTask(p.id, new Date(2099, 0, 2, 9, 0));
    assert.equal(store.taskById(late.id).status, 'done');
    store.reopenTask(p.id);
    assert.deepEqual([store.taskById(early.id).status, store.taskById(late.id).status], ['done', 'open']);
  });

  test('regelmäßige Aufgabe: Verlauf wächst bei jedem Durchgang, zuletzt erledigt wird gemerkt', () => {
    fresh();
    const t = weeklyTask();
    store.completeTask(t.id, new Date(2099, 0, 5, 9, 0));
    store.completeTask(t.id, new Date(2099, 0, 12, 9, 0));
    assert.equal(store.history().length, 2);
    assert.equal(store.taskById(t.id).last_done_at, '2099-01-12 09:00');
    assert.equal(store.taskById(t.id).window_start, '2099-01-19');
  });
});

describe('Termine: Eingabe', () => {
  test('Titel, Beginn und Ende sind Pflicht; Ende nicht vor Beginn', () => {
    fresh();
    assert.throws(() => store.createEvent({ title: '', start_at: '2099-01-05T10:00', end_at: '2099-01-05T11:00' }), /Titel/);
    assert.throws(() => store.createEvent({ title: 'x', end_at: '2099-01-05T11:00' }), /Beginn/);
    assert.throws(() => store.createEvent({ title: 'x', start_at: '2099-01-05T10:00' }), /Ende/);
    assert.throws(() => store.createEvent({ title: 'x', start_at: '2099-01-05T10:00', end_at: '2099-01-05T09:00' }), /vor dem Beginn/);
    assert.equal(eventAt('2099-01-05').start_at, '2099-01-05 10:00', 'gespeichert mit Leerzeichen');
  });

  test('checkEvent prüft, ohne zu speichern', () => {
    fresh();
    assert.throws(() => store.checkEvent({ title: '' }), /Titel/);
    store.checkEvent({ title: 'ok', start_at: '2099-01-05T10:00', end_at: '2099-01-05T11:00' });
    assert.equal(store.eventsBetween(new Date(2099, 0, 1), new Date(2099, 1, 1)).length, 0);
  });

  test('Wiederholung: Ende vor dem ersten Termin geht nicht; Anzahl 1–999', () => {
    fresh();
    assert.throws(() => eventAt('2099-01-05', { repeat: { freq: 'daily', until: '2099-01-01' } }), /vor dem ersten Termin/);
    assert.throws(() => eventAt('2099-01-05', { repeat: { freq: 'daily', count: 0 } }), /zwischen 1 und 999/);
    const e = eventAt('2099-01-05', { repeat: { freq: 'daily', until: '2099-01-07', count: 5 } });
    assert.deepEqual([e.repeat.until, e.repeat.count], ['2099-01-07', null], 'Datum hat Vorrang vor Anzahl');
  });

  test('wöchentlich ohne gültige Wochentage = Wochentag des Starts; monatlich nach Wochentag ohne nth = aus dem Datum', () => {
    fresh();
    assert.deepEqual(eventAt('2099-01-07', { repeat: { freq: 'weekly', weekdays: [9, 'x'] } }).repeat.weekdays, [3]);
    assert.equal(eventAt('2099-01-27', { repeat: { freq: 'monthly', monthly: 'weekday' } }).repeat.nth, 4);
  });

  test('Geburtsjahr nur bei Geburtstagen und nicht nach dem Datum', () => {
    fresh();
    const b = store.birthdayTopic().id;
    assert.throws(() => eventAt('2099-03-05', { topic_id: b, birth_year: 2100 }), /Geburtsjahr/);
    assert.equal(eventAt('2099-03-05', { birth_year: 1990 }).birth_year, null);
  });

  test('ganztägig: 0:00 bis 23:59; Routine kann nicht ganztägig sein', () => {
    fresh();
    const e = store.createEvent({ title: 'Urlaub', all_day: true, start_at: '2099-07-01T15:00', end_at: '2099-07-03T09:00' });
    assert.deepEqual([e.start_at, e.end_at], ['2099-07-01 00:00', '2099-07-03 23:59']);
    const r = store.createTask({ title: 'Morgen', kind: 'routine' });
    assert.equal(eventAt('2099-07-01', { routine_id: r.id, all_day: true }).all_day, false);
  });

  test('unbekannter Termin: Fehler beim Ändern und Umwandeln; Löschen ist harmlos', () => {
    fresh();
    assert.throws(() => store.updateEvent(999, { title: 'x' }), /nicht gefunden/);
    assert.throws(() => store.eventToTask(999), /nicht gefunden/);
    store.deleteEvent(999);
    assert.equal(store.eventById(999), null);
  });
});

describe('Termine: Kalenderzeitraum', () => {
  test('sortiert nach Beginn; mehrtägig erscheint in jedem berührten Zeitraum', () => {
    fresh();
    eventAt('2099-01-06', { title: 'später' });
    store.createEvent({ title: 'Reise', start_at: '2099-01-04T18:00', end_at: '2099-01-07T12:00' });
    eventAt('2099-01-05', { title: 'früher' });
    assert.deepEqual(titlesOn('2099-01-05', '2099-01-06'), ['01-04 Reise', '01-05 früher', '01-06 später']);
    assert.deepEqual(titlesOn('2099-01-07', '2099-01-08'), ['01-04 Reise']);
    assert.deepEqual(titlesOn('2099-01-08', '2099-01-09'), []);
    assert.ok(store.eventsBetween(new Date(2099, 0, 8), new Date(2099, 0, 9)).some((e) => e.title === 'Reise'),
      'Rand: ein Tag davor wird mitgeliefert');
  });

  test('Serientermine sind markiert, Einzeländerungen auch', () => {
    fresh();
    const s = eventAt('2099-01-05', { repeat: { freq: 'daily', interval: 1 } });
    store.updateEvent(s.id, { title: 'anders', start_at: '2099-01-06T12:00', end_at: '2099-01-06T13:00' }, { scope: 'this', occurrence: '2099-01-06' });
    const list = visibleOn('2099-01-05', '2099-01-06');
    assert.deepEqual(list.map((e) => `${e.title} ${e.series}`), ['Termin true', 'anders true']);
    assert.deepEqual(store.seriesRepeat(list[1]).freq, 'daily', 'Einzeländerung kennt die Wiederholung der Serie');
  });

  test('„dieser Termin“ löschen, dann „dieser und folgende“ löschen', () => {
    fresh();
    const s = eventAt('2099-01-05', { repeat: { freq: 'daily', interval: 1 } });
    store.deleteEvent(s.id, { scope: 'this', occurrence: '2099-01-06' });
    store.deleteEvent(s.id, { scope: 'following', occurrence: '2099-01-08' });
    assert.deepEqual(titlesOn('2099-01-01', '2099-01-31'), ['01-05 Termin', '01-07 Termin']);
  });
});

describe('Steigerungen: Eingabe und Grenzen', () => {
  test('nur für regelmäßige Aufgaben, nicht für Steigerungen; jedes n-te Mal mindestens 2', () => {
    fresh();
    const t = weeklyTask();
    assert.throws(() => store.createUpgrade({ upgrade_of: 999, title: 'x', upgrade_every: 2 }), /nicht gefunden/);
    assert.throws(() => store.createUpgrade({ upgrade_of: t.id, title: 'x' }), /jedes wievielte/);
    assert.throws(() => store.createUpgrade({ upgrade_of: t.id, title: 'x', upgrade_every: 1 }), /zwischen 2 und 999/);
    assert.throws(() => store.createUpgrade({ upgrade_of: t.id, title: '', upgrade_every: 2 }), /Titel/);
    const u = store.createUpgrade({ upgrade_of: t.id, title: 'gründlich', upgrade_every: 2 });
    assert.throws(() => store.createUpgrade({ upgrade_of: u.id, title: 'x', upgrade_every: 2 }), /nicht gefunden/);
  });

  test('„dran in“ höchstens n; Standard n; ändern behält die Aufgabe', () => {
    fresh();
    const t = weeklyTask();
    const u = store.createUpgrade({ upgrade_of: t.id, title: 'gründlich', upgrade_every: 4, upgrade_in: 9 });
    assert.equal(u.upgrade_in, 4);
    const v = store.updateUpgrade(u.id, { title: 'sehr gründlich', upgrade_every: 3, upgrade_in: 1, upgrade_of: 999 });
    assert.deepEqual([v.title, v.upgrade_every, v.upgrade_in, v.upgrade_of], ['sehr gründlich', 3, 1, t.id]);
    assert.deepEqual(store.taskById(t.id).upgrades.map((x) => x.title), ['sehr gründlich']);
    assert.throws(() => store.updateUpgrade(999, { title: 'x', upgrade_every: 2 }), /nicht gefunden/);
  });

  test('löschen: nur die Steigerung, nicht die Aufgabe; keine Steigerung als Termin einplanbar', () => {
    fresh();
    const t = weeklyTask();
    const u = store.createUpgrade({ upgrade_of: t.id, title: 'gründlich', upgrade_every: 2 });
    assert.throws(() => store.createEvent({ task_id: u.id, start_at: '2099-01-05T10:00', end_at: '2099-01-05T11:00' }), /nicht gefunden/);
    assert.equal(store.taskById(u.id), null, 'keine eigene Aufgabe');
    store.deleteUpgrade(t.id); // eine normale Aufgabe ist keine Steigerung → bleibt
    store.deleteUpgrade(u.id);
    assert.deepEqual([store.upgradesOf(t.id).length, Boolean(store.taskById(t.id))], [0, true]);
  });

  test('wird die Aufgabe einmalig, sind die Steigerungen nicht mehr dran', () => {
    fresh();
    const t = weeklyTask();
    store.createUpgrade({ upgrade_of: t.id, title: 'gründlich', upgrade_every: 2, upgrade_in: 1 });
    assert.equal(store.shownTitle(store.taskById(t.id)), 'Bad putzen + gründlich');
    store.updateTask(t.id, { ...store.taskById(t.id), recurrence: 'once' });
    assert.equal(store.shownTitle(store.taskById(t.id)), 'Bad putzen');
  });

  test('verpasste (verfallene) Durchgänge zählen nicht – die Steigerung bleibt dran', () => {
    fresh();
    const t = weeklyTask({ on_missed: 'expire' });
    store.createUpgrade({ upgrade_of: t.id, title: 'gründlich', upgrade_every: 3, upgrade_in: 1 });
    store.rollExpired(new Date(2099, 0, 20, 12));
    assert.equal(store.shownTitle(store.taskById(t.id)), 'Bad putzen + gründlich');
  });

  test('Sicherung enthält Steigerungen', () => {
    fresh();
    const t = weeklyTask();
    store.createUpgrade({ upgrade_of: t.id, title: 'gründlich', upgrade_every: 2 });
    const json = store.exportJson();
    fresh();
    store.importJson(json);
    assert.deepEqual(store.upgradesOf(store.tasks()[0].id).map((u) => u.title), ['gründlich']);
  });
});

describe('Wiederkehrende Aufgaben im Kalender: weitere Fälle', () => {
  const on = (from, to, now) => store.recurringBetween(new Date(`${from}T00:00`), new Date(`${to}T00:00`), now).map((t) => `${t.title} ${t.day}`);

  test('Zeitraum-Aufgabe steht am ersten Tag des Zeitraums (oder heute, wenn er schon läuft)', () => {
    fresh();
    // Das Fenster ergibt sich aus dem echten heutigen Datum – getestet wird relativ dazu.
    const t = store.createTask({ title: 'Rasen', recurrence: 'period', period_start: '04-01', period_end: '09-30' });
    const [y, m, d] = t.window_start.split('-').map(Number);
    const before = new Date(y, m - 1, d - 10, 12);
    const inside = new Date(y, m - 1, d + 30, 12);
    const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    assert.deepEqual(on(iso(before), t.window_end, before), [`Rasen ${t.window_start}`]);
    assert.deepEqual(on(iso(before), t.window_end, inside), [`Rasen ${iso(inside)}`]);
  });

  test('außerhalb des sichtbaren Zeitraums: nichts', () => {
    fresh();
    weeklyTask();
    assert.deepEqual(on('2099-02-01', '2099-02-28', new Date(2099, 0, 1, 12)), []);
  });

  test('eingeplanter Termin außerhalb des aktuellen Durchgangs verhindert den Eintrag nicht', () => {
    fresh();
    const t = weeklyTask();
    store.createEvent({ task_id: t.id, start_at: '2099-01-20T09:00', end_at: '2099-01-20T10:00' });
    assert.deepEqual(on('2099-01-01', '2099-01-31', new Date(2099, 0, 1, 12)), ['Bad putzen 2099-01-05']);
  });

  test('Schritte eintägiger Routinen, einmalige und erledigte Aufgaben erscheinen nicht', () => {
    fresh();
    const r = store.createTask({ title: 'Morgen', kind: 'routine' });
    store.createTask({ title: 'Zähne', parent_id: r.id });
    const done = store.createTask({ title: 'Erledigt', window_end: '2099-01-05' });
    store.completeTask(done.id, new Date(2099, 0, 1));
    store.createTask({ title: 'Einmal', window_end: '2099-01-05' });
    assert.deepEqual(on('2099-01-01', '2099-01-31', new Date(2099, 0, 1, 12)), []);
  });
});

describe('Deadlines im Kalender: weitere Fälle', () => {
  const dl = (from, to) => store.deadlinesBetween(new Date(`${from}T00:00`), new Date(`${to}T00:00`)).map((t) => `${t.deadline_date.slice(5)} ${t.deadline_time || '-'} ${t.title}`);

  test('sortiert nach Uhrzeit (ohne Uhrzeit zuerst), dann alphabetisch', () => {
    fresh();
    store.createTask({ title: 'B', window_end: '2099-01-05', deadline_time: '14:00' });
    store.createTask({ title: 'A', window_end: '2099-01-05', deadline_time: '09:00' });
    store.createTask({ title: 'C', window_end: '2099-01-05' });
    store.createTask({ title: 'D', window_end: '2099-01-05' });
    assert.deepEqual(dl('2099-01-05', '2099-01-05'), ['01-05 - C', '01-05 - D', '01-05 09:00 A', '01-05 14:00 B']);
  });

  test('regelmäßig ohne Deadline-Häkchen und Schritte von Routinen: keine Deadline', () => {
    fresh();
    weeklyTask();
    const r = store.createTask({ title: 'Morgen', kind: 'routine' });
    store.createTask({ title: 'Zähne', parent_id: r.id, window_end: '2099-01-05' });
    assert.deepEqual(dl('2099-01-01', '2099-01-31'), []);
  });

  test('Aufgaben einer mehrtägigen Routine mit Deadline: ja', () => {
    fresh();
    const m = store.createTask({ title: 'Haushalt', kind: 'routine', routine_type: 'multi' });
    weeklyTask({ parent_id: m.id, has_deadline: true });
    assert.deepEqual(dl('2099-01-01', '2099-01-12'), ['01-05 - Bad putzen', '01-12 - Bad putzen']);
  });
});

describe('Sicherung', () => {
  test('ungültige Sicherungen werden abgelehnt, die Daten bleiben', () => {
    fresh();
    store.createTask({ title: 'bleibt' });
    assert.throws(() => store.importJson('{}'), /keine gültige Sicherung/);
    assert.throws(() => store.importJson('null'), /keine gültige Sicherung/);
    assert.throws(() => store.importJson('{"tasks":[],"topics":[]}'), /keine gültige Sicherung/);
    assert.throws(() => store.importJson('kein json'));
    assert.deepEqual(titles(store.tasks()), ['bleibt']);
  });

  test('Export → Import ergibt dieselben Daten', () => {
    fresh();
    const topic = store.createTopic({ name: 'Sport', color: '#00aa00' });
    const t = weeklyTask({ topic_id: topic.id });
    store.createTask({ title: 'Unter', parent_id: t.id });
    eventAt('2099-01-05', { repeat: { freq: 'weekly', interval: 1 } });
    store.createWish({ title: 'Museum' });
    const before = store.exportJson();
    fresh();
    store.importJson(before);
    // Einlesen ist selbst eine Änderung (Zeitpunkt modified_at für den Cloud-Sync) – alles andere bleibt gleich.
    const content = (json) => { const { modified_at: _m, ...rest } = JSON.parse(json); return rest; };
    assert.deepEqual(content(store.exportJson()), content(before));
  });

  test('alles löschen: leer, aber mit den festen Themen', () => {
    fresh();
    store.createTask({ title: 'x' });
    store.clearAll();
    assert.equal(store.tasks().length, 0);
    assert.ok(store.birthdayTopic() && store.eventTopic());
  });

  test('kaputter Speicher: App startet leer statt abzustürzen', () => {
    const broken = { getItem: () => '{kaputt', setItem: () => {} };
    store.load(broken);
    assert.equal(store.tasks().length, 0);
    assert.ok(store.birthdayTopic());
  });
});

describe('IDs für den Cloud-Sync', () => {
  // Uhr und Zufall festhalten: So würde eine Wiederverwendung sicher auffallen.
  const frozen = (fn) => {
    const [now, random] = [Date.now, Math.random];
    const t = now();
    Date.now = () => t;
    Math.random = () => 0.5;
    try { fn(); } finally { Date.now = now; Math.random = random; }
  };

  test('nach „Alles löschen“ werden IDs nie wiederverwendet', () => frozen(() => {
    fresh();
    const old = store.createTask({ title: 'alt' });
    store.clearAll();
    const neu = store.createTask({ title: 'neu' });
    assert.ok(neu.id > old.id);
    assert.ok(store.snapshot().deleted.some((d) => d.id === old.id), 'alte Aufgabe hat einen Löschvermerk');
  }));

  test('nach dem Einlesen einer älteren Sicherung werden IDs nie wiederverwendet', () => frozen(() => {
    fresh();
    const backup = store.exportJson();
    const later = store.createTask({ title: 'später angelegt' });
    store.importJson(backup);
    assert.ok(store.createTask({ title: 'neu' }).id > later.id);
  }));

  test('IDs steigen immer an und sind große, sichere Ganzzahlen', () => {
    fresh();
    const ids = Array.from({ length: 50 }, (_, i) => store.createTask({ title: `t${i}` }).id);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
    assert.equal(new Set(ids).size, 50);
    assert.ok(ids.every(Number.isSafeInteger));
  });

  test('Änderungen bekommen Zeitstempel, Löschen hinterlässt einen Löschvermerk', () => {
    fresh();
    const t = store.createTask({ title: 'x' });
    assert.ok(store.snapshot().tasks[0].updated_at > 0);
    store.deleteTask(t.id);
    assert.deepEqual(store.snapshot().deleted.filter((d) => d.kind === 'tasks').map((d) => d.id), [t.id]);
  });

  test('Änderungen melden sich beim Sync; Übernehmen aus der Cloud nicht', () => {
    fresh();
    let calls = 0;
    store.setLocalChangeListener(() => { calls += 1; });
    store.createTask({ title: 'x' });
    assert.equal(calls, 1);
    store.replaceData(store.snapshot());
    assert.equal(calls, 1);
    store.setLocalChangeListener(null);
  });
});

describe('App-Tag beginnt um 4:30', () => {
  test('vor 4:30 gehört noch zum Vortag', () => {
    const start = (s) => {
      const d = store.dayStart(new Date(s));
      return `${d.getDate()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    assert.equal(start('2099-01-05T03:00'), '4. 04:30');
    assert.equal(start('2099-01-05T04:30'), '5. 04:30');
    assert.equal(start('2099-01-05T23:59'), '5. 04:30');
  });
});
