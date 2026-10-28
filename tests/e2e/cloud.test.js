// Klicktests: Cloud-Sync einrichten und zwischen zwei Geräten abgleichen – gegen einen nachgebauten
// Supabase-Server (kein Internet nötig). Ausführen: npm run test:e2e

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, SUPABASE_URL } from './helpers.js';
import { createFakeSupabase } from '../support/fake-supabase.js';

let browser;
before(async () => { browser = await launch(); });
after(async () => {
  await browser.close();
  assert.deepEqual(browser.errors, [], 'keine Fehler in der Seite');
});

const section = (app) => app.page.locator('.card.cloud');
const fill = async (app, name, value) => section(app).locator(`input[name="${name}"]`).fill(value);
const press = async (app, label) => {
  await section(app).locator(`button:has-text("${label}")`).click();
  await app.page.waitForFunction(() => !document.querySelector('.card.cloud button[disabled]'), null, { timeout: 15000 });
  await app.page.waitForTimeout(300);
};

async function connectAndSignIn(app, { create }) {
  await fill(app, 'url', SUPABASE_URL);
  await fill(app, 'key', 'sb_publishable_test');
  await press(app, 'Verbinden');
  await fill(app, 'email', 'mimi@example.org');
  await fill(app, 'password', 'kontopasswort');
  await press(app, create ? 'Konto erstellen' : 'Anmelden');
}

describe('Cloud-Sync', () => {
  test('erstes Gerät einrichten, zweites Gerät entsperren, Änderungen gehen hin und her', async () => {
    const server = createFakeSupabase();

    // Gerät A: eigene Aufgabe, verbinden, Konto erstellen, Sync-Passwort festlegen.
    const a = await browser.open('mehr', { supabase: server, data: (s) => s.createTask({ title: 'Zahnarzt anrufen' }) });
    assert.match(await section(a).textContent(), /verschlüsselt in der Cloud/);
    await connectAndSignIn(a, { create: true });
    await section(a).locator('input[name="sync"]').waitFor();
    assert.match(await section(a).textContent(), /Sync-Passwort festlegen/);
    await fill(a, 'sync', 'gaensebluemchen');
    await fill(a, 'sync2', 'gaensebluemchen-tippfehler');
    await press(a, 'Verschlüsseln & hochladen');
    assert.equal(server.vaults.size, 0, 'verschiedene Passwörter → nichts hochgeladen');
    await fill(a, 'sync2', 'gaensebluemchen');
    await press(a, 'Verschlüsseln & hochladen');
    assert.match(await section(a).textContent(), /Verschlüsselter Sync ist an/);
    const row = [...server.vaults.values()][0];
    assert.doesNotMatch(JSON.stringify(row), /Zahnarzt/, 'in der Cloud nur verschlüsselt');
    assert.doesNotMatch(server.requests.map((r) => r.body).join(''), /gaensebluemchen|Zahnarzt/);

    // Gerät B (mit Beispieldaten): anmelden, falsches und richtiges Sync-Passwort.
    const b = await browser.open('mehr', { supabase: server });
    await connectAndSignIn(b, { create: false });
    await section(b).locator('input[name="sync"]').waitFor();
    assert.match(await section(b).textContent(), /werden dabei durch die aus der Cloud ersetzt/);
    await fill(b, 'sync', 'falsches-passwort');
    await press(b, 'Entsperren');
    assert.match(await b.page.locator('#toast').textContent(), /Falsches Sync-Passwort/);
    await fill(b, 'sync', 'gaensebluemchen');
    await press(b, 'Entsperren');
    assert.deepEqual(await b.store((s) => s.tasks().map((t) => t.title)), ['Zahnarzt anrufen']);

    // Änderung auf B → automatisch hochgeladen → auf A „Jetzt abgleichen“.
    await b.store((s) => s.createTask({ title: 'Neu vom Tablet' }));
    await b.page.waitForTimeout(2600);
    await press(a, 'Jetzt abgleichen');
    assert.deepEqual((await a.store((s) => s.tasks().map((t) => t.title))).sort(), ['Neu vom Tablet', 'Zahnarzt anrufen']);

    // Nach dem Neuladen ist der Sync weiterhin an (Sync-Passwort nicht erneut nötig).
    await a.page.reload();
    await a.page.waitForTimeout(300);
    assert.match(await section(a).textContent(), /Verschlüsselter Sync ist an/);

    // Abmelden: Daten bleiben.
    await press(a, 'Abmelden');
    assert.match(await section(a).textContent(), /Konto-Passwort/);
    assert.equal(await a.store((s) => s.tasks().length), 2);
    await a.close();
    await b.close();
  });

  test('Konto mit E-Mail-Bestätigung: Hinweis, danach anmelden', async () => {
    const server = createFakeSupabase({ confirmEmail: true });
    const app = await browser.open('mehr', { supabase: server, data: () => {} });
    await connectAndSignIn(app, { create: true });
    assert.match(await app.page.locator('#toast').textContent(), /E-Mail bestätigen/);
    server.confirm('mimi@example.org');
    await fill(app, 'password', 'kontopasswort');
    await press(app, 'Anmelden');
    await section(app).locator('input[name="sync"]').waitFor();
    await app.close();
  });
});
