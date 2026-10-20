// Kalender: Tages-, 3-Tages-, Wochen- und Monatsansicht; Termine mit Bereichen davor/danach.

import {
  el, mount, field, select, formData, openDialog, toast, attempt,
} from './ui.js';
import {
  addDays, formatDate, formatTime, isoDate, isoDateTime, parseDate, startOfDay, startOfWeek,
} from './dates.js';
import * as store from './store.js';
import { runRoutine } from './tasks.js';

const HOUR_PX = 44;
const MODES = { 1: 'Tag', 3: '3 Tage', 7: 'Woche', month: 'Monat' };

const view = {
  mode: readSetting('calendarMode', window.innerWidth < 700 ? '3' : '7'),
  anchor: new Date(),
  showEvents: readSetting('showEvents', true),
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
    return `↻ ${store.taskById(event[`${side}_routine_id`])?.title || 'Routine'}`;
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
      : `${formatDate(from, { day: '2-digit', month: '2-digit' })} – ${formatDate(to, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

  mount(root,
    el('div.toolbar', {},
      el('h2', {}, 'Kalender'),
      el('span.spacer'),
      el('button.primary', { type: 'button', onclick: () => openEventEditor({}, refresh) }, '+ Termin')),
    el('div.toolbar', {},
      el('div.segmented', {}, Object.entries(MODES).map(([m, label]) =>
        el(`button${view.mode === m ? '.active' : ''}`, {
          type: 'button',
          onclick: () => { view.mode = m; writeSetting('calendarMode', m); refresh(); },
        }, label)))),
    el('div.toolbar', {},
      el('button.icon.nav', { type: 'button', 'aria-label': 'Zurück', onclick: () => step(-1) }, '‹'),
      el('button', { type: 'button', onclick: () => { view.anchor = new Date(); refresh(); } }, 'Heute'),
      el('button.icon.nav', { type: 'button', 'aria-label': 'Vor', onclick: () => step(1) }, '›'),
      el('strong.cal-title', {}, title)),
    el('div.toolbar', {},
      el('label.check', {},
        el('input', {
          type: 'checkbox',
          checked: view.showEvents,
          onchange: (e) => { view.showEvents = e.target.checked; writeSetting('showEvents', view.showEvents); refresh(); },
        }),
        `Veranstaltungen anzeigen${!view.showEvents && hiddenCount ? ` (${hiddenCount} ausgeblendet)` : ''}`)),
    legend(),
    view.mode === 'month' ? monthGrid(from, to, events, refresh) : dayGrid(from, Number(view.mode), events, refresh));

  const scroller = root.querySelector('.week-scroll');
  if (scroller) scroller.scrollTop = 6.5 * HOUR_PX;
}

function legend() {
  const list = store.topics();
  if (!list.length) return null;
  return el('div.legend', {}, list.map((t) =>
    el('span', {}, el('span.dot', { style: { background: t.color } }), t.name)));
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
      el('span.block-time', {}, formatTime(seg.start)),
      el('span.block-title', {}, seg.label)));
    }
    return col;
  });

  return el('div.week', {},
    el('div.week-head', { style: { gridTemplateColumns: columns } },
      el('div'),
      days.map((d) => el(`div.day-head${isoDate(d) === today ? '.today' : ''}`, {}, formatDate(d)))),
    el('div.week-scroll', {}, el('div.week-body', { style: { gridTemplateColumns: columns } }, hours, cols)),
    el('p.muted.hint', {}, 'Tippe auf eine freie Stelle, um dort einen Termin anzulegen. Schraffiert = davor/danach.'));
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
  return el('div', {},
    el('div.month', {}, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => el('div.month-head', {}, d)), cells),
    el('p.muted.hint', {}, 'Tippe auf einen Tag, um ihn zu öffnen.'));
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
  const toInput = (v) => isoDateTime(parseDate(v));

  const startInput = el('input', { type: 'datetime-local', name: 'start_at', required: true, value: toInput(ev.start_at) });
  const endInput = el('input', { type: 'datetime-local', name: 'end_at', required: true, value: toInput(ev.end_at) });
  // Dauer beibehalten, wenn der Beginn verschoben wird.
  let duration = parseDate(ev.end_at) - parseDate(ev.start_at);
  startInput.addEventListener('change', () => {
    if (startInput.value) endInput.value = isoDateTime(new Date(+parseDate(startInput.value) + duration));
  });
  endInput.addEventListener('change', () => { duration = parseDate(endInput.value) - parseDate(startInput.value); });

  const routineButtons = ['before', 'after']
    .filter((side) => ev[`${side}_type`] === 'routine' && store.taskById(ev[`${side}_routine_id`]))
    .map((side) => {
      const r = store.taskById(ev[`${side}_routine_id`]);
      return el('button', { type: 'button', onclick: () => runRoutine(r, () => {}) }, `▶ ${r.title}`);
    });

  const form = el('form.form-grid', { onsubmit: (e) => { e.preventDefault(); save(); } },
    field('Titel', el('input', { name: 'title', required: true, maxlength: 200, value: ev.title || '' })),
    el('div.row', {},
      field('Thema', select('topic_id', [['', '— ohne —'], ...store.topics().map((t) => [t.id, t.name])], ev.topic_id)),
      el('label.check', {}, el('input', { type: 'checkbox', name: 'is_event', checked: Boolean(ev.is_event) }), 'Veranstaltung')),
    el('div.row', {}, field('Beginn', startInput), field('Ende', endInput)),
    sideFields('before', ev),
    sideFields('after', ev),
    field('Notizen', el('textarea', { name: 'notes', rows: 3 }, ev.notes || '')),
    el('div.buttons.sticky', {},
      el('button.primary', { type: 'submit' }, isNew ? 'Anlegen' : 'Speichern'),
      routineButtons,
      isNew ? null : el('button.danger', { type: 'button', onclick: remove }, 'Löschen')));

  function save() {
    const payload = formData(form);
    const ok = attempt(() => (isNew ? store.createEvent(payload) : store.updateEvent(ev.id, payload)));
    if (!ok) return;
    close();
    toast(isNew ? 'Termin angelegt' : 'Termin gespeichert');
    refresh();
  }

  function remove() {
    if (!window.confirm(`Termin „${ev.title}“ löschen?`)) return;
    attempt(() => store.deleteEvent(ev.id));
    close();
    refresh();
  }

  const topic = store.topicById(ev.topic_id);
  const close = openDialog(isNew ? 'Neuer Termin' : `Termin${topic ? ` · ${topic.name}` : ''}`, form);
}
