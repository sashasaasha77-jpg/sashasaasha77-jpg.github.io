import { loadSkinned, instSkinned } from './glbskin.js';
// Существа и боссы: каменный голем, кикимора, утопец, скелет, дракон, лич, ледяной великан.
// Риг как у героя (body, head, armL/armR, legL/legR) — анимация ходьбы та же, что у людей.
let W, THREE;
function piv(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function m(p, geo, c, pos, rot, ol = 1.5) { const o = W.mesh(p, geo, c, { pos, ol }); if (rot) o.rotation.set(...rot); return o; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), S = (r, d = 1) => new THREE.IcosahedronGeometry(r, d), C = (r1, r2, h, n = 8) => new THREE.CylinderGeometry(r1, r2, h, n), K = (r, h, n = 8) => new THREE.ConeGeometry(r, h, n);
const glow = c => new THREE.MeshBasicMaterial({ color: c });

// общий скелет: ноги от бедра, руки от плеча
function rig(o) {
  const g = new THREE.Group(), body = piv(g, 0, 0, 0), head = piv(body, 0, o.neck, 0);
  const armL = piv(body, -o.sh, o.shy, 0), armR = piv(body, o.sh, o.shy, 0), legL = piv(g, -o.hip, o.hipy, 0), legR = piv(g, o.hip, o.hipy, 0);
  g.userData = { body, head, armL, armR, legL, legR }; return g;
}

function golem() {
  const g = rig({ neck: 1.55, sh: 0.62, shy: 1.35, hip: 0.26, hipy: 0.62 }), u = g.userData, st = 0x8C857B, dk = 0x6E6862, moss = 0x4E7A34;
  m(u.body, B(1.0, 0.8, 0.6), st, [0, 1.15, 0]); m(u.body, B(0.8, 0.35, 0.5), dk, [0, 0.72, 0]); m(u.body, B(0.5, 0.12, 0.62), moss, [-0.15, 1.56, 0]);
  m(u.head, B(0.48, 0.4, 0.44), st, [0, 0.18, 0.04]); for (const x of [-0.11, 0.11]) m(u.head, B(0.09, 0.06, 0.02), 0, [x, 0.2, 0.27], null, 0).material = glow(0xFF8A1A);
  for (const a of [u.armL, u.armR]) { m(a, B(0.36, 0.5, 0.36), dk, [0, -0.2, 0]); m(a, B(0.32, 0.42, 0.32), st, [0, -0.62, 0]); m(a, B(0.42, 0.3, 0.42), dk, [0, -0.95, 0.02]); }
  for (const l of [u.legL, u.legR]) { m(l, B(0.34, 0.42, 0.34), st, [0, -0.2, 0]); m(l, B(0.4, 0.2, 0.46), dk, [0, -0.52, 0.04]); }
  for (const [x, y, z] of [[0.3, 1.5, -0.2], [-0.35, 1.0, 0.31], [0.25, 0.9, 0.31]]) m(u.body, new THREE.OctahedronGeometry(0.08, 0), 0xD98A3A, [x, y, z], null, 1);
  return g;
}
function kikimora() {
  const g = rig({ neck: 1.2, sh: 0.26, shy: 1.08, hip: 0.12, hipy: 0.5 }), u = g.userData, skin = 0x6E8A4A, hair = 0x2E4A22, rag = 0x4A3A22;
  m(u.body, C(0.2, 0.36, 0.75, 8), rag, [0, 0.82, 0]); m(u.body, S(0.24), skin, [0, 1.12, 0.02]); u.body.rotation.x = 0.25;
  m(u.head, S(0.22), skin, [0, 0.12, 0.04]); for (const x of [-0.08, 0.08]) m(u.head, S(0.04, 0), 0, [x, 0.15, 0.22], null, 0).material = glow(0xE8F06A);
  m(u.head, K(0.05, 0.16, 5), skin, [0, 0.08, 0.27], [Math.PI / 2, 0, 0], 1);
  for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4; m(u.head, B(0.06, 0.7, 0.05), hair, [Math.sin(a) * 0.2, -0.12, -Math.cos(a) * 0.14 - 0.02], [0.15, 0, a * 0.2], 1); }
  for (const a of [u.armL, u.armR]) { m(a, C(0.045, 0.04, 0.55, 6), skin, [0, -0.28, 0.05]); for (const f of [-0.04, 0, 0.04]) m(a, K(0.02, 0.14, 4), 0xC8D07A, [f, -0.6, 0.1], [0.4, 0, 0], 1); }
  for (const l of [u.legL, u.legR]) { m(l, C(0.05, 0.045, 0.48, 6), skin, [0, -0.24, 0]); }
  for (const x of [-0.18, 0.2]) m(u.body, K(0.04, 0.5, 4), 0x5E7A2A, [x, 0.55, -0.12], [0, 0, x], 1); // тина
  return g;
}
function utopets() {
  const g = rig({ neck: 1.42, sh: 0.3, shy: 1.25, hip: 0.13, hipy: 0.68 }), u = g.userData, skin = 0x8FB8A8, cloth = 0x3E5A5E, weed = 0x3A6A3A;
  m(u.body, B(0.5, 0.6, 0.3), cloth, [0, 1.0, 0]); m(u.body, B(0.46, 0.18, 0.28), 0x2E4446, [0, 0.66, 0]); u.body.rotation.x = 0.12;
  m(u.head, S(0.22), skin, [0, 0.14, 0.02]); for (const x of [-0.08, 0.08]) m(u.head, S(0.045, 0), 0, [x, 0.17, 0.2], null, 0).material = glow(0xBFF6FF);
  m(u.head, B(0.3, 0.12, 0.28), 0x22343A, [0, 0.33, -0.02]);
  for (const a of [u.armL, u.armR]) { m(a, C(0.06, 0.05, 0.62, 6), skin, [0, -0.3, 0.12], [-0.6, 0, 0]); m(a, S(0.07, 0), skin, [0, -0.55, 0.32], null, 1); }
  for (const l of [u.legL, u.legR]) { m(l, C(0.07, 0.06, 0.66, 6), cloth, [0, -0.33, 0]); m(l, B(0.14, 0.06, 0.22), skin, [0, -0.66, 0.04], null, 1); }
  for (const [x, y] of [[-0.2, 0.9], [0.18, 1.1], [0, 0.75]]) m(u.body, B(0.05, 0.4, 0.03), weed, [x, y, 0.17], [0, 0, x], 1);
  return g;
}
function skeleton() {
  const g = rig({ neck: 1.45, sh: 0.24, shy: 1.28, hip: 0.1, hipy: 0.7 }), u = g.userData, bone = 0xEDE6D3, dk = 0xBDB5A0;
  m(u.body, C(0.03, 0.03, 0.6, 5), bone, [0, 1.0, -0.04]); for (let i = 0; i < 4; i++) m(u.body, B(0.36 - i * 0.04, 0.05, 0.2), bone, [0, 1.25 - i * 0.1, 0], null, 1);
  m(u.body, B(0.3, 0.12, 0.16), dk, [0, 0.72, 0]);
  m(u.head, S(0.18, 1), bone, [0, 0.12, 0]); m(u.head, B(0.2, 0.08, 0.12), bone, [0, 0.0, 0.08], null, 1); for (const x of [-0.06, 0.06]) m(u.head, S(0.045, 0), 0x1A1210, [x, 0.14, 0.15], null, 0);
  for (const a of [u.armL, u.armR]) m(a, C(0.025, 0.025, 0.6, 5), bone, [0, -0.3, 0]);
  m(u.armR, B(0.04, 0.7, 0.04), 0x6A707C, [0, -0.62, 0.3], [1.2, 0, 0], 1); // ржавый меч
  for (const l of [u.legL, u.legR]) m(l, C(0.03, 0.03, 0.7, 5), bone, [0, -0.35, 0]);
  return g;
}
function dragon() {
  const g = rig({ neck: 2.0, sh: 0.7, shy: 1.0, hip: 0.75, hipy: 1.0 }), u = g.userData, red = 0xA4161A, dk = 0x6A0E10, belly = 0xE8B931, horn = 0xF5EBDC;
  m(u.body, S(1.2, 1), red, [0, 1.8, -0.4]); m(u.body, S(0.9, 1), belly, [0, 1.55, 0.25]); u.body.scale.set(1, 1, 1);
  const neck = m(u.body, C(0.38, 0.55, 1.6, 8), red, [0, 2.6, 0.9], [-0.7, 0, 0]);
  m(u.head, B(0.9, 0.7, 1.2), red, [0, 1.25, 1.8]); m(u.head, B(0.8, 0.25, 0.9), dk, [0, 0.92, 2.1]);
  for (const x of [-0.25, 0.25]) { m(u.head, S(0.11, 0), 0, [x, 1.45, 2.38], null, 0).material = glow(0xFFD23A); m(u.head, K(0.12, 0.7, 6), horn, [x * 1.4, 1.75, 1.4], [-0.9, 0, x], 1); }
  for (const [s, a] of [[-1, u.armL], [1, u.armR]]) { // крылья
    const w = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2.6, 0.9), new THREE.Vector2(2.4, -0.4), new THREE.Vector2(1.6, -0.1), new THREE.Vector2(1.4, -0.8), new THREE.Vector2(0.7, -0.3)])), new THREE.MeshToonMaterial({ color: dk, gradientMap: W.grad, side: THREE.DoubleSide }));
    w.position.set(0, 1.4, -0.5); w.rotation.set(0.2, s > 0 ? 0 : Math.PI, 0.35); a.add(w); }
  for (const l of [u.legL, u.legR]) { m(l, C(0.28, 0.22, 1.0, 8), red, [0, -0.5, 0.3]); m(l, B(0.45, 0.2, 0.6), dk, [0, -0.95, 0.5]); }
  let t = u.body; for (let i = 0; i < 6; i++) { const seg = piv(t, 0, i ? 0 : 1.4, i ? -0.5 : -1.4); m(seg, C(0.3 - i * 0.045, 0.35 - i * 0.045, 0.6, 6), red, [0, 0, -0.2], [Math.PI / 2, 0, 0], 1); seg.rotation.x = 0.12; t = seg; }
  m(t, K(0.22, 0.5, 4), dk, [0, 0, -0.6], [-Math.PI / 2, 0, 0], 1);
  for (let i = 0; i < 5; i++) m(u.body, K(0.13, 0.4, 4), horn, [0, 3.0 - i * 0.12, 0.2 - i * 0.45], null, 1);
  g.scale.setScalar(1.25); return g;
}
function lich() {
  const g = rig({ neck: 1.62, sh: 0.3, shy: 1.4, hip: 0.12, hipy: 0.7 }), u = g.userData, robe = 0x2A1A3E, trim = 0x6B3FA0, bone = 0xEDE6D3;
  m(u.body, C(0.28, 0.6, 1.4, 10), robe, [0, 0.75, 0]); m(u.body, C(0.3, 0.3, 0.12, 10), trim, [0, 1.45, 0], null, 1); m(u.body, B(0.08, 1.2, 0.02), trim, [0, 0.8, 0.42], [0.12, 0, 0], 1);
  m(u.head, S(0.2, 1), bone, [0, 0.14, 0]); for (const x of [-0.07, 0.07]) m(u.head, S(0.05, 0), 0, [x, 0.17, 0.17], null, 0).material = glow(0x7BFF6A);
  m(u.head, K(0.32, 0.5, 10), robe, [0, 0.3, -0.06], null, 1); for (let i = 0; i < 5; i++) m(u.head, K(0.03, 0.14, 4), 0xE8B931, [Math.sin(i * 1.26) * 0.17, 0.32, Math.cos(i * 1.26) * 0.17], null, 1);
  for (const a of [u.armL, u.armR]) { m(a, C(0.08, 0.13, 0.7, 6), robe, [0, -0.35, 0]); m(a, S(0.05, 0), bone, [0, -0.72, 0], null, 1); }
  m(u.armR, C(0.03, 0.03, 2.0, 6), 0x3A2A1E, [0, -0.6, 0.15], [0.15, 0, 0], 1); m(u.armR, S(0.14, 0), 0, [0, 0.38, 0.3], null, 0).material = glow(0x7BFF6A);
  for (const l of [u.legL, u.legR]) m(l, C(0.06, 0.06, 0.2, 5), robe, [0, -0.6, 0], null, 0);
  return g;
}
function giant() {
  const g = rig({ neck: 2.55, sh: 0.95, shy: 2.25, hip: 0.4, hipy: 1.05 }), u = g.userData, ice = 0xA8D8F0, deep = 0x5E9BC8, fur = 0xE8EEF2;
  m(u.body, B(1.5, 1.3, 0.9), ice, [0, 1.75, 0]); m(u.body, B(1.6, 0.4, 1.0), fur, [0, 2.35, 0]); m(u.body, B(1.2, 0.5, 0.8), deep, [0, 1.0, 0]);
  m(u.head, B(0.7, 0.62, 0.62), ice, [0, 0.3, 0.05]); m(u.head, B(0.62, 0.3, 0.2), fur, [0, 0.05, 0.36]); for (const x of [-0.16, 0.16]) m(u.head, B(0.12, 0.08, 0.02), 0, [x, 0.38, 0.37], null, 0).material = glow(0x7FE8FF);
  for (let i = 0; i < 5; i++) m(u.head, K(0.08, 0.45, 4), deep, [-0.28 + i * 0.14, 0.75, 0], null, 1);
  for (const a of [u.armL, u.armR]) { m(a, B(0.5, 0.9, 0.5), ice, [0, -0.45, 0]); m(a, B(0.46, 0.8, 0.46), deep, [0, -1.2, 0]); m(a, B(0.56, 0.4, 0.56), ice, [0, -1.72, 0.04]); }
  m(u.armR, C(0.12, 0.2, 2.4, 6), 0x7A8A98, [0, -1.6, 0.6], [1.3, 0, 0], 1); // ледяная дубина
  for (const l of [u.legL, u.legR]) { m(l, B(0.55, 0.6, 0.55), deep, [0, -0.3, 0]); m(l, B(0.6, 0.4, 0.75), fur, [0, -0.85, 0.08]); }
  for (const [x, y, z] of [[0.6, 2.6, -0.2], [-0.5, 2.7, -0.3], [0.1, 2.8, -0.4]]) m(u.body, K(0.12, 0.6, 5), 0xDFF6FF, [x, y, z], null, 1);
  return g;
}
function witch() { // Болотная ведьма: сгорбленная, в лохмотьях, с острой шляпой и посохом-корягой
  const g = rig({ neck: 1.3, sh: 0.26, shy: 1.16, hip: 0.12, hipy: 0.52 }), u = g.userData, skin = 0x8FA86A, robe = 0x3A2E4A, rag = 0x2E3A22;
  m(u.body, C(0.2, 0.42, 0.95, 9), robe, [0, 0.8, 0]); m(u.body, C(0.43, 0.46, 0.12, 9), rag, [0, 0.36, 0]); m(u.body, S(0.23), robe, [0, 1.18, 0.02]); u.body.rotation.x = 0.22;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; m(u.body, B(0.08, 0.26, 0.03), rag, [Math.sin(a) * 0.42, 0.28, Math.cos(a) * 0.42], [0, a, 0.15], 1); }
  m(u.head, S(0.2), skin, [0, 0.1, 0.05]); m(u.head, K(0.05, 0.2, 5), skin, [0, 0.06, 0.29], [Math.PI / 2 + 0.3, 0, 0], 1); m(u.head, S(0.03, 0), 0x4E7A34, [0.03, 0.02, 0.36], null, 0);
  for (const x of [-0.08, 0.08]) m(u.head, S(0.04, 0), 0, [x, 0.14, 0.2], null, 0).material = glow(0xB6FF5A);
  m(u.head, C(0.42, 0.42, 0.04, 14), 0x1E1A28, [0, 0.24, 0]); m(u.head, K(0.2, 0.62, 10), 0x1E1A28, [0.04, 0.55, -0.04], [-0.18, 0, 0.12]); m(u.head, C(0.21, 0.21, 0.06, 12), 0x6A8A2A, [0, 0.29, 0], null, 1);
  for (let k = 0; k < 8; k++) { const a = -1.4 + k * 0.4; m(u.head, B(0.05, 0.55, 0.04), 0x9C9A92, [Math.sin(a) * 0.18, -0.1, -Math.cos(a) * 0.12 - 0.03], [0.12, 0, a * 0.2], 1); }
  for (const a of [u.armL, u.armR]) { m(a, C(0.07, 0.05, 0.5, 6), robe, [0, -0.25, 0.04]); m(a, S(0.06, 0), skin, [0, -0.52, 0.06], null, 1); }
  m(u.armR, C(0.035, 0.045, 1.5, 6), 0x4A3420, [0, -0.35, 0.18], [0.1, 0, 0]); m(u.armR, S(0.11, 0), 0x6A4A2A, [0, 0.42, 0.22], null, 1);
  m(u.armR, S(0.07, 1), 0, [0, 0.5, 0.24], null, 0).material = glow(0x8DFF5A);
  for (const l of [u.legL, u.legR]) m(l, C(0.06, 0.05, 0.5, 6), 0x2A2018, [0, -0.25, 0]);
  return g;
}

// HQ (компьютеры): дополнительные детали поверх основной модели
const EXTRA = {
  golem(u) { // трещины с лавой, валуны на плечах, мох и кристаллы
    for (const [x, y, r] of [[-0.2, 1.3, 0.5], [0.25, 1.05, -0.4], [0.05, 1.42, 1.2]]) m(u.body, B(0.03, 0.34, 0.02), 0, [x, y, 0.305], [0, 0, r], 0).material = glow(0xFF7A1A);
    for (const a of [u.armL, u.armR]) { m(a, S(0.2, 0), 0x7A746C, [0, 0.12, 0], null, 1.2); m(a, S(0.1, 0), 0x4E7A34, [0.05, 0.25, 0.05], null, 0); }
    for (const [x, z] of [[-0.3, 0.1], [0.2, -0.15], [0.35, 0.2]]) m(u.body, S(0.07, 0), 0x5E8A3A, [x, 1.57, z], null, 0);
    m(u.head, B(0.5, 0.08, 0.1), 0x6E6862, [0, 0.3, 0.24], [0.2, 0, 0], 1);
  },
  kikimora(u) { // грибы и ряска на голове, бородавки, кувшинка на плече
    for (const [x, z, h] of [[-0.1, -0.02, 0.1], [0.08, -0.08, 0.13], [0.02, 0.06, 0.08]]) { m(u.head, C(0.012, 0.016, h, 5), 0xE8E2C8, [x, 0.3 + h / 2, z], null, 0); m(u.head, S(0.04, 0), 0xB3202A, [x, 0.31 + h, z], null, 1).scale.set(1, 0.5, 1); }
    for (const [x, y] of [[-0.12, 0.05], [0.14, 0.1], [0.05, -0.02]]) m(u.head, S(0.018, 0), 0x55703A, [x, y, 0.2], null, 0);
    m(u.body, C(0.14, 0.14, 0.02, 10), 0x4E8A3A, [0.2, 1.3, 0], null, 1); m(u.body, S(0.04, 0), 0xF2E6F0, [0.2, 1.33, 0], null, 0);
    for (let k = 0; k < 6; k++) { const a = k * 1.05; m(u.body, B(0.05, 0.22, 0.02), 0x3E4A22, [Math.sin(a) * 0.35, 0.4, Math.cos(a) * 0.35], [0, a, 0.2], 0); }
  },
  utopets(u) { // ракушки, цепь с камнем, водоросли на голове, пузыри
    for (const [x, y] of [[-0.15, 1.15], [0.14, 0.9]]) m(u.body, S(0.045, 0), 0xE8DCC8, [x, y, 0.16], null, 0.8).scale.set(1, 0.7, 0.4);
    for (let i = 0; i < 4; i++) m(u.legL, new THREE.TorusGeometry(0.04, 0.012, 4, 8), 0x55524E, [0.06, -0.55 - i * 0.06, 0.06], [i % 2 ? Math.PI / 2 : 0, 0, 0], 0);
    m(u.legL, S(0.1, 0), 0x6E6862, [0.08, -0.82, 0.12], null, 1);
    for (let k = 0; k < 5; k++) m(u.head, B(0.04, 0.3, 0.02), 0x3A6A3A, [-0.16 + k * 0.08, 0.2, -0.17], [0.3, 0, (k - 2) * 0.15], 0);
    for (const [x, y] of [[0.1, 0.45], [0.16, 0.6], [0.12, 0.72]]) m(u.head, S(0.025 + y * 0.02, 1), 0, [x, y, 0.15], null, 0).material = new THREE.MeshBasicMaterial({ color: 0xCFF4FF, transparent: true, opacity: 0.6 });
  },
  skeleton(u) { // ржавый шлем, щит, тазовая кость, светящиеся глаза
    m(u.head, S(0.2, 1), 0x6A6058, [0, 0.2, -0.01], null, 1).scale.set(1, 0.6, 1); m(u.head, B(0.04, 0.12, 0.05), 0x6A6058, [0, 0.14, 0.18], null, 0.8);
    for (const x of [-0.06, 0.06]) m(u.head, S(0.018, 0), 0, [x, 0.14, 0.18], null, 0).material = glow(0x7FD8FF);
    m(u.armL, C(0.22, 0.22, 0.05, 10), 0x5A3A22, [0, -0.45, 0.12], [Math.PI / 2, 0, 0], 1); m(u.armL, S(0.05, 0), 0x8E949E, [0, -0.45, 0.16], null, 0);
    m(u.body, B(0.26, 0.08, 0.12), 0xEDE6D3, [0, 0.62, 0], null, 1);
  },
  dragon(u) { // зубы, ноздри с дымком, чешуя на брюхе, когти
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) m(u.head, K(0.035, 0.12, 4), 0xF5EBDC, [s * 0.3, 0.97, 1.7 + i * 0.12], [Math.PI, 0, 0], 0);
    for (const x of [-0.18, 0.18]) m(u.head, S(0.06, 0), 0x2A0A0A, [x, 1.3, 2.41], null, 0);
    for (let i = 0; i < 5; i++) m(u.body, C(0.75 - Math.abs(i - 2) * 0.12, 0.75 - Math.abs(i - 2) * 0.12, 0.05, 12, ), 0xC8961E, [0, 1.15 + i * 0.22, 0.6 + Math.sin(i * 0.8) * 0.1], [Math.PI / 2 - 0.3, 0, 0], 0).scale.set(1, 1, 0.3);
    for (const l of [u.legL, u.legR]) for (const x of [-0.14, 0, 0.14]) m(l, K(0.05, 0.2, 4), 0xF5EBDC, [x, -1.02, 0.85], [Math.PI / 2, 0, 0], 0);
  },
  lich(u) { // летающие огоньки-души, книга, цепи на мантии
    for (let i = 0; i < 3; i++) { const a = i * 2.1; m(u.body, S(0.06, 1), 0, [Math.sin(a) * 0.7, 1.6 + i * 0.12, Math.cos(a) * 0.7], null, 0).material = glow(0x9CFF8A); }
    m(u.armL, B(0.24, 0.3, 0.06), 0x5A1E3A, [0, -0.78, 0.1], [0.2, 0, 0], 1); m(u.armL, B(0.2, 0.26, 0.065), 0xE8DCC8, [0, -0.78, 0.1], [0.2, 0, 0], 0);
    for (let i = 0; i < 6; i++) m(u.body, new THREE.TorusGeometry(0.035, 0.01, 4, 8), 0xB8860B, [-0.25 + i * 0.1, 1.15 - Math.sin(i / 5 * Math.PI) * 0.12, 0.34], [0, i % 2 ? Math.PI / 2 : 0, 0], 0);
  },
  giant(u) { // сосульки на руках, иней на плечах, пояс
    for (const a of [u.armL, u.armR]) for (const x of [-0.15, 0.05, 0.18]) m(a, K(0.05, 0.3, 4), 0xDFF6FF, [x, -1.98, 0.1], [Math.PI, 0, 0], 0.8);
    m(u.body, B(1.55, 0.18, 0.95), 0x6A5040, [0, 1.25, 0], null, 1); m(u.body, B(0.24, 0.24, 0.1), 0xB8C8D0, [0, 1.25, 0.5], null, 1);
    for (const x of [-0.6, 0.6]) m(u.body, S(0.2, 0), 0xFFFFFF, [x, 2.55, 0], null, 0);
  },
  witch(u) { // бородавки, свеча на шляпе, пояс со склянками, сумка
    m(u.head, C(0.025, 0.025, 0.1, 6), 0xF2E6C8, [0.18, 0.33, 0.12], null, 0); m(u.head, K(0.02, 0.06, 5), 0, [0.18, 0.41, 0.12], null, 0).material = glow(0xFFC23A);
    m(u.body, C(0.3, 0.33, 0.05, 10), 0x5A3A22, [0, 0.62, 0], null, 1);
    for (const [x, c] of [[-0.2, 0x8DFF5A], [0, 0xB36AFF], [0.2, 0xFF6A6A]]) { m(u.body, S(0.05, 1), c, [x, 0.56, 0.28], null, 0.8); m(u.body, C(0.015, 0.015, 0.05, 5), 0x6B4A2A, [x, 0.62, 0.28], null, 0); }
    m(u.body, B(0.18, 0.16, 0.08), 0x6B4A2A, [-0.33, 0.55, 0.05], [0, 0.5, 0], 1);
  },
};
const MAKE = { golem, kikimora, utopets, skeleton, dragon, lich, giant, witch };
export function buildMonster(kind, scale) {
  W = window.W; THREE = W.THREE; const g = MAKE[kind](); if (W.HQ && EXTRA[kind]) EXTRA[kind](g.userData); if (scale && scale !== 1) g.scale.multiplyScalar(scale);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
export const isMonster = kind => !!MAKE[kind];

// ---------------- конь героя: 4 окраса, скелет и анимации Idle / Walk / Run (horse-1..4.glb) ----------------
export const horseVariant = nick => { let h = 0; for (const c of String(nick || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 1 + (h % 4); };
export function buildHorse(variant = 1) {
  W = window.W; THREE = W.THREE; const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.body = body;
  loadSkinned(`horse-${variant}.glb`).then(T => { const h = instSkinned(T); h.scale.setScalar(0.75); body.add(h); g.userData.anim = h.userData; h.userData.play('Idle'); W.redraw && W.redraw(); }).catch(e => console.warn('horse', e));
  return g;
}
export function rideHorse(horse, hero, t, speed) { // ходьба, галоп или стоит — по скорости; всадник сидит в седле
  const ud = horse.userData, dt = Math.min(0.1, Math.max(0, t - (ud.lt ?? t))); ud.lt = t;
  if (ud.anim) { ud.anim.play(speed > 7 ? 'Run' : speed > 0.4 ? 'Walk' : 'Idle'); ud.anim.mixer.timeScale = speed > 7 ? speed / 10 : speed > 0.4 ? Math.max(0.6, speed / 4) : 1; ud.anim.mixer.update(dt); }
  const u = hero.userData; u.legL.rotation.x = u.legR.rotation.x = -1.35; u.armL.rotation.x = u.armR.rotation.x = -0.65;
  u.body.position.y = -0.3; u.body.rotation.x = 0.05; return 0.78; // высота седла
}
