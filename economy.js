// Экономика королевства: вход по PIN, монеты, сундук, рейтинг, казна, мой дом.
// На Netlify работает с сервером /api/*, иначе — тестовый режим в браузере (та же логика из core.mjs).
import { createApi, HOUSE, GAME } from './core.mjs';

const K = await new Promise(res => window.K ? res(window.K) : addEventListener('k-ready', () => res(window.K), { once: true }));
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COIN = (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="#E8B931" stroke="#1A1210" stroke-width="2"/><path d="M7 7 H13 M10 6 V14 M7.5 13 H12.5" stroke="#1A1210" stroke-width="1.8" stroke-linecap="round"/></svg>`;

// ---------------- API ----------------
let mode = null, local = null, detectP = null;
function detect() { return detectP || (detectP = detect0()); }
async function detect0() {
  for (const ms of [6000, 10000, 15000]) try { // сервер может «просыпаться» несколько секунд — пробуем ещё раз, а не уходим в офлайн
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    const r = await fetch((window.KP_API || '') + '/api/state', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' }, signal: ctl.signal });
    clearTimeout(t); if (r.ok) { const j = await r.json(); if (j && j.boards) { mode = 'server'; return j; } }
  } catch (_) { }
  local = null; mode = 'local';
  let db = {}; try { db = JSON.parse(localStorage.getItem('kp-local-db') || '{}'); } catch (_) { }
  const persist = () => { try { localStorage.setItem('kp-local-db', JSON.stringify(db)); } catch (_) { } };
  local = createApi({ store: { get: async k => db[k] ? JSON.parse(JSON.stringify(db[k])) : null, set: async (k, v) => { db[k] = v; persist(); }, list: async p => Object.keys(db).filter(k => k.startsWith(p)) },
    isResident: async n => K.validNick(n) });
  $('localTag').style.display = 'block';
  return (await local('state', {})).data;
}
async function api(action, body = {}) {
  if (!mode || (mode === 'local' && !local)) await detect(); // кнопку нажали раньше, чем королевство загрузилось
  if (mode === 'server') {
    const r = await fetch((window.KP_API || '') + '/api/' + action, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    let d = {}; try { d = await r.json(); } catch (_) { d = { message: 'Сервер не ответил. Попробуй ещё раз.' }; }
    if (!r.ok) throw Object.assign(new Error(d.message || 'Ошибка'), { code: d.error, status: r.status }); return d;
  }
  const { status, data } = await local(action, body);
  if (status !== 200) throw Object.assign(new Error(data.message), { code: data.error, status }); return data;
}

// ---------------- состояние ----------------
let STATE = null, ME = null, AUTH = null;
try { AUTH = JSON.parse(localStorage.getItem('kp-auth') || 'null'); } catch (_) { }
async function refresh() { STATE = await api('state'); K.setRoles && K.setRoles(STATE.roles); K.setLevels(STATE.levels); K.setDecor && K.setDecor(STATE.decor); K.setProjects(STATE.treasury); }
K.auth = () => (ME && AUTH ? { nick: AUTH.nick, pin: AUTH.pin } : null);
function setMe(m) { ME = m; K.me = m; dispatchEvent(new Event('k-me')); const c = $('chip');
  if (ME) { c.classList.add('in'); c.innerHTML = `@${esc(ME.nick)} · ${COIN(14)} ${K.fmt(ME.coins)}`; c.setAttribute('aria-label', `Мой дом, ${ME.coins} монет`); }
  else { c.classList.remove('in'); c.textContent = 'Войти'; c.removeAttribute('aria-label'); } }

// ---------------- лист ----------------
const sheet = $('sheet'), body = $('sheetBody'); let onClose = null;
function open(html, after) { body.innerHTML = html; sheet.classList.add('show'); after && after(); const f = body.querySelector('input,button'); f && f.focus({ preventScroll: true }); }
function close() { sheet.classList.remove('show'); body.innerHTML = ''; onClose && onClose(); onClose = null; }
$('sheetX').addEventListener('click', close);
sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('show')) close(); });
const busy = (btn, on) => { if (!btn) return; btn.disabled = on; btn.style.opacity = on ? .6 : 1; };

// ---------------- вход ----------------
function needLogin(then) { if (ME && AUTH) return then(); loginSheet(then); }
function loginSheet(then) {
  open(`<h2>Вход в королевство</h2>
    <p class="muted">Ник из Instagram и PIN из 4 цифр. В первый раз придумай PIN и запомни его: по нему королевство узнаёт, что это ты.</p>
    <form id="lf" novalidate>
      <label class="field"><span>Ник в Instagram</span><input id="lNick" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="твой_ник" value="${esc(AUTH?.nick || K.normalize($('q').value) || '')}"></label>
      <label class="field"><span>PIN</span><input id="lPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" placeholder="••••"></label>
      <label class="row" style="margin:0 0 10px;font-weight:700;cursor:pointer"><input type="checkbox" id="lRem" checked style="width:20px;height:20px;accent-color:#E8B931"> Запомнить на этом устройстве</label>
      <div class="err" id="lErr" role="alert"></div>
      <div class="row"><button class="btn btn-gold" id="lGo" type="submit" style="flex:1">Войти</button></div>
    </form>
    <p class="muted" style="margin-top:12px">Забыл PIN? Напиши королю в комментарии под роликом — он сбросит PIN.</p>`, () => {
    $('lf').addEventListener('submit', async e => {
      e.preventDefault(); const nick = K.normalize($('lNick').value), pin = $('lPin').value.trim(); $('lErr').textContent = '';
      busy($('lGo'), true);
      try {
        const r = await api('login', { nick, pin }); AUTH = { nick, pin };
        if ($('lRem').checked) { try { localStorage.setItem('kp-auth', JSON.stringify(AUTH)); } catch (_) { } }
        setMe(r.me); close(); K.toast(r.created ? `Добро пожаловать, @${nick}! Запомни свой PIN.` : `С возвращением, @${nick}!`); then && then();
      } catch (err) {
        $('lErr').textContent = err.message;
        if (err.code === 'not_resident') $('lErr').insertAdjacentHTML('beforeend', ' <button type="button" class="link" id="lHow">Как поселиться</button>'), $('lHow').onclick = () => { close(); K.openHowto(nick); };
      } finally { busy($('lGo'), false); }
    });
  });
}
const call = async (action, extra = {}) => { const r = await api(action, { ...AUTH, ...extra }); if (r.me) setMe(r.me); return r; };
function fail(err) { if (err.status === 401 && err.code !== 'bad_pin') { AUTH = null; setMe(null); } K.toast(err.message); }

// ---------------- мой дом ----------------
function houseSheet() {
  const m = ME, role = K.roleFor(m.nick), t = K.TIERS[role.tier], nx = m.next, onMap = K.residents.some(p => p.nick === m.nick && p.status !== 'ruins');
  open(`<h2>Мой дом</h2>
    <div class="row" style="gap:14px;margin-bottom:12px"><div>${K.crest(role, 64)}</div><div><b style="word-break:break-all">@${esc(m.nick)}</b><br><span style="color:${t.bg === '#8C857B' ? '#C9C1B5' : t.bg}" >${role.name}</span> · ${esc(m.house)}</div></div>
    <div class="box"><div class="coins big">${COIN(30)} ${K.fmt(m.coins)}</div><div class="muted">монет в кошельке</div></div>
    <div class="levels">${HOUSE.map((h, i) => `<div class="${i === m.level ? 'on' : ''}">${h.name}<br><span class="muted">${i ? h.cost : '—'}</span></div>`).join('')}</div>
    ${nx ? `<button class="btn btn-gold" id="hUp" type="button" style="width:100%" ${m.coins < nx.cost ? 'disabled' : ''}>Улучшить до «${nx.name}» за ${K.fmt(nx.cost)}</button>
      ${m.coins < nx.cost ? `<p class="muted" style="margin-top:8px">Не хватает ${K.fmt(nx.cost - m.coins)} монет. Открывай сундук каждый день.</p>` : ''}` : '<p><b>Твой дом — замок.</b> Выше только корона.</p>'}
    <div class="box" style="margin-top:12px"><div class="kv">
      <span>Сундук сегодня</span><b>${m.chestToday ? 'открыт' : 'ждёт'}</b>
      <span>Заработано за неделю</span><b>${K.fmt(m.wkEarned)}</b>
      <span>Вложено в казну</span><b>${K.fmt(m.donated)}</b>
      <span>Заработано всего</span><b>${K.fmt(m.earned)}</b></div></div>
    ${onMap ? '' : K.isKingNick && K.isKingNick(m.nick) ? '<p class="muted">👑 Твой дом — королевский замок в центре карты.</p>' : '<p class="muted">Твоего дома пока нет на карте: король добавит его, когда сверит ник. Монеты и улучшения уже копятся.</p>'}
    ${onMap ? '<button class="btn btn-gold" id="hPass" type="button" style="width:100%;margin-bottom:10px">Мой паспорт для сторис</button>' : ''}
    <div class="row">${onMap ? '<button class="btn btn-paper" id="hShow" type="button" style="flex:1">Показать на карте</button>' : ''}<button class="btn btn-paper" id="hOut" type="button" style="flex:1">Выйти</button></div>`, () => {
    $('hUp')?.addEventListener('click', async e => { busy(e.target, true); try { const r = await call('upgrade'); await refresh(); K.toast(`Готово! Теперь у тебя «${r.me.house}».`); houseSheet(); if (onMap) K.select(m.nick); } catch (err) { fail(err); busy(e.target, false); } });
    $('hPass')?.addEventListener('click', () => { close(); K.passport(m.nick); });
    $('hShow')?.addEventListener('click', () => { close(); K.select(m.nick); });
    $('hOut').addEventListener('click', () => { AUTH = null; setMe(null); try { localStorage.removeItem('kp-auth'); } catch (_) { } close(); K.toast('Ты вышел. PIN на этом устройстве забыт.'); });
  });
}
$('chip').addEventListener('click', () => ME ? houseSheet() : loginSheet());

// ---------------- сундук ----------------
const CHEST = open => `<svg viewBox="0 0 170 130" aria-hidden="true"><rect x="15" y="58" width="140" height="62" rx="8" fill="#7A4A2A" stroke="#1A1210" stroke-width="5"/>
  <rect x="15" y="80" width="140" height="10" fill="#E8B931" stroke="#1A1210" stroke-width="3"/>
  ${open ? `<path d="M15 58 L30 10 H140 L155 58 Z" fill="#5a3420" stroke="#1A1210" stroke-width="5"/><ellipse cx="85" cy="60" rx="58" ry="10" fill="#FFD95A"/><circle cx="62" cy="52" r="8" fill="#E8B931" stroke="#1A1210" stroke-width="2"/><circle cx="85" cy="46" r="9" fill="#E8B931" stroke="#1A1210" stroke-width="2"/><circle cx="108" cy="53" r="8" fill="#E8B931" stroke="#1A1210" stroke-width="2"/>`
  : `<path d="M15 58 Q85 0 155 58 Z" fill="#A4161A" stroke="#1A1210" stroke-width="5"/><path d="M50 30 V58 M120 30 V58" stroke="#E8B931" stroke-width="7"/>`}
  <rect x="73" y="74" width="24" height="26" rx="4" fill="#E8B931" stroke="#1A1210" stroke-width="3"/><circle cx="85" cy="85" r="3.5" fill="#1A1210"/></svg>`;
function untilMidnight() { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Samara', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const left = 24 * 60 - ((Number(p.hour) % 24) * 60 + Number(p.minute)); return `${Math.floor(left / 60)} ч ${left % 60} мин`; }
function chestSheet() {
  const done = ME.chestToday;
  open(`<h2>Сундук дня</h2><div class="chestbox" id="cb">${CHEST(done)}<div id="cRes"></div></div>
    <p class="muted" style="text-align:center">Один сундук в день. Обычно в нём 15–35 монет, иногда 60, а изредка — 150.</p>
    ${done ? `<p style="text-align:center"><b>Сегодня уже открыт.</b> Следующий через ${untilMidnight()}.</p>` : '<button class="btn btn-gold" id="cOpen" type="button" style="width:100%">Открыть сундук</button>'}`, () => {
    $('cOpen')?.addEventListener('click', async e => {
      busy(e.target, true); const svg = $('cb').querySelector('svg'); svg.classList.add('shake');
      try { const r = await call('chest'); await new Promise(res => setTimeout(res, 700)); svg.outerHTML = CHEST(true);
        $('cRes').innerHTML = `<div class="reward">+${r.reward}</div><div class="muted">${r.rare ? 'Редкий сундук!' : 'монет в кошелёк'}</div>`; e.target.remove(); refresh(); }
      catch (err) { svg.classList.remove('shake'); fail(err); busy(e.target, false); }
    });
  });
}
$('bChest').addEventListener('click', () => needLogin(chestSheet));

// ---------------- рейтинг ----------------
const TABS = [
  { id: 'earned', name: 'Знатность', hint: 'Все монеты, заработанные за всё время. Траты не уменьшают знатность.', unit: 'монет' },
  { id: 'week', name: 'Неделя', hint: 'Топ-3 недели попадут в следующую серию мультика как жители королевства.', unit: 'монет' },
  { id: 'donated', name: 'Меценаты', hint: 'Больше всех вложили в общие стройки.', unit: 'монет' },
];
function rateSheet(tab = 'earned') {
  const b = STATE.boards, T = TABS.find(t => t.id === tab), list = tab === 'week' ? b.week.list : b[tab];
  const rows = list.length ? list.map((e, i) => { const r = K.roleFor(e.nick); return `<li class="${ME && e.nick === ME.nick ? 'me' : ''}"><button type="button" data-n="${esc(e.nick)}"><span class="place ${i < 3 ? 'p' + (i + 1) : ''}">${i + 1}</span><span class="who"><b>@${esc(e.nick)}</b><small>${r.name}</small></span><span class="coins">${tab === 'vorota' ? '' : COIN(16)} ${K.fmt(e.v)}</span></button></li>`; }).join('')
    : '<li class="muted" style="padding:10px 4px">Пока пусто. Стань первым!</li>';
  const last = tab === 'week' && b.lastWeek && b.lastWeek.top.length ? `<div class="box"><b>Герои прошлой недели:</b> ${b.lastWeek.top.map(e => '@' + esc(e.nick)).join(', ')}</div>` : '';
  open(`<h2>Рейтинг королевства</h2>
    <div class="tabs" role="tablist">${TABS.map(t => `<button type="button" role="tab" aria-selected="${t.id === tab}" data-t="${t.id}">${t.name}</button>`).join('')}</div>
    <p class="muted">${T.hint}</p>${last}<ol class="board">${rows}</ol>`, () => {
    body.querySelector('.tabs').addEventListener('click', e => { const t = e.target.dataset.t; if (t) rateSheet(t); });
    body.querySelector('.board').addEventListener('click', e => { const n = e.target.closest('button')?.dataset.n; if (!n) return; close(); if (!K.select(n)) K.toast(`Дом @${n} ещё не построен на карте.`); });
  });
}
$('bRate').addEventListener('click', async () => { try { await refresh(); } catch (_) { } rateSheet(); });

// ---------------- казна ----------------
function treasurySheet() {
  const tr = STATE.treasury;
  const cards = tr.projects.map(p => { const cur = p.id === tr.current, pct = Math.round(100 * p.raised / p.goal);
    return `<div class="proj ${cur ? 'cur' : ''} ${p.done ? 'done' : ''}"><h3>${p.name}</h3><div class="muted">${p.about}</div>
      ${p.done || cur ? `<div class="prog"><i style="width:${pct}%"></i></div><div class="row" style="justify-content:space-between"><span class="coins">${COIN(16)} ${K.fmt(p.raised)} / ${K.fmt(p.goal)}</span><span class="muted">${pct}%</span></div>` : `<div class="muted" style="margin-top:6px">Откроется после предыдущей стройки · цель ${K.fmt(p.goal)}</div>`}
      ${cur ? `<div class="amounts" id="am"><button type="button" data-a="10">10</button><button type="button" data-a="50">50</button><button type="button" data-a="100">100</button><button type="button" data-a="all">Всё</button><input id="amt" type="number" min="1" inputmode="numeric" placeholder="Своё" aria-label="Сколько монет вложить"></div>
        <button class="btn btn-gold" id="tGo" type="button" style="width:100%">Вложить в «${p.name}»</button>` : ''}
      ${p.donors.length ? `<div class="muted" style="margin-top:8px">Вкладчики: ${p.donors.map(d => '@' + esc(d.nick) + ' (' + d.v + ')').join(', ')}</div>` : ''}</div>`; }).join('');
  open(`<h2>Казна королевства</h2><p class="muted">Подданные вместе строят здания на карте. Когда сумма собрана, постройка появляется у всех, а вкладчиков вписывают на табличку. Вложенные монеты не возвращаются.</p>
    ${ME ? `<div class="box coins">${COIN(18)} У тебя ${K.fmt(ME.coins)} монет</div>` : ''}${cards}`, () => {
    $('am')?.addEventListener('click', e => { const a = e.target.dataset.a; if (!a) return; $('amt').value = a === 'all' ? (ME ? ME.coins : '') : a; });
    $('tGo')?.addEventListener('click', e => needLogin(async () => {
      const amount = Number($('amt')?.value || 0); if (!amount) { K.toast('Выбери, сколько монет вложить.'); return; }
      busy(e.target, true); try { const r = await call('donate', { amount }); await refresh(); K.toast(`Ты вложил ${r.amount} монет. Спасибо от короля!`); treasurySheet(); } catch (err) { fail(err); busy(e.target, false); }
    }));
  });
}
$('bTreasury').addEventListener('click', async () => { try { await refresh(); } catch (_) { } treasurySheet(); });

// ---------------- админка (#admin) ----------------
function adminSheet() {
  open(`<h2>Админка короля</h2><p class="muted">Начислить монеты (за комментарий, сторис, конкурс) или сбросить PIN подданному.</p>
    <label class="field"><span>Ключ администратора</span><input id="aKey" type="password" autocomplete="off"></label>
    <label class="field"><span>Ник</span><input id="aNick" autocapitalize="off" spellcheck="false"></label>
    <label class="field"><span>Монеты (можно со знаком минус)</span><input id="aAmt" type="number" inputmode="numeric"></label>
    <div class="err" id="aErr"></div>
    <div class="row"><button class="btn btn-gold" data-op="coins" type="button">Начислить</button><button class="btn btn-paper" data-op="resetPin" type="button">Сбросить PIN</button><button class="btn btn-paper" data-op="info" type="button">Проверить</button></div>`, () => {
    body.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', async () => {
      $('aErr').textContent = '';
      try { const r = await api('admin', { key: $('aKey').value, op: b.dataset.op, nick: $('aNick').value, amount: $('aAmt').value });
        $('aErr').style.color = '#9fd17a'; $('aErr').textContent = r.player ? `@${r.player.nick}: ${r.player.coins} монет, ${r.player.house}. ${r.note || ''}` : 'Этот ник ещё не входил на сайт.'; }
      catch (err) { $('aErr').style.color = ''; $('aErr').textContent = err.message; }
    }));
  });
}

// ---------------- старт ----------------
try {
  STATE = await detect(); K.setRoles && K.setRoles(STATE.roles); K.setLevels(STATE.levels); K.setDecor && K.setDecor(STATE.decor); K.setProjects(STATE.treasury);
  if (AUTH) { try { const r = await api('me', AUTH); setMe(r.me); } catch (_) { AUTH = null; try { localStorage.removeItem('kp-auth'); } catch (__) { } } }
} catch (e) { console.error(e); }
if (location.hash === '#admin') adminSheet();
addEventListener('hashchange', () => { if (location.hash === '#admin') adminSheet(); });
