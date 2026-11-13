// Новое (14.11.2026): обучение новичка, награда за вход, «позови друга», новогодний праздник, питомцы, шахта и подземелье.
// Правила общие для сервера, демо-движка и интерфейса.

// ---------- обучение новичка ----------
// шаги проверяет сервер; цель шага подсвечивает маяк
export const TUT = [
  { id: 'meet', text: 'Подойди к Распорядителю у ворот замка', icon: '👑', x: -2.9, z: 9.7, r: 4.5 },
  { id: 'gather', text: 'Собери ресурс: дерево, траву или руду (подойди и нажми F или кнопку)', icon: '🪵' },
  { id: 'fight', text: 'Победи любого врага за стенами замка', icon: '⚔️' },
  { id: 'market', text: 'Загляни на рынок к востоку от замка', icon: '💰', x: 34.9, z: 3.3, r: 10 },
];
export const TUT_STEP_COINS = 20;
export const TUT_DONE = { coins: 100, xp: 60, items: [['iron_sword', 1], ['potion', 3]] };

// ---------- награда за вход каждый день (серия из 7 дней, пропуск — серия сначала) ----------
export const LOGIN = [
  { day: 1, coins: 30, icon: '🪙' },
  { day: 2, coins: 0, items: [['potion', 2]], icon: '🧪' },
  { day: 3, coins: 60, items: [['wood', 4], ['ore', 3]], icon: '🪵' },
  { day: 4, coins: 0, items: [['potion_power', 1], ['potion_speed', 1]], icon: '⚗️' },
  { day: 5, coins: 120, icon: '💰' },
  { day: 6, coins: 0, items: [['potion_rage', 2]], icon: '🔥' },
  { day: 7, coins: 150, chest: ['steel_sword', 'war_axe', 'elven_bow', 'chainmail', 'steel_helm', 'swift_boots', 'amulet_luck', 'pet_fox'], icon: '🎁' },
];
export const loginReward = streak => LOGIN[(Math.max(1, streak) - 1) % LOGIN.length];
export const prevDay = date => new Date(Date.parse(date + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);

// ---------- позови друга ----------
export const REF = { newCoins: 150, newItems: [['potion', 3]], inviterCoins: 150, horseAt: 3, maxXp: 600, maxInvites: 30 };

// ---------- новогодний праздник: с 1 декабря по 14 января ----------
export function nySeason(now, force = false) {
  if (force) return true;
  const d = new Date(now + 4 * 36e5), m = d.getUTCMonth(), day = d.getUTCDate(); // по Саратову
  return m === 11 || (m === 0 && day <= 14);
}
export const TREE = { x: -6.6, z: 13.6, r: 4 }; // ёлка на площади у ворот
export const GIFTS = [ // подарок под ёлкой раз в день
  { w: 30, coins: 40 }, { w: 20, items: [['potion', 2]] }, { w: 14, coins: 80 }, { w: 10, items: [['potion_power', 1]] },
  { w: 10, items: [['potion_rage', 1]] }, { w: 6, items: [['amulet_luck', 1]] }, { w: 5, items: [['pet_owl', 1]] }, { w: 3, items: [['frost_staff', 1]] }, { w: 2, items: [['pet_wolf', 1]] },
];
export function pickGift(r) { const tot = GIFTS.reduce((s, g) => s + g.w, 0); let x = r * tot; for (const g of GIFTS) { x -= g.w; if (x <= 0) return g; } return GIFTS[0]; }
// Снежный король: по субботам в 20:00 (Саратов), два часа, всё королевство бьёт общее здоровье
export const SNOW = { hour: 20, durationMin: 120, x: -6.6, z: 22 };
export function nextSaturday(now) {
  const loc = new Date(now + 4 * 36e5); const add = (6 - loc.getUTCDay() + 7) % 7;
  let t = Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate() + add, SNOW.hour - 4, 0, 0);
  if (t + SNOW.durationMin * 6e4 <= now) t += 7 * 864e5; return t;
}

// ---------- питомцы ----------
export const PETS = {
  pet_fox: { name: 'Лисёнок', icon: '🦊', price: 2400, color: 0xE07A2E, text: 'Рыжий спутник: +5% монет за победы' },
  pet_owl: { name: 'Сова', icon: '🦉', price: 3900, color: 0x8A6A4A, text: 'Мудрая сова: +5% опыта за победы' },
  pet_wolf: { name: 'Волчонок', icon: '🐺', price: 5400, color: 0x8E949E, text: 'Верный волчонок: +2 к атаке' },
};
export const PET_BONUS = { pet_fox: { coins: 0.05 }, pet_owl: { xp: 0.05 }, pet_wolf: { atk: 2 } };

// ---------- горы и шахта на северо-западе ----------
export const MINE = { x: -46.2, z: -46.2, r: 18, door: { x: -52, z: -54 } };
export const MINE_SPOTS = [[-38, -40], [-41, -52], [-47, -36.5], [-55, -44], [-35.5, -47], [-50.5, -40.5], [-43, -58]];
export const GEM = { name: 'Самоцвет', icon: '💎', sell: 25 };
// подземелье: Горный король — общее здоровье на отряд, раз в день
export const DUNGEON = { needMembers: 2, near: 22, freshMin: 4, hpPer: 500, rewardXp: 400, rewardCoins: 180,
  loot: [['gem', 1], ['gem', 0.6], ['knight_armor', 0.15], ['tower_shield', 0.12], ['frost_staff', 0.08], ['pet_wolf', 0.05]] };

// ---------- внешний вид героя (14.11.2026) ----------
export const LOOKS = {
  cape: { name: 'Плащ', list: {
    red: { name: 'Алый плащ', color: 0xB3202A, price: 900 }, blue: { name: 'Синий плащ', color: 0x2F5A8A, price: 900 }, green: { name: 'Лесной плащ', color: 0x3E7A34, price: 900 },
    purple: { name: 'Королевский пурпур', color: 0x5B2A8B, price: 1500 }, black: { name: 'Плащ тени', color: 0x22202A, price: 1800 }, white: { name: 'Снежный плащ', color: 0xEEF2F6, price: 1800 },
    gold: { name: 'Золотой плащ', color: 0xD9A520, price: 3600, trim: true } } },
  hair: { name: 'Цвет волос', list: {
    black: { name: 'Чёрные', color: 0x1A1210, price: 600 }, blond: { name: 'Светлые', color: 0xE0C98A, price: 600 }, red: { name: 'Рыжие', color: 0xC8501E, price: 720 },
    white: { name: 'Седые', color: 0xE8E8EC, price: 900 }, blue: { name: 'Синие', color: 0x2E6BD8, price: 1800 }, pink: { name: 'Розовые', color: 0xE86AA8, price: 1800 } } },
  hat: { name: 'Головной убор', list: {
    feather: { name: 'Берет с пером', price: 1800 }, wizard: { name: 'Колпак звездочёта', price: 2400 }, viking: { name: 'Рогатый шлем', price: 2700 },
    laurel: { name: 'Лавровый венок', price: 3000 }, santa: { name: 'Новогодний колпак', price: 1200 } } },
  aura: { name: 'Аура', list: {
    gold: { name: 'Золотое сияние', color: 0xFFD23A, price: 7200 }, fire: { name: 'Огненная аура', color: 0xFF6A1A, price: 9000 },
    frost: { name: 'Ледяная аура', color: 0x7FE8FF, price: 9000 }, shadow: { name: 'Аура тени', color: 0x9A5AFF, price: 12000 } } },
};
export const lookKey = l => l ? ['cape', 'hair', 'hat', 'aura'].map(k => l[k] || '').join('.') : '';
export const lookParse = s => { const [cape, hair, hat, aura] = String(s || '').split('.'); return { cape: cape || '', hair: hair || '', hat: hat || '', aura: aura || '' }; };

// ---------- заточка оружия самоцветами ----------
export const ENCH = { max: 10, atk: 2, chance: [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3], dropFrom: 5,
  cost: l => ({ gem: l + 1, coins: 240 * (l + 1) }) };
export const enchColor = l => l >= 10 ? 0xFFD23A : l >= 7 ? 0xB36AFF : l >= 4 ? 0x5AA9FF : 0;

// ---------- война орденов: каждое воскресенье 19:00–20:00 (Саратов), пять флагов ----------
export const OWAR = { hour: 19, durationMin: 60, cd: 20e3, r: 4.5, flagPts: 120, winBonus: 150, partCoins: 40, perPress: 8, partCap: 200, partXp: 6,
  flags: [
    { id: 'market', name: 'Флаг у рынка', x: 29.5, z: 8 },
    { id: 'swamp', name: 'Флаг у болота', x: -140.1, z: 3.3 },
    { id: 'mine', name: 'Флаг у шахты', x: -31, z: -33 },
    { id: 'bridge', name: 'Флаг у моста', x: 4.5, z: 40 },
    { id: 'arena', name: 'Флаг у арены', x: 9.9, z: 58.5 },
  ] };
export function owarWindow(now) { // текущая или ближайшая война
  const loc = new Date(now + 4 * 36e5), add = (7 - loc.getUTCDay()) % 7;
  let start = Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate() + add, OWAR.hour - 4, 0, 0);
  if (start + OWAR.durationMin * 6e4 <= now) start += 7 * 864e5;
  return { start, end: start + OWAR.durationMin * 6e4, id: new Date(start).toISOString().slice(0, 10) };
}
export function owarLast(now) { const w = owarWindow(now); return now >= w.start ? null : { start: w.start - 7 * 864e5, end: w.end - 7 * 864e5, id: new Date(w.start - 7 * 864e5).toISOString().slice(0, 10) }; }
