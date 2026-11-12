/*
 * Forge Your Coin - interactive labs.
 *
 * Each lab is a function (root, A) that builds its UI inside `root`.
 * `A` is the lab API provided by the engine:
 *   A.t(key, vars) / A.ta(key)  - localized strings for this lab
 *   A.tasks([ids]) / A.check(id) - goal checklist; the lab is complete when all are checked
 *   A.ach(id)                    - unlock an achievement
 *   A.S / A.save()               - game state
 *   A.wallet()                   - the player's key pair { d, Q, pubHex, addr }
 *   A.coin                       - { name, tkr, ver } of the player's currency
 */
(function () {
  'use strict';
  const F = window.FYC;
  const C = F.crypto;
  const L = (F.labs = {});

  // ---------- tiny DOM helpers ----------
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'value') e.value = v;
        else if (k === 'checked' || k === 'disabled') e[k] = !!v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat(3)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }
  const NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...kids) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }
  F.el = el;
  F.svg = svg;

  const short = (h, a = 10, b = 6) => (h.length > a + b + 1 ? h.slice(0, a) + '…' + h.slice(-b) : h);
  const note = (kind, html) => el('div', { class: 'note ' + kind, html });
  const btn = (label, onclick, cls) => el('button', { class: 'btn ' + (cls || ''), type: 'button', onclick }, label);
  const field = (label, ...kids) => el('div', { class: 'field' }, el('label', {}, label), ...kids);
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const num = (n) => r3(n).toLocaleString('en-US');
  const big = (n) => Math.round(n).toLocaleString('en-US');
  const leadingZeros = (bytes, d) => {
    for (let i = 0; i < d; i++) {
      const nib = i & 1 ? bytes[i >> 1] & 15 : bytes[i >> 1] >> 4;
      if (nib) return false;
    }
    return true;
  };
  F.util = { short, note, btn, num, big };

  // =====================================================================
  // Chapter 1
  // =====================================================================

  // Double-spend: two nodes hear two conflicting payments in a different order.
  L.ledger = (root, A) => {
    const colA = el('div', { class: 'ledger' });
    const colB = el('div', { class: 'ledger' });
    const res = el('div');
    const fill = (col, name, rows) =>
      col.replaceChildren(el('div', { class: 'ledger-h' }, name), el('div', { class: 'lrow' }, A.t('start')), ...rows);
    const row = (ok, text) => el('div', { class: 'lrow ' + (ok ? 'ok' : 'bad') }, (ok ? '✓ ' : '✗ ') + text);
    fill(colA, A.t('nodeA'), []);
    fill(colB, A.t('nodeB'), []);
    const bCompare = btn(A.t('compare'), () => {
      res.replaceChildren(note('bad', A.t('conflict')));
      A.check('compare');
    });
    bCompare.disabled = true;
    const bSpend = btn(A.t('spend'), () => {
      fill(colA, A.t('nodeA'), [row(true, A.t('toBob')), row(false, A.t('toCarolRej'))]);
      fill(colB, A.t('nodeB'), [row(true, A.t('toCarol')), row(false, A.t('toBobRej'))]);
      bCompare.disabled = false;
      A.check('spend');
    }, 'primary');
    root.append(A.tasks(['spend', 'compare']), el('div', { class: 'row-btns' }, bSpend, bCompare),
      el('div', { class: 'cols2' }, colA, colB), res);
  };

  // Live SHA-256 with avalanche highlighting.
  L.hash = (root, A) => {
    const out = el('div', { class: 'out mono hashout' });
    const info = el('div', { class: 'hint' });
    let prev = null, edits = 0;
    const ta = el('textarea', { rows: 3, placeholder: A.t('ph'), oninput: upd });
    function upd() {
      const v = ta.value;
      const h = C.sha256hex(v);
      let diff = 0;
      out.replaceChildren();
      for (let i = 0; i < 64; i++) {
        const changed = prev && prev[i] !== h[i];
        if (changed) diff++;
        out.append(el('span', { class: changed ? 'chg' : '' }, h[i]));
      }
      if (v) A.check('type');
      if (prev && v) {
        edits++;
        info.textContent = A.t('diff', { n: diff });
        if (edits >= 2 && diff >= 20) { A.check('avalanche'); A.ach('avalanche'); }
      }
      if (v && h[0] === '0') A.check('zero');
      prev = h;
    }
    root.append(A.tasks(['type', 'avalanche', 'zero']), field(A.t('input'), ta), field('SHA-256', out), info);
    upd();
  };

  // A four-block chain you can tamper with and repair.
  L.block = (root, A) => {
    const D = 2;
    const calc = (b) => C.sha256hex(b.i + '|' + b.prev + '|' + b.data + '|' + b.nonce);
    const ok = (b) => b.hash.startsWith('0'.repeat(D));
    const mine = (b) => {
      let n = 0;
      b.nonce = 0;
      while (!(b.hash = calc(b)).startsWith('0'.repeat(D))) { b.nonce++; n++; }
      return n + 1;
    };
    const blocks = A.ta('data').map((data, i) => ({ i, data, nonce: 0, prev: '', hash: '' }));
    let prev = '0'.repeat(64);
    for (const b of blocks) { b.prev = prev; mine(b); prev = b.hash; }
    let tampered = false, work = 0;
    const info = el('div', { class: 'hint' });
    const relink = (from) => {
      for (let i = from; i < blocks.length; i++) {
        if (i > 0) blocks[i].prev = blocks[i - 1].hash;
        blocks[i].hash = calc(blocks[i]);
      }
    };
    const views = blocks.map((b, i) => {
      const v = {};
      v.tag = el('span', { class: 'tag' });
      v.nonce = el('span', { class: 'mono' });
      v.prev = el('div', { class: 'mono small' });
      v.hash = el('div', { class: 'mono small' });
      v.box = el('div', { class: 'blk' },
        el('div', { class: 'blk-h' }, el('b', {}, 'Block #' + i), v.tag),
        field('Data', el('input', { value: b.data, oninput: (e) => {
          b.data = e.target.value; tampered = true; relink(i); A.check('tamper'); draw();
        } })),
        el('div', { class: 'kv' }, el('span', {}, 'Nonce'), v.nonce),
        el('div', { class: 'kv col' }, el('span', {}, 'Prev hash'), v.prev),
        el('div', { class: 'kv col' }, el('span', {}, 'Hash'), v.hash),
        btn(A.t('remine'), () => { work += mine(b); relink(i + 1); draw(); }, 'small'));
      return v;
    });
    function draw() {
      let all = true;
      blocks.forEach((b, i) => {
        const good = ok(b);
        if (!good) all = false;
        const v = views[i];
        v.box.className = 'blk ' + (good ? 'ok' : 'bad');
        v.tag.textContent = good ? A.t('valid') : A.t('invalid');
        v.nonce.textContent = b.nonce;
        v.prev.textContent = short(b.prev, 14, 8);
        v.hash.textContent = short(b.hash, 14, 8);
      });
      if (tampered && !all) A.check('broken');
      if (tampered && all && work > 0) {
        A.check('repair');
        A.ach('breaker');
        info.textContent = A.t('work', { n: big(work) });
      }
    }
    root.append(A.tasks(['tamper', 'broken', 'repair']), el('div', { class: 'chain' }, views.map((v) => v.box)), info);
    draw();
  };

  // =====================================================================
  // Chapter 2
  // =====================================================================

  // Private key -> public key -> address, step by step.
  L.keys = (root, A) => {
    let d = null, Q = null;
    const o1 = el('div', { class: 'out mono' }, '—');
    const dec = el('div', { class: 'hint mono small' });
    const o2 = el('div', { class: 'out mono' }, '—');
    const i2 = el('div', { class: 'hint' });
    const o3 = el('div', { class: 'out mono big' }, '—');
    const pipe = el('div', { class: 'pipe' });
    const b2 = btn(A.t('derivePub'), () => {
      const t0 = performance.now();
      Q = C.pubPoint(d);
      o2.textContent = C.pubHex(Q);
      i2.textContent = A.t('pubInfo', { ms: Math.max(1, Math.round(performance.now() - t0)) });
      b3.disabled = false;
      A.check('pub');
    });
    const b3 = btn(A.t('deriveAddr'), () => {
      const pb = C.pubBytes(Q);
      const s = C.sha256(pb);
      const r = C.ripemd160(s);
      const addr = C.base58check(A.coin.ver, r);
      const step = (label, value) => el('div', { class: 'kv col' }, el('span', {}, label), el('div', { class: 'mono small' }, value));
      pipe.replaceChildren(
        step('1. SHA-256(public key)', C.hex(s)),
        step('2. RIPEMD-160(' + A.t('step1') + ')', C.hex(r)),
        step('3. ' + A.t('step3'), '0x' + A.coin.ver.toString(16).padStart(2, '0') + ' + … + checksum'),
        step('4. Base58Check', addr));
      o3.textContent = addr;
      A.S.wallet = { priv: d.toString(16).padStart(64, '0') };
      A.save();
      A.check('addr');
      A.ach('keymaster');
    });
    b2.disabled = b3.disabled = true;
    const b1 = btn(A.t('gen'), () => {
      d = C.randomPriv();
      Q = null;
      o1.textContent = d.toString(16).padStart(64, '0');
      dec.textContent = A.t('asNumber') + ' ' + d.toString();
      o2.textContent = o3.textContent = '—';
      i2.textContent = '';
      pipe.replaceChildren();
      b2.disabled = false;
      b3.disabled = true;
      A.check('priv');
    }, 'primary');
    root.append(A.tasks(['priv', 'pub', 'addr']),
      el('div', { class: 'stepbox' }, b1, field('Private key (256 bit, hex)', o1), dec),
      el('div', { class: 'stepbox' }, b2, field('Public key (compressed, 33 bytes)', o2), i2),
      el('div', { class: 'stepbox' }, b3, field('Address', o3), pipe),
      note('warn', A.t('warn')));
  };

  // Sign, verify, forge.
  L.sign = (root, A) => {
    const w = A.wallet();
    let sig = null, signed = null;
    const ta = el('textarea', { rows: 2 });
    ta.value = A.t('defMsg');
    const sOut = el('div', { class: 'out mono small' }, '—');
    const vOut = el('div');
    const bVerify = btn(A.t('verify'), () => {
      const ok = C.verify(w.Q, ta.value, sig);
      vOut.replaceChildren(note(ok ? 'ok' : 'bad', A.t(ok ? 'valid' : 'invalid')));
      if (ok) A.check('verify');
      else if (ta.value !== signed) { A.check('tamper'); A.ach('forgery'); }
    });
    const bStranger = btn(A.t('strangerBtn'), () => {
      const ok = C.verify(C.pubPoint(C.randomPriv()), ta.value, sig);
      vOut.replaceChildren(note(ok ? 'ok' : 'bad', A.t('stranger')));
    });
    bVerify.disabled = bStranger.disabled = true;
    const bSign = btn(A.t('sign'), () => {
      sig = C.sign(w.d, ta.value);
      signed = ta.value;
      sOut.textContent = 'r = ' + C.hex(C.b32(sig.r)) + '\ns = ' + C.hex(C.b32(sig.s));
      vOut.replaceChildren();
      bVerify.disabled = bStranger.disabled = false;
      A.check('sign');
    }, 'primary');
    root.append(A.tasks(['sign', 'verify', 'tamper']),
      el('div', { class: 'kv col' }, el('span', {}, A.t('yourKey')), el('div', { class: 'mono small' }, w.pubHex)),
      field(A.t('message'), ta),
      el('div', { class: 'row-btns' }, bSign, bVerify, bStranger),
      field('Signature (r, s)', sOut), vOut);
  };

  // Seed phrase -> many keys; wipe and restore.
  const WORDS = ('apple arrow badge beach berry bird blade bloom board brave bread brick bridge brook cabin camel ' +
    'candy cargo chalk chess cliff cloud coast coral crane crown daisy delta diary dune eagle earth ember fable ' +
    'field flame fleet flute forest frost garden ghost glade globe grain grape harbor hazel heron honey horse ' +
    'ivory jewel kite lake lemon light lilac lotus lunar maple march marsh meadow melon mint moon moss mount ' +
    'north oasis ocean olive onyx opal orbit otter panda pearl petal piano pilot plume polar pond quartz quest ' +
    'quill rabbit raven reef ridge river robin rose sable sage sand shell shore silk slate snow solar spark ' +
    'spice spruce star stone storm sugar swan table tiger torch trail tulip valley velvet violet wagon water ' +
    'whale wheat willow wind winter wolf').split(' ');
  F.newSeed = () => {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => WORDS[x % WORDS.length]).join(' ');
  };

  L.wallet = (root, A) => {
    let phrase = null, orig = null;
    const paper = el('div', { class: 'seed' });
    const device = el('div');
    const rOut = el('div');
    const input = el('input', { placeholder: A.t('restorePh') });
    const derive = (ph) => {
      const d = C.seedToPriv(ph);
      return [0, 1, 2].map((i) => C.address(C.pubPoint(C.childPriv(d, i)), A.coin.ver));
    };
    const list = (addrs) => el('div', { class: 'addrlist' },
      addrs.map((a, i) => el('div', { class: 'kv' }, el('span', {}, 'm/' + i), el('span', { class: 'mono small' }, a))));
    const bDerive = btn(A.t('derive'), () => {
      orig = derive(phrase);
      device.replaceChildren(list(orig));
      bWipe.disabled = false;
      A.check('derive');
    });
    const bWipe = btn(A.t('wipe'), () => {
      device.replaceChildren(note('bad', A.t('wiped')));
      bRestore.disabled = false;
    }, 'danger');
    const bRestore = btn(A.t('restore'), () => {
      const ph = input.value.trim().toLowerCase().split(/\s+/).join(' ');
      if (!ph) return;
      const got = derive(ph);
      const same = got.join() === orig.join();
      rOut.replaceChildren(list(got), note(same ? 'ok' : 'bad', A.t(same ? 'restored' : 'different')));
      if (same) { A.check('restore'); A.ach('backup'); }
    });
    bDerive.disabled = bWipe.disabled = bRestore.disabled = true;
    const bGen = btn(A.t('gen'), () => {
      phrase = F.newSeed();
      paper.replaceChildren(...phrase.split(' ').map((wd, i) => el('span', { class: 'word' }, el('i', {}, i + 1), wd)));
      A.S.seed = phrase;
      A.save();
      device.replaceChildren();
      rOut.replaceChildren();
      bDerive.disabled = false;
      A.check('seed');
    }, 'primary');
    root.append(A.tasks(['seed', 'derive', 'restore']),
      el('div', { class: 'stepbox' }, bGen, field(A.t('paper'), paper)),
      el('div', { class: 'stepbox' }, el('div', { class: 'row-btns' }, bDerive, bWipe), field(A.t('device'), device)),
      el('div', { class: 'stepbox' },
        field(A.t('restoreLbl'), input),
        el('div', { class: 'row-btns' }, bRestore, btn(A.t('copyPaper'), () => { if (phrase) input.value = phrase; }, 'ghost')),
        rOut),
      note('warn', A.t('simplified')));
  };

  // =====================================================================
  // Chapter 3
  // =====================================================================

  // Build, sign and broadcast a transaction; fight for block space with fees.
  L.tx = (root, A) => {
    const w = A.wallet();
    const CAP = 4;
    let pool = [], my = null, height = 1, bal = 50;
    const people = ['Bob', 'Carol', 'Dave'];
    const addrOf = {};
    const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 10) / 10;
    const others = (n) => {
      for (let i = 0; i < n; i++) pool.push({ id: C.sha256hex('o' + Math.random()).slice(0, 8), fee: rnd(0.6, 3) });
    };
    others(7);

    const to = el('select', {}, people.map((p) => el('option', { value: p }, p)));
    const amt = el('input', { type: 'number', min: '1', max: '40', step: '1', value: '5' });
    const feeLbl = el('b', {}, '0.2');
    const fee = el('input', { type: 'range', min: '0.1', max: '5', step: '0.1', value: '0.2', oninput: () => (feeLbl.textContent = fee.value) });
    const json = el('pre', { class: 'out mono small' }, '—');
    const table = el('div', { class: 'mempool' });
    const log = el('div', { class: 'log' });
    const balEl = el('b', {});
    const say = (kind, text) => log.prepend(el('div', { class: 'lrow ' + kind }, text));

    const bSend = btn(A.t('send'), () => {
      const amount = Math.max(1, Math.min(40, +amt.value || 1));
      if (!addrOf[to.value]) addrOf[to.value] = C.address(C.pubPoint(BigInt(1000 + people.indexOf(to.value))), A.coin.ver);
      const tx = { from: w.addr, to: addrOf[to.value], amount, fee: +fee.value };
      const body = JSON.stringify(tx);
      const sig = C.sigHex(C.sign(w.d, body));
      const txid = C.sha256hex(body + sig);
      my = { id: txid.slice(0, 8), fee: tx.fee, amount, mine: true, bumped: false };
      pool.push(my);
      json.textContent = JSON.stringify(Object.assign({ txid }, tx, { signature: short(sig, 16, 8) }), null, 2);
      A.check('broadcast');
      draw();
    }, 'primary');
    const bBump = btn(A.t('bump'), () => {
      const sorted = pool.filter((t) => !t.mine).sort((a, b) => b.fee - a.fee);
      const cut = sorted[Math.min(CAP - 1, sorted.length - 1)];
      my.fee = Math.round(((cut ? cut.fee : 0.5) + 0.2) * 10) / 10;
      my.bumped = true;
      say('warn', A.t('bumped', { fee: my.fee }));
      A.check('bump');
      draw();
    });
    const bMine = btn(A.t('mine'), () => {
      pool.sort((a, b) => b.fee - a.fee);
      const included = pool.slice(0, CAP);
      pool = pool.slice(CAP);
      if (my) {
        if (included.includes(my)) {
          bal = r3(bal - my.amount - my.fee);
          say('ok', A.t('included', { h: height, fee: my.fee }));
          A.check('confirm');
          if (my.bumped) A.ach('feesniper');
          my = null;
        } else {
          say('bad', A.t('skipped', { h: height, min: included[included.length - 1].fee }));
          A.check('skipped');
        }
      } else {
        say('', A.t('mined', { h: height }));
      }
      others(3);
      height++;
      draw();
    });
    function draw() {
      balEl.textContent = num(bal) + ' ' + A.coin.tkr;
      bSend.disabled = !!my;
      bBump.disabled = !my;
      pool.sort((a, b) => b.fee - a.fee);
      table.replaceChildren(el('div', { class: 'mp-h' }, A.t('mempool', { n: pool.length, cap: CAP })));
      pool.forEach((t, i) => {
        if (i === CAP) table.append(el('div', { class: 'mp-cut' }, A.t('cut')));
        table.append(el('div', { class: 'mp-row' + (t.mine ? ' mine' : '') },
          el('span', { class: 'mono' }, t.id), el('span', {}, t.mine ? A.t('yours') : ''), el('span', { class: 'mono' }, 'fee ' + t.fee.toFixed(1))));
      });
    }
    root.append(A.tasks(['broadcast', 'skipped', 'bump', 'confirm']),
      el('div', { class: 'cols2' },
        el('div', {},
          el('div', { class: 'kv' }, el('span', {}, A.t('balance')), balEl),
          field(A.t('to'), to), field(A.t('amount'), amt),
          field(el('span', {}, 'Fee: ', feeLbl, ' ' + A.coin.tkr), fee),
          el('div', { class: 'row-btns' }, bSend, bBump),
          field(A.t('signedTx'), json)),
        el('div', {}, table, el('div', { class: 'row-btns' }, bMine), log)));
    draw();
  };

  // UTXO: pick coins, build outputs, do not forget the change.
  L.utxo = (root, A) => {
    const PAY = 6, FEE = 0.1;
    let utxos = [5, 3, 2, 0.5].map((v, i) => ({ id: i, v, sel: false }));
    let noChange = false, paid = false;
    const coins = el('div', { class: 'coins' });
    const sum = el('div', { class: 'out' });
    const res = el('div');
    const chk = el('input', { type: 'checkbox', onchange: () => { noChange = chk.checked; draw(); } });
    const total = () => r3(utxos.filter((u) => u.sel).reduce((s, u) => s + u.v, 0));
    function draw() {
      coins.replaceChildren(...utxos.map((u) => el('button', {
        class: 'coin' + (u.sel ? ' sel' : '') + (u.fresh ? ' fresh' : ''), type: 'button', disabled: paid,
        onclick: () => { u.sel = !u.sel; draw(); },
      }, num(u.v), el('small', {}, 'UTXO'))));
      const t = total();
      const change = r3(t - PAY - FEE);
      const rows = [el('div', { class: 'kv' }, el('span', {}, 'Inputs'), el('b', {}, num(t) + ' ' + A.coin.tkr))];
      if (t > 0) {
        rows.push(el('div', { class: 'kv' }, el('span', {}, 'Output → Bob'), el('b', {}, num(PAY))));
        if (change >= 0) {
          rows.push(noChange
            ? el('div', { class: 'kv bad' }, el('span', {}, 'Fee'), el('b', {}, num(r3(FEE + change))))
            : el('div', { class: 'kv' }, el('span', {}, 'Output → ' + A.t('you') + ' (change)'), el('b', {}, num(change))));
          if (!noChange) rows.push(el('div', { class: 'kv' }, el('span', {}, 'Fee'), el('b', {}, num(FEE))));
        } else {
          rows.push(el('div', { class: 'kv bad' }, el('span', {}, A.t('short')), el('b', {}, num(-change))));
        }
      }
      sum.replaceChildren(...rows);
    }
    const bBuild = btn(A.t('build'), () => {
      const t = total();
      const change = r3(t - PAY - FEE);
      if (change < 0) return res.replaceChildren(note('bad', A.t('insufficient')));
      if (noChange && change > 0) {
        res.replaceChildren(note('bad', A.t('burn', { x: num(r3(change + FEE)), c: num(change) })));
        return A.check('nochange');
      }
      utxos = utxos.filter((u) => !u.sel);
      if (change > 0) utxos.push({ id: 99, v: change, sel: false, fresh: true });
      paid = true;
      bBuild.disabled = chk.disabled = true;
      res.replaceChildren(note('ok', A.t('done', { c: num(change) })));
      A.check('pay');
      draw();
    }, 'primary');
    root.append(A.tasks(['nochange', 'pay']),
      el('div', { class: 'hint' }, A.t('goal', { pay: PAY, fee: FEE })),
      field(A.t('yourCoins'), coins),
      el('label', { class: 'check' }, chk, A.t('skipChange')),
      sum, el('div', { class: 'row-btns' }, bBuild), res);
    draw();
  };

  // Account model: balance + nonce, replay protection, nonce gaps.
  L.account = (root, A) => {
    const w = A.wallet();
    const acct = { bal: 10, nonce: 0 };
    const FEE = 0.01;
    let queue = [], last = null;
    const state = el('div', { class: 'out' });
    const log = el('div', { class: 'log' });
    const to = el('select', {}, ['Bob', 'Carol'].map((p) => el('option', {}, p)));
    const amt = el('input', { type: 'number', min: '1', max: '5', step: '1', value: '2' });
    const nonce = el('input', { type: 'number', min: '0', step: '1', value: '0' });
    const say = (kind, text) => log.prepend(el('div', { class: 'lrow ' + kind }, text));
    function draw() {
      state.replaceChildren(
        el('div', { class: 'kv' }, el('span', {}, 'Balance'), el('b', {}, num(acct.bal) + ' ' + A.coin.tkr)),
        el('div', { class: 'kv' }, el('span', {}, 'Nonce (' + A.t('next') + ')'), el('b', {}, acct.nonce)),
        el('div', { class: 'kv' }, el('span', {}, A.t('queued')), el('b', {}, queue.length ? queue.map((q) => '#' + q.nonce).join(', ') : '—')));
      bReplay.disabled = !last;
    }
    function apply(tx) {
      if (tx.amount + FEE > acct.bal) { say('bad', A.t('nofunds', { n: tx.nonce })); return false; }
      acct.bal = r3(acct.bal - tx.amount - FEE);
      acct.nonce++;
      last = tx;
      say('ok', A.t('applied', { n: tx.nonce, amt: tx.amount, to: tx.to, sig: short(tx.sig, 8, 4) }));
      A.check('send');
      return true;
    }
    function submit(tx, replay) {
      if (tx.nonce < acct.nonce) {
        say('bad', A.t('low', { n: tx.nonce, cur: acct.nonce }));
        if (replay) A.check('replay');
      } else if (tx.nonce > acct.nonce) {
        queue.push(tx);
        say('warn', A.t('gap', { n: tx.nonce, cur: acct.nonce }));
      } else if (apply(tx)) {
        let next, drained = false;
        while ((next = queue.find((q) => q.nonce === acct.nonce))) {
          queue = queue.filter((q) => q !== next);
          if (apply(next)) drained = true; else break;
        }
        if (drained) A.check('gap');
      }
      nonce.value = acct.nonce;
      draw();
    }
    const bSend = btn(A.t('send'), () => {
      const tx = { from: w.addr, to: to.value, amount: Math.max(1, +amt.value || 1), nonce: Math.max(0, Math.floor(+nonce.value || 0)) };
      tx.sig = C.sigHex(C.sign(w.d, JSON.stringify(tx)));
      submit(tx, false);
    }, 'primary');
    const bReplay = btn(A.t('replay'), () => submit(last, true));
    root.append(A.tasks(['send', 'replay', 'gap']),
      el('div', { class: 'cols2' },
        el('div', {}, state, field(A.t('to'), to), field(A.t('amount'), amt), field('Nonce', nonce),
          el('div', { class: 'row-btns' }, bSend, bReplay)),
        el('div', {}, el('div', { class: 'mp-h' }, A.t('chainLog')), log)));
    draw();
  };

  // =====================================================================
  // Chapter 4
  // =====================================================================

  // Gossip across a P2P mesh; kill nodes and watch it survive.
  L.nodes = (root, A) => {
    const pos = [[60, 60], [170, 40], [290, 60], [410, 40], [500, 95], [90, 160], [210, 140], [330, 160], [450, 170], [140, 250], [280, 250], [420, 255]];
    const edges = [[0, 1], [0, 5], [1, 2], [1, 6], [2, 3], [2, 7], [3, 4], [3, 8], [4, 8], [5, 6], [5, 9], [6, 7], [6, 10], [7, 8], [7, 10], [8, 11], [9, 10], [10, 11], [2, 6], [7, 11]];
    const off = new Set();
    let kill = false, busy = false;
    const info = el('div', { class: 'hint' }, A.t('hint'));
    const g = svg('svg', { viewBox: '0 0 560 300', class: 'net' });
    const lines = edges.map(([a, b]) => svg('line', { x1: pos[a][0], y1: pos[a][1], x2: pos[b][0], y2: pos[b][1] }));
    const dots = pos.map(([x, y], i) => {
      const c = svg('circle', { cx: x, cy: y, r: 14 });
      c.addEventListener('click', () => click(i));
      return c;
    });
    g.append(...lines, ...dots);
    const paint = () => {
      dots.forEach((c, i) => c.setAttribute('class', off.has(i) ? 'off' : ''));
      lines.forEach((l, i) => l.setAttribute('class', off.has(edges[i][0]) || off.has(edges[i][1]) ? 'off' : ''));
    };
    function click(i) {
      if (busy) return;
      if (kill) { off.has(i) ? off.delete(i) : off.add(i); paint(); return; }
      if (off.has(i)) return;
      paint();
      busy = true;
      const seen = new Set([i]);
      let frontier = [i], hop = 0;
      const tick = () => {
        frontier.forEach((n) => dots[n].setAttribute('class', 'lit'));
        const next = [];
        for (const n of frontier) {
          for (const [a, b] of edges) {
            const m = a === n ? b : b === n ? a : -1;
            if (m >= 0 && !off.has(m) && !seen.has(m)) { seen.add(m); next.push(m); }
          }
        }
        if (next.length) { frontier = next; hop++; setTimeout(tick, 380); return; }
        busy = false;
        const alive = pos.length - off.size;
        if (seen.size === alive) {
          info.textContent = A.t('reached', { n: seen.size, hops: hop });
          A.check('gossip');
          if (off.size >= 3) { A.check('kill'); A.ach('gossip'); }
        } else {
          info.textContent = A.t('partition', { n: seen.size, alive });
        }
      };
      tick();
    }
    const bMode = btn(A.t('modeSend'), () => {
      kill = !kill;
      bMode.textContent = A.t(kill ? 'modeKill' : 'modeSend');
      bMode.classList.toggle('danger', kill);
    });
    root.append(A.tasks(['gossip', 'kill']), el('div', { class: 'row-btns' }, bMode), g, info);
    paint();
  };

  // Real proof-of-work mining.
  L.mining = (root, A) => {
    let running = false, stop = false, prev = '0'.repeat(64), height = 1;
    const sel = el('select', {}, [1, 2, 3, 4, 5, 6].map((d) => el('option', { value: d, selected: d === 2 }, d + ' — ~' + big(16 ** d) + ' ' + A.t('tries'))));
    const live = el('div', { class: 'out mono small' }, '—');
    const strip = el('div', { class: 'strip' });
    const table = el('div', { class: 'mempool' }, el('div', { class: 'mp-h' }, A.t('results')));
    const bStart = btn(A.t('start'), () => {
      if (running) { stop = true; return; }
      const d = +sel.value;
      const prefix = height + '|' + prev + '|' + A.coin.tkr + '|';
      let n = 0;
      const t0 = performance.now();
      running = true; stop = false;
      bStart.textContent = A.t('stop');
      sel.disabled = true;
      const finish = () => { running = false; bStart.textContent = A.t('start'); sel.disabled = false; };
      (function slice() {
        const t = performance.now();
        while (performance.now() - t < 25) {
          for (let i = 0; i < 400; i++) {
            const h = C.sha256(prefix + n);
            if (leadingZeros(h, d)) {
              const hex = C.hex(h);
              const secs = (performance.now() - t0) / 1000;
              live.textContent = 'nonce = ' + n + '\nhash  = ' + hex;
              strip.append(el('div', { class: 'chip ok' }, '#' + height, el('small', { class: 'mono' }, short(hex, 8, 4))));
              table.append(el('div', { class: 'mp-row' }, el('span', {}, 'difficulty ' + d), el('span', { class: 'mono' }, big(n + 1) + ' ' + A.t('tries')), el('span', { class: 'mono' }, secs.toFixed(2) + ' s')));
              prev = hex; height++;
              if (d <= 2) A.check('easy');
              if (d >= 4) { A.check('hard'); A.ach('miner'); }
              return finish();
            }
            n++;
          }
        }
        const rate = n / ((performance.now() - t0) / 1000);
        live.textContent = 'nonce = ' + n + '\n' + A.t('rate') + ' ' + big(rate) + ' H/s';
        if (stop) return finish();
        setTimeout(slice, 0);
      })();
    }, 'primary');
    root.append(A.tasks(['easy', 'hard']),
      field(A.t('difficulty'), sel), el('div', { class: 'row-btns' }, bStart), live, strip, table,
      note('warn', A.t('scale')));
  };

  // Proof of stake: stake-weighted proposer selection and slashing.
  L.staking = (root, A) => {
    const vals = [{ n: 'Atlas', s: 400 }, { n: 'Borealis', s: 250 }, { n: 'Cygnus', s: 150 }];
    const me = { n: A.t('you'), s: 0, me: true };
    let counts = new Map(), slashed = false;
    const lbl = el('b', {}, '0');
    const slider = el('input', { type: 'range', min: '0', max: '200', step: '10', value: '0', oninput: () => { me.s = +slider.value; lbl.textContent = slider.value; draw(); } });
    const table = el('div', { class: 'mempool' });
    const res = el('div');
    function draw() {
      const all = [...vals, me];
      const total = all.reduce((s, v) => s + v.s, 0);
      table.replaceChildren(el('div', { class: 'mp-row head' }, el('span', {}, 'Validator'), el('span', {}, 'Stake'), el('span', {}, A.t('share')), el('span', {}, A.t('blocks'))));
      all.forEach((v) => table.append(el('div', { class: 'mp-row' + (v.me ? ' mine' : '') },
        el('span', {}, v.n), el('span', { class: 'mono' }, v.s), el('span', { class: 'mono' }, total ? ((v.s / total) * 100).toFixed(1) + '%' : '—'),
        el('span', { class: 'mono' }, counts.get(v) || 0))));
    }
    const bRun = btn(A.t('run'), () => {
      const all = [...vals, me].filter((v) => v.s > 0);
      const total = all.reduce((s, v) => s + v.s, 0);
      counts = new Map();
      for (let slot = 0; slot < 100; slot++) {
        let x = Math.random() * total;
        const pick = all.find((v) => (x -= v.s) < 0) || all[all.length - 1];
        counts.set(pick, (counts.get(pick) || 0) + 1);
      }
      draw();
      const mine = counts.get(me) || 0;
      if (me.s > 0) { A.check('stake'); bSlash.disabled = slashed; }
      if (mine > 0) A.check('propose');
      res.replaceChildren(note(mine ? 'ok' : 'warn', A.t(me.s > 0 ? 'ran' : 'ranNoStake', { n: mine })));
    }, 'primary');
    const bSlash = btn(A.t('cheat'), () => {
      const loss = me.s / 2;
      res.replaceChildren(note('bad', A.t('slashed', { x: loss })));
      me.s = 0; slashed = true;
      slider.value = 0; slider.disabled = true; lbl.textContent = '0';
      bSlash.disabled = true;
      draw();
      A.check('slash');
      A.ach('staker');
    }, 'danger');
    bSlash.disabled = true;
    root.append(A.tasks(['stake', 'propose', 'slash']),
      field(el('span', {}, A.t('yourStake') + ' ', lbl, ' ' + A.coin.tkr), slider),
      table, el('div', { class: 'row-btns' }, bRun, bSlash), res);
    draw();
  };

  // Proof of authority: known signers taking turns, BFT quorum.
  L.authority = (root, A) => {
    const vs = A.ta('vals').map((n) => ({ n, on: true }));
    const NEED = 4;
    let h = 1, turn = 0;
    const chips = el('div', { class: 'coins' });
    const strip = el('div', { class: 'strip' });
    const res = el('div');
    function draw() {
      chips.replaceChildren(...vs.map((v) => el('button', { class: 'coin wide' + (v.on ? ' sel' : ' dead'), type: 'button', onclick: () => { v.on = !v.on; draw(); } },
        v.n, el('small', {}, v.on ? 'online' : 'offline'))));
    }
    const bRun = btn(A.t('produce'), () => {
      const online = vs.filter((v) => v.on).length;
      if (online < NEED) {
        res.replaceChildren(note('bad', A.t('halt', { n: online, need: NEED })));
        return A.check('halt');
      }
      for (let i = 0; i < 5; i++) {
        while (!vs[turn % vs.length].on) turn++;
        strip.append(el('div', { class: 'chip ok' }, '#' + h++, el('small', {}, vs[turn % vs.length].n)));
        turn++;
      }
      while (strip.children.length > 15) strip.firstChild.remove();
      res.replaceChildren(note('ok', A.t(online === vs.length ? 'allOn' : 'degraded', { n: online })));
      A.check('rotate');
      if (online < vs.length) A.check('tolerate');
    }, 'primary');
    root.append(A.tasks(['rotate', 'tolerate', 'halt']),
      field(A.t('validators'), chips), el('div', { class: 'row-btns' }, bRun), strip, res);
    draw();
    A.onDone(() => A.ach('authority'));
  };

  // Double-spend race: Satoshi's formula plus a Monte Carlo simulation.
  F.catchUp = function (q, z) {
    const p = 1 - q;
    if (q >= p) return 1;
    const lambda = (z * q) / p;
    let sum = 1, term = Math.exp(-lambda);
    for (let k = 0; k <= z; k++) {
      if (k > 0) term *= lambda / k;
      sum -= term * (1 - Math.pow(q / p, z - k));
    }
    return Math.max(0, sum);
  };
  L.finality = (root, A) => {
    const qL = el('b', {}), zL = el('b', {});
    const q = el('input', { type: 'range', min: '1', max: '55', step: '1', value: '10', oninput: draw });
    const z = el('input', { type: 'range', min: '0', max: '12', step: '1', value: '1', oninput: draw });
    const prob = el('div', { class: 'bigstat' });
    const res = el('div');
    const pct = (x) => (x >= 0.9995 ? '100' : x < 0.00001 ? '<0.001' : (x * 100).toFixed(x < 0.01 ? 3 : 1)) + '%';
    function draw() {
      qL.textContent = q.value + '%';
      zL.textContent = z.value;
      prob.replaceChildren(el('span', {}, A.t('theory')), el('b', {}, pct(F.catchUp(+q.value / 100, +z.value))));
    }
    const bRun = btn(A.t('run'), () => {
      const qq = +q.value / 100, zz = +z.value, RUNS = 2000;
      let wins = 0;
      for (let r = 0; r < RUNS; r++) {
        let a = 0, h = 0;
        while (h < zz) (Math.random() < qq ? a++ : h++);
        while (a < h && h - a < 40) (Math.random() < qq ? a++ : h++);
        if (a >= h) wins++;
      }
      const rate = wins / RUNS;
      res.replaceChildren(note(rate > 0.01 ? 'bad' : 'ok', A.t('sim', { wins, runs: RUNS, pct: pct(rate) })));
      if (zz === 0) A.check('zero');
      if (qq >= 0.1 && qq < 0.5 && F.catchUp(qq, zz) < 0.001) { A.check('safe'); A.ach('survivor'); }
      if (qq >= 0.5) A.check('majority');
    }, 'primary');
    root.append(A.tasks(['zero', 'safe', 'majority']),
      field(el('span', {}, A.t('attacker') + ' ', qL), q),
      field(el('span', {}, 'Confirmations: ', zL), z),
      prob, el('div', { class: 'row-btns' }, bRun), res);
    draw();
  };

  // =====================================================================
  // Chapter 5
  // =====================================================================

  // Which Base58Check version byte produces which leading address letter.
  F.addressLetters = function () {
    if (F._letters) return F._letters;
    const lo = new Uint8Array(20), hi = new Uint8Array(20).fill(255);
    const map = {};
    for (let v = 1; v < 128; v++) {
      const a = C.base58check(v, lo)[0], b = C.base58check(v, hi)[0];
      if (a === b && /[A-Z]/.test(a) && !(a in map)) map[a] = v;
    }
    return (F._letters = map);
  };
  const YEAR = 31557600;
  F.supplyAt = function (c, year) {
    if (c.policy === 'fixed') return c.s0;
    if (c.policy === 'inflation') return c.s0 * Math.pow(1 + c.infl / 100, year);
    const perEra = (YEAR / c.blockTime) * c.halvingYears * c.reward;
    let total = 0, era = 0, left = year;
    while (left > 0 && era < 64) {
      const span = Math.min(left, c.halvingYears);
      total += (perEra / Math.pow(2, era)) * (span / c.halvingYears);
      left -= span; era++;
    }
    return total;
  };
  F.supplyCap = (c) => (c.policy === 'halving' ? (YEAR / c.blockTime) * c.halvingYears * c.reward * 2 : c.policy === 'fixed' ? c.s0 : Infinity);

  L.tokenomics = (root, A) => {
    const letters = F.addressLetters();
    const prev = A.S.coin;
    const name = el('input', { maxlength: '20', value: prev.name || '', placeholder: 'Aurum', oninput: draw });
    const tkr = el('input', { maxlength: '5', value: prev.ticker || '', placeholder: 'AUR', oninput: () => { tkr.value = tkr.value.toUpperCase().replace(/[^A-Z]/g, ''); draw(); } });
    const letter = el('select', { onchange: draw }, Object.keys(letters).sort().map((l) => el('option', { selected: l === (prev.letter || 'C') }, l)));
    const policy = el('select', { onchange: draw }, ['halving', 'inflation', 'fixed'].map((p) => el('option', { value: p, selected: p === (prev.policy || 'halving') }, A.t('pol_' + p))));
    const blockTime = el('select', { onchange: draw }, [[600, '10 min'], [150, '2.5 min'], [60, '1 min'], [12, '12 s'], [3, '3 s']].map(([v, l]) => el('option', { value: v, selected: v === (prev.blockTime || 600) }, l)));
    const reward = el('input', { type: 'number', min: '0.01', step: 'any', value: prev.reward || 50, oninput: draw });
    const halv = el('select', { onchange: draw }, [1, 2, 4, 8].map((y) => el('option', { value: y, selected: y === (prev.halvingYears || 4) }, y)));
    const s0 = el('input', { type: 'number', min: '1', step: 'any', value: prev.s0 || 100000000, oninput: draw });
    const infl = el('input', { type: 'number', min: '0.1', max: '20', step: '0.1', value: prev.infl || 3, oninput: draw });
    const fHalv = el('div', {}, field('Block reward', reward), field(A.t('halvEvery'), halv));
    const fS0 = field(A.t('s0'), s0);
    const fInfl = field(A.t('inflPct'), infl);
    const chart = svg('svg', { viewBox: '0 0 520 190', class: 'chart' });
    const stats = el('div', { class: 'out' });
    const res = el('div');
    const read = () => ({
      name: name.value.trim(), ticker: tkr.value, letter: letter.value, ver: letters[letter.value],
      policy: policy.value, blockTime: +blockTime.value, reward: Math.max(0.01, +reward.value || 0.01),
      halvingYears: +halv.value, s0: Math.max(1, +s0.value || 1), infl: Math.min(20, Math.max(0.1, +infl.value || 0.1)),
    });
    function draw() {
      const c = read();
      fHalv.hidden = c.policy !== 'halving';
      fS0.hidden = c.policy === 'halving';
      fInfl.hidden = c.policy !== 'inflation';
      const YEARS = 40;
      const pts = [];
      for (let y = 0; y <= YEARS; y++) pts.push(F.supplyAt(c, y));
      const max = Math.max(...pts) || 1;
      const X = (y) => 40 + (y / YEARS) * 470, Y = (v) => 165 - (v / max) * 150;
      chart.replaceChildren(
        svg('line', { x1: 40, y1: 165, x2: 510, y2: 165, class: 'axis' }), svg('line', { x1: 40, y1: 15, x2: 40, y2: 165, class: 'axis' }),
        svg('path', { d: 'M' + pts.map((v, y) => X(y).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' L'), class: 'curve' }),
        svg('text', { x: 40, y: 182, class: 'lbl' }, '0'), svg('text', { x: 490, y: 182, class: 'lbl' }, YEARS + ' y'),
        svg('text', { x: 44, y: 12, class: 'lbl' }, big(max)));
      const cap = F.supplyCap(c);
      const y10 = F.supplyAt(c, 10), y11 = F.supplyAt(c, 11);
      stats.replaceChildren(
        el('div', { class: 'kv' }, el('span', {}, 'Max supply'), el('b', {}, isFinite(cap) ? big(cap) : '∞ (' + A.t('nocap') + ')')),
        el('div', { class: 'kv' }, el('span', {}, A.t('at10')), el('b', {}, big(y10))),
        el('div', { class: 'kv' }, el('span', {}, A.t('infl10')), el('b', {}, (((y11 - y10) / y10) * 100).toFixed(2) + '%')));
      const okId = c.name.length >= 2 && c.ticker.length >= 3;
      if (okId) A.check('identity');
      bMint.disabled = !okId;
    }
    const bMint = btn(A.t('mint'), () => {
      Object.assign(A.S.coin, read());
      A.save();
      A.refresh();
      A.check('mint');
      A.ach('minted');
      res.replaceChildren(note('ok', A.t('minted', { addr: A.wallet().addr })));
    }, 'primary');
    root.append(A.tasks(['identity', 'mint']),
      el('div', { class: 'cols2' },
        el('div', {}, field(A.t('name'), name), field('Ticker', tkr), field(A.t('letter'), letter),
          field(A.t('policy'), policy), field('Block time', blockTime), fHalv, fS0, fInfl),
        el('div', {}, el('div', { class: 'mp-h' }, A.t('curve')), chart, stats)),
      el('div', { class: 'row-btns' }, bMint), res);
    draw();
  };

  // A token contract on a toy virtual machine with gas metering.
  L.contracts = (root, A) => {
    const GAS = { tx: 21000, sload: 2100, sstore: 5000 };
    const PRICE = 20e-9; // 20 gwei, expressed in the native coin
    const st = { owner: 'You', total: 1050, bal: { You: 1000, Bob: 0, Carol: 50 } };
    const who = ['You', 'Bob', 'Carol'];
    const code = el('pre', { class: 'code' }, [
      'contract Token {',
      '  address owner;',
      '  uint totalSupply;',
      '  mapping(address => uint) balances;',
      '',
      '  function transfer(address to, uint amount) {',
      '    require(balances[msg.sender] >= amount, "insufficient balance");',
      '    balances[msg.sender] -= amount;',
      '    balances[to] += amount;',
      '  }',
      '',
      '  function mint(address to, uint amount) {',
      '    require(msg.sender == owner, "only owner");',
      '    totalSupply += amount;',
      '    balances[to] += amount;',
      '  }',
      '}'].join('\n'));
    const caller = el('select', {}, who.map((p) => el('option', {}, p)));
    const fn = el('select', {}, ['transfer', 'mint'].map((p) => el('option', {}, p)));
    const to = el('select', {}, who.map((p) => el('option', { selected: p === 'Bob' }, p)));
    const amt = el('input', { type: 'number', min: '1', step: '1', value: '100' });
    const gas = el('input', { type: 'number', min: '0', step: '1000', value: '50000' });
    const state = el('div', { class: 'out' });
    const log = el('div', { class: 'log' });
    const say = (kind, text) => log.prepend(el('div', { class: 'lrow ' + kind }, text));
    const draw = () => state.replaceChildren(
      el('div', { class: 'kv' }, el('span', {}, 'owner'), el('b', {}, st.owner)),
      el('div', { class: 'kv' }, el('span', {}, 'totalSupply'), el('b', {}, st.total)),
      ...who.map((p) => el('div', { class: 'kv' }, el('span', { class: 'mono' }, 'balances[' + p + ']'), el('b', {}, st.bal[p]))));
    const bCall = btn(A.t('call'), () => {
      const c = caller.value, f = fn.value, t = to.value, a = Math.max(1, Math.floor(+amt.value || 1)), limit = Math.floor(+gas.value || 0);
      const sigText = c + ' → ' + f + '(' + t + ', ' + a + ')';
      if (limit < GAS.tx) return say('bad', A.t('intrinsic', { call: sigText, min: GAS.tx }));
      // Meter the execution: each storage read/write costs gas.
      let used = GAS.tx + GAS.sload, fail = null;
      if (f === 'transfer' && st.bal[c] < a) fail = 'insufficient balance';
      if (f === 'mint' && c !== st.owner) fail = 'only owner';
      if (!fail) used += GAS.sload + 2 * GAS.sstore;
      const fee = (g) => (g * PRICE).toFixed(6);
      if (used > limit) {
        say('bad', A.t('oog', { call: sigText, gas: big(limit), fee: fee(limit) }));
        return A.check('oog');
      }
      if (fail) {
        say('bad', A.t('reverted', { call: sigText, why: fail, gas: big(used), fee: fee(used) }));
        return A.check('revert');
      }
      if (f === 'transfer') { st.bal[c] -= a; st.bal[t] += a; A.check('transfer'); }
      else { st.total += a; st.bal[t] += a; }
      say('ok', A.t('success', { call: sigText, gas: big(used), fee: fee(used) }));
      draw();
    }, 'primary');
    root.append(A.tasks(['transfer', 'revert', 'oog']),
      el('div', { class: 'cols2' },
        el('div', {}, el('div', { class: 'mp-h' }, A.t('code')), code),
        el('div', {}, el('div', { class: 'mp-h' }, A.t('state')), state,
          field('msg.sender', caller), field('function', fn), field('to', to), field('amount', amt), field('Gas limit', gas),
          el('div', { class: 'row-btns' }, bCall))),
      el('div', { class: 'mp-h' }, A.t('txlog')), log);
    draw();
    A.onDone(() => A.ach('outofgas'));
  };

  // Own mainnet: write the genesis block and start the network.
  L.genesis = (root, A) => {
    const w = A.wallet();
    const c = A.S.coin;
    const cons = c.consensus || 'pow';
    const msg = el('input', { maxlength: '80', placeholder: A.t('msgPh'), oninput: draw });
    const preL = el('b', {}, '5%');
    const pre = el('input', { type: 'range', min: '0', max: '60', step: '1', value: '5', oninput: draw });
    const json = el('pre', { class: 'out mono small' });
    const strip = el('div', { class: 'strip' });
    const res = el('div');
    const warn = el('div');
    let hash = null;
    const cap = F.supplyCap(Object.assign({ policy: 'halving', blockTime: 600, reward: 50, halvingYears: 4, s0: 1e8 }, c));
    const config = () => ({
      chainId: parseInt(C.sha256hex(A.coin.name).slice(0, 6), 16),
      name: A.coin.name, ticker: A.coin.tkr, consensus: cons.toUpperCase(), ledger: (c.model || 'utxo').toUpperCase(),
      blockTimeSeconds: c.blockTime || 600, timestamp: Math.floor(Date.now() / 1000),
      alloc: { [w.addr]: isFinite(cap) ? Math.round((cap * +pre.value) / 100) : Math.round((c.s0 || 1e8) * (+pre.value / 100)) },
      extraData: msg.value,
    });
    function draw() {
      preL.textContent = pre.value + '%';
      json.textContent = JSON.stringify(config(), null, 2);
      warn.replaceChildren(+pre.value > 20 ? note('warn', A.t('greedy')) : '');
      if (msg.value.trim().length >= 3) A.check('message');
      bForge.disabled = msg.value.trim().length < 3;
    }
    const bStart = btn(A.t('startNet'), () => {
      bStart.disabled = true;
      let h = 1, prev = hash;
      const next = () => {
        prev = C.sha256hex(prev + h);
        strip.append(el('div', { class: 'chip ok' }, '#' + h, el('small', { class: 'mono' }, short(prev, 6, 4))));
        if (++h <= 4) return setTimeout(next, 600);
        res.replaceChildren(note('ok', A.t('live')));
        A.check('start');
        A.ach('launched');
      };
      setTimeout(next, 400);
    });
    bStart.disabled = true;
    const bForge = btn(A.t('forge'), () => {
      const body = JSON.stringify(config());
      let extra;
      if (cons === 'pow') {
        let n = 0, h;
        do { h = C.sha256(body + n++); } while (!leadingZeros(h, 4));
        hash = C.hex(h);
        extra = A.t('forgedPow', { n: big(n) });
      } else {
        hash = C.sha256hex(body + C.sigHex(C.sign(w.d, body)));
        extra = A.t('forgedSig');
      }
      strip.replaceChildren(el('div', { class: 'chip gen' }, '#0 genesis', el('small', { class: 'mono' }, short(hash, 6, 4))));
      res.replaceChildren(note('ok', A.t('forged', { hash }) + ' ' + extra));
      msg.disabled = pre.disabled = bForge.disabled = true;
      bStart.disabled = false;
      A.check('forge');
    }, 'primary');
    root.append(A.tasks(['message', 'forge', 'start']),
      field(A.t('msg'), msg), field(el('span', {}, 'Premine: ', preL), pre), warn,
      field('genesis.json', json), el('div', { class: 'row-btns' }, bForge, bStart), strip, res);
    draw();
  };

  // Token on a host chain: deploy, mint, and hit the "no gas" wall.
  L.token = (root, A) => {
    const w = A.wallet();
    const r6 = (n) => Math.round(n * 1e6) / 1e6;
    const show = (n) => r6(n).toLocaleString('en-US', { maximumFractionDigits: 6 });
    const hosts = [
      { id: 'Ethereum', std: 'ERC-20', coin: 'ETH', deploy: 0.012, tx: 0.0009 },
      { id: 'Tron', std: 'TRC-20', coin: 'TRX', deploy: 350, tx: 14 },
      { id: 'BNB Chain', std: 'BEP-20', coin: 'BNB', deploy: 0.004, tx: 0.00008 },
      { id: 'Solana', std: 'SPL', coin: 'SOL', deploy: 0.01, tx: 0.00001 },
    ];
    let host = null, native = 0, depositGas = 0, contract = null, minted = false, tried = false;
    const supply = Math.round(isFinite(F.supplyCap(A.S.coin)) && A.S.coin.policy ? F.supplyCap(A.S.coin) : A.S.coin.s0 || 1000000);
    const bal = { you: 0, deposit: 0, treasury: 0 };
    const cards = el('div', { class: 'coins' });
    const state = el('div', { class: 'out' });
    const log = el('div', { class: 'log' });
    const say = (kind, text) => log.prepend(el('div', { class: 'lrow ' + kind }, text));
    function draw() {
      cards.replaceChildren(...hosts.map((h) => el('button', { class: 'coin wide' + (host === h ? ' sel' : ''), type: 'button', disabled: !!contract,
        onclick: () => { host = h; native = h.deploy * 3; draw(); } }, h.id, el('small', {}, h.std + ' · gas in ' + h.coin))));
      state.replaceChildren(...(host ? [
        el('div', { class: 'kv' }, el('span', {}, A.t('yourGas')), el('b', {}, show(native) + ' ' + host.coin)),
        el('div', { class: 'kv' }, el('span', {}, 'Contract'), el('b', { class: 'mono small' }, contract || '—')),
        el('div', { class: 'kv' }, el('span', {}, A.t('yourTokens')), el('b', {}, big(bal.you) + ' ' + A.coin.tkr)),
        el('div', { class: 'kv' }, el('span', {}, A.t('depAddr')), el('b', {}, big(bal.deposit) + ' ' + A.coin.tkr + ' · ' + show(depositGas) + ' ' + host.coin)),
        el('div', { class: 'kv' }, el('span', {}, 'Treasury'), el('b', {}, big(bal.treasury) + ' ' + A.coin.tkr)),
      ] : [el('div', { class: 'hint' }, A.t('pick'))]));
      bDeploy.disabled = !host || !!contract;
      bMint.disabled = !contract || minted;
      bPay.disabled = !minted || bal.deposit > 0 || bal.treasury > 0;
      bSweep.disabled = bal.deposit === 0;
      bFund.disabled = !tried || bal.deposit === 0 || depositGas > 0;
    }
    const bDeploy = btn(A.t('deploy'), () => {
      native = r6(native - host.deploy);
      contract = (host.id === 'Tron' ? 'T' : '0x') + C.sha256hex(w.addr + ':0').slice(0, 38);
      A.S.coin.host = host.id; A.S.coin.std = host.std; A.save();
      say('ok', A.t('deployed', { std: host.std, host: host.id, fee: host.deploy + ' ' + host.coin }));
      A.check('deploy'); draw();
    }, 'primary');
    const bMint = btn(A.t('mint'), () => {
      native = r6(native - host.tx); bal.you = supply; minted = true;
      say('ok', A.t('minted', { n: big(supply) })); A.check('mint'); draw();
    });
    const bPay = btn(A.t('pay'), () => {
      bal.you -= 100; bal.deposit += 100;
      say('ok', A.t('paid')); draw();
    });
    const bSweep = btn(A.t('sweep'), () => {
      tried = true;
      if (depositGas < host.tx) { say('bad', A.t('nogas', { coin: host.coin })); return draw(); }
      depositGas = r6(depositGas - host.tx); bal.treasury += bal.deposit; bal.deposit = 0;
      say('ok', A.t('swept')); A.check('gas'); A.ach('launched'); draw();
    });
    const bFund = btn(A.t('fund'), () => {
      native = r6(native - host.tx * 3); depositGas = r6(host.tx * 2);
      say('warn', A.t('funded', { coin: host.coin })); draw();
    });
    root.append(A.tasks(['deploy', 'mint', 'gas']), field(A.t('host'), cards), state,
      el('div', { class: 'row-btns' }, bDeploy, bMint, bPay, bSweep, bFund), log);
    draw();
  };

  // =====================================================================
  // Chapter 6
  // =====================================================================

  // Match the node type to the job.
  L.nodeops = (root, A) => {
    const types = ['full', 'archive', 'validator', 'light', 'provider'];
    const jobs = [['payments', 'full'], ['audit', 'archive'], ['produce', 'validator'], ['mobile', 'light'], ['proto', 'provider']];
    const res = el('div');
    const rows = jobs.map(([job, answer]) => {
      const sel = el('select', {}, el('option', { value: '' }, '—'), types.map((t) => el('option', { value: t }, A.t('type_' + t))));
      const mark = el('span', { class: 'mark' });
      return { job, answer, sel, mark, row: el('div', { class: 'match' }, el('div', {}, A.t('job_' + job)), sel, mark) };
    });
    const bCheck = btn(A.t('check'), () => {
      let good = 0;
      const why = [];
      rows.forEach((r) => {
        const ok = r.sel.value === r.answer;
        r.mark.textContent = ok ? '✓' : '✗';
        r.mark.className = 'mark ' + (ok ? 'ok' : 'bad');
        if (ok) good++; else why.push('<li>' + A.t('why_' + r.job) + '</li>');
      });
      if (good === rows.length) { res.replaceChildren(note('ok', A.t('allGood'))); A.check('match'); }
      else res.replaceChildren(note('bad', A.t('some', { n: good, of: rows.length }) + '<ul>' + why.join('') + '</ul>'));
    }, 'primary');
    root.append(A.tasks(['match']), ...rows.map((r) => r.row), el('div', { class: 'row-btns' }, bCheck), res);
  };

  // Architecture builder + chaos tests.
  const COMPONENTS = [
    { id: 'nodes', count: [1, 4], cost: 400 },
    { id: 'validators', count: [1, 7], cost: 300, only: 'l1' },
    { id: 'bootnodes', cost: 80, only: 'l1' },
    { id: 'gateway', cost: 80 },
    { id: 'fallback', cost: 150, only: 'token' },
    { id: 'multiregion', cost: 300 },
    { id: 'indexer', cost: 350 },
    { id: 'explorer', cost: 200, only: 'l1' },
    { id: 'vault', cost: 600 },
    { id: 'monitoring', cost: 100 },
    { id: 'snapshots', cost: 60 },
    { id: 'waf', cost: 90 },
  ];
  const SCENARIOS = [
    { id: 'crash', test: (c, l1) => !!c.gateway && c.nodes + (!l1 && c.fallback ? 1 : 0) >= 2 },
    { id: 'region', test: (c, l1) => !!c.gateway && ((c.multiregion && c.nodes >= 2) || (!l1 && !!c.fallback)) },
    { id: 'stale', test: (c) => !!c.monitoring && !!c.gateway },
    { id: 'history', test: (c) => !!c.indexer },
    { id: 'breach', test: (c) => !!c.vault },
    { id: 'resync', test: (c) => !!c.snapshots },
    { id: 'flood', test: (c) => !!c.waf },
    { id: 'peers', only: 'l1', test: (c) => !!c.bootnodes },
    { id: 'valdown', only: 'l1', test: (c, l1, cons) => c.validators >= (cons === 'pow' ? 2 : 4) },
    { id: 'where', only: 'l1', test: (c) => !!c.explorer },
    { id: 'provider', only: 'token', test: (c) => c.nodes >= 1 && !!c.fallback && !!c.gateway },
  ];
  const applies = (x, launch) => !x.only || x.only === launch;
  F.arch = {
    components: (launch) => COMPONENTS.filter((c) => applies(c, launch)),
    scenarios: (launch) => SCENARIOS.filter((s) => applies(s, launch)),
    cost(cfg, launch) {
      return F.arch.components(launch).reduce((s, c) => s + (c.count ? (cfg[c.id] || 0) * c.cost : cfg[c.id] ? c.cost : 0), 0);
    },
    run(cfg, launch, cons) {
      return F.arch.scenarios(launch).map((s) => ({ id: s.id, pass: s.test(cfg, launch === 'l1', cons) }));
    },
    // Cheapest configuration that survives every scenario (brute force).
    minCost(launch, cons) {
      const comps = F.arch.components(launch);
      let best = Infinity;
      (function walk(i, cfg) {
        if (i === comps.length) {
          if (F.arch.run(cfg, launch, cons).every((r) => r.pass)) best = Math.min(best, F.arch.cost(cfg, launch));
          return;
        }
        const c = comps[i];
        const options = c.count ? Array.from({ length: c.count[1] - c.count[0] + 1 }, (_, k) => c.count[0] + k) : [0, 1];
        for (const v of options) walk(i + 1, Object.assign({}, cfg, { [c.id]: v }));
      })(0, {});
      return best;
    },
  };

  L.architecture = (root, A) => {
    const launch = A.S.coin.launch || 'l1';
    const cons = A.S.coin.consensus || 'pow';
    const comps = F.arch.components(launch);
    const cfg = Object.assign({}, A.S.arch || {});
    comps.forEach((c) => { if (cfg[c.id] == null) cfg[c.id] = c.count ? c.count[0] : 0; });
    const list = el('div', { class: 'arch' });
    const total = el('b', {});
    const res = el('div');
    const label = (c) => A.t('comp_' + c.id + (c.id === 'validators' && cons === 'pow' ? '_pow' : ''));
    function draw() {
      list.replaceChildren(...comps.map((c) => {
        const control = c.count
          ? el('div', { class: 'stepper' },
            btn('−', () => { cfg[c.id] = Math.max(c.count[0], cfg[c.id] - 1); draw(); }, 'small'),
            el('b', {}, cfg[c.id]),
            btn('+', () => { cfg[c.id] = Math.min(c.count[1], cfg[c.id] + 1); draw(); }, 'small'))
          : el('button', { class: 'toggle' + (cfg[c.id] ? ' on' : ''), type: 'button', onclick: () => { cfg[c.id] = cfg[c.id] ? 0 : 1; draw(); } }, cfg[c.id] ? 'ON' : 'OFF');
        return el('div', { class: 'arch-row' + (c.count || cfg[c.id] ? ' on' : '') },
          el('div', {}, el('b', {}, label(c)), el('div', { class: 'hint', html: A.t('desc_' + c.id) })),
          el('div', { class: 'mono cost' }, '$' + c.cost + (c.count ? ' ×' : '')), control);
      }));
      total.textContent = '$' + big(F.arch.cost(cfg, launch)) + ' / ' + A.t('month');
    }
    const bRun = btn(A.t('run'), () => {
      const results = F.arch.run(cfg, launch, cons);
      const failed = results.filter((r) => !r.pass).length;
      A.S.arch = Object.assign({}, cfg);
      A.save();
      res.replaceChildren(
        ...results.map((r) => el('div', { class: 'lrow ' + (r.pass ? 'ok' : 'bad') },
          el('b', {}, (r.pass ? '✓ ' : '✗ ') + A.t('scn_' + r.id)), el('div', { class: 'hint', html: A.t((r.pass ? 'ok_' : 'fail_') + r.id) }))),
        note(failed ? 'bad' : 'ok', A.t(failed ? 'failed' : 'passed', { n: failed })));
      if (!failed) {
        A.check('pass');
        A.ach('chaos');
        if (F.arch.cost(cfg, launch) <= F.arch.minCost(launch, cons)) A.ach('lean');
      }
    }, 'primary');
    root.append(A.tasks(['pass']), list,
      el('div', { class: 'kv total' }, el('span', {}, A.t('total')), total),
      el('div', { class: 'row-btns' }, bRun), res);
    draw();
  };

  // Treasury tiers and a multisig approval.
  F.treasurySim = function (hot, warm) {
    const demand = [4, 6, 3, 8, 5, 7, 10, 4, 6, 5];
    const HACK_DAY = 6;
    let h = hot, w = warm, delayed = 0, loss = 0, arriving = -1;
    const days = [];
    demand.forEach((d, i) => {
      const day = i + 1;
      const ev = { day, demand: d };
      if (day === arriving) { w = warm; arriving = -1; ev.refill = true; }
      if (day === HACK_DAY) { loss = h; ev.hack = h; h = 0; const x = Math.min(hot, w); h += x; w -= x; }
      if (h < d) { delayed++; ev.delayed = true; } else h -= d;
      const x = Math.min(hot - h, w);
      h += x; w -= x;
      if (w < warm / 2 && arriving < 0) arriving = day + 2;
      ev.hot = h; ev.warm = w;
      days.push(ev);
    });
    return { days, delayed, loss, cold: 100 - hot - warm };
  };

  L.keysec = (root, A) => {
    const hL = el('b', {}), wL = el('b', {}), cL = el('b', {});
    const hot = el('input', { type: 'range', min: '0', max: '60', step: '1', value: '40', oninput: draw });
    const warm = el('input', { type: 'range', min: '0', max: '60', step: '1', value: '5', oninput: draw });
    const bar = el('div', { class: 'tiers' });
    const res = el('div');
    function draw() {
      const h = +hot.value, w = Math.min(+warm.value, 100 - h), c = 100 - h - w;
      warm.value = w;
      hL.textContent = h + '%'; wL.textContent = w + '%'; cL.textContent = c + '%';
      bar.replaceChildren(el('div', { class: 'tier hot', style: 'flex:' + h }), el('div', { class: 'tier warm', style: 'flex:' + w }), el('div', { class: 'tier cold', style: 'flex:' + c }));
    }
    const bRun = btn(A.t('run'), () => {
      const r = F.treasurySim(+hot.value, +warm.value);
      const problems = [];
      if (r.delayed) problems.push(A.t('pDelayed', { n: r.delayed }));
      if (r.loss > 15) problems.push(A.t('pLoss', { x: r.loss }));
      if (r.cold < 50) problems.push(A.t('pCold', { x: r.cold }));
      res.replaceChildren(
        el('div', { class: 'log tall' }, r.days.map((d) => el('div', { class: 'lrow ' + (d.hack != null || d.delayed ? 'bad' : '') },
          A.t('day', { d: d.day, demand: d.demand, hot: d.hot, warm: d.warm }) +
          (d.hack != null ? ' — ' + A.t('hack', { x: d.hack }) : '') + (d.delayed ? ' — ' + A.t('delayed') : '') + (d.refill ? ' — ' + A.t('refill') : '')))),
        note(problems.length ? 'bad' : 'ok', problems.length ? '<ul><li>' + problems.join('</li><li>') + '</li></ul>' : A.t('survived', { x: r.loss })));
      if (!problems.length) A.check('survive');
    }, 'primary');

    // 2-of-3 multisig with real signatures.
    const signers = A.ta('signers').map((n, i) => ({ n, d: C.big(C.sha256('signer' + i)) % (C.N - 1n) + 1n, sig: null }));
    const order = A.t('order');
    const msOut = el('div');
    const msBtns = el('div', { class: 'row-btns' }, signers.map((s) => {
      const b = btn(A.t('signAs', { n: s.n }), () => {
        s.sig = C.sign(s.d, order);
        b.disabled = true;
        const valid = signers.filter((x) => x.sig && C.verify(C.pubPoint(x.d), order, x.sig)).length;
        msOut.replaceChildren(note(valid >= 2 ? 'ok' : 'warn', A.t(valid >= 2 ? 'msOk' : 'msWait', { n: valid })));
        if (valid >= 2) A.check('multisig');
      });
      return b;
    }));
    root.append(A.tasks(['survive', 'multisig']),
      el('div', { class: 'stepbox' },
        el('div', { class: 'hint' }, A.t('rules')),
        field(el('span', {}, 'Hot wallet: ', hL), hot), field(el('span', {}, 'Warm wallet: ', wL), warm),
        el('div', { class: 'kv' }, el('span', {}, 'Cold wallet'), cL), bar,
        el('div', { class: 'row-btns' }, bRun), res),
      el('div', { class: 'stepbox' },
        el('b', {}, 'Multisig 2-of-3'), el('div', { class: 'hint' }, A.t('msIntro')),
        el('div', { class: 'out mono small' }, order), msBtns, msOut));
    draw();
    A.onDone(() => A.ach('vault'));
  };

  // =====================================================================
  // Chapter 7
  // =====================================================================

  // Deposit addresses from an xpub, confirmations, and a reorg.
  L.deposits = (root, A) => {
    if (!A.S.seed) { A.S.seed = F.newSeed(); A.save(); }
    const master = C.seedToPriv(A.S.seed);
    const xpub = C.pubPoint(master);
    const customers = A.ta('customers');
    const addrs = [];
    const list = el('div', { class: 'addrlist' });
    const proof = el('div');
    const sim = el('div');
    const bProve = btn(A.t('prove'), () => {
      const i = addrs.length - 1;
      const viaPriv = C.address(C.pubPoint(C.childPriv(master, i)), A.coin.ver);
      proof.replaceChildren(note(viaPriv === addrs[i] ? 'ok' : 'bad', A.t('proved', { i, addr: viaPriv })));
    }, 'ghost');
    bProve.disabled = true;
    const bNew = btn(A.t('newAddr'), () => {
      const i = addrs.length;
      addrs.push(C.address(C.childPub(xpub, i), A.coin.ver));
      list.append(el('div', { class: 'kv' }, el('span', {}, customers[i] + ' · m/' + i), el('span', { class: 'mono small' }, addrs[i])));
      bProve.disabled = false;
      if (addrs.length >= customers.length) bNew.disabled = true;
      if (addrs.length >= 2) { A.check('derive'); bStart.disabled = false; }
    }, 'primary');

    const conf = el('select', {}, [0, 1, 2, 3, 4, 6].map((n) => el('option', { value: n, selected: n === 1 }, n)));
    const strip = el('div', { class: 'strip' });
    const log = el('div', { class: 'log' });
    const say = (kind, text) => log.prepend(el('div', { class: 'lrow ' + kind }, text));
    let tip, deps, lost, need, sawReorg;
    // Script: a 500 deposit lands in block 2, then blocks 2-3 are reorganized away.
    const SCRIPT = { 1: [{ to: 0, amt: 100 }], 2: [{ to: 1, amt: 500, doomed: true }], 5: [{ to: 0, amt: 250 }] };
    const END = 8;
    const chip = (h, cls, sub) => el('div', { class: 'chip ' + cls }, '#' + h, el('small', {}, sub || ''));
    function credit() {
      deps.forEach((d) => {
        if (!d.credited && !d.gone && tip - d.h + 1 >= need) {
          d.credited = true;
          say('ok', A.t('credited', { amt: d.amt, who: customers[d.to], n: tip - d.h + 1 }));
        }
      });
    }
    const bNext = btn(A.t('next'), () => {
      if (tip === 3 && !sawReorg) {
        sawReorg = true;
        A.check('reorg');
        [...strip.children].slice(1).forEach((c) => c.classList.add('orphan'));
        strip.append(chip("2'", 'ok'), chip("3'", 'ok'), chip("4'", 'ok'));
        tip = 4;
        say('bad', A.t('reorg'));
        deps.forEach((d) => {
          if (!d.doomed) return;
          d.gone = true;
          if (d.credited) { lost += d.amt; say('bad', A.t('lost', { amt: d.amt, who: customers[d.to] })); }
          else say('warn', A.t('dodged', { amt: d.amt }));
        });
      } else {
        tip++;
        const txs = SCRIPT[tip] || [];
        strip.append(chip(tip, 'ok', txs.length ? '+' + txs[0].amt : ''));
        txs.forEach((t) => {
          deps.push({ h: tip, to: t.to, amt: t.amt, doomed: t.doomed });
          say('', A.t('seen', { amt: t.amt, who: customers[t.to], h: tip }));
        });
      }
      credit();
      if (tip >= END) {
        bNext.disabled = true;
        const pending = deps.filter((d) => !d.gone && !d.credited).length;
        if (lost) sim.querySelector('.final').replaceChildren(note('bad', A.t('endLoss', { x: lost })));
        else if (pending) sim.querySelector('.final').replaceChildren(note('warn', A.t('endSlow')));
        else { sim.querySelector('.final').replaceChildren(note('ok', A.t('endSafe', { n: need }))); A.check('safe'); A.ach('reorgproof'); }
      }
    });
    const bStart = btn(A.t('start'), () => {
      tip = 0; deps = []; lost = 0; sawReorg = false; need = +conf.value;
      strip.replaceChildren(); log.replaceChildren();
      sim.querySelector('.final').replaceChildren();
      bNext.disabled = false;
      say('', A.t('started', { n: need }));
    });
    bStart.disabled = bNext.disabled = true;
    sim.append(field(A.t('threshold'), conf), el('div', { class: 'row-btns' }, bStart, bNext), strip, log, el('div', { class: 'final' }));
    root.append(A.tasks(['derive', 'reorg', 'safe']),
      el('div', { class: 'stepbox' },
        el('div', { class: 'kv col' }, el('span', {}, A.t('serverHas')), el('div', { class: 'mono small' }, C.pubHex(xpub))),
        el('div', { class: 'row-btns' }, bNew, bProve), list, proof),
      el('div', { class: 'stepbox' }, sim));
  };
})();
