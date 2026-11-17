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
];
export const CHEST = 500;
export const LOGIN = [50, 100, 150, 250, 400, 600, 800, 1200, 1600, 2500];

const prevDay = day => new Date(Date.parse(day + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
export const buildCost = (b, lv) => Math.round(b.cost * Math.pow(BUILD_MULT, lv));
export const perHour = s => BUILD.reduce((a, b) => a + b.inc * ((s.bl || {})[b.k] || 0), 0);
export const leagueOf = total => { let i = 0; while (i + 1 < LEAGUES.length && total >= LEAGUES[i + 1].need) i++; return i; };

export function ensure(s, t, day) {
  s.bl = s.bl || {}; if (!s.blAt) s.blAt = t; if (s.league == null) s.league = leagueOf(s.total || 0);
  if (!s.d || s.d.day !== day) s.d = { day, taps: 0, build: 0, ad: 0, got: [], chest: false };
  s.login = s.login || { last: '', n: 0 };
}
// доход построек: копится не дольше 3 часов, пока игрок не заходил
export function accrue(s, t) {
  const from = Math.max(s.blAt || t, t - CAP_HOURS * 3600e3), g = perHour(s) * Math.max(0, t - from) / 3600e3;
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
export function progressView(s, day) {
  const L = s.league, next = LEAGUES[L + 1];
  const canLogin = s.login.last !== day, streak = canLogin ? (s.login.last === prevDay(day) ? s.login.n % LOGIN.length + 1 : 1) : s.login.n;
  return {
    perHour: perHour(s), capHours: CAP_HOURS,
    blds: BUILD.map(b => { const lv = s.bl[b.k] || 0; return { k: b.k, title: b.title, ic: b.ic, lv, inc: b.inc, cost: lv >= BUILD_MAX ? null : buildCost(b, lv), locked: s.league < b.league ? LEAGUES[b.league].name : '', payback: Math.round(buildCost(b, lv) / b.inc) }; }),
    league: { i: L, name: LEAGUES[L].name, next: next ? { name: next.name, need: next.need, prize: next.prize } : null, list: LEAGUES },
    daily: { tasks: TASKS.map((T, i) => ({ t: T.t, n: T.n, p: Math.min(T.n, s.d[T.k] || 0), r: T.r, got: s.d.got.includes(i) })), chest: { r: CHEST, ready: s.d.got.length >= TASKS.length, got: s.d.chest } },
    login: { day: streak, can: canLogin, list: LOGIN },
  };
}
