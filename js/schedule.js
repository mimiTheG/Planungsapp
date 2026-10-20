// Fälligkeitslogik für Aufgaben (reine Funktionen, ohne Speicherzugriff).
//
// Fester Rhythmus: Das Fenster dauert buffer_days Tage. Wird die Aufgabe an Tag D erledigt
// (Tag 1 = erster Tag des Fensters), beginnt das nächste Fenster an Tag D + rhythm_days - 1.
// Beispiel Rhythmus 7, Puffer 3: erledigt an Tag 1 → fällig Tag 7–9, an Tag 3 → Tag 9–11.
//
// Fester Zeitraum: jedes Jahr zwischen period_start und period_end (MM-TT), z. B. 03-01 bis 09-30.

import { addDays, isoDate, parseDate, startOfDay } from './dates.js';

export function nextRhythmStart(doneDay, rhythmDays) {
  return addDays(startOfDay(doneDay), Math.max(1, rhythmDays - 1));
}

// Fenster für einen Rhythmus, das an start beginnt.
export function rhythmWindow(start, bufferDays) {
  const s = startOfDay(start);
  return [s, addDays(s, Math.max(1, bufferDays) - 1)];
}

function monthDay(md, year) {
  const [m, d] = md.split('-').map(Number);
  // 29. Februar in Nicht-Schaltjahren → 28. Februar.
  const lastDay = new Date(year, m, 0).getDate();
  return new Date(year, m - 1, Math.min(d, lastDay));
}

function periodForYear(startMd, endMd, year) {
  const start = monthDay(startMd, year);
  let end = monthDay(endMd, year);
  if (end < start) end = monthDay(endMd, year + 1); // über den Jahreswechsel, z. B. 11-01 bis 02-28
  return [start, end];
}

// Erstes Jahres-Zeitfenster, das nicht vor from endet.
export function periodWindow(startMd, endMd, from) {
  const day = startOfDay(from);
  const year = day.getFullYear();
  for (const y of [year - 1, year, year + 1]) {
    const [start, end] = periodForYear(startMd, endMd, y);
    if (end >= day) return [start, end];
  }
  return periodForYear(startMd, endMd, year + 2);
}

// Zeitpunkt, ab dem das Fenster vorbei ist (Ende des letzten Tages bzw. die Deadline-Uhrzeit).
export function closesAt(task) {
  if (!task.window_end) return null;
  const end = parseDate(task.window_end);
  if (task.deadline_time) {
    const [h, m] = task.deadline_time.split(':').map(Number);
    end.setHours(h, m);
    return end;
  }
  return addDays(end, 1);
}

// Status einer Aufgabe: open, upcoming, due, overdue, expired, done, routine.
export function status(task, now = new Date()) {
  if (task.recurrence === 'once') {
    if (task.kind === 'routine') return 'routine';
    if (task.done_at) return 'done';
  }
  if (!task.window_start && !task.window_end) return 'open';
  if (task.window_start && now < parseDate(task.window_start)) return 'upcoming';
  const closes = closesAt(task);
  if (closes && now >= closes) return task.on_missed === 'remind' ? 'overdue' : 'expired';
  return 'due';
}

const asStrings = ([start, end]) => [isoDate(start), isoDate(end)];

// Erstes Fenster beim Anlegen/Ändern einer wiederkehrenden Aufgabe.
export function initialWindow(task, startDate, today = new Date()) {
  if (task.recurrence === 'rhythm') {
    return asStrings(rhythmWindow(startDate ? parseDate(startDate) : today, task.buffer_days));
  }
  if (task.recurrence === 'period') {
    return asStrings(periodWindow(task.period_start, task.period_end, today));
  }
  return [null, null];
}

// Fenster nach dem Erledigen.
export function windowAfterDone(task, doneAt) {
  if (task.recurrence === 'rhythm') {
    return asStrings(rhythmWindow(nextRhythmStart(doneAt, task.rhythm_days), task.buffer_days));
  }
  if (task.recurrence === 'period') {
    // Im aktuellen Zeitraum erledigt → nächster Zeitraum (ein Jahr später).
    const currentEnd = task.window_end ? parseDate(task.window_end) : startOfDay(doneAt);
    const from = addDays(new Date(Math.max(currentEnd, startOfDay(doneAt))), 1);
    return asStrings(periodWindow(task.period_start, task.period_end, from));
  }
  return [null, null];
}

// Fenster nach einem verpassten (verfallenen) Durchgang: so weit schieben, bis es wieder offen ist.
export function windowAfterMissed(task, now = new Date()) {
  if (task.recurrence === 'rhythm') {
    const step = Math.max(1, task.rhythm_days);
    let start = parseDate(task.window_start);
    let window;
    do {
      start = addDays(start, step);
      window = asStrings(rhythmWindow(start, task.buffer_days));
    } while (closesAt({ ...task, window_end: window[1] }) <= now);
    return window;
  }
  if (task.recurrence === 'period') {
    const from = addDays(parseDate(task.window_end), 1);
    return asStrings(periodWindow(task.period_start, task.period_end, new Date(Math.max(from, now))));
  }
  return [null, null];
}
