// Демо-режим RPG: те же правила (rpg-engine.mjs), но база хранится в этом браузере. Ничего не уходит на сервер.
// memSb — маленькая имитация PostgREST (её же использует локальный тест сервера).
import { rpgAction } from './rpg-engine.mjs';

const KEYS = { world_config: ['key'], territories: ['id'], event_contrib: ['event_id', 'nick'], heroes: ['nick'], inventory: ['nick', 'item'], quests: ['nick', 'quest_id', 'period'], achievements: ['nick', 'ach_id'], reward_log: ['nick', 'key'], squad_members: ['nick'], squad_quests: ['squad_id', 'quest_id', 'period'] };
const SERIAL = ['quests', 'chronicle', 'squad_invites', 'squad_quests', 'chat', 'fights', 'world_events'];
const DEF = { heroes: () => ({ level: 1, xp: 0, hp: 100, x: null, z: null, face: 0, stats: {}, updated_at: new Date().toISOString() }), inventory: () => ({ qty: 1, equipped: false }),
  quests: () => ({ status: 'active', progress: {} }), reward_log: () => ({ gold: 0, xp: 0, items: [] }), squads: () => ({ id: (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2)), max_size: 5, created_at: new Date().toISOString() }),
  squad_members: () => ({ joined_at: new Date().toISOString() }), squad_invites: () => ({ status: 'pending', created_at: new Date().toISOString() }),
  squad_quests: () => ({ status: 'active', stage: 0, progress: {}, contrib: {}, updated_at: new Date().toISOString() }), world_events: () => ({ updated_at: new Date().toISOString(), data: {}, progress: 0 }), event_contrib: () => ({ points: 0, data: {} }), territories: () => ({ updated_at: new Date().toISOString() }), chronicle: () => ({ at: new Date().toISOString() }), chat: () => ({ at: new Date().toISOString() }), fights: () => ({ started_at: new Date().toISOString() }) };
export const emptyDb = () => ({ t: { world_config: [], world_events: [], event_contrib: [], territories: [], heroes: [], inventory: [], quests: [], achievements: [], reward_log: [], chronicle: [], fights: [], squads: [], squad_members: [], squad_invites: [], squad_quests: [], chat: [] }, ids: {}, blobs: {} });
function match(row, k, v) {
  const [op, ...rest] = v.split('.'); const val = rest.join('.');
  if (op === 'eq') return String(row[k]) === val; if (op === 'neq') return String(row[k]) !== val; if (op === 'lt') return String(row[k]) < val; if (op === 'gt') return String(row[k]) > val;
  if (op === 'in') return val.slice(1, -1).split(',').map(decodeURIComponent).map(v => v.replace(/^"(.*)"$/, '$1')).includes(String(row[k]));
  if (op === 'like') return new RegExp('^' + val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(String(row[k]));
  return false;
}
function filt(rows, params) {
  let out = rows.filter(r => { for (const [k, v] of params) { if (['select', 'order', 'limit'].includes(k)) continue;
    if (k === 'or') { if (!v.slice(1, -1).split(',').some(p => { const [c, ...x] = p.split('.'); return match(r, c, x.join('.')); })) return false; continue; }
    if (!match(r, k, v)) return false; } return true; });
  const ord = params.find(p => p[0] === 'order'); if (ord) { const [c, dir] = ord[1].split('.'); out = out.slice().sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (dir === 'desc' ? -1 : 1)); }
  const lim = params.find(p => p[0] === 'limit'); if (lim) out = out.slice(0, +lim[1]);
  return out;
}
export function memSb(db, persist = () => { }) {
  return async function sb(path, { method = 'GET', body, prefer = '' } = {}) {
    const u = new URL('http://x/' + path), table = u.pathname.slice(1), params = [...u.searchParams];
    const rows = db.t[table] || (db.t[table] = []);
    const copy = x => JSON.parse(JSON.stringify(x));
    if (method === 'GET') return copy(filt(rows, params));
    if (method === 'PATCH') { const hit = filt(rows, params); hit.forEach(r => Object.assign(r, copy(body))); persist(); return prefer.includes('return=representation') ? copy(hit) : null; }
    if (method === 'DELETE') { const hit = new Set(filt(rows, params)); db.t[table] = rows.filter(r => !hit.has(r)); persist(); return null; }
    const out = [];
    for (const b of Array.isArray(body) ? body : [body]) { const row = { ...(DEF[table] ? DEF[table]() : {}), ...copy(b) };
      if (SERIAL.includes(table)) row.id = db.ids[table] = (db.ids[table] || 0) + 1;
      const key = KEYS[table]; const dup = key && rows.find(r => key.every(k => r[k] === row[k])); if (dup) { if (prefer.includes('merge-duplicates')) { Object.assign(dup, row); out.push(dup); continue; } if (prefer.includes('ignore-duplicates')) continue; throw Object.assign(new Error('dup'), { status: 409 }); }
      rows.push(row); out.push(row); }
    persist(); return prefer.includes('return=representation') ? copy(out) : null;
  };
}
export function memStore(db, persist = () => { }) { return { get: async k => db.blobs[k] ? JSON.parse(JSON.stringify(db.blobs[k])) : null, set: async (k, v) => { db.blobs[k] = v; persist(); } }; }

// ---------- демо в браузере ----------
const LS = 'kp-rpg-demo2';
let db = null, sb, store;
function boot() {
  if (db) return; try { db = JSON.parse(localStorage.getItem(LS)); } catch { } db = db || emptyDb();
  const flush = () => { pend = false; try { localStorage.setItem(LS, JSON.stringify(db)); } catch { } };
  let pend = false; const persist = () => { if (!pend) { pend = true; setTimeout(flush, 250); } }; // одно сохранение на действие, а не на каждую запись
  addEventListener('pagehide', () => { if (pend) flush(); });
  sb = memSb(db, persist); store = memStore(db, persist);
}
export async function localCall(nick, action, b = {}, admin = false) {
  boot(); if (!db.blobs['p/' + nick]) await store.set('p/' + nick, { nick, coins: 0, earned: 0, wkEarned: 0 });
  return rpgAction({ action, b, nick, resident: { nick }, sb, store, demo: true, admin });
}
export function localChronicle() { boot(); return db.t.chronicle.slice(-50); }
export function resetDemo() { localStorage.removeItem(LS); location.reload(); }
