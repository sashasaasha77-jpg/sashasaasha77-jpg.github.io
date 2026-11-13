// Правила RPG: одна и та же логика работает на сервере (Netlify + Supabase) и в демо-режиме (в браузере, без базы).
// sb(path, opts) — PostgREST-подобный доступ к таблицам; store — хранилище монет (Netlify Blobs или его замена).
import { dayKey, weekKey, normalize } from './core.mjs';
import { roleIdFor, levelOf } from './roles.mjs';
import { censor } from './censor.mjs';
import { questsFor, applySpec, nodesFor, NPC, POI, ITEMS, SPEC, ACH, SQUAD, SQUADQ, SHOP, RES, RECIPES, BUFFS, WEAPON, BUILDS, FORT, DECOR, dailyOrder, slotOf, ROLE_PRICE, CHOP, ARENA, MARKET, MARKET_STALLS, marketPrices, RESPAWN_MS as NODE_RESPAWN } from './quests.mjs';
import { heroStats, ABIL, MOVES, MIN_GAP, KINDS, LOOT, ENEMIES, RESPAWN_MS, enemyById, enemyPos, enemyReward, newFight, resolveRound, cooldownLeft, isNight, GEAR, duelStats, duelReward, elo, ARENA_RULES } from './combat.mjs';
import { mergeConfig, TERR, CAPTURE_ORDER, SIEGE, TASKS, invasionGoal, invasionEnemies, occupiers, WORLD_EVENTS, RAIDERS, TITLES, isBossEvent, bossGoal, bossEnemies } from './world.mjs';

export class Bad extends Error { constructor(status, code, msg) { super(msg); this.status = status; this.code = code; } }
const enc = encodeURIComponent;
const json = (status, data) => ({ status, data });
const near = (x, z, t, r = 3.2) => Math.hypot(x - t.x, z - t.z) <= r;

export async function rpgAction({ action, b, nick, resident, sb, store, now: nowMs, demo = false, admin = false }) {
  const N = enc(nick), now = nowMs ?? Date.now(), date = dayKey(new Date(now));
  // одинаковые чтения внутри одного действия идут в базу один раз; запись в таблицу сбрасывает её кэш
  { const raw = sb, gc = new Map();
    sb = (path, o = {}) => { const m = o.method || 'GET', table = path.split('?')[0];
      if (m === 'GET') { if (!gc.has(path)) gc.set(path, raw(path, o).catch(e => { gc.delete(path); throw e; })); return gc.get(path).then(r => r == null ? r : JSON.parse(JSON.stringify(r))); }
      for (const k of [...gc.keys()]) if (k.split('?')[0] === table) gc.delete(k);
      return raw(path, o); }; }

  // ---------- общие помощники ----------
  async function hero() {
    let [h] = await sb(`heroes?nick=eq.${N}&select=*`);
    if (!h) {
      const role = resident.king && resident.role ? resident.role : roleIdFor(normalize(resident.orig || nick)); // у аккаунта королевства своя роль
      await sb('heroes', { method: 'POST', body: { nick, role }, prefer: 'resolution=ignore-duplicates' });
      [h] = await sb(`heroes?nick=eq.${N}&select=*`);
      await sb('chronicle', { method: 'POST', body: { type: 'hero', nick, text: `@${nick} получил героя и впервые вышел из дома.` } });
    }
    if (resident.king && resident.role && h.role !== resident.role) { await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { role: resident.role } }); h.role = resident.role; } // корона важнее случайной роли
    return h;
  }
  const coinsOf = async () => ((await store.get('p/' + nick)) || {}).coins || 0;
  async function addCoins(n, who = nick) {
    if (!n) return; const p = await store.get('p/' + who); if (!p) return;
    const wk = weekKey(new Date(now)); if (p.wk !== wk) { p.wk = wk; p.wkEarned = 0; }
    p.coins += n; p.earned += n; p.wkEarned += n; await store.set('p/' + who, p);
  }
  async function inv() { return await sb(`inventory?nick=eq.${N}&select=item,qty,equipped`); }
  async function setItem(item, delta, who = nick) {
    const W = enc(who), [row] = await sb(`inventory?nick=eq.${W}&item=eq.${enc(item)}&select=qty`);
    const qty = Math.max(0, (row ? row.qty : 0) + delta);
    if (row) await sb(`inventory?nick=eq.${W}&item=eq.${enc(item)}`, { method: 'PATCH', body: { qty, updated_at: new Date().toISOString() } });
    else if (qty > 0) await sb('inventory', { method: 'POST', body: { nick: who, item, qty } });
  }
  // ---------- мир: вторжения, территории, события (мир сам продвигается при каждом обращении) ----------
  const ISO = t => new Date(t).toISOString(), POI_OF = k => POI[k];
  async function cfgGet(key) { const [r] = await sb(`world_config?key=eq.${key}&select=value`); return r ? r.value : null; }
  async function cfgSet(key, value) { const [r] = await sb(`world_config?key=eq.${key}&select=key`); if (r) await sb(`world_config?key=eq.${key}`, { method: 'PATCH', body: { value } }); else await sb('world_config', { method: 'POST', body: { key, value }, prefer: 'resolution=merge-duplicates' }); }
  const chron = (type, text, who = null) => sb('chronicle', { method: 'POST', body: { type, nick: who, text, at: ISO(now) } });
  async function evUpdate(id, mutate) {
    for (let i = 0; i < 5; i++) { const [cur] = await sb(`world_events?id=eq.${id}&select=*`); if (!cur) return null; const next = mutate(JSON.parse(JSON.stringify(cur))); if (!next) return cur;
      const r = await sb(`world_events?id=eq.${id}&updated_at=eq.${enc(cur.updated_at)}`, { method: 'PATCH', body: { status: next.status, progress: next.progress, goal: next.goal, data: next.data, updated_at: ISO(now + i + 1) }, prefer: 'return=representation' });
      if (r && r.length) return r[0]; }
    throw new Bad(409, 'busy', 'Королевство занято. Попробуй ещё раз.');
  }
  async function territories() {
    let t = await sb('territories?select=*');
    const missing = Object.keys(TERR).filter(id => !t.some(x => x.id === id));
    for (const id of missing) await sb('territories', { method: 'POST', body: { id, name: TERR[id].name, owner: 'kingdom', control: 100 }, prefer: 'resolution=ignore-duplicates' });
    if (missing.length) t = await sb('territories?select=*'); return t;
  }
  async function activeHeroCount() { return (await sb(`heroes?updated_at=gt.${enc(ISO(now - 7 * 864e5))}&select=nick`)).length; }
  async function avgLevel() { const hs = await sb(`heroes?updated_at=gt.${enc(ISO(now - 7 * 864e5))}&select=xp`); const lv = hs.map(h => levelOf(h.xp).level).filter(l => l <= 60); if (!lv.length) return 3; return Math.round(lv.reduce((s, l) => s + l, 0) / lv.length); } // сверхуровни (король) не задирают силу врагов
  function nextSlot(cfg, after) { const d = new Date(after + cfg.invasion.everyDays * 864e5); const day = dayKey(d); return Date.parse(`${day}T${String(cfg.invasion.hour).padStart(2, '0')}:00:00+04:00`); }
  async function payout(ev, won) {
    const rows = (await sb(`event_contrib?event_id=eq.${ev.id}&select=nick,points`)).filter(r => r.points > 0).sort((a, b) => b.points - a.points);
    for (const [i, r] of rows.entries()) {
      const k = won ? 1 : 0.5, xp = Math.round(Math.min(500, 30 + r.points * 2) * k), coins = Math.round(Math.min(250, 15 + r.points) * k);
      const ins = await sb('reward_log', { method: 'POST', body: { nick: r.nick, key: `ev:${ev.id}`, gold: coins, xp }, prefer: 'resolution=ignore-duplicates,return=representation' });
      if (!ins || !ins.length) continue;
      const [hh] = await sb(`heroes?nick=eq.${enc(r.nick)}&select=xp`); if (hh) await sb(`heroes?nick=eq.${enc(r.nick)}`, { method: 'PATCH', body: { xp: hh.xp + xp, ...(won && ev.kind === 'invasion' && i < 3 ? { title: TITLES[i] } : {}) } });
      await addCoins(coins, r.nick);
      const what = ev.kind === 'invasion' ? (won ? 'Вторжение отбито!' : 'Вторжение проиграно, но твоя помощь засчитана.') : isBossEvent(ev.kind) ? (won ? `${KINDS[WORLD_EVENTS[ev.kind].boss].name} повержен всем королевством!` : `${KINDS[WORLD_EVENTS[ev.kind].boss].name} ушёл, но твой урон засчитан.`) : `Событие «${WORLD_EVENTS[ev.kind]?.name || ev.kind}» завершилось.`;
      await inboxAdd(r.nick, { t: 'reward', text: `${what} Твоя награда: +${xp} опыта, +${coins} монет${won && ev.kind === 'invasion' && i < 3 ? `, титул «${TITLES[i]}»` : ''}.`, xp, coins, at: now });
    }
    return rows;
  }
  // личные оповещения (награда за событие приходит и тем, кого сейчас нет в игре)
  async function inboxAdd(who, m) { const k = 'inbox/' + who, a = (await store.get(k)) || []; a.push(m); await store.set(k, a.slice(-10)); }
  async function inboxTake() { const k = 'inbox/' + nick, a = await store.get(k); if (!a || !a.length) return []; await store.set(k, []); return a; }
  async function closeEvent(ev, result) {
    const done = await evUpdate(ev.id, c => ['active', 'warning'].includes(c.status) ? (c.status = result, c) : null); if (!done || done.status !== result) return;
    const rows = await payout(ev, result === 'won');
    if (ev.kind === 'invasion') {
      const terr = await territories(), captured = terr.filter(t => t.owner === 'order');
      if (result === 'won') {
        const free = captured.sort((a, b) => TERR[b.id].order - TERR[a.id].order)[0];
        if (free) await sb(`territories?id=eq.${free.id}`, { method: 'PATCH', body: { owner: 'kingdom', control: 100, updated_at: ISO(now) } });
        await cfgSet('lost_streak', { n: 0 });
        await chron('war_win', `ПОБЕДА! Королевство отбило вторжение Чёрного Ордена.${free ? ` Освобождена территория «${TERR[free.id].name}».` : ''}${rows.length ? ` Лучшие защитники: ${rows.slice(0, 3).map((r, i) => `@${r.nick} — «${TITLES[i]}»`).join(', ')}.` : ''}`);
      } else {
        const next = CAPTURE_ORDER.find(id => terr.find(t => t.id === id)?.owner !== 'order');
        if (next) await sb(`territories?id=eq.${next}`, { method: 'PATCH', body: { owner: 'order', control: 0, updated_at: ISO(now) } });
        const ls = (await cfgGet('lost_streak'))?.n || 0; await cfgSet('lost_streak', { n: ls + 1 });
        const castle = (await cfgGet('castle')) || { damage: 0 }; await cfgSet('castle', { damage: Math.min(100, castle.damage + 60) });
        await chron('war_lost', `ПОРАЖЕНИЕ. Чёрный Орден прорвался к замку и повредил стены.${next ? ` Захвачена территория «${TERR[next].name}» — её можно освободить в бою.` : ''} Следующее вторжение будет легче.`);
      }
    } else if (isBossEvent(ev.kind)) await chron(result === 'won' ? 'boss_win' : 'event_end', result === 'won'
      ? `ПОБЕДА! ${KINDS[WORLD_EVENTS[ev.kind].boss].name} повержен всем королевством!${rows.length ? ` Больше всех урона: ${rows.slice(0, 3).map(r => '@' + r.nick).join(', ')}.` : ''}`
      : `${KINDS[WORLD_EVENTS[ev.kind].boss].name} ушёл непобеждённым… В следующий раз соберите больше героев.`);
    else await chron('event_end', `Событие «${WORLD_EVENTS[ev.kind].name}» завершилось${result === 'won' ? ' успешно' : ''}.`);
  }
  async function advanceWorld() {
    const [cfgRaw, evs0] = await Promise.all([cfgGet('main'), sb(`world_events?status=in.(scheduled,warning,active)&select=*`)]);
    const cfg = mergeConfig(cfgRaw); let evs = evs0, changed = false;
    for (const ev of evs) {
      if (ev.status === 'scheduled' && now >= Date.parse(ev.starts_at) - (ev.kind === 'invasion' ? cfg.invasion.warnHours * 36e5 : 0)) {
        changed = true; const st = ev.kind === 'invasion' ? 'warning' : 'active';
        await evUpdate(ev.id, c => c.status === 'scheduled' ? (c.status = st, c) : null);
        if (ev.kind === 'invasion') await chron('war_warn', `Разведчики Чёрного Ордена замечены у границ! Вторжение начнётся через ${Math.max(1, Math.round((Date.parse(ev.starts_at) - now) / 6e4))} мин. Готовьтесь к обороне!`);
        else await chron('event', `Событие: «${WORLD_EVENTS[ev.kind].name}». ${WORLD_EVENTS[ev.kind].text}`);
      } else if (ev.status === 'warning' && now >= Date.parse(ev.starts_at)) { changed = true;
        const heroes = await activeHeroCount(), lvl = await avgLevel(), ls = (await cfgGet('lost_streak'))?.n || 0;
        const fort = (await cfgGet('fort')) || { pts: 0 }, cut = FORT.cut * Math.min(1, (fort.pts || 0) / FORT.max); if (fort.pts) await cfgSet('fort', { pts: 0, top: {} });
        await evUpdate(ev.id, c => c.status === 'warning' ? (c.status = 'active', c.goal = Math.round(invasionGoal(c.difficulty, heroes, ls) * (1 - cut)), c.data = { ...c.data, lvl, machines: Object.fromEntries(Object.entries(SIEGE.machines).map(([k, m]) => [k, m.hp])), machinesDown: 0 }, c) : null);
        await chron('war_start', 'Началась осада! Армия Чёрного Ордена у стен замка: тараны, осадная башня и катапульты. Все к обороне!');
        if (cut > 0) await chron('war_fort', `Укрепления королевства выдержали первый натиск: осада ослаблена на ${Math.round(cut * 100)}%.`);
      } else if (ev.status === 'active' && now >= Date.parse(ev.ends_at)) changed = true, await closeEvent(ev, ev.kind === 'caravan' || ev.progress >= ev.goal ? 'won' : 'lost');
    }
    evs = changed ? await sb(`world_events?status=in.(scheduled,warning,active)&select=id,kind`) : evs.map(e => ({ id: e.id, kind: e.kind }));
    if (cfg.invasion.enabled && !evs.some(e => e.kind === 'invasion')) {
      const [last] = await sb(`world_events?kind=eq.invasion&order=ends_at.desc&limit=1&select=ends_at`);
      const start = last ? Math.max(nextSlot(cfg, Date.parse(last.ends_at)), now + cfg.invasion.warnHours * 36e5) : now + cfg.firstInvasionHours * 36e5;
      await sb('world_events', { method: 'POST', body: { kind: 'invasion', status: 'scheduled', starts_at: ISO(start), ends_at: ISO(start + cfg.invasion.durationMin * 6e4), difficulty: cfg.invasion.difficulty, progress: 0, goal: 100, data: {}, updated_at: ISO(now) } });
    }
    if (cfg.events.enabled && !evs.some(e => e.kind !== 'invasion')) {
      const [last] = await sb(`world_events?kind=neq.invasion&order=ends_at.desc&limit=1&select=ends_at`);
      const start = last ? Date.parse(last.ends_at) + cfg.events.everyDays * 864e5 : now + 6 * 36e5, kinds = Object.keys(WORLD_EVENTS), kind = kinds[Math.floor(Math.random() * kinds.length)];
      const data = kind === 'artifact' ? { spot: SIEGE.scout[Math.floor(Math.random() * 4)], finders: [] } : kind === 'raid' || isBossEvent(kind) ? { lvl: await avgLevel(), wins: 0 } : {};
      const bGoal = isBossEvent(kind) ? bossGoal(kind, await activeHeroCount(), cfg.invasion.difficulty) : 0;
      await sb('world_events', { method: 'POST', body: { kind, status: 'scheduled', starts_at: ISO(start), ends_at: ISO(start + cfg.events.durationHours * 36e5), difficulty: 1, progress: 0, goal: bGoal || (kind === 'raid' ? 15 : kind === 'artifact' ? 5 : 1), data, updated_at: ISO(now) } });
    }
  }
  async function worldEnemies() {
    const out = [], [evs, terr] = await Promise.all([sb(`world_events?status=eq.active&select=*`), sb('territories?owner=eq.order&select=id')]);
    for (const ev of evs) { if (ev.kind === 'invasion') out.push(...invasionEnemies(ev)); if (ev.kind === 'raid') out.push(...RAIDERS(ev)); if (isBossEvent(ev.kind)) out.push(...bossEnemies(ev)); }
    terr.forEach(t => out.push(...occupiers(t.id, terr.length))); return out;
  }
  async function findEnemy(id) { if (String(id).startsWith('duel:')) return await duelEnemy(String(id).slice(5)); return enemyById(id) || (await worldEnemies()).find(e => e.id === id) || null; }
  // ---------- арена ----------
  async function duelEnemy(opp) {
    opp = normalize(opp); if (!opp || opp === nick) return null; const [o] = await sb(`heroes?nick=eq.${enc(opp)}&select=nick,role,xp`); if (!o) return null;
    const lvl = levelOf(o.xp).level; return { id: 'duel:' + o.nick, kind: 'shadow', lvl, duel: o.nick, role: o.role, path: [[ARENA.x, ARENA.z]] };
  }
  async function shadowStats(e) {
    const [eq, rp] = await Promise.all([sb(`inventory?nick=eq.${enc(e.duel)}&equipped=eq.true&select=item`), rpgGet(e.duel)]);
    const s = heroStats(e.role, e.lvl, eq.map(r => r.item).filter(i => GEAR[i])); s.atk += (rp.wlvl || 0) * WEAPON.atk; return duelStats(e.duel, e.role, e.lvl, s);
  }
  async function arenaGet() { const a = (await store.get('arena')) || {}; a.r = a.r || {}; a.log = a.log || []; return a; }
  const arenaMe = (a, n = nick) => a.r[n] || { r: ARENA_RULES.start, w: 0, l: 0 };
  async function duelsToday() { return await sb(`fights?nick=eq.${N}&enemy_id=like.duel:*&status=neq.active&updated_at=gt.${enc(ISO(Date.parse(date + 'T00:00:00+03:00') - 1))}&select=enemy_id,status`); }
  async function arenaView() {
    const [a, today, hs] = await Promise.all([arenaGet(), duelsToday(), sb(`heroes?updated_at=gt.${enc(ISO(now - 14 * 864e5))}&select=nick,role,xp&order=xp.desc&limit=200`)]);
    const myLvl = levelOf(((hs.find(x => x.nick === nick)) || { xp: 0 }).xp).level;
    const opps = hs.filter(x => x.nick !== nick).map(x => ({ nick: x.nick, role: x.role, lvl: levelOf(x.xp).level, ...arenaMe(a, x.nick), today: today.filter(t => t.enemy_id === 'duel:' + x.nick).length }))
      .sort((p, q) => Math.abs(p.lvl - myLvl) - Math.abs(q.lvl - myLvl) || q.r - p.r).slice(0, 40);
    const top = Object.entries(a.r).map(([n, v]) => ({ nick: n, ...v })).sort((p, q) => q.r - p.r).slice(0, 10);
    return { me: arenaMe(a), left: Math.max(0, ARENA_RULES.perDay - today.length), paidLeft: Math.max(0, ARENA_RULES.paidWins - today.filter(t => t.status === 'won').length), rules: ARENA_RULES, opps, top, log: a.log.slice(0, 12), spot: ARENA };
  }
  async function duelDone(e, won) { // слава арены: победитель забирает очки у побеждённого (тень защищает хозяина и без него)
    const a = await arenaGet(), me = arenaMe(a), op = arenaMe(a, e.duel), d = elo(me.r, op.r, won);
    a.r[nick] = { r: Math.max(0, me.r + d), w: me.w + (won ? 1 : 0), l: me.l + (won ? 0 : 1) };
    a.r[e.duel] = { r: Math.max(0, op.r - d), w: op.w + (won ? 0 : 1), l: op.l + (won ? 1 : 0) };
    a.log = [{ a: nick, b: e.duel, won, d: Math.abs(d), at: now }, ...a.log].slice(0, 30); await store.set('arena', a); return d;
  }
  const respawnOf = e => e.event ? 60e3 : e.terr ? 120e3 : RESPAWN_MS[e.kind];
  async function contrib(evId, add, data) {
    const [c] = await sb(`event_contrib?event_id=eq.${evId}&nick=eq.${N}&select=*`);
    if (!c) await sb('event_contrib', { method: 'POST', body: { event_id: evId, nick, points: Math.round(add), data: data || {} }, prefer: 'resolution=ignore-duplicates' });
    else await sb(`event_contrib?event_id=eq.${evId}&nick=eq.${N}`, { method: 'PATCH', body: { points: c.points + Math.round(add), ...(data ? { data } : {}) } });
  }
  async function myContribRow(evId) { const [c] = await sb(`event_contrib?event_id=eq.${evId}&nick=eq.${N}&select=*`); return c || { points: 0, data: {} }; }
  async function worldView() {
    const [cfgRaw, evs, [lastDone], terr, castleRaw, enemies, kingRaw] = await Promise.all([cfgGet('main'), sb(`world_events?status=in.(scheduled,warning,active)&select=*&order=starts_at.asc`),
      sb(`world_events?status=in.(won,lost)&order=ends_at.desc&limit=1&select=id,kind,status,ends_at`), territories(), cfgGet('castle'), worldEnemies(), cfgGet('king')]);
    const cfg = mergeConfig(cfgRaw), castle = castleRaw || { damage: 0 }, mine = {}, top = {};
    await Promise.all(evs.filter(e => e.status === 'active').map(async ev => { [mine[ev.id], top[ev.id]] = await Promise.all([myContribRow(ev.id), sb(`event_contrib?event_id=eq.${ev.id}&select=nick,points&order=points.desc&limit=5`)]); }));
    return { config: cfg, events: evs, lastDone: lastDone || null, territories: terr, castle, mine, top, enemies, king: kingRaw?.nick || null };
  }
  // ---------- бой: здоровье восстанавливается вне боя (1,5% в секунду) ----------
  async function equipped() { return (await sb(`inventory?nick=eq.${N}&equipped=eq.true&select=item`)).map(r => r.item); }
  // личные данные героя для ресурсов (уровень оружия, временные эффекты, заказ дня) — в хранилище, без новых таблиц
  async function rpgGet(who = nick) { return (await store.get('rpg/' + who)) || {}; }
  async function rpgSet(v, who = nick) { await store.set('rpg/' + who, v); }
  async function statsOf(h) { const [eq, rp] = await Promise.all([equipped(), rpgGet()]); const s = heroStats(h.role, levelOf(h.xp).level, eq);
    s.atk += (rp.wlvl || 0) * WEAPON.atk; if ((rp.buffs?.power || 0) > now) s.atk = Math.round(s.atk * 1.25); return s; }
  async function builds() { return (await cfgGet('builds')) || {}; }
  // хватает ли ресурсов; списать
  async function needCheck(need) { const it = await inv(), have = k => (it.find(i => i.item === k) || {}).qty || 0;
    const miss = Object.entries(need).filter(([k, n]) => n > 0 && have(k) < n); if (miss.length) throw new Bad(409, 'need_items', 'Не хватает: ' + miss.map(([k, n]) => `${ITEMS[k].name} ${have(k)}/${n}`).join(', ') + '.'); }
  async function pay(need) { await needCheck(need); for (const [k, n] of Object.entries(need)) if (n > 0) await setItem(k, -n); }
  const costText = need => Object.entries(need).filter(([, n]) => n > 0).map(([k, n]) => `${ITEMS[k].icon}${n}`).join(' ');
  function hpNow(h, max) { const st = h.stats || {}; if (st.hpAt == null) return max; return Math.min(max, Math.round((h.hp ?? max) + (now - st.hpAt) / 1000 * max * 0.015)); }
  async function setHp(h, hp) { const st = { ...(h.stats || {}), hpAt: now }; await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { hp: Math.round(hp), stats: st } }); h.hp = Math.round(hp); h.stats = st; }
  async function activeFight() { const [r] = await sb(`fights?nick=eq.${N}&status=eq.active&select=*`); if (!r) return null;
    if (now - Date.parse(r.updated_at) > 120e3) { await sb(`fights?id=eq.${r.id}&status=eq.active`, { method: 'PATCH', body: { status: 'fled', updated_at: new Date(now).toISOString() } }); return null; } // брошенный бой (2 мин без ходов) закрывается сам
    return r; }
  async function combatView(h) {
    const [hs, fr, won, dyn, [pot]] = await Promise.all([statsOf(h), activeFight(), sb(`fights?nick=eq.${N}&status=eq.won&select=enemy_id,updated_at&order=updated_at.desc&limit=40`), worldEnemies(), sb(`inventory?nick=eq.${N}&item=eq.potion&select=qty`)]), defeated = {};
    for (const w of won) { const e = enemyById(w.enemy_id) || dyn.find(x => x.id === w.enemy_id); if (!e) continue; const until = Date.parse(w.updated_at) + respawnOf(e); if (until > now && !defeated[w.enemy_id]) defeated[w.enemy_id] = until; }
    return { stats: hs, hp: fr ? fr.f.hHp : hpNow(h, hs.hp), maxHp: hs.hp, ability: ABIL[h.role], fight: fr ? { id: fr.id, ...fr.f } : null, defeated, potions: pot ? pot.qty : 0 };
  }
  // ---------- отряды ----------
  const wk = weekKey(new Date(now));
  async function mySquad() { const [m] = await sb(`squad_members?nick=eq.${N}&select=squad_id`); if (!m) return null; const [sq] = await sb(`squads?id=eq.${m.squad_id}&select=*`); return sq || null; }
  async function members(id) { return await sb(`squad_members?squad_id=eq.${id}&select=nick,joined_at`); }
  async function squadView(sq) {
    if (!sq) return null; const ms = await members(sq.id);
    const hs = ms.length ? await sb(`heroes?nick=in.(${ms.map(m => enc(m.nick)).join(',')})&select=nick,role,xp`) : [];
    const sqs = await sb(`squad_quests?squad_id=eq.${sq.id}&or=(status.eq.active,period.eq.${wk})&select=*`);
    return { id: sq.id, name: sq.name, leader: sq.leader, max: sq.max_size,
      members: ms.map(m => { const h = hs.find(x => x.nick === m.nick) || {}; return { nick: m.nick, role: h.role, level: levelOf(h.xp || 0).level }; }),
      quests: SQUADQ.map(q => { const r = sqs.find(x => x.quest_id === q.id && (x.status === 'active' || x.period === wk));
        return { ...q, status: r ? r.status : 'available', row: r ? { id: r.id, stage: r.stage, progress: r.progress, contrib: r.contrib, ends_at: r.ends_at } : null }; }) };
  }
  // обновление командного прогресса без потерь при одновременных действиях
  async function sqUpdate(id, mutate) {
    for (let i = 0; i < 5; i++) {
      const [cur] = await sb(`squad_quests?id=eq.${id}&select=*`); if (!cur) throw new Bad(404, 'no_quest', 'Задание отряда не найдено.');
      const next = mutate(JSON.parse(JSON.stringify(cur))); if (!next) return cur;
      const stamp = new Date(now + i + 1).toISOString();
      const r = await sb(`squad_quests?id=eq.${id}&updated_at=eq.${enc(cur.updated_at)}`, { method: 'PATCH', body: { stage: next.stage, progress: next.progress, contrib: next.contrib, status: next.status, updated_at: stamp }, prefer: 'return=representation' });
      if (r && r.length) return r[0];
    }
    throw new Bad(409, 'busy', 'Отряд действует одновременно. Попробуй ещё раз.');
  }
  // позиция: шаг не может «телепортировать» героя — проверяем скорость с прошлого известного места
  async function at(h, x, z) {
    if (![x, z].every(v => Number.isFinite(v) && Math.abs(v) < 600)) throw new Bad(400, 'bad_pos', 'Неверная позиция.');
    if (h.x != null) { const d = Math.hypot(x - h.x, z - h.z), dt = Math.max(0.5, (now - Date.parse(h.updated_at)) / 1000);
      if (d > 6 && d / dt > 7.5) { const [hz] = await sb(`inventory?nick=eq.${N}&item=eq.horse&select=qty`), fast = ((await rpgGet()).buffs?.speed || 0) > now - 5000; // конь и зелье скорости
        const lim = (hz && hz.qty > 0 ? 11 : 7.5) * (fast ? 1.35 : 1); if (d / dt > lim) throw new Bad(409, 'too_fast', 'Слишком быстро! Подойди пешком.'); } }
    await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { x: +x.toFixed(2), z: +z.toFixed(2), updated_at: new Date(now).toISOString() } });
    h.x = x; h.z = z; h.updated_at = new Date(now).toISOString();
  }
  async function achieve(id) { if (!ACH[id]) return; const r = await sb('achievements', { method: 'POST', body: { nick, ach_id: id }, prefer: 'resolution=ignore-duplicates,return=representation' }); if (r && r.length) return ACH[id].name; }
  function catalog(h) { return questsFor(nick, h.role, levelOf(h.xp).level, date); }
  // шаг «принеси предметы» засчитывается сам, как только предметы есть в сумке (отдельного действия для него нет)
  const effStep = (q, step, items) => { const have = it => (items.find(i => i.item === it) || {}).qty || 0;
    while (q.steps[step] && q.steps[step].t === 'items' && have(q.steps[step].item) >= q.steps[step].n) step++; return step; };
  async function state(h) {
    const [, h0] = await Promise.all([advanceWorld(), hero()]); h = h0; // мир и герой — параллельно (advanceWorld героя не меняет)
    const [items, qrows, achs, gathered, [sqv, invites], combat, world, coins, choppedRows, resv, inbox] = await Promise.all([
      inv(), sb(`quests?nick=eq.${N}&or=(status.eq.active,period.eq.once,period.eq.${date})&select=quest_id,period,status,progress`),
      sb(`achievements?nick=eq.${N}&select=ach_id,at`), sb(`reward_log?nick=eq.${N}&key=like.${enc('g:' + date + ':')}*&select=key`),
      Promise.all([mySquad().then(squadView), sb(`squad_invites?to_nick=eq.${N}&status=eq.pending&select=id,squad_id,from_nick`)]),
      combatView(h), worldView(), coinsOf(), sb(`reward_log?nick=eq.${N}&key=like.${enc('t:' + date + ':' + slotOf(now) + ':')}*&select=key`), resView(), inboxTake()]); // всё одним заходом — быстрее отклик
    const L = levelOf(h.xp);
    const slot = slotOf(now), taken = new Set(gathered.filter(g => g.key.split(':')[2] === String(slot)).map(g => g.key.split(':').pop()));
    const chopped = choppedRows.map(g => g.key.split(':').pop());
    const qs = catalog(h).map(q => { const row = qrows.find(r => r.quest_id === q.id && r.period === q.period);
      let status = row ? row.status : 'available';
      if (status === 'available') { if (L.level < q.minLevel) status = 'locked'; else if (q.after && !qrows.some(r => r.quest_id === q.after && r.status === 'done')) status = 'locked'; }
      return { ...q, status, step: status === 'active' ? effStep(q, row?.progress?.step || 0, items) : row?.progress?.step || 0, t0: row?.progress?.t0 || null }; });
    await Promise.all(invites.map(async iv => { const [sq] = await sb(`squads?id=eq.${iv.squad_id}&select=name`); iv.name = sq ? sq.name : '?'; }));
    return { hero: { nick, role: h.role, xp: h.xp, level: L.level, into: L.into, need: L.need, hp: h.hp, x: h.x, z: h.z, face: h.face, spec: SPEC[h.role] },
      squad: sqv, invites: invites.filter(i => i.name !== '?'), week: wk, combat, world, title: h.title || null, coins, inventory: items.filter(i => i.qty > 0), quests: qs, achievements: achs, nodes: nodesFor(date).map(n => ({ ...n, taken: taken.has(n.id) })), respawnAt: (slot + 1) * NODE_RESPAWN, rolePrice: ROLE_PRICE, chopped, date,
      res: resv, inbox };
  }
  async function resView() {
    const [rp, bl, fort, decor] = await Promise.all([rpgGet(), builds(), cfgGet('fort'), store.get('decor')]);
    return { wlvl: rp.wlvl || 0, buffs: rp.buffs || {}, orderDone: rp.orderDay === date, order: dailyOrder(date), builds: bl, fort: fort || { pts: 0 }, decor: (decor || {})[nick] || [] };
  }
  const findQuest = (h, id) => { const q = catalog(h).find(q => q.id === id); if (!q) throw new Bad(404, 'no_quest', 'Такого задания нет.'); return q; };
  async function row(q) { const [r] = await sb(`quests?nick=eq.${N}&quest_id=eq.${enc(q.id)}&period=eq.${enc(q.period)}&select=*`); return r; }

  try {
    if (action === 'hero') return json(200, await state());

    if (action === 'pos') {
      const h = await hero(); const x = +b.x, z = +b.z;
      if (![x, z].every(v => Number.isFinite(v) && Math.abs(v) < 600)) throw new Bad(400, 'bad_pos', 'Неверная позиция.');
      if (now - Date.parse(h.updated_at) > 8000) await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { x: +x.toFixed(2), z: +z.toFixed(2), face: +(+b.face || 0).toFixed(2), updated_at: new Date(now).toISOString() } });
      return json(200, { saved: true });
    }

    if (action === 'take') {
      const h = await hero(), q = findQuest(h, b.quest), L = levelOf(h.xp);
      await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC[q.giver])) throw new Bad(409, 'far', `Подойди к NPC: ${NPC[q.giver].name}.`);
      if (L.level < q.minLevel) throw new Bad(409, 'level', `Нужен ${q.minLevel} уровень.`);
      if (q.after) { const [prev] = await sb(`quests?nick=eq.${N}&quest_id=eq.${enc(q.after)}&status=eq.done&select=quest_id`); if (!prev) throw new Bad(409, 'locked', 'Сначала выполни предыдущее задание.'); }
      const r = await sb('quests', { method: 'POST', body: { nick, quest_id: q.id, period: q.period, progress: { step: 0 } }, prefer: 'resolution=ignore-duplicates,return=representation' });
      if (!r || !r.length) throw new Bad(409, 'taken', 'Это задание уже взято или выполнено.');
      return json(200, { ...(await state(h)), note: `Задание «${q.title}» принято.` });
    }

    if (action === 'step') {
      const h = await hero(), q = findQuest(h, b.quest), r = await row(q);
      if (!r || r.status !== 'active') throw new Bad(409, 'not_active', 'Задание не активно.');
      await at(h, +b.x, +b.z);
      const p = r.progress || { step: 0 }; p.step = effStep(q, p.step || 0, await inv()); const s = q.steps[p.step]; if (!s) return json(200, { ...(await state(h)), note: 'Все шаги выполнены, иди сдавать.' });
      let note = '';
      if (s.t === 'visit' || s.t === 'talk') {
        const t = s.t === 'visit' ? POI[s.poi] : NPC[s.npc]; if (!near(h.x, h.z, t, 3.5)) throw new Bad(409, 'far', 'Нужно подойти ближе.');
        p.step++; delete p.t0; note = 'Готово!';
      } else if (s.t === 'wait') {
        if (!near(h.x, h.z, POI[s.poi], 4)) throw new Bad(409, 'far', `Встань на пост: ${POI[s.poi].name}.`);
        if (!p.t0) { p.t0 = now; note = `Стой здесь ${s.sec} секунд.`; }
        else if (now - p.t0 >= s.sec * 1000 - 500) { p.step++; delete p.t0; note = 'Пост сдан!'; }
        else note = `Ещё ${Math.ceil((s.sec * 1000 - (now - p.t0)) / 1000)} с.`;
      } else if (s.t === 'items') {
        const [it] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(s.item)}&select=qty`);
        if (!it || it.qty < s.n) throw new Bad(409, 'need_items', `Нужно ${ITEMS[s.item].name} ×${s.n}, у тебя ${it ? it.qty : 0}.`);
        p.step++; note = 'Всё собрано!';
      }
      await sb(`quests?id=eq.${r.id}`, { method: 'PATCH', body: { progress: p } });
      return json(200, { ...(await state(h)), note });
    }

    if (action === 'done') {
      const h = await hero(), q = findQuest(h, b.quest), r = await row(q);
      if (!r || r.status !== 'active') throw new Bad(409, 'not_active', 'Задание не активно.');
      await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC[q.turnIn])) throw new Bad(409, 'far', `Сдавать нужно: ${NPC[q.turnIn].name}.`);
      if (effStep(q, r.progress?.step || 0, await inv()) < q.steps.length) throw new Bad(409, 'not_done', 'Задание ещё не выполнено.');
      for (const s of q.steps.filter(s => s.t === 'items')) { const [it] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(s.item)}&select=qty`); if (!it || it.qty < s.n) throw new Bad(409, 'need_items', `Не хватает: ${ITEMS[s.item].name}.`); }
      // награда один раз: уникальный ключ в журнале наград
      const reward = applySpec(h.role, q, q.reward), key = `q:${q.id}:${q.period}`; if ((await builds()).taverna?.done) reward.xp = Math.round(reward.xp * 1.1);
      const ins = await sb('reward_log', { method: 'POST', body: { nick, key, gold: reward.coins, xp: reward.xp, items: reward.items }, prefer: 'resolution=ignore-duplicates,return=representation' });
      if (!ins || !ins.length) throw new Bad(409, 'already', 'Награда за это задание уже получена.');
      for (const s of q.steps.filter(s => s.t === 'items')) await setItem(s.item, -s.n);
      await sb(`quests?id=eq.${r.id}`, { method: 'PATCH', body: { status: 'done', done_at: new Date(now).toISOString() } });
      const before = levelOf(h.xp).level, xp = h.xp + reward.xp, after = levelOf(xp).level;
      await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { xp } }); h.xp = xp;
      await addCoins(reward.coins); for (const [it, n] of reward.items) await setItem(it, n);
      const got = [];
      const count = (await sb(`quests?nick=eq.${N}&status=eq.done&select=id`)).length;
      for (const [id, okk] of [['first_quest', count >= 1], ['quests10', count >= 10], ['quests50', count >= 50], ['level5', after >= 5], ['level10', after >= 10], ['story', q.id === 's5'], ['role', q.kind === 'role']]) if (okk) { const a = await achieve(id); if (a) got.push(a); }
      if (q.chronicle) await sb('chronicle', { method: 'POST', body: { type: 'story', nick, text: `@${nick} раскрыл тайну Чёрного Ордена и предупредил короля.` } });
      if (after > before && after % 5 === 0) await sb('chronicle', { method: 'POST', body: { type: 'level', nick, text: `@${nick} достиг ${after} уровня.` } });
      for (const a of got) await sb('chronicle', { method: 'POST', body: { type: 'ach', nick, text: `@${nick} получил достижение «${a}».` } });
      return json(200, { ...(await state(h)), reward, levelUp: after > before ? after : null, achievements_new: got, note: q.done });
    }

    if (action === 'gather') {
      const h = await hero(), node = nodesFor(date).find(n => n.id === b.node);
      if (!node) throw new Bad(404, 'no_node', 'Здесь уже ничего нет.');
      await at(h, +b.x, +b.z); if (!near(h.x, h.z, node, 2.6)) throw new Bad(409, 'far', 'Подойди ближе.');
      const occ = (await sb('territories?owner=eq.order&select=id')).find(t => Math.hypot(TERR[t.id].x - node.x, TERR[t.id].z - node.z) < 12); if (occ) throw new Bad(409, 'occupied', `Здесь хозяйничает Чёрный Орден («${TERR[occ.id].name}»). Сначала освободи территорию.`);
      const extra = SPEC[h.role]?.bonusRes === node.type ? 1 : 0, got = (node.n || 1) + extra;
      const ins = await sb('reward_log', { method: 'POST', body: { nick, key: `g:${date}:${slotOf(now)}:${node.id}`, items: [[node.type, got]] }, prefer: 'resolution=ignore-duplicates,return=representation' });
      if (!ins || !ins.length) throw new Bad(409, 'taken', 'Здесь пусто. Ресурсы вернутся через несколько минут.');
      await setItem(node.type, got);
      const tot = await sb(`reward_log?nick=eq.${N}&key=like.g:*&select=key`); let ach = null; if (tot.length >= 30) ach = await achieve('gather30');
      return json(200, { ...(await state(h)), note: `${node.kind === 'tree' ? '🪓 ' : node.kind === 'rock' ? '⛏ ' : ''}+${got} ${ITEMS[node.type].name}${extra ? ' (бонус роли)' : ''}`, achievements_new: ach ? [ach] : [] });
    }

    // ---------- отряды ----------
    if (action === 'squad_create') {
      const name = String(b.name || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 24); if (name.length < 2) throw new Bad(400, 'name', 'Название: от 2 до 24 символов.');
      if (await mySquad()) throw new Bad(409, 'in_squad', 'Ты уже в отряде.'); await hero();
      const size = Math.max(2, Math.min(SQUAD.maxSize, Math.round(+b.size || SQUAD.defaultSize)));
      const [sq] = await sb('squads', { method: 'POST', body: { name, leader: nick, max_size: size }, prefer: 'return=representation' });
      await sb('squad_members', { method: 'POST', body: { squad_id: sq.id, nick } });
      await sb('chronicle', { method: 'POST', body: { type: 'squad', nick, text: `@${nick} собрал отряд «${name}».` } });
      return json(200, { ...(await state()), note: `Отряд «${name}» создан. Приглашай героев!` });
    }
    if (action === 'squad_invite') {
      const sq = await mySquad(); if (!sq) throw new Bad(409, 'no_squad', 'Сначала создай отряд.');
      const to = normalize(b.to); if (!to || to === nick) throw new Bad(400, 'bad_nick', 'Укажи ник героя.');
      const [th] = await sb(`heroes?nick=eq.${enc(to)}&select=nick`); if (!th) throw new Bad(404, 'no_hero', `У @${to} ещё нет героя: пусть сначала войдёт в игру.`);
      const [busy] = await sb(`squad_members?nick=eq.${enc(to)}&select=squad_id`); if (busy) throw new Bad(409, 'busy', `@${to} уже в отряде.`);
      if ((await members(sq.id)).length >= sq.max_size) throw new Bad(409, 'full', 'Отряд заполнен.');
      const [dup] = await sb(`squad_invites?squad_id=eq.${sq.id}&to_nick=eq.${enc(to)}&status=eq.pending&select=id`); if (dup) throw new Bad(409, 'dup', 'Приглашение уже отправлено.');
      await sb('squad_invites', { method: 'POST', body: { squad_id: sq.id, from_nick: nick, to_nick: to } });
      return json(200, { ...(await state()), note: `Приглашение отправлено @${to}.` });
    }
    if (action === 'squad_answer') {
      const [iv] = await sb(`squad_invites?id=eq.${+b.invite}&to_nick=eq.${N}&status=eq.pending&select=*`); if (!iv) throw new Bad(404, 'no_invite', 'Приглашение не найдено.');
      if (!b.accept) { await sb(`squad_invites?id=eq.${iv.id}`, { method: 'PATCH', body: { status: 'declined' } }); return json(200, { ...(await state()), note: 'Приглашение отклонено.' }); }
      if (await mySquad()) throw new Bad(409, 'in_squad', 'Сначала выйди из своего отряда.'); await hero();
      const [sq] = await sb(`squads?id=eq.${iv.squad_id}&select=*`); if (!sq) throw new Bad(404, 'gone', 'Этого отряда больше нет.');
      if ((await members(sq.id)).length >= sq.max_size) throw new Bad(409, 'full', 'Отряд уже заполнен.');
      await sb('squad_members', { method: 'POST', body: { squad_id: sq.id, nick } });
      await sb(`squad_invites?id=eq.${iv.id}`, { method: 'PATCH', body: { status: 'accepted' } });
      return json(200, { ...(await state()), note: `Ты в отряде «${sq.name}»!` });
    }
    if (action === 'squad_leave' || action === 'squad_kick') {
      const sq = await mySquad(); if (!sq) throw new Bad(409, 'no_squad', 'Ты не в отряде.');
      const who = action === 'squad_kick' ? normalize(b.who) : nick;
      if (action === 'squad_kick' && (sq.leader !== nick || who === nick)) throw new Bad(403, 'not_leader', 'Исключать может только командир.');
      await sb(`squad_members?squad_id=eq.${sq.id}&nick=eq.${enc(who)}`, { method: 'DELETE' });
      const rest = await members(sq.id);
      if (!rest.length) await sb(`squads?id=eq.${sq.id}`, { method: 'DELETE' });
      else if (who === sq.leader) await sb(`squads?id=eq.${sq.id}`, { method: 'PATCH', body: { leader: rest.sort((a, b) => a.joined_at < b.joined_at ? -1 : 1)[0].nick } });
      return json(200, { ...(await state()), note: action === 'squad_kick' ? `@${who} исключён из отряда.` : 'Ты вышел из отряда.' });
    }
    if (action === 'squad_size') {
      const sq = await mySquad(); if (!sq || sq.leader !== nick) throw new Bad(403, 'not_leader', 'Менять размер может только командир.');
      const size = Math.max(2, Math.min(SQUAD.maxSize, Math.round(+b.size))); if (size < (await members(sq.id)).length) throw new Bad(409, 'small', 'В отряде уже больше героев.');
      await sb(`squads?id=eq.${sq.id}`, { method: 'PATCH', body: { max_size: size } }); return json(200, await state());
    }
    if (action === 'sq_take') {
      const sq = await mySquad(), h = await hero(); if (!sq) throw new Bad(409, 'no_squad', 'Нужен отряд.');
      // совместное задание может взять любой участник отряда
      const q = SQUADQ.find(q => q.id === b.quest); if (!q) throw new Bad(404, 'no_quest', 'Такого задания нет.');
      await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC[q.giver])) throw new Bad(409, 'far', `Подойди к NPC: ${NPC[q.giver].name}.`);
      if ((await members(sq.id)).length < (demo ? 1 : SQUAD.minToStart)) throw new Bad(409, 'few', `Для совместного задания нужно минимум ${SQUAD.minToStart} героя в отряде.`);
      const [act] = await sb(`squad_quests?squad_id=eq.${sq.id}&status=eq.active&select=id`); if (act) throw new Bad(409, 'busy', 'У отряда уже есть активное задание.');
      const r = await sb('squad_quests', { method: 'POST', body: { squad_id: sq.id, quest_id: q.id, period: wk, ends_at: new Date(now + q.hours * 36e5).toISOString(), progress: {}, contrib: {}, updated_at: new Date(now).toISOString() }, prefer: 'resolution=ignore-duplicates,return=representation' });
      if (!r || !r.length) throw new Bad(409, 'done_week', 'Это задание отряд уже брал на этой неделе.');
      await sb('chronicle', { method: 'POST', body: { type: 'squad', nick, text: `Отряд «${sq.name}» отправился на задание «${q.title}».` } });
      return json(200, { ...(await state(h)), note: `Отряд взял задание «${q.title}». Время: ${q.hours} ч.` });
    }
    if (action === 'sq_act') {
      const sq = await mySquad(), h = await hero(); if (!sq) throw new Bad(409, 'no_squad', 'Нужен отряд.');
      const [row] = await sb(`squad_quests?squad_id=eq.${sq.id}&status=eq.active&select=*`); if (!row) throw new Bad(409, 'no_active', 'У отряда нет активного задания.');
      const q = SQUADQ.find(q => q.id === row.quest_id);
      if (now > Date.parse(row.ends_at)) {
        await sqUpdate(row.id, c => (c.status = 'failed', c));
        await sb('chronicle', { method: 'POST', body: { type: 'squad_fail', nick, text: `Отряд «${sq.name}» не успел выполнить «${q.title}». Попробуйте на следующей неделе!` } });
        return json(200, { ...(await state(h)), note: 'Время вышло: задание провалено.' });
      }
      await at(h, +b.x, +b.z);
      const st = q.stages[row.stage], m = (st.mult && st.mult[h.role]) || 1; let note = '';
      if (st.t === 'team_items') {
        if (!near(h.x, h.z, NPC[st.npc])) throw new Bad(409, 'far', `Сдавать нужно: ${NPC[st.npc].name}.`);
        const [it] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(st.item)}&select=qty`); const have = it ? it.qty : 0;
        const got = (row.progress.n || 0), give = Math.min(have, st.n - got); if (give <= 0) throw new Bad(409, 'need_items', `Нужно: ${ITEMS[st.item].name}. У тебя нет.`);
        await setItem(st.item, -give);
        await sqUpdate(row.id, c => { c.progress.n = (c.progress.n || 0) + give; c.contrib[nick] = (c.contrib[nick] || 0) + Math.round(give * 5 * m); if (c.progress.n >= st.n) { c.stage++; c.progress = {}; } return c; });
        note = `Сдано ${give} — ${ITEMS[st.item].name}${m > 1 ? ' (бонус роли)' : ''}.`;
      } else if (st.t === 'team_visit') {
        const poi = st.pois.find(p => near(h.x, h.z, POI[p], 3.5)); if (!poi) throw new Bad(409, 'far', 'Здесь подсказки нет.');
        let already = false;
        await sqUpdate(row.id, c => { const v = c.progress.v || []; if (v.includes(poi)) { already = true; return null; } c.progress.v = [...v, poi]; c.contrib[nick] = (c.contrib[nick] || 0) + Math.round(10 * m); if (c.progress.v.length >= st.pois.length) { c.stage++; c.progress = {}; } return c; });
        note = already ? 'Эту подсказку уже нашли.' : `Подсказка найдена: ${POI[poi].name}!`;
      } else if (st.t === 'team_wait') {
        if (!near(h.x, h.z, POI[st.poi], 4)) throw new Bad(409, 'far', `Работа идёт здесь: ${POI[st.poi].name}.`);
        const t0 = row.progress['t_' + nick];
        if (!t0) { await sqUpdate(row.id, c => (c.progress['t_' + nick] = now, c)); note = 'Работаешь… через 15 секунд сдай результат.'; }
        else if (now - t0 < 14500) note = `Ещё ${Math.ceil((15000 - (now - t0)) / 1000)} с.`;
        else { const add = Math.round(15 * m);
          await sqUpdate(row.id, c => { delete c.progress['t_' + nick]; c.progress.sec = (c.progress.sec || 0) + add; c.contrib[nick] = (c.contrib[nick] || 0) + add; if (c.progress.sec >= st.total) { c.stage++; c.progress = {}; } return c; });
          note = `+${add} с общей работы${m > 1 ? ' (бонус роли)' : ''}.`; }
      } else if (st.t === 'together') {
        if (!near(h.x, h.z, POI[st.poi], 4)) throw new Bad(409, 'far', `Собираемся здесь: ${POI[st.poi].name}.`);
        const need = demo ? 1 : st.min;
        const c2 = await sqUpdate(row.id, c => { const ci = c.progress.in || {}; ci[nick] = now; for (const k in ci) if (now - ci[k] > 45000) delete ci[k]; c.progress.in = ci;
          if (!c.contrib[nick]) c.contrib[nick] = 0; c.contrib[nick] += 10; if (Object.keys(ci).length >= need) { c.stage++; c.progress = {}; } return c; });
        note = c2.stage > row.stage ? 'Все на месте!' : `На месте ${Object.keys(c2.progress.in || {}).length} из ${need}. Ждём остальных (45 с).`;
      }
      // завершение: награды всем, кто внёс вклад
      const [fin] = await sb(`squad_quests?id=eq.${row.id}&select=*`);
      if (fin.stage >= q.stages.length && fin.status === 'active') {
        const done = await sqUpdate(row.id, c => c.status === 'active' ? (c.status = 'done', c) : null);
        if (done.status === 'done') {
          const ranked = Object.entries(fin.contrib).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
          for (const [who, pts] of ranked) {
            const best = who === ranked[0][0], rw = { xp: Math.round(q.reward.xp * (best ? 1.3 : 1)), coins: Math.round(q.reward.coins * (best ? 1.3 : 1)), items: q.reward.items };
            const ins = await sb('reward_log', { method: 'POST', body: { nick: who, key: `sq:${fin.id}`, gold: rw.coins, xp: rw.xp, items: rw.items }, prefer: 'resolution=ignore-duplicates,return=representation' });
            if (!ins || !ins.length) continue;
            const [hh] = await sb(`heroes?nick=eq.${enc(who)}&select=xp`); if (hh) await sb(`heroes?nick=eq.${enc(who)}`, { method: 'PATCH', body: { xp: hh.xp + rw.xp } });
            await addCoins(rw.coins, who); for (const [it, n] of rw.items) await setItem(it, n, who);
          }
          await sb('chronicle', { method: 'POST', body: { type: 'squad_win', nick, text: `Отряд «${sq.name}» выполнил «${q.title}»! Герои: ${ranked.map(([w]) => '@' + w).join(', ')}. Больше всех помог @${ranked[0][0]}.` } });
          note = `Задание «${q.title}» выполнено! Награда выдана всем, кто помогал.`;
        }
      }
      return json(200, { ...(await state()), note });
    }
    if (action === 'arena') { await hero(); return json(200, { arena: await arenaView() }); }
    if (action === 'chat') {
      const raw = String(b.text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 200); if (!raw) throw new Bad(400, 'empty', 'Пустое сообщение.');
      const mute = ((await store.get('chat_mutes')) || {})[nick]; if (mute && (mute < 0 || mute > now)) throw new Bad(403, 'muted', mute < 0 ? 'Король запретил тебе писать в чат.' : `Король запретил тебе писать в чат до ${new Date(mute).toLocaleString('ru-RU', { timeZone: 'Europe/Samara', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`);
      const text = censor(raw).text; // мат и оскорбления — звёздочками
      let channel = String(b.channel || 'world');
      if (channel !== 'world') { const sq = await mySquad(); if (!sq || channel !== 'squad:' + sq.id) throw new Bad(403, 'not_member', 'Это чат чужого отряда.'); }
      const [last] = await sb(`chat?nick=eq.${N}&order=at.desc&limit=1&select=at`);
      if (last && now - Date.parse(last.at) < SQUAD.chatGapMs) throw new Bad(429, 'slow', 'Не так быстро!');
      await hero(); await sb('chat', { method: 'POST', body: { channel, nick, text, at: new Date(now).toISOString() } });
      return json(200, { sent: true });
    }
    // ---------- бой ----------
    if (action === 'fight') {
      const h = await hero(), move = String(b.move || ''); let fr = await activeFight();
      if (move === 'flee' && fr && String(fr.enemy_id).startsWith('duel:')) { // сбежать с арены = поражение, но здоровье не теряется
        const e = await duelEnemy(fr.enemy_id.slice(5)); await sb(`fights?id=eq.${fr.id}&status=eq.active`, { method: 'PATCH', body: { status: 'lost', updated_at: new Date(now).toISOString() } });
        const d = e ? await duelDone(e, false) : 0; return json(200, { ...(await state(h)), note: `Ты покинул арену. Это засчитано как поражение${d ? ` (слава −${Math.abs(d)})` : ''}.`, arena: true }); }
      const endFight = async note => { if (fr) { await sb(`fights?id=eq.${fr.id}&status=eq.active`, { method: 'PATCH', body: { status: 'fled', updated_at: new Date(now).toISOString() } }); await setHp(h, fr.f.hHp); } return json(200, { ...(await state(h)), note }); };
      if (move === 'flee') return endFight('Ты отступил.'); // отступить можно всегда — даже если врага уже нет
      if (fr && !(await findEnemy(fr.enemy_id))) { const r = await endFight(KINDS[fr.f.kind]?.boss || fr.f.kind === 'skeleton' ? 'Битва с боссом окончена. Награду за твой урон смотри в сообщении.' : 'Враг исчез — бой окончен.'); if (fr.enemy_id === b.enemy) return r; fr = null; } // врага добили другие или событие закончилось
      const e = await findEnemy(b.enemy); if (!e) throw new Bad(404, 'no_enemy', 'Здесь нет врага.');
      if (fr && fr.enemy_id !== e.id) throw new Bad(409, 'busy', 'Ты уже сражаешься с другим врагом. Нажми «Отступить».');
      await at(h, +b.x, +b.z);
      const p = enemyPos(e, now), dist = Math.hypot(h.x - p.x, h.z - p.z);
      if (!fr && !e.duel && dist > 6) throw new Bad(409, 'far', 'Подойди к врагу ближе.');
      if (fr && Math.hypot(h.x - fr.f.ex, h.z - fr.f.ez) > 9) throw new Bad(409, 'far', 'Ты отошёл слишком далеко от врага.');
      const hs = await statsOf(h); let log = [];
      if (!fr) {
        if (move !== 'start') throw new Bad(409, 'no_fight', 'Сначала вступи в бой.');
        if (e.night && !isNight(now)) throw new Bad(409, 'day', 'Утопец спит на дне реки. Он выходит только ночью — с 21:00 до 5:00 по Москве.');
        if (e.duel) { // арена: свой путь — полное здоровье, лимиты в день, тень рядом с героем
          if (Math.hypot(h.x - ARENA.x, h.z - ARENA.z) > ARENA.r + 1) throw new Bad(409, 'far', 'Вызвать на бой можно только на арене за рекой.');
          const today = await duelsToday(); if (today.length >= ARENA_RULES.perDay) throw new Bad(409, 'limit', `На сегодня хватит: ${ARENA_RULES.perDay} боёв на арене в день. Приходи завтра!`);
          if (today.filter(t => t.enemy_id === e.id).length >= ARENA_RULES.samePerDay) throw new Bad(409, 'limit', `С @${e.duel} сегодня уже было ${ARENA_RULES.samePerDay} боя. Выбери другого соперника.`);
          const es = await shadowStats(e), f = newFight(e, hs, hs.hp, now - MIN_GAP, es), ang = Math.atan2(h.x - ARENA.x, h.z - ARENA.z);
          f.ex = +(h.x - Math.sin(ang) * 2.4).toFixed(2); f.ez = +(h.z - Math.cos(ang) * 2.4).toFixed(2); if (Math.hypot(f.ex - ARENA.x, f.ez - ARENA.z) > ARENA.r - 1) { f.ex = ARENA.x; f.ez = ARENA.z; }
          const [row] = await sb('fights', { method: 'POST', body: { nick, enemy_id: e.id, status: 'active', f, updated_at: new Date(now).toISOString() }, prefer: 'return=representation' });
          return json(200, { ...(await state(h)), log: [`🏟 Бой на арене! ${es.name} (ур. ${e.lvl}) выходит на песок.`] }); }
        const [last] = await sb(`fights?nick=eq.${N}&enemy_id=eq.${e.id}&status=eq.won&select=updated_at&order=updated_at.desc&limit=1`);
        if (last && now - Date.parse(last.updated_at) < respawnOf(e)) throw new Bad(409, 'dead', 'Этот враг уже повержен. Он вернётся позже.');
        const hp = hpNow(h, hs.hp); if (hp < hs.hp * 0.15) throw new Bad(409, 'weak', 'Ты слишком ранен. Отдохни немного: здоровье восстанавливается само.');
        const f = newFight(e, hs, hp, now - MIN_GAP); f.ex = +p.x.toFixed(2); f.ez = +p.z.toFixed(2);
        const [row] = await sb('fights', { method: 'POST', body: { nick, enemy_id: e.id, status: 'active', f, updated_at: new Date(now).toISOString() }, prefer: 'return=representation' });
        fr = row; log = [`${KINDS[e.kind].name} (ур. ${e.lvl}) вступает в бой!`];
      } else {
        const f = fr.f;
        if (now - f.last < MIN_GAP) throw new Bad(429, 'fast', 'Не так быстро!');
        const isAb = ABIL[h.role] && move === ABIL[h.role].id; if (!isAb && MOVES[move] == null) throw new Bad(400, 'bad_move', 'Неизвестное действие.');
        const left = cooldownLeft(f, move, h.role, now); if (left > 0) throw new Bad(429, 'cooldown', `Ещё ${Math.ceil(left / 1000)} с перезарядки.`);
        if (move === 'potion') { const [pot] = await sb(`inventory?nick=eq.${N}&item=eq.potion&select=qty`); if (!pot || pot.qty < 1) throw new Bad(409, 'no_potion', 'Нет зелий. Купи у торговца.'); await setItem('potion', -1); }
        f.hMax = hs.hp; f.cds[move] = now;
        const eBefore = f.eHp;
        log = resolveRound(f, move, h.role, hs, Math.random, now);
        let status = 'active';
        if (f.eHp <= 0) status = 'won'; else if (f.hHp <= 0) status = 'lost';
        const upd = await sb(`fights?id=eq.${fr.id}&status=eq.active&updated_at=eq.${enc(fr.updated_at)}`, { method: 'PATCH', body: { f, status, updated_at: new Date(now).toISOString() }, prefer: 'return=representation' });
        if (!upd || !upd.length) throw new Bad(409, 'busy', 'Действие уже засчитано.');
        fr = upd[0];
        if (e.event && eBefore > f.eHp) { const [bev] = await sb(`world_events?id=eq.${e.event}&status=eq.active&select=id,kind,goal,progress`); // босс: урон уходит в общее здоровье
          if (bev && isBossEvent(bev.kind)) { const dealt = (eBefore - f.eHp) + (e.kind === 'skeleton' && f.eHp <= 0 ? 120 : 0); await contrib(bev.id, Math.max(1, dealt / 4)); // даже слабый удар засчитывается
            const up = await evUpdate(bev.id, c => (c.progress = Math.min(c.goal, c.progress + dealt), c)); log.push(`Общее здоровье босса: ${Math.max(0, up.goal - up.progress)} из ${up.goal}.`);
            if (up.progress >= up.goal) await closeEvent(up, 'won'); } }
        if (e.duel && status !== 'active') { const won = status === 'won', d = await duelDone(e, won), wins = (await duelsToday()).filter(t => t.status === 'won').length;
          let rw = null; if (won && wins <= ARENA_RULES.paidWins) { rw = duelReward(e.lvl); const ins = await sb('reward_log', { method: 'POST', body: { nick, key: `f:${fr.id}`, gold: rw.coins, xp: rw.xp }, prefer: 'resolution=ignore-duplicates,return=representation' });
            if (ins && ins.length) { h.xp += rw.xp; await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { xp: h.xp } }); await addCoins(rw.coins); } else rw = null; }
          log.push(won ? `🏆 Победа на арене! Слава +${d}${rw ? `, +${rw.xp} опыта, +${rw.coins} монет` : ' (награды монетами на сегодня кончились)'}.` : `Тень @${e.duel} оказалась сильнее. Слава −${Math.abs(d)}. Лекари арены уже тебя подлатали.`);
          if (won) await chron('arena', `🏟 @${nick} победил тень @${e.duel} на арене (+${d} славы).`, nick);
          return json(200, { ...(await state(h)), log, result: won ? 'won' : 'lost', arena: true, reward: rw ? { ...rw, items: [] } : null }); }
        if (status === 'won') {
          const rw = enemyReward(e), loot = [];
          const ins = await sb('reward_log', { method: 'POST', body: { nick, key: `f:${fr.id}`, gold: rw.coins, xp: rw.xp }, prefer: 'resolution=ignore-duplicates,return=representation' });
          if (ins && ins.length) {
            for (const [it, ch] of LOOT[e.kind]) if (Math.random() < ch) { loot.push(it); await setItem(it, 1); }
            if (e.raid) rw.coins *= 2;
            const before = levelOf(h.xp).level; h.xp += rw.xp; await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { xp: h.xp } }); await addCoins(rw.coins);
            if (e.event) { const [ev] = await sb(`world_events?id=eq.${e.event}&status=eq.active&select=*`);
              if (ev && ev.kind === 'invasion') { const pts = Math.round(8 * e.lvl * ((TASKS.fight.mult[h.role]) || 1) * (e.kind === 'commander' ? 5 : 1)); await contrib(ev.id, pts); const up = await evUpdate(ev.id, c => (c.progress += pts, c)); log.push(`Оборона: +${pts} очков.`); if (up.progress >= up.goal) await closeEvent(up, 'won'); }
              if (ev && ev.kind === 'raid') { await contrib(ev.id, 10); const up = await evUpdate(ev.id, c => (c.progress += 1, c)); if (up.progress >= up.goal) await closeEvent(up, 'won'); } }
            if (e.terr) { const [t] = await sb(`territories?id=eq.${e.terr}&select=*`);
              if (t && t.owner === 'order') { const control = Math.min(100, t.control + 25); const freed = control >= 100;
                await sb(`territories?id=eq.${t.id}`, { method: 'PATCH', body: { control, owner: freed ? 'kingdom' : 'order', updated_at: ISO(now) } });
                log.push(freed ? `Территория «${TERR[t.id].name}» освобождена!` : `Освобождение «${TERR[t.id].name}»: ${control}%.`);
                if (freed) await chron('liberated', `@${nick} освободил территорию «${TERR[t.id].name}» от Чёрного Ордена! Флаги королевства снова над ней.`, nick); } }
            await setHp(h, f.hHp);
            const wins = (await sb(`fights?nick=eq.${N}&status=eq.won&select=id`)).length, got = [];
            for (const [id, ok] of [['first_blood', wins >= 1], ['slayer10', wins >= 10], ['lord', e.kind === 'lord']]) if (ok) { const a = await achieve(id); if (a) got.push(a); }
            if (KINDS[e.kind].boss) await sb('chronicle', { method: 'POST', body: { type: 'boss', nick, text: `@${nick} одолел: ${KINDS[e.kind].name}! Чёрный Орден в ярости.` } });
            for (const a of got) await sb('chronicle', { method: 'POST', body: { type: 'ach', nick, text: `@${nick} получил достижение «${a}».` } });
            const after = levelOf(h.xp).level;
            log.push(`Победа! +${rw.xp} опыта, +${rw.coins} монет${loot.length ? ', добыча: ' + loot.map(i => ITEMS[i].name).join(', ') : ''}.`);
            return json(200, { ...(await state(h)), log, result: 'won', reward: { ...rw, items: loot.map(i => [i, 1]) }, levelUp: after > before ? after : null, achievements_new: got });
          }
        }
        if (status === 'lost') { await setHp(h, Math.round(hs.hp * 0.3)); await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { x: 1.8, z: 9.9, updated_at: new Date(now).toISOString() } }); h.x = 1.8; h.z = 9.9; log.push('Ты повержен… Лекари замка подлатали тебя. Отдохни и возвращайся!'); return json(200, { ...(await state(h)), log, result: 'lost' }); }
      }
      return json(200, { ...(await state(h)), log });
    }
    // ---------- оборона и события ----------
    if (action === 'war') {
      const h = await hero(), task = String(b.task); await at(h, +b.x, +b.z);
      const castle = (await cfgGet('castle')) || { damage: 0 };
      if (task === 'restore') { // восстановление замка после поражения (вне вторжения)
        if (!castle.damage) throw new Bad(409, 'ok', 'Замок цел.'); if (!near(h.x, h.z, SIEGE.wall, 3.5)) throw new Bad(409, 'far', `Иди к пролому: ${SIEGE.wall.name}.`);
        const inv2 = await sb(`inventory?nick=eq.${N}&item=in.(wood,ore)&select=item,qty`), have = inv2.filter(r => r.qty > 0)[0]; if (!have) throw new Bad(409, 'need_items', 'Нужны брёвна или руда.');
        await setItem(have.item, -1); const dmg = Math.max(0, castle.damage - 10 * ((TASKS.repair.mult[h.role]) || 1)); await cfgSet('castle', { damage: Math.round(dmg) });
        h.xp += 15; await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { xp: h.xp } }); await addCoins(5);
        if (!dmg) await chron('restored', `Замок восстановлен! Последний камень уложил @${nick}.`, nick);
        return json(200, { ...(await state(h)), note: dmg ? `Стены починены: повреждения ${Math.round(dmg)}%. +15 опыта, +5 монет.` : 'Замок полностью восстановлен!' });
      }
      const evs = await sb(`world_events?status=eq.active&select=*`);
      if (task === 'search') { const ev = evs.find(e => e.kind === 'artifact'); if (!ev) throw new Bad(409, 'no_event', 'Сейчас никто не ищет артефакт.');
        if (!near(h.x, h.z, POI_OF(ev.data.spot), 4)) throw new Bad(409, 'far', 'Здесь артефакта нет. Ищи на окраинах.');
        if ((ev.data.finders || []).includes(nick)) throw new Bad(409, 'done', 'Ты уже нашёл свою реликвию.');
        const up = await evUpdate(ev.id, c => ((c.data.finders || []).length >= c.goal || c.data.finders.includes(nick)) ? null : (c.data.finders = [...(c.data.finders || []), nick], c.progress = c.data.finders.length, c));
        if (!up.data.finders.includes(nick)) throw new Bad(409, 'late', 'Все реликвии уже нашли.');
        await setItem('ancient_relic', 1); await contrib(ev.id, 20); await chron('artifact', `@${nick} нашёл древнюю реликвию!`, nick);
        if (up.data.finders.length >= up.goal) await closeEvent(up, 'won');
        return json(200, { ...(await state(h)), note: 'Ты нашёл древнюю реликвию!' });
      }
      const ev = evs.find(e => e.kind === 'invasion'); if (!ev) throw new Bad(409, 'no_war', 'Сейчас нет вторжения.');
      if (now >= Date.parse(ev.ends_at)) { await closeEvent(ev, ev.progress >= ev.goal ? 'won' : 'lost'); return json(200, { ...(await state(h)), note: 'Битва окончена.' }); }
      const t = TASKS[task]; if (!t) throw new Bad(400, 'bad_task', 'Неизвестная задача.');
      const m = (t.mult && t.mult[h.role]) || 1, mine = await myContribRow(ev.id), d = { ...(mine.data || {}) }; let pts = 0, note = '';
      const timed = async (spot, key) => { if (!near(h.x, h.z, spot, 3.8)) throw new Bad(409, 'far', `Иди сюда: ${spot.name}.`);
        if (!d[key]) { d[key] = now; await contrib(ev.id, 0, d); return false; } if (now - d[key] < t.sec * 1000 - 500) throw new Bad(429, 'wait', `Ещё ${Math.ceil((t.sec * 1000 - (now - d[key])) / 1000)} с.`); delete d[key]; return true; };
      if (task === 'gate') { if (await timed(SIEGE.gate, 't_gate')) pts = t.base * m; else note = 'Ты встал у ворот. Держись 20 секунд!'; }
      else if (task === 'heal') { if (await timed(SIEGE.hospital, 't_heal')) { pts = t.base * m; const hs = await statsOf(h); await setHp(h, hs.hp); } else note = 'Ты перевязываешь раненых… 15 секунд.'; }
      else if (task === 'sabotage') { const mk = Object.entries(SIEGE.machines).find(([k, mm]) => near(h.x, h.z, mm, 4) && (ev.data.machines?.[k] ?? 0) > 0); if (!mk) throw new Bad(409, 'far', 'Рядом нет целой осадной машины.');
        if (await timed(mk[1], 't_sab_' + mk[0])) { const dmg = Math.round(t.dmg * m); let destroyed = false;
          await evUpdate(ev.id, c => { const hp = Math.max(0, (c.data.machines[mk[0]] ?? 0) - dmg); destroyed = hp === 0 && c.data.machines[mk[0]] > 0; c.data.machines[mk[0]] = hp; if (destroyed) c.data.machinesDown = (c.data.machinesDown || 0) + 1; return c; });
          pts = 4 * m + (destroyed ? 40 : 0); if (destroyed) await chron('war_machine', `${SIEGE.machines[mk[0]].name}: уничтожено! Решающий удар нанёс @${nick}.`, nick); }
        else note = `Ты ломаешь: ${mk[1].name}… 15 секунд.`; }
      else if (task === 'repair') { if (!near(h.x, h.z, SIEGE.wall, 3.8)) throw new Bad(409, 'far', `Иди к пролому: ${SIEGE.wall.name}.`);
        const inv2 = await sb(`inventory?nick=eq.${N}&item=in.(wood,ore)&select=item,qty`), have = inv2.filter(r => r.qty > 0)[0]; if (!have) throw new Bad(409, 'need_items', 'Нужны брёвна или руда. Собери их на карте или купи.');
        await setItem(have.item, -1); pts = t.base * m; }
      else if (task === 'supply') {
        if (!d.crate) { if (!near(h.x, h.z, SIEGE.depot, 3.5)) throw new Bad(409, 'far', 'Ящики с припасами — у торговца.'); d.crate = 1; await contrib(ev.id, 0, d); note = 'Ящик взят! Неси его к воротам.'; }
        else { if (!near(h.x, h.z, SIEGE.gate, 3.8)) throw new Bad(409, 'far', 'Неси ящик к воротам замка.'); delete d.crate; pts = t.base * m; } }
      else if (task === 'scout') { const p = SIEGE.scout.find(k => near(h.x, h.z, POI_OF(k), 4)); if (!p) throw new Bad(409, 'far', 'Иди на одну из окраин.');
        const seen = d.seen || []; if (seen.includes(p)) throw new Bad(409, 'seen', 'Эту окраину ты уже осмотрел.'); d.seen = [...seen, p]; pts = t.base * m; if (d.seen.length === 4) pts += 10; }
      else if (task === 'fight') throw new Bad(400, 'use_fight', 'Сражайся с рыцарями у стен: подойди и нажми «Сразиться».');
      if (pts) { pts = Math.round(pts); await contrib(ev.id, pts, d); const up = await evUpdate(ev.id, c => (c.progress += pts, c)); note = `Оборона: +${pts} очков${m > 1 ? ' (бонус роли)' : ''}.`; if (up.progress >= up.goal) await closeEvent(up, 'won'); }
      else if (!note) await contrib(ev.id, 0, d);
      return json(200, { ...(await state(h)), note });
    }
    // ---------- король: порядок в чате ----------
    if (action === 'chat_del') {
      if (!admin) throw new Bad(403, 'not_king', 'Это может только король.');
      if (b.id != null) await sb(`chat?id=eq.${Math.floor(+b.id)}`, { method: 'DELETE' });
      else if (b.nick) await sb(`chat?nick=eq.${enc(normalize(b.nick))}`, { method: 'DELETE' });
      else throw new Bad(400, 'bad', 'Что удалить?');
      return json(200, { note: b.id != null ? 'Сообщение удалено.' : `Все сообщения @${normalize(b.nick)} удалены.` });
    }
    if (action === 'chat_mute') {
      if (!admin) throw new Bad(403, 'not_king', 'Это может только король.');
      const who = normalize(b.nick), h = +b.hours, m = (await store.get('chat_mutes')) || {};
      if (!who) throw new Bad(400, 'bad_nick', 'Кого заглушить?');
      if (!h) delete m[who]; else m[who] = h < 0 ? -1 : now + h * 36e5; await store.set('chat_mutes', m);
      if (b.wipe) await sb(`chat?nick=eq.${enc(who)}`, { method: 'DELETE' });
      return json(200, { note: !h ? `@${who} снова может писать.` : h < 0 ? `@${who} заглушён навсегда.` : `@${who} заглушён на ${h} ч.` });
    }
    if (action === 'king_me') {
      if (!admin) throw new Bad(403, 'not_king', 'Неверный ключ короля.');
      const who = normalize(b.nick); await cfgSet('king', { nick: who });
      return json(200, { note: `👑 Король — @${who}.`, king: who });
    }
    if (action === 'admin_world') {
      if (!admin) throw new Bad(403, 'not_king', 'Это может только король.');
      if (b.config) { const c = mergeConfig(b.config); c.invasion.everyDays = Math.max(1, Math.min(30, +c.invasion.everyDays)); c.invasion.difficulty = Math.max(0.3, Math.min(3, +c.invasion.difficulty)); c.invasion.durationMin = Math.max(15, Math.min(240, +c.invasion.durationMin)); c.invasion.warnHours = Math.max(0, Math.min(24, +c.invasion.warnHours)); c.events.everyDays = Math.max(1, Math.min(30, +c.events.everyDays)); await cfgSet('main', c); }
      if (b.setLevel) { // король задаёт уровень героя: опыт ставится ровно на начало уровня
        const who = normalize(String(b.setLevel.nick || '')), lv = Math.max(1, Math.min(60, Math.floor(+b.setLevel.level || 1)));
        const [hr] = await sb(`heroes?nick=eq.${enc(who)}&select=nick`); if (!hr) throw new Bad(404, 'no_hero', `У @${who} ещё нет героя — пусть сначала зайдёт в Мир героев.`);
        const xp = 100 * (lv - 1) * lv / 2; await sb(`heroes?nick=eq.${enc(who)}`, { method: 'PATCH', body: { xp } });
        await chron('king', `👑 Указом короля @${who} получает ${lv} уровень!`, who); return json(200, { world: await worldView(), note: `@${who} теперь ${lv} уровня.` }); }
      if (b.start) { const kind = String(b.start); const cfg = mergeConfig(await cfgGet('main'));
        const cur = await sb(`world_events?kind=eq.${kind}&status=in.(scheduled,warning,active)&select=id`); for (const c of cur) await sb(`world_events?id=eq.${c.id}`, { method: 'DELETE' });
        const warn = kind === 'invasion' ? Math.max(0, Number.isFinite(+b.warnMin) ? +b.warnMin : 5) * 6e4 : 0, start = now + warn;
        const data = kind === 'artifact' ? { spot: SIEGE.scout[Math.floor(Math.random() * 4)], finders: [] } : kind === 'raid' || isBossEvent(kind) ? { lvl: await avgLevel(), wins: 0 } : {};
        const bGoal = isBossEvent(kind) ? bossGoal(kind, await activeHeroCount(), cfg.invasion.difficulty) : 0;
        await sb('world_events', { method: 'POST', body: { kind, status: kind === 'invasion' && !warn ? 'warning' : 'scheduled', starts_at: ISO(start), ends_at: ISO(start + (kind === 'invasion' ? cfg.invasion.durationMin * 6e4 : cfg.events.durationHours * 36e5)), difficulty: cfg.invasion.difficulty, progress: 0, goal: bGoal || (kind === 'raid' ? 15 : kind === 'artifact' ? 5 : 100), data, updated_at: ISO(now) } });
        await advanceWorld();
        const [ev] = await sb(`world_events?kind=eq.${kind}&status=in.(scheduled,warning,active)&select=status&order=id.desc&limit=1`);
        const nm = kind === 'invasion' ? (warn ? `Вторжение через ${Math.round(warn / 6e4)} мин` : 'Осада') : (WORLD_EVENTS[kind]?.name || kind);
        return json(200, { world: await worldView(), note: ev ? `${nm}: ${ev.status === 'active' ? 'началось!' : ev.status === 'warning' ? 'тревога объявлена.' : 'назначено.'}` : `${nm}: не удалось запустить.` }); }
      return json(200, { world: await worldView(), note: 'Указ короля исполнен.' });
    }
    // ---------- ресурсы: крафт, оружие, зелья ----------
    if (action === 'craft') {
      const r = RECIPES[b.recipe]; if (!r) throw new Bad(400, 'bad_recipe', 'Такого рецепта нет.');
      const h = await hero(); await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC[r.npc])) throw new Bad(409, 'far', `Это делает: ${NPC[r.npc].name}.`);
      const need = { ...r.need }; if (r.npc === 'kuznets' && need.ore && (await builds()).kuznya?.done) need.ore = Math.max(0, need.ore - 1);
      await pay(need); await setItem(b.recipe, 1);
      return json(200, { ...(await state(h)), note: `Готово: ${ITEMS[b.recipe].icon} ${ITEMS[b.recipe].name}!` });
    }
    if (action === 'weapon') {
      const h = await hero(); await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC.kuznets)) throw new Bad(409, 'far', 'Оружие улучшает кузнец.');
      const rp = await rpgGet(), lv = rp.wlvl || 0, max = (await builds()).kuznya?.done ? WEAPON.max : WEAPON.maxNoForge;
      if (lv >= max) throw new Bad(409, 'max', max < WEAPON.max ? `Больше +${max} кузнец не сможет. Нужна Большая кузня — постройте её всем королевством.` : 'Оружие уже лучшее в королевстве.');
      await pay(WEAPON.cost(lv)); rp.wlvl = lv + 1; await rpgSet(rp);
      return json(200, { ...(await state(h)), note: `Оружие улучшено до +${lv + 1}: атака +${WEAPON.atk}.` });
    }
    if (action === 'use') {
      const it = String(b.item), [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty`); if (!row || row.qty < 1) throw new Bad(409, 'no_item', 'Этого нет в сумке.');
      const h = await hero(), bf = BUFFS[it];
      if (bf) { const rp = await rpgGet(); rp.buffs = { ...(rp.buffs || {}), [bf.key]: Math.max(now, rp.buffs?.[bf.key] || 0) + bf.min * 6e4 }; await setItem(it, -1); await rpgSet(rp);
        return json(200, { ...(await state(h)), note: `${ITEMS[it].icon} ${ITEMS[it].name}: действует ${bf.min} минут.` }); }
      if (it === 'potion') { if (await activeFight()) throw new Bad(409, 'in_fight', 'В бою зелье пьют кнопкой боя.'); const hs = await statsOf(h), hp = hpNow(h, hs.hp);
        if (hp >= hs.hp) throw new Bad(409, 'full', 'Здоровье и так полное.'); await setItem(it, -1); await setHp(h, Math.min(hs.hp, hp + Math.round(hs.hp / 2)));
        return json(200, { ...(await state(h)), note: '🧪 Здоровье восстановлено.' }); }
      throw new Bad(400, 'not_usable', 'Это нельзя использовать.');
    }
    // ---------- общая стройка ----------
    if (action === 'build') {
      const site = BUILDS[b.site]; if (!site) throw new Bad(400, 'bad_site', 'Такой стройки нет.');
      const it = String(b.item); if (!site.need[it]) throw new Bad(400, 'bad_item', 'Это стройке не нужно.');
      const h = await hero(); await at(h, +b.x, +b.z); if (!near(h.x, h.z, site, 4.5)) throw new Bad(409, 'far', `Подойди к стройке: ${site.name}.`);
      const bl = await builds(), cur = bl[b.site] || { got: {}, top: {} }; if (cur.done) throw new Bad(409, 'done', `${site.name} уже построена.`);
      const left = site.need[it] - (cur.got[it] || 0), [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty`), have = row ? row.qty : 0;
      const n = Math.min(left, have, Math.max(1, Math.round(+b.qty || 1))); if (left <= 0) throw new Bad(409, 'enough', `${ITEMS[it].name} для стройки уже хватает.`); if (n <= 0) throw new Bad(409, 'need_items', `Нет: ${ITEMS[it].name}.`);
      await setItem(it, -n);
      const fresh = (await cfgGet('builds')) || {}, c = fresh[b.site] || { got: {}, top: {} }; c.got[it] = Math.min(site.need[it], (c.got[it] || 0) + n); c.top[nick] = (c.top[nick] || 0) + n;
      const done = Object.entries(site.need).every(([k, v]) => (c.got[k] || 0) >= v); if (done) { c.done = true; c.doneAt = now; }
      fresh[b.site] = c; await cfgSet('builds', fresh);
      h.xp += n; await sb(`heroes?nick=eq.${N}`, { method: "PATCH", body: { xp: h.xp } });
      if (done) { const best = Object.entries(c.top).sort((a, b2) => b2[1] - a[1])[0]; await chron('build', `Королевство построило: ${site.name}! ${site.bonus}. Больше всех вложил @${best[0]}.`, best[0]); }
      return json(200, { ...(await state(h)), note: done ? `🎉 ${site.name} построена! ${site.bonus}.` : `Сдано: ${ITEMS[it].name} ×${n}. +${n} опыта.` });
    }
    // ---------- укрепления перед вторжением ----------
    if (action === 'fort') {
      const it = String(b.item); if (!FORT.pts[it]) throw new Bad(400, 'bad_item', 'Для укреплений нужны брёвна или руда.');
      const h = await hero(); await at(h, +b.x, +b.z); if (!near(h.x, h.z, POI.gate, 4)) throw new Bad(409, 'far', 'Укрепления строят у ворот замка.');
      if ((await sb(`world_events?kind=eq.invasion&status=eq.active&select=id`)).length) throw new Bad(409, 'war', 'Осада уже идёт — укреплять поздно, защищай стены!');
      const fort = (await cfgGet('fort')) || { pts: 0, top: {} }; if (fort.pts >= FORT.max) throw new Bad(409, 'max', 'Укрепления уже на пределе.');
      const [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty`), have = row ? row.qty : 0;
      const n = Math.min(have, Math.max(1, Math.round(+b.qty || 1)), Math.ceil((FORT.max - fort.pts) / FORT.pts[it])); if (n <= 0) throw new Bad(409, 'need_items', `Нет: ${ITEMS[it].name}.`);
      await setItem(it, -n); fort.pts = Math.min(FORT.max, fort.pts + n * FORT.pts[it]); fort.top = { ...(fort.top || {}), [nick]: ((fort.top || {})[nick] || 0) + n }; await cfgSet('fort', fort);
      h.xp += n; await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { xp: h.xp } });
      return json(200, { ...(await state(h)), note: `Укрепления: ${Math.round(fort.pts / FORT.max * 100)}% (осада будет слабее на ${Math.round(FORT.cut * 100 * fort.pts / FORT.max)}%). +${n} опыта.` });
    }
    // ---------- украшения дома ----------
    if (action === 'decor') {
      const d = DECOR[b.id]; if (!d) throw new Bad(400, 'bad_decor', 'Такого украшения нет.');
      if (demo) throw new Bad(409, 'demo', 'В демо-режиме дома нет. Войди под своим ником.');
      const h = await hero(); await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC.rasporyaditel)) throw new Bad(409, 'far', 'Заказать украшение дома можно у Распорядителя замка.');
      const all = (await store.get('decor')) || {}; if ((all[nick] || []).includes(b.id)) throw new Bad(409, 'have', 'Это у твоего дома уже есть.');
      await pay(d.need); const fresh = (await store.get('decor')) || {}; fresh[nick] = [...new Set([...(fresh[nick] || []), b.id])]; await store.set('decor', fresh);
      return json(200, { ...(await state(h)), note: `${d.icon} ${d.name} появится у твоего дома на карте королевства.` });
    }
    // ---------- передать ресурсы товарищу по отряду ----------
    if (action === 'give') {
      const it = String(b.item), to = normalize(b.to), n = Math.max(1, Math.min(50, Math.round(+b.qty || 1)));
      if (!RES.includes(it)) throw new Bad(400, 'bad_item', 'Передавать можно только траву, брёвна и руду.');
      const sq = await mySquad(); if (!sq || to === nick || !(await members(sq.id)).some(m => m.nick === to)) throw new Bad(409, 'not_squad', 'Передавать можно только товарищам по отряду.');
      const [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty`); if (!row || row.qty < n) throw new Bad(409, 'need_items', 'У тебя столько нет.');
      await setItem(it, -n); await setItem(it, n, to);
      return json(200, { ...(await state()), note: `@${to} получил: ${ITEMS[it].name} ×${n}.` });
    }
    // ---------- заказ торговца дня ----------
    if (action === 'order') {
      const h = await hero(); await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC.torgovets)) throw new Bad(409, 'far', 'Заказ принимает торговец.');
      const rp = await rpgGet(); if (rp.orderDay === date) throw new Bad(409, 'done', 'Сегодняшний заказ уже выполнен. Завтра будет новый.');
      const o = dailyOrder(date); await pay(o.need); rp.orderDay = date; await rpgSet(rp);
      h.xp += o.xp; await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { xp: h.xp } }); await addCoins(o.coins);
      return json(200, { ...(await state(h)), note: `Заказ выполнен! +${o.coins} монет, +${o.xp} опыта.` });
    }
    if (action === 'chop') { // старое дерево на карте: координаты присылает клиент, проверяем близость и лимит за 5 минут
      const h = await hero(), x = +b.tx, z = +b.tz; if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Bad(400, 'bad_tree', 'Нет такого дерева.');
      await at(h, +b.x, +b.z); if (!near(h.x, h.z, { x, z }, 2.8)) throw new Bad(409, 'far', 'Подойди ближе к дереву.');
      const slot = slotOf(now), pre = `t:${date}:${slot}:`, done = await sb(`reward_log?nick=eq.${N}&key=like.${enc(pre)}*&select=key`);
      if (done.length >= CHOP.perSlot) throw new Bad(409, 'tired', 'Топор затупился. Отдохни пару минут — деревья никуда не денутся.');
      const extra = SPEC[h.role]?.bonusRes === 'wood' ? 1 : 0, got = CHOP.wood + extra, id = `${Math.round(x * 10)}_${Math.round(z * 10)}`;
      const ins = await sb('reward_log', { method: 'POST', body: { nick, key: pre + id, items: [['wood', got]] }, prefer: 'resolution=ignore-duplicates,return=representation' });
      if (!ins || !ins.length) throw new Bad(409, 'taken', 'Это дерево уже срублено. Вырастет через несколько минут.');
      await setItem('wood', got);
      return json(200, { ...(await state(h)), note: `🪓 +${got} ${ITEMS.wood.name}` });
    }

    if (action === 'role_buy') {
      const h = await hero(), role = String(b.role || ''), price = ROLE_PRICE[role];
      if (resident.king) throw new Bad(409, 'king', 'Король не меняет корону.');
      if (!price) throw new Bad(400, 'bad_role', 'Такую роль купить нельзя.');
      if (h.role === role) throw new Bad(409, 'same', 'У тебя уже эта роль.');
      const p = await store.get('p/' + nick); if (!p || p.coins < price) throw new Bad(409, 'poor', `Нужно ${price} монет, у тебя ${p ? p.coins : 0}.`);
      p.coins -= price; await store.set('p/' + nick, p);
      await sb(`heroes?nick=eq.${N}`, { method: 'PATCH', body: { role } }); const was = h.role; h.role = role;
      const roles = (await store.get('roles')) || {}; roles[nick] = role; await store.set('roles', roles);
      await sb('chronicle', { method: 'POST', body: { type: 'role', nick, text: `@${nick} сменил роль за ${price} монет.` } }).catch(() => null);
      return json(200, { ...(await state(h)), note: `Новая роль! Потрачено ${price} монет.`, roleChanged: { from: was, to: role } });
    }

    if (action === 'shop') {
      const h = await hero(); await at(h, +b.x, +b.z); if (!near(h.x, h.z, NPC.torgovets)) throw new Bad(409, 'far', 'Лавка у торговца на площади.');
      const it = String(b.item), qty = Math.max(1, Math.min(b.op === 'sell' ? 9999 : 50, Math.round(+b.qty || 1))); // оптом: продать до 9999, купить до 50 за раз
      const actEv = await sb(`world_events?status=eq.active&kind=eq.caravan&select=id`), [yar] = await sb(`territories?id=eq.yarmarka&select=owner`);
      const buyK = (actEv.length ? 0.7 : 1) * (yar && yar.owner === 'order' ? 1.2 : 1), sellK = actEv.length ? 1.3 : 1;
      if (b.op === 'buy') { const price = Math.round(SHOP.buy[it] * buyK); if (!SHOP.buy[it]) throw new Bad(400, 'no_item', 'Этого нет в лавке.');
        if (ITEMS[it].type === 'mount') { const [own] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty`); if (own && own.qty > 0) throw new Bad(409, 'have', 'Конь у тебя уже есть.'); if (qty > 1) throw new Bad(400, 'one', 'Коня покупают по одному.'); }
        const p = await store.get('p/' + nick); if (!p || p.coins < price * qty) throw new Bad(409, 'poor', `Нужно ${price * qty} монет.`);
        p.coins -= price * qty; await store.set('p/' + nick, p); await setItem(it, qty);
        return json(200, { ...(await state(h)), note: `Куплено: ${ITEMS[it].name} ×${qty}.` }); }
      if (b.op === 'sell') { const gear = ITEMS[it]?.type === 'gear', price0 = SHOP.sell[it] ?? (gear ? Math.round((SHOP.buy[it] || 40) / 2) : null), price = price0 == null ? null : Math.round(price0 * sellK); if (price == null) throw new Bad(400, 'no_sell', 'Это торговец не покупает.');
        const [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty,equipped`); if (!row || row.qty < qty) throw new Bad(409, 'no_item', 'У тебя столько нет.');
        if (row.equipped && row.qty - qty < 1) throw new Bad(409, 'equipped', 'Сначала сними этот предмет.');
        await setItem(it, -qty); await addCoins(price * qty);
        return json(200, { ...(await state(h)), note: `Продано: ${ITEMS[it].name} ×${qty} за ${price * qty} монет.` }); }
      throw new Bad(400, 'bad_op', 'Неизвестная сделка.');
    }
    if (action === 'market') { // рынок к востоку от замка: купцы скупают ресурсы; чем больше продаёт королевство, тем ниже цена до утра
      const h = await hero(), key = 'market/' + date, mk = (await store.get(key)) || { sold: {} }, pr = () => marketPrices(date, mk.sold, h.role);
      // ряды игроков: каждый лот — свой ключ lot/<id>; покупку и отмену защищает замок в reward_log (одна сделка на версию лота)
      const LOT_TTL = 48 * 3600e3, FEE = 0.05, MAXLOTS = 5;
      const lockLot = async l => { const r = await sb('reward_log', { method: 'POST', body: { nick: 'market', key: `lot:${l.id}:${l.v}` }, prefer: 'resolution=ignore-duplicates,return=representation' }); if (!r || !r.length) throw new Bad(409, 'busy', 'Этот лот только что купили или изменили. Обнови рынок.'); };
      const lotKeys = store.list ? await store.list('lot/') : [], lotsAll = (lotKeys.length ? await (store.getMany ? store.getMany(lotKeys) : Promise.all(lotKeys.map(k => store.get(k)))) : []).filter(l => l && l.qty > 0);
      for (const l of lotsAll) if (now - l.at > LOT_TTL) { try { await lockLot(l); await setItem(l.item, l.qty, l.seller); await inboxAdd(l.seller, { t: 'market', text: `Рынок: лот «${ITEMS[l.item]?.name || l.item}» ×${l.qty} никто не купил за 2 дня — товар вернулся к тебе.` }); l.qty = 0; l.v++; await store.set('lot/' + l.id, l); } catch { } }
      const lots = lotsAll.filter(l => l.qty > 0);
      const view = () => ({ ...pr(), stalls: MARKET_STALLS, date, lots: lots.sort((x, y) => x.item.localeCompare(y.item) || x.price - y.price || x.at - y.at).slice(0, 80).map(l => ({ id: l.id, seller: l.seller, item: l.item, qty: l.qty, price: l.price, mine: l.seller === nick })), fee: FEE, maxLots: MAXLOTS });
      if (b.op === 'view' || !b.op) return json(200, { ...(await state(h)), market: view() });
      await at(h, +b.x, +b.z); if (Math.hypot(h.x - MARKET.x, h.z - MARKET.z) > MARKET.r + 1.5) throw new Bad(409, 'far', 'Торговать можно только на рынке: он к востоку от замка.');
      const it = String(b.item), P = pr();
      if (b.op === 'sell') { const q = P.res[it]; if (!q) throw new Bad(400, 'no_sell', 'Купцы это не берут.');
        const qty = Math.max(1, Math.min(9999, Math.round(+b.qty || 1))), [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty`);
        if (!row || row.qty < qty) throw new Bad(409, 'no_item', 'У тебя столько нет.');
        // цена падает прямо во время большой сделки: считаем по частям
        let coins = 0; const st = MARKET_STALLS.find(x => x.item === it); for (let left = qty; left > 0;) { const part = Math.min(left, 25); coins += part * marketPrices(date, mk.sold, h.role).res[it].sell; mk.sold[it] = (mk.sold[it] || 0) + part; left -= part; }
        await setItem(it, -qty); await addCoins(coins); await store.set(key, mk);
        return json(200, { ...(await state(h)), market: view(), note: `${st.who}: беру! ${ITEMS[it].name} ×${qty} — ${coins} монет.` }); }
      if (b.op === 'buy') { const rare = P.rare.item === it, q = P.res[it]; if (!rare && !q) throw new Bad(400, 'no_item', 'Такого товара сегодня нет.');
        const qty = rare ? 1 : Math.max(1, Math.min(50, Math.round(+b.qty || 1))), price = (rare ? P.rare.price : q.buy) * qty;
        const p = await store.get('p/' + nick); if (!p || p.coins < price) throw new Bad(409, 'poor', `Нужно ${price} монет.`);
        p.coins -= price; await store.set('p/' + nick, p); await setItem(it, qty);
        return json(200, { ...(await state(h)), market: view(), note: `Куплено на рынке: ${ITEMS[it].name} ×${qty} за ${price} монет.` }); }
      if (b.op === 'list') { // выставить свой товар: он уходит с героя и лежит на прилавке, пока не купят (до 2 дней)
        const def = ITEMS[it]; if (!def || !(RES.includes(it) || ['consumable', 'gear'].includes(def.type))) throw new Bad(400, 'no_list', 'Это на рынок выставить нельзя.');
        if (lots.filter(l => l.seller === nick).length >= MAXLOTS) throw new Bad(409, 'many', `Не больше ${MAXLOTS} лотов сразу. Сними старый или подожди, пока купят.`);
        const qty = Math.max(1, Math.min(999, Math.round(+b.qty || 1))), cap = RES.includes(it) ? P.res[it].buy * 4 : 1000, price = Math.round(+b.price);
        if (!(price >= 1 && price <= cap)) throw new Bad(400, 'bad_price', `Цена за штуку — от 1 до ${cap} монет.`);
        const [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(it)}&select=qty,equipped`); if (!row || row.qty < qty) throw new Bad(409, 'no_item', 'У тебя столько нет.');
        if (row.equipped && row.qty - qty < 1) throw new Bad(409, 'equipped', 'Сначала сними этот предмет.');
        await setItem(it, -qty); const l = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), seller: nick, item: it, qty, price, at: now, v: 0 }; await store.set('lot/' + l.id, l); lots.push(l);
        return json(200, { ...(await state(h)), market: view(), note: `Выставлено: ${def.name} ×${qty} по ${price} монет. Деньги придут, когда купят.` }); }
      if (b.op === 'take' || b.op === 'cancel') { const l = lots.find(x => x.id === String(b.lot)); if (!l) throw new Bad(404, 'gone', 'Этого лота уже нет.');
        if (b.op === 'cancel') { if (l.seller !== nick) throw new Bad(403, 'not_yours', 'Это не твой лот.'); await lockLot(l); await setItem(l.item, l.qty); l.qty = 0; l.v++; await store.set('lot/' + l.id, l); lots.splice(lots.indexOf(l), 1);
          return json(200, { ...(await state(h)), market: view(), note: 'Лот снят, товар вернулся к тебе.' }); }
        if (l.seller === nick) throw new Bad(409, 'own', 'Свой товар купить нельзя — его можно снять.');
        const qty = Math.max(1, Math.min(l.qty, Math.round(+b.qty || 1))), total = qty * l.price;
        const p = await store.get('p/' + nick); if (!p || p.coins < total) throw new Bad(409, 'poor', `Нужно ${total} монет.`);
        await lockLot(l); p.coins -= total; await store.set('p/' + nick, p); await setItem(l.item, qty);
        l.qty -= qty; l.v++; await store.set('lot/' + l.id, l); if (!l.qty) lots.splice(lots.indexOf(l), 1);
        const got = Math.max(1, Math.floor(total * (1 - FEE))); await addCoins(got, l.seller);
        await inboxAdd(l.seller, { t: 'market', text: `Рынок: @${nick} купил у тебя ${ITEMS[l.item]?.name || l.item} ×${qty}. Тебе +${got} монет.` });
        return json(200, { ...(await state(h)), market: view(), note: `Куплено у @${l.seller}: ${ITEMS[l.item].name} ×${qty} за ${total} монет.` }); }
      throw new Bad(400, 'bad_op', 'Неизвестная сделка.');
    }
    if (action === 'equip') {
      const it = ITEMS[b.item]; if (!it || !['gear', 'artifact'].includes(it.type)) throw new Bad(400, 'bad_item', 'Это нельзя надеть.');
      const [row] = await sb(`inventory?nick=eq.${N}&item=eq.${enc(b.item)}&select=qty,equipped`); if (!row || row.qty < 1) throw new Bad(404, 'no_item', 'Этого предмета нет.');
      await sb(`inventory?nick=eq.${N}&item=eq.${enc(b.item)}`, { method: 'PATCH', body: { equipped: !row.equipped } });
      return json(200, await state());
    }
    return json(404, { error: 'unknown', message: 'Неизвестное действие.' });
  } catch (e) {
    if (e instanceof Bad) return json(e.status, { error: e.code, message: e.message });
    console.error(e); return json(500, { error: 'db', message: 'База игры временно недоступна. Попробуй позже.' });
  }
}
