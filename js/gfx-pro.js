// ĐỒ HOẠ THEO NGÀNH MỞ RỘNG (2/11 chiều) — mỗi ngành một bộ đồ hoạ riêng, tự vẽ canvas (không file ngoài, không bản quyền).
// Bố cục BĐS / chuyên gia chép từ bộ công cụ skill của Giang (chuyen-gia-noi: mg_rec, mg_chip, mg_explain, bảng đánh dấu,
// mg_social, mg_area; batdongsan-editor: số to). Ngành khác: ẩm thực (thẻ nguyên liệu, đồng hồ nấu, tem đóng dấu),
// kiến thức (tiêu đề chương, đúng/sai, trích dẫn, vòng số liệu), vlog (tên địa điểm, tem ngày máy quay), bán hàng (sao đánh giá).
// KHÔNG dùng ctx.shadowBlur / ctx.filter (chậm trên iPhone). Nội dung (số, chữ) luôn lấy từ lời người nói — ở đây chỉ vẽ.
import {W, H, clamp, spring, roundRect, ICONS, fontStr, easeOut, easeInOut, easeOutBack, easeOutExpo, segE, glassCard, drawIco, accGrad, hotParts, countUp, checkMark, mixHex, lightColor, shText, shRect, shCircle, rnd, fitFont, star} from './render.js';

// [key, nhãn tiếng Việt, mặc định, ngành hợp] — gộp vào GFX của render.js
export const PRO_GFX = [
  ['rec', 'Khung quay REC', {x: 0.5, y: 0.5, dur: 2.6, color: '#ff3b3b'}, ['bds', 'vlog', 'chung']],
  ['chip', 'Nhãn kính', {label: 'SỔ HỒNG RIÊNG', icon: 'doc', x: 0.27, y: 0.4, dur: 2.6, color: '#ffc61a'}, ['bds', 'kienthuc', 'chung']],
  ['bignum', 'Số to trên đầu', {label: '3,8 TỶ', sub: 'GIÁ BÁN', x: 0.5, y: 0.16, dur: 3, color: '#ffc61a', font: 'anton'}, ['bds', 'kienthuc', 'banhang', 'chung']],
  ['explain', 'Bảng các bước', {label: '3 BƯỚC MUA NHÀ', sub: 'BẠN CẦN BIẾT', items: [{text: 'Xem pháp lý', t: 0.9}, {text: 'Kiểm tra quy hoạch', t: 2.1}, {text: 'Đặt cọc đúng cách', t: 3.3}], x: 0.5, y: 0.43, dur: 6, color: '#2fe0c8'}, ['bds', 'kienthuc', 'chung']],
  ['checklist', 'Bảng tích kiểm tra', {label: 'CHECKLIST XEM NHÀ', items: [{text: 'Sổ hồng riêng', t: 0.6}, {text: 'Hẻm xe hơi', t: 1.5}, {text: 'Không quy hoạch', t: 2.4}], x: 0.5, y: 0.6, dur: 5, color: '#2ad46a'}, ['bds', 'kienthuc', 'banhang', 'chung']],
  ['lot', 'Sơ đồ lô đất', {label: 'DIỆN TÍCH', w: 5, l: 16, area: '80', x: 0.5, y: 0.3, dur: 3.4, color: '#ffc61a'}, ['bds']],
  ['social', 'Đăng ký · Thích · Chia sẻ', {x: 0.5, y: 0.8, dur: 4, color: '#ff3b3b'}, ['bds', 'kienthuc', 'vlog', 'chung', 'amthuc', 'banhang']],
  ['stars', 'Sao đánh giá', {label: '4.9', sub: 'đánh giá từ khách', x: 0.5, y: 0.24, dur: 3, color: '#ffc61a'}, ['banhang', 'amthuc']],
  ['timer', 'Đồng hồ nấu', {label: '15', sub: 'PHÚT', x: 0.78, y: 0.3, dur: 3, color: '#ff8a1f'}, ['amthuc', 'kienthuc']],
  ['stamp', 'Tem đóng dấu', {label: 'NGON', x: 0.74, y: 0.33, dur: 2.2, color: '#e8261a'}, ['amthuc', 'banhang', 'vlog']],
  ['ingredients', 'Thẻ nguyên liệu', {label: 'Nguyên liệu', items: [{text: 'Thịt ba chỉ', t: 0.5}, {text: 'Nước dừa', t: 1.2}, {text: 'Trứng vịt', t: 1.9}], x: 0.06, y: 0.14, dur: 4.5, color: '#ff8a1f', font: 'patrickhand400'}, ['amthuc']],
  ['chapter', 'Tiêu đề chương', {label: 'BƯỚC 1', sub: 'Chọn đúng khu vực', x: 0.5, y: 0.2, dur: 2.6, color: '#ffc61a'}, ['kienthuc', 'bds', 'amthuc', 'chung']],
  ['versus', 'Sai / Đúng', {old: 'Mua theo cảm tính', sub: 'Xem pháp lý trước', t2: 1.2, x: 0.5, y: 0.3, dur: 4, color: '#2ad46a'}, ['kienthuc', 'bds', 'chung']],
  ['quote', 'Trích dẫn', {label: 'Đầu tư vào kiến thức luôn có lãi cao nhất', sub: '', x: 0.5, y: 0.3, dur: 4, color: '#ffc61a', font: 'lora700'}, ['kienthuc', 'chung']],
  ['stat', 'Vòng số liệu', {label: '70%', sub: 'người mua lần đầu', x: 0.5, y: 0.22, dur: 3, color: '#2fd2ff'}, ['kienthuc', 'banhang', 'chung']],
  ['place', 'Tên địa điểm', {label: 'ĐÀ LẠT', sub: 'Lâm Đồng · Việt Nam', x: 0.5, y: 0.3, dur: 3.2, color: '#ffffff', font: 'bigshouldersdispla900'}, ['vlog', 'amthuc']],
  ['date', 'Tem ngày máy quay', {label: '', x: 0.94, y: 0.945, dur: 3, color: '#ff9a3c'}, ['vlog']],
];

const plainUp = (s) => String(s || '').toUpperCase();
function wrapLines(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// đường cong mềm qua các điểm (Catmull-Rom) → mảng điểm + độ dài cộng dồn
function smoothPath(pts, n = 18) {
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  const L = [0];
  for (let i = 1; i < out.length; i++) L.push(L[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return {pts: out, L};
}
function strokePts(ctx, pts, upto = Infinity, L = null) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (L && L[i] > upto) {
      const a = pts[i - 1];
      const b = pts[i];
      const k = (upto - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k);
      break;
    }
    i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
  }
  ctx.stroke();
}
// viên tròn chuyển sắc (huy hiệu)
function disc(ctx, x, y, r, c1, c2) {
  const g = ctx.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}
function tapRing(ctx, x, y, k, u, a) {
  if (k <= 0 || k >= 1) return;
  ctx.save();
  ctx.globalAlpha *= (1 - k) * a;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.arc(x, y, 16 * u + k * 60 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
// ngón tay chỉ (vẽ khối đơn giản: ngón trỏ + nắm tay)
function finger(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -s * 0.16 + s * 0.05, s * 0.02 + s * 0.06, s * 0.32, s * 0.62, s * 0.16);
  ctx.fill();
  roundRect(ctx, -s * 0.28 + s * 0.05, s * 0.42 + s * 0.06, s * 0.66, s * 0.5, s * 0.2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = s * 0.05;
  roundRect(ctx, -s * 0.16, s * 0.02, s * 0.32, s * 0.62, s * 0.16);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, -s * 0.28, s * 0.42, s * 0.66, s * 0.5, s * 0.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function gfxPro(ctx, it, t, boxes, u, c, out, sz, cx, cy) {
  const b = Math.min(W, H);
  const land = W > H;
  switch (it.key) {
    case 'rec': {
      // khung ngắm máy quay: 4 góc, chấm đỏ REC nhấp nháy, đồng hồ chạy — “đang quay thật”
      const a = Math.min(clamp(t / 0.25), clamp((it.dur - t) / 0.25));
      const m = b * 0.06;
      const top = Math.max(m, H * (land ? 0.08 : 0.1));
      const bot = H - Math.max(m, H * (land ? 0.08 : 0.12));
      const L = b * 0.09 * sz;
      const k = easeOut(t / 0.3);
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(3, b * 0.006);
      ctx.lineCap = 'square';
      for (const [x, y, sx, sy] of [[m, top, 1, 1], [W - m, top, -1, 1], [m, bot, 1, -1], [W - m, bot, -1, -1]]) {
        const ox = (1 - k) * sx * -b * 0.03;
        const oy = (1 - k) * sy * -b * 0.03;
        ctx.beginPath();
        ctx.moveTo(x + ox + sx * L, y + oy);
        ctx.lineTo(x + ox, y + oy);
        ctx.lineTo(x + ox, y + oy + sy * L);
        ctx.stroke();
      }
      // chữ thập giữa
      ctx.globalAlpha = a * 0.55;
      ctx.lineWidth = Math.max(2, b * 0.003);
      const cxm = W / 2;
      const cym = (top + bot) / 2;
      ctx.beginPath();
      ctx.moveTo(cxm - b * 0.025, cym);
      ctx.lineTo(cxm + b * 0.025, cym);
      ctx.moveTo(cxm, cym - b * 0.025);
      ctx.lineTo(cxm, cym + b * 0.025);
      ctx.stroke();
      ctx.globalAlpha = a;
      const px = b * 0.034 * sz;
      ctx.font = fontStr('bvp', px);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.beginPath();
        ctx.arc(m + b * 0.03, top + b * 0.055, b * 0.014, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
      }
      shText(ctx, 'REC', m + b * 0.06, top + b * 0.057, 8 * u, 2 * u, 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('REC', m + b * 0.06, top + b * 0.057);
      const sec = Math.floor(t);
      const tc = `00:00:${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      ctx.textAlign = 'right';
      ctx.font = fontStr('bvp', px * 0.92);
      shText(ctx, tc, W - m - b * 0.02, top + b * 0.057, 8 * u, 2 * u, 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tc, W - m - b * 0.02, top + b * 0.057);
      // pin
      const bx = W - m - b * 0.1;
      const by = bot - b * 0.06;
      ctx.lineWidth = Math.max(2, b * 0.004);
      ctx.strokeRect(bx, by - b * 0.014, b * 0.06, b * 0.028);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + b * 0.06, by - b * 0.007, b * 0.006, b * 0.014);
      ctx.fillRect(bx + b * 0.006, by - b * 0.008, b * 0.036, b * 0.016);
      ctx.textAlign = 'left';
      ctx.font = fontStr('bvp', px * 0.8);
      ctx.fillText('4K · 30', m + b * 0.02, by);
      return true;
    }
    case 'chip': {
      // nhãn kính cạnh vai: viên thuốc chuyển sắc + huy hiệu tròn trắng có icon + chữ HOA, nhún nhẹ
      const text = plainUp(it.label || '');
      const px = b * 0.042 * sz;
      const h = px * 1.95;
      ctx.font = fontStr(it.font || 'bvp', px);
      const ic = it.icon && ICONS[it.icon] ? it.icon : null;
      const w0 = ctx.measureText(text).width + h * (ic ? 1.25 : 0.7);
      const s = easeOutBack(t / 0.32) * (0.95 + 0.05 * out);
      const bob = Math.sin(t * 2.2) * h * 0.06;
      const w = Math.min(w0, W * 0.9);
      const x = clamp(cx - w / 2, b * 0.02, W - w - b * 0.02);
      const y = cy - h / 2 + bob;
      ctx.save();
      ctx.globalAlpha = out * clamp(t / 0.1);
      ctx.translate(x + w / 2, cy + bob);
      ctx.scale(s, s);
      ctx.translate(-(x + w / 2), -(cy + bob));
      shRect(ctx, x, y, w, h, h / 2, 16 * u, 6 * u, 0.35);
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, mixHex(c, '#ffffff', 0.15));
      g.addColorStop(1, mixHex(c, '#ff6a3d', 0.35));
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(ctx, x + h * 0.25, y + h * 0.08, w - h * 0.5, h * 0.32, h * 0.16);
      ctx.fill();
      let xx = x + h * 0.32;
      if (ic) {
        ctx.beginPath();
        ctx.arc(xx + h * 0.3, cy + bob, h * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        drawIco(ctx, ic, xx + h * 0.3, cy + bob, h * 0.42, mixHex(c, '#000000', 0.25));
        xx += h * 0.78;
      }
      ctx.fillStyle = lightColor(c) ? '#1a1a1a' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, xx, cy + bob + px * 0.04);
      ctx.restore();
      boxes.push({id: it.id, type: 'sticker', x, y, w, h});
      return true;
    }
    case 'bignum': {
      // số to trên đầu người nói: chữ khối 3D (nhiều lớp lệch) + chuyển sắc, số chạy lên rồi dừng, nhãn kính nhỏ phía trên
      const text = plainUp(it.label || '');
      const k = segE(t, 0.05, 0.7, easeOutExpo);
      const shown = t > it.dur - 1 ? text : countUp(text, k);
      const size = fitFont(ctx, it.font || 'anton', text, b * 0.2 * sz, W * 0.86);
      const s = 0.6 + 0.4 * easeOutBack(t / 0.4);
      ctx.save();
      ctx.globalAlpha = out * clamp(t / 0.12);
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = fontStr(it.font || 'anton', size);
      const depth = Math.max(4, size * 0.07);
      ctx.fillStyle = mixHex(c, '#000000', 0.62);
      for (let d = depth; d > 0; d -= Math.max(1, depth / 8)) ctx.fillText(shown, d * 0.35, d);
      ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.06;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeText(shown, 0, 0);
      ctx.fillStyle = accGrad(ctx, c, -size * 0.45, size * 0.45);
      ctx.fillText(shown, 0, 0);
      // vệt sáng quét qua chữ
      const sw = (t - 0.6) / 0.7;
      if (sw > 0 && sw < 1) {
        // vệt sáng chỉ trên nét chữ: vẽ lại chữ bằng dải chuyển sắc trong suốt → trắng → trong suốt
        const tw = ctx.measureText(shown).width;
        const xs = -tw / 2 + sw * tw * 1.4 - tw * 0.2;
        const lg = ctx.createLinearGradient(xs - size * 0.3, 0, xs + size * 0.3, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.5, 'rgba(255,255,255,0.75)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = lg;
        ctx.fillText(shown, 0, 0);
      }
      ctx.restore();
      if (it.sub) {
        const sp = b * 0.034 * sz;
        ctx.font = fontStr('bvp', sp);
        const sw2 = ctx.measureText(plainUp(it.sub)).width + sp * 1.4;
        const q = segE(t, 0.25, 0.3);
        glassCard(ctx, cx - sw2 / 2, cy - size * 0.74 - sp * 1.9, sw2, sp * 1.7, sp * 0.85, q * out);
        ctx.globalAlpha = q * out;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(plainUp(it.sub), cx, cy - size * 0.74 - sp * 1.05);
      }
      ctx.font = fontStr(it.font || 'anton', size);
      const tw = ctx.measureText(text).width;
      boxes.push({id: it.id, type: 'sticker', x: cx - tw / 2, y: cy - size * 0.6, w: tw, h: size * 1.2});
      return true;
    }
    case 'explain': {
      // bảng giải thích các bước: nền phủ tối xanh, tấm kính lớn, tiêu đề 2 tầng, đường cong sáng nối mốc 1-2-3 hiện đúng lúc nói
      const items = it.items || [];
      const a = Math.min(clamp(t / 0.35), clamp((it.dur - t) / 0.3));
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(6,30,38,0.62)';
      ctx.fillRect(0, 0, W, H);
      const cw = (land ? W * 0.6 : W * 0.88) * sz;
      const ch = (land ? H * 0.84 : H * 0.6) * sz;
      const s = 0.92 + 0.08 * easeOutBack(t / 0.45);
      const gx = cx - (cw * s) / 2;
      const gy = cy - (ch * s) / 2;
      glassCard(ctx, gx, gy, cw * s, ch * s, b * 0.05, a);
      ctx.globalAlpha = a;
      let ty = gy + ch * 0.06;
      if (it.sub) {
        const lp = b * 0.03;
        ctx.font = fontStr('bvp', lp);
        const pw = ctx.measureText(plainUp(it.sub)).width + lp * 2.4;
        ctx.fillStyle = 'rgba(13,59,68,0.9)';
        roundRect(ctx, cx - pw / 2, ty, pw, lp * 1.7, lp * 0.85);
        ctx.fill();
        ctx.fillStyle = mixHex(c, '#ffffff', 0.55);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(plainUp(it.sub), cx, ty + lp * 0.87);
        ty += lp * 1.7 + b * 0.03;
      }
      if (it.label) {
        const q = segE(t, 0.15, 0.35);
        const size = fitFont(ctx, it.font || 'anton', plainUp(it.label), b * 0.085 * sz, cw * 0.86);
        ctx.globalAlpha = a * q;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(plainUp(it.label), cx, ty + (1 - q) * b * 0.03);
        ty += size * 1.15;
      }
      ctx.globalAlpha = a;
      const n = Math.max(1, items.length);
      const x0 = cx - cw * 0.3;
      const x1 = cx + cw * 0.16;
      const ytop = Math.max(ty + b * 0.07, gy + ch * 0.36);
      const ybot = gy + ch - ch * 0.1;
      const nodes = items.map((_, i) => {
        const v = n === 1 ? 0.5 : i / (n - 1);
        return [n === 1 ? cx - cw * 0.1 : i % 2 ? x1 : x0, ybot - (ybot - ytop) * v];
      });
      if (nodes.length) {
        const path = smoothPath([[nodes[0][0] - cw * 0.12, nodes[0][1] + ch * 0.06], ...nodes]);
        const nodeL = nodes.map((_, i) => path.L[Math.min(path.L.length - 1, (i + 1) * 18)]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = b * 0.006;
        strokePts(ctx, path.pts);
        const on = items.filter((x) => t >= (x.t || 0)).length;
        if (on) {
          const k = on - 1;
          const uu = easeInOut((t - (items[k].t || 0)) / 0.5);
          const s0 = k > 0 ? nodeL[k - 1] : 0;
          const upto = s0 + (nodeL[k] - s0) * uu;
          ctx.strokeStyle = mixHex(c, '#ffffff', 0.35);
          ctx.globalAlpha = a * 0.35;
          ctx.lineWidth = b * 0.02;
          strokePts(ctx, path.pts, upto, path.L);
          ctx.globalAlpha = a;
          ctx.strokeStyle = c;
          ctx.lineWidth = b * 0.009;
          strokePts(ctx, path.pts, upto, path.L);
        }
        const r = b * 0.058;
        items.forEach((x, i) => {
          const q = t - (x.t || 0);
          if (q < 0) return;
          const [nx, ny] = nodes[i];
          const act = i === on - 1;
          const sc = (0.4 + 0.6 * easeOutBack(q / 0.35)) * (act ? 1.12 : 0.92);
          ctx.globalAlpha = a * 0.7;
          ctx.strokeStyle = c;
          ctx.lineWidth = Math.max(2, b * 0.004);
          ctx.beginPath();
          ctx.ellipse(nx, ny + r * 0.55, r * 1.6 * sc, r * 0.55 * sc, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (q < 0.7) {
            const v = q / 0.7;
            ctx.globalAlpha = a * (1 - v);
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(nx, ny, r * (1.2 + v), 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = a * clamp(q / 0.1);
          disc(ctx, nx, ny, r * sc, act ? '#ffffff' : '#b7c9cc', act ? c : '#4a5b60');
          ctx.fillStyle = '#0b2a30';
          ctx.font = fontStr('anton', r * 1.15 * sc);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), nx, ny + r * 0.05);
          const lq = segE(q, 0.12, 0.3);
          if (lq > 0) {
            const px2 = b * 0.042;
            ctx.font = fontStr('bvp', px2);
            const tw = Math.min(ctx.measureText(x.text).width, cw * 0.62);
            const pw = tw + b * 0.06;
            const ph = px2 * 1.75;
            let bx = nx < cx ? nx + r * 1.5 : nx - r * 1.5 - pw;
            bx = clamp(bx, gx + b * 0.02, gx + cw - pw - b * 0.02);
            const by = ny - ph / 2 - (1 - easeOut(lq)) * b * 0.02;
            ctx.globalAlpha = a * lq;
            ctx.fillStyle = 'rgba(13,59,68,0.92)';
            roundRect(ctx, bx, by, pw, ph, b * 0.025);
            ctx.fill();
            ctx.strokeStyle = act ? mixHex(c, '#ffffff', 0.3) : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = Math.max(1.5, b * 0.0025);
            ctx.stroke();
            ctx.fillStyle = act ? '#ffffff' : '#d7e4e6';
            ctx.textAlign = 'left';
            ctx.fillText(x.text, bx + b * 0.03, by + ph / 2 + px2 * 0.04, cw * 0.62);
          }
        });
      }
      boxes.push({id: it.id, type: 'sticker', x: gx, y: gy, w: cw, h: ch});
      return true;
    }
    case 'checklist': {
      // bảng đánh dấu trước ngực: tiêu đề + từng dòng ô vuông, tích xanh đúng lúc người nói nhắc tới
      const items = it.items || [];
      const px = b * 0.044 * sz;
      const rowH = px * 2;
      const cw = (land ? W * 0.5 : W * 0.84) * sz;
      const head = px * 2.2;
      const ch = head + items.length * rowH + px * 0.6;
      const gx = cx - cw / 2;
      const gy = cy - ch / 2;
      const k = easeOutExpo(t / 0.45);
      glassCard(ctx, gx, gy + (1 - k) * b * 0.06, cw, ch, b * 0.035, out * clamp(t / 0.15));
      ctx.globalAlpha = out * clamp(t / 0.2);
      const oy = (1 - k) * b * 0.06;
      ctx.fillStyle = c;
      roundRect(ctx, gx, gy + oy, cw, head, b * 0.035);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.fillRect(gx, gy + oy + head * 0.5, cw, head * 0.5);
      ctx.fillStyle = lightColor(c) ? '#121212' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = fontStr(it.font || 'bvp', px * 1.05);
      ctx.fillText(plainUp(it.label || ''), gx + px * 0.8, gy + oy + head / 2 + px * 0.04, cw - px * 1.6);
      items.forEach((x, i) => {
        const yy = gy + oy + head + px * 0.3 + i * rowH + rowH / 2;
        const done = t - (x.t || 0);
        const q = segE(t, 0.25 + i * 0.12, 0.25);
        ctx.globalAlpha = out * q;
        const bs = px * 1.1;
        const bx = gx + px * 0.8;
        ctx.lineWidth = Math.max(2, b * 0.0035);
        ctx.strokeStyle = done > 0 ? c : 'rgba(255,255,255,0.55)';
        roundRect(ctx, bx, yy - bs / 2, bs, bs, bs * 0.22);
        if (done > 0) {
          ctx.fillStyle = mixHex(c, '#000000', 0.55);
          ctx.fill();
        }
        ctx.stroke();
        if (done > 0) checkMark(ctx, bx + bs * 0.05, yy, bs * 0.9, easeOut(done / 0.3), '#ffffff');
        ctx.font = fontStr('bvp', px);
        ctx.fillStyle = done > 0 ? '#ffffff' : 'rgba(255,255,255,0.62)';
        ctx.fillText(x.text, bx + bs + px * 0.6, yy + px * 0.04, cw - bs - px * 2.4);
        if (done > 0 && done < 0.5) {
          ctx.globalAlpha = out * (1 - done / 0.5) * 0.35;
          ctx.fillStyle = c;
          ctx.fillRect(gx + 4 * u, yy - rowH / 2 + 2 * u, cw - 8 * u, rowH - 4 * u);
        }
      });
      boxes.push({id: it.id, type: 'sticker', x: gx, y: gy, w: cw, h: ch});
      return true;
    }
    case 'lot': {
      // sơ đồ lô đất: khung vẽ ra theo tỉ lệ ngang × dài, số cạnh, diện tích chạy số ở giữa (chỉ số người nói)
      const wl = Math.max(1, +it.w || 5);
      const ll = Math.max(1, +it.l || 16);
      const maxW = (land ? W * 0.3 : W * 0.5) * sz;
      const maxH = (land ? H * 0.5 : H * 0.26) * sz;
      const sc = Math.min(maxW / wl, maxH / ll);
      const rw = wl * sc;
      const rh = ll * sc;
      const x = cx - rw / 2;
      const y = cy - rh / 2;
      const k = easeInOut(t / 0.9);
      ctx.globalAlpha = out;
      ctx.fillStyle = 'rgba(15,17,22,0.55)';
      ctx.globalAlpha = out * clamp(t / 0.4);
      ctx.fillRect(x, y, rw, rh);
      ctx.globalAlpha = out;
      ctx.strokeStyle = c;
      ctx.lineWidth = Math.max(3, b * 0.007);
      ctx.lineJoin = 'round';
      const per = 2 * (rw + rh);
      const pts = [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh], [x, y]];
      const L = [0, rw, rw + rh, 2 * rw + rh, per];
      strokePts(ctx, pts, per * k, L);
      // lưới mờ bên trong
      ctx.globalAlpha = out * 0.18 * clamp((t - 0.6) / 0.4);
      ctx.lineWidth = 1.5 * u;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + (rh * i) / 4);
        ctx.lineTo(x + rw, y + (rh * i) / 4);
        ctx.stroke();
      }
      const q = segE(t, 0.6, 0.35);
      ctx.globalAlpha = out * q;
      const px = b * 0.042 * sz;
      ctx.font = fontStr('bvp', px);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      shText(ctx, `${wl}m`, cx, y - px * 0.35, 8 * u, 2 * u, 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${wl}m`, cx, y - px * 0.35);
      ctx.save();
      ctx.translate(x + rw + px * 0.4, cy);
      ctx.rotate(Math.PI / 2);
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${ll}m`, 0, 0);
      ctx.restore();
      if (it.area) {
        const aq = segE(t, 0.9, 0.7, easeOutExpo);
        const size = Math.min(rw * 0.42, b * 0.1) * sz;
        ctx.globalAlpha = out * clamp((t - 0.9) / 0.2);
        ctx.font = fontStr('anton', size);
        ctx.textBaseline = 'middle';
        ctx.fillStyle = accGrad(ctx, c, cy - size / 2, cy + size / 2);
        const val = countUp(String(it.area), t > it.dur - 0.9 ? 1 : aq);
        ctx.fillText(val, cx, cy - size * 0.1);
        ctx.font = fontStr('bvp', size * 0.36);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('m²', cx, cy + size * 0.5);
      }
      if (it.label) {
        ctx.globalAlpha = out * q;
        ctx.font = fontStr('bvp', px * 0.8);
        const lw = ctx.measureText(plainUp(it.label)).width + px * 1.4;
        ctx.fillStyle = c;
        roundRect(ctx, cx - lw / 2, y + rh + px * 0.5, lw, px * 1.5, px * 0.75);
        ctx.fill();
        ctx.fillStyle = lightColor(c) ? '#141414' : '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(plainUp(it.label), cx, y + rh + px * 1.27);
      }
      boxes.push({id: it.id, type: 'sticker', x: x - px, y: y - px * 1.5, w: rw + px * 2.4, h: rh + px * 3.6});
      return true;
    }
    case 'social': {
      // hàng 3 nút Đăng ký · Thích · Chia sẻ bật ra lần lượt, ngón tay chạm từng nút: đăng ký → ĐÃ ĐĂNG KÝ, thích → tim bay lên
      const its = [
        {icon: 'star', text: it.label || 'ĐĂNG KÝ', done: 'ĐÃ ĐĂNG KÝ', c1: '#ff5a5a', c2: '#e01b1b'},
        {icon: 'thumb', text: 'THÍCH', c1: '#5aa9ff', c2: '#1c6fe8'},
        {icon: 'chat', text: 'CHIA SẺ', c1: '#4be08a', c2: '#14a44d'},
      ];
      const hh = b * 0.085 * sz;
      const span = (land ? W * 0.6 : W * 0.94) * sz;
      const gap = W * 0.022;
      const bw = (span - gap * 2) / 3;
      const x0 = cx - span / 2;
      its.forEach((x, i) => {
        const tap = 0.9 + i * 1.0;
        const q = easeOutBack((t - i * 0.12) / 0.35);
        if (q <= 0.02) return;
        const bx = x0 + i * (bw + gap);
        const done = t > tap + 0.1;
        const press = t > tap - 0.08 && t < tap + 0.18 ? 0.92 : 1;
        ctx.save();
        ctx.globalAlpha = out;
        ctx.translate(bx + bw / 2, cy);
        ctx.scale(q * press, q * press);
        shRect(ctx, -bw / 2, -hh / 2, bw, hh, hh / 2, 14 * u, 5 * u, 0.35);
        const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        const gray = done && x.done;
        g.addColorStop(0, gray ? '#8a8f96' : x.c1);
        g.addColorStop(1, gray ? '#5d6168' : x.c2);
        ctx.fillStyle = g;
        roundRect(ctx, -bw / 2, -hh / 2, bw, hh, hh / 2);
        ctx.fill();
        const label = gray ? x.done : x.text;
        const fs = fitFont(ctx, 'bvp', label, hh * 0.34, bw - hh * 0.95);
        ctx.font = fontStr('bvp', fs);
        const tw = ctx.measureText(label).width;
        const ix = -(tw + hh * 0.5) / 2;
        if (gray) checkMark(ctx, ix - hh * 0.05, 0, hh * 0.36, 1, '#ffffff');
        else drawIco(ctx, x.icon, ix + hh * 0.16, 0, hh * 0.38, '#ffffff');
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, ix + hh * 0.46, hh * 0.03);
        ctx.restore();
        // tim bay lên khi bấm thích
        if (i === 1 && t > tap) {
          for (let j = 0; j < 3; j++) {
            const v = (t - tap - j * 0.12) / 0.9;
            if (v <= 0 || v >= 1) continue;
            ctx.save();
            ctx.globalAlpha = out * (1 - v);
            drawIco(ctx, 'heart', bx + bw / 2 + Math.sin(v * 6 + j) * hh * 0.4, cy - hh * 0.6 - v * hh * 1.6, hh * (0.32 + 0.1 * j), '#ff4d6d');
            ctx.restore();
          }
        }
        tapRing(ctx, bx + bw * 0.62, cy + hh * 0.1, (t - tap) / 0.45, u, out);
      });
      // ngón tay di chuyển tới nút đang chạm
      const tt = clamp((t - 0.5) / 2.6);
      if (t > 0.5 && t < it.dur - 0.2) {
        const seg = Math.min(2, Math.floor((t - 0.5) / 1.0));
        const f = clamp((t - 0.5 - seg * 1.0) / 0.4);
        const xA = x0 + (seg - 1) * (bw + gap) + bw * 0.62;
        const xB = x0 + seg * (bw + gap) + bw * 0.62;
        const fx = seg === 0 ? xB + (1 - easeOut(f)) * bw * 0.3 : xA + (xB - xA) * easeInOut(f);
        ctx.globalAlpha = out * clamp(tt * 6);
        finger(ctx, fx, cy + hh * 0.1, hh * 1.1);
      }
      boxes.push({id: it.id, type: 'sticker', x: x0, y: cy - hh / 2, w: span, h: hh});
      return true;
    }
    case 'stars': {
      // 5 sao điền dần + điểm chạy số (chỉ khi người nói nói số sao / điểm)
      const val = parseFloat(String(it.label || '5').replace(',', '.')) || 5;
      const r = b * 0.042 * sz;
      const gap = r * 2.4;
      const pw = gap * 5 + r * 4.6;
      const ph = r * 3.1;
      const x = cx - pw / 2;
      const k = easeOutBack(t / 0.35);
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.translate(-cx, -cy);
      glassCard(ctx, x, cy - ph / 2, pw, ph, ph / 2, 1);
      for (let i = 0; i < 5; i++) {
        const sx = x + r * 1.6 + i * gap;
        const fill = clamp(val - i) * segE(t, 0.2 + i * 0.12, 0.25);
        ctx.save();
        ctx.translate(sx, cy);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        starPath(ctx, r);
        ctx.fill();
        if (fill > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(-r, -r, 2 * r * fill, 2 * r);
          ctx.clip();
          ctx.fillStyle = c;
          starPath(ctx, r * (1 + 0.15 * (1 - clamp((t - 0.2 - i * 0.12) / 0.3))));
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.font = fontStr('anton', r * 1.7);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const shownV = t > it.dur - 0.8 ? String(it.label) : (val * segE(t, 0.2, 0.8, easeOutExpo)).toFixed(String(it.label).includes('.') || String(it.label).includes(',') ? 1 : 0);
      ctx.fillText(shownV.replace('.', String(it.label).includes(',') ? ',' : '.'), x + r * 1.6 + 5 * gap - r * 0.6, cy + r * 0.08);
      ctx.restore();
      if (it.sub) {
        ctx.globalAlpha = out * segE(t, 0.5, 0.3);
        ctx.font = fontStr('bvp', r * 0.75);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        shText(ctx, it.sub, cx, cy + ph / 2 + r * 0.3, 8 * u, 2 * u, 0.6);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(it.sub, cx, cy + ph / 2 + r * 0.3);
      }
      boxes.push({id: it.id, type: 'sticker', x, y: cy - ph / 2, w: pw, h: ph});
      return true;
    }
    case 'timer': {
      // đồng hồ nấu: vòng chạy hết thời lượng, số phút chạy lên, vạch chia, nảy vào
      const r = b * 0.11 * sz;
      const k = easeOutBack(t / 0.4);
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      ctx.rotate(Math.sin(t * 9) * 0.03 * clamp(1 - t / 0.8));
      shCircle(ctx, 0, 0, r * 1.08, 18 * u, 6 * u, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.08, 0, Math.PI * 2);
      ctx.fillStyle = '#fffaf2';
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      roundRect(ctx, -r * 0.18, -r * 1.32, r * 0.36, r * 0.2, r * 0.05);
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = Math.max(2, r * 0.03);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
        ctx.lineTo(Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96);
        ctx.stroke();
      }
      const sweep = clamp(t / Math.max(1, it.dur - 0.3));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sweep);
      ctx.closePath();
      ctx.fillStyle = mixHex(c, '#ffffff', 0.55);
      ctx.fill();
      ctx.lineWidth = r * 0.1;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sweep);
      ctx.stroke();
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = fontStr('anton', r * 0.62);
      ctx.fillText(t > it.dur - 0.8 ? String(it.label) : countUp(String(it.label || ''), segE(t, 0.1, 0.7, easeOutExpo)), 0, -r * 0.08);
      ctx.font = fontStr('bvp', r * 0.22);
      ctx.fillText(plainUp(it.sub || 'PHÚT'), 0, r * 0.38);
      ctx.restore();
      boxes.push({id: it.id, type: 'sticker', x: cx - r * 1.1, y: cy - r * 1.35, w: r * 2.2, h: r * 2.45});
      return true;
    }
    case 'stamp': {
      // tem đóng dấu: rơi từ to xuống, nghiêng, viền đôi, lốm đốm mực
      const text = plainUp(it.label || 'NGON');
      const px = b * 0.085 * sz;
      ctx.font = fontStr(it.font || 'anton', px);
      const tw = ctx.measureText(text).width;
      const w = tw + px * 1.1;
      const h = px * 1.6;
      const q = clamp(t / 0.22);
      const s = 2.2 - 1.2 * easeOut(q) + (q >= 1 ? 0.06 * Math.max(0, Math.sin((t - 0.22) * 30)) * Math.exp(-(t - 0.22) * 8) : 0);
      ctx.save();
      ctx.globalAlpha = out * q;
      ctx.translate(cx, cy);
      ctx.rotate(-0.16);
      ctx.scale(s, s);
      ctx.strokeStyle = c;
      ctx.lineWidth = px * 0.1;
      roundRect(ctx, -w / 2, -h / 2, w, h, px * 0.2);
      ctx.stroke();
      ctx.lineWidth = px * 0.035;
      roundRect(ctx, -w / 2 + px * 0.16, -h / 2 + px * 0.16, w - px * 0.32, h - px * 0.32, px * 0.12);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, px * 0.05);
      // lốm đốm: chấm trong suốt cắt bớt mực
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.arc((rnd(i) - 0.5) * w, (rnd(i + 50) - 0.5) * h, px * (0.02 + rnd(i + 99) * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      boxes.push({id: it.id, type: 'sticker', x: cx - w / 2, y: cy - h / 2, w, h});
      return true;
    }
    case 'ingredients': {
      // thẻ giấy dán băng keo: tiêu đề viết tay + từng nguyên liệu hiện lần lượt, chấm màu, gạch chân bút
      const items = it.items || [];
      const font = it.font || 'patrickhand400';
      const px = b * 0.05 * sz;
      const rowH = px * 1.45;
      ctx.font = fontStr(font, px);
      const iw = Math.max(ctx.measureText(it.label || '').width * 1.2, ...items.map((x) => ctx.measureText(x.text).width + px * 1.4));
      const cw = Math.min(W * 0.8, iw + px * 1.6);
      const ch = px * 2.2 + items.length * rowH + px * 0.5;
      const x = (it.x ?? 0.06) * W;
      const y = (it.y ?? 0.14) * H;
      const k = easeOutBack(t / 0.4);
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(x + cw / 2, y);
      ctx.rotate(-0.025 + (1 - k) * -0.2);
      ctx.scale(k, k);
      ctx.translate(-(x + cw / 2), -y);
      shRect(ctx, x, y, cw, ch, px * 0.2, 16 * u, 8 * u, 0.35);
      ctx.fillStyle = '#fff7e6';
      roundRect(ctx, x, y, cw, ch, px * 0.2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,120,60,0.18)';
      ctx.lineWidth = 2 * u;
      for (let i = 0; i < items.length; i++) {
        const ly = y + px * 2.2 + (i + 1) * rowH - px * 0.18;
        ctx.beginPath();
        ctx.moveTo(x + px * 0.5, ly);
        ctx.lineTo(x + cw - px * 0.5, ly);
        ctx.stroke();
      }
      // băng keo
      ctx.fillStyle = 'rgba(255,214,120,0.85)';
      ctx.save();
      ctx.translate(x + cw / 2, y);
      ctx.rotate(0.05);
      ctx.fillRect(-px * 1.4, -px * 0.35, px * 2.8, px * 0.7);
      ctx.restore();
      ctx.fillStyle = mixHex(c, '#000000', 0.25);
      ctx.font = fontStr(font, px * 1.1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label || '', x + px * 0.7, y + px * 1.2);
      ctx.font = fontStr(font, px);
      items.forEach((r, i) => {
        const q = t - (r.t || 0);
        if (q <= 0) return;
        const yy = y + px * 2.2 + i * rowH + rowH / 2;
        const a = clamp(q / 0.25);
        ctx.globalAlpha = out * a;
        ctx.beginPath();
        ctx.arc(x + px * 0.95, yy, px * 0.16 * easeOutBack(q / 0.3), 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
        ctx.fillStyle = '#2b2118';
        ctx.fillText(r.text, x + px * 1.4 + (1 - easeOut(q / 0.3)) * px * 0.4, yy);
      });
      ctx.restore();
      boxes.push({id: it.id, type: 'sticker', x, y, w: cw, h: ch});
      return true;
    }
    case 'chapter': {
      // tiêu đề chương: ô số màu + dải tối chữ trắng trượt ra, gạch màu chạy dưới
      const label = plainUp(it.label || '');
      const num = (label.match(/\d+/) || [''])[0];
      const head = num ? label.replace(num, '').trim() : label;
      const px = b * 0.05 * sz;
      const box = px * 2.6;
      ctx.font = fontStr(it.font || 'bvp', px * 1.05);
      const tw = Math.max(ctx.measureText(String(it.sub || '')).width, ctx.measureText(head).width * 0.7);
      const pw = Math.min(W * 0.92 - box, tw + px * 1.6);
      const x = cx - (box + pw) / 2;
      const y = cy - box / 2;
      const k = easeOutExpo(t / 0.5);
      ctx.globalAlpha = out;
      const s = easeOutBack(t / 0.3);
      ctx.save();
      ctx.translate(x + box / 2, cy);
      ctx.scale(s, s);
      ctx.rotate((1 - s) * -0.6);
      shRect(ctx, -box / 2, -box / 2, box, box, box * 0.2, 16 * u, 6 * u, 0.4);
      ctx.fillStyle = c;
      roundRect(ctx, -box / 2, -box / 2, box, box, box * 0.2);
      ctx.fill();
      ctx.fillStyle = lightColor(c) ? '#121212' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (num) {
        ctx.font = fontStr('anton', box * 0.6);
        ctx.fillText(num.padStart(2, '0'), 0, box * 0.1);
        ctx.font = fontStr('bvp', box * 0.15);
        ctx.fillText(head || 'BƯỚC', 0, -box * 0.3);
      } else {
        drawIco(ctx, 'bulb', 0, 0, box * 0.55, lightColor(c) ? '#121212' : '#ffffff');
      }
      ctx.restore();
      if (k > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + box, y - px, (pw + px) * k, box + 2 * px);
        ctx.clip();
        ctx.fillStyle = 'rgba(12,14,18,0.86)';
        roundRect(ctx, x + box - px * 0.4, y + box * 0.12, pw + px * 0.4, box * 0.76, box * 0.14);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = fontStr(it.font || 'bvp', px * 1.05);
        ctx.fillText(String(it.sub || head), x + box + px * 0.5, cy + px * 0.04, pw - px);
        ctx.fillStyle = c;
        ctx.fillRect(x + box + px * 0.5, y + box * 0.8, (pw - px) * segE(t, 0.35, 0.4), px * 0.14);
        ctx.restore();
      }
      boxes.push({id: it.id, type: 'sticker', x, y, w: box + pw, h: box});
      return true;
    }
    case 'versus': {
      // SAI (đỏ, gạch) → ĐÚNG (xanh, tích): 2 thẻ chồng nhau, thẻ đúng vào sau
      const px = b * 0.045 * sz;
      const cw = (land ? W * 0.5 : W * 0.84) * sz;
      const ch = px * 2.6;
      const x = cx - cw / 2;
      const t2 = it.t2 ?? 1.2;
      const rows = [
        {y: cy - ch * 0.62, tag: 'SAI', text: it.old || '', col: '#ff3b3b', t0: 0},
        {y: cy + ch * 0.62, tag: 'ĐÚNG', text: it.sub || '', col: c, t0: t2},
      ];
      rows.forEach((r, i) => {
        const q = t - r.t0;
        if (q <= 0) return;
        const k = easeOutExpo(q / 0.45);
        const dim = i === 0 && t > t2 + 0.3;
        ctx.globalAlpha = out * clamp(q / 0.15) * (dim ? 0.6 : 1);
        const xx = x + (1 - k) * (i ? 1 : -1) * W * 0.3;
        glassCard(ctx, xx, r.y - ch / 2, cw, ch, ch * 0.28, 1);
        ctx.fillStyle = r.col;
        roundRect(ctx, xx + px * 0.4, r.y - ch * 0.32, ch * 0.64, ch * 0.64, ch * 0.18);
        ctx.fill();
        if (i === 0) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = px * 0.18;
          ctx.lineCap = 'round';
          const cxx = xx + px * 0.4 + ch * 0.32;
          const d = ch * 0.13;
          ctx.beginPath();
          ctx.moveTo(cxx - d, r.y - d);
          ctx.lineTo(cxx + d, r.y + d);
          ctx.moveTo(cxx + d, r.y - d);
          ctx.lineTo(cxx - d, r.y + d);
          ctx.stroke();
        } else checkMark(ctx, xx + px * 0.4 + ch * 0.12, r.y, ch * 0.4, easeOut(q / 0.35), '#ffffff');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = fontStr('bvp', px * 0.62);
        ctx.fillStyle = r.col;
        ctx.fillText(r.tag, xx + px * 0.6 + ch * 0.7, r.y - px * 0.55);
        ctx.font = fontStr('bvp', px);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(r.text, xx + px * 0.6 + ch * 0.7, r.y + px * 0.35, cw - ch * 0.7 - px * 1.4);
        if (dim) {
          ctx.strokeStyle = '#ff3b3b';
          ctx.lineWidth = px * 0.1;
          const tw = Math.min(ctx.measureText(r.text).width, cw - ch * 0.7 - px * 1.4);
          const sx = xx + px * 0.6 + ch * 0.7;
          ctx.beginPath();
          ctx.moveTo(sx, r.y + px * 0.38);
          ctx.lineTo(sx + tw * segE(t, t2 + 0.3, 0.3), r.y + px * 0.38);
          ctx.stroke();
        }
      });
      boxes.push({id: it.id, type: 'sticker', x, y: cy - ch * 1.12, w: cw, h: ch * 2.24});
      return true;
    }
    case 'quote': {
      // trích dẫn: dấu ngoặc lớn màu, chữ hiện dần theo từng từ, tên người nói dưới
      const font = it.font || 'lora700';
      const px = b * 0.054 * sz;
      const cw = (land ? W * 0.6 : W * 0.84) * sz;
      ctx.font = fontStr(font, px);
      const lines = wrapLines(ctx, String(it.label || ''), cw - px * 1.6);
      const ch = px * 2.2 + lines.length * px * 1.3 + (it.sub ? px * 1.4 : 0);
      const x = cx - cw / 2;
      const y = cy - ch / 2;
      glassCard(ctx, x, y, cw, ch, px * 0.6, out * clamp(t / 0.25));
      ctx.globalAlpha = out * clamp(t / 0.25);
      ctx.fillStyle = c;
      ctx.font = fontStr('playfairdisplay900', px * 3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('“', x + px * 0.5, y - px * 0.9 + (1 - easeOutBack(t / 0.4)) * px);
      const total = lines.join(' ').split(' ').length;
      const shown = Math.floor(clamp((t - 0.3) / Math.max(0.6, it.dur * 0.45)) * total + 0.999);
      ctx.font = fontStr(font, px);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'alphabetic';
      let n = 0;
      lines.forEach((ln, i) => {
        const ws = ln.split(' ');
        const part = ws.slice(0, Math.max(0, shown - n)).join(' ');
        n += ws.length;
        if (part) ctx.fillText(part, x + px * 0.8, y + px * 2.2 + i * px * 1.3);
      });
      if (it.sub) {
        ctx.globalAlpha = out * segE(t, 0.3 + it.dur * 0.45, 0.3);
        ctx.font = fontStr('bvp', px * 0.62);
        ctx.fillStyle = c;
        ctx.fillText(String(it.sub), x + px * 0.8, y + ch - px * 0.7);
      }
      boxes.push({id: it.id, type: 'sticker', x, y, w: cw, h: ch});
      return true;
    }
    case 'stat': {
      // vòng số liệu: vòng màu chạy tới đúng % người nói, số % chạy lên ở giữa, nhãn dưới
      const pct = clamp((parseFloat(String(it.label || '0').replace(',', '.')) || 0) / 100);
      const r = b * 0.12 * sz;
      const k = segE(t, 0.15, 0.9, easeOutExpo);
      ctx.globalAlpha = out * clamp(t / 0.15);
      const s = easeOutBack(t / 0.35);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,17,22,0.72)';
      ctx.fill();
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.18;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * k);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lab = String(it.label || '');
      const fs = fitFont(ctx, 'anton', lab, r * 0.72, r * 1.6);
      ctx.font = fontStr('anton', fs);
      ctx.fillText(t > it.dur - 0.8 ? lab : countUp(lab, k), 0, r * 0.04);
      ctx.restore();
      if (it.sub) {
        ctx.globalAlpha = out * segE(t, 0.5, 0.3);
        const sp = b * 0.036 * sz;
        ctx.font = fontStr('bvp', sp);
        const sw = Math.min(W * 0.9, ctx.measureText(it.sub).width + sp * 1.4);
        glassCard(ctx, cx - sw / 2, cy + r * 1.35, sw, sp * 1.8, sp * 0.9, out * segE(t, 0.5, 0.3));
        ctx.globalAlpha = out * segE(t, 0.5, 0.3);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.sub, cx, cy + r * 1.35 + sp * 0.92, W * 0.86);
      }
      boxes.push({id: it.id, type: 'sticker', x: cx - r * 1.2, y: cy - r * 1.2, w: r * 2.4, h: r * 2.4});
      return true;
    }
    case 'place': {
      // tên địa điểm kiểu phim du lịch: chữ giãn dần, 2 vạch mảnh, ghim nhỏ + dòng phụ
      const text = plainUp(it.label || '');
      const font = it.font || 'bigshouldersdispla900';
      const k = easeOut(t / 1.2);
      const spread = (1 - k) * 0.3 + 0.12;
      const size = fitFont(ctx, font, text, b * 0.16 * sz, W * 0.7);
      ctx.font = fontStr(font, size);
      const chars = [...text];
      const ws = chars.map((ch) => ctx.measureText(ch).width);
      const total = ws.reduce((a, v) => a + v, 0) + size * spread * (chars.length - 1);
      ctx.globalAlpha = out * clamp(t / 0.4);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      let x = cx - total / 2;
      chars.forEach((ch, i) => {
        shText(ctx, ch, x, cy, 14 * u, 3 * u, 0.5);
        ctx.fillStyle = c;
        ctx.fillText(ch, x, cy);
        x += ws[i] + size * spread;
      });
      const lw = total * segE(t, 0.2, 0.8);
      ctx.fillStyle = c;
      ctx.fillRect(cx - lw / 2, cy - size * 0.66, lw, Math.max(2, 2.5 * u));
      ctx.fillRect(cx - lw / 2, cy + size * 0.6, lw, Math.max(2, 2.5 * u));
      if (it.sub) {
        const sp = size * 0.2;
        ctx.globalAlpha = out * segE(t, 0.6, 0.4);
        ctx.font = fontStr('bvp', sp);
        const sw = ctx.measureText(it.sub).width;
        drawIco(ctx, 'pin', cx - sw / 2 - sp * 0.8, cy + size * 0.6 + sp * 1.5, sp * 1.2, c);
        shText(ctx, it.sub, cx - sw / 2, cy + size * 0.6 + sp * 1.55, 8 * u, 2 * u, 0.5);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(it.sub, cx - sw / 2, cy + size * 0.6 + sp * 1.55);
      }
      boxes.push({id: it.id, type: 'sticker', x: cx - total / 2, y: cy - size * 0.7, w: total, h: size * 1.9});
      return true;
    }
    case 'date': {
      // tem ngày kiểu máy quay phim cũ: số cam phát sáng giả, góc dưới phải, nhấp nháy dấu hai chấm
      const d = it.label ? null : new Date(it.ts || Date.now());
      const text = it.label || `${String(d.getDate()).padStart(2, '0')} ${String(d.getMonth() + 1).padStart(2, '0')} '${String(d.getFullYear()).slice(2)}`;
      const px = b * 0.05 * sz;
      ctx.font = fontStr('sairacondensed800', px);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = out * clamp(t / 0.3) * (0.92 + 0.08 * Math.sin(t * 40));
      const x = cx;
      const y = cy;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(text, x + 3 * u, y + 3 * u);
      ctx.fillStyle = mixHex(c, '#ffffff', 0.2);
      ctx.globalAlpha *= 0.4;
      ctx.lineWidth = px * 0.16;
      ctx.strokeStyle = c;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.globalAlpha = out * clamp(t / 0.3);
      ctx.fillStyle = mixHex(c, '#fff4d6', 0.35);
      ctx.fillText(text, x, y);
      const tw = ctx.measureText(text).width;
      boxes.push({id: it.id, type: 'sticker', x: x - tw, y: y - px, w: tw, h: px * 1.2});
      return true;
    }
  }
  return false;
}
function starPath(ctx, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}
