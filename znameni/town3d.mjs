// «Четыре знамени» — 3D-лагерь знамени: круглый городок с цитаделью, районами, улицами и крепостной стеной.
// Здания собраны из простых блоков (фахверк, ставни, цветы, трубы) и рисуются «пачками» (InstancedMesh).
import * as THREE from '../three.module.js';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { soldierGeo } from './army3d.mjs';

const PARTS = ['body', 'wall', 'roof', 'glass'];
const BASE = { stone: '#b7aea0', dark: '#6e655c', timber: '#5a3a24', wood: '#8a5f3a', plank: '#b98c5a', thatch: '#c9a65a', leaf: '#5c8a3a', barn: '#8a3326', door: '#5a3620',
  shutter: ['#3f6a52', '#7a3a2c', '#3a5a7a', '#6a5a2c'], flowers: ['#e8566a', '#f2c94c', '#f2f0f6', '#9b7ae0'], glass: '#ffcf86', paving: '#a99f8c' };
export const BIOME = {
  lions: { ...BASE, name: 'Золотая степь', walls: ['#f3e6c8', '#ecd8b0', '#f6efdf', '#e6cc9c', '#f0dcc0'], roofs: ['#c9862a', '#b5452c', '#d6a23a', '#9a4a24', '#e0b84a'], leaf: '#7a9a34',
    paving: '#c9b48a', ground: '#a7ad5a', ground2: '#c2b46a', sky: '#bcdcff', fog: '#d6e4ef', hemi: ['#fff4dc', '#7a6a40'], sun: '#fff0d0', tree: 'round' },
  wolves: { ...BASE, name: 'Ледяной перевал', walls: ['#eef3f6', '#dde7ee', '#f6f6f2', '#d4dde4', '#e9edf0'], roofs: ['#e9f1f6', '#9fb6c8', '#d6e3ec', '#6f8aa0', '#c7d6e2'], stone: '#a9b7c2', dark: '#5d6b78',
    leaf: '#2f5a4a', barn: '#5a7488', glass: '#ffd9a0', paving: '#b4c4d0', ground: '#e8eef5', ground2: '#d0dbe6', sky: '#b4c8e2', fog: '#dce6f0', hemi: ['#eef4ff', '#8a96a8'], sun: '#f4f8ff', tree: 'snowpine' },
  dragons: { ...BASE, name: 'Огненные скалы', walls: ['#ecd3a2', '#e3bf86', '#f0dfba', '#d9a86c', '#e8cfa0'], roofs: ['#b13a22', '#93301f', '#c4522c', '#6e2a1e', '#3e2c28'], stone: '#7d6f63', dark: '#3d3330',
    leaf: '#5a6a30', glass: '#ffb070', paving: '#76706a', ground: '#77704c', ground2: '#5a5040', sky: '#efc49c', fog: '#e2b896', hemi: ['#ffe2c0', '#5a3a2a'], sun: '#ffd8a8', tree: 'pine', lava: true },
  ravens: { ...BASE, name: 'Сумрачный лес', walls: ['#cfc6d8', '#bdb2cc', '#d8d0e0', '#b0a6c2', '#c6bcd2'], roofs: ['#4a3a66', '#5e4680', '#3a2e52', '#6a4a8a', '#2e2640'], stone: '#7a7088', dark: '#3e3650',
    timber: '#3a2e44', leaf: '#6a3a8a', barn: '#4e3a6a', glass: '#e2b0ff', paving: '#6a5c80', ground: '#8a80a0', ground2: '#6e6488', sky: '#aa9cd2', fog: '#b4a8d4', hemi: ['#e8e0ff', '#40365a'], sun: '#efe2ff', tree: 'shadow' },
};

// ---------- набор деталей ----------
const _c = new THREE.Color();
class Kit {
  constructor(P) { this.P = P; this.parts = { body: [], wall: [], roof: [], glass: [] }; }
  add(part, g, x = 0, y = 0, z = 0, ry = 0, col) {
    if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (ry) g.rotateY(ry); g.translate(x, y, z);
    if (part === 'body') { _c.set(col || '#888888'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    this.parts[part].push(g);
  }
  box(part, w, h, d, x, y, z, col, ry = 0) { this.add(part, new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, ry, col); }
  cyl(part, r0, r1, h, x, y, z, col, seg = 10) { this.add(part, new THREE.CylinderGeometry(r0, r1, h, seg).translate(0, h / 2, 0), x, y, z, 0, col); }
  build() { const o = {}; for (const p of PARTS) if (this.parts[p].length) o[p] = mergeGeometries(this.parts[p]); return o; }
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), ICO = r => new THREE.IcosahedronGeometry(r, 0);
const F = (cx, cz, ry) => (u, o) => [cx + u * Math.cos(ry) + o * Math.sin(ry), cz - u * Math.sin(ry) + o * Math.cos(ry)];
function rot(k, fn, ry, x = 0, z = 0) { const t = new Kit(k.P); fn(t); for (const p of PARTS) for (const g of t.parts[p]) { g.rotateY(ry); g.translate(x, 0, z); k.parts[p].push(g); } }
function win(k, cx, y, cz, ry, w = .9, h = 1.1, box = true, ci = 0) {
  const P = k.P, f = F(cx, cz, ry); let [x, z] = f(0, .02);
  k.add('body', B(w + .2, h + .2, .08).translate(0, h / 2, 0), x, y - .1, z, ry, P.timber); [x, z] = f(0, .07); k.add('glass', B(w, h, .06).translate(0, h / 2, 0), x, y, z, ry);
  [x, z] = f(0, .11); k.add('body', B(.06, h, .04).translate(0, h / 2, 0), x, y, z, ry, P.timber); k.add('body', B(w, .06, .04), x, y + h * .6, z, ry, P.timber);
  [x, z] = f(0, .14); k.add('body', B(w + .3, .08, .22), x, y - .12, z, ry, P.plank);
  const sh = P.shutter[ci % P.shutter.length]; for (const s of [-1, 1]) { [x, z] = f(s * (w / 2 + .28), .06); k.add('body', B(.42, h + .05, .06).translate(0, h / 2, 0), x, y, z, ry, sh); }
  if (box) { [x, z] = f(0, .26); k.add('body', B(w + .1, .22, .24), x, y - .36, z, ry, P.wood); for (let i = 0; i < 4; i++) { [x, z] = f(-w / 2 + .15 + i * ((w - .3) / 3), .28); k.add('body', ICO(.12), x, y - .14, z, 0, P.flowers[(ci + i) % 4]); } }
}
function door(k, cx, cz, ry, awn = true, w = 1.1, h = 2.1) {
  const P = k.P, f = F(cx, cz, ry); let [x, z] = f(0, .02);
  k.add('body', B(w + .3, h + .18, .1).translate(0, (h + .18) / 2, 0), x, 0, z, ry, P.timber); [x, z] = f(0, .08); k.add('body', B(w, h, .08).translate(0, h / 2, 0), x, 0, z, ry, P.door);
  [x, z] = f(0, .45); k.add('body', B(w + .6, .16, .8), x, 0, z, ry, P.stone);
  if (awn) { [x, z] = f(0, .55); k.add('roof', B(w + .9, .1, 1.1).rotateX(.32), x, h + .42, z, ry); }
}
function frame(k, len, y0, h, cx, cz, ry, n, brace = true) {
  const P = k.P, f = F(cx, cz, ry);
  for (let i = 0; i <= n; i++) { const [x, z] = f(-len / 2 + i * len / n, 0); k.add('body', B(.18, h, .08).translate(0, h / 2, 0), x, y0, z, ry, P.timber); }
  const [x, z] = f(0, 0); for (const y of [y0, y0 + h - .1]) k.add('body', B(len + .1, .18, .08), x, y, z, ry, P.timber);
  if (!brace) return; const m = len / n, L = Math.hypot(m, h), a = Math.atan2(m, h);
  for (let i = 0; i < n; i += 2) { const [x, z] = f(-len / 2 + (i + .5) * m, 0); k.add('body', B(.14, L, .06).rotateZ(i % 4 === 0 ? a : -a).translate(0, h / 2, 0), x, y0, z, ry, P.timber); }
}
// двускатная крыша: конёк вдоль X
function gable(k, w, d, y, h, over = .45, cx = 0, cz = 0, gpart = 'wall', gcol) {
  const half = d / 2 + over, ang = Math.atan2(h, d / 2), L = half / Math.cos(ang), top = y + h;
  for (const s of [1, -1]) k.add('roof', B(w + over * 2, .22, L).rotateX(s * ang), cx, top - L / 2 * Math.sin(ang) + .1, cz + s * (L / 2) * Math.cos(ang));
  const sh = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]);
  for (const s of [1, -1]) k.add(gpart, new THREE.ExtrudeGeometry(sh, { depth: .12, bevelEnabled: false }).rotateY(Math.PI / 2), cx + s * (w / 2) - .06, y, cz, 0, gcol);
  k.add('body', B(w + over * 2 + .1, .22, .26), cx, top - .02, cz, 0, '#4a3424');
}
const hip = (k, w, d, y, h, over = .5, cx = 0, cz = 0, part = 'roof', col) => k.add(part, new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).scale(w + over * 2, h, d + over * 2).translate(0, h / 2, 0), cx, y, cz, 0, col);
const chim = (k, x, z, h) => { k.box('body', .7, h, .7, x, 0, z, k.P.dark); k.box('body', .9, .18, .9, x, h, z, '#3a302a'); };
function tree(k, x, z, s = 1) { k.cyl('body', .14 * s, .2 * s, 1.8 * s, x, 0, z, '#5a3e28', 6); k.add('body', ICO(1.25 * s), x, 2.5 * s, z, 0, k.P.leaf); k.add('body', ICO(.85 * s), x + .5 * s, 3.2 * s, z - .3 * s, 0, k.P.leaf); }
function yard(k, w, d, ci) {
  const P = k.P, bx = w / 2 - 1.5; k.box('body', 2.3, .08, .44, bx, .4, d / 2 + .5, P.plank); for (const s of [-.95, .95]) k.box('body', .12, .4, .36, bx + s, 0, d / 2 + .5, P.timber);
  const fx = -w / 2 + 1, fz = d / 2 + 1.3; k.box('body', 1.1, .18, .7, fx, 0, fz, '#5a4028'); for (let i = 0; i < 6; i++) k.add('body', ICO(.13), fx - .4 + i % 3 * .4, .28, fz - .15 + Math.floor(i / 3) * .3, 0, P.flowers[(ci + i) % 4]);
  for (const s of [-1, 1]) k.add('body', ICO(.55), s * (w / 2 - .3), .45, d / 2 + 2.3, 0, P.leaf);
}

// ---------- виды зданий (единицы — «метры» до масштаба S) ----------
export const KINDS = {
  cottage: { name: 'Домик', w: 7.4, d: 6.6, fn(k) { const P = k.P, w = 7.4, d = 6.6, o = 2.9; k.box('body', w + .3, .5, d + .3, 0, 0, 0, P.stone); k.box('wall', w, o, d, 0, .5, 0);
    frame(k, w, .5, o, 0, d / 2 + .01, 0, 6); frame(k, w, .5, o, 0, -d / 2 - .01, Math.PI, 6); frame(k, d, .5, o, w / 2 + .01, 0, Math.PI / 2, 4, false); frame(k, d, .5, o, -w / 2 - .01, 0, -Math.PI / 2, 4, false);
    gable(k, w, d, o + .5, 2.7); door(k, 0, d / 2, 0); win(k, -2.2, 1.4, d / 2, 0, .95, 1.1, true, 1); win(k, 2.2, 1.4, d / 2, 0, .95, 1.1, true, 1); win(k, w / 2, 1.4, 0, Math.PI / 2, .9, 1, false, 2); win(k, -w / 2, 1.4, 0, -Math.PI / 2, .9, 1, false, 2);
    k.box('wall', 1.5, 1.2, 1.4, 0, o + .9, d / 2 - 1.5); rot(k, t => gable(t, 1.4, 1.5, o + 2.1, .8, .15), Math.PI / 2, 0, d / 2 - 1.5); k.add('glass', B(.7, .7, .06), 0, o + 1.5, d / 2 - .78);
    chim(k, 2.3, -1.2, o + 3.9); yard(k, w, d, 3); } },
  townhouse: { name: 'Городской дом', w: 6.8, d: 8, fn(k) { const P = k.P, w = 6.8, d = 8; k.box('body', w, 3, d, 0, 0, 0, P.stone); k.box('wall', w + .5, 2.8, d + .5, 0, 3, 0);
    for (let i = 0; i < 6; i++) k.box('body', .18, .18, .7, -w / 2 + .6 + i * ((w - 1.2) / 5), 2.82, d / 2 + .1, P.timber);
    frame(k, w + .5, 3, 2.8, 0, d / 2 + .26, 0, 4); frame(k, w + .5, 3, 2.8, 0, -d / 2 - .26, Math.PI, 4); frame(k, d + .5, 3, 2.8, w / 2 + .26, 0, Math.PI / 2, 5, false); frame(k, d + .5, 3, 2.8, -w / 2 - .26, 0, -Math.PI / 2, 5, false);
    rot(k, t => gable(t, d + .5, w + .5, 5.8, 3.6, .5), Math.PI / 2);
    k.add('glass', new THREE.CylinderGeometry(.42, .42, .08, 12).rotateX(Math.PI / 2), 0, 7.2, d / 2 + .32); k.add('body', new THREE.TorusGeometry(.46, .07, 6, 14), 0, 7.2, d / 2 + .34, 0, P.timber);
    door(k, -1.8, d / 2, 0); win(k, 1.4, 1, d / 2, 0, 2.1, 1.3, false, 0); k.add('roof', B(2.8, .08, 1.1).rotateX(.35), 1.4, 2.6, d / 2 + .55);
    win(k, -1.6, 3.7, d / 2 + .25, 0, .9, 1.15, true, 2); win(k, 1.6, 3.7, d / 2 + .25, 0, .9, 1.15, true, 2); chim(k, -2.2, -2.4, 9.2); yard(k, w, d, 1); } },
  corner: { name: 'Дом с башенкой', w: 10.4, d: 8.4, fn(k) { const P = k.P, e = 8.4, s = 7, o = -1.7; k.box('body', s + .3, .5, e + .3, o, 0, 0, P.stone); k.box('wall', s, 5.2, e, o, .5, 0); k.box('body', s + .1, .2, e + .1, o, 3, 0, P.timber);
    frame(k, s, 3.1, 2.6, o, e / 2 + .01, 0, 5); gable(k, s, e, 5.7, 2.9, .45, o, 0); door(k, o - 1.2, e / 2, 0);
    win(k, o + 1.4, 1.4, e / 2, 0, 1, 1.1, true, 0); win(k, o - 1.4, 3.7, e / 2, 0, .9, 1.1, true, 1); win(k, o + 1.4, 3.7, e / 2, 0, .9, 1.1, true, 1); win(k, o - s / 2, 1.4, 0, -Math.PI / 2, .9, 1.1, false, 2);
    const n = 3.4, a = 1.6; k.cyl('body', 1.9, 2, .6, n, 0, a, P.stone, 14); k.cyl('wall', 1.75, 1.75, 7.4, n, .6, a, null, 14); k.cyl('body', 1.85, 1.85, .25, n, 4.6, a, P.timber, 14);
    k.add('roof', new THREE.ConeGeometry(2.15, 3.6, 14).translate(0, 1.8, 0), n, 8, a); k.cyl('body', .05, .05, 1, n, 11.5, a, '#d6b04a', 6); k.add('body', new THREE.SphereGeometry(.16, 8, 6), n, 12.5, a, 0, '#d6b04a');
    for (const [r, l] of [[.3, 1.6], [.3, 5.2], [-.9, 5.2]]) win(k, n + Math.sin(r) * 1.76, l, a + Math.cos(r) * 1.76, r, .6, 1.1, false, 0);
    chim(k, o + 2.2, -2.6, 9.4); yard(k, 10.4, e, 2); } },
  manor: { name: 'Усадьба', w: 12.4, d: 9, fn(k) { const P = k.P, w = 12.4, d = 9; k.box('body', w + .4, .7, d + .4, 0, 0, 0, P.stone); k.box('wall', w, 6, d, 0, .7, 0); k.box('body', w + .16, .22, d + .16, 0, 3.6, 0, P.stone);
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (let r = 0; r < 6; r++) k.box('body', .5, .45, .5, a * (w / 2 - .2), .8 + r * .95, b * (d / 2 - .2), r % 2 ? P.stone : P.dark);
    hip(k, w, d, 6.7, 3.3, .55); for (const x of [-1.4, 1.4]) k.cyl('body', .26, .3, 4.2, x, .7, d / 2 + 1.5, '#ece6da', 10); k.box('body', 3.8, .4, 2.2, 0, 4.9, d / 2 + .9, '#ece6da');
    k.add('body', new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), new THREE.Vector2(0, 1.3)]), { depth: 2.2, bevelEnabled: false }), 0, 5.3, d / 2 - .2, 0, '#ece6da');
    k.box('body', 3, .35, 1.6, 0, 0, d / 2 + 1.2, P.stone); door(k, 0, d / 2, 0, false, 1.4, 2.6);
    for (const x of [-4.6, -2.4, 2.4, 4.6]) win(k, x, 1.5, d / 2, 0, 1, 1.5, false, 0); for (const x of [-4.6, -2.4, 0, 2.4, 4.6]) win(k, x, 4.3, d / 2, 0, 1, 1.4, x !== 0, 1);
    for (const s of [1, -1]) for (const z of [-2, 2]) win(k, s * w / 2, 4.3, z, s * Math.PI / 2, .9, 1.3, false, 2); chim(k, -4, -1.5, 11); chim(k, 4, -1.5, 11);
    for (const s of [-1, 1]) { k.add('body', ICO(.7), s * (w / 2 - .4), .7, d / 2 + 2.6, 0, P.leaf); } } },
  farmhouse: { name: 'Хутор', w: 9, d: 7.2, fn(k) { const P = k.P, w = 9, d = 7.2; k.box('body', w + .3, .4, d + .3, 0, 0, 0, P.stone); k.box('body', w, 2.9, d, 0, .4, 0, P.wood);
    for (let i = 0; i < 7; i++) for (const s of [1, -1]) k.box('body', w + .12, .08, .06, 0, .6 + i * .4, s * (d / 2 + .02), '#5e4026');
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.cyl('body', .18, .18, 3.1, a * w / 2, .4, b * d / 2, '#6a4a2c', 6);
    hip(k, w, d, 3.3, 3.2, .8, 0, 0, 'body', P.thatch); hip(k, w * .25, d * .2, 6.15, .5, .2, 0, 0, 'body', '#9a7a3a');
    door(k, -1.6, d / 2, 0, false); win(k, 1.8, 1.3, d / 2, 0, .8, .9, true, 3); win(k, w / 2, 1.3, 0, Math.PI / 2, .8, .9, false, 3); chim(k, 2.6, -1.6, 6.6);
    k.add('body', new THREE.ConeGeometry(1.3, 2.4, 9).translate(0, 1.2, 0), w / 2 + .8, 0, -d / 2 - 1.2, 0, P.thatch); yard(k, w, d, 0); } },
  rowhouse: { name: 'Дома в ряд', w: 12, d: 7.4, fn(k) { const P = k.P, d = 7.4;
    [[-4, 5.6, 'wall'], [0, 6.6, 'brick'], [4, 5.2, 'wall']].forEach(([x, h, t], i) => { k.box('body', 4, .4, d + .2, x, 0, 0, P.stone);
      if (t === 'wall') { k.box('wall', 3.96, h - .4, d, x, .4, 0); frame(k, 3.96, 3, h - 3, x, d / 2 + .01, 0, 3); } else k.box('body', 3.96, h - .4, d, x, .4, 0, '#a8583e');
      rot(k, tt => gable(tt, d, 3.96, h, 2.6 + i * .3, .3, 0, 0, t === 'wall' ? 'wall' : 'body', '#a8583e'), Math.PI / 2, x, 0);
      door(k, x - .9, d / 2, 0, i !== 1, 1, 2.1); win(k, x + .9, 1.3, d / 2, 0, .9, 1.1, true, i); win(k, x, 3.6, d / 2, 0, 1.1, 1.2, true, i + 1); });
    chim(k, -4.8, -2, 8); chim(k, 3.4, -2, 7.6); yard(k, 12, d, 4); } },
  barracks: { name: 'Казарма', w: 18, d: 8.4, fn(k) { const P = k.P, w = 18, d = 8.4; k.box('body', w, 3.2, d, 0, 0, 0, P.stone); k.box('wall', w + .3, 2.4, d + .3, 0, 3.2, 0);
    frame(k, w + .3, 3.2, 2.4, 0, d / 2 + .16, 0, 12); frame(k, w + .3, 3.2, 2.4, 0, -d / 2 - .16, Math.PI, 12); gable(k, w + .3, d + .3, 5.6, 3, .5);
    door(k, 0, d / 2, 0, true, 1.6, 2.4); for (const x of [-7, -4.5, -2, 2, 4.5, 7]) win(k, x, 1.2, d / 2, 0, .9, 1, false, 0); for (const x of [-6.5, -3.5, -1, 1, 3.5, 6.5]) win(k, x, 3.9, d / 2 + .16, 0, .8, 1, true, 1);
    for (const x of [-6, 6]) chim(k, x, -2, 8.2);
    for (const x of [-5, 5]) { k.box('body', 2, .1, .3, x, 1.5, d / 2 + 1.2, P.wood); for (let i = 0; i < 4; i++) k.box('body', .06, 1.8, .06, x - .75 + i * .5, 0, d / 2 + 1.2, '#c8ccd4'); } } },
  temple: { name: 'Храм', w: 9.4, d: 15, fn(k) { const P = k.P, w = 8.6, d = 13, cz = -1; k.box('body', w + .6, .8, d + .6, 0, 0, cz, P.stone); k.box('wall', w, 6.5, d, 0, .8, cz);
    for (const s of [1, -1]) for (const z of [-6, -3.5, -1, 1.5, 4]) k.box('body', .7, 5.8, .9, s * (w / 2 + .2), .8, z + cz, P.stone);
    rot(k, t => gable(t, d, w, 7.3, 3.6, .5), Math.PI / 2, 0, cz);
    for (const z of [-4.75, -2.25, .25, 2.75]) for (const s of [1, -1]) win(k, s * w / 2, 2.4, z + cz, s * Math.PI / 2, .8, 2.4, false, 0);
    const tz = d / 2 + cz - 1.2; k.box('wall', 3.4, 11, 3.4, 0, .8, tz); k.box('body', 3.7, .3, 3.7, 0, 11.8, tz, P.stone);
    k.add('body', B(1.3, 1.9, 3.5), 0, 9.6, tz, 0, '#2a2430'); k.add('body', B(3.5, 1.9, 1.3), 0, 9.6, tz, 0, '#2a2430');
    k.add('roof', new THREE.ConeGeometry(2.5, 5.2, 4).rotateY(Math.PI / 4).translate(0, 2.6, 0), 0, 12.1, tz); k.cyl('body', .06, .06, 1.2, 0, 17.2, tz, '#d6b04a', 6); k.box('body', .7, .1, .1, 0, 17.9, tz, '#d6b04a');
    k.add('glass', new THREE.CylinderGeometry(.6, .6, .08, 14).rotateX(Math.PI / 2), 0, 6.6, tz + 1.74); k.add('body', new THREE.TorusGeometry(.66, .1, 6, 16), 0, 6.6, tz + 1.76, 0, P.stone);
    door(k, 0, tz + 1.7, 0, false, 1.4, 2.8); k.box('body', 3, .3, 1.6, 0, 0, tz + 2.4, P.stone); } },
  warehouse: { name: 'Склад', w: 13, d: 9, fn(k) { const P = k.P, w = 13, d = 9; k.box('body', w + .3, .5, d + .3, 0, 0, 0, P.stone); k.box('body', w, 4.6, d, 0, .5, 0, P.wood);
    for (let i = 0; i < 10; i++) for (const s of [1, -1]) k.box('body', .1, 4.6, .06, -w / 2 + .6 + i * ((w - 1.2) / 9), .5, s * (d / 2 + .03), '#6a4a2c');
    gable(k, w, d, 5.1, 2.6, .5, 0, 0, 'body', P.wood); k.box('body', 3, 3.4, .12, 0, .5, d / 2 + .06, P.door);
    for (const s of [1, -1]) k.add('body', B(.14, 4.4, .06).rotateZ(s * .72), 0, 2.2, d / 2 + .14, 0, P.timber); k.box('body', .3, .3, 1.6, 0, 6.2, d / 2 + .6, P.timber);
    win(k, -4.5, 2.4, d / 2, 0, .8, .8, false, 1); win(k, 4.5, 2.4, d / 2, 0, .8, .8, false, 1);
    for (let i = 0; i < 4; i++) k.box('body', 1, 1, 1, -5.6 + i * 1.1, 0, d / 2 + 1.4, P.plank); k.box('body', 1, 1, 1, -5, 1, d / 2 + 1.4, P.plank);
    for (let i = 0; i < 3; i++) k.cyl('body', .45, .45, 1.1, 3.6 + i * 1, 0, d / 2 + 1.4, '#6a4a2c', 10); } },
  markethall: { name: 'Торговые ряды', w: 13, d: 8, fn(k) { const P = k.P, w = 13, d = 8; k.box('body', w + .4, .4, d + .4, 0, 0, 0, P.paving);
    for (let i = 0; i < 6; i++) for (const s of [1, -1]) k.box('body', .4, 3.6, .4, -w / 2 + .3 + i * ((w - .6) / 5), .4, s * (d / 2 - .3), P.timber);
    k.box('body', w, .4, d, 0, 4, 0, P.timber); gable(k, w, d, 4.4, 2.6, .6);
    for (let i = 0; i < 4; i++) { const x = -4.5 + i * 3; k.box('body', 2.2, .9, 1, x, .4, d / 2 - 1.3, P.plank);
      k.add('body', B(2.4, .08, 1.4).rotateX(.3), x, 2.3, d / 2 - .9, 0, ['#c0392b', '#2e86c1', '#d4ac0d', '#27ae60'][i]);
      k.add('body', ICO(.25), x - .5, 1.45, d / 2 - 1.3, 0, '#e8566a'); k.add('body', ICO(.25), x + .4, 1.45, d / 2 - 1.3, 0, '#f2c94c'); k.add('body', ICO(.22), x, 1.45, d / 2 - 1.4, 0, '#7ab04a'); } } },
  forge: { name: 'Кузница', w: 10, d: 7, fn(k) { const P = k.P, w = 7, d = 7, o = -1.2; k.box('body', w + .3, .5, d + .3, o, 0, 0, P.stone); k.box('body', w, 3.4, d, o, .5, 0, P.stone);
    gable(k, w, d, 3.9, 2.4, .4, o, 0, 'body', P.dark); k.box('body', 1.6, 8, 1.6, o - 2.4, 0, -1.8, P.dark); k.box('body', 1.9, .3, 1.9, o - 2.4, 8, -1.8, '#3a302a');
    for (const z of [-2.5, 2.5]) k.cyl('body', .12, .12, 3, 4.6, 0, z, P.timber, 6); k.add('roof', B(3.8, .15, 6.4).rotateZ(-.25), 3.7, 3.1, 0);
    k.box('body', .8, .6, .4, 3.6, 0, 1, '#3a3a40'); k.box('body', 1, .25, .45, 3.6, .6, 1, '#4a4a52'); k.box('body', 1.6, .9, 1.4, 3.8, 0, -1.4, P.stone); k.add('glass', B(1, .15, .9), 3.8, .92, -1.4);
    door(k, o, d / 2, 0); win(k, o - 2.2, 1.3, d / 2, 0, .8, .9, false, 1); k.cyl('body', .45, .45, .8, 2.4, 0, 2.8, '#6a4a2c', 10); } },
  windmill: { name: 'Мельница', w: 6, d: 6, fn(k) { const P = k.P; k.cyl('body', 2.6, 2.8, .5, 0, 0, 0, P.stone, 12); k.cyl('wall', 2, 2.6, 8.5, 0, .5, 0, null, 12);
    k.add('roof', new THREE.ConeGeometry(2.6, 3, 12).translate(0, 1.5, 0), 0, 9, 0); door(k, 0, 2.5, 0, false, 1, 1.9); win(k, 0, 4.4, 2.3, 0, .6, .8, false, 1); win(k, 0, 6.8, 2.1, 0, .5, .7, false, 2);
    k.add('body', new THREE.CylinderGeometry(.35, .35, .8, 8).rotateX(Math.PI / 2), 0, 8.8, 2.4, 0, P.timber);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; k.add('body', B(.25, 6, .1).translate(0, 3, 0).rotateZ(a), 0, 8.8, 2.75, 0, P.timber); k.add('body', B(1.3, 4.4, .05).translate(.75, 3.6, 0).rotateZ(a), 0, 8.8, 2.8, 0, '#f2ece0'); } } },
  barn: { name: 'Амбар', w: 11, d: 8.4, fn(k) { const P = k.P, w = 11, d = 8.4, c = P.barn; k.box('body', w + .3, .4, d + .3, 0, 0, 0, P.stone); k.box('body', w, 4.2, d, 0, .4, 0, c);
    for (const s of [-1, 1]) k.box('body', .2, 4.2, .08, s * (w / 2 - .1), .4, d / 2 + .02, '#efe6d6');
    rot(k, t => gable(t, d, w, 4.6, 3.4, .5, 0, 0, 'body', c), Math.PI / 2); k.box('body', 3.4, 3.4, .1, 0, .4, d / 2 + .05, '#5a2a20');
    for (const s of [1, -1]) k.add('body', B(.18, 4.6, .06).rotateZ(s * .78), 0, 2.1, d / 2 + .12, 0, '#efe6d6'); k.box('body', 3.6, .18, .08, 0, 3.75, d / 2 + .12, '#efe6d6');
    k.box('body', 1.2, 1.2, .08, 0, 5.4, d / 2 + .08, '#3a2a20'); for (let i = 0; i < 3; i++) k.add('body', new THREE.CylinderGeometry(.6, .6, 1, 10).rotateZ(Math.PI / 2), -w / 2 + 1 + i * 1.1, .6, d / 2 + 1.4, 0, P.thatch); } },
  workshop: { name: 'Мастерская', w: 10.5, d: 7, fn(k) { const P = k.P, w = 8, d = 7, o = -1; k.box('body', w + .3, .5, d + .3, o, 0, 0, P.stone); k.box('wall', w, 3.2, d, o, .5, 0);
    frame(k, w, .5, 3.2, o, d / 2 + .01, 0, 5); frame(k, d, .5, 3.2, o + w / 2 + .01, 0, Math.PI / 2, 4, false); gable(k, w, d, 3.7, 2.6, .45, o, 0);
    door(k, o - 1.6, d / 2, 0); win(k, o + 1.6, 1.3, d / 2, 0, 1.6, 1.1, true, 2);
    for (const z of [-2.6, 2.6]) k.cyl('body', .12, .12, 2.6, 4.6, 0, z, P.timber, 6); k.add('roof', B(2.6, .12, 6.2).rotateZ(-.3), 4, 2.9, 0);
    for (let i = 0; i < 5; i++) k.add('body', new THREE.CylinderGeometry(.22, .22, 2, 8).rotateX(Math.PI / 2), 3.7 + (i % 3) * .45, .22 + Math.floor(i / 3) * .4, -1, 0, '#8a6a44');
    k.box('body', 1.6, .12, .2, 4, .8, 1.6, P.plank); for (const x of [-.6, .6]) k.box('body', .1, .8, .5, 4 + x, 0, 1.6, P.timber); chim(k, o - 2.5, -1.8, 7.4); } },
  garden: { name: 'Огород', w: 12, d: 9, fn(k) { const P = k.P, w = 12, d = 9; k.box('body', w, .12, d, 0, 0, 0, '#6a4a2c');
    for (let i = 0; i < 5; i++) { const z = -d / 2 + 1.2 + i * 1.6; k.box('body', w - 1.5, .3, .7, 0, .12, z, '#5a3e26'); for (let j = 0; j < 8; j++) k.add('body', ICO(.34), -w / 2 + 1.4 + j * 1.3, .62, z, 0, i % 3 === 0 ? '#d8b24a' : i % 3 === 1 ? P.leaf : '#e0703a'); }
    for (let x = -w / 2; x <= w / 2 + .01; x += 1.5) for (const s of [-1, 1]) if (s < 0 || Math.abs(x) > 1.2) k.box('body', .12, .9, .12, x, 0, s * d / 2, P.timber);
    for (let z = -d / 2; z <= d / 2 + .01; z += 1.5) for (const s of [-1, 1]) k.box('body', .12, .9, .12, s * w / 2, 0, z, P.timber);
    for (const s of [-1, 1]) { k.box('body', w, .08, .06, 0, .6, s * d / 2, P.plank); k.box('body', .06, .08, d, s * w / 2, .6, 0, P.plank); }
    k.box('body', .1, 2.2, .1, 3, 0, 0, P.timber); k.box('body', 1.4, .1, .1, 3, 1.7, 0, P.timber); k.add('body', new THREE.SphereGeometry(.25, 8, 6), 3, 2.35, 0, 0, '#e8d6a0'); k.add('body', new THREE.ConeGeometry(.4, .4, 8), 3, 2.7, 0, 0, P.thatch); } },
  well: { name: 'Сквер с колодцем', w: 10, d: 9, fn(k) { const P = k.P; k.add('body', new THREE.CylinderGeometry(4.6, 4.6, .12, 24), 0, .06, 0, 0, P.paving);
    k.cyl('body', 1.1, 1.2, .9, 0, 0, 0, P.stone, 12); k.add('body', new THREE.CylinderGeometry(.85, .85, .05, 12), 0, .88, 0, 0, '#3a5a7a'); for (const s of [1, -1]) k.box('body', .15, 2.4, .15, s * .95, .9, 0, P.timber);
    k.add('roof', new THREE.ConeGeometry(1.8, 1.2, 4).rotateY(Math.PI / 4).translate(0, .6, 0), 0, 3.2, 0);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; rot(k, t => { t.box('body', 2, .08, .44, 0, .4, 0, P.plank); for (const s of [-.8, .8]) t.box('body', .12, .4, .36, s, 0, 0, P.timber); }, a + Math.PI / 2, Math.sin(a) * 2.8, Math.cos(a) * 2.8); tree(k, Math.sin(a + .5) * 3.9, Math.cos(a + .5) * 3.9, .9); } } },
};

// ---------- постройки за «Славу» ----------
function logs(k, w, d, h, cx = 0, cz = 0) { const cols = ['#8a6a44', '#7a5a38'];
  for (let i = 0; i * .42 < h; i++) { const y = .22 + i * .42, c = cols[i % 2];
    for (const s of [1, -1]) { k.add('body', new THREE.CylinderGeometry(.22, .22, w + .5, 7).rotateZ(Math.PI / 2), cx, y, cz + s * d / 2, 0, c); k.add('body', new THREE.CylinderGeometry(.22, .22, d + .5, 7).rotateX(Math.PI / 2), cx + s * w / 2, y + .21, cz, 0, c); } } }
Object.assign(KINDS, {
  brewery: { name: 'Пивоварня', w: 10, d: 7.5, fn(k) { const P = k.P; k.box('body', 7.3, .5, 6.3, -1.3, 0, 0, P.stone); k.box('wall', 7, 3.6, 6, -1.3, .5, 0); frame(k, 7, .5, 3.6, -1.3, 3.01, 0, 5);
    gable(k, 7, 6, 4.1, 2.6, .45, -1.3, 0); door(k, -1.3, 3, 0); win(k, -3.6, 1.4, 3, 0, .8, 1, true, 0); win(k, .9, 1.4, 3, 0, .8, 1, true, 1); chim(k, -3.4, -1.5, 8);
    k.cyl('body', 1.35, 1.35, 2.6, 3.7, 0, -1, '#b8743a', 14); k.cyl('body', 1.42, 1.42, .15, 3.7, 1.3, -1, '#8a5426', 14); k.add('body', new THREE.SphereGeometry(1.35, 14, 8, 0, 6.29, 0, 1.2), 3.7, 2.6, -1, 0, '#c88446');
    k.add('body', new THREE.CylinderGeometry(.12, .12, 1.6, 6).rotateZ(Math.PI / 2), 2.4, 3, -1, 0, '#8a5426');
    for (let i = 0; i < 3; i++) k.add('body', new THREE.CylinderGeometry(.45, .45, .9, 10).rotateX(Math.PI / 2), 3 + i * .95, .45, 1.6, 0, '#6a4a2c'); k.add('body', new THREE.CylinderGeometry(.45, .45, .9, 10).rotateX(Math.PI / 2), 3.5, 1.3, 1.6, 0, '#6a4a2c');
    k.box('body', 2.6, .1, 1, -1.3, .8, 4.6, P.plank); for (const s of [-1, 1]) { k.box('body', .14, .8, .8, -1.3 + s, 0, 4.6, P.timber); k.box('body', 2.6, .1, .4, -1.3, .45, 4.6 + s * .9, P.plank); }
    for (const u of [-.6, .3]) k.cyl('body', .13, .12, .32, -1.3 + u, .9, 4.6, '#e8c060', 8); k.box('body', .14, .14, 1.4, .9, 3.3, 3.7, P.timber); k.cyl('body', .3, .26, .5, .9, 2.6, 4.3, '#e8c060', 8); } },
  bathhouse: { name: 'Баня', w: 8, d: 7, fn(k) { const P = k.P; k.box('body', 6.6, .3, 5.6, 0, 0, 0, P.stone); logs(k, 6, 5, 2.9); gable(k, 6.5, 5.5, 3.2, 2.2, .5, 0, 0, 'body', '#7a5a38');
    door(k, -1.2, 2.75, 0, false, .9, 1.8); win(k, 1.3, 1.3, 2.75, 0, .6, .6, false, 1); k.cyl('body', .3, .35, 6.4, 2, 0, -1.2, '#4a4a52', 8);
    for (let i = 0; i < 4; i++) k.add('glass', new THREE.SphereGeometry(.35 + i * .12, 8, 6), 2 + i * .25, 6.8 + i * .55, -1.2 - i * .1);
    for (let i = 0; i < 7; i++) k.add('body', new THREE.CylinderGeometry(.18, .18, 1.4, 7).rotateX(Math.PI / 2), -3.6 + (i % 4) * .38, .2 + Math.floor(i / 4) * .34, -.6, 0, '#9a7a50'); k.cyl('body', .3, .25, .45, 1.6, 0, 3.3, '#7a5a38', 8); } },
  library: { name: 'Библиотека', w: 10, d: 7.5, fn(k) { const P = k.P, w = 9, d = 6.6; k.box('body', w + .4, .7, d + .4, 0, 0, 0, P.stone); k.box('wall', w, 5.2, d, 0, .7, 0); k.box('body', w + .2, .3, d + .2, 0, 5.9, 0, P.stone);
    hip(k, w, d, 6.2, 2.6, .4); k.add('roof', new THREE.SphereGeometry(1.3, 12, 8, 0, 6.29, 0, 1.57), 0, 8.6, 0); k.cyl('body', .05, .05, .8, 0, 9.8, 0, '#d6b04a', 6);
    for (const x of [-3, 3]) win(k, x, 1.6, d / 2, 0, 1, 2.6, false, 2); for (const s of [-1, 1]) k.cyl('body', .25, .28, 4.2, s * 1.3, .7, d / 2 + 1, '#ece6da', 10); k.box('body', 3.2, .35, 1.6, 0, 4.9, d / 2 + .7, '#ece6da');
    door(k, 0, d / 2, 0, false, 1.3, 2.6); k.box('body', 2.8, .3, 1.6, 0, 0, d / 2 + .9, P.stone);
    k.box('body', 1.6, 1.1, .12, 0, 3.2, d / 2 + .1, '#7a3a2c'); k.box('body', .1, 1, .14, 0, 3.25, d / 2 + .12, '#f2e6c8');
    for (const s of [-1, 1]) for (const z of [-1.6, 1.6]) win(k, s * w / 2, 1.8, z, s * Math.PI / 2, .9, 2.2, false, 2); } },
  apiary: { name: 'Пасека', w: 9, d: 7, fn(k) { const P = k.P; k.box('body', 9, .08, 6.6, 0, 0, 0, '#7aa04a');
    for (let i = 0; i < 6; i++) { const x = -3.3 + (i % 3) * 2.2, z = -1.4 + Math.floor(i / 3) * 2.6; k.box('body', .3, .4, .3, x, 0, z, P.timber); for (let j = 0; j < 3; j++) k.box('body', 1, .42, 1, x, .4 + j * .44, z, j % 2 ? '#f2d27a' : '#e8e0c8');
      rot(k, t => gable(t, 1.2, 1.2, 1.72, .5, .08, 0, 0, 'body', '#8a5a30'), 0, x, z); }
    k.box('body', 2, 2.2, 1.6, 3.6, 0, -2.2, P.wood); gable(k, 2, 1.6, 2.2, 1, .25, 3.6, -2.2); door(k, 3.6, -1.4, 0, false, .8, 1.6);
    for (let i = 0; i < 18; i++) k.add('body', ICO(.16), -4 + (i * 1.7) % 8.2, .2, 2.6 + (i % 3) * .25, 0, P.flowers[i % 4]); } },
  armory: { name: 'Оружейная', w: 10, d: 7.5, fn(k) { const P = k.P; k.box('body', 7.4, .5, 6, -1.2, 0, 0, P.dark); k.box('body', 7, 3.8, 5.6, -1.2, .5, 0, P.stone);
    for (let i = 0; i < 5; i++) k.box('body', .5, .5, .5, -4.4 + i * 1.6, 4.3, 2.6, P.stone); gable(k, 7, 5.6, 4.3, 2.4, .4, -1.2, 0, 'body', P.stone);
    k.box('body', 2, 2.8, .1, -1.2, .5, 2.85, '#4a3020'); k.box('body', 2.3, .2, .14, -1.2, 3.3, 2.88, '#3a3a40'); k.add('body', new THREE.CylinderGeometry(.55, .55, .1, 12).rotateX(Math.PI / 2), -1.2, 3.9, 2.9, 0, '#c0392b');
    for (const [x, z] of [[3.2, -1.6], [3.2, 1.2]]) { k.box('body', .14, 2, .14, x - .9, 0, z, P.timber); k.box('body', .14, 2, .14, x + .9, 0, z, P.timber); k.box('body', 2, .12, .2, x, 1.6, z, P.timber);
      for (let i = 0; i < 4; i++) k.box('body', .07, 1.6, .05, x - .6 + i * .4, .1, z + .12, '#d8dce4'); k.add('body', new THREE.CylinderGeometry(.42, .42, .08, 10).rotateX(Math.PI / 2), x, 1, z - .2, 0, P.shutter[(x + z) & 3]); }
    k.cyl('body', .08, .08, 1.8, 1.7, 0, 3.2, P.timber, 6); k.box('body', .9, .12, .12, 1.7, 1.4, 3.2, P.timber); k.add('body', new THREE.CylinderGeometry(.35, .3, .8, 8), 1.7, 1.1, 3.2, 0, '#c9a65a'); k.add('body', new THREE.SphereGeometry(.25, 8, 6), 1.7, 1.75, 3.2, 0, '#c9a65a'); } },
  tilt: { name: 'Ристалище', w: 12, d: 8.6, fn(k) { const P = k.P, rx = 5.6, rz = 3.6; k.add('body', new THREE.CylinderGeometry(1, 1, .1, 24).scale(rx, 1, rz), 0, .05, 0, 0, '#d8c08a');
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; k.box('body', .16, 1.1, .16, Math.cos(a) * rx, 0, Math.sin(a) * rz, P.timber); }
    for (let i = 0; i < 20; i++) { const a = (i + .5) / 20 * Math.PI * 2, a2 = (i + 1) / 20 * Math.PI * 2, x = Math.cos(a) * rx, z = Math.sin(a) * rz, L = Math.hypot(Math.cos(a2) * rx - Math.cos(a2 - .314) * rx, Math.sin(a2) * rz - Math.sin(a2 - .314) * rz);
      if (Math.abs(Math.sin(a)) > .95 && Math.sin(a) > 0) continue; k.add('body', B(L + .1, .1, .08).rotateY(-Math.atan2(-Math.sin(a) * rz, Math.cos(a) * rx * 1) + Math.PI / 2), x, .8, z, 0, P.plank); }
    for (let r = 0; r < 2; r++) k.box('body', 6, .5 + r * .5, .9, 0, 0, -rz - 1 - r * .9, P.plank);
    for (const s of [-1, 1]) { k.cyl('body', .06, .06, 3.2, s * (rx + .5), 0, 0, P.timber, 6); k.add('body', B(1, .7, .04).translate(.5, 0, 0), s * (rx + .5), 2.8, 0, 0, P.shutter[s > 0 ? 1 : 2]); } } },
  watchtower: { name: 'Сторожевая башня', w: 6, d: 6, fn(k) { const P = k.P, h = 8;
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.add('body', B(.3, h + .2, .3).translate(0, (h + .2) / 2, 0).rotateX(b * .05).rotateZ(-a * .05), a * 1.4, 0, b * 1.4, 0, P.timber);
    for (const y of [2.5, 5.2]) for (const s of [-1, 1]) { k.box('body', 3, .14, .14, 0, y, s * 1.35, P.timber); k.box('body', .14, .14, 3, s * 1.35, y, 0, P.timber); }
    k.box('body', 3.6, .25, 3.6, 0, h, 0, P.plank); for (const s of [-1, 1]) { k.box('body', 3.6, .7, .1, 0, h + .25, s * 1.75, P.wood); k.box('body', .1, .7, 3.6, s * 1.75, h + .25, 0, P.wood); }
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('body', .14, 2, .14, a * 1.6, h + .25, b * 1.6, P.timber); hip(k, 3.6, 3.6, h + 2.2, 1.6, .35);
    for (const s of [-.35, .35]) k.add('body', B(.08, h, .08).translate(0, h / 2, 0).rotateX(-.12), s, 0, 2.1, 0, P.timber); for (let i = 1; i < 11; i++) k.box('body', .7, .06, .06, 0, i * .72, 2.1 - i * .087, P.timber);
    k.add('glass', B(.3, .4, .3), 1.75, h + 1.1, 1.75); } },
  music_hall: { name: 'Дом музыки', w: 10, d: 8.6, fn(k) { const P = k.P; k.cyl('body', 3.6, 3.8, .6, 0, 0, 0, P.stone, 16); k.cyl('body', 3.5, 3.5, .1, 0, .6, 0, P.plank, 16);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.cyl('body', .18, .2, 3.4, Math.cos(a) * 3.2, .6, Math.sin(a) * 3.2, '#ece6da', 8); }
    k.cyl('body', 3.6, 3.6, .3, 0, 4, 0, P.timber, 16); k.add('roof', new THREE.ConeGeometry(4.1, 2.6, 16).translate(0, 1.3, 0), 0, 4.3, 0); k.add('body', ICO(.3), 0, 7, 0, 0, '#d6b04a');
    k.cyl('body', .5, .5, .7, -1, .7, -.8, '#c0392b', 12); k.cyl('body', .52, .52, .06, -1, 1.4, -.8, '#f2ece0', 12); k.cyl('body', .35, .35, .5, .2, .7, -1.4, '#2e86c1', 10);
    k.add('body', new THREE.SphereGeometry(.35, 8, 6).scale(1, 1.3, .5), 1.4, 1.5, -.6, 0, '#b8743a'); k.box('body', .08, 1, .06, 1.4, 1.7, -.6, '#5a3a22');
    for (let i = 0; i < 3; i++) k.box('body', 2.2, .08, .44, -2.2 + i * 2.2, .4, 5, P.plank); } },
  shrine: { name: 'Святилище героев', w: 8, d: 7, fn(k) { const P = k.P; k.box('body', 6, .5, 5, 0, 0, 0, P.stone); k.box('body', 4.4, .4, 3.6, 0, .5, 0, P.dark);
    k.add('body', new THREE.CylinderGeometry(.35, .7, 5.5, 4).rotateY(Math.PI / 4).translate(0, 2.75, 0), 0, .9, 0, 0, P.stone); k.add('body', new THREE.ConeGeometry(.4, .7, 4).rotateY(Math.PI / 4).translate(0, .35, 0), 0, 6.4, 0, 0, '#d6b04a');
    for (let i = 0; i < 7; i++) { const a = Math.PI * (.15 + i * .7 / 6); k.box('body', 1.1, 1.2 + (i % 2) * .2, .5, Math.cos(a) * 3.2, 0, -Math.sin(a) * 2.6, P.stone, -a + Math.PI / 2); }
    for (const s of [-1, 1]) { k.cyl('body', .3, .2, 1, s * 2.4, .5, 1.9, P.dark, 8); k.add('glass', new THREE.ConeGeometry(.25, .5, 7), s * 2.4, 1.75, 1.9); }
    for (let i = 0; i < 8; i++) { k.cyl('body', .05, .05, .25, -1.4 + i * .4, .9, 1.4, '#f4eee0', 6); k.add('glass', ICO(.05), -1.4 + i * .4, 1.2, 1.4); }
    for (let i = 0; i < 12; i++) k.add('body', ICO(.14), -1.8 + (i % 6) * .7, .95, 1.75 + Math.floor(i / 6) * .25, 0, P.flowers[i % 4]); } },
  fishpond: { name: 'Пруд', w: 10, d: 8, fn(k) { const P = k.P; k.add('body', new THREE.CylinderGeometry(1, 1, .1, 24).scale(4.4, 1, 3), 0, .02, 0, 0, '#7a6a4a'); k.add('body', new THREE.CylinderGeometry(1, 1, .08, 24).scale(4, 1, 2.6), 0, .07, 0, 0, '#4a8ab8');
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; k.add('body', ICO(.3 + (i % 3) * .08), Math.cos(a) * 4.3, .12, Math.sin(a) * 2.9, 0, i % 2 ? '#8a8478' : '#a09a8c'); }
    for (let i = 0; i < 9; i++) k.box('body', .06, .9 + (i % 3) * .3, .06, -3.6 + (i % 3) * .2, 0, -1.5 + i * .2, '#5a8a3a');
    k.box('body', 1, .12, 2.6, 2.4, .35, 2.2, P.plank); for (const s of [-1, 1]) for (const z of [1.3, 3.2]) k.box('body', .12, .45, .12, 2.4 + s * .4, 0, z, P.timber);
    k.add('body', B(1.8, .35, .7).translate(0, .175, 0), -.8, .1, .6, .4, '#8a5a30'); k.add('body', B(.05, 2, .05).rotateZ(-.7), 2.9, 1.1, 1.8, 0, '#5a3a22');
    for (let i = 0; i < 3; i++) k.add('body', new THREE.CylinderGeometry(.3, .3, .03, 10), 1 - i * 1.6, .13, -1 + i * .8, 0, '#5a9a4a'); } },
  hunters: { name: 'Охотничий домик', w: 9, d: 7, fn(k) { const P = k.P; k.box('body', 6.1, .3, 5.1, -1, 0, 0, P.stone); logs(k, 5.6, 4.6, 2.7, -1, 0); gable(k, 6, 5, 3, 2.2, .5, -1, 0, 'body', '#7a5a38');
    door(k, -1, 2.55, 0, true, .9, 1.9); win(k, -2.8, 1.2, 2.55, 0, .6, .6, false, 3);
    for (const s of [-1, 1]) { k.add('body', B(.08, .7, .08).rotateZ(s * .5), -1 + s * .35, 2.75, 2.7, 0, '#e8dcc0'); k.add('body', B(.06, .35, .06).rotateZ(s * 1.1), -1 + s * .55, 2.95, 2.7, 0, '#e8dcc0'); }
    for (const x of [2.6, 4.4]) k.box('body', .12, 2, .12, x, 0, 0, P.timber); k.box('body', 2, .1, .1, 3.5, 1.9, 0, P.timber); k.box('body', .8, 1.1, .04, 3.1, .8, 0, '#9a6a3a'); k.box('body', .7, .9, .04, 3.9, .95, 0, '#7a5030');
    k.cyl('body', .4, .45, .5, 3.4, 0, 2.2, '#8a6a44', 8); k.add('body', B(.06, .7, .06).rotateZ(.4), 3.3, .8, 2.2, 0, '#5a3a22'); } },
  lot: { name: 'Место под стройку', w: 8, d: 6, fn(k) { const P = k.P; k.box('body', 8, .08, 6, 0, 0, 0, '#8a6a4a');
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box('body', .14, .9, .14, a * 3.8, 0, b * 2.8, P.timber); for (const s of [-1, 1]) { k.box('body', 7.6, .04, .04, 0, .7, s * 2.8, '#e8d6a0'); k.box('body', .04, .04, 5.6, s * 3.8, .7, 0, '#e8d6a0'); }
    for (let i = 0; i < 6; i++) k.box('body', 3, .14, .4, -1.5, .08 + Math.floor(i / 3) * .14, -1 + (i % 3) * .45, P.plank); for (let i = 0; i < 5; i++) k.add('body', new THREE.DodecahedronGeometry(.3), 1.6 + (i % 3) * .5, .25, .5 + (i % 2) * .4, 0, P.stone);
    k.box('body', .12, 1.6, .12, 2.6, 0, 2.4, P.timber); k.box('body', 1.4, .8, .08, 2.6, 1.1, 2.46, '#e8c060'); } },
});
const UPG_KIND = { arena: 'tilt' };
export const UPG_DIST = { citadel: ['watchtower'], military: ['barracks', 'armory', 'arena'], industry: ['hunters'], culture: ['library', 'shrine'], farm: ['windmill', 'garden', 'apiary', 'fishpond'], trade: ['music_hall'], home: ['brewery', 'bathhouse'] };

const KIND_LIST = Object.keys(KINDS);
const GEO = new Map();
function kindGeo(bk, kind) { const key = bk + '|' + kind; if (!GEO.has(key)) { const k = new Kit(BIOME[bk]); KINDS[kind].fn(k); GEO.set(key, k.build()); } return GEO.get(key); }

// ---------- особые постройки ----------
export function flagTex(F) { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d'); g.fillStyle = F.color; g.fillRect(0, 0, 128, 96); g.fillStyle = F.dark; g.fillRect(0, 84, 128, 12);
  g.font = '58px system-ui,"Apple Color Emoji","Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(F.icon, 64, 44); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function signTex(text) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#3a2414'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#e8b931'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 118);
  g.fillStyle = '#ffe9b0'; g.font = '900 56px system-ui,"Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function kitGroup(k, mats, wall, roof) { const g = new THREE.Group(), parts = k.build();
  for (const p of PARTS) if (parts[p]) { const m = new THREE.Mesh(parts[p], p === 'wall' ? new THREE.MeshLambertMaterial({ color: wall }) : p === 'roof' ? new THREE.MeshLambertMaterial({ color: roof }) : mats[p]); m.castShadow = p !== 'glass'; m.receiveShadow = true; g.add(m); }
  return g; }
function sign(g, text, y, z, w = 3.6) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: signTex(text) })); m.position.set(0, y, z); g.add(m); }
function keepKit(P) { const k = new Kit(P), w = 11; k.box('body', w + 1.4, .8, w + 1.4, 0, 0, 0, P.dark); k.box('body', w, 11, w, 0, .8, 0, P.stone);
  for (let i = 1; i < 6; i++) k.box('body', w + .12, .14, w + .12, 0, .8 + i * 2, 0, P.dark);
  for (let i = 0; i < 7; i++) for (const s of [1, -1]) { const u = -w / 2 + .5 + i * ((w - 1) / 6); k.box('body', .8, .9, .5, u, 11.8, s * (w / 2 - .25), P.stone); k.box('body', .5, .9, .8, s * (w / 2 - .25), 11.8, u, P.stone); }
  for (const a of [-1, 1]) for (const b of [-1, 1]) { k.cyl('body', 1.6, 1.8, 13.5, a * w / 2, 0, b * w / 2, P.stone, 12); k.cyl('body', 1.95, 1.95, .5, a * w / 2, 13.5, b * w / 2, P.dark, 12); k.add('roof', new THREE.ConeGeometry(2.15, 4, 12).translate(0, 2, 0), a * w / 2, 14, b * w / 2); k.add('glass', B(.4, 1, .4), a * (w / 2 + 1.5), 9, b * (w / 2 + 1.5)); }
  hip(k, w - 1.8, w - 1.8, 11.8, 4.4, 0); k.cyl('body', .1, .1, 4, 0, 16, 0, '#5a3a22', 6);
  for (let s = 0; s < 4; s++) { const ry = s * Math.PI / 2; rot(k, t => { t.box('body', 3.4, 4.6, .3, 0, .8, w / 2 + .05, '#4a3020'); t.box('body', 4, .5, .5, 0, 5.4, w / 2 + .1, P.dark); for (const u of [-3.2, 3.2]) for (const y of [5.5, 8.5]) t.add('glass', B(.6, 1.3, .1), u, y, w / 2 + .03); t.add('glass', B(.6, 1.3, .1), 0, 8.5, w / 2 + .03); }, ry); }
  return k; }
function tavernKit(P) { const k = new Kit(P), w = 12, d = 8; k.box('body', w + .3, .5, d + .3, 0, 0, 0, P.stone); k.box('body', w, 3, d, 0, .5, 0, P.stone); k.box('wall', w + .4, 2.8, d + .4, 0, 3.5, 0);
  frame(k, w + .4, 3.5, 2.8, 0, d / 2 + .21, 0, 8); frame(k, w + .4, 3.5, 2.8, 0, -d / 2 - .21, Math.PI, 8); gable(k, w + .4, d + .4, 6.3, 3.2, .5);
  door(k, 0, d / 2, 0, true, 1.6, 2.4); for (const x of [-4, -2.2, 2.2, 4]) win(k, x, 1.3, d / 2, 0, 1.1, 1.2, false, 1); for (const x of [-4.2, -1.4, 1.4, 4.2]) win(k, x, 4.2, d / 2 + .2, 0, .9, 1.1, true, 0);
  chim(k, -3.5, -2, 10.5); k.box('body', .14, .14, 1.6, 3.2, 3.1, d / 2 + .8, P.timber); k.box('body', 1.2, .8, .08, 3.2, 2.2, d / 2 + 1.5, '#8a5a30');
  for (const x of [-3.5, 3.5]) { k.box('body', 2.6, .1, 1, x, .8, d / 2 + 3, P.plank); for (const s of [-1, 1]) k.box('body', .14, .8, .8, x + s, 0, d / 2 + 3, P.timber); for (const s of [-1, 1]) k.box('body', 2.6, .1, .4, x, .45, d / 2 + 3 + s * .9, P.plank);
    for (const u of [-.6, .3]) k.cyl('body', .12, .12, .3, x + u, .9, d / 2 + 3, '#e8c060', 8); }
  for (let i = 0; i < 3; i++) k.cyl('body', .5, .5, 1.1, -w / 2 - .7, 0, -2 + i * 1.1, '#6a4a2c', 10);
  return k; }
function hallKit(P) { const k = new Kit(P); KINDS.manor.fn(k); k.box('wall', 3.2, 9, 3.2, 0, 6.7, -1); k.box('body', 3.5, .3, 3.5, 0, 15.7, -1, P.stone);
  k.add('glass', new THREE.CylinderGeometry(1, 1, .1, 20).rotateX(Math.PI / 2), 0, 13.4, .65); k.add('body', B(.08, .8, .04), 0, 13.6, .72, 0, '#2a2018'); k.add('body', B(.6, .08, .04), .25, 13.4, .72, 0, '#2a2018');
  k.add('roof', new THREE.ConeGeometry(2.5, 4, 4).rotateY(Math.PI / 4).translate(0, 2, 0), 0, 16, -1); k.cyl('body', .06, .06, 1.4, 0, 19.8, -1, '#d6b04a', 6); return k; }

// ---------- раскладка лагеря ----------
export const DISTRICTS = [['citadel', 'Цитадель'], ['military', 'Военный район'], ['industry', 'Промышленный район'], ['culture', 'Культурный район'], ['farm', 'Аграрный район'], ['trade', 'Торговый район'], ['craft', 'Ремесленный район'], ['home', 'Жилой район']];
const MIX = { home: [['cottage', 3], ['townhouse', 3], ['corner', 1.3], ['rowhouse', 2], ['manor', .6], ['well', .7]], citadel: [['manor', 1.6], ['townhouse', 1.2], ['barracks', .6], ['corner', 1]],
  military: [['barracks', 2.6], ['forge', .6], ['warehouse', .6], ['townhouse', 1], ['cottage', .6]], industry: [['forge', 1.6], ['warehouse', 1.4], ['workshop', 1], ['cottage', .9]],
  culture: [['temple', .9], ['manor', 1.1], ['well', 1.2], ['townhouse', 1.2], ['corner', .8]], farm: [['farmhouse', 2.2], ['barn', 1.4], ['windmill', .8], ['garden', 1.8], ['cottage', .6]],
  trade: [['markethall', 1.4], ['warehouse', 1.3], ['townhouse', 2], ['corner', 1.1], ['rowhouse', 1]], craft: [['workshop', 2.4], ['townhouse', 1.5], ['cottage', 1.1], ['corner', .8], ['forge', .4]] };
export const S = .6, RINGS = [8.5, 15.5, 27, 42, 52.5], ROAD = 1.7, IN_WALL = 12.8, OUT_WALL = 56;
const SECT = Math.PI / 4, WX = a => Math.sin(a), WZ = a => Math.cos(a);
const rnd = s => () => (s = Math.imul(s, 1664525) + 1013904223 >>> 0, s / 4294967296);
// ряды домов: [радиус фасада, смотрит внутрь(+1)/наружу(-1), макс. глубина]
const ROWS = [[17.2, 1, 7.9], [29, 1, 11.4], [44.2, 1, 6.5]];
const SPECIAL = { military: 'arena', culture: 'hall', home: 'tavern' };

export function buildCamp(fk, FAC, opts = {}) {
  const built = opts.built || [], lots = [];
  const P = BIOME[fk], F = FAC[fk], group = new THREE.Group(), pick = [], labels = [], lights = [], anim = { fires: [], flags: [] }, R = rnd(fk.length * 977 + 13);
  const mats = { body: new THREE.MeshLambertMaterial({ vertexColors: true }), wall: new THREE.MeshLambertMaterial({ color: 0xffffff }), roof: new THREE.MeshLambertMaterial({ color: 0xffffff }), glass: new THREE.MeshBasicMaterial({ color: P.glass }) };
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  // --- земля ---
  (() => { const G = 240, c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), k = 1024 / G, P2 = (x, z) => [(x + G / 2) * k, (z + G / 2) * k], [cx, cy] = P2(0, 0);
    g.fillStyle = P.ground; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 5000; i++) { g.fillStyle = R() < .5 ? P.ground2 + '88' : '#ffffff22'; g.beginPath(); g.arc(R() * 1024, R() * 1024, 1 + R() * 5, 0, 7); g.fill(); }
    // поля за стеной в аграрной стороне
    for (let i = 0; i < 9; i++) { const a = 4 * SECT + (i / 9) * SECT * 1.6 - SECT * .3, r = 64 + (i % 3) * 9; g.save(); g.translate(...P2(WX(a) * r, WZ(a) * r)); g.rotate(-a); g.fillStyle = ['#c8a848', '#8aa040', '#b08848'][i % 3]; g.fillRect(-5 * k, -3.5 * k, 10 * k, 7 * k); g.strokeStyle = '#00000022'; g.lineWidth = 2; for (let j = -3; j <= 3; j++) { g.beginPath(); g.moveTo(-5 * k, j * k); g.lineTo(5 * k, j * k); g.stroke(); } g.restore(); }
    const tints = ['#ffffff', '#ff6040', '#806040', '#a060ff', '#80c040', '#ffc040', '#40a0ff', '#ff80c0'];
    for (let s = 0; s < 8; s++) { g.fillStyle = tints[s] + '18'; g.beginPath(); g.arc(cx, cy, OUT_WALL * k, Math.PI / 2 - (s + 1) * SECT, Math.PI / 2 - s * SECT); g.arc(cx, cy, IN_WALL * k, Math.PI / 2 - s * SECT, Math.PI / 2 - (s + 1) * SECT, true); g.fill(); }
    g.strokeStyle = P.paving; g.lineCap = 'round';
    g.lineWidth = ROAD * 2 * k; for (let s = 0; s < 8; s++) { g.beginPath(); g.moveTo(...P2(WX(s * SECT) * 6, WZ(s * SECT) * 6)); g.lineTo(...P2(WX(s * SECT) * (OUT_WALL + 14), WZ(s * SECT) * (OUT_WALL + 14))); g.stroke(); }
    for (const r of RINGS.slice(1)) { g.lineWidth = ROAD * 2 * k; g.beginPath(); g.arc(cx, cy, r * k, 0, 7); g.stroke(); }
    g.fillStyle = P.paving; g.beginPath(); g.arc(cx, cy, IN_WALL * k, 0, 7); g.fill(); g.strokeStyle = '#00000018'; g.lineWidth = 2; for (let r = 2; r < IN_WALL; r += 1.6) { g.beginPath(); g.arc(cx, cy, r * k, 0, 7); g.stroke(); }
    g.strokeStyle = P.ground2; g.lineWidth = 3 * k; g.beginPath(); g.arc(cx, cy, (OUT_WALL + 5) * k, 0, 7); g.stroke();
    if (P.lava) for (let i = 0; i < 7; i++) { const a = R() * 6.28, r = 70 + R() * 30; g.fillStyle = '#ff6a1a'; g.beginPath(); g.ellipse(...P2(WX(a) * r, WZ(a) * r), (3 + R() * 3) * k, (2 + R() * 2) * k, a, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(G, G), new THREE.MeshLambertMaterial({ map: t })); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; group.add(gr);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), L(P.ground)); out.rotation.x = -Math.PI / 2; out.position.y = -.04; group.add(out); })();

  // --- дома по районам ---
  const slots = {}, trees = [], lamps = [], push = (kind, h) => (slots[kind] = slots[kind] || []).push(h);
  const specialAt = {};
  DISTRICTS.forEach(([dk, dname], s) => {
    const mix = MIX[dk], tot = mix.reduce((a, [, w]) => a + w, 0), mid = (s + .5) * SECT;
    ROWS.forEach(([rf, dir, maxD], ri) => {
      const pad = (ROAD + .6) / rf, a0 = s * SECT + pad, a1 = (s + 1) * SECT - pad, arc = (a1 - a0) * rf;
      if (ri === 1 && SPECIAL[dk]) { specialAt[SPECIAL[dk]] = { a: mid, r: rf + 6.4 * dir, dist: dname, s }; for (const a of [a0 + 1.6 / rf, a1 - 1.6 / rf]) trees.push([WX(a) * (rf + 3), WZ(a) * (rf + 3), 1]); return; }
      if (ri === 2 && UPG_DIST[dk]) { const ks = UPG_DIST[dk], ws = ks.map(u => KINDS[UPG_KIND[u] || u].w * S + 1.4), tot2 = ws.reduce((a, b) => a + b, 0); let pos = a0 * rf + (arc - tot2) / 2;
        ks.forEach((u, j) => { const kind = built.includes(u) ? (UPG_KIND[u] || u) : 'lot', a = (pos + ws[j] / 2) / rf, rc = rf + dir * (KINDS[kind].d * S / 2 + 1.5);
          push(kind, { x: WX(a) * rc, z: WZ(a) * rc, yaw: Math.atan2(-dir * WX(a), -dir * WZ(a)), ti: R() * 5 | 0, ri: R() * 5 | 0, dist: dname, kind, upg: u });
          lots.push({ key: u, built: built.includes(u), a, s, fx: WX(a) * (rf - .6), fz: WZ(a) * (rf - .6) }); pos += ws[j]; });
        if (arc - tot2 > 3) for (const a of [a0 + .9 / rf, a1 - .9 / rf]) trees.push([WX(a) * (rf + 2.5), WZ(a) * (rf + 2.5), .9]); return; }
      let used = 0; const list = [];
      for (let tries = 0; tries < 12; tries++) { let x = R() * tot, kind = mix[0][0]; for (const [kk, w] of mix) { x -= w; if (x <= 0) { kind = kk; break; } }
        const K = KINDS[kind], w = K.w * S + 1.4, d = K.d * S + 1.5; if (d > maxD || used + w > arc) continue; list.push({ kind, w, d }); used += w; }
      let pos = a0 * rf + (arc - used) / 2; if (arc - used > 3) { trees.push([WX(a0 + .8 / rf) * (rf + dir * 2.5), WZ(a0 + .8 / rf) * (rf + dir * 2.5), .9]); trees.push([WX(a1 - .8 / rf) * (rf + dir * 2.5), WZ(a1 - .8 / rf) * (rf + dir * 2.5), .9]); }
      for (const h of list) { const a = (pos + h.w / 2) / rf, rc = rf + dir * (KINDS[h.kind].d * S / 2 + 1.5), yaw = Math.atan2(-dir * WX(a), -dir * WZ(a));
        push(h.kind, { x: WX(a) * rc, z: WZ(a) * rc, yaw, ti: R() * 5 | 0, ri: R() * 5 | 0, dist: dname, kind: h.kind }); pos += h.w; }
    });
    labels.push({ t: dname, p: [WX(mid) * 22, 7, WZ(mid) * 22], c: 'd' });
    for (const r of (built.includes('lanterns') ? [19, 24, 33, 38, 47, 51] : [19, 24])) for (const sd of [-1, 1]) { const a = s * SECT + sd * (ROAD + .5) / r; lamps.push([WX(a) * r, WZ(a) * r]); }
  });
  const v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0), cc = new THREE.Color();
  for (const kind of Object.keys(slots)) { const list = slots[kind], parts = kindGeo(fk, kind);
    for (const p of PARTS) { const g = parts[p]; if (!g) continue; const im = new THREE.InstancedMesh(g, mats[p], list.length);
      list.forEach((h, i) => { im.setMatrixAt(i, m4.compose(v.set(h.x, 0, h.z), q.setFromAxisAngle(Y, h.yaw), sc.setScalar(S))); if (p === 'wall') im.setColorAt(i, cc.set(P.walls[h.ti])); if (p === 'roof') im.setColorAt(i, cc.set(P.roofs[h.ri])); });
      im.castShadow = p !== 'glass'; im.receiveShadow = true; im.userData.list = list; group.add(im); pick.push(im); } }

  // --- особые постройки ---
  const special = (key, kit, wallC, roofC, title, extra) => { const s = specialAt[key]; if (!s) return; const g = kit ? kitGroup(kit, mats, wallC, roofC) : new THREE.Group();
    if (kit) g.scale.setScalar(S); if (extra) extra(g); g.position.set(WX(s.a) * s.r, 0, WZ(s.a) * s.r); g.rotation.y = Math.atan2(-WX(s.a), -WZ(s.a)); g.userData.info = key; group.add(g); pick.push(g);
    labels.push({ t: title, p: [g.position.x, kit ? 9 : 6, g.position.z], c: 'b' }); };
  special('tavern', tavernKit(P), P.walls[0], P.roofs[1], '🍺 Таверна', g => sign(g, '🍺 ТАВЕРНА', 5.2, 4.25, 5));
  special('hall', hallKit(P), P.walls[2], P.roofs[3], '📷 Ратуша', g => sign(g, '📷 РАТУША', 5.9, 6.3, 4.4));
  special('arena', null, 0, 0, '⚔️ Арена', g => { g.scale.setScalar(.88); const wall = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.9, 2.8, 24, 1, true), new THREE.MeshLambertMaterial({ color: P.stone, side: THREE.DoubleSide })); wall.position.y = 1.4; wall.castShadow = true; g.add(wall);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(6.4, 24).rotateX(-Math.PI / 2), L('#b89a70')); fl.position.y = .05; fl.receiveShadow = true; g.add(fl);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; if (i % 2) { const b = new THREE.Mesh(B(.8, .7, .8), L(P.stone)); b.position.set(Math.cos(a) * 6.7, 3.1, Math.sin(a) * 6.7); b.castShadow = true; g.add(b); } }
    for (let r = 0; r < 3; r++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(6.4 - r * .9, 6.4 - r * .9, .5, 24, 1, true, Math.PI * .15, Math.PI * 1.7), new THREE.MeshLambertMaterial({ color: P.plank, side: THREE.DoubleSide })); st.position.y = .4 + r * .55; st.rotation.y = Math.PI; g.add(st); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3.4, 6), L('#5a3a22')); pole.position.set(Math.cos(a) * 6.7, 4.8, Math.sin(a) * 6.7); g.add(pole);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1, 6, 2).translate(.7, 0, 0), new THREE.MeshLambertMaterial({ map: flagTex(F), side: THREE.DoubleSide })); f.position.set(Math.cos(a) * 6.7 + .07, 5.9, Math.sin(a) * 6.7); g.add(f); anim.flags.push(f); }
    for (const x of [-1.2, 1.2]) { const p = new THREE.Mesh(B(.6, 3.6, .6), L(P.dark)); p.position.set(x, 1.8, 6.8); p.castShadow = true; g.add(p); } sign(g, '⚔️ АРЕНА', 3.9, 7.15, 3.6); });

  // --- цитадель в центре ---
  const keep = kitGroup(keepKit(P), mats, '#fff', F.color); keep.scale.setScalar(S); keep.userData.info = 'keep'; group.add(keep); pick.push(keep); labels.push({ t: '🏰 Цитадель', p: [0, 13, 0], c: 'b' });
  const big = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6, 10, 2).translate(1.8, 0, 0), new THREE.MeshLambertMaterial({ map: flagTex(F), side: THREE.DoubleSide })); big.position.set(.06, 11.4, 0); group.add(big); anim.flags.push(big);
  for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2, ban = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), new THREE.MeshLambertMaterial({ map: flagTex(F) })); ban.position.set(WX(a) * 3.47, 4.6, WZ(a) * 3.47); ban.rotation.y = a; group.add(ban); }
  // доска объявлений и костёр на площади
  (() => { const a = SECT * .5, g = new THREE.Group(); for (const sx of [-1.1, 1.1]) { const p = new THREE.Mesh(B(.18, 2.2, .18), L(P.timber)); p.position.set(sx, 1.1, 0); p.castShadow = true; g.add(p); }
    const bd = new THREE.Mesh(B(2.6, 1.6, .14), L(P.wood)); bd.position.y = 1.5; bd.castShadow = true; g.add(bd); for (let i = 0; i < 6; i++) { const n = new THREE.Mesh(B(.6, .45, .02), L('#f4eee0')); n.position.set(-.8 + (i % 3) * .8, 1.75 - Math.floor(i / 3) * .6, .09); g.add(n); }
    const rf = new THREE.Mesh(new THREE.ConeGeometry(1.9, .6, 4).rotateY(Math.PI / 4), L(P.roofs[0])); rf.position.y = 2.5; g.add(rf); sign(g, '📜 ДОСКА', 2.95, .1, 2); g.position.set(WX(a) * 10.4, 0, WZ(a) * 10.4); g.rotation.y = Math.atan2(-WX(a), -WZ(a)); g.userData.info = 'board'; group.add(g); pick.push(g); labels.push({ t: '📜 Доска', p: [g.position.x, 4.2, g.position.z], c: 'b' }); })();
  for (const a of [SECT * 2.5, SECT * 6.5]) { const fx = WX(a) * 10.2, fz = WZ(a) * 10.2; for (let i = 0; i < 7; i++) add(new THREE.Mesh(new THREE.DodecahedronGeometry(.2), L('#6e6a70')), fx + Math.cos(i) * .55, .1, fz + Math.sin(i) * .55);
    const f = new THREE.Mesh(new THREE.ConeGeometry(.35, 1, 7), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); f.position.set(fx, .5, fz); group.add(f); anim.fires.push(f); const l = new THREE.PointLight(0xff8a30, 5, 9, 1.6); l.position.set(fx, 1.2, fz); group.add(l); }

  // --- стены с башнями ---
  (() => { const seg = [], crenel = [], towers = [];
    const ring = (R0, h, th, ts, every) => { const n = Math.round(R0 * 2 * Math.PI / 1.4); for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2, gap = Math.abs(((a + SECT / 2) % SECT) - SECT / 2) * R0; if (gap < ROAD + .9) continue; seg.push([a, R0, h, th, 1.45]); if (i % 2) crenel.push([a, R0, h, th]); }
      for (let s = 0; s < 8; s += every) for (const sd of [-1, 1]) { const a = s * SECT + sd * (ROAD + .6 + ts) / R0; towers.push([WX(a) * R0, WZ(a) * R0, h, ts]); } };
    const stoneW = built.includes('stone_walls'); ring(IN_WALL, 2.4, 1, .7, 2); if (stoneW) { ring(OUT_WALL, 3.6, 1.4, 1.25, 1); for (let s = 0; s < 8; s++) { const a = (s + .5) * SECT; towers.push([WX(a) * OUT_WALL, WZ(a) * OUT_WALL, 3.6, 1.25]); } }
    else { const st = [], gt = [], n = Math.round(OUT_WALL * 2 * Math.PI / .5); for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2; if (Math.abs(((a + SECT / 2) % SECT) - SECT / 2) * OUT_WALL < ROAD + .9) continue; st.push([a, 2.6 + (i % 3) * .25]); }
      for (let s = 0; s < 8; s++) for (const sd of [-1, 1]) { const a = s * SECT + sd * (ROAD + 1.4) / OUT_WALL; gt.push([WX(a) * OUT_WALL, WZ(a) * OUT_WALL]); }
      const wood = L('#7a5634'), im = new THREE.InstancedMesh(new THREE.CylinderGeometry(.24, .26, 1, 6).translate(0, .5, 0), wood, st.length), tip = new THREE.InstancedMesh(new THREE.ConeGeometry(.25, .6, 6).translate(0, .3, 0), wood, st.length);
      st.forEach(([a, h], i) => { im.setMatrixAt(i, m4.compose(v.set(WX(a) * OUT_WALL, 0, WZ(a) * OUT_WALL), q.identity(), sc.set(1, h, 1))); tip.setMatrixAt(i, m4.compose(v.set(WX(a) * OUT_WALL, h, WZ(a) * OUT_WALL), q, sc.setScalar(1))); }); im.castShadow = tip.castShadow = true; group.add(im, tip);
      const leg = new THREE.InstancedMesh(B(.22, 4.6, .22).translate(0, 2.3, 0), L(P.timber), gt.length * 4), plat = new THREE.InstancedMesh(B(2.2, .25, 2.2), L(P.plank), gt.length), rf = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 1.2, 4).rotateY(Math.PI / 4).translate(0, .6, 0), L(F.color), gt.length);
      gt.forEach(([x, z], i) => { [[-.9, -.9], [.9, -.9], [-.9, .9], [.9, .9]].forEach(([dx, dz], j) => leg.setMatrixAt(i * 4 + j, m4.compose(v.set(x + dx, 0, z + dz), q.identity(), sc.setScalar(1)))); plat.setMatrixAt(i, m4.compose(v.set(x, 4, z), q, sc)); rf.setMatrixAt(i, m4.compose(v.set(x, 5.6, z), q, sc)); });
      for (const m of [leg, plat, rf]) { m.castShadow = true; group.add(m); } }
    const mk = (geo, mat, list, f) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((e, i) => { f(e); im.setMatrixAt(i, m4.compose(v, q, sc)); }); im.castShadow = true; im.receiveShadow = true; group.add(im); };
    const stone = L(P.stone), dark = L(P.dark);
    mk(B(1, 1, 1).translate(0, .5, 0), stone, seg, ([a, r, h, th, l]) => { v.set(WX(a) * r, 0, WZ(a) * r); q.setFromAxisAngle(Y, a); sc.set(l, h, th); });
    mk(B(.7, .6, 1).translate(0, .3, 0), stone, crenel, ([a, r, h, th]) => { v.set(WX(a) * r, h, WZ(a) * r); q.setFromAxisAngle(Y, a); sc.set(1, 1, th); });
    mk(new THREE.CylinderGeometry(1, 1.1, 1, 10).translate(0, .5, 0), stone, towers, ([x, z, h, ts]) => { v.set(x, 0, z); q.identity(); sc.set(ts, h + 2.2 * ts, ts); });
    mk(new THREE.CylinderGeometry(1.2, 1.2, .4, 10), dark, towers, ([x, z, h, ts]) => { v.set(x, h + 2.2 * ts + .2, z); q.identity(); sc.set(ts * .96, 1, ts * .96); });
    mk(new THREE.ConeGeometry(1.5, 2.2, 10).translate(0, 1.1, 0), L(F.color), towers, ([x, z, h, ts]) => { v.set(x, h + 2.2 * ts + .4, z); q.identity(); sc.setScalar(ts * .8); });
  })();

  // --- деревья, фонари, камни ---
  (() => { const R2 = rnd(fk.length * 31 + 7); for (let i = 0; i < 340; i++) { const a = R2() * 6.28, r = OUT_WALL + 9 + R2() * 50; if (Math.abs(((a + SECT / 2) % SECT) - SECT / 2) * r < 4) continue; if (Math.floor(a / SECT) === 4 && r < 90) continue; trees.push([WX(a) * r, WZ(a) * r, .9 + R2() * .7]); }
    const ty = P.tree, parts = ty === 'round' || ty === 'shadow'
      ? [[new THREE.CylinderGeometry(.18, .26, 1.8, 6).translate(0, .9, 0), ty === 'shadow' ? '#3a2e40' : '#5a3e28'], [ICO(1.3).translate(0, 2.6, 0), P.leaf], [ICO(.9).translate(.5, 3.4, -.3), ty === 'shadow' ? '#8a5ab0' : '#8aac44']]
      : [[new THREE.CylinderGeometry(.18, .26, 1.2, 6).translate(0, .6, 0), '#5a3a22'], [new THREE.ConeGeometry(1.4, 2.6, 7).translate(0, 2.2, 0), ty === 'pine' ? '#3e5a2c' : '#24543f'], [new THREE.ConeGeometry(1, 2, 7).translate(0, 3.5, 0), ty === 'pine' ? '#4a6a34' : '#2a6048']]
        .concat(ty === 'snowpine' ? [[new THREE.ConeGeometry(.6, .9, 7).translate(0, 4.3, 0), '#f4f8fc']] : []);
    for (const [geo, col] of parts) { const im = new THREE.InstancedMesh(geo, L(col), trees.length); trees.forEach(([x, z, s], i) => im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(Y, x * 7 + z), sc.setScalar(s)))); im.castShadow = true; group.add(im); }
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .08, 2.6, 6).translate(0, 1.3, 0), L('#2a2a30'), lamps.length), lan = new THREE.InstancedMesh(B(.32, .4, .32), new THREE.MeshBasicMaterial({ color: '#ffd27a' }), lamps.length);
    lamps.forEach(([x, z], i) => { post.setMatrixAt(i, m4.compose(v.set(x, 0, z), q.identity(), sc.setScalar(1))); lan.setMatrixAt(i, m4.compose(v.set(x, 2.75, z), q, sc)); }); group.add(post, lan);
    const rocks = []; for (let i = 0; i < 60; i++) { const a = R2() * 6.28, r = OUT_WALL + 6 + R2() * 55; rocks.push([WX(a) * r, WZ(a) * r, .5 + R2() * 1.4]); }
    const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), L(P.lava ? '#3a3230' : P.stone), rocks.length); rocks.forEach(([x, z, s], i) => rk.setMatrixAt(i, m4.compose(v.set(x, s * .3, z), q.setFromAxisAngle(Y, x), sc.set(s, s * .7, s)))); rk.castShadow = true; group.add(rk);
  })();

  if (built.includes('banners')) { const spots = []; for (let s = 0; s < 8; s++) { for (const sd of [-1, 1]) { const a = s * SECT + sd * (ROAD + .4) / (OUT_WALL - 2); spots.push([WX(a) * (OUT_WALL - 2), WZ(a) * (OUT_WALL - 2), 5]); } const a = (s + .5) * SECT; spots.push([WX(a) * 11.6, WZ(a) * 11.6, 4.2]); }
    const tex = flagTex(F); for (const [x, z, h] of spots) { add(new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, h, 6), L('#5a3a22')), x, h / 2, z); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .9, 6, 2).translate(.6, 0, 0), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); f.position.set(x, h - .55, z); f.rotation.y = Math.atan2(x, z) + Math.PI / 2; group.add(f); anim.flags.push(f); } }
  if (built.includes('statue')) { const a = SECT * 4.5, x = WX(a) * 10, z = WZ(a) * 10, g = new THREE.Group(); const ped = new THREE.Mesh(B(2, 1.6, 2), L(P.dark)); ped.position.y = .8; ped.castShadow = true; g.add(ped); const top = new THREE.Mesh(B(2.3, .25, 2.3), L(P.stone)); top.position.y = 1.7; g.add(top);
    const [gn, gt] = soldierGeo('warrior'), stM = new THREE.MeshLambertMaterial({ color: P.stone === '#7d6f63' ? '#b8a890' : '#d8d4cc' }); for (const geo of [gn, gt]) { const m = new THREE.Mesh(geo, stM); m.scale.setScalar(2.4); m.position.y = 1.8; m.castShadow = true; g.add(m); }
    g.position.set(x, 0, z); g.rotation.y = Math.atan2(x, z); g.userData.info = 'statue'; group.add(g); pick.push(g); labels.push({ t: '🗿 Статуя героя', p: [x, 6, z], c: 'b' }); }
  // --- улицы для жителей: кольца × лучи ---
  const node = (ri, k) => { const a = k * SECT, r = RINGS[ri]; return [WX(a) * r, WZ(a) * r]; };
  return { group, pick, labels, anim, biome: P, node, rings: RINGS.length, sect: SECT, lots };
}
export { KIND_LIST };

// ---------- лагерь на старте: поляна с одним костром ----------
export function buildFireCamp(fk, FAC) {
  const P = BIOME[fk], F = FAC[fk], group = new THREE.Group(), pick = [], labels = [], anim = { fires: [], flags: [], sparks: [] }, R = rnd(fk.length * 131 + 5);
  const L = c => new THREE.MeshLambertMaterial({ color: c }), m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const add = (m, x, y, z, p = group) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
  (() => { const G = 160, c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), k = 1024 / G, cx = 512;
    g.fillStyle = P.ground; g.fillRect(0, 0, 1024, 1024); for (let i = 0; i < 4000; i++) { g.fillStyle = R() < .5 ? P.ground2 + '88' : '#ffffff1a'; g.beginPath(); g.arc(R() * 1024, R() * 1024, 1 + R() * 5, 0, 7); g.fill(); }
    const gr = g.createRadialGradient(cx, cx, 0, cx, cx, 26 * k); gr.addColorStop(0, '#5a4a38'); gr.addColorStop(.25, '#7a6a52'); gr.addColorStop(.75, P.paving + 'aa'); gr.addColorStop(1, P.paving + '00'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cx, 26 * k, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; g.strokeStyle = P.paving + '99'; g.lineWidth = 2.4 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + Math.cos(a) * 20 * k, cx + Math.sin(a) * 20 * k); g.quadraticCurveTo(cx + Math.cos(a + .3) * 45 * k, cx + Math.sin(a + .3) * 45 * k, cx + Math.cos(a + .2) * 80 * k, cx + Math.sin(a + .2) * 80 * k); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(G, G), new THREE.MeshLambertMaterial({ map: t })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; group.add(m);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), L(P.ground)); out.rotation.x = -Math.PI / 2; out.position.y = -.04; group.add(out); })();
  // костёр
  const fire = new THREE.Group(); fire.userData.info = 'fire';
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; add(new THREE.Mesh(new THREE.DodecahedronGeometry(.42), L(i % 2 ? '#7a7470' : '#8e8880')), Math.cos(a) * 1.7, .2, Math.sin(a) * 1.7, fire); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, lg = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, 2.4, 7), L('#5a3a22')); lg.position.set(Math.cos(a) * .45, .75, Math.sin(a) * .45); lg.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .7); lg.castShadow = true; fire.add(lg); }
  add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, .12, 12), new THREE.MeshBasicMaterial({ color: '#ff5a1a' })), 0, .08, 0, fire);
  [[1, 2.6, '#ff6a1a', 0], [.7, 2, '#ffa52a', .1], [.4, 1.3, '#ffe27a', .2]].forEach(([r, h, c, y]) => { for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(r * (1 - i * .15), h * (1 - i * .1), 7), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .92 })); f.position.set((i - 1) * r * .35, h / 2 + .2 + y, (i % 2 - .5) * r * .3); fire.add(f); anim.fires.push(f); } });
  const glow = new THREE.PointLight(0xff8a30, 60, 30, 1.6); glow.position.y = 2.5; fire.add(glow); anim.glow = glow;
  const sp = new THREE.InstancedMesh(new THREE.BoxGeometry(.08, .08, .08), new THREE.MeshBasicMaterial({ color: '#ffd27a' }), 40); sp.frustumCulled = false; fire.add(sp); anim.sparkMesh = sp;
  for (let i = 0; i < 40; i++) anim.sparks.push({ a: R() * 6.28, r: R() * .8, y: R() * 6, s: .8 + R() * 1.4 });
  group.add(fire); pick.push(fire); labels.push({ t: '🔥 Костёр знамени', p: [0, 4.6, 0], c: 'b' });
  // брёвна-скамьи вокруг
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + .3, lg = new THREE.Mesh(new THREE.CylinderGeometry(.32, .34, 2.4, 9), L(i % 2 ? '#7a5634' : '#6a4a2c')); lg.rotation.z = Math.PI / 2; lg.rotation.y = -a + Math.PI / 2; lg.position.set(Math.cos(a) * 3.6, .32, Math.sin(a) * 3.6); lg.castShadow = true; group.add(lg); }
  // знамя у костра
  add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 6.5, 7), L('#5a3a22')), 6.5, 3.25, -5);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8, 10, 2).translate(1.2, 0, 0), new THREE.MeshLambertMaterial({ map: flagTex(F), side: THREE.DoubleSide })); fl.position.set(6.6, 5.6, -5); group.add(fl); anim.flags.push(fl);
  // мелочи: котелок, дрова, бочка, мешки
  const pot = new THREE.Group(); for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.2, 5), L('#3a2a1a')); st.position.set(s * 1.1, 1, 0); st.rotation.z = s * .15; pot.add(st); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.4, 5), L('#3a2a1a')); bar.rotation.z = Math.PI / 2; bar.position.y = 2.05; pot.add(bar); const kettle = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8, 0, 6.29, 0, 2), L('#2a2a30')); kettle.position.y = 1.3; pot.add(kettle); pot.rotation.y = .6; group.add(pot);
  for (let i = 0; i < 8; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 1.4, 7), L('#8a6a44')), -7 + (i % 4) * .38, .18 + Math.floor(i / 4) * .32, 5.5).rotation.x = Math.PI / 2;
  add(new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 1.1, 10), L('#6a4a2c')), -6, .55, -6); for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), L('#c9b48a')), -4.8 + i * .5, .35, -6.8).scale.set(1, .8, 1.2);
  // лес вокруг поляны
  (() => { const trees = []; for (let i = 0; i < 260; i++) { const a = R() * 6.28, r = 26 + R() * 50; trees.push([Math.cos(a) * r, Math.sin(a) * r, .9 + R() * .8]); }
    const ty = P.tree, parts = ty === 'round' || ty === 'shadow'
      ? [[new THREE.CylinderGeometry(.18, .26, 1.8, 6).translate(0, .9, 0), ty === 'shadow' ? '#3a2e40' : '#5a3e28'], [ICO(1.3).translate(0, 2.6, 0), P.leaf], [ICO(.9).translate(.5, 3.4, -.3), ty === 'shadow' ? '#8a5ab0' : '#8aac44']]
      : [[new THREE.CylinderGeometry(.18, .26, 1.2, 6).translate(0, .6, 0), '#5a3a22'], [new THREE.ConeGeometry(1.4, 2.6, 7).translate(0, 2.2, 0), ty === 'pine' ? '#3e5a2c' : '#24543f'], [new THREE.ConeGeometry(1, 2, 7).translate(0, 3.5, 0), ty === 'pine' ? '#4a6a34' : '#2a6048']].concat(ty === 'snowpine' ? [[new THREE.ConeGeometry(.6, .9, 7).translate(0, 4.3, 0), '#f4f8fc']] : []);
    for (const [geo, col] of parts) { const im = new THREE.InstancedMesh(geo, L(col), trees.length); trees.forEach(([x, z, s], i) => im.setMatrixAt(i, m4.compose(v.set(x, 0, z), q.setFromAxisAngle(Y, x * 7 + z), sc.setScalar(s)))); im.castShadow = true; group.add(im); }
    const rocks = []; for (let i = 0; i < 40; i++) { const a = R() * 6.28, r = 18 + R() * 40; rocks.push([Math.cos(a) * r, Math.sin(a) * r, .4 + R() * 1.1]); }
    const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), L(P.lava ? '#3a3230' : P.stone), rocks.length); rocks.forEach(([x, z, s], i) => rk.setMatrixAt(i, m4.compose(v.set(x, s * .3, z), q.setFromAxisAngle(Y, x), sc.set(s, s * .7, s)))); rk.castShadow = true; group.add(rk); })();
  return { group, pick, labels, anim, biome: P, lots: [], fire: true };
}
