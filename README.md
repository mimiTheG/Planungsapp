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

**Kalender** (Tag, 3 Tage, Woche, Monat) – die Startseite der App, öffnet in der Monatsansicht
- Termine mit Thema (Farbe). Davor und/oder danach kann ein **freier Bereich** (z. B. „Anfahrt“, 30 min)
  oder eine **Routine** (z. B. „Arbeit Morgendliche Aufgaben“) liegen – im Kalender schraffiert.
- Termine können als **Veranstaltung** markiert und per Haken ein- und ausgeblendet werden.
- Termine lassen sich **wiederholen** wie bei Google Kalender: Täglich, Wöchentlich am …, Monatlich am 14. bzw.
  am zweiten Dienstag, Jährlich, Jeden Werktag oder **Benutzerdefiniert** (alle n Tage/Wochen/Monate/Jahre,
  Wochentage wählbar, endet nie / am Datum / nach n Terminen). Wiederkehrende Termine sind mit ↻ markiert.
  Beim Ändern oder Löschen fragt die App: *Dieser Termin*, *Dieser und alle folgenden Termine* oder *Alle Termine*.

**Themen** – z. B. „Sport“, „Arbeit“, jeweils mit eigener Farbe; gelten für Aufgaben und Termine.
Überall, wo man ein Thema auswählt, lässt sich mit „+ Neues Thema anlegen“ direkt ein neues erstellen.

**Aufgaben, Projekte und Routinen**
- Wichtigkeit und Dringlichkeit jeweils **1–5, wobei 5 = sehr wichtig / sofort** und 1 = unwichtig / kein Zeitdruck –
  getrennt für die **sachliche** und die **emotionale** Ebene. Beim Anlegen zeigt eine Matrix alle Kombinationen
  (je dunkler, desto dringender und wichtiger; Punkte = andere offene Aufgaben). Der **Info-Button (i)** erklärt die
  gewählte Kombination – Texte aus `Prioritätsmatrix.xlsx` (sachlich) und `Gefühlsmatrix.xlsx` (emotional),
  hinterlegt in `js/matrix-texts.js`.
- Unter *Aufgaben → Erledigt* steht alles Erledigte nach Tagen sortiert (auch wiederkehrende Aufgaben, abgeschlossene
  Routinen und die Wunschliste); einmalige Aufgaben lassen sich dort mit ↺ wieder öffnen.
- Beliebig tief verschachtelte Unteraufgaben. Der Fortschritt wird farbig angezeigt: von zartem Rosa (wenig erledigt)
  bis Dunkelrot (fertig).
- **Einmalig** (optional mit Zeitraum/Deadline), **fester Rhythmus** mit Puffer oder **fester Zeitraum** im Jahr.
  Optional eine Uhrzeit („spätestens um“), wenn der Tag als Genauigkeit nicht reicht.
- Rhythmus-Beispiel: alle 7 Tage, Puffer 3 Tage. Erledigt an Tag 1 → wieder fällig Tag 7–9,
  erledigt an Tag 3 → Tag 9–11.
- Wenn nicht rechtzeitig erledigt: **verfällt** (der nächste Durchgang beginnt, wird als verpasst gezählt) oder
  **täglich erinnern** (bleibt bei „Was mache ich jetzt?“ ganz oben, bis erledigt).
- **Projekt** = freiwillig/kreativ. **Routine** = wiederverwendbare Abfolge von Schritten („Morgenroutine kurz“,
  „Sportroutine“ …). Routinen haben keine Wichtigkeit/Dringlichkeit und kein Fälligkeitsdatum – man trägt sie
  selbst in den Kalender ein. Eine Routine lässt sich als Checkliste starten; beim Abschließen werden die Schritte
  für das nächste Mal zurückgesetzt.

**Was mache ich jetzt?**
- Alles, was gerade ansteht, nach Priorität (sachliche Wichtigkeit und Dringlichkeit);
  Überfälliges mit „täglich erinnern“ steht ganz oben.
- **„Wollte ich schon länger mal wieder machen“** ist eine eigene Liste ohne Datum und Priorität. Mit ♥ markiert
  man, dass man es gemacht hat – der Eintrag bleibt und rutscht nach hinten (am längsten nicht Gemachtes zuerst).
- **„Ich kann mich nicht entscheiden“** wählt per Zufall eine offene Aufgabe, ein Projekt oder einen Eintrag der
  Wunschliste, gewichtet nach Priorität (Projekte und To-dos zählen gleich).

**Beispieldaten** werden beim allerersten Start angelegt. Unter *Themen → Beispieldaten* lassen sie sich neu laden
oder mit „Alles löschen“ entfernen.

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
  more.js              Themen, Datensicherung, Beispieldaten
  matrix-texts.js      Erklärungen zur Wichtigkeits-Dringlichkeits-Matrix
  topic-picker.js      Themenauswahl mit „+ Neues Thema anlegen“
  samples.js           Beispieldaten
icons/                 App-Icons
tests/                 node:test-Tests
```
