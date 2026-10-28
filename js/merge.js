// Abgleich zwischen Geräten (Cloud-Sync) – reine Funktionen ohne Speicher oder Netz.
//
// Jeder Eintrag (Thema, Aufgabe, Termin, Wunsch) trägt updated_at (Millisekunden): wann er zuletzt geändert wurde.
// Gelöschte Einträge stehen mit Zeitpunkt in deleted. Beim Abgleich gewinnt pro Eintrag die neuere Fassung;
// ein Eintrag, der nach seiner letzten Änderung gelöscht wurde, bleibt gelöscht.

export const COLLECTIONS = ['topics', 'tasks', 'events', 'wishes'];
const KEEP_DELETED_MS = 400 * 86400000; // Löschvermerke gut ein Jahr aufheben

const withoutStamp = (item) => {
  const { updated_at: _ignored, ...content } = item;
  return stableStringify(content);
};

// Nach einer Änderung auf diesem Gerät: geänderte und neue Einträge bekommen den Zeitstempel now,
// verschwundene einen Löschvermerk. prev = Stand vor der Änderung, next = neuer Stand (wird verändert).
export function stampChanges(prev, next, now) {
  // Einstellungen außerhalb der Listen (z. B. die laufende Routine) zählen auch als Änderung.
  let changed = stableStringify(settings(prev || {})) !== stableStringify(settings(next));
  next.deleted = [...(next.deleted || [])];
  for (const kind of COLLECTIONS) {
    const before = new Map((prev?.[kind] || []).map((item) => [item.id, item]));
    for (const item of next[kind] || []) {
      const old = before.get(item.id);
      // Neu ohne Zeitstempel oder inhaltlich geändert → jetzt geändert. (Eingelesene Einträge behalten ihren.)
      if (old ? withoutStamp(old) !== withoutStamp(item) : !item.updated_at) {
        item.updated_at = now;
        changed = true;
      } else if (!old) {
        changed = true;
      }
      // Wieder da (neu angelegt oder eingelesen) → ein alter Löschvermerk mit derselben ID gilt nicht mehr.
      if (!old) next.deleted = next.deleted.filter((d) => d.kind !== kind || d.id !== item.id);
      before.delete(item.id);
    }
    for (const id of before.keys()) {
      next.deleted.push({ kind, id, at: now });
      changed = true;
    }
  }
  next.deleted = next.deleted.filter((d) => d.at > now - KEEP_DELETED_MS);
  if (changed) next.modified_at = now;
  return changed;
}

// Zwei Stände zusammenführen (Reihenfolge egal). Ergebnis ist ein neuer Stand.
export function mergeData(a, b) {
  const newer = (b.modified_at || 0) > (a.modified_at || 0) ? b : a;
  const result = { ...a, ...b, ...newer };

  const deleted = new Map();
  for (const d of [...(a.deleted || []), ...(b.deleted || [])]) {
    const key = `${d.kind}:${d.id}`;
    if (!deleted.has(key) || deleted.get(key).at < d.at) deleted.set(key, d);
  }
  result.deleted = [...deleted.values()].sort((x, y) => x.at - y.at);

  for (const kind of COLLECTIONS) {
    const items = new Map();
    for (const item of [...(a[kind] || []), ...(b[kind] || [])]) {
      const current = items.get(item.id);
      if (!current || (item.updated_at || 0) > (current.updated_at || 0)) items.set(item.id, item);
    }
    result[kind] = [...items.values()]
      .filter((item) => {
        const gone = deleted.get(`${kind}:${item.id}`);
        return !gone || (item.updated_at || 0) > gone.at;
      })
      .sort((x, y) => x.id - y.id);
  }

  // Verlauf: Vereinigung ohne doppelte Einträge, zeitlich sortiert.
  const log = new Map();
  for (const entry of [...(a.log || []), ...(b.log || [])]) log.set(JSON.stringify(entry), entry);
  result.log = [...log.values()].sort((x, y) => String(x.at).localeCompare(String(y.at)));

  result.nextId = Math.max(a.nextId || 1, b.nextId || 1);
  result.modified_at = Math.max(a.modified_at || 0, b.modified_at || 0);
  // Laufende Routine: vom zuletzt geänderten Stand, aber nur, wenn es die Routine noch gibt.
  if (result.activeRoutine && !result.tasks.some((t) => t.id === result.activeRoutine.id)) result.activeRoutine = null;
  return result;
}

// Alles außer den Listen, dem Verlauf und den Löschvermerken (z. B. laufende Routine, nextId).
const settings = (d) => {
  const { topics: _t, tasks: _a, events: _e, wishes: _w, log: _l, deleted: _d, modified_at: _m, ...others } = d;
  return others;
};

// JSON mit sortierten Schlüsseln – gleiche Daten ergeben immer denselben Text.
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// Inhaltlich gleich? (für „muss hochgeladen werden?“)
export const sameData = (a, b) => stableStringify(a) === stableStringify(b);
