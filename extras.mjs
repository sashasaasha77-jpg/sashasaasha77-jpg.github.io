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
  pet_dragon: { name: 'Драконье яйцо', icon: '🥚', price: 18000, color: 0xE0602E, text: 'Дракон растёт с каждой победой: малыш → юный → взрослый' },
};
// ---------- растущий дракон ----------
export const DRAGON = [
  { at: 0, name: 'Дракончик-малыш', icon: '🐉', bonus: { coins: 0.03, xp: 0.03, atk: 1 } },
  { at: 25, name: 'Юный дракон', icon: '🐲', bonus: { coins: 0.06, xp: 0.06, atk: 3 } },
  { at: 100, name: 'Взрослый дракон', icon: '🐲', bonus: { coins: 0.10, xp: 0.10, atk: 6 } },
];
export const dragonStage = n => (n || 0) >= DRAGON[2].at ? 3 : (n || 0) >= DRAGON[1].at ? 2 : 1;
export const petShow = (id, drg) => id === 'pet_dragon' ? 'pet_dragon' + dragonStage(drg) : id;
export const PET_BONUS = { pet_fox: { coins: 0.05 }, pet_owl: { xp: 0.05 }, pet_wolf: { atk: 2 } };

// ---------- горы и шахта на северо-западе ----------
export const MINE = { x: -138.6, z: -138.6, r: 18, door: { x: -144.4, z: -146.4 } };
export const MINE_SPOTS = [[-130.4, -132.4], [-133.4, -144.4], [-139.4, -128.9], [-147.4, -136.4], [-127.9, -139.4], [-142.9, -132.9], [-135.4, -150.4]];
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
    { id: 'mine', name: 'Флаг у шахты', x: -123.4, z: -125.4 },
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

// ---------- замок ордена (14.11.2026): у каждого ордена свой участок, замок строят всем орденом ----------
export const OCASTLE = {
  spots: [[13, 99.2], [38.2, 92.4], [60.8, 79.4], [79.3, 60.9], [99.1, 13.1], [99.2, -13], [92.4, -38.2], [79.4, -60.8], [61, -79.3], [38.4, -92.4], [13.2, -99.1], [-13, -99.2]],
  r: 9, // радиус участка: здесь сдают ресурсы
  levels: [ // что нужно, чтобы поднять замок с уровня i на i+1
    { name: 'Лагерь', need: { wood: 300, ore: 150 } },
    { name: 'Деревянный форт', need: { wood: 700, ore: 500, gem: 10 } },
    { name: 'Каменная крепость', need: { wood: 1400, ore: 1200, gem: 30 } },
    { name: 'Замок с башнями', need: { wood: 2800, ore: 2500, gem: 70 } },
    { name: 'Великая цитадель', need: { wood: 5000, ore: 4500, gem: 140 } },
  ],
  names: ['Пустой участок', 'Лагерь', 'Деревянный форт', 'Каменная крепость', 'Замок с башнями', 'Великая цитадель'],
  bonus: lvl => lvl * 0.03, // +3% опыта и монет за каждый уровень всем членам ордена
};

// ---------- охота за сокровищами: каждый день новая загадка, копать можно где угодно ----------
export const HUNT = { cd: 15e3, digR: 3, firstItems: ['frost_staff', 'dragon_blade', 'knight_armor', 'amulet_luck', 'pet_owl', 'tower_shield'], firstCoins: 300, nextCoins: 100, nextGem: 1, maxFinders: 10,
  spots: [
    { x: -6.6, z: 9.4, hint: 'Где вода поёт день и ночь, а монетки лежат на дне — копай рядом с тем, что журчит у ворот.' },
    { x: -166.5, z: -12.5, hint: 'Там, где ведьма варит зелье, под самым порогом её избушки.' },
    { x: -146.4, z: -139.6, hint: 'Где вагонетка устала возить руду, у самого входа в гору.' },
    { x: 4.2, z: 63.4, hint: 'Где соломенный воин принимает удары, но никогда не падает.' },
    { x: 45.4, z: 6.4, hint: 'Где купцы пьют воду между торгами — у колодца посреди рынка.' },
    { x: -3, z: 38.2, hint: 'Перед переправой через реку, там, где путники отдыхают у моста.' },
    { x: -0.5, z: -145.6, hint: 'У южных ворот лагеря Чёрного Ордена, возле их катапульты. Осторожно!' },
    { x: -125.6, z: -125.6, hint: 'У дорожного указателя, что ведёт к горам и шахте.' },
    { x: -141.4, z: 6.8, hint: 'Где начинаются мостки в болото, у столба с черепом.' },
    { x: 33, z: 11.5, hint: 'У дороги к рынку, под флагом, за который бьются ордена.' },
    { x: 1.8, z: -15.2, hint: 'За стенами замка, у таверны, что строит всё королевство.' },
    { x: 15.7, z: 75.2, hint: 'За ареной, там, где тюки сена ждут коней.' },
  ] };
export const huntSpot = date => { let h = 0; for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUNT.spots[h % HUNT.spots.length]; };
export const huntHeat = d => d <= HUNT.digR ? 'found' : d < 10 ? 'Очень горячо! 🔥 Сокровище совсем рядом.' : d < 25 ? 'Тепло… ты на верном пути.' : d < 60 ? 'Прохладно. Сокровище не здесь.' : 'Холодно! ❄️ Совсем не там.';
