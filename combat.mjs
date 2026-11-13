// Боевая система: характеристики героя, способности 11 ролей, Чёрный Орден, расчёт раунда. Одни правила для сервера и демо.
// Бой пошаговый с перезарядкой по времени: каждое действие героя — один раунд, враг заранее показывает намерение (замах, прицел...).
// Победа зависит от выбора действий (защита от тяжёлого удара, уклонение от выстрела), а не только от уровня.
const R = k => (k + 0.5) * 6.6;
import { riverZ } from './quests.mjs';
const bank = (x, side) => +(riverZ(x) + side * 5.6).toFixed(2); // берег реки: 1 — южный, −1 — северный
// ночь по Москве (21:00–5:00): утопцы выходят из реки
export const isNight = t => { const h = ((t / 36e5 + 3) % 24 + 24) % 24; return h >= 21 || h < 5; };

export const GEAR = {
  lantern: { dodge: 0.05 }, scales: { def: 2 }, hammer: { atk: 4 }, shield: { def: 4 }, bow: { atk: 3, dodge: 0.05 }, satchel: { hp: 15 },
  cloak: { def: 3, hp: 10 }, staff: { atk: 5 }, seal: { atk: 2, def: 2 }, ring: { atk: 3 }, mantle: { def: 4, hp: 15 }, gloves: { atk: 2 }, boots: { dodge: 0.05 },
  star_shard: { atk: 3 }, gate_key: { def: 1 }, ancient_coin: { crit: 0.05 }, forest_charm: { hp: 20 }, caravan_seal: { def: 2 },
  black_blade: { atk: 6 }, ancient_relic: { atk: 2, def: 2, hp: 10 }, order_shield: { def: 6 }, iron_helm: { hp: 25 }, lord_shard: { atk: 5, def: 5 },
  wood_shield: { def: 3 },
  // новое оружие и снаряжение (13.11.2026)
  iron_sword: { atk: 5 }, hunter_bow: { atk: 4, dodge: 0.05 }, oak_staff: { atk: 4, crit: 0.05 }, steel_sword: { atk: 8 }, war_axe: { atk: 10, def: -1, crit: 0.05 },
  elven_bow: { atk: 8, dodge: 0.08 }, frost_staff: { atk: 11, crit: 0.08 }, lich_scythe: { atk: 12, hp: 20 }, dragon_blade: { atk: 15, crit: 0.1 },
  leather_armor: { def: 2, hp: 15 }, chainmail: { def: 5, hp: 20 }, knight_armor: { def: 8, hp: 30 }, dragon_scale: { def: 10, hp: 50 },
  witch_hat: { atk: 4, crit: 0.08, hp: 10 }, steel_helm: { hp: 40, def: 2 }, tower_shield: { def: 9, dodge: -0.03 }, swift_boots: { dodge: 0.1 }, amulet_luck: { crit: 0.1 },
};
// слоты: в каждом слоте в бою работает одна вещь (лучшая), амулетов — до трёх
const SLOT_OF = { hammer: 'weapon', bow: 'weapon', staff: 'weapon', black_blade: 'weapon', iron_sword: 'weapon', hunter_bow: 'weapon', oak_staff: 'weapon', steel_sword: 'weapon', war_axe: 'weapon', elven_bow: 'weapon', frost_staff: 'weapon', lich_scythe: 'weapon', dragon_blade: 'weapon',
  shield: 'shield', wood_shield: 'shield', order_shield: 'shield', tower_shield: 'shield', iron_helm: 'head', steel_helm: 'head', witch_hat: 'head', boots: 'feet', swift_boots: 'feet', gloves: 'hands',
  cloak: 'body', mantle: 'body', leather_armor: 'body', chainmail: 'body', knight_armor: 'body', dragon_scale: 'body' };
export const gearSlot = id => SLOT_OF[id] || 'trinket';
export const gearScore = id => { const g = GEAR[id] || {}; return (g.atk || 0) + (g.def || 0) + (g.hp || 0) / 5 + (g.dodge || 0) * 60 + (g.crit || 0) * 60; };
export function activeGear(equipped) { const by = {}; for (const i of equipped) if (GEAR[i]) (by[gearSlot(i)] = by[gearSlot(i)] || []).push(i);
  return Object.entries(by).flatMap(([sl, l]) => l.sort((a, b) => gearScore(b) - gearScore(a)).slice(0, sl === 'trinket' ? 3 : 1)); }
export const ROLE_STAT = { zhitel: { hp: 20, atk: 2 }, torgovets: { dodge: 0.04, atk: 2 }, kuznets: { atk: 2, def: 1 }, strazhnik: { hp: 25, def: 2 }, luchnik: { dodge: 0.08, atk: 1 },
  alkhimik: { hp: 10, atk: 1 }, rytsar: { def: 2, hp: 10 }, mag: { atk: 3, def: -2 }, sovetnik: { crit: 0.12, atk: 2 }, graf: { atk: 3, def: 1, hp: 10 }, korol: { atk: 3, def: 3, hp: 20 }, gertsog: { atk: 2, def: 2 } };

export function heroStats(role, level, equipped = []) {
  const s = { hp: 80 + 12 * level, atk: 8 + 2 * level, def: 2 + level, dodge: 0.05, crit: 0.05 };
  for (const b of [ROLE_STAT[role] || {}, ...activeGear(equipped).map(i => GEAR[i] || {})]) for (const k in b) s[k] += b[k];
  s.dodge = Math.min(0.45, s.dodge); s.crit = Math.min(0.5, s.crit); return s;
}

// способности ролей (перезарядка в секундах)
export const ABIL = {
  zhitel: { id: 'lantern', name: 'Ослепляющий фонарь', cd: 10, text: 'Удар, и враг промахнётся следующим ударом' },
  torgovets: { id: 'bribe', name: 'Подкуп', cd: 14, text: 'Удар и с шансом 75% враг пропустит два хода' },
  kuznets: { id: 'smash', name: 'Сокрушающий молот', cd: 12, text: 'Урон ×1.8 и броня врага −50% на 3 хода' },
  strazhnik: { id: 'stance', name: 'Стойка стража', cd: 15, text: 'Блок на 2 хода и ответный удар' },
  luchnik: { id: 'aimed', name: 'Меткий выстрел', cd: 10, text: 'Урон ×2.2, нельзя увернуться' },
  alkhimik: { id: 'brew', name: 'Едкий отвар', cd: 15, text: 'Лечит 22% здоровья и обжигает врага' },
  rytsar: { id: 'bash', name: 'Удар щитом', cd: 14, text: 'Удар и оглушение на ход' },
  mag: { id: 'fireball', name: 'Огненный шар', cd: 12, text: 'Урон ×2 сквозь броню' },
  sovetnik: { id: 'counsel', name: 'Мудрый совет', cd: 10, text: 'Защита сейчас и два критических удара' },
  graf: { id: 'warcry', name: 'Клич графа', cd: 18, text: 'Удар и атака +35% на 3 хода' },
  gertsog: { id: 'decree', name: 'Герцогский приказ', cd: 18, text: 'Лечит 20% и атака +25% на 3 хода' },
  korol: { id: 'decree', name: 'Королевская воля', cd: 16, text: 'Лечит 20% и атака +25% на 3 хода' },
};
export const MOVES = { attack: 1.0, defend: 1.0, dodge: 1.0, potion: 6 }; // перезарядка базовых действий, с
export const MIN_GAP = 800; // не чаще одного действия за 0,8 с

// ---------------- Чёрный Орден ----------------
export const KINDS = {
  shadow: { name: 'Тень героя', hp: 100, atk: 10, def: 3, dodge: 0.08, scale: 1, xp: 1, pattern: ['attack'] },
  knight: { name: 'Чёрный рыцарь', hp: 75, atk: 12, def: 3, dodge: 0.05, pattern: ['attack', 'heavy', 'attack'], xp: 1, scale: 1 },
  archer: { name: 'Тёмный лучник', hp: 55, atk: 12, def: 1, dodge: 0.15, pattern: ['aim', 'shot', 'attack'], xp: 1, scale: 1 },
  heavy: { name: 'Тяжёлый рыцарь', hp: 120, atk: 12, def: 7, dodge: 0, pattern: ['wait', 'heavy'], xp: 1.6, scale: 1.25 },
  captain: { name: 'Рыцарь-капитан', hp: 105, atk: 11, def: 5, dodge: 0.08, pattern: ['attack', 'rally', 'heavy', 'attack'], xp: 2, scale: 1.15 },
  lord: { name: 'Тёмный лорд', hp: 200, atk: 12, def: 6, dodge: 0.08, pattern: ['attack', 'dark', 'attack', 'heavy'], xp: 4, scale: 1.45, boss: true },
  commander: { name: 'Главнокомандующий Чёрного Ордена', hp: 480, atk: 19, def: 10, dodge: 0.1, pattern: ['attack', 'heavy', 'dark', 'rally', 'heavy', 'dark'], xp: 8, scale: 1.7, boss: true },
  // существа из камня и болота
  golem: { name: 'Каменный голем', hp: 120, atk: 13, def: 9, dodge: 0, pattern: ['wait', 'slam', 'attack'], xp: 1.8, scale: 1.3, beast: true },
  kikimora: { name: 'Болотная кикимора', hp: 70, atk: 10, def: 2, dodge: 0.18, pattern: ['poison', 'attack', 'attack'], xp: 1.3, scale: 1, beast: true },
  witch: { name: 'Болотная ведьма', hp: 520, atk: 24, def: 8, dodge: 0.12, pattern: ['poison', 'attack', 'drain', 'heavy'], xp: 5, scale: 1.3, beast: true, lab: 2.6 },
  utopets: { name: 'Утопец', hp: 95, atk: 13, def: 3, dodge: 0.1, pattern: ['attack', 'grab', 'attack'], xp: 1.6, scale: 1.05, beast: true },
  skeleton: { name: 'Скелет', hp: 45, atk: 10, def: 1, dodge: 0.05, pattern: ['attack', 'attack', 'heavy'], xp: 0.7, scale: 0.95, beast: true },
  // боссы мировых событий: бьёт всё королевство, общее здоровье
  dragon: { name: 'Огненный дракон', hp: 900, atk: 18, def: 8, dodge: 0.03, pattern: ['attack', 'fire', 'tail', 'attack', 'fire'], xp: 10, scale: 1, boss: true, beast: true, lab: 4.6 },
  lich: { name: 'Лич', hp: 700, atk: 16, def: 6, dodge: 0.08, pattern: ['attack', 'drain', 'dark', 'attack', 'drain'], xp: 9, scale: 1.4, boss: true, beast: true },
  giant: { name: 'Ледяной великан', hp: 1000, atk: 20, def: 10, dodge: 0, pattern: ['wait', 'freeze', 'heavy', 'attack'], xp: 10, scale: 1, boss: true, beast: true, lab: 4.2 },
};
export const INTENT = { attack: 'готовит удар', heavy: 'замахивается для сокрушительного удара! Защищайся!', aim: 'целится… Уклоняйся!', shot: 'стреляет!',
  wait: 'медленно поднимает меч', rally: 'трубит в рог: Орден звереет!', dark: 'собирает тёмную силу! Защищайся!',
  slam: 'поднимает каменные кулаки! Защищайся!', poison: 'плюётся болотным ядом! Уклоняйся!', grab: 'тянет тебя под воду! Защищайся!',
  fire: 'набирает пламя в пасть! Уклоняйся!', tail: 'разворачивается для удара хвостом! Защищайся!', drain: 'вытягивает из тебя жизнь!', freeze: 'дышит ледяным ветром! Защищайся!' };
export const LOOT = { knight: [['potion', 0.4], ['iron_helm', 0.06], ['iron_sword', 0.05]], archer: [['potion', 0.4], ['boots', 0.08], ['hunter_bow', 0.05]], heavy: [['potion', 0.5], ['order_shield', 0.12], ['chainmail', 0.05]],
  captain: [['potion', 0.6], ['black_blade', 0.2], ['knight_armor', 0.05]], lord: [['potion', 1], ['lord_shard', 0.35], ['knight_armor', 0.12]], commander: [['potion', 1], ['lord_shard', 1], ['knight_armor', 0.3]],
  golem: [['ore', 1], ['ore', 0.6], ['ore', 0.3], ['war_axe', 0.04]], kikimora: [['herb', 1], ['mushroom', 0.5], ['potion', 0.3], ['elven_bow', 0.04]], utopets: [['potion', 0.5], ['mushroom', 0.6], ['swift_boots', 0.04]], witch: [['potion', 1], ['mushroom', 1], ['mushroom', 0.6], ['amulet_luck', 0.15], ['frost_staff', 0.06], ['witch_hat', 0.12]], skeleton: [['potion', 0.25], ['amulet_luck', 0.03]],
  dragon: [['potion', 1], ['lord_shard', 1], ['ancient_relic', 0.3], ['dragon_blade', 0.12], ['dragon_scale', 0.1]], lich: [['potion', 1], ['lord_shard', 0.6], ['lich_scythe', 0.2]], giant: [['potion', 1], ['lord_shard', 0.8], ['ore', 1], ['frost_staff', 0.2], ['tower_shield', 0.2]] };

// лагерь Ордена — на севере за городом; патрули ходят туда-обратно по дорогам
export const CAMP = { x: R(0), z: R(-8) - 105.6, r: 12 }; // 14.11.2026: лагерь втрое дальше от королевства
export const ENEMIES = [
  { id: 'n1', kind: 'knight', lvl: 1, path: [[R(0), R(-3) - 105.6], [R(0), R(-5) - 105.6]] },
  { id: 'n2', kind: 'knight', lvl: 2, path: [[R(-2), R(-3) - 105.6], [R(-4), R(-3) - 105.6]] },
  { id: 'n3', kind: 'archer', lvl: 3, path: [[R(2), R(-5) - 105.6]] },
  { id: 'n4', kind: 'archer', lvl: 3, path: [[R(-2), R(-6) - 105.6]] },
  { id: 'n5', kind: 'knight', lvl: 4, path: [[R(-1), R(-7) - 105.6], [R(1), R(-7) - 105.6]] },
  { id: 'n6', kind: 'heavy', lvl: 5, path: [[R(0), R(-6) - 105.6], [R(0), R(-7) - 105.6]], speed: 0.6 },
  { id: 'n7', kind: 'captain', lvl: 6, path: [[R(1), R(-8) - 105.6], [R(1), -57.4 - 105.6]] },
  { id: 'n8', kind: 'heavy', lvl: 6, path: [[R(-1), R(-9) - 105.6]] },
  { id: 'n9', kind: 'lord', lvl: 9, path: [[R(0), -59.4 - 105.6]] },
  { id: 's1', kind: 'knight', lvl: 2, path: [[R(2), R(7)], [R(3), R(7)]] }, // северный берег реки (раньше тропа шла по воде)
  { id: 's2', kind: 'archer', lvl: 2, path: [[R(-3), R(8)]] },
  // за рекой у камней — големы; на берегах — кикиморы; утопцы выходят только ночью
  { id: 'g1', kind: 'golem', lvl: 12, path: [[R(-3), R(11)], [R(-3), R(12)]], speed: 0.5 },
  { id: 'g2', kind: 'golem', lvl: 18, path: [[R(3), R(13)], [R(4), R(13)]], speed: 0.5 },
  { id: 'g3', kind: 'golem', lvl: 24, path: [[R(-6), R(13)]] },
  // Болото к западу от замка (13.11.2026): кикиморы и утопцы живут теперь здесь, а не у реки; в глубине — хижина Болотной ведьмы
  { id: 'k1', kind: 'kikimora', lvl: 9, path: [[-151.1, -2], [-151.1, 8.5]] },
  { id: 'k2', kind: 'kikimora', lvl: 15, path: [[-160.6, -6.5], [-155.1, -8]] },
  { id: 'k3', kind: 'kikimora', lvl: 12, path: [[-163.6, 10.5], [-158.1, 12.5]] },
  { id: 'k4', kind: 'kikimora', lvl: 18, path: [[-168.1, 1.5], [-166.6, 7]] },
  { id: 'u1', kind: 'utopets', lvl: 15, path: [[-156.1, 5.5]] },
  { id: 'u2', kind: 'utopets', lvl: 21, path: [[-163.1, -1.5]] },
  { id: 'u3', kind: 'utopets', lvl: 24, path: [[-171.1, 9.5]] },
  { id: 'w1', kind: 'witch', lvl: 28, path: [[-168.1, -7.5], [-165.6, -5]], speed: 0.4 },
];
export const SWAMP = { x: -158.4, z: 3.3, r: 17 };
export const RESPAWN_MS = { knight: 3 * 60e3, archer: 3 * 60e3, heavy: 5 * 60e3, captain: 8 * 60e3, lord: 30 * 60e3, commander: 60 * 60e3, golem: 5 * 60e3, kikimora: 4 * 60e3, utopets: 6 * 60e3, witch: 20 * 60e3, skeleton: 60e3, dragon: 60e3, lich: 60e3, giant: 60e3 };
export const enemyById = id => ENEMIES.find(e => e.id === id);
export function enemyPos(e, t) {
  if (e.path.length < 2) return { x: e.path[0][0], z: e.path[0][1], face: 0 };
  const [[ax, az], [bx, bz]] = e.path, len = Math.hypot(bx - ax, bz - az), sp = e.speed || 1.1, per = 2 * len / sp + 4;
  let k = ((t / 1000) % per) / per, dir = 1; // туда — пауза — обратно — пауза
  const half = 0.5, pause = 2 / per; let u;
  if (k < pause) u = 0; else if (k < half) u = (k - pause) / (half - pause); else if (k < half + pause) { u = 1; dir = -1; } else { u = 1 - (k - half - pause) / (half - pause); dir = -1; }
  return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, face: Math.atan2((bx - ax) * dir, (bz - az) * dir), moving: (k >= pause && k < half) || k >= half + pause };
}
export function enemyStats(e) { const k = KINDS[e.kind], l = e.lvl - 1, hs = k.boss ? 0.08 : 0.15, as = k.boss ? 0.06 : 0.1; return { name: k.name, hp: Math.round(k.hp * (1 + hs * l)), atk: Math.round(k.atk * (1 + as * l)), def: Math.round(k.def * (1 + 0.08 * l)), dodge: k.dodge, pattern: k.pattern }; }
export function enemyReward(e) { const k = KINDS[e.kind]; return { xp: Math.round(25 * e.lvl * k.xp), coins: Math.round(8 * e.lvl * k.xp) }; }

// ---------------- раунд ----------------
// f — состояние боя; hs — характеристики героя; es — врага; rnd() — случайность (на сервере); возвращает журнал
export function newFight(e, hs, heroHp, now, esOver = null) {
  const es = esOver || enemyStats(e); return { enemy: e.id, kind: e.kind, lvl: e.lvl, eHp: es.hp, eMax: es.hp, hHp: Math.max(1, Math.min(hs.hp, heroHp)), hMax: hs.hp, idx: 0, round: 0, buffs: {}, cds: {}, last: now, rally: 0, next: es.pattern[0], ...(esOver ? { es: esOver } : {}) };
}
export function resolveRound(f, move, role, hs, rnd, now) {
  const es = f.es || enemyStats({ kind: f.kind, lvl: f.lvl }), log = [], b = f.buffs, ab = ABIL[role];
  const dec = k => { if (b[k]) b[k]--; };
  const hit = (mult, opts = {}) => {
    if (b.frozen) { b.frozen = 0; mult *= 0.5; log.push('Руки замёрзли — удар слабее.'); }
    const eDef = opts.pierce ? 0 : es.def * (b.eDefDown ? 0.5 : 1), atk = hs.atk * (1 + (b.atkUp ? b.atkUpV : 0));
    if (!opts.sure && rnd() < es.dodge) { log.push(`${es.name} уклонился!`); return 0; }
    let d = Math.max(1, Math.round(atk * mult * (0.9 + rnd() * 0.2) - eDef));
    if (b.crit > 0 || rnd() < hs.crit) { d = Math.round(d * 1.8); if (b.crit > 0) b.crit--; log.push('Критический удар!'); }
    f.eHp = Math.max(0, f.eHp - d); log.push(`Ты наносишь ${d} урона.`); return d;
  };
  const heal = pct => { const h = Math.round(f.hMax * pct); f.hHp = Math.min(f.hMax, f.hHp + h); log.push(`Ты восстанавливаешь ${h} здоровья.`); };
  let defend = 0, dodge = 0;
  // --- ход героя ---
  if (move === 'attack') hit(1);
  else if (move === 'defend') { defend = 1; log.push('Ты поднимаешь щит.'); }
  else if (move === 'dodge') { dodge = 0.45; log.push('Ты готовишься уклониться.'); }
  else if (move === 'potion') heal(0.4);
  else if (ab && move === ab.id) {
    const id = ab.id; log.push(`«${ab.name}»!`);
    if (id === 'lantern') { hit(1); b.blind = 1; }
    else if (id === 'bribe') { hit(0.8, { sure: true }); if (rnd() < 0.75) { b.skip = 2; log.push(`${es.name} задумался о золоте…`); } else log.push('Подкуп не сработал.'); }
    else if (id === 'smash') { hit(1.8); b.eDefDown = 3; }
    else if (id === 'stance') { b.guard = 2; defend = 1; hit(0.8, { sure: true }); }
    else if (id === 'aimed') hit(2.2, { sure: true });
    else if (id === 'brew') { heal(0.22); hit(0.7, { pierce: true, sure: true }); }
    else if (id === 'bash') { hit(1); b.stun = 1; }
    else if (id === 'fireball') hit(2, { pierce: true, sure: true });
    else if (id === 'counsel') { b.crit = 2; defend = 1; }
    else if (id === 'warcry') { b.atkUp = 3; b.atkUpV = 0.35; hit(1); }
    else if (id === 'decree') { heal(0.2); b.atkUp = 3; b.atkUpV = 0.25; }
  }
  if (b.guard && move !== 'stance') { defend = 1; dec('guard'); } else if (move === 'stance') dec('guard');
  // --- ход врага ---
  if (f.eHp > 0) {
    const intent = es.pattern[f.idx % es.pattern.length];
    const atk = es.atk * (1 + 0.25 * f.rally);
    const take = (mult, { block = 0.35, canDodge = true, armor = true } = {}) => {
      if (b.blind) { b.blind = 0; log.push(`${es.name} промахнулся вслепую!`); return 0; }
      if (canDodge && rnd() < hs.dodge + dodge) { log.push('Ты увернулся!'); return 0; }
      let d = Math.max(1, Math.round(atk * mult * (0.9 + rnd() * 0.2) - (armor ? hs.def : 0)));
      if (defend) d = Math.max(1, Math.round(d * block));
      f.hHp = Math.max(0, f.hHp - d); log.push(`${es.name} наносит тебе ${d} урона.`); return d;
    };
    const eHeal = v => { if (v > 0) { f.eHp = Math.min(f.eMax, f.eHp + v); log.push(`${es.name} восстанавливает ${v} здоровья.`); } };
    if (b.stun) { b.stun = 0; log.push(`${es.name} оглушён и пропускает ход.`); }
    else if (b.skip) { b.skip--; log.push(`${es.name} пропускает ход.`); }
    else if (intent === 'attack') take(1);
    else if (intent === 'heavy') take(1.9, { block: 0.2 });
    else if (intent === 'aim') log.push(`${es.name} целится.`);
    else if (intent === 'shot') take(1.6, { block: 0.5, canDodge: true });
    else if (intent === 'wait') log.push(`${es.name} медлит.`);
    else if (intent === 'rally') { f.rally = Math.min(2, f.rally + 1); log.push(`${es.name} трубит в рог: враг сильнее!`); }
    else if (intent === 'dark') take(1.5, { block: 0.5, canDodge: false, armor: false });
    else if (intent === 'slam') take(1.8, { block: 0.25 });
    else if (intent === 'poison') { if (take(0.6, { block: 0.6 }) > 0) { b.poison = 3; log.push('Ты отравлен!'); } }
    else if (intent === 'grab') eHeal(Math.round(take(1.3, { block: 0.5 }) * 0.5));
    else if (intent === 'fire') take(1.7, { block: 0.6, armor: false });
    else if (intent === 'tail') take(1.9, { block: 0.2 });
    else if (intent === 'drain') eHeal(take(1.2, { canDodge: false }));
    else if (intent === 'freeze') { if (take(1.4, { block: 0.3 }) > 0) b.frozen = 1; }
    f.idx++;
  }
  if (b.poison > 0 && f.hHp > 0) { const d = Math.max(1, Math.round(f.hMax * 0.05)); f.hHp = Math.max(0, f.hHp - d); b.poison--; log.push(`Яд жжёт: −${d}.`); }
  dec('eDefDown'); if (b.atkUp) { b.atkUp--; if (!b.atkUp) b.atkUpV = 0; }
  f.round++; f.last = now; f.next = es.pattern[f.idx % es.pattern.length];
  return log;
}
export function cooldownLeft(f, move, role, now) {
  const ab = ABIL[role], cd = move === ab?.id ? ab.cd : MOVES[move]; if (cd == null) return null;
  return Math.max(0, (f.cds[move] || 0) + cd * 1000 - now);
}

// ---------------- арена: бой с тенью другого героя ----------------
// Тень повторяет характеристики героя (уровень, роль, снаряжение, оружие) и дерётся по манере своей роли.
export const DUEL_PAT = {
  luchnik: ['aim', 'shot', 'attack', 'aim', 'shot', 'attack'], mag: ['attack', 'fire', 'attack', 'aim', 'shot', 'fire'], alkhimik: ['poison', 'attack', 'attack', 'heavy', 'poison', 'attack'],
  strazhnik: ['attack', 'wait', 'heavy', 'attack', 'attack', 'heavy'], rytsar: ['attack', 'heavy', 'attack', 'wait', 'heavy', 'attack'], kuznets: ['attack', 'attack', 'heavy', 'attack', 'slam'],
  torgovets: ['attack', 'aim', 'shot', 'attack', 'wait', 'heavy'], zhitel: ['attack', 'attack', 'wait', 'heavy', 'attack'], sovetnik: ['aim', 'shot', 'attack', 'heavy', 'attack'],
  graf: ['attack', 'heavy', 'attack', 'aim', 'heavy', 'attack'], gertsog: ['attack', 'heavy', 'aim', 'attack', 'heavy'], korol: ['attack', 'heavy', 'aim', 'attack', 'fire', 'heavy'],
};
export const ARENA_RULES = { perDay: 15, samePerDay: 3, paidWins: 5, start: 1000, k: 32 };
export function duelStats(nick, role, level, hs) { return { name: `Тень @${nick}`, hp: hs.hp, atk: hs.atk, def: hs.def, dodge: Math.min(0.3, hs.dodge), pattern: DUEL_PAT[role] || DUEL_PAT.zhitel, role, nick }; }
export function duelReward(oppLvl) { return { xp: 12 * oppLvl, coins: 10 + 4 * oppLvl }; }
export const elo = (ra, rb, win, k = ARENA_RULES.k) => Math.round(k * ((win ? 1 : 0) - 1 / (1 + 10 ** ((rb - ra) / 400))));
export const DUEL_INTENT = { fire: 'колдует огненный шар! Уклоняйся!', slam: 'заносит тяжёлый молот! Защищайся!', poison: 'швыряет склянку с ядом! Уклоняйся!', wait: 'выжидает и следит за тобой', heavy: 'замахивается со всей силы! Защищайся!' };

// ---------------- Горы и шахта, подземелье, Снежный король, питомцы (14.11.2026) ----------------
Object.assign(KINDS, {
  troll: { name: 'Горный тролль', hp: 150, atk: 16, def: 8, dodge: 0.03, pattern: ['attack', 'slam', 'wait', 'attack'], xp: 2, scale: 1.25, beast: true },
  mountain_king: { name: 'Горный король', hp: 420, atk: 24, def: 12, dodge: 0, pattern: ['wait', 'slam', 'attack', 'heavy', 'attack'], xp: 4, scale: 1.9, beast: true, lab: 4.4, dungeon: true },
  snowking: { name: 'Снежный король', hp: 1000, atk: 22, def: 10, dodge: 0.02, pattern: ['wait', 'freeze', 'heavy', 'attack', 'attack'], xp: 10, scale: 1.15, boss: true, beast: true, lab: 4.6 },
});
Object.assign(LOOT, {
  troll: [['ore', 1], ['gem', 0.35], ['chainmail', 0.03], ['war_axe', 0.03]],
  mountain_king: [['gem', 1]],
  snowking: [['potion', 1], ['lord_shard', 0.8], ['frost_staff', 0.1], ['pet_wolf', 0.06], ['amulet_luck', 0.2]],
});
Object.assign(RESPAWN_MS, { troll: 5 * 60e3, mountain_king: 60e3, snowking: 60e3 });
ENEMIES.push(
  { id: 't1', kind: 'troll', lvl: 16, path: [[-36.5, -38], [-39, -44]], speed: 0.45 },
  { id: 't2', kind: 'troll', lvl: 20, path: [[-44, -35], [-49, -37]], speed: 0.45 },
  { id: 't3', kind: 'troll', lvl: 24, path: [[-58, -48], [-56, -42]], speed: 0.4 },
  { id: 't4', kind: 'troll', lvl: 30, path: [[-40, -56], [-46, -58]], speed: 0.4 },
  { id: 'mk', kind: 'mountain_king', lvl: 22, path: [[-50.5, -51.5]], dungeon: true },
);
Object.assign(SLOT_OF, { pet_fox: 'pet', pet_owl: 'pet', pet_wolf: 'pet' });
Object.assign(GEAR, { pet_fox: {}, pet_owl: {}, pet_wolf: { atk: 2 } });
