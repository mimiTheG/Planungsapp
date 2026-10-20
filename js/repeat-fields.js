// Formularteil "Wiederholen" für Termine – Vorschläge und "Benutzerdefiniert" wie bei Google Kalender.

import { el, field, mount, openDialog } from './ui.js';
import { isoDate, parseDate } from './dates.js';
import {
  ORDINALS, WEEKDAYS, WEEKDAYS_SHORT, isLastWeekdayOfMonth, normalize, presetKey, presets, repeatText,
} from './repeat.js';

const UNIT_OPTIONS = [['daily', 'Tag(e)'], ['weekly', 'Woche(n)'], ['monthly', 'Monat(e)'], ['yearly', 'Jahr(e)']];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo … So

// Gibt { element, value() } zurück; value() liefert das repeat-Objekt oder null.
export function repeatFields(initial, startInput) {
  const startAt = () => (startInput.value || isoDate(new Date())).replace('T', ' ');
  let custom = initial ? normalize(initial) : null;
  let selected = presetKey(initial, startAt());

  const repeatSelect = el('select', { 'aria-label': 'Wiederholen' });
  const customBox = el('div.repeat-custom');

  function renderOptions() {
    const options = presets(startAt()).map((p) => [p.key, p.label]);
    if (custom && selected === 'custom') options.push(['custom', repeatText(custom, startAt())]);
    options.push(['edit-custom', 'Benutzerdefiniert …']);
    repeatSelect.replaceChildren(...options.map(([value, label]) =>
      el('option', { value, selected: value === selected }, label)));
  }

  // --- Benutzerdefiniert ---
  function renderCustom() {
    if (selected !== 'custom') {
      customBox.hidden = true;
      return;
    }
    customBox.hidden = false;
    const start = parseDate(startAt());
    const c = custom;

    const interval = el('input', {
      type: 'number', min: 1, max: 999, inputmode: 'numeric', value: c.interval, 'aria-label': 'Intervall',
      onchange: () => { c.interval = Math.max(1, Number(interval.value) || 1); renderOptions(); },
    });
    const unit = el('select', {
      'aria-label': 'Einheit',
      onchange: () => {
        c.freq = unit.value;
        c.weekdays = c.freq === 'weekly' ? [start.getDay()] : null;
        c.monthly = c.freq === 'monthly' ? 'day' : null;
        renderCustom();
        renderOptions();
      },
    }, UNIT_OPTIONS.map(([v, label]) => el('option', { value: v, selected: v === c.freq }, label)));

    const weekdays = c.freq === 'weekly' ? el('div.weekday-picker', { role: 'group', 'aria-label': 'Wochentage' },
      WEEK_ORDER.map((d) => el(`button${c.weekdays?.includes(d) ? '.active' : ''}`, {
        type: 'button',
        'aria-pressed': String(Boolean(c.weekdays?.includes(d))),
        title: WEEKDAYS[d],
        onclick: () => {
          const set = new Set(c.weekdays || []);
          if (set.has(d) && set.size > 1) set.delete(d); else set.add(d);
          c.weekdays = [...set].sort();
          renderCustom();
          renderOptions();
        },
      }, WEEKDAYS_SHORT[d]))) : null;

    const nth = isLastWeekdayOfMonth(start) && Math.ceil(start.getDate() / 7) >= 4 ? -1 : Math.ceil(start.getDate() / 7);
    const monthly = c.freq === 'monthly' ? el('select', {
      'aria-label': 'Monatlich am',
      onchange: (e) => {
        c.monthly = e.target.value === 'day' ? 'day' : 'weekday';
        c.nth = c.monthly === 'weekday' ? Number(e.target.value) : null;
        renderOptions();
      },
    },
    el('option', { value: 'day', selected: c.monthly !== 'weekday' }, `Monatlich am ${start.getDate()}.`),
    el('option', { value: String(nth), selected: c.monthly === 'weekday' },
      `Monatlich am ${ORDINALS[nth]} ${WEEKDAYS[start.getDay()]}`)) : null;

    const endKind = c.until ? 'until' : c.count ? 'count' : 'never';
    const untilInput = el('input', {
      type: 'date', value: c.until || isoDate(new Date(start.getFullYear(), start.getMonth() + 3, start.getDate())),
      'aria-label': 'Endet am',
      onchange: () => { if (endKind === 'until') { c.until = untilInput.value || null; renderOptions(); } },
    });
    const countInput = el('input', {
      type: 'number', min: 1, max: 999, inputmode: 'numeric', value: c.count || 10, 'aria-label': 'Anzahl Termine',
      onchange: () => { if (endKind === 'count') { c.count = Math.max(1, Number(countInput.value) || 1); renderOptions(); } },
    });
    const endRadio = (kind, label, input) => el('label.end-option', {},
      el('input', {
        type: 'radio',
        name: 'repeat_end_choice',
        checked: endKind === kind,
        onchange: () => {
          c.until = kind === 'until' ? untilInput.value : null;
          c.count = kind === 'count' ? Math.max(1, Number(countInput.value) || 1) : null;
          renderCustom();
          renderOptions();
        },
      }),
      el('span', {}, label),
      input);

    mount(customBox,
      el('div.repeat-every', {}, el('span', {}, 'Alle'), interval, unit),
      weekdays,
      monthly,
      el('fieldset.repeat-end', {},
        el('legend', {}, 'Endet'),
        endRadio('never', 'Nie'),
        endRadio('until', 'Am', untilInput),
        endRadio('count', 'Nach', el('span.inline', {}, countInput, el('span', {}, 'Terminen')))));
  }

  repeatSelect.addEventListener('change', () => {
    if (repeatSelect.value === 'edit-custom') {
      const start = parseDate(startAt());
      const base = presets(startAt()).find((p) => p.key === selected)?.repeat || custom
        || { freq: 'weekly', interval: 1, weekdays: [start.getDay()] };
      custom = normalize(base);
      selected = 'custom';
    } else {
      selected = repeatSelect.value;
    }
    renderOptions();
    renderCustom();
  });
  // Beim Ändern des Datums passen sich die Vorschläge an (z. B. "Wöchentlich am Freitag").
  startInput.addEventListener('change', () => { renderOptions(); renderCustom(); });

  renderOptions();
  renderCustom();

  return {
    element: el('div.repeat-fields', {}, field('Wiederholen', repeatSelect), customBox),
    value() {
      if (selected === 'custom') return custom;
      return presets(startAt()).find((p) => p.key === selected)?.repeat || null;
    },
  };
}

// Fragt bei wiederkehrenden Terminen nach dem Umfang. Ruft onChoose('this' | 'following' | 'all') auf.
export function askScope(title, onChoose) {
  let choice = 'this';
  const options = [['this', 'Dieser Termin'], ['following', 'Dieser und alle folgenden Termine'], ['all', 'Alle Termine']];
  const close = openDialog(title,
    el('div.form-grid', {},
      el('div.scope-options', {}, options.map(([value, label]) => el('label.check', {},
        el('input', { type: 'radio', name: 'scope', value, checked: value === choice, onchange: () => { choice = value; } }),
        label))),
      el('div.buttons', {},
        el('button.primary', { type: 'button', onclick: () => { close(); onChoose(choice); } }, 'OK'),
        el('button', { type: 'button', onclick: () => close() }, 'Abbrechen'))));
}
