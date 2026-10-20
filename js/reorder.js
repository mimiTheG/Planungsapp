// Reihenfolge per langem Drücken ändern: Finger (oder Maus) auf einem Eintrag halten, dann nach oben
// oder unten ziehen und loslassen. Funktioniert für die direkten Einträge einer Liste.
// Mit level = { onChange(id, ids, direction), canOutdent } ändert Ziehen nach rechts/links die Ebene:
// rechts = Unteraufgabe des Eintrags darüber, links = eine Ebene höher.

const HOLD_MS = 450;
const MOVE_TOLERANCE = 8;
const LEVEL_DX = 48;
const EDGE_PX = 70; // so nah am oberen/unteren Rand beginnt das Scrollen
const MAX_SPEED = 14; // Pixel pro Bild, ganz am Rand

// Nächster scrollbarer Bereich (z. B. die Seite selbst).
function scrollParent(node) {
  for (let n = node.parentElement; n && n !== document.body; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if (/(auto|scroll)/.test(overflowY) && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement;
}

// Sichtbarer Bereich des Scrollers – bei der Seite ohne die Leisten unten (Navigation, laufende Routine).
function visibleArea(scroller) {
  if (scroller !== document.scrollingElement) {
    const rect = scroller.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
  }
  const bars = [...document.querySelectorAll('.tabs, #player')].filter((b) => !b.hidden && b.offsetHeight);
  return { top: 0, bottom: Math.min(window.innerHeight, ...bars.map((b) => b.getBoundingClientRect().top)) };
}

export function enableLongPressReorder(list, onReorder, level = null) {
  let timer = null;
  let dragged = null;
  let startY = 0;
  let startX = 0;
  let direction = 0;
  let lastY = 0;
  let scroller = null;
  let frame = null;

  const items = () => [...list.children];

  const reset = () => {
    clearTimeout(timer);
    timer = null;
    cancelAnimationFrame(frame);
    frame = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };

  function start() {
    direction = 0;
    list.classList.add('reordering');
    dragged.classList.add('dragging');
    navigator.vibrate?.(30);
    scroller = scrollParent(list);
    frame = requestAnimationFrame(autoScroll);
  }

  // Hält man den Eintrag nahe am oberen oder unteren Rand, scrollt die Liste mit – je näher, desto schneller.
  function autoScroll() {
    frame = requestAnimationFrame(autoScroll);
    if (Math.abs(lastY - startY) < EDGE_PX / 3) return; // erst, wenn der Finger wirklich gezogen wird
    const { top, bottom } = visibleArea(scroller);
    let speed = 0;
    if (lastY < top + EDGE_PX) speed = -MAX_SPEED * Math.min(1, (top + EDGE_PX - lastY) / EDGE_PX);
    else if (lastY > bottom - EDGE_PX) speed = MAX_SPEED * Math.min(1, (lastY - (bottom - EDGE_PX)) / EDGE_PX);
    if (!speed) return;
    const before = scroller.scrollTop;
    scroller.scrollTop += speed;
    if (scroller.scrollTop !== before) moveTo(lastY);
  }

  // Eintrag an die Stelle unter dem Finger schieben (ein Platz pro Aufruf).
  function moveTo(y) {
    const previous = dragged.previousElementSibling;
    const next = dragged.nextElementSibling;
    if (previous) {
      const rect = previous.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) list.insertBefore(dragged, previous);
    }
    if (next) {
      const rect = next.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) list.insertBefore(next, dragged);
    }
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
    if (level) showLevel(e.clientX - startX);
    lastY = e.clientY;
    moveTo(lastY);
  }

  // Seitliches Ziehen: Eintrag folgt dem Finger ein Stück, ab LEVEL_DX zeigt ein Hinweis die neue Ebene.
  function showLevel(dx) {
    const row = dragged.querySelector(':scope > .task-row');
    const canIn = Boolean(dragged.previousElementSibling);
    const canOut = level.canOutdent;
    direction = dx > LEVEL_DX && canIn ? 1 : dx < -LEVEL_DX && canOut ? -1 : 0;
    const max = (dx > 0 ? canIn : canOut) ? LEVEL_DX + 12 : 12;
    row.style.translate = `${Math.max(-max, Math.min(max, dx))}px 0`;
    dragged.classList.toggle('level-in', direction === 1);
    dragged.classList.toggle('level-out', direction === -1);
  }

  function onUp() {
    const wasDragging = list.classList.contains('reordering');
    reset();
    if (!wasDragging) {
      dragged = null;
      return;
    }
    list.classList.remove('reordering');
    dragged.classList.remove('dragging', 'level-in', 'level-out');
    dragged.querySelector(':scope > .task-row').style.translate = '';
    const id = Number(dragged.dataset.id);
    const change = direction;
    dragged = null;
    // Der Klick nach dem Loslassen soll nicht den Editor öffnen.
    list.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { capture: true, once: true });
    const ids = items().map((li) => Number(li.dataset.id));
    setTimeout(() => (change ? level.onChange(id, ids, change) : onReorder(ids)), 0);
  }

  list.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.task-row');
    const li = row?.parentElement;
    if (!li || li.parentElement !== list) return; // verschachtelte Listen regeln das selbst
    if (items().length < 2 && !level?.canOutdent) return;
    if (e.target.closest('input, .actions, .twisty') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragged = li;
    startY = e.clientY;
    startX = e.clientX;
    lastY = e.clientY;
    timer = setTimeout(start, HOLD_MS);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  // Während des Verschiebens nicht scrollen und kein Kontextmenü beim langen Drücken.
  list.addEventListener('touchmove', (e) => { if (list.classList.contains('reordering')) e.preventDefault(); }, { passive: false });
  list.addEventListener('contextmenu', (e) => { if (dragged) e.preventDefault(); });
}
