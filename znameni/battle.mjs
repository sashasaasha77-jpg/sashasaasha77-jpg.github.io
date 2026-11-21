// «Четыре знамени» — движок битвы. Детерминированный: одинаковые воины + одинаковое зерно = одинаковая битва
// (сервер считает итог, браузер показывает ту же битву).

export const FIELD = { w: 1600, h: 1000 };
export const FACTIONS = {
  lions:   { name: 'Львы',   icon: '🦁', color: '#e8b33a', dark: '#8a5a10', camp: [230, 200],  bonus: 'Сила льва: +10% урона', atk: 1.10, hp: 1, spd: 1, crit: 0 },
  wolves:  { name: 'Волки',  icon: '🐺', color: '#7f9fc4', dark: '#2e4766', camp: [1370, 200], bonus: 'Стая: +10% скорости и +5% здоровья', atk: 1, hp: 1.05, spd: 1.10, crit: 0 },
  dragons: { name: 'Драконы', icon: '🐉', color: '#e0503a', dark: '#7a1a10', camp: [230, 800],  bonus: 'Чешуя: +10% здоровья', atk: 1, hp: 1.10, spd: 1, crit: 0 },
  ravens:  { name: 'Вороны', icon: '🪶', color: '#9a6ad8', dark: '#3a1a66', camp: [1370, 800], bonus: 'Тень: +6% шанс крита', atk: 1, hp: 1, spd: 1, crit: 0.06 },
};
export const ROLES = {
  warrior: { name: 'Воин',   icon: '⚔️', hp: 130, atk: 11, range: 20,  cd: 0.9, spd: 46, armor: 0.10, crit: 0.08 },
  guard:   { name: 'Страж',  icon: '🛡', hp: 230, atk: 6,  range: 18,  cd: 1.1, spd: 36, armor: 0.40, crit: 0.03 },
  mage:    { name: 'Маг',    icon: '🔮', hp: 75,  atk: 10, range: 150, cd: 1.7, spd: 40, armor: 0.00, crit: 0.05, splash: 34 },
  archer:  { name: 'Лучник', icon: '🏹', hp: 85,  atk: 7,  range: 175, cd: 0.8, spd: 44, armor: 0.05, crit: 0.25 },
};
export const FKEYS = Object.keys(FACTIONS), RKEYS = Object.keys(ROLES);
export const levelMult = lv => 1 + 0.06 * Math.min(lv || 0, 100);

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function hashStr(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// warriors: [{ nick, f, r, lv }]
export function createBattle(warriors, seed) {
  const R = rng(seed);
  const units = warriors.map((w, i) => {
    const F = FACTIONS[w.f], ro = ROLES[w.r], m = levelMult(w.lv);
    const [cx, cy] = F.camp, a = R() * Math.PI * 2, d = 20 + R() * 120;
    const hp = Math.round(ro.hp * m * F.hp);
    return { i, nick: w.nick, f: w.f, r: w.r, lv: w.lv || 0, skin: w.skin || '', look: w.look || null, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8,
      hp, maxHp: hp, atk: ro.atk * m * F.atk * (w.attackBonus || 1), range: ro.range, cd: ro.cd, spd: ro.spd * F.spd, armor: ro.armor, crit: ro.crit + F.crit, splash: ro.splash || 0,
      t: R() * ro.cd, target: -1, dead: false, kills: 0, dmg: 0, face: 1 };
  });
  return { units, R, time: 0, events: [], over: false, winner: null, seed, fx: [] };
}

function nearestEnemy(B, u) {
  let best = -1, bd = 1e18;
  for (const v of B.units) { if (v.dead || v.f === u.f) continue; const dx = v.x - u.x, dy = v.y - u.y; let d = dx * dx + dy * dy; if (v.r === 'guard') d *= 0.7; if (d < bd) { bd = d; best = v.i; } }
  return best;
}
function hit(B, u, v, mult = 1) {
  const crit = B.R() < u.crit; let dmg = u.atk * mult * (crit ? 2 : 1) * (1 - v.armor) * (0.85 + B.R() * 0.3);
  dmg = Math.max(1, Math.round(dmg)); v.hp -= dmg; u.dmg += dmg;
  B.events.push({ k: 'hit', a: u.i, b: v.i, d: dmg, c: crit, t: B.time });
  if (v.hp <= 0 && !v.dead) { v.dead = true; v.hp = 0; u.kills++; B.events.push({ k: 'die', a: u.i, b: v.i, t: B.time }); }
}

export function step(B, dt = 0.05) {
  if (B.over) return;
  B.time += dt;
  // в первые секунды армии строятся в лагерях
  const march = B.time > 2;
  for (const u of B.units) {
    if (u.dead) continue;
    if (u.target < 0 || B.units[u.target].dead || B.R() < 0.02) u.target = nearestEnemy(B, u);
    if (u.target < 0) continue;
    const v = B.units[u.target], dx = v.x - u.x, dy = v.y - u.y, d = Math.hypot(dx, dy) || 1;
    u.face = dx >= 0 ? 1 : -1;
    if (d > u.range) { if (march) { const s = u.spd * dt; u.x += dx / d * s; u.y += dy / d * s; } }
    else {
      u.t -= dt;
      if (u.t <= 0) {
        u.t = u.cd * (0.9 + B.R() * 0.2);
        if (u.r === 'mage') { B.events.push({ k: 'bolt', a: u.i, x: v.x, y: v.y, t: B.time }); for (const w of B.units) if (!w.dead && w.f !== u.f && Math.hypot(w.x - v.x, w.y - v.y) < u.splash) hit(B, u, w, w === v ? 1 : 0.6); }
        else if (u.r === 'archer') { B.events.push({ k: 'arrow', a: u.i, b: v.i, t: B.time }); hit(B, u, v); }
        else hit(B, u, v);
      }
    }
  }
  // мягкое расталкивание
  const alive = B.units.filter(u => !u.dead);
  for (let a = 0; a < alive.length; a++) for (let b = a + 1; b < alive.length; b++) {
    const u = alive[a], v = alive[b], dx = v.x - u.x, dy = v.y - u.y, d2 = dx * dx + dy * dy;
    if (d2 < 196 && d2 > 0.01) { const d = Math.sqrt(d2), p = (14 - d) / 2 / d; u.x -= dx * p; u.y -= dy * p; v.x += dx * p; v.y += dy * p; }
  }
  for (const u of alive) { u.x = Math.max(10, Math.min(FIELD.w - 10, u.x)); u.y = Math.max(10, Math.min(FIELD.h - 10, u.y)); }
  const left = new Set(alive.map(u => u.f));
  if (left.size <= 1 || B.time > 240) {
    B.over = true;
    if (left.size === 1) B.winner = [...left][0];
    else { const hp = {}; for (const u of alive) hp[u.f] = (hp[u.f] || 0) + u.hp; B.winner = Object.entries(hp).sort((a, b) => b[1] - a[1])[0]?.[0] || null; }
  }
}

export function aliveBy(B) { const c = Object.fromEntries(FKEYS.map(k => [k, 0])); for (const u of B.units) if (!u.dead) c[u.f]++; return c; }
export function runToEnd(warriors, seed) {
  const B = createBattle(warriors, seed); while (!B.over) step(B);
  const mvp = [...B.units].sort((a, b) => b.kills - a.kills || b.dmg - a.dmg).slice(0, 5).map(u => ({ nick: u.nick, f: u.f, r: u.r, kills: u.kills, dmg: u.dmg }));
  return { winner: B.winner, time: Math.round(B.time), alive: aliveBy(B), mvp };
}
