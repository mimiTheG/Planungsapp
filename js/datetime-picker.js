// Datum & Uhrzeit mit Monatskalender statt der Drehräder von Android: Tag im Kalender antippen, Uhrzeit darunter.
// Der Wert steckt in einem versteckten Feld (name, "JJJJ-MM-TTTHH:MM"); Änderungen lösen dort ein 'change' aus,
// damit das Formular wie mit einem normalen Eingabefeld funktioniert.

import { el, mount } from './ui.js';
import {
  addDays, formatDate, isoDate, isoDateTime, parseDate, startOfWeek,
} from './dates.js';
import * as store from './store.js';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Alle offenen Kalender eines Formulars – es soll immer nur einer offen sein.
const openPanels = new Set();

export function dateTimeField(name, value, { required = false } = {}) {
  const input = el('input', { type: 'hidden', name, value: isoDateTime(parseDate(value)), required });
  let month = startOfMonth(parseDate(value));

  const display = el('button.dt-display', { type: 'button', 'aria-expanded': 'false', onclick: () => toggle() });
  const panel = el('div.dt-panel', { hidden: true });

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function current() {
    return parseDate(input.value);
  }

  function updateDisplay() {
    const d = current();
    mount(display,
      el('span.dt-date', {}, formatDate(d, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })),
      el('span.dt-time', {}, `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`));
  }

  // Setzt den Wert; mit notify wird 'change' ausgelöst (für abhängige Felder wie das Ende).
  function set(next, notify = true) {
    input.value = isoDateTime(next);
    updateDisplay();
    if (!panel.hidden) renderPanel();
    if (notify) input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function toggle(open = panel.hidden) {
    for (const other of openPanels) if (other !== close && open) other();
    panel.hidden = !open;
    display.setAttribute('aria-expanded', String(open));
    if (open) {
      month = startOfMonth(current());
      renderPanel();
      openPanels.add(close);
    } else {
      openPanels.delete(close);
    }
  }
  function close() { toggle(false); }

  function renderPanel() {
    const selected = current();
    const today = isoDate(new Date());
    const first = startOfWeek(month);
    const last = addDays(startOfWeek(new Date(month.getFullYear(), month.getMonth() + 1, 0)), 6);
    // Tage mit Terminen bekommen einen Punkt – so sieht man direkt, wo schon etwas ansteht.
    const busy = new Set(store.eventsBetween(first, last).map((e) => e.start_at.slice(0, 10)));

    const days = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const day = new Date(d);
      const key = isoDate(day);
      days.push(el(`button.dt-day${day.getMonth() !== month.getMonth() ? '.other' : ''}${key === today ? '.today' : ''}${key === isoDate(selected) ? '.selected' : ''}`, {
        type: 'button',
        'aria-label': formatDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        onclick: () => {
          const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), selected.getHours(), selected.getMinutes());
          if (day.getMonth() !== month.getMonth()) month = startOfMonth(day);
          set(next);
        },
      }, String(day.getDate()), busy.has(key) ? el('span.dt-busy') : null));
    }

    // Uhrzeit ebenfalls im App-Design (statt der Android-Uhr): Stunde und Minute antippen.
    const setTime = (h, m) => {
      const d = current();
      set(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m));
    };
    const pad = (n) => String(n).padStart(2, '0');
    const hours = el('div.dt-times.hours', { role: 'group', 'aria-label': 'Stunde' },
      [...Array(24)].map((_, h) => el(`button${h === selected.getHours() ? '.selected' : ''}`, {
        type: 'button',
        onclick: () => setTime(h, selected.getMinutes()),
      }, pad(h))));
    const minuteSteps = [...Array(12)].map((_, i) => i * 5);
    if (!minuteSteps.includes(selected.getMinutes())) minuteSteps.push(selected.getMinutes());
    const minutes = el('div.dt-times.minutes', { role: 'group', 'aria-label': 'Minute' },
      minuteSteps.sort((a, b) => a - b).map((m) => el(`button${m === selected.getMinutes() ? '.selected' : ''}`, {
        type: 'button',
        onclick: () => setTime(selected.getHours(), m),
      }, `:${pad(m)}`)));

    mount(panel,
      el('div.dt-head', {},
        el('button.icon', { type: 'button', 'aria-label': 'Voriger Monat', onclick: () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); renderPanel(); } }, '‹'),
        el('strong', {}, month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
        el('button.icon', { type: 'button', 'aria-label': 'Nächster Monat', onclick: () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); renderPanel(); } }, '›')),
      el('div.dt-grid', {}, WEEKDAYS.map((w) => el('span.dt-weekday', {}, w)), days),
      el('div.dt-time-head', {}, el('span', {}, 'Uhrzeit'),
        el('strong', {}, `${pad(selected.getHours())}:${pad(selected.getMinutes())}`)),
      el('small.muted', {}, 'Stunde'),
      hours,
      el('small.muted', {}, 'Minute'),
      minutes,
      el('button.primary', { type: 'button', onclick: close }, 'Fertig'));
  }

  updateDisplay();
  return {
    element: el('div.dt-field', {}, input, display, panel),
    input,
    set,
  };
}
