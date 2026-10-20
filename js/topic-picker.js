// Auswahlfeld für das Thema mit "+ Neues Thema anlegen" direkt daneben.

import { el, field, select, attempt } from './ui.js';
import * as store from './store.js';

export const TOPIC_COLORS = ['#9f1239', '#db2777', '#f472b6', '#c026d3', '#e11d48', '#7c3aed', '#f59e0b', '#0d9488'];

export function nextTopicColor() {
  const used = new Set(store.topics().map((t) => t.color));
  return TOPIC_COLORS.find((c) => !used.has(c)) || TOPIC_COLORS[0];
}

function options(value) {
  return [['', '— ohne —'], ...store.topics().map((t) => [t.id, t.name])].map(([v, text]) =>
    el('option', { value: v, selected: String(v) === String(value ?? '') }, text));
}

export function topicPicker(value) {
  const topicSelect = select('topic_id', [], null);
  topicSelect.replaceChildren(...options(value));

  const nameInput = el('input', { maxlength: 60, placeholder: 'z. B. Sport', 'aria-label': 'Name des neuen Themas' });
  const colorInput = el('input', { type: 'color', value: nextTopicColor(), 'aria-label': 'Farbe' });
  const create = () => {
    let topic;
    if (!attempt(() => { topic = store.createTopic({ name: nameInput.value, color: colorInput.value }); })) return;
    topicSelect.replaceChildren(...options(topic.id));
    nameInput.value = '';
    colorInput.value = nextTopicColor();
    newBox.hidden = true;
  };
  const newBox = el('div.new-topic', { hidden: true },
    colorInput,
    nameInput,
    el('button.primary', { type: 'button', onclick: create }, 'Anlegen'));
  // Enter im Namensfeld legt das Thema an, statt das ganze Formular abzuschicken.
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });

  return el('div.topic-picker', {},
    field('Thema', topicSelect),
    el('button.link.add-topic', {
      type: 'button',
      onclick: () => { newBox.hidden = !newBox.hidden; if (!newBox.hidden) nameInput.focus(); },
    }, '+ Neues Thema anlegen'),
    newBox);
}
