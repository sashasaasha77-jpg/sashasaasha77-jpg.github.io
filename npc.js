// NPC королевства: внешность, места, анимации, диалоги, новости, подсказки по ролям, выдача и сдача заданий.
let SV = null; // общий вектор для проекции подписей
import { G, act, npcInfo, qcard, shopSheet } from './rpg-ui.js';
import { npcExtras } from './resursy.js';
import { ITEMS } from './quests.mjs';
import { NPC } from './quests.mjs';
let W, K, THREE, api;
const NPCS = [];
const near = { npc: null };

const LOOKS = {
  rasporyaditel: { id: 'sovetnik', roof: 0x4B2A7B, tier: 'epic' },
  torgovets: { id: 'torgovets', roof: 0xB8860B, tier: 'common' },
  kuznets: { id: 'kuznets', roof: 0x5E5A55, tier: 'common' },
  traktirshchik: { id: 'zhitel', roof: 0x8A5A32, tier: 'common' },
  khranitel: { id: 'luchnik', roof: 0x2F6B3A, tier: 'rare' },
  mag: { id: 'mag', roof: 0x3A2470, tier: 'rare' },
};

// места: кольцо площади вокруг стен замка и мост
function places() {
  const rz = W.riverZ(0);
  return {
    rasporyaditel: { x: -2.3, z: 9.6, face: 0, patrol: [[-2.3, 9.6], [-3.6, 9.75]] },
    torgovets: { x: 8.4, z: 4.2, face: Math.PI / 2, prop: 'stall' },
    kuznets: { x: -8.4, z: -3.2, face: -Math.PI / 2, prop: 'anvil' },
    traktirshchik: { x: -8.4, z: 3.6, face: -Math.PI / 2, prop: 'tavern' },
    mag: { x: 8.4, z: -4.0, face: Math.PI / 2, prop: 'crystal' },
    khranitel: { x: -12.6, z: -12.6, face: Math.PI / 4, prop: 'stump' },   // сад Хранителя во дворе крепости
  };
}

const NAMES = {
  rasporyaditel: ['Распорядитель замка', 'Бертрам'], torgovets: ['Торговец', 'Лавр'], kuznets: ['Кузнец', 'Гордей'],
  traktirshchik: ['Трактирщик', 'Мартын'], khranitel: ['Хранитель леса', 'Ольха'], mag: ['Придворный маг', 'Эльдар'],
};

// подсказки для каждой из 11 ролей
const ROLE_TIPS = {
  zhitel: 'Ты житель, сердце королевства. Загляни в сундук дня: там монеты, а каждый новый сосед делает королевство больше.',
  torgovets: 'Ты торговец. Когда откроется лавка, твои сделки будут выгоднее, чем у прочих. А пока копи монеты: открывай сундук дня и выполняй задания.',
  kuznets: 'Ты кузнец. Скоро в моей кузнице можно будет ковать оружие и чинить ворота во время осады. Готовь руки!',
  strazhnik: 'Ты стражник. Ворота замка — твой пост. Тренируйся на учебном плацу, чтобы набить руку перед настоящей осадой.',
  luchnik: 'Ты лучник. С башен видно всё королевство. Пройдись по окраинам: за рекой лес, туда скоро будут ходить в дозор.',
  alkhimik: 'Ты алхимик. Зелья лечения пригодятся, когда придёт Чёрный Орден. Заходи к магу Эльдару, он многое знает о травах.',
  rytsar: 'Ты рыцарь, щит королевства. Чёрный Орден собирает силы за северной крепостью. Держи меч наготове.',
  mag: 'Ты маг. Фейерверки над площадью — это твоё. А ещё магия пригодится, чтобы ломать осадные машины врага.',
  sovetnik: 'Ты советник. Король ценит мудрых. Загляни в хронику: там всё, что происходило с королевством.',
  graf: 'Ты граф, владелец края. Помогай казне: каждая монета в стройку делает королевство сильнее.',
  gertsog: 'Ты герцог, второй после короля. От тебя ждут примера: вкладывайся в казну и собирай отряд, когда придёт время.',
  korol: 'Ваше величество! Королевство ждёт ваших указов. Загляните на стройки во дворе и в «👑 Указы» — там объявляют вторжения и события.',
};

const LINES = {
  rasporyaditel: { hi: 'Добро пожаловать к замку! Король в добром здравии и рад каждому подданному.', about: 'Я слежу за порядком у ворот и знаю всё, что творится в королевстве.' },
  torgovets: { hi: 'Подходи, подходи! Ткани, специи, подковы, всё самое лучшее!', about: 'Лавка скоро откроется по-настоящему: можно будет покупать и продавать снаряжение за монеты.' },
  kuznets: { hi: 'Осторожно, искры! Хороший меч куётся не спеша.', about: 'Мечи, подковы, засовы для ворот: всё отсюда. Скоро буду ковать снаряжение для героев.' },
  traktirshchik: { hi: 'Заходи, грейся! В «Золотой подкове» всегда тепло и всегда есть новости.', about: 'В таверне собираются отряды. Здесь же будут объявлять общие задания.' },
  khranitel: { hi: 'Тише... лес слушает. Ты пришёл с миром?', about: 'Я берегу королевский лес за рекой. Говорят, по ночам у северной крепости горят чужие костры.' },
  mag: { hi: 'Звёзды предсказали твой приход. Ну, или почти предсказали.', about: 'Я изучаю древние артефакты. Один из них, говорят, спрятан где-то в королевстве.' },
};

function news() {
  const n = K.residents.filter(p => p.status !== 'ruins').length, ch = (K.chronicle || []).slice(-3).reverse();
  let t = n ? `В королевстве ${K.fmt(n)} ${K.plural(n, 'подданный', 'подданных', 'подданных')}. ` : 'Подданных пока нет, король ждёт первых жителей. ';
  t += ch.length ? 'Последнее в хронике: ' + ch.map(e => e.text).join(' ') : 'Хроника пока пуста.';
  return t;
}

function propMesh(kind, g) {
  const box = (w, h, d, c, p, ol = 1.5) => W.mesh(g, new THREE.BoxGeometry(w, h, d), c, { pos: p, ol });
  if (kind === 'stall') { box(1.4, 0.7, 0.6, 0x7A4A2A, [0, 0.35, 0.75]); for (const sx of [-0.65, 0.65]) box(0.08, 1.5, 0.08, 0x5A3A22, [sx, 0.75, 1.0]);
    W.mesh(g, new THREE.BoxGeometry(1.6, 0.06, 0.9), 0xA4161A, { pos: [0, 1.5, 0.85], rot: [0.25, 0, 0], ol: 1.5 }); box(0.25, 0.2, 0.25, 0xE8B931, [-0.35, 0.8, 0.75], 1); box(0.25, 0.25, 0.25, 0x5C8A3A, [0.3, 0.82, 0.75], 1); }
  if (kind === 'anvil') { box(0.5, 0.35, 0.3, 0x3A3A44, [0, 0.45, 0.7]); box(0.3, 0.3, 0.25, 0x5E5A55, [0, 0.15, 0.7]); box(0.5, 0.45, 0.5, 0x5E5A55, [0.8, 0.22, 0.6]);
    W.mesh(g, new THREE.BoxGeometry(0.3, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: 0xFF7A2A }), { pos: [0.8, 0.48, 0.6], ol: 0 }); }
  if (kind === 'tavern') { for (const [x, z] of [[0.55, 0.6], [-0.55, 0.65]]) W.mesh(g, new THREE.CylinderGeometry(0.28, 0.25, 0.6, 10), 0x7A4A2A, { pos: [x, 0.3, z], ol: 1.5 });
    box(0.08, 1.8, 0.08, 0x4E3020, [0, 0.9, 1.0]); box(0.7, 0.45, 0.06, 0xE8B931, [0, 1.55, 1.0]); }
  if (kind === 'crystal') { W.mesh(g, new THREE.CylinderGeometry(0.3, 0.38, 0.6, 8), 0x8C857B, { pos: [0, 0.3, 0.75], ol: 1.5 });
    const c = W.mesh(g, new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0x9FD7FF }), { pos: [0, 0.95, 0.75], ol: 1.5 }); g.userData.spin = c; }
  if (kind === 'stump') { W.mesh(g, new THREE.CylinderGeometry(0.35, 0.42, 0.45, 10), 0x6B4A2A, { pos: [0.7, 0.22, 0.4], ol: 1.5 }); }
}

function build() {
  const P = places();
  for (const id of Object.keys(LOOKS)) {
    const pl = P[id], hero = api.buildHero({ ...LOOKS[id], name: NAMES[id][0] }, NAMES[id][0]);
    const g = new THREE.Group(); g.position.set(pl.x, 0, pl.z); g.rotation.y = pl.face; W.scene.add(g); g.add(hero);
    if (pl.prop) { const pg = new THREE.Group(); g.add(pg); propMesh(pl.prop, pg); }
    const mark = W.mesh(g, new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0xE8B931 }), { pos: [0, 1.95, 0], ol: 1.5 });
    const lab = document.createElement('div'); lab.className = 'lbl npc'; lab.style.display = 'none'; W.$('labels').appendChild(lab);
    const n = { id, g, hero, mark, lab, home: { ...pl }, face: pl.face, wave: 0, t: Math.random() * 10, pat: 0 };
    NPCS.push(n);
    if (!pl.patrol) api.addObs({ x: pl.x, z: pl.z, c: 0.45, r: 0.45 });
    if (pl.prop) { const ox = Math.sin(pl.face) * 0.75, oz = Math.cos(pl.face) * 0.75; api.addObs({ x: pl.x + ox, z: pl.z + oz, c: 0.75, r: 0.75 }); }
  }
}

// ---------------- диалог ----------------
function say(n, title, text, opts) {
  const body = W.$('sheetBody'), [role, name] = NAMES[n.id];
  body.innerHTML = `<div class="npchead"><div class="npcava">${W.crest({ tier: LOOKS[n.id].tier, name: role, svg: W.ROLES.find(r => r.id === LOOKS[n.id].id).svg }, 52)}</div><div><small>${role}</small><h2>${name}</h2></div></div>
    <p class="npcsay">${text}</p><div class="npcopts">${opts.map((o, i) => `<button class="btn ${i ? 'btn-paper' : 'btn-gold'}" type="button" data-o="${i}">${o[0]}</button>`).join('')}</div>`;
  body.querySelectorAll('[data-o]').forEach(b => b.onclick = () => opts[+b.dataset.o][1]());
  W.$('sheet').classList.add('show');
}
function close() { W.$('sheetX').click(); }
function talk(n) {
  n.wave = 1.6; const L = LINES[n.id], me = api.state(), role = me.role;
  const opts = () => [
    ['Новости королевства', () => say(n, '', news(), [['Ещё вопрос', root], ['Пока!', close]])],
    ['Подсказка для меня', () => say(n, '', ROLE_TIPS[role?.id] || ROLE_TIPS.zhitel, [['Ещё вопрос', root], ['Пока!', close]])],
    ['Кто ты?', () => say(n, '', L.about, [['Ещё вопрос', root], ['Пока!', close]])],
    ['Есть задание?', offers],
    ['Пока!', close],
  ];
  const offers = () => {
    if (!G.state) return say(n, '', me.demo || (K.auth && K.auth()) ? 'Королевство не отвечает... Попробуй чуть позже.' : 'Задания даю только подданным. Войди со своим ником и PIN!', [['Ещё вопрос', root], ['Пока!', close]]);
    const inf = npcInfo(n.id);
    if (!inf.offer.length) return say(n, '', inf.locked.length ? `Пока нет. ${inf.locked.map(q => `«${q.title}» откроется на ${q.minLevel} уровне или после прошлых заданий.`).join(' ')}` : 'Сегодня для тебя ничего нет. Загляни завтра или спроси других.', [['Ещё вопрос', root], ['Пока!', close]]);
    const body = W.$('sheetBody'); say(n, '', 'Вот что есть:', [['Назад', root]]);
    body.querySelector('.npcopts').insertAdjacentHTML('beforebegin', inf.offer.map(q => qcard(q, `<button class="btn btn-gold" type="button" data-take="${q.id}">Взять задание</button>`)).join(''));
    body.querySelectorAll('[data-take]').forEach(b => b.onclick = async () => { const r = await act('take', { quest: b.dataset.take }); if (r && r.status === 200) { G.track = b.dataset.take; close(); } });
  };
  const root = () => {
    const extra = [];
    if (G.state) { const inf = npcInfo(n.id);
      for (const q of inf.turnIn) extra.push([`✅ Сдать «${q.title}»`, async () => { const r = await act('done', { quest: q.id }); if (r && r.status === 200) say(n, '', r.data.note || 'Спасибо!', [['Ещё вопрос', root], ['Пока!', close]]); }]);
      for (const q of inf.sqOffer) extra.push([`👥 Для отряда: «${q.title}»`, () => {
        say(n, '', q.text, [['Назад', root]]);
        W.$('sheetBody').querySelector('.npcopts').insertAdjacentHTML('beforebegin', `<div class="qcard"><h3>${q.title}</h3><ol>${q.stages.map(st => `<li>${st.text}</li>`).join('')}</ol><div class="rw">Каждому участнику: ${q.reward.xp} опыта, ${q.reward.coins} монет · время ${q.hours} ч</div><button class="btn btn-gold" type="button" id="sqTake">Взять для отряда</button></div>`);
        W.$('sqTake').onclick = async () => { const r = await act('sq_take', { quest: q.id }); if (r && r.status === 200) { G.track = 'squad'; close(); } }; }]);
      if (inf.sqItems) extra.push([`👥 Сдать отряду: ${ITEMS[inf.sqItems.st.item].name}`, async () => { const r = await act('sq_act', {}); if (r && r.status === 200) root(); }]);
      for (const q of inf.talk) extra.push([`💬 ${q.steps[q.step].text.replace(/^Поговори: .*$/, 'Передать весть')} («${q.title}»)`, async () => { const r = await act('step', { quest: q.id }); if (r && r.status === 200) root(); }]); }
    if (n.id === 'torgovets' && G.state) extra.push(['🛒 Лавка: купить и продать', () => shopSheet(root)]);
    extra.push(...npcExtras(n.id, root));
    say(n, '', L.hi, [...extra, ...opts()]);
  };
  root();
}

// ---------------- цикл ----------------
export function tick(now, dt) {
  const st = api.state(), on = st.on && st.pos;
  let best = null, bd = 2.2;
  for (const n of NPCS) {
    n.t += dt;
    // распорядитель прохаживается у ворот
    if (n.home.patrol && !(on && near.npc === n)) {
      const [a, b] = n.home.patrol, k = (Math.sin(n.t * 0.35) + 1) / 2, x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k;
      const dx = x - n.g.position.x, dz = z - n.g.position.z, sp = Math.hypot(dx, dz) / Math.max(dt, 1e-3);
      if (Math.hypot(dx, dz) > 1e-4) n.face = Math.atan2(dx, dz); n.g.position.set(x, 0, z); n.g.rotation.y = 0; api.animate(n.hero, n.t, Math.min(2, sp));
    } else api.animate(n.hero, n.t, 0);
    if (on) { const d = Math.hypot(st.pos.x - n.g.position.x, st.pos.z - n.g.position.z); if (d < bd) { bd = d; best = n; }
      if (d < 4) n.face = Math.atan2(st.pos.x - n.g.position.x, st.pos.z - n.g.position.z); }
    const want = n.face - n.g.rotation.y; let df = want - n.hero.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); n.hero.rotation.y += df * Math.min(1, dt * 6);
    if (n.wave > 0) { n.wave -= dt; n.hero.userData.armL.rotation.x = -2.6 + Math.sin(n.t * 12) * 0.35; }
    n.mark.rotation.y = n.t * 2; n.mark.position.y = 1.95 + Math.sin(n.t * 3) * 0.06;
    if (n.g.userData.spin) n.g.userData.spin.rotation.y = n.t;
    for (const ch of n.g.children) if (ch.userData.spin) ch.userData.spin.rotation.y = n.t * 1.5;
    // подписи NPC рядом с героем
    if (on && Math.hypot(st.pos.x - n.g.position.x, st.pos.z - n.g.position.z) < 12) {
      const p = (SV || (SV = new THREE.Vector3())).set(n.g.position.x, 2.25, n.g.position.z).project(W.camera);
      if (p.z < 1) { n.lab.style.display = 'block'; n.lab.textContent = NAMES[n.id][0]; n.lab.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; n.lab.style.top = ((1 - p.y) / 2 * innerHeight) + 'px'; } else n.lab.style.display = 'none';
    } else n.lab.style.display = 'none';
  }
  if (best !== near.npc) { near.npc = best; const t = W.$('talk'); if (best) { t.textContent = `💬 Говорить: ${NAMES[best.id][0]}`; t.hidden = false; } else t.hidden = true; }
  if (!on && !W.$('talk').hidden) W.$('talk').hidden = true;
}

export function marks() {
  for (const n of NPCS) { const m = n.mark.material;
    if (!G.state) { m.color.setHex(0xE8B931); n.mark.visible = true; continue; }
    const inf = npcInfo(n.id); n.mark.visible = !!(inf.offer.length || inf.turnIn.length || inf.talk.length || inf.sqOffer.length || inf.sqItems);
    m.color.setHex(inf.turnIn.length || inf.talk.length || inf.sqItems ? 0x7BD15A : inf.sqOffer.length && !inf.offer.length ? 0x5A9BE0 : 0xE8B931); }
}
export function initNpc(world, k, rpgApi) {
  W = world; K = k; THREE = W.THREE; api = rpgApi;
  const css = document.createElement('style'); css.textContent = `
  #talk { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); bottom: calc(max(14px, env(safe-area-inset-bottom)) + 46px); padding: 10px 16px; font-size: 15px; }
  @media (pointer: coarse) { #talk { left: auto; right: max(16px, env(safe-area-inset-right)); transform: none; bottom: calc(max(18px, env(safe-area-inset-bottom)) + 124px); max-width: calc(100% - 170px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; } } /* над чатом и правее джойстика */
  body:not(.playing) #talk, body.carded #talk { display: none; }
  .npchead { display: flex; gap: 12px; align-items: center; margin: 0 40px 10px 0; } .npchead small { color: var(--muted); font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
  #sheet .npchead h2 { margin: 0; } #sheet .npcsay { background: var(--paper); color: var(--ink); border-radius: 14px; padding: 12px 14px; font-weight: 600; position: relative; }
  .npcopts { display: grid; gap: 8px; } .npcopts .btn { width: 100%; padding: 10px; font-size: 15px; }
  .lbl.npc { background: #4B2A7B; font-size: 12px; }`;
  document.head.appendChild(css);
  const t = document.createElement('button'); t.id = 'talk'; t.className = 'btn btn-gold'; t.type = 'button'; t.hidden = true; document.body.appendChild(t);
  t.addEventListener('click', () => near.npc && talk(near.npc));
  addEventListener('keydown', e => { if (e.code === 'KeyE' && near.npc && api.state().on && !W.$('sheet').classList.contains('show')) talk(near.npc); });
  build();
}
