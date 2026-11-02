import {drawFrame, setFormat, GFX_MAP} from '../../js/render.js';
import {newText} from '../../js/model.js';
window.perf = async (keys) => {
  setFormat('9:16');
  await document.fonts.ready;
  const bg = document.createElement('canvas'); bg.width = 1080; bg.height = 1920;
  const g = bg.getContext('2d'); g.fillStyle = '#567'; g.fillRect(0, 0, 1080, 1920);
  const c = document.createElement('canvas'); c.width = 540; c.height = 960;
  const ctx = c.getContext('2d'); ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  const out = {};
  for (const k of keys) {
    const isG = GFX_MAP[k];
    const st = isG ? [{id: 'g', kind: 'gfx', key: k, start: 0, ...GFX_MAP[k].def, dur: 9}] : [];
    const words = 'Giá bán ba tỷ tám trăm triệu có thương lượng nhé cả nhà'.split(' ').map((w, i) => ({w, s: 0.6 + i * 0.25, e: 0.8 + i * 0.25}));
    const subs = k.startsWith('subs-') ? {on: true, y: 0.72, size: 1.15, style: k.slice(5), color: '#ffffff', hl: '#ffd400'} : {on: false};
    const texts = k.startsWith('text-') ? [newText(0, {kind: 'num', main: '3,8 TỶ', lead: 'giá bán', dur: 9, y: 0.3, style: k.slice(5), color: '#ffd400'})] : [];
    const p = {main: {src: 'x', segs: [{in: 0, out: 20}]}, sources: {x: {duration: 20}}, broll: [], texts, zooms: [], stickers: st, sfx: [], subs, transcript: {words}, cta: {on: false}, format: '9:16'};
    let best = 1e9;
    for (let r = 0; r < 3; r++) {
      const t0 = performance.now();
      for (let i = 0; i < 40; i++) drawFrame(ctx, p, 1 + i * 0.04, {main: {img: bg, w: 1080, h: 1920}, broll: {}});
      ctx.getImageData(0, 0, 1, 1);
      best = Math.min(best, (performance.now() - t0) / 40);
    }
    out[k] = +best.toFixed(2);
  }
  return out;
};
