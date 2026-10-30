// Datum & Uhrzeit getrennt: Antippen des Datums öffnet einen Monatskalender (statt der Drehräder von Android),
// Antippen der Uhrzeit direkt die Uhrzeit-Auswahl des Handys.
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

  const dateButton = el('button.dt-date', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Datum', onclick: () => toggle() });
  const timeInput = el('input.dt-time', {
    type: 'time',
    'aria-label': 'Uhrzeit',
    onchange: () => {
      if (!timeInput.value) return updateDisplay(); // geleert → alte Uhrzeit bleibt
      const [h, m] = timeInput.value.split(':').map(Number);
      const d = current();
      set(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m));
    },
  });
  const display = el('div.dt-display', {}, dateButton, timeInput);
  const panel = el('div.dt-panel', { hidden: true });
  let dateOnly = false; // ganztägig: nur das Datum wählen

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function current() {
    return parseDate(input.value);
  }

  function updateDisplay() {
    const d = current();
    dateButton.textContent = formatDate(d, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    timeInput.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    timeInput.hidden = dateOnly;
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
    dateButton.setAttribute('aria-expanded', String(open));
    if (open) {
      month = startOfMonth(current());
      renderPanel();
      openPanels.add(close);
      // Ganzen Kalender samt Uhrzeit sichtbar machen (nicht unter dem "Anlegen"-Balken).
      requestAnimationFrame(() => {
        const scroller = panel.closest('.dialog-body');
        if (!scroller) return;
        const overflow = panel.getBoundingClientRect().bottom + 88 - scroller.getBoundingClientRect().bottom;
        if (overflow > 0) scroller.scrollBy({ top: overflow, behavior: 'smooth' });
      });
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
          set(next);
          close(); // Tag gewählt → fertig
        },
      }, String(day.getDate()), busy.has(key) ? el('span.dt-busy') : null));
    }

    mount(panel,
      el('div.dt-head', {},
        el('button.icon', { type: 'button', 'aria-label': 'Voriger Monat', onclick: () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); renderPanel(); } }, '‹'),
        el('strong', {}, month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
        el('button.icon', { type: 'button', 'aria-label': 'Nächster Monat', onclick: () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); renderPanel(); } }, '›')),
      el('div.dt-grid', {}, WEEKDAYS.map((w) => el('span.dt-weekday', {}, w)), days),
      el('div.dt-foot', {},
        el('button', {
          type: 'button',
          onclick: () => {
            const d = current();
            const now = new Date();
            set(new Date(now.getFullYear(), now.getMonth(), now.getDate(), d.getHours(), d.getMinutes()));
            close();
          },
        }, 'Heute'),
        el('span.spacer'),
        el('button', { type: 'button', onclick: close }, 'Schließen')));
  }

  updateDisplay();
  return {
    element: el('div.dt-field', {}, input, display, panel),
    input,
    set,
    setDateOnly(on) {
      dateOnly = on;
      updateDisplay();
      if (!panel.hidden) renderPanel();
    },
  };
}
