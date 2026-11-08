// Король для карты: та же модель, что в мультике (тун-стиль style.md), плюс живая анимация.
export function createKing(THREE, { toon, outline }) {
  const P = { purple: 0x4B2A7B, crimson: 0xA4161A, gold: 0xE8B931, ivory: 0xF5EBDC, ruby: 0xC8102E, skin: 0xE9B48F, hair: 0x5A3A22, eye: 0x3A6EA5, white: 0xF4F1EC, ink: 0x1A1210, lip: 0xB5625A };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const basic = c => new THREE.MeshBasicMaterial({ color: c });
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function mesh(parent, geo, mat, { pos, rot, scl, ol = 5 } = {}) {
    const m = new THREE.Mesh(geo, typeof mat === 'number' ? toon(mat) : mat);
    if (pos) m.position.copy(pos); if (rot) m.rotation.set(...rot); if (scl) m.scale.copy(scl);
    m.castShadow = !(mat && mat.isMeshBasicMaterial);
    if (ol) m.add(new THREE.Mesh(geo, outline(Math.max(1, ol * 0.45))));
    parent.add(m); return m;
  }
  const G = {
    sph: (r = 1, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h), box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
    cyl: (a, b, h, s = 20, open = false) => new THREE.CylinderGeometry(a, b, h, s, 1, open), cap: (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12),
    cone: (r, h, s = 16) => new THREE.ConeGeometry(r, h, s), tor: (R, r, s = 32) => new THREE.TorusGeometry(R, r, 12, s),
  };
function buildKing() {
    const K = new THREE.Group(); const J = {};
    // мантия (lathe), грудь, плечи
    const prof = [[0.001, -0.32], [0.52, -0.32], [0.47, 0.0], [0.38, 0.45], [0.31, 0.85], [0.3, 1.05], [0.33, 1.17], [0.22, 1.27], [0.08, 1.31], [0.001, 1.32]].map(([x, y]) => new THREE.Vector2(x, y));
    const robe = mesh(K, new THREE.LatheGeometry(prof, 32), P.purple, { scl: V(1, 1, 0.72) });
    mesh(K, G.tor(0.315, 0.032), P.gold, { pos: V(0, 0.8, 0), rot: [Math.PI / 2, 0, 0], scl: V(1, 0.72, 1), ol: 3 }); // пояс
    // плащ
    const cape = new THREE.Mesh(G.cyl(0.34, 0.66, 1.6, 24, true).rotateY(0), toon(P.crimson, { side: THREE.DoubleSide }));
    const capeGeo = new THREE.CylinderGeometry(0.34, 0.66, 1.6, 24, 6, true, Math.PI * 0.55, Math.PI * 0.9);
    cape.geometry = capeGeo; cape.position.set(0, 0.48, -0.06); cape.scale.set(1, 1, 0.55); K.add(cape); J.cape = cape;
    // горностай
    const collar = mesh(K, G.tor(0.25, 0.075, 40), P.ivory, { pos: V(0, 1.29, -0.01), rot: [Math.PI / 2, 0, 0], ol: 4 });
    { const r = rng(21); for (let i = 0; i < 16; i++) { const a = r() * 6.283, b = r() * 6.283; const p = V((0.25 + 0.076 * Math.cos(b)) * Math.cos(a), (0.25 + 0.076 * Math.cos(b)) * Math.sin(a), 0.076 * Math.sin(b)); mesh(collar, G.sph(0.012, 8, 6), basic(P.ink), { pos: p, ol: 0 }); } }
    // руки
    function arm(side) {
      const sh = new THREE.Group(); sh.position.set(0.32 * side, 1.17, -0.02); K.add(sh);
      mesh(sh, G.cap(0.08, 0.26), P.purple, { pos: V(0, -0.17, 0), ol: 4 });
      const el = new THREE.Group(); el.position.set(0, -0.33, 0); sh.add(el);
      mesh(el, G.cap(0.072, 0.22), P.purple, { pos: V(0, -0.14, 0), ol: 4 });
      mesh(el, G.tor(0.075, 0.028), P.gold, { pos: V(0, -0.27, 0), rot: [Math.PI / 2, 0, 0], ol: 3 });
      const hand = new THREE.Group(); hand.position.set(0, -0.33, 0); el.add(hand);
      mesh(hand, G.sph(0.062), P.skin, { scl: V(0.9, 1.1, 0.85), ol: 3 });
      return { sh, el, hand };
    }
    J.R = arm(-1); J.L = arm(1); // R — правая рука короля (слева на экране при виде спереди)
    // скипетр в правой руке
    const scep = new THREE.Group(); J.R.hand.add(scep); J.scep = scep;
    mesh(scep, G.cyl(0.017, 0.017, 0.85, 10), P.gold, { pos: V(0, 0.18, 0), ol: 2 });
    mesh(scep, G.sph(0.046), P.ruby, { pos: V(0, 0.64, 0), ol: 3 });
    mesh(scep, G.tor(0.03, 0.012, 16), P.gold, { pos: V(0, 0.6, 0), rot: [Math.PI / 2, 0, 0], ol: 2 });
    // голова
    const head = new THREE.Group(); head.position.set(0, 1.55, 0); K.add(head); J.head = head;
    const neck = mesh(K, G.cap(0.08, 0.12), P.skin, { pos: V(0, 1.36, -0.02), ol: 0 });
    mesh(head, G.sph(1, 32, 24), P.skin, { scl: V(0.185, 0.225, 0.2) });
    mesh(head, G.sph(1, 24, 16), P.skin, { pos: V(0, -0.09, 0.03), scl: V(0.15, 0.13, 0.16), ol: 0 });
    mesh(head, G.cap(0.022, 0.06), P.skin, { pos: V(0, -0.005, 0.2), rot: [0.35, 0, 0], ol: 2 });
    [-1, 1].forEach(s => mesh(head, G.sph(1, 12, 10), P.skin, { pos: V(0.182 * s, 0, -0.01), scl: V(0.03, 0.055, 0.035), ol: 2 }));
    // волосы: шапка + затылок + чёлка
    mesh(head, new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, 1.2), P.hair, { pos: V(0, 0.03, -0.012), scl: V(0.2, 0.218, 0.212), rot: [-0.18, 0, 0], ol: 4 });
    mesh(head, new THREE.SphereGeometry(1, 24, 16, Math.PI, Math.PI, 0, 2.2), P.hair, { pos: V(0, 0.02, -0.01), scl: V(0.198, 0.215, 0.212), ol: 4 });
    mesh(head, G.sph(1, 16, 10), P.hair, { pos: V(0.055, 0.135, 0.13), scl: V(0.12, 0.05, 0.07), rot: [0.3, 0, -0.25], ol: 3 });
    // борода, усы
    mesh(head, new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 1.45, 1.7), P.hair, { pos: V(0, -0.1, 0.03), scl: V(0.158, 0.11, 0.165), ol: 3 });
    [-1, 1].forEach(s => mesh(head, G.cap(0.013, 0.05), P.hair, { pos: V(0.03 * s, -0.085, 0.19), rot: [0, 0, s * 1.25], ol: 0 }));
    // рот (открывание по словам)
    J.mouth = mesh(head, G.sph(1, 16, 10), 0x6B2A2A, { pos: V(0, -0.118, 0.182), scl: V(0.042, 0.008, 0.02), ol: 0 });
    J.lip = mesh(head, G.cap(0.008, 0.05), P.lip, { pos: V(0, -0.108, 0.192), rot: [0, 0, Math.PI / 2], ol: 0 });
    // глаза
    J.eyes = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(0.068 * s, 0.028, 0.15); head.add(g);
      mesh(g, G.sph(0.038, 20, 14), basic(P.white), { ol: 0 });
      mesh(g, G.sph(0.022, 16, 12), basic(P.eye), { pos: V(-0.002 * s, 0, 0.027), ol: 0 });
      mesh(g, G.sph(0.011, 10, 8), basic(0x111018), { pos: V(-0.002 * s, 0, 0.042), ol: 0 });
      mesh(g, G.sph(0.006, 8, 6), basic(0xFFFFFF), { pos: V(0.01, 0.01, 0.046), ol: 0 });
      const lid = mesh(head, G.cap(0.01, 0.06), P.hair, { pos: V(0.068 * s, 0.028, 0.188), rot: [0, 0, Math.PI / 2], ol: 0 });
      return { g, lid };
    });
    J.brows = [-1, 1].map(s => mesh(head, G.cap(0.011, 0.07), P.hair, { pos: V(0.07 * s, 0.085, 0.178), rot: [0, 0, Math.PI / 2 - s * 0.08], ol: 0 }));
    // корона
    const crown = new THREE.Group(); crown.position.set(0, 0.2, 0); head.add(crown); J.crown = crown;
    mesh(crown, G.cyl(0.168, 0.162, 0.085, 28), P.gold, { ol: 4 });
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.283, x = Math.sin(a) * 0.165, z = Math.cos(a) * 0.165;
      mesh(crown, G.cone(0.03, 0.12, 10), P.gold, { pos: V(x * 1.03, 0.1, z * 1.03), ol: 3 });
      mesh(crown, G.sph(0.019, 10, 8), P.gold, { pos: V(x * 1.05, 0.17, z * 1.05), ol: 2 });
      mesh(crown, G.sph(0.019, 10, 8), P.ruby, { pos: V(x * 1.1, 0, z * 1.1), ol: 2 });
    }
    K.userData.J = J; return K;
  }
  
  const K = buildKing(), J = K.userData.J;
  const root = new THREE.Group(); K.position.y = 0.32; root.add(K);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  // живая анимация: дыхание, моргание, взгляд, приветственный взмах рукой раз в ~7 секунд
  root.userData.animate = t => {
    const cyc = t % 7.2, wave = ss(0.0, 0.5, cyc) * (1 - ss(2.2, 2.8, cyc)), w = Math.sin(cyc * 9) * wave;
    K.position.y = 0.32 + Math.sin(t * 1.6) * 0.012;
    J.L.sh.rotation.set(-0.25 - 2.3 * wave, 0, 0.18 + 0.45 * wave + 0.25 * w); J.L.el.rotation.set(-1.0 + 0.5 * wave, 0, 0);
    J.R.sh.rotation.set(-0.3, 0, -0.2); J.R.el.rotation.set(-1.05, 0, 0); J.scep.rotation.set(1.25, 0, 0);
    J.head.rotation.set(-0.05 * wave, Math.sin(t * 0.45) * 0.35 * (1 - wave), 0.08 * w);
    const bl = ((t + 0.6) % 3.4) < 0.13 ? 0.1 : 1; J.eyes.forEach(e => { e.g.scale.set(1, bl, 1); e.lid.visible = bl < 0.35; });
    J.mouth.scale.set(0.034, 0.008 + 0.02 * wave, 0.02); J.lip.visible = wave < 0.2;
    J.cape.rotation.x = 0.04 * Math.sin(t * 1.3);
  };
  root.userData.animate(0);
  return root;
}
