// «Четыре знамени» — бойцы из блоков для сайта (битва и лагерь): геометрия на роль, две «пачки» — без цвета и в цвет знамени.
import * as THREE from '../three.module.js';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
function bx(arr, w, h, d, x, y, z, col, rx = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rx || rz) g.rotateX(rx).rotateZ(rz); g.translate(x, y, z); const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); arr.push(g); }
const SKIN = 0xf0c49a, METAL = 0xb8c0cc, METD = 0x6e7682, PANTS = 0x3a3048, BOOT = 0x4a3020, WOOD = 0x6a4424, WHITE = 0xffffff, TINT2 = 0xb0b0b0;
export function soldierGeo(role) {
  const n = [], t = [];
  for (const s of [-1, 1]) { bx(n, .14, .4, .16, s * .09, .26, 0, PANTS); bx(n, .16, .12, .2, s * .09, .06, .02, BOOT); }
  bx(t, .4, .42, .24, 0, .66, 0, WHITE); bx(n, .42, .06, .26, 0, .48, 0, WOOD); bx(n, .28, .28, .26, 0, 1.02, 0, SKIN); bx(n, .05, .04, .02, -.06, 1.04, .135, 0x222222); bx(n, .05, .04, .02, .06, 1.04, .135, 0x222222);
  bx(t, .36, .62, .03, 0, .6, -.15, TINT2); // плащ
  for (const s of [-1, 1]) bx(role === 'warrior' || role === 'guard' ? n : t, .12, .42, .14, s * .27, .66, .02, role === 'warrior' || role === 'guard' ? METAL : WHITE);
  if (role === 'warrior') { bx(n, .32, .14, .3, 0, 1.18, 0, METAL); bx(t, .05, .2, .24, 0, 1.33, -.02, WHITE); bx(n, .05, .62, .04, .3, .98, .14, 0xe6eaf0); bx(n, .18, .04, .06, .3, .7, .14, 0xe8b931); bx(t, .05, .36, .3, -.36, .64, .06, WHITE); }
  if (role === 'guard') { bx(n, .32, .34, .32, 0, 1.05, 0, METAL); bx(n, .24, .03, .02, 0, 1.06, .165, 0x15151a); bx(t, .06, .62, .42, -.36, .62, .08, WHITE); bx(n, .07, .64, .06, -.36, .62, .3, 0xe8b931); bx(n, .05, .5, .05, .3, .72, .16, WOOD); bx(n, .14, .14, .14, .3, .98, .16, METD); }
  if (role === 'mage') { bx(t, .44, .04, .44, 0, 1.17, 0, TINT2); bx(t, .26, .22, .26, 0, 1.3, 0, WHITE); bx(t, .14, .16, .14, -.03, 1.47, -.03, WHITE, 0, .3); bx(n, .05, 1.2, .05, .32, .72, .14, WOOD); bx(n, .15, .15, .15, .32, 1.36, .14, 0xffb040); bx(n, .2, .12, .04, 0, .93, .14, 0xe8e8ee); }
  if (role === 'archer') { bx(t, .32, .3, .32, 0, 1.07, -.02, TINT2); bx(t, .26, .2, .16, 0, .96, -.2, TINT2, -.4); bx(n, .04, .8, .04, -.33, .74, .2, WOOD); bx(n, .01, .76, .01, -.27, .74, .2, 0xeeeeee); bx(n, .12, .42, .12, .14, .78, -.2, WOOD, 0, -.35); }
  return [mergeGeometries(n), mergeGeometries(t)];
}

// Герой игрока для прогулки по лагерю: руки и ноги на шарнирах.
export function buildWalker(role, color, gold = false) {
  const M = c => new THREE.MeshLambertMaterial({ color: c }), metal = gold ? 0xf2c84a : METAL, metd = gold ? 0xb0841c : METD;
  const B = (p, w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  const g = new THREE.Group(), P = { g, legs: [], arms: [] };
  for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * .09, .46, 0); g.add(l); B(l, .14, .34, .16, PANTS, 0, -.2, 0); B(l, .16, .12, .2, BOOT, 0, -.4, .02); P.legs.push(l); }
  B(g, .4, .42, .24, color, 0, .66, 0); B(g, .42, .06, .26, WOOD, 0, .48, 0); B(g, .28, .28, .26, SKIN, 0, 1.02, 0); B(g, .36, .62, .03, color, 0, .6, -.15);
  B(g, .05, .04, .02, 0x222222, -.06, 1.04, .135); B(g, .05, .04, .02, 0x222222, .06, 1.04, .135);
  for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * .27, .86, .02); g.add(a); B(a, .12, .42, .14, role === 'warrior' || role === 'guard' ? metal : color, 0, -.2, 0); P.arms.push(a); }
  const hand = P.arms[1];
  if (role === 'warrior') { B(g, .32, .14, .3, metal, 0, 1.18, 0); B(g, .05, .2, .24, color, 0, 1.33, -.02); B(hand, .05, .62, .04, 0xe6eaf0, 0, -.2, .14).rotation.x = -.6; B(P.arms[0], .05, .36, .3, color, -.08, -.22, .06); }
  if (role === 'guard') { B(g, .32, .34, .32, metal, 0, 1.05, 0); B(g, .24, .03, .02, 0x15151a, 0, 1.06, .165); B(P.arms[0], .06, .62, .42, color, -.08, -.22, .08); B(hand, .14, .14, .14, metd, 0, -.5, .2); }
  if (role === 'mage') { B(g, .44, .04, .44, color, 0, 1.17, 0); B(g, .26, .22, .26, color, 0, 1.3, 0); B(g, .14, .16, .14, color, -.03, 1.47, -.03); B(hand, .05, 1.2, .05, WOOD, 0, -.1, .14); B(hand, .15, .15, .15, 0xffb040, 0, .52, .14); }
  if (role === 'archer') { B(g, .32, .3, .32, color, 0, 1.07, -.02); B(P.arms[0], .04, .8, .04, WOOD, 0, -.3, .16); }
  return P;
}
export function walkPose(P, phase, amt) { const s = Math.sin(phase) * .7 * amt; P.legs[0].rotation.x = s; P.legs[1].rotation.x = -s; P.arms[0].rotation.x = -s * .8; P.arms[1].rotation.x = s * .8; }
