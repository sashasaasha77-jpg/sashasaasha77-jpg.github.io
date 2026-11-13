// Интерфейс новинок (14.11.2026): обучение новичка, награда за вход, «позови друга», подарок под ёлкой, питомцы, звуки.
import { G, act, openSheet } from './rpg-ui.js';
import { TUT, LOGIN, REF, PETS, TREE, DUNGEON, LOOKS, ENCH, enchColor, OWAR, lookKey } from './extras.mjs';
import { ITEMS } from './quests.mjs';
import { ENEMIES, enemyPos, GEAR, gearSlot, activeGear } from './combat.mjs';
import { buildPet } from './monsters.js';
import { NET, retrack } from './net.js';

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
  openSheet(`<h2>🎁 Награды</h2>
    <h3 class="xH">Награда за вход каждый день</h3><p class="rw">Заходи каждый день подряд — награда растёт. Пропустишь день — серия начнётся заново. Серия: <b>${lg.streak}</b> дн.</p>
    <div class="dG">${days}</div>
    <button class="btn btn-gold" id="xClaim" type="button" ${lg.claimed ? 'disabled' : ''} style="width:100%;margin-top:8px">${lg.claimed ? 'Сегодня уже получено — приходи завтра!' : `Забрать награду дня ${lg.nextDay}`}</button>
    <h3 class="xH">🤝 Позови друга</h3><p class="rw">Друг подписывается на <b>@korol_podpi</b>, заходит в «Мир героев» по твоей ссылке — и вы оба получаете по <b>${REF.inviterCoins} монет</b>. За ${REF.horseAt} друзей — <b>конь в подарок</b> 🐴</p>
    <div class="xL"><input id="xLink" readonly value="${esc(link)}"><button class="btn btn-paper" id="xCopy" type="button">Копировать</button>${navigator.share ? '<button class="btn btn-paper" id="xShare" type="button">Поделиться</button>' : ''}</div>
    <div class="xbar"><i style="width:${Math.min(100, 100 * x.ref.n / REF.horseAt)}%"></i></div><small class="rw">Пришло по твоей ссылке: <b>${x.ref.n}</b>${x.ref.n < REF.horseAt ? ` · до коня осталось ${REF.horseAt - x.ref.n}` : ' · конь уже твой!'}${x.ref.by ? ` · тебя позвал @${esc(x.ref.by)}` : ''}</small>
    ${x.ny ? `<h3 class="xH">🎄 Новогодний праздник</h3><p class="rw">Каждый день под ёлкой на площади у ворот ждёт подарок${x.gift ? ' — сегодняшний уже у тебя' : ''}. По субботам в 20:00 приходит <b>Снежный король</b> — бейте его всем королевством!</p>` : ''}
    <h3 class="xH">⚔️ Война орденов</h3><p class="rw">Каждое воскресенье с 19:00 до 20:00 ордены бьются за пять флагов: у рынка, болота, шахты, моста и арены. Подойди к флагу и укрепляй его раз в 20 секунд — чем выше уровень, тем больше влияния. Флаг достаётся ордену с наибольшим влиянием. Орден с большинством флагов побеждает: всем участникам монеты и опыт, победителям — +${OWAR.winBonus} монет сверху, а флаги неделю горят цветом победителей.${x.war?.last?.winners?.length ? ` Прошлая война: победил «${esc(x.war.last.winners[0].name)}».` : ''}</p>
    <h3 class="xH">🐾 Питомцы</h3><div class="pL">${pets}</div><p class="rw">Питомец ходит за тобой по пятам. Надень его в «🎒 Герой».</p>
    <h3 class="xH">⛏ Подземелье</h3><p class="rw">В горах на северо-западе — шахта. У входа ждёт <b>Горный король</b>: его общее здоровье на весь орден, одолеть можно только вместе (от ${DUNGEON.needMembers} героев ордена), раз в день. Награда каждому: ${DUNGEON.rewardXp} опыта, ${DUNGEON.rewardCoins} монет, самоцветы и шанс на эпическую вещь.</p>
    <label class="xS"><input type="checkbox" id="xSfx" ${sfxOn() ? 'checked' : ''}> 🔊 Звуки в игре</label>`, b => {
    b.querySelector('#xClaim').onclick = async e => { e.target.disabled = true; const r = await act('daily', {}, true); if (r && r.status === 200) { sfx('gift'); W.toast(r.data.note); rewardsSheet(); } else { e.target.disabled = false; if (r) W.toast(r.data.message || 'Не получилось'); } };
    b.querySelector('#xCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); W.toast('Ссылка скопирована. Отправь её другу!'); } catch { b.querySelector('#xLink').select(); document.execCommand('copy'); W.toast('Ссылка скопирована'); } };
    const sh = b.querySelector('#xShare'); if (sh) sh.onclick = () => navigator.share({ title: 'Королевство подписчиков', text: 'Заходи в «Мир героев» — получишь 150 монет на старте!', url: link }).catch(() => { });
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
export function enchSheet() {
  const s = G.state, E = s.extra.ench || {}, gems = (s.inventory.find(i => i.item === 'gem') || {}).qty || 0, p = R.state().pos;
  const nearK = p && Math.hypot(p.x + 8.4, p.z + 3.2) < 4.5;
  const ws = s.inventory.filter(i => GEAR[i.item] && gearSlot(i.item) === 'weapon' && i.qty > 0);
  const row = i => { const l = E[i.item] || 0, c = ENCH.cost(l), ch = Math.round((ENCH.chance[l] ?? 0) * 100), it = ITEMS[i.item];
    return `<div class="enR"><span class="enI">${it.icon}</span><span style="flex:1"><b>${it.name}</b> <b style="color:${l ? hex(enchColor(l) || 0xFFD23A) : 'var(--muted)'}">+${l}</b>${i.equipped ? ' <small>в руках</small>' : ''}<br>
      <small>${l >= ENCH.max ? 'Предел достигнут!' : `Следующая: +${l + 1} (атака +${ENCH.atk * (l + 1)}) · 💎 ${c.gem} и ${c.coins} 🪙 · шанс ${ch}%${l >= ENCH.dropFrom ? ' · при неудаче −1' : ''}`}</small></span>
      ${l < ENCH.max ? `<button class="btn btn-gold" type="button" data-en="${i.item}" ${nearK && gems >= c.gem ? '' : 'disabled'}>Точить</button>` : ''}</div>`; };
  openSheet(`<h2>⚒ Заточка оружия</h2><p class="rw">Кузнец Гордей точит оружие самоцветами 💎 из шахты на северо-западе. Каждая ступень — +${ENCH.atk} к атаке. С +4 оружие светится синим, с +7 — фиолетовым, на +10 — золотом. Чем выше заточка, тем меньше шанс${''}; с +${ENCH.dropFrom} неудача снимает одну ступень.</p>
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
    if (gc) { const arm = owner.userData?.armR; if (arm) { f.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTexture(), color: gc, transparent: true, depthWrite: false, opacity: 0.85 })); f.glow.position.set(0, -0.42, 0.22); f.glow.scale.setScalar(0.65); arm.add(f.glow); } }
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

// ---------------- после каждого ответа сервера ----------------
export function extrasAfter(action, d) {
  const s = G.state; if (!s || !s.extra) return;
  if (d.levelUp) sfx('level'); else if (action === 'fight' && d.result === 'won') sfx('win'); else if (action === 'fight' && d.log?.length) sfx('hit');
  else if (['gather', 'chop'].includes(action)) sfx('gather'); else if (d.reward || d.gift || d.daily) sfx(d.gift ? 'gift' : 'coin');
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
const petOfState = () => ((G.state?.inventory || []).find(i => i.equipped && /^pet_/.test(i.item)) || {}).item || '';
function syncMyPet() { const p = petOfState(); if (p !== myPet) { myPet = p; try { retrack(); } catch { } } }
function follow(key, owner, id, now, dt) {
  let o = PETM.get(key); if (!id || !owner || !owner.visible) { if (o) { W.scene.remove(o.g); PETM.delete(key); } return; }
  if (!o || o.id !== id) { if (o) W.scene.remove(o.g); o = { id, g: buildPet(id), t: Math.random() * 9 }; o.g.position.set(owner.position.x - 1, 0, owner.position.z - 1); W.scene.add(o.g); PETM.set(key, o); }
  const a = owner.rotation.y, tx = owner.position.x - Math.sin(a) * 1.1 + Math.cos(a) * 0.7, tz = owner.position.z - Math.cos(a) * 1.1 - Math.sin(a) * 0.7;
  const dx = tx - o.g.position.x, dz = tz - o.g.position.z, d = Math.hypot(dx, dz), sp = Math.min(d, d * dt * 4);
  if (d > 12) o.g.position.set(tx, 0, tz); else if (d > 0.05) { o.g.position.x += dx / d * sp; o.g.position.z += dz / d * sp; o.g.rotation.y = Math.atan2(dx, dz); }
  const moving = d > 0.25, u = o.g.userData; o.t += dt * (moving ? 12 : 2);
  if (u.fly) { o.g.position.y = 1.5 + Math.sin(o.t * 0.5) * 0.15; u.legs.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(o.t * 2.2) * 0.5)); }
  else { u.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(o.t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0); if (u.tail) u.tail.rotation.y = Math.sin(o.t * 0.7) * 0.4; u.body.position.y = moving ? Math.abs(Math.sin(o.t)) * 0.04 : 0; }
}

// ---------------- кадр ----------------
let giftBtn = null, slow = 0, slowW = 0;
export function extrasTick(now, dt) {
  const st = R.state(); if (!st.on || !G.state?.extra) { for (const [k, o] of PETM) { W.scene.remove(o.g); PETM.delete(k); } if (giftBtn) giftBtn.hidden = true; if (W.$('tutP')) W.$('tutP').hidden = true; if (warPanel) warPanel.hidden = true; if (warBtn) warBtn.hidden = true; for (const o of FLAGM.values()) o.visible = false; for (const k of [...FX.keys()]) fxFor(k, null); return; }
  follow("me", st.hero && !(W.FPV && W.FPV.on) ? st.hero : null, myPet, now, dt);
  for (const [nick, o] of NET.others) follow(nick, o.g, o.pet, now, dt);
  for (const k of PETM.keys()) if (k !== 'me' && !NET.others.has(k)) { W.scene.remove(PETM.get(k).g); PETM.delete(k); }
  if (window.NYBULBS && window.NYG?.visible) window.NYBULBS.forEach((b, i) => b.visible = Math.floor(now / 600 + i) % 3 !== 0);
  { const cur = G.state.extra.look?.cur || {}, wpn = activeGear((G.state.inventory || []).filter(i => i.equipped).map(i => i.item)).find(i => gearSlot(i) === 'weapon');
    fxFor('me', st.hero && !(W.FPV && W.FPV.on) ? st.hero : null, cur.aura, wpn ? (G.state.extra.ench || {})[wpn] || 0 : 0, now);
    for (const [nick, o] of NET.others) fxFor(nick, o.g, o.aura, o.el, now); for (const k of [...FX.keys()]) if (k !== 'me' && !NET.others.has(k)) fxFor(k, null); }
  if (now - slowW >= 120) { slowW = now; warTick(now, st.pos); } if (now - slow < 400) return; slow = now; const p = st.pos;
  // обучение: цель для маяка и проверка шагов «подойди»
  tutPanel(); if (tutOn() && p) { const step = TUT[G.state.extra.tut.step]; G.tutTarget = step ? tutTarget(step) : null;
    if (step && step.x != null && Math.hypot(p.x - step.x, p.z - step.z) <= step.r - 0.5) tutCheck(); } else G.tutTarget = null;
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
  #warBtn { position: fixed; z-index: 5; left: 50%; transform: translateX(-50%); bottom: calc(env(safe-area-inset-bottom) + 120px); font-size: 16px; padding: 12px 18px; }
  @media (max-width: 560px) { #warP { top: auto; bottom: calc(env(safe-area-inset-bottom) + 260px); transform: scale(.85); transform-origin: 0 100%; } }`;
  document.head.appendChild(c);
}
