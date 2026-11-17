// «Четыре знамени» — 3D-герой (KayKit, CC0) поверх нарисованного фона лагеря. Фон — CSS-картинка за прозрачным холстом.
import * as THREE from '../three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { clone as skClone } from '../lib/SkeletonUtils.js';

const FC = { lions: 0xE8B33A, wolves: 0x3F6FC4, dragons: 0xD8302A, ravens: 0x7A4AC8 };
const MODEL = { warrior: 'barbarian', guard: 'knight', mage: 'mage', archer: 'rogue_hooded' };
const GEAR = { warrior: ['2H_Axe'], guard: ['1H_Sword', 'Round_Shield'], mage: ['2H_Staff'], archer: ['2H_Crossbow'] };
const ATTACK = { warrior: '2H_Melee_Attack_Slice', guard: '1H_Melee_Attack_Chop', mage: 'Spellcast_Shoot', archer: '2H_Ranged_Shoot' };
const GEARNAMES = /Sword|Shield|Axe|Mug|Wand|Staff|Spellbook|Crossbow|Knife|Throwable|Blade|Bow/;
// где на картинке фона стоит герой и где мишень чучела (доли ширины/высоты картинки)
export const BG = { w: 768, h: 1376, hero: [0.38, 0.735], dummyBase: [0.835, 0.745], target: [0.81, 0.668] };

let R, scene, cam, clock, grad, hero = null, mixer = null, acts = {}, cur = '', LIB = {}, WLIB = {}, CLIPS = {}, SCALE = 1, ready = false;
let fx = [], role = 'warrior', fac = 'lions', gold = false, auraG = null, busyUntil = 0, el = null, BASE = new THREE.Vector3();
const HERO_P = new THREE.Vector3(), TARGET_P = new THREE.Vector3(), ray = new THREE.Raycaster();

function toonGrad() { const d = new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; }
const M = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...o });

// точка картинки фона (background-size:cover, по центру) -> луч из камеры
function bgRay(fx_, fy_) { const W = el.clientWidth, H = el.clientHeight, s = Math.max(W / BG.w, H / BG.h), dw = BG.w * s, dh = BG.h * s, x = (W - dw) / 2 + fx_ * dw, y = (H - dh) / 2 + fy_ * dh;
  ray.setFromCamera(new THREE.Vector2(x / W * 2 - 1, -(y / H) * 2 + 1), cam); return ray.ray; }
function onGround(p) { const o = new THREE.Vector3(); bgRay(...p).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), o); return o; }

function place() {
  if (!el || !el.clientWidth) return;
  HERO_P.copy(onGround(BG.hero)); BASE.copy(onGround(BG.dummyBase));
  const n = new THREE.Vector3().subVectors(cam.position, BASE).setY(0).normalize();
  if (!bgRay(...BG.target).intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, BASE), TARGET_P)) TARGET_P.copy(BASE).setY(1.2);
  if (hero) { hero.position.copy(HERO_P); hero.rotation.y = Math.atan2(BASE.x - HERO_P.x, BASE.z - HERO_P.z); }
  if (auraG) auraG.position.copy(HERO_P);
}

function makeHero() {
  if (hero) { scene.remove(hero); hero = null; } if (auraG) { scene.remove(auraG); auraG = null; }
  const src = LIB[MODEL[role]]; if (!src) return;
  hero = skClone(src); hero.scale.setScalar(SCALE);
  const byName = {}; hero.traverse(o => { if (o.name) byName[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  hero.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && GEARNAMES.test(o.name)) o.visible = false; });
  for (const wn of GEAR[role]) { let m = byName[wn]; if (!m && WLIB[wn]) { m = WLIB[wn].clone(); const slot = byName[/Shield/.test(wn) ? 'handslot.l' : 'handslot.r']; slot && slot.add(m); } if (m) m.visible = true; }
  hero.traverse(o => { if (o.isMesh && /_Cape$/.test(o.name)) { o.material = o.material.clone(); o.material.map = null; o.material.color.setHex(FC[fac]); } });
  scene.add(hero);
  mixer = new THREE.AnimationMixer(hero); acts = {}; for (const [n, c] of Object.entries(CLIPS)) acts[n] = mixer.clipAction(c);
  cur = ''; play('Idle');
  auraG = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(.48, .62, 40), new THREE.MeshBasicMaterial({ color: gold ? 0xFFD75A : FC[fac], transparent: true, opacity: .9 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; auraG.add(ring);
  if (gold) { const glow = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 2.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xFFD75A, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false })); glow.position.y = 1.2; auraG.add(glow); }
  scene.add(auraG); place();
}
function play(n, once = false, speed = 1) {
  const a = acts[n]; if (!a) return; const prev = cur && acts[cur];
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.timeScale = speed; a.enabled = true; a.setEffectiveWeight(1);
  if (prev && prev !== a) a.crossFadeFrom(prev, once ? .06 : .2, false); a.play(); cur = n;
}
function burst(n = 10) {
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.07, .025, .2), M(Math.random() < .5 ? 0xF2D06A : 0xD9AA4A));
    m.position.copy(TARGET_P).add(new THREE.Vector3((Math.random() - .5) * .3, (Math.random() - .5) * .4, .1)); scene.add(m);
    fx.push({ m, v: new THREE.Vector3((Math.random() - .5) * 3.5, Math.random() * 3 + 1.2, Math.random() * 2), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), life: .8 }); }
  const fl = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 8), new THREE.MeshBasicMaterial({ color: role === 'mage' ? 0xFFB040 : 0xFFFFFF, transparent: true, opacity: .9, depthTest: false }));
  fl.position.copy(TARGET_P); scene.add(fl); fx.push({ m: fl, flash: true, life: .18 });
}
function projectile() {
  const dir = TARGET_P.clone().sub(HERO_P).setY(0).normalize(), from = HERO_P.clone().addScaledVector(dir, .5).add(new THREE.Vector3(0, 1.2, 0));
  const m = role === 'mage' ? new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 8), new THREE.MeshBasicMaterial({ color: 0xFFD27A }))
    : new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .6, 6).rotateX(Math.PI / 2), M(0x8A5A2A));
  if (role === 'mage') { m.add(new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 8), new THREE.MeshBasicMaterial({ color: 0xFF7A20, transparent: true, opacity: .45 }))); m.add(new THREE.PointLight(0xffa040, 5, 3)); }
  m.position.copy(from); m.lookAt(TARGET_P); scene.add(m);
  fx.push({ m, from, to: TARGET_P.clone(), t: 0, dur: role === 'mage' ? .26 : .15, proj: true });
}
function hit(k = 1) { burst(role === 'mage' ? 14 : 10); el.dispatchEvent(new CustomEvent('zn-hit', { detail: k, bubbles: true })); }
export function attack() {
  if (!ready || !hero) return;
  const now = performance.now(), clip = ATTACK[role], dur = (CLIPS[clip]?.duration || .8), speed = now < busyUntil ? 2.6 : 1.8;
  play(clip, true, speed); busyUntil = now + dur / speed * 750;
  setTimeout(() => { if (role === 'mage' || role === 'archer') projectile(); else hit(role === 'warrior' ? 1.2 : 1); }, dur / speed * 420);
  clearTimeout(attack.t); attack.t = setTimeout(() => play('Idle'), dur / speed * 1000 + 60);
}
export function setHero(f, r, g) {
  const ch = (f || 'lions') !== fac || (r || 'warrior') !== role || !!g !== gold; fac = f || 'lions'; role = r || 'warrior'; gold = !!g;
  if (ready && (ch || !hero)) makeHero();
}

export async function init(container) {
  el = container;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.setClearColor(0x000000, 0);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
  el.innerHTML = ''; el.appendChild(R.domElement); R.domElement.style.cssText = 'width:100%;height:100%;display:block';
  scene = new THREE.Scene(); grad = toonGrad(); clock = new THREE.Clock();
  cam = new THREE.PerspectiveCamera(30, 1, .1, 200); cam.position.set(0, 9, 17); cam.lookAt(0, 0.5, 0);
  // яркий мультяшный свет: тёплый от костра слева, холодный заполняющий справа
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4e8, 1.9));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(-3, 6, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb070, 1.6); rim.position.set(-5, 3, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xa8c8ff, .8); fill.position.set(5, 2, -2); scene.add(fill);
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .32 })); sp.rotation.x = -Math.PI / 2; sp.receiveShadow = true; scene.add(sp);
  const fit = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); place(); };
  new ResizeObserver(fit).observe(el); fit();
  R.setAnimationLoop(() => {
    const dt = Math.min(.05, clock.getDelta());
    if (mixer) mixer.update(dt); if (auraG) auraG.rotation.y += dt * 1.5;
    fx = fx.filter(f => {
      if (f.proj) { f.t += dt / f.dur; f.m.position.lerpVectors(f.from, f.to, Math.min(1, f.t)); if (f.t >= 1) { scene.remove(f.m); hit(role === 'mage' ? 1.3 : 1); return false; } return true; }
      f.life -= dt; if (f.flash) { f.m.scale.setScalar(1 + (0.18 - f.life) * 9); f.m.material.opacity = Math.max(0, f.life / .18); if (f.life <= 0) { scene.remove(f.m); return false; } return true; }
      f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.r.x * dt; f.m.rotation.y += f.r.y * dt;
      if (f.m.position.y < .02) { f.m.position.y = .02; f.v.set(0, 0, 0); } if (f.life <= 0) { scene.remove(f.m); return false; } return true; });
    R.render(scene, cam);
  });
  const ld = new GLTFLoader(), get = u => new Promise((ok, no) => ld.load(u, ok, undefined, no)), names = [...new Set(Object.values(MODEL))];
  const [an, ...ms] = await Promise.all([get('../m3d/anim.glb'), ...names.map(n => get(`../m3d/${n}.glb`))]);
  for (const c of an.animations) CLIPS[c.name] = c;
  ms.forEach((g, i) => { g.scene.traverse(o => { if (o.isMesh) { const m0 = o.material; o.material = new THREE.MeshToonMaterial({ map: m0.map || null, color: m0.map ? 0xffffff : m0.color, gradientMap: grad }); if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    if (!o.isSkinnedMesh && GEARNAMES.test(o.name) && !WLIB[o.name]) WLIB[o.name] = o; } }); LIB[names[i]] = g.scene; });
  const box = new THREE.Box3().setFromObject(LIB.knight); SCALE = 1.6 / Math.max(.5, box.max.y - box.min.y);
  ready = true; makeHero();
  return true;
}
