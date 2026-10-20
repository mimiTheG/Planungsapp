// Erklärungen zur Wichtigkeits-Dringlichkeits-Matrix (aus Prioritätsmatrix.xlsx und Gefühlsmatrix.xlsx).
// Die Tabellen sind wie die Excel-Dateien geordnet (erste Zeile/Spalte = sehr wichtig/sofort).
// In der App gilt: 5 = sehr wichtig / sofort … 1 = unwichtig / kein Zeitdruck – daher die Helfer unten.

export const IMPORTANCE_LABELS = ["Sehr wichtig", "Wichtig", "Mittel", "Gering", "Unwichtig"];

export const URGENCY_LABELS = ["Sofort", "Heute/Morgen", "Diese Woche", "Diesen Monat", "Kein Zeitdruck"];

export const TEXTS = {
  sachlich: [
    [
      'Die Aufgabe hat erhebliche Auswirkungen und muss ohne Verzögerung erledigt werden.',
      'Die Aufgabe hat erhebliche Auswirkungen und muss innerhalb von ein bis zwei Tagen abgeschlossen sein.',
      'Die Aufgabe hat erhebliche Auswirkungen und muss im Laufe der Woche erledigt werden.',
      'Die Aufgabe hat erhebliche Auswirkungen, lässt aber ausreichend Zeit für Planung und Vorbereitung.',
      'Die Aufgabe hat erhebliche Auswirkungen, ist jedoch an keine Frist gebunden.',
    ],
    [
      'Die Aufgabe hat deutliche Auswirkungen und erfordert sofortiges Handeln.',
      'Die Aufgabe hat deutliche Auswirkungen und sollte kurzfristig erledigt werden.',
      'Die Aufgabe hat deutliche Auswirkungen und ist für diese Woche einzuplanen.',
      'Die Aufgabe hat deutliche Auswirkungen, die Frist liegt jedoch mehrere Wochen entfernt.',
      'Die Aufgabe hat deutliche Auswirkungen, ein Termin ist nicht festgelegt.',
    ],
    [
      'Die Aufgabe hat begrenzte Auswirkungen, muss aber sofort erledigt werden.',
      'Die Aufgabe hat begrenzte Auswirkungen und ist kurzfristig zu erledigen.',
      'Die Aufgabe hat begrenzte Auswirkungen und wird im regulären Wochenablauf bearbeitet.',
      'Die Aufgabe hat begrenzte Auswirkungen und kann flexibel im Monat eingeplant werden.',
      'Die Aufgabe hat begrenzte Auswirkungen und keine zeitliche Vorgabe.',
    ],
    [
      'Die Aufgabe hat geringe Auswirkungen, wird aber umgehend eingefordert.',
      'Die Aufgabe hat geringe Auswirkungen und soll kurzfristig erledigt werden.',
      'Die Aufgabe hat geringe Auswirkungen und kann im Laufe der Woche nebenbei erledigt werden.',
      'Die Aufgabe hat geringe Auswirkungen und kann bei freier Kapazität erledigt werden.',
      'Die Aufgabe hat geringe Auswirkungen und ist optional.',
    ],
    [
      'Die Aufgabe hat keine nennenswerten Auswirkungen, wird aber sofort eingefordert.',
      'Die Aufgabe hat keine nennenswerten Auswirkungen, soll aber kurzfristig erledigt werden.',
      'Die Aufgabe hat keine nennenswerten Auswirkungen, ihre Notwendigkeit sollte geprüft werden.',
      'Die Aufgabe hat keine nennenswerten Auswirkungen und kann zurückgestellt werden.',
      'Die Aufgabe hat keine nennenswerten Auswirkungen und kann entfallen.',
    ],
  ],
  emotional: [
    [
      'Es brennt lichterloh, und wenn ich jetzt nicht handle, gibt es ernste Folgen.',
      'Mir sitzt etwas Großes im Nacken, das spätestens morgen erledigt sein muss.',
      'Ich weiß, dass viel davon abhängt, und spüre, wie die Woche dafür knapp wird.',
      'Es ist mir sehr wichtig, aber ich habe noch Luft, es gut vorzubereiten.',
      'Es ist eines meiner großen Ziele, das niemand einfordert und das genau deshalb leicht liegen bleibt.',
    ],
    [
      'Es drängt spürbar, und ich will nicht, dass es mir entgleitet.',
      'Ich habe es deutlich auf dem Schirm und möchte es zügig vom Tisch haben.',
      'Es zählt, und ich merke, dass ich mir bald Zeit dafür nehmen sollte.',
      'Es hat Gewicht, setzt mich aber noch nicht unter Druck.',
      'Es wäre gut, es anzugehen, aber es läuft mir nicht davon.',
    ],
    [
      'Es klopft laut an, obwohl es eigentlich nicht so viel bedeutet.',
      'Es nervt ein bisschen, weil es bald fertig sein soll, ist aber kein großes Ding.',
      'Es gehört einfach zum normalen Alltag und wird nebenher abgearbeitet.',
      'Ich kann es entspannt einplanen, wenn sich eine Lücke ergibt.',
      'Es schwebt irgendwo im Hinterkopf, ohne mich wirklich zu beschäftigen.',
    ],
    [
      'Jemand will es sofort, obwohl es mir selbst kaum etwas bringt.',
      'Es fühlt sich wie eine lästige Pflicht an, die ich schnell abhaken will.',
      'Es ist eine Kleinigkeit, die ich ohne viel Nachdenken mitnehme.',
      'Es ist mir ziemlich egal und kann ruhig noch liegen bleiben.',
      'Es wäre ganz nett, aber ich würde es kaum vermissen.',
    ],
    [
      'Es reißt mich aus meinen Gedanken und fühlt sich dringender an, als es ist.',
      'Es zieht Aufmerksamkeit, obwohl ich weiß, dass es eigentlich Zeitverschwendung ist.',
      'Ich frage mich ehrlich, warum das überhaupt auf meiner Liste steht.',
      'Es fühlt sich schon jetzt überflüssig an.',
      'Es ist reiner Ballast, den ich guten Gewissens streichen kann.',
    ],
  ],
};

export const importanceLabel = (value) => IMPORTANCE_LABELS[5 - value];
export const urgencyLabel = (value) => URGENCY_LABELS[5 - value];
export const matrixText = (level, importance, urgency) => TEXTS[level][5 - importance][5 - urgency];
