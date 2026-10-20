# Planungsapp

Persönlicher Planer fürs Handy: Kalender, Aufgaben, Projekte, Routinen – und „Was mache ich jetzt?“.

Die App ist eine **PWA** (installierbare Web-App): Sie läuft im Browser, lässt sich auf dem Startbildschirm
installieren und funktioniert danach auch **offline**. Es gibt keinen Server und kein Konto – alle Daten liegen
nur auf dem Gerät (Sicherung über *Themen → Datensicherung*).

## Auf dem Android-Handy installieren

1. Die App-Adresse in **Chrome** öffnen (siehe „Veröffentlichen“).
2. Menü **⋮** → **„App installieren“** (oder „Zum Startbildschirm hinzufügen“).
3. Die App startet danach wie jede andere App über ihr Icon.

## Funktionen

**Kalender** (Tag, 3 Tage, Woche, Monat)
- Termine mit Thema (Farbe). Davor und/oder danach kann ein **freier Bereich** (z. B. „Anfahrt“, 30 min)
  oder eine **Routine** (z. B. „Arbeit Morgendliche Aufgaben“) liegen – im Kalender schraffiert.
- Termine können als **Veranstaltung** markiert und per Haken ein- und ausgeblendet werden.

**Themen** – z. B. „Sport“, „Arbeit“, jeweils mit eigener Farbe; gelten für Aufgaben und Termine.

**Aufgaben, Projekte und Routinen**
- Wichtigkeit und Dringlichkeit jeweils 1–5, getrennt für die **sachliche** und die **emotionale** Ebene.
  Beim Anlegen lässt sich die Wichtigkeits-Dringlichkeits-Matrix anzeigen (Tippen auf ein Feld setzt beide Werte;
  Punkte zeigen, wo andere offene Aufgaben liegen).
- Beliebig tief verschachtelte Unteraufgaben.
- **Einmalig** (optional mit Zeitraum/Deadline), **fester Rhythmus** mit Puffer oder **fester Zeitraum** im Jahr.
  Optional eine Uhrzeit („spätestens um“), wenn der Tag als Genauigkeit nicht reicht.
- Rhythmus-Beispiel: alle 7 Tage, Puffer 3 Tage. Erledigt an Tag 1 → wieder fällig Tag 7–9,
  erledigt an Tag 3 → Tag 9–11.
- Wenn nicht rechtzeitig erledigt: **verfällt** (der nächste Durchgang beginnt, wird als verpasst gezählt) oder
  **täglich erinnern** (bleibt bei „Was mache ich jetzt?“ ganz oben, bis erledigt).
- **Projekt** = freiwillig/kreativ. **Routine** = wiederverwendbare Abfolge von Schritten („Morgenroutine kurz“,
  „Sportroutine“ …). Eine Routine lässt sich als Checkliste starten; beim Abschließen werden die Schritte
  für das nächste Mal zurückgesetzt.

**Was mache ich jetzt?**
- Alles, was gerade ansteht, nach Priorität (Wichtigkeit × Dringlichkeit, sachlich oder emotional);
  Überfälliges mit „täglich erinnern“ steht ganz oben.
- „Wollte ich schon länger mal wieder machen“ = Projekte mit Wichtigkeit 1 und Dringlichkeit 1.
- **„Ich kann mich nicht entscheiden“** wählt per Zufall eine offene Aufgabe oder ein Projekt, gewichtet nach
  Priorität (Projekte und To-dos zählen gleich).

## Veröffentlichen (GitHub Pages, kostenlos)

1. Auf GitHub im Repository **Settings → Pages** öffnen.
2. Unter „Build and deployment“: Source **„Deploy from a branch“**, Branch **`main`**, Ordner **`/ (root)`** → **Save**.
3. Nach ein bis zwei Minuten ist die App erreichbar unter `https://<benutzername>.github.io/<repository>/`.
   Der Link steht dann auch oben auf der Pages-Seite.

Updates: Nach einer Änderung lädt die App die neue Version beim Öffnen im Hintergrund und zeigt sie beim
nächsten Start. Wenn Dateien hinzukommen oder wegfallen, in `sw.js` die Liste `FILES` anpassen und `VERSION` erhöhen.

## Lokal starten & testen

```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
npm test                      # Tests für Fälligkeitslogik und Datenhaltung (Node 18+)
```

## Aufbau

```
index.html             Grundgerüst und Navigation
manifest.webmanifest   App-Name, Icons, Farben (für die Installation)
sw.js                  Service Worker (Offline)
css/style.css
js/
  app.js               Einstieg, Navigation
  store.js             Daten auf dem Gerät (localStorage), Anlegen/Ändern/Erledigen, Sicherung
  schedule.js          Fälligkeitslogik (Rhythmus, Puffer, Zeitraum, Deadline)
  dates.js             Datumshelfer
  ui.js                DOM-Helfer, Dialog, Hinweise
  now.js               „Was mache ich jetzt?“
  calendar.js          Kalender und Termin-Editor
  tasks.js             Aufgaben-/Routinen-Ansichten, Editor mit Matrix
  more.js              Themen und Datensicherung
icons/                 App-Icons
tests/                 node:test-Tests
```
