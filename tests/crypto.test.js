// Verschlüsselung für den Cloud-Sync (crypto.js). Ausführen: npm test

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WrongPasswordError, decryptJson, deriveKey, encryptJson, exportKey, fromBase64, importKey, randomSalt, toBase64,
} from '../js/crypto.js';

const FAST = 1000; // weniger Runden, damit die Tests schnell sind (die App nutzt 600 000)

describe('Verschlüsselung', () => {
  test('verschlüsseln und mit demselben Passwort wieder entschlüsseln (auch Umlaute und Emojis)', async () => {
    const salt = randomSalt();
    const key = await deriveKey('Gänseblümchen 🌼', salt, FAST);
    const value = { tasks: [{ title: 'Zahnarzt anrufen 🦷', notes: 'Größe ändern' }] };
    const sealed = await encryptJson(key, value);
    assert.deepEqual(await decryptJson(await deriveKey('Gänseblümchen 🌼', salt, FAST), sealed), value);
  });

  test('der verschlüsselte Text enthält nichts Lesbares', async () => {
    const key = await deriveKey('geheim123', randomSalt(), FAST);
    const sealed = await encryptJson(key, { title: 'Zahnarzt' });
    assert.doesNotMatch(atob(sealed.data), /Zahnarzt/);
    assert.doesNotMatch(sealed.data, /Zahnarzt/);
  });

  test('falsches Passwort oder anderes Salz → „Falsches Sync-Passwort“', async () => {
    const salt = randomSalt();
    const sealed = await encryptJson(await deriveKey('richtig1', salt, FAST), { a: 1 });
    await assert.rejects(decryptJson(await deriveKey('falsch12', salt, FAST), sealed), WrongPasswordError);
    await assert.rejects(decryptJson(await deriveKey('richtig1', randomSalt(), FAST), sealed), /Falsches Sync-Passwort/);
  });

  test('veränderte Daten werden erkannt', async () => {
    const key = await deriveKey('geheim123', randomSalt(), FAST);
    const sealed = await encryptJson(key, { a: 1 });
    const bytes = fromBase64(sealed.data);
    bytes[0] ^= 1;
    await assert.rejects(decryptJson(key, { ...sealed, data: toBase64(bytes) }), WrongPasswordError);
  });

  test('jedes Mal ein neuer Zufallswert (gleiche Daten sehen verschieden aus); Salz ist zufällig', async () => {
    const key = await deriveKey('geheim123', randomSalt(), FAST);
    const a = await encryptJson(key, { a: 1 });
    const b = await encryptJson(key, { a: 1 });
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.data, b.data);
    assert.notEqual(randomSalt(), randomSalt());
    assert.equal(fromBase64(randomSalt()).length, 16);
  });

  test('Schlüssel merken und wieder laden', async () => {
    const key = await deriveKey('geheim123', randomSalt(), FAST);
    const sealed = await encryptJson(key, { a: 1 });
    const again = await importKey(await exportKey(key));
    assert.deepEqual(await decryptJson(again, sealed), { a: 1 });
  });

  test('große Datenmengen', async () => {
    const key = await deriveKey('geheim123', randomSalt(), FAST);
    const value = { tasks: Array.from({ length: 5000 }, (_, i) => ({ id: i, title: `Aufgabe ${i}` })) };
    assert.deepEqual(await decryptJson(key, await encryptJson(key, value)), value);
  });

  test('Base64 hin und zurück', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 256);
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  });
});
