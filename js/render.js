// Bộ dựng khung hình: vẽ MỘT khung của video lên canvas 2D.
// Dùng chung cho xem trước (player.js) và xuất MP4 (export.js) để hai bên giống hệt nhau.
// Toạ độ theo khung gốc của khổ hình đang dùng (9:16 = 1080 x 1920, 16:9 = 1920 x 1080…; cạnh ngắn luôn 1080
// nên cỡ chữ/icon giữ nguyên) — nơi gọi tự scale ctx. Đổi khổ: setFormat(p.format) trước khi vẽ.
import {FORMATS} from './templates.js';
import {stickerImage, animFrame} from './library.js';
import {FONT_LIB} from './font-list.js';

export let W = 1080;
export let H = 1920;
export const FPS = 30;
export function setFormat(key) {
  const f = FORMATS[key] || FORMATS['9:16'];
  const changed = W !== f.w || H !== f.h;
  W = f.w;
  H = f.h;
  return changed;
}

// ---------- Font ----------
export const FONTS = {
  anton: {family: 'Anton', weight: '400', label: 'Anton'},
  montserrat: {family: 'Montserrat', weight: '800', label: 'Montserrat'},
  oswald: {family: 'Oswald', weight: '700', label: 'Oswald'},
  bvp: {family: 'BVP', weight: '800', label: 'Be Vietnam'},
};
// + 63 font kho (tải khi dùng, fonts.js)
for (const f of FONT_LIB) FONTS[f.key] = {family: `"${f.family}"`, weight: f.weight, label: f.label, cat: f.cat, lib: true};

let fontsReady = null;
export function loadFonts(base = document.baseURI) {
  if (fontsReady) return fontsReady;
  const list = [
    ['Anton', 'anton.woff2', '400', 'normal'],
    ['Montserrat', 'montserrat800.woff2', '800', 'normal'],
    ['Oswald', 'oswald700.woff2', '700', 'normal'],
    ['BVP', 'bvp800.woff2', '800', 'normal'],
    ['BVP', 'bvp500i.woff2', '500', 'italic'],
  ];
  fontsReady = Promise.all(
    list.map(async ([fam, file, weight, style]) => {
      try {
        const f = new FontFace(fam, `url(${new URL('fonts/' + file, base).href})`, {weight, style});
        await f.load();
        document.fonts.add(f);
      } catch (e) {
        console.warn('Không tải được font', fam, e);
      }
    }),
  );
  return fontsReady;
}

// ---------- Màu & icon ----------
export const COLORS = [
  {name: 'Vàng', hex: '#ffc61a'},
  {name: 'Cam', hex: '#ff8a1f'},
  {name: 'Đỏ', hex: '#ff2a2a'},
  {name: 'Xanh dương', hex: '#2f8cff'},
  {name: 'Hồng', hex: '#ff5fb8'},
  {name: 'Xanh lá', hex: '#2ad46a'},
  {name: 'Tím', hex: '#9a6bff'},
  {name: 'Trắng', hex: '#ffffff'},
];

export const ICONS = {
  house: {label: 'Nhà', d: 'M12 3 2 11h3v9h5v-6h4v6h5v-9h3z'},
  pin: {label: 'Vị trí', d: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z'},
  ruler: {label: 'Diện tích', d: 'M3 17 17 3l4 4L7 21zm4-1 1.5 1.5M9 14l2 2m0-4 1.5 1.5M13 10l2 2m0-4 1.5 1.5'},
  tag: {label: 'Giá', d: 'M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z'},
  doc: {label: 'Pháp lý', d: 'M6 2h9l5 5v15H6zm8 1.5V8h4.5M8 12h8v1.6H8zm0 3.5h8v1.6H8zm0 3.5h5v1.6H8z'},
  school: {label: 'Trường', d: 'M12 3 1 9l11 6 9-4.9V17h2V9zM5 13.2v4L12 21l7-3.8v-4L12 17z'},
  sofa: {label: 'Nội thất', d: 'M4 10V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3a2 2 0 0 0-2 2v2H6v-2a2 2 0 0 0-2-2zm-2 2a2 2 0 0 1 4 0v4h12v-4a2 2 0 0 1 4 0v6H2zm2 7h2v2H4zm14 0h2v2h-2z'},
  car: {label: 'Xe hơi', d: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5h-2v2h-3v-2H8v2H5v-2H3v-5a1 1 0 0 1 1-1zm2.2 0h9.6l-1-3H8.2zM6.5 15a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'},
  tree: {label: 'Cây xanh', d: 'M12 2 5 12h4l-4 6h6v4h2v-4h6l-4-6h4z'},
  star: {label: 'Nổi bật', d: 'M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z'},
  bed: {label: 'Phòng ngủ', d: 'M3 6h2v6h6V8h7a3 3 0 0 1 3 3v8h-2v-2H5v2H3zm5 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'},
  key: {label: 'Bàn giao', d: 'M14 2a6 6 0 0 0-5.7 7.9L2 16.2V22h5.8v-2.6h2.6v-2.6h2.6l.7-.7A6 6 0 1 0 14 2zm2.5 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z'},
  // dùng chung mọi thể loại
  heart: {label: 'Yêu thích', d: 'M12 21.3 10.6 20C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5z'},
  fire: {label: 'Hot', d: 'M13.5.7s.7 2.6.7 4.8c0 2.1-1.4 3.8-3.5 3.8S7.1 7.6 7.1 5.5l.03-.36C5.1 7.6 4 10.7 4 14a8 8 0 0 0 16 0C20 8.6 17.4 3.8 13.5.7zM11.7 19c-1.8 0-3.2-1.4-3.2-3.1 0-1.6 1-2.8 2.8-3.1 1.8-.4 3.6-1.2 4.6-2.6.4 1.3.6 2.6.6 4 0 2.6-2.1 4.8-4.8 4.8z'},
  check: {label: 'Đúng', d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9z'},
  bulb: {label: 'Ý tưởng', d: 'M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z'},
  chat: {label: 'Nhắn tin', d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z'},
  thumb: {label: 'Thích', d: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L14.2 1 7.6 7.6C7.2 7.9 7 8.4 7 9v10c0 1.1.9 2 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.1-.5.1-.7v-2z'},
  clock: {label: 'Thời gian', d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z'},
  cart: {label: 'Mua hàng', d: 'M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.6-1.4 2.4c-.1.3-.2.6-.2 1 0 1.1.9 2 2 2h12v-2H7.4c-.1 0-.2-.1-.2-.2v-.1l.9-1.7h7.4c.8 0 1.4-.4 1.7-1l3.6-6.5c.1-.2.1-.3.1-.5 0-.6-.4-1-1-1H5.2l-.9-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z'},
  gift: {label: 'Quà tặng', d: 'M20 6h-2.2c.1-.3.2-.6.2-1 0-1.7-1.3-3-3-3-1 0-1.9.5-2.5 1.3L12 4l-.5-.7C10.9 2.5 10 2 9 2 7.3 2 6 3.3 6 5c0 .4.1.7.2 1H4c-1.1 0-2 .9-2 2v3h1v9c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-9h1V8c0-1.1-.9-2-2-2zM15 4c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zM9 4c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm2 16H5v-9h6v9zm8 0h-6v-9h6v9z'},
  truck: {label: 'Giao hàng', d: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.7 1.3 3 3 3s3-1.3 3-3h6c0 1.7 1.3 3 3 3s3-1.3 3-3h2v-5l-3-4zM6 18.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm13.5-9 2 2.5H17V9.5h2.5zM18 18.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z'},
  food: {label: 'Món ăn', d: 'M11 9H9V2H7v7H5V2H3v7c0 2.1 1.7 3.8 3.8 4V22h2.5v-9c2.1-.2 3.7-1.9 3.7-4V2h-2v7zm5-3v8h2.5v8H21V2c-2.8 0-5 2.2-5 4z'},
  coffee: {label: 'Cà phê', d: 'M20 3H4v10c0 2.2 1.8 4 4 4h6c2.2 0 4-1.8 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM2 21h18v-2H2v2z'},
  book: {label: 'Kiến thức', d: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z'},
  chart: {label: 'Tăng trưởng', d: 'M16 6l2.3 2.3-4.9 4.9-4-4L2 16.6 3.4 18l6-6 4 4 6.3-6.3L22 12V6z'},
  camera: {label: 'Máy ảnh', d: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2 7.2 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.2L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z'},
  plane: {label: 'Du lịch', d: 'M21 16v-2l-8-5V3.5c0-.8-.7-1.5-1.5-1.5S10 2.7 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z'},
};
const iconPaths = {};
const iconPath = (k) => (iconPaths[k] ||= new Path2D(ICONS[k].d));

// ---------- Thời gian: cắt khoảng lặng ----------
// p.main.segs = các đoạn GIỮ LẠI của video chính, theo giây nguồn, nối liền nhau trên timeline.
export function duration(p) {
  if (!p.main) return 0;
  return p.main.segs.reduce((a, s) => a + (s.out - s.in), 0);
}
export function srcAt(p, T) {
  if (!p.main) return null;
  let acc = 0;
  for (let i = 0; i < p.main.segs.length; i++) {
    const s = p.main.segs[i];
    const len = s.out - s.in;
    if (T < acc + len || i === p.main.segs.length - 1) return {i, t: s.in + Math.min(len, Math.max(0, T - acc))};
    acc += len;
  }
  return null;
}
export function tlOfSrc(p, t) {
  if (!p.main) return null;
  let acc = 0;
  for (const s of p.main.segs) {
    if (t >= s.in && t <= s.out) return acc + (t - s.in);
    acc += s.out - s.in;
  }
  return null;
}
export function segStarts(p) {
  const out = [];
  let acc = 0;
  for (const s of p.main?.segs || []) {
    out.push(acc);
    acc += s.out - s.in;
  }
  return out;
}

// Lời nói theo thời gian timeline (bỏ từ rơi vào đoạn đã cắt)
export function timelineWords(p) {
  const ws = p.transcript?.words || [];
  const out = [];
  for (const w of ws) {
    const s = tlOfSrc(p, (w.s + w.e) / 2);
    if (s === null) continue;
    const len = Math.max(0.12, w.e - w.s);
    out.push({w: w.w, s: Math.max(0, s - len / 2), e: s + len / 2});
  }
  return out;
}
// Phụ đề: 3 từ một dòng, dòng không quá 16 ký tự
export function subLines(p) {
  if (p._subCache && p._subCache.key === p._rev) return p._subCache.lines;
  const ws = timelineWords(p);
  const lines = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    lines.push({ws: cur, s: cur[0].s, e: cur[cur.length - 1].e + 0.15});
    cur = [];
  };
  const UNIT = /^(tỷ|tỉ|triệu|tr|nghìn|ngàn|k|đồng|đ|%|m2|m²|mét|phần|năm|tháng|ngày|giờ|phút|bước|mẹo|cách)[.,!?…]*$/i;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    const text = cur.map((x) => x.w).join(' ');
    const gap = cur.length ? w.s - cur[cur.length - 1].e : 0;
    const prevNum = cur.length && /\d[.,]?$/.test(cur[cur.length - 1].w);
    // không tách con số khỏi đơn vị (“3,8 | tỷ”): cho dòng dài thêm 1 chữ
    const glue = prevNum && UNIT.test(w.w) && gap < 0.6;
    if (!glue && (cur.length >= 3 || (cur.length && (text + ' ' + w.w).length > 16) || gap > 0.6)) flush();
    // dòng sắp đầy mà chữ tiếp theo là số kèm đơn vị → sang dòng mới luôn cho số đứng cùng đơn vị
    else if (!glue && cur.length >= 2 && /\d/.test(w.w) && UNIT.test(ws[i + 1]?.w || '') && (text + ' ' + w.w + ' ' + ws[i + 1].w).length > 18) flush();
    cur.push(w);
    // hết câu/cụm (dấu câu) → xuống dòng; trừ số kiểu “3,” mà chữ sau vẫn là số
    if (/[.,!?…]$/.test(w.w) && !(/^\d+[.,]$/.test(w.w) && /^\d/.test(ws[i + 1]?.w || ''))) flush();
  }
  flush();
  for (let i = 0; i < lines.length - 1; i++) lines[i].e = Math.min(lines[i].e, lines[i + 1].s);
  p._subCache = {key: p._rev, lines};
  return lines;
}

// ---------- Hoạt ảnh ----------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function spring(t, damping = 12, stiffness = 160) {
  if (t <= 0) return 0;
  const w = Math.sqrt(stiffness);
  const z = damping / (2 * w);
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = (x) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

function darken(hex, k = 0.42) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

// ---------- Vẽ ảnh phủ kín khung ----------
export function drawCover(ctx, fr, scale = 1, dx = 0, dy = 0) {
  if (!fr || !fr.img || !fr.w) return false;
  const s = Math.max(W / fr.w, H / fr.h) * scale;
  const w = fr.w * s;
  const h = fr.h * s;
  try {
    ctx.drawImage(fr.img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
    return true;
  } catch (e) {
    return false;
  }
}

// 3 kiểu zoom video chính: (mặc định) đẩy vào 0,25 s rồi giữ; 'punch' = zoom giật tức thì (che chỗ cắt, kiểu dựng TikTok/YouTube);
// 'push' = đẩy máy chậm suốt đoạn (giữ hình không đứng yên khi người nói lâu)
export function zoomAt(p, T) {
  let z = 1;
  for (const zm of p.zooms || []) {
    if (T < zm.start || T >= zm.start + zm.dur) continue;
    let k;
    if (zm.kind === 'punch') k = 1;
    else if (zm.kind === 'push') k = easeInOut(clamp((T - zm.start) / zm.dur));
    else k = Math.min(easeOut((T - zm.start) / 0.25), easeInOut((zm.start + zm.dur - T) / 0.3));
    if (k > 0) z = Math.max(z, 1 + (zm.scale - 1) * k);
  }
  return z;
}

export function activeBrolls(p, T) {
  return (p.broll || []).filter((b) => T >= b.start && T < b.start + b.dur);
}

// ---------- Cụm chữ 3 tầng (mẫu 1) ----------
function fontStr(key, size) {
  const f = FONTS[key] || FONTS.anton;
  return `${f.weight} ${Math.round(size)}px ${f.family}, sans-serif`;
}

// ---------- Màu video (lọc màu) & lớp phủ — dùng chế độ trộn màu canvas (chạy cả Safari cũ, không cần ctx.filter) ----------
export const TRANSITIONS = [
  ['fade', 'Mờ dần'],
  ['none', 'Cắt thẳng'],
  ['zoom', 'Phóng to'],
  ['zoomout', 'Thu nhỏ'],
  ['slide', 'Trượt ngang'],
  ['up', 'Trượt lên'],
  ['whip', 'Lia nhanh'],
  ['wipe', 'Quét'],
  ['circle', 'Mở tròn'],
  ['spin', 'Xoay'],
  ['flash', 'Loé sáng'],
  ['glitch', 'Nhiễu'],
];
// chuyển cảnh ngay tại chỗ cắt trên VIDEO CHÍNH (không cần cảnh phụ)
export const JUMP_TRANS = [
  ['none', 'Không'],
  ['zoomin', 'Phóng vào'],
  ['whip', 'Lia nhanh'],
  ['flash', 'Loé sáng'],
  ['shake', 'Rung'],
  ['glitch', 'Nhiễu'],
];
export const FILTERS = [
  ['none', 'Gốc'],
  ['bright', 'Sáng trong'],
  ['vivid', 'Rực rỡ'],
  ['warm', 'Ấm áp'],
  ['cool', 'Mát lạnh'],
  ['film', 'Điện ảnh'],
  ['vintage', 'Cổ điển'],
  ['moody', 'Trầm'],
  ['bw', 'Đen trắng'],
];
let grainTile = null;
let grainFrame = -1;
function grain() {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 192;
  }
  const g = grainTile.getContext('2d');
  const im = g.createImageData(192, 192);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return grainTile;
}
function blend(ctx, op, color, a) {
  if (a <= 0) return;
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = clamp(a);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}
export function applyLook(ctx, look, T) {
  if (!look) return;
  const k = look.amt ?? 0.6;
  ctx.save();
  switch (look.filter) {
    case 'bright':
      blend(ctx, 'screen', '#ffffff', 0.13 * k);
      blend(ctx, 'saturation', '#ff0000', 0.12 * k);
      break;
    case 'vivid':
      blend(ctx, 'saturation', '#ff0000', 0.32 * k);
      blend(ctx, 'soft-light', '#ffffff', 0.18 * k);
      break;
    case 'warm':
      blend(ctx, 'soft-light', '#ff9a3c', 0.55 * k);
      break;
    case 'cool':
      blend(ctx, 'soft-light', '#3c8cff', 0.5 * k);
      break;
    case 'film':
      blend(ctx, 'soft-light', '#ff8a2a', 0.35 * k);
      blend(ctx, 'color', '#0a8f8f', 0.1 * k);
      blend(ctx, 'multiply', '#e9e2d6', 0.4 * k);
      break;
    case 'vintage':
      blend(ctx, 'saturation', '#808080', 0.45 * k);
      blend(ctx, 'soft-light', '#c08040', 0.6 * k);
      blend(ctx, 'screen', '#2a1a10', 0.5 * k);
      break;
    case 'moody':
      blend(ctx, 'saturation', '#808080', 0.25 * k);
      blend(ctx, 'multiply', '#5a6a90', 0.3 * k);
      break;
    case 'bw':
      blend(ctx, 'saturation', '#808080', k > 0.05 ? 1 : 0);
      blend(ctx, 'soft-light', '#ffffff', 0.15 * k);
      break;
  }
  ctx.globalCompositeOperation = 'source-over';
  // loé sáng trôi (light leak)
  if (look.leak > 0) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(look.leak) * 0.55;
    const x = W * (0.5 + 0.55 * Math.sin(T * 0.45));
    const y = H * (0.25 + 0.2 * Math.cos(T * 0.31));
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.6);
    g.addColorStop(0, 'rgba(255,170,80,0.9)');
    g.addColorStop(0.4, 'rgba(255,80,60,0.35)');
    g.addColorStop(1, 'rgba(255,80,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  // hạt phim
  if (look.grain > 0) {
    const f = Math.floor(T * 15);
    if (f !== grainFrame || !grainTile) {
      grain();
      grainFrame = f;
    }
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = clamp(look.grain) * 0.35;
    const pat = ctx.createPattern(grainTile, 'repeat');
    ctx.fillStyle = pat;
    ctx.save();
    ctx.scale(2.2, 2.2);
    ctx.fillRect(0, 0, W / 2.2 + 1, H / 2.2 + 1);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
  // tối 4 góc
  if (look.vignette > 0) {
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.58);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${clamp(look.vignette) * 0.75})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // viền điện ảnh (2 dải đen trên dưới)
  if (look.bars) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    const bh = W > H ? H * 0.1 : H * 0.07;
    ctx.fillRect(0, 0, W, bh);
    ctx.fillRect(0, H - bh, W, bh);
  }
  ctx.restore();
}

// ---------- Kiểu chữ (mẫu chữ) & chuyển động chữ ----------
export const TEXT_STYLES = [
  ['3d', 'Nổi 3D'],
  ['flat', 'Phẳng'],
  ['outline', 'Viền trắng'],
  ['stroke2', 'Viền đôi'],
  ['shadow', 'Bóng dài'],
  ['box', 'Hộp màu'],
  ['highlight', 'Bút dạ'],
  ['neon', 'Neon'],
  ['gradient', 'Chuyển màu'],
  ['tape', 'Nhãn dán'],
  ['bubble', 'Bong bóng thoại'],
];
// Mẫu chữ có sẵn (kho “Chữ mẫu”): kiểu + chuyển động + font + màu. Font là khoá trong kho font (font-list.js).
export const TEXT_PRESETS = [
  {name: 'Giá sốc', main: '3,8 TỶ', lead: 'giá chỉ', sign: 'có thương lượng', style: '3d', motion: 'stamp', font: 'anton', color: '#ff2a2a', kind: 'price'},
  {name: 'Tiêu đề mở đầu', main: 'BẠN CÓ BIẾT?', style: 'box', motion: 'pop', font: 'bevietnampro900', color: '#ffc61a'},
  {name: 'Nhấn mạnh', main: 'QUAN TRỌNG', style: 'highlight', motion: 'slide', font: 'montserrat900', color: '#ff5fb8'},
  {name: 'Giảm giá', main: 'GIẢM 50%', lead: 'hôm nay', style: 'gradient', motion: 'zoom', font: 'paytoneone400', color: '#ff8a1f'},
  {name: 'Neon', main: 'MỞ CỬA 24/7', style: 'neon', motion: 'glitch', font: 'bungee400', color: '#2f8cff'},
  {name: 'Nhãn dán', main: 'MỚI VỀ', style: 'tape', motion: 'bounce', font: 'bangers400', color: '#ffc61a'},
  {name: 'Lời thoại', main: 'Chốt đơn nha!', style: 'bubble', motion: 'pop', font: 'baloo2800', color: '#ff2a2a'},
  {name: 'Bước làm', main: 'BƯỚC 1', lead: 'mẹo hay', style: 'stroke2', motion: 'slide', font: 'kanit800', color: '#2ad46a'},
  {name: 'Viết tay', main: 'Ngon quên lối về', style: 'flat', motion: 'type', font: 'dancingscript700', color: '#ffffff'},
  {name: 'Sang trọng', main: 'Biệt thự ven sông', style: 'flat', motion: 'rise', font: 'playfairdisplay900', color: '#f5d68a'},
  {name: 'Sóng vui', main: 'SIÊU NGON', style: 'stroke2', motion: 'wave', font: 'grandstander900', color: '#ffc61a'},
  {name: 'Cảnh báo', main: 'SAI LẦM', lead: 'đừng mắc', style: 'box', motion: 'glitch', font: 'anton', color: '#ff2a2a'},
  {name: 'Bóng dài', main: 'HOT TREND', style: 'shadow', motion: 'flip', font: 'bungee400', color: '#ffc61a'},
  {name: 'Giãn chữ', main: 'SẮP RA MẮT', style: 'outline', motion: 'spread', font: 'unbounded800', color: '#9a6bff'},
  {name: 'Tên người nói', main: 'TÊN CỦA BẠN', lead: 'chuyên viên tư vấn', style: 'box', motion: 'slide', font: 'bevietnampro900', color: '#ffffff', size: 0.55, y: 0.8},
  {name: 'Số liệu', main: '+250%', lead: 'doanh thu', style: 'gradient', motion: 'bounce', font: 'unbounded800', color: '#2ad46a'},
  {name: 'Câu hỏi', main: 'Có nên mua?', style: 'bubble', motion: 'bounce', font: 'pattaya400', color: '#2f8cff'},
  {name: 'Miễn phí', main: 'FREESHIP', style: 'stroke2', motion: 'zoom', font: 'bungee400', color: '#ff5fb8'},
];
export const TEXT_MOTIONS = [
  ['pop', 'Bật lớn'],
  ['zoom', 'Phóng ra'],
  ['stamp', 'Đóng dấu'],
  ['slide', 'Trượt vào'],
  ['rise', 'Trồi lên'],
  ['bounce', 'Rơi nảy'],
  ['type', 'Gõ chữ'],
  ['wave', 'Sóng'],
  ['flip', 'Lật'],
  ['glitch', 'Nhiễu'],
  ['spread', 'Giãn chữ'],
];
function lum(hex) {
  const n = parseInt(String(hex || '#ffffff').slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function shiftHue(hex, k = 0.55) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g * (1 - k * 0.3))},${Math.round(b + (255 - b) * k)})`;
}
// Vẽ chữ theo kiểu tại (x, y) — textAlign do nơi gọi đặt
function paintText(ctx, s, x, y, {style, color, size}) {
  if (!s) return;
  ctx.lineJoin = 'round';
  if (style === '3d') {
    const dk = darken(color);
    const depth = Math.max(6, Math.round(size / 11));
    ctx.fillStyle = dk;
    for (let i = depth; i >= 1; i--) ctx.fillText(s, x, y + i * 1.6);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = depth * 1.6 + 6;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.shadowColor = 'transparent';
  } else if (style === 'outline') {
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  } else if (style === 'stroke2') {
    ctx.lineWidth = size * 0.2;
    ctx.strokeStyle = darken(color, 0.3);
    ctx.strokeText(s, x, y);
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  } else if (style === 'shadow') {
    const dk = darken(color, 0.28);
    const depth = Math.max(8, Math.round(size / 7));
    ctx.fillStyle = dk;
    for (let i = depth; i >= 1; i--) ctx.fillText(s, x + i * 1.3, y + i * 1.3);
    ctx.lineWidth = size * 0.05;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  } else if (style === 'neon') {
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.shadowBlur = size * 0.45;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = size * 0.2;
    ctx.fillText(s, x, y);
    ctx.shadowBlur = size * 0.06;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha *= 0.9;
    ctx.fillText(s, x, y);
    ctx.globalAlpha /= 0.9;
    ctx.shadowColor = 'transparent';
  } else if (style === 'gradient') {
    const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    g.addColorStop(0, shiftHue(color, 0.65));
    g.addColorStop(0.5, color);
    g.addColorStop(1, darken(color, 0.7));
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(s, x, y);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = g;
    ctx.fillText(s, x, y);
  } else if (style === 'highlight') {
    ctx.lineWidth = size * 0.08;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s, x, y);
  } else {
    // flat / box / tape / bubble: chữ phẳng (nền khối vẽ riêng)
    if (style === 'flat') {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 6;
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.shadowColor = 'transparent';
  }
}
// Nền khối sau chữ: hộp màu, nhãn dán, bong bóng thoại, vệt bút dạ (mọc ra theo thời gian)
function textBlock(ctx, style, color, w, size, t) {
  if (!['box', 'tape', 'bubble', 'highlight'].includes(style)) return;
  const k = easeOut((t - 0.05) / 0.3);
  if (k <= 0) return;
  const px = size * 0.32;
  const h = size * 1.12;
  ctx.save();
  if (style === 'box') {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = color;
    roundRect(ctx, -w / 2 - px, -h / 2, (w + px * 2) * k, h, size * 0.18);
    ctx.fill();
  } else if (style === 'tape') {
    ctx.rotate(-0.045);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = color;
    const x0 = -w / 2 - px;
    const x1 = x0 + (w + px * 2) * k;
    ctx.beginPath();
    ctx.moveTo(x0, -h / 2);
    ctx.lineTo(x1, -h / 2);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x1 + (i % 2 ? -size * 0.07 : 0), -h / 2 + (h * i) / 6);
    ctx.lineTo(x0, h / 2);
    for (let i = 6; i >= 0; i--) ctx.lineTo(x0 + (i % 2 ? size * 0.07 : 0), -h / 2 + (h * i) / 6);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'bubble') {
    ctx.globalAlpha *= clamp(k * 1.5);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -w / 2 - px, -h / 2 - size * 0.08, w + px * 2, h + size * 0.16, size * 0.42);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w / 2 + size * 0.2, h / 2);
    ctx.lineTo(-w / 2 - size * 0.05, h / 2 + size * 0.42);
    ctx.lineTo(-w / 2 + size * 0.62, h / 2);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'highlight') {
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.92;
    ctx.beginPath();
    const x0 = -w / 2 - size * 0.15;
    ctx.moveTo(x0, size * -0.02);
    ctx.lineTo(x0 + (w + size * 0.3) * k, size * -0.08);
    ctx.lineTo(x0 + (w + size * 0.3) * k + size * 0.05, size * 0.46);
    ctx.lineTo(x0 - size * 0.04, size * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLockup(ctx, it, t, boxes) {
  const dur = it.dur;
  const out = clamp((dur - t) / 0.3);
  if (out <= 0) return;
  const cx = (it.x ?? 0.5) * W;
  const cy = (it.y ?? 0.2) * H;
  const color = it.color || '#ffc61a';
  const leadP = spring(t, 14, 170);
  const mainP = spring(t - 0.13, 11, 140);
  const signP = easeOut((t - 0.45) / 0.4);
  const iconP = spring(t - 0.3, 9, 120);
  let size = 150 * (it.size || 1);
  ctx.save();
  ctx.globalAlpha = out;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // tầng 2: từ khoá chính — kiểu chữ (TEXT_STYLES) × chuyển động (TEXT_MOTIONS)
  ctx.font = fontStr(it.font, size);
  let mw = ctx.measureText(it.main || '').width;
  if (mw > W * 0.9) {
    size *= (W * 0.9) / mw;
    ctx.font = fontStr(it.font, size);
    mw = ctx.measureText(it.main || '').width;
  }
  // tầng 1: chữ dẫn — đặt TRÊN đỉnh thật của chữ chính (đo cả dấu tiếng Việt chồng như “Ổ”, “Ồ”; font có chân cao hơn Anton)
  if (it.lead) {
    const asc = ctx.measureText(it.main || 'A').actualBoundingBoxAscent || size * 0.5;
    const ls = 52 * (it.size || 1);
    const pad = ['box', 'tape', 'bubble', 'highlight'].includes(it.style) ? size * 0.2 : size * 0.08;
    ctx.save();
    ctx.font = `800 ${Math.round(ls)}px BVP, sans-serif`;
    ctx.globalAlpha = out * clamp(leadP);
    ctx.translate((1 - leadP) * -260, 0);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(it.lead.toUpperCase(), cx, cy - Math.max(size * 0.62, asc + pad + ls * 0.5));
    ctx.restore();
  }
  const style = it.style || '3d';
  const motion = it.motion || 'pop';
  const txt = it.main || '';
  const tm = t - 0.13;
  let sc = 1;
  let sy = 1;
  let dx = 0;
  let dy = 0;
  let a = 1;
  let rot = 0;
  let spread = 0;
  let shown = txt.length;
  switch (motion) {
    case 'zoom': {
      const k = spring(tm, 9, 160);
      sc = Math.max(0, k);
      a = clamp(k * 2);
      break;
    }
    case 'stamp': {
      const k = clamp(tm / 0.16);
      sc = 3 - 2 * k * k;
      a = tm > 0 ? clamp(k * 3) : 0;
      const after = tm - 0.16;
      if (after > 0 && after < 0.3) dx = Math.sin(after * 90) * size * 0.05 * (1 - after / 0.3);
      break;
    }
    case 'slide':
      dx = (1 - easeOut(tm / 0.38)) * -W * 0.7;
      a = clamp(tm / 0.15);
      break;
    case 'rise':
      dy = (1 - easeOut(tm / 0.42)) * size * 1.05;
      break;
    case 'bounce':
      dy = -(1 - spring(tm, 7, 130)) * H * 0.22;
      a = clamp(tm / 0.08);
      break;
    case 'flip':
      sy = spring(tm, 10, 170);
      a = clamp(tm / 0.1);
      break;
    case 'spread':
      spread = (1 - easeOut(tm / 0.5)) * size * 0.45;
      a = clamp(tm / 0.3);
      break;
    case 'type':
      shown = Math.max(0, Math.min(txt.length, Math.floor(tm / 0.055)));
      break;
    case 'wave':
      sc = 1.3 - 0.3 * spring(tm, 11, 140);
      a = clamp(tm * 4);
      break;
    case 'glitch':
      a = clamp(tm / 0.05);
      break;
    default: {
      // pop (mẫu 1)
      sc = 1.5 - 0.5 * mainP;
      a = clamp(mainP * 1.3);
    }
  }
  const perChar = motion === 'type' || motion === 'wave' || spread > 0.5;
  const fullW = mw + spread * Math.max(0, txt.length - 1);
  ctx.save();
  ctx.globalAlpha = out * clamp(a);
  ctx.translate(cx + dx, cy + dy);
  if (motion === 'rise') {
    ctx.beginPath();
    ctx.rect(-W, -size * 0.62, W * 2, size * 1.25);
    ctx.clip();
  }
  ctx.rotate(rot);
  ctx.scale(sc, sc * sy);
  // nền khối (hộp / nhãn dán / bong bóng thoại / bút dạ)
  textBlock(ctx, style, color, fullW, size, t);
  const ink = style === 'box' || style === 'tape' ? (lum(color) > 0.6 ? '#111111' : '#ffffff') : style === 'bubble' ? (lum(color) > 0.75 ? '#1a1a1a' : color) : color;
  if (motion === 'glitch' && tm < 0.55) {
    const j = Math.sin(t * 70) * size * 0.06 * (1 - tm / 0.55);
    ctx.save();
    ctx.globalAlpha *= 0.85;
    paintText(ctx, txt, -j, 0, {style: 'flat', color: '#00e5ff', size});
    paintText(ctx, txt, j, Math.cos(t * 50) * size * 0.03, {style: 'flat', color: '#ff2a6d', size});
    ctx.restore();
  }
  if (perChar) {
    // từng chữ cái: gõ chữ / sóng / giãn chữ
    let x = -fullW / 2;
    ctx.textAlign = 'left';
    for (let i = 0; i < shown; i++) {
      const ch = txt[i];
      const cw = ctx.measureText(ch).width;
      const wy = motion === 'wave' ? Math.sin(t * 6 + i * 0.55) * size * 0.08 : 0;
      paintText(ctx, ch, x, wy, {style, color: ink, size});
      x += cw + spread;
    }
    if (motion === 'type' && (shown < txt.length || Math.floor(t * 2.4) % 2 === 0) && t < it.dur - 0.3) {
      ctx.fillStyle = ink;
      ctx.fillRect(x + size * 0.04, -size * 0.42, size * 0.07, size * 0.84);
    }
    ctx.textAlign = 'center';
  } else paintText(ctx, txt, 0, 0, {style, color: ink, size});
  // vệt sáng lướt qua chữ (kiểu nổi / phẳng / viền / chuyển màu)
  const sw = (t - 0.55) / 0.8;
  if (sw > 0 && sw < 1 && ['3d', 'flat', 'outline', 'gradient', 'stroke2'].includes(style) && !perChar) {
    ctx.save();
    const bx = -mw / 2 - 80 + (mw + 160) * sw;
    ctx.beginPath();
    ctx.moveTo(bx - 30, -size);
    ctx.lineTo(bx + 30, -size);
    ctx.lineTo(bx - 10, size);
    ctx.lineTo(bx - 70, size);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.75 * out;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  boxes.push({id: it.id, type: 'text', x: cx - fullW / 2 - 20, y: cy - size * 0.95, w: fullW + 40, h: size * 1.9});

  // tầng 3: chữ ký tay
  if (it.sign) {
    ctx.save();
    ctx.globalAlpha = out * signP;
    ctx.translate(cx, cy + size * 0.62 + (1 - signP) * 20);
    ctx.rotate((-4 * Math.PI) / 180);
    ctx.font = `italic 500 ${Math.round(58 * (it.size || 1))}px BVP, sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = it.kind === 'price' ? '#fff1f1' : '#ffffff';
    ctx.fillText(it.sign, 0, 0);
    ctx.restore();
  }

  // icon động
  if (it.icon && ICONS[it.icon] && iconP > 0) {
    const bob = Math.sin(t * 3) * 8;
    const isz = 170 * (it.size || 1);
    const ix = cx + Math.min(W / 2 - 110, mw / 2 + 40) * (it.iconSide === 'left' ? -1 : 1);
    const iy = cy - size * 0.9 + bob;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(((1 - iconP) * -40 * Math.PI) / 180);
    ctx.scale(iconP * (isz / 24), iconP * (isz / 24));
    ctx.translate(-12, -12);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke(iconPath(it.icon));
    ctx.fillStyle = color;
    ctx.fill(iconPath(it.icon));
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Hình minh hoạ / icon động ----------
// kind 'emoji' = hình Fluent Emoji màu; 'icon' = icon Lucide trắng trên huy hiệu tròn màu (it.color)
// ---------- ĐỒ HOẠ ĐỘNG TỰ VẼ (không file ngoài, không bản quyền) — nằm chung làn Hình: p.stickers[] kind 'gfx', key = loại ----------
// label = chữ (tiêu đề / tên / nút), sub = dòng phụ (thanh tên), color = màu nhấn, font = font kho, variant = kiểu tiêu đề
export const GFX = [
  ['hook', 'Tiêu đề mở đầu', {label: 'BẠN CÓ BIẾT?', x: 0.5, y: 0.17, dur: 2.8, color: '#ffc61a', font: 'anton', variant: 'band'}],
  ['lower', 'Thanh tên', {label: 'TÊN CỦA BẠN', sub: 'Chức danh · lĩnh vực', x: 0.07, y: 0.8, dur: 4, color: '#ffc61a', font: 'bevietnampro900'}],
  ['progress', 'Thanh tiến độ', {x: 0, y: 0, dur: 10, color: '#ffc61a'}],
  ['arrow', 'Mũi tên chỉ', {x: 0.5, y: 0.5, dur: 2.5, color: '#ffc61a'}],
  ['circle', 'Vòng khoanh', {x: 0.5, y: 0.5, dur: 2.5, color: '#ff2a2a', size: 1}],
  ['sparkle', 'Lấp lánh', {x: 0.5, y: 0.22, dur: 1.2, color: '#ffe680'}],
  ['confetti', 'Pháo giấy', {x: 0.5, y: 0, dur: 3, color: '#ffc61a'}],
  ['leak', 'Vệt sáng', {x: 0.5, y: 0.5, dur: 0.9, color: '#ffb36b'}],
  ['follow', 'Nút theo dõi', {label: 'THEO DÕI', x: 0.5, y: 0.6, dur: 3, color: '#ff2a2a', font: 'bevietnampro900'}],
];
export const GFX_MAP = Object.fromEntries(GFX.map(([k, l, d]) => [k, {label: l, def: d}]));
const HOOK_VARIANTS = [['band', 'Dải màu'], ['box', 'Hộp'], ['line', 'Gạch chân'], ['burst', 'Nổ'], ['bubble', 'Bong bóng']];
export {HOOK_VARIANTS};
const rnd = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function fitFont(ctx, font, text, size, maxW) {
  ctx.font = fontStr(font, size);
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size *= maxW / w;
    ctx.font = fontStr(font, size);
  }
  return size;
}
function star(ctx, r) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const rr = k % 2 ? r * 0.28 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}
function drawGfx(ctx, it, t, boxes) {
  const u = Math.min(W, H) / 1080;
  const c = it.color || '#ffc61a';
  const out = clamp((it.dur - t) / 0.25);
  const sz = it.size || 1;
  const cx = (it.x ?? 0.5) * W;
  const cy = (it.y ?? 0.5) * H;
  const ink = lightColor(c) ? '#121212' : '#ffffff';
  ctx.save();
  switch (it.key) {
    case 'hook': {
      const text = String(it.label || '').toUpperCase();
      const v = it.variant || 'band';
      const inP = spring(t, 12, 150);
      ctx.globalAlpha = out;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = fitFont(ctx, it.font || 'anton', text, 112 * u * sz, W * 0.8);
      const tw = ctx.measureText(text).width;
      const bw = tw + size * 0.9;
      const bh = size * 1.45;
      ctx.translate(cx, cy);
      if (v === 'band') {
        const k = easeOut(t / 0.35);
        ctx.rotate(-0.035);
        ctx.fillStyle = c;
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 20 * u;
        ctx.fillRect(-W * 0.6, -bh / 2, W * 1.2 * k, bh);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = ink;
        ctx.globalAlpha = out * clamp((t - 0.15) / 0.2);
        ctx.fillText(text, 0, size * 0.05);
      } else if (v === 'box' || v === 'bubble') {
        ctx.scale(inP, inP);
        ctx.fillStyle = v === 'bubble' ? '#ffffff' : c;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 24 * u;
        roundRect(ctx, -bw / 2, -bh / 2, bw, bh, v === 'bubble' ? bh / 2 : bh * 0.18);
        ctx.fill();
        if (v === 'bubble') {
          ctx.beginPath();
          ctx.moveTo(-bw * 0.2, bh / 2 - 2);
          ctx.lineTo(-bw * 0.28, bh / 2 + bh * 0.35);
          ctx.lineTo(-bw * 0.06, bh / 2 - 2);
          ctx.fill();
        }
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = v === 'bubble' ? '#141414' : ink;
        ctx.fillText(text, 0, size * 0.05);
      } else if (v === 'burst') {
        ctx.save();
        ctx.rotate(t * 0.4);
        ctx.scale(inP, inP);
        ctx.fillStyle = c;
        ctx.beginPath();
        const R = bw * 0.62;
        for (let k = 0; k < 28; k++) {
          const a = (k * Math.PI * 2) / 28;
          const rr = k % 2 ? R * 0.82 : R;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.42);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.scale(inP, inP);
        ctx.lineWidth = size * 0.16;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#141414';
        ctx.strokeText(text, 0, size * 0.05);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 0, size * 0.05);
      } else {
        // line: chữ trắng bóng đổ + gạch chân màu chạy từ giữa ra
        ctx.globalAlpha = out * clamp(t / 0.25);
        ctx.translate(0, (1 - easeOut(t / 0.4)) * size * 0.4);
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 18 * u;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 0, 0);
        ctx.shadowColor = 'transparent';
        const k = easeOut((t - 0.2) / 0.45);
        ctx.fillStyle = c;
        ctx.fillRect((-tw / 2) * k, size * 0.62, tw * k, size * 0.12);
      }
      boxes.push({id: it.id, type: 'sticker', x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh});
      break;
    }
    case 'lower': {
      const name = String(it.label || '');
      const sub = String(it.sub || '');
      ctx.globalAlpha = out;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const size = fitFont(ctx, it.font || 'bevietnampro900', name, 64 * u * sz, W * 0.7);
      const nw = ctx.measureText(name).width;
      ctx.font = `600 ${Math.round(size * 0.55)}px BVP, sans-serif`;
      const sw = ctx.measureText(sub).width;
      const pw = Math.max(nw, sw) + size * 1.1;
      const ph = size * (sub ? 2.15 : 1.45);
      const k = easeOut((t - 0.12) / 0.4);
      ctx.fillStyle = c;
      ctx.fillRect(cx, cy - ph / 2, size * 0.2, ph * easeOut(t / 0.2));
      ctx.fillStyle = 'rgba(12,14,18,0.82)';
      ctx.fillRect(cx + size * 0.2, cy - ph / 2, pw * k, ph);
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + size * 0.2, cy - ph / 2, pw * k, ph);
      ctx.clip();
      ctx.font = fontStr(it.font || 'bevietnampro900', size);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, cx + size * 0.6, sub ? cy - size * 0.36 : cy);
      if (sub) {
        ctx.font = `600 ${Math.round(size * 0.55)}px BVP, sans-serif`;
        ctx.fillStyle = c;
        ctx.fillText(sub, cx + size * 0.6, cy + size * 0.5);
      }
      ctx.restore();
      boxes.push({id: it.id, type: 'sticker', x: cx, y: cy - ph / 2, w: pw, h: ph});
      break;
    }
    case 'progress': {
      const h = 12 * u * sz;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(0, 0, W, h);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, W * clamp(t / it.dur), h);
      break;
    }
    case 'arrow': {
      // mũi tên cong từ trên phải chỉ xuống điểm (x, y), nhún về phía điểm
      const s = spring(t, 10, 150) * sz;
      const bob = Math.sin(t * 7) * 14 * u * clamp(t / 0.4);
      ctx.globalAlpha = out;
      ctx.translate(cx + bob, cy - bob);
      ctx.scale(s, s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const L = 230 * u;
      ctx.beginPath();
      ctx.moveTo(L, -L);
      ctx.quadraticCurveTo(L * 0.9, -L * 0.15, 40 * u, -40 * u);
      for (const [w, col] of [[34 * u, '#141414'], [20 * u, c]]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(78 * u, -14 * u);
      ctx.lineTo(14 * u, -78 * u);
      ctx.closePath();
      ctx.lineWidth = 14 * u;
      ctx.strokeStyle = '#141414';
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fill();
      boxes.push({id: it.id, type: 'sticker', x: cx - 20 * u, y: cy - L * sz, w: L * sz, h: L * sz});
      break;
    }
    case 'circle': {
      const r = W * 0.17 * sz;
      const k = easeOut(t / 0.55);
      ctx.globalAlpha = out;
      ctx.translate(cx, cy);
      ctx.rotate(-0.25);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const end = Math.PI * 2 * 1.08 * k;
      for (let a = 0; a <= end; a += 0.05) {
        const wob = 1 + Math.sin(a * 3) * 0.035;
        ctx.lineTo(Math.cos(a) * r * 1.25 * wob, Math.sin(a) * r * 0.8 * wob);
      }
      ctx.lineWidth = 22 * u;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
      ctx.lineWidth = 13 * u;
      ctx.strokeStyle = c;
      ctx.stroke();
      boxes.push({id: it.id, type: 'sticker', x: cx - r * 1.25, y: cy - r * 0.8, w: r * 2.5, h: r * 1.6});
      break;
    }
    case 'sparkle': {
      ctx.translate(cx, cy);
      for (let i = 0; i < 12; i++) {
        const d = clamp((t - rnd(i) * 0.25) / 0.85);
        if (d <= 0 || d >= 1) continue;
        const a = rnd(i + 40) * Math.PI * 2;
        const dist = (160 + rnd(i + 80) * 260) * u * sz * easeOut(d);
        ctx.save();
        ctx.globalAlpha = Math.sin(d * Math.PI) * out;
        ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist * 0.6);
        ctx.rotate(d * 2);
        ctx.fillStyle = i % 3 ? c : '#ffffff';
        star(ctx, (18 + rnd(i + 9) * 22) * u * sz);
        ctx.fill();
        ctx.restore();
      }
      boxes.push({id: it.id, type: 'sticker', x: cx - 120 * u, y: cy - 80 * u, w: 240 * u, h: 160 * u});
      break;
    }
    case 'confetti': {
      const cols = [c, '#ff5fb8', '#2fd2ff', '#2ad46a', '#ffffff', '#ff8a1f'];
      for (let i = 0; i < 80; i++) {
        const t0 = rnd(i) * 0.8;
        const d = (t - t0) / 1.9;
        if (d <= 0 || d > 1.2) continue;
        const x = rnd(i + 200) * W + Math.sin(t * 3 + i) * 30 * u;
        const y = -40 * u + d * H * 1.05;
        ctx.save();
        ctx.globalAlpha = out;
        ctx.translate(x, y);
        ctx.rotate(t * (2 + rnd(i + 7) * 5));
        ctx.scale(1, Math.cos(t * 6 + i));
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-9 * u, -14 * u, 18 * u, 28 * u);
        ctx.restore();
      }
      break;
    }
    case 'leak': {
      const k = clamp(t / it.dur);
      const x = -W * 0.3 + k * W * 1.6;
      const g = ctx.createRadialGradient(x, H * 0.35, 0, x, H * 0.35, W * 0.75);
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'follow': {
      const done = t > 1.05;
      const text = done ? 'ĐÃ THEO DÕI' : String(it.label || 'THEO DÕI');
      const s = spring(t, 11, 160) * (t > 0.9 && t < 1.05 ? 0.92 : 1) * sz;
      ctx.globalAlpha = out;
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const size = 62 * u;
      ctx.font = fontStr(it.font || 'bevietnampro900', size);
      const tw = ctx.measureText(text).width;
      const bw = tw + size * 2.1;
      const bh = size * 1.7;
      ctx.fillStyle = done ? '#3a3d42' : c;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 24 * u;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = ctx.fillStyle = done ? '#ffffff' : ink;
      ctx.lineWidth = size * 0.14;
      ctx.lineCap = 'round';
      const ix = -bw / 2 + size * 0.85;
      ctx.beginPath();
      if (done) {
        ctx.moveTo(ix - size * 0.3, 0);
        ctx.lineTo(ix - size * 0.05, size * 0.25);
        ctx.lineTo(ix + size * 0.32, -size * 0.25);
      } else {
        ctx.moveTo(ix - size * 0.3, 0);
        ctx.lineTo(ix + size * 0.3, 0);
        ctx.moveTo(ix, -size * 0.3);
        ctx.lineTo(ix, size * 0.3);
      }
      ctx.stroke();
      ctx.fillText(text, ix + size * 0.55, size * 0.04);
      // vòng chạm như ngón tay bấm
      const tap = (t - 0.85) / 0.45;
      if (tap > 0 && tap < 1) {
        ctx.globalAlpha = (1 - tap) * out;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 6 * u;
        ctx.beginPath();
        ctx.arc(bw * 0.18, bh * 0.1, 20 * u + tap * 70 * u, 0, Math.PI * 2);
        ctx.stroke();
      }
      boxes.push({id: it.id, type: 'sticker', x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh});
      break;
    }
  }
  ctx.restore();
}

function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function drawSticker(ctx, it, t, boxes) {
  if (it.kind === 'gfx') return drawGfx(ctx, it, t, boxes);
  const out = clamp((it.dur - t) / 0.25);
  if (out <= 0) return;
  const img = it.kind === 'anim' ? animFrame(it, t) : stickerImage(it);
  const base = Math.min(W, H) * 0.24 * (it.size || 1);
  let cx = (it.x ?? 0.78) * W;
  let cy = (it.y ?? 0.3) * H;
  let s = 1;
  let rot = 0;
  let alpha = 1;
  const inP = spring(t, 10, 150);
  switch (it.motion || 'pop') {
    case 'bounce':
      s = inP;
      cy -= Math.abs(Math.sin(t * 4.2)) * base * 0.12 * clamp(t / 0.4);
      break;
    case 'float':
      s = easeOut(t / 0.35);
      alpha = clamp(t / 0.3);
      cy += Math.sin(t * 2.2) * base * 0.06;
      break;
    case 'wiggle':
      s = inP;
      rot = Math.sin(t * 9) * 0.14 * clamp(t / 0.3);
      break;
    case 'pulse':
      s = inP * (1 + Math.sin(t * 6.3) * 0.06);
      break;
    case 'spin':
      s = easeOut(t / 0.45);
      rot = (1 - easeOut(t / 0.45)) * Math.PI * 2;
      break;
    case 'drop':
      cy -= (1 - spring(t, 8, 120)) * H * 0.4;
      alpha = clamp(t / 0.12);
      break;
    case 'slide':
      cx += (1 - easeOut(t / 0.4)) * W * 0.6 * ((it.x ?? 0.78) < 0.5 ? -1 : 1);
      break;
    default: // pop
      s = inP;
      rot = (1 - clamp(inP)) * -0.4;
  }
  s *= 1 - (1 - out) * 0.4;
  if (s <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha) * out;
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(s, s);
  if (it.kind === 'icon' && String(it.key).startsWith('bds-')) {
    // bộ icon BĐS mẫu 1: huy hiệu tròn chuyển sắc + vệt bóng phía trên (như skill batdongsan-editor)
    const r = base * 0.5;
    const c = it.color || '#ff6a3d';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    const gr = ctx.createLinearGradient(0, -r, 0, r);
    gr.addColorStop(0, mixHex(c, '#ffffff', 0.35));
    gr.addColorStop(1, c);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5, r * 0.72, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (img) ctx.drawImage(img, -r * 0.56, -r * 0.56, r * 1.12, r * 1.12);
  } else if (it.kind === 'icon') {
    const r = base * 0.5;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = it.color || '#2f8cff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = r * 0.08;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();
    if (img) ctx.drawImage(img, -r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
  } else if (img) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(img, -base / 2, -base / 2, base, base);
  }
  ctx.restore();
  boxes.push({id: it.id, type: 'sticker', x: cx - base / 2, y: cy - base / 2, w: base, h: base});
}

// ---------- Phụ đề bật từng từ ----------
// Kiểu phụ đề (giống ứng dụng dựng phổ biến): Nổi bật = chữ đang nói đổi màu + nảy; Hộp màu = hộp màu sau chữ đang nói;
// Bật từng chữ = chữ hiện dần theo lời; Tối giản = cả dòng trên dải tối mờ
export const SUB_STYLES = {
  karaoke: {label: 'Nổi bật', upper: true, size: 96},
  box: {label: 'Hộp màu', upper: true, size: 92},
  pop: {label: 'Bật từng chữ', upper: false, size: 92},
  clean: {label: 'Tối giản', upper: false, size: 66},
};
const isNum = (w) => /\d/.test(w);
function lightColor(hex) {
  const n = parseInt(String(hex || '#ffffff').slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150;
}
function drawSubs(ctx, p, T, low) {
  const lines = subLines(p);
  const line = lines.find((l) => T >= l.s && T < l.e);
  if (!line) return;
  const st = p.subs || {};
  const style = SUB_STYLES[st.style] ? st.style : 'karaoke';
  const cfg = SUB_STYLES[style];
  const base = st.color || '#ffffff';
  const hl = st.hl || '#ffd21f';
  const size = cfg.size * (st.size || 1);
  const y = (low ? 0.8 : st.y ?? 0.7) * H;
  const txt = (w) => (cfg.upper ? w.toLocaleUpperCase('vi') : w);
  // dòng vào: nảy nhẹ + hiện dần; dòng ra: mờ dần
  const inP = clamp((T - line.s) / 0.14);
  const outP = clamp((line.e - T) / 0.1);
  const lineScale = 0.9 + 0.1 * easeOut(inP);
  ctx.save();
  ctx.globalAlpha = Math.min(1, inP * 1.6) * outP;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (style === 'clean') {
    const text = line.ws.map((w) => w.w).join(' ');
    ctx.font = st.font && FONTS[st.font] ? fontStr(st.font, size) : `700 ${Math.round(size)}px BVP, sans-serif`;
    let tw = ctx.measureText(text).width;
    const k = Math.min(1, (W * 0.86) / tw);
    tw *= k;
    const bh = size * 1.45 * k;
    ctx.fillStyle = 'rgba(8,10,14,0.55)';
    roundRect(ctx, (W - tw) / 2 - size * 0.45, y - bh / 2, tw + size * 0.9, bh, bh * 0.28);
    ctx.fill();
    ctx.translate(W / 2, y);
    ctx.scale(k, k);
    ctx.textAlign = 'center';
    ctx.fillStyle = base;
    ctx.fillText(text, 0, 2);
    ctx.restore();
    return;
  }

  ctx.font = st.font && FONTS[st.font] ? fontStr(st.font, size) : `800 ${Math.round(size)}px BVP, sans-serif`;
  ctx.textAlign = 'center';
  const gap = size * (style === 'box' ? 0.46 : 0.28);
  const words = line.ws.map((w) => ({...w, t: txt(w.w)}));
  const widths = words.map((w) => ctx.measureText(w.t).width);
  let total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  const k = Math.min(1, (W * 0.92) / total) * lineScale;
  total *= k / lineScale;
  // chữ đang nói = chữ cuối cùng đã bắt đầu
  let act = -1;
  words.forEach((w, i) => T >= w.s && (act = i));
  let x = (W - total * lineScale) / 2;
  words.forEach((w, i) => {
    const ww = widths[i] * k;
    const cx = x + ww / 2;
    x += ww + gap * k;
    const started = T >= w.s;
    if (style === 'pop' && !started) return;
    const pp = started ? clamp((T - w.s) / 0.14) : 0;
    const bounce = i === act ? 1 + 0.14 * Math.sin(Math.min(1, pp) * Math.PI) * (1 - pp * 0.3) + 0.04 : 1;
    ctx.save();
    ctx.translate(cx, y + (style === 'pop' ? (1 - pp) * 18 : 0));
    let sc = k * (style === 'pop' ? 0.6 + 0.4 * easeOut(pp) + Math.sin(pp * Math.PI) * 0.08 : bounce);
    ctx.scale(sc, sc);
    if (style === 'pop') ctx.globalAlpha *= Math.min(1, pp * 1.4);
    let fill = base;
    if (style === 'box' && i === act) {
      // hộp màu bo góc sau chữ đang nói
      const bw = widths[i] + size * 0.36;
      const bh = size * 1.18;
      ctx.fillStyle = hl;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 14;
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, size * 0.2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      fill = lightColor(hl) ? '#111111' : '#ffffff';
    } else {
      if (style === 'karaoke' && i === act) fill = hl;
      else if (isNum(w.w) && style !== 'box') fill = hl;
      ctx.lineWidth = size * 0.16;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(w.t, 0, 0);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
    }
    ctx.fillStyle = fill;
    ctx.fillText(w.t, 0, 2);
    ctx.restore();
  });
  ctx.restore();
}

// ---------- Đoạn kết kêu gọi ----------
function drawCta(ctx, p, T, D) {
  const c = p.cta;
  if (!c || !c.on) return false;
  const start = Math.max(0, D - (c.len || 4));
  if (T < start) return false;
  const t = T - start;
  const pp = spring(t, 12, 150);
  const pulse = 1 + Math.sin(t * 6) * 0.025;
  ctx.save();
  ctx.translate(W / 2, H * 0.66);
  ctx.scale(pp * pulse, pp * pulse);
  ctx.font = '400 84px Anton, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = (c.text || 'THEO DÕI ĐỂ XEM THÊM').toUpperCase();
  const tw = Math.min(W * 0.86, ctx.measureText(text).width + 100);
  const th = 150;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  const g = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0);
  g.addColorStop(0, '#ff3b2f');
  g.addColorStop(1, '#ff8a1f');
  ctx.fillStyle = g;
  roundRect(ctx, -tw / 2, -th / 2, tw, th, 34);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  const k = Math.min(1, (tw - 70) / ctx.measureText(text).width);
  ctx.save();
  ctx.scale(k, k);
  ctx.fillText(text, 0, 4);
  ctx.restore();
  ctx.restore();
  return true;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Vẽ một khung ----------
// frames: { main: {img,w,h}|null, broll: {[id]: {img,w,h}} }
export function drawFrame(ctx, p, T, frames, opt = {}) {
  const boxes = [];
  const D = duration(p);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // 1. video chính + zoom đẩy máy + chuyển cảnh ngay chỗ cắt (segs[i].tr = chuyển cảnh VÀO đoạn i)
  let z = zoomAt(p, T);
  let jx = 0;
  let jy = 0;
  let jflash = 0;
  let jtr = null;
  let jt = 9;
  const at = p.main ? srcAt(p, T) : null;
  if (at && at.i > 0 && p.main.segs[at.i]?.tr) {
    jtr = p.main.segs[at.i].tr;
    jt = at.t - p.main.segs[at.i].in;
    if (jt < 0.35) {
      if (jtr === 'zoomin') z *= 1 + 0.22 * (1 - easeOut(jt / 0.28));
      else if (jtr === 'whip') jx = (1 - easeOut(jt / 0.2)) * W * 0.45;
      else if (jtr === 'shake') {
        const k = Math.max(0, 1 - jt / 0.3);
        jx = Math.sin(jt * 70) * 30 * k;
        jy = Math.cos(jt * 55) * 20 * k;
        z *= 1 + 0.04 * k;
      } else if (jtr === 'flash') jflash = Math.max(0, 1 - jt / 0.16) * 0.85;
    }
  }
  // giữ vùng mặt người nói (~38% chiều cao) đứng yên khi zoom, không phóng vào bụng
  const dyFace = H * 0.12 * (z - 1);
  if (jtr === 'whip' && jt < 0.2 && frames.main) {
    // lia nhanh: vệt nhoè theo hướng chạy
    ctx.save();
    for (let k = 3; k >= 1; k--) {
      ctx.globalAlpha = 0.22;
      drawCover(ctx, frames.main, z, jx + k * W * 0.06 * (1 - jt / 0.2), dyFace);
    }
    ctx.restore();
  }
  if (jtr === 'glitch' && jt < 0.22 && frames.main) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, (H * i) / n, W, H / n + 1);
      ctx.clip();
      drawCover(ctx, frames.main, z, Math.sin(i * 5.1 + jt * 120) * W * 0.05 * (1 - jt / 0.22), dyFace);
      ctx.restore();
    }
  } else if (!drawCover(ctx, frames.main, z, jx, dyFace + jy) && opt.placeholder) {
    ctx.fillStyle = '#1b2029';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. cảnh phụ (12 kiểu chuyển cảnh vào, ra luôn mờ nhanh 0,25 s)
  let flash = 0;
  for (const b of activeBrolls(p, T)) {
    const t = T - b.start;
    const tr = b.trans || 'fade';
    const inP = tr === 'none' ? 1 : easeOut(t / (tr === 'whip' || tr === 'flash' ? 0.22 : 0.3));
    const outP = clamp((b.start + b.dur - T) / 0.25);
    const drift = 1.08 - 0.08 * clamp(t / b.dur);
    const fr = frames.broll?.[b.id];
    const paint = (sc, x = 0, y = 0) => {
      if (!drawCover(ctx, fr, sc, x, y) && opt.placeholder) {
        ctx.fillStyle = '#2a3140';
        ctx.fillRect(x, y, W, H);
      }
    };
    ctx.save();
    let alpha = Math.min(inP, outP);
    switch (tr) {
      case 'zoom':
        ctx.globalAlpha = alpha;
        paint(drift + (1 - inP) * 0.3);
        break;
      case 'zoomout':
        ctx.globalAlpha = alpha;
        paint(drift + (1 - inP) * -0.25 + (1 - inP) * 0.5);
        break;
      case 'slide':
        ctx.globalAlpha = outP;
        paint(drift, (1 - inP) * W);
        break;
      case 'up':
        ctx.globalAlpha = outP;
        paint(drift, 0, (1 - inP) * H);
        break;
      case 'whip': {
        // lia nhanh: nhiều bản chồng mờ theo hướng chạy → nhoè chuyển động
        ctx.globalAlpha = outP;
        const off = (1 - inP) * W * 0.9;
        if (inP < 1) for (let k = 3; k >= 1; k--) {
          ctx.globalAlpha = outP * 0.22;
          paint(drift, off + k * W * 0.05 * (1 - inP));
        }
        ctx.globalAlpha = outP;
        paint(drift, off);
        break;
      }
      case 'wipe':
        ctx.globalAlpha = outP;
        ctx.beginPath();
        ctx.rect(0, 0, W * inP, H);
        ctx.clip();
        paint(drift);
        break;
      case 'circle': {
        ctx.globalAlpha = outP;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, Math.hypot(W, H) * 0.55 * inP, 0, Math.PI * 2);
        ctx.clip();
        paint(drift);
        break;
      }
      case 'spin':
        ctx.globalAlpha = alpha;
        ctx.translate(W / 2, H / 2);
        ctx.rotate((1 - inP) * 0.5);
        ctx.scale(0.55 + 0.45 * inP, 0.55 + 0.45 * inP);
        ctx.translate(-W / 2, -H / 2);
        paint(drift);
        break;
      case 'flash':
        ctx.globalAlpha = outP;
        paint(drift);
        flash = Math.max(flash, t < 0.3 ? 1 - Math.abs(t - 0.08) / 0.22 : 0);
        break;
      case 'glitch': {
        ctx.globalAlpha = outP;
        if (t < 0.35) {
          // cắt lát ngang lệch nhau
          const n = 9;
          for (let i = 0; i < n; i++) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, (H * i) / n, W, H / n + 1);
            ctx.clip();
            paint(drift, Math.sin(i * 7.3 + t * 90) * W * 0.06 * (1 - t / 0.35));
            ctx.restore();
          }
        } else paint(drift);
        break;
      }
      default:
        ctx.globalAlpha = alpha;
        paint(drift);
    }
    ctx.restore();
  }
  // màu video + lớp phủ (áp lên cả video chính lẫn cảnh phụ, dưới chữ)
  applyLook(ctx, p.look, T);
  flash = Math.max(flash, jflash);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(flash) * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 3. chữ
  let lockActive = false;
  const ctaOn = p.cta?.on && T >= Math.max(0, D - (p.cta.len || 4));
  for (const it of p.texts || []) {
    if (T < it.start || T >= it.start + it.dur) continue;
    lockActive = true;
    drawLockup(ctx, it, T - it.start, boxes);
  }

  // 3b. hình minh hoạ / icon động
  for (const it of p.stickers || []) {
    if (T < it.start || T >= it.start + it.dur) continue;
    drawSticker(ctx, it, T - it.start, boxes);
  }

  // 4. phụ đề
  if (p.subs?.on && !ctaOn) drawSubs(ctx, p, T, lockActive && (p.subs.y ?? 0.7) < 0.4);

  // 5. đoạn kết
  drawCta(ctx, p, T, D);
  ctx.restore();
  return boxes;
}
