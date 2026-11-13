// Рынок к востоку от замка (победил в голосовании подданных): три купца скупают ресурсы дороже лавки и продают их тем, кому не хватает.
// Цены общие для всех: товар дня в цене, а когда королевство продаёт много, купцы платят меньше — до утра.
import { MARKET, MARKET_STALLS, ITEMS } from './quests.mjs';
import { G, act, openSheet } from './rpg-ui.js';
import { buildHero } from './figure.js';

let W, R;
export const inMarket = p => !!p && Math.hypot(p.x - MARKET.x, p.z - MARKET.z) < MARKET.r + 1;
const LOOK = { les: 'kuznets', trava: 'alkhimik', ruda: 'strazhnik' };

export async function marketSheet() {
  const r = await act('market', { op: 'view' }, true); if (!r || r.status !== 200 || !r.data.market) return;
  render(r.data.market);
}
function render(m) {
  const s = G.state, have = it => (s.inventory.find(i => i.item === it) || {}).qty || 0, here = inMarket(R.state().pos);
  const sb = (attr, txt, cls, dis) => `<button class="btn ${cls}" type="button" ${attr} style="padding:5px 9px;font-size:13px" ${dis || !here ? 'disabled' : ''}>${txt}</button>`;
  const hot = m.day.hot, trader = s.hero?.role === 'torgovets';
  const rows = MARKET_STALLS.map(st => { const it = st.item, p = m.res[it], n = have(it);
    return `<div class="mkS${p.hot ? ' hot' : ''}"><div class="mkH"><span style="font-size:24px">${st.icon}</span><span style="flex:1"><b>${st.name} ${st.who}</b><br><small>${ITEMS[it].name}: у тебя ${n}</small></span>${p.hot ? '<em>🔥 в цене</em>' : ''}</div>
      <div class="mkP"><span>Скупает по <b>${p.sell} 🪙</b>${p.glut < 100 ? ` <i>(завален товаром: −${100 - p.glut}% до утра)</i>` : ''}</span>
        <span class="mkB">${sb(`data-sell="${it}" data-q="1"`, 'Продать', 'btn-gold', n < 1)}${n >= 10 ? sb(`data-sell="${it}" data-q="10"`, '×10', 'btn-gold') : ''}${n > 1 ? sb(`data-sell="${it}" data-q="${n}"`, `Все ×${n}`, 'btn-gold') : ''}</span></div>
      <div class="mkP"><span>Продаёт по <b>${p.buy} 🪙</b></span><span class="mkB">${[1, 5].map(q => sb(`data-buy="${it}" data-q="${q}"`, q === 1 ? 'Купить' : '×' + q, 'btn-paper', s.coins < p.buy * q)).join('')}</span></div></div>`; }).join('');
  const rare = m.rare, ri = ITEMS[rare.item];
  openSheet(`<h2>🛒 Рынок</h2><p class="mkI">У тебя 🪙 ${window.K.fmt(s.coins)} монет. Купцы платят за ресурсы больше, чем лавка на площади.
    Товар дня — <b>${ITEMS[hot].name.toLowerCase()}</b>: за него дают почти вдвое! Чем больше всё королевство продаёт, тем ниже цена; к утру она снова растёт.${trader ? ' <b>Ты торговец: тебе платят на 15% больше, а редкий товар дешевле.</b>' : ''}</p>
    ${here ? '' : '<p class="mkW">Торговать можно, только стоя на рынке: он к востоку от замка, по дороге из восточных ворот.</p>'}
    ${rows}
    <h2 class="mkT">🤝 Ряды игроков</h2><p class="mkI">Покупай у других героев или выставь своё по своей цене. Товар лежит на прилавке до 2 дней, деньги придут сами (пошлина ${Math.round(m.fee * 100)}%).</p>
    ${lotsHtml(m, sb, s)}
    ${sellForm(m, s, here)}
    <div class="mkS rare"><div class="mkH"><span style="font-size:24px">${ri.icon}</span><span style="flex:1"><b>Редкий товар дня</b><br><small>${ri.name}${have(rare.item) ? ` · у тебя ${have(rare.item)}` : ''}</small></span>
      ${sb(`data-buy="${rare.item}" data-q="1"`, `Купить за ${rare.price} 🪙`, 'btn-gold', s.coins < rare.price)}</div></div>`,
    b => { b.querySelectorAll('input').forEach(i => { i.addEventListener('keydown', e => e.stopPropagation()); i.addEventListener('keyup', e => e.stopPropagation()); });
      b.querySelectorAll('[data-take]').forEach(x => x.onclick = () => lotAct(x, { op: 'take', lot: x.dataset.take, qty: +x.dataset.q }));
      b.querySelectorAll('[data-cancel]').forEach(x => x.onclick = () => lotAct(x, { op: 'cancel', lot: x.dataset.cancel }));
      const f = b.querySelector('#mkForm'); if (f) { const sel = f.querySelector('select'), pr = f.querySelector('[name=price]'), qt = f.querySelector('[name=qty]'), sum = f.querySelector('.mkSum');
        const upd = () => { const o = sel.selectedOptions[0]; if (o && +qt.value > +o.dataset.max) qt.value = o.dataset.max; sum.textContent = `Получишь ~${Math.floor((+qt.value || 0) * (+pr.value || 0) * (1 - m.fee))} 🪙`; };
        sel.onchange = () => { const o = sel.selectedOptions[0]; pr.value = o.dataset.hint; qt.value = Math.min(+o.dataset.max, 10); upd(); }; pr.oninput = qt.oninput = upd; if (sel.options.length) sel.onchange();
        f.querySelector('[data-list]').onclick = e => lotAct(e.currentTarget, { op: 'list', item: sel.value, qty: +qt.value, price: +pr.value }); }
      b.querySelectorAll('[data-sell]').forEach(x => x.onclick = () => trade(x, 'sell'));
      b.querySelectorAll('[data-buy]').forEach(x => x.onclick = () => trade(x, 'buy')); });
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function lotsHtml(m, sb, s) {
  if (!m.lots.length) return '<p class="mkI" style="opacity:.75">Пока никто ничего не выставил. Будь первым!</p>';
  return `<div class="mkL">${m.lots.map(l => { const it = ITEMS[l.item] || { name: l.item, icon: '📦' };
    return `<div class="mkO${l.mine ? ' mine' : ''}"><span style="font-size:20px">${it.icon}</span><span style="flex:1"><b>${it.name} ×${l.qty}</b><br><small>${l.price} 🪙 за шт. · ${l.mine ? 'твой лот' : '@' + esc(l.seller)}</small></span><span class="mkB">${l.mine
      ? sb(`data-cancel="${l.id}"`, 'Снять', 'btn-paper')
      : sb(`data-take="${l.id}" data-q="1"`, 'Купить', 'btn-gold', s.coins < l.price) + (l.qty > 1 ? sb(`data-take="${l.id}" data-q="${l.qty}"`, `Все · ${l.qty * l.price} 🪙`, 'btn-gold', s.coins < l.qty * l.price) : '')}</span></div>`; }).join('')}</div>`;
}
function sellForm(m, s, here) {
  const mine = m.lots.filter(l => l.mine).length;
  const opts = s.inventory.filter(i => i.qty > 0 && ITEMS[i.item] && (['wood', 'herb', 'ore'].includes(i.item) || ['consumable', 'gear'].includes(ITEMS[i.item].type)) && (i.equipped ? i.qty > 1 : true));
  if (!opts.length) return '<p class="mkI" style="opacity:.75">Выставить пока нечего: собери ресурсы или свари зелья.</p>';
  const hint = it => m.res[it] ? Math.max(1, m.res[it].buy - 1) : 20;
  return `<div class="mkS" id="mkForm"><b>Выставить свой товар</b> <small style="color:var(--muted)">(${mine} из ${m.maxLots} лотов)</small>
    <div class="mkF"><select>${opts.map(i => `<option value="${i.item}" data-max="${i.equipped ? i.qty - 1 : i.qty}" data-hint="${hint(i.item)}">${ITEMS[i.item].icon} ${ITEMS[i.item].name} (есть ${i.qty})</option>`).join('')}</select>
    <label>Сколько <input name="qty" type="number" min="1" max="999" value="1"></label><label>Цена за шт. <input name="price" type="number" min="1" value="10"></label></div>
    <div class="mkP"><span class="mkSum"></span><button class="btn btn-gold" type="button" data-list style="padding:6px 12px;font-size:13px" ${here && mine < m.maxLots ? '' : 'disabled'}>Выставить</button></div></div>`;
}
async function lotAct(x, body) { x.disabled = true; const r = await act('market', body); if (r && r.status === 200 && r.data.market) render(r.data.market); else marketSheet(); }
async function trade(x, op) {
  x.disabled = true; const r = await act('market', { op, item: x.dataset[op], qty: +x.dataset.q });
  if (r && r.status === 200 && r.data.market) render(r.data.market); else marketSheet();
}

// купцы за прилавками
function merchants() {
  const root = W.RPGW; if (!root) return;
  for (const st of MARKET_STALLS) {
    const role = W.ROLES.find(x => x.id === LOOK[st.id]) || W.ROLES[0], h = buildHero(role, 'market-' + st.id);
    const d = Math.hypot(st.dx, st.dz), ux = st.dx / d, uz = st.dz / d;
    h.position.set(MARKET.x + st.dx + ux * 0.95, 0, MARKET.z + st.dz + uz * 0.95); h.rotation.y = Math.atan2(-ux, -uz); root.add(h);
  }
}

export function initMarket(world, rpg) {
  W = world; R = rpg;
  const c = document.createElement('style'); c.textContent = `
  .mkI { font-size: 13.5px; } .mkW { font-size: 13.5px; font-weight: 800; color: var(--gold); }
  .mkS { background: rgba(245,235,220,.07); border-radius: 14px; padding: 10px 12px; margin: 8px 0; } .mkS.hot { box-shadow: inset 3px 0 0 #FF9A2E; } .mkS.rare { box-shadow: inset 3px 0 0 var(--gold); }
  .mkH { display: flex; align-items: center; gap: 10px; } .mkH small { color: var(--muted); font-weight: 700; } .mkH em { font-style: normal; font-weight: 800; font-size: 12.5px; color: #FF9A2E; }
  .mkP { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 7px; font-size: 13.5px; } .mkP i { color: var(--muted); font-size: 12px; }
  .mkT { margin: 16px 0 4px !important; font-size: 20px !important; } .mkL { display: grid; gap: 6px; } .mkO { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: rgba(245,235,220,.07); } .mkO.mine { box-shadow: inset 3px 0 0 #9ec3ff; } .mkO small { color: var(--muted); font-weight: 700; }
  .mkF { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; } .mkF select { grid-column: 1 / -1; } .mkF label { font-size: 12px; font-weight: 700; color: var(--muted); display: grid; gap: 3px; }
  .mkF select, .mkF input { box-sizing: border-box; width: 100%; padding: 8px 10px; border-radius: 10px; border: 2px solid rgba(245,235,220,.18); background: rgba(245,235,220,.06); color: var(--paper); font: inherit; font-size: 14px; }
  .mkF option { color: #1A1210; }
  .mkB { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; } .mkS .btn:disabled { opacity: .45; }`;
  document.head.appendChild(c);
  try { merchants(); } catch (e) { console.warn('market', e); }
}
