// Cloud-Sync mit Ende-zu-Ende-Verschlüsselung über Supabase (nur HTTPS-Aufrufe, keine Bibliothek).
//
// Ablauf:
//   1. Anmelden mit E-Mail + Passwort (Supabase-Konto). Damit weiß Supabase, wem die Daten gehören.
//   2. Sync-Passwort: Daraus entsteht auf dem Gerät der Schlüssel (siehe crypto.js). Supabase bekommt nur
//      verschlüsselte Daten (Tabelle vaults: eine Zeile pro Konto) und kann sie nicht lesen.
//   3. Synchronisieren: Cloud-Stand holen, entschlüsseln, mit dem Stand auf dem Gerät zusammenführen
//      (merge.js), verschlüsselt zurückschreiben. version verhindert, dass sich zwei Geräte überschreiben.
// Der Sync läuft nach Änderungen (kurz verzögert), beim Öffnen der App und wenn wieder Internet da ist.

import { decryptJson, deriveKey, encryptJson, exportKey, importKey, randomSalt } from './crypto.js';
import { mergeData, sameData } from './merge.js';
import { CLOUD } from './cloud-config.js';
import * as appStore from './store.js';

const STATE_KEY = 'planungsapp.cloud';
const AUTH_MESSAGES = [
  [/invalid login credentials/i, 'E-Mail oder Passwort falsch'],
  [/email not confirmed/i, 'Bitte zuerst die E-Mail bestätigen (Link im Postfach), dann anmelden'],
  [/already registered|already been registered/i, 'Für diese E-Mail gibt es schon ein Konto – bitte anmelden'],
  [/password should be at least/i, 'Das Passwort ist zu kurz (mindestens 6 Zeichen)'],
  [/unable to validate email|invalid format/i, 'Die E-Mail-Adresse ist ungültig'],
  [/rate limit/i, 'Zu viele Versuche – bitte kurz warten'],
  [/duplicate key/i, 'In der Cloud gibt es schon Daten – bitte die Seite neu öffnen und mit dem Sync-Passwort entsperren'],
];

export class CloudError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

// deps: { fetch, storage, store, config, now, iterations }
export function createCloud({
  fetch: fetchFn, storage, store = appStore, config = CLOUD, now = () => Date.now(), iterations,
} = {}) {
  let state = read();
  let key = null;
  let running = null;
  let again = false;
  let timer = null;
  const listeners = new Set();

  function read() {
    try {
      return JSON.parse(storage?.getItem(STATE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function write(changes) {
    state = { ...state, ...changes };
    storage?.setItem(STATE_KEY, JSON.stringify(state));
    for (const fn of listeners) fn(status());
  }

  const url = () => (config.url || state.url || '').replace(/\/+$/, '');
  const apiKey = () => config.key || state.apiKey || '';

  async function request(path, { method = 'GET', body, auth = true, prefer } = {}) {
    const headers = { apikey: apiKey(), 'content-type': 'application/json' };
    if (auth) headers.authorization = `Bearer ${state.accessToken}`;
    if (prefer) headers.prefer = prefer;
    let response;
    try {
      response = await fetchFn(`${url()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new CloudError('Keine Verbindung zur Cloud – es wird später nochmal versucht');
    }
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!response.ok) {
      const raw = json?.msg || json?.error_description || json?.message || json?.error || `Fehler ${response.status}`;
      const known = AUTH_MESSAGES.find(([pattern]) => pattern.test(raw));
      throw new CloudError(known ? known[1] : `Cloud: ${raw}`, response.status);
    }
    return json;
  }

  function keepSession(json) {
    if (!json?.access_token) return false;
    write({
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: now() + (json.expires_in || 3600) * 1000,
      userId: json.user?.id || state.userId,
      email: json.user?.email || state.email,
    });
    return true;
  }

  async function session() {
    if (!state.refreshToken) throw new CloudError('Bitte bei der Cloud anmelden');
    if (state.accessToken && state.expiresAt - 60000 > now()) return;
    try {
      keepSession(await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', auth: false, body: { refresh_token: state.refreshToken },
      }));
    } catch (err) {
      if (err.status >= 400 && err.status < 500) {
        write({ accessToken: null, refreshToken: null, expiresAt: 0 });
        throw new CloudError('Die Anmeldung ist abgelaufen – bitte neu anmelden');
      }
      throw err;
    }
  }

  async function loadKey() {
    if (!key && state.key) key = await importKey(state.key);
    if (!key) throw new CloudError('Bitte das Sync-Passwort eingeben');
    return key;
  }

  // Daten aus der Cloud übernommen → Ansicht neu zeichnen (app.js hört darauf).
  const remoteChanged = () => {
    if (typeof Event === 'function') globalThis.dispatchEvent?.(new Event('planungsapp-remote'));
  };

  const rowPath = () => `/rest/v1/vaults?user_id=eq.${encodeURIComponent(state.userId)}`;

  async function fetchRow() {
    await session();
    const rows = await request(`${rowPath()}&select=salt,iv,data,version`);
    return rows?.[0] || null;
  }

  async function upload(version) {
    const sealed = await encryptJson(key, store.snapshot());
    const rows = await request(`${rowPath()}&version=eq.${version}`, {
      method: 'PATCH', prefer: 'return=representation', body: { ...sealed, version: version + 1, updated_at: new Date(now()).toISOString() },
    });
    return Boolean(rows?.length);
  }

  function status() {
    let phase = 'off';
    if (url() && apiKey()) phase = 'setup';
    if (state.refreshToken) phase = 'locked';
    if (state.refreshToken && state.key) phase = 'on';
    return { phase, email: state.email || null, lastSync: state.lastSync || null, error: state.error || null, busy: Boolean(running) };
  }

  const cloud = {
    status,
    onStatus(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // Verbindung zu Supabase (falls nicht fest in cloud-config.js eingetragen).
    hasFixedConfig: () => Boolean(config.url && config.key),
    setConnection(projectUrl, projectKey) {
      const clean = String(projectUrl || '').trim();
      if (!/^https:\/\/[^/\s]+/.test(clean)) throw new CloudError('Bitte die Projekt-URL angeben (beginnt mit https://)');
      if (!String(projectKey || '').trim()) throw new CloudError('Bitte den Schlüssel (anon / publishable key) angeben');
      write({ url: clean, apiKey: String(projectKey).trim() });
    },

    // Eingetragene Verbindung wieder entfernen (z. B. um ein anderes Projekt einzutragen).
    clearConnection() {
      cloud.disconnect();
      write({ url: null, apiKey: null });
    },

    async signUp(email, password) {
      const json = await request('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
      if (keepSession(json)) return 'signed-in';
      write({ email });
      return 'confirm-email';
    },

    async signIn(email, password) {
      keepSession(await request('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }));
      write({ error: null });
    },

    // Gibt es für das Konto schon verschlüsselte Daten in der Cloud?
    async hasVault() {
      return Boolean(await fetchRow());
    },

    // Erstes Gerät: Sync-Passwort festlegen und die Daten dieses Geräts hochladen.
    async createVault(password) {
      if (String(password).length < 8) throw new CloudError('Das Sync-Passwort braucht mindestens 8 Zeichen');
      await session();
      const salt = randomSalt();
      key = await deriveKey(password, salt, iterations);
      const sealed = await encryptJson(key, store.snapshot());
      await request('/rest/v1/vaults', {
        method: 'POST', prefer: 'return=minimal', body: { user_id: state.userId, salt, ...sealed, version: 1 },
      });
      write({ key: await exportKey(key), version: 1, dirty: false, lastSync: now(), error: null });
    },

    // Weiteres Gerät: mit dem Sync-Passwort entschlüsseln und die Daten aus der Cloud übernehmen
    // (die bisherigen Daten auf diesem Gerät werden ersetzt).
    async unlockVault(password) {
      const row = await fetchRow();
      if (!row) throw new CloudError('In der Cloud sind noch keine Daten');
      const candidate = await deriveKey(password, row.salt, iterations);
      const remote = await decryptJson(candidate, row); // wirft bei falschem Passwort
      key = candidate;
      store.replaceData(remote);
      remoteChanged();
      write({ key: await exportKey(key), version: row.version, dirty: false, lastSync: now(), error: null });
    },

    // Abmelden: Die Daten bleiben auf dem Gerät, nur der Abgleich hört auf.
    disconnect() {
      key = null;
      clearTimeout(timer);
      write({ accessToken: null, refreshToken: null, expiresAt: 0, userId: null, key: null, version: null, lastSync: null, error: null, dirty: false });
    },

    // Nach einer Änderung auf dem Gerät aufrufen.
    markDirty() {
      if (status().phase !== 'on') return;
      write({ dirty: true });
      cloud.schedule();
    },

    schedule(delay = 2000) {
      clearTimeout(timer);
      if (status().phase === 'on') timer = setTimeout(() => cloud.sync().catch(() => {}), delay);
    },

    // Abgleichen. Läuft schon einer, wird danach noch einmal abgeglichen.
    sync() {
      if (status().phase !== 'on') return Promise.resolve(false);
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        try {
          await loadKey();
          for (let attempt = 0; attempt < 5; attempt++) {
            const row = await fetchRow();
            if (!row) {
              // In der Cloud gelöscht (z. B. neu eingerichtet) → Stand dieses Geräts wieder hochladen.
              const sealed = await encryptJson(key, store.snapshot());
              await request('/rest/v1/vaults', {
                method: 'POST', prefer: 'return=minimal', body: { user_id: state.userId, salt: randomSalt(), ...sealed, version: 1 },
              });
              write({ version: 1, dirty: false });
              break;
            }
            let needsUpload = state.dirty;
            if (row.version !== state.version) {
              const remote = await decryptJson(key, row);
              const local = store.snapshot(); // erst jetzt lesen – nichts geht verloren, was inzwischen geändert wurde
              const merged = mergeData(local, remote);
              if (!sameData(merged, local)) {
                store.replaceData(merged);
                remoteChanged();
              }
              needsUpload = !sameData(store.snapshot(), remote);
            }
            if (!needsUpload) {
              write({ version: row.version });
              break;
            }
            write({ dirty: false });
            if (await upload(row.version)) {
              write({ version: row.version + 1 });
              break;
            }
            write({ dirty: true }); // ein anderes Gerät war schneller → nochmal holen und zusammenführen
          }
          write({ lastSync: now(), error: null });
          return true;
        } catch (err) {
          write({ error: err.message });
          throw err;
        } finally {
          running = null;
          if (again) {
            again = false;
            cloud.schedule(0);
          }
        }
      })();
      return running;
    },
  };
  return cloud;
}

// Die Instanz der App (im Browser).
export const cloud = createCloud({ fetch: globalThis.fetch?.bind(globalThis), storage: globalThis.localStorage });
