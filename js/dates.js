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

// Dauer lesbar: 45 → "45 min", 90 → "1 h 30 min", 120 → "2 h".
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Zeitspanne lesbar in passender Einheit: bis 13 Tage in Tagen, bis knapp 2 Monate in Wochen, bis knapp
// 1 Jahr in Monaten, darüber in Jahren (gerundet). dative für „seit/vor/in …“: „seit 3 Wochen“, „vor 1 Monat“.
const SPAN_UNITS = {
  day: ['Tag', 'Tage', 'Tagen'],
  week: ['Woche', 'Wochen', 'Wochen'],
  month: ['Monat', 'Monate', 'Monaten'],
  year: ['Jahr', 'Jahre', 'Jahren'],
};

export function spanText(days, { dative = false } = {}) {
  const d = Math.max(0, Math.round(days));
  let unit = 'day';
  let n = d;
  if (d >= 365) { unit = 'year'; n = Math.round(d / 365); }
  else if (d >= 56) { unit = 'month'; n = Math.max(2, Math.round(d / 30.44)); }
  else if (d >= 14) { unit = 'week'; n = Math.round(d / 7); }
  const [one, many, manyDative] = SPAN_UNITS[unit];
  return `${n} ${n === 1 ? one : dative ? manyDative : many}`;
}

// Stunden/Minuten bis bzw. seit einem Zeitpunkt (für den letzten Tag mit Uhrzeit): „3 Std.“, „20 Min.“.
export function hoursText(ms) {
  const minutes = Math.max(0, Math.round(Math.abs(ms) / 60000));
  return minutes < 60 ? `${Math.max(1, minutes)} Min.` : `${Math.round(minutes / 60)} Std.`;
}
