/**
 * ============================================================
 * common.js — P2P Wallet App
 * - Firebase init (compat SDK)
 * - Auth + Firestore helpers
 * - UI helpers (toast, haptic, modal, formatting)
 * - TP.walletAPI (TextilePOS-compatible helpers)
 * - P2P namespace (module exports)
 * - Built-in QR Code Generator (no external library needed)
 * - PWA service worker registration
 * ============================================================
 */

/* ============================================================
 * FIREBASE INIT
 * ============================================================ */
if (!firebase.apps.length) {
  firebase.initializeApp(window.FIREBASE_CONFIG);
}
const auth = firebase.auth();
const db = firebase.firestore();
const FV = firebase.firestore.FieldValue;
const API_BASE_URL = window.API_BASE_URL || 'https://mpointwallwt-1new.onrender.com';

/* ============================================================
 * AUTH HELPERS
 * ============================================================ */
async function requireAuth() {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      if (!user) {
        const next = encodeURIComponent(location.pathname + location.search);
        location.replace(`login.html?next=${next}`);
        return resolve(null);
      }
      resolve(user);
    });
  });
}

async function getCurrentUser() {
  return auth.currentUser;
}

async function logout() {
  try {
    await auth.signOut();
    location.replace('login.html');
  } catch (e) {
    toast('Logout failed: ' + e.message, 'error');
  }
}

/* ============================================================
 * FIRESTORE USER HELPERS
 * ============================================================ */
async function getUserDoc(uid) {
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists ? { uid, ...doc.data() } : null;
}

async function saveUserDoc(uid, data) {
  await db.collection('users').doc(uid).set(data, { merge: true });
}

async function getWallet(walletId) {
  const doc = await db.collection('wallets').doc(walletId).get();
  return doc.exists ? { walletId: doc.id, ...doc.data() } : null;
}

async function getOwnWalletId() {
  const u = auth.currentUser;
  if (!u) return null;
  const doc = await db.collection('users').doc(u.uid).get();
  if (!doc.exists) return null;
  return doc.data().walletId || null;
}

/* ============================================================
 * ID GENERATOR (client-side)
 * ============================================================ */
function generateWalletId(prefix = 'W-') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = prefix;
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ============================================================
 * FORMATTING
 * ============================================================ */
function fmtPoints(n) {
  const v = Number(n || 0);
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortWallet(id) {
  if (!id) return '';
  if (id.length <= 10) return id;
  return id.slice(0, 6) + '…' + id.slice(-4);
}

/* ============================================================
 * TOAST
 * ============================================================ */
function ensureToastHost() {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:92vw;';
    document.body.appendChild(host);
  }
  return host;
}

function toast(msg, type = 'info', duration = 2800) {
  const host = ensureToastHost();
  const el = document.createElement('div');
  const colors = {
    info: 'bg-slate-700 text-slate-100 border-slate-500',
    success: 'bg-green-600 text-white border-green-400',
    error: 'bg-red-600 text-white border-red-400',
    warn: 'bg-amber-500 text-black border-amber-300',
  };
  el.className = `border px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${colors[type] || colors.info}`;
  el.style.cssText = 'animation:fadeIn 0.2s ease; pointer-events:auto;';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s';
    setTimeout(() => el.remove(), 250);
  }, duration);
  haptic();
}

/* ============================================================
 * HAPTIC
 * ============================================================ */
function haptic(ms = 12) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch {}
  }
}

/* ============================================================
 * MODAL HELPERS
 * ============================================================ */
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('hidden');
  m.classList.add('flex');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('hidden');
  m.classList.remove('flex');
}

/* ============================================================
 * CLIPBOARD
 * ============================================================ */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied!', 'success');
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
    toast('Copied!', 'success');
  }
}

/* ============================================================
 * HMAC (client-side for pay.html verification)
 * ============================================================ */
async function hmacSha256Hex(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
 * SHA-256 (client-side helper for PIN hashing)
 * ============================================================ */
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
 * TP NAMESPACE — TextilePOS compatible walletAPI
 * ============================================================ */
const TP = window.TP || {};
TP.db = db;
TP.auth = auth;
TP.FV = FV;

TP.walletAPI = {
  async getConfig(shopId) {
    const doc = await db.collection('shops').doc(shopId)
      .collection('integrationConfig').doc('p2p').get();
    return doc.exists ? doc.data() : null;
  },

  async saveConfig(shopId, config) {
    await db.collection('shops').doc(shopId)
      .collection('integrationConfig').doc('p2p')
      .set({ ...config, updatedAt: FV.serverTimestamp() }, { merge: true });
  },

  async verifyConnection(shopId, secretCode, backendUrl = API_BASE_URL) {
    const res = await fetch(`${backendUrl}/api/verifyConnection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretCode,
        'x-shop-id': shopId,
      },
    });
    return res.json();
  },

  async debitPoints(shopId, secretCode, backendUrl, { customerWalletId, amount, externalRef, note }) {
    const res = await fetch(`${backendUrl}/api/debitPoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretCode,
        'x-shop-id': shopId,
      },
      body: JSON.stringify({ customerWalletId, amount, externalRef, note }),
    });
    return res.json();
  },

  async creditPoints(shopId, secretCode, backendUrl, { customerWalletId, amount, externalRef, note }) {
    const res = await fetch(`${backendUrl}/api/creditPoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretCode,
        'x-shop-id': shopId,
      },
      body: JSON.stringify({ customerWalletId, amount, externalRef, note }),
    });
    return res.json();
  },

  async createPaymentRequest(shopId, secretCode, backendUrl, { amount, invoiceNo, expiresIn }) {
    const res = await fetch(`${backendUrl}/api/createPaymentRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretCode,
        'x-shop-id': shopId,
      },
      body: JSON.stringify({ amount, invoiceNo, expiresIn }),
    });
    return res.json();
  },

  async getPaymentStatus(shopId, secretCode, backendUrl, requestId) {
    const res = await fetch(
      `${backendUrl}/api/paymentStatus?requestId=${encodeURIComponent(requestId)}`,
      {
        method: 'GET',
        headers: { 'x-api-key': secretCode, 'x-shop-id': shopId },
      }
    );
    return res.json();
  },

  async getBalance(shopId, secretCode, backendUrl, walletId) {
    const res = await fetch(
      `${backendUrl}/api/getBalance?walletId=${encodeURIComponent(walletId)}`,
      {
        method: 'GET',
        headers: { 'x-api-key': secretCode, 'x-shop-id': shopId },
      }
    );
    return res.json();
  },
};

window.TP = TP;

/* ============================================================
 * P2P NAMESPACE — for non-module scripts
 * ============================================================ */
window.P2P = {
  auth, db, FV, API_BASE_URL,
  requireAuth, getCurrentUser, logout,
  getUserDoc, saveUserDoc, getWallet, getOwnWalletId,
  generateWalletId,
  fmtPoints, fmtDate, shortWallet,
  toast, haptic, openModal, closeModal, copyText,
  hmacSha256Hex, sha256Hex,
};

/* ============================================================
 * GLOBAL STYLES
 * ============================================================ */
(function injectGlobalStyles() {
  if (document.getElementById('p2p-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'p2p-global-styles';
  style.textContent = `
    @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
    body { font-family: 'Inter', system-ui, sans-serif; background:#0f172a; color:#f1f5f9; }
    .mono { font-family: 'JetBrains Mono', 'Courier New', monospace; }
    .card { background:#1e293b; border-radius:14px; border:1px solid #334155; }
    .btn-primary { background:#F7931A; color:#0f172a; font-weight:600; }
    .btn-primary:hover { background:#e08315; }
    .btn-primary:disabled { opacity:0.5; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background:#0f172a; }
    ::-webkit-scrollbar-thumb { background:#334155; border-radius: 4px; }
  `;
  document.head.appendChild(style);
})();

/* ============================================================
 * BUILT-IN QR CODE GENERATOR
 * ------------------------------------------------------------
 * Pure JS QR encoder + renderer. No external library needed.
 * - Supports QR Version 1-10, ECC Level M
 * - Byte mode (UTF-8) — supports Bengali, ASCII, etc.
 * - Auto version selection + auto mask selection
 * - Offline-capable
 * ------------------------------------------------------------
 * Usage:
 *   QRGen.renderToCanvas(canvasEl, "text", { size: 240, margin: 4 });
 *   const dataUrl = QRGen.renderToDataURL("text", { size: 480 });
 * ============================================================ */
(function () {
  'use strict';

  // ---------- Galois field for Reed-Solomon ----------
  const EXP = new Array(256);
  const LOG = new Array(256);
  for (let i = 0; i < 8; i++) EXP[i] = 1 << i;
  for (let i = 8; i < 256; i++) EXP[i] = EXP[i - 4] ^ EXP[i - 5] ^ EXP[i - 6] ^ EXP[i - 8];
  for (let i = 0; i < 255; i++) LOG[EXP[i]] = i;

  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  function rsGenPoly(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gmul(poly[j], 1);
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    const gen = rsGenPoly(ecLen);
    const res = new Array(ecLen).fill(0);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      if (factor !== 0) {
        for (let j = 0; j < ecLen; j++) {
          res[j] ^= gmul(gen[j + 1], factor);
        }
      }
    }
    return res;
  }

  // ---------- Version info table (ECC level M) ----------
  // [total codewords, ec/block, g1 blocks, g1 data, g2 blocks, g2 data]
  const VER_M = {
    1:  [26,  10, 1, 16, 0, 0],
    2:  [44,  16, 1, 28, 0, 0],
    3:  [70,  26, 1, 44, 0, 0],
    4:  [100, 18, 2, 32, 0, 0],
    5:  [134, 24, 2, 43, 0, 0],
    6:  [172, 16, 4, 27, 0, 0],
    7:  [196, 18, 4, 31, 0, 0],
    8:  [242, 22, 2, 38, 2, 39],
    9:  [292, 22, 3, 36, 2, 37],
    10: [346, 26, 4, 43, 1, 44],
  };

  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };

  function getVersion(bytesLen) {
    if (bytesLen <= 14)  return 1;
    if (bytesLen <= 26)  return 2;
    if (bytesLen <= 42)  return 3;
    if (bytesLen <= 62)  return 4;
    if (bytesLen <= 84)  return 5;
    if (bytesLen <= 106) return 6;
    if (bytesLen <= 122) return 7;
    if (bytesLen <= 152) return 8;
    if (bytesLen <= 180) return 9;
    if (bytesLen <= 213) return 10;
    throw new Error('QR: data too long (max ~213 bytes)');
  }

  function newMatrix(size) {
    const m = new Array(size);
    for (let i = 0; i < size; i++) m[i] = new Array(size).fill(null);
    return m;
  }

  function setFinder(m, row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
        const isBorder = (r === 0 || r === 6 || c === 0 || c === 6);
        const isCenter = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        m[rr][cc] = (isBorder || isCenter) ? 1 : 0;
      }
    }
  }

  function setAlignment(m, cx, cy) {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBorder = (Math.abs(r) === 2 || Math.abs(c) === 2);
        const isCenter = (r === 0 && c === 0);
        m[cy + r][cx + c] = (isBorder || isCenter) ? 1 : 0;
      }
    }
  }

  function setTiming(m) {
    for (let i = 8; i < m.length - 8; i++) {
      if (m[6][i] === null) m[6][i] = (i % 2 === 0) ? 1 : 0;
      if (m[i][6] === null) m[i][6] = (i % 2 === 0) ? 1 : 0;
    }
  }

  function reserveFormat(m) {
    const n = m.length;
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        if (m[8][i] === null) m[8][i] = 0;
        if (m[i][8] === null) m[i][8] = 0;
      }
    }
    for (let i = 0; i < 8; i++) {
      if (m[8][n - 1 - i] === null) m[8][n - 1 - i] = 0;
      if (m[n - 1 - i][8] === null) m[n - 1 - i][8] = 0;
    }
    m[n - 8][8] = 1;
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r)    => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function formatBits(maskIdx) {
    const data = (0b00 << 3) | maskIdx;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0b10100110111);
    const bits = ((data << 10) | rem) ^ 0b101010000010010;
    return bits & 0x7FFF;
  }

  function placeFormat(m, maskIdx) {
    const n = m.length;
    const bits = formatBits(maskIdx);
    const get = (i) => (bits >> i) & 1;
    for (let i = 0; i <= 5; i++) m[8][i] = get(i);
    m[8][7] = get(6);
    m[8][8] = get(7);
    m[7][8] = get(8);
    for (let i = 9; i <= 14; i++) m[14 - i][8] = get(i);
    for (let i = 0; i <= 7; i++) m[n - 1 - i][8] = get(i);
    for (let i = 8; i <= 14; i++) m[8][n - 15 + i] = get(i);
    m[n - 8][8] = 1;
  }

  function isFunctionCell(r, c, n, aligns) {
    if ((r < 9 && c < 9) || (r < 9 && c > n - 9) || (r > n - 9 && c < 9)) return true;
    if (r === 6 || c === 6) return true;
    for (const ay of aligns) {
      for (const ax of aligns) {
        if ((ax === 6 && ay === 6) || (ax === 6 && ay === n - 7) || (ax === n - 7 && ay === 6)) continue;
        if (Math.abs(r - ay) <= 2 && Math.abs(c - ax) <= 2) return true;
      }
    }
    return false;
  }

  function penalty(mat) {
    let p = 0;
    const n = mat.length;

    for (let r = 0; r < n; r++) {
      let run = 1;
      for (let c = 1; c < n; c++) {
        if (mat[r][c] === mat[r][c - 1]) run++;
        else { if (run >= 5) p += (run - 2); run = 1; }
      }
      if (run >= 5) p += (run - 2);
    }
    for (let c = 0; c < n; c++) {
      let run = 1;
      for (let r = 1; r < n; r++) {
        if (mat[r][c] === mat[r - 1][c]) run++;
        else { if (run >= 5) p += (run - 2); run = 1; }
      }
      if (run >= 5) p += (run - 2);
    }

    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const v = mat[r][c];
        if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) p += 3;
      }
    }

    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n - 10; c++) {
        let m1 = true, m2 = true;
        for (let k = 0; k < 11; k++) {
          if (mat[r][c + k] !== pat1[k]) m1 = false;
          if (mat[r][c + k] !== pat2[k]) m2 = false;
        }
        if (m1) p += 40;
        if (m2) p += 40;
      }
    }
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n - 10; r++) {
        let m1 = true, m2 = true;
        for (let k = 0; k < 11; k++) {
          if (mat[r + k][c] !== pat1[k]) m1 = false;
          if (mat[r + k][c] !== pat2[k]) m2 = false;
        }
        if (m1) p += 40;
        if (m2) p += 40;
      }
    }

    let dark = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mat[r][c]) dark++;
    const ratio = dark / (n * n);
    p += Math.floor(Math.abs(ratio - 0.5) * 20) * 10;

    return p;
  }

  function buildMatrix(text) {
    const bytes = new TextEncoder().encode(text);
    const version = getVersion(bytes.length);
    const info = VER_M[version];
    const [totalCodewords, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] = info;

    const countBits = version <= 9 ? 8 : 16;
    const bits = [];
    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }
    pushBits(0b0100, 4);
    pushBits(bytes.length, countBits);
    for (const b of bytes) pushBits(b, 8);

    const totalDataBits = (g1Blocks * g1Data + g2Blocks * g2Data) * 8;
    const term = Math.min(4, totalDataBits - bits.length);
    for (let i = 0; i < term; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      dataCw.push(v);
    }
    const pads = [0xEC, 0x11];
    let pi = 0;
    while (dataCw.length < g1Blocks * g1Data + g2Blocks * g2Data) {
      dataCw.push(pads[pi++ % 2]);
    }

    const blocks = [];
    let offset = 0;
    for (let i = 0; i < g1Blocks; i++) {
      const d = dataCw.slice(offset, offset + g1Data);
      offset += g1Data;
      blocks.push({ data: d, ec: rsEncode(d, ecPerBlock) });
    }
    for (let i = 0; i < g2Blocks; i++) {
      const d = dataCw.slice(offset, offset + g2Data);
      offset += g2Data;
      blocks.push({ data: d, ec: rsEncode(d, ecPerBlock) });
    }

    const maxDataLen = Math.max(g1Data, g2Data || 0);
    const finalCw = [];
    for (let i = 0; i < maxDataLen; i++) {
      for (const b of blocks) {
        if (i < b.data.length) finalCw.push(b.data[i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (const b of blocks) {
        finalCw.push(b.ec[i]);
      }
    }

    const size = 17 + 4 * version;
    const m = newMatrix(size);
    setFinder(m, 0, 0);
    setFinder(m, 0, size - 7);
    setFinder(m, size - 7, 0);

    const aligns = ALIGN[version];
    for (const ay of aligns) {
      for (const ax of aligns) {
        if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) continue;
        setAlignment(m, ax, ay);
      }
    }

    setTiming(m);
    reserveFormat(m);

    const bitStream = [];
    for (const cw of finalCw) {
      for (let i = 7; i >= 0; i--) bitStream.push((cw >> i) & 1);
    }

    let bitIdx = 0;
    let up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      for (let i = 0; i < size; i++) {
        const row = up ? size - 1 - i : i;
        for (const c of [col, col - 1]) {
          if (m[row][c] === null) {
            m[row][c] = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
          }
        }
      }
      up = !up;
    }

    let best = null;
    let bestScore = Infinity;
    for (let mi = 0; mi < 8; mi++) {
      const copy = m.map((r) => r.slice());
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (isFunctionCell(r, c, size, aligns)) continue;
          if (MASKS[mi](r, c)) copy[r][c] ^= 1;
        }
      }
      placeFormat(copy, mi);
      const score = penalty(copy);
      if (score < bestScore) { bestScore = score; best = copy; }
    }

    return best;
  }

  function renderToCanvas(canvas, text, opts = {}) {
    const size = opts.size || 240;
    const margin = opts.margin != null ? opts.margin : 4;
    const darkColor = opts.darkColor || '#0f172a';
    const lightColor = opts.lightColor || '#ffffff';

    const matrix = buildMatrix(String(text));
    const n = matrix.length;
    const cellSize = Math.floor((size - margin * 2) / n);
    const qrSize = cellSize * n;
    const offset = Math.floor((size - qrSize) / 2);

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = darkColor;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
        }
      }
    }
    return true;
  }

  function renderToDataURL(text, opts = {}) {
    const canvas = document.createElement('canvas');
    renderToCanvas(canvas, text, opts);
    return canvas.toDataURL('image/png');
  }

  window.QRGen = { renderToCanvas, renderToDataURL, buildMatrix };
  console.log('[QRGen] built-in QR generator ready');
})();

/* ============================================================
 * PWA SERVICE WORKER REGISTRATION
 * ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('[SW] registered:', reg.scope))
      .catch((e) => console.warn('[SW] registration failed:', e.message));
  });
}
