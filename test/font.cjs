// Chọn font trong kho cho cụm chữ → chữ trên khung đổi đúng font, có dấu tiếng Việt
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport: {width: 1440, height: 900}})).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(process.env.URL || 'http://localhost:8790/');
  await p.waitForTimeout(800);
  const fc = p.waitForEvent('filechooser');
  await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
  await (await fc).setFiles(M + 'speech_mid_g30.mp4');
  await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 60000});
  // thêm 1 cụm chữ tay
  const id = await p.evaluate(() => {
    const it = {id: 'tfont', start: 1, dur: 4, lead: 'giá chỉ', main: 'ĐẶT HÀNG NGAY', sign: 'ưu đãi tháng này', font: 'anton', color: '#ffc61a', style: '3d', size: 1, x: 0.5, y: 0.25, icon: 'cart', locked: true};
    window.__dv.p.texts.push(it);
    window.__dv.changed(true);
    return it.id;
  });
  await p.evaluate(() => document.querySelector('.clip[data-type="text"]').click());
  await p.waitForTimeout(600);
  const shots = [];
  for (const f of (process.env.FONTS || 'pattaya400,bungee400,playfairdisplay900,dancingscript700').split(',')) {
    const ok = await p.evaluate((f) => {
      const b = document.querySelector(`.fopt[data-v="${f}"]`);
      if (!b) return false;
      b.click();
      return true;
    }, f);
    await p.evaluate(() => window.__dv.seek(2.5));
    await p.waitForTimeout(1500);
    await p.locator('#cv').screenshot({path: `test/font-${f}.png`});
    shots.push(f + (ok ? '' : ' (không thấy nút)'));
  }
  await p.screenshot({path: 'test/font-panel.png'});
  const loaded = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded' && f.family.startsWith('L-')).map((f) => f.family).length);
  console.log(JSON.stringify({shots, loadedLibFonts: loaded, font: await p.evaluate(() => window.__dv.p.texts[0].font), errs}));
  await b.close();
})();
