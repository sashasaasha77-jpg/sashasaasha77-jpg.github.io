// Куда девать ресурсы: крафт у NPC, общие стройки во дворе крепости, укрепления, украшения дома, заказ дня, передача в отряде.
// Окна открываются из диалогов NPC и кнопкой действия у стройки; стройки видны в «Мире героев» и растут по мере сдачи ресурсов.
import { G, act, openSheet } from './rpg-ui.js';
import { ITEMS, NPC, RES, RECIPES, WEAPON, BUILDS, FORT, DECOR } from './quests.mjs';

let W, K, THREE, R;
const SITES = {};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const have = it => (G.state?.inventory.find(i => i.item === it) || {}).qty || 0;
const cost = need => Object.entries(need).filter(([, n]) => n > 0).map(([k, n]) => `<span class="${have(k) >= n ? '' : 'miss'}">${ITEMS[k].icon} ${have(k)}/${n}</span>`).join(' ');
const can = need => Object.entries(need).every(([k, n]) => have(k) >= n);
const row = (icon, title, sub, btn) => `<div><span style="font-size:22px">${icon}</span><span style="flex:1"><b>${title}</b><br>${sub}</span>${btn}</div>`;
const button = (attr, label, on = true, gold = true) => `<button class="btn ${gold ? 'btn-gold' : 'btn-paper'}" type="button" ${attr} style="padding:5px 10px;font-size:13px" ${on ? '' : 'disabled'}>${label}</button>`;
const backBtn = back => back ? '<button class="btn btn-paper" type="button" data-back style="width:100%;margin-top:10px">Назад</button>' : '';
const wire = (b, back, map) => { for (const [sel, fn] of map) b.querySelectorAll(sel).forEach(x => x.onclick = () => fn(x)); const bb = b.querySelector('[data-back]'); if (bb) bb.onclick = back; };
const res = () => G.state?.res || { wlvl: 0, buffs: {}, builds: {}, fort: { pts: 0 }, decor: [], order: null };
const built = id => !!res().builds[id]?.done;
const bar = (got, need) => `<div class="xpbar" style="margin:4px 0 2px"><i style="width:${Math.min(100, 100 * got / need).toFixed(1)}%"></i></div>`;

// ---------------- окна ----------------
export function craftSheet(npc, back) {
  if (!G.state) return;
  const forge = npc === 'kuznets' && built('kuznya'), list = Object.entries(RECIPES).filter(([, r]) => r.npc === npc);
  const needOf = r => (forge && r.need.ore ? { ...r.need, ore: Math.max(0, r.need.ore - 1) } : r.need);
  const lv = res().wlvl, max = built('kuznya') ? WEAPON.max : WEAPON.maxNoForge, wc = WEAPON.cost(lv);
  openSheet(`<h2>${npc === 'mag' ? 'Зелья мага' : 'Кузня'}</h2><p class="rw">${npc === 'mag' ? 'Эльдар сварит зелье из твоих трав.' : `Гордей скуёт снаряжение из руды и брёвен.${forge ? ' Большая кузня построена — руды нужно на 1 меньше.' : ''}`}</p>
    <div class="ach res">${list.map(([id, r]) => row(ITEMS[id].icon, ITEMS[id].name, `${r.text}<br>${cost(needOf(r))} · у тебя ${have(id)}`, button(`data-craft="${id}"`, 'Сделать', can(needOf(r))))).join('')}
    ${npc === 'kuznets' ? row('⚔️', `Улучшить оружие: +${lv} → +${lv + 1}`, lv >= max ? (max < WEAPON.max ? `Больше +${max} без Большой кузни нельзя. Постройте её всем королевством!` : 'Оружие уже лучшее.') : `Атака +${WEAPON.atk}<br>${cost(wc)}`, button('data-weapon', 'Улучшить', lv < max && can(wc))) : ''}</div>${backBtn(back)}`,
    b => wire(b, back, [['[data-craft]', async x => { await act('craft', { recipe: x.dataset.craft }); craftSheet(npc, back); }], ['[data-weapon]', async () => { await act('weapon', {}); craftSheet(npc, back); }]]));
}
export function buildSheet(id, back) {
  const s = BUILDS[id], cur = res().builds[id] || { got: {}, top: {} }; if (!s || !G.state) return;
  const top = Object.entries(cur.top || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  openSheet(`<h2>🔨 Стройка: ${s.name}</h2><p class="rw">Строим всем королевством. Когда построим: <b style="color:var(--gold)">${s.bonus}</b>. За каждый сданный ресурс +1 опыта.</p>
    ${cur.done ? '<p><b>✅ Построено!</b> Бонус уже действует для всех героев.</p>' : `<div class="ach res">${Object.entries(s.need).map(([k, n]) => { const g = cur.got?.[k] || 0, left = n - g;
      return `<div style="display:block"><b>${ITEMS[k].icon} ${ITEMS[k].name}: ${g} / ${n}</b>${bar(g, n)}<span style="font-size:13px">у тебя ${have(k)}</span>
        <span style="float:right;display:flex;gap:6px">${[1, 5].map(q => button(`data-give="${k}" data-q="${q}"`, `+${q}`, left > 0 && have(k) >= 1, false)).join('')}${button(`data-give="${k}" data-q="999"`, 'Всё', left > 0 && have(k) >= 1)}</span></div>`; }).join('')}</div>`}
    ${top.length ? `<p class="rw" style="margin-top:10px">Лучшие строители: ${top.map(([n, c]) => `@${esc(n)} (${c})`).join(', ')}</p>` : ''}${backBtn(back)}`,
    b => wire(b, back, [['[data-give]', async x => { await act('build', { site: id, item: x.dataset.give, qty: +x.dataset.q }); buildSheet(id, back); }]]));
}
export function fortSheet(back) {
  if (!G.state) return; const f = res().fort || { pts: 0 }, pct = Math.round(100 * (f.pts || 0) / FORT.max), war = (G.state.world?.events || []).some(e => e.kind === 'invasion' && e.status === 'active');
  openSheet(`<h2>🏰 Укрепления</h2><p class="rw">Сдай брёвна на частокол и руду на ворота <b>до</b> вторжения Чёрного Ордена. Чем крепче стены, тем слабее осада: до −${Math.round(FORT.cut * 100)}% к силе врага. После осады укрепления строят заново.</p>
    <p><b>Готовность: ${pct}%</b> · осада будет слабее на ${Math.round(FORT.cut * pct)}%</p>${bar(f.pts || 0, FORT.max)}
    ${war ? '<p><b>Осада уже идёт — укреплять поздно. Защищай стены!</b></p>' : `<div class="ach res">${['wood', 'ore'].map(k => row(ITEMS[k].icon, ITEMS[k].name, `+${FORT.pts[k]} к укреплениям за штуку · у тебя ${have(k)}`,
      `<span style="display:flex;gap:6px">${button(`data-fort="${k}" data-q="5"`, '+5', have(k) >= 1 && pct < 100, false)}${button(`data-fort="${k}" data-q="999"`, 'Всё', have(k) >= 1 && pct < 100)}</span>`)).join('')}</div>`}${backBtn(back)}`,
    b => wire(b, back, [['[data-fort]', async x => { await act('fort', { item: x.dataset.fort, qty: +x.dataset.q }); fortSheet(back); }]]));
}
export function decorSheet(back) {
  if (!G.state) return; const mine = new Set(res().decor || []), demo = R.state().demo;
  openSheet(`<h2>🏡 Украсить мой дом</h2><p class="rw">Украшения появятся у твоего дома на карте королевства подписчиков — их увидят все.</p>
    ${demo ? '<p><b>В демо-режиме своего дома нет.</b> Войди под своим ником.</p>' : ''}
    <div class="ach res">${Object.entries(DECOR).map(([id, d]) => row(d.icon, d.name, mine.has(id) ? '✅ Уже у дома' : cost(d.need), mine.has(id) ? '' : button(`data-decor="${id}"`, 'Заказать', !demo && can(d.need)))).join('')}</div>${backBtn(back)}`,
    b => wire(b, back, [['[data-decor]', async x => { const r = await act('decor', { id: x.dataset.decor }); if (r && r.status === 200 && K.decorAdd) K.decorAdd(G.state.hero.nick, x.dataset.decor); decorSheet(back); }]]));
}
export function orderSheet(back) {
  if (!G.state) return; const r = res(), o = r.order; if (!o) return;
  openSheet(`<h2>📦 Заказ дня</h2><p class="rw">Лавр собирает товар для каравана и платит втрое больше обычной цены. Заказ один на день, завтра будет новый.</p>
    ${r.orderDone ? '<p><b>✅ Сегодняшний заказ выполнен.</b> Приходи завтра!</p>' : `<div class="qcard"><h3>Нужно</h3><p style="font-size:16px">${cost(o.need)}</p><div class="rw">Награда: 🪙 ${o.coins} монет, ${o.xp} опыта</div></div>
      <button class="btn btn-gold" type="button" data-order style="width:100%" ${can(o.need) ? '' : 'disabled'}>Сдать заказ</button>`}${backBtn(back)}`,
    b => wire(b, back, [['[data-order]', async () => { await act('order', {}); orderSheet(back); }]]));
}
// в окне героя: выпить зелье, передать ресурсы товарищу по отряду
export function heroExtras() {
  const s = G.state; if (!s) return ''; const r = res(), now = Date.now(), left = k => Math.ceil(((r.buffs?.[k] || 0) - now) / 60000);
  const pots = ['potion', 'potion_power', 'potion_rage', 'potion_speed'].filter(it => have(it) > 0), mates = (s.squad?.members || []).map(m => m.nick || m).filter(n => n && n !== s.hero.nick);
  const buffs = [left('rage') > 0 && `🔥 ярость ещё ${left('rage')} мин`, left('power') > 0 && `💪 сила ещё ${left('power')} мин`, left('speed') > 0 && `💨 скорость ещё ${left('speed')} мин`].filter(Boolean);
  return `${s.rolePrice && !(K.isKingNick && K.isKingNick(s.hero.nick)) ? `<p>${button('data-rolesheet', '🎭 Сменить роль за монеты')}</p>` : ''}<p class="rw">⚔️ Оружие: +${r.wlvl || 0}${buffs.length ? ' · ' + buffs.join(' · ') : ''}</p>
    ${pots.length ? `<div class="ach res">${pots.map(it => row(ITEMS[it].icon, `${ITEMS[it].name} ×${have(it)}`, RECIPES[it]?.text || '', button(`data-use="${it}"`, 'Выпить'))).join('')}</div>` : ''}
    ${mates.length && RES.some(k => have(k) > 0) ? `<div class="qcard"><h3>Передать товарищу</h3><p style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <select id="gTo">${mates.map(n => `<option>${esc(n)}</option>`).join('')}</select><select id="gIt">${RES.filter(k => have(k) > 0).map(k => `<option value="${k}">${ITEMS[k].icon} ${ITEMS[k].name} (${have(k)})</option>`).join('')}</select>
      <input id="gN" type="number" min="1" value="1" style="width:64px">${button('data-gift', 'Передать')}</p></div>` : ''}`;
}
// смена роли за монеты: цена по редкости новой роли
const TIER_RU = { common: 'обычная', uncommon: 'необычная', rare: 'редкая', epic: 'эпическая', legendary: 'легендарная' };
export function roleSheet(back) {
  const s = G.state; if (!s) return; const cur = s.hero.role, coins = s.coins || 0;
  const list = W.ROLES.filter(r => s.rolePrice[r.id] && r.id !== cur);
  openSheet(`<h2>🎭 Сменить роль</h2><p class="rw">Новая роль меняет героя, его умения и задания, а дом на карте перекрашивается в цвета роли. Монеты не возвращаются. У тебя: 🪙 ${coins}.</p>
    <div class="ach res">${list.map(r => row(W.crest ? W.crest(r, 30) : '🎭', `${esc(r.name)} <small style="opacity:.7">· ${TIER_RU[r.tier] || r.tier}</small>`, esc(r.duty || ''),
      button(`data-buyrole="${r.id}" data-price="${s.rolePrice[r.id]}"${coins < s.rolePrice[r.id] ? ' disabled' : ''}`, `🪙 ${s.rolePrice[r.id]}`))).join('')}</div>
    ${back ? `<p>${button('data-back', '← Назад')}</p>` : ''}`, b => {
    const bk = b.querySelector('[data-back]'); if (bk) bk.onclick = back;
    b.querySelectorAll('[data-buyrole]').forEach(x => x.onclick = async () => {
      if (!x.dataset.sure) { b.querySelectorAll('[data-buyrole]').forEach(y => { if (y !== x && y.dataset.sure) { delete y.dataset.sure; y.textContent = `🪙 ${y.dataset.price}`; } }); x.dataset.sure = '1'; x.textContent = `Точно? 🪙 ${x.dataset.price}`; return; }
      x.disabled = true; const r = await act('role_buy', { role: x.dataset.buyrole });
      if (r && r.status === 200) { window.RPG?.refreshHero?.(); K.setRole && K.setRole(s.hero.nick, x.dataset.buyrole); roleSheet(back); } else x.disabled = false; });
  });
}
export function wireHeroExtras(b, reopen) {
  b.querySelectorAll('[data-use]').forEach(x => x.onclick = async () => { await act('use', { item: x.dataset.use }); reopen(); });
  const rs = b.querySelector('[data-rolesheet]'); if (rs) rs.onclick = () => roleSheet(reopen);
  const g = b.querySelector('[data-gift]'); if (g) g.onclick = async () => { await act('give', { to: b.querySelector('#gTo').value, item: b.querySelector('#gIt').value, qty: +b.querySelector('#gN').value || 1 }); reopen(); };
}
// кнопки в диалогах NPC
export function npcExtras(id, back) {
  if (!G.state) return [];
  const o = [];
  if (id === 'mag') o.push(['🧪 Сварить зелье', () => craftSheet('mag', back)]);
  if (id === 'kuznets') o.push(['⚒ Кузня: снаряжение и оружие', () => craftSheet('kuznets', back)]);
  if (id === 'torgovets') o.push([res().orderDone ? '📦 Заказ дня (выполнен)' : '📦 Заказ дня', () => orderSheet(back)]);
  if (id === 'rasporyaditel') { o.push(['🏰 Укрепить стены к осаде', () => fortSheet(back)]); o.push(['🏡 Украсить мой дом', () => decorSheet(back)]); }
  return o;
}

// ---------------- стройки в мире: растут по мере сдачи ресурсов ----------------
const LOOK = { taverna: { wall: 0x8A5A32, roof: 0xA4161A, w: 4.2, d: 3.4, h: 2.6 }, kuznya: { wall: 0x8C857B, roof: 0x3A3A44, w: 4.0, d: 3.4, h: 2.4 } };
function makeSite(id) {
  const s = BUILDS[id], L = LOOK[id], g = new THREE.Group(); g.position.set(s.x, 0, s.z);
  const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: W.grad });
  const add = (geo, c, parent = g) => { const m = new THREE.Mesh(geo, toon(c)); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  add(new THREE.BoxGeometry(L.w + 0.8, 0.14, L.d + 0.8).translate(0, 0.07, 0), 0x9A8A6A);           // фундамент
  const body = new THREE.Group(); g.add(body);
  add(new THREE.BoxGeometry(L.w, 1, L.d).translate(0, 0.5, 0), L.wall, body);                      // стены (растут по высоте)
  add(new THREE.BoxGeometry(0.7, 1.2, 0.06).translate(0, 0.6, L.d / 2 + 0.01), 0x2A1A12, body);     // дверь
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.6, 0.5, 0.06).translate(sx * L.w * 0.3, 0.62, L.d / 2 + 0.01), 0xE8C66A, body); // окна
  const roof = add(new THREE.ConeGeometry(Math.hypot(L.w, L.d) / 2 + 0.3, 1.6, 4).rotateY(Math.PI / 4).scale(L.w / Math.max(L.w, L.d), 1, L.d / Math.max(L.w, L.d)), L.roof);
  const extra = new THREE.Group(); g.add(extra);
  if (id === 'kuznya') { add(new THREE.BoxGeometry(0.6, 1.6, 0.6).translate(L.w * 0.3, L.h + 0.8, -L.d * 0.2), 0x6E6862, extra); const f = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: 0xFF7A1A })); f.position.set(-L.w * 0.3, 0.6, L.d / 2 + 0.03); extra.add(f); }
  else { add(new THREE.BoxGeometry(1.2, 0.5, 0.08).translate(0, 1.75, L.d / 2 + 0.06), 0xE8B931, extra); add(new THREE.CylinderGeometry(0.28, 0.25, 0.6, 10).translate(L.w / 2 + 0.5, 0.3, L.d / 2), 0x8A5A32, extra); }
  const scaf = new THREE.Group(); g.add(scaf);                                                       // леса, пока строится
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(0.12, L.h + 0.6, 0.12).translate(x * (L.w / 2 + 0.25), (L.h + 0.6) / 2, z * (L.d / 2 + 0.25)), 0xB08A5A, scaf);
  for (const y of [0.9, 1.9]) for (const z of [-1, 1]) add(new THREE.BoxGeometry(L.w + 0.6, 0.08, 0.1).translate(0, y, z * (L.d / 2 + 0.25)), 0xB08A5A, scaf);
  const pile = new THREE.Group(); g.add(pile);                                                       // брёвна и камни у стройки
  for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6).rotateZ(Math.PI / 2).translate(-L.w / 2 - 0.9, 0.13 + (k > 2 ? 0.22 : 0), L.d / 2 - 0.2 - k % 3 * 0.26), 0x8A5A32, pile);
  W.scene.add(g); SITES[id] = { g, body, roof, extra, scaf, pile, L, p: -1 };
}
export function syncSites() {
  if (!THREE) return; const bl = res().builds;
  for (const id in BUILDS) { if (!SITES[id]) makeSite(id); const S = SITES[id], cur = bl[id] || { got: {} }, s = BUILDS[id];
    const tot = Object.values(s.need).reduce((a, b) => a + b, 0), got = Object.entries(s.need).reduce((a, [k, n]) => a + Math.min(n, cur.got?.[k] || 0), 0), p = cur.done ? 1 : got / tot;
    if (p === S.p) continue; S.p = p; const h = Math.max(0.15, S.L.h * p);
    S.body.scale.set(1, h, 1); S.body.children.slice(1).forEach(c => { c.scale.y = 1 / h; c.position.y = 0; c.visible = p > 0.45; });
    S.roof.visible = !!cur.done; S.roof.position.y = S.L.h + 0.8; S.extra.visible = !!cur.done; S.scaf.visible = !cur.done; S.pile.visible = !cur.done; }
}
// препятствие: стройка занимает место во дворе
export function blockedSite(x, z, r) { for (const id in BUILDS) { const s = BUILDS[id], L = LOOK[id]; if (Math.abs(x - s.x) < L.w / 2 + 0.45 + r && Math.abs(z - s.z) < L.d / 2 + 0.45 + r) return true; } return false; }
// кнопка действия у стройки (стоишь у фасада)
export function siteAction(pos) {
  for (const id in BUILDS) { const s = BUILDS[id], L = LOOK[id]; if (Math.abs(pos.x - s.x) < L.w / 2 + 2 && Math.abs(pos.z - s.z) < L.d / 2 + 2)
    return { kind: 'build', id, label: res().builds[id]?.done ? `🏠 ${s.name}` : `🔨 Стройка: ${s.name}` }; }
  return null;
}
export function initRes(world, k, rpg) { W = world; K = k; THREE = W.THREE; R = rpg;
  const st = document.createElement('style'); st.textContent = '.ach.res .miss { color: #ff8a7a; font-weight: 800; } #sheet .btn:disabled { opacity: .42; cursor: not-allowed; filter: grayscale(.6); } .ach.res .xpbar { display: block; padding: 0; background: rgba(245,235,220,.18); border-radius: 9px; gap: 0; } .ach.res .xpbar i { display: block; height: 6px; } .ach.res > div { align-items: center; } #sheet select, #sheet input[type=number] { font: inherit; padding: 6px 8px; border-radius: 10px; border: 2px solid var(--ink); background: var(--paper); color: var(--ink); }';
  document.head.appendChild(st); }
export { NPC };
