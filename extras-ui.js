// Интерфейс новинок (14.11.2026): обучение новичка, награда за вход, «позови друга», подарок под ёлкой, питомцы, звуки.
import { G, act, openSheet } from './rpg-ui.js';
import { DRAGON, dragonStage, petShow, TUT, LOGIN, REF, PETS, TREE, DUNGEON, LOOKS, ENCH, enchColor, OWAR, lookKey, OCASTLE, HUNT, BIZ, bizCash, JOBS, JOB } from './extras.mjs';
import { POI } from './quests.mjs';
import { ITEMS } from './quests.mjs';
import { ENEMIES, enemyPos, GEAR, gearSlot, activeGear, CLASSES, SKILLS, CLASS_LVL, CLASS_CHANGE } from './combat.mjs';
import { buildPet } from './monsters.js';
import { NET, retrack } from './net.js';
import { act3d, attackClip, buildMon3D, wantMon, animate3d } from './hero3d.js';

let W, K, R;
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } } };
const itemsText = list => (list || []).map(([i, n]) => (ITEMS[i]?.icon || '') + ' ' + (ITEMS[i]?.name || i) + (n > 1 ? ' ×' + n : '')).join(', ');

// ссылка-приглашение: запоминаем, кто позвал, до первого входа в «Мир героев»
{ const m = /(?:^#|&)ref=([^&]+)/.exec(location.hash); if (m) ls.set('kp-ref', decodeURIComponent(m[1]).replace(/^@/, '').toLowerCase()); }

// ---------------- звуки (синтез, без файлов) ----------------
let AC = null; const sfxOn = () => ls.get('kp-sfx') !== '0';
function tone(f, t0, dur, type = 'sine', vol = 0.12, f2) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02); }
function noise(t0, dur, vol = 0.15, freq = 900) { const n = AC.createBufferSource(), b = AC.createBuffer(1, Math.ceil(AC.sampleRate * dur), AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const f = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol; n.buffer = b; n.connect(f).connect(g).connect(AC.destination); n.start(t0); }
export function sfx(kind) {
  if (!sfxOn()) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { return; }
  const t = AC.currentTime;
  if (kind === 'hit') { noise(t, 0.12, 0.25, 1400); tone(180, t, 0.12, 'square', 0.05, 90); }
  else if (kind === 'gather') { noise(t, 0.08, 0.2, 600); noise(t + 0.14, 0.08, 0.18, 700); }
  else if (kind === 'coin') { tone(1320, t, 0.09, 'triangle', 0.1); tone(1760, t + 0.07, 0.16, 'triangle', 0.1); }
  else if (kind === 'level') [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.35, 'triangle', 0.11));
  else if (kind === 'gift') [784, 988, 1175, 1568, 1319].forEach((f, i) => tone(f, t + i * 0.08, 0.3, 'sine', 0.09));
  else if (kind === 'win') [392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.28, 'square', 0.05));
  else if (kind === 'click') tone(660, t, 0.05, 'triangle', 0.05);
}

// ---------------- обучение ----------------
let tutBusy = false, tutLast = 0, dailyShown = false, refTried = false;
const tutOn = () => { const s = G.state; return s && s.extra && !s.extra.tut.done && s.hero.level <= 6; };
function tutTarget(step) {
  const p = R.state().pos; if (!p) return null;
  if (step.x != null) return { x: step.x, z: step.z };
  if (step.id === 'gather') { let best = null, bd = 1e9; for (const o of G.nodes.values()) { if (o.n.taken || !o.g.visible) continue; const d = Math.hypot(o.n.x - p.x, o.n.z - p.z); if (d < bd) { bd = d; best = o.n; } } return best ? { x: best.x, z: best.z } : null; }
  if (step.id === 'fight') { const now = Date.now(), dead = G.state?.combat?.defeated || {}; let best = null, bd = 1e9;
    for (const e of ENEMIES) { if (e.lvl > 4 || dead[e.id] || e.night || e.dungeon) continue; const q = enemyPos(e, now), d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } } return best; }
  return null;
}
function tutPanel() {
  let el = W.$('tutP'); if (!tutOn()) { if (el) el.hidden = true; G.tutTarget = null; return; }
  if (!el) { el = document.createElement('div'); el.id = 'tutP'; el.className = 'panel'; document.body.appendChild(el); }
  const i = G.state.extra.tut.step, st = TUT[i]; if (!st) { el.hidden = true; return; }
  const key = i + '|' + G.state.hero.nick; if (el.dataset.k !== key) { el.dataset.k = key;
    el.innerHTML = `<div class="tH">🎓 Обучение · шаг ${i + 1} из ${TUT.length}</div><div class="tT">${st.icon} ${esc(st.text)}</div><div class="tB">${TUT.map((_, k) => `<i class="${k < i ? 'ok' : k === i ? 'cur' : ''}"></i>`).join('')}</div><div class="tF"><small>Иди к золотому лучу ✨ · награда: меч, зелья и 100 монет</small><button type="button" class="tS">пропустить</button></div>`;
    el.querySelector('.tS').onclick = e => { e.stopPropagation(); if (confirm('Пропустить обучение? Награду за него получить уже не выйдет.')) act('tutorial', { op: 'skip' }); }; }
  el.hidden = !R.state().on;
}
async function tutCheck(force) {
  if (!tutOn() || tutBusy) return; const now = performance.now(); if (!force && now - tutLast < 4000) return;
  tutBusy = true; tutLast = now; try { const r = await act('tutorial', {}, true); if (r && r.data?.tutOk) { sfx(G.state?.extra?.tut.done ? 'level' : 'coin'); W.toast(r.data.note); } } finally { tutBusy = false; }
}

// ---------------- окно «Награды»: вход каждый день, друзья, праздник, питомцы ----------------
export function rewardsSheet() {
  const s = G.state, x = s.extra, lg = x.login, nick = s.hero.nick;
  const today = lg.claimed ? lg.streak : lg.streak + 1, cur = (today - 1) % 7;
  const days = LOGIN.map((d, k) => { const got = lg.claimed ? k <= cur : k < cur, now = k === cur;
    return `<div class="dC${got ? ' got' : ''}${now ? ' now' : ''}"><b>День ${d.day}</b><span>${d.icon}</span><small>${[d.coins ? d.coins + ' 🪙' : '', d.items ? itemsText(d.items) : '', d.chest ? 'сундук с редкой вещью' : ''].filter(Boolean).join('<br>')}</small>${got ? '<em>✓</em>' : ''}</div>`; }).join('');
  const link = location.origin + location.pathname + '#ref=' + encodeURIComponent(nick);
  const pets = Object.entries(PETS).map(([id, p]) => `<div class="pR"><span>${p.icon}</span><span><b>${p.name}</b><br><small>${p.text}</small></span><small>${id === 'pet_wolf' ? 'в подарках и подземелье' : p.price + ' 🪙 у торговца'}</small></div>`).join('');
  const dn = x.drg || 0, ds = dragonStage(dn), nx = DRAGON[ds], hasDr = (s.inventory || []).some(i => i.item === 'pet_dragon');
  const drgBox = `<div class="pR" style="border:1px solid #E0602E55;border-radius:10px;padding:6px"><span>${DRAGON[ds - 1].icon}</span><span><b>${hasDr ? DRAGON[ds - 1].name : 'Растущий дракон'}</b><br><small>${DRAGON.map((d, k) => `${k + 1}) ${d.name}: +${Math.round(d.bonus.coins * 100)}% монет и опыта, +${d.bonus.atk} атаки${d.at ? ` — с ${d.at} побед` : ''}`).join('<br>')}</small>${hasDr ? `<div class="xbar"><i style="width:${nx ? Math.min(100, 100 * (dn - DRAGON[ds - 1].at) / (nx.at - DRAGON[ds - 1].at)) : 100}%"></i></div><small>Побед с драконом: <b>${dn}</b>${nx ? ` · до «${nx.name}» ещё ${nx.at - dn}` : ' · дракон вырос полностью!'}</small>` : '<br><small>Купи яйцо у торговца, надень как питомца — и он растёт с каждой победой.</small>'}</span></div>`;
  openSheet(`<h2>🎁 Награды</h2>
    <h3 class="xH">Награда за вход каждый день</h3><p class="rw">Заходи каждый день подряд — награда растёт. Пропустишь день — серия начнётся заново. Серия: <b>${lg.streak}</b> дн.</p>
    <div class="dG">${days}</div>
    <button class="btn btn-gold" id="xClaim" type="button" ${lg.claimed ? 'disabled' : ''} style="width:100%;margin-top:8px">${lg.claimed ? 'Сегодня уже получено — приходи завтра!' : `Забрать награду дня ${lg.nextDay}`}</button>
    <h3 class="xH">🤝 Позови друга</h3><p class="rw">Друг подписывается на <b>@korol_podpi</b>, заходит в «Мир героев» по твоей ссылке — и вы оба получаете по <b>${REF.inviterCoins} монет</b>. За ${REF.horseAt} друзей — <b>конь в подарок</b> 🐴</p>
    <div class="xL"><input id="xLink" readonly value="${esc(link)}"><button class="btn btn-paper" id="xCopy" type="button">Копировать</button>${navigator.share ? '<button class="btn btn-paper" id="xShare" type="button">Поделиться</button>' : ''}</div>
    <div class="xbar"><i style="width:${Math.min(100, 100 * x.ref.n / REF.horseAt)}%"></i></div><small class="rw">Пришло по твоей ссылке: <b>${x.ref.n}</b>${x.ref.n < REF.horseAt ? ` · до коня осталось ${REF.horseAt - x.ref.n}` : ' · конь уже твой!'}${x.ref.by ? ` · тебя позвал @${esc(x.ref.by)}` : ''}</small>
    ${x.ny ? `<h3 class="xH">🎄 Новогодний праздник</h3><p class="rw">Каждый день под ёлкой на площади у ворот ждёт подарок${x.gift ? ' — сегодняшний уже у тебя' : ''}. По субботам в 20:00 приходит <b>Снежный король</b> — бейте его всем королевством!</p>` : ''}
    <h3 class="xH">💼 Работа и бизнес</h3>${jobsHtml()}<p class="rw"><small>🏪 Свой бизнес — таверну, кузницу, лавку или меняльную контору — можно купить в <b>Торговом квартале</b> к западу от замка.</small></p><button class=\"btn btn-paper\" type=\"button\" id=\"jbGo\">✨ Показать дорогу в Торговый квартал</button>
    <h3 class="xH">🗺 Клад дня</h3><p class="rw">Загадка: <b>«${esc(x.hunt.hint)}»</b></p><p class="rw">Иди туда и жми ⛏ (или G) — копать можно раз в 15 секунд, игра подскажет «тепло» или «холодно». Первый нашедший получает редкую вещь и ${HUNT.firstCoins} монет, следующие ${HUNT.maxFinders - 1} — по ${HUNT.nextCoins} монет и самоцвету.${x.hunt.mine ? ' <b>Сегодняшний клад ты уже нашёл!</b>' : x.hunt.first ? ` Первым сегодня был @${esc(x.hunt.first)}.` : ' Сегодня клад ещё никто не нашёл!'}</p>
    <h3 class="xH">⚔️ Война орденов</h3><p class="rw">Каждое воскресенье с 19:00 до 20:00 ордены бьются за пять флагов: у рынка, болота, шахты, моста и арены. Подойди к флагу и укрепляй его раз в 20 секунд — чем выше уровень, тем больше влияния. Флаг достаётся ордену с наибольшим влиянием. Орден с большинством флагов побеждает: всем участникам монеты и опыт, победителям — +${OWAR.winBonus} монет сверху, а флаги неделю горят цветом победителей.${x.war?.last?.winners?.length ? ` Прошлая война: победил «${esc(x.war.last.winners[0].name)}».` : ''}</p>
    <h3 class="xH">🐾 Питомцы</h3><div class="pL">${pets}${drgBox}</div><p class="rw">Питомец ходит за тобой по пятам. Надень его в «🎒 Герой».</p>
    <h3 class="xH">⛏ Подземелье</h3><p class="rw">В горах на северо-западе — шахта. У входа ждёт <b>Горный король</b>: его общее здоровье на весь орден, одолеть можно только вместе (от ${DUNGEON.needMembers} героев ордена), раз в день. Награда каждому: ${DUNGEON.rewardXp} опыта, ${DUNGEON.rewardCoins} монет, самоцветы и шанс на эпическую вещь.</p>
    <label class="xS"><input type="checkbox" id="xSfx" ${sfxOn() ? 'checked' : ''}> 🔊 Звуки в игре</label>`, b => {
    b.querySelector('#xClaim').onclick = async e => { e.target.disabled = true; const r = await act('daily', {}, true); if (r && r.status === 200) { sfx('gift'); W.toast(r.data.note); rewardsSheet(); } else { e.target.disabled = false; if (r) W.toast(r.data.message || 'Не получилось'); } };
    b.querySelector('#xCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); W.toast('Ссылка скопирована. Отправь её другу!'); } catch { b.querySelector('#xLink').select(); document.execCommand('copy'); W.toast('Ссылка скопирована'); } };
    const sh = b.querySelector('#xShare'); if (sh) sh.onclick = () => navigator.share({ title: 'Королевство подписчиков', text: 'Заходи в «Мир героев» — получишь 150 монет на старте!', url: link }).catch(() => { });
    jobsBind(b, rewardsSheet); { const g = b.querySelector('#jbGo'); if (g) g.onclick = () => { G.castleGo = { x: BIZ.street.x, z: BIZ.street.z, msg: '🏪 Ты в Торговом квартале! Подойди к любому участку.' }; W.$('sheet').classList.remove('show'); W.toast('Иди за золотым лучом в Торговый квартал'); }; }
    b.querySelector('#xSfx').onchange = e => { ls.set('kp-sfx', e.target.checked ? null : '0'); if (e.target.checked) sfx('coin'); };
  });
}

// ---------------- облик героя ----------------
const hex = c => '#' + (c ?? 0xcccccc).toString(16).padStart(6, '0');
const HATI = { feather: '🪶', wizard: '🧙', viking: '⛑', laurel: '🌿', santa: '🎅' };
export function lookSheet() {
  const L = G.state.extra.look, cur = L.cur || {}, coins = G.state.coins;
  const sec = kind => { const cat = LOOKS[kind]; return `<h3 class="xH">${cat.name}</h3><div class="lkG">${Object.entries(cat.list).map(([id, it]) => { const own = L.owned.includes(kind + ':' + id), on = cur[kind] === id;
    const sw = kind === 'hat' ? `<span class="lkI">${HATI[id]}</span>` : `<span class="lkS" style="background:${hex(it.color)}${kind === 'aura' ? `;box-shadow:0 0 14px ${hex(it.color)}` : ''}"></span>`;
    return `<button type="button" class="lkB${on ? ' on' : ''}" data-k="${kind}" data-id="${id}" data-own="${own ? 1 : 0}">${sw}<b>${it.name}</b><small>${on ? 'надето' : own ? 'надеть' : it.price + ' 🪙'}</small></button>`; }).join('')}
    ${cur[kind] ? `<button type="button" class="lkB" data-k="${kind}" data-id="" data-own="1"><span class="lkI">✖</span><b>Снять</b><small>&nbsp;</small></button>` : ''}</div>`; };
  openSheet(`<h2>👗 Облик героя</h2><p class="rw">Купленное остаётся навсегда — меняй наряд когда хочешь. Его видят все игроки. Монет: <b>${K.fmt(coins)}</b></p>${['cape', 'hair', 'hat', 'aura'].map(sec).join('')}`, b => {
    b.querySelectorAll('.lkB').forEach(x => x.onclick = async () => { const own = x.dataset.own === '1', it = x.dataset.id && LOOKS[x.dataset.k].list[x.dataset.id];
      if (!own && !confirm(`Купить «${it.name}» за ${it.price} монет?`)) return; x.disabled = true;
      const r = await act('look', { op: own ? 'set' : 'buy', kind: x.dataset.k, id: x.dataset.id }); if (r && r.status === 200) { sfx(own ? 'click' : 'coin'); window.RPG?.refreshHero?.(); lookSheet(); } else x.disabled = false; }); });
}

// ---------------- заточка оружия ----------------
// ---------------- класс героя и умения ----------------
export function classSheet() {
  const s = G.state, cur = s.extra.cls, lv = s.hero.level;
  const card = ([id, c]) => { const sk = Object.entries(SKILLS).filter(([, k]) => k.cls === id);
    return `<div class="enR" style="flex-direction:column;align-items:stretch;${cur === id ? 'border:2px solid var(--gold);' : ''}"><div><span style="font-size:26px">${c.icon}</span> <b style="font-size:17px">${c.name}</b>${cur === id ? ' <small style="color:var(--gold)">твой класс</small>' : ''}<br><small>${c.text}</small></div>
      <div style="margin:6px 0">${sk.map(([, k]) => `<div style="opacity:${lv >= k.lvl ? 1 : 0.5}">✨ <b>${k.name}</b> <small>с ${k.lvl} ур. · ${k.cd} с · ${k.text}</small></div>`).join('')}</div>
      ${cur === id ? '' : `<button class="btn ${cur ? 'btn-paper' : 'btn-gold'}" type="button" data-cl="${id}" ${lv >= CLASS_LVL ? '' : 'disabled'}>${cur ? `Сменить за ${CLASS_CHANGE} 🪙` : 'Выбрать бесплатно'}</button>`}</div>`; };
  openSheet(`<h2>⚔ Класс и умения</h2><p class="rw">С ${CLASS_LVL} уровня герой выбирает путь. Класс даёт постоянный бонус и три умения для боя — они открываются на 20, 35 и 50 уровне и появляются кнопками в бою (клавиши 7, 8, 9).</p>
    ${lv < CLASS_LVL ? `<p class="rw" style="color:var(--gold)">Твой уровень ${lv}. Класс откроется на ${CLASS_LVL} уровне.</p>` : ''}<div class="enL">${Object.entries(CLASSES).map(card).join('')}</div>`, b => {
    b.querySelectorAll('[data-cl]').forEach(x => x.onclick = async () => { x.disabled = true; const r = await act('cls', { id: x.dataset.cl }, true);
      if (r && r.status === 200) { sfx('level'); W.toast(r.data.note); try { const h = R.state().hero; if (h?.userData?.a3) act3d(h, 'Cheer', 1); } catch { } } else if (r) W.toast(r.data.message || 'Не получилось'); classSheet(); }); });
}
export function enchSheet() {
  const s = G.state, E = s.extra.ench || {}, gems = (s.inventory.find(i => i.item === 'gem') || {}).qty || 0, p = R.state().pos;
  const nearK = true; // точить можно где угодно
  const ws = s.inventory.filter(i => GEAR[i.item] && gearSlot(i.item) === 'weapon' && i.qty > 0);
  const row = i => { const l = E[i.item] || 0, c = ENCH.cost(l), ch = Math.round((ENCH.chance[l] ?? 0) * 100), it = ITEMS[i.item];
    return `<div class="enR"><span class="enI">${it.icon}</span><span style="flex:1"><b>${it.name}</b> <b style="color:${l ? hex(enchColor(l) || 0xFFD23A) : 'var(--muted)'}">+${l}</b>${i.equipped ? ' <small>в руках</small>' : ''}<br>
      <small>${l >= ENCH.max ? 'Предел достигнут!' : `Следующая: +${l + 1} (атака +${ENCH.atk * (l + 1)}) · 💎 ${c.gem} и ${c.coins} 🪙 · шанс ${ch}%${l >= ENCH.dropFrom ? ' · при неудаче −1' : ''}`}</small></span>
      ${l < ENCH.max ? `<button class="btn btn-gold" type="button" data-en="${i.item}" ${nearK && gems >= c.gem ? '' : 'disabled'}>Точить</button>` : ''}</div>`; };
  openSheet(`<h2>⚒ Заточка оружия</h2><p class="rw">Точи оружие самоцветами 💎 из шахты на северо-западе — прямо отсюда, где бы ты ни был. Каждая ступень — +${ENCH.atk} к атаке. С +4 оружие светится синим, с +7 — фиолетовым, на +10 — золотом. Чем выше заточка, тем меньше шанс${''}; с +${ENCH.dropFrom} неудача снимает одну ступень.</p>
    <p>💎 Самоцветов: <b>${gems}</b> · 🪙 ${K.fmt(s.coins)}</p>${nearK ? '' : '<p class="rw" style="color:var(--gold)">Подойди к кузнецу во дворе замка — точить можно только у него.</p>'}
    ${ws.length ? `<div class="enL">${ws.map(row).join('')}</div>` : '<p class="rw">У тебя пока нет оружия. Закажи у кузнеца или найди в бою.</p>'}`, b => {
    b.querySelectorAll('[data-en]').forEach(x => x.onclick = async () => { x.disabled = true; const r = await act('enchant', { item: x.dataset.en }, true);
      if (r && r.status === 200) { sfx(r.data.enchant?.ok ? 'level' : 'hit'); W.toast(r.data.note); } else if (r) W.toast(r.data.message || 'Не получилось'); enchSheet(); }); });
}

// ---------------- ауры и свечение заточенного оружия ----------------
const FX = new Map(); let auraTex = null;
function auraTexture() { if (auraTex) return auraTex; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); auraTex = new W.THREE.CanvasTexture(c); return auraTex; }
function fxFor(key, owner, aura, el, now) {
  const THREE = W.THREE; let f = FX.get(key); const ac = aura && LOOKS.aura.list[aura]?.color, gc = enchColor(el || 0);
  if (!owner || (!ac && !gc)) { if (f) { f.ring && f.ring.parent?.remove(f.ring); f.parts && f.parts.parent?.remove(f.parts); f.glow && f.glow.parent?.remove(f.glow); FX.delete(key); } return; }
  if (!f || f.owner !== owner || f.ac !== ac || f.gc !== gc) { if (f) fxFor(key, null); f = { owner, ac, gc };
    if (ac) { f.ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.75, 32), new THREE.MeshBasicMaterial({ color: ac, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); f.ring.rotation.x = -Math.PI / 2; f.ring.position.y = 0.04; owner.add(f.ring);
      const n = 14, pos = new Float32Array(n * 3); f.seed = Array.from({ length: n }, () => [Math.random() * 6.28, Math.random(), 0.3 + Math.random() * 0.35]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); f.parts = new THREE.Points(g, new THREE.PointsMaterial({ color: ac, size: 0.16, map: auraTexture(), transparent: true, depthWrite: false })); f.parts.frustumCulled = false; owner.add(f.parts); }
    if (gc) { const a3 = owner.userData?.a3, arm = a3 ? owner.userData.hand : owner.userData?.armR; if (arm) { f.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTexture(), color: gc, transparent: true, depthWrite: false, opacity: 0.85 })); if (a3) { const ws = new THREE.Vector3(); arm.getWorldScale(ws); f.glow.position.set(0, 0.45 / (ws.y || 1), 0); f.glow.scale.setScalar(0.7 / (ws.y || 1)); } else { f.glow.position.set(0, -0.42, 0.22); f.glow.scale.setScalar(0.65); } arm.add(f.glow); } }
    FX.set(key, f); }
  const t = now / 1000;
  if (f.ring) { f.ring.material.opacity = 0.35 + 0.2 * Math.sin(t * 3); f.ring.rotation.z = t * 0.6; const a = f.parts.geometry.attributes.position.array;
    f.seed.forEach(([ph, sp, r], i) => { const k = (t * (0.35 + sp * 0.3) + sp) % 1; a[i * 3] = Math.cos(ph + t) * r; a[i * 3 + 1] = k * 1.9; a[i * 3 + 2] = Math.sin(ph + t) * r; }); f.parts.geometry.attributes.position.needsUpdate = true; }
  if (f.glow) f.glow.material.opacity = 0.6 + 0.3 * Math.sin(t * 5);
}

// ---------------- война орденов: флаги в мире, табло, кнопка у флага ----------------
const FLAGM = new Map(); let warBtn = null, warNear = null, warPanel = null;
function flagMesh() { const THREE = W.THREE, g = new THREE.Group();
  W.mesh(g, new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), 0x4E3020, { pos: [0, 2.1, 0] }); W.mesh(g, new THREE.SphereGeometry(0.14, 10, 8), 0xE8B931, { pos: [0, 4.25, 0] });
  W.mesh(g, new THREE.CylinderGeometry(0.9, 1.05, 0.3, 14), 0x8C857B, { pos: [0, 0.15, 0] });
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 1).translate(0.8, 0, 0), new THREE.MeshToonMaterial({ color: 0xF5EBDC, gradientMap: W.grad, side: THREE.DoubleSide })); cloth.position.set(0.08, 3.6, 0); g.add(cloth); g.userData.cloth = cloth;
  g.userData.base = cloth.geometry.attributes.position.array.slice(); return g; }
function warTick(now, p) {
  const war = G.state?.extra?.war; const show = R.state().on;
  for (const f of OWAR.flags) { let o = FLAGM.get(f.id); if (!o) { o = flagMesh(); o.position.set(f.x, 0, f.z); W.scene.add(o); FLAGM.set(f.id, o); }
    o.visible = show; const info = war?.active ? war.flags?.find(x => x.id === f.id) : war?.last?.flags?.find(x => x.id === f.id); const col = info?.color ? parseInt(info.color.slice(1), 16) : 0xF5EBDC;
    if (o.userData.col !== col) { o.userData.col = col; o.userData.cloth.material.color.setHex(col); }
    const pa = o.userData.cloth.geometry.attributes.position, b = o.userData.base; for (let i = 0; i < pa.count; i++) { const x = b[i * 3]; pa.setZ(i, Math.sin(x * 3 - now / 200) * 0.1 * x); } pa.needsUpdate = true; }
  // табло войны
  if (!warPanel) { warPanel = document.createElement('div'); warPanel.id = 'warP'; warPanel.className = 'panel'; document.body.appendChild(warPanel); }
  const left = war ? (war.active ? war.end : war.start) - Date.now() : 0, soon = war && !war.active && left < 3 * 36e5;
  warPanel.hidden = !show || !war || !(war.active || soon);
  if (!warPanel.hidden) { const mm = Math.max(0, Math.round(left / 6e4));
    warPanel.innerHTML = war.active ? `<b>⚔️ Война орденов · ещё ${mm} мин</b>${war.flags.map(f => `<div><i style="background:${f.color || '#666'}"></i>${OWAR.flags.find(x => x.id === f.id).name.replace('Флаг ', '')}: ${f.name ? esc(f.name) : '<small>ничей</small>'}</div>`).join('')}`
      : `<b>⚔️ Война орденов через ${mm >= 60 ? Math.floor(mm / 60) + ' ч ' : ''}${mm % 60} мин</b><small>Воскресенье 19:00 · захватывай флаги вместе с орденом</small>`; }
  // кнопка у флага
  warNear = war?.active && p ? OWAR.flags.find(f => Math.hypot(p.x - f.x, p.z - f.z) <= OWAR.r) : null;
  if (warNear && !warBtn) { warBtn = document.createElement('button'); warBtn.id = 'warBtn'; warBtn.className = 'btn btn-gold'; warBtn.type = 'button'; document.body.appendChild(warBtn);
    warBtn.onclick = async () => { if (!warNear) return; warBtn.disabled = true; const r = await act('owar', { flag: warNear.id }); if (r && r.status === 200) sfx('hit'); setTimeout(() => warBtn && (warBtn.disabled = false), 1500); }; }
  if (warBtn) { warBtn.hidden = !warNear; if (warNear) warBtn.textContent = `🚩 Укрепить: ${warNear.name}`; }
}

// ---------------- замок ордена ----------------
export const CM = new Map();
export function castleModel(lvl, color) { // замок ордена: у каждого из 6 уровней своя, всё более богатая постройка
  const THREE = W.THREE, g = new THREE.Group(), col = parseInt((color || '#E8B931').slice(1), 16), M = (geo, c, pos, rot) => W.mesh(g, geo, c, { pos, rot, ol: 1.2 });
  const glow = (geo, c, pos) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c })); m.position.set(...pos); g.add(m); return m; };
  const stone = lvl >= 5 ? 0xD8D0C2 : 0xB0A898, trim = lvl >= 5 ? 0xE8B931 : 0x8C857B, wood = 0x8A5A32, dark = 0x4E3020, roofC = lvl >= 5 ? 0xE8B931 : col, gold = 0xE8B931;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(OCASTLE.r, 48), W.toon(lvl >= 3 ? 0xC9BFA9 : lvl >= 1 ? 0xA8946A : 0x8C7A5A)); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.03; g.add(ground);
  const banner = (x, z, h, big) => { M(new THREE.CylinderGeometry(0.06, 0.07, h, 6), 0x3A2A1E, [x, h / 2, z]); M(new THREE.SphereGeometry(0.1, 8, 6), gold, [x, h + 0.05, z]);
    M(new THREE.BoxGeometry(big ? 1.3 : 0.9, big ? 0.8 : 0.55, 0.05), col, [x + (big ? 0.68 : 0.47), h - (big ? 0.5 : 0.35), z]); };
  const torch = (x, z, h = 1.4) => { M(new THREE.CylinderGeometry(0.05, 0.06, h, 6), dark, [x, h / 2, z]); glow(new THREE.ConeGeometry(0.14, 0.32, 8), 0xFFB040, [x, h + 0.14, z]); };
  const fire = (x, z) => { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; M(new THREE.SphereGeometry(0.16, 6, 5), 0x6E6A60, [x + Math.sin(a) * 0.45, 0.1, z + Math.cos(a) * 0.45]); } glow(new THREE.ConeGeometry(0.28, 0.75, 7), 0xFF7A2A, [x, 0.4, z]); glow(new THREE.ConeGeometry(0.15, 0.5, 7), 0xFFD060, [x, 0.38, z]); };
  const tent = (x, z, ry, c) => { M(new THREE.ConeGeometry(1.35, 1.9, 4), c, [x, 0.95, z], [0, ry + 0.785, 0]); M(new THREE.BoxGeometry(0.5, 0.9, 0.05), dark, [x + Math.sin(ry) * 0.95, 0.45, z + Math.cos(ry) * 0.95], [0, ry, 0]); };
  const barrel = (x, z) => M(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 10), wood, [x, 0.3, z]);
  const crate = (x, z) => M(new THREE.BoxGeometry(0.55, 0.55, 0.55), 0xA8783E, [x, 0.28, z]);
  // зубцы по линии
  const merlons = (x1, z1, x2, z2, y, c) => { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(L / 0.8)); for (let i = 0; i <= n; i += 2) { const k = i / n; M(new THREE.BoxGeometry(0.42, 0.42, 0.42), c, [x1 + (x2 - x1) * k, y + 0.21, z1 + (z2 - z1) * k]); } };
  const wall = (x1, z1, x2, z2, h, th, c) => { const L = Math.hypot(x2 - x1, z2 - z1); M(new THREE.BoxGeometry(L, h, th), c, [(x1 + x2) / 2, h / 2, (z1 + z2) / 2], [0, -Math.atan2(z2 - z1, x2 - x1), 0]); };
  const rtower = (x, z, r, h, roofCol, crown) => { M(new THREE.CylinderGeometry(r, r * 1.1, h, 14), stone, [x, h / 2, z]); M(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.35, 14), trim, [x, h + 0.17, z]);
    if (crown) for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; M(new THREE.BoxGeometry(0.32, 0.38, 0.32), stone, [x + Math.sin(a) * r * 1.05, h + 0.54, z + Math.cos(a) * r * 1.05]); }
    M(new THREE.ConeGeometry(r * 1.25, r * 2.1, 14), roofCol, [x, h + (crown ? 0.7 : 0.35) + r * 1.05, z]); M(new THREE.BoxGeometry(0.22, 0.5, 0.05), 0x2A2420, [x, h * 0.62, z + r * 1.02]); };
  const palisade = (R0, gap) => { for (let a = 0; a < 6.283; a += 0.17) { if (Math.abs(((a + Math.PI) % 6.283) - Math.PI) < gap) continue; const x = Math.sin(a) * R0, z = Math.cos(a) * R0; M(new THREE.CylinderGeometry(0.17, 0.19, 2.0, 6), wood, [x, 1.0, z]); M(new THREE.ConeGeometry(0.19, 0.4, 6), dark, [x, 2.2, z]); } };
  if (lvl === 0) { // флаг ордена: расчищенная поляна, шатёр и костёр
    for (let a = 0; a < 6.283; a += 0.35) M(new THREE.DodecahedronGeometry(0.28, 0), 0x8C857B, [Math.sin(a) * 6.5, 0.12, Math.cos(a) * 6.5]);
    banner(0, -1, 3.6, true); tent(-2.2, -1.5, 0.4, col); fire(1.2, 1.4); crate(2.6, -1.4); barrel(2.0, -2.0); return g; }
  if (lvl === 1) { // лагерь: частокол, шатры, костёр, оружейная стойка
    palisade(6.4, 0.35); tent(-2.6, -2.2, 0.5, col); tent(2.6, -2.2, -0.5, col); tent(0, -3.6, 0, 0xF2E6CC); fire(0, 0.6);
    M(new THREE.BoxGeometry(1.6, 0.1, 0.1), dark, [-3.2, 1.0, 1.8]); for (let i = 0; i < 4; i++) M(new THREE.BoxGeometry(0.06, 1.1, 0.06), 0x9AA0AA, [-3.8 + i * 0.4, 0.75, 1.85]);
    barrel(3.2, 1.6); barrel(3.6, 2.2); crate(2.8, 2.6); banner(-1.2, 6.1, 3.6, true); banner(1.2, 6.1, 3.6, true); torch(-1.2, 5.6); torch(1.2, 5.6); return g; }
  if (lvl === 2) { // деревянный форт: частокол-квадрат, две сторожевые башни, длинный дом
    const H = 6; for (const [x1, z1, x2, z2] of [[-H, -H, H, -H], [-H, -H, -H, H], [H, -H, H, H], [-H, H, -1.4, H], [1.4, H, H, H]]) { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.round(L / 0.42); for (let i = 0; i <= n; i++) { const k = i / n, x = x1 + (x2 - x1) * k, z = z1 + (z2 - z1) * k; M(new THREE.CylinderGeometry(0.2, 0.22, 2.3, 6), wood, [x, 1.15, z]); M(new THREE.ConeGeometry(0.22, 0.45, 6), dark, [x, 2.5, z]); } }
    for (const x of [-1.9, 1.9]) { M(new THREE.BoxGeometry(1.4, 4.2, 1.4), wood, [x, 2.1, H]); M(new THREE.BoxGeometry(1.8, 0.2, 1.8), dark, [x, 4.25, H]); M(new THREE.ConeGeometry(1.35, 1.3, 4), roofC, [x, 5.0, H], [0, 0.785, 0]); banner(x, H + 0.3, 6.4); }
    for (const x of [-0.65, 0.65]) M(new THREE.BoxGeometry(1.2, 2.0, 0.15), dark, [x, 1.0, H + 0.1]);
    M(new THREE.BoxGeometry(5.2, 2.4, 3.0), 0xC9A06A, [0, 1.2, -2.6]); M(new THREE.CylinderGeometry(1.9, 1.9, 5.6, 3), 0x8A3A2A, [0, 2.95, -2.6], [0, 0, Math.PI / 2]);
    for (const x of [-1.6, 0, 1.6]) M(new THREE.BoxGeometry(0.6, 0.6, 0.05), 0x3A2A1E, [x, 1.4, -1.07]); fire(-3.2, 1.4); barrel(3.4, 1.0); crate(3.8, 1.8); torch(-1.9, H - 0.8); torch(1.9, H - 0.8); return g; }
  // каменные уровни 3–5
  const H = lvl >= 4 ? 6.2 : 5.8, wh = lvl === 3 ? 2.8 : lvl === 4 ? 3.4 : 3.8, th = 0.7, tr = lvl === 3 ? 1.2 : 1.45, th2 = wh + (lvl === 3 ? 1.8 : 2.6);
  for (const [x1, z1, x2, z2] of [[-H, -H, H, -H], [-H, -H, -H, H], [H, -H, H, H], [-H, H, -1.6, H], [1.6, H, H, H]]) { wall(x1, z1, x2, z2, wh, th, stone); merlons(x1, z1, x2, z2, wh, stone); M(new THREE.BoxGeometry(Math.hypot(x2 - x1, z2 - z1) + 0.2, 0.18, th + 0.12), trim, [(x1 + x2) / 2, wh * 0.55, (z1 + z2) / 2], [0, -Math.atan2(z2 - z1, x2 - x1), 0]); }
  for (const [x, z] of [[-H, -H], [H, -H], [-H, H], [H, H]]) rtower(x, z, tr, th2, roofC, lvl >= 4);
  // надвратная башня с аркой и решёткой
  for (const x of [-1.6, 1.6]) M(new THREE.BoxGeometry(1.0, wh + 1.2, 1.4), stone, [x, (wh + 1.2) / 2, H]);
  M(new THREE.BoxGeometry(4.2, 1.2, 1.4), stone, [0, wh + 0.6, H]); merlons(-2.0, H, 2.0, H, wh + 1.2, stone);
  for (let i = -2; i <= 2; i++) M(new THREE.BoxGeometry(0.08, wh - 0.4, 0.08), 0x3A3A40, [i * 0.42, (wh - 0.4) / 2, H + 0.5]); M(new THREE.BoxGeometry(2.2, 0.1, 0.08), 0x3A3A40, [0, wh * 0.5, H + 0.5]);
  M(new THREE.BoxGeometry(1.4, 0.9, 0.06), col, [0, wh + 0.6, H + 0.73]); M(new THREE.CircleGeometry(0.28, 12), gold, [0, wh + 0.6, H + 0.77]);
  torch(-2.5, H + 0.9, 1.8); torch(2.5, H + 0.9, 1.8);
  // донжон
  const kh = lvl === 3 ? 4.6 : lvl === 4 ? 6.0 : 7.2, kz = -1.6;
  M(new THREE.BoxGeometry(4.6, kh, 4.0), stone, [0, kh / 2, kz]); merlons(-2.3, kz + 2.0, 2.3, kz + 2.0, kh, stone); merlons(-2.3, kz - 2.0, 2.3, kz - 2.0, kh, stone);
  for (const y of lvl >= 4 ? [kh * 0.35, kh * 0.7] : [kh * 0.55]) for (const x of [-1.3, 0, 1.3]) { M(new THREE.BoxGeometry(0.5, 0.8, 0.06), 0x2A2420, [x, y, kz + 2.03]); M(new THREE.ConeGeometry(0.3, 0.3, 4), trim, [x, y + 0.5, kz + 2.04], [0, 0.785, 0]); }
  if (lvl === 3) { M(new THREE.ConeGeometry(3.3, 2.0, 4), roofC, [0, kh + 1.0, kz], [0, 0.785, 0]); banner(0, kz, kh + 3.4, true); }
  else { rtower(0, kz, 1.25, kh + 2.2, roofC, true); for (const [x, z] of [[-2.1, kz - 1.8], [2.1, kz - 1.8], [-2.1, kz + 1.8], [2.1, kz + 1.8]]) { M(new THREE.CylinderGeometry(0.42, 0.42, 1.4, 10), stone, [x, kh + 0.7, z]); M(new THREE.ConeGeometry(0.55, 1.1, 10), roofC, [x, kh + 1.95, z]); }
    banner(0, kz, kh + 6.0, true); }
  for (const [x, z] of [[-H, -H], [H, -H]]) banner(x, z, th2 + tr * 2.6 + 1.0);
  // двор: колодец/фонтан, бочки, клумбы
  if (lvl >= 5) { M(new THREE.CylinderGeometry(1.0, 1.1, 0.5, 16), stone, [3.0, 0.25, 2.6]); glow(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 16), 0x6AC8F0, [3.0, 0.5, 2.6]); M(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8), gold, [3.0, 0.9, 2.6]);
    for (let a = 0; a < 6.283; a += 0.26) M(new THREE.BoxGeometry(0.5, 0.9, 0.3), stone, [Math.sin(a) * 8.4, 0.45, Math.cos(a) * 8.4], [0, a, 0]);
    for (const x of [-3.4, -2.6]) M(new THREE.SphereGeometry(0.4, 8, 6), 0x4E8A34, [x, 0.4, 3.4]); }
  else { M(new THREE.CylinderGeometry(0.7, 0.75, 0.7, 12), stone, [3.0, 0.35, 2.6]); M(new THREE.BoxGeometry(1.6, 0.12, 0.12), dark, [3.0, 1.5, 2.6]); for (const x of [2.4, 3.6]) M(new THREE.BoxGeometry(0.1, 1.5, 0.1), dark, [x, 0.75, 2.6]); }
  barrel(-3.6, 2.4); barrel(-3.0, 3.0); crate(-3.9, 3.2);
  if (lvl >= 4) for (const x of [-4.6, 4.6]) { M(new THREE.SphereGeometry(0.5, 8, 6), 0x4E8A34, [x, 0.5, -4.6]); M(new THREE.SphereGeometry(0.18, 6, 5), 0xE04A6A, [x + 0.2, 0.85, -4.4]); }
  return g;
}
export function castlesTick(show) {
  const all = G.state?.extra?.castles || {}, seen = new Set();
  for (const [id, c] of Object.entries(all)) { if (c.spot == null) continue; seen.add(id); const key = c.lvl + '|' + c.color; let o = CM.get(id);
    if (!o || o.key !== key || !o.g.parent) { if (o) o.g.parent?.remove(o.g); const g = castleModel(c.lvl, c.color), [x, z] = OCASTLE.spots[c.spot]; g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); (W.RPGW || W.scene).add(g); o = { g, key }; CM.set(id, o); }
    o.g.visible = show; }
  for (const [id, o] of CM) if (!seen.has(id)) { o.g.parent?.remove(o.g); CM.delete(id); }
}
export async function castleSheet() {
  const r = await act('ocastle', {}, true); if (!r || r.status !== 200) { if (r) W.toast(r.data.message || 'Не получилось'); return; }
  const c = r.data.castle, L = OCASTLE.levels[c.lvl], [sx, sz] = OCASTLE.spots[c.spot], p = R.state().pos, near = p && Math.hypot(p.x - sx, p.z - sz) <= OCASTLE.r + 1.5;
  const have = k => (G.state.inventory.find(i => i.item === k) || {}).qty || 0, pct = Math.round(OCASTLE.bonus(c.lvl) * 100);
  const rows = L ? Object.entries(L.need).map(([k, v]) => { const got = c.got[k] || 0, left = v - got; return `<div class="enR"><span class="enI">${ITEMS[k].icon}</span><span style="flex:1"><b>${ITEMS[k].name}</b> ${got} / ${v}<div class="xbar"><i style="width:${Math.min(100, 100 * got / v)}%"></i></div><small>у тебя: ${have(k)}</small></span>
    ${left > 0 ? `<button class="btn btn-gold" type="button" data-cd="${k}" data-q="${Math.min(left, have(k))}" ${near && have(k) > 0 ? '' : 'disabled'}>Сдать ${Math.min(left, have(k)) || ''}</button>` : '✅'}</div>`; }).join('') : '';
  const top = Object.entries(c.top || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v], i) => `${i + 1}. @${esc(n)} — ${v}`).join('<br>');
  openSheet(`<h2>🏰 Замок ордена</h2><p class="rw">Сейчас: <b>${OCASTLE.names[c.lvl]}</b> (ур. ${c.lvl} из 5). Бонус всем членам ордена: <b>+${pct}% опыта и монет</b> за победы.</p>
    <p class="rw">Участок вашего замка — к ${sz > 0 ? 'югу' : 'северу'}-${sx > 0 ? 'востоку' : 'западу'} от королевства. Ресурсы сдают прямо на участке.${near ? '' : ' <b style="color:var(--gold)">Ты сейчас далеко от участка.</b>'}</p>
    ${L ? `<h3 class="xH">Следующий уровень: ${OCASTLE.names[c.lvl + 1]} (+${Math.round(OCASTLE.bonus(c.lvl + 1) * 100)}%)</h3><div class="enL">${rows}</div>` : '<p class="rw">🏆 Великая цитадель построена — выше уже некуда!</p>'}
    <button class="btn btn-paper" type="button" id="cGo" style="width:100%;margin-top:10px">✨ Показать дорогу лучом</button>
    ${top ? `<h3 class="xH">Главные строители</h3><p class="rw">${top}</p>` : ''}`, b => {
    b.querySelectorAll('[data-cd]').forEach(x => x.onclick = async () => { x.disabled = true; const r2 = await act('ocastle', { op: 'donate', item: x.dataset.cd, qty: +x.dataset.q }, true); if (r2 && r2.status === 200) { sfx(/вырос/.test(r2.data.note) ? 'level' : 'coin'); W.toast(r2.data.note); castleSheet(); } else { x.disabled = false; if (r2) W.toast(r2.data.message); } });
    b.querySelector('#cGo').onclick = () => { G.castleGo = { x: sx, z: sz }; W.$('sheet').classList.remove('show'); W.toast('Иди за золотым лучом к участку замка'); }; });
}

// ---------------- бизнесы у Рыночной площади и работа ----------------
const BM = new Map(); let bizArch = null, bizBtn = null, bizNear = -1, jobBusy = 0;
function signTex(lines, bg) { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = bg; x.beginPath(); x.roundRect(6, 6, 500, 148, 26); x.fill(); x.lineWidth = 8; x.strokeStyle = '#0E1424'; x.stroke();
  x.textAlign = 'center'; const fit = (t, px, wt) => { let f = px; do { x.font = `${wt} ${f}px Montserrat, Arial`; f -= 2; } while (x.measureText(t).width > 470 && f > 18); };
  x.fillStyle = '#F5EBDC'; fit(lines[0], 58, 800); x.fillText(lines[0], 256, 74); x.fillStyle = '#FFE7A0'; fit(lines[1] || '', 40, 700); x.fillText(lines[1] || '', 256, 128);
  const t = new W.THREE.CanvasTexture(c); t.colorSpace = W.THREE.SRGBColorSpace; return t; }
function bizModel(lot) {
  const THREE = W.THREE, g = new THREE.Group(), M = (geo, c, pos, rot) => W.mesh(g, geo, c, { pos, rot, ol: 1.2 }), wood = 0x7A4E2C, dark = 0x4E3020;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), W.toon(lot ? 0xB8A27A : 0x9C8A62)); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.04; g.add(ground);
  const sign = (text, bg, y, w = 2.4) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.3125), new THREE.MeshBasicMaterial({ map: signTex(text, bg), transparent: true, side: THREE.DoubleSide })); m.position.set(0, y, 2.66); g.add(m); return m; };
  if (!lot) { for (let a = -2.4; a <= 2.4; a += 1.2) for (const [x, z] of [[a, -2.5], [a, 2.5], [-2.5, a], [2.5, a]]) M(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), wood, [x, 0.35, z]);
    M(new THREE.BoxGeometry(0.12, 1.8, 0.12), dark, [0, 0.9, 2.5]); sign(['Продаётся', 'участок под бизнес'], '#A4161A', 1.85); return g; }
  const T = BIZ.types[lot.type], L = lot.lvl, h = 2.2 + L * 0.45, w = 3.6 + L * 0.2, col = T.color;
  M(new THREE.BoxGeometry(w, h, 3.4), lot.type === 'bank' ? 0xE8DCC0 : lot.type === 'forge' ? 0x8C857B : 0xE4D2B0, [0, h / 2, -0.3]);
  for (const x of [-w / 2, w / 2]) M(new THREE.BoxGeometry(0.22, h, 0.22), wood, [x, h / 2, 1.42]);
  M(new THREE.ConeGeometry(w * 0.66, 1.4 + L * 0.15, 4), col, [0, h + 0.75 + L * 0.07, -0.3], [0, Math.PI / 4, 0]);
  M(new THREE.BoxGeometry(1.0, 1.7, 0.08), dark, [0, 0.85, 1.42]); for (const x of [-1.2, 1.2]) M(new THREE.BoxGeometry(0.7, 0.6, 0.06), 0x9CD0F0, [x, h * 0.6, 1.43]);
  if (lot.type === 'forge') { M(new THREE.BoxGeometry(0.7, 1.8, 0.7), 0x55524E, [w / 2 - 0.5, h + 0.9, -1.2]); M(new THREE.BoxGeometry(0.8, 0.5, 0.5), 0x3A3A40, [1.6, 0.25, 2.0]); }
  if (lot.type === 'tavern') for (const x of [-1.6, 1.6]) M(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 10), 0x8A5A30, [x, 0.35, 2.1]);
  if (lot.type === 'bank') for (const x of [-1.3, -0.45, 0.45, 1.3]) M(new THREE.CylinderGeometry(0.16, 0.18, h, 10), 0xF2ECDC, [x, h / 2, 1.75]);
  if (lot.type === 'shop') M(new THREE.BoxGeometry(w + 0.4, 0.08, 1.2), 0xC0303A, [0, h * 0.72, 1.9], [0.35, 0, 0]);
  if (L >= 5) M(new THREE.ConeGeometry(0.3, 0.6, 4), 0xE8B931, [0, h + 2.0 + L * 0.15, -0.3]);
  sign([T.icon + ' ' + T.name, '@' + lot.owner + ' · ур. ' + L], '#0E1424', h + 0.45, 2.6);
  g.scale.setScalar(0.88); return g;
}
function bizTick(show) {
  const all = G.state?.extra?.biz || {};
  BIZ.lots.forEach(([x, z], i) => { const lot = all[i], key = lot ? lot.owner + lot.type + lot.lvl : 'free'; let o = BM.get(i);
    if (!o || o.key !== key || !o.g.parent) { if (o) o.g.parent?.remove(o.g); const g = bizModel(lot); g.position.set(x, 0, z); g.rotation.y = Math.atan2(BIZ.lots[i][0] < 42.9 - 3 ? 1 : BIZ.lots[i][0] > 42.9 + 3 ? -1 : 0, z < 3.3 ? 1 : -1); (W.RPGW || W.scene).add(g); o = { g, key }; BM.set(i, o); }
    o.g.rotation.y = BIZ.lots[i][2]; o.g.visible = show; });
  if (!bizArch) { const THREE = W.THREE, g = new THREE.Group(), M = (geo, c, pos) => W.mesh(g, geo, c, { pos, ol: 1.2 }), S = BIZ.street, x0 = S.x + S.len / 2 + 1.2;
    for (const z of [-2.4, 2.4]) { M(new THREE.BoxGeometry(0.5, 4.2, 0.5), 0x8C857B, [0, 2.1, z]); M(new THREE.ConeGeometry(0.45, 0.6, 4), 0xA4161A, [0, 4.5, z]); }
    M(new THREE.BoxGeometry(0.4, 0.5, 5.4), 0x5A3A22, [0, 3.7, 0]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.44), new THREE.MeshBasicMaterial({ map: signTex(['🏪 Торговый квартал', 'бизнесы подданных'], '#0E1424'), transparent: true, side: THREE.DoubleSide })); m.position.set(0.25, 3.0, 0); m.rotation.y = Math.PI / 2; g.add(m);
    const m2 = m.clone(); m2.position.x = -0.25; m2.rotation.y = -Math.PI / 2; g.add(m2);
    for (let k = 0; k <= 6; k++) for (const z of [-1.2, 1.2]) { const lx = S.x - S.len / 2 + k * (S.len / 6); M(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 6), 0x3A2A1E, [lx - x0, 1.1, z]); M(new THREE.BoxGeometry(0.3, 0.35, 0.3), 0xFFD060, [lx - x0, 2.3, z]); }
    g.position.set(x0, 0, S.z); (W.RPGW || W.scene).add(g); bizArch = g; }
  bizArch.visible = show;
}
export async function bizSheet(i) {
  const lot = (G.state.extra.biz || {})[i], me = G.state.hero.nick, now = Date.now(), coins = G.state.coins || 0;
  const mine = Object.values(G.state.extra.biz || {}).some(x => x && x.owner === me), fmt = n => n.toLocaleString('ru-RU');
  let html;
  if (!lot) html = `<h2>🏪 Участок под бизнес</h2><p class="rw">Купи бизнес — он будет приносить доход каждый час, даже пока тебя нет в игре. Касса копится до ${BIZ.capH} часов: заходи забирать. Один герой — один бизнес.</p><div class="enL">` +
    Object.entries(BIZ.types).map(([id, T]) => `<div class="enR"><span class="enI">${T.icon}</span><span style="flex:1"><b>${T.name}</b><br><small>${T.text}: ${T.coins ? `${T.coins} 🪙` : `${T.ore} руды и иногда 💎`} в час на 1 уровне</small></span><button class="btn btn-gold" type="button" data-bb="${id}" ${!mine && coins >= T.price ? '' : 'disabled'}>${fmt(T.price)} 🪙</button></div>`).join('') + `</div>${mine ? '<p class="rw" style="color:var(--gold)">У тебя уже есть бизнес.</p>' : ''}`;
  else { const T = BIZ.types[lot.type], c = bizCash(lot, now), cash = [c.coins && `${fmt(c.coins)} 🪙`, c.ore && `${c.ore} руды`, c.gem && `${c.gem} 💎`].filter(Boolean).join(', ') || 'пусто';
    if (lot.owner === me) { const up = lot.lvl < BIZ.maxLvl ? BIZ.upCost(lot.type, lot.lvl) : 0;
      html = `<h2>${T.icon} ${T.name} · ур. ${lot.lvl}</h2><p class="rw">Твой бизнес. Доход ×${BIZ.mult(lot.lvl)}. Касса копится до ${BIZ.capH} часов${c.h >= BIZ.capH ? ' — <b style="color:var(--gold)">касса полна, забери!</b>' : ''}.</p>
        <p class="rw" style="font-size:20px">💰 В кассе: <b>${cash}</b></p><button class="btn btn-gold" type="button" id="bzC" style="width:100%">Забрать кассу</button>
        ${up ? `<button class="btn btn-paper" type="button" id="bzU" style="width:100%;margin-top:8px" ${coins >= up ? '' : 'disabled'}>⬆ Улучшить до ${lot.lvl + 1} ур. (доход ×${BIZ.mult(lot.lvl + 1)}) — ${fmt(up)} 🪙</button>` : '<p class="rw">🏆 Максимальный уровень!</p>'}
        <p class="rw"><small>Другие игроки могут работать у тебя сменами — за каждую смену тебе +${JOB.ownerCut} монет в кассу.</small></p>
        <button class="btn btn-paper" type="button" id="bzS" style="width:100%;margin-top:8px;opacity:.75">Продать бизнес (вернётся половина цены)</button>`; }
    else { const j = G.state.extra.job, cd = (G.state.extra.jobcd || 0) - now;
      html = `<h2>${T.icon} ${T.name} · ур. ${lot.lvl}</h2><p class="rw">Владелец: <b>@${esc(lot.owner)}</b>.</p><p class="rw">Наймись на смену: обойди 3 точки города — получишь <b>${JOB.hirePay} 🪙</b> и опыт, а хозяину пойдёт +${JOB.ownerCut} в кассу.</p>
        <button class="btn btn-gold" type="button" id="bzH" style="width:100%" ${j || cd > 0 ? 'disabled' : ''}>💼 Наняться на смену</button>${j ? '<p class="rw">Ты уже на смене.</p>' : cd > 0 ? `<p class="rw">Отдых ещё ${Math.ceil(cd / 60e3)} мин.</p>` : ''}`; } }
  openSheet(html, b => {
    const go = async (body, el) => { if (el) el.disabled = true; const r = await act(body.a, { ...body, a: undefined, lot: i }, true); if (r && r.status === 200) { sfx(/вырос|владелец/.test(r.data.note) ? 'level' : 'coin'); W.toast(r.data.note); bizSheet(i); } else if (r) { W.toast(r.data.message || 'Не получилось'); if (el) el.disabled = false; } };
    b.querySelectorAll('[data-bb]').forEach(x => x.onclick = () => go({ a: 'biz', op: 'buy', type: x.dataset.bb }, x));
    const q = id => b.querySelector(id);
    if (q('#bzC')) q('#bzC').onclick = () => go({ a: 'biz', op: 'collect' }, q('#bzC'));
    if (q('#bzU')) q('#bzU').onclick = () => go({ a: 'biz', op: 'up' }, q('#bzU'));
    if (q('#bzS')) q('#bzS').onclick = () => { if (q('#bzS').dataset.ok) go({ a: 'biz', op: 'sell' }, q('#bzS')); else { q('#bzS').dataset.ok = 1; q('#bzS').textContent = 'Точно продать? Нажми ещё раз'; } };
    if (q('#bzH')) q('#bzH').onclick = async () => { q('#bzH').disabled = true; const r = await act('job', { op: 'start', job: 'hire', lot: i }, true); if (r && r.status === 200) { W.toast(r.data.note); W.$('sheet').classList.remove('show'); } else if (r) W.toast(r.data.message || 'Не получилось'); };
  });
}
export function jobsHtml() { const j = G.state.extra.job, cd = (G.state.extra.jobcd || 0) - Date.now();
  if (j) { const P = POI[j.pts[j.i]]; return `<p class="rw">Ты на смене: <b>${JOBS[j.job].icon} ${JOBS[j.job].name}</b>. Точка ${j.i + 1} из ${j.pts.length}: <b>${P.name}</b> — иди за золотым лучом.</p><button class="btn btn-paper" type="button" id="jbQ">Бросить смену</button>`; }
  return `<p class="rw">Смена — 3 точки по городу. Плата: <b>${JOB.pay} 🪙</b> и ${JOB.xp} опыта. Отдых между сменами ${JOB.cd / 60e3} мин.${cd > 0 ? ` <b style="color:var(--gold)">Отдых ещё ${Math.ceil(cd / 60e3)} мин.</b>` : ''}</p><div class="enL">` +
    Object.entries(JOBS).filter(([id]) => id !== 'hire').map(([id, J]) => `<div class="enR"><span class="enI">${J.icon}</span><span style="flex:1"><b>${J.name}</b><br><small>${J.text}</small></span><button class="btn btn-gold" type="button" data-jb="${id}" ${cd > 0 ? 'disabled' : ''}>Начать</button></div>`).join('') +
    `</div><p class="rw"><small>💼 А ещё можно наняться в бизнес другого игрока — подойди к его зданию в Торговом квартале.</small></p>`; }
export function jobsBind(b, reopen) { b.querySelectorAll('[data-jb]').forEach(x => x.onclick = async () => { x.disabled = true; const r = await act('job', { op: 'start', job: x.dataset.jb }, true); if (r && r.status === 200) { W.toast(r.data.note); W.$('sheet').classList.remove('show'); } else if (r) { W.toast(r.data.message || 'Не получилось'); x.disabled = false; } });
  const q = b.querySelector('#jbQ'); if (q) q.onclick = async () => { await act('job', { op: 'quit' }, true); reopen && reopen(); }; }
function bizJobTick(p) {
  bizTick(true);
  // кнопка у участка
  let ni = -1; if (p) BIZ.lots.forEach(([x, z], i) => { if (Math.hypot(p.x - x, p.z - z) <= BIZ.near) ni = i; });
  if (!bizBtn) { bizBtn = document.createElement('button'); bizBtn.id = 'bizBtn'; bizBtn.className = 'btn btn-gold'; bizBtn.type = 'button'; bizBtn.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:150px;z-index:30;display:none'; document.body.appendChild(bizBtn); bizBtn.onclick = () => bizNear >= 0 && bizSheet(bizNear); }
  bizNear = ni; bizBtn.style.display = ni < 0 ? 'none' : ''; if (ni >= 0) { const lot = (G.state.extra.biz || {})[ni]; bizBtn.textContent = lot ? `${BIZ.types[lot.type].icon} ${BIZ.types[lot.type].name} @${lot.owner}` : '🏪 Участок продаётся'; }
  // смена: маяк к точке и отметка при подходе
  const j = G.state.extra.job; if (j && p) { const P = POI[j.pts[j.i]]; if (P) { if (!G.tutTarget) G.tutTarget = { x: P.x, z: P.z };
    if (Math.hypot(p.x - P.x, p.z - P.z) <= JOB.near - 0.6 && Date.now() - jobBusy > 2500) { jobBusy = Date.now(); act('job', { op: 'step' }, true).then(r => { if (r && r.status === 200) { sfx(/закончена/.test(r.data.note) ? 'coin' : 'gather'); W.toast(r.data.note); } }); } } }
}

// ---------------- охота за сокровищами ----------------
let digBtn = null;
async function dig() { if (!R.state().on || !G.state) return; const r = await act('hunt', {}, true); if (!r) return;
  if (r.status === 200) { W.toast(r.data.note); sfx(r.data.hunt?.found ? 'gift' : 'gather'); if (r.data.hunt?.found) { digBtn.dataset.done = 1; } } else W.toast(r.data.message || 'Не получилось'); }

// ---------------- после каждого ответа сервера ----------------
export function extrasAfter(action, d) {
  const s = G.state; if (!s || !s.extra) return;
  if (d.levelUp) sfx('level'); else if (action === 'fight' && d.result === 'won') sfx('win'); else if (action === 'fight' && d.log?.length) sfx('hit');
  else if (['gather', 'chop'].includes(action)) sfx('gather'); else if (d.reward || d.gift || d.daily) sfx(d.gift ? 'gift' : 'coin');
  { const me = R.state().hero, wpn = ((s.inventory || []).find(i => i.equipped && GEAR[i.item] && gearSlot(i.item) === 'weapon') || {}).item; // 3D: удар, сбор, радость
    if (me?.userData?.a3) { if (d.levelUp || (action === 'fight' && d.result === 'won')) act3d(me, 'Cheer'); else if (['gather', 'chop'].includes(action)) act3d(me, action === 'chop' ? '1H_Melee_Attack_Chop' : 'PickUp'); } }
  // приглашение друга
  const ref = ls.get('kp-ref'); if (ref && !refTried && !s.extra.ref.by && ref !== s.hero.nick.toLowerCase()) { refTried = true; ls.set('kp-ref', null); if (s.hero.xp <= REF.maxXp) setTimeout(() => act('ref', { from: ref }).then(r => r && r.status === 200 && sfx('gift')), 800); }
  else if (ref && (s.extra.ref.by || ref === s.hero.nick.toLowerCase())) ls.set('kp-ref', null);
  // награда за вход — один раз за заход
  if (!dailyShown && !s.extra.login.claimed && !R.state().demo) { dailyShown = true; setTimeout(() => { if (!W.$('sheet').classList.contains('show') && R.state().on) rewardsSheet(); }, 1500); }
  if (!dailyShown && R.state().demo) dailyShown = true;
  // обучение: проверить шаг после сбора и боя
  if (tutOn() && action !== 'tutorial') { const st = TUT[s.extra.tut.step]; if (st && ((st.id === 'gather' && ['gather', 'chop'].includes(action)) || (st.id === 'fight' && action === 'fight' && d.result === 'won'))) setTimeout(() => tutCheck(true), 400); }
  tutPanel(); syncMyPet();
}

// ---------------- питомцы ----------------
const PETM = new Map(); let myPet = '';
const petOfState = () => petShow(((G.state?.inventory || []).find(i => i.equipped && /^pet_/.test(i.item)) || {}).item || '', G.state?.extra?.drg);
function syncMyPet() { const p = petOfState(); if (p !== myPet) { myPet = p; try { retrack(); } catch { } } }
function follow(key, owner, id, now, dt) {
  let o = PETM.get(key); if (!id || !owner || !owner.visible) { if (o) { W.scene.remove(o.g); PETM.delete(key); } return; }
  if (!o || o.id !== id || (!o.g.userData.a3 && wantMon(id))) { const old = o; if (old) W.scene.remove(old.g); o = { id, g: buildMon3D(id) || buildPet(id), t: Math.random() * 9, clk: 0 }; o.g.position.set(old ? old.g.position.x : owner.position.x - 1, 0, old ? old.g.position.z : owner.position.z - 1); W.scene.add(o.g); PETM.set(key, o); }
  const a = owner.rotation.y, tx = owner.position.x - Math.sin(a) * 1.1 + Math.cos(a) * 0.7, tz = owner.position.z - Math.cos(a) * 1.1 - Math.sin(a) * 0.7;
  const dx = tx - o.g.position.x, dz = tz - o.g.position.z, d = Math.hypot(dx, dz), sp = Math.min(d, d * dt * 4);
  if (d > 12) o.g.position.set(tx, 0, tz); else if (d > 0.05) { o.g.position.x += dx / d * sp; o.g.position.z += dz / d * sp; o.g.rotation.y = Math.atan2(dx, dz); }
  const moving = d > 0.25, u = o.g.userData; o.t += dt * (moving ? 12 : 2);
  if (u.a3) { o.clk += dt; animate3d(o.g, o.clk, moving ? Math.min(6, sp / Math.max(dt, 1e-3)) : 0); if (/owl|dragon/.test(id)) o.g.position.y = id === 'pet_owl' ? 1.3 + Math.sin(o.t * 0.5) * 0.12 : 0.6; return; }
  if (u.fly) { o.g.position.y = 1.5 + Math.sin(o.t * 0.5) * 0.15; u.legs.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(o.t * 2.2) * 0.5)); }
  else { u.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(o.t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0); if (u.tail) u.tail.rotation.y = Math.sin(o.t * 0.7) * 0.4; u.body.position.y = moving ? Math.abs(Math.sin(o.t)) * 0.04 : 0; }
}

// ---------------- кадр ----------------
let giftBtn = null, slow = 0, slowW = 0;
export function extrasTick(now, dt) {
  const st = R.state(); if (!st.on || !G.state?.extra) { for (const [k, o] of PETM) { W.scene.remove(o.g); PETM.delete(k); } if (giftBtn) giftBtn.hidden = true; if (W.$('tutP')) W.$('tutP').hidden = true; if (warPanel) warPanel.hidden = true; if (warBtn) warBtn.hidden = true; for (const o of FLAGM.values()) o.visible = false; for (const k of [...FX.keys()]) fxFor(k, null); castlesTick(false); for (const o of BM.values()) o.g.visible = false; if (bizArch) bizArch.visible = false; if (bizBtn) bizBtn.style.display = 'none'; if (digBtn) digBtn.hidden = true; return; }
  follow("me", st.hero && !(W.FPV && W.FPV.on) ? st.hero : null, myPet, now, dt);
  for (const [nick, o] of NET.others) follow(nick, o.g, o.pet, now, dt);
  for (const k of PETM.keys()) if (k !== 'me' && !NET.others.has(k)) { W.scene.remove(PETM.get(k).g); PETM.delete(k); }
  if (window.NYBULBS && window.NYG?.visible) window.NYBULBS.forEach((b, i) => b.visible = Math.floor(now / 600 + i) % 3 !== 0);
  { const cur = G.state.extra.look?.cur || {}, wpn = activeGear((G.state.inventory || []).filter(i => i.equipped).map(i => i.item)).find(i => gearSlot(i) === 'weapon');
    fxFor('me', st.hero && !(W.FPV && W.FPV.on) ? st.hero : null, cur.aura, wpn ? (G.state.extra.ench || {})[wpn] || 0 : 0, now);
    for (const [nick, o] of NET.others) fxFor(nick, o.g, o.aura, o.el, now); for (const k of [...FX.keys()]) if (k !== 'me' && !NET.others.has(k)) fxFor(k, null); }
  if (now - slowW >= 120) { slowW = now; warTick(now, st.pos); } castlesTick(true); if (now - slow < 400) return; slow = now; const p = st.pos;
  // обучение: цель для маяка и проверка шагов «подойди»
  if (!digBtn) { digBtn = document.createElement('button'); digBtn.id = 'bDig'; digBtn.type = 'button'; digBtn.className = 'pose'; digBtn.textContent = '⛏'; digBtn.title = 'Копать клад (G)'; digBtn.onclick = e => { e.preventDefault(); dig(); }; document.body.appendChild(digBtn);
    addEventListener('keydown', e => { if (e.code === 'KeyG' && !e.repeat && R.state().on && !e.target.closest?.('input,textarea')) dig(); }); }
  digBtn.hidden = false;
  if (G.castleGo && p && Math.hypot(p.x - G.castleGo.x, p.z - G.castleGo.z) < OCASTLE.r) { W.toast(G.castleGo.msg || '🏰 Ты на участке замка ордена! Открой «🏰 Орден» → «Замок ордена», чтобы сдать ресурсы.'); G.castleGo = null; }
  tutPanel(); if (tutOn() && p) { const step = TUT[G.state.extra.tut.step]; G.tutTarget = step ? tutTarget(step) : null;
    if (step && step.x != null && Math.hypot(p.x - step.x, p.z - step.z) <= step.r - 0.5) tutCheck(); } else G.tutTarget = G.castleGo || null;
  bizJobTick(p);
  // подарок под ёлкой
  const showGift = window.NYG?.visible && p && Math.hypot(p.x - TREE.x, p.z - TREE.z) <= TREE.r && !G.state.extra.gift;
  if (showGift && !giftBtn) { giftBtn = document.createElement('button'); giftBtn.id = 'giftBtn'; giftBtn.className = 'btn btn-gold'; giftBtn.type = 'button'; giftBtn.textContent = '🎁 Взять подарок из-под ёлки'; document.body.appendChild(giftBtn);
    giftBtn.onclick = async () => { giftBtn.disabled = true; const r = await act('gift', {}); giftBtn.disabled = false; if (r && r.status === 200) sfx('gift'); }; }
  if (giftBtn) giftBtn.hidden = !showGift;
}

export function initExtras(world, k, rpg) {
  W = world; K = k; R = rpg;
  const c = document.createElement('style'); c.textContent = `
  #tutP { position: fixed; z-index: 4; left: 50%; transform: translateX(-50%); top: max(64px, calc(env(safe-area-inset-top) + 64px)); width: min(380px, 78vw); padding: 10px 14px; border-radius: 16px; border: 2px solid var(--gold); box-shadow: 0 0 24px rgba(232,185,49,.35); font-size: 14px; }
  #tutP .tH { font-weight: 900; color: var(--gold); font-size: 12px; letter-spacing: .3px; } #tutP .tT { font-weight: 800; margin: 4px 0 6px; line-height: 1.3; }
  #tutP .tB { display: flex; gap: 5px; } #tutP .tB i { flex: 1; height: 6px; border-radius: 3px; background: rgba(245,235,220,.18); } #tutP .tB i.ok { background: #5DBB63; } #tutP .tB i.cur { background: var(--gold); }
  #tutP .tF { display: flex; align-items: center; gap: 8px; margin-top: 6px; } #tutP .tF small { flex: 1; color: var(--muted); font-size: 11.5px; font-weight: 700; } #tutP .tS { background: none; border: 0; color: var(--muted); text-decoration: underline; cursor: pointer; font-size: 12px; }
  @media (max-width: 560px) { #tutP { top: auto; left: 10px; transform: none; width: calc(100vw - 96px); bottom: calc(env(safe-area-inset-bottom) + 180px); font-size: 12.5px; padding: 8px 10px; } #tutP .tF small { display: none; } }
  #giftBtn { position: fixed; z-index: 5; left: 50%; transform: translateX(-50%); bottom: calc(env(safe-area-inset-bottom) + 120px); font-size: 16px; padding: 12px 18px; animation: gP 1.2s ease-in-out infinite; }
  @keyframes gP { 50% { transform: translateX(-50%) scale(1.06); } }
  .xH { margin: 16px 0 4px; font-size: 18px; } .dG { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
  .dC { position: relative; text-align: center; padding: 7px 3px; border-radius: 12px; background: rgba(245,235,220,.07); border: 2px solid transparent; font-size: 11px; line-height: 1.2; }
  .dC b { display: block; font-size: 11px; } .dC span { display: block; font-size: 22px; margin: 2px 0; } .dC small { color: var(--muted); font-size: 10px; font-weight: 700; }
  .dC.got { opacity: .55; } .dC.now { border-color: var(--gold); background: rgba(232,185,49,.16); opacity: 1; } .dC em { position: absolute; top: 2px; right: 5px; color: #5DBB63; font-style: normal; font-weight: 900; }
  @media (max-width: 560px) { .dG { grid-template-columns: repeat(4, 1fr); } }
  .xL { display: flex; gap: 6px; flex-wrap: wrap; } .xL input { flex: 1; min-width: 170px; font-size: 13px; }
  .xbar { height: 8px; border-radius: 4px; background: rgba(245,235,220,.15); margin: 8px 0 4px; overflow: hidden; } .xbar i { display: block; height: 100%; background: var(--gold); }
  .pL { display: grid; gap: 6px; } .pR { display: flex; gap: 10px; align-items: center; padding: 6px 10px; border-radius: 12px; background: rgba(245,235,220,.07); } .pR > span:first-child { font-size: 26px; } .pR > span:nth-child(2) { flex: 1; } .pR small { color: var(--muted); font-weight: 700; }
  .xS { display: flex; gap: 8px; align-items: center; margin-top: 14px; font-weight: 800; }
  .lkG { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px; } .lkB { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 6px; border-radius: 12px; border: 2px solid transparent; background: rgba(245,235,220,.07); color: inherit; cursor: pointer; font: inherit; font-size: 12.5px; }
  .lkB.on { border-color: var(--gold); background: rgba(232,185,49,.16); } .lkB small { color: var(--muted); font-weight: 800; } .lkS { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #1A1410; } .lkI { font-size: 26px; line-height: 30px; }
  .enL { display: grid; gap: 6px; } .enR { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 12px; background: rgba(245,235,220,.07); } .enI { font-size: 26px; } .enR small { color: var(--muted); font-weight: 700; }
  #warP { position: fixed; z-index: 3; left: max(10px, env(safe-area-inset-left)); top: 150px; padding: 8px 12px; border-radius: 14px; font-size: 12.5px; border: 2px solid #A4161A; min-width: 190px; }
  #warP b { display: block; color: var(--gold); } #warP div { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-weight: 700; } #warP i { width: 12px; height: 12px; border-radius: 3px; border: 1px solid #000; } #warP small { color: var(--muted); font-weight: 700; display: block; }
  #bDig { left: calc(max(18px, env(safe-area-inset-left)) + 260px); } @media (pointer: fine) { body.playing #bDig { display: grid; left: auto; right: 18px; bottom: 210px; } } #bDig[hidden] { display: none !important; }
  #warBtn { position: fixed; z-index: 5; left: 50%; transform: translateX(-50%); bottom: calc(env(safe-area-inset-bottom) + 120px); font-size: 16px; padding: 12px 18px; }
  @media (max-width: 560px) { #warP { top: auto; bottom: calc(env(safe-area-inset-bottom) + 260px); transform: scale(.85); transform-origin: 0 100%; } }`;
  document.head.appendChild(c);
}
