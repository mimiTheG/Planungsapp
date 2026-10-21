# Planungsapp

Persönlicher Planer fürs Handy: Kalender, Aufgaben, Projekte, Routinen – und „Was mache ich jetzt?“.

Die App ist eine **PWA** (installierbare Web-App): Sie läuft im Browser, lässt sich auf dem Startbildschirm
installieren und funktioniert danach auch **offline**. Es gibt keinen Server und kein Konto – alle Daten liegen
nur auf dem Gerät (Sicherung über *Themen → Datensicherung*).

## Auf dem Android-Handy installieren

1. Die App-Adresse in **Chrome** öffnen (siehe „Veröffentlichen“).
2. Menü **⋮** → **„App installieren“** (oder „Zum Startbildschirm hinzufügen“).
3. Die App startet danach wie jede andere App über ihr Icon.
4. **Langes Drücken auf das App-Icon** zeigt Verknüpfungen: Kalender (Monat), Was mache ich jetzt?, Aufgaben, Routinen.
   Jede lässt sich auch als eigenes Symbol auf den Startbildschirm ziehen.

## Funktionen

**Kalender** (Tag, 3 Tage, Woche, Monat) – die Startseite der App, öffnet in der Monatsansicht
- Termine mit Thema (Farbe), mit Uhrzeit oder **ganztägig** (nur Datum; in Tag/Woche in einer eigenen Zeile oben).
- Beginn und Ende wählt man in einem **Monatskalender** (Tage mit Terminen haben einen Punkt) plus Uhrzeit –
  statt der Drehräder des Handys.
- Einträge im Kalender sind klein und platzsparend: genau in der Themenfarbe, Schrift automatisch hell oder dunkel.
- In der Monatsansicht öffnet Antippen immer den Tag – auch auf einem Termin; von dort öffnet man den Termin.
- Aus Tag, 3 Tage und Woche führt die Zurück-Taste des Handys immer zur Monatsansicht.
- In Tag-/Wochenansicht zeigt ein Strich die aktuelle Uhrzeit.
- In Tag, 3 Tage und Woche **wischt** man nach links zum nächsten und nach rechts zum vorigen Tag bzw. Zeitraum;
  der Kalender folgt dabei dem Finger.
- **+** legt in Tag, 3 Tage und Woche einen Termin am angezeigten Tag an (heute zur nächsten vollen Stunde, sonst 9 Uhr).
- **Termine verschieben:** In Tag, 3 Tage und Woche einen Termin lang drücken und ziehen – hoch/runter ändert die
  Uhrzeit (in 15-Minuten-Schritten), in eine andere Spalte den Tag. Hält man ihn am linken oder rechten Rand fest,
  blättert der Kalender zum vorigen bzw. nächsten Tag. Bei Serien fragt die App,
  ob nur dieser oder alle Termine verschoben werden.
- Termine über Mitternacht erscheinen am Folgetag nur, wenn sie nach **4:30** enden (vorher zählt die Nacht
  noch zum Vortag, z. B. Party 22–2 Uhr).
- Antippen des Monats oben (z. B. „Oktober 2026“) öffnet eine Monats- und Jahresauswahl.
- **Routinen einplanen:** Beim Anlegen „Termin | Routine“ wählen (Titel, Thema und Dauer kommen von der Routine)
  oder bei der Routine auf **📅 Einplanen** tippen. Im Termin startet „▶ …“ die Routine.
- Termine können als **Veranstaltung** markiert und per Haken ein- und ausgeblendet werden.
- **Geburtstage:** Thema **„Geburtstag“** wählen (gibt es immer, lässt sich umbenennen, aber nicht löschen) – dann ist
  der Termin ganztägig, wiederholt sich jedes Jahr an diesem Tag und ist keine Veranstaltung; im Kalender
  mit 🎂. Mit Geburtsjahr steht das Alter dabei („🎂 Anna (36)“). Lassen sich wie Veranstaltungen per Haken ausblenden.
- Termine lassen sich **wiederholen** wie bei Google Kalender: Täglich, Wöchentlich am …, Monatlich am 14. bzw.
  am zweiten Dienstag, Jährlich, Jeden Werktag oder **Benutzerdefiniert** (alle n Tage/Wochen/Monate/Jahre,
  Wochentage wählbar, endet nie / am Datum / nach n Terminen). Wiederkehrende Termine sind mit ↻ markiert.
  Beim Ändern oder Löschen fragt die App: *Dieser Termin*, *Dieser und alle folgenden Termine* oder *Alle Termine* –
  auch bei einem Termin, der schon einmal einzeln geändert wurde (er gehört weiter zu seiner Serie).
- **Deadlines:** Offene Aufgaben mit Deadline stehen **knallrot** im Kalender (⏰, in Tag/Woche mit Uhrzeit) –
  bei regelmäßigen Aufgaben mit Häkchen „Deadline“ der letzte Tag des aktuellen Durchgangs.
  Über **+** und „Aufgabe“ legt man direkt eine Aufgabe mit Deadline am gewählten Tag an.

**Themen** – z. B. „Sport“, „Arbeit“, jeweils mit eigener Farbe; gelten für Aufgaben und Termine.
Überall, wo man ein Thema auswählt, lässt sich mit „+ Neues Thema anlegen“ direkt ein neues erstellen.
Farben wählt man aus einer abgestimmten Palette (Weinrot, Himbeere, Altrosa, Koralle, Pfirsich, Senf, Salbei,
Eukalyptus, Petrol, Taubenblau, Lavendel, Pflaume) oder als **eigene Farbe** mit Reglern für Farbton, Sättigung
und Helligkeit. Es ist immer nur eine Farbauswahl offen.

**Aufgaben, Projekte und Routinen**
- Wichtigkeit und Dringlichkeit jeweils **1–5, wobei 5 = sehr wichtig / sofort** und 1 = unwichtig / kein Zeitdruck –
  getrennt für die **sachliche** und die **emotionale** Ebene. Beim Anlegen zeigt eine Matrix alle Kombinationen
  (je dunkler, desto dringender und wichtiger; Punkte = andere offene Aufgaben). Der **Info-Button (i)** erklärt die
  gewählte Kombination – Texte aus `Prioritätsmatrix.xlsx` (sachlich) und `Gefühlsmatrix.xlsx` (emotional),
  hinterlegt in `js/matrix-texts.js`.
- Unter *Aufgaben → Erledigt* steht alles Erledigte nach Tagen sortiert (auch wiederkehrende Aufgaben, abgeschlossene
  Routinen und die Wunschliste); einmalige Aufgaben lassen sich dort mit ↺ wieder öffnen.
- Beliebig tief verschachtelte Unteraufgaben. Bei „Gehört zu“ sieht man zuerst nur die oberste Ebene und klappt bei
  Bedarf auf. Neue Unteraufgaben übernehmen Wichtigkeit und Dringlichkeit der übergeordneten Aufgabe. Die **Reihenfolge** von Unteraufgaben und Routine-Schritten ändert man
  durch **langes Drücken** auf einen Eintrag und Ziehen nach oben oder unten. Zieht man nach **rechts**, wird der
  Eintrag zur Unteraufgabe des Eintrags darüber; nach **links** rückt er eine Ebene höher (Routine-Schritte bleiben
  dabei in ihrer Routine).
  Kommt man beim Ziehen an den oberen oder unteren Rand, scrollt die Liste mit.
  Der Fortschritt wird farbig angezeigt: von zartem Rosa (wenig erledigt)
  bis Dunkelrot (fertig).
- **Einmalig** (optional mit Zeitraum/Deadline), **regelmäßig** mit Puffer oder **fester Zeitraum** im Jahr.
  Optional eine Uhrzeit („spätestens um“), wenn der Tag als Genauigkeit nicht reicht.
- **Regelmäßig** funktioniert wie ein wiederkehrender Termin: „Erstes Mal am“ plus Täglich, Wöchentlich am …,
  Monatlich am 14. bzw. am zweiten Dienstag, Jährlich, Jeden Werktag oder **Benutzerdefiniert** (alle n Tage/Wochen/
  Monate/Jahre, Wochentage wählbar). Der **Puffer** sagt, wie viele Tage man ab dem Termintag Zeit hat
  (1 = nur an diesem Tag, 3 = am Termintag und an den 2 Tagen danach; früher geht nicht).
  Die Tage stehen fest (Müll alle 2 Wochen am Freitag) – oder man zählt **ab dem Erledigen neu**
  (Friseur 6 Wochen nach dem letzten Mal: erledigt am Do., 5.11. → wieder fällig ab Do., 17.12.).
- Wenn nicht rechtzeitig erledigt: **verfällt** (der nächste Durchgang beginnt, wird als verpasst gezählt) oder
  **täglich erinnern** (bleibt bei „Was mache ich jetzt?“ ganz oben, bis erledigt).
- **Projekt** = freiwillig/kreativ. **Routine** = wiederverwendbare Abfolge von Schritten („Morgenroutine kurz“,
  „Sportroutine“ …). Routinen haben keine Wichtigkeit/Dringlichkeit und kein Fälligkeitsdatum – man trägt sie
  selbst in den Kalender ein. Eine Routine kann eine **Standardstartzeit** haben, die beim Einplanen vorgeschlagen wird.
  Dauern lassen sich in Stunden und Minuten angeben (Anzeige z. B. „1 h 30 min“). In der Übersicht werden Routinen nur angezeigt: abgehakt wird ausschließlich über
  **▶ Start**, geändert nur nach Tippen auf **✎ Bearbeiten** (Schritte hinzufügen, löschen, umsortieren; ⚙ für Name,
  Thema und Löschen der Routine).
  Ändert man das Thema einer Routine, übernehmen alle ihre Schritte das neue Thema.
  Lange Routinen (ab 5 Schritten, Unterschritte zählen mit) zeigen zunächst nur die ersten 3 Einträge – egal ob Schritt
  oder Unterschritt – und lassen
  sich ausklappen.
- **Routine starten:** **▶ Start** öffnet die Checkliste mit allen Schritten und Unterschritten. Die Routine läuft
  dann – wie ein Song bei Spotify – als **Leiste über der unteren Navigation** weiter (Fortschritt, seit wann);
  Antippen öffnet die Checkliste wieder, ✓ schließt ab, × bricht ab. **Abbrechen** setzt die abgehakten Schritte
  zurück, **Später weitermachen** schließt nur die Checkliste. Beim Abschließen werden die Schritte für das
  nächste Mal zurückgesetzt.
- **Oberaufgabe abhaken = alle Unteraufgaben erledigt** (bei Aufgaben, Projekten und Routine-Schritten). Öffnet man
  sie wieder, werden auch die mit abgehakten Unteraufgaben wieder geöffnet.

**Was mache ich jetzt?**
- **Läuft gerade:** Termine und Routinen, die jetzt stattfinden, stehen ganz oben; Routinen kann man dort direkt
  Schritt für Schritt abhaken und abschließen.
  Nicht abgeschlossene Routinen bleiben nach ihrer Zeit stehen und sind als **abgelaufen** markiert. Um **4:30** am
  Folgetag werden alle Routinen zurückgesetzt (Häkchen weg) und verschwinden aus „Jetzt“.
- Bei „Steht gerade an“ stehen unter jeder Aufgabe ihre Unteraufgaben zum direkten Abhaken.
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
  schedule.js          Fälligkeitslogik (regelmäßig, Puffer, Zeitraum, Deadline)
  dates.js             Datumshelfer
  ui.js                DOM-Helfer, Dialog, Hinweise
  now.js               „Was mache ich jetzt?“
  player.js            Leiste der laufenden Routine über der Navigation
  calendar.js          Kalender und Termin-Editor
  tasks.js             Aufgaben-/Routinen-Ansichten, Editor mit Matrix
  more.js              Themen, Datensicherung, Beispieldaten
  matrix-texts.js      Erklärungen zur Wichtigkeits-Dringlichkeits-Matrix
  topic-picker.js      Themenauswahl mit „+ Neues Thema anlegen“
  repeat.js            Wiederkehrende Termine (Berechnung, Texte, Vorschläge)
  repeat-fields.js     Formular „Wiederholen“ und Rückfrage bei Serien
  event-drag.js        Termine im Kalender per langem Drücken verschieben
  reorder.js           Umsortieren per langem Drücken
  samples.js           Beispieldaten
icons/                 App-Icons
tests/                 node:test-Tests
```
