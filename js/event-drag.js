// Termine in Tag-/3-Tage-/Wochenansicht verschieben: Block lang drücken, dann ziehen.
// Hoch/runter = andere Uhrzeit (in 15-Minuten-Schritten), in eine andere Spalte = anderer Tag.
// Hält man den Finger am linken oder rechten Rand, blättert der Kalender zum vorigen/nächsten Tag.
// Mit der Maus (am PC) geht es ohne langes Drücken: einfach ziehen.

import { formatDate, formatTime } from './dates.js';

const HOLD_MS = 450;
const MOVE_TOLERANCE = 8;
const SNAP_MIN = 15;
const EDGE_X = 28; // Rand zum Weiterblättern
const EDGE_HOLD_MS = 600;
const EDGE_Y = 50; // Rand zum Scrollen
const MAX_SPEED = 12;

let drag = null; // läuft gerade ein Verschieben? (überdauert das Neuzeichnen beim Blättern)
let droppedAt = 0;

// Direkt nach dem Loslassen soll weder der Klick den Editor öffnen noch das Wischen weiterblättern.
export const justDragged = () => Boolean(drag?.active) || Date.now() - droppedAt < 300;

// options: { hourPx, onDrop(block, deltaMs), onEdge(dir) }. block._drag = { ev, seg } setzt der Kalender.
export function enableEventDrag(week, options) {
  week.addEventListener('pointerdown', (e) => {
    const block = e.target.closest('.block');
    if (!block?._drag || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const rect = block.getBoundingClientRect();
    const mouse = e.pointerType === 'mouse';
    if (mouse) e.preventDefault(); // kein Markieren von Text beim Ziehen
    drag = {
      block, options, active: false, mouse,
      startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY,
      grabY: e.clientY - rect.top, grabX: e.clientX - rect.left,
      timer: setTimeout(() => begin(rect), HOLD_MS),
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  });
  // Während des Verschiebens nicht scrollen und kein Kontextmenü beim langen Drücken.
  week.addEventListener('touchmove', (e) => { if (drag?.active) e.preventDefault(); }, { passive: false });
  week.addEventListener('contextmenu', (e) => { if (drag) e.preventDefault(); });
}

function begin(rect) {
  drag.active = true;
  navigator.vibrate?.(30);
  const ghost = drag.block.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.append(Object.assign(document.createElement('span'), { className: 'drag-time' }));
  document.body.append(ghost);
  drag.ghost = ghost;
  drag.block.classList.add('drag-source');
  drag.frame = requestAnimationFrame(tick);
  update();
}

function onMove(e) {
  if (!drag) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (!drag.active) {
    const moved = Math.abs(e.clientX - drag.startX) > MOVE_TOLERANCE || Math.abs(e.clientY - drag.startY) > MOVE_TOLERANCE;
    if (!moved) return;
    // Maus: Ziehen beginnt sofort. Finger: Bewegung vor Ablauf der Haltezeit ist Scrollen oder Wischen.
    if (!drag.mouse) {
      stop();
      return;
    }
    clearTimeout(drag.timer);
    begin(drag.block.getBoundingClientRect());
  }
  e.preventDefault();
  update();
}

// Spalte unter dem Finger und neue Startzeit des gegriffenen Blocks (gerastert).
function target() {
  const cols = [...document.querySelectorAll('.week .day-col')];
  const col = cols.find((c) => {
    const r = c.getBoundingClientRect();
    return drag.x >= r.left && drag.x < r.right;
  }) || (cols.length === 1 ? cols[0] : null);
  if (!col) return null;
  const r = col.getBoundingClientRect();
  const minutes = ((drag.y - drag.grabY - r.top) / drag.options.hourPx) * 60;
  const snapped = Math.round(minutes / SNAP_MIN) * SNAP_MIN;
  const start = new Date(`${col.dataset.day}T00:00`);
  start.setMinutes(snapped);
  return { col, start, top: r.top + (snapped / 60) * drag.options.hourPx, left: r.left, width: r.width };
}

function update() {
  const t = target();
  const { ghost } = drag;
  ghost.classList.toggle('nowhere', !t);
  if (!t) {
    ghost.style.left = `${drag.x - drag.grabX}px`;
    ghost.style.top = `${drag.y - drag.grabY}px`;
    return;
  }
  ghost.style.left = `${t.left + 1}px`;
  ghost.style.width = `${t.width - 3}px`;
  ghost.style.top = `${t.top}px`;
  const { seg } = drag.block._drag;
  const end = new Date(+t.start + (seg.end - seg.start));
  ghost.querySelector('.drag-time').textContent =
    `${formatDate(t.start, { weekday: 'short', day: 'numeric', month: 'numeric' })} ${formatTime(t.start)}–${formatTime(end)}`;
  drag.target = t;
}

// Jedes Bild: am oberen/unteren Rand scrollen, am linken/rechten Rand weiterblättern.
function tick(now) {
  drag.frame = requestAnimationFrame(tick);
  const scroller = document.querySelector('.week-scroll');
  const week = document.querySelector('.week');
  if (!scroller || !week) return;
  const s = scroller.getBoundingClientRect();
  let speed = 0;
  if (drag.y < s.top + EDGE_Y) speed = -MAX_SPEED * Math.min(1, (s.top + EDGE_Y - drag.y) / EDGE_Y);
  else if (drag.y > s.bottom - EDGE_Y) speed = MAX_SPEED * Math.min(1, (drag.y - (s.bottom - EDGE_Y)) / EDGE_Y);
  if (speed) {
    scroller.scrollTop += speed;
    update();
  }
  const w = week.getBoundingClientRect();
  // Nur wenn der Finger auch in diese Richtung gezogen wurde (nicht, weil der Block schon am Rand liegt).
  const pulled = drag.x - drag.startX;
  const dir = drag.x < w.left + EDGE_X && pulled < -20 ? -1 : drag.x > w.right - EDGE_X && pulled > 20 ? 1 : 0;
  if (dir !== drag.edgeDir) {
    drag.edgeDir = dir;
    drag.edgeSince = now;
  } else if (dir && now - drag.edgeSince > EDGE_HOLD_MS) {
    drag.edgeSince = now;
    drag.options.onEdge(dir);
    update();
  }
}

function onUp() {
  if (!drag) return;
  const { active, target: t, block, options } = drag;
  stop();
  if (!active) return;
  droppedAt = Date.now();
  if (t) options.onDrop(block._drag, t.start - block._drag.seg.start);
}

function onCancel() {
  if (drag) stop();
}

function stop() {
  clearTimeout(drag.timer);
  cancelAnimationFrame(drag.frame);
  drag.ghost?.remove();
  drag.block.classList.remove('drag-source');
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
  drag = null;
}
