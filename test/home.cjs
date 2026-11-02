// Màn Dự án: trống → + Video mới → về danh sách (có thẻ dự án). Ảnh test/home-<w>-*.png
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
  const w = +(process.argv[2] || 390), h = +(process.argv[3] || 844), mob = w < 900;
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 2, hasTouch: mob, isMobile: mob})).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(900);
  if (!mob) { await p.click('.crumb-home'); await p.waitForTimeout(500); }
  await p.screenshot({path: `test/home-${w}-0.png`});
  await p.click('[data-hgenre="bds"]');
  const fc = p.waitForEvent('filechooser');
  await p.click('#btnNew');
  await (await fc).setFiles([M + 'speech_mid_g30.mp4']);
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  console.log('genre', await p.evaluate(() => window.__dv.p.genre));
  await p.waitForTimeout(1500);
  await p.click(mob ? '#btnBack' : '.crumb-home');
  await p.waitForTimeout(900);
  await p.screenshot({path: `test/home-${w}-1.png`});
  await b.close();
})();
