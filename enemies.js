// Чёрный Орден на карте: рыцари в чёрных доспехах, лагерь с шатрами, частоколом, костром и катапультой, экран боя.
let SV = null; // общий вектор для проекции подписей
// Ход боя считает сервер (rpg-engine.mjs + combat.mjs); здесь — только вид и кнопки.
import { ENEMIES, KINDS, INTENT, DUEL_INTENT, ABIL, CAMP, enemyPos, enemyStats, cooldownLeft, MOVES, isNight } from './combat.mjs';
import { buildMonster, isMonster } from './monsters.js';
import { isBossEvent } from './world.mjs';
import { G, act } from './rpg-ui.js';
import { buildKnight as figKnight, flattenStatic, buildHero } from './figure.js';
let W, K, THREE, R;
const EN = new Map(); // id -> { e, g, lab, bar }
const STEEL = 0x24242C, DARK = 0x16161B, RED = 0xA4161A, BLADE = 0x6A707C;

// ---------------- модели — в figure.js ----------------
function box(p, w, h, d, c, pos, ol = 1.5) { return W.mesh(p, new THREE.BoxGeometry(w, h, d), c, { pos, ol }); }
export function buildKnight(kind) { return isMonster(kind) ? buildMonster(kind, KINDS[kind].scale) : figKnight(kind, KINDS[kind].scale); }

function camp() {
  const g = new THREE.Group(); g.position.set(CAMP.x, 0, CAMP.z); W.scene.add(g);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(CAMP.r + 1, 40), W.toon(0x5B4A3A)); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.035; ground.receiveShadow = true; g.add(ground);
  // частокол с воротами на юге и севере
  for (let a = 0; a < Math.PI * 2; a += 0.09) { const gate = Math.abs(Math.sin(a)) > 0.985; if (gate) continue;
    const x = Math.sin(a) * CAMP.r, z = Math.cos(a) * CAMP.r, h = 1.5 + ((a * 37) % 0.4);
    W.mesh(g, new THREE.CylinderGeometry(0.16, 0.18, h, 6), 0x3A2A1E, { pos: [x, h / 2, z], ol: 1.5 }); W.mesh(g, new THREE.ConeGeometry(0.16, 0.3, 6), 0x3A2A1E, { pos: [x, h + 0.15, z], ol: 1 });
    R.addObs({ x: CAMP.x + x, z: CAMP.z + z, c: 0.3, r: 0.3 }); }
  // шатры
  const tent = (x, z, c, s = 1) => { const t = W.mesh(g, new THREE.ConeGeometry(1.5 * s, 2.2 * s, 4), c, { pos: [x, 1.1 * s, z], rot: [0, Math.PI / 4, 0], ol: 2 }); W.mesh(g, new THREE.BoxGeometry(0.5 * s, 0.9 * s, 0.05), 0x0A0A0C, { pos: [x, 0.45 * s, z + 1.07 * s], ol: 0 }); R.addObs({ x: CAMP.x + x, z: CAMP.z + z, c: 1.3 * s, r: 1.3 * s }); return t; };
  tent(-6, -2, 0x1E1E24, 1.1); tent(9, 2.5, 0x5A0E10); tent(-6.5, 2.5, 0x5A0E10); tent(-3.5, -8.5, 0x1E1E24); tent(3.8, -8.2, 0x1E1E24, 1.4); // шатры не стоят на местах врагов и их дорожках
  // знамёна Ордена: чёрное полотнище с красной разбитой короной
  const flagTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#121216'; x.fillRect(0, 0, 64, 96); x.fillStyle = '#A4161A'; x.fillRect(0, 0, 64, 6);
    x.beginPath(); x.moveTo(14, 58); x.lineTo(18, 34); x.lineTo(26, 46); x.lineTo(32, 28); x.lineTo(36, 44); x.lineTo(30, 50); x.lineTo(40, 46); x.lineTo(46, 34); x.lineTo(50, 58); x.closePath(); x.fill(); x.fillRect(14, 62, 36, 6);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (const [x, z] of [[-1.6, CAMP.r - 0.4], [1.6, CAMP.r - 0.4], [-3, -3], [3.5, 1]]) { W.mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 3, 6), 0x1A1210, { pos: [x, 1.5, z], ol: 1 });
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshToonMaterial({ map: flagTex, gradientMap: W.grad, side: THREE.DoubleSide })); b.position.set(x + 0.42, 2.35, z); g.add(b); }
  // костёр с огнём и дымом
  const fire = new THREE.Group(); fire.position.set(1.2, 0, 3); g.add(fire);
  for (let k = 0; k < 5; k++) W.mesh(fire, new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6).rotateZ(Math.PI / 2).rotateY(k * 1.26), 0x3A2A1E, { pos: [0, 0.1, 0], ol: 1 });
  const flames = [0xFF7A1A, 0xFFB21A, 0xFF4A1A].map((c, i) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.07, 0.8 - i * 0.15, 6), new THREE.MeshBasicMaterial({ color: c })); m.position.y = 0.45; fire.add(m); return m; });
  const smoke = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color: 0x55535A, transparent: true, opacity: 0.5, depthWrite: false })); m.userData.t = i / 6; fire.add(m); return m; });
  R.addObs({ x: CAMP.x + 1.2, z: CAMP.z + 3, c: 0.6, r: 0.6 });
  // катапульта у южных ворот
  const cat = new THREE.Group(); cat.position.set(-4, 0, 8.5); cat.rotation.y = Math.PI; g.add(cat);
  for (const s of [-0.5, 0.5]) { box(cat, 0.12, 0.12, 1.8, 0x4A3424, [s, 0.3, 0]); box(cat, 0.12, 1.1, 0.12, 0x4A3424, [s, 0.85, -0.2]); for (const z of [-0.7, 0.7]) W.mesh(cat, new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10).rotateZ(Math.PI / 2), 0x2A1E16, { pos: [s * 1.12, 0.28, z], ol: 1 }); }
  const arm = new THREE.Group(); arm.position.set(0, 1.3, -0.2); cat.add(arm); box(arm, 0.1, 0.1, 1.9, 0x5A3E2A, [0, 0, 0.5]); W.mesh(arm, new THREE.SphereGeometry(0.2, 8, 6), 0x5E5A55, { pos: [0, 0.15, 1.4], ol: 1 }); arm.rotation.x = 0.5;
  R.addObs({ x: CAMP.x - 4, z: CAMP.z + 8.5, c: 1.1, r: 1.1 });
  flattenStatic(g, [fire, ground]);
  return { flames, smoke };
}

// ---------------- экран боя ----------------
let fx = null, campFx = null, prev = null, lastNear = null;
function css() {
  const c = document.createElement('style'); c.textContent = `
  .lbl.foe { background: #2A0A0C; border-color: #A4161A; font-size: 11.5px; } .lbl.foe i { display: block; height: 4px; margin-top: 3px; border-radius: 3px; background: #ff4a3a; }
  #fight { position: fixed; z-index: 6; left: 50%; transform: translateX(-50%); bottom: max(10px, env(safe-area-inset-bottom)); width: min(520px, calc(100% - 20px)); display: none; padding: 10px 12px; border-radius: 16px; }
  body.fighting #fight { display: block; } body.fighting #actBtn, body.fighting #talk, body.fighting #joy, body.fighting #hint, body.fighting #chatBtn { display: none !important; }
  #fight .bars { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px; font-weight: 800; } #fight .bar2 { height: 10px; border-radius: 9px; background: rgba(245,235,220,.15); border: 2px solid var(--ink); overflow: hidden; margin-top: 3px; } #fight .bar2 i { display: block; height: 100%; transition: width .3s; }
  #fight .intent { margin: 8px 0 6px; font-size: 13.5px; font-weight: 800; color: #ffb4a8; min-height: 18px; } #fight .moves { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  #fight .moves .btn { padding: 8px 4px; font-size: 13px; position: relative; overflow: hidden; } #fight .moves .btn[disabled] { opacity: .55; } #fight .moves .btn.wait { opacity: 1; outline: 3px solid var(--gold); outline-offset: -3px; } #fight .moves .btn small { display: block; font-size: 10.5px; opacity: .8; }
  #fight .log { margin-top: 6px; font-size: 12px; color: var(--muted); line-height: 1.35; max-height: 54px; overflow: hidden; }
  .dmg { position: fixed; z-index: 7; pointer-events: none; font-weight: 900; font-size: 22px; color: #ff4a3a; -webkit-text-stroke: 1px #1A1210; paint-order: stroke fill; animation: dmg 1s ease-out forwards; } .dmg.heal { color: #7BD15A; } .dmg.me { color: #ffd04a; }
  @keyframes dmg { from { transform: translate(-50%, 0); opacity: 1; } to { transform: translate(-50%, -60px); opacity: 0; } }`;
  document.head.appendChild(c);
  const p = document.createElement('div'); p.id = 'fight'; p.className = 'panel'; document.body.appendChild(p);
}
function screenOf(x, y, z) { const v = (SV || (SV = new THREE.Vector3())).set(x, y, z).project(W.camera); return v.z < 1 ? [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight] : null; }
function popNum(x, y, z, text, cls = '') { const s = screenOf(x, y, z); if (!s) return; const d = document.createElement('div'); d.className = 'dmg ' + cls; d.textContent = text; d.style.left = s[0] + 'px'; d.style.top = s[1] + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let fightLog = [];
let FP = null; // разметка панели боя строится один раз за бой; дальше меняются только числа — кнопки не пересоздаются и клики не теряются
function renderFight() {
  const c = G.state?.combat, f = c?.fight, p = W.$('fight'); document.body.classList.toggle('fighting', !!f && R.state().on);
  if (!f) { FP = null; return; }
  const es = f.es || enemyStats({ kind: f.kind, lvl: f.lvl }), now = Date.now(), ab = c.ability;
  const moves = [['attack', '⚔️ Атака', '1'], ['defend', '🛡️ Защита', '2'], ['dodge', '💨 Уворот', '3'], ...(ab ? [[ab.id, '✨ ' + ab.name, '4']] : []), ['potion', '🧪 Зелье', '5'], ['flee', '🏃 Отступить', '6']];
  const key = f.enemy + '|' + moves.map(m => m[0]).join(',');
  if (!FP || FP.key !== key || !p.contains(FP.eBar)) {
    p.innerHTML = `<div class="bars"><div><span data-f="eName"></span><div class="bar2"><i data-f="eBar" style="background:#ff4a3a"></i></div><span data-f="eHp"></span></div>
      <div>Ты · ${R.state().role?.name || ''}<div class="bar2"><i data-f="hBar" style="background:#7BD15A"></i></div><span data-f="hHp"></span></div></div>
      <div class="intent" data-f="intent"></div>
      <div class="moves">${moves.map(([mv, label, k]) => `<button class="btn ${mv === ab?.id ? 'btn-gold' : 'btn-paper'}" type="button" data-mv="${mv}"><span>${label}</span><small>${k}</small></button>`).join('')}</div>
      <div class="log" data-f="log"></div>`;
    FP = { key }; p.querySelectorAll('[data-f]').forEach(el => FP[el.dataset.f] = el);
    FP.btns = [...p.querySelectorAll('[data-mv]')]; FP.btns.forEach(b => b.onpointerdown = e => { e.preventDefault(); move(b.dataset.mv); });
  }
  const set = (el, prop, v) => { if (el[prop] !== v) el[prop] = v; };
  // босс события: показываем ОБЩЕЕ здоровье (одно на всех героев), а не личную копию
  const wd = G.state?.world, we = wd?.enemies?.find(x => x.id === f.enemy), bev = KINDS[f.kind]?.boss && wd?.events?.find(ev => ev.status === 'active' && (we?.event ? ev.id === we.event : isBossEvent(ev.kind)) && isBossEvent(ev.kind));
  const eHp = bev ? Math.max(0, bev.goal - bev.progress) : f.eHp, eMax = bev ? bev.goal : f.eMax;
  set(FP.eName, 'textContent', `${es.name} · ур. ${f.lvl}`); set(FP.eHp, 'textContent', bev ? `${eHp} / ${eMax} · общее` : `${f.eHp} / ${f.eMax}`); set(FP.hHp, 'textContent', `${f.hHp} / ${f.hMax}`);
  FP.eBar.style.width = (100 * eHp / Math.max(1, eMax)).toFixed(0) + '%'; FP.hBar.style.width = (100 * f.hHp / f.hMax).toFixed(0) + '%';
  set(FP.intent, 'textContent', `⚠ ${es.name} ${(f.es && DUEL_INTENT[f.next]) || INTENT[f.next] || ''}`); set(FP.log, 'innerHTML', fightLog.slice(-3).join('<br>'));
  for (const b of FP.btns) { const mv = b.dataset.mv, left = mv === 'flee' ? 0 : cooldownLeft(f, mv, G.state.hero.role, now) || 0, sm = b.lastChild, lab = b.firstChild;
    const dis = moving || left > 0 || (mv === 'potion' && !c.potions); if (b.disabled !== dis) b.disabled = dis;
    b.classList.toggle('wait', moving && pendingMv === mv);
    set(sm, 'textContent', left > 0 ? Math.ceil(left / 1000) + ' с' : moving && pendingMv === mv ? '…' : moves.find(m => m[0] === mv)[2]);
    if (mv === 'potion') set(lab, 'textContent', `🧪 Зелье ×${c.potions}`); }
}
let moving = false, pendingMv = null;
async function move(mv) {
  const f = G.state?.combat?.fight; if (!f || moving) return; moving = true; pendingMv = mv; renderFight();
  const before = { e: f.eHp, h: f.hHp }, o = EN.get(f.enemy) || (SH && SH.id === f.enemy ? SH : null), hero = R.state();
  if (['attack', G.state.combat.ability?.id].includes(mv)) swing(hero.hero);
  const r = await act('fight', { enemy: f.enemy, move: mv }, true); moving = false; pendingMv = null;
  if (!r) { renderFight(); return; } if (r.status !== 200) { W.toast(r.data.message || 'Не получилось'); renderFight(); return; }
  fightLog.push(...(r.data.log || [])); if (fightLog.length > 12) fightLog = fightLog.slice(-12);
  const nf = r.data.combat.fight, eHp = nf ? nf.eHp : r.data.result === 'won' ? 0 : before.e, hHp = nf ? nf.hHp : r.data.combat.hp;
  if (o && eHp < before.e) { popNum(o.g.position.x, 2.2, o.g.position.z, '−' + (before.e - eHp)); hurt(o.g); }
  if (hHp < before.h) { popNum(hero.pos.x, 2, hero.pos.z, '−' + (before.h - hHp), 'me'); if (o) swing(o.g); }
  if (hHp > before.h && mv !== 'flee') popNum(hero.pos.x, 2, hero.pos.z, '+' + (hHp - before.h), 'heal');
  if (r.data.result === 'won') { W.toast(fightLog.at(-1)); fightLog = []; }
  if (r.data.result === 'lost') { if (r.data.arena) W.toast(fightLog.at(-1)); else { W.toast('Ты повержен… Тебя отнесли к воротам замка.'); hero.pos.set(1.8, 0, 9.9); } fightLog = []; }
  if (r.data.arena && mv === 'flee' && r.data.note) W.toast(r.data.note);
  if (mv === 'flee') fightLog = [];
  renderFight();
}
function swing(g) { const a = g?.userData?.armR; if (!a) return; a.rotation.x = -2.2; setTimeout(() => { a.rotation.x = 0; }, 260); }
function hurt(g) { g.scale.multiplyScalar(0.9); setTimeout(() => g.scale.multiplyScalar(1 / 0.9), 150); }

// ---------------- цикл ----------------
let dynKey = '';
function syncDyn() {
  const list = G.state?.world?.enemies || [], key = list.map(e => e.id).join(','); if (key === dynKey) return; dynKey = key;
  const want = new Set(list.map(e => e.id));
  for (const [id, o] of EN) if (o.dyn && !want.has(id)) { W.scene.remove(o.g); o.lab.remove(); EN.delete(id); }
  for (const e of list) if (!EN.has(e.id)) { const g = buildKnight(e.kind); W.scene.add(g); const lab = document.createElement('div'); lab.className = 'lbl foe'; lab.style.display = 'none'; W.$('labels').appendChild(lab); EN.set(e.id, { e, g, lab, t: Math.random() * 9, dyn: true }); }
}
// тень соперника на арене: фигура его роли, тёмная и полупрозрачная
let SH = null;
function syncShadow(f) {
  const want = f && f.es ? f.enemy : null; if ((SH && SH.id) === want) return;
  if (SH) { W.scene.remove(SH.g); SH.lab.remove(); SH = null; } if (!want) return;
  const role = W.ROLES.find(r => r.id === f.es.role) || W.ROLES[0], g = buildHero(role, f.es.nick);
  g.traverse(m => { if (m.isMesh && m.material) { const mt = (Array.isArray(m.material) ? m.material : [m.material]).map(x => { const c = x.clone(); if (c.color) c.color.multiplyScalar(0.09).lerp(new W.THREE.Color(0x3A1F66), 0.3); c.transparent = true; c.opacity = 0.82; return c; }); m.material = Array.isArray(m.material) ? mt : mt[0]; } });
  const ring = new W.THREE.Mesh(new W.THREE.RingGeometry(0.42, 0.78, 28), new W.THREE.MeshBasicMaterial({ color: 0x8E5BD6, transparent: true, opacity: 0.55, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; g.add(ring);
  W.scene.add(g); const lab = document.createElement('div'); lab.className = 'lbl foe'; W.$('labels').appendChild(lab); SH = { id: want, g, lab, t: 0, ring };
}
export function tick(now, dt) {
  syncDyn(); syncShadow(G.state?.combat?.fight);
  if (SH) { const f = G.state.combat.fight, st0 = R.state(); SH.g.position.set(f.ex, 0, f.ez); SH.g.rotation.y = st0.pos ? Math.atan2(st0.pos.x - f.ex, st0.pos.z - f.ez) : 0; SH.t += dt; R.animate(SH.g, SH.t, 0); SH.ring.material.opacity = 0.4 + Math.sin(now / 260) * 0.15;
    const s = screenOf(f.ex, 2.1, f.ez); if (s) { SH.lab.style.display = 'block'; const html = `${esc(f.es.name)} · ${f.lvl}<i style="width:${(100 * f.eHp / f.eMax).toFixed(0)}%"></i>`; if (SH.lab.innerHTML !== html) SH.lab.innerHTML = html; SH.lab.style.left = s[0] + 'px'; SH.lab.style.top = s[1] + 'px'; } else SH.lab.style.display = 'none'; }
  const st = R.state(), def = G.state?.combat?.defeated || {}, f = G.state?.combat?.fight, t = Date.now();
  for (const o of EN.values()) {
    const dead = def[o.e.id] > t || (o.e.night && !isNight(t)); o.g.visible = !dead; // утопцы днём спят на дне if (dead) { o.lab.style.display = 'none'; continue; }
    const inFight = f && f.enemy === o.e.id; let p;
    if (inFight) { p = { x: f.ex, z: f.ez, face: st.pos ? Math.atan2(st.pos.x - f.ex, st.pos.z - f.ez) : 0, moving: false }; }
    else p = enemyPos(o.e, t);
    const far = Math.hypot(W.target.x - p.x, W.target.z - p.z) > 60; o.g.visible = !far; // дальних не рисуем и не анимируем
    if (far) { o.lab.style.display = 'none'; continue; }
    o.g.position.set(p.x, 0, p.z); let df = p.face - o.g.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); o.g.rotation.y += df * Math.min(1, dt * 6);
    o.t += dt; R.animate(o.g, o.t, p.moving ? (o.e.speed || 1.1) : 0);
    if (st.on && st.pos && Math.hypot(st.pos.x - p.x, st.pos.z - p.z) < 26) {
      const s = screenOf(p.x, KINDS[o.e.kind].lab || 1.95 * KINDS[o.e.kind].scale, p.z);
      if (s) { o.lab.style.display = 'block'; const hp = inFight ? `<i style="width:${(100 * f.eHp / f.eMax).toFixed(0)}%"></i>` : ''; const html = `${KINDS[o.e.kind].name} · ${o.e.lvl}${hp}`; if (o.lab.innerHTML !== html) o.lab.innerHTML = html; o.lab.style.left = s[0] + 'px'; o.lab.style.top = s[1] + 'px'; } else o.lab.style.display = 'none';
    } else o.lab.style.display = 'none';
  }
  if (campFx && Math.hypot(W.target.x - CAMP.x, W.target.z - CAMP.z) < 80) { campFx.flames.forEach((m, i) => { m.scale.y = 0.85 + Math.sin(now / 90 + i * 2) * 0.18; m.rotation.y = now / 400 + i; });
    for (const m of campFx.smoke) { m.userData.t = (m.userData.t + dt * 0.25) % 1; const k = m.userData.t; m.position.set(Math.sin(k * 6 + m.id) * 0.3, 0.8 + k * 3.2, Math.cos(k * 5) * 0.2); m.scale.setScalar(0.6 + k * 1.6); m.material.opacity = 0.5 * (1 - k); } }
  // кнопка «Сразиться» рядом с врагом
  if (st.on && st.pos && !f && G.state?.combat) {
    let best = null, bd = 4.2; for (const o of EN.values()) { if (!o.g.visible) continue; const d = Math.hypot(st.pos.x - o.g.position.x, st.pos.z - o.g.position.z); if (d < bd) { bd = d; best = o; } }
    R.setFoe(best ? { id: best.e.id, label: `⚔️ Сразиться: ${KINDS[best.e.kind].name} (ур. ${best.e.lvl})` } : null);
  } else R.setFoe(null);
  if (f && now - (fx || 0) > 500) { fx = now; renderFight(); }
  if (!f && document.body.classList.contains('fighting')) document.body.classList.remove('fighting');
}
export async function startFight(id) { fightLog = []; const r = await act('fight', { enemy: id, move: 'start' }, true); if (r && r.status === 200) { fightLog.push(...(r.data.log || [])); renderFight(); } else if (r) W.toast(r.data.message || 'Не получилось'); }

export function initEnemies(world, k, rpg) {
  W = world; K = k; THREE = W.THREE; R = rpg; css(); campFx = camp();
  for (const e of ENEMIES) { const g = buildKnight(e.kind); W.scene.add(g); const lab = document.createElement('div'); lab.className = 'lbl foe'; lab.style.display = 'none'; W.$('labels').appendChild(lab); EN.set(e.id, { e, g, lab, t: Math.random() * 9 }); }
  addEventListener('keydown', e => { if (!G.state?.combat?.fight || e.target.closest?.('input,textarea')) return; const map = { Digit1: 'attack', Digit2: 'defend', Digit3: 'dodge', Digit4: G.state.combat.ability?.id, Digit5: 'potion', Digit6: 'flee' }; if (map[e.code]) { e.preventDefault(); move(map[e.code]); } });
}
