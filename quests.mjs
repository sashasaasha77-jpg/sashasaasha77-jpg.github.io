// Общие для браузера и сервера: места мира, NPC, ресурсы, предметы, специализации ролей и задания.
import { hash } from './roles.mjs';

export const PITCH = 6.6;
export const riverZ = x => 46 + 9 * Math.sin(x / 23) + 4 * Math.sin(x / 9.5);
const R = k => (k + 0.5) * PITCH;   // линия дороги

// NPC (те же места, что и на карте)
export const NPC = {
  rasporyaditel: { name: 'Распорядитель замка', who: 'Бертрам', x: -2.9, z: 9.7 },
  torgovets: { name: 'Торговец', who: 'Лавр', x: 8.4, z: 4.2 },
  kuznets: { name: 'Кузнец', who: 'Гордей', x: -8.4, z: -3.2 },
  traktirshchik: { name: 'Трактирщик', who: 'Мартын', x: -8.4, z: 3.6 },
  mag: { name: 'Придворный маг', who: 'Эльдар', x: 8.4, z: -4.0 },
  khranitel: { name: 'Хранитель леса', who: 'Ольха', x: -12.6, z: -12.6 },   // сад в северо-западном углу двора крепости
};

// места для заданий — на дорогах, куда можно дойти
// Арена за рекой: перекрёсток к северу от моста (центр, радиус песка)
export const ARENA = { x: R(1), z: R(10), r: 7 };
// Рынок (победил в голосовании подданных, 13.11.2026): отдельный квартал к востоку от замка, на дороге от восточных ворот
export const MARKET = { x: R(6), z: R(0), r: 9.5 };
export const POI = {
  gate: { name: 'ворота замка', x: 0, z: 10.0 },
  fountain: { name: 'фонтан на площади', x: -4.8, z: 9.9 },
  bridge: { name: 'речной мост', x: 0, z: riverZ(0) - 4.4 },
  forest: { name: 'лес за рекой', x: R(0), z: riverZ(R(0)) + 7.5 },
  north: { name: 'северная дорога у собора', x: R(0), z: R(-2) },
  east: { name: 'восточная дорога у ярмарки', x: R(1), z: R(0) },
  west: { name: 'западный перекрёсток', x: R(-2), z: R(1) },
  far_ne: { name: 'северо-восточная окраина', x: R(2), z: R(-3) },
  far_nw: { name: 'северо-западная окраина', x: R(-3), z: R(-3) },
  far_se: { name: 'юго-восточная окраина', x: R(2), z: R(3) },
  far_sw: { name: 'юго-западная окраина', x: R(-3), z: R(3) },
  arena: { name: 'арена за рекой', x: R(1), z: R(10) - 5 },
  market: { name: 'рынок к востоку от замка', x: R(6) - 8, z: R(0) },
};

export const ITEMS = {
  herb: { name: 'Целебная трава', type: 'res', icon: '🌿' }, wood: { name: 'Бревно', type: 'res', icon: '🪵' }, ore: { name: 'Железная руда', type: 'res', icon: '🪨' },
  parcel: { name: 'Посылка', type: 'quest', icon: '📦' }, letter: { name: 'Письмо', type: 'quest', icon: '✉️' },
  lantern: { name: 'Фонарь фонарщика', type: 'gear', icon: '🏮' }, scales: { name: 'Весы торговца', type: 'gear', icon: '⚖️' },
  hammer: { name: 'Молот мастера', type: 'gear', icon: '🔨' }, shield: { name: 'Щит стража', type: 'gear', icon: '🛡️' },
  bow: { name: 'Ясеневый лук', type: 'gear', icon: '🏹' }, satchel: { name: 'Сумка травника', type: 'gear', icon: '👜' },
  cloak: { name: 'Плащ рыцаря', type: 'gear', icon: '🧥' }, staff: { name: 'Посох звездочёта', type: 'gear', icon: '🪄' },
  seal: { name: 'Печать советника', type: 'gear', icon: '📜' }, ring: { name: 'Перстень графа', type: 'gear', icon: '💍' },
  mantle: { name: 'Герцогская мантия', type: 'gear', icon: '👑' },
  gate_key: { name: 'Ключ от северных ворот', type: 'artifact', icon: '🗝️' }, star_shard: { name: 'Осколок звезды', type: 'artifact', icon: '✨' },
  gloves: { name: 'Кожаные перчатки', type: 'gear', icon: '🧤' }, boots: { name: 'Дорожные сапоги', type: 'gear', icon: '🥾' },
};

// специализации 11 ролей: бонус применяет сервер
export const SPEC = {
  zhitel: { title: 'Душа королевства', text: '+15% опыта за помощь NPC', kind: 'help', xp: 0.15 },
  torgovets: { title: 'Мастер сделок', text: '+20% монет за доставку', kind: 'deliver', coins: 0.2 },
  kuznets: { title: 'Рудознатец', text: '+1 руда при каждом сборе руды', bonusRes: 'ore' },
  strazhnik: { title: 'Страж ворот', text: '+25% наград за дозоры', kind: 'guard', xp: 0.25, coins: 0.25 },
  luchnik: { title: 'Зоркий глаз', text: '+25% наград за разведку', kind: 'explore', xp: 0.25, coins: 0.25 },
  alkhimik: { title: 'Травник', text: '+1 трава при каждом сборе трав', bonusRes: 'herb' },
  rytsar: { title: 'Защитник', text: '+15% наград за охрану и дозоры', kind: 'guard', xp: 0.15, coins: 0.15 },
  mag: { title: 'Искатель тайн', text: '+25% наград за поиск сокровищ', kind: 'treasure', xp: 0.25, coins: 0.25 },
  sovetnik: { title: 'Летописец', text: '+20% опыта за сюжетные задания', kind: 'story', xp: 0.2 },
  graf: { title: 'Владелец края', text: '+10% монет за все задания', kind: '*', coins: 0.1 },
  gertsog: { title: 'Опора трона', text: '+10% опыта за все задания', kind: '*', xp: 0.1 },
  korol: { title: 'Корона', text: '+10% опыта и +10% монет за все задания', kind: '*', xp: 0.1, coins: 0.1 },
};

// ---------------- задания ----------------
const v = (poi, text) => ({ t: 'visit', poi, text: text || `Дойди: ${POI[poi].name}` });
const talk = (npc, text) => ({ t: 'talk', npc, text: text || `Поговори: ${NPC[npc].name}` });
const items = (item, n, text) => ({ t: 'items', item, n, text: text || `Принеси: ${ITEMS[item].name} ×${n}` });
const wait = (poi, sec, text) => ({ t: 'wait', poi, sec, text: text || `Стой на посту (${sec} с): ${POI[poi].name}` });

const STORY = [
  { id: 's1', title: 'Странные следы', kind: 'story', type: 'story', giver: 'rasporyaditel', turnIn: 'khranitel', minLevel: 1,
    text: 'Стража нашла у моста чужие следы: тяжёлые сапоги, не наши. Осмотри их у моста, а потом расскажи всё Хранителю леса: она в саду, в северо-западном углу крепости.',
    done: 'Следы ведут на север, к старой крепости. Плохой знак... Мне нужны травы для зелья.', steps: [v('bridge', 'Осмотри следы у речного моста')], reward: { xp: 80, coins: 25 } },
  { id: 's2', title: 'Травы для зелья', kind: 'story', type: 'gather', giver: 'khranitel', turnIn: 'mag', minLevel: 2, after: 's1',
    text: 'Собери 3 целебные травы. Они растут у реки и за рекой. Отнеси их магу Эльдару.', done: 'Отлично! Зелье покажет, кто бродит по нашим землям.',
    steps: [items('herb', 3)], reward: { xp: 120, coins: 35 } },
  { id: 's3', title: 'Видение мага', kind: 'story', type: 'guard', giver: 'mag', turnIn: 'mag', minLevel: 3, after: 's2',
    text: 'Выпей зелье и постой в лесу за рекой, пока не придёт видение.', done: 'Чёрные доспехи... красные знамёна... Это Чёрный Орден! Беги к кузнецу: нам нужны крепкие ворота.',
    steps: [wait('forest', 25, 'Стой в лесу за рекой, пока не придёт видение (25 с)')], reward: { xp: 160, coins: 45, items: [['star_shard', 1]] } },
  { id: 's4', title: 'Засовы для ворот', kind: 'story', type: 'gather', giver: 'kuznets', turnIn: 'kuznets', minLevel: 4, after: 's3',
    text: 'Если Орден придёт, ворота должны выстоять. Принеси 3 железные руды.', done: 'Засовы готовы. Теперь скажи распорядителю, что мы знаем о враге.',
    steps: [items('ore', 3)], reward: { xp: 200, coins: 60, items: [['gloves', 1]] } },
  { id: 's5', title: 'Тень над Севером', kind: 'story', type: 'story', giver: 'kuznets', turnIn: 'rasporyaditel', minLevel: 5, after: 's4',
    text: 'Отнеси распорядителю ключ от северных ворот и весть о Чёрном Ордене.', done: 'Король узнал о Чёрном Ордене. Королевство готовится к обороне. Твоё имя занесено в хронику!',
    steps: [talk('rasporyaditel', 'Передай весть распорядителю замка')], reward: { xp: 300, coins: 100, items: [['gate_key', 1]] }, chronicle: true },
];

const ROLEQ = {
  zhitel: { title: 'Огни королевства', type: 'help', giver: 'traktirshchik', turnIn: 'traktirshchik', steps: [v('gate', 'Зажги фонарь у ворот'), v('fountain', 'Зажги фонарь у фонтана'), v('east', 'Зажги фонарь у ярмарки')], gear: 'lantern' },
  torgovets: { title: 'Первая сделка', type: 'deliver', giver: 'torgovets', turnIn: 'torgovets', steps: [items('wood', 2), items('herb', 1)], gear: 'scales' },
  kuznets: { title: 'Молот мастера', type: 'gather', giver: 'kuznets', turnIn: 'kuznets', steps: [items('ore', 3)], gear: 'hammer' },
  strazhnik: { title: 'Ночной караул', type: 'guard', giver: 'rasporyaditel', turnIn: 'rasporyaditel', steps: [wait('gate', 45)], gear: 'shield' },
  luchnik: { title: 'Глаз королевства', type: 'explore', giver: 'khranitel', turnIn: 'khranitel', steps: [v('north'), v('east'), v('west'), v('bridge')], gear: 'bow' },
  alkhimik: { title: 'Целебный отвар', type: 'gather', giver: 'mag', turnIn: 'mag', steps: [items('herb', 4)], gear: 'satchel' },
  rytsar: { title: 'Клятва рыцаря', type: 'guard', giver: 'rasporyaditel', turnIn: 'rasporyaditel', steps: [wait('gate', 30, 'Принеси клятву у ворот (30 с)'), talk('kuznets', 'Получи доспех у кузнеца')], gear: 'cloak' },
  mag: { title: 'Звёздный кристалл', type: 'treasure', giver: 'mag', turnIn: 'mag', steps: [v('far_ne', 'Найди место падения звезды на северо-востоке'), wait('far_ne', 20, 'Дождись, пока осколок остынет (20 с)')], gear: 'staff' },
  sovetnik: { title: 'Совет королю', type: 'help', giver: 'rasporyaditel', turnIn: 'rasporyaditel', steps: [talk('traktirshchik', 'Узнай слухи у трактирщика'), talk('torgovets', 'Узнай цены у торговца'), talk('khranitel', 'Узнай вести из леса')], gear: 'seal' },
  graf: { title: 'Объезд владений', type: 'explore', giver: 'rasporyaditel', turnIn: 'rasporyaditel', steps: [v('far_ne'), v('far_nw'), v('far_sw'), v('far_se')], gear: 'ring' },
  gertsog: { title: 'Герцогская казна', type: 'deliver', giver: 'rasporyaditel', turnIn: 'rasporyaditel', steps: [items('wood', 5, 'Привези 5 брёвен для стройки')], gear: 'mantle' },
  korol: { title: 'Королевский смотр', type: 'explore', giver: 'rasporyaditel', turnIn: 'rasporyaditel', steps: [v('gate', 'Осмотри ворота замка'), v('bridge', 'Проверь мост'), talk('kuznets', 'Спроси кузнеца, готово ли оружие')], gear: 'mantle' },
};

// шаблоны ежедневных заданий
const DAILY = [
  { tpl: 'herbs', title: 'Травы для лекаря', type: 'gather', giver: 'mag', turnIn: 'mag', mk: r => [items('herb', 2 + (r % 3))] },
  { tpl: 'wood', title: 'Дрова для таверны', type: 'gather', giver: 'traktirshchik', turnIn: 'traktirshchik', mk: r => [items('wood', 2 + (r % 3))] },
  { tpl: 'ore', title: 'Руда для кузни', type: 'gather', giver: 'kuznets', turnIn: 'kuznets', mk: r => [items('ore', 2 + (r % 2))] },
  { tpl: 'parcel', title: 'Срочная посылка', type: 'deliver', giver: 'torgovets', mk: r => { const to = ['traktirshchik', 'kuznets', 'mag', 'khranitel'][r % 4]; return [talk(to, `Отнеси посылку: ${NPC[to].name}`)]; }, turnInFromLast: true },
  { tpl: 'letter', title: 'Письмо из замка', type: 'deliver', giver: 'rasporyaditel', mk: r => { const to = ['khranitel', 'torgovets', 'mag'][r % 3]; return [talk(to, `Отнеси письмо: ${NPC[to].name}`)]; }, turnInFromLast: true },
  { tpl: 'patrol', title: 'Дозор', type: 'guard', giver: 'rasporyaditel', turnIn: 'rasporyaditel', mk: r => { const p = ['gate', 'bridge', 'north', 'west'][r % 4]; return [wait(p, 30)]; } },
  { tpl: 'scout', title: 'Разведка окраин', type: 'explore', giver: 'khranitel', turnIn: 'khranitel', mk: r => { const a = ['far_ne', 'far_nw', 'far_se', 'far_sw']; return [v(a[r % 4]), v(a[(r + 1) % 4])]; } },
  { tpl: 'treasure', title: 'Тайник у дороги', type: 'treasure', giver: 'mag', turnIn: 'mag', mk: r => { const p = ['west', 'east', 'north', 'forest'][r % 4]; return [v(p, `Найди тайник: ${POI[p].name}`), wait(p, 10, 'Откопай тайник (10 с)')]; } },
  { tpl: 'help', title: 'Помощь трактирщику', type: 'help', giver: 'traktirshchik', turnIn: 'traktirshchik', mk: r => [talk('torgovets', 'Закажи у торговца специи'), talk('kuznets', 'Забери у кузнеца новый вертел')] },
];
const ROLE_DAILY = { zhitel: 'help', torgovets: 'parcel', kuznets: 'ore', strazhnik: 'patrol', luchnik: 'scout', alkhimik: 'herbs', rytsar: 'patrol', mag: 'treasure', sovetnik: 'letter', graf: 'scout', gertsog: 'wood', korol: 'scout' };

const BASE = { gather: [60, 18], deliver: [50, 22], guard: [55, 20], explore: [60, 20], treasure: [70, 25], help: [50, 18], story: [80, 25] };

// все задания, доступные герою (без учёта уже выполненных — это проверяет сервер)
export function questsFor(nick, roleId, level, date) {
  const out = [];
  for (const q of STORY) out.push({ ...q, period: 'once' });
  const rq = ROLEQ[roleId]; if (rq) out.push({ id: 'r:' + roleId, kind: 'role', minLevel: 2, period: 'once', title: rq.title, type: rq.type, giver: rq.giver, turnIn: rq.turnIn, steps: rq.steps,
    text: `Особое задание для роли. ${rq.steps.map(s => s.text).join(', ')}.`, done: `Ты справился! Держи награду: ${ITEMS[rq.gear].name}.`, reward: { xp: 150, coins: 40, items: [[rq.gear, 1]] }, role: roleId });
  // три ежедневных: одно по роли и два общих, выбор зависит от ника и даты
  const h = hash(nick + '|' + date), pick = [ROLE_DAILY[roleId] || 'help'];
  for (let k = 0; pick.length < 3 && k < 20; k++) { const t = DAILY[(h + k * 7) % DAILY.length].tpl; if (!pick.includes(t)) pick.push(t); }
  pick.forEach((tpl, i) => { const d = DAILY.find(x => x.tpl === tpl), r = (h >>> (i * 3)) & 0xff, steps = d.mk(r);
    const [bx, bc] = BASE[d.type]; const lvl = Math.min(level, 30);
    out.push({ id: `d:${tpl}`, kind: 'daily', period: date, minLevel: 1, title: d.title, type: d.type, giver: d.giver, turnIn: d.turnInFromLast ? steps.at(-1).npc : d.turnIn, steps,
      text: steps.map(s => s.text).join('. ') + '.', done: 'Спасибо! Приходи завтра, работа найдётся.',
      reward: { xp: Math.round(bx * (1 + lvl * 0.08)), coins: Math.round(bc * (1 + lvl * 0.05)) }, roleTip: i === 0 }); });
  return out;
}

// бонус специализации к награде
export function applySpec(roleId, q, reward) {
  const s = SPEC[roleId], r = { xp: reward.xp || 0, coins: reward.coins || 0, items: reward.items || [] };
  if (s && (s.kind === '*' || s.kind === q.type)) { r.xp = Math.round(r.xp * (1 + (s.xp || 0))); r.coins = Math.round(r.coins * (1 + (s.coins || 0))); }
  return r;
}

// ресурсы мира на день — все за рекой (за мостами): кучки на перекрёстках, деревья, камни и кусты в кварталах
export function nodesFor(date) {
  const h = hash('nodes|' + date), out = [], used = new Set();
  const pick = (list, key, cnt, salt) => { for (let k = 0; k < Math.min(cnt, list.length); k++) { let idx = Math.abs(((h ^ salt) + k * 2654435761) | 0) % list.length, t = 0; while (used.has(list[idx].x + ',' + list[idx].z) && t++ < list.length) idx = (idx + 1) % list.length; const c = list[idx]; used.add(c.x + ',' + c.z); out.push({ id: `${key}${k}`, ...c }); } };
  const cross = [];
  for (let i = -6; i <= 5; i++) for (let j = 5; j <= 15; j++) { const x = R(i), z = R(j), dr = z - riverZ(x); if (dr < 5.5 || z > 104 || Math.hypot(x + 0.45 - R(1), z + 0.45 - R(10)) < 11) continue; cross.push({ x: x + 0.45, z: z + 0.45, kind: 'pile', n: 1 }); }
  for (const [type, k] of [['herb', 1], ['wood', 2], ['ore', 3]]) { const before = out.length; pick(cross, type, 7, k * 0x9e3779b1); for (let q = before; q < out.length; q++) out[q].type = type; }
  const block = [];
  for (let i = -7; i <= 6; i++) for (let j = 5; j <= 15; j++) { const x = (i + 1) * PITCH, z = (j + 1) * PITCH, dr = z - riverZ(x); if (dr < 6.5 || z > 104 || Math.hypot(x - R(1), z - R(10)) < 11) continue; block.push({ x, z }); }
  for (const [kind, cnt, salt] of [['rock', 24, 0x5bd1e995], ['tree', 12, 0x27d4eb2f], ['bush', 10, 0x165667b1]]) { const before = out.length; pick(block, kind, cnt, salt);
    for (let q = before; q < out.length; q++) Object.assign(out[q], { kind, type: kind === 'tree' ? 'wood' : kind === 'rock' ? 'ore' : 'herb', n: kind === 'bush' ? 1 : 2 }); }
  return out;
}
// старые деревья мира (их расставляет карта): рубить можно, сервер проверяет только близость героя и лимит
export const CHOP = { wood: 2, perSlot: 12 };

export const ACH = {
  first_quest: { name: 'Первое поручение', text: 'Выполни первое задание' },
  quests10: { name: 'Верный подданный', text: 'Выполни 10 заданий' },
  quests50: { name: 'Опора королевства', text: 'Выполни 50 заданий' },
  level5: { name: 'Закалённый', text: 'Достигни 5 уровня' },
  level10: { name: 'Ветеран', text: 'Достигни 10 уровня' },
  gather30: { name: 'Собиратель', text: 'Собери 30 ресурсов' },
  story: { name: 'Вестник', text: 'Пройди сюжет «Тень над Севером»' },
  role: { name: 'Мастер своего дела', text: 'Выполни особое задание своей роли' },
};

// ---------------- отряды и совместные задания ----------------
export const SQUAD = { maxSize: 8, defaultSize: 5, minToStart: 2, chatGapMs: 2000 };
Object.assign(ITEMS, {
  ancient_coin: { name: 'Древняя монета', type: 'artifact', icon: '🪙' },
  forest_charm: { name: 'Оберег леса', type: 'artifact', icon: '🍀' },
  caravan_seal: { name: 'Печать каравана', type: 'artifact', icon: '🔏' },
});
// этапы: team_visit — найти точки; team_items — сдать ресурсы NPC; team_wait — общая работа (сумма секунд); together — собраться вместе
// mult — во сколько раз сильнее вклад роли на этом этапе (каждая роль может участвовать, у некоторых бонус)
export const SQUADQ = [
  { id: 'sq_treasure', title: 'Затерянное сокровище', giver: 'mag', hours: 2, text: 'Древний клад спрятан где-то на северо-западе. Найдите подсказки, раскопайте место и откройте сундук вместе.',
    stages: [
      { t: 'team_visit', pois: ['west', 'far_nw', 'north'], text: 'Найдите три подсказки', mult: { luchnik: 1.5, mag: 1.3 } },
      { t: 'team_wait', poi: 'far_nw', total: 90, text: 'Раскопайте место клада (вместе 90 с)', mult: { kuznets: 1.5, zhitel: 1.5, strazhnik: 1.2 } },
      { t: 'together', poi: 'far_nw', min: 2, text: 'Откройте сундук: соберитесь у клада вместе' }],
    reward: { xp: 180, coins: 70, items: [['ancient_coin', 1]] } },
  { id: 'sq_forest', title: 'Проклятый лес', giver: 'khranitel', hours: 2, text: 'Чёрная порча ползёт по лесу за рекой. Соберите травы для отвара, очистите лес и закончите обряд вместе.',
    stages: [
      { t: 'team_items', item: 'herb', n: 8, npc: 'khranitel', text: 'Сдайте хранителю 8 трав', mult: { alkhimik: 1.5, mag: 1.3 } },
      { t: 'team_wait', poi: 'forest', total: 120, text: 'Очистите лес (вместе 120 с)', mult: { mag: 1.5, alkhimik: 1.5, sovetnik: 1.3 } },
      { t: 'together', poi: 'forest', min: 2, text: 'Завершите обряд: соберитесь в лесу вместе' }],
    reward: { xp: 200, coins: 70, items: [['forest_charm', 1]] } },
  { id: 'sq_caravan', title: 'Караван в опасности', giver: 'torgovets', hours: 2, text: 'Королевский караван застрял на юге. Проверьте дорогу, почините телегу, охраняйте мост и встретьте караван.',
    stages: [
      { t: 'team_visit', pois: ['bridge', 'far_se', 'far_sw'], text: 'Проверьте дорогу каравана', mult: { luchnik: 1.5, graf: 1.3 } },
      { t: 'team_items', item: 'wood', n: 6, npc: 'torgovets', text: 'Сдайте торговцу 6 брёвен для телеги', mult: { torgovets: 1.5, kuznets: 1.3 } },
      { t: 'team_wait', poi: 'bridge', total: 90, text: 'Охраняйте мост (вместе 90 с)', mult: { strazhnik: 1.5, rytsar: 1.5, luchnik: 1.3 } },
      { t: 'together', poi: 'bridge', min: 2, text: 'Встретьте караван у моста вместе' }],
    reward: { xp: 190, coins: 90, items: [['caravan_seal', 1]] } },
];

// ---------------- бой и лавка ----------------
Object.assign(ITEMS, {
  potion: { name: 'Зелье лечения', type: 'consumable', icon: '🧪' },
  horse: { name: 'Конь', type: 'mount', icon: '🐎' }, // ездовой: быстрее в 1,6–1,9 раза, кнопка 🐎 у джойстика или клавиша H
  black_blade: { name: 'Чёрный клинок', type: 'gear', icon: '🗡️' }, order_shield: { name: 'Щит Ордена', type: 'gear', icon: '🛡️' },
  iron_helm: { name: 'Железный шлем', type: 'gear', icon: '⛑️' }, ancient_relic: { name: 'Древняя реликвия', type: 'artifact', icon: '🏺' }, lord_shard: { name: 'Осколок короны лорда', type: 'gear', icon: '💠' },
});
Object.assign(ACH, {
  first_blood: { name: 'Первая победа', text: 'Победи воина Чёрного Ордена' },
  slayer10: { name: 'Гроза Ордена', text: 'Одержи 10 побед над Орденом' },
  lord: { name: 'Победитель лорда', text: 'Одолей Тёмного лорда' },
});
export const SHOP = { buy: { potion: 15, gloves: 50, boots: 60, iron_helm: 120, horse: 600 }, sell: { herb: 3, wood: 3, ore: 4, potion: 6 } };

// ---------------- куда девать ресурсы: крафт, общая стройка, укрепления, дом, заказ дня ----------------
Object.assign(ITEMS, {
  potion_power: { name: 'Зелье силы', type: 'consumable', icon: '💪' },
  potion_speed: { name: 'Зелье скорости', type: 'consumable', icon: '💨' },
  wood_shield: { name: 'Дубовый щит', type: 'gear', icon: '🪵' },
});
SHOP.sell.potion_power = 10; SHOP.sell.potion_speed = 8;
export const RES = ['wood', 'herb', 'ore'];
export const RESPAWN_MS = 5 * 60e3; // ресурсы на карте возвращаются каждые 5 минут
export const slotOf = now => Math.floor(now / RESPAWN_MS);
// смена роли за монеты: цена — по редкости новой роли
export const ROLE_PRICE = { zhitel: 300, torgovets: 300, kuznets: 300, strazhnik: 800, luchnik: 800, alkhimik: 800, rytsar: 2000, mag: 2000, sovetnik: 5000, graf: 5000, gertsog: 15000 };
// рецепты: у кого варить/ковать, что нужно, что получится
export const RECIPES = {
  potion: { npc: 'mag', need: { herb: 3 }, text: 'Лечит половину здоровья' },
  potion_power: { npc: 'mag', need: { herb: 4, ore: 1 }, text: 'Атака +25% на 10 минут' },
  potion_speed: { npc: 'mag', need: { herb: 3, wood: 1 }, text: 'Бег быстрее на 30% на 10 минут' },
  gloves: { npc: 'kuznets', need: { ore: 2, wood: 1 }, text: 'Атака +2' },
  boots: { npc: 'kuznets', need: { ore: 2, wood: 2, herb: 1 }, text: 'Уворот +5%' },
  wood_shield: { npc: 'kuznets', need: { wood: 5, ore: 1 }, text: 'Защита +3' },
  iron_helm: { npc: 'kuznets', need: { ore: 6, wood: 1 }, text: 'Здоровье +25' },
};
export const BUFFS = { potion_power: { key: 'power', min: 10 }, potion_speed: { key: 'speed', min: 10 } };
// улучшение оружия у кузнеца: +2 к атаке за уровень; выше +3 — только когда построена Большая кузня
export const WEAPON = { atk: 2, max: 5, maxNoForge: 3, cost: lv => ({ ore: 3 + 2 * lv, wood: 1 + lv }) };
// общие стройки во дворе крепости: ресурсы сдают все герои вместе
export const BUILDS = {
  taverna: { name: 'Таверна', x: 0, z: -13.2, need: { wood: 1200, herb: 400 }, bonus: '+10% опыта за задания всем героям' },
  kuznya: { name: 'Большая кузня', x: 13.2, z: 0, need: { wood: 800, ore: 1000 }, bonus: 'Ковка у кузнеца на 1 руду дешевле, оружие до +5' },
};
// укрепления перед вторжением: очки за сданные ресурсы ослабляют осаду (до −30% к цели обороны)
export const FORT = { pts: { wood: 1, ore: 2, herb: 0 }, max: 200, cut: 0.3 };
// украшения своего дома на карте подписчиков
export const DECOR = {
  flowers: { name: 'Клумба', icon: '🌷', need: { herb: 18 } },
  woodpile: { name: 'Поленница', icon: '🪵', need: { wood: 24 } },
  well: { name: 'Колодец', icon: '🪣', need: { ore: 18, wood: 12 } },
  banner: { name: 'Знамя рода', icon: '🚩', need: { ore: 12, wood: 12, herb: 6 } },
};
// заказ торговца дня: одинаковый для всех, меняется каждый день; платит втрое больше обычной цены
export function dailyOrder(date) {
  const h = hash('order:' + date) >>> 0, need = { wood: 3 + h % 6, herb: 2 + (h >>> 4) % 5, ore: 2 + (h >>> 8) % 4 };
  const coins = 3 * Object.entries(need).reduce((s, [k, n]) => s + SHOP.sell[k] * n, 0);
  return { need, coins, xp: 40 };
}

// ---------------- рынок: купцы скупают ресурсы дороже лавки; цена падает, когда королевство продаёт много, и растёт к утру ----------------
export const MARKET_STALLS = [
  { id: 'les', item: 'wood', name: 'Лесоторговец', who: 'Ефим', icon: '🪵', dx: 0, dz: -6.2 },
  { id: 'trava', item: 'herb', name: 'Травница', who: 'Агафья', icon: '🌿', dx: 6.2, dz: 0 },
  { id: 'ruda', item: 'ore', name: 'Рудознатец', who: 'Тихон', icon: '⛏️', dx: 0, dz: 6.2 },
];
export const MARKET_BASE = { sell: { wood: 6, herb: 6, ore: 8 }, buy: { wood: 12, herb: 12, ore: 16 }, glut: 600, floor: 0.5, hot: 1.8, trader: 1.15 };
export const MARKET_RARE = [['potion_power', 35], ['potion_speed', 30], ['wood_shield', 80], ['iron_helm', 100], ['boots', 55], ['gloves', 45]];
// товар дня в цене (скупают почти вдвое дороже) и редкий товар дня — одинаковы для всех, меняются в полночь
export function marketDay(date) { const h = hash('market|' + date) >>> 0; return { hot: RES[h % RES.length], rare: MARKET_RARE[(h >>> 5) % MARKET_RARE.length] }; }
export function marketPrices(date, sold = {}, role = '') {
  const d = marketDay(date), B = MARKET_BASE, out = {};
  for (const it of RES) { const glut = Math.max(B.floor, 1 - (sold[it] || 0) / B.glut), hot = it === d.hot;
    out[it] = { sell: Math.max(1, Math.round(B.sell[it] * (hot ? B.hot : 1) * glut * (role === 'torgovets' ? B.trader : 1))), buy: Math.round(B.buy[it] * (hot ? 1.3 : 1)), hot, glut: Math.round(glut * 100), sold: sold[it] || 0 }; }
  return { day: d, res: out, rare: { item: d.rare[0], price: Math.round(d.rare[1] * (role === 'torgovets' ? 0.9 : 1)) } };
}
