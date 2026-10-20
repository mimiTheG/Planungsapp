// Auswahl "Gehört zu": zeigt nur die oberste Ebene; Einträge mit Unteraufgaben lassen sich aufklappen.
// Der Wert steckt in einem versteckten Feld (name="parent_id"); Änderungen lösen dort 'change' aus.

import { el, mount } from './ui.js';
import * as store from './store.js';
import { topicDot } from './tasks.js';

// excluded: IDs, die nicht wählbar sind (die Aufgabe selbst und ihre Unteraufgaben).
export function parentPicker(value, excluded = new Set()) {
  const input = el('input', { type: 'hidden', name: 'parent_id', value: value ?? '' });
  const display = el('button.parent-display', { type: 'button', 'aria-expanded': 'false', onclick: () => toggle() });
  const panel = el('div.parent-panel', { hidden: true });
  const expanded = new Set();

  // Pfad der aktuellen Auswahl aufklappen, damit man sie beim Öffnen sieht.
  for (let p = store.taskById(value); p?.parent_id; p = store.taskById(p.parent_id)) expanded.add(p.parent_id);

  const children = (id) => store.childrenOf(id).filter((t) => !excluded.has(t.id));

  function pathOf(id) {
    const parts = [];
    for (let t = store.taskById(id); t; t = store.taskById(t.parent_id)) parts.unshift(t.title);
    return parts.join(' › ');
  }

  function updateDisplay() {
    mount(display,
      el('span.parent-label', {}, input.value ? pathOf(input.value) : '— keine (oberste Ebene) —'),
      el('span.caret', {}, panel.hidden ? '▾' : '▴'));
  }

  function choose(id) {
    input.value = id ?? '';
    toggle(false);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function toggle(open = panel.hidden) {
    panel.hidden = !open;
    display.setAttribute('aria-expanded', String(open));
    if (open) renderPanel();
    updateDisplay();
  }

  function item(task, depth) {
    const kids = children(task.id);
    const isOpen = expanded.has(task.id);
    return [
      el(`div.parent-item${String(task.id) === input.value ? '.selected' : ''}`, { style: { paddingLeft: `${0.4 + depth * 1.1}rem` } },
        kids.length
          ? el('button.icon.twisty', {
            type: 'button',
            'aria-label': isOpen ? 'Zuklappen' : `${kids.length} Unteraufgaben anzeigen`,
            onclick: () => { if (isOpen) expanded.delete(task.id); else expanded.add(task.id); renderPanel(); },
          }, isOpen ? '▾' : '▸')
          : el('span.twisty'),
        el('button.link.parent-choose', { type: 'button', onclick: () => choose(task.id) },
          topicDot(task), task.title,
          kids.length && !isOpen ? el('span.muted', {}, ` (${kids.length})`) : null)),
      isOpen ? kids.map((child) => item(child, depth + 1)) : null,
    ];
  }

  function renderPanel() {
    const top = store.tasks().filter((t) => t.parent_id === null && !excluded.has(t.id)
      && !['done', 'expired'].includes(t.status));
    mount(panel,
      el(`div.parent-item${input.value ? '' : '.selected'}`, {},
        el('span.twisty'),
        el('button.link.parent-choose', { type: 'button', onclick: () => choose(null) }, '— keine (oberste Ebene) —')),
      top.map((t) => item(t, 0)));
  }

  updateDisplay();
  return { element: el('div.parent-picker', {}, input, display, panel), input };
}
