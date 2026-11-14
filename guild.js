// Ордены (семьи): окно ордена, список орденов и рейтинг недели, основание ордена, задания главы, вклад в казну, ссылка-приглашение.
import { castleSheet } from './extras-ui.js';
import { ITEMS } from './quests.mjs';
import { G, act, openSheet } from './rpg-ui.js';

let W, K;
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (window.K && K.fmt ? K.fmt(n) : n);
const inviteUrl = id => location.origin + location.pathname + '#order=' + id;
const MEDAL = ['🥇', '🥈', '🥉'];

export async function guildSheet(focusId) {
  const r = await act('guild', { op: 'view' }, true); if (!r || r.status !== 200 || !r.data.order) return;
  render(r.data.order, focusId);
}
async function op(btn, body) { if (btn) btn.disabled = true; const r = await act('guild', body); if (r && r.status === 200 && r.data.order) render(r.data.order); else if (btn) btn.disabled = false; }

function render(o, focusId) {
  const s = G.state, m = o.mine, R = o.rules;
  const listHtml = o.list.length ? `<div class="gL">${o.list.map((x, i) => `<div class="gO${m && m.id === x.id ? ' me' : ''}${focusId === x.id ? ' focus' : ''}"><span class="gB" style="background:${x.color}">${i < 3 && x.week > 0 ? MEDAL[i] : i + 1}</span>
      <span style="flex:1"><b>${esc(x.name)}</b> <small>ур. ${x.lvl}</small><br><small>глава @${esc(x.head)} · ${x.n}/${R.maxMembers} · за неделю ${fmt(x.week)} очк.</small>${x.motto ? `<br><i>«${esc(x.motto)}»</i>` : ''}</span>
      ${!m && x.n < R.maxMembers ? `<button class="btn btn-gold" type="button" data-join="${x.id}" style="padding:6px 10px;font-size:13px">Вступить</button>` : ''}</div>`).join('')}</div>`
    : '<p class="rw">Пока ни одного ордена. Стань первым главой!</p>';
  let mine = '';
  if (m) {
    const g = m.goal, gd = g && o.goals[g.kind], head = o.head;
    const goalHtml = g && !g.done ? `<div class="gG"><b>${gd.icon} Задание: ${gd.name}</b><div class="xpbar" style="margin:6px 0"><i style="width:${Math.min(100, 100 * g.got / g.n).toFixed(1)}%"></i></div><small>${g.got} из ${g.n} · награда: +${R.goalCoins} монет каждому, кто помог, ордену +${R.goalBonus} очков</small></div>`
      : `<div class="gG"><small>${g && g.done ? `✅ Последнее задание выполнено: ${gd.name} ×${g.n}.` : 'Задания пока нет.'} ${head ? 'Дай ордену новое задание ниже.' : 'Глава скоро даст новое.'}</small></div>`;
    const have = it => (s.inventory.find(i => i.item === it) || {}).qty || 0;
    const donate = Object.keys(R.donatePts).map(it => { const n = have(it); return `<button class="btn btn-paper" type="button" data-don="${it}" data-q="${n}" ${n ? '' : 'disabled'} style="padding:6px 10px;font-size:13px">${ITEMS[it].icon} Сдать все ×${n}</button>`; }).join('');
    const goalSet = head ? `<details class="gD"><summary>Дать ордену задание</summary><div class="gGrid">${Object.entries(o.goals).map(([k, d]) => d.ns.map(n => `<button class="btn btn-paper" type="button" data-goal="${k}" data-n="${n}" style="padding:6px 8px;font-size:12.5px">${d.icon} ${n}</button>`).join('')).join('')}</div><small>Сменить задание можно, когда оно выполнено или через ${R.goalHours} ч.</small></details>
      <details class="gD"><summary>Цвет и девиз ордена</summary><div class="gC">${o.colors.map(c => `<button type="button" data-color="${c}" style="background:${c}" class="${c === m.color ? 'on' : ''}"></button>`).join('')}</div><input id="gMotto" maxlength="60" placeholder="Девиз ордена" value="${esc(m.motto)}"><button class="btn btn-gold" type="button" id="gSave" style="margin-top:6px;padding:6px 12px;font-size:13px">Сохранить</button></details>` : '';
    mine = `<div class="gHead" style="--oc:${m.color}"><div class="gBig">🏰</div><div><h2 style="margin:0">${esc(m.name)}</h2><small>Уровень ${m.lvl} · ${m.place ? `${m.place} место недели` : 'без места'} · очков всего ${fmt(m.pts)} (до ур. ${m.lvl + 1}: ${fmt(m.next)})</small>${m.motto ? `<br><i>«${esc(m.motto)}»</i>` : ''}</div></div>
      <p class="rw">Бонус ордена: <b style="color:var(--gold)">+${m.bonus}% монет</b> за победы над врагами (растёт с уровнем ордена). Очки ордену дают победы его воинов и вклад в казну. Тройка лучших орденов недели получает монеты: ${R.weekPrize.join(' / ')} каждому, главе — вдвое.</p>
      ${goalHtml}
      <div class="gRow">${donate}</div><small class="rw">В казну: 🪵 и 🌿 — по 1 очку, 🪨 — 2 очка за штуку.</small>
      <h3 style="margin:14px 0 6px">Воины ордена (${m.members.length}/${R.maxMembers})</h3><div class="gM">${m.members.map((x, i) => `<div><span>${x.nick === m.head ? '👑' : i + 1}</span><b style="flex:1">@${esc(x.nick)}</b><small>${fmt(x.week)} за нед. · ${fmt(x.pts)} всего</small>${head && x.nick !== m.head ? `<button class="link" type="button" data-kick="${esc(x.nick)}">исключить</button>` : ''}</div>`).join('')}</div>
      <button class="btn btn-gold" type="button" id="gCastle" style="width:100%;margin:12px 0 2px">🏰 Замок ордена — строим вместе</button>
      <h3 style="margin:14px 0 6px">Позвать друзей</h3><p class="rw">Отправь ссылку другу: он откроет игру и сразу увидит кнопку «Вступить» в твой орден.</p>
      <div class="gRow"><input id="gLink" readonly value="${esc(inviteUrl(m.id))}"><button class="btn btn-gold" type="button" id="gCopy" style="padding:6px 12px;font-size:13px">Скопировать</button></div>
      ${goalSet}
      ${(m.log || []).length ? `<details class="gD"><summary>Летопись ордена</summary>${m.log.slice(0, 12).map(l => `<div class="rw">• ${esc(l.t)}</div>`).join('')}</details>` : ''}
      <button class="link" type="button" id="gLeave" style="margin-top:10px">${head ? 'Покинуть орден (главой станет лучший воин)' : 'Покинуть орден'}</button>`;
  } else {
    mine = `<p>Орден — это твоя семья в королевстве: вместе выполняете задания главы, поднимаетесь в рейтинге и получаете награды.</p>
      ${o.canFound ? `<details class="gD" open><summary><b>Стать главой ордена</b> — ${fmt(R.foundCost)} монет</summary><p class="rw">Мест для глав осталось: ${o.free} из ${R.maxOrders}. Глава собирает воинов, даёт задания и зовёт друзей по ссылке.</p>
        <input id="gName" maxlength="24" placeholder="Название ордена"><div class="gC">${o.colors.map((c, i) => `<button type="button" data-color="${c}" style="background:${c}" class="${i === 0 ? 'on' : ''}"></button>`).join('')}</div>
        <input id="gMotto" maxlength="60" placeholder="Девиз (необязательно)"><button class="btn btn-gold" type="button" id="gFound" style="margin-top:8px" ${s.coins >= R.foundCost ? '' : 'disabled'}>Основать орден за ${fmt(R.foundCost)} 🪙</button></details>`
      : `<p class="rw">${o.level < R.foundLevel ? `Стать главой можно с ${R.foundLevel} уровня (у тебя ${o.level}).` : o.free <= 0 ? `Все ${R.maxOrders} мест для глав заняты — вступай в орден!` : ''}</p>`}`;
  }
  openSheet(`<h2>🏰 Ордены королевства</h2>${mine}<h3 style="margin:16px 0 6px">Рейтинг недели</h3>${listHtml}`, b => {
    b.querySelectorAll('input').forEach(i => { i.addEventListener('keydown', e => e.stopPropagation()); i.addEventListener('keyup', e => e.stopPropagation()); });
    b.querySelectorAll('[data-join]').forEach(x => x.onclick = () => op(x, { op: 'join', id: x.dataset.join }));
    b.querySelectorAll('[data-don]').forEach(x => x.onclick = () => op(x, { op: 'donate', item: x.dataset.don, qty: +x.dataset.q }));
    b.querySelectorAll('[data-goal]').forEach(x => x.onclick = () => op(x, { op: 'goal', kind: x.dataset.goal, n: +x.dataset.n }));
    b.querySelectorAll('[data-kick]').forEach(x => x.onclick = () => { if (confirmKick(x)) op(x, { op: 'kick', nick: x.dataset.kick }); });
    let color = m ? m.color : o.colors[0];
    b.querySelectorAll('[data-color]').forEach(x => x.onclick = () => { color = x.dataset.color; b.querySelectorAll('[data-color]').forEach(y => y.classList.toggle('on', y === x)); });
    const v = id => (b.querySelector('#' + id) || {}).value || '';
    const f = b.querySelector('#gFound'); if (f) f.onclick = () => op(f, { op: 'found', name: v('gName'), motto: v('gMotto'), color });
    const sv = b.querySelector('#gSave'); if (sv) sv.onclick = () => op(sv, { op: 'edit', motto: v('gMotto'), color });
    const gc = b.querySelector('#gCastle'); if (gc) gc.onclick = () => castleSheet();
    const lv = b.querySelector('#gLeave'); if (lv) lv.onclick = () => { if (lv.dataset.sure) op(lv, { op: 'leave' }); else { lv.dataset.sure = 1; lv.textContent = 'Точно выйти? Нажми ещё раз'; } };
    const cp = b.querySelector('#gCopy'); if (cp) cp.onclick = async () => { const t = v('gLink'); try { await navigator.clipboard.writeText(t); } catch { const i = b.querySelector('#gLink'); i.select(); document.execCommand && document.execCommand('copy'); } W.toast('Ссылка скопирована — отправь её другу'); };
    const fx = b.querySelector('.gO.focus'); if (fx) fx.scrollIntoView({ block: 'center' });
  });
}
function confirmKick(x) { if (x.dataset.sure) return true; x.dataset.sure = 1; x.textContent = 'точно?'; return false; }

// ссылка-приглашение: #order=<id> — после входа в игру сразу открываем ордены с этим орденом
function pendingInvite() { const m = location.hash.match(/order=([a-z0-9]+)/i); return m ? m[1] : null; }
export function initGuild(world, k) {
  W = world; K = k;
  const c = document.createElement('style'); c.textContent = `
  .gL { display: grid; gap: 6px; } .gO { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: rgba(245,235,220,.07); }
  .gO.me { box-shadow: inset 3px 0 0 var(--gold); } .gO.focus { box-shadow: 0 0 0 3px var(--gold); } .gO small { color: var(--muted); font-weight: 700; } .gO i { color: var(--muted); font-size: 12px; }
  .gB { flex: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #fff; border: 2px solid #1A1410; text-shadow: 0 1px 2px #000; }
  .gHead { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--oc) 22%, transparent); border: 2px solid var(--oc); margin-bottom: 8px; }
  .gHead small { color: var(--muted); font-weight: 700; } .gHead i { color: var(--paper); font-size: 13px; } .gBig { font-size: 34px; }
  .gG { padding: 8px 10px; border-radius: 12px; background: rgba(245,235,220,.07); margin: 8px 0; } .gG small { color: var(--muted); }
  .gRow { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: 6px 0; } .gRow input { flex: 1; min-width: 160px; }
  .gM { display: grid; gap: 4px; } .gM > div { display: flex; gap: 8px; align-items: center; font-size: 13.5px; } .gM small { color: var(--muted); }
  .gD { margin: 10px 0; } .gD summary { cursor: pointer; font-weight: 800; } .gGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; }
  .gC { display: flex; gap: 6px; margin: 8px 0; } .gC button { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #1A1410; cursor: pointer; } .gC button.on { box-shadow: 0 0 0 3px var(--gold); }
  #sheetBody .gD input, #sheetBody .gRow input { box-sizing: border-box; width: 100%; padding: 8px 10px; border-radius: 10px; border: 2px solid rgba(245,235,220,.18); background: rgba(245,235,220,.06); color: var(--paper); font: inherit; font-size: 14px; margin-top: 6px; }`;
  document.head.appendChild(c);
  const inv = pendingInvite();
  if (inv) { let tries = 0; const t = setInterval(() => { if (++tries > 600) return clearInterval(t); if (!G.state) return; clearInterval(t);
    history.replaceState(null, '', location.pathname + location.search); W.toast('🏰 Тебя зовут в орден!'); guildSheet(inv); }, 1000); }
}
export const hasInvite = () => !!pendingInvite();
