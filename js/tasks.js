// Aufgaben, Projekte und Routinen: Baumansicht, Editor mit Wichtigkeits-Dringlichkeits-Matrix.

import {
  el, mount, field, select, formData, openDialog, toast, attempt,
} from './ui.js';
import { daysBetween, formatDate, isoDate, parseDate } from './dates.js';
import * as store from './store.js';
import { IMPORTANCE_LABELS, URGENCY_LABELS, TEXTS } from './matrix-texts.js';
import { topicPicker } from './topic-picker.js';

export const KIND_LABELS = { todo: 'Aufgabe', project: 'Projekt', routine: 'Routine' };
const NEW_TITLES = { todo: 'Neue Aufgabe', project: 'Neues Projekt', routine: 'Neue Routine' };

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// --- Beschreibungen --------------------------------------------------------

export function recurrenceText(task) {
  if (task.recurrence === 'rhythm') {
    return `alle ${task.rhythm_days} Tage, Puffer ${task.buffer_days} ${task.buffer_days === 1 ? 'Tag' : 'Tage'}`;
  }
  if (task.recurrence === 'period') {
    const md = (v) => { const [m, d] = v.split('-').map(Number); return `${d}. ${MONTHS[m - 1]}`; };
    return `jährlich ${md(task.period_start)} – ${md(task.period_end)}`;
  }
  return '';
}

export function windowText(task) {
  const now = new Date();
  const time = task.deadline_time ? ` ${task.deadline_time} Uhr` : '';
  switch (task.status) {
    case 'upcoming': {
      const days = daysBetween(now, parseDate(task.window_start));
      return `ab ${formatDate(task.window_start)} (in ${days} ${days === 1 ? 'Tag' : 'Tagen'})`;
    }
    case 'due':
      return task.window_end ? `fällig bis ${formatDate(task.window_end)}${time}` : 'offen';
    case 'overdue': {
      const days = Math.max(0, daysBetween(parseDate(task.closes_at), now));
      return days === 0 ? 'überfällig (heute)' : `überfällig seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
    }
    case 'expired': return 'verfallen';
    case 'done': return `erledigt ${formatDate(task.done_at)}`;
    default: return task.window_end ? `bis ${formatDate(task.window_end)}${time}` : '';
  }
}

// Priorität 1–25 (höher = zuerst). Skala: Wichtigkeit/Dringlichkeit 1 = sehr wichtig/sofort … 5 = unwichtig/kein Zeitdruck.
export function priority(task, level = 'sachlich') {
  return level === 'emotional'
    ? (6 - task.importance_emo) * (6 - task.urgency_emo)
    : (6 - task.importance) * (6 - task.urgency);
}

export function topicDot(task) {
  return el('span.dot', {
    style: { background: store.topicColor(task.topic_id) },
    title: store.topicById(task.topic_id)?.name || 'ohne Thema',
  });
}

// Fortschritt über alle (einmaligen) Unteraufgaben, beliebig tief.
export function progressInfo(task) {
  const all = store.descendantsOf(task.id).filter((t) => t.recurrence === 'once');
  if (!all.length) return null;
  const done = all.filter((t) => t.done_at).length;
  return { done, total: all.length, pct: Math.round((done / all.length) * 100) };
}

// Farbstufe je nach Fortschritt: von zartem Rosa (wenig erledigt) bis Dunkelrot (fertig).
function progressStep(pct) {
  if (pct >= 100) return 4;
  if (pct >= 67) return 3;
  if (pct >= 34) return 2;
  if (pct > 0) return 1;
  return 0;
}

export function progressBar(task) {
  const info = progressInfo(task);
  if (!info) return null;
  return el(`div.progress.p${progressStep(info.pct)}`, { title: `${info.done} von ${info.total} Unteraufgaben erledigt` },
    el('span.progress-track', {}, el('span.progress-fill', { style: { width: `${info.pct}%` } })),
    el('span.progress-label', {}, `${info.pct} %`));
}

function prioBadge(task) {
  return el('span.badge', { title: 'Wichtigkeit / Dringlichkeit (1 = sehr wichtig / sofort)' }, `W${task.importance} · D${task.urgency}`);
}

// --- Aktionen --------------------------------------------------------------

export function completeTask(task, refresh) {
  attempt(() => {
    const updated = store.completeTask(task.id);
    if (updated.recurrence !== 'once') {
      toast(`„${task.title}“ erledigt – wieder fällig ab ${formatDate(updated.window_start)}`);
    } else if (updated.kind === 'routine') {
      toast(`Routine „${task.title}“ abgeschlossen`);
    } else {
      toast(`„${task.title}“ erledigt`);
    }
  });
  refresh();
}

function reopenTask(task, refresh) {
  attempt(() => store.reopenTask(task.id));
  refresh();
}

function deleteTask(task, refresh) {
  const subCount = store.descendantsOf(task.id).length;
  const question = subCount
    ? `„${task.title}“ und ${subCount} Unteraufgabe(n) löschen?`
    : `„${task.title}“ löschen?`;
  if (!window.confirm(question)) return;
  attempt(() => store.deleteTask(task.id));
  refresh();
}

// --- Baum ------------------------------------------------------------------

const collapsed = new Set();

// Rendert Aufgaben rekursiv mit allen Unteraufgaben.
export function taskTree(tasks, refresh, options = {}) {
  return el('ul.tree', {}, tasks.map((task) => taskNode(task, refresh, options)));
}

function taskNode(task, refresh, options) {
  const children = store.childrenOf(task.id).filter((c) => options.showDone || c.status !== 'done');
  const isCollapsed = collapsed.has(task.id);
  const checkable = task.kind !== 'routine' || task.recurrence !== 'once';
  const isDone = task.status === 'done';
  const inRoutine = store.isInRoutine(task);

  const toggle = children.length
    ? el('button.icon.twisty', {
      type: 'button',
      'aria-label': isCollapsed ? 'Aufklappen' : 'Zuklappen',
      onclick: () => { if (isCollapsed) collapsed.delete(task.id); else collapsed.add(task.id); refresh(); },
    }, isCollapsed ? '▸' : '▾')
    : el('span.twisty');

  const check = checkable
    ? el('input', {
      type: 'checkbox',
      checked: isDone,
      'aria-label': isDone ? 'Wieder öffnen' : 'Erledigt',
      onchange: () => (isDone ? reopenTask(task, refresh) : completeTask(task, refresh)),
    })
    : null;

  const meta = [
    task.kind !== 'todo' && task.parent_id === null ? el(`span.badge.kind.${task.kind}`, {}, KIND_LABELS[task.kind]) : null,
    inRoutine || task.parent_id !== null ? null : prioBadge(task),
    task.duration_min && inRoutine ? el('span.badge', {}, `${task.duration_min} min`) : null,
    task.recurrence !== 'once' ? el('span.badge', {}, `↻ ${recurrenceText(task)}`) : null,
    windowText(task) ? el(`span.badge.status-${task.status}`, {}, windowText(task)) : null,
  ];

  return el('li', {},
    el(`div.task-row${isDone ? '.done' : ''}`, {},
      toggle,
      check,
      el('div.task-main', {},
        el('button.link.task-title', { type: 'button', onclick: () => openTaskEditor(task, refresh) },
          topicDot(task), task.title),
        el('span.meta', {}, meta),
        progressBar(task)),
      el('span.actions', {},
        el('button.icon', {
          type: 'button',
          'aria-label': inRoutine ? 'Schritt hinzufügen' : 'Unteraufgabe hinzufügen',
          onclick: () => openTaskEditor({ parent_id: task.id, topic_id: task.topic_id }, refresh),
        }, '+'),
        el('button.icon', { type: 'button', 'aria-label': 'Löschen', onclick: () => deleteTask(task, refresh) }, '🗑'))),
    children.length && !isCollapsed ? taskTree(children, refresh, options) : null);
}

// --- Matrix ----------------------------------------------------------------

const readFlag = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const writeFlag = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* egal */ } };

// Interaktive 5×5-Matrix wie in den Excel-Tabellen: Zeilen = Wichtigkeit 1–5, Spalten = Dringlichkeit 1–5.
// values = { sachlich: {importance, urgency}, emotional: {…} }.
function priorityMatrix(values, currentId) {
  let level = 'sachlich';
  let showInfo = readFlag('planungsapp.setting.matrixInfo');
  const wrap = el('div.matrix-wrap');
  const others = store.tasks().filter((t) => t.parent_id === null && t.id !== currentId
    && !['done', 'expired', 'routine'].includes(t.status));

  const render = () => {
    const v = values[level];
    const grid = el('div.matrix', { role: 'grid' },
      el('span.corner', {}, 'W↓ D→'),
      URGENCY_LABELS.map((label, i) => el('span.axis', { title: label }, String(i + 1))));
    for (let imp = 1; imp <= 5; imp += 1) {
      grid.append(el('span.axis', { title: IMPORTANCE_LABELS[imp - 1] }, String(imp)));
      for (let urg = 1; urg <= 5; urg += 1) {
        const here = others.filter((t) => (level === 'sachlich'
          ? t.importance === imp && t.urgency === urg
          : t.importance_emo === imp && t.urgency_emo === urg));
        const heat = (6 - imp) * (6 - urg); // 1–25
        grid.append(el(`button.cell${v.importance === imp && v.urgency === urg ? '.selected' : ''}`, {
          type: 'button',
          style: { '--heat': `${Math.round(6 + heat * 3.2)}%` },
          'aria-label': `Wichtigkeit ${imp} (${IMPORTANCE_LABELS[imp - 1]}), Dringlichkeit ${urg} (${URGENCY_LABELS[urg - 1]})`,
          title: here.map((t) => t.title).join('\n'),
          onclick: () => { v.importance = imp; v.urgency = urg; render(); },
        }, here.slice(0, 6).map((t) => el('span.dot.small', { style: { background: store.topicColor(t.topic_id) } }))));
      }
    }

    mount(wrap,
      el('div.matrix-top', {},
        el('div.segmented', { role: 'group', 'aria-label': 'Ebene' },
          ['sachlich', 'emotional'].map((l) => el(`button${l === level ? '.active' : ''}`, {
            type: 'button',
            onclick: () => { level = l; render(); },
          }, l === 'sachlich' ? 'Sachlich' : 'Emotional'))),
        el(`button.icon.info${showInfo ? '.active' : ''}`, {
          type: 'button',
          'aria-label': 'Erklärung anzeigen',
          'aria-pressed': String(showInfo),
          onclick: () => { showInfo = !showInfo; writeFlag('planungsapp.setting.matrixInfo', showInfo); render(); },
        }, 'i')),
      grid,
      el('p.matrix-choice', {},
        el('strong', {}, `Wichtigkeit ${v.importance}`), ` – ${IMPORTANCE_LABELS[v.importance - 1]} · `,
        el('strong', {}, `Dringlichkeit ${v.urgency}`), ` – ${URGENCY_LABELS[v.urgency - 1]}`),
      showInfo ? el('div.matrix-info', {},
        el('p', {}, TEXTS[level][v.importance - 1][v.urgency - 1]),
        el('small.muted', {}, level === 'sachlich'
          ? 'Sachliche Ebene: Was bewirkt die Aufgabe, und bis wann muss sie fertig sein?'
          : 'Emotionale Ebene: Wie fühlt sich die Aufgabe für mich an?')) : null,
      others.length ? el('small.muted', {}, 'Punkte = andere offene Aufgaben.') : null);
  };
  render();
  return wrap;
}

// --- Editor ----------------------------------------------------------------

function monthDayInputs(prefix, value) {
  const [m, d] = (value || '01-01').split('-').map(Number);
  return el('span.inline', {},
    el('input', { type: 'number', name: `${prefix}_day`, min: 1, max: 31, value: d, inputmode: 'numeric', style: { width: '4.5em' } }),
    select(`${prefix}_month`, MONTHS.map((name, i) => [i + 1, name]), m));
}

function pathOf(task) {
  const parts = [];
  for (let current = task; current; current = store.taskById(current.parent_id)) parts.unshift(current.title);
  return parts.join(' › ');
}

export function openTaskEditor(task, refresh) {
  const isNew = !task.id;
  const t = {
    kind: 'todo', importance: 3, urgency: 3, importance_emo: 3, urgency_emo: 3,
    recurrence: 'once', on_missed: 'remind', rhythm_days: 7, buffer_days: 1,
    period_start: '03-01', period_end: '09-30', ...task,
  };
  const parent = t.parent_id ? store.taskById(t.parent_id) : null;
  if (isNew && parent) t.kind = parent.kind === 'project' ? 'project' : 'todo';

  const values = {
    sachlich: { importance: t.importance, urgency: t.urgency },
    emotional: { importance: t.importance_emo, urgency: t.urgency_emo },
  };

  const excluded = new Set(isNew ? [] : [t.id, ...store.descendantsOf(t.id).map((d) => d.id)]);
  const parentOptions = [['', '— keine (oberste Ebene) —'],
    ...store.tasks().filter((p) => !excluded.has(p.id)).map((p) => [p.id, pathOf(p)])];

  const recurrenceBoxes = {
    once: el('div.row', {},
      field('Ab (optional)', el('input', { type: 'date', name: 'window_start', value: t.recurrence === 'once' ? t.window_start || '' : '' })),
      field('Bis / Deadline (optional)', el('input', { type: 'date', name: 'window_end', value: t.recurrence === 'once' ? t.window_end || '' : '' }))),
    rhythm: el('div.form-grid', {},
      el('div.row', {},
        field('Alle … Tage', el('input', { type: 'number', name: 'rhythm_days', min: 1, inputmode: 'numeric', value: t.rhythm_days })),
        field('Puffer (Tage)', el('input', { type: 'number', name: 'buffer_days', min: 1, inputmode: 'numeric', value: t.buffer_days }))),
      el('small.muted', {}, 'Puffer = so viele Tage hat man Zeit, die Aufgabe zu erledigen.'),
      field('Nächstes Mal ab', el('input', {
        type: 'date', name: 'rhythm_start', value: t.recurrence === 'rhythm' ? t.window_start : isoDate(new Date()),
      }))),
    period: el('div.row', {},
      field('Jedes Jahr von', monthDayInputs('period_start', t.period_start)),
      field('bis', monthDayInputs('period_end', t.period_end))),
  };

  const kindSelect = select('kind', Object.entries(KIND_LABELS), t.kind);
  const parentSelect = select('parent_id', parentOptions, t.parent_id);

  // Routinen (und ihre Schritte) haben keine Priorität und kein "Wann?".
  const prioFieldset = el('fieldset', {},
    el('legend', {}, 'Wichtigkeit & Dringlichkeit'),
    priorityMatrix(values, t.id));

  const whenFieldset = el('fieldset', {},
    el('legend', {}, 'Wann?'),
    el('div.segmented.radio', {}, [['once', 'Einmalig'], ['rhythm', 'Rhythmus'], ['period', 'Zeitraum']]
      .map(([v, label]) => el('label', {},
        el('input', { type: 'radio', name: 'recurrence', value: v, checked: t.recurrence === v, onchange: showRecurrence }),
        label))),
    Object.values(recurrenceBoxes),
    field('Spätestens um (optional)', el('input', { type: 'time', name: 'deadline_time', value: t.deadline_time || '' }),
      'Uhrzeit am letzten Tag, z. B. Müll bis 6:00.'),
    field('Wenn nicht rechtzeitig erledigt', select('on_missed', [
      ['remind', 'Täglich erinnern (steht ganz oben)'],
      ['expire', 'Verfällt (nicht nachholbar)'],
    ], t.on_missed)));

  const form = el('form.form-grid', { onsubmit: (e) => { e.preventDefault(); save(); } },
    field('Titel', el('input', { name: 'title', required: true, maxlength: 200, value: t.title || '' })),
    el('div.row', {},
      field('Art', kindSelect),
      field('Dauer (min)', el('input', { type: 'number', name: 'duration_min', min: 1, inputmode: 'numeric', value: t.duration_min || '', placeholder: 'optional' }))),
    el('small.muted', {}, 'Projekt = freiwillig, macht Spaß. Routine = wiederverwendbare Abfolge von Schritten.'),
    topicPicker(t.topic_id),
    field('Gehört zu', parentSelect),
    prioFieldset,
    whenFieldset,
    field('Notizen', el('textarea', { name: 'notes', rows: 3 }, t.notes || '')),
    !isNew && t.recurrence !== 'once' ? el('p.muted', {},
      `Zuletzt erledigt: ${t.last_done_at ? formatDate(t.last_done_at) : 'noch nie'}`,
      t.missed_count ? `, ${t.missed_count}× verpasst` : '') : null,
    el('div.buttons.sticky', {},
      el('button.primary', { type: 'submit' }, isNew ? 'Anlegen' : 'Speichern'),
      isNew ? null : el('button.danger', { type: 'button', onclick: () => { close(); deleteTask(t, refresh); } }, 'Löschen')));

  function showRecurrence() {
    const current = form.elements.recurrence.value;
    for (const [key, box] of Object.entries(recurrenceBoxes)) box.hidden = key !== current;
  }

  function showForKind() {
    const routineLike = store.isInRoutine({ kind: kindSelect.value, parent_id: Number(parentSelect.value) || null });
    prioFieldset.hidden = routineLike;
    whenFieldset.hidden = routineLike;
  }
  kindSelect.addEventListener('change', showForKind);
  parentSelect.addEventListener('change', showForKind);
  showRecurrence();
  showForKind();

  function save() {
    const d = formData(form);
    const md = (prefix) => `${String(d[`${prefix}_month`]).padStart(2, '0')}-${String(d[`${prefix}_day`]).padStart(2, '0')}`;
    const payload = {
      title: d.title,
      kind: d.kind,
      topic_id: d.topic_id,
      parent_id: d.parent_id,
      notes: d.notes,
      importance: values.sachlich.importance,
      urgency: values.sachlich.urgency,
      importance_emo: values.emotional.importance,
      urgency_emo: values.emotional.urgency,
      recurrence: d.recurrence,
      rhythm_days: d.rhythm_days,
      buffer_days: d.buffer_days,
      period_start: md('period_start'),
      period_end: md('period_end'),
      window_start: d.recurrence === 'rhythm' ? d.rhythm_start : d.window_start,
      window_end: d.window_end,
      deadline_time: d.deadline_time,
      duration_min: d.duration_min,
      on_missed: d.on_missed,
    };
    const ok = attempt(() => (isNew ? store.createTask(payload) : store.updateTask(t.id, payload)));
    if (!ok) return;
    close();
    toast(isNew ? 'Angelegt' : 'Gespeichert');
    refresh();
  }

  let title = 'Bearbeiten';
  if (isNew) {
    if (!parent) title = NEW_TITLES[t.kind];
    else title = store.isInRoutine(parent) ? 'Neuer Schritt' : 'Neue Unteraufgabe';
  }
  const close = openDialog(title, form);
}

// --- Ansicht "Aufgaben & Projekte" ------------------------------------------

const filters = { kind: 'all', showDone: false };

export function renderTasksView(root) {
  const refresh = () => renderTasksView(root);
  const top = store.tasks().filter((t) => t.parent_id === null && t.kind !== 'routine'
    && (filters.kind === 'all' || t.kind === filters.kind)
    && (filters.showDone || !['done', 'expired'].includes(t.status)));

  mount(root,
    el('div.toolbar', {},
      el('h2', {}, 'Aufgaben'),
      el('span.spacer'),
      el('button.primary', { type: 'button', onclick: () => openTaskEditor({}, refresh) }, '+ Neu')),
    el('div.toolbar', {},
      el('div.segmented', {}, [['all', 'Alle'], ['todo', 'Aufgaben'], ['project', 'Projekte']].map(([v, label]) =>
        el(`button${filters.kind === v ? '.active' : ''}`, { type: 'button', onclick: () => { filters.kind = v; refresh(); } }, label))),
      el('label.check', {},
        el('input', { type: 'checkbox', checked: filters.showDone, onchange: (e) => { filters.showDone = e.target.checked; refresh(); } }),
        'Erledigte')),
    top.length
      ? el('div.card', {}, taskTree(top, refresh, filters))
      : el('p.empty', {}, 'Noch nichts hier. Lege oben eine Aufgabe oder ein Projekt an.'));
}

// --- Ansicht "Routinen" -------------------------------------------------------

export function renderRoutinesView(root) {
  const refresh = () => renderRoutinesView(root);
  const list = store.routines();

  mount(root,
    el('div.toolbar', {},
      el('h2', {}, 'Routinen'),
      el('span.spacer'),
      el('button.primary', { type: 'button', onclick: () => openTaskEditor({ kind: 'routine' }, refresh) }, '+ Routine')),
    list.length ? null : el('p.muted', {},
      'Z. B. „Morgenroutine kurz“, „Abendroutine lang“, „Arbeit jeden Morgen“. ',
      'Routinen lassen sich im Kalender vor oder nach einen Termin legen.'),
    list.map((routine) => {
      const steps = store.childrenOf(routine.id);
      return el('div.card.routine', {},
        el('div.routine-head', {},
          el('button.link.task-title', { type: 'button', onclick: () => openTaskEditor(routine, refresh) },
            topicDot(routine), el('strong', {}, routine.title)),
          store.routineMinutes(routine) ? el('span.badge', {}, `${store.routineMinutes(routine)} min`) : null,
          el('span.spacer'),
          el('button.primary', { type: 'button', onclick: () => runRoutine(routine, refresh) }, '▶ Start')),
        routine.last_done_at ? el('small.muted', {}, `zuletzt ${formatDate(routine.last_done_at)}`) : null,
        steps.length ? taskTree(steps, refresh, { showDone: true }) : el('p.empty', {}, 'Noch keine Schritte.'),
        el('button', {
          type: 'button',
          onclick: () => openTaskEditor({ parent_id: routine.id, topic_id: routine.topic_id }, refresh),
        }, '+ Schritt'));
    }));
}

// Routine als Checkliste abarbeiten; am Ende werden alle Schritte zurückgesetzt.
export function runRoutine(routine, refresh) {
  const body = el('div');
  const render = () => {
    const steps = store.descendantsOf(routine.id).filter((s) => !store.childrenOf(s.id).length);
    const done = steps.filter((s) => s.done_at).length;
    mount(body,
      el('progress', { max: steps.length || 1, value: done }),
      el('ul.checklist', {}, steps.map((step) => el('li', {},
        el('label.check', {},
          el('input', {
            type: 'checkbox',
            checked: Boolean(step.done_at),
            onchange: () => {
              attempt(() => (step.done_at ? store.reopenTask(step.id) : store.completeTask(step.id)));
              render();
            },
          }),
          step.title,
          step.duration_min ? el('span.muted', {}, ` (${step.duration_min} min)`) : null)))),
      steps.length ? null : el('p.muted', {}, 'Diese Routine hat noch keine Schritte.'),
      el('div.buttons', {},
        el('button.primary', {
          type: 'button',
          onclick: () => { close(); completeTask(routine, refresh); },
        }, done === steps.length ? 'Routine abschließen' : 'Trotzdem abschließen')));
  };
  render();
  const close = openDialog(routine.title, body);
}
