// Einstiegspunkt: Navigation zwischen den Bereichen.

import { toast } from './ui.js';
import * as store from './store.js';
import { renderNowView } from './now.js';
import { renderCalendarView } from './calendar.js';
import { renderTasksView, renderRoutinesView } from './tasks.js';
import { renderMoreView } from './more.js';
import { loadSamples } from './samples.js';

const VIEWS = {
  jetzt: renderNowView,
  kalender: renderCalendarView,
  aufgaben: renderTasksView,
  routinen: renderRoutinesView,
  mehr: renderMoreView,
};

function show() {
  const name = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'kalender';
  for (const link of document.querySelectorAll('.tabs a')) {
    link.classList.toggle('active', link.dataset.view === name);
  }
  const root = document.getElementById('view');
  try {
    VIEWS[name](root);
  } catch (err) {
    root.textContent = `Fehler: ${err.message}`;
    console.error(err);
  }
  window.scrollTo(0, 0);
}

// Beim allerersten Start Beispieldaten anlegen (lassen sich unter "Themen" wieder löschen).
if (!store.load()) loadSamples();
window.addEventListener('hashchange', show);
// Beim Zurückkehren in die App Fälligkeiten neu berechnen (z. B. am nächsten Morgen).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !document.getElementById('dialog').open) {
    store.rollExpired();
    show();
  }
});
show();

// Offline-Unterstützung und dauerhafter Speicher.
if ('serviceWorker' in navigator) {
  // Übernimmt eine neue Version die Kontrolle, einmal neu laden, damit sie sofort sichtbar ist.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
window.addEventListener('storage', () => { store.load(); show(); });
window.addEventListener('error', (e) => toast(e.message, true));
