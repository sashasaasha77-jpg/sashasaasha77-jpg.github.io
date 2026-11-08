// Паспорт подданного — картинка 1080×1920 для сторис Instagram
const W = 1080, H = 1920;
const C = { purple: '#4B2A7B', crimson: '#A4161A', gold: '#E8B931', ivory: '#F5EBDC', ink: '#1A1210', brown: '#5A3A22' };
const DISP = '"Ruslan Display", Georgia, serif', BODY = '"Montserrat", "Segoe UI", sans-serif';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const LVN = ['Изба', 'Дом', 'Усадьба', 'Башня', 'Замок'];

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rr(x, cx, cy, w, h, r) { x.beginPath(); x.moveTo(cx + r, cy); x.arcTo(cx + w, cy, cx + w, cy + h, r); x.arcTo(cx + w, cy + h, cx, cy + h, r); x.arcTo(cx, cy + h, cx, cy, r); x.arcTo(cx, cy, cx + w, cy, r); x.closePath(); }
function fit(x, text, font, size, maxW) { do { x.font = font.replace('$', size); if (x.measureText(text).width <= maxW) break; size -= 2; } while (size > 18); return size; }
function wrap(x, text, maxW, maxLines) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…'; } return lines;
}
function svgImage(svg) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); });
}
function dateRu(d) { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : `${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`; }

export async function drawPassport(K, p) {
  try { await Promise.all([document.fonts.load(`64px ${DISP}`, 'Королевство'), document.fonts.load(`800 40px ${BODY}`, 'Аа'), document.fonts.load(`600 30px ${BODY}`, 'Аа')]); } catch {}
  const r = p.role, t = K.TIERS[r.tier];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');

  // фон: ночное небо королевства
  const g = x.createRadialGradient(W / 2, 760, 80, W / 2, 900, 1250); g.addColorStop(0, '#5d379a'); g.addColorStop(.55, C.purple); g.addColorStop(1, '#1b0f30');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rnd = rng(hashStr(p.nick));
  for (let i = 0; i < 140; i++) { const sx = rnd() * W, sy = rnd() * H, s = rnd() < .12 ? 4 : 2; x.globalAlpha = .25 + rnd() * .6; x.fillStyle = rnd() < .3 ? C.gold : C.ivory; x.fillRect(sx, sy, s, s); }
  x.globalAlpha = 1;

  // шапка
  x.textAlign = 'center'; x.fillStyle = C.gold; x.strokeStyle = C.ink; x.lineJoin = 'round';
  const ts = fit(x, 'КОРОЛЕВСТВО ПОДПИСЧИКОВ', `$px ${DISP}`, 66, 960); x.font = `${ts}px ${DISP}`;
  x.lineWidth = 8; x.strokeText('КОРОЛЕВСТВО ПОДПИСЧИКОВ', W / 2, 220); x.fillText('КОРОЛЕВСТВО ПОДПИСЧИКОВ', W / 2, 220);

  // книжка паспорта
  const PX = 80, PY = 290, PW = 920, PH = 1210;
  x.fillStyle = C.ink; rr(x, PX + 14, PY + 14, PW, PH, 40); x.fill();
  x.fillStyle = C.ivory; rr(x, PX, PY, PW, PH, 40); x.fill();
  x.lineWidth = 8; x.strokeStyle = C.ink; x.stroke();
  x.save(); rr(x, PX, PY, PW, PH, 40); x.clip();
  x.fillStyle = C.crimson; x.fillRect(PX, PY, PW, 130);
  x.fillStyle = C.ink; x.fillRect(PX, PY + 130, PW, 6);
  // водяной узор
  x.globalAlpha = .06; x.strokeStyle = C.purple; x.lineWidth = 3;
  for (let i = 0; i < 26; i++) { x.beginPath(); for (let k = 0; k <= 40; k++) { const xx = PX + k * PW / 40, yy = PY + 170 + i * 42 + Math.sin(k / 3 + i) * 10; k ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); }
  x.globalAlpha = 1; x.restore();
  x.strokeStyle = C.gold; x.lineWidth = 4; rr(x, PX + 22, PY + 156, PW - 44, PH - 178, 26); x.stroke();

  x.fillStyle = C.ivory; x.font = `56px ${DISP}`; x.fillText('ПАСПОРТ ПОДДАННОГО', W / 2, PY + 88);

  // герб
  const crest = await svgImage(K.crest(r, 240)); x.drawImage(crest, PX + 50, PY + 180, 240, 288);

  // ник, роль, редкость
  x.textAlign = 'left'; const TX = PX + 320, TW = PW - 320 - 50;
  x.fillStyle = C.brown; x.font = `800 26px ${BODY}`; x.fillText('ПОДДАННЫЙ', TX, PY + 220);
  const nick = '@' + p.nick; const ns = fit(x, nick, `800 $px ${BODY}`, 54, TW); x.font = `800 ${ns}px ${BODY}`; x.fillStyle = C.ink; x.fillText(nick, TX, PY + 284);
  x.fillStyle = C.brown; x.font = `800 26px ${BODY}`; x.fillText('РОЛЬ', TX, PY + 344);
  const rs = fit(x, r.name, `$px ${DISP}`, 88, TW); x.font = `${rs}px ${DISP}`; x.fillStyle = C.ink; x.fillText(r.name, TX, PY + 422);
  const pill = (t.name + ' роль').toUpperCase(); x.font = `800 24px ${BODY}`; const pw = x.measureText(pill).width + 40;
  x.fillStyle = t.bg; rr(x, TX, PY + 446, pw, 46, 23); x.fill(); x.lineWidth = 4; x.strokeStyle = C.ink; x.stroke();
  x.fillStyle = t.fg; x.fillText(pill, TX + 20, PY + 478);

  // снимок дома с карты
  const SX = PX + 50, SY = PY + 530, SW = PW - 100, SH = 320;
  let snap = null; try { snap = K.snapshot && K.snapshot(p.nick); } catch {}
  x.save(); rr(x, SX, SY, SW, SH, 24); x.clip();
  if (snap && snap.width) {
    const a = SW / SH, cw = snap.width, ch = snap.height; let w = cw, h = cw / a; if (h > ch) { h = ch; w = ch * a; }
    w *= .85; h *= .85; x.drawImage(snap, (cw - w) / 2, (ch - h) / 2, w, h, SX, SY, SW, SH);
  } else { x.fillStyle = '#6aa84f'; x.fillRect(SX, SY, SW, SH); }
  x.restore(); x.lineWidth = 6; x.strokeStyle = C.ink; rr(x, SX, SY, SW, SH, 24); x.stroke();
  // подпись на снимке
  const lvl = LVN[(K.levelOf && K.levelOf(p.nick)) || 0];
  const cap = `${lvl} · участок № ${K.fmt(p.i + 1)}`; x.font = `800 30px ${BODY}`; const cwid = x.measureText(cap).width + 44;
  x.fillStyle = C.ink; rr(x, SX + 20, SY + SH - 70, cwid, 52, 14); x.fill(); x.fillStyle = C.gold; x.fillText(cap, SX + 42, SY + SH - 33);

  // поля
  let y = SY + SH + 58;
  const field = (label, value) => { x.fillStyle = C.brown; x.font = `800 24px ${BODY}`; x.fillText(label, SX, y); x.fillStyle = C.ink; x.font = `700 34px ${BODY}`; x.fillText(value, SX + 300, y); y += 52; };
  field('ПОДДАННЫЙ С', dateRu(p.added));
  field('ДЕНЬ КОРОЛЕВСТВА', String(K.dayOf(p.added)));
  x.fillStyle = C.brown; x.font = `800 24px ${BODY}`; x.fillText('СЛУЖБА', SX, y);
  x.fillStyle = C.ink; x.font = `600 28px ${BODY}`; wrap(x, r.duty, SW - 300 - 190, 3).forEach((l, i) => x.fillText(l, SX + 300, y + i * 36));

  // номер и печать короля
  const no = 'КП-' + String(hashStr('pass:' + p.nick) % 1000000).padStart(6, '0');
  x.fillStyle = C.brown; x.font = `800 26px ${BODY}`; x.fillText('№ ' + no, SX, PY + PH - 44);
  x.font = `italic 600 26px ${BODY}`; x.fillText('Подпись короля:', SX + 300, PY + PH - 44);
  const gx = SX + 300 + x.measureText('Подпись короля:').width + 14, gy = PY + PH - 50;
  x.strokeStyle = C.purple; x.lineWidth = 4; x.beginPath(); x.moveTo(gx, gy);
  x.bezierCurveTo(gx + 20, gy - 44, gx + 40, gy + 30, gx + 64, gy - 14); x.bezierCurveTo(gx + 84, gy - 44, gx + 94, gy + 10, gx + 120, gy - 6); x.stroke();
  const cx = PX + PW - 120, cy = PY + PH - 120;
  x.fillStyle = C.crimson; x.beginPath(); for (let i = 0; i < 24; i++) { const ang = i / 24 * Math.PI * 2, rad = i % 2 ? 72 : 80; x.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad); } x.closePath(); x.fill();
  x.lineWidth = 5; x.strokeStyle = C.ink; x.stroke();
  x.strokeStyle = '#7a0f12'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 56, 0, Math.PI * 2); x.stroke();
  x.fillStyle = C.gold; x.beginPath(); x.moveTo(cx - 34, cy + 20); x.lineTo(cx - 38, cy - 22); x.lineTo(cx - 17, cy); x.lineTo(cx, cy - 30); x.lineTo(cx + 17, cy); x.lineTo(cx + 38, cy - 22); x.lineTo(cx + 34, cy + 20); x.closePath(); x.fill();
  x.fillRect(cx - 34, cy + 24, 68, 10);

  // призыв
  x.textAlign = 'center';
  x.fillStyle = C.ivory; x.font = `800 40px ${BODY}`; x.fillText('Отметь в сторис', W / 2, 1590);
  x.fillStyle = C.gold; x.font = `800 58px ${BODY}`; x.lineWidth = 8; x.strokeStyle = C.ink; x.strokeText('@korol_podpi', W / 2, 1662); x.fillText('@korol_podpi', W / 2, 1662);
  x.fillStyle = 'rgba(245,235,220,.75)'; x.font = `600 28px ${BODY}`; x.fillText('sashasaasha77-jpg.github.io', W / 2, 1714);

  return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
}

let busy = false;
export async function openPassport(K, p) {
  if (busy || !p) return; busy = true;
  const sheet = document.getElementById('sheet'), body = document.getElementById('sheetBody');
  body.innerHTML = `<h2>Паспорт подданного</h2><p>Готовлю паспорт для @${p.nick}…</p>`; sheet.classList.add('show');
  let blob; try { blob = await drawPassport(K, p); } catch (e) { body.innerHTML = '<h2>Паспорт подданного</h2><p>Не получилось нарисовать паспорт. Обнови страницу и попробуй ещё раз.</p>'; busy = false; return; }
  busy = false;
  const name = `pasport-${p.nick}.png`, url = URL.createObjectURL(blob), file = new File([blob], name, { type: 'image/png' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  body.innerHTML = `<h2>Паспорт подданного</h2>
    <img class="passimg" src="${url}" alt="Паспорт подданного @${p.nick}">
    <div class="passbtns">${canShare ? '<button class="btn btn-gold" id="pShare" type="button">Поделиться в сторис</button>' : ''}
      <a class="btn ${canShare ? 'btn-paper' : 'btn-gold'}" id="pSave" href="${url}" download="${name}">Сохранить картинку</a></div>
    <p class="passhint">Выложи паспорт в сторис Instagram и <b>отметь @korol_podpi</b>. Король отметит тебя у себя в истории.<br>Если кнопка не сработала, нажми на картинку, удерживай её и выбери «Сохранить».</p>`;
  const sh = document.getElementById('pShare');
  sh && sh.addEventListener('click', async () => { try { await navigator.share({ files: [file], title: 'Паспорт подданного', text: 'Я в Королевстве подписчиков! @korol_podpi' }); } catch {} });
}
