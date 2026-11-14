// Настоящие 3D-герои со скелетной анимацией (14.11.2026). Модели KayKit (CC0): рыцарь, варвар, маг, разбойник, скелеты.
// Все модели на одном скелете, поэтому анимации лежат в одном общем файле m3d/anim.glb.
// Пока модели грузятся (или в эко-режиме) игра показывает старые фигурки — buildHero сам решает, кого строить.
import { GLTFLoader } from './lib/GLTFLoader.js';
import { clone as skClone } from './lib/SkeletonUtils.js';
import { LOOKS, lookParse } from './extras.mjs';

const MODELS = ['knight', 'barbarian', 'mage', 'rogue', 'rogue_hooded', 'skeleton_warrior', 'skeleton_mage', 'skeleton_minion', 'skeleton_rogue'];
export const ROLE_MODEL = { zhitel: 'rogue', torgovets: 'barbarian', kuznets: 'barbarian', strazhnik: 'knight', luchnik: 'rogue_hooded', alkhimik: 'mage', rytsar: 'knight', mag: 'mage', sovetnik: 'mage', graf: 'knight', gertsog: 'knight', korol: 'knight' };
const ROYAL = { korol: 1, gertsog: 1, graf: 1 };
// оружие игры → меш из набора (меши висят на костях handslot.r / handslot.l)
const WMAP = { iron_sword: '1H_Sword', steel_sword: '1H_Sword', black_blade: '2H_Sword', dragon_blade: '2H_Sword', war_axe: '2H_Axe', hammer: '1H_Axe',
  bow: '2H_Crossbow', hunter_bow: '2H_Crossbow', elven_bow: '2H_Crossbow', staff: '2H_Staff', oak_staff: '2H_Staff', frost_staff: '2H_Staff', lich_scythe: '2H_Staff' };
const ROLE_W = { knight: ['1H_Sword', 'Badge_Shield'], barbarian: ['1H_Axe'], mage: ['1H_Wand'], rogue: ['Knife'], rogue_hooded: ['1H_Crossbow'],
  skeleton_warrior: [], skeleton_mage: [], skeleton_minion: [], skeleton_rogue: [] };
const GEARNAMES = /Sword|Shield|Axe|Mug|Wand|Staff|Spellbook|Crossbow|Knife|Throwable|Blade|Bow/;
const TWOHAND = /^2H_/;
const WTINT = { black_blade: 0x2A2A34, dragon_blade: 0xFF6A2A, frost_staff: 0x9FE8FF, lich_scythe: 0x6A3A8A, elven_bow: 0x7FD38A, war_axe: null };

let ready = false, loading = null, W = null, THREE = null;
const LIB = {}, WLIB = {}, CLIPS = {}, SCALE = { v: 1 };
export const m3dReady = () => ready;
export function loadM3D() {
  if (loading) return loading; W = window.W; THREE = W.THREE;
  const ld = new GLTFLoader(), get = url => new Promise((ok, no) => ld.load(url, ok, undefined, no));
  loading = Promise.all([get('m3d/anim.glb'), ...MODELS.map(m => get(`m3d/${m}.glb`))]).then(([an, ...ms]) => {
    for (const c of an.animations) CLIPS[c.name] = c;
    ms.forEach((g, i) => {
      const name = MODELS[i], root = g.scene;
      root.traverse(o => { if (o.isMesh) { const m0 = o.material; o.material = new THREE.MeshToonMaterial({ map: m0.map || null, color: m0.map ? 0xffffff : m0.color, gradientMap: W.grad });
        if (o.material.map) { o.material.map.colorSpace = THREE.SRGBColorSpace; } o.castShadow = true; o.frustumCulled = false;
        if (!o.isSkinnedMesh && GEARNAMES.test(o.name) && !WLIB[o.name]) WLIB[o.name] = o; } });
      LIB[name] = root; });
    const box = new THREE.Box3().setFromObject(LIB.knight); SCALE.v = 1.42 / Math.max(0.5, box.max.y - box.min.y);
    ready = true; window.dispatchEvent(new Event('m3d-ready'));
  }).catch(e => { console.warn('3D-модели не загрузились', e); loading = null; });
  return loading;
}

const dummy = () => new (window.W.THREE.Object3D)();
// головные уборы из «Облика героя» — на кость головы
function hatMesh(h) {
  const g = new THREE.Group(), M = (geo, c, p, r) => { const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: c, gradientMap: W.grad })); if (p) m.position.set(...p); if (r) m.rotation.set(...r); g.add(m); return m; };
  if (h === 'feather') { M(new THREE.CylinderGeometry(0.42, 0.44, 0.12, 16), 0x5B2A8B, [0, 0.55, 0]); M(new THREE.SphereGeometry(0.4, 16, 8, 0, 6.29, 0, 1.57), 0x5B2A8B, [0, 0.58, 0], [0, 0, 0.12]); M(new THREE.ConeGeometry(0.06, 0.8, 6), 0xF5EBDC, [-0.35, 0.95, -0.1], [-0.5, 0, 0.6]); }
  else if (h === 'wizard') { M(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 18), 0x2A2A6A, [0, 0.5, 0]); M(new THREE.ConeGeometry(0.38, 1.1, 16), 0x2A2A6A, [0, 1.05, -0.06], [-0.18, 0, 0.12]); }
  else if (h === 'viking') { M(new THREE.SphereGeometry(0.46, 16, 8, 0, 6.29, 0, 1.57), 0x8E949E, [0, 0.38, 0]); for (const s of [-1, 1]) M(new THREE.ConeGeometry(0.09, 0.5, 8), 0xF5EBDC, [s * 0.5, 0.65, 0], [0, 0, s * -0.9]); }
  else if (h === 'laurel') { M(new THREE.TorusGeometry(0.42, 0.05, 6, 20), 0x4E8A34, [0, 0.5, 0], [1.45, 0, 0]); }
  else if (h === 'santa') { M(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 16), 0xFFFFFF, [0, 0.5, 0]); M(new THREE.ConeGeometry(0.42, 0.85, 16), 0xC8102E, [0.1, 0.9, -0.1], [-0.4, 0, -0.45]); M(new THREE.SphereGeometry(0.1, 8, 6), 0xFFFFFF, [0.42, 1.18, -0.36]); }
  else if (h === 'crown') { M(new THREE.CylinderGeometry(0.36, 0.38, 0.22, 12, 1, true), 0xE8B931, [0, 0.58, 0]).material.side = THREE.DoubleSide; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; M(new THREE.ConeGeometry(0.07, 0.2, 4), 0xE8B931, [Math.sin(a) * 0.36, 0.78, Math.cos(a) * 0.36]); } }
  return g;
}

// собрать героя: тот же интерфейс, что у старой фигурки (userData.armR и т. п. — пустышки, двигает их только старый код)
export function buildHero3D(role, seed, weapon, lk = '', modelOverride) {
  const cls = String(lk || '').split('.')[4], name = modelOverride || ({ knight: 'knight', mage: 'mage', archer: 'rogue_hooded' })[cls] || ROLE_MODEL[role.id] || 'rogue', src = LIB[name]; if (!src) return null;
  const outer = new THREE.Group(), model = skClone(src); model.scale.setScalar(SCALE.v); outer.add(model);
  const L = lookParse(lk), byName = {}; model.traverse(o => { if (o.name) byName[o.name] = o; });
  // оружие: прячем всё, показываем нужное
  model.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && GEARNAMES.test(o.name)) o.visible = false; });
  const want = weapon && WMAP[weapon] ? [WMAP[weapon]] : ROLE_W[name] || [];
  for (const wn of want) { let m = byName[wn]; if (!m && WLIB[wn]) { m = WLIB[wn].clone(); const slot = byName[WLIB[wn].parent?.name] || byName[wn.includes('Shield') || wn.endsWith('Offhand') ? 'handslot.l' : 'handslot.r']; slot && slot.add(m); }
    if (m) { m.visible = true; const tint = WTINT[weapon]; if (tint) { m.material = m.material.clone(); m.material.color.setHex(tint); } } }
  // плащ и шапки из «Облика»
  const LC = LOOKS.cape.list[L.cape]; if (LC) model.traverse(o => { if (o.isMesh && /_Cape$/.test(o.name)) { o.material = o.material.clone(); o.material.map = null; o.material.color.setHex(LC.color); } });
  if (role.id === 'korol') { // король: пурпурные доспехи с золотом, алый плащ, горностаевый воротник, большая корона
    const tint = (o, c) => { o.material = o.material.clone(); o.material.color.setHex(c); };
    model.traverse(o => { if (!o.isMesh) return; if (/_Body$|_Leg(Left|Right)$/.test(o.name)) tint(o, 0xB98AF0); else if (/_Arm(Left|Right)$/.test(o.name)) tint(o, 0xFFF0B8); else if (/_Cape$/.test(o.name) && !LC) { tint(o, 0xC21E2E); o.material.map = null; } });
    const ch = byName.chest; if (ch) { const fur = new THREE.MeshToonMaterial({ color: 0xFFFDF5, gradientMap: W.grad }), dot = new THREE.MeshToonMaterial({ color: 0x1A1A1A, gradientMap: W.grad });
      const col = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 10, 20), fur); col.rotation.x = Math.PI / 2; col.position.set(0, 0.3, 0); col.scale.set(1, 0.8, 0.7); ch.add(col);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), dot); d.position.set(Math.sin(a) * 0.5, 0.3 + 0.1, Math.cos(a) * 0.5 * 0.7); ch.add(d); } } }
  if (role.id === 'korol' && byName.head) { const br = new THREE.MeshToonMaterial({ color: 0x6B3E1E, gradientMap: W.grad }), hd = byName.head;
    const bd = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), br); bd.scale.set(0.3, 0.26, 0.16); bd.position.set(0, 0.2, 0.33); hd.add(bd);
    for (const sx of [-1, 1]) { const mu = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), br); mu.rotation.z = sx * 1.2; mu.position.set(sx * 0.08, 0.22, 0.4); hd.add(mu); } }
  const head = byName.head; let hat = L.hat || (ROYAL[role.id] ? 'crown' : '');
  if (hat && head) { model.traverse(o => { if (o.isMesh && /_Hat$|_Helmet$|_Hood$/.test(o.name) && !o.isSkinnedMesh) o.visible = false; }); { const hm = hatMesh(hat); if (hat === 'crown' && role.id === 'korol') { hm.scale.setScalar(1.2); hm.position.y += 0.1; } head.add(hm); } }
  const mixer = new THREE.AnimationMixer(model), actions = {};
  for (const [n, c] of Object.entries(CLIPS)) actions[n] = mixer.clipAction(c);
  const u = outer.userData; Object.assign(u, { a3: { mixer, actions, cur: null, last: 0, one: null, oneUntil: 0, model: name }, hand: byName['handslot.r'],
    body: dummy(), head: dummy(), armL: dummy(), armR: dummy(), legL: dummy(), legR: dummy() });
  play(outer, 'Idle', 0);
  return outer;
}

function play(h, n, fade = 0.2, once = false) {
  const a = h.userData.a3, act = a.actions[n]; if (!act || a.cur === n) return;
  const prev = a.cur && a.actions[a.cur]; act.reset(); act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); act.clampWhenFinished = once; act.enabled = true; act.setEffectiveWeight(1);
  if (prev && fade) act.crossFadeFrom(prev, fade, false); else if (prev) prev.stop(); act.play(); a.cur = n;
}
// одиночное действие (удар, сбор, радость): поверх обычного движения на время клипа
export function act3d(h, n, speedK = 1) {
  const a = h?.userData?.a3; if (!a || !a.actions[n]) return false; const d = CLIPS[n].duration / speedK;
  a.cur = null; play(h, n, 0.1, true); a.actions[n].timeScale = speedK; a.one = n; a.oneUntil = a.last + d; return true;
}
// кадр: выбрать клип по скорости и позе, прокрутить микшер
export function animate3d(h, t, speed) {
  const a = h.userData.a3, tg = W.target; // дальних героев анимируем реже — бережём телефон
  if (tg && !a.one) { const d = (h.position.x - tg.x) ** 2 + (h.position.z - tg.z) ** 2; a.skip = (a.skip || 0) + 1; if (d > 2500 && a.skip % (d > 10000 ? 8 : 3)) return; }
  const dt = Math.min(0.2, Math.max(0, t - (a.last || t))); a.last = t;
  if (a.one && t < a.oneUntil) { a.mixer.update(dt); return; } if (a.one) { a.one = null; a.cur = null; }
  const mode = h.userData.mode, M = a.map;
  const n = M ? (mode === 'dead' ? M.death : speed > 4.2 ? M.run : speed > 0.15 ? M.walk : M.idle)
    : mode === 'sit' ? 'Sit_Floor_Idle' : mode === 'ride' ? 'Sit_Chair_Idle' : mode === 'jump' ? 'Jump_Full_Short' : mode === 'dead' ? 'Death_A' : speed > 4.2 ? 'Running_A' : speed > 0.15 ? 'Walking_A' : 'Idle';
  if (n) play(h, n, 0.18, mode === 'dead'); const act = a.actions[n]; if (act && !M && (n === 'Walking_A' || n === 'Running_A')) act.timeScale = Math.max(0.6, Math.min(1.6, speed / (n === 'Running_A' ? 5.5 : 2.4)));
  a.mixer.update(dt);
}
// какой удар показывать для оружия
export const attackClip = wp => { const w = WMAP[wp] || ''; return /Crossbow/.test(w) ? '2H_Ranged_Shoot' : /Staff|Wand/.test(w) ? 'Spellcast_Shoot' : TWOHAND.test(w) ? '2H_Melee_Attack_Slice' : '1H_Melee_Attack_Slice_Diagonal'; };

// ---------------- монстры и питомцы (Quaternius, CC0) — грузятся по одной, когда нужны ----------------
const QM = {}, QLOAD = {};
// как называются клипы у разных семейств моделей
const FAM = {
  fly: { idle: 'Flying_Idle', walk: 'Fast_Flying', run: 'Fast_Flying', attack: 'Punch', hit: 'HitReact', death: 'Death', cheer: 'Yes' },
  biped: { idle: 'Idle', walk: 'Walk', run: 'Run', attack: 'Punch', hit: 'HitReact', death: 'Death', cheer: 'Wave' },
  blob: { idle: 'Idle', walk: 'Walk', run: 'Walk', attack: 'Bite_Front', hit: 'HitRecieve', death: 'Death', cheer: 'Dance' },
  animal: { idle: 'Idle', walk: 'Walk', run: 'Gallop', attack: 'Attack', hit: 'Idle_HitReact_Left', death: 'Death', cheer: 'Idle_2' },
  frog: { idle: 'Frog_Idle', walk: 'Frog_Jump', run: 'Frog_Jump', attack: 'Frog_Attack', hit: 'Frog_Idle', death: 'Frog_Death', cheer: 'Frog_Jump' },
};
// вид → модель, семейство, рост в метрах, оттенок
export const MON = {
  golem: { m: 'yeti', fam: 'biped', h: 2.6, paint: { Main: 0x8C8A84, Secondary: 0x4C545C, Teeth: 0xC8C2B0, Tongue: 0x6E6A60 } }, kikimora: { m: 'frog', fam: 'frog', h: 0.9, tint: 0x8FB46A }, witch: { m: 'tribal', fam: 'fly', h: 1.7, tint: 0xB8A0D8 },
  utopets: { m: 'glub', fam: 'fly', h: 1.4, tint: 0x9AC8B0 }, dragon: { m: 'dragon_evolved', fam: 'fly', h: 4.2 }, lich: { m: 'ghost_skull', fam: 'fly', h: 2.4 },
  giant: { m: 'yeti', fam: 'biped', h: 3.6, paint: { Main: 0xA8794E, Secondary: 0xE2C29A } }, troll: { m: 'blue_demon', fam: 'biped', h: 2.2, tint: 0x9CB08A },
  mountain_king: { m: 'demon', fam: 'biped', h: 4.0, paint: { Main: 0x6C6478, Black: 0x2E2A36 }, crown: true },
  snowking: { m: 'yeti', fam: 'biped', h: 4.0, paint: { Main: 0xF2FAFF, Secondary: 0x4FB0F0 }, crown: true },
  pet_fox: { m: 'fox', fam: 'animal', h: 0.55 }, pet_wolf: { m: 'wolf', fam: 'animal', h: 0.7 }, pet_owl: { m: 'birb', fam: 'blob', h: 0.8, paint: { Main: 0xB07A48, Secondary: 0xF2E2C4, Beak: 0xF0A030 } },
  pet_dragon1: { m: 'dragon', fam: 'fly', h: 0.6 }, pet_dragon2: { m: 'dragon', fam: 'fly', h: 1.0 }, pet_dragon3: { m: 'dragon_evolved', fam: 'fly', h: 2.6 },
};
export const monReady = kind => !!(MON[kind] && QM[MON[kind].m]);
function loadQ(name) {
  if (QLOAD[name]) return QLOAD[name]; W = window.W; THREE = W.THREE;
  const ld = new GLTFLoader();
  QLOAD[name] = new Promise((ok, no) => ld.load(`m3d/mon/${name}.glb`, ok, undefined, no)).then(g => {
    g.scene.traverse(o => { if (o.isMesh) { const m0 = o.material, mk = m => new THREE.MeshToonMaterial({ name: m.name, color: m.color, map: m.map || null, gradientMap: W.grad, transparent: m.transparent, opacity: m.opacity });
      o.material = Array.isArray(m0) ? m0.map(mk) : mk(m0); o.castShadow = true; o.frustumCulled = false; } });
    const clips = {}; for (const c of g.animations) clips[c.name.split('|').pop()] = c;
    const box = new THREE.Box3().setFromObject(g.scene); QM[name] = { scene: g.scene, clips, h: Math.max(0.2, box.max.y - box.min.y) };
    window.dispatchEvent(new Event('m3d-ready'));
  }).catch(e => { console.warn('модель не загрузилась', name, e); delete QLOAD[name]; });
  return QLOAD[name];
}
// построить монстра или питомца; если модель ещё грузится — вернёт null (позже придёт событие m3d-ready)
export function buildMon3D(kind, scale = 1) {
  const d = MON[kind]; if (!d || !window.W.M3D_ON) return null; const q = QM[d.m]; if (!q) { loadQ(d.m); return null; }
  W = window.W; THREE = W.THREE;
  const outer = new THREE.Group(), model = skClone(q.scene); model.scale.setScalar(d.h / q.h * scale); outer.add(model);
  if (d.tint) model.traverse(o => { if (o.isMesh) { const t = m => { m = m.clone(); m.color.multiply(new THREE.Color(d.tint)); return m; }; o.material = Array.isArray(o.material) ? o.material.map(t) : t(o.material); } });
  if (d.paint) model.traverse(o => { if (o.isMesh) { const t = m => { const k = Object.keys(d.paint).find(k => (m.name || '').endsWith(k)); if (!k) return m; m = m.clone(); m.color.set(d.paint[k]); return m; }; o.material = Array.isArray(o.material) ? o.material.map(t) : t(o.material); } });
  if (d.crown) { let head = null; model.traverse(o => { if (!head && o.isBone && /^head$/i.test(o.name)) head = o; }); const c = hatMesh('crown');
    const cb = new THREE.Box3().setFromObject(c), cw = Math.max(0.01, cb.max.x - cb.min.x), want = d.h * scale * 0.24; // корона ≈ четверть роста
    if (head) { outer.updateMatrixWorld(true); const ws = new THREE.Vector3(); head.getWorldScale(ws); c.scale.setScalar(want / cw / ws.x); c.position.y = d.h * scale * 0.04 / ws.y; head.add(c); }
    else { c.scale.setScalar(want / cw); c.position.y = d.h * scale * 0.98; outer.add(c); } }
  const mixer = new THREE.AnimationMixer(model), actions = {}, F = FAM[d.fam], map = {};
  for (const [k, n] of Object.entries(F)) if (q.clips[n]) { actions[n] = mixer.clipAction(q.clips[n]); map[k] = n; }
  const u = outer.userData; Object.assign(u, { a3: { mixer, actions, cur: null, last: 0, one: null, oneUntil: 0, model: d.m, map, clipsQ: q.clips }, mon3d: kind,
    body: dummy(), head: dummy(), armL: dummy(), armR: dummy(), legL: dummy(), legR: dummy() });
  if (map.idle) play(outer, map.idle, 0);
  return outer;
}
// одиночное действие монстра по смыслу: attack / hit / death / cheer
export function monAct(h, what, speedK = 1) { const a = h?.userData?.a3; if (!a?.map) return act3d(h, what === 'attack' ? '1H_Melee_Attack_Slice_Diagonal' : what === 'hit' ? 'Hit_A' : what === 'cheer' ? 'Cheer' : 'Death_A', speedK);
  const n = a.map[what]; if (!n) return false; const c = a.clipsQ[n]; a.cur = null; play(h, n, 0.1, true); a.actions[n].timeScale = speedK; a.one = n; a.oneUntil = a.last + c.duration / speedK; return true; }

export function wantMon(kind) { const d = MON[kind]; if (!d || !window.W.M3D_ON) return false; if (QM[d.m]) return true; loadQ(d.m); return false; }
