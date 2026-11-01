// AI dựng từ A–Z + sửa theo lời nói. Mọi thay đổi là "op" → con trỏ diễn lại trên timeline rồi mới áp vào dự án.
import {analyzeAudio, findSilences, levels, wav16} from './media.js';
import {duration, tlOfSrc, timelineWords, ICONS} from './render.js';
import {applyOp, describeOp, find, newText, uid} from './model.js';
import {genreOf, formatOf} from './templates.js';

// ---------- Gọi máy chủ ----------
let health = null;
export async function aiHealth() {
  if (health) return health;
  try {
    const r = await fetch('api/health', {cache: 'no-store'});
    health = r.ok ? await r.json() : {ai: false, stt: false};
  } catch (e) {
    health = {ai: false, stt: false};
  }
  return health;
}
async function api(path, body, isBlob, query = '') {
  const r = await fetch('api/' + path + query, {
    method: 'POST',
    headers: isBlob ? {'content-type': 'audio/wav'} : {'content-type': 'application/json'},
    body: isBlob ? body : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Máy chủ AI lỗi ' + r.status);
  return j;
}

// ---------- Tiện ích chữ tiếng Việt ----------
export const plain = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

// ---------- Kiểm tra op do AI trả về ----------
const OPS = new Set(['cut', 'split', 'add', 'update', 'remove', 'subs', 'cta', 'music']);
const TEXT_KEYS = ['start', 'dur', 'lead', 'main', 'sign', 'font', 'color', 'style', 'size', 'x', 'y', 'icon', 'kind'];
const BROLL_KEYS = ['start', 'dur', 'in', 'trans', 'src'];
export function sanitizeOps(p, ops, target) {
  const out = [];
  for (const o of Array.isArray(ops) ? ops : []) {
    if (!o || !OPS.has(o.op)) continue;
    if (o.op === 'add') {
      if (o.list === 'texts') {
        const it = newText(+o.item?.start || 0);
        for (const k of TEXT_KEYS) if (o.item?.[k] !== undefined) it[k] = o.item[k];
        if (it.icon && !ICONS[it.icon]) it.icon = '';
        it.main = String(it.main || '').slice(0, 40);
        out.push({op: 'add', list: 'texts', item: it});
      } else if (o.list === 'broll' && p.sources[o.item?.src]) {
        const src = p.sources[o.item.src];
        const dur = Math.min(+o.item.dur || 3, src.duration);
        out.push({op: 'add', list: 'broll', item: {id: uid('b'), src: src.id, start: +o.item.start || 0, dur, in: Math.max(0, Math.min(+o.item.in || 0, src.duration - dur)), trans: o.item.trans || 'fade', locked: false}});
      } else if (o.list === 'zooms') {
        out.push({op: 'add', list: 'zooms', item: {id: uid('z'), start: +o.item?.start || 0, dur: +o.item?.dur || 2.5, scale: Math.min(1.25, Math.max(1.02, +o.item?.scale || 1.08))}});
      }
      continue;
    }
    if (o.op === 'update' || o.op === 'remove') {
      const f = find(p, o.id);
      if (!f) continue;
      // Chỗ khách đã sửa tay (khoá) thì AI không đụng, trừ khi khách đang nhờ sửa đúng chỗ đó
      if (f.item.locked && o.id !== target) continue;
      if (o.op === 'update') {
        const keys = f.list === 'texts' ? TEXT_KEYS : f.list === 'broll' ? BROLL_KEYS : ['start', 'dur', 'scale'];
        const set = {};
        for (const k of keys) if (o.set?.[k] !== undefined) set[k] = o.set[k];
        if (Object.keys(set).length) out.push({op: 'update', id: o.id, set});
      } else out.push(o);
      continue;
    }
    if (o.op === 'cut' && isFinite(o.a) && isFinite(o.b) && o.b > o.a) out.push({op: 'cut', a: +o.a, b: +o.b});
    else if (o.op === 'split' && isFinite(o.T)) out.push(o);
    else if (['subs', 'cta', 'music'].includes(o.op)) out.push(o);
  }
  return out;
}

// ---------- Kế hoạch dựng khi chưa có AI máy chủ ----------
const PALETTE = ['#ffc61a', '#2f8cff', '#ff5fb8', '#2ad46a', '#9a6bff', '#ff8a1f'];
// Đơn vị đi sau con số → cách hiện trên hình (chỉ đưa số lên hình khi CHÍNH người nói nói ra — luật của Giang)
const UNITS = [
  [/^(ty)$/, 'TỶ', 'price'],
  [/^(trieu|tr)$/, 'TRIỆU', 'price'],
  [/^(nghin|ngan|k)$/, 'K', 'price'],
  [/^(dong|vnd)$/, 'Đ', 'price'],
  [/^(phan)$/, '%', 'pct'],
  [/^%$/, '%', 'pct'],
  [/^(m2|met)$/, 'M²', 'area'],
];
const NOUNS = /^(buoc|meo|cach|ly do|dieu|loai|mon|phong|tang|lau|ngay|thang|nam|phut|gio|nguoi|san pham|mau|size|cai|chiec|hop|goi|kg|km|lan|diem|sao)$/;
export function numberLockups(p) {
  const g = p.genre || 'chung';
  const icons = genreOf(p).icons;
  const ws = timelineWords(p);
  const out = [];
  let ci = 0;
  for (let i = 0; i < ws.length; i++) {
    const w = plain(ws[i].w).replace(/[.,!?]$/, '');
    // “199”, “3,8”, “50%”, “399k”, “5tr”
    const mm = w.match(/^(\d+(?:[.,]\d+)?)(k|tr|%)?$/);
    if (!mm) continue;
    const num = mm[1];
    const next = plain(ws[i + 1]?.w || '').replace(/[.,!?]$/, '');
    const prev = plain((ws[i - 2]?.w || '') + ' ' + (ws[i - 1]?.w || ''));
    const at = ws[i].s;
    const unit = mm[2] === '%' ? UNITS[5] : mm[2] === 'k' ? UNITS[2] : mm[2] === 'tr' ? UNITS[1] : UNITS.find(([re]) => re.test(next));
    if (unit && unit[2] === 'price') {
      const lead = /chi con/.test(prev) ? 'chỉ còn' : /giam|sale|khuyen/.test(prev) ? 'giảm còn' : g === 'bds' || g === 'banhang' ? 'giá' : '';
      out.push(newText(at, {kind: 'price', lead, main: `${num} ${unit[1]}`.replace(' K', 'K').replace(' Đ', 'Đ'), color: '#ff2a2a', icon: icons.includes('tag') ? 'tag' : icons[0], dur: 4}));
    } else if (unit && unit[2] === 'pct') {
      out.push(newText(at, {lead: /giam|sale/.test(prev) ? 'giảm' : '', main: `${num.replace('%', '')}%`, color: '#ffc61a', icon: icons.includes('fire') ? 'fire' : icons[0], dur: 3.5}));
    } else if (unit && unit[2] === 'area') {
      out.push(newText(at, {lead: 'diện tích', main: `${num} M²`, color: '#ffc61a', icon: icons.includes('ruler') ? 'ruler' : icons[0], dur: 3.5}));
    } else if (NOUNS.test(next) && g !== 'bds') {
      // “3 bước”, “5 mẹo”, “2 tầng”… → cụm chữ màu xoay vòng, icon theo thể loại
      out.push(newText(at, {main: `${num} ${ws[i + 1].w.replace(/[.,!?]$/, '')}`.toUpperCase(), color: PALETTE[ci % PALETTE.length], icon: icons[ci % icons.length], dur: 3.2}));
      ci++;
    } else if (g === 'bds' && /^x$/.test(next)) {
      out.push(newText(at, {lead: 'diện tích', main: `${num} X ${ws[i + 2]?.w || ''}`.toUpperCase(), color: '#ffc61a', icon: 'ruler', dur: 3.5}));
    }
  }
  // không chồng nhau: cụm sau cách cụm trước ≥ 2,2 s; cụm trước tự rút ngắn để nhường chỗ
  const keep = [];
  for (const t of out) {
    const last = keep[keep.length - 1];
    if (last && t.start - last.start < 2.2) {
      // giá quan trọng hơn: thay cụm trước nếu cụm trước không phải giá
      if (t.kind === 'price' && last.kind !== 'price') keep[keep.length - 1] = t;
      continue;
    }
    if (last && last.start + last.dur > t.start - 0.15) last.dur = Math.max(2, t.start - 0.15 - last.start);
    keep.push(t);
  }
  return keep;
}

export function localPlan(p) {
  const D = duration(p);
  const ops = [];
  const B = Object.values(p.sources).filter((s) => s.kind === 'broll');
  const words = timelineWords(p);
  const used = [];
  const body0 = Math.min(3, D * 0.15);
  const body1 = Math.max(body0 + 2, D - 4.5);
  const trans = ['fade', 'zoom', 'fade', 'slide'];
  // ghép cảnh theo tên file khớp lời nói, còn lại rải đều
  const free = [];
  B.forEach((s) => {
    const toks = plain(s.name).split(/[^a-z0-9]+/).filter((x) => x.length > 2);
    const hit = toks.length ? words.find((w) => w.s > body0 && w.s < body1 && toks.some((t) => plain(w.w).includes(t))) : null;
    if (hit) used.push({s, at: hit.s});
    else free.push(s);
  });
  const slots = Math.max(0, Math.floor((body1 - body0) / 6));
  free.slice(0, slots).forEach((s, i) => used.push({s, at: body0 + ((i + 0.5) * (body1 - body0)) / Math.max(1, Math.min(slots, free.length))}));
  used.sort((a, b) => a.at - b.at);
  let last = -9;
  used.forEach((u, i) => {
    const dur = Math.min(3.2, u.s.duration);
    const at = Math.max(u.at, last + 0.5);
    if (at + dur > body1 + 2) return;
    last = at + dur;
    ops.push({op: 'add', list: 'broll', item: {id: uid('b'), src: u.s.id, start: at, dur, in: Math.max(0, u.s.duration / 2 - dur / 2), trans: trans[i % trans.length], locked: false}});
  });
  // chữ số liệu từ lời nói
  const lk = numberLockups(p);
  lk.forEach((t) => ops.push({op: 'add', list: 'texts', item: t}));
  // zoom đẩy máy mỗi ~7 giây, tránh lúc đang có cảnh phụ
  const br = ops.filter((o) => o.list === 'broll').map((o) => o.item);
  for (let t = 1.2; t < D - 5; t += 7) {
    if (br.some((b) => t + 2.5 > b.start && t < b.start + b.dur)) continue;
    ops.push({op: 'add', list: 'zooms', item: {id: uid('z'), start: t, dur: 2.4, scale: 1.08}});
  }
  if (!p.cta?.on) ops.push({op: 'cta', set: {on: true}});
  return ops;
}

// ---------- Lệnh sửa cơ bản khi chưa có AI máy chủ ----------
const COLOR_WORDS = [
  ['xanh la', '#2ad46a'],
  ['xanh duong', '#2f8cff'],
  ['xanh nuoc bien', '#2f8cff'],
  ['vang', '#ffc61a'],
  ['do', '#ff2a2a'],
  ['hong', '#ff5fb8'],
  ['cam', '#ff8a1f'],
  ['tim', '#9a6bff'],
  ['trang', '#ffffff'],
  ['xanh', '#2f8cff'],
];
export function localCommand(p, text, target) {
  const t = ' ' + plain(text) + ' ';
  const ops = [];
  let targets = [];
  const tf = target ? find(p, target) : null;
  if (tf) targets = [tf];
  else if (/ gia /.test(t)) targets = p.texts.filter((x) => x.kind === 'price' || /TỶ|TRIỆU/.test(x.main)).map((item) => ({list: 'texts', item}));
  else if (/ chu /.test(t) && !/phu de/.test(t)) targets = p.texts.map((item) => ({list: 'texts', item}));
  else if (/ canh | b-?roll /.test(t)) targets = p.broll.map((item) => ({list: 'broll', item}));
  const num = +((t.match(/(\d+([.,]\d+)?)\s*giay/) || [])[1] || '1').replace(',', '.');

  if (/phu de/.test(t)) {
    if (/hop|khung/.test(t)) ops.push({op: 'subs', set: {on: true, style: 'box'}});
    else if (/noi bat|karaoke|doi mau/.test(t)) ops.push({op: 'subs', set: {on: true, style: 'karaoke'}});
    else if (/toi gian|don gian|nhe nhang/.test(t)) ops.push({op: 'subs', set: {on: true, style: 'clean'}});
    else if (/tung chu|bat chu/.test(t)) ops.push({op: 'subs', set: {on: true, style: 'pop'}});
    else if (/tat|bo|an /.test(t)) ops.push({op: 'subs', set: {on: false}});
    else if (/to hon|lon hon/.test(t)) ops.push({op: 'subs', set: {on: true, size: Math.min(1.6, (p.subs.size || 1) * 1.15)}});
    else if (/nho hon|nho lai/.test(t)) ops.push({op: 'subs', set: {on: true, size: Math.max(0.7, (p.subs.size || 1) / 1.15)}});
    else if (/len tren/.test(t)) ops.push({op: 'subs', set: {y: Math.max(0.3, (p.subs.y ?? 0.7) - 0.08)}});
    else if (/xuong/.test(t)) ops.push({op: 'subs', set: {y: Math.min(0.88, (p.subs.y ?? 0.7) + 0.08)}});
    else ops.push({op: 'subs', set: {on: true}});
  } else if (/ nhac /.test(t) && p.music) {
    if (/bo|tat|xoa/.test(t)) ops.push({op: 'music', set: null});
    else if (/nho/.test(t)) ops.push({op: 'music', set: {vol: Math.max(0.05, (p.music.vol ?? 0.2) * 0.7)}});
    else if (/to|lon/.test(t)) ops.push({op: 'music', set: {vol: Math.min(0.8, (p.music.vol ?? 0.2) * 1.4)}});
  } else {
    for (const f of targets) {
      const it = f.item;
      const set = {};
      const col = COLOR_WORDS.find(([w]) => t.includes(' ' + w + ' ') || t.includes(' mau ' + w));
      if (col && f.list === 'texts') set.color = col[1];
      if (/to hon|lon hon/.test(t) && f.list === 'texts') set.size = Math.min(1.8, (it.size || 1) * 1.2);
      if (/nho hon|nho lai/.test(t) && f.list === 'texts') set.size = Math.max(0.5, (it.size || 1) / 1.2);
      if (/len tren|day len/.test(t) && f.list === 'texts') set.y = Math.max(0.08, (it.y ?? 0.2) - 0.08);
      if (/xuong duoi|ha xuong/.test(t) && f.list === 'texts') set.y = Math.min(0.9, (it.y ?? 0.2) + 0.08);
      if (/dai them|keo dai/.test(t)) set.dur = it.dur + num;
      if (/ngan lai|bot di/.test(t)) set.dur = Math.max(0.6, it.dur - num);
      if (/ 3d | noi /.test(t)) set.style = '3d';
      if (/ vien /.test(t)) set.style = 'outline';
      if (/ phang /.test(t)) set.style = 'flat';
      for (const [k, name] of [['anton', 'anton'], ['montserrat', 'montserrat'], ['oswald', 'oswald'], ['be vietnam', 'bvp']]) if (t.includes(k)) set.font = name;
      if (/chuyen canh/.test(t) && f.list === 'broll') {
        if (/mo/.test(t)) set.trans = 'fade';
        if (/zoom|phong/.test(t)) set.trans = 'zoom';
        if (/truot/.test(t)) set.trans = 'slide';
        if (/khong|bo/.test(t)) set.trans = 'none';
      }
      if (/ xoa | bo di | xoa di /.test(t)) ops.push({op: 'remove', id: it.id});
      else if (Object.keys(set).length) ops.push({op: 'update', id: it.id, set});
    }
  }
  const reply = ops.length
    ? `Đã làm ${ops.length} thay đổi. (Chế độ thử: AI máy chủ chưa bật nên mình chỉ hiểu lệnh cơ bản như đổi màu, cỡ, font, dời lên/xuống, dài thêm/ngắn lại, xoá, phụ đề, nhạc.)`
    : 'Mình chưa hiểu lệnh này. AI máy chủ chưa bật nên tạm thời chỉ hiểu lệnh cơ bản, ví dụ: “đổi chữ giá sang màu vàng”, “phụ đề to hơn”, “cảnh này dài thêm 1 giây”, “xoá chữ này”.';
  return {reply, ops};
}

// ---------- Tóm tắt dự án gửi cho AI ----------
function compact(p) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const g = genreOf(p);
  return {
    genre: {key: p.genre || 'chung', label: g.label, style: g.ai, icons: g.icons, cta: g.cta},
    format: p.format || '9:16',
    duration: r2(duration(p)),
    words: timelineWords(p).map((w) => [w.w, r2(w.s), r2(w.e)]),
    sources: Object.values(p.sources).map((s) => ({id: s.id, kind: s.kind, name: s.name, duration: r2(s.duration)})),
    texts: p.texts.map((t) => ({id: t.id, start: r2(t.start), dur: r2(t.dur), lead: t.lead, main: t.main, sign: t.sign, color: t.color, font: t.font, style: t.style, size: t.size, y: r2(t.y), icon: t.icon, kind: t.kind, locked: !!t.locked})),
    broll: p.broll.map((b) => ({id: b.id, src: b.src, start: r2(b.start), dur: r2(b.dur), trans: b.trans, locked: !!b.locked})),
    zooms: p.zooms.map((z) => ({id: z.id, start: r2(z.start), dur: r2(z.dur), scale: z.scale})),
    subs: p.subs,
    cta: p.cta,
    music: p.music ? {vol: p.music.vol} : null,
  };
}

// ---------- Con trỏ diễn từng op ----------
export async function animateOps(ed, ops, {fastAfter = 99} = {}) {
  const {p, tl, cur} = ed;
  cur.show();
  let n = 0;
  for (const o of ops) {
    n++;
    cur.speed = n > fastAfter ? 3.5 : 1;
    const text = describeOp(p, o);
    try {
      await animateOne(ed, o, text);
    } catch (e) {
      applyOp(p, o);
    }
    ed.changed(false);
  }
  cur.say('');
  await cur.pause(250);
  cur.hide();
  cur.speed = 1;
}

async function animateOne(ed, o, text) {
  const {p, tl, cur} = ed;
  const go = async (T) => {
    ed.seek(Math.max(0, T - 0.6));
    await cur.pause(60);
  };
  if (o.op === 'cut') {
    const T = tlOfSrc(p, o.a) ?? 0;
    await go(T);
    const pt = tl.pointAt('main', T);
    await cur.moveTo(pt.x, pt.y, 420);
    cur.say('✂︎ ' + text);
    await cur.click();
    applyOp(p, o);
    return;
  }
  if (o.op === 'add') {
    const row = o.list === 'texts' ? 'texts' : o.list === 'zooms' ? 'zooms' : 'broll';
    const T = o.item.start;
    await go(T + 0.3);
    if (o.list === 'broll') {
      // kéo cảnh từ đầu làn vào đúng chỗ
      // lấy cảnh từ kho "chờ xếp" nếu đang hiện, không thì từ đầu làn Cảnh phụ
      const binEl = document.querySelector(`.bin-item[data-src="${o.item.src}"]`);
      const lab = (binEl && binEl.offsetParent ? binEl : document.querySelector(`.tl-label[data-row="broll"]`)).getBoundingClientRect();
      await cur.moveTo(lab.left + lab.width / 2, lab.top + lab.height / 2, 420);
      cur.say(text);
      const ghost = document.createElement('div');
      ghost.className = 'ai-ghost';
      const src = p.sources[o.item.src];
      if (src?.thumbs?.[0]) ghost.style.backgroundImage = `url(${src.thumbs[0]})`;
      ghost.textContent = src?.name || '';
      document.body.appendChild(ghost);
      const to = tl.pointAt('broll', T + 0.2);
      const x0 = cur.x;
      const y0 = cur.y;
      await cur.drag(to.x, to.y, 650, (k) => {
        ghost.style.transform = `translate(${x0 + (to.x - x0) * k - 8}px, ${y0 + (to.y - y0) * k - 22}px)`;
      });
      ghost.remove();
    } else {
      const pt = tl.pointAt(row, T + 0.2);
      await cur.moveTo(pt.x, pt.y, 450);
      cur.say(text);
      await cur.click();
    }
    applyOp(p, o);
    if (o.list === 'texts') {
      ed.changed(false);
      ed.seek(T + 0.9);
      await cur.pause(700);
    }
    return;
  }
  if (o.op === 'update' || o.op === 'remove') {
    const f = find(p, o.id);
    if (!f) return;
    const type = f.list === 'texts' ? 'text' : f.list === 'zooms' ? 'zoom' : 'broll';
    await go(f.item.start + 0.3);
    let el = tl.clipEl(type, o.id);
    if (el) {
      const r = el.getBoundingClientRect();
      await cur.moveTo(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2, 450);
      cur.say(text);
      await cur.click();
      if (o.op === 'update' && o.set.start !== undefined) {
        const to = tl.pointAt(f.list === 'texts' ? 'texts' : f.list, o.set.start + 0.2);
        const s0 = f.item.start;
        await cur.drag(to.x, cur.y, 600, (k) => {
          tl.updateClip(type, o.id, s0 + (o.set.start - s0) * k, f.item.dur);
        });
      }
    }
    applyOp(p, o);
    if (f.list === 'texts' && o.op === 'update') {
      ed.changed(false);
      ed.seek(f.item.start + 1);
      await cur.pause(600);
    }
    return;
  }
  // subs / cta / music / split
  const row = o.op === 'subs' ? 'subs' : o.op === 'music' ? 'music' : 'main';
  const lab = document.querySelector(`.tl-label[data-row="${row}"]`)?.getBoundingClientRect();
  if (lab) await cur.moveTo(lab.left + lab.width / 2, lab.top + lab.height / 2, 400);
  cur.say(text);
  await cur.click();
  applyOp(p, o);
}

// ---------- Chép lời bằng Whisper (máy chủ) ----------
// Chia âm thanh 16 kHz thành đoạn ~30 s, cắt tại chỗ nhỏ tiếng nhất (không chặt đôi chữ), gửi lần lượt, cộng bù thời gian.
const PROMPTS = {
  bds: 'Xin chào cả nhà, hôm nay mình giới thiệu căn nhà này. Diện tích, giá bán, pháp lý sổ hồng.',
  banhang: 'Xin chào mọi người, hôm nay mình giới thiệu sản phẩm này. Giá, ưu đãi, công dụng.',
  amthuc: 'Xin chào mọi người, hôm nay mình đi ăn thử món ngon này. Giá, địa chỉ quán.',
  kienthuc: 'Xin chào các bạn, hôm nay mình chia sẻ kiến thức hữu ích. Bước một, bước hai.',
  vlog: 'Xin chào mọi người, hôm nay mình đi chơi và kể cho các bạn nghe.',
  chung: 'Xin chào mọi người, hôm nay mình chia sẻ với các bạn.',
};
export async function transcribeAll(p, an, onProgress) {
  const SR = 16000;
  const pcm = an.pcm16;
  const total = pcm.length / SR;
  const lv = levels(an);
  const quietAt = (a, b) => {
    // giây có mức âm thấp nhất trong [a, b]
    let best = b;
    let bd = 999;
    for (let i = Math.floor(a / an.win); i < Math.min(lv.db.length, Math.ceil(b / an.win)); i++) if (lv.db[i] < bd) (bd = lv.db[i]), (best = i * an.win + an.win / 2);
    return best;
  };
  const cuts = [0];
  while (total - cuts[cuts.length - 1] > 40) {
    const t0 = cuts[cuts.length - 1];
    cuts.push(quietAt(t0 + 22, t0 + 34));
  }
  cuts.push(total);
  const words = [];
  let prompt = PROMPTS[p.genre] || PROMPTS.chung;
  for (let k = 0; k < cuts.length - 1; k++) {
    const a = cuts[k];
    const b = cuts[k + 1];
    onProgress?.(k / (cuts.length - 1));
    const part = pcm.subarray(Math.floor(a * SR), Math.floor(b * SR));
    let r = null;
    for (let tryN = 0; tryN < 3 && !r; tryN++) {
      try {
        r = await api('transcribe', wav16(part), true, '?prompt=' + encodeURIComponent(prompt));
      } catch (e) {
        if (tryN === 2 || /tắt/.test(e.message)) throw e;
        await new Promise((res) => setTimeout(res, /nhanh/.test(e.message) ? 15000 : 1500));
      }
    }
    for (const w of r.words || []) words.push({w: w.w, s: +(w.s + a).toFixed(3), e: +(w.e + a).toFixed(3)});
    // ngữ cảnh cho đoạn sau: ~20 chữ cuối
    const tail = (r.words || []).slice(-20).map((x) => x.w).join(' ');
    if (tail) prompt = tail;
  }
  onProgress?.(1);
  // bỏ chữ “bịa” rơi vào chỗ không có tiếng (mức âm cả chữ dưới ngưỡng thấp)
  return words.filter((w) => {
    const i0 = Math.max(0, Math.floor(w.s / an.win));
    const i1 = Math.min(lv.db.length, Math.max(i0 + 1, Math.ceil(w.e / an.win)));
    let mx = -999;
    for (let i = i0; i < i1; i++) mx = Math.max(mx, lv.db[i]);
    return mx >= lv.lo;
  });
}

// Video ồn (ngoài trời, nhạc nền): đo độ lớn khó tách lời → dùng lời chép tìm thêm khoảng nghỉ ≥ 0,9 s giữa 2 chữ,
// chỉ cắt khi chỗ đó nhỏ tiếng hơn lời nói rõ rệt (giữ 0,25 s sau chữ trước, 0,15 s trước chữ sau)
export function wordGapCuts(an, words, have) {
  const lv = levels(an);
  const out = [];
  const med = (a, b) => {
    const v = lv.db.slice(Math.floor(a / an.win), Math.ceil(b / an.win)).sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  };
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].e + 0.25;
    const b = words[i + 1].s - 0.15;
    if (words[i + 1].s - words[i].e < 0.9 || b - a < 0.35) continue;
    if (have.some((c) => a < c.b && b > c.a)) continue;
    if (med(a, b) > lv.noise + lv.range * 0.45) continue;
    out.push({a, b});
  }
  return out;
}

// ---------- AI dựng từ A–Z ----------
export async function autoEdit(ed, log) {
  const {p} = ed;
  const src = p.sources[p.main.src];
  const h = await aiHealth();

  // 1. nghe & tìm khoảng lặng
  log('nghe', 'run', 'Nghe video, tìm khoảng lặng & chỗ nói vấp');
  const blob = await ed.getBlob(src.fileKey);
  let an = null;
  try {
    an = await analyzeAudio(blob, (k) => log('nghe', 'run', `Nghe video… ${Math.round(k * 100)}%`));
  } catch (e) {
    log('nghe', 'warn', 'Không phân tích được âm thanh: ' + e.message);
  }
  // 2. chép lời trước khi cắt (để phụ đề + tìm thêm chỗ nghỉ ở video ồn)
  let words = null;
  if (p.transcript?.words?.length) {
    // Dựng lại: dùng lời đã chép (không tốn lượt chép lời)
    words = p.transcript.words;
    log('nghe2', 'ok', `Dùng lời đã chép (${words.length} chữ)`);
  } else if (h.stt && an) {
    log('nghe2', 'run', 'Chép lời để làm phụ đề');
    try {
      words = await transcribeAll(p, an, (k) => log('nghe2', 'run', `Chép lời… ${Math.round(k * 100)}%`));
      if (words.length) log('nghe2', 'ok', `Đã chép ${words.length} chữ`);
      else log('nghe2', 'warn', 'Không nghe rõ lời nói');
    } catch (e) {
      log('nghe2', 'warn', 'Chưa chép được lời: ' + e.message);
    }
  } else log('nghe2', 'skip', 'Phụ đề: máy chủ chép lời đang tắt');

  if (an) {
    src.peaks = an.peaks;
    let sil = findSilences(an);
    const extra = words?.length > 8 ? wordGapCuts(an, words, sil) : [];
    sil = [...sil, ...extra].sort((x, y) => x.a - y.a);
    const total = sil.reduce((a, s) => a + Math.min(s.b, src.duration) - s.a, 0);
    log('nghe', 'ok', `Tìm thấy ${sil.length} khoảng lặng (${total.toFixed(1).replace('.', ',')} giây)`);
    // 3. cắt — diễn từ cuối lên đầu để vị trí phía trước không xê dịch
    log('cat', 'run', 'Cắt khoảng lặng');
    const cuts = sil.map((s) => ({op: 'cut', a: s.a, b: Math.min(s.b, src.duration + 0.5)})).reverse();
    await animateOps(ed, cuts, {fastAfter: 5});
    log('cat', 'ok', `Đã cắt ${sil.length} chỗ · còn ${duration(p).toFixed(1).replace('.', ',')} giây`);
  } else log('cat', 'skip', 'Bỏ qua bước cắt');
  if (words?.length && words !== p.transcript?.words) {
    applyOp(p, {op: 'transcript', value: {words}});
    if (p.subs) p.subs.on = true;
    ed.changed(false);
  }

  // 4. lên kế hoạch dựng
  log('ke', 'run', 'Lên kịch bản dựng: cảnh phụ, chữ, hiệu ứng');
  let ops = null;
  if (h.ai) {
    try {
      const r = await api('ai', {mode: 'plan', template: p.template, genre: p.genre, project: compact(p)});
      ops = sanitizeOps(p, r.ops);
      log('ke', 'ok', r.note || `AI đề xuất ${ops.length} thao tác`);
    } catch (e) {
      log('ke', 'warn', 'AI máy chủ lỗi, dùng bộ dựng cơ bản: ' + e.message);
    }
  }
  if (!ops) {
    ops = localPlan(p);
    log('ke', 'ok', `Bộ dựng cơ bản: ${ops.length} thao tác`);
  }

  // 5. diễn từng thao tác
  log('dung', 'run', 'Ghép cảnh phụ, thêm chữ, đẩy máy');
  const order = {broll: 0, texts: 1, zooms: 2};
  ops.sort((a, b) => (order[a.list] ?? 3) - (order[b.list] ?? 3) || (a.item?.start || 0) - (b.item?.start || 0));
  await animateOps(ed, ops, {fastAfter: 8});
  log('dung', 'ok', 'Xong phần dựng');
  p.aiDone = true;
  ed.changed(true);
}

// ---------- Khách nhờ AI sửa (chat hoặc bấm vào clip) ----------
export async function askAi(ed, text, target) {
  const {p} = ed;
  const h = await aiHealth();
  let res = null;
  if (h.ai) {
    try {
      const r = await api('ai', {mode: 'edit', instruction: text, target: target || null, project: compact(p)});
      res = {reply: r.reply || 'Đã sửa.', ops: sanitizeOps(p, r.ops, target)};
    } catch (e) {
      res = null;
    }
  }
  if (!res) res = localCommand(p, text, target);
  if (res.ops.length) {
    ed.history.push(p);
    await animateOps(ed, res.ops);
    ed.changed(true);
  }
  return res;
}
