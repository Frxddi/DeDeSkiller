// Monte-Carlo-Simulation zur Kalibrierung des Finales (Briefing Abschnitt 7, erweitert um ein Zeitmodell).
// Nutzt dieselbe rules.js und denselben Finale-Generator wie das Spiel.
//
//   node tests/simulate.mjs            → Tabellen (Markdown) + Prüfung der Akzeptanzkriterien
//   node tests/simulate.mjs --runs 2000
//   node tests/simulate.mjs --json
//
// Exit-Code 1, wenn die Akzeptanzkriterien mit der Standardkonfiguration nicht erfüllt sind.
//
// ZEITMODELL
// Im Finale sind alle Regeln auf der Tafel sichtbar. Niemand scheitert also an fehlendem Wissen,
// sondern daran, wie schnell und sicher man die Regeln anwenden kann:
//   Zeit = (T0 + SCAN × #ungeübte Regeln + Σ zutreffende Regeln: geübt ? C_P : C_U) × Rauschen
//   – T0:   Wahrnehmen + Klicken
//   – SCAN: ungeübte Regeln muss man bei jedem Bauteil auf der Tafel nachsehen
//   – C_P / C_U: Anwenden einer zutreffenden Regel, geübt bzw. ungeübt (nachlesen, verstehen)
//   – Rauschen: log-normal
// Zeit > Limit → Fehler (Zeit abgelaufen). Sonst richtig mit 1 − (E_BASE + E_U × #zutreffende ungeübte Regeln).
// ALLE PARAMETER SIND ANNAHMEN und müssen in Playtests überprüft werden.
import Rules from '../src/rules.js';

const args = process.argv.slice(2);
const RUNS = Number(args[args.indexOf('--runs') + 1]) || 10000;
const JSON_OUT = args.includes('--json');
const CFG = Rules.CONFIG;
const OPTIONS = Rules.availableDecisions(6);

export const MODEL = {
  T0: 0.8,       // s
  SCAN: 0.35,    // s pro ungeübter Regel
  C_P: 0.3,      // s pro zutreffender, geübter Regel
  C_U: 1.2,      // s pro zutreffender, ungeübter Regel
  SIGMA: 0.3,    // Streuung (log-normal)
  E_BASE: 0.03,  // Grundfehlerquote
  E_U: 0.08      // zusätzliche Fehlerquote pro zutreffender ungeübter Regel
};

function gauss(rng) {
  // Box-Muller
  const u = 1 - rng.next(), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function wrongOther(decision, rng) {
  return rng.pick(OPTIONS.filter((d) => d !== decision));
}

// Spielertyp mit geübten Regeln `practiced`. Liefert { decision | null (Timeout), time }.
function practicedPlayer(practiced) {
  const P = new Set(practiced);
  const unpracticed = Rules.RULE_IDS.filter((r) => !P.has(r));
  return (x, rng, limit, m) => {
    const trig = Rules.triggeredRules(x.obj, x.prev, 6);
    const trigU = trig.filter((r) => !P.has(r)).length;
    const trigP = trig.length - trigU;
    const t = (m.T0 + m.SCAN * unpracticed.length + m.C_P * trigP + m.C_U * trigU) * Math.exp(m.SIGMA * gauss(rng));
    if (t > limit) return { decision: null, time: limit };
    const correct = x.correct.decision;
    const pErr = Math.min(0.9, m.E_BASE + m.E_U * trigU);
    return { decision: rng.chance(pErr) ? wrongOther(correct, rng) : correct, time: t };
  };
}

const PLAYERS = [
  { id: 'T1', name: 'Alles selbst gespielt (R1–R6 geübt)', fn: practicedPlayer(['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) },
  { id: 'T3', name: 'Ab Level 5 automatisiert (R1–R4 geübt)', fn: practicedPlayer(['R1', 'R2', 'R3', 'R4']) },
  { id: 'T2', name: 'Ab Level 3 automatisiert (R1–R2 geübt)', fn: practicedPlayer(['R1', 'R2']) },
  { id: 'T4', name: 'Zufallsrater', fn: (x, rng) => ({ decision: rng.pick(OPTIONS), time: 0.6 }) }
];

// Finalsequenzen einmal erzeugen und für alle Varianten wiederverwenden.
const SEQS = Array.from({ length: RUNS }, (_, i) => Rules.generateFinale(1000003 * (i + 1)));

function simulate(player, limit, model, maxErrors) {
  const rng = Rules.makeRng(0xC0FFEE ^ (player.id.charCodeAt(1) * 7919));
  let correct = 0, total = 0, passed = 0, errSum = 0, timeouts = 0, timeSum = 0, answered = 0;
  for (const seq of SEQS) {
    let errors = 0;
    for (const x of seq) {
      const r = player.fn(x, rng, limit, model);
      total++;
      if (r.decision === null) timeouts++;
      else { timeSum += r.time; answered++; }
      if (r.decision === x.correct.decision) correct++;
      else errors++;
    }
    if (errors <= maxErrors) passed++;
    errSum += errors;
  }
  return {
    id: player.id, name: player.name,
    accuracy: correct / total,
    timeoutRate: timeouts / total,
    meanTime: answered ? timeSum / answered : 0,
    meanErrors: errSum / SEQS.length,
    passRate: passed / SEQS.length
  };
}

const F = CFG.finale;
const results = PLAYERS.map((p) => simulate(p, F.secondsPerObject, MODEL, F.maxErrors));
const by = Object.fromEntries(results.map((r) => [r.id, r]));

// Sensitivität 1: Zeitlimit
const LIMITS = [2.5, 3, 3.5, 4, 4.5, 5];
const byLimit = LIMITS.map((l) => ({ limit: l, rows: PLAYERS.slice(0, 3).map((p) => simulate(p, l, MODEL, F.maxErrors)) }));
// Sensitivität 2: Annahmen zum Nachlesen (C_U) und Tempo geübter Personen (T0)
const VARIANTS = [
  { label: 'Nachlesen schneller (C_U 0,8 s)', m: { ...MODEL, C_U: 0.8 } },
  { label: 'Nachlesen langsamer (C_U 1,6 s)', m: { ...MODEL, C_U: 1.6 } },
  { label: 'Alle langsamer (T0 1,2 s)', m: { ...MODEL, T0: 1.2 } },
  { label: 'Mehr Streuung (σ 0,45)', m: { ...MODEL, SIGMA: 0.45 } }
];
const byVariant = VARIANTS.map((v) => ({ label: v.label, rows: PLAYERS.slice(0, 3).map((p) => simulate(p, F.secondsPerObject, v.m, F.maxErrors)) }));

const criteria = [
  { text: 'Typ 1 (alles selbst gespielt) besteht ≥ 75 %', ok: by.T1.passRate >= 0.75 },
  { text: 'Typ 2 (ab Level 3 automatisiert) besteht ≤ 10 %', ok: by.T2.passRate <= 0.10 },
  { text: 'Typ 3 (ab Level 5 automatisiert) liegt sichtbar dazwischen (≥ 15 Prozentpunkte Abstand zu beiden)',
    ok: by.T3.passRate - by.T2.passRate >= 0.15 && by.T1.passRate - by.T3.passRate >= 0.15 }
];

const pct = (x) => (x * 100).toFixed(1).replace('.', ',') + ' %';
const dec = (x, n = 2) => x.toFixed(n).replace('.', ',');

if (JSON_OUT) {
  console.log(JSON.stringify({ runs: RUNS, finale: F, model: MODEL, results, byLimit, byVariant, criteria }, null, 2));
} else {
  console.log(`Finale: ${F.objects} Objekte, ${dec(F.secondsPerObject, 1)} s pro Objekt, max. ${F.maxErrors} Fehler, ` +
    `Verteilung ${JSON.stringify(F.dist)}, ${RUNS} Durchläufe pro Typ`);
  console.log(`Zeitmodell (Annahmen): ${JSON.stringify(MODEL)}\n`);
  console.log('| Spielertyp | Genauigkeit pro Objekt | Ø Reaktionszeit | Zeit abgelaufen | Ø Fehler | Bestehensquote |');
  console.log('|---|---:|---:|---:|---:|---:|');
  for (const r of results)
    console.log(`| ${r.name} | ${pct(r.accuracy)} | ${dec(r.meanTime, 1)} s | ${pct(r.timeoutRate)} | ${dec(r.meanErrors)} | **${pct(r.passRate)}** |`);

  console.log('\nSensitivität: Bestehensquote nach Zeitlimit pro Objekt\n');
  console.log('| Zeitlimit | ' + PLAYERS.slice(0, 3).map((p) => p.name).join(' | ') + ' |');
  console.log('|---:|' + PLAYERS.slice(0, 3).map(() => '---:').join('|') + '|');
  for (const b of byLimit)
    console.log(`| ${dec(b.limit, 1)} s${b.limit === F.secondsPerObject ? ' ◀' : ''} | ` + b.rows.map((r) => pct(r.passRate)).join(' | ') + ' |');

  console.log(`\nSensitivität: Bestehensquote bei anderen Modellannahmen (Zeitlimit ${dec(F.secondsPerObject, 1)} s)\n`);
  console.log('| Annahme | ' + PLAYERS.slice(0, 3).map((p) => p.name).join(' | ') + ' |');
  console.log('|---|' + PLAYERS.slice(0, 3).map(() => '---:').join('|') + '|');
  for (const v of byVariant) console.log(`| ${v.label} | ` + v.rows.map((r) => pct(r.passRate)).join(' | ') + ' |');

  console.log('\nAkzeptanzkriterien:');
  for (const c of criteria) console.log(`  ${c.ok ? '✔' : '✖'} ${c.text}`);
}

if (!criteria.every((c) => c.ok)) process.exitCode = 1;
