// Bereiche von „Was mache ich jetzt?“ – reine Logik ohne Oberfläche (wird in tests/now.test.js geprüft).

import { addDays, daysBetween, parseDate, startOfDay } from './dates.js';
import * as store from './store.js';

const ACTIVE = ['open', 'due', 'overdue'];

// Priorität 1–25 (höher = zuerst). Skala: Wichtigkeit/Dringlichkeit 5 = sehr wichtig/sofort … 1 = unwichtig/kein Zeitdruck.
export function priority(task, level = 'sachlich') {
  return level === 'emotional'
    ? task.importance_emo * task.urgency_emo
    : task.importance * task.urgency;
}

// Überfällig: Zeit abgelaufen – bei „täglich erinnern“ (overdue) und bei einmaligen Aufgaben auch mit „verfällt“
// (die verschwinden sonst einfach).
export const isOverdue = (t) => t.status === 'overdue' || (t.recurrence === 'once' && t.status === 'expired');

// Ganze Tage bis zum Ende des Zeitraums (0 = heute ist der letzte Tag).
export function daysLeft(task, now = new Date()) {
  return Math.max(0, daysBetween(now, parseDate(task.window_end)));
}

const byPriority = (a, b) => priority(b) - priority(a);

// Eingeplante Zeiten (Termine mit task_id) ab heute bis in zwei Wochen, je Aufgabe:
//   running – Aufgaben, deren geplante Zeit gerade läuft (stehen dann nur unter „Läuft gerade“)
//   next    – Map Aufgabe → nächste geplante Zeit, die noch nicht vorbei ist ({ start, end })
export function plannedNow(now = new Date()) {
  const running = new Set();
  const next = new Map();
  const events = store.eventsBetween(startOfDay(now), addDays(startOfDay(now), 14))
    .filter((e) => e.task_id)
    .map((e) => ({ id: e.task_id, start: parseDate(e.start_at), end: parseDate(e.end_at) }))
    .sort((a, b) => a.start - b.start);
  for (const slot of events) {
    if (slot.end <= now) continue; // vorbei – zählt nicht mehr (Aufgabe steht wieder normal da, falls offen)
    if (slot.start <= now) running.add(slot.id);
    if (!next.has(slot.id)) next.set(slot.id, { start: slot.start, end: slot.end });
  }
  return { running, next };
}

// Liefert { items, overdue, today, rest, upcoming, plans }:
//   overdue  – Überfällig, auch Unteraufgaben (außer ihre Oberaufgabe steht schon hier).
//              Nach W×D, bei Gleichstand am längsten überfällig zuerst.
//   today    – Heute fällig: alles mit Deadline, dessen Zeitraum läuft (ohne „Ab“ = ab sofort) – auch Unteraufgaben,
//              außer ihre Oberaufgabe steht schon hier oder bei „Überfällig“. Nach W×D, bei Gleichstand nach verbleibender Zeit.
//   rest     – alles andere Offene der obersten Ebene, nach W×D.
//   upcoming – Demnächst: oberste Ebene und Aufgaben mehrtägiger Routinen, früheste zuerst (höchstens 8).
//   items    – alles Offene der obersten Ebene (für die Zufallsauswahl).
//   plans    – nächste geplante Zeit je Aufgabe (für den Hinweis „📅 heute 15:00“).
// Jede Aufgabe steht höchstens einmal da. Läuft ihre geplante Zeit gerade, steht sie nur unter „Läuft gerade“;
// ist die Zeit vorbei und sie ist noch offen, steht sie wieder in ihrem Bereich.
export function nowSections(now = new Date()) {
  const { running, next } = plannedNow(now);
  const everything = store.tasks(now)
    .filter((t) => t.kind !== 'routine' && !store.isInRoutine(t) && !running.has(t.id));
  const byId = new Map(everything.map((t) => [t.id, t]));
  const parentOf = (id) => byId.get(id)?.parent_id ?? store.taskById(id)?.parent_id ?? null;
  const hasAncestorIn = (ids, t) => {
    for (let p = t.parent_id; p !== null; p = parentOf(p)) if (ids.has(p)) return true;
    return false;
  };
  const items = everything.filter((t) => t.parent_id === null && (ACTIVE.includes(t.status) || isOverdue(t)));

  const overdueIds = new Set(everything.filter(isOverdue).map((t) => t.id));
  const overdue = everything.filter((t) => overdueIds.has(t.id) && !hasAncestorIn(overdueIds, t))
    .sort((a, b) => byPriority(a, b) || String(a.closes_at).localeCompare(String(b.closes_at)));

  const dueIds = new Set(everything.filter((t) => t.status === 'due' && t.window_end).map((t) => t.id));
  const today = everything.filter((t) => dueIds.has(t.id) && !hasAncestorIn(dueIds, t) && !hasAncestorIn(overdueIds, t))
    .sort((a, b) => byPriority(a, b) || daysLeft(a, now) - daysLeft(b, now));

  const rest = items.filter((t) => !isOverdue(t) && !(t.status === 'due' && t.window_end)).sort(byPriority);

  const upcoming = everything
    .filter((t) => t.status === 'upcoming' && (t.parent_id === null || store.isMultiRoutine(store.taskById(t.parent_id))))
    .sort((a, b) => a.window_start.localeCompare(b.window_start))
    .slice(0, 8);

  return { items, overdue, today, rest, upcoming, plans: next };
}
