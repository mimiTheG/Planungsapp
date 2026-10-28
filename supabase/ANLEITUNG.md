# Cloud-Sync einrichten (einmalig, ca. 10 Minuten)

Die Planungsapp speichert deine Daten **verschlüsselt** bei Supabase (kostenloser Tarif reicht).
Verschlüsselt wird auf deinem Handy mit deinem **Sync-Passwort** – Supabase sieht nur unlesbare Daten.

## 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) → **Start your project** → mit GitHub oder E-Mail anmelden.
2. **New project**:
   - Name: z. B. `planungsapp`
   - Database Password: irgendein langes Passwort (brauchst du für die App nicht, aber gut aufheben)
   - Region: **Central EU (Frankfurt)**
   - Plan: **Free**
3. **Create new project** – kurz warten, bis das Projekt bereit ist.

## 2. Tabelle anlegen

1. Links **SQL Editor** → **New query**.
2. Den kompletten Inhalt von [`setup.sql`](setup.sql) hineinkopieren.
3. **Run** – unten sollte „Success. No rows returned“ stehen.

## 3. Projekt-URL und Schlüssel kopieren

Links **Project Settings** (Zahnrad) → **API** (bzw. **Data API** / **API Keys**):

- **Project URL**, z. B. `https://abcdefgh.supabase.co`
- **anon public** key (oder bei neuen Projekten der **publishable key**, beginnt mit `sb_publishable_`)

Beide dürfen öffentlich sein – sie erlauben nur, was die Zugriffsregeln aus Schritt 2 zulassen.
**Nicht** den `service_role` / `secret` key nehmen!

## 4. Anmeldung per E-Mail

Links **Authentication** → **Sign In / Providers** → **Email** ist standardmäßig an.
Beim Erstellen des Kontos schickt Supabase eine Bestätigungs-E-Mail; erst nach dem Klick auf den Link
kannst du dich in der App anmelden. (Wer das nicht will: dort **Confirm email** ausschalten.)

## 5. In der App

**Themen**-Seite (🎨) → **Cloud-Sync**:

1. Projekt-URL und Schlüssel eintragen → **Verbinden**
   (entfällt, wenn sie schon fest in `js/cloud-config.js` stehen).
2. E-Mail + Konto-Passwort → **Konto erstellen** (erstes Mal) bzw. **Anmelden**.
3. **Sync-Passwort** festlegen (mind. 8 Zeichen) → **Verschlüsseln & hochladen**.

Auf jedem weiteren Gerät: anmelden, dasselbe Sync-Passwort eingeben → **Entsperren**.
Die Daten dieses Geräts werden dabei durch die aus der Cloud ersetzt.

## Gut zu wissen

- **Sync-Passwort vergessen = Cloud-Daten verloren.** Niemand kann es zurücksetzen. Die Daten auf dem Gerät
  bleiben aber; dann abmelden, in Supabase unter **Table Editor → vaults** die Zeile löschen und neu einrichten.
- Abgeglichen wird automatisch: kurz nach jeder Änderung, beim Öffnen der App und wenn wieder Internet da ist.
- Wird derselbe Eintrag auf zwei Geräten geändert, gilt die spätere Änderung. Gelöschtes bleibt gelöscht.
- Konto-Passwort und Sync-Passwort sind absichtlich verschieden: Das Konto-Passwort kennt Supabase,
  das Sync-Passwort nur du.
