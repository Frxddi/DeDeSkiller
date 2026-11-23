/*
 * state.js – Spielstand: Standardwerte, Validierung/Migration, robuster localStorage-Zugriff.
 * Ohne DOM, damit in Node testbar. Browser: globales Objekt `DeskillState`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else root.DeskillState = factory(root.DeskillRules);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Rules) {
  'use strict';

  const VERSION = 1;
  const MODES = ['manual', 'assist', 'auto'];

  function defaultState() {
    return {
      version: VERSION,
      levels: {},
      totalPoints: 0,
      competence: Rules.emptyCompetence(),
      seenRules: [],          // Regeln, deren Text die Person gesehen hat (Intro oder Fehlerhinweis)
      automationUnlocked: false,
      lastMode: null,
      autoRuns: 0,
      upgrades: [],
      finale: { attempts: 0, passed: false, history: [] },
      retraining: { started: null, finished: null, activeMs: 0, nextLevel: 1 }
    };
  }

  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);

  // Macht aus beliebigem Input (auch Müll) einen gültigen Spielstand.
  function normalizeState(raw) {
    const s = defaultState();
    if (!isObj(raw)) return s;
    if (raw.version !== VERSION) return migrate(raw);

    if (isObj(raw.levels)) {
      for (const k of Object.keys(raw.levels)) {
        const l = raw.levels[k];
        if (!/^[1-6]$/.test(k) || !isObj(l)) continue;
        s.levels[k] = {
          done: !!l.done,
          mode: MODES.includes(l.mode) ? l.mode : 'manual',
          points: num(l.points, 0),
          errors: num(l.errors, 0),
          processed: num(l.processed, 0),
          // Bot hat mitten in der Runde übernommen: Anzahl eigener Bauteile davor (sonst null)
          takeoverAt: typeof l.takeoverAt === 'number' && isFinite(l.takeoverAt) ? l.takeoverAt : null
        };
      }
    }
    s.totalPoints = Math.max(0, num(raw.totalPoints, 0));
    if (isObj(raw.competence)) {
      for (const r of Rules.RULE_IDS) {
        const c = raw.competence[r];
        s.competence[r] = { correct: Math.max(0, num(c && c.correct, 0)) };
      }
    }
    if (Array.isArray(raw.seenRules)) s.seenRules = raw.seenRules.filter((r) => Rules.RULE_IDS.includes(r));
    s.automationUnlocked = !!raw.automationUnlocked;
    s.lastMode = MODES.includes(raw.lastMode) ? raw.lastMode : null;
    s.autoRuns = Math.max(0, num(raw.autoRuns, 0));
    if (Array.isArray(raw.upgrades)) s.upgrades = raw.upgrades.filter((u) => typeof u === 'string');
    if (isObj(raw.finale)) {
      s.finale.attempts = Math.max(0, num(raw.finale.attempts, 0));
      s.finale.passed = !!raw.finale.passed;
      if (Array.isArray(raw.finale.history)) s.finale.history = raw.finale.history.filter(isObj);
    }
    if (isObj(raw.retraining)) {
      s.retraining.started = num(raw.retraining.started, null);
      s.retraining.finished = num(raw.retraining.finished, null);
      s.retraining.activeMs = Math.max(0, num(raw.retraining.activeMs, 0));
      s.retraining.nextLevel = Math.min(7, Math.max(1, num(raw.retraining.nextLevel, 1)));
    }
    return s;
  }

  // Platzhalter für spätere Schema-Versionen: unbekannte Versionen → sauberer Neustart.
  function migrate(raw) {
    return defaultState();
  }

  /**
   * Robuster Speicher. `storage` ist ein localStorage-ähnliches Objekt oder null.
   * Fällt bei jedem Fehler auf einen In-Memory-Stand zurück – das Spiel läuft immer weiter.
   */
  function createStore(storage, key) {
    let mem = defaultState();
    let available = false;
    try {
      if (storage) {
        const probe = key + ':probe';
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        available = true;
      }
    } catch (e) { available = false; }

    function load() {
      if (!available) return JSON.parse(JSON.stringify(mem));
      try {
        const txt = storage.getItem(key);
        if (!txt) return defaultState();
        return normalizeState(JSON.parse(txt));
      } catch (e) {
        return defaultState();
      }
    }

    function save(state) {
      mem = JSON.parse(JSON.stringify(state));
      if (!available) return false;
      try { storage.setItem(key, JSON.stringify(state)); return true; } catch (e) { return false; }
    }

    // Lesen → ändern → schreiben in einem Schritt (mehrere iframes teilen sich den Stand).
    function update(fn) {
      const s = load();
      fn(s);
      save(s);
      return s;
    }

    function reset() {
      mem = defaultState();
      if (available) { try { storage.removeItem(key); } catch (e) { /* ignorieren */ } }
      return defaultState();
    }

    return { key, get available() { return available; }, load, save, update, reset };
  }

  return { VERSION, MODES, defaultState, normalizeState, createStore };
});
