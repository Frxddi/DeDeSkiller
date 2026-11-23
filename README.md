# Prüfstation – Serious Game zu De-Skilling durch KI

Spielbarer Prototyp für einen Moodle-Lernraum. Nach jeder Kursseite wird ein kurzes Minispiel (Qualitätsprüfung von Bauteilen) eingeblendet. Ab Level 3 kann man die Arbeit an einen Bot abgeben. Das bringt mehr Punkte, aber man wendet die neue Regel dann nie selbst an. Die Regeln stehen für alle sichtbar auf einer Regeltafel und werden Level für Level freigeschaltet. Im Finale fällt der Bot aus. Alle Regeln sind sichtbar, aber nur wer sie geübt hat, schafft es im Zeitlimit.

- **Auslieferung:** [`dist/index.html`](dist/index.html) – eine einzige Datei, CSS/JS inline, keine externen Ressourcen, funktioniert per Doppelklick (`file://`) und im iframe.
- **Keine Datenübertragung:** kein Server, kein Tracking. Der Spielstand liegt nur im `localStorage` des Browsers.

---

## Schnellstart

Voraussetzung: Node.js ≥ 18 (nur für Build, Tests und Simulation, nicht zum Spielen).

```bash
node build.mjs            # src/* → dist/index.html
node --test tests/        # Unit-Tests (Regeln, Generator, Kompetenz, Storage-Robustheit)
node tests/simulate.mjs   # Monte-Carlo-Kalibrierung des Finales (10.000 Läufe je Spielertyp)
node serve.mjs            # lokaler Testserver: http://localhost:8080/dist/index.html?dev=1
```

`npm run build`, `npm test` und `npm run simulate` funktionieren ebenfalls.
Unter `http://localhost:8080/demo/moodle-demo.html` liegt eine Demo-Seite mit mehreren iframes wie in Moodle (zeigt den geteilten Spielstand).

### Dateistruktur

```
src/
  config.js      CONFIG – alle Zahlen (UMD: Browser-Global + Node-require)
  texts.js       TEXTS – alle Oberflächentexte
  rules.js       reine Spiellogik ohne DOM: decide(), Generator, Punkte, Kompetenz (UMD)
  state.js       Spielstand: Standardwerte, Validierung, robuster localStorage-Zugriff (UMD)
  game.js        UI, Ablauf, Dev-Modus
  styles.css
  template.html
build.mjs        fügt alles zu dist/index.html zusammen
serve.mjs        Mini-Testserver
dist/index.html  auslieferbare Datei
demo/            Moodle-Simulation mit mehreren iframes
tests/
  rules.test.mjs Tests mit node:test
  index.js       Einstieg, damit `node --test tests/` auch in Node ≥ 21 funktioniert
  simulate.mjs   Kalibrierung
```

`rules.js`, `state.js` und `config.js` sind UMD-Module: im Browser globale Objekte (`DeskillRules`, `DeskillState`, `DESKILL_CONFIG`), in Node per `import`/`require`. Tests und Simulation verwenden damit exakt dieselbe Logik wie das Spiel.

---

## Einbindung in Moodle

1. `dist/index.html` **einmal** in den Kurs hochladen, z. B. als Ressource „Datei" oder in einen Ordner. Die Datei-URL kopieren (Form: `https://<moodle>/pluginfile.php/<id>/mod_resource/content/1/index.html`).
2. Auf jeder Lernseite (Textseite, Buchkapitel, Lektion …) im HTML-Modus des Editors ein iframe einfügen, jeweils mit eigenem Level:

```html
<iframe src="https://<moodle>/pluginfile.php/<id>/mod_resource/content/1/index.html?level=1&course=kurs123&nav=0"
        title="Prüfstation" style="width:100%;height:600px;border:0" loading="lazy"></iframe>
```

| Kursseite | `src`-Parameter |
|---|---|
| Seite 1–6 | `?level=1` … `?level=6` |
| Abschlussseite (Finale) | `?level=7` |
| optional: Auswertung erneut ansehen | `?level=debrief` |
| ohne Parameter | Fortschrittsübersicht (für Tests) |

Statt `?level=3` geht auch `#level=3` (falls ein Proxy Query-Parameter entfernt).

**Empfohlene iframe-Höhe: 600 px.** Alle Spielbildschirme passen ab 360 px Breite in 600 px Höhe. Die Auswertung ist länger und scrollt innerhalb des iframes.

**Wichtig:**
- **Alle iframes müssen dieselbe Datei von derselben Origin laden** (gleiches Protokoll + gleicher Host). `localStorage` ist pro Origin; nur so teilen sich die Seiten den Spielstand. Am einfachsten: überall exakt dieselbe hochgeladene Datei-URL verwenden.
- `course=<id>` trennt Spielstände mehrerer Kurse auf derselben Moodle-Instanz (Speicherschlüssel `deskilling-game:<id>`). Ohne Parameter wird `CONFIG.courseId` (`default`) verwendet.
- Moodle entfernt iframes evtl. aus Editor-Inhalten, wenn die Person nicht die Berechtigung „vertrauenswürdige Inhalte" (`moodle/site:trustcontent`) hat. Dann die Instanz-Administration fragen.
- Ist `localStorage` blockiert (z. B. strenge Datenschutzeinstellungen), läuft das Spiel trotzdem und zeigt einen Hinweis, dass der Fortschritt nicht gespeichert wird.
- Tastatursteuerung funktioniert erst, wenn das iframe den Fokus hat (einmal hineinklicken).
- **`nav=0` für Moodle empfohlen:** Ohne den Parameter zeigt das Spiel Navigations-Buttons („Weiter zu Level n →", „☰ Übersicht", Klick auf „Prüfstation" oben links). Das ist praktisch zum Testen oder für eigenständige Nutzung. Im Kurs würde man damit aber alle Level im ersten iframe durchklicken, ohne die Kursseiten dazwischen zu lesen. Mit `nav=0` steht stattdessen „Weiter mit der nächsten Seite im Kurs". Global abschaltbar über `CONFIG.showNavigation = false`.

### Eigenständig / zum Testen

`dist/index.html` per Doppelklick öffnen. Die Übersicht (ohne Parameter) verlinkt alle Level; nach jedem Level führen Buttons weiter („Weiter zu Level n →", Enter funktioniert auch) oder zurück zur Übersicht.

### Dev-Modus

`?dev=1` an die URL hängen (z. B. `index.html?level=7&dev=1`):
- Levelauswahl, Reset, kompletter Zustand inkl. Kompetenz
- Schnellprofile: „alles manuell gespielt", „ab Level 3 automatisiert", „ab Level 5 automatisiert", „mit Assistenz" (simuliert plausible Durchläufe mit der echten Spiellogik)
- korrekte Entscheidung des aktuellen Bauteils (pinkes Badge)
- bereits erledigte Level und das Finale lassen sich erneut spielen

---

## Anpassen: `CONFIG` und `TEXTS`

- **Zahlen:** [`src/config.js`](src/config.js) – Objekte pro Level, Zeitbonus-Fenster, Verteilung der Zielregeln je Level, Punkte, Assistenz-Fehlerquote (`assistErrorRate`), `masteryThreshold`, `automationOfferAfterLevel`, `takeoverFromLevel`, Bot-Durchsatz/-Tempo/Upgrades (`auto`), Aufleuchten der Regeln (`feedback.highlightRules`, `feedback.highlightRulesInFinale`) und `finale` (Objektzahl, `secondsPerObject`, `maxErrors`, Verteilung).
- **Texte:** [`src/texts.js`](src/texts.js) – sämtliche Oberflächentexte inkl. Regeltexten, Reflexionsfragen und dem **Platzhalter `debrief.research`**. Diesen Absatz bitte selbst mit geprüften Quellen füllen.

Nach Änderungen `node build.mjs` ausführen. Nach Änderungen an Finale-Werten zusätzlich `node tests/simulate.mjs` (Exit-Code ≠ 0, wenn die Akzeptanzkriterien verletzt sind).

---

## Kalibrierung: Simulationsergebnisse

Im Finale sind **alle Regeln sichtbar**. Niemand scheitert also an fehlendem Wissen, sondern am Tempo. Deshalb rechnet die Simulation mit einem **Zeitmodell**: Geübte Regeln wendet man schnell an. Ungeübte muss man bei jedem Bauteil auf der Tafel nachsehen und erst anwenden, wenn sie zutreffen. Das kostet Zeit und erhöht die Fehlerquote. Wird das Zeitlimit überschritten, zählt das als Fehler.

```
Zeit = (T0 + SCAN × #ungeübte Regeln + Σ zutreffende Regeln: geübt ? C_P : C_U) × log-normales Rauschen
T0 = 0,8 s · SCAN = 0,35 s · C_P = 0,3 s · C_U = 1,2 s · σ = 0,3
Fehlerquote = 3 % + 8 % pro zutreffender ungeübter Regel
```

**Alle Modellparameter sind Annahmen.** Die Ergebnisse zeigen, dass das Design unter plausiblen Annahmen funktioniert. Ob die Annahmen stimmen, muss ein Playtest zeigen. Die Parameter stehen oben in [`tests/simulate.mjs`](tests/simulate.mjs).

`node tests/simulate.mjs` · Standardkonfiguration · Finale: 20 Objekte, 4 s pro Objekt, höchstens 3 Fehler, Regelverteilung R1 10 % · R2 10 % · R3 20 % · R4 20 % · R5 25 % · R6 15 % (exakte Quoten), 10.000 Durchläufe je Typ.

| Spielertyp | Genauigkeit pro Objekt | Ø Reaktionszeit | Zeit abgelaufen | Ø Fehler | Bestehensquote |
|---|---:|---:|---:|---:|---:|
| 1 – Alles selbst gespielt (R1–R6 geübt) | 96,7 % | 1,5 s | 0,2 % | 0,66 | **99,7 %** |
| 3 – Ab Level 5 automatisiert (R1–R4 geübt) | 83,8 % | 2,3 s | 11,2 % | 3,24 | **59,2 %** |
| 2 – Ab Level 3 automatisiert (R1–R2 geübt) | 47,5 % | 3,0 s | 46,9 % | 10,50 | **0,0 %** |
| 4 – Zufallsrater | 33,5 % | 0,6 s | 0,0 % | 13,29 | **0,0 %** |

Akzeptanzkriterien: ✔ Typ 1 ≥ 75 % · ✔ Typ 2 ≤ 10 % · ✔ Typ 3 sichtbar dazwischen.

**Sensitivität: Zeitlimit pro Objekt** (Bestehensquote)

| Zeitlimit | Typ 1 (alles selbst) | Typ 3 (ab L5 auto) | Typ 2 (ab L3 auto) |
|---:|---:|---:|---:|
| 2,5 s | 90,3 % | 0,0 % | 0,0 % |
| 3,0 s | 98,4 % | 3,5 % | 0,0 % |
| 3,5 s | 99,5 % | 26,5 % | 0,0 % |
| **4,0 s** | **99,7 %** | **59,2 %** | **0,0 %** |
| 4,5 s | 99,5 % | 80,1 % | 0,5 % |
| 5,0 s | 99,7 % | 88,3 % | 4,0 % |

**Sensitivität: andere Modellannahmen** (4 s, Bestehensquote)

| Annahme | Typ 1 | Typ 3 | Typ 2 |
|---|---:|---:|---:|
| Nachlesen schneller (C_U 0,8 s) | 99,7 % | 78,3 % | 0,9 % |
| Nachlesen langsamer (C_U 1,6 s) | 99,7 % | 35,1 % | 0,0 % |
| Alle langsamer (T0 1,2 s) | 99,1 % | 27,0 % | 0,0 % |
| Mehr Streuung (σ 0,45) | 98,5 % | 31,8 % | 0,0 % |

Typ 1 und Typ 2 sind robust gegenüber den Annahmen. Typ 3 schwankt stark (27–78 %), liegt aber immer klar dazwischen.

**Kalibrierungsweg:** Mit der Verteilung aus der ersten Version (R5 10 %, R6 5 %) bestand Typ 3 bei 4 s zu 92 %: R5/R6 kamen zu selten vor, um mit ungeübtem Nachlesen ins Zeitlimit zu laufen. Ein Raster über Verteilung und Zeitlimit ergab zwei passende Kombinationen: 3,5 s mit R5 20 % / R6 10 % oder 4 s mit R5 25 % / R6 15 %. Gewählt wurde 4 s, weil das Briefing-Limit erhalten bleibt und für echte Menschen weniger Risiko birgt. Ein zu knappes Limit würde auch Selbstspielende scheitern lassen.

**Was die Simulation nicht weiß:** wie schnell echte Menschen tatsächlich sind, ob man die Tafel unter Zeitdruck überhaupt liest und wie stark Übung in den Leveln das Tempo erhöht. Das Zeitlimit (`CONFIG.finale.secondsPerObject`) ist deshalb **der wichtigste Stellhebel für den Playtest**. Die Tabelle oben zeigt, wohin er wirkt.

---

## Designentscheidungen

**Regeln und Generator**
1. **„Entscheidend"** ist eine Regel, wenn das Weglassen genau dieser Regel die Entscheidung ändert (Leave-one-out mit `decideWith()`, einer schaltbaren Variante von `decide()`). Dass `decideWith()` mit allen Regeln bis Level *n* immer `decide(…, n)` entspricht, prüft ein Test über alle 216 × 217 Objekt/Vorgänger-Kombinationen. `decide()` ist aus dem Briefing übernommen, mit einer Änderung bei R3:
   - **R3 geändert (bewusste Abweichung vom Briefing):** statt „gerade Zahl → umkehren" gilt **„Zahl größer als 5 → umkehren"**. Gerade/ungerade unter Zeitdruck zu erkennen, war unnötig komplex; die Schwierigkeit soll aus dem Zusammenspiel der Regeln kommen, nicht aus Kopfrechnen. Der Umkehr-Mechanismus bleibt. 6–9 sind 4 von 9 Zahlen, also genauso häufig wie gerade Zahlen. Die Simulationsergebnisse haben sich dadurch praktisch nicht verändert. Die Grenze steht als `R3_THRESHOLD` in [`src/rules.js`](src/rules.js); bei einer Änderung müssen die R3-Texte in `TEXTS` mitgeändert werden.
2. **Generator:** Jedem Slot wird eine Zielregel zugeordnet; passende Kandidaten werden erzeugt und verworfen, bis die Zielregel wirklich entscheidend ist. R5-Slots kopieren Farbe und Form des Vorgängers und stehen nie an Position 1.
3. **Level:** Zielregeln werden zufällig gezogen; danach wird der Mindestanteil der neuen Regel (≥ 30 %, `minNewRuleShare`) **in jeder Runde garantiert** (Test über 500 Seeds je Level). Ältere Regeln kommen gewichtet vor (verteiltes Üben).
4. **Finale:** exakte Quoten statt Zufallsziehung, damit jeder Versuch gleich schwer ist.
5. **⚠ erscheint erst ab Level 4**, damit das Symbol vorher nicht als bedeutungsloses Rauschen gelernt wird.
6. **Das vorherige Bauteil („davor") wird ab Level 1 immer klein angezeigt**, auch im Finale. So ist seine Anzeige kein Hinweis auf R5, und R5 ist trotzdem ohne Merkleistung anwendbar.

**Ablauf**
7. **Layout:** Regeltafel links, Bauteil rechts daneben (eine Zeile pro Regel, gesperrte Regeln als 🔒-Zeile, damit das Layout zwischen den Leveln nicht springt). Ab ca. 600 px Breite steht die Tafel links neben Bauteil *und* Buttons; darunter stehen die Buttons über die volle Breite, weil sonst drei Buttons bei 360 px nicht mehr bedienbar wären. Das vorherige Bauteil („davor") sitzt klein oben links im Bauteil-Feld. Der Bot-Vorschlag im Assistenz-Modus erscheint im Feedback-Feld unter den Buttons.
   - **Aufleuchten:** Nach jeder Entscheidung leuchten die Regeln auf, die die Entscheidung tragen (`ruleOutcome().winners`) – grün bei richtig, rot bei falsch.
   - **„Neuere schlagen ältere" sichtbar machen** – statt den Vorrang zu erklären, wird er gezeigt:
     - **„überstimmt" auf der Tafel:** Ältere Regeln, die auch gepasst hätten, aber von einer neueren geschlagen wurden, werden durchgestrichen und mit „überstimmt" markiert (z. B. rotes Dreieck: R1 durchgestrichen, R2 leuchtet; ⚠-Dreieck: R2 und R4 durchgestrichen, R6 leuchtet). Definition in `ruleOutcome()`: alles, was zutrifft, aber nicht in `decide().rules` steht, plus R1, wenn R2 greift.
     - **Entscheidungskette** (`decisionChain()`): Im Fehler-Feedback und unter den Intro-Beispielen (ab Level 2) steht, wie sich die Entscheidung Regel für Regel ändert, z. B. `R1 ❌ → R2 ✅ → R4 🔍 → R6 ✅`. Sie wird aus `decide()` auf den Stufen 1…n berechnet; ein Test prüft für alle Objekte, dass das letzte Glied immer der Entscheidung von `decide()` entspricht. Die Kette ersetzt im Fehler-Feedback den früheren Text-Hinweis.
     - Kopfzeile der Tafel „↓ neuere schlagen ältere" und ab Level 2 der Satz „Passen mehrere Regeln, gewinnt die neuere" in der Regel-Intro.
   - **Im Finale ist das alles aus** (`CONFIG.feedback.highlightRulesInFinale = false`): kein Aufleuchten, kein „überstimmt", keine Kette – nur „Richtig / Falsch". Sonst würde man die Regeln im Finale nachlernen (kurz ausprobiert und wieder verworfen).
   - **Zeit zum Verstehen in den Übungsleveln** (Selbst, Assistenz, Umschulung): Nach einer richtigen Antwort bleibt das Feedback **1 Sekunde** stehen (`CONFIG.feedback.correctMs`), dann geht es automatisch weiter (`autoAdvanceCorrect = true`). Eine Bestätigung per „Weiter" nach jeder richtigen Antwort wurde ausprobiert und als zu nervig verworfen. In dieser Sekunde sieht man das Aufleuchten und – wenn mehr als eine Regel beteiligt war – die Entscheidungskette. Nach Fehlern bleibt das Feedback bis „Weiter" (Enter/Leertaste) stehen. Die Zeitbonus-Fenster sind großzügig (Level 3–6: 8 / 7 / 6,5 / 6 s) und der Balken ist mit „⏱ Zeitbonus" beschriftet: Er bringt nur Bonuspunkte, ist kein Limit, und die Lesezeit nach der Entscheidung zählt nicht mit. Bot-Durchläufe und Finale sind davon nicht betroffen.
8. **Regeltafel statt versteckter Regeln (bewusste Abweichung vom Briefing).** Das Briefing sah vor, dass Automatisierende die Regeln nie sehen und es im Finale keine Regelübersicht gibt. Das fühlte sich unfair an, auch für Selbstspielende, und lädt dazu ein, das Scheitern dem Spiel zuzuschreiben („das wurde mir nie gesagt"). Jetzt gilt:
   - Neben dem Bauteil steht immer eine **Regeltafel** mit allen bisher **freigeschalteten** Regeln. Die neueste ist mit „neu" markiert. Kopfzeile: „↓ neuere schlagen ältere". Das beschreibt die Vorranglogik von `decide()` vollständig (R2 > R1, R3 kehrt um, R4 > R1–R3, R5 > R4, R6 > R5).
   - **Freischaltung erfolgt mit dem Level, unabhängig vom Modus:** Level *n* zeigt R1…R*n*, das Finale alle sechs. Künftige Regeln sind nie sichtbar.
   - Auch beim Automatisieren wird die neue Regel angezeigt („Neue Prüfregel freigeschaltet" + Regeltext). Man liest sie, wendet sie aber nie selbst an.
   - Das Finale wird damit **über das Tempo** schwer, nicht über fehlendes Wissen: geübte Regeln wendet man in 4 s an, ungeübte muss man nachlesen.
9. Die Regel-Intro (Selbst/Assistenz) zeigt die neue Regel groß, Beispiele mit per `decide()` berechneter Lösung und aufklappbar „Bisherige Regeln".
10. **Modusdialog:** „Automatisieren" steht oben und ist als „Empfohlen: spart Zeit" hervorgehoben. Vorausgewählt ist der zuletzt **im Dialog** gewählte Modus, beim ersten Mal nichts. Keine moralisierenden Texte.
11. **Punkte und Kompetenz werden erst am Rundenende gespeichert.** Wer mitten in der Runde neu lädt, verliert die Runde (kein Farmen). Erledigte Level zeigen nur eine Zusammenfassung.
12. **Automatisierung:** 3× so viele Objekte wie manuell, Punkte = Objekte × 10 × 3 + Level × 100 (Level 3: 30 Objekte, 1.200 Punkte). „Bot-Effizienz" steigt mit jedem automatisierten Level und mit Upgrades. **Upgrades kosten Punkte** und erhöhen den Durchsatz späterer Bot-Läufe, ohne Einfluss aufs Finale.
   - **Der Bot spielt im selben UI:** Er klickt die Buttons in hohem Tempo (ein Durchlauf dauert ca. 4 s, `auto.animationMs`, 30–140 ms pro Bauteil), entscheidet per `decide()` immer richtig, und die entscheidenden Regeln blitzen grün auf. Man sieht also, *dass* die Regeln angewendet werden, wendet sie aber nie selbst an.
   - **Bot-Übernahme mitten in der Runde („keine Lust mehr"):** Button „🤖 Bot übernehmen" oben rechts, ab Level 3 (`takeoverFromLevel`), nicht in der Umschulung und nicht im Finale (dort ist der Bot offline). Der Bot prüft die restlichen Bauteile; jedes bringt 30 Punkte (`takeoverPoints`), ohne Level-Bonus und ohne Mehrdurchsatz – komplett Automatisieren bleibt also lukrativer. Kompetenz zählt nur für die eigenen Entscheidungen davor. Danach ist „Automatisieren" im nächsten Modusdialog vorausgewählt. Im Level-Eintrag wird `takeoverAt` gespeichert; Zusammenfassung, Übersicht und Debriefing zeigen „👤→🤖 Bot ab #k". Wer übernimmt, landet in der Simulation zwischen den bestehenden Spielertypen; eine Neukalibrierung ist dafür nicht nötig.
13. **Finale:** Regeltafel mit allen sechs Regeln, aber nur „Richtig / Falsch / Zeit abgelaufen" als Feedback (keine Erklärung, welche Regel gegriffen hat). Die Reaktionszeit wird gemessen. Abbruch beim 4. Fehler, danach automatisch (nach 1,6 s) zur Auswertung. Im Finale gibt es keine Punkte. Wer `?level=7` erneut öffnet, sieht nur das Ergebnis und einen Link zur Auswertung.

**Kompetenz und Auswertung**
14. Kompetenz exakt nach Briefing (`correct[R]`, Deckel `masteryThreshold = 4`, Assistenz: Korrektur = 1, Bestätigung = 0,5). Der Standardfall „nicht rot → freigeben" zählt für R1. Finalentscheidungen zählen nicht (das Finale misst), Umschulungsentscheidungen schon.
15. Kompetenz erscheint vor dem Debriefing nirgends, auch nicht in Tooltips oder ARIA-Labels. Ausnahme ist der Dev-Modus. Im Debriefing zeigt jede Regel, **wie oft man sie selbst angewendet hat** („11× selbst angewendet" bzw. „nie selbst angewendet"), statt wie früher „unbekannt". Dazu kommen die durchschnittliche Reaktionszeit im Finale, die Zahl der Zeitabläufe und der Hinweis, dass alle Regeln während des Finales sichtbar waren.
16. **Umschulung:** gemessen wird die aktive Spielzeit (Summe der Level inkl. Intro), nicht die Wanduhrzeit. Die Umschulung kann unterbrochen und fortgesetzt werden. Die Level-Zeitleiste im Debriefing zeigt weiter die ursprünglich gewählten Modi.
17. Die Finalhistorie speichert die letzten 10 Versuche inkl. Fehlerdetails (welche Regel gegriffen hätte).

**Technik**
18. Spielstand-Schema wie im Briefing, ergänzt um `seenRules`, `autoRuns`, `upgrades` und `retraining.activeMs/nextLevel`. Jeder Zugriff liest frisch aus `localStorage` (mehrere iframes), die Punktanzeige synchronisiert sich über das `storage`-Event. Ein iframe, das noch „Bitte zuerst die vorherige Seite abschließen" zeigt, wechselt automatisch ins Level, sobald die Vorseite in einem anderen iframe abgeschlossen wurde. Kaputte oder fremde Versionen führen zu einem sauberen Neustart.
19. Farben sind zusätzlich durch Muster (Streifen/Punkte/Linien/Gitter) und ein Textlabel unterscheidbar. Bauteile haben ein ARIA-Label. `prefers-reduced-motion` schaltet Animationen ab.
20. Node ≥ 21 behandelt `node --test tests/` als Modulpfad statt als Ordner. `tests/index.js` sorgt dafür, dass der Befehl in allen Versionen dieselben Tests ausführt.

---

## Offene Punkte für Playtests

- **Zeitlimit im Finale (wichtigster Punkt):** Reaktionszeiten aus Playtests (sie stehen im Spielstand unter `finale.history[].avgReactionMs`) mit dem Zeitmodell vergleichen und `CONFIG.finale.secondsPerObject` nachjustieren. Wenn Automatisierende durch Nachlesen bestehen: Limit senken. Wenn Selbstspielende scheitern: Limit erhöhen.
- **Wird die Regeltafel genutzt?** Lesen Automatisierende die Tafel im Finale, oder raten sie? Lesen Selbstspielende sie in den Leveln statt die Regeln zu verinnerlichen? (Dann lernen sie vielleicht langsamer, was im Finale auffallen würde.)
- **Fühlt sich das Scheitern jetzt fair an?** Wird es dem fehlenden Üben zugeschrieben oder doch dem Spiel?
- **Assistenz-Modus:** Über sechs Level erreicht man auch mit Assistenz häufig hohe Kompetenzwerte, weil ältere Regeln (R1–R3) ständig mitgeübt werden. Der Verlust zeigt sich vor allem bei R5/R6. Ist `masteryThreshold = 4` passend?
- **Punkte-Skalierung:** Ist der Abstand Auto ↔ Selbst verlockend genug (Level 3: ~1.200 vs. ~150 Punkte)? Werden Upgrades gekauft?
- **Ton der Auswertung:** Wirkt sie neugierig statt beschämend? Werden die Reflexionsfragen genutzt?
- **Forschungsabsatz:** `TEXTS.debrief.research` ist ein Platzhalter und muss mit geprüften Quellen gefüllt werden.
- **Umschulungsdauer:** 66 Bauteile, geschätzt 5–8 Minuten. Zu lang für den Kurskontext?
- **Mobil:** Touch-Bedienung auf echten Geräten prüfen (Bauteil + Regeltafel nebeneinander und Buttons passen bei 360 × 600 ohne Scrollen; der Tastaturhinweis wird auf Touch-Geräten ausgeblendet).
- **Bot-Übernahme:** Wann wird sie genutzt (früh in der Runde, nach Fehlern)? Ist der Button zu verlockend oder zu unauffällig?
- **Aufleuchten:** Hilft es beim Lernen der Regeln, oder schaut man nur noch auf die Tafel statt aufs Bauteil? Verlernen Selbstspielende dadurch das Verinnerlichen, weil die Tafel im Finale ohnehin da ist?
- **Vorrang:** Verstehen Spielende „neuere schlagen ältere" über „überstimmt" und die Kette schneller als vorher? Wird die Kette im Fehler-Feedback gelesen oder weggeklickt?
- **Übungstempo vs. Finaltempo:** Die Übungslevel lassen mehr Zeit (lange Bonus-Fenster, 1 s Feedback), das Finale verlangt 4 s pro Bauteil. Reicht das Üben mit wenig Zeitdruck, um im Finale schnell genug zu sein? Falls Selbstspielende im Finale an der Zeit scheitern: Bonus-Fenster in Level 5–6 wieder verkürzen. Reicht 1 s, um die Kette bei richtigen Antworten zu lesen?
- **Moodle-Umgebung:** iframe-Berechtigungen (`trustcontent`), Verhalten bei Pop-up- vs. eingebetteter Dateianzeige, ggf. Speicherpartitionierung, falls die Datei von einer anderen Domain als Moodle ausgeliefert wird.
