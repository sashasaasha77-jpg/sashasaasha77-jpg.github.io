// Живой мир: другие герои на карте (Supabase Realtime: presence + broadcast), чат, мгновенные обновления отряда.
// Позиции героев — только для отображения: награды и прогресс считает сервер.
import { createClient } from './sb.js';
import { localCall } from './rpg-local.mjs';
import { buildHorse, rideHorse, horseVariant } from './monsters.js';
const SB_URL = 'https://otgwiroxifqtktbipbsu.supabase.co', SB_KEY = 'sb_publishable_YM1peVWMHKlyAy1kCx0D2w_SjoGpgEt';
let W, K, THREE, R, client = null, ch = null, me = null, onRefresh = () => { };
export const NET = { others: new Map(), online: new Map(), chat: { world: [], squad: [] }, tab: 'world', open: false, ready: false };
const MAX_SHOWN = 30, SHOW_R = 70;
let lastSend = { t: 0, x: 0, z: 0, moving: false }, lastTrack = { t: 0, x: 0, z: 0 }, refreshT = 0;

// ---------------- король: ключ хранится только на этом устройстве, проверяет его сервер ----------------
export const kingKey = () => { try { return localStorage.getItem('kp-king') || sessionStorage.getItem('kp-king') || ''; } catch { return ''; } };
export const isKing = () => !!(me && (me.demo || kingKey()));
const kingNick = () => R?.game?.()?.world?.king || null;
async function kingAct(action, body) {
  if (me.demo) return localCall(me.nick, action, body, true);
  const res = await fetch((window.KP_API || '') + '/rpg/' + action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adminKey: kingKey(), ...body }) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
let kingChecked = false;
async function kingHello() { // король вошёл в «Мир героев»: сервер проверяет ключ и запоминает, кто король (для короны и 👑 в чате)
  if (kingChecked || me.demo || !kingKey()) return; kingChecked = true;
  const r = await kingAct('king_me', { nick: me.nick }).catch(() => null);
  if (r && r.status === 200) { W.toast('👑 Ты вошёл как король: можно чистить чат и объявлять указы.'); onRefresh(); }
  else if (r && r.status === 403) { try { localStorage.removeItem('kp-king'); sessionStorage.removeItem('kp-king'); } catch { } W.toast('Ключ короля не подошёл — королевские кнопки скрыты.'); renderChat(); }
}
let demoId = 0, muteFor = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function scheduleRefresh() { const now = performance.now(); if (now - refreshT < 1200) return; refreshT = now; setTimeout(() => onRefresh(), 300); }
function squadId() { const s = R.game()?.squad; return s ? s.id : null; }

export async function connect(info, refresh) {
  disconnect(); me = info; onRefresh = refresh || onRefresh; setTimeout(kingHello, 1500);
  if (!client) client = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 10 } } });
  ch = client.channel(info.demo ? 'world-demo' : 'world', { config: { presence: { key: info.nick }, broadcast: { self: false } } });
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState(); NET.online.clear();
    for (const [nick, metas] of Object.entries(st)) { const m = metas[metas.length - 1]; if (nick === me.nick) continue; NET.online.set(nick, m); upsert(nick, m, true); }
    for (const nick of [...NET.others.keys()]) if (!NET.online.has(nick)) removeOther(nick);
    renderChatHead();
  });
  ch.on('broadcast', { event: 'p' }, ({ payload: p }) => { if (!p || p.n === me.nick) return; const o = NET.others.get(p.n); if (o) { o.tx = p.x; o.tz = p.z; o.tf = p.f; o.moving = !!p.m; o.h = !!p.h; o.last = performance.now(); } });
  if (info.demo) ch.on('broadcast', { event: 'c' }, ({ payload: m }) => addMsg('world', { ...m, id: m.id || 'd' + (++demoId) }));
  else {
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat' }, ({ new: m }) => {
      if (m.channel === 'world') addMsg('world', { id: m.id, n: m.nick, t: m.text, at: m.at }); else if (m.channel === 'squad:' + squadId()) addMsg('squad', { id: m.id, n: m.nick, t: m.text, at: m.at }); });
    ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat' }, ({ old: o }) => dropMsgs(m => m.id === o?.id)); // король удалил сообщение
    for (const table of ['squad_quests', 'squad_members', 'squads']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, ({ new: n, old: o }) => {
      const sid = squadId(); if ((n && (n.squad_id === sid || n.id === sid)) || (o && (o.squad_id === sid || o.id === sid)) || (n && n.nick === me.nick)) scheduleRefresh(); });
    for (const table of ['world_events', 'territories']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleRefresh());
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'squad_invites' }, ({ new: n }) => { if (n.to_nick === me.nick) { W.toast(`@${n.from_nick} зовёт тебя в отряд! Открой «👥 Отряд».`); scheduleRefresh(); } });
  }
  ch.subscribe(async status => {
    if (status !== 'SUBSCRIBED') return; NET.ready = true;
    const p = R.state().pos; await ch.track({ nick: me.nick, role: me.role, lvl: me.level, sq: squadId(), x: p ? +p.x.toFixed(1) : 0, z: p ? +p.z.toFixed(1) : 0 });
    if (!info.demo) loadChat();
  });
}
export function disconnect() { if (ch) { try { ch.untrack(); client.removeChannel(ch); } catch { } } ch = null; NET.ready = false; for (const n of [...NET.others.keys()]) removeOther(n); NET.online.clear(); }
export function retrack() { if (!ch || !NET.ready || !me) return; const p = R.state().pos, g = R.game(); ch.track({ nick: me.nick, role: g?.hero.role || me.role, lvl: g?.hero.level || me.level, sq: squadId(), x: p ? +p.x.toFixed(1) : 0, z: p ? +p.z.toFixed(1) : 0 }); }

// ---------------- другие герои ----------------
function upsert(nick, m, fromPresence) {
  let o = NET.others.get(nick);
  const role = W.ROLES.find(r => r.id === m.role) || W.ROLES[0];
  if (!o) { o = { nick, role: role.id, g: R.buildHero(role, nick), lab: document.createElement('div'), x: m.x || 0, z: m.z || 0, tx: m.x || 0, tz: m.z || 0, f: 0, tf: 0, t: Math.random() * 9, last: performance.now() };
    o.g.position.set(o.x, 0, o.z); W.scene.add(o.g); o.lab.className = 'lbl rp'; W.$('labels').appendChild(o.lab); NET.others.set(nick, o); }
  else if (fromPresence && !o.moving && Number.isFinite(m.x)) { o.tx = m.x; o.tz = m.z; }
  o.lvl = m.lvl; o.sq = m.sq;
}
function removeOther(nick) { const o = NET.others.get(nick); if (!o) return; W.scene.remove(o.g); if (o.horse) W.scene.remove(o.horse); o.lab.remove(); NET.others.delete(nick); }

const v3 = () => new THREE.Vector3();
let TMP = null;
export function tick(now, dt) {
  const st = R.state(); if (!st.on || !NET.ready) return;
  // отправка своей позиции: раз в секунду при движении и один раз при остановке
  const p = st.pos; if (p) { const moved = Math.hypot(p.x - lastSend.x, p.z - lastSend.z), moving = st.speed > 0.3;
    if ((moving && moved > 0.2 && now - lastSend.t > 1000) || (!moving && lastSend.moving) || !!st.mount !== !!lastSend.h) { ch.send({ type: 'broadcast', event: 'p', payload: { n: me.nick, x: +p.x.toFixed(2), z: +p.z.toFixed(2), f: +st.face.toFixed(2), m: moving, h: !!st.mount } }); lastSend = { t: now, x: p.x, z: p.z, moving, h: !!st.mount }; }
    if (now - lastTrack.t > 20000 && Math.hypot(p.x - lastTrack.x, p.z - lastTrack.z) > 2) { lastTrack = { t: now, x: p.x, z: p.z }; retrack(); } }
  // показ ближайших героев
  const sid = squadId(), list = [...NET.others.values()].map(o => ({ o, d: p ? Math.hypot(o.x - p.x, o.z - p.z) : 0 })).sort((a, b) => a.d - b.d);
  list.forEach(({ o, d }, i) => {
    const show = i < MAX_SHOWN && d < SHOW_R; o.g.visible = show; if (!show) { o.lab.style.display = 'none'; return; }
    const k = Math.min(1, dt * 4), ox = o.x, oz = o.z; o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k;
    const sp = Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-3); let df = o.tf - o.f; df = Math.atan2(Math.sin(df), Math.cos(df)); o.f += df * Math.min(1, dt * 8);
    o.t += dt; o.g.position.set(o.x, 0, o.z); o.g.rotation.y = o.f; R.animate(o.g, o.t, sp > 0.2 ? Math.min(7, sp) : 0);
    if (o.h && !o.horse) { o.horse = buildHorse(horseVariant(o.nick)); W.scene.add(o.horse); } if (o.horse) o.horse.visible = !!o.h; // чужой герой на коне
    if (o.h) { o.horse.position.set(o.x, 0, o.z); o.horse.rotation.y = o.f; o.g.position.y = rideHorse(o.horse, o.g, o.t, sp > 0.2 ? Math.min(10, sp) : 0); } else if (o.horse) o.g.userData.body.position.y = 0;
    if (d < 32) { const s = (TMP || (TMP = new THREE.Vector3())).set(o.x, 1.75, o.z).project(W.camera);
      if (s.z < 1) { o.lab.style.display = 'block'; const txt = `${o.nick === kingNick() ? '👑 ' : ''}@${o.nick}${o.lvl ? ' · ' + o.lvl : ''}`; if (o.lab.textContent !== txt) o.lab.textContent = txt; const cn = 'lbl rp' + (sid && o.sq === sid ? ' sq' : ''); if (o.lab.className !== cn) o.lab.className = cn; o.lab.style.left = ((s.x + 1) / 2 * innerWidth) + 'px'; o.lab.style.top = ((1 - s.y) / 2 * innerHeight) + 'px'; } else o.lab.style.display = 'none';
    } else o.lab.style.display = 'none';
  });
}

// ---------------- чат ----------------
async function loadChat() {
  for (const [tab, chan] of [['world', 'world'], ['squad', squadId() ? 'squad:' + squadId() : null]]) {
    if (!chan) { NET.chat[tab] = []; continue; }
    const { data } = await client.from('chat').select('id,nick,text,at').eq('channel', chan).order('at', { ascending: false }).limit(30);
    NET.chat[tab] = (data || []).reverse().map(m => ({ id: m.id, n: m.nick, t: m.text, at: m.at }));
  }
  renderChat();
}
export function reloadSquadChat() { if (ch && !me?.demo) loadChat(); }
const RE = /^@([^\s,]+),\s*/; // ответ игроку: «@ник, текст»
function addMsg(tab, m) { if (!m.at) m.at = new Date().toISOString(); NET.chat[tab].push(m); if (NET.chat[tab].length > 60) NET.chat[tab].shift(); renderChat();
  if (!NET.open || NET.tab !== tab) { const b = W.$('chatBtn'); b.classList.add('new'); }
  const to = RE.exec(m.t || ''); if (to && me && to[1] === me.nick && m.n !== me.nick && (!NET.open || NET.tab !== tab)) W.toast(`💬 @${m.n} ответил тебе: ${(m.t || '').replace(RE, '').slice(0, 60)}`); }
let replyTo = null;
function setReply(n) { replyTo = n && n !== me?.nick ? n : null; const bar = W.$('chatRe'); if (bar) { bar.hidden = !replyTo; bar.querySelector('b').textContent = replyTo ? '@' + replyTo : ''; } if (replyTo) W.$('chatIn')?.focus(); }
const hhmm = at => { const d = at ? new Date(at) : null; if (!d || isNaN(d)) return ''; const today = d.toDateString() === new Date().toDateString(); return (today ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ') + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };
function renderChatHead() { const h = W.$('chatOnline'); if (h) { h.textContent = `🟢 ${NET.online.size + 1} в игре ${NET.who ? '▲' : '▼'}`; h.classList.toggle('on', !!NET.who); } if (NET.who) renderWho(); }
function renderWho() {
  const box = W.$('chatWho'); if (!box) return; const kn = kingNick(), sid = squadId(), g = R.game();
  const row = (n, role, lvl, sq, mine) => { const r = W.ROLES.find(x => x.id === role) || W.ROLES[0];
    return `<div class="wr${mine ? ' me' : ''}"${mine ? '' : ` data-re="${esc(n)}"`}><b>${n === kn ? '👑 ' : ''}@${esc(n)}</b><span>${esc(r.name)}${lvl ? ' · ур. ' + lvl : ''}${sid && sq === sid ? ' · 🛡 отряд' : ''}</span>${mine ? '<i>это ты</i>' : '<i>↩ ответить</i>'}</div>`; };
  const list = [...NET.online.values()].sort((a, b) => (b.nick === kn) - (a.nick === kn) || (b.lvl || 0) - (a.lvl || 0));
  box.innerHTML = `<p class="wh">Сейчас в игре — ${NET.online.size + 1}</p>` + (me ? row(me.nick, g?.hero.role || me.role, g?.hero.level || me.level, sid, true) : '') + list.map(m => row(m.nick, m.role, m.lvl, m.sq, false)).join('') + (list.length ? '' : '<p class="wh">Пока больше никого — позови друзей!</p>');
}
function toggleWho(v) { NET.who = v ?? !NET.who; W.$('chatWho').hidden = !NET.who; W.$('chatList').hidden = NET.who; renderChatHead(); }
function renderChat() {
  const box = W.$('chatList'); if (!box) return; const msgs = NET.chat[NET.tab];
  const kn = kingNick(), king = isKing();
  const tools = m => king && m.id != null && m.n !== me?.nick ? `<span class="kt"><button type="button" data-del="${esc(m.id)}" title="Удалить">🗑</button><button type="button" data-mute="${esc(m.n)}" title="Заглушить">🔇</button></span>` : '';
  const muteRow = king && muteFor ? `<div class="kmute">Заглушить @${esc(muteFor)}: <button type="button" data-h="1">1 ч</button><button type="button" data-h="24">сутки</button><button type="button" data-h="-1">навсегда</button><button type="button" data-h="0">снять</button><label><input type="checkbox" id="kWipe"> и удалить его сообщения</label><button type="button" data-h="x">✕</button></div>` : '';
  const line = m => { const to = RE.exec(m.t || ''), body = to ? m.t.replace(RE, '') : m.t, mine = m.n === me?.nick, toMe = to && me && to[1] === me.nick && !mine;
    return `<div class="${[m.n === kn ? 'kmsg' : '', toMe ? 'tome' : ''].join(' ').trim()}"><i class="tm">${hhmm(m.at)}</i> <b class="${mine ? 'me' : ''}" data-re="${esc(m.n)}">${m.n === kn ? '👑 ' : ''}@${esc(m.n)}</b>${to ? ` <span class="to">↩ @${esc(to[1])}</span>` : ''} ${esc(body)}${tools(m)}${mine ? '' : `<button type="button" class="rb" data-re="${esc(m.n)}" title="Ответить @${esc(m.n)}">↩</button>`}</div>`; };
  box.innerHTML = muteRow + (msgs.length ? msgs.map(line).join('') : `<p>${NET.tab === 'squad' && !squadId() ? 'Ты не в отряде.' : 'Сообщений пока нет.'}</p>`);
  box.scrollTop = box.scrollHeight;
}
function dropMsgs(fn) { for (const t of ['world', 'squad']) NET.chat[t] = NET.chat[t].filter(m => !fn(m)); renderChat(); }
async function kingClick(e) {
  const del = e.target.closest('[data-del]'), mute = e.target.closest('[data-mute]'), h = e.target.closest('[data-h]'); if (!del && !mute && !h) return;
  e.preventDefault(); e.stopPropagation();
  if (del) { const id = del.dataset.del, r = await kingAct('chat_del', { id: me.demo ? 0 : +id }); if (r.status === 200) dropMsgs(m => String(m.id) === id); else W.toast(r.data?.message || 'Не удалилось.'); return; }
  if (mute) { muteFor = mute.dataset.mute; renderChat(); W.$('chatList').scrollTop = 0; return; }
  if (h.dataset.h === 'x') { muteFor = null; renderChat(); return; }
  const who = muteFor, wipe = !!W.$('kWipe')?.checked, r = await kingAct('chat_mute', { nick: who, hours: +h.dataset.h, wipe }); muteFor = null;
  if (r.status === 200) { W.toast('👑 ' + r.data.note); if (wipe) dropMsgs(m => m.n === who); else renderChat(); } else W.toast(r.data?.message || 'Не получилось.');
}
async function send() {
  const inp = W.$('chatIn'), raw = inp.value.trim(); if (!raw) return; const text = (replyTo ? `@${replyTo}, ` : '') + raw.replace(RE, '');
  if (NET.tab === 'squad' && !squadId()) return W.toast('Ты не в отряде.');
  if (me.demo) { if (NET.tab !== 'world') return W.toast('В демо работает только общий чат.'); const m = { n: me.nick, t: text.slice(0, 200) }; ch.send({ type: 'broadcast', event: 'c', payload: m }); addMsg('world', m); inp.value = ''; setReply(null); return; }
  const r = await R.act('chat', { channel: NET.tab === 'squad' ? 'squad:' + squadId() : 'world', text }, true);
  if (r && r.status === 200) { inp.value = ''; setReply(null); } else W.toast(r?.data?.message || 'Не отправилось.');
}
export function initNet(world, k, rpg) {
  W = world; K = k; THREE = W.THREE; R = rpg;
  const c = document.createElement('style'); c.textContent = `
  .lbl.rp { background: rgba(14,20,36,.82); font-size: 11.5px; } .lbl.rp.sq { background: #2f5a8a; }
  #chatBtn { position: fixed; z-index: 4; left: max(10px, env(safe-area-inset-left)); bottom: max(14px, env(safe-area-inset-bottom)); padding: 8px 12px; font-size: 14px; display: none; }
  #chatBtn.new::after { content: ''; position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; border-radius: 50%; background: var(--crimson); border: 2px solid var(--ink); }
  body.playing #chatBtn { display: inline-flex; } body.playing.chatting #chatBtn { display: none; }
  @media (pointer: coarse) { #chatBtn { left: auto; right: max(16px, env(safe-area-inset-right)); bottom: calc(max(18px, env(safe-area-inset-bottom)) + 64px); } } /* выше значка Netlify в правом нижнем углу */
  #chat { position: fixed; z-index: 5; left: max(10px, env(safe-area-inset-left)); bottom: max(10px, env(safe-area-inset-bottom)); width: min(340px, calc(100% - 20px)); display: none; flex-direction: column; border-radius: 14px; padding: 8px; gap: 6px; }
  body.playing.chatting #chat { display: flex; } @media (pointer: coarse) { #chat { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 64px); } }
  #chat .tabs2 { display: flex; gap: 6px; align-items: center; } #chat .tabs2 button { padding: 4px 10px; border-radius: 9px; border: 2px solid rgba(245,235,220,.2); background: none; color: var(--paper); font-weight: 800; font-size: 12.5px; cursor: pointer; } #chat .tabs2 button.on { background: var(--gold); color: var(--ink); border-color: var(--ink); }
  #chat small { margin-left: auto; color: var(--muted); font-weight: 700; } #chatList { height: 170px; overflow-y: auto; font-size: 13px; line-height: 1.35; display: grid; align-content: start; gap: 3px; } #chatList b { color: #9ec3ff; } #chatList b.me { color: var(--gold); } #chatList p { color: var(--muted); margin: 6px 0; }
  #chatList .kt { float: right; display: inline-flex; gap: 3px; margin-left: 6px; } #chatList .kt button, .kmute button { background: rgba(245,235,220,.12); border: 1px solid rgba(245,235,220,.25); border-radius: 7px; color: var(--paper); font-size: 12px; padding: 1px 5px; cursor: pointer; }
  .kmute { background: rgba(164,22,26,.35); border-radius: 9px; padding: 6px; font-size: 12.5px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; } .kmute label { display: inline-flex; gap: 4px; align-items: center; }
  #chatList .kmsg b { color: var(--gold) !important; }
  #chatList[hidden], #chatWho[hidden] { display: none !important; } #chat #chatOnline { margin-left: auto; white-space: nowrap; padding: 4px 8px; color: #9be39b; border-color: rgba(120,220,120,.35); font-size: 12px; } #chat #chatOnline.on { background: rgba(120,220,120,.15); }
  #chatWho { height: 170px; overflow-y: auto; display: grid; align-content: start; gap: 4px; font-size: 13px; } #chatWho .wh { margin: 0 0 2px; color: var(--muted); font-weight: 700; font-size: 12px; }
  #chatWho .wr { display: grid; grid-template-columns: 1fr auto; gap: 0 8px; padding: 5px 8px; border-radius: 9px; background: rgba(245,235,220,.07); cursor: pointer; } #chatWho .wr.me { cursor: default; border-left: 3px solid var(--gold); }
  #chatWho .wr b { color: #9ec3ff; } #chatWho .wr.me b { color: var(--gold); } #chatWho .wr span { grid-column: 1; color: var(--muted); font-size: 12px; font-weight: 700; } #chatWho .wr i { grid-row: 1 / 3; grid-column: 2; align-self: center; font-style: normal; font-size: 11.5px; color: var(--muted); }
  #chatList .tm { font-style: normal; font-size: 10.5px; color: var(--muted); font-weight: 700; } #chatList b[data-re] { cursor: pointer; } #chatList .to { color: #9ec3ff; font-size: 12px; font-weight: 700; opacity: .85; }
  #chatList .tome { background: rgba(232,185,49,.18); border-left: 3px solid var(--gold); border-radius: 6px; padding: 1px 4px; } #chatList .rb { float: right; background: none; border: 0; color: var(--muted); font-size: 13px; cursor: pointer; padding: 0 4px; }
  #chatRe { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--muted); background: rgba(232,185,49,.15); border-radius: 8px; padding: 3px 8px; } #chatRe[hidden] { display: none; } #chatRe b { color: var(--gold); } #chatRe button { margin-left: auto; background: none; border: 0; color: var(--paper); cursor: pointer; }
  #chat form { display: flex; gap: 6px; } #chat input { flex: 1; min-width: 0; border-radius: 10px; border: 2px solid rgba(245,235,220,.25); background: rgba(0,0,0,.25); color: var(--paper); padding: 7px 9px; font-size: 14px; } #chat .btn { padding: 6px 10px; font-size: 13px; }`;
  document.head.appendChild(c);
  const b = document.createElement('button'); b.id = 'chatBtn'; b.className = 'btn btn-paper'; b.type = 'button'; b.textContent = '💬 Чат'; document.body.appendChild(b);
  const p = document.createElement('div'); p.id = 'chat'; p.className = 'panel';
  p.innerHTML = `<div class="tabs2"><button type="button" data-t="world" class="on">Королевство</button><button type="button" data-t="squad">Отряд</button><button type="button" id="chatOnline" title="Кто сейчас играет"></button><button type="button" id="chatX" aria-label="Свернуть">✕</button></div><div id="chatList"></div><div id="chatWho" hidden></div><div id="chatRe" hidden>↩ Ответ <b></b><button type="button" aria-label="Отменить ответ">✕</button></div><form id="chatF"><input id="chatIn" maxlength="200" placeholder="Сообщение…" autocomplete="off"><button class="btn btn-gold" type="submit">➤</button></form>`;
  document.body.appendChild(p);
  b.onclick = () => { NET.open = true; document.body.classList.add('chatting'); b.classList.remove('new'); renderChat(); renderChatHead(); };
  W.$('chatX').onclick = () => { NET.open = false; document.body.classList.remove('chatting'); };
  W.$('chatOnline').onclick = () => toggleWho(); W.$('chatWho').addEventListener('click', e => { const r = e.target.closest('[data-re]'); if (r) { toggleWho(false); setReply(r.dataset.re); } });
  p.querySelectorAll('[data-t]').forEach(t => t.onclick = () => { if (NET.who) toggleWho(false); NET.tab = t.dataset.t; p.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === t)); renderChat(); });
  W.$('chatF').onsubmit = e => { e.preventDefault(); send(); }; W.$('chatList').addEventListener('click', e => { const r = e.target.closest('[data-re]'); if (r) { e.preventDefault(); setReply(r.dataset.re); } }); W.$('chatList').addEventListener('click', kingClick);
  W.$('chatRe').querySelector('button').onclick = () => setReply(null); // король: удалить / заглушить
  W.$('chatIn').addEventListener('keydown', e => e.stopPropagation()); W.$('chatIn').addEventListener('keyup', e => e.stopPropagation());
}
