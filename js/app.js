/*
 * Forge Your Coin - game engine.
 * State, localization, the level map, step rendering, XP, achievements,
 * the Codex (glossary), the Coin Atlas and the final coin passport.
 */
(function () {
  'use strict';
  const F = window.FYC;
  const C = F.crypto;
  const { el, svg } = F;
  const { note, btn, big } = F.util;

  // ---------- state ----------
  const SAVE_KEY = 'fyc.save.v1';
  const fresh = () => ({ lang: null, xp: 0, got: {}, done: {}, perfect: {}, coin: {}, ach: {}, codex: {}, wallet: null, seed: null, arch: null, paths: {} });
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(fresh(), JSON.parse(raw));
    } catch (e) { /* storage unavailable: play without saving */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }
  let S = load();
  if (!F.locales[S.lang]) {
    const preferred = (navigator.language || 'en').slice(0, 2).toLowerCase();
    S.lang = F.locales[preferred] ? preferred : 'en';
  }

  // ---------- localization ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const look = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const raw = (path) => {
    const v = look(F.locales[S.lang], path);
    return v == null ? look(F.locales.en, path) : v;
  };
  function coin() {
    return { name: S.coin.name || raw('ui.defCoin'), tkr: S.coin.ticker || 'COIN', ver: S.coin.ver || 0 };
  }
  function fill(s, vars) {
    const c = coin();
    const all = Object.assign({ coin: c.name, tkr: c.tkr }, vars || {});
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in all ? esc(all[k]) : m));
  }
  // Locale strings are trusted HTML; every interpolated value is escaped.
  const t = (path, vars) => { const v = raw(path); return v == null ? path : fill(v, vars); };
  const ta = (path, vars) => (raw(path) || []).map((s) => fill(s, vars));

  // ---------- derived state ----------
  let walletCache = null;
  function wallet() {
    if (!S.wallet) { S.wallet = { priv: C.randomPriv().toString(16).padStart(64, '0') }; save(); }
    const ver = coin().ver;
    if (!walletCache || walletCache.priv !== S.wallet.priv || walletCache.ver !== ver) {
      const d = BigInt('0x' + S.wallet.priv);
      const Q = C.pubPoint(d);
      walletCache = { priv: S.wallet.priv, ver, d, Q, pubHex: C.pubHex(Q), addr: C.address(Q, ver) };
    }
    return walletCache;
  }
  const onPath = (l) => !l.br || S.coin[l.br[0]] === l.br[1];
  const undecided = (l) => !!l.br && S.coin[l.br[0]] == null;
  const pathLevels = () => F.levels.filter(onPath);
  const nextLevel = () => pathLevels().find((l) => !S.done[l.id]);
  function isOpen(l) {
    if (!onPath(l)) return false;
    const nx = nextLevel();
    return !!S.done[l.id] || nx === l;
  }
  function progress() {
    const forks = new Set(F.levels.filter((l) => l.br).map((l) => l.br[0])).size;
    const total = F.levels.filter((l) => !l.br).length + forks;
    const done = pathLevels().filter((l) => S.done[l.id]).length;
    return { done, total, pct: Math.round((done / total) * 100) };
  }
  function rank() {
    let i = 0;
    F.ranks.forEach((x, k) => { if (S.xp >= x) i = k; });
    const next = F.ranks[i + 1];
    return { i, name: raw('ranks')[i], next, pct: next ? ((S.xp - F.ranks[i]) / (next - F.ranks[i])) * 100 : 100 };
  }
  const count = (o) => Object.keys(o).length;

  // ---------- rewards ----------
  let session = 0;
  function grant(key, amount) {
    if (S.got[key]) return;
    S.got[key] = 1;
    S.xp += amount;
    session += amount;
    save();
    renderTop();
  }
  function toast(cls, title, text) {
    const box = document.getElementById('toasts');
    const n = el('div', { class: 'toast ' + cls }, el('b', {}, title), el('div', {}, text || ''));
    box.append(n);
    setTimeout(() => n.classList.add('out'), 4200);
    setTimeout(() => n.remove(), 4800);
  }
  function unlock(id) {
    if (S.ach[id] || !F.achievements.includes(id)) return;
    S.ach[id] = 1;
    save();
    const a = raw('ach.' + id);
    toast('ach', '★ ' + t('ui.achUnlocked'), a[0]);
    renderTop();
  }
  function learn(ids) {
    let fresh = false;
    ids.forEach((id) => { if (!S.codex[id]) { S.codex[id] = 1; fresh = true; } });
    if (fresh) { save(); renderTop(); }
    if (count(S.codex) >= F.scholarAt) unlock('scholar');
  }

  // ---------- chrome ----------
  const $top = document.getElementById('top');
  const $view = document.getElementById('view');
  let screen = { name: 'map' };

  function renderTop() {
    const r = rank(), p = progress(), c = coin();
    $top.replaceChildren(
      el('button', { class: 'brand', type: 'button', onclick: showMap },
        el('span', { class: 'logo' }, c.tkr[0]), el('span', {}, 'Forge Your Coin')),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('small', {}, t('ui.rank')), el('b', {}, r.name)),
        el('div', { class: 'stat grow' }, el('small', {}, S.xp + ' XP' + (r.next ? ' / ' + r.next : '')),
          el('div', { class: 'bar' }, el('i', { style: 'width:' + r.pct + '%' }))),
        el('div', { class: 'stat grow' }, el('small', {}, t('ui.progress') + ' ' + p.pct + '%'),
          el('div', { class: 'bar' }, el('i', { style: 'width:' + p.pct + '%' })))),
      el('nav', {},
        btn(t('ui.map'), showMap, 'ghost'),
        btn('Codex ' + count(S.codex) + '/' + count(F.terms), showCodex, 'ghost'),
        btn('Atlas', showAtlas, 'ghost'),
        btn('★ ' + count(S.ach) + '/' + F.achievements.length, showAchievements, 'ghost'),
        el('div', { class: 'lang' }, Object.keys(F.locales).map((l) =>
          el('button', { class: l === S.lang ? 'on' : '', type: 'button', onclick: () => setLang(l) }, F.locales[l].meta.code)))));
  }
  function setLang(l) {
    if (l === S.lang) return;
    S.lang = l;
    save();
    document.documentElement.lang = l;
    renderTop();
    if (screen.name === 'map') showMap();
    else if (screen.name === 'level') renderStep();
    else if (screen.name === 'complete') showComplete(screen.lv, screen.gained);
    unlock('polyglot');
  }

  // ---------- modal ----------
  const $modal = document.getElementById('modal');
  function openModal(title, body) {
    $modal.replaceChildren(el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'sheet-h' }, el('h2', {}, title), btn('×', closeModal, 'ghost close')), body));
    $modal.classList.add('open');
  }
  function closeModal() { $modal.classList.remove('open'); $modal.replaceChildren(); }
  $modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  function termCard(id, known) {
    return el('div', { class: 'term-card' + (known ? '' : ' locked') },
      el('b', {}, known ? F.terms[id] : '???'),
      el('div', { html: known ? t('codex.' + id) : t('ui.termLocked') }));
  }
  function showCodex() {
    const list = el('div', { class: 'codex' });
    const search = el('input', { placeholder: t('ui.search'), oninput: draw });
    function draw() {
      const q = search.value.trim().toLowerCase();
      const ids = Object.keys(F.terms).sort((a, b) => F.terms[a].localeCompare(F.terms[b]));
      list.replaceChildren(...ids
        .filter((id) => !q || (S.codex[id] && (F.terms[id].toLowerCase().includes(q) || String(raw('codex.' + id)).toLowerCase().includes(q))))
        .map((id) => termCard(id, !!S.codex[id])));
    }
    draw();
    openModal('Codex — ' + count(S.codex) + ' / ' + count(F.terms), el('div', {}, el('p', { class: 'hint' }, t('ui.codexHint')), search, list));
  }
  function showAtlas() {
    const h = raw('atlas.h');
    const table = el('table', { class: 'atlas' },
      el('tr', {}, h.map((x) => el('th', {}, x))),
      F.atlas.map((r) => el('tr', {},
        el('td', {}, el('b', {}, r.name), ' ', el('span', { class: 'mono' }, r.tkr)), el('td', {}, r.type), el('td', {}, r.cons),
        el('td', {}, r.model), el('td', {}, r.time), el('td', { html: t('atlas.n.' + r.id) }))));
    openModal('Coin Atlas', el('div', {}, el('p', { class: 'hint' }, t('atlas.intro')), el('div', { class: 'scroll-x' }, table)));
  }
  function showAchievements() {
    openModal(t('ui.achievements') + ' — ' + count(S.ach) + ' / ' + F.achievements.length,
      el('div', { class: 'ach-grid' }, F.achievements.map((id) => {
        const a = raw('ach.' + id);
        return el('div', { class: 'ach' + (S.ach[id] ? ' on' : '') }, el('span', { class: 'star' }, '★'), el('div', {}, el('b', {}, a[0]), el('div', {}, a[1])));
      })));
  }

  // ---------- map ----------
  function showMap() {
    closeModal();
    screen = { name: 'map' };
    const nx = nextLevel();
    const p = progress();
    const hero = el('section', { class: 'hero' },
      el('div', {},
        el('h1', {}, p.done ? t('ui.heroBack') : t('ui.heroTitle')),
        el('p', { html: p.done ? t('ui.heroBackText', { pct: p.pct, done: p.done, total: p.total }) : t('ui.heroText') }),
        p.done ? null : el('ul', {}, ta('ui.heroPoints').map((x) => el('li', { html: x }))),
        nx ? btn((p.done ? t('ui.continue') : t('ui.start')) + ': ' + t('levels.' + nx.id + '.title'), () => openLevel(nx.id), 'primary large')
          : el('div', { class: 'row-btns' }, btn(t('ui.viewPassport'), () => openLevel('passport'), 'primary large'), btn(t('ui.newRun'), newRun, 'large'))),
      coinCard());

    // Group levels into chapters, and branch alternatives into one slot.
    const chapters = new Map();
    let slot = 0;
    F.levels.forEach((l) => {
      if (!chapters.has(l.ch)) chapters.set(l.ch, []);
      const slots = chapters.get(l.ch);
      const last = slots[slots.length - 1];
      if (l.br && last && last.br === l.br[0]) last.levels.push(l);
      else slots.push({ n: ++slot, br: l.br ? l.br[0] : null, levels: [l] });
    });
    const map = el('section', { class: 'map' });
    chapters.forEach((slots, ch) => {
      map.append(el('div', { class: 'chapter' },
        el('div', { class: 'ch-h' }, el('span', {}, ch < 8 ? t('ui.chapter') + ' ' + ch : '★'), el('b', {}, raw('chapters')[ch])),
        el('div', { class: 'ch-row' }, slots.map((s) => el('div', { class: 'slot' + (s.br ? ' branch' : '') },
          s.levels.map((l, i) => nodeButton(l, s.n + (s.br ? 'abc'[i] : ''), nx)))))));
    });
    $view.replaceChildren(hero, map,
      el('footer', { class: 'foot' },
        el('span', {}, t('ui.footer')),
        el('span', { class: 'row-btns' }, btn(t('ui.newRun'), newRun, 'ghost small'), btn(t('ui.resetAll'), resetAll, 'ghost small'))));
    window.scrollTo(0, 0);
  }
  function nodeButton(l, n, nx) {
    const done = !!S.done[l.id];
    const state = done ? 'done' : l === nx ? 'current' : undecided(l) ? 'maybe' : !onPath(l) ? 'skipped' : 'locked';
    const open = isOpen(l);
    return el('button', {
      class: 'node ' + state + (l.fork ? ' fork' : ''), type: 'button', disabled: !open,
      title: state === 'skipped' ? t('ui.notTaken') : state === 'maybe' ? t('ui.dependsOnChoice') : '',
      onclick: () => openLevel(l.id),
    },
      el('span', { class: 'dot' }, done ? '✓' : l.fork ? '◆' : l.id === 'passport' ? '★' : n),
      el('span', { class: 'nm' }, t('levels.' + l.id + '.title')),
      el('span', { class: 'sb' }, state === 'skipped' ? t('ui.notTaken') : t('levels.' + l.id + '.sub')));
  }
  function coinCard() {
    const c = S.coin;
    const v = (x) => (x ? el('b', {}, x) : el('b', { class: 'q' }, '?'));
    const names = { utxo: 'UTXO', account: 'Account', pow: 'Proof of Work', pos: 'Proof of Stake', poa: 'Proof of Authority', l1: 'Own mainnet (L1)', token: 'Token' };
    return el('aside', { class: 'coincard' },
      el('div', { class: 'cc-h' }, el('span', { class: 'logo big' }, coin().tkr[0]),
        el('div', {}, el('small', {}, t('ui.yourCoin')), el('b', {}, c.name ? c.name + ' (' + c.ticker + ')' : t('ui.unnamed')))),
      el('div', { class: 'kv' }, el('span', {}, 'Ledger'), v(names[c.model])),
      el('div', { class: 'kv' }, el('span', {}, 'Consensus'), v(names[c.consensus])),
      el('div', { class: 'kv' }, el('span', {}, 'Supply'), v(c.policy && (isFinite(F.supplyCap(c)) ? big(F.supplyCap(c)) : '∞'))),
      el('div', { class: 'kv' }, el('span', {}, 'Launch'), v(names[c.launch] && names[c.launch] + (c.host ? ' · ' + c.host : ''))),
      el('div', { class: 'kv' }, el('span', {}, 'Address'), v(S.wallet && F.util.short(wallet().addr, 8, 6))));
  }
  function newRun() {
    if (!confirm(t('ui.confirmNewRun'))) return;
    S = Object.assign(fresh(), { lang: S.lang, ach: S.ach, codex: S.codex, paths: S.paths });
    walletCache = null;
    save(); renderTop(); showMap();
  }
  function resetAll() {
    if (!confirm(t('ui.confirmReset'))) return;
    S = Object.assign(fresh(), { lang: S.lang });
    walletCache = null;
    save(); renderTop(); showMap();
  }

  // ---------- figures ----------
  const figures = {
    fork() {
      const g = svg('svg', { viewBox: '0 0 560 150', class: 'fig' });
      const box = (x, y, label, cls) => [svg('rect', { x, y, width: 62, height: 34, rx: 6, class: cls }), svg('text', { x: x + 31, y: y + 22, class: 'ft' }, label)];
      const link = (x1, y1, x2, y2, cls) => svg('line', { x1, y1, x2, y2, class: 'fl ' + (cls || '') });
      g.append(
        link(72, 75, 100, 75), link(162, 75, 190, 75), link(252, 75, 280, 45), link(252, 75, 280, 107, 'dead'),
        link(342, 40, 370, 40), link(432, 40, 460, 40),
        ...box(10, 58, '#100', 'b'), ...box(100, 58, '#101', 'b'), ...box(190, 58, '#102', 'b'),
        ...box(280, 23, '#103', 'b win'), ...box(370, 23, '#104', 'b win'), ...box(460, 23, '#105', 'b win'),
        ...box(280, 92, "#103'", 'b dead'),
        svg('text', { x: 280, y: 14, class: 'fc' }, t('fig.fork.win')),
        svg('text', { x: 150, y: 144, class: 'fc dead' }, t('fig.fork.orphan')));
      return g;
    },
    cloud() {
      return el('div', { class: 'scroll-x' }, el('table', { class: 'atlas' },
        el('tr', {}, raw('fig.cloud.h').map((x) => el('th', {}, x))),
        raw('fig.cloud.rows').map((r) => el('tr', {}, r.map((x, i) => el(i ? 'td' : 'th', {}, x))))));
    },
  };

  // ---------- levels ----------
  let cur = null;
  function openLevel(id) {
    const lv = F.levels.find((l) => l.id === id);
    if (!lv || !isOpen(lv)) return;
    cur = { lv, i: 0, miss: false };
    session = 0;
    screen = { name: 'level' };
    renderStep();
  }
  function renderStep() {
    const { lv, i } = cur;
    const st = lv.steps[i];
    const review = !!S.done[lv.id];
    const body = el('div', { class: 'step s-' + st.t });
    const next = btn(t(i === lv.steps.length - 1 ? 'ui.finish' : 'ui.next'), advance, 'primary large');
    const hint = el('span', { class: 'hint' });
    let commit = null;
    const ready = (on = true) => { next.disabled = !on; if (on) hint.textContent = ''; };
    function advance() {
      if (commit) commit();
      grant(lv.id + ':' + i, st.t === 'quiz' ? (cur.retry ? F.xp.quizRetry : F.xp.quiz) : F.xp[st.t] || 0);
      cur.retry = false;
      if (i === lv.steps.length - 1) return finishLevel();
      cur.i++;
      renderStep();
    }

    if (st.t === 'theory') {
      const key = 'levels.' + lv.id + '.' + (typeof st.k === 'function' ? st.k(S) : st.k);
      const defs = el('div', { class: 'defs' });
      body.append(el('div', { class: 'kicker' }, t('ui.theory')), el('h2', { html: t(key + '.h') }),
        ...ta(key + '.p').map((p) => el('p', { html: p })));
      if (st.fig) body.append(figures[st.fig]());
      if (st.terms.length) {
        body.append(el('div', { class: 'terms' }, el('span', {}, t('ui.newTerms')),
          st.terms.map((id) => el('button', { class: 'term', type: 'button', onclick: () => defs.replaceChildren(termCard(id, true)) }, F.terms[id]))), defs);
        learn(st.terms);
      }
      ready();
    } else if (st.t === 'lab') {
      const root = el('div', { class: 'lab' });
      body.append(el('div', { class: 'kicker' }, t('ui.lab')), el('h2', {}, t('labs.' + st.lab + '.title')),
        el('p', { html: t('labs.' + st.lab + '.intro') }), root);
      ready(review);
      if (!review) hint.textContent = t('ui.labHint');
      F.labs[st.lab](root, labApi(st.lab, () => { ready(); toast('ok', t('ui.labDone'), '+' + F.xp.lab + ' XP'); }));
    } else if (st.t === 'quiz') {
      const key = 'levels.' + lv.id + '.' + st.k;
      const opts = ta(key + '.o'), expl = ta(key + '.e');
      const out = el('div');
      const buttons = opts.map((o, k) => el('button', { class: 'opt', type: 'button', onclick: () => {
        if (k === st.a) {
          buttons.forEach((b) => (b.disabled = true));
          buttons[k].classList.add('right');
          out.replaceChildren(note('ok', expl[k]));
          ready();
        } else {
          buttons[k].disabled = true;
          buttons[k].classList.add('wrong');
          out.replaceChildren(note('bad', expl[k]));
          cur.miss = cur.retry = true;
        }
      } }, el('i', {}, 'ABCD'[k]), el('span', { html: o })));
      body.append(el('div', { class: 'kicker' }, t('ui.quiz')), el('h2', { html: t(key + '.q') }), el('div', { class: 'opts' }, buttons), out);
      ready(review);
      if (!review) hint.textContent = t('ui.quizHint');
    } else if (st.t === 'choice') {
      const key = 'levels.' + lv.id + '.' + st.k;
      const locked = S.coin[st.key];
      let sel = locked || null;
      const cards = st.opts.map((o) => {
        const d = key + '.o.' + o;
        return el('button', { class: 'choice' + (locked === o ? ' sel' : '') + (locked && locked !== o ? ' dim' : ''), type: 'button', disabled: !!locked, onclick: () => {
          sel = o;
          cards.forEach((c, k) => c.classList.toggle('sel', st.opts[k] === o));
          ready();
        } },
          el('h3', {}, t(d + '.n')), el('p', { html: t(d + '.d') }),
          el('ul', { class: 'plus' }, ta(d + '.plus').map((x) => el('li', { html: x }))),
          el('ul', { class: 'minus' }, ta(d + '.minus').map((x) => el('li', { html: x }))),
          el('div', { class: 'used' }, el('small', {}, t('ui.usedBy')), ' ', t(d + '.used')));
      });
      body.append(el('div', { class: 'kicker' }, t('ui.decision')), el('h2', { html: t(key + '.q') }),
        el('div', { class: 'choices n' + st.opts.length }, cards),
        locked ? note('warn', t('ui.choiceLocked')) : el('p', { class: 'hint' }, t('ui.choiceHint')));
      ready(!!locked);
      commit = () => { if (!locked) { S.coin[st.key] = sel; save(); } };
    } else if (st.t === 'passport') {
      body.append(passport());
      ready();
    }

    $view.replaceChildren(el('section', { class: 'level' },
      el('div', { class: 'lv-head' },
        btn('← ' + t('ui.map'), showMap, 'ghost'),
        el('div', { class: 'lv-title' }, el('small', {}, lv.ch < 8 ? t('ui.chapter') + ' ' + lv.ch + ' · ' + raw('chapters')[lv.ch] : raw('chapters')[lv.ch]), el('b', {}, t('levels.' + lv.id + '.title'))),
        el('div', { class: 'dots' }, lv.steps.map((s, k) => el('i', { class: k < i ? 'done' : k === i ? 'on' : '' })))),
      body,
      el('div', { class: 'lv-foot' }, hint, next)));
    window.scrollTo(0, 0);
  }
  function labApi(id, onComplete) {
    const need = [], have = new Set(), cbs = [];
    let box = null;
    return {
      S, save, wallet, ach: unlock, refresh: renderTop,
      get coin() { return coin(); },
      t: (k, v) => t('labs.' + id + '.' + k, v),
      ta: (k, v) => ta('labs.' + id + '.' + k, v),
      onDone: (f) => cbs.push(f),
      tasks(ids) {
        need.push(...ids);
        box = el('div', { class: 'tasks' }, el('div', { class: 'tasks-h' }, t('ui.goals')),
          ids.map((x) => el('div', { class: 'task', 'data-id': x }, el('span', { class: 'tick' }), el('span', { html: t('labs.' + id + '.tasks.' + x) }))));
        return box;
      },
      check(x) {
        if (have.has(x) || !need.includes(x)) return;
        have.add(x);
        box.querySelector('[data-id="' + x + '"]').classList.add('done');
        if (have.size === need.length) { cbs.forEach((f) => f()); onComplete(); }
      },
    };
  }
  function finishLevel() {
    const { lv } = cur;
    const first = !S.done[lv.id];
    if (first) {
      S.done[lv.id] = 1;
      const hasQuiz = lv.steps.some((s) => s.t === 'quiz');
      if (hasQuiz && !cur.miss) S.perfect[lv.id] = 1;
      save();
      grant(lv.id + ':done', lv.id === 'passport' ? F.xp.passport : F.xp.level);
      if (count(S.perfect) >= 5) unlock('sharp');
      if (lv.id === 'incidents' && !cur.miss) unlock('oncall');
      if (lv.id === 'passport') {
        unlock('genesis');
        S.paths[[S.coin.model, S.coin.consensus, S.coin.launch].join('/')] = 1;
        save();
        if (count(S.paths) >= 2) unlock('explorer');
      }
    }
    showComplete(lv, session);
  }
  function showComplete(lv, gained) {
    screen = { name: 'complete', lv, gained };
    const nx = nextLevel();
    const terms = [...new Set(lv.steps.flatMap((s) => s.terms || []))];
    const p = progress();
    $view.replaceChildren(el('section', { class: 'level complete' },
      el('div', { class: 'bigcheck' }, '✓'),
      el('h2', {}, t(lv.id === 'passport' ? 'ui.gameDone' : 'ui.levelDone')),
      el('p', {}, t('levels.' + lv.id + '.title') + (gained ? ' · +' + gained + ' XP' : '')),
      el('div', { class: 'bar wide' }, el('i', { style: 'width:' + p.pct + '%' })),
      el('p', { class: 'hint' }, t('ui.progressLine', { done: p.done, total: p.total, pct: p.pct })),
      terms.length ? el('div', { class: 'terms center' }, el('span', {}, t('ui.termsLearned')), terms.map((id) => el('span', { class: 'term' }, F.terms[id]))) : null,
      lv.id === 'passport' ? el('p', { html: t('ui.gameDoneText') }) : null,
      el('div', { class: 'row-btns center' },
        nx ? btn(t('ui.nextLevel') + ': ' + t('levels.' + nx.id + '.title'), () => openLevel(nx.id), 'primary large') : btn(t('ui.newRun'), newRun, 'primary large'),
        btn(t('ui.map'), showMap, 'large'))));
    window.scrollTo(0, 0);
  }

  // ---------- passport ----------
  function passport() {
    const c = S.coin, w = wallet(), r = rank();
    const launch = c.launch || 'l1';
    const simKey = launch === 'token' ? 'token' : (c.model || 'utxo') + '_' + (c.consensus || 'pow');
    const cap = F.supplyCap(Object.assign({ policy: 'fixed', s0: 0 }, c));
    const row = (k, v) => el('div', { class: 'kv' }, el('span', {}, k), el('b', { html: v }));
    const cfg = S.arch || {};
    const layers = [['edge', ['waf', 'gateway']], ['access', ['nodes', 'fallback']], ['chain', ['validators', 'bootnodes']], ['data', ['indexer', 'explorer']], ['ops', ['vault', 'monitoring', 'snapshots', 'multiregion']]];
    const compName = (id) => t('labs.architecture.comp_' + id + (id === 'validators' && c.consensus === 'pow' ? '_pow' : ''));
    const diagram = el('div', { class: 'diagram' }, layers.map(([layer, ids]) => {
      const chips = ids.filter((id) => cfg[id]).map((id) => el('span', { class: 'chip ok' }, compName(id) + (cfg[id] > 1 ? ' ×' + cfg[id] : '')));
      if (layer === 'chain' && launch === 'token') chips.push(el('span', { class: 'chip gen' }, 'Host chain: ' + (c.host || '?')));
      return el('div', { class: 'layer' }, el('small', {}, t('passport.layer.' + layer)), el('div', {}, chips.length ? chips : el('span', { class: 'hint' }, '—')));
    }));
    return el('div', { class: 'passport' },
      el('div', { class: 'pp-head' }, el('span', { class: 'logo huge' }, coin().tkr[0]),
        el('div', {}, el('small', {}, t('passport.title')), el('h2', {}, coin().name + ' · ' + coin().tkr), el('div', { class: 'mono small' }, w.addr))),
      el('div', { class: 'cols2' },
        el('div', {}, el('h3', {}, t('passport.design')),
          row('Ledger model', t('passport.v.' + (c.model || 'utxo'))),
          row('Consensus', t('passport.v.' + (c.consensus || 'pow'))),
          row('Launch', t('passport.v.' + launch) + (c.host ? ' · ' + esc(c.host) + ' (' + esc(c.std) + ')' : '')),
          row('Supply policy', t('labs.tokenomics.pol_' + (c.policy || 'fixed'))),
          row('Max supply', isFinite(cap) ? big(cap) + ' ' + esc(coin().tkr) : '∞'),
          row('Block time', (c.blockTime || '—') + ' s'),
          el('div', { class: 'similar' }, el('small', {}, t('passport.similar')), el('p', { html: t('passport.sim.' + simKey) }))),
        el('div', {}, el('h3', {}, t('passport.infra')), diagram,
          el('h3', {}, t('passport.you')),
          row(t('ui.rank'), esc(r.name)), row('XP', S.xp),
          row(t('ui.achievements'), count(S.ach) + ' / ' + F.achievements.length),
          row('Codex', count(S.codex) + ' / ' + count(F.terms)))),
      note('ok', t('passport.outro')));
  }

  // ---------- boot ----------
  document.documentElement.lang = S.lang;
  renderTop();
  showMap();
})();
