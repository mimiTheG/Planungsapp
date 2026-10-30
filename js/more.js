// "Mehr": Themen mit Farben, Datensicherung und Beispieldaten.

import { el, mount, toast, attempt } from './ui.js';
import { addDays, formatDate, isoDate, isoDateTime, parseDate, startOfDay } from './dates.js';
import * as store from './store.js';
import { nextTopicColor } from './topic-picker.js';
import { colorChooser } from './color-chooser.js';
import { loadSamples } from './samples.js';
import { cloudSection } from './cloud-view.js';
import { cloud } from './cloud.js';
import { openEventEditor } from './calendar.js';

// Bei eingeschaltetem Cloud-Sync gelten Ersetzen/Löschen auch für die Cloud und die anderen Geräte.
const alsoCloud = () => (cloud.status().phase === 'on' ? ' Das gilt auch für die Cloud und deine anderen Geräte.' : '');

export function renderMoreView(root) {
  const refresh = () => renderMoreView(root);
  const topics = store.topics();

  const newColor = colorChooser(nextTopicColor());
  const newForm = el('form.inline-form', {
    onsubmit: (e) => {
      e.preventDefault();
      if (attempt(() => store.createTopic({ name: newForm.elements.name.value, color: newColor.value() }))) refresh();
    },
  },
  newColor.element,
  el('input', { name: 'name', required: true, maxlength: 60, placeholder: 'Neues Thema, z. B. Sport' }),
  el('button.primary', { type: 'submit' }, '+'));

  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!window.confirm(`Alle aktuellen Daten durch die Sicherung ersetzen?${alsoCloud()}`)) return;
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
        // Änderungen werden gespeichert, ohne die Liste neu aufzubauen (sonst springt ein offener Farbwähler zurück).
        ? el('ul.topic-list', {}, topics.map((topic) => el('li', {},
          colorChooser(topic.color, (color) => {
            attempt(() => store.updateTopic(topic.id, { name: store.topicById(topic.id).name, color }));
          }).element,
          el('input', {
            value: topic.name,
            maxlength: 60,
            'aria-label': 'Name',
            onchange: (e) => {
              attempt(() => store.updateTopic(topic.id, { name: e.target.value, color: store.topicById(topic.id).color }));
            },
          }),
          // „Geburtstag“ und „Veranstaltung“ gibt es immer – umbenennen ja, löschen nein.
          store.isFixedTopic(topic)
            ? el('span.icon-placeholder', { title: 'Festes Thema – lässt sich nicht löschen' }, topic.birthday ? '🎂' : topic.vacation ? '🏝' : '🎫')
            : el('button.icon', {
              type: 'button',
              'aria-label': 'Löschen',
              onclick: () => {
                if (!window.confirm(`Thema „${topic.name}“ löschen? Aufgaben und Termine bleiben erhalten.`)) return;
                store.deleteTopic(topic.id);
                refresh();
              },
            }, '🗑'))))
        : el('p.empty', {}, 'Noch keine Themen.')),

    el('div.toolbar', {}, el('h2', {}, 'Urlaub')),
    vacationSection(refresh),

    el('div.toolbar', {}, el('h2', {}, 'Cloud-Sync')),
    cloudSection(refresh),

    el('div.toolbar', {}, el('h2', {}, 'Datensicherung')),
    el('div.card', {},
      el('p.muted', {}, 'Ohne Cloud-Sync liegen alle Daten nur auf diesem Gerät. Speichere ab und zu eine Sicherung, ',
        'z. B. bevor du den Browser-Speicher löschst oder das Handy wechselst.'),
      el('div.buttons', {},
        el('button.primary', { type: 'button', onclick: download }, '⬇ Sicherung speichern'),
        el('button', { type: 'button', onclick: () => fileInput.click() }, '⬆ Sicherung einlesen'),
        fileInput)),

    el('div.toolbar', {}, el('h2', {}, 'Beispieldaten')),
    el('div.card', {},
      el('p.muted', {}, 'Zum Ausprobieren gibt es Beispiel-Themen, -Aufgaben, -Routinen und -Termine. ',
        'Wenn du richtig loslegen willst, lösche sie einfach.'),
      el('div.buttons', {},
        el('button', {
          type: 'button',
          onclick: () => {
            if (!window.confirm(`Alle aktuellen Daten durch die Beispieldaten ersetzen?${alsoCloud()}`)) return;
            loadSamples();
            toast('Beispieldaten geladen');
            refresh();
          },
        }, 'Beispieldaten laden'),
        el('button.danger', {
          type: 'button',
          onclick: () => {
            if (!window.confirm(`Wirklich ALLE Daten löschen? Das lässt sich nicht rückgängig machen.${alsoCloud()}`)) return;
            store.clearAll();
            toast('Alle Daten gelöscht');
            refresh();
          },
        }, 'Alles löschen'))));
}

// Urlaub: anstehende und laufende Urlaube (Termine mit dem Thema „Urlaub“) und „+ Urlaub eintragen“.
function vacationSection(refresh) {
  const today = isoDate(new Date());
  const list = store.vacations().filter((v) => v.to >= today);
  const days = (v) => Math.round((parseDate(v.to) - parseDate(v.from)) / 86400000) + 1;
  const short = (d) => formatDate(parseDate(d), { weekday: 'short', day: '2-digit', month: '2-digit' });
  const add = () => {
    const start = startOfDay(new Date());
    openEventEditor({
      title: 'Urlaub',
      topic_id: store.vacationTopic().id,
      all_day: true,
      start_at: isoDateTime(start),
      end_at: isoDateTime(addDays(start, 6)),
    }, refresh);
  };
  return el('div.card.vacations', {},
    el('p.muted', {}, 'Aufgaben, die ab dem Erledigen neu zählen (z. B. „alle 4 Wochen nach dem letzten Mal“), ',
      'rücken um die Urlaubstage nach hinten. Aufgaben mit festen Tagen (Müll jeden Freitag) bleiben, wie sie sind.'),
    list.length ? el('ul.vacation-list', {}, list.map((v) => el('li', {},
      el('button.link', {
        type: 'button',
        onclick: () => openEventEditor(store.eventById(v.id), refresh),
      }, `🏝 ${v.title}`),
      el('span.muted', {}, `${short(v.from)} – ${short(v.to)} · ${days(v)} ${days(v) === 1 ? 'Tag' : 'Tage'}`)))) : null,
    el('div.buttons', {}, el('button.primary', { type: 'button', onclick: add }, '+ Urlaub eintragen')));
}
