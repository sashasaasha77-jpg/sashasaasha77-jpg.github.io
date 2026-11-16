// «Четыре знамени» — 3D-лагерь на весь экран: зимний вечер, шатёр цвета знамени, костёр, герой (KayKit, CC0) бьёт чучело.
import * as THREE from '../three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { clone as skClone } from '../lib/SkeletonUtils.js';

const FC = { lions: 0xE8B33A, wolves: 0x3F6FC4, dragons: 0xC8382A, ravens: 0x7A4AC8 };
const EMB = { lions: '🦁', wolves: '🐺', dragons: '🐉', ravens: '🪶' };
const MODEL = { warrior: 'barbarian', guard: 'knight', mage: 'mage', archer: 'rogue_hooded' };
const GEAR = { warrior: ['2H_Axe'], guard: ['1H_Sword', 'Round_Shield'], mage: ['2H_Staff'], archer: ['2H_Crossbow'] };
const ATTACK = { warrior: '2H_Melee_Attack_Slice', guard: '1H_Melee_Attack_Chop', mage: 'Spellcast_Shoot', archer: '2H_Ranged_Shoot' };
const GEARNAMES = /Sword|Shield|Axe|Mug|Wand|Staff|Spellbook|Crossbow|Knife|Throwable|Blade|Bow/;
const HERO_P = new THREE.Vector3(-0.62, 0, 0.75), DUMMY_P = new THREE.Vector3(0.72, 0, -0.35);

let R, scene, cam, clock, grad, dummy, hero = null, mixer = null, acts = {}, cur = '', LIB = {}, WLIB = {}, CLIPS = {}, SCALE = 1, ready = false;
let wob = { a: 0, v: 0 }, fx = [], role = 'warrior', fac = 'lions', gold = false, auraG = null, busyUntil = 0;
const FLAGS = [], FIRES = [], LIGHTS = []; let snow = null, sparks = null;

function toonGrad() { const d = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; }
const M = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...o });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const hex = c => '#' + c.toString(16).padStart(6, '0');
function shade(c, k) { const col = new THREE.Color(c); col.multiplyScalar(k); return col; }
function add(m, x, y, z, cast = true) { m.position.set(x, y, z); if (cast) m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; }

// ---------------- окружение ----------------
function sky() {
  scene.background = canvasTex(4, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#16224a'); gr.addColorStop(.35, '#2c4a8a'); gr.addColorStop(.62, '#7a9ad0'); gr.addColorStop(.8, '#c6d6ee'); gr.addColorStop(1, '#e6eef8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0xb4c6e2, 16, 55);
  const st = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI - Math.PI, e = 0.35 + Math.random() * 0.9; sp.push(Math.cos(a) * 80, 20 + Math.sin(e) * 50, Math.sin(a) * 80); }
  st.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); scene.add(new THREE.Points(st, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false, transparent: true, opacity: .8 })));
  const moon = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: 0xfdf6e0, fog: false })); moon.position.set(-22, 36, -70); moon.lookAt(0, 2, 0); scene.add(moon);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: 0xbcd0ff, transparent: true, opacity: .18, fog: false })); halo.position.set(-22, 36, -70.5); halo.lookAt(0, 2, 0); scene.add(halo);
}
function ground() {
  const snowTex = canvasTex(256, 256, g => { g.fillStyle = '#e8eef8'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < .5 ? '#d6e0f0' : '#ffffff'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 0, 7); g.fill(); } });
  snowTex.wrapS = snowTex.wrapT = THREE.RepeatWrapping; snowTex.repeat.set(16, 16);
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(90, 64), M(0xffffff, { map: snowTex })); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);
  const dirtTex = canvasTex(256, 256, g => { g.fillStyle = '#a07a58'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 700; i++) { g.fillStyle = ['#8a6648', '#b08a64', '#94704f'][i % 3]; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3, Math.random() * 3, 0, 7); g.fill(); } });
  dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping; dirtTex.repeat.set(3, 3);
  const arena = new THREE.Mesh(new THREE.CircleGeometry(3.3, 48), M(0xffffff, { map: dirtTex })); arena.rotation.x = -Math.PI / 2; arena.position.y = 0.012; arena.receiveShadow = true; scene.add(arena);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.18, 6, 64), M(0xf2f6fc)); rim.rotation.x = Math.PI / 2; rim.scale.z = 0.35; rim.position.y = 0.03; rim.receiveShadow = true; scene.add(rim);
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, s = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * .25, 8, 6), M(0xf4f8fd)); s.scale.y = 0.45; add(s, Math.cos(a) * (3.55 + Math.random() * .4), 0.05, Math.sin(a) * (3.55 + Math.random() * .4), false); }
}
function pine(x, z, s = 1) {
  const t = new THREE.Group(), trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .24, 1.2, 6), M(0x5a3a22)); trunk.position.y = .6; t.add(trunk);
  [[1.5, 1.35], [2.4, 1.05], [3.2, .75], [3.85, .45]].forEach(([y, r], i) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, 1.25, 8), M(i % 2 ? 0x1f4a3a : 0x24543f)); c.position.y = y; c.castShadow = true; t.add(c);
    const sn = new THREE.Mesh(new THREE.ConeGeometry(r * .78, .5, 8), M(0xf2f6fc)); sn.position.y = y + .38; t.add(sn); });
  t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = Math.random() * 6; scene.add(t);
}
function forest() {
  const spots = [[-5.2, -5.5, 1.3], [-6.6, -3.2, 1.1], [-7.8, -7, 1.6], [-4.4, -8.6, 1.4], [5.4, -6.2, 1.4], [6.9, -3.6, 1.2], [8.1, -7.4, 1.7], [4.0, -9.4, 1.5],
    [-9.8, -11, 2], [-2.6, -12, 1.8], [2.4, -13, 2.1], [9.8, -11.5, 1.9], [-12.5, -6, 1.6], [12.5, -5.5, 1.7], [-14, -14, 2.3], [14, -15, 2.4], [0, -17, 2.4], [-6, -16, 2.2], [6.5, -17, 2.3], [-8.3, -1.2, 1.2], [8.6, -0.8, 1.3]];
  for (const [x, z, s] of spots) pine(x, z, s);
  const mt = [0x5a6e98, 0x6a80aa, 0x4c6088];
  [[-30, -55, 22, 14], [-12, -62, 28, 18], [8, -60, 24, 15], [26, -56, 30, 17], [44, -52, 20, 13], [-46, -50, 18, 12]].forEach(([x, z, h, r], i) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), M(mt[i % 3])); m.position.set(x, h / 2 - 1, z); scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * .36, h * .32, 7), M(0xeef3fb)); cap.position.set(x, h - 1 - h * .16, z); scene.add(cap); });
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(4, 6.5, 9, 7), M(0x5a6a8a)); cliff.position.set(14, 4.5, -30); scene.add(cliff);
  const cliffSnow = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, .4, 7), M(0xeef3fb)); cliffSnow.position.set(14, 9.1, -30); scene.add(cliffSnow);
  const stone = M(0x8e9ab4), roofM = M(0x2a3a6a);
  for (const [dx, h, r] of [[-1.8, 5, .9], [0, 7.5, 1.1], [1.9, 4.2, .8], [.9, 3, 1.6]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 10), stone); t.position.set(14 + dx, 9.3 + h / 2, -30); scene.add(t);
    const rf = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, h * .45, 10), roofM); rf.position.set(14 + dx, 9.3 + h + h * .22, -30); scene.add(rf);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(.3, .5), new THREE.MeshBasicMaterial({ color: 0xffd27a })); w.position.set(14 + dx, 9.3 + h * .65, -30 + r + .02); scene.add(w); }
}
let tent = null;
function buildTent() {
  if (tent) scene.remove(tent);
  tent = new THREE.Group(); const c = FC[fac], cm = M(c), cd = M(shade(c, .72)), goldM = M(0xE8B931), dark = M(0x101a33);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 1.9, 12, 1, true), M(c, { side: THREE.DoubleSide })); wall.position.y = .95; wall.castShadow = true; tent.add(wall);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, s = new THREE.Mesh(new THREE.BoxGeometry(.06, 1.9, .5), cd); s.position.set(Math.cos(a) * 2.8, .95, Math.sin(a) * 2.8); s.rotation.y = -a; tent.add(s); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.25, 2.6, 12), cm); roof.position.y = 3.2; roof.castShadow = true; tent.add(roof);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(3.05, .07, 6, 48), goldM); trim.rotation.x = Math.PI / 2; trim.position.y = 1.92; tent.add(trim);
  const valance = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, .35, 24, 1, true), cd); valance.position.y = 1.78; tent.add(valance);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.7), dark); door.position.set(0, .85, 2.92); tent.add(door);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: .55 })); glow.position.set(0, .6, 2.93); tent.add(glow);
  for (const s of [-1, 1]) { const fl = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.75), M(c, { side: THREE.DoubleSide })); fl.position.set(s * .78, .92, 3.0); fl.rotation.y = s * .45; tent.add(fl); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.4, 6), M(0x6a4424)); pole.position.y = 5.1; tent.add(pole);
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(.9, .5, 6, 2).translate(.45, 0, 0), M(c, { side: THREE.DoubleSide })); pf.position.set(.03, 5.55, 0); pf.userData.small = 1; tent.add(pf); FLAGS.push(pf);
  const tl = new THREE.PointLight(0xffa050, 6, 6, 1.6); tl.position.set(0, 1, 3.3); tent.add(tl);
  tent.position.set(-.2, 0, -5.4); scene.add(tent);
}
function bannerTex(f) {
  return canvasTex(128, 256, (g, W, H) => { g.fillStyle = hex(FC[f]); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H - 40); g.lineTo(W / 2, H); g.lineTo(0, H - 40); g.closePath(); g.fill();
    g.strokeStyle = '#ffd75a'; g.lineWidth = 7; g.stroke(); g.font = '70px system-ui, "Apple Color Emoji", "Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(EMB[f], W / 2, H / 2 - 22);
    g.fillStyle = '#0003'; g.fillRect(0, 0, W, 10); });
}
const BANNERS = [];
function buildBanners() {
  for (const b of BANNERS) { scene.remove(b); b.traverse(o => { const i = FLAGS.indexOf(o); if (i >= 0) FLAGS.splice(i, 1); const j = LIGHTS.findIndex(l => l.L === o); if (j >= 0) LIGHTS.splice(j, 1); }); } BANNERS.length = 0;
  for (const s of [-1, 1]) { const g = new THREE.Group(), wood = M(0x6a4424);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 3.6, 8), wood); p.position.y = 1.8; p.castShadow = true; g.add(p);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.3, 6), wood); bar.rotation.z = Math.PI / 2; bar.position.y = 3.4; g.add(bar);
    for (const e of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), M(0xE8B931)); k.position.set(e * .68, 3.4, 0); g.add(k); }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1, 2, 10).translate(0, -1.05, 0), M(0xffffff, { map: bannerTex(fac), side: THREE.DoubleSide, transparent: true, alphaTest: .5 })); fl.position.set(0, 3.35, .06); g.add(fl); FLAGS.push(fl);
    const lp = new THREE.Group(); lp.add(new THREE.Mesh(new THREE.BoxGeometry(.26, .34, .26), M(0x2a2a30)));
    lp.add(new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .2), new THREE.MeshBasicMaterial({ color: 0xffc860 }))); lp.position.set(s * -.55, 2.3, .25); g.add(lp);
    const L = new THREE.PointLight(0xffb060, 3.5, 5, 1.6); L.position.set(s * -.55, 2.3, .5); g.add(L); LIGHTS.push({ L, base: 3.5, ph: Math.random() * 9 });
    g.position.set(s * 2.55, 0, -2.9); g.rotation.y = -s * .25; scene.add(g); BANNERS.push(g); }
}
function props() {
  const wood = M(0x8a5a30), woodD = M(0x6a4424), iron = M(0x4a4a52), snowM = M(0xf4f8fd);
  const crate = (x, z, s = 1, r = 0) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.9, .9, .9), wood); b.castShadow = true; g.add(b);
    for (const ay of [.46, -.46]) for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.92, .1, .1), woodD); p.position.set(0, ay, sx * .41); g.add(p); }
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.25, .1, .1), woodD); d.rotation.z = .78; d.position.z = .46; g.add(d);
    const sn = new THREE.Mesh(new THREE.BoxGeometry(.92, .08, .92), snowM); sn.position.y = .49; g.add(sn);
    g.position.set(x, .45 * s, z); g.scale.setScalar(s); g.rotation.y = r; scene.add(g); return g; };
  crate(-3.9, -.6, 1, .3); crate(-4.4, .3, .85, -.2); crate(-3.95, -.55, .7, .9).position.y = 1.2;
  const barrel = (x, z, s = 1) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .95, 14), wood); b.castShadow = true; g.add(b);
    for (const y of [-.3, .3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.39, .035, 4, 18), iron); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    const sn = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .08, 14), snowM); sn.position.y = .5; g.add(sn); g.position.set(x, .48 * s, z); g.scale.setScalar(s); scene.add(g); };
  barrel(4.0, -.3); barrel(4.6, .4, .9); barrel(4.5, -1.0, 1.05);
  const fire = new THREE.Group(); for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1, 6), woodD); l.rotation.z = Math.PI / 2 - .25; l.rotation.y = i / 6 * Math.PI * 2; l.position.y = .15; fire.add(l); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, s = new THREE.Mesh(new THREE.DodecahedronGeometry(.17), M(0x7a7a84)); s.position.set(Math.cos(a) * .62, .08, Math.sin(a) * .62); fire.add(s); }
  for (const [r, h, c, y] of [[.42, 1.0, 0xff5a1a, .45], [.3, .85, 0xff9a2a, .5], [.17, .6, 0xffe27a, .48]]) { const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .92 })); f.position.y = y; fire.add(f); FIRES.push(f); }
  const FL = new THREE.PointLight(0xff8a30, 9, 9, 1.5); FL.position.y = 1; fire.add(FL); LIGHTS.push({ L: FL, base: 9, ph: 1 });
  fire.position.set(-2.55, 0, -.9); scene.add(fire);
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(40 * 3); for (let i = 0; i < 40; i++) { sp[i * 3] = -2.55; sp[i * 3 + 1] = Math.random() * 2; sp[i * 3 + 2] = -.9; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffb040, size: .07, transparent: true, opacity: .9 })); scene.add(sparks);
  const rack = new THREE.Group(); for (const x of [-.55, .55]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.3, .1), woodD); p.position.set(x, .65, 0); rack.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, .09, .12), woodD); top.position.y = 1.15; rack.add(top);
  for (let i = 0; i < 4; i++) { const s2 = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.45, 5), M(0x8a6a3a)); s2.position.set(-.42 + i * .28, .8, .07); rack.add(s2); const tip = new THREE.Mesh(new THREE.ConeGeometry(.05, .2, 5), M(0xcfd3dc)); tip.position.set(-.42 + i * .28, 1.6, .07); rack.add(tip); }
  rack.position.set(2.7, 0, -3.3); rack.rotation.y = -.5; rack.traverse(o => o.castShadow = true); scene.add(rack);
}
function snowfall() {
  const n = 700, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * 24; p[i * 3 + 1] = Math.random() * 12; p[i * 3 + 2] = (Math.random() - .5) * 20 - 2; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .08, transparent: true, opacity: .85 })); scene.add(snow);
}
function lights() {
  scene.add(new THREE.HemisphereLight(0xb8ccff, 0x7a8aa8, 1.25));
  const moon = new THREE.DirectionalLight(0xdfe8ff, 1.6); moon.position.set(-5, 10, 7); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); scene.add(moon);
}

// ---------------- чучело ----------------
function buildDummy() {
  dummy = new THREE.Group(); const body = new THREE.Group(); dummy.add(body);
  const wood = M(0x7A5230), straw = M(0xC9A46A), sack = M(0xC8B08A), rope = M(0x6a4a2a);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, 2.2, 8), wood); post.position.y = 1.1; post.castShadow = true; body.add(post);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, .14, .14), wood); bar.position.y = 1.55; bar.castShadow = true; body.add(bar);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.4, .42, 1.0, 14), straw); torso.position.y = 1.45; torso.castShadow = true; body.add(torso);
  for (const y of [1.08, 1.82]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.42, .04, 6, 20), rope); r.rotation.x = Math.PI / 2; r.position.y = y; body.add(r); }
  const tgt = canvasTex(128, 128, g => { for (const [c, r] of [['#f4eee0', 64], ['#c8302a', 50], ['#f4eee0', 34], ['#c8302a', 18]]) { g.fillStyle = c; g.beginPath(); g.arc(64, 64, r, 0, 7); g.fill(); } });
  const t = new THREE.Mesh(new THREE.CircleGeometry(.3, 24), M(0xffffff, { map: tgt })); t.position.set(0, 1.45, .43); body.add(t);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), sack); head.position.y = 2.25; head.castShadow = true; body.add(head);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, .16, 10), wood); base.position.y = .08; base.receiveShadow = true; dummy.add(base);
  dummy.userData.body = body; dummy.position.copy(DUMMY_P); dummy.rotation.y = Math.atan2(HERO_P.x - DUMMY_P.x, HERO_P.z - DUMMY_P.z); scene.add(dummy);
}

// ---------------- герой ----------------
function makeHero() {
  if (hero) { scene.remove(hero); hero = null; } if (auraG) { scene.remove(auraG); auraG = null; }
  const name = MODEL[role], src = LIB[name]; if (!src) return;
  hero = skClone(src); hero.scale.setScalar(SCALE); hero.position.copy(HERO_P); hero.rotation.y = Math.atan2(DUMMY_P.x - HERO_P.x, DUMMY_P.z - HERO_P.z);
  const byName = {}; hero.traverse(o => { if (o.name) byName[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  hero.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && GEARNAMES.test(o.name)) o.visible = false; });
  for (const wn of GEAR[role]) { let m = byName[wn]; if (!m && WLIB[wn]) { m = WLIB[wn].clone(); const slot = byName[/Shield/.test(wn) ? 'handslot.l' : 'handslot.r']; slot && slot.add(m); } if (m) m.visible = true; }
  hero.traverse(o => { if (o.isMesh && /_Cape$/.test(o.name)) { o.material = o.material.clone(); o.material.map = null; o.material.color.setHex(FC[fac]); } });
  scene.add(hero);
  mixer = new THREE.AnimationMixer(hero); acts = {}; for (const [n, c] of Object.entries(CLIPS)) acts[n] = mixer.clipAction(c);
  cur = ''; play('Idle');
  auraG = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(.5, .66, 40), new THREE.MeshBasicMaterial({ color: gold ? 0xFFD75A : FC[fac], transparent: true, opacity: .85 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; auraG.add(ring);
  if (gold) { const glow = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 2.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xFFD75A, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false })); glow.position.y = 1.2; auraG.add(glow); }
  auraG.position.copy(HERO_P); scene.add(auraG);
}
function play(n, once = false, speed = 1) {
  const a = acts[n]; if (!a) return; const prev = cur && acts[cur];
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.timeScale = speed; a.enabled = true; a.setEffectiveWeight(1);
  if (prev && prev !== a) a.crossFadeFrom(prev, once ? .06 : .2, false); a.play(); cur = n;
}
function strawBurst(n = 8) {
  const p = dummy.position.clone(); p.y = 1.45;
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.06, .02, .18), M(Math.random() < .5 ? 0xE8C86A : 0xC9A24A));
    m.position.copy(p).add(new THREE.Vector3((Math.random() - .5) * .4, (Math.random() - .5) * .5, .3)); scene.add(m);
    fx.push({ m, v: new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 3 + 1, Math.random() * 2 + .5), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), life: .8 }); }
}
function projectile() {
  const dir = DUMMY_P.clone().sub(HERO_P).normalize(), from = HERO_P.clone().addScaledVector(dir, .5).add(new THREE.Vector3(0, 1.25, 0)), to = DUMMY_P.clone().add(new THREE.Vector3(0, 1.45, 0));
  const m = role === 'mage' ? new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xBFE0FF }))
    : new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .55, 6).rotateX(Math.PI / 2), M(0x8A5A2A));
  if (role === 'mage') { m.add(new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8FC0FF, transparent: true, opacity: .35 }))); m.add(new THREE.PointLight(0x9fc8ff, 4, 3)); }
  m.position.copy(from); m.lookAt(to); scene.add(m);
  fx.push({ m, from, to, t: 0, dur: role === 'mage' ? .28 : .16, proj: true });
}
function hitDummy(k = 1) { wob.v += 6 * k; strawBurst(role === 'mage' ? 12 : 8); }
export function attack() {
  if (!ready || !hero) return;
  const now = performance.now(), clip = ATTACK[role], dur = (CLIPS[clip]?.duration || .8), speed = now < busyUntil ? 2.6 : 1.8;
  play(clip, true, speed); busyUntil = now + dur / speed * 750;
  setTimeout(() => { if (role === 'mage' || role === 'archer') projectile(); else hitDummy(role === 'warrior' ? 1.2 : 1); }, dur / speed * 420);
  clearTimeout(attack.t); attack.t = setTimeout(() => play('Idle'), dur / speed * 1000 + 60);
}
export function setHero(f, r, g) {
  const ch = (f || 'lions') !== fac || (r || 'warrior') !== role || !!g !== gold; fac = f || 'lions'; role = r || 'warrior'; gold = !!g;
  if (scene && ch) { buildTent(); buildBanners(); } if (ready && (ch || !hero)) makeHero();
}
function frame() {
  const W = R.domElement.clientWidth, H = R.domElement.clientHeight, portrait = H > W;
  cam.fov = portrait ? 44 : 36; cam.position.set(.1, portrait ? 3.9 : 2.8, portrait ? 12.2 : 8.6); cam.lookAt(0, portrait ? 1.25 : 1.2, -2.2); cam.updateProjectionMatrix();
}

export async function init(el) {
  R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
  el.innerHTML = ''; el.appendChild(R.domElement); R.domElement.style.cssText = 'width:100%;height:100%;display:block';
  scene = new THREE.Scene(); grad = toonGrad(); clock = new THREE.Clock(); cam = new THREE.PerspectiveCamera(46, 1, .1, 200);
  sky(); ground(); forest(); lights(); props(); snowfall(); buildDummy(); buildTent(); buildBanners();
  const fit = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; frame(); };
  new ResizeObserver(fit).observe(el); fit();
  R.setAnimationLoop(() => {
    const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
    if (mixer) mixer.update(dt);
    wob.v += (-wob.a * 60 - wob.v * 7) * dt; wob.a += wob.v * dt; dummy.userData.body.rotation.x = -wob.a * .12; dummy.userData.body.rotation.z = wob.a * .05;
    for (const fm of FLAGS) { const pa = fm.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setZ(i, fm.userData.small ? Math.sin(t * 5 + x * 4) * .1 * x : Math.sin(t * 2 + y * 2.2) * .07 * (-y)); } pa.needsUpdate = true; }
    FIRES.forEach((f, i) => { const k = 1 + Math.sin(t * 14 + i * 2) * .12 + Math.sin(t * 9.3 + i) * .08; f.scale.set(1 / k, k, 1 / k); f.rotation.y = t * (1 + i); });
    for (const l of LIGHTS) l.L.intensity = l.base * (.85 + Math.sin(t * 12 + l.ph) * .08 + Math.sin(t * 7.1 + l.ph) * .07);
    if (snow) { const p = snow.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * (0.6 + (i % 5) * .12); if (y < 0) y = 12; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t + i) * dt * .15); } p.needsUpdate = true; }
    if (sparks) { const p = sparks.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * (0.8 + (i % 4) * .3); if (y > 2.6) { y = .3; p.setX(i, -2.55 + (Math.random() - .5) * .4); p.setZ(i, -.9 + (Math.random() - .5) * .4); } p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 3 + i) * dt * .2); } p.needsUpdate = true; }
    if (auraG) auraG.rotation.y += dt * 1.5;
    fx = fx.filter(f => {
      if (f.proj) { f.t += dt / f.dur; f.m.position.lerpVectors(f.from, f.to, Math.min(1, f.t)); if (f.t >= 1) { scene.remove(f.m); hitDummy(role === 'mage' ? 1.3 : 1); return false; } return true; }
      f.life -= dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.r.x * dt; f.m.rotation.y += f.r.y * dt;
      if (f.m.position.y < .02) { f.m.position.y = .02; f.v.set(0, 0, 0); } if (f.life <= 0) { scene.remove(f.m); return false; } return true; });
    R.render(scene, cam);
  });
  const ld = new GLTFLoader(), get = u => new Promise((ok, no) => ld.load(u, ok, undefined, no)), names = [...new Set(Object.values(MODEL))];
  const [an, ...ms] = await Promise.all([get('../m3d/anim.glb'), ...names.map(n => get(`../m3d/${n}.glb`))]);
  for (const c of an.animations) CLIPS[c.name] = c;
  ms.forEach((g, i) => { g.scene.traverse(o => { if (o.isMesh) { const m0 = o.material; o.material = new THREE.MeshToonMaterial({ map: m0.map || null, color: m0.map ? 0xffffff : m0.color, gradientMap: grad }); if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    if (!o.isSkinnedMesh && GEARNAMES.test(o.name) && !WLIB[o.name]) WLIB[o.name] = o; } }); LIB[names[i]] = g.scene; });
  const box = new THREE.Box3().setFromObject(LIB.knight); SCALE = 1.75 / Math.max(.5, box.max.y - box.min.y);
  ready = true; makeHero();
  return true;
}
