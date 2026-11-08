// фильтр мата и оскорблений для чата: заменяет найденное звёздочками (учитывает латинские «двойники» букв)
const LOOK = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', '0': 'о', '3': 'з', '6': 'б', '@': 'а', 'ё': 'е' };
const PRE = '(?:за|на|по|вы|от|отъ|до|об|объ|у|при|про|раз|рас|под|пере|съ|с|из|недо|ни)?';
const W = '[а-яa-z]';
const RULES = [
  `${PRE}ху[йеяю]${W}*`, `${PRE}пизд${W}*`, `${PRE}(?:ъ)?еб(?:а|у|л|н|т|ё|е|и|ись)${W}*`, `долб[ао]еб${W}*`, `бля(?:д|т|х)?${W}*`,
  `сук(?:а|и|е|у|ой|ам|ами)(?!${W})`, `с[уy]ч(?:ка|ки|ке|ку|ара)${W}*`, `муд(?:ак|ил|ачь|охат)${W}*`, `п[ие]д[оа]р${W}*`, `п[ие]дрил${W}*`, `г[ао]ндон${W}*`,
  `залуп${W}*`, `шлюх${W}*`, `(?:на|по)хер(?!${W})`, `хер(?:ня|ов|ом)?(?!${W})`, `чурк${W}*`, `хач(?:и|ей|ам)?(?!${W})`, `даун(?:ы|ов)?(?!${W})`,
];
const EN = ['fuck[a-z]*', 'shit(?:s|ty|head)?(?![a-z])', 'bitch[a-z]*', 'cunt[a-z]*', 'nigg[a-z]*', 'fag(?:s|got[a-z]*)?(?![a-z])'];
const RE = new RegExp(`(?<![а-яa-z])(?:${RULES.join('|')})`, 'gi'), RE_EN = new RegExp(`(?<![a-z])(?:${EN.join('|')})`, 'gi');
export function censor(text) {
  const src = [...String(text)], chars = [...src]; let hit = false;
  const scan = (re, low) => { let m; re.lastIndex = 0; while ((m = re.exec(low))) { hit = true; const start = [...low.slice(0, m.index)].length, len = [...m[0]].length; for (let i = start; i < start + len; i++) chars[i] = '*'; if (!m[0].length) re.lastIndex++; } };
  scan(RE, src.map(ch => { const l = ch.toLowerCase(); return LOOK[l] || l; }).join(''));   // русские слова, в т.ч. с латинскими «двойниками»
  scan(RE_EN, src.map(ch => ch.toLowerCase()).join(''));                                     // английские
  return { text: chars.join(''), hit };
}
