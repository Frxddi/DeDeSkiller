/*
 * rules.js – reine Spiellogik ohne DOM.
 * Browser: globales Objekt `DeskillRules` (config.js muss vorher geladen sein).
 * Node:    const Rules = require('./rules.js')  bzw.  import Rules from '../src/rules.js'
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config.js'));
  else root.DeskillRules = factory(root.DESKILL_CONFIG);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CONFIG) {
  'use strict';

  const COLORS = ['red', 'blue', 'green', 'yellow'];
  const SHAPES = ['circle', 'square', 'triangle'];
  const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const SYMBOLS = ['none', 'warn'];
  const RULE_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'];
  const D = { FREIGEBEN: 'FREIGEBEN', AUSSORTIEREN: 'AUSSORTIEREN', NACHPRUEFEN: 'NACHPRUEFEN' };
  const FINALE_LEVEL = 7;
  const FINALE_RULE_LEVEL = 6;

  // R3: „Zahl größer als 5 → Entscheidung umkehren" (ersetzt die ursprüngliche Regel „gerade Zahl",
  // die sich im Test als zu komplex anfühlte). 6–9 sind 4 von 9 Zahlen – gleich häufig wie gerade Zahlen.
  const R3_THRESHOLD = 5;
  const isHigh = (n) => n > R3_THRESHOLD;

  // ---------------------------------------------------------------------------
  // Verbindliche Entscheidungslogik (einzige Quelle der Wahrheit, Briefing 3.3 – R3 angepasst)
  // level = höchste aktive Regelstufe (1–6; Finale = 6), prev = vorheriges Objekt oder null
  // ---------------------------------------------------------------------------
  function decide(obj, prev, level) {
    if (level >= 6 && obj.symbol === 'warn' && obj.shape === 'triangle')
      return { decision: 'FREIGEBEN', rules: ['R6'] };

    if (level >= 5 && prev && prev.color === obj.color && prev.shape === obj.shape)
      return { decision: 'AUSSORTIEREN', rules: ['R5'] };

    if (level >= 4 && obj.symbol === 'warn')
      return { decision: 'NACHPRUEFEN', rules: ['R4'] };

    const rules = [];
    let d = 'FREIGEBEN';
    if (obj.color === 'red') { d = 'AUSSORTIEREN'; rules.push('R1'); }
    if (level >= 2 && obj.shape === 'triangle') { d = 'FREIGEBEN'; rules.push('R2'); }
    if (level >= 3 && isHigh(obj.number)) {
      d = (d === 'FREIGEBEN') ? 'AUSSORTIEREN' : 'FREIGEBEN';
      rules.push('R3');
    }
    if (rules.length === 0) rules.push('R1'); // Standardfall „nicht rot → freigeben"
    return { decision: d, rules };
  }

  // Analyse-Variante: dieselbe Logik, aber jede Regel einzeln schaltbar.
  // decideWith(obj, prev, rulesUpTo(L)) liefert immer dieselbe Entscheidung wie decide(obj, prev, L)
  // (per Test abgesichert). Wird nur benutzt, um zu bestimmen, welche Regel „entscheidend" ist.
  function decideWith(obj, prev, active) {
    const on = (r) => active.has(r);
    if (on('R6') && obj.symbol === 'warn' && obj.shape === 'triangle') return 'FREIGEBEN';
    if (on('R5') && prev && prev.color === obj.color && prev.shape === obj.shape) return 'AUSSORTIEREN';
    if (on('R4') && obj.symbol === 'warn') return 'NACHPRUEFEN';
    let d = 'FREIGEBEN';
    if (on('R1') && obj.color === 'red') d = 'AUSSORTIEREN';
    if (on('R2') && obj.shape === 'triangle') d = 'FREIGEBEN';
    if (on('R3') && isHigh(obj.number)) d = (d === 'FREIGEBEN') ? 'AUSSORTIEREN' : 'FREIGEBEN';
    return d;
  }

  function rulesUpTo(level) {
    return new Set(RULE_IDS.slice(0, Math.max(0, Math.min(level, 6))));
  }

  // Eine Regel ist „entscheidend", wenn das Weglassen genau dieser Regel die Entscheidung ändert.
  function decisiveRules(obj, prev, level) {
    const all = rulesUpTo(level);
    const base = decideWith(obj, prev, all);
    const out = [];
    for (const r of all) {
      const without = new Set(all);
      without.delete(r);
      if (decideWith(obj, prev, without) !== base) out.push(r);
    }
    return out;
  }

  // Regeln, die auf Level `level` freigeschaltet (also auf der Regeltafel sichtbar) sind.
  // Finale (7) = alle sechs. Freischaltung erfolgt unabhängig vom gewählten Modus.
  function unlockedRules(level) {
    return RULE_IDS.slice(0, Math.max(0, Math.min(level, 6)));
  }

  // Regeln, deren Bedingung am Objekt zutrifft (unabhängig davon, ob sie am Ende entscheidet).
  // Grundlage für das Zeitmodell der Simulation: Jede zutreffende Bedingung muss man prüfen.
  function triggeredRules(obj, prev, level) {
    const out = [];
    if (obj.color === 'red') out.push('R1');
    if (obj.shape === 'triangle') out.push('R2');
    if (isHigh(obj.number)) out.push('R3');
    if (obj.symbol === 'warn') out.push('R4');
    if (prev && prev.color === obj.color && prev.shape === obj.shape) out.push('R5');
    if (obj.symbol === 'warn' && obj.shape === 'triangle') out.push('R6');
    return out.filter((r) => Number(r.slice(1)) <= Math.min(level, 6));
  }

  /**
   * Entscheidungskette: wie sich die Entscheidung Regel für Regel entwickelt, wenn man die Regeln
   * in der Reihenfolge ihres Erscheinens hinzunimmt. Aufgeführt wird jede Regel, die zutrifft oder
   * die Entscheidung ändert (R1 immer). Das letzte Glied ist immer die endgültige Entscheidung.
   * Beispiel ⚠ auf rotem Dreieck (Level 6): R1 AUSSORTIEREN → R2 FREIGEBEN → R4 NACHPRUEFEN → R6 FREIGEBEN
   */
  function decisionChain(obj, prev, level) {
    const max = Math.max(1, Math.min(level, 6));
    const trig = triggeredRules(obj, prev, max);
    const out = [];
    let last = null;
    for (let L = 1; L <= max; L++) {
      const d = decide(obj, prev, L).decision;
      const r = 'R' + L;
      if (L === 1 || d !== last || trig.includes(r)) out.push({ rule: r, decision: d });
      last = d;
    }
    return out;
  }

  /**
   * Welche Regeln haben gepasst, wurden aber von einer neueren überstimmt?
   * – alles, was zutrifft, aber nicht in decide().rules steht (R4/R5/R6 schlagen alle älteren)
   * – R1, wenn R2 greift (rotes Dreieck)
   * winners = die Regeln, die die Entscheidung tatsächlich tragen.
   */
  function ruleOutcome(obj, prev, level) {
    const used = decide(obj, prev, level).rules;
    const trig = triggeredRules(obj, prev, level);
    const overruled = trig.filter((r) => !used.includes(r));
    if (used.includes('R1') && used.includes('R2')) overruled.push('R1');
    overruled.sort();
    return { winners: used.filter((r) => !overruled.includes(r)), overruled };
  }

  function availableDecisions(level) {
    return level >= 4 ? [D.FREIGEBEN, D.AUSSORTIEREN, D.NACHPRUEFEN] : [D.FREIGEBEN, D.AUSSORTIEREN];
  }

  // ---------------------------------------------------------------------------
  // Seedbarer Zufall (mulberry32)
  // ---------------------------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    const next = mulberry32(seed);
    return {
      next,
      int: (n) => Math.floor(next() * n),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }
    };
  }

  function randomSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  }

  // ---------------------------------------------------------------------------
  // Objektgenerator
  // ---------------------------------------------------------------------------
  function randomObject(rng, warnRate) {
    return {
      color: rng.pick(COLORS),
      shape: rng.pick(SHAPES),
      number: rng.pick(NUMBERS),
      symbol: rng.chance(warnRate) ? 'warn' : 'none'
    };
  }

  // Erzeugt einen Kandidaten, der die Zielregel wahrscheinlich entscheidend macht.
  // Ob er es wirklich ist, prüft generateSequence per decisiveRules (Verwerfungsverfahren).
  function candidateFor(target, prev, rng, warnRate) {
    const o = randomObject(rng, warnRate);
    switch (target) {
      case 'R1': o.color = 'red'; if (o.shape === 'triangle') o.shape = rng.pick(['circle', 'square']); o.symbol = 'none'; break;
      case 'R2': o.color = 'red'; o.shape = 'triangle'; o.symbol = 'none'; break;
      case 'R3': o.number = rng.pick(NUMBERS.filter(isHigh)); o.symbol = 'none'; break;
      case 'R4': o.symbol = 'warn'; o.shape = rng.pick(['circle', 'square']); break;
      case 'R5': if (!prev) return null; o.color = prev.color; o.shape = prev.shape; break;
      case 'R6': o.symbol = 'warn'; o.shape = 'triangle'; break;
      default: break; // 'any'
    }
    return o;
  }

  // Verteilt `count` Zielregeln gemäß Gewichten.
  // exact = true: Quoten nach größtem Rest (gleiche Schwierigkeit in jedem Durchlauf).
  // exact = false: zufällig gezogen.
  // minShares = { R3: 0.3 } erzwingt Mindestanteile.
  function buildTargets(count, weights, rng, exact, minShares) {
    const keys = Object.keys(weights).filter((k) => weights[k] > 0);
    const sum = keys.reduce((s, k) => s + weights[k], 0) || 1;
    let targets = [];
    if (exact) {
      const raw = keys.map((k) => ({ k, v: (weights[k] / sum) * count }));
      raw.forEach((r) => { r.n = Math.floor(r.v); r.rest = r.v - r.n; });
      let left = count - raw.reduce((s, r) => s + r.n, 0);
      raw.slice().sort((a, b) => b.rest - a.rest).forEach((r) => { if (left > 0) { r.n++; left--; } });
      raw.forEach((r) => { for (let i = 0; i < r.n; i++) targets.push(r.k); });
    } else {
      for (let i = 0; i < count; i++) {
        let x = rng.next() * sum;
        let chosen = keys[keys.length - 1];
        for (const k of keys) { x -= weights[k]; if (x < 0) { chosen = k; break; } }
        targets.push(chosen);
      }
    }
    if (minShares) {
      for (const rule of Object.keys(minShares)) {
        const need = Math.ceil(minShares[rule] * count);
        let have = targets.filter((t) => t === rule).length;
        const idx = rng.shuffle(targets.map((_, i) => i));
        for (const i of idx) {
          if (have >= need) break;
          if (targets[i] !== rule && !(minShares[targets[i]])) { targets[i] = rule; have++; }
        }
      }
    }
    rng.shuffle(targets);
    // R5 braucht ein Vorgängerobjekt → nie an Position 0.
    if (targets[0] === 'R5') {
      const j = targets.findIndex((t) => t !== 'R5');
      if (j > 0) [targets[0], targets[j]] = [targets[j], targets[0]];
      else targets[0] = 'any';
    }
    return targets;
  }

  /**
   * Erzeugt eine Folge von Objekten.
   * opts: { level, count, seed, dist, warnRate, exact, minShares }
   * Rückgabe: Array von { obj, prev, target, decisive, correct: {decision, rules} }
   */
  function generateSequence(opts) {
    const rng = makeRng(opts.seed >>> 0);
    const targets = buildTargets(opts.count, opts.dist, rng, !!opts.exact, opts.minShares);
    const out = [];
    let prev = null;
    for (let i = 0; i < targets.length; i++) {
      let target = targets[i];
      let obj = null;
      for (let tries = 0; tries < 400 && !obj; tries++) {
        const c = candidateFor(target, prev, rng, opts.warnRate);
        if (!c) break;
        if (target === 'any' || decisiveRules(c, prev, opts.level).includes(target)) obj = c;
      }
      if (!obj) { target = 'any'; obj = randomObject(rng, opts.warnRate); }
      obj.id = i + 1;
      out.push({
        obj,
        prev,
        target,
        decisive: decisiveRules(obj, prev, opts.level),
        correct: decide(obj, prev, opts.level)
      });
      prev = obj;
    }
    return out;
  }

  function generateLevel(level, seed, cfg) {
    cfg = cfg || CONFIG;
    const lc = cfg.levels[level];
    const newRule = 'R' + level;
    return generateSequence({
      level,
      count: lc.objects,
      seed,
      dist: lc.dist,
      warnRate: lc.warnRate,
      exact: false,
      minShares: { [newRule]: cfg.minNewRuleShare }
    });
  }

  function generateFinale(seed, cfg) {
    cfg = cfg || CONFIG;
    const f = cfg.finale;
    return generateSequence({
      level: FINALE_RULE_LEVEL,
      count: f.objects,
      seed,
      dist: f.dist,
      warnRate: f.warnRate,
      exact: f.exactQuotas
    });
  }

  // ---------------------------------------------------------------------------
  // Assistenz-Bot
  // ---------------------------------------------------------------------------
  function botSuggestion(correctDecision, level, rng, errorRate) {
    if (!rng.chance(errorRate)) return correctDecision;
    const others = availableDecisions(level).filter((d) => d !== correctDecision);
    return rng.pick(others);
  }

  // ---------------------------------------------------------------------------
  // Punkte
  // ---------------------------------------------------------------------------
  // Punkte für eine einzelne richtige Entscheidung (manuell/assistiert, vor Multiplikator).
  // elapsedSec: Bedenkzeit; window: Zeitbonus-Fenster oder null; streak: Serie inkl. dieser Entscheidung.
  function decisionPoints(elapsedSec, window, streak, cfg) {
    cfg = cfg || CONFIG;
    const p = cfg.points;
    let pts = p.correct;
    if (window) pts += Math.round(p.timeBonusMax * Math.max(0, 1 - elapsedSec / window));
    if (streak >= p.streakFrom) pts += p.streakBonus;
    return pts;
  }

  function roundPoints(basePoints, mode, cfg) {
    cfg = cfg || CONFIG;
    return mode === 'assist' ? Math.round(basePoints * cfg.points.assistMultiplier) : basePoints;
  }

  function autoThroughput(level, upgrades, cfg) {
    cfg = cfg || CONFIG;
    const boost = (upgrades || []).reduce((s, id) => {
      const u = cfg.upgrades.find((x) => x.id === id);
      return s + (u ? u.throughput : 0);
    }, 0);
    return Math.round(cfg.levels[level].objects * cfg.auto.objectMultiplier * (1 + boost));
  }

  function autoPoints(level, objects, cfg) {
    cfg = cfg || CONFIG;
    return objects * cfg.points.correct * cfg.auto.pointsMultiplier + level * cfg.auto.levelBonusPerLevel;
  }

  // Bot übernimmt mitten in der Runde: Punkte für die restlichen Bauteile (ohne Level-Bonus, ohne Mehrdurchsatz).
  function takeoverPoints(remaining, cfg) {
    cfg = cfg || CONFIG;
    return Math.max(0, remaining) * cfg.points.correct * cfg.auto.pointsMultiplier;
  }

  // Tempo des Bots pro Bauteil, sodass ein Durchlauf ungefähr `animationMs` dauert.
  function botMsPerObject(objects, cfg) {
    cfg = cfg || CONFIG;
    const a = cfg.auto;
    return Math.round(Math.min(a.maxMsPerObject, Math.max(a.minMsPerObject, a.animationMs / Math.max(1, objects))));
  }

  function botEfficiency(autoRuns, upgrades, cfg) {
    cfg = cfg || CONFIG;
    const boost = (upgrades || []).reduce((s, id) => {
      const u = cfg.upgrades.find((x) => x.id === id);
      return s + (u ? u.throughput : 0);
    }, 0);
    return Math.round(cfg.auto.efficiencyBase + Math.max(0, autoRuns - 1) * cfg.auto.efficiencyStep + boost * 100);
  }

  // ---------------------------------------------------------------------------
  // Verstecktes Kompetenz-Meter
  // ---------------------------------------------------------------------------
  /**
   * Wie viel zählt eine Entscheidung für die Kompetenz?
   * manual: richtig → 1
   * assist: Bot lag falsch und man hat korrigiert → 1; richtigen Vorschlag bestätigt → 0,5
   * auto:   nie
   */
  function competenceCredit(e) {
    if (e.decision !== e.correctDecision) return 0;
    if (e.mode === 'manual') return 1;
    if (e.mode === 'assist') {
      if (e.suggestion !== e.correctDecision) return 1; // korrigiert (sonst wäre decision falsch)
      return 0.5; // richtigen Vorschlag bestätigt
    }
    return 0;
  }

  function emptyCompetence() {
    const c = {};
    RULE_IDS.forEach((r) => { c[r] = { correct: 0 }; });
    return c;
  }

  // Verändert `competence` in place.
  function addCompetence(competence, rules, credit) {
    if (!credit) return competence;
    rules.forEach((r) => {
      if (!competence[r]) competence[r] = { correct: 0 };
      competence[r].correct += credit;
    });
    return competence;
  }

  function competenceScores(competence, threshold) {
    threshold = threshold || CONFIG.masteryThreshold;
    const out = {};
    let sum = 0;
    RULE_IDS.forEach((r) => {
      const n = (competence && competence[r] && competence[r].correct) || 0;
      out[r] = Math.min(1, n / threshold);
      sum += out[r];
    });
    out.total = sum / RULE_IDS.length;
    return out;
  }

  // ---------------------------------------------------------------------------
  // Beispiele für die Regel-Intro-Karten (Entscheidung wird per decide() berechnet)
  // ---------------------------------------------------------------------------
  const RULE_EXAMPLES = {
    R1: [
      { obj: { color: 'red', shape: 'square', number: 7, symbol: 'none' } },
      { obj: { color: 'blue', shape: 'circle', number: 3, symbol: 'none' } }
    ],
    R2: [
      { obj: { color: 'red', shape: 'triangle', number: 5, symbol: 'none' } },
      { obj: { color: 'red', shape: 'circle', number: 5, symbol: 'none' } }
    ],
    R3: [
      { obj: { color: 'green', shape: 'circle', number: 7, symbol: 'none' } },
      { obj: { color: 'red', shape: 'square', number: 8, symbol: 'none' } }
    ],
    R4: [
      { obj: { color: 'blue', shape: 'square', number: 6, symbol: 'warn' } }
    ],
    R5: [
      { prev: { color: 'yellow', shape: 'circle', number: 3, symbol: 'none' },
        obj: { color: 'yellow', shape: 'circle', number: 5, symbol: 'none' } }
    ],
    R6: [
      { obj: { color: 'red', shape: 'triangle', number: 4, symbol: 'warn' } }
    ]
  };

  function examplesFor(level) {
    const rule = 'R' + level;
    return (RULE_EXAMPLES[rule] || []).map((ex) => ({
      obj: ex.obj,
      prev: ex.prev || null,
      result: decide(ex.obj, ex.prev || null, level)
    }));
  }

  return {
    CONFIG,
    COLORS, SHAPES, NUMBERS, SYMBOLS, RULE_IDS, DECISIONS: D, FINALE_LEVEL, FINALE_RULE_LEVEL, R3_THRESHOLD, isHigh,
    decide, decideWith, rulesUpTo, decisiveRules, availableDecisions, unlockedRules, triggeredRules,
    decisionChain, ruleOutcome,
    mulberry32, makeRng, randomSeed, randomObject,
    buildTargets, generateSequence, generateLevel, generateFinale,
    botSuggestion,
    decisionPoints, roundPoints, autoThroughput, autoPoints, botEfficiency, takeoverPoints, botMsPerObject,
    competenceCredit, emptyCompetence, addCompetence, competenceScores,
    RULE_EXAMPLES, examplesFor
  };
});
