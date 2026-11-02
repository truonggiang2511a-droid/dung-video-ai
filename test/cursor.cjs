// Kiểm con trỏ AI có hiện + nằm trong màn hình suốt lúc AI dựng không
// node test/cursor.cjs 1440 900   (URL=... để chạy web thật)
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
  const w = +(process.argv[2] || 1440), h = +(process.argv[3] || 900);
  const mob = w < 900;
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
  const p = await (await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1, hasTouch: mob, isMobile: mob})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  let fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  fc = p.waitForEvent('filechooser');
  await p.click('.tl-add[data-add="broll"]');
  await (await fc).setFiles([M + 'Phong khach.mp4', M + 'Bep.mp4', M + 'Mat tien.mp4']);
  await p.waitForFunction(() => Object.values(window.__dv.p.sources).filter((s) => s.kind === 'broll').length === 3, null, {timeout: 30000});
  await p.click('#btnAi');
  const t0 = Date.now();
  const samples = [];
  let shots = 0;
  const seen = new Set();
  while (Date.now() - t0 < 240000) {
    const s = await p.evaluate(() => {
      const c = document.querySelector('.ai-cursor');
      const tip = document.querySelector('.ai-tip');
      const r = c.getBoundingClientRect();
      return {on: c.classList.contains('on') && getComputedStyle(c).opacity > 0.5, x: Math.round(r.left), y: Math.round(r.top), tip: tip.classList.contains('on') ? tip.textContent : '', busy: window.__dv.busy, done: window.__dv.p.aiDone, st: document.querySelector('#status')?.textContent.trim().slice(0, 60)};
    });
    samples.push({t: (Date.now() - t0) / 1000, ...s});
    if (s.on && shots < 4 && samples.filter((x) => x.on).length % 6 === 1) await p.screenshot({path: `test/cur-${w}-${shots++}.png`});
    for (const k of ['Ghép', 'Zoom giật', 'Thêm chữ']) if (s.tip.includes(k) && !seen.has(k)) seen.add(k), await p.screenshot({path: `test/cur-${w}-${k.replace(/ /g, '')}.png`});
    if (s.done && !s.busy) break;
    await p.waitForTimeout(250);
  }
  const on = samples.filter((s) => s.on);
  const off = on.filter((s) => s.x < 0 || s.y < 0 || s.x > w || s.y > h);
  const tips = [...new Set(on.map((s) => s.tip).filter(Boolean))];
  console.log(JSON.stringify({w, h, secs: samples.at(-1).t, samples: samples.length, cursorOn: on.length, offscreen: off.length, firstOn: on[0]?.t, tips: tips.slice(0, 12), nTips: tips.length, errs}));
  console.log('STATUS timeline:', [...new Set(samples.map((s) => s.st))].join(' | '));
  await b.close();
})();
