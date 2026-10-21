// Beispieldaten zum Ausprobieren – werden beim allerersten Start automatisch angelegt.
// Alle Daten werden über die normalen Store-Funktionen erzeugt und relativ zu heute datiert.

import { addDays, isoDate } from './dates.js';
import * as store from './store.js';

export function loadSamples(today = new Date()) {
  store.clearAll();
  const day = (offset) => isoDate(addDays(today, offset));
  const at = (offset, time) => `${day(offset)} ${time}`;

  const topic = (name, color) => store.createTopic({ name, color }).id;
  const arbeit = topic('Arbeit', '#9b2948');
  const sport = topic('Sport', '#4f8a7b');
  const haushalt = topic('Haushalt', '#e9a66b');
  const freizeit = topic('Freizeit', '#9c8ad0');
  const finanzen = topic('Finanzen', '#2f6f7e');

  const task = (input) => store.createTask(input).id;
  const steps = (parent, list) => list.map(([title, duration_min]) => task({ title, duration_min, parent_id: parent }));

  // Routinen
  const morgenKurz = task({ title: 'Morgenroutine kurz', kind: 'routine', topic_id: freizeit, default_time: '07:00' });
  steps(morgenKurz, [['Zähne putzen', 3], ['Kaffee kochen', 5], ['Tagesplan anschauen', 5]]);
  const abendLang = task({ title: 'Abendroutine lang', kind: 'routine', topic_id: freizeit, default_time: '21:30' });
  steps(abendLang, [
    ['Küche aufräumen', 10], ['Tasche für morgen packen', 5], ['Zähne putzen', 3], ['Tagebuch schreiben', 10], ['Lesen', 20], ['Licht aus', 1],
  ]);
  const arbeitMorgen = task({ title: 'Arbeit Morgendliche Aufgaben', kind: 'routine', topic_id: arbeit, default_time: '08:30' });
  steps(arbeitMorgen, [['Mails checken', 10], ['Kalender durchgehen', 5], ['Top-3 des Tages festlegen', 5]]);
  const sportRoutine = task({ title: 'Sportroutine', kind: 'routine', topic_id: sport });
  steps(sportRoutine, [['Aufwärmen', 10], ['Krafttraining', 25], ['Dehnen', 10]]);

  // Wiederkehrende Aufgaben
  task({
    // Alle 2 Wochen am selben Wochentag (fest), spätestens 6 Uhr.
    title: 'Müll rausstellen', topic_id: haushalt, recurrence: 'rhythm', repeat: { freq: 'weekly', interval: 2 }, buffer: 0,
    window_start: day(2), deadline_time: '06:00', on_missed: 'expire', importance: 3, urgency: 5, importance_emo: 2, urgency_emo: 4,
  });
  task({
    // Eine Woche nach dem letzten Mal.
    title: 'Bett frisch beziehen', topic_id: haushalt, recurrence: 'rhythm', repeat: { freq: 'weekly', interval: 1 }, repeat_from_done: true, buffer: 1,
    window_start: day(-1), on_missed: 'remind', importance: 3, urgency: 3, importance_emo: 3, urgency_emo: 2,
  });
  task({
    title: 'Pflanzen gießen', topic_id: haushalt, recurrence: 'rhythm', repeat: { freq: 'daily', interval: 4 }, repeat_from_done: true, buffer: 1,
    window_start: day(-4), on_missed: 'remind', importance: 3, urgency: 4, importance_emo: 4, urgency_emo: 4,
  });
  task({
    title: 'Steuererklärung', topic_id: finanzen, recurrence: 'period', period_start: '03-01', period_end: '09-30',
    on_missed: 'remind', importance: 5, urgency: 2, importance_emo: 4, urgency_emo: 1,
  });

  // Einmalige Aufgaben
  task({
    title: 'Zahnarzttermin vereinbaren', topic_id: null, window_end: day(-2), on_missed: 'remind',
    importance: 4, urgency: 4, importance_emo: 3, urgency_emo: 2,
  });
  task({
    title: 'Präsentation vorbereiten', topic_id: arbeit, window_end: day(3), deadline_time: '09:00',
    importance: 5, urgency: 3, importance_emo: 5, urgency_emo: 4, duration_min: 120,
  });
  const umzug = task({ title: 'Umzug planen', topic_id: haushalt, window_end: day(40), importance: 4, urgency: 2 });
  const kartons = task({ title: 'Kartons besorgen', parent_id: umzug });
  const nachbarn = task({ title: 'Bei den Nachbarn fragen', parent_id: kartons });
  task({ title: 'Im Baumarkt kaufen', parent_id: kartons });
  const angebote = task({ title: 'Umzugsfirma anfragen', parent_id: umzug });
  task({ title: 'Nachsendeauftrag stellen', parent_id: umzug });
  task({ title: 'Wohnung ausmessen', parent_id: umzug });
  store.completeTask(nachbarn);
  store.completeTask(angebote);

  // Projekte
  const fotobuch = task({ title: 'Fotobuch vom Urlaub gestalten', kind: 'project', topic_id: freizeit, importance: 2, urgency: 1, importance_emo: 4, urgency_emo: 2 });
  const fotos = task({ title: 'Fotos aussortieren', parent_id: fotobuch });
  const layout = task({ title: 'Layout auswählen', parent_id: fotobuch });
  task({ title: 'Texte schreiben', parent_id: fotobuch });
  task({ title: 'Bestellen', parent_id: fotobuch });
  store.completeTask(fotos);
  store.completeTask(layout);
  store.completeTask(task({ title: 'Erste Seiten füllen', parent_id: fotobuch }));
  task({ title: 'Halbmarathon-Training', kind: 'project', topic_id: sport, importance: 3, urgency: 1, importance_emo: 4, urgency_emo: 1 });

  // Wollte ich schon länger mal wieder machen
  store.createWish({ title: 'Gitarre spielen', topic_id: freizeit });
  store.createWish({ title: 'Alte Freundin anrufen', topic_id: freizeit });
  store.createWish({ title: 'Ins Museum gehen', topic_id: freizeit });
  const brot = store.createWish({ title: 'Brot backen', topic_id: haushalt });
  store.doneWish(brot.id, addDays(today, -30));

  // Termine
  store.createEvent({
    title: 'Büro', topic_id: arbeit, start_at: at(1, '09:00'), end_at: at(1, '16:30'),
  });
  store.createEvent({
    title: 'Teammeeting', topic_id: arbeit, start_at: at(2, '10:00'), end_at: at(2, '11:00'),
    repeat: { freq: 'weekly', interval: 1 },
  });
  store.createEvent({
    title: 'Yoga', topic_id: sport, start_at: at(0, '18:30'), end_at: at(0, '19:30'),
    repeat: { freq: 'weekly', interval: 1, count: 10 },
  });
  store.createEvent({
    title: 'Laufen im Park', topic_id: sport, start_at: at(3, '07:00'), end_at: at(3, '07:45'),
    repeat: { freq: 'weekly', interval: 2 },
  });
  store.createEvent({
    title: 'Konzert', topic_id: store.eventTopic().id, start_at: at(4, '20:00'), end_at: at(4, '22:30'),
  });
  store.createEvent({
    title: 'Flohmarkt', topic_id: store.eventTopic().id, start_at: at(5, '10:00'), end_at: at(5, '14:00'),
  });
  store.createEvent({
    title: 'Steuerberaterin', topic_id: finanzen, start_at: at(8, '14:00'), end_at: at(8, '15:00'),
  });
}
