// «Четыре знамени» — герой из блоков (как в Wargram), собран в коде, поверх нарисованного фона лагеря.
import * as THREE from '../three.module.js';

const FC = { lions: 0xE8B33A, wolves: 0x3F6FC4, dragons: 0xD8302A, ravens: 0x7A4AC8 };
const EMB = { lions: '🦁', wolves: '🐺', dragons: '🐉', ravens: '🪶' };
// Точки постановки в кадре лагеря, в долях видимой области.
const CAMP_FRAME = { hero: [0.34, 0.708], dummyBase: [0.70, 0.722], dummyTop: [0.70, 0.474] };
const HERO_H = 1.95, HERO_K = 1.2, HERO_THIN = 0.78; // герой на голову выше чучела и стройнее

let R, scene, cam, clock, grad, el = null, ready = false;
let heroOpt = { role: 'warrior', fac: 'lions', gold: false, skin: '' }, hero = null, enemy = null, dummy = null, auraG = null, fx = [], DH = 1.5, faceCam = false;
const wob = { x: 0, vx: 0, z: 0, vz: 0 }, BASE = new THREE.Vector3();


const HERO_P = new THREE.Vector3(), TARGET_P = new THREE.Vector3(), ray = new THREE.Raycaster();

function toonGrad() { const d = new Uint8Array([155, 155, 155, 255, 215, 215, 215, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; }
const MATS = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (MATS.has(k)) return MATS.get(k); const m = new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...o }); MATS.set(k, m); return m; };
function box(parent, w, h, d, c, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), c && c.isMaterial ? c : M(c)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
function cyl(parent, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 8) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; }
const shade = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
function capeTex(col, emb, trim) { const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.fillRect(0, 0, 128, 192);
  g.fillStyle = '#0002'; for (let x = 0; x < 128; x += 32) g.fillRect(x + 22, 0, 6, 192);
  g.fillStyle = trim; g.fillRect(0, 176, 128, 16); g.fillRect(0, 0, 128, 8);
  g.font = '64px system-ui,"Apple Color Emoji","Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (emb) g.fillText(emb, 64, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// ---------- герой из блоков ----------
// Скины — набор цветов/деталей (дальше — продажа в Лавке).
const SKINS = {
  base: { metal: 0xB8C0CC, metalD: 0x6E7682, trim: 0xE8B931, skin: 0xF0C49A, pants: 0x3A3048, boots: 0x5A3A22, hair: 0x5A3420 },
  gold: { metal: 0xF2C84A, metalD: 0xB0841C, trim: 0xFFF0A0, skin: 0xF0C49A, pants: 0x4A3418, boots: 0x6A4420, hair: 0x5A3420 },
  // скины за рекламу
  silver: { metal: 0xEEF2F8, metalD: 0x9AA4B4, trim: 0xFFFFFF, pants: 0x4A5060, boots: 0x6A7280 },
  dark: { metal: 0x3A3A44, metalD: 0x1E1E26, trim: 0xD8342A, pants: 0x1A1A22, boots: 0x111116, hair: 0x111111 },
  ice: { metal: 0xA8E4FF, metalD: 0x5AA8D8, trim: 0xFFFFFF, pants: 0x2A4A6A, boots: 0x3A5A7A, hair: 0xDDEEFF },
  forest: { metal: 0x6A9A4A, metalD: 0x3E6A2E, trim: 0xC8A24A, pants: 0x3A4A2A, boots: 0x5A4020 },
  fire: { metal: 0xFF7A2A, metalD: 0xB8401A, trim: 0xFFD23A, pants: 0x4A1A12, boots: 0x3A1A0A, hair: 0xC83A1A },
  royal: { metal: 0x8A5AD8, metalD: 0x5A3A9A, trim: 0xFFD75A, pants: 0x2A1A4A, boots: 0x3A2A5A },
  bronze: { metal: 0xC8844A, metalD: 0x8A5428, trim: 0xFFC890, pants: 0x4A3020, boots: 0x5A3418 },
  bone: { metal: 0xEDE6D2, metalD: 0xB8AE96, trim: 0x6A6458, pants: 0x4A4438, boots: 0x5A5448, skin: 0xE8E0D0, hair: 0xD8D0C0 },
  sea: { metal: 0x3AC8C0, metalD: 0x1E8A8A, trim: 0xFF8A6A, pants: 0x1A3A4A, boots: 0x1E5A6A },
  candy: { metal: 0xFF9AD0, metalD: 0xD86AA8, trim: 0xFFFFFF, pants: 0x6A3A6A, boots: 0xC85A9A, hair: 0xFFD0E8 },
};
// ---------- скины-персонажи (как у Wargram: свой образ + титул над головой) ----------
const glowM = c => new THREE.MeshBasicMaterial({ color: c });
function blade(hand, len, col, glow) { const w = new THREE.Group(); w.rotation.x = -.9; hand.add(w); box(w, .05, .05, .22, 0x2a2a30, 0, 0, 0); box(w, .2, .05, .06, 0xC8A24A, 0, 0, .12);
  const b = new THREE.Mesh(new THREE.BoxGeometry(.07, .03, len), glow ? glowM(col) : new THREE.MeshToonMaterial({ color: col, gradientMap: grad })); b.position.z = .15 + len / 2; w.add(b); return w; }
function swapWeapon(P, make) { if (P.wR) P.wR.visible = false; if (P.handR) P.wR2 = make(P.handR); }
function wings(torso, color, light) {
  for (const direction of [-1, 1]) {
    const wing = new THREE.Shape();
    wing.moveTo(0, 0); wing.lineTo(.22, .50); wing.lineTo(.66, .57);
    wing.lineTo(.56, .30); wing.lineTo(.79, .15); wing.lineTo(.52, .15);
    wing.lineTo(.45, -.05); wing.lineTo(.27, .02); wing.lineTo(.10, -.18);
    wing.closePath();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(wing, { depth: .045, bevelEnabled: false }), M(color));
    mesh.position.set(direction * .18, .30, -.21);
    mesh.scale.x = direction;
    mesh.rotation.y = direction * .17;
    torso.add(mesh);
    box(torso, .15, .12, .16, light, direction * .34, .62, -.035).rotation.z = direction * .24;
  }
}
function dragonArmor(P, scaleColor, hornColor, light) {
  const head = P.head;
  box(head, .43, .34, .38, scaleColor, 0, .20, .02);
  box(head, .36, .19, .23, scaleColor, 0, .10, .23);
  box(head, .28, .045, .20, hornColor, 0, .035, .29);
  for (const direction of [-1, 1]) {
    box(head, .10, .06, .024, glowM(light), direction * .115, .235, .224);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(.065, .27, 5), M(hornColor));
    horn.position.set(direction * .155, .43, -.035);
    horn.rotation.z = -direction * .28;
    head.add(horn);
  }
  wings(P.torso, scaleColor, hornColor);
}
export const CHAR = {
  black_rider: {
    cape: 0x732538, title: 'ВСАДНИК НА ЧЁРНОМ КОНЕ', c: '#eead70', noHelm: true,
    pal: { metal: 0x535361, metalD: 0x343442, trim: 0xD59A60, pants: 0x292934, boots: 0x252530, skin: 0x3A3640, hair: 0x24242D },
    extra(P) {
      const coat = 0x292831, mane = 0x16151C, tack = 0x744234, brass = 0xD59A60;
      const horse = new THREE.Group();
      P.g.add(horse);
      box(horse, .61, .50, 1.23, coat, 0, .83, -.11);
      box(horse, .52, .46, .44, 0x33313B, 0, .86, .41);
      box(horse, .34, .63, .37, coat, 0, 1.13, .50).rotation.x = -.36;
      box(horse, .38, .28, .49, coat, 0, 1.47, .69).rotation.x = .26;
      box(horse, .33, .19, .33, 0x3B3944, 0, 1.35, .90).rotation.x = .26;
      box(horse, .13, .54, .21, mane, 0, 1.19, .37).rotation.x = -.46;
      box(horse, .15, .53, .15, mane, 0, .65, -.77).rotation.x = .38;
      box(horse, .70, .08, .59, tack, 0, 1.105, -.13);
      for (const side of [-1, 1]) {
        box(horse, .085, .17, .09, coat, side * .12, 1.66, .58).rotation.z = side * -.18;
        box(horse, .02, .052, .048, glowM(0xEAB077), side * .197, 1.49, .75);
        box(horse, .046, .30, .47, 0x782C42, side * .313, .96, -.15);
        box(horse, .047, .035, .47, brass, side * .338, .82, -.15);
        for (const z of [-.54, .42]) {
          box(horse, .16, .55, .18, coat, side * .205, .37, z).rotation.x = z < 0 ? .22 : -.08;
          box(horse, .17, .15, .20, mane, side * .205, .075, z + .034);
        }
      }
      box(horse, .352, .045, .055, tack, 0, 1.40, .88);
      const seat = new THREE.Group();
      seat.position.y = .58;
      seat.scale.setScalar(.69);
      P.g.add(seat);
      seat.add(P.body);
      P.legL.rotation.z = -.51;
      P.legR.rotation.z = .51;
      box(P.head, .39, .26, .35, 0x393741, 0, .32, 0);
      box(P.head, .34, .06, .034, brass, 0, .255, .18);
    }
  },

  ice_dragon: { cape: 0x3C82B4, title: 'ЛЕДЯНОЙ ДРАКОН', c: '#80dfff', noHelm: true,
    pal: { metal: 0x91C4DC, metalD: 0x457DA8, trim: 0xCEEFFF, pants: 0x35577B, boots: 0x244565, skin: 0x82C9DE, hair: 0x4A9ABF },
    extra(P) { dragonArmor(P, 0x65AACA, 0xD6F4FF, 0x91F6FF); } },
  dusk_dragon: { cape: 0x5A3479, title: 'ДРАКОН СУМЕРЕК', c: '#bb8cff', noHelm: true,
    pal: { metal: 0x6F567D, metalD: 0x3E2E55, trim: 0xAD69EB, pants: 0x2F294A, boots: 0x1D1631, skin: 0x775989, hair: 0x342244 },
    extra(P) { dragonArmor(P, 0x534067, 0xA88AC8, 0xDC8CFF); } },
  raven_warden: { cape: 0x312541, title: 'ВОРОН СМЕРТИ', c: '#a79bd5', noHelm: true,
    pal: { metal: 0x655D81, metalD: 0x323048, trim: 0xBDC1DC, pants: 0x342C45, boots: 0x231F35, skin: 0x483D58, hair: 0x292337 },
    extra(P) {
      box(P.head, .36, .37, .38, 0x352940, 0, .22, .025);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(.12, .31, 4), M(0x615778));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, .135, .26);
      P.head.add(beak);
      for (const dir of [-1, 1]) {
        box(P.head, .08, .04, .025, glowM(0xE2BAFF), dir * .11, .24, .225);
        for (let i = 0; i < 3; i++) box(P.torso, .09, .25, .08, 0x514365, dir * (.36 + i * .06), .51 - i * .06, -.06).rotation.z = dir * .48;
      }
      wings(P.torso, 0x2C233C, 0x74668C);
    } },
  diamond: { cape: 0x5AB8E8, title: 'АЛМАЗНЫЙ МЕЧНИК', c: '#7ad8ff', pal: { metal: 0xBFEFFF, metalD: 0x6FC8F0, trim: 0xFFFFFF, pants: 0x2A5A8A, boots: 0x3A6A9A, hair: 0xE8F8FF },
    extra(P, S) { swapWeapon(P, h => blade(h, .9, 0x9AF0FF, true)); for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(.1), glowM(0xBFF6FF)); c.position.set(s * .36, .62, 0); c.scale.y = 1.6; P.torso.add(c); }
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.08), glowM(0xBFF6FF)); cr.position.set(0, .66, 0); cr.scale.y = 1.8; P.head.add(cr); const l = new THREE.PointLight(0x9AF0FF, 2, 3); l.position.y = .4; P.torso.add(l); } },
  samurai: { cape: 0x8A1A14, title: 'САМУРАЙ', c: '#e0503a', noHelm: true, pal: { metal: 0xB8261E, metalD: 0x5A1210, trim: 0xE8B931, pants: 0x1A1A22, boots: 0x1A1A22, hair: 0x111111 },
    extra(P, S) { const h = P.head; box(h, .42, .18, .4, 0x2a1a18, 0, .38, 0); box(h, .62, .05, .56, 0x8A1A14, 0, .3, -.02).rotation.x = .12;
      const m = box(h, .34, .05, .03, 0xE8B931, 0, .56, .17); m.rotation.z = 0; box(h, .05, .16, .03, 0xE8B931, -.15, .64, .17).rotation.z = .4; box(h, .05, .16, .03, 0xE8B931, .15, .64, .17).rotation.z = -.4;
      for (const s of [-1, 1]) box(P.torso, .2, .08, .34, 0x8A1A14, s * .36, .58, 0).rotation.z = s * -.35;
      swapWeapon(P, hd => blade(hd, .95, 0xEEF2F6)); } },
  ninja: { cape: 0x22222A, title: 'НИНДЗЯ', c: '#3a3a44', noHelm: true, pal: { metal: 0x22222A, metalD: 0x15151A, trim: 0xD8342A, pants: 0x22222A, boots: 0x111116, skin: 0xF0C49A, hair: 0x15151A },
    extra(P, S) { const h = P.head; box(h, .37, .37, .35, 0x22222A, 0, .2, -.01); box(h, .3, .07, .02, 0xF0C49A, 0, .22, .17); box(h, .06, .04, .02, 0x111, -.07, .22, .18); box(h, .06, .04, .02, 0x111, .07, .22, .18);
      box(h, .39, .06, .37, 0xD8342A, 0, .3, -.01); for (const s of [-1, 1]) box(h, .05, .22, .04, 0xD8342A, s * .05, .2, -.24).rotation.x = .5;
      swapWeapon(P, hd => blade(hd, .8, 0xD8DCE4)); const back = blade(P.torso, .7, 0x6a6a72); back.rotation.set(0, 0, 2.4); back.position.set(.05, .35, -.2); } },
  viking: { cape: 0x6A4A30, title: 'ВИКИНГ', c: '#c8742a', noHelm: true, pal: { metal: 0x8A8A92, metalD: 0x5A5A62, trim: 0xC8A24A, pants: 0x5A4030, boots: 0x4A3020, hair: 0xC8742A },
    extra(P, S) { const h = P.head; box(h, .38, .16, .36, 0x8A8A92, 0, .37, 0); box(h, .4, .04, .38, 0xC8A24A, 0, .3, 0);
      for (const s of [-1, 1]) { const hn = new THREE.Mesh(new THREE.ConeGeometry(.06, .3, 6), new THREE.MeshToonMaterial({ color: 0xF2EAD8, gradientMap: grad })); hn.position.set(s * .24, .48, 0); hn.rotation.z = s * -.9; h.add(hn); }
      box(h, .34, .2, .08, 0xC8742A, 0, .03, .17); box(h, .2, .12, .06, 0xC8742A, 0, -.08, .17); box(P.torso, .62, .14, .36, 0x8A6A44, 0, .58, 0);
      swapWeapon(P, hd => { const w = new THREE.Group(); w.rotation.x = -.9; hd.add(w); box(w, .05, .05, .9, 0x6A4424, 0, 0, .35); box(w, .05, .32, .22, 0xC8CCD4, 0, .1, .75); return w; }); } },
  cossack: { cape: 0x2A3460, title: 'КАЗАК', c: '#3a4a9a', noHelm: true, pal: { metal: 0x3A4A8A, metalD: 0x2A3460, trim: 0xE8B931, pants: 0xC8302A, boots: 0x15151A, hair: 0x3A2414 },
    extra(P, S) { const h = P.head; box(h, .4, .3, .38, 0x1A1A1E, 0, .46, 0); box(h, .3, .05, .28, 0xC8302A, 0, .62, 0); box(h, .24, .05, .04, 0x3A2414, 0, .1, .17);
      for (const s of [-1, 1]) box(h, .08, .04, .04, 0x3A2414, s * .13, .07, .17).rotation.z = s * .5; for (let i = 0; i < 4; i++) box(P.torso, .04, .1, .03, 0xE8E8E8, -.12 + i * .08, .42, .16);
      swapWeapon(P, hd => { const w = blade(hd, .85, 0xDCE0E8); w.children[2].rotation.y = .12; return w; }); } },
  tsar: { cape: 0xB8141E, title: 'ЦАРЬ', c: '#ffd23a', noHelm: true, pal: { metal: 0xF2C84A, metalD: 0xB0841C, trim: 0xFFF0A0, pants: 0x8A1A14, boots: 0x6A4420, hair: 0x6A4424 },
    extra(P, S) { const h = P.head; box(h, .38, .1, .36, 0xF2C84A, 0, .4, 0); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) box(h, .07, .14, .07, 0xF2C84A, (i < 2 ? s * .15 : 0), .5, (i < 2 ? 0 : s * .15));
      for (const [x, z, c] of [[0, .18, 0xE0303A], [.18, 0, 0x30A0E0], [-.18, 0, 0x30C060]]) { const g = new THREE.Mesh(new THREE.OctahedronGeometry(.045), glowM(c)); g.position.set(x, .42, z); h.add(g); }
      box(h, .3, .12, .06, 0x6A4424, 0, .03, .17); box(P.torso, .64, .12, .38, 0xF6F2EA, 0, .6, -.02); if (P.cape) P.cape.scale.set(1.2, 1.25, 1); } },
  vampire: { cape: 0x2A0E1A, title: 'ВАМПИР', c: '#c8102a', noHelm: true, pal: { metal: 0x2A1A2A, metalD: 0x1A0E1A, trim: 0xC8102A, pants: 0x15101A, boots: 0x111111, skin: 0xE8E4F0, hair: 0x111111 },
    extra(P, S) { const h = P.head; box(h, .36, .12, .34, 0x111111, 0, .36, -.01); box(h, .08, .08, .04, 0x111111, 0, .3, .16);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, .02), glowM(0xFF2030)); e.position.set(s * .08, .21, .17); h.add(e); box(P.torso, .08, .34, .3, 0xC8102A, s * .3, .66, -.05).rotation.z = s * .3; } } },
  robot: { cape: 0x5A6474, title: 'РОБОТ', c: '#3ae0ff', noHelm: true, pal: { metal: 0x9AA4B4, metalD: 0x5A6474, trim: 0x3AE0FF, pants: 0x5A6474, boots: 0x3A4250, skin: 0x9AA4B4, hair: 0x9AA4B4 },
    extra(P, S) { const h = P.head; box(h, .4, .4, .38, 0x9AA4B4, 0, .2, 0); const v = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .02), glowM(0x3AE0FF)); v.position.set(0, .23, .2); h.add(v);
      box(h, .03, .2, .03, 0x5A6474, 0, .5, 0); const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), glowM(0xFF4040)); b.position.y = .62; h.add(b); for (const s of [-1, 1]) box(h, .05, .14, .14, 0x5A6474, s * .22, .2, 0);
      const c = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, .02), glowM(0x3AE0FF)); c.position.set(0, .34, .17); P.torso.add(c); } },
  ogre: { cape: 0x5A4028, title: 'ЗЕЛЁНЫЙ ОГР', c: '#6ab04a', noHelm: true, scale: 1.12, pal: { metal: 0x7A5A3A, metalD: 0x5A4028, trim: 0xC8A24A, pants: 0x5A4028, boots: 0x3A2818, skin: 0x7AB04A, hair: 0x5A7A30 },
    extra(P, S) { const h = P.head; box(h, .42, .36, .38, 0x7AB04A, 0, .19, 0); for (const s of [-1, 1]) { box(h, .1, .14, .05, 0x6AA03A, s * .25, .24, 0).rotation.z = s * -.5; box(h, .04, .08, .04, 0xF6F0DC, s * .08, .02, .19); box(h, .06, .05, .02, 0x2a2a20, s * .09, .24, .2); }
      swapWeapon(P, hd => { const w = new THREE.Group(); w.rotation.x = -.9; hd.add(w); cyl(w, .07, .14, .9, 0x7A5030, 0, 0, .45, 8).rotation.x = Math.PI / 2; return w; }); } },
  darklord: { cape: 0x2A1A44, title: 'ТЁМНЫЙ ЛОРД', c: '#9a5aff', noHelm: true, pal: { metal: 0x2A2438, metalD: 0x15121E, trim: 0x9A5AFF, pants: 0x15121E, boots: 0x0E0C14, hair: 0x15121E },
    extra(P, S) { const h = P.head; box(h, .42, .44, .4, 0x2A2438, 0, .2, 0); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.08, .04, .02), glowM(0xB070FF)); e.position.set(s * .08, .22, .21); h.add(e);
        const hn = new THREE.Mesh(new THREE.ConeGeometry(.05, .34, 5), new THREE.MeshToonMaterial({ color: 0x15121E, gradientMap: grad })); hn.position.set(s * .18, .5, -.02); hn.rotation.z = s * -.35; h.add(hn);
        const sp = new THREE.Mesh(new THREE.ConeGeometry(.06, .22, 5), new THREE.MeshToonMaterial({ color: 0x15121E, gradientMap: grad })); sp.position.set(s * .38, .72, 0); sp.rotation.z = s * -.6; P.torso.add(sp); }
      const l = new THREE.PointLight(0x9A5AFF, 2.2, 3); l.position.y = .5; P.torso.add(l); swapWeapon(P, hd => blade(hd, .95, 0x9A5AFF, true)); } },
  pharaoh: { cape: 0xF2EEE0, title: 'ФАРАОН', c: '#e8c04a', noHelm: true, pal: { metal: 0xF6F2E6, metalD: 0xD8D0BC, trim: 0xE8B931, pants: 0xF2EEE0, boots: 0x6A4424, skin: 0xC8946A, hair: 0x111111 },
    extra(P, S) { const h = P.head; box(h, .42, .3, .4, 0xE8B931, 0, .34, -.03); for (let i = 0; i < 3; i++) box(h, .43, .03, .41, 0x2A4AB0, 0, .24 + i * .1, -.03); for (const s of [-1, 1]) box(h, .1, .32, .2, 0xE8B931, s * .22, .06, -.04);
      box(P.torso, .5, .06, .36, 0x2A4AB0, 0, .2, 0); box(P.torso, .56, .1, .38, 0xE8B931, 0, .6, 0);
      swapWeapon(P, hd => { const w = new THREE.Group(); w.rotation.x = -.6; hd.add(w); cyl(w, .03, .03, 1.2, 0xE8B931, 0, 0, .3).rotation.x = Math.PI / 2; const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), glowM(0x2A5AFF)); b.position.z = .92; w.add(b); return w; }); } },
  mummy: { cape: 0xE6DCC0, title: 'МУМИЯ', c: '#d8cca8', noHelm: true, pal: { metal: 0xE6DCC0, metalD: 0xCFC3A2, trim: 0xBFB290, pants: 0xE6DCC0, boots: 0xCFC3A2, skin: 0xE6DCC0, hair: 0xE6DCC0 },
    extra(P, S) { const h = P.head; box(h, .4, .4, .38, 0xE6DCC0, 0, .2, 0); for (let i = 0; i < 4; i++) box(h, .41, .03, .39, 0xC8BC98, 0, .06 + i * .1, 0).rotation.z = (i % 2 ? .08 : -.08);
      box(h, .06, .04, .02, 0x1A1A10, .08, .22, .2); for (let i = 0; i < 5; i++) box(P.torso, .5, .03, .34, 0xC8BC98, 0, .1 + i * .12, 0).rotation.z = (i % 2 ? .1 : -.1); if (P.cape) P.cape.visible = false; } },
  zombie: { cape: 0x4A5A3A, title: 'ЗОМБИ', c: '#7a9a4a', noHelm: true, pal: { metal: 0x6A7A4A, metalD: 0x4A5A3A, trim: 0x8A6A4A, pants: 0x3A4A6A, boots: 0x3A3020, skin: 0x8AAA6A, hair: 0x3A3A2A },
    extra(P, S) { const h = P.head; box(h, .4, .38, .38, 0x8AAA6A, 0, .19, 0); box(h, .42, .08, .4, 0x3A3A2A, 0, .38, 0); box(h, .07, .07, .02, 0x111111, -.08, .22, .2); box(h, .07, .03, .02, 0x111111, .08, .2, .2); box(h, .18, .04, .02, 0x4A2A2A, 0, .08, .2);
      box(P.torso, .12, .12, .02, 0x5A3A2A, .1, .3, .17); box(P.torso, .1, .08, .02, 0x5A3A2A, -.12, .48, .17); if (P.cape) P.cape.visible = false; } },
  knight: { cape: 0x2A4AA0, title: 'РЫЦАРЬ', c: '#8ab0e0', noHelm: true, pal: { metal: 0xB8C0CC, metalD: 0x7A8494, trim: 0xE8B931, pants: 0x2A3A6A, boots: 0x3A2A1A, hair: 0x6A4424 },
    extra(P, S) { const h = P.head; box(h, .42, .44, .4, 0xB8C0CC, 0, .2, 0); box(h, .3, .03, .02, 0x15151A, 0, .22, .21); box(h, .03, .14, .02, 0x15151A, 0, .14, .21); box(h, .06, .16, .3, 0xC8302A, 0, .5, -.04);
      box(P.torso, .5, .5, .02, 0x2A4AA0, 0, .32, .19); box(P.torso, .06, .3, .02, 0xE8B931, 0, .34, .2); box(P.torso, .22, .06, .02, 0xE8B931, 0, .38, .2);
      swapWeapon(P, hd => blade(hd, .9, 0xE0E4EA)); } },
  pumpkin: { cape: 0x3A2A4A, title: 'ТЫКВОГОЛОВЫЙ', c: '#ff8a1a', noHelm: true, pal: { metal: 0x3A2A4A, metalD: 0x241A30, trim: 0xFF8A1A, pants: 0x241A30, boots: 0x15101A, hair: 0xFF8A1A },
    extra(P, S) { const h = P.head; box(h, .5, .44, .48, 0xFF8A1A, 0, .2, 0); for (const x of [-.18, 0, .18]) box(h, .04, .44, .49, 0xE0701A, x, .2, 0); box(h, .08, .12, .08, 0x3A6A2A, 0, .48, 0);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.09, .07, .02), glowM(0xFFE03A)); e.position.set(s * .1, .26, .25); h.add(e); } const m = new THREE.Mesh(new THREE.BoxGeometry(.26, .05, .02), glowM(0xFFE03A)); m.position.set(0, .1, .25); h.add(m);
      const l = new THREE.PointLight(0xFF9A2A, 1.6, 2.5); l.position.set(0, .2, .4); h.add(l); swapWeapon(P, hd => blade(hd, .8, 0x8A8A92)); } },
  highlander: { cape: 0x1E5A3A, title: 'ГОРЕЦ', c: '#3aa06a', noHelm: true, pal: { metal: 0x1E5A3A, metalD: 0x144028, trim: 0xC8302A, pants: 0x1E5A3A, boots: 0x3A2414, hair: 0xC8742A },
    extra(P, S) { const h = P.head; box(h, .36, .1, .36, 0x1E3A6A, 0, .36, 0); const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), M(0xC8302A)); b.position.y = .44; h.add(b); box(h, .3, .16, .06, 0xC8742A, 0, .02, .17);
      for (let i = 0; i < 3; i++) box(P.torso, .52, .03, .36, 0xC8302A, 0, .1 + i * .08, 0); box(P.torso, .08, .7, .38, 0x1E3A6A, .12, .4, 0).rotation.z = .6;
      swapWeapon(P, hd => blade(hd, 1.05, 0xDCE0E8)); } },
  legionary: { cape: 0xB0201A, title: 'ЛЕГИОНЕР', c: '#d84030', noHelm: true, pal: { metal: 0xC8A24A, metalD: 0x9A7A2A, trim: 0xB0201A, pants: 0xB0201A, boots: 0x6A4424, hair: 0x3A2414 },
    extra(P, S) { const h = P.head; box(h, .4, .2, .4, 0xC8A24A, 0, .36, 0); for (const s of [-1, 1]) box(h, .04, .2, .14, 0xC8A24A, s * .2, .14, .1); box(h, .08, .14, .44, 0xB0201A, 0, .52, 0);
      for (let i = 0; i < 4; i++) box(P.torso, .52, .04, .36, 0x9A7A2A, 0, .2 + i * .1, 0);
      if (P.handL) { const sh = box(P.handL, .08, .5, .36, 0xB0201A, -.08, 0, .05); box(sh, .09, .1, .1, 0xC8A24A, 0, 0, 0); } swapWeapon(P, hd => blade(hd, .6, 0xDCE0E8)); } },
  plague: { cape: 0x1A1A1E, title: 'ЧУМНОЙ ДОКТОР', c: '#5a5a66', noHelm: true, pal: { metal: 0x1A1A1E, metalD: 0x111114, trim: 0x6A4424, pants: 0x1A1A1E, boots: 0x111111, hair: 0x111111 },
    extra(P, S) { const h = P.head; box(h, .4, .38, .38, 0x1A1A1E, 0, .2, 0); box(h, .6, .04, .58, 0x1A1A1E, 0, .38, 0); box(h, .36, .14, .34, 0x1A1A1E, 0, .46, 0);
      const bk = new THREE.Mesh(new THREE.ConeGeometry(.08, .36, 6), M(0xE6DCC0)); bk.rotation.x = Math.PI / 2; bk.position.set(0, .12, .36); h.add(bk); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .02, 10), glowM(0xC8E0E8)); e.rotation.x = Math.PI / 2; e.position.set(s * .09, .24, .2); h.add(e); }
      swapWeapon(P, hd => { const w = new THREE.Group(); w.rotation.x = -.5; hd.add(w); cyl(w, .025, .025, 1.1, 0x6A4424, 0, 0, .3).rotation.x = Math.PI / 2; return w; }); } },
  farmer: { cape: 0x6A8A3A, title: 'ФЕРМЕР', c: '#c8a24a', noHelm: true, pal: { metal: 0x3A5AA0, metalD: 0x2A4A80, trim: 0xC8302A, pants: 0x3A5AA0, boots: 0x5A3A1A, hair: 0x8A5A2A },
    extra(P, S) { const h = P.head; box(h, .64, .04, .6, 0xE8C86A, 0, .34, 0); box(h, .38, .16, .36, 0xE8C86A, 0, .44, 0); box(h, .39, .04, .37, 0xC8302A, 0, .38, 0);
      for (const s of [-1, 1]) box(P.torso, .06, .6, .02, 0x2A4A80, s * .14, .4, .17); if (P.cape) P.cape.visible = false;
      swapWeapon(P, hd => { const w = new THREE.Group(); w.rotation.x = -.9; hd.add(w); box(w, .05, .05, 1.1, 0x8A6A3A, 0, 0, .4); for (let i = -1; i <= 1; i++) box(w, .03, .03, .22, 0x9A9AA2, i * .07, 0, 1.02); box(w, .2, .04, .04, 0x9A9AA2, 0, 0, .92); return w; }); } },
  mageking: { cape: 0x3A2A8A, title: 'КОРОЛЬ МАГОВ', c: '#7a6aff', noHelm: true, pal: { metal: 0x3A2A8A, metalD: 0x2A1A6A, trim: 0xE8B931, pants: 0x2A1A6A, boots: 0x1A1430, hair: 0xE8E8F0 },
    extra(P, S) { const h = P.head; box(h, .36, .1, .36, 0xE8B931, 0, .38, 0); for (const [x, z] of [[-.13, 0], [.13, 0], [0, .13], [0, -.13]]) box(h, .06, .14, .06, 0xE8B931, x, .48, z);
      box(h, .32, .26, .08, 0xE8E8F0, 0, -.04, .17); box(h, .2, .14, .06, 0xE8E8F0, 0, -.22, .17);
      swapWeapon(P, hd => { const w = new THREE.Group(); w.rotation.x = -.6; hd.add(w); cyl(w, .03, .03, 1.3, 0x6A4424, 0, 0, .35).rotation.x = Math.PI / 2; const o = new THREE.Mesh(new THREE.OctahedronGeometry(.1), glowM(0x9A8AFF)); o.position.z = 1.04; w.add(o); return w; });
      const l = new THREE.PointLight(0x8A7AFF, 2, 3); l.position.y = .5; P.torso.add(l); } },
};
function buildCapy(o) { // капибара на 4 лапах, без доспехов: платок знамени и мандарин
  const fur = 0x9A6A40, furD = 0x7A5030, furL = 0xB07E50, fc = o.fc;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const P = { g, body, capy: true, legs: [] };
  body.position.y = .5; box(body, .64, .58, 1.04, fur, 0, 0, 0); box(body, .56, .1, .9, furL, 0, -.3, 0); box(body, .5, .14, .2, furD, 0, .2, -.48);
  for (const [x, z] of [[-.2, .32], [.2, .32], [-.2, -.32], [.2, -.32]]) { const l = new THREE.Group(); l.position.set(x, .26, z); g.add(l); box(l, .18, .26, .2, furD, 0, -.13, 0); box(l, .2, .06, .23, 0x4A3020, 0, -.23, .02); P.legs.push(l); }
  const head = new THREE.Group(); head.position.set(0, .3, .5); body.add(head); P.head = head;
  box(head, .46, .42, .5, fur, 0, .02, .16); box(head, .42, .32, .16, furD, 0, -.04, .46); box(head, .24, .06, .02, 0x2a1a10, 0, .06, .545);
  for (const sx of [-1, 1]) { box(head, .02, .06, .08, 0x111111, sx * .231, .12, .26); box(head, .1, .1, .07, furD, sx * .16, .25, .0); }
  box(head, .02, .05, .02, 0x2a1a10, -.06, -.08, .545); box(head, .02, .05, .02, 0x2a1a10, .06, -.08, .545);
  const or = box(head, .2, .17, .2, 0xFF8A1A, 0, .31, .12); box(or, .04, .05, .04, 0x5A3A1A, 0, .1, 0); box(or, .12, .02, .06, 0x3FA03A, .06, .11, 0).rotation.z = -.3;
  box(body, .66, .16, .14, fc, 0, .18, .44); const tip = box(body, .2, .3, .04, fc, -.12, .02, .52); tip.rotation.z = .3; P.scarf = tip;
  return P;
}
function buildHero(o) {
  if (o.skin === 'capybara') return buildCapy(o);
  const role = o.role;
  const S = { ...(o.gold ? SKINS.gold : SKINS.base), ...(o.pal || {}) }, fc = o.fc, fcd = shade(fc, .7), trimHex = '#' + S.trim.toString(16).padStart(6, '0');
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const P = { g, body };
  for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * .13, .8, 0); body.add(leg);
    box(leg, .2, .5, .22, S.pants, 0, -.25, 0);
    box(leg, .22, .32, .26, role === 'mage' || role === 'archer' ? S.boots : S.metalD, 0, -.62, .02);
    box(leg, .23, .08, .3, S.boots, 0, -.76, .04);
    if (role === 'warrior' || role === 'guard') box(leg, .22, .16, .05, S.metal, 0, -.42, .12);
    P[s < 0 ? 'legL' : 'legR'] = leg; }
  const torso = new THREE.Group(); torso.position.y = .8; body.add(torso); P.torso = torso;
  if (role === 'mage') { box(torso, .5, .62, .3, fc, 0, .31, 0); box(torso, .56, .5, .36, fcd, 0, -.12, 0); box(torso, .52, .07, .32, S.trim, 0, .14, 0); }
  else if (role === 'archer') { box(torso, .5, .6, .3, o.pal ? S.metal : 0x4A6A3A, 0, .3, 0); box(torso, .52, .08, .32, 0x6A4424, 0, .1, 0); box(torso, .2, .6, .02, fc, 0, .3, .16); }
  else { box(torso, .52, .6, .3, S.metal, 0, .3, 0); box(torso, .36, .5, .02, fc, 0, .26, .16); box(torso, .54, .08, .32, 0x6A4424, 0, .06, 0); box(torso, .08, .08, .04, S.trim, 0, .06, .17); box(torso, .3, .18, .02, fc, 0, -.07, .16); }
  const cape = new THREE.Group(); cape.position.set(0, .58, -.17); torso.add(cape); P.cape = cape;
  const cm = new THREE.MeshToonMaterial({ map: capeTex(fc, o.emb, trimHex), gradientMap: grad, side: THREE.DoubleSide });
  const ch = role === 'mage' ? 1.12 : .95; box(cape, .54, ch, .035, cm, 0, -ch / 2, 0);
  const head = new THREE.Group(); head.position.y = .62; torso.add(head); P.head = head;
  if (o.capyHead) { // (старый вариант) голова капибары: длинная морда, маленькие ушки, мандарин на макушке
    const fur = 0x9A6A40, furD = 0x7A5030;
    box(head, .4, .34, .46, fur, 0, .2, .04); box(head, .36, .26, .14, furD, 0, .14, .32); box(head, .22, .06, .02, 0x2a1a10, 0, .22, .395);
    box(head, .02, .05, .02, 0x2a1a10, -.05, .12, .395); box(head, .02, .05, .02, 0x2a1a10, .05, .12, .395);
    for (const sx of [-1, 1]) { box(head, .02, .06, .07, 0x111111, sx * .201, .28, .16); box(head, .09, .09, .06, furD, sx * .14, .4, -.12); }
    box(head, .42, .12, .3, furD, 0, .3, -.06).visible = false;
    const or = box(head, .17, .14, .17, 0xFF8A1A, 0, .44, -.02); box(or, .04, .05, .04, 0x5A3A1A, 0, .09, 0); box(or, .1, .02, .05, 0x3FA03A, .05, .1, 0).rotation.z = -.3;
  } else {
  box(head, .34, .34, .32, S.skin, 0, .19, 0);
  box(head, .06, .05, .02, 0x2a2a30, -.08, .21, .165); box(head, .06, .05, .02, 0x2a2a30, .08, .21, .165);
  if (o.noHelm) { box(head, .36, .1, .34, S.hair, 0, .38, -.01); }
  else if (role === 'warrior') { box(head, .38, .2, .36, S.metal, 0, .33, 0); box(head, .4, .05, .38, S.trim, 0, .24, 0); box(head, .08, .22, .3, fc, 0, .52, -.04); box(head, .3, .12, .06, S.hair, 0, .07, .16); box(head, .38, .3, .06, S.metal, 0, .18, -.18); }
  else if (role === 'guard') { box(head, .4, .42, .38, S.metal, 0, .2, 0); box(head, .3, .04, .02, 0x15151a, 0, .2, .2); box(head, .04, .14, .02, 0x15151a, 0, .12, .2); box(head, .42, .05, .4, S.trim, 0, .4, 0); box(head, .05, .2, .32, fc, 0, .5, -.02); }
  else if (role === 'mage') { box(head, .3, .12, .06, 0xE8E8EE, 0, .02, .17); box(head, .14, .18, .06, 0xE8E8EE, 0, -.08, .17);
    box(head, .56, .05, .56, fcd, 0, .38, 0); box(head, .36, .22, .36, fc, 0, .51, 0); box(head, .37, .05, .37, S.trim, 0, .44, 0); box(head, .24, .2, .24, fc, -.02, .7, -.03).rotation.z = .2; box(head, .12, .16, .12, fc, -.06, .86, -.07).rotation.z = .45; }
  else { box(head, .4, .4, .4, (o.pal ? S.metalD : 0x3E5A30), 0, .24, -.02); box(head, .3, .06, .02, (o.pal ? S.metalD : 0x3E5A30), 0, .38, .19); box(head, .3, .3, .2, (o.pal ? S.metalD : 0x3E5A30), 0, .02, -.24).rotation.x = -.5; box(head, .26, .08, .04, S.hair, 0, .07, .16); } }
  for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(s * .35, .55, 0); torso.add(arm);
    const sleeve = role === 'mage' ? fc : role === 'archer' ? (o.pal ? S.metal : 0x4A6A3A) : S.metal;
    box(arm, .17, .36, .18, sleeve, 0, -.16, 0); box(arm, .16, .26, .17, role === 'mage' || role === 'archer' ? sleeve : S.metalD, 0, -.42, 0); box(arm, .15, .1, .16, S.skin, 0, -.59, 0);
    if (role === 'warrior' || role === 'guard') { box(arm, .24, .14, .24, S.metal, 0, .02, 0); box(arm, .25, .04, .25, S.trim, 0, -.05, 0); }
    if (role === 'mage') box(arm, .2, .06, .2, S.trim, 0, -.53, 0);
    const hand = new THREE.Group(); hand.position.y = -.6; arm.add(hand);
    P[s < 0 ? 'armL' : 'armR'] = arm; P[s < 0 ? 'handL' : 'handR'] = hand; }
  if (role === 'warrior') { const w = new THREE.Group(); w.rotation.x = -.9; P.handR.add(w); P.wR = w; box(w, .05, .05, .2, 0x6A4424, 0, 0, 0); box(w, .26, .05, .06, S.trim, 0, 0, .12); box(w, .09, .03, .8, 0xE6EAF0, 0, 0, .55); box(w, .06, .035, .12, 0xE6EAF0, 0, 0, 1.0); box(w, .06, .06, .06, S.trim, 0, 0, -.12);
    const sh = new THREE.Group(); sh.position.set(-.1, .12, .08); P.handL.add(sh); cyl(sh, .26, .26, .06, fc, 0, 0, 0, 12).rotation.z = Math.PI / 2; cyl(sh, .28, .28, .04, S.trim, .01, 0, 0, 12).rotation.z = Math.PI / 2; cyl(sh, .07, .07, .08, S.metal, -.03, 0, 0, 8).rotation.z = Math.PI / 2; }
  if (role === 'guard') { const w = new THREE.Group(); w.rotation.x = -.9; P.handR.add(w); P.wR = w; box(w, .06, .06, .7, 0x6A4424, 0, 0, .2); box(w, .2, .2, .2, S.metalD, 0, 0, .6); for (let a = 0; a < 4; a++) box(w, .06, .06, .12, S.metal, Math.cos(a * Math.PI / 2) * .13, Math.sin(a * Math.PI / 2) * .13, .6);
    const sh = new THREE.Group(); sh.position.set(-.12, .15, .1); P.handL.add(sh); box(sh, .06, .8, .5, fc, 0, 0, 0); box(sh, .07, .84, .06, S.trim, 0, 0, .25); box(sh, .07, .84, .06, S.trim, 0, 0, -.25); box(sh, .07, .06, .5, S.trim, 0, .4, 0); box(sh, .07, .06, .5, S.trim, 0, -.4, 0); box(sh, .08, .2, .2, S.trim, 0, .05, 0); }
  if (role === 'mage') { const w = new THREE.Group(); P.handR.add(w); P.wR = w; w.rotation.x = Math.PI / 2 - .9; box(w, .06, 1.5, .06, 0x6A4424, 0, .2, 0); box(w, .14, .06, .14, S.trim, 0, .92, 0);
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.13), new THREE.MeshBasicMaterial({ color: 0xFFB040 })); cr.position.y = 1.06; w.add(cr); P.crystal = cr;
    const gl = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xFF8A20, transparent: true, opacity: .3, depthWrite: false })); gl.position.y = 1.06; w.add(gl); P.glow = gl;
    const pl = new THREE.PointLight(0xff9a30, 2.5, 3); pl.position.y = 1.06; w.add(pl); }
  if (role === 'archer') { const bow = new THREE.Group(); P.handL.add(bow); bow.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { box(bow, .05, .45, .05, 0x7A4A24, 0, s * .24, .06).rotation.x = s * .35; box(bow, .06, .06, .06, S.trim, 0, s * .45, .14); }
    box(bow, .05, .14, .06, 0x3a2414, 0, 0, 0); P.string = box(bow, .012, .92, .012, 0xEEEEEE, 0, 0, .19);
    const quiver = box(P.torso, .14, .5, .14, 0x6A4424, .14, .42, -.22); quiver.rotation.z = -.35; for (let i = 0; i < 3; i++) box(quiver, .03, .12, .03, 0xE8E8E8, -.03 + i * .03, .3, 0); }
  if (o.def && o.def.extra) o.def.extra(P, S, o);
  return P;
}

// ---------- чучело из блоков (вместо нарисованного) ----------
function targetTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (const [col, r] of [['#f4eee0', 64], ['#d8302a', 52], ['#f4eee0', 38], ['#d8302a', 24], ['#f4eee0', 10]]) { g.fillStyle = col; g.beginPath(); g.arc(64, 64, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function buildDummy() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.userData.body = body;
  const straw = 0xE6B85A, strawD = 0xC8923C, rope = 0x7A4A28, wood = 0x7A4A28;
  box(body, .1, .46, .1, wood, 0, .23, 0);
  box(body, .4, .14, .34, strawD, 0, .48, 0); for (let i = 0; i < 5; i++) box(body, .06, .1, .36, straw, -.16 + i * .08, .42, 0);
  box(body, .4, .36, .32, straw, 0, .7, 0); box(body, .42, .05, .34, rope, 0, .55, 0);
  box(body, .86, .13, .13, straw, 0, .76, 0); for (const sx of [-1, 1]) { box(body, .05, .17, .17, rope, sx * .33, .76, 0); box(body, .1, .15, .15, strawD, sx * .45, .76, 0); }
  box(body, .2, .06, .2, rope, 0, .9, 0); box(body, .26, .22, .24, straw, 0, 1.0, 0); for (let i = 0; i < 4; i++) box(body, .05, .08, .2, strawD, -.09 + i * .06, 1.14, 0);
  const tg = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .04, 24), [M(0xd8302a), new THREE.MeshToonMaterial({ map: targetTex(), gradientMap: grad }), M(0xd8302a)]);
  tg.rotation.x = Math.PI / 2; tg.position.set(-.04, .7, .18); tg.castShadow = true; body.add(tg); root.userData.target = tg;
  return root;
}
function frameRay(x, y) {
  const width = el.clientWidth, height = el.clientHeight;
  const frameWidth = Math.min(width, height * .72);
  ray.setFromCamera(new THREE.Vector2((x * 2 - 1) * frameWidth / width, 1 - y * 2), cam);
  return ray.ray;
}
function onGround(p) { const o = new THREE.Vector3(); frameRay(...p).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), o); return o; }

// ---------- бойцы (герой и враг) ----------
function makeActor(o) {
  const P = buildHero(o), A = { P, o, role: o.role, atk: null, hurt: 0, dead: 0, scaleK: o.boss ? 1.25 : 1 };
  scene.add(P.g); return A;
}
function actorScale(A) { const k = DH * HERO_K / HERO_H * A.scaleK; A.P.g.scale.set(k * HERO_THIN, k, k * HERO_THIN); return k; }
const chestOf = A => A.P.g.position.clone().add(new THREE.Vector3(0, (A.P.capy ? .7 : 1.3) * A.P.g.scale.y, 0));
function place() {
  if (!el || !el.clientWidth) return;
  HERO_P.copy(onGround(CAMP_FRAME.hero)); BASE.copy(onGround(CAMP_FRAME.dummyBase));
  const n = new THREE.Vector3().subVectors(cam.position, BASE).setY(0).normalize();
  const top = new THREE.Vector3(); frameRay(...CAMP_FRAME.dummyTop).intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, BASE), top); DH = Math.max(.5, top.y - BASE.y);
  if (!dummy) { dummy = buildDummy(); scene.add(dummy); }
  dummy.position.copy(BASE); { const k = DH / 1.18; dummy.scale.set(k * .72, k * .88, k * .72); }
  const toHero = Math.atan2(HERO_P.x - BASE.x, HERO_P.z - BASE.z), toCam = Math.atan2(cam.position.x - BASE.x, cam.position.z - BASE.z);
  dummy.rotation.y = toCam + (toHero - toCam) * .55; dummy.updateMatrixWorld(true); dummy.userData.target.getWorldPosition(TARGET_P);
  if (hero) { const g = hero.P.g; g.position.copy(HERO_P); const yd = Math.atan2(BASE.x - HERO_P.x, BASE.z - HERO_P.z);
    g.rotation.y = hero.P.capy ? Math.PI + (yd - Math.PI) * .85 : Math.PI + (yd - Math.PI) * (hero.role === 'archer' ? .75 : .5);
    if (faceCam) g.rotation.y = Math.atan2(cam.position.x - HERO_P.x, cam.position.z - HERO_P.z) - .35; actorScale(hero); }
  if (enemy) { const g = enemy.P.g; g.position.copy(BASE); g.rotation.y = toHero * .75 + toCam * .25; actorScale(enemy); }
  if (auraG) auraG.position.copy(HERO_P);
}
function makeHero() {
  if (hero) scene.remove(hero.P.g); if (auraG) scene.remove(auraG);
  const o = heroOpt; const D = CHAR[o.skin]; hero = makeActor({ role: o.role, fc: D ? D.cape : FC[o.fac], emb: EMB[o.fac], gold: o.gold, skin: o.skin, pal: D ? D.pal : (o.skin && o.skin !== 'capybara' && SKINS[o.skin] ? SKINS[o.skin] : undefined), def: D, noHelm: D && D.noHelm });
  if (D && D.scale) hero.scaleK = D.scale;
  hero.onStrike = k => strikeTarget(k); hero.shotTo = () => enemy && !enemy.dead ? chestOf(enemy) : TARGET_P.clone();
  auraG = new THREE.Group(); const ring = new THREE.Mesh(new THREE.RingGeometry(.48, .62, 40), new THREE.MeshBasicMaterial({ color: o.gold ? 0xFFD75A : FC[o.fac], transparent: true, opacity: .9 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; auraG.add(ring);
  if (o.gold) { const glow = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 2.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xFFD75A, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false })); glow.position.y = 1.2; auraG.add(glow); }
  scene.add(auraG); place();
}
// удар героя: в бою — по врагу, иначе — по чучелу
function strikeTarget(k = 1) {
  if (enemy && !enemy.dead) { enemy.hurt = 1; burst(chestOf(enemy), [0xFFFFFF, 0xFFD27A], 8); }
  else { wob.vx -= 7 * k; wob.vz += (Math.random() - .5) * 4 * k; burst(TARGET_P, [0xF2D06A, 0xD9AA4A], hero.role === 'mage' ? 14 : 10); }
  el.dispatchEvent(new CustomEvent('zn-hit', { detail: k, bubbles: true }));
}
function strikeHero() { if (!hero) return; hero.hurt = 1; burst(chestOf(hero), [0xFF4040, 0xFFFFFF], 6, false); el.dispatchEvent(new CustomEvent('zn-hurt', { bubbles: true })); }

const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
function animCapy(A, t, dt) {
  const P = A.P, role = A.role, br = Math.sin(t * 2.2 + (A === enemy ? 1 : 0)); let lunge = 0, dip = 0;
  if (A.atk) { const at = A.atk; if (!at.freeze) at.t += dt; const p = at.t / at.dur;
    if (role === 'warrior' || role === 'guard') { const back = ease(p / .35), go = ease((p - .35) / .2), ret = ease((p - .65) / .35); lunge = -.15 * back + .55 * go - .4 * ret; dip = .25 * go - .25 * ret;
      if (!at.hit && p > .52) { at.hit = true; A.onStrike(role === 'warrior' ? 1.2 : 1); } }
    else { const up = ease(p / .4), dn = ease((p - .4) / .2), ret = ease((p - .7) / .3); dip = -.3 * up + .5 * dn - .2 * ret; lunge = .08 * dn - .08 * ret;
      if (!at.shot && p > .5) { at.shot = true; projectile(A); } }
    if (p >= 1) A.atk = null; }
  P.body.position.z = lunge - .2 * A.hurt; P.body.position.y = .5 + br * .015; P.body.scale.y = 1 + br * .02;
  P.head.rotation.x = dip + Math.sin(t * 1.3) * .04 - .3 * A.hurt; P.legs.forEach((l, i) => { l.position.z = [.32, .32, -.32, -.32][i] + lunge * (i < 2 ? 1 : .6); });
  P.scarf.rotation.x = -.2 + Math.sin(t * 3) * .1;
  P.body.rotation.z = (Math.PI / 2) * ease(A.dead);
}
function animActor(A, t, dt) {
  A.hurt = Math.max(0, A.hurt - dt * 4); if (A.dead) A.dead = Math.min(1, A.dead + dt * 2.2);
  if (A.P.capy) return animCapy(A, t, dt);
  const P = A.P, role = A.role, br = Math.sin(t * 2.2 + (A === enemy ? 1.5 : 0));
  let armRx = -.25, armRz = -.08, armLx = -.35, armLz = .1, torY = 0, lean = 0, crouch = 0;
  if (role === 'mage') { armRx = -.55; armLx = -.2; }
  if (role === 'archer') { armLx = -1.45; armLz = 0; armRx = -1.2; armRz = -.4; }
  if (role === 'guard') { armLx = -.9; armLz = .35; }
  if (A.atk && !A.dead) { const at = A.atk; if (!at.freeze) at.t += dt; const p = at.t / at.dur;
    if (role === 'warrior' || role === 'guard') {
      const up = ease(p / .4), down = ease((p - .4) / .2), back = ease((p - .72) / .28);
      armRx = -.25 - 2.65 * up + 1.9 * down + .75 * back;
      torY = .35 * up - .7 * down + .35 * back; lean = .12 * down - .12 * back; crouch = .06 * down - .06 * back;
      if (role === 'guard') armLx = -.9 - .5 * down + .5 * back;
      if (!at.hit && p > .52) { at.hit = true; A.onStrike(role === 'warrior' ? 1.2 : 1); }
    } else if (role === 'mage') {
      const up = ease(p / .45), fw = ease((p - .45) / .15), back = ease((p - .7) / .3);
      armRx = -.55 - 2.3 * up + 1.1 * fw + 1.2 * back; armLx = -.2 - 1.0 * up + 1.0 * back; lean = .1 * fw - .1 * back; torY = -.25 * up + .25 * back;
      if (P.glow) P.glow.scale.setScalar(1 + 1.5 * up * (1 - fw));
      if (!at.shot && p > .55) { at.shot = true; projectile(A); }
    } else {
      const pull = ease(p / .45), rel = p > .5 ? 1 : 0;
      armRz = -.4 - .9 * pull * (1 - rel); if (P.string) P.string.position.z = .19 - .3 * pull * (1 - rel);
      lean = -.05 * pull * (1 - rel);
      if (!at.shot && p > .5) { at.shot = true; projectile(A); }
    }
    if (p >= 1) A.atk = null;
  }
  lean -= .35 * A.hurt;
  P.armR.rotation.set(armRx + br * .03, 0, armRz); P.armL.rotation.set(armLx - br * .03, 0, armLz);
  P.torso.rotation.set(lean, torY, 0); P.torso.position.y = .8 + br * .012 - crouch; P.head.rotation.x = -lean * .6;
  P.cape.rotation.x = .12 + Math.sin(t * 1.7) * .05 + Math.abs(torY) * .25 + Math.max(0, lean) * .5;
  P.legL.rotation.x = .08; P.legR.rotation.x = -.08; P.legL.position.y = P.legR.position.y = .8 - crouch;
  if (P.crystal) P.crystal.rotation.y = t * 2;
  P.body.rotation.x = -(Math.PI / 2) * ease(A.dead); P.body.position.y = .12 * ease(A.dead);
}

function burst(pos, cols, n = 10, flash = true) {
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.07, .025, .2), M(cols[i % cols.length]));
    m.position.copy(pos).add(new THREE.Vector3((Math.random() - .5) * .3, (Math.random() - .5) * .4, .1)); scene.add(m);
    fx.push({ m, v: new THREE.Vector3((Math.random() - .5) * 3.5, Math.random() * 3 + 1.2, Math.random() * 2), r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), life: .8 }); }
  if (!flash) return;
  const fl = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshBasicMaterial({ color: cols[0], transparent: true, opacity: .55 }));
  fl.position.copy(pos); scene.add(fl); fx.push({ m: fl, flash: true, life: .18 });
}
function projectile(A) {
  const to = A.shotTo(), start = A.P.g.position, dir = to.clone().sub(start).setY(0).normalize(), from = start.clone().addScaledVector(dir, .55).add(new THREE.Vector3(0, 1.35 * A.P.g.scale.y, 0));
  const fire = A.role === 'mage', m = fire ? new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 8), new THREE.MeshBasicMaterial({ color: A === enemy ? 0xB8FF7A : 0xFFD27A })) : new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .7), M(0xE8E8E8));
  if (fire) { m.add(new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 8), new THREE.MeshBasicMaterial({ color: A === enemy ? 0x4ACB2A : 0xFF7A20, transparent: true, opacity: .45 }))); m.add(new THREE.PointLight(A === enemy ? 0x7aff40 : 0xffa040, 5, 3)); }
  m.position.copy(from); m.lookAt(to); scene.add(m);
  fx.push({ m, from, to, t: 0, dur: fire ? .26 : .15, proj: true, done: () => A.onStrike(fire ? 1.3 : 1) });
}
function startAttack(A) {
  if (!ready || !A || A.dead) return;
  if (A.atk && A.atk.t / A.atk.dur < .55) { A.atk.dur = Math.max(.22, A.atk.dur * .85); return; }
  A.atk = { t: 0, dur: A.atk ? .3 : .42, hit: false, shot: false };
}

// ---------- API для страницы ----------
export function attack() { startAttack(hero); }
export function debugFace(v = true) { faceCam = v; place(); }
export function setSkin(n) { n = n || ''; if (n !== heroOpt.skin) { heroOpt.skin = n; if (ready) makeHero(); } }
export function setHero(f, r, g) {
  const o = { ...heroOpt, fac: f || 'lions', role: r || 'warrior', gold: !!g }, ch = o.fac !== heroOpt.fac || o.role !== heroOpt.role || o.gold !== heroOpt.gold; heroOpt = o;
  if (ready && (ch || !hero)) makeHero();
}
export function debugPose(p) { if (hero) hero.atk = { t: p * .42, dur: .42, hit: true, shot: true, freeze: true }; }
// бой: враг встаёт на место чучела. e = { role, pal: {cloth, metal, skin, ...}, boss }
export function battleStart(e) {
  battleEnd(); if (!ready) return;
  const pal = e.pal || {}; enemy = makeActor({ role: e.role || 'warrior', fc: pal.cloth ?? 0x5A2A2A, emb: '', gold: false, skin: e.skin || '', pal, boss: e.boss });
  enemy.scaleK = e.boss ? 1.25 : 1; enemy.onStrike = () => strikeHero(); enemy.shotTo = () => chestOf(hero);
  if (dummy) dummy.visible = false; if (hero) { hero.dead = 0; hero.hurt = 0; } place();
}
export function enemyAttack() { startAttack(enemy); }
export function enemyDie() { if (enemy && !enemy.dead) enemy.dead = .001; }
export function heroDie() { if (hero && !hero.dead) hero.dead = .001; }
export function battleEnd() {
  if (enemy) { scene.remove(enemy.P.g); enemy = null; } if (dummy) dummy.visible = true;
  if (hero) { hero.dead = 0; hero.hurt = 0; hero.P.body.rotation.set(0, 0, 0); hero.P.body.position.y = 0; }
}

export async function init(container) {
  el = container;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.setClearColor(0x000000, 0);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
  el.innerHTML = ''; el.appendChild(R.domElement); R.domElement.style.cssText = 'width:100%;height:100%;display:block';
  scene = new THREE.Scene(); grad = toonGrad(); clock = new THREE.Clock();
  cam = new THREE.PerspectiveCamera(34, 1, .1, 200); cam.position.set(0, 4.5, 12); cam.lookAt(0, 1.45, 0); cam.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4e8, 1.8));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.0); key.position.set(-3, 6, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb070, 1.8); rim.position.set(-5, 3, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xa8c8ff, .9); fill.position.set(5, 2, -2); scene.add(fill);
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .32 })); sp.rotation.x = -Math.PI / 2; sp.receiveShadow = true; scene.add(sp);
  const fit = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); place(); };
  new ResizeObserver(fit).observe(el); fit();
  ready = true; makeHero();
  R.setAnimationLoop(() => {
    const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
    if (hero) animActor(hero, t, dt); if (enemy) animActor(enemy, t, dt);
    if (dummy) { wob.vx += (-wob.x * 70 - wob.vx * 7) * dt; wob.x += wob.vx * dt; wob.vz += (-wob.z * 70 - wob.vz * 7) * dt; wob.z += wob.vz * dt;
      const b = dummy.userData.body; b.rotation.x = wob.x * .15; b.rotation.z = wob.z * .15; }
    if (auraG) auraG.rotation.y += dt * 1.5;
    fx = fx.filter(f => {
      if (f.proj) { f.t += dt / f.dur; f.m.position.lerpVectors(f.from, f.to, Math.min(1, f.t)); if (f.t >= 1) { scene.remove(f.m); f.done(); return false; } return true; }
      f.life -= dt; if (f.flash) { f.m.scale.setScalar(1 + (0.18 - f.life) * 9); f.m.material.opacity = Math.max(0, f.life / .18); if (f.life <= 0) { scene.remove(f.m); return false; } return true; }
      f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.r.x * dt; f.m.rotation.y += f.r.y * dt;
      if (f.m.position.y < .02) { f.m.position.y = .02; f.v.set(0, 0, 0); } if (f.life <= 0) { scene.remove(f.m); return false; } return true; });
    R.render(scene, cam);
  });
  return true;
}
// экранная точка над головой героя (для таблички с титулом скина)
const _hv = new THREE.Vector3();
export function heroHeadScreen() { if (!ready || !hero || !cam || !el) return null; hero.P.head.getWorldPosition(_hv); _hv.y += .75 * (hero.P.g.scale.y || 1); _hv.project(cam);
  const r = el.getBoundingClientRect(); return [r.left + (_hv.x + 1) / 2 * r.width, r.top + (1 - _hv.y) / 2 * r.height]; }
export function skinTitle(k) { const D = CHAR[k]; return D ? { title: D.title, c: D.c } : null; }
