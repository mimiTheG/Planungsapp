// "Mehr": Themen mit Farben und Datensicherung.

import { el, mount, toast, attempt } from './ui.js';
import { isoDate } from './dates.js';
import * as store from './store.js';

const SUGGESTED = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#9333ea', '#0891b2', '#db2777', '#4b5563'];

export function renderMoreView(root) {
  const refresh = () => renderMoreView(root);
  const topics = store.topics();

  const nextColor = SUGGESTED.find((c) => !topics.some((t) => t.color === c)) || SUGGESTED[0];
  const newForm = el('form.inline-form', {
    onsubmit: (e) => {
      e.preventDefault();
      if (attempt(() => store.createTopic({ name: newForm.elements.name.value, color: newForm.elements.color.value }))) refresh();
    },
  },
  el('input', { type: 'color', name: 'color', value: nextColor, 'aria-label': 'Farbe' }),
  el('input', { name: 'name', required: true, maxlength: 60, placeholder: 'Neues Thema, z. B. Sport' }),
  el('button.primary', { type: 'submit' }, '+'));

  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!window.confirm('Alle aktuellen Daten durch die Sicherung ersetzen?')) return;
      const content = await file.text();
      if (attempt(() => store.importJson(content))) {
        toast('Sicherung eingelesen');
        refresh();
      }
    },
  });

  const download = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const link = el('a', { href: URL.createObjectURL(blob), download: `planungsapp-${isoDate(new Date())}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  mount(root,
    el('div.toolbar', {}, el('h2', {}, 'Themen')),
    el('div.card', {},
      el('p.muted', {}, 'Jedes Thema hat eine Farbe – für Aufgaben und Termine.'),
      newForm,
      topics.length
        ? el('ul.topic-list', {}, topics.map((topic) => el('li', {},
          el('input', {
            type: 'color',
            value: topic.color,
            'aria-label': `Farbe von ${topic.name}`,
            onchange: (e) => { attempt(() => store.updateTopic(topic.id, { name: topic.name, color: e.target.value })); refresh(); },
          }),
          el('input', {
            value: topic.name,
            maxlength: 60,
            'aria-label': 'Name',
            onchange: (e) => { attempt(() => store.updateTopic(topic.id, { name: e.target.value, color: topic.color })); refresh(); },
          }),
          el('button.icon', {
            type: 'button',
            'aria-label': 'Löschen',
            onclick: () => {
              if (!window.confirm(`Thema „${topic.name}“ löschen? Aufgaben und Termine bleiben erhalten.`)) return;
              store.deleteTopic(topic.id);
              refresh();
            },
          }, '🗑'))))
        : el('p.empty', {}, 'Noch keine Themen.')),

    el('div.toolbar', {}, el('h2', {}, 'Datensicherung')),
    el('div.card', {},
      el('p.muted', {}, 'Alle Daten liegen nur auf diesem Gerät. Speichere ab und zu eine Sicherung, ',
        'z. B. bevor du den Browser-Speicher löschst oder das Handy wechselst.'),
      el('div.buttons', {},
        el('button.primary', { type: 'button', onclick: download }, '⬇ Sicherung speichern'),
        el('button', { type: 'button', onclick: () => fileInput.click() }, '⬆ Sicherung einlesen'),
        fileInput)));
}
