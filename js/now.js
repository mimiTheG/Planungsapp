// "Was mache ich jetzt?" – offene Aufgaben und Projekte, Wunschliste und Zufallsauswahl.

import {
  el, mount, field, formData, openDialog, closeDialog, toast, attempt,
} from './ui.js';
import {
  daysBetween, formatDate, formatDuration, formatTime, hoursText, parseDate, spanText, stamp,
} from './dates.js';
import * as store from './store.js';
import {
  KIND_LABELS, cancelRoutine, completeTask, openTaskEditor, progressBar, recurrenceText, routineChecklist,
  routineProgress, runRoutine, topicDot, windowText,
} from './tasks.js';
import { topicPicker } from './topic-picker.js';
import { birthdayAge } from './calendar.js';
import { daysLeft, isOverdue, nowSections, priority } from './sections.js';

// Gewicht für die Zufallsauswahl: Priorität (1–25), Überfälliges zählt doppelt. Wünsche haben keine Priorität.
function weight(item) {
  if (item.isWish) return 1;
  return priority(item) * (isOverdue(item) ? 2 : 1);
}

// Verbleibende Zeit: „noch 3 Tage“, „noch 2 Wochen“ – am letzten Tag mit Uhrzeit „noch 3 Std.“.
function leftText(task, days) {
  if (days > 0) return `noch ${spanText(days)}`;
  if (task.deadline_time && task.closes_at) return `noch ${hoursText(parseDate(task.closes_at) - new Date())}`;
  return 'letzter Tag';
}

function pickRandom(items) {
  const total = items.reduce((sum, t) => sum + weight(t), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

// Unteraufgaben (beliebig tief) zum direkten Abhaken; erledigte bleiben durchgestrichen sichtbar.
function subtaskList(task, refresh) {
  const children = store.childrenOf(task.id);
  if (!children.length) return null;
  return el('ul.subtasks', {}, children.map((child) => el('li', {},
    el(`label.check${child.done_at ? '.done' : ''}`, {},
      el('input', {
        type: 'checkbox',
        checked: Boolean(child.done_at),
        disabled: child.recurrence !== 'once',
        onchange: () => {
          attempt(() => (child.done_at ? store.reopenTask(child.id) : store.completeTask(child.id)));
          refresh();
        },
      }),
      el('span', {}, child.title)),
    subtaskList(child, refresh))));
}

// Hinweis auf die nächste geplante Zeit: „📅 heute 15:00“, „📅 morgen 9:00“, „📅 Mo., 20.10. 15:00“.
function planText(plan, now = new Date()) {
  const days = daysBetween(now, plan.start);
  const day = days === 0 ? 'heute' : days === 1 ? 'morgen' : formatDate(plan.start, { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `📅 ${day} ${formatTime(plan.start)}`;
}

function nowItem(task, refresh, { left = false, plan = null } = {}) {
  const openSubtasks = store.childrenOf(task.id).filter((c) => c.status !== 'done').length;
  const parent = task.parent_id ? store.taskById(task.parent_id) : null;
  const days = left ? daysLeft(task) : null;
  return el(`li.now-item.status-${task.status}`, {},
    el('div.now-text', {},
      el('button.link.task-title', { type: 'button', onclick: () => openTaskEditor(task, refresh) }, topicDot(task), store.shownTitle(task)),
      el('div.meta', {},
        task.upgrades?.length ? el('span.badge.upgrade', {}, `⬆ diesmal mit ${task.upgrades.length === 1 ? 'Steigerung' : `${task.upgrades.length} Steigerungen`}`) : null,
        task.kind !== 'todo' ? el(`span.badge.kind.${task.kind}`, {}, KIND_LABELS[task.kind]) : null,
        el('span.badge', { title: 'Wichtigkeit / Dringlichkeit' }, `W${task.importance} · D${task.urgency}`),
        task.recurrence !== 'once' ? el('span.badge', {}, `↻ ${recurrenceText(task)}`) : null,
        windowText(task) ? el(`span.badge.status-${task.status}`, {}, windowText(task)) : null,
        left ? el('span.badge.days-left', {}, leftText(task, days)) : null,
        plan ? el('span.badge.planned', { title: 'Eingeplant' }, planText(plan)) : null,
        parent ? el('span.badge', {}, `in: ${parent.title}`) : null,
        openSubtasks ? el('span.badge', {}, `${openSubtasks} offen`) : null),
      progressBar(task),
      subtaskList(task, refresh)),
    el('button.done-btn', { type: 'button', 'aria-label': 'Erledigt', onclick: () => completeTask(task, refresh) }, '✓'));
}

// --- Wollte ich schon länger mal wieder machen ---------------------------------

function lastDoneText(wish) {
  if (!wish.last_done_at) return 'noch nie gemacht';
  const days = daysBetween(parseDate(wish.last_done_at), new Date());
  if (days === 0) return 'heute gemacht';
  if (days === 1) return 'gestern gemacht';
  return `zuletzt vor ${spanText(days, { dative: true })}`;
}

function doneWish(wish, refresh) {
  store.doneWish(wish.id);
  toast(`Schön! „${wish.title}“ gemacht`);
  refresh();
}

function wishItem(wish, refresh) {
  return el('li.now-item.wish', {},
    el('div.now-text', {},
      el('button.link.task-title', { type: 'button', onclick: () => openWishEditor(wish, refresh) }, topicDot(wish), wish.title),
      el('div.meta', {}, el('span.badge.wish', {}, lastDoneText(wish)))),
    el('button.done-btn', { type: 'button', 'aria-label': 'Gemacht', onclick: () => doneWish(wish, refresh) }, '♥'));
}

function openWishEditor(wish, refresh) {
  const isNew = !wish.id;
  const form = el('form.form-grid', {
    onsubmit: (e) => {
      e.preventDefault();
      const d = formData(form);
      if (!attempt(() => (isNew ? store.createWish(d) : store.updateWish(wish.id, d)))) return;
      close();
      refresh();
    },
  },
  field('Was wolltest du schon länger mal wieder machen?', el('input', { name: 'title', required: true, maxlength: 200, value: wish.title || '' })),
  topicPicker(wish.topic_id),
  field('Notizen', el('textarea', { name: 'notes', rows: 3 }, wish.notes || '')),
  isNew ? null : el('p.muted', {}, lastDoneText(wish)),
  el('div.buttons.sticky', {},
    el('button.primary', { type: 'submit' }, isNew ? 'Hinzufügen' : 'Speichern'),
    isNew ? null : el('button.danger', {
      type: 'button',
      onclick: () => {
        if (!window.confirm(`„${wish.title}“ von der Liste nehmen?`)) return;
        store.deleteWish(wish.id);
        close();
        refresh();
      },
    }, 'Löschen')));
  const close = openDialog(isNew ? 'Neuer Eintrag' : 'Bearbeiten', form);
}

// --- Läuft gerade: Termine und Routinen, die jetzt stattfinden -----------------

// Was heute (ab 4:30) läuft oder lief: laufende Termine sowie Routinen, die begonnen haben und
// noch nicht abgeschlossen sind – auch wenn ihre Zeit schon vorbei ist (dann "abgelaufen").
function runningNow(now = new Date()) {
  const dayStart = store.dayStart(now);
  const items = [];
  for (const ev of store.eventsBetween(dayStart, now)) {
    const start = parseDate(ev.start_at);
    const end = parseDate(ev.end_at);
    const task = ev.task_id ? store.taskById(ev.task_id) : null; // eingeplante Aufgabe
    const title = ev.is_birthday ? `🎂 ${ev.title}${birthdayAge(ev)}` : task ? store.shownTitle(task) : ev.title;
    const parts = [{ from: start, to: end, routineId: ev.routine_id, title, allDay: ev.all_day, task }];
    for (const part of parts) {
      if (part.from > now) continue;
      const routine = part.routineId ? store.taskById(part.routineId) : null;
      if (routine) {
        // Seit Beginn abgeschlossen oder schon vor 4:30 begonnen → nicht mehr anzeigen.
        if (part.from < dayStart || (routine.last_done_at && routine.last_done_at >= stamp(part.from))) continue;
      } else if (!part.title || part.to <= now) {
        continue;
      }
      items.push({ ...part, routine, topicId: ev.topic_id, title: routine ? routine.title : part.title, expired: part.to <= now });
    }
  }
  return items.sort((a, b) => a.from - b.from);
}

function runningItem(item, refresh) {
  const time = item.allDay ? 'ganztägig' : `${formatTime(item.from)}–${formatTime(item.to)}`;
  const head = el('div.running-head', {},
    el('span.dot', { style: { background: store.topicColor(item.routine?.topic_id ?? item.topicId) } }),
    el('strong', {}, item.title),
    el('span.badge', {}, item.routine ? `Routine · ${time}` : time),
    item.expired ? el('span.badge.expired-badge', {}, 'abgelaufen') : null);
  // Eingeplante Aufgabe: direkt hier abhaken.
  if (item.task) {
    const done = item.task.status === 'done';
    return el('li.running', {}, head,
      done ? el('span.badge', {}, '✓ erledigt')
        : el('button.primary', { type: 'button', onclick: () => completeTask(item.task, refresh) }, '✓ Aufgabe erledigt'));
  }
  if (!item.routine) return el('li.running', {}, head);

  // Routine: Schritte (mit Unterschritten) direkt hier abhaken.
  const { done, total } = routineProgress(item.routine);
  const running = store.activeRoutine()?.routine.id === item.routine.id;
  return el(`li.running${item.expired ? '.expired' : ''}`, {},
    head,
    total ? el('progress', { max: total, value: done }) : null,
    routineChecklist(item.routine, refresh),
    el('div.buttons', {},
      el('button.primary', { type: 'button', onclick: () => completeTask(item.routine, refresh) },
        done === total ? '✓ Routine abschließen' : 'Trotzdem abschließen'),
      running ? null : el('button', { type: 'button', onclick: () => runRoutine(item.routine, refresh) }, '▶ Start'),
      running || done ? el('button.danger', { type: 'button', onclick: () => cancelRoutine(item.routine, refresh) }, 'Abbrechen') : null));
}

// Solange "Jetzt" offen ist, jede Minute aktualisieren (laufende Termine kommen und gehen).
let nowTimer = null;

// --- Ansicht ---------------------------------------------------------------------

export function renderNowView(root) {
  const refresh = () => renderNowView(root);
  clearInterval(nowTimer);
  nowTimer = setInterval(() => {
    if (location.hash !== '#jetzt' || document.getElementById('dialog').open) return clearInterval(nowTimer);
    refresh();
  }, 60000);
  const running = runningNow();
  // Bereiche Überfällig / Heute fällig / Weitere / Demnächst (Reihenfolge siehe sections.js).
  const { items, overdue, today, rest, upcoming, plans } = nowSections();
  const item = (t, options = {}) => nowItem(t, refresh, { ...options, plan: plans.get(t.id) });
  const wishes = store.wishes();
  const candidates = [...items, ...wishes.map((w) => ({ ...w, isWish: true }))];

  const decide = () => {
    if (!candidates.length) return;
    const item = pickRandom(candidates);
    const subtitle = item.isWish
      ? `Wollte ich schon länger mal wieder machen · ${lastDoneText(item)}`
      : `${KIND_LABELS[item.kind]} · W${item.importance} · D${item.urgency}${windowText(item) ? ` · ${windowText(item)}` : ''}`;
    let doneButton;
    if (item.isWish) {
      doneButton = el('button.primary', { type: 'button', onclick: () => { closeDialog(); doneWish(item, refresh); } }, '♥ Gemacht');
    } else if (item.kind === 'routine') {
      doneButton = el('button.primary', { type: 'button', onclick: () => runRoutine(item, refresh) }, '▶ Starten');
    } else {
      doneButton = el('button.primary', { type: 'button', onclick: () => { closeDialog(); completeTask(item, refresh); } }, '✓ Erledigt');
    }
    openDialog('Wie wär’s mit …',
      el('div.pick', {},
        topicDot(item),
        el('strong', {}, item.isWish ? item.title : store.shownTitle(item)),
        el('p.muted', {}, subtitle),
        [item.notes, ...(item.upgrades || []).map((u) => u.notes)].filter(Boolean).map((n) => el('p', {}, n)),
        el('div.buttons', {}, el('button', { type: 'button', onclick: decide }, '🎲 Nochmal'), doneButton)));
  };

  mount(root,
    el('div.toolbar', {}, el('h2', {}, 'Was mache ich jetzt?')),
    // Am PC zwei Spalten (Aufgaben | Wunschliste & Demnächst), auf dem Handy untereinander in dieser Reihenfolge.
    el('div.now-cols', {},
      el('div.now-main', {},
        running.length ? el('section.card.running-now', {},
          el('h3', {}, running.some((r) => !r.expired) ? '● Läuft gerade' : '● Heute noch offen'),
          el('ul.now-list', {}, running.map((item) => runningItem(item, refresh)))) : null,
        el('button.primary.big.wide', { type: 'button', onclick: decide, disabled: !candidates.length }, '🎲 Ich kann mich nicht entscheiden'),

        overdue.length ? el('section.card.alert', {},
          el('h3', {}, '⚠ Überfällig'),
          el('ul.now-list', {}, overdue.map((t) => item(t)))) : null,

        today.length ? el('section.card.today', {},
          el('h3', {}, '📅 Heute fällig'),
          el('ul.now-list', {}, today.map((t) => item(t, { left: true })))) : null,

        el('section.card', {},
          el('h3', {}, 'Weitere Aufgaben'),
          rest.length
            ? el('ul.now-list', {}, rest.map((t) => item(t)))
            : el('p.empty', {}, overdue.length || today.length ? 'Sonst ist nichts offen.' : 'Alles erledigt 🎉'))),

      el('div.now-side', {},
        el('section.card.wishes', {},
          el('h3', {}, 'Wollte ich schon länger mal wieder machen'),
          wishes.length ? el('ul.now-list', {}, wishes.map((w) => wishItem(w, refresh))) : null,
          el('button', { type: 'button', onclick: () => openWishEditor({}, refresh) }, '+ Hinzufügen')),

        upcoming.length ? el('section.card', {},
          el('h3', {}, 'Demnächst'),
          el('ul.plain', {}, upcoming.map((t) => el('li', {}, topicDot(t), ` ${store.shownTitle(t)} – ab ${formatDate(t.window_start)}`)))) : null)));
}
