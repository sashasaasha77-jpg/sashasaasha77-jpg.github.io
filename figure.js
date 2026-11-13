// «Королевство подписчиков» — модели горожан и рыцарей Ордена.
// Каждая подвижная часть (туловище, голова, руки, ноги, плащ) собирается из многих деталей
// и сливается в один меш с цветами вершин + один контур: ~15 вызовов отрисовки на героя вместо ~50.
let THREE, W;
const CACHE = new Map();

// ---------------- набор для сборки ----------------
function mk(pos, rot, scl) {
  const s = scl == null ? [1, 1, 1] : typeof scl === 'number' ? [scl, scl, scl] : scl;
  return new THREE.Matrix4().compose(new THREE.Vector3(...(pos || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), new THREE.Vector3(...s));
}
class Kit {
  constructor() { this.parts = {}; this.part = 'body'; this.stack = [new THREE.Matrix4()]; }
  in(name, pos, rot) { this.part = name; this.stack = [mk(pos, rot)]; return this; }
  push(pos, rot, scl) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(mk(pos, rot, scl))); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, col, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(this.stack[this.stack.length - 1].clone().multiply(mk(o.pos, o.rot, o.scl)));
    const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    const P = this.parts[this.part] || (this.parts[this.part] = { ol: [], flat: [], glow: [] });
    P[o.glow ? 'glow' : o.ol === false ? 'flat' : 'ol'].push(g); return this;
  }
}
function merge(list) {
  if (!list.length) return null; const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(list.reduce((s, p) => s + p.attributes[name].array.length, 0)); let o = 0;
    for (const p of list) { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  out.computeBoundingSphere(); return out;
}
function bake(kit) { const res = {}; for (const [k, P] of Object.entries(kit.parts)) res[k] = { main: merge([...P.ol, ...P.flat]), ol: merge(P.ol), glow: merge(P.glow) }; return res; }
let MAT;
function mats() {
  if (!MAT) MAT = { main: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: W.grad }), cape: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: W.grad, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }), ol: W.outline(1.6) };
  return MAT;
}
function attach(group, set, name) {
  const s = set[name]; if (!s) return; const m = mats();
  if (s.main) { const me = new THREE.Mesh(s.main, name === 'cape' ? m.cape : m.main); me.castShadow = true; group.add(me);
    if (s.ol) { const o = new THREE.Mesh(s.ol, m.ol); o.raycast = () => {}; me.add(o); } }
  if (s.glow) group.add(new THREE.Mesh(s.glow, m.glow));
}
// скелет: root → body → голова/руки/ноги/плащ; позы прежние, чтобы анимации не менялись
function rig(set, P) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const node = (name, pos) => { const g = new THREE.Group(); g.position.set(...pos); body.add(g); attach(g, set, name); return g; };
  attach(body, set, 'body');
  const legL = node('legL', P.legL), legR = node('legR', P.legR), armL = node('armL', P.armL), armR = node('armR', P.armR), head = node('head', P.head);
  const cape = set.cape ? node('cape', P.cape) : null; if (cape) cape.rotation.x = 0.12;
  root.userData = { body, legL, legR, armL, armR, head, cape };
  return root;
}

// ---------------- геометрия ----------------
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
let Q = 1; // HQ: более гладкие формы
const Cy = (rt, rb, h, s = 10, open = false, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rt, rb, h, Math.round(s * Q), 1, open, t0, tl);
const Sp = (r, ws = 12, hs = 9, t0 = 0, tl = Math.PI) => new THREE.SphereGeometry(r, Math.round(ws * Q), Math.round(hs * Q), 0, Math.PI * 2, t0, tl);
const Co = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const To = (R, r, rs = 6, ts = 14, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);
const Oc = r => new THREE.OctahedronGeometry(r, 0);
const Tube = (pts, r, seg = 24, rs = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, rs, false);
function Ex(draw, depth, bevel = 0.006) { const s = new THREE.Shape(); draw(s); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8 }); g.translate(0, 0, -depth / 2); return g; }
const shieldShape = (w, h) => s => { s.moveTo(-w, h * 0.45); s.lineTo(w, h * 0.45); s.lineTo(w, 0); s.quadraticCurveTo(w * 0.9, -h * 0.4, 0, -h * 0.55); s.quadraticCurveTo(-w * 0.9, -h * 0.4, -w, 0); s.closePath(); };

const C = { STEEL: 0xC9CED6, STEEL2: 0x8E949E, IRON: 0x55524E, GOLD: 0xE8B931, GOLD2: 0xB8860B, WOOD: 0x6B4A2A, WOOD2: 0x8A5F36, LEATHER: 0x5A3A22, DARK: 0x2A1A12,
  WHITE: 0xF7F2E8, CLOTH: 0xEDE3C8, RED: 0xB3202A, BLUSH: 0xF19C8C, MOUTH: 0x8A3328 };
const SKINS = [0xF2C9A0, 0xEDB98F, 0xF6D5B7, 0xDDA57A, 0xC98E64];
const HAIRS = [0x5A3A22, 0x2E1E14, 0x8A5A2A, 0xC8962E, 0x1A1210, 0xA0522D, 0xE0C98A, 0x6E4B2E];
function h32(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };

// ---------------- детали ----------------
function face(k, skin, hair, o = {}) {
  k.add(Sp(0.2, 16, 12), skin, { scl: [1, 0.98, 0.94] });                       // голова
  for (const s of [-1, 1]) k.add(Sp(0.048, 8, 6), skin, { pos: [s * 0.198, -0.005, -0.005], scl: [0.6, 1, 1] }); // уши
  k.add(Sp(0.034, 8, 6), shade(skin, 0.93), { pos: [0, -0.025, 0.184], ol: false }); // нос
  for (const s of [-1, 1]) {
    k.add(Sp(0.042, 10, 8), C.WHITE, { pos: [s * 0.075, 0.02, 0.172], scl: [1, 1.18, 0.5], ol: false });
    k.add(Sp(0.027, 10, 8), 0x2A1A12, { pos: [s * 0.073, 0.014, 0.187], scl: [1, 1.2, 0.5], ol: false });
    k.add(Sp(0.009, 6, 4), 0xFFFFFF, { pos: [s * 0.066, 0.028, 0.198], glow: true });
    k.add(B(0.072, 0.019, 0.02), o.brow || hair, { pos: [s * 0.078, 0.085 + (o.angry ? -0.008 : 0), 0.16], rot: [0, s * -0.32, s * (o.angry ? 0.35 : -0.1)], ol: false });
    k.add(Sp(0.03, 8, 6), C.BLUSH, { pos: [s * 0.12, -0.045, 0.146], scl: [1, 0.6, 0.35], ol: false });
  }
  k.add(To(0.032, 0.0075, 4, 10, Math.PI), C.MOUTH, { pos: [0, -0.06, 0.172], rot: [0.2, 0, Math.PI], ol: false }); // улыбка
  if (Q > 1) { // HQ: веки, ресницы, ноздри, подбородок
    for (const s of [-1, 1]) {
      k.add(Sp(0.046, 12, 8, 0, Math.PI * 0.42), shade(skin, 0.96), { pos: [s * 0.075, 0.024, 0.168], scl: [1, 1.1, 0.55], ol: false });
      k.add(B(0.05, 0.008, 0.01), 0x2A1A12, { pos: [s * 0.078, 0.052, 0.19], rot: [0, s * -0.25, s * 0.12], ol: false });
      k.add(Sp(0.008, 6, 4), shade(skin, 0.75), { pos: [s * 0.012, -0.04, 0.2], ol: false });
    }
    k.add(Sp(0.03, 10, 6), shade(skin, 0.97), { pos: [0, -0.125, 0.14], scl: [1.3, 0.7, 0.8], ol: false });
    k.add(Sp(0.012, 6, 4), 0xC0584A, { pos: [0, -0.072, 0.176], scl: [1.6, 0.6, 0.6], ol: false });
  }
}
function hairdo(k, hair, style, opt = {}) {
  const tl = opt.short ? Math.PI * 0.36 : Math.PI * 0.42;
  k.add(Sp(0.215, 16, 10, 0, tl), hair, { pos: [0, 0.008, -0.004], rot: [-0.3, 0, 0], scl: [1.02, 0.98, 1] });
  if (opt.capOnly) return;
  for (const [x, y, z, r] of [[-0.085, 0.12, 0.16, 0.2], [0, 0.135, 0.17, 0], [0.085, 0.12, 0.16, -0.2]]) k.add(Sp(0.055, 8, 6), hair, { pos: [x, y, z], rot: [0, 0, r], scl: [1.3, 0.7, 0.6] });
  if (style === 1) k.add(B(0.37, 0.3, 0.1), hair, { pos: [0, -0.07, -0.13] });          // длинные
  if (style === 2) { k.add(Sp(0.07, 8, 6), hair, { pos: [0, 0.03, -0.215] }); k.add(Co(0.06, 0.24, 8), hair, { pos: [0, -0.1, -0.24], rot: [Math.PI - 0.2, 0, 0] }); } // хвост
  if (style === 3) for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; k.add(Sp(0.07, 8, 6), hair, { pos: [Math.sin(a) * 0.16, 0.1 + (i % 2) * 0.04, Math.cos(a) * 0.14 - 0.02] }); } // кудри
  if (style === 4) k.add(Sp(0.085, 10, 8), hair, { pos: [0, 0.19, -0.12] });            // пучок
  if (style !== 1) k.add(B(0.34, 0.12, 0.06), hair, { pos: [0, -0.02, -0.17] });         // затылок
}
function beard(k, col, long) {
  k.add(Sp(0.15, 12, 8, Math.PI * 0.45, Math.PI * 0.55), col, { pos: [0, -0.02, 0.03], scl: [1.12, 1.15, 1.1] });
  k.add(B(0.1, 0.022, 0.03), col, { pos: [0, -0.04, 0.185], ol: false });               // усы
  if (long) k.add(Co(0.11, 0.3, 8), col, { pos: [0, -0.27, 0.11], rot: [Math.PI + 0.25, 0, 0] });
}
function crown(k, n, gem) {
  k.add(Cy(0.165, 0.155, 0.075, 14), C.GOLD, { pos: [0, 0.2, -0.01], rot: [-0.12, 0, 0] });
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; k.add(Co(0.034, 0.1, 4), C.GOLD, { pos: [Math.sin(a) * 0.15, 0.27 + Math.cos(a) * -0.018, Math.cos(a) * 0.15 - 0.01] });
    k.add(Sp(0.02, 6, 4), i % 2 ? gem : 0x2E6FD0, { pos: [Math.sin(a) * 0.165, 0.2, Math.cos(a) * 0.165 - 0.01], ol: false }); }
}
// ---------------- оружие (рукоять в начале координат кисти, клинок вдоль +Y) ----------------
function sword(k, o = {}) {
  const L = o.len || 0.62, bl = o.blade || C.STEEL, gd = o.guard || C.GOLD;
  k.add(Cy(0.023, 0.023, 0.15, 8), o.grip || C.LEATHER, { pos: [0, 0, 0] });
  for (let i = 0; i < 3; i++) k.add(To(0.024, 0.006, 4, 8), shade(o.grip || C.LEATHER, 0.7), { pos: [0, -0.05 + i * 0.05, 0], rot: [Math.PI / 2, 0, 0], ol: false });
  k.add(Sp(0.036, 8, 6), gd, { pos: [0, -0.095, 0] });                                       // навершие
  k.add(B(o.wide ? 0.32 : 0.25, 0.036, 0.055), gd, { pos: [0, 0.085, 0] });                   // гарда
  for (const s of [-1, 1]) k.add(Sp(0.03, 8, 6), gd, { pos: [s * (o.wide ? 0.16 : 0.125), 0.095, 0] });
  const w = o.width || 0.064;
  k.add(B(w, L, 0.016), bl, { pos: [0, 0.1 + L / 2, 0] });                                    // клинок
  k.add(Co(w / 1.414, 0.13, 4), bl, { pos: [0, 0.1 + L + 0.065, 0], rot: [0, Math.PI / 4, 0], scl: [1, 1, 0.25] }); // остриё
  k.add(B(w * 0.22, L * 0.82, 0.019), o.fuller || shade(bl, 0.72), { pos: [0, 0.1 + L * 0.44, 0], ol: false, glow: !!o.runes });
  if (o.ricasso) k.add(B(w * 1.3, 0.06, 0.03), gd, { pos: [0, 0.13, 0] });
}
function bow(k, o = {}) {
  const wood = o.wood || C.WOOD2, h = 0.5, pts = [[0, -h, -0.06], [0, -h * 0.82, 0.03], [0, -h * 0.45, 0.1], [0, 0, 0.06], [0, h * 0.45, 0.1], [0, h * 0.82, 0.03], [0, h, -0.06]];
  k.push([0, 0, -0.06]);
  k.add(Tube(pts, 0.022, 28, 6), wood);
  for (const s of [-1, 1]) k.add(Sp(0.026, 6, 4), o.tip || C.GOLD2, { pos: [0, s * h, -0.06] });
  k.add(Cy(0.033, 0.033, 0.13, 8), o.grip || C.LEATHER, { pos: [0, 0, 0.065] });
  k.add(Cy(0.005, 0.005, h * 2, 4), C.CLOTH, { pos: [0, 0, -0.065], ol: false });            // тетива
  k.pop();
}
function quiver(k, pos, col = C.LEATHER, fl = C.RED) {
  k.push(pos, [0.25, 0, -0.45]);
  k.add(Cy(0.075, 0.062, 0.44, 10), col); k.add(To(0.075, 0.014, 4, 12), C.GOLD2, { pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 0.06, z = (i < 2 ? -1 : 1) * 0.025;
    k.add(Cy(0.008, 0.008, 0.2, 4), C.WOOD2, { pos: [x, 0.3, z], ol: false });
    k.add(B(0.004, 0.08, 0.04), i % 2 ? C.WHITE : fl, { pos: [x, 0.36, z], ol: false }); k.add(B(0.04, 0.08, 0.004), i % 2 ? C.WHITE : fl, { pos: [x, 0.36, z], ol: false }); }
  k.pop();
}
function staff(k, orb = 0x9FD7FF) {
  k.add(Cy(0.022, 0.03, 1.3, 7), C.WOOD, { pos: [0, 0.3, 0] });
  for (let i = 0; i < 3; i++) k.add(To(0.03, 0.008, 4, 8), C.GOLD2, { pos: [0, 0.1 + i * 0.28, 0], rot: [Math.PI / 2, 0, 0], ol: false });
  k.add(To(0.045, 0.013, 5, 10), C.GOLD, { pos: [0, 0.94, 0], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.add(Co(0.022, 0.2, 5), C.WOOD, { pos: [Math.sin(a) * 0.055, 1.04, Math.cos(a) * 0.055], rot: [Math.cos(a) * -0.45, 0, Math.sin(a) * 0.45] }); }
  k.add(Sp(0.085, 12, 9), orb, { pos: [0, 1.06, 0], glow: true });
  k.add(Oc(0.03), 0xFFFFFF, { pos: [0, 1.06, 0], glow: true });
}
function spear(k, o = {}) {
  k.add(Cy(0.025, 0.025, 1.55, 7), o.shaft || C.WOOD, { pos: [0, 0.34, 0] });
  k.add(Cy(0.032, 0.032, 0.08, 8), C.IRON, { pos: [0, 1.1, 0] });
  k.add(Co(0.045, 0.3, 4), o.steel || C.STEEL, { pos: [0, 1.29, 0], rot: [0, Math.PI / 4, 0], scl: [1, 1, 0.45] });
  if (o.axe) { k.add(Ex(s => { s.moveTo(0, 0.12); s.quadraticCurveTo(0.2, 0.14, 0.24, -0.02); s.quadraticCurveTo(0.17, -0.12, 0, -0.1); s.closePath(); }, 0.016), o.steel || C.STEEL, { pos: [0.02, 1.08, 0] });
    k.add(Co(0.03, 0.12, 4), o.steel || C.STEEL, { pos: [-0.07, 1.08, 0], rot: [0, 0, Math.PI / 2] }); }
  if (o.tassel) k.add(Co(0.045, 0.14, 6), o.tassel, { pos: [0, 0.98, 0], rot: [Math.PI, 0, 0] });
  if (o.flag) { k.add(B(0.02, 0.38, 0.5), o.flag, { pos: [0, 0.86, -0.27] }); k.add(B(0.024, 0.14, 0.14), 0x111114, { pos: [0, 0.86, -0.27], ol: false }); }
}
function hammer(k) {
  k.add(Cy(0.022, 0.027, 0.5, 7), C.WOOD2, { pos: [0, 0.16, 0] });
  k.add(B(0.21, 0.11, 0.11), C.IRON, { pos: [0, 0.43, 0] });
  k.add(Cy(0.062, 0.062, 0.04, 10), C.STEEL2, { pos: [0.12, 0.43, 0], rot: [0, 0, Math.PI / 2] });
  k.add(Co(0.055, 0.11, 4), C.IRON, { pos: [-0.15, 0.43, 0], rot: [0, Math.PI / 4, Math.PI / 2], scl: [1, 1, 0.5] });
  k.add(Cy(0.03, 0.03, 0.03, 8), C.IRON, { pos: [0, 0.37, 0] });
}
function mace(k) {
  k.add(Cy(0.026, 0.03, 0.62, 7), 0x2A1E16, { pos: [0, 0.2, 0] });
  k.add(Sp(0.1, 10, 8), 0x3A3A44, { pos: [0, 0.55, 0] });
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7]]) {
    const v = new THREE.Vector3(...d).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v), e = new THREE.Euler().setFromQuaternion(q);
    k.add(Co(0.03, 0.09, 5), 0x6A707C, { pos: [v.x * 0.12, 0.55 + v.y * 0.12, v.z * 0.12], rot: [e.x, e.y, e.z] }); }
}
function glaive(k) {
  k.add(Cy(0.027, 0.027, 1.7, 7), 0x2A1E16, { pos: [0, 0.36, 0] });
  k.add(Ex(s => { s.moveTo(-0.03, 0); s.lineTo(0.05, 0); s.quadraticCurveTo(0.16, 0.25, 0.02, 0.52); s.quadraticCurveTo(0.06, 0.24, -0.03, 0.06); s.closePath(); }, 0.018), 0x6A707C, { pos: [0, 1.2, 0] });
  k.add(Cy(0.04, 0.04, 0.1, 8), 0xA4161A, { pos: [0, 1.18, 0] });
}
function flask(k, liquid = 0x6FD86F) {
  k.push([0, -0.05, 0.04]);
  k.add(new THREE.LatheGeometry([[0.001, 0], [0.05, 0.005], [0.075, 0.045], [0.07, 0.1], [0.035, 0.13]].map(p => new THREE.Vector2(...p)), 10), liquid, {});
  k.add(Sp(0.04, 8, 6), 0xE6FFE6, { pos: [0.03, 0.07, 0.045], glow: true, scl: [0.5, 0.7, 0.3] });
  k.add(Cy(0.03, 0.035, 0.08, 8), 0xCFEFEA, { pos: [0, 0.16, 0] });
  k.add(Cy(0.033, 0.028, 0.045, 8), C.WOOD2, { pos: [0, 0.215, 0] });
  k.pop();
}
function lantern(k) {
  k.push([0, -0.03, 0.05]);
  k.add(To(0.04, 0.008, 4, 10, Math.PI), C.IRON, { pos: [0, -0.01, 0] });
  k.add(Co(0.085, 0.07, 6), 0x2E2A30, { pos: [0, -0.06, 0] });
  k.add(Cy(0.058, 0.058, 0.13, 6), 0xFFC46A, { pos: [0, -0.16, 0], glow: true });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.add(B(0.014, 0.14, 0.014), 0x2E2A30, { pos: [Math.sin(a) * 0.065, -0.16, Math.cos(a) * 0.065], ol: false }); }
  k.add(Cy(0.08, 0.07, 0.025, 6), 0x2E2A30, { pos: [0, -0.235, 0] });
  k.pop();
}
function scroll(k) {
  k.add(Cy(0.042, 0.042, 0.28, 10), C.CLOTH, { pos: [0, -0.02, 0.05], rot: [0, 0, Math.PI / 2] });
  for (const s of [-1, 1]) k.add(Cy(0.05, 0.05, 0.03, 8), C.WOOD, { pos: [s * 0.155, -0.02, 0.05], rot: [0, 0, Math.PI / 2] });
  k.add(Cy(0.044, 0.044, 0.03, 10), C.RED, { pos: [0, -0.02, 0.05], rot: [0, 0, Math.PI / 2], ol: false });
  k.add(Cy(0.022, 0.022, 0.01, 8), 0x8A1A1A, { pos: [0, -0.02, 0.098], rot: [Math.PI / 2, 0, 0], ol: false });
}
function pouch(k) {
  k.add(Sp(0.1, 10, 8), C.GOLD2, { pos: [0, -0.08, 0.03], scl: [1, 0.95, 0.9] });
  k.add(Co(0.06, 0.07, 8), C.GOLD2, { pos: [0, 0.0, 0.03] });
  k.add(To(0.04, 0.012, 4, 10), C.RED, { pos: [0, -0.01, 0.03], rot: [Math.PI / 2, 0, 0] });
  k.add(Cy(0.03, 0.03, 0.01, 10), C.GOLD, { pos: [0.06, -0.08, 0.1], rot: [Math.PI / 2, 0, 0.4] });
}
function shield(k, col, rim, emblem, o = {}) {
  const w = o.w || 0.17, h = o.h || 0.5;
  k.add(Ex(shieldShape(w * 1.12, h * 1.1), 0.03, 0.006), rim, { pos: [0, 0, -0.012] });
  k.add(Ex(shieldShape(w, h), 0.03, 0.006), col, { pos: [0, 0, 0.006] });
  if (emblem === 'cross') { k.add(B(0.05, h * 0.62, 0.012), C.GOLD, { pos: [0, -0.04, 0.03], ol: false }); k.add(B(w * 1.5, 0.05, 0.012), C.GOLD, { pos: [0, 0.06, 0.03], ol: false }); }
  if (emblem === 'star') k.add(Oc(0.07), C.GOLD, { pos: [0, 0, 0.03], scl: [1, 1, 0.2], ol: false });
  if (emblem === 'crown') { k.add(B(0.16, 0.04, 0.012), C.RED, { pos: [0, -0.04, 0.03], ol: false }); for (const x of [-0.06, 0, 0.06]) k.add(Co(0.03, 0.09, 4), C.RED, { pos: [x, 0.02, 0.03], scl: [1, 1, 0.2], ol: false }); }
  k.add(Sp(0.03, 8, 6), rim, { pos: [0, 0, 0.03], scl: [1, 1, 0.5], ol: false });
}

// ---------------- части тела ----------------
const PIV = { legL: [-0.1, 0.46, 0], legR: [0.1, 0.46, 0], armL: [-0.27, 0.84, 0], armR: [0.27, 0.84, 0], head: [0, 1.1, 0], cape: [0, 0.88, 0] };
function legs(k, pants, boot, o = {}) {
  for (const n of ['legL', 'legR']) { k.in(n);
    k.add(Cy(0.078, 0.066, 0.3, 8), pants, { pos: [0, -0.15, 0] });
    k.add(Cy(0.074, 0.08, 0.15, 8), boot, { pos: [0, -0.36, 0] });
    k.add(Sp(0.076, 8, 6), boot, { pos: [0, -0.405, 0.05], scl: [1, 0.62, 1.35] });
    k.add(To(0.078, 0.016, 4, 10), o.cuff || shade(boot, 1.3), { pos: [0, -0.29, 0], rot: [Math.PI / 2, 0, 0], ol: false });
    if (o.greave) k.add(Cy(0.084, 0.078, 0.18, 8), o.greave, { pos: [0, -0.2, 0.01] });
    if (Q > 1) { // HQ: подошва, ремешок, заплатка на колене
      k.add(Cy(0.08, 0.082, 0.025, 10), shade(boot, 0.55), { pos: [0, -0.44, 0.03], scl: [1, 1, 1.45], ol: false });
      k.add(To(0.077, 0.01, 4, 12), C.GOLD2, { pos: [0, -0.36, 0], rot: [Math.PI / 2, 0, 0], ol: false });
      k.add(B(0.022, 0.02, 0.012), C.GOLD, { pos: [0.05, -0.36, 0.06], ol: false });
      if (!o.greave) k.add(Sp(0.05, 8, 6), shade(pants, 0.82), { pos: [0, -0.14, 0.062], scl: [1, 1, 0.3], ol: false });
    } }
}
function arms(k, sleeve, skin, o = {}) {
  for (const n of ['armL', 'armR']) { k.in(n);
    if (o.short) { k.add(Cy(0.072, 0.066, 0.13, 8), sleeve, { pos: [0, -0.06, 0] }); k.add(Cy(0.058, 0.05, 0.24, 8), skin, { pos: [0, -0.22, 0] }); }
    else { k.add(Cy(0.068, 0.062, 0.31, 8), sleeve, { pos: [0, -0.155, 0] }); k.add(To(0.062, 0.018, 4, 10), o.cuff || C.CLOTH, { pos: [0, -0.3, 0], rot: [Math.PI / 2, 0, 0], ol: false }); }
    k.add(Sp(0.062, 10, 8), o.glove || skin, { pos: [0, -0.365, 0.005] });
    if (o.pauldron) { k.add(Sp(0.105, 10, 6, 0, Math.PI / 2), o.pauldron, { pos: [0, -0.01, 0], scl: [1.05, 0.8, 1] }); k.add(To(0.1, 0.014, 4, 12), o.pRim || C.GOLD, { pos: [0, -0.01, 0], rot: [Math.PI / 2, 0, 0], ol: false }); }
    if (o.bracer) k.add(Cy(0.066, 0.06, 0.12, 8), o.bracer, { pos: [0, -0.26, 0] });
    if (Q > 1) { // HQ: большой палец и складка на локте
      k.add(Sp(0.026, 8, 6), o.glove || skin, { pos: [n === 'armL' ? 0.05 : -0.05, -0.345, 0.035], scl: [0.8, 1.2, 0.8], ol: false });
      if (!o.short) k.add(To(0.064, 0.008, 4, 10), shade(sleeve, 0.8), { pos: [0, -0.16, 0], rot: [Math.PI / 2, 0, 0], ol: false });
    } }
}
function torso(k, coat, o = {}) {
  k.in('body');
  k.add(Cy(0.195, 0.215, 0.34, 12), coat, { pos: [0, 0.7, 0], scl: [1, 1, 0.78] });
  k.add(Cy(0.215, o.flare || 0.27, o.hem || 0.17, 12), o.skirt || coat, { pos: [0, 0.535 - ((o.hem || 0.17) - 0.17) / 2, 0], scl: [1, 1, 0.82] });
  k.add(Cy(0.06, 0.065, 0.07, 8), o.skin, { pos: [0, 0.895, 0] });
  k.add(To(0.1, 0.03, 6, 14), o.collar || C.CLOTH, { pos: [0, 0.87, 0], rot: [Math.PI / 2, 0, 0] });
  k.add(Cy(0.222, 0.222, 0.06, 12), o.belt || C.LEATHER, { pos: [0, 0.57, 0], scl: [1, 1, 0.8] });
  k.add(B(0.075, 0.06, 0.02), o.buckle || C.GOLD, { pos: [0, 0.57, 0.18], ol: false });
  if (o.trim) k.add(B(0.045, 0.3, 0.012), o.trim, { pos: [0, 0.7, 0.161], ol: false });
  if (o.buttons) for (let i = 0; i < 3; i++) k.add(Sp(0.014, 6, 4), o.buttons, { pos: [0, 0.79 - i * 0.07, 0.165], ol: false });
  if (Q > 1) { // HQ: подол, сумочка на поясе, рубаха в вырезе
    const hem = o.hem || 0.17, fl = o.flare || 0.27;
    k.add(To(1, 0.045, 4, 24), shade(o.skirt || coat, 0.7), { pos: [0, 0.535 - (hem - 0.17) / 2 - hem / 2 + 0.01, 0], rot: [Math.PI / 2, 0, 0], scl: [fl, fl * 0.82, 0.3], ol: false });
    k.add(B(0.09, 0.1, 0.05), shade(o.belt || C.LEATHER, 1.15), { pos: [-0.17, 0.53, 0.09], rot: [0, -0.6, 0], ol: false });
    k.add(Sp(0.012, 6, 4), C.GOLD, { pos: [-0.185, 0.565, 0.125], ol: false });
    k.add(Cy(0.002, 0.05, 0.08, 3), C.CLOTH, { pos: [0, 0.83, 0.15], rot: [-0.25, Math.PI, Math.PI], scl: [1, 1, 0.25], ol: false });
  }
}

// ---------------- горожане ----------------
// оружие в руке: надетое оружие заменяет предмет роли в правой руке (лук — в левой)
const BOWS = { bow: {}, hunter_bow: { wood: 0x8A5A32 }, elven_bow: { wood: 0xE8E2C8, tip: 0x7FD07F, grip: 0x2E6B3A } };
const SWD = (o = {}) => k => { k.push([0, 0, 0], [0.5, 0, -0.18]); sword(k, o); k.pop(); };
const WLOOK = {
  iron_sword: SWD(), steel_sword: SWD({ blade: 0xF2F4F8, guard: C.STEEL2, len: 0.7 }), black_blade: SWD({ blade: 0x3A3A44, guard: 0x111114, grip: 0xA4161A }),
  dragon_blade: SWD({ blade: 0xFF8A3A, guard: C.GOLD, grip: 0x5A1020, wide: true, len: 0.78, width: 0.075, fuller: 0xFFD060, runes: true }),
  hammer: k => { k.push([0, 0, 0], [0.35, 0, -0.15]); hammer(k); k.pop(); }, war_axe: k => spear(k, { axe: true, shaft: C.WOOD2, steel: 0xC9CED6 }),
  staff: k => staff(k), oak_staff: k => staff(k, 0x8DD06B), frost_staff: k => staff(k, 0xBFEFFF), lich_scythe: k => glaive(k),
};
export const WEAPON_LOOKS = new Set([...Object.keys(WLOOK), ...Object.keys(BOWS)]);
export function buildHero(role, seed, weapon) {
  THREE = window.W.THREE; W = window.W; Q = W.HQ ? 1.6 : 1;
  const id = role.id, s = h32(seed ?? role.name ?? id), skin = SKINS[s % SKINS.length], hairC = HAIRS[(s >>> 3) % HAIRS.length], style = (s >>> 7) % 5;
  const coat = role.roof ?? 0xA4161A, tierCape = ['rare', 'epic', 'legendary'].includes(role.tier);
  const wp = WEAPON_LOOKS.has(weapon) && !(id === 'luchnik' && BOWS[weapon]) ? weapon : '';
  const key = [id, coat, role.tier, skin, hairC, style, wp].join('|');
  let set = CACHE.get(key);
  if (!set) { const k = new Kit(); dress(k, id, { coat, skin, hairC, style, tierCape, tier: role.tier, wp });
    if (wp && BOWS[wp]) { k.in('armL').push([0, -0.37, 0.02], [0, -1.2, 0]); bow(k, BOWS[wp]); k.pop(); }
    else if (wp) { k.in('armR').push([0, -0.37, 0.02]); WLOOK[wp](k); k.pop(); }
    set = bake(k); CACHE.set(key, set); }
  return rig(set, PIV);
}
function dress(k, id, { coat, skin, hairC, style, tierCape, tier, wp }) {
  const dark = shade(coat, 0.62), O = {};
  let pants = 0x4E3020, boot = 0x2E1E14;
  const hand = side => k.in(side === 'armR' && wp ? '__drop' : side).push([0, -0.37, 0.02]); // предмет роли уходит, если в руке оружие
  switch (id) {
    case 'rytsar': {
      legs(k, 0x3A3540, 0x4A4A52, { greave: C.STEEL2 });
      arms(k, C.STEEL2, skin, { pauldron: C.STEEL, glove: C.STEEL2, cuff: C.GOLD });
      torso(k, C.STEEL, { skin, skirt: coat, belt: C.LEATHER, collar: C.STEEL2 });
      k.add(B(0.25, 0.42, 0.02), coat, { pos: [0, 0.62, 0.168] }); k.add(B(0.05, 0.24, 0.012), C.GOLD, { pos: [0, 0.68, 0.18], ol: false }); k.add(B(0.16, 0.05, 0.012), C.GOLD, { pos: [0, 0.72, 0.18], ol: false });
      k.in('head'); face(k, skin, hairC);
      k.add(Sp(0.228, 16, 10, 0, Math.PI * 0.46), C.STEEL, { rot: [-0.32, 0, 0] });
      k.add(To(0.212, 0.018, 4, 18), C.GOLD, { pos: [0, 0.05, -0.02], rot: [Math.PI / 2 - 0.32, 0, 0] });
      k.add(B(0.032, 0.13, 0.025), C.STEEL, { pos: [0, 0.07, 0.205] });
      for (const s of [-1, 1]) k.add(B(0.03, 0.17, 0.12), C.STEEL, { pos: [s * 0.2, -0.04, 0.05] });
      for (let i = 0; i < 5; i++) k.add(Sp(0.055, 8, 6), C.RED, { pos: [0, 0.24 - i * 0.012, 0.08 - i * 0.075], scl: [0.6, 1, 1.2] });
      hand('armR'); k.push([0, 0, 0], [0.5, 0, -0.18]); sword(k); k.pop();
      k.in('armL').push([-0.05, -0.22, 0.1], [0, -0.55, 0]); shield(k, coat, C.STEEL, 'cross'); k.pop();
      break; }
    case 'strazhnik': {
      legs(k, 0x3E3A36, boot, { greave: C.STEEL2 });
      arms(k, 0x8A8F96, skin, { glove: C.LEATHER, cuff: C.STEEL2, pauldron: C.STEEL2, pRim: coat });
      torso(k, 0x8A8F96, { skin, skirt: coat, collar: C.STEEL2 });
      k.add(B(0.27, 0.44, 0.02), coat, { pos: [0, 0.62, 0.168] }); k.add(Oc(0.06), C.GOLD, { pos: [0, 0.7, 0.18], scl: [1, 1.2, 0.2], ol: false });
      k.in('head'); face(k, skin, hairC); hairdo(k, hairC, 0, { short: true });
      k.add(Sp(0.226, 16, 8, 0, Math.PI * 0.42), C.STEEL, { pos: [0, 0.04, 0], rot: [-0.1, 0, 0] });
      k.add(Cy(0.31, 0.31, 0.022, 18), C.STEEL, { pos: [0, 0.085, -0.01], rot: [-0.1, 0, 0] });
      k.add(Sp(0.03, 6, 4), C.GOLD, { pos: [0, 0.27, -0.02] });
      hand('armR'); spear(k, { axe: true, tassel: C.RED }); k.pop();
      k.in('armL').push([-0.05, -0.22, 0.1], [0, -0.55, 0]); shield(k, coat, C.STEEL2, 'star', { w: 0.15, h: 0.42 }); k.pop();
      break; }
    case 'luchnik': {
      legs(k, 0x4A3A28, 0x3A2618, { cuff: coat });
      arms(k, shade(coat, 0.85), skin, { bracer: C.LEATHER, glove: skin, cuff: C.LEATHER });
      torso(k, coat, { skin, belt: C.LEATHER, collar: dark, trim: C.LEATHER });
      k.add(Cy(0.23, 0.3, 0.13, 12), dark, { pos: [0, 0.83, -0.005], scl: [1, 1, 0.85] });   // накидка
      quiver(k, [0.09, 0.72, -0.22]);
      k.in('head'); face(k, skin, hairC); hairdo(k, hairC, style === 1 ? 2 : style, { short: true });
      k.add(Sp(0.236, 16, 10, 0, Math.PI * 0.52), dark, { pos: [0, 0.0, -0.02], rot: [-0.42, 0, 0] });
      k.add(Co(0.11, 0.24, 6), dark, { pos: [0, 0.03, -0.25], rot: [-1.9, 0, 0] });
      k.in('armL').push([0, -0.37, 0.02], [0, -1.2, 0]); bow(k); k.pop();
      break; }
    case 'mag': {
      legs(k, 0x2E2440, 0x2A1E2E);
      arms(k, coat, skin, { cuff: C.GOLD });
      torso(k, coat, { skin, hem: 0.44, flare: 0.36, belt: C.GOLD2, collar: C.GOLD, trim: C.GOLD });
      for (let i = 0; i < 5; i++) k.add(Oc(0.025), C.GOLD, { pos: [Math.sin(i * 1.3) * 0.25, 0.25 + i * 0.05, Math.cos(i * 1.3) * 0.22], ol: false });
      k.in('head'); face(k, skin, 0xD9D4CC, { brow: 0xE8E4DC }); hairdo(k, 0xD9D4CC, 1, { capOnly: true }); beard(k, 0xE8E4DC, true);
      k.add(Cy(0.33, 0.33, 0.03, 20), coat, { pos: [0, 0.14, 0], rot: [-0.08, 0, 0] });
      k.add(Cy(0.11, 0.19, 0.3, 14), coat, { pos: [0, 0.3, -0.02] });
      k.add(Co(0.11, 0.3, 14), coat, { pos: [0, 0.55, -0.08], rot: [-0.45, 0, 0] });
      k.add(Cy(0.195, 0.195, 0.045, 14), C.GOLD, { pos: [0, 0.18, -0.01] });
      k.add(Oc(0.035), C.GOLD, { pos: [0.09, 0.32, 0.12], ol: false }); k.add(Oc(0.025), C.GOLD, { pos: [-0.07, 0.42, 0.06], ol: false });
      hand('armR'); staff(k); k.pop();
      break; }
    case 'alkhimik': {
      legs(k, 0x3E3A36, boot);
      arms(k, coat, skin, { cuff: C.CLOTH, glove: 0x4A6A3A });
      torso(k, coat, { skin, belt: C.LEATHER, collar: C.CLOTH });
      k.add(B(0.3, 0.46, 0.02), 0xCDB48A, { pos: [0, 0.6, 0.168] });                       // фартук
      for (const [x, c] of [[-0.14, 0xE04A5A], [0.14, 0x5AA0E0], [-0.07, 0xE8C040]]) { k.add(Cy(0.03, 0.03, 0.07, 8), c, { pos: [x, 0.53, 0.17] }); k.add(Cy(0.012, 0.012, 0.03, 6), C.WOOD2, { pos: [x, 0.58, 0.17], ol: false }); }
      k.in('head'); face(k, skin, hairC); hairdo(k, hairC, style);
      k.add(Cy(0.205, 0.205, 0.03, 16, true), C.LEATHER, { pos: [0, 0.1, 0], rot: [-0.25, 0, 0] });
      for (const s of [-1, 1]) { k.add(To(0.045, 0.015, 6, 12), C.GOLD2, { pos: [s * 0.065, 0.13, 0.19], rot: [-0.35, 0, 0] }); k.add(Cy(0.04, 0.04, 0.012, 12), 0x9FD7FF, { pos: [s * 0.065, 0.13, 0.19], rot: [Math.PI / 2 - 0.35, 0, 0], glow: true }); }
      hand('armR'); flask(k); k.pop();
      break; }
    case 'kuznets': {
      legs(k, 0x3E3530, 0x2A1E16);
      arms(k, coat, skin, { short: true, glove: 0x4A3220 });
      torso(k, coat, { skin, belt: 0x2A1E16, collar: dark });
      k.add(B(0.32, 0.5, 0.025), C.LEATHER, { pos: [0, 0.6, 0.168] }); k.add(B(0.14, 0.08, 0.012), 0x4A2E1A, { pos: [0, 0.52, 0.183], ol: false });
      for (const s of [-1, 1]) k.add(B(0.03, 0.26, 0.02), C.LEATHER, { pos: [s * 0.1, 0.8, 0.13], rot: [0.2, 0, 0], ol: false });
      k.in('head'); face(k, skin, hairC); hairdo(k, hairC, 0, { short: true }); beard(k, hairC, false);
      k.add(Cy(0.21, 0.21, 0.05, 16, true), C.RED, { pos: [0, 0.12, -0.01], rot: [-0.3, 0, 0] });
      hand('armR'); k.push([0, 0, 0], [0.35, 0, -0.15]); hammer(k); k.pop();
      break; }
    case 'torgovets': {
      legs(k, 0x4E3020, boot);
      arms(k, C.CLOTH, skin, { cuff: C.GOLD2 });
      torso(k, coat, { skin, belt: C.LEATHER, collar: C.CLOTH, buttons: C.GOLD });
      k.add(B(0.2, 0.3, 0.012), C.CLOTH, { pos: [0, 0.73, 0.155], ol: false });
      k.in('head'); face(k, skin, hairC); hairdo(k, hairC, style === 1 ? 0 : style, { short: true });
      k.add(B(0.12, 0.025, 0.03), hairC, { pos: [0, -0.04, 0.185], ol: false });           // усы
      k.add(Cy(0.27, 0.27, 0.028, 18), coat, { pos: [0, 0.16, 0], rot: [-0.12, 0, 0.05] });
      k.add(Cy(0.15, 0.17, 0.14, 14), coat, { pos: [0, 0.24, -0.01] }); k.add(Cy(0.172, 0.172, 0.035, 14), C.RED, { pos: [0, 0.19, -0.01] });
      k.add(Co(0.03, 0.34, 6), C.RED, { pos: [0.13, 0.33, -0.08], rot: [-0.6, 0, -0.5], scl: [1, 1, 0.4] });
      hand('armR'); pouch(k); k.pop();
      break; }
    case 'sovetnik': {
      legs(k, 0x3A2028, 0x2A1A1E);
      arms(k, coat, skin, { cuff: C.GOLD });
      torso(k, coat, { skin, hem: 0.44, flare: 0.33, belt: C.GOLD2, collar: C.GOLD, trim: C.GOLD });
      k.add(To(0.17, 0.016, 5, 20), C.GOLD, { pos: [0, 0.82, 0.03], rot: [Math.PI / 2 - 0.55, 0, 0] });
      k.add(Sp(0.04, 8, 6), C.GOLD, { pos: [0, 0.69, 0.17] }); k.add(Sp(0.02, 6, 4), C.RED, { pos: [0, 0.69, 0.205], ol: false });
      k.in('head'); face(k, skin, 0x9A948C, { brow: 0xB9B3AA }); hairdo(k, 0x9A948C, 0, { capOnly: true, short: true }); beard(k, 0xB9B3AA, true);
      k.add(Sp(0.19, 14, 6, 0, Math.PI * 0.32), coat, { pos: [0, 0.06, -0.01] });
      hand('armR'); scroll(k); k.pop();
      break; }
    case 'graf': case 'gertsog': case 'korol': {
      const king = id === 'korol', duke = id === 'gertsog' || king;
      legs(k, 0x2E2430, 0x2A1A14, { cuff: C.GOLD });
      arms(k, coat, skin, { cuff: C.GOLD, glove: C.CLOTH });
      torso(k, coat, { skin, belt: C.GOLD2, collar: duke ? C.WHITE : C.GOLD, trim: C.GOLD, buttons: C.GOLD });
      if (duke) { k.add(Cy(0.25, 0.29, 0.1, 14), C.WHITE, { pos: [0, 0.86, -0.01], scl: [1, 1, 0.85] }); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(B(0.015, 0.035, 0.01), 0x111111, { pos: [Math.sin(a) * 0.27, 0.86, Math.cos(a) * 0.23], rot: [0, a, 0], ol: false }); } }
      k.add(Sp(0.045, 8, 6), C.GOLD, { pos: [0, 0.74, 0.175], scl: [1, 1, 0.5] }); k.add(Sp(0.025, 6, 4), duke ? 0xC8102E : 0x2E6FD0, { pos: [0, 0.74, 0.195], ol: false });
      k.in('head'); face(k, skin, hairC); hairdo(k, hairC, style === 3 ? 1 : style); if (king) { k.add(Cy(0.19, 0.18, 0.11, 16), C.GOLD, { pos: [0, 0.22, -0.01], rot: [-0.1, 0, 0] }); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(Co(0.04, 0.15, 4), C.GOLD, { pos: [Math.sin(a) * 0.17, 0.33, Math.cos(a) * 0.17 - 0.01] }); k.add(Sp(0.024, 6, 4), i % 2 ? 0xC8102E : 0x2E6FD0, { pos: [Math.sin(a) * 0.19, 0.22, Math.cos(a) * 0.19 - 0.01], ol: false }); } k.add(Sp(0.035, 8, 6), C.GOLD, { pos: [0, 0.42, -0.01] }); } else crown(k, duke ? 6 : 4, duke ? 0xC8102E : 0x2E9F5A); // у короля — большая корона
      hand('armR'); k.push([0, 0, 0], [0.5, 0, -0.18]); sword(k, duke ? { blade: 0xF2F4F8, guard: C.GOLD, grip: 0x5A1020, wide: true, len: 0.66 } : { blade: 0xE8ECF2, guard: C.GOLD, grip: 0x2A2040, width: 0.05, len: 0.66 }); k.pop();
      break; }
    default: { // житель (и все неизвестные роли)
      legs(k, pants, boot);
      arms(k, coat, skin, { cuff: C.CLOTH });
      torso(k, coat, { skin, belt: C.LEATHER, collar: C.CLOTH, buttons: C.CLOTH });
      k.in('head'); face(k, skin, hairC); hairdo(k, hairC, style);
      if (style === 0 || style === 2) { k.add(Sp(0.205, 14, 8, 0, Math.PI * 0.45), dark, { pos: [0, 0.07, -0.02], rot: [-0.25, 0, 0], scl: [1.05, 0.7, 1.05] }); k.add(Sp(0.03, 6, 4), dark, { pos: [0, 0.21, -0.04] }); }
      hand('armR'); lantern(k); k.pop();
    }
  }
  if (tierCape || id === 'luchnik') {
    const capeC = tier === 'legendary' ? 0xA4161A : tier === 'epic' ? shade(coat, 0.8) : id === 'luchnik' ? dark : shade(coat, 0.75);
    k.in('cape'); k.add(Cy(0.2, 0.3, 0.66, 12, true, Math.PI * 0.55, Math.PI * 0.9), capeC, { pos: [0, -0.33, -0.005], scl: [1, 1, 0.75] });
    if (tier === 'legendary') k.add(Cy(0.302, 0.302, 0.04, 12, true, Math.PI * 0.55, Math.PI * 0.9), C.GOLD, { pos: [0, -0.64, -0.005], scl: [1, 1, 0.75], ol: false });
    k.in('body'); for (const s of [-1, 1]) k.add(Sp(0.035, 8, 6), C.GOLD, { pos: [s * 0.15, 0.85, 0.11] });
  }
}

// ---------------- Чёрный Орден ----------------
const E = { PLATE: 0x34343E, PLATE2: 0x22222A, TRIM: 0x6A1418, RED: 0xA4161A, BLADE: 0x7A808C, EYE: 0xFF3B30 };
export function buildKnight(kind, scale) {
  THREE = window.W.THREE; W = window.W; Q = W.HQ ? 1.6 : 1;
  let set = CACHE.get('foe|' + kind);
  if (!set) { const k = new Kit(); armour(k, kind); set = bake(k); CACHE.set('foe|' + kind, set); }
  const r = rig(set, { ...PIV, head: [0, 1.12, 0] }); if (scale) r.scale.setScalar(scale); return r;
}
function armour(k, kind) {
  const archer = kind === 'archer', boss = kind === 'lord' || kind === 'commander';
  legs(k, E.PLATE2, E.PLATE2, { greave: E.PLATE, cuff: E.TRIM });
  arms(k, archer ? 0x2A2A30 : E.PLATE2, E.PLATE2, { glove: E.PLATE2, cuff: E.TRIM, pauldron: archer ? null : E.PLATE, pRim: E.RED, bracer: archer ? 0x3A2A1E : null });
  if (!archer) for (const n of ['armL', 'armR']) { k.in(n); k.add(Co(0.03, 0.12, 5), 0x16161B, { pos: [0, 0.09, 0] }); }
  torso(k, archer ? 0x2A2A30 : E.PLATE, { skin: E.PLATE2, skirt: E.RED, belt: 0x16161B, buckle: E.RED, collar: E.PLATE2, flare: kind === 'heavy' ? 0.3 : 0.27 });
  k.add(B(0.25, 0.42, 0.02), E.RED, { pos: [0, 0.62, 0.168] });
  k.add(B(0.14, 0.035, 0.012), 0x111114, { pos: [0, 0.6, 0.18], ol: false }); for (const x of [-0.05, 0, 0.05]) k.add(Co(0.022, 0.07, 4), 0x111114, { pos: [x, 0.65, 0.18], scl: [1, 1, 0.3], ol: false });
  if (kind === 'heavy') k.add(Cy(0.28, 0.25, 0.16, 12), E.PLATE2, { pos: [0, 0.86, 0], scl: [1.2, 1, 0.9] });
  // шлем: закрытый, с прорезью и красными глазами
  k.in('head');
  if (archer) { k.add(Sp(0.2, 14, 10), 0x1C1C22, { scl: [1, 0.98, 0.94] }); k.add(Sp(0.236, 16, 10, 0, Math.PI * 0.6), 0x1C1C22, { rot: [-0.45, 0, 0] }); k.add(Co(0.11, 0.26, 6), 0x1C1C22, { pos: [0, 0.03, -0.25], rot: [-1.9, 0, 0] });
    k.add(B(0.26, 0.09, 0.03), 0x08080A, { pos: [0, 0.0, 0.17], ol: false }); }
  else { k.add(Cy(0.2, 0.19, 0.3, 14), E.PLATE, { pos: [0, -0.02, 0] }); k.add(Sp(0.2, 14, 6, 0, Math.PI / 2), E.PLATE, { pos: [0, 0.13, 0] });
    k.add(B(0.26, 0.04, 0.03), 0x050507, { pos: [0, 0.03, 0.185], ol: false }); k.add(B(0.04, 0.16, 0.03), 0x050507, { pos: [0, -0.05, 0.185], ol: false });
    k.add(To(0.2, 0.016, 4, 16), E.RED, { pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0], ol: false }); }
  for (const s of [-1, 1]) k.add(B(0.06, 0.03, 0.02), E.EYE, { pos: [s * 0.07, 0.03, archer ? 0.19 : 0.2], glow: true });
  if (kind === 'knight' || kind === 'heavy') for (let i = 0; i < 5; i++) k.add(Sp(0.05, 8, 6), E.RED, { pos: [0, 0.33 - i * 0.012, 0.06 - i * 0.07], scl: [0.55, 1, 1.2] });
  if (boss) for (const s of [-1, 1]) { k.add(Co(0.06, 0.3, 6), 0x0E0E12, { pos: [s * 0.22, 0.25, 0], rot: [0, 0, -s * 0.6] }); k.add(Co(0.04, 0.14, 6), 0x0E0E12, { pos: [s * 0.33, 0.39, 0], rot: [0, 0, -s * 0.1] }); }
  if (kind === 'commander') for (let i = 0; i < 5; i++) k.add(Co(0.035, 0.14, 4), E.RED, { pos: [-0.14 + i * 0.07, 0.3, 0.1] });
  if (kind === 'captain') k.add(Sp(0.06, 8, 6), E.RED, { pos: [0, 0.3, 0], scl: [0.5, 1.4, 1.6] });
  // оружие
  const hand = n => k.in(n).push([0, -0.37, 0.02]);
  if (archer) { k.in('armL').push([0, -0.37, 0.02], [0, -1.2, 0]); bow(k, { wood: 0x2A1E16, tip: E.RED, grip: 0x111114 }); k.pop(); k.in('body'); quiver(k, [0.09, 0.72, -0.22], 0x1C1C22, E.RED); }
  else if (kind === 'captain') { hand('armR'); spear(k, { shaft: 0x2A1E16, steel: E.BLADE, flag: E.RED }); k.pop(); }
  else if (kind === 'commander') { hand('armR'); glaive(k); k.pop(); }
  else if (kind === 'heavy') { hand('armR'); k.push([0, 0, 0], [0.45, 0, -0.15]); mace(k); k.pop(); k.pop();
    k.in('armL').push([-0.06, -0.2, 0.12], [0, -0.55, 0]); shield(k, 0x16161B, E.PLATE, 'crown', { w: 0.22, h: 0.68 }); k.pop(); }
  else if (kind === 'lord') { hand('armR'); k.push([0, 0, 0], [0.45, 0, -0.2]); sword(k, { len: 0.95, width: 0.085, blade: 0x3A3A44, guard: 0x111114, grip: E.RED, wide: true, fuller: E.EYE, runes: true, ricasso: true }); k.pop(); k.pop(); }
  else { hand('armR'); k.push([0, 0, 0], [0.5, 0, -0.18]); sword(k, { blade: E.BLADE, guard: E.RED, grip: 0x111114 }); k.pop(); k.pop();
    k.in('armL').push([-0.05, -0.22, 0.1], [0, -0.55, 0]); shield(k, 0x16161B, E.RED, 'crown', { w: 0.16, h: 0.46 }); k.pop(); }
  if (['captain', 'lord', 'commander'].includes(kind)) { k.in('cape'); k.add(Cy(0.21, 0.32, 0.72, 12, true, Math.PI * 0.55, Math.PI * 0.9), kind === 'captain' ? E.RED : 0x2A0A0C, { pos: [0, -0.36, -0.005], scl: [1, 1, 0.75] }); }
}

// ---------------- слияние статичных декораций ----------------
// Все непрозрачные одноцветные toon-меши группы (кроме skip) сливаются в один меш с цветами вершин
// и по одному контуру на толщину: сотни вызовов отрисовки превращаются в несколько.
export function flattenStatic(group, skip = []) {
  THREE = window.W.THREE; W = window.W; Q = W.HQ ? 1.6 : 1; group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert(), buckets = new Map(), main = [], dead = []; let shadow = false;
  const skipped = o => { for (let p = o; p && p !== group; p = p.parent) if (skip.includes(p)) return true; return false; };
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || skipped(o)) return; const m = o.material;
    if (!m || !m.isMeshToonMaterial || m.map || m.transparent || m.vertexColors || m.side !== THREE.FrontSide) return;
    const mat = inv.clone().multiply(o.matrixWorld), col = m.color;
    const put = (list, src) => { let g = src.index ? src.toNonIndexed() : src.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); g.applyMatrix4(mat);
      const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g); };
    put(main, o.geometry); if (o.castShadow) shadow = true;
    const ol = o.children.find(c => c.isMesh && c.material?.isShaderMaterial && c.material.uniforms?.uW);
    if (ol) { const px = ol.material.uniforms.uW.value; if (!buckets.has(px)) buckets.set(px, []); put(buckets.get(px), o.geometry); }
    dead.push(o);
  });
  if (dead.length < 2) return 0;
  for (const o of dead) { o.parent.remove(o); for (const c of o.children) if (c.isMesh) o.remove(c); }
  const me = new THREE.Mesh(merge(main), mats().main); me.castShadow = shadow; me.receiveShadow = true; group.add(me);
  for (const [px, list] of buckets) { const o = new THREE.Mesh(merge(list), W.outline(px)); o.raycast = () => {}; group.add(o); }
  return dead.length;
}
