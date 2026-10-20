// Kalender: Tages-, 3-Tages-, Wochen- und Monatsansicht; Termine mit Bereichen davor/danach.

import {
  el, mount, field, select, formData, openDialog, toast, attempt,
} from './ui.js';
import {
  addDays, formatDate, formatTime, isoDate, isoDateTime, parseDate, startOfDay, startOfWeek,
} from './dates.js';
import * as store from './store.js';
import { routineStart, runRoutine } from './tasks.js';
import { topicPicker } from './topic-picker.js';
import { askScope, repeatFields } from './repeat-fields.js';
import { dateTimeField } from './datetime-picker.js';
import { enableEventDrag, justDragged } from './event-drag.js';

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
  list.push({ part: 'main', start, end, label: eventTitle(event) });
  if (event.after_type !== 'none' && event.after_minutes) {
    list.push({ part: 'after', start: end, end: new Date(+end + event.after_minutes * 60000), label: sideLabel(event, 'after') });
  }
  return list;
}

// Eingeplante Routinen heißen im Kalender immer wie die Routine (auch nach Umbenennen).
function eventTitle(event) {
  return (event.routine_id && store.taskById(event.routine_id)?.title) || event.title;
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

// Neuer Termin über „+“: in Tag/3 Tage/Woche am angezeigten Tag (heute, falls sichtbar, sonst der erste) –
// heute zur nächsten vollen Stunde, an anderen Tagen um 9 Uhr. In der Monatsansicht wie gewohnt ab jetzt.
function newEventAt(from, to) {
  if (view.mode === 'month') return {};
  const today = startOfDay(new Date());
  const isToday = today >= from && today <= to;
  const day = isToday ? today : from;
  const hour = isToday ? Math.min(23, new Date().getHours() + 1) : 9; // kurz vor Mitternacht: 23 Uhr
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
  return { start_at: isoDateTime(start), end_at: isoDateTime(new Date(+start + 3600000)) };
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
      ? formatDate(from, { weekday: 'short', day: 'numeric', month: 'short' })
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
        onclick: () => setMode(m, refresh),
      }, label))),
    el('button.primary.fab', { type: 'button', 'aria-label': 'Neuer Termin', onclick: () => openEventEditor(newEventAt(from, to), refresh) }, '+'),
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
  // Ist heute zu sehen, zur aktuellen Uhrzeit scrollen (etwas Vorlauf), sonst zum Morgen.
  // Nach einem Wisch zum nächsten/vorigen Tag bleibt die Uhrzeit, die man gerade angesehen hat.
  const line = root.querySelector('.now-line');
  if (scroller && swiped) {
    scroller.scrollTop = swiped.scrollTop;
    if (swiped.dir) root.querySelector('.week').classList.add(swiped.dir > 0 ? 'slide-next' : 'slide-prev');
  } else if (scroller) {
    scroller.scrollTop = line ? Math.max(0, line.offsetTop - 2 * HOUR_PX) : 6.5 * HOUR_PX;
  }
  swiped = null;
  if (scroller) {
    onSwipe(root.querySelector('.week'), (dir) => {
      swiped = { dir, scrollTop: scroller.scrollTop };
      step(dir);
    });
    enableEventDrag(root.querySelector('.week'), {
      hourPx: HOUR_PX,
      // Beim Blättern während des Ziehens ist schon neu gezeichnet worden → aktuellen Scroller nehmen.
      onEdge: (dir) => {
        swiped = { dir, scrollTop: document.querySelector('.week-scroll').scrollTop };
        step(dir);
      },
      onDrop: ({ ev }, delta) => {
        swiped = { dir: 0, scrollTop: document.querySelector('.week-scroll').scrollTop }; // Uhrzeit im Blick behalten
        moveEvent(ev, delta, refresh);
      },
    });
  }
}

// Termin um delta Millisekunden verschieben (Bereiche davor/danach wandern mit).
function moveEvent(ev, delta, refresh) {
  if (!delta) return;
  const start = new Date(+parseDate(ev.start_at) + delta);
  const end = new Date(+parseDate(ev.end_at) + delta);
  const payload = { ...ev, start_at: isoDateTime(start), end_at: isoDateTime(end) };
  // Wöchentlich an genau dem bisherigen Wochentag → der Wochentag zieht mit um.
  const oldDay = parseDate(ev.start_at).getDay();
  if (ev.repeat?.freq === 'weekly' && ev.repeat.weekdays?.length === 1 && ev.repeat.weekdays[0] === oldDay) {
    payload.repeat = { ...ev.repeat, weekdays: [start.getDay()] };
  }
  const run = (scope) => {
    if (attempt(() => store.updateEvent(ev.id, payload, { scope, occurrence: ev.occurrence }))) {
      toast(`„${eventTitle(ev)}“ → ${formatDate(start, { weekday: 'short', day: 'numeric', month: 'numeric' })} ${formatTime(start)}`);
    }
    refresh();
  };
  if (ev.series) askScope('Wiederkehrenden Termin verschieben', run);
  else run('all');
}

// Wischen nach links = weiter (nächster Tag bzw. nächste Tage), nach rechts = zurück.
// Der Kalender folgt dabei dem Finger; der neue Tag gleitet von der Seite herein. Bewegt wird nur der Inhalt
// innerhalb des Kalenderrahmens (der schneidet ab), damit die Seite nicht seitlich verrutscht.
const SWIPE_PX = 60;
const SWIPE_OUT_MS = 140;
let swiped = null;

function onSwipe(node, go) {
  let start = null;
  const parts = () => [...node.children];
  const move = (dx, animate) => {
    for (const part of parts()) {
      part.style.transition = animate ? `transform ${SWIPE_OUT_MS}ms ease-out` : 'none';
      part.style.transform = dx ? `translateX(${dx}px)` : '';
    }
  };
  node.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, at: Date.now(), axis: null } : null;
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    if (!start) return;
    if (justDragged()) { move(0); start = null; return; } // Termin wird verschoben, nicht geblättert
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Erst entscheiden, ob seitlich gewischt oder senkrecht gescrollt wird – dann dabei bleiben.
    if (!start.axis && Math.hypot(dx, dy) > 10) start.axis = Math.abs(dx) > 1.5 * Math.abs(dy) ? 'x' : 'y';
    if (start.axis === 'x') move(dx);
  }, { passive: true });
  const end = (e) => {
    if (!start) return;
    const { axis } = start;
    const dx = e.changedTouches[0].clientX - start.x;
    start = null;
    if (axis !== 'x' || justDragged()) { move(0, true); return; }
    if (Math.abs(dx) < SWIPE_PX) { move(0, true); return; } // zurückfedern
    const dir = dx < 0 ? 1 : -1;
    move(-dir * node.clientWidth, true); // alter Tag gleitet hinaus …
    setTimeout(() => go(dir), SWIPE_OUT_MS); // … der neue herein
  };
  node.addEventListener('touchend', end, { passive: true });
  node.addEventListener('touchcancel', end, { passive: true });
}

// Strich bei der aktuellen Uhrzeit; wandert jede Minute weiter, solange er angezeigt wird.
function nowLine() {
  const line = el('div.now-line', { 'aria-hidden': 'true' });
  const place = () => {
    const now = new Date();
    line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX}px`;
  };
  place();
  const timer = setInterval(() => (line.isConnected ? place() : clearInterval(timer)), 60000);
  return line;
}

// Ansicht wechseln. Verlässt man die Monatsansicht (Tag, 3 Tage, Woche), landet das im Browser-Verlauf:
// Die Zurück-Taste des Handys führt dann immer zur Monatsansicht statt die App zu verlassen.
function setMode(mode, refresh) {
  if (view.mode === 'month' && mode !== 'month') {
    history.pushState({ calDetail: true }, '');
  } else if (view.mode !== 'month' && mode === 'month' && history.state?.calDetail) {
    history.back(); // der popstate-Handler schaltet auf Monat
    return;
  }
  view.mode = mode;
  refresh();
}

function openDay(day, refresh) {
  view.anchor = day;
  setMode('1', refresh);
}

window.addEventListener('popstate', () => {
  if (!['', '#kalender'].includes(location.hash) || document.getElementById('dialog')?.open) return;
  if (view.mode === 'month') return;
  view.mode = 'month';
  view.pickMonth = false;
  window.dispatchEvent(new HashChangeEvent('hashchange')); // Ansicht neu zeichnen
});

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

// Schriftfarbe passend zur Themenfarbe: auf hellen Farben dunkle Schrift, auf dunklen helle.
function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? '#2b1a21' : '#ffffff';
}

function legend() {
  return store.topics().map((t) => el('span', {}, el('span.dot', { style: { background: t.color } }), t.name));
}

function dayGrid(from, count, allEvents, refresh) {
  const days = [...Array(count)].map((_, i) => addDays(from, i));
  // Ganztägige Termine stehen in einer eigenen Zeile über den Stunden.
  const events = allEvents.filter((ev) => !ev.all_day);
  const allDay = days.map((day) => {
    const key = isoDate(day);
    return allEvents.filter((ev) => ev.all_day && ev.start_at.slice(0, 10) <= key && ev.end_at.slice(0, 10) >= key);
  });
  const today = isoDate(new Date());
  const columns = `2.6rem repeat(${count}, minmax(0, 1fr))`;

  const hours = el('div.hours', {}, [...Array(24)].map((_, h) =>
    el('div.hour', { style: { height: `${HOUR_PX}px` } }, `${String(h).padStart(2, '0')}`)));

  const cols = days.map((day) => {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    const col = el(`div.day-col${isoDate(day) === today ? '.today' : ''}`, {
      dataset: { day: isoDate(day) },
      style: { height: `${24 * HOUR_PX}px` },
      onclick: (e) => {
        if (e.target !== col) return;
        const start = new Date(dayStart);
        start.setHours(Math.floor(e.offsetY / HOUR_PX));
        openEventEditor({ start_at: isoDateTime(start), end_at: isoDateTime(new Date(+start + 3600000)) }, refresh);
      },
    });

    const blocks = events.flatMap((ev) => segments(ev).map((seg) => ({ ev, seg })))
      .filter(({ seg }) => seg.end > dayStart && seg.start < dayEnd)
      .filter(({ ev, seg }) => isoDate(day) <= lastDay(parseDate(ev.start_at), seg.end));
    layoutLanes(blocks);

    for (const { ev, seg, lane, lanes } of blocks) {
      const s = Math.max(seg.start, dayStart);
      const e = Math.min(seg.end, dayEnd);
      const top = ((s - dayStart) / 3600000) * HOUR_PX;
      const height = Math.max(16, ((e - s) / 3600000) * HOUR_PX - 2);
      const block = el(`button.block.${seg.part}${ev.is_event ? '.is-event' : ''}${height < 30 ? '.short' : ''}`, {
        type: 'button',
        style: {
          top: `${top}px`,
          height: `${height}px`,
          left: `${(lane / lanes) * 100}%`,
          width: `calc(${100 / lanes}% - 3px)`,
          '--c': store.topicColor(ev.topic_id),
          '--on': textOn(store.topicColor(ev.topic_id)),
        },
        title: `${formatTime(seg.start)}–${formatTime(seg.end)} ${seg.label}`,
        onclick: () => { if (!justDragged()) openEventEditor(ev, refresh); },
      },
      // Kurze Blöcke in schmalen Spalten: lieber den Titel als die Uhrzeit zeigen.
      height < 30 && count > 3 ? null : el('span.block-time', {}, formatTime(seg.start)),
      el('span.block-title', {}, seg.label));
      block._drag = { ev, seg };
      col.append(block);
    }
    if (isoDate(day) === today) col.append(nowLine());
    return col;
  });

  return el('div.week', {},
    el('div.week-head', { style: { gridTemplateColumns: columns } },
      el('div'),
      days.map((d) => el(`div.day-head${isoDate(d) === today ? '.today' : ''}`, {},
        el('span', {}, formatDate(d, { weekday: 'short' }).replace('.', '')),
        el('strong', {}, formatDate(d, count === 7 ? { day: 'numeric' } : { day: '2-digit', month: '2-digit' }))))),
    allDay.some((list) => list.length) ? el('div.allday-row', { style: { gridTemplateColumns: columns } },
      el('span.allday-label', {}, 'ganzt.'),
      allDay.map((list) => el('div.allday-cell', {}, list.map((ev) => el(`button.chip${ev.is_event ? '.is-event' : ''}`, {
        type: 'button',
        style: { '--c': store.topicColor(ev.topic_id), '--on': textOn(store.topicColor(ev.topic_id)) },
        title: `ganztägig: ${ev.title}`,
        onclick: () => openEventEditor(ev, refresh),
      }, eventTitle(ev)))))) : null,
    el('div.week-scroll', {}, el('div.week-body', { style: { gridTemplateColumns: columns } }, hours, cols)));
}

// Letzter Kalendertag eines Termins: Was nach Mitternacht vor 4:30 endet, gehört noch zum Vortag
// (die App-Tage beginnen um 4:30) und erscheint nicht zusätzlich am Folgetag.
const DAY_START_MS = (4 * 60 + 30) * 60000;
function lastDay(start, end) {
  const last = isoDate(new Date(+end - DAY_START_MS - 1));
  return last < isoDate(start) ? isoDate(start) : last;
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
    const dayEvents = events.filter((ev) => ev.start_at.slice(0, 10) <= key
      && lastDay(parseDate(ev.start_at), parseDate(ev.end_at)) >= key);
    cells.push(el(`div.month-cell${day.getMonth() !== month ? '.other' : ''}${key === today ? '.today' : ''}`, {
      onclick: (e) => {
        if (e.target.closest('.chip')) return;
        openDay(day, refresh);
      },
    },
    el('span.month-day', {}, String(day.getDate())),
    dayEvents.map((ev) => el(`button.chip${ev.is_event ? '.is-event' : ''}`, {
      type: 'button',
      style: { '--c': store.topicColor(ev.topic_id), '--on': textOn(store.topicColor(ev.topic_id)) },
      title: `${ev.all_day ? 'ganztägig' : formatTime(parseDate(ev.start_at))} ${ev.title}`,
      onclick: () => openEventEditor(ev, refresh),
    }, eventTitle(ev)))));
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

  const routineButtons = ['main', 'before', 'after']
    .map((side) => (side === 'main' ? ev.routine_id : ev[`${side}_type`] === 'routine' && ev[`${side}_routine_id`]))
    .filter((id) => id && store.taskById(id))
    .map((id) => {
      const r = store.taskById(id);
      return el('button', { type: 'button', onclick: () => runRoutine(r, () => {}) }, `▶ ${r.title}`);
    });

  // Termin oder Routine einplanen. Bei einer Routine kommen Titel, Thema und Dauer von der Routine.
  const routineList = store.routines();
  const titleInput = el('input', { name: 'title', maxlength: 200, value: ev.routine_id ? '' : ev.title || '' });
  const titleField = field('Titel', titleInput);
  const routineSelect = select('routine_id', [['', '— Routine wählen —'], ...routineList.map((r) => [r.id, r.title])], ev.routine_id);
  const routineField = field('Routine', routineSelect, routineList.length ? null : 'Lege zuerst unter „Routinen“ eine an.');
  const topics = topicPicker(ev.topic_id);
  const typeSwitch = el('div.segmented.radio', { role: 'group', 'aria-label': 'Art' },
    [['event', 'Termin'], ['routine', 'Routine']].map(([v, label]) => el('label', {},
      el('input', { type: 'radio', name: 'entry_type', value: v, checked: (v === 'routine') === Boolean(ev.routine_id), onchange: showType }),
      label)));
  function showType() {
    const isRoutine = typeSwitch.querySelector('input:checked').value === 'routine';
    titleField.hidden = isRoutine;
    titleInput.required = !isRoutine;
    routineField.hidden = !isRoutine;
    routineSelect.required = isRoutine;
    allDayLabel.hidden = isRoutine; // eine Routine braucht eine Uhrzeit
    if (isRoutine && allDayInput.checked) { allDayInput.checked = false; showAllDay(); }
  }

  // Ganztägig: nur Datum (ohne Uhrzeit), keine Bereiche davor/danach.
  const allDayInput = el('input', { type: 'checkbox', name: 'all_day', checked: Boolean(ev.all_day), onchange: () => showAllDay(true) });
  const allDayLabel = el('label.check', {}, allDayInput, 'Ganztägig');
  const sides = [sideFields('before', ev), sideFields('after', ev)];
  function showAllDay(changed = false) {
    const on = allDayInput.checked;
    startField.setDateOnly(on);
    endField.setDateOnly(on);
    for (const side of sides) side.hidden = on;
    // Von ganztägig zurück auf eine Uhrzeit: 9–10 Uhr am ersten Tag vorschlagen.
    const start = parseDate(startInput.value);
    if (changed && !on && start.getHours() === 0 && start.getMinutes() === 0) {
      start.setHours(9);
      startField.set(start, false);
      endField.set(new Date(+start + 3600000));
    }
  }
  routineSelect.addEventListener('change', () => {
    const r = store.taskById(routineSelect.value);
    if (!r) return;
    const topicSelect = topics.querySelector('select[name="topic_id"]');
    if (r.topic_id) topicSelect.value = String(r.topic_id);
    // Standardstartzeit der Routine am gewählten Tag übernehmen, Ende aus ihrer Dauer.
    if (r.default_time) startField.set(routineStart(r, parseDate(startInput.value)), false);
    const minutes = store.routineMinutes(r);
    if (minutes) endField.set(new Date(+parseDate(startInput.value) + minutes * 60000));
  });

  const form = el('form.form-grid', { onsubmit: (e) => { e.preventDefault(); save(); } },
    typeSwitch,
    titleField,
    routineField,
    topics,
    el('label.check', {}, el('input', { type: 'checkbox', name: 'is_event', checked: Boolean(ev.is_event) }),
      'Veranstaltung (lässt sich im Kalender ausblenden)'),
    allDayLabel,
    el('div.field', {}, el('span.field-label', {}, 'Beginn'), startField.element),
    el('div.field', {}, el('span.field-label', {}, 'Ende'), endField.element),
    repeat.element,
    sides,
    field('Notizen', el('textarea', { name: 'notes', rows: 3 }, ev.notes || '')),
    el('div.buttons.sticky', {},
      el('button.primary', { type: 'submit' }, isNew ? 'Anlegen' : 'Speichern'),
      routineButtons,
      isNew ? null : el('button.danger', { type: 'button', onclick: remove }, 'Löschen')));

  showType();
  showAllDay();

  function save() {
    const payload = { ...formData(form), repeat: repeat.value() };
    if (payload.entry_type !== 'routine') payload.routine_id = '';
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
  const close = openDialog(isNew ? (ev.routine_id ? 'Routine einplanen' : 'Neuer Termin') : `Termin${topic ? ` · ${topic.name}` : ''}`, form);
}
