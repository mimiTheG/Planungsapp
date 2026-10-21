// Wiederkehrende Termine (ähnlich Google Kalender) – reine Funktionen, ohne Speicherzugriff.
//
// event.repeat = {
//   freq: 'daily' | 'weekly' | 'monthly' | 'yearly',
//   interval: 1,                 // alle n Tage/Wochen/Monate/Jahre
//   weekdays: [1, 3],            // nur wöchentlich: 0 = So … 6 = Sa
//   monthly: 'day' | 'weekday',  // nur monatlich: am 14. bzw. am zweiten Dienstag
//   nth: 2,                      // nur monatlich nach Wochentag: 1–4, -1 = letzter
//   until: 'JJJJ-MM-TT' | null,  // endet am (inklusive)
//   count: 10 | null,            // endet nach n Terminen
// }
// event.exdates = ['JJJJ-MM-TT', …]  – einzelne gelöschte/abgetrennte Termine der Serie

import { addDays, formatDate, isoDate, parseDate, startOfDay, startOfWeek, stamp } from './dates.js';

export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const ORDINALS = { 1: 'ersten', 2: 'zweiten', 3: 'dritten', 4: 'vierten', '-1': 'letzten' };
const UNITS = { daily: 'Tage', weekly: 'Wochen', monthly: 'Monate', yearly: 'Jahre' };
const MAX_STEPS = 20000;


// Der wievielte Wochentag im Monat ist das Datum? Ein fünfter zählt als letzter (-1).
export function nthOfMonth(date) {
  const nth = Math.ceil(date.getDate() / 7);
  return nth >= 5 ? -1 : nth;
}

export function isLastWeekdayOfMonth(date) {
  return date.getDate() + 7 > new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function nthWeekday(year, month, weekday, nth) {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0);
    return addDays(last, -((last.getDay() - weekday + 7) % 7));
  }
  const first = new Date(year, month, 1);
  const date = addDays(first, ((weekday - first.getDay() + 7) % 7) + (nth - 1) * 7);
  return date.getMonth() === month ? date : null;
}

// Mögliche Termintage der Serie in zeitlicher Reihenfolge (ohne Ende/Ausnahmen). Der Starttag gehört immer
// dazu – auch wenn er nicht zur Regel passt (z. B. ein auf Dienstag verschobener Termin einer Montagsserie, ab dem
// „dieser und alle folgenden“ geändert wird). So machen es auch andere Kalender.
export function* candidateDays(repeat, first) {
  const days = ruleDays(repeat, first);
  const next = days.next();
  if (next.done) return;
  if (+next.value !== +first) yield first;
  yield next.value;
  yield* days;
}

function* ruleDays(repeat, first) {
  const interval = Math.max(1, repeat.interval || 1);
  if (repeat.freq === 'daily') {
    for (let k = 0; ; k += interval) yield addDays(first, k);
  }
  if (repeat.freq === 'weekly') {
    const days = (repeat.weekdays?.length ? repeat.weekdays : [first.getDay()])
      .map((d) => (d + 6) % 7) // Montag = 0
      .sort((a, b) => a - b);
    const monday = startOfWeek(first);
    for (let w = 0; ; w += interval) {
      for (const offset of days) {
        const day = addDays(monday, w * 7 + offset);
        if (day >= first) yield day;
      }
    }
  }
  if (repeat.freq === 'monthly') {
    for (let m = 0; ; m += interval) {
      const monthStart = new Date(first.getFullYear(), first.getMonth() + m, 1);
      if (repeat.monthly === 'weekday') {
        const day = nthWeekday(monthStart.getFullYear(), monthStart.getMonth(), first.getDay(), repeat.nth || nthOfMonth(first));
        if (day && day >= first) yield day;
      } else {
        const day = new Date(monthStart.getFullYear(), monthStart.getMonth(), first.getDate());
        if (day.getDate() === first.getDate()) yield day; // z. B. kein 31. im April → auslassen
      }
    }
  }
  if (repeat.freq === 'yearly') {
    for (let y = 0; ; y += interval) {
      const day = new Date(first.getFullYear() + y, first.getMonth(), first.getDate());
      if (day.getMonth() === first.getMonth()) yield day; // 29. Februar nur in Schaltjahren
    }
  }
}

// Alle Termine einer Serie, die den Zeitraum [rangeStart, rangeEnd) berühren.
// Gibt { start, end, occurrence } zurück (start/end als Date, occurrence als 'JJJJ-MM-TT').
export function occurrences(event, rangeStart, rangeEnd) {
  const start = parseDate(event.start_at);
  const duration = parseDate(event.end_at) - start;
  if (!event.repeat) {
    const end = new Date(+start + duration);
    return end > rangeStart && start < rangeEnd ? [{ start, end, occurrence: isoDate(start) }] : [];
  }
  const { until, count } = event.repeat;
  const untilDay = until ? parseDate(until) : null;
  const exdates = new Set(event.exdates || []);
  const result = [];
  let index = 0;
  let steps = 0;
  for (const day of candidateDays(event.repeat, startOfDay(start))) {
    if (++steps > MAX_STEPS) break;
    if (untilDay && day > untilDay) break;
    if (count && index >= count) break;
    index += 1;
    const begin = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes());
    if (begin >= rangeEnd) break;
    const key = isoDate(day);
    if (exdates.has(key)) continue;
    const end = new Date(+begin + duration);
    if (end > rangeStart) result.push({ start: begin, end, occurrence: key });
  }
  return result;
}

// Wie viele Termine der Serie liegen vor dem Tag `day`? (für "dieser und alle folgenden" mit Anzahl)
export function countBefore(event, day) {
  return occurrences({ ...event, exdates: [] }, new Date(0), startOfDay(parseDate(day))).length;
}

// Verschiebt einen Zeitpunkt auf ein anderes Datum, Uhrzeit bleibt.
export function onDay(dateTime, day) {
  const d = parseDate(dateTime);
  const target = parseDate(day);
  return stamp(new Date(target.getFullYear(), target.getMonth(), target.getDate(), d.getHours(), d.getMinutes()));
}

// --- Texte & Vorschläge -------------------------------------------------------------

function weekdayList(days) {
  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (sorted.join() === '1,2,3,4,5') return 'Mo–Fr';
  return sorted.map((d) => WEEKDAYS_SHORT[d]).join(', ');
}

export function repeatText(repeat, startAt) {
  if (!repeat) return 'Wird nicht wiederholt';
  const start = parseDate(startAt);
  const n = Math.max(1, repeat.interval || 1);
  let text = n === 1
    ? { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich', yearly: 'Jährlich' }[repeat.freq]
    : `Alle ${n} ${UNITS[repeat.freq]}`;
  if (repeat.freq === 'weekly') {
    const days = repeat.weekdays?.length ? repeat.weekdays : [start.getDay()];
    text += days.length === 1 ? ` am ${WEEKDAYS[days[0]]}` : ` am ${weekdayList(days)}`;
  }
  if (repeat.freq === 'monthly') {
    text += repeat.monthly === 'weekday'
      ? ` am ${ORDINALS[repeat.nth || nthOfMonth(start)]} ${WEEKDAYS[start.getDay()]}`
      : ` am ${start.getDate()}.`;
  }
  if (repeat.freq === 'yearly') text += ` am ${formatDate(start, { day: 'numeric', month: 'long' })}`;
  if (repeat.until) text += `, bis ${formatDate(repeat.until, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  if (repeat.count) text += `, ${repeat.count}-mal`;
  return text;
}

// Vorschläge wie bei Google Kalender, passend zum Startdatum.
export function presets(startAt) {
  const start = parseDate(startAt);
  const wd = start.getDay();
  const nth = isLastWeekdayOfMonth(start) && Math.ceil(start.getDate() / 7) >= 4 ? -1 : Math.ceil(start.getDate() / 7);
  return [
    ['none', null],
    ['daily', { freq: 'daily', interval: 1 }],
    ['weekly', { freq: 'weekly', interval: 1, weekdays: [wd] }],
    ['monthly-weekday', { freq: 'monthly', interval: 1, monthly: 'weekday', nth }],
    ['monthly-day', { freq: 'monthly', interval: 1, monthly: 'day' }],
    ['yearly', { freq: 'yearly', interval: 1 }],
    ['workdays', { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }],
  ].map(([key, repeat]) => ({ key, repeat, label: key === 'workdays' ? 'Jeden Werktag (Montag bis Freitag)' : repeatText(repeat, startAt) }));
}

// Welcher Vorschlag passt zu einer gespeicherten Wiederholung? Sonst 'custom'.
export function presetKey(repeat, startAt) {
  if (!repeat) return 'none';
  const match = presets(startAt).find((p) => p.repeat && JSON.stringify(normalize(p.repeat)) === JSON.stringify(normalize(repeat)));
  return match ? match.key : 'custom';
}

export function normalize(repeat) {
  return {
    freq: repeat.freq,
    interval: Math.max(1, repeat.interval || 1),
    weekdays: repeat.freq === 'weekly' ? [...(repeat.weekdays || [])].sort() : null,
    monthly: repeat.freq === 'monthly' ? repeat.monthly || 'day' : null,
    nth: repeat.freq === 'monthly' && repeat.monthly === 'weekday' ? repeat.nth : null,
    until: repeat.until || null,
    count: repeat.count || null,
  };
}

