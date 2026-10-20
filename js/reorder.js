// Reihenfolge per langem Drücken ändern: Finger (oder Maus) auf einem Eintrag halten, dann nach oben
// oder unten ziehen und loslassen. Funktioniert für die direkten Einträge einer Liste.

const HOLD_MS = 450;
const MOVE_TOLERANCE = 8;

export function enableLongPressReorder(list, onReorder) {
  let timer = null;
  let dragged = null;
  let startY = 0;
  let startX = 0;

  const items = () => [...list.children];

  const reset = () => {
    clearTimeout(timer);
    timer = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  function start() {
    list.classList.add('reordering');
    dragged.classList.add('dragging');
    navigator.vibrate?.(30);
  }

  function onMove(e) {
    if (!list.classList.contains('reordering')) {
      // Bewegt sich der Finger vor Ablauf der Haltezeit, ist es Scrollen – kein Verschieben.
      if (Math.abs(e.clientY - startY) > MOVE_TOLERANCE || Math.abs(e.clientX - startX) > MOVE_TOLERANCE) {
        dragged = null;
        reset();
      }
      return;
    }
    e.preventDefault();
    const previous = dragged.previousElementSibling;
    const next = dragged.nextElementSibling;
    if (previous) {
      const rect = previous.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) list.insertBefore(dragged, previous);
    }
    if (next) {
      const rect = next.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) list.insertBefore(next, dragged);
    }
  }

  function onUp() {
    const wasDragging = list.classList.contains('reordering');
    reset();
    if (!wasDragging) {
      dragged = null;
      return;
    }
    list.classList.remove('reordering');
    dragged.classList.remove('dragging');
    dragged = null;
    // Der Klick nach dem Loslassen soll nicht den Editor öffnen.
    list.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
    setTimeout(() => onReorder(items().map((li) => Number(li.dataset.id))), 0);
  }

  list.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.task-row');
    const li = row?.parentElement;
    if (!li || li.parentElement !== list || items().length < 2) return; // verschachtelte Listen regeln das selbst
    if (e.target.closest('input, .actions, .twisty') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragged = li;
    startY = e.clientY;
    startX = e.clientX;
    timer = setTimeout(start, HOLD_MS);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  // Während des Verschiebens nicht scrollen und kein Kontextmenü beim langen Drücken.
  list.addEventListener('touchmove', (e) => { if (list.classList.contains('reordering')) e.preventDefault(); }, { passive: false });
  list.addEventListener('contextmenu', (e) => { if (dragged) e.preventDefault(); });
}
