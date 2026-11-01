// Bộ dựng khung hình: vẽ MỘT khung của video lên canvas 2D.
// Dùng chung cho xem trước (player.js) và xuất MP4 (export.js) để hai bên giống hệt nhau.
// Toạ độ theo khung gốc của khổ hình đang dùng (9:16 = 1080 x 1920, 16:9 = 1920 x 1080…; cạnh ngắn luôn 1080
// nên cỡ chữ/icon giữ nguyên) — nơi gọi tự scale ctx. Đổi khổ: setFormat(p.format) trước khi vẽ.
import {FORMATS} from './templates.js';

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
    if (/[.,!?…]$/.test(w.w) && !/\d[.,]$/.test(w.w)) flush();
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

export function zoomAt(p, T) {
  let z = 1;
  for (const zm of p.zooms || []) {
    const inn = easeOut((T - zm.start) / 0.25);
    const out = easeInOut((zm.start + zm.dur - T) / 0.3);
    const k = Math.min(inn, out);
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

  // tầng 1: chữ dẫn
  if (it.lead) {
    ctx.save();
    ctx.font = `800 ${Math.round(52 * (it.size || 1))}px BVP, sans-serif`;
    ctx.globalAlpha = out * clamp(leadP);
    ctx.translate((1 - leadP) * -260, 0);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(it.lead.toUpperCase(), cx, cy - size * 0.62);
    ctx.restore();
  }

  // tầng 2: từ khoá chính
  ctx.font = fontStr(it.font, size);
  let mw = ctx.measureText(it.main || '').width;
  if (mw > W * 0.9) {
    size *= (W * 0.9) / mw;
    ctx.font = fontStr(it.font, size);
    mw = ctx.measureText(it.main || '').width;
  }
  const sc = 1.5 - 0.5 * mainP;
  ctx.save();
  ctx.globalAlpha = out * clamp(mainP * 1.3);
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  const style = it.style || '3d';
  if (style === '3d') {
    const dk = darken(color);
    const depth = Math.max(6, Math.round(size / 11));
    ctx.fillStyle = dk;
    for (let i = depth; i >= 1; i--) ctx.fillText(it.main, 0, i * 1.6);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = depth * 1.6 + 6;
    ctx.fillStyle = color;
    ctx.fillText(it.main, 0, 0);
    ctx.shadowColor = 'transparent';
  } else if (style === 'outline') {
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(it.main, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(it.main, 0, 0);
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = color;
    ctx.fillText(it.main, 0, 0);
    ctx.shadowColor = 'transparent';
  }
  // vệt sáng lướt qua chữ
  const sw = (t - 0.55) / 0.8;
  if (sw > 0 && sw < 1) {
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
    ctx.fillText(it.main, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  boxes.push({id: it.id, x: cx - mw / 2 - 20, y: cy - size * 0.95, w: mw + 40, h: size * 1.9});

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
    ctx.font = `700 ${Math.round(size)}px BVP, sans-serif`;
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

  ctx.font = `800 ${Math.round(size)}px BVP, sans-serif`;
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

  // 1. video chính + zoom đẩy máy
  const z = zoomAt(p, T);
  if (!drawCover(ctx, frames.main, z) && opt.placeholder) {
    ctx.fillStyle = '#1b2029';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. cảnh phụ
  for (const b of activeBrolls(p, T)) {
    const t = T - b.start;
    const tr = b.trans || 'fade';
    const inP = tr === 'none' ? 1 : easeOut(t / 0.3);
    const outP = clamp((b.start + b.dur - T) / 0.25);
    const drift = 1.08 - 0.08 * clamp(t / b.dur);
    ctx.save();
    let scale = drift;
    let dx = 0;
    let alpha = Math.min(inP, outP);
    if (tr === 'zoom') scale = drift + (1 - inP) * 0.3;
    if (tr === 'slide') {
      dx = (1 - inP) * W;
      alpha = outP;
    }
    ctx.globalAlpha = alpha;
    if (!drawCover(ctx, frames.broll?.[b.id], scale, dx, 0) && opt.placeholder) {
      ctx.fillStyle = '#2a3140';
      ctx.fillRect(dx, 0, W, H);
    }
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

  // 4. phụ đề
  if (p.subs?.on && !ctaOn) drawSubs(ctx, p, T, lockActive && (p.subs.y ?? 0.7) < 0.4);

  // 5. đoạn kết
  drawCta(ctx, p, T, D);
  ctx.restore();
  return boxes;
}
