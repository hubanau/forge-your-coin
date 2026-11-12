/*
 * Forge Your Coin - self-checks. No dependencies: run with `node tests/run.js`.
 *
 * 1. The cryptographic core is checked against published test vectors.
 * 2. Every locale is checked against the English source: same keys, same
 *    array lengths, same {placeholders}, and every text key that the course
 *    structure refers to actually exists.
 */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');

let failed = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log((ok ? '  ok    ' : '  FAIL  ') + name + (ok ? '' : '\n          expected ' + expected + '\n          actual   ' + actual));
};

// ---------------------------------------------------------------- crypto
console.log('crypto');
const C = require(path.join(root, 'js/crypto.js'));

check('SHA-256("")', C.sha256hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
check('SHA-256("abc")', C.sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('SHA-256 matches Node for a multi-block input', C.sha256hex('a'.repeat(1000)),
  require('crypto').createHash('sha256').update('a'.repeat(1000)).digest('hex'));
check('RIPEMD-160("")', C.hex(C.ripemd160('')), '9c1185a5c5e9fc54612808977ee8f548b2258d31');
check('RIPEMD-160("abc")', C.hex(C.ripemd160('abc')), '8eb208f7e05d987a9b044a8e98c6b087f15a0bfc');
check('RIPEMD-160(8 x "1234567890")', C.hex(C.ripemd160('1234567890'.repeat(8))), '9b752e45573d4b39f4dbd3323cab82bf63326bfb');
check('secp256k1: 2G', C.pubPoint(2n)[0].toString(16), 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5');
check('Bitcoin address of private key 1', C.address(C.pubPoint(1n), 0), '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH');

const d = C.randomPriv();
const Q = C.pubPoint(d);
const sig = C.sign(d, 'Pay Bob 5');
check('ECDSA: a valid signature verifies', C.verify(Q, 'Pay Bob 5', sig), true);
check('ECDSA: a tampered message is rejected', C.verify(Q, 'Pay Bob 500', sig), false);
check('ECDSA: another key is rejected', C.verify(C.pubPoint(d + 1n), 'Pay Bob 5', sig), false);
check('ECDSA: signatures are in low-s form', sig.s <= C.N / 2n, true);
check('HD: public and private derivation agree', C.pubHex(C.childPub(Q, 7)), C.pubHex(C.pubPoint(C.childPriv(d, 7))));

// --------------------------------------------------------------- locales
console.log('locales');
global.window = {};
require(path.join(root, 'js/levels.js'));
for (const f of require('fs').readdirSync(path.join(root, 'locales'))) require(path.join(root, 'locales', f));
const F = global.window.FYC;
const en = F.locales.en;
const look = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join();

for (const code of Object.keys(F.locales).filter((c) => c !== 'en')) {
  const problems = [];
  (function compare(a, b, p) {
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return problems.push('array length differs: ' + p);
      return a.forEach((x, i) => compare(x, b[i], p + '[' + i + ']'));
    }
    if (a && typeof a === 'object') {
      for (const k in a) (b && k in b ? compare(a[k], b[k], p + '.' + k) : problems.push('missing: ' + p + '.' + k));
      for (const k in b || {}) if (!(k in a)) problems.push('unknown key: ' + p + '.' + k);
      return;
    }
    if (typeof a !== typeof b) problems.push('type differs: ' + p);
    else if (typeof a === 'string' && placeholders(a) !== placeholders(b)) problems.push('placeholders differ: ' + p);
  })(en, F.locales[code], code);
  check('locale "' + code + '" mirrors "en"', problems.join('; '), '');
}

const missing = [];
const need = (p) => { if (look(en, p) == null) missing.push(p); };
const sampleStates = [
  { coin: { model: 'utxo', consensus: 'pow', launch: 'l1' } },
  { coin: { model: 'account', consensus: 'pos', launch: 'l1' } },
  { coin: { model: 'utxo', consensus: 'poa', launch: 'token' } },
];
for (const lv of F.levels) {
  need('levels.' + lv.id + '.title');
  need('levels.' + lv.id + '.sub');
  for (const st of lv.steps) {
    const base = 'levels.' + lv.id + '.';
    if (st.t === 'theory') {
      for (const k of typeof st.k === 'function' ? sampleStates.map(st.k) : [st.k]) { need(base + k + '.h'); need(base + k + '.p'); }
      for (const term of st.terms) if (!F.terms[term]) missing.push('term ' + term);
    } else if (st.t === 'quiz') {
      const q = look(en, base + st.k);
      if (!q || q.o.length !== q.e.length || st.a >= q.o.length) missing.push('quiz ' + base + st.k);
    } else if (st.t === 'choice') {
      for (const o of st.opts) for (const f of ['n', 'd', 'plus', 'minus', 'used']) need(base + st.k + '.o.' + o + '.' + f);
    } else if (st.t === 'lab') {
      need('labs.' + st.lab + '.title');
      need('labs.' + st.lab + '.intro');
    }
  }
}
Object.keys(F.terms).forEach((id) => need('codex.' + id));
F.achievements.forEach((id) => need('ach.' + id));
F.atlas.forEach((row) => need('atlas.n.' + row.id));
check('every text key used by the course exists', missing.join('; '), '');

const taught = new Set(F.levels.flatMap((l) => l.steps.flatMap((s) => s.terms || [])));
check('every glossary term is taught in some level', Object.keys(F.terms).filter((id) => !taught.has(id)).join(), '');

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nall checks passed');
process.exit(failed ? 1 : 0);
