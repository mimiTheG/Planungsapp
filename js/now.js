// "Was mache ich jetzt?" – offene Aufgaben und Projekte, Wunschliste und Zufallsauswahl.

import {
  el, mount, field, formData, openDialog, closeDialog, toast, attempt,
} from './ui.js';
import { daysBetween, formatDate, parseDate } from './dates.js';
import * as store from './store.js';
import {
  KIND_LABELS, completeTask, openTaskEditor, priority, progressBar, recurrenceText, runRoutine, topicDot, windowText,
} from './tasks.js';
import { topicPicker } from './topic-picker.js';

const ACTIVE = ['open', 'due', 'overdue'];

// Gewicht für die Zufallsauswahl: Priorität (1–25), Überfälliges zählt doppelt. Wünsche haben keine Priorität.
function weight(item) {
  if (item.isWish) return 1;
  return priority(item) * (item.status === 'overdue' ? 2 : 1);
}

function sortByPriority(a, b) {
  const overdue = Number(b.status === 'overdue') - Number(a.status === 'overdue');
  if (overdue) return overdue;
  const prio = priority(b) - priority(a);
  if (prio) return prio;
  return String(a.closes_at || '9999').localeCompare(String(b.closes_at || '9999'));
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

function nowItem(task, refresh) {
  const openSubtasks = store.childrenOf(task.id).filter((c) => c.status !== 'done').length;
  return el(`li.now-item.status-${task.status}`, {},
    el('div.now-text', {},
      el('button.link.task-title', { type: 'button', onclick: () => openTaskEditor(task, refresh) }, topicDot(task), task.title),
      el('div.meta', {},
        task.kind !== 'todo' ? el(`span.badge.kind.${task.kind}`, {}, KIND_LABELS[task.kind]) : null,
        el('span.badge', { title: 'Wichtigkeit / Dringlichkeit' }, `W${task.importance} · D${task.urgency}`),
        task.recurrence !== 'once' ? el('span.badge', {}, `↻ ${recurrenceText(task)}`) : null,
        windowText(task) ? el(`span.badge.status-${task.status}`, {}, windowText(task)) : null,
        openSubtasks ? el('span.badge', {}, `${openSubtasks} offen`) : null),
      progressBar(task)),
    el('button.done-btn', { type: 'button', 'aria-label': 'Erledigt', onclick: () => completeTask(task, refresh) }, '✓'));
}

// --- Wollte ich schon länger mal wieder machen ---------------------------------

function lastDoneText(wish) {
  if (!wish.last_done_at) return 'noch nie gemacht';
  const days = daysBetween(parseDate(wish.last_done_at), new Date());
  if (days === 0) return 'heute gemacht';
  if (days === 1) return 'gestern gemacht';
  return `zuletzt vor ${days} Tagen`;
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

// --- Ansicht ---------------------------------------------------------------------

export function renderNowView(root) {
  const refresh = () => renderNowView(root);
  const all = store.tasks().filter((t) => t.parent_id === null);
  const items = all.filter((t) => ACTIVE.includes(t.status)).sort(sortByPriority);
  const overdue = items.filter((t) => t.status === 'overdue');
  const rest = items.filter((t) => t.status !== 'overdue');
  const wishes = store.wishes();
  const upcoming = all
    .filter((t) => t.status === 'upcoming')
    .sort((a, b) => a.window_start.localeCompare(b.window_start))
    .slice(0, 8);
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
        el('strong', {}, item.title),
        el('p.muted', {}, subtitle),
        item.notes ? el('p', {}, item.notes) : null,
        el('div.buttons', {}, el('button', { type: 'button', onclick: decide }, '🎲 Nochmal'), doneButton)));
  };

  mount(root,
    el('div.toolbar', {}, el('h2', {}, 'Was mache ich jetzt?')),
    el('button.primary.big.wide', { type: 'button', onclick: decide, disabled: !candidates.length }, '🎲 Ich kann mich nicht entscheiden'),

    overdue.length ? el('section.card.alert', {},
      el('h3', {}, '⚠ Überfällig'),
      el('ul.now-list', {}, overdue.map((t) => nowItem(t, refresh)))) : null,

    el('section.card', {},
      el('h3', {}, 'Steht gerade an'),
      rest.length
        ? el('ul.now-list', {}, rest.map((t) => nowItem(t, refresh)))
        : el('p.empty', {}, overdue.length ? 'Sonst ist nichts offen.' : 'Alles erledigt 🎉')),

    el('section.card.wishes', {},
      el('h3', {}, 'Wollte ich schon länger mal wieder machen'),
      wishes.length ? el('ul.now-list', {}, wishes.map((w) => wishItem(w, refresh))) : null,
      el('button', { type: 'button', onclick: () => openWishEditor({}, refresh) }, '+ Hinzufügen')),

    upcoming.length ? el('section.card', {},
      el('h3', {}, 'Demnächst'),
      el('ul.plain', {}, upcoming.map((t) => el('li', {}, topicDot(t), ` ${t.title} – ab ${formatDate(t.window_start)}`)))) : null);
}
