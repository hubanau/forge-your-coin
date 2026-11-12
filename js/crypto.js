/*
 * Forge Your Coin - cryptographic core.
 *
 * Everything the game shows is computed for real, in the browser, with no
 * dependencies: SHA-256, RIPEMD-160, Base58Check and ECDSA over secp256k1
 * (the curve used by Bitcoin and Ethereum).
 *
 * This code is written for readability and teaching. It is NOT constant-time
 * and must never be used to protect real funds.
 */
(function (root) {
  'use strict';

  const C = {};
  const enc = new TextEncoder();

  // ---------- bytes ----------
  C.utf8 = (s) => enc.encode(s);
  C.hex = (b) => {
    let s = '';
    for (let i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return s;
  };
  C.unhex = (h) => {
    const b = new Uint8Array(h.length / 2);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
    return b;
  };
  C.concat = (...parts) => {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };
  const bytes = (m) => (typeof m === 'string' ? enc.encode(m) : m);

  // ---------- SHA-256 ----------
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const W = new Uint32Array(64);

  C.sha256 = function (message) {
    const msg = bytes(message);
    const len = msg.length;
    const total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(msg);
    m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(len / 0x20000000));
    dv.setUint32(total - 4, (len << 3) >>> 0);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15], b = W[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    const out = new Uint8Array(32);
    const o = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => o.setUint32(i * 4, v >>> 0));
    return out;
  };
  C.sha256hex = (m) => C.hex(C.sha256(m));

  // ---------- RIPEMD-160 ----------
  const RL = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13];
  const RR = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11];
  const SL = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6];
  const SR = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11];
  const KL = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
  const rol = (x, n) => (x << n) | (x >>> (32 - n));
  const rf = (j, x, y, z) => {
    switch (j) {
      case 0: return x ^ y ^ z;
      case 1: return (x & y) | (~x & z);
      case 2: return (x | ~y) ^ z;
      case 3: return (x & z) | (y & ~z);
      default: return x ^ (y | ~z);
    }
  };

  C.ripemd160 = function (message) {
    const msg = bytes(message);
    const len = msg.length;
    const total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total);
    m.set(msg);
    m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, (len << 3) >>> 0, true);
    dv.setUint32(total - 4, Math.floor(len / 0x20000000), true);

    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const X = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) X[i] = dv.getUint32(off + i * 4, true);
      let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
      let ar = h0, br = h1, cr = h2, dr = h3, er = h4;
      for (let j = 0; j < 80; j++) {
        const r = (j / 16) | 0;
        let t = (rol((al + rf(r, bl, cl, dl) + X[RL[j]] + KL[r]) | 0, SL[j]) + el) | 0;
        al = el; el = dl; dl = rol(cl, 10); cl = bl; bl = t;
        t = (rol((ar + rf(4 - r, br, cr, dr) + X[RR[j]] + KR[r]) | 0, SR[j]) + er) | 0;
        ar = er; er = dr; dr = rol(cr, 10); cr = br; br = t;
      }
      const t = (h1 + cl + dr) | 0;
      h1 = (h2 + dl + er) | 0;
      h2 = (h3 + el + ar) | 0;
      h3 = (h4 + al + br) | 0;
      h4 = (h0 + bl + cr) | 0;
      h0 = t;
    }
    const out = new Uint8Array(20);
    const o = new DataView(out.buffer);
    [h0, h1, h2, h3, h4].forEach((v, i) => o.setUint32(i * 4, v >>> 0, true));
    return out;
  };

  // ---------- Base58Check ----------
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  C.base58 = function (b) {
    let n = b.length ? BigInt('0x' + C.hex(b)) : 0n;
    let s = '';
    while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
    for (let i = 0; i < b.length && b[i] === 0; i++) s = '1' + s;
    return s;
  };
  C.base58check = function (version, payload) {
    const data = C.concat(new Uint8Array([version]), payload);
    const checksum = C.sha256(C.sha256(data)).slice(0, 4);
    return C.base58(C.concat(data, checksum));
  };

  // ---------- secp256k1 ----------
  const P = 2n ** 256n - 2n ** 32n - 977n;
  const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const G = [
    0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  ];
  C.N = N;
  C.G = G;

  const mod = (a, m) => { const r = a % m; return r >= 0n ? r : r + m; };
  function inv(a, m) {
    let lm = 1n, hm = 0n, lo = mod(a, m), hi = m;
    while (lo > 1n) {
      const q = hi / lo;
      [lm, hm] = [hm - lm * q, lm];
      [lo, hi] = [hi - lo * q, lo];
    }
    return mod(lm, m);
  }
  // Point addition on y^2 = x^3 + 7. `null` is the point at infinity.
  function add(A, B) {
    if (!A) return B;
    if (!B) return A;
    const [x1, y1] = A, [x2, y2] = B;
    let l;
    if (x1 === x2) {
      if (mod(y1 + y2, P) === 0n) return null;
      l = mod(3n * x1 * x1 * inv(2n * y1, P), P);
    } else {
      l = mod((y2 - y1) * inv(x2 - x1, P), P);
    }
    const x3 = mod(l * l - x1 - x2, P);
    return [x3, mod(l * (x1 - x3) - y1, P)];
  }
  // Double-and-add scalar multiplication.
  function mul(k, A) {
    let R = null, Q = A;
    k = mod(k, N);
    while (k > 0n) {
      if (k & 1n) R = add(R, Q);
      Q = add(Q, Q);
      k >>= 1n;
    }
    return R;
  }
  C.add = add;
  C.mul = mul;

  C.big = (b) => BigInt('0x' + C.hex(b));
  C.b32 = (n) => C.unhex(n.toString(16).padStart(64, '0'));

  C.randomPriv = function () {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    return (C.big(b) % (N - 1n)) + 1n;
  };
  C.pubPoint = (d) => mul(d, G);
  // Compressed public key: 0x02/0x03 prefix (parity of y) + 32-byte x.
  C.pubBytes = (Q) => C.concat(new Uint8Array([Q[1] & 1n ? 3 : 2]), C.b32(Q[0]));
  C.pubHex = (Q) => C.hex(C.pubBytes(Q));
  C.hash160 = (b) => C.ripemd160(C.sha256(b));
  C.address = (Q, version) => C.base58check(version || 0, C.hash160(C.pubBytes(Q)));

  // ECDSA. The nonce k is derived deterministically from the key and the
  // message (the idea behind RFC 6979, simplified here to a single hash).
  C.sign = function (d, message) {
    const h = C.sha256(message);
    const z = C.big(h);
    let k = C.big(C.sha256(C.concat(C.b32(d), h))) % N;
    if (k === 0n) k = 1n;
    const R = mul(k, G);
    const r = mod(R[0], N);
    let s = mod(inv(k, N) * (z + r * d), N);
    if (s > N / 2n) s = N - s; // low-s form, as Bitcoin requires
    return { r, s };
  };
  C.verify = function (Q, message, sig) {
    const { r, s } = sig;
    if (!Q || r <= 0n || r >= N || s <= 0n || s >= N) return false;
    const z = C.big(C.sha256(message));
    const w = inv(s, N);
    const X = add(mul(mod(z * w, N), G), mul(mod(r * w, N), Q));
    return !!X && mod(X[0], N) === r;
  };
  C.sigHex = (sig) => C.hex(C.b32(sig.r)) + C.hex(C.b32(sig.s));

  // ---------- Hierarchical deterministic keys (simplified BIP-32) ----------
  // child private key = parent private key + tweak
  // child public key  = parent public key  + tweak * G
  // The tweak depends only on the PUBLIC key, so a server holding just the
  // public key can derive every child address without ever seeing a private key.
  C.seedToPriv = (phrase) => (C.big(C.sha256('fyc-seed:' + phrase)) % (N - 1n)) + 1n;
  C.tweak = (Q, index) => C.big(C.sha256(C.concat(C.pubBytes(Q), C.utf8(':' + index)))) % N;
  C.childPriv = (d, index) => mod(d + C.tweak(C.pubPoint(d), index), N);
  C.childPub = (Q, index) => add(Q, mul(C.tweak(Q, index), G));

  root.FYC = root.FYC || {};
  root.FYC.crypto = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
