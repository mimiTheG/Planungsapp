// Aufgabe oder Routine einplanen: Monatskalender mit allen Terminen → Tag antippen → im Tagesplan eine Zeit
// zwischen den vorhandenen Terminen wählen (freie Zeiten als Knöpfe oder in die Zeitleiste tippen) → „Einplanen“.

import { el, mount, openDialog, attempt } from './ui.js';
import { addDays, formatDate, formatTime, isoDate, isoDateTime, parseDate, startOfDay, startOfWeek } from './dates.js';
import * as store from './store.js';
import { DAY_FROM, DAY_TO, freeSlots, overlaps } from './free-slots.js';

const HOUR_PX = 40;
const SUGGEST_FROM = 8 * 60; // Vorschläge nicht vor 8:00 (wählen lässt sich ab 6:00)
const SNAP = 15;
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const eventsOn = (events, day) => {
  const key = isoDate(day);
  return events.filter((e) => e.start_at.slice(0, 10) <= key && e.end_at.slice(0, 10) >= key && !(e.end_at.slice(11) === '00:00' && e.end_at.slice(0, 10) === key && e.start_at.slice(0, 10) < key));
};

// options: { title, minutes, preferredTime ('HH:MM'), onPlan(start, minutes), onMore(start, minutes) }
export function openPlanPicker({ title, minutes = 60, preferredTime = null, onPlan, onMore }) {
  const today = startOfDay(new Date());
  const state = { month: new Date(today.getFullYear(), today.getMonth(), 1), day: today, start: null, minutes };
  const body = el('div.plan-picker');

  const monthEvents = () => {
    const first = startOfWeek(state.month);
    return store.eventsBetween(first, addDays(first, 42));
  };

  // Vorschlag für den gewählten Tag: bevorzugte Uhrzeit (Routine), sonst die erste freie Zeit.
  function suggest(events) {
    const slots = freeSlots(eventsOn(events, state.day), state.day, state.minutes);
    if (preferredTime) {
      const [h, m] = preferredTime.split(':').map(Number);
      const wanted = new Date(state.day.getFullYear(), state.day.getMonth(), state.day.getDate(), h, m);
      if (slots.some((s) => wanted >= s.start && +wanted + state.minutes * 60000 <= +s.end)) return wanted;
    }
    // Erste freie Zeit ab 8:00 (liegt eine Lücke über 8:00, dann um 8:00), sonst die erste überhaupt.
    const day8 = new Date(+startOfDay(state.day) + SUGGEST_FROM * 60000);
    const late = slots.find((sl) => +sl.end - Math.max(+sl.start, +day8) >= state.minutes * 60000);
    if (late) return new Date(Math.max(+late.start, +day8));
    return slots[0]?.start || null;
  }

  function chooseDay(day, events) {
    state.day = day;
    state.start = suggest(events);
    render(true);
  }

  // Neu zeichnen. Verliert das Dauer-Feld beim Neuzeichnen den Fokus, meldet es „change“ mitten im Zeichnen –
  // dann erst danach noch einmal zeichnen.
  let drawing = false;
  let again = false;
  function render(scrollToStart = false) {
    if (drawing) {
      again = true;
      return;
    }
    drawing = true;
    try {
      draw(scrollToStart);
    } finally {
      drawing = false;
    }
    if (again) {
      again = false;
      render();
    }
  }

  function draw(scrollToStart) {
    const events = monthEvents();
    const dayEvents = eventsOn(events, state.day);
    const slots = freeSlots(dayEvents, state.day, state.minutes);
    const end = state.start ? new Date(+state.start + state.minutes * 60000) : null;

    // Monat
    const first = startOfWeek(state.month);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = addDays(first, i);
      if (i >= 35 && day.getMonth() !== state.month.getMonth()) break;
      const count = eventsOn(events, day).length;
      const past = day < today;
      cells.push(el(`button.pp-day${day.getMonth() !== state.month.getMonth() ? '.other' : ''}${past ? '.past' : ''}${+day === +today ? '.today' : ''}${+day === +state.day ? '.selected' : ''}`, {
        type: 'button',
        disabled: past,
        dataset: { day: isoDate(day) },
        'aria-label': `${formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} Termine`,
        onclick: () => chooseDay(day, events),
      }, el('span.pp-num', {}, String(day.getDate())),
      count ? el('span.pp-count', {}, count > 3 ? `${count}` : '•'.repeat(count)) : null));
    }

    // Zeitleiste des Tages (DAY_FROM bis DAY_TO)
    const hours = [];
    for (let m = DAY_FROM; m < DAY_TO; m += 60) hours.push(el('div.pp-hour', { style: { height: `${HOUR_PX}px` } }, `${String(m / 60).padStart(2, '0')}`));
    const dayStart = startOfDay(state.day);
    const top = (date) => ((date - dayStart) / 60000 - DAY_FROM) * (HOUR_PX / 60);
    const lane = el('div.pp-lane', {
      style: { height: `${((DAY_TO - DAY_FROM) / 60) * HOUR_PX}px` },
      onclick: (e) => {
        if (e.target !== lane && !e.target.classList.contains('pp-free')) return;
        const minutesOfDay = DAY_FROM + Math.floor((e.offsetY + (e.target === lane ? 0 : e.target.offsetTop)) / (HOUR_PX / 60) / SNAP) * SNAP;
        const start = new Date(+dayStart + Math.min(minutesOfDay, DAY_TO - state.minutes) * 60000);
        if (start < new Date()) return;
        state.start = start;
        render();
      },
    },
    slots.map((s) => el('div.pp-free', { style: { top: `${top(s.start)}px`, height: `${top(s.end) - top(s.start)}px` } })),
    dayEvents.filter((e) => !e.all_day).map((e) => {
      const s = new Date(Math.max(parseDate(e.start_at), +dayStart + DAY_FROM * 60000));
      const f = new Date(Math.min(parseDate(e.end_at), +dayStart + DAY_TO * 60000));
      if (f <= s) return null;
      return el('div.pp-busy', {
        style: { top: `${top(s)}px`, height: `${Math.max(14, top(f) - top(s) - 1)}px`, '--c': store.topicColor(e.topic_id) },
        title: `${e.start_at.slice(11)}–${e.end_at.slice(11)} ${e.title}`,
      }, `${e.start_at.slice(11)} ${e.title}`);
    }),
    state.start ? el(`div.pp-pick${overlaps(dayEvents, state.start, state.minutes) ? '.clash' : ''}`, {
      style: { top: `${top(state.start)}px`, height: `${Math.max(14, top(end) - top(state.start) - 1)}px` },
    }, `${formatTime(state.start)}–${formatTime(end)} ${title}`) : null);

    const allDay = dayEvents.filter((e) => e.all_day);
    const clash = state.start && overlaps(dayEvents, state.start, state.minutes);

    mount(body,
      el('div.pp-duration', {},
        el('label', { for: 'pp-minutes' }, 'Dauer'),
        el('input', {
          id: 'pp-minutes',
          type: 'number', min: 5, max: 720, step: 5, inputmode: 'numeric', value: state.minutes,
          onchange: (e) => {
            state.minutes = Math.max(5, Math.min(720, Number(e.target.value) || 60));
            if (state.start && overlaps(dayEvents, state.start, state.minutes)) state.start = suggest(events);
            render();
          },
        }),
        el('span.muted', {}, 'Minuten')),
      el('div.pp-month-head', {},
        el('button.icon', { type: 'button', 'aria-label': 'Voriger Monat', onclick: () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); render(); } }, '‹'),
        el('strong', {}, state.month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
        el('button.icon', { type: 'button', 'aria-label': 'Nächster Monat', onclick: () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); render(); } }, '›')),
      el('div.pp-month', {}, WEEKDAYS.map((d) => el('span.pp-wd', {}, d)), cells),
      el('h3.pp-day-title', {}, formatDate(state.day, { weekday: 'long', day: 'numeric', month: 'long' })),
      allDay.length ? el('p.muted.pp-allday', {}, `Ganztägig: ${allDay.map((e) => e.title).join(', ')}`) : null,
      el('div.pp-free-buttons', {},
        slots.length
          ? [el('span.muted', {}, 'Frei:'), slots.map((s) => el(`button.chip-button${state.start && +state.start === +s.start ? '.active' : ''}`, {
            type: 'button',
            title: `frei bis ${formatTime(s.end)}`,
            onclick: () => { state.start = s.start; render(true); },
          }, `${formatTime(s.start)}–${formatTime(s.end)}`))]
          : el('span.muted', {}, `An diesem Tag ist keine Lücke von ${state.minutes} Minuten frei – trotzdem in die Zeitleiste tippen geht.`)),
      el('p.muted.small', {}, 'Tipp: in eine freie (helle) Stelle der Zeitleiste tippen, um die Uhrzeit genau zu wählen.'),
      el('div.pp-timeline', {}, el('div.pp-hours', {}, hours), lane),
      clash ? el('p.pp-warning', {}, '⚠ Überschneidet sich mit einem Termin.') : null,
      el('div.buttons.sticky', {},
        el('p.pp-chosen', {}, state.start
          ? `${formatDate(state.start, { weekday: 'short', day: '2-digit', month: '2-digit' })}, ${formatTime(state.start)}–${formatTime(end)}`
          : 'Noch keine Zeit gewählt'),
        el('button.primary', {
          type: 'button',
          disabled: !state.start,
          onclick: () => { if (attempt(() => onPlan(state.start, state.minutes))) close(); },
        }, '📅 Einplanen'),
        onMore ? el('button', {
          type: 'button',
          onclick: () => { close(); onMore(state.start || new Date(+dayStart + 9 * 3600000), state.minutes); },
        }, 'Mehr Optionen …') : null));

    if (scrollToStart) {
      const scroller = body.querySelector('.pp-timeline');
      const target = state.start ? top(state.start) - HOUR_PX : 0;
      requestAnimationFrame(() => { scroller.scrollTop = Math.max(0, target); });
    }
  }

  state.start = suggest(monthEvents());
  const close = openDialog(`„${title}“ einplanen`, body);
  render(true);
  return close;
}

// Für „Mehr Optionen …“ und Tests: Start/Ende als Eingabewerte.
export const asInputs = (start, minutes) => ({
  start_at: isoDateTime(start),
  end_at: isoDateTime(new Date(+start + minutes * 60000)),
});
