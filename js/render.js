// Bộ dựng khung hình: vẽ MỘT khung của video lên canvas 2D.
// Dùng chung cho xem trước (player.js) và xuất MP4 (export.js) để hai bên giống hệt nhau.
// Toạ độ luôn theo khung gốc 1080 x 1920 — nơi gọi tự scale ctx.

export const W = 1080;
export const H = 1920;
export const FPS = 30;

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
  for (const w of ws) {
    const text = cur.map((x) => x.w).join(' ');
    const gap = cur.length ? w.s - cur[cur.length - 1].e : 0;
    if (cur.length >= 3 || (cur.length && (text + ' ' + w.w).length > 16) || gap > 0.6) flush();
    cur.push(w);
    if (/[.,!?…]$/.test(w.w)) flush();
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
function drawSubs(ctx, p, T, low) {
  const lines = subLines(p);
  const line = lines.find((l) => T >= l.s && T < l.e);
  if (!line) return;
  const st = p.subs || {};
  const size = 92 * (st.size || 1);
  const y = (low ? 0.8 : st.y ?? 0.7) * H;
  ctx.save();
  ctx.font = `800 ${Math.round(size)}px BVP, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const gap = size * 0.24;
  const widths = line.ws.map((w) => ctx.measureText(w.w).width);
  let total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  let k = 1;
  if (total > W * 0.92) {
    k = (W * 0.92) / total;
    total *= k;
  }
  let x = (W - total) / 2;
  line.ws.forEach((w, i) => {
    const ww = widths[i] * k;
    if (T >= w.s) {
      const pp = clamp((T - w.s) / 0.12);
      const pop = 0.6 + 0.4 * (1 - Math.pow(1 - pp, 3)) + Math.sin(pp * Math.PI) * 0.08;
      ctx.save();
      ctx.translate(x + ww / 2, y + (1 - pp) * 18);
      ctx.scale(pop * k, pop * k);
      ctx.globalAlpha = Math.min(1, pp * 1.4);
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.12;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.textAlign = 'center';
      ctx.strokeText(w.w, 0, 0);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = st.color || '#ffffff';
      ctx.fillText(w.w, 0, 0);
      ctx.restore();
    }
    x += ww + gap * k;
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
  const text = (c.text || 'NHẮN TIN XEM NHÀ NGAY').toUpperCase();
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
