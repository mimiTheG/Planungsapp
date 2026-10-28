// Tastenkürzel für die Bedienung am PC. Greifen nicht, solange man in ein Feld tippt oder ein Dialog offen ist.
//   1–5  Kalender, Jetzt, Aufgaben, Routinen, Themen
//   N    Neu (Termin, Aufgabe bzw. Routine – je nach Bereich)
//   ← →  Kalender: zurück / vor      T  Kalender: heute
//   ?    Übersicht der Tastenkürzel
// Knöpfe, die per Taste ausgelöst werden können, tragen data-key (new, prev, next, today).

import { el, openDialog } from './ui.js';

const VIEWS = { 1: 'kalender', 2: 'jetzt', 3: 'aufgaben', 4: 'routinen', 5: 'mehr' };
const ACTIONS = { n: 'new', arrowleft: 'prev', arrowright: 'next', t: 'today' };
const HELP = [
  ['1 – 5', 'Kalender, Jetzt, Aufgaben, Routinen, Themen'],
  ['N', 'Neu: Termin, Aufgabe oder Routine (je nach Bereich)'],
  ['← / →', 'Kalender zurück / vor'],
  ['T', 'Kalender: heute'],
  ['Esc', 'Dialog schließen'],
  ['?', 'diese Übersicht'],
];

export function showShortcuts() {
  openDialog('Tastenkürzel', el('table.shortcuts', {}, HELP.map(([keys, text]) =>
    el('tr', {}, el('td', {}, el('kbd', {}, keys)), el('td', {}, text)))));
}

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (document.getElementById('dialog').open) return;
    const key = e.key.toLowerCase();
    if (VIEWS[key]) {
      e.preventDefault();
      location.hash = VIEWS[key];
      return;
    }
    if (key === '?') {
      e.preventDefault();
      showShortcuts();
      return;
    }
    const button = ACTIONS[key] && document.querySelector(`#view [data-key="${ACTIONS[key]}"]`);
    if (button && !button.disabled) {
      e.preventDefault();
      button.click();
    }
  });
}
