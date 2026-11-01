// Chụp lưới 11 kiểu chữ × vài thời điểm chuyển động (test/styles.png)
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport: {width: 1200, height: 900}})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(1200);
  const out = await p.evaluate(async () => {
    const r = await import('./app.js').catch(() => null);
    return !!r;
  });
  const shots = await p.evaluate(async () => {
    const m = window.__render;
    if (!m) return 'no __render';
    const {drawFrame, TEXT_STYLES, TEXT_MOTIONS, setFormat, W, H} = m;
    setFormat('9:16');
    const res = [];
    const mk = (style, motion, t) => {
      const c = document.createElement('canvas');
      c.width = 270;
      c.height = 480;
      const g = c.getContext('2d');
      g.scale(270 / 1080, 480 / 1920);
      const p = {main: {src: 'x', segs: [{in: 0, out: 10}]}, sources: {x: {duration: 10}}, texts: [{id: 't', start: 0, dur: 5, lead: 'giá chỉ', main: 'ĐẶT NGAY', sign: '', font: 'anton', color: '#ffc61a', style, motion, size: 1, x: 0.5, y: 0.5}], broll: [], zooms: [], stickers: [], sfx: [], subs: {on: false}, cta: {on: false}};
      g.fillStyle = '#3a4250';
      g.fillRect(0, 0, 1080, 1920);
      drawFrame(g, p, t, {main: null});
      return c.toDataURL('image/png');
    };
    for (const [s] of TEXT_STYLES) res.push(mk(s, 'pop', 1.6));
    for (const [mo] of TEXT_MOTIONS) res.push(mk('3d', mo, 0.35));
    return res;
  });
  if (typeof shots === 'string') {
    console.log(shots);
    return b.close();
  }
  const html = `<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(6,270px);gap:4px">${shots.map((u) => `<img src="${u}" style="width:270px;height:480px;object-fit:cover;object-position:center 45%;height:180px">`).join('')}</body>`;
  const q = await b.newPage({viewport: {width: 1640, height: 800}});
  await q.setContent(html);
  await q.waitForTimeout(300);
  await q.screenshot({path: 'test/styles.png', fullPage: true});
  console.log(JSON.stringify({n: shots.length, errs}));
  await b.close();
})();
