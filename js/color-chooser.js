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

// Nur eine Farbauswahl gleichzeitig offen: Öffnen einer neuen schließt die vorherige.
let closeOpen = null;

// Farbumrechnung für die eigene Farbmischung (Farbton, Sättigung, Helligkeit).
function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Gibt { element, value() } zurück. onChange(color) wird bei jeder Auswahl aufgerufen.
export function colorChooser(initial, onChange = () => {}, { open = false } = {}) {
  let color = initial;
  const preview = el('button.color-preview', {
    type: 'button',
    'aria-label': 'Farbe ändern',
    style: { background: color },
    onclick: () => setOpen(panel.hidden),
  });

  // Eigene Farbe: direkt in der App mischen (statt des Farbdialogs des Handys).
  const sliders = {};
  const mixer = el('div.color-mixer', { hidden: true },
    ['h', 's', 'l'].map((key) => {
      const [label, max] = { h: ['Farbton', 360], s: ['Sättigung', 100], l: ['Helligkeit', 100] }[key];
      sliders[key] = el('input', {
        type: 'range', min: 0, max, 'aria-label': label,
        oninput: () => pick(hslToHex(+sliders.h.value, +sliders.s.value, +sliders.l.value), false),
      });
      return el('label.mixer-row', {}, el('span', {}, label), sliders[key]);
    }));
  const customButton = el('button.custom-color', {
    type: 'button',
    'aria-expanded': 'false',
    onclick: () => {
      mixer.hidden = !mixer.hidden;
      customButton.setAttribute('aria-expanded', String(!mixer.hidden));
      if (!mixer.hidden) syncSliders();
    },
  }, el('span.custom-dot'), 'Eigene Farbe');

  const swatches = TOPIC_PALETTE.map(([value, name]) => el('button.swatch', {
    type: 'button',
    title: name,
    'aria-label': name,
    dataset: { color: value },
    style: { background: value },
    onclick: () => pick(value),
  }));
  const panel = el('div.color-panel', { hidden: true },
    el('div.swatches', {}, swatches),
    customButton,
    mixer);

  function close() { setOpen(false); }
  function setOpen(isOpen) {
    if (isOpen && closeOpen && closeOpen !== close) closeOpen();
    panel.hidden = !isOpen;
    closeOpen = isOpen ? close : (closeOpen === close ? null : closeOpen);
  }

  function syncSliders() {
    const [h, s, l] = hexToHsl(color);
    sliders.h.value = h; sliders.s.value = s; sliders.l.value = l;
    mixer.style.setProperty('--h', h);
    mixer.style.setProperty('--s', `${s}%`);
    mixer.style.setProperty('--l', `${l}%`);
  }

  function pick(value, fromSwatch = true) {
    color = value;
    preview.style.background = value;
    customButton.querySelector('.custom-dot').style.background = value;
    for (const s of swatches) s.classList.toggle('selected', s.dataset.color === value);
    if (fromSwatch) syncSliders();
    else {
      mixer.style.setProperty('--h', sliders.h.value);
      mixer.style.setProperty('--s', `${sliders.s.value}%`);
      mixer.style.setProperty('--l', `${sliders.l.value}%`);
    }
    onChange(value);
  }
  for (const s of swatches) s.classList.toggle('selected', s.dataset.color === color);
  customButton.querySelector('.custom-dot').style.background = color;
  syncSliders();
  if (open) setOpen(true);

  return { element: el('div.color-chooser', {}, preview, panel), value: () => color };
}
