// Kalender: Tages-, 3-Tages-, Wochen- und Monatsansicht; Termine mit Bereichen davor/danach.

import {
  el, mount, field, select, formData, openDialog, toast, attempt,
} from './ui.js';
import {
  addDays, formatDate, formatTime, isoDate, isoDateTime, parseDate, startOfDay, startOfWeek,
} from './dates.js';
import * as store from './store.js';
import { runRoutine } from './tasks.js';
import { topicPicker } from './topic-picker.js';
import { askScope, repeatFields } from './repeat-fields.js';
import { dateTimeField } from './datetime-picker.js';

const HOUR_PX = 44;
const MODES = { 1: 'Tag', 3: '3 Tage', 7: 'Woche', month: 'Monat' };

const view = {
  mode: 'month', // beim Öffnen immer die Monatsansicht
  anchor: new Date(),
  showEvents: readSetting('showEvents', true),
  pickMonth: false,
  pickYear: new Date().getFullYear(),
};

function readSetting(key, fallback) {
  try {
    const value = localStorage.getItem(`planungsapp.setting.${key}`);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try { localStorage.setItem(`planungsapp.setting.${key}`, JSON.stringify(value)); } catch { /* egal */ }
}

// Termin in Blöcke zerlegen: davor, Termin, danach.
function segments(event) {
  const start = parseDate(event.start_at);
  const end = parseDate(event.end_at);
  const list = [];
  if (event.before_type !== 'none' && event.before_minutes) {
    list.push({ part: 'before', start: new Date(start - event.before_minutes * 60000), end: start, label: sideLabel(event, 'before') });
  }
  list.push({ part: 'main', start, end, label: event.title });
  if (event.after_type !== 'none' && event.after_minutes) {
    list.push({ part: 'after', start: end, end: new Date(+end + event.after_minutes * 60000), label: sideLabel(event, 'after') });
  }
  return list;
}

function sideLabel(event, side) {
  if (event[`${side}_type`] === 'routine') {
    return store.taskById(event[`${side}_routine_id`])?.title || 'Routine';
  }
  return event[`${side}_label`] || (side === 'before' ? 'Vorlauf' : 'Nachlauf');
}

function range() {
  if (view.mode === 'month') {
    const first = new Date(view.anchor.getFullYear(), view.anchor.getMonth(), 1);
    const last = new Date(view.anchor.getFullYear(), view.anchor.getMonth() + 1, 0);
    return [startOfWeek(first), addDays(startOfWeek(last), 6)];
  }
  const days = Number(view.mode);
  const from = days === 7 ? startOfWeek(view.anchor) : startOfDay(view.anchor);
  return [from, addDays(from, days - 1)];
}

export function renderCalendarView(root) {
  const refresh = () => renderCalendarView(root);
  const [from, to] = range();
  let events = store.eventsBetween(from, to);
  const hiddenCount = events.filter((e) => e.is_event).length;
  if (!view.showEvents) events = events.filter((e) => !e.is_event);

  const step = (dir) => {
    view.anchor = view.mode === 'month'
      ? new Date(view.anchor.getFullYear(), view.anchor.getMonth() + dir, 1)
      : addDays(view.anchor, Number(view.mode) * dir);
    refresh();
  };

  const title = view.mode === 'month'
    ? view.anchor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
    : view.mode === '1'
      ? formatDate(from, { weekday: 'long', day: '2-digit', month: 'long' })
      : from.getMonth() === to.getMonth()
        ? `${from.getDate()}.–${to.getDate()}. ${formatDate(to, { month: 'short' }).replace('.', '')}`
        : `${from.getDate()}.${from.getMonth() + 1}.–${to.getDate()}.${to.getMonth() + 1}.`;

  // Kompakter Kopf, damit möglichst viel Platz für den Kalender bleibt.
  // Antippen des Titels öffnet die Monats-/Jahresauswahl.
  mount(root,
    el('div.toolbar.cal-head', {},
      el('button.icon.nav', { type: 'button', 'aria-label': 'Zurück', onclick: () => step(-1) }, '‹'),
      el('button.link.cal-title', {
        type: 'button',
        'aria-expanded': String(view.pickMonth),
        onclick: () => { view.pickMonth = !view.pickMonth; view.pickYear = view.anchor.getFullYear(); refresh(); },
      }, title, el('span.caret', {}, view.pickMonth ? '▴' : '▾')),
      el('button.icon.nav', { type: 'button', 'aria-label': 'Vor', onclick: () => step(1) }, '›'),
      el('span.spacer'),
      el('button', { type: 'button', onclick: () => { view.anchor = new Date(); view.pickMonth = false; refresh(); } }, 'Heute')),
    view.pickMonth ? monthPicker(refresh) : null,
    el('div.segmented.modes', {}, Object.entries(MODES).map(([m, label]) =>
      el(`button${view.mode === m ? '.active' : ''}`, {
        type: 'button',
        onclick: () => { view.mode = m; refresh(); },
      }, label))),
    el('button.primary.fab', { type: 'button', 'aria-label': 'Neuer Termin', onclick: () => openEventEditor({}, refresh) }, '+'),
    el('div.legend', {},
      el('label.check.small', {},
        el('input', {
          type: 'checkbox',
          checked: view.showEvents,
          onchange: (e) => { view.showEvents = e.target.checked; writeSetting('showEvents', view.showEvents); refresh(); },
        }),
        `Veranstaltungen${!view.showEvents && hiddenCount ? ` (${hiddenCount} aus)` : ''}`),
      legend()),
    view.mode === 'month' ? monthGrid(from, to, events, refresh) : dayGrid(from, Number(view.mode), events, refresh));

  const scroller = root.querySelector('.week-scroll');
  if (scroller) scroller.scrollTop = 6.5 * HOUR_PX;
}

// Monat und Jahr direkt wählen (Jahr mit ‹ ›).
const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function monthPicker(refresh) {
  const now = new Date();
  const year = view.pickYear;
  const changeYear = (dir) => { view.pickYear += dir; refresh(); };
  return el('div.month-picker', {},
    el('div.dt-head', {},
      el('button.icon', { type: 'button', 'aria-label': 'Voriges Jahr', onclick: () => changeYear(-1) }, '‹'),
      el('strong', {}, String(year)),
      el('button.icon', { type: 'button', 'aria-label': 'Nächstes Jahr', onclick: () => changeYear(1) }, '›')),
    el('div.month-picker-grid', {}, MONTH_NAMES.map((name, m) => {
      const isCurrent = view.anchor.getFullYear() === year && view.anchor.getMonth() === m;
      const isNow = now.getFullYear() === year && now.getMonth() === m;
      return el(`button${isCurrent ? '.selected' : ''}${isNow ? '.now' : ''}`, {
        type: 'button',
        onclick: () => {
          view.anchor = new Date(year, m, 1);
          view.pickMonth = false;
          refresh();
        },
      }, name);
    })));
}

function legend() {
  return store.topics().map((t) => el('span', {}, el('span.dot', { style: { background: t.color } }), t.name));
}

function dayGrid(from, count, events, refresh) {
  const days = [...Array(count)].map((_, i) => addDays(from, i));
  const today = isoDate(new Date());
  const columns = `2.6rem repeat(${count}, minmax(0, 1fr))`;

  const hours = el('div.hours', {}, [...Array(24)].map((_, h) =>
    el('div.hour', { style: { height: `${HOUR_PX}px` } }, `${String(h).padStart(2, '0')}`)));

  const cols = days.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    const col = el(`div.day-col${isoDate(day) === today ? '.today' : ''}`, {
      style: { height: `${24 * HOUR_PX}px` },
      onclick: (e) => {
        if (e.target !== col) return;
        const start = new Date(dayStart);
        start.setHours(Math.floor(e.offsetY / HOUR_PX));
        openEventEditor({ start_at: isoDateTime(start), end_at: isoDateTime(new Date(+start + 3600000)) }, refresh);
      },
    });

    const blocks = events.flatMap((ev) => segments(ev).map((seg) => ({ ev, seg })))
      .filter(({ seg }) => seg.end > dayStart && seg.start < dayEnd);
    layoutLanes(blocks);

    for (const { ev, seg, lane, lanes } of blocks) {
      const s = Math.max(seg.start, dayStart);
      const e = Math.min(seg.end, dayEnd);
      const top = ((s - dayStart) / 3600000) * HOUR_PX;
      const height = Math.max(16, ((e - s) / 3600000) * HOUR_PX - 2);
      col.append(el(`button.block.${seg.part}${ev.is_event ? '.is-event' : ''}${height < 30 ? '.short' : ''}`, {
        type: 'button',
        style: {
          top: `${top}px`,
          height: `${height}px`,
          left: `${(lane / lanes) * 100}%`,
          width: `calc(${100 / lanes}% - 3px)`,
          '--c': store.topicColor(ev.topic_id),
        },
        title: `${formatTime(seg.start)}–${formatTime(seg.end)} ${seg.label}`,
        onclick: () => openEventEditor(ev, refresh),
      },
      // Kurze Blöcke in schmalen Spalten: lieber den Titel als die Uhrzeit zeigen.
      height < 30 && count > 3 ? null : el('span.block-time', {}, formatTime(seg.start)),
      el('span.block-title', {}, seg.label)));
    }
    return col;
  });

  return el('div.week', {},
    el('div.week-head', { style: { gridTemplateColumns: columns } },
      el('div'),
      days.map((d) => el(`div.day-head${isoDate(d) === today ? '.today' : ''}`, {},
        el('span', {}, formatDate(d, { weekday: 'short' }).replace('.', '')),
        el('strong', {}, formatDate(d, count === 7 ? { day: 'numeric' } : { day: '2-digit', month: '2-digit' }))))),
    el('div.week-scroll', {}, el('div.week-body', { style: { gridTemplateColumns: columns } }, hours, cols)));
}

// Überlappende Blöcke nebeneinander anordnen.
function layoutLanes(blocks) {
  blocks.sort((a, b) => a.seg.start - b.seg.start || b.seg.end - a.seg.end);
  let group = [];
  let groupEnd = 0;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((b) => b.lane + 1));
    for (const b of group) b.lanes = lanes;
    group = [];
  };
  for (const block of blocks) {
    if (block.seg.start >= groupEnd && group.length) flush();
    const used = new Set(group.filter((b) => b.seg.end > block.seg.start).map((b) => b.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    block.lane = lane;
    group.push(block);
    groupEnd = Math.max(groupEnd, +block.seg.end);
  }
  if (group.length) flush();
}

function monthGrid(from, to, events, refresh) {
  const month = view.anchor.getMonth();
  const today = isoDate(new Date());
  const cells = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const day = new Date(d);
    const key = isoDate(day);
    const dayEvents = events.filter((ev) => ev.start_at.slice(0, 10) <= key && ev.end_at.slice(0, 10) >= key);
    cells.push(el(`div.month-cell${day.getMonth() !== month ? '.other' : ''}${key === today ? '.today' : ''}`, {
      onclick: (e) => {
        if (e.target.closest('.chip')) return;
        view.anchor = day;
        view.mode = '1';
        refresh();
      },
    },
    el('span.month-day', {}, String(day.getDate())),
    dayEvents.map((ev) => el(`button.chip${ev.is_event ? '.is-event' : ''}`, {
      type: 'button',
      style: { '--c': store.topicColor(ev.topic_id) },
      title: `${formatTime(parseDate(ev.start_at))} ${ev.title}`,
      onclick: () => openEventEditor(ev, refresh),
    }, ev.title))));
  }
  return el('div.month', {}, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => el('div.month-head', {}, d)), cells);
}

// --- Termin-Editor -----------------------------------------------------------

function sideFields(side, ev) {
  const type = ev[`${side}_type`] || 'none';
  const routineList = store.routines();
  const minutes = el('input', { type: 'number', name: `${side}_minutes`, min: 1, inputmode: 'numeric', value: ev[`${side}_minutes`] || 30 });
  const routineSelect = select(`${side}_routine_id`, [['', '— Routine wählen —'], ...routineList.map((r) => [r.id, r.title])], ev[`${side}_routine_id`]);
  routineSelect.addEventListener('change', () => {
    const r = store.taskById(routineSelect.value);
    if (r && store.routineMinutes(r)) minutes.value = store.routineMinutes(r);
  });
  const label = el('input', { name: `${side}_label`, maxlength: 100, value: ev[`${side}_label`] || '', placeholder: side === 'before' ? 'z. B. Anfahrt' : 'z. B. Heimweg' });

  const details = el('div.row');
  const radios = el('div.segmented.radio', {}, [['none', 'Nichts'], ['free', 'Frei'], ['routine', 'Routine']].map(([v, text]) =>
    el('label', {}, el('input', { type: 'radio', name: `${side}_type`, value: v, checked: type === v, onchange: show }), text)));

  function show() {
    const current = radios.querySelector('input:checked').value;
    mount(details, current === 'none' ? null : [
      current === 'free'
        ? field('Bezeichnung', label)
        : field('Routine', routineSelect, routineList.length ? null : 'Lege zuerst unter „Routinen“ eine an.'),
      field('Minuten', minutes),
    ]);
  }
  show();

  return el('fieldset', {}, el('legend', {}, side === 'before' ? 'Davor (z. B. Anfahrt)' : 'Danach'), radios, details);
}

export function openEventEditor(event, refresh) {
  const isNew = !event.id;
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const ev = {
    start_at: isoDateTime(next),
    end_at: isoDateTime(new Date(+next + 3600000)),
    is_event: false,
    ...event,
  };
  // Datum & Uhrzeit mit Monatskalender (statt der Drehräder des Handys).
  const startField = dateTimeField('start_at', ev.start_at, { required: true });
  const endField = dateTimeField('end_at', ev.end_at, { required: true });
  const startInput = startField.input;
  const endInput = endField.input;
  // Dauer beibehalten, wenn der Beginn verschoben wird.
  let duration = parseDate(ev.end_at) - parseDate(ev.start_at);
  startInput.addEventListener('change', () => {
    if (startInput.value) endField.set(new Date(+parseDate(startInput.value) + duration), false);
  });
  endInput.addEventListener('change', () => { duration = parseDate(endInput.value) - parseDate(startInput.value); });

  const repeat = repeatFields(ev.repeat || null, startInput);

  const routineButtons = ['before', 'after']
    .filter((side) => ev[`${side}_type`] === 'routine' && store.taskById(ev[`${side}_routine_id`]))
    .map((side) => {
      const r = store.taskById(ev[`${side}_routine_id`]);
      return el('button', { type: 'button', onclick: () => runRoutine(r, () => {}) }, `▶ ${r.title}`);
    });

  const form = el('form.form-grid', { onsubmit: (e) => { e.preventDefault(); save(); } },
    field('Titel', el('input', { name: 'title', required: true, maxlength: 200, value: ev.title || '' })),
    topicPicker(ev.topic_id),
    el('label.check', {}, el('input', { type: 'checkbox', name: 'is_event', checked: Boolean(ev.is_event) }),
      'Veranstaltung (lässt sich im Kalender ausblenden)'),
    el('div.field', {}, el('span.field-label', {}, 'Beginn'), startField.element),
    el('div.field', {}, el('span.field-label', {}, 'Ende'), endField.element),
    repeat.element,
    sideFields('before', ev),
    sideFields('after', ev),
    field('Notizen', el('textarea', { name: 'notes', rows: 3 }, ev.notes || '')),
    el('div.buttons.sticky', {},
      el('button.primary', { type: 'submit' }, isNew ? 'Anlegen' : 'Speichern'),
      routineButtons,
      isNew ? null : el('button.danger', { type: 'button', onclick: remove }, 'Löschen')));

  function save() {
    const payload = { ...formData(form), repeat: repeat.value() };
    if (!attempt(() => store.checkEvent(payload))) return;
    const run = (scope) => {
      const ok = attempt(() => (isNew
        ? store.createEvent(payload)
        : store.updateEvent(ev.id, payload, { scope, occurrence: ev.occurrence })));
      if (!ok) return;
      close();
      toast(isNew ? 'Termin angelegt' : 'Termin gespeichert');
      refresh();
    };
    // Bei Serien wie in Google Kalender nachfragen, was geändert werden soll.
    if (ev.series) askScope('Wiederkehrenden Termin speichern', run);
    else run('all');
  }

  function remove() {
    const run = (scope) => {
      attempt(() => store.deleteEvent(ev.id, { scope, occurrence: ev.occurrence }));
      close();
      refresh();
    };
    if (ev.series) askScope('Wiederkehrenden Termin löschen', run);
    else if (window.confirm(`Termin „${ev.title}“ löschen?`)) run('all');
  }

  const topic = store.topicById(ev.topic_id);
  const close = openDialog(isNew ? 'Neuer Termin' : `Termin${topic ? ` · ${topic.name}` : ''}`, form);
}
