// «Четыре знамени» — Слава лагерей: знамя-победитель битвы получает голосование «что построить в лагере».
// Голосует любой посетитель сайта (один голос с устройства), итог подводится в начале следующей битвы.
export const UPG = [
  { key: 'brewery', name: 'Пивоварня', icon: '🍺', kind: 'building', dist: 'home', desc: 'Свой эль: вечерами жители пьют пиво у пивоварни', act: ['Пьёт пиво у пивоварни', 'Смеётся с кружкой пива'], share: .06, cap: 6 },
  { key: 'bathhouse', name: 'Баня', icon: '♨️', kind: 'building', dist: 'home', desc: 'Баня с паром: отдых после тренировок', act: ['Парится в бане', 'Отдыхает после бани'], share: .03, cap: 5 },
  { key: 'library', name: 'Библиотека', icon: '📚', kind: 'building', dist: 'culture', desc: 'Книги и карты: жители читают и спорят о тактике', act: ['Читает в библиотеке', 'Спорит о тактике'], share: .03, cap: 4 },
  { key: 'windmill', name: 'Мельница', icon: '🌾', kind: 'building', dist: 'farm', desc: 'Ветряная мельница: свежая мука для лагеря', act: ['Мелет зерно на мельнице'], share: .02, cap: 3 },
  { key: 'garden', name: 'Огород', icon: '🥕', kind: 'building', dist: 'farm', desc: 'Грядки с овощами: жители копают и поливают', act: ['Работает на огороде'], share: .03, cap: 5 },
  { key: 'apiary', name: 'Пасека', icon: '🐝', kind: 'building', dist: 'farm', desc: 'Ульи и мёд к праздникам', act: ['Собирает мёд на пасеке'], share: .015, cap: 3 },
  { key: 'armory', name: 'Оружейная', icon: '🛡', kind: 'building', dist: 'military', desc: 'Стойки с оружием: жители чинят доспехи', act: ['Чинит доспехи в оружейной'], share: .02, cap: 4 },
  { key: 'barracks', name: 'Казарма', icon: '🪖', kind: 'building', dist: 'military', desc: 'Казарма с плацем: больше тренировок', act: ['Тренируется у казармы', 'Стоит в карауле у казармы'], share: .04, cap: 6 },
  { key: 'arena', name: 'Ристалище', icon: '🤺', kind: 'building', dist: 'military', desc: 'Арена для поединков: бойцы меряются силой, толпа болеет', act: ['Бьётся на ристалище', 'Болеет на ристалище'], share: .04, cap: 6 },
  { key: 'watchtower', name: 'Сторожевая башня', icon: '🗼', kind: 'building', dist: 'citadel', desc: 'Высокая башня: дозорные видят врага издалека', act: ['В дозоре у сторожевой башни'], share: .01, cap: 2 },
  { key: 'music_hall', name: 'Дом музыки', icon: '🎵', kind: 'building', dist: 'trade', desc: 'Музыканты играют, жители танцуют', act: ['Играет в доме музыки', 'Танцует у дома музыки'], share: .035, cap: 6 },
  { key: 'shrine', name: 'Святилище героев', icon: '🕯', kind: 'building', dist: 'culture', desc: 'Память о павших: жители приносят цветы', act: ['Чтит павших героев'], share: .015, cap: 3 },
  { key: 'fishpond', name: 'Пруд', icon: '🎣', kind: 'building', dist: 'farm', desc: 'Пруд с рыбой: рыбалка на закате', act: ['Рыбачит у пруда'], share: .02, cap: 4 },
  { key: 'hunters', name: 'Охотничий домик', icon: '🦌', kind: 'building', dist: 'industry', desc: 'Охотники приносят дичь к столу', act: ['Разделывает добычу у охотничьего домика', 'Рассказывает об охоте'], share: .02, cap: 3 },
  { key: 'stone_walls', name: 'Каменные стены', icon: '🧱', kind: 'camp', desc: 'Частокол заменят крепкие каменные стены с зубцами' },
  { key: 'lanterns', name: 'Фонари', icon: '🏮', kind: 'camp', desc: 'Фонари вдоль всех улиц: лагерь светится ночью' },
  { key: 'banners', name: 'Знамёна', icon: '🚩', kind: 'camp', desc: 'Знамёна над площадью и у ворот' },
  { key: 'statue', name: 'Статуя героя', icon: '🗿', kind: 'camp', desc: 'Статуя героя знамени на площади' },
];
export const UPG_BY = Object.fromEntries(UPG.map(u => [u.key, u]));
export const FKEYS = ['lions', 'wolves', 'dragons', 'ravens'];
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const emptyBuilt = () => Object.fromEntries(FKEYS.map(f => [f, []]));

// выбрать 4 постройки, которых у знамени ещё нет
export function pickOptions(built, day) { const left = UPG.filter(u => !built.includes(u.key)).map(u => u.key); let s = hash('glory:' + day) || 1;
  const R = () => (s = Math.imul(s, 1664525) + 1013904223 >>> 0, s / 4294967296); for (let i = left.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0; [left[i], left[j]] = [left[j], left[i]]; } return left.slice(0, 4); }
export function tallyWinner(round) { let best = round.options[0], n = -1; for (const k of round.options) { const c = round.counts[k] || 0; if (c > n) { n = c; best = k; } } return best; }

export function createGlory({ get, set, now, latestBattle, nextAt, battleDays, getBattle, army }) {
  async function load() { const g = (await get('glory')) || {}; g.built = { ...emptyBuilt(), ...(g.built || {}) }; return g; }
  // подвести итог прошлого голосования и открыть новое после свежей битвы
  async function sync(t = now()) {
    const g = await load(), b = await latestBattle(t); let changed = false;
    if (b && b.result && b.result.winner && (!g.round || g.round.day !== b.day) && (!g.seen || g.seen < b.day)) {
      if (g.round && g.round.status === 'open') { const k = tallyWinner(g.round), f = g.round.fac; if (!g.built[f].includes(k)) g.built[f].push(k); g.last = { fac: f, key: k, day: g.round.day, at: b.at }; g.round.status = 'closed'; }
      const f = b.result.winner, opts = pickOptions(g.built[f], b.day);
      g.round = opts.length ? { day: b.day, fac: f, options: opts, counts: {}, opened: b.at, closes: nextAt(b.at + 60000), status: 'open' } : null; g.seen = b.day; changed = true;
    }
    if (changed) await set('glory', g); return g;
  }
  async function standings() {
    const days = (await battleDays()) || [], st = Object.fromEntries(FKEYS.map(f => [f, { wins: 0, battles: 0, streak: 0 }])), wins = [];
    for (const d of days.slice().reverse()) { const b = await getBattle(d); if (!b) continue; const w = b.result.winner; wins.push(w); for (const f of new Set(b.warriors.map(x => x.f))) if (st[f]) st[f].battles++; if (st[w]) st[w].wins++; }
    for (const f of FKEYS) { let s = 0; for (let i = wins.length - 1; i >= 0 && wins[i] === f; i--) s++; st[f].streak = s; }
    return st;
  }
  async function view(voter = '', t = now()) {
    const g = await sync(t), r = g.round, st = await standings(), A = await army();
    const pop = Object.fromEntries(FKEYS.map(f => [f, A.filter(w => w.f === f).length]));
    let mine = null; if (r && voter) { const v = (await get('glory/v/' + r.day)) || {}; mine = v[voter] || null; }
    const rows = FKEYS.map(f => ({ fac: f, ...st[f], upgrades: g.built[f].length, population: pop[f] }));
    let best = null; for (const x of rows) if (x.wins > 0 && (!best || x.wins > best.wins || (x.wins === best.wins && x.streak > best.streak))) best = x;
    return { built: g.built, last: g.last || null, vote: r && r.status === 'open' ? { day: r.day, fac: r.fac, options: r.options, counts: r.counts, opened: r.opened, closes: r.closes, mine } : null, standings: rows, best: best ? best.fac : null };
  }
  async function vote(voter, key, t = now()) {
    voter = String(voter || ''); key = String(key || '');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(voter)) throw Object.assign(new Error('Не удалось проголосовать'), { code: 'bad_voter' });
    const g = await sync(t), r = g.round; if (!r || r.status !== 'open' || t >= r.closes) throw Object.assign(new Error('Голосование уже закончилось'), { code: 'closed' });
    if (!r.options.includes(key)) throw Object.assign(new Error('Такой постройки нет в голосовании'), { code: 'bad_key' });
    const vk = 'glory/v/' + r.day, v = (await get(vk)) || {}; if (v[voter]) throw Object.assign(new Error('Вы уже проголосовали'), { code: 'voted' });
    v[voter] = key; await set(vk, v); r.counts[key] = (r.counts[key] || 0) + 1; await set('glory', g);
    return view(voter, t);
  }
  return { sync, view, vote, load };
}
