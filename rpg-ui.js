// Интерфейс RPG: задания, ресурсы, маяк цели, персонаж, инвентарь, достижения. Все результаты считает сервер (или демо-движок с теми же правилами).
import { NPC, POI, ITEMS, ACH, SQUAD, SQUADQ, SHOP, RARITY, SLOTS } from './quests.mjs';
import { GEAR, gearSlot, activeGear } from './combat.mjs';
import { localCall } from './rpg-local.mjs';
import { initRes, syncSites, siteAction, buildSheet, heroExtras, wireHeroExtras } from './resursy.js';
import { arenaSheet, inArena, initArena } from './arena.js';
import { marketSheet, inMarket, initMarket } from './market.js';
import { guildSheet, initGuild } from './guild.js';
let W, K, THREE, R; // R — состояние героя из rpg.js
export const G = { state: null, busy: false, track: null, nodes: new Map(), wait: null, lastVisit: 0, sqWork: null, sqTogether: 0 };

// ---------------- связь с сервером ----------------
// запросы к серверу идут по очереди (порядок важен для позиции и наград), но ни один клик не теряется:
// пока идёт фоновое обновление, действие игрока просто встаёт за ним в очередь; повтор того же действия, пока первое в пути, не отправляется
// кнопка нажата, а героя ещё нет: пробуем загрузить его заново и говорим причину, если не вышло
async function withState(open, what) {
  if (G.state) return open();
  if (!(K.auth && K.auth()) && !R.state().demo) return W.toast(what + ' доступны подданным после входа');
  W.toast('Загружаю героя…'); const r = await act('hero', {}, true);
  if (G.state) return open();
  W.toast(r ? 'Герой не загрузился: ' + (r.data?.message || 'ошибка ' + r.status) : 'Герой ещё загружается — нажми через пару секунд');
}
let chain = Promise.resolve(); const inflight = new Set();
export function act(action, extra = {}, quiet = false) {
  const key = action === 'hero' ? 'hero' : action + ':' + JSON.stringify(extra);
  if (inflight.has(key)) return Promise.resolve(null);
  inflight.add(key); G.busy = true;
  const run = chain.then(() => send(action, extra, quiet)); chain = run.catch(() => { });
  return run.finally(() => { inflight.delete(key); G.busy = inflight.size > 0; });
}
async function send(action, extra, quiet) {
  const st = R.state();
  const body = { ...extra }; if (st.pos && ['take', 'step', 'done', 'gather', 'sq_take', 'sq_act', 'fight', 'shop', 'market', 'war', 'craft', 'weapon', 'build', 'fort', 'decor', 'order', 'chop'].includes(action)) { body.x = +st.pos.x.toFixed(2); body.z = +st.pos.z.toFixed(2); }
  let r;
  try {
    if (st.demo) r = await localCall(st.nick, action, body);
    else { const auth = K.auth && K.auth(); if (!auth) return null;
      const res = await fetch((window.KP_API || '') + '/rpg/' + action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...auth, ...body }) });
      r = { status: res.status, data: await res.json().catch(() => ({})) }; }
  } catch { r = { status: 0, data: { message: 'Нет связи с королевством. Проверь интернет.' } }; }
  if (r.status === 200) {
    if (r.data.hero) { const hadSq = G.state?.squad?.id; G.state = r.data; render(); window.RPG?.refreshHero?.(); R.worldRender && R.worldRender(); if (hadSq !== G.state.squad?.id) R.onSquadChange && R.onSquadChange(); if (W.$('sheet').classList.contains('show') && W.$('sheetBody').querySelector('#sqSheet')) squadSheet(); }
    if (r.data.levelUp) { W.toast(`🎉 Новый уровень: ${r.data.levelUp}!`); flash(); }
    else if (r.data.reward) W.toast(`Награда: +${r.data.reward.xp} опыта, +${r.data.reward.coins} монет${r.data.reward.items.length ? ', ' + r.data.reward.items.map(([i, n]) => ITEMS[i].name + (n > 1 ? ' ×' + n : '')).join(', ') : ''}`);
    else if (r.data.note && !quiet) W.toast(r.data.note);
    for (const a of r.data.achievements_new || []) setTimeout(() => W.toast(`🏅 Достижение: «${a}»`), 2700);
    if (r.data.inbox && r.data.inbox.length) { r.data.inbox.forEach((m, i) => setTimeout(() => { W.toast('🎁 ' + m.text); flash(); }, 600 + i * 4200)); K.refreshMe && !st.demo && K.refreshMe(); }
    if (r.data.reward && K.me && !st.demo) K.refreshMe && K.refreshMe();
  } else if (!quiet) W.toast(r.data.message || 'Не получилось.');
  return r;
}

// ---------------- мир: ресурсы и маяк цели ----------------
function nodeMesh(type, kind) {
  const g = new THREE.Group(), m = (geo, c, p, ol = 1.5) => W.mesh(g, geo, c, { pos: p, ol });
  if (kind === 'tree') { m(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 7), 0x6B4A2A, [0, 0.65, 0]); m(new THREE.IcosahedronGeometry(0.85, 1), 0x3F7A2C, [0, 1.75, 0]); m(new THREE.IcosahedronGeometry(0.55, 1), 0x4E8A34, [0.35, 2.2, -0.15]); m(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 9), 0x8A5A32, [0, 0.06, 0], 1); }
  else if (kind === 'rock') { m(new THREE.DodecahedronGeometry(0.7, 0), 0x8C857B, [0, 0.5, 0]); m(new THREE.DodecahedronGeometry(0.42, 0), 0x6E6862, [0.55, 0.3, 0.25]); for (const [x, y, z] of [[0.3, 0.85, 0.35], [-0.4, 0.6, 0.4], [0.1, 1.05, -0.2]]) m(new THREE.OctahedronGeometry(0.11, 0), 0xD98A3A, [x, y, z], 1); }
  else if (kind === 'bush') { m(new THREE.IcosahedronGeometry(0.5, 1), 0x4E8A34, [0, 0.38, 0]); m(new THREE.IcosahedronGeometry(0.36, 1), 0x5C9A3A, [0.35, 0.3, 0.2]); for (const [x, y, z, c] of [[0.2, 0.75, 0.2, 0xE8B931], [-0.25, 0.65, 0.25, 0xF5EBDC], [0.1, 0.6, -0.4, 0xC8102E], [0.45, 0.55, 0.35, 0xE8B931]]) m(new THREE.BoxGeometry(0.12, 0.12, 0.12), c, [x, y, z], 1); }
  else if (type === 'herb') { m(new THREE.IcosahedronGeometry(0.34, 0), 0x4E8A34, [0, 0.25, 0]); for (const [x, z, c] of [[0.18, 0.12, 0xE8B931], [-0.15, 0.18, 0xF5EBDC], [0.05, -0.2, 0xC8102E]]) m(new THREE.BoxGeometry(0.1, 0.1, 0.1), c, [x, 0.52, z], 1); }
  else if (type === 'wood') { for (const [y, z, r] of [[0.14, -0.16, 0.6], [0.14, 0.16, -0.4], [0.4, 0, 0.1]]) m(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 8).rotateZ(Math.PI / 2).rotateY(r), 0x7A4A2A, [0, y, z]); }
  else if (type === 'mushroom') { for (const [x, z, r, c] of [[0, 0, 0.26, 0xC8102E], [0.28, 0.12, 0.17, 0xB8862E], [-0.22, 0.18, 0.15, 0xC8102E]]) { m(new THREE.CylinderGeometry(r * 0.32, r * 0.42, r * 1.3, 7), 0xEFE6D2, [x, r * 0.65, z]); m(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, [x, r * 1.25, z]); } for (const [x, z] of [[0.08, 0.1], [-0.1, -0.05], [0.02, -0.14]]) m(new THREE.SphereGeometry(0.035, 6, 4), 0xF5EBDC, [x, 0.5, z], 0); }
  else if (type === 'ore') { m(new THREE.DodecahedronGeometry(0.36, 0), 0x6E6862, [0, 0.28, 0]); for (const [x, y, z] of [[0.2, 0.45, 0.1], [-0.15, 0.35, 0.22]]) m(new THREE.OctahedronGeometry(0.08, 0), 0xD98A3A, [x, y, z], 1); }
  const spark = W.mesh(g, new THREE.OctahedronGeometry(0.08, 0), new THREE.MeshBasicMaterial({ color: 0xFFF2B0 }), { pos: [0, kind === 'tree' ? 2.9 : kind === 'rock' ? 1.5 : 0.95, 0], ol: 0 }); g.userData.spark = spark; g.userData.sy = spark.position.y;
  return g;
}
function syncNodes() {
  const want = new Set();
  for (const n of G.state?.nodes || []) { want.add(n.id); let o = G.nodes.get(n.id);
    if (!o) { o = { g: nodeMesh(n.type, n.kind), n }; o.g.position.set(n.x, 0, n.z); W.scene.add(o.g); G.nodes.set(n.id, o); }
    o.n = n; o.g.visible = !n.taken; }
  for (const [id, o] of G.nodes) if (!want.has(id)) { W.scene.remove(o.g); G.nodes.delete(id); }
  // срубленные старые деревья: прячем экземпляр, в новом окне — возвращаем
  const ch = new Set(G.state?.chopped || []), M = new THREE.Matrix4(), Z = new THREE.Matrix4().makeScale(0, 0, 0), dirtyM = new Set();
  G.hidden = G.hidden || new Map();
  for (const [id, t] of G.hidden) if (!ch.has(id)) { t[3].setMatrixAt(t[4], t.m0); dirtyM.add(t[3]); G.hidden.delete(id); }
  if (ch.size) for (const t of W.TREES) { if (!t[3]) continue; const id = `${Math.round(t[0] * 10)}_${Math.round(t[1] * 10)}`; if (ch.has(id) && !G.hidden.has(id)) { t[3].getMatrixAt(t[4], M); t.m0 = M.clone(); t[3].setMatrixAt(t[4], Z); dirtyM.add(t[3]); G.hidden.set(id, t); } }
  for (const m of dirtyM) m.instanceMatrix.needsUpdate = true; if (dirtyM.size) W.redraw();
  // ресурсы возвращаются каждые 5 минут — обновить карту в начале нового окна
  const at = G.state?.respawnAt; if (at && at !== G.respawnT) { G.respawnT = at; clearTimeout(G.respawnTm); G.respawnTm = setTimeout(() => { if (R.state().on) act('hero', {}, true); }, Math.max(1000, at - Date.now() + 1500)); }
}
let beacon = null;
function makeBeacon() {
  beacon = new THREE.Group();
  beacon.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xE8B931, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })));
  beacon.children[0].position.y = 4.5;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xE8B931, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; beacon.add(ring);
  beacon.visible = false; W.scene.add(beacon);
}

// ---------------- задания: текущая цель ----------------
const active = () => (G.state?.quests || []).filter(q => q.status === 'active');
function currentStep(q) { return q.steps[q.step] || null; }
function targetOf(q) {
  const s = currentStep(q); if (!s) return { ...NPC[q.turnIn], label: `Сдай задание: ${NPC[q.turnIn].name}`, npc: q.turnIn, turnIn: true };
  if (s.t === 'visit' || s.t === 'wait') return { ...POI[s.poi], label: s.text };
  if (s.t === 'talk') return { ...NPC[s.npc], label: s.text, npc: s.npc };
  if (s.t === 'items') { const have = (G.state.inventory.find(i => i.item === s.item) || {}).qty || 0; return { label: `${s.text} (есть ${have})`, items: s }; }
}
// ---------------- отряд ----------------
export const sqActive = () => G.state?.squad?.quests.find(q => q.status === 'active') || null;
function sqTarget(q) {
  const st = q.stages[q.row.stage]; if (!st) return null; const pr = q.row.progress || {};
  if (st.t === 'team_visit') { const left = st.pois.filter(p => !(pr.v || []).includes(p)), pos = R.state().pos;
    const nearest = left.map(p => ({ p, d: pos ? Math.hypot(POI[p].x - pos.x, POI[p].z - pos.z) : 0 })).sort((a, b) => a.d - b.d)[0];
    return nearest ? { ...POI[nearest.p], label: `${st.text}: найдено ${(pr.v || []).length} из ${st.pois.length}` } : null; }
  if (st.t === 'team_items') return { ...NPC[st.npc], npc: st.npc, label: `${st.text}: сдано ${pr.n || 0} из ${st.n}` };
  if (st.t === 'team_wait') return { ...POI[st.poi], label: `${st.text}: ${pr.sec || 0} из ${st.total} с` };
  if (st.t === 'together') return { ...POI[st.poi], label: `${st.text}: на месте ${Object.keys(pr.in || {}).length} из ${R.state().demo ? 1 : st.min}` };
}
const left = iso => { const ms = Date.parse(iso) - Date.now(); if (ms <= 0) return 'время вышло'; const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`; };
function squadSheet() {
  const s = G.state; if (!s) return; const sq = s.squad, online = R.online ? R.online() : new Map();
  let html = '<div id="sqSheet"></div>';
  if (!sq) {
    html += `<h2>Отряд</h2>${s.invites.length ? s.invites.map(i => `<div class="qcard"><h3>«${esc(i.name)}»</h3><p>@${esc(i.from_nick)} зовёт тебя в отряд.</p><div class="row" style="display:flex;gap:8px"><button class="btn btn-gold" type="button" data-acc="${i.id}">Вступить</button><button class="btn btn-paper" type="button" data-dec="${i.id}">Отказаться</button></div></div>`).join('') : ''}
      <p>Отряд — это друзья для совместных заданий. Создай свой или прими приглашение.</p>
      <label class="field"><span>Название отряда</span><input id="sqName" maxlength="24" placeholder="Например: Львы севера"></label>
      <label class="field"><span>Сколько героев (2–${SQUAD.maxSize})</span><select id="sqSize">${Array.from({ length: SQUAD.maxSize - 1 }, (_, i) => i + 2).map(n => `<option ${n === SQUAD.defaultSize ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="btn btn-gold" type="button" id="sqCreate" style="width:100%">Создать отряд</button>`;
  } else {
    const lead = sq.leader === s.hero.nick, aq = sqActive();
    html += `<h2>Отряд «${esc(sq.name)}»</h2><p class="rw">Командир: @${esc(sq.leader)} · героев ${sq.members.length} из ${sq.max}${lead ? ` · <button class="link" type="button" id="sqResize">изменить размер</button>` : ''}</p>
      <div class="ach">${sq.members.map(m => { const r = W.ROLES.find(x => x.id === m.role) || W.ROLES[0], on = m.nick === s.hero.nick || online.has(m.nick);
        return `<div>${on ? '🟢' : '⚪'} <span style="flex:1"><b>@${esc(m.nick)}</b>${m.nick === sq.leader ? ' 👑' : ''}<br>${r.name} · ур. ${m.level}</span>${lead && m.nick !== s.hero.nick ? `<button class="btn btn-paper" type="button" data-kick="${esc(m.nick)}" style="padding:4px 8px;font-size:12px">Исключить</button>` : ''}</div>`; }).join('')}</div>
      ${sq.members.length < sq.max ? `<form id="sqInv" style="display:flex;gap:6px;margin-top:10px"><input id="sqTo" list="sqOnline" placeholder="ник героя" autocomplete="off" style="flex:1;min-width:0;border-radius:10px;border:2px solid rgba(245,235,220,.25);background:rgba(0,0,0,.25);color:var(--paper);padding:8px"><datalist id="sqOnline">${[...online.keys()].map(n => `<option value="${esc(n)}">`).join('')}</datalist><button class="btn btn-gold" type="submit">Позвать</button></form>` : ''}
      <h2 style="font-size:22px;margin-top:14px">Совместные задания</h2>
      ${aq ? `<div class="qcard"><span class="tag">Идёт</span><h3>${esc(aq.title)}</h3><p class="rw">Осталось: ${left(aq.row.ends_at)}</p><ol>${aq.stages.map((st, i) => `<li class="${i < aq.row.stage ? 'ok' : i === aq.row.stage ? 'now' : ''}">${esc(st.text)}${i === aq.row.stage ? ' — ' + esc((sqTarget(aq) || {}).label?.split(': ').pop() || '') : ''}</li>`).join('')}</ol>
        <p class="rw">Вклад: ${Object.entries(aq.row.contrib || {}).sort((a, b) => b[1] - a[1]).map(([n, v]) => `@${esc(n)} ${v}`).join(' · ') || 'пока никто'}</p><p class="rw">Бонусы ролей на этапе: ${Object.entries(aq.stages[aq.row.stage]?.mult || {}).map(([r, m]) => `${W.ROLES.find(x => x.id === r).name} ×${m}`).join(', ') || 'нет'}</p></div>` : ''}
      ${sq.quests.filter(q => !aq || q.id !== aq.id).map(q => `<div class="qcard"><span class="tag">${q.status === 'done' ? 'Выполнено' : q.status === 'failed' ? 'Провалено' : 'Можно взять'}</span><h3>${esc(q.title)}</h3><p>${esc(q.text)}</p><div class="rw">Каждому участнику: ${q.reward.xp} опыта, ${q.reward.coins} монет, ${q.reward.items.map(([i]) => ITEMS[i].name).join(', ')}; лучшему +30%. Время: ${q.hours} ч. Взять может любой из отряда у NPC: ${NPC[q.giver].name}.</div></div>`).join('')}
      <button class="btn btn-paper" type="button" id="sqLeave" style="width:100%;margin-top:6px">Выйти из отряда</button>`;
  }
  openSheet(html, b => {
    b.querySelectorAll('[data-acc]').forEach(x => x.onclick = () => act('squad_answer', { invite: +x.dataset.acc, accept: true }));
    b.querySelectorAll('[data-dec]').forEach(x => x.onclick = () => act('squad_answer', { invite: +x.dataset.dec, accept: false }));
    b.querySelectorAll('[data-kick]').forEach(x => x.onclick = () => act('squad_kick', { who: x.dataset.kick }));
    const c = b.querySelector('#sqCreate'); if (c) c.onclick = () => act('squad_create', { name: b.querySelector('#sqName').value, size: +b.querySelector('#sqSize').value });
    const f = b.querySelector('#sqInv'); if (f) f.onsubmit = e => { e.preventDefault(); act('squad_invite', { to: b.querySelector('#sqTo').value }); };
    const l = b.querySelector('#sqLeave'); if (l) l.onclick = () => act('squad_leave');
    const rs = b.querySelector('#sqResize'); if (rs) rs.onclick = () => { const n = +prompt(`Сколько героев в отряде (2–${SQUAD.maxSize})?`, sq.max); if (n) act('squad_size', { size: n }); };
    b.querySelectorAll('input').forEach(i => { i.addEventListener('keydown', e => e.stopPropagation()); i.addEventListener('keyup', e => e.stopPropagation()); });
  });
}
export function shopSheet(back) {
  const s = G.state; if (!s) return; const have = it => (s.inventory.find(i => i.item === it) || {}).qty || 0;
  const sellable = s.inventory.filter(i => i.qty > 0 && (SHOP.sell[i.item] != null || (ITEMS[i.item]?.type === 'gear' && !i.equipped)));
  const priceOf = it => SHOP.sell[it] ?? Math.round((SHOP.buy[it] || 40) / 2), sellMax = i => i.equipped ? i.qty - 1 : i.qty;
  const res = sellable.filter(i => ['herb', 'wood', 'ore'].includes(i.item)), resSum = res.reduce((a, i) => a + priceOf(i.item) * i.qty, 0);
  const sb = (attr, txt, cls, dis) => `<button class="btn ${cls}" type="button" ${attr} style="padding:5px 9px;font-size:13px" ${dis ? 'disabled' : ''}>${txt}</button>`;
  openSheet(`<h2>Лавка торговца</h2><p>У тебя 🪙 ${K.fmt(s.coins)} монет. Торговец берёт и продаёт оптом.</p><h2 style="font-size:20px">Купить</h2>
    <div class="ach">${Object.entries(SHOP.buy).map(([it, pr]) => `<div><span style="font-size:22px">${ITEMS[it].icon}</span><span style="flex:1"><b>${ITEMS[it].name}</b><br>${pr} монет${ITEMS[it].type === 'mount' ? ' · ездить в 1,6–1,9 раза быстрее' : ` · у тебя ${have(it)}`}</span><span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${ITEMS[it].type === 'mount' ? (have(it) ? '<b style="font-size:13px">✅ Твой</b>' : sb(`data-buy="${it}" data-q="1"`, 'Купить', 'btn-gold', s.coins < pr)) : [1, 5, 10].map(q => sb(`data-buy="${it}" data-q="${q}"`, q === 1 ? 'Купить' : '×' + q, 'btn-gold', s.coins < pr * q)).join('')}</span></div>`).join('')}</div>
    <h2 style="font-size:20px;margin-top:12px">Продать</h2>${res.length ? `<p>${sb('data-sellres', `💰 Продать все ресурсы за ~${resSum} 🪙`, 'btn-gold', false)}</p>` : ''}${sellable.length ? `<div class="ach">${sellable.map(i => { const pr = priceOf(i.item), mx = sellMax(i);
      return `<div><span style="font-size:22px">${ITEMS[i.item].icon}</span><span style="flex:1"><b>${ITEMS[i.item].name}</b> ×${i.qty}<br>${pr} монет за штуку</span><span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${sb(`data-sell="${i.item}" data-q="1"`, 'Продать', 'btn-paper', mx < 1)}${mx >= 10 ? sb(`data-sell="${i.item}" data-q="10"`, '×10', 'btn-paper') : ''}${mx > 1 ? sb(`data-sell="${i.item}" data-q="${mx}"`, `Все ×${mx} · ${pr * mx} 🪙`, 'btn-paper') : ''}</span></div>`; }).join('')}</div>` : '<p>Продавать пока нечего.</p>'}
    ${back ? '<button class="btn btn-paper" type="button" id="shopBack" style="width:100%;margin-top:10px">Назад</button>' : ''}`,
    b => { b.querySelectorAll('[data-buy]').forEach(x => x.onclick = async () => { x.disabled = true; await act('shop', { op: 'buy', item: x.dataset.buy, qty: +x.dataset.q }); shopSheet(back); });
      b.querySelectorAll('[data-sell]').forEach(x => x.onclick = async () => { x.disabled = true; await act('shop', { op: 'sell', item: x.dataset.sell, qty: +x.dataset.q }); shopSheet(back); });
      const all = b.querySelector('[data-sellres]'); if (all) all.onclick = async () => { all.disabled = true; for (const i of res) await act('shop', { op: 'sell', item: i.item, qty: i.qty }); shopSheet(back); };
      const bb = b.querySelector('#shopBack'); if (bb) bb.onclick = back; });
}
export function setFoe(x) { G.foe = x; }
export function npcInfo(id) {
  const qs = G.state?.quests || [];
  return { offer: qs.filter(q => q.giver === id && q.status === 'available'), turnIn: active().filter(q => !currentStep(q) && q.turnIn === id),
    talk: active().filter(q => { const s = currentStep(q); return s && s.t === 'talk' && s.npc === id; }), locked: qs.filter(q => q.giver === id && q.status === 'locked' && q.kind !== 'daily'),
    sqOffer: (G.state?.squad && !sqActive()) ? G.state.squad.quests.filter(q => q.giver === id && q.status === 'available') : [],
    sqItems: (() => { const a = sqActive(), st = a && a.stages[a.row.stage]; return st && st.t === 'team_items' && st.npc === id ? { q: a, st } : null; })() };
}

// ---------------- интерфейс ----------------
function css() {
  const c = document.createElement('style'); c.textContent = `
  #hud .lv { display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; } #hud .lv i { display: block; width: 70px; height: 6px; border-radius: 9px; background: rgba(245,235,220,.2); overflow: hidden; } #hud .lv i b { display: block; height: 100%; background: var(--gold); }
  #hudBtns { display: flex; gap: 6px; } #hudBtns .btn { padding: 6px 9px; font-size: 13px; }
  #tracker { position: fixed; z-index: 3; right: max(10px, env(safe-area-inset-right)); top: max(10px, env(safe-area-inset-top)); width: min(270px, 46vw); display: none; padding: 9px 11px; border-radius: 14px; font-size: 12.5px; line-height: 1.35; cursor: pointer; }
  body.playing #tracker.has { display: block; } #tracker b { display: block; color: var(--gold); font-size: 13px; } #tracker small { display: block; color: var(--muted); font-weight: 700; margin-top: 2px; } #tracker div + div { margin-top: 7px; padding-top: 7px; border-top: 1px solid rgba(245,235,220,.15); }
  #tracker { transform: scale(.6); transform-origin: 100% 0; } /* трекер заданий на 65 % меньше по площади */
  @media (max-width: 560px) { #tracker { width: 62vw; transform-origin: 100% 0; } #hud { flex-wrap: wrap; } #hudBtns { display: contents; } #hud .btn { padding: 6px 8px; font-size: 12.5px; } }
  #actBtn { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); bottom: calc(max(14px, env(safe-area-inset-bottom)) + 96px); padding: 10px 16px; font-size: 15px; }
  @media (pointer: coarse) { #actBtn { left: auto; right: max(16px, env(safe-area-inset-right)); transform: none; bottom: calc(max(18px, env(safe-area-inset-bottom)) + 178px); } } /* над «Поговорить» и чатом */
  body:not(.playing) #actBtn, body.carded #actBtn { display: none; }
  #actBtn[hidden], #talk[hidden] { display: none !important; }
  .qcard { background: rgba(245,235,220,.07); border: 2px solid rgba(245,235,220,.14); border-radius: 14px; padding: 11px 12px; margin-bottom: 10px; }
  .qcard h3 { margin: 0 0 4px; font-family: var(--f-display); font-weight: 400; font-size: 20px; color: var(--paper); } .qcard .tag { display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--ink); background: var(--gold); border-radius: 6px; padding: 1px 6px; margin-right: 6px; }
  .qcard p { margin: 4px 0 !important; font-size: 13.5px; } .qcard ol { margin: 6px 0; padding-left: 20px; font-size: 13.5px; } .qcard li.ok { color: #9fd17a; text-decoration: line-through; } .qcard li.now { color: var(--gold); font-weight: 800; }
  .qcard .rw { font-size: 12.5px; color: var(--muted); font-weight: 700; } .qcard .btn { margin-top: 8px; width: 100%; padding: 9px; font-size: 14px; }
  .inv { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; margin-bottom: 12px; }
  .inv button { background: rgba(245,235,220,.08); border: 2px solid rgba(245,235,220,.16); border-radius: 12px; padding: 8px 4px; color: var(--paper); font-size: 12px; font-weight: 700; display: grid; gap: 2px; justify-items: center; cursor: pointer; }
  .inv button[style*='--rc'] { border-color: color-mix(in srgb, var(--rc) 55%, transparent); } .inv button em { font-style: normal; font-size: 10.5px; color: var(--rc, var(--paper)); } .slt { font-size: 12px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin: 6px 0 4px; }
  .inv button.eq { border-color: var(--gold); background: rgba(232,185,49,.14); } .inv .ic { font-size: 24px; line-height: 1.1; } .inv small { color: var(--muted); font-size: 11px; }
  .ach { display: grid; gap: 6px; } .ach div { display: flex; gap: 8px; align-items: center; font-size: 13px; padding: 6px 8px; border-radius: 10px; background: rgba(245,235,220,.06); } .ach div.no { opacity: .45; }
  .xpbar { height: 10px; border-radius: 9px; background: rgba(245,235,220,.18); border: 2px solid var(--ink); overflow: hidden; margin: 4px 0 12px; } .xpbar i { display: block; height: 100%; background: var(--gold); }
  #lvflash { position: fixed; inset: 0; z-index: 8; pointer-events: none; background: radial-gradient(circle, rgba(232,185,49,.45), transparent 60%); opacity: 0; transition: opacity .6s; } #lvflash.on { opacity: 1; }`;
  document.head.appendChild(c);
}
function flash() { const f = W.$('lvflash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 900); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = { daily: 'Ежедневное', story: 'Сюжет', role: 'Задание роли', repeat: 'Повторяемое', rare: 'Редкое' };
const rewardText = q => `Награда: ${q.reward.xp} опыта, ${q.reward.coins} монет${(q.reward.items || []).length ? ', ' + q.reward.items.map(([i]) => ITEMS[i].name).join(', ') : ''}`;
function qcard(q, btn) {
  return `<div class="qcard"><span class="tag">${KIND[q.kind] || ''}</span><h3>${esc(q.title)}</h3><p>${esc(q.text)}</p>
    ${q.status === 'active' ? `<ol>${q.steps.map((s, i) => `<li class="${i < q.step ? 'ok' : i === q.step ? 'now' : ''}">${esc(s.text)}</li>`).join('')}<li class="${q.step >= q.steps.length ? 'now' : ''}">Сдай: ${NPC[q.turnIn].name}</li></ol>` : ''}
    <div class="rw">${rewardText(q)} · выдаёт: ${NPC[q.giver].name}</div>${btn || ''}</div>`;
}
// снаряжение по слотам с редкостью и характеристиками; остальное — сумка
const GS = { atk: '⚔', def: '🛡', hp: '❤', dodge: '💨', crit: '💥' };
export const gearText = id => Object.entries(GEAR[id] || {}).map(([k, v]) => `${GS[k]}${v > 0 ? '+' : ''}${k === 'dodge' || k === 'crit' ? Math.round(v * 100) + '%' : v}`).join(' ');
function invHtml(s) {
  if (!s.inventory.length) return '<h2 style="font-size:22px">Инвентарь</h2><p>Пока пусто. Собирай ресурсы и выполняй задания.</p>';
  const gear = s.inventory.filter(i => GEAR[i.item]), act = new Set(activeGear(gear.filter(i => i.equipped).map(i => i.item))), rest = s.inventory.filter(i => !GEAR[i.item]);
  const card = i => { const it = ITEMS[i.item] || { name: i.item, icon: '❔', type: 'res' }, wear = ['gear', 'artifact'].includes(it.type), r = RARITY[it.rar];
    return `<button type="button" data-it="${i.item}" class="${i.equipped ? 'eq' : ''}" ${wear ? '' : 'disabled'} style="${r ? `--rc:${r.color}` : ''}"><span class="ic">${it.icon}</span>${it.name}${GEAR[i.item] ? `<em>${gearText(i.item)}</em>` : ''}<small>${wear ? (i.equipped ? (act.has(i.item) || !GEAR[i.item] ? 'надето' : 'надето · не работает') : (r ? r.name + ' · надеть' : 'надеть')) : '×' + i.qty}</small></button>`; };
  const bySlot = Object.keys(SLOTS).map(sl => [sl, gear.filter(i => gearSlot(i.item) === sl).sort((a, b) => (b.equipped - a.equipped))]).filter(([, l]) => l.length);
  return `<h2 style="font-size:22px">Снаряжение</h2>${bySlot.length ? bySlot.map(([sl, l]) => `<div class="slt">${SLOTS[sl].name}</div><div class="inv">${l.map(card).join('')}</div>`).join('') : '<p class="rw">Пока нет снаряжения: закажи меч у кузнеца Гордея или купи на рынке.</p>'}
    ${rest.length ? `<h2 style="font-size:22px">Сумка</h2><div class="inv">${rest.map(card).join('')}</div>` : ''}`;
}
export function openSheet(html, after) { W.$('sheetBody').innerHTML = html; W.$('sheet').classList.add('show'); after && after(W.$('sheetBody')); }

function questLog() {
  const qs = G.state?.quests || [], a = qs.filter(q => q.status === 'active'), av = qs.filter(q => q.status === 'available'), dn = qs.filter(q => q.status === 'done');
  openSheet(`<h2>Мои задания</h2>${a.length ? a.map(q => qcard(q, G.track === q.id ? '' : `<button class="btn btn-paper" data-tr="${q.id}" type="button">Следить за этим заданием</button>`)).join('') : '<p>Активных заданий нет. Подойди к NPC с золотым значком и спроси: «Есть задание?»</p>'}
    ${av.length ? `<h2 style="margin-top:14px">Можно взять</h2>${av.map(q => `<div class="qcard"><span class="tag">${KIND[q.kind]}</span><h3>${esc(q.title)}</h3><div class="rw">У NPC: ${NPC[q.giver].name} · ${rewardText(q)}</div></div>`).join('')}` : ''}
    ${dn.length ? `<p class="rw" style="margin-top:12px">Выполнено: ${dn.map(q => esc(q.title)).join(', ')}</p>` : ''}`,
    b => b.querySelectorAll('[data-tr]').forEach(x => x.onclick = () => { G.track = x.dataset.tr; render(); questLog(); }));
}
function hero() {
  const s = G.state; if (!s) return; const h = s.hero, role = W.ROLES.find(r => r.id === h.role), eq = new Set(s.inventory.filter(i => i.equipped).map(i => i.item));
  const got = new Map(s.achievements.map(a => [a.ach_id, a]));
  openSheet(`<div class="npchead"><div>${W.crest(role, 52)}</div><div><small>${role.name} · ${h.spec.title}</small><h2>@${esc(h.nick)}</h2></div></div>
    <p><b>Уровень ${h.level}</b> · опыт ${h.into} / ${h.need} · монеты ${K.fmt(s.coins)}</p><div class="xpbar"><i style="width:${(100 * h.into / h.need).toFixed(1)}%"></i></div>
    <p class="rw">Специализация роли: <b style="color:var(--gold)">${h.spec.title}</b>: ${h.spec.text}.</p>
    ${s.combat ? `<div class="qcard"><h3>Бой</h3><p>❤ Здоровье ${s.combat.hp}/${s.combat.maxHp} · ⚔ Атака ${s.combat.stats.atk} · 🛡 Броня ${s.combat.stats.def} · 💨 Уворот ${Math.round(s.combat.stats.dodge * 100)}% · 💥 Крит ${Math.round(s.combat.stats.crit * 100)}%</p>
      <p>Способность роли: <b style="color:var(--gold)">«${s.combat.ability.name}»</b> — ${s.combat.ability.text} (раз в ${s.combat.ability.cd} с). Зелий: ${s.combat.potions}.</p></div>` : ''}
    ${invHtml(s)}
    <p class="rw">Надетое снаряжение усиливает героя в бою: в каждом слоте работает одна вещь, амулетов — до трёх. Новое оружие куёт кузнец, редкое выпадает с врагов и боссов, а ещё его продают на рынке. Здоровье восстанавливается само вне боя.</p>
    ${heroExtras()}
    <h2 style="font-size:22px">Достижения</h2><div class="ach">${Object.entries(ACH).map(([id, a]) => `<div class="${got.has(id) ? '' : 'no'}">${got.has(id) ? '🏅' : '🔒'} <span><b>${a.name}</b><br>${a.text}</span></div>`).join('')}</div>`,
    b => { b.querySelectorAll('[data-it]').forEach(x => x.onclick = async () => { await act('equip', { item: x.dataset.it }, true); hero(); }); wireHeroExtras(b, hero); });
}

export function render() {
  const s = G.state; if (!s) return; const h = s.hero;
  W.$('hudRole').innerHTML = `${W.ROLES.find(r => r.id === h.role).name}`; const lv = W.$('hudLv'); lv.hidden = false; const cb = s.combat; lv.innerHTML = `ур. ${h.level} <i><b style="width:${(100 * h.into / h.need).toFixed(0)}%"></b></i> ❤ ${cb ? cb.hp + '/' + cb.maxHp : ''} 🪙 ${K.fmt(s.coins)}`;
  syncNodes();
  const a = active(), sqa = sqActive(); if (!a.find(q => q.id === G.track) && !(G.track === 'squad' && sqa)) G.track = sqa ? 'squad' : a[0]?.id || null;
  const tr = W.$('tracker'); tr.classList.toggle('has', a.length > 0 || !!sqa);
  if (innerWidth <= 560) { let y = 10; for (const id of ['hud', 'warBanner']) { const e = W.$(id); if (e && !e.hidden && getComputedStyle(e).display !== 'none') { const r = e.getBoundingClientRect(); if (r.height) y = Math.max(y, r.bottom); } } tr.style.top = (y + 6) + 'px'; } else tr.style.top = ''; // телефон: справа сверху, под панелью и оповещениями
  const dist = t => t && t.x != null && R.state().pos ? `<small>≈ ${Math.round(Math.hypot(t.x - R.state().pos.x, t.z - R.state().pos.z))} м</small>` : '';
  const sqT = sqa && sqTarget(sqa);
  tr.innerHTML = (sqa ? `<div><b>👥 ${esc(sqa.title)}${G.track === 'squad' ? ' ◆' : ''}</b>${esc(sqT ? sqT.label : '')}${dist(sqT)}<small>Осталось: ${left(sqa.row.ends_at)}</small></div>` : '') +
    a.slice(0, sqa ? 2 : 3).map(q => { const t = targetOf(q); return `<div><b>${esc(q.title)}${q.id === G.track ? ' ◆' : ''}</b>${esc(t.label)}${dist(t)}</div>`; }).join('');
  R.npcMarks && R.npcMarks(); syncSites();
}

// ---------------- цикл: близость к целям ----------------
let actTarget = null;
export function tick(now, dt) {
  const st = R.state(); if (!st.on || !st.pos || !G.state) { beacon && (beacon.visible = false); return; }
  if (G.chop && st.hero) { const k = (now - G.chop.t0) / 433, ph = k % 1, u = st.hero.userData; u.armR.rotation.x = ph < 0.6 ? -2.6 * ph / 0.6 : -2.6 + 3.2 * (ph - 0.6) / 0.4; u.armL.rotation.x = u.armR.rotation.x * 0.6;
    st.hero.rotation.y = Math.atan2(G.chop.o.n.x - st.pos.x, G.chop.o.n.z - st.pos.z); const hit = ph > 0.85 ? Math.sin((ph - 0.85) / 0.15 * Math.PI) : 0; G.chop.o.g.rotation.z = hit * 0.06; G.chop.o.g.position.x = G.chop.o.n.x + hit * 0.04; }
  for (const o of G.nodes.values()) if (o.g.visible) { o.g.userData.spark.rotation.y += dt * 3; o.g.userData.spark.position.y = o.g.userData.sy + Math.sin(now / 300) * 0.06; }
  const sqa = sqActive(), q = active().find(q => q.id === G.track), t = G.track === 'squad' && sqa ? sqTarget(sqa) : q && targetOf(q);
  if (beacon) { if (t && t.x != null) { beacon.visible = true; beacon.position.set(t.x, 0, t.z); beacon.children[1].scale.setScalar(1 + Math.sin(now / 250) * 0.08); } else beacon.visible = false; }
  // автоматическое «дошёл» для шагов «посети»
  for (const aq of active()) { const s = currentStep(aq);
    if (s && s.t === 'visit' && Math.hypot(st.pos.x - POI[s.poi].x, st.pos.z - POI[s.poi].z) < 3 && now - G.lastVisit > 2500) { G.lastVisit = now; act('step', { quest: aq.id }); break; } }
  // кнопка действия: собрать ресурс или встать на пост
  let best = null;
  for (const o of G.nodes.values()) if (o.g.visible && Math.hypot(st.pos.x - o.n.x, st.pos.z - o.n.z) < (o.n.kind === 'tree' || o.n.kind === 'rock' ? 2.6 : 2.2)) { best = { kind: 'gather', id: o.n.id, label: o.n.kind === 'tree' ? `🪓 Срубить дерево (+${o.n.n} 🪵)` : o.n.kind === 'rock' ? `⛏ Разбить камень (+${o.n.n} 🪨)` : `${ITEMS[o.n.type].icon} Собрать: ${ITEMS[o.n.type].name}` }; break; }
  if (!best && W.TREES && (!G.trScan || now - G.trScan > 200)) { G.trScan = now; G.nearTree = null; let bd = 2.2;
    for (const t of W.TREES) { if (!t[3]) continue; const d = Math.hypot(st.pos.x - t[0], st.pos.z - t[1]); if (d < bd && !G.hidden?.has(`${Math.round(t[0] * 10)}_${Math.round(t[1] * 10)}`)) { bd = d; G.nearTree = t; } } }
  if (!best && G.nearTree) best = { kind: 'chop', id: G.nearTree[0] + ',' + G.nearTree[1], label: '🪓 Срубить дерево (+2 🪵)' };
  if (!best) for (const aq of active()) { const s = currentStep(aq); if (s && s.t === 'wait' && Math.hypot(st.pos.x - POI[s.poi].x, st.pos.z - POI[s.poi].z) < 3.6) {
    if (G.wait && G.wait.q === aq.id) { const left = Math.max(0, Math.ceil((G.wait.until - now) / 1000)); best = { kind: 'wait', id: aq.id, label: left ? `⏳ На посту… ${left} с` : '✅ Сдать пост', ready: !left }; }
    else best = { kind: 'wait0', id: aq.id, label: `🛡️ Встать на пост (${s.sec} с)` }; break; } }
  // совместное задание: подсказки находятся сами, работа и сбор — кнопкой
  if (sqa) { const st = sqa.stages[sqa.row.stage], pr = sqa.row.progress || {};
    if (st && st.t === 'team_visit' && now - G.lastVisit > 2500) { const poi = st.pois.find(p => !(pr.v || []).includes(p) && Math.hypot(POI[p].x - st0(st).x, POI[p].z - st0(st).z) < 3); if (poi) { G.lastVisit = now; act('sq_act', {}); } }
    if (!best && st && st.t === 'team_wait' && Math.hypot(POI[st.poi].x - R.state().pos.x, POI[st.poi].z - R.state().pos.z) < 3.6) {
      if (G.sqWork && G.sqWork.q === sqa.row.id) { const l = Math.max(0, Math.ceil((G.sqWork.until - now) / 1000)); best = { kind: 'sqwork', label: l ? `⛏ Работаешь… ${l} с` : '✅ Сдать работу', ready: !l }; }
      else best = { kind: 'sqwork0', label: '⛏ Работать вместе (15 с)' }; }
    if (!best && st && st.t === 'together' && Math.hypot(POI[st.poi].x - R.state().pos.x, POI[st.poi].z - R.state().pos.z) < 3.6)
      best = { kind: 'together', label: now - G.sqTogether < 30000 ? '🤝 Ждём остальных…' : '🤝 Я на месте!', ready: now - G.sqTogether >= 30000 };
    if (G.sqWork && (!best || !best.kind.startsWith('sqwork'))) G.sqWork = null; }
  if (!best) best = siteAction(st.pos);
  if (!best && R.warAction) { const wa = R.warAction(st, now); if (wa) best = wa; }
  if (!best && G.foe) best = { kind: 'foe', id: G.foe.id, label: G.foe.label };
  if (!best && !G.state.combat?.fight && inArena(st.pos)) best = { kind: 'arena', label: '🏟 Арена: бросить вызов' };
  if (!best && !G.state.combat?.fight && inMarket(st.pos)) best = { kind: 'market', label: '🛒 Рынок: торговать' };
  if (G.wait && (!best || best.id !== G.wait.q)) G.wait = null; // ушёл с поста — отсчёт заново
  const b = W.$('actBtn'); actTarget = best;
  if (best) { b.hidden = false; const pend = G.actPending && G.actPending === (best.kind + ':' + (best.id || '')); const lab = pend ? '⏳ ' + best.label.replace(/^\S+\s/, '') : best.label;
    if (b.textContent !== lab) b.textContent = lab; b.disabled = pend || ((['wait', 'sqwork', 'together'].includes(best.kind) || (best.kind === 'war' && best.timed)) && !best.ready); } else b.hidden = true;
  if (now - (G.trT || 0) > 1000) { G.trT = now; render(); }
}
async function onAct() {
  const t = actTarget; if (!t || G.actPending) return;
  G.actPending = t.kind + ':' + (t.id || ''); tick(performance.now(), 0); // сразу показать «⏳», не дожидаясь ответа сервера
  try { await doAct(t); } finally { G.actPending = null; }
}
async function doAct(t) {
  if (t.kind === 'build') { buildSheet(t.id); return; }
  if (t.kind === 'arena') { await arenaSheet(); return; }
  if (t.kind === 'market') { await marketSheet(); return; }
  if (t.kind === 'foe') { G.startFight && await G.startFight(t.id); return; }
  if (t.kind === 'war') { R.doWar && await R.doWar(t); return; }
  if (t.kind === 'chop') { const tr = G.nearTree; if (!tr) return; G.chop = { t0: performance.now(), o: { n: { x: tr[0], z: tr[1] }, g: { rotation: {}, position: {} } } }; await new Promise(r => setTimeout(r, 1300)); G.chop = null;
    await act('chop', { tx: tr[0], tz: tr[1] }); G.nearTree = null; return; }
  if (t.kind === 'gather') { const o = G.nodes.get(t.id);
    if (o && (o.n.kind === 'tree' || o.n.kind === 'rock')) { G.chop = { t0: performance.now(), o }; await new Promise(r => setTimeout(r, 1300)); G.chop = null; o.g.rotation.z = 0; o.g.position.x = o.n.x; } // три удара топором или киркой
    if (o) o.g.visible = false; const r = await act('gather', { node: t.id }); if (o && (!r || r.status !== 200)) render(); }
  else if (t.kind === 'wait0') { const q = active().find(q => q.id === t.id), s = currentStep(q); const r = await act('step', { quest: t.id }); if (r && r.status === 200) G.wait = { q: t.id, until: performance.now() + s.sec * 1000 }; }
  else if (t.kind === 'wait' && t.ready) { const r = await act('step', { quest: t.id }); if (r && r.status === 200) G.wait = null; }
  else if (t.kind === 'sqwork0') { const r = await act('sq_act', {}); if (r && r.status === 200) G.sqWork = { q: sqActive()?.row.id, until: performance.now() + 15000 }; }
  else if (t.kind === 'sqwork' && t.ready) { const r = await act('sq_act', {}); if (r && r.status === 200) G.sqWork = null; }
  else if (t.kind === 'together' && t.ready) { G.sqTogether = performance.now(); await act('sq_act', {}); }
}
const st0 = () => R.state().pos;

export function initUi(world, k, rpg) {
  W = world; K = k; THREE = W.THREE; R = rpg; css(); makeBeacon(); initRes(W, K, R); initArena(W, R); initMarket(W, R); initGuild(W, K);
  const lv = document.createElement('div'); lv.id = 'hudLv'; lv.className = 'lv'; lv.hidden = true; W.$('hudRole').after(lv);
  const btns = document.createElement('div'); btns.id = 'hudBtns'; btns.innerHTML = '<button class="btn btn-gold" id="hudQ" type="button">📜 Задания</button><button class="btn btn-paper" id="hudS" type="button">👥 Отряд</button><button class="btn btn-paper" id="hudO" type="button">🏰 Орден</button><button class="btn btn-paper" id="hudP" type="button">🎒 Герой</button>';
  W.$('hudExit').before(btns); W.$('hudQ').onclick = () => withState(questLog, 'Задания');
  W.$('hudP').onclick = () => withState(hero, 'Герой и снаряжение');
  W.$('hudS').onclick = () => withState(squadSheet, 'Отряды');
  W.$('hudO').onclick = () => withState(() => guildSheet(), 'Ордены');
  const tr = document.createElement('div'); tr.id = 'tracker'; tr.className = 'panel'; tr.onclick = questLog; document.body.appendChild(tr);
  const ab = document.createElement('button'); ab.id = 'actBtn'; ab.className = 'btn btn-gold'; ab.type = 'button'; ab.hidden = true; ab.onclick = onAct; document.body.appendChild(ab);
  const fl = document.createElement('div'); fl.id = 'lvflash'; document.body.appendChild(fl);
  addEventListener('keydown', e => { if (!R.state().on || e.target.closest?.('input,textarea')) return; if (e.code === 'KeyF') onAct(); if (e.code === 'KeyJ') questLog(); if (e.code === 'KeyI') hero(); });
}
export { questLog, hero as heroSheet, squadSheet, rewardText, qcard, KIND, left as timeLeft };
