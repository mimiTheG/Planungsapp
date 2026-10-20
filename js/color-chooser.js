// Farbauswahl für Themen: abgestimmte Farbpalette zum Antippen plus "Eigene Farbe" (Farbwähler des Geräts).
// Ändert nur sich selbst – die Seite wird dabei nicht neu aufgebaut, damit offene Farbwähler nicht zurückspringen.

import { el } from './ui.js';

// Gedeckte, augenfreundliche Töne, die zu Rosa/Weinrot passen und sich trotzdem gut unterscheiden.
export const TOPIC_PALETTE = [
  ['#9b2948', 'Weinrot'],
  ['#c8466d', 'Himbeere'],
  ['#d98ca0', 'Altrosa'],
  ['#e2725b', 'Koralle'],
  ['#e9a66b', 'Pfirsich'],
  ['#c9a227', 'Senf'],
  ['#7fa58a', 'Salbei'],
  ['#4f8a7b', 'Eukalyptus'],
  ['#2f6f7e', 'Petrol'],
  ['#6b8fb8', 'Taubenblau'],
  ['#9c8ad0', 'Lavendel'],
  ['#7b4a7a', 'Pflaume'],
];

// Gibt { element, value() } zurück. onChange(color) wird bei jeder Auswahl aufgerufen.
export function colorChooser(initial, onChange = () => {}, { open = false } = {}) {
  let color = initial;
  const preview = el('button.color-preview', {
    type: 'button',
    'aria-label': 'Farbe wählen',
    style: { background: color },
    onclick: () => { panel.hidden = !panel.hidden; },
  });
  const custom = el('input', {
    type: 'color',
    value: color,
    'aria-label': 'Eigene Farbe',
    onchange: () => pick(custom.value),
  });
  const swatches = TOPIC_PALETTE.map(([value, name]) => el('button.swatch', {
    type: 'button',
    title: name,
    'aria-label': name,
    dataset: { color: value },
    style: { background: value },
    onclick: () => pick(value),
  }));
  const panel = el('div.color-panel', { hidden: !open },
    el('div.swatches', {}, swatches),
    el('label.custom-color', {}, custom, el('span', {}, 'Eigene Farbe')));

  function pick(value) {
    color = value;
    preview.style.background = value;
    if (custom.value !== value) custom.value = value;
    for (const s of swatches) s.classList.toggle('selected', s.dataset.color === value);
    onChange(value);
  }
  for (const s of swatches) s.classList.toggle('selected', s.dataset.color === color);

  return { element: el('div.color-chooser', {}, preview, panel), value: () => color };
}
