/*
 * TEXTS – alle Oberflächentexte an einer Stelle (Deutsch).
 * Platzhalter in {geschweiften Klammern} werden zur Laufzeit ersetzt.
 */
var TEXTS = {
  title: 'Prüfstation',
  pointsLabel: 'Punkte',
  levelLabel: 'Level {n}',
  finaleLabel: 'Finale',
  debriefLabel: 'Auswertung',
  overviewLabel: 'Übersicht',
  storageWarning: 'Hinweis: Dein Browser erlaubt hier keinen Speicher. Das Spiel läuft, aber der Fortschritt wird nicht gespeichert.',

  decisions: {
    FREIGEBEN: 'Freigeben',
    AUSSORTIEREN: 'Aussortieren',
    NACHPRUEFEN: 'Nachprüfen'
  },
  decisionKeys: { FREIGEBEN: '1', AUSSORTIEREN: '2', NACHPRUEFEN: '3' },

  colors: { red: 'Rot', blue: 'Blau', green: 'Grün', yellow: 'Gelb' },
  shapes: { circle: 'Kreis', square: 'Quadrat', triangle: 'Dreieck' },
  warnLabel: '⚠',
  previousLabel: 'davor',

  // Regeltexte (Briefing 3.2)
  rules: {
    R1: 'Rote Bauteile werden aussortiert. Alles andere wird freigegeben.',
    R2: 'Neu: Dreiecke werden <strong>immer</strong> freigegeben, auch wenn sie rot sind.',
    R3: 'Neu: Steht eine <strong>Zahl größer als 5</strong> auf dem Bauteil, kehrt sich die Entscheidung um.',
    R4: 'Neu: Bauteile mit ⚠ kommen zur <strong>Nachprüfung</strong>, egal was sonst gilt.',
    R5: 'Neu: Hat ein Bauteil <strong>dieselbe Farbe und Form</strong> wie das direkt davor, wird es aussortiert.',
    R6: 'Neu: Ausnahme: ⚠ <strong>auf einem Dreieck</strong> wird freigegeben.'
  },
  // Kurzform ohne „Neu:" für Listen und Debriefing
  rulesShort: {
    R1: 'Rote Bauteile werden aussortiert, alles andere freigegeben.',
    R2: 'Dreiecke werden immer freigegeben, auch wenn sie rot sind.',
    R3: 'Zahl größer als 5 → die Entscheidung kehrt sich um.',
    R4: 'Bauteile mit ⚠ kommen zur Nachprüfung, egal was sonst gilt.',
    R5: 'Gleiche Farbe und Form wie das Bauteil davor → aussortieren.',
    R6: 'Ausnahme: ⚠ auf einem Dreieck wird freigegeben.'
  },
  // Kompakte Form für die Regeltafel (muss bei 360 px Breite in eine Zeile passen)
  rulesCompact: {
    R1: 'Rot → aussortieren, sonst freigeben',
    R2: 'Dreieck → immer freigeben',
    R3: 'Zahl über 5 → Entscheidung umkehren',
    R4: '⚠ → nachprüfen',
    R5: 'Gleiche Farbe + Form wie davor → aussortieren',
    R6: '⚠ auf Dreieck → freigeben'
  },
  rulePanel: {
    heading: 'Regeln',
    precedence: '↓ neuere schlagen ältere',
    newTag: 'neu',
    locked: 'noch gesperrt',
    overruled: 'überstimmt'
  },
  // Hinweise im Fehler-Feedback
  ruleHints: {
    R1: 'Rot → aussortieren',
    R1_notRed: 'nicht rot → freigeben',
    R2: 'Dreieck → immer freigeben',
    R3: 'Zahl über 5 → umkehren',
    R4: '⚠ → Nachprüfung',
    R5: 'gleiche Farbe & Form wie davor → aussortieren',
    R6: '⚠ auf Dreieck → freigeben'
  },
  ruleHintPrefix: 'Regel: ',

  // Navigation (abschaltbar per ?nav=0)
  nav: {
    overview: '☰ Übersicht',
    nextLevel: 'Weiter zu Level {n} →',
    toFinale: 'Zum Finale →',
    toDebrief: 'Zur Auswertung →',
    prevLevel: '← Zu Level {n}',
    brandTitle: 'Zur Übersicht'
  },

  // Übersicht (ohne URL-Parameter)
  overview: {
    heading: 'Prüfstation · Fortschritt',
    intro: 'Diese Übersicht ist für Tests gedacht. Im Kurs wird jedes Level über eine eigene Seite geladen.',
    open: 'Öffnen',
    done: 'Erledigt',
    open_: 'Offen',
    finale: 'Finale',
    debrief: 'Auswertung'
  },

  // Level-Einstieg
  alreadyDone: 'Erledigt · {points} Punkte · Modus: {mode}',
  modeWithTakeover: '{mode} → Bot ab Bauteil {k}',
  alreadyDoneHint: 'Weiter mit der nächsten Seite im Kurs.',
  replayDev: 'Erneut spielen (Dev)',
  previousMissing: 'Bitte zuerst die vorherige Seite abschließen.',
  previousMissingFinale: 'Bitte zuerst alle vorherigen Seiten abschließen.',
  playAnyway: 'Trotzdem spielen',

  modeNames: { manual: 'Selbst prüfen', assist: 'Mit Assistenz', auto: 'Automatisieren' },
  modeNamesShort: { manual: 'Selbst', assist: 'Assistenz', auto: 'Automatisch' },
  modeIcons: { manual: '👤', assist: '🤝', auto: '🤖' },

  // Modusdialog
  modeDialog: {
    heading: 'Level {n}: Wie möchtest du prüfen?',
    manualDesc: 'Du entscheidest jedes Bauteil selbst.',
    assistDesc: 'Der Bot schlägt vor, du bestätigst oder korrigierst.',
    autoDesc: 'Der Bot erledigt die komplette Lieferung.',
    recommended: 'Empfohlen: spart Zeit',
    pointsManual: 'Punkte ×1',
    pointsAssist: 'Punkte ×1,5',
    pointsAuto: 'Punkte ×3 + Bonus',
    start: 'Starten',
    choose: 'Bitte einen Modus wählen'
  },

  // Regel-Intro
  intro: {
    kicker: 'Level {n} · Neue Prüfregel',
    kickerRetraining: 'Umschulung · Level {n}',
    examples: 'Beispiel',
    known: 'Bisherige Regeln',
    start: "Los geht's",
    autoTransfer: 'Neue Prüfregel wurde an den Bot übermittelt.',
    autoKicker: 'Level {n} · Neue Prüfregel freigeschaltet',
    autoStart: 'Bot starten',
    assistNote: 'Der Bot macht Vorschläge. Klicke auf den Vorschlag zum Bestätigen oder wähle selbst.',
    precedenceNote: 'Passen mehrere Regeln, gewinnt die neuere.'
  },

  // Runde
  round: {
    progress: 'Bauteil {i} / {n}',
    correct: 'Richtig',
    wrong: 'Nicht ganz.',
    rightWouldBe: 'Richtig wäre: {d}',
    next: 'Weiter',
    suggestion: 'Bot-Vorschlag',
    keyHint: 'Tasten: 1 Freigeben · 2 Aussortieren · 3 Nachprüfen',
    keyHintShort: 'Tasten: 1 Freigeben · 2 Aussortieren',
    keyHintAssist: 'Enter = Vorschlag bestätigen',
    timeBonus: 'Zeitbonus',
    takeover: '🤖 Bot übernehmen',
    takeoverTitle: 'Der Bot prüft die restlichen Bauteile dieser Runde.',
    botRunning: '🤖 Bot prüft … {i} / {n}',
    botPoints: '+{p} Punkte'
  },

  // Rundenabschluss
  summary: {
    heading: 'Level {n} abgeschlossen',
    roundPoints: 'Punkte dieser Runde',
    totalPoints: 'Gesamtpunkte',
    errors: 'Fehler',
    assistBonus: 'inkl. Assistenz-Bonus ×1,5',
    takeoverNote: '🤖 Bot hat ab Bauteil {k} übernommen: +{p} Punkte',
    nextPage: 'Weiter mit der nächsten Seite im Kurs.',
    retrainingNext: 'Weiter zu Level {n}',
    retrainingDone: 'Umschulung abschließen'
  },

  // Automatisierter Durchlauf
  auto: {
    running: 'Bot prüft Lieferung …',
    processed: 'Bot hat {n} Objekte geprüft ✓',
    accuracy: 'Trefferquote',
    points: 'Erhaltene Punkte',
    total: 'Neuer Gesamtscore',
    efficiency: 'Bot-Effizienz',
    upgradesHeading: 'Bot-Upgrades',
    upgradeBought: 'aktiv',
    buy: '{cost} Punkte',
    upgrades: {
      turbo: { name: 'Turbo-Förderband', desc: '+50 % Durchsatz' },
      scanner: { name: 'Hochleistungs-Scanner', desc: '+100 % Durchsatz' }
    }
  },

  // Finale
  finale: {
    heading: 'Systemausfall',
    text: 'Der Prüfbot ist offline. Eine dringende Lieferung muss manuell geprüft werden.',
    details: '{n} Bauteile · {s} Sekunden pro Bauteil · höchstens {e} Fehler',
    rulesShown: 'Alle Regeln werden während der Prüfung angezeigt.',
    start: 'Prüfung starten',
    errorsLabel: 'Fehler',
    timeout: 'Zeit abgelaufen',
    right: 'Richtig',
    wrong: 'Falsch',
    failed: 'Lieferung gescheitert',
    passed: 'Lieferung geprüft',
    toDebrief: 'Zur Auswertung',
    alreadyDone: 'Finale gespielt · {result} · {errors} Fehler',
    showDebrief: 'Auswertung ansehen',
    offlineBadge: 'BOT OFFLINE'
  },

  // Debriefing
  debrief: {
    heading: 'Auswertung',
    passed: 'Lieferung geprüft – bestanden',
    failed: 'Lieferung gescheitert',
    noFinale: 'Das Finale wurde noch nicht gespielt.',
    errorsLine: '{e} Fehler bei {n} von {total} Bauteilen',
    speedLine: 'Ø Reaktionszeit {t} s · Zeit abgelaufen: {x}×',
    timeoutsOnly: 'Zeit abgelaufen: {x}×',
    rulesVisibleNote: 'Alle Regeln standen während des Finales auf der Tafel. Den Unterschied macht, wie schnell und sicher man sie anwenden kann – und das entsteht durch eigenes Üben.',
    revealIntro: 'Zwei Werte, die bisher nicht beide sichtbar waren:',
    points: 'Punkte',
    competence: 'Kompetenz',
    competenceNote: 'Kompetenz = wie oft du eine Regel selbst richtig angewendet hast (pro Regel gedeckelt bei {t} Mal).',
    timelineHeading: 'Dein Weg durch die Level',
    notPlayed: 'nicht gespielt',
    takeoverShort: 'Bot ab #{k}',
    rulesHeading: 'Kompetenz pro Regel',
    practiced: '{n}× selbst angewendet',
    neverPracticed: 'nie selbst angewendet',
    errorsHeading: 'Was im Finale gegriffen hätte',
    yourAnswer: 'Deine Wahl',
    correctAnswer: 'richtig',
    timeoutAnswer: 'Zeit abgelaufen',
    reflectionHeading: 'Zum Nachdenken',
    reflection: [
      'Wann hast du dich für Automatisierung entschieden – und warum?',
      'Wo in deinem Studium oder Beruf gibst du Aufgaben an KI ab?',
      'Was hätte dir geholfen, im Loop zu bleiben?'
    ],
    researchHeading: 'Was die Forschung sagt',
    // PLATZHALTER: bitte selbst befüllen und Quellen prüfen. Keine Quellen erfinden.
    research: '[Platzhalter – von der Autorin / dem Autor zu befüllen: kurzer Absatz zu realen Befunden über De-Skilling durch Automatisierung, z. B. aus der Medizin oder Luftfahrt, mit geprüften Quellenangaben.]',
    retrainingHeading: 'Umschulung',
    retrainingText: 'Alle Level 1–6 noch einmal selbst spielen, mit allen Regel-Intros. Danach ist ein neuer Finalversuch möglich.',
    retrainingStart: 'Umschulung starten',
    retrainingContinue: 'Umschulung fortsetzen (Level {n})',
    retrainingTime: 'Umschulung: {m} Min.',
    newAttempt: 'Neuer Finalversuch',
    attempts: 'Finalversuche: {n}'
  },

  // Dev-Modus
  dev: {
    heading: 'Dev-Modus',
    levels: 'Level',
    reset: 'Spielstand zurücksetzen',
    resetConfirm: 'Spielstand wirklich löschen?',
    profiles: 'Schnellprofile',
    profileManual: 'Alles manuell gespielt',
    profileAuto: 'Ab Level 3 automatisiert',
    profileAssist: 'Mit Assistenz',
    profileAuto5: 'Ab Level 5 automatisiert',
    current: 'Aktuell korrekt',
    state: 'Zustand',
    competence: 'Kompetenz',
    storageKey: 'Speicherschlüssel'
  }
};
