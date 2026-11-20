// «Четыре знамени» — друзья (по номеру бойца) и приглашения по ссылке.
// Друг засчитывается, когда сам заработает REF_NEED золота: тогда ему +500, пригласившему +500 (за Premium +2500).

export const REF_NEED = 1000, REF_GIFT = 500, REF_PREM = 2500, FRIENDS_MAX = 100;
export const MILES = [{ n: 3, r: 3000 }, { n: 10, r: 15000 }, { n: 25, r: 50000 }];
export const APP_LINK = 'https://t.me/znameni4_bot/lager';

export function createFriends({ get, set, now = () => Date.now() }) {
  async function ensureNum(s) { // номер бойца — по порядку
    if (s.num) return; const n = ((await get('numctr')) || 0) + 1; await set('numctr', n); await set('num/' + n, s.id); s.num = n;
  }
  return {
    ensureNum,
    // первый вход по ссылке ?startapp=ref_<номер>
    async onFresh(s, startParam, isPrem) {
      const m = /^ref_(\d+)$/.exec(String(startParam || '')); if (!m) return;
      const id = await get('num/' + m[1]); if (!id || id === s.id) return;
      s.ref = id; s.refPrem = !!isPrem; const R = (await get('refs/' + id)) || { inv: [], ok: [] };
      if (!R.inv.includes(s.id)) R.inv.push(s.id); await set('refs/' + id, R);
      s.friends = [id];
    },
    // каждый вход приглашённого: не пора ли засчитать
    async check(s) {
      if (!s.ref || s.refDone || (s.total || 0) < REF_NEED) return null;
      s.refDone = true; s.coins += REF_GIFT;
      const R = (await get('refs/' + s.ref)) || { inv: [], ok: [] }; if (!R.ok.includes(s.id)) R.ok.push(s.id); await set('refs/' + s.ref, R);
      const inv = await get('tg/' + s.ref); if (inv) { const g = s.refPrem ? REF_PREM : REF_GIFT; inv.coins += g; inv.refGold = (inv.refGold || 0) + g; inv.friends = inv.friends || []; if (!inv.friends.includes(s.id)) inv.friends.push(s.id); await set('tg/' + s.ref, inv); }
      const top = (await get('reftop')) || {}; top[s.ref] = R.ok.length; await set('reftop', top);
      return { gift: REF_GIFT };
    },
    async add(s, num) {
      const id = await get('num/' + Math.floor(Number(num))); if (!id) return { err: 'Бойца с таким номером нет.' };
      if (id === s.id) return { err: 'Это твой номер 🙂' }; s.friends = s.friends || [];
      if (s.friends.includes(id)) return { err: 'Он уже в друзьях.' }; if (s.friends.length >= FRIENDS_MAX) return { err: 'Друзей уже 100.' };
      s.friends.push(id); return { ok: true };
    },
    remove(s, id) { s.friends = (s.friends || []).filter(x => x !== id); return { ok: true }; },
    async claim(s, n) {
      const M = MILES.find(x => x.n === Number(n)); if (!M) return { err: 'Нет такой награды.' };
      const R = (await get('refs/' + s.id)) || { inv: [], ok: [] }; s.miles = s.miles || [];
      if (s.miles.includes(M.n)) return { err: 'Награда уже получена.' }; if (R.ok.length < M.n) return { err: `Нужно ${M.n} засчитанных друзей.` };
      s.miles.push(M.n); s.coins += M.r; return { ok: true, r: M.r };
    },
    async view(s, shown, leagueName) {
      await ensureNum(s); const R = (await get('refs/' + s.id)) || { inv: [], ok: [] }, t = now();
      const fr = (await Promise.all((s.friends || []).map(id => get('tg/' + id)))).filter(Boolean)
        .map(f => ({ id: f.id, num: f.num || 0, n: shown(f), fac: f.fac || '', league: leagueName(f), total: Math.floor(f.total || 0), on: t - (f.lastSync || f.created || 0) < 10 * 60e3 }));
      const topMap = (await get('reftop')) || {}, ids = Object.keys(topMap).sort((a, b) => topMap[b] - topMap[a]).slice(0, 10);
      const top = (await Promise.all(ids.map(id => get('tg/' + id)))).map((f, i) => f ? { n: shown(f), c: topMap[ids[i]] } : null).filter(Boolean);
      return { num: s.num, link: APP_LINK + '?startapp=ref_' + s.num, friends: fr, invited: R.inv.length, counted: R.ok.length, refGold: s.refGold || 0,
        miles: MILES.map(M => ({ ...M, got: (s.miles || []).includes(M.n), ready: R.ok.length >= M.n })), top, need: REF_NEED, gift: REF_GIFT, prem: REF_PREM };
    },
  };
}
