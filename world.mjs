// Мир королевства: вторжения Чёрного Ордена, осада замка, территории, мировые события. Общие правила для сервера и демо.
import { POI, NPC, riverZ } from './quests.mjs';
const R = k => (k + 0.5) * 6.6;

// настройки по умолчанию (король меняет их в панели управления)
export const DEFAULT_CONFIG = {
  invasion: { enabled: true, everyDays: 4, hour: 19, warnHours: 3, durationMin: 60, difficulty: 1 },
  events: { enabled: true, everyDays: 3, durationHours: 12 },
  firstInvasionHours: 48,
};
export function mergeConfig(c) { const d = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); if (!c) return d; for (const k of Object.keys(d)) d[k] = typeof d[k] === 'object' ? { ...d[k], ...(c[k] || {}) } : (c[k] ?? d[k]); return d; }

// территории: порядок захвата при поражениях (замок не захватывается никогда)
export const TERR = {
  sever: { name: 'Северная дорога', x: R(0), z: R(-4), order: 1 },
  les: { name: 'Королевский лес', x: R(0), z: riverZ(R(0)) + 9, order: 2 },
  melnitsa: { name: 'Мельница у реки', x: R(3), z: R(4), order: 3 },
  most: { name: 'Речной мост', x: 0, z: riverZ(0) - 5.2, order: 4, effect: 'Мост перекрыт баррикадой' },
  yarmarka: { name: 'Ярмарка', x: R(1), z: R(0), order: 5, effect: 'Цены в лавке +20%' },
  ploshchad: { name: 'Западная площадь', x: R(-2), z: R(1), order: 6 },
};
export const CAPTURE_ORDER = Object.keys(TERR).sort((a, b) => TERR[a].order - TERR[b].order);

// ---------------- осада ----------------
export const SIEGE = {
  machines: {
    ram: { name: 'Таран у ворот', x: 4.3, z: 9.9, hp: 100 },
    tower: { name: 'Осадная башня у северной стены', x: 0, z: -9.6, hp: 120 },
    cat_w: { name: 'Западная катапульта', x: -9.9, z: -9.9, hp: 80 },
    cat_e: { name: 'Восточная катапульта', x: 9.9, z: -9.9, hp: 80 },
  },
  hospital: { name: 'Лазарет у фонтана', x: -4.8, z: 9.9 },
  wall: { name: 'Пролом в северной стене', x: -4.4, z: -8.6 },
  gate: { name: 'Ворота замка', x: 0, z: 10.0 },
  depot: { name: 'Склад у торговца', x: NPC.torgovets.x, z: NPC.torgovets.z },
  scout: ['far_ne', 'far_nw', 'far_se', 'far_sw'],
};
// задачи обороны: любая роль может всё, у некоторых ролей бонус
export const TASKS = {
  fight: { name: 'Сражаться с захватчиками', text: 'Побеждай рыцарей Ордена у стен замка', mult: { rytsar: 1.3, strazhnik: 1.2, graf: 1.2, gertsog: 1.2 } },
  gate: { name: 'Защищать ворота', text: 'Стой у ворот 20 секунд', sec: 20, base: 6, mult: { strazhnik: 1.5, rytsar: 1.5 } },
  repair: { name: 'Чинить укрепления', text: 'Принеси брёвна или руду к пролому в стене', base: 5, mult: { kuznets: 1.5, zhitel: 1.3 } },
  sabotage: { name: 'Ломать осадную технику', text: 'Работай у тарана, башни или катапульты 15 секунд', sec: 15, dmg: 20, mult: { mag: 1.5, luchnik: 1.5, kuznets: 1.3 } },
  heal: { name: 'Лечить союзников', text: 'Работай в лазарете у фонтана 15 секунд', sec: 15, base: 5, mult: { alkhimik: 2, mag: 1.3, zhitel: 1.2 } },
  supply: { name: 'Доставлять припасы', text: 'Возьми ящик у торговца и отнеси к воротам', base: 8, mult: { torgovets: 1.5, graf: 1.2 } },
  scout: { name: 'Разведка', text: 'Осмотри все четыре окраины', base: 6, mult: { luchnik: 2, graf: 1.3 } },
};
// сложность подстраивается под население, чтобы маленькое королевство не проигрывало всегда
export function invasionGoal(difficulty, activeHeroes, lostStreak = 0) {
  const people = Math.max(1, activeHeroes);
  return Math.round(150 * difficulty * Math.min(people, 40) ** 0.85 * Math.max(0.5, 1 - 0.2 * lostStreak));
}
// враги вторжения стоят вокруг площади замка; уровень — по среднему уровню защитников
export function invasionEnemies(ev) {
  const lvl = Math.max(1, Math.min(12, ev.data?.lvl || 3)), out = [];
  const spots = [[-9.9, 3.3, 'knight'], [9.9, -3.3, 'knight'], [-9.9, -6.6, 'archer'], [9.9, 6.6, 'archer'], [4.4, -8.6, 'heavy'], [-8.3, 8.8, 'knight'], [7.4, 8.8, 'captain']];
  spots.forEach(([x, z, kind], i) => out.push({ id: `ev${ev.id}_${i}`, kind, lvl: lvl + (kind === 'heavy' || kind === 'captain' ? 1 : 0), path: [[x, z]], event: ev.id }));
  if ((ev.data?.machinesDown || 0) >= 4) out.push({ id: `ev${ev.id}_boss`, kind: 'commander', lvl: lvl + 3, path: [[-2.4, 9.9]], event: ev.id });
  return out;
}
// оккупанты захваченной территории
export function occupiers(tid, captures) { const t = TERR[tid]; return [0, 1].map(i => ({ id: `oc_${tid}_${i}`, kind: i ? 'archer' : 'knight', lvl: 2 + captures + i, path: [[t.x + (i ? 2.5 : -2.5), t.z + (i ? 1.5 : -1.5)]], terr: tid })); }

// ---------------- мировые события ----------------
export const WORLD_EVENTS = {
  caravan: { name: 'Прибытие королевского каравана', text: 'Караван привёз товары: в лавке скидка 30%, торговец платит за ресурсы на 30% больше.' },
  artifact: { name: 'Поиск древнего артефакта', text: 'Маг почуял древний артефакт где-то на окраинах. Первые пятеро нашедших получат реликвию.' },
  dragon: { name: 'Нападение дракона', text: 'Огненный дракон сел у замка! Бейте его всем королевством: каждый удар отнимает у дракона общее здоровье.', boss: 'dragon' },
  lich: { name: 'Восстание лича', text: 'Лич, некромант Чёрного Ордена, поднял скелетов на Северной дороге. Каждый удар по личу и каждый поверженный скелет приближают победу.', boss: 'lich' },
  giant: { name: 'Ледяной великан', text: 'С гор спустился ледяной великан и встал у главного моста. Его общее здоровье — на всё королевство.', boss: 'giant' },
  snowking: { name: 'Снежный король', text: 'Снежный король пришёл за новогодними подарками! Бейте его всем королевством у ёлки на площади: общее здоровье на всех.', boss: 'snowking', seasonal: true },
  raid: { name: 'Нападение на торговый путь', text: 'Разбойники Ордена грабят южную дорогу. Победы над ними приносят двойные монеты, а общая цель — 15 побед.' },
};
// боссы мировых событий: общее здоровье (goal) делится на всё королевство, каждый бьёт свою копию
export const BOSS_SPOT = { dragon: [R(0), R(2)], lich: [R(0), R(-4)], giant: [0, riverZ(0) - 7], snowking: [-6.6, 22] };
export const isBossEvent = kind => !!WORLD_EVENTS[kind]?.boss;
export function bossGoal(kind, activeHeroes, difficulty = 1) { return Math.round({ dragon: 1200, lich: 1000, giant: 1400, snowking: 1300 }[kind] * difficulty * Math.max(1, Math.min(activeHeroes, 60)) ** 0.6); }
export function bossEnemies(ev) {
  const kind = WORLD_EVENTS[ev.kind].boss, lvl = Math.max(3, Math.min(20, ev.data?.lvl || 5)) * 3, [x, z] = BOSS_SPOT[kind]; // боссы и их свита — уровень ×3
  const out = [{ id: `bs${ev.id}`, kind, lvl: lvl + 6, path: [[x, z]], event: ev.id }];
  if (kind === 'lich') [[-1, -3], [1, -3], [-1, -5], [1, -5]].forEach(([i, j], k) => out.push({ id: `bs${ev.id}_s${k}`, kind: 'skeleton', lvl, path: [[R(i), R(j)]], event: ev.id }));
  return out;
}
export const RAIDERS = ev => [[R(1), R(9)], [R(-2), R(9)], [R(3), R(9)]].map(([x, z], i) => ({ id: `rd${ev.id}_${i}`, kind: i === 2 ? 'archer' : 'knight', lvl: Math.max(2, (ev.data?.lvl || 3)), path: [[x, z]], event: ev.id, raid: true }));
export const TITLES = ['Щит короля', 'Герой обороны', 'Защитник королевства'];
