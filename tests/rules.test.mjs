import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import Rules from '../src/rules.js';
import State from '../src/state.js';

const { decide, decideWith, rulesUpTo, decisiveRules, CONFIG } = Rules;
const o = (color, shape, number, symbol = 'none') => ({ color, shape, number, symbol });

describe('decide() – einzelne Regeln', () => {
  test('R1: rot → aussortieren, sonst freigeben', () => {
    assert.deepEqual(decide(o('red', 'circle', 3), null, 1), { decision: 'AUSSORTIEREN', rules: ['R1'] });
    assert.deepEqual(decide(o('blue', 'square', 3), null, 1), { decision: 'FREIGEBEN', rules: ['R1'] });
    // vor Level 2 zählen Dreiecke nicht
    assert.equal(decide(o('red', 'triangle', 3), null, 1).decision, 'AUSSORTIEREN');
  });

  test('R2: Dreiecke immer freigeben (ab Level 2)', () => {
    assert.deepEqual(decide(o('green', 'triangle', 3), null, 2), { decision: 'FREIGEBEN', rules: ['R2'] });
  });

  test('R3: Zahl größer als 5 kehrt um (ab Level 3)', () => {
    assert.deepEqual(decide(o('blue', 'circle', 7), null, 3), { decision: 'AUSSORTIEREN', rules: ['R3'] });
    assert.equal(decide(o('blue', 'circle', 7), null, 2).decision, 'FREIGEBEN');
    // Grenze: 5 kehrt nicht um, 6 schon; Parität spielt keine Rolle mehr
    assert.deepEqual(decide(o('blue', 'circle', 5), null, 3), { decision: 'FREIGEBEN', rules: ['R1'] });
    assert.equal(decide(o('blue', 'circle', 6), null, 3).decision, 'AUSSORTIEREN');
    assert.equal(decide(o('blue', 'circle', 4), null, 3).decision, 'FREIGEBEN');
    assert.equal(decide(o('blue', 'circle', 9), null, 3).decision, 'AUSSORTIEREN');
  });

  test('R4: ⚠ → Nachprüfen (ab Level 4)', () => {
    assert.deepEqual(decide(o('blue', 'circle', 3, 'warn'), null, 4), { decision: 'NACHPRUEFEN', rules: ['R4'] });
    assert.equal(decide(o('blue', 'circle', 3, 'warn'), null, 3).decision, 'FREIGEBEN');
  });

  test('R5: gleiche Farbe und Form wie davor → aussortieren (ab Level 5)', () => {
    const prev = o('blue', 'circle', 1);
    assert.deepEqual(decide(o('blue', 'circle', 3), prev, 5), { decision: 'AUSSORTIEREN', rules: ['R5'] });
    assert.equal(decide(o('blue', 'circle', 3), prev, 4).decision, 'FREIGEBEN');
    assert.equal(decide(o('blue', 'square', 3), prev, 5).decision, 'FREIGEBEN'); // nur Farbe gleich
    assert.equal(decide(o('green', 'circle', 3), prev, 5).decision, 'FREIGEBEN'); // nur Form gleich
    assert.equal(decide(o('blue', 'circle', 3), null, 5).decision, 'FREIGEBEN'); // kein Vorgänger
  });

  test('R6: ⚠ auf Dreieck → freigeben (ab Level 6)', () => {
    assert.deepEqual(decide(o('red', 'triangle', 4, 'warn'), null, 6), { decision: 'FREIGEBEN', rules: ['R6'] });
    assert.equal(decide(o('red', 'triangle', 4, 'warn'), null, 5).decision, 'NACHPRUEFEN');
  });
});

describe('decide() – Vorrangkonflikte', () => {
  test('R2 schlägt R1: rotes Dreieck wird freigegeben', () => {
    assert.deepEqual(decide(o('red', 'triangle', 3), null, 2), { decision: 'FREIGEBEN', rules: ['R1', 'R2'] });
  });

  test('R3 invertiert R2: Dreieck mit Zahl über 5 wird aussortiert', () => {
    assert.deepEqual(decide(o('red', 'triangle', 8), null, 3), { decision: 'AUSSORTIEREN', rules: ['R1', 'R2', 'R3'] });
    assert.deepEqual(decide(o('blue', 'triangle', 6), null, 3), { decision: 'AUSSORTIEREN', rules: ['R2', 'R3'] });
  });

  test('R3 invertiert R1: rot mit Zahl über 5 wird freigegeben', () => {
    assert.deepEqual(decide(o('red', 'square', 9), null, 3), { decision: 'FREIGEBEN', rules: ['R1', 'R3'] });
  });

  test('R4 schlägt R3: ⚠ mit Zahl über 5 → Nachprüfen', () => {
    assert.deepEqual(decide(o('red', 'square', 8, 'warn'), null, 4), { decision: 'NACHPRUEFEN', rules: ['R4'] });
  });

  test('R5 schlägt R4: ⚠-Wiederholung wird aussortiert', () => {
    const prev = o('green', 'square', 1);
    assert.deepEqual(decide(o('green', 'square', 3, 'warn'), prev, 5), { decision: 'AUSSORTIEREN', rules: ['R5'] });
  });

  test('R6 schlägt R5: ⚠-Dreieck nach gleichfarbigem Dreieck wird freigegeben', () => {
    const prev = o('yellow', 'triangle', 2);
    assert.deepEqual(decide(o('yellow', 'triangle', 3, 'warn'), prev, 6), { decision: 'FREIGEBEN', rules: ['R6'] });
    // auf Level 5 greift dagegen noch R5
    assert.equal(decide(o('yellow', 'triangle', 3, 'warn'), prev, 5).decision, 'AUSSORTIEREN');
  });

  test('R6 schlägt R4: ⚠ auf Dreieck wird nicht nachgeprüft', () => {
    assert.equal(decide(o('blue', 'triangle', 5, 'warn'), null, 4).decision, 'NACHPRUEFEN');
    assert.equal(decide(o('blue', 'triangle', 5, 'warn'), null, 6).decision, 'FREIGEBEN');
  });
});

// Alle 216 möglichen Objekte
const ALL = [];
for (const color of Rules.COLORS) for (const shape of Rules.SHAPES)
  for (const number of Rules.NUMBERS) for (const symbol of Rules.SYMBOLS) ALL.push(o(color, shape, number, symbol));

describe('Regeltafel: Freischaltung', () => {
  test('Regeln werden erst mit ihrem Level freigeschaltet', () => {
    assert.deepEqual(Rules.unlockedRules(1), ['R1']);
    assert.deepEqual(Rules.unlockedRules(3), ['R1', 'R2', 'R3']);
    assert.deepEqual(Rules.unlockedRules(6), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
    assert.deepEqual(Rules.unlockedRules(7), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']); // Finale
    assert.deepEqual(Rules.unlockedRules(0), []);
  });

  test('triggeredRules meldet zutreffende Bedingungen, begrenzt aufs Level', () => {
    const prev = o('red', 'triangle', 1);
    assert.deepEqual(Rules.triggeredRules(o('red', 'triangle', 8, 'warn'), prev, 6), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
    assert.deepEqual(Rules.triggeredRules(o('red', 'triangle', 8, 'warn'), prev, 3), ['R1', 'R2', 'R3']);
    assert.deepEqual(Rules.triggeredRules(o('red', 'triangle', 4, 'warn'), prev, 6), ['R1', 'R2', 'R4', 'R5', 'R6']);
    assert.deepEqual(Rules.triggeredRules(o('blue', 'circle', 3), null, 6), []);
  });
});

describe('Vorrang sichtbar machen: Kette und „überstimmt"', () => {
  test('Kette endet immer mit der Entscheidung von decide()', () => {
    const prevs = [null, o('red', 'triangle', 1), o('blue', 'square', 7, 'warn')];
    for (let level = 1; level <= 6; level++)
      for (const prev of prevs) for (const obj of ALL) {
        const chain = Rules.decisionChain(obj, prev, level);
        assert.equal(chain[0].rule, 'R1');
        assert.equal(chain[chain.length - 1].decision, decide(obj, prev, level).decision);
      }
  });

  test('Beispielketten', () => {
    const c = (obj, prev, l) => Rules.decisionChain(obj, prev, l).map((x) => x.rule + ':' + x.decision[0]).join(' ');
    assert.equal(c(o('red', 'triangle', 3), null, 2), 'R1:A R2:F');
    assert.equal(c(o('red', 'triangle', 8), null, 3), 'R1:A R2:F R3:A');
    assert.equal(c(o('red', 'triangle', 4, 'warn'), null, 6), 'R1:A R2:F R4:N R6:F');
    assert.equal(c(o('blue', 'circle', 3), null, 6), 'R1:F');
    assert.equal(c(o('red', 'circle', 3), o('red', 'circle', 1), 5), 'R1:A R5:A');
  });

  test('überstimmt: neuere Regel schlägt ältere', () => {
    assert.deepEqual(Rules.ruleOutcome(o('red', 'triangle', 3), null, 2), { winners: ['R2'], overruled: ['R1'] });
    assert.deepEqual(Rules.ruleOutcome(o('red', 'triangle', 8), null, 3), { winners: ['R2', 'R3'], overruled: ['R1'] });
    assert.deepEqual(Rules.ruleOutcome(o('red', 'square', 8, 'warn'), null, 4), { winners: ['R4'], overruled: ['R1', 'R3'] });
    const prev = o('yellow', 'triangle', 2);
    assert.deepEqual(Rules.ruleOutcome(o('yellow', 'triangle', 7, 'warn'), prev, 6), { winners: ['R6'], overruled: ['R2', 'R3', 'R4', 'R5'] });
    assert.deepEqual(Rules.ruleOutcome(o('blue', 'circle', 3), null, 6), { winners: ['R1'], overruled: [] });
  });

  test('Gewinner und Überstimmte überschneiden sich nie, Gewinner nie leer', () => {
    for (let level = 1; level <= 6; level++)
      for (const obj of ALL) {
        const { winners, overruled } = Rules.ruleOutcome(obj, o('red', 'triangle', 1), level);
        assert.ok(winners.length >= 1);
        assert.ok(winners.every((r) => !overruled.includes(r)));
      }
  });
});

describe('decideWith() ist konsistent mit decide()', () => {
  test('für alle Objekte, Vorgänger und Level identisch', () => {
    const prevs = [null, ...ALL];
    for (let level = 1; level <= 6; level++) {
      const set = rulesUpTo(level);
      for (const prev of prevs) for (const obj of ALL)
        assert.equal(decideWith(obj, prev, set), decide(obj, prev, level).decision);
    }
  });
});

describe('Generator', () => {
  test('gleicher Seed → gleiche Folge, anderer Seed → andere Folge', () => {
    for (let level = 1; level <= 6; level++) {
      const a = Rules.generateLevel(level, 42).map((x) => x.obj);
      const b = Rules.generateLevel(level, 42).map((x) => x.obj);
      const c = Rules.generateLevel(level, 43).map((x) => x.obj);
      assert.deepEqual(a, b);
      assert.notDeepEqual(a, c);
    }
    assert.deepEqual(Rules.generateFinale(7).map((x) => x.obj), Rules.generateFinale(7).map((x) => x.obj));
  });

  test('Objektzahl pro Level entspricht CONFIG', () => {
    for (let level = 1; level <= 6; level++)
      assert.equal(Rules.generateLevel(level, 1).length, CONFIG.levels[level].objects);
    assert.equal(Rules.generateFinale(1).length, CONFIG.finale.objects);
  });

  test('neue Regel ist in jeder Runde in ≥ 30 % der Objekte entscheidend', () => {
    for (let level = 1; level <= 6; level++) {
      for (let seed = 1; seed <= 500; seed++) {
        const round = Rules.generateLevel(level, seed);
        const share = round.filter((x) => decisiveRules(x.obj, x.prev, level).includes('R' + level)).length / round.length;
        assert.ok(share >= 0.3, `Level ${level}, Seed ${seed}: Anteil ${share}`);
      }
    }
  });

  test('ältere Regeln kommen in späteren Leveln ebenfalls vor', () => {
    for (let level = 2; level <= 6; level++) {
      const seen = new Set();
      for (let seed = 1; seed <= 50; seed++)
        Rules.generateLevel(level, seed).forEach((x) => x.decisive.forEach((r) => seen.add(r)));
      for (let r = 1; r <= level; r++) assert.ok(seen.has('R' + r), `Level ${level}: R${r} fehlt`);
    }
  });

  test('gespeicherte Lösung entspricht decide()', () => {
    for (let seed = 1; seed <= 50; seed++)
      for (const x of Rules.generateFinale(seed))
        assert.deepEqual(x.correct, decide(x.obj, x.prev, 6));
  });

  test('Finale: Quoten pro Regel werden exakt eingehalten', () => {
    const f = CONFIG.finale;
    for (let seed = 1; seed <= 200; seed++) {
      const round = Rules.generateFinale(seed);
      for (const r of ['R3', 'R4', 'R5', 'R6']) {
        const n = round.filter((x) => x.target === r && x.decisive.includes(r)).length;
        assert.ok(Math.abs(n - f.dist[r] * f.objects) <= 1, `Seed ${seed}, ${r}: ${n}`);
      }
    }
  });

  test('Intro-Beispiele zeigen die jeweilige neue Regel', () => {
    for (let level = 1; level <= 6; level++) {
      const ex = Rules.examplesFor(level);
      assert.ok(ex.length >= 1);
      assert.ok(ex.some((e) => decisiveRules(e.obj, e.prev, level).includes('R' + level)), `Level ${level}`);
    }
  });
});

describe('Kompetenz', () => {
  const T = CONFIG.masteryThreshold;

  test('manuell: richtige Entscheidung zählt voll, falsche nicht', () => {
    assert.equal(Rules.competenceCredit({ mode: 'manual', decision: 'FREIGEBEN', correctDecision: 'FREIGEBEN' }), 1);
    assert.equal(Rules.competenceCredit({ mode: 'manual', decision: 'AUSSORTIEREN', correctDecision: 'FREIGEBEN' }), 0);
  });

  test('Assistenz: Korrektur voll, Bestätigung halb, falsch bestätigt nichts', () => {
    // Bot falsch, Person korrigiert
    assert.equal(Rules.competenceCredit({ mode: 'assist', suggestion: 'AUSSORTIEREN', decision: 'FREIGEBEN', correctDecision: 'FREIGEBEN' }), 1);
    // Bot richtig, Person bestätigt
    assert.equal(Rules.competenceCredit({ mode: 'assist', suggestion: 'FREIGEBEN', decision: 'FREIGEBEN', correctDecision: 'FREIGEBEN' }), 0.5);
    // Bot falsch, Person übernimmt Fehler
    assert.equal(Rules.competenceCredit({ mode: 'assist', suggestion: 'AUSSORTIEREN', decision: 'AUSSORTIEREN', correctDecision: 'FREIGEBEN' }), 0);
    // Bot richtig, Person „korrigiert" falsch
    assert.equal(Rules.competenceCredit({ mode: 'assist', suggestion: 'FREIGEBEN', decision: 'AUSSORTIEREN', correctDecision: 'FREIGEBEN' }), 0);
  });

  test('Automatisieren: kein Kompetenzgewinn', () => {
    assert.equal(Rules.competenceCredit({ mode: 'auto', decision: 'FREIGEBEN', correctDecision: 'FREIGEBEN' }), 0);
  });

  test('Kompetenz pro Regel ist bei masteryThreshold gedeckelt, Gesamt = Mittelwert', () => {
    const c = Rules.emptyCompetence();
    Rules.addCompetence(c, ['R1', 'R2'], 1);
    for (let i = 0; i < T + 3; i++) Rules.addCompetence(c, ['R3'], 1);
    Rules.addCompetence(c, ['R4'], 0.5);
    const s = Rules.competenceScores(c, T);
    assert.equal(s.R1, 1 / T);
    assert.equal(s.R3, 1);
    assert.equal(s.R4, 0.5 / T);
    assert.equal(s.R6, 0);
    assert.ok(Math.abs(s.total - (1 / T + 1 / T + 1 + 0.5 / T) / 6) < 1e-9);
  });

  test('durchgespielte Runden: manuell > Assistenz > Automatisieren', () => {
    const play = (mode) => {
      const c = Rules.emptyCompetence();
      const rng = Rules.makeRng(5);
      for (let level = 1; level <= 6; level++) {
        for (const x of Rules.generateLevel(level, 100 + level)) {
          const correct = x.correct.decision;
          const suggestion = Rules.botSuggestion(correct, level, rng, CONFIG.assistErrorRate);
          const decision = correct; // perfekte Person
          Rules.addCompetence(c, x.correct.rules, Rules.competenceCredit({ mode: level < 3 ? 'manual' : mode, suggestion, decision, correctDecision: correct }));
        }
      }
      return Rules.competenceScores(c).total;
    };
    const m = play('manual'), a = play('assist'), au = play('auto');
    assert.ok(m >= a && a > au, `${m} ${a} ${au}`);
    assert.ok(m > 0.9);
  });

  test('innerhalb einer Runde bringt Assistenz weniger Kompetenz als eigenes Prüfen', () => {
    for (let level = 3; level <= 6; level++) {
      const gain = (mode) => {
        const c = Rules.emptyCompetence();
        const rng = Rules.makeRng(level);
        for (const x of Rules.generateLevel(level, 9)) {
          const correct = x.correct.decision;
          const suggestion = Rules.botSuggestion(correct, level, rng, CONFIG.assistErrorRate);
          Rules.addCompetence(c, x.correct.rules, Rules.competenceCredit({ mode, suggestion, decision: correct, correctDecision: correct }));
        }
        return c['R' + level].correct;
      };
      assert.ok(gain('assist') < gain('manual'), `Level ${level}`);
      assert.equal(gain('auto'), 0);
    }
  });
});

describe('Bot', () => {
  test('Übernahme: restliche Bauteile bringen Bot-Punkte ohne Level-Bonus', () => {
    assert.equal(Rules.takeoverPoints(0), 0);
    assert.equal(Rules.takeoverPoints(7), 7 * CONFIG.points.correct * CONFIG.auto.pointsMultiplier);
    assert.equal(Rules.takeoverPoints(-3), 0);
  });

  test('Komplett automatisieren bringt mehr als ab Bauteil 1 übernehmen', () => {
    for (let level = 3; level <= 6; level++) {
      const full = Rules.autoPoints(level, Rules.autoThroughput(level, []));
      assert.ok(full > Rules.takeoverPoints(CONFIG.levels[level].objects), `Level ${level}`);
    }
  });

  test('Bot-Tempo bleibt in den Grenzen und hält die Laufzeit kurz', () => {
    const a = CONFIG.auto;
    for (const objects of [1, 10, 30, 72, 500]) {
      const ms = Rules.botMsPerObject(objects);
      assert.ok(ms >= a.minMsPerObject && ms <= a.maxMsPerObject, `${objects}: ${ms}`);
    }
    // realistische Durchläufe (bis 3× Upgrades) dauern höchstens ~5 s
    assert.ok(Rules.botMsPerObject(144) * 144 <= 5000);
  });
});

describe('Spielstand / localStorage-Robustheit', () => {
  test('Bot-Übernahme wird im Level-Eintrag gespeichert und validiert', () => {
    const s = State.normalizeState({ version: 1, levels: {
      3: { done: true, mode: 'manual', points: 300, takeoverAt: 4 },
      4: { done: true, mode: 'assist', points: 100, takeoverAt: 'x' }
    } });
    assert.equal(s.levels[3].takeoverAt, 4);
    assert.equal(s.levels[4].takeoverAt, null);
  });

  const fakeStorage = (initial = {}) => {
    const data = { ...initial };
    return {
      data,
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: (k) => { delete data[k]; }
    };
  };

  test('fehlender Eintrag → Standardzustand', () => {
    const st = State.createStore(fakeStorage(), 'k');
    assert.deepEqual(st.load(), State.defaultState());
  });

  test('kaputtes JSON → sauberer Neustart', () => {
    const st = State.createStore(fakeStorage({ k: '{kaputt' }), 'k');
    assert.deepEqual(st.load(), State.defaultState());
  });

  test('falscher Typ / falsche Version → sauberer Neustart', () => {
    for (const bad of ['42', '"text"', 'null', '[]', JSON.stringify({ version: 99, totalPoints: 5 })]) {
      const st = State.createStore(fakeStorage({ k: bad }), 'k');
      assert.deepEqual(st.load(), State.defaultState(), bad);
    }
  });

  test('teilweise ungültige Felder werden bereinigt', () => {
    const raw = {
      version: 1, totalPoints: 'viel', levels: { 1: { done: true, mode: 'hack', points: 50 }, 9: { done: true } },
      competence: { R1: { correct: -3 }, R2: 'x' }, seenRules: ['R1', 'R9'], finale: { history: 'nein' }
    };
    const s = State.normalizeState(raw);
    assert.equal(s.totalPoints, 0);
    assert.deepEqual(Object.keys(s.levels), ['1']);
    assert.equal(s.levels[1].mode, 'manual');
    assert.equal(s.levels[1].points, 50);
    assert.equal(s.competence.R1.correct, 0);
    assert.equal(s.competence.R2.correct, 0);
    assert.deepEqual(s.seenRules, ['R1']);
    assert.deepEqual(s.finale.history, []);
  });

  test('Speichern und Laden ergibt denselben Stand', () => {
    const fs = fakeStorage();
    const st = State.createStore(fs, 'k');
    st.update((s) => { s.totalPoints = 120; s.levels[1] = { done: true, mode: 'manual', points: 60, errors: 1, processed: 6 }; });
    const again = State.createStore(fs, 'k').load();
    assert.equal(again.totalPoints, 120);
    assert.equal(again.levels[1].points, 60);
  });

  test('kein Storage / werfender Storage → Spiel läuft im Speicher weiter', () => {
    const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    for (const storage of [null, throwing]) {
      const st = State.createStore(storage, 'k');
      assert.equal(st.available, false);
      st.update((s) => { s.totalPoints = 7; });
      assert.equal(st.load().totalPoints, 7);
      st.reset();
      assert.equal(st.load().totalPoints, 0);
    }
  });

  test('Storage, der erst beim Lesen wirft, führt nicht zum Absturz', () => {
    const fs = fakeStorage();
    fs.getItem = () => { throw new Error('boom'); };
    const st = State.createStore(fs, 'k');
    assert.deepEqual(st.load(), State.defaultState());
  });
});
