// Leiste der laufenden Routine über der unteren Navigation (wie „Läuft gerade“ bei Spotify).

import { el, mount } from './ui.js';
import { formatTime, parseDate } from './dates.js';
import * as store from './store.js';
import { cancelRoutine, completeTask, routineProgress, runRoutine } from './tasks.js';

let refreshView = () => {};

export function initPlayer(refresh) {
  refreshView = refresh;
  globalThis.addEventListener('planungsapp-change', renderPlayer);
  renderPlayer();
}

export function renderPlayer() {
  const bar = document.getElementById('player');
  const active = store.activeRoutine();
  document.body.classList.toggle('has-player', Boolean(active));
  bar.hidden = !active;
  if (!active) return mount(bar);

  const { routine, startedAt } = active;
  const { done, total } = routineProgress(routine);
  const color = store.topicColor(routine.topic_id);
  mount(bar,
    el('button.player-main', { type: 'button', onclick: () => runRoutine(routine, refreshView) },
      el('span.player-pulse', { style: { background: color }, 'aria-hidden': 'true' }),
      el('span.player-text', {},
        el('small', {}, 'Laufende Routine'),
        el('strong', {}, routine.title),
        el('small.muted', {}, `${done}/${total} Schritte · seit ${formatTime(parseDate(startedAt))}`))),
    el('button.icon.player-done', {
      type: 'button',
      'aria-label': 'Routine abschließen',
      title: 'Routine abschließen',
      onclick: () => completeTask(routine, refreshView),
    }, '✓'),
    el('button.icon.player-cancel', {
      type: 'button',
      'aria-label': 'Routine abbrechen',
      title: 'Abbrechen',
      onclick: () => cancelRoutine(routine, refreshView),
    }, '×'),
    el('span.player-progress', { style: { width: `${total ? (done / total) * 100 : 0}%` } }));
}
