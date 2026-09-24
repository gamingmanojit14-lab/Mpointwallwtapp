/**
 * ============================================================
 * common.js — P2P Wallet App
 * - Firebase init (compat SDK, loaded via <script> in HTML)
 * - Auth helpers, Firestore helpers
 * - UI helpers (toast, haptic, formatting, modal)
 * - TP namespace: TP.walletAPI (TextilePOS-compatible helpers)
 * ============================================================
 */

/* ---------- Firebase init ---------- */
if (!firebase.apps.length) {
  firebase.initializeApp(window.FIREBASE_CONFIG);
}
const auth = firebase.auth();
const db = firebase.firestore();
const FV = firebase.firestore.FieldValue;
const API_BASE_URL = window.API_BASE_URL || 'https://mpointwallwt-1.onrender.com';

/* ---------- Auth ---------- */
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

/* ---------- Firestore user helpers ---------- */
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

/**
 * Find walletId from a user's uid (uses users/{uid}.walletId)
 */
async function getOwnWalletId() {
  const u = auth.currentUser;
  if (!u) return null;
  const doc = await db.collection('users').doc(u.uid).get();
  if (!doc.exists) return null;
  return doc.data().walletId || null;
}

/* ---------- ID generator (client-side, uniqueness by Firestore doc id) ---------- */
function generateWalletId(prefix = 'W-') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = prefix;
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ---------- Formatting ---------- */
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

/* ---------- Toast ---------- */
function ensureToastHost() {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:92vw;';
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

/* ---------- Haptic ---------- */
function haptic(ms = 12) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch {}
  }
}

/* ---------- Modal helpers ---------- */
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

/* ---------- Clipboard ---------- */
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

/* ---------- HMAC signature (client-side verify for pay.html) ---------- */
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
 * TP namespace — TextilePOS compatible walletAPI helpers
 * (also usable from within the Wallet App admin panel / api-docs page)
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

/* ---------- Exports for non-module scripts ---------- */
window.P2P = {
  auth, db, FV, API_BASE_URL,
  requireAuth, getCurrentUser, logout,
  getUserDoc, saveUserDoc, getWallet, getOwnWalletId,
  generateWalletId,
  fmtPoints, fmtDate, shortWallet,
  toast, haptic, openModal, closeModal, copyText,
  hmacSha256Hex,
};

/* ---------- Style injection ---------- */
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
