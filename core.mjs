// Логика экономики «Королевства подписчиков».
// Один и тот же код работает на сервере (Netlify Function + Blobs) и в тестовом режиме в браузере.

export const TZ = 'Europe/Samara';
export const HOUSE = [
  { name: 'Изба', cost: 0 }, { name: 'Дом', cost: 300 }, { name: 'Усадьба', cost: 900 },
  { name: 'Башня', cost: 2400 }, { name: 'Замок', cost: 6000 },
];
export const PROJECTS = [
  { id: 'most', name: 'Каменный мост', goal: 500, about: 'Каменный мост через реку на главной улице.' },
  { id: 'yarmarka', name: 'Ярмарка', goal: 1500, about: 'Шатры и карусель у восточных ворот.' },
  { id: 'melnitsa', name: 'Мельница', goal: 4000, about: 'Мельница на берегу реки.' },
  { id: 'sobor', name: 'Собор', goal: 10000, about: 'Собор за замком, виден со всего королевства.' },
];
export const GAME = { id: 'vorota', dur: 30, maxScore: 160, perCoin: 4, maxCoins: 30, dailyCap: 100 };
export const PIN_TRIES = 5, LOCK_MIN = 15, BOARD = 50;

export const normalize = raw => (raw || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?#].*$/, '').replace(/^@+/, '');
export const validNick = n => /^[a-z0-9._]{1,30}$/.test(n);

export function dayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function weekKey(d = new Date()) { // ISO-неделя по местному времени
  const [y, m, dd] = dayKey(d).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd)); const wd = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - wd + 3);
  const fy = t.getUTCFullYear(), j4 = new Date(Date.UTC(fy, 0, 4));
  const w = 1 + Math.round(((t - j4) / 864e5 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
  return `${fy}-W${String(w).padStart(2, '0')}`;
}
const enc = new TextEncoder();
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', enc.encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const rid = () => [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, '0')).join('');

class Err extends Error { constructor(status, code, msg) { super(msg); this.status = status; this.code = code; } }

// store: { get(key) -> obj|null, set(key, obj), list(prefix) -> [keys] }
// isResident(nick) -> bool; adminKey: строка или '' (админка выключена)
export function createApi({ store, isResident, adminKey = '', now = () => Date.now(), random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 }) {
  const today = () => dayKey(new Date(now())), week = () => weekKey(new Date(now()));

  async function load(nick) { return (await store.get('p/' + nick)) || null; }
  async function save(p) { await store.set('p/' + p.nick, p); }
  function rollWeek(p) { if (p.wk !== week()) { p.wk = week(); p.wkEarned = 0; } }
  function earn(p, n) { p.coins += n; p.earned += n; rollWeek(p); p.wkEarned += n; }
  function me(p) {
    rollWeek(p); const d = today();
    return { nick: p.nick, coins: p.coins, earned: p.earned, level: p.level, house: HOUSE[p.level].name,
      next: HOUSE[p.level + 1] || null, best: p.best, donated: p.donated, wkEarned: p.wkEarned,
      chestToday: p.lastChest === d, gameCoinsToday: p.gDay === d ? p.gCoins : 0 };
  }
  async function auth(nickRaw, pin) {
    const nick = normalize(nickRaw);
    if (!validNick(nick)) throw new Err(400, 'bad_nick', 'Ник в Instagram: латиница, цифры, точка и подчёркивание, до 30 символов.');
    if (!/^\d{4}$/.test(String(pin || ''))) throw new Err(400, 'bad_pin_format', 'PIN — ровно 4 цифры.');
    const p = await load(nick);
    if (!p || !p.pinHash) return { nick, p, fresh: true };
    if (p.lockUntil > now()) throw new Err(423, 'locked', `Слишком много неверных PIN. Попробуй через ${Math.ceil((p.lockUntil - now()) / 60000)} мин.`);
    if (await sha(p.salt + ':' + pin) !== p.pinHash) {
      p.fails = (p.fails || 0) + 1;
      if (p.fails >= PIN_TRIES) { p.fails = 0; p.lockUntil = now() + LOCK_MIN * 60000; }
      await save(p);
      throw new Err(401, 'bad_pin', p.lockUntil > now() ? `Неверный PIN. Вход закрыт на ${LOCK_MIN} мин.` : `Неверный PIN. Осталось попыток: ${PIN_TRIES - p.fails}.`);
    }
    if (p.fails) { p.fails = 0; await save(p); }
    return { nick, p, fresh: false };
  }
  async function need(body) { const a = await auth(body.nick, body.pin); if (!a.p || !a.p.pinHash) throw new Err(401, 'no_account', 'Сначала войди: введи ник и придумай PIN.'); return a.p; }

  // ---------- рейтинги ----------
  const getMany = ks => store.getMany ? store.getMany(ks) : Promise.all(ks.map(k => store.get(k))); // несколько ключей одним запросом
  async function boards(...pre) {
    const lb = (pre.length ? pre[0] : await store.get('lb')) || { earned: [], week: { wk: week(), list: [] }, vorota: [], donated: [], lastWeek: null };
    if (lb.week.wk !== week()) { lb.lastWeek = { wk: lb.week.wk, top: lb.week.list.slice(0, 3) }; lb.week = { wk: week(), list: [] }; }
    return lb;
  }
  function upsert(list, nick, v) { const i = list.findIndex(e => e.nick === nick); if (i >= 0) list.splice(i, 1); if (v > 0) list.push({ nick, v }); list.sort((a, b) => b.v - a.v); list.length = Math.min(list.length, BOARD); }
  async function updateBoards(p) {
    const lb = await boards(); rollWeek(p);
    upsert(lb.earned, p.nick, p.earned); upsert(lb.week.list, p.nick, p.wkEarned); upsert(lb.vorota, p.nick, p.best); upsert(lb.donated, p.nick, p.donated);
    await store.set('lb', lb);
  }
  async function setLevel(p) { const lv = (await store.get('levels')) || {}; if (p.level > 0) lv[p.nick] = p.level; else delete lv[p.nick]; await store.set('levels', lv); }

  // ---------- казна ----------
  async function treasury(...pre) {
    const t = (pre.length ? pre[0] : await store.get('treasury')) || { totals: {}, donors: {} };
    let current = null; const projects = PROJECTS.map(pr => { const raised = Math.min(pr.goal, t.totals[pr.id] || 0); const done = raised >= pr.goal;
      const o = { ...pr, raised, done, donors: (t.donors[pr.id] || []).slice(0, 10) }; if (!done && !current) current = pr.id; return o; });
    return { projects, current };
  }
  async function recount(pid) {
    const keys = await store.list('d/' + pid + '/'); const rows = [];
    const vals = keys.length ? await getMany(keys) : []; keys.forEach((k, i) => { const v = vals[i]; if (v && v.amount > 0) rows.push({ nick: k.split('/').pop(), v: v.amount }); });
    rows.sort((a, b) => b.v - a.v);
    const t = (await store.get('treasury')) || { totals: {}, donors: {} };
    t.totals[pid] = rows.reduce((s, r) => s + r.v, 0); t.donors[pid] = rows.slice(0, 20); await store.set('treasury', t);
  }

  const actions = {
    async state(b) {
      const [lb0, tr0, lv0, dc0, rl0] = await getMany(['lb', 'treasury', 'levels', 'decor', 'roles']);
      const [lb, tr, levels, decor, roles] = [await boards(lb0), await treasury(tr0), lv0 || {}, dc0 || {}, rl0 || {}];
      return { boards: lb, treasury: tr, levels, decor, roles, today: today(), week: week(), config: { HOUSE, GAME } };
    },
    async login(b) {
      const a = await auth(b.nick, b.pin);
      if (a.fresh) {
        if (!(await isResident(a.nick))) throw new Err(403, 'not_resident', `@${a.nick} пока нет в королевстве. Сначала поселись: подпишись на @korol_podpi и оставь ник в комментарии под роликом.`);
        const salt = rid(); const p = a.p || { nick: a.nick, coins: 0, earned: 0, level: 0, best: 0, donated: 0, wk: week(), wkEarned: 0, created: now() };
        p.salt = salt; p.pinHash = await sha(salt + ':' + b.pin); p.fails = 0; p.lockUntil = 0; await save(p);
        return { me: me(p), created: true };
      }
      return { me: me(a.p), created: false };
    },
    async me(b) { return { me: me(await need(b)) }; },
    async chest(b) {
      const p = await need(b); if (p.lastChest === today()) throw new Err(409, 'chest_done', 'Сундук уже открыт сегодня. Новый — завтра.');
      const r = random(); const reward = r < 0.03 ? 150 : r < 0.15 ? 60 : r < 0.45 ? 35 : 15 + Math.floor(random() * 10);
      p.lastChest = today(); earn(p, reward); await save(p); await updateBoards(p);
      return { reward, rare: reward >= 60, me: me(p) };
    },
    async upgrade(b) {
      const p = await need(b); const nx = HOUSE[p.level + 1];
      if (!nx) throw new Err(409, 'max', 'Твой дом уже стал замком. Выше только корона.');
      if (p.coins < nx.cost) throw new Err(402, 'no_coins', `Нужно ${nx.cost} монет, у тебя ${p.coins}.`);
      p.coins -= nx.cost; p.level += 1; await save(p); await setLevel(p);
      return { me: me(p) };
    },
    async donate(b) {
      const p = await need(b); const tr = await treasury();
      if (!tr.current) throw new Err(409, 'all_built', 'Все стройки завершены. Новые появятся скоро.');
      const pr = tr.projects.find(x => x.id === tr.current);
      let amount = Math.floor(Number(b.amount) || 0); if (amount <= 0) throw new Err(400, 'bad_amount', 'Укажи, сколько монет вложить.');
      amount = Math.min(amount, pr.goal - pr.raised);
      if (p.coins < amount) throw new Err(402, 'no_coins', `У тебя ${p.coins} монет.`);
      p.coins -= amount; p.donated += amount; await save(p);
      const key = `d/${pr.id}/${p.nick}`; const d = (await store.get(key)) || { amount: 0 }; d.amount += amount; await store.set(key, d);
      await recount(pr.id); await updateBoards(p);
      return { amount, treasury: await treasury(), me: me(p) };
    },
    async admin(b) {
      if (!adminKey || b.key !== adminKey) throw new Err(403, 'forbidden', 'Неверный ключ администратора.');
      const nick = normalize(b.nick); if (!validNick(nick)) throw new Err(400, 'bad_nick', 'Неверный ник.');
      const p = await load(nick);
      if (b.op === 'info') return { player: p ? me(p) : null };
      if (!p) throw new Err(404, 'no_player', `@${nick} ещё не входил на сайт.`);
      if (b.op === 'coins') { const n = Math.floor(Number(b.amount) || 0); if (!n) throw new Err(400, 'bad_amount', 'Укажи число монет.');
        if (n > 0) earn(p, n); else p.coins = Math.max(0, p.coins + n); await save(p); await updateBoards(p); return { player: me(p) }; }
      if (b.op === 'resetPin') { delete p.pinHash; delete p.salt; p.fails = 0; p.lockUntil = 0; await save(p); return { player: me(p), note: 'PIN сброшен: при следующем входе подданный придумает новый.' }; }
      throw new Err(400, 'bad_op', 'Неизвестная команда.');
    },
  };

  return async function handle(action, body = {}) {
    try {
      if (!actions[action]) throw new Err(404, 'no_action', 'Неизвестное действие.');
      return { status: 200, data: await actions[action](body) };
    } catch (e) {
      if (e instanceof Err) return { status: e.status, data: { error: e.code, message: e.message } };
      return { status: 500, data: { error: 'server', message: 'Ошибка сервера. Попробуй ещё раз.' } };
    }
  };
}
