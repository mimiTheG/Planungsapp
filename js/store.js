// Datenhaltung auf dem Gerät (localStorage) und alle Abläufe rund um Themen, Aufgaben und Termine.

import { addDays, isoDate, parseDate, stamp } from './dates.js';
import * as schedule from './schedule.js';
import * as repeating from './repeat.js';

const STORAGE_KEY = 'planungsapp.v1';
// scale 'high5': Wichtigkeit/Dringlichkeit 5 = sehr wichtig/sofort, 1 = unwichtig/kein Zeitdruck.
const EMPTY = () => ({ version: 1, scale: 'high5', nextId: 1, topics: [], tasks: [], events: [], wishes: [], log: [] });

// Gespeicherte Daten auf den aktuellen Stand bringen. Eine Zwischenversion der App hatte die Skala
// umgedreht (1 = sehr wichtig); deren Daten erkennt man an der Wunschliste ohne scale-Angabe.
function migrate(parsed) {
  const result = { ...EMPTY(), ...parsed };
  if (!parsed.scale) {
    if (Array.isArray(parsed.wishes)) {
      for (const t of result.tasks) {
        for (const key of ['importance', 'urgency', 'importance_emo', 'urgency_emo']) t[key] = 6 - t[key];
      }
    }
    result.scale = 'high5';
  }
  return result;
}

let data = EMPTY();
let storage = globalThis.localStorage;

export class ValidationError extends Error {}

// --- Laden & Speichern -------------------------------------------------------

// Lädt die gespeicherten Daten. Gibt false zurück, wenn noch nie etwas gespeichert wurde (erster Start).
export function load(customStorage) {
  if (customStorage) storage = customStorage;
  let raw = null;
  try {
    raw = storage?.getItem(STORAGE_KEY);
    data = raw ? migrate(JSON.parse(raw)) : EMPTY();
  } catch {
    data = EMPTY();
  }
  rollExpired();
  return raw !== null;
}

export function clearAll() {
  data = EMPTY();
  save();
}

function save() {
  storage?.setItem(STORAGE_KEY, JSON.stringify(data));
  // Ansichten wie die Leiste der laufenden Routine hören darauf.
  if (typeof Event === 'function') globalThis.dispatchEvent?.(new Event('planungsapp-change'));
}

function nextId() {
  const id = data.nextId;
  data.nextId += 1;
  return id;
}

export function exportJson() {
  return JSON.stringify(data, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.topics) || !Array.isArray(parsed.events)) {
    throw new ValidationError('Das ist keine gültige Sicherung');
  }
  data = migrate(parsed);
  save();
  rollExpired();
}

// --- Lesen ---------------------------------------------------------------------

export const topics = () => [...data.topics].sort((a, b) => a.name.localeCompare(b.name, 'de'));
export const topicById = (id) => data.topics.find((t) => t.id === Number(id)) || null;
export const topicColor = (id) => topicById(id)?.color || '#94a3b8';

// Aufgaben mit berechnetem Status (status, closes_at).
export function tasks(now = new Date()) {
  rollExpired(now);
  return data.tasks.map((t) => decorate(t, now));
}

function decorate(task, now) {
  const closes = schedule.closesAt(task);
  return { ...task, status: schedule.status(task, now), closes_at: closes ? stamp(closes) : null };
}

export function taskById(id) {
  const task = data.tasks.find((t) => t.id === Number(id));
  return task ? decorate(task, new Date()) : null;
}

// Unteraufgaben in der festgelegten Reihenfolge (sort_order, sonst Reihenfolge des Anlegens).
export function childrenOf(id) {
  return tasks().filter((t) => t.parent_id === id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

// Neue Reihenfolge der Unteraufgaben speichern. ids = sichtbare Reihenfolge; nicht genannte bleiben dahinter.
export function reorderChildren(parentId, ids) {
  const rest = childrenOf(parentId).map((t) => t.id).filter((id) => !ids.includes(id));
  [...ids, ...rest].forEach((id, index) => {
    const task = data.tasks.find((t) => t.id === id && t.parent_id === parentId);
    if (task) task.sort_order = index;
  });
  save();
}

// Ebene ändern: Einrücken macht die Aufgabe zur letzten Unteraufgabe ihres Vorgängers (gleiche Ebene,
// laut Reihenfolge); Ausrücken stellt sie direkt hinter ihre bisherige Oberaufgabe.
export function indentTask(id) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) throw new ValidationError('Aufgabe nicht gefunden');
  const siblings = childrenOf(task.parent_id);
  const previous = siblings[siblings.findIndex((t) => t.id === id) - 1];
  if (!previous) throw new ValidationError('Darüber steht nichts, unter das sie rutschen könnte');
  task.sort_order = Math.max(-1, ...childrenOf(previous.id).map((t) => t.sort_order ?? 0)) + 1;
  task.parent_id = previous.id;
  save();
  return taskById(id);
}

export function canOutdent(task) {
  const parent = task?.parent_id !== null && data.tasks.find((t) => t.id === task.parent_id);
  return Boolean(parent) && !(parent.kind === 'routine' && parent.parent_id === null);
}

export function outdentTask(id) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) throw new ValidationError('Aufgabe nicht gefunden');
  if (!canOutdent(task)) throw new ValidationError('Schritte bleiben in ihrer Routine');
  const parent = data.tasks.find((t) => t.id === task.parent_id);
  const order = childrenOf(parent.parent_id).filter((t) => t.id !== id).map((t) => t.id);
  order.splice(order.indexOf(parent.id) + 1, 0, id);
  task.parent_id = parent.parent_id;
  order.forEach((tid, index) => { data.tasks.find((t) => t.id === tid).sort_order = index; });
  save();
  return taskById(id);
}

// Alle Nachkommen einer Aufgabe (beliebig tief).
export function descendantsOf(id) {
  return childrenOf(id).flatMap((child) => [child, ...descendantsOf(child.id)]);
}

export function routines() {
  return tasks().filter((t) => t.kind === 'routine' && t.parent_id === null);
}

// Dauer einer Routine: eigene Angabe oder Summe der Schritte.
export function routineMinutes(task) {
  if (task.duration_min) return task.duration_min;
  return childrenOf(task.id).reduce((sum, child) => sum + (routineMinutes(child) || 0), 0) || null;
}

// Liegt die Aufgabe (oder eine übergeordnete) in einer Routine? Dann gibt es keine Priorität und kein "Wann?".
export function isInRoutine(task) {
  for (let current = task; current; current = data.tasks.find((t) => t.id === current.parent_id)) {
    if (current.kind === 'routine') return true;
  }
  return false;
}

// "Wollte ich schon länger mal wieder machen" – ohne Datum und Priorität; am längsten nicht Gemachtes zuerst.
export function wishes() {
  return [...data.wishes].sort((a, b) => String(a.last_done_at || '').localeCompare(String(b.last_done_at || ''))
    || a.title.localeCompare(b.title, 'de'));
}

// Verlauf: alles Erledigte, neueste zuerst – Aufgaben, Projekte, Routinen und Wunschliste
// (einzelne Schritte einer Routine nicht, die stehen beim Abschließen der Routine).
export function history() {
  const entries = [];
  for (const entry of data.log) {
    if (entry.action !== 'done') continue;
    if (entry.wish_id) {
      const wish = data.wishes.find((w) => w.id === entry.wish_id);
      if (wish) entries.push({ at: entry.at, wish });
      continue;
    }
    const task = taskById(entry.task_id);
    if (!task || (isInRoutine(task) && task.kind !== 'routine')) continue;
    entries.push({ at: entry.at, task });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

// Termine, die den Zeitraum [from, to] (Tage, inklusive) berühren – mit einem Tag Rand für Bereiche davor/danach.
// Wiederkehrende Termine werden in einzelne Termine aufgelöst (occurrence = Tag des Termins, series = true).
export function eventsBetween(from, to) {
  const start = addDays(new Date(from), -1);
  const end = addDays(new Date(to), 2);
  return data.events
    .flatMap((event) => repeating.occurrences(event, start, end).map((o) => ({
      ...event,
      start_at: stamp(o.start),
      end_at: stamp(o.end),
      occurrence: o.occurrence,
      series: Boolean(event.repeat),
    })))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}

export function eventById(id) {
  return data.events.find((e) => e.id === Number(id)) || null;
}

// --- Validierung ---------------------------------------------------------------

function text(input, key, max, required = false) {
  const value = String(input[key] ?? '').trim();
  if (!value) {
    if (required) throw new ValidationError(`Bitte „${LABELS[key] || key}“ ausfüllen`);
    return null;
  }
  if (value.length > max) throw new ValidationError(`„${LABELS[key] || key}“ ist zu lang (max. ${max} Zeichen)`);
  return value;
}

function int(input, key, min, max, fallback = null) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`„${LABELS[key] || key}“ muss zwischen ${min} und ${max} liegen`);
  }
  return value;
}

function oneOf(input, key, allowed) {
  const value = input[key] ?? allowed[0];
  if (!allowed.includes(value)) throw new ValidationError(`Ungültiger Wert für ${key}`);
  return value;
}

function pattern(input, key, regex) {
  const value = String(input[key] ?? '').trim();
  if (!value) return null;
  if (!regex.test(value)) throw new ValidationError(`„${LABELS[key] || key}“ hat ein ungültiges Format`);
  return value;
}

function ref(input, key) {
  const value = Number(input[key] || 0);
  return value > 0 ? value : null;
}

function monthDay(input, key) {
  const value = pattern(input, key, /^\d{2}-\d{2}$/);
  if (value) {
    const [m, d] = value.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > new Date(2024, m, 0).getDate()) {
      throw new ValidationError(`„${LABELS[key]}“ ist kein gültiges Datum`);
    }
  }
  return value;
}

const LABELS = {
  name: 'Name', title: 'Titel', notes: 'Notizen', rhythm_days: 'Rhythmus', buffer_days: 'Puffer',
  period_start: 'Beginn des Zeitraums', period_end: 'Ende des Zeitraums', duration_min: 'Dauer',
  start_at: 'Beginn', end_at: 'Ende', before_minutes: 'Minuten davor', after_minutes: 'Minuten danach',
  window_start: 'Beginn', window_end: 'Ende', deadline_time: 'Uhrzeit', default_time: 'Standardstartzeit',
};

// --- Themen ----------------------------------------------------------------------

function topicInput(input) {
  return {
    name: text(input, 'name', 60, true),
    color: pattern(input, 'color', /^#[0-9a-fA-F]{6}$/) || '#9f1239',
  };
}

export function createTopic(input) {
  const topic = { id: nextId(), ...topicInput(input) };
  data.topics.push(topic);
  save();
  return topic;
}

export function updateTopic(id, input) {
  const topic = data.topics.find((t) => t.id === id);
  if (!topic) throw new ValidationError('Thema nicht gefunden');
  Object.assign(topic, topicInput(input));
  save();
  return topic;
}

export function deleteTopic(id) {
  data.topics = data.topics.filter((t) => t.id !== id);
  for (const item of [...data.tasks, ...data.events, ...data.wishes]) {
    if (item.topic_id === id) item.topic_id = null;
  }
  save();
}

// --- Aufgaben --------------------------------------------------------------------

function taskInput(input, id) {
  const recurrence = oneOf(input, 'recurrence', ['once', 'rhythm', 'period']);
  const task = {
    parent_id: ref(input, 'parent_id'),
    title: text(input, 'title', 200, true),
    notes: text(input, 'notes', 5000),
    kind: oneOf(input, 'kind', ['todo', 'project', 'routine']),
    topic_id: ref(input, 'topic_id'),
    importance: int(input, 'importance', 1, 5, 3),
    urgency: int(input, 'urgency', 1, 5, 3),
    importance_emo: int(input, 'importance_emo', 1, 5, 3),
    urgency_emo: int(input, 'urgency_emo', 1, 5, 3),
    duration_min: int(input, 'duration_min', 1, 1440),
    default_time: pattern(input, 'default_time', /^\d{2}:\d{2}$/),
    recurrence,
    rhythm_days: null,
    buffer_days: null,
    period_start: null,
    period_end: null,
    deadline_time: pattern(input, 'deadline_time', /^\d{2}:\d{2}$/),
    on_missed: oneOf(input, 'on_missed', ['remind', 'expire']),
  };

  if (recurrence === 'rhythm') {
    task.rhythm_days = int(input, 'rhythm_days', 1, 3650);
    if (task.rhythm_days === null) throw new ValidationError('Bitte den Rhythmus (Tage) angeben');
    task.buffer_days = int(input, 'buffer_days', 1, 3650, 1);
  } else if (recurrence === 'period') {
    task.period_start = monthDay(input, 'period_start');
    task.period_end = monthDay(input, 'period_end');
    if (!task.period_start || !task.period_end) throw new ValidationError('Bitte Beginn und Ende des Zeitraums angeben');
  }

  if (task.parent_id !== null && !data.tasks.some((t) => t.id === task.parent_id)) {
    throw new ValidationError('Übergeordnete Aufgabe nicht gefunden');
  }
  if (task.parent_id !== null && id !== null && isDescendantOrSelf(task.parent_id, id)) {
    throw new ValidationError('Eine Aufgabe kann nicht unter sich selbst einsortiert werden');
  }
  // Standardstartzeit gibt es nur für Routinen selbst (nicht für ihre Schritte).
  if (task.kind !== 'routine' || task.parent_id !== null) task.default_time = null;
  // Routinen und ihre Schritte trägt man selbst in den Kalender ein: keine Fälligkeit.
  if (isInRoutine(task)) {
    Object.assign(task, {
      recurrence: 'once', rhythm_days: null, buffer_days: null, period_start: null, period_end: null,
      deadline_time: null, on_missed: 'remind',
    });
  }
  return task;
}

function isDescendantOrSelf(candidate, id) {
  for (let current = candidate; current !== null;) {
    if (current === id) return true;
    current = data.tasks.find((t) => t.id === current)?.parent_id ?? null;
  }
  return false;
}

// Fälligkeitsfenster aus den Eingaben bestimmen. Ein Fenster, das beim Speichern schon vorbei ist
// (z. B. Müll bis 6:00, angelegt um 9:00), rückt bei "verfällt" gleich weiter – ohne als verpasst zu zählen.
function windowFor(task, input, old) {
  const window = rawWindowFor(task, input, old);
  const candidate = { ...task, window_start: window[0], window_end: window[1] };
  if (task.recurrence !== 'once' && schedule.status(candidate) === 'expired') {
    return schedule.windowAfterMissed(candidate);
  }
  return window;
}

function rawWindowFor(task, input, old) {
  if (task.recurrence === 'once') {
    const start = pattern(input, 'window_start', /^\d{4}-\d{2}-\d{2}$/);
    const end = pattern(input, 'window_end', /^\d{4}-\d{2}-\d{2}$/);
    if (start && end && end < start) throw new ValidationError('Das Ende liegt vor dem Beginn');
    return [start, end];
  }
  if (task.recurrence === 'period') {
    const unchanged = old && old.recurrence === 'period'
      && old.period_start === task.period_start && old.period_end === task.period_end;
    if (unchanged) return [old.window_start, old.window_end];
    return schedule.initialWindow(task, null);
  }
  // Rhythmus: Beginn des (nächsten) Fensters kommt aus der Eingabe, Ende ergibt sich aus dem Puffer.
  return schedule.initialWindow(task, pattern(input, 'window_start', /^\d{4}-\d{2}-\d{2}$/));
}

export function createTask(input) {
  const task = { id: nextId(), ...taskInput(input, null) };
  [task.window_start, task.window_end] = windowFor(task, input, null);
  // Neue Unteraufgaben kommen ans Ende.
  if (task.parent_id !== null) {
    task.sort_order = Math.max(-1, ...childrenOf(task.parent_id).map((t) => t.sort_order ?? 0)) + 1;
  }
  Object.assign(task, { done_at: null, last_done_at: null, missed_count: 0, created_at: stamp(new Date()) });
  data.tasks.push(task);
  save();
  return taskById(task.id);
}

export function updateTask(id, input) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) throw new ValidationError('Aufgabe nicht gefunden');
  const next = taskInput(input, id);
  [next.window_start, next.window_end] = windowFor(next, input, task);
  if (next.parent_id !== null && next.parent_id !== task.parent_id) {
    next.sort_order = Math.max(-1, ...childrenOf(next.parent_id).map((t) => t.sort_order ?? 0)) + 1;
  }
  const topicChanged = next.topic_id !== task.topic_id;
  Object.assign(task, next);
  // Thema einer Routine geändert → alle Schritte (beliebig tief) bekommen das neue Thema.
  if (topicChanged && task.kind === 'routine') {
    for (const step of descendantsOf(id)) data.tasks.find((t) => t.id === step.id).topic_id = task.topic_id;
  }
  save();
  return taskById(id);
}

export function deleteTask(id) {
  const ids = new Set([id, ...descendantsOf(id).map((t) => t.id)]);
  data.tasks = data.tasks.filter((t) => !ids.has(t.id));
  data.log = data.log.filter((l) => !ids.has(l.task_id));
  for (const e of data.events) {
    if (ids.has(e.routine_id)) e.routine_id = null;
    for (const side of ['before', 'after']) {
      if (ids.has(e[`${side}_routine_id`])) {
        e[`${side}_type`] = 'none';
        e[`${side}_routine_id`] = null;
      }
    }
  }
  save();
}

// Aufgabe erledigen. Wiederkehrende Aufgaben springen ins nächste Fenster, Routinen werden
// zurückgesetzt, einmalige Aufgaben werden abgehakt.
export function completeTask(id, now = new Date()) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) throw new ValidationError('Aufgabe nicht gefunden');
  const when = stamp(now);
  data.log.push({ task_id: id, action: 'done', at: when });
  task.last_done_at = when;

  if (task.recurrence !== 'once') {
    [task.window_start, task.window_end] = schedule.windowAfterDone(task, now);
    resetChildren(id);
  } else if (task.kind === 'routine') {
    resetChildren(id);
  } else {
    task.done_at = when;
    // Oberaufgabe abgehakt → alle noch offenen Unteraufgaben sind damit auch erledigt.
    for (const sub of descendantsOf(id)) {
      const raw = data.tasks.find((t) => t.id === sub.id);
      if (raw.recurrence !== 'once' || raw.done_at) continue;
      raw.done_at = when;
      raw.last_done_at = when;
      data.log.push({ task_id: raw.id, action: 'done', at: when });
    }
  }
  if (task.kind === 'routine' && data.activeRoutine?.id === id) data.activeRoutine = null;
  save();
  return taskById(id);
}

export function reopenTask(id) {
  const task = data.tasks.find((t) => t.id === id);
  if (task?.done_at) {
    // Unteraufgaben, die nur durch das Abhaken der Oberaufgabe erledigt wurden, wieder öffnen.
    const cascaded = descendantsOf(id).filter((sub) => sub.done_at === task.done_at);
    for (const t of [task, ...cascaded.map((sub) => data.tasks.find((r) => r.id === sub.id))]) {
      // Den Verlaufseintrag des Abhakens wieder entfernen.
      const index = data.log.findLastIndex((l) => l.task_id === t.id && l.action === 'done');
      if (index >= 0) data.log.splice(index, 1);
      t.done_at = null;
    }
  }
  save();
  return taskById(id);
}

// --- Laufende Routine (eine zur Zeit, angezeigt über der unteren Leiste) -------------------

export function activeRoutine() {
  const active = data.activeRoutine;
  const routine = active ? taskById(active.id) : null;
  return routine ? { routine, startedAt: active.started_at } : null;
}

export function startRoutine(id, now = new Date()) {
  if (data.activeRoutine?.id !== id) data.activeRoutine = { id, started_at: stamp(now) };
  save();
}

// Routine abbrechen: Sie läuft nicht mehr; abgehakte Schritte werden zurückgesetzt.
export function cancelRoutine(id) {
  resetChildren(id);
  if (data.activeRoutine?.id === id) data.activeRoutine = null;
  save();
}

// Unteraufgaben (alle Ebenen) wieder öffnen, z. B. für den nächsten Durchgang einer Routine.
function resetChildren(id) {
  for (const child of data.tasks.filter((t) => t.parent_id === id)) {
    if (child.recurrence === 'once') child.done_at = null;
    resetChildren(child.id);
  }
}

// Wiederkehrende Aufgaben mit "verfällt", deren Fenster vorbei ist, ins nächste Fenster schieben.
export function rollExpired(now = new Date()) {
  let changed = false;
  for (const task of data.tasks) {
    if (task.on_missed !== 'expire' || task.recurrence === 'once' || !task.window_end) continue;
    if (schedule.status(task, now) !== 'expired') continue;
    [task.window_start, task.window_end] = schedule.windowAfterMissed(task, now);
    task.missed_count = (task.missed_count || 0) + 1;
    data.log.push({ task_id: task.id, action: 'missed', at: stamp(now) });
    resetChildren(task.id);
    changed = true;
  }
  if (resetRoutinesForNewDay(now)) changed = true;
  if (changed) save();
}

// Ein "Tag" in der App beginnt um 4:30 – wer nach Mitternacht noch wach ist, ist noch im alten Tag.
export function dayStart(now = new Date()) {
  const start = new Date(now);
  start.setHours(4, 30, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return start;
}

// Um 4:30 werden abgehakte Schritte aller Routinen wieder geöffnet.
function resetRoutinesForNewDay(now) {
  const boundary = stamp(dayStart(now));
  if (data.routineResetAt === boundary) return false;
  if (data.routineResetAt) {
    for (const routine of data.tasks.filter((t) => t.kind === 'routine' && t.parent_id === null)) resetChildren(routine.id);
  }
  data.routineResetAt = boundary; // beim allerersten Mal nur merken, nichts zurücksetzen
  data.activeRoutine = null;
  return true;
}

// --- Wollte ich schon länger mal wieder machen ------------------------------------

function wishInput(input) {
  return {
    title: text(input, 'title', 200, true),
    notes: text(input, 'notes', 5000),
    topic_id: ref(input, 'topic_id'),
  };
}

export function createWish(input) {
  const wish = { id: nextId(), ...wishInput(input), last_done_at: null };
  data.wishes.push(wish);
  save();
  return wish;
}

export function updateWish(id, input) {
  const wish = data.wishes.find((w) => w.id === id);
  if (!wish) throw new ValidationError('Eintrag nicht gefunden');
  Object.assign(wish, wishInput(input));
  save();
  return wish;
}

export function doneWish(id, now = new Date()) {
  const wish = data.wishes.find((w) => w.id === id);
  if (wish) {
    wish.last_done_at = stamp(now);
    data.log.push({ wish_id: id, action: 'done', at: wish.last_done_at });
  }
  save();
  return wish;
}

export function deleteWish(id) {
  data.wishes = data.wishes.filter((w) => w.id !== id);
  data.log = data.log.filter((l) => l.wish_id !== id);
  save();
}

// --- Termine -----------------------------------------------------------------------

function eventInput(input) {
  const dateTime = (key) => {
    const value = pattern(input, key, /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
    if (!value) throw new ValidationError(`Bitte „${LABELS[key]}“ angeben`);
    return stamp(parseDate(value));
  };
  // Eingeplante Routine: Titel und Thema kommen von der Routine, wenn nichts anderes angegeben ist.
  const routineId = ref(input, 'routine_id');
  const routine = routineId ? data.tasks.find((t) => t.id === routineId && t.kind === 'routine') : null;
  if (routineId && !routine) throw new ValidationError('Routine nicht gefunden');
  const event = {
    title: routine ? text(input, 'title', 200) || routine.title : text(input, 'title', 200, true),
    routine_id: routine ? routine.id : null,
    notes: text(input, 'notes', 5000),
    topic_id: ref(input, 'topic_id') ?? (routine ? routine.topic_id : null),
    is_event: Boolean(input.is_event),
    all_day: Boolean(input.all_day) && !routine,
    start_at: dateTime('start_at'),
    end_at: dateTime('end_at'),
  };
  // Ganztägig: vom ersten Tag 0:00 bis zum letzten Tag 23:59, ohne Bereiche davor/danach.
  if (event.all_day) {
    event.start_at = `${event.start_at.slice(0, 10)} 00:00`;
    event.end_at = `${event.end_at.slice(0, 10)} 23:59`;
  }
  if (event.end_at < event.start_at) throw new ValidationError('Das Ende liegt vor dem Beginn');

  // Bereich davor/danach: frei (z. B. Anfahrt) oder eine Routine.
  for (const side of ['before', 'after']) {
    const type = event.all_day ? 'none' : oneOf(input, `${side}_type`, ['none', 'free', 'routine']);
    event[`${side}_type`] = type;
    event[`${side}_minutes`] = type === 'none' ? null : int(input, `${side}_minutes`, 1, 1440, 15);
    event[`${side}_label`] = type === 'free' ? text(input, `${side}_label`, 100) : null;
    event[`${side}_routine_id`] = type === 'routine' ? ref(input, `${side}_routine_id`) : null;
    if (type === 'routine' && event[`${side}_routine_id`] === null) {
      throw new ValidationError('Bitte eine Routine auswählen');
    }
  }
  event.repeat = repeatInput(input.repeat, event.start_at);
  return event;
}

// Prüft die Eingaben, ohne zu speichern (z. B. bevor nach dem Umfang einer Serienänderung gefragt wird).
export function checkEvent(input) {
  eventInput(input);
}

// Wiederholung prüfen (Aufbau siehe repeat.js). null = wird nicht wiederholt.
function repeatInput(raw, startAt) {
  if (!raw) return null;
  const freq = oneOf(raw, 'freq', ['daily', 'weekly', 'monthly', 'yearly']);
  const repeat = { freq, interval: int(raw, 'interval', 1, 999, 1) };
  if (freq === 'weekly') {
    const days = [...new Set((raw.weekdays || []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    repeat.weekdays = days.length ? days.sort() : [parseDate(startAt).getDay()];
  }
  if (freq === 'monthly') {
    repeat.monthly = oneOf(raw, 'monthly', ['day', 'weekday']);
    if (repeat.monthly === 'weekday') {
      repeat.nth = [1, 2, 3, 4, -1].includes(Number(raw.nth)) ? Number(raw.nth) : repeating.nthOfMonth(parseDate(startAt));
    }
  }
  repeat.until = pattern(raw, 'until', /^\d{4}-\d{2}-\d{2}$/);
  repeat.count = repeat.until ? null : int(raw, 'count', 1, 999);
  if (repeat.until && repeat.until < startAt.slice(0, 10)) {
    throw new ValidationError('Das Ende der Wiederholung liegt vor dem ersten Termin');
  }
  return repeat;
}

export function createEvent(input) {
  const event = { id: nextId(), ...eventInput(input) };
  data.events.push(event);
  save();
  return event;
}

// scope bei wiederkehrenden Terminen (wie Google Kalender):
//   'this'      – nur der Termin am Tag occurrence (wird aus der Serie herausgelöst)
//   'following' – dieser und alle folgenden (Serie wird geteilt)
//   'all'       – alle Termine der Serie
export function updateEvent(id, input, { scope = 'all', occurrence = null } = {}) {
  const event = eventById(id);
  if (!event) throw new ValidationError('Termin nicht gefunden');
  const next = eventInput(input);

  if (!event.repeat || !occurrence) {
    Object.assign(event, next, { exdates: next.repeat ? event.exdates || [] : [] });
  } else if (scope === 'this') {
    event.exdates = [...(event.exdates || []), occurrence];
    const single = { id: nextId(), ...next, repeat: null };
    data.events.push(single);
    save();
    return single;
  } else if (scope === 'following' && occurrence > event.start_at.slice(0, 10)) {
    const before = repeating.countBefore(event, occurrence);
    const remaining = event.repeat.count ? Math.max(1, event.repeat.count - before) : null;
    if (next.repeat && remaining && next.repeat.count === event.repeat.count) next.repeat.count = remaining;
    const follow = { id: nextId(), ...next, exdates: (event.exdates || []).filter((d) => d >= occurrence) };
    event.repeat = { ...event.repeat, until: isoDate(addDays(parseDate(occurrence), -1)), count: null };
    event.exdates = (event.exdates || []).filter((d) => d < occurrence);
    data.events.push(follow);
    save();
    return follow;
  } else if (!next.repeat) {
    // Wiederholung ausgeschaltet: übrig bleibt der bearbeitete Termin.
    Object.assign(event, next, { exdates: [] });
  } else {
    // Alle Termine: Verschiebung gegenüber dem bearbeiteten Termin auf den Serienanfang übertragen.
    const shift = parseDate(next.start_at) - parseDate(repeating.onDay(event.start_at, occurrence));
    const duration = parseDate(next.end_at) - parseDate(next.start_at);
    const start = new Date(+parseDate(event.start_at) + shift);
    const dayShift = Math.round(shift / 86400000);
    Object.assign(event, next, {
      start_at: stamp(start),
      end_at: stamp(new Date(+start + duration)),
      exdates: (event.exdates || []).map((d) => isoDate(addDays(parseDate(d), dayShift))),
    });
    event.repeat = repeatInput(event.repeat, event.start_at);
  }
  save();
  return event;
}

export function deleteEvent(id, { scope = 'all', occurrence = null } = {}) {
  const event = eventById(id);
  if (event?.repeat && occurrence && scope === 'this') {
    event.exdates = [...(event.exdates || []), occurrence];
  } else if (event?.repeat && occurrence && scope === 'following' && occurrence > event.start_at.slice(0, 10)) {
    event.repeat = { ...event.repeat, until: isoDate(addDays(parseDate(occurrence), -1)), count: null };
    event.exdates = (event.exdates || []).filter((d) => d < occurrence);
  } else {
    data.events = data.events.filter((e) => e.id !== id);
  }
  save();
}
