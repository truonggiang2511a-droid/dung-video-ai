// Kiểm tra vẽ chữ mẫu 1 + phụ đề + bố cục máy tính
const {chromium} = require('playwright');
const M = '/home/claude/testmedia/';
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 900, 'pc'], [390, 844, 'mb']]) {
    const ctx = await b.newContext({viewport: {width: w, height: h}, deviceScaleFactor: tag === 'pc' ? 1 : 2, hasTouch: tag === 'mb', isMobile: tag === 'mb'});
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERR', e.message));
    await p.goto('http://localhost:8790/');
    await p.waitForTimeout(600);
    if (tag === 'pc') await p.screenshot({path: 'test/pc-home.png'});
    let fc = p.waitForEvent('filechooser');
    await p.click((await p.locator('#home').isVisible()) ? '#btnNew' : '.drop.main');
    await (await fc).setFiles(M + 'aroll.mp4');
    await p.waitForFunction(() => window.__dv?.p?.main, null, {timeout: 30000});
    // giả lập lời nói đã chép + chữ
    await p.evaluate(() => {
      const ed = window.__dv;
      const q = ed.p;
      const ws = 'xin chào cả nhà hôm nay mình dẫn mọi người đi xem căn nhà phố giá 3,2 tỷ diện tích 5 x 20 mét sổ hồng riêng'.split(' ');
      q.transcript = {words: ws.map((w, i) => ({w, s: 0.4 + i * 0.4, e: 0.75 + i * 0.4}))};
      q.texts.push({id: 't1', start: 1, dur: 4, kind: 'price', lead: 'giá chỉ', main: '3,2 TỶ', sign: 'có thương lượng', font: 'anton', color: '#ff2a2a', style: '3d', size: 1, x: 0.5, y: 0.2, icon: 'tag', locked: false});
      q.texts.push({id: 't2', start: 6, dur: 4, kind: 'lockup', lead: 'diện tích', main: '5 x 20 M', sign: 'sổ hồng riêng', font: 'anton', color: '#ffc61a', style: '3d', size: 1, x: 0.5, y: 0.2, icon: 'ruler', locked: false});
      q.zooms.push({id: 'z1', start: 1, dur: 3, scale: 1.08});
      q.aiDone = true;
      ed.changed(false);
      ed.seek(2.2);
    });
    await p.waitForTimeout(900);
    await p.click('.clip[data-type="text"]');
    await p.waitForTimeout(500);
    await p.screenshot({path: `test/${tag}-editor.png`});
    if (tag === 'mb') {
      await p.click('[data-act="sheet"]');
      await p.waitForTimeout(500);
      await p.screenshot({path: 'test/mb-sheet.png'});
    }
    await ctx.close();
  }
  await b.close();
})();
