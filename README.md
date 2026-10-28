# Planungsapp

Persönlicher Planer fürs Handy: Kalender, Aufgaben, Projekte, Routinen – und „Was mache ich jetzt?“.

Die App ist eine **PWA** (installierbare Web-App): Sie läuft im Browser, lässt sich auf dem Startbildschirm
installieren und funktioniert danach auch **offline**. Die Daten liegen auf dem Gerät (Sicherung über
*Themen → Datensicherung*) – und auf Wunsch zusätzlich **Ende-zu-Ende-verschlüsselt in der Cloud** (siehe Cloud-Sync).

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
- **Aufgaben einplanen:** In der Aufgabenliste auf 📅 tippen (oder im Aufgaben-Editor „📅 Einplanen“). Es öffnet sich
  ein **Monatskalender mit allen Terminen** (Punkte = Anzahl; vergangene Tage gesperrt). Tag antippen → darunter der
  **Tagesplan** mit den vorhandenen Terminen und den **freien Zeiten** als Knöpfe (Lücken zwischen 6 und 23 Uhr, in die die
  Dauer passt; vorgeschlagen wird die erste ab 8 Uhr). Freie Zeit antippen oder direkt in die Zeitleiste tippen
  (Viertelstunden), Dauer bei Bedarf ändern, **📅 Einplanen** – fertig. Überschneidungen werden angezeigt.
  „Mehr Optionen …“ öffnet den Termin-Editor (z. B. für Wiederholungen). Der Termin bekommt Titel und Thema von der
  Aufgabe, die Dauer aus ihrer Dauer (sonst 1 Stunde).
  Im Termin lässt sie sich direkt abhaken („✓ Erledigt“) oder öffnen; erledigt steht im Kalender „✓“ davor.
  Läuft die eingeplante Zeit gerade, kann man sie unter „Jetzt“ abhaken.
- **Routinen einplanen:** Beim Anlegen „Termin | Routine“ wählen (Titel, Thema und Dauer kommen von der Routine)
  oder bei der Routine auf **📅 Einplanen** tippen (derselbe Kalender wie bei Aufgaben; die Standardstartzeit wird
  vorgeschlagen, wenn sie frei ist). Im Termin startet „▶ …“ die Routine.
- **Veranstaltungen:** Thema **„Veranstaltung“** wählen – solche Termine lassen sich im Kalender per Haken
  „Veranstaltungen“ ein- und ausblenden.
- **Aufgaben** im Kalender (rote Deadlines und anstehende regelmäßige Aufgaben) lassen sich genauso per Haken
  „Aufgaben“ ein- und ausblenden. Eingeplante Aufgaben (📅) sind Termine und bleiben sichtbar.
- **Geburtstage:** Thema **„Geburtstag“** wählen – dann ist der Termin ganztägig, wiederholt sich jedes Jahr an diesem
  Tag und steht im Kalender mit 🎂 (immer sichtbar). Mit Geburtsjahr steht das Alter dabei („🎂 Anna (36)“).
- „Geburtstag“ und „Veranstaltung“ sind feste Themen: Es gibt sie immer, man kann sie umbenennen und umfärben,
  aber nicht löschen.
- Termine lassen sich **wiederholen** wie bei Google Kalender: Täglich, Wöchentlich am …, Monatlich am 14. bzw.
  am zweiten Dienstag, Jährlich, Jeden Werktag oder **Benutzerdefiniert** (alle n Tage/Wochen/Monate/Jahre,
  Wochentage wählbar, endet nie / am Datum / nach n Terminen). Wiederkehrende Termine sind mit ↻ markiert.
  Beim Ändern oder Löschen fragt die App: *Dieser Termin*, *Dieser und alle folgenden Termine* oder *Alle Termine*
  (ändert man die Wiederholung selbst, z. B. „endet am …“, nur die beiden letzten) –
  auch bei einem Termin, der schon einmal einzeln geändert wurde (er gehört weiter zu seiner Serie).
- **Deadlines:** Offene Aufgaben mit Deadline stehen **knallrot** im Kalender (⏰). Mit Uhrzeit („spätestens um“)
  erscheinen sie in Tag/3 Tage/Woche als **Zeitpunkt** (rote Linie mit Fähnchen genau zur Uhrzeit), ohne Uhrzeit oben
  in der Ganztägig-Zeile –
  bei regelmäßigen Aufgaben mit Häkchen „Deadline“ der letzte Tag jedes Durchgangs, auch der künftigen (angenommen,
  man erledigt jeweils pünktlich).
  Über **+** und „Aufgabe“ legt man direkt eine Aufgabe mit Deadline am gewählten Tag an.
- **Anstehende wiederkehrende Aufgaben** (auch aus mehrtägigen Routinen) stehen **einmal** am Termintag ihres
  nächsten Durchgangs in der Ganztägig-Zeile bzw. im Monat – hell in der Themenfarbe mit farbigem Rand links
  (der Puffer verteilt sie nicht über mehrere Tage). Ist der Termintag schon vorbei, der Puffer läuft aber noch,
  oder ist sie überfällig, steht sie heute. Fällt sie auf die rote Deadline, steht nur die.
  **Eingeplant (📅):** Ist sie eingeplant (egal für welchen Tag) und die geplante Zeit noch nicht vorbei, steht sie nur
  als Termin zur geplanten Zeit da, nicht mehr als Aufgabe. Ist die geplante Zeit verstrichen und sie ist nicht
  abgehakt, steht sie wieder als Aufgabe da – genau einmal.
  Antippen öffnet die Aufgabe; nach dem Erledigen erscheint der nächste Durchgang.
- **Termin nachträglich zur Aufgabe machen:** Termin öffnen und oben „Aufgabe“ wählen. Datum und Uhrzeit werden zur
  Deadline, der Termin verschwindet aus dem Kalender. Bei Serien: *dieser* → einmalige Aufgabe, *dieser und folgende*
  bzw. *alle* → regelmäßige Aufgabe mit derselben Wiederholung und Deadline-Häkchen.

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
  Bedarf auf. Neue Unteraufgaben übernehmen Wichtigkeit und Dringlichkeit der übergeordneten Aufgabe. Die **Reihenfolge** von Aufgaben (auch auf der obersten Ebene der Aufgabenliste),
  Unteraufgaben und Routine-Schritten ändert man durch **langes Drücken** auf einen Eintrag und Ziehen nach oben oder
  unten. Zieht man nach **rechts**, wird der
  Eintrag zur Unteraufgabe des Eintrags darüber; nach **links** rückt er eine Ebene höher (Routine-Schritte bleiben
  dabei in ihrer Routine).
  Kommt man beim Ziehen an den oberen oder unteren Rand, scrollt die Liste mit.
  Der Fortschritt wird farbig angezeigt: von zartem Rosa (wenig erledigt)
  bis Dunkelrot (fertig). In der Aufgabenliste steht keine Wichtigkeit/Dringlichkeit (die sieht man im Editor).
- **Einmalig** (optional mit Zeitraum/Deadline), **regelmäßig** mit Puffer oder **fester Zeitraum** im Jahr.
  Optional eine Uhrzeit („spätestens um“), wenn der Tag als Genauigkeit nicht reicht.
  „Ab“, „Deadline“ und „Spätestens um“ lassen sich mit **×** wieder leeren (kein Datum).
- **Regelmäßig:** „Erstes Mal am“ plus direkt **Alle n Tage/Wochen/Monate/Jahre** (bei Wochen Wochentage wählbar,
  bei Monaten am 14. bzw. am zweiten Dienstag) – ohne Vorschlagsliste. Der **Puffer** gilt in beide Richtungen (± Tage):
  0 = nur am Termintag, 1 = einen Tag vorher bis einen Tag nachher, 2 = zwei Tage vorher bis zwei Tage nachher.
  Die Tage stehen fest (Müll alle 2 Wochen am Freitag) – oder man zählt **ab dem Erledigen neu**: Dann gibt es
  keinen festen Wochentag bzw. kein festes Datum, nur „alle n …“ (Friseur alle 6 Wochen: erledigt am Do., 5.11. →
  nächster Termintag Do., 17.12.; alle 4 Wochen, 4 Wochen und 1 Tag nach dem letzten Mal erledigt → wieder fällig
  4 Wochen danach, ± Puffer).
- **Steigerungen:** Zu einer regelmäßigen Aufgabe kann jedes n-te Mal etwas **dazukommen** – z. B. „einkaufen“ mit
  „Pfand wegbringen“ bei jedem 3. Mal. Im Editor der Aufgabe unter „Steigerungen“ anlegen: Titel, jedes … Mal,
  dran in … Durchgängen (1 = der aktuelle), optional Dauer und Notizen.
  Steigerungen **summieren sich**: Fallen mehrere auf denselben Termin (Pfand wegbringen und Großeinkauf), gehört
  alles dazu. In „Jetzt“, der Aufgabenliste, im Kalender und im Verlauf steht dann „einkaufen + Pfand wegbringen +
  Großeinkauf“; Abhaken erledigt den ganzen Durchgang, danach geht es wieder mit der normalen Aufgabe weiter.
- Wenn nicht rechtzeitig erledigt: **verfällt** (der nächste Durchgang beginnt, wird als verpasst gezählt) oder
  **täglich erinnern** (bleibt bei „Was mache ich jetzt?“ ganz oben, bis erledigt).
- **Projekt** = freiwillig/kreativ. **Routine** gibt es in zwei Arten (beim Anlegen „Art der Routine“ wählen):
  - **Eintägig** = wiederverwendbare Abfolge von Schritten, die man am Stück abhakt („Morgenroutine kurz“,
    „Sportroutine“ …) – siehe unten.
  - **Mehrtägig** = Sammlung regelmäßiger Aufgaben mit jeweils eigenem Rhythmus, z. B. „Haushalt“: Müll alle 2 Wochen,
    Bad wöchentlich, Fenster monatlich. Die Aufgaben stehen in der Routine mit Rhythmus und Fälligkeit, werden
    einzeln abgehakt (dann springen sie in den nächsten Durchgang), lassen sich mit 📅 einplanen und erscheinen bei
    Fälligkeit unter „Jetzt“ (Heute fällig/Überfällig/Demnächst). Neue Aufgaben sind dort gleich „Regelmäßig“.
    Ab 5 Aufgaben ist die Routine wie eine eintägige eingeklappt (die ersten drei, „▾ … weitere anzeigen“).
- Eintägige Routinen haben keine Wichtigkeit/Dringlichkeit und kein Fälligkeitsdatum – man trägt sie
  selbst in den Kalender ein. Eine Routine kann eine **Standardstartzeit** haben, die beim Einplanen vorgeschlagen wird.
  Dauern lassen sich in Stunden und Minuten angeben (Anzeige z. B. „1 h 30 min“). In der Übersicht werden Routinen nur angezeigt: abgehakt wird ausschließlich über
  **▶ Start**, geändert nur nach Tippen auf **✎ Bearbeiten** (Schritte hinzufügen, löschen, umsortieren; ⚙ für Name,
  Thema und Löschen der Routine).
  Ändert man das Thema einer Aufgabe, eines Projekts oder einer Routine, übernehmen alle Unteraufgaben bzw. Schritte
  (beliebig tief) das neue Thema.
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
  Nicht abgeschlossene Routinen bleiben nach ihrer Zeit stehen und sind als **abgelaufen** markiert; ab 4:30 am
  Folgetag verschwinden sie aus „Jetzt“. Abgehakte Schritte bleiben abgehakt, bis man die Routine abschließt oder
  abbricht (kein automatisches Zurücksetzen mehr).
- **Eingeplante Aufgaben:** Kommt die geplante Zeit noch, stehen sie nicht unter „Heute fällig“/„Überfällig“/„Weitere“,
  sondern unter **📅 Eingeplant** (früheste zuerst, mit „📅 heute 15:00“, „📅 morgen 9:00“). Während der geplanten Zeit
  stehen sie unter „Läuft gerade“ (mit „✓ Aufgabe erledigt“). Ist die Zeit vorbei und sie sind noch offen, stehen sie
  wieder in ihrem Bereich. Jede Aufgabe steht in „Jetzt“ höchstens einmal.
- Reihenfolge der Aufgaben:
  1. **⚠ Überfällig** – alles, dessen Zeit abgelaufen ist, auch einmalige Aufgaben und Unteraufgaben
     (nach Wichtigkeit × Dringlichkeit, bei Gleichstand am längsten überfällig zuerst).
  2. **📅 Heute fällig** – alles mit Deadline, dessen Zeitraum gerade läuft (ohne „Ab“ gilt: ab sofort), auch
     Unteraufgaben; nach Wichtigkeit × Dringlichkeit, bei Gleichstand nach verbleibender Zeit.
  3. **Weitere Aufgaben** – nach Wichtigkeit × Dringlichkeit (sachlich), höchste zuerst.
- Unter jeder Aufgabe stehen ihre Unteraufgaben zum direkten Abhaken.
- Zeitangaben in passender Einheit: „noch 3 Tage“, „noch 6 Wochen“, „überfällig seit 2 Monaten“, „in 1 Jahr“ –
  am letzten Tag mit Uhrzeit „noch 3 Std.“.
- **„Wollte ich schon länger mal wieder machen“** ist eine eigene Liste ohne Datum und Priorität. Mit ♥ markiert
  man, dass man es gemacht hat – der Eintrag bleibt und rutscht nach hinten (am längsten nicht Gemachtes zuerst).
- **„Ich kann mich nicht entscheiden“** wählt per Zufall eine offene Aufgabe, ein Projekt oder einen Eintrag der
  Wunschliste, gewichtet nach Priorität (Projekte und To-dos zählen gleich).

**Beispieldaten** werden beim allerersten Start angelegt. Unter *Themen → Beispieldaten* lassen sie sich neu laden
oder mit „Alles löschen“ entfernen.

## Am PC

Die App läuft auch im Browser am PC (z. B. Chrome oder Edge: Adresse öffnen, dann in der Adresszeile
„App installieren“ – dann hat sie ein eigenes Fenster). Ab etwa 1000 px Fensterbreite stellt sie sich um:

- **Navigation als Seitenleiste** links statt unten; Inhalt breiter, Kalender in voller Höhe mit lesbarer Schrift.
- **„Was mache ich jetzt?“ in zwei Spalten** (links Überfällig/Heute fällig/Weitere, rechts Wunschliste und Demnächst),
  **Routinen als Kacheln** nebeneinander.
- **Maus:** Termine und Aufgaben einfach ziehen – ohne langes Drücken (Termine: Uhrzeit und Tag; Aufgaben:
  Reihenfolge und – nach rechts/links – Ebene). Zeilen werden beim Darüberfahren hervorgehoben.
- **Tastenkürzel:** `1`–`5` Bereiche (Kalender, Jetzt, Aufgaben, Routinen, Themen), `N` neu (Termin/Aufgabe/Routine je
  nach Bereich), `←`/`→` im Kalender blättern, `T` heute, `Esc` Dialog schließen, `?` Übersicht
  (auch über „⌨ Tastenkürzel“ unten in der Seitenleiste). Beim Tippen in ein Feld greifen sie nicht.
- Daten zwischen Handy und PC: über den Cloud-Sync (unten).

## Cloud-Sync (verschlüsselt)

Unter *Themen → Cloud-Sync* lassen sich die Daten verschlüsselt bei [Supabase](https://supabase.com) speichern und
zwischen Geräten abgleichen. Einrichtung Schritt für Schritt: [supabase/ANLEITUNG.md](supabase/ANLEITUNG.md).

- **Verschlüsselung auf dem Gerät:** Aus dem **Sync-Passwort** entsteht mit PBKDF2 (SHA-256, 600 000 Runden) ein
  AES-256-GCM-Schlüssel (Web Crypto API, keine fremde Bibliothek). Supabase bekommt nur Salz, Zufallswert und
  verschlüsselte Daten – nie das Sync-Passwort und nie lesbare Inhalte. Ein falsches Passwort oder veränderte Daten
  werden erkannt.
- **Konto:** Anmeldung bei Supabase mit E-Mail + Konto-Passwort (getrennt vom Sync-Passwort). Die Tabelle `vaults`
  hat eine Zeile pro Konto; Zugriffsregeln (Row Level Security) erlauben nur die eigene Zeile
  ([supabase/setup.sql](supabase/setup.sql)).
- **Abgleich:** kurz nach jeder Änderung, beim Öffnen der App und wenn wieder Internet da ist (offline geht alles wie
  bisher). Jeder Eintrag merkt sich, wann er zuletzt geändert wurde; pro Eintrag gewinnt die spätere Änderung,
  Gelöschtes bleibt gelöscht (Löschvermerke), der Verlauf wird zusammengeführt. Eine Versionsnummer verhindert,
  dass sich zwei Geräte gegenseitig überschreiben.
- **Neues Gerät:** anmelden, Sync-Passwort eingeben – die Daten dieses Geräts werden durch die aus der Cloud ersetzt.
- **Sync-Passwort vergessen = Cloud-Daten verloren** (niemand kann es zurücksetzen); die Daten auf dem Gerät bleiben.
  Der abgeleitete Schlüssel wird auf dem Gerät gemerkt, damit man das Passwort nicht bei jedem Start eingeben muss –
  dort liegen die Daten ohnehin unverschlüsselt.
- IDs neuer Einträge sind geräteübergreifend eindeutig (Zeit × 1000 + Zufall).
- Projekt-URL und Schlüssel lassen sich fest in `js/cloud-config.js` eintragen oder in der App eingeben.

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
npm test                      # Logik-Tests (Node 18+, ohne Installation), dauern ca. 1 Sekunde
npm install && npx playwright install chromium   # einmalig für die Klicktests
npm run test:e2e              # Klicktests im echten Browser (Handy-Ansicht), dauern ca. 1 Minute
```

**Logik-Tests** (`npm test`, Ordner `tests/`):

| Datei | prüft |
| --- | --- |
| `dates.test.js` | Datum lesen/schreiben, Tage rechnen (auch Zeitumstellung, Schaltjahr), lesbare Zeitspannen |
| `repeat.test.js` | Wiederholungsregeln aller Arten, Ende, gelöschte Einzeltermine, Texte und Vorschläge |
| `schedule.test.js` | Status (offen/fällig/überfällig …), Fenster, Puffer, „ab dem Erledigen“, Zeitraum, verpasste Durchgänge |
| `store.test.js` | Eingabeprüfung, Themen, Wunschliste, Aufgabenbaum, Termine, Steigerungen, Sicherung |
| `now.test.js` | „Was mache ich jetzt?“: welche Aufgabe in welchem Bereich, Reihenfolge nach W×D |
| `free-slots.test.js` | Freie Zeiten zwischen Terminen fürs Einplanen (Lücken, Dauer, heute ab jetzt, ganztägig) |
| `crypto.test.js` | Verschlüsselung: hin und zurück, falsches Passwort, veränderte Daten, nichts Lesbares |
| `merge.test.js` | Abgleich: Zeitstempel, Löschvermerke, spätere Änderung gewinnt, Verlauf |
| `cloud.test.js` | Cloud-Sync mit zwei Geräten gegen einen nachgebauten Supabase-Server (`tests/support/`) |
| `logic.test.js` | einzelne Regeln (ältere Sammlung) |
| `scenarios.test.js` | ganze Abläufe wie auf dem Handy |

**Klicktests** (`npm run test:e2e`, Ordner `tests/e2e/`): Die App läuft in Chromium in Handy-Größe, die Tests tippen
und wischen wie mit dem Finger (auch langes Drücken und Ziehen). Die Uhr steht dabei fest auf Do., 15.10.2026, 12:00,
damit die Tests unabhängig vom heutigen Datum immer gleich laufen. Abgedeckt: Aufgaben anlegen/leeren/erledigen,
Regelmäßig, Steigerungen, Umsortieren, Kalenderansichten, Ein-/Ausblenden, Termine ziehen, Serien, Geburtstage,
Aufgaben einplanen, Routinen, „Was mache ich jetzt?“, die Wunschliste und den Cloud-Sync (Einrichten auf zwei
Geräten gegen den nachgebauten Supabase-Server). `desktop.test.js` prüft die PC-Ansicht (1440 × 900, Maus und
Tastatur): Seitenleiste, Spalten, Tastenkürzel und Ziehen mit der Maus.

`scenarios.test.js` deckt z. B. ab: eine
Serie auf „endet am …“ und wieder zurück auf „endet nie“ stellen, Einzeltermine verschieben und danach „dieser und
alle folgenden“ ändern, Aufgaben von einmalig auf regelmäßig umstellen, verpasste Durchgänge, Sicherung einlesen.
Gefundene Fehler bekommen hier einen eigenen Test, damit sie nicht wiederkommen.

Auf GitHub laufen beide Testarten automatisch bei jedem Pull Request und bei jedem Push auf `main`
(`.github/workflows/tests.yml`, Checks „test“ und „e2e“). Im Pull Request steht dann unten bei den Checks ein grüner Haken oder ein rotes
Kreuz; ein Klick auf „Details“ zeigt, welcher Test fehlschlägt.

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
  sections.js          Bereiche und Reihenfolge von „Was mache ich jetzt?“ (ohne Oberfläche, testbar)
  shortcuts.js         Tastenkürzel am PC
  plan-picker.js       Einplanen: Monat → Tag → freie Zeit zwischen den Terminen
  free-slots.js        Freie Zeiten eines Tages (ohne Oberfläche, testbar)
  player.js            Leiste der laufenden Routine über der Navigation
  calendar.js          Kalender und Termin-Editor
  tasks.js             Aufgaben-/Routinen-Ansichten, Editor mit Matrix
  more.js              Themen, Datensicherung, Beispieldaten
  cloud-view.js        Bereich „Cloud-Sync“ (verbinden, anmelden, Sync-Passwort, Status)
  cloud.js             Cloud-Sync mit Supabase (Anmeldung, Abgleich, Konflikte)
  cloud-config.js      Projekt-URL und Schlüssel von Supabase (optional)
  crypto.js            Verschlüsselung (PBKDF2 + AES-GCM, Web Crypto)
  merge.js             Zusammenführen zweier Stände (Zeitstempel, Löschvermerke)
  matrix-texts.js      Erklärungen zur Wichtigkeits-Dringlichkeits-Matrix
  topic-picker.js      Themenauswahl mit „+ Neues Thema anlegen“
  repeat.js            Wiederkehrende Termine (Berechnung, Texte, Vorschläge)
  repeat-fields.js     Formular „Wiederholen“ und Rückfrage bei Serien
  event-drag.js        Termine im Kalender per langem Drücken verschieben
  reorder.js           Umsortieren per langem Drücken
  samples.js           Beispieldaten
icons/                 App-Icons
supabase/              setup.sql (Tabelle + Zugriffsregeln) und Anleitung für den Cloud-Sync
tests/                 Logik-Tests (node:test), siehe „Lokal starten & testen“
tests/e2e/             Klicktests im Browser (Playwright)
```
