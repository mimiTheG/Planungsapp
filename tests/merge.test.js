// Abgleich zwischen Geräten (merge.js): Zeitstempel, Löschvermerke, neuere Fassung gewinnt. Ausführen: npm test

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeData, sameData, stableStringify, stampChanges } from '../js/merge.js';

const doc = (extra = {}) => ({ version: 1, nextId: 10, topics: [], tasks: [], events: [], wishes: [], log: [], ...extra });
const task = (id, title, updated_at, extra = {}) => ({ id, title, updated_at, ...extra });
const titles = (d) => d.tasks.map((t) => t.title);

describe('Änderungen erkennen (stampChanges)', () => {
  test('neu und geändert bekommen den Zeitstempel, Unverändertes behält seinen', () => {
    const prev = doc({ tasks: [task(1, 'A', 100), task(2, 'B', 100)] });
    const next = doc({ tasks: [task(1, 'A', 100), task(2, 'B geändert', 100), { id: 3, title: 'C' }] });
    assert.equal(stampChanges(prev, next, 500), true);
    assert.deepEqual(next.tasks.map((t) => t.updated_at), [100, 500, 500]);
    assert.equal(next.modified_at, 500);
  });

  test('gelöschte Einträge bekommen einen Löschvermerk', () => {
    const prev = doc({ tasks: [task(1, 'A', 100)], wishes: [{ id: 2, title: 'W', updated_at: 100 }] });
    const next = doc();
    stampChanges(prev, next, 500);
    assert.deepEqual(next.deleted, [{ kind: 'tasks', id: 1, at: 500 }, { kind: 'wishes', id: 2, at: 500 }]);
  });

  test('nichts geändert → keine Änderung, kein neuer Zeitpunkt', () => {
    const prev = doc({ tasks: [task(1, 'A', 100)], modified_at: 100 });
    const next = doc({ tasks: [task(1, 'A', 100)], modified_at: 100 });
    assert.equal(stampChanges(prev, next, 500), false);
    assert.equal(next.modified_at, 100);
  });

  test('Reihenfolge der Schlüssel ist egal', () => {
    const prev = doc({ tasks: [{ id: 1, title: 'A', notes: 'x', updated_at: 100 }] });
    const next = doc({ tasks: [{ notes: 'x', updated_at: 100, title: 'A', id: 1 }] });
    assert.equal(stampChanges(prev, next, 500), false);
  });

  test('eingelesene Einträge (neu, mit Zeitstempel) behalten ihren Zeitstempel', () => {
    const next = doc({ tasks: [task(1, 'A', 100)] });
    stampChanges(doc(), next, 500);
    assert.equal(next.tasks[0].updated_at, 100);
  });

  test('Einstellungen wie die laufende Routine zählen als Änderung', () => {
    const prev = doc({ activeRoutine: null });
    const next = doc({ activeRoutine: { id: 1, started_at: '2026-10-15 07:00' } });
    assert.equal(stampChanges(prev, next, 500), true);
    assert.equal(next.modified_at, 500);
  });

  test('wieder angelegt mit derselben ID → alter Löschvermerk fällt weg', () => {
    const prev = doc({ deleted: [{ kind: 'tasks', id: 5, at: 100 }, { kind: 'events', id: 5, at: 100 }] });
    const next = doc({ tasks: [{ id: 5, title: 'neu' }], deleted: prev.deleted });
    stampChanges(prev, next, 100);
    assert.deepEqual(next.deleted, [{ kind: 'events', id: 5, at: 100 }]);
    assert.deepEqual(titles(mergeData(next, next)), ['neu']);
  });

  test('alte Löschvermerke (über ein Jahr) werden aufgeräumt', () => {
    const now = 500 * 86400000;
    const next = doc({ deleted: [{ kind: 'tasks', id: 1, at: 1 }, { kind: 'tasks', id: 2, at: now - 1000 }] });
    stampChanges(doc(), next, now);
    assert.deepEqual(next.deleted.map((d) => d.id), [2]);
  });
});

describe('Zusammenführen (mergeData)', () => {
  test('pro Eintrag gewinnt die neuere Fassung; Einträge von beiden Seiten bleiben', () => {
    const a = doc({ tasks: [task(1, 'A alt', 100), task(2, 'nur A', 150)] });
    const b = doc({ tasks: [task(1, 'A neu', 200), task(3, 'nur B', 120)] });
    assert.deepEqual(titles(mergeData(a, b)), ['A neu', 'nur A', 'nur B']);
    assert.deepEqual(titles(mergeData(b, a)), ['A neu', 'nur A', 'nur B'], 'Reihenfolge der Seiten egal');
  });

  test('gelöscht nach der letzten Änderung → bleibt gelöscht; danach geändert → kommt zurück', () => {
    const a = doc({ tasks: [], deleted: [{ kind: 'tasks', id: 1, at: 300 }, { kind: 'tasks', id: 2, at: 300 }] });
    const b = doc({ tasks: [task(1, 'vorher geändert', 200), task(2, 'danach geändert', 400)] });
    assert.deepEqual(titles(mergeData(a, b)), ['danach geändert']);
  });

  test('Löschvermerke werden zusammengeführt (der spätere zählt)', () => {
    const a = doc({ deleted: [{ kind: 'tasks', id: 1, at: 300 }] });
    const b = doc({ deleted: [{ kind: 'tasks', id: 1, at: 500 }, { kind: 'events', id: 1, at: 200 }] });
    assert.deepEqual(mergeData(a, b).deleted, [{ kind: 'events', id: 1, at: 200 }, { kind: 'tasks', id: 1, at: 500 }]);
  });

  test('Löschvermerk gilt nur für die eigene Liste (gleiche ID in einer anderen Liste bleibt)', () => {
    const a = doc({ deleted: [{ kind: 'events', id: 1, at: 900 }] });
    const b = doc({ tasks: [task(1, 'Aufgabe', 100)] });
    assert.deepEqual(titles(mergeData(a, b)), ['Aufgabe']);
  });

  test('Verlauf: beide Seiten, ohne Doppelte, nach Zeit sortiert', () => {
    const a = doc({ log: [{ task_id: 1, action: 'done', at: '2026-10-15 09:00' }] });
    const b = doc({ log: [{ task_id: 2, action: 'done', at: '2026-10-14 09:00' }, { task_id: 1, action: 'done', at: '2026-10-15 09:00' }] });
    assert.deepEqual(mergeData(a, b).log.map((l) => l.task_id), [2, 1]);
  });

  test('nextId = das größere; Einstellungen vom zuletzt geänderten Stand', () => {
    const a = doc({ nextId: 50, modified_at: 100, activeRoutine: null, tasks: [task(7, 'Morgen', 100)] });
    const b = doc({ nextId: 20, modified_at: 200, activeRoutine: { id: 7, started_at: 'x' } });
    const merged = mergeData(a, b);
    assert.equal(merged.nextId, 50);
    assert.deepEqual(merged.activeRoutine, { id: 7, started_at: 'x' });
    assert.equal(merged.modified_at, 200);
  });

  test('laufende Routine, die es nicht mehr gibt, wird beendet', () => {
    const a = doc({ modified_at: 300, activeRoutine: { id: 7 }, tasks: [] });
    assert.equal(mergeData(a, doc()).activeRoutine, null);
  });

  test('Ergebnis ist unabhängig von der Reihenfolge und ändert sich bei nochmaligem Zusammenführen nicht', () => {
    const a = doc({ modified_at: 100, tasks: [task(1, 'A', 100)], deleted: [{ kind: 'tasks', id: 9, at: 50 }] });
    const b = doc({ modified_at: 200, tasks: [task(2, 'B', 200)] });
    const ab = mergeData(a, b);
    assert.ok(sameData(ab, mergeData(b, a)));
    assert.ok(sameData(mergeData(ab, b), ab));
  });
});

describe('Vergleich', () => {
  test('stableStringify sortiert Schlüssel, lässt undefined weg', () => {
    assert.equal(stableStringify({ b: 1, a: [{ d: 2, c: undefined }] }), '{"a":[{"d":2}],"b":1}');
    assert.equal(sameData({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    assert.equal(sameData({ a: 1 }, { a: 2 }), false);
  });
});
