// «Четыре знамени» — чат (мир / армия / гильдия) и гильдии внутри знамён.
// Работает поверх простого хранилища { get(key), set(key, value) } — и на сервере, и в демо.

export const GUILD_COST = 25000, GUILD_MAX = 30, CHAT_KEEP = 60, CHAT_GAP = 3000, MSG_MAX = 200;
const BAD = ['хуй', 'хуе', 'хуё', 'пизд', 'ебан', 'ебат', 'ебал', 'ёбан', 'бля', 'сука', 'суки', 'мудак', 'мудил', 'пидор', 'пидар', 'гандон', 'шлюх', 'залуп', 'дебил', 'уёб', 'уеб'];
const LINK = /(https?:\/\/|www\.|t\.me\/|telegram\.me|\b[a-z0-9-]+\.(ru|com|net|org|me|io|xyz|su|рф|online|site|app)\b)/i;
export function clean(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MSG_MAX);
  if (!t) return { err: 'Пустое сообщение.' };
  if (LINK.test(t)) return { err: 'Ссылки и реклама в чате запрещены.' };
  t = t.split(' ').map(w => BAD.some(b => w.toLowerCase().replace(/[^а-яёa-z]/g, '').includes(b)) ? '***' : w).join(' ');
  return { text: t };
}
export const weekOf = t => { const d = new Date(t + 4 * 3600e3), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
const gname = s => String(s || '').replace(/\s+/g, ' ').trim();

export function createSocial({ get, set, now = () => Date.now() }) {
  const chKey = (ch, s) => ch === 'world' ? 'chat/world' : ch === 'army' ? (s.fac ? 'chat/f/' + s.fac : null) : ch === 'guild' ? (s.guild ? 'chat/g/' + s.guild : null) : null;
  async function guild(id) { return id ? await get('guild/' + id) : null; }
  async function index() { return (await get('guilds')) || []; }
  const pub = (g, t) => ({ id: g.id, name: g.name, f: g.f, n: g.members.length, max: GUILD_MAX, week: g.wk === weekOf(t) ? Math.floor(g.v) : 0, owner: g.owner });
  return {
    // ---------- чат ----------
    async chatList(s, ch, since = 0) {
      const k = chKey(ch, s); if (!k) return { list: [], need: ch === 'army' ? 'faction' : 'guild' };
      const all = (await get(k)) || []; return { list: all.filter(m => m.id > since) };
    },
    async chatSend(s, ch, text, name) {
      const t = now(), bans = (await get('chatban')) || []; if (bans.includes(s.id)) return { err: 'Ты заблокирован в чате за нарушение правил.' };
      if (s.chatAt && t - s.chatAt < CHAT_GAP) return { err: 'Не так часто — подожди пару секунд.' };
      const k = chKey(ch, s); if (!k) return { err: ch === 'army' ? 'Сначала выбери знамя.' : 'Сначала вступи в гильдию.' };
      const c = clean(text); if (c.err) return c;
      const G = s.guild ? await guild(s.guild) : null;
      const all = (await get(k)) || [], m = { id: t * 100 + Math.floor(Math.random() * 100), uid: s.id, n: name, f: s.fac || '', g: G ? G.name : '', txt: c.text, at: t };
      all.push(m); while (all.length > CHAT_KEEP) all.shift(); await set(k, all); s.chatAt = t; return { ok: true, msg: m };
    },
    async ban(uid) { const b = (await get('chatban')) || []; if (!b.includes(uid)) b.push(uid); await set('chatban', b); return { ok: true, n: b.length }; },
    // ---------- гильдии ----------
    async guildView(s) {
      const t = now(), ids = await index(), all = (await Promise.all(ids.map(guild))).filter(Boolean);
      const mine = s.guild ? all.find(g => g.id === s.guild) : null;
      const top = all.map(g => pub(g, t)).sort((a, b) => b.week - a.week).slice(0, 10);
      const open = s.fac ? all.filter(g => g.f === s.fac && g.members.length < GUILD_MAX && g.id !== s.guild).map(g => pub(g, t)).sort((a, b) => b.n - a.n).slice(0, 20) : [];
      return { mine: mine ? { ...pub(mine, t), me: mine.owner === s.id } : null, open, top, cost: GUILD_COST };
    },
    async guildCreate(s, name) {
      if (!s.fac) return { err: 'Сначала выбери знамя: гильдии живут внутри знамён.' }; if (s.guild) return { err: 'Ты уже в гильдии.' };
      name = gname(name); if (name.length < 3 || name.length > 20) return { err: 'Название — от 3 до 20 символов.' };
      if (LINK.test(name) || clean(name).text !== name) return { err: 'Такое название нельзя.' };
      const ids = await index(), all = (await Promise.all(ids.map(guild))).filter(Boolean);
      if (all.some(g => g.name.toLowerCase() === name.toLowerCase())) return { err: 'Гильдия с таким названием уже есть.' };
      if (s.coins < GUILD_COST) return { err: `Нужно ${GUILD_COST} золота.` };
      const t = now(), id = 'g' + t.toString(36) + Math.floor(Math.random() * 1e3).toString(36);
      await set('guild/' + id, { id, name, f: s.fac, owner: s.id, members: [s.id], created: t, wk: weekOf(t), v: 0 });
      ids.push(id); await set('guilds', ids); s.coins -= GUILD_COST; s.guild = id; return { ok: true };
    },
    async guildJoin(s, id) {
      if (s.guild) return { err: 'Сначала выйди из своей гильдии.' }; const g = await guild(id); if (!g) return { err: 'Гильдия не найдена.' };
      if (g.f !== s.fac) return { err: 'Это гильдия другого знамени.' }; if (g.members.length >= GUILD_MAX) return { err: 'В гильдии нет мест.' };
      g.members.push(s.id); await set('guild/' + id, g); s.guild = id; return { ok: true };
    },
    async guildLeave(s) {
      const g = await guild(s.guild); s.guild = ''; if (!g) return { ok: true };
      g.members = g.members.filter(x => x !== s.id);
      if (!g.members.length) { await set('guild/' + g.id, null); await set('guilds', (await index()).filter(x => x !== g.id)); return { ok: true }; }
      if (g.owner === s.id) g.owner = g.members[0]; await set('guild/' + g.id, g); return { ok: true };
    },
    async guildScore(s, gold) { // золото участника идёт в недельный счёт гильдии
      if (!s.guild || gold <= 0) return; const g = await guild(s.guild); if (!g) { s.guild = ''; return; }
      const wk = weekOf(now()); if (g.wk !== wk) { g.wk = wk; g.v = 0; } g.v += gold; await set('guild/' + g.id, g);
    },
  };
}
