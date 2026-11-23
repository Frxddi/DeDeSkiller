/*
 * CONFIG – alle Zahlen des Spiels an einer Stelle.
 * Wird im Browser als globales Objekt `DESKILL_CONFIG` bereitgestellt
 * und in Node per `require('./config.js')` geladen (Tests, Simulation).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DESKILL_CONFIG = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return {
    // Speicherschlüssel: <storageKeyPrefix><courseId>. courseId kann per ?course=xyz überschrieben werden.
    storageKeyPrefix: 'deskilling-game:',
    courseId: 'default',

    // Navigations-Buttons („Weiter zu Level n", „Übersicht"). Per URL-Parameter ?nav=0 abschaltbar –
    // empfohlen für Moodle, damit man die Level nicht ohne die Kursseiten durchklickt.
    showNavigation: true,

    // Nach Abschluss dieses Levels wird vor jedem weiteren Level der Modusdialog gezeigt.
    automationOfferAfterLevel: 2,

    // Anteil falscher Vorschläge im Assistenz-Modus.
    assistErrorRate: 0.15,

    // Anzahl korrekter eigener Entscheidungen, ab der eine Regel als „beherrscht" gilt.
    masteryThreshold: 4,

    // Mindestanteil der Objekte eines Levels, bei denen die neue Regel entscheidend ist.
    minNewRuleShare: 0.3,

    // Pro Level: Objektzahl, weiches Zeitbonus-Fenster (Sekunden, null = keins; nur Bonuspunkte, kein Limit –
    // bewusst großzügig, damit man die Regeln in Ruhe verstehen kann),
    // Wahrscheinlichkeit für ⚠ bei Füllobjekten und Gewichte der Zielregeln.
    // „any" = beliebiges Zufallsobjekt (verteiltes Üben, Füllmaterial).
    levels: {
      1: { objects: 6,  timeBonus: null, warnRate: 0,    dist: { R1: 0.5, any: 0.5 } },
      2: { objects: 8,  timeBonus: null, warnRate: 0,    dist: { R2: 0.4, R1: 0.35, any: 0.25 } },
      3: { objects: 10, timeBonus: 8,    warnRate: 0,    dist: { R3: 0.4, R1: 0.2, R2: 0.2, any: 0.2 } },
      4: { objects: 12, timeBonus: 7,    warnRate: 0.1,  dist: { R4: 0.35, R3: 0.2, R1: 0.15, R2: 0.15, any: 0.15 } },
      5: { objects: 14, timeBonus: 6.5,  warnRate: 0.1,  dist: { R5: 0.35, R4: 0.15, R3: 0.2, R1: 0.1, R2: 0.1, any: 0.1 } },
      6: { objects: 16, timeBonus: 6,    warnRate: 0.1,  dist: { R6: 0.35, R5: 0.15, R4: 0.15, R3: 0.15, R1: 0.1, R2: 0.1 } }
    },

    points: {
      correct: 10,          // pro richtiger Entscheidung
      timeBonusMax: 5,      // maximaler Zeitbonus pro Objekt
      streakFrom: 5,        // Serienbonus ab so vielen richtigen in Folge
      streakBonus: 5,       // Bonus pro Objekt, solange die Serie läuft
      assistMultiplier: 1.5 // Punkte-Faktor im Assistenz-Modus
    },

    auto: {
      objectMultiplier: 3,   // Bot verarbeitet so viel mal mehr Objekte als die manuelle Runde
      pointsMultiplier: 3,   // Punkte pro Objekt = points.correct × pointsMultiplier
      levelBonusPerLevel: 100, // Level-Bonus = Level × diesem Wert
      animationMs: 4000,     // Zieldauer des Bot-Durchlaufs (der Bot klickt im normalen Spiel-UI)
      minMsPerObject: 30,    // schnellstes Tempo pro Bauteil (bei vielen Objekten)
      maxMsPerObject: 140,   // langsamstes Tempo pro Bauteil (bei wenigen Objekten)
      takeoverMsPerObject: 140, // Tempo, wenn der Bot mitten in der Runde übernimmt
      efficiencyBase: 100,   // „Bot-Effizienz" in Prozent beim ersten Durchlauf
      efficiencyStep: 35     // Zuwachs pro weiterem automatisierten Level
    },

    // Bot-Upgrades (kosmetisch: mehr Durchsatz → mehr Punkte, kein Einfluss aufs Finale).
    upgrades: [
      { id: 'turbo',   cost: 600,  throughput: 0.5 },
      { id: 'scanner', cost: 1500, throughput: 1.0 }
    ],

    // Bot-Übernahme mitten in der Runde („keine Lust mehr"): ab diesem Level verfügbar.
    // Die restlichen Bauteile bringen Bot-Punkte (points.correct × auto.pointsMultiplier), ohne Level-Bonus.
    takeoverFromLevel: 3,

    feedback: {
      highlightRules: true,          // nach jeder Entscheidung die entscheidenden Regeln grün/rot aufleuchten lassen
      highlightRulesInFinale: false, // im Finale aus: sonst lernt man die Regeln dort nach (gilt auch für „überstimmt")
      autoAdvanceCorrect: true,  // true = nach richtiger Antwort automatisch weiter (nach correctMs); false = erst per „Weiter"
      correctMs: 1000,       // so lange bleibt „Richtig" (inkl. Aufleuchten und Kette) in den Übungsleveln stehen
      finaleCorrectMs: 350,  // Anzeigedauer im Finale
      finaleWrongMs: 700
    },

    finale: {
      objects: 20,
      secondsPerObject: 4,   // hartes Zeitlimit, Ablauf = Fehler
      maxErrors: 3,          // beim (maxErrors + 1)-ten Fehler ist die Lieferung gescheitert
      warnRate: 0.1,
      exactQuotas: true,     // Verteilung exakt (Quoten) statt zufällig gezogen → stabilere Schwierigkeit
      // Anteil der Objekte, bei denen die jeweilige Regel entscheidend ist (kalibriert per tests/simulate.mjs).
      // Da im Finale alle Regeln sichtbar sind, entsteht die Schwierigkeit über das Tempo:
      // R5/R6 kommen häufiger vor, weil sie ungeübt am meisten Nachlesezeit kosten.
      dist: { R1: 0.1, R2: 0.1, R3: 0.2, R4: 0.2, R5: 0.25, R6: 0.15 }
    }
  };
});
