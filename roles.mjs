// Общие для браузера и сервера: 11 ролей (те же, что в жеребьёвке) и выбор роли по нику.
export const ROLE_W = [['zhitel', 23], ['torgovets', 14], ['kuznets', 13], ['strazhnik', 11], ['luchnik', 10], ['alkhimik', 8], ['rytsar', 8], ['mag', 6], ['sovetnik', 3], ['graf', 3], ['gertsog', 1]];
const TOTAL = ROLE_W.reduce((s, r) => s + r[1], 0);
export function hash(str) { let h = 0x811c9dc5; for (const ch of 'korolevstvo-podpischikov:' + str) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }
export function roleIdFor(nick) { let x = hash(nick) % (TOTAL * 100) / 100, a = 0; for (const [id, w] of ROLE_W) { a += w; if (x < a) return id; } return ROLE_W[0][0]; }
// уровень по опыту: на уровень n нужно 100·n опыта сверх предыдущего
export function levelOf(xp) { let lv = 1, need = 100; while (xp >= need && lv < 80) { xp -= need; lv++; need = 100 * lv; } return { level: lv, into: xp, need }; }
