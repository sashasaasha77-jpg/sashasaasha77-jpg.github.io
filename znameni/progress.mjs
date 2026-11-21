// «Четыре знамени» — прогресс в кликере: постройки (доход в час), лиги, задания дня, награда за вход.
// Чистые функции над состоянием игрока s и временем t. Используются сервером и демо-режимом.

export const BUILD = [
  { k: 'tavern', title: 'Таверна', ic: '🍺', inc: 2, cost: 30, league: 0 },
  { k: 'forge', title: 'Кузница', ic: '⚒️', inc: 10, cost: 200, league: 0 },
  { k: 'stable', title: 'Конюшня', ic: '🐎', inc: 45, cost: 1000, league: 1 },
  { k: 'range', title: 'Стрельбище', ic: '🎯', inc: 200, cost: 5000, league: 2 },
  { k: 'barracks', title: 'Казарма', ic: '🛡', inc: 900, cost: 25000, league: 3 },
  { k: 'tower', title: 'Сторожевая башня', ic: '🗼', inc: 5000, cost: 150000, league: 4 },
  { k: 'temple', title: 'Храм войны', ic: '⛩', inc: 30000, cost: 1000000, league: 5 },
];
export const BUILD_MULT = 1.55, BUILD_MAX = 50, CAP_HOURS = 3;
// лиги — по всему золоту за игру; за каждую новую — награда
export const LEAGUES = [
  { need: 0, name: 'Новобранец', prize: 0 }, { need: 2500, name: 'Ополченец', prize: 500 }, { need: 25000, name: 'Солдат', prize: 5000 },
  { need: 250000, name: 'Ветеран', prize: 40000 }, { need: 2500000, name: 'Рыцарь', prize: 300000 }, { need: 25000000, name: 'Легенда', prize: 2500000 },
];
export const TASKS = [
  { k: 'taps', n: 500, r: 200, t: 'Нанеси 500 ударов' },
  { k: 'taps', n: 1000, r: 350, t: 'Нанеси 1 000 ударов' },
  { k: 'build', n: 1, r: 150, t: 'Улучши любую постройку' },
  { k: 'ad', n: 1, r: 150, t: 'Посмотри 1 ролик' },
  { k: 'win', n: 1, r: 200, t: 'Победи в походе' },
];
export const CHEST = 500;
export const LOGIN = [50, 100, 150, 250, 400, 600, 800, 1200, 1600, 2500];

const prevDay = day => new Date(Date.parse(day + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
export const buildCost = (b, lv) => Math.round(b.cost * Math.pow(BUILD_MULT, lv));
export const perHour = s => BUILD.reduce((a, b) => a + b.inc * ((s.bl || {})[b.k] || 0), 0);
export const leagueOf = total => { let i = 0; while (i + 1 < LEAGUES.length && total >= LEAGUES[i + 1].need) i++; return i; };

export function ensure(s, t, day) {
  s.bl = s.bl || {}; if (!s.blAt) s.blAt = t; if (s.league == null) s.league = leagueOf(s.total || 0);
  if (!s.d || s.d.day !== day) s.d = { day, taps: 0, build: 0, ad: 0, win: 0, got: [], chest: false };
  s.login = s.login || { last: '', n: 0 };
}
// доход построек: копится не дольше 3 часов, пока игрок не заходил
export function accrue(s, t) {
  const from = Math.max(s.blAt || t, t - (CAP_HOURS + (s.frontier?.legacy?.talents.camp || 0)) * 3600e3), g = perHour(s) * Math.max(0, t - from) / 3600e3;
  s.blAt = t; if (g > 0) { s.coins += g; s.total += g; } return g;
}
// новые лиги: награда сразу на счёт (в «всего» не идёт, чтобы не перескакивать лиги)
export function leagueUp(s) {
  const got = []; let i = leagueOf(s.total);
  while (s.league < i) { s.league++; const L = LEAGUES[s.league]; s.coins += L.prize; got.push({ name: L.name, prize: L.prize }); }
  return got;
}
export const countTaps = (s, n) => { s.d.taps += n; };
export const countAd = s => { s.d.ad++; };
export function build(s, k) {
  const b = BUILD.find(x => x.k === k); if (!b) return { err: 'Нет такой постройки.' };
  if (s.league < b.league) return { err: `Откроется в лиге «${LEAGUES[b.league].name}».` };
  const lv = s.bl[k] || 0; if (lv >= BUILD_MAX) return { err: 'Уже максимум.' };
  const c = buildCost(b, lv); if (s.coins < c) return { err: `Нужно ${c} золота.` };
  s.coins -= c; s.bl[k] = lv + 1; s.d.build++; return { ok: true };
}
export function claim(s, what, day) {
  if (what === 'login') {
    if (s.login.last === day) return { err: 'Сегодня награда уже получена.' };
    const n = s.login.last === prevDay(day) ? s.login.n % LOGIN.length + 1 : 1, r = LOGIN[n - 1];
    s.login = { last: day, n }; s.coins += r; return { ok: true, r };
  }
  if (what === 'chest') {
    if (s.d.chest) return { err: 'Сундук уже открыт.' };
    if (s.d.got.length < TASKS.length) return { err: 'Сначала выполни все задания дня.' };
    s.d.chest = true; s.coins += CHEST; return { ok: true, r: CHEST };
  }
  const i = Number(String(what).replace('task:', '')), T = TASKS[i];
  if (!T || !Number.isInteger(i)) return { err: 'Нет такого задания.' };
  if (s.d.got.includes(i)) return { err: 'Награда уже получена.' };
  if (s.d[T.k] < T.n) return { err: 'Задание ещё не выполнено.' };
  s.d.got.push(i); s.coins += T.r; return { ok: true, r: T.r };
}
// ---------- скины за рекламу ----------
export const SKIN_LIST = [
  { k: 'diamond', n: 'Алмазный мечник', c: '#7ad8ff', e: '💎' }, { k: 'samurai', n: 'Самурай', c: '#e0503a', e: '⛩' }, { k: 'ninja', n: 'Ниндзя', c: '#3a3a44', e: '🥷' },
  { k: 'viking', n: 'Викинг', c: '#c8742a', e: '🪓' }, { k: 'cossack', n: 'Казак', c: '#3a4a9a', e: '🐎' }, { k: 'tsar', n: 'Царь', c: '#e8b931', e: '👑' },
  { k: 'vampire', n: 'Вампир', c: '#8a1020', e: '🧛' }, { k: 'robot', n: 'Робот', c: '#5a8aa4', e: '🤖' }, { k: 'ogre', n: 'Зелёный огр', c: '#6ab04a', e: '👹' }, { k: 'darklord', n: 'Тёмный лорд', c: '#5a3a9a', e: '😈' },
  { k: 'pharaoh', n: 'Фараон', c: '#e8c04a', e: '🏺' }, { k: 'mummy', n: 'Мумия', c: '#c8bc98', e: '🧟' }, { k: 'zombie', n: 'Зомби', c: '#7a9a4a', e: '🧟‍♂️' },
  { k: 'knight', n: 'Рыцарь', c: '#8ab0e0', e: '🛡' }, { k: 'pumpkin', n: 'Тыквоголовый', c: '#ff8a1a', e: '🎃' }, { k: 'highlander', n: 'Горец', c: '#3aa06a', e: '🗡' },
  { k: 'legionary', n: 'Легионер', c: '#d84030', e: '🏛' }, { k: 'plague', n: 'Чумной доктор', c: '#5a5a66', e: '🐦‍⬛' }, { k: 'farmer', n: 'Фермер', c: '#c8a24a', e: '🌾' },
  { k: 'mageking', n: 'Король магов', c: '#7a6aff', e: '🔮' }];
export const SKIN_ADS = 5, SKIN_ADS_DAY = 15;
export function skinAd(s, k, day) {
  s.skins = s.skins || []; s.skinAds = s.skinAds || {}; if (!s.skAd || s.skAd.day !== day) s.skAd = { day, n: 0 };
  if (!SKIN_LIST.some(x => x.k === k)) return { err: 'Такого скина нет.' };
  if (s.skins.includes(k)) return { err: 'Этот скин уже открыт.' };
  if (s.skAd.n >= SKIN_ADS_DAY) return { err: 'На сегодня реклама за скины закончилась — приходи завтра.' };
  s.skAd.n++; s.skinAds[k] = (s.skinAds[k] || 0) + 1;
  if (s.skinAds[k] >= SKIN_ADS) { s.skins.push(k); s.skin = k; return { ok: true, unlocked: k }; }
  return { ok: true, n: s.skinAds[k] };
}
export function skinSet(s, k) { k = String(k || ''); if (k && !(s.skins || []).includes(k)) return { err: 'Сначала открой этот скин.' }; s.skin = k; return { ok: true }; }
export function progressView(s, day) {
  const L = s.league, next = LEAGUES[L + 1];
  const canLogin = s.login.last !== day, streak = canLogin ? (s.login.last === prevDay(day) ? s.login.n % LOGIN.length + 1 : 1) : s.login.n;
  return {
    skins: s.skins || [], skinAds: s.skinAds || {}, skin: s.skin || '', skinAdsLeft: SKIN_ADS_DAY - (s.skAd && s.skAd.day === day ? s.skAd.n : 0),
    perHour: perHour(s), capHours: CAP_HOURS,
    blds: BUILD.map(b => { const lv = s.bl[b.k] || 0; return { k: b.k, title: b.title, ic: b.ic, lv, inc: b.inc, cost: lv >= BUILD_MAX ? null : buildCost(b, lv), locked: s.league < b.league ? LEAGUES[b.league].name : '', payback: Math.round(buildCost(b, lv) / b.inc) }; }),
    league: { i: L, name: LEAGUES[L].name, next: next ? { name: next.name, need: next.need, prize: next.prize } : null, list: LEAGUES },
    daily: { tasks: TASKS.map((T, i) => ({ t: T.t, n: T.n, p: Math.min(T.n, s.d[T.k] || 0), r: T.r, got: s.d.got.includes(i) })), chest: { r: CHEST, ready: s.d.got.length >= TASKS.length, got: s.d.chest } },
    login: { day: streak, can: canLogin, list: LOGIN },
    camp: campView(s),
  };
}

// ---------- поход: 10 глав по 10 этапов, каждый 10-й — босс ----------
export const PAL = {
  bandit: { cloth: 0x7A2A22, metal: 0x6A5A4A, metalD: 0x3A2E24, trim: 0xA0784A, skin: 0xE0B088, pants: 0x2E2620, boots: 0x3A2A1A, hair: 0x2A1A10 },
  swamp: { cloth: 0x3E5A2A, metal: 0x5A6A4A, metalD: 0x34402A, trim: 0x8A9A4A, skin: 0x9AB07A, pants: 0x2A3020, boots: 0x2A2418, hair: 0x1A2A10 },
  bones: { cloth: 0x3A3A44, metal: 0xD8D4C4, metalD: 0x9A9484, trim: 0x6A6A74, skin: 0xE8E4D4, pants: 0x2A2A30, boots: 0x1A1A20, hair: 0xE8E4D4 },
  ice: { cloth: 0x4A8AC8, metal: 0xCDE6F8, metalD: 0x8AB0CC, trim: 0xFFFFFF, skin: 0xF0D8C8, pants: 0x2A3A5A, boots: 0x3A4A6A, hair: 0xF0F4FF },
  sand: { cloth: 0xC8A060, metal: 0xB89050, metalD: 0x806030, trim: 0xE8C060, skin: 0xC08A60, pants: 0x5A4024, boots: 0x4A3420, hair: 0x2A1A10 },
  fire: { cloth: 0xC83A1A, metal: 0x4A3A3A, metalD: 0x2A2020, trim: 0xFF8A1A, skin: 0xD8906A, pants: 0x2A1A1A, boots: 0x1A1010, hair: 0x2A1010 },
  dead: { cloth: 0x4A3A6A, metal: 0x7A8A8A, metalD: 0x4A5A5A, trim: 0x9AFFC0, skin: 0xA8C0B0, pants: 0x2A2A3A, boots: 0x1A1A2A, hair: 0x3A4A4A },
  sky: { cloth: 0xF0F0FF, metal: 0xE8D27A, metalD: 0xB09A40, trim: 0x7AD0FF, skin: 0xF0D0B0, pants: 0xC8C8E0, boots: 0x8A8AA0, hair: 0xF8E8A0 },
  abyss: { cloth: 0x2A0A2A, metal: 0x5A1A3A, metalD: 0x3A0A20, trim: 0xFF3A8A, skin: 0x8A3A4A, pants: 0x1A0A1A, boots: 0x0A0A0A, hair: 0x0A0A0A },
  black: { cloth: 0x1A1A22, metal: 0x3A3A44, metalD: 0x22222A, trim: 0xC8A040, skin: 0xD8B090, pants: 0x14141A, boots: 0x0A0A0E, hair: 0x101014 },
};
export const CAMP = [
  { name: 'Тёмный лес', p: 'bandit', foes: [['Разбойник', 'warrior'], ['Лесной лучник', 'archer']], boss: ['Атаман шайки', 'guard'], intro: 'Знамёна разорваны, по лесу рыщут разбойники. Начни с них.' },
  { name: 'Гиблые болота', p: 'swamp', foes: [['Болотник', 'warrior'], ['Ведьма-травница', 'mage']], boss: ['Король трясины', 'guard'], intro: 'Туман над болотами скрывает тех, кто украл обрывок знамени.' },
  { name: 'Проклятые курганы', p: 'bones', foes: [['Скелет-воин', 'warrior'], ['Костяной лучник', 'archer']], boss: ['Курганный лорд', 'guard'], intro: 'Мёртвые не любят, когда тревожат их покой.' },
  { name: 'Ледяной перевал', p: 'ice', foes: [['Снежный разбойник', 'guard'], ['Ледяной стрелок', 'archer']], boss: ['Вождь йети', 'warrior'], intro: 'Перевал держат те, кому не страшен мороз.' },
  { name: 'Выжженная пустошь', p: 'sand', foes: [['Кочевник', 'warrior'], ['Пустынный маг', 'mage']], boss: ['Хан пустоши', 'guard'], intro: 'В песках правит хан, и он не делится добычей.' },
  { name: 'Огненные горы', p: 'fire', foes: [['Огненный культист', 'warrior'], ['Пиромант', 'mage']], boss: ['Владыка лавы', 'guard'], intro: 'Культисты раздувают огонь, чтобы сжечь знамя дотла.' },
  { name: 'Мёртвый город', p: 'dead', foes: [['Призрачный страж', 'guard'], ['Некромант', 'mage']], boss: ['Король мёртвых', 'warrior'], intro: 'Город пуст, но в нём не тихо.' },
  { name: 'Небесная крепость', p: 'sky', foes: [['Страж небес', 'guard'], ['Небесный лучник', 'archer']], boss: ['Архонт', 'mage'], intro: 'Крепость в облаках охраняет последний осколок.' },
  { name: 'Бездна', p: 'abyss', foes: [['Демон', 'warrior'], ['Колдун бездны', 'mage']], boss: ['Владыка бездны', 'guard'], intro: 'Отсюда никто не возвращался — до тебя.' },
  { name: 'Трон Четырёх', p: 'black', foes: [['Чёрный рыцарь', 'guard'], ['Чёрный маг', 'mage']], boss: ['Узурпатор', 'warrior'], intro: 'Тот, кто разорвал знамёна, ждёт на троне.' },
];
export const STAGES = CAMP.length * 10, BATTLE_SEC = 30, BATTLE_COST = 50, MAX_TPS = 18;
export function heroStats(s, heroLv = 0) {
  const L = s.lv || { power: 0, energy: 0, regen: 0 };
  const legacy = s.frontier?.legacy;
  const k = (1 + .03 * heroLv) * (1 + .02 * (legacy?.mastery || 0) + .03 * (legacy?.talents.battle || 0) + .05 * (legacy?.seals || 0));
  const dmg = Math.round(8 * Math.pow(1.12, L.power) * k), hp = Math.round((800 * Math.pow(1.1, L.energy) + 60 * L.regen) * k);
  return { dmg, hp, power: Math.round(Math.sqrt(dmg * 7 * hp) / 2) };
}
export function stage(n) {
  const c = Math.floor((n - 1) / 10), i = (n - 1) % 10, C = CAMP[c], boss = i === 9, f = boss ? C.boss : C.foes[i % 2];
  const hp = Math.round(500 * Math.pow(1.08, n - 1) * (boss ? 2 : 1)), dps = Math.round(20 * Math.pow(1.045, n - 1) * (boss ? 1.3 : 1));
  return { n, ch: c, chName: C.name, name: f[0], role: f[1], pal: C.p, boss, hp, dps, power: Math.round(Math.sqrt(hp * dps) / 2),
    gold: Math.round(60 * Math.pow(1.09, n - 1) * (boss ? 3 : 1)) };
}
const campOf = s => (s.camp = s.camp || { max: 0, stars: [] });
export function battleStart(s, n, heroLv, t) {
  const C = campOf(s); n = Math.floor(Number(n)); if (!(n >= 1 && n <= STAGES)) return { err: 'Нет такого этапа.' };
  if (n > C.max + 1) return { err: 'Сначала пройди предыдущие этапы.' };
  const H = heroStats(s, heroLv), St = stage(n); s.bt = { n, at: t, dmg: H.dmg, hp: H.hp, ehp: St.hp, edps: St.dps };
  return { ok: true, battle: { ...St, heroDmg: H.dmg, heroHp: H.hp, sec: BATTLE_SEC } };
}
export function battleFinish(s, taps, ms, t) {
  const b = s.bt; if (!b) return { err: 'Бой не найден.' }; s.bt = null;
  const C = campOf(s), elapsed = t - b.at; ms = Math.max(0, Math.min(Number(ms) || elapsed, elapsed + 1500, BATTLE_SEC * 1000 + 1500));
  const n = Math.max(0, Math.min(Math.floor(Number(taps) || 0), Math.floor(MAX_TPS * ms / 1000) + 10));
  const win = n * b.dmg >= b.ehp && b.edps * ms / 1000 < b.hp && ms <= BATTLE_SEC * 1000 + 1500;
  if (!win) return { ok: true, win: false, n: b.n };
  const stars = ms <= 10000 ? 3 : ms <= 18000 ? 2 : 1, first = b.n > C.max, St = stage(b.n), gold = first ? St.gold : Math.round(St.gold / 4);
  C.max = Math.max(C.max, b.n); C.stars[b.n - 1] = Math.max(C.stars[b.n - 1] || 0, stars); s.coins += gold; s.total += gold; s.d.win = (s.d.win || 0) + 1;
  return { ok: true, win: true, n: b.n, stars, gold, first, sec: Math.round(ms / 100) / 10 };
}
export const campView = s => { const C = campOf(s); return { max: C.max, stars: C.stars, total: C.stars.reduce((a, x) => a + (x || 0), 0) }; };
