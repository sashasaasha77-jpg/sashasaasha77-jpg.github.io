// «Королевство подписчиков» — RPG: герой, передвижение, столкновения, камера, джойстик, сохранение в базе.
let SV = null; // общий вектор для проекции подписей
import { initNpc, tick as npcTick, marks as npcMarks } from './npc.js';
import { initUi, act, G, tick as uiTick, render as uiRender, setFoe } from './rpg-ui.js';
import { blockedSite } from './resursy.js';
import { initEnemies, tick as enemyTick, startFight, buildKnight } from './enemies.js';
import { initWorld, tick as worldTick, render as worldRender, warAction, doWar, blockedExtra } from './world-ui.js';
import { roleIdFor } from './roles.mjs';
import { buildHero } from './figure.js';
import { animate3d, loadM3D, m3dReady } from './hero3d.js';
import { lookKey } from './extras.mjs';
import { activeGear, gearSlot } from './combat.mjs';
import { buildHorse, rideHorse, horseVariant } from './monsters.js';
import { initNet, connect, disconnect, tick as netTick, NET, retrack, reloadSquadChat } from './net.js';
let W, K, THREE;
const S = { on: false, hero: null, nick: '', role: null, demo: false, pos: null, face: 0, keys: new Set(), joy: { x: 0, y: 0, on: false }, speed: 0, t: 0, saveT: 0, prev: null, jy: 0, vy: 0, sit: false, sitK: 0, mount: false, horse: null };

// ---------------- внешний вид героя по роли — модели в figure.js ----------------
export { buildHero };
// загрузка героя с сервера: при ошибке показываем причину и пробуем ещё раз (до 3 раз)
async function loadHero(tries = 3) {
  const r = await act('hero', {}, true); if (S.demo || G.state || (r && r.status === 200)) return r;
  if (!r) return r;
  W.toast('Герой не загрузился: ' + (r.data?.message || 'ошибка ' + r.status) + (tries > 1 ? ' Пробую ещё раз…' : ''));
  if (tries > 1 && S.on) { await new Promise(res => setTimeout(res, 4000)); if (S.on) return loadHero(tries - 1); }
  return r;
}

// конь: купить у торговца, сесть/слезть — кнопка 🐎 или клавиша H
const hasHorse = () => (G.state?.inventory || []).some(i => i.item === 'horse' && i.qty > 0);
function setMount(v) { S.mount = v; if (S.horseBtn) S.horseBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); if (v) setSit(false); if (!v && S.hero) { S.hero.userData.body.position.y = 0; } }
function toggleMount() { if (!S.on) return; if (!hasHorse()) { W.toast('Коня можно купить у торговца на площади — 600 монет.'); return; } setMount(!S.mount); }
function jump() { if (!S.on || S.jy > 0 || S.vy || S.mount) return; if (S.sit) { setSit(false); return; } S.vy = 5.6; }
function setSit(v) { S.sit = v; if (S.sitBtn) S.sitBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); }
function toggleSit() { if (!S.on || S.jy > 0) return; if (S.mount) setMount(false); setSit(!S.sit); }
// поза поверх обычной анимации: сидит на земле / поджимает ноги в прыжке
function poseHero(h, dt) {
  if (h.userData.a3) { h.userData.mode = S.mount ? 'ride' : S.sit ? 'sit' : S.jy > 0 ? 'jump' : null; return; }
  const u = h.userData, L = (a, b, k) => a + (b - a) * k;
  S.sitK += ((S.sit ? 1 : 0) - S.sitK) * Math.min(1, dt * 9); const k = S.sitK;
  if (k > 0.01) { u.body.position.y = L(u.body.position.y, -0.34, k); u.body.rotation.x = L(u.body.rotation.x, -0.06, k);
    u.legL.rotation.x = L(u.legL.rotation.x, -1.45, k); u.legR.rotation.x = L(u.legR.rotation.x, -1.35, k);
    u.armL.rotation.x = L(u.armL.rotation.x, -0.35, k); u.armR.rotation.x = L(u.armR.rotation.x, -0.25, k); }
  if (S.jy > 0) { u.legL.rotation.x = -0.7; u.legR.rotation.x = 0.35; u.armL.rotation.x = -2.6; u.armR.rotation.x = -2.6; u.body.position.y = 0; }
}
function animateHero(h, t, speed) {
  if (h.userData.a3) { animate3d(h, t, speed); return; }
  const u = h.userData, k = Math.min(1, speed / 3), run = speed > 4.2, f = run ? 13 : 9, a = (run ? 0.9 : 0.6) * k, s = Math.sin(t * f);
  u.legL.rotation.x = s * a; u.legR.rotation.x = -s * a; u.armL.rotation.x = -s * a * 0.9; u.armR.rotation.x = s * a * 0.6;
  u.body.position.y = Math.abs(Math.sin(t * f)) * 0.05 * k + (k ? 0 : Math.sin(t * 2) * 0.008);
  u.body.rotation.x = run ? 0.12 : 0.03 * k; if (u.cape) u.cape.rotation.x = 0.12 + k * (run ? 0.6 : 0.3) + Math.sin(t * f * 0.5) * 0.05 * k;
  u.head.rotation.y = k ? 0 : Math.sin(t * 0.6) * 0.25;
}

// ---------------- столкновения ----------------
const CELL = 4, grid = new Map();
const key = (cx, cz) => cx * 100003 + cz;
function addObs(o) { const x0 = Math.floor((o.x - o.r) / CELL), x1 = Math.floor((o.x + o.r) / CELL), z0 = Math.floor((o.z - o.r) / CELL), z1 = Math.floor((o.z + o.r) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const k = key(cx, cz); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); } }
function buildObstacles() {
  grid.clear();
  for (const o of W.RPG_OBS || []) addObs(o);                                                               // «Мир героев»: крепостная стена, башни, двор (домов подписчиков здесь нет)
  for (const [x, z, s] of W.TREES) addObs({ x, z, c: 0.3 * s, r: 0.3 * s });
  for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) addObs({ x, z, c: 1.95, r: 1.95 });        // башни замка
  addObs({ x: 0, z: 0, hx: 7.65, hz: 7.65, r: 11 });                                                     // стены и донжон
  addObs({ x: 0, z: 7.4, hx: 3, hz: 0.75, r: 3.2 });                                                      // ворота (решётка опущена)
  addObs({ x: 0.3, z: 9.0, c: 0.55, r: 0.55 });                                                           // король
  addObs({ x: -4.8, z: 8.6, c: 0.95, r: 0.95 });                                                          // фонтан
  // стройки карты подписчиков (ярмарка, собор, мельница) в «Мир героев» не переносятся — их места здесь пустые и проходимые
}
function blocked(x, z, r) {
  if (Math.abs(x) > W.RLIM || Math.abs(z) > W.RLIM) return true; // за картой — лес, его можно рубить
  if (blockedExtra(x, z, r)) return true;
  if (blockedSite(x, z, r)) return true; // общие стройки во дворе
  const dz = Math.abs(z - W.riverZ(x));
  if (dz < 3.35 + r) { const bx = Math.round(x / W.PITCH); if (!W.BRIDGES.includes(bx) || Math.abs(x - bx * W.PITCH) > W.ROAD / 2 + 0.25 - r) return true; } // реку переходят только по мостам
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const list = grid.get(key(cx, cz)); if (!list) continue;
    for (const o of list) {
      if (o.c != null) { if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.c + r) ** 2) return true; }
      else if (Math.abs(x - o.x) < o.hx + r && Math.abs(z - o.z) < o.hz + r) return true;
    } }
  return false;
}
function freeSpot(x, z) { if (!blocked(x, z, 0.3)) return [x, z]; for (let rad = 0.5; rad < 30; rad += 0.5) for (let a = 0; a < 6.28; a += 0.4) { const nx = x + Math.cos(a) * rad, nz = z + Math.sin(a) * rad; if (!blocked(nx, nz, 0.3)) return [nx, nz]; } return [1.8, 9.9]; }

// ---------------- интерфейс ----------------
function ui() {
  const css = document.createElement('style'); css.textContent = `
  body.playing .top, body.playing #vote, body.playing .econ, body.playing #mapctl, body.playing #tour { display: none !important; }
  #hud { position: fixed; z-index: 3; left: max(10px, env(safe-area-inset-left)); top: max(10px, env(safe-area-inset-top)); display: none; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px; max-width: calc(100% - 20px); }
  body.playing #hud { display: flex; }
  #hud { transform: scale(.7); transform-origin: 0 0; max-width: calc((100% - 20px) / .7); } /* панель героя на 30% меньше */
  #hudMin { flex: none; width: 34px; height: 34px; padding: 0 !important; border-radius: 50% !important; font-size: 15px !important; line-height: 1; order: 99; }
  body.hudmin #hud > :not(#hudCrest):not(.who):not(#hudMin) { display: none !important; } body.hudmin #hud { flex-wrap: nowrap; }
  #hud .who { display: grid; line-height: 1.15; min-width: 0; } #hud .who b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } #hud .who small { font-size: 12px; color: var(--gold); font-weight: 800; }
  #hud .btn { padding: 7px 12px; font-size: 13px; border-radius: 10px; box-shadow: 2px 2px 0 var(--ink); }
  #hint { position: fixed; z-index: 3; left: 50%; transform: translateX(-50%); bottom: max(14px, env(safe-area-inset-bottom)); display: none; font-size: 12.5px; font-weight: 700; padding: 6px 12px; border-radius: 10px; white-space: nowrap; }
  body.playing #hint { display: block; } body.playing.carded #hint { display: none; }
  #joy { position: fixed; z-index: 3; left: max(18px, env(safe-area-inset-left)); bottom: calc(max(18px, env(safe-area-inset-bottom)) + 40px); width: 124px; height: 124px; border-radius: 50%; background: rgba(14,20,36,.45); border: 3px solid rgba(245,235,220,.5); display: none; touch-action: none; }
  #joy i { position: absolute; left: 50%; top: 50%; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; background: var(--gold); border: 3px solid var(--ink); box-shadow: 2px 2px 0 var(--ink); }
  @media (pointer: coarse) { body.playing #joy { display: block; } body.playing #hint { display: none; } }
  body.playing.carded #joy { display: none; }
  .pose { position: fixed; z-index: 3; bottom: calc(max(18px, env(safe-area-inset-bottom)) + 52px); width: 54px; height: 54px; border-radius: 50%; display: none; place-items: center; font-size: 24px; line-height: 1; padding: 0; cursor: pointer; background: var(--night); border: 3px solid var(--gold); color: #F5EBDC; box-shadow: 2px 2px 0 var(--ink); touch-action: manipulation; }
  .pose:active, .pose[aria-pressed="true"] { background: var(--gold); }
  #bJump { left: calc(max(18px, env(safe-area-inset-left)) + 136px); } #bSit { left: calc(max(18px, env(safe-area-inset-left)) + 198px); } #bHorse { left: calc(max(18px, env(safe-area-inset-left)) + 167px); bottom: calc(max(18px, env(safe-area-inset-bottom)) + 116px); }
  #bEye { left: calc(max(18px, env(safe-area-inset-left)) + 229px); bottom: calc(max(18px, env(safe-area-inset-bottom)) + 116px); font-size: 22px; } @media (pointer: fine) { body.playing #bEye { display: grid; left: auto; right: 18px; bottom: 150px; } }
  body:not(.hashorse) #bHorse { display: none !important; } @media (pointer: fine) { body.playing.hashorse #bHorse { display: grid; left: auto; right: 18px; bottom: 90px; } }
  @media (pointer: coarse) { body.playing .pose { display: grid; } } body.playing.carded .pose, body.chatting .pose { display: none !important; }
  .lbl.hero { background: var(--gold); color: var(--ink); font-size: 13px; padding: 4px 9px; z-index: 3; }
`;
  document.head.appendChild(css);
  const hud = document.createElement('div'); hud.id = 'hud'; hud.className = 'panel';
  hud.innerHTML = `<div id="hudCrest"></div><div class="who"><b id="hudNick"></b><small id="hudRole"></small></div><button class="btn btn-paper" id="hudExit" type="button">Выйти</button>`;
  document.body.appendChild(hud);
  { // стрелка: свернуть панель до герба и ника, состояние запоминается
    const mb = document.createElement('button'); mb.id = 'hudMin'; mb.type = 'button'; mb.className = 'btn btn-paper';
    let min = false; try { min = localStorage.getItem('kp-hud-min') === '1'; } catch { }
    const paint = () => { document.body.classList.toggle('hudmin', min); mb.textContent = min ? '▼' : '▲'; mb.title = min ? 'Показать панель' : 'Свернуть панель'; mb.setAttribute('aria-label', mb.title); };
    mb.onclick = e => { e.stopPropagation(); min = !min; try { localStorage.setItem('kp-hud-min', min ? '1' : '0'); } catch { } paint(); W.redraw && W.redraw(); };
    hud.appendChild(mb); paint();
  }
  const hint = document.createElement('div'); hint.id = 'hint'; hint.className = 'panel'; hint.textContent = 'WASD или стрелки — идти · Shift — бег · Пробел — прыжок · C — сесть · мышь или Q/E — повернуть камеру · колесо — приблизить';
  document.body.appendChild(hint);
  const joy = document.createElement('div'); joy.id = 'joy'; joy.innerHTML = '<i></i>'; joy.setAttribute('aria-hidden', 'true'); document.body.appendChild(joy);
  const lab = document.createElement('div'); lab.className = 'lbl hero'; lab.style.display = 'none'; lab.style.left = lab.style.top = '0'; W.$('labels').appendChild(lab); S.label = lab;
  const btn = W.$('bHero'); // кнопка «Мир героев» внизу, на месте бывшей мини-игры
  btn.addEventListener('click', start); W.$('hudExit').addEventListener('click', stop);
  // джойстик
  const knob = joy.firstChild; let jid = null;
  const move = e => { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    S.joy.x = dx; S.joy.y = dy; knob.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`; };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); S.joy.on = true; move(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) move(e); });
  const end = e => { if (e.pointerId !== jid) return; jid = null; S.joy = { x: 0, y: 0, on: false }; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  addEventListener('keydown', e => { if (!S.on || e.target.closest?.('input,textarea')) return; const k = e.code; if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(k)) { S.keys.add(k); e.preventDefault(); } });
  addEventListener('keyup', e => S.keys.delete(e.code)); addEventListener('blur', () => S.keys.clear());
  // прыжок и «сесть»: Пробел / C на компьютере, круглые кнопки у джойстика на телефоне
  const pb = (id, ic, label, fn) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'pose'; b.textContent = ic; b.setAttribute('aria-label', label); b.addEventListener('click', e => { e.preventDefault(); fn(); }); document.body.appendChild(b); return b; };
  S.eyeBtn = pb('bEye', '👁', 'Вид от первого лица', toggleFpv); pb('bJump', '⤒', 'Прыгнуть', jump); S.sitBtn = pb('bSit', '🪑', 'Сесть или встать', toggleSit); S.horseBtn = pb('bHorse', '🐎', 'Сесть на коня или слезть', toggleMount);
  addEventListener('keydown', e => { if (!S.on || e.repeat || e.target.closest?.('input,textarea,button')) return; if (e.code === 'Space') { jump(); e.preventDefault(); } else if (e.code === 'KeyC') toggleSit(); else if (e.code === 'KeyH') toggleMount(); else if (e.code === 'KeyV') toggleFpv(); });
}

// ---------------- вход в игру ----------------
function who() {
  if (K.me && K.me.nick) { const p = K.byNick.get(K.me.nick); if (p && p.status === 'ruins') return { error: 'Твой дом разрушен: тебя нет в списке подписчиков. Подпишись снова, и дом с героем вернутся.' }; return { nick: K.me.nick, role: K.roleFor(K.me.nick), house: p }; }
  if (W.demo) { let n = null; try { n = localStorage.getItem('kp-demo-nick'); } catch { } if (!n) { n = 'demo_' + String(Math.floor(1000 + Math.random() * 9000)); try { localStorage.setItem('kp-demo-nick', n); } catch { } } return { nick: n, role: W.ROLES.find(r => r.id === roleIdFor(n)), demo: true }; }
  return null;
}
// модель героя — по роли с сервера (её можно сменить за монеты), иначе по жеребьёвке ника
// оружие в руке героя — лучшее надетое в слоте «оружие»
export function myWeapon() { const eq = (G.state?.inventory || []).filter(i => i.equipped).map(i => i.item); return activeGear(eq).find(i => gearSlot(i) === 'weapon') || ''; }
// вид от первого лица: кнопка 👁 у джойстика или клавиша V
function toggleFpv(on) {
  const F = W.FPV; if (!F || !S.on) return; F.on = typeof on === 'boolean' ? on : !F.on; F.p = 0;
  W.camera.near = F.on ? 0.08 : 0.5; W.camera.fov = F.on ? 68 : 42; W.camera.updateProjectionMatrix();
  if (F.on) W.yaw = S.face + Math.PI; else { S.hero.visible = true; if (S.horse) S.horse.visible = S.mount; }
  S.eyeBtn && S.eyeBtn.setAttribute('aria-pressed', F.on ? 'true' : 'false'); document.body.classList.toggle('fpv', F.on);
  try { localStorage.setItem('kp-fpv', F.on ? '1' : '0'); } catch { } W.toast && W.toast(F.on ? '👁 Вид от первого лица. Смотри по сторонам, ведя пальцем или мышью по экрану' : 'Обычный вид'); W.redraw();
}
function ensureHero(w) {
  const rid = G.state?.hero?.role, role = (rid && W.ROLES.find(r => r.id === rid)) || w.role, wp = myWeapon(), lk = lookKey(G.state?.extra?.look?.cur || {}) + (G.state?.extra?.cls ? '.' + G.state.extra.cls : ''), key = w.nick + '|' + role.id + '|' + wp + '|' + lk + '|' + (W.M3D_ON && m3dReady() ? '3d' : '');
  if (S.hero && S.heroOf === key) return;
  const old = S.hero, wpChanged = old && (S.wp !== wp || S.lk !== lk); S.hero = buildHero(role, w.nick, wp, lk); S.heroOf = key; S.role = role; S.wp = wp; S.lk = lk; if (wpChanged && S.on) retrack(); // другие увидят новое оружие и наряд
  if (old) { S.hero.position.copy(old.position); S.hero.rotation.copy(old.rotation); S.hero.visible = old.visible; W.scene.remove(old); }
  W.scene.add(S.hero);
}
async function start() {
  const w = who();
  if (!w) { W.toast('Войди со своим ником и PIN, чтобы получить героя'); W.$('chip').click(); return; }
  if (w.error) { W.toast(w.error); return; }
  if (S.on || S.loading) return;
  if (!grid.size) buildObstacles();
  if (!window.W.ECO && !window.W.M3D_OFF) { window.W.M3D_ON = W.M3D_ON = true; loadM3D(); } // 3D-герои с анимацией (в эко-режиме — простые фигурки)
  if (S.nick !== w.nick) G.state = null; S.nick = w.nick; S.demo = !!w.demo; S.role = w.role;
  S.loading = true; await act('hero', {}, true); S.loading = false;
  ensureHero(w);
  let saved = null; try { saved = JSON.parse(localStorage.getItem('kp-hero-' + S.nick)); } catch { }
  const sh = G.state && G.state.hero; if (sh && sh.x !== null && Number.isFinite(sh.x)) saved = { x: sh.x, z: sh.z, f: sh.face };
  let x, z; if (saved && Number.isFinite(saved.x)) { x = saved.x; z = saved.z; S.face = saved.f || 0; }
  else { x = 1.8; z = 9.9; S.face = 0; } // первый вход — у ворот замка
  W.setWorld('rpg'); ROOT.visible = true;
  [x, z] = freeSpot(x, z); S.pos = new THREE.Vector3(x, 0, z); S.hero.position.copy(S.pos); S.hero.rotation.y = S.face; S.hero.visible = true;
  S.prev = { dist: W.dist, pitch: W.pitch }; W.stopFly(); W.dist = 13; W.pitch = 0.88; W.PLAY.on = true; S.on = true;
  W.$('hudCrest').innerHTML = W.crest(w.role, 34); W.$('hudNick').textContent = '@' + S.nick + (S.demo ? ' (демо)' : ''); W.$('hudRole').textContent = w.role.name; if (G.state) uiRender();
  connect({ nick: S.nick, role: w.role.id, level: G.state?.hero.level || 1, demo: S.demo }, () => act('hero', {}, true));
  document.body.classList.add('playing'); W.$('card').classList.remove('show'); document.body.classList.remove('carded');
  W.toast(S.demo ? 'Демо-герой. Настоящий герой появится у каждого подданного после входа' : `Добро пожаловать в Мир героев, ${w.role.name.toLowerCase()} @${S.nick}!`);
  if (!S.demo && !G.state) setTimeout(() => S.on && !G.state && loadHero(), 1500); // герой не загрузился — покажем причину и попробуем ещё
}
function saveServer(force) { const auth = K.auth && K.auth(); if (S.demo || !auth || !G.state || !S.pos) return; const k = S.pos.x.toFixed(1) + ',' + S.pos.z.toFixed(1); if (!force && k === S.srvK) return; S.srvK = k; fetch((window.KP_API || '') + '/rpg/pos', { method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true, body: JSON.stringify({ ...auth, x: S.pos.x, z: S.pos.z, face: S.face }) }).catch(() => { }); }
function save() { if (S.pos) try { localStorage.setItem('kp-hero-' + S.nick, JSON.stringify({ x: +S.pos.x.toFixed(2), z: +S.pos.z.toFixed(2), f: +S.face.toFixed(2) })); } catch { } }
function stop() {
  if (!S.on) return; if (W.FPV && W.FPV.on) toggleFpv(false); save(); saveServer(true); disconnect(); document.body.classList.remove('chatting'); S.on = false; W.PLAY.on = false; S.keys.clear(); S.hero.visible = false; S.label.style.display = 'none';
  document.body.classList.remove('playing'); W.setWorld('map'); ROOT.visible = false; W.target.y = 0; if (S.prev) { W.pitch = S.prev.pitch; W.dist = Math.max(30, S.prev.dist); } W.redraw();
}

// ---------------- игровой цикл ----------------
const v3 = { x: 0, z: 0 };
// автоподстройка разрешения: на слабых телефонах плавно снижаем плотность пикселей, чтобы держать ~35+ кадров
const PERF = { ema: 0.016, t: 0, pr: 0 };
function governor(now, dt) {
  if (!PERF.pr) { PERF.pr = W.renderer.getPixelRatio(); PERF.t = now; }
  PERF.ema += (Math.min(dt, 0.1) - PERF.ema) * 0.05; if (now - PERF.t < 2500) return; PERF.t = now;
  const max = Math.min(2, window.devicePixelRatio || 1); let pr = PERF.pr;
  if (PERF.ema > 0.028 && pr > 1) pr = Math.max(1, pr - 0.25); else if (PERF.ema < 0.013 && pr < max) pr = Math.min(max, pr + 0.25);
  if (pr !== PERF.pr) { PERF.pr = pr; W.renderer.setPixelRatio(pr); dispatchEvent(new Event('resize')); }
}
function tick(now, dt) {
  if (S.on) governor(now, dt);
  if (!S.on) return;
  W.stopFly();
  let ix = 0, iz = 0, run = false; const fighting = !!(G.state && G.state.combat && G.state.combat.fight);
  const k = S.keys; if (k.has('KeyW') || k.has('ArrowUp')) iz -= 1; if (k.has('KeyS') || k.has('ArrowDown')) iz += 1; if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1; if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
  run = k.has('ShiftLeft') || k.has('ShiftRight');
  if (S.joy.on) { ix = S.joy.x; iz = S.joy.y; run = Math.hypot(ix, iz) > 0.85; }
  if (fighting) { ix = 0; iz = 0; const f = G.state.combat.fight; S.face = Math.atan2(f.ex - S.pos.x, f.ez - S.pos.z); }
  const m = Math.hypot(ix, iz); let want = 0;
  if (S.sit && (m > 0.12 || fighting)) setSit(false); // пошёл или начался бой — встаёт
  if (S.vy || S.jy > 0) { S.vy -= 18 * dt; S.jy += S.vy * dt; if (S.jy <= 0) { S.jy = 0; S.vy = 0; } }
  if (m > 0.12) {
    const y = W.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = -fz, rz = fx;   // вперёд — от камеры
    v3.x = (rx * ix - fx * iz) / Math.max(1, m); v3.z = (rz * ix - fz * iz) / Math.max(1, m);
    want = (S.mount ? (run ? 9.8 : 5.9) : (run ? 6.4 : 3.1)) * Math.min(1, m) * ((G.state?.res?.buffs?.speed || 0) > Date.now() ? 1.3 : 1); // зелье скорости
    const tf = Math.atan2(v3.x, v3.z); let d = tf - S.face; d = Math.atan2(Math.sin(d), Math.cos(d)); S.face += d * Math.min(1, dt * 14);
  }
  S.speed += (want - S.speed) * Math.min(1, dt * 10);
  if (S.speed > 0.05 && m > 0.12) {
    const step = S.speed * dt, nx = S.pos.x + v3.x * step, nz = S.pos.z + v3.z * step, r = 0.28;
    if (!blocked(nx, nz, r)) { S.pos.x = nx; S.pos.z = nz; }
    else if (!blocked(nx, S.pos.z, r)) S.pos.x = nx;          // скольжение вдоль препятствия
    else if (!blocked(S.pos.x, nz, r)) S.pos.z = nz;
    else S.speed *= 0.5;
  }
  S.t += dt; S.hero.position.copy(S.pos); S.hero.rotation.y = S.face; animateHero(S.hero, S.t, m > 0.12 && S.jy <= 0 ? S.speed : 0); poseHero(S.hero, dt); S.hero.position.y = S.jy;
  { const own = hasHorse(); document.body.classList.toggle('hashorse', own); if (!own && S.mount) setMount(false);
    if (S.mount && !S.horse) { S.horse = buildHorse(horseVariant(S.nick)); W.scene.add(S.horse); } if (S.horse) S.horse.visible = S.mount;
    if (S.mount) { S.horse.position.set(S.pos.x, 0, S.pos.z); S.horse.rotation.y = S.face; S.hero.position.y = rideHorse(S.horse, S.hero, S.t, m > 0.12 ? S.speed : 0); } }
  // камера следует за героем
  const T = W.target, a = Math.min(1, dt * 6), F = W.FPV;
  if (F && F.on) { // от первого лица: камера в глазах героя, герой смотрит туда же, куда камера
    T.x = S.pos.x; T.z = S.pos.z; T.y = 0.9; F.h = 1.52 + S.jy - S.sitK * 0.4 + (S.mount ? 0.65 : 0);
    if (fighting) W.yaw = S.face + Math.PI; else S.face = W.yaw + Math.PI;
    S.hero.visible = false; if (S.horse) S.horse.visible = false; }
  else { T.x += (S.pos.x - T.x) * a; T.z += (S.pos.z - T.z) * a; T.y = 0.9; }
  W.dist = Math.min(40, Math.max(4, W.dist));
  // подпись над героем
  const p = (SV || (SV = new THREE.Vector3())).set(S.pos.x, 1.75 + S.jy - S.sitK * 0.34 + (S.mount ? 0.6 : 0), S.pos.z).project(W.camera);
  if (p.z < 1 && !(W.FPV && W.FPV.on)) { const tx = (G.state?.world?.king === S.nick ? '👑 ' : '') + '@' + S.nick; if (S.label.textContent !== tx) S.label.textContent = tx; S.label.style.display = 'block'; S.label.style.transform = `translate(${((p.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - p.y) / 2 * innerHeight).toFixed(1)}px) translate(-50%, -100%)`; } else S.label.style.display = 'none';
  if (now - S.saveT > 3000) { S.saveT = now; save(); }
  if (now - (S.srvT || 0) > 30000 && !document.hidden) { S.srvT = now; saveServer(); } // позиция на сервер раз в 30 с и только если герой сдвинулся
  // стоим на месте — перерисовываем реже (на телефоне ~15 кадров/с): меньше нагрев, анимации всё равно плавные
  const busy = m > 0.12 || S.speed > 0.05 || fighting || S.jy > 0 || Math.abs(T.x - S.pos.x) + Math.abs(T.z - S.pos.z) > 0.02;
  if (busy || now - (S.rdT || 0) > (IDLE_DT)) { S.rdT = now; W.redraw(); }
}
const IDLE_DT = (() => { try { if (localStorage.getItem('kp-eco') === '1') return 100; } catch { } return innerWidth < 700 || matchMedia('(pointer: coarse)').matches ? 66 : 33; })();

let ROOT = null; // всё, что есть только в «Мире героев»: NPC, враги, лагерь, ресурсы, осада, другие игроки
export function init(world, k) {
  ROOT = new world.THREE.Group(); ROOT.visible = false; world.scene.add(ROOT);
  W = Object.create(world, { scene: { value: ROOT } }); // модули RPG кладут свои объекты в ROOT, а не на карту подписчиков
  K = k; THREE = W.THREE; ui(); buildObstacles(); W.TICKS.push(tick);
  initNpc(W, K, { buildHero, addObs, animate: animateHero, state: () => S }); W.TICKS.push((n, d) => S.on && npcTick(n, d));
  initUi(W, K, { state: () => S, npcMarks, online: () => NET.online, onSquadChange: () => { retrack(); reloadSquadChat(); }, warAction, doWar, worldRender }); W.TICKS.push(uiTick);
  initNet(W, K, { state: () => S, game: () => G.state, buildHero, animate: animateHero, act }); W.TICKS.push(netTick);
  initEnemies(W, K, { state: () => S, addObs, animate: animateHero, setFoe }); W.TICKS.push((n, d) => S.on && enemyTick(n, d)); G.startFight = startFight;
  initWorld(W, K, { state: () => S, buildKnight }); W.TICKS.push(worldTick);
  addEventListener('pagehide', () => { save(); if (S.on) saveServer(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.on) saveServer(); });
  addEventListener('m3d-ready', () => { const w = who(); if (w && !w.error && S.on) ensureHero(w); });
  window.RPG = { start, stop, state: S, toggleMount, blocked, buildObstacles, refreshHero: () => { const w = who(); if (w && !w.error) ensureHero(w); } };
}
