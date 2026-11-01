// AI dựng từ A–Z + sửa theo lời nói. Mọi thay đổi là "op" → con trỏ diễn lại trên timeline rồi mới áp vào dự án.
import {analyzeAudio, findSilences, levels, wav16, thumbs, CUT_PACE} from './media.js';
import {duration, tlOfSrc, timelineWords, segStarts, clamp, ICONS} from './render.js';
import {applyOp, describeOp, find, newText, uid, TYPE_OF} from './model.js';
import {genreOf, formatOf} from './templates.js';
import {SFX_MAP} from './sfx.js';
import {MOTIONS, stickerForPhrase} from './library.js';

// ---------- Gọi máy chủ ----------
let health = null;
export async function aiHealth() {
  if (health) return health;
  try {
    const r = await fetch('api/health', {cache: 'no-store'});
    health = r.ok ? await r.json() : {ai: false, stt: false, vision: false};
  } catch (e) {
    health = {ai: false, stt: false, vision: false};
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
const OPS = new Set(['cut', 'split', 'add', 'update', 'remove', 'subs', 'cta', 'music', 'look', 'segfx']);
const TEXT_KEYS = ['start', 'dur', 'lead', 'main', 'sign', 'font', 'color', 'style', 'size', 'x', 'y', 'icon', 'kind', 'motion'];
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
        out.push({op: 'add', list: 'zooms', item: {id: uid('z'), start: +o.item?.start || 0, dur: +o.item?.dur || 2.5, scale: Math.min(1.25, Math.max(1.02, +o.item?.scale || 1.08)), ...(['punch', 'push'].includes(o.item?.kind) ? {kind: o.item.kind} : {})}});
      } else if (o.list === 'stickers' && /^[a-z0-9-]{2,60}$/.test(o.item?.key || '')) {
        const it = o.item;
        out.push({op: 'add', list: 'stickers', item: {id: uid('s'), kind: it.kind === 'icon' ? 'icon' : 'emoji', key: it.key, label: String(it.label || '').slice(0, 30), start: +it.start || 0, dur: Math.min(6, +it.dur || 2.5), x: clamp(+it.x || 0.78, 0.1, 0.9), y: clamp(+it.y || 0.4, 0.1, 0.9), size: clamp(+it.size || 1, 0.4, 2.2), motion: MOTIONS.some(([k]) => k === it.motion) ? it.motion : 'pop', ...(it.kind === 'icon' ? {color: /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#2f8cff'} : {}), locked: false}});
      } else if (o.list === 'sfx' && SFX_MAP[o.item?.sfx]) {
        const d = SFX_MAP[o.item.sfx];
        out.push({op: 'add', list: 'sfx', item: {id: uid('a'), sfx: d.key, name: d.name, start: Math.max(0, +o.item.start || 0), dur: d.len, vol: clamp(+o.item.vol || 0.5, 0.05, 1.2), locked: false}});
      }
      continue;
    }
    if (o.op === 'update' || o.op === 'remove') {
      const f = find(p, o.id);
      if (!f) continue;
      // Chỗ khách đã sửa tay (khoá) thì AI không đụng, trừ khi khách đang nhờ sửa đúng chỗ đó
      if (f.item.locked && o.id !== target) continue;
      if (o.op === 'update') {
        const keys = f.list === 'texts' ? TEXT_KEYS : f.list === 'broll' ? BROLL_KEYS : f.list === 'stickers' ? ['start', 'dur', 'x', 'y', 'size', 'motion', 'color'] : f.list === 'sfx' ? ['start', 'vol'] : ['start', 'dur', 'scale'];
        const set = {};
        for (const k of keys) if (o.set?.[k] !== undefined) set[k] = o.set[k];
        if (Object.keys(set).length) out.push({op: 'update', id: o.id, set});
      } else out.push(o);
      continue;
    }
    if (o.op === 'cut' && isFinite(o.a) && isFinite(o.b) && o.b > o.a) out.push({op: 'cut', a: +o.a, b: +o.b});
    else if (o.op === 'split' && isFinite(o.T)) out.push(o);
    else if (['subs', 'cta', 'music', 'look'].includes(o.op)) out.push(o);
    else if (o.op === 'segfx' && Number.isInteger(o.i) && p.main?.segs[o.i] && ['none', 'zoomin', 'whip', 'flash', 'shake', 'glitch'].includes(o.tr)) out.push({op: 'segfx', i: o.i, tr: o.tr});
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
// “3.800” (dấu chấm ngăn nghìn) → 3800; “3,8” → 3.8
const viNum = (s) => (/^\d{1,3}(\.\d{3})+$/.test(s) ? +s.replace(/\./g, '') : +s.replace(',', '.'));
const viFmt = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
// giá: ≥ 1000 triệu → tỷ; ≥ 1000 nghìn → triệu
function priceText(num, unit) {
  const v = viNum(num);
  if (unit === 'TRIỆU' && v >= 1000) return `${viFmt(v / 1000)} TỶ`;
  if (unit === 'K' && v >= 1000) return `${viFmt(v / 1000)} TRIỆU`;
  return unit === 'K' || unit === 'Đ' ? `${num}${unit}` : `${num} ${unit}`;
}
// Mật độ chữ điểm nhấn (khách chọn ở bảng Video): numGap = cách nhau tối thiểu giữa 2 cụm chữ số liệu,
// every = 1 cụm chữ ý chính (không phải số) mỗi bao nhiêu giây video (0 = không thêm), gap = khoảng cách tối thiểu giữa mọi cụm chữ
export const TEXT_DENSITY = {
  it: {label: 'Ít', numGap: 4, every: 0, gap: 4},
  vua: {label: 'Vừa', numGap: 2.2, every: 9, gap: 3},
  nhieu: {label: 'Nhiều', numGap: 2.2, every: 4.5, gap: 2.2},
};
export const densityOf = (p) => TEXT_DENSITY[p.textDensity] || TEXT_DENSITY.vua;
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
    const mm = w.replace('m²', 'm2').match(/^(\d+(?:[.,]\d+)*)(k|tr|%|m2|m)?$/);
    if (!mm) continue;
    const num = mm[1];
    const next = plain(ws[i + 1]?.w || '').replace(/[.,!?]$/, '');
    const prev = plain((ws[i - 2]?.w || '') + ' ' + (ws[i - 1]?.w || ''));
    const at = ws[i].s;
    const unit = mm[2] === '%' ? UNITS[5] : mm[2] === 'k' ? UNITS[2] : mm[2] === 'tr' ? UNITS[1] : mm[2] === 'm2' || mm[2] === 'm' ? UNITS[6] : UNITS.find(([re]) => re.test(next));
    if (unit && unit[2] === 'price') {
      const lead = /chi con/.test(prev) ? 'chỉ còn' : /giam|sale|khuyen/.test(prev) ? 'giảm còn' : g === 'bds' || g === 'banhang' ? 'giá' : '';
      out.push(newText(at, {kind: 'price', lead, main: priceText(num, unit[1]), color: '#ff2a2a', icon: icons.includes('tag') ? 'tag' : icons[0], dur: 4}));
    } else if (unit && unit[2] === 'pct') {
      out.push(newText(at, {lead: /giam|sale/.test(prev) ? 'giảm' : '', main: `${num.replace('%', '')}%`, color: '#ffc61a', icon: icons.includes('fire') ? 'fire' : icons[0], dur: 3.5}));
    } else if (unit && unit[2] === 'area' && next === 'met' && plain(ws[i + 2]?.w || '').replace(/[.,!?]$/, '') !== 'vuong') {
      // “mặt tiền 5 mét”, “ngang 4 mét” là CHIỀU DÀI, không phải diện tích
      const lead = /mat tien/.test(prev) ? 'mặt tiền' : /ngang/.test(prev) ? 'ngang' : /dai/.test(prev) ? 'dài' : /rong/.test(prev) ? 'rộng' : /hem|duong/.test(prev) ? 'đường' : '';
      out.push(newText(at, {lead, main: `${num} MÉT`, color: '#ffc61a', icon: icons.includes('ruler') ? 'ruler' : icons[0], dur: 3.2}));
    } else if (unit && unit[2] === 'area') {
      out.push(newText(at, {lead: 'diện tích', main: `${num} M²`, color: '#ffc61a', icon: icons.includes('ruler') ? 'ruler' : icons[0], dur: 3.5}));
    } else if (g === 'bds' && /^(phong|tang|lau|tret)$/.test(next)) {
      // nhà đất: “3 phòng ngủ”, “4 tầng”, “1 trệt 2 lầu”
      const W1 = (k) => (ws[i + k]?.w || '').replace(/[.,!?]$/, '');
      let main = `${num} ${W1(1)}`;
      if (next === 'phong' && /^(ngu|tam|khach|wc)$/.test(plain(W1(2)))) main += ' ' + W1(2);
      if (next === 'tret' && /^\d+$/.test(W1(2)) && /^(lau|tang)$/.test(plain(W1(3)))) main += ` ${W1(2)} ${W1(3)}`;
      out.push(newText(at, {main: main.toUpperCase(), color: PALETTE[ci % PALETTE.length], icon: next === 'phong' ? 'bed' : 'house', dur: 3.2}));
      ci++;
    } else if (NOUNS.test(next) && g !== 'bds') {
      // “3 bước”, “5 mẹo”, “2 tầng”… → cụm chữ màu xoay vòng, icon theo thể loại
      out.push(newText(at, {main: `${num} ${ws[i + 1].w.replace(/[.,!?]$/, '')}`.toUpperCase(), color: PALETTE[ci % PALETTE.length], icon: icons[ci % icons.length], dur: 3.2}));
      ci++;
    } else if (g === 'bds' && /^x$/.test(next)) {
      out.push(newText(at, {lead: 'diện tích', main: `${num} X ${ws[i + 2]?.w || ''}`.toUpperCase(), color: '#ffc61a', icon: 'ruler', dur: 3.5}));
    }
  }
  // không chồng nhau: cụm sau cách cụm trước ≥ 2,2 s (Ít: 4 s); cụm trước tự rút ngắn để nhường chỗ
  const keep = [];
  const numGap = densityOf(p).numGap;
  for (const t of out) {
    const last = keep[keep.length - 1];
    if (last && t.start - last.start < numGap) {
      // giá quan trọng hơn: thay cụm trước nếu cụm trước không phải giá
      if (t.kind === 'price' && last.kind !== 'price') keep[keep.length - 1] = t;
      continue;
    }
    if (last && last.start + last.dur > t.start - 0.15) last.dur = Math.max(2, t.start - 0.15 - last.start);
    keep.push(t);
  }
  return keep;
}

// ---------- Chữ ý chính (không phải số): AI chọn từ lời nói, máy kiểm lại ----------
// Cụm lời trên timeline (đã cắt) để gửi AI: [[giây, câu], …]
export function timelinePhrases(p) {
  const ws = timelineWords(p);
  const out = [];
  let cur = null;
  ws.forEach((w, i) => {
    const prev = ws[i - 1];
    if (!prev || /[.!?…]$/.test(prev.w) || w.s - prev.e > 0.6 || cur.n >= 18 || (cur.n >= 7 && /[,;:]$/.test(prev.w))) out.push((cur = {s: w.s, n: 0, t: []}));
    cur.t.push(w.w);
    cur.n++;
  });
  return out.map((x) => [+x.s.toFixed(1), x.t.join(' ')]);
}
const tok = (s) => plain(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
// Tìm cụm chữ trong lời (đúng thứ tự, liền nhau) gần mốc giây `near` → [vị trí chữ đầu, số chữ] trong mảng words
function findRun(ws, toks, near, win) {
  let best = null;
  for (let i = 0; i < ws.length; i++) {
    if (Math.abs(ws[i].s - near) > win) continue;
    let ok = true;
    for (let k = 0; k < toks.length; k++) if (tok(ws[i + k]?.w || '').join(' ') !== toks[k]) { ok = false; break; }
    if (ok && (!best || Math.abs(ws[i].s - near) < Math.abs(ws[best].s - near))) best = i;
  }
  return best;
}
const KEY_COLORS = ['#ffffff', '#ffc61a', '#2ad46a', '#2fd2ff', '#ff5fb8'];
// items AI trả về {start, lead, main} → cụm chữ (lấy lại đúng chữ có dấu từ lời chép, bỏ cụm có số / không có trong lời)
export function keyLockups(p, items) {
  const ws = timelineWords(p);
  const D = duration(p);
  const ctaLen = p.cta?.len || 4;
  const out = [];
  for (const it of items || []) {
    const mt = tok(it.main).slice(0, 5);
    if (!mt.length || mt.some((t) => /\d/.test(t))) continue;
    const i = findRun(ws, mt, +it.start || 0, 8);
    if (i === null) continue;
    const at = ws[i].s;
    if (at < 1.2 || at > D - ctaLen - 1.5) continue;
    const main = ws.slice(i, i + mt.length).map((w) => w.w.replace(/[.,!?…:;"“”]/g, '')).join(' ').toUpperCase();
    if (main.length < 2 || main.length > 22) continue;
    // chữ dẫn nhỏ: chỉ giữ khi đúng là mấy chữ ngay trước cụm chính trong lời
    let lead = '';
    const lt = tok(it.lead).slice(0, 3);
    if (lt.length && i >= lt.length && tok(ws.slice(i - lt.length, i).map((w) => w.w).join(' ')).join(' ') === lt.join(' ')) lead = ws.slice(i - lt.length, i).map((w) => w.w.replace(/[.,!?…:;"“”]/g, '')).join(' ').toLowerCase();
    const endW = ws[i + mt.length - 1];
    if (out.some((t) => t.main === main)) continue;
    out.push(newText(+at.toFixed(2), {kind: 'key', lead, main, color: KEY_COLORS[out.length % KEY_COLORS.length], icon: '', dur: +clamp(endW.e - at + 1.6, 2, 3.2).toFixed(2)}));
  }
  return out; // giữ thứ tự ưu tiên của nguồn (mergeLockups lấy từ đầu danh sách)
}
// Không có AI: chọn cụm ý chính theo danh sách từ hay gặp trong video bán hàng / nhà đất / ẩm thực / kiến thức
const KEY_PHRASES = {
  chung: ['mien phi', 'bi mat', 'bi quyet', 'sai lam', 'quan trong', 'luu y', 'dac biet', 'tuyet voi', 'cuc ky', 'nhat dinh'],
  bds: ['so hong rieng', 'chinh chu', 'ban gap', 'cat lo', 'hem xe hoi', 'full noi that', 'so hong', 'so do', 'ho boi', 'sinh loi', 'dong tien', 'ngan hang ho tro', 'vay ngan hang', 'trung tam', 'gan cho', 'noi that', 'view', 'phap ly', 'mat tien'],
  banhang: ['chinh hang', 'bao hanh', 'freeship', 'mien phi giao hang', 'giao hang', 'doi tra', 'khuyen mai', 'giam gia', 'qua tang', 'so luong co han', 'ban chay', 'doc quyen', 'chat luong'],
  amthuc: ['ngon', 'gion', 'dam da', 'thom', 'beo', 'tuoi', 'nong hoi', 'gia truyen', 'dac san', 'bi quyet', 'nuoc dung', 'nuoc cham'],
  kienthuc: ['bi quyet', 'luu y', 'sai lam', 'quan trong', 'meo', 'cach', 'nguyen nhan', 'giai phap', 'ket qua', 'thuc te'],
  vlog: ['tuyet voi', 'dep qua', 'bat ngo', 'lan dau', 'trai nghiem', 'dang thu', 'cuc ky'],
};
export function localKeys(p) {
  const ws = timelineWords(p);
  // thứ tự trong danh sách = độ quan trọng (cụm của thể loại trước, cụm chung sau)
  const pri = [...(KEY_PHRASES[p.genre] || []), ...KEY_PHRASES.chung].map((x, rank) => ({t: x.split(' '), rank}));
  const list = [...pri].sort((a, b) => b.t.length - a.t.length);
  const items = [];
  const used = new Set();
  for (let i = 0; i < ws.length; i++) {
    for (const {t: ph, rank} of list) {
      if (ph.some((t, k) => tok(ws[i + k]?.w || '').join(' ') !== t)) continue;
      const key = ph.join(' ');
      if (used.has(key)) break;
      used.add(key);
      items.push({start: ws[i].s, lead: '', main: ws.slice(i, i + ph.length).map((w) => w.w).join(' '), rank});
      i += ph.length - 1;
      break;
    }
  }
  return keyLockups(p, items.sort((a, b) => a.rank - b.rank));
}
// Gộp chữ số liệu + chữ ý chính theo mật độ: số liệu ưu tiên (giá > số khác > ý chính), cách nhau ≥ gap, tối đa D/every cụm ý chính
export function mergeLockups(p, nums, keys) {
  const den = densityOf(p);
  const D = duration(p);
  const maxKeys = den.every ? Math.max(1, Math.round(D / den.every)) : 0;
  const all = [...nums];
  let nk = 0;
  for (const k of keys) {
    if (nk >= maxKeys) break;
    if (all.some((t) => Math.abs(t.start - k.start) < den.gap)) continue;
    all.push(k);
    nk++;
  }
  all.sort((a, b) => a.start - b.start);
  for (let i = 0; i < all.length - 1; i++) if (all[i].start + all[i].dur > all[i + 1].start - 0.15) all[i].dur = +Math.max(1.5, all[i + 1].start - 0.15 - all[i].start).toFixed(2);
  return all;
}

// ---------- Bộ dựng chuyên nghiệp (chạy trên máy, không cần AI máy chủ) ----------
// Quy tắc dân dựng video ngắn:
//  • 2–3 giây đầu giữ mặt người nói (hook, zoom chặt), cuối video giữ người nói cho câu kêu gọi
//  • đổi hình mỗi 2,5–4 giây (nhịp theo thể loại: templates.js `edit`)
//  • cảnh phụ vào ĐÚNG ĐẦU CỤM LỜI, ưu tiên phủ lên chỗ cắt để che vết cắt; cảnh khớp lời (tên file/nhãn) đặt đúng lúc nhắc tới
//  • dùng HẾT cảnh khách đưa; cảnh dài cắt thành nhiều cú khác nhau; bỏ 0,3 s đầu/cuối mỗi cảnh (hay rung)
//  • chuyển cảnh: đầu câu dùng kiểu nhấn của thể loại, giữa câu cắt thẳng / mờ nhẹ
//  • chỗ cắt lộ trên mặt người nói → zoom giật xen kẽ chặt/rộng; đoạn nói dài không cắt → đẩy máy chậm
const NAME_JUNK = new Set(['img', 'mov', 'mp4', 'vid', 'video', 'clip', 'canh', 'broll', 'pxl', 'dsc', 'copy', 'final', 'edit']);
// từ quá chung — nói gì cũng có, không dùng để khớp cảnh
const GENERIC = new Set(['nha', 'can', 'cai', 'day', 'nay', 'dep', 'rong', 'lon', 'nho', 'moi', 'tot', 'rat', 'qua', 'lam', 'con', 'mot', 'hai', 'cua', 'cho', 'nguoi', 'minh', 'ban']);
// Từ khoá của 1 cảnh phụ: nhãn (khách gắn hoặc AI nhìn), từ khoá AI, tên file (cả cụm + cụm 2 chữ liền)
export function brollKeys(src) {
  const ks = [];
  const add = (x, w) => {
    const k = plain(x).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (k.length < 2 || NAME_JUNK.has(k) || /^\d+$/.test(k) || ks.some((o) => o.k === k)) return;
    if (!k.includes(' ') && (k.length < 3 || GENERIC.has(k))) return;
    ks.push({k, w});
  };
  if (src.tag) add(src.tag, src.tagBy === 'user' ? 3 : 2);
  (src.keywords || []).forEach((x) => add(x, 1));
  const nm = plain(src.name || '').replace(/\.[a-z0-9]{2,4}$/, '').split(/[^a-z0-9]+/).filter((t) => t && !NAME_JUNK.has(t) && !/^\d+$/.test(t));
  if (nm.length) add(nm.join(' '), 2);
  for (let i = 0; i < nm.length - 1; i++) add(nm[i] + ' ' + nm[i + 1], 1);
  return ks;
}
export const brollTokens = (src) => brollKeys(src).map((x) => x.k);

export function localPlan(p, {keys = null} = {}) {
  const D = duration(p);
  const ops = [];
  if (D < 1) return ops;
  const st = genreOf(p).edit || {pace: 3.2, cover: 0.4, base: 'none', accent: 'fade', punch: 1.1};
  const words = timelineWords(p);
  const cuts = segStarts(p).slice(1).filter((c) => c > 0.2 && c < D - 0.2);
  const ctaLen = p.cta?.len || 4;

  // cụm lời: tách ở dấu câu, chỗ ngừng > 0,3 s hoặc 9 chữ
  const phrases = [];
  let cur = null;
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const brk = !prev || /[.,!?…:;]$/.test(prev.w) || w.s - prev.e > 0.3 || cur.n >= 9;
    if (brk) {
      cur = {s: w.s, e: w.e, n: 0, text: ' ', sent: !prev || /[.!?…]$/.test(prev.w) || w.s - prev.e > 0.6};
      phrases.push(cur);
    }
    cur.e = w.e;
    cur.n++;
    cur.text += plain(w.w).replace(/[.,!?…:;]/g, '') + ' ';
  });
  const anchors = phrases.length ? phrases.map((x) => x.s) : [0, ...cuts];
  const stops = phrases.length ? [...phrases.map((x) => x.e), ...phrases.map((x) => x.s)] : [...cuts, D];
  const sentAt = (t, i = 0) => {
    const ph = phrases.find((x) => Math.abs(x.s - t) < 0.06);
    return ph ? ph.sent : phrases.length ? false : i % 2 === 0;
  };

  // vùng: hook | thân (có cảnh phụ) | đuôi (câu kêu gọi)
  let b0 = clamp(D * 0.12, 2, 3.2);
  const second = anchors.find((a) => a >= b0 - 0.6 && a <= 3.6);
  if (second !== undefined) b0 = Math.max(1.6, second);
  const b1 = D - ctaLen - 0.4;
  const Ls = clamp(st.pace * 0.9, 2.2, 3.4);
  const Lmin = 1.8;
  const Lmax = 4;
  const gapMin = 1.2;

  const clips = Object.values(p.sources)
    .filter((x) => x.kind === 'broll' && x.duration > 0.8)
    .map((x) => {
      const usable = Math.max(0.5, x.duration - 0.6);
      return {x, keys: brollKeys(x), used: 0, nWin: Math.max(1, Math.floor((usable + 0.2) / (Ls + 0.2)))};
    });
  const score = (c, ph) => c.keys.reduce((a, {k, w}) => a + (ph.text.includes(' ' + k + ' ') ? w : 0), 0);
  const slots = [];
  // cú cảnh phụ nối liền nhau được (chuỗi cảnh) nhưng tối đa 2 cú / 6,5 s rồi phải về người nói
  const fits = (s, e, touch = false) => {
    if (e - s < 1.2 || s < b0 - 0.01 || e > b1 + 0.01) return false;
    const near = (x, y) => Math.abs(x - y) < 0.05;
    if (!slots.every((o) => e + gapMin <= o.s || s >= o.e + gapMin || (touch && (near(e, o.s) || near(s, o.e))))) return false;
    const chain = slots.filter((o) => near(o.e, s) || near(o.s, e));
    if (!chain.length) return true;
    const run = chain.reduce((a, o) => a + o.e - o.s, e - s);
    const linked = chain.some((o) => slots.some((q) => q !== o && (near(q.e, o.s) || near(q.s, o.e))));
    return run <= 6.5 && !linked && chain.length < 2;
  };
  // mép cảnh phụ trùng chỗ cắt (lệch ≤ 0,25 s) thì đặt đúng chỗ cắt → không lộ 2 khung người nói
  const snapCut = (t) => {
    const q = cuts.find((c) => Math.abs(c - t) <= 0.25);
    return q === undefined ? t : q;
  };
  const endFor = (s, lim, c) => {
    const want = s + Ls;
    const cand = stops.filter((t) => t >= s + Lmin && t <= Math.min(s + Lmax, lim));
    let e = cand.length ? cand.reduce((a, t) => (Math.abs(t - want) < Math.abs(a - want) ? t : a)) : Math.min(want, lim);
    if (c) e = Math.min(e, s + c.x.duration - 0.05);
    return e;
  };

  if (b1 - b0 >= 2.5 && clips.length) {
    // A. cảnh khớp lời nói: vào đúng đầu cụm có nhắc tới; 2 cảnh được nhắc liền nhau → nối thành chuỗi
    const ment = clips
      .map((c) => {
        let ph = null;
        let best = 0;
        for (const x of phrases) {
          if (x.s < b0 - 0.3 || x.s >= b1 - 1.2) continue;
          const sc = score(c, x);
          if (sc > best) (best = sc), (ph = x);
        }
        return {c, ph};
      })
      .filter((m) => m.ph)
      .sort((u, v) => u.ph.s - v.ph.s);
    for (const {c, ph} of ment) {
      const s0 = snapCut(Math.max(b0, ph.s));
      const e0 = snapCut(endFor(s0, b1, c));
      const prev = slots.find((o) => o.s < s0 && o.e > s0 - gapMin);
      if (prev && s0 - prev.s >= 1.4) prev.e = Math.min(prev.e, s0);
      if (prev && prev.e > s0) continue;
      if (fits(s0, e0, !!prev && Math.abs(prev.e - s0) < 0.05)) slots.push({s: s0, e: e0, c, k: c.used++});
    }
    // B. còn lại: rải vào khoảng trống lớn nhất, bám đầu cụm, ưu tiên phủ chỗ cắt
    const target = Math.max(clips.length, Math.round(((b1 - b0) * st.cover) / Ls));
    const queue = clips.filter((c) => !c.used);
    for (let r = 1; queue.length + slots.length < target && r < 4; r++) {
      clips.filter((c) => c.nWin > r && c.used <= r).forEach((c) => queue.length + slots.length < target && queue.push(c));
    }
    for (const c of queue) {
      const occ = slots.map((o) => [o.s - gapMin, o.e + gapMin]).sort((u, v) => u[0] - v[0]);
      const free = [];
      let x0 = b0;
      for (const [u, v] of occ) {
        if (u > x0) free.push([x0, u]);
        x0 = Math.max(x0, v);
      }
      if (b1 > x0) free.push([x0, b1]);
      const iv = free.sort((u, v) => v[1] - v[0] - (u[1] - u[0]))[0];
      if (!iv || iv[1] - iv[0] < Lmin) break;
      const ideal = (iv[0] + iv[1]) / 2 - Ls / 2;
      let best = null;
      for (const a of anchors.filter((t) => t >= iv[0] - 0.01 && t <= iv[1] - Lmin)) {
        const e = endFor(a, iv[1], c);
        if (e - a < 1.2) continue;
        const covers = cuts.some((q) => q > a + 0.3 && q < e - 0.3);
        const sc = -Math.abs(a - ideal) + (covers ? 0.8 : 0);
        if (!best || sc > best.sc) best = {s: a, e, sc};
      }
      if (!best) {
        const s1 = clamp(ideal, iv[0], iv[1] - Lmin);
        best = {s: s1, e: Math.min(s1 + Ls, iv[1], s1 + c.x.duration - 0.05)};
      }
      best.s = snapCut(best.s);
      best.e = snapCut(best.e);
      if (!fits(best.s, best.e)) continue;
      slots.push({s: best.s, e: best.e, c, k: c.used++});
    }
  }
  slots.sort((u, v) => u.s - v.s);
  let prevSrc = null;
  slots.forEach((o, i) => {
    const dur = +(o.e - o.s).toFixed(2);
    const d = o.c.x.duration;
    const span = Math.max(0, d - 0.6 - dur);
    const inn = d <= dur + 0.6 ? Math.max(0, (d - dur) / 2) : 0.3 + (o.c.nWin > 1 ? (span * (o.k % o.c.nWin)) / (o.c.nWin - 1) : span / 2);
    let trans = i === 0 || sentAt(o.s, i) || prevSrc === o.c.x.id ? st.accent : st.base;
    // 2 lần nhấn liền nhau thì đổi kiểu cho đỡ lặp
    const ALT = {whip: 'zoom', zoom: 'slide', slide: 'zoom', wipe: 'zoomout', fade: 'zoom'};
    if (trans === st.accent && ops.length && ops[ops.length - 1].item?.trans === st.accent && ops[ops.length - 1].list === 'broll') trans = ALT[st.accent] || st.accent;
    prevSrc = o.c.x.id;
    ops.push({op: 'add', list: 'broll', item: {id: uid('b'), src: o.c.x.id, start: +o.s.toFixed(2), dur, in: +Math.min(inn, Math.max(0, d - dur)).toFixed(2), trans, locked: false}});
  });

  // chữ số liệu + chữ ý chính từ lời nói (mật độ theo khách chọn: Ít / Vừa / Nhiều)
  const KEY_MOTIONS = ['spread', 'rise', 'pop', 'type'];
  let nKey = 0;
  mergeLockups(p, numberLockups(p), keys || localKeys(p)).forEach((t, i) => {
    // chuyển động theo ý: giá → đóng dấu, diện tích/chiều dài → phóng ra, “3 bước/5 mẹo” → trượt vào, chữ ý chính → giãn/nhô/gõ, còn lại xen kẽ bật/nảy
    if (t.kind === 'key') {
      t.motion = KEY_MOTIONS[nKey % KEY_MOTIONS.length];
      t.style = nKey % 3 === 2 ? 'box' : '3d';
      nKey++;
    } else t.motion = t.kind === 'price' ? 'stamp' : /M²|MÉT/.test(t.main) ? 'zoom' : /BƯỚC|MẸO|CÁCH|LÝ DO|ĐIỀU/.test(t.main) ? 'slide' : i % 2 ? 'bounce' : 'pop';
    ops.push({op: 'add', list: 'texts', item: t});
  });

  // zoom trên mặt người nói: giật xen kẽ chặt/rộng ở mỗi chỗ cắt lộ ra; hook bắt đầu chặt
  const speak = [];
  let x0 = 0;
  for (const o of slots) {
    if (o.s > x0) speak.push([x0, o.s, true]);
    x0 = o.e;
  }
  if (D > x0) speak.push([x0, D, false]);
  let tight = true;
  const maxStill = st.pace * 1.25;
  speak.forEach(([a, z]) => {
    const pts = [a, ...cuts.filter((c) => c > a + 0.5 && c < z - 0.5), z];
    for (let j = 0; j < pts.length - 1; j++) {
      if (pts[j + 1] - pts[j] <= maxStill) continue;
      const mid = (pts[j] + pts[j + 1]) / 2;
      const cand = anchors.filter((t) => t > pts[j] + 1.2 && t < pts[j + 1] - 1.2);
      const at = cand.length ? cand.reduce((u, t) => (Math.abs(t - mid) < Math.abs(u - mid) ? t : u)) : pts[j + 1] - pts[j] > maxStill * 1.2 ? mid : null;
      if (at !== null) pts.splice(j + 1, 0, at), j--;
    }
    for (let j = 0; j < pts.length - 1; j++) {
      const s = pts[j];
      const e = pts[j + 1];
      if (tight && e - s >= 0.5) ops.push({op: 'add', list: 'zooms', item: {id: uid('z'), start: +s.toFixed(2), dur: +(e - s).toFixed(2), scale: st.punch, kind: 'punch'}});
      else if (!tight && e - s >= 3.5 && (j === pts.length - 2)) ops.push({op: 'add', list: 'zooms', item: {id: uid('z'), start: +s.toFixed(2), dur: +(e - s).toFixed(2), scale: 1.05, kind: 'push'}});
      tight = !tight;
    }
  });

  // chuyển cảnh ngay chỗ cắt trên video chính (chỗ cắt không bị cảnh phụ che): ở đầu câu, cách nhau ≥ 5 s
  const jumpOps = [];
  const starts = segStarts(p);
  const jl = st.jump || ['zoomin'];
  let lastJ = 1.5;
  for (let i = 1; i < starts.length; i++) {
    const c = starts[i];
    if (c - lastJ < 5 || c > D - ctaLen - 0.3) continue;
    if (slots.some((o) => c > o.s - 0.1 && c < o.e + 0.1)) continue;
    if (phrases.length && !sentAt(c) && !phrases.some((x) => Math.abs(x.s - c) < 0.35 && x.sent)) continue;
    const tr = jl[jumpOps.length % jl.length];
    jumpOps.push({op: 'segfx', i, tr, at: c});
    lastJ = c;
  }
  ops.push(...jumpOps);

  // hình minh hoạ đúng lời nói (vd “giá” → túi tiền, “ngon” → mặt thưởng thức): tối đa 1 hình / 4,5 s, né cụm chữ
  const lks = ops.filter((o) => o.list === 'texts').map((o) => o.item);
  const stks = [];
  let lastKey = '';
  let lastT = -9;
  let side = 0;
  for (const ph of phrases) {
    if (ph.s < 0.6 || ph.s > D - ctaLen - 0.8 || ph.s - lastT < 4.5) continue;
    const m = stickerForPhrase(ph.text);
    if (!m || m.key === lastKey) continue;
    const first = m.w.split(' ')[0];
    const w = words.find((x) => x.s >= ph.s - 0.01 && x.s <= ph.e + 0.01 && plain(x.w).replace(/[^a-z0-9]/g, '') === first);
    const at = w ? w.s : ph.s;
    const busyText = lks.some((t) => at < t.start + t.dur && at + 2.4 > t.start);
    const label = w ? words.slice(words.indexOf(w), words.indexOf(w) + m.w.split(' ').length).map((x) => x.w.replace(/[.,!?…:;]$/, '')).join(' ').toLowerCase() : m.w;
    const it = {id: uid('s'), kind: 'emoji', key: m.key, label, start: +at.toFixed(2), dur: +clamp(ph.e - at + 0.9, 1.8, 3).toFixed(2), x: side++ % 2 ? 0.2 : 0.8, y: busyText ? 0.52 : 0.42, size: 0.9, motion: ['bounce', 'pop', 'wiggle', 'float'][stks.length % 4], locked: false};
    stks.push(it);
    ops.push({op: 'add', list: 'stickers', item: it});
    lastKey = m.key;
    lastT = at;
  }

  // hiệu ứng âm thanh: vút khi chuyển cảnh nhấn, “ka-ching” khi hiện giá, bụp khi hiện số, bong bóng khi hiện hình, thông báo ở câu kết
  const sfxAt = [];
  const sfx = (key, t, vol) => {
    if (t < 0 || t > D - 0.1 || sfxAt.some((x) => Math.abs(x - t) < 0.35)) return;
    sfxAt.push(t);
    ops.push({op: 'add', list: 'sfx', item: {id: uid('a'), sfx: key, name: SFX_MAP[key].name, start: +t.toFixed(2), dur: SFX_MAP[key].len, vol, locked: false}});
  };
  const TR_SFX = {zoom: 'whoosh', zoomout: 'whoosh', spin: 'whoosh', circle: 'whoosh', slide: 'swoosh', up: 'swoosh', wipe: 'swoosh', whip: 'whip', flash: 'impact', glitch: 'glitch'};
  for (const o of ops.filter((x) => x.list === 'broll')) {
    const k = TR_SFX[o.item.trans];
    if (k) sfx(k, Math.max(0, o.item.start - (k === 'whoosh' ? 0.3 : k === 'swoosh' ? 0.12 : 0.05)), k === 'impact' ? 0.3 : 0.4);
  }
  for (const t of lks) sfx(t.kind === 'price' ? 'cash' : 'pop', t.start + (t.kind === 'price' ? 0.05 : 0.1), t.kind === 'price' ? 0.45 : 0.4);
  for (const s of stks) sfx('bubble', s.start, 0.3);
  const JUMP_SFX = {zoomin: ['whoosh', 0.28], whip: ['whip', 0.06], flash: ['shutter', 0.02], shake: ['thud', 0], glitch: ['glitch', 0]};
  for (const j of jumpOps) {
    const [k, lead] = JUMP_SFX[j.tr] || [];
    if (k) sfx(k, Math.max(0, j.at - lead), 0.35);
  }
  sfx('notify', Math.max(0, D - ctaLen + 0.1), 0.45);

  // màu video nhẹ theo thể loại (khách đã tự chỉnh màu thì giữ nguyên)
  const look = genreOf(p).look;
  if (look && p.look?.by !== 'user') ops.push({op: 'look', set: {filter: 'none', amt: 0.6, vignette: 0, grain: 0, leak: 0, bars: false, ...look, by: 'ai'}});
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
    sources: Object.values(p.sources).map((s) => ({id: s.id, kind: s.kind, name: s.name, duration: r2(s.duration), ...(s.tag ? {tag: s.tag, keywords: s.keywords || []} : {})})),
    texts: p.texts.map((t) => ({id: t.id, start: r2(t.start), dur: r2(t.dur), lead: t.lead, main: t.main, sign: t.sign, color: t.color, font: t.font, style: t.style, size: t.size, y: r2(t.y), icon: t.icon, kind: t.kind, locked: !!t.locked})),
    broll: p.broll.map((b) => ({id: b.id, src: b.src, start: r2(b.start), dur: r2(b.dur), trans: b.trans, locked: !!b.locked})),
    zooms: p.zooms.map((z) => ({id: z.id, start: r2(z.start), dur: r2(z.dur), scale: z.scale, kind: z.kind})),
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
    cur.speed = n > fastAfter ? 2 : 1;
    const text = describeOp(p, o) + (ops.length > 1 ? ` · ${n}/${ops.length}` : '');
    try {
      await animateOne(ed, o, text);
    } catch (e) {
      applyOp(p, o);
    }
    ed.changed(false);
    // nháy sáng clip vừa thêm/sửa để mắt khách theo kịp
    const id = o.item?.id || o.id;
    const type = TYPE_OF[o.list || find(p, id)?.list] || 'broll';
    if (id) tl.clipEl(type, id)?.classList.add('flash');
    await cur.pause(180);
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
  if (o.op === 'segfx') {
    const T = segStarts(p)[o.i] ?? 0;
    await go(T + 0.2);
    const pt = tl.pointAt('main', T);
    await cur.moveTo(pt.x, pt.y, 420);
    cur.say('✦ ' + text + ' · ' + ({zoomin: 'phóng vào', whip: 'lia nhanh', flash: 'loé sáng', shake: 'rung', glitch: 'nhiễu'}[o.tr] || ''));
    await cur.click();
    applyOp(p, o);
    ed.seek(Math.max(0, T - 0.3));
    return;
  }
  if (o.op === 'add') {
    const row = {texts: 'texts', zooms: 'zooms', broll: 'broll', stickers: 'stickers', sfx: 'sfx'}[o.list] || 'broll';
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
      ghost.style.transform = `translate(${cur.x - 8}px, ${cur.y - 22}px)`;
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
    if (o.list === 'texts' || o.list === 'stickers') {
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
  // Gửi các đoạn SONG SONG (tối đa 4 cùng lúc) thay vì lần lượt: video 1–2 phút nhanh gấp 2–4 lần.
  // (Bỏ “20 chữ cuối đoạn trước” làm gợi ý vì đoạn sau không còn chờ đoạn trước; gợi ý theo thể loại vẫn giữ.)
  const prompt = PROMPTS[p.genre] || PROMPTS.chung;
  const n = cuts.length - 1;
  const res = new Array(n);
  let done = 0;
  let next = 0;
  onProgress?.(0);
  const one = async (k) => {
    const a = cuts[k];
    const part = pcm.subarray(Math.floor(a * SR), Math.floor(cuts[k + 1] * SR));
    let r = null;
    for (let tryN = 0; tryN < 3 && !r; tryN++) {
      try {
        r = await api('transcribe', wav16(part), true, '?prompt=' + encodeURIComponent(prompt));
      } catch (e) {
        if (tryN === 2 || /tắt/.test(e.message)) throw e;
        await new Promise((ok) => setTimeout(ok, /nhanh/.test(e.message) ? 15000 : 1500));
      }
    }
    res[k] = (r.words || []).map((w) => ({w: w.w, s: +(w.s + a).toFixed(3), e: +(w.e + a).toFixed(3)}));
    onProgress?.(++done / n);
  };
  await Promise.all(Array.from({length: Math.min(4, n)}, async () => {
    while (next < n) await one(next++);
  }));
  const words = res.flat();
  onProgress?.(1);
  // Whisper hay tách số: “3” + “.800”, “50” + “%” → ghép lại
  const merged = [];
  for (const w of words) {
    const prev = merged[merged.length - 1];
    if (prev && /\d$/.test(prev.w) && (/^[.,]\d/.test(w.w) || /^%/.test(w.w)) && w.s - prev.e < 0.15) {
      prev.w += w.w;
      prev.e = w.e;
    } else merged.push({...w});
  }
  // bỏ chữ “bịa” rơi vào chỗ không có tiếng (mức âm cả chữ dưới ngưỡng thấp)
  return merged.filter((w) => {
    const i0 = Math.max(0, Math.floor(w.s / an.win));
    const i1 = Math.min(lv.db.length, Math.max(i0 + 1, Math.ceil(w.e / an.win)));
    let mx = -999;
    for (let i = i0; i < i1; i++) mx = Math.max(mx, lv.db[i]);
    return mx >= lv.lo;
  });
}

// Gộp các đoạn cắt chồng / sát nhau (giây nguồn)
export function mergeRanges(list) {
  const out = [];
  for (const r of [...list].sort((x, y) => x.a - y.a)) {
    const last = out[out.length - 1];
    if (last && r.a <= last.b + 0.02) last.b = Math.max(last.b, r.b);
    else out.push({a: r.a, b: r.b, why: r.why});
  }
  return out;
}
const normW = (w) => plain(w).replace(/[^a-z0-9]/g, '');
// cụm lời theo chỗ ngừng ≥ 0,35 s (giây nguồn)
function sourcePhrases(words) {
  const ph = [];
  let cur = null;
  for (const w of words) {
    if (!cur || w.s - cur.e >= 0.35) {
      cur = {s: w.s, e: w.e, ws: []};
      ph.push(cur);
    }
    cur.e = w.e;
    const t = normW(w.w);
    if (t) cur.ws.push(t);
  }
  return ph;
}
// CÂU NÓI LẠI (nói vấp rồi nói lại từ đầu): cụm A là ĐẦU của cụm B ngay sau (≤ 4 s) → bỏ A, giữ lần nói sau
export function retakeCuts(words, pace = CUT_PACE.tight) {
  const ph = sourcePhrases(words);
  const out = [];
  for (let k = 0; k + 1 < ph.length; k++) {
    const A = ph[k];
    const B = ph[k + 1];
    if (B.s - A.e > 4 || A.ws.length < 2 || B.ws.length <= A.ws.length) continue;
    let miss = 0;
    for (let i = 0; i < A.ws.length; i++) if (A.ws[i] !== B.ws[i]) miss++;
    const ok = miss === 0 || (A.ws.length >= 5 && miss === 1 && A.ws[0] === B.ws[0] && A.ws[1] === B.ws[1]);
    if (ok) out.push({a: Math.max(0, A.s - 0.02), b: Math.max(A.s, B.s - pace.pre), why: 'retake'});
  }
  return out;
}
// “ờ / à / ừm…” đứng riêng giữa 2 chỗ ngừng → bỏ
const FILLERS = new Set(['o', 'a', 'u', 'um', 'om', 'ua', 'uh', 'hmm', 'hm', 'e', 'ay']);
const FILLER_RAW = /^(ờ+|ơ+|à+|ừ+|ừm+|ờm+|ừa|ầy|ừ ừ|hmm+|um+|uh+|ơ hay)$/i;
export function fillerCuts(words, pace = CUT_PACE.tight) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const raw = String(w.w).trim().toLowerCase().replace(/[.,!?…]/g, '');
    if (!FILLER_RAW.test(raw) || !FILLERS.has(normW(raw))) continue;
    const gapL = i ? w.s - words[i - 1].e : 9;
    const gapR = i + 1 < words.length ? words[i + 1].s - w.e : 9;
    if (gapL < 0.2 || gapR < 0.2) continue;
    out.push({a: Math.max(0, (i ? words[i - 1].e : 0) + pace.post), b: (i + 1 < words.length ? words[i + 1].s : w.e + 0.3) - pace.pre, why: 'filler'});
  }
  return out.filter((r) => r.b - r.a > 0.1);
}

// ---------- AI nhìn cảnh phụ: 1 ảnh ghép 3 khung / cảnh → nhãn tiếng Việt + từ khoá ----------
async function contactSheet(blob) {
  const fr = await thumbs(blob, 3, 300);
  const imgs = await Promise.all(fr.map((u) => new Promise((r) => {
    const im = new Image();
    im.onload = () => r(im);
    im.onerror = () => r(null);
    im.src = u;
  })));
  const ok = imgs.filter(Boolean);
  if (!ok.length) return null;
  const c = document.createElement('canvas');
  c.height = 300;
  c.width = ok.reduce((a, im) => a + im.width + 6, -6);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  let x = 0;
  for (const im of ok) g.drawImage(im, x, 0), (x += im.width + 6);
  return c.toDataURL('image/jpeg', 0.72);
}
export async function tagBrolls(ed, onEach) {
  const {p} = ed;
  const h = await aiHealth();
  const todo = Object.values(p.sources).filter((s) => s.kind === 'broll' && !s.tagBy);
  if (!h.vision || !todo.length) return 0;
  let n = 0;
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    const items = [];
    for (const s of batch) {
      onEach?.(s, null);
      try {
        const img = await contactSheet(await ed.getBlob(s.fileKey));
        if (img) items.push({id: s.id, img});
      } catch (e) {}
    }
    if (!items.length) continue;
    let r = null;
    try {
      r = await api('vision', {genre: genreOf(p).ai, items});
    } catch (e) {
      break;
    }
    for (const s of batch) {
      const t = r?.tags?.[s.id];
      if (!t?.nhan) continue;
      s.tag = t.nhan;
      s.keywords = t.tu_khoa || [];
      s.tagBy = 'ai';
      n++;
      onEach?.(s, t.nhan);
    }
  }
  return n;
}

// Con trỏ chạy dọc làn Video theo tiến độ nghe / chép lời (k: 0→1). scan(null) để tắt.
async function startScan(ed) {
  const {tl, cur} = ed;
  ed.seek(0);
  cur.show();
  const r0 = tl.rowRect('main');
  await cur.moveTo(Math.max(r0.left + 8, tl.pointAt('main', 0).x + 6), r0.top + r0.height / 2, 500);
  return (step, text, k) => {
    if (step === null) {
      cur.step = '';
      cur.say('');
      return;
    }
    const r = tl.rowRect('main');
    const sr = tl.scroll.getBoundingClientRect();
    const D = duration(ed.p);
    // quét trên phần làn Video đang thấy (timeline có thể dài hơn màn hình)
    const x0 = Math.max(sr.left, tl.pointAt('main', 0).x) + 6;
    const x1 = Math.min(sr.right - 12, tl.pointAt('main', D).x - 6);
    const x = x0 + clamp(k) * Math.max(0, x1 - x0);
    cur.step = step;
    cur.jump(x, r.top + r.height / 2);
    cur.say(text);
  };
}

// ---------- AI dựng từ A–Z ----------
export async function autoEdit(ed, log) {
  const {p} = ed;
  const src = p.sources[p.main.src];
  const h = await aiHealth();

  // 1. nghe & tìm khoảng lặng
  log('nghe', 'run', 'Nghe video, tìm khoảng lặng & chỗ nói vấp');
  const blob = await ed.getBlob(src.fileKey);
  const scan = await startScan(ed);
  scan('Bước 1/5', 'Nghe video, tìm chỗ im lặng', 0);
  let an = null;
  try {
    an = await analyzeAudio(blob, (k) => {
      log('nghe', 'run', `Nghe video… ${Math.round(k * 100)}%`);
      scan('Bước 1/5', `Nghe video… ${Math.round(k * 100)}%`, k);
    });
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
      scan('Bước 2/5', 'Chép lời làm phụ đề', 0);
      words = await transcribeAll(p, an, (k) => {
        log('nghe2', 'run', `Chép lời… ${Math.round(k * 100)}%`);
        scan('Bước 2/5', `Chép lời làm phụ đề… ${Math.round(k * 100)}%`, k);
      });
      if (words.length) log('nghe2', 'ok', `Đã chép ${words.length} chữ`);
      else log('nghe2', 'warn', 'Không nghe rõ lời nói');
    } catch (e) {
      log('nghe2', 'warn', 'Chưa chép được lời: ' + e.message);
    }
  } else log('nghe2', 'skip', 'Phụ đề: máy chủ chép lời đang tắt');

  scan(null);
  if (an) {
    src.peaks = an.peaks;
    // khoảng lặng theo nhịp khách chọn (VAD theo cao độ giọng + lời chép Whisper) + câu nói lại + “ờ/à” đứng riêng
    const pace = CUT_PACE[p.cutPace] || CUT_PACE.tight;
    let sil = findSilences(an, {...pace, words: words?.length > 3 ? words : null});
    const extra = words?.length > 3 ? [...retakeCuts(words, pace), ...fillerCuts(words, pace)] : [];
    sil = mergeRanges([...sil, ...extra]);
    const nRetake = extra.filter((x) => x.why === 'retake').length;
    if (nRetake) log('nghe', 'run', `Phát hiện ${nRetake} câu nói lại — giữ lần nói sau`);
    const total = sil.reduce((a, s) => a + Math.min(s.b, src.duration) - s.a, 0);
    log('nghe', 'ok', `Tìm thấy ${sil.length} khoảng lặng (${total.toFixed(1).replace('.', ',')} giây)`);
    // 3. cắt — diễn từ cuối lên đầu để vị trí phía trước không xê dịch
    log('cat', 'run', 'Cắt khoảng lặng');
    const cuts = sil.map((s) => ({op: 'cut', a: s.a, b: Math.min(s.b, src.duration + 0.5)})).reverse();
    ed.cur.step = 'Bước 3/5';
    await animateOps(ed, cuts, {fastAfter: 12});
    log('cat', 'ok', `Đã cắt ${sil.length} chỗ · còn ${duration(p).toFixed(1).replace('.', ',')} giây`);
  } else log('cat', 'skip', 'Bỏ qua bước cắt');
  if (words?.length && words !== p.transcript?.words) {
    applyOp(p, {op: 'transcript', value: {words}});
    if (p.subs) p.subs.on = true;
    ed.changed(false);
  }

  // 4. AI nhìn cảnh phụ (chỉ cảnh chưa có nhãn; khách gắn tay thì giữ nguyên) rồi lên kế hoạch dựng
  if (Object.values(p.sources).some((s) => s.kind === 'broll' && !s.tagBy) && (await aiHealth()).vision) {
    log('ke', 'run', 'AI xem cảnh phụ để đặt đúng chỗ');
    const {tl, cur} = ed;
    cur.show();
    cur.step = 'Bước 4/5';
    const got = await tagBrolls(ed, async (s, nhan) => {
      const el = document.querySelector(`.bin-item[data-src="${s.id}"]`);
      const r = (el && el.offsetParent ? el : tl.rowRect('broll') && document.querySelector('.tl-label[data-row="broll"]'))?.getBoundingClientRect();
      if (r) cur.jump(r.left + r.width / 2, r.top + r.height / 2);
      cur.say(nhan ? `Cảnh “${s.name}” là: ${nhan}` : `Đang xem cảnh “${s.name}”…`);
    });
    if (got) log('ke', 'ok', `AI đã nhận ra ${got} cảnh phụ`);
    cur.say('');
  }
  log('ke', 'run', 'Lên kịch bản dựng: cảnh phụ, chữ, hiệu ứng');
  // AI (Claude, hoặc AI miễn phí Cloudflare khi Claude tắt/hết hạn mức) đọc lời nói và chọn CHỮ Ý CHÍNH;
  // còn nhịp cắt, cảnh phụ, chuyển cảnh, zoom, âm thanh do bộ dựng chuyên nghiệp trên máy làm (đúng thời điểm, không tốn tiền)
  let keys = null;
  const den = densityOf(p);
  if (h.ai && den.every && timelineWords(p).length > 8) {
    try {
      ed.cur.show();
      ed.cur.step = 'Bước 4/5';
      const lane = document.querySelector('.tl-label[data-row="texts"]')?.getBoundingClientRect();
      if (lane) ed.cur.jump(lane.right + 60, lane.top + lane.height / 2);
      ed.cur.say('AI đọc lời nói, chọn chữ điểm nhấn…');
      const count = Math.max(1, Math.round(duration(p) / den.every)) + 2;
      const r = await api('ai', {mode: 'highlight', phrases: timelinePhrases(p), count, gap: den.gap, genre: genreOf(p).ai || genreOf(p).name});
      keys = keyLockups(p, r.items);
      const loc = localKeys(p).filter((k) => !keys.some((x) => Math.abs(x.start - k.start) < den.gap));
      keys = [...keys, ...loc];
      log('ke', 'run', `AI chọn ${keys.length - loc.length} chữ điểm nhấn`);
    } catch (e) {
      keys = null;
    }
    ed.cur.say('');
  }
  const ops = localPlan(p, {keys});
  log('ke', 'ok', `Kịch bản dựng: ${ops.length} thao tác`);

  // 5. diễn từng thao tác
  log('dung', 'run', 'Ghép cảnh phụ, thêm chữ, đẩy máy');
  const order = {broll: 0, texts: 1, stickers: 2, zooms: 3, sfx: 4};
  ops.sort((a, b) => (order[a.list] ?? 3) - (order[b.list] ?? 3) || (a.item?.start || 0) - (b.item?.start || 0));
  ed.cur.step = 'Bước 5/5';
  await animateOps(ed, ops, {fastAfter: 14});
  ed.cur.step = '';
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
  // AI không ra thao tác nào dùng được → thử bộ hiểu lệnh trên máy; vẫn không có thì giữ câu trả lời của AI (vd khách hỏi, không nhờ sửa)
  if (!res || !res.ops.length) {
    const loc = localCommand(p, text, target);
    if (!res || loc.ops.length) res = loc;
  }
  if (res.ops.length) {
    ed.history.push(p);
    await animateOps(ed, res.ops);
    ed.changed(true);
  }
  return res;
}
