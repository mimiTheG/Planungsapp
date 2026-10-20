// Einstiegspunkt: Navigation zwischen den Bereichen.

import { toast } from './ui.js';
import * as store from './store.js';
import { renderNowView } from './now.js';
import { renderCalendarView } from './calendar.js';
import { renderTasksView, renderRoutinesView } from './tasks.js';
import { renderMoreView } from './more.js';

const VIEWS = {
  jetzt: renderNowView,
  kalender: renderCalendarView,
  aufgaben: renderTasksView,
  routinen: renderRoutinesView,
  mehr: renderMoreView,
};

function show() {
  const name = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'jetzt';
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

store.load();
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
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
window.addEventListener('storage', () => { store.load(); show(); });
window.addEventListener('error', (e) => toast(e.message, true));
