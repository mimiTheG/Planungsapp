// "Was mache ich jetzt?" – offene Aufgaben und Projekte, Wunschliste und Zufallsauswahl.

import { el, mount, openDialog, closeDialog } from './ui.js';
import { formatDate } from './dates.js';
import * as store from './store.js';
import {
  KIND_LABELS, completeTask, openTaskEditor, priority, recurrenceText, runRoutine, topicDot, windowText,
} from './tasks.js';

let level = 'sachlich';

const ACTIVE = ['open', 'due', 'overdue'];

// Gewicht für die Zufallsauswahl: Priorität (Wichtigkeit × Dringlichkeit), Überfälliges zählt doppelt.
function weight(task) {
  return priority(task, level) * (task.status === 'overdue' ? 2 : 1);
}

function sortByPriority(a, b) {
  const overdue = Number(b.status === 'overdue') - Number(a.status === 'overdue');
  if (overdue) return overdue;
  const prio = priority(b, level) - priority(a, level);
  if (prio) return prio;
  return String(a.closes_at || '9999').localeCompare(String(b.closes_at || '9999'));
}

function pickRandom(items) {
  const total = items.reduce((sum, t) => sum + weight(t), 0);
  let r = Math.random() * total;
  for (const task of items) {
    r -= weight(task);
    if (r < 0) return task;
  }
  return items[items.length - 1];
}

function actionButton(task, refresh) {
  return task.kind === 'routine'
    ? el('button', { type: 'button', onclick: () => runRoutine(task, refresh) }, '▶ Start')
    : el('button.done-btn', { type: 'button', 'aria-label': 'Erledigt', onclick: () => completeTask(task, refresh) }, '✓');
}

function nowItem(task, refresh) {
  const openSubtasks = store.childrenOf(task.id).filter((c) => c.status !== 'done').length;
  return el(`li.now-item.status-${task.status}`, {},
    el('div.now-text', {},
      el('button.link.task-title', { type: 'button', onclick: () => openTaskEditor(task, refresh) }, topicDot(task), task.title),
      el('div.meta', {},
        task.kind !== 'todo' ? el('span.badge.kind', {}, KIND_LABELS[task.kind]) : null,
        el('span.badge', {}, `Prio ${priority(task, level)}`),
        task.recurrence !== 'once' ? el('span.badge', {}, `↻ ${recurrenceText(task)}`) : null,
        windowText(task) ? el(`span.badge.status-${task.status}`, {}, windowText(task)) : null,
        openSubtasks ? el('span.badge', {}, `${openSubtasks} offen`) : null)),
    actionButton(task, refresh));
}

export function renderNowView(root) {
  const refresh = () => renderNowView(root);
  const all = store.tasks().filter((t) => t.parent_id === null);
  const items = all.filter((t) => ACTIVE.includes(t.status));
  const wishlist = items.filter(store.isWishlist);
  const main = items.filter((t) => !store.isWishlist(t)).sort(sortByPriority);
  const overdue = main.filter((t) => t.status === 'overdue');
  const rest = main.filter((t) => t.status !== 'overdue');
  const upcoming = all
    .filter((t) => t.status === 'upcoming')
    .sort((a, b) => a.window_start.localeCompare(b.window_start))
    .slice(0, 8);

  const decide = () => {
    if (!items.length) return;
    const task = pickRandom(items);
    openDialog('Wie wär’s mit …',
      el('div.pick', {},
        topicDot(task),
        el('strong', {}, task.title),
        el('p.muted', {}, `${KIND_LABELS[task.kind]} · Prio ${priority(task, level)}${windowText(task) ? ` · ${windowText(task)}` : ''}`),
        task.notes ? el('p', {}, task.notes) : null,
        el('div.buttons', {},
          el('button', { type: 'button', onclick: decide }, '🎲 Nochmal'),
          task.kind === 'routine'
            ? el('button.primary', { type: 'button', onclick: () => runRoutine(task, refresh) }, '▶ Starten')
            : el('button.primary', { type: 'button', onclick: () => { closeDialog(); completeTask(task, refresh); } }, '✓ Erledigt'))));
  };

  mount(root,
    el('div.toolbar', {},
      el('h2', {}, 'Was mache ich jetzt?'),
      el('span.spacer'),
      el('div.segmented', { 'aria-label': 'Sortieren nach' }, ['sachlich', 'emotional'].map((l) =>
        el(`button${level === l ? '.active' : ''}`, { type: 'button', onclick: () => { level = l; refresh(); } },
          l === 'sachlich' ? 'Sachlich' : 'Emotional')))),
    el('button.primary.big.wide', { type: 'button', onclick: decide, disabled: !items.length }, '🎲 Ich kann mich nicht entscheiden'),

    overdue.length ? el('section.card.alert', {},
      el('h3', {}, '⚠ Überfällig'),
      el('ul.now-list', {}, overdue.map((t) => nowItem(t, refresh)))) : null,

    el('section.card', {},
      el('h3', {}, 'Steht gerade an'),
      rest.length
        ? el('ul.now-list', {}, rest.map((t) => nowItem(t, refresh)))
        : el('p.empty', {}, overdue.length ? 'Sonst ist nichts offen.' : 'Alles erledigt 🎉')),

    el('section.card', {},
      el('h3', {}, 'Wollte ich schon länger mal wieder machen'),
      wishlist.length
        ? el('ul.now-list', {}, wishlist.map((t) => nowItem(t, refresh)))
        : el('p.empty', {}, 'Projekte mit Wichtigkeit 1 und Dringlichkeit 1 landen hier.'),
      el('button', {
        type: 'button',
        onclick: () => openTaskEditor({ kind: 'project', importance: 1, urgency: 1, importance_emo: 1, urgency_emo: 1 }, refresh),
      }, '+ Hinzufügen')),

    upcoming.length ? el('section.card', {},
      el('h3', {}, 'Demnächst'),
      el('ul.plain', {}, upcoming.map((t) => el('li', {}, topicDot(t), ` ${t.title} – ab ${formatDate(t.window_start)}`)))) : null);
}
