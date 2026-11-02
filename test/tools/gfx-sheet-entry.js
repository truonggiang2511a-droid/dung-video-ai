// Bảng ảnh đồ hoạ theo ngành: mỗi loại 3 thời điểm, nền giả lập người nói
import {drawFrame, setFormat, W, H, GFX_MAP} from '../../js/render.js';
window.sheet = async (keys, times) => {
  setFormat('9:16');
  await document.fonts.ready;
  const bg = document.createElement('canvas');
  bg.width = 1080; bg.height = 1920;
  const g = bg.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 1920);
  gr.addColorStop(0, '#6f8fa8'); gr.addColorStop(1, '#3b3428');
  g.fillStyle = gr; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#d9b48f'; g.beginPath(); g.arc(540, 640, 170, 0, 7); g.fill();
  g.fillStyle = '#2b3442'; g.beginPath(); g.ellipse(540, 1350, 360, 520, 0, 0, 7); g.fill();
  const sc = 0.25, cw = 1080 * sc, ch = 1920 * sc;
  const out = document.createElement('canvas');
  out.width = cw * times.length; out.height = ch * keys.length;
  const o = out.getContext('2d');
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const ctx = c.getContext('2d');
  keys.forEach((k, r) => times.forEach((t, j) => {
    const it = {id: 'g' + k, kind: 'gfx', key: k, start: 0, ...GFX_MAP[k].def};
    const p = {main: null, sources: {}, broll: [], texts: [], zooms: [], stickers: [it], sfx: [], subs: {on: false}, cta: {on: false}, format: '9:16'};
    ctx.clearRect(0, 0, 1080, 1920);
    drawFrame(ctx, p, Math.min(t, it.dur - 0.05), {main: {img: bg, w: 1080, h: 1920}, broll: {}});
    o.drawImage(c, j * cw, r * ch, cw, ch);
    o.fillStyle = '#d1fe17'; o.font = '600 16px sans-serif'; o.fillText(`${k} · ${t}s`, j * cw + 8, r * ch + 20);
  }));
  return out.toDataURL('image/png');
};
