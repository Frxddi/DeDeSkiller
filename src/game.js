/*
 * game.js – Oberfläche, Zustand, Ablauf.
 * Benötigt: DESKILL_CONFIG (config.js), TEXTS (texts.js), DeskillRules (rules.js), DeskillState (state.js)
 */
(function () {
  'use strict';

  const CFG = window.DESKILL_CONFIG;
  const R = window.DeskillRules;
  const S = window.DeskillState;
  const T = window.TEXTS;

  // ---------------------------------------------------------------------------
  // Grundlagen
  // ---------------------------------------------------------------------------
  function readParams() {
    const out = {};
    try {
      new URLSearchParams(location.search).forEach((v, k) => { out[k] = v; });
      const h = location.hash.replace(/^#/, '');
      if (h) new URLSearchParams(h).forEach((v, k) => { if (!(k in out)) out[k] = v; });
    } catch (e) { /* ignorieren */ }
    return out;
  }

  const P = readParams();
  const DEV = P.dev === '1';
  // Navigations-Buttons: an, außer CONFIG.showNavigation = false oder ?nav=0 (Moodle). Im Dev-Modus immer an.
  const NAV = DEV || (CFG.showNavigation !== false && P.nav !== '0');
  const COURSE = (P.course || CFG.courseId || 'default').replace(/[^\w.-]/g, '').slice(0, 64) || 'default';
  const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  let ls = null;
  try { ls = window.localStorage; } catch (e) { ls = null; }
  const store = S.createStore(ls, CFG.storageKeyPrefix + COURSE);

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const screenEl = $('#screen');

  function fmt(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const fmtNum = (n) => Math.round(n).toLocaleString('de-DE');

  // Timer/Handler, die beim Bildschirmwechsel aufgeräumt werden
  let timeouts = [];
  let rafs = [];
  let keyHandler = null;
  function later(fn, ms) { const id = setTimeout(fn, ms); timeouts.push(id); return id; }
  function frame(fn) { const id = requestAnimationFrame(fn); rafs.push(id); return id; }
  function cleanup() {
    timeouts.forEach(clearTimeout); timeouts = [];
    rafs.forEach(cancelAnimationFrame); rafs = [];
    keyHandler = null;
    devCurrent = null;
  }
  // true, solange der Hinweis „Bitte zuerst die vorherige Seite abschließen" angezeigt wird
  let waitingForPrevious = false;

  function show(html) {
    cleanup();
    waitingForPrevious = false;
    screenEl.innerHTML = html;
    try { window.scrollTo(0, 0); } catch (e) { /* ignorieren */ }
    renderDev();
  }
  document.addEventListener('keydown', (e) => {
    if (keyHandler && !e.altKey && !e.ctrlKey && !e.metaKey) keyHandler(e);
  });

  // Zustand lesen/schreiben (immer frisch laden: mehrere iframes teilen sich den Stand)
  const load = () => store.load();
  function update(fn) {
    const s = store.update(fn);
    renderScore(s.totalPoints);
    renderDev();
    return s;
  }
  function addSeen(s, rules) {
    rules.forEach((r) => { if (!s.seenRules.includes(r)) s.seenRules.push(r); });
    s.seenRules.sort();
  }

  function link(level) {
    const q = new URLSearchParams();
    if (level != null) q.set('level', level);
    if (P.course) q.set('course', P.course);
    if (DEV) q.set('dev', '1');
    const s = q.toString();
    return location.pathname + (s ? '?' + s : '');
  }

  // ---------------------------------------------------------------------------
  // Kopfzeile
  // ---------------------------------------------------------------------------
  function setHeader(label, offline) {
    const brand = $('#brand');
    brand.textContent = T.title;
    brand.classList.toggle('offline', !!offline);
    if (NAV && !brand.dataset.nav) {
      // Klick auf „Prüfstation" → Übersicht
      brand.dataset.nav = '1';
      brand.classList.add('navlink');
      brand.setAttribute('role', 'link');
      brand.setAttribute('tabindex', '0');
      brand.title = T.nav.brandTitle;
      const go = () => { location.href = link(null); };
      brand.addEventListener('click', go);
      brand.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }
    $('#lvl').textContent = label || '';
    $('#lvl').style.display = label ? '' : 'none';
  }
  function renderScore(total) {
    $('#scoreLabel').textContent = T.pointsLabel;
    $('#score').textContent = fmtNum(total);
  }
  function flashPlus(n) {
    if (!n) return;
    const el = $('#plus');
    el.textContent = (n > 0 ? '+' : '−') + fmtNum(Math.abs(n));
    el.style.color = n > 0 ? '' : 'var(--bad)';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // ---------------------------------------------------------------------------
  // Bauteile als SVG
  // ---------------------------------------------------------------------------
  const COLOR_HEX = { red: '#d9473e', blue: '#3a78d8', green: '#2ea463', yellow: '#e8c430' };

  function partSVG(obj, size) {
    size = size || 150;
    let shape, ty, fs;
    if (obj.shape === 'circle') { shape = 'circle cx="50" cy="52" r="40"'; ty = 52; fs = 36; }
    else if (obj.shape === 'square') { shape = 'rect x="12" y="12" width="78" height="78" rx="7"'; ty = 51; fs = 36; }
    else { shape = 'polygon points="50,7 95,90 5,90"'; ty = 66; fs = 31; }
    const label = [T.colors[obj.color], T.shapes[obj.shape], obj.number, obj.symbol === 'warn' ? T.warnLabel : ''].filter(Boolean).join(', ');
    const warn = obj.symbol === 'warn'
      ? '<g transform="translate(80,15)"><circle r="14" fill="#15181c" stroke="#fff" stroke-width="2"></circle>' +
        '<polygon points="0,-9 9,7 -9,7" fill="#f6c343"></polygon>' +
        '<text x="0" y="5.5" text-anchor="middle" font-size="11" font-weight="900" fill="#15181c" font-family="system-ui,sans-serif">!</text></g>'
      : '';
    return '<svg class="part" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" role="img" aria-label="' + esc(label) + '">' +
      '<' + shape + ' fill="' + COLOR_HEX[obj.color] + '"></' + shape.split(' ')[0] + '>' +
      '<' + shape + ' fill="url(#pat-' + obj.color + ')" stroke="rgba(0,0,0,.45)" stroke-width="2.5"></' + shape.split(' ')[0] + '>' +
      '<text x="50" y="' + ty + '" text-anchor="middle" dominant-baseline="central" font-size="' + fs + '" font-weight="800" ' +
      'fill="#fff" stroke="#15181c" stroke-width="4" paint-order="stroke" font-family="system-ui,-apple-system,Segoe UI,sans-serif">' + obj.number + '</text>' +
      warn + '</svg>';
  }
  function partLabel(obj) {
    return '<div class="part-label">' + esc(T.colors[obj.color]) + ' · ' + esc(T.shapes[obj.shape]) + (obj.symbol === 'warn' ? ' · ⚠' : '') + '</div>';
  }
  function partBlock(obj, size) {
    return '<div class="stack" style="gap:3px;align-items:center">' + partSVG(obj, size) + partLabel(obj) + '</div>';
  }

  const DEC_ICON = { FREIGEBEN: '✅', AUSSORTIEREN: '❌', NACHPRUEFEN: '🔍' };
  const chip = (d) => '<span class="chip ' + d + '">' + DEC_ICON[d] + ' ' + esc(T.decisions[d]) + '</span>';

  function hintFor(obj, rules) {
    return rules.map((r) => (r === 'R1' && obj.color !== 'red') ? T.ruleHints.R1_notRed : T.ruleHints[r]).join(' · ');
  }

  // Modus-Anzeige eines Level-Eintrags, inkl. Bot-Übernahme mitten in der Runde
  function modeIcon(l) {
    return T.modeIcons[l.mode] + (l.takeoverAt != null ? '→' + T.modeIcons.auto : '');
  }
  function modeLabel(l) {
    return l.takeoverAt != null
      ? fmt(T.modeWithTakeover, { mode: T.modeNamesShort[l.mode], k: l.takeoverAt + 1 })
      : T.modeNamesShort[l.mode];
  }

  // Ziel „nach Level n": nächstes Level, nach Level 6 das Finale
  const nextAfter = (n) => (n < 6 ? n + 1 : R.FINALE_LEVEL);

  /**
   * Button-Zeile am Ende eines Bildschirms. next = Level-Nummer, 7 (Finale), 'debrief' oder null.
   * Ohne Navigation (Moodle, ?nav=0) bleibt der Hinweis „Weiter mit der nächsten Seite im Kurs".
   */
  function navRow(next, opts) {
    opts = opts || {};
    if (!NAV) return opts.hint === false ? '' : '<p class="center"><strong>' + T.summary.nextPage + '</strong></p>';
    let label = null;
    if (next === 'debrief') label = T.nav.toDebrief;
    else if (next === R.FINALE_LEVEL) label = T.nav.toFinale;
    else if (next != null) label = fmt(T.nav.nextLevel, { n: next });
    return '<div class="row navrow">' +
      (opts.prev ? '<a class="btn" href="' + link(opts.prev) + '">' + fmt(T.nav.prevLevel, { n: opts.prev }) + '</a>' : '') +
      (label ? '<a class="btn primary" id="navNext" href="' + link(next) + '">' + label + '</a>' : '') +
      '<a class="btn" href="' + link(null) + '">' + T.nav.overview + '</a></div>';
  }

  // Enter auf einem Abschluss-Bildschirm → weiter zum nächsten Level (wenn Navigation an)
  function enterToNext() {
    const a = $('#navNext');
    if (a) onEnter(() => { location.href = a.href; });
  }

  function keyToDecision(e, decisions) {
    const map = { '1': 'FREIGEBEN', '2': 'AUSSORTIEREN', '3': 'NACHPRUEFEN', ArrowLeft: 'FREIGEBEN', ArrowRight: 'AUSSORTIEREN', ArrowDown: 'NACHPRUEFEN', ArrowUp: 'NACHPRUEFEN' };
    const d = map[e.key];
    return d && decisions.includes(d) ? d : null;
  }

  function onEnter(fn) {
    keyHandler = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------
  function route() {
    const lv = P.level;
    if (lv === 'debrief') return debriefScreen();
    if (lv === String(R.FINALE_LEVEL)) return finaleEntry({});
    if (/^[1-6]$/.test(lv || '')) return levelEntry(Number(lv), {});
    return overview();
  }

  // ---------------------------------------------------------------------------
  // Übersicht (ohne Parameter)
  // ---------------------------------------------------------------------------
  function overview() {
    setHeader(T.overviewLabel);
    const st = load();
    let rows = '';
    for (let n = 1; n <= 6; n++) {
      const l = st.levels[n];
      const status = l && l.done
        ? T.overview.done + ' · ' + modeIcon(l) + ' ' + modeLabel(l) + ' · ' + fmtNum(l.points) + ' ' + T.pointsLabel
        : T.overview.open_;
      rows += '<div class="ov"><strong>' + fmt(T.levelLabel, { n }) + '</strong><span class="grow st">' + esc(status) + '</span>' +
        '<a class="btn" href="' + link(n) + '">' + T.overview.open + '</a></div>';
    }
    const fin = st.finale.attempts ? (st.finale.passed ? '✅ ' : '') + fmt(T.debrief.attempts, { n: st.finale.attempts }) : T.overview.open_;
    rows += '<div class="ov"><strong>' + T.overview.finale + '</strong><span class="grow st">' + esc(fin) + '</span><a class="btn" href="' + link(7) + '">' + T.overview.open + '</a></div>';
    rows += '<div class="ov"><strong>' + T.overview.debrief + '</strong><span class="grow st"></span><a class="btn" href="' + link('debrief') + '">' + T.overview.open + '</a></div>';
    show('<div class="card stack"><h1>' + T.overview.heading + '</h1><p class="muted small">' + T.overview.intro + '</p><div class="ovlist">' + rows + '</div></div>');
  }

  // ---------------------------------------------------------------------------
  // Level-Einstieg
  // ---------------------------------------------------------------------------
  function levelEntry(n, ctx) {
    setHeader(fmt(T.levelLabel, { n }));
    const st = load();
    const rec = st.levels[n];
    if (rec && rec.done && !ctx.force) {
      show('<div class="card stack center"><div class="kicker">' + fmt(T.levelLabel, { n }) + '</div>' +
        '<h2>' + modeIcon(rec) + ' ' + esc(fmt(T.alreadyDone, { points: fmtNum(rec.points), mode: modeLabel(rec) })) + '</h2>' +
        navRow(nextAfter(n)) +
        (DEV ? '<div><button class="btn" id="replay">' + T.replayDev + '</button></div>' : '') + '</div>');
      if (DEV) $('#replay').onclick = () => levelEntry(n, Object.assign({}, ctx, { force: true }));
      enterToNext();
      return;
    }
    const prev = st.levels[n - 1];
    if (n > 1 && !(prev && prev.done) && !ctx.anyway) {
      show('<div class="card stack center"><div class="kicker">' + fmt(T.levelLabel, { n }) + '</div>' +
        '<h2>' + T.previousMissing + '</h2><div><button class="btn" id="anyway">' + T.playAnyway + '</button></div>' +
        navRow(null, { prev: n - 1, hint: false }) + '</div>');
      $('#anyway').onclick = () => levelEntry(n, Object.assign({}, ctx, { anyway: true }));
      waitingForPrevious = true;
      return;
    }
    if (n > CFG.automationOfferAfterLevel) modeDialog(n, (mode) => startLevel(n, mode, ctx));
    else startLevel(n, 'manual', ctx);
  }

  function startLevel(n, mode, ctx) {
    // Vorauswahl im Dialog = zuletzt im Dialog gewählter Modus
    if (n > CFG.automationOfferAfterLevel) update((s) => { s.lastMode = mode; });
    if (mode === 'auto') autoIntro(n);
    else ruleIntro(n, mode, ctx, () => playRound(n, mode, ctx));
  }

  // ---------------------------------------------------------------------------
  // Modusdialog
  // ---------------------------------------------------------------------------
  function modeDialog(n, onChoose) {
    const st = load();
    let sel = st.lastMode;
    const D = T.modeDialog;
    const opts = [
      { id: 'auto', desc: D.autoDesc, pts: D.pointsAuto, reco: true },
      { id: 'assist', desc: D.assistDesc, pts: D.pointsAssist },
      { id: 'manual', desc: D.manualDesc, pts: D.pointsManual }
    ];
    const html = '<div class="card stack"><h2>' + esc(fmt(D.heading, { n })) + '</h2><div class="choices" role="radiogroup">' +
      opts.map((o) => '<button class="choice' + (o.reco ? ' recommended' : '') + (sel === o.id ? ' selected' : '') + '" data-mode="' + o.id + '" role="radio" aria-checked="' + (sel === o.id) + '">' +
        '<span class="ico">' + T.modeIcons[o.id] + '</span><span class="name">' + T.modeNames[o.id] + '</span>' +
        '<span class="pts">' + o.pts + '</span><span class="desc">' + o.desc + '</span>' +
        (o.reco ? '<span class="reco">' + D.recommended + '</span>' : '') + '</button>').join('') +
      '</div><button class="btn primary block" id="go"' + (sel ? '' : ' disabled') + '>' + (sel ? D.start : D.choose) + '</button></div>';
    show(html);
    const go = $('#go');
    $$('.choice').forEach((b) => {
      b.onclick = () => {
        sel = b.dataset.mode;
        $$('.choice').forEach((x) => { x.classList.toggle('selected', x === b); x.setAttribute('aria-checked', String(x === b)); });
        go.disabled = false;
        go.textContent = D.start;
      };
    });
    go.onclick = () => { if (sel) onChoose(sel); };
    onEnter(() => { if (sel) onChoose(sel); });
  }

  // ---------------------------------------------------------------------------
  // Regel-Intro
  // ---------------------------------------------------------------------------
  function ruleIntro(n, mode, ctx, onStart) {
    const rule = 'R' + n;
    const st = update((s) => addSeen(s, [rule]));
    const examples = R.examplesFor(n);
    const exHtml = examples.map((ex) => '<div class="example">' +
      (ex.prev
        ? '<div class="pair"><div class="stack" style="gap:2px;align-items:center;opacity:.6">' + partSVG(ex.prev, 64) + '<div class="part-label">' + T.previousLabel + '</div></div><span class="arrow">→</span>' + partBlock(ex.obj, 90) + '</div>'
        : partBlock(ex.obj, 90)) +
      chip(ex.result.decision) +
      // Ab Level 2: Kette zeigt, wie die neue Regel ältere überschreibt
      (n >= 2 ? chainHtml(ex.obj, ex.prev, n) : '') + '</div>').join('');
    const known = R.unlockedRules(n - 1);
    const knownHtml = known.length
      ? '<details class="known"><summary>' + T.intro.known + ' (' + known.length + ')</summary><ul>' +
        known.map((r) => '<li>' + T.rulesShort[r] + '</li>').join('') + '</ul></details>'
      : '';
    show('<div class="card stack">' +
      '<div class="kicker">' + fmt(ctx.retraining ? T.intro.kickerRetraining : T.intro.kicker, { n }) + '</div>' +
      '<p class="rule-big">' + T.rules[rule] + '</p>' +
      '<div class="examples" aria-label="' + T.intro.examples + '">' + exHtml + '</div>' +
      (n >= 2 ? '<p class="small center precedence">↓ ' + T.intro.precedenceNote + '</p>' : '') +
      knownHtml +
      (mode === 'assist' ? '<p class="small muted">🤝 ' + T.intro.assistNote + '</p>' : '') +
      '<button class="btn primary block" id="go">' + T.intro.start + '</button></div>');
    $('#go').onclick = onStart;
    onEnter(onStart);
  }

  // ---------------------------------------------------------------------------
  // Runde (manuell / Assistenz) – auch für die Umschulung
  // ---------------------------------------------------------------------------
  let devCurrent = null;

  // Regeltafel: eine Zeile pro Regel. Freigeschaltet sind alle Regeln bis `level`
  // (Finale = 7 → alle sechs), spätere erscheinen als gesperrte Zeile.
  function rulePanel(level, highlight) {
    const open = R.unlockedRules(level);
    return '<div class="rules" role="note" aria-label="' + T.rulePanel.heading + '">' +
      '<div class="rules-h"><strong>' + T.rulePanel.heading + '</strong> · ' + T.rulePanel.precedence + '</div><ol>' +
      R.RULE_IDS.map((r) => {
        if (!open.includes(r)) {
          return '<li class="locked" data-r="' + r + '"><span class="rid">' + r.slice(1) + '</span><span>🔒 ' + T.rulePanel.locked + '</span></li>';
        }
        return '<li data-r="' + r + '"' + (r === highlight ? ' class="new"' : '') + '><span class="rid">' + r.slice(1) + '</span><span>' +
          esc(T.rulesCompact[r]) + (r === highlight ? ' <span class="newtag">' + T.rulePanel.newTag + '</span>' : '') + '</span></li>';
      }).join('') +
      '</ol></div>';
  }

  /**
   * Zeigt nach einer Entscheidung auf der Regeltafel, was passiert ist:
   * – die Regeln, die die Entscheidung tragen, leuchten auf (grün = richtig, rot = falsch)
   * – ältere Regeln, die auch gepasst hätten, aber von einer neueren geschlagen wurden: „überstimmt"
   * Ohne Argumente: alles zurücksetzen.
   */
  function showOutcome(item, level, ok) {
    $$('.rules li').forEach((li) => {
      li.classList.remove('hit-ok', 'hit-bad', 'overruled');
      const tag = li.querySelector('.overtag');
      if (tag) tag.remove();
    });
    if (!item) return;
    const out = R.ruleOutcome(item.obj, item.prev, level);
    out.winners.forEach((r) => {
      const li = $('.rules li[data-r="' + r + '"]');
      if (!li) return;
      void li.offsetWidth; // Animation neu starten
      li.classList.add(ok ? 'hit-ok' : 'hit-bad');
    });
    out.overruled.forEach((r) => {
      const li = $('.rules li[data-r="' + r + '"]');
      if (!li || li.classList.contains('locked')) return;
      li.classList.add('overruled');
      li.insertAdjacentHTML('beforeend', '<span class="overtag">' + T.rulePanel.overruled + '</span>');
    });
  }

  // Entscheidungskette als kompakte Zeile: R1 ❌ → R2 ✅ → R3 ❌
  function chainHtml(obj, prev, level) {
    return '<span class="chain">' + R.decisionChain(obj, prev, level).map((s) =>
      '<span class="link"><b>' + s.rule + '</b> ' + DEC_ICON[s.decision] + '</span>').join('<span class="arr">→</span>') + '</span>';
  }

  // Layout: Regeltafel links, Objekt rechts, darunter Entscheidungen + Feedback.
  // Ab ~600 px Breite steht die Regeltafel links neben Objekt UND Entscheidungen.
  function roundFrame(opts) {
    const n = opts.decisions.length;
    return '<div class="hud"><span id="prog"></span><span class="grow"></span>' +
      (opts.takeover ? '<button class="btn mini" id="takeover" title="' + esc(T.round.takeoverTitle) + '">' + T.round.takeover + '</button>' : '') +
      (opts.lives ? '<span id="lives" class="lives" aria-label="' + T.finale.errorsLabel + '"></span>' : '') + '</div>' +
      (opts.timer
        ? (opts.hard
          ? '<div class="timer hard"><span id="bar"></span></div>'
          // weicher Balken: beschriftet, damit klar ist, dass er nur Bonuspunkte gibt
          : '<div class="timerrow"><span class="tlabel">⏱ ' + T.round.timeBonus + '</span><div class="timer"><span id="bar"></span></div></div>')
        : '') +
      '<div class="work">' +
      '<aside class="side">' + rulePanel(opts.level, opts.highlight) + '</aside>' +
      '<div class="belt" id="belt"><div class="prev" id="prevSlot"></div><div class="cur" id="curSlot"></div></div>' +
      '<div class="controls">' +
      '<div class="decisions" style="--n:' + n + '">' + opts.decisions.map((d) =>
        '<button class="dec ' + d + '" data-d="' + d + '"><span class="ico">' + DEC_ICON[d] + '</span>' + T.decisions[d] + '<span class="key">' + T.decisionKeys[d] + '</span></button>').join('') + '</div>' +
      '<div class="feedback" id="fb" aria-live="polite"></div>' +
      '</div></div>' +
      '<div class="keyhint">' + (n === 3 ? T.round.keyHint : T.round.keyHintShort) + (opts.assist ? ' · ' + T.round.keyHintAssist : '') + '</div>';
  }

  // fast = Bot-Modus: keine Einlauf-Animation, Dev-Panel nicht bei jedem Bauteil neu zeichnen.
  function placePart(item, fast) {
    $('#prevSlot').innerHTML = item.prev
      ? partSVG(item.prev, 44) + '<div class="part-label">' + T.previousLabel + '</div>'
      : '';
    const cur = $('#curSlot');
    cur.classList.remove('enter');
    if (!fast) void cur.offsetWidth;
    const compact = window.innerWidth < 600 || window.innerHeight < 680;
    cur.innerHTML = partSVG(item.obj, compact ? 108 : 140) + partLabel(item.obj);
    if (!fast) cur.classList.add('enter');
    const belt = $('#belt');
    belt.classList.remove('ok', 'bad');
    showOutcome(null);
    $$('.devbadge', belt).forEach((e) => e.remove());
    devCurrent = item.correct;
    if (DEV) belt.insertAdjacentHTML('beforeend', '<span class="devbadge">DEV: ' + item.correct.decision + ' (' + item.correct.rules.join(',') + ')</span>');
    if (!fast) renderDev();
  }

  /**
   * Der Bot klickt im normalen Spiel-UI sehr schnell durch `items`.
   * Er entscheidet immer richtig (decide()), die entscheidenden Regeln blitzen grün auf.
   */
  function botPlay(items, level, msPerObject, onEach, onDone) {
    $$('.dec').forEach((b) => { b.disabled = false; b.classList.add('botlock'); b.classList.remove('suggested'); });
    let k = 0;
    const step = () => {
      if (k >= items.length) { renderDev(); onDone(); return; }
      const item = items[k];
      placePart(item, true);
      const d = item.correct.decision;
      const btn = $('.dec[data-d="' + d + '"]');
      if (btn) {
        btn.classList.remove('botpress');
        void btn.offsetWidth;
        btn.classList.add('botpress');
      }
      $('#belt').classList.add('ok');
      if (CFG.feedback.highlightRules) showOutcome(item, level, true);
      k++;
      onEach(k, item);
      later(step, msPerObject);
    };
    step();
  }

  function runTimer(seconds, onTimeout) {
    const bar = $('#bar');
    if (!bar) return { stop() {} };
    const t0 = performance.now();
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const p = Math.min(1, (performance.now() - t0) / (seconds * 1000));
      bar.style.transform = 'scaleX(' + (1 - p) + ')';
      if (p < 1) frame(tick);
    };
    bar.style.transform = 'scaleX(1)';
    frame(tick);
    const to = onTimeout ? later(() => { if (!stopped) { stopped = true; onTimeout(); } }, seconds * 1000) : null;
    return { stop() { stopped = true; if (to) clearTimeout(to); } };
  }

  function playRound(n, mode, ctx) {
    const seed = R.randomSeed();
    const seq = R.generateLevel(n, seed);
    const lc = CFG.levels[n];
    const decisions = R.availableDecisions(n);
    const rng = R.makeRng(seed ^ 0x9E3779B9);
    const startTotal = load().totalPoints;
    const comp = R.emptyCompetence();
    const seenViaHint = new Set();
    const started = Date.now();
    const canTakeover = !ctx.retraining && n >= CFG.takeoverFromLevel;
    let i = 0, base = 0, streak = 0, errors = 0, locked = true, answered = false, shownAt = 0, suggestion = null, timer = null, pendingNext = null;

    show(roundFrame({ decisions, timer: !!lc.timeBonus, assist: mode === 'assist', level: n, highlight: 'R' + n, takeover: canTakeover }));
    $$('.dec').forEach((b) => { b.onclick = () => choose(b.dataset.d); });
    if (canTakeover) $('#takeover').onclick = takeover;

    function present() {
      const item = seq[i];
      answered = false;
      $('#prog').textContent = fmt(T.round.progress, { i: i + 1, n: seq.length });
      suggestion = mode === 'assist' ? R.botSuggestion(item.correct.decision, n, rng, CFG.assistErrorRate) : null;
      placePart(item, false);
      $$('.dec').forEach((b) => { b.disabled = false; b.classList.toggle('suggested', b.dataset.d === suggestion); });
      const fb = $('#fb');
      fb.className = 'feedback' + (suggestion ? ' hint' : '');
      fb.innerHTML = suggestion ? '<span>🤖 ' + T.round.suggestion + ': <strong>' + T.decisions[suggestion] + '</strong></span>' : '';
      timer = lc.timeBonus ? runTimer(lc.timeBonus, null) : null;
      shownAt = performance.now();
      locked = false;
      keyHandler = (e) => {
        const d = keyToDecision(e, decisions);
        if (d) { e.preventDefault(); choose(d); }
        else if (e.key === 'Enter' && suggestion) { e.preventDefault(); choose(suggestion); }
      };
    }

    function choose(d) {
      if (locked) return;
      locked = true;
      answered = true;
      if (timer) timer.stop();
      const item = seq[i];
      const elapsed = (performance.now() - shownAt) / 1000;
      const correctD = item.correct.decision;
      const ok = d === correctD;
      R.addCompetence(comp, item.correct.rules, R.competenceCredit({ mode, suggestion, decision: d, correctDecision: correctD }));
      $$('.dec').forEach((b) => { b.disabled = true; });
      if (CFG.feedback.highlightRules) showOutcome(item, n, ok);
      const fb = $('#fb');
      if (ok) {
        streak++;
        const pts = R.decisionPoints(elapsed, lc.timeBonus, streak);
        base += pts;
        renderScore(startTotal + R.roundPoints(base, mode));
        $('#belt').classList.add('ok');
        fb.className = 'feedback ok';
        const ptsHtml = '<span class="pts">+' + pts + (streak >= CFG.points.streakFrom ? ' 🔥' + streak : '') + '</span>';
        // Kette zeigen, wenn mehr als eine Regel beteiligt war
        const chain = R.decisionChain(item.obj, item.prev, n);
        const chainPart = chain.length > 1 ? '<br>' + chainHtml(item.obj, item.prev, n) : '';
        if (CFG.feedback.autoAdvanceCorrect) {
          fb.innerHTML = '<div class="grow"><strong>✓ ' + T.round.correct + '</strong> ' + ptsHtml + chainPart + '</div>';
          keyHandler = null;
          pendingNext = later(next, CFG.feedback.correctMs);
        } else {
          // weiter erst per Klick/Enter
          fb.innerHTML = '<div class="grow"><strong>✓ ' + T.round.correct + '</strong> ' + ptsHtml + chainPart + '</div>' +
            '<button class="btn" id="nextBtn">' + T.round.next + '</button>';
          $('#nextBtn').onclick = next;
          $('#nextBtn').focus({ preventScroll: true });
          onEnter(next);
        }
      } else {
        streak = 0;
        errors++;
        item.correct.rules.forEach((r) => seenViaHint.add(r));
        $('#belt').classList.add('bad');
        fb.className = 'feedback bad';
        fb.innerHTML = '<div class="grow"><strong>' + T.round.wrong + '</strong> ' + esc(fmt(T.round.rightWouldBe, { d: T.decisions[correctD] })) +
          '<br>' + chainHtml(item.obj, item.prev, n) + '</div>' +
          '<button class="btn" id="nextBtn">' + T.round.next + '</button>';
        $('#nextBtn').onclick = next;
        $('#nextBtn').focus({ preventScroll: true });
        onEnter(next);
      }
    }

    function next() {
      keyHandler = null;
      pendingNext = null;
      i++;
      if (i >= seq.length) finish(null);
      else present();
    }

    // „Keine Lust mehr": der Bot prüft die restlichen Bauteile dieser Runde.
    function takeover() {
      if (pendingNext) { clearTimeout(pendingNext); pendingNext = null; }
      if (timer) timer.stop();
      locked = true;
      keyHandler = null;
      const from = answered ? i + 1 : i; // aktuelles Bauteil schon beantwortet?
      const rest = seq.slice(from);
      $('#takeover').remove();
      update((s) => { s.lastMode = 'auto'; }); // beim nächsten Modusdialog ist „Automatisieren" vorausgewählt
      const ownTotal = startTotal + R.roundPoints(base, mode);
      const per = R.takeoverPoints(1);
      const fb = $('#fb');
      fb.className = 'feedback ok';
      if (!rest.length) { finish({ at: from, pts: 0 }); return; }
      botPlay(rest, n, CFG.auto.takeoverMsPerObject, (k) => {
        $('#prog').textContent = fmt(T.round.botRunning, { i: from + k, n: seq.length });
        fb.innerHTML = '<strong>🤖 ✓</strong><span class="grow"></span><span>' + fmt(T.round.botPoints, { p: fmtNum(per * k) }) + '</span>';
        renderScore(ownTotal + per * k);
      }, () => finish({ at: from, pts: R.takeoverPoints(rest.length) }));
    }

    function finish(take) {
      const botPts = take ? take.pts : 0;
      const pts = R.roundPoints(base, mode) + botPts;
      const dur = Date.now() - started + (ctx.introMs || 0);
      const st = update((s) => {
        s.totalPoints += pts;
        R.RULE_IDS.forEach((r) => { s.competence[r].correct += comp[r].correct; });
        addSeen(s, Array.from(seenViaHint));
        if (!ctx.retraining) {
          s.levels[n] = { done: true, mode, points: pts, errors, processed: seq.length, takeoverAt: take ? take.at : null };
        }
        if (n >= CFG.automationOfferAfterLevel) s.automationUnlocked = true;
        if (ctx.retraining) {
          s.retraining.activeMs += dur;
          s.retraining.nextLevel = n + 1;
          if (n === 6) s.retraining.finished = Date.now();
        }
      });
      flashPlus(pts);
      roundSummary(n, { pts, errors, mode, total: st.totalPoints, count: take ? take.at : seq.length, take }, ctx);
    }

    present();
  }

  function roundSummary(n, res, ctx) {
    const S_ = T.summary;
    let foot;
    if (ctx.retraining) {
      foot = n < 6
        ? '<button class="btn primary block" id="go">' + fmt(S_.retrainingNext, { n: n + 1 }) + '</button>'
        : '<button class="btn primary block" id="go">' + S_.retrainingDone + '</button>';
    } else {
      foot = navRow(nextAfter(n));
    }
    show('<div class="card stack"><div class="kicker">' + T.modeIcons[res.mode] + ' ' + T.modeNames[res.mode] + (res.take ? ' → 🤖' : '') + '</div>' +
      '<h2>' + fmt(S_.heading, { n }) + '</h2>' +
      '<div class="stats">' +
      '<div class="stat"><div class="k">' + S_.roundPoints + '</div><div class="v">+' + fmtNum(res.pts) + '</div>' + (res.mode === 'assist' ? '<div class="small muted">' + S_.assistBonus + '</div>' : '') + '</div>' +
      '<div class="stat"><div class="k">' + S_.totalPoints + '</div><div class="v">' + fmtNum(res.total) + '</div></div>' +
      '<div class="stat"><div class="k">' + S_.errors + '</div><div class="v">' + res.errors + ' / ' + res.count + '</div></div>' +
      '</div>' +
      (res.take ? '<p class="small muted">' + fmt(S_.takeoverNote, { k: res.take.at + 1, p: fmtNum(res.take.pts) }) + '</p>' : '') +
      foot + '</div>');
    const go = $('#go');
    if (go) {
      const act = n < 6 ? () => retrainingLevel(n + 1) : retrainingDone;
      go.onclick = act;
      onEnter(act);
    } else {
      enterToNext();
    }
  }

  // ---------------------------------------------------------------------------
  // Automatisierter Durchlauf – der Bot spielt im selben UI, nur sehr schnell
  // ---------------------------------------------------------------------------
  function autoIntro(n) {
    // Die neue Regel wird auch beim Automatisieren freigeschaltet und angezeigt –
    // angewendet wird sie aber nur vom Bot.
    update((s) => addSeen(s, ['R' + n]));
    show('<div class="card stack"><div class="kicker">' + fmt(T.intro.autoKicker, { n }) + '</div>' +
      '<p class="rule-big">' + T.rules['R' + n] + '</p>' +
      '<p class="muted">📡 ' + T.intro.autoTransfer + '</p>' +
      '<div class="timer"><span id="xfer" style="transform:scaleX(0)"></span></div>' +
      '<button class="btn primary block" id="go">🤖 ' + T.intro.autoStart + '</button></div>');
    const bar = $('#xfer');
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 700);
      bar.style.transform = 'scaleX(' + p + ')';
      if (p < 1) frame(tick);
    };
    frame(tick);
    const go = () => autoRun(n);
    $('#go').onclick = go;
    onEnter(go);
  }

  function autoRun(n) {
    const st0 = load();
    const lc = CFG.levels[n];
    const objects = R.autoThroughput(n, st0.upgrades);
    const pts = R.autoPoints(n, objects);
    // Echte Bauteile mit derselben Verteilung wie das Level – der Bot entscheidet per decide().
    const seq = R.generateSequence({
      level: n, count: objects, seed: R.randomSeed(), dist: lc.dist, warnRate: lc.warnRate,
      exact: false, minShares: { ['R' + n]: CFG.minNewRuleShare }
    });
    show(roundFrame({ decisions: R.availableDecisions(n), level: n, highlight: 'R' + n }));
    const fb = $('#fb');
    fb.className = 'feedback ok';
    const per = REDUCED ? Math.max(CFG.auto.minMsPerObject, Math.round(1200 / objects)) : R.botMsPerObject(objects);
    botPlay(seq, n, per, (k) => {
      $('#prog').textContent = fmt(T.round.botRunning, { i: k, n: objects });
      const sofar = Math.round(pts * k / objects);
      fb.innerHTML = '<strong>🤖 ✓ ' + k + '</strong><span class="grow"></span><span>' + fmt(T.round.botPoints, { p: fmtNum(sofar) }) + '</span>';
      renderScore(st0.totalPoints + sofar);
    }, () => {
      update((s) => {
        s.totalPoints += pts;
        s.autoRuns += 1;
        s.levels[n] = { done: true, mode: 'auto', points: pts, errors: 0, processed: objects, takeoverAt: null };
        if (n >= CFG.automationOfferAfterLevel) s.automationUnlocked = true;
      });
      flashPlus(pts);
      later(() => autoResult(n, { objects, pts }), 500);
    });
  }

  function autoResult(n, res) {
    const st = load();
    const eff = R.botEfficiency(st.autoRuns, st.upgrades);
    const ups = CFG.upgrades.map((u) => {
      const owned = st.upgrades.includes(u.id);
      const txt = T.auto.upgrades[u.id] || { name: u.id, desc: '' };
      return '<div class="upgrade"><span style="font-size:20px">⚙️</span><div class="grow"><strong>' + txt.name + '</strong><div class="small muted">' + txt.desc + '</div></div>' +
        (owned ? '<span class="chip FREIGEBEN">✓ ' + T.auto.upgradeBought + '</span>'
          : '<button class="btn" data-up="' + u.id + '"' + (st.totalPoints < u.cost ? ' disabled' : '') + '>' + fmt(T.auto.buy, { cost: fmtNum(u.cost) }) + '</button>') + '</div>';
    }).join('');
    show('<div class="card stack"><div class="kicker">' + fmt(T.levelLabel, { n }) + ' · 🤖 ' + T.modeNames.auto + '</div>' +
      '<h2>' + fmt(T.auto.processed, { n: res.objects }) + ' <span style="color:var(--ok)">+' + fmtNum(res.pts) + ' ' + T.pointsLabel + '</span></h2>' +
      '<div class="stats">' +
      '<div class="stat"><div class="k">' + T.auto.accuracy + '</div><div class="v">100 %</div></div>' +
      '<div class="stat"><div class="k">' + T.auto.points + '</div><div class="v">+' + fmtNum(res.pts) + '</div></div>' +
      '<div class="stat"><div class="k">' + T.auto.total + '</div><div class="v">' + fmtNum(st.totalPoints) + '</div></div>' +
      '<div class="stat"><div class="k">' + T.auto.efficiency + '</div><div class="v' + (st.autoRuns > 1 || st.upgrades.length ? ' up' : '') + '">' + eff + ' %</div></div>' +
      '</div>' +
      '<h3>' + T.auto.upgradesHeading + '</h3><div class="stack" style="gap:6px">' + ups + '</div>' +
      navRow(nextAfter(n)) +
      '</div>');
    enterToNext();
    $$('[data-up]').forEach((b) => {
      b.onclick = () => {
        const u = CFG.upgrades.find((x) => x.id === b.dataset.up);
        let bought = false;
        update((s) => {
          if (!s.upgrades.includes(u.id) && s.totalPoints >= u.cost) { s.totalPoints -= u.cost; s.upgrades.push(u.id); bought = true; }
        });
        if (bought) flashPlus(-u.cost);
        autoResult(n, res);
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Finale
  // ---------------------------------------------------------------------------
  function finaleEntry(ctx) {
    setHeader(T.finaleLabel, true);
    const st = load();
    const f = CFG.finale;
    if (st.finale.attempts > 0 && !ctx.again) {
      const last = st.finale.history[st.finale.history.length - 1] || {};
      show('<div class="card stack center"><div class="kicker">' + T.finaleLabel + '</div>' +
        '<h2>' + esc(fmt(T.finale.alreadyDone, { result: last.passed ? T.finale.passed : T.finale.failed, errors: last.errors || 0 })) + '</h2>' +
        '<div class="row" style="justify-content:center"><button class="btn primary" id="deb">' + T.finale.showDebrief + '</button>' +
        (DEV ? '<button class="btn" id="again">' + T.replayDev + '</button>' : '') + '</div>' +
        navRow(null, { hint: false }) + '</div>');
      $('#deb').onclick = debriefScreen;
      if (DEV) $('#again').onclick = () => finaleEntry({ again: true });
      return;
    }
    const missing = [1, 2, 3, 4, 5, 6].some((l) => !(st.levels[l] && st.levels[l].done));
    if (missing && !ctx.anyway && !ctx.again) {
      show('<div class="card stack center"><div class="kicker">' + T.finaleLabel + '</div><h2>' + T.previousMissingFinale + '</h2>' +
        '<div><button class="btn" id="anyway">' + T.playAnyway + '</button></div>' +
        navRow(null, { hint: false }) + '</div>');
      $('#anyway').onclick = () => finaleEntry(Object.assign({}, ctx, { anyway: true }));
      waitingForPrevious = true;
      return;
    }
    show('<div class="card stack center"><div class="kicker" style="color:var(--bad)">⚠ ' + T.finale.offlineBadge + '</div>' +
      '<h1>' + T.finale.heading + '</h1><p class="rule-big">' + T.finale.text + '</p>' +
      '<p class="muted">' + fmt(T.finale.details, { n: f.objects, s: String(f.secondsPerObject).replace('.', ','), e: f.maxErrors }) + '</p>' +
      '<p class="muted small">' + T.finale.rulesShown + '</p>' +
      '<button class="btn primary block" id="go">' + T.finale.start + '</button></div>');
    const go = () => finaleRun(ctx);
    $('#go').onclick = go;
    onEnter(go);
  }

  function finaleRun(ctx) {
    setHeader(T.finaleLabel, true);
    const f = CFG.finale;
    const seed = R.randomSeed();
    const seq = R.generateFinale(seed);
    const decisions = R.availableDecisions(R.FINALE_RULE_LEVEL);
    const errs = [];
    const times = [];
    const started = Date.now();
    let i = 0, errors = 0, timeouts = 0, locked = true, timer = null, ended = false, shownAt = 0;

    show(roundFrame({ decisions, timer: true, hard: true, lives: true, level: R.FINALE_LEVEL }));
    $$('.dec').forEach((b) => { b.onclick = () => choose(b.dataset.d); });

    function renderLives() {
      $('#lives').innerHTML = '<span class="small" style="margin-right:6px">' + T.finale.errorsLabel + ' ' + errors + '/' + f.maxErrors + '</span>' +
        Array.from({ length: f.maxErrors }, (_, k) => '<i class="' + (k < errors ? 'lost' : '') + '"></i>').join('');
    }

    function present() {
      const item = seq[i];
      $('#prog').textContent = fmt(T.round.progress, { i: i + 1, n: seq.length });
      renderLives();
      placePart(item, '');
      $$('.dec').forEach((b) => { b.disabled = false; });
      $('#fb').className = 'feedback';
      $('#fb').innerHTML = '';
      locked = false;
      shownAt = performance.now();
      timer = runTimer(f.secondsPerObject, () => choose(null));
      keyHandler = (e) => { const d = keyToDecision(e, decisions); if (d) { e.preventDefault(); choose(d); } };
    }

    function choose(d) {
      if (locked) return;
      locked = true;
      keyHandler = null;
      if (timer) timer.stop();
      const item = seq[i];
      const ok = d === item.correct.decision;
      if (d === null) timeouts++;
      else times.push(performance.now() - shownAt);
      $$('.dec').forEach((b) => { b.disabled = true; });
      if (CFG.feedback.highlightRules && CFG.feedback.highlightRulesInFinale) showOutcome(item, R.FINALE_RULE_LEVEL, ok);
      const fb = $('#fb');
      if (ok) {
        $('#belt').classList.add('ok');
        fb.className = 'feedback ok';
        fb.innerHTML = '<strong>✓ ' + T.finale.right + '</strong>';
        later(next, CFG.feedback.finaleCorrectMs);
      } else {
        errors++;
        errs.push({ index: i + 1, obj: item.obj, prev: item.prev, given: d, correct: item.correct.decision, rules: item.correct.rules });
        $('#belt').classList.add('bad');
        fb.className = 'feedback bad';
        fb.innerHTML = '<strong>✗ ' + (d === null ? T.finale.timeout : T.finale.wrong) + '</strong>';
        renderLives();
        if (errors > f.maxErrors) later(() => end(false), CFG.feedback.finaleWrongMs);
        else later(next, CFG.feedback.finaleWrongMs);
      }
    }

    function next() {
      i++;
      if (i >= seq.length) end(true);
      else present();
    }

    function end(passed) {
      if (ended) return;
      ended = true;
      const rec = {
        date: Date.now(), passed, errors, processed: Math.min(i + 1, seq.length), total: seq.length,
        durationMs: Date.now() - started, afterRetraining: !!ctx.afterRetraining, seed, errorsDetail: errs,
        avgReactionMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, timeouts
      };
      update((s) => {
        s.finale.attempts += 1;
        s.finale.passed = s.finale.passed || passed;
        s.finale.history.push(rec);
        if (s.finale.history.length > 10) s.finale.history = s.finale.history.slice(-10);
      });
      show('<div class="card stack center"><h1>' + (passed ? '✅ ' + T.finale.passed : '⛔ ' + T.finale.failed) + '</h1>' +
        '<button class="btn primary block" id="go">' + T.finale.toDebrief + '</button></div>');
      const go = debriefScreen;
      $('#go').onclick = go;
      onEnter(go);
      later(go, 1600);
    }

    present();
  }

  // ---------------------------------------------------------------------------
  // Debriefing
  // ---------------------------------------------------------------------------
  function animateNumber(el, to, ms, suffix) {
    const t0 = performance.now();
    const tick = () => {
      const p = REDUCED ? 1 : Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtNum(to * e) + (suffix || '');
      if (p < 1) frame(tick);
    };
    frame(tick);
  }

  function debriefScreen() {
    setHeader(T.debriefLabel);
    const st = load();
    const DB = T.debrief;
    const last = st.finale.history[st.finale.history.length - 1];
    const scores = R.competenceScores(st.competence);

    // 1. Ergebnis
    const result = last
      ? '<div class="card result"><span class="badge">' + (last.passed ? '✅' : '⛔') + '</span><div><h2>' + (last.passed ? DB.passed : DB.failed) + '</h2>' +
        '<p class="muted small">' + fmt(DB.errorsLine, { e: last.errors, n: last.processed, total: last.total }) +
        (st.finale.attempts > 1 ? ' · ' + fmt(DB.attempts, { n: st.finale.attempts }) : '') + '</p>' +
        (last.avgReactionMs != null || last.timeouts
          ? '<p class="muted small">⏱ ' + (last.avgReactionMs != null
            ? fmt(DB.speedLine, { t: (last.avgReactionMs / 1000).toFixed(1).replace('.', ','), x: last.timeouts || 0 })
            : fmt(DB.timeoutsOnly, { x: last.timeouts || 0 })) + '</p>'
          : '') + '</div></div>'
      : '<div class="card"><p class="muted">' + DB.noFinale + '</p></div>';

    // 2. Enthüllung
    const reveal = '<div class="card stack"><p class="muted small">' + DB.revealIntro + '</p><div class="reveal">' +
      '<div class="big points"><div class="k">' + DB.points + '</div><div class="v" id="vPts">0</div></div>' +
      '<div class="big comp" id="compBox"><div class="k">' + DB.competence + '</div><div class="v" id="vComp">0 %</div></div>' +
      '</div><p class="muted small">' + fmt(DB.competenceNote, { t: CFG.masteryThreshold }) + '</p></div>';

    // 3a. Zeitleiste
    let tl = '';
    for (let n = 1; n <= 6; n++) {
      const l = st.levels[n];
      const label = !(l && l.done) ? DB.notPlayed
        : l.takeoverAt != null ? fmt(DB.takeoverShort, { k: l.takeoverAt + 1 })
        : T.modeNamesShort[l.mode];
      tl += '<div class="tl"><span class="ico">' + (l && l.done ? modeIcon(l) : '–') + '</span><span class="n">L' + n + '</span><br>' +
        '<span class="small">' + label + '</span></div>';
    }
    const timeline = '<div class="card stack"><h3>' + DB.timelineHeading + '</h3><div class="timeline">' + tl + '</div></div>';

    // 3b. Kompetenz pro Regel
    const bars = R.RULE_IDS.map((r) => {
      const count = st.competence[r].correct;
      const pct = Math.round(scores[r] * 100);
      const countTxt = count > 0
        ? '<span class="muted small">' + fmt(DB.practiced, { n: String(Math.round(count * 10) / 10).replace('.', ',') }) + '</span>'
        : '<span class="tag">' + DB.neverPracticed + '</span>';
      return '<div class="bar"><div class="top"><span class="id">' + r + '</span><span class="txt">' + T.rulesShort[r] + '<br>' + countTxt +
        '</span><span class="pct">' + pct + ' %</span></div>' +
        '<div class="track"><div class="fill" data-w="' + pct + '"></div></div></div>';
    }).join('');
    const rulesCard = '<div class="card stack"><h3>' + DB.rulesHeading + '</h3><p class="small">' + DB.rulesVisibleNote + '</p><div class="bars">' + bars + '</div></div>';

    // 3c. Fehler im Finale
    let errCard = '';
    if (last && last.errorsDetail && last.errorsDetail.length) {
      errCard = '<div class="card stack"><h3>' + DB.errorsHeading + '</h3><div class="errlist">' +
        last.errorsDetail.map((e) => '<div class="err">' +
          (e.prev ? '<span style="opacity:.5">' + partSVG(e.prev, 34) + '</span>' : '') + partSVG(e.obj, 52) +
          '<div class="grow">' + DB.yourAnswer + ': <strong>' + (e.given ? T.decisions[e.given] : DB.timeoutAnswer) + '</strong> · ' +
          DB.correctAnswer + ': ' + chip(e.correct) + '<br><span class="muted">' + T.ruleHintPrefix + esc(hintFor(e.obj, e.rules)) +
          ' (' + e.rules.join(', ') + ')</span></div></div>').join('') + '</div></div>';
    }

    // 4. Reflexion
    const refl = '<div class="card stack"><h3>' + DB.reflectionHeading + '</h3><ul class="q">' +
      DB.reflection.map((q) => '<li>' + q + '</li>').join('') + '</ul>' +
      '<h3>' + DB.researchHeading + '</h3><p class="placeholder">' + DB.research + '</p></div>';

    // 5. Umschulung
    const rt = st.retraining;
    let rtInner;
    if (rt.started && !rt.finished) {
      rtInner = '<button class="btn primary block" id="rtGo">' + fmt(DB.retrainingContinue, { n: rt.nextLevel }) + '</button>';
    } else if (rt.finished) {
      rtInner = '<p><strong>⏱ ' + fmt(DB.retrainingTime, { m: Math.max(1, Math.round(rt.activeMs / 60000)) }) + '</strong></p>' +
        '<div class="row"><button class="btn primary" id="again">' + DB.newAttempt + '</button><button class="btn" id="rtGo">' + DB.retrainingStart + '</button></div>';
    } else {
      rtInner = '<button class="btn primary block" id="rtGo">' + DB.retrainingStart + '</button>';
    }
    const retrain = '<div class="card stack"><h3>' + DB.retrainingHeading + '</h3><p class="small muted">' + DB.retrainingText + '</p>' + rtInner + '</div>';

    show('<h1>' + DB.heading + '</h1>' + result + reveal + timeline + rulesCard + errCard + refl + retrain +
      navRow(null, { hint: false }));

    animateNumber($('#vPts'), st.totalPoints, 1300);
    later(() => {
      $('#compBox').classList.add('shown');
      animateNumber($('#vComp'), Math.round(scores.total * 100), 1300, ' %');
      later(() => $$('.fill').forEach((el) => { el.style.width = el.dataset.w + '%'; }), 300);
    }, REDUCED ? 0 : 1100);

    const rtGo = $('#rtGo');
    if (rtGo) rtGo.onclick = () => (rt.started && !rt.finished) ? retrainingLevel(rt.nextLevel) : startRetraining();
    const again = $('#again');
    if (again) again.onclick = () => finaleEntry({ again: true, afterRetraining: true });
  }

  // ---------------------------------------------------------------------------
  // Umschulung
  // ---------------------------------------------------------------------------
  function startRetraining() {
    update((s) => { s.retraining = { started: Date.now(), finished: null, activeMs: 0, nextLevel: 1 }; });
    retrainingLevel(1);
  }

  function retrainingLevel(n) {
    if (n > 6) return retrainingDone();
    setHeader(fmt(T.intro.kickerRetraining, { n }));
    const introAt = Date.now();
    const ctx = { retraining: true };
    ruleIntro(n, 'manual', ctx, () => { ctx.introMs = Date.now() - introAt; playRound(n, 'manual', ctx); });
  }

  function retrainingDone() {
    setHeader(T.debrief.retrainingHeading);
    const st = load();
    show('<div class="card stack center"><div class="kicker">' + T.debrief.retrainingHeading + '</div>' +
      '<h1>⏱ ' + fmt(T.debrief.retrainingTime, { m: Math.max(1, Math.round(st.retraining.activeMs / 60000)) }) + '</h1>' +
      '<div class="row" style="justify-content:center"><button class="btn primary" id="again">' + T.debrief.newAttempt + '</button>' +
      '<button class="btn" id="deb">' + T.finale.showDebrief + '</button></div></div>');
    const again = () => finaleEntry({ again: true, afterRetraining: true });
    $('#again').onclick = again;
    $('#deb').onclick = debriefScreen;
    onEnter(again);
  }

  // ---------------------------------------------------------------------------
  // Dev-Modus
  // ---------------------------------------------------------------------------
  function buildProfile(kind) {
    const s = S.defaultState();
    const rng = R.makeRng(4242);
    for (let n = 1; n <= 6; n++) {
      let mode = 'manual';
      if (n > CFG.automationOfferAfterLevel) {
        if (kind === 'assist') mode = 'assist';
        else if (kind === 'auto3') mode = 'auto';
        else if (kind === 'auto5' && n >= 5) mode = 'auto';
      }
      if (mode === 'auto') {
        const objects = R.autoThroughput(n, s.upgrades);
        const pts = R.autoPoints(n, objects);
        s.autoRuns++;
        s.totalPoints += pts;
        s.levels[n] = { done: true, mode, points: pts, errors: 0, processed: objects };
        continue;
      }
      const seq = R.generateLevel(n, 900 + n);
      let base = 0, streak = 0, errors = 0;
      for (const x of seq) {
        const correctD = x.correct.decision;
        const options = R.availableDecisions(n);
        const suggestion = mode === 'assist' ? R.botSuggestion(correctD, n, rng, CFG.assistErrorRate) : null;
        let d;
        if (mode === 'assist') d = suggestion === correctD ? correctD : (rng.chance(0.6) ? correctD : suggestion);
        else d = rng.chance(0.93) ? correctD : rng.pick(options.filter((o) => o !== correctD));
        R.addCompetence(s.competence, x.correct.rules, R.competenceCredit({ mode, suggestion, decision: d, correctDecision: correctD }));
        if (d === correctD) { streak++; base += R.decisionPoints(2, CFG.levels[n].timeBonus, streak); }
        else { streak = 0; errors++; }
      }
      const pts = R.roundPoints(base, mode);
      s.totalPoints += pts;
      s.levels[n] = { done: true, mode, points: pts, errors, processed: seq.length };
      addSeen(s, ['R' + n]);
    }
    s.automationUnlocked = true;
    s.lastMode = s.levels[6].mode;
    return s;
  }

  function renderDev() {
    if (!DEV) return;
    const st = load();
    const sc = R.competenceScores(st.competence);
    const el = $('#dev');
    const lv = [1, 2, 3, 4, 5, 6, 7].map((n) => '<a class="btn" href="' + link(n) + '">' + (n === 7 ? 'Finale' : 'L' + n) + '</a>').join('') +
      '<a class="btn" href="' + link('debrief') + '">Debrief</a><a class="btn" href="' + link(null) + '">Übersicht</a>';
    el.className = 'dev';
    el.innerHTML = '<h3>' + T.dev.heading + '</h3>' +
      '<div class="row">' + lv + '</div>' +
      '<div class="row"><strong>' + T.dev.profiles + ':</strong>' +
      '<button class="btn" data-prof="manual">' + T.dev.profileManual + '</button>' +
      '<button class="btn" data-prof="auto3">' + T.dev.profileAuto + '</button>' +
      '<button class="btn" data-prof="auto5">' + T.dev.profileAuto5 + '</button>' +
      '<button class="btn" data-prof="assist">' + T.dev.profileAssist + '</button>' +
      '<button class="btn" id="devReset" style="border-color:var(--bad)">' + T.dev.reset + '</button></div>' +
      '<div class="row"><strong>' + T.dev.current + ':</strong> <code>' + (devCurrent ? devCurrent.decision + ' (' + devCurrent.rules.join(', ') + ')' : '–') + '</code></div>' +
      '<div class="row"><strong>' + T.dev.competence + ':</strong><table><tr>' + R.RULE_IDS.map((r) => '<th>' + r + '</th>').join('') + '<th>Σ</th></tr><tr>' +
      R.RULE_IDS.map((r) => '<td>' + st.competence[r].correct + ' → ' + Math.round(sc[r] * 100) + '%</td>').join('') + '<td>' + Math.round(sc.total * 100) + '%</td></tr></table></div>' +
      '<div class="small muted">' + T.dev.storageKey + ': <code>' + esc(store.key) + '</code>' + (store.available ? '' : ' (nicht verfügbar)') + '</div>' +
      '<details><summary>' + T.dev.state + '</summary><pre>' + esc(JSON.stringify(st, null, 2)) + '</pre></details>';
    $$('[data-prof]', el).forEach((b) => {
      b.onclick = () => { store.save(buildProfile(b.dataset.prof)); renderScore(load().totalPoints); route(); };
    });
    $('#devReset', el).onclick = () => {
      if (window.confirm(T.dev.resetConfirm)) { store.reset(); renderScore(0); route(); }
    };
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  function init() {
    renderScore(load().totalPoints);
    if (!store.available) $('#notice').innerHTML = '<div class="notice">' + T.storageWarning + '</div>';
    window.addEventListener('storage', (e) => {
      if (e.key !== store.key) return;
      renderScore(load().totalPoints);
      renderDev();
      // Vorherige Seite wurde in einem anderen iframe abgeschlossen → Hinweis durch das Level ersetzen
      if (waitingForPrevious) route();
    });
    route();
  }

  init();
})();
