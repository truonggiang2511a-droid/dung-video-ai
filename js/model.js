// Mô hình dự án + các "thao tác" (op). Cả AI lẫn khách sửa tay đều đi qua applyOp,
// nhờ vậy con trỏ diễn lại được, hoàn tác được, và AI không ghi đè chỗ khách đã khoá.
import {duration, srcAt, GFX_MAP} from './render.js';
import {GENRES, lastChoice} from './templates.js';
import {PACKS, restyle} from './styles.js';

export const uid = (p = 'i') => p + Math.random().toString(36).slice(2, 9);
export const LISTS = ['broll', 'texts', 'zooms', 'stickers', 'sfx'];
// loại clip trên timeline ↔ danh sách trong dự án
export const TYPE_OF = {broll: 'broll', texts: 'text', zooms: 'zoom', stickers: 'sticker', sfx: 'sfx'};
export const LIST_OF = {broll: 'broll', text: 'texts', zoom: 'zooms', sticker: 'stickers', sfx: 'sfx'};
export const ITEM_TYPES = Object.keys(LIST_OF);

export function newProject(name, opt = {}) {
  const pick = {...lastChoice(), ...opt};
  const genre = GENRES[pick.genre] ? pick.genre : 'chung';
  return {
    genre,
    format: pick.format || '9:16',
    id: uid('p'),
    name: name || 'Dự án ' + new Date().toLocaleDateString('vi-VN'),
    created: Date.now(),
    updated: Date.now(),
    template: 'mau1',
    cutPace: 'tight', // nhịp cắt khoảng lặng: natural | tight | snappy (media.js CUT_PACE)
    textDensity: 'vua', // chữ điểm nhấn: it | vua | nhieu (ai.js TEXT_DENSITY)
    sources: {},
    main: null, // {src, segs:[{in,out}]}
    broll: [],
    texts: [],
    zooms: [],
    stickers: [], // hình minh hoạ / icon động: {id, kind:'emoji'|'icon', key, start, dur, x, y, size, motion, color}
    sfx: [], // hiệu ứng âm thanh: {id, sfx, start, dur, vol}
    look: {filter: 'none', amt: 0.6, vignette: 0, grain: 0}, // màu & lớp phủ toàn video
    subs: {on: true, y: 0.7, size: 1, color: '#ffffff', style: 'karaoke', hl: '#ffd21f'},
    cta: {on: true, text: GENRES[genre].cta, len: 4},
    music: null, // {src, vol}
    transcript: null, // {words:[{w,s,e}]} theo giây nguồn
    aiDone: false,
    approved: false,
    _rev: 0,
  };
}

export function find(p, id) {
  for (const list of LISTS) {
    const idx = (p[list] || []).findIndex((x) => x.id === id);
    if (idx >= 0) return {list, idx, item: p[list][idx]};
  }
  return null;
}

const MIN_SEG = 0.08;

// Bỏ đoạn [a,b] (giây nguồn) khỏi video chính
function cutRange(p, a, b) {
  const out = [];
  for (const s of p.main.segs) {
    if (b <= s.in || a >= s.out) {
      out.push(s);
      continue;
    }
    if (a - s.in > MIN_SEG) out.push({in: s.in, out: a});
    if (s.out - b > MIN_SEG) out.push({in: b, out: s.out});
  }
  p.main.segs = out.length ? out : p.main.segs;
}

// Lấy lại đoạn [a,b] (giây nguồn) đã bị cắt — gộp vào các đoạn giữ lại (theo thứ tự nguồn)
function uncutRange(p, a, b) {
  const all = [...p.main.segs, {in: Math.max(0, a), out: Math.min(p.sources[p.main.src]?.duration || b, b)}].sort((x, y) => x.in - y.in);
  const out = [];
  for (const s of all) {
    const last = out[out.length - 1];
    if (last && s.in <= last.out + 0.02) last.out = Math.max(last.out, s.out);
    else out.push({in: s.in, out: s.out});
  }
  p.main.segs = out;
}

export function applyOp(p, o) {
  switch (o.op) {
    case 'cut':
      if (p.main) cutRange(p, o.a, o.b);
      break;
    case 'uncut':
      if (p.main) uncutRange(p, o.a, o.b);
      break;
    case 'split': {
      const at = srcAt(p, o.T);
      if (!at) break;
      const s = p.main.segs[at.i];
      if (at.t - s.in > MIN_SEG && s.out - at.t > MIN_SEG) p.main.segs.splice(at.i, 1, {in: s.in, out: at.t}, {in: at.t, out: s.out});
      break;
    }
    case 'deleteSeg':
      if (p.main && p.main.segs.length > 1) p.main.segs.splice(o.i, 1);
      break;
    case 'trimSeg': {
      const s = p.main?.segs[o.i];
      if (!s) break;
      if (o.in !== undefined) s.in = Math.max(0, Math.min(o.in, s.out - 0.2));
      if (o.out !== undefined) s.out = Math.max(s.in + 0.2, Math.min(o.out, p.sources[p.main.src].duration));
      break;
    }
    case 'add':
      p[o.list].push(o.item);
      break;
    case 'update': {
      const f = find(p, o.id);
      if (f) Object.assign(f.item, o.set);
      break;
    }
    case 'remove': {
      const f = find(p, o.id);
      if (f) p[f.list].splice(f.idx, 1);
      break;
    }
    case 'subs':
      Object.assign(p.subs, o.set);
      break;
    case 'pack':
      restyle(p, o.key, 'user');
      break;
    case 'cta':
      Object.assign(p.cta, o.set);
      break;
    case 'music':
      p.music = o.set ? Object.assign(p.music || {}, o.set) : null;
      break;
    case 'segfx':
      if (p.main?.segs[o.i]) {
        if (!o.tr || o.tr === 'none') delete p.main.segs[o.i].tr;
        else p.main.segs[o.i].tr = o.tr;
      }
      break;
    case 'look':
      p.look = Object.assign(p.look || {filter: 'none', amt: 0.6, vignette: 0, grain: 0}, o.set);
      break;
    case 'transcript':
      p.transcript = o.value;
      break;
    default:
      console.warn('op lạ', o);
  }
  clampItems(p);
  p._rev = (p._rev || 0) + 1;
}

// Giữ mọi thứ nằm trong độ dài video
export function clampItems(p) {
  const D = duration(p);
  if (!D) return;
  for (const list of LISTS) {
    p[list] = (p[list] || []).filter((x) => x.start < D - 0.1);
    for (const x of p[list]) {
      x.start = Math.max(0, x.start);
      x.dur = Math.max(0.3, Math.min(x.dur, D - x.start));
    }
  }
}

// Mô tả op bằng tiếng Việt cho dòng chú thích cạnh con trỏ
export function describeOp(p, o) {
  const tt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  switch (o.op) {
    case 'cut':
      return `Cắt khoảng lặng ${(o.b - o.a).toFixed(1).replace('.', ',')} giây`;
    case 'split':
      return `Tách clip tại ${tt(o.T)}`;
    case 'deleteSeg':
      return 'Xoá đoạn video';
    case 'uncut':
      return 'Khôi phục đoạn lời';
    case 'add':
      if (o.list === 'broll') return `Ghép cảnh “${p.sources[o.item.src]?.name || 'cảnh phụ'}”`;
      if (o.list === 'texts') return `Thêm chữ “${o.item.main}”`;
      if (o.list === 'stickers') return o.item.kind === 'gfx' ? `Thêm đồ hoạ “${GFX_MAP[o.item.key]?.label || ''}” ${tt(o.item.start)}` : o.item.kind === 'icon' ? `Thêm icon động ${tt(o.item.start)}` : `Thêm hình minh hoạ ${tt(o.item.start)}`;
      if (o.list === 'sfx') return `Thêm âm thanh “${o.item.name || o.item.sfx}” ${tt(o.item.start)}`;
      if (o.list === 'zooms') return o.item.kind === 'punch' ? `Zoom giật che chỗ cắt ${tt(o.item.start)}` : o.item.kind === 'push' ? `Đẩy máy chậm ${tt(o.item.start)}` : `Đẩy máy zoom ${tt(o.item.start)}`;
      return 'Thêm';
    case 'update': {
      const f = find(p, o.id);
      const keys = Object.keys(o.set);
      if (keys.includes('color')) return 'Đổi màu chữ';
      if (keys.includes('font')) return 'Đổi font chữ';
      if (keys.includes('start')) return `Dời ${f?.list === 'texts' ? 'chữ' : 'cảnh'} tới ${tt(o.set.start)}`;
      if (keys.includes('dur')) return 'Chỉnh độ dài';
      if (keys.includes('trans')) return 'Đổi chuyển cảnh';
      if (keys.includes('size')) return 'Đổi cỡ chữ';
      return 'Sửa';
    }
    case 'remove':
      return 'Xoá';
    case 'pack':
      return `Đổi phong cách: ${PACKS[o.key]?.name || o.key}`;
    case 'subs':
      return o.set.on === false ? 'Tắt phụ đề' : o.set.style ? 'Đổi kiểu phụ đề' : 'Bật phụ đề';
    case 'music':
      return o.set ? 'Chỉnh nhạc nền' : 'Bỏ nhạc nền';
    case 'cta':
      return 'Đoạn kết kêu gọi nhắn tin';
    case 'segfx':
      return 'Chuyển cảnh tại chỗ cắt';
    case 'look':
      return o.set.filter ? 'Đổi màu video' : 'Chỉnh hiệu ứng toàn video';
    default:
      return '';
  }
}

// ---------- Hoàn tác ----------
export function snapshot(p) {
  return JSON.stringify(p, (k, v) => (k.startsWith('_') ? undefined : v));
}
export class History {
  constructor() {
    this.undo = [];
    this.redo = [];
  }
  push(p) {
    this.undo.push(snapshot(p));
    if (this.undo.length > 60) this.undo.shift();
    this.redo = [];
  }
  back(p) {
    if (!this.undo.length) return null;
    this.redo.push(snapshot(p));
    return JSON.parse(this.undo.pop());
  }
  fwd(p) {
    if (!this.redo.length) return null;
    this.undo.push(snapshot(p));
    return JSON.parse(this.redo.pop());
  }
}

// Mặc định cho một cụm chữ mới
export function newText(start, over = {}) {
  return Object.assign(
    {id: uid('t'), start, dur: 3.5, kind: 'lockup', lead: '', main: 'CHỮ MỚI', sign: '', font: 'anton', color: '#ffc61a', style: '3d', size: 1, x: 0.5, y: 0.2, icon: '', locked: false},
    over,
  );
}
