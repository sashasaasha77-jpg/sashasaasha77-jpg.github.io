// «Четыре знамени» — 3D-сцена тренировки: герой (KayKit, CC0) бьёт тренировочное чучело.
import * as THREE from '../three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { clone as skClone } from '../lib/SkeletonUtils.js';

const FC = { lions: 0xE8B33A, wolves: 0x7F9FC4, dragons: 0xE0503A, ravens: 0x9A6AD8 };
const EMB = { lions: '🦁', wolves: '🐺', dragons: '🐉', ravens: '🪶' };
const MODEL = { warrior: 'barbarian', guard: 'knight', mage: 'mage', archer: 'rogue_hooded' };
const GEAR = { warrior: ['2H_Axe'], guard: ['1H_Sword', 'Round_Shield'], mage: ['2H_Staff'], archer: ['2H_Crossbow'] };
const ATTACK = { warrior: '2H_Melee_Attack_Slice', guard: '1H_Melee_Attack_Chop', mage: 'Spellcast_Shoot', archer: '2H_Ranged_Shoot' };
const GEARNAMES = /Sword|Shield|Axe|Mug|Wand|Staff|Spellbook|Crossbow|Knife|Throwable|Blade|Bow/;

let R, scene, cam, clock, grad, flag, flagTex, dummy, hero = null, mixer = null, acts = {}, cur = '', LIB = {}, WLIB = {}, CLIPS = {}, SCALE = 1, ready = false;
let wob = { a: 0, v: 0 }, fx = [], role = 'warrior', fac = 'lions', gold = false, auraG = null, busyUntil = 0, queued = 0;

function toonGrad() { const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; }
const M = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...o });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

function buildYard() {
  scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a5a9a'); gr.addColorStop(.45, '#c98a8a'); gr.addColorStop(.7, '#f2b26a'); gr.addColorStop(1, '#ffe2a8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog(0xf0c894, 22, 70);
  const grass = canvasTex(256, 256, (g) => { g.fillStyle = '#6f9a3c'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 1600; i++) { g.fillStyle = Math.random() < .5 ? '#5f8a32' : '#82ac4a'; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3 + Math.random() * 4); } });
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(10, 10);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), M(0xffffff, { map: grass })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40), M(0xB08A58)); dirt.rotation.x = -Math.PI / 2; dirt.position.y = 0.01; dirt.receiveShadow = true; scene.add(dirt);
  // забор по кругу
  const wood = M(0x7A5230), plank = M(0x8E6238);
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + 0.1; if (Math.sin(a) > 0.55) continue; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 6), wood); p.position.set(Math.cos(a) * 6.5, 0.65, Math.sin(a) * 6.5); p.castShadow = true; scene.add(p);
    const b = (i + 1) / 22 * Math.PI * 2 + 0.1; if (Math.sin(b) > 0.55) continue; for (const y of [0.55, 1.0]) { const L = 6.5 * 2 * Math.sin(Math.PI / 22); const r = new THREE.Mesh(new THREE.BoxGeometry(L + 0.1, 0.12, 0.06), plank); r.position.set(Math.cos((a + b) / 2) * 6.45, y, Math.sin((a + b) / 2) * 6.45); r.rotation.y = -((a + b) / 2) + Math.PI / 2; scene.add(r); } }
  // деревья
  const leaf = M(0x3E7A2E), leaf2 = M(0x4E8E36), trunk = M(0x6A4424);
  for (const [x, z, s] of [[-10, -6, 1.3], [-12, -3, 1.1], [12, -1, 1.5], [10.5, -5, 1.2], [-8.5, -9, 1.2], [8.5, -10, 1.3], [-14, -12, 1.5], [14, -12, 1.4]]) {
    const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.4, 6), trunk); tr.position.y = 0.7; t.add(tr);
    for (const [y, r, m] of [[1.9, 1.2, leaf], [2.7, 0.9, leaf2], [3.3, 0.6, leaf]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, 1.3, 7), m); c.position.y = y; c.castShadow = true; t.add(c); }
    t.position.set(x, 0, z); t.scale.setScalar(s); scene.add(t); }
  buildScenery();
  // флаг знамени
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 4.2, 8), wood); pole.position.set(2.9, 2.1, -3.4); pole.castShadow = true; scene.add(pole);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M(0xE8B931)); top.position.set(2.9, 4.25, -3.4); scene.add(top);
  flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.05, 12, 4).translate(0.8, 0, 0), M(0xffffff, { side: THREE.DoubleSide })); flag.position.set(2.96, 3.6, -3.4); scene.add(flag);
  // свет
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a7a4a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(-4, 9, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(sun);
}
const FLAGS = [];
function flagMesh(f, w = 1, h = 1.6) {
  const c = '#' + FC[f].toString(16).padStart(6, '0');
  const tex = canvasTex(128, 200, (g, W, H) => { g.fillStyle = c; g.fillRect(0, 0, W, H - 30); g.beginPath(); g.moveTo(0, H - 30); g.lineTo(W / 2, H); g.lineTo(W, H - 30); g.fill();
    g.strokeStyle = '#ffd75a'; g.lineWidth = 6; g.strokeRect(5, 5, W - 10, H - 40); g.font = '64px system-ui, "Apple Color Emoji", "Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(EMB[f], W / 2, H / 2 - 18); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 2, 8).translate(0, -h / 2, 0), M(0xffffff, { map: tex, side: THREE.DoubleSide })); FLAGS.push(m); return m;
}
function buildScenery() {
  const stone = M(0x9a948a), stone2 = M(0x86807a), dark = M(0x3a3430), roof = M(0x8a3a2a), wood = M(0x7A5230);
  // горы
  const mt = [M(0x7a8aa0), M(0x8c9ab0), M(0x6c7c94)];
  [[-26, -40, 14, 12], [-12, -46, 11, 16], [2, -44, 13, 13], [16, -42, 12, 15], [30, -40, 15, 11], [-36, -38, 12, 9]].forEach(([x, z, h, r], i) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mt[i % 3]); m.position.set(x, h / 2 - 1, z - 14); scene.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * .32, h * .3, 6), M(0xf4f2ee)); cap.position.set(x, h - 1 - h * .15, z - 14); scene.add(cap); });
  // облака
  for (const [x, y, z, s] of [[-14, 11, -30, 1.4], [-3, 13, -34, 1.1], [9, 10.5, -28, 1.6], [20, 12.5, -33, 1.2], [-24, 9.5, -26, 1]]) {
    const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * .6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1e0, fog: false })); b.position.set(i * 1.3 - 2.6, Math.random() * .6, Math.random() * .5); g.add(b); }
    g.position.set(x, y, z); g.scale.setScalar(s); g.userData.cloud = 1; scene.add(g); CLOUDS.push(g); }
  // крепостная стена с зубцами
  const WZ = -16;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 4.6, 1.4), stone); wall.position.set(0, 2.3, WZ); wall.castShadow = wall.receiveShadow = true; scene.add(wall);
  for (let x = -19.6; x <= 19.6; x += 1.1) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 1.45), stone2); b.position.set(x, 4.95, WZ); scene.add(b); }
  for (let i = 0; i < 70; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.7 + Math.random() * .5, 0.3, 0.05), stone2); s.position.set(-18 + Math.random() * 36, 0.3 + Math.random() * 4, WZ + 0.72); scene.add(s); }
  // ворота
  const gate = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 0.2), dark); gate.position.set(0, 1.6, WZ + 0.65); scene.add(gate);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16, 1, false, 0, Math.PI), dark); arch.rotation.set(Math.PI / 2, 0, Math.PI / 2); arch.position.set(0, 3.2, WZ + 0.65); scene.add(arch);
  for (let i = -3; i <= 3; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.6, 0.07), M(0x5a5a62)); bar.position.set(i * 0.42, 2.0, WZ + 0.78); scene.add(bar); }
  // башни
  for (const x of [-6.5, 6.5, -15, 15]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 8, 12), stone); t.position.set(x, 4, WZ); t.castShadow = true; scene.add(t);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), stone2); b.position.set(x + Math.cos(a) * 1.8, 8.3, WZ + Math.sin(a) * 1.8); scene.add(b); }
    const r = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3, 12), roof); r.position.set(x, 10.1, WZ); scene.add(r);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.1), M(0xffc860, { emissive: 0xffa040, emissiveIntensity: .9 })); w.position.set(x, 5.4, WZ + 1.95); scene.add(w);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), wood); p.position.set(x, 12.2, WZ); scene.add(p);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6, 8, 2).translate(0.55, 0, 0), M(0xC8102E, { side: THREE.DoubleSide })); fl.position.set(x + 0.03, 12.7, WZ); FLAGS.push(fl); fl.userData.small = 1; scene.add(fl); }
  // знамёна всех четырёх фракций на стене
  ['lions', 'wolves', 'dragons', 'ravens'].forEach((f, i) => { const fm = flagMesh(f, 1.1, 1.9); fm.position.set([-4.2, -2.2, 2.2, 4.2][i], 4.3, WZ + 0.76); scene.add(fm); });
  // факелы
  for (const x of [-1.9, 1.9, -10, 10]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6), wood); h.position.set(x, 2.8, WZ + 0.85); h.rotation.x = 0.4; scene.add(h);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 8), new THREE.MeshBasicMaterial({ color: 0xffb03a })); f.position.set(x, 3.22, WZ + 0.98); scene.add(f);
    const L = new THREE.PointLight(0xff9a40, 6, 7, 1.6); L.position.set(x, 3.3, WZ + 1.3); scene.add(L); TORCH.push({ f, L, ph: Math.random() * 9 }); }
  // реквизит двора: стойка с оружием, бочки, сено, щиты
  const rack = new THREE.Group(); for (const x of [-0.6, 0.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), wood); p.position.set(x, 0.7, 0); rack.add(p); }
  for (const y of [0.35, 1.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.14), wood); b.position.y = y; rack.add(b); }
  for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 5), M(0x8a6a3a)); sp.position.set(-0.45 + i * 0.3, 0.85, 0.08); sp.rotation.z = (i - 1.5) * 0.06; rack.add(sp);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 5), M(0xcfd3dc)); tip.position.set(-0.45 + i * 0.3, 1.68, 0.08); rack.add(tip); }
  rack.position.set(-3.0, 0, -2.4); rack.rotation.y = 0.35; rack.traverse(o => o.castShadow = true); scene.add(rack);
  const barrel = (x, z, s = 1) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.85, 12), M(0x8a5a30)); b.position.set(x, 0.43 * s, z); b.scale.setScalar(s); b.castShadow = true; scene.add(b);
    for (const y of [-0.28, 0.28]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 4, 16), M(0x4a4a4e)); r.rotation.x = Math.PI / 2; r.position.set(x, (0.43 + y) * s, z); r.scale.setScalar(s); scene.add(r); } };
  barrel(3.3, -2.2); barrel(3.95, -1.85, 0.9); barrel(3.6, -2.9, 1.05);
  const hay = (x, z, r = 0) => { const h = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), M(0xD9B35A)); h.position.set(x, 0.3, z); h.rotation.y = r; h.castShadow = true; scene.add(h);
    for (const dx of [-0.3, 0.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.72), M(0x8a6a3a)); b.position.set(x + dx * Math.cos(r), 0.3, z - dx * Math.sin(r)); b.rotation.y = r; scene.add(b); } };
  hay(-4.4, -1.2, 0.3); hay(-4.2, -1.3 + 0.05, 0.3); hay(4.6, -0.6, -0.4);
  for (const [x, z, f] of [[-5.2, -4.6, 'lions'], [5.4, -4.4, 'dragons']]) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16), M(FC[f])); sh.rotation.x = Math.PI / 2 - 0.25; sh.position.set(x, 0.55, z); scene.add(sh);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(0xE8B931)); boss.position.set(x, 0.57, z + 0.06); scene.add(boss); }
}
const CLOUDS = [], TORCH = [];

function paintFlag() {
  const c = '#' + FC[fac].toString(16).padStart(6, '0');
  flagTex = canvasTex(256, 168, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#0003'; g.fillRect(0, h - 18, w, 18); g.strokeStyle = '#ffd75a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.font = '96px system-ui, "Apple Color Emoji", "Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(EMB[fac], w / 2, h / 2 + 4); });
  flag.material.map = flagTex; flag.material.needsUpdate = true;
}
function buildDummy() {
  dummy = new THREE.Group(); const body = new THREE.Group(); dummy.add(body);
  const wood = M(0x7A5230), straw = M(0xD9B35A), sack = M(0xD8C49A), rope = M(0x8A6A3A);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.3, 8), wood); post.position.y = 1.15; post.castShadow = true; body.add(post);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), wood); bar.rotation.z = Math.PI / 2; bar.position.y = 1.55; bar.castShadow = true; body.add(bar);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 14), straw); torso.position.y = 1.4; torso.castShadow = true; body.add(torso);
  for (const y of [1.1, 1.75]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 6, 20), rope); r.rotation.x = Math.PI / 2; r.position.y = y; body.add(r); }
  const tgt = canvasTex(128, 128, (g) => { const R = [['#f4eee0', 64], ['#d0302a', 50], ['#f4eee0', 34], ['#d0302a', 18]]; for (const [c, r] of R) { g.fillStyle = c; g.beginPath(); g.arc(64, 64, r, 0, 7); g.fill(); } });
  const t = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), M(0xffffff, { map: tgt })); t.position.set(0, 1.42, 0.44); body.add(t);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), sack); head.position.y = 2.25; head.castShadow = true; body.add(head);
  const eyeM = M(0x3a2410); for (const sx of [-1, 1]) for (const d of [1, -1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.02), eyeM); e.position.set(sx * 0.11, 2.3, 0.28); e.rotation.z = d * 0.785; body.add(e); }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.18, 10), wood); base.position.y = 0.09; base.receiveShadow = true; dummy.add(base);
  dummy.userData.body = body; dummy.position.set(1.05, 0, -0.1); dummy.rotation.y = -0.85; scene.add(dummy);
}

function makeHero() {
  if (hero) { scene.remove(hero); hero = null; } if (auraG) { scene.remove(auraG); auraG = null; }
  const name = MODEL[role], src = LIB[name]; if (!src) return;
  hero = skClone(src); hero.scale.setScalar(SCALE); hero.position.set(-0.95, 0, 0.15); hero.rotation.y = 1.4;
  const byName = {}; hero.traverse(o => { if (o.name) byName[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  hero.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && GEARNAMES.test(o.name)) o.visible = false; });
  for (const wn of GEAR[role]) { let m = byName[wn]; if (!m && WLIB[wn]) { m = WLIB[wn].clone(); const slot = byName[/Shield/.test(wn) ? 'handslot.l' : 'handslot.r']; slot && slot.add(m); } if (m) m.visible = true; }
  hero.traverse(o => { if (o.isMesh && /_Cape$/.test(o.name)) { o.material = o.material.clone(); o.material.map = null; o.material.color.setHex(FC[fac]); } });
  scene.add(hero);
  const disc = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), new THREE.MeshBasicMaterial({ color: FC[fac], transparent: true, opacity: .8 })); disc.rotation.x = -Math.PI / 2; disc.position.set(hero.position.x, 0.03, hero.position.z);
  if (hero.userData.disc) scene.remove(hero.userData.disc); scene.add(disc); hero.userData.disc = disc; if (makeHero.disc) scene.remove(makeHero.disc); makeHero.disc = disc;
  mixer = new THREE.AnimationMixer(hero); acts = {}; for (const [n, c] of Object.entries(CLIPS)) acts[n] = mixer.clipAction(c);
  cur = ''; play('Idle');
  if (gold) { auraG = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: 0xFFD75A, transparent: true, opacity: .85 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; auraG.add(ring);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xFFD75A, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false })); glow.position.y = 1.2; auraG.add(glow);
    auraG.position.copy(hero.position); scene.add(auraG); }
}
function play(n, once = false, speed = 1) {
  const a = acts[n]; if (!a) return; const prev = cur && acts[cur];
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.timeScale = speed; a.enabled = true; a.setEffectiveWeight(1);
  if (prev && prev !== a) a.crossFadeFrom(prev, once ? 0.06 : 0.2, false); a.play(); cur = n;
}

function strawBurst(n = 8) {
  const p = dummy.position.clone(); p.y = 1.45;
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.18), M(Math.random() < .5 ? 0xE8C86A : 0xC9A24A));
    m.position.copy(p).add(new THREE.Vector3((Math.random() - .5) * .4, (Math.random() - .5) * .5, .35)); scene.add(m);
    fx.push({ m, v: new THREE.Vector3((Math.random() - .3) * 3, Math.random() * 3 + 1, Math.random() * 2), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), life: 0.7 }); }
}
function projectile() {
  const from = hero.position.clone().add(new THREE.Vector3(0.45, 1.25, 0.1)), to = dummy.position.clone().add(new THREE.Vector3(0, 1.45, 0.2));
  const m = role === 'mage' ? new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xBFE0FF }))
    : new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6).rotateZ(Math.PI / 2), M(0x8A5A2A));
  if (role === 'mage') { const g = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8FC0FF, transparent: true, opacity: .35 })); m.add(g); }
  m.position.copy(from); m.lookAt(to); if (role === 'archer') m.rotateY(Math.PI / 2); scene.add(m);
  fx.push({ m, from, to, t: 0, dur: role === 'mage' ? 0.28 : 0.16, proj: true });
}
function hitDummy(k = 1) { wob.v += 6 * k; strawBurst(role === 'mage' ? 12 : 8); }

export function attack() {
  if (!ready || !hero) return;
  const now = performance.now(), clip = ATTACK[role], dur = (CLIPS[clip]?.duration || 0.8);
  const speed = now < busyUntil ? 2.6 : 1.8; // быстрые тапы — быстрые удары
  play(clip, true, speed); busyUntil = now + dur / speed * 1000 * 0.75;
  const hitAt = dur / speed * (role === 'mage' || role === 'archer' ? 0.45 : 0.42) * 1000;
  setTimeout(() => { if (role === 'mage' || role === 'archer') projectile(); else hitDummy(role === 'warrior' ? 1.2 : 1); }, hitAt);
  clearTimeout(attack.t); attack.t = setTimeout(() => play('Idle'), dur / speed * 1000 + 60);
}
export function setHero(f, r, g) { const ch = f !== fac || r !== role || !!g !== gold; fac = f || 'lions'; role = r || 'warrior'; gold = !!g; if (ready && ch) { paintFlag(); makeHero(); } else if (ready && !hero) { paintFlag(); makeHero(); } }

export async function init(el) {
  R = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
  el.innerHTML = ''; el.appendChild(R.domElement); R.domElement.style.cssText = 'width:100%;height:100%;display:block';
  scene = new THREE.Scene(); grad = toonGrad(); clock = new THREE.Clock();
  cam = new THREE.PerspectiveCamera(42, 1, 0.1, 120); cam.position.set(0.15, 1.9, 4.6); cam.lookAt(0.05, 1.55, 0);
  buildYard(); buildDummy(); paintFlag();
  const fit = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(fit).observe(el); fit();
  R.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (mixer) mixer.update(dt);
    // пружинное покачивание чучела
    wob.v += (-wob.a * 60 - wob.v * 7) * dt; wob.a += wob.v * dt; dummy.userData.body.rotation.x = -wob.a * 0.12; dummy.userData.body.rotation.z = wob.a * 0.05;
    // флаг на ветру
    const pa = flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, Math.sin(t * 4 + x * 3) * 0.12 * x); } pa.needsUpdate = true;
    if (auraG) auraG.rotation.y += dt * 1.5;
    for (const T of TORCH) { const k = 0.8 + Math.sin(t * 13 + T.ph) * 0.12 + Math.sin(t * 7.3 + T.ph) * 0.1; T.L.intensity = 6 * k; T.f.scale.set(1, k * 1.1, 1); }
    for (const fm of FLAGS) { const p2 = fm.geometry.attributes.position; for (let i = 0; i < p2.count; i++) { const x = p2.getX(i), y = p2.getY(i); p2.setZ(i, fm.userData.small ? Math.sin(t * 5 + x * 4) * 0.1 * x : Math.sin(t * 2.2 + y * 2.4 + fm.position.x) * 0.06 * (-y)); } p2.needsUpdate = true; }
    for (const c of CLOUDS) { c.position.x += dt * 0.25; if (c.position.x > 32) c.position.x = -32; }
    fx = fx.filter(f => {
      if (f.proj) { f.t += dt / f.dur; f.m.position.lerpVectors(f.from, f.to, Math.min(1, f.t)); if (f.t >= 1) { scene.remove(f.m); hitDummy(role === 'mage' ? 1.3 : 1); return false; } return true; }
      f.life -= dt; f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.r.x * dt; f.m.rotation.y += f.r.y * dt;
      if (f.m.position.y < 0.02) { f.m.position.y = 0.02; f.v.set(0, 0, 0); } if (f.life <= 0) { scene.remove(f.m); return false; } return true; });
    R.render(scene, cam);
  });
  const ld = new GLTFLoader(), get = u => new Promise((ok, no) => ld.load(u, ok, undefined, no));
  const names = [...new Set(Object.values(MODEL))];
  const [an, ...ms] = await Promise.all([get('../m3d/anim.glb'), ...names.map(n => get(`../m3d/${n}.glb`))]);
  for (const c of an.animations) CLIPS[c.name] = c;
  ms.forEach((g, i) => { g.scene.traverse(o => { if (o.isMesh) { const m0 = o.material; o.material = new THREE.MeshToonMaterial({ map: m0.map || null, color: m0.map ? 0xffffff : m0.color, gradientMap: grad }); if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    if (!o.isSkinnedMesh && GEARNAMES.test(o.name) && !WLIB[o.name]) WLIB[o.name] = o; } }); LIB[names[i]] = g.scene; });
  const box = new THREE.Box3().setFromObject(LIB.knight); SCALE = 1.75 / Math.max(0.5, box.max.y - box.min.y);
  ready = true; paintFlag(); makeHero();
  return true;
}
