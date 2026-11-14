// Ордены (семьи): глава собирает воинов и помощников, даёт ордену задания, ордены соревнуются в недельном рейтинге.
// Общие правила для сервера и окна игры.
export const ORDER = {
  maxOrders: 12,           // глав в королевстве — не больше 12
  maxMembers: 30,          // людей в одном ордене
  foundCost: 55000,         // монет, чтобы основать орден
  foundLevel: 8,           // уровень героя, с которого можно стать главой
  donatePts: { wood: 1, herb: 1, ore: 2 },   // очки ордена за сданный ресурс
  winPts: xp => Math.max(1, Math.round(xp / 5)), // очки за победу члена ордена над врагом
  weekPrize: [300, 200, 100],                  // монет каждому в тройке лучших орденов недели (главе — вдвое)
  goalBonus: 150,          // очков ордену за выполненное задание
  goalCoins: 60,           // монет каждому, кто внёс вклад в задание
  goalHours: 24,           // через сколько часов глава может сменить задание
};
export const COLORS = ['#C8102E', '#E8B931', '#4E8A34', '#4A90C8', '#7B3FA0', '#2E2E36', '#FF7A2A', '#F5EBDC'];
export const GOALS = {
  kills: { name: 'Победы над врагами', icon: '⚔️', ns: [20, 50, 100] },
  wood: { name: 'Брёвна в казну ордена', icon: '🪵', ns: [50, 100, 200] },
  herb: { name: 'Травы в казну ордена', icon: '🌿', ns: [50, 100, 200] },
  ore: { name: 'Руда в казну ордена', icon: '🪨', ns: [40, 80, 150] },
};
// уровень ордена растёт от всех очков за всё время; каждый уровень — +2% монет за победы членам ордена (до +20%)
export const orderLevel = pts => Math.min(10, Math.floor(Math.sqrt(Math.max(0, pts) / 120)));
export const levelBonus = lvl => lvl * 0.02;
export const nextLevelPts = lvl => 120 * (lvl + 1) * (lvl + 1);
export const validName = n => typeof n === 'string' && n.trim().length >= 3 && n.trim().length <= 24 && /^[\p{L}\p{N} '\-«»"]+$/u.test(n.trim());
