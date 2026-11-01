// AI dựng từ A–Z + sửa theo lời nói. Mọi thay đổi là "op" → con trỏ diễn lại trên timeline rồi mới áp vào dự án.
import {analyzeAudio, findSilences, levels, wav16} from './media.js';
import {duration, tlOfSrc, timelineWords, segStarts, clamp, ICONS} from './render.js';
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
        out.push({op: 'add', list: 'zooms', item: {id: uid('z'), start: +o.item?.start || 0, dur: +o.item?.dur || 2.5, scale: Math.min(1.25, Math.max(1.02, +o.item?.scale || 1.08)), ...(['punch', 'push'].includes(o.item?.kind) ? {kind: o.item.kind} : {})}});
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

// ---------- Bộ dựng chuyên nghiệp (chạy trên máy, không cần AI máy chủ) ----------
// Quy tắc dân dựng video ngắn:
//  • 2–3 giây đầu giữ mặt người nói (hook, zoom chặt), cuối video giữ người nói cho câu kêu gọi
//  • đổi hình mỗi 2,5–4 giây (nhịp theo thể loại: templates.js `edit`)
//  • cảnh phụ vào ĐÚNG ĐẦU CỤM LỜI, ưu tiên phủ lên chỗ cắt để che vết cắt; cảnh khớp lời (tên file/nhãn) đặt đúng lúc nhắc tới
//  • dùng HẾT cảnh khách đưa; cảnh dài cắt thành nhiều cú khác nhau; bỏ 0,3 s đầu/cuối mỗi cảnh (hay rung)
//  • chuyển cảnh: đầu câu dùng kiểu nhấn của thể loại, giữa câu cắt thẳng / mờ nhẹ
//  • chỗ cắt lộ trên mặt người nói → zoom giật xen kẽ chặt/rộng; đoạn nói dài không cắt → đẩy máy chậm
const NAME_JUNK = new Set(['img', 'mov', 'mp4', 'vid', 'video', 'clip', 'canh', 'broll', 'pxl', 'dsc', 'copy', 'final', 'edit']);
export function brollTokens(src) {
  return plain(`${src.name || ''} ${src.tag || ''}`)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !NAME_JUNK.has(t) && !/^\d+$/.test(t));
}

export function localPlan(p) {
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
  const sentAt = (t) => {
    const ph = phrases.find((x) => Math.abs(x.s - t) < 0.06);
    return ph ? ph.sent : true;
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
      return {x, toks: brollTokens(x), used: 0, nWin: Math.max(1, Math.floor((usable + 0.2) / (Ls + 0.2)))};
    });
  const matches = (c, ph) => {
    if (!c.toks.length) return false;
    const hit = c.toks.filter((t) => ph.text.includes(' ' + t + ' ')).length;
    return hit >= Math.min(2, c.toks.length);
  };
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
      .map((c) => ({c, ph: phrases.find((x) => x.s >= b0 - 0.3 && x.s < b1 - 1.2 && matches(c, x))}))
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
    const trans = i === 0 || sentAt(o.s) || prevSrc === o.c.x.id ? st.accent : st.base;
    prevSrc = o.c.x.id;
    ops.push({op: 'add', list: 'broll', item: {id: uid('b'), src: o.c.x.id, start: +o.s.toFixed(2), dur, in: +Math.min(inn, Math.max(0, d - dur)).toFixed(2), trans, locked: false}});
  });

  // chữ số liệu từ lời nói
  numberLockups(p).forEach((t) => ops.push({op: 'add', list: 'texts', item: t}));

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
    const type = o.list === 'texts' ? 'text' : o.list === 'zooms' ? 'zoom' : o.list === 'broll' ? 'broll' : find(p, id)?.list === 'texts' ? 'text' : find(p, id)?.list === 'zooms' ? 'zoom' : 'broll';
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
    let sil = findSilences(an);
    const extra = words?.length > 8 ? wordGapCuts(an, words, sil) : [];
    sil = [...sil, ...extra].sort((x, y) => x.a - y.a);
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
  if (!res) res = localCommand(p, text, target);
  if (res.ops.length) {
    ed.history.push(p);
    await animateOps(ed, res.ops);
    ed.changed(true);
  }
  return res;
}
