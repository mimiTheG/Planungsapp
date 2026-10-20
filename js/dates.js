// Datumshelfer. Gespeichert wird als Text: Tage als "JJJJ-MM-TT", Zeitpunkte als "JJJJ-MM-TT HH:MM".

const pad = (n) => String(n).padStart(2, '0');

export function isoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Für <input type="datetime-local">.
export function isoDateTime(date) {
  return `${isoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Zum Speichern.
export function stamp(date) {
  return `${isoDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "2026-10-20", "2026-10-20 08:30" oder "2026-10-20T08:30" als lokale Zeit lesen.
export function parseDate(value) {
  const [d, t = '00:00'] = String(value).split(/[ T]/);
  const [y, m, day] = d.split('-').map(Number);
  const [h, min] = t.split(':').map(Number);
  return new Date(y, m - 1, day, h, min);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfWeek(date) {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() + 6) % 7)); // Montag
}

export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

export function formatDate(value, options = { weekday: 'short', day: '2-digit', month: '2-digit' }) {
  if (!value) return '';
  const date = value instanceof Date ? value : parseDate(value);
  return date.toLocaleDateString('de-DE', options);
}

export function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
