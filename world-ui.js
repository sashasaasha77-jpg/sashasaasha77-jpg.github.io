// Мир на карте: баннер вторжения для всех, осадные машины, огонь, захваченные земли, панель обороны и панель короля.
import { createClient } from './sb.js';
import { SIEGE, TASKS, TERR, WORLD_EVENTS, TITLES } from './world.mjs';
import { POI } from './quests.mjs';
import { G, act, openSheet } from './rpg-ui.js';
import { localCall } from './rpg-local.mjs';
let W, K, THREE, R, pub = null, WS = null; // WS — публичный снимок мира (для всех посетителей)
const SB_URL = 'https://otgwiroxifqtktbipbsu.supabase.co', SB_KEY = 'sb_publishable_YM1peVWMHKlyAy1kCx0D2w_SjoGpgEt';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const world = () => G.state?.world || WS;
const fmtLeft = ms => { if (ms <= 0) return 'сейчас'; const m = Math.ceil(ms / 6e4); if (m < 60) return `${m} мин`; const h = Math.floor(m / 60); return h < 48 ? `${h} ч ${m % 60} мин` : `${Math.floor(h / 24)} д ${h % 24} ч`; };

// ---------------- публичное состояние мира (видно и без входа) ----------------
async function loadPublic() {
  if (G.state?.world || R.state().demo) return;
  try { pub = pub || createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
    const [{ data: events }, { data: territories }] = await Promise.all([pub.from('world_events').select('*').in('status', ['scheduled', 'warning', 'active']).order('starts_at'), pub.from('territories').select('*')]);
    WS = { events: events || [], territories: territories || [], castle: { damage: 0 }, enemies: [] }; render(); } catch { }
}

// ---------------- баннер ----------------
function banner() {
  const w = world(), b = W.$('warBanner'); if (!w) { b.hidden = true; return; }
  { // табличка всегда под верхней панелью (её высота зависит от ширины экрана), чтобы не закрывать кнопки «Выйти», «Войти» и т. п.
    const top = document.body.classList.contains('playing') ? W.$('hud') : document.querySelector('.ui.top'), r = top && top.getBoundingClientRect();
    if (r && r.height) { const y = Math.round(r.bottom + 8) + 'px'; if (b.style.top !== y) b.style.top = y; } }
  const inv = w.events.find(e => e.kind === 'invasion'), ev = w.events.find(e => e.kind !== 'invasion' && e.status === 'active'), now = Date.now();
  let html = '', cls = '';
  if (inv && inv.status === 'active') { cls = 'hot'; html = `🔥 <b>ОСАДА ЗАМКА!</b> Оборона ${inv.progress} / ${inv.goal} · осталось ${fmtLeft(Date.parse(inv.ends_at) - now)}<i><b style="width:${Math.min(100, 100 * inv.progress / Math.max(1, inv.goal)).toFixed(0)}%"></b></i>`; }
  else if (inv && inv.status === 'warning') { cls = 'warn'; html = `⚠️ <b>Разведчики Чёрного Ордена у границ!</b> Осада через ${fmtLeft(Date.parse(inv.starts_at) - now)}`; }
  else if (inv && Date.parse(inv.starts_at) - now < 3 * 864e5) html = `⚔️ Вторжение Чёрного Ордена через ${fmtLeft(Date.parse(inv.starts_at) - now)}`;
  if (ev && WORLD_EVENTS[ev.kind]?.boss && ev.goal) { const left = Math.max(0, ev.goal - (ev.progress || 0)); cls = cls || 'hot';
    html += `${html ? '<br>' : ''}🐉 <b>${WORLD_EVENTS[ev.kind].name}!</b> Здоровье босса ${left} / ${ev.goal} · ещё ${fmtLeft(Date.parse(ev.ends_at) - now)}<i><b style="width:${Math.min(100, 100 * left / ev.goal).toFixed(0)}%"></b></i>`; }
  else if (ev) html += `${html ? '<br>' : ''}✨ <b>${WORLD_EVENTS[ev.kind].name}</b>: ещё ${fmtLeft(Date.parse(ev.ends_at) - now)}`;
  const occ = (w.territories || []).filter(t => t.owner === 'order'); if (occ.length && !html.includes('ОСАДА')) html += `${html ? '<br>' : ''}🏴 Орден держит: ${occ.map(t => esc(TERR[t.id]?.name || t.id)).join(', ')}`;
  b.hidden = !html; b.className = 'panel ' + cls; if (b.innerHTML !== html) b.innerHTML = html;
}

// ---------------- 3D: осада, огонь, захваченные земли ----------------
const V = { machines: {}, fires: [], terr: {}, scouts: [], built: false, barricade: null };
function fireAt(x, y, z, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); W.scene.add(g);
  const fl = [0xFF7A1A, 0xFFB21A, 0xFF4A1A].map((c, i) => { const m = new THREE.Mesh(new THREE.ConeGeometry((0.4 - i * 0.1) * s, (1.1 - i * 0.2) * s, 6), new THREE.MeshBasicMaterial({ color: c })); m.position.y = 0.5 * s; g.add(m); return m; });
  const sm = Array.from({ length: 5 }, (_, i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 * s, 0), new THREE.MeshBasicMaterial({ color: 0x45434A, transparent: true, opacity: 0.5, depthWrite: false })); m.userData.t = i / 5; g.add(m); return m; });
  const o = { g, fl, sm, s }; V.fires.push(o); return o; }
function banner3d(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); W.scene.add(g); W.mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), 0x1A1210, { pos: [0, 1.3, 0], ol: 1 });
  const f = W.mesh(g, new THREE.BoxGeometry(0.03, 0.9, 0.7), 0x121216, { pos: [0, 2.1, 0.36], ol: 1 }); W.mesh(f, new THREE.BoxGeometry(0.04, 0.3, 0.3), 0xA4161A, { pos: [0, 0, 0], ol: 0 }); return g; }
function machineMesh(kind) {
  const g = new THREE.Group(), b = (w, h, d, c, p) => W.mesh(g, new THREE.BoxGeometry(w, h, d), c, { pos: p, ol: 1.5 });
  if (kind === 'ram') { b(1.4, 0.15, 2.6, 0x4A3424, [0, 0.45, 0]); W.mesh(g, new THREE.CylinderGeometry(0.22, 0.22, 3, 10).rotateX(Math.PI / 2), 0x5A3E2A, { pos: [0, 0.9, 0.3], ol: 1.5 }); W.mesh(g, new THREE.ConeGeometry(0.24, 0.4, 10).rotateX(Math.PI / 2), 0x3A3A44, { pos: [0, 0.9, 1.95], ol: 1 });
    W.mesh(g, new THREE.ConeGeometry(1.2, 1, 4).rotateY(Math.PI / 4), 0x2A0A0C, { pos: [0, 1.7, 0], scl: [0.9, 1, 1.6], ol: 1.5 }); for (const x of [-0.75, 0.75]) for (const z of [-0.9, 0.9]) W.mesh(g, new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10).rotateZ(Math.PI / 2), 0x2A1E16, { pos: [x, 0.3, z], ol: 1 }); }
  else if (kind === 'tower') { b(2, 5.2, 2, 0x4A3424, [0, 2.6, 0]); for (let y = 0.8; y < 5; y += 1.1) b(2.05, 0.12, 2.05, 0x2A1E16, [0, y, 0]); b(2.3, 0.3, 2.3, 0x2A1E16, [0, 5.3, 0]); b(1.6, 1.2, 0.08, 0x121216, [0, 4.4, 1.03]); W.mesh(g, new THREE.BoxGeometry(0.4, 0.4, 0.05), 0xA4161A, { pos: [0, 4.4, 1.08], ol: 0 }); }
  else { for (const s of [-0.5, 0.5]) { b(0.12, 0.12, 1.8, 0x4A3424, [s, 0.3, 0]); b(0.12, 1.1, 0.12, 0x4A3424, [s, 0.85, -0.2]); } const arm = new THREE.Group(); arm.position.set(0, 1.3, -0.2); g.add(arm); W.mesh(arm, new THREE.BoxGeometry(0.1, 0.1, 1.9), 0x5A3E2A, { pos: [0, 0, 0.5], ol: 1.5 }); W.mesh(arm, new THREE.SphereGeometry(0.2, 8, 6), 0x5E5A55, { pos: [0, 0.15, 1.4], ol: 1 }); arm.rotation.x = 0.5; g.userData.arm = arm; }
  g.traverse(o => { if (o.isMesh && !o.material.isShaderMaterial) o.castShadow = true; }); return g;
}
function wreck() { const g = new THREE.Group(); for (let k = 0; k < 6; k++) W.mesh(g, new THREE.BoxGeometry(0.2, 0.15, 1.2 + (k % 3) * 0.4).rotateY(k * 1.1).rotateZ((k % 2) * 0.4), 0x2A1E16, { pos: [(k % 3 - 1) * 0.4, 0.1 + (k % 2) * 0.12, ((k * 7) % 3 - 1) * 0.3], ol: 1 }); return g; }
function sync() {
  const w = world(); if (!w) return; const inv = w.events.find(e => e.kind === 'invasion'), active = inv && inv.status === 'active', warn = inv && inv.status === 'warning';
  // осадные машины
  for (const [k, m] of Object.entries(SIEGE.machines)) {
    let o = V.machines[k]; const hp = active ? (inv.data?.machines?.[k] ?? m.hp) : null;
    if (!o) { o = V.machines[k] = { alive: machineMesh(k === 'ram' ? 'ram' : k === 'tower' ? 'tower' : 'cat'), dead: wreck(), lab: document.createElement('div') }; for (const g of [o.alive, o.dead]) { g.position.set(m.x, 0, m.z); g.rotation.y = k === 'ram' ? -Math.PI / 2 : k === 'tower' ? Math.PI : Math.atan2(-m.x, -m.z); W.scene.add(g); }
      o.lab.className = 'lbl foe'; W.$('labels').appendChild(o.lab); o.fire = null; }
    o.alive.visible = active && hp > 0; o.dead.visible = active && hp <= 0; o.hp = hp; o.m = m;
    if (active && hp <= 0 && !o.fire) o.fire = fireAt(m.x, 0, m.z, 0.8); if ((!active || hp > 0) && o.fire) { W.scene.remove(o.fire.g); V.fires.splice(V.fires.indexOf(o.fire), 1); o.fire = null; }
  }
  // огонь на замке: во время осады и пока замок повреждён
  const burn = active || (w.castle?.damage || 0) > 0;
  if (burn && !V.castleFire) V.castleFire = [fireAt(-7, 4.6, -7, 1.2), fireAt(6.5, 4.5, 2, 1), fireAt(-3, 4.5, -7, 0.9)];
  if (!burn && V.castleFire) { for (const f of V.castleFire) { W.scene.remove(f.g); V.fires.splice(V.fires.indexOf(f), 1); } V.castleFire = null; }
  // знамёна Ордена вокруг замка во время осады
  if (active && !V.siegeFlags) V.siegeFlags = [[-12, 6], [12, 6], [-12, -6], [12, -6], [4, 13], [-4, 13]].map(([x, z]) => banner3d(x, z));
  if (!active && V.siegeFlags) { V.siegeFlags.forEach(g => W.scene.remove(g)); V.siegeFlags = null; }
  // разведчики у границ во время предупреждения
  if (warn && !V.scouts.length && R.buildKnight) V.scouts = [[0, -34], [-30, -10], [30, -10]].map(([x, z]) => { const g = R.buildKnight('knight'); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); W.scene.add(g); return g; });
  if (!warn && V.scouts.length) { V.scouts.forEach(g => W.scene.remove(g)); V.scouts = []; }
  // захваченные территории: тёмная земля, флаги Ордена, баррикада на мосту
  for (const [id, t] of Object.entries(TERR)) {
    const occ = (w.territories || []).find(x => x.id === id)?.owner === 'order'; let o = V.terr[id];
    if (occ && !o) { const g = new THREE.Group(); g.position.set(t.x, 0, t.z); W.scene.add(g);
      const d = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: 0x1A0A0C, transparent: true, opacity: 0.35, depthWrite: false })); d.rotation.x = -Math.PI / 2; d.position.y = 0.07; g.add(d);
      for (const [x, z] of [[-3, 2], [3, -2]]) { const b = banner3d(0, 0); W.scene.remove(b); b.position.set(x, 0, z); g.add(b); }
      o = V.terr[id] = { g }; if (id === 'most') { const bar = new THREE.Group(); bar.position.set(0, 0, W.riverZ(0)); W.scene.add(bar); for (let k = -2; k <= 2; k++) W.mesh(bar, new THREE.BoxGeometry(0.25, 1.1, 0.25).rotateZ(k % 2 ? 0.5 : -0.5), 0x3A2A1E, { pos: [k * 0.45, 0.75, 0], ol: 1 }); W.mesh(bar, new THREE.BoxGeometry(2.4, 0.2, 0.2), 0x3A2A1E, { pos: [0, 1.0, 0], ol: 1 }); o.bar = bar; V.barricade = true; } }
    if (!occ && o) { W.scene.remove(o.g); if (o.bar) { W.scene.remove(o.bar); V.barricade = false; } delete V.terr[id]; }
  }
}

// ---------------- победа / поражение ----------------
function finale() {
  const w = G.state?.world, last = w?.lastDone; if (!last || last.kind !== 'invasion') return;
  let seen = null; try { seen = localStorage.getItem('kp-war-seen'); } catch { } if (seen === String(last.id)) return;
  try { localStorage.setItem('kp-war-seen', String(last.id)); } catch { }
  if (Date.now() - Date.parse(last.ends_at) > 6 * 36e5) return;
  const o = W.$('finale'); o.className = last.status === 'won' ? 'won' : 'lost'; o.innerHTML = last.status === 'won' ? '<b>ПОБЕДА!</b><span>Чёрный Орден отброшен от стен</span>' : '<b>ПОРАЖЕНИЕ</b><span>Орден прорвался. Освободите земли и отстройте замок!</span>';
  o.hidden = false; setTimeout(() => o.classList.add('show'), 20); setTimeout(() => { o.classList.remove('show'); setTimeout(() => o.hidden = true, 600); }, 4200);
}

// объявление о начале события — крупно по центру экрана, один раз на каждое событие
const EV_ICON = { caravan: '🐪', artifact: '🏺', raid: '🗡️', dragon: '🐉', lich: '💀', giant: '🧊' };
let annT = 0;
function announce() {
  const w = G.state?.world; if (!w) return; let seen = []; try { seen = JSON.parse(localStorage.getItem('kp-ev-seen') || '[]'); } catch { }
  const ev = w.events.find(e => !seen.includes(e.id) && (e.status === 'active' || (e.kind === 'invasion' && e.status === 'warning')) && Date.now() - Date.parse(e.starts_at) < 36e5 * (e.kind === 'invasion' ? 1 : 3));
  if (!ev || Date.now() - annT < 5000) return; annT = Date.now();
  try { localStorage.setItem('kp-ev-seen', JSON.stringify([...seen, ev.id].slice(-40))); } catch { }
  const inv = ev.kind === 'invasion', head = inv ? (ev.status === 'active' ? '🔥 ОСАДА!' : '⚠️ ТРЕВОГА!') : `${EV_ICON[ev.kind] || '✨'} ${WORLD_EVENTS[ev.kind]?.name || 'Событие'}`;
  const sub = inv ? (ev.status === 'active' ? 'Чёрный Орден у стен замка. Все к обороне!' : 'Разведчики Ордена у границ — готовьтесь к осаде!') : (WORLD_EVENTS[ev.kind]?.text || '');
  const o = W.$('finale'); o.className = inv ? 'lost' : 'ev'; o.innerHTML = `<b>${esc(head)}</b><span>${esc(sub)}</span>`;
  o.hidden = false; setTimeout(() => o.classList.add('show'), 20); setTimeout(() => { o.classList.remove('show'); setTimeout(() => o.hidden = true, 600); }, 5200);
}

// ---------------- панель обороны ----------------
export function warSheet() {
  const w = G.state?.world, inv = w?.events.find(e => e.kind === 'invasion'); if (!w) return;
  const role = G.state.hero.role, mine = inv && w.mine[inv.id], top = inv && w.top[inv.id] || [], now = Date.now();
  if (!inv || inv.status !== 'active') {
    const t = inv ? (inv.status === 'warning' ? `Осада начнётся через ${fmtLeft(Date.parse(inv.starts_at) - now)}. Готовь зелья и снаряжение!` : `Следующее вторжение: через ${fmtLeft(Date.parse(inv.starts_at) - now)}.`) : 'Вторжений пока не ожидается.';
    const occ = w.territories.filter(t => t.owner === 'order');
    return openSheet(`<h2>Оборона королевства</h2><p>${t}</p>${occ.length ? `<h2 style="font-size:20px">Захваченные земли</h2>${occ.map(t => `<div class="qcard"><h3>🏴 ${esc(TERR[t.id].name)}</h3><p>Освобождено: ${t.control}%. Побеждай оккупантов на этой земле: каждая победа +25%.${TERR[t.id].effect ? ' Сейчас: ' + TERR[t.id].effect + '.' : ''}</p></div>`).join('')}` : ''}
      ${w.castle?.damage ? `<div class="qcard"><h3>🏚️ Замок повреждён: ${w.castle.damage}%</h3><p>Неси брёвна или руду к пролому в северной стене (рядом с донжоном) и нажми «Чинить стену».</p></div>` : ''}`);
  }
  openSheet(`<h2>🔥 Осада замка</h2><p>Оборона <b>${inv.progress} / ${inv.goal}</b> · осталось ${fmtLeft(Date.parse(inv.ends_at) - now)}</p><div class="xpbar"><i style="width:${Math.min(100, 100 * inv.progress / inv.goal).toFixed(0)}%"></i></div>
    <p class="rw">Твой вклад: ${mine?.points || 0}. Награду получают все, кто помог; лучшие трое при победе получат титулы: ${TITLES.join(', ')}.</p>
    ${Object.entries(TASKS).map(([k, t]) => `<div class="qcard"><h3>${t.name}${t.mult?.[role] ? ` <span class="tag">×${t.mult[role]} для тебя</span>` : ''}</h3><p>${t.text}</p></div>`).join('')}
    <p class="rw">Осадные машины: ${Object.entries(SIEGE.machines).map(([k, m]) => `${m.name} ${Math.max(0, inv.data?.machines?.[k] ?? m.hp)}/${m.hp}`).join(' · ')}${(inv.data?.machinesDown || 0) >= 4 ? ' · ⚠️ Главнокомандующий вышел к воротам!' : ''}</p>
    ${top.length ? `<p class="rw">Лучшие защитники: ${top.map(r => `@${esc(r.nick)} ${r.points}`).join(' · ')}</p>` : ''}`);
}

// ---------------- действия обороны у объектов ----------------
const timers = {};
export function warAction(st, now) {
  const w = G.state?.world; if (!w || !st.pos) return null; const inv = w.events.find(e => e.kind === 'invasion' && e.status === 'active'), p = st.pos, near = (o, r = 3.6) => Math.hypot(p.x - o.x, p.z - o.z) < r;
  const timed = (key, spot, label, sec) => { if (!near(spot)) return null; const t = timers[key]; if (t) { const l = Math.max(0, Math.ceil((t - now) / 1000)); return { kind: 'war', task: key.split(':')[0], key, label: l ? `⏳ ${label}… ${l} с` : `✅ ${label}: готово`, ready: !l, timed: true }; } return { kind: 'war', task: key.split(':')[0], key, label: `${label} (${sec} с)`, start: true, sec }; };
  if (inv) {
    let a = null;
    for (const [k, m] of Object.entries(SIEGE.machines)) if ((inv.data?.machines?.[k] ?? 1) > 0 && near(m, 2.6)) { a = timed('sabotage:' + k, m, `🔨 Ломать: ${m.name}`, TASKS.sabotage.sec); if (a) return a; }
    a = timed('gate', SIEGE.gate, '🛡️ Держать ворота', TASKS.gate.sec); if (a) return a;
    a = timed('heal', SIEGE.hospital, '💚 Лечить раненых', TASKS.heal.sec); if (a) return a;
    if (near(SIEGE.wall)) return { kind: 'war', task: 'repair', label: '🪵 Чинить стену (бревно или руда)' };
    const mine = w.mine[inv.id]?.data || {};
    if (!mine.crate && near(SIEGE.depot, 3.2)) return { kind: 'war', task: 'supply', label: '📦 Взять ящик припасов' };
    if (mine.crate && near(SIEGE.gate)) return { kind: 'war', task: 'supply', label: '📦 Сдать припасы у ворот' };
    for (const k of SIEGE.scout) if (near(POI[k], 4) && !(mine.seen || []).includes(k)) return { kind: 'war', task: 'scout', label: '👁️ Осмотреть окраину' };
  }
  if ((w.castle?.damage || 0) > 0 && !inv && near(SIEGE.wall)) return { kind: 'war', task: 'restore', label: `🧱 Отстраивать стену (${w.castle.damage}%)` };
  const art = w.events.find(e => e.kind === 'artifact' && e.status === 'active'); if (art) for (const k of SIEGE.scout) if (near(POI[k], 4)) return { kind: 'war', task: 'search', label: '🔍 Искать артефакт' };
  return null;
}
export async function doWar(a) {
  if (a.start) { const r = await act('war', { task: a.task }, false); if (r && r.status === 200) timers[a.key] = performance.now() + a.sec * 1000; return; }
  if (a.timed) { if (!a.ready) return; const r = await act('war', { task: a.task }); if (r && r.status === 200) delete timers[a.key]; else if (r && r.data.error !== 'wait') delete timers[a.key]; return; }
  await act('war', { task: a.task });
}

// ---------------- панель короля ----------------
function kingSheet() {
  const w = world(), cfg = w?.config || G.state?.world?.config; let key = ''; try { key = localStorage.getItem('kp-king') || sessionStorage.getItem('kp-king') || ''; } catch { }
  const c = cfg || { invasion: { everyDays: 4, hour: 19, warnHours: 3, durationMin: 60, difficulty: 1, enabled: true }, events: { enabled: true, everyDays: 3, durationHours: 12 } };
  const f = (id, label, v, step = 1) => `<label class="field"><span>${label}</span><input id="${id}" type="number" step="${step}" value="${v}"></label>`;
  openSheet(`<h2>👑 Управление войной</h2>${R.state().demo ? '<p class="rw">Демо: указы действуют только в этом браузере.</p>' : `<label class="field"><span>Ключ короля (из файла ADMIN-KEY.txt)</span><input id="kKey" type="password" value="${esc(key)}" autocomplete="off"></label>`}
    <label class="field"><span><input id="kOn" type="checkbox" ${c.invasion.enabled ? 'checked' : ''}> Вторжения включены</span></label>
    ${f('kEvery', 'Вторжение раз в N дней', c.invasion.everyDays)}${f('kHour', 'Час начала (по Самаре)', c.invasion.hour)}${f('kWarn', 'Предупреждение за N часов', c.invasion.warnHours)}${f('kDur', 'Длительность осады, мин', c.invasion.durationMin)}${f('kDiff', 'Сложность (0.3–3)', c.invasion.difficulty, 0.1)}
    <label class="field"><span><input id="kEvOn" type="checkbox" ${c.events.enabled ? 'checked' : ''}> Мировые события включены</span></label>${f('kEvEvery', 'Событие раз в N дней', c.events.everyDays)}
    <button class="btn btn-gold" type="button" id="kSave" style="width:100%">Сохранить указ</button>
    <h2 style="font-size:20px;margin-top:14px">Уровень героя</h2><label class="field"><span>Ник героя</span><input id="kLvNick" type="text" value="korol_podpi" autocomplete="off"></label>${f('kLv', 'Уровень (1–80)', 80)}
    <button class="btn btn-paper" type="button" id="kLvSet" style="width:100%">⭐ Назначить уровень</button>
    <h2 style="font-size:20px;margin-top:14px">Казна: выдать монеты</h2><label class="field"><span>Ник героя</span><input id="kCnNick" type="text" value="korol_podpi" autocomplete="off"></label>${f('kCn', 'Сколько монет (можно с минусом)', 80000)}
    <button class="btn btn-paper" type="button" id="kCnSet" style="width:100%">🪙 Выдать монеты</button>
    <h2 style="font-size:20px;margin-top:14px">Объявить сейчас</h2><div class="npcopts">
      <button class="btn btn-paper" type="button" data-st="invasion" data-w="5">⚔️ Вторжение через 5 минут</button><button class="btn btn-paper" type="button" data-st="invasion" data-w="0">🔥 Осада немедленно</button>
      <button class="btn btn-paper" type="button" data-st="caravan">🐪 Королевский караван</button><button class="btn btn-paper" type="button" data-st="artifact">🏺 Поиск артефакта</button><button class="btn btn-paper" type="button" data-st="raid">🗡️ Набег на торговый путь</button><button class="btn btn-paper" type="button" data-st="dragon">🐉 Нападение дракона</button><button class="btn btn-paper" type="button" data-st="lich">💀 Восстание лича</button><button class="btn btn-paper" type="button" data-st="giant">🧊 Ледяной великан</button></div>`,
    b => {
      b.querySelectorAll('input').forEach(i => { i.addEventListener('keydown', e => e.stopPropagation()); i.addEventListener('keyup', e => e.stopPropagation()); });
      const cfgNow = () => ({ invasion: { enabled: b.querySelector('#kOn').checked, everyDays: +b.querySelector('#kEvery').value, hour: +b.querySelector('#kHour').value, warnHours: +b.querySelector('#kWarn').value, durationMin: +b.querySelector('#kDur').value, difficulty: +b.querySelector('#kDiff').value }, events: { enabled: b.querySelector('#kEvOn').checked, everyDays: +b.querySelector('#kEvEvery').value } });
      const send = async body => { let r; if (R.state().demo) r = await localCall(R.state().nick, 'admin_world', body, true);
        else { const k = b.querySelector('#kKey').value.trim(); try { sessionStorage.setItem('kp-king', k); localStorage.setItem('kp-king', k); } catch { } const res = await fetch((window.KP_API || '') + '/rpg/admin_world', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ adminKey: k, ...body }) }); r = { status: res.status, data: await res.json().catch(() => ({})) }; }
        W.toast(r.status === 200 ? '👑 ' + (r.data.note || 'Готово') : (r.data.message || 'Не получилось')); if (r.status !== 200) return;
        if (body.start) { if (G.state && r.data.world) G.state.world = r.data.world; W.$('sheet').classList.remove('show'); render(); } await act('hero', {}, true); render(); };
      b.querySelector('#kSave').onclick = () => send({ config: cfgNow() });
      b.querySelector('#kLvSet').onclick = () => send({ setLevel: { nick: b.querySelector('#kLvNick').value.trim().replace(/^@/, ''), level: +b.querySelector('#kLv').value } });
      b.querySelector('#kCnSet').onclick = () => send({ giveCoins: { nick: b.querySelector('#kCnNick').value.trim().replace(/^@/, ''), coins: +b.querySelector('#kCn').value } });
      b.querySelectorAll('[data-st]').forEach(x => x.onclick = () => send({ start: x.dataset.st, warnMin: +(x.dataset.w || 0) }));
    });
}

// ---------------- цикл ----------------
export function render() { banner(); sync(); finale(); announce(); const wb = W.$('hudW'); if (wb) { const inv = world()?.events.find(e => e.kind === 'invasion'); wb.hidden = !G.state; wb.textContent = inv && inv.status === 'active' ? '🔥 Оборона' : '⚔️ Война'; } }
export function blockedExtra(x, z, r) { if (!V.barricade) return false; return Math.abs(x) < 1.6 + r && Math.abs(z - W.riverZ(0)) < 0.6 + r; }
let ambT = 0;
export function tick(now, dt) {
  for (const f of V.fires) { f.fl.forEach((m, i) => { m.scale.y = 0.85 + Math.sin(now / 90 + i * 2) * 0.18; m.rotation.y = now / 400 + i; });
    for (const m of f.sm) { m.userData.t = (m.userData.t + dt * 0.22) % 1; const k = m.userData.t; m.position.set(Math.sin(k * 6) * 0.3, f.s * (0.9 + k * 3.5), Math.cos(k * 5) * 0.25); m.scale.setScalar(0.6 + k * 1.8); m.material.opacity = 0.5 * (1 - k); } }
  for (const o of Object.values(V.machines)) { if (o.alive.userData.arm && o.alive.visible) o.alive.userData.arm.rotation.x = 0.5 + Math.max(0, Math.sin(now / 900)) * 1.2;
    const st = R.state(); if (o.alive.visible && st.on && st.pos && Math.hypot(st.pos.x - o.m.x, st.pos.z - o.m.z) < 26) { const v = new THREE.Vector3(o.m.x, o.m === SIEGE.machines.tower ? 6 : 2.4, o.m.z).project(W.camera);
      if (v.z < 1) { o.lab.style.display = 'block'; const html = `${o.m.name}<i style="width:${(100 * o.hp / o.m.hp).toFixed(0)}%"></i>`; if (o.lab.innerHTML !== html) o.lab.innerHTML = html; o.lab.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; o.lab.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; } else o.lab.style.display = 'none'; } else o.lab.style.display = 'none'; }
  if (V.fires.length) W.redraw();
  if (now - ambT > 1000) { ambT = now; banner(); }
}
export function initWorld(world0, k, rpg) {
  W = world0; K = k; THREE = W.THREE; R = rpg;
  const c = document.createElement('style'); c.textContent = `
  #warBanner { position: fixed; z-index: 3; left: 50%; transform: translateX(-50%); top: calc(max(12px, env(safe-area-inset-top)) + 150px); width: min(460px, calc(100% - 24px)); padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.4; text-align: center; pointer-events: auto; cursor: pointer; }
  body.playing #warBanner { top: calc(max(10px, env(safe-area-inset-top)) + 64px); } @media (max-width: 699px) { body.playing #warBanner { top: calc(max(10px, env(safe-area-inset-top)) + 118px); font-size: 12px; padding: 6px 10px; } } @media (max-width: 699px) { body:not(.playing) #warBanner { top: calc(max(10px, env(safe-area-inset-top)) + 128px); } }
  body.fighting #warBanner, body.carded #warBanner { display: none; }
  #warBanner { transform: translateX(-50%) scale(.56) !important; transform-origin: 50% 0; } /* оповещения о событиях: 56 % исходного размера */
  @media (max-width: 699px) { #warBanner { left: 50%; width: calc((100% - 24px) / .7); max-width: 560px; right: auto; } }
  #warBanner.warn { border-color: #E8B931; animation: pulseW 1.4s infinite; } #warBanner.hot { border-color: #ff4a3a; background: rgba(60,10,12,.9); } #warBanner i { display: block; height: 7px; border-radius: 6px; background: rgba(245,235,220,.18); margin-top: 5px; overflow: hidden; } #warBanner i b { display: block; height: 100%; background: #ff7a3a; }
  @keyframes pulseW { 50% { box-shadow: 0 0 0 4px rgba(232,185,49,.35); } }
  #finale { position: fixed; inset: 0; z-index: 9; display: grid; place-content: center; text-align: center; pointer-events: none; opacity: 0; transition: opacity .5s; background: radial-gradient(circle, rgba(0,0,0,.55), transparent 70%); }
  #finale.show { opacity: 1; } #finale b { display: block; font-family: var(--f-display); font-size: clamp(48px, 12vw, 110px); -webkit-text-stroke: 3px #1A1210; paint-order: stroke fill; } #finale span { font-weight: 800; font-size: 18px; color: var(--paper); }
  #finale.won b { color: var(--gold); animation: pop .7s ease-out; } #finale.ev b { color: var(--gold); font-size: clamp(30px, 8vw, 64px); max-width: 92vw; animation: pop .7s ease-out; } #finale span { display: block; max-width: min(560px, 90vw); margin: 6px auto 0; } #finale.lost b { color: #ff4a3a; animation: pop .7s ease-out; } @keyframes pop { from { transform: scale(.4); } to { transform: scale(1); } }`;
  document.head.appendChild(c);
  const b = document.createElement('div'); b.id = 'warBanner'; b.className = 'panel'; b.hidden = true; b.onclick = () => G.state ? warSheet() : W.toast('Войди и стань героем, чтобы защищать королевство: кнопка «Герой» справа.'); document.body.appendChild(b);
  const f = document.createElement('div'); f.id = 'finale'; f.hidden = true; document.body.appendChild(f);
  let kk = ''; try { kk = localStorage.getItem('kp-king') || sessionStorage.getItem('kp-king') || ''; } catch { }
  if (kk || /korol/.test(location.hash) || W.demo) { const kh = document.createElement('button'); kh.id = 'hudK'; kh.className = 'btn btn-gold'; kh.type = 'button'; kh.textContent = '👑 Указы'; kh.onclick = kingSheet; W.$('hudBtns').prepend(kh); } // король — указы прямо в «Мире героев»
  const hb = document.createElement('button'); hb.id = 'hudW'; hb.className = 'btn btn-paper'; hb.type = 'button'; hb.hidden = true; hb.textContent = '⚔️ Война'; hb.onclick = warSheet; W.$('hudBtns').prepend(hb);
  if (/korol/.test(location.hash) || W.demo) { const kb = document.createElement('button'); kb.className = 'panel'; kb.type = 'button'; kb.innerHTML = '<span style="font-size:20px">👑</span>Указы'; kb.onclick = kingSheet; W.$('mapctl').appendChild(kb); }
  loadPublic(); setInterval(() => { if (!document.hidden) loadPublic(); }, 120000); document.addEventListener('visibilitychange', () => { if (!document.hidden) loadPublic(); });
}
