// Cloud-Sync (cloud.js) gegen einen nachgebauten Supabase-Server: Anmelden, verschlüsselt hochladen,
// zweites Gerät, Änderungen auf beiden Geräten, Löschen, Konflikte, abgelaufene Anmeldung. Ausführen: npm test

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloud } from '../js/cloud.js';
import { createFakeSupabase } from './support/fake-supabase.js';

const CONFIG = { url: 'https://test.supabase.co', key: 'anon-key' };
const memory = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
};
let deviceCounter = 0;

// Ein „Gerät“: eigener Store (eigene Modul-Instanz), eigener Speicher, eigener Cloud-Sync.
async function device(server, { now } = {}) {
  deviceCounter += 1;
  const store = await import(`../js/store.js?device=${deviceCounter}`);
  const storage = memory();
  store.load(storage);
  const cloud = createCloud({ fetch: server.fetch, storage, store, config: CONFIG, iterations: 1000, ...(now ? { now } : {}) });
  store.setLocalChangeListener(() => cloud.markDirty());
  return { store, cloud, storage, titles: () => store.tasks().map((t) => t.title).sort() };
}

async function setUp() {
  const server = createFakeSupabase();
  const a = await device(server);
  a.store.createTask({ title: 'Zahnarzt anrufen' });
  await a.cloud.signUp('mimi@example.org', 'kontopasswort');
  await a.cloud.createVault('mein-sync-passwort');
  const b = await device(server);
  b.store.createTask({ title: 'Beispiel auf neuem Gerät' });
  await b.cloud.signIn('mimi@example.org', 'kontopasswort');
  await b.cloud.unlockVault('mein-sync-passwort');
  return { server, a, b };
}

describe('Konto', () => {
  test('registrieren, anmelden, Fehlermeldungen auf Deutsch', async () => {
    const server = createFakeSupabase();
    const d = await device(server);
    assert.equal(d.cloud.status().phase, 'setup');
    await assert.rejects(d.cloud.signUp('a@b.de', '123'), /zu kurz/);
    assert.equal(await d.cloud.signUp('a@b.de', 'passwort1'), 'signed-in');
    assert.equal(d.cloud.status().phase, 'locked', 'angemeldet, aber noch ohne Sync-Passwort');
    await assert.rejects(d.cloud.signUp('a@b.de', 'passwort1'), /schon ein Konto/);
    await assert.rejects(d.cloud.signIn('a@b.de', 'falsch'), /E-Mail oder Passwort falsch/);
  });

  test('mit E-Mail-Bestätigung: erst bestätigen, dann anmelden', async () => {
    const server = createFakeSupabase({ confirmEmail: true });
    const d = await device(server);
    assert.equal(await d.cloud.signUp('a@b.de', 'passwort1'), 'confirm-email');
    await assert.rejects(d.cloud.signIn('a@b.de', 'passwort1'), /E-Mail bestätigen/);
    server.confirm('a@b.de');
    await d.cloud.signIn('a@b.de', 'passwort1');
    assert.equal(d.cloud.status().phase, 'locked');
  });

  test('ohne Verbindungsdaten: aus; Projekt-URL und Schlüssel lassen sich eintragen', async () => {
    const server = createFakeSupabase();
    const store = await import('../js/store.js?device=ohne');
    store.load(memory());
    const cloud = createCloud({ fetch: server.fetch, storage: memory(), store, config: { url: '', key: '' } });
    assert.equal(cloud.status().phase, 'off');
    assert.throws(() => cloud.setConnection('test.supabase.co', 'x'), /https/);
    assert.throws(() => cloud.setConnection('https://test.supabase.co', ' '), /Schlüssel/);
    cloud.setConnection('https://test.supabase.co/', 'anon-key');
    assert.equal(cloud.status().phase, 'setup');
    await cloud.signUp('x@y.de', 'passwort1');
    assert.equal(server.requests.at(-1).path, '/auth/v1/signup', 'abschließender Schrägstrich der URL entfernt');
  });

  test('Netzwerkfehler → verständliche Meldung', async () => {
    const d = await device({ fetch: async () => { throw new TypeError('Failed to fetch'); } });
    await assert.rejects(d.cloud.signIn('a@b.de', 'x'), /Keine Verbindung/);
  });
});

describe('Verschlüsselt in der Cloud', () => {
  test('in der Cloud steht nichts Lesbares – weder Titel noch Passwort', async () => {
    const { server } = await setUp();
    const row = [...server.vaults.values()][0];
    const sent = server.requests.map((r) => r.body).join('\n');
    assert.doesNotMatch(JSON.stringify(row), /Zahnarzt/);
    assert.doesNotMatch(sent, /Zahnarzt|mein-sync-passwort/);
    assert.deepEqual(Object.keys(row).sort(), ['data', 'iv', 'salt', 'user_id', 'version']);
  });

  test('Sync-Passwort mind. 8 Zeichen', async () => {
    const server = createFakeSupabase();
    const d = await device(server);
    await d.cloud.signUp('a@b.de', 'passwort1');
    await assert.rejects(d.cloud.createVault('kurz'), /mindestens 8/);
  });

  test('zweites Gerät: falsches Sync-Passwort → Fehler, nichts ersetzt; richtiges → Daten der Cloud', async () => {
    const server = createFakeSupabase();
    const a = await device(server);
    a.store.createTask({ title: 'Zahnarzt anrufen' });
    await a.cloud.signUp('mimi@example.org', 'kontopasswort');
    await a.cloud.createVault('mein-sync-passwort');
    const b = await device(server);
    b.store.createTask({ title: 'nur auf B' });
    await b.cloud.signIn('mimi@example.org', 'kontopasswort');
    assert.equal(await b.cloud.hasVault(), true);
    await assert.rejects(b.cloud.unlockVault('falsch-falsch'), /Falsches Sync-Passwort/);
    assert.deepEqual(b.titles(), ['nur auf B']);
    await b.cloud.unlockVault('mein-sync-passwort');
    assert.deepEqual(b.titles(), ['Zahnarzt anrufen']);
    assert.equal(b.cloud.status().phase, 'on');
  });
});

describe('Abgleich', () => {
  test('Änderung auf A erscheint nach dem Sync auf B', async () => {
    const { a, b } = await setUp();
    a.store.createTask({ title: 'Neu auf A' });
    await a.cloud.sync();
    await b.cloud.sync();
    assert.deepEqual(b.titles(), ['Neu auf A', 'Zahnarzt anrufen']);
  });

  test('beide Geräte offline geändert → nach dem Sync haben beide alles', async () => {
    const { a, b } = await setUp();
    a.store.createTask({ title: 'von A' });
    b.store.createTask({ title: 'von B' });
    await a.cloud.sync();
    await b.cloud.sync();
    await a.cloud.sync();
    assert.deepEqual(a.titles(), ['Zahnarzt anrufen', 'von A', 'von B']);
    assert.deepEqual(b.titles(), a.titles());
  });

  test('derselbe Eintrag auf beiden geändert → die spätere Änderung gewinnt', async () => {
    const { a, b } = await setUp();
    const id = a.store.tasks()[0].id;
    a.store.updateTask(id, { ...a.store.taskById(id), title: 'früher' });
    await new Promise((r) => setTimeout(r, 5));
    b.store.updateTask(id, { ...b.store.taskById(id), title: 'später' });
    await a.cloud.sync();
    await b.cloud.sync();
    await a.cloud.sync();
    assert.deepEqual(a.titles(), ['später']);
    assert.deepEqual(b.titles(), ['später']);
  });

  test('auf A gelöscht → auch auf B weg; erledigt auf B → auf A erledigt', async () => {
    const { a, b } = await setUp();
    const x = a.store.createTask({ title: 'bleibt' });
    const gone = a.store.createTask({ title: 'weg damit' });
    await a.cloud.sync();
    await b.cloud.sync();
    a.store.deleteTask(gone.id);
    b.store.completeTask(x.id);
    await a.cloud.sync();
    await b.cloud.sync();
    await a.cloud.sync();
    assert.deepEqual(b.titles(), ['Zahnarzt anrufen', 'bleibt']);
    assert.equal(a.store.taskById(x.id).status, 'done');
    assert.equal(a.store.history().length, 1);
  });

  test('alle Bereiche werden abgeglichen: Themen, Termine, Wunschliste, Steigerungen', async () => {
    const { a, b } = await setUp();
    const topic = a.store.createTopic({ name: 'Sport', color: '#00aa00' });
    const t = a.store.createTask({ title: 'Laufen', topic_id: topic.id, recurrence: 'rhythm', window_start: '2099-01-05', buffer: 0, repeat: { freq: 'weekly', interval: 1 } });
    a.store.createUpgrade({ upgrade_of: t.id, title: 'lang laufen', upgrade_every: 4 });
    a.store.createEvent({ title: 'Kurs', start_at: '2099-01-05T18:00', end_at: '2099-01-05T19:00' });
    a.store.createWish({ title: 'Museum' });
    await a.cloud.sync();
    await b.cloud.sync();
    assert.ok(b.store.topics().some((x) => x.name === 'Sport'));
    assert.deepEqual(b.store.upgradesOf(t.id).map((u) => u.title), ['lang laufen']);
    assert.equal(b.store.eventsBetween(new Date(2099, 0, 5), new Date(2099, 0, 5)).length, 1);
    assert.deepEqual(b.store.wishes().map((w) => w.title), ['Museum']);
  });

  test('nichts geändert → nichts hochgeladen', async () => {
    const { server, a } = await setUp();
    await a.cloud.sync();
    const before = server.requests.filter((r) => r.method === 'PATCH').length;
    await a.cloud.sync();
    await a.cloud.sync();
    assert.equal(server.requests.filter((r) => r.method === 'PATCH').length, before);
  });

  test('Konflikt: ein anderes Gerät schreibt dazwischen → nochmal holen, zusammenführen, nichts geht verloren', async () => {
    const { server, a, b } = await setUp();
    a.store.createTask({ title: 'von A' });
    b.store.createTask({ title: 'von B' });
    // B schreibt genau zwischen As Lesen und Schreiben.
    const original = server.fetch;
    let sneaked = false;
    const fetch = async (url, init) => {
      if (init?.method === 'PATCH' && !sneaked) {
        sneaked = true;
        await b.cloud.sync();
      }
      return original(url, init);
    };
    const racer = createCloud({ fetch, storage: a.storage, store: a.store, config: CONFIG, iterations: 1000 });
    await racer.sync();
    await b.cloud.sync();
    assert.deepEqual(a.titles(), ['Zahnarzt anrufen', 'von A', 'von B']);
    assert.deepEqual(b.titles(), a.titles());
  });

  test('Änderungen melden sich selbst: nach kurzer Zeit wird automatisch abgeglichen', async () => {
    const { a, b } = await setUp();
    a.store.createTask({ title: 'automatisch' });
    assert.equal(a.cloud.status().phase, 'on');
    await new Promise((r) => setTimeout(r, 2300));
    await b.cloud.sync();
    assert.ok(b.titles().includes('automatisch'));
  });

  test('abgelaufene Anmeldung wird mit dem Erneuerungs-Token verlängert', async () => {
    let clock = Date.now();
    const server = createFakeSupabase();
    const a = await device(server, { now: () => clock });
    await a.cloud.signUp('a@b.de', 'passwort1');
    await a.cloud.createVault('sync-passwort');
    clock += 2 * 3600 * 1000;
    server.expireTokens();
    a.store.createTask({ title: 'nach einer Weile' });
    assert.equal(await a.cloud.sync(), true);
    assert.ok(server.requests.some((r) => r.path.includes('grant_type=refresh_token')));
  });

  test('Abmelden: Daten bleiben auf dem Gerät, Abgleich hört auf', async () => {
    const { a } = await setUp();
    a.cloud.disconnect();
    assert.equal(a.cloud.status().phase, 'setup');
    assert.deepEqual(a.titles(), ['Zahnarzt anrufen']);
    assert.equal(await a.cloud.sync(), false);
  });

  test('nach einem Neustart der App: Schlüssel und Anmeldung bleiben gemerkt', async () => {
    const { server, a } = await setUp();
    const again = createCloud({ fetch: server.fetch, storage: a.storage, store: a.store, config: CONFIG, iterations: 1000 });
    assert.equal(again.status().phase, 'on');
    a.store.createTask({ title: 'nach Neustart' });
    assert.equal(await again.sync(), true);
  });

  test('Fehler beim Abgleich steht im Status', async () => {
    const { a } = await setUp();
    const broken = createCloud({ fetch: async () => { throw new TypeError('offline'); }, storage: a.storage, store: a.store, config: CONFIG });
    await assert.rejects(broken.sync(), /Keine Verbindung/);
    assert.match(broken.status().error, /Keine Verbindung/);
  });
});

describe('Sonderfälle', () => {
  test('zwei Geräte richten gleichzeitig ein → das zweite bekommt einen verständlichen Hinweis', async () => {
    const server = createFakeSupabase();
    const a = await device(server);
    const b = await device(server);
    await a.cloud.signUp('m@x.de', 'passwort1');
    await b.cloud.signIn('m@x.de', 'passwort1');
    await a.cloud.createVault('sync-passwort');
    await assert.rejects(b.cloud.createVault('anderes-passwort'), /schon Daten/);
  });

  test('Anmeldung abgelaufen und Erneuerung abgelehnt → neu anmelden nötig', async () => {
    let clock = Date.now();
    const server = createFakeSupabase();
    const a = await device(server, { now: () => clock });
    await a.cloud.signUp('a@b.de', 'passwort1');
    await a.cloud.createVault('sync-passwort');
    clock += 2 * 3600 * 1000;
    server.revokeAll();
    await assert.rejects(a.cloud.sync(), /neu anmelden/);
    assert.equal(a.cloud.status().phase, 'setup');
  });

  test('„Alles löschen“ auf A löscht auch auf B', async () => {
    const { a, b } = await setUp();
    a.store.clearAll();
    a.store.createTask({ title: 'Neuanfang' });
    await a.cloud.sync();
    await b.cloud.sync();
    assert.deepEqual(b.titles(), ['Neuanfang']);
  });
});
