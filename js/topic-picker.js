// Auswahlfeld für das Thema mit "+ Neues Thema anlegen" direkt daneben.

import { el, field, select, attempt } from './ui.js';
import * as store from './store.js';
import { TOPIC_PALETTE, colorChooser } from './color-chooser.js';

// Erste Farbe der Palette, die noch kein Thema hat.
export function nextTopicColor() {
  const used = new Set(store.topics().map((t) => t.color));
  return (TOPIC_PALETTE.find(([c]) => !used.has(c)) || TOPIC_PALETTE[0])[0];
}

function options(value) {
  return [['', '— ohne —'], ...store.topics().map((t) => [t.id, t.name])].map(([v, text]) =>
    el('option', { value: v, selected: String(v) === String(value ?? '') }, text));
}

export function topicPicker(value) {
  const topicSelect = select('topic_id', [], null);
  topicSelect.replaceChildren(...options(value));

  const nameInput = el('input', { maxlength: 60, placeholder: 'z. B. Sport', 'aria-label': 'Name des neuen Themas' });
  let color = colorChooser(nextTopicColor(), () => {}, { open: true });
  const create = () => {
    let topic;
    if (!attempt(() => { topic = store.createTopic({ name: nameInput.value, color: color.value() }); })) return;
    topicSelect.replaceChildren(...options(topic.id));
    nameInput.value = '';
    const fresh = colorChooser(nextTopicColor(), () => {}, { open: true });
    color.element.replaceWith(fresh.element);
    color = fresh;
    newBox.hidden = true;
  };
  const newBox = el('div.new-topic', { hidden: true },
    nameInput,
    el('button.primary', { type: 'button', onclick: create }, 'Anlegen'),
    color.element);
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
