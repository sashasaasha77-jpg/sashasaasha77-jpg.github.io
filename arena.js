// Арена за рекой: бои с тенями других героев (игрок против игрока).
// Тень повторяет героя-соперника — уровень, роль, снаряжение, оружие — и дерётся в его манере.
// Слава арены: победитель забирает очки у побеждённого; лучшие — в таблице славы.
import { ARENA } from './quests.mjs';
import { G, act, openSheet } from './rpg-ui.js';
import { NET } from './net.js';

let W, R;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const roleName = id => (W.ROLES.find(r => r.id === id) || {}).name || '';
export const inArena = p => !!p && Math.hypot(p.x - ARENA.x, p.z - ARENA.z) < ARENA.r + 1;
let flt = '';

export async function arenaSheet() {
  const r = await act('arena', {}, true); if (!r || r.status !== 200) { W.toast(r?.data?.message || 'Арена не отвечает, попробуй ещё раз'); return; }
  const a = r.data.arena, here = inArena(R.state().pos), my = G.state?.hero?.nick, online = NET.online || new Map();
  const opps = a.opps.slice().sort((p, q) => online.has(q.nick) - online.has(p.nick));
  const row = o => { const lim = o.today >= a.rules.samePerDay, dis = !here || !a.left || lim;
    return `<div class="arO${online.has(o.nick) ? ' on' : ''}" data-n="${esc(o.nick)}"><div><b>${online.has(o.nick) ? '🟢 ' : ''}@${esc(o.nick)}</b><span>${esc(roleName(o.role))} · ур. ${o.lvl} · 🏆 ${o.r}${o.w + o.l ? ` · ${o.w}–${o.l}` : ''}</span></div>
      <button class="btn btn-gold" type="button" data-duel="${esc(o.nick)}"${dis ? ' disabled' : ''}>${lim ? 'Хватит' : '⚔️ Вызов'}</button></div>`; };
  openSheet(`<h2>🏟 Арена</h2>
    <p class="arIn">Сразись с <b>тенью</b> любого героя королевства. Тень дерётся как её хозяин: тот же уровень, роль и снаряжение. Перед боем лекари арены лечат тебя полностью — и проигрыш не отнимает здоровья.</p>
    <div class="arMe"><div><b>${a.me.r}</b><span>слава</span></div><div><b>${a.me.w}</b><span>побед</span></div><div><b>${a.me.l}</b><span>поражений</span></div><div><b>${a.left}</b><span>боёв сегодня</span></div></div>
    <p class="arIn">Победа: слава у соперника, опыт и монеты (с наградой ещё ${a.paidLeft} из ${a.rules.paidWins} побед сегодня). Поражение или побег — минус слава. С одним героем — не больше ${a.rules.samePerDay} боёв в день.</p>
    ${here ? '' : '<p class="arWarn">📍 Чтобы бросить вызов, приди на арену: она за рекой, сразу к северу от моста.</p>'}
    <h3 class="arH">Соперники</h3><input class="arF" id="arF" placeholder="Найти героя по нику" value="${esc(flt)}" autocomplete="off">
    <div class="arL" id="arL">${opps.map(row).join('') || '<p class="arIn">Пока некого вызвать — позови друзей в королевство!</p>'}</div>
    ${a.top.length ? `<h3 class="arH">🏆 Слава арены</h3><ol class="arT">${a.top.map(t => `<li class="${t.nick === my ? 'me' : ''}"><b>@${esc(t.nick)}</b><span>${t.r} · ${t.w}–${t.l}</span></li>`).join('')}</ol>` : ''}
    ${a.log.length ? `<h3 class="arH">Последние бои</h3><div class="arLog">${a.log.map(l => `<p>${l.won ? '⚔️' : '🛡'} @${esc(l.a)} ${l.won ? 'победил тень' : 'проиграл тени'} @${esc(l.b)} <i>${l.won ? '+' : '−'}${l.d}</i></p>`).join('')}</div>` : ''}`, el => {
    const f = el.querySelector('#arF'), apply = () => { flt = f.value.trim().toLowerCase().replace(/^@/, ''); el.querySelectorAll('.arO').forEach(x => x.hidden = !!flt && !x.dataset.n.includes(flt)); };
    f.oninput = apply; apply();
    el.querySelectorAll('[data-duel]').forEach(b => b.onclick = async () => { b.disabled = true; W.$('sheet').classList.remove('show'); await G.startFight('duel:' + b.dataset.duel); });
  });
}

export function initArena(world, rpg) {
  W = world; R = rpg;
  const c = document.createElement('style'); c.textContent = `
  .arIn { font-size: 13.5px; margin: 6px 0 !important; opacity: .92; } .arWarn { font-size: 13.5px; font-weight: 800; color: var(--gold); margin: 8px 0 !important; }
  .arMe { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0; } .arMe div { background: rgba(245,235,220,.08); border-radius: 12px; padding: 8px 4px; text-align: center; }
  .arMe b { display: block; font-family: var(--f-display); font-weight: 400; font-size: 24px; color: var(--gold); } .arMe span { font-size: 11.5px; font-weight: 700; color: var(--muted); }
  .arH { margin: 14px 0 6px !important; font-family: var(--f-display); font-weight: 400; font-size: 20px; color: var(--paper); }
  .arF { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 9px 12px; border-radius: 10px; border: 2px solid rgba(245,235,220,.18); background: rgba(245,235,220,.06); color: var(--paper); font: inherit; font-size: 14px; }
  .arL { display: grid; gap: 6px; } .arO { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 12px; background: rgba(245,235,220,.07); }
  .arO[hidden] { display: none; } .arO.on { border-left: 3px solid #7BD15A; } .arO b { display: block; color: #9ec3ff; font-size: 14px; } .arO span { font-size: 12px; color: var(--muted); font-weight: 700; }
  .arO .btn { padding: 7px 12px; font-size: 13px; flex: none; } .arO .btn:disabled { opacity: .45; }
  .arT { margin: 0; padding-left: 22px; font-size: 13.5px; } .arT li { padding: 3px 0; } .arT li b { color: var(--paper); } .arT li span { float: right; color: var(--gold); font-weight: 800; } .arT li.me b { color: var(--gold); }
  .arLog p { margin: 3px 0 !important; font-size: 12.5px; } .arLog i { font-style: normal; font-weight: 800; color: var(--gold); }`;
  document.head.appendChild(c);
}
