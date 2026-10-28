// Verschlüsselung für den Cloud-Sync – nur mit der im Browser eingebauten Web Crypto API.
//
// Aus dem Sync-Passwort und einem zufälligen Salz wird mit PBKDF2 (SHA-256, 600 000 Runden) ein
// AES-256-Schlüssel abgeleitet. Die Daten werden mit AES-GCM verschlüsselt (jedes Mal ein neuer
// Zufallswert iv); GCM erkennt auch jede Veränderung und ein falsches Passwort.
// In der Cloud liegen nur Salz, iv und der verschlüsselte Text – das Passwort verlässt nie das Gerät.

const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class WrongPasswordError extends Error {
  constructor() {
    super('Falsches Sync-Passwort');
  }
}

export function toBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const random = (n) => crypto.getRandomValues(new Uint8Array(n));

export const randomSalt = () => toBase64(random(16));

// Schlüssel aus Passwort + Salz. iterations nur für Tests kleiner wählen.
export async function deriveKey(password, salt, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// Schlüssel zum Merken auf dem Gerät (damit man das Passwort nicht bei jedem Start eingeben muss).
export async function exportKey(key) {
  return toBase64(await crypto.subtle.exportKey('raw', key));
}

export function importKey(text) {
  return crypto.subtle.importKey('raw', fromBase64(text), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function encryptJson(key, value) {
  const iv = random(12);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  return { iv: toBase64(iv), data: toBase64(cipher) };
}

export async function decryptJson(key, { iv, data }) {
  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(data));
  } catch {
    throw new WrongPasswordError();
  }
  return JSON.parse(decoder.decode(plain));
}
