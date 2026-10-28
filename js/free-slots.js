// Freie Zeiten an einem Tag zwischen den Terminen – für das Einplanen von Aufgaben und Routinen.
// Reine Funktionen ohne Oberfläche (geprüft in tests/free-slots.test.js).

import { addDays, parseDate, startOfDay } from './dates.js';

export const DAY_FROM = 6 * 60; // frühester Vorschlag 6:00
export const DAY_TO = 23 * 60; // spätestes Ende 23:00
const STEP = 15; // Minuten-Raster

// Belegte Zeiten (Termine mit Uhrzeit, nicht ganztägig) an einem Tag, zusammengefasst und sortiert:
// [{ start, end }] als Date, auf den Tag zugeschnitten.
export function busyIntervals(events, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const parts = events
    .filter((e) => !e.all_day)
    .map((e) => ({ start: parseDate(e.start_at), end: parseDate(e.end_at) }))
    .filter((p) => p.end > dayStart && p.start < dayEnd && p.end > p.start)
    .map((p) => ({ start: new Date(Math.max(p.start, dayStart)), end: new Date(Math.min(p.end, dayEnd)) }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const p of parts) {
    const last = merged.at(-1);
    if (last && p.start <= last.end) last.end = new Date(Math.max(last.end, p.end));
    else merged.push({ ...p });
  }
  return merged;
}

const roundUp = (date) => {
  const d = new Date(date);
  const minutes = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0);
  const rounded = Math.ceil(minutes / STEP) * STEP;
  d.setHours(0, rounded, 0, 0);
  return d;
};

// Lücken zwischen den Terminen (von DAY_FROM bis DAY_TO), in die minutes passen. Heute erst ab jetzt
// (aufgerundet auf 15 Minuten). Ergebnis: [{ start, end }] – start ist der früheste mögliche Beginn.
export function freeSlots(events, day, minutes, { now = new Date(), from = DAY_FROM, to = DAY_TO } = {}) {
  const dayStart = startOfDay(day);
  let cursor = new Date(+dayStart + from * 60000);
  const limit = new Date(+dayStart + to * 60000);
  if (now > cursor) cursor = roundUp(now);
  const slots = [];
  for (const busy of [...busyIntervals(events, day), { start: limit, end: limit }]) {
    const gapEnd = new Date(Math.min(busy.start, limit));
    if (gapEnd - cursor >= minutes * 60000) slots.push({ start: new Date(cursor), end: gapEnd });
    if (busy.end > cursor) cursor = roundUp(busy.end);
    if (cursor >= limit) break;
  }
  return slots;
}

// Überschneidet sich [start, start + minutes) mit einem Termin?
export function overlaps(events, start, minutes) {
  const end = new Date(+start + minutes * 60000);
  return busyIntervals(events, start).some((b) => b.start < end && b.end > start);
}
