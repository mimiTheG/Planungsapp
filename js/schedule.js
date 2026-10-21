// Fälligkeitslogik für Aufgaben (reine Funktionen, ohne Speicherzugriff).
//
// Regelmäßig (recurrence 'rhythm'): Wiederholung wie bei Terminen (task.repeat, z. B. wöchentlich am Montag,
// monatlich am 14.), beginnend am Tag repeat_start.
//   - Puffer (task.buffer) gilt in beide Richtungen: 0 = nur am Termintag, 1 = vom Tag davor bis zum Tag danach.
//   - Fest (Standard): Die Termintage stehen fest – wann man erledigt, ändert nichts daran.
//   - repeat_from_done: Gezählt wird ab dem Erledigen, z. B. alle 6 Wochen nach dem letzten Haareschneiden.
// Ältere Aufgaben ohne repeat haben rhythm_days: nächster Termintag = Tag des Erledigens + rhythm_days.
// Beispiel alle 7 Tage, Puffer 1: erledigt am 1. → Termintag 8., fällig 7.–9.
//
// Fester Zeitraum: jedes Jahr zwischen period_start und period_end (MM-TT), z. B. 03-01 bis 09-30.

import { addDays, isoDate, parseDate, startOfDay } from './dates.js';
import { candidateDays } from './repeat.js';

// Erster Tag der Serie (Beginn anchor) am oder nach dem Tag from.
export function nextRepeatDay(repeat, anchor, from) {
  const first = startOfDay(typeof anchor === 'string' ? parseDate(anchor) : anchor);
  const min = startOfDay(from);
  let steps = 0;
  for (const day of candidateDays(repeat, first)) {
    if (day >= min) return day;
    if (++steps > 20000) break;
  }
  return min;
}

const usesRepeat = (task) => Boolean(task.repeat);

// Ab dem Erledigen zählen: nur „alle n Tage/Wochen/Monate/Jahre“ – Wochentag bzw. Datum ergeben sich aus dem Tag,
// an dem man erledigt hat (6 Wochen nach Do., 5.11. → Do., 17.12.).
function fromDoneRepeat(repeat, day) {
  return { freq: repeat.freq, interval: repeat.interval, weekdays: [day.getDay()], monthly: 'day' };
}

export function nextRhythmStart(doneDay, rhythmDays) {
  return addDays(startOfDay(doneDay), Math.max(1, rhythmDays));
}

// Fenster um einen Termintag: buffer Tage davor bis buffer Tage danach (0 = nur der Tag selbst).
export function rhythmWindow(day, buffer) {
  const d = startOfDay(day);
  const b = Math.max(0, Number(buffer) || 0);
  return [addDays(d, -b), addDays(d, b)];
}

// Termintag des aktuellen Fensters (die Mitte).
function currentDay(task) {
  return addDays(parseDate(task.window_start), Math.max(0, Number(task.buffer) || 0));
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
  if (task.recurrence === 'rhythm' && usesRepeat(task)) {
    const anchor = startDate ? parseDate(startDate) : today;
    return asStrings(rhythmWindow(nextRepeatDay(task.repeat, anchor, anchor), task.buffer));
  }
  if (task.recurrence === 'rhythm') {
    return asStrings(rhythmWindow(startDate ? parseDate(startDate) : today, task.buffer));
  }
  if (task.recurrence === 'period') {
    return asStrings(periodWindow(task.period_start, task.period_end, today));
  }
  return [null, null];
}

// Fenster nach dem Erledigen.
export function windowAfterDone(task, doneAt) {
  if (task.recurrence === 'rhythm' && usesRepeat(task)) {
    const doneDay = startOfDay(doneAt);
    if (task.repeat_from_done) {
      // Neu zählen ab dem Erledigen: nächster Tag einer Serie, die heute beginnt.
      return asStrings(rhythmWindow(nextRepeatDay(fromDoneRepeat(task.repeat, doneDay), doneDay, addDays(doneDay, 1)), task.buffer));
    }
    // Feste Tage: nächster Termintag nach dem aktuellen Fenster (bzw. nach heute, wenn man spät dran war).
    const current = task.window_start ? currentDay(task) : doneDay;
    const after = addDays(new Date(Math.max(current, doneDay)), 1);
    return asStrings(rhythmWindow(nextRepeatDay(task.repeat, task.repeat_start || current, after), task.buffer));
  }
  if (task.recurrence === 'rhythm') {
    return asStrings(rhythmWindow(nextRhythmStart(doneAt, task.rhythm_days), task.buffer));
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
  if (task.recurrence === 'rhythm' && usesRepeat(task)) {
    let start = currentDay(task);
    const anchor = task.repeat_from_done ? start : task.repeat_start || start;
    const repeat = task.repeat_from_done ? fromDoneRepeat(task.repeat, start) : task.repeat;
    let window;
    let steps = 0;
    do {
      start = nextRepeatDay(repeat, anchor, addDays(start, 1));
      window = asStrings(rhythmWindow(start, task.buffer));
    } while (closesAt({ ...task, window_end: window[1] }) <= now && ++steps < 5000);
    return window;
  }
  if (task.recurrence === 'rhythm') {
    const step = Math.max(1, task.rhythm_days);
    let start = currentDay(task);
    let window;
    do {
      start = addDays(start, step);
      window = asStrings(rhythmWindow(start, task.buffer));
    } while (closesAt({ ...task, window_end: window[1] }) <= now);
    return window;
  }
  if (task.recurrence === 'period') {
    const from = addDays(parseDate(task.window_end), 1);
    return asStrings(periodWindow(task.period_start, task.period_end, new Date(Math.max(from, now))));
  }
  return [null, null];
}
