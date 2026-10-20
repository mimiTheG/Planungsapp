// Datenhaltung auf dem Gerät (localStorage) und alle Abläufe rund um Themen, Aufgaben und Termine.

import { parseDate, stamp } from './dates.js';
import * as schedule from './schedule.js';

const STORAGE_KEY = 'planungsapp.v1';
const EMPTY = () => ({ version: 1, nextId: 1, topics: [], tasks: [], events: [], log: [] });

let data = EMPTY();
let storage = globalThis.localStorage;

export class ValidationError extends Error {}

// --- Laden & Speichern -------------------------------------------------------

export function load(customStorage) {
  if (customStorage) storage = customStorage;
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    data = raw ? { ...EMPTY(), ...JSON.parse(raw) } : EMPTY();
  } catch {
    data = EMPTY();
  }
  rollExpired();
}

function save() {
  storage?.setItem(STORAGE_KEY, JSON.stringify(data));
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
  data = { ...EMPTY(), ...parsed };
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

export function childrenOf(id) {
  return tasks().filter((t) => t.parent_id === id);
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

// "Wollte ich schon länger mal wieder machen": Projekte mit Wichtigkeit und Dringlichkeit 1.
export function isWishlist(task) {
  return task.kind === 'project' && task.importance === 1 && task.urgency === 1;
}

// Termine, die den Zeitraum [from, to] (Tage, inklusive) berühren – mit einem Tag Rand für Bereiche davor/danach.
export function eventsBetween(from, to) {
  const start = new Date(from); start.setDate(start.getDate() - 1);
  const end = new Date(to); end.setDate(end.getDate() + 2);
  return data.events
    .filter((e) => parseDate(e.end_at) >= start && parseDate(e.start_at) < end)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
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
  window_start: 'Beginn', window_end: 'Ende', deadline_time: 'Uhrzeit',
};

// --- Themen ----------------------------------------------------------------------

function topicInput(input) {
  return {
    name: text(input, 'name', 60, true),
    color: pattern(input, 'color', /^#[0-9a-fA-F]{6}$/) || '#2563eb',
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
  for (const item of [...data.tasks, ...data.events]) {
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
  Object.assign(task, next);
  save();
  return taskById(id);
}

export function deleteTask(id) {
  const ids = new Set([id, ...descendantsOf(id).map((t) => t.id)]);
  data.tasks = data.tasks.filter((t) => !ids.has(t.id));
  data.log = data.log.filter((l) => !ids.has(l.task_id));
  for (const e of data.events) {
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
  }
  save();
  return taskById(id);
}

export function reopenTask(id) {
  const task = data.tasks.find((t) => t.id === id);
  if (task) task.done_at = null;
  save();
  return taskById(id);
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
  if (changed) save();
}

// --- Termine -----------------------------------------------------------------------

function eventInput(input) {
  const dateTime = (key) => {
    const value = pattern(input, key, /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
    if (!value) throw new ValidationError(`Bitte „${LABELS[key]}“ angeben`);
    return stamp(parseDate(value));
  };
  const event = {
    title: text(input, 'title', 200, true),
    notes: text(input, 'notes', 5000),
    topic_id: ref(input, 'topic_id'),
    is_event: Boolean(input.is_event),
    start_at: dateTime('start_at'),
    end_at: dateTime('end_at'),
  };
  if (event.end_at < event.start_at) throw new ValidationError('Das Ende liegt vor dem Beginn');

  // Bereich davor/danach: frei (z. B. Anfahrt) oder eine Routine.
  for (const side of ['before', 'after']) {
    const type = oneOf(input, `${side}_type`, ['none', 'free', 'routine']);
    event[`${side}_type`] = type;
    event[`${side}_minutes`] = type === 'none' ? null : int(input, `${side}_minutes`, 1, 1440, 15);
    event[`${side}_label`] = type === 'free' ? text(input, `${side}_label`, 100) : null;
    event[`${side}_routine_id`] = type === 'routine' ? ref(input, `${side}_routine_id`) : null;
    if (type === 'routine' && event[`${side}_routine_id`] === null) {
      throw new ValidationError('Bitte eine Routine auswählen');
    }
  }
  return event;
}

export function createEvent(input) {
  const event = { id: nextId(), ...eventInput(input) };
  data.events.push(event);
  save();
  return event;
}

export function updateEvent(id, input) {
  const event = data.events.find((e) => e.id === id);
  if (!event) throw new ValidationError('Termin nicht gefunden');
  Object.assign(event, eventInput(input));
  save();
  return event;
}

export function deleteEvent(id) {
  data.events = data.events.filter((e) => e.id !== id);
  save();
}
