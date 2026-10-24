// Aufgaben, Projekte und Routinen: Baumansicht, Editor mit Wichtigkeits-Dringlichkeits-Matrix.

import {
  el, mount, field, select, formData, openDialog, toast, attempt,
} from './ui.js';
import {
  addDays, daysBetween, formatDate, formatDuration, hoursText, isoDate, isoDateTime, parseDate, spanText,
} from './dates.js';
import * as store from './store.js';
import { importanceLabel, urgencyLabel, matrixText } from './matrix-texts.js';
import { topicPicker } from './topic-picker.js';
import { enableLongPressReorder } from './reorder.js';
import { parentPicker } from './parent-picker.js';
import { openEventEditor } from './calendar.js';
import { repeatFields } from './repeat-fields.js';
import { repeatText } from './repeat.js';

export const KIND_LABELS = { todo: 'Aufgabe', project: 'Projekt', routine: 'Routine' };
const NEW_TITLES = { todo: 'Neue Aufgabe', project: 'Neues Projekt', routine: 'Neue Routine' };

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// --- Beschreibungen --------------------------------------------------------

const UNIT_ONE = { daily: 'Tag', weekly: 'Woche', monthly: 'Monat', yearly: 'Jahr' };
const UNIT_MANY = { daily: 'Tage', weekly: 'Wochen', monthly: 'Monate', yearly: 'Jahre' };

export function recurrenceText(task) {
  if (task.recurrence === 'rhythm') {
    const b = task.buffer || 0;
    const buffer = b ? `± ${b} ${b === 1 ? 'Tag' : 'Tage'}` : 'nur am Tag selbst';
    if (!task.repeat) return `alle ${task.rhythm_days} Tage, ${buffer}`;
    if (task.repeat_from_done) {
      const n = Math.max(1, task.repeat.interval || 1);
      return `${n} ${(n === 1 ? UNIT_ONE : UNIT_MANY)[task.repeat.freq]} nach dem Erledigen, ${buffer}`;
    }
    return `${repeatText(task.repeat, task.repeat_start)}, ${buffer}`;
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
      return `ab ${formatDate(task.window_start)} (${days === 1 ? 'morgen' : `in ${spanText(days, { dative: true })}`})`;
    }
    case 'due':
      return task.window_end ? `fällig bis ${formatDate(task.window_end)}${time}` : 'offen';
    case 'overdue': {
      const days = Math.max(0, daysBetween(parseDate(task.closes_at), now));
      if (days > 0) return `überfällig seit ${spanText(days, { dative: true })}`;
      return task.deadline_time ? `überfällig seit ${hoursText(now - parseDate(task.closes_at))}` : 'überfällig (seit heute)';
    }
    // Einmalige Aufgaben verschwinden nicht – sie gelten als überfällig.
    case 'expired': return task.recurrence === 'once' ? windowText({ ...task, status: 'overdue' }) : 'verfallen';
    case 'done': return `erledigt ${formatDate(task.done_at)}`;
    default: return task.window_end ? `bis ${formatDate(task.window_end)}${time}` : '';
  }
}

// Priorität 1–25 (höher = zuerst). Skala: Wichtigkeit/Dringlichkeit 5 = sehr wichtig/sofort … 1 = unwichtig/kein Zeitdruck.
export function priority(task, level = 'sachlich') {
  return level === 'emotional'
    ? task.importance_emo * task.urgency_emo
    : task.importance * task.urgency;
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

// Rendert Aufgaben rekursiv mit allen Unteraufgaben. Mit options.parentId lassen sich die Einträge
// per langem Drücken umsortieren (Unteraufgaben und Schritte einer Routine).
export function taskTree(tasks, refresh, options = {}) {
  // Sortierbar per langem Drücken: Unteraufgaben/Schritte (parentId) und die oberste Ebene der Aufgabenliste (parentId null).
  const sortable = options.parentId !== undefined && options.mode !== 'view';
  // options.only: nur diese Einträge zeigen (eingeklappte Routine).
  if (options.only) tasks = tasks.filter((t) => options.only.has(t.id));
  const list = el(`ul.tree${sortable ? '.sortable' : ''}`, {},
    tasks.map((task) => taskNode(task, refresh, { ...options, parentId: undefined })));
  if (sortable) {
    // Lang drücken: hoch/runter = Reihenfolge, rechts/links = Ebene (Unteraufgabe oder nicht).
    enableLongPressReorder(list, (ids) => {
      store.reorderChildren(options.parentId, ids);
      refresh();
    }, {
      canOutdent: store.canOutdent({ parent_id: options.parentId }),
      onChange: (id, ids, direction) => {
        attempt(() => {
          store.reorderChildren(options.parentId, ids);
          const moved = direction > 0 ? store.indentTask(id) : store.outdentTask(id);
          collapsed.delete(moved.parent_id); // neue Oberaufgabe aufklappen, damit man den Eintrag sieht
        });
        refresh();
      },
    });
  }
  return list;
}

// options.mode: undefined = normale Aufgaben, 'view' = Routine ansehen (nur lesen),
// 'edit' = Routine bearbeiten (Schritte anlegen, löschen, umsortieren – aber nicht abhaken).
function taskNode(task, refresh, options) {
  const children = store.childrenOf(task.id)
    .filter((c) => (options.showDone || c.status !== 'done') && (!options.only || options.only.has(c.id)));
  const isCollapsed = collapsed.has(task.id);
  const checkable = !options.mode && (task.kind !== 'routine' || task.recurrence !== 'once');
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
    task.duration_min && inRoutine ? el('span.badge', {}, formatDuration(task.duration_min)) : null,
    task.recurrence !== 'once' ? el('span.badge', {}, `↻ ${recurrenceText(task)}`) : null,
    windowText(task) ? el(`span.badge.status-${task.status}`, {}, windowText(task)) : null,
  ];

  return el('li', { dataset: { id: task.id } },
    el(`div.task-row${isDone ? '.done' : ''}`, {},
      toggle,
      check,
      el('div.task-main', {},
        options.mode === 'view'
          ? el('span.task-title', {}, topicDot(task), task.title)
          : el('button.link.task-title', { type: 'button', onclick: () => openTaskEditor(task, refresh) },
            topicDot(task), task.title),
        el('span.meta', {}, meta),
        progressBar(task)),
      options.mode === 'view' ? null : el('span.actions', {},
        el('button.icon', {
          type: 'button',
          'aria-label': inRoutine ? 'Schritt hinzufügen' : 'Unteraufgabe hinzufügen',
          onclick: () => openTaskEditor({ parent_id: task.id, topic_id: task.topic_id }, refresh),
        }, '+'),
        canPlan(task) ? el('button.icon', {
          type: 'button', 'aria-label': 'Im Kalender einplanen', title: 'Im Kalender einplanen', onclick: () => planTask(task, refresh),
        }, '📅') : null,
        el('button.icon', { type: 'button', 'aria-label': 'Löschen', onclick: () => deleteTask(task, refresh) }, '🗑'))),
    children.length && !isCollapsed ? taskTree(children, refresh, { ...options, parentId: task.id }) : null);
}

// --- Matrix ----------------------------------------------------------------

const readFlag = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const writeFlag = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* egal */ } };

// Interaktive 5×5-Matrix wie in den Excel-Tabellen: Zeilen = Wichtigkeit 5–1, Spalten = Dringlichkeit 5–1
// (oben links = sehr wichtig und sofort).
// values = { sachlich: {importance, urgency}, emotional: {…} }.
function priorityMatrix(values, currentId, touched) {
  let level = 'sachlich';
  let showInfo = readFlag('planungsapp.setting.matrixInfo');
  const wrap = el('div.matrix-wrap');
  const others = store.tasks().filter((t) => t.parent_id === null && t.id !== currentId
    && !['done', 'expired', 'routine'].includes(t.status));

  const render = () => {
    const v = values[level];
    const grid = el('div.matrix', { role: 'grid' },
      el('span.corner', {}, 'W↓ D→'),
      [5, 4, 3, 2, 1].map((u) => el('span.axis', { title: urgencyLabel(u) }, String(u))));
    for (let imp = 5; imp >= 1; imp -= 1) {
      grid.append(el('span.axis', { title: importanceLabel(imp) }, String(imp)));
      for (let urg = 5; urg >= 1; urg -= 1) {
        const here = others.filter((t) => (level === 'sachlich'
          ? t.importance === imp && t.urgency === urg
          : t.importance_emo === imp && t.urgency_emo === urg));
        const heat = imp * urg; // 1–25
        grid.append(el(`button.cell${v.importance === imp && v.urgency === urg ? '.selected' : ''}`, {
          type: 'button',
          style: { '--heat': `${Math.round(6 + heat * 3.2)}%` },
          'aria-label': `Wichtigkeit ${imp} (${importanceLabel(imp)}), Dringlichkeit ${urg} (${urgencyLabel(urg)})`,
          title: here.map((t) => t.title).join('\n'),
          onclick: () => { v.importance = imp; v.urgency = urg; touched[level] = true; render(); },
        }, here.slice(0, 6).map((t) => el('span.dot.small', { style: { background: store.topicColor(t.topic_id) } }))));
      }
    }

    mount(wrap,
      el('div.matrix-top', {},
        el('div.segmented', { role: 'group', 'aria-label': 'Ebene' },
          ['sachlich', 'emotional'].map((l) => el(`button${l === level ? '.active' : ''}`, {
            type: 'button',
            onclick: () => {
              // Noch nicht eigens gewählte Ebene übernimmt das aktuell ausgewählte Kästchen.
              if (!touched[l]) Object.assign(values[l], values[level]);
              level = l;
              render();
            },
          }, l === 'sachlich' ? 'Sachlich' : 'Emotional'))),
        el(`button.icon.info${showInfo ? '.active' : ''}`, {
          type: 'button',
          'aria-label': 'Erklärung anzeigen',
          'aria-pressed': String(showInfo),
          onclick: () => { showInfo = !showInfo; writeFlag('planungsapp.setting.matrixInfo', showInfo); render(); },
        }, 'i')),
      grid,
      el('p.matrix-choice', {},
        el('strong', {}, `Wichtigkeit ${v.importance}`), ` – ${importanceLabel(v.importance)} · `,
        el('strong', {}, `Dringlichkeit ${v.urgency}`), ` – ${urgencyLabel(v.urgency)}`),
      showInfo ? el('div.matrix-info', {}, el('p', {}, matrixText(level, v.importance, v.urgency))) : null,
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

export function openTaskEditor(task, refresh) {
  const isNew = !task.id;
  const t = {
    kind: 'todo', importance: 3, urgency: 3, importance_emo: 3, urgency_emo: 3,
    recurrence: 'once', on_missed: 'remind', rhythm_days: 7, buffer: 0,
    period_start: '03-01', period_end: '09-30', ...task,
  };
  const parent = t.parent_id ? store.taskById(t.parent_id) : null;
  if (isNew && parent) {
    t.kind = parent.kind === 'project' ? 'project' : 'todo';
    // Neue Unteraufgaben übernehmen Wichtigkeit und Dringlichkeit der übergeordneten Aufgabe.
    for (const key of ['importance', 'urgency', 'importance_emo', 'urgency_emo']) {
      if (task[key] === undefined) t[key] = parent[key];
    }
  }
  // Neue Aufgabe in einer mehrtägigen Routine: meist etwas Regelmäßiges (Bad wöchentlich, Fenster monatlich …).
  const inMulti = Boolean(parent) && store.isMultiRoutine(store.routineOf(parent));
  const isDayStep = Boolean(parent) && store.isInRoutine(parent) && !inMulti;
  if (isNew && inMulti && task.recurrence === undefined) t.recurrence = 'rhythm';

  const values = {
    sachlich: { importance: t.importance, urgency: t.urgency },
    emotional: { importance: t.importance_emo, urgency: t.urgency_emo },
  };
  // Welche Ebene wurde schon bewusst gesetzt? Eine nicht gesetzte übernimmt die Auswahl der anderen.
  const fixed = !isNew || Boolean(parent);
  const touched = { sachlich: fixed, emotional: fixed };

  const excluded = new Set(isNew ? [] : [t.id, ...store.descendantsOf(t.id).map((d) => d.id)]);

  // Regelmäßig: direkt „Alle … Tage/Wochen/Monate/Jahre“ (wie Benutzerdefiniert bei Terminen, ohne Vorschlagsliste).
  // Ältere Aufgaben „alle n Tage ab dem Erledigen“ erscheinen als „Alle n Tage“ mit Häkchen „ab dem Erledigen“.
  // Termintag des aktuellen Durchgangs = Mitte des Zeitraums (Beginn + Puffer).
  const rhythmStartInput = el('input', {
    type: 'date',
    name: 'rhythm_start',
    value: t.recurrence === 'rhythm' && t.window_start
      ? isoDate(addDays(parseDate(t.window_start), t.buffer || 0))
      : isoDate(new Date()),
  });
  const rhythmStart = field('Erstes Mal am', rhythmStartInput);
  if (!isNew && t.recurrence === 'rhythm' && !t.repeat && t.rhythm_days) {
    t.repeat = { freq: 'daily', interval: t.rhythm_days };
    t.repeat_from_done = true;
  }
  const rhythmRepeat = repeatFields(t.repeat || null, rhythmStartInput, { required: true, noEnd: true, customOnly: true });

  const recurrenceBoxes = {
    once: el('div.form-grid', {},
      el('div.row', {},
        field('Ab (leer = ab sofort)', el('input', { type: 'date', name: 'window_start', value: t.recurrence === 'once' ? t.window_start || '' : '' })),
        field('Deadline (optional)', el('input', { type: 'date', name: 'window_end', value: t.recurrence === 'once' ? t.window_end || '' : '' }))),
      el('small.muted', {}, 'Die Deadline erscheint im Kalender in Rot.')),
    rhythm: el('div.form-grid', {}, rhythmStart, rhythmRepeat.element,
      field('Puffer (± Tage)', el('input', { type: 'number', name: 'buffer', min: 0, max: 365, inputmode: 'numeric', value: t.buffer ?? 0 })),
      el('small.muted', {}, '0 = nur am Termintag. 1 = einen Tag vorher bis einen Tag nachher (3 Tage Zeit), '
        + '2 = zwei Tage vorher bis zwei Tage nachher.'),
      el('label.check', {},
        el('input', { type: 'checkbox', name: 'has_deadline', checked: Boolean(t.has_deadline) }),
        'Deadline – der letzte Tag erscheint im Kalender in Rot'),
      el('label.check', {},
        el('input', { type: 'checkbox', name: 'repeat_from_done', checked: Boolean(t.repeat_from_done) }),
        'Ab dem Erledigen neu zählen (z. B. 6 Wochen nach dem letzten Mal)'),
      el('small.muted', {}, 'Dann zählt nur „alle … Tage/Wochen/Monate“ – Wochentag oder Datum ergeben sich aus dem Tag des Erledigens.')),
    period: el('div.row', {},
      field('Jedes Jahr von', monthDayInputs('period_start', t.period_start)),
      field('bis', monthDayInputs('period_end', t.period_end))),
  };

  const titleInput = el('input', { name: 'title', required: true, maxlength: 200, value: t.title || '' });
  const kindSelect = select('kind', Object.entries(KIND_LABELS), t.kind);
  // Routinen: Uhrzeit, zu der sie normalerweise beginnen (Vorschlag beim Einplanen im Kalender).
  const defaultTimeField = field('Standardstartzeit (optional)',
    el('input', { type: 'time', name: 'default_time', value: t.default_time || '' }),
    'Wird beim Einplanen im Kalender vorgeschlagen.');
  // Art der Routine: eintägig (Checkliste mit Start) oder mehrtägig (regelmäßige Aufgaben mit eigenen Rhythmen).
  const routineTypeField = el('div.field', {},
    el('span.field-label', {}, 'Art der Routine'),
    el('div.segmented.radio', {}, [['day', 'Eintägig'], ['multi', 'Mehrtägig']].map(([v, label]) => el('label', {},
      el('input', { type: 'radio', name: 'routine_type', value: v, checked: (t.routine_type || 'day') === v, onchange: () => showForKind() }),
      label))),
    el('small.muted', {}, 'Eintägig: Schritte am Stück abhaken, z. B. Morgenroutine. Mehrtägig: Aufgaben mit eigenem ',
      'Rhythmus, z. B. Haushalt (Bad wöchentlich, Fenster monatlich).'));
  const parent_ = parentPicker(t.parent_id, excluded);
  const parentSelect = parent_.input;

  // Routinen (und ihre Schritte) haben keine Priorität und kein "Wann?".
  const prioFieldset = el('fieldset', {},
    el('legend', {}, 'Wichtigkeit & Dringlichkeit'),
    priorityMatrix(values, t.id, touched));

  const whenFieldset = el('fieldset', {},
    el('legend', {}, 'Wann?'),
    el('div.segmented.radio', {}, [['once', 'Einmalig'], ['rhythm', 'Regelmäßig'], ['period', 'Zeitraum']]
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
    field('Titel', titleInput),
    el('div.row', {},
      field('Art', kindSelect),
      el('div.field.duration-field', {}, el('span.field-label', {}, 'Dauer (optional)'),
        el('div.duration-input', {},
          el('input', { type: 'number', name: 'duration_h', min: 0, max: 24, inputmode: 'numeric', value: t.duration_min >= 60 ? Math.floor(t.duration_min / 60) : '', 'aria-label': 'Stunden', placeholder: '0' }),
          el('span', {}, 'Std'),
          el('input', { type: 'number', name: 'duration_m', min: 0, max: 59, inputmode: 'numeric', value: t.duration_min ? t.duration_min % 60 || '' : '', 'aria-label': 'Minuten', placeholder: '0' }),
          el('span', {}, 'Min')))),
    routineTypeField,
    defaultTimeField,
    el('small.muted', {}, 'Projekt = freiwillig, macht Spaß. Routine = wiederkehrende Abläufe (ein- oder mehrtägig).'),
    topicPicker(t.topic_id),
    el('div.field', {}, el('span.field-label', {}, 'Gehört zu'), parent_.element),
    prioFieldset,
    whenFieldset,
    field('Notizen', el('textarea', { name: 'notes', rows: 3 }, t.notes || '')),
    !isNew && t.recurrence !== 'once' ? el('p.muted', {},
      `Zuletzt erledigt: ${t.last_done_at ? formatDate(t.last_done_at) : 'noch nie'}`,
      t.missed_count ? `, ${t.missed_count}× verpasst` : '') : null,
    el('div.buttons.sticky', {},
      el('button.primary', { type: 'submit' }, isNew ? 'Anlegen' : 'Speichern'),
      isNew || !canPlan(t) ? null : el('button', { type: 'button', onclick: () => { close(); planTask(t, refresh); } }, '📅 Einplanen'),
      isNew ? null : el('button.danger', { type: 'button', onclick: () => { close(); deleteTask(t, refresh); } }, 'Löschen')));

  function showRecurrence() {
    const current = form.elements.recurrence.value;
    for (const [key, box] of Object.entries(recurrenceBoxes)) box.hidden = key !== current;
  }

  function showForKind() {
    const routineLike = store.isInRoutine({ kind: kindSelect.value, parent_id: Number(parentSelect.value) || null });
    prioFieldset.hidden = routineLike;
    whenFieldset.hidden = routineLike;
    const topRoutine = kindSelect.value === 'routine' && !parentSelect.value;
    routineTypeField.hidden = !topRoutine;
    const multi = form.elements.routine_type?.value === 'multi';
    defaultTimeField.hidden = !topRoutine || multi;
  }
  kindSelect.addEventListener('change', showForKind);
  parentSelect.addEventListener('change', showForKind);
  showRecurrence();
  showForKind();

  function save() {
    const d = formData(form);
    const md = (prefix) => `${String(d[`${prefix}_month`]).padStart(2, '0')}-${String(d[`${prefix}_day`]).padStart(2, '0')}`;
    if (!touched.emotional) Object.assign(values.emotional, values.sachlich);
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
      repeat: d.recurrence === 'rhythm' ? rhythmRepeat.value() : null,
      repeat_from_done: d.repeat_from_done,
      has_deadline: d.has_deadline,
      buffer: d.buffer,
      period_start: md('period_start'),
      period_end: md('period_end'),
      window_start: d.recurrence === 'rhythm' ? d.rhythm_start : d.window_start,
      window_end: d.window_end,
      deadline_time: d.deadline_time,
      duration_min: (Number(d.duration_h) || 0) * 60 + (Number(d.duration_m) || 0) || '',
      default_time: d.default_time,
      routine_type: d.routine_type,
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
    else title = isDayStep ? 'Neuer Schritt' : inMulti ? 'Neue Aufgabe' : 'Neue Unteraufgabe';
  }
  const close = openDialog(title, form);

  // Neuer Schritt einer Routine: Titel gleich anwählen; die Enter-/Pfeiltaste der Tastatur legt ihn an.
  if (isNew && isDayStep) {
    titleInput.enterKeyHint = 'done';
    titleInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      save();
    });
    setTimeout(() => titleInput.focus(), 50);
  }
}

// --- Ansicht "Aufgaben & Projekte" ------------------------------------------

const filters = { kind: 'all', view: 'open' };

function dayHeading(at) {
  const days = daysBetween(parseDate(at), new Date());
  if (days === 0) return 'Heute';
  if (days === 1) return 'Gestern';
  return formatDate(at, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

// Verlauf aller erledigten Dinge, nach Tagen gruppiert.
function historyList(refresh) {
  const entries = store.history().filter(({ task }) => !task || filters.kind === 'all' || task.kind === filters.kind);
  if (!entries.length) return el('p.empty', {}, 'Noch nichts erledigt.');

  const groups = [];
  for (const entry of entries) {
    const heading = dayHeading(entry.at);
    if (groups.at(-1)?.heading !== heading) groups.push({ heading, entries: [] });
    groups.at(-1).entries.push(entry);
  }
  return groups.map(({ heading, entries: list }) => el('section.card', {},
    el('h3', {}, heading),
    el('ul.now-list', {}, list.map(({ at, task, wish }) => {
      const item = task || wish;
      const label = wish ? 'Wunschliste' : KIND_LABELS[task.kind];
      const canReopen = task && task.recurrence === 'once' && task.kind !== 'routine' && task.done_at === at;
      return el('li.now-item.history', {},
        el('div.now-text', {},
          el('button.link.task-title', {
            type: 'button',
            onclick: () => (task ? openTaskEditor(task, refresh) : null),
          }, topicDot(item), item.title),
          el('div.meta', {},
            el('span.badge', {}, at.slice(11, 16)),
            el(`span.badge.kind${task ? `.${task.kind}` : '.project'}`, {}, label),
            task && task.parent_id ? el('span.badge', {}, `in „${store.taskById(task.parent_id)?.title}“`) : null,
            task && task.recurrence !== 'once' ? el('span.badge', {}, `↻ wieder ab ${formatDate(task.window_start)}`) : null)),
        canReopen ? el('button.icon', {
          type: 'button',
          'aria-label': 'Wieder öffnen',
          title: 'Wieder öffnen',
          onclick: () => reopenTask(task, refresh),
        }, '↺') : null);
    }))));
}

export function renderTasksView(root) {
  const refresh = () => renderTasksView(root);
  // Oberste Ebene in der selbst festgelegten Reihenfolge (lange drücken und ziehen).
  const top = store.childrenOf(null).filter((t) => t.kind !== 'routine'
    && (filters.kind === 'all' || t.kind === filters.kind)
    && !['done', 'expired'].includes(t.status));

  mount(root,
    el('div.toolbar', {},
      el('h2', {}, 'Aufgaben'),
      el('span.spacer'),
      el('button.primary', { type: 'button', onclick: () => openTaskEditor({}, refresh) }, '+ Neu')),
    el('div.toolbar', {},
      el('div.segmented', {}, [['open', 'Offen'], ['done', 'Erledigt']].map(([v, label]) =>
        el(`button${filters.view === v ? '.active' : ''}`, { type: 'button', onclick: () => { filters.view = v; refresh(); } }, label))),
      el('div.segmented', {}, [['all', 'Alle'], ['todo', 'Aufgaben'], ['project', 'Projekte']].map(([v, label]) =>
        el(`button${filters.kind === v ? '.active' : ''}`, { type: 'button', onclick: () => { filters.kind = v; refresh(); } }, label)))),
    filters.view === 'done'
      ? historyList(refresh)
      : top.length
        ? el('div.card', {}, taskTree(top, refresh, { showDone: true, parentId: null }))
        : el('p.empty', {}, 'Nichts offen. Lege oben eine Aufgabe oder ein Projekt an.'));
}

// --- Ansicht "Routinen" -------------------------------------------------------

// Routinen werden nur angesehen; abgehakt wird ausschließlich über "Start", geändert nur im
// Bearbeiten-Modus. Lange Routinen sind eingeklappt (aufgeklappte merken wir uns, solange die App offen ist).
const ROUTINE_PREVIEW = 3;
const ROUTINE_COLLAPSE_FROM = 5;
const expandedRoutines = new Set();
const editingRoutines = new Set();

// Mehrtägige Routine: ihre Aufgaben mit Rhythmus und Fälligkeit, direkt abhakbar (wie in der Aufgabenliste).
function multiRoutineCard(routine, refresh) {
  const tasks = store.childrenOf(routine.id);
  return el('div.card.routine.multi', {},
    el('div.routine-head', {},
      topicDot(routine),
      el('strong', {}, routine.title),
      el('span.badge', {}, 'mehrtägig'),
      el('span.spacer'),
      el('button.icon.settings', {
        type: 'button',
        'aria-label': 'Einstellungen der Routine (Name, Thema, Art, Löschen)',
        title: 'Name, Thema, Art, Löschen',
        onclick: () => openTaskEditor(routine, refresh),
      }, '⚙')),
    tasks.length
      ? taskTree(tasks, refresh, { parentId: routine.id })
      : el('p.empty', {}, 'Noch keine Aufgaben – z. B. „Bad putzen“ wöchentlich, „Fenster putzen“ monatlich.'),
    el('div.buttons', {},
      el('button', {
        type: 'button',
        onclick: () => openTaskEditor({ parent_id: routine.id, topic_id: routine.topic_id }, refresh),
      }, '+ Aufgabe')));
}

function routineCard(routine, refresh) {
  if (store.isMultiRoutine(routine)) return multiRoutineCard(routine, refresh);
  const steps = store.childrenOf(routine.id);
  const editing = editingRoutines.has(routine.id);
  const minutes = store.routineMinutes(routine);
  const setEditing = (on) => {
    if (on) editingRoutines.add(routine.id); else editingRoutines.delete(routine.id);
    refresh();
  };

  if (editing) {
    return el('div.card.routine.editing', {},
      el('div.routine-head', {},
        topicDot(routine),
        el('strong', {}, routine.title),
        minutes ? el('span.badge', {}, formatDuration(minutes)) : null,
        el('span.spacer'),
        el('button.icon.settings', {
          type: 'button',
          'aria-label': 'Einstellungen der Routine (Name, Thema, Löschen)',
          title: 'Name, Thema, Löschen',
          onclick: () => openTaskEditor(routine, refresh),
        }, '⚙'),
        el('button.primary', { type: 'button', onclick: () => setEditing(false) }, '✓ Fertig')),
      el('p.edit-hint', {}, 'Bearbeiten: Schritt antippen zum Ändern. Lang drücken und ziehen: hoch/runter ',
        'verschiebt, nach rechts wird er zum Unterschritt, nach links eine Ebene höher.'),
      steps.length
        ? taskTree(steps, refresh, { showDone: true, parentId: routine.id, mode: 'edit' })
        : el('p.empty', {}, 'Noch keine Schritte.'),
      el('div.buttons', {},
        el('button', {
          type: 'button',
          onclick: () => openTaskEditor({ parent_id: routine.id, topic_id: routine.topic_id }, refresh),
        }, '+ Schritt')));
  }

  // Eingeklappt zählen Schritte und Unterschritte gleich: die ersten drei Einträge von oben.
  const allSteps = store.descendantsOf(routine.id);
  const long = allSteps.length >= ROUTINE_COLLAPSE_FROM;
  const expanded = !long || expandedRoutines.has(routine.id);
  const only = expanded ? null : new Set(allSteps.slice(0, ROUTINE_PREVIEW).map((t) => t.id));
  return el('div.card.routine', {},
    el('div.routine-head', {},
      topicDot(routine),
      el('strong', {}, routine.title),
      minutes ? el('span.badge', {}, formatDuration(minutes)) : null),
    routine.last_done_at ? el('small.muted', {}, `zuletzt ${formatDate(routine.last_done_at)}`) : null,
    steps.length
      ? taskTree(steps, refresh, { showDone: true, parentId: routine.id, mode: 'view', only })
      : el('p.empty', {}, 'Noch keine Schritte – über „Bearbeiten“ hinzufügen.'),
    long ? el('button.link.more-steps', {
      type: 'button',
      'aria-expanded': String(expanded),
      onclick: () => {
        if (expanded) expandedRoutines.delete(routine.id); else expandedRoutines.add(routine.id);
        refresh();
      },
    }, expanded ? '▴ Weniger anzeigen' : `▾ ${allSteps.length - ROUTINE_PREVIEW} weitere Schritte anzeigen`) : null,
    el('div.buttons.routine-actions', {},
      el('button.primary', { type: 'button', onclick: () => runRoutine(routine, refresh) }, '▶ Start'),
      el('button', { type: 'button', onclick: () => setEditing(true) }, '✎ Bearbeiten'),
      el('button', { type: 'button', onclick: () => planRoutine(routine, refresh) }, '📅 Einplanen')));
}

// Nächster Beginn einer Routine: ihre Standardstartzeit (heute, sonst morgen) oder die nächste volle Stunde.
export function routineStart(routine, day = null) {
  const now = new Date();
  if (routine.default_time) {
    const [h, m] = routine.default_time.split(':').map(Number);
    const base = day || now;
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
    if (!day && start < now) start.setDate(start.getDate() + 1);
    return start;
  }
  const start = day ? new Date(day) : new Date(now);
  if (!day) {
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
  }
  return start;
}

// Routine als Termin in den Kalender legen (Standardstartzeit, Dauer aus den Schritten).
// Aufgabe im Kalender einplanen (Zeit, um sie zu erledigen) – wie bei Routinen. Dauer aus der Aufgabe, sonst 1 Stunde;
// Beginn zur nächsten vollen Stunde.
const canPlan = (task) => task.kind !== 'routine' && !store.isInRoutine(task) && task.status !== 'done';

export function planTask(task, refresh) {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const minutes = task.duration_min || 60;
  openEventEditor({
    task_id: task.id,
    title: task.title,
    topic_id: task.topic_id,
    start_at: isoDateTime(start),
    end_at: isoDateTime(new Date(+start + minutes * 60000)),
  }, refresh);
}

function planRoutine(routine, refresh) {
  const start = routineStart(routine);
  const minutes = store.routineMinutes(routine) || 30;
  openEventEditor({
    routine_id: routine.id,
    topic_id: routine.topic_id,
    start_at: isoDateTime(start),
    end_at: isoDateTime(new Date(+start + minutes * 60000)),
  }, refresh);
}

export function renderRoutinesView(root) {
  const refresh = () => renderRoutinesView(root);
  const list = store.routines();

  mount(root,
    el('div.toolbar', {},
      el('h2', {}, 'Routinen'),
      el('span.spacer'),
      el('button.primary', {
        type: 'button',
        onclick: () => openTaskEditor({ kind: 'routine' }, () => {
          // Eine neu angelegte eintägige Routine gleich im Bearbeiten-Modus öffnen, damit man Schritte hinzufügen kann.
          const created = store.routines().find((r) => !list.some((old) => old.id === r.id));
          if (created && !store.isMultiRoutine(created)) editingRoutines.add(created.id);
          refresh();
        }),
      }, '+ Routine')),
    list.length ? null : el('p.muted', {},
      'Eintägig: z. B. „Morgenroutine“, „Abendroutine“ – Schritte am Stück abhaken, mit „📅 Einplanen“ in den Kalender. ',
      'Mehrtägig: z. B. „Haushalt“ – Aufgaben mit eigenem Rhythmus (Bad wöchentlich, Fenster monatlich).'),
    section('Eintägig', list.filter((r) => !store.isMultiRoutine(r))),
    section('Mehrtägig', list.filter((r) => store.isMultiRoutine(r))));

  // Überschriften nur, wenn es beide Arten gibt.
  function section(label, routinesOfKind) {
    if (!routinesOfKind.length) return null;
    const both = list.some((r) => store.isMultiRoutine(r)) && list.some((r) => !store.isMultiRoutine(r));
    return [both ? el('h3.routine-section', {}, label) : null, routinesOfKind.map((routine) => routineCard(routine, refresh))];
  }
}

// Schritte einer Routine als verschachtelte Checkliste. Abhaken eines Schritts hakt seine Unterschritte mit ab;
// wer etwas abhakt, hat die Routine damit gestartet.
export function routineChecklist(routine, onChange) {
  const toggle = (step) => {
    attempt(() => {
      if (step.done_at) return store.reopenTask(step.id);
      store.startRoutine(routine.id);
      return store.completeTask(step.id);
    });
    onChange();
  };
  const list = (parentId) => el('ul.checklist', {}, store.childrenOf(parentId).map((step) => {
    const subs = store.childrenOf(step.id).length ? list(step.id) : null;
    return el('li', {},
      el('label.check', {},
        el('input', { type: 'checkbox', checked: Boolean(step.done_at), onchange: () => toggle(step) }),
        step.title,
        step.duration_min ? el('span.muted', {}, ` (${formatDuration(step.duration_min)})`) : null),
      subs);
  }));
  return list(routine.id);
}

// Fortschritt einer Routine: erledigte Schritte der untersten Ebene.
export function routineProgress(routine) {
  const steps = store.descendantsOf(routine.id).filter((s) => !store.childrenOf(s.id).length);
  return { done: steps.filter((s) => s.done_at).length, total: steps.length };
}

// Routine abbrechen: läuft nicht mehr, Häkchen werden zurückgesetzt.
export function cancelRoutine(routine, refresh) {
  if (!window.confirm(`Routine „${routine.title}“ abbrechen? Abgehakte Schritte werden zurückgesetzt.`)) return false;
  attempt(() => store.cancelRoutine(routine.id));
  toast(`Routine „${routine.title}“ abgebrochen`);
  refresh();
  return true;
}

// Routine starten und als Checkliste abarbeiten. Sie läuft weiter (Leiste über der Navigation),
// bis sie abgeschlossen oder abgebrochen wird; beim Abschließen werden alle Schritte zurückgesetzt.
export function runRoutine(routine, refresh = () => {}) {
  attempt(() => store.startRoutine(routine.id));
  const body = el('div');
  const render = () => {
    const { done, total } = routineProgress(routine);
    mount(body,
      el('progress', { max: total || 1, value: done }),
      routineChecklist(routine, render),
      total ? null : el('p.muted', {}, 'Diese Routine hat noch keine Schritte.'),
      el('div.buttons.run-buttons', {},
        el('button.primary', {
          type: 'button',
          onclick: () => { close(); completeTask(routine, refresh); },
        }, done === total ? '✓ Routine abschließen' : 'Trotzdem abschließen'),
        el('button', { type: 'button', onclick: () => { close(); refresh(); } }, 'Später weitermachen'),
        el('button.danger', {
          type: 'button',
          onclick: () => { if (cancelRoutine(routine, refresh)) close(); },
        }, 'Abbrechen')));
  };
  render();
  const close = openDialog(`▶ ${routine.title}`, body);
}
